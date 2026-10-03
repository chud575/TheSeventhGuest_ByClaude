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
export function spearParts(G, fleur = false) {
  const head = G.latheFromProfile([[0.0, -0.02], [0.026, 0.0], [0.03, 0.03], [0.016, 0.05], [0.034, 0.1], [0.024, 0.14], [0.0, 0.24]], 8);
  let h = head;
  if (fleur) {
    // fleur-de-lis: central spear plus two curled side petals and a collar knop
    const parts = [head.toNonIndexed()];
    for (const s of [-1, 1]) {
      const pet = new THREE.TorusGeometry(0.04, 0.007, 5, 10, Math.PI * 1.15);
      pet.rotateZ(s > 0 ? -0.35 : Math.PI + 0.35 - Math.PI * 0.15);
      pet.translate(s * 0.04, 0.045, 0);
      parts.push(pet.toNonIndexed());
    }
    const knop = new THREE.SphereGeometry(0.022, 8, 6); knop.translate(0, -0.03, 0); parts.push(knop.toNonIndexed());
    for (const p of parts) for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'uv'].includes(k)) p.deleteAttribute(k);
    h = G.mergeGeometries(parts);
  }
  return {
    shaft: new THREE.CylinderGeometry(0.013, 0.013, 1, 6, 1, true).translate(0, 0.5, 0),
    head: h,
  };
}
/** Instanced spear bars from [{x,y,z,h,lean}] in a parent's local space. */
function spearBars(G, M, list, name, fleur = false) {
  const { shaft, head } = spearParts(G, fleur);
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
  // Built in proper sections: chamfered plinth, rusticated ashlar shaft (individual
  // chamfered blocks over a recessed dark mortar core), moulded cornice cap, a die block,
  // a ball-and-neck finial pedestal, and the lantern on top.
  const RB = G.RoundedBoxGeometry;
  const sq = (pts, segs = 4) => G.latheFromProfile(pts.map(([w, y]) => [w / Math.SQRT1_2, y]), segs); // half-width -> lathe radius for a square
  const stone = M.pierStone, mortar = M.mortar;
  const halo = haloTexture(ctx);
  const pier = (x) => {
    const yb = Math.min(height(x - 0.5, GATE.z), height(x + 0.5, GATE.z)) - 0.35;
    const top = y0 + 3.3;
    const add = (g, m, mx, opts = { uvScale: 1 }) => B.add(g, m, mx, opts);
    // plinth: two stepped chamfered blocks + a weathered splay
    add(new RB(1.16, 0.5, 1.16, 2, 0.04), stone, mat4(x, yb + 0.25, GATE.z));
    add(sq([[0.0, 0], [0.58, 0], [0.58, 0.03], [0.5, 0.12], [0.0, 0.12]]), stone, mat4(x, yb + 0.5, GATE.z, 0, Math.PI / 4, 0), { uv: 'box', uvScale: 1 });
    // shaft: mortar core + rusticated courses
    const s0 = yb + 0.62, s1 = top - 0.32;
    add(new THREE.BoxGeometry(0.86, s1 - s0, 0.86), mortar, mat4(x, (s0 + s1) / 2, GATE.z));
    const nC = Math.round((s1 - s0) / 0.36);
    const ch = (s1 - s0) / nC;
    for (let i = 0; i < nC; i++) {
      const cy = s0 + ch * (i + 0.5);
      const alongX = i % 2 === 0;
      for (const k of [-1, 1]) {
        const jx = (R() - 0.5) * 0.012, jz = (R() - 0.5) * 0.012, rr = (R() - 0.5) * 0.012;
        const w = 0.47 - 0.012 + (R() - 0.5) * 0.01;
        const g = alongX ? new RB(w, ch - 0.035, 0.94, 2, 0.04) : new RB(0.94, ch - 0.035, w, 2, 0.04);
        const off = k * (0.235 + 0.003);
        add(g, stone, mat4(x + (alongX ? off : 0) + jx, cy, GATE.z + (alongX ? 0 : off) + jz, rr, rr * 0.5, -rr));
      }
    }
    // cornice cap: necking band, cove, corona with drip, cap slab
    const capY = top - 0.32;
    add(sq([[0.0, 0], [0.5, 0], [0.5, 0.06], [0.48, 0.07], [0.48, 0.1], [0.52, 0.14], [0.58, 0.2], [0.62, 0.22], [0.62, 0.32], [0.6, 0.34], [0.6, 0.36], [0.56, 0.38], [0.53, 0.4], [0.0, 0.4]]), stone, mat4(x, capY, GATE.z, 0, Math.PI / 4, 0), { uv: 'box', uvScale: 1 });
    // die block + ball finial pedestal
    add(new RB(0.46, 0.26, 0.46, 2, 0.025), stone, mat4(x, capY + 0.53, GATE.z));
    add(sq([[0.0, 0], [0.27, 0], [0.27, 0.03], [0.22, 0.06], [0.0, 0.06]]), stone, mat4(x, capY + 0.66, GATE.z, 0, Math.PI / 4, 0), { uv: 'box', uvScale: 1 });
    add(G.latheFromProfile([[0.0, 0], [0.12, 0], [0.12, 0.03], [0.07, 0.07], [0.06, 0.1], [0.13, 0.14], [0.19, 0.22], [0.2, 0.3], [0.17, 0.38], [0.1, 0.43], [0.06, 0.46], [0.11, 0.49], [0.11, 0.53], [0.0, 0.53]], 20), stone, mat4(x, capY + 0.72, GATE.z), { uv: 'box', uvScale: 1 });
    const ly = capY + 1.25;
    // lantern: iron cage with mullioned panes, pyramid roof, crown finial
    const L = new THREE.Group();
    L.position.set(x, ly, GATE.z);
    const fr = new Bucket();
    const hw = 0.15, lh = 0.46;
    fr.add(G.latheFromProfile([[0.0, -0.02], [0.08, -0.02], [0.12, 0.0], [0.0, 0.0]], 4), M.iron, mat4(0, 0, 0, 0, Math.PI / 4, 0), { uv: 'keep' });
    fr.add(new THREE.BoxGeometry(hw * 2 + 0.04, 0.035, hw * 2 + 0.04), M.iron, mat4(0, 0.02, 0), { uv: 'keep' });
    fr.add(new THREE.BoxGeometry(hw * 2 + 0.05, 0.03, hw * 2 + 0.05), M.iron, mat4(0, lh, 0), { uv: 'keep' });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      fr.add(new THREE.BoxGeometry(0.022, lh, 0.022), M.iron, mat4(sx * hw, lh / 2, sz * hw), { uv: 'keep' });
      // corner scroll brackets under the roof
      fr.add(new THREE.TorusGeometry(0.04, 0.006, 4, 10, Math.PI), M.iron, mat4(sx * (hw + 0.03), lh - 0.05, sz * (hw + 0.03), 0, Math.atan2(sx, sz) + Math.PI / 2, Math.PI / 2), { uv: 'keep' });
    }
    // mullions: one vertical + one horizontal per face
    for (let f = 0; f < 4; f++) {
      const ry = f * Math.PI / 2;
      const mx = mat4(0, 0, 0, 0, ry, 0);
      fr.add(new THREE.BoxGeometry(0.012, lh - 0.04, 0.012), M.iron, mx.clone().multiply(mat4(0, lh / 2, hw)), { uv: 'keep' });
      fr.add(new THREE.BoxGeometry(hw * 2, 0.012, 0.012), M.iron, mx.clone().multiply(mat4(0, lh * 0.62, hw)), { uv: 'keep' });
    }
    // roof: bell-cast pyramid + crown + finial ring
    fr.add(G.latheFromProfile([[0.0, 0], [0.27, 0], [0.26, 0.02], [0.2, 0.06], [0.12, 0.14], [0.05, 0.24], [0.03, 0.26], [0.0, 0.26]], 4), M.iron, mat4(0, lh + 0.015, 0, 0, Math.PI / 4, 0), { uv: 'keep' });
    fr.add(G.latheFromProfile([[0.0, 0], [0.035, 0], [0.025, 0.05], [0.045, 0.09], [0.02, 0.14], [0.012, 0.2], [0.0, 0.22]], 10), M.iron, mat4(0, lh + 0.27, 0), { uv: 'keep' });
    fr.add(new THREE.TorusGeometry(0.035, 0.007, 6, 14), M.iron, mat4(0, lh + 0.52, 0), { uv: 'keep' });
    fr.build(L, { name: 'lanternFrame' });
    // panes: smoky, softly glowing glass (the flame is the hot spot)
    const pane = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 - 0.01, lh - 0.04, hw * 2 - 0.01), M.lanternPane);
    pane.position.y = lh / 2; L.add(pane);
    const flame = ctx.fx.flame({ height: 0.08, width: 0.022, intensity: 9, seed: x });
    flame.position.y = 0.14; L.add(flame);
    // burner
    const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 8), M.brass);
    burner.position.y = 0.07; L.add(burner);
    // halo in the damp air + soft downward cone of light
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xffb070, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.scale.set(1.9, 1.9, 1); sp.position.y = 0.24; sp.renderOrder = 9; sp.userData.noBake = true;
    sp.material.userData.noFog = true;
    L.add(sp);
    const cone = lightCone(1.6, 0.85);
    cone.position.y = 0.05; L.add(cone);
    group.add(L);
    lanterns.push(L);
    const pl = new THREE.PointLight(0xffb070, 2.4, 4.5, 2);
    pl.position.set(x, ly + 0.25, GATE.z + 0.05);
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
    // S-scrolls between the 1.05 and 2.1 rails (two opposed half-coils per bay)
    const sScroll = (x, y, r, flip) => {
      for (const k of [0, 1]) {
        const t = new THREE.TorusGeometry(r, 0.011, 5, 16, Math.PI * 1.25);
        const yy = y + (k ? r : -r);
        L.add(t, iron, mat4(x, yy, 0, 0, 0, (k ? 0 : Math.PI) + (flip ? Math.PI * 0.25 : -Math.PI * 0.25) * (k ? 1 : -1) + (flip ? Math.PI : 0)), { uv: 'keep' });
        // curled tip (small knob)
        const kn = new THREE.SphereGeometry(0.018, 6, 5);
        L.add(kn, iron, mat4(x + (k ? 1 : -1) * (flip ? -1 : 1) * r * 0.55, yy + (k ? -1 : 1) * r * 0.2, 0), { uv: 'keep' });
      }
    };
    for (let i = 0; i < 4; i++) {
      const u = (i + 0.5) / 4;
      const x = dir * u * W;
      sScroll(x, 1.33, 0.12, i % 2 === 1);
      sScroll(x, 1.82, 0.1, i % 2 === 0);
      // circle band under the arch, with a quatrefoil cross inside
      const yc = 2.32 + 0.6 * Math.sin(u * Math.PI / 2);
      L.add(new THREE.TorusGeometry(0.075, 0.011, 6, 18), iron, mat4(x, yc, 0), { uv: 'keep' });
      for (const a2 of [0, Math.PI / 2]) L.add(new THREE.TorusGeometry(0.03, 0.007, 4, 10), iron, mat4(x + Math.cos(a2) * 0.035, yc + Math.sin(a2) * 0.035, 0), { uv: 'keep' });
    }
    // collar bands where the bars cross the rails
    for (let i = 1; i < 13; i++) {
      const x = dir * (i / 13) * W;
      for (const y of [0.42, 1.05, 2.1]) L.add(new THREE.BoxGeometry(0.038, 0.05, 0.05), iron, mat4(x, y, 0), { uv: 'keep' });
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
    leaf.add(spearBars(G, M, list.filter((b, i) => i % 2 === 1), 'gateBars'));
    leaf.add(spearBars(G, M, list.filter((b, i) => i % 2 === 0), 'gateBarsFleur', true));
  }

  // ------------------------------------------------------------------ overthrow: arched iron crest between the piers
  {
    const O = new Bucket();
    const yA = y0 + 3.05, rise = 0.95, span = GATE.w + 0.1;
    const arcY = (u) => yA + rise * Math.sin(u * Math.PI);  // u 0..1 across
    const rodAlong = (f, off, r) => {
      const n = 24;
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n;
        const xa = -span / 2 + span * u0, xb = -span / 2 + span * u1;
        const ya = f(u0) + off, yb = f(u1) + off;
        const len = Math.hypot(xb - xa, yb - ya);
        O.add(new THREE.BoxGeometry(len + 0.01, r * 2, r * 2), M.iron, mat4((xa + xb) / 2, (ya + yb) / 2, GATE.z, 0, 0, Math.atan2(yb - ya, xb - xa)), { uv: 'keep' });
      }
    };
    rodAlong(arcY, 0, 0.028);
    rodAlong(arcY, -0.24, 0.02);
    rodAlong(() => yA - 0.05, 0, 0.024);
    // verticals with fleurs above the arch, scrolls below
    const crestBars = [];
    for (let i = 1; i < 16; i++) {
      const u = i / 16;
      const x = -span / 2 + span * u;
      crestBars.push({ x, y: yA - 0.05, z: GATE.z, h: arcY(u) - yA + 0.05 + 0.12 + (i % 2 ? 0 : 0.1) + (i === 8 ? 0.35 : 0) });
      if (i % 2 === 0 && Math.abs(u - 0.5) > 0.1) {
        const yy = (arcY(u) - 0.24 + yA) / 2;
        O.add(new THREE.TorusGeometry(0.09, 0.01, 5, 16, Math.PI * 1.4), M.iron, mat4(x, yy, GATE.z, 0, 0, u < 0.5 ? 0.6 : Math.PI - 0.6 + Math.PI * 0.4), { uv: 'keep' });
      }
    }
    group.add(spearBars(G, M, crestBars, 'crest', true));
    // central cartouche: ring with a cast monogram plate
    const cy = arcY(0.5) - 0.12;
    O.add(new THREE.TorusGeometry(0.26, 0.022, 8, 32), M.iron, mat4(0, cy, GATE.z), { uv: 'keep' });
    O.add(new THREE.TorusGeometry(0.2, 0.012, 6, 28), M.iron, mat4(0, cy, GATE.z), { uv: 'keep' });
    const sCurve = new THREE.CatmullRomCurve3([[0.09, 0.1], [0.0, 0.14], [-0.09, 0.08], [0.0, 0.0], [0.09, -0.08], [0.0, -0.14], [-0.09, -0.1]].map(([px, py]) => new THREE.Vector3(px, py, 0)));
    O.add(new THREE.TubeGeometry(sCurve, 40, 0.018, 6, false), M.iron, mat4(0, cy, GATE.z), { uv: 'keep' });
    for (const s2 of [-1, 1]) O.add(new THREE.TorusGeometry(0.16, 0.012, 5, 16, Math.PI), M.iron, mat4(s2 * 0.4, cy - 0.02, GATE.z, 0, 0, s2 > 0 ? -0.2 : Math.PI + 0.2), { uv: 'keep' });
    O.build(group, { name: 'overthrow' });
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
      // sections sag and lean with the frost-heaved ground; the odd picket is gone
      const sec = Math.floor(i / 17);
      const secLean = (Math.sin(sec * 7.3 + side * 2.1) * 0.5 + 0.5) > 0.7 ? Math.sin(sec * 3.1) * 0.09 : 0;
      const lean = (R() - 0.5) * 0.04 + secLean + (Math.abs(x) > 18 ? 0.05 * Math.sin(x) : 0);
      const missing = R() < 0.04 && i % 17 !== 0;
      if (!missing) fenceBars.push({ x, y: y - 0.1, z, lean, h: (1.75 + (i % 2) * 0.1) * (R() < 0.03 ? 0.6 : 1) });
      if (i % 17 === 0) posts.push(mat4(x, y - 0.1, z, (R() - 0.5) * 0.05, 0, secLean * 0.7 + (R() - 0.5) * 0.04, 1, 0.94 + R() * 0.1, 1));
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

/** Radial glow for lamp halos in the mist. */
export function haloTexture(ctx) {
  return ctx.textures.canvas('ext:halo1', 256, 256, (g, w, h) => {
    const rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.08, 'rgba(255,240,220,0.75)');
    rg.addColorStop(0.25, 'rgba(255,220,180,0.22)');
    rg.addColorStop(0.55, 'rgba(255,200,150,0.06)');
    rg.addColorStop(1, 'rgba(255,200,150,0)');
    g.clearRect(0, 0, w, h);
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
  }, { tile: false });
}

/** Additive downward cone of lamp light scattered by mist (fades with distance and at the rim). */
export function lightCone(len = 1.6, radius = 0.8, color = new THREE.Color(1.0, 0.62, 0.3), strength = 0.12) {
  const g = new THREE.CylinderGeometry(0.06, radius, len, 24, 6, true);
  g.translate(0, -len / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uStrength: { value: strength }, uLen: { value: len } },
    vertexShader: /* glsl */ `
varying float vT; varying vec3 vN; varying vec3 vV;
void main() {
  vT = -position.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor; uniform float uStrength; uniform float uLen;
varying float vT; varying vec3 vN; varying vec3 vV;
void main() {
  float t = clamp(vT / uLen, 0.0, 1.0);
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
  float a = (1.0 - t) * (1.0 - t) * edge * uStrength;
  gl_FragColor = vec4(uColor * a, 1.0);
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  mat.userData.noBake = true;
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 8;
  m.userData.noBake = true;
  m.name = 'lampCone';
  return m;
}
