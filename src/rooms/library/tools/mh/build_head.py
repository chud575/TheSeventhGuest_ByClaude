#!/usr/bin/env python3
"""Builds the library ghost's head ("Mr. Quill", an original elderly scholar).

Pipeline: CC0 MakeHuman base mesh -> our own blend of ageing / gaunt / facial
targets -> head & neck cut -> 2x Catmull-Clark -> sculpted displacement (brow
furrows, crow's feet, nasolabial folds, eye bags, jowls, neck cords, temple
hollows, scalp veins) -> painted vertex colours (flesh variation, liver spots,
under-eye darkness, warm ears/nose/lips) and cavity AO -> eyeballs (sclera, iris,
limbal ring, pupil) + corneas -> hair & brow & lash cards -> headparts.bin, which
tools/genGhost.mjs merges into public/assets/library/ghost.bin.

    python3 src/rooms/library/tools/mh/build_head.py
"""
import json
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import fetch, load_obj, load_target, CACHE  # noqa: E402
from subdiv import catmull_clark, subdivide_attr, tris, vertex_normals, adjacency, smooth  # noqa: E402

OUT = os.path.join(CACHE, 'headparts.bin')
rng = np.random.default_rng(1993)

# ------------------------------------------------------------------ shape recipe
MACRO = {
    # race x age blend for a 100% male figure, ~75 years
    'macrodetails/caucasian-male-old': 0.60, 'macrodetails/caucasian-male-young': 0.20,
    'macrodetails/asian-male-old': 0.075, 'macrodetails/asian-male-young': 0.025,
    'macrodetails/african-male-old': 0.075, 'macrodetails/african-male-young': 0.025,
    'macrodetails/universal-male-old-averagemuscle-minweight': 0.55,
}
FACE = {
    'head/head-age-incr': 0.85, 'head/head-oval': 0.25, 'head/head-rectangular': 0.25, 'head/head-fat-decr': 0.55,
    'head/head-scale-vert-decr': 0.15,
    'forehead/forehead-scale-vert-incr': 0.1, 'forehead/forehead-temple-decr': 0.7,
    'eyebrows/eyebrows-trans-forward': 0.35,
    'eyes/r-eye-bag-incr': 0.6, 'eyes/l-eye-bag-incr': 0.6, 'eyes/r-eye-bag-out': 0.45, 'eyes/l-eye-bag-out': 0.45,
    'eyes/r-eye-eyefold-down': 0.35, 'eyes/l-eye-eyefold-down': 0.35,
    'eyes/r-eye-height2-incr': 0.55, 'eyes/l-eye-height2-incr': 0.55,
    'eyes/r-eye-corner1-down': 0.25, 'eyes/l-eye-corner1-down': 0.25,
    'nose/nose-hump-incr': 0.45, 'nose/nose-point-down': 0.35, 'nose/nose-scale-vert-incr': 0.45,
    'nose/nose-width1-decr': 0.6, 'nose/nose-width2-decr': 0.35, 'nose/nose-point-width-decr': 0.45,
    'nose/nose-nostrils-width-decr': 0.35, 'nose/nose-trans-forward': 0.2, 'nose/nose-greek-incr': 0.3,
    'nose/nose-septumangle-decr': 0.2,
    'mouth/mouth-angles-down': 0.45, 'mouth/mouth-laugh-lines-out': 0.55, 'mouth/mouth-upperlip-volume-decr': 0.35,
    'mouth/mouth-lowerlip-volume-decr': 0.15, 'mouth/mouth-philtrum-volume-incr': 0.7, 'mouth/mouth-cupidsbow-incr': 0.45,
    'mouth/mouth-scale-horiz-incr': 0.2,
    'ears/r-ear-scale-incr': 0.4, 'ears/l-ear-scale-incr': 0.4, 'ears/r-ear-lobe-incr': 0.7, 'ears/l-ear-lobe-incr': 0.7,
    'ears/r-ear-scale-vert-incr': 0.4, 'ears/l-ear-scale-vert-incr': 0.4,
    'chin/chin-prominent-incr': 0.3, 'chin/chin-height-incr': 0.25, 'chin/chin-width-decr': 0.3, 'chin/chin-bones-incr': 0.3,
    'cheek/l-cheek-bones-incr': 0.5, 'cheek/r-cheek-bones-incr': 0.5, 'cheek/l-cheek-inner-decr': 0.6, 'cheek/r-cheek-inner-decr': 0.6,
    'cheek/l-cheek-volume-decr': 0.55, 'cheek/r-cheek-volume-decr': 0.55,
    'neck/neck-double-incr': 0.25, 'neck/neck-scale-horiz-decr': 0.3,
}


def build_base():
    V, VT, F, FT, G = load_obj(fetch('3dobjs/base.obj'))
    V = np.array(V)
    for rel, w in {**MACRO, **FACE}.items():
        idx, d = load_target(rel)
        V[idx] += w * d
    return V, np.array(VT), F, FT, G


def fit_proxy(V, rel_mhclo):
    """MakeHuman .mhclo fitting: each proxy vertex = barycentric of 3 base verts + scaled offset."""
    lines = open(fetch(rel_mhclo)).read().splitlines()
    scale = {}
    rows = []
    inv = False
    for ln in lines:
        p = ln.split()
        if not p or p[0].startswith('#'):
            continue
        if p[0] in ('x_scale', 'y_scale', 'z_scale'):
            a, b, d = int(p[1]), int(p[2]), float(p[3])
            ax = 'xyz'.index(p[0][0])
            scale[ax] = abs(V[a, ax] - V[b, ax]) / d
        elif p[0] == 'verts':
            inv = True
        elif inv and len(p) == 9:
            rows.append([float(x) for x in p])
    R = np.array(rows)
    i = R[:, :3].astype(int)
    w = R[:, 3:6]
    o = R[:, 6:9] * np.array([scale[0], scale[1], scale[2]])
    return (V[i] * w[:, :, None]).sum(1) + o


def fit_sphere(P):
    A = np.c_[2 * P, np.ones(len(P))]
    b = (P ** 2).sum(1)
    c, *_ = np.linalg.lstsq(A, b, rcond=None)
    ctr = c[:3]
    return ctr, np.sqrt(c[3] + (ctr ** 2).sum())


# ------------------------------------------------------------------ sculpt helpers
class Sculptor:
    """Displacement field over a point set P (mesh vertices or baked texels), with curves
    authored in front-view (x, y) and projected onto the front-most mesh surface."""
    def __init__(self, V, N, P=None, PN=None):
        from scipy.spatial import cKDTree
        self.V, self.N = V, N
        self.P = V if P is None else P
        self.PN = N if PN is None else PN
        self.front = np.where((N[:, 2] > 0.0) & (V[:, 1] > -0.075))[0]
        self.tree2 = cKDTree(V[self.front][:, :2])
        self.treeP = cKDTree(self.P)
        self.d = np.zeros(len(self.P))

    def surf(self, xy):
        """Project 2D (x,y) points onto the front-most surface (local plane fit, same layer only)."""
        xy = np.atleast_2d(np.asarray(xy, float))
        _, k = self.tree2.query(xy, k=16)
        Pk = self.V[self.front[k]]                        # (n,16,3)
        zmax = Pk[:, :, 2].max(1, keepdims=True)
        w = (Pk[:, :, 2] > zmax - 0.003).astype(float)
        dx = Pk[:, :, 0] - xy[:, :1]; dy = Pk[:, :, 1] - xy[:, 1:]
        w *= 1.0 / (np.hypot(dx, dy) + 2e-4)
        # weighted plane fit z = a + b dx + c dy
        A = np.stack([np.ones_like(dx), dx, dy], -1) * np.sqrt(w)[..., None]
        bz = Pk[:, :, 2] * np.sqrt(w)
        AtA = np.einsum('nki,nkj->nij', A, A) + np.eye(3) * 1e-12
        Atb = np.einsum('nki,nk->ni', A, bz)
        coef = np.linalg.solve(AtA, Atb[..., None])[..., 0]
        return np.c_[xy, coef[:, 0]]

    def curve(self, pts, n=None):
        from scipy.interpolate import CubicSpline
        pts = np.asarray(pts, float)
        seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
        L = seg.sum()
        n = n or max(8, int(L / 0.0002))
        t = np.linspace(0, 1, n)
        s = np.r_[0, np.cumsum(seg)] / L
        if len(pts) > 2:
            out = CubicSpline(s, pts, bc_type='natural')(t)
        else:
            out = np.stack([np.interp(t, s, pts[:, k]) for k in range(2)], 1)
        return out, t

    def groove(self, pts, depth, width, taper=(0.15, 0.25), bulge=0.0, side=0.0, jitter=0.0, seed=0, wvar=0.0):
        """Crease along a 2D curve projected on the face: depth>0 cuts in, bulge raises its flanks,
        side>0/<0 adds a one-sided overhang (cheek over the nasolabial fold)."""
        from scipy.spatial import cKDTree
        c2, t = self.curve(pts)
        r = np.random.default_rng(seed)
        tg = np.gradient(c2, axis=0)
        tg /= np.maximum(np.linalg.norm(tg, axis=1, keepdims=True), 1e-12)
        nrm2 = np.stack([-tg[:, 1], tg[:, 0]], 1)
        if jitter:
            f1, f2 = r.uniform(1.2, 2.5), r.uniform(3.5, 6.5)
            wob = 0.65 * np.sin(2 * np.pi * f1 * t + r.uniform(0, 6)) + 0.35 * np.sin(2 * np.pi * f2 * t + r.uniform(0, 6))
            c2 = c2 + nrm2 * (wob * jitter)[:, None]
        c3 = self.surf(c2)
        a, b = taper
        tap = np.clip(t / max(a, 1e-6), 0, 1) * np.clip((1 - t) / max(b, 1e-6), 0, 1)
        tap = tap * tap * (3 - 2 * tap)
        # depth breathes along the line
        tap *= 1 - wvar * (0.5 + 0.5 * np.sin(t * r.uniform(8, 16) + r.uniform(0, 6)))
        reach = 4.5 * width + abs(side) * 0 + 2.5 * width * (1 if side else 0)
        lists = self.treeP.query_ball_point(c3, reach)
        cand = np.unique(np.concatenate([np.asarray(i, dtype=np.int64) for i in lists if len(i)] or [np.zeros(0, np.int64)]))
        if not len(cand):
            return
        ct = cKDTree(c3)
        dist, k = ct.query(self.P[cand])
        # only displace surface that faces the same way as the curve's surface (no bleeding through lids/nose)
        cn = self.surf_normals(c3)[k]
        ok = (self.PN[cand] * cn).sum(1) > 0.2
        prof = -depth * np.exp(-(dist / width) ** 2)
        if bulge:
            prof += bulge * np.exp(-((dist - 1.8 * width) / (1.2 * width)) ** 2)
        if side:
            v = self.P[cand][:, :2] - c2[k]
            sg = np.sign(v[:, 0] * tg[k, 1] - v[:, 1] * tg[k, 0])
            prof += np.where(sg * np.sign(side) > 0, abs(side) * np.exp(-((dist - 2.0 * width) / (1.5 * width)) ** 2), 0)
        self.d[cand] += prof * tap[k] * ok

    def surf_normals(self, c3):
        from scipy.spatial import cKDTree
        if not hasattr(self, '_vt'):
            self._vt = cKDTree(self.V)
        _, k = self._vt.query(c3)
        return self.N[k]

    def blob(self, c, radius, amount, aspect=(1, 1, 1)):
        c = np.asarray(c, float)
        if len(c) == 2:
            c = self.surf([c])[0]
        q = (self.P - c) / (np.array(aspect) * radius)
        self.d += amount * np.exp(-(q ** 2).sum(1) * 2.0)


def vnoise(P, freq, seed=0):
    """Smooth 3D value noise (numpy, trilinear with smoothstep)."""
    r = np.random.default_rng(seed)
    perm = r.integers(0, 1 << 30, 4096)
    X = P * freq
    i = np.floor(X).astype(np.int64); f = X - i
    f = f * f * (3 - 2 * f)
    def h(a, b, c):
        return (perm[(a * 73856093 ^ b * 19349663 ^ c * 83492791) & 4095] & 0xffff) / 65535.0
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dz else 1 - f[:, 2])
                out = out + w * h(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz)
    return out


def fbm(P, freq, octaves=4, seed=0):
    s, a, n = 0, 0.5, 0
    for o in range(octaves):
        s = s + a * vnoise(P, freq * 2.03 ** o, seed + o); n += a; a *= 0.5
    return s / n


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def main():
    V, VT, F, FT, G = build_base()
    # eye centres from the joint helpers (move with the targets)
    eyes = {}
    for side, name in ((1, 'joint-l-eye'), (-1, 'joint-r-eye')):
        idx = sorted({i for f, g in zip(F, G) if g == name for i in f})
        eyes[side] = V[idx].mean(0)
    # to ghost space (metres; origin at the jaw line, eyes at y=0.07, z=0.077)
    S = 0.0315 / eyes[1][0]
    ec = (eyes[1] + eyes[-1]) / 2
    off = np.array([0.0, 0.07, 0.077]) - ec * S
    Vg = V * S + off
    # eyeballs fitted from the CC0 eye proxy
    EP = fit_proxy(V, 'eyes/high-poly/high-poly.mhclo') * S + off
    eyeFit = {}
    for sgn in (1, -1):
        P = EP[np.sign(EP[:, 0]) == sgn]
        eyeFit[sgn] = fit_sphere(P)
    print('eyes', {k: (v[0].round(4).tolist(), round(v[1], 4)) for k, v in eyeFit.items()})
    # head & neck cut: everything above the stock, minus the shoulders
    def keep(i):
        x, y, z = Vg[i]
        return y > -0.135 and (y > -0.066 or np.hypot(x, z + 0.01) < 0.075)
    Q = np.array([f for f, g in zip(F, G) if g == 'body' and all(keep(i) for i in f)])
    used = np.unique(Q)
    remap = -np.ones(len(V), dtype=np.int64)
    remap[used] = np.arange(len(used))
    Vh, Qh = Vg[used].copy(), remap[Q]
    # ---- authored proportion changes (before subdivision, so they stay smooth)
    y = Vh[:, 1]
    # a lower, broader crown: compress the dome above the brow, widen the parietal bulge a touch
    k = sstep(0.095, 0.2, y)
    Vh[:, 1] = np.where(y > 0.095, 0.095 + (y - 0.095) * (1 - 0.1 * k), y)
    Vh[:, 0] *= 1 - 0.03 * sstep(0.09, 0.15, Vh[:, 1]) * sstep(-0.02, 0.04, -Vh[:, 2])
    # subdivide twice
    for _ in range(2):
        Vh, Qh, _e = catmull_clark(Vh, Qh)
    T = tris(Qh)
    N = vertex_normals(Vh, T)
    print('subdivided', len(Vh), 'verts', len(T), 'tris')
    A = adjacency(len(Vh), T)
    # ---- sculpted ageing: broad folds in the geometry
    sc = Sculptor(Vh, N)
    sculpt_macro(sc)
    Vh = Vh + N * sc.d[:, None]
    N = vertex_normals(Vh, T)
    # ---- cavity AO (multi-scale concavity)
    cav = np.zeros(len(Vh))
    for it, wgt in ((3, 1.0), (12, 0.7), (40, 0.5)):
        Sm = smooth(Vh, A, it, 0.6)
        cav += wgt * ((Sm - Vh) * N).sum(1)
    print("cav percentiles", np.percentile(cav, [1, 5, 25, 50, 75, 95, 99]))
    col = paint(Vh, N, cav)
    # ---- cylindrical UVs (seam at the back of the skull) + baked fine detail
    Vh, N, col, T, UV = cyl_uv(Vh, N, col, T)
    if '--nobake' not in sys.argv:
        bake_detail(Vh, N, T, UV)
    parts = [dict(name='head', pos=Vh, nrm=N, col=col, idx=T, uv=UV)]
    meta = {'eyes': {}}
    for sgn, nm in ((1, 'L'), (-1, 'R')):
        ctr, r = eyeFit[sgn]
        eb, co = eyeball(r)
        parts.append(dict(name='eye' + nm, **eb))
        parts.append(dict(name='cornea' + nm, **co))
        meta['eyes'][nm] = {'c': ctr.tolist(), 'r': float(r)}
    hair_parts(parts, Vh, N, T, eyeFit)
    write(parts, meta)


AXIS = np.array([0.0, -0.012])   # (x, z) of the cylinder axis
YR = (-0.14, 0.2)                # v range


def cyl_uv(V, N, col, T):
    u = np.arctan2(V[:, 0] - AXIS[0], V[:, 2] - AXIS[1]) / (2 * np.pi) + 0.5
    v = (V[:, 1] - YR[0]) / (YR[1] - YR[0])
    UV = np.stack([u, v], 1)
    tu = u[T]
    cross = (tu.max(1) - tu.min(1)) > 0.5
    dup = {}
    T = T.copy()
    newV, newN, newC, newUV = [], [], [], []
    nv = len(V)
    for ti in np.where(cross)[0]:
        for k in range(3):
            i = T[ti, k]
            if u[i] < 0.5:
                if i not in dup:
                    dup[i] = nv + len(newV)
                    newV.append(V[i]); newN.append(N[i]); newC.append(col[i]); newUV.append([u[i] + 1, v[i]])
                T[ti, k] = dup[i]
    if newV:
        V = np.r_[V, newV]; N = np.r_[N, newN]; col = np.r_[col, newC]; UV = np.r_[UV, newUV]
    return V, N, col, T, UV


TEX = 2048


def raster_uv(V, N, T, UV, W):
    """Rasterise the mesh into UV space: per-texel 3D position + normal (outermost wins)."""
    Pm = np.zeros((W, W, 3), np.float32); Nm = np.zeros((W, W, 3), np.float32)
    zb = np.full((W, W), -1.0, np.float32)
    rad = np.hypot(V[:, 0] - AXIS[0], V[:, 2] - AXIS[1])
    su = UV[:, 0] * W; sv = (1 - UV[:, 1]) * W
    for t in T:
        xs, ys = su[t], sv[t]
        mnx, mxx = int(np.floor(xs.min())), int(np.ceil(xs.max()))
        mny, mxy = max(0, int(np.floor(ys.min()))), min(W - 1, int(np.ceil(ys.max())))
        if mny > mxy:
            continue
        gx, gy = np.meshgrid(np.arange(mnx, mxx + 1) + 0.5, np.arange(mny, mxy + 1) + 0.5)
        d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(d) < 1e-12:
            continue
        w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
        w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
        w2 = 1 - w0 - w1
        m = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
        if not m.any():
            continue
        ww = np.stack([w0[m], w1[m], w2[m]], 1)
        r = ww @ rad[t]
        xx = gx[m].astype(int) % W; yy = gy[m].astype(int)
        upd = r > zb[yy, xx]
        xx, yy, ww, r = xx[upd], yy[upd], ww[upd], r[upd]
        zb[yy, xx] = r
        Pm[yy, xx] = ww @ V[t]
        nn = ww @ N[t]
        Nm[yy, xx] = nn / np.maximum(np.linalg.norm(nn, axis=1, keepdims=True), 1e-9)
    return Pm, Nm, zb >= 0


def bake_detail(V, N, T, UV):
    from PIL import Image
    from scipy import ndimage
    from scipy.spatial import cKDTree
    W = TEX
    Pm, Nm, valid = raster_uv(V, N, T, UV, W)
    print('baked texels', int(valid.sum()))
    idx = np.where(valid.ravel())[0]
    P = Pm.reshape(-1, 3)[idx].astype(np.float64)
    PN = Nm.reshape(-1, 3)[idx].astype(np.float64)
    sc = Sculptor(V, N, P, PN)
    sculpt_fine(sc)
    h = sc.d.copy()
    # pores & fine skin grain, stronger on nose and cheeks
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    nose = np.exp(-((x / 0.02) ** 2 + ((y - 0.03) / 0.03) ** 2)) * (z > 0.08)
    cheek = np.exp(-(((np.abs(x) - 0.04) / 0.022) ** 2 + ((y - 0.03) / 0.025) ** 2))
    pore_amt = 0.00002 + 0.00004 * np.clip(nose + cheek, 0, 1)
    h += (fbm(P, 2600, 2, 21) - 0.5) * 2 * pore_amt
    h += (fbm(P, 900, 2, 22) - 0.5) * 0.00005
    # crepey crosshatch on the lids and neck
    lids = np.exp(-(((np.abs(x) - 0.032) / 0.02) ** 2 + ((y - 0.068) / 0.016) ** 2))
    neck = sstep(-0.03, -0.06, y)
    hatch = np.sin(x * 4200 + 300 * np.sin(y * 700)) * np.sin(y * 3800 + 260 * np.sin(x * 900))
    h += hatch * 0.00002 * np.clip(lids + neck, 0, 1)
    HR = 0.0006   # height map (0.5 = none) spans +-0.6 mm
    hm = np.full(W * W, 0.5, np.float32)
    hm[idx] = np.clip(0.5 + h / (2 * HR), 0, 1)
    hm = hm.reshape(W, W)
    # albedo multiplier: creases darken & redden, freckles, broken capillaries
    am = np.ones((W * W, 3), np.float32) * 0.92
    a = np.ones((len(idx), 3)) * 0.92
    crease = np.clip(-sc.d / 0.0004, 0, 1)
    a *= (1 - 0.12 * crease)[:, None]
    a[:, 1] *= 1 - 0.05 * crease; a[:, 2] *= 1 - 0.04 * crease
    r = np.random.default_rng(17)
    tr = sc.treeP
    for i in range(450):
        c = P[r.integers(0, len(P))]
        if c[1] < -0.02:
            continue
        rad = r.uniform(0.0004, 0.0012) * (1.6 if c[1] > 0.11 else 1)
        ii = tr.query_ball_point(c, rad * 2.5)
        if not ii:
            continue
        ii = np.asarray(ii)
        f = np.exp(-((P[ii] - c) ** 2).sum(1) / (rad * rad)) * r.uniform(0.08, 0.3)
        a[ii] *= (1 - f[:, None] * np.array([0.25, 0.4, 0.55]))
    for i in range(70):
        s_ = r.choice([-1, 1])
        c0 = np.array([s_ * r.uniform(0.008, 0.05), r.uniform(0.01, 0.045)])
        pts = [c0]
        for k in range(5):
            pts.append(pts[-1] + r.normal(0, 0.0018, 2))
        c2, t = sc.curve(np.array(pts))
        c3 = sc.surf(c2)
        lists = tr.query_ball_point(c3, 0.0004)
        ii = np.unique(np.concatenate([np.asarray(l, np.int64) for l in lists if len(l)] or [np.zeros(0, np.int64)]))
        if not len(ii):
            continue
        dd, _ = cKDTree(c3).query(P[ii])
        f = np.exp(-(dd / 0.00012) ** 2) * r.uniform(0.25, 0.6)
        a[ii] *= 1 - f[:, None] * np.array([0.05, 0.35, 0.3])
    a *= (0.96 + 0.08 * fbm(P, 700, 2, 23))[:, None]
    am[idx] = np.clip(a, 0, 1)
    am = am.reshape(W, W, 3)
    # dilate into the gutters so mips don't bleed
    _, (iy, ix) = ndimage.distance_transform_edt(~valid, return_indices=True)
    hm = hm[iy, ix]; am = am[iy, ix]
    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../public/assets/library')
    Image.fromarray((hm * 255 + 0.5).astype(np.uint8), 'L').save(os.path.join(outdir, 'ghost_skin_h.png'), optimize=True)
    Image.fromarray((am * 255 + 0.5).astype(np.uint8), 'RGB').save(os.path.join(outdir, 'ghost_skin_c.jpg'), quality=90)
    print('wrote skin maps')


def sculpt_macro(sc):
    """Broad folds that the ~1 mm vertex spacing can carry."""
    for s in (1, -1):
        sd = 7 if s > 0 else 11
        # nasolabial fold with the cheek overhanging it
        sc.groove([[s * 0.0165, 0.025], [s * 0.022, 0.012], [s * 0.029, -0.002], [s * 0.034, -0.014], [s * 0.036, -0.026]], 0.0012, 0.0022, (0.08, 0.3), side=s * 0.0008, seed=50 + sd)
        # marionette lines from the mouth corners
        sc.groove([[s * 0.028, -0.017], [s * 0.031, -0.03], [s * 0.034, -0.045]], 0.0007, 0.002, (0.1, 0.4), side=s * 0.0004, seed=60 + sd)
        # tear trough
        sc.groove([[s * 0.014, 0.062], [s * 0.022, 0.054], [s * 0.034, 0.052], [s * 0.046, 0.056]], 0.0006, 0.0025, (0.2, 0.3), bulge=0.0002, seed=30 + sd)
        # hooded upper lid fold
        sc.groove([[s * 0.014, 0.0778], [s * 0.026, 0.0815], [s * 0.04, 0.081], [s * 0.052, 0.0765]], 0.0004, 0.0016, (0.15, 0.2), seed=40 + sd)
        # gaunt cheek hollow, temple hollow, jowl
        sc.blob([s * 0.046, 0.02], 0.016, -0.0016)
        sc.blob([s * 0.065, 0.093], 0.014, -0.0011)
        sc.blob([s * 0.04, -0.038], 0.012, 0.0012)
        # a raised temporal vein
        sc.groove([[s * 0.069, 0.078], [s * 0.067, 0.092], [s * 0.061, 0.104], [s * 0.059, 0.118]], -0.0003, 0.0011, (0.2, 0.3), jitter=0.0015, seed=70 + sd)
        # neck cords
        sc.groove([[s * 0.013, -0.055], [s * 0.016, -0.085], [s * 0.02, -0.12]], -0.0009, 0.0025, (0.2, 0.2), seed=140 + s)
    # mentolabial sulcus
    sc.groove([[-0.014, -0.03], [0, -0.0325], [0.014, -0.03]], 0.0006, 0.0024, (0.3, 0.3), seed=130)
    # philtrum columns
    for s in (1, -1):
        sc.groove([[s * 0.0042, 0.006], [s * 0.0048, -0.002], [s * 0.0055, -0.0085]], -0.00035, 0.0011, (0.2, 0.15), seed=135 + s)
    # broad frontal furrow undulation (the fine lines are in the bump map)
    for k3, y0 in enumerate((0.106, 0.119, 0.132)):
        sc.groove([[-0.045, y0 + 0.002], [-0.02, y0 + 0.0035], [0, y0], [0.02, y0 + 0.0035], [0.045, y0 + 0.002]], 0.00035, 0.0022, (0.2, 0.2), seed=82 + k3)
    n = fbm(sc.P, 60, 3, 5) - 0.5
    sc.d += n * 0.0004


def sculpt_fine(sc):
    """Fine lines for the bump map (0.2 mm texels)."""
    E = 0.0315
    for s in (1, -1):
        sd = 7 if s > 0 else 11
        # crow's feet: a fan from the outer canthus
        for j, ang in enumerate((-40, -27, -14, -2, 10, 22, 34)):
            a = np.radians(ang)
            L = 0.009 + 0.005 * ((j * 7 + sd) % 3) / 2
            p0 = np.array([s * 0.0545, 0.0705]) + np.array([s * np.cos(a), np.sin(a)]) * 0.0025
            p1 = p0 + np.array([s * np.cos(a), np.sin(a)]) * L * 0.55 + np.array([0, -0.0005])
            p2 = p0 + np.array([s * np.cos(a * 1.15), np.sin(a * 1.15)]) * L
            sc.groove([p0, p1, p2], 0.00026, 0.00035, (0.1, 0.5), bulge=0.00005, jitter=0.0003, seed=sd + j, wvar=0.3)
        # lower-lid lines
        for k2, (dy, w, dep) in enumerate(((0.0105, 0.015, 0.00018), (0.0145, 0.017, 0.00024), (0.0195, 0.017, 0.00018), (0.026, 0.014, 0.00014))):
            cx = s * (E + 0.002)
            sc.groove([[cx - s * w, 0.071 - dy + 0.004], [cx - s * w * 0.3, 0.07 - dy], [cx + s * w * 0.4, 0.0702 - dy], [cx + s * w, 0.0712 - dy + 0.005]], dep, 0.0004, (0.2, 0.25), bulge=0.00005, jitter=0.0003, seed=30 + k2 + sd, wvar=0.4)
        # fine lid creases
        for k2 in range(3):
            sc.groove([[s * 0.016, 0.0795 + k2 * 0.0018], [s * 0.028, 0.0832 + k2 * 0.0018], [s * 0.042, 0.0828 + k2 * 0.0016], [s * 0.05, 0.079 + k2 * 0.001]], 0.00012, 0.0003, (0.2, 0.2), jitter=0.0002, seed=45 + k2 + sd)
        # cheek: a few diagonal crumple lines
        for k2 in range(4):
            x0 = s * (0.04 + k2 * 0.004)
            sc.groove([[x0, 0.045 - k2 * 0.002], [x0 + s * 0.006, 0.036 - k2 * 0.003], [x0 + s * 0.01, 0.028 - k2 * 0.003]], 0.00014, 0.0004, (0.3, 0.3), jitter=0.0004, seed=55 + k2 + sd, wvar=0.4)
        # ear-front vertical creases
        sc.groove([[s * 0.064, 0.05], [s * 0.065, 0.035], [s * 0.066, 0.02]], 0.00018, 0.0005, (0.3, 0.3), seed=66 + sd)
    # forehead: broken, wavy furrows arching over each brow
    for k3, y0 in enumerate((0.1, 0.1065, 0.113, 0.12, 0.1265, 0.134, 0.141)):
        for seg, (xa, xb) in enumerate(((-0.052, -0.004), (-0.015, 0.017), (0.006, 0.052))):
            if (k3 * 2 + seg) % 5 == 4:
                continue
            xs = np.linspace(xa, xb, 7)
            ys = y0 + 0.0028 * np.cos(xs / 0.026 * np.pi * 0.5) ** 2 * (np.abs(xs) > 0.008) - 0.0012 * (np.abs(xs) < 0.01) + 0.0008 * np.sin(xs * 70 + k3 * 2.1)
            dep = (0.00034 if k3 % 2 == 0 else 0.0002) * (1 - 0.08 * k3)
            sc.groove(np.stack([xs, ys], 1), dep, 0.00048, (0.2, 0.2), bulge=0.00006, jitter=0.0003, seed=80 + k3 * 3 + seg, wvar=0.45)
    # glabellar "11" lines and the procerus fold
    for s in (1, -1):
        sc.groove([[s * 0.0042, 0.08], [s * 0.0056, 0.09], [s * 0.005, 0.099]], 0.00045, 0.00042, (0.2, 0.3), jitter=0.0002, seed=90 + s)
    sc.groove([[-0.009, 0.0772], [0, 0.0765], [0.009, 0.0772]], 0.00025, 0.0005, (0.25, 0.25), seed=95)
    # upper-lip vertical lines and lip vermilion texture
    r = np.random.default_rng(4)
    for j, x in enumerate(np.linspace(-0.018, 0.018, 13)):
        if abs(x) < 0.002:
            continue
        x += r.uniform(-0.0008, 0.0008)
        sc.groove([[x, -0.0098], [x * 1.05, -0.005], [x * 1.1, -0.001 + r.uniform(-0.002, 0.002)]], 0.00012, 0.00022, (0.05, 0.5), jitter=0.00015, seed=100 + j)
    for j, x in enumerate(np.linspace(-0.021, 0.021, 26)):
        sc.groove([[x, -0.0158], [x * 1.02, -0.0205]], 0.00006, 0.00016, (0.3, 0.3), seed=120 + j)
    for j, x in enumerate(np.linspace(-0.02, 0.02, 20)):
        sc.groove([[x, -0.0098], [x * 1.01, -0.0128]], 0.00005, 0.00014, (0.3, 0.3), seed=160 + j)
    # neck rings
    for j, y0 in enumerate((-0.062, -0.07, -0.079, -0.09)):
        sc.groove([[-0.04, y0 + 0.005], [0, y0], [0.04, y0 + 0.005]], 0.0002, 0.0005, (0.2, 0.2), jitter=0.001, seed=150 + j, wvar=0.5)


def paint(V, N, cav):
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    ax = np.abs(x)
    base = np.array([0.79, 0.67, 0.61])
    col = np.tile(base, (len(V), 1))
    def tint(mask, c, amt=1.0):
        m = (np.clip(mask, 0, 1) * amt)[:, None]
        col[:] = col * (1 - m) + np.array(c) * m
    blobd = lambda cx, cy, cz, r: np.exp(-((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) / (r * r))
    # mottling
    mot = fbm(V, 60, 4, 11)
    col *= (0.93 + 0.14 * mot)[:, None]
    tint(fbm(V, 25, 3, 12) - 0.35, [0.82, 0.6, 0.56], 0.35)
    # warm, thin-skinned ears, nose and cheek apples
    tint(sstep(0.06, 0.075, ax) * sstep(-0.02, 0.01, y) * (1 - sstep(0.1, 0.11, y)), [0.86, 0.58, 0.52], 0.6)
    tint(blobd(0, 0.017, 0.12, 0.012) + blobd(0.014, 0.018, 0.105, 0.007) + blobd(-0.014, 0.018, 0.105, 0.007), [0.86, 0.56, 0.5], 0.55)
    tint(blobd(0.042, 0.04, 0.085, 0.014) + blobd(-0.042, 0.04, 0.085, 0.014), [0.84, 0.6, 0.55], 0.3)
    # lips: pale, slightly mauve
    lip = sstep(0.026, 0.018, ax) * sstep(-0.024, -0.017, y) * sstep(-0.002, -0.007, y) * sstep(0.08, 0.09, z)
    tint(lip, [0.66, 0.46, 0.46], 0.7)
    # under-eye darkness and lids
    for s in (1, -1):
        tint(np.exp(-(((x - s * 0.031) / 0.017) ** 2 + ((y - 0.058) / 0.0075) ** 2)), [0.6, 0.48, 0.5], 0.55)
        tint(np.exp(-(((x - s * 0.031) / 0.018) ** 2 + ((y - 0.078) / 0.005) ** 2)), [0.7, 0.55, 0.55], 0.4)
    # beard shadow (shaved, grey-blue) on jaw, chin, upper lip
    beard = sstep(0.0, -0.02, y) * sstep(-0.075, -0.05, y) * sstep(0.03, 0.06, z) + sstep(0.012, 0.004, y) * sstep(-0.006, -0.002, y) * sstep(0.022, 0.012, ax) * 0
    beard += sstep(-0.004, 0.006, y) * sstep(0.012, 0.004, y) * sstep(0.024, 0.012, ax)
    tint(beard * (0.5 + 0.5 * fbm(V, 400, 2, 13)), [0.62, 0.6, 0.62], 0.35)
    # scalp: paler, yellowed, with liver spots and age freckles
    scalp = sstep(0.1, 0.13, y)
    tint(scalp, [0.84, 0.74, 0.65], 0.45)
    r = np.random.default_rng(7)
    for i in range(40):
        th = r.uniform(-1.3, 1.3); ph = r.uniform(0.15, 1.2)
        cdir = np.array([np.sin(th) * np.cos(ph), 0.02 + np.sin(ph), np.cos(th) * np.cos(ph)])
        cdir /= np.linalg.norm(cdir)
        c = np.array([0, 0.085, -0.01]) + cdir * 0.11
        rad = r.uniform(0.0015, 0.0055)
        d2 = ((V - c) ** 2).sum(1)
        tint(np.exp(-d2 / (rad * rad)) * r.uniform(0.35, 0.8), [0.6, 0.45, 0.34], 1.0)
    for i in range(160):
        c = V[r.integers(0, len(V))]
        if c[2] < 0.0 or c[1] < -0.04:
            continue
        rad = r.uniform(0.0006, 0.0014)
        tint(np.exp(-((V - c) ** 2).sum(1) / (rad * rad)) * r.uniform(0.2, 0.5), [0.62, 0.48, 0.38], 1.0)
    # mouth interior and nostrils very dark; cavities darker
    inner = sstep(0.028, 0.02, ax) * sstep(-0.03, -0.022, y) * sstep(0.0, -0.006, y) * (N[:, 2] < 0.2) * sstep(0.095, 0.085, z)
    tint(inner, [0.08, 0.03, 0.03], 1.0)
    # cav > 0 = concave (the smoothed surface lies outside): folds darken, ridges lift slightly
    ao = np.clip(1 - 160 * np.maximum(cav, 0) + 25 * np.maximum(-cav, 0), 0.45, 1.05)
    col *= ao[:, None]
    # creases also redden slightly (blood pools in folds)
    tint(np.clip(cav * 300, 0, 1), [0.6, 0.4, 0.38], 0.25)
    return col


def eyeball(r):
    """Eyeball (centred at origin, looking down +Z) with flattened iris + separate cornea dome."""
    nu, nv = 96, 64
    th = np.linspace(0, np.pi, nv)            # angle from the forward axis
    ph = np.linspace(0, 2 * np.pi, nu, endpoint=False)
    TH, PH = np.meshgrid(th, ph, indexing='ij')
    lim = np.radians(21.5)
    pup = np.radians(6.2)
    # iris sits on a plane slightly behind the limbus
    rr = np.where(TH < lim, r * np.sin(TH), r * np.sin(TH))
    zz = np.where(TH < lim, r * np.cos(lim) - 0.0004 * (1 - TH / lim) * 0 + 0.0002 * np.cos(TH / lim * np.pi / 2), r * np.cos(TH))
    P = np.stack([rr * np.cos(PH), rr * np.sin(PH), zz], -1).reshape(-1, 3)
    Nn = np.stack([np.sin(TH) * np.cos(PH), np.sin(TH) * np.sin(PH), np.cos(TH)], -1).reshape(-1, 3)
    Nn[(TH < lim).ravel()] = [0, 0, 1]
    t = TH.ravel(); p = PH.ravel()
    rng = np.random.default_rng(3)
    # sclera: old, faintly yellowed, pink and veined toward the corners
    col = np.tile([0.86, 0.82, 0.76], (len(P), 1))
    veins = np.zeros(len(P))
    for k in range(26):
        a0 = rng.uniform(0, 2 * np.pi)
        wig = a0 + 0.12 * np.sin(t * rng.uniform(6, 14) + rng.uniform(0, 6))
        dd = np.abs(np.angle(np.exp(1j * (p - wig))))
        veins += np.exp(-(dd / 0.015) ** 2) * sstep(np.radians(40), np.radians(85), t)
    side = np.abs(np.cos(p)) ** 2
    col = col * (1 - 0.25 * side[:, None] * sstep(np.radians(35), np.radians(80), t)[:, None]) + np.array([0.18, 0.05, 0.04]) * (side * sstep(np.radians(40), np.radians(85), t))[:, None]
    col = col * (1 - np.clip(veins, 0, 1)[:, None] * 0.4) + np.array([0.5, 0.1, 0.1]) * np.clip(veins, 0, 1)[:, None] * 0.4
    # iris: pale watery grey-blue with radial fibres, a darker collarette and limbal ring
    ir = t / lim
    fib = 0.5 + 0.5 * np.sin(p * 47 + 3 * np.sin(p * 9)) * np.sin(p * 23 + 1.3)
    icol = np.array([0.5, 0.55, 0.58]) * (0.72 + 0.38 * fib)[:, None]
    icol = icol * (1 - 0.35 * np.exp(-((ir - 0.45) / 0.08) ** 2))[:, None] + np.array([0.55, 0.48, 0.36]) * (0.35 * np.exp(-((ir - 0.36) / 0.07) ** 2))[:, None]
    icol *= (1 - 0.6 * sstep(0.82, 1.0, ir))[:, None]
    m = t < lim
    col[m] = icol[m]
    # soft limbal blend onto the sclera
    lb = np.exp(-((t - lim) / np.radians(3)) ** 2)
    col = col * (1 - 0.55 * lb[:, None]) + np.array([0.12, 0.13, 0.15]) * (0.55 * lb[:, None])
    col[t < pup] = [0.015, 0.015, 0.02]
    pb = np.exp(-((t - pup) / np.radians(1.2)) ** 2)
    col = col * (1 - 0.6 * pb[:, None])
    idx = []
    for i in range(nv - 1):
        for j in range(nu):
            a = i * nu + j; b = i * nu + (j + 1) % nu; c = (i + 1) * nu + (j + 1) % nu; d = (i + 1) * nu + j
            idx += [a, d, c, a, c, b]
    eb = dict(pos=P, nrm=Nn, col=col, idx=np.array(idx).reshape(-1, 3))
    # cornea: a dome (radius ~0.66 r) meeting the sclera at the limbus, with a little sclera shell around it
    rc = 0.64 * r
    a_l = r * np.sin(lim)
    zc = r * np.cos(lim) - np.sqrt(rc * rc - a_l * a_l)
    th2 = np.linspace(0, np.arcsin(a_l / rc), 20)
    TH2, PH2 = np.meshgrid(th2, ph, indexing='ij')
    P2 = np.stack([rc * np.sin(TH2) * np.cos(PH2), rc * np.sin(TH2) * np.sin(PH2), zc + rc * np.cos(TH2)], -1).reshape(-1, 3)
    N2 = np.stack([np.sin(TH2) * np.cos(PH2), np.sin(TH2) * np.sin(PH2), np.cos(TH2)], -1).reshape(-1, 3)
    # extend as a thin wet film over the visible sclera
    th3 = np.linspace(lim, np.radians(75), 14)[1:]
    TH3, PH3 = np.meshgrid(th3, ph, indexing='ij')
    rf = r * 1.012
    P3 = np.stack([rf * np.sin(TH3) * np.cos(PH3), rf * np.sin(TH3) * np.sin(PH3), rf * np.cos(TH3)], -1).reshape(-1, 3)
    N3 = np.stack([np.sin(TH3) * np.cos(PH3), np.sin(TH3) * np.sin(PH3), np.cos(TH3)], -1).reshape(-1, 3)
    P2 = np.r_[P2, P3]; N2 = np.r_[N2, N3]
    rows = 20 + len(th3)
    idx = []
    for i in range(rows - 1):
        for j in range(nu):
            a = i * nu + j; b = i * nu + (j + 1) % nu; c = (i + 1) * nu + (j + 1) % nu; d = (i + 1) * nu + j
            idx += [a, d, c, a, c, b]
    co = dict(pos=P2, nrm=N2, col=np.ones((len(P2), 3)), idx=np.array(idx).reshape(-1, 3))
    return eb, co


def hair_texture(path):
    """4-variant strand atlas (RGBA, v=0 root -> v=1 tip): fine white/grey strands, tapered and fading."""
    from PIL import Image
    W, H = 512, 1024
    img = np.zeros((H, W, 4), np.float32)
    r = np.random.default_rng(12)
    yy = np.arange(H)[:, None] / H
    for var in range(4):
        x0 = var * 128
        n = (70, 40, 11, 5)[var]
        for k in range(n):
            cx = r.uniform(10, 118)
            amp = r.uniform(1, 6); fr = r.uniform(0.6, 2.2); ph = r.uniform(0, 6)
            drift = r.uniform(-14, 14)
            xs = cx + drift * yy[:, 0] ** 1.5 + amp * np.sin(yy[:, 0] * fr * 6.28 + ph)
            wid = (2.4, 2.6, 6.5, 9.0)[var] * (1 - 0.6 * yy[:, 0]) + 0.5
            end = r.uniform(0.55, 1.0)
            gx = np.arange(128)[None, :]
            d = np.abs(gx - xs[:, None]) / wid[:, None]
            a = np.clip(1.15 - d, 0, 1) ** 1.5
            a *= (1 - sstep(end - 0.25, end, yy)) * sstep(0.0, 0.03, yy)
            a *= 0.75 + 0.25 * np.sin(yy * r.uniform(30, 60) + ph)
            g = r.uniform(0.72, 1.0)
            tone = np.array([g, g * 0.985, g * 0.96])
            sl = img[:, x0:x0 + 128]
            prev = sl[..., 3:4]
            aa = a[..., None]
            sl[..., :3] = sl[..., :3] * (1 - aa) + tone * aa
            sl[..., 3:4] = 1 - (1 - prev) * (1 - aa)
    # un-premultiplied colour bleed so filtering doesn't darken edges
    col = img[..., :3]
    m = img[..., 3] > 0.01
    if m.any():
        mean = col[m].mean(0)
        col[~m] = mean
    out = np.concatenate([np.clip(col, 0, 1), np.clip(img[..., 3:4], 0, 1)], -1)
    Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA').save(path, optimize=True)


class Strands:
    def __init__(self, V, N):
        from scipy.spatial import cKDTree
        self.V, self.N = V, N
        self.tree = cKDTree(V)
        self.P, self.UV, self.C, self.NR, self.I = [], [], [], [], []
        self.nv = 0

    def sd(self, p):
        _, k = self.tree.query(p)
        return ((p - self.V[k]) * self.N[k]).sum(-1), self.N[k]

    def card(self, root, d0, length, width, lift0, lift1, variant, gravity=0.0, curl=0.0, segs=7, rng=None, tone=1.0, flat_normal=None, wave=0.0):
        """Grow one card from root along d0, hugging the surface at lift0 -> lift1."""
        rng = rng or np.random.default_rng(0)
        _, n0 = self.sd(root[None])
        n0 = n0[0]
        pts = [root + n0 * lift0]
        d = d0 - n0 * (d0 @ n0)
        d /= np.linalg.norm(d)
        step = length / segs
        sidev = np.cross(d, n0); sidev /= np.linalg.norm(sidev)
        for i in range(segs):
            t = (i + 1) / segs
            d = d + np.array([0, -gravity, 0]) * step * 40 + sidev * curl * step * 40 + rng.normal(0, wave, 3)
            d /= np.linalg.norm(d)
            p = pts[-1] + d * step
            dist, n = self.sd(p[None])
            want = lift0 + (lift1 - lift0) * t
            p = p + n[0] * (want - dist[0])
            d = p - pts[-1]; d /= np.linalg.norm(d)
            pts.append(p)
        pts = np.array(pts)
        u0 = variant / 4 + 0.004; u1 = (variant + 1) / 4 - 0.004
        base = self.nv
        for i, p in enumerate(pts):
            t = i / segs
            tg = pts[min(i + 1, segs)] - pts[max(i - 1, 0)]; tg /= np.linalg.norm(tg)
            _, n = self.sd(p[None]); n = n[0]
            b = np.cross(tg, n); b /= max(np.linalg.norm(b), 1e-9)
            w = width * (1 - 0.35 * t)
            for sgn, u in ((-1, u0), (1, u1)):
                self.P.append(p + b * w * 0.5 * sgn)
                self.UV.append([u, t])
                self.C.append(np.array([tone, tone, tone]) * (0.6 + 0.4 * min(1, t * 3)))
                self.NR.append(n)
            if i < segs:
                a = base + 2 * i
                self.I += [[a, a + 1, a + 3], [a, a + 3, a + 2]]
        self.nv += 2 * (segs + 1)

    def part(self, name):
        p = dict(name=name, pos=np.array(self.P), nrm=np.array(self.NR), col=np.array(self.C), idx=np.array(self.I, dtype=np.int64), uv=np.array(self.UV))
        self.P, self.UV, self.C, self.NR, self.I = [], [], [], [], []
        self.nv = 0
        return p


def hair_parts(parts, V, N, T, eyeFit):
    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../public/assets/library')
    hair_texture(os.path.join(outdir, 'ghost_hair.png'))
    st = Strands(V, N)
    r = np.random.default_rng(21)
    # ---- the fringe: a thin white horseshoe from temple to temple round the back
    th = np.degrees(np.arctan2(V[:, 0], V[:, 2] + 0.012))      # 0 = front
    ath = np.abs(th)
    y, z = V[:, 1], V[:, 2]
    ear = (np.abs(V[:, 0]) > 0.055) & (y > -0.005) & (y < 0.095) & (z > -0.04) & (z < 0.012)
    top = np.where(ath < 100, 0.128 - 0.01 * (ath - 70) / 30, 0.118 - 0.012 * (ath - 100) / 80)
    bot = np.where(ath < 105, 0.098, 0.098 - 0.07 * sstep(105, 150, ath))
    band = (ath > 68) & (y < top) & (y > bot) & ~ear & (N[:, 1] > -0.4)
    cand = np.where(band)[0]
    roots = cand[r.choice(len(cand), size=min(len(cand), 520), replace=False)]
    for k, vi in enumerate(roots):
        p = V[vi]
        a = np.radians(th[vi])
        # comb direction: down and back, with a little outward lift; flyaways go anywhere
        back = np.array([np.sin(a), 0, np.cos(a)])
        d0 = np.array([0, -0.7, 0]) + back * 0.8 + r.normal(0, 0.2, 3)
        fly = r.random() < 0.07
        L = r.uniform(0.026, 0.05) * (1.25 if fly else 1)
        st.card(p, d0, L, r.uniform(0.006, 0.011), 0.0004, r.uniform(0.0015, 0.004) * (2.5 if fly else 1),
                variant=int(r.integers(0, 2)), gravity=0.006, curl=r.uniform(-0.03, 0.03), rng=r, segs=9,
                tone=r.uniform(0.82, 1.0), wave=0.1 if fly else 0.035)
    parts.append(st.part('hair'))
    # ---- eyebrows: grey, bristly, with a few long wiry hairs
    for s in (1, -1):
        for k in range(70):
            t = r.random() ** 0.85
            x = s * (0.011 + t * 0.044)
            yb = 0.0845 + 0.0055 * np.sin(np.pi * (0.15 + 0.85 * t)) - 0.004 * t * t
            thick = 0.0028 * (1 - 0.6 * t)
            root2 = np.array([x, yb + r.uniform(-1, 1) * thick])
            pv = surf_point(V, N, root2)
            ang = np.radians(np.interp(t, [0, 0.2, 0.5, 1], [70, 35, 8, -22]) + r.normal(0, 8))
            d0 = np.array([s * np.cos(ang), np.sin(ang), 0.15])
            wiry = r.random() < 0.08
            L = (r.uniform(0.006, 0.011) if not wiry else r.uniform(0.014, 0.02))
            st.card(pv, d0, L, r.uniform(0.0016, 0.0026), 0.0003, 0.0012 if not wiry else 0.004, variant=int(r.integers(2, 4)),
                    gravity=0.0 if not wiry else -0.002, curl=s * r.uniform(-0.03, 0.03), segs=4, rng=r, tone=r.uniform(0.62, 0.9), wave=0.05 if wiry else 0.02)
    parts.append(st.part('brows'))
    # ---- lashes: along the upper lid margin (the eye-hole boundary), sparse and pale
    from collections import Counter
    e = np.sort(np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]]), axis=1)
    cnt = Counter(map(tuple, e))
    bverts = np.array(sorted({v for (a, b), c in cnt.items() if c == 1 for v in (a, b)}))
    for s in (1, -1):
        ctr = eyeFit[s][0]
        bv = bverts[(np.linalg.norm(V[bverts] - ctr, axis=1) < 0.03)]
        upper = bv[V[bv, 1] > ctr[1] + 0.001]
        lower = bv[V[bv, 1] < ctr[1] - 0.002]
        for grp, (n, L, up) in ((upper, (70, 0.0075, 1)), (lower, (30, 0.0035, -1))):
            if not len(grp):
                continue
            sel = grp[r.choice(len(grp), size=min(n, len(grp) * 3), replace=True)]
            for vi in sel:
                p = V[vi] + r.normal(0, 0.0003, 3)
                out = p - ctr; out /= np.linalg.norm(out)
                d0 = out * 0.6 + np.array([0, up * 0.7, 0.5])
                st.card(p, d0, L * r.uniform(0.7, 1.15), 0.0012, 0.0002, 0.0006, variant=3, gravity=-0.006 * up, segs=3, rng=r, tone=r.uniform(0.35, 0.6))
    parts.append(st.part('lashes'))


def surf_point(V, N, xy):
    """Front-most mesh point under a 2D (x,y) location (plane fit over the nearest same-layer verts)."""
    global _SURF
    if '_SURF' not in globals() or _SURF[0] is not V:
        _SURF = (V, Sculptor(V, N))
    return _SURF[1].surf(np.asarray(xy)[None])[0]


def write(parts, meta):
    header = {'parts': [], 'meta': meta}
    chunks, off = [], 0
    for p in parts:
        e = {'name': p['name'], 'vertices': len(p['pos']), 'indices': int(p['idx'].size)}
        for k, arr in (('pos', p['pos'].astype(np.float32)), ('nrm', p['nrm'].astype(np.float32)),
                       ('col', np.clip(p['col'], 0, 1).astype(np.float32)), ('idx', p['idx'].astype(np.uint32))):
            b = arr.tobytes()
            e[k] = off
            chunks.append(b)
            off += len(b)
        if 'uv' in p:
            b = p['uv'].astype(np.float32).tobytes(); e['uv'] = off; chunks.append(b); off += len(b)
        header['parts'].append(e)
    hj = json.dumps(header).encode()
    hj += b' ' * ((4 - len(hj) % 4) % 4)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'wb') as f:
        f.write(struct.pack('<I', len(hj)))
        f.write(hj)
        for c in chunks:
            f.write(c)
    print('wrote', OUT, os.path.getsize(OUT) / 1e6, 'MB')


if __name__ == '__main__':
    main()
