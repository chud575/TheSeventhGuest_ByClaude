#!/usr/bin/env python3
"""Offline night-sky plate for the music-room windows (public/assets/music/sky.jpg).
Layered wind-stretched cloud banks back-lit by a large moon (silver linings where the cloud
edge faces the moon, dark bellies elsewhere), a soft halo + faint 22-degree ring, a moon disc
with maria and limb darkening, and stars in the clear gaps. Values are display (sRGB) values
matching the old procedural plate, which the room multiplies by 3 un-tonemapped.
    python3 src/rooms/music/tools/genSky.py"""
import numpy as np
from PIL import Image, ImageFilter
import os

W, H = 4096, 2560
rng = np.random.default_rng(1993)
ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
u = xs / W
v = 1.0 - ys / H          # v up, as in the shader uv

def noise(sx, sy, seed):
    r = np.random.default_rng(seed)
    g = r.random((sy + 3, sx + 3)).astype(np.float32)
    im = Image.fromarray((g * 65535).astype(np.uint16).astype(np.int32), mode='I')
    im = im.resize((W + int(W / sx * 3), H + int(H / sy * 3)), Image.BICUBIC)
    a = np.asarray(im, dtype=np.float32)[:H, :W] / 65535.0
    return a

def fbm(sx, sy, oct, seed, gain=0.5):
    acc = np.zeros((H, W), np.float32); amp = 1.0; tot = 0
    for o in range(oct):
        acc += amp * noise(max(2, int(sx * 2 ** o)), max(2, int(sy * 2 ** o)), seed + o * 17)
        tot += amp; amp *= gain
    return acc / tot

moon = np.array([0.33, 0.78])
md = np.sqrt(((u - moon[0]) * 1.6) ** 2 + (v - moon[1]) ** 2)
R = 0.082   # moon radius (v units): ~2.7x the old plate

sky = np.zeros((H, W, 3), np.float32)
top = np.array([0.2, 0.27, 0.46]); bot = np.array([0.05, 0.07, 0.15])
t = np.clip((v - 0.1) / 0.9, 0, 1)[..., None]
sky = bot * (1 - t) + top * t
sky += np.array([0.12, 0.13, 0.17]) * np.clip((0.45 - v) / 0.45, 0, 1)[..., None] ** 1.5
sky += np.array([0.55, 0.64, 0.86]) * (np.exp(-md * 4.2) * 0.85)[..., None]
sky += np.array([0.35, 0.42, 0.6]) * (np.exp(-((md - 0.36) / 0.02) ** 2) * 0.05)[..., None]

# clouds: two banks, stretched along x (wind), density thresholded softly
c1 = fbm(5, 14, 6, 11)
c2 = fbm(12, 30, 4, 47)
dens = np.clip((c1 * 0.85 + c2 * 0.3 - 0.45) * 3.6, 0, 1)
band = np.clip(1.0 - np.abs(v - 0.55) * 1.6, 0.2, 1.0)
dens *= band
dens = np.asarray(Image.fromarray((dens * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255
# back-lighting: march a few steps toward the moon; little cloud between a point and the moon = lit edge
dx = (moon[0] - u); dy = (moon[1] - v); L = np.sqrt((dx * 1.6) ** 2 + dy ** 2) + 1e-4
occl = np.zeros_like(dens)
for k in range(1, 7):
    s = 0.006 * k
    px = np.clip(((u + dx / L * s / 1.6) * W).astype(np.int32), 0, W - 1)
    py = np.clip(((1 - (v + dy / L * s)) * H).astype(np.int32), 0, H - 1)
    occl += dens[py, px]
lit = np.exp(-occl * 0.9)
near = np.exp(-md * 2.6)
belly = sky * 0.42 + np.array([0.02, 0.025, 0.045])
lining = np.array([0.82, 0.86, 1.0]) * (lit * near * 1.9)[..., None] + np.array([0.12, 0.14, 0.2]) * lit[..., None] * 0.4
cloud = belly + lining * dens[..., None] ** 0.6 * 0.9
sky = sky * (1 - dens[..., None] * 0.85) + cloud * dens[..., None] * 0.85 + lining * (dens * (1 - dens) * 2.5)[..., None] * 0.35

# stars in the clear gaps, above the treeline
sm = (rng.random((H, W)) > 0.9993).astype(np.float32) * rng.random((H, W)).astype(np.float32)
sm = np.asarray(Image.fromarray((sm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), np.float32) / 255 * 4
sky += np.array([0.75, 0.8, 0.95]) * (sm * (1 - dens) * np.clip((v - 0.35) / 0.4, 0, 1) * (1 - near))[..., None]

# the moon: maria, limb darkening, a crisp but anti-aliased edge; thin cloud drifts across its lower limb
mx = (u - moon[0]) * 1.6 / R; my = (v - moon[1]) / R
rr = np.sqrt(mx ** 2 + my ** 2)
mar = fbm(6, 10, 4, 91)
maria = np.clip((mar - 0.5) * 2.5, 0, 1)
limb = np.sqrt(np.clip(1 - rr ** 2, 0, 1)) ** 0.35
disc = np.clip((1 - rr) * R * H / 1.5, 0, 1)
moonc = np.array([1.0, 0.98, 0.93]) * (1.0 - 0.2 * maria)[..., None] * (0.75 + 0.35 * limb)[..., None]
veil = np.clip(dens * 0.9, 0, 0.45)[..., None]
moonc = moonc * (1 - veil) + cloud * veil
sky = sky * (1 - disc[..., None]) + moonc * disc[..., None]

# a distant treeline across the bottom of the plate: rounded oak crowns and a few taller elms,
# near-black against the horizon glow, their tops faintly silvered by the moon
cx = u
crown = 0.27 + 0.025 * fbm(14, 2, 4, 301)[0:1, :] + 0.012 * fbm(70, 2, 3, 333)[0:1, :]
bumps = np.zeros(W, np.float32)
r2 = np.random.default_rng(7)
for i in range(60):
    x0 = r2.random(); w = 0.008 + r2.random() * 0.02; h = 0.01 + r2.random() * 0.03
    bumps = np.maximum(bumps, h * np.sqrt(np.clip(1 - ((u[0] - x0) / w) ** 2, 0, 1)))
top = (crown[0] - 0.03 + bumps)[None, :]
edge = np.clip((top - v) * H / 2.0, 0, 1)
treecol = np.array([0.025, 0.03, 0.05]) + np.array([0.1, 0.12, 0.17]) * np.clip(1 - (top - v) * 60, 0, 1)[..., None] * 0.6
lawnTop = 0.215 + 0.004 * np.sin(u * 9.0)
lawnK = np.clip((lawnTop - v) * H / 2.0, 0, 1)
depth = np.clip(v / 0.215, 0, 1)
lawn = np.array([0.11, 0.14, 0.2]) * (1 - depth)[..., None] + np.array([0.06, 0.08, 0.12]) * depth[..., None]
lawn = lawn * (0.85 + 0.15 * fbm(30, 20, 3, 404))[..., None] * (0.9 + 0.1 * np.sin((u - 0.5) / (0.05 + 0.2 * depth) * 3.14159))[..., None]
treecol = treecol * (1 - lawnK[..., None]) + lawn * lawnK[..., None]
sky = sky * (1 - edge[..., None]) + treecol * edge[..., None]

out = os.path.join(os.path.dirname(__file__), '../../../../public/assets/music/sky.jpg')
Image.fromarray((np.clip(sky, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out, quality=88)
print('wrote', out, os.path.getsize(out))
