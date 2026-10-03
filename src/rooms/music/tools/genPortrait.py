#!/usr/bin/env python3
"""
Overmantel portrait of the composer "Herr Kessler" for the music room.

Source: tools/src/kessler_face.png is a 332 px head crop of an anonymous mid-19th-century
oil portrait in the public domain (Metropolitan Museum Open Access, CC0), as reproduced in
NVlabs' MetFaces teaser. Only the head comes from it; everything else -- the ground, the
bust (tail-coat, wing collar, black stock), brushwork, canvas weave, impasto, craquelure,
yellowed varnish and the grimy oval vignette -- is painted procedurally here.

Outputs in public/assets/music/:
  portrait.jpg        albedo (sRGB), 1024 x 1365
  portrait_bump.png   height: canvas weave + impasto + craquelure (for bumpMap)
  portrait_rough.png  roughness: varnish pooled in the cracks / worn on the highs

  python3 src/rooms/music/tools/genPortrait.py
"""
import os
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
OUT = os.path.join(ROOT, 'public/assets/music')
W, H = 1024, 1365
rng = np.random.default_rng(1847)


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


def strokes(h, w, length, width, seed, angle):
    """anisotropic noise: brush drags of `length` px along `angle` (radians)."""
    big = int(np.hypot(h, w)) + 8
    r = np.random.default_rng(seed)
    g = r.random((big // width + 3, big // length + 3)).astype(np.float32)
    g = cv2.resize(g, ((big // length + 3) * length, (big // width + 3) * width), interpolation=cv2.INTER_CUBIC)[:big, :big]
    M = cv2.getRotationMatrix2D((big / 2, big / 2), np.degrees(angle), 1.0)
    g = cv2.warpAffine(g, M, (big, big), borderMode=cv2.BORDER_REFLECT)
    y0, x0 = (big - h) // 2, (big - w) // 2
    return g[y0:y0 + h, x0:x0 + w]


def smooth(a, s):
    return cv2.GaussianBlur(a, (0, 0), s)


yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
u, v = xx / W, yy / H

# ----------------------------------------------------------------------------- the head
face = cv2.cvtColor(cv2.imread(os.path.join(HERE, 'src/kessler_face.png')), cv2.COLOR_BGR2RGB).astype(np.float32) / 255
fh, fw = face.shape[:2]
S = 2.42
FW, FH = int(fw * S), int(fh * S)
big = cv2.resize(face, (FW, FH), interpolation=cv2.INTER_LANCZOS4)
# re-sharpen the upscale into crisp paint edges (edge-preserving, then unsharp)
bu8 = (np.clip(big, 0, 1) * 255).astype(np.uint8)
bu8 = cv2.edgePreservingFilter(bu8, flags=cv2.RECURS_FILTER, sigma_s=12, sigma_r=0.12)
big = bu8.astype(np.float32) / 255
big = np.clip(big + 0.6 * (big - smooth(big, 2.2)), 0, 1)
FX0, FY0 = 512 - int(0.56 * FW), 96

# ----------------------------------------------------------------------------- ground
# warm umber-olive, lighter behind the lit side of the head (Rembrandt), darker to the corners
edge_col = np.concatenate([face[:, :6].reshape(-1, 3), face[:6, :fw // 3].reshape(-1, 3)]).mean(0)
ground_dark = np.array([0.055, 0.048, 0.038], np.float32)
ground_lit = np.maximum(edge_col * 1.25, np.array([0.13, 0.115, 0.085], np.float32))
halo = np.exp(-(((u - 0.38) / 0.36) ** 2 + ((v - 0.3) / 0.3) ** 2))
n1 = noise(H, W, 260, 3)
img = ground_dark[None, None] + (ground_lit - ground_dark)[None, None] * (halo * (0.75 + 0.5 * n1))[..., None]
# scumbled, cross-hatched brushwork in the ground
for k, ang in enumerate([0.7, -0.5, 1.2]):
    s = strokes(H, W, 70, 7, 20 + k, ang)
    img *= (0.9 + 0.2 * s)[..., None]

# ----------------------------------------------------------------------------- bust: tail-coat, wing collar, black stock
coat = np.zeros((H, W), np.float32)
pts = np.array([[0, H], [0, 1130], [60, 1050], [190, 960], [330, 905], [450, 890], [560, 890], [700, 880], [820, 880],
                [915, 930], [985, 1020], [W, 1080], [W, H]], np.int32)
cv2.fillPoly(coat, [pts], 1.0)
coat = smooth(coat, 6)
coatcol = np.array([0.03, 0.032, 0.045], np.float32)
folds = strokes(H, W, 160, 22, 41, 1.2) * 0.6 + strokes(H, W, 120, 16, 42, 1.9) * 0.4
coatshade = coatcol[None, None] * (0.7 + 0.9 * folds[..., None]) * (1.25 - 0.6 * v[..., None])
# the shoulder catching the key light (left)
coatshade += np.array([0.05, 0.05, 0.06], np.float32)[None, None] * (np.exp(-(((u - 0.18) / 0.12) ** 2 + ((v - 0.76) / 0.05) ** 2)) * folds)[..., None]
# lapels: a lighter silk facing edge
lap = np.zeros((H, W), np.float32)
cv2.polylines(lap, [np.array([[380, 905], [430, 1060], [470, 1365]], np.int32)], False, 1.0, 9)
cv2.polylines(lap, [np.array([[760, 890], [690, 1060], [640, 1365]], np.int32)], False, 1.0, 9)
lap = smooth(lap, 7)
coatshade += np.array([0.045, 0.045, 0.05], np.float32)[None, None] * lap[..., None]
img = img * (1 - coat[..., None]) + coatshade * coat[..., None]
# shirt front + wing collar (linen in half-shadow) and a loosely tied black silk cravat
shirt = np.zeros((H, W), np.float32)
cv2.fillPoly(shirt, [np.array([[470, 900], [680, 892], [615, 1365], [520, 1365]], np.int32)], 1.0)
wing = np.zeros((H, W), np.float32)
cv2.fillPoly(wing, [np.array([[690, 884], [780, 846], [800, 900], [735, 948]], np.int32)], 1.0)
cv2.fillPoly(wing, [np.array([[430, 892], [372, 866], [360, 910], [410, 950]], np.int32)], 1.0)
shirt = smooth(np.maximum(shirt, wing), 3.5)
linen = np.array([0.62, 0.58, 0.5], np.float32)
lshade = (0.5 + 0.5 * smooth(strokes(H, W, 60, 12, 51, 1.5), 2.5))[..., None]
lshade = lshade * (1.0 - 0.55 * np.clip((u[..., None] - 0.47) * 4, 0, 1)) * (1.1 - 0.7 * np.clip((v[..., None] - 0.66) * 2.5, 0, 1))
img = img * (1 - shirt[..., None]) + (linen * lshade) * shirt[..., None]
# cravat: soft lobes of black satin with a dull sheen on the folds
crav = np.zeros((H, W), np.float32)
cv2.ellipse(crav, (565, 950), (120, 48), -4, 0, 360, 1.0, -1)          # the wrap round the collar
cv2.ellipse(crav, (500, 1000), (70, 40), 25, 0, 360, 1.0, -1)          # bow, left loop
cv2.ellipse(crav, (630, 995), (66, 38), -22, 0, 360, 1.0, -1)          # bow, right loop
cv2.fillPoly(crav, [np.array([[545, 1010], [592, 1010], [618, 1170], [585, 1190], [530, 1160]], np.int32)], 1.0)
crav = smooth(crav, 5)
sheen = smooth(strokes(H, W, 90, 30, 61, 0.4), 9)
sheen = np.clip((sheen - 0.45) * 3, 0, 1) * np.exp(-(((u - 0.5) / 0.12) ** 2 + ((v - 0.72) / 0.05) ** 2))
silk = np.array([0.018, 0.018, 0.022], np.float32)[None, None] + np.array([0.13, 0.12, 0.13], np.float32)[None, None] * sheen[..., None]
img = img * (1 - crav[..., None]) + silk * crav[..., None]
# a gold stud catching the light
cv2.circle(img, (560, 1225), 5, (0.42, 0.32, 0.14), -1)

# ----------------------------------------------------------------------------- composite the head with a feathered mask
mask = np.ones((FH, FW), np.float32)
fy, fx = np.mgrid[0:FH, 0:FW].astype(np.float32)
fu, fv = fx / FW, fy / FH
m = np.clip(fu / 0.08, 0, 1) * np.clip((1 - fu) / 0.16, 0, 1) * np.clip(fv / 0.06, 0, 1)
# bottom: keep the beard to the edge in the middle, let the coat take over at the sides
bottom = np.clip((1 - fv) / np.where(np.abs(fu - 0.5) < 0.25, 0.05, 0.22), 0, 1)
m *= bottom
# a ragged (hair-strand) lower edge instead of a straight fade
rag = cv2.resize(np.random.default_rng(5).random((1, FW // 6 + 2)).astype(np.float32), (FW, FH), interpolation=cv2.INTER_CUBIC)
m *= np.clip((1 - fv - 0.02 - 0.05 * rag * (np.abs(fu - 0.5) < 0.3)) / 0.04, 0, 1) if True else 1
mask = smooth(m, 6)
canvas_face = np.zeros((H, W, 3), np.float32); canvas_mask = np.zeros((H, W), np.float32)
y1, x1 = min(H, FY0 + FH), min(W, FX0 + FW)
canvas_face[FY0:y1, max(0, FX0):x1] = big[:y1 - FY0, max(0, -FX0):x1 - FX0]
canvas_mask[FY0:y1, max(0, FX0):x1] = mask[:y1 - FY0, max(0, -FX0):x1 - FX0]
# the right edge of the crop runs through the hair: carry the mane on in strokes so it doesn't stop at a line
hair = np.exp(-(((u - 0.84) / 0.07) ** 2 + ((v - 0.36) / 0.2) ** 2)) * 0.75
hairtex = strokes(H, W, 90, 5, 71, 1.35)
haircol = np.array([0.075, 0.055, 0.04], np.float32)[None, None] * (0.6 + 0.9 * hairtex[..., None])
hair = hair * (1 - canvas_mask)
img = img * (1 - hair[..., None]) + haircol * hair[..., None]
img = img * (1 - canvas_mask[..., None]) + canvas_face * canvas_mask[..., None]
# the beard's tips falling over the cravat: vertical strands tapering into a V
tip = np.clip(1 - np.abs(u - 0.5) / (0.2 * np.clip((1000 - yy) / 120, 0, 1) + 1e-3), 0, 1) * np.clip((yy - 840) / 40, 0, 1) * np.clip((1000 - yy) / 60, 0, 1)
strand = smooth(strokes(H, W, 60, 5, 77, np.pi / 2 - 0.08), 1.2)
tip = smooth(np.clip(tip * 1.3, 0, 1), 4) * (0.8 + 0.3 * strand)
tip = np.clip(tip, 0, 1)
beardcol = np.array([0.06, 0.04, 0.028], np.float32)[None, None] * (0.75 + 0.5 * strand[..., None])
img = img * (1 - tip[..., None]) + beardcol * tip[..., None]

# ----------------------------------------------------------------------------- brushwork over everything (follows the local form)
lum = img.mean(2)
gx = cv2.Sobel(smooth(lum, 4), cv2.CV_32F, 1, 0); gy = cv2.Sobel(smooth(lum, 4), cv2.CV_32F, 0, 1)
ang = np.arctan2(gy, gx) + np.pi / 2           # strokes run along the contours
bs = np.zeros((H, W), np.float32)
for k, a in enumerate(np.linspace(0, np.pi, 6, endpoint=False)):
    s = strokes(H, W, 28, 4, 100 + k, a)
    wgt = np.cos(2 * (ang - a)) * 0.5 + 0.5
    wgt = wgt ** 4
    bs += s * wgt
bs /= np.maximum(1e-3, sum((np.cos(2 * (ang - a)) * 0.5 + 0.5) ** 4 for a in np.linspace(0, np.pi, 6, endpoint=False)))
img *= (0.93 + 0.14 * bs)[..., None]

# ----------------------------------------------------------------------------- age: canvas weave, craquelure, varnish, grime
weave = (np.sin(xx * 2 * np.pi / 3.2) * 0.5 + 0.5) * 0.5 + (np.sin(yy * 2 * np.pi / 3.4) * 0.5 + 0.5) * 0.5
weave = weave * (0.8 + 0.4 * noise(H, W, 6, 81, 2))
# craquelure: cells from a jittered voronoi diagram, edges warped by noise
npts = 5200
pts = (rng.random((npts, 2)) * [W, H]).astype(np.float32)
seed_img = np.ones((H, W), np.uint8)
for (px, py) in pts.astype(int):
    seed_img[min(H - 1, py), min(W - 1, px)] = 0
_, labels = cv2.distanceTransformWithLabels(seed_img, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
wx = (noise(H, W, 40, 91, 3) - 0.5) * 18; wy = (noise(H, W, 40, 92, 3) - 0.5) * 18
labels = cv2.remap(labels.astype(np.float32), xx + wx, yy + wy, cv2.INTER_NEAREST)
edges = ((labels != np.roll(labels, 1, 0)) | (labels != np.roll(labels, 1, 1))).astype(np.float32)
# finer secondary net, only in thick dark paint
_, lab2 = cv2.distanceTransformWithLabels(np.where(rng.random((H, W)) < 0.0075, 0, 1).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
lab2 = cv2.remap(lab2.astype(np.float32), xx + wy * 0.5, yy + wx * 0.5, cv2.INTER_NEAREST)
e2 = ((lab2 != np.roll(lab2, 1, 0)) | (lab2 != np.roll(lab2, 1, 1))).astype(np.float32)
cracks = np.clip(edges * (0.4 + 0.6 * noise(H, W, 120, 93)) + e2 * 0.5 * noise(H, W, 90, 94), 0, 1)
cracks = smooth(cracks, 0.6)
img *= (1 - 0.13 * cracks)[..., None]
# yellowed, unevenly cleaned varnish + grime toward the frame
varn = 0.75 + 0.25 * noise(H, W, 200, 95)
tint = np.array([1.0, 0.9, 0.68], np.float32)
img = img * (1 - 0.55 * varn[..., None]) + img * tint[None, None] * (0.55 * varn[..., None])
r = np.sqrt(((u - 0.5) / 0.5) ** 2 + ((v - 0.47) / 0.53) ** 2)
grime = np.clip((r - 0.62) / 0.5, 0, 1) ** 1.5
img *= (1 - 0.6 * grime)[..., None]
img *= (0.97 + 0.06 * weave)[..., None]
img = np.clip(img, 0, 1)

os.makedirs(OUT, exist_ok=True)
out8 = (img ** (1 / 1.0) * 255 + 0.5).astype(np.uint8)
cv2.imwrite(os.path.join(OUT, 'portrait.jpg'), cv2.cvtColor(out8, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 90])
# height: weave + impasto (bright, thick lights stand proud) - cracks
imp = smooth(np.clip((lum - 0.35) * 2, 0, 1), 1.5) * (0.6 + 0.4 * bs)
bump = np.clip(0.45 + 0.18 * (weave - 0.5) + 0.25 * imp - 0.5 * cracks, 0, 1)
cv2.imwrite(os.path.join(OUT, 'portrait_bump.png'), cv2.resize((bump * 255).astype(np.uint8), (W // 2, H // 2), interpolation=cv2.INTER_AREA))
# roughness: satin varnish (0.45), duller in the grime and cracks, a little glossier on impasto
rough = np.clip(0.42 + 0.25 * grime + 0.35 * cracks - 0.1 * imp + 0.08 * (noise(H, W, 60, 97) - 0.5), 0, 1)
cv2.imwrite(os.path.join(OUT, 'portrait_rough.png'), cv2.resize((rough * 255).astype(np.uint8), (W // 2, H // 2), interpolation=cv2.INTER_AREA))
print('wrote portrait', img.shape)
