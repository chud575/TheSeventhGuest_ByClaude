#!/usr/bin/env node
// Offline sculpt + mesher for the music room's ghost pianist ("Herr Kessler").
// The figure is an SDF (smooth unions of round cones / ellipsoids, carved face),
// polygonised with Surface Nets + Newton projection onto the surface, and written
// to public/assets/music/ghost.bin as separate parts: body, head, armL, armR.
//   node src/rooms/music/tools/genGhost.mjs
// Coordinates are piano-local metres (pianist sits at +Z facing -Z); the head is
// stored relative to HEAD and each arm relative to its shoulder so they can move.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../../../public/assets/music/ghost.bin');

// ------------------------------------------------------------------ SDF kit
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const smin = (a, b, k) => { const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k)); return b + (a - b) * h - k * h * (1 - h); };
const smax = (a, b, k) => -smin(-a, -b, k);
function ell(px, py, pz, c, r) { // ellipsoid (approx, IQ)
  const x = (px - c[0]) / r[0], y = (py - c[1]) / r[1], z = (pz - c[2]) / r[2];
  const k0 = len3(x, y, z);
  const k1 = len3(x / r[0], y / r[1], z / r[2]);
  return k0 * (k0 - 1) / Math.max(k1, 1e-9);
}
function rcone(px, py, pz, a, b, r1, r2) { // round cone between a (r1) and b (r2)
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const qx = px - a[0], qy = py - a[1], qz = pz - a[2];
  const l2 = bx * bx + by * by + bz * bz;
  const t = Math.max(0, Math.min(1, (qx * bx + qy * by + qz * bz) / l2));
  const dx = qx - bx * t, dy = qy - by * t, dz = qz - bz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (r1 + (r2 - r1) * t);
}
const sph = (px, py, pz, c, r) => len3(px - c[0], py - c[1], pz - c[2]) - r;

export { ell, rcone, sph, smin, smax };
export const HEAD = [0, 1.31, 0.43];
export const SHOULDER = { L: [-0.205, 1.045, 0.5], R: [0.205, 1.045, 0.5] };

// ------------------------------------------------------------------ sculpt helpers
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Catmull-Rom through control points -> n samples
function crPath(cp, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * (cp.length - 1);
    const k = Math.min(cp.length - 2, Math.floor(t)), f = t - k;
    const p0 = cp[Math.max(0, k - 1)], p1 = cp[k], p2 = cp[k + 1], p3 = cp[Math.min(cp.length - 1, k + 2)];
    const f2 = f * f, f3 = f2 * f;
    out.push([0, 1, 2].map((a) => 0.5 * ((2 * p1[a]) + (-p0[a] + p2[a]) * f + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * f2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * f3)));
  }
  return out;
}
// a lock / strand clump: tapered chain of round cones with a bounding sphere
function makeLock(cp, r0, r1, r2, n = 7) {
  const pts = crPath(cp, n);
  const rad = pts.map((_, i) => { const t = i / n; return t < 0.4 ? r0 + (r1 - r0) * (t / 0.4) : r1 + (r2 - r1) * ((t - 0.4) / 0.6); });
  let c = [0, 0, 0]; for (const p of pts) { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length; }
  let R = 0; pts.forEach((p, i) => { R = Math.max(R, len3(p[0] - c[0], p[1] - c[1], p[2] - c[2]) + rad[i]); });
  return { pts, rad, c, R };
}
function lockDist(L, x, y, z, far) {
  const b = len3(x - L.c[0], y - L.c[1], z - L.c[2]) - L.R;
  if (b > far) return b;
  let d = 1e9;
  for (let i = 0; i < L.pts.length - 1; i++) d = Math.min(d, rcone(x, y, z, L.pts[i], L.pts[i + 1], L.rad[i], L.rad[i + 1]));
  return d;
}
function lockField(locks, x, y, z, k, far = 0.03) {
  let d = 1e9;
  for (const L of locks) { const l = lockDist(L, x, y, z, far); d = d > 1e8 ? l : (l < d + k ? smin(d, l, k) : d); }
  return d;
}
// IQ 2D polygon SDF
function sdPoly(px, py, v) {
  let d = (px - v[0][0]) ** 2 + (py - v[0][1]) ** 2, s = 1;
  for (let i = 0, j = v.length - 1; i < v.length; j = i, i++) {
    const ex = v[j][0] - v[i][0], ey = v[j][1] - v[i][1], wx = px - v[i][0], wy = py - v[i][1];
    const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
    const bx = wx - ex * t, by = wy - ey * t;
    d = Math.min(d, bx * bx + by * by);
    const c1 = py >= v[i][1], c2 = py < v[j][1], c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

// ------------------------------------------------------------------ head (relative to HEAD), faces -Z
// Kessler as in the overmantel portrait: a high domed forehead with the hair receding from it,
// thick dark hair swept back over the crown and bushing out over the ears to the collar, a full
// squared beard with a heavy moustache, deep-set eyes under a strong brow, a straight nose.
const SK = { c: [0, 0.022, 0.012], r: [0.078, 0.099, 0.097] };
function onSkull(az, el, lift) {
  // az 0 = straight ahead (-Z), +az toward +X; el = elevation; lift = metres off the skull
  const dx = Math.sin(az) * Math.cos(el), dy = Math.sin(el), dz = -Math.cos(az) * Math.cos(el);
  const rr = 1 / Math.sqrt((dx / SK.r[0]) ** 2 + (dy / SK.r[1]) ** 2 + (dz / SK.r[2]) ** 2);
  return [SK.c[0] + dx * (rr + lift), SK.c[1] + dy * (rr + lift), SK.c[2] + dz * (rr + lift)];
}
function onSkullDir(dx, dy, dz, lift) {
  const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
  const rr = 1 / Math.sqrt((dx / SK.r[0]) ** 2 + (dy / SK.r[1]) ** 2 + (dz / SK.r[2]) ** 2);
  return [SK.c[0] + dx * (rr + lift), SK.c[1] + dy * (rr + lift), SK.c[2] + dz * (rr + lift)];
}
const HAIR_LOCKS = [], BEARD_LOCKS = [], MOUSTACHE = [], BROWS = [];
{
  const rnd = mulberry(1871);
  const j = (a) => (rnd() - 0.5) * 2 * a;
  // crown: combed straight back from the receding hairline, fanning a little, over the top to the nape
  for (let i = 0; i < 15; i++) {
    const u = (i / 14) * 2 - 1;                       // -1..1 across the head
    const m0 = 0.9 + 0.25 * Math.abs(u) * 0 + j(0.05);
    const cp = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const m = m0 + (Math.PI + 0.75 - m0) * t;       // meridian angle: 0 ahead, pi/2 up, pi behind
      const lat = u * (0.6 + 0.1 * Math.sin(t * Math.PI) - 0.15 * t) + j(0.03);
      const lift = -0.004 + 0.018 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * (1 - 0.35 * t) + j(0.002);   // rooted in the scalp at the hairline
      cp.push(onSkullDir(lat, Math.sin(m), -Math.cos(m), lift));
    }
    HAIR_LOCKS.push(makeLock(cp, 0.007, 0.0125 + j(0.002), 0.004, 10));
  }
  // sides + back: thick masses from the temples swept back over the ears, bushing out, curling at the collar
  for (const s of [-1, 1]) {
    for (let i = 0; i < 16; i++) {
      const v = i / 15;                                // 0 = high (temple / crown side) .. 1 = low (over the ear)
      const el0 = 0.55 - v * 0.7 + j(0.06);
      const az0 = s * (0.9 + v * 0.45 + j(0.08) + (i % 2) * 0.25);
      const cp = [];
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        const az = az0 + s * (1.5 + 0.1 * v + j(0.1)) * t;      // back along the side of the head
        const el = el0 - (0.55 + 0.35 * v) * t;            // and down toward the collar, nearly straight
        const lift = -0.002 + (0.01 + 0.008 * v) * Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.9) + j(0.002);
        cp.push(onSkull(az, el, lift));
      }
      // ends flick outward / under at the collar
      const e = cp[4];
      cp.push([e[0] + s * 0.006, e[1] - 0.014, e[2] - 0.002]);
      HAIR_LOCKS.push(makeLock(cp, 0.008, 0.0145 + j(0.002), 0.005, 8));
    }
  }
  // back of the head: locks from the crown straight down to the collar
  for (let i = 0; i < 9; i++) {
    const u = (i / 8) * 2 - 1;
    const cp = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      const az = Math.PI + u * (0.7 + 0.25 * t) * -1;
      const el = 0.75 - 1.4 * t;
      cp.push(onSkull(az, el, 0.006 + 0.012 * Math.sin(t * Math.PI) + j(0.002)));
    }
    const e = cp[4]; cp.push([e[0], e[1] - 0.02, e[2] - 0.006]);
    HAIR_LOCKS.push(makeLock(cp, 0.009, 0.015 + j(0.002), 0.005, 8));
  }
  // beard: clumps from the side-whiskers and the jaw falling to a squared fall below the chin
  for (let i = 0; i < 22; i++) {
    const u = (i / 21) * 2 - 1;                       // -1 (left whisker) .. 1 (right whisker)
    const a = u * 1.45;                               // angle round the jaw, 0 = chin
    const top = [Math.sin(a) * 0.066, -0.022 - 0.03 * (1 - Math.abs(u)) * 0 - 0.012 * Math.cos(a) + j(0.004), -Math.cos(a) * 0.072 + 0.012];
    const mid = [Math.sin(a) * 0.07, -0.08 + j(0.006), -Math.cos(a) * 0.085 + 0.006];
    const bot = [Math.sin(a) * 0.052 * (0.7 + 0.3 * Math.abs(u)), -0.128 - 0.018 * (1 - Math.abs(u)) + j(0.006), -Math.cos(a) * 0.072 + 0.0];
    const tip = [bot[0] * 0.9, bot[1] - 0.014 + j(0.004), bot[2] + 0.01];
    BEARD_LOCKS.push(makeLock([top, mid, bot, tip], 0.01, 0.015 + j(0.002), 0.007, 8));
  }
  // moustache: heavy wings from under the nose, drooping into the beard
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const o = i * 0.004;
    MOUSTACHE.push(makeLock([[s * (0.003 + o), -0.042 - o * 0.3, -0.104], [s * (0.016 + o), -0.052 - o * 0.5, -0.1], [s * (0.026 + o * 0.5), -0.066 - o * 0.4, -0.092], [s * (0.03 + o * 0.5), -0.082, -0.084]], 0.0062, 0.0068, 0.0045, 6));
  }
  // eyebrows: short tufts along the brow ridge
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x0 = 0.014 + i * 0.012;
    BROWS.push(makeLock([[s * x0, 0.031 - i * 0.0005, -0.091 + i * 0.004], [s * (x0 + 0.012), 0.034 - i * 0.002, -0.087 + i * 0.005]], 0.004, 0.0045, 0.003, 3));
  }
}

export function head(x, y, z) {
  // ---- skull + face planes
  let d = ell(x, y, z, SK.c, SK.r);                                                // cranium
  d = smin(d, ell(x, y, z, [0, 0.05, -0.035], [0.068, 0.062, 0.058]), 0.02);       // high domed forehead
  d = smin(d, ell(x, y, z, [0, -0.045, -0.025], [0.06, 0.06, 0.07]), 0.03);        // jaw
  d = smin(d, ell(x, y, z, [0, -0.088, -0.058], [0.026, 0.024, 0.024]), 0.02);     // chin
  // brow ridge: a continuous bar over the eyes, a little dip at the glabella
  d = smin(d, rcone(x, y, z, [-0.048, 0.028, -0.072], [-0.012, 0.032, -0.088], 0.009, 0.01), 0.012);
  d = smin(d, rcone(x, y, z, [0.048, 0.028, -0.072], [0.012, 0.032, -0.088], 0.009, 0.01), 0.012);
  for (const s of [-1, 1]) {
    // temples slightly hollow
    d = smax(d, -ell(x, y, z, [s * 0.079, 0.03, -0.045], [0.012, 0.02, 0.02]), 0.012);
    // cheekbones
    d = smin(d, ell(x, y, z, [s * 0.047, -0.01, -0.066], [0.02, 0.012, 0.018]), 0.016);
    // eye sockets, deep set
    d = smax(d, -ell(x, y, z, [s * 0.031, 0.012, -0.094], [0.019, 0.014, 0.017]), 0.008);
    // eyeball
    d = smin(d, sph(x, y, z, [s * 0.031, 0.011, -0.07], 0.0118), 0.002);
    // upper lid (heavy, hooded) and the crease above it, lower lid
    d = smin(d, ell(x, y, z, [s * 0.031, 0.0175, -0.077], [0.0135, 0.0055, 0.0075]), 0.004);
    d = smin(d, ell(x, y, z, [s * 0.031, 0.002, -0.079], [0.012, 0.0035, 0.0055]), 0.004);
    // eye bags under the lower lid
    d = smin(d, ell(x, y, z, [s * 0.033, -0.006, -0.078], [0.012, 0.005, 0.007]), 0.006);
    // ears (mostly under the side hair)
    d = smin(d, ell(x, y, z, [s * 0.07, 0.0, 0.01], [0.009, 0.026, 0.016]), 0.01);   // (under the hair, as in the portrait)
  }
  // nose: straight bridge between the brows, a narrow wedge, rounded tip, nostril wings
  d = smin(d, ell(x, y, z, [0, -0.004, -0.096], [0.0105, 0.03, 0.013]), 0.008);
  d = smin(d, rcone(x, y, z, [0, 0.02, -0.092], [0, -0.024, -0.111], 0.0072, 0.0085), 0.006);
  d = smin(d, sph(x, y, z, [0, -0.026, -0.109], 0.0092), 0.005);
  for (const s of [-1, 1]) {
    d = smin(d, sph(x, y, z, [s * 0.0125, -0.031, -0.099], 0.0075), 0.005);
    d = smax(d, -sph(x, y, z, [s * 0.0068, -0.0375, -0.104], 0.003), 0.002);     // nostrils
  }
  // lips: the lower lip shows under the moustache
  d = smin(d, ell(x, y, z, [0, -0.066, -0.091], [0.017, 0.0052, 0.0085]), 0.006);
  // ---- hair, beard, moustache, brows
  let hr = ell(x, y, z, SK.c, [SK.r[0] + 0.004, SK.r[1] + 0.004, SK.r[2] + 0.004]);  // a close cap under the locks
  hr = smax(hr, -(z + 0.04 - Math.max(0, y - 0.06) * 0.0 - (y - 0.075) * -0.35), 0.028);  // receding hairline: clear the forehead, feathered
  hr = smax(hr, (z - 0.02) - (y - 0.07) * -0.0 - 1, 0.01);
  hr = smax(hr, -(y + 0.13), 0.02);
  hr = smax(hr, -(y - 0.02 + Math.max(0, -z) * 1.2 + Math.max(0, z) * 1.6), 0.012);                         // the cap only above the ears at the front
  // bulk under the locks: bushy over the ears, full at the back down to the collar
  for (const s of [-1, 1]) hr = smin(hr, ell(x, y, z, [s * 0.062, -0.01, 0.03], [0.024, 0.055, 0.06]), 0.02);
  hr = smin(hr, ell(x, y, z, [0, -0.025, 0.06], [0.07, 0.08, 0.05]), 0.02);
  // the locks melt into one another (soft, shallow partings) instead of reading as separate ropes
  hr = smin(hr, lockField(HAIR_LOCKS, x, y, z, 0.009), 0.008);
  let br = ell(x, y, z, [0, -0.082, -0.042], [0.068, 0.058, 0.062]);                       // beard mass under the clumps
  br = smax(br, -(-(y + 0.025) + Math.abs(x) * 0.15 - Math.max(0, -z - 0.075) * 0.5), 0.01);
  br = smin(br, lockField(BEARD_LOCKS, x, y, z, 0.005), 0.007);
  br = smax(br, -ell(x, y, z, [0, -0.064, -0.103], [0.016, 0.007, 0.02]), 0.003);     // lower lip shows through
  const mo = lockField(MOUSTACHE, x, y, z, 0.003);
  const bw = lockField(BROWS, x, y, z, 0.002);
  hr = smin(hr, smin(br, smin(mo, bw, 0.002), 0.006), 0.006);
  head.skull = d; head.hair = hr;
  return smin(d, hr, 0.004);
}
export function headTint(x, y, z) {
  head(x, y, z);
  return head.hair < head.skull - 0.0005 ? 0.35 : 1;
}

// ------------------------------------------------------------------ body (torso, tailcoat, legs)
// flattened round cone: squash the z axis so the shape becomes a hanging cloth panel
function panel(x, y, z, a, b, r1, r2, squash) {
  const zc = (a[2] + b[2]) / 2;
  return rcone(x, y, zc + (z - zc) * squash, a, b, r1, r2) / Math.sqrt(squash);
}
// soft ridge around a 2D segment (cloth folds as a displacement along the projection axis)
function ridge(u, v, a, b, w) {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((u - a[0]) * ex + (v - a[1]) * ey) / (ex * ex + ey * ey)));
  const dx = u - a[0] - ex * t, dy = v - a[1] - ey * t;
  const taper = Math.sin(Math.PI * (0.08 + 0.84 * t));
  return Math.exp(-(dx * dx + dy * dy) / (w * w)) * taper;
}
// front projection (|x|, y): the coat lapel (notched, rolling from the collar to the top button)
const LAPEL = [[0.03, 1.08], [0.026, 0.80], [0.07, 0.86], [0.122, 0.95], [0.142, 0.99], [0.114, 0.993], [0.12, 1.025], [0.08, 1.095]];
// the opening between the lapels (waistcoat below, shirt-front, stock and tie above)
const VOPEN = [[0.0, 1.12], [0.032, 1.12], [0.029, 0.80], [0.012, 0.77], [0.0, 0.765]];
function torsoCore(x, y, z) {
  let d = ell(x, y, z, [0, 0.63, 0.6], [0.165, 0.09, 0.14]);                          // pelvis on the seat
  d = smin(d, ell(x, y, z, [0, 0.76, 0.565], [0.145, 0.12, 0.112]), 0.05);           // abdomen / waist
  d = smin(d, ell(x, y, z, [0, 0.925, 0.515], [0.158, 0.13, 0.112]), 0.05);          // chest
  d = smin(d, rcone(x, y, z, [-0.17, 1.015, 0.505], [0.17, 1.015, 0.505], 0.05, 0.05), 0.06);   // shoulders
  // square, padded tailored shoulder line (not a mannequin's ball joints)
  for (const s of [-1, 1]) d = smin(d, ell(x, y, z, [s * 0.165, 1.04, 0.505], [0.075, 0.032, 0.065]), 0.03);
  for (const s of [-1, 1]) d = smin(d, ell(x, y, z, [s * 0.06, 0.95, 0.585], [0.08, 0.1, 0.04]), 0.05);   // shoulder blades under the cloth
  return d;
}
export function body(x, y, z) {
  const ax = Math.abs(x);
  let d = torsoCore(x, y, z);
  let region = 0;                                    // 0 coat, 2 linen, 3 black silk
  const front = z < 0.5;
  // ---- the front opening: waistcoat + shirt recessed under the coat
  const vo = sdPoly(ax, y, VOPEN);
  if (front && vo < 0.003) d += 0.0045 * Math.min(1, Math.max(0, (0.003 - vo) / 0.004));
  // ---- lapels: flat raised panels following the chest, with a crisp edge and a notch
  const lp = sdPoly(ax, y, LAPEL);
  if (front) {
    const lap = Math.max(d - 0.0065, lp);
    d = smin(d, lap, 0.002);
    // roll line: the lapel lifts off the chest toward its outer edge
    d -= 0.002 * Math.max(0, Math.min(1, -lp / 0.02)) * (ax > 0.06 ? 1 : 0.5) * (lp < 0 ? 1 : 0);
  }
  // ---- neck, coat collar, shirt collar, stock and tie
  d = smin(d, rcone(x, y, z, [0, 1.03, 0.49], [0, 1.22, 0.45], 0.05, 0.043), 0.03);
  const collarBand = rcone(x, y, z, [0, 1.065, 0.482], [0, 1.135, 0.466], 0.058, 0.054);   // white stock round the neck
  d = smin(d, collarBand, 0.006);
  // shirt collar points standing up against the jaw
  for (const s of [-1, 1]) d = smin(d, panel(x, y, z, [s * 0.03, 1.1, 0.42], [s * 0.05, 1.155, 0.425], 0.012, 0.006, 3.0), 0.004);
  // the coat collar rolling round the back of the neck
  d = smin(d, rcone(x, y, z, [-0.085, 1.075, 0.505], [0, 1.115, 0.535], 0.026, 0.03), 0.02);
  d = smin(d, rcone(x, y, z, [0.085, 1.075, 0.505], [0, 1.115, 0.535], 0.026, 0.03), 0.02);
  // black silk tie: a small knot and two short ends falling over the shirt
  const knot = ell(x, y, z, [0, 1.075, 0.418], [0.016, 0.012, 0.009]);
  let tie = knot;
  for (const s of [-1, 1]) tie = smin(tie, panel(x, y, z, [s * 0.004, 1.068, 0.415], [s * 0.012, 1.0, 0.405], 0.008, 0.011, 4.0), 0.004);
  d = smin(d, tie, 0.003);
  // waistcoat buttons, coat buttons, watch chain
  for (let k = 0; k < 3; k++) { const yy = 0.93 - k * 0.045; d = smin(d, sph(x, y, z, [0, yy, 0.405 + (0.93 - yy) * 0.22], 0.0055), 0.002); }
  for (const s of [-1, 1]) d = smin(d, sph(x, y, z, [s * 0.072, 0.805, 0.452], 0.008), 0.002);
  d = smin(d, rcone(x, y, z, [-0.045, 0.83, 0.448], [0.0, 0.81, 0.448], 0.0025, 0.0025), 0.0015);
  d = smin(d, rcone(x, y, z, [0.0, 0.81, 0.448], [0.045, 0.83, 0.448], 0.0025, 0.0025), 0.0015);
  // ---- waist seam (tailcoat) + cloth folds
  d += 0.0012 * Math.exp(-((y - 0.775) ** 2) / 0.00004);
  if (front) {
    for (const [a, b, amp] of [[[0.05, 0.80], [0.15, 0.775], 0.004], [[0.07, 0.755], [0.16, 0.74], 0.0035], [[0.06, 0.72], [0.14, 0.715], 0.003]]) d -= amp * ridge(ax, y, a, b, 0.008);
  } else {
    for (const [a, b, amp] of [[[0.07, 0.99], [0.12, 0.8], 0.004], [[0.02, 0.92], [0.07, 0.78], 0.0035], [[0.11, 0.97], [0.15, 0.85], 0.003]]) d -= amp * ridge(ax, y, a, b, 0.01);
  }
  // the coat's back seams: centre back, and side-back seams curving from the armholes to the waist buttons
  if (!front) {
    d += 0.0016 * Math.exp(-(x * x) / 0.000012) * (y > 0.78 && y < 1.09 ? 1 : 0);
    for (const s of [-1, 1]) {
      const sx = 0.068 + 0.075 * Math.pow(Math.max(0, Math.min(1, (y - 0.78) / 0.22)), 1.6);
      d += 0.0014 * Math.exp(-((x - s * sx) ** 2) / 0.00001) * (y > 0.78 && y < 1.0 ? 1 : 0);
      d -= 0.002 * Math.exp(-((x - s * 0.07) ** 2 + (y - 0.775) ** 2) / 0.00004);    // hip buttons
    }
  }
  if (ax > 0.1) for (const [a, b, amp] of [[[0.48, 0.95], [0.56, 0.84], 0.003], [[0.5, 0.88], [0.58, 0.8], 0.003]]) d -= amp * ridge(z, y, a, b, 0.009);
  // ---- coat tails: two long panels from the back waist over the bench edge, the vent between them
  for (const s of [-1, 1]) {
    d = smin(d, panel(x, y, z, [s * 0.068, 0.765, 0.668], [s * 0.078, 0.555, 0.752], 0.072, 0.07, 4.5), 0.03);
    d = smin(d, panel(x, y, z, [s * 0.078, 0.555, 0.756], [s * 0.082, 0.43, 0.772], 0.068, 0.062, 5.0), 0.015);
  }
  if (z > 0.66 && y < 0.74) d = Math.max(d, 0.004 + (0.74 - y) * 0.02 - ax);
  // ---- trousers: thighs along the seat, knees, shins (the shader dissolves the legs below the seat)
  for (const s of [-1, 1]) {
    d = smin(d, rcone(x, y, z, [s * 0.092, 0.605, 0.6], [s * 0.108, 0.59, 0.225], 0.078, 0.058), 0.04);
    d = smin(d, sph(x, y, z, [s * 0.11, 0.59, 0.225], 0.058), 0.02);
    d = smin(d, rcone(x, y, z, [s * 0.11, 0.585, 0.215], [s * 0.12, 0.1, 0.27], 0.052, 0.041), 0.025);
    // pressed crease along the top of the thigh, a drag fold to the knee, folds behind the knee
    d -= 0.0028 * Math.exp(-((ax - 0.103) ** 2) / 0.00006) * (z < 0.55 && z > 0.25 && y > 0.62 ? 1 : 0);
    d -= 0.003 * ridge(z, y, [0.5, 0.66], [0.28, 0.635], 0.01) * (Math.abs(ax - 0.07) < 0.03 ? 1 : 0);
    for (const yy of [0.56, 0.535]) d -= 0.003 * Math.exp(-((y - yy) ** 2) / 0.00004) * (z > 0.2 && z < 0.26 && x * s > 0 ? 1 : 0);
  }
  body.region = region;
  return d;
}
// value regions: 0.1 coat cloth, 0.05 black silk tie, 0.8 linen (shirt, stock, collar points)
export function bodyTint(x, y, z) {
  const ax = Math.abs(x);
  if (y > 1.055 && y < 1.16 && z < 0.5) {
    const tie = ell(x, y, z, [0, 1.075, 0.418], [0.02, 0.016, 0.014]);
    if (tie < 0.002) return 0.05;
    return 0.8;                                                   // stock + collar points
  }
  if (y > 0.96 && y <= 1.055 && z < 0.47 && sdPoly(ax, y, VOPEN) < 0.002) {
    if (ax < 0.016 && y > 0.995) return 0.05;                     // tie ends
    return 0.8;                                                   // shirt front
  }
  return 0.1;
}

// ------------------------------------------------------------------ arm (relative to shoulder), s = -1 left / +1 right
// hands rest on the keys: fingertips just behind the white-key fronts (z = 0.17), key tops at y = 0.735
export function makeArm(s) {
  const sh = SHOULDER[s < 0 ? 'L' : 'R'];
  const rel = (p) => [p[0] - sh[0], p[1] - sh[1], p[2] - sh[2]];
  const hx = s * 0.17;
  const el = rel([s * 0.27, 0.83, 0.42]);
  const wr = rel([hx + s * 0.005, 0.776, 0.215]);
  const hand = rel([hx, 0.772, 0.17]);
  // four arched fingers (index..little, from the thumb side), three phalanges each, knuckles raised:
  // a pianist's curved hand with the fingertips dropping onto the keys
  const fingers = [0, 1, 2, 3].map((k) => {
    const off = (k - 1.5) * 0.0215 * -s;
    const L = [1.0, 1.08, 1.02, 0.84][k];
    const kn = rel([hx + off, 0.784, 0.15]);                                          // knuckle
    const p1 = rel([hx + off * 1.08, 0.786 - 0.004 * L, 0.15 - 0.026 * L]);           // proximal: level, forward
    const p2 = rel([hx + off * 1.12, 0.772 - 0.004 * L, 0.124 - 0.018 * L]);          // middle: bending down
    const tip = rel([hx + off * 1.14, 0.744, 0.108 - 0.012 * L]);                     // tip on the key
    return [kn, p1, p2, tip];
  });
  const thumb = [rel([hx - s * 0.03, 0.772, 0.178]), rel([hx - s * 0.046, 0.762, 0.15]), rel([hx - s * 0.052, 0.748, 0.124])];
  return (x, y, z) => {
    let d = rcone(x, y, z, [0, -0.01, 0], el, 0.054, 0.046);
    d = smin(d, rcone(x, y, z, el, wr, 0.046, 0.033), 0.02);
    // sleeve creases at the elbow
    d += 0.003 * Math.sin((y - el[1]) * 120) * Math.exp(-(((x - el[0]) ** 2) + ((y - el[1]) ** 2) + ((z - el[2]) ** 2)) / 0.004);
    // turned-back coat cuff with a lace shirt cuff spilling out of it
    d = smin(d, rcone(x, y, z, [wr[0], wr[1], wr[2] + 0.06], [wr[0], wr[1], wr[2] + 0.025], 0.042, 0.042), 0.006);
    let lace = rcone(x, y, z, [wr[0], wr[1], wr[2] + 0.028], [wr[0], wr[1] - 0.002, wr[2] - 0.004], 0.036, 0.04);
    lace += 0.0025 * Math.sin(Math.atan2(y - wr[1], x - wr[0]) * 14);
    d = smin(d, lace, 0.004);
    // back of the hand: a flattened wedge from the wrist to the knuckles, tendons faintly raised
    d = smin(d, rcone(x, y, z, wr, hand, 0.022, 0.026), 0.012);
    let palm = ell(x, y, z, [hand[0], hand[1] + 0.004, hand[2] + 0.006], [0.04, 0.013, 0.032]);
    palm += 0.0012 * Math.sin((x - hand[0]) * 300);
    d = smin(d, palm, 0.01);
    for (const [kn, p1, p2, tip] of fingers) {
      let f = rcone(x, y, z, kn, p1, 0.0088, 0.0078);
      f = smin(f, rcone(x, y, z, p1, p2, 0.0078, 0.007), 0.002);
      f = smin(f, rcone(x, y, z, p2, tip, 0.007, 0.0062), 0.002);
      f = smin(f, sph(x, y, z, kn, 0.0098), 0.003);                                  // knuckle
      f = smin(f, sph(x, y, z, p1, 0.0084), 0.002);                                  // finger joints
      d = smin(d, f, 0.0035);
    }
    d = smin(d, rcone(x, y, z, thumb[0], thumb[1], 0.011, 0.009), 0.008);
    d = smin(d, rcone(x, y, z, thumb[1], thumb[2], 0.009, 0.0075), 0.002);
    return d;
  };
}

// hands + lace cuffs bright, sleeves dark
function armTint(s) {
  const sh = SHOULDER[s < 0 ? 'L' : 'R'];
  return (x, y, z) => (z + sh[2] < 0.236 ? 1 : 0.15);
}

// ------------------------------------------------------------------ Surface Nets
function surfaceNets(f, min, max, h, tf) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1, ny = Math.ceil((max[1] - min[1]) / h) + 1, nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const N = nx * ny * nz;
  const field = new Float32Array(N);
  const id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) field[id(i, j, k)] = f(min[0] + i * h, min[1] + j * h, min[2] + k * h);
  const cellVert = new Int32Array(N).fill(-1);
  const pos = [];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) { v[c] = field[id(i + C[c][0], j + C[c][1], k + C[c][2])]; if (v[c] < 0) inside++; }
    if (inside === 0 || inside === 8) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of E) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; cnt++;
    }
    cellVert[id(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / cnt) * h, min[1] + (j + sy / cnt) * h, min[2] + (k + sz / cnt) * h);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const f0 = field[id(i, j, k)] < 0;
    if (j > 0 && k > 0 && f0 !== (field[id(i + 1, j, k)] < 0)) quad(cellVert[id(i, j - 1, k - 1)], cellVert[id(i, j, k - 1)], cellVert[id(i, j, k)], cellVert[id(i, j - 1, k)], !f0);
    if (i > 0 && k > 0 && f0 !== (field[id(i, j + 1, k)] < 0)) quad(cellVert[id(i - 1, j, k - 1)], cellVert[id(i - 1, j, k)], cellVert[id(i, j, k)], cellVert[id(i, j, k - 1)], !f0);
    if (i > 0 && j > 0 && f0 !== (field[id(i, j, k + 1)] < 0)) quad(cellVert[id(i - 1, j - 1, k)], cellVert[id(i, j - 1, k)], cellVert[id(i, j, k)], cellVert[id(i - 1, j, k)], !f0);
  }
  const nrm = new Float32Array(pos.length);
  const e = h * 0.35;
  for (let n = 0; n < pos.length; n += 3) {
    let x = pos[n], y = pos[n + 1], z = pos[n + 2], gx = 0, gy = 0, gz = 0;
    for (let it = 0; it < 3; it++) {
      const d = f(x, y, z);
      gx = f(x + e, y, z) - f(x - e, y, z); gy = f(x, y + e, z) - f(x, y - e, z); gz = f(x, y, z + e) - f(x, y, z - e);
      const g2 = gx * gx + gy * gy + gz * gz;
      if (g2 < 1e-14) break;
      const s = (d * 2 * e) / g2;
      const step = Math.min(1, (h * 0.75) / Math.max(1e-9, Math.abs(s) * Math.sqrt(g2)));
      x -= s * gx * step; y -= s * gy * step; z -= s * gz * step;
    }
    const gl = Math.hypot(gx, gy, gz) || 1;
    pos[n] = x; pos[n + 1] = y; pos[n + 2] = z;
    nrm[n] = gx / gl; nrm[n + 1] = gy / gl; nrm[n + 2] = gz / gl;
  }
  const ao = new Uint8Array(pos.length / 3);
  for (let n = 0, v = 0; n < pos.length; n += 3, v++) {
    let occ = 0;
    for (const [dist, w] of [[0.004, 0.5], [0.009, 0.3], [0.018, 0.2]]) {
      const dd = f(pos[n] + nrm[n] * dist, pos[n + 1] + nrm[n + 1] * dist, pos[n + 2] + nrm[n + 2] * dist);
      occ += w * Math.max(0, Math.min(1, dd / dist));
    }
    ao[v] = Math.round(Math.max(0, Math.min(1, occ)) * 255);
  }
  const tint = new Uint8Array(pos.length / 3).fill(255 * 0.3);
  if (tf) for (let n = 0, v = 0; n < pos.length; n += 3, v++) tint[v] = Math.round(255 * tf(pos[n], pos[n + 1], pos[n + 2]));
  return { pos: new Float32Array(pos), nrm, ao, tint, idx: new Uint32Array(idx) };
}

// ------------------------------------------------------------------ build + write
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
function main() {
const parts = [
  { name: 'body', f: body, tint: bodyTint, min: [-0.3, 0.0, 0.2 - 0.1], max: [0.3, 1.24, 0.9], h: 0.0055 },
  { name: 'head', f: head, tint: headTint, min: [-0.13, -0.22, -0.15], max: [0.13, 0.16, 0.17], h: 0.0026 },
  { name: 'armL', f: makeArm(-1), tint: armTint(-1), min: [-0.12, -0.36, -0.56], max: [0.12, 0.08, 0.08], h: 0.003 },
  { name: 'armR', f: makeArm(1), tint: armTint(1), min: [-0.12, -0.36, -0.56], max: [0.12, 0.08, 0.08], h: 0.003 },
];
const chunks = [];
const header = { parts: [], head: HEAD, shoulders: SHOULDER };
let offset = 0;
for (const p of parts) {
  const t0 = Date.now();
  const m = surfaceNets(p.f, p.min, p.max, p.h, p.tint);
  const n8 = new Int8Array((m.pos.length / 3) * 4);
  for (let i = 0; i < m.pos.length / 3; i++) { n8[i * 4] = Math.round(m.nrm[i * 3] * 127); n8[i * 4 + 1] = Math.round(m.nrm[i * 3 + 1] * 127); n8[i * 4 + 2] = Math.round(m.nrm[i * 3 + 2] * 127); }
  const entry = { name: p.name, vertices: m.pos.length / 3, indices: m.idx.length, pos: offset };
  chunks.push(Buffer.from(m.pos.buffer)); offset += m.pos.byteLength;
  entry.nrm = offset; chunks.push(Buffer.from(n8.buffer)); offset += n8.byteLength;
  entry.idx = offset; chunks.push(Buffer.from(m.idx.buffer)); offset += m.idx.byteLength;
  const aoPad = new Uint8Array(Math.ceil(m.ao.length / 4) * 4); aoPad.set(m.ao);
  entry.ao = offset; chunks.push(Buffer.from(aoPad.buffer)); offset += aoPad.byteLength;
  const tPad = new Uint8Array(Math.ceil(m.tint.length / 4) * 4); tPad.set(m.tint);
  entry.tint = offset; chunks.push(Buffer.from(tPad.buffer)); offset += tPad.byteLength;
  header.parts.push(entry);
  console.log(`${p.name}: ${entry.vertices} verts, ${entry.indices / 3} tris, ${Date.now() - t0} ms`);
}
let hj = Buffer.from(JSON.stringify(header));
const pad = (4 - ((4 + hj.length) % 4)) % 4;
hj = Buffer.concat([hj, Buffer.from(' '.repeat(pad))]);
const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32LE(hj.length, 0);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([lenBuf, hj, ...chunks]));
console.log('wrote', out, fs.statSync(out).size, 'bytes');

}
