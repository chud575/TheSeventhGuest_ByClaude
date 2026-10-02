import * as THREE from 'three';
import { Bucket, mat4, instanced, rng } from './lib.js';
import { height, GATE_Z } from './terrain.js';

/**
 * Entrance: two rusticated stone piers with lanterns, a double wrought-iron gate
 * (arched top rail, spear-headed bars, C-scrolls, dog bars) and a long spear
 * fence that follows the hill. The gate leaves are separate groups so they can
 * swing open when the lock medallion is solved.
 */

export const GATE = { w: 3.8, z: GATE_Z };

/** Bar shaft (unit height, scale Y) and spear head (origin at its collar). */
export function spearParts(G) {
  return {
    shaft: new THREE.CylinderGeometry(0.013, 0.013, 1, 6, 1, true).translate(0, 0.5, 0),
    head: G.latheFromProfile([[0.0, -0.02], [0.026, 0.0], [0.03, 0.03], [0.016, 0.05], [0.034, 0.1], [0.024, 0.14], [0.0, 0.24]], 8),
  };
}
/** Instanced spear bars from [{x,y,z,h,lean}] in a parent's local space. */
function spearBars(G, M, list, name) {
  const { shaft, head } = spearParts(G);
  const ms = [], mh = [];
  for (const b of list) {
    ms.push(mat4(b.x, b.y, b.z, 0, 0, b.lean || 0, 1, b.h, 1));
    const tx = b.x - Math.sin(b.lean || 0) * b.h, ty = b.y + Math.cos(b.lean || 0) * b.h;
    mh.push(mat4(tx, ty, b.z, 0, 0, b.lean || 0));
  }
  const g = new THREE.Group();
  g.add(instanced(shaft, M.iron, ms, { name: `${name}Shafts`, receive: false }));
  g.add(instanced(head, M.iron, mh, { name: `${name}Heads`, receive: false }));
  return g;
}

export function buildGate(ctx, M) {
  const G = ctx.geometry;
  const group = new THREE.Group();
  group.name = 'gate';
  const B = new Bucket();
  const R = rng(32);
  const y0 = height(0, GATE.z);
  const half = GATE.w / 2;
  const lights = [];
  const lanterns = [];

  // ------------------------------------------------------------------ piers
  const pier = (x) => {
    const yb = Math.min(height(x - 0.5, GATE.z), height(x + 0.5, GATE.z)) - 0.4;
    const top = y0 + 3.3;
    B.add(new THREE.BoxGeometry(1.0, 0.5, 1.0), M.ashlar, mat4(x, yb + 0.25 + 0.2, GATE.z), { uvScale: 0.5 });
    B.add(new THREE.BoxGeometry(0.84, top - yb - 0.7, 0.84), M.ashlar, mat4(x, (yb + 0.7 + top) / 2 - 0.0, GATE.z), { uvScale: 0.5 });
    // rusticated bands
    for (let y = yb + 0.9; y < top - 0.3; y += 0.42) B.add(new THREE.BoxGeometry(0.9, 0.3, 0.9), M.ashlar, mat4(x, y, GATE.z), { uvScale: 0.5 });
    // cap: cornice + plinth
    B.add(new THREE.BoxGeometry(1.06, 0.12, 1.06), M.ashlar, mat4(x, top + 0.06, GATE.z), { uvScale: 0.5 });
    B.add(G.latheFromProfile([[0.0, 0], [0.62, 0], [0.62, 0.05], [0.55, 0.1], [0.5, 0.16], [0.42, 0.2], [0.0, 0.2]], 4), M.ashlar, mat4(x, top + 0.12, GATE.z, 0, Math.PI / 4, 0), { uv: 'box', uvScale: 0.5 });
    B.add(new THREE.BoxGeometry(0.5, 0.18, 0.5), M.ashlar, mat4(x, top + 0.41, GATE.z), { uvScale: 0.5 });
    // lantern on an iron stem
    const ly = top + 0.5;
    B.add(G.latheFromProfile([[0.0, 0], [0.09, 0], [0.05, 0.08], [0.03, 0.3], [0.06, 0.36], [0.0, 0.38]], 10), M.iron, mat4(x, ly, GATE.z), { uv: 'keep' });
    const L = new THREE.Group();
    L.position.set(x, ly + 0.38, GATE.z);
    const frame = new Bucket();
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) frame.add(new THREE.BoxGeometry(0.025, 0.42, 0.025), M.iron, mat4(sx * 0.13, 0.21, sz * 0.13), { uv: 'keep' });
    frame.add(new THREE.BoxGeometry(0.32, 0.04, 0.32), M.iron, mat4(0, 0.0, 0), { uv: 'keep' });
    frame.add(new THREE.BoxGeometry(0.34, 0.035, 0.34), M.iron, mat4(0, 0.43, 0), { uv: 'keep' });
    frame.add(new THREE.ConeGeometry(0.25, 0.22, 4, 1), M.iron, mat4(0, 0.56, 0, 0, Math.PI / 4, 0), { uv: 'keep' });
    frame.add(G.latheFromProfile([[0.0, 0], [0.03, 0], [0.02, 0.06], [0.035, 0.1], [0.0, 0.16]], 8), M.iron, mat4(0, 0.66, 0), { uv: 'keep' });
    frame.build(L, { name: 'lanternFrame' });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.38, 0.245), M.lanternGlass);
    glow.position.y = 0.21; L.add(glow);
    const flame = ctx.fx.flame({ height: 0.07, width: 0.02, intensity: 10, seed: x });
    flame.position.y = 0.12; L.add(flame);
    group.add(L);
    lanterns.push(L);
    const pl = new THREE.PointLight(0xffa458, 9, 16, 2);
    pl.position.set(x, ly + 0.62, GATE.z + 0.05);
    group.add(pl);
    lights.push(pl);
    return top;
  };
  pier(-half - 0.42);
  pier(half + 0.42);

  // ------------------------------------------------------------------ gate leaves
  const leaves = [];
  const leafBars = [];
  const makeLeaf = (side) => {
    // side -1 = left leaf (hinge at -half), +1 = right leaf
    const hinge = new THREE.Group();
    hinge.position.set(side * half, y0, GATE.z);
    const L = new Bucket();
    const W = half - 0.02;
    const dir = -side; // leaf extends from hinge toward centre
    const topAt = (u) => 2.55 + 0.75 * Math.sin((u * Math.PI) / 2); // u: 0 at hinge .. 1 at centre
    const iron = M.iron;
    const rod = (len, x, y, rz = 0, r = 0.022) => L.add(new THREE.BoxGeometry(len, r * 2, r * 2), iron, mat4(x, y, 0, 0, 0, rz), { uv: 'keep' });
    // stiles
    L.add(new THREE.BoxGeometry(0.06, topAt(0) - 0.1, 0.06), iron, mat4(dir * 0.03, (topAt(0) - 0.1) / 2 + 0.1, 0), { uv: 'keep' });
    L.add(new THREE.BoxGeometry(0.06, topAt(1) - 0.1, 0.06), iron, mat4(dir * (W - 0.03), (topAt(1) - 0.1) / 2 + 0.1, 0), { uv: 'keep' });
    // rails
    rod(W, dir * W / 2, 0.16);
    rod(W, dir * W / 2, 0.42);
    rod(W, dir * W / 2, 1.05);
    rod(W, dir * W / 2, 2.1);
    // arched top rail (segments)
    const segs = 12;
    for (let i = 0; i < segs; i++) {
      const u0 = i / segs, u1 = (i + 1) / segs;
      const xa = dir * u0 * W, xb = dir * u1 * W;
      const ya = topAt(u0), yb = topAt(u1);
      const len = Math.hypot(xb - xa, yb - ya);
      rod(len + 0.01, (xa + xb) / 2, (ya + yb) / 2, Math.atan2(yb - ya, xb - xa), 0.026);
      rod(len + 0.01, (xa + xb) / 2, (ya + yb) / 2 - 0.22, Math.atan2(yb - ya, xb - xa), 0.016);
    }
    // bars with spear heads
    const nb = 13;
    for (let i = 1; i < nb; i++) {
      const u = i / nb;
      const x = dir * u * W;
      const top = topAt(u) + 0.12 + (i % 2 ? 0 : 0.1);
      leafBars.push({ hinge, b: { x, y: 0.1, z: 0, h: top - 0.1 } });
      // dog bars (short pickets between bottom rails)
      L.add(new THREE.BoxGeometry(0.016, 0.26, 0.016), iron, mat4(x + dir * W / nb / 2, 0.29, 0), { uv: 'keep' });
    }
    // C-scrolls between 1.05 and 2.1 rails, and a band of circles under the arch
    for (let i = 0; i < 4; i++) {
      const u = (i + 0.5) / 4;
      const x = dir * u * W;
      for (const [y, s] of [[1.35, 1], [1.8, -1]]) {
        const t = new THREE.TorusGeometry(0.11, 0.012, 6, 16, Math.PI * 1.5);
        L.add(t, iron, mat4(x, y, 0, 0, 0, s > 0 ? 0.6 : 0.6 + Math.PI), { uv: 'keep' });
      }
      const ring = new THREE.TorusGeometry(0.075, 0.011, 6, 18);
      L.add(ring, iron, mat4(x, 2.32 + 0.6 * Math.sin(u * Math.PI / 2), 0), { uv: 'keep' });
    }
    // hinge pins
    for (const y of [0.4, 2.2]) L.add(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), iron, mat4(0, y, 0), { uv: 'keep' });
    L.build(hinge, { name: `leaf${side}` });
    group.add(hinge);
    leaves.push(hinge);
    return hinge;
  };
  const leftLeaf = makeLeaf(-1);
  const rightLeaf = makeLeaf(1);
  // bars as instanced meshes per leaf
  for (const leaf of [leftLeaf, rightLeaf]) {
    const list = leafBars.filter((b) => b.hinge === leaf).map((b) => b.b);
    leaf.add(spearBars(G, M, list, 'gateBars'));
  }

  // ------------------------------------------------------------------ fence along the hill
  const fenceBars = [], posts = [], rails = [];
  const fenceRun = (xa, xb, side) => {
    const n = Math.round(Math.abs(xb - xa) / 0.14);
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const x = xa + (xb - xa) * (i / n);
      const z = GATE.z + 0.6 * Math.sin(x * 0.07) + Math.max(0, Math.abs(x) - 14) * -0.25;
      const y = height(x, z);
      const lean = (R() - 0.5) * 0.04 + (Math.abs(x) > 18 ? 0.05 * Math.sin(x) : 0);
      fenceBars.push({ x, y: y - 0.1, z, lean, h: 1.75 + (i % 2) * 0.1 });
      if (i % 17 === 0) posts.push(mat4(x, y - 0.1, z, 0, 0, 0, 1, 1, 1));
      if (prev) {
        for (const ry of [0.25, 1.35]) {
          const a = new THREE.Vector3(prev.x, prev.y + ry, prev.z), b = new THREE.Vector3(x, y + ry, z);
          const mid = a.clone().add(b).multiplyScalar(0.5);
          const d = b.clone().sub(a);
          const len = d.length();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
          rails.push(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(len + 0.002, 1, 1)));
        }
      }
      prev = { x, y, z };
    }
  };
  fenceRun(-half - 0.85, -34, -1);
  fenceRun(half + 0.85, 34, 1);
  group.add(spearBars(G, M, fenceBars, 'fence'));
  const postGeo = G.mergeGeometries([
    new THREE.BoxGeometry(0.07, 2.0, 0.07).translate(0, 1.0, 0).toNonIndexed(),
    G.latheFromProfile([[0.0, 2.0], [0.06, 2.0], [0.07, 2.06], [0.03, 2.12], [0.06, 2.2], [0.0, 2.32]], 8).toNonIndexed(),
  ].map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; }));
  group.add(instanced(postGeo, M.iron, posts, { name: 'fencePosts' }));
  group.add(instanced(new THREE.BoxGeometry(1, 0.035, 0.03), M.iron, rails, { name: 'fenceRails', receive: false }));

  B.build(group, { name: 'gateStone' });
  return { group, leftLeaf, rightLeaf, lights, lanterns, y0 };
}
