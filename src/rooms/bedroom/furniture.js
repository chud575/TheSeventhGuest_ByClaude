import * as THREE from 'three';

/**
 * Bedroom furniture & props. Every builder returns a THREE.Group in a local frame
 * documented on the function (Y up, metres) and never touches the scene itself.
 * `mats` is the room's material table (see index.js).
 */

const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * G.curtainGeometry can emit a NaN row at the heading when floating-point error makes
 * v slightly negative (pow(negative, 0.75)); copy those vertices from the row below.
 */
export function curtain(G, opts) {
  const g = G.curtainGeometry(opts);
  const p = g.attributes.position, stride = (opts.segX ?? 140) + 1;
  let fixed = 0;
  for (let i = 0; i < p.count; i++) {
    if (Number.isFinite(p.getX(i)) && Number.isFinite(p.getY(i)) && Number.isFinite(p.getZ(i))) continue;
    const j = i + stride < p.count ? i + stride : i - stride;
    p.setXYZ(i, Number.isFinite(p.getX(i)) ? p.getX(i) : p.getX(j), Number.isFinite(p.getY(i)) ? p.getY(i) : 0, p.getZ(j));
    fixed++;
  }
  if (fixed) g.computeVertexNormals();
  return g;
}

export function rbox(G, w, h, d, r = 0.008, seg = 2, uv = 1) {
  return G.applyBoxUVs(new G.RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)), uv);
}
function mesh(g, m, x = 0, y = 0, z = 0, parent = null) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  if (parent) parent.add(o);
  return o;
}
/** lathe with metric-ish V so wood grain doesn't smear */
function lathe(G, pts, seg = 24) { return G.latheFromProfile(pts, seg); }

/** Extrude a closed 2D profile (x,y) along local X for `len` metres (mouldings on straight runs). */
export function extrudeProfileX(G, pts, len) {
  const sh = new THREE.Shape(pts.map(([x, y]) => V2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 12, steps: 1 });
  g.translate(0, 0, -len / 2);
  g.rotateY(-Math.PI / 2);        // profile x -> +z (out of the wall), extrude axis -> x
  return G.applyBoxUVs(g, 1);
}

// ============================================================================ bed
/**
 * Four-poster canopy bed. Local frame: width along X (±W/2), head at -Z, foot at +Z
 * (length L), floor at y = 0. userData: { mattressTop, L, W, pillowTop }.
 */
export function buildBed(ctx, mats, { W = 1.75, L = 2.2, postH = 2.45, seed = 3 } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group(); g.name = 'bed';
  const hw = W / 2, hl = L / 2;
  const mTop = 0.8;
  // ---- posts
  const postProfile = [
    [0, 0], [0.062, 0], [0.062, 0.05], [0.055, 0.06], [0.055, 0.4], [0.06, 0.42], [0.06, 0.45], [0.045, 0.47], [0.036, 0.52],
    [0.04, 0.56], [0.056, 0.64], [0.062, 0.72], [0.054, 0.8], [0.036, 0.87], [0.03, 0.93], [0.042, 0.96], [0.042, 0.985], [0.03, 1.0],
    [0.027, 1.25], [0.031, 1.5], [0.027, 1.75], [0.034, 1.8], [0.044, 1.86], [0.046, 1.92], [0.036, 1.98], [0.026, 2.02],
    [0.024, postH - 0.08], [0.036, postH - 0.06], [0.036, postH], [0, postH],
  ];
  const postG = lathe(G, postProfile, 22);
  // spiral reeding suggestion: a twisted rope band on the upper shaft
  const ropeG = (() => {
    const parts = [];
    for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let i = 0; i <= 60; i++) { const t = i / 60; const a = t * Math.PI * 2 * 4 + (k * Math.PI * 2) / 3; pts.push(V3(Math.cos(a) * 0.027, 1.02 + t * 0.72, Math.sin(a) * 0.027)); }
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.0085, 6, false));
    }
    return G.mergeGeometries(parts);
  })();
  const finialG = lathe(G, [[0, 0], [0.045, 0], [0.045, 0.02], [0.03, 0.03], [0.05, 0.08], [0.052, 0.11], [0.035, 0.15], [0.016, 0.18], [0.022, 0.2], [0.008, 0.26], [0, 0.28]], 20);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = sx * hw, pz = sz * hl;
    mesh(postG, mats.mahogany, px, 0, pz, g);
    mesh(ropeG, mats.mahogany, px, 0, pz, g);
    mesh(finialG, mats.mahogany, px, postH + 0.17, pz, g);
  }
  // ---- headboard: arched crest panel + three raised panels
  {
    const s = new THREE.Shape();
    const w = W - 0.08, y0 = 0.42, y1 = 1.55, crest = 0.32;
    s.moveTo(-w / 2, y0); s.lineTo(w / 2, y0); s.lineTo(w / 2, y1);
    s.bezierCurveTo(w * 0.32, y1 + 0.02, w * 0.22, y1 + crest * 0.4, w * 0.12, y1 + crest * 0.75);
    s.quadraticCurveTo(0.0, y1 + crest * 1.25, -w * 0.12, y1 + crest * 0.75);
    s.bezierCurveTo(-w * 0.22, y1 + crest * 0.4, -w * 0.32, y1 + 0.02, -w / 2, y1);
    s.lineTo(-w / 2, y0);
    const hg = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 24 });
    mesh(G.applyBoxUVs(hg, 1), mats.mahogany, 0, 0, -hl - 0.02, g);
    // crest moulding: bead following the arch
    const arch = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40; const x = -w / 2 + t * w;
      const ax = Math.abs(x) / (w / 2);
      const y = y1 + crest * Math.pow(Math.max(0, 1 - ax), 1.6) * 1.05 - 0.035;
      arch.push(V3(x, y, 0));
    }
    const bead = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arch), 80, 0.012, 8, false);
    mesh(bead, mats.mahogany, 0, 0, -hl + 0.035, g);
    const pw = (w - 0.2) / 3;
    for (let i = 0; i < 3; i++) {
      const p = mesh(G.raisedPanel(pw - 0.05, 0.78, { border: 0.05, bevel: 0.035, fieldDepth: 0.012 }), mats.panel, -w / 2 + 0.1 + pw * (i + 0.5), 0.98, -hl + 0.02, g);
      p.name = 'headpanel';
    }
    // carved cartouche at the crest
    const c = new THREE.Shape(); c.absellipse(0, 0, 0.13, 0.085, 0, Math.PI * 2);
    const ch = new THREE.Path(); ch.absellipse(0, 0, 0.1, 0.06, 0, Math.PI * 2); c.holes.push(ch);
    const cg = new THREE.ExtrudeGeometry(c, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 32 });
    mesh(cg, mats.gilt, 0, y1 + 0.16, -hl + 0.03, g);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), mats.mahogany); sh.scale.y = 0.6; sh.position.set(0, y1 + 0.16, -hl + 0.035); g.add(sh);
  }
  // ---- footboard
  {
    const fw = W - 0.08;
    mesh(rbox(G, fw, 0.5, 0.045, 0.012), mats.mahogany, 0, 0.62, hl, g);
    mesh(lathe(G, [[0, 0], [0.034, 0], [0.034, fw]], 20).rotateZ(Math.PI / 2).translate(fw / 2, 0, 0), mats.mahogany, 0, 0.9, hl, g);
    for (let i = 0; i < 2; i++) mesh(G.raisedPanel(fw / 2 - 0.1, 0.34, { border: 0.045, bevel: 0.03 }), mats.panel, (i - 0.5) * (fw / 2), 0.62, hl + 0.022, g);
  }
  // ---- side rails + slat frame
  for (const sx of [-1, 1]) mesh(rbox(G, 0.05, 0.2, L - 0.1, 0.01), mats.mahogany, sx * (hw - 0.01), 0.42, 0, g);
  // ---- mattress (deformed rounded box) and valance skirt
  {
    const mg = new G.RoundedBoxGeometry(W - 0.12, 0.28, L - 0.12, 4, 0.06);
    const p = mg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const sag = (1 - (x / (hw)) ** 2) * (1 - (z / hl) ** 2) * 0.03;
      p.setY(i, y - (y > 0 ? sag : 0));
    }
    mg.computeVertexNormals();
    mesh(G.applyBoxUVs(mg, 1), mats.linen, 0, mTop - 0.14, 0, g);
  }
  // ---- counterpane draped over the mattress with hanging sides
  {
    const cw = W - 0.08, drop = 0.42, cl = L - 0.32;
    const segS = 90, segZ = 50;
    const half = cw / 2 + drop;
    const geo = new THREE.PlaneGeometry(half * 2, cl, segS, segZ);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    const rnd = (k) => { const x = Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i < pos.count; i++) {
      const s = pos.getX(i), zz = -pos.getY(i);
      const as = Math.abs(s), sg = Math.sign(s) || 1;
      let x, y;
      const r = 0.06;   // corner roll radius
      if (as < cw / 2 - r) { x = s; y = 0; }
      else if (as < cw / 2 - r + (Math.PI / 2) * r) {
        const a = (as - (cw / 2 - r)) / r;
        x = sg * (cw / 2 - r + Math.sin(a) * r); y = -(1 - Math.cos(a)) * r;
      } else {
        const d = as - (cw / 2 - r + (Math.PI / 2) * r);
        const f = d / drop;
        const fold = Math.sin(zz * 9.0 + rnd(sg > 0 ? 1 : 2) * 6) * 0.5 + Math.sin(zz * 23.0 + rnd(3) * 6) * 0.25;
        x = sg * (cw / 2 + f * f * 0.05 + fold * f * 0.035); y = -r - d;
      }
      // rumples on top
      y += (Math.sin(s * 11 + zz * 3) * Math.sin(zz * 7 + 1.3) * 0.006) * (as < cw / 2 ? 1 : 0.4);
      pos.setXYZ(i, x, y, zz);
      uv.setXY(i, (s + half) * 1.0, (zz + cl / 2) * 1.0);
    }
    geo.computeVertexNormals();
    const cover = mesh(geo, mats.quilt, 0, mTop + 0.012, 0.16 - 0.0, g);
    cover.name = 'cloth';
    // turned-down sheet at the head
    const sheet = mesh(rbox(G, cw + 0.02, 0.03, 0.26, 0.012), mats.linen, 0, mTop + 0.02, -hl + 0.06 + 0.42, g);
    sheet.name = 'cloth';
  }
  // ---- pillows (squashed rounded boxes)
  {
    const pg = new G.RoundedBoxGeometry(0.66, 0.2, 0.42, 5, 0.09);
    const p = pg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = (1 - Math.min(1, (x / 0.33) ** 2)) * (1 - Math.min(1, (z / 0.21) ** 2));
      p.setY(i, y * (0.35 + 0.65 * Math.sqrt(Math.max(0, k))) + (y > 0 ? -0.012 * Math.sin(x * 20) * k : 0));
    }
    pg.computeVertexNormals();
    const pgu = G.applyBoxUVs(pg, 1);
    for (const [x, rz, ry] of [[-0.42, 0.06, 0.05], [0.42, -0.05, -0.08]]) {
      const pm = mesh(pgu, mats.linen, x, mTop + 0.075, -hl + 0.3, g);
      pm.rotation.set(-0.45, ry, rz); pm.name = 'cloth';
    }
  }
  // ---- tester (canopy frame) with cornice
  const ty = postH;
  {
    const rail = (len, x, z, ry) => { const m = mesh(rbox(G, len, 0.13, 0.05, 0.008), mats.canopyWood, x, ty + 0.05, z, g); m.rotation.y = ry; };
    rail(W + 0.06, 0, -hl, 0); rail(W + 0.06, 0, hl, 0); rail(L + 0.06, -hw, 0, Math.PI / 2); rail(L + 0.06, hw, 0, Math.PI / 2);
    // gilt anthemion frieze band round the tester
    const fz = [V3(hw + 0.035, ty - 0.01, -hl - 0.035), V3(-hw - 0.035, ty - 0.01, -hl - 0.035), V3(-hw - 0.035, ty - 0.01, hl + 0.035), V3(hw + 0.035, ty - 0.01, hl + 0.035)];
    mesh(G.sweepProfile([V2(0.003, 0), V2(0.003, 0.13)], fz, { closed: true, uvScale: 1 }), mats.frieze, 0, 0, 0, g);
    const cw2 = hw + 0.03, cl2 = hl + 0.03;
    const path = [V3(cw2, ty + 0.12, -cl2), V3(-cw2, ty + 0.12, -cl2), V3(-cw2, ty + 0.12, cl2), V3(cw2, ty + 0.12, cl2)];
    mesh(G.sweepProfile(G.PROFILES.crown(0.14, 0.09), path, { closed: true, uvScale: 1 }), mats.canopyWood, 0, 0, 0, g);
    // gilt bead on the cornice
    const path2 = path.map((v) => V3(v.x * 1.0, ty + 0.115, v.z));
    mesh(G.sweepProfile(G.PROFILES.chairRail(0.03, 0.018), path2, { closed: true, uvScale: 2 }), mats.gilt, 0, 0, 0, g);
  }
  // ---- hangings: torn valance all round, torn corner curtains, back cloth
  {
    const drape = mats.drapeA, drape2 = mats.drapeB;
    const val = (len, x, z, ry, sd) => {
      const vg = curtain(G, { width: len, height: 0.42, folds: Math.round(len * 7), depth: 0.04, gather: 1, seed: sd, segX: 90, segY: 16 });
      const m = mesh(vg, drape2, x, ty - 0.02, z, g); m.rotation.y = ry; m.name = 'cloth';
    };
    val(W + 0.12, 0, hl + 0.06, 0, 11); val(L + 0.12, -hw - 0.06, 0, -Math.PI / 2, 12); val(L + 0.12, hw + 0.06, 0, Math.PI / 2, 13);
    // back cloth behind the headboard
    const bc = mesh(curtain(G, { width: W, height: ty - 0.1, folds: 10, depth: 0.035, seed: 21, segX: 100, segY: 50 }), drape, 0, ty + 0.05, -hl - 0.05, g);
    bc.name = 'cloth';
    // corner curtains (hang along the long sides, foot ones tied back to the posts)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const foot = sz > 0;
      const cg = curtain(G, { width: foot ? 0.5 : 0.75, height: ty - 0.02, folds: foot ? 7 : 6, depth: 0.07, tieback: foot ? 1.0 : 0, seed: 30 + sx * 3 + sz, segX: 70, segY: 60 });
      const m = mesh(cg, sz > 0 ? drape : drape2, sx * (hw + 0.045), ty + 0.04, sz * (hl - (foot ? 0.3 : 0.36)), g);
      // plane faces +z by default; rotate so it faces outward (±x); mirror so the tie-back gathers toward the post
      m.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      if ((sx > 0) !== (sz > 0)) m.scale.x = -1;
      m.name = 'cloth';
    }
  }
  g.userData = { mattressTop: mTop, L, W, postH };
  return g;
}

// ============================================================================ chest
/** Blanket chest with the knights board in its lid. Local: long axis X, front +Z, floor y=0. userData.boardTop */
export function buildChest(ctx, mats, { w = 1.18, d = 0.58, h = 0.52 } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group(); g.name = 'chest';
  mesh(rbox(G, w + 0.04, 0.07, d + 0.04, 0.01), mats.walnut, 0, 0.035, 0, g);
  // bun feet
  const foot = lathe(G, [[0, 0], [0.035, 0.0], [0.045, 0.02], [0.04, 0.04], [0.03, 0.05], [0, 0.05]], 16);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(foot, mats.walnut, sx * (w / 2 - 0.04), -0.0, sz * (d / 2 - 0.04), g).scale.set(1, 0.6, 1);
  const bodyH = h - 0.07 - 0.075;
  mesh(rbox(G, w, bodyH, d, 0.012), mats.walnut, 0, 0.07 + bodyH / 2, 0, g);
  // carved front/back panels
  for (const sz of [-1, 1]) for (let i = 0; i < 3; i++) {
    const p = mesh(G.raisedPanel(w / 3 - 0.08, bodyH - 0.08, { border: 0.035, bevel: 0.03, fieldDepth: 0.01 }), mats.walnut, (i - 1) * (w / 3), 0.07 + bodyH / 2, sz * (d / 2 + 0.002), g);
    if (sz < 0) p.rotation.y = Math.PI;
  }
  for (const sx of [-1, 1]) {
    const p = mesh(G.raisedPanel(d - 0.1, bodyH - 0.08, { border: 0.035, bevel: 0.03 }), mats.walnut, sx * (w / 2 + 0.002), 0.07 + bodyH / 2, 0, g);
    p.rotation.y = sx * Math.PI / 2;
    // iron drop handles
    const hdl = mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 20, Math.PI), mats.iron, sx * (w / 2 + 0.03), 0.07 + bodyH * 0.62, 0, g);
    hdl.rotation.set(0, sx * Math.PI / 2, Math.PI);
    mesh(rbox(G, 0.012, 0.05, 0.12, 0.003), mats.iron, sx * (w / 2 + 0.014), 0.07 + bodyH * 0.66, 0, g);
  }
  // moulded lid
  const lidY = 0.07 + bodyH;
  mesh(rbox(G, w + 0.05, 0.075, d + 0.05, 0.018, 3), mats.walnut, 0, lidY + 0.0375, 0, g);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.03, d + 0.03).rotateX(-Math.PI / 2), mats.board);
  top.position.y = lidY + 0.0752; top.name = 'boardTop'; g.add(top);
  // iron strap corners and hasp
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c = mesh(rbox(G, 0.09, bodyH + 0.07, 0.01, 0.003), mats.iron, sx * (w / 2 - 0.045), 0.07 + bodyH / 2 + 0.03, sz * (d / 2 + 0.006), g);
    for (let k = 0; k < 3; k++) mesh(new THREE.SphereGeometry(0.006, 8, 6), mats.iron, sx * (w / 2 - 0.045), 0.12 + k * bodyH * 0.38, sz * (d / 2 + 0.012), g);
    void c;
  }
  mesh(rbox(G, 0.09, 0.12, 0.012, 0.004), mats.iron, 0, lidY - 0.02, d / 2 + 0.008, g);
  mesh(rbox(G, 0.04, 0.06, 0.02, 0.004), mats.brass, 0, lidY - 0.05, d / 2 + 0.018, g);
  const kh = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12), mats.black); kh.position.set(0, lidY - 0.045, d / 2 + 0.029); g.add(kh);
  g.userData = { boardTop: lidY + 0.0755, w, d };
  return g;
}

// ============================================================================ fireplace
/**
 * Chimney breast + black-marble fireplace. Local: wall plane at z = 0, facing +Z,
 * centred on x = 0, floor y = 0. Breast projects `depth`. userData: { flames, coalMat, mantelY, front }.
 */
export function buildFireplace(ctx, mats, { H = 3.6, breastW = 2.1, depth = 0.42, seed = 5 } = {}) {
  const G = ctx.geometry; const fx = ctx.fx;
  const g = new THREE.Group(); g.name = 'fireplace';
  const ow = 0.86, oh = 0.86, oy = 0.06;
  // breast front (with opening) and returns, papered like the walls
  const front = new THREE.Mesh(G.wallWithOpenings(breastW, H, [{ x: (breastW - ow) / 2, y: oy, w: ow, h: oh }], { uvScale: 1 }), mats.wall);
  front.position.set(-breastW / 2, 0, depth); g.add(front);
  for (const sx of [-1, 1]) {
    const side = mesh(G.planeUV(depth, H, 1), mats.wall, sx * breastW / 2, H / 2, depth / 2, g);
    side.rotation.y = sx * Math.PI / 2;
  }
  // firebox: brick back + splayed cheeks + sooty throat
  const fbD = depth - 0.06;
  const back = mesh(G.planeUV(ow, oh, 1), mats.brick, 0, oy + oh / 2, depth - fbD, g);
  for (const sx of [-1, 1]) {
    const len = Math.hypot(fbD, 0.1);
    const ch = mesh(G.planeUV(len, oh, 1), mats.brick, sx * (ow / 2 - 0.05), oy + oh / 2, depth - fbD / 2, g);
    ch.rotation.y = -sx * (Math.PI / 2 - Math.atan2(0.1, fbD));
  }
  const throat = mesh(G.planeUV(ow, fbD, 1), mats.soot, 0, oy + oh, depth - fbD / 2, g); throat.rotation.x = Math.PI / 2;
  const floorB = mesh(G.planeUV(ow, fbD, 1), mats.soot, 0, oy + 0.001, depth - fbD / 2, g); floorB.rotation.x = -Math.PI / 2;
  void back;
  // cast-iron arched insert around the opening
  {
    const s = new THREE.Shape();
    s.moveTo(-ow / 2 - 0.07, 0); s.lineTo(ow / 2 + 0.07, 0); s.lineTo(ow / 2 + 0.07, oh + 0.09); s.lineTo(-ow / 2 - 0.07, oh + 0.09); s.lineTo(-ow / 2 - 0.07, 0);
    const hole = new THREE.Path();
    const r = 0.18;
    hole.moveTo(-ow / 2 + 0.03, 0); hole.lineTo(-ow / 2 + 0.03, oh - r); hole.quadraticCurveTo(-ow / 2 + 0.03, oh - 0.02, -ow / 2 + 0.03 + r, oh - 0.02);
    hole.lineTo(ow / 2 - 0.03 - r, oh - 0.02); hole.quadraticCurveTo(ow / 2 - 0.03, oh - 0.02, ow / 2 - 0.03, oh - r); hole.lineTo(ow / 2 - 0.03, 0); hole.lineTo(-ow / 2 + 0.03, 0);
    s.holes.push(hole);
    const ig = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 2, curveSegments: 16 });
    mesh(G.applyBoxUVs(ig, 2), mats.castIron, 0, oy, depth, g);
  }
  // marble surround: pilasters, frieze, shelf
  const z0 = depth + 0.02;
  for (const sx of [-1, 1]) {
    const x = sx * (ow / 2 + 0.22);
    mesh(rbox(G, 0.24, 0.1, 0.2, 0.01), mats.marble, x, 0.05 + 0.05, z0 + 0.08, g);
    mesh(rbox(G, 0.2, oh + 0.1, 0.16, 0.012), mats.marble, x, 0.1 + (oh + 0.1) / 2, z0 + 0.07, g);
    // fluting
    for (let k = -1; k <= 1; k++) { const f = mesh(new THREE.CylinderGeometry(0.012, 0.012, oh - 0.06, 10), mats.marbleDark, x + k * 0.05, 0.1 + (oh + 0.1) / 2, z0 + 0.148, g); f.scale.z = 0.4; }
    // console bracket capital
    const cap = new THREE.Shape([V2(0, 0), V2(0.16, 0), V2(0.2, 0.06), V2(0.2, 0.16), V2(0.0, 0.16)].map((v) => v));
    const cg = new THREE.ExtrudeGeometry(cap, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
    cg.translate(0, 0, -0.1); cg.rotateY(-Math.PI / 2);
    mesh(G.applyBoxUVs(cg, 1), mats.marble, x, oy + oh + 0.05, z0, g);
  }
  mesh(rbox(G, ow + 0.24, 0.22, 0.14, 0.01), mats.marble, 0, oy + oh + 0.13, z0 + 0.06, g);
  // carved central tablet
  mesh(rbox(G, 0.32, 0.13, 0.03, 0.008), mats.marbleDark, 0, oy + oh + 0.13, z0 + 0.14, g);
  const shelfY = oy + oh + 0.26;
  {
    const prof = [[0, 0], [0.3, 0], [0.33, 0.012], [0.34, 0.03], [0.33, 0.05], [0.3, 0.06], [0, 0.06]];
    const sg = extrudeProfileX(G, prof, ow + 0.78);
    mesh(sg, mats.marble, 0, shelfY, depth - 0.02, g);
    const prof2 = [[0, 0], [0.24, 0], [0.24, 0.02], [0.2, 0.045], [0.0, 0.045]];
    mesh(extrudeProfileX(G, prof2, ow + 0.6), mats.marbleDark, 0, shelfY - 0.045, depth, g);
  }
  // hearth slab + brass fender
  mesh(rbox(G, ow + 0.9, 0.04, 0.5, 0.01), mats.marble, 0, 0.02, depth + 0.25, g);
  {
    const p = [V3(-ow / 2 - 0.36, 0.06, depth + 0.02), V3(-ow / 2 - 0.36, 0.06, depth + 0.42), V3(ow / 2 + 0.36, 0.06, depth + 0.42), V3(ow / 2 + 0.36, 0.06, depth + 0.02)];
    const prof = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI; prof.push(V2(0.012 + Math.cos(a) * 0.012, 0.03 + Math.sin(a) * 0.03)); }
    prof.unshift(V2(0, 0)); prof.push(V2(0, 0.06));
    mesh(G.sweepProfile(prof, p, { uvScale: 2 }), mats.brass, 0, -0.02, 0, g);
  }
  // grate, coals, logs, flames
  const fz = depth - fbD * 0.45;
  {
    for (let i = -4; i <= 4; i++) mesh(new THREE.BoxGeometry(0.012, 0.012, 0.22), mats.castIron, i * 0.06, 0.16, fz, g);
    for (const k of [0, 1, 2]) mesh(new THREE.BoxGeometry(0.56, 0.012, 0.012), mats.castIron, 0, 0.16 + k * 0.06, fz + 0.11, g);
    for (const sx of [-1, 1]) mesh(rbox(G, 0.03, 0.3, 0.03, 0.006), mats.castIron, sx * 0.3, 0.15, fz + 0.11, g);
    for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.025, 12, 8), mats.brass, sx * 0.3, 0.32, fz + 0.11, g);
  }
  const coalG = new THREE.SphereGeometry(0.3, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  coalG.scale(0.95, 0.18, 0.4);
  const coalM = mesh(coalG, mats.coals, 0, 0.165, fz, g); coalM.name = 'coals';
  // logs: bark cylinders with glowing ends
  const logG = new THREE.CylinderGeometry(0.05, 0.055, 0.52, 12, 1);
  for (const [x, y, z, rz, ry] of [[0, 0.24, fz + 0.02, Math.PI / 2, 0.15], [-0.05, 0.3, fz - 0.03, Math.PI / 2 - 0.25, -0.35], [0.08, 0.29, fz + 0.05, Math.PI / 2 + 0.3, 0.55]]) {
    const l = mesh(logG, mats.log, x, y, z, g); l.rotation.set(0, ry, rz);
  }
  const flames = [];
  const rnd = (k) => { const x = Math.sin(k * 45.1 + seed * 9.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < 7; i++) {
    const f = fx.flame({ height: 0.12 + rnd(i) * 0.18, width: 0.06 + rnd(i + 9) * 0.04, intensity: 1.6 + rnd(i + 3) * 1.6, seed: 10 + i * 3.3 });
    f.position.set(-0.22 + (i / 6) * 0.44 + (rnd(i + 5) - 0.5) * 0.05, 0.26 + rnd(i + 7) * 0.04, fz - 0.02 + (rnd(i + 2) - 0.5) * 0.12);
    g.add(f); flames.push(f);
  }
  g.userData = { flames, coalMat: mats.coals, mantelY: shelfY + 0.06, front: depth + 0.36, fireZ: fz };
  return g;
}

// ============================================================================ vanity
/** Dressing table with a cracked swing mirror. Local: back to wall at z = 0, faces +Z. userData: { candles, mirror } */
export function buildVanity(ctx, mats, { w = 1.15, d = 0.5 } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group(); g.name = 'vanity';
  const th = 0.76;
  mesh(rbox(G, w, 0.035, d, 0.012), mats.walnut, 0, th, d / 2, g);
  mesh(rbox(G, w - 0.06, 0.13, d - 0.06, 0.006), mats.walnut, 0, th - 0.08, d / 2, g);
  // drawers: centre kneehole + pedestals
  for (const x of [-(w / 2 - 0.2), w / 2 - 0.2]) {
    mesh(rbox(G, 0.36, 0.5, d - 0.06, 0.008), mats.walnut, x, th - 0.4, d / 2, g);
    for (let k = 0; k < 3; k++) {
      mesh(G.raisedPanel(0.32, 0.13, { border: 0.02, bevel: 0.015, fieldDepth: 0.006 }), mats.walnut, x, th - 0.22 - k * 0.155, d - 0.028, g);
      mesh(new THREE.SphereGeometry(0.012, 10, 8), mats.brass, x, th - 0.22 - k * 0.155, d - 0.005, g);
    }
  }
  mesh(G.raisedPanel(w - 0.8, 0.11, { border: 0.02, bevel: 0.015 }), mats.walnut, 0, th - 0.08, d - 0.028, g);
  const legG = lathe(G, [[0.024, 0], [0.02, 0.04], [0.03, 0.08], [0.0, 0.08]], 12);
  for (const sx of [-1, 1]) for (const sz of [0.05, d - 0.05]) mesh(legG, mats.walnut, sx * (w / 2 - 0.05), 0.0, sz, g);
  // mirror on its stand
  const mw = 0.64, mh = 0.86, my = th + 0.12 + mh / 2;
  for (const sx of [-1, 1]) {
    mesh(rbox(G, 0.045, mh + 0.25, 0.045, 0.01), mats.walnut, sx * (mw / 2 + 0.1), th + 0.02 + (mh + 0.25) / 2, 0.12, g);
    mesh(lathe(G, [[0, 0], [0.03, 0], [0.03, 0.02], [0.012, 0.05], [0.02, 0.07], [0, 0.1]], 12), mats.walnut, sx * (mw / 2 + 0.1), th + mh + 0.27, 0.12, g);
  }
  const mg = new THREE.Group(); mg.position.set(0, my, 0.12); mg.rotation.x = -0.06; g.add(mg);
  mesh(G.frameGeometry(mw, mh, { width: 0.07, depth: 0.04, uvScale: 1 }), mats.giltFrame, 0, 0, 0, mg);
  const mirror = mesh(new THREE.PlaneGeometry(mw + 0.01, mh + 0.01), mats.mirror, 0, 0, 0.006, mg);
  mirror.name = 'mirror';
  mesh(rbox(G, mw + 0.1, mh + 0.1, 0.02, 0.005), mats.walnut, 0, 0, -0.012, mg);
  // crest
  const crest = new THREE.Shape();
  crest.moveTo(-0.22, 0); crest.quadraticCurveTo(-0.08, 0.02, -0.04, 0.09); crest.quadraticCurveTo(0, 0.15, 0.04, 0.09); crest.quadraticCurveTo(0.08, 0.02, 0.22, 0); crest.lineTo(-0.22, 0);
  mesh(new THREE.ExtrudeGeometry(crest, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2 }), mats.giltFrame, 0, mh / 2 + 0.07, -0.005, mg);
  // candlesticks with candles
  const candles = [];
  const stickG = lathe(G, [[0, 0], [0.055, 0], [0.05, 0.012], [0.02, 0.03], [0.014, 0.06], [0.022, 0.08], [0.012, 0.1], [0.011, 0.16], [0.026, 0.175], [0.03, 0.185], [0.014, 0.19], [0, 0.19]], 22);
  for (const [x, z, s] of [[-0.43, 0.28, 0], [0.45, 0.24, 1]]) {
    mesh(stickG, mats.brass, x, th + 0.017, z, g);
    const c = ctx.fx.candle({ height: s ? 0.12 : 0.17, radius: 0.0115, light: false, seed: 60 + s * 7, burn: 0.8 });
    c.position.set(x, th + 0.017 + 0.19, z); g.add(c); candles.push(c);
  }
  // perfume bottles, powder jar, brush, scattered pearls
  const bottle = lathe(G, [[0, 0], [0.03, 0], [0.034, 0.02], [0.034, 0.06], [0.02, 0.085], [0.008, 0.095], [0.008, 0.11], [0.014, 0.115], [0, 0.118]], 20);
  mesh(bottle, mats.crystalAmber, -0.25, th + 0.017, 0.2, g);
  mesh(bottle, mats.crystal, -0.17, th + 0.017, 0.27, g).scale.set(0.8, 1.2, 0.8);
  const stopper = new THREE.SphereGeometry(0.016, 12, 8);
  mesh(stopper, mats.crystal, -0.25, th + 0.017 + 0.13, 0.2, g);
  const jar = lathe(G, [[0, 0], [0.05, 0], [0.055, 0.03], [0.05, 0.05], [0.052, 0.055], [0.03, 0.07], [0.012, 0.075], [0.014, 0.085], [0, 0.088]], 24);
  mesh(jar, mats.porcelain, 0.22, th + 0.017, 0.24, g);
  const brush = new THREE.Group();
  mesh(rbox(G, 0.07, 0.022, 0.13, 0.01), mats.silver, 0, 0.011, 0, brush);
  mesh(rbox(G, 0.025, 0.012, 0.12, 0.005), mats.silver, 0, 0.008, 0.12, brush);
  brush.position.set(0.05, th + 0.017, 0.33); brush.rotation.y = 0.5; g.add(brush);
  const pearl = new THREE.SphereGeometry(0.006, 10, 8);
  for (let i = 0; i < 22; i++) { const a = i * 0.29; mesh(pearl, mats.pearl, -0.05 + Math.cos(a) * 0.06 + i * 0.004, th + 0.023, 0.36 + Math.sin(a * 1.3) * 0.03, g); }
  g.userData = { candles, mirror, top: th };
  return g;
}

/** Stool for the vanity (velvet cushion). Local origin floor centre. */
export function buildStool(ctx, mats) {
  const G = ctx.geometry; const g = new THREE.Group();
  mesh(rbox(G, 0.46, 0.1, 0.36, 0.04, 3), mats.velvetRose, 0, 0.47, 0, g);
  const leg = lathe(G, [[0.018, 0], [0.014, 0.08], [0.022, 0.18], [0.016, 0.3], [0.024, 0.4], [0.02, 0.42], [0, 0.42]], 12);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(leg, mats.walnut, sx * 0.19, 0, sz * 0.14, g);
  for (const sz of [-1, 1]) mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.38, 8).rotateZ(Math.PI / 2), mats.walnut, 0, 0.14, sz * 0.14, g);
  return g;
}

// ============================================================================ nightstand + lamp
export function buildNightstand(ctx, mats) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'nightstand';
  mesh(rbox(G, 0.5, 0.03, 0.44, 0.01), mats.mahogany, 0, 0.7, 0, g);
  mesh(rbox(G, 0.44, 0.48, 0.38, 0.008), mats.mahogany, 0, 0.44, 0, g);
  mesh(G.raisedPanel(0.38, 0.12, { border: 0.02, bevel: 0.014 }), mats.panel, 0, 0.6, 0.192, g);
  mesh(G.raisedPanel(0.38, 0.28, { border: 0.025, bevel: 0.018 }), mats.panel, 0, 0.36, 0.192, g);
  mesh(new THREE.SphereGeometry(0.012, 10, 8), mats.brass, 0, 0.6, 0.212, g);
  const leg = lathe(G, [[0.02, 0], [0.016, 0.05], [0.024, 0.12], [0.022, 0.2], [0, 0.2]], 12);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(leg, mats.mahogany, sx * 0.2, 0, sz * 0.17, g);
  return g;
}

/** Brass oil lamp with frosted globe. Origin at its base. userData.globe (emissive mesh), lightPos */
export function buildOilLamp(ctx, mats) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'oillamp';
  mesh(lathe(G, [[0, 0], [0.07, 0], [0.07, 0.012], [0.05, 0.03], [0.022, 0.06], [0.018, 0.12], [0.03, 0.14], [0.0, 0.145]], 28), mats.brass, 0, 0, 0, g);
  mesh(lathe(G, [[0, 0.14], [0.05, 0.15], [0.068, 0.19], [0.062, 0.23], [0.03, 0.25], [0.0, 0.25]], 28), mats.crystalAmber, 0, 0, 0, g);
  mesh(lathe(G, [[0.028, 0.25], [0.034, 0.27], [0.034, 0.28], [0.0, 0.28]], 20), mats.brass, 0, 0, 0, g);
  const globe = mesh(lathe(G, [[0.03, 0.28], [0.07, 0.3], [0.1, 0.36], [0.1, 0.42], [0.075, 0.47], [0.04, 0.49]], 32), mats.lampGlobe, 0, 0, 0, g);
  globe.userData.noShadow = true;
  mesh(lathe(G, [[0.022, 0.46], [0.024, 0.6], [0.02, 0.62]], 16), mats.crystal, 0, 0, 0, g).userData.noShadow = true;
  const fl = ctx.fx.flame({ height: 0.04, width: 0.016, intensity: 8, seed: 77 });
  fl.position.y = 0.3; g.add(fl);
  g.userData = { globe, lightPos: V3(0, 0.38, 0) };
  return g;
}

// ============================================================================ dolls
/**
 * Seated bisque doll. Local: sitting on y = 0, facing +Z. size ≈ height of the seated doll.
 */
export function buildDoll(ctx, mats, { size = 0.3, seed = 0, dress = 0xb08080, hair = 0x3a2010, cracked = false, eyes = '#3a5a8a', bonnet = false, tilt = 0 } = {}) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'doll';
  const s = size / 0.3;
  const dressM = mats.dollCloth(dress);
  const hairM = mats.dollHair(hair);
  const face = mats.dollFace({ seed, cracked, eyes, hair: `#${new THREE.Color(hair).getHexString()}` });
  // skirt (flattened bell) and bodice
  const skirt = lathe(G, [[0, 0], [0.11, 0.0], [0.12, 0.02], [0.1, 0.06], [0.07, 0.1], [0.045, 0.13], [0.0, 0.13]].map(([r, y]) => [r * s, y * s]), 24);
  const sk = mesh(skirt, dressM, 0, 0, 0, g); sk.scale.set(1, 1, 1.15);
  mesh(lathe(G, [[0.0, 0.12], [0.045, 0.12], [0.05, 0.15], [0.042, 0.19], [0.03, 0.205], [0.0, 0.21]].map(([r, y]) => [r * s, y * s]), 20), dressM, 0, 0, 0, g);
  // lace collar
  const col = mesh(new THREE.TorusGeometry(0.032 * s, 0.009 * s, 8, 24), mats.lace, 0, 0.205 * s, 0, g); col.rotation.x = Math.PI / 2;
  // legs sticking forward, white stockings + black shoes
  for (const sx of [-1, 1]) {
    const leg = mesh(new THREE.CapsuleGeometry(0.014 * s, 0.09 * s, 4, 10), mats.stocking, sx * 0.035 * s, 0.022 * s, 0.1 * s, g); leg.rotation.x = Math.PI / 2 - 0.15;
    const shoe = mesh(new THREE.SphereGeometry(0.019 * s, 12, 8), mats.black, sx * 0.035 * s, 0.03 * s, 0.165 * s, g); shoe.scale.set(0.9, 0.8, 1.4);
  }
  // arms
  for (const sx of [-1, 1]) {
    const arm = mesh(new THREE.CapsuleGeometry(0.012 * s, 0.075 * s, 4, 10), dressM, sx * 0.055 * s, 0.16 * s, 0.015 * s, g); arm.rotation.set(0.5, 0, sx * 0.25);
    mesh(new THREE.SphereGeometry(0.012 * s, 10, 8), face.skin, sx * 0.068 * s, 0.12 * s, 0.045 * s, g);
  }
  // head with painted face
  const head = new THREE.Group(); head.position.set(0, 0.258 * s, 0); head.rotation.set(0.05, 0, tilt); g.add(head);
  const hm = mesh(new THREE.SphereGeometry(0.05 * s, 32, 20), face.mat, 0, 0, 0, head); hm.scale.set(0.95, 1.02, 0.95);
  mesh(new THREE.CylinderGeometry(0.016 * s, 0.02 * s, 0.03 * s, 12), face.skin, 0, -0.045 * s, 0, head);
  // hair: cap + ringlets
  const cap = mesh(new THREE.SphereGeometry(0.053 * s, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 0.004 * s, -0.006 * s, head); cap.rotation.x = -0.35;
  const ring = new THREE.CapsuleGeometry(0.009 * s, 0.035 * s, 3, 8);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.55 + (i / 8) * Math.PI * 0.9;
    const r = mesh(ring, hairM, Math.cos(a) * 0.048 * s, -0.035 * s, Math.sin(-a) * 0.03 * s - 0.01 * s, head);
    r.rotation.z = Math.cos(a) * 0.2;
    void r;
  }
  if (bonnet) {
    const b = mesh(new THREE.SphereGeometry(0.062 * s, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), dressM, 0, 0.004 * s, -0.012 * s, head); b.rotation.x = -0.7; b.material = dressM;
    const brim = mesh(new THREE.TorusGeometry(0.058 * s, 0.008 * s, 6, 28), mats.lace, 0, 0.02 * s, 0.01 * s, head); brim.rotation.x = -0.7 + Math.PI / 2;
  }
  return g;
}

/** Wall shelf with scrolled brackets. Local: back at z = 0, shelf tops at given heights. */
export function buildDollShelf(ctx, mats, { w = 1.0, levels = [1.2, 1.58, 1.96], depth = 0.22 } = {}) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'dollshelf';
  const br = new THREE.Shape();
  br.moveTo(0, 0); br.lineTo(0.17, 0); br.quadraticCurveTo(0.16, -0.05, 0.1, -0.06); br.quadraticCurveTo(0.03, -0.07, 0.03, -0.13); br.quadraticCurveTo(0.02, -0.16, 0, -0.17); br.lineTo(0, 0);
  const bg = new THREE.ExtrudeGeometry(br, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 10 });
  bg.translate(0, 0, -0.01); bg.rotateY(-Math.PI / 2);
  const bgu = G.applyBoxUVs(bg, 1);
  for (const y of levels) {
    mesh(rbox(G, w, 0.028, depth, 0.008), mats.walnut, 0, y - 0.014, depth / 2, g);
    mesh(rbox(G, w, 0.02, 0.012, 0.004), mats.walnut, 0, y + 0.012, depth - 0.006, g);
    for (const sx of [-1, 1]) mesh(bgu, mats.walnut, sx * (w / 2 - 0.08), y - 0.028, 0.0, g);
  }
  return g;
}

/** Child's rocking chair. Local: floor y=0, faces +Z. */
export function buildRockingChair(ctx, mats) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'rocker';
  const arc = []; for (let i = 0; i <= 24; i++) { const t = i / 24 - 0.5; arc.push(V3(0, 0.75 - Math.cos(t * 1.2) * 0.75 + 0.02, t * 0.9)); }
  const prof = [V2(0, -0.012), V2(0.03, -0.012), V2(0.03, 0.012), V2(0, 0.012), V2(0, -0.012)];
  for (const sx of [-1, 1]) { const r = mesh(G.sweepProfile(prof, arc, { up: V3(1, 0, 0) }), mats.walnut, sx * 0.21, 0, 0, g); r.name = 'rocker'; }
  // reorient: sweep up=X produced profile in the YZ plane; fine for a thin runner
  mesh(rbox(G, 0.48, 0.035, 0.42, 0.012), mats.walnut, 0, 0.36, 0.02, g);
  mesh(rbox(G, 0.44, 0.04, 0.38, 0.02, 3), mats.velvetRose, 0, 0.395, 0.02, g);
  for (const sx of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 10), mats.walnut, sx * 0.21, 0.19, 0.17, g);
    const bp = mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.62, 10), mats.walnut, sx * 0.21, 0.38 + 0.28, -0.2, g); bp.rotation.x = -0.12;
    mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.36, 10), mats.walnut, sx * 0.21, 0.19, -0.16, g);
    const arm = mesh(rbox(G, 0.05, 0.025, 0.42, 0.01), mats.walnut, sx * 0.23, 0.6, 0.0, g); arm.rotation.x = 0.06;
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), mats.walnut, sx * 0.23, 0.49, 0.17, g);
  }
  for (let i = -3; i <= 3; i++) { const sp = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.48, 8), mats.walnut, i * 0.055, 0.66, -0.21, g); sp.rotation.x = -0.12; }
  const crest = mesh(rbox(G, 0.5, 0.09, 0.03, 0.012), mats.walnut, 0, 0.94, -0.245, g); crest.rotation.x = -0.12;
  return g;
}

// ============================================================================ wardrobe
/** Wardrobe. Local: back at z=0, faces +Z. userData.doors = [leftPivot, rightPivot] (groups hinged at the outer edges). */
export function buildWardrobe(ctx, mats, { w = 1.42, h = 2.32, d = 0.62 } = {}) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'wardrobe';
  mesh(rbox(G, w + 0.04, 0.14, d + 0.03, 0.01), mats.mahogany, 0, 0.07, d / 2, g);
  mesh(rbox(G, w, h - 0.14 - 0.12, d - 0.02, 0.01), mats.mahogany, 0, 0.14 + (h - 0.26) / 2, d / 2 - 0.01, g);
  // dark interior (seen when the doors swing)
  const inner = mesh(G.planeUV(w - 0.06, h - 0.32, 1), mats.soot, 0, 0.14 + (h - 0.26) / 2, d - 0.03, g); inner.visible = false; inner.name = 'wardrobeInner';
  // cornice
  const cw = w / 2 + 0.03;
  const path = [V3(cw, h - 0.12, 0), V3(cw, h - 0.12, d + 0.02), V3(-cw, h - 0.12, d + 0.02), V3(-cw, h - 0.12, 0)];
  void path;
  mesh(rbox(G, w + 0.12, 0.05, d + 0.08, 0.012), mats.mahogany, 0, h - 0.025, d / 2 + 0.01, g);
  mesh(G.sweepProfile(G.PROFILES.crown(0.1, 0.06), [V3(-cw, h - 0.12, 0), V3(-cw, h - 0.12, d), V3(cw, h - 0.12, d), V3(cw, h - 0.12, 0)], { uvScale: 1 }), mats.mahogany, 0, 0, 0, g);
  // broken pediment
  const ped = new THREE.Shape();
  ped.moveTo(-w / 2, 0); ped.lineTo(-0.12, 0.18); ped.lineTo(-0.12, 0.12); ped.lineTo(-w / 2 + 0.12, 0); ped.lineTo(-w / 2, 0);
  const pg = new THREE.ExtrudeGeometry(ped, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
  mesh(G.applyBoxUVs(pg, 1), mats.mahogany, 0, h, d - 0.02, g);
  mesh(G.applyBoxUVs(pg.clone(), 1), mats.mahogany, 0, h, d + 0.03, g).scale.set(-1, 1, -1);
  mesh(lathe(G, [[0, 0], [0.04, 0], [0.05, 0.05], [0.03, 0.1], [0.012, 0.14], [0, 0.16]], 16), mats.gilt, 0, h, d + 0.0, g);
  const doors = [];
  const dw = (w - 0.08) / 2, dh = h - 0.42;
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * (w / 2 - 0.03), 0.2, d + 0.0);
    pivot.userData.keep = true;
    const leaf = new THREE.Group(); leaf.position.x = -sx * dw / 2; pivot.add(leaf);
    mesh(rbox(G, dw - 0.005, dh, 0.03, 0.006), mats.mahogany, 0, dh / 2, 0, leaf);
    mesh(G.raisedPanel(dw - 0.12, dh * 0.62, { border: 0.05, bevel: 0.04 }), mats.panel, 0, dh * 0.62, 0.015, leaf);
    mesh(G.raisedPanel(dw - 0.12, dh * 0.25, { border: 0.04, bevel: 0.03 }), mats.panel, 0, dh * 0.16, 0.015, leaf);
    mesh(lathe(G, [[0, 0], [0.012, 0], [0.016, 0.02], [0.008, 0.035], [0, 0.04]], 12).rotateX(Math.PI / 2), mats.brass, -sx * (dw / 2 - 0.05), dh * 0.48, 0.015, leaf);
    g.add(pivot); doors.push(pivot);
  }
  g.userData = { doors, inner };
  return g;
}

// ============================================================================ armchair
/** Buttoned wing armchair. Local: floor y=0, faces +Z. */
export function buildWingChair(ctx, mats) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'wingchair';
  const v = mats.velvetChair;
  mesh(rbox(G, 0.74, 0.16, 0.7, 0.05, 3), v, 0, 0.42, 0.02, g);
  mesh(rbox(G, 0.6, 0.1, 0.58, 0.05, 3), v, 0, 0.53, 0.06, g);
  const back = mesh(rbox(G, 0.72, 0.78, 0.16, 0.06, 3), v, 0, 0.88, -0.28, g); back.rotation.x = -0.12;
  for (const sx of [-1, 1]) {
    const wing = mesh(rbox(G, 0.1, 0.5, 0.36, 0.05, 3), v, sx * 0.36, 1.0, -0.15, g); wing.rotation.y = sx * 0.25;
    mesh(rbox(G, 0.12, 0.22, 0.66, 0.05, 3), v, sx * 0.33, 0.6, 0.03, g);
    const scroll = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 20).rotateZ(Math.PI / 2), v, sx * 0.33, 0.69, 0.33, g); void scroll;
  }
  const leg = lathe(G, [[0.025, 0], [0.02, 0.06], [0.03, 0.14], [0.026, 0.34], [0, 0.34]], 12);
  for (const sx of [-1, 1]) for (const sz of [-0.28, 0.3]) mesh(leg, mats.walnut, sx * 0.3, 0, sz, g);
  // buttons on the back
  const bt = new THREE.SphereGeometry(0.01, 8, 6);
  for (let r = 0; r < 3; r++) for (let c = -2; c <= 2; c++) if ((r + c) % 2 === 0) mesh(bt, mats.buttons, c * 0.12, 0.7 + r * 0.18, -0.19 + r * 0.02, g);
  return g;
}

// ============================================================================ misc
export function buildMantelClock(ctx, mats) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'clock';
  mesh(rbox(G, 0.34, 0.04, 0.14, 0.01), mats.marbleDark, 0, 0.02, 0, g);
  mesh(rbox(G, 0.26, 0.24, 0.12, 0.02), mats.ebonyWood, 0, 0.16, 0, g);
  const dome = new THREE.CylinderGeometry(0.13, 0.13, 0.12, 24, 1, false, 0, Math.PI); dome.rotateZ(Math.PI / 2); dome.rotateY(Math.PI / 2);
  mesh(dome, mats.ebonyWood, 0, 0.28, 0, g).scale.set(1, 0.6, 1);
  mesh(new THREE.TorusGeometry(0.075, 0.01, 8, 32), mats.brass, 0, 0.18, 0.062, g);
  mesh(new THREE.CircleGeometry(0.072, 32), mats.clockFace, 0, 0.18, 0.064, g);
  for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.018, 10, 8), mats.brass, sx * 0.14, 0.05, 0.05, g);
  return g;
}

export function buildCandlestick(ctx, mats, { h = 0.26 } = {}) {
  const G = ctx.geometry;
  return mesh(lathe(G, [[0, 0], [0.06, 0], [0.055, 0.015], [0.025, 0.04], [0.016, 0.08], [0.026, 0.1], [0.014, 0.14], [0.012, h - 0.03], [0.028, h - 0.015], [0.032, h - 0.005], [0.016, h], [0, h]], 22), mats.brass);
}

export function buildBook(G, mats, { w = 0.14, h = 0.21, t = 0.035, color = 0x5a1a14 }) {
  const g = new THREE.Group();
  mesh(rbox(G, w, t, h, 0.004), mats.bookCover(color), 0, t / 2, 0, g);
  mesh(new THREE.BoxGeometry(w - 0.01, t - 0.008, h - 0.008), mats.paper, 0.003, t / 2, 0, g);
  return g;
}
