import * as THREE from 'three';
import { fireFlames, sparks } from './fx.js';

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
    const dg = new THREE.CylinderGeometry(0.0075, 0.0075, 0.0012, 4); dg.scale(1, 1, 1.9);
    const railMid = CUSH + RAIL / 2 + 0.005;
    for (let i = 1; i < 8; i++) {
      if (i === 4) continue;
      const z = -PL / 2 + (PL / 8) * i;
      for (const sx of [-1, 1]) { const d = new THREE.Mesh(dg, mats.pearl); d.position.set(sx * (PW / 2 + railMid), BH + 0.0451, z); g.add(d); }
    }
    for (let i = 1; i < 4; i++) {
      const x = -PW / 2 + (PW / 4) * i;
      for (const sz of [-1, 1]) { const d = new THREE.Mesh(dg, mats.pearl); d.rotation.y = Math.PI / 2; d.position.set(x, BH + 0.0451, sz * (PL / 2 + railMid)); g.add(d); }
    }
  }
  // pockets: leather-lined mouths cut through the rail, brass-capped irons, woven drop nets
  {
    const arcShape = (r0, r1, a0, a1) => {
      const sh = new THREE.Shape();
      sh.absarc(0, 0, r1, a0, a1, false);
      sh.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0);
      sh.absarc(0, 0, r0, a1, a0, true);
      sh.closePath();
      return sh;
    };
    const ext = (shape, h, bev) => { const e = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: !!bev, bevelThickness: bev || 0, bevelSize: bev || 0, bevelSegments: 2, curveSegments: 24 }); e.rotateX(-Math.PI / 2); return G.applyBoxUVs(e, 4); };
    const netTex = ctx.textures.canvas('gameroom:net', 256, 256, (c) => {
      c.clearRect(0, 0, 256, 256);
      c.strokeStyle = 'rgba(214,200,170,1)'; c.lineWidth = 7; c.lineCap = 'round';
      for (let i = -8; i <= 8; i++) {
        c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32 + 256, 256); c.stroke();
        c.beginPath(); c.moveTo(i * 32 + 256, 0); c.lineTo(i * 32, 256); c.stroke();
      }
      c.fillStyle = 'rgba(160,140,110,1)';
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.beginPath(); c.arc(i * 32 + 16, j * 32, 5, 0, 7); c.fill(); }
    }, { tile: true });
    netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping; netTex.repeat.set(4, 2);
    const netMat = new THREE.MeshStandardMaterial({ map: netTex, alphaMap: null, alphaTest: 0.5, transparent: false, side: THREE.DoubleSide, roughness: 0.95, color: 0x6a5a48, name: 'pocketNet' });
    const bagG = G.latheFromProfile([[0.05, 0], [0.056, -0.03], [0.06, -0.07], [0.052, -0.11], [0.035, -0.14], [0.012, -0.155], [0, -0.158]].reverse(), 18);
    const ringG = new THREE.TorusGeometry(0.052, 0.006, 8, 28).rotateX(Math.PI / 2);
    const leather = mats.leather || mats.hole;
    for (const p of pockets) {
      const corner = Math.abs(p.z) > 0.1;
      const outward = Math.atan2(p.z, p.x);
      const span = corner ? Math.PI * 1.25 : Math.PI * 1.0;
      // leather lip: a horseshoe lying on the rail around the mouth
      const lip = new THREE.Mesh(ext(arcShape(0.058, 0.083, -span / 2, span / 2), 0.006, 0.003), leather);
      lip.rotation.y = -outward; lip.position.set(p.x, BH + 0.043, p.z); g.add(lip);
      // brass cap over the iron, standing proud of the leather
      const cap = new THREE.Mesh(ext(arcShape(0.083, 0.097, -span / 2 - 0.05, span / 2 + 0.05), 0.008, 0.002), mats.brass);
      cap.rotation.y = -outward; cap.position.set(p.x, BH + 0.043, p.z); g.add(cap);
      // throat: dark leather cup dropping through the rail
      g.add(at(new THREE.Mesh(G.latheFromProfile([[0.06, 0.05], [0.058, 0.0], [0.055, -0.05], [0.05, -0.09]].reverse(), 20), leather), p.x, BH - 0.0, p.z));
      // net bag hanging under the rail, outside the frieze at the corners and sides
      const nx = p.x + Math.sign(p.x) * (corner ? 0.115 : 0.135), nz = corner ? p.z + Math.sign(p.z) * 0.115 : 0;
      const bag = new THREE.Mesh(bagG, netMat); bag.position.set(nx, BH - 0.04, nz); bag.userData.noShadow = true; g.add(bag);
      g.add(at(new THREE.Mesh(ringG, mats.brass), nx, BH - 0.04, nz));
    }
  }
  // apron / frieze with raised panels and a gilt bead
  const AP = mats.apron || mats.wood;
  const apronH = 0.27, apronY = BH - 0.055 - apronH;
  const ax = ox - 0.035, az = oz - 0.035;
  {
    const s = rectShape(ax * 2, az * 2, 0.02);
    s.holes.push(rectPath(ax * 2 - 0.08, az * 2 - 0.08));
    const ap = new THREE.Mesh(slab(s, apronH, 0.01, 2), AP);
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
          const m = new THREE.Mesh(pg, AP);
          m.scale.set((w - 0.03) / 0.3, 1, 1);
          m.rotation.y = sx * Math.PI / 2;
          m.position.set(sx * ax, py, z0 + w * (i + 0.5));
          g.add(m);
          if (i === 1) {
            // a fielded drawer front: brass escutcheon plate and a bail drop-handle
            const hz = z0 + w * (i + 0.5);
            const plate = new G.RoundedBoxGeometry(0.075, 0.034, 0.004, 2, 0.0015); plate.rotateY(sx * Math.PI / 2);
            g.add(at(new THREE.Mesh(plate, mats.brass), sx * (ax + 0.015), py + 0.035, hz));
            for (const dz of [-0.028, 0.028]) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 8), mats.brass), sx * (ax + 0.019), py + 0.035, hz + dz));
            const bail = new THREE.TorusGeometry(0.03, 0.0035, 6, 24, Math.PI); bail.rotateZ(Math.PI); bail.rotateY(sx * Math.PI / 2); bail.rotateZ(sx * 0.25);
            g.add(at(new THREE.Mesh(bail, mats.brass), sx * (ax + 0.022), py + 0.034, hz));
            const kh = new THREE.CylinderGeometry(0.004, 0.004, 0.003, 10).rotateZ(Math.PI / 2);
            g.add(at(new THREE.Mesh(kh, mats.dark), sx * (ax + 0.0175), py - 0.012, hz));
          }
        }
      }
    }
    for (const sz of [-1, 1]) for (let i = 0; i < 2; i++) {
      const w = (ax * 2 - 0.36) / 2;
      const m = new THREE.Mesh(pg, AP);
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
      g.add(at(new THREE.Mesh(blockG, AP), bx, apronY + apronH / 2, z === 0 ? 0 : Math.sign(z) * (az - 0.06)));
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
      g.add(at(new THREE.Mesh(legG, AP), sx * (ax - 0.06), 0.0, lz));
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
  const f0 = len - 0.03, t0 = len - 0.008;
  parts.shaft = G.latheFromProfile([[0.0, len * 0.42], [0.0118, len * 0.42], [0.0094, len * 0.7], [0.0066, f0], [0.0, f0]], 16);
  parts.butt = G.latheFromProfile([[0, 0], [0.0135, 0], [0.0145, 0.006], [0.0145, 0.02], [0.0139, len * 0.25], [0.0124, len * 0.42], [0, len * 0.42]], 16);
  parts.ferrule = G.latheFromProfile([[0, f0], [0.0067, f0], [0.0066, t0], [0, t0]], 14);
  parts.tip = G.latheFromProfile([[0, t0], [0.0064, t0], [0.0063, len - 0.002], [0.004, len], [0, len + 0.0005]], 14);
  parts.wrap = G.latheFromProfile([[0.0, len * 0.05], [0.0148, len * 0.05], [0.0149, len * 0.06], [0.0147, len * 0.2], [0.0146, len * 0.21], [0.0, len * 0.21]], 16);
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
    // brass chain: oval links alternating 90 degrees, from the canopy hook down to a ring on the bar
    const linkL = 0.034, n = Math.floor((drop - 0.1) / (linkL * 0.78));
    const linkG = new THREE.TorusGeometry(0.0105, 0.0026, 6, 14); linkG.scale(1, 1.6, 1);
    const chain = new THREE.InstancedMesh(linkG, mats.brass, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      q.setFromAxisAngle(V3(0, 1, 0), (i % 2) * Math.PI / 2 + 0.3);
      m4.compose(V3(0, -0.07 - i * linkL * 0.78, sz * rodZ), q, V3(1, 1, 1));
      chain.setMatrixAt(i, m4);
    }
    chain.userData.keep = true; chain.castShadow = true; g.add(chain);
    g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 8, 20).rotateY(Math.PI / 2), mats.brass), 0, -drop + 0.035, sz * rodZ));
    g.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.016, 0], [0.012, 0.012], [0.006, 0.02], [0, 0.022]], 12), mats.brass), 0, -drop + 0.012, sz * rodZ));
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
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.176, 0.003, 6, 40).rotateX(Math.PI / 2), mats.shadeRim || mats.shadeInner); rim.position.y = -0.192; rim.userData.noShadow = true; sg.add(rim);
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
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, W - 0.1, 8), mats.brass);
    for (const sx of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 10).rotateX(Math.PI / 2), mats.brass), sx * (W / 2 - 0.05), y, 0.025));
    wire.rotation.z = Math.PI / 2; wire.position.set(0, y, 0.04); g.add(wire);
    for (let i = 0; i < 20; i++) {
      const left = i < (k ? 13 : 7);
      const x = left ? -W / 2 + 0.08 + i * 0.024 : W / 2 - 0.08 - (19 - i) * 0.024;
      const b = new THREE.Mesh(beadG, i % 5 === 4 ? mats.ebony : mats.ivory);
      b.scale.set(0.7, 1, 1);
      b.position.set(x, y, 0.04); g.add(b);
    }
  }
  // carved crest: a broken scroll pediment with a gilt cartouche
  {
    const cs = new THREE.Shape();
    cs.moveTo(-W / 2 + 0.02, 0); cs.lineTo(W / 2 - 0.02, 0);
    cs.bezierCurveTo(W / 2 + 0.01, 0.05, W / 2 - 0.04, 0.12, W / 2 - 0.1, 0.1);
    cs.bezierCurveTo(W / 2 - 0.16, 0.08, W / 2 - 0.14, 0.03, W / 2 - 0.19, 0.06);
    cs.bezierCurveTo(0.14, 0.12, 0.08, 0.22, 0.0, 0.24);
    cs.bezierCurveTo(-0.08, 0.22, -0.14, 0.12, -W / 2 + 0.19, 0.06);
    cs.bezierCurveTo(-W / 2 + 0.14, 0.03, -W / 2 + 0.16, 0.08, -W / 2 + 0.1, 0.1);
    cs.bezierCurveTo(-W / 2 + 0.04, 0.12, -W / 2 - 0.01, 0.05, -W / 2 + 0.02, 0);
    for (const sx of [-1, 1]) { const h = new THREE.Path(); h.absarc(sx * (W / 2 - 0.1), 0.055, 0.022, 0, Math.PI * 2, sx > 0); cs.holes.push(h); }
    const e = new THREE.ExtrudeGeometry(cs, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 16 });
    g.add(at(new THREE.Mesh(G.applyBoxUVs(e, 1.5), mats.wood), 0, 1.6, 0.012));
    const cart = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 12), mats.gilt); cart.scale.set(0.8, 1, 0.3); cart.position.set(0, 1.71, 0.05); g.add(cart);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.007, 8, 28), mats.gilt); ring.scale.set(0.8, 1, 1); ring.position.set(0, 1.71, 0.045); g.add(ring);
    for (const sx of [-1, 1]) { const f = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.02, 0], [0.025, 0.02], [0.012, 0.05], [0.016, 0.07], [0, 0.09]], 12), mats.gilt); f.position.set(sx * (W / 2 - 0.025), 1.62, 0.04); g.add(f); }
  }
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
  // turned front legs: toupie foot, tapered shaft, ring-and-vase turning, square block under the seat rail
  const legG = G.latheFromProfile([[0, 0], [0.013, 0], [0.016, 0.01], [0.012, 0.022], [0.0115, 0.06], [0.0135, 0.11], [0.0175, 0.17], [0.0195, 0.21], [0.016, 0.245], [0.012, 0.262], [0.017, 0.275], [0.019, 0.288], [0.0145, 0.3], [0.016, 0.33], [0.0185, 0.345], [0.0185, 0.36], [0, 0.36]], 18);
  for (const x of [-0.2, 0.2]) {
    g.add(at(new THREE.Mesh(legG, mats.wood), x, 0, 0.19));
    g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.038, 0.07, 0.038, 1, 0.004), mats.wood), x, 0.395, 0.19));
  }
  // back legs: square-section sabre curve rising into the back uprights
  for (const sx of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([V3(sx * 0.19, 0, -0.27), V3(sx * 0.19, 0.22, -0.21), V3(sx * 0.185, seatH, -0.19), V3(sx * 0.18, 0.66, -0.22), V3(sx * 0.17, 0.86, -0.26)]);
    g.add(new THREE.Mesh(taperedTube(curve, 24, 0.016, 0.013, 8), mats.wood));
  }
  // H-stretcher: turned side rails and a cross rail
  const strG = G.latheFromProfile([[0, 0], [0.008, 0], [0.01, 0.04], [0.007, 0.1], [0.011, 0.2], [0.007, 0.3], [0.01, 0.36], [0.008, 0.4], [0, 0.4]], 10);
  for (const sx of [-1, 1]) { const st = new THREE.Mesh(strG, mats.wood); st.rotation.x = Math.PI / 2; st.scale.y = 0.445 / 0.4; st.position.set(sx * 0.196, 0.14, -0.245 + 0.445); st.rotation.x = -Math.PI / 2; st.position.z = 0.2; g.add(st); }
  { const cr = new THREE.Mesh(strG, mats.wood); cr.rotation.z = Math.PI / 2; cr.scale.y = 0.39 / 0.4; cr.position.set(0.195, 0.15, -0.02); g.add(cr); }
  // carved crest rail with a scrolled, shell-carved top
  {
    const cs = new THREE.Shape();
    cs.moveTo(-0.185, 0); cs.lineTo(0.185, 0); cs.bezierCurveTo(0.2, 0.035, 0.17, 0.075, 0.12, 0.07); cs.bezierCurveTo(0.07, 0.065, 0.045, 0.1, 0, 0.11);
    cs.bezierCurveTo(-0.045, 0.1, -0.07, 0.065, -0.12, 0.07); cs.bezierCurveTo(-0.17, 0.075, -0.2, 0.035, -0.185, 0);
    for (const sx of [-1, 1]) { const h = new THREE.Path(); h.absellipse(sx * 0.11, 0.038, 0.022, 0.014, 0, Math.PI * 2, true); cs.holes.push(h); }
    const e = new THREE.ExtrudeGeometry(cs, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.0045, bevelSegments: 4, curveSegments: 24 });
    e.translate(0, 0, -0.007);
    const crest = new THREE.Mesh(G.applyBoxUVs(e, 7), mats.carve || mats.wood); crest.position.set(0, 0.79, -0.252); crest.rotation.x = -0.18; g.add(crest);
    // carved shell at the top centre
    const sh = new THREE.Mesh(G.latheFromProfile([[0, 0.006], [0.012, 0.005], [0.022, 0.003], [0.028, 0]], 14, 0, Math.PI).rotateX(Math.PI / 2), mats.wood);
    sh.material = mats.carve || mats.wood; sh.position.set(0, 0.875, -0.268); sh.rotation.x = -0.18; g.add(sh);
  }
  // pierced vase splat, 18 mm thick: a central vesica, a pair of C-scrolls and a tear-drop
  {
    const sp = new THREE.Shape();
    sp.moveTo(-0.035, 0); sp.bezierCurveTo(-0.035, 0.05, -0.105, 0.08, -0.095, 0.16); sp.bezierCurveTo(-0.085, 0.24, -0.03, 0.25, -0.05, 0.31);
    sp.lineTo(0.05, 0.31); sp.bezierCurveTo(0.03, 0.25, 0.085, 0.24, 0.095, 0.16); sp.bezierCurveTo(0.105, 0.08, 0.035, 0.05, 0.035, 0);
    sp.lineTo(-0.035, 0);
    const h1 = new THREE.Path(); h1.moveTo(0, 0.07); h1.bezierCurveTo(0.03, 0.11, 0.03, 0.16, 0, 0.2); h1.bezierCurveTo(-0.03, 0.16, -0.03, 0.11, 0, 0.07); sp.holes.push(h1);
    for (const sx of [-1, 1]) {
      const h = new THREE.Path();
      h.moveTo(sx * 0.045, 0.1); h.bezierCurveTo(sx * 0.08, 0.12, sx * 0.08, 0.19, sx * 0.05, 0.215); h.bezierCurveTo(sx * 0.06, 0.18, sx * 0.06, 0.13, sx * 0.045, 0.1);
      if (sx > 0) { const pts = h.getPoints(16).reverse(); const hp = new THREE.Path(pts); sp.holes.push(hp); } else sp.holes.push(h);
    }
    const h2 = new THREE.Path(); h2.absellipse(0, 0.255, 0.012, 0.02, 0, Math.PI * 2, true); sp.holes.push(h2);
    const e = new THREE.ExtrudeGeometry(sp, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 4, curveSegments: 24 });
    e.translate(0, 0, -0.005);
    const splat = new THREE.Mesh(G.applyBoxUVs(e, 7), mats.carve || mats.wood); splat.position.set(0, seatH + 0.06, -0.218); splat.rotation.x = -0.14; g.add(splat);
    // shoe rail the splat stands in
    g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.12, 0.025, 0.035, 1, 0.006), mats.wood), 0, seatH + 0.055, -0.21));
  }
  // seat rails with a serpentine, moulded front apron
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.44, 0.06, 0.42, 2, 0.01), mats.wood), 0, seatH - 0.05, -0.005));
  {
    const ap = new THREE.Shape(); ap.moveTo(-0.22, 0); ap.lineTo(0.22, 0); ap.lineTo(0.22, -0.035); ap.bezierCurveTo(0.12, -0.035, 0.08, -0.06, 0, -0.06); ap.bezierCurveTo(-0.08, -0.06, -0.12, -0.035, -0.22, -0.035); ap.lineTo(-0.22, 0);
    const ae = new THREE.ExtrudeGeometry(ap, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 12 });
    g.add(at(new THREE.Mesh(G.applyBoxUVs(ae, 2), mats.wood), 0, seatH - 0.022, 0.2));
  }
  // stuffed over-rail seat: deep domed top falling to a piped edge, close-nailed along the rail
  {
    const w = 0.45, d = 0.43;
    const sg = new THREE.PlaneGeometry(w, d, 28, 28); sg.rotateX(-Math.PI / 2);
    const p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const u = Math.abs(x) / (w / 2), v = Math.abs(z) / (d / 2);
      const e = Math.max(u, v);
      const dome = Math.cos(Math.min(1, Math.pow(Math.hypot(u * 0.92, v * 0.92), 2.4)) * Math.PI / 2);
      let y = 0.045 * Math.pow(Math.max(0, dome), 0.6);
      if (e > 0.94) y -= (e - 0.94) * 0.5;               // roll over the edge down to the piping
      // a slight sitting hollow toward the back
      y -= 0.006 * Math.exp(-((x / 0.1) ** 2 + ((z + 0.03) / 0.1) ** 2));
      p.setY(i, y);
    }
    sg.computeVertexNormals();
    g.add(at(new THREE.Mesh(sg, mats.seat), 0, seatH - 0.02, 0.0));
    // skirt of the upholstery down the rail sides
    const sk = new THREE.Mesh(new G.RoundedBoxGeometry(w + 0.004, 0.03, d + 0.004, 2, 0.012), mats.seat); sk.position.set(0, seatH - 0.025, 0.0); g.add(sk);
    const pipe = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0045, 6, 64), mats.seat); pipe.scale.set(w / 2 + 0.002, d / 2 + 0.002, 1); pipe.rotation.x = Math.PI / 2; pipe.position.set(0, seatH - 0.011, 0); g.add(pipe);
  }
  // brass nailheads close-nailed round three sides
  const studs = [];
  for (let i = 0; i <= 22; i++) studs.push(V3(-0.226 + i * (0.452 / 22), seatH - 0.03, 0.218));
  for (const sx of [-1, 1]) for (let i = 0; i <= 18; i++) studs.push(V3(sx * 0.228, seatH - 0.03, -0.2 + i * (0.41 / 18)));
  const nail = new THREE.SphereGeometry(0.0042, 6, 4);
  const im = new THREE.InstancedMesh(nail, mats.brass || mats.wood, studs.length);
  const m4 = new THREE.Matrix4();
  studs.forEach((s, i) => { m4.makeTranslation(s.x, s.y, s.z); im.setMatrixAt(i, m4); });
  g.add(im);
  return g;
}

/**
 * Diamond-tufted leather panel in XY facing +Z, w x h: pillows between deep buttons, creases running
 * along the diamond edges, an overall stuffed belly. Returns { geometry, buttons: [Vector3...] } (local).
 */
export function tuftedPanel(w, h, { cols = 4, rows = 2, depth = 0.03, belly = 0.025, seg = 4 } = {}) {
  const sx = w / cols, sy = h / rows;
  const nx = Math.max(24, Math.round(cols * 8 * seg / 4)), ny = Math.max(16, Math.round(rows * 8 * seg / 4));
  const g = new THREE.PlaneGeometry(w, h, nx * 2, ny * 2);
  const p = g.attributes.position;
  const buttons = [];
  for (let j = 0; j <= rows * 2; j++) for (let i = 0; i <= cols * 2; i++) {
    if ((i + j) % 2) continue;
    const x = -w / 2 + (i / 2) * sx, y = -h / 2 + (j / 2) * sy;
    if (i === 0 || j === 0 || i === cols * 2 || j === rows * 2) continue;
    buttons.push(new THREE.Vector3(x, y, 0));
  }
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), y = p.getY(k);
    const u = (x + w / 2) / w, v = (y + h / 2) / h;
    const a = (x + w / 2) / sx + (y + h / 2) / sy, b = (x + w / 2) / sx - (y + h / 2) / sy;
    const pill = Math.pow(Math.abs(Math.sin(Math.PI * a / 2) * Math.sin(Math.PI * b / 2)), 0.55);
    let dimple = 0;
    for (const bt of buttons) { const d2 = ((x - bt.x) / (sx * 0.22)) ** 2 + ((y - bt.y) / (sy * 0.22)) ** 2; dimple = Math.max(dimple, Math.exp(-d2)); }
    const edge = Math.pow(Math.max(0, Math.sin(Math.PI * u) * Math.sin(Math.PI * v)), 0.35);
    const z = belly * edge + depth * pill * edge - depth * 0.6 * dimple;
    p.setZ(k, z);
  }
  g.computeVertexNormals();
  for (const bt of buttons) {
    const u = (bt.x + w / 2) / w, v = (bt.y + h / 2) / h;
    bt.z = belly * Math.pow(Math.max(0, Math.sin(Math.PI * u) * Math.sin(Math.PI * v)), 0.35) - depth * 0.6 + 0.004;
  }
  return { geometry: g, buttons };
}

export function buildChesterfield(ctx, mats) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'chesterfield';
  const W = 1.0, D = 0.9, foot = 0.07, seatY = 0.44, topY = 0.76;
  const L = mats.leather;
  const btnG = new THREE.SphereGeometry(0.009, 10, 6); btnG.scale(1, 1, 0.6);
  const buttons = [];
  const addTuft = (w, h, opts, place) => {
    const t = tuftedPanel(w, h, opts);
    const m = new THREE.Mesh(t.geometry, L); place(m); g.add(m);
    m.updateMatrix();
    for (const b of t.buttons) buttons.push(b.clone().applyMatrix4(m.matrix));
  };
  // plinth: the sprung base, leather over a rounded box, with a nailhead line along the bottom
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(W, seatY - foot - 0.09, D, 4, 0.035), L), 0, foot + (seatY - foot - 0.09) / 2, 0));
  // loose seat cushion: domed, piped
  {
    const cw = W - 0.3, cd = D - 0.26, ch = 0.12;
    const cg = new G.RoundedBoxGeometry(cw, ch, cd, 6, 0.045);
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (y > 0) { const d = Math.max(0, 1 - (x / (cw / 2)) ** 4) * Math.max(0, 1 - (z / (cd / 2)) ** 4); p.setY(i, y + d * 0.025 - 0.006 * Math.cos(x * 30) * d); } }
    cg.computeVertexNormals();
    g.add(at(new THREE.Mesh(cg, L), 0, seatY - 0.09 + ch / 2, 0.08));
    const pip = new THREE.Mesh(new THREE.TorusGeometry(1, 0.006, 6, 64), L);
    pip.scale.set(cw / 2 - 0.01, cd / 2 - 0.01, 1); pip.rotation.x = Math.PI / 2; pip.position.set(0, seatY - 0.09 + ch - 0.015, 0.08); g.add(pip);
  }
  // back block + tufted inner face
  const backT = 0.2;
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(W, topY - seatY + 0.11, backT, 4, 0.03), L), 0, seatY - 0.11 + (topY - seatY + 0.11) / 2, -D / 2 + backT / 2));
  addTuft(W - 0.31, topY - seatY - 0.04, { cols: 5, rows: 2, depth: 0.028, belly: 0.02 }, (m) => { m.position.set(0, seatY + (topY - seatY - 0.04) / 2 - 0.01, -D / 2 + backT + 0.002); });
  // arms: blocks with tufted inner faces, scroll-rolled tops, studded scroll fronts
  const armW = 0.15;
  for (const sx of [-1, 1]) {
    const ax = sx * (W / 2 - armW / 2);
    g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(armW, topY - seatY + 0.12, D - 0.02, 4, 0.03), L), ax, seatY - 0.12 + (topY - seatY + 0.12) / 2, 0));
    addTuft(D - backT - 0.06, topY - seatY - 0.06, { cols: 3, rows: 2, depth: 0.025, belly: 0.018 }, (m) => { m.rotation.y = -sx * Math.PI / 2; m.position.set(ax - sx * (armW / 2 + 0.002), seatY + (topY - seatY - 0.06) / 2 - 0.01, backT / 2 - 0.02); });
    // scroll roll along the arm top, curling outward
    const rollR = 0.07;
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(rollR, rollR, D - 0.02, 28, 1, true), L); roll.rotation.x = Math.PI / 2; roll.position.set(ax + sx * 0.022, topY - 0.03, 0); g.add(roll);
    // scrolled front: a spiral-pleated disc and the panel beneath it
    const sd = G.latheFromProfile([[0.0, 0.012], [0.02, 0.014], [0.035, 0.008], [0.05, 0.012], [0.062, 0.004], [rollR + 0.002, 0.0]], 28).rotateX(Math.PI / 2);
    const sp = sd.attributes.position;
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i); const r = Math.hypot(x, y), a = Math.atan2(y, x); sp.setZ(i, sp.getZ(i) + 0.005 * Math.sin(a * 2 + r * 90) * (r / rollR)); }
    sd.computeVertexNormals();
    g.add(at(new THREE.Mesh(sd, L), ax + sx * 0.022, topY - 0.03, D / 2 - 0.01));
    const fp = new THREE.Mesh(new G.RoundedBoxGeometry(armW + 0.02, topY - foot - 0.1, 0.02, 2, 0.008), L); fp.position.set(ax + sx * 0.008, foot + (topY - foot - 0.1) / 2, D / 2 - 0.005); g.add(fp);
  }
  // back roll
  const broll = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, W + 0.02, 28, 1, true), L); broll.rotation.z = Math.PI / 2; broll.position.set(0, topY - 0.025, -D / 2 + backT / 2 - 0.015); g.add(broll);
  for (const sx of [-1, 1]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14, 0, Math.PI), L); cap.rotation.y = sx * Math.PI / 2; cap.position.set(sx * (W / 2 + 0.01), topY - 0.025, -D / 2 + backT / 2 - 0.015); g.add(cap); }
  // buttons
  const bm = new THREE.InstancedMesh(btnG, mats.leatherDark || L, buttons.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  buttons.forEach((b, i) => { m4.compose(b, q.identity(), V3(1, 1, 1)); bm.setMatrixAt(i, m4); });
  // buttons on the arm faces need turning: rebuild orientation from position (arm buttons have |x| near the arm face)
  buttons.forEach((b, i) => { if (Math.abs(b.x) > W / 2 - armW - 0.01) { e.set(0, -Math.sign(b.x) * Math.PI / 2, 0); q.setFromEuler(e); } else q.identity(); m4.compose(b, q, V3(1, 1, 1)); bm.setMatrixAt(i, m4); });
  bm.userData.keep = true; g.add(bm);
  // brass nailheads: round each scroll front, down the arm fronts and along the bottom of the plinth
  const studs = [];
  for (const sx of [-1, 1]) {
    const cx = sx * (W / 2 - armW / 2) + sx * 0.022, cy = topY - 0.03;
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; studs.push(V3(cx + Math.cos(a) * 0.074, cy + Math.sin(a) * 0.074, D / 2 - 0.006)); }
    const x0 = sx * (W / 2 - armW / 2) + sx * 0.008;
    for (const dx of [-1, 1]) for (let y = foot + 0.04; y < cy - 0.08; y += 0.024) studs.push(V3(x0 + dx * (armW / 2 + 0.002), y, D / 2 + 0.006));
  }
  for (let x = -W / 2 + 0.03; x <= W / 2 - 0.03; x += 0.024) studs.push(V3(x, foot + 0.025, D / 2 + 0.002));
  const studG = new THREE.SphereGeometry(0.0055, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2); studG.rotateX(Math.PI / 2);
  const st = new THREE.InstancedMesh(studG, mats.brass || mats.wood, studs.length);
  studs.forEach((s, i) => { m4.compose(s, q.identity(), V3(1, 1, 1)); st.setMatrixAt(i, m4); });
  st.userData.keep = true; g.add(st);
  // turned bun feet on brass castors
  const fG = G.latheFromProfile([[0, 0.012], [0.035, 0.012], [0.05, 0.03], [0.048, 0.055], [0.03, 0.07], [0.0, 0.072]], 16);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(at(new THREE.Mesh(fG, mats.wood), sx * (W / 2 - 0.08), 0, sz * (D / 2 - 0.08)));
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 12).rotateZ(Math.PI / 2), mats.brass || mats.wood), sx * (W / 2 - 0.08), 0.008, sz * (D / 2 - 0.08)));
  }
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
/** A scroll console (corbel) profile in the YZ plane: back against the surround at z=0, top at y=0, projecting +z. */
function corbelShape(h, d) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(d, 0);
  s.bezierCurveTo(d + 0.012, -0.01, d + 0.01, -0.045, d - 0.012, -0.05);   // upper volute
  s.bezierCurveTo(d - 0.035, -0.055, d - 0.04, -0.03, d - 0.025, -0.025);
  s.bezierCurveTo(d * 0.45, -h * 0.35, d * 0.25, -h * 0.75, d * 0.32, -h + 0.03); // S-curve down
  s.bezierCurveTo(d * 0.36, -h + 0.005, d * 0.2, -h - 0.004, d * 0.12, -h);   // lower volute
  s.lineTo(0, -h); s.lineTo(0, 0);
  return s;
}

export function buildFireplace(ctx, mats, { seed = 3 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'fireplace';
  const W = 1.7, Hm = 1.28, openW = 0.84, openH = 0.82, D = 0.3;
  const holeW = 0.6, holeH = 0.68;                     // arched opening of the cast-iron insert
  // ------------------------------------------------ marble surround: pilasters with sunk fluted panels, plinths, corbels
  for (const sx of [-1, 1]) {
    const px = sx * (openW / 2 + 0.17);
    g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.3, Hm - 0.12, D, 2, 0.008), mats.marble), px, (Hm - 0.12) / 2, D / 2));
    // sunk panel with flutes and a carved patera at the top
    const pnl = new THREE.Mesh(G.raisedPanel(0.2, Hm - 0.5, { border: 0.018, bevel: 0.01, fieldDepth: 0.003, frameDepth: 0.006 }), mats.marble);
    pnl.position.set(px, 0.14 + (Hm - 0.5) / 2, D + 0.001); g.add(pnl);
    {
      // five carved flutes: one smooth grooved field (concave cosine flutes with rounded fillets), not loose cylinders
      const fw = 0.15, fh = Hm - 0.6, nf = 5;
      const fg = new THREE.PlaneGeometry(fw, fh, nf * 16, 24);
      const fp = fg.attributes.position;
      for (let k = 0; k < fp.count; k++) {
        const x = fp.getX(k), y = fp.getY(k);
        const u = (x / fw + 0.5) * nf, f = u - Math.floor(u);
        const groove = Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (f - 0.12) / 0.76)))), 0.8);
        const endT = Math.min(1, (fh / 2 - Math.abs(y)) / 0.04);           // rounded stopped ends
        fp.setZ(k, -0.006 * groove * Math.sqrt(Math.max(0, endT)));
      }
      fg.computeVertexNormals();
      const fl = new THREE.Mesh(G.applyBoxUVs(fg, 1), mats.marbleDark);
      fl.position.set(px, 0.19 + fh / 2, D + 0.0045); g.add(fl);
    }
    const pat = new THREE.Mesh(G.latheFromProfile([[0, 0.018], [0.012, 0.017], [0.022, 0.012], [0.03, 0.004], [0.034, 0]], 16).rotateX(Math.PI / 2), mats.marbleDark);
    pat.position.set(px, Hm - 0.3, D + 0.004); g.add(pat);
    // plinth block
    g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.34, 0.14, D + 0.04, 2, 0.01), mats.marble), px, 0.07, D / 2 + 0.01));
    // scroll corbel under the shelf, the console face carved with a leaf
    const cg = new THREE.ExtrudeGeometry(corbelShape(0.24, 0.1), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 18 });
    cg.translate(0, 0, -0.08); cg.rotateY(-Math.PI / 2);
    const corbel = new THREE.Mesh(G.applyBoxUVs(cg, 2), mats.marble);
    corbel.position.set(px, Hm - 0.07, D); g.add(corbel);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), mats.marbleDark); leaf.scale.set(1.2, 2.4, 0.5); leaf.position.set(px, Hm - 0.2, D + 0.045); g.add(leaf);
  }
  // frieze with a carved central tablet
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(openW + 0.06, 0.28, D - 0.02, 2, 0.01), mats.marble), 0, openH + 0.14 + 0.02, D / 2 - 0.01));
  const tab = new THREE.Mesh(G.raisedPanel(0.32, 0.16, { border: 0.02, bevel: 0.015, fieldDepth: 0.006, frameDepth: 0.008 }), mats.marble); tab.position.set(0, openH + 0.16, D - 0.02); g.add(tab);
  const swag = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 24, Math.PI), mats.marbleDark); swag.rotation.z = Math.PI; swag.position.set(0, openH + 0.2, D - 0.002); swag.scale.set(1, 0.5, 0.6); g.add(swag);
  // mantel shelf: moulded edge, and a bed moulding beneath
  const shelf = new THREE.Mesh(slab(rectShape(W, D + 0.12, 0.02), 0.06, 0.02, 4), mats.marble);
  shelf.position.set(0, Hm - 0.06, D / 2 + 0.03); g.add(shelf);
  const under = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.06, 0.045).map((p) => V2(p.x, p.y)), [V3(-W / 2 + 0.06, 0, 0), V3(-W / 2 + 0.06, 0, D + 0.03), V3(W / 2 - 0.06, 0, D + 0.03), V3(W / 2 - 0.06, 0, 0)].map((p) => V3(p.x, p.y, -p.z)), { uvScale: 2 }), mats.marble);
  under.scale.z = -1; under.position.set(0, Hm - 0.12, 0); g.add(under);

  // ------------------------------------------------ cast-iron register insert: frame, tile slips, arched opening, hood
  const insW = openW + 0.06, insH = openH + 0.04;
  const ins = new THREE.Shape(); ins.moveTo(-insW / 2, 0); ins.lineTo(insW / 2, 0); ins.lineTo(insW / 2, insH); ins.lineTo(-insW / 2, insH); ins.lineTo(-insW / 2, 0);
  const archP = (p) => { p.moveTo(-holeW / 2, 0); p.lineTo(-holeW / 2, holeH - holeW / 2); p.absarc(0, holeH - holeW / 2, holeW / 2, Math.PI, 0, true); p.lineTo(holeW / 2, 0); p.lineTo(-holeW / 2, 0); };
  const ih = new THREE.Path(); archP(ih); ins.holes.push(ih);
  // tile slip windows either side
  const tileW = 0.105, tileX = holeW / 2 + 0.018 + tileW / 2, tileY0 = 0.1, nT = 5;
  for (const sx of [-1, 1]) { const th = new THREE.Path(); const x0 = sx * tileX - tileW / 2, x1 = sx * tileX + tileW / 2; th.moveTo(x0, tileY0); th.lineTo(x0, tileY0 + tileW * nT); th.lineTo(x1, tileY0 + tileW * nT); th.lineTo(x1, tileY0); th.lineTo(x0, tileY0); ins.holes.push(th); }
  const insG = G.applyBoxUVs(new THREE.ExtrudeGeometry(ins, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2, curveSegments: 24 }), 2);
  g.add(at(new THREE.Mesh(insG, mats.castIron || mats.iron), 0, 0, 0.245));
  // a raised beaded rim round the arch
  {
    const pts = [];
    pts.push(V3(-holeW / 2 - 0.012, 0.02, 0));
    for (let i = 0; i <= 24; i++) { const a = Math.PI - (i / 24) * Math.PI; pts.push(V3(Math.cos(a) * (holeW / 2 + 0.012), holeH - holeW / 2 + Math.sin(a) * (holeW / 2 + 0.012), 0)); }
    pts.push(V3(holeW / 2 + 0.012, 0.02, 0));
    const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.008, 8, false), mats.castIron || mats.iron);
    rim.position.z = 0.282; g.add(rim);
  }
  // tiles
  for (const sx of [-1, 1]) for (let i = 0; i < nT; i++) {
    const tg = G.planeUV(tileW - 0.002, tileW - 0.002, 1); const uv = tg.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / (tileW - 0.002), i + (sx > 0 ? 7 : 0) + uv.getY(k) / (tileW - 0.002));
    g.add(at(new THREE.Mesh(tg, mats.tile || mats.marble), sx * tileX, tileY0 + tileW * (i + 0.5), 0.258));
  }
  // canopy hood projecting over the top of the opening, with a scalloped lip
  {
    const hood = new THREE.SphereGeometry(1, 32, 10, 0, Math.PI, 0, Math.PI / 2);
    hood.rotateX(-Math.PI / 2); hood.rotateZ(0);
    const p = hood.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (holeW / 2 + 0.03), p.getZ(i) * 0.06 + 0.0, p.getY(i) * 0.09);
    hood.computeVertexNormals();
    const hm = new THREE.Mesh(hood, mats.castIron || mats.iron);
    hm.position.set(0, holeH + 0.005, 0.27); hm.scale.set(1, 1, 1); g.add(hm);
  }
  // ------------------------------------------------ firebox: firebrick back and splayed cheeks, soot climbing the back
  const inner = new THREE.Group(); inner.position.z = 0.17; g.add(inner);
  const box = new THREE.Group();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(openW, openH), mats.soot || mats.brick); back.position.set(0, openH / 2, -0.16); box.add(back);
  for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.32, openH), mats.soot || mats.brick); c.rotation.y = -sx * Math.PI / 2 + sx * 0.35; c.position.set(sx * (holeW / 2 - 0.04), openH / 2, -0.02); box.add(c); }
  const roofP = new THREE.Mesh(G.planeUV(openW, 0.42, 1), mats.iron); roofP.rotation.x = Math.PI / 2 + 0.3; roofP.position.set(0, holeH - 0.01, 0.02); box.add(roofP);
  const ashG = new THREE.PlaneGeometry(holeW, 0.3).rotateX(-Math.PI / 2);
  box.add(at(new THREE.Mesh(ashG, mats.ash || mats.soot), 0, 0.052, -0.02));
  inner.add(box);
  // hearth: dark marble slab with a moulded edge, and an inset of tiles in front of the opening
  g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(W + 0.1, 0.05, 0.75, 3, 0.014), mats.marbleDark), 0, 0.025, 0.37));
  // ------------------------------------------------ grate basket, coals, logs, flames
  const grate = new THREE.Group();
  for (let i = 0; i < 8; i++) grate.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 8), mats.iron), -0.21 + i * 0.06, 0.14, 0.06));
  for (const y of [0.06, 0.15, 0.23]) grate.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.48, 0.014, 0.016, 1, 0.004), mats.iron), 0, y, 0.06));
  for (const sx of [-1, 1]) grate.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.018, 0], [0.012, 0.04], [0.016, 0.06], [0.01, 0.2], [0.022, 0.24], [0.0, 0.28]], 12), mats.iron), sx * 0.25, 0.05, 0.07));
  inner.add(grate);
  const rnd = ctx.random.fork('gr-fire');
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 0.9, emissive: new THREE.Color(0.9, 0.16, 0.02), emissiveIntensity: 0.7, name: 'coal' });
  const coals = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.03, 0), coalMat, 34);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 34; i++) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd.next() * 3, rnd.next() * 3, rnd.next() * 3));
    const sc = 0.6 + rnd.next() * 0.8;
    m4.compose(V3(-0.21 + rnd.next() * 0.42, 0.1 + rnd.next() * 0.07, -0.12 + rnd.next() * 0.17), q, V3(sc, sc * 0.8, sc));
    coals.setMatrixAt(i, m4);
  }
  coals.userData.noBake = true; coals.userData.keep = true;
  inner.add(coals);
  const logMat = mats.log || new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.95, emissive: new THREE.Color(0.9, 0.22, 0.04), emissiveIntensity: 0.3, name: 'log' });
  const endMat = new THREE.MeshStandardMaterial({ color: 0x140c08, roughness: 0.9, emissive: new THREE.Color(1.0, 0.3, 0.06), emissiveIntensity: 0.6, name: 'logEnd' });
  for (const [x, ry, y, r, l] of [[-0.04, 0.28, 0.17, 0.05, 0.5], [0.07, -0.32, 0.18, 0.046, 0.46], [0.01, 0.06, 0.255, 0.042, 0.44]]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r, l, 16, 1, true), logMat);
    log.rotation.z = Math.PI / 2; log.rotation.y = ry; log.position.set(x, y, -0.06); log.userData.keep = true; inner.add(log);
    for (const e of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CircleGeometry(r * (e > 0 ? 0.94 : 1), 16), endMat); cap.position.y = e * l / 2; cap.rotation.x = -Math.PI / 2 * e; log.add(cap); }
  }
  const flames = fireFlames({ width: 0.44, height: 0.44, count: 6, rnd, intensity: 2.4, time: ctx.time });
  flames.position.set(0, 0.17, -0.05); inner.add(flames);
  const back2 = fireFlames({ width: 0.36, height: 0.3, count: 4, rnd, intensity: 1.5, time: ctx.time });
  back2.position.set(0.02, 0.2, -0.12); inner.add(back2);
  const sp = sparks({ count: 22, width: 0.36, depth: 0.12, height: 0.6, rnd, time: ctx.time }); sp.position.set(0, 0.25, -0.05); inner.add(sp);
  // ------------------------------------------------ andirons (fire-dogs): iron legs and bar, brass urn finials
  for (const sx of [-1, 1]) {
    const fd = new THREE.Group();
    fd.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.02, 0], [0.026, 0.03], [0.016, 0.06], [0.013, 0.15], [0.02, 0.17], [0.012, 0.19], [0, 0.19]], 14), mats.iron), 0, 0.05, 0));
    fd.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.018, 0], [0.03, 0.03], [0.034, 0.05], [0.02, 0.075], [0.026, 0.085], [0.008, 0.11], [0, 0.12]], 18), mats.iron), 0, 0.24, 0));
    for (const lx of [-1, 1]) { const leg = new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([V3(0, 0.1, 0), V3(lx * 0.05, 0.06, 0), V3(lx * 0.08, 0.005, 0.01)]), 10, 0.009, 0.007, 6), mats.iron); leg.position.y = 0.05; fd.add(leg); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 8).rotateX(Math.PI / 2), mats.iron); bar.position.set(0, 0.1, -0.16); fd.add(bar);
    fd.position.set(sx * 0.2, 0, 0.33); g.add(fd);
  }
  // ------------------------------------------------ brass fender with knob finials
  const fprof = [V2(0, 0), V2(0.014, 0), V2(0.016, 0.012), V2(0.009, 0.03), V2(0.01, 0.07), V2(0.018, 0.085), V2(0.016, 0.1), V2(0, 0.105)];
  g.add(new THREE.Mesh(G.sweepProfile(fprof, [V3(-0.74, 0.05, 0.3), V3(-0.74, 0.05, 0.66), V3(0.74, 0.05, 0.66), V3(0.74, 0.05, 0.3)], { uvScale: 2 }), mats.brass));
  for (const sx of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), mats.brass), sx * 0.74, 0.165, 0.66));
  // ------------------------------------------------ fire-irons on a stand: poker, tongs, shovel (blackened iron, brass grips)
  {
    const fi = new THREE.Group();
    fi.add(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.09, 0], [0.095, 0.012], [0.07, 0.02], [0.03, 0.03], [0.02, 0.05], [0, 0.05]], 20), mats.iron));
    fi.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.62, 10), mats.iron), 0, 0.36, 0));
    fi.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.02, 0], [0.024, 0.02], [0.012, 0.04], [0, 0.06]], 12), mats.brass), 0, 0.67, 0));
    // cross arms with hooks
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 6).rotateZ(Math.PI / 2), mats.iron); arm.position.set(Math.cos(a) * 0.05, 0.64, Math.sin(a) * 0.05); arm.rotation.y = -a; fi.add(arm);
      const tx = Math.cos(a) * 0.1, tz = Math.sin(a) * 0.1;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.6, 8), mats.iron); shaft.position.set(tx, 0.33, tz); fi.add(shaft);
      fi.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0], [0.016, 0.02], [0.013, 0.05], [0.017, 0.07], [0, 0.085]], 12), mats.brass), tx, 0.63, tz));
      if (i === 0) { const tip = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.05, 8), mats.iron); tip.position.set(tx, 0.03, tz); tip.rotation.x = Math.PI; fi.add(tip); const hk = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI), mats.iron); hk.position.set(tx + 0.016, 0.06, tz); fi.add(hk); }
      if (i === 1) { const blade = new THREE.Mesh(new G.RoundedBoxGeometry(0.09, 0.11, 0.006, 2, 0.003), mats.iron); blade.position.set(tx, 0.06, tz); blade.rotation.y = -a; blade.rotation.x = 0.1; fi.add(blade); }
      if (i === 2) { for (const d of [-1, 1]) { const tg = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.55, 6), mats.iron); tg.position.set(tx + d * 0.01, 0.31, tz); tg.rotation.z = d * 0.03; fi.add(tg); } }
    }
    fi.position.set(-0.98, 0.05, 0.52); g.add(fi);
  }
  g.userData = { flames, coals, coalMat, logMat, endMat, Hm, openW, openH, W, D };
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
  g.userData.lightPos = V3(0, 0.2, 0.23);
  return g;
}
