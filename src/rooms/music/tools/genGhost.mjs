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

export const HEAD = [0, 1.31, 0.43];
export const SHOULDER = { L: [-0.205, 1.045, 0.5], R: [0.205, 1.045, 0.5] };

// ------------------------------------------------------------------ body (torso, coat, legs)
function body(x, y, z) {
  let d = ell(x, y, z, [0, 0.63, 0.6], [0.165, 0.1, 0.14]);                       // pelvis
  d = smin(d, rcone(x, y, z, [0, 0.66, 0.6], [0, 0.94, 0.51], 0.15, 0.165), 0.06); // torso, hunched forward
  d = smin(d, ell(x, y, z, [0, 1.0, 0.5], [0.215, 0.075, 0.115]), 0.07);          // shoulders
  for (const s of [-1, 1]) d = smin(d, sph(x, y, z, [s * 0.19, 1.02, 0.5], 0.07), 0.05);
  d = smin(d, rcone(x, y, z, [0, 1.03, 0.49], [0, 1.2, 0.45], 0.055, 0.045), 0.03); // neck
  // stand collar + cravat knot
  d = smin(d, rcone(x, y, z, [0, 1.05, 0.48], [0, 1.13, 0.46], 0.068, 0.062), 0.015);
  d = smin(d, ell(x, y, z, [0, 1.03, 0.405], [0.045, 0.06, 0.03]), 0.02);
  // lapels: shallow ridges down the chest
  for (const s of [-1, 1]) d = smin(d, rcone(x, y, z, [s * 0.08, 1.02, 0.43], [s * 0.02, 0.8, 0.43], 0.018, 0.012), 0.02);
  // coat tails falling behind the bench, split in two
  for (const s of [-1, 1]) d = smin(d, rcone(x, y, z, [s * 0.07, 0.66, 0.72], [s * 0.09, 0.3, 0.8], 0.06, 0.035), 0.05);
  // thighs + shins (the shader dissolves the legs away)
  for (const s of [-1, 1]) {
    d = smin(d, rcone(x, y, z, [s * 0.09, 0.6, 0.6], [s * 0.115, 0.585, 0.2], 0.08, 0.062), 0.04);
    d = smin(d, rcone(x, y, z, [s * 0.115, 0.585, 0.2], [s * 0.125, 0.09, 0.27], 0.056, 0.045), 0.03);
  }
  // cloth folds (wrinkles across the back and belly)
  d += 0.003 * Math.sin(y * 70 + Math.sin(x * 20) * 2) * Math.max(0, 1 - Math.abs(y - 0.8) * 3);
  return d;
}

// ------------------------------------------------------------------ head (relative to HEAD), faces -Z
function head(x, y, z) {
  let d = ell(x, y, z, [0, 0.018, 0.008], [0.075, 0.098, 0.093]);                 // cranium
  d = smin(d, ell(x, y, z, [0, -0.05, -0.02], [0.058, 0.05, 0.072]), 0.03);      // jaw
  d = smin(d, ell(x, y, z, [0, -0.088, -0.052], [0.026, 0.022, 0.026]), 0.02);   // chin
  d = smin(d, ell(x, y, z, [0, 0.036, -0.074], [0.064, 0.017, 0.026]), 0.015);   // brow ridge
  for (const s of [-1, 1]) {
    d = smin(d, ell(x, y, z, [s * 0.048, -0.012, -0.06], [0.022, 0.014, 0.022]), 0.015); // cheekbones
    d = smax(d, -sph(x, y, z, [s * 0.031, 0.012, -0.093], 0.021), 0.01);                  // sockets
    d = smin(d, sph(x, y, z, [s * 0.031, 0.011, -0.079], 0.0135), 0.004);                 // eyes
    d = smax(d, -ell(x, y, z, [s * 0.05, -0.052, -0.07], [0.018, 0.024, 0.012]), 0.012);  // hollow cheeks
    d = smin(d, ell(x, y, z, [s * 0.078, 0.0, 0.006], [0.012, 0.03, 0.02]), 0.01);       // ears
  }
  // nose: bridge to tip, with nostril wings
  d = smin(d, rcone(x, y, z, [0, 0.018, -0.086], [0, -0.03, -0.108], 0.009, 0.014), 0.008);
  for (const s of [-1, 1]) d = smin(d, sph(x, y, z, [s * 0.012, -0.034, -0.097], 0.009), 0.006);
  // mouth: a thin, downturned slit, and lips
  d = smin(d, ell(x, y, z, [0, -0.058, -0.088], [0.026, 0.01, 0.014]), 0.008);
  d = smax(d, -ell(x, y, z, [0, -0.059 - 0.004 * x * x * 400, -0.1], [0.024, 0.0025, 0.012]), 0.004);
  // hair: swept-back mane with grooves, kept off the face
  let hr = ell(x, y, z, [0, 0.04, 0.03], [0.085, 0.09, 0.1]);
  hr = smin(hr, ell(x, y, z, [0, 0.0, 0.09], [0.08, 0.1, 0.06]), 0.04);
  for (const s of [-1, 1]) hr = smin(hr, ell(x, y, z, [s * 0.075, 0.0, 0.05], [0.03, 0.07, 0.06]), 0.03);
  const ang = Math.atan2(x, z + 0.05);
  hr += 0.0035 * Math.sin(ang * 26 + y * 40);
  hr = smax(hr, -(z + 0.035 - Math.max(0, y - 0.04) * 0.6), 0.02);  // hairline (no hair over the face)
  hr = smax(hr, -(y + 0.035 - Math.max(0, z) * 0.6), 0.02);          // nothing under the jaw
  return smin(d, hr, 0.008);
}

// ------------------------------------------------------------------ arm (relative to shoulder), s = -1 left / +1 right
function makeArm(s) {
  const sh = SHOULDER[s < 0 ? 'L' : 'R'];
  const rel = (p) => [p[0] - sh[0], p[1] - sh[1], p[2] - sh[2]];
  const el = rel([s * 0.255, 0.85, 0.34]);
  const wr = rel([s * 0.18, 0.785, 0.14]);
  const hand = rel([s * 0.158, 0.77, 0.072]);
  const fingers = [0, 1, 2, 3].map((k) => {
    const off = (k - 1.5) * 0.019 * -s;
    return [rel([s * 0.158 + off, 0.772, 0.05]), rel([s * 0.158 + off * 1.1, 0.758, 0.012]), rel([s * 0.158 + off * 1.15, 0.738, -0.008])];
  });
  const thumb = [rel([s * 0.158 - s * 0.035, 0.77, 0.075]), rel([s * 0.158 - s * 0.05, 0.752, 0.035])];
  return (x, y, z) => {
    let d = sph(x, y, z, [0, 0, 0], 0.062);
    d = smin(d, rcone(x, y, z, [0, 0, 0], el, 0.056, 0.045), 0.03);
    d = smin(d, rcone(x, y, z, el, wr, 0.044, 0.031), 0.02);
    d = smin(d, rcone(x, y, z, wr, [wr[0], wr[1], wr[2] + 0.025], 0.04, 0.038), 0.008);   // cuff
    d = smin(d, ell(x, y, z, hand, [0.04, 0.014, 0.04]), 0.015);
    for (const [a, b, c] of fingers) { d = smin(d, rcone(x, y, z, a, b, 0.0085, 0.0075), 0.006); d = smin(d, rcone(x, y, z, b, c, 0.0075, 0.0062), 0.004); }
    d = smin(d, rcone(x, y, z, thumb[0], thumb[1], 0.01, 0.008), 0.008);
    return d;
  };
}

// ------------------------------------------------------------------ Surface Nets
function surfaceNets(f, min, max, h) {
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
  return { pos: new Float32Array(pos), nrm, idx: new Uint32Array(idx) };
}

// ------------------------------------------------------------------ build + write
const parts = [
  { name: 'body', f: body, min: [-0.3, 0.0, 0.2 - 0.1], max: [0.3, 1.24, 0.9], h: 0.0095 },
  { name: 'head', f: head, min: [-0.11, -0.13, -0.13], max: [0.11, 0.14, 0.15], h: 0.0032 },
  { name: 'armL', f: makeArm(-1), min: [-0.12, -0.36, -0.56], max: [0.12, 0.08, 0.08], h: 0.005 },
  { name: 'armR', f: makeArm(1), min: [-0.12, -0.36, -0.56], max: [0.12, 0.08, 0.08], h: 0.005 },
];
const chunks = [];
const header = { parts: [], head: HEAD, shoulders: SHOULDER };
let offset = 0;
for (const p of parts) {
  const t0 = Date.now();
  const m = surfaceNets(p.f, p.min, p.max, p.h);
  const n8 = new Int8Array((m.pos.length / 3) * 4);
  for (let i = 0; i < m.pos.length / 3; i++) { n8[i * 4] = Math.round(m.nrm[i * 3] * 127); n8[i * 4 + 1] = Math.round(m.nrm[i * 3 + 1] * 127); n8[i * 4 + 2] = Math.round(m.nrm[i * 3 + 2] * 127); }
  const entry = { name: p.name, vertices: m.pos.length / 3, indices: m.idx.length, pos: offset };
  chunks.push(Buffer.from(m.pos.buffer)); offset += m.pos.byteLength;
  entry.nrm = offset; chunks.push(Buffer.from(n8.buffer)); offset += n8.byteLength;
  entry.idx = offset; chunks.push(Buffer.from(m.idx.buffer)); offset += m.idx.byteLength;
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
