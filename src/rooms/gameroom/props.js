import * as THREE from 'three';

/**
 * Game-room furniture and props, all modelled here: the billiard table and its
 * three-shade lamp, cue rack with bead scoreboard, card table and chairs,
 * games table (holding the inlaid board), marble fireplace, Chesterfield
 * armchair and the taxidermy trophies.
 */

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

/** Tube whose radius tapers linearly from r0 to r1 along the curve (closed tip). */
export function taperedTube(curve, segs, r0, r1, radial = 8) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const r = r0 + (r1 - r0) * t;
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const n = N.clone().multiplyScalar(Math.cos(a)).add(B.clone().multiplyScalar(Math.sin(a)));
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      nor.push(n.x, n.y, n.z);
      uv.push(j / radial, t * curve.getLength() * 4);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** flat slab from a 2D shape (in XZ, y up) with bevelled edges, top at y = thickness */
function slab(shape, thickness, bevel = 0.008, segs = 2) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}
function rectShape(w, d, r = 0) {
  const s = new THREE.Shape();
  if (!r) { s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); s.lineTo(-w / 2, -d / 2); return s; }
  const x = w / 2, y = d / 2;
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
  return s;
}
function rectPath(w, d) {
  const p = new THREE.Path(); p.moveTo(-w / 2, -d / 2); p.lineTo(-w / 2, d / 2); p.lineTo(w / 2, d / 2); p.lineTo(w / 2, -d / 2); p.lineTo(-w / 2, -d / 2); return p;
}

// ============================================================================ billiard table
export const TABLE = { PW: 1.14, PL: 2.28, BH: 0.8, CUSH: 0.05, RAIL: 0.13, BALL_R: 0.0275 };

export function turnedLegProfile(h, r) {
  // heavy Victorian turned leg: plinth, bulb with reeding rings, collar, square-ish top block handled separately
  const p = [
    [0, 0], [r * 0.62, 0], [r * 0.7, 0.02], [r * 0.62, 0.04], [r * 0.55, 0.06], [r * 0.6, 0.08], [r * 0.5, 0.1],
    [r * 0.48, 0.16], [r * 0.62, 0.2], [r * 0.9, 0.28], [r * 1.0, 0.34], [r * 0.98, 0.38], [r * 0.86, 0.43], [r * 0.9, 0.45],
    [r * 0.72, 0.5], [r * 0.56, 0.55], [r * 0.5, 0.58], [r * 0.6, 0.6], [r * 0.6, 0.62], [r * 0.48, 0.64], [r * 0.44, 0.68],
    [r * 0.5, 0.72], [r * 0.68, 0.74], [r * 0.7, 0.77], [r * 0.55, 0.79], [r * 0.55, 1.0], [0, 1.0],
  ];
  return p.map(([x, y]) => [x, y * h]);
}

export function buildBilliardTable(ctx, mats, { seed = 7 } = {}) {
  const { geometry: G } = ctx;
  const { PW, PL, BH, CUSH, RAIL, BALL_R } = TABLE;
  const g = new THREE.Group(); g.name = 'billiardTable';
  const ox = PW / 2 + CUSH + RAIL, oz = PL / 2 + CUSH + RAIL;
  // slate bed + cloth
  const bedW = PW + CUSH * 2 + 0.02, bedL = PL + CUSH * 2 + 0.02;
  g.add(at(new THREE.Mesh(G.boxUV(bedW, 0.06, bedL, 1), mats.dark), 0, BH - 0.03, 0));
  const cloth = new THREE.Mesh(G.planeUV(bedW, bedL, 1, 1, 1).rotateX(-Math.PI / 2), mats.baize);
  cloth.position.y = BH + 0.0005; cloth.name = 'cloth'; g.add(cloth);
  // pockets: dark holes + leather cups
  const pockets = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) pockets.push(V3(sx * (PW / 2 + (sz ? 0.012 : 0.03)), BH, sz * (PL / 2 + 0.012)));
  const holeG = new THREE.CircleGeometry(0.058, 28).rotateX(-Math.PI / 2);
  const cupG = G.latheFromProfile([[0.058, 0], [0.056, -0.04], [0.045, -0.09], [0.0, -0.11]].reverse(), 20);
  for (const p of pockets) {
    g.add(at(new THREE.Mesh(holeG, mats.hole), p.x, BH + 0.0012, p.z));
    g.add(at(new THREE.Mesh(cupG, mats.hole), p.x, BH + 0.001, p.z));
  }
  // cushions: wedge profile extruded between pocket jaws
  const cs = new THREE.Shape();
  cs.moveTo(0, -0.002); cs.lineTo(0.028, -0.002); cs.lineTo(CUSH, 0.026); cs.quadraticCurveTo(CUSH + 0.003, 0.036, CUSH - 0.006, 0.04); cs.lineTo(0, 0.043); cs.lineTo(0, -0.002);
  const cushion = (len) => {
    const e = new THREE.ExtrudeGeometry(cs, { depth: len, bevelEnabled: false, curveSegments: 6 });
    e.translate(0, 0, -len / 2);
    return G.applyBoxUVs(e, 1);
  };
  const jaw = 0.075;
  const longLen = PL / 2 - jaw * 2 + 0.01, shortLen = PW - jaw * 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // long cushions (two per side, between corner & middle pocket); profile x points inward (-sx)
    const m = new THREE.Mesh(cushion(longLen), mats.cushion);
    m.rotation.y = sx > 0 ? Math.PI : 0;
    m.position.set(sx * (PW / 2 + CUSH), BH, sz * (PL / 4 + 0.005));
    g.add(m);
  }
  for (const sz of [-1, 1]) {
    const m = new THREE.Mesh(cushion(shortLen), mats.cushion);
    m.rotation.y = sz > 0 ? Math.PI / 2 : -Math.PI / 2;
    m.position.set(0, BH, sz * (PL / 2 + CUSH));
    g.add(m);
  }
  // top rail: bevelled mahogany ring
  {
    const s = rectShape(ox * 2, oz * 2, 0.05);
    s.holes.push(rectPath(PW + CUSH * 2 - 0.004, PL + CUSH * 2 - 0.004));
    const rail = new THREE.Mesh(slab(s, 0.05, 0.014, 3), mats.wood);
    rail.position.y = BH - 0.005; g.add(rail);
    // nosing under the rail
    const prof = [V2(0, 0), V2(0.012, 0.004), V2(0.022, 0.016), V2(0.024, 0.03), V2(0.0, 0.034)];
    const path = [V3(-ox + 0.01, 0, -oz + 0.01), V3(-ox + 0.01, 0, oz - 0.01), V3(ox - 0.01, 0, oz - 0.01), V3(ox - 0.01, 0, -oz + 0.01)];
    const nose = new THREE.Mesh(G.sweepProfile(prof.map((p) => V2(-p.x, p.y)), path, { closed: true, uvScale: 2 }), mats.wood);
    nose.position.y = BH - 0.04; g.add(nose);
  }
  // mother-of-pearl sights
  {
    const dg = new THREE.CylinderGeometry(0.008, 0.008, 0.003, 4); dg.scale(1, 1, 1.8);
    const railMid = CUSH + RAIL / 2 + 0.005;
    for (let i = 1; i < 8; i++) {
      if (i === 4) continue;
      const z = -PL / 2 + (PL / 8) * i;
      for (const sx of [-1, 1]) { const d = new THREE.Mesh(dg, mats.pearl); d.position.set(sx * (PW / 2 + railMid), BH + 0.046, z); g.add(d); }
    }
    for (let i = 1; i < 4; i++) {
      const x = -PW / 2 + (PW / 4) * i;
      for (const sz of [-1, 1]) { const d = new THREE.Mesh(dg, mats.pearl); d.rotation.y = Math.PI / 2; d.position.set(x, BH + 0.046, sz * (PL / 2 + railMid)); g.add(d); }
    }
  }
  // pocket irons (brass-capped leather) on the rail around each pocket
  for (const p of pockets) {
    const corner = Math.abs(p.z) > 0.1;
    const arc = corner ? Math.PI * 1.5 : Math.PI;
    const tg = new THREE.TorusGeometry(0.066, 0.013, 8, 20, arc);
    tg.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(tg, mats.brass);
    const outward = Math.atan2(p.z, p.x);
    m.rotation.y = -(outward - arc / 2) ;
    m.position.set(p.x, BH + 0.04, p.z);
    g.add(m);
  }
  // apron / frieze with raised panels and a gilt bead
  const apronH = 0.27, apronY = BH - 0.055 - apronH;
  const ax = ox - 0.035, az = oz - 0.035;
  {
    const s = rectShape(ax * 2, az * 2, 0.02);
    s.holes.push(rectPath(ax * 2 - 0.08, az * 2 - 0.08));
    const ap = new THREE.Mesh(slab(s, apronH, 0.01, 2), mats.wood);
    ap.position.y = apronY; g.add(ap);
    const bead = [];
    for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI; bead.push(V2(Math.cos(a) * 0.008, 0.008 + Math.sin(a) * 0.008)); }
    const bpath = [V3(-ax, 0, -az), V3(-ax, 0, az), V3(ax, 0, az), V3(ax, 0, -az)];
    for (const y of [apronY + 0.02, apronY + apronH - 0.035]) {
      const b = new THREE.Mesh(G.sweepProfile(bead.map((p) => V2(-p.x, p.y)), bpath, { closed: true, uvScale: 3 }), mats.gilt);
      b.position.y = y; g.add(b);
    }
    // raised panels: long sides 3 per half, short sides 2
    const pg = G.raisedPanel(0.3, 0.15, { border: 0.018, bevel: 0.012, fieldDepth: 0.005, frameDepth: 0.006 });
    const legZ = [-oz + 0.1, 0, oz - 0.1];
    const py = apronY + apronH / 2 - 0.005;
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const z0 = legZ[k] + 0.12, z1 = legZ[k + 1] - 0.12;
        const n = 3, w = (z1 - z0) / n;
        for (let i = 0; i < n; i++) {
          const m = new THREE.Mesh(pg, mats.wood);
          m.scale.set((w - 0.03) / 0.3, 1, 1);
          m.rotation.y = sx * Math.PI / 2;
          m.position.set(sx * ax, py, z0 + w * (i + 0.5));
          g.add(m);
        }
      }
    }
    for (const sz of [-1, 1]) for (let i = 0; i < 2; i++) {
      const w = (ax * 2 - 0.36) / 2;
      const m = new THREE.Mesh(pg, mats.wood);
      m.scale.set((w - 0.03) / 0.3, 1, 1);
      m.rotation.y = sz > 0 ? 0 : Math.PI;
      m.position.set(-ax + 0.18 + w * (i + 0.5), py, sz * az);
      g.add(m);
    }
    // corner and centre blocks with carved roundels
    const blockG = new G.RoundedBoxGeometry(0.17, apronH + 0.02, 0.17, 2, 0.012);
    const rosG = G.latheFromProfile([[0, 0.016], [0.02, 0.014], [0.03, 0.008], [0.036, 0.0]], 18).rotateX(Math.PI / 2);
    for (const sx of [-1, 1]) for (const z of legZ) {
      const bx = sx * (ax - 0.06);
      g.add(at(new THREE.Mesh(blockG, mats.wood), bx, apronY + apronH / 2, z === 0 ? 0 : Math.sign(z) * (az - 0.06)));
      const r = new THREE.Mesh(rosG, mats.gilt);
      r.rotation.y = sx * Math.PI / 2;
      r.position.set(sx * (ax + 0.026), apronY + apronH / 2, z === 0 ? 0 : Math.sign(z) * (az - 0.06));
      g.add(r);
    }
    // legs
    const legG = G.latheFromProfile(turnedLegProfile(apronY, 0.1), 28);
    const footG = G.latheFromProfile([[0, 0], [0.07, 0], [0.075, 0.015], [0.06, 0.03], [0, 0.03]], 20);
    for (const sx of [-1, 1]) for (const z of legZ) {
      const lz = z === 0 ? 0 : Math.sign(z) * (az - 0.06);
      g.add(at(new THREE.Mesh(legG, mats.wood), sx * (ax - 0.06), 0.0, lz));
      g.add(at(new THREE.Mesh(footG, mats.brass), sx * (ax - 0.06), 0.0, lz));
    }
  }
  g.userData = { pockets, ox, oz, apronY };
  return g;
}

/** Equirect sphere geometry whose UVs point into cell n of the 4x4 ball atlas. */
export function ballGeometry(n, r = TABLE.BALL_R) {
  const g = new THREE.SphereGeometry(r, 28, 18);
  const uv = g.attributes.uv;
  const cx = (n % 4) / 4, cy = 1 - (Math.floor(n / 4) + 1) / 4;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, cx + uv.getX(i) / 4, cy + uv.getY(i) / 4);
  return g;
}

/** A cue: tapered maple shaft, ebony butt with ivory points, leather tip. Lies along +Y from y=0 (butt) to y=len. */
export function cueGeometry(G, len = 1.45) {
  const parts = {};
  parts.shaft = G.latheFromProfile([[0.0, len * 0.42], [0.0128, len * 0.42], [0.0105, len * 0.7], [0.0072, len * 0.985], [0.0, len * 0.985]], 14);
  parts.butt = G.latheFromProfile([[0, 0], [0.0145, 0], [0.0158, 0.006], [0.0158, 0.02], [0.0152, len * 0.25], [0.0136, len * 0.42], [0, len * 0.42]], 14);
  parts.ferrule = G.latheFromProfile([[0, len * 0.985], [0.0074, len * 0.985], [0.0072, len * 0.997], [0, len * 0.997]], 12);
  parts.tip = G.latheFromProfile([[0, len * 0.997], [0.007, len * 0.997], [0.0066, len], [0, len + 0.002]], 12);
  parts.wrap = G.latheFromProfile([[0.0, len * 0.06], [0.0162, len * 0.06], [0.016, len * 0.2], [0.0, len * 0.2]], 14);
  return parts;
}

// ============================================================================ the hanging billiard lamp
export function buildBilliardLamp(ctx, mats, { length = 1.7, drop = 1.95, shades = 3 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'billiardLamp';
  // ceiling canopy + two suspension rods with balls
  const rodZ = length * 0.38;
  for (const sz of [-1, 1]) {
    g.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.07, 0], [0.065, -0.02], [0.03, -0.05], [0.012, -0.07], [0, -0.07]], 20), mats.brass), 0, 0, sz * rodZ));
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, drop - 0.12, 10), mats.brass);
    rod.position.set(0, -drop / 2, sz * rodZ); g.add(rod);
    for (const y of [-drop * 0.35, -drop * 0.7]) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 10), mats.brass), 0, y, sz * rodZ));
    // decorative scroll bracket to the bar
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 6, 20, Math.PI * 1.4), mats.brass);
    sc.rotation.y = Math.PI / 2; sc.position.set(0, -drop + 0.08, sz * (rodZ - 0.04)); g.add(sc);
  }
  // the bar: a brass tube with turned end finials and a centre urn
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, length, 14), mats.brass);
  bar.rotation.x = Math.PI / 2; bar.position.y = -drop; g.add(bar);
  for (const sz of [-1, 1]) {
    const fin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.024, 0], [0.03, 0.02], [0.02, 0.04], [0.026, 0.06], [0.012, 0.08], [0, 0.1]], 16), mats.brass);
    fin.rotation.x = sz * Math.PI / 2; fin.position.set(0, -drop, sz * length / 2); g.add(fin);
  }
  const urn = new THREE.Mesh(G.latheFromProfile([[0, -0.1], [0.02, -0.1], [0.04, -0.07], [0.05, -0.03], [0.035, 0.0], [0.03, 0.04], [0.045, 0.07], [0.02, 0.1], [0, 0.12]], 20), mats.brass);
  urn.position.y = -drop; g.add(urn);
  // shades: cased green glass outside, opal white inside (emissive), with brass gallery rings
  const shadeProfile = [[0.05, 0.0], [0.07, -0.02], [0.11, -0.07], [0.15, -0.13], [0.175, -0.175], [0.18, -0.19]];
  const outerG = G.latheFromProfile(shadeProfile.slice().reverse(), 40);
  const innerG = G.latheFromProfile(shadeProfile.map(([r, y]) => [r - 0.004, y - 0.002]), 40);
  const ringG = new THREE.TorusGeometry(0.181, 0.005, 6, 40); ringG.rotateX(Math.PI / 2);
  const fitterG = G.latheFromProfile([[0, 0.06], [0.02, 0.06], [0.03, 0.03], [0.05, 0.0], [0.052, -0.01], [0.0, -0.01]], 20);
  const bulbs = [], shadesOut = [];
  for (let i = 0; i < shades; i++) {
    const z = (i - (shades - 1) / 2) * (length * 0.36);
    const sg = new THREE.Group(); sg.position.set(0, -drop - 0.07, z);
    sg.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8), mats.brass), 0, 0.04, 0));
    sg.add(new THREE.Mesh(fitterG, mats.brass));
    const o = new THREE.Mesh(outerG, mats.shadeOuter); sg.add(o);
    const n = new THREE.Mesh(innerG, mats.shadeInner); n.userData.noShadow = true; sg.add(n);
    sg.add(at(new THREE.Mesh(ringG, mats.brass), 0, -0.19, 0));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), mats.bulb); bulb.scale.set(1, 1.25, 1); bulb.position.y = -0.07; bulb.userData.noShadow = true; sg.add(bulb);
    g.add(sg);
    bulbs.push(V3(0, -drop - 0.07 - 0.07, z));
    shadesOut.push(sg);
  }
  g.userData = { bulbs, shades: shadesOut, barY: -drop };
  return g;
}

// ============================================================================ cue rack + scoreboard (wall-mounted, faces +Z)
export function buildCueRack(ctx, mats, { cues = 7 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'cueRack';
  const W = 0.86;
  // back board with arched crest
  const bs = new THREE.Shape();
  bs.moveTo(-W / 2, 0); bs.lineTo(W / 2, 0); bs.lineTo(W / 2, 1.62); bs.quadraticCurveTo(W / 4, 1.66, 0.12, 1.74); bs.quadraticCurveTo(0, 1.82, -0.12, 1.74); bs.quadraticCurveTo(-W / 4, 1.66, -W / 2, 1.62); bs.lineTo(-W / 2, 0);
  const board = new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(bs, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 16 }), 1), mats.wood);
  board.position.set(0, 0.0, 0); g.add(board);
  // stiles
  for (const sx of [-1, 1]) g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.05, 1.62, 0.05, 2, 0.008), mats.wood), sx * (W / 2 - 0.025), 0.81, 0.04));
  // bottom cup shelf
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(W, 0.06, 0.13, 2, 0.01), mats.wood), 0, 0.03, 0.08));
  // upper clip rail
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(W, 0.05, 0.08, 2, 0.01), mats.wood), 0, 1.12, 0.06));
  // scoreboard: two brass wires with wooden beads, under the crest
  const beadG = new THREE.SphereGeometry(0.014, 10, 8); beadG.scale(1, 1, 1);
  const sbY = [1.38, 1.5];
  for (const [k, y] of sbY.entries()) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, W - 0.12, 6), mats.brass);
    wire.rotation.z = Math.PI / 2; wire.position.set(0, y, 0.04); g.add(wire);
    for (let i = 0; i < 20; i++) {
      const left = i < (k ? 13 : 7);
      const x = left ? -W / 2 + 0.08 + i * 0.024 : W / 2 - 0.08 - (19 - i) * 0.024;
      const b = new THREE.Mesh(beadG, i % 5 === 4 ? mats.ivory : mats.dark);
      b.scale.set(0.7, 1, 1);
      b.position.set(x, y, 0.04); g.add(b);
    }
  }
  // crest roundel
  g.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0.02], [0.04, 0.016], [0.055, 0.006], [0.06, 0]], 24).rotateX(Math.PI / 2), mats.gilt), 0, 1.66, 0.02));
  // cues
  const parts = cueGeometry(G, 1.48);
  const cueGroup = new THREE.Group();
  for (let i = 0; i < cues; i++) {
    const x = -W / 2 + 0.1 + i * ((W - 0.2) / (cues - 1));
    const c = new THREE.Group();
    c.add(new THREE.Mesh(parts.butt, mats.ebony), new THREE.Mesh(parts.shaft, mats.maple), new THREE.Mesh(parts.ferrule, mats.ivory), new THREE.Mesh(parts.tip, mats.tip), new THREE.Mesh(parts.wrap, mats.leather));
    c.position.set(x, 0.065, 0.085);
    c.rotation.x = -0.035;
    cueGroup.add(c);
  }
  g.add(cueGroup);
  return g;
}

// ============================================================================ seating
export function buildSideChair(ctx, mats) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  const seatH = 0.46;
  const legG = G.latheFromProfile([[0, 0], [0.016, 0], [0.019, 0.04], [0.014, 0.12], [0.02, 0.2], [0.022, 0.26], [0.016, 0.3], [0.02, 0.38], [0.02, 0.42], [0, 0.42]], 12);
  for (const [x, z] of [[-0.2, 0.2], [0.2, 0.2]]) g.add(at(new THREE.Mesh(legG, mats.wood), x, 0, z));
  // back legs splay and continue into the balloon back
  for (const sx of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([V3(sx * 0.19, 0, -0.24), V3(sx * 0.185, 0.25, -0.2), V3(sx * 0.18, seatH, -0.19), V3(sx * 0.2, 0.68, -0.23), V3(sx * 0.18, 0.86, -0.26)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.017, 8), mats.wood));
  }
  // balloon hoop
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.016, 8, 32, Math.PI * 1.15), mats.wood);
  hoop.rotation.z = -Math.PI * 0.075; hoop.position.set(0, 0.8, -0.255); hoop.rotation.x = -0.12; hoop.scale.set(1, 0.65, 1); g.add(hoop);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 8), mats.wood); rail.rotation.z = Math.PI / 2; rail.position.set(0, 0.64, -0.22); g.add(rail);
  // seat frame + stuffed leather seat
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.46, 0.06, 0.46, 2, 0.015), mats.wood), 0, seatH - 0.03, 0));
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.44, 0.06, 0.43, 4, 0.03), mats.seat), 0, seatH + 0.02, 0.005));
  return g;
}

export function buildChesterfield(ctx, mats) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'chesterfield';
  const W = 0.95, D = 0.85;
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(W, 0.28, D, 4, 0.05), mats.leather), 0, 0.22, 0));
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(W - 0.26, 0.14, D - 0.2, 4, 0.06), mats.leather), 0, 0.42, 0.06));
  // back: tufted slab
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(W, 0.48, 0.22, 4, 0.07), mats.leather), 0, 0.58, -D / 2 + 0.11));
  // rolled arms
  for (const sx of [-1, 1]) {
    g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.16, 0.36, D, 4, 0.06), mats.leather), sx * (W / 2 - 0.08), 0.42, 0));
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, D + 0.02, 20), mats.leather); roll.rotation.x = Math.PI / 2; roll.position.set(sx * (W / 2 - 0.07), 0.62, 0); g.add(roll);
  }
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, W + 0.04, 20), mats.leather); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.82, -D / 2 + 0.11); g.add(roll);
  // buttons
  const bG = new THREE.SphereGeometry(0.012, 8, 6);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 5 - r; i++) g.add(at(new THREE.Mesh(bG, mats.leatherDark), -0.3 + (i + r * 0.5) * 0.15, 0.5 + r * 0.14, -D / 2 + 0.222));
  // bun feet
  const fG = G.latheFromProfile([[0, 0], [0.04, 0], [0.05, 0.03], [0.045, 0.07], [0.0, 0.08]], 14);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(new THREE.Mesh(fG, mats.wood), sx * (W / 2 - 0.08), 0, sz * (D / 2 - 0.08)));
  return g;
}

// ============================================================================ tables
/** Round card table: baize-lined top, turned pedestal, four carved feet. Top at y = 0.74. */
export function buildCardTable(ctx, mats, { r = 0.5 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'cardTable';
  const top = new THREE.Shape(); top.absarc(0, 0, r, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, r - 0.07, 0, Math.PI * 2, true); top.holes.push(hole);
  g.add(at(new THREE.Mesh(slab(top, 0.04, 0.012, 3), mats.wood), 0, 0.7, 0));
  const inner = new THREE.Mesh(new THREE.CircleGeometry(r - 0.07, 48).rotateX(-Math.PI / 2), mats.baize); inner.position.y = 0.732; g.add(inner);
  const disc = new THREE.Shape(); disc.absarc(0, 0, r - 0.069, 0, Math.PI * 2, false);
  g.add(at(new THREE.Mesh(slab(disc, 0.028, 0.004, 1), mats.wood), 0, 0.703, 0));
  // apron
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(r - 0.04, r - 0.04, 0.08, 48, 1, true), mats.wood), 0, 0.66, 0));
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(r - 0.04, 0.006, 6, 48).rotateX(Math.PI / 2), mats.gilt), 0, 0.63, 0));
  const ped = G.latheFromProfile([[0, 0.12], [0.08, 0.12], [0.09, 0.15], [0.06, 0.18], [0.05, 0.24], [0.085, 0.32], [0.09, 0.38], [0.06, 0.44], [0.045, 0.5], [0.05, 0.56], [0.07, 0.6], [0.07, 0.63], [0, 0.63]], 24);
  g.add(new THREE.Mesh(ped, mats.wood));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const curve = new THREE.CatmullRomCurve3([V3(0, 0.16, 0), V3(Math.cos(a) * 0.14, 0.11, Math.sin(a) * 0.14), V3(Math.cos(a) * 0.28, 0.05, Math.sin(a) * 0.28), V3(Math.cos(a) * 0.36, 0.03, Math.sin(a) * 0.36)]);
    g.add(new THREE.Mesh(taperedTube(curve, 16, 0.04, 0.022, 10), mats.wood));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), mats.brass), Math.cos(a) * 0.37, 0.025, Math.sin(a) * 0.37));
  }
  return g;
}

/** Square games table; returns group, top surface at userData.topY, board recess size userData.board. */
export function buildGamesTable(ctx, mats, { w = 0.82, h = 0.745, board = 0.6 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'gamesTable';
  const t = 0.035;
  const s = rectShape(w, w, 0.02);
  s.holes.push(rectPath(board + 0.004, board + 0.004));
  g.add(at(new THREE.Mesh(slab(s, t, 0.01, 3), mats.wood), 0, h - t, 0));
  g.add(at(new THREE.Mesh(G.boxUV(board, 0.02, board, 1), mats.dark), 0, h - 0.016, 0));
  // apron with a drawer front each side
  const aw = w - 0.1;
  for (let k = 0; k < 4; k++) {
    const a = new THREE.Group(); a.rotation.y = (k * Math.PI) / 2;
    a.add(at(new THREE.Mesh(G.boxUV(aw, 0.11, 0.02, 1), mats.wood), 0, h - t - 0.055, aw / 2));
    const p = new THREE.Mesh(G.raisedPanel(aw * 0.55, 0.075, { border: 0.012, bevel: 0.008, fieldDepth: 0.003, frameDepth: 0.004 }), mats.wood); p.position.set(0, h - t - 0.055, aw / 2 + 0.01); a.add(p);
    a.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), mats.brass), 0, h - t - 0.055, aw / 2 + 0.024));
    g.add(a);
  }
  // turned legs
  const legG = G.latheFromProfile([[0, 0], [0.022, 0], [0.026, 0.03], [0.018, 0.06], [0.016, 0.2], [0.026, 0.3], [0.032, 0.36], [0.024, 0.42], [0.02, 0.5], [0.028, 0.55], [0.03, 0.58], [0.03, h - t - 0.11], [0, h - t - 0.11]], 16);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(at(new THREE.Mesh(legG, mats.wood), sx * (aw / 2 - 0.02), 0, sz * (aw / 2 - 0.02)));
    g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.06, 0.11, 0.06, 2, 0.006), mats.wood), sx * (aw / 2 - 0.02), h - t - 0.055, sz * (aw / 2 - 0.02)));
  }
  // stretcher cross with finial
  for (const r of [Math.PI / 4, -Math.PI / 4]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, (aw - 0.04) * Math.SQRT2, 8), mats.wood);
    st.rotation.z = Math.PI / 2; st.rotation.y = r; st.position.y = 0.16; g.add(st);
  }
  g.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.03, 0], [0.035, 0.03], [0.015, 0.06], [0.02, 0.08], [0, 0.1]], 14), mats.wood), 0, 0.15, 0));
  g.userData = { topY: h, board };
  return g;
}

// ============================================================================ fireplace (faces +Z, opening centred at x=0)
export function buildFireplace(ctx, mats, { seed = 3 } = {}) {
  const { geometry: G, fx } = ctx;
  const g = new THREE.Group(); g.name = 'fireplace';
  const W = 1.7, Hm = 1.28, openW = 0.84, openH = 0.82, D = 0.3;
  // surround: pilasters, frieze, shelf
  for (const sx of [-1, 1]) {
    const px = sx * (openW / 2 + 0.17);
    g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.3, Hm - 0.12, D, 2, 0.01), mats.marble), px, (Hm - 0.12) / 2, D / 2));
    // fluted face strip
    for (let i = 0; i < 4; i++) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, Hm - 0.42, 8), mats.marbleDark), px - 0.075 + i * 0.05, 0.12 + (Hm - 0.42) / 2 + 0.05, D + 0.002));
    // corbel
    g.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.11, 0], [0.13, 0.03], [0.1, 0.06], [0.12, 0.09], [0, 0.09]], 4).rotateY(Math.PI / 4), mats.marble), px, Hm - 0.21, D / 2 + 0.03));
    // plinth
    g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.34, 0.12, D + 0.04, 2, 0.01), mats.marble), px, 0.06, D / 2 + 0.01));
  }
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(openW + 0.06, 0.24, D - 0.02, 2, 0.01), mats.marble), 0, openH + 0.12, D / 2 - 0.01));
  // carved cartouche in the frieze
  const cart = new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 12), mats.marbleDark); cart.scale.set(1.6, 0.8, 0.25); cart.position.set(0, openH + 0.12, D - 0.005); g.add(cart);
  // mantel shelf with moulded edge
  const shelf = new THREE.Mesh(slab(rectShape(W, D + 0.12, 0.02), 0.06, 0.018, 3), mats.marble);
  shelf.position.set(0, Hm - 0.06, D / 2 + 0.03); g.add(shelf);
  const under = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.07, 0.05).map((p) => V2(p.x, p.y)), [V3(-W / 2 + 0.04, 0, 0), V3(-W / 2 + 0.04, 0, D + 0.04), V3(W / 2 - 0.04, 0, D + 0.04), V3(W / 2 - 0.04, 0, 0)].map((p) => V3(p.x, p.y, -p.z)), { uvScale: 2 }), mats.marble);
  under.scale.z = -1; under.position.set(0, Hm - 0.13, 0); g.add(under);
  // firebox: sooty brick back + cheeks, cast-iron arched insert
  const inner = new THREE.Group(); inner.position.z = 0.17; g.add(inner);
  const box = new THREE.Group();
  const back = new THREE.Mesh(G.planeUV(openW, openH, 1), mats.brick); back.position.set(0, openH / 2, -0.16); box.add(back);
  for (const sx of [-1, 1]) { const c = new THREE.Mesh(G.planeUV(0.3, openH, 1), mats.brick); c.rotation.y = -sx * Math.PI / 2 + sx * 0.25; c.position.set(sx * (openW / 2 - 0.06), openH / 2, -0.02); box.add(c); }
  const roofP = new THREE.Mesh(G.planeUV(openW, 0.42, 1), mats.iron); roofP.rotation.x = Math.PI / 2 + 0.3; roofP.position.set(0, openH - 0.01, 0.02); box.add(roofP);
  inner.add(box);
  const ins = new THREE.Shape(); ins.moveTo(-openW / 2 - 0.02, 0); ins.lineTo(openW / 2 + 0.02, 0); ins.lineTo(openW / 2 + 0.02, openH + 0.02); ins.lineTo(-openW / 2 - 0.02, openH + 0.02); ins.lineTo(-openW / 2 - 0.02, 0);
  const ih = new THREE.Path(); ih.moveTo(-openW / 2 + 0.05, 0); ih.lineTo(-openW / 2 + 0.05, openH - 0.2); ih.quadraticCurveTo(0, openH - 0.02, openW / 2 - 0.05, openH - 0.2); ih.lineTo(openW / 2 - 0.05, 0); ih.lineTo(-openW / 2 + 0.05, 0);
  ins.holes.push(ih);
  g.add(at(new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(ins, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 16 }), 2), mats.iron), 0, 0, 0.245));
  // hearth slab
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(W + 0.1, 0.05, 0.75, 2, 0.01), mats.marbleDark), 0, 0.025, 0.37));
  // grate, coals, logs, flames
  const grate = new THREE.Group();
  for (let i = 0; i < 8; i++) grate.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.2, 0.012), mats.iron), -0.24 + i * 0.068, 0.15, 0.05));
  for (const y of [0.08, 0.24]) grate.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.014, 0.018), mats.iron), 0, y, 0.05));
  for (const sx of [-1, 1]) grate.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.02, 0], [0.02, 0.2], [0.03, 0.24], [0.0, 0.3]], 10), mats.brass), sx * 0.3, 0.05, 0.08));
  inner.add(grate);
  const rnd = ctx.random.fork('gr-fire');
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x120a06, roughness: 0.9, emissive: new THREE.Color(1.0, 0.28, 0.05), emissiveIntensity: 1.3, name: 'coal' });
  const coals = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.03, 0), coalMat, 34);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 34; i++) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd.next() * 3, rnd.next() * 3, rnd.next() * 3));
    const sc = 0.6 + rnd.next() * 0.8;
    m4.compose(V3(-0.24 + rnd.next() * 0.48, 0.1 + rnd.next() * 0.07, -0.12 + rnd.next() * 0.17), q, V3(sc, sc * 0.8, sc));
    coals.setMatrixAt(i, m4);
  }
  coals.userData.noBake = true; coals.userData.keep = true;
  inner.add(coals);
  const logMat = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.95, emissive: new THREE.Color(0.9, 0.22, 0.04), emissiveIntensity: 0.3, name: 'log' });
  for (const [x, ry, y] of [[-0.06, 0.3, 0.2], [0.09, -0.35, 0.21], [0.0, 0.05, 0.28]]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.5, 10), logMat);
    log.rotation.z = Math.PI / 2; log.rotation.y = ry; log.position.set(x, y, -0.06); inner.add(log);
  }
  const flames = [];
  for (let i = 0; i < 12; i++) {
    const big = i % 3 === 1;
    const f = fx.flame({ height: (big ? 0.26 : 0.12) + rnd.next() * 0.1, width: (big ? 0.06 : 0.04) + rnd.next() * 0.02, intensity: big ? 2.6 : 1.8, seed: seed * 10 + i * 7, core: [1.0, 0.75, 0.38], outer: [1.0, 0.3, 0.05], base: [0.6, 0.12, 0.02] });
    f.position.set(-0.24 + (i / 11) * 0.48 + (rnd.next() - 0.5) * 0.03, 0.2 + rnd.next() * 0.05, -0.1 + rnd.next() * 0.1);
    inner.add(f); flames.push(f);
  }
  // brass fender + fire irons
  const fprof = [V2(0, 0), V2(0.01, 0), V2(0.012, 0.04), V2(0.006, 0.07), V2(0.012, 0.08), V2(0, 0.085)];
  g.add(new THREE.Mesh(G.sweepProfile(fprof, [V3(-0.68, 0.05, 0.3), V3(-0.68, 0.05, 0.62), V3(0.68, 0.05, 0.62), V3(0.68, 0.05, 0.3)], { uvScale: 2 }), mats.brass));
  for (let i = 0; i < 3; i++) {
    const tool = new THREE.Mesh(G.latheFromProfile([[0.006, 0], [0.006, 0.62], [0.014, 0.64], [0.01, 0.68], [0.016, 0.72], [0.0, 0.74]], 10), mats.brass);
    tool.position.set(-0.78 - i * 0.03, 0.05, 0.55); tool.rotation.z = -0.1 + i * 0.05; g.add(tool);
  }
  g.userData = { flames, coals, coalMat, Hm, openW, openH, W, D };
  return g;
}

// ============================================================================ trophies (wall mounted, facing +Z, plaque at origin)
function ell(r, sx, sy, sz, x, y, z, ws = 18, hs = 12) {
  const g = new THREE.SphereGeometry(r, ws, hs); g.scale(sx, sy, sz); g.translate(x, y, z); return g;
}
function prep(g) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g.index ? g.toNonIndexed() : g; }

export function buildTrophy(ctx, mats, kind = 'stag') {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = `trophy:${kind}`;
  // shield plaque
  const sh = new THREE.Shape();
  const pw = kind === 'stag' ? 0.24 : 0.19, ph = kind === 'stag' ? 0.38 : 0.3;
  sh.moveTo(0, -ph / 2 - 0.04); sh.quadraticCurveTo(pw, -ph / 2, pw, 0); sh.quadraticCurveTo(pw, ph / 2, pw * 0.5, ph / 2); sh.quadraticCurveTo(0.03, ph / 2, 0, ph / 2 + 0.05);
  sh.quadraticCurveTo(-0.03, ph / 2, -pw * 0.5, ph / 2); sh.quadraticCurveTo(-pw, ph / 2, -pw, 0); sh.quadraticCurveTo(-pw, -ph / 2, 0, -ph / 2 - 0.04);
  g.add(new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 3, curveSegments: 18 }), 1), mats.wood));
  const fur = [], dark = [], bone = [];
  if (kind === 'stag' || kind === 'antelope') {
    const S = kind === 'stag' ? 1 : 0.78;
    // neck rising out of the plaque, head turned slightly
    const neck = new THREE.CylinderGeometry(0.1 * S, 0.15 * S, 0.34 * S, 20, 4, true); neck.rotateX(Math.PI / 2 - 0.5); neck.translate(0, 0.02 * S, 0.17 * S); fur.push(neck);
    fur.push(ell(0.15 * S, 1, 1.1, 0.5, 0, -0.03 * S, 0.035 * S));
    fur.push(ell(0.1 * S, 0.95, 1.0, 1.1, 0, 0.13 * S, 0.29 * S));             // skull
    fur.push(ell(0.06 * S, 1.25, 0.6, 1.2, 0, 0.19 * S, 0.33 * S));            // brow
    fur.push(ell(0.065 * S, 0.78, 0.7, 2.0, 0, 0.08 * S, 0.43 * S));           // muzzle
    fur.push(ell(0.05 * S, 0.8, 0.55, 1.8, 0, 0.035 * S, 0.42 * S));           // jaw
    for (const sx of [-1, 1]) fur.push(ell(0.05 * S, 0.6, 0.8, 1.3, sx * 0.07 * S, 0.1 * S, 0.33 * S));   // cheeks
    fur.push(ell(0.06 * S, 1.2, 0.7, 1.0, 0, 0.0 * S, 0.24 * S));              // throat
    dark.push(ell(0.035 * S, 1.2, 0.8, 0.8, 0, 0.065 * S, 0.555 * S));         // nose
    for (const sx of [-1, 1]) {
      dark.push(ell(0.016 * S, 1, 1, 0.8, sx * 0.075 * S, 0.15 * S, 0.37 * S, 12, 8));   // eye
      const ear = new THREE.ConeGeometry(0.035 * S, 0.14 * S, 10); ear.scale(1, 1, 0.4); ear.rotateZ(-sx * 1.1); ear.rotateX(-0.3); ear.translate(sx * 0.13 * S, 0.22 * S, 0.24 * S); fur.push(ear);
    }
    if (kind === 'stag') {
      for (const sx of [-1, 1]) {
        const beam = new THREE.CatmullRomCurve3([V3(sx * 0.05, 0.2, 0.27), V3(sx * 0.14, 0.32, 0.22), V3(sx * 0.24, 0.5, 0.16), V3(sx * 0.27, 0.68, 0.2), V3(sx * 0.22, 0.84, 0.28)]);
        bone.push(taperedTube(beam, 24, 0.022, 0.008, 8));
        const tines = [[0.1, [sx * 0.06, 0.06, 0.16]], [0.28, [sx * 0.04, 0.12, 0.14]], [0.55, [sx * 0.02, 0.14, 0.12]], [0.75, [-sx * 0.05, 0.14, 0.06]], [0.88, [sx * 0.06, 0.1, 0.0]]];
        for (const [t, d] of tines) {
          const p = beam.getPointAt(t);
          const c = new THREE.CatmullRomCurve3([p, p.clone().add(V3(d[0] * 0.5, d[1] * 0.4, d[2] * 0.6)), p.clone().add(V3(...d))]);
          bone.push(taperedTube(c, 8, 0.012, 0.004, 6));
        }
        bone.push(ell(0.03, 1, 0.6, 1, sx * 0.055, 0.2, 0.27, 10, 8));   // burr
      }
    } else {
      // spiral horns (kudu-like)
      for (const sx of [-1, 1]) {
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const t = i / 24, a = t * Math.PI * 3.2;
          pts.push(V3(sx * (0.05 + t * 0.12 + Math.sin(a) * 0.05 * t), 0.17 + t * 0.48, 0.22 - t * 0.08 + Math.cos(a) * 0.05 * t));
        }
        bone.push(taperedTube(new THREE.CatmullRomCurve3(pts), 48, 0.02, 0.004, 8));
      }
    }
  } else if (kind === 'boar') {
    const neck = new THREE.CylinderGeometry(0.12, 0.17, 0.2, 20, 3, true); neck.rotateX(Math.PI / 2); neck.translate(0, 0, 0.1); fur.push(neck);
    fur.push(ell(0.17, 1, 1, 0.5, 0, 0, 0.04));
    fur.push(ell(0.12, 1.05, 1.0, 1.4, 0, 0.0, 0.24));
    fur.push(ell(0.07, 1.0, 0.8, 1.8, 0, -0.03, 0.38));
    dark.push(new THREE.CylinderGeometry(0.05, 0.052, 0.03, 18).rotateX(Math.PI / 2).translate(0, -0.035, 0.505));
    for (const sx of [-1, 1]) {
      dark.push(ell(0.014, 1, 1, 0.8, sx * 0.08, 0.06, 0.31, 12, 8));
      const ear = new THREE.ConeGeometry(0.045, 0.12, 10); ear.scale(1, 1, 0.45); ear.rotateZ(-sx * 0.5); ear.rotateX(-0.4); ear.translate(sx * 0.1, 0.15, 0.17); fur.push(ear);
      const tusk = new THREE.CatmullRomCurve3([V3(sx * 0.04, -0.06, 0.42), V3(sx * 0.07, -0.05, 0.46), V3(sx * 0.09, 0.0, 0.45), V3(sx * 0.08, 0.04, 0.42)]);
      bone.push(taperedTube(tusk, 10, 0.011, 0.002, 6));
    }
    // bristly crest
    fur.push(ell(0.06, 0.6, 1.2, 2.2, 0, 0.12, 0.12));
  }
  const fm = new THREE.Mesh(G.mergeGeometries(fur.map(prep)), mats[kind === 'boar' ? 'furBoar' : 'fur']);
  fm.geometry.computeVertexNormals();
  g.add(fm);
  if (dark.length) g.add(new THREE.Mesh(G.mergeGeometries(dark.map(prep)), mats.eye));
  if (bone.length) g.add(new THREE.Mesh(G.mergeGeometries(bone.map(prep)), mats.antler));
  return g;
}

// ============================================================================ wall gas sconce (faces +Z)
export function buildSconce(ctx, mats) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.065, 0], [0.06, 0.02], [0.02, 0.035], [0, 0.04]], 20).rotateX(Math.PI / 2), mats.brass));
  const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0, 0, 0.03), V3(0, -0.07, 0.12), V3(0, -0.01, 0.21), V3(0, 0.05, 0.21)]), 14, 0.009, 6), mats.brass); g.add(arm);
  g.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.03, 0], [0.04, 0.02], [0.02, 0.03], [0, 0.03]], 14), mats.brass), 0, 0.05, 0.21));
  const shade = new THREE.Mesh(G.latheFromProfile([[0.02, 0], [0.05, 0.03], [0.075, 0.08], [0.08, 0.12], [0.06, 0.15], [0.065, 0.16]], 22), mats.globe);
  shade.position.set(0, 0.08, 0.21); g.add(shade);
  g.userData.lightPos = V3(0, 0.17, 0.21);
  return g;
}
