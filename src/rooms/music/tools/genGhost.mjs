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

// ------------------------------------------------------------------ body (torso, tailcoat, legs)
// flattened round cone: squash the z axis so the shape becomes a hanging cloth panel
function panel(x, y, z, a, b, r1, r2, squash) {
  const zc = (a[2] + b[2]) / 2;
  return rcone(x, y, zc + (z - zc) * squash, a, b, r1, r2) / Math.sqrt(squash);
}
export function body(x, y, z) {
  let d = ell(x, y, z, [0, 0.63, 0.6], [0.175, 0.1, 0.15]);                        // pelvis / seat
  d = smin(d, rcone(x, y, z, [0, 0.66, 0.6], [0, 0.95, 0.51], 0.15, 0.17), 0.06);  // torso, leaning to the keys
  d = smin(d, ell(x, y, z, [0, 1.0, 0.5], [0.235, 0.075, 0.12]), 0.07);           // broad shoulders (padded coat)
  for (const s of [-1, 1]) d = smin(d, sph(x, y, z, [s * 0.2, 1.01, 0.5], 0.06), 0.06);
  d = smin(d, rcone(x, y, z, [0, 1.03, 0.49], [0, 1.22, 0.45], 0.05, 0.042), 0.03); // neck
  // high stand collar with points, white stock and a full cravat bow
  d = smin(d, rcone(x, y, z, [0, 1.06, 0.48], [0, 1.12, 0.465], 0.06, 0.056), 0.012);
  d = smin(d, ell(x, y, z, [0, 1.06, 0.405], [0.05, 0.05, 0.03]), 0.015);
  for (const s of [-1, 1]) d = smin(d, ell(x, y, z, [s * 0.035, 1.075, 0.4], [0.035, 0.02, 0.016]), 0.01);
  // rolled coat collar standing behind the neck
  d = smin(d, rcone(x, y, z, [-0.075, 1.09, 0.52], [0.075, 1.09, 0.52], 0.032, 0.032), 0.03);
  d = smin(d, rcone(x, y, z, [0, 1.06, 0.55], [0, 1.13, 0.53], 0.05, 0.03), 0.03);
  // shirt front / waistcoat: a raised V between the lapels
  d = smin(d, ell(x, y, z, [0, 0.93, 0.425], [0.06, 0.1, 0.02]), 0.03);
  // lapels: broad rolled ridges from collar to waist
  for (const s of [-1, 1]) {
    d = smin(d, rcone(x, y, z, [s * 0.1, 1.03, 0.44], [s * 0.035, 0.8, 0.44], 0.022, 0.012), 0.015);
    d = smin(d, rcone(x, y, z, [s * 0.13, 1.0, 0.45], [s * 0.1, 0.92, 0.43], 0.014, 0.01), 0.012);
  }
  // waist seam of the tailcoat + cut-away fronts
  d += 0.004 * Math.exp(-((y - 0.77) ** 2) / 0.0002) * (z < 0.55 ? 1 : 0.3);
  // vent between the tails
  if (z > 0.68 && y < 0.72) d = Math.max(d, 0.006 + (0.72 - y) * 0.03 - Math.abs(x));
  // coat tails: two long flat panels from the waist back, over the bench edge, falling behind
  for (const s of [-1, 1]) {
    d = smin(d, panel(x, y, z, [s * 0.075, 0.74, 0.71], [s * 0.085, 0.58, 0.79], 0.075, 0.07, 2.4), 0.04);
    d = smin(d, panel(x, y, z, [s * 0.085, 0.58, 0.79], [s * 0.1, 0.2, 0.81], 0.07, 0.062, 2.8), 0.03);
  }
  // thighs + shins (the shader dissolves the legs away)
  for (const s of [-1, 1]) {
    d = smin(d, rcone(x, y, z, [s * 0.095, 0.6, 0.6], [s * 0.115, 0.585, 0.2], 0.08, 0.062), 0.04);
    d = smin(d, rcone(x, y, z, [s * 0.115, 0.585, 0.2], [s * 0.125, 0.09, 0.27], 0.056, 0.045), 0.03);
  }
  // cloth folds: creases across the back, belly and the bend of the knees
  d += 0.0035 * Math.sin(y * 70 + Math.sin(x * 20) * 2) * Math.max(0, 1 - Math.abs(y - 0.8) * 3);
  d += 0.003 * Math.sin(z * 60 + x * 8) * Math.max(0, 1 - Math.abs(y - 0.6) * 8) * (z < 0.5 ? 1 : 0);
  return d;
}

// value regions (0 = dark cloth, 1 = linen / skin): lets the coat, shirt and cravat read apart
export function bodyTint(x, y, z) {
  let d = ell(x, y, z, [0, 1.06, 0.405], [0.06, 0.06, 0.04]);
  for (const s of [-1, 1]) d = Math.min(d, ell(x, y, z, [s * 0.035, 1.075, 0.4], [0.045, 0.03, 0.03]));
  d = Math.min(d, ell(x, y, z, [0, 0.93, 0.425], [0.05, 0.11, 0.035]));
  d = Math.min(d, rcone(x, y, z, [0, 1.06, 0.48], [0, 1.13, 0.465], 0.065, 0.06));
  return d < 0.004 ? 1 : 0;
}
export function headTint(x, y, z) {
  // hair darker than the face
  const face = z < -0.055 + Math.max(0, y - 0.06) * 0.3 - Math.max(0, 0.06 - y) * 0.5 && y > -0.12;
  return face ? 1 : 0.35;
}

// ------------------------------------------------------------------ head (relative to HEAD), faces -Z
export function head(x, y, z) {
  let d = ell(x, y, z, [0, 0.02, 0.01], [0.074, 0.097, 0.092]);                   // cranium
  d = smin(d, ell(x, y, z, [0, -0.05, -0.02], [0.058, 0.052, 0.072]), 0.03);      // jaw
  d = smin(d, ell(x, y, z, [0, -0.09, -0.052], [0.027, 0.023, 0.026]), 0.02);     // chin
  d = smin(d, ell(x, y, z, [0, 0.034, -0.07], [0.06, 0.014, 0.024]), 0.014);      // brow ridge
  d = smin(d, ell(x, y, z, [0, 0.046, -0.08], [0.01, 0.01, 0.008]), 0.01);        // frown knot between the brows
  for (const s of [-1, 1]) {
    d = smin(d, ell(x, y, z, [s * 0.044, -0.014, -0.056], [0.017, 0.011, 0.017]), 0.016); // high cheekbones
    d = smax(d, -sph(x, y, z, [s * 0.03, 0.012, -0.092], 0.018), 0.01);                   // sockets
    d = smin(d, sph(x, y, z, [s * 0.03, 0.011, -0.073], 0.012), 0.003);                   // eyes (set back)
    d = smin(d, ell(x, y, z, [s * 0.03, 0.017, -0.081], [0.012, 0.005, 0.007]), 0.005);   // upper lids
    d = smax(d, -ell(x, y, z, [s * 0.05, -0.05, -0.066], [0.016, 0.022, 0.01]), 0.012);   // hollow cheeks
    d = smax(d, -rcone(x, y, z, [s * 0.022, -0.04, -0.1], [s * 0.035, -0.07, -0.09], 0.004, 0.003), 0.004); // nasolabial folds
    d = smin(d, ell(x, y, z, [s * 0.078, 0.0, 0.006], [0.012, 0.031, 0.02]), 0.01);       // ears
  }
  // aquiline nose: bridge, hump, tip, nostril wings
  d = smin(d, rcone(x, y, z, [0, 0.026, -0.088], [0, -0.03, -0.114], 0.009, 0.013), 0.008);
  d = smin(d, sph(x, y, z, [0, 0.0, -0.104], 0.009), 0.006);
  for (const s of [-1, 1]) d = smin(d, sph(x, y, z, [s * 0.012, -0.034, -0.099], 0.009), 0.006);
  // mouth: thin lips pressed in a downturned line, and a drooping moustache
  d = smin(d, ell(x, y, z, [0, -0.059, -0.087], [0.021, 0.0065, 0.01]), 0.008);
  d = smax(d, -ell(x, y, z, [0, -0.061 - 0.004 * x * x * 400, -0.101], [0.025, 0.0025, 0.012]), 0.004);
  // hair: a long Lisztian mane swept back from the brow and falling to the collar,
  // full over the ears; medium-scale lumps break the silhouette into locks
  let hr = ell(x, y, z, [0, 0.03, 0.02], [0.082, 0.088, 0.097]);
  hr = smin(hr, ell(x, y, z, [0, -0.04, 0.055], [0.078, 0.085, 0.055]), 0.04);          // back of the head, to the collar
  for (const s of [-1, 1]) {
    hr = smin(hr, ell(x, y, z, [s * 0.07, -0.015, 0.04], [0.026, 0.062, 0.055]), 0.03);  // over the ears
    hr = smin(hr, ell(x, y, z, [s * 0.066, -0.075, 0.05], [0.026, 0.045, 0.04]), 0.03);  // ends curling at the collar
  }
  const lump = Math.sin(x * 70 + Math.sin(z * 50) * 2) * Math.sin(y * 55 + z * 30) * Math.sin(z * 45 + x * 20);
  hr += 0.0045 * lump;
  hr = smax(hr, -(z + 0.06 - Math.max(0, y - 0.06) * 0.3 + Math.max(0, 0.06 - y) * 0.5), 0.012);                  // hairline: off the face and brow
  hr = smax(hr, -(y + 0.13), 0.02);                                                   // not below the collar
  for (const s of [-1, 1]) hr = smin(hr, ell(x, y, z, [s * 0.072, -0.045, -0.015], [0.011, 0.04, 0.018]), 0.012); // side-whiskers
  head.skull = d; head.hair = hr;
  return smin(d, hr, 0.006);
}

// ------------------------------------------------------------------ arm (relative to shoulder), s = -1 left / +1 right
// hands rest on the keys: fingertips just behind the white-key fronts (z = 0.17), key tops at y = 0.735
function makeArm(s) {
  const sh = SHOULDER[s < 0 ? 'L' : 'R'];
  const rel = (p) => [p[0] - sh[0], p[1] - sh[1], p[2] - sh[2]];
  const hx = s * 0.17;
  const el = rel([s * 0.27, 0.83, 0.42]);
  const wr = rel([hx + s * 0.005, 0.776, 0.215]);
  const hand = rel([hx, 0.772, 0.17]);
  const fingers = [0, 1, 2, 3].map((k) => {
    const off = (k - 1.5) * 0.02 * -s;
    const reach = k === 0 || k === 3 ? 0.008 : 0;
    return [rel([hx + off, 0.772, 0.145]), rel([hx + off * 1.1, 0.762, 0.115 + reach]), rel([hx + off * 1.15, 0.744, 0.098 + reach])];
  });
  const thumb = [rel([hx - s * 0.036, 0.766, 0.17]), rel([hx - s * 0.05, 0.75, 0.13])];
  return (x, y, z) => {
    let d = rcone(x, y, z, [0, -0.01, 0], el, 0.054, 0.046);
    d = smin(d, rcone(x, y, z, el, wr, 0.046, 0.033), 0.02);
    // sleeve creases at the elbow
    d += 0.003 * Math.sin((y - el[1]) * 120) * Math.exp(-(((x - el[0]) ** 2) + ((y - el[1]) ** 2) + ((z - el[2]) ** 2)) / 0.004);
    d = smin(d, rcone(x, y, z, [wr[0], wr[1], wr[2] + 0.03], [wr[0], wr[1], wr[2] - 0.005], 0.041, 0.039), 0.006);   // lace shirt cuff
    d = smin(d, rcone(x, y, z, wr, hand, 0.025, 0.03), 0.015);
    d = smin(d, ell(x, y, z, hand, [0.042, 0.014, 0.034]), 0.012);
    for (const [a, b, c] of fingers) { d = smin(d, rcone(x, y, z, a, b, 0.0085, 0.0075), 0.006); d = smin(d, rcone(x, y, z, b, c, 0.0075, 0.006), 0.004); }
    d = smin(d, rcone(x, y, z, thumb[0], thumb[1], 0.0105, 0.008), 0.008);
    return d;
  };
}

// hands + lace cuffs bright, sleeves dark
function armTint(s) {
  const sh = SHOULDER[s < 0 ? 'L' : 'R'];
  return (x, y, z) => (z + sh[2] < 0.235 ? 1 : 0.15);
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
  { name: 'body', f: body, tint: bodyTint, min: [-0.3, 0.0, 0.2 - 0.1], max: [0.3, 1.24, 0.9], h: 0.0075 },
  { name: 'head', f: head, tint: headTint, min: [-0.12, -0.17, -0.14], max: [0.12, 0.15, 0.16], h: 0.0032 },
  { name: 'armL', f: makeArm(-1), tint: armTint(-1), min: [-0.12, -0.36, -0.56], max: [0.12, 0.08, 0.08], h: 0.005 },
  { name: 'armR', f: makeArm(1), tint: armTint(1), min: [-0.12, -0.36, -0.56], max: [0.12, 0.08, 0.08], h: 0.005 },
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
