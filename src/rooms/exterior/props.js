import * as THREE from 'three';
import { Bucket, mat4, rng } from './lib.js';
import { height, scatter, pathCurve } from './terrain.js';
import { instanced } from './lib.js';
import { gnarledTree } from './trees.js';

/** The Stauf family plot: leaning headstones, a Celtic cross, an obelisk, a broken column. */
export function buildGraveyard(ctx, M, { cx = -10.5, cz = 21, seed = 13 } = {}) {
  const G = ctx.geometry;
  const B = new Bucket();
  const R = rng(seed);
  const group = new THREE.Group();
  group.name = 'graveyard';
  const stones = [];
  const shapeRound = (w, h) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0); return s; };
  const shapeGothic = (w, h) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h * 0.7); s.quadraticCurveTo(w / 2, h * 0.92, 0, h); s.quadraticCurveTo(-w / 2, h * 0.92, -w / 2, h * 0.7); s.lineTo(-w / 2, 0); return s; };
  const shapeShoulder = (w, h) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h * 0.82); s.lineTo(w * 0.32, h * 0.82); s.absarc(0, h * 0.82, w * 0.32, 0, Math.PI, false); s.lineTo(-w / 2, h * 0.82); s.lineTo(-w / 2, 0); return s; };
  const shapeCross = (w, h) => { const s = new THREE.Shape(); const a = w * 0.18; s.moveTo(-a, 0); s.lineTo(a, 0); s.lineTo(a, h * 0.62); s.lineTo(w / 2, h * 0.62); s.lineTo(w / 2, h * 0.78); s.lineTo(a, h * 0.78); s.lineTo(a, h); s.lineTo(-a, h); s.lineTo(-a, h * 0.78); s.lineTo(-w / 2, h * 0.78); s.lineTo(-w / 2, h * 0.62); s.lineTo(-a, h * 0.62); s.lineTo(-a, 0); return s; };
  const shapes = [shapeRound, shapeGothic, shapeShoulder, shapeRound, shapeCross, shapeShoulder];
  const spots = [[-2.6, -1.5], [-1.0, -1.8], [0.6, -1.4], [2.1, -1.9], [-2.0, 0.6], [-0.3, 0.9], [1.4, 0.5], [3.0, 0.8], [-1.2, 2.9], [0.9, 3.1], [2.6, 2.7]];
  spots.forEach(([dx, dz], i) => {
    const x = cx + dx + (R() - 0.5) * 0.3, z = cz + dz + (R() - 0.5) * 0.3;
    const y = height(x, z);
    const w = 0.55 + R() * 0.25, h = 0.8 + R() * 0.55, d = 0.12 + R() * 0.06;
    const sh = shapes[i % shapes.length](w, h);
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 14 });
    g.translate(0, 0, -d / 2);
    const m = mat4(x, y - 0.12, z, (R() - 0.5) * 0.25, 0.25 + (R() - 0.5) * 0.4, (R() - 0.5) * 0.22);
    B.add(g, i % 3 === 0 ? M.graveDark : M.grave, m, { uvScale: 1.2 });
    // grave mound
    const mound = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    { const p = mound.attributes.position; for (let k = 0; k < p.count; k++) { const px = p.getX(k), py = p.getY(k), pz = p.getZ(k); const n = 1 + 0.12 * Math.sin(px * 9 + i) * Math.sin(pz * 7 + i * 2) + 0.06 * Math.sin(px * 23 + pz * 19); p.setXYZ(k, px * n, py * n, pz * n); } mound.computeVertexNormals(); }
    B.add(mound, M.mound, mat4(x + Math.sin(0.25) * 0.9, y - 0.1, z + Math.cos(0.25) * 0.9, 0, 0.25 + (R() - 0.5) * 0.2, 0, 0.42, 0.2 + R() * 0.08, 0.9), { uvScale: 0.5 });
    stones.push(new THREE.Vector3(x, y + h / 2, z));
  });
  // obelisk
  {
    const x = cx + 4.4, z = cz - 0.2, y = height(x, z);
    B.add(new THREE.BoxGeometry(1.0, 0.3, 1.0), M.grave, mat4(x, y + 0.1, z), { uvScale: 1 });
    B.add(new THREE.BoxGeometry(0.75, 0.6, 0.75), M.grave, mat4(x, y + 0.55, z), { uvScale: 1 });
    B.add(new THREE.BoxGeometry(0.85, 0.1, 0.85), M.grave, mat4(x, y + 0.9, z), { uvScale: 1 });
    const ob = new THREE.CylinderGeometry(0.2, 0.32, 2.8, 4, 1);
    B.add(ob, M.grave, mat4(x, y + 2.35, z, 0, Math.PI / 4, 0), { uvScale: 1 });
    B.add(new THREE.ConeGeometry(0.2, 0.3, 4), M.grave, mat4(x, y + 3.9, z, 0, Math.PI / 4, 0), { uvScale: 1 });
    stones.push(new THREE.Vector3(x, y + 1.5, z));
  }
  // broken column on a plinth
  {
    const x = cx - 3.6, z = cz + 1.6, y = height(x, z);
    B.add(new THREE.BoxGeometry(0.8, 0.5, 0.8), M.grave, mat4(x, y + 0.15, z), { uvScale: 1 });
    B.add(G.latheFromProfile([[0.0, 0], [0.26, 0], [0.26, 0.06], [0.22, 0.12], [0.2, 0.2], [0.18, 1.5], [0.0, 1.5]], 18), M.grave, mat4(x, y + 0.4, z), { uvScale: 1 });
    const top = new THREE.CylinderGeometry(0.18, 0.18, 0.2, 18);
    B.add(top, M.grave, mat4(x + 0.03, y + 1.95, z, 0.3, 0, 0.25), { uvScale: 1 });
  }
  // a votive lantern left burning on the newest grave: someone visits
  const votive = new THREE.Group();
  {
    const [vx, vz] = [cx + 2.2, cz + 1.6];
    const vy = height(vx, vz);
    votive.position.set(vx, vy - 0.01, vz);
    const iron = M.iron;
    const parts = new Bucket();
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) parts.add(new THREE.BoxGeometry(0.012, 0.2, 0.012), iron, mat4(sx * 0.055, 0.11, sz * 0.055), { uv: 'keep' });
    parts.add(new THREE.BoxGeometry(0.14, 0.02, 0.14), iron, mat4(0, 0.01, 0), { uv: 'keep' });
    parts.add(new THREE.ConeGeometry(0.1, 0.08, 4), iron, mat4(0, 0.25, 0, 0, Math.PI / 4, 0), { uv: 'keep' });
    parts.add(new THREE.TorusGeometry(0.03, 0.004, 4, 12), iron, mat4(0, 0.31, 0), { uv: 'keep' });
    parts.build(votive, { name: 'votive' });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.1), M.lanternGlass);
    glass.position.y = 0.11; glass.scale.setScalar(1); votive.add(glass);
    const fl = ctx.fx.flame({ height: 0.04, width: 0.012, intensity: 8, seed: 3 });
    fl.position.y = 0.05; votive.add(fl);
    const pl = new THREE.PointLight(0xff9a48, 2.2, 7, 2);
    pl.position.y = 0.16; votive.add(pl);
    votive.userData.light = pl;
  }
  group.add(votive);
  B.build(group, { name: 'graves' });
  return { group, stones, votive };
}

/** Gnarled-tree placement helper: world-space instance with height snapping. */
export function placeTree(geo, material, { x, z, ry = 0, s = 1 }) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, height(x, z) - 0.15, z);
  m.rotation.y = ry;
  m.scale.setScalar(s);
  m.castShadow = true; m.receiveShadow = true;
  m.name = 'tree';
  return m;
}

/** Lumpy field boulder: displaced icosphere (deterministic), flattened, with a buried base. */
export function boulderGeometry(seed, r = 1) {
  const R = rng(seed);
  const g = new THREE.IcosahedronGeometry(r, 4);
  const p = g.attributes.position;
  const ph = [R() * 10, R() * 10, R() * 10];
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = Math.sin(v.x * 2.1 + ph[0]) * 0.18 + Math.sin(v.y * 3.3 + ph[1]) * 0.12 + Math.sin(v.z * 2.7 + ph[2]) * 0.15
      + Math.sin((v.x + v.z) * 7.0 + ph[1]) * 0.04 + Math.sin((v.y - v.x) * 11.0 + ph[2]) * 0.025;
    // facet: quantise a little to suggest fractured planes
    const k = 1 + n;
    v.multiplyScalar(r * k);
    v.y *= 0.62;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Foreground dressing: boulders and dead bramble bushes. */
export function buildDressing(ctx, M, { rocks = [], bushes = [] }) {
  const group = new THREE.Group();
  group.name = 'dressing';
  const B = new Bucket();
  rocks.forEach(([x, z, r, ry, seed], i) => {
    const y = height(x, z);
    B.add(boulderGeometry(seed ?? i * 7 + 3, r), M.rock, mat4(x, y + r * 0.12, z, 0, ry || 0, 0), { uvScale: 0.5 });
  });
  B.build(group, { name: 'rocks' });
  for (const [x, z, s, seed] of bushes) {
    const g = gnarledTree({ seed, height: 1.6, trunkR: 0.035, spread: 1.3, depth: 4, droop: 0.1 });
    const m = new THREE.Mesh(g, M.bark);
    m.position.set(x, height(x, z) - 0.05, z);
    m.scale.setScalar(s);
    m.rotation.y = seed;
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

/** Small field stones lining both verges of the carriage drive (instanced, a few templates). */
export function buildVerge(ctx, M, { from = 0.25, to = 0.9, seed = 61 } = {}) {
  const R = rng(seed);
  const temps = [boulderGeometry(101, 1), boulderGeometry(102, 1), boulderGeometry(103, 1)];
  const lists = temps.map(() => []);
  const n = 260;
  for (let i = 0; i < n; i++) {
    const t = from + (to - from) * (i / n) + (R() - 0.5) * 0.002;
    const p = pathCurve.getPointAt(Math.min(1, t));
    const tan = pathCurve.getTangentAt(Math.min(1, t));
    const side = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    for (const sgn of [-1, 1]) {
      if (R() < 0.35) continue;
      const off = 1.18 + R() * 0.35;
      const x = p.x + side.x * off * sgn, z = p.z + side.z * off * sgn;
      const r = 0.06 + Math.pow(R(), 2.5) * 0.22;
      lists[i % 3].push(mat4(x, height(x, z) + r * 0.05, z, (R() - 0.5) * 0.4, R() * 6.28, (R() - 0.5) * 0.4, r * (0.9 + R() * 0.5), r, r * (0.9 + R() * 0.5)));
    }
  }
  const g = new THREE.Group();
  g.name = 'verge';
  temps.forEach((t, i) => g.add(instanced(t, M.rock, lists[i], { name: `verge${i}`, cast: true })));
  return g;
}

/** Fallen oak leaves: curled little cards, instanced, darker wet ones on the drive. */
export function buildLeafLitter(ctx, { regions, count = 2500, seed = 44 }) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.5);
  shape.bezierCurveTo(0.3, -0.35, 0.42, 0.05, 0.22, 0.25);
  shape.bezierCurveTo(0.32, 0.32, 0.18, 0.5, 0, 0.5);
  shape.bezierCurveTo(-0.18, 0.5, -0.32, 0.32, -0.22, 0.25);
  shape.bezierCurveTo(-0.42, 0.05, -0.3, -0.35, 0, -0.5);
  const geo = new THREE.ShapeGeometry(shape, 4);
  // curl: lift the edges
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setXYZ(i, x, y, x * x * 0.9 + y * y * 0.2); }
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, side: THREE.DoubleSide, name: 'leaves' });
  mat.userData.groundShade = true;
  const pts = scatter({ regions, count, seed });
  const R = rng(seed + 1);
  const ms = pts.map((q) => {
    const s = 0.05 + R() * 0.05;
    return mat4(q.x, q.y + 0.012, q.z, (R() - 0.5) * 0.6, R() * 6.28, (R() - 0.5) * 0.6, s, s, s);
  });
  const m = instanced(geo, mat, ms, { name: 'leafLitter', cast: false });
  const c = new THREE.Color();
  for (let i = 0; i < ms.length; i++) {
    const k = R();
    if (k < 0.5) c.setRGB(0.16, 0.08, 0.035); else if (k < 0.8) c.setRGB(0.24, 0.14, 0.06); else c.setRGB(0.09, 0.07, 0.05);
    c.multiplyScalar((0.7 + R() * 0.6) * 0.5);
    m.setColorAt(i, c);
  }
  m.instanceColor.needsUpdate = true;
  return m;
}

/** A toppled, broken garden urn with its plinth and shards, half sunk in the grass. */
export function buildBrokenUrn(ctx, M, { x, z, ry = 0 }) {
  const G = ctx.geometry;
  const B = new Bucket();
  const y = height(x, z);
  const prof = [[0.0, 0], [0.16, 0], [0.16, 0.04], [0.1, 0.08], [0.08, 0.16], [0.12, 0.2], [0.24, 0.3], [0.3, 0.42], [0.31, 0.52], [0.27, 0.6], [0.24, 0.64], [0.3, 0.68], [0.32, 0.72], [0.0, 0.72]];
  const urn = new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(r, yy)), 24, 0.4, Math.PI * 2 - 1.5);
  // lying on its side, rim toward the camera
  B.add(urn, M.grave, mat4(x, y + 0.22, z, 0, ry, Math.PI / 2 - 0.15), { uvScale: 1 });
  // the square plinth it fell from, tilted in the turf
  B.add(new THREE.BoxGeometry(0.5, 0.55, 0.5), M.grave, mat4(x - 0.9, y + 0.15, z - 0.4, 0.08, ry + 0.3, 0.12), { uvScale: 1 });
  B.add(G.latheFromProfile([[0.0, 0], [0.36, 0], [0.36, 0.05], [0.32, 0.09], [0.0, 0.09]], 4), M.grave, mat4(x - 0.88, y + 0.42, z - 0.38, 0.08, ry + 0.3 + Math.PI / 4, 0.12), { uv: 'box', uvScale: 1 });
  // shards
  const R = rng(9);
  for (let i = 0; i < 6; i++) {
    const g = new THREE.LatheGeometry(prof.slice(4, 9).map(([r, yy]) => new THREE.Vector2(r, yy)), 4, R() * 6, 0.5 + R() * 0.4);
    const sx = x + 0.4 + R() * 0.8, sz = z + (R() - 0.5) * 0.9;
    B.add(g, M.grave, mat4(sx, height(sx, sz) + 0.02, sz, R() * 3, R() * 6, R() * 3, 0.9), { uvScale: 1 });
  }
  const group = new THREE.Group();
  group.name = 'brokenUrn';
  B.build(group, { name: 'urn' });
  return group;
}
