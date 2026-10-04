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
export function velvetCurtain({ width = 1.0, height = 3.0, folds = 9, depth = 0.09, tieback = 0.7, tiebackV = 0.62, waist = 0.22, flare = 0.85, pool = 0.15, seed = 1, segX = 160, segY = 120, uv01 = false, jitter = 0.95, noise = 0, ripple = 1 } = {}) {
  const rnd = (i) => { const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };
  // jittered fold boundaries in strand space u (0..1): 2 half-folds per fold
  const nh = folds * 2;
  const bounds = [0];
  for (let k = 0; k < nh; k++) bounds.push(bounds[k] + Math.max(0.25, 1 + (rnd(k + 1) - 0.5) * jitter * 1.2));
  const total = bounds[nh];
  for (let k = 0; k <= nh; k++) bounds[k] /= total;
  const amps = []; for (let k = 0; k < nh; k++) amps.push((k % 2 ? -1 : 1) * Math.max(0.3, 1 + (rnd(k + 40) - 0.5) * jitter * 1.3));
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
    // one smooth (C1) profile through heading -> waist -> flare, so no crease forms at the tie-back
    const wt = (1 - tieback) + tieback * waist;
    const kA = Math.min(1, v / tiebackV), kB = Math.max(0, (v - tiebackV) / (1 - tiebackV));
    const eA = kA * kA * (3 - 2 * kA), eB = kB * kB * (3 - 2 * kB);
    const x = v < tiebackV ? xTop + (xTie - xTop) * eA : xTie + (xBot - xTie) * eB;
    const gatherW = v < tiebackV ? 1 + (wt - 1) * eA : wt + (flare - wt) * eB;
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
    let y = -yLen, xx = x;
    // the whole curtain bellies a little toward the room below the tie-back
    z += depth * 0.6 * sm(tiebackV, 1, v) * Math.sin(Math.PI * u);
    if (noise > 0) {
      // cloth, not hoses: broad slow billows, a few small secondary folds riding on the big ones,
      // and folds that merge and split down the drop
      const lf = Math.sin(u * 5.1 + v * 2.3 + seed) * Math.sin(v * 3.7 - u * 2.0 + seed * 2.1) + 0.5 * Math.sin(u * 11.3 - v * 4.1 + seed * 3.3);
      z += noise * depth * 0.55 * lf;
      z += ripple * noise * depth * 0.18 * Math.sin(u * folds * 2.0 * Math.PI * 2.0 + v * 6.0 + seed) * (0.3 + 0.7 * headK) * Math.abs(prof);
      xx += noise * 0.012 * Math.sin(v * 7.0 + u * 13.0 + seed) * (1 - headK * 0.5);
    }
    // pool: fabric past the drop folds forward onto the floor
    if (yLen > height) {
      const p = yLen - height;
      y = -height + Math.min(p, 0.04) * 0.5;
      z += p * 0.9 + 0.02;
      xx += (u - 0.5) * p * 0.4;
    }
    pos.setXYZ(i, xx, y, z);
    if (uv01) uv.setXY(i, u, 1 - s); else uv.setXY(i, u * width * 1.6, -y);
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
    const cw = W - 0.08, drop = 0.42, cl = L - 0.1;
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
        const ph = rnd(sg > 0 ? 1 : 2) * 6;
        const fold = Math.sin(zz * 5.3 + ph) * 0.55 + Math.sin(zz * 11.7 + ph * 1.7) * 0.3 + Math.sin(zz * 27.0 + rnd(3) * 6) * 0.12;
        x = sg * (cw / 2 + f * f * 0.07 + fold * f * 0.085); y = -r - d * (1 - 0.06 * Math.abs(fold));
        // the hem hangs unevenly, lower where the folds are deep
        y -= f * (0.02 + 0.02 * Math.sin(zz * 3.1 + ph)) * (0.5 + 0.5 * Math.abs(fold));
      }
      // soft wrinkles and the body's dent on top (low frequency, cloth not upholstery)
      const top = as < cw / 2 ? 1 : 0.35;
      y += (Math.sin(s * 7.0 + zz * 2.3) * Math.sin(zz * 4.1 + 1.3) * 0.02 + Math.sin(s * 17 + zz * 5) * Math.sin(zz * 13 - s * 3) * 0.007 + Math.sin(s * 3.1 - zz * 1.7 + 2.0) * 0.012) * top;
      // long diagonal drag-wrinkles where the cover has been pulled toward the foot
      y += 0.012 * Math.pow(Math.max(0, Math.sin((s * 0.8 + zz) * 6.0 + Math.sin(s * 3.0) * 1.5)), 3) * top * (0.4 + 0.6 * Math.max(0, zz / cl + 0.5));
      // the mattress edge: the cover sags into the gap between the mattress and the rails
      y -= 0.018 * Math.max(0, 1 - Math.abs(as - (cw / 2 - 0.04)) / 0.08);
      y -= 0.012 * Math.exp(-((s + 0.15) ** 2) / 0.08 - ((zz + 0.2) ** 2) / 0.35) * top;
      // crumpled where it was dragged toward the near foot corner
      const cm = Math.max(0, Math.min(1, (zz - (cl / 2 - 0.6)) / 0.4)) * Math.max(0, Math.min(1, (-s - 0.1) / 0.3));
      y += cm * (Math.abs(Math.sin(s * 19 + zz * 11) * Math.sin(zz * 15 - s * 7)) * 0.03 + 0.008);
      pos.setXYZ(i, x, y, zz);
      uv.setXY(i, (s + half) * 1.0, (zz + cl / 2) * 1.0);
    }
    geo.computeVertexNormals();
    const cover = mesh(geo, mats.quilt, 0, mTop + 0.03, 0.05, g);
    cover.name = 'cloth';
    if (ctx.params?.get?.('brDbg') !== 'nosheet') {
    // turned-down sheet at the head: the top sheet folded back over the counterpane in a soft roll,
    // its band rumpled, hanging down over both sides with the cover
    {
      // thin cloth (6 mm) whose fold edge rolls over softly; the band droops toward the fold
      const bandD = 0.3, r = 0.016, segX = 140;
      const prof = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push([t * (bandD - 0.01), 0.006 + 0.012 * t * t]); }
      for (let i = 1; i <= 12; i++) { const a = Math.PI / 2 - (i / 12) * Math.PI; prof.push([bandD - 0.01 + Math.cos(a) * r, 0.018 - r + Math.sin(a) * r + r * 0.0]); }
      for (let i = 8; i >= 0; i--) { const t = i / 8; prof.push([t * (bandD - 0.016), Math.max(0, 0.018 - 2 * r + 0.008 * t)]); }
      const shape = new THREE.Shape(prof.map(([z, y]) => V2(z, y)));
      const sw = cw + 2 * 0.06;
      const sgm = new THREE.ExtrudeGeometry(shape, { depth: sw, bevelEnabled: false, steps: segX, curveSegments: 12 });
      sgm.translate(0, 0, -sw / 2); sgm.rotateY(-Math.PI / 2);       // profile z -> +z (toward the foot), extrude -> x
      const p = sgm.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const ax = Math.abs(x);
        // drape down over the mattress edges like the counterpane does
        let yy = y, xx = x;
        if (ax > cw / 2 - 0.06) { const d = ax - (cw / 2 - 0.06); const a = Math.min(d / 0.06, 1) * Math.PI / 2; xx = Math.sign(x) * (cw / 2 - 0.06 + Math.sin(a) * 0.06 + Math.max(0, d - 0.094) * 0.1); yy = y - (1 - Math.cos(a)) * 0.06 - Math.max(0, d - 0.094) * 1.0; }
        // rumples along the band
        yy += 0.012 * Math.sin(x * 11.0 + z * 9.0) * Math.sin(x * 4.3 + 1.3) + 0.005 * Math.sin(x * 19.0 - z * 14.0) * Math.sin(x * 2.1) + 0.008 * Math.max(0, Math.sin(x * 7.3 + 0.4)) * (z / bandD);
        const zz = z + (0.02 * Math.sin(x * 5.3 + 0.7) + 0.012 * Math.sin(x * 17.0)) * (0.3 + z / bandD);
        p.setXYZ(i, xx, yy, zz);
      }
      sgm.computeVertexNormals();
      const sheet = mesh(G.applyBoxUVs(sgm, 1), mats.linen, 0, mTop + 0.052, -hl + 0.48, g);
      sheet.name = 'cloth';
    }
    }
  }
  // ---- pillows: soft stuffed cases with corded piping round the seam, a head-dent in the middle
  {
    const PW = 0.68, PH = 0.27, PD = 0.44;
    const pg = new G.RoundedBoxGeometry(PW, PH, PD, 10, 0.12);
    const p = pg.attributes.position;
    const prof = (x, z) => { const k = (1 - Math.min(1, (x / (PW / 2)) ** 2)) * (1 - Math.min(1, (z / (PD / 2)) ** 2)); return Math.sqrt(Math.max(0, k)); };
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = prof(x, z);
      let yy = y * (0.2 + 0.8 * Math.pow(k, 0.55));
      // the dent where a head has lain, and wrinkles radiating from it
      if (y > 0) {
        const dent = Math.exp(-((x + 0.04) ** 2) / 0.02 - ((z - 0.02) ** 2) / 0.012);
        yy -= 0.045 * dent * k;
        yy += 0.006 * Math.sin(Math.atan2(z, x) * 9.0) * (1 - dent) * k;
      }
      // the corners pulled into ears
      const cx = Math.abs(x) / (PW / 2), cz = Math.abs(z) / (PD / 2);
      const ear = Math.max(0, cx + cz - 1.6) * 0.06;
      p.setXYZ(i, x * (1 + ear), yy, z * (1 + ear));
    }
    pg.computeVertexNormals();
    const pgu = G.applyBoxUVs(pg, 1);
    // piping: a cord round the seam (mid-height outline of the case)
    const pipePts = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      const sx = Math.sign(c) * Math.pow(Math.abs(c), 0.35) * (PW / 2 - 0.004), sz = Math.sign(sn) * Math.pow(Math.abs(sn), 0.35) * (PD / 2 - 0.004);
      pipePts.push(V3(sx, 0.002 * Math.sin(a * 7), sz));
    }
    const pipe = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pipePts, true), 192, 0.006, 6, true);
    for (const [x, rz, ry] of [[-0.42, 0.06, 0.05], [0.42, -0.05, -0.08]]) {
      const pm = mesh(pgu, mats.linen, x, mTop + 0.075, -hl + 0.3, g);
      pm.rotation.set(-0.45, ry, rz); pm.name = 'cloth';
      const pp = mesh(pipe, mats.linen, x, mTop + 0.075, -hl + 0.3, g);
      pp.rotation.copy(pm.rotation); pp.name = 'cloth';
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
  // ---- hangings: rotted velvet (tatters + rips are alpha), soft uneven folds; one curtain half-fallen
  {
    const drape = mats.drapeA, drape2 = mats.drapeB, valM = mats.drapeVal || drape2;
    const sag = (geo, amount, len) => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (len / 2); p.setY(i, p.getY(i) - amount * (1 - x * x)); }
      geo.computeVertexNormals();
      return geo;
    };
    const val = (len, x, z, ry, sd, droop) => {
      const vg = sag(curtain(G, { width: len, height: 0.52, folds: Math.round(len * 6), depth: 0.05, gather: 1, seed: sd, segX: 120, segY: 26 }), droop, len);
      const m = mesh(vg, valM, x, ty - 0.02, z, g); m.rotation.y = ry; m.name = 'cloth';
    };
    val(W + 0.12, 0, hl + 0.06, 0, 11, 0.07); val(L + 0.12, -hw - 0.06, 0, -Math.PI / 2, 12, 0.11); val(L + 0.12, hw + 0.06, 0, Math.PI / 2, 13, 0.05);
    // back cloth behind the headboard
    const bc = mesh(curtain(G, { width: W, height: ty - 0.1, folds: 10, depth: 0.035, seed: 21, segX: 100, segY: 50 }), drape2, 0, ty + 0.05, -hl - 0.05, g);
    bc.name = 'cloth';
    // corner curtains hang from each post along the bed's sides: the foot pair is caught back to its
    // post with a cord, the head pair hangs loose. Lengths differ (rotted off at different heights).
    const specs = { '-1,-1': 1.0, '1,-1': 0.86, '1,1': 0.93, '-1,1': 0.8 };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const foot = sz > 0;
      const near = sx < 0 && sz > 0;                // the one nearest the room: dragged right back to its post, so the bed shows
      const lenK = specs[`${sx},${sz}`];
      const cg = velvetCurtain({
        width: foot ? 0.62 : 0.7, height: (ty - 0.02) * lenK, folds: foot ? 8 : 7, depth: 0.14, noise: 0.8, ripple: 0,
        tieback: foot ? (near ? 0.85 : 0.72) : 0.12, tiebackV: foot ? 0.5 : 0.6, waist: foot ? (near ? 0.16 : 0.28) : 0.85, flare: foot ? (near ? 0.4 : 0.62) : 0.95,
        pool: 0, seed: 30 + sx * 3 + sz, segX: 150, segY: 110, uv01: true, jitter: 1.1,
      });
      const m = mesh(cg, sz > 0 ? drape : drape2, sx * (hw + 0.045), ty + 0.04, sz * (hl - 0.02), g);
      m.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      if ((sx > 0) !== (sz > 0)) m.scale.x = -1;
      m.name = 'cloth';
      if (foot) {
        // the cord that holds it to the post (a loop round the gathered waist)
        const wi = cg.userData.waist;
        const pts = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; pts.push(V3(Math.cos(a) * (wi.w * 0.5 + 0.015) + wi.w * 0.5, 0, Math.sin(a) * 0.06 + 0.02)); }
        const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 48, 0.007, 6, true), mats.gilt);
        cord.position.y = wi.y; m.add(cord);
      }
    }
    // rags: long strips torn from the hangings, still hanging from the tester rail behind the valance,
    // each twisting a little as it falls, ending in a ragged point
    if (mats.drapeStrip) {
      const SW = 0.16, SL = 1.4;
      const rag = (seed, len) => {
        const sg = new THREE.PlaneGeometry(SW, SL, 8, 60); sg.translate(0, -SL / 2, 0);
        const p = sg.attributes.position;
        const r = (k) => { const x = Math.sin(k * 91.7 + seed * 13.3) * 43758.5453; return x - Math.floor(x); };
        const tw = (r(1) - 0.5) * 1.6, sw = 0.03 + r(2) * 0.05;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i);
          const t = -y / SL;                                    // 0 top .. 1 tip
          const a = tw * t * t;                                 // the twist grows down the rag
          const cup = 0.02 * (1 - (2 * x / SW) ** 2) * (0.4 + 0.6 * t);       // the cloth cups across its width
          const z0 = cup + sw * Math.sin(t * Math.PI * 0.9) + 0.015 * Math.sin(t * 9 + seed);
          p.setXYZ(i, x * Math.cos(a) - z0 * Math.sin(a), y * len / SL, x * Math.sin(a) + z0 * Math.cos(a));
        }
        sg.computeVertexNormals();
        return sg;
      };
      // [x, z, rotY, length, seed] in the bed frame (the -x side faces the room)
      for (const [x, z, ry, len, sd] of [[-hw - 0.02, 0.35, -Math.PI / 2, 1.25, 1], [-hw - 0.02, -0.25, -Math.PI / 2 + 0.2, 0.95, 2], [0.35, hl + 0.02, 0.15, 1.15, 3], [-0.42, hl + 0.02, -0.1, 0.8, 4]]) {
        const m = mesh(rag(sd, len), mats.drapeStrip, x, ty - 0.06, z, g); m.rotation.y = ry; m.name = 'cloth';
      }
    }
  }
  g.userData = { mattressTop: mTop, L, W, postH };
  return g;
}

// ============================================================================ chest
/**
 * Heirloom blanket chest with the knights board carved into its lid. Local: long axis X, front +Z,
 * floor y=0. userData: { boardTop, w, d, fieldSize }.
 * Bun feet, a moulded plinth, three carved-rosette panels front and back, wrought-iron strap hinges
 * that run from the back over the lid, iron corner brackets, a big brass escutcheon with a hasp.
 * The board: 25 sunk squares (boxwood / rosewood, grain turned square to square) inside a raised,
 * bevelled frame that carries the carved acanthus border (the lid texture), 3 mm above the squares.
 */
export function buildChest(ctx, mats, { w = 1.18, d = 0.58, h = 0.56, fieldSize = 0.4168 } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group(); g.name = 'chest';
  const footH = 0.06;
  // bun feet (smooth, 48 segments) under a moulded plinth
  const foot = lathe(G, [[0, 0], [0.03, 0.0], [0.05, 0.012], [0.056, 0.03], [0.05, 0.046], [0.034, 0.054], [0.03, 0.06], [0, 0.06]], 48);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(foot, mats.walnut, sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05), g);
  const plinthY = footH;
  mesh(rbox(G, w + 0.05, 0.06, d + 0.05, 0.012), mats.walnut, 0, plinthY + 0.03, 0, g);
  mesh(rbox(G, w + 0.02, 0.02, d + 0.02, 0.008), mats.walnut, 0, plinthY + 0.07, 0, g);
  const bodyY0 = plinthY + 0.06;
  const bodyH = h - bodyY0 - 0.075;
  mesh(rbox(G, w, bodyH, d, 0.012), mats.walnut, 0, bodyY0 + bodyH / 2, 0, g);
  // carved front/back panels, each with a rosette boss in its field
  const rose = carvedRosette(0.055);
  for (const sz of [-1, 1]) for (let i = 0; i < 3; i++) {
    const px = (i - 1) * (w / 3);
    const p = mesh(G.raisedPanel(w / 3 - 0.08, bodyH - 0.08, { border: 0.035, bevel: 0.03, fieldDepth: 0.01 }), mats.walnut, px, bodyY0 + bodyH / 2, sz * (d / 2 + 0.002), g);
    if (sz < 0) p.rotation.y = Math.PI;
    if (sz > 0 && i !== 1) { const r = mesh(rose, mats.walnut, px, bodyY0 + bodyH / 2, d / 2 + 0.012, g); r.rotation.x = Math.PI / 2; r.scale.set(1, 1.8, 1); }
  }
  for (const sx of [-1, 1]) {
    const p = mesh(G.raisedPanel(d - 0.1, bodyH - 0.08, { border: 0.035, bevel: 0.03 }), mats.walnut, sx * (w / 2 + 0.002), bodyY0 + bodyH / 2, 0, g);
    p.rotation.y = sx * Math.PI / 2;
    // iron drop handles on shaped back-plates
    const hdl = mesh(new THREE.TorusGeometry(0.055, 0.0075, 10, 28, Math.PI), mats.iron, sx * (w / 2 + 0.032), bodyY0 + bodyH * 0.6, 0, g);
    hdl.rotation.set(0, sx * Math.PI / 2, Math.PI);
    const bp = mesh(rbox(G, 0.008, 0.06, 0.15, 0.003), mats.iron, sx * (w / 2 + 0.012), bodyY0 + bodyH * 0.64, 0, g); void bp;
    for (const dz of [-0.055, 0.055]) mesh(new THREE.SphereGeometry(0.009, 12, 8), mats.iron, sx * (w / 2 + 0.018), bodyY0 + bodyH * 0.64, dz, g);
  }
  // iron corner brackets up every vertical edge, clenched with domed nails
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const [ox, oz, rw, rd] of [[0, 0.006, 0.075, 0.006], [0.006, 0, 0.006, 0.075]]) {
      mesh(rbox(G, rw, bodyH + 0.06, rd, 0.002), mats.iron, sx * (w / 2 - (rw > 0.01 ? rw / 2 : -ox)), bodyY0 + bodyH / 2 + 0.01, sz * (d / 2 - (rd > 0.01 ? rd / 2 : -oz)), g);
    }
    for (let k = 0; k < 3; k++) {
      const y = bodyY0 + 0.04 + k * (bodyH - 0.06) / 2;
      mesh(new THREE.SphereGeometry(0.0065, 10, 6), mats.iron, sx * (w / 2 - 0.035), y, sz * (d / 2 + 0.008), g);
      mesh(new THREE.SphereGeometry(0.0065, 10, 6), mats.iron, sx * (w / 2 + 0.008), y, sz * (d / 2 - 0.035), g);
    }
  }
  // moulded lid
  const lidY = bodyY0 + bodyH;
  mesh(rbox(G, w + 0.05, 0.075, d + 0.05, 0.02, 3), mats.walnut, 0, lidY + 0.0375, 0, g);
  const topY = lidY + 0.0752;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.03, d + 0.03).rotateX(-Math.PI / 2), mats.board);
  top.position.y = topY; top.name = 'boardTop'; g.add(top);
  const boardTop = topY + 0.0003;
  // ---- the board: sunk squares inside a raised bevelled frame
  {
    const sq = fieldSize / 5;
    const tile = rbox(G, sq - 0.0016, 0.006, sq - 0.0016, 0.0012, 2, 1);
    const tileR = tile.clone(); tileR.rotateY(Math.PI / 2);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const light = (r + c) % 2 === 0;
      const t = mesh(light ? tile : tileR, light ? mats.boardLight : mats.boardDark, (c - 2) * sq, boardTop - 0.003, (r - 2) * sq, g);
      // each square cut from a different part of the plank
      t.userData.uvShift = r * 5 + c;
    }
    // frame: square ring, outer = carved border extent, inner = the field; bevelled inner lip
    const half = fieldSize / 2, outer = 0.41 * (d + 0.03);
    const ring = new THREE.Shape(); ring.moveTo(-outer, -outer); ring.lineTo(outer, -outer); ring.lineTo(outer, outer); ring.lineTo(-outer, outer); ring.lineTo(-outer, -outer);
    const hole = new THREE.Path(); hole.moveTo(-half, -half); hole.lineTo(-half, half); hole.lineTo(half, half); hole.lineTo(half, -half); hole.lineTo(-half, -half);
    ring.holes.push(hole);
    const fg = new THREE.ExtrudeGeometry(ring, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0055, bevelSegments: 2, curveSegments: 4 });     // chamfered lip: the field reads as sunk into the lid
    fg.rotateX(-Math.PI / 2);
    // lid uv (same mapping as the top plane) so the carved border texture lands on the frame
    const fp = fg.attributes.position, fu = fg.attributes.uv;
    for (let i = 0; i < fp.count; i++) fu.setXY(i, 0.5 + fp.getX(i) / (w + 0.03), 0.5 - fp.getZ(i) / (d + 0.03));
    fg.computeVertexNormals();
    mesh(fg, mats.board, 0, boardTop - 0.0002, 0, g).name = 'boardFrame';
  }
  // a carved bead-and-cove moulding framing the board recess, so the board sits *in* the lid
  {
    const o = 0.41 * (d + 0.03) + 0.012;
    const prof = [V2(-0.012, 0)]; for (let i = 0; i <= 10; i++) { const a = Math.PI - (i / 10) * Math.PI; prof.push(V2(-0.004 + Math.cos(a) * 0.008, 0.002 + Math.sin(a) * 0.008)); }
    prof.push(V2(0.006, 0.004), V2(0.012, 0.0015), V2(0.016, 0));
    const loop = [V3(-o, topY, -o), V3(o, topY, -o), V3(o, topY, o), V3(-o, topY, o)];
    mesh(G.sweepProfile(prof, loop, { closed: true, uvScale: 2 }), mats.walnut, 0, 0, 0, g);
  }
  // carved rosettes in the lid fields either side of the board
  {
    const roseX = 0.705 * (d + 0.03);
    const rg = carvedRosette(0.08);
    for (const sx of [-1, 1]) mesh(rg, mats.walnut, sx * roseX, topY, 0, g);
  }
  // wrought-iron strap hinges: down the back, over the lid edge and two-thirds across the top,
  // ending in a spear-and-scroll terminal; clenched with domed nails
  for (const sx of [-1, 1]) {
    const x = sx * 0.545;
    const len = (d + 0.05) * 0.68;
    const strap = new THREE.Shape();
    const sw = 0.018;
    strap.moveTo(-sw, 0); strap.lineTo(sw, 0); strap.lineTo(sw * 0.7, len - 0.05);
    strap.quadraticCurveTo(sw * 2.4, len - 0.035, sw * 1.2, len - 0.01); strap.lineTo(0, len + 0.012); strap.lineTo(-sw * 1.2, len - 0.01);
    strap.quadraticCurveTo(-sw * 2.4, len - 0.035, -sw * 0.7, len - 0.05); strap.lineTo(-sw, 0);
    const sg = new THREE.ExtrudeGeometry(strap, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 1, curveSegments: 8 });
    sg.rotateX(-Math.PI / 2);
    const st = mesh(sg, mats.iron, x, topY + 0.0004, -(d + 0.05) / 2 + 0.004, g);
    st.scale.z = -1;
    // knuckle + back leaf down the back face
    mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.06, 14).rotateZ(Math.PI / 2), mats.iron, x, lidY + 0.005, -(d + 0.05) / 2 - 0.004, g);
    mesh(rbox(G, 0.036, 0.16, 0.004, 0.0015), mats.iron, x, lidY - 0.075, -d / 2 - 0.004, g);
    for (let k = 0; k < 4; k++) mesh(new THREE.SphereGeometry(0.0055, 10, 6), mats.iron, x, topY + 0.004, -(d + 0.05) / 2 + 0.03 + k * (len - 0.07) / 3, g);
  }
  // big shaped brass escutcheon with a keyhole, and the hinged iron hasp dropping from the lid
  {
    const e = new THREE.Shape();
    const k = 1.15;
    e.moveTo(0, 0.065 * k); e.quadraticCurveTo(0.03 * k, 0.065 * k, 0.045 * k, 0.04 * k); e.quadraticCurveTo(0.068 * k, 0.0, 0.045 * k, -0.04 * k); e.quadraticCurveTo(0.03 * k, -0.065 * k, 0, -0.075 * k);
    e.quadraticCurveTo(-0.03 * k, -0.065 * k, -0.045 * k, -0.04 * k); e.quadraticCurveTo(-0.068 * k, 0.0, -0.045 * k, 0.04 * k); e.quadraticCurveTo(-0.03 * k, 0.065 * k, 0, 0.065 * k);
    const kh = new THREE.Path(); kh.absarc(0, -0.01, 0.009, 0, Math.PI * 2, true); e.holes.push(kh);
    const eg = new THREE.ExtrudeGeometry(e, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.0025, bevelSegments: 2, curveSegments: 12 });
    const ey = bodyY0 + bodyH - 0.085;
    mesh(eg, mats.brassOld || mats.brass, 0, ey, d / 2 + 0.003, g);
    mesh(new THREE.BoxGeometry(0.006, 0.02, 0.004), mats.black, 0, ey - 0.022, d / 2 + 0.0075, g);
    mesh(new THREE.CircleGeometry(0.0085, 16), mats.black, 0, ey - 0.01, d / 2 + 0.0058, g);
    // hasp: hinged at the lid edge, hanging over the staple
    const hasp = new THREE.Shape(); hasp.moveTo(-0.017, 0); hasp.lineTo(0.017, 0); hasp.lineTo(0.017, -0.09); hasp.quadraticCurveTo(0, -0.115, -0.017, -0.09); hasp.lineTo(-0.017, 0);
    const hs = new THREE.Path(); hs.moveTo(-0.006, -0.055); hs.lineTo(0.006, -0.055); hs.lineTo(0.006, -0.08); hs.lineTo(-0.006, -0.08); hs.lineTo(-0.006, -0.055); hasp.holes.push(hs);
    const hg = new THREE.ExtrudeGeometry(hasp, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 });
    mesh(hg, mats.iron, 0, lidY + 0.05, d / 2 + 0.028, g).rotation.x = 0.05;
    mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.045, 12).rotateZ(Math.PI / 2), mats.iron, 0, lidY + 0.052, d / 2 + 0.03, g);
    mesh(new THREE.TorusGeometry(0.008, 0.0025, 6, 14, Math.PI), mats.iron, 0, lidY - 0.01, d / 2 + 0.006, g);
  }
  g.userData = { boardTop, w, d, fieldSize };
  return g;
}

/**
 * Carved Tudor-style rosette, smooth: a 64-segment lathe whose radius and height are modulated
 * into 8 domed outer petals with grooves between them, 8 inner petals offset by half a petal, and a
 * domed boss with a ring. Lies on y = 0, faces +Y, radius r. Normals are smooth (welded).
 */
function carvedRosette(r, relief = 1.7) {
  const seg = 96, rings = 34;
  const pos = [], idx = [], uv = [];
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;                               // 0 centre .. 1 rim
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const outer = Math.pow(Math.abs(Math.cos(a * 4)), 0.8);              // 8 petals
      const inner = Math.pow(Math.abs(Math.cos(a * 4 + Math.PI / 4 * 2)), 0.8);
      let rr = t * r, y;
      if (t < 0.22) { y = r * 0.22 * Math.sqrt(Math.max(0, 1 - (t / 0.22) ** 2)) + r * 0.08; }                          // boss
      else if (t < 0.28) { y = r * 0.06 + r * 0.03 * Math.sin((t - 0.22) / 0.06 * Math.PI); }                           // ring
      else if (t < 0.6) { const k = (t - 0.28) / 0.32; y = r * (0.05 + 0.12 * Math.sin(k * Math.PI) * (0.35 + 0.65 * inner)); }   // inner petals
      else { const k = (t - 0.6) / 0.4; rr = r * (0.6 + 0.4 * k * (0.86 + 0.14 * outer)); y = r * (0.03 + 0.14 * Math.sin(Math.min(1, k * 1.1) * Math.PI) * (0.25 + 0.75 * outer)) * (1 - k * k * 0.3); }
      if (j === rings) y = 0;
      y *= relief;
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      uv.push(Math.cos(a) * rr * 4 + 0.5, Math.sin(a) * rr * 4 + 0.5);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    const a = j * (seg + 1) + i, b = a + seg + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // the seam column (i = 0 / i = seg) has duplicate vertices: average their normals
  const n = geo.attributes.normal;
  for (let j = 0; j <= rings; j++) {
    const a = j * (seg + 1), b = a + seg;
    const x = (n.getX(a) + n.getX(b)) / 2, y = (n.getY(a) + n.getY(b)) / 2, z = (n.getZ(a) + n.getZ(b)) / 2;
    const l = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
  return geo;
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
  // soot: the upper firebox and the throat blackened, fading down toward the grate
  {
    const sootTex = ctx.textures.canvas('bedroom:soot', 64, 256, (c2, w2, h2) => {
      const gr = c2.createLinearGradient(0, 0, 0, h2); gr.addColorStop(0, 'rgba(0,0,0,0.97)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c2.fillStyle = gr; c2.fillRect(0, 0, w2, h2);
      for (let i = 0; i < 40; i++) { c2.fillStyle = `rgba(0,0,0,${0.1 + (i % 5) * 0.05})`; c2.fillRect((i * 37) % w2, 0, 2 + (i % 3) * 2, h2 * (0.4 + ((i * 13) % 7) / 12)); }
    }, { tile: false });
    const sm = new THREE.MeshBasicMaterial({ map: sootTex, transparent: true, depthWrite: false, color: 0x000000, name: 'sootOverlay' });
    const sb = mesh(new THREE.PlaneGeometry(ow, oh * 0.85), sm, 0, oy + oh - oh * 0.425, depth - fbD + 0.004, g); sb.userData.noShadow = true; sb.renderOrder = 2;
    for (const sx of [-1, 1]) {
      const len = Math.hypot(fbD, 0.1);
      const sc = mesh(new THREE.PlaneGeometry(len, oh * 0.85), sm, sx * (ow / 2 - 0.054), oy + oh - oh * 0.425, depth - fbD / 2, g);
      sc.rotation.y = -sx * (Math.PI / 2 - Math.atan2(0.1, fbD)); sc.userData.noShadow = true; sc.renderOrder = 2;
    }
  }
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
    // scrolled console corbel: a big volute under the shelf, tightening into a small one at the foot
    const cap = new THREE.Shape();
    cap.moveTo(0, 0.2); cap.lineTo(0.215, 0.2); cap.lineTo(0.215, 0.17);
    cap.bezierCurveTo(0.215, 0.13, 0.19, 0.115, 0.165, 0.12);                          // upper volute
    cap.bezierCurveTo(0.13, 0.125, 0.12, 0.09, 0.12, 0.06);                            // concave neck
    cap.bezierCurveTo(0.12, 0.03, 0.105, 0.0, 0.07, 0.0);                              // lower curl
    cap.lineTo(0, 0); cap.lineTo(0, 0.2);
    const cg = new THREE.ExtrudeGeometry(cap, { depth: 0.17, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 3, curveSegments: 16 });
    cg.translate(0, 0, -0.085); cg.rotateY(-Math.PI / 2);
    mesh(G.applyBoxUVs(cg, 1), mats.marble, x, oy + oh + 0.04, z0, g);
    // the volute eyes: carved discs on both faces of the corbel
    for (const sx2 of [-1, 1]) { const vd = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 24).rotateZ(Math.PI / 2), mats.marbleDark, x + sx2 * 0.09, oy + oh + 0.04 + 0.155, z0 + 0.175, g); void vd; }
    // a pendant drop with an acanthus-like bead under the corbel
    mesh(G.latheFromProfile([[0, 0], [0.025, -0.01], [0.03, -0.03], [0.02, -0.05], [0.008, -0.07], [0, -0.075]], 20), mats.marble, x, oy + oh + 0.04, z0 + 0.06, g);
  }
  mesh(rbox(G, ow + 0.24, 0.22, 0.14, 0.01), mats.marble, 0, oy + oh + 0.13, z0 + 0.06, g);
  // carved central tablet
  mesh(rbox(G, 0.32, 0.13, 0.03, 0.008), mats.marbleDark, 0, oy + oh + 0.13, z0 + 0.14, g);
  const shelfY = oy + oh + 0.26;
  {
    // shelf with a proper moulded edge: fillet, cyma-recta ogee, a square nosing on top
    const prof = [[0, 0], [0.255, 0], [0.262, 0.004], [0.262, 0.01]];
    for (let i = 1; i <= 12; i++) { const t = i / 12; prof.push([0.262 + 0.068 * (t + 0.12 * Math.sin(2 * Math.PI * t)), 0.01 + 0.045 * (0.5 - 0.5 * Math.cos(Math.PI * t))]); }
    prof.push([0.342, 0.06], [0.342, 0.078], [0.335, 0.082], [0, 0.082]);
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
    mesh(G.sweepProfile(prof, p, { uvScale: 2 }), mats.brassDull || mats.brassOld || mats.brass, 0, -0.02, 0, g);
  }
  // grate, coals, logs, flames
  const fz = depth - fbD * 0.45;
  {
    for (let i = -4; i <= 4; i++) mesh(new THREE.BoxGeometry(0.012, 0.012, 0.22), mats.castIron, i * 0.06, 0.16, fz, g);
    for (const k of [0, 1, 2]) mesh(new THREE.BoxGeometry(0.56, 0.012, 0.012), mats.castIron, 0, 0.16 + k * 0.06, fz + 0.11, g);
    for (const sx of [-1, 1]) mesh(rbox(G, 0.03, 0.3, 0.03, 0.006), mats.castIron, sx * 0.3, 0.15, fz + 0.11, g);
    // (blackened iron finials: polished brass this close to the fire light read as two floating orbs)
    for (const sx of [-1, 1]) mesh(G.latheFromProfile([[0, 0], [0.018, 0.0], [0.022, 0.012], [0.012, 0.03], [0.006, 0.045], [0, 0.05]], 16), mats.castIron, sx * 0.3, 0.3, fz + 0.11, g);
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
  const cards = [[0, 0.62, 0.5, 0.0, 0.0], [0.6, 0.5, 0.42, 0.04, 2.3], [-0.55, 0.52, 0.38, -0.05, 4.1], [0.25, 0.34, 0.28, -0.12, 7.7], [-0.3, 0.3, 0.24, 0.13, 9.1], [0.05, 0.44, 0.3, 0.02, 11.3]];
  for (const [ry, w, h, dx, sd] of cards) {
    const m = new THREE.Mesh(cardG, fireMat.clone());
    m.material.uniforms.uTime = ctx.time;
    m.material.uniforms.uSeed.value = sd;
    m.scale.set(w, h, 1); m.rotation.y = ry; m.position.set(dx, 0.2, fz);
    m.renderOrder = 10; m.userData.noBake = true; m.userData.noShadow = true; m.frustumCulled = false;
    g.add(m); flames.push(m);
  }
  // a faint, slow smoke sheet curling up into the throat (normal-blended, dark, very transparent)
  {
    const smokeMat = new THREE.ShaderMaterial({
      uniforms: { uTime: ctx.time },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uTime; varying vec2 vUv;
        float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
        void main() {
          vec2 p = vUv; float t = uTime;
          p.x += (fbm(vec2(p.y * 2.0 - t * 0.4, 3.0)) - 0.5) * 0.35 * p.y;
          float n = fbm(vec2(p.x * 3.0, p.y * 2.2 - t * 0.55));
          float a = smoothstep(0.45, 0.8, n) * smoothstep(0.0, 0.35, p.y) * (1.0 - smoothstep(0.6, 1.0, p.y)) * (1.0 - smoothstep(0.25, 0.5, abs(p.x - 0.5)));
          gl_FragColor = vec4(vec3(0.05, 0.045, 0.04), a * 0.35);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const sm = mesh(new THREE.PlaneGeometry(0.6, 0.6), smokeMat, 0, 0.62, fz - 0.02, g);
    sm.renderOrder = 9; sm.userData.noBake = true; sm.userData.noShadow = true; sm.frustumCulled = false;
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
    uniforms: { uTime: timeUniform || { value: 0 }, uSeed: { value: 0 }, uIntensity: { value: 1.45 } },
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
        // the whole sheet licks sideways, more toward the tips
        p.x += (fbm(vec2(p.y * 2.5 - t * 1.3, uSeed * 1.7)) - 0.5) * 0.22 * p.y;
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
        // deep red licks -> orange body -> a capped amber core (never white: it would blow out and bloom)
        vec3 col = mix(vec3(0.42, 0.045, 0.008), vec3(0.95, 0.3, 0.045), smoothstep(0.0, 0.25, e));
        col = mix(col, vec3(1.0, 0.5, 0.13), core * 0.75);
        col = mix(col, vec3(0.3, 0.025, 0.004), smoothstep(0.12, 0.0, e) * a);
        // internal turbulence: darker cells drifting up through the sheet so it has body, not a flat card
        col *= 0.7 + 0.45 * smoothstep(0.3, 0.7, fbm(vec2(p.x * 7.0 + uSeed * 3.0, p.y * 5.0 - t * 3.3)));
        // tips cool and thin out into soot
        col *= 1.0 - 0.55 * smoothstep(0.45, 0.95, p.y);
        // blue-ish roots right at the coals
        col = mix(col, vec3(0.35, 0.3, 0.6), smoothstep(0.08, 0.0, p.y) * 0.5 * a);
        float alpha = a * smoothstep(0.0, 0.05, p.y) * smoothstep(0.3, 0.8, vFace);
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
        gl_PointSize = (5.0 + aSeed.w * 6.0) * (300.0 / -mv.z) * 0.02;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      // motion-stretched spark: a thin vertical streak, hot head at the top, cooling tail below
      void main() { vec2 d = gl_PointCoord - 0.5;
        float w = smoothstep(0.07, 0.0, abs(d.x)) ;
        float along = smoothstep(0.5, 0.15, abs(d.y)) * (0.35 + 0.65 * smoothstep(0.4, -0.3, d.y));
        float a = w * along; if (a < 0.01) discard;
        gl_FragColor = vec4(mix(vec3(1.0, 0.3, 0.05), vec3(1.0, 0.75, 0.35), smoothstep(0.2, -0.3, d.y)) * 3.0 * vA * a, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.userData.noBake = true; pts.userData.noShadow = true; pts.renderOrder = 11;
  return pts;
}

// ============================================================================ vanity
/** Impact point (uv over the glass) and the radial crack angles of the broken vanity mirror. */
export const MIRROR_IMPACT = [0.62, 0.6];
export const MIRROR_ANGLES = [0.42, 1.38, 2.3, 3.05, 4.1, 5.15];
/** Voronoi sites (uv over the glass) of the mirror's shards: crowded round the impact, larger toward the frame. */
export const MIRROR_SEEDS = [[0.61, 0.61], [0.71, 0.53], [0.53, 0.5], [0.76, 0.76], [0.46, 0.8], [0.88, 0.36], [0.24, 0.6], [0.3, 0.2], [0.66, 0.14], [0.9, 0.92]];
/** Clip a convex polygon (array of Vector2) by the half-plane dot(p - o, n) <= 0. */
function clipPoly(poly, o, n) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = (a.x - o.x) * n.x + (a.y - o.y) * n.y, db = (b.x - o.x) * n.x + (b.y - o.y) * n.y;
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push(new THREE.Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)); }
  }
  return out;
}
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
  // the glass is broken into irregular Voronoi shards (crowded round the impact), each knocked
  // 0.5-2 degrees out of true so it throws its own piece of the room back; the seams between them
  // are hairline gaps onto the dark backing board
  const mirror = new THREE.Group(); mirror.name = 'mirror'; mg.add(mirror);
  {
    const W2 = (mw + 0.01) / 2, H2 = (mh + 0.01) / 2;
    const sites = MIRROR_SEEDS.map(([u, v]) => new THREE.Vector2((u - 0.5) * W2 * 2, (v - 0.5) * H2 * 2));
    const rect = [new THREE.Vector2(-W2, -H2), new THREE.Vector2(W2, -H2), new THREE.Vector2(W2, H2), new THREE.Vector2(-W2, H2)];
    sites.forEach((sp, k) => {
      let poly = rect.map((q) => q.clone());
      for (let j = 0; j < sites.length; j++) {
        if (j === k) continue;
        const o = sp.clone().add(sites[j]).multiplyScalar(0.5), n = sites[j].clone().sub(sp).normalize();
        poly = clipPoly(poly, o, n);
      }
      if (poly.length < 3) return;
      const c = poly.reduce((acc, q) => acc.add(q), new THREE.Vector2()).multiplyScalar(1 / poly.length);
      // pull each edge in a hair (0.4 mm) so the seams open onto black
      const shrunk = poly.map((q) => { const d = q.clone().sub(c); const l = d.length(); return c.clone().add(d.multiplyScalar(Math.max(0, l - 0.0004) / l)); });
      const sg = new THREE.ShapeGeometry(new THREE.Shape(shrunk.map((q) => new THREE.Vector2(q.x - c.x, q.y - c.y))));
      const sp2 = sg.attributes.position, su = sg.attributes.uv;
      for (let i = 0; i < sp2.count; i++) su.setXY(i, (sp2.getX(i) + c.x) / (W2 * 2) + 0.5, (sp2.getY(i) + c.y) / (H2 * 2) + 0.5);
      const shard = mesh(sg, mats.mirror, c.x, c.y, 0.006 + (k % 3) * 0.0007, mirror);
      const ax = ((k * 2.39) % 6.283), deg = (0.5 + ((k * 0.61) % 1.5)) * Math.PI / 180;
      shard.quaternion.setFromAxisAngle(V3(Math.cos(ax), Math.sin(ax), 0), deg);
      shard.name = 'mirrorShard';
    });
    // black backing board seen through the seams
    mesh(new THREE.PlaneGeometry(W2 * 2, H2 * 2), mats.black, 0, 0, 0.003, mirror);
  }
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

// ============================================================================ dolls (see doll.js)
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
    // a proper 45 mm leaf: stiles and rails, two fielded panels each framed by a bolection moulding
    mesh(rbox(G, dw - 0.005, dh, 0.045, 0.012, 3), mats.mahogany, 0, dh / 2, 0, leaf);
    // a cock-bead run round the leaf's edge (catches the light on the edge when the door stands open)
    { const bw = (dw - 0.005) / 2 - 0.004, bh = dh / 2 - 0.004;
      for (const zf of [0.0235, -0.0235]) mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-bw, -bh, 0), V3(bw, -bh, 0), V3(bw, bh, 0), V3(-bw, bh, 0)], true, 'catmullrom', 0.0), 64, 0.004, 6, true), mats.rail || mats.mahogany, 0, dh / 2, zf, leaf); }
    for (const [py, ph, bd] of [[dh * 0.62, dh * 0.62, 0.05], [dh * 0.16, dh * 0.25, 0.04]]) {
      mesh(G.raisedPanel(dw - 0.12, ph, { border: bd, bevel: 0.035 }), mats.panel, 0, py, 0.0225, leaf);
      mesh(G.frameGeometry(dw - 0.12, ph, { width: 0.022, depth: 0.014, uvScale: 1 }), mats.mahogany, 0, py, 0.0225, leaf);
    }
    // three brass butt hinges on the hanging stile: leaves on the edge + a knuckle with a finial pin
    for (const hy of [0.12, dh * 0.5, dh - 0.12]) {
      const hx = sx * (dw / 2 - 0.0025);
      mesh(rbox(G, 0.004, 0.1, 0.034, 0.001), mats.brassOld || mats.brass, hx, hy, 0.0, leaf);
      mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.1, 16), mats.brassOld || mats.brass, hx + sx * 0.005, hy, 0.026, leaf);
      for (const k of [-1, 0, 1]) mesh(new THREE.TorusGeometry(0.0086, 0.0012, 4, 16).rotateX(Math.PI / 2), mats.brassOld || mats.brass, hx + sx * 0.005, hy + k * 0.033, 0.026, leaf);
      for (const e of [-1, 1]) mesh(G.latheFromProfile([[0, 0], [0.0085, 0], [0.006, 0.006], [0.002, 0.012], [0, 0.013]], 12), mats.brassOld || mats.brass, hx + sx * 0.005, hy + e * 0.05, 0.026, leaf).rotation.x = e < 0 ? Math.PI : 0;
    }
    // the latch: a keeper plate on the meeting stile (left leaf) and the bolt housing (right leaf)
    if (sx < 0) mesh(rbox(G, 0.018, 0.11, 0.004, 0.0015), mats.brass, -sx * (dw / 2 - 0.012), dh * 0.48, 0.024, leaf);
    else { mesh(rbox(G, 0.02, 0.06, 0.012, 0.002), mats.brass, -sx * (dw / 2 - 0.014), dh * 0.48, 0.028, leaf); mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.012, 10).rotateX(Math.PI / 2), mats.black, -sx * (dw / 2 - 0.014), dh * 0.48 - 0.018, 0.035, leaf); }
    // inside face of the leaf
    for (const [py, ph] of [[dh * 0.62, dh * 0.62], [dh * 0.16, dh * 0.25]]) {
      mesh(G.raisedPanel(dw - 0.12, ph, { border: 0.045, bevel: 0.03 }), mats.walnut, 0, py, -0.0225, leaf).rotation.y = Math.PI;
      mesh(G.frameGeometry(dw - 0.12, ph, { width: 0.02, depth: 0.012, uvScale: 1 }), mats.walnut, 0, py, -0.0225, leaf).rotation.y = Math.PI;
    }
    // a brass coat hook on the inside of each leaf
    { const hk = []; for (let i = 0; i <= 16; i++) { const t = i / 16; hk.push(V3(0, -0.04 * Math.sin(t * Math.PI * 1.2) - t * 0.01, -0.06 * t)); }
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hk), 24, 0.004, 6, false), mats.brassOld || mats.brass, 0, dh * 0.86, -0.024, leaf);
      mesh(rbox(G, 0.025, 0.04, 0.004, 0.0015), mats.brassOld || mats.brass, 0, dh * 0.86, -0.0245, leaf); }
    mesh(lathe(G, [[0, 0], [0.012, 0], [0.016, 0.02], [0.008, 0.035], [0, 0.04]], 12).rotateX(Math.PI / 2), mats.brass, -sx * (dw / 2 - 0.05), dh * 0.48, 0.0225, leaf);
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
    // nosing: bullnose, worn down in the middle where feet have gone
    const nose = new THREE.CylinderGeometry(0.018, 0.018, w - 0.06, 12, 8).rotateZ(Math.PI / 2);
    { const p = nose.attributes.position; for (let k = 0; k < p.count; k++) { const xx = p.getX(k) / ((w - 0.06) / 2); const wear = Math.exp(-xx * xx * 4) * 0.006; if (p.getY(k) > 0 || p.getZ(k) > 0) { p.setY(k, p.getY(k) - wear * Math.max(0, p.getY(k) / 0.018)); p.setZ(k, p.getZ(k) - wear * Math.max(0, p.getZ(k) / 0.018)); } } nose.computeVertexNormals(); }
    mesh(nose, mats.atticBoard, 0, y - 0.018, z + 0.01, g);
    // dust banked in the back corners of every tread (clean where feet have gone up the middle)
    const dm = mats.stairDust || (mats.stairDust = new THREE.MeshStandardMaterial({ map: ctx.textures.canvas('bedroom:stairdust', 128, 32, (c2, w2, h2) => {
      const img = c2.createImageData(w2, h2);
      for (let j = 0; j < h2; j++) for (let k2 = 0; k2 < w2; k2++) { const u = k2 / (w2 - 1), v = j / (h2 - 1); const side = Math.max(0, 1 - Math.min(u, 1 - u) * 4.5); const back = 1 - v; const a = Math.min(1, back * back * 0.8 + side * 0.9) * (0.75 + 0.25 * Math.sin(k2 * 1.7 + j * 2.3)); const q = (k2 + j * w2) * 4; img.data[q] = 150; img.data[q + 1] = 146; img.data[q + 2] = 138; img.data[q + 3] = Math.round(255 * a); }
      c2.putImageData(img, 0, 0);
    }, { tile: false }), transparent: true, depthWrite: false, roughness: 1, metalness: 0, name: 'stairDust' }));
    const dp = mesh(new THREE.PlaneGeometry(w - 0.07, going * 0.9).rotateX(-Math.PI / 2), dm, 0, y + 0.0005, z - going / 2 - 0.0, g);
    dp.userData.noShadow = true; dp.renderOrder = 2;
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
  const spot = new THREE.SpotLight(0x9fb4ff, 110, 9, 0.5, 0.6, 1.6);
  spot.position.set(0.2, roofY + 0.5, endZ - 0.2);
  spot.target.position.set(0, y0, z0 + 0.2);
  spot.castShadow = ctx.quality.shadows;
  spot.shadow.mapSize.set(512, 512); spot.shadow.bias = -0.002; spot.shadow.normalBias = 0.02; spot.shadow.radius = 4;
  spot.shadow.camera.near = 0.3; spot.shadow.camera.far = 9;
  g.add(spot, spot.target);
  // soft cold fill so the stairwell is not a black hole
  const fill = new THREE.PointLight(0x7f95d8, 4.0, 4.5, 2); fill.position.set(0, topY - 0.3, endZ + 1.0); g.add(fill);
  g.userData = { light: spot, fill, topY, endZ, roofY, z0 };
  return g;
}

// ============================================================================ sconce
/** Etched-glass tulip texture (canvas): frosted ground with clear etched garlands; brighter in the middle. */
export function etchedGlassTex(ctx) {
  return ctx.textures.canvas('bedroom:etched', 256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6a5a48'); gr.addColorStop(0.45, '#fff2dc'); gr.addColorStop(0.75, '#e8d4b4'); gr.addColorStop(1, '#5a4a3a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,30,20,0.55)'; g.lineWidth = 2;
    for (let k = 0; k < 6; k++) {               // garland swags and drops (clear glass reads darker)
      const x0 = (k / 6) * w;
      g.beginPath(); g.moveTo(x0, h * 0.42); g.quadraticCurveTo(x0 + w / 12, h * 0.58, x0 + w / 6, h * 0.42); g.stroke();
      g.beginPath(); g.arc(x0 + w / 12, h * 0.3, 6, 0, 7); g.stroke();
      for (let j = 0; j < 5; j++) { g.beginPath(); g.ellipse(x0 + w / 12 + Math.cos(j * 1.26) * 10, h * 0.3 + Math.sin(j * 1.26) * 10, 5, 2.5, j * 1.26, 0, 7); g.stroke(); }
    }
    g.fillStyle = 'rgba(40,30,20,0.4)'; g.fillRect(0, h * 0.86, w, 4); g.fillRect(0, h * 0.12, w, 3);
  }, { tile: true });
}

/**
 * Brass gas wall sconce: oval backplate with a beaded rim and boss, gas cock, a scrolled arm, a
 * burner gallery and an etched-glass tulip shade with a small live flame inside. Local: wall at
 * z = 0, faces +Z; the burner sits at (0, 0, out). userData: { flamePos: Vector3 (local), flame }
 */
export function buildSconce(ctx, mats, { out = 0.2, seed = 1 } = {}) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'sconce';
  const B = mats.brassOld || mats.brass;
  // backplate
  const plate = G.latheFromProfile([[0, 0], [0.055, 0], [0.058, 0.004], [0.052, 0.012], [0.034, 0.018], [0.016, 0.024], [0, 0.026]], 48);
  plate.rotateX(Math.PI / 2); plate.scale(0.78, 1.25, 1);
  const pm = mesh(plate, B, 0, -0.03, 0, g);
  const bead = new THREE.TorusGeometry(0.05, 0.004, 8, 48); bead.scale(0.78, 1.25, 1);
  mesh(bead, B, 0, -0.03, 0.006, g);
  mesh(new THREE.SphereGeometry(0.012, 16, 10), B, 0, -0.03, 0.026, g);
  // gas cock with its key
  mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 14).rotateX(Math.PI / 2), B, 0, -0.03, 0.04, g);
  mesh(rbox(G, 0.035, 0.006, 0.006, 0.002), B, 0, -0.03, 0.05, g).rotation.z = 0.4;
  // scrolled arm: out from the cock, dipping, then rising to the burner
  const arm = new THREE.CubicBezierCurve3(V3(0, -0.03, 0.045), V3(0, -0.12, 0.09), V3(0, -0.07, out - 0.02), V3(0, 0.0, out));
  mesh(new THREE.TubeGeometry(arm, 48, 0.0075, 10, false), B, 0, 0, 0, g);
  // decorative C-scroll under the arm
  const sc = []; for (let i = 0; i <= 30; i++) { const t = i / 30; const a = Math.PI * 0.2 + t * Math.PI * 1.5; const r = 0.03 * (1 - t * 0.6); sc.push(V3(0, -0.095 + Math.sin(a) * r, 0.11 + Math.cos(a) * r)); }
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sc), 40, 0.0035, 6, false), B, 0, 0, 0, g);
  // burner + gallery with three claws holding the shade
  mesh(G.latheFromProfile([[0, -0.012], [0.01, -0.012], [0.012, 0.0], [0.03, 0.012], [0.034, 0.02], [0.028, 0.022], [0, 0.016]], 32), B, 0, 0, out, g);
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const c = mesh(rbox(G, 0.004, 0.03, 0.006, 0.0015), B, Math.cos(a) * 0.03, 0.03, out + Math.sin(a) * 0.03, g); c.rotation.y = -a; c.rotation.z = Math.cos(a) * 0.3; }
  // etched tulip shade (glows softly from the flame inside; not a ball of light)
  const shade = mesh(G.latheFromProfile([[0.022, 0.0], [0.034, 0.02], [0.05, 0.05], [0.058, 0.09], [0.055, 0.12], [0.064, 0.14], [0.07, 0.15], [0.066, 0.152]], 40), mats.sconceGlass, 0, 0.02, out, g);
  shade.userData.noShadow = true; shade.renderOrder = 4;
  const fl = ctx.fx.flame({ height: 0.03, width: 0.01, intensity: 7, seed: 60 + seed });
  fl.position.set(0, 0.03, out); g.add(fl);
  g.userData = { flamePos: V3(0, 0.07, out), flame: fl, shade };
  return g;
}

// ============================================================================ armchair
/**
 * Upholstered surface: a sphere pushed out to a rounded box (superellipsoid, exponent e), so it is
 * evenly tessellated across its faces and can be tufted / crowned by `disp(x, y, z) -> [x, y, z]`.
 */
function cushion(G, w, h, d, { e = 0.3, sx = 72, sy = 54, disp = null } = {}) {
  const g = new THREE.SphereGeometry(1, sx, sy);
  const p = g.attributes.position;
  const f = (v) => Math.sign(v) * Math.pow(Math.abs(v), e);
  for (let i = 0; i < p.count; i++) {
    let x = f(p.getX(i)) * w / 2, y = f(p.getY(i)) * h / 2, z = f(p.getZ(i)) * d / 2;
    if (disp) [x, y, z] = disp(x, y, z);
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return G.applyBoxUVs(g, 1);
}

/**
 * Buttoned wing armchair, worn oxblood velvet. Local: floor y=0, faces +Z.
 * Sprung seat frame with a crowned loose cushion, a deep-buttoned arched back (the pile dimpled into
 * diamond tufts round each button), scrolled arms whose rolls end in round scroll faces outlined with
 * piping, shaped wings piped along their front edge, a row of brass nailheads along the seat rail and
 * turned walnut legs on brass castors.
 */
export function buildWingChair(ctx, mats) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'wingchair';
  const v = mats.velvetChair, pipeM = mats.velvetChairPipe || v;
  // ---- legs: turned, on brass cup castors
  const leg = lathe(G, [[0.026, 0.035], [0.022, 0.06], [0.03, 0.1], [0.034, 0.14], [0.026, 0.19], [0.03, 0.22], [0.036, 0.25], [0.036, 0.27], [0, 0.27]], 20);
  const cup = lathe(G, [[0, 0], [0.012, 0], [0.02, 0.012], [0.027, 0.03], [0.027, 0.04], [0, 0.04]], 16);
  for (const sx of [-1, 1]) for (const sz of [-0.29, 0.29]) {
    mesh(leg, mats.walnut, sx * 0.32, 0, sz, g);
    mesh(cup, mats.brassOld || mats.brass, sx * 0.32, 0, sz, g);
    mesh(new THREE.SphereGeometry(0.018, 12, 8), mats.castIron, sx * 0.32, 0.017, sz + 0.01, g);
  }
  // ---- seat frame (the sprung base), a little bowed at the front
  const frame = cushion(G, 0.8, 0.2, 0.74, { e: 0.2, disp: (x, y, z) => [x, y, z + (z > 0 ? 0.025 * (1 - (x / 0.4) ** 2) : 0)] });
  mesh(frame, v, 0, 0.37, 0.02, g);
  // brass nailheads along the bottom of the seat rail
  const nail = new THREE.SphereGeometry(0.0075, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); nail.rotateX(Math.PI / 2);
  for (let i = 0; i <= 26; i++) { const x = -0.36 + (i / 26) * 0.72; mesh(nail, mats.brassOld || mats.brass, x, 0.295, 0.02 + 0.37 + 0.025 * (1 - (x / 0.4) ** 2) - 0.004, g); }
  // piping along the seat rail's top front edge
  {
    const pts = []; for (let i = 0; i <= 40; i++) { const x = -0.38 + (i / 40) * 0.76; pts.push(V3(x, 0.462, 0.02 + 0.355 + 0.025 * (1 - (x / 0.4) ** 2))); }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.008, 8, false), pipeM, 0, 0, 0, g);
  }
  // ---- loose seat cushion: crowned, the front edge rolled, a dent where someone sat
  const seat = cushion(G, 0.56, 0.13, 0.62, { e: 0.32, disp: (x, y, z) => {
    const k = (1 - Math.min(1, (x / 0.28) ** 2)) * (1 - Math.min(1, (z / 0.31) ** 2));
    let yy = y + (y > 0 ? 0.03 * k - 0.022 * Math.exp(-((x + 0.03) ** 2) / 0.02 - ((z + 0.03) ** 2) / 0.03) : 0);
    return [x, yy, z];
  } });
  mesh(seat, v, 0, 0.53, 0.07, g);
  // ---- back: deep-buttoned, arched crest
  {
    const bw = 0.64, bh = 0.84, bd = 0.17;
    const tufts = [];
    for (let r = 0; r < 4; r++) for (let c = -2; c <= 2; c++) { if ((r + c) % 2 !== 0) continue; tufts.push([c * 0.115, -0.22 + r * 0.16]); }
    const bg = cushion(G, bw, bh, bd, { e: 0.3, sx: 96, sy: 80, disp: (x, y, z) => {
      let yy = y, zz = z;
      if (y > 0) yy += 0.07 * Math.cos(Math.min(1, Math.abs(x) / (bw / 2)) * Math.PI / 2) * (y / (bh / 2)) ** 2;     // arched crest
      if (z > 0) {
        zz += 0.02 * (1 - (x / (bw / 2)) ** 2);                    // crowned face
        let dimp = 0; for (const [tx, ty] of tufts) dimp = Math.max(dimp, Math.exp(-((x - tx) ** 2 + (y - ty) ** 2) / 0.0012));
        zz -= 0.028 * dimp * Math.min(1, z / (bd * 0.3));
        // pleats running between the buttons (diagonal creases)
        const dd = Math.min(...tufts.map(([tx, ty]) => Math.abs(Math.abs(x - tx) - Math.abs(y - ty)) + Math.max(Math.abs(x - tx), Math.abs(y - ty)) * 0.0));
        zz -= 0.006 * Math.exp(-dd * dd / 0.0002) * Math.min(1, z / (bd * 0.3)) * (1 - dimp);
      }
      return [x, yy, zz];
    } });
    const back = mesh(bg, v, 0, 0.93, -0.27, g); back.rotation.x = -0.13;
    const bt = new THREE.SphereGeometry(0.012, 12, 8); bt.scale(1, 1, 0.6);
    for (const [tx, ty] of tufts) mesh(bt, mats.buttons, tx, ty, bd / 2 + 0.02 * (1 - (tx / (bw / 2)) ** 2) - 0.022, back);
  }
  // ---- scrolled arms: an extruded roll profile, the front face a round scroll outlined in piping
  for (const sx of [-1, 1]) {
    const pts = [];
    const cx = 0.025, cy = 0.235, r = 0.078;
    pts.push([-0.05, 0.0], [0.045, 0.0], [0.05, 0.16]);
    for (let i = 0; i <= 18; i++) { const a = -Math.PI * 0.32 + (i / 18) * Math.PI * 1.45; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    pts.push([-0.052, 0.2]);
    const shape = new THREE.Shape(pts.map(([x, y]) => V2(x * sx, y)));
    const len = 0.64;
    const ag = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.018, bevelSegments: 5, curveSegments: 24, steps: 1 });
    ag.translate(0, 0, -len / 2);
    // (ExtrudeGeometry re-winds a clockwise outline itself, so the mirrored arm needs nothing extra)
    mesh(G.applyBoxUVs(ag, 1), v, sx * 0.335, 0.44, 0.03, g);
    // round scroll face + spiral piping on the front of the roll
    const fz = 0.03 + len / 2 + 0.026;
    const disc = new THREE.CircleGeometry(r * 0.92, 32);
    mesh(disc, pipeM, sx * (0.335 + cx * sx), 0.44 + cy, fz, g);
    const sp = []; for (let i = 0; i <= 70; i++) { const t = i / 70; const a = t * Math.PI * 2 * 1.6; const rr = r * (1.02 - t * 0.75); sp.push(V3(Math.cos(a) * rr * sx, Math.sin(a) * rr, 0.004 * t)); }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp), 140, 0.0075, 8, false), pipeM, sx * (0.335 + cx * sx), 0.44 + cy, fz, g);
    // piping down the arm front below the roll
    mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.17, 8), pipeM, sx * (0.335 + 0.045 * sx + 0.012 * sx), 0.44 + 0.085, fz - 0.004, g);
  }
  // ---- wings: shaped side panels flaring out from the back, piped along the front edge
  for (const sx of [-1, 1]) {
    const wsh = new THREE.Shape();
    wsh.moveTo(0.0, 0.0); wsh.bezierCurveTo(0.14, 0.02, 0.2, 0.2, 0.16, 0.36); wsh.bezierCurveTo(0.12, 0.5, 0.0, 0.56, -0.12, 0.55); wsh.lineTo(-0.14, 0.0); wsh.lineTo(0, 0);
    const wg = new THREE.ExtrudeGeometry(wsh, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.022, bevelSegments: 5, curveSegments: 28 });
    wg.translate(0, 0, -0.035); wg.rotateY(-Math.PI / 2);          // shape x -> +z (toward the front), extrusion -> x
    const w = mesh(G.applyBoxUVs(wg, 1), v, sx * 0.355, 0.7, -0.24, g); w.rotation.y = sx * 0.22;
    // front-edge piping, sitting on the bevelled edge (outline pushed out along its normal)
    const ep = [];
    const cvs = [new THREE.CubicBezierCurve(V2(0.0, 0.0), V2(0.14, 0.02), V2(0.2, 0.2), V2(0.16, 0.36)), new THREE.CubicBezierCurve(V2(0.16, 0.36), V2(0.12, 0.5), V2(0.0, 0.56), V2(-0.12, 0.55))];
    cvs.forEach((cv, ci) => { for (let i = ci ? 1 : 0; i <= 24; i++) { const q = cv.getPoint(i / 24), t = cv.getTangent(i / 24); ep.push(V3(0, q.y - t.x * 0.02, q.x + t.y * 0.02)); } });
    const pp = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ep), 120, 0.009, 8, false), pipeM, sx * 0.355, 0.7, -0.24, g); pp.rotation.y = sx * 0.22;
  }
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
  // an outer ring of smaller leaves, turned the other way, between the bead ring and the rim
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 + 0.13; const l = lg0.clone(); l.scale(0.55, 0.7, 0.6); l.rotateY(-a + Math.PI); l.translate(Math.cos(a) * 0.5, -0.028, Math.sin(a) * 0.5); parts.push(l); }
  // egg-and-dart on the outer step
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; const e = new THREE.SphereGeometry(0.012, 10, 8); e.scale(1.0, 0.8, 1.5); e.rotateY(-a); e.translate(Math.cos(a) * 0.36, -0.045, Math.sin(a) * 0.36); parts.push(e); }
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
    const tg = new THREE.TubeGeometry(c, 48, 0.017, 12, false); tg.rotateY(-a);
    mesh(tg, B, 0, 0, 0, g);
    // cast acanthus collar where the arm leaves the body, and a leafy cup under each burner
    const acan = (r, h, n) => { const lg = G.latheFromProfile([[0, 0], [r * 0.5, 0], [r, h * 0.35], [r * 0.85, h * 0.7], [r * 0.35, h], [0, h]], 48); const pp = lg.attributes.position; for (let k = 0; k < pp.count; k++) { const x = pp.getX(k), z = pp.getZ(k), y = pp.getY(k); const an = Math.atan2(z, x); const f = 1 + 0.22 * Math.pow(Math.abs(Math.cos(an * n / 2)), 0.5) * Math.sin(Math.min(1, y / h) * Math.PI); pp.setX(k, x * f); pp.setZ(k, z * f); } lg.computeVertexNormals(); return lg; };
    { const col = mesh(acan(0.03, 0.05, 8), B, 0, 0, 0, g); col.geometry = col.geometry.clone().rotateZ(-Math.PI / 2).translate(0.08, -0.85, 0).rotateY(-a); }
    { const cp = mesh(acan(0.034, 0.04, 10), B, Math.cos(a) * 0.42, -0.83, Math.sin(a) * 0.42, g); void cp; }
    // decorative curl under the arm
    const c2 = new THREE.CubicBezierCurve3(V3(0.16, -0.93, 0), V3(0.2, -1.02, 0), V3(0.28, -1.0, 0), V3(0.25, -0.95, 0));
    const t2 = new THREE.TubeGeometry(c2, 24, 0.008, 8, false); t2.rotateY(-a); mesh(t2, B, 0, 0, 0, g);
    const px = Math.cos(a) * 0.42, pz = Math.sin(a) * 0.42;
    mesh(G.latheFromProfile([[0, 0], [0.03, 0], [0.034, 0.02], [0.022, 0.03], [0, 0.03]], 18), B, px, -0.79, pz, g);
    const sh = mesh(G.latheFromProfile([[0.022, 0], [0.05, 0.03], [0.062, 0.08], [0.06, 0.12], [0.07, 0.15], [0.064, 0.152]], 24), mats.frostGlass, px, -0.77, pz, g);
    sh.userData.noShadow = true;
  }
  return g;
}

// ============================================================================ trunk + dust sheet
/**
 * Domed steamer trunk: slatted oak body over canvas, a barrel lid, brass corner caps, leather straps
 * with buckles, a lock plate and drop handles. Local: floor y=0, long axis X, front +Z.
 * userData: { w, d, h, top(x,z) -> height of the lid surface }.
 */
export function buildTrunk(ctx, mats, { w = 0.74, d = 0.44, h = 0.38, dome = 0.09 } = {}) {
  const G = ctx.geometry; const g = new THREE.Group(); g.name = 'trunk';
  const body = mats.trunkCanvas || mats.walnut;
  mesh(rbox(G, w, h, d, 0.012), body, 0, h / 2, 0, g);
  // barrel lid: an extruded arch
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); for (let i = 0; i <= 16; i++) { const t = i / 16; s.lineTo(-d / 2 + t * d, Math.sin(t * Math.PI) * dome); } s.lineTo(-d / 2, 0);
  const lg = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 16 });
  lg.translate(0, 0, -w / 2); lg.rotateY(Math.PI / 2);
  mesh(G.applyBoxUVs(lg, 1), body, 0, h + 0.002, 0, g);
  // oak slats round the body and over the lid
  for (const x of [-w / 2 + 0.06, -w / 6, w / 6, w / 2 - 0.06]) {
    mesh(rbox(G, 0.045, h + 0.004, d + 0.012, 0.004), mats.walnut, x, h / 2, 0, g);
    const arc = []; for (let i = 0; i <= 16; i++) { const t = i / 16; arc.push(V3(0, h + Math.sin(t * Math.PI) * dome + 0.009, -d / 2 + t * d)); }
    mesh(G.sweepProfile([V2(-0.022, 0), V2(0.022, 0), V2(0.022, 0.008), V2(-0.022, 0.008), V2(-0.022, 0)], arc, { up: V3(1, 0, 0) }), mats.walnut, x, 0, 0, g);
  }
  for (const y of [0.03, h - 0.03]) mesh(rbox(G, w + 0.012, 0.04, d + 0.012, 0.004), mats.walnut, 0, y, 0, g);
  // brass corner caps
  const B = mats.brassOld || mats.brass;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0.025, h - 0.02]) mesh(rbox(G, 0.05, 0.05, 0.05, 0.01), B, sx * (w / 2 - 0.02), y, sz * (d / 2 - 0.02), g);
  // leather straps + buckles
  for (const x of [-w / 4, w / 4]) {
    const arc = [V3(0, 0.0, d / 2 + 0.007), V3(0, h, d / 2 + 0.007)];
    for (let i = 1; i < 16; i++) { const t = i / 16; arc.push(V3(0, h + Math.sin(t * Math.PI) * (dome + 0.01) + 0.012 * Math.sin(t * Math.PI), d / 2 + 0.007 - t * (d + 0.014))); }
    arc.push(V3(0, h, -d / 2 - 0.007));
    arc.push(V3(0, 0.0, -d / 2 - 0.007));
    mesh(G.sweepProfile([V2(-0.025, 0), V2(0.025, 0), V2(0.025, 0.004), V2(-0.025, 0.004), V2(-0.025, 0)], arc, { up: V3(1, 0, 0) }), mats.trunkStrap || mats.black, x, 0, 0, g);
    const bk = new THREE.TorusGeometry(0.022, 0.004, 6, 4); bk.rotateZ(Math.PI / 4); bk.scale(1.2, 1, 1);
    mesh(bk, B, x, h - 0.07, d / 2 + 0.012, g);
  }
  // lock plate + drop handles
  mesh(rbox(G, 0.07, 0.08, 0.008, 0.003), B, 0, h - 0.03, d / 2 + 0.005, g);
  mesh(new THREE.CircleGeometry(0.008, 12), mats.black, 0, h - 0.04, d / 2 + 0.0095, g);
  for (const sx of [-1, 1]) { const hd = mesh(new THREE.TorusGeometry(0.05, 0.006, 8, 20, Math.PI), mats.iron, sx * (w / 2 + 0.012), h * 0.62, 0, g); hd.rotation.set(0, Math.PI / 2, Math.PI); }
  g.userData = { w, d, h, top: (x, z) => (Math.abs(x) <= w / 2 + 0.01 && Math.abs(z) <= d / 2 + 0.01 ? h + Math.sin(Math.max(0, Math.min(1, (z + d / 2) / d)) * Math.PI) * dome + 0.012 : -1) };
  return g;
}

/**
 * A dust sheet thrown over a box-like object: a cloth grid that lies on `top(x, z)` where the object
 * is and hangs straight down past its edges in uneven folds, flaring and pooling on the floor.
 * `cover` = { w, d } of the object; the sheet is `size` = [sw, sd] and shifted by `offset`.
 */
export function dustSheet(G, { cover, top, size = [1.1, 0.9], offset = [0.12, 0.0], seed = 1, seg = [90, 80] } = {}) {
  const [sw, sd] = size;
  const geo = new THREE.PlaneGeometry(sw, sd, seg[0], seg[1]); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const hw = cover.w / 2, hd = cover.d / 2;
  const rr = (k) => { const x = Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + offset[0], v = p.getZ(i) + offset[1];
    const ex = Math.max(0, Math.abs(u) - hw), ez = Math.max(0, Math.abs(v) - hd);
    let x = u, z = v, y;
    if (ex === 0 && ez === 0) {
      y = top(u, v) + 0.004 + 0.006 * Math.sin(u * 23 + v * 7) * Math.sin(v * 19 - u * 5);
    } else {
      // over the edge: hang down the side by the distance travelled past it (pinned to the edge)
      const cu = Math.max(-hw, Math.min(hw, u)), cv = Math.max(-hd, Math.min(hd, v));
      const ty = top(cu, cv) + 0.004;
      const out = Math.hypot(ex, ez);
      const along = ex > ez ? v : u;
      const fold = Math.sin(along * 21 + rr(1) * 6) * 0.6 + Math.sin(along * 47 + rr(2) * 6) * 0.25 + Math.sin(along * 9 + rr(3) * 6) * 0.4;
      const r0 = 0.03;
      const roll = Math.min(out, r0 * Math.PI / 2);
      const drop = Math.max(0, out - roll);
      y = ty - (out < r0 * Math.PI / 2 ? r0 * (1 - Math.cos(out / r0)) : r0 + drop);
      const push = (out < r0 * Math.PI / 2 ? r0 * Math.sin(out / r0) : r0) + 0.02 * fold * Math.min(1, drop / 0.15) + drop * 0.06;
      const nx = ex > 0 ? Math.sign(u) : 0, nz = ez > 0 ? Math.sign(v) : 0;
      const nl = Math.hypot(nx, nz) || 1;
      x = cu + nx / nl * push; z = cv + nz / nl * push;
      // pools on the floor
      if (y < 0.004) { const extra = 0.004 - y; y = 0.004 + 0.008 * Math.abs(fold) * Math.min(1, extra / 0.05); x += nx / nl * extra * 0.9; z += nz / nl * extra * 0.9; }
    }
    p.setXYZ(i, x - offset[0], y, z - offset[1]);
  }
  geo.computeVertexNormals();
  geo.translate(offset[0], 0, offset[1]);
  return geo;
}
