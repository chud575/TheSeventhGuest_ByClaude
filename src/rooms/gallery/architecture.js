import * as THREE from 'three';
import { X0, X1, Z0, Z1, H, DADO, CROWN_H, FRIEZE_H, RAIL_Y, BAYS, PIL, BEAM, DOORS, ARCH, WIN, LANDING } from './layout.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);
const T = 0.16;                 // wall thickness at openings

/** engine curtainGeometry can emit NaN in its top row; patch from the row below */
export function fixNaN(g, segX = 140) {
  const a = g.attributes.position.array;
  const row = (segX + 1) * 3;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) a[i] = Number.isFinite(a[i + row]) ? a[i + row] : 0;
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Vertical rectangle from (ax,az) to (bx,bz), y0..y1; faces cross(dir, up). u = uStart + along, v = y. */
export function vRect(ax, az, bx, bz, y0, y1, uStart = 0, uvScale = 1) {
  const len = Math.hypot(bx - ax, bz - az);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([uStart * uvScale, y0 * uvScale, (uStart + len) * uvScale, y0 * uvScale, (uStart + len) * uvScale, y1 * uvScale, uStart * uvScale, y1 * uvScale], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/** Place an object authored facing +Z (origin on the wall plane) onto a wall. side: -1 left, +1 right, 'far', 'near'. */
export function mount(obj, side, along, y = 0, inset = 0) {
  if (side === -1) { obj.position.set(X0 + inset, y, along); obj.rotation.y = Math.PI / 2; }
  else if (side === 1) { obj.position.set(X1 - inset, y, along); obj.rotation.y = -Math.PI / 2; }
  else if (side === 'far') { obj.position.set(along, y, Z0 + inset); obj.rotation.y = 0; }
  else { obj.position.set(along, y, Z1 - inset); obj.rotation.y = Math.PI; }
  return obj;
}

/** Inward-facing reveal (jambs + semicircular soffit) for an arched opening, local XY facing +Z, from z=0 back to z=-depth. */
export function archReveal(w, bottom, spring, depth, segs = 28) {
  const r = w / 2;
  const pts = [];
  pts.push([-r, bottom]);
  for (let i = 0; i <= segs; i++) { const a = Math.PI - (i / segs) * Math.PI; pts.push([Math.cos(a) * r, spring + Math.sin(a) * r]); }
  pts.push([r, bottom]);
  const pos = [], uv = [], idx = [];
  let u = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) u += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    pos.push(pts[i][0], pts[i][1], 0, pts[i][0], pts[i][1], -depth);
    uv.push(u, 0, u, depth);
  }
  for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make normals point toward the opening's axis
  const n = g.attributes.normal, p = g.attributes.position;
  for (let i = 0; i < n.count; i++) {
    const cx = -p.getX(i), cy = (p.getY(i) > spring ? spring : p.getY(i)) - p.getY(i);
    if (n.getX(i) * cx + n.getY(i) * cy < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  }
  return g;
}

/** Arched path (open), local XY at z, for casings: from (−r, bottom) up, over, down to (r, bottom). */
function archPath(w, bottom, spring, z = 0, segs = 24) {
  const r = w / 2;
  const p = [V3(-r, bottom, z)];
  for (let i = 0; i <= segs; i++) { const a = Math.PI - (i / segs) * Math.PI; p.push(V3(Math.cos(a) * r, spring + Math.sin(a) * r, z)); }
  p.push(V3(r, bottom, z));
  return p;
}

const ARCHITRAVE = (w = 0.13, d = 0.038) => [
  [0, 0], [d * 0.55, 0], [d * 0.6, w * 0.1], [d * 0.62, w * 0.3], [d * 0.75, w * 0.36], [d * 0.8, w * 0.55],
  [d * 0.92, w * 0.62], [d, w * 0.72], [d * 0.98, w * 0.82], [d * 0.85, w * 0.9], [d * 0.7, w * 0.94], [d * 0.6, w], [0, w],
].map(([x, y]) => V2(x, y));

// ============================================================================ shell
export function buildShell(ctx, root, mat) {
  const { geometry: G } = ctx;
  const add = (m, name) => { if (name) m.name = name; root.add(m); return m; };

  // ---------------------------------------------------------------- floor + ceiling
  {
    const zA = Z0 - WIN.depth, zB = Z1 + 1.4;
    const g = new THREE.PlaneGeometry(X1 - X0, zB - zA);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, (zA + zB) / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, -p.getZ(i), p.getX(i));     // boards run along the hall (grain along U)
    if (!mat.skipFloor) add(new THREE.Mesh(g, mat.floor), 'floor');
    const c = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0);
    c.rotateX(Math.PI / 2);
    c.translate(0, H, (Z0 + Z1) / 2);
    const cp = c.attributes.position, cuv = c.attributes.uv;
    for (let i = 0; i < cp.count; i++) cuv.setXY(i, cp.getX(i), cp.getZ(i));
    add(new THREE.Mesh(c, mat.ceiling), 'ceiling');
  }

  // ---------------------------------------------------------------- walls (strips around openings)
  // left wall: path from Z1 -> Z0 at x = X0 (faces +x). u = Z1 - z.
  const L = (za, zb, y0, y1) => add(new THREE.Mesh(vRect(X0, za, X0, zb, y0, y1, Z1 - za), mat.wall), 'wall');
  const R = (za, zb, y0, y1) => add(new THREE.Mesh(vRect(X1, za, X1, zb, y0, y1, za - Z0), mat.wall), 'wall');
  {
    const a = DOORS.attic;
    L(Z1, a.z + a.w / 2, 0, H); L(a.z - a.w / 2, Z0, 0, H); L(a.z + a.w / 2, a.z - a.w / 2, a.h, H);
    const b = DOORS.bedroom, g = DOORS.gameroom;
    R(Z0, g.z - g.w / 2, 0, H); R(g.z - g.w / 2, g.z + g.w / 2, g.h, H); R(g.z + g.w / 2, b.z - b.w / 2, 0, H);
    R(b.z - b.w / 2, b.z + b.w / 2, b.h, H); R(b.z + b.w / 2, Z1, 0, H);
  }
  // far wall (window) faces +z
  {
    const r = WIN.w / 2, spring = WIN.sill + WIN.h - r;
    add(new THREE.Mesh(vRect(X0, Z0, -r, Z0, 0, H, 0), mat.wall), 'wall');
    add(new THREE.Mesh(vRect(r, Z0, X1, Z0, 0, H, X1 - r + 2), mat.wall), 'wall');
    add(new THREE.Mesh(vRect(-r, Z0, r, Z0, 0, WIN.sill, 1), mat.wall), 'wall');
    const sp = new THREE.Shape();
    sp.moveTo(-r, spring); sp.lineTo(-r, H); sp.lineTo(r, H); sp.lineTo(r, spring); sp.absarc(0, spring, r, 0, Math.PI, false);
    const sg = new THREE.ShapeGeometry(sp, 24);
    const suv = sg.attributes.uv; for (let i = 0; i < suv.count; i++) suv.setXY(i, suv.getX(i) + 2, suv.getY(i));
    const spand = new THREE.Mesh(sg, mat.wall); spand.position.z = Z0; add(spand, 'wall');
    // reveal + sill + window seat
    const rev = new THREE.Mesh(archReveal(WIN.w, WIN.sill, spring, WIN.depth), mat.plasterLight);
    rev.position.set(0, 0, Z0); add(rev, 'reveal');
    const back = new THREE.Mesh(vRect(-r - 0.3, Z0 - WIN.depth - 0.01, r + 0.3, Z0 - WIN.depth - 0.01, WIN.sill - 0.6, H, 0), mat.black);
    back.visible = false; // (placeholder kept invisible)
    // window seat box built into the reveal
    const seat = new THREE.Mesh(G.boxUV(WIN.w + 0.002, WIN.sill - 0.0, WIN.depth + 0.12, 1), mat.wainscot);
    seat.position.set(0, WIN.sill / 2, Z0 - WIN.depth / 2 + 0.06); add(seat, 'seat');
    const seatTop = new THREE.Mesh(new G.RoundedBoxGeometry(WIN.w + 0.06, 0.05, WIN.depth + 0.2, 2, 0.012), mat.mahogany);
    seatTop.position.set(0, WIN.sill + 0.0, Z0 - WIN.depth / 2 + 0.09); add(seatTop, 'seatTop');
    const cushion = new THREE.Mesh(new G.RoundedBoxGeometry(WIN.w - 0.04, 0.09, WIN.depth - 0.05, 4, 0.04), mat.velvetSeat);
    cushion.position.set(0, WIN.sill + 0.07, Z0 - WIN.depth / 2 - 0.0); add(cushion, 'cushion');
    for (const x of [-0.42, 0.0, 0.42]) {
      const p = new THREE.Mesh(G.raisedPanel(0.36, WIN.sill - 0.2, { border: 0.04, bevel: 0.015 }), mat.wainscot);
      p.position.set(x, WIN.sill / 2 - 0.02, Z0 + 0.121); add(p);
    }
    // casing around the arch
    const cas = new THREE.Mesh(G.sweepProfile(ARCHITRAVE(0.14, 0.04), archPath(WIN.w + 0.02, WIN.sill + 0.03, spring, 0), { up: V3(0, 0, 1), uvScale: 2, flipOutward: true }), mat.giltPlain);
    cas.position.z = Z0 + 0.002; add(cas, 'casing');
    // keystone
    const key = new THREE.Mesh(new G.RoundedBoxGeometry(0.16, 0.24, 0.07, 2, 0.01), mat.giltCap);
    key.position.set(0, spring + r + 0.08, Z0 + 0.03); add(key, 'keystone');
  }
  // near wall with the arch to the landing, faces -z (path +x... -> from X1 to X0)
  {
    const r = ARCH.w / 2, spring = ARCH.h - r;
    add(new THREE.Mesh(vRect(X1, Z1, r, Z1, 0, H, 0), mat.wall), 'wall');
    add(new THREE.Mesh(vRect(-r, Z1, X0, Z1, 0, H, X1 + r), mat.wall), 'wall');
    const sp = new THREE.Shape();
    sp.moveTo(-r, spring); sp.lineTo(-r, H); sp.lineTo(r, H); sp.lineTo(r, spring); sp.absarc(0, spring, r, 0, Math.PI, false);
    const sg = new THREE.ShapeGeometry(sp, 24);
    const spand = new THREE.Mesh(sg, mat.wall); spand.position.z = Z1; spand.rotation.y = Math.PI; add(spand, 'wall');
    const rev = new THREE.Mesh(archReveal(ARCH.w, 0, spring, T + 0.1), mat.wainscot);
    rev.position.set(0, 0, Z1); rev.rotation.y = Math.PI; add(rev, 'reveal');
    const cas = new THREE.Mesh(G.sweepProfile(ARCHITRAVE(0.16, 0.045), archPath(ARCH.w + 0.02, 0, spring, 0), { up: V3(0, 0, 1), uvScale: 2, flipOutward: true }), mat.mahogany);
    cas.position.z = Z1 - 0.002; cas.rotation.y = Math.PI; add(cas, 'casing');
    // the hall-side face of the arch on the landing side too
    const cas2 = cas.clone(); cas2.position.z = Z1 + T + 0.1; cas2.rotation.y = 0; add(cas2);
    cas.visible = false;
    const key = new THREE.Mesh(new G.RoundedBoxGeometry(0.18, 0.28, 0.08, 2, 0.01), mat.giltCap);
    key.visible = false;
    // hall-side archivolt: wide stepped moulding, gilt bead, carved keystone and impost blocks
    const AV = [[0, 0], [0.02, 0], [0.024, 0.012], [0.03, 0.02], [0.045, 0.024], [0.05, 0.05], [0.04, 0.06], [0.05, 0.075], [0.062, 0.09], [0.065, 0.12], [0.05, 0.13], [0.05, 0.16], [0.07, 0.175], [0.072, 0.2], [0.055, 0.22], [0, 0.22]].map(([x, y]) => V2(x, y));
    const av = new THREE.Mesh(G.sweepProfile(AV, archPath(ARCH.w + 0.02, 0.32, spring, 0), { up: V3(0, 0, 1), uvScale: 2, flipOutward: true }), mat.mahogany);
    av.position.z = Z1 - 0.003; av.rotation.y = Math.PI; add(av, 'archivolt');
    const bead = new THREE.Mesh(G.sweepProfile([V2(0, 0), V2(0.012, 0.004), V2(0.016, 0.014), V2(0.012, 0.024), V2(0, 0.028)], archPath(ARCH.w + 0.48, 0.32, spring, 0), { up: V3(0, 0, 1), uvScale: 3, flipOutward: true }), mat.giltPlain);
    bead.position.z = Z1 - 0.003; bead.rotation.y = Math.PI; add(bead, 'archBead');
    const ks = new THREE.Shape();
    ks.moveTo(-0.09, 0); ks.lineTo(0.09, 0); ks.lineTo(0.13, 0.34); ks.quadraticCurveTo(0.0, 0.38, -0.13, 0.34); ks.lineTo(-0.09, 0);
    const kg = new THREE.ExtrudeGeometry(ks, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 3, curveSegments: 10 });
    const k2 = new THREE.Mesh(G.applyBoxUVs(kg, 1), mat.mahogany); k2.position.set(0, spring + r - 0.06, Z1 - 0.13); add(k2, 'keystone2');
    const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 20), mat.giltCap); scroll.position.set(0, spring + r + 0.12, Z1 - 0.15); add(scroll);
    for (const sx of [-1, 1]) {
      const imp = new THREE.Mesh(new G.RoundedBoxGeometry(0.3, 0.14, 0.11, 2, 0.01), mat.mahogany);
      imp.position.set(sx * (ARCH.w / 2 + 0.1), spring - 0.04, Z1 - 0.06); add(imp, 'impost');
      const pl = new THREE.Mesh(new G.RoundedBoxGeometry(0.28, 0.32, 0.07, 2, 0.008), mat.mahogany);
      pl.position.set(sx * (ARCH.w / 2 + 0.1), 0.16, Z1 - 0.04); add(pl, 'plinth');
    }
  }

  // ---------------------------------------------------------------- mouldings (perimeter loop, CCW from above)
  const loop = (y) => [V3(X0, y, Z0), V3(X1, y, Z0), V3(X1, y, Z1), V3(X0, y, Z1)];
  add(new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(CROWN_H, 0.17), loop(H - CROWN_H), { closed: true, uvScale: 1 }), mat.crownGilt), 'crown');
  add(new THREE.Mesh(G.sweepProfile([V2(0.006, 0), V2(0.006, FRIEZE_H)], loop(H - CROWN_H - FRIEZE_H), { closed: true, uvScale: 1 }), mat.frieze), 'frieze');
  add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.04, 0.024), loop(RAIL_Y), { closed: true, uvScale: 2 }), mat.giltPlain), 'rail');

  // chair rail + baseboard: open runs between openings
  const runs = [];
  const a = DOORS.attic, b = DOORS.bedroom, g = DOORS.gameroom;
  const cw = 0.15;  // casing width
  // left wall Z1 -> Z0
  runs.push([[-ARCH.w / 2 - 0.17, Z1], [X0, Z1], [X0, a.z + a.w / 2 + cw]]);
  runs.push([[X0, a.z - a.w / 2 - cw], [X0, Z0], [-WIN.w / 2 - 0.16, Z0]]);
  // far wall right part -> right wall up to gameroom
  runs.push([[WIN.w / 2 + 0.16, Z0], [X1, Z0], [X1, g.z - g.w / 2 - cw]]);
  runs.push([[X1, g.z + g.w / 2 + cw], [X1, b.z - b.w / 2 - cw]]);
  runs.push([[X1, b.z + b.w / 2 + cw], [X1, Z1], [ARCH.w / 2 + 0.17, Z1]]);
  for (const run of runs) {
    // the left-most near-wall run must continue into the left wall run: join them
    const chair = run.map(([x, z]) => V3(x, DADO, z));
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.075, 0.04), chair, { uvScale: 1 }), mat.mahogany), 'chairRail');
    const base = run.map(([x, z]) => V3(x, 0, z));
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.baseboard(0.24, 0.032), base, { uvScale: 1 }), mat.mahogany), 'baseboard');
  }

  // ---------------------------------------------------------------- wainscot (backing + raised panels)
  const panelGeo = G.raisedPanel(0.6, 0.5, { border: 0.065, bevel: 0.028 });
  const wains = (side, zA, zB) => {
    const len = Math.abs(zB - zA);
    if (len < 0.2) return;
    const mid = (zA + zB) / 2;
    const backing = new THREE.Mesh(G.boxUV(len, DADO - 0.24, 0.02, 1), mat.wainscot);
    mount(backing, side, mid, 0.24 + (DADO - 0.24) / 2, 0.01);
    add(backing, 'wainscot');
    const n = Math.max(1, Math.round(len / 0.72));
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(panelGeo, mat.wainscot);
      const off = -len / 2 + (len / n) * (i + 0.5);
      const grp = new THREE.Group();
      p.scale.set((len / n - 0.1) / 0.6, 1, 1);
      p.position.set(off * (side === -1 ? -1 : 1), 0, 0);
      grp.add(p);
      mount(grp, side, mid, 0.24 + (DADO - 0.24) / 2 + 0.005, 0.02);
      root.add(grp);
    }
  };
  // segments between pilasters / doors on each wall
  const segsFor = (side) => {
    const cuts = [Z1, ...BAYS, Z0];
    const out = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      let zA = cuts[i] - (i === 0 ? 0 : PIL.w / 2 + 0.03), zB = cuts[i + 1] + (i === cuts.length - 2 ? 0 : PIL.w / 2 + 0.03);
      // doors inside this segment split it
      const doors = Object.values(DOORS).filter((d) => d.side === side && d.z < zA && d.z > zB);
      let cur = zA;
      for (const d of doors) { out.push([cur, d.z + d.w / 2 + cw + 0.02]); cur = d.z - d.w / 2 - cw - 0.02; }
      out.push([cur, zB]);
    }
    return out;
  };
  for (const side of [-1, 1]) for (const [zA, zB] of segsFor(side)) wains(side, zA, zB);
  // far wall either side of the window, near wall either side of the arch
  for (const s of [-1, 1]) {
    const xa = s * (WIN.w / 2 + 0.17), xb = s * (X1 - 0.0);
    const len = Math.abs(xb - xa), mid = (xa + xb) / 2;
    const bk = new THREE.Mesh(G.boxUV(len, DADO - 0.24, 0.02, 1), mat.wainscot); mount(bk, 'far', mid, 0.24 + (DADO - 0.24) / 2, 0.01); add(bk, 'wainscot');
    const p = new THREE.Mesh(panelGeo, mat.wainscot); p.scale.set((len - 0.12) / 0.6, 1, 1); mount(p, 'far', mid, 0.24 + (DADO - 0.24) / 2 + 0.005, 0.02); add(p);
    const xa2 = s * (ARCH.w / 2 + 0.18), xb2 = s * X1;
    const len2 = Math.abs(xb2 - xa2), mid2 = (xa2 + xb2) / 2;
    const bk2 = new THREE.Mesh(G.boxUV(len2, DADO - 0.24, 0.02, 1), mat.wainscot); mount(bk2, 'near', mid2, 0.24 + (DADO - 0.24) / 2, 0.01); add(bk2, 'wainscot');
  }

  // ---------------------------------------------------------------- pilasters + ceiling beams
  const pil = makePilaster(ctx, mat);
  for (const z of BAYS) for (const side of [-1, 1]) {
    const p = pil.clone();
    mount(p, side, z, 0, 0);
    root.add(p);
  }
  for (const z of BAYS) root.add(makeBeam(ctx, mat, z));
  // ceiling roses + coffer mouldings in each bay
  const bayEdges = [Z1, ...BAYS, Z0];
  for (let i = 0; i < bayEdges.length - 1; i++) {
    const za = bayEdges[i] - (i === 0 ? 0.25 : BEAM.w / 2 + 0.25), zb = bayEdges[i + 1] + (i === bayEdges.length - 2 ? 0.25 : BEAM.w / 2 + 0.25);
    const xa = X0 + 0.42, xb = X1 - 0.42;
    const path = [V3(xa, H - 0.001, zb), V3(xb, H - 0.001, zb), V3(xb, H - 0.001, za), V3(xa, H - 0.001, za)];
    // small bead-and-reel panel moulding hanging from the ceiling (profile points down)
    const prof = [V2(0, 0), V2(0.02, -0.002), V2(0.028, -0.012), V2(0.026, -0.022), V2(0.014, -0.03), V2(0, -0.032)].map((v) => V2(v.x - 0.014, v.y));
    const m = new THREE.Mesh(G.sweepProfile(prof, path, { closed: true, uvScale: 3 }), mat.giltPlain);
    add(m, 'coffer');
    const zc = (za + zb) / 2;
    // plaster ceiling rose: stepped rings + leafy scallops, a gilt boss in the centre
    const roseProf = [[0.0, 0], [0.34, 0], [0.34, -0.012], [0.32, -0.02], [0.3, -0.018], [0.28, -0.03], [0.24, -0.034], [0.22, -0.026], [0.2, -0.03], [0.17, -0.05], [0.13, -0.056], [0.1, -0.05], [0.085, -0.06], [0.0, -0.062]];
    const rose = new THREE.Mesh(G.latheFromProfile(roseProf, 48), mat.beam);
    rose.position.set(0, H, zc); add(rose, 'rose');
    const leaves = new THREE.Mesh(G.latheFromProfile([[0.12, 0], [0.2, -0.01], [0.24, -0.03], [0.2, -0.045], [0.12, -0.04]], 16), mat.beam);
    leaves.position.set(0, H - 0.005, zc); leaves.scale.set(1, 1, 1); add(leaves);
    const boss = new THREE.Mesh(G.latheFromProfile([[0.0, 0], [0.07, 0], [0.065, -0.02], [0.04, -0.045], [0.015, -0.07], [0.0, -0.075]], 24), mat.giltCap);
    boss.position.set(0, H - 0.055, zc); add(boss, 'boss');
  }
}

function makePilaster(ctx, mat) {
  const G = ctx.geometry;
  const grp = new THREE.Group();
  grp.name = 'pilaster';
  const w = PIL.w, d = PIL.d;
  const box = (bw, bh, bd, y, m = mat.wainscot, name) => {
    const b = new THREE.Mesh(new G.RoundedBoxGeometry(bw, bh, bd, 2, Math.min(0.006, bh / 3)), m);
    b.position.set(0, y + bh / 2, bd / 2);
    if (name) b.name = name;
    G.applyBoxUVs && (b.geometry = G.applyBoxUVs(b.geometry, 1));
    grp.add(b); return b;
  };
  box(w + 0.08, 0.24, d + 0.05, 0);                                    // plinth
  box(w + 0.05, DADO - 0.26, d + 0.03, 0.24);                          // pedestal
  const pp = new THREE.Mesh(G.raisedPanel(w - 0.02, DADO - 0.42, { border: 0.04, bevel: 0.015 }), mat.wainscot);
  pp.position.set(0, 0.24 + (DADO - 0.26) / 2, d + 0.03); grp.add(pp);
  box(w + 0.1, 0.05, d + 0.07, DADO - 0.04, mat.mahogany);           // dado cap
  box(w + 0.03, 0.06, d + 0.02, DADO + 0.01, mat.mahogany);          // shaft base
  // fluted shaft
  const top = H - BEAM.d - 0.2;
  const y0 = DADO + 0.07;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(-w / 2, -d);
  const nF = 5, rf = 0.015, sp = 0.045;
  for (let i = 0; i < nF; i++) {
    const xc = (i - (nF - 1) / 2) * sp;
    shape.lineTo(xc - rf, -d);
    shape.absarc(xc, -d, rf, Math.PI, 0, true);
  }
  shape.lineTo(w / 2, -d); shape.lineTo(w / 2, 0); shape.lineTo(-w / 2, 0);
  const sg = new THREE.ExtrudeGeometry(shape, { depth: top - y0, bevelEnabled: false, curveSegments: 6 });
  sg.rotateX(-Math.PI / 2);
  const shaft = new THREE.Mesh(G.applyBoxUVs(sg, 1), mat.pilasterWood);
  shaft.position.y = y0;
  grp.add(shaft);
  // capital: necking, egg-and-dart echinus (gilt), abacus
  box(w + 0.02, 0.03, d + 0.015, top, mat.mahogany);
  const ech = box(w + 0.07, 0.07, d + 0.04, top + 0.03, mat.giltCap, 'capital');
  ech.geometry = G.boxUV(w + 0.07, 0.07, d + 0.04, 1);
  ech.material = mat.capitalGilt;
  box(w + 0.11, 0.05, d + 0.06, top + 0.1, mat.mahogany);
  box(w + 0.13, H - BEAM.d - (top + 0.15), d + 0.075, top + 0.15, mat.giltPlain);
  return grp;
}

function makeBeam(ctx, mat, z) {
  const G = ctx.geometry;
  const grp = new THREE.Group();
  grp.name = 'beam';
  const len = X1 - X0;
  const body = new THREE.Mesh(G.boxUV(len, BEAM.d, BEAM.w, 1), mat.beam);
  body.position.set(0, H - BEAM.d / 2, z);
  grp.add(body);
  // gilt soffit strip (rosettes)
  const sof = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.1, BEAM.w - 0.1), mat.soffit);
  sof.rotation.x = Math.PI / 2;
  sof.position.set(0, H - BEAM.d - 0.002, z);
  const suv = sof.geometry.attributes.uv; for (let i = 0; i < suv.count; i++) suv.setXY(i, suv.getX(i) * (len - 0.1), suv.getY(i));
  grp.add(sof);
  // crown at both beam/ceiling junctions + bead at the soffit edges
  const ch = 0.11;
  for (const s of [1, -1]) {
    const zz = z + s * BEAM.w / 2;
    const path = s > 0 ? [V3(X0, H - ch, zz), V3(X1, H - ch, zz)] : [V3(X1, H - ch, zz), V3(X0, H - ch, zz)];
    grp.add(new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(ch, 0.085), path, { uvScale: 2 }), mat.crownGilt));
    const bp = s > 0 ? [V3(X0, H - BEAM.d - 0.005, zz), V3(X1, H - BEAM.d - 0.005, zz)] : [V3(X1, H - BEAM.d - 0.005, zz), V3(X0, H - BEAM.d - 0.005, zz)];
    grp.add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.05, 0.022), bp, { uvScale: 2 }), mat.giltPlain));
  }
  return grp;
}

// ============================================================================ doors
/** Six-panel door in its opening, with casing and an entablature head. Local: facing +Z, origin bottom-centre at the wall face. */
export function makeDoor(ctx, mat, { w, h, open = 0, name = 'door' }) {
  const G = ctx.geometry;
  const grp = new THREE.Group();
  grp.name = name;
  // jambs + head (reveal)
  const jm = mat.wainscot;
  const jl = new THREE.Mesh(G.boxUV(0.04, h, T, 1), jm); jl.position.set(-w / 2 - 0.02, h / 2, -T / 2); grp.add(jl);
  const jr = jl.clone(); jr.position.x = w / 2 + 0.02; grp.add(jr);
  const jh = new THREE.Mesh(G.boxUV(w + 0.08, 0.04, T, 1), jm); jh.position.set(0, h + 0.02, -T / 2); grp.add(jh);
  // a black void behind (rooms beyond are other modules)
  const voidM = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.1, h + 0.1), mat.black);
  voidM.position.set(0, h / 2, -T - 0.25); voidM.name = 'void'; grp.add(voidM);
  // leaf on hinges (pivot at the left jamb)
  const hinge = new THREE.Group();
  hinge.position.set(-w / 2, 0, -T + 0.06);
  hinge.rotation.y = -open;
  hinge.name = `${name}-hinge`;
  hinge.userData.dynamic = true;
  grp.add(hinge);
  const leaf = new THREE.Group();
  leaf.position.set(w / 2, 0, 0);
  hinge.add(leaf);
  const lw = w - 0.006, lt = 0.05;
  const slab = new THREE.Mesh(G.boxUV(lw, h - 0.006, lt, 1), mat.doorWood);
  slab.position.set(0, h / 2, -lt / 2); leaf.add(slab);
  // panels: 2 columns x 3 rows (tall top, small lock rail panel, bottom)
  const rows = [[0.16, 0.78], [1.06, 0.34], [1.53, h - 1.53 - 0.16]];
  for (const [y, ph] of rows) for (const s of [-1, 1]) {
    const pw = lw / 2 - 0.15;
    const p = new THREE.Mesh(G.raisedPanel(pw, ph, { border: 0.045, bevel: 0.03, fieldDepth: 0.01 }), mat.doorWood);
    p.position.set(s * (lw / 4 - 0.015), y + ph / 2, 0.0); leaf.add(p);
  }
  // brass furniture
  const plate = new THREE.Mesh(new G.RoundedBoxGeometry(0.05, 0.2, 0.008, 2, 0.003), mat.brass);
  plate.position.set(lw / 2 - 0.085, 1.0, 0.004); leaf.add(plate);
  const knob = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0.0], [0.01, 0.02], [0.012, 0.035], [0.028, 0.05], [0.03, 0.065], [0.022, 0.078], [0, 0.08]], 24), mat.brass);
  knob.rotation.x = Math.PI / 2; knob.position.set(lw / 2 - 0.085, 1.03, 0.004); leaf.add(knob);
  const key = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.01, 10), mat.black);
  key.rotation.x = Math.PI / 2; key.position.set(lw / 2 - 0.085, 0.95, 0.009); leaf.add(key);
  // escutcheon with a keyhole below the knob
  const esc = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.022, 0], [0.024, 0.003], [0.02, 0.006], [0, 0.007]], 20), mat.brass);
  esc.rotation.x = Math.PI / 2; esc.scale.set(1, 1, 1.6); esc.position.set(lw / 2 - 0.085, 0.93, 0.004); leaf.add(esc);
  const kh = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 12), mat.black); kh.position.set(lw / 2 - 0.085, 0.936, 0.0115); leaf.add(kh);
  const ks = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.012), mat.black); ks.position.set(lw / 2 - 0.085, 0.927, 0.0115); leaf.add(ks);
  // three brass butt hinges: leaf plate on the edge + knuckle barrel with finials
  for (const y of [0.24, h / 2 + 0.05, h - 0.28]) {
    const kn = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.008, 0], [0.009, 0.004], [0.009, 0.096], [0.008, 0.1], [0, 0.1]], 12), mat.brass);
    kn.position.set(-lw / 2 - 0.004, y - 0.05, 0.004); leaf.add(kn);
    for (const sgn of [1, -1]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), mat.brass); f.position.set(-lw / 2 - 0.004, y + sgn * 0.056, 0.004); leaf.add(f); }
    const pl = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.09, 0.003), mat.brass); pl.position.set(-lw / 2 + 0.014, y, 0.0015); leaf.add(pl);
  }
  // casing (architrave) on the wall face
  const cas = new THREE.Mesh(G.sweepProfile(ARCHITRAVE(0.14, 0.04), [V3(-w / 2 - 0.0, 0, 0), V3(-w / 2 - 0.0, h + 0.0, 0), V3(w / 2 + 0.0, h + 0.0, 0), V3(w / 2 + 0.0, 0, 0)], { up: V3(0, 0, 1), uvScale: 2, flipOutward: true }), mat.mahogany);
  grp.add(cas);
  // plinth blocks at the casing feet
  for (const s of [-1, 1]) {
    const pb = new THREE.Mesh(new G.RoundedBoxGeometry(0.17, 0.27, 0.055, 2, 0.006), mat.mahogany);
    pb.position.set(s * (w / 2 + 0.07), 0.135, 0.027); grp.add(pb);
  }
  // entablature: frieze board + gilt bead + cornice with returns
  const ew = w + 0.42, fy = h + 0.14;
  const frieze = new THREE.Mesh(G.boxUV(ew - 0.06, 0.2, 0.05, 1), mat.doorWood);
  frieze.position.set(0, fy + 0.1, 0.025); grp.add(frieze);
  const fz = new THREE.Mesh(new THREE.PlaneGeometry(ew - 0.2, 0.12), mat.doorFrieze);
  const fuv = fz.geometry.attributes.uv; for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * (ew - 0.2), fuv.getY(i));
  fz.position.set(0, fy + 0.1, 0.0505); grp.add(fz);
  const cy = fy + 0.2;
  const corn = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.16, 0.12), [V3(-ew / 2, cy, 0), V3(-ew / 2, cy, 0.05), V3(ew / 2, cy, 0.05), V3(ew / 2, cy, 0)], { uvScale: 2 }), mat.mahogany);
  grp.add(corn);
  const cap = new THREE.Mesh(G.boxUV(ew + 0.24, 0.025, 0.2, 1), mat.mahogany);
  cap.position.set(0, cy + 0.16 + 0.012, 0.09); grp.add(cap);
  const bead = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.03, 0.015), [V3(-ew / 2 + 0.03, fy, 0.05), V3(ew / 2 - 0.03, fy, 0.05)], { uvScale: 3 }), mat.giltPlain);
  grp.add(bead);
  grp.userData.hinge = hinge;
  return grp;
}

// ============================================================================ window (far wall)
export function buildWindow(ctx, root, mat) {
  const G = ctx.geometry;
  const r = WIN.w / 2, spring = WIN.sill + WIN.h - r;
  const win = new THREE.Group();
  win.name = 'window';
  win.position.set(0, 0, Z0 - WIN.depth + 0.07);
  const fm = mat.windowFrame;
  const bar = (w, h, x, y, d = 0.05) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fm); m.position.set(x, y, 0); win.add(m); return m; };
  const top = WIN.sill + 0.1;
  bar(WIN.w, 0.07, 0, top - 0.035, 0.08);
  bar(0.06, spring - top, -r + 0.03, (spring + top) / 2, 0.07);
  bar(0.06, spring - top, r - 0.03, (spring + top) / 2, 0.07);
  bar(0.045, spring - top + r - 0.03, 0, (spring + r - 0.03 + top) / 2, 0.06);       // centre mullion
  // sash rails + glazing bars
  for (const y of [top + 0.55, top + 1.0, top + 1.5]) bar(WIN.w - 0.06, y === top + 1.0 ? 0.06 : 0.025, 0, y, y === top + 1.0 ? 0.06 : 0.035);
  for (const x of [-r / 2, r / 2]) bar(0.025, spring - top, x, (spring + top) / 2, 0.035);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(r - 0.03, 0.03, 8, 40, Math.PI), fm); arc.position.set(0, spring, 0); win.add(arc);
  const arc2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.5, 0.014, 6, 32, Math.PI), fm); arc2.position.set(0, spring, 0); win.add(arc2);
  for (let i = 1; i < 6; i++) {
    if (i === 3) continue;
    const a = Math.PI * (i / 6);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, r * 0.5, 0.03), fm);
    m.position.set(Math.cos(a) * r * 0.75, spring + Math.sin(a) * r * 0.75, 0); m.rotation.z = a - Math.PI / 2; win.add(m);
  }
  // glass
  const gs = new THREE.Shape();
  gs.moveTo(-r, top); gs.lineTo(-r, spring); gs.absarc(0, spring, r, Math.PI, 0, true); gs.lineTo(r, top); gs.lineTo(-r, top);
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(gs, 32), mat.glass);
  glass.position.z = -0.01; glass.userData.noShadow = true; glass.name = 'glass';
  win.add(glass);
  root.add(win);
  // night sky backdrop
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.8), mat.sky);
  sky.position.set(0.4, 2.2, Z0 - 3.2);
  sky.name = 'sky';
  sky.userData.noShadow = true;
  root.add(sky);
  // curtains (blue velvet) with tie-backs and a swagged valance
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(fixNaN(G.curtainGeometry({ width: 0.8, height: 3.18, folds: 8, depth: 0.075, tieback: 0, pool: 0.12, seed: s + 5 })), mat.velvet);
    c.position.set(s * (r + 0.42), H - 0.36, Z0 + 0.17);
    if (s > 0) c.scale.x = -1;
    c.name = 'curtain';
    root.add(c);
  }
  const val = new THREE.Mesh(fixNaN(G.curtainGeometry({ width: WIN.w + 1.4, height: 0.5, folds: 12, depth: 0.05, gather: 1, seed: 9 })), mat.velvet);
  val.position.set(0, H - 0.3, Z0 + 0.24); val.name = 'valance';
  root.add(val);
  const pelmet = new THREE.Mesh(new G.RoundedBoxGeometry(WIN.w + 1.5, 0.12, 0.12, 2, 0.01), mat.giltPlain);
  pelmet.position.set(0, H - 0.32, Z0 + 0.2); root.add(pelmet);
  return { spring, top };
}

// ============================================================================ landing beyond the near arch
export function buildLanding(ctx, root, mat) {
  const G = ctx.geometry;
  const zA = Z1 + T + 0.1, zB = Z1 + LANDING.depth;
  const xa = -2.4, xb = 2.4;
  // floor of the landing
  const f = new THREE.Mesh(G.planeUV(xb - xa, zB - zA + 0.2, 1), mat.floor);
  f.rotation.x = -Math.PI / 2; f.position.set(0, 0.001, (zA + zB) / 2); f.name = 'floor'; if (!mat.skipFloor) root.add(f);
  // walls left/right and the back of the hall wall
  root.add(new THREE.Mesh(vRect(xa, zB + 3, xa, zA, 0, H, 0), mat.wall));
  root.add(new THREE.Mesh(vRect(xb, zA, xb, zB + 3, 0, H, 0), mat.wall));
  // ceiling
  const c = new THREE.Mesh(G.planeUV(xb - xa, 6, 1), mat.ceiling); c.rotation.x = Math.PI / 2; c.position.set(0, H, zA + 3); root.add(c);
  {
    // coffer grid + plaster rose on the landing ceiling
    const prof = [V2(0, 0), V2(0.03, -0.004), V2(0.04, -0.02), V2(0.03, -0.04), V2(0.012, -0.05), V2(0, -0.05)].map((v) => V2(v.x - 0.02, v.y));
    const zc = zA + 1.3;
    for (const [w2, l2] of [[3.6, 2.2], [2.4, 1.5]]) {
      const path = [V3(-w2 / 2, H - 0.001, zc + l2 / 2), V3(w2 / 2, H - 0.001, zc + l2 / 2), V3(w2 / 2, H - 0.001, zc - l2 / 2), V3(-w2 / 2, H - 0.001, zc - l2 / 2)];
      root.add(new THREE.Mesh(G.sweepProfile(prof, path, { closed: true, uvScale: 3 }), w2 > 3 ? mat.crownGilt : mat.giltPlain));
    }
    const rose = new THREE.Mesh(G.latheFromProfile([[0.0, 0], [0.4, 0], [0.4, -0.014], [0.36, -0.024], [0.33, -0.02], [0.3, -0.036], [0.25, -0.04], [0.2, -0.032], [0.16, -0.06], [0.1, -0.07], [0.0, -0.075]], 48), mat.beam);
    rose.position.set(0, H, zc); root.add(rose);
    const crownH = 0.2;
    const loopL = [V3(xa, H - crownH, zA), V3(xa, H - crownH, zB + 0.2)];
    root.add(new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(crownH, 0.15), [V3(xb, H - crownH, zB + 0.2), V3(xb, H - crownH, zA)], { uvScale: 1 }), mat.crownGilt));
    root.add(new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(crownH, 0.15), loopL, { uvScale: 1 }), mat.crownGilt));
    // wainscot + chair rail on the landing walls
    for (const [x, sgn] of [[xa, 1], [xb, -1]]) {
      const ch = [V3(x, DADO, sgn > 0 ? zA : zB + 0.2), V3(x, DADO, sgn > 0 ? zB + 0.2 : zA)];
      root.add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.075, 0.04), ch, { uvScale: 1 }), mat.mahogany));
      const bs = [V3(x, 0, sgn > 0 ? zA : zB + 0.2), V3(x, 0, sgn > 0 ? zB + 0.2 : zA)];
      root.add(new THREE.Mesh(G.sweepProfile(G.PROFILES.baseboard(0.24, 0.032), bs, { uvScale: 1 }), mat.mahogany));
      const wb = new THREE.Mesh(G.boxUV(0.02, DADO, zB - zA + 0.2, 1), mat.wainscot); wb.position.set(x + sgn * 0.01, DADO / 2, (zA + zB + 0.2) / 2); root.add(wb);
    }
  }
  // balustrade overlooking the stair well (open void beyond)
  const railZ = zB;
  const rail = new THREE.Mesh(G.sweepProfile([V2(-0.045, 0), V2(0.045, 0), V2(0.05, 0.03), V2(0.035, 0.07), V2(0.0, 0.085), V2(-0.035, 0.07), V2(-0.05, 0.03), V2(-0.045, 0)].map((v) => V2(v.x, v.y)), [V3(xa, 0.92, railZ), V3(xb, 0.92, railZ)], { uvScale: 1 }), mat.mahogany);
  root.add(rail);
  const shoe = new THREE.Mesh(G.boxUV(xb - xa, 0.08, 0.12, 1), mat.mahogany); shoe.position.set(0, 0.04, railZ); root.add(shoe);
  const balGeo = G.latheFromProfile([[0.022, 0], [0.022, 0.06], [0.016, 0.08], [0.03, 0.2], [0.034, 0.3], [0.02, 0.42], [0.014, 0.5], [0.02, 0.6], [0.014, 0.7], [0.018, 0.78], [0.018, 0.84], [0, 0.84]], 12);
  const n = Math.floor((xb - xa) / 0.13);
  const bal = new THREE.InstancedMesh(balGeo, mat.mahogany, n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { m4.makeTranslation(xa + 0.07 + i * 0.13, 0.08, railZ); bal.setMatrixAt(i, m4); }
  bal.castShadow = true; bal.receiveShadow = true; bal.name = 'balusters';
  root.add(bal);
  for (const x of [xa + 0.05, xb - 0.05]) {
    const newel = new THREE.Mesh(new G.RoundedBoxGeometry(0.14, 1.15, 0.14, 2, 0.01), mat.mahogany); newel.position.set(x, 0.575, railZ); root.add(newel);
    const fin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0], [0.065, 0.03], [0.04, 0.06], [0.055, 0.12], [0.03, 0.18], [0, 0.2]], 20), mat.brass);
    fin.position.set(x, 1.15, railZ); root.add(fin);
  }
  // distant foyer depths: a dim far wall with a great painting glimpsed in warm chandelier glow
  const far = new THREE.Mesh(vRect(xb + 2, zB + 6, xa - 2, zB + 6, -4, H + 1, 0), mat.wall);
  root.add(far);
  const glowFloor = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), mat.black);
  glowFloor.rotation.x = -Math.PI / 2; glowFloor.position.set(0, -3.8, zB + 3); root.add(glowFloor);
}
