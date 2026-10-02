import * as THREE from 'three';
import { Bucket, mat4, rng } from './lib.js';
import { height } from './terrain.js';
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
    B.add(g, i % 3 === 0 ? M.stoneDark : M.ashlar, m, { uvScale: 1.2 });
    // grave mound
    const mound = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    B.add(mound, M.mound, mat4(x + Math.sin(0.25) * 0.9, y - 0.08, z + Math.cos(0.25) * 0.9, 0, 0.25, 0, 0.45, 0.16, 0.95), { uvScale: 0.5 });
    stones.push(new THREE.Vector3(x, y + h / 2, z));
  });
  // obelisk
  {
    const x = cx + 4.4, z = cz - 0.2, y = height(x, z);
    B.add(new THREE.BoxGeometry(1.0, 0.3, 1.0), M.ashlar, mat4(x, y + 0.1, z), { uvScale: 1 });
    B.add(new THREE.BoxGeometry(0.75, 0.6, 0.75), M.ashlar, mat4(x, y + 0.55, z), { uvScale: 1 });
    B.add(new THREE.BoxGeometry(0.85, 0.1, 0.85), M.ashlar, mat4(x, y + 0.9, z), { uvScale: 1 });
    const ob = new THREE.CylinderGeometry(0.2, 0.32, 2.8, 4, 1);
    B.add(ob, M.ashlar, mat4(x, y + 2.35, z, 0, Math.PI / 4, 0), { uvScale: 1 });
    B.add(new THREE.ConeGeometry(0.2, 0.3, 4), M.ashlar, mat4(x, y + 3.9, z, 0, Math.PI / 4, 0), { uvScale: 1 });
    stones.push(new THREE.Vector3(x, y + 1.5, z));
  }
  // broken column on a plinth
  {
    const x = cx - 3.6, z = cz + 1.6, y = height(x, z);
    B.add(new THREE.BoxGeometry(0.8, 0.5, 0.8), M.ashlar, mat4(x, y + 0.15, z), { uvScale: 1 });
    B.add(G.latheFromProfile([[0.0, 0], [0.26, 0], [0.26, 0.06], [0.22, 0.12], [0.2, 0.2], [0.18, 1.5], [0.0, 1.5]], 18), M.ashlar, mat4(x, y + 0.4, z), { uvScale: 1 });
    const top = new THREE.CylinderGeometry(0.18, 0.18, 0.2, 18);
    B.add(top, M.ashlar, mat4(x + 0.03, y + 1.95, z, 0.3, 0, 0.25), { uvScale: 1 });
  }
  B.build(group, { name: 'graves' });
  return { group, stones };
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
