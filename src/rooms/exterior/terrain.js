import * as THREE from 'three';
import { rng, instanced } from './lib.js';

/**
 * The hill: Stauf's mansion sits on a plateau (y = 0) at the origin facing +Z.
 * The carriage path climbs from the valley (+Z) through the iron gate (z = GATE_Z)
 * to the porch steps. Everything else samples `height(x, z)`.
 */

export const GATE_Z = 32;
export const PATH_POINTS = [
  [0, 11.6], [0.35, 15], [1.2, 19.5], [0.9, 24], [0.1, 28.5], [0, GATE_Z], [0, 35], [0.8, 39], [2.4, 44], [4.6, 50], [7.5, 58], [10.5, 68],
];

// --- deterministic value noise
function h2(ix, iz) {
  let n = ix * 374761393 + iz * 668265263;
  n = (n ^ (n >>> 13)) * 1274126177;
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = h2(ix, iz), b = h2(ix + 1, iz), c = h2(ix, iz + 1), d = h2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
export function fbm(x, z, oct = 4) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x, z); n += a; x = x * 2.03 + 17.1; z = z * 2.03 + 3.7; a *= 0.5; }
  return s / n;
}

const pathCurve = new THREE.CatmullRomCurve3(PATH_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
const pathSamples = pathCurve.getSpacedPoints(400);

function baseHeight(x, z) {
  const d = Math.hypot(x * 0.92, z * 0.95);
  const s = Math.max(0, d - 12.5);
  let h = -(s * s / (s + 5)) * 0.2;
  // ridge running down to the gate, valleys either side
  h += -Math.max(0, Math.abs(x) - 10) * 0.035 * Math.min(1, Math.max(0, z - 10) / 20);
  // rolling noise (suppressed on the plateau)
  const k = Math.min(1, s / 6);
  h += (fbm(x * 0.06, z * 0.06, 4) - 0.5) * 2.2 * k;
  h += (fbm(x * 0.25, z * 0.25, 3) - 0.5) * 0.35 * k;
  return h;
}

/** Nearest point on the path: { dist, t, point } (xz only). */
export function pathNearest(x, z) {
  let best = 1e9, bi = 0;
  for (let i = 0; i < pathSamples.length; i += 4) {
    const p = pathSamples[i];
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  for (let i = Math.max(0, bi - 4); i <= Math.min(pathSamples.length - 1, bi + 4); i++) {
    const p = pathSamples[i];
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  return { dist: Math.sqrt(best), t: bi / (pathSamples.length - 1), point: pathSamples[bi] };
}

export function height(x, z) {
  let h = baseHeight(x, z);
  if (z > 9) {
    const n = pathNearest(x, z);
    if (n.dist < 6) {
      const hc = baseHeight(n.point.x, n.point.z);
      const w = 1 - THREE.MathUtils.smoothstep(n.dist, 1.4, 5.5);
      h = h + (hc - h) * w;
      // path slightly sunken / cambered
      h -= 0.06 * (1 - THREE.MathUtils.smoothstep(n.dist, 0.0, 1.5));
    }
  }
  return h;
}

export function buildTerrain({ material, size = [150, 150], center = [0, 18], segs = 220 }) {
  const g = new THREE.PlaneGeometry(size[0], size[1], segs, segs);
  g.rotateX(-Math.PI / 2);
  g.translate(center[0], 0, center[1]);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, height(x, z));
    uv.setXY(i, x / 6, z / 6);
  }
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material);
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

/** Ribbon mesh along the path, conforming to the terrain. */
export function buildPath({ material, width = 2.5, from = 0, to = 1 }) {
  const n = 260;
  const pos = [], uvs = [], idx = [];
  let along = 0;
  let prev = null;
  const across = 6;
  for (let i = 0; i <= n; i++) {
    const t = from + (to - from) * (i / n);
    const p = pathCurve.getPointAt(t);
    const tan = pathCurve.getTangentAt(t);
    const side = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    if (prev) along += p.distanceTo(prev);
    prev = p.clone();
    const wv = width * (1 + 0.12 * Math.sin(t * 40.0) * Math.sin(t * 17.0));
    for (let j = 0; j <= across; j++) {
      const u = j / across;
      const q = p.clone().addScaledVector(side, (u - 0.5) * wv);
      q.y = height(q.x, q.z) + 0.035;
      pos.push(q.x, q.y, q.z);
      uvs.push(u, along / (width * 2));
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < across; j++) {
    const a = i * (across + 1) + j, b = a + 1, c = a + across + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material);
  mesh.name = 'path';
  mesh.receiveShadow = true;
  mesh.polygonOffset = true;
  return mesh;
}

/** Dead-grass tuft texture (canvas, with alpha). */
export function grassTexture(ctx) {
  return ctx.textures.canvas('ext:grass3', 512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const R = rng(77);
    for (let i = 0; i < 46; i++) {
      const x0 = w * (0.2 + 0.6 * R());
      const len = h * (0.3 + 0.68 * R());
      const bend = (R() - 0.5) * w * 0.5;
      const wid = 3 + R() * 4;
      const c = 0.55 + R() * 0.45;
      const grd = g.createLinearGradient(0, h, 0, h - len);
      grd.addColorStop(0, `rgb(${Math.floor(60 * c)},${Math.floor(58 * c)},${Math.floor(40 * c)})`);
      grd.addColorStop(1, `rgb(${Math.floor(210 * c)},${Math.floor(190 * c)},${Math.floor(140 * c)})`);
      g.strokeStyle = grd;
      g.lineCap = 'round';
      // tapered blade: a few strokes of decreasing width
      for (let k = 0; k < 3; k++) {
        const f = 1 - k * 0.3;
        g.lineWidth = wid * f;
        g.beginPath();
        g.moveTo(x0, h);
        g.quadraticCurveTo(x0 + bend * 0.25, h - len * 0.55 * f, x0 + bend * f, h - len * (0.6 + 0.4 * f));
        g.stroke();
      }
    }
  }, { tile: false });
}

/** Scatter instanced grass tufts (3 crossed quads each) over regions, avoiding the path. */
export function buildGrass({ material, regions, count = 5000, seed = 5, avoid = [] }) {
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.translate(0, 0.5, 0);
  const parts = [];
  for (let k = 0; k < 3; k++) { const q = quad.clone(); q.rotateY((k * Math.PI) / 3); parts.push(q); }
  const geo = mergeSimple(parts);
  // normals pointing up-ish so tufts light like the ground
  const nor = geo.attributes.normal;
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, nor.getX(i) * 0.7, 0.5, nor.getZ(i) * 0.7);
  const R = rng(seed);
  const mats = [];
  const total = regions.reduce((s, r) => s + r.weight, 0);
  for (const r of regions) {
    const n = Math.round(count * r.weight / total);
    for (let i = 0; i < n; i++) {
      const x = r.x0 + (r.x1 - r.x0) * R();
      const z = r.z0 + (r.z1 - r.z0) * R();
      if (z > 9) { const pn = pathNearest(x, z); if (pn.dist < 1.35 + R() * 0.4) continue; }
      if (avoid.some((a) => Math.hypot(x - a[0], z - a[1]) < a[2])) continue;
      const y = height(x, z);
      const s = 0.16 + R() * 0.3;
      mats.push(new THREE.Matrix4().compose(
        new THREE.Vector3(x, y - 0.03, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.25, R() * Math.PI, (R() - 0.5) * 0.25)),
        new THREE.Vector3(s * (0.8 + R() * 0.6), s, s * (0.8 + R() * 0.6)),
      ));
    }
  }
  const m = instanced(geo, material, mats, { cast: false, receive: true, name: 'grass' });
  const c = new THREE.Color();
  for (let i = 0; i < mats.length; i++) {
    const v = 0.6 + R() * 0.8;
    c.setRGB(v * (0.95 + R() * 0.15), v, v * (0.8 + R() * 0.25));
    m.setColorAt(i, c);
  }
  m.instanceColor.needsUpdate = true;
  return m;
}

function mergeSimple(list) {
  const pos = [], nor = [], uv = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

export { pathCurve };
