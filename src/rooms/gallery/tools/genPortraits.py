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
    if not spec.get('painterly'):
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
    mi = spec.get('maskInset', (0.06, 0.03))
    fd.ellipse([fs * mi[0], fs * mi[1], fs * (1 - mi[0]), fs * 1.06], fill=255)
    fm = fm.filter(ImageFilter.GaussianBlur(fs * spec.get('maskBlur', 0.045)))
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

    stroke_h = None
    if spec.get('painterly'):
        keep = np.zeros((H, W), np.float32)
        for (ex, ey) in eyes:
            px = fx0 + ex / 256 * fs; py = fy0 + ey / 256 * fs
            keep = np.maximum(keep, np.exp(-(((xx - px) / (fs * 0.07)) ** 2 + ((yy - py) / (fs * 0.045)) ** 2)))
        img, stroke_h = painterly(img, spec['seed'], spec['painterly'], keep)

    img, bump = age_canvas(img, W, H, spec['seed'], stroke_h)

    # eye layout in UV (v up)
    eyes_uv = []
    for (ex, ey) in eyes:
        px = fx0 + ex / 256 * fs; py = fy0 + ey / 256 * fs
        eyes_uv.append([px / W, 1 - py / H])
    rad = [13 / 256 * fs / W, 6.5 / 256 * fs / H]
    iris = (5.5 / 256) * fs / W
    return img, bump, {'left': eyes_uv[0], 'right': eyes_uv[1], 'radius': rad, 'iris': iris, 'aspect': W / H}


def gblur(a, sigma):
    """gaussian-ish blur: three box passes (float, any channel count)."""
    if a.ndim == 3:
        return np.stack([gblur(a[..., c], sigma) for c in range(a.shape[2])], -1)
    r = max(1, int(round(sigma * 0.9)))
    out = a.astype(np.float32)
    for _ in range(3): out = box(out, r)
    return out


def painterly(ref, seed, sizes, keep):
    """Re-paint the image in oil: layered brush strokes (coarse to fine) that follow the form
    (structure-tensor orientation, i.e. along the isophotes), each stroke a flat loaded colour
    sampled from the blurred reference, only where the canvas still differs from the reference.
    Returns (painted, stroke height field for the impasto bump)."""
    H, W = ref.shape[:2]
    r = np.random.default_rng(seed + 500)
    lum = ref @ np.array([0.3, 0.59, 0.11], np.float32)
    L = gblur(lum, 2.5)
    gx = np.zeros_like(L); gy = np.zeros_like(L)
    gx[:, 1:-1] = L[:, 2:] - L[:, :-2]; gy[1:-1, :] = L[2:, :] - L[:-2, :]
    jxx, jxy, jyy = gblur(gx * gx, 9), gblur(gx * gy, 9), gblur(gy * gy, 9)
    theta = 0.5 * np.arctan2(2 * jxy, jxx - jyy) + np.pi / 2          # along the isophote
    coher = np.sqrt((jxx - jyy) ** 2 + 4 * jxy ** 2) / (jxx + jyy + 1e-6)
    canvas = gblur(ref, sizes[0] * 1.5)
    hgt = np.full((H, W), 0.5, np.float32)
    for li, rad in enumerate(sizes):
        refb = gblur(ref, rad * 0.6)
        err = np.abs(canvas - refb).sum(-1)
        err = gblur(err, rad)
        step = max(1.0, rad * 1.15)
        ys, xs = np.mgrid[0:H:step, 0:W:step]
        ys = (ys + r.random(ys.shape) * step).astype(int).clip(0, H - 1).ravel()
        xs = (xs + r.random(xs.shape) * step).astype(int).clip(0, W - 1).ravel()
        order = r.permutation(len(xs))
        thr = 0.0 if li == 0 else 0.035
        cim = to_img(canvas); cd = ImageDraw.Draw(cim)
        him = Image.fromarray((hgt * 255).astype(np.uint8), 'L'); hd = ImageDraw.Draw(him)
        for k in order:
            x, y = xs[k], ys[k]
            if err[y, x] < thr: continue
            c = refb[y, x] * (0.96 + 0.08 * r.random()) + (r.random(3) - 0.5) * 0.012
            c = tuple(int(v) for v in np.clip(c * 255, 0, 255))
            a = theta[y, x] + (r.random() - 0.5) * 0.35 * (1.2 - min(1.0, coher[y, x]))
            ln = rad * (1.6 + 2.6 * r.random()) * (0.7 + 0.8 * min(1.0, coher[y, x] * 2))
            dx, dy = np.cos(a) * ln / 2, np.sin(a) * ln / 2
            wdt = max(1, int(round(rad * (1.4 + 0.5 * r.random()))))
            cd.line([(x - dx, y - dy), (x + dx, y + dy)], fill=c, width=wdt)
            hv = int(120 + 120 * r.random())
            hd.line([(x - dx, y - dy), (x + dx, y + dy)], fill=hv, width=max(1, wdt - 1))
        canvas = np.asarray(cim, np.float32) / 255
        hgt = np.asarray(him, np.float32) / 255
        print('  painterly layer', rad, 'done')
    canvas = gblur(canvas, 0.6)
    # the eyes keep the reference's detail (the glazed final touches a painter would add)
    k = np.clip(keep * 0.75, 0, 1)[..., None]
    out = canvas * (1 - k) + ref * k
    return np.clip(out, 0, 1), gblur(hgt, 0.8)


def age_canvas(img, W, H, seed, stroke_h=None):
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
    if stroke_h is not None: bump = bump + 0.35 * (stroke_h - 0.5)
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
    """the master's likeness: a deep umber ground falling to near-black at the corners, a cold
    rim of light on the shadow side of the head, a warm glow behind it. (No lettering on the
    canvas: the name is on a separate engraved brass plaque.)"""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx / W - 0.5) / 0.55) ** 2 + ((yy / H - 0.42) / 0.62) ** 2)
    vig = 1 - 0.4 * smoothstep(0.85, 1.35, r + 0.1 * (noise(H, W, 90, 71) - 0.5))
    # the ground is lifted to a warm, scumbled umber so every scrambled piece of the board still
    # carries readable paint (brushwork, a glow behind the head), not a black square
    scum = (0.85 + 0.3 * noise(H, W, 70, 73))[..., None]
    lum = img @ np.array([0.3, 0.59, 0.11], np.float32)
    dark = smoothstep(0.42, 0.06, lum)[..., None]
    ground = np.array([0.5, 0.35, 0.22]) * scum * (0.65 + 0.6 * np.exp(-(((u - 0.45) / 0.45) ** 2 + ((v - 0.35) / 0.42) ** 2)))[..., None]
    img = img * (1 - dark * 0.8) + np.maximum(img, ground) * dark * 0.8
    glow = np.exp(-(((u - 0.4) / 0.35) ** 2 + ((v - 0.3) / 0.3) ** 2))[..., None] * np.array([0.07, 0.045, 0.02])
    return np.clip(img * vig[..., None] + glow, 0, 1)


# ----------------------------------------------------------------------------- specs
SPECS = {
    'lady':    dict(face='s0', H=1314, seed=11, faceW=0.58, faceY=0.1, coat=(30, 46, 98), sheen=0.6, skin=(214, 178, 150), lace=True, pearls=True, oval=(22, 16, 12), shoulderW=0.52, cropFade=0.94),
    'colonel': dict(face='v9_2', H=1306, seed=23, faceW=0.6, faceY=0.08, coat=(74, 14, 13), sheen=0.3, collar=0.16, collarCol=(30, 26, 22), buttons=4, shoulderW=0.56, shoulder=0.95),
    'elder':   dict(face='v8_4', H=1314, seed=37, coat=(24, 27, 40), faceW=0.6, faceY=0.08, shirt=True, shirtW=0.15, shirtDepth=0.18, cravat=(225, 220, 205), shoulderW=0.55, bgMul=0.55, painterly=(9, 5, 2.6)),
    'child':   dict(face='s6', H=1331, seed=41, faceW=0.62, faceY=0.12, coat=(70, 84, 104), collar=0.2, oval=(18, 14, 12), shoulderW=0.46),
    'widow':   dict(face='v3_7', H=1314, seed=53, faceW=0.58, faceY=0.1, coat=(14, 13, 15), sheen=0.5, brooch=True, collar=0.14, shoulderW=0.5),
    'belle':   dict(face='m4', H=1314, seed=71, faceW=0.58, faceY=0.1, coat=(28, 58, 44), sheen=0.6, skin=(220, 190, 170), lace=True, oval=(20, 16, 12), shoulderW=0.5, cropFade=0.94),
    'poet':    dict(face='s3', H=1306, seed=83, faceW=0.6, faceY=0.09, coat=(58, 40, 26), sheen=0.3, collar=0.16, collarCol=(36, 26, 18), shoulderW=0.54),
    'doctor':  dict(face='v1_2', H=1306, seed=97, faceW=0.6, faceY=0.08, coat=(18, 18, 22), sheen=0.4, collar=0.15, collarCol=(26, 24, 22), buttons=3, shoulderW=0.56, shoulder=0.95),
    'toymaker': dict(face='s8', W=2048, H=2048, seed=67, faceW=0.74, faceY=0.06, coat=(40, 31, 27), sheen=0.5, shoulderW=0.6, shoulder=0.95, extra=toymaker_extra, bgMul=0.9, maskInset=(0.04, 0.0), maskBlur=0.09, cropFade=0.8, painterly=(16, 8, 4.2, 2.4)),
}


def ghost_card():
    """grey lady: painted face + veil + long nightgown as an RGBA card (white-ish, alpha = density).
    No streaks: the gown is a handful of broad soft folds; the hem dissolves into ragged mist."""
    W, H = 512, 1536
    face = Image.open(os.path.join(HERE, 'src_faces', 'm2.png')).convert('RGB')
    fs = 250
    fu = np.asarray(face.resize((fs, fs), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.1)), np.float32) / 255
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = xx / W; v = yy / H
    cx = W / 2
    # ---- gown silhouette: sloping shoulders, slight waist, skirt flaring and trailing
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    top = 285
    def half(t):
        y = top + t * (H - top - 20)
        w = 30 + 112 * smoothstep(-0.02, 0.16, t) ** 0.8 - 14 * smoothstep(0.12, 0.3, t) * (1 - smoothstep(0.3, 0.5, t)) + 70 * max(0.0, t - 0.3) ** 1.4
        return y, w
    pts = [(cx - half(t)[1], half(t)[0]) for t in np.linspace(0, 1, 80)] + [(cx + half(t)[1], half(t)[0]) for t in np.linspace(1, 0, 80)]
    d.polygon(pts, fill=255)
    gm = np.asarray(m.filter(ImageFilter.GaussianBlur(10)), np.float32) / 255
    # broad folds: few, soft, slightly wavering; deeper toward the hem
    warp = (noise(H, W, 260, 5, 2) - 0.5) * 40
    fx = (xx - cx + warp) / W
    folds = 0.5 + 0.5 * np.sin(fx * 2 * math.pi * 4.2 + v * 3.0) * (0.35 + 0.65 * smoothstep(0.25, 0.8, v))
    folds = np.asarray(to_img(np.stack([folds] * 3, -1)).filter(ImageFilter.GaussianBlur(6)).convert('L'), np.float32) / 255
    # arms folded at the waist: a soft lighter band with a darker underside
    arms = 0.45 * np.exp(-(((xx - cx) / 80) ** 2 + ((yy - 590) / 40) ** 2)) - 0.25 * np.exp(-(((xx - cx) / 80) ** 2 + ((yy - 640) / 30) ** 2))
    mist = noise(H, W, 90, 9, 4)
    glum = (0.62 + 0.3 * folds + 0.25 * arms) * (1 - 0.25 * v)
    hem = smoothstep(0.45, 0.92, v + 0.18 * (mist - 0.5))                  # ragged dissolve
    galpha = gm * (0.5 + 0.25 * folds + 0.15 * arms) * (1 - hem) * (0.8 + 0.35 * mist)
    # ---- veil: hood falling from the crown to the shoulders
    vm = Image.new('L', (W, H), 0); vd = ImageDraw.Draw(vm)
    vd.ellipse([cx - 120, 20, cx + 120, 330], fill=255)
    vd.polygon([(cx - 120, 180), (cx + 120, 180), (cx + 150, 420), (cx - 150, 420)], fill=255)
    vmask = np.asarray(vm.filter(ImageFilter.GaussianBlur(22)), np.float32) / 255
    lum = np.maximum(glum * gm, 0.55 * vmask)
    alpha = np.maximum(galpha, vmask * 0.32 * (0.8 + 0.4 * mist))
    # ---- face
    fx0, fy0 = int(cx - fs // 2), 60
    fm = Image.new('L', (fs, fs), 0); fd = ImageDraw.Draw(fm)
    fd.ellipse([fs * 0.2, fs * 0.08, fs * 0.8, fs * 0.94], fill=255)
    fmask = np.asarray(fm.filter(ImageFilter.GaussianBlur(20)), np.float32) / 255
    flum = fu @ np.array([0.3, 0.59, 0.11], np.float32)
    flum = np.clip(0.25 + (flum - 0.2) * 0.95, 0, 1)
    sl = (slice(fy0, fy0 + fs), slice(fx0, fx0 + fs))
    lum[sl] = lum[sl] * (1 - fmask) + flum * fmask
    alpha[sl] = np.maximum(alpha[sl], fmask * (0.3 + 0.55 * flum))
    alpha = np.asarray(Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(2.5)), np.float32) / 255
    rgb = np.stack([lum * 0.86, lum * 0.92, lum * 1.0], -1)
    out = np.concatenate([np.clip(rgb, 0, 1), np.clip(alpha, 0, 1)[..., None]], -1)
    Image.fromarray((out * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, '..', 'ghost.png'), optimize=True)


def landscape(idx, W=768, H=590):
    """small dark oil landscapes for the salon hang: dusk/moonlit skies, hills, a tree mass, still water."""
    seed = 300 + idx * 17
    r = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = xx / W; v = yy / H
    pal = [
        dict(sky0=(40, 52, 70), sky1=(150, 130, 96), land=(26, 24, 18), glow=(0.62, 0.3), water=True),     # dusk lake
        dict(sky0=(22, 30, 46), sky1=(88, 98, 112), land=(18, 20, 18), glow=(0.3, 0.25), water=False),     # moonlit moor
        dict(sky0=(60, 58, 50), sky1=(170, 140, 90), land=(34, 30, 20), glow=(0.5, 0.42), water=True),     # stormy evening
        dict(sky0=(30, 34, 40), sky1=(120, 112, 92), land=(24, 22, 16), glow=(0.75, 0.3), water=False),
    ][idx % 4]
    hz = 0.58 + 0.06 * r.random()
    sky = srgb(pal['sky0'])[None, None, :] * (1 - smoothstep(0.0, hz, v))[..., None] + srgb(pal['sky1'])[None, None, :] * smoothstep(0.0, hz, v)[..., None]
    gx, gy = pal['glow']
    sky = sky + np.exp(-(((u - gx) / 0.2) ** 2 + ((v - gy) / 0.14) ** 2))[..., None] * np.array([0.25, 0.2, 0.12])
    cl = noise(H, W, 90, seed + 1) * 0.7 + noise(H, W, 30, seed + 2) * 0.3
    sky = sky * (0.75 + 0.5 * cl[..., None])
    img = sky
    # far hills, near hills, tree mass
    def ridge(base, amp, cell, sd):
        n = noise(1, W, cell, sd, 3)[0]
        return (base - amp * n)[None, :] * H
    for k, (base, amp, cell, tone) in enumerate([(hz + 0.02, 0.1, 160, 0.75), (hz + 0.08, 0.14, 90, 0.5), (hz + 0.14, 0.3, 40, 0.28)]):
        rr = ridge(base, amp, cell, seed + 10 + k)
        m = smoothstep(-2, 2, yy - rr)[..., None]
        col = srgb(pal['land']) * (0.6 + tone * 1.6) + np.array([0.02, 0.025, 0.035]) * (2 - k)
        img = img * (1 - m) + (col[None, None, :] * (0.8 + 0.4 * noise(H, W, 20, seed + 20 + k)[..., None])) * m
    if pal['water']:
        wy = hz + 0.2
        wm = smoothstep(wy * H - 2, wy * H + 2, yy)[..., None]
        refl = np.flipud(img)[np.clip((2 * wy * H - yy).astype(int), 0, H - 1), xx.astype(int)]
        img = img * (1 - wm) + (refl * 0.55 + 0.02) * wm
    img = np.clip(img, 0, 1)
    img, sh = painterly(img, seed, (10, 5, 2.5), np.zeros((H, W), np.float32))
    img, bump = age_canvas(img, W, H, seed, sh)
    to_img(img).save(os.path.join(OUT, f'land{idx}.jpg'), quality=86, optimize=True)


if __name__ == '__main__':
    if sys_argv_land := [a for a in __import__('sys').argv[1:] if a == 'land']:
        for i in range(4): landscape(i)
        raise SystemExit
    import sys
    only = sys.argv[1:]
    jp = os.path.join(ROOT, 'src/rooms/gallery/portraitData.json')
    data = json.load(open(jp)) if only and os.path.exists(jp) else {}
    for name, spec in SPECS.items():
        if only and name not in only: continue
        img, bump, eyes = paint_portrait(spec)
        to_img(img).save(os.path.join(OUT, f'{name}.jpg'), quality=88, optimize=True)
        Image.fromarray((bump * 255).astype(np.uint8), 'L').resize((bump.shape[1] // 2, bump.shape[0] // 2), Image.BILINEAR).save(os.path.join(OUT, f'{name}_bump.png'), optimize=True)
        data[name] = eyes
        print(name, eyes)
    if not only or 'ghost' in only: ghost_card()
    with open(os.path.join(ROOT, 'src/rooms/gallery/portraitData.json'), 'w') as f:
        json.dump(data, f, indent=1)
