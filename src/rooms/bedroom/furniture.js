import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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

/**
 * Heavy velvet curtain hanging from a heading at y = 0 down to y = -height (+ pool on the floor).
 * Local: x from 0 (outer edge, the side the tie-back pulls toward) to +width, z toward the room.
 * Folds have seeded ±35% jitter in period and depth and wander slowly down the drop; the
 * heading is pinch-pleated, the fabric is gathered into a narrow waist at the tie-back
 * (tiebackV = fraction of the drop), then flares out and pools on the floor.
 * Returns geometry; geometry.userData.waist = { x, y, w } (for the tie-back cord).
 */
export function velvetCurtain({ width = 1.0, height = 3.0, folds = 9, depth = 0.09, tieback = 0.7, tiebackV = 0.62, waist = 0.22, flare = 0.85, pool = 0.15, seed = 1, segX = 160, segY = 120 } = {}) {
  const rnd = (i) => { const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };
  // jittered fold boundaries in strand space u (0..1): 2 half-folds per fold
  const nh = folds * 2;
  const bounds = [0];
  for (let k = 0; k < nh; k++) bounds.push(bounds[k] + (1 + (rnd(k + 1) - 0.5) * 0.7));
  const total = bounds[nh];
  for (let k = 0; k <= nh; k++) bounds[k] /= total;
  const amps = []; for (let k = 0; k < nh; k++) amps.push((k % 2 ? -1 : 1) * (1 + (rnd(k + 40) - 0.5) * 0.7));
  const wander = []; for (let k = 0; k < nh; k++) wander.push(rnd(k + 80) * 6.28);
  const total2 = height + pool;
  const g = new THREE.PlaneGeometry(1, 1, segX, segY);
  const pos = g.attributes.position, uv = g.attributes.uv;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let waistInfo = null;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5;           // 0 outer .. 1 inner
    const s = 0.5 - pos.getY(i);           // 0 top .. 1 end of fabric (incl. pool)
    const yLen = s * total2;               // metres of fabric from the heading
    const v = Math.min(1, yLen / height);  // 0..1 over the drop
    // ---- across: heading -> waist -> flare
    const xTop = u * width;
    const xTie = (1 - tieback) * xTop + tieback * (u * width * waist);
    const xBot = u * width * flare + (1 - flare) * width * 0.15 * u;
    let x, gatherW;
    if (v < tiebackV) {
      const k = Math.pow(v / tiebackV, 1.35);
      const e = k * k * (3 - 2 * k);
      x = xTop + (xTie - xTop) * e;
      gatherW = 1 + ((1 - tieback) + tieback * waist - 1) * e;
    } else {
      const k = (v - tiebackV) / (1 - tiebackV);
      const e = 1 - (1 - k) * (1 - k);
      x = xTie + (xBot - xTie) * e;
      const wb = flare;
      const wt = (1 - tieback) + tieback * waist;
      gatherW = wt + (wb - wt) * e;
    }
    // ---- folds: find the half-fold this strand belongs to (folds wander slowly down the drop)
    let uu = u + 0.012 * Math.sin(v * 5.0 + u * 9.0 + seed);
    uu = Math.min(0.99999, Math.max(0, uu));
    let k = 0; while (k < nh - 1 && bounds[k + 1] < uu) k++;
    const t = (uu - bounds[k]) / Math.max(1e-6, bounds[k + 1] - bounds[k]);
    const shapeF = Math.sin(Math.PI * t);
    // heading: tight pinch pleats (sharper profile); body: soft round folds
    const headK = sm(0.0, 0.12, v);
    const prof = (1 - headK) * Math.sign(shapeF) * Math.pow(Math.abs(shapeF), 0.5) + headK * shapeF;
    const vary = 1 + 0.25 * Math.sin(v * 4.0 + wander[k]);
    // fabric compressed into the waist bunches out deeper
    const comp = Math.sqrt(1 / Math.max(0.2, gatherW));
    let amp = depth * (0.45 + 0.55 * headK) * comp * vary;
    let z = amps[k] * prof * amp;
    // the whole curtain bellies a little toward the room below the tie-back
    z += depth * 0.6 * sm(tiebackV, 1, v) * Math.sin(Math.PI * u);
    let y = -yLen;
    // pool: fabric past the drop folds forward onto the floor
    if (yLen > height) {
      const p = yLen - height;
      y = -height + Math.min(p, 0.04) * 0.5;
      z += p * 0.9 + 0.02;
      x += (u - 0.5) * p * 0.4;
    }
    pos.setXYZ(i, x, y, z);
    uv.setXY(i, u * width * 1.6, -y);
    if (!waistInfo && Math.abs(v - tiebackV) < 0.5 / segY) waistInfo = { y: -tiebackV * height };
  }
  g.computeVertexNormals();
  g.userData.waist = { x: width * waist * 0.5 * tieback + (1 - tieback) * width * 0.5, y: -tiebackV * height, w: width * ((1 - tieback) + tieback * waist) };
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
  // ---- hangings: sagging torn valance all round, rotted corner curtains (one half-fallen), back cloth
  {
    const drape = mats.drapeA, drape2 = mats.drapeB;
    const sag = (geo, amount, len) => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (len / 2); p.setY(i, p.getY(i) - amount * (1 - x * x)); }
      geo.computeVertexNormals();
      return geo;
    };
    const val = (len, x, z, ry, sd, droop) => {
      const vg = sag(curtain(G, { width: len, height: 0.46, folds: Math.round(len * 7), depth: 0.045, gather: 1, seed: sd, segX: 90, segY: 20 }), droop, len);
      const m = mesh(vg, drape2, x, ty - 0.02, z, g); m.rotation.y = ry; m.name = 'cloth';
    };
    val(W + 0.12, 0, hl + 0.06, 0, 11, 0.07); val(L + 0.12, -hw - 0.06, 0, -Math.PI / 2, 12, 0.11); val(L + 0.12, hw + 0.06, 0, Math.PI / 2, 13, 0.05);
    // back cloth behind the headboard
    const bc = mesh(curtain(G, { width: W, height: ty - 0.1, folds: 10, depth: 0.035, seed: 21, segX: 100, segY: 50 }), drape, 0, ty + 0.05, -hl - 0.05, g);
    bc.name = 'cloth';
    // corner curtains: lengths differ (rotted away at different heights)
    const specs = { '-1,-1': 1.0, '1,-1': 0.82, '1,1': 0.9 };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const foot = sz > 0;
      if (sx < 0 && sz > 0) continue;               // this one has come off its rail (below)
      const lenK = specs[`${sx},${sz}`];
      const cg = curtain(G, { width: foot ? 0.5 : 0.6, height: (ty - 0.02) * lenK, folds: foot ? 7 : 6, depth: 0.07, tieback: foot ? 1.0 : 0, seed: 30 + sx * 3 + sz, segX: 70, segY: 60 });
      const m = mesh(cg, sz > 0 ? drape : drape2, sx * (hw + 0.045), ty + 0.04, sz * (hl - (foot ? 0.3 : 0.36)), g);
      m.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      if ((sx > 0) !== (sz > 0)) m.scale.x = -1;
      m.name = 'cloth';
    }
    // half-fallen curtain at the near foot corner: still hooked at the post end, the rest of the
    // heading torn off the rail so it hangs in a long diagonal and slumps onto the counterpane
    {
      const cw = 0.62, ch = ty - 0.15;
      const fg = curtain(G, { width: cw, height: ch, folds: 8, depth: 0.08, seed: 37, segX: 80, segY: 70 });
      const p = fg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const u = x / cw + 0.5, v = -y / ch;          // u 0 = post end (still hooked)
        // the torn-off heading drops progressively along the width
        const drop = u * u * 0.85;
        y -= drop * (1 - v * 0.6);
        // it swings outward and in toward the bed as it falls
        z += u * 0.25 * (1 - v) + Math.sin(v * Math.PI) * 0.06;
        // the bottom piles on the floor
        if (y < -ty + 0.02) { const over = -ty + 0.02 - y; y = -ty + 0.02 + over * 0.05; z += over * 0.6; }
        p.setXYZ(i, x, y, z);
      }
      fg.computeVertexNormals();
      const m = mesh(fg, drape, -hw - 0.05, ty + 0.04, hl - 0.05 - cw / 2, g);
      m.rotation.y = -Math.PI / 2; m.scale.x = -1; m.name = 'cloth';
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
  // deep-carved rosettes in the lid fields either side of the board (bevelled petals + boss)
  {
    const roseX = 0.701 * (d + 0.03);
    const rg = carvedRosette(0.085);
    for (const sx of [-1, 1]) mesh(rg, mats.walnut, sx * roseX, lidY + 0.0752, 0, g);
  }
  // iron strap corners on the lid, and an escutcheon lock plate
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const L = new THREE.Shape(); const a = 0.11, t = 0.025;
    L.moveTo(0, 0); L.lineTo(a, 0); L.lineTo(a, t); L.quadraticCurveTo(t * 1.2, t * 1.2, t, a); L.lineTo(0, a); L.lineTo(0, 0);
    const lg = new THREE.ExtrudeGeometry(L, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1 });
    lg.rotateX(-Math.PI / 2);
    const m = mesh(lg, mats.iron, sx * ((w + 0.05) / 2 - 0.004), lidY + 0.0755, sz * ((d + 0.05) / 2 - 0.004), g);
    m.scale.set(-sx, 1, -sz);
    for (const [dx, dz] of [[0.012, 0.085], [0.085, 0.012], [0.014, 0.014]]) mesh(new THREE.SphereGeometry(0.0055, 8, 6), mats.iron, sx * ((w + 0.05) / 2 - 0.004 - dx), lidY + 0.08, sz * ((d + 0.05) / 2 - 0.004 - dz), g);
  }

  // iron strap corners and hasp
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c = mesh(rbox(G, 0.09, bodyH + 0.07, 0.01, 0.003), mats.iron, sx * (w / 2 - 0.045), 0.07 + bodyH / 2 + 0.03, sz * (d / 2 + 0.006), g);
    for (let k = 0; k < 3; k++) mesh(new THREE.SphereGeometry(0.006, 8, 6), mats.iron, sx * (w / 2 - 0.045), 0.12 + k * bodyH * 0.38, sz * (d / 2 + 0.012), g);
    void c;
  }
  // shaped escutcheon (cartouche) with a keyhole, and a hinged hasp dropping from the lid
  {
    const e = new THREE.Shape();
    e.moveTo(0, 0.065); e.quadraticCurveTo(0.03, 0.065, 0.045, 0.04); e.quadraticCurveTo(0.065, 0.0, 0.045, -0.04); e.quadraticCurveTo(0.03, -0.065, 0, -0.07);
    e.quadraticCurveTo(-0.03, -0.065, -0.045, -0.04); e.quadraticCurveTo(-0.065, 0.0, -0.045, 0.04); e.quadraticCurveTo(-0.03, 0.065, 0, 0.065);
    const kh = new THREE.Path(); kh.absarc(0, 0.008, 0.007, 0, Math.PI * 2, true); e.holes.push(kh);
    const eg = new THREE.ExtrudeGeometry(e, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 10 });
    mesh(eg, mats.brass, 0, lidY - 0.06, d / 2 + 0.003, g);
    const slot = mesh(new THREE.BoxGeometry(0.005, 0.016, 0.004), mats.black, 0, lidY - 0.062, d / 2 + 0.007, g); void slot;
    const kd = mesh(new THREE.CircleGeometry(0.0072, 14), mats.black, 0, lidY - 0.052, d / 2 + 0.0052, g); void kd;
    mesh(rbox(G, 0.035, 0.085, 0.008, 0.003), mats.iron, 0, lidY + 0.0, d / 2 + 0.03, g);
    mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 10).rotateZ(Math.PI / 2), mats.iron, 0, lidY + 0.045, d / 2 + 0.03, g);
  }
  g.userData = { boardTop: lidY + 0.0755, w, d };
  return g;
}

/** Carved rosette (Tudor-style): 8 bevelled outer petals, 8 inner, a domed boss. Lies on y = 0, radius r. */
function carvedRosette(r) {
  const parts = [];
  const petal = (len, wd) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.bezierCurveTo(len * 0.3, wd, len * 0.85, wd * 1.1, len, 0); sh.bezierCurveTo(len * 0.85, -wd * 1.1, len * 0.3, -wd, 0, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: r * 0.08, bevelEnabled: true, bevelThickness: r * 0.1, bevelSize: wd * 0.35, bevelSegments: 4, curveSegments: 10 });
    g.rotateX(-Math.PI / 2);
    // cup the petal: tips rise, the midrib is a crease
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) + (x / len) ** 2 * r * 0.12 - Math.abs(z) * 0.25); }
    g.computeVertexNormals();
    return g;
  };
  const outer = petal(r, r * 0.32), inner = petal(r * 0.6, r * 0.22);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const o = outer.clone(); o.rotateY(a); parts.push(o);
    const n = inner.clone(); n.rotateY(a + Math.PI / 8); n.translate(0, r * 0.08, 0); parts.push(n);
  }
  const boss = new THREE.SphereGeometry(r * 0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); boss.scale(1, 0.7, 1); boss.translate(0, r * 0.12, 0); parts.push(boss);
  const ring = new THREE.TorusGeometry(r * 1.02, r * 0.05, 6, 48); ring.rotateX(Math.PI / 2); ring.translate(0, r * 0.03, 0); parts.push(ring);
  const norm = parts.map((q) => { let g = q.index ? q.toNonIndexed() : q; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; });
  return mergeGeometries(norm);
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
  const coalG = new THREE.SphereGeometry(0.3, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  coalG.scale(0.95, 0.18, 0.4);
  { // lumpy ember bed
    const p = coalG.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); p.setY(i, y + (Math.sin(x * 61 + z * 37) * 0.5 + Math.sin(x * 23 - z * 71) * 0.5) * 0.008 * (y > 0.001 ? 1 : 0)); }
    coalG.computeVertexNormals();
  }
  const coalM = mesh(coalG, mats.coals, 0, 0.165, fz, g); coalM.name = 'coals';
  // logs: charred, split, checked bark with glowing cracks (emissive mask flickers with the fire)
  const logG = (len, r) => {
    const lg = new THREE.CylinderGeometry(r, r * 1.08, len, 18, 8, false);
    const p = lg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x), rr = Math.hypot(x, z);
      if (rr < 1e-4) continue;
      const k = 1 + 0.08 * Math.sin(a * 3 + y * 9) + 0.05 * Math.sin(a * 7 - y * 21) - 0.12 * Math.max(0, Math.sin(a + 0.6)) * (0.5 + 0.5 * Math.sin(y * 4));
      p.setX(i, x * k); p.setZ(i, z * k);
    }
    lg.computeVertexNormals();
    const uv = lg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.0, uv.getY(i) * len * 2.0);
    return lg;
  };
  for (const [x, y, z, rz, ry, len, r] of [[0, 0.235, fz + 0.03, Math.PI / 2, 0.12, 0.54, 0.052], [-0.06, 0.3, fz - 0.04, Math.PI / 2 - 0.28, -0.4, 0.46, 0.045], [0.09, 0.295, fz + 0.06, Math.PI / 2 + 0.32, 0.55, 0.42, 0.043]]) {
    const l = mesh(logG(len, r), mats.log, x, y, z, g); l.rotation.set(0, ry, rz); l.name = 'log';
    // glowing end grain on the burnt ends
    for (const e of [-1, 1]) { const cap = mesh(new THREE.CircleGeometry(r * 0.95, 16), mats.logEnd, 0, e * (len / 2 + 0.001), 0, l); cap.rotation.x = e * -Math.PI / 2; }
  }
  // ---- flames: noise-eroded fire shader on crossed vertical cards
  const flames = [];
  const fireMat = fireMaterial(ctx.time);
  const cardG = new THREE.PlaneGeometry(1, 1, 1, 1); cardG.translate(0, 0.5, 0);
  const cards = [[0, 0.62, 0.5, 0.0, 0.0], [0.6, 0.5, 0.42, 0.04, 2.3], [-0.55, 0.52, 0.38, -0.05, 4.1], [1.57, 0.36, 0.34, 0.0, 6.0]];
  for (const [ry, w, h, dx, sd] of cards) {
    const m = new THREE.Mesh(cardG, fireMat.clone());
    m.material.uniforms.uTime = ctx.time;
    m.material.uniforms.uSeed.value = sd;
    m.scale.set(w, h, 1); m.rotation.y = ry; m.position.set(dx, 0.2, fz);
    m.renderOrder = 10; m.userData.noBake = true; m.userData.noShadow = true; m.frustumCulled = false;
    g.add(m); flames.push(m);
  }
  // a soft glow card on the firebox back + rising embers
  const glowTex = ctx.textures.canvas('bedroom:fireglow', 128, 128, (c2, w) => {
    const gr = c2.createRadialGradient(w / 2, w * 0.7, 2, w / 2, w * 0.7, w * 0.55);
    gr.addColorStop(0, 'rgba(255,150,60,1)'); gr.addColorStop(0.4, 'rgba(255,90,20,0.45)'); gr.addColorStop(1, 'rgba(255,60,10,0)');
    c2.fillStyle = gr; c2.fillRect(0, 0, w, w);
  }, { tile: false });
  const glow = mesh(new THREE.PlaneGeometry(0.85, 0.75), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.9, 0.5, 0.25), name: 'fireGlow' }), 0, oy + 0.35, depth - fbD + 0.01, g);
  glow.userData.noBake = true; glow.userData.noShadow = true; glow.renderOrder = 9; glow.userData.keep = true;
  const embers = emberPoints(ctx, { count: 70, box: [0.46, 0.75, 0.2] });
  embers.position.set(0, 0.22, fz); g.add(embers);
  g.userData = { flames, coalMat: mats.coals, mantelY: shelfY + 0.06, front: depth + 0.36, fireZ: fz };
  return g;
}

/** Fire shader: fbm-eroded flame sheet, white-yellow core -> orange -> deep red edges (HDR, additive). */
export function fireMaterial(timeUniform) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: timeUniform || { value: 0 }, uSeed: { value: 0 }, uIntensity: { value: 3.2 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying float vFace;
      void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFace = abs(dot(normalize(normalMatrix * vec3(0.0, 0.0, 1.0)), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uSeed; uniform float uIntensity; varying vec2 vUv; varying float vFace;
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
      void main() {
        vec2 p = vUv;
        float t = uTime;
        // flame tongues: several narrowing lobes along x
        float x = (p.x - 0.5) * 2.0;
        float lobes = 0.55 + 0.45 * sin(x * 7.0 + uSeed * 3.0 + sin(t * 2.0 + uSeed) * 0.6);
        float body = 1.0 - smoothstep(0.55, 1.0, abs(x));          // fade at the card edges
        float n = fbm(vec2(p.x * 4.0 + uSeed, p.y * 3.0 - t * 2.6));
        float n2 = fbm(vec2(p.x * 9.0 - uSeed, p.y * 7.0 - t * 4.1));
        // height field the noise erodes: tall in the lobes, shorter toward the sides
        float hgt = (0.35 + 0.65 * lobes) * body;
        float e = hgt - p.y * 1.05 - (n - 0.5) * 0.55 - (n2 - 0.5) * 0.25;
        float a = smoothstep(0.0, 0.18, e);
        float core = smoothstep(0.18, 0.55, e) * (1.0 - smoothstep(0.0, 0.7, p.y));
        vec3 col = mix(vec3(0.55, 0.06, 0.01), vec3(1.0, 0.38, 0.06), smoothstep(0.0, 0.25, e));
        col = mix(col, vec3(1.0, 0.86, 0.5), core);
        col += vec3(1.0, 0.95, 0.8) * smoothstep(0.45, 0.8, e) * (1.0 - p.y) * 0.6;
        // blue-ish roots right at the coals
        col = mix(col, vec3(0.35, 0.3, 0.6), smoothstep(0.08, 0.0, p.y) * 0.5 * a);
        float alpha = a * smoothstep(0.0, 0.05, p.y) * smoothstep(0.08, 0.45, vFace);
        gl_FragColor = vec4(col * uIntensity * alpha, alpha);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
  });
}

/** Deterministic rising embers (Points) driven by the shared time uniform. box = [w, h, d] above the origin. */
export function emberPoints(ctx, { count = 60, box = [0.4, 0.7, 0.2] } = {}) {
  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(count * 4);
  const rnd = (i) => { const x = Math.sin(i * 78.233 + 12.9898) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < count; i++) for (let k = 0; k < 4; k++) seeds[i * 4 + k] = rnd(i * 4 + k + 1);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: ctx.time, uBox: { value: new THREE.Vector3(...box) } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed; uniform float uTime; uniform vec3 uBox; varying float vA;
      void main() {
        float life = fract(uTime * (0.25 + aSeed.w * 0.35) + aSeed.x);
        vec3 p = vec3((aSeed.y - 0.5) * uBox.x * (1.0 - life * 0.5), life * uBox.y, (aSeed.z - 0.5) * uBox.z);
        p.x += sin(uTime * 3.0 + aSeed.x * 20.0) * 0.03 * life;
        p.z += cos(uTime * 2.3 + aSeed.y * 20.0) * 0.02 * life;
        vA = (1.0 - life) * smoothstep(0.0, 0.1, life);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.0 + aSeed.w * 2.5) * (300.0 / -mv.z) * 0.02;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() { vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard;
        gl_FragColor = vec4(vec3(1.0, 0.45, 0.1) * 4.0 * vA * (1.0 - r * 4.0), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.userData.noBake = true; pts.userData.noShadow = true; pts.renderOrder = 11;
  return pts;
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
    const c = ctx.fx.candle({ height: s ? 0.12 : 0.17, radius: 0.0115, lit: s === 1, light: false, seed: 60 + s * 7, burn: 0.8 });
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
/** lathe whose outer rim is ruffled: r(θ) *= 1 + ruffle * sin(n θ) weighted toward the hem (profile y below `ruffleTop`). */
function ruffledLathe(G, pts, { seg = 64, n = 18, ruffle = 0.08, ruffleTop = 0.5, seed = 0 } = {}) {
  const g = G.latheFromProfile(pts, seg);
  const p = g.attributes.position;
  const ys = pts.map((q) => q[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z); if (r < 1e-5) continue;
    const a = Math.atan2(z, x);
    const k = 1 - Math.min(1, Math.max(0, (y - y0) / ((y1 - y0) * ruffleTop)));
    const f = 1 + ruffle * k * (Math.sin(a * n + seed) * 0.75 + Math.sin(a * n * 2.3 + seed * 2.0) * 0.25);
    p.setX(i, x * f); p.setZ(i, z * f);
  }
  g.computeVertexNormals();
  return g;
}

/** scalloped lace collar / frill: a shallow cone ring whose outer edge is scalloped. */
function frillGeometry(rIn, rOut, { n = 14, drop = 0.3, seg = 72 } = {}) {
  const g = new THREE.RingGeometry(rIn, rOut, seg, 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const r = Math.hypot(x, y), a = Math.atan2(y, x);
    const t = (r - rIn) / (rOut - rIn);
    const sc = 1 + t * 0.12 * Math.abs(Math.sin(a * n * 0.5));
    const rr = rIn + (r - rIn) * sc;
    // ripple up/down like a goffered frill
    const zz = -t * (rOut - rIn) * drop + Math.sin(a * n) * t * (rOut - rIn) * 0.18;
    p.setXYZ(i, Math.cos(a) * rr, zz, Math.sin(a) * rr);
    uv.setXY(i, (a / (Math.PI * 2) + 0.5) * n, t);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Seated bisque doll. Local: sitting on y = 0, facing +Z. size ≈ height of the seated doll.
 * Options: pose 'lap' | 'reach' | 'limp'; headYaw / tilt (radians); bonnet; cracked face.
 */
export function buildDoll(ctx, mats, { size = 0.3, seed = 0, dress = 0xb08080, hair = 0x3a2010, cracked = false, eyes = '#3a5a8a', bonnet = false, tilt = 0, headYaw = 0, pose = 'lap', lace = true } = {}) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'doll';
  const s = size / 0.3;
  const S = (pts) => pts.map(([r, y]) => [r * s, y * s]);
  const dressM = mats.dollVelvet(dress);
  const hairM = mats.dollHair(hair);
  const face = mats.dollFace({ seed, cracked, eyes, hair: `#${new THREE.Color(hair).getHexString()}` });
  // petticoat (lace) peeking under a ruffled skirt
  const pet = mesh(ruffledLathe(G, S([[0, 0.004], [0.122, 0.004], [0.125, 0.012], [0.11, 0.03], [0.0, 0.03]]), { n: 26, ruffle: 0.06, ruffleTop: 1, seed }), mats.laceFrill, 0, 0, 0.004 * s, g);
  pet.scale.set(1, 1, 1.12);
  const skirt = ruffledLathe(G, S([[0, 0.012], [0.116, 0.012], [0.118, 0.022], [0.108, 0.05], [0.088, 0.08], [0.064, 0.108], [0.046, 0.128], [0.0, 0.13]]), { n: 15, ruffle: 0.1, ruffleTop: 0.55, seed: seed + 1 });
  const sk = mesh(skirt, dressM, 0, 0, 0, g); sk.scale.set(1, 1, 1.15);
  // a sash at the waist
  const sash = mesh(new THREE.TorusGeometry(0.047 * s, 0.008 * s, 8, 28), mats.dollSash, 0, 0.128 * s, 0, g); sash.rotation.x = Math.PI / 2; sash.scale.set(1, 1.1, 1);
  // bodice with a pin-tucked front
  mesh(G.latheFromProfile(S([[0.0, 0.12], [0.046, 0.12], [0.05, 0.145], [0.046, 0.18], [0.034, 0.2], [0.018, 0.208], [0.0, 0.21]]), 24), dressM, 0, 0, 0, g);
  for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.004 * s, 8, 6), mats.pearl, 0, (0.14 + i * 0.016) * s, 0.048 * s - i * 0.0035 * s, g);
  // goffered lace collar
  if (lace) { const col = mesh(frillGeometry(0.018 * s, 0.05 * s, { n: 16, drop: 0.45 }), mats.laceFrill, 0, 0.207 * s, 0, g); col.rotation.y = seed; }
  // legs forward: white stockings + strapped black shoes
  for (const sx of [-1, 1]) {
    const leg = mesh(new THREE.CapsuleGeometry(0.0145 * s, 0.085 * s, 4, 10), mats.stocking, sx * 0.034 * s, 0.02 * s, 0.1 * s, g); leg.rotation.x = Math.PI / 2 - 0.12;
    const shoe = mesh(new THREE.SphereGeometry(0.015 * s, 14, 10), mats.shoe, sx * 0.034 * s, 0.022 * s, 0.155 * s, g); shoe.scale.set(0.95, 0.8, 1.5);
    const strap = mesh(new THREE.TorusGeometry(0.0125 * s, 0.002 * s, 5, 16), mats.shoe, sx * 0.034 * s, 0.025 * s, 0.146 * s, g); strap.rotation.y = Math.PI / 2;
  }
  // arms: puffed sleeve + bisque forearm + hand; posed
  const arms = { lap: [0.95, 0.0, 0.35], reach: [1.45, 0.0, 0.18], limp: [0.15, 0.0, 0.12] }[pose] || [0.95, 0, 0.35];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.05 * s, 0.19 * s, 0); g.add(sh);
    sh.rotation.set(arms[0] + (pose === 'limp' && sx > 0 ? 0.25 : 0), 0, sx * arms[2]);
    const puff = mesh(new THREE.SphereGeometry(0.022 * s, 14, 10), dressM, 0, -0.012 * s, 0, sh); puff.scale.set(1, 1.15, 1);
    mesh(new THREE.TorusGeometry(0.015 * s, 0.004 * s, 6, 16), mats.laceFrill, 0, -0.03 * s, 0, sh).rotation.x = Math.PI / 2;
    mesh(new THREE.CapsuleGeometry(0.0105 * s, 0.045 * s, 4, 10), face.skin, 0, -0.06 * s, 0, sh);
    const hand = mesh(new THREE.SphereGeometry(0.0125 * s, 12, 8), face.skin, 0, -0.093 * s, 0.003 * s, sh); hand.scale.set(0.8, 1.15, 0.55);
    const thumb = mesh(new THREE.CapsuleGeometry(0.0035 * s, 0.008 * s, 3, 6), face.skin, sx * -0.008 * s, -0.088 * s, 0.006 * s, sh); thumb.rotation.z = sx * 0.6;
  }
  // head: larger porcelain head with painted face and glass eyes
  const head = new THREE.Group(); head.position.set(0, 0.268 * s, 0); head.rotation.set(0.04, headYaw, tilt); g.add(head);
  const hr = 0.06 * s;
  const hm = mesh(new THREE.SphereGeometry(hr, 40, 28), face.mat, 0, 0, 0, head); hm.scale.set(0.94, 1.03, 0.97);
  hm.rotation.y = 0;
  mesh(new THREE.CylinderGeometry(0.018 * s, 0.022 * s, 0.04 * s, 14), face.skin, 0, -0.055 * s, 0, head);
  // glass eyeballs set into the painted sockets (catch the light from across the room)
  for (const sx of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(0.0115 * s, 16, 12), face.glass, sx * 0.0215 * s, 0.004 * s, hr * 0.83, head);
    e.scale.set(1, 0.78, 0.5);
  }
  // hair: cap + a fringe + long ringlets
  const cap = mesh(new THREE.SphereGeometry(hr * 1.06, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), hairM, 0, 0.004 * s, -0.006 * s, head); cap.rotation.x = -0.42;
  const fringe = mesh(new THREE.SphereGeometry(hr * 1.05, 20, 8, Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.18, Math.PI * 0.14), hairM, 0, 0.0, 0, head); fringe.rotation.y = -Math.PI * 0.5 - Math.PI * 0.25 + Math.PI * 0.25;
  const ring = new THREE.CapsuleGeometry(0.0095 * s, 0.05 * s, 3, 8);
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * 0.6 + (i / 10) * Math.PI * 0.8;
    const r = mesh(ring, hairM, Math.cos(a) * hr * 0.92, -0.04 * s - (i % 3) * 0.006 * s, -Math.sin(a) * hr * 0.6 - 0.012 * s, head);
    r.rotation.set(Math.sin(a) * 0.25, 0, Math.cos(a) * 0.3);
  }
  if (bonnet) {
    const b = mesh(new THREE.SphereGeometry(0.074 * s, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), dressM, 0, 0.004 * s, -0.014 * s, head); b.rotation.x = -0.75;
    const brim = mesh(frillGeometry(0.066 * s, 0.088 * s, { n: 22, drop: -0.2 }), mats.laceFrill, 0, 0.022 * s, 0.012 * s, head); brim.rotation.x = -0.75 + Math.PI / 2;
    const tie = mesh(new THREE.TorusGeometry(0.012 * s, 0.004 * s, 6, 12), mats.dollSash, 0.0, -0.06 * s, 0.035 * s, head); tie.rotation.y = 0.4;
  }
  g.userData.head = head;
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
/**
 * Wardrobe with a hollow carcass. Local: back at z=0, faces +Z. userData.doors = [leftPivot, rightPivot]
 * (groups hinged at the outer edges); userData.back = the back panel (hidden once the knights are
 * solved, revealing the attic stair behind it); userData.opening = { w, y0, y1 } of the hole in the back.
 */
export function buildWardrobe(ctx, mats, { w = 1.42, h = 2.32, d = 0.62 } = {}) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'wardrobe';
  const t = 0.03, plinth = 0.14, top = h - 0.12;
  mesh(rbox(G, w + 0.04, plinth, d + 0.03, 0.01), mats.mahogany, 0, plinth / 2, d / 2, g);
  // carcass: sides, top, floor (open front + removable back)
  for (const sx of [-1, 1]) mesh(rbox(G, t, top - plinth, d - 0.02, 0.006), mats.mahogany, sx * (w / 2 - t / 2), plinth + (top - plinth) / 2, d / 2 - 0.01, g);
  mesh(rbox(G, w, t, d - 0.02, 0.006), mats.mahogany, 0, top - t / 2, d / 2 - 0.01, g);
  mesh(rbox(G, w - 2 * t, 0.02, d - 0.04, 0.004), mats.walnut, 0, plinth + 0.01, d / 2, g);
  // front stiles + rails round the doors
  for (const sx of [-1, 1]) mesh(rbox(G, 0.04, top - plinth, 0.025, 0.006), mats.mahogany, sx * (w / 2 - 0.02), plinth + (top - plinth) / 2, d - 0.005, g);
  mesh(rbox(G, w, 0.06, 0.025, 0.006), mats.mahogany, 0, top - 0.03, d - 0.005, g);
  // interior: hanging rail with brass sockets and one forgotten wire hanger
  const rail = mesh(new THREE.CylinderGeometry(0.012, 0.012, w - 2 * t, 12).rotateZ(Math.PI / 2), mats.brass, 0, top - 0.16, d * 0.5, g);
  void rail;
  const hanger = new THREE.Group();
  const hk = new THREE.TorusGeometry(0.018, 0.0025, 6, 16, Math.PI * 1.3); mesh(hk, mats.iron, 0, 0.0, 0, hanger).rotation.z = -0.4;
  const tri = []; for (const [x, y] of [[0, -0.02], [-0.2, -0.13], [0.2, -0.13], [0, -0.02]]) tri.push(V3(x, y, 0));
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tri, false, 'catmullrom', 0.1), 40, 0.0025, 5, false), mats.iron, 0, 0, 0, hanger);
  hanger.position.set(0.38, top - 0.15, d * 0.5); hanger.rotation.set(0, 0.25, 0.18); g.add(hanger);
  // back panel (with the opening behind it) — hidden when the stair is revealed
  const ow = w - 0.24, oy0 = plinth + 0.02, oy1 = top - 0.04;
  const backShape = new THREE.Shape();
  backShape.moveTo(-w / 2 + t, plinth); backShape.lineTo(w / 2 - t, plinth); backShape.lineTo(w / 2 - t, top - t); backShape.lineTo(-w / 2 + t, top - t); backShape.lineTo(-w / 2 + t, plinth);
  const hole = new THREE.Path();
  hole.moveTo(-ow / 2, oy0); hole.lineTo(-ow / 2, oy1); hole.lineTo(ow / 2, oy1); hole.lineTo(ow / 2, oy0); hole.lineTo(-ow / 2, oy0);
  backShape.holes.push(hole);
  mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(backShape, { depth: 0.02, bevelEnabled: false }), 1), mats.walnut, 0, 0, 0.0, g);
  const back = mesh(G.boxUV(ow + 0.02, oy1 - oy0 + 0.02, 0.018, 1), mats.walnut, 0, (oy0 + oy1) / 2, 0.03, g);
  back.name = 'wardrobeBack'; back.userData.keep = true;
  // vertical boarding lines on the back panel
  for (let i = 1; i < 5; i++) mesh(new THREE.BoxGeometry(0.004, oy1 - oy0, 0.004), mats.soot, -ow / 2 + (i * ow) / 5, (oy0 + oy1) / 2, 0.04, back.parent === g ? back : g).position.set(-ow / 2 + (i * ow) / 5, 0, 0.011);
  // cornice
  const cw = w / 2 + 0.03;
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
    // inside face of the leaf
    mesh(G.raisedPanel(dw - 0.12, dh * 0.8, { border: 0.05, bevel: 0.03 }), mats.walnut, 0, dh * 0.5, -0.015, leaf).rotation.y = Math.PI;
    mesh(lathe(G, [[0, 0], [0.012, 0], [0.016, 0.02], [0.008, 0.035], [0, 0.04]], 12).rotateX(Math.PI / 2), mats.brass, -sx * (dw / 2 - 0.05), dh * 0.48, 0.015, leaf);
    g.add(pivot); doors.push(pivot);
  }
  g.userData = { doors, back, opening: { w: ow, y0: oy0, y1: oy1 } };
  return g;
}

/**
 * The hidden attic stair behind the wardrobe. Local frame: x across (centred), the stair climbs
 * toward -Z from z = 0 (the wall plane), floor at y = `y0`. Returns a Group; userData.light is the
 * cold skylight spot (target included), userData.shaftInfo describes the skylight for fx.shaft.
 */
export function buildAtticStair(ctx, mats, { w = 1.1, y0 = 0.16, steps = 8, rise = 0.235, going = 0.3 } = {}) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'atticStair';
  const z0 = -0.3;                                   // first riser (a short landing behind the wall)
  const runL = steps * going;
  const topY = y0 + steps * rise;
  const endZ = z0 - runL;
  const deep = endZ - 1.6;                           // the attic floor runs on beyond the stair head
  // landing floor
  mesh(G.boxUV(w, 0.04, -z0 + 0.05, 1), mats.atticBoard, 0, y0 - 0.02, z0 / 2, g);
  // treads + risers, worn in the middle, the odd tread split
  for (let i = 0; i < steps; i++) {
    const y = y0 + (i + 1) * rise, z = z0 - i * going;
    const tread = mesh(rbox(G, w - 0.06, 0.035, going + 0.03, 0.008), mats.atticBoard, 0, y - 0.0175, z - going / 2 + 0.015, g);
    tread.rotation.z = ((i * 7) % 5 - 2) * 0.004;
    mesh(G.boxUV(w - 0.08, rise, 0.02, 1), mats.atticBoard, 0, y - rise / 2, z + 0.005, g);
    // nosing
    mesh(new THREE.CylinderGeometry(0.018, 0.018, w - 0.06, 10).rotateZ(Math.PI / 2), mats.atticBoard, 0, y - 0.018, z + 0.01, g);
  }
  // stringers both sides, following the pitch
  const pitch = Math.atan2(steps * rise, runL);
  const strL = Math.hypot(runL, steps * rise) + 0.5;
  for (const sx of [-1, 1]) {
    const st = mesh(rbox(G, 0.05, 0.28, strL, 0.01), mats.atticBeam, sx * (w / 2 - 0.025), y0 + (steps * rise) / 2 - 0.05, z0 - runL / 2, g);
    st.rotation.x = pitch;
  }
  // handrail on posts along the left side
  {
    const hx = -w / 2 + 0.07;
    const rl = mesh(new THREE.CylinderGeometry(0.022, 0.022, strL - 0.3, 10), mats.atticBeam, hx, y0 + 0.9 + (steps * rise) / 2, z0 - runL / 2, g);
    rl.rotation.x = Math.PI / 2 - pitch;
    for (let i = 0; i <= steps; i += 2) {
      const y = y0 + i * rise, z = z0 - i * going;
      mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.9, 8), mats.atticBeam, hx, y + 0.45, z - going / 2, g);
    }
  }
  // side walls: rough limewashed plaster, and a sloped ceiling that opens into the attic
  const wallH = topY + 1.9;
  for (const sx of [-1, 1]) {
    const wl = mesh(G.planeUV(-deep + 0.05, wallH, 1), mats.atticPlaster, sx * w / 2, wallH / 2, deep / 2, g);
    wl.rotation.y = -sx * Math.PI / 2;
  }
  const ceilL = Math.hypot(runL * 0.55, steps * rise * 0.55);
  const ceil = mesh(G.planeUV(w, ceilL, 1), mats.atticPlaster, 0, y0 + 2.15 + (steps * rise) * 0.27, z0 - runL * 0.27, g);
  ceil.rotation.x = Math.PI / 2 + pitch;
  // attic floor, back wall far away
  mesh(G.boxUV(w, 0.04, -deep + endZ + 0.02, 1), mats.atticBoard, 0, topY - 0.02, (endZ + deep) / 2, g);
  const bw = mesh(G.planeUV(w, wallH, 1), mats.atticPlaster, 0, wallH / 2, deep, g); void bw;
  // rafters and a ridge beam above the stair head, festooned with cobwebs
  const roofY = topY + 1.15;
  for (let k = 0; k < 5; k++) {
    const z = endZ + 0.9 - k * 0.55;
    for (const sx of [-1, 1]) {
      const rf = mesh(rbox(G, 0.07, 0.12, 1.3, 0.006), mats.atticBeam, sx * 0.3, roofY + 0.25, z, g);
      rf.rotation.set(0, Math.PI / 2, sx * 0.6);
    }
    mesh(rbox(G, w, 0.1, 0.07, 0.006), mats.atticBeam, 0, roofY, z, g);
  }
  mesh(rbox(G, 0.08, 0.1, 3.0, 0.006), mats.atticBeam, 0, roofY + 0.55, endZ - 0.3, g);
  // roof boarding between the rafters
  for (const sx of [-1, 1]) {
    const rbg = G.planeUV(0.9, 3.0, 1).rotateX(Math.PI / 2).rotateZ(-sx * 0.6);
    mesh(rbg, mats.atticBoard, sx * 0.32, roofY + 0.33, endZ - 0.3, g);
  }
  // skylight in the roof (moonlit), the source of the cold shaft down the stair
  const sky = mesh(new THREE.PlaneGeometry(0.42, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.65, 1.0).multiplyScalar(2.2), toneMapped: true, name: 'atticSky' }), 0.28, roofY + 0.62, endZ - 0.15, g);
  sky.rotation.set(-Math.PI / 2, 0, 0); sky.rotateY(0.95); sky.userData.noShadow = true;
  // cold light pouring down the stair from the skylight
  const spot = new THREE.SpotLight(0x9fb4ff, 60, 9, 0.5, 0.6, 1.6);
  spot.position.set(0.2, roofY + 0.5, endZ - 0.2);
  spot.target.position.set(0, y0, z0 + 0.2);
  spot.castShadow = ctx.quality.shadows;
  spot.shadow.mapSize.set(512, 512); spot.shadow.bias = -0.002; spot.shadow.normalBias = 0.02; spot.shadow.radius = 4;
  spot.shadow.camera.near = 0.3; spot.shadow.camera.far = 9;
  g.add(spot, spot.target);
  // soft cold fill so the stairwell is not a black hole
  const fill = new THREE.PointLight(0x7f95d8, 2.2, 4.5, 2); fill.position.set(0, topY - 0.3, endZ + 1.0); g.add(fill);
  g.userData = { light: spot, fill, topY, endZ, roofY, z0 };
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

// ============================================================================ ceiling
/** Plaster ceiling rose: stepped rings, a bead, and a ring of acanthus leaves. Hangs from y = 0 downward. */
export function buildCeilingRose(G) {
  const parts = [];
  parts.push(G.latheFromProfile([[0.0, 0], [0.56, 0], [0.56, -0.012], [0.53, -0.022], [0.5, -0.022], [0.49, -0.032], [0.44, -0.04], [0.4, -0.036],
    [0.37, -0.05], [0.31, -0.058], [0.27, -0.054], [0.24, -0.07], [0.18, -0.085], [0.13, -0.09], [0.1, -0.11], [0.06, -0.125], [0.03, -0.15], [0.0, -0.155]], 64));
  // bead-and-reel ring
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; const b = new THREE.SphereGeometry(0.011, 8, 6); b.scale(1, 0.7, 1.4); b.rotateY(-a); b.translate(Math.cos(a) * 0.47, -0.034, Math.sin(a) * 0.47); parts.push(b); }
  // acanthus leaves radiating, curling down at the tips
  const leaf = new THREE.Shape();
  leaf.moveTo(0, -0.03); leaf.quadraticCurveTo(0.05, -0.04, 0.12, -0.012); leaf.quadraticCurveTo(0.16, 0.0, 0.2, 0.0);
  leaf.quadraticCurveTo(0.16, 0.006, 0.12, 0.014); leaf.quadraticCurveTo(0.05, 0.04, 0, 0.03); leaf.lineTo(0, -0.03);
  const lg0 = new THREE.ExtrudeGeometry(leaf, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 6 });
  lg0.rotateX(-Math.PI / 2);
  { const p = lg0.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) - x * x * 1.2 + Math.abs(p.getZ(i)) * 0.3); } lg0.computeVertexNormals(); }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const l = lg0.clone(); l.rotateY(-a); l.translate(Math.cos(a) * 0.12, -0.075, Math.sin(a) * 0.12); parts.push(l); }
  const norm = parts.map((q) => { let g = q.index ? q.toNonIndexed() : q; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; });
  return G.applyBoxUVs(G.mergeGeometries(norm), 1);
}

/** Heavy tarnished-brass gasolier: turned stem, bowl, four S-scroll arms with frosted tulip shades. Hangs from y = 0. */
export function buildGasolier(ctx, mats) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'gasolier';
  const B = mats.brassOld;
  mesh(G.latheFromProfile([[0, 0], [0.09, 0], [0.085, -0.02], [0.05, -0.04], [0.03, -0.07], [0.02, -0.08], [0, -0.08]], 32), B, 0, -0.155, 0, g);
  mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.45, 12), B, 0, -0.46, 0, g);
  // turned knops on the stem
  for (const y of [-0.3, -0.5]) mesh(G.latheFromProfile([[0, 0.02], [0.03, 0.015], [0.035, 0], [0.03, -0.015], [0, -0.02]], 20), B, 0, y, 0, g);
  // the body: bulb + bowl + pendant finial
  mesh(G.latheFromProfile([[0, 0], [0.04, -0.01], [0.075, -0.05], [0.09, -0.1], [0.08, -0.14], [0.11, -0.16], [0.12, -0.18], [0.08, -0.2], [0.04, -0.24], [0.02, -0.3], [0.03, -0.33], [0.012, -0.38], [0, -0.4]], 40), B, 0, -0.68, 0, g);
  // arms
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const c = new THREE.CubicBezierCurve3(V3(0.08, -0.85, 0), V3(0.3, -0.98, 0), V3(0.36, -0.7, 0), V3(0.42, -0.78, 0));
    const tg = new THREE.TubeGeometry(c, 40, 0.011, 8, false); tg.rotateY(-a);
    mesh(tg, B, 0, 0, 0, g);
    // decorative curl under the arm
    const c2 = new THREE.CubicBezierCurve3(V3(0.16, -0.93, 0), V3(0.2, -1.02, 0), V3(0.28, -1.0, 0), V3(0.25, -0.95, 0));
    const t2 = new THREE.TubeGeometry(c2, 20, 0.006, 6, false); t2.rotateY(-a); mesh(t2, B, 0, 0, 0, g);
    const px = Math.cos(a) * 0.42, pz = Math.sin(a) * 0.42;
    mesh(G.latheFromProfile([[0, 0], [0.03, 0], [0.034, 0.02], [0.022, 0.03], [0, 0.03]], 18), B, px, -0.79, pz, g);
    const sh = mesh(G.latheFromProfile([[0.022, 0], [0.05, 0.03], [0.062, 0.08], [0.06, 0.12], [0.07, 0.15], [0.064, 0.152]], 24), mats.frostGlass, px, -0.77, pz, g);
    sh.userData.noShadow = true;
  }
  return g;
}
