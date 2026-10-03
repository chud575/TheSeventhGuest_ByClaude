#!/usr/bin/env python3
"""
Offline oil-painting generator for the dining room.

  python3 src/rooms/dining/tools/paintings.py [lady|gent|youth|storm|vale]

Faces (tools/src_faces/*.png, 256 px) are synthetic painted faces sampled from a
StyleGAN2 model trained on MetFaces (they depict nobody real and are no one's
artwork; the same pool the gallery documents, using faces the gallery does not).
Everything else -- grounds, costume, lace, jewellery, the storm landscape -- is
painted procedurally here, then the canvas is aged: brush-stroke smear along the
form, canvas weave, impasto, craquelure, yellowed varnish and grime.

Outputs in public/assets/dining/:  <name>.jpg (albedo, sRGB) + <name>_bump.png (height)
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
OUT = os.path.join(ROOT, 'public/assets/dining')
os.makedirs(OUT, exist_ok=True)


# ----------------------------------------------------------------------------- helpers
def noise(h, w, cell, seed, octaves=4, gain=0.5):
    r = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32); amp = 1.0; tot = 0.0
    for o in range(octaves):
        c = max(2, cell / (2 ** o))
        gh, gw = int(h / c) + 4, int(w / c) + 4
        g = r.random((gh, gw)).astype(np.float32)
        a = cv2.resize(g, (int(gw * c), int(gh * c)), interpolation=cv2.INTER_CUBIC)[:h, :w]
        acc += a * amp; tot += amp; amp *= gain
    return np.clip(acc / tot, 0, 1)


def snoise(h, w, cx, cy, seed, angle=0.0):
    """anisotropic noise: cells cx wide, cy tall, rotated by angle (deg)."""
    r = np.random.default_rng(seed)
    big = int(math.hypot(h, w)) + 8
    g = r.random((big // cy + 4, big // cx + 4)).astype(np.float32)
    a = cv2.resize(g, ((big // cx + 4) * cx, (big // cy + 4) * cy), interpolation=cv2.INTER_CUBIC)[:big, :big]
    M = cv2.getRotationMatrix2D((big / 2, big / 2), angle, 1.0)
    a = cv2.warpAffine(a, M, (big, big), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    y0, x0 = (big - h) // 2, (big - w) // 2
    return a[y0:y0 + h, x0:x0 + w]


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def blur(a, s):
    return cv2.GaussianBlur(a, (0, 0), s) if s > 0 else a


def col(*c):
    return np.array(c, np.float32) / 255.0


def lerp(a, b, t):
    if np.ndim(t) == 2 and np.ndim(a) == 3 or (np.ndim(t) == 2 and np.ndim(b) == 3):
        t = t[..., None]
    return a + (b - a) * t


def kuwahara(img, r):
    lum = img @ np.array([0.3, 0.59, 0.11], np.float32)
    k = (2 * r + 1, 2 * r + 1)
    m = cv2.blur(img, k); ml = cv2.blur(lum, k); var = cv2.blur(lum * lum, k) - ml * ml
    best = None; bestv = None
    for dy in (-r, r):
        for dx in (-r, r):
            Mx = np.float32([[1, 0, -dx], [0, 1, -dy]])
            v = cv2.warpAffine(var, Mx, var.shape[::-1], borderMode=cv2.BORDER_REFLECT)
            c = cv2.warpAffine(m, Mx, var.shape[::-1], borderMode=cv2.BORDER_REFLECT)
            if best is None: best, bestv = c, v
            else:
                sel = v < bestv
                best = np.where(sel[..., None], c, best); bestv = np.minimum(v, bestv)
    return best


def flow_smear(img, strength=6.0, steps=6, sigma=3.0, seed=0, jitter=0.35):
    """Line-integral smear along the local stroke direction (perpendicular to the luminance
    gradient) -- turns smooth gradients into directional brush strokes."""
    H, W = img.shape[:2]
    lum = blur(img @ np.array([0.3, 0.59, 0.11], np.float32), sigma)
    gx = cv2.Sobel(lum, cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(lum, cv2.CV_32F, 0, 1, ksize=3)
    # structure tensor
    Jxx = blur(gx * gx, sigma * 2); Jyy = blur(gy * gy, sigma * 2); Jxy = blur(gx * gy, sigma * 2)
    ang = 0.5 * np.arctan2(2 * Jxy, Jxx - Jyy) + np.pi / 2
    ang += (noise(H, W, 60, seed, 3) - 0.5) * jitter * 2
    dx = np.cos(ang).astype(np.float32); dy = np.sin(ang).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    acc = img.copy(); wsum = 1.0
    for sgn in (-1, 1):
        px, py = xx.copy(), yy.copy()
        for i in range(steps):
            vx = cv2.remap(dx, px, py, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            vy = cv2.remap(dy, px, py, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            px = px + sgn * vx * strength / steps; py = py + sgn * vy * strength / steps
            w = 1.0 - (i + 1) / (steps + 1)
            acc += cv2.remap(img, px, py, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT) * w
            wsum += w
    return acc / wsum


def cracks(h, w, seed, cell=70, width=0.9):
    """craquelure: voronoi cell borders, jittered, with a finer secondary network."""
    r = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    for k, (c, wd, amt) in enumerate([(cell, width, 1.0), (cell * 0.45, width * 0.7, 0.55)]):
        n = int(h * w / (c * c)) + 8
        pts = np.stack([r.random(n) * w, r.random(n) * h], -1).astype(np.float32)
        # distance to nearest and second nearest via cv2 subdiv is heavy; use a grid of small tiles
        warp = (noise(h, w, c * 0.6, seed + 10 + k, 3) - 0.5) * c * 0.5
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        X = xx + warp; Y = yy + warp[::-1, ::-1]
        gs = c
        gx = (pts[:, 0] // gs).astype(int); gy = (pts[:, 1] // gs).astype(int)
        cells = {}
        for i, (a, b) in enumerate(zip(gx, gy)): cells.setdefault((a, b), []).append(i)
        d1 = np.full((h, w), 1e9, np.float32); d2 = np.full((h, w), 1e9, np.float32)
        for i in range(n):
            px, py = pts[i]
            x0, x1 = int(max(0, px - gs * 1.6)), int(min(w, px + gs * 1.6))
            y0, y1 = int(max(0, py - gs * 1.6)), int(min(h, py + gs * 1.6))
            if x1 <= x0 or y1 <= y0: continue
            d = np.hypot(X[y0:y1, x0:x1] - px, Y[y0:y1, x0:x1] - py)
            a1 = d1[y0:y1, x0:x1]; a2 = d2[y0:y1, x0:x1]
            nd2 = np.where(d < a1, a1, np.minimum(a2, d))
            nd1 = np.minimum(a1, d)
            d1[y0:y1, x0:x1] = nd1; d2[y0:y1, x0:x1] = nd2
        edge = 1.0 - ss(0, wd, d2 - d1)
        out = np.maximum(out, edge * amt * (0.4 + 0.6 * ss(0.35, 0.6, noise(h, w, c * 2, seed + 20 + k, 2))))
    return out


def canvas_weave(h, w, pitch=3.2):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    a = np.sin(xx * 2 * np.pi / pitch) * np.sin(yy * 2 * np.pi / (pitch * 2)) * 0.5
    b = np.sin(yy * 2 * np.pi / pitch) * np.sin(xx * 2 * np.pi / (pitch * 2) + 1.5) * 0.5
    return (a + b) * 0.5


def age_canvas(img, seed, crack_cell=70, varnish=1.0, grime=1.0, weave=1.0, smear=7.0, kuw=2):
    H, W = img.shape[:2]
    # painterly passes
    if kuw: img = 0.55 * img + 0.45 * kuwahara(img, kuw)
    if smear: img = flow_smear(img, strength=smear, seed=seed)
    # bristle streaks inside strokes
    br = snoise(H, W, 2, 22, seed + 3, angle=20) - 0.5
    img = img * (1 + 0.06 * br[..., None])
    # varnish: yellow-brown, stronger in the darks' mid-tones, slightly uneven
    vn = noise(H, W, 300, seed + 4, 3)
    vcol = np.array([1.0, 0.86, 0.6], np.float32)
    k = (0.75 + 0.5 * vn) * varnish
    img = img * lerp(np.ones(3, np.float32), vcol, np.clip(k * 0.55, 0, 1)[..., None]) + np.array([0.025, 0.017, 0.006], np.float32) * k[..., None]
    # grime toward the edges + cloudy patches
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    ex = np.minimum(xx, W - 1 - xx) / W; ey = np.minimum(yy, H - 1 - yy) / H
    edge = 1 - ss(0.0, 0.14, np.minimum(ex, ey * H / W))
    gr = noise(H, W, 120, seed + 5, 4)
    img = img * (1 - grime * (0.35 * edge + 0.12 * ss(0.5, 0.85, gr)))[..., None]
    # canvas weave + cracks
    cw = canvas_weave(H, W) * weave
    cr = cracks(H, W, seed + 6, cell=crack_cell)
    img = img * (1 + 0.05 * cw)[..., None]
    img = img * (1 - 0.22 * cr)[..., None]
    # tiny lighter lips along crack edges (varnish catching light)
    lip = np.clip(blur(cr, 1.2) - cr, 0, 1)
    img = img + lip[..., None] * 0.03
    lum = img @ np.array([0.3, 0.59, 0.11], np.float32)
    bump = 0.5 + 0.18 * cw + 0.25 * (blur(lum, 2) - blur(lum, 9)) + 0.1 * br - 0.35 * cr
    return np.clip(img, 0, 1), np.clip(bump, 0, 1)


def save(name, img, bump):
    Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, f'{name}.jpg'), quality=90)
    Image.fromarray((np.clip(bump, 0, 1) * 255 + 0.5).astype(np.uint8)).resize((img.shape[1] // 2, img.shape[0] // 2), Image.LANCZOS).save(os.path.join(OUT, f'{name}_bump.png'))
    print('wrote', name, img.shape)


# ----------------------------------------------------------------------------- portraits
def place_face(canvas, face_path, x, y, size, keep_ellipse, dark_thr=0.33, feather=10, gamma=1.0, tone=None):
    """Composite a source face into canvas. keep_ellipse = (cx, cy, rx, ry) in source px (256 space).
    Returns (canvas, alpha) with the face's original background keyed out."""
    H, W = canvas.shape[:2]
    f = np.asarray(Image.open(face_path).convert('RGB'), np.float32) / 255
    s = size / f.shape[1]
    fu = cv2.resize(f, (size, size), interpolation=cv2.INTER_LANCZOS4)
    fu = np.clip(fu, 0, 1)
    # light paint pass + unsharp so the upscale reads as brushwork, not blur
    fu = 0.7 * fu + 0.3 * kuwahara(fu, 2)
    fu = np.clip(fu + 0.55 * (fu - blur(fu, 2.0)), 0, 1)
    if tone is not None: fu = tone(fu)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / s
    cx, cy, rx, ry = keep_ellipse
    ell = 1 - ss(0.82, 1.0, np.hypot((xx - cx) / rx, (yy - cy) / ry))
    lum = blur(fu @ np.array([0.3, 0.59, 0.11], np.float32), 1.5)
    hair = 1 - ss(dark_thr - 0.08, dark_thr + 0.08, lum)
    a = np.maximum(ell, hair * (1 - ss(0.9, 1.0, np.hypot((xx - cx) / (rx * 1.6), (yy - cy) / (ry * 1.25)))))
    # always fade at the source's border
    bx = np.minimum(xx, 256 - xx); by = np.minimum(yy, 256 - yy)
    a *= ss(0, 14, np.minimum(bx, by) * 1.0)
    a = blur(a.astype(np.float32), feather)
    x0, y0 = int(x - size / 2), int(y)
    sx0, sy0 = max(0, -x0), max(0, -y0)
    x1, y1 = min(W, x0 + size), min(H, y0 + size)
    reg = canvas[y0 + sy0:y1, x0 + sx0:x1]
    ar = a[sy0:sy0 + reg.shape[0], sx0:sx0 + reg.shape[1]][..., None]
    fr = fu[sy0:sy0 + reg.shape[0], sx0:sx0 + reg.shape[1]]
    canvas[y0 + sy0:y1, x0 + sx0:x1] = reg * (1 - ar) + fr * ar
    full = np.zeros((H, W), np.float32); full[y0 + sy0:y1, x0 + sx0:x1] = ar[..., 0]
    return canvas, full


def ground(H, W, seed, base, glow_at=(0.38, 0.3), glow=(0.45, 0.4), glow_amt=0.9, dark_bottom=0.6):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = xx / W; v = yy / H
    halo = np.exp(-(((u - glow_at[0]) / glow[0]) ** 2 + ((v - glow_at[1]) / glow[1]) ** 2))
    n1 = noise(H, W, 220, seed, 4); n2 = noise(H, W, 50, seed + 1, 3)
    g = base[None, None, :] * (0.3 + glow_amt * halo[..., None]) * (0.8 + 0.4 * n1[..., None]) * (0.93 + 0.14 * n2[..., None])
    g *= (1 - dark_bottom * ss(0.3, 1.0, v))[..., None]
    st = blur(snoise(H, W, 14, 90, seed + 2, angle=32), 2)
    st2 = noise(H, W, 18, seed + 3, 3)
    g *= (0.95 + 0.07 * st + 0.08 * st2)[..., None]
    return g


def costume_mask(W, H, cx, neckY, neckW, shW, drop, seed, ctrl=None):
    """bust silhouette: sloping trapezius from the neck into rounded shoulders, arms falling away."""
    from scipy.interpolate import PchipInterpolator
    k = ctrl or [(0.0, 0.0), (0.18, 0.1), (0.45, 0.38), (0.72, 0.68), (0.9, 0.9), (0.98, 1.15), (1.02, 1.6), (1.05, 3.0)]
    xs = np.array([neckW + (shW - neckW) * a for a, b in k]); ys = np.array([neckY + drop * b for a, b in k])
    t = np.linspace(0, 1, len(k)); tt = np.linspace(0, 1, 200)
    px = PchipInterpolator(t, xs)(tt); py = PchipInterpolator(t, ys)(tt)
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    pts = [(cx - x, y) for x, y in zip(px, py)] + [(cx - px[-1], H + 40), (cx + px[-1], H + 40)] + [(cx + x, y) for x, y in zip(px[::-1], py[::-1])]
    d.polygon(pts, fill=255)
    return blur(np.asarray(m, np.float32) / 255, 2.5)


def silk(H, W, mask, cx, top, seed, base, light_dir=-1, sheen=0.55):
    """black silk bodice: cylinder shading lit from upper-left, folds and sharp satin highlights."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    rel = (xx - cx) / (W * 0.42)
    cyl = np.clip(np.cos(np.clip(rel + 0.3 * light_dir * -1, -1.57, 1.57)), 0, 1)
    vert = np.exp(-((yy - top) / (H * 0.22)) ** 2)
    f1 = snoise(H, W, 70, 420, seed, angle=-6 * light_dir)
    f2 = snoise(H, W, 26, 160, seed + 1, angle=10)
    folds = blur(0.65 * f1 + 0.35 * f2, 4)
    hl = blur(ss(0.62, 0.92, folds), 6)
    shade = (0.25 + 0.75 * cyl * (0.35 + 0.65 * vert)) * (0.7 + 0.5 * folds)
    c = base[None, None, :] * shade[..., None] + (hl * cyl * vert * sheen)[..., None] * np.array([0.32, 0.31, 0.33], np.float32)
    c *= (1 - 0.8 * ss(top - H * 0.05, H * 0.95, yy))[..., None]
    # light falls off away from the lit (left) shoulder
    c *= np.clip(1.15 - (xx - (cx - W * 0.3)) / (W * 0.9), 0.35, 1.1)[..., None]
    return c


def lace(img, cx, y0, y1, w0, w1, seed, lit=1.0, scallop=18):
    """high lace collar: a band of cream lace with an open pattern and scalloped lower edge."""
    H, W = img.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    t = np.clip((yy - y0) / (y1 - y0), 0, 1)
    hw = w0 + (w1 - w0) * t
    inside = (np.abs(xx - cx) < hw) & (yy >= y0) & (yy <= y1 + 14)
    ang = (xx - cx) / np.maximum(hw, 1)
    sc = y1 + 9 * np.abs(np.sin((xx - cx) / (w1 * 2) * scallop * np.pi / 2))
    m = inside & (yy < sc)
    m = blur(m.astype(np.float32), 1.0)
    # open-work: rows of little rings
    u = (xx - cx) / 7.5; v = (yy - y0) / 7.5
    ring = np.abs(np.hypot((u % 1) - 0.5, (v % 1) - 0.5) - 0.3)
    holes = ss(0.06, 0.12, ring)
    pat = 0.55 + 0.45 * holes
    # cylinder shading of the neck band: lit on the left
    shade = np.clip(0.35 + 0.75 * np.cos(np.clip(ang + 0.35, -1.5, 1.5)), 0.12, 1.0) * lit
    shade *= 1 - 0.35 * t
    lc = np.array([0.86, 0.82, 0.72], np.float32)[None, None, :] * (shade * pat)[..., None]
    img = lerp(img, lc, m * (0.6 + 0.4 * holes))
    return img


def cameo(img, cx, cy, rx, ry, lit=1.0):
    H, W = img.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.hypot((xx - cx) / rx, (yy - cy) / ry)
    frame = ss(1.12, 1.0, d) * (1 - ss(0.86, 0.8, d))
    shell = ss(0.82, 0.78, d)
    gold = np.array([0.72, 0.52, 0.22], np.float32) * (0.5 + 0.7 * np.clip(-(xx - cx) / rx * 0.5 - (yy - cy) / ry * 0.5 + 0.5, 0, 1))[..., None]
    pink = np.array([0.55, 0.32, 0.26], np.float32)[None, None, :] * np.ones((H, W, 1), np.float32)
    # profile silhouette in ivory
    px = (xx - cx) / rx; py = (yy - cy) / ry
    head = np.hypot((px + 0.05) / 0.38, (py + 0.12) / 0.45) < 1
    neck = (np.abs(px - 0.0) < 0.18) & (py > 0.15) & (py < 0.6)
    bust = np.hypot(px / 0.6, (py - 0.75) / 0.3) < 1
    nose = (px < -0.33) & (px > -0.45) & (py > -0.2) & (py < 0.05)
    prof = blur((head | neck | bust | nose).astype(np.float32), 0.8) * shell
    ivory = np.array([0.88, 0.82, 0.72], np.float32)
    img = lerp(img, gold * lit, frame)
    img = lerp(img, pink * lit, shell)
    img = lerp(img, ivory[None, None, :] * lit * np.ones((H, W, 1), np.float32), prof * 0.9)
    # spec glint
    g = np.exp(-(((xx - (cx - rx * 0.55)) / 3.0) ** 2 + ((yy - (cy - ry * 0.7)) / 3.0) ** 2))
    return img + g[..., None] * 0.6


def pearls(img, cx, cy, rx, ry, n, r, a0=0.2, a1=np.pi - 0.2, lit=1.0):
    H, W = img.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    for i in range(n):
        a = a0 + (a1 - a0) * i / (n - 1)
        px, py = cx + np.cos(a) * rx, cy + np.sin(a) * ry
        x0, x1, y0, y1 = int(px - r - 2), int(px + r + 3), int(py - r - 2), int(py + r + 3)
        sub_x = xx[y0:y1, x0:x1]; sub_y = yy[y0:y1, x0:x1]
        d = np.hypot(sub_x - px, sub_y - py) / r
        m = ss(1.0, 0.85, d)
        nz = np.sqrt(np.clip(1 - d * d, 0, 1))
        lam = np.clip(-(sub_x - px) / r * 0.5 - (sub_y - py) / r * 0.55 + nz * 0.6, 0, 1)
        side = np.clip(1 - (px - (cx - rx)) / (2 * rx) * 0.6, 0.3, 1) * lit
        c = np.array([0.82, 0.78, 0.7], np.float32) * (0.25 + 0.8 * lam[..., None]) * side
        spec = np.exp(-(((sub_x - (px - r * 0.35)) / (r * 0.22)) ** 2 + ((sub_y - (py - r * 0.4)) / (r * 0.22)) ** 2))
        c = c + spec[..., None] * 0.7 * side
        img[y0:y1, x0:x1] = lerp(img[y0:y1, x0:x1], c, m)
    return img


def lady():
    W, H = 1024, 1456
    seed = 101
    img = ground(H, W, seed, col(74, 52, 36), glow_at=(0.36, 0.28), glow=(0.42, 0.34), glow_amt=0.85, dark_bottom=0.75)
    # black hair mass extends above the source crop (lost edges into the ground)
    fx, fy, fsz = 520, 230, 470
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    hair_ext = np.exp(-(((xx - fx) / 230) ** 2 + ((yy - (fy + 120)) / 190) ** 2) ** 1.5)
    hn = snoise(H, W, 3, 40, seed + 9, angle=70) * 0.5 + noise(H, W, 30, seed + 10) * 0.5
    hair_col = col(20, 15, 12) * (0.7 + 0.6 * hn)[..., None]
    img = lerp(img, hair_col, hair_ext * 0.95)
    # costume
    cx = fx - 6; neckY = fy + fsz * 0.86
    cm = costume_mask(W, H, cx, neckY, 88, 430, 230, seed)
    dress = silk(H, W, cm, cx - 40, neckY + 150, seed + 20, col(30, 28, 34), sheen=0.6)
    img = lerp(img, dress, cm)
    # face
    img, fa = place_face(img, os.path.join(HERE, 'src_faces/m4.png'), fx, fy, fsz, (124, 132, 74, 100), dark_thr=0.3, feather=7,
                         tone=lambda f: np.clip((f - 0.02) * np.array([1.0, 0.97, 0.95], np.float32), 0, 1) ** 1.08)
    # pale neck column bridging chin and collar
    neck = np.exp(-(((xx - (fx - 4)) / 52) ** 4 + ((yy - (fy + fsz * 0.93)) / 46) ** 4))
    neck_col = col(196, 168, 150) * (0.55 + 0.45 * np.clip(1 - (xx - fx + 40) / 110, 0, 1))[..., None]
    img = lerp(img, neck_col, neck * (1 - fa) * 0.95)
    # high lace collar, cameo, pearls
    img = lace(img, fx - 4, neckY + 22, neckY + 72, 58, 74, seed)
    img = pearls(img, fx - 4, neckY + 92, 120, 80, 21, 7.5, a0=0.25, a1=np.pi - 0.25)
    img = cameo(img, fx - 4, neckY + 58, 20, 25)
    # mourning ribbon at the throat shadow
    # warm final glaze: deepen the darks toward umber, lift the face light a touch
    lum = img @ np.array([0.3, 0.59, 0.11], np.float32)
    img = img * (0.92 + 0.12 * ss(0.15, 0.6, lum))[..., None]
    img, bump = age_canvas(img, seed, crack_cell=64, varnish=1.0, grime=1.0, smear=6.5)
    save('lady', img, bump)


def gent(name='gent', face='v1_2.png', W=768, H=988, seed=211, fsz=440, fx=None, fy=150, keep=(118, 120, 92, 112), coat=(26, 24, 26), shirt=True):
    fx = fx or W // 2 + 8
    img = ground(H, W, seed, col(84, 64, 44), glow_at=(0.34, 0.26), glow=(0.48, 0.38), glow_amt=0.8, dark_bottom=0.7)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx = fx; neckY = fy + fsz * 0.86
    cm = costume_mask(W, H, cx, neckY, 70, 330, 160, seed)
    dress = silk(H, W, cm, cx - 30, neckY + 120, seed + 20, col(32, 30, 30), sheen=0.25)
    img = lerp(img, dress, cm)
    if shirt:
        # white collar points + dark cravat
        sh = Image.new('L', (W, H), 0); d = ImageDraw.Draw(sh)
        d.polygon([(cx - 70, neckY - 10), (cx + 70, neckY - 10), (cx + 30, neckY + 140), (cx - 30, neckY + 140)], fill=255)
        sm = blur(np.asarray(sh, np.float32) / 255, 4)
        shade = np.clip(1.1 - (xx - cx + 60) / 160, 0.35, 1)[..., None] * (1 - 0.5 * ss(neckY, neckY + 150, yy))[..., None]
        img = lerp(img, col(200, 192, 176) * shade, sm * 0.9)
        cr = Image.new('L', (W, H), 0); d = ImageDraw.Draw(cr)
        d.polygon([(cx - 34, neckY + 10), (cx + 34, neckY + 10), (cx + 12, neckY + 120), (cx - 12, neckY + 120)], fill=255)
        crm = blur(np.asarray(cr, np.float32) / 255, 3)
        img = lerp(img, col(20, 16, 16) * (0.7 + 0.5 * snoise(H, W, 6, 30, seed + 4))[..., None], crm)
    img, fa = place_face(img, os.path.join(HERE, 'src_faces', face), fx, fy, fsz, keep, dark_thr=0.28, feather=7)
    img, bump = age_canvas(img, seed, crack_cell=56, varnish=1.1, grime=1.1, smear=5.5)
    save(name, img, bump)


# ----------------------------------------------------------------------------- landscape
def ridge_line(W, base, amp, cell, seed, sharp=1.0):
    xs = np.arange(W, dtype=np.float32)
    n = noise(1, W, cell, seed, 6, 0.55)[0]
    r = 1 - np.abs(n * 2 - 1)
    return base - amp * (r ** sharp)


def storm(W=2048, H=1280, seed=303, name='storm'):
    """A Romantic mountain storm: torn sky with a moon breaking through, a waterfall
    between crags, a ruined castle on a spur, dark pines and a cold lake."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = xx / W; v = yy / H
    # sky
    moon = (0.68, 0.2)
    md = np.hypot((u - moon[0]) * W / H, v - moon[1])
    sky = lerp(col(56, 62, 66), col(14, 16, 20), ss(0.0, 0.7, v * 0.6 + md * 0.8))
    c1 = noise(H, W, 380, seed, 6, 0.55); c2 = snoise(H, W, 140, 40, seed + 1, angle=-8)
    clouds = ss(0.42, 0.75, c1 * 0.75 + c2 * 0.35)
    lit_edge = ss(0.0, 0.25, np.clip(c1 - 0.47, 0, 1)) * np.exp(-md * 3.2)
    sky = lerp(sky, col(22, 22, 24) * (0.7 + 0.6 * c2)[..., None], clouds * 0.9)
    sky += (np.exp(-md * 5.5) * 0.55)[..., None] * col(220, 214, 188) * (1 - clouds * 0.7)[..., None]
    sky += lit_edge[..., None] * col(210, 200, 170) * 0.5
    sky = lerp(sky, col(240, 236, 214) * 1.1, ss(0.034, 0.028, md))
    img = sky
    haze = col(70, 76, 78)
    # mountain ranges back to front with aerial perspective
    ranges = [(0.5, 0.26, 700, 0.75, 0.62), (0.58, 0.3, 420, 0.55, 0.42), (0.66, 0.24, 260, 0.35, 0.25)]
    for i, (base, amp, cell, fog, lightness) in enumerate(ranges):
        line = ridge_line(W, base, amp, cell, seed + 10 + i, sharp=1.6) * H
        mask = ss(-1.5, 1.5, yy - line[None, :])
        rock = noise(H, W, 60 / (i + 1), seed + 20 + i, 5)
        strata = snoise(H, W, 30, 6, seed + 30 + i, angle=-20 + 10 * i)
        # light from the moon side: slopes facing right lit
        dline = np.gradient(line)[None, :]
        facing = np.clip(0.5 - dline * 0.08, 0, 1)
        snow = ss(0.55, 0.7, rock * 0.6 + facing * 0.4 + (1 - (yy - line[None, :]) / (H * 0.15)) * 0.3) * ss(H * 0.25, -H * 0.02, yy - line[None, :] - H * 0.06)
        rc = col(40, 42, 44) * (0.5 + 0.8 * rock * facing + 0.2 * strata)[..., None]
        rc = lerp(rc, col(150, 156, 160) * (0.6 + 0.6 * facing)[..., None], snow * 0.8)
        # fog in valleys below each ridge
        vf = ss(0, H * 0.18, yy - line[None, :]) * fog
        rc = lerp(rc, haze * (0.8 + 0.4 * noise(H, W, 200, seed + 40 + i)[..., None]), np.clip(vf + fog * 0.35, 0, 1))
        img = lerp(img, rc * lightness / 0.5, mask)
    # waterfall in the cleft (left-centre) with mist
    wf_x = 0.36
    wf = np.exp(-((u - wf_x - 0.01 * np.sin(v * 30)) / 0.008) ** 2) * ss(0.42, 0.48, v) * ss(0.8, 0.74, v)
    streak = snoise(H, W, 3, 60, seed + 50)
    img = lerp(img, col(200, 205, 208) * (0.6 + 0.6 * streak)[..., None], wf * 0.8)
    mist = np.exp(-(((u - wf_x) / 0.08) ** 2 + ((v - 0.77) / 0.05) ** 2)) * noise(H, W, 80, seed + 51)
    img = lerp(img, col(150, 156, 158), np.clip(mist * 1.2, 0, 0.8))
    # castle on a spur (right)
    cs = Image.new('L', (W, H), 0); d = ImageDraw.Draw(cs)
    bx, by = int(W * 0.79), int(H * 0.56)
    d.polygon([(bx - 260, H), (bx - 120, by + 40), (bx - 40, by + 10), (bx + 60, by + 30), (bx + 200, by + 120), (bx + 330, H)], fill=255)
    for (x0, w, h) in [(-50, 34, 150), (-8, 70, 90), (60, 30, 120), (95, 46, 70), (-90, 26, 60)]:
        d.rectangle([bx + x0, by + 30 - h, bx + x0 + w, by + 40], fill=255)
        for k in range(0, w, 10): d.rectangle([bx + x0 + k, by + 30 - h - 8, bx + x0 + k + 5, by + 30 - h], fill=255)
    d.polygon([(bx - 50, by - 120), (bx - 33, by - 165), (bx - 16, by - 120)], fill=255)
    csm = blur(np.asarray(cs, np.float32) / 255, 1.2)
    spur = col(18, 19, 20) * (0.7 + 0.6 * noise(H, W, 30, seed + 60))[..., None]
    img = lerp(img, spur, csm)
    # lit window in the keep
    win = np.exp(-(((xx - (bx - 33)) / 3) ** 2 + ((yy - (by - 70)) / 5) ** 2))
    img += win[..., None] * col(255, 190, 90) * 1.4
    # foreground: dark slope with pines, a lake catching the moon
    lake_top = 0.8
    lake = ss(H * lake_top - 2, H * lake_top + 2, yy) * (1 - ss(H * 0.9, H * 0.95, yy - (0.25 - u) * H * 0.4))
    refl = np.exp(-((u - moon[0]) / 0.03) ** 2) * (0.5 + 0.5 * snoise(H, W, 40, 2, seed + 70))
    water = col(22, 26, 30) * (0.8 + 0.4 * snoise(H, W, 80, 3, seed + 71))[..., None] + refl[..., None] * col(200, 196, 170) * 0.5
    img = lerp(img, water, lake)
    fg = ss(-2, 2, yy - (H * (0.86 + 0.1 * (u - 0.3) ** 2 * 4 + 0.03 * noise(1, W, 120, seed + 80)[0][None, :])))
    fgcol = col(16, 15, 13) * (0.6 + 0.7 * noise(H, W, 40, seed + 81))[..., None]
    img = lerp(img, fgcol, fg)
    pines = Image.new('L', (W, H), 0); d = ImageDraw.Draw(pines)
    r = np.random.default_rng(seed + 90)
    for k in range(60):
        px = r.random() ** 1.6 * W * 0.32 if k < 40 else W - r.random() ** 1.6 * W * 0.12
        base = H * (0.82 + 0.1 * r.random()); h = H * (0.15 + 0.3 * r.random()) * (1.2 if px < W * 0.15 else 0.8)
        for t in np.linspace(0, 1, 14):
            y = base - h * t; wdt = h * 0.22 * (1 - t) ** 1.1 + 3
            d.polygon([(px - wdt, y + h * 0.06), (px + wdt, y + h * 0.06), (px, y - h * 0.05)], fill=255)
        d.rectangle([px - 3, base - h * 0.1, px + 3, base + 10], fill=255)
    pm = blur(np.asarray(pines, np.float32) / 255, 1.0)
    img = lerp(img, col(10, 12, 11) * (0.8 + 0.4 * noise(H, W, 10, seed + 91))[..., None], pm)
    # overall glaze
    img = img * np.array([0.98, 0.98, 0.96], np.float32)
    img, bump = age_canvas(img, seed, crack_cell=80, varnish=1.0, grime=0.9, smear=9, kuw=3)
    save(name, img, bump)


if __name__ == '__main__':
    which = sys.argv[1:] or ['lady', 'gent', 'youth', 'storm', 'vale']
    for w in which:
        if w == 'lady': lady()
        elif w == 'gent': gent()
        elif w == 'youth': gent('youth', 's3.png', 512, 640, 233, fsz=330, fy=80, keep=(128, 118, 90, 112))
        elif w == 'storm': storm()
        elif w == 'vale': storm(512, 640, 411, 'vale')
