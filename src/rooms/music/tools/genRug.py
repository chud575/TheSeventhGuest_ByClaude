#!/usr/bin/env python3
"""Offline Persian (Kashan-style) carpet for the music room: public/assets/music/rug.jpg + rug_n.jpg.
A proper border hierarchy -- outer reciprocal guard, minor guard stripes, a broad main border with a
meandering vine carrying palmettes and rosettes, inner guards -- around an oxblood field with a
herati-like lattice, a central lobed medallion with pendants and quarter-medallion spandrels.
Abrash (dye-lot banding), knot grain, wear and a pile normal map.  4.0 x 5.4 m.
    python3 src/rooms/music/tools/genRug.py"""
import numpy as np
from PIL import Image, ImageFilter
import os

W, H = 2048, 2765
RW, RL = 4.0, 5.4
ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
X = (xs + 0.5) / W * RW          # metres across
Y = (ys + 0.5) / H * RL          # metres along
rng = np.random.default_rng(7)

C = {
    'field': (0.40, 0.075, 0.085), 'navy': (0.07, 0.085, 0.19), 'ivory': (0.6, 0.53, 0.42),
    'gold': (0.55, 0.39, 0.17), 'rose': (0.58, 0.24, 0.24), 'teal': (0.13, 0.27, 0.3),
    'dark': (0.05, 0.035, 0.045), 'red2': (0.52, 0.12, 0.11),
}
img = np.zeros((H, W, 3), np.float32)
height = np.zeros((H, W), np.float32)   # pile carving: motif outlines sit slightly lower
def put(mask, col, h=0.0):
    m = mask.astype(np.float32)
    img[:] = img * (1 - m[..., None]) + np.array(C[col], np.float32) * m[..., None]
    if h: height[:] += m * h

# distance to the rug edge (metres) -> band structure
d = np.minimum(np.minimum(X, RW - X), np.minimum(Y, RL - Y))
put(np.ones_like(d, bool), 'field')
B = [0.0, 0.07, 0.085, 0.12, 0.135, 0.5, 0.515, 0.55, 0.565]   # band edges
# outer reciprocal guard: navy/rose interlocking teeth
t = np.where(np.minimum(X, RW - X) < np.minimum(Y, RL - Y), Y, X)    # coordinate running along the band
put(d < B[1], 'navy')
tooth = (np.abs(((t / 0.07) % 1.0) - 0.5) * 2 * (B[1] - 0.012)) > (d - 0.006)
put((d < B[1]) & (d > 0.006) & tooth, 'rose')
put((d >= B[1]) & (d < B[2]), 'gold')
# minor guard: ivory ground with small dark rosettes
put((d >= B[2]) & (d < B[3]), 'ivory')
ph = (t / 0.06) % 1.0
put((d >= B[2]) & (d < B[3]) & (((ph - 0.5) ** 2 * 0.0036 + (d - (B[2] + B[3]) / 2) ** 2) < 0.011 ** 2), 'red2', -0.3)
put((d >= B[3]) & (d < B[4]), 'dark')
# main border: navy ground, meandering vine with palmettes + rosettes
mb = (d >= B[4]) & (d < B[5])
put(mb, 'navy')
mid = (B[4] + B[5]) / 2; half = (B[5] - B[4]) / 2
P = 0.42                                            # vine period along the band
vine = mid + 0.11 * np.sin(t / P * 2 * np.pi)
put(mb & (np.abs(d - vine) < 0.008), 'gold', -0.4)
phase = (t / P) % 1.0
for k, (pc, col, r) in enumerate([(0.25, 'rose', 0.075), (0.75, 'ivory', 0.065)]):
    cy = mid + 0.11 * np.sin(pc * 2 * np.pi)
    du = (phase - pc) * P
    dv = d - cy
    rr = np.sqrt(du ** 2 + dv ** 2)
    ang = np.arctan2(dv, du)
    if k == 0:   # palmette: lobed fan
        lobe = r * (0.75 + 0.25 * np.cos(ang * 7))
        put(mb & (rr < lobe), 'rose', -0.3)
        put(mb & (rr < lobe * 0.62), 'ivory')
        put(mb & (rr < lobe * 0.35), 'gold')
        put(mb & (np.abs(rr - lobe) < 0.006), 'dark', -0.4)
    else:        # rosette
        petal = r * (0.7 + 0.3 * np.abs(np.cos(ang * 4)))
        put(mb & (rr < petal), 'teal', -0.3)
        put(mb & (rr < r * 0.45), 'gold')
        put(mb & (rr < r * 0.18), 'red2')
        put(mb & (np.abs(rr - petal) < 0.005), 'ivory', -0.4)
# little leaves off the vine
for pc in (0.0, 0.5):
    cy = mid + 0.11 * np.sin(pc * 2 * np.pi)
    du = (phase - pc) * P; dv = d - cy
    put(mb & (((du / 0.045) ** 2 + (dv / 0.02) ** 2) < 1), 'teal', -0.2)
put((d >= B[5]) & (d < B[6]), 'dark')
put((d >= B[6]) & (d < B[7]), 'gold')
pp = (t / 0.05) % 1.0
put((d >= B[6]) & (d < B[7]) & (np.abs(pp - 0.5) < 0.15), 'red2', -0.2)
put((d >= B[7]) & (d < B[8]), 'dark')

# field: herati-like lattice of diamonds with leaves and florets
fx = X - RW / 2; fy = Y - RL / 2
field = d >= B[8]
cell = 0.24
u = (fx / cell) % 1.0 - 0.5; v = (fy / (cell * 1.25)) % 1.0 - 0.5
dia = np.abs(u) + np.abs(v)
put(field & (np.abs(dia - 0.42) < 0.025), 'navy', -0.3)
put(field & (dia < 0.12), 'gold', -0.2)
put(field & (dia < 0.05), 'ivory')
# leaves on the diamond corners
lu = np.abs(u) - 0.21; lv = np.abs(v) - 0.21
put(field & (((lu + lv) ** 2 / 0.012 + (lu - lv) ** 2 / 0.002) < 1), 'teal', -0.2)
# spandrels: quarter medallions in the field corners
ex = RW / 2 - B[8]; ey = RL / 2 - B[8]
cxs = np.abs(fx) - ex; cys = np.abs(fy) - ey
cr = np.sqrt(cxs ** 2 + (cys * 0.85) ** 2)
ca = np.arctan2(cys, cxs)
sp = field & (cr < 0.75 * (0.9 + 0.1 * np.cos(ca * 12)))
put(sp, 'navy', -0.2)
put(field & (np.abs(cr - 0.6) < 0.012), 'gold', -0.3)
put(field & (cr < 0.38 * (0.85 + 0.15 * np.cos(ca * 10))), 'ivory', -0.1)
put(field & (cr < 0.22), 'rose')
# central medallion: 16-lobed star in layers, with pendants up and down the axis
mr = np.sqrt(fx ** 2 + (fy * 0.82) ** 2) / 0.74
ma = np.arctan2(fy, fx)
lob = 1.0 + 0.12 * np.cos(ma * 16)
put(mr < 0.85 * lob, 'navy', -0.2)
put(np.abs(mr - 0.85 * lob) < 0.014, 'gold', -0.4)
put(mr < 0.62 * (1.0 + 0.1 * np.cos(ma * 12)), 'ivory', -0.1)
put(np.abs(mr - 0.62 * (1.0 + 0.1 * np.cos(ma * 12))) < 0.01, 'dark', -0.4)
put(mr < 0.44 * (1.0 + 0.14 * np.cos(ma * 8)), 'rose')
put(mr < 0.26 * (1.0 + 0.2 * np.cos(ma * 8 + np.pi / 8)), 'teal', -0.2)
put(mr < 0.12, 'gold')
put(mr < 0.05, 'red2')
# florets ringing the navy band of the medallion, and small ivory hooks round the rose star
for k in range(16):
    a = k / 16 * 2 * np.pi + np.pi / 16
    cxk, cyk = 0.74 * np.cos(a) * 0.74, 0.74 * np.sin(a) * 0.74 / 0.82
    rr_ = np.sqrt((fx - cxk) ** 2 + (fy - cyk) ** 2)
    aa_ = np.arctan2(fy - cyk, fx - cxk)
    put(rr_ < 0.032 * (0.7 + 0.3 * np.abs(np.cos(aa_ * 3))), 'gold', -0.2)
    put(rr_ < 0.012, 'red2')
ring = (mr > 0.27) & (mr < 0.42)
put(ring & (np.abs(((ma / (2 * np.pi) * 24) % 1.0) - 0.5) < 0.06), 'ivory', -0.2)
# field sprays between the lattice diamonds: a stem and two buds
su = (fx / cell + 0.5) % 1.0 - 0.5; sv = (fy / (cell * 1.25) + 0.5) % 1.0 - 0.5
put(field & (mr > 1.05) & (np.abs(su) < 0.02) & (np.abs(sv) < 0.18), 'ivory', -0.2)
put(field & (mr > 1.05) & ((su ** 2 + (np.abs(sv) - 0.16) ** 2) < 0.05 ** 2), 'rose', -0.2)
put(field & (mr > 1.05) & ((su ** 2 + sv ** 2) < 0.045 ** 2), 'gold', -0.2)
for s in (-1, 1):   # pendants
    py_ = fy - s * 0.8
    pr_ = np.sqrt((fx / 0.18) ** 2 + (py_ / 0.22) ** 2)
    put(pr_ < 1, 'navy', -0.2)
    put(np.abs(pr_ - 0.75) < 0.07, 'gold', -0.3)
    put(pr_ < 0.4, 'ivory')
    put((np.abs(fx) < 0.015) & (np.abs(fy) > 0.62) & (np.abs(fy) < 1.0), 'gold', -0.2)

# abrash: horizontal dye-lot bands in the field colour
ab = 1.0 + 0.07 * np.sin(Y * 3.1 + 1.3) * np.sin(Y * 0.7) + 0.04 * np.sin(Y * 11.0)
img *= ab[..., None]
# knot grain: per-knot jitter on a ~4 mm grid, and a little colour drift
kx = (X / 0.004).astype(np.int32); ky = (Y / 0.004).astype(np.int32)
kh = ((kx * 73856093) ^ (ky * 19349663)) & 0xffff
kn = (kh / 65535.0).astype(np.float32)
img *= (0.9 + 0.2 * kn)[..., None]
# wear: the pile is thinner (paler, showing the warp) along the traffic line and toward the centre
def noise(sx, sy, seed):
    r = np.random.default_rng(seed); g = r.random((sy + 3, sx + 3)).astype(np.float32)
    im = Image.fromarray((g * 255).astype(np.uint8)).resize((W + int(W / sx * 3), H + int(H / sy * 3)), Image.BICUBIC)
    return np.asarray(im, np.float32)[:H, :W] / 255.0
wn = noise(10, 14, 3) * 0.6 + noise(40, 54, 5) * 0.4
wear = np.clip((wn - 0.55) * 3.0, 0, 1) * np.clip(1.2 - d * 0.0, 0, 1) * 0.5
img = img * (1 - wear[..., None] * 0.35) + np.array([0.5, 0.42, 0.34]) * (wear[..., None] * 0.35) * img.mean(axis=2, keepdims=True) * 2
# dull the dyes: an old carpet, softened toward its own luminance and a touch darker
lum = img.mean(axis=2, keepdims=True)
img = (img * 0.8 + lum * 0.2) * 0.92
img = np.asarray(Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), np.float32) / 255
img = np.clip(img, 0, 1)
out = os.path.join(os.path.dirname(__file__), '../../../../public/assets/music/')
Image.fromarray((img * 255 + 0.5).astype(np.uint8)).save(out + 'rug.jpg', quality=90)
# pile normal map: knot-level bumps + the carved outlines
hgt = height * 0.6 + (kn - 0.5) * 0.5 + (noise(300, 400, 9) - 0.5) * 0.6 - wear * 0.6
hgt = np.asarray(Image.fromarray(((hgt - hgt.min()) / (np.ptp(hgt) + 1e-6) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)), np.float32) / 255.0
gx = np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1); gy = np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)
k = 3.0
n = np.stack([-gx * k, gy * k, np.ones_like(gx)], -1)
n /= np.linalg.norm(n, axis=2, keepdims=True)
Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)).save(out + 'rug_n.jpg', quality=90)
print('wrote rug.jpg / rug_n.jpg', os.path.getsize(out + 'rug.jpg'), os.path.getsize(out + 'rug_n.jpg'))
