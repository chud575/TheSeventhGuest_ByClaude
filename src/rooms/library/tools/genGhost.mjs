#!/usr/bin/env node
// Offline mesher for the library ghost bust: polygonises the SDF sculpt in
// ghostSdf.mjs with Surface Nets (+ Newton projection onto the surface), paints
// vertex colours and writes public/assets/library/ghost.bin.
//   node src/rooms/library/tools/genGhost.mjs [--h 0.0015]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { headSdf, hairSdf, browSdf, cravatSdf, coatSdf, waistcoatSdf, headColor, smax, smin } from './ghostSdf.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../../../public/assets/library/ghost.bin');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? Number(process.argv[i + 1]) : d; };
const H = arg('h', 0.0015);

function surfaceNets(f, min, max, h) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1, ny = Math.ceil((max[1] - min[1]) / h) + 1, nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const N = nx * ny * nz;
  const field = new Float32Array(N);
  const id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    field[id(i, j, k)] = f(min[0] + i * h, min[1] + j * h, min[2] + k * h);
  }
  const cellVert = new Int32Array(N).fill(-1);
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) { const [a, b, d] = corners[c]; v[c] = field[id(i + a, j + b, k + d)]; if (v[c] < 0) inside++; }
    if (inside === 0 || inside === 8) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [e0, e1] of edges) {
      if ((v[e0] < 0) === (v[e1] < 0)) continue;
      const t = v[e0] / (v[e0] - v[e1]);
      const c0 = corners[e0], c1 = corners[e1];
      sx += c0[0] + (c1[0] - c0[0]) * t; sy += c0[1] + (c1[1] - c0[1]) * t; sz += c0[2] + (c1[2] - c0[2]) * t; cnt++;
    }
    cellVert[id(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / cnt) * h, min[1] + (j + sy / cnt) * h, min[2] + (k + sz / cnt) * h);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
  };
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const f0 = field[id(i, j, k)] < 0;
    if (j > 0 && k > 0 && f0 !== (field[id(i + 1, j, k)] < 0)) // x edge
      quad(cellVert[id(i, j - 1, k - 1)], cellVert[id(i, j, k - 1)], cellVert[id(i, j, k)], cellVert[id(i, j - 1, k)], !f0);
    if (i > 0 && k > 0 && f0 !== (field[id(i, j + 1, k)] < 0)) // y edge
      quad(cellVert[id(i - 1, j, k - 1)], cellVert[id(i - 1, j, k)], cellVert[id(i, j, k)], cellVert[id(i, j, k - 1)], !f0);
    if (i > 0 && j > 0 && f0 !== (field[id(i, j, k + 1)] < 0)) // z edge
      quad(cellVert[id(i - 1, j - 1, k)], cellVert[id(i, j - 1, k)], cellVert[id(i, j, k)], cellVert[id(i - 1, j, k)], !f0);
  }
  // project onto surface + gradient normals
  const nrm = new Float32Array(pos.length);
  const e = h * 0.35;
  for (let n = 0; n < pos.length; n += 3) {
    let x = pos[n], y = pos[n + 1], z = pos[n + 2];
    let gx = 0, gy = 0, gz = 0;
    for (let it = 0; it < 3; it++) {
      const d = f(x, y, z);
      gx = f(x + e, y, z) - f(x - e, y, z); gy = f(x, y + e, z) - f(x, y - e, z); gz = f(x, y, z + e) - f(x, y, z - e);
      const g2 = gx * gx + gy * gy + gz * gz;
      if (g2 < 1e-14) break;
      const s = (d * 2 * e) / g2;
      const step = Math.min(1, h * 0.75 / Math.max(1e-9, Math.abs(s) * Math.sqrt(g2)));
      x -= s * gx * step; y -= s * gy * step; z -= s * gz * step;
    }
    const gl = Math.hypot(gx, gy, gz) || 1;
    pos[n] = x; pos[n + 1] = y; pos[n + 2] = z;
    nrm[n] = gx / gl; nrm[n + 1] = gy / gl; nrm[n + 2] = gz / gl;
  }
  return { pos: new Float32Array(pos), nrm, idx: new Uint32Array(idx) };
}

const parts = [
  { name: 'head', f: headSdf, min: [-0.1, -0.115, -0.115], max: [0.1, 0.2, 0.14], h: H * 0.8, region: 'skin' },
  {
    name: 'hair', h: H * 0.75,
    f: (x, y, z) => smax(Math.min(hairSdf(x, y, z), browSdf(x, y, z)), -(headSdf(x, y, z) + 0.0002), 0.0006),
    min: [-0.1, 0.02, -0.115], max: [0.1, 0.19, 0.11], region: 'hair',
  },
  { name: 'cravat', f: cravatSdf, min: [-0.1, -0.29, -0.07], max: [0.1, -0.02, 0.135], h: H * 0.7, region: 'cravat' },
  { name: 'waistcoat', f: (x, y, z) => smax(waistcoatSdf(x, y, z), -(cravatSdf(x, y, z) + 0.0015), 0.003), min: [-0.15, -0.52, -0.06], max: [0.15, -0.1, 0.13], h: H * 1.4, region: 'waistcoat' },
  { name: 'coat', f: (x, y, z) => smax(coatSdf(x, y, z), -(cravatSdf(x, y, z) + 0.002), 0.004), min: [-0.26, -0.56, -0.16], max: [0.26, -0.04, 0.15], h: H * 1.8, region: 'coat' },
];
// whole-figure field for ambient occlusion (creases, the stock shading the jaw, etc.)
const all = (x, y, z) => Math.min(headSdf(x, y, z), cravatSdf(x, y, z), coatSdf(x, y, z), waistcoatSdf(x, y, z));
function bakeAO(px, py, pz, nx, ny, nz) {
  let occ = 0, w = 1;
  for (let i = 1; i <= 6; i++) {
    const hh = 0.0018 * i * i * 0.6 + 0.0008;
    const d = all(px + nx * hh, py + ny * hh, pz + nz * hh);
    occ += w * Math.max(0, hh - d);
    w *= 0.62;
  }
  return Math.max(0, Math.min(1, 1 - occ * 45));
}

const meshes = [];
for (const p of parts) {
  const t0 = Date.now();
  const m = surfaceNets(p.f, p.min, p.max, p.h);
  const col = new Uint8Array((m.pos.length / 3) * 4);
  for (let n = 0, c = 0; n < m.pos.length; n += 3, c += 4) {
    const rgb = headColor(m.pos[n], m.pos[n + 1], m.pos[n + 2], p.region === 'hair' ? 'hair' : p.region);
    const ao = bakeAO(m.pos[n], m.pos[n + 1], m.pos[n + 2], m.nrm[n], m.nrm[n + 1], m.nrm[n + 2]);
    const k = 0.5 + 0.5 * Math.pow(ao, 1.2);
    rgb[0] *= k; rgb[1] *= k; rgb[2] *= k;
    const lin = (v) => { v = Math.min(1, Math.max(0, v)); return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    col[c] = Math.round(lin(rgb[0]) * 255); col[c + 1] = Math.round(lin(rgb[1]) * 255); col[c + 2] = Math.round(lin(rgb[2]) * 255); col[c + 3] = 255;
  }
  const nrm8 = new Int8Array((m.pos.length / 3) * 4);
  for (let n = 0, c = 0; n < m.pos.length; n += 3, c += 4) { nrm8[c] = Math.round(m.nrm[n] * 127); nrm8[c + 1] = Math.round(m.nrm[n + 1] * 127); nrm8[c + 2] = Math.round(m.nrm[n + 2] * 127); }
  // quantise positions to int16 inside the part's bounds
  const q = new Int16Array(m.pos.length);
  const qmin = [Infinity, Infinity, Infinity], qmax = [-Infinity, -Infinity, -Infinity];
  for (let n = 0; n < m.pos.length; n++) { const a = n % 3; qmin[a] = Math.min(qmin[a], m.pos[n]); qmax[a] = Math.max(qmax[a], m.pos[n]); }
  const qs = [0, 1, 2].map((a) => Math.max(1e-9, qmax[a] - qmin[a]) / 65534);
  for (let n = 0; n < m.pos.length; n++) { const a = n % 3; q[n] = Math.round((m.pos[n] - qmin[a]) / qs[a]) - 32767; }
  meshes.push({ name: p.name, pos: q, qmin, qs, nrm: nrm8, col, idx: m.idx });
  console.log(`${p.name}: ${m.pos.length / 3} verts, ${m.idx.length / 3} tris, ${Date.now() - t0} ms`);
}

// layout: [u32 headerLen][header json padded to 4][buffers...]
const header = { version: 2, parts: [] };
let offset = 0;
const chunks = [];
for (const m of meshes) {
  const entry = { name: m.name, vertices: m.pos.length / 3, indices: m.idx.length, qmin: m.qmin, qs: m.qs };
  for (const [k, arr] of [['pos', m.pos], ['idx', m.idx], ['nrm', m.nrm], ['col', m.col]]) {
    entry[k] = offset; chunks.push(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)); offset += arr.byteLength;
    const pad = (4 - (offset % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  }
  header.parts.push(entry);
}
let hj = Buffer.from(JSON.stringify(header));
const hp = (4 - (hj.length % 4)) % 4;
hj = Buffer.concat([hj, Buffer.alloc(hp, 32)]);
const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32LE(hj.length);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([lenBuf, hj, ...chunks]));
console.log('wrote', out, (fs.statSync(out).size / 1e6).toFixed(2), 'MB');
