import * as THREE from 'three';

/**
 * Tiny signed-distance sculpting kit (contributed by the bedroom room).
 *
 * Build organic, carved-looking props (chess knights, doll heads, finials…) by combining
 * SDF primitives with smooth unions / subtractions in plain JS, then polygonise them with
 * naive Surface Nets. Vertices are projected back onto the surface (Newton steps) and get
 * analytic gradient normals, so the result shades smoothly at a modest resolution.
 *
 *   const geo = sdfGeometry((x, y, z) => smin(sdSphere(x, y, z, 0.5), …, 0.1),
 *                           { min: [-1,-1,-1], max: [1,1,1], step: 0.02, ao: 0.12 });
 *
 * Options: ao (distance for a baked cavity term written to the `color` attribute, grey 0..1,
 * or 0 to skip), uv ('sphere' with uvCenter, or 'planar' = (z + 0.3x, y) / uvScale).
 * Any room may import it. Pure functions, no scene access.
 */

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export function smin(a, b, k) { if (k <= 0) return Math.min(a, b); const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); }
export function smax(a, b, k) { return -smin(-a, -b, k); }
/** smooth subtraction: a minus b */
export function ssub(a, b, k) { return smax(a, -b, k); }
export function sdSphere(x, y, z, r) { return Math.hypot(x, y, z) - r; }
/** approximate ellipsoid distance (Inigo Quilez) */
export function sdEllipsoid(x, y, z, rx, ry, rz) {
  const k0 = Math.hypot(x / rx, y / ry, z / rz);
  const k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
/** capsule between a and b ([x,y,z]) with radius r */
export function sdCapsule(x, y, z, a, b, r) {
  const px = x - a[0], py = y - a[1], pz = z - a[2];
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const h = clamp((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz), 0, 1);
  return Math.hypot(px - bx * h, py - by * h, pz - bz * h) - r;
}
/** round cone: sphere r1 at a swept to sphere r2 at b (exact) */
export function sdRoundCone(x, y, z, a, b, r1, r2) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = x - a[0], pay = y - a[1], paz = z - a[2];
  const yy = pax * bax + pay * bay + paz * baz;
  const zz = yy - l2;
  const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = yy * yy * l2, z2 = zz * zz * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
}
/** chain of round cones through points [[x,y,z,r], …], smooth-unioned with k */
export function sdChain(x, y, z, pts, k = 0) {
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    d = smin(d, sdRoundCone(x, y, z, a, b, a[3], b[3]), k);
  }
  return d;
}
/** cheap value noise in 3D (deterministic) for surface breakup */
function h3(x, y, z) { let n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); }
export function vnoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(ix, iy, iz), h3(ix + 1, iy, iz), ux), L(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), ux), uy),
    L(L(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), ux), L(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), ux), uy), uz);
}

/**
 * Polygonise f(x,y,z) (negative inside) over the box [min,max] with cell size `step`.
 * Returns an indexed BufferGeometry with position, normal, uv and (if ao > 0) color.
 */
export function sdfGeometry(f, { min, max, step, project = 3, ao = 0, aoStrength = 1, uv = 'planar', uvScale = 1, uvCenter = [0, 0, 0] } = {}) {
  const nx = Math.ceil((max[0] - min[0]) / step) + 1, ny = Math.ceil((max[1] - min[1]) / step) + 1, nz = Math.ceil((max[2] - min[2]) / step) + 1;
  const vals = new Float32Array(nx * ny * nz);
  const I = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) vals[I(i, j, k)] = f(min[0] + i * step, min[1] + j * step, min[2] + k * step);
  const cellV = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const C = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const corner = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { const v = vals[I(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))]; corner[c] = v; if (v < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of EDGES) {
      const va = corner[a], vb = corner[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      const ax = a & 1, ay = (a >> 1) & 1, az = (a >> 2) & 1, bx = b & 1, by = (b >> 1) & 1, bz = (b >> 2) & 1;
      sx += ax + (bx - ax) * t; sy += ay + (by - ay) * t; sz += az + (bz - az) * t; n++;
    }
    cellV[C(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / n) * step, min[1] + (j + sy / n) * step, min[2] + (k + sz / n) * step);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v0 = vals[I(i, j, k)];
    if (i < nx - 1 && j > 0 && k > 0 && j < ny - 1 && k < nz - 1) {
      const v1 = vals[I(i + 1, j, k)];
      if ((v0 < 0) !== (v1 < 0)) quad(cellV[C(i, j - 1, k - 1)], cellV[C(i, j, k - 1)], cellV[C(i, j, k)], cellV[C(i, j - 1, k)], !(v0 < 0));
    }
    if (j < ny - 1 && i > 0 && k > 0 && i < nx - 1 && k < nz - 1) {
      const v1 = vals[I(i, j + 1, k)];
      if ((v0 < 0) !== (v1 < 0)) quad(cellV[C(i - 1, j, k - 1)], cellV[C(i - 1, j, k)], cellV[C(i, j, k)], cellV[C(i, j, k - 1)], !(v0 < 0));
    }
    if (k < nz - 1 && i > 0 && j > 0 && i < nx - 1 && j < ny - 1) {
      const v1 = vals[I(i, j, k + 1)];
      if ((v0 < 0) !== (v1 < 0)) quad(cellV[C(i - 1, j - 1, k)], cellV[C(i, j - 1, k)], cellV[C(i, j, k)], cellV[C(i - 1, j, k)], !(v0 < 0));
    }
  }
  // project onto the surface + gradient normals
  const e = step * 0.35;
  const grad = (x, y, z, out) => {
    out[0] = f(x + e, y, z) - f(x - e, y, z); out[1] = f(x, y + e, z) - f(x, y - e, z); out[2] = f(x, y, z + e) - f(x, y, z - e);
    const l = Math.hypot(out[0], out[1], out[2]) || 1; out[0] /= l; out[1] /= l; out[2] /= l;
  };
  const nrm = new Float32Array(pos.length);
  const g3 = [0, 0, 0];
  for (let v = 0; v < pos.length; v += 3) {
    let x = pos[v], y = pos[v + 1], z = pos[v + 2];
    const x0 = x, y0 = y, z0 = z;
    for (let it = 0; it < project; it++) {
      const d = f(x, y, z); grad(x, y, z, g3);
      x -= d * g3[0]; y -= d * g3[1]; z -= d * g3[2];
    }
    // never wander out of the cell neighbourhood (keeps creases from tearing)
    const dx = x - x0, dy = y - y0, dz = z - z0, dl = Math.hypot(dx, dy, dz);
    if (dl > step) { const s = step / dl; x = x0 + dx * s; y = y0 + dy * s; z = z0 + dz * s; }
    pos[v] = x; pos[v + 1] = y; pos[v + 2] = z;
    grad(x, y, z, g3); nrm[v] = g3[0]; nrm[v + 1] = g3[1]; nrm[v + 2] = g3[2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const uvs = new Float32Array((pos.length / 3) * 2);
  for (let v = 0, w = 0; v < pos.length; v += 3, w += 2) {
    const x = pos[v] - uvCenter[0], y = pos[v + 1] - uvCenter[1], z = pos[v + 2] - uvCenter[2];
    if (uv === 'sphere') {
      let u = Math.atan2(z, -x) / (Math.PI * 2); if (u < 0) u += 1;
      uvs[w] = u; uvs[w + 1] = 1 - Math.acos(clamp(y / (Math.hypot(x, y, z) || 1), -1, 1)) / Math.PI;
    } else { uvs[w] = (z + x * 0.3) / uvScale; uvs[w + 1] = y / uvScale; }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (ao > 0) {
    // cavity / occlusion: how far the field opens up along the normal (5 taps)
    const col = new Float32Array(pos.length);
    for (let v = 0; v < pos.length; v += 3) {
      let occ = 0;
      for (let s = 1; s <= 5; s++) {
        const h = (ao * s) / 5;
        const d = f(pos[v] + nrm[v] * h, pos[v + 1] + nrm[v + 1] * h, pos[v + 2] + nrm[v + 2] * h);
        occ += (h - Math.max(0, d)) / Math.pow(2, s - 1);
      }
      const a = clamp(1 - (occ / ao) * 2.2 * aoStrength, 0, 1);
      col[v] = col[v + 1] = col[v + 2] = a;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  geo.setIndex(idx);
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}
