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

/** Dead-grass tuft texture (canvas, with alpha): many thin tapered straw blades and seed heads. */
export function grassTexture(ctx) {
  return ctx.textures.canvas('ext:grass4', 512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const R = rng(77);
    const blade = (x0, len, bend, wid, c, dark) => {
      const steps = 10;
      const pts = [];
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        pts.push([x0 + bend * t * t, h - len * t, wid * (1 - t * 0.92)]);
      }
      const grd = g.createLinearGradient(0, h, 0, h - len);
      const r0 = dark ? 50 : 80, r1 = dark ? 130 : 180;
      grd.addColorStop(0, `rgb(${Math.floor(r0 * c)},${Math.floor(r0 * 0.95 * c)},${Math.floor(r0 * 0.7 * c)})`);
      grd.addColorStop(0.55, `rgb(${Math.floor(r1 * 0.75 * c)},${Math.floor(r1 * 0.68 * c)},${Math.floor(r1 * 0.48 * c)})`);
      grd.addColorStop(1, `rgb(${Math.floor(r1 * c)},${Math.floor(r1 * 0.92 * c)},${Math.floor(r1 * 0.7 * c)})`);
      g.fillStyle = grd;
      g.beginPath();
      pts.forEach(([x, y, ww], i) => (i ? g.lineTo(x - ww / 2, y) : g.moveTo(x - ww / 2, y)));
      for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0] + pts[i][2] / 2, pts[i][1]);
      g.closePath();
      g.fill();
      return pts[pts.length - 1];
    };
    // back layer: darker, then lighter front blades
    for (let pass = 0; pass < 2; pass++) {
      const n = pass ? 70 : 60;
      for (let i = 0; i < n; i++) {
        const x0 = w * (0.12 + 0.76 * R());
        const len = h * (0.35 + 0.62 * R());
        const bend = (R() - 0.5) * w * 0.55 + (x0 - w / 2) * 0.5;
        const wid = 2.5 + R() * 4.5;
        const c = 0.6 + R() * 0.4;
        const tip = blade(x0, len, bend, wid, c, pass === 0);
        if (pass && R() < 0.12) { // seed head
          g.fillStyle = `rgba(${Math.floor(190 * c)},${Math.floor(175 * c)},${Math.floor(135 * c)},0.95)`;
          g.beginPath(); g.ellipse(tip[0], tip[1] + 10, 3, 14, (bend / w) * 0.8, 0, Math.PI * 2); g.fill();
        }
      }
    }
  }, { tile: false });
}

/** Scatter instanced grass tufts (3 crossed quads each) over regions, avoiding the path. */
export function buildGrass({ material, regions, count = 5000, seed = 5, avoid = [] }) {
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.translate(0, 0.5, 0);
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const q = quad.clone(); q.rotateY((k * Math.PI) / 3); parts.push(q);
    const b = quad.clone(); b.rotateY((k * Math.PI) / 3 + Math.PI); parts.push(b);   // back face (same lighting)
  }
  const geo = mergeSimple(parts);
  // normals pointing up-ish so tufts light like the ground
  const nor = geo.attributes.normal;
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, nor.getX(i) * 0.35, 0.94, nor.getZ(i) * 0.35);
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
    const v = 0.35 + Math.pow(R(), 1.5) * 1.1;
    c.setRGB(v * (1.0 + R() * 0.15), v * 0.96, v * (0.72 + R() * 0.2));
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

/**
 * Clump template: `blades` curved, tapered blades radiating from a small footprint.
 * Vertex colour darkens toward the root (AO in the thatch); normals lean upward so
 * the clump lights like a soft volume rather than flat cards.
 */
function bladeClump(seed, { blades = 18, segs = 3, height = 1, spread = 0.12 } = {}) {
  const R = rng(seed);
  const pos = [], nor = [], col = [];
  const v = new THREE.Vector3();
  for (let b = 0; b < blades; b++) {
    const a = R() * Math.PI * 2;
    const r0 = Math.sqrt(R()) * spread;
    const bx = Math.cos(a) * r0, bz = Math.sin(a) * r0;
    const h = height * (0.45 + 0.55 * R());
    const lean = 0.15 + R() * 0.55;                  // outward lean
    const la = a + (R() - 0.5) * 0.9;
    const w0 = 0.012 + R() * 0.012;
    const face = la + Math.PI / 2 + (R() - 0.5) * 0.8;
    const fx = Math.cos(face), fz = Math.sin(face);
    const ring = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const off = lean * h * t * t;
      const cx = bx + Math.cos(la) * off, cz = bz + Math.sin(la) * off;
      const cy = h * t * (1 - 0.25 * lean * t);
      const w = w0 * (1 - t * 0.92);
      ring.push([cx - fx * w, cy, cz - fz * w, cx + fx * w, cy, cz + fz * w, t]);
    }
    const nX = Math.cos(la) * 0.35, nZ = Math.sin(la) * 0.35;
    for (let i = 0; i < segs; i++) {
      const p = ring[i], q = ring[i + 1];
      const quad = [[p[0], p[1], p[2], p[6]], [p[3], p[4], p[5], p[6]], [q[0], q[1], q[2], q[6]], [q[3], q[4], q[5], q[6]]];
      for (const k of [0, 1, 2, 1, 3, 2]) {
        const [x, y, z, t] = quad[k];
        pos.push(x, y, z);
        v.set(nX, 0.9, nZ).normalize();
        nor.push(v.x, v.y, v.z);
        const c = 0.12 + 0.88 * Math.pow(t, 0.7);
        col.push(c, c, c);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/**
 * Real blade grass in clumps, three/four clump scales, patchy (bare earth between
 * clumps, denser in hollows and along the fence), olive-grey dead straw.
 * Returns a Group of InstancedMeshes (one per template).
 */
export function buildBladeGrass({ material, regions, count = 6000, seed = 21, avoid = [], pathClear = 1.3 }) {
  const templates = [
    bladeClump(seed + 1, { blades: 22, segs: 3, height: 1, spread: 0.1 }),
    bladeClump(seed + 2, { blades: 14, segs: 3, height: 1, spread: 0.07 }),
    bladeClump(seed + 3, { blades: 30, segs: 4, height: 1, spread: 0.16 }),
  ];
  const R = rng(seed);
  const lists = templates.map(() => []);
  const cols = templates.map(() => []);
  const total = regions.reduce((s, r) => s + r.weight, 0);
  const c = new THREE.Color();
  for (const r of regions) {
    const n = Math.round(count * r.weight / total);
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 6) {
      tries++;
      const x = r.x0 + (r.x1 - r.x0) * R();
      const z = r.z0 + (r.z1 - r.z0) * R();
      // patchiness: clumps gather where the low-frequency noise is high
      const dens = fbm(x * 0.35 + 11, z * 0.35 + 5, 3);
      if (R() > THREE.MathUtils.smoothstep(dens, 0.32, 0.62)) continue;
      if (z > 9) { const pn = pathNearest(x, z); if (pn.dist < pathClear + R() * 0.5) continue; }
      if (avoid.some((a) => Math.hypot(x - a[0], z - a[1]) < a[2])) continue;
      const y = height(x, z);
      // 4 clump scales: tufts, knee-high clumps, tall stands, the odd giant
      const k = R();
      const s = k < 0.45 ? 0.18 + R() * 0.12 : k < 0.8 ? 0.32 + R() * 0.15 : k < 0.97 ? 0.5 + R() * 0.2 : 0.75 + R() * 0.25;
      const ti = Math.floor(R() * templates.length);
      lists[ti].push(new THREE.Matrix4().compose(
        new THREE.Vector3(x, y - 0.02, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.2, R() * Math.PI * 2, (R() - 0.5) * 0.2)),
        new THREE.Vector3(s * (0.8 + R() * 0.5), s * (0.85 + dens * 0.5), s * (0.8 + R() * 0.5)),
      ));
      // olive-grey dead straw, some greener, some bleached
      const v = (0.55 + R() * 0.55) * 0.55;
      const g = R();
      if (g < 0.25) c.setRGB(0.20 * v, 0.215 * v, 0.15 * v);
      else if (g < 0.85) c.setRGB(0.27 * v, 0.26 * v, 0.19 * v);
      else c.setRGB(0.36 * v, 0.34 * v, 0.27 * v);
      cols[ti].push(c.clone());
      placed++;
    }
  }
  const group = new THREE.Group();
  group.name = 'bladeGrass';
  templates.forEach((t, i) => {
    if (!lists[i].length) return;
    const m = instanced(t, material, lists[i], { cast: false, receive: true, name: `bladeGrass${i}` });
    cols[i].forEach((cc, j) => m.setColorAt(j, cc));
    m.instanceColor.needsUpdate = true;
    group.add(m);
  });
  return group;
}

/** Scatter positions helper for dressing (deterministic). */
export function scatter({ regions, count, seed = 3, avoidPath = 0, onPath = false, pathBand = null }) {
  const R = rng(seed);
  const out = [];
  const total = regions.reduce((s, r) => s + r.weight, 0);
  for (const r of regions) {
    const n = Math.round(count * r.weight / total);
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 8) {
      tries++;
      const x = r.x0 + (r.x1 - r.x0) * R();
      const z = r.z0 + (r.z1 - r.z0) * R();
      if (z > 9 && (avoidPath || pathBand)) {
        const pn = pathNearest(x, z);
        if (avoidPath && pn.dist < avoidPath) continue;
        if (pathBand && (pn.dist < pathBand[0] || pn.dist > pathBand[1])) continue;
      }
      out.push({ x, z, y: height(x, z), r: R() });
      placed++;
    }
  }
  return out;
}
