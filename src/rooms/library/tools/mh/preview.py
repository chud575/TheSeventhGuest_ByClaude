"""Quick offline orthographic preview of headparts (z-buffered triangle raster with
lambert shading, vertex colours, and a 1 cm grid) for placing sculpt landmarks."""
import json
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw


def load(path):
    buf = open(path, 'rb').read()
    hl = struct.unpack('<I', buf[:4])[0]
    h = json.loads(buf[4:4 + hl])
    base = 4 + hl
    parts = {}
    for p in h['parts']:
        n = p['vertices']
        pos = np.frombuffer(buf, np.float32, n * 3, base + p['pos']).reshape(-1, 3)
        nrm = np.frombuffer(buf, np.float32, n * 3, base + p['nrm']).reshape(-1, 3)
        col = np.frombuffer(buf, np.float32, n * 3, base + p['col']).reshape(-1, 3)
        idx = np.frombuffer(buf, np.uint32, p['indices'], base + p['idx']).reshape(-1, 3)
        parts[p['name']] = (pos, nrm, col, idx)
    return parts, h.get('meta', {})


def render(parts, view='front', size=900, box=(-0.11, 0.11, -0.13, 0.2), shade=True, grid=True, names=None):
    x0, x1, y0, y1 = box
    W = size
    H = int(size * (y1 - y0) / (x1 - x0))
    img = np.zeros((H, W, 3)); zb = np.full((H, W), -1e9)
    L = np.array([-0.4, 0.5, 0.75]); L /= np.linalg.norm(L)
    for name, (pos, nrm, col, idx) in parts.items():
        if names and name not in names:
            continue
        if view == 'front':
            P = pos[:, [0, 1]]; Z = pos[:, 2]; Nn = nrm
        elif view == 'side':
            P = np.stack([-pos[:, 2], pos[:, 1]], 1); Z = pos[:, 0]; Nn = nrm[:, [2, 1, 0]] * [1, 1, 1]
        else:  # 34
            a = np.radians(35)
            R = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
            q = pos @ R.T; P = q[:, [0, 1]]; Z = q[:, 2]; Nn = nrm @ R.T
        sx = (P[:, 0] - x0) / (x1 - x0) * W
        sy = (y1 - P[:, 1]) / (y1 - y0) * H
        lam = np.clip(Nn @ L, 0, 1) * 0.8 + 0.2 if shade else np.ones(len(pos))
        c = col * lam[:, None]
        for t in idx:
            xs, ys, zs = sx[t], sy[t], Z[t]
            mnx, mxx = int(max(0, np.floor(xs.min()))), int(min(W - 1, np.ceil(xs.max())))
            mny, mxy = int(max(0, np.floor(ys.min()))), int(min(H - 1, np.ceil(ys.max())))
            if mnx > mxx or mny > mxy:
                continue
            gx, gy = np.meshgrid(np.arange(mnx, mxx + 1) + 0.5, np.arange(mny, mxy + 1) + 0.5)
            d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
            if abs(d) < 1e-12:
                continue
            w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
            w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
            w2 = 1 - w0 - w1
            m = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
            if not m.any():
                continue
            z = w0 * zs[0] + w1 * zs[1] + w2 * zs[2]
            yy, xx = gy[m].astype(int), gx[m].astype(int)
            zz = z[m]
            upd = zz > zb[yy, xx]
            yy, xx, zz = yy[upd], xx[upd], zz[upd]
            ww = np.stack([w0[m][upd], w1[m][upd], w2[m][upd]], 1)
            zb[yy, xx] = zz
            img[yy, xx] = ww @ c[t]
    im = Image.fromarray((np.clip(img, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8))
    if grid:
        dr = ImageDraw.Draw(im)
        for gxv in np.arange(np.ceil(x0 * 100), x1 * 100 + 1e-6) / 100:
            X = (gxv - x0) / (x1 - x0) * W
            dr.line([(X, 0), (X, H)], fill=(255, 0, 0) if abs(gxv) < 1e-6 else (90, 30, 30))
            dr.text((X + 2, 2), f'{gxv * 100:.0f}', fill=(255, 120, 120))
        for gyv in np.arange(np.ceil(y0 * 100), y1 * 100 + 1e-6) / 100:
            Y = (y1 - gyv) / (y1 - y0) * H
            dr.line([(0, Y), (W, Y)], fill=(255, 0, 0) if abs(gyv) < 1e-6 else (30, 30, 90))
            dr.text((2, Y + 2), f'{gyv * 100:.0f}', fill=(120, 120, 255))
    return im


if __name__ == '__main__':
    path, out = sys.argv[1], sys.argv[2]
    view = sys.argv[3] if len(sys.argv) > 3 else 'front'
    box = tuple(float(v) for v in sys.argv[4].split(',')) if len(sys.argv) > 4 else (-0.11, 0.11, -0.13, 0.2)
    grid = (sys.argv[5] != '0') if len(sys.argv) > 5 else True
    parts, meta = load(path)
    render(parts, view, box=box, grid=grid).save(out)
