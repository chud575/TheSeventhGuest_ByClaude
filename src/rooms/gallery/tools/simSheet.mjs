#!/usr/bin/env node
/**
 * Offline cloth drape for the dust-sheeted bust (Verlet + SDF collisions), deterministic.
 * A square linen sheet is dropped, slightly rotated, over a sculpted bust proxy (head, brow,
 * nose, chin, neck, shoulder caps, chest) standing on the ebonised pedestal. Static friction on
 * contact holds the tension lines that radiate from the nose, brow and shoulders; the free cloth
 * hangs and buckles into its own folds. Output: public/assets/gallery/dustsheet.bin
 *   header (Uint32 N), then N*N*3 Float32 positions (bust-local metres, origin at floor), then
 *   N*N Float32 "contact" (1 = resting on the form, 0 = hanging free).
 *
 *   node src/rooms/gallery/tools/simSheet.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../../../public/assets/gallery/dustsheet.bin');

const N = 81, SIZE = 1.5;                 // particles per side, cloth width (m)
const TOP = 1.0;
const FRICTION = 0.08;
const CLING = 0.0024;                // per-step pull of the cloth onto the head/face (m)               // fraction of tangential slide kept while in contact                            // abacus top (bust sits here)

// ---------------------------------------------------------------- SDF of the hidden form
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
function sdEll(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = px - cx, y = py - cy, z = pz - cz;
  const k0 = len3(x / rx, y / ry, z / rz), k1 = len3(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
}
function sdCap(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax, pay = py - ay, paz = pz - az, bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  return len3(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}
function sdBox(px, py, pz, cx, cy, cz, hx, hy, hz, r = 0) {
  const qx = Math.abs(px - cx) - hx + r, qy = Math.abs(py - cy) - hy + r, qz = Math.abs(pz - cz) - hz + r;
  return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
function sdCyl(px, py, pz, cy, h, r) {
  const dx = Math.hypot(px, pz) - r, dy = Math.abs(py - cy) - h;
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const T = TOP;
export function formSDF(x, y, z) {
  // head turned a touch to its left, chin slightly raised
  let d = sdEll(x, y, z, 0.0, T + 0.385, 0.0, 0.088, 0.112, 0.102);
  d = smin(d, sdCap(x, y, z, -0.048, T + 0.408, 0.082, 0.048, T + 0.408, 0.082, 0.02), 0.03);      // brow
  d = smin(d, sdCap(x, y, z, 0.0, T + 0.392, 0.1, 0.0, T + 0.352, 0.128, 0.018), 0.02);           // nose
  d = smin(d, sdEll(x, y, z, 0.0, T + 0.3, 0.07, 0.04, 0.032, 0.035), 0.03);                         // chin
  d = smin(d, sdEll(x, y, z, 0.0, T + 0.47, -0.035, 0.07, 0.04, 0.06), 0.04);                         // hair knot
  d = smin(d, sdCap(x, y, z, 0.0, T + 0.2, -0.005, 0.0, T + 0.31, 0.01, 0.056), 0.03);              // neck
  d = smin(d, sdCap(x, y, z, -0.17, T + 0.205, -0.01, 0.17, T + 0.205, -0.01, 0.062), 0.08);         // shoulder line
  d = smin(d, sdEll(x, y, z, 0.0, T + 0.13, 0.0, 0.215, 0.11, 0.115), 0.05);                          // chest
  d = smin(d, sdEll(x, y, z, 0.0, T + 0.155, 0.055, 0.15, 0.06, 0.07), 0.04);                         // breastplate fold
  d = smin(d, sdCyl(x, y, z, T + 0.03, 0.03, 0.1), 0.02);                                              // socle
  // pedestal: abacus, capital, shaft, plinth, floor
  d = Math.min(d, sdBox(x, y, z, 0, T - 0.02, 0, 0.16, 0.02, 0.16, 0.004));
  d = Math.min(d, sdCyl(x, y, z, T - 0.06, 0.03, 0.145));
  d = Math.min(d, sdCyl(x, y, z, 0.5, 0.42, 0.1));
  d = Math.min(d, sdBox(x, y, z, 0, 0.06, 0, 0.18, 0.06, 0.18));
  d = Math.min(d, y);
  return d;
}

// ---------------------------------------------------------------- simulation
export function simulate({ steps = 420, iters = 8, log = false } = {}) {
  const P = N * N;
  const p = new Float64Array(P * 3), q = new Float64Array(P * 3), contact = new Float32Array(P);
  const rot = 0.38, cr = Math.cos(rot), sr = Math.sin(rot);
  const ox = 0.02, oz = 0.11;
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i / (N - 1) - 0.5) * SIZE, v = (j / (N - 1) - 0.5) * SIZE;
    const k = (j * N + i) * 3;
    // a gentle dome so the drop starts centred on the crown
    const r2 = u * u + v * v;
    p[k] = u * cr - v * sr + ox; p[k + 2] = u * sr + v * cr + oz; p[k + 1] = T + 0.53 - r2 * 0.12 + (rnd() - 0.5) * 0.002;
    q[k] = p[k]; q[k + 1] = p[k + 1]; q[k + 2] = p[k + 2];
  }
  // constraints: structural, shear, bend (2-apart)
  const cons = [];
  const add = (a, b, stiff) => { const dx = p[a * 3] - p[b * 3], dy = p[a * 3 + 1] - p[b * 3 + 1], dz = p[a * 3 + 2] - p[b * 3 + 2]; cons.push(a, b, Math.sqrt(dx * dx + dy * dy + dz * dz), stiff); };
  const rest = SIZE / (N - 1);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * N + i;
    if (i < N - 1) add(a, a + 1, 1.0);
    if (j < N - 1) add(a, a + N, 1.0);
    if (i < N - 1 && j < N - 1) { add(a, a + N + 1, 0.6); add(a + 1, a + N, 0.6); }
    if (i < N - 2) add(a, a + 2, 0.06);
    if (j < N - 2) add(a, a + 2 * N, 0.06);
  }
  // rest lengths from a flat sheet (not the dome)
  for (let c = 0; c < cons.length; c += 4) {
    const a = cons[c], b = cons[c + 1];
    const ai = a % N, aj = (a / N) | 0, bi = b % N, bj = (b / N) | 0;
    cons[c + 2] = Math.hypot(ai - bi, aj - bj) * rest;
  }
  const C = new Float64Array(cons);
  const CEN = ((N - 1) / 2) * N + (N - 1) / 2;
  const LRA = new Float64Array(P);
  for (let a = 0; a < P; a++) LRA[a] = Math.hypot((a % N) - (N - 1) / 2, ((a / N) | 0) - (N - 1) / 2) * rest * 1.01;
  const dt = 1 / 150, g = -9.81 * dt * dt;
  const margin = 0.0045, e = 0.0015;
  for (let step = 0; step < steps; step++) {
    const damp = step < steps * 0.7 ? 0.985 : 0.93;     // settle at the end
    for (let a = 0; a < P; a++) {
      const k = a * 3;
      for (let c = 0; c < 3; c++) {
        const cur = p[k + c];
        const vel = (cur - q[k + c]) * damp;
        q[k + c] = cur;
        p[k + c] = cur + vel + (c === 1 ? g : 0);
      }
    }
    for (let it = 0; it < iters; it++) {
      for (let c = 0; c < C.length; c += 4) {
        const a = C[c] * 3, b = C[c + 1] * 3, r = C[c + 2], st = C[c + 3];
        const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
        // stretch resists hard, compression softly (cloth buckles instead of shrinking)
        let diff = (d - r) / d;
        if (diff < 0) diff *= 0.35;
        const f = 0.5 * diff * st;
        p[a] += dx * f; p[a + 1] += dy * f; p[a + 2] += dz * f;
        p[b] -= dx * f; p[b + 1] -= dy * f; p[b + 2] -= dz * f;
      }
      // long-range attachments: no particle may drift further from the crown particle than it
      // lies on the flat sheet (kills the rubbery sag of an iterative solver)
      {
        const c3 = CEN * 3;
        for (let a = 0; a < P; a++) {
          const k = a * 3;
          const dx = p[k] - p[c3], dy = p[k + 1] - p[c3 + 1], dz = p[k + 2] - p[c3 + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d > LRA[a]) { const f = (d - LRA[a]) / d; p[k] -= dx * f; p[k + 1] -= dy * f; p[k + 2] -= dz * f; }
        }
      }
      // collisions every iteration (cheap enough, keeps the cloth off the form)
      if (it % 2 === 1 || it === iters - 1) for (let a = 0; a < P; a++) {
        const k = a * 3;
        const x = p[k], y = p[k + 1], z = p[k + 2];
        if (y > 1.6) continue;
        const d = formSDF(x, y, z);
        // fine linen clings: over the head and face the cloth is drawn gently onto the form so
        // the brow, nose and chin print through instead of tenting over them
        if (it === iters - 1 && d > margin && d < 0.1 && y > T + 0.24 && step > 60) {
          const nx = formSDF(x + e, y, z) - formSDF(x - e, y, z), ny = formSDF(x, y + e, z) - formSDF(x, y - e, z), nz = formSDF(x, y, z + e) - formSDF(x, y, z - e);
          const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          const pull = Math.min(d - margin, CLING) * (z > 0 ? 1.0 : 0.5);
          p[k] -= nx / nl * pull; p[k + 1] -= ny / nl * pull; p[k + 2] -= nz / nl * pull;
          continue;
        }
        if (d < margin) {
          const nx = formSDF(x + e, y, z) - formSDF(x - e, y, z), ny = formSDF(x, y + e, z) - formSDF(x, y - e, z), nz = formSDF(x, y, z + e) - formSDF(x, y, z - e);
          const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          const push = margin - d;
          p[k] += nx / nl * push; p[k + 1] += ny / nl * push; p[k + 2] += nz / nl * push;
          // static friction (once per step): keep the normal part of this step's motion, but only
          // a sliver of the tangential slide, so the cloth grips the form instead of sliding off
          if (it === iters - 1) {
            const ux = nx / nl, uy = ny / nl, uz = nz / nl;
            const dx = p[k] - q[k], dy = p[k + 1] - q[k + 1], dz = p[k + 2] - q[k + 2];
            const dn = dx * ux + dy * uy + dz * uz;
            const kt = FRICTION;
            p[k] = q[k] + ux * dn + (dx - ux * dn) * kt; p[k + 1] = q[k + 1] + uy * dn + (dy - uy * dn) * kt; p[k + 2] = q[k + 2] + uz * dn + (dz - uz * dn) * kt;
          }
          contact[a] = 1;
        } else if (d > margin * 3) contact[a] = Math.max(0, contact[a] - 0.02);
      }
    }
    if (log && step % 60 === 0) console.log('step', step);
  }
  // relax solver jitter on the free cloth, then re-project everything off the form so smoothing
  // can never pull the linen inside the bust or through the abacus corners
  for (let pass = 0; pass < 3; pass++) {
    const tmp = Float64Array.from(p);
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const a = j * N + i, w = 0.5 * (1 - 0.85 * contact[a]);
      for (let c = 0; c < 3; c++) {
        const avg = (tmp[(a - 1) * 3 + c] + tmp[(a + 1) * 3 + c] + tmp[(a - N) * 3 + c] + tmp[(a + N) * 3 + c]) / 4;
        p[a * 3 + c] = tmp[a * 3 + c] + (avg - tmp[a * 3 + c]) * w;
      }
    }
    for (let a = 0; a < P; a++) {
      const k = a * 3, x = p[k], y = p[k + 1], z = p[k + 2];
      const d = formSDF(x, y, z), m = 0.007;
      if (d < m) {
        const nx = formSDF(x + e, y, z) - formSDF(x - e, y, z), ny = formSDF(x, y + e, z) - formSDF(x, y - e, z), nz = formSDF(x, y, z + e) - formSDF(x, y, z - e);
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        p[k] += nx / nl * (m - d); p[k + 1] += ny / nl * (m - d); p[k + 2] += nz / nl * (m - d);
      }
    }
  }
  return { N, positions: Float32Array.from(p), contact };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t0 = Date.now();
  const r = simulate({ log: true });
  const buf = Buffer.alloc(4 + r.positions.byteLength + r.contact.byteLength);
  buf.writeUInt32LE(r.N, 0);
  Buffer.from(r.positions.buffer).copy(buf, 4);
  Buffer.from(r.contact.buffer).copy(buf, 4 + r.positions.byteLength);
  fs.writeFileSync(OUT, buf);
  let minY = 9; for (let i = 1; i < r.positions.length; i += 3) minY = Math.min(minY, r.positions[i]);
  console.log('wrote', OUT, buf.length, 'bytes in', Date.now() - t0, 'ms; hem min y', minY.toFixed(3));
}
