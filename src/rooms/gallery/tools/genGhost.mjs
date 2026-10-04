#!/usr/bin/env node
/**
 * Offline sculpt of the grey lady as ONE closed surface (signed distance field -> surface nets).
 *
 * Previous versions stacked separate lathe shells (gown, sleeves, veil, head) and rendered them
 * additively, so every inner shell boundary showed through as "cellophane". Here the gown, folded
 * arms, neck, sculpted head (brow, sockets, nose, cheekbones, lips, chin) and a solid hood/cape are
 * all smooth-unioned into a single SDF and polygonised once: seen from any side the figure has one
 * front-facing layer, so additive shading reads as one body of mist.
 *
 * Output: public/assets/gallery/ghost_mesh.bin
 *   Uint32 nv, Uint32 ni, Float32 bboxMin[3], Float32 bboxMax[3], Uint16 pos[nv*3] (quantised in the bbox, +pad to 4),
 *   Int8 nrm[nv*3] (+pad to 4), Uint8 part[nv] (+pad), Uint32 idx[ni]
 *   part: 0 gown, 1 face/head skin, 2 hood, 3 arms/hands
 *
 *   node src/rooms/gallery/tools/genGhost.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../../../public/assets/gallery/ghost_mesh.bin');

// ------------------------------------------------------------------ SDF primitives
const len2 = (x, y) => Math.sqrt(x * x + y * y);
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function sdEll(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = px - cx, y = py - cy, z = pz - cz;
  const k0 = len3(x / rx, y / ry, z / rz), k1 = len3(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
}
function sdCap(px, py, pz, ax, ay, az, bx, by, bz, ra, rb = ra) {
  const pax = px - ax, pay = py - ay, paz = pz - az, bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return len3(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
function vnoise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; }

// gown profile: [y, rx, rz] resampled smoothly (Catmull-Rom)
const KEYS = [
  [0.0, 0.34, 0.28], [0.18, 0.315, 0.255], [0.42, 0.272, 0.212], [0.66, 0.222, 0.172], [0.86, 0.172, 0.132],
  [0.98, 0.148, 0.112], [1.1, 0.16, 0.116], [1.2, 0.168, 0.118], [1.28, 0.17, 0.11], [1.33, 0.15, 0.095],
  [1.37, 0.11, 0.075], [1.4, 0.05, 0.045],
];
function cr(p0, p1, p2, p3, t) { return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t); }
function gownR(y) {
  if (y <= KEYS[0][0]) return [KEYS[0][1], KEYS[0][2]];
  if (y >= KEYS[KEYS.length - 1][0]) return [KEYS[KEYS.length - 1][1], KEYS[KEYS.length - 1][2]];
  let i = 0; while (KEYS[i + 1][0] < y) i++;
  const k0 = KEYS[Math.max(0, i - 1)], k1 = KEYS[i], k2 = KEYS[i + 1], k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
  const t = (y - k1[0]) / (k2[0] - k1[0]);
  return [cr(k0[1], k1[1], k2[1], k3[1], t), cr(k0[2], k1[2], k2[2], k3[2], t)];
}

function gown(x, y, z) {
  const [rx, rz] = gownR(y);
  const a = Math.atan2(x, z);                                    // 0 = front
  const low = 1 - sstep(0.15, 1.0, y);
  // deep soft folds falling from the waist, a broad swag on one side, a train pulled back
  const fold = (0.075 * Math.sin(a * 8 + 0.7 + y * 1.3) + 0.035 * Math.sin(a * 15 + 2.1 - y * 2.0) + 0.02 * Math.sin(a * 23 + 4.0)) * low
    + 0.04 * Math.sin(a + 0.4) * low * low;
  const q = len2(x / rx, z / rz);
  let d = (q - 1 - fold) * Math.min(rx, rz) * 0.85;
  // ragged, lifted hem: the cloth thins out into nothing near the floor
  const hem = 0.03 + 0.07 * vnoise1(a * 3.0 + 10) + 0.04 * vnoise1(a * 9.0 + 3);
  d = smax(d, hem - y, 0.03);
  d = Math.max(d, y - 1.42);
  return d;
}

function arms(x, y, z) {
  let d = 1e9;
  for (const s of [-1, 1]) {
    const P = [[s * 0.172, 1.3, -0.012], [s * 0.208, 1.12, 0.0], [s * 0.19, 0.985, 0.075], [s * 0.085, 0.905, 0.15], [s * 0.02, 0.895, 0.165]];
    const R = [0.05, 0.047, 0.044, 0.036, 0.03];
    for (let i = 0; i < P.length - 1; i++) d = smin(d, sdCap(x, y, z, ...P[i], ...P[i + 1], R[i], R[i + 1]), 0.02);
    // a loose bell of sleeve at the elbow
    d = smin(d, sdEll(x, y, z, s * 0.2, 1.0, 0.06, 0.06, 0.05, 0.06), 0.03);
  }
  // clasped hands
  d = smin(d, sdEll(x, y, z, 0.0, 0.893, 0.172, 0.052, 0.03, 0.036), 0.02);
  return d;
}

function head(x, y, z) {
  let d = sdEll(x, y, z, 0.0, 1.556, -0.008, 0.074, 0.094, 0.088);              // cranium
  d = smin(d, sdEll(x, y, z, 0.0, 1.5, 0.02, 0.06, 0.074, 0.066), 0.035);        // face mass / jaw
  // brow ridge, cheekbones
  d = smin(d, sdCap(x, y, z, -0.042, 1.553, 0.07, 0.042, 1.553, 0.07, 0.009), 0.018);
  for (const s of [-1, 1]) d = smin(d, sdEll(x, y, z, s * 0.039, 1.516, 0.058, 0.022, 0.016, 0.02), 0.02);
  // eye sockets carved, eyeballs left in them (lids implied)
  for (const s of [-1, 1]) {
    d = smax(d, -sdEll(x, y, z, s * 0.031, 1.537, 0.086, 0.018, 0.010, 0.011), 0.008);
    d = smin(d, sdEll(x, y, z, s * 0.031, 1.535, 0.07, 0.0128, 0.0108, 0.0112), 0.005);
  }
  // nose: bridge to tip, alae
  d = smin(d, sdCap(x, y, z, 0.0, 1.542, 0.08, 0.0, 1.506, 0.098, 0.0065, 0.0085), 0.012);
  for (const s of [-1, 1]) d = smin(d, sdEll(x, y, z, s * 0.011, 1.503, 0.087, 0.0075, 0.0065, 0.007), 0.006);
  // lips + mouth line, chin
  d = smin(d, sdEll(x, y, z, 0.0, 1.4875, 0.083, 0.019, 0.0055, 0.0085), 0.008);
  d = smin(d, sdEll(x, y, z, 0.0, 1.4775, 0.081, 0.016, 0.0062, 0.0085), 0.008);
  d = smax(d, -sdCap(x, y, z, -0.017, 1.4825, 0.091, 0.017, 1.4825, 0.091, 0.0018), 0.003);
  d = smin(d, sdEll(x, y, z, 0.0, 1.458, 0.07, 0.019, 0.015, 0.016), 0.016);
  // neck
  d = smin(d, sdCap(x, y, z, 0.0, 1.33, -0.005, 0.0, 1.47, 0.0, 0.047, 0.042), 0.03);
  return d;
}

function hood(x, y, z) {
  // a heavy veil worn close over the crown, falling into a cape over the shoulders; the front is
  // cut away in an oval that frames the whole face
  let d = sdEll(x, y, z, 0.0, 1.548, -0.022, 0.097, 0.112, 0.106);
  d = smin(d, sdCap(x, y, z, 0.0, 1.47, -0.045, 0.0, 1.2, -0.03, 0.098, 0.215), 0.08);
  const a = Math.atan2(x, z + 0.04);
  const fold = 0.011 * Math.sin(a * 7 + y * 6) * sstep(1.45, 1.2, y);
  d -= fold;
  d = Math.max(d, 1.13 - y + 0.04 * Math.sin(a * 3 + 1.0));
  // face opening, and a small parting of the cape at the throat
  const open = sdEll(x, y, z, 0.0, 1.5, 0.12, 0.079, 0.112, 0.135);
  d = smax(d, -open, 0.016);
  return d;
}

function figure(x, y, z) {
  const g = gown(x, y, z), ar = arms(x, y, z), h = head(x, y, z), hd = hood(x, y, z);
  let d = smin(g, ar, 0.03);
  d = smin(d, h, 0.02);
  d = smin(d, hd, 0.025);
  return d;
}
function partOf(x, y, z) {
  const g = gown(x, y, z), ar = arms(x, y, z), h = head(x, y, z), hd = hood(x, y, z);
  const m = Math.min(g, ar, h, hd);
  return m === h ? 1 : m === hd ? 2 : m === ar ? 3 : 0;
}

// ------------------------------------------------------------------ surface nets
const H = 0.006;
const B0 = [-0.44, -0.01, -0.38], B1 = [0.44, 1.74, 0.42];
const NX = Math.ceil((B1[0] - B0[0]) / H) + 1, NY = Math.ceil((B1[1] - B0[1]) / H) + 1, NZ = Math.ceil((B1[2] - B0[2]) / H) + 1;
console.log('grid', NX, NY, NZ, (NX * NY * NZ / 1e6).toFixed(1), 'M');
const F = new Float32Array(NX * NY * NZ);
const at = (i, j, k) => (k * NY + j) * NX + i;
for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) F[at(i, j, k)] = figure(B0[0] + i * H, B0[1] + j * H, B0[2] + k * H);
console.log('sampled');
const vid = new Int32Array((NX - 1) * (NY - 1) * (NZ - 1)).fill(-1);
const cat = (i, j, k) => (k * (NY - 1) + j) * (NX - 1) + i;
const pos = [];
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
const CO = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const v8 = new Float32Array(8);
for (let k = 0; k < NZ - 1; k++) for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
  let neg = 0;
  for (let c = 0; c < 8; c++) { v8[c] = F[at(i + CO[c][0], j + CO[c][1], k + CO[c][2])]; if (v8[c] < 0) neg++; }
  if (neg === 0 || neg === 8) continue;
  let sx = 0, sy = 0, sz = 0, n = 0;
  for (const [a, b] of EDGES) {
    if ((v8[a] < 0) === (v8[b] < 0)) continue;
    const t = v8[a] / (v8[a] - v8[b]);
    sx += CO[a][0] + (CO[b][0] - CO[a][0]) * t; sy += CO[a][1] + (CO[b][1] - CO[a][1]) * t; sz += CO[a][2] + (CO[b][2] - CO[a][2]) * t; n++;
  }
  vid[cat(i, j, k)] = pos.length / 3;
  pos.push(B0[0] + (i + sx / n) * H, B0[1] + (j + sy / n) * H, B0[2] + (k + sz / n) * H);
}
const idx = [];
const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
for (let k = 1; k < NZ - 1; k++) for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
  const v0 = F[at(i, j, k)];
  const s0 = v0 < 0;
  // x edge (i,j,k)-(i+1,j,k): cells sharing it differ in j,k
  if (i < NX - 1 && s0 !== (F[at(i + 1, j, k)] < 0)) quad(vid[cat(i, j - 1, k - 1)], vid[cat(i, j, k - 1)], vid[cat(i, j, k)], vid[cat(i, j - 1, k)], !s0);
  if (j < NY - 1 && s0 !== (F[at(i, j + 1, k)] < 0)) quad(vid[cat(i - 1, j, k - 1)], vid[cat(i - 1, j, k)], vid[cat(i, j, k)], vid[cat(i, j, k - 1)], !s0);
  if (k < NZ - 1 && s0 !== (F[at(i, j, k + 1)] < 0)) quad(vid[cat(i - 1, j - 1, k)], vid[cat(i, j - 1, k)], vid[cat(i, j, k)], vid[cat(i - 1, j, k)], !s0);
}
const nv = pos.length / 3;
// one pass of gentle Laplacian smoothing (kills the grid stair-steps on slow curves)
{
  const acc = new Float64Array(nv * 3), cnt = new Uint16Array(nv);
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = idx[t + e], b = idx[t + (e + 1) % 3];
    for (let c = 0; c < 3; c++) { acc[a * 3 + c] += pos[b * 3 + c]; acc[b * 3 + c] += pos[a * 3 + c]; }
    cnt[a]++; cnt[b]++;
  }
  for (let v = 0; v < nv; v++) if (cnt[v]) for (let c = 0; c < 3; c++) pos[v * 3 + c] = pos[v * 3 + c] * 0.5 + 0.5 * acc[v * 3 + c] / cnt[v];
}
// normals from the SDF gradient; part ids
const nrm = new Int8Array(Math.ceil(nv * 3 / 4) * 4), part = new Uint8Array(Math.ceil(nv / 4) * 4);
const e = 0.0015;
for (let v = 0; v < nv; v++) {
  const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
  let gx = figure(x + e, y, z) - figure(x - e, y, z), gy = figure(x, y + e, z) - figure(x, y - e, z), gz = figure(x, y, z + e) - figure(x, y, z - e);
  const l = len3(gx, gy, gz) || 1; gx /= l; gy /= l; gz /= l;
  nrm[v * 3] = Math.round(gx * 127); nrm[v * 3 + 1] = Math.round(gy * 127); nrm[v * 3 + 2] = Math.round(gz * 127);
  part[v] = partOf(x, y, z);
}
const head4 = new Uint32Array([nv, idx.length]);
const bb = new Float32Array([...B0, ...B1]);
const qp = new Uint16Array(Math.ceil(nv * 3 / 2) * 2);
for (let v = 0; v < nv; v++) for (let c = 0; c < 3; c++) qp[v * 3 + c] = Math.round(clamp((pos[v * 3 + c] - B0[c]) / (B1[c] - B0[c]), 0, 1) * 65535);
const buf = Buffer.concat([Buffer.from(head4.buffer), Buffer.from(bb.buffer), Buffer.from(qp.buffer), Buffer.from(nrm.buffer), Buffer.from(part.buffer), Buffer.from(new Uint32Array(idx).buffer)]);
fs.writeFileSync(OUT, buf);
console.log('verts', nv, 'tris', idx.length / 3, 'bytes', buf.length, '->', path.relative(process.cwd(), OUT));
