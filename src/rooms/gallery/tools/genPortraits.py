#!/usr/bin/env python3
"""
Offline portrait painter for the gallery.

Source faces (tools/src_faces/*.png, 256 px) are synthetic painted faces sampled from a
StyleGAN2 model trained on MetFaces (they depict nobody real and are no one's artwork).
This script turns each face into a full Victorian easel portrait: upscales and re-paints
the face, outpaints a chiaroscuro background and a costumed bust, then ages the canvas
(brush texture, canvas weave, craquelure, yellowed varnish, grime, feigned ovals).

Outputs (public/assets/gallery/portraits/):
  <name>.jpg        albedo (sRGB)
  <name>_bump.png   grayscale height (canvas weave + impasto + cracks) for bumpMap
  ../ghost.png      RGBA card for the grey lady
and src/rooms/gallery/portraitData.json with per-portrait eye layout in UV space.

  python3 src/rooms/gallery/tools/genPortraits.py
"""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
OUT = os.path.join(ROOT, 'public/assets/gallery/portraits')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1993)


# ----------------------------------------------------------------------------- helpers
def noise(h, w, cell, seed, octaves=4):
    """fbm value noise in 0..1 (bicubic-upscaled random grids)."""
    r = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        c = max(2, int(cell / (2 ** o)))
        gh, gw = h // c + 3, w // c + 3
        g = Image.fromarray(r.random((gh, gw)).astype(np.float32), 'F')
        g = g.resize((gw * c, gh * c), Image.BICUBIC)
        a = np.asarray(g)[:h, :w]
        acc += a * amp; tot += amp; amp *= 0.5
    return np.clip(acc / tot, 0, 1)


def stretched_noise(h, w, cx, cy, seed):
    """anisotropic noise (strokes / folds): cells cx wide, cy tall."""
    r = np.random.default_rng(seed)
    g = Image.fromarray(r.random((h // cy + 3, w // cx + 3)).astype(np.float32), 'F')
    g = g.resize(((w // cx + 3) * cx, (h // cy + 3) * cy), Image.BICUBIC)
    return np.asarray(g)[:h, :w]


def box(a, r):
    """box blur (2r+1) via cumulative sums, 2D float."""
    k = 2 * r + 1
    p = np.pad(a, ((r + 1, r), (r + 1, r)), mode='edge')
    c = p.cumsum(0).cumsum(1)
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def kuwahara(img, r):
    """Kuwahara filter (painterly flat strokes). img float HxWx3."""
    lum = img @ np.array([0.3, 0.59, 0.11], np.float32)
    H, W = lum.shape
    m = [box(img[..., i], r) for i in range(3)]
    ml = box(lum, r); m2 = box(lum * lum, r)
    var = m2 - ml * ml
    best = None; bestv = None
    for dy in (-r, r):
        for dx in (-r, r):
            sh = lambda a: np.roll(np.roll(a, -dy, 0), -dx, 1)
            v = sh(var)
            col = np.stack([sh(m[i]) for i in range(3)], -1)
            if best is None:
                best, bestv = col, v
            else:
                sel = v < bestv
                best = np.where(sel[..., None], col, best); bestv = np.minimum(v, bestv)
    return best


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def to_img(a):
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))


def srgb(c):
    return np.array(c, np.float32) / 255.0


def find_eyes(face):
    """refine iris centres near the standard alignment (0.37,0.46)/(0.61,0.46)."""
    a = np.asarray(face.convert('L'), np.float32) / 255
    out = []
    for ex in (0.37, 0.61):
        x0, y0 = int(ex * 256), int(0.46 * 256)
        win = a[y0 - 12:y0 + 12, x0 - 16:x0 + 16]
        thr = np.percentile(win, 12)
        ys, xs = np.nonzero(win <= thr)
        out.append((x0 - 16 + xs.mean() + 0.5, y0 - 12 + ys.mean() + 0.5))
    return out


# ----------------------------------------------------------------------------- painter
def paint_portrait(spec):
    W = spec.get('W', 1024); H = spec['H']
    face = Image.open(os.path.join(HERE, 'src_faces', spec['face'] + '.png')).convert('RGB')
    eyes = find_eyes(face)
    fa = np.asarray(face, np.float32) / 255

    # ---- colours sampled from the source
    border = np.concatenate([fa[:6, :].reshape(-1, 3), fa[:, :6].reshape(-1, 3), fa[:, -6:].reshape(-1, 3)])
    bgc = np.median(border, 0) * spec.get('bgMul', 1.0)
    if 'bg' in spec: bgc = srgb(spec['bg'])
    coat = srgb(spec['coat']) if 'coat' in spec else np.median(np.concatenate([fa[236:, 8:50].reshape(-1, 3), fa[236:, 206:248].reshape(-1, 3)]), 0)
    skin = np.median(fa[238:254, 112:144].reshape(-1, 3), 0)
    if 'skin' in spec: skin = srgb(spec['skin'])

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = xx / W; v = yy / H

    # ---- background: umber ground, warm halo behind the head (light from upper left), blotchy scumble
    halo = np.exp(-(((u - 0.42) / 0.42) ** 2 + ((v - 0.3) / 0.38) ** 2))
    n1 = noise(H, W, 180, spec['seed']); n2 = noise(H, W, 40, spec['seed'] + 1)
    bg = bgc[None, None, :] * (0.38 + 0.85 * halo[..., None]) * (0.82 + 0.36 * n1[..., None]) * (0.94 + 0.12 * n2[..., None])
    bg *= (1 - 0.55 * smoothstep(0.35, 1.0, v))[..., None]
    # brushy diagonal strokes in the ground
    st = stretched_noise(H, W, 9, 60, spec['seed'] + 2)
    st = Image.fromarray(st.astype(np.float32), 'F').rotate(28, resample=Image.BICUBIC, expand=False)
    bg *= (0.93 + 0.14 * np.asarray(st))[..., None]
    img = bg.copy()

    # ---- face placement
    fs = int(W * spec.get('faceW', 0.6))
    fx0 = int(W * spec.get('faceX', 0.5) - fs / 2); fy0 = int(H * spec.get('faceY', 0.08))
    face_up = face.resize((fs, fs), Image.LANCZOS)
    fu = np.asarray(face_up, np.float32) / 255
    kw = np.asarray(to_img(kuwahara(fu, 2)).filter(ImageFilter.GaussianBlur(0.9)), np.float32) / 255
    fu = 0.65 * fu + 0.35 * kw
    # unsharp to restore crisp eyes after the paint pass
    blur = np.asarray(to_img(fu).filter(ImageFilter.GaussianBlur(2.2)), np.float32) / 255
    fu = np.clip(fu + 0.45 * (fu - blur), 0, 1)

    # ---- body / costume (drawn in full-canvas coordinates)
    neckY = fy0 + fs * 0.86
    shoulderY = fy0 + fs * spec.get('shoulder', 1.0)
    cx = W * spec.get('faceX', 0.5)
    body = Image.new('L', (W, H), 0); d = ImageDraw.Draw(body)
    sw = W * spec.get('shoulderW', 0.5)
    nw = fs * 0.17
    drop = fs * spec.get('drop', 0.3)
    def edge(t):
        # neck -> trapezius slope -> rounded shoulder -> arm falling away
        x = nw + (sw - nw) * t
        y = neckY + drop * (t ** 1.3) * 0.75 + drop * smoothstep(0.55, 1.0, t) * 0.6 + (H - neckY) * max(0.0, t - 0.88) ** 2 * 12
        return x, y
    pts = []
    for t in np.linspace(0, 1.15, 60):
        x, y = edge(min(t, 1.15)); pts.append((cx - x, y))
    pts += [(cx - sw - W * 0.3, H + 10), (cx + sw + W * 0.3, H + 10)]
    for t in np.linspace(1.15, 0, 60):
        x, y = edge(t); pts.append((cx + x, y))
    d.polygon(pts, fill=255)
    bm = np.asarray(body.filter(ImageFilter.GaussianBlur(4)), np.float32) / 255

    # coat shading: torso volume lit from the upper left, sinking into shadow; soft drapery folds
    fold = stretched_noise(H, W, 46, 260, spec['seed'] + 5)
    fold = np.asarray(Image.fromarray(fold.astype(np.float32), 'F').rotate(-6, resample=Image.BICUBIC))
    fold2 = stretched_noise(H, W, 12, 70, spec['seed'] + 6)
    lit = np.clip(1.0 - (u - (cx / W - 0.25)) * 1.1, 0.25, 1.15)
    rel = (xx - cx) / sw
    cyl = np.clip(np.cos(np.clip(rel + 0.25, -1.6, 1.6) * 1.0), 0.05, 1.0)
    top = np.exp(-((yy - neckY - drop) / (H * 0.25)) ** 2)
    shade = (0.35 + 0.75 * cyl * (0.45 + 0.55 * top)) * (0.82 + 0.3 * fold + 0.1 * fold2) * (1 - 0.6 * smoothstep(0.6, 1.0, v))
    sheen = smoothstep(0.7, 0.98, fold) * spec.get('sheen', 0.35) * cyl * top
    coat_col = coat[None, None, :] * shade[..., None] * 1.2 + sheen[..., None] * (coat[None, None, :] * 0.8 + 0.08)
    img = img * (1 - bm[..., None]) + coat_col * bm[..., None]

    # shirt front / chest / lace collar / cravat (optional layers)
    layer = Image.new('L', (W, H), 0); ld = ImageDraw.Draw(layer)
    if spec.get('shirt'):
        vw = fs * spec.get('shirtW', 0.16); vd = H * spec.get('shirtDepth', 0.3)
        ld.polygon([(cx - vw, neckY - 10), (cx + vw, neckY - 10), (cx + vw * 0.3, neckY + vd), (cx - vw * 0.3, neckY + vd)], fill=255)
        sm = np.asarray(layer.filter(ImageFilter.GaussianBlur(5)), np.float32) / 255
        shirt = srgb(spec.get('shirtCol', (225, 215, 195)))
        sshade = (0.6 + 0.4 * stretched_noise(H, W, 10, 50, spec['seed'] + 9)) * lit * (1 - 0.5 * smoothstep(0.6, 1.0, v))
        img = img * (1 - sm[..., None]) + (shirt[None, None, :] * sshade[..., None]) * sm[..., None]
    if spec.get('chest'):
        layer = Image.new('L', (W, H), 0); ld = ImageDraw.Draw(layer)
        cw = fs * spec['chest'][0]; cy1 = neckY + H * spec['chest'][1]
        ld.ellipse([cx - cw, neckY - fs * 0.15, cx + cw, cy1], fill=255)
        cm = np.asarray(layer.filter(ImageFilter.GaussianBlur(8)), np.float32) / 255
        cs = skin[None, None, :] * (0.75 + 0.25 * lit[..., None]) * (1 - 0.35 * smoothstep(neckY / H, cy1 / H, v))[..., None]
        img = img * (1 - cm[..., None]) + cs * cm[..., None]
    if spec.get('lace'):
        if True:
            # scalloped lace bertha along the neckline
            lace = Image.new('L', (W, H), 0); dd = ImageDraw.Draw(lace)
            for t in np.linspace(-1, 1, 46):
                ang = t * 1.25
                cw = fs * 0.2; cy1 = neckY + fs * 0.16
                x = cx + math.sin(ang) * cw * 1.02; y = neckY + math.cos(ang) * (cy1 - neckY)
                rr = fs * 0.03
                dd.ellipse([x - rr, y - rr, x + rr, y + rr], outline=255, width=3)
                dd.ellipse([x - rr * 0.35, y - rr * 0.35, x + rr * 0.35, y + rr * 0.35], fill=200)
            lm = np.asarray(lace.filter(ImageFilter.GaussianBlur(1.6)), np.float32) / 255 * 0.85
            lc = srgb((228, 220, 200))[None, None, :] * (0.55 + 0.45 * lit[..., None])
            img = img * (1 - lm[..., None]) + lc * lm[..., None]
    if spec.get('collar'):
        layer = Image.new('L', (W, H), 0); ld = ImageDraw.Draw(layer)
        cw = fs * spec['collar']
        for s in (-1, 1):
            ld.polygon([(cx, neckY + fs * 0.02), (cx + s * cw, neckY - fs * 0.04), (cx + s * cw * 1.25, neckY + fs * 0.1), (cx + s * cw * 0.2, neckY + fs * 0.2)], fill=255)
        cm = np.asarray(layer.filter(ImageFilter.GaussianBlur(3)), np.float32) / 255
        cc = srgb(spec.get('collarCol', (232, 226, 210)))[None, None, :] * (0.6 + 0.4 * lit[..., None])
        img = img * (1 - cm[..., None]) + cc * cm[..., None]
    if spec.get('cravat'):
        layer = Image.new('L', (W, H), 0); ld = ImageDraw.Draw(layer)
        cw = fs * 0.05
        ld.polygon([(cx - cw, neckY + fs * 0.0), (cx + cw, neckY + fs * 0.0), (cx + cw * 1.4, neckY + fs * 0.12), (cx, neckY + fs * 0.26), (cx - cw * 1.4, neckY + fs * 0.12)], fill=255)
        cm = np.asarray(layer.filter(ImageFilter.GaussianBlur(3)), np.float32) / 255
        cc = srgb(spec['cravat'])[None, None, :] * (0.55 + 0.6 * stretched_noise(H, W, 6, 30, 77)[..., None]) * lit[..., None]
        img = img * (1 - cm[..., None]) + cc * cm[..., None]
    jewel = Image.new('L', (W, H), 0); jd = ImageDraw.Draw(jewel)
    jcol = None
    if spec.get('buttons'):
        for i in range(spec['buttons']):
            y = neckY + fs * 0.32 + i * fs * 0.13; x = cx + fs * 0.2
            r = fs * 0.016; jd.ellipse([x - r, y - r, x + r, y + r], fill=255)
            x = cx - fs * 0.2; jd.ellipse([x - r, y - r, x + r, y + r], fill=255)
        jcol = (200, 160, 80)
    if spec.get('pearls'):
        cw = fs * 0.14
        for t in np.linspace(-1, 1, 31):
            ang = t * 1.1
            x = cx + math.sin(ang) * cw; y = neckY + fs * 0.1 + math.cos(ang) * fs * 0.16
            r = fs * 0.011; jd.ellipse([x - r, y - r, x + r, y + r], fill=255)
        jcol = (235, 228, 210)
    if spec.get('brooch'):
        x, y = cx, neckY + fs * 0.12
        jd.ellipse([x - fs * 0.04, y - fs * 0.05, x + fs * 0.04, y + fs * 0.05], fill=255)
        jcol = (215, 190, 150)
    if jcol is not None:
        jm = np.asarray(jewel.filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255
        # spherical shading per jewel: highlight upper-left
        hl = np.asarray(jewel.filter(ImageFilter.GaussianBlur(3)).transform(jewel.size, Image.AFFINE, (1, 0, 2, 0, 1, 2)), np.float32) / 255
        jc = srgb(jcol)[None, None, :] * (0.45 + 0.7 * hl[..., None])
        img = img * (1 - jm[..., None]) + jc * jm[..., None]

    # ---- composite the face with a feathered head mask
    fm = Image.new('L', (fs, fs), 0); fd = ImageDraw.Draw(fm)
    fd.ellipse([fs * 0.06, fs * 0.03, fs * 0.94, fs * 1.06], fill=255)
    fm = fm.filter(ImageFilter.GaussianBlur(fs * 0.045))
    fmask = np.asarray(fm, np.float32) / 255
    # fade the bottom of the crop (its own clothes) into our costume
    fy = np.linspace(0, 1, fs)[:, None]
    fmask = fmask * (1 - smoothstep(spec.get('cropFade', 0.86), 1.0, fy))
    # colour-match crop background to ours around the edges
    region = img[fy0:fy0 + fs, fx0:fx0 + fs]
    region[:] = region * (1 - fmask[..., None]) + fu * fmask[..., None]

    # ---- feigned oval (painted spandrels) for some sitters
    if spec.get('oval'):
        om = Image.new('L', (W, H), 0); od = ImageDraw.Draw(om)
        mx, my = W * 0.07, H * 0.055
        od.ellipse([mx, my, W - mx, H - my], fill=255)
        o = np.asarray(om.filter(ImageFilter.GaussianBlur(3)), np.float32) / 255
        span = srgb(spec['oval'])[None, None, :] * (0.7 + 0.5 * noise(H, W, 60, 99)[..., None])
        img = img * o[..., None] + span * (1 - o[..., None])
        ring = Image.new('L', (W, H), 0); rd = ImageDraw.Draw(ring)
        rd.ellipse([mx, my, W - mx, H - my], outline=255, width=6)
        rg = np.asarray(ring.filter(ImageFilter.GaussianBlur(1.5)), np.float32) / 255
        img = img * (1 - rg[..., None] * 0.8) + srgb((170, 130, 60))[None, None, :] * rg[..., None] * 0.8

    if spec.get('extra'): img = spec['extra'](img, W, H, u, v)

    img, bump = age_canvas(img, W, H, spec['seed'])

    # eye layout in UV (v up)
    eyes_uv = []
    for (ex, ey) in eyes:
        px = fx0 + ex / 256 * fs; py = fy0 + ey / 256 * fs
        eyes_uv.append([px / W, 1 - py / H])
    rad = [13 / 256 * fs / W, 6.5 / 256 * fs / H]
    iris = (5.5 / 256) * fs / W
    return img, bump, {'left': eyes_uv[0], 'right': eyes_uv[1], 'radius': rad, 'iris': iris, 'aspect': W / H}


def age_canvas(img, W, H, seed):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    lum = img @ np.array([0.3, 0.59, 0.11], np.float32)
    # brush texture: short strokes following a slowly rotating field
    strokes = stretched_noise(H, W, 3, 14, seed + 20)
    img = img * (0.95 + 0.1 * strokes)[..., None]
    # canvas weave (plain weave, ~22 threads per cm on a 0.75 m canvas -> ~1.6 px period here)
    weave = (np.sin(xx * 2.2) * np.sin(yy * 2.2 + np.sin(xx * 0.05))) * 0.5 + 0.5
    weave_c = np.sin(xx * 1.1 + 0.6 * np.sin(yy * 0.13)) * 0.5 + 0.5
    # craquelure: ridged noise lines, two scales
    c1 = np.abs(noise(H, W, 34, seed + 30, 3) - 0.5); c2 = np.abs(noise(H, W, 14, seed + 31, 2) - 0.5)
    crack = np.maximum(smoothstep(0.006, 0.0, c1), 0.7 * smoothstep(0.006, 0.0, c2))
    crack *= smoothstep(0.35, 0.65, noise(H, W, 300, seed + 32, 2))     # patchy
    img = img * (1 - 0.2 * crack[..., None]) * (0.965 + 0.05 * weave[..., None])
    # yellowed varnish + grime toward the edges, deep ground
    var = np.array([1.0, 0.9, 0.68], np.float32)
    img = img ** 1.05 * var[None, None, :] * 0.95 + np.array([0.012, 0.008, 0.002])
    u = xx / W; v = yy / H
    edge = np.minimum(np.minimum(u, 1 - u), np.minimum(v, 1 - v))
    grime = (1 - 0.45 * smoothstep(0.12, 0.0, edge)) * (0.9 + 0.1 * noise(H, W, 120, seed + 40))
    img = img * grime[..., None]
    # height: impasto follows light paint, canvas weave, cracks
    hp = lum - np.asarray(to_img(np.stack([lum] * 3, -1)).filter(ImageFilter.GaussianBlur(6)).convert('L'), np.float32) / 255
    bump = 0.5 + 0.25 * hp + 0.12 * (weave - 0.5) + 0.06 * (weave_c - 0.5) + 0.06 * (strokes - 0.5) - 0.25 * crack
    return np.clip(img, 0, 1), np.clip(bump, 0, 1)


# ----------------------------------------------------------------------------- toymaker (puzzle) extras
def _scroll(d, cx, cy, sx, sy, scale, gold, dark):
    """acanthus scroll: a spiral stem with leaves, mirrored by sx/sy."""
    pts = []
    for i in range(80):
        t = i / 79
        a = t * 4.2 * math.pi
        r = scale * (1 - t) ** 1.2
        pts.append((cx + sx * (math.cos(a) * r + t * scale * 1.6), cy + sy * (math.sin(a) * r * 0.8 + t * scale * 0.4)))
    d.line(pts, fill=dark, width=9, joint='curve'); d.line(pts, fill=gold, width=5, joint='curve')
    for i in range(4, 72, 6):
        x, y = pts[i]; x2, y2 = pts[i + 2]
        ang = math.atan2(y2 - y, x2 - x) + (0.9 if i % 12 else -0.9) * sy * sx
        L = scale * 0.32 * (1 - i / 90)
        tip = (x + math.cos(ang) * L, y + math.sin(ang) * L)
        n = (-math.sin(ang) * L * 0.28, math.cos(ang) * L * 0.28)
        mid = (x + math.cos(ang) * L * 0.5, y + math.sin(ang) * L * 0.5)
        d.polygon([(x, y), (mid[0] + n[0], mid[1] + n[1]), tip, (mid[0] - n[0], mid[1] - n[1])], fill=gold, outline=dark)


def toymaker_extra(img, W, H, u, v):
    """gilt scroll spandrels in all four corners + painted inscription band: every tile carries detail."""
    pil = to_img(img); d = ImageDraw.Draw(pil, 'RGBA')
    gold = (186, 140, 62, 255); dk = (50, 32, 12, 255)
    band_y = int(H * 0.86)
    mx, my = W * 0.06, H * 0.035
    # dark spandrels outside a painted oval
    om = Image.new('L', (W, H), 0); ImageDraw.Draw(om).ellipse([mx, my, W - mx, band_y - 8], fill=255)
    o = np.asarray(om.filter(ImageFilter.GaussianBlur(3)), np.float32)[..., None] / 255
    span = np.asarray(pil, np.float32) / 255 * 0.25 + np.array([0.05, 0.035, 0.025]) * (0.7 + 0.6 * noise(H, W, 50, 7)[..., None])
    pil = to_img(np.asarray(pil, np.float32) / 255 * o + span * (1 - o)); d = ImageDraw.Draw(pil, 'RGBA')
    d.ellipse([mx, my, W - mx, band_y - 8], outline=dk, width=14)
    d.ellipse([mx, my, W - mx, band_y - 8], outline=gold, width=7)
    d.ellipse([mx + 16, my + 16, W - mx - 16, band_y - 24], outline=(110, 78, 32, 255), width=3)
    for (sx, sy) in [(1, 1), (-1, 1), (1, -1), (-1, -1)]:
        cx = 70 if sx > 0 else W - 70; cy = 70 if sy > 0 else band_y - 70
        _scroll(d, cx, cy, sx, sy, 62, gold, dk)
        # rosette
        rx = 34 if sx > 0 else W - 34; ry = 34 if sy > 0 else band_y - 30
        for k in range(8):
            a = k * math.pi / 4
            d.ellipse([rx + math.cos(a) * 14 - 8, ry + math.sin(a) * 14 - 8, rx + math.cos(a) * 14 + 8, ry + math.sin(a) * 14 + 8], fill=gold, outline=dk)
        d.ellipse([rx - 7, ry - 7, rx + 7, ry + 7], fill=(120, 30, 20, 255), outline=dk)
    try:
        f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', 58)
        f2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', 50)
    except Exception:
        f = f2 = ImageFont.load_default()
    for sx, ch in ((1, 'H'), (-1, 'S')):
        x = 165 if sx > 0 else W - 165; y = 205
        d.ellipse([x - 46, y - 46, x + 46, y + 46], fill=(40, 22, 14, 255), outline=gold, width=5)
        d.text((x, y + 2), ch, font=f, fill=gold, anchor='mm')
    # inscription band
    d.rectangle([0, band_y, W, H], fill=(34, 21, 13, 255))
    d.line([0, band_y + 6, W, band_y + 6], fill=gold, width=5)
    d.line([0, H - 12, W, H - 12], fill=gold, width=3)
    d.text((W / 2, band_y + (H - band_y) / 2 + 2), 'H · S T A U F · TOYMAKER · 1889', font=f2, fill=(200, 160, 82, 255), anchor='mm')
    out = np.asarray(pil, np.float32) / 255
    # soften only what we drew into paint
    diff = np.abs(out - img).sum(-1)
    m = np.asarray(to_img(np.stack([np.clip(diff * 8, 0, 1)] * 3, -1)).filter(ImageFilter.GaussianBlur(3)).convert('L'), np.float32)[..., None] / 255
    soft = kuwahara(out, 2)
    gl = noise(H, W, 30, 8)[..., None]
    out = out * (1 - m) + soft * (0.8 + 0.35 * gl) * m
    return np.clip(out, 0, 1)


# ----------------------------------------------------------------------------- specs
SPECS = {
    'lady':    dict(face='s0', H=1314, seed=11, faceW=0.58, faceY=0.1, coat=(30, 46, 98), sheen=0.6, skin=(214, 178, 150), lace=True, pearls=True, oval=(22, 16, 12), shoulderW=0.52, cropFade=0.94),
    'colonel': dict(face='v9_2', H=1306, seed=23, faceW=0.6, faceY=0.08, coat=(74, 14, 13), sheen=0.3, collar=0.16, collarCol=(30, 26, 22), buttons=4, shoulderW=0.56, shoulder=0.95),
    'elder':   dict(face='s8', H=1314, seed=37, coat=(24, 27, 40), faceW=0.6, faceY=0.08, shirt=True, shirtW=0.15, shirtDepth=0.18, cravat=(225, 220, 205), shoulderW=0.55),
    'child':   dict(face='s6', H=1331, seed=41, faceW=0.62, faceY=0.12, coat=(70, 84, 104), collar=0.2, oval=(18, 14, 12), shoulderW=0.46),
    'widow':   dict(face='v3_7', H=1314, seed=53, faceW=0.58, faceY=0.1, coat=(14, 13, 15), sheen=0.5, brooch=True, collar=0.14, shoulderW=0.5),
    'toymaker': dict(face='v8_4', W=1024, H=1024, seed=67, faceW=0.64, faceY=0.1, coat=(22, 20, 18), shirt=True, shirtW=0.12, shirtDepth=0.12, cravat=(90, 18, 16), shoulderW=0.56, shoulder=0.92, extra=toymaker_extra, bgMul=0.55),
}


def ghost_card():
    """grey lady: painted face + long nightgown silhouette as an RGBA card (white-ish, alpha = density)."""
    W, H = 512, 1536
    face = Image.open(os.path.join(HERE, 'src_faces', 'm2.png')).convert('RGB')
    fs = 300
    fu = np.asarray(face.resize((fs, fs), Image.LANCZOS), np.float32) / 255
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = xx / W; v = yy / H
    lum = np.zeros((H, W), np.float32); alpha = np.zeros((H, W), np.float32)
    # gown silhouette widening to the floor, arms folded
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    pts = []
    for t in np.linspace(0, 1, 50):
        y = 250 + t * (H - 270)
        w = 30 + 130 * smoothstep(0.0, 0.12, t) + 60 * t ** 1.5
        pts.append((W / 2 - w, y))
    for t in np.linspace(1, 0, 50):
        y = 250 + t * (H - 270)
        w = 30 + 130 * smoothstep(0.0, 0.12, t) + 60 * t ** 1.5
        pts.append((W / 2 + w, y))
    d.polygon(pts, fill=255)
    gm = np.asarray(m.filter(ImageFilter.GaussianBlur(14)), np.float32) / 255
    folds = stretched_noise(H, W, 14, 400, 5) * 0.6 + stretched_noise(H, W, 5, 160, 6) * 0.4
    glum = (0.45 + 0.55 * folds) * (1 - 0.3 * v)
    galpha = gm * (0.55 + 0.45 * folds) * (1 - smoothstep(0.55, 1.0, v))
    # hair veil around the face
    lum += glum * gm; alpha = np.maximum(alpha, galpha)
    fx0, fy0 = W // 2 - fs // 2, 40
    fm = Image.new('L', (fs, fs), 0); fd = ImageDraw.Draw(fm)
    fd.ellipse([fs * 0.08, 0, fs * 0.92, fs * 1.02], fill=255)
    fmask = np.asarray(fm.filter(ImageFilter.GaussianBlur(18)), np.float32) / 255
    fmask = fmask * (1 - smoothstep(0.72, 0.97, np.linspace(0, 1, fs)[:, None]))
    flum = fu @ np.array([0.3, 0.59, 0.11], np.float32)
    flum = np.clip((flum - 0.12) * 1.25, 0, 1)
    sl = (slice(fy0, fy0 + fs), slice(fx0, fx0 + fs))
    lum[sl] = lum[sl] * (1 - fmask) + flum * fmask
    alpha[sl] = np.maximum(alpha[sl], fmask * (0.35 + 0.65 * flum))
    rgb = np.stack([lum * 0.86, lum * 0.92, lum * 1.0], -1)
    out = np.concatenate([np.clip(rgb, 0, 1), np.clip(alpha, 0, 1)[..., None]], -1)
    Image.fromarray((out * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, '..', 'ghost.png'), optimize=True)


if __name__ == '__main__':
    data = {}
    for name, spec in SPECS.items():
        img, bump, eyes = paint_portrait(spec)
        to_img(img).save(os.path.join(OUT, f'{name}.jpg'), quality=88, optimize=True)
        Image.fromarray((bump * 255).astype(np.uint8), 'L').resize((bump.shape[1] // 2, bump.shape[0] // 2), Image.BILINEAR).save(os.path.join(OUT, f'{name}_bump.png'), optimize=True)
        data[name] = eyes
        print(name, eyes)
    ghost_card()
    with open(os.path.join(ROOT, 'src/rooms/gallery/portraitData.json'), 'w') as f:
        json.dump(data, f, indent=1)
