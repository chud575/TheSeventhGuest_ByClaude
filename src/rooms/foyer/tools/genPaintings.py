#!/usr/bin/env python3
"""
Offline oil paintings for the Grand Foyer.

  python3 src/rooms/foyer/tools/genPaintings.py [stauf|lady|elder|maid|storm] ...

Faces (tools/src_faces/*.png, 256 px) are synthetic painted faces sampled from a StyleGAN2
model trained on MetFaces (the same pool the gallery and dining room use; they depict nobody
real). Stauf uses the same face as the gallery's toymaker so the master of the house is
recognisably one man throughout. Everything else -- Rembrandt grounds, frock coat, waistcoat,
watch chain, drapery, the landscape -- is painted procedurally, then aged by paintlib.

Outputs in public/assets/foyer/: <name>.jpg (albedo) + <name>_bump.png (height for bump/normal)
"""
import os, sys
import numpy as np
import cv2
from PIL import Image, ImageDraw
from paintlib import (HERE, kuwahara, noise, snoise, ss, blur, col, lerp, place_face, ground, costume_mask, silk,
                      lace, pearls, cameo, age_canvas, save, storm)

FACES = os.path.join(HERE, 'src_faces')


def shirt_and_stock(img, cx, neckY, seed, wide=62, depth=190, lit=1.0):
    H, W = img.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    sh = Image.new('L', (W, H), 0); d = ImageDraw.Draw(sh)
    d.polygon([(cx - wide, neckY - 6), (cx + wide, neckY - 6), (cx + 8, neckY + depth), (cx - 8, neckY + depth)], fill=255)
    sm = blur(np.asarray(sh, np.float32) / 255, 3)
    shade = np.clip(1.05 - (xx - cx + wide * 0.8) / (wide * 2.6), 0.3, 1)[..., None] * (1 - 0.6 * ss(neckY, neckY + depth * 1.05, yy))[..., None]
    img = lerp(img, col(196, 186, 164) * shade * lit, sm * 0.94)
    # wing collar points
    wc = Image.new('L', (W, H), 0); d = ImageDraw.Draw(wc)
    for s in (-1, 1):
        d.polygon([(cx + s * 10, neckY - 34), (cx + s * wide * 1.15, neckY - 28), (cx + s * wide * 0.9, neckY + 18), (cx + s * 18, neckY + 6)], fill=255)
    wm = blur(np.asarray(wc, np.float32) / 255, 1.6)
    img = lerp(img, col(214, 204, 182) * np.clip(1.15 - (xx - cx + 50) / 170, 0.35, 1.1)[..., None] * lit, wm * 0.9)
    # black silk stock with a knot and falling ends
    st = Image.new('L', (W, H), 0); d = ImageDraw.Draw(st)
    d.rectangle([cx - wide * 0.85, neckY - 10, cx + wide * 0.85, neckY + 30], fill=255)
    d.ellipse([cx - 24, neckY + 12, cx + 24, neckY + 56], fill=255)
    d.polygon([(cx - 20, neckY + 40), (cx - 44, neckY + 120), (cx - 6, neckY + 104)], fill=255)
    d.polygon([(cx + 20, neckY + 40), (cx + 40, neckY + 124), (cx + 6, neckY + 102)], fill=255)
    stm = blur(np.asarray(st, np.float32) / 255, 2.2)
    silkn = 0.6 + 0.7 * snoise(H, W, 5, 26, seed + 4, angle=80)
    img = lerp(img, col(20, 17, 17) * (silkn * np.clip(1.1 - (xx - cx + 40) / 140, 0.4, 1.1))[..., None], stm)
    return img


def stauf():
    W, H = 1200, 1614
    seed = 1893
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u, v = xx / W, yy / H
    # Rembrandt ground: warm umber glow behind the head, falling to bitumen at the edges
    img = ground(H, W, seed, col(80, 62, 42), glow_at=(0.4, 0.22), glow=(0.36, 0.28), glow_amt=0.85, dark_bottom=0.85)
    # a heavy oxblood curtain swagged across the top right, lost into shadow
    cur = ss(0.64, 0.74, u + 0.22 * (0.3 - v) + 0.03 * np.sin(v * 14)) * ss(0.6, 0.2, v)
    folds = np.clip(blur(snoise(H, W, 34, 400, seed + 7, angle=-12), 3), 0, 1)
    cur_col = col(70, 13, 11) * (0.25 + 0.95 * folds ** 1.5)[..., None] * (1 - 0.75 * ss(0.1, 0.6, v))[..., None]
    img = lerp(img, cur_col, cur * 0.9)

    # ---- the head: the whole source study (face, beard, hair, collar), its paper ground keyed out
    fsz, x0, y0 = 640, 280, 250
    f = np.asarray(Image.open(os.path.join(FACES, 'v8_4.png')).convert('RGB'), np.float32) / 255
    fu = cv2.resize(f, (fsz, fsz), interpolation=cv2.INTER_LANCZOS4)
    fu = np.clip(0.7 * fu + 0.3 * kuwahara(fu, 3), 0, 1)
    fu = np.clip(fu + 0.5 * (fu - blur(fu, 2.2)), 0, 1)
    fu = np.clip((fu - 0.02) * np.array([1.02, 0.97, 0.9], np.float32), 0, 1) ** 1.08
    ly, lx = np.mgrid[0:fsz, 0:fsz].astype(np.float32) / fsz
    # the skull: an egg the hair and face sit in; above the brow everything outside it is cut away softly
    headE = 1 - ss(0.86, 1.0, np.hypot((lx - 0.49) / 0.34, (ly - 0.5) / 0.52))
    headW = 1 - ss(0.88, 1.06, np.hypot((lx - 0.49) / 0.43, (ly - 0.52) / 0.54))
    core = 1 - ss(0.75, 1.0, np.hypot((lx - 0.5) / 0.33, (ly - 0.55) / 0.46))
    chroma = blur(fu[..., 0] - fu[..., 2], 2.0)
    lum = blur(fu @ np.array([0.3, 0.59, 0.11], np.float32), 2.0)
    paper = ss(0.1, 0.17, chroma) * ss(0.45, 0.6, lum)
    a = np.clip(np.maximum(np.maximum(core, headE), 1 - paper), 0, 1)
    a = np.where(ly < 0.5, a * headW, a)
    edge = np.minimum(np.minimum(lx, 1 - lx), 1 - ly)
    a *= ss(0.0, 0.08, edge) * ss(0.0, 0.2, 1 - ly)
    a = blur(np.clip((a - 0.4) / 0.6, 0, 1), 5)
    # darken the keyed fringe so no pale paper rim survives round the hair
    fring = np.clip(a * (1 - a) * 4, 0, 1) * (1 - core)
    fu = fu * (1 - 0.55 * fring[..., None])
    reg = img[y0:y0 + fsz, x0:x0 + fsz]
    img[y0:y0 + fsz, x0:x0 + fsz] = reg * (1 - a[..., None]) + fu * a[..., None]
    # the crown of the head continues above the study's top edge: the topmost hair band, stretched up into shadow
    # (no painted crown: the top of the head is lost in the warm glow behind it, a Rembrandt lost edge)
    glowc = np.exp(-(((xx - 600) / 260) ** 2 + ((yy - y0) / 120) ** 2))
    img = img + (glowc * 0.06)[..., None] * col(255, 220, 160)

    # ---- black frock coat over the shoulders, oxblood waistcoat, watch chain; the beard falls over it
    cx = 600
    neckY = y0 + int(fsz * 0.8)
    cm = costume_mask(W, H, cx, neckY, 150, 560, 210, seed, ctrl=[(0.0, 0.0), (0.2, 0.08), (0.46, 0.28), (0.72, 0.52), (0.9, 0.78), (0.99, 1.1), (1.03, 1.8), (1.05, 4.0)])
    coat = silk(H, W, cm, cx - 60, neckY + 160, seed + 20, col(44, 38, 36), sheen=0.22)
    below = ss(y0 + fsz - 110, y0 + fsz - 10, yy)          # the study's own coat corners carry down into the painted coat
    cmask = cm * np.maximum(below, 1 - blur(a_full(a, H, W, x0, y0), 4))
    img = lerp(img, coat, cmask)
    wc = Image.new('L', (W, H), 0); d = ImageDraw.Draw(wc)
    d.polygon([(cx - 80, y0 + fsz - 40), (cx + 80, y0 + fsz - 40), (cx + 6, y0 + fsz + 300), (cx - 6, y0 + fsz + 300)], fill=255)
    wcm = blur(np.asarray(wc, np.float32) / 255, 4) * below
    brocade = 0.8 + 0.2 * blur(noise(H, W, 14, seed + 30, 3), 1.5) + 0.1 * snoise(H, W, 4, 30, seed + 32, angle=85)
    wlit = np.clip(1.1 - (xx - cx + 100) / 330, 0.35, 1.1) * (1 - 0.6 * ss(y0 + fsz, H, yy))
    img = lerp(img, col(52, 14, 13) * (brocade * wlit)[..., None], wcm * 0.85)
    # satin lapel facings catching the light on the lit side
    lap = Image.new('L', (W, H), 0); d = ImageDraw.Draw(lap)
    d.line([(cx - 110, y0 + fsz - 40), (cx - 30, y0 + fsz + 330)], fill=255, width=10)
    img = img + (blur(np.asarray(lap, np.float32) / 255, 5) * below)[..., None] * col(60, 56, 54) * 0.6
    for i in range(3):
        by, bx = y0 + fsz + 40 + i * 80, cx + 2
        b = np.exp(-(((xx - bx) / 6) ** 2 + ((yy - by) / 6) ** 2))
        img = lerp(img, col(150, 112, 50) * (0.5 + 0.8 * np.exp(-(((xx - bx + 2) / 3) ** 2 + ((yy - by + 2) / 3) ** 2)))[..., None], np.clip(b * 1.6, 0, 1))
    chain = np.zeros((H, W), np.float32)
    for t in np.linspace(0, 1, 260):
        px = cx + 4 - 85 * t; py = y0 + fsz + 150 + 55 * np.sin(t * np.pi) + t * 20
        xi, yi = int(px), int(py)
        chain[yi - 2:yi + 3, xi - 2:xi + 3] = 0.6 + 0.4 * np.sin(t * 160)
    chain = blur(chain, 1.1)
    img = lerp(img, col(196, 150, 70) * 0.8, np.clip(chain * 1.4, 0, 1))
    # chiaroscuro: a raking light from upper left -- the shadow side and the lower body sink into the ground
    rake = np.clip(1.12 - 0.45 * ss(0.42, 0.95, u) - 0.42 * ss(0.55, 1.0, v), 0.4, 1.12)
    img = img * rake[..., None]
    lum = img @ np.array([0.3, 0.59, 0.11], np.float32)
    img = img * (0.9 + 0.14 * ss(0.12, 0.55, lum))[..., None]
    sig = Image.new('L', (W, H), 0); d = ImageDraw.Draw(sig)
    try:
        from PIL import ImageFont
        fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf', 30)
    except Exception:
        fnt = None
    d.text((W - 270, H - 110), 'H. Stauf  1891', fill=200, font=fnt)
    img = lerp(img, col(96, 64, 30), blur(np.asarray(sig, np.float32) / 255, 0.8) * 0.5)
    img, bump = age_canvas(img, seed, crack_cell=52, varnish=1.0, grime=1.0, smear=6.0)
    save('stauf', img, bump)


def a_full(a, H, W, x0, y0):
    out = np.zeros((H, W), np.float32)
    out[y0:y0 + a.shape[0], x0:x0 + a.shape[1]] = a
    return out


def sitter(name, face, W, H, seed, fsz, fy, keep, ground_col, coat_col, female=False, oval=False, glow_at=(0.38, 0.26), fx=None, dark_thr=0.28):
    fx = fx or W // 2
    img = ground(H, W, seed, col(*ground_col), glow_at=glow_at, glow=(0.46, 0.36), glow_amt=0.85, dark_bottom=0.72)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx = fx; neckY = fy + fsz * 0.86
    if female:
        hair_ext = np.exp(-(((xx - fx) / (fsz * 0.42)) ** 2 + ((yy - (fy + fsz * 0.3)) / (fsz * 0.36)) ** 2) ** 1.5)
        hn = snoise(H, W, 3, 40, seed + 9, angle=70) * 0.5 + noise(H, W, 30, seed + 10) * 0.5
        img = lerp(img, col(40, 26, 16) * (0.7 + 0.6 * hn)[..., None], hair_ext * 0.9)
        cm = costume_mask(W, H, cx, neckY + 30, fsz * 0.13, fsz * 0.8, fsz * 0.45, seed)
        dress = silk(H, W, cm, cx - 40, neckY + fsz * 0.35, seed + 20, col(*coat_col), sheen=1.6)
        img = lerp(img, dress, cm)
    else:
        cm = costume_mask(W, H, cx, neckY, fsz * 0.16, fsz * 0.78, fsz * 0.36, seed)
        img = lerp(img, silk(H, W, cm, cx - 30, neckY + fsz * 0.27, seed + 20, col(*coat_col), sheen=0.3), cm)
        img = shirt_and_stock(img, cx, neckY, seed, wide=int(fsz * 0.14), depth=int(fsz * 0.42), lit=0.85)
    img, fa = place_face(img, os.path.join(FACES, face), fx, fy, fsz, keep, dark_thr=dark_thr, feather=9)
    if female:
        nk = np.exp(-(((xx - fx) / (fsz * 0.12)) ** 4 + ((yy - (fy + fsz * 0.92)) / (fsz * 0.12)) ** 4))
        img = lerp(img, col(176, 142, 120) * np.clip(1.05 - (xx - fx + 40) / 160, 0.35, 1)[..., None], nk * (1 - fa) * 0.95)
        img = pearls(img, fx - 2, neckY + 14, fsz * 0.2, fsz * 0.22, 17, max(5, int(fsz * 0.018)), a0=0.4, a1=np.pi - 0.4, lit=0.85)
        img = cameo(img, fx - 2, neckY + fsz * 0.24, fsz * 0.035, fsz * 0.045)
    if oval:   # a painted feigned oval spandrel
        d = np.hypot((xx - W / 2) / (W * 0.47), (yy - H / 2) / (H * 0.47))
        img = lerp(img, img * 0.25, ss(0.98, 1.02, d))
    img, bump = age_canvas(img, seed, crack_cell=48, varnish=1.1, grime=1.0, smear=5.5)
    save(name, img, bump)


def run(which):
    if which == 'stauf': stauf()
    elif which == 'lady': sitter('lady', 's0.png', 768, 1024, 311, 470, 140, (128, 128, 80, 104), (52, 64, 54), (40, 52, 78), female=True, oval=True)
    elif which == 'elder': sitter('elder', 's8.png', 768, 980, 323, 480, 120, (130, 126, 74, 104), (60, 62, 66), (24, 22, 24), dark_thr=0.2)
    elif which == 'maid': sitter('maid', 'v3_7.png', 640, 853, 337, 400, 110, (128, 130, 70, 100), (52, 50, 56), (70, 20, 24), female=True, oval=True, dark_thr=0.22)
    elif which == 'storm': storm(2048, 1340, 919, 'vista')


if __name__ == '__main__':
    for w in (sys.argv[1:] or ['stauf', 'lady', 'elder', 'maid', 'storm']):
        run(w)
