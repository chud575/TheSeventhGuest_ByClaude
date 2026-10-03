import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Kitchen furniture & props. Every builder returns a THREE.Group whose origin is
 * documented per function; geometry uses metre UVs (repeat = 1 / tile size).
 */

const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function mk(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

/** Rounded (bevelled) box with metre UVs. */
export function rbox(G, w, h, d, r = 0.006, seg = 2) {
  const g = new G.RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.1, h / 2.1, d / 2.1));
  return G.applyBoxUVs(g, 1);
}

/** Lathe with metre-ish UVs (u around, v = height). */
export function lathe(G, pts, seg = 32) {
  return G.latheFromProfile(pts, seg);
}

/** Tube along points. */
export function tube(pts, r, seg = 24, rs = 8, closed = false) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : V3(...p))), closed, 'centripetal');
  return new THREE.TubeGeometry(c, seg, r, rs, closed);
}

// =====================================================================================
// Cast-iron kitchen range ("close range"): origin = floor, centre of the front plane of
// the hob, facing +Z. Width 1.3 m. Returns { group, fireLightPos, fireLightDir, emberMat }.
// mat needs: iron, ironEdge, ironRelief(bump), brass, steel, soot, copper, tinLining, towel,
// emberMap, makerPlate (material with the maker's plate texture), dial (oven thermometer face).
// =====================================================================================
export function buildRange(ctx, mat) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'range';
  const W = 1.3, D = 0.6, HOB = 0.82;
  const z0 = -D;
  const iron = mat.iron, edge = mat.ironEdge, brass = mat.brass, steel = mat.steel;
  // plinth / hearth kerb, body
  g.add(mk(rbox(G, W + 0.08, 0.07, D + 0.06, 0.012), edge, 0, 0.035, -D / 2 + 0.01));
  g.add(mk(rbox(G, W, HOB - 0.1, D - 0.04, 0.01), iron, 0, 0.07 + (HOB - 0.1) / 2, -D / 2 - 0.01));
  // front framing: pilasters + rails (raised castings, edge-worn)
  for (const x of [-W / 2 + 0.02, -0.16, 0.16, W / 2 - 0.02]) {
    g.add(mk(rbox(G, 0.035, HOB - 0.14, 0.02, 0.006), edge, x, 0.07 + (HOB - 0.14) / 2, 0.006));
    // capital + base blocks
    g.add(mk(rbox(G, 0.05, 0.03, 0.028, 0.006), edge, x, HOB - 0.085, 0.008));
    g.add(mk(rbox(G, 0.05, 0.03, 0.028, 0.006), edge, x, 0.085, 0.008));
  }
  g.add(mk(rbox(G, W, 0.05, 0.02, 0.006), edge, 0, HOB - 0.055, 0.006));     // fascia
  g.add(mk(rbox(G, W, 0.025, 0.018, 0.005), edge, 0, 0.1, 0.005));          // bottom rail
  // maker's plate on the fascia
  {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.04), mat.makerPlate);
    plate.position.set(0, HOB - 0.055, 0.0175);
    g.add(plate);
    for (const x of [-0.16, 0.16]) g.add(mk(new THREE.SphereGeometry(0.005, 10, 6), brass, x, HOB - 0.055, 0.017));
  }
  // ---- oven doors: raised cast frame, relief field, brass strap hinges, latch; thermometer on the left
  const ovenDoor = (x, dir) => {
    const w = 0.4, h = 0.5;
    const dg = new THREE.Group();
    dg.add(mk(rbox(G, w, h, 0.022, 0.006), iron, 0, 0, 0.011));
    dg.add(mk(G.raisedPanel(w, h, { border: 0.045, bevel: 0.012, fieldDepth: 0.003, frameDepth: 0.012 }), edge, 0, 0, 0.022));
    const field = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.11, h - 0.11), mat.ironRelief);
    field.position.set(0, 0, 0.0295);
    dg.add(field);
    // hinge side = -dir
    for (const hy of [h * 0.33, -h * 0.33]) {
      dg.add(mk(new THREE.CylinderGeometry(0.011, 0.011, 0.07, 14), brass, -dir * (w / 2 + 0.008), hy, 0.02));
      dg.add(mk(rbox(G, 0.12, 0.022, 0.005, 0.002), brass, -dir * (w / 2 - 0.05), hy, 0.0395));
      for (const k of [0.02, 0.06, 0.1]) dg.add(mk(new THREE.SphereGeometry(0.0035, 8, 6), steel, -dir * (w / 2 - k + 0.01), hy, 0.043));
    }
    // latch: turned brass handle on a pivot boss
    dg.add(mk(new THREE.CylinderGeometry(0.016, 0.018, 0.012, 18), brass, dir * (w / 2 - 0.045), 0.02, 0.036, Math.PI / 2));
    const handle = new THREE.Group();
    handle.add(mk(new THREE.CylinderGeometry(0.007, 0.007, 0.04, 10), brass, 0, 0, 0.02, Math.PI / 2));
    handle.add(mk(lathe(G, [[0, 0], [0.012, 0.0], [0.016, 0.03], [0.011, 0.07], [0.015, 0.095], [0, 0.105]], 16), brass, 0, 0, 0.04, 0, 0, -dir * Math.PI / 2));
    handle.position.set(dir * (w / 2 - 0.045), 0.02, 0.036);
    dg.add(handle);
    dg.position.set(x, 0.42, 0.012);
    return dg;
  };
  const left = ovenDoor(-0.4, 1), right = ovenDoor(0.4, -1);
  g.add(left, right);
  // oven thermometer (left door)
  {
    const t = new THREE.Group();
    t.add(mk(lathe(G, [[0, 0], [0.05, 0], [0.052, 0.006], [0.046, 0.012], [0.0, 0.012]], 32), brass, 0, 0, 0, Math.PI / 2));
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.043, 32), mat.dial);
    face.position.z = 0.0125; t.add(face);
    t.position.set(-0.4, 0.42 + 0.13, 0.05);
    g.add(t);
  }
  // ---- fire door with a pierced grille; ember card + dark firebox behind
  const fbW = 0.24, fbH = 0.22, fbY = 0.56;
  {
    const sh = new THREE.Shape();
    const hw = fbW / 2, hh = fbH / 2, rr = 0.02;
    sh.moveTo(-hw + rr, -hh); sh.lineTo(hw - rr, -hh); sh.quadraticCurveTo(hw, -hh, hw, -hh + rr); sh.lineTo(hw, hh - rr); sh.quadraticCurveTo(hw, hh, hw - rr, hh);
    sh.lineTo(-hw + rr, hh); sh.quadraticCurveTo(-hw, hh, -hw, hh - rr); sh.lineTo(-hw, -hh + rr); sh.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
    // arch of vertical slots + a ring of round holes below
    for (let i = 0; i < 7; i++) {
      const x = -0.075 + i * 0.025, top = 0.075 - Math.abs(i - 3) * 0.008, bot = 0.0;
      const hp = new THREE.Path();
      hp.moveTo(x - 0.0065, bot); hp.lineTo(x + 0.0065, bot); hp.lineTo(x + 0.0065, top); hp.absarc(x, top, 0.0065, 0, Math.PI, false); hp.lineTo(x - 0.0065, bot);
      sh.holes.push(hp);
    }
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      const hp = new THREE.Path(); hp.absarc(Math.cos(a) * 0.06, -0.025 + Math.sin(a) * 0.045, 0.007, 0, Math.PI * 2, true);
      sh.holes.push(hp);
    }
    const plate = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 });
    g.add(mk(G.applyBoxUVs(plate, 1), edge, 0, fbY, 0.012));
    // frame round the door + hinge pins + a brass turn-knob
    g.add(mk(G.raisedPanel(fbW + 0.06, fbH + 0.06, { border: 0.03, bevel: 0.006, fieldDepth: 0.001, frameDepth: 0.01 }), iron, 0, fbY, 0.004));
    for (const hy of [0.06, -0.06]) g.add(mk(new THREE.CylinderGeometry(0.009, 0.009, 0.04, 12), steel, -fbW / 2 - 0.006, fbY + hy, 0.022));
    g.add(mk(lathe(G, [[0, 0], [0.014, 0], [0.018, 0.012], [0.01, 0.03], [0.014, 0.04], [0, 0.044]], 16), brass, fbW / 2 - 0.03, fbY - 0.07, 0.028, Math.PI / 2));
  }
  const emberMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff5a14, emissiveIntensity: 1.5, emissiveMap: mat.emberMap, roughness: 1, name: 'embers' });
  const coals = mk(new THREE.PlaneGeometry(fbW - 0.02, fbH - 0.02), emberMat, 0, fbY - 0.01, -0.012);
  coals.userData.noBake = true; coals.userData.keep = true;
  g.add(coals);
  g.add(mk(new THREE.BoxGeometry(fbW + 0.02, fbH + 0.02, 0.05), mat.soot, 0, fbY, -0.04));
  // ---- ash-pit door: louvred
  {
    const sh = new THREE.Shape();
    sh.moveTo(-0.12, -0.07); sh.lineTo(0.12, -0.07); sh.lineTo(0.12, 0.07); sh.lineTo(-0.12, 0.07); sh.lineTo(-0.12, -0.07);
    for (let i = 0; i < 4; i++) { const y = -0.045 + i * 0.03; const hp = new THREE.Path(); hp.moveTo(-0.085, y - 0.007); hp.lineTo(0.085, y - 0.007); hp.lineTo(0.085, y + 0.007); hp.lineTo(-0.085, y + 0.007); hp.lineTo(-0.085, y - 0.007); sh.holes.push(hp); }
    g.add(mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 }), 1), edge, 0, 0.235, 0.012));
    const ashMat = emberMat.clone(); ashMat.emissiveIntensity = 0.35; ashMat.name = 'ashGlow';
    const ash = mk(new THREE.PlaneGeometry(0.2, 0.12), ashMat, 0, 0.235, -0.004); ash.userData.noBake = true; g.add(ash);
    g.add(mk(new THREE.BoxGeometry(0.22, 0.13, 0.03), mat.soot, 0, 0.235, -0.022));
  }
  // dampers
  for (const x of [-0.08, 0.08]) g.add(mk(lathe(G, [[0, 0], [0.013, 0], [0.017, 0.01], [0.01, 0.026], [0.014, 0.034], [0, 0.037]], 16), brass, x, 0.72, 0.012, Math.PI / 2));
  // ---- hob slab + hob covers with ring grooves and lifting notches
  g.add(mk(rbox(G, W + 0.06, 0.04, D + 0.04, 0.012), edge, 0, HOB - 0.02, -D / 2 + 0.005));
  const cover = (R) => {
    const pts = [[0, 0], [R + 0.003, 0], [R + 0.003, 0.006], [R, 0.011], [R * 0.93, 0.012]];
    for (const [r0, r1] of [[0.86, 0.8], [0.62, 0.56], [0.38, 0.33]]) pts.push([R * r0, 0.012], [R * (r0 - 0.01), 0.008], [R * (r1 + 0.01), 0.008], [R * r1, 0.012]);
    pts.push([R * 0.12, 0.012], [R * 0.1, 0.016], [0, 0.017]);
    return lathe(G, pts, 48);
  };
  for (const [x, z, R] of [[-0.42, -0.22, 0.12], [-0.13, -0.22, 0.1], [0.15, -0.22, 0.1], [0.43, -0.22, 0.12], [-0.28, -0.45, 0.09], [0.3, -0.45, 0.09]]) {
    g.add(mk(cover(R), edge, x, HOB, z));
    g.add(mk(new THREE.BoxGeometry(0.024, 0.008, 0.012), mat.soot, x + R * 0.8, HOB + 0.009, z));
  }
  // brass towel rail on brackets
  g.add(mk(new THREE.CylinderGeometry(0.011, 0.011, W + 0.1, 16), brass, 0, 0.745, 0.11, 0, 0, Math.PI / 2));
  for (const x of [-W / 2 - 0.02, W / 2 + 0.02]) {
    g.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 10), brass, x, 0.745, 0.055, Math.PI / 2));
    g.add(mk(new THREE.SphereGeometry(0.018, 16, 12), brass, x + Math.sign(x) * 0.05, 0.745, 0.11));
  }
  // a linen tea towel draped over the rail
  const towel = mk(drapedCloth({ width: 0.26, front: 0.3, back: 0.2, r: 0.014, seed: 3 }), mat.towel, 0.36, 0.745, 0.11);
  towel.rotation.y = 0.04;
  g.add(towel);
  // ---- back plate, warming shelf with a gallery rail, flue
  g.add(mk(rbox(G, W, 0.64, 0.04, 0.008), iron, 0, HOB + 0.32, z0 + 0.02));
  g.add(mk(G.raisedPanel(W - 0.1, 0.5, { border: 0.04, bevel: 0.012, fieldDepth: 0.003, frameDepth: 0.01 }), edge, 0, HOB + 0.3, z0 + 0.04));
  const bp = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, 0.4), mat.ironRelief2 || mat.ironRelief);
  bp.position.set(0, HOB + 0.3, z0 + 0.0575);
  g.add(bp);
  g.add(mk(rbox(G, W + 0.04, 0.03, 0.26, 0.008), edge, 0, HOB + 0.64, z0 + 0.13));
  for (let i = 0; i < 27; i++) g.add(mk(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 6), brass, -W / 2 + 0.03 + i * ((W - 0.06) / 26), HOB + 0.68, z0 + 0.255));
  g.add(mk(new THREE.CylinderGeometry(0.006, 0.006, W - 0.04, 8), brass, 0, HOB + 0.705, z0 + 0.255, 0, 0, Math.PI / 2));
  for (const x of [-W / 2 + 0.03, W / 2 - 0.03]) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(0, 0.18); sh.lineTo(0.2, 0.18); sh.quadraticCurveTo(0.04, 0.14, 0.0, 0.0);
    const b = mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: false }), 1), edge, x - 0.007, HOB + 0.45, z0 + 0.04, 0, -Math.PI / 2, 0);
    g.add(b);
  }
  g.add(mk(new THREE.CylinderGeometry(0.075, 0.075, 0.9, 32), iron, -0.38, HOB + 1.1, z0 + 0.12));
  for (const y of [HOB + 0.8, HOB + 1.2]) g.add(mk(new THREE.TorusGeometry(0.078, 0.008, 8, 32), edge, -0.38, y, z0 + 0.12, Math.PI / 2));
  // ---- kettle, stockpot, an iron frying pan
  {
    const k = new THREE.Group();
    k.add(mk(lathe(G, [[0, 0], [0.09, 0], [0.105, 0.02], [0.112, 0.06], [0.104, 0.11], [0.075, 0.148], [0.04, 0.162], [0.038, 0.172], [0.0, 0.176]], 48), mat.copper));
    k.add(mk(lathe(G, [[0, 0], [0.042, 0], [0.04, 0.008], [0.016, 0.014], [0.012, 0.022], [0.018, 0.03], [0, 0.034]], 24), mat.copper, 0, 0.17, 0));
    k.add(mk(new THREE.SphereGeometry(0.014, 14, 10), mat.ebony || mat.soot, 0, 0.208, 0));
    k.add(mk(tube([[0.092, 0.045, 0], [0.15, 0.09, 0], [0.19, 0.165, 0]], 0.014, 16, 10), mat.copper));
    k.add(mk(new THREE.TorusGeometry(0.105, 0.004, 8, 48), mat.copper, 0, 0.06, 0, Math.PI / 2));
    k.add(mk(tube([[-0.07, 0.15, 0], [-0.055, 0.29, 0], [0.055, 0.29, 0], [0.07, 0.15, 0]], 0.007, 24, 8), brass));
    k.add(mk(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 12), mat.ebony || mat.soot, 0, 0.29, 0, 0, 0, Math.PI / 2));
    k.position.set(-0.42, HOB + 0.017, -0.22); k.rotation.y = 0.5;
    g.add(k);
    const pot = buildSaucepan(G, mat, 0.13, 0.2, 0.0, { stock: true });
    pot.position.set(0.3, HOB + 0.017, -0.45);
    g.add(pot);
    const lid = new THREE.Group();
    lid.add(mk(lathe(G, [[0, 0], [0.137, 0], [0.137, 0.006], [0.12, 0.012], [0.06, 0.03], [0.0, 0.034]], 48), mat.copper));
    lid.add(mk(new THREE.TorusGeometry(0.022, 0.006, 8, 16, Math.PI), brass, 0, 0.034, 0));
    lid.position.set(0.3, HOB + 0.017 + 0.204, -0.45);
    g.add(lid);
    const fp = new THREE.Group();
    fp.add(mk(lathe(G, [[0, 0], [0.12, 0], [0.13, 0.01], [0.14, 0.04], [0.135, 0.042], [0.124, 0.012], [0.0, 0.006]], 40), iron));
    fp.add(mk(rbox(G, 0.22, 0.012, 0.03, 0.004), iron, 0.24, 0.04, 0, 0, 0, 0.12));
    fp.position.set(0.15, HOB + 0.017, -0.18); fp.rotation.y = -0.6;
    g.add(fp);
  }
  // the fire light sits just inside the grille and points out and down (spills only through the door)
  return { group: g, fireLightPos: V3(0, fbY - 0.02, 0.02), fireLightTarget: V3(0, 0.0, 0.9), emberMat, coals };
}

/** A cloth draped over a horizontal rail along X at the origin: hangs `front` m on +Z side, `back` on -Z side. */
export function drapedCloth({ width = 0.26, front = 0.3, back = 0.2, r = 0.014, seed = 1, nx = 28, ny = 48 } = {}) {
  const L = front + Math.PI * r + back;
  const pos = [], uv = [], idx = [];
  const fold = (x, d) => {
    const a = Math.min(1, d / 0.12) * 0.011;
    return Math.sin(x * 48 + seed) * a + Math.sin(x * 97 + seed * 2.1) * a * 0.35;
  };
  for (let j = 0; j <= ny; j++) {
    const sDist = (j / ny) * L;
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      let x = (u - 0.5) * width, y, z;
      if (sDist < front) {
        const d = front - sDist;
        y = -d; z = r + 0.002 + Math.max(0, fold(x, d));
        x *= 1 + d * 0.25;
        x += Math.sin(d * 9 + seed) * 0.004;
      } else if (sDist < front + Math.PI * r) {
        const th = (sDist - front) / r;
        y = Math.sin(th) * (r + 0.002); z = Math.cos(th) * (r + 0.002);
      } else {
        const d = sDist - front - Math.PI * r;
        y = -d; z = -r - 0.002 - Math.max(0, fold(x + 0.03, d));
        x *= 1 + d * 0.15;
      }
      pos.push(x, y, z); uv.push(u * width * 4, (sDist / L) * L * 4);
    }
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// =====================================================================================
// Kitchen dresser / pantry shelving (left wall). Origin = floor, centre of the back
// (wall plane), facing +Z (rotate to fit). Length L along X. Returns { group, shelves }
// where shelves = [{ y, zFront }] for the three puzzle shelves (local coords).
// =====================================================================================
export function buildDresser(ctx, mat, { L = 1.9 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'dresser';
  const BD = 0.5, BH = 0.88, TOP = 0.045;        // base depth/height
  const SD = 0.3, SH = 2.75;                    // shelf depth, total height
  const paint = mat.dresserPaint, pine = mat.counter || mat.pine, brass = mat.brass;
  // ---- base cupboard
  g.add(mk(rbox(G, L, BH - 0.1, BD - 0.02, 0.005), paint, 0, 0.1 + (BH - 0.1) / 2, BD / 2 - 0.01));
  g.add(mk(rbox(G, L - 0.04, 0.1, BD - 0.06, 0.004), mat.soot, 0, 0.05, BD / 2 - 0.04));      // recessed plinth shadow
  g.add(mk(rbox(G, L + 0.06, TOP, BD + 0.04, 0.01), pine, 0, BH + TOP / 2, BD / 2));               // scrubbed worktop
  // drawers row + cupboard doors
  const nDr = 3;
  for (let i = 0; i < nDr; i++) {
    const w = (L - 0.08) / nDr - 0.02;
    const x = -L / 2 + 0.04 + (i + 0.5) * ((L - 0.08) / nDr);
    g.add(mk(G.raisedPanel(w, 0.16, { border: 0.025, bevel: 0.01, fieldDepth: 0.005, frameDepth: 0.012 }), paint, x, BH - 0.12, BD));
    for (const s of [-1, 1]) g.add(mk(lathe(G, [[0, 0], [0.012, 0], [0.016, 0.01], [0.008, 0.02], [0.014, 0.026], [0, 0.03]], 14), brass, x + s * w * 0.25, BH - 0.12, BD + 0.012, Math.PI / 2));
  }
  for (let i = 0; i < 2; i++) {
    const w = (L - 0.1) / 2 - 0.03;
    const x = (i === 0 ? -1 : 1) * ((L - 0.1) / 4 + 0.01);
    g.add(mk(G.raisedPanel(w, 0.5, { border: 0.06, bevel: 0.025, fieldDepth: 0.008 }), paint, x, 0.42, BD));
    g.add(mk(new THREE.SphereGeometry(0.016, 14, 10), brass, x + (i === 0 ? 1 : -1) * (w / 2 - 0.05), 0.5, BD + 0.025));
    // escutcheon
    g.add(mk(rbox(G, 0.022, 0.05, 0.004, 0.002), brass, x + (i === 0 ? 1 : -1) * (w / 2 - 0.05), 0.44, BD + 0.012));
  }
  // ---- upper rack
  const y0 = BH + TOP;
  // back boarding
  g.add(mk(G.planeUV(L, SH - y0, 1), mat.boarding, 0, y0 + (SH - y0) / 2, 0.036));
  // shaped side boards (cyma curve at the bottom front)
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(SD * 0.6, 0);
    sh.bezierCurveTo(SD * 0.6, 0.12, SD, 0.1, SD, 0.3);
    sh.lineTo(SD, SH - y0); sh.lineTo(0, SH - y0); sh.lineTo(0, 0);
    const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.028, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 16 });
    const side = mk(G.applyBoxUVs(eg, 1), paint, s * (L / 2 - 0.014) - 0.014, y0, 0, 0, -Math.PI / 2, 0);
    side.position.x = s * (L / 2) + (s > 0 ? -0.028 : 0);
    g.add(side);
  }
  // shelves (with a plate groove rail on the upper two)
  const shelfYs = [1.26, 1.52, 1.78, 2.2, 2.52];
  for (const y of shelfYs) {
    g.add(mk(rbox(G, L - 0.06, 0.025, SD, 0.004), paint, 0, y - 0.0125, SD / 2));
    // front lip moulding
    g.add(mk(rbox(G, L - 0.06, 0.035, 0.02, 0.006), paint, 0, y - 0.01, SD - 0.005));
  }
  // cornice: cove moulding swept across the front and returns
  const cy = SH;
  const prof = [V2(0, 0), V2(0.012, 0), V2(0.012, 0.02), V2(0.03, 0.03), V2(0.05, 0.06), V2(0.07, 0.085), V2(0.085, 0.09), V2(0.085, 0.11), V2(0, 0.11)];
  const cor = G.sweepProfile(prof, [V3(-L / 2, cy, 0), V3(-L / 2, cy, SD), V3(L / 2, cy, SD), V3(L / 2, cy, 0)], { uvScale: 1 });
  g.add(mk(cor, paint));
  g.add(mk(rbox(G, L + 0.18, 0.025, SD + 0.1, 0.006), paint, 0, cy + 0.12, SD / 2 + 0.03));
  // fascia board under the cornice with a scalloped lower edge
  {
    const sh = new THREE.Shape();
    const fw = L - 0.06, fh = 0.12;
    sh.moveTo(-fw / 2, fh); sh.lineTo(fw / 2, fh); sh.lineTo(fw / 2, 0);
    const n = 11;
    for (let i = n; i > 0; i--) {
      const x1 = -fw / 2 + (fw * (i - 1)) / n, xm = -fw / 2 + (fw * (i - 0.5)) / n;
      sh.quadraticCurveTo(xm, 0.06, x1, 0);
    }
    sh.lineTo(-fw / 2, fh);
    const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 6 });
    g.add(mk(G.applyBoxUVs(eg, 1), paint, 0, cy - 0.12, SD - 0.03));
  }
  const shelves = [{ y: shelfYs[2], zFront: SD }, { y: shelfYs[1], zFront: SD }, { y: shelfYs[0], zFront: SD }]; // top row first
  return { group: g, shelves, extraShelves: [shelfYs[3], shelfYs[4]], SD, L, BH: BH + TOP, BD };
}

// =====================================================================================
// Pantry clutter: stoneware crocks, preserving jars, a salt box, a mortar. Returns geometries
// merged into few meshes. Adds into `parent` at positions given (local to dresser).
// =====================================================================================
export function crock(G, h = 0.2, r = 0.075, neck = 0.6) {
  return lathe(G, [[0, 0], [r * 0.85, 0], [r, h * 0.08], [r * 1.02, h * 0.5], [r * 0.95, h * 0.82], [r * neck, h * 0.92], [r * neck * 1.08, h], [r * neck * 0.9, h], [0.0, h * 0.97]], 32);
}
export function jarGeo(G, h = 0.18, r = 0.05) {
  return lathe(G, [[0, 0], [r * 0.9, 0], [r, h * 0.05], [r, h * 0.78], [r * 0.8, h * 0.86], [r * 0.78, h * 0.95], [0, h * 0.95]], 28);
}

// =====================================================================================
// Butcher's block: a thick end-grain block (dished & scrubbed in the middle) on four stout
// legs with through-bolts. Origin = floor centre. Top surface at y = TOPY.
// =====================================================================================
export function buildButcherBlock(ctx, mat, { W = 1.5, D = 0.78 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'butcherblock';
  const TOPY = 0.86, T = 0.24;
  g.add(mk(rbox(G, W, T - 0.004, D, 0.018, 3), mat.blockSide || mat.maple, 0, TOPY - T / 2 - 0.002, 0));
  // dished end-grain face: a displaced grid (up to 14 mm hollow, worn toward the cook's side)
  const top = new THREE.PlaneGeometry(W - 0.03, D - 0.03, 60, 32);
  top.rotateX(-Math.PI / 2);
  const p = top.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (W / 2), z = p.getZ(i) / (D / 2);
    const dish = Math.exp(-(x * x * 2.2 + (z - 0.15) * (z - 0.15) * 2.8));
    p.setY(i, -0.014 * dish + 0.0008 * Math.sin(x * 40) * Math.sin(z * 31));
  }
  top.computeVertexNormals();
  const face = new THREE.Mesh(top, mat.butcher);
  face.position.y = TOPY + 0.0005;
  g.add(face);
  // iron tie-bolts through the block (square nuts on the ends)
  for (const s of [-1, 1]) for (const zz of [-0.22, 0.22]) {
    g.add(mk(rbox(G, 0.008, 0.032, 0.032, 0.003), mat.iron, s * (W / 2 + 0.003), TOPY - T * 0.5, zz));
    g.add(mk(new THREE.CylinderGeometry(0.006, 0.006, 0.012, 8), mat.iron, s * (W / 2 + 0.008), TOPY - T * 0.5, zz, 0, 0, Math.PI / 2));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mk(rbox(G, 0.13, TOPY - T, 0.13, 0.015, 2), mat.pineDark, sx * (W / 2 - 0.1), (TOPY - T) / 2, sz * (D / 2 - 0.1)));
  }
  // rails + pot board
  for (const s of [-1, 1]) g.add(mk(rbox(G, W - 0.3, 0.06, 0.04, 0.006), mat.pineDark, 0, 0.2, s * (D / 2 - 0.1)));
  g.add(mk(rbox(G, W - 0.18, 0.025, D - 0.2, 0.004), mat.pineDark, 0, 0.24, 0));
  return { group: g, TOPY };
}

// =====================================================================================
// Copper saucepan: planished body, rolled rim, tinned interior, riveted iron handle with a
// hanging loop. origin = base centre, opening +Y, handle along +X. stock: two loop handles.
// Returns a Group; userData.loop = local position of the handle's hanging loop.
// =====================================================================================
export function buildSaucepan(G, mat, r = 0.1, h = 0.08, handleLen = 0.22, { stock = false } = {}) {
  const g = new THREE.Group();
  const t = 0.0022;
  g.add(mk(lathe(G, [[0, 0.0006], [r * 0.86, 0], [r * 0.97, h * 0.04], [r, h * 0.14], [r, h * 0.985], [r + 0.0005, h]], 48), mat.copper));
  g.add(mk(new THREE.TorusGeometry(r + 0.0012, 0.0032, 8, 64), mat.copper, 0, h, 0, Math.PI / 2));
  g.add(mk(lathe(G, [[r - t, h + 0.001], [r - t, h * 0.15], [r * 0.95 - t, h * 0.05 + t], [r * 0.84, t], [0, t]], 48), mat.tinLining || mat.copper));
  if (stock) {
    for (const s of [-1, 1]) {
      g.add(mk(new THREE.TorusGeometry(0.03, 0.006, 8, 18, Math.PI), mat.brass, s * (r + 0.004), h * 0.8, 0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0));
      for (const z of [-0.022, 0.022]) g.add(mk(new THREE.SphereGeometry(0.005, 8, 6), mat.copper, s * (r + 0.002), h * 0.8, z));
    }
    return g;
  }
  const hg = new THREE.Group();
  const bar = new THREE.Shape();
  bar.moveTo(0, -0.014); bar.lineTo(handleLen, -0.009); bar.absarc(handleLen + 0.012, 0, 0.018, -Math.PI / 2, Math.PI / 2, false); bar.lineTo(0, 0.014); bar.lineTo(0, -0.014);
  const hole = new THREE.Path(); hole.absarc(handleLen + 0.014, 0, 0.009, 0, Math.PI * 2, true); bar.holes.push(hole);
  const hgeo = new THREE.ExtrudeGeometry(bar, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 16 });
  hgeo.translate(0, 0, -0.003); hgeo.rotateX(Math.PI / 2);
  hg.add(mk(G.applyBoxUVs(hgeo, 1), mat.ironEdge || mat.ironPolished || mat.iron));
  // riveted strap onto the body
  hg.add(mk(rbox(G, 0.05, 0.004, 0.034, 0.0015), mat.ironEdge || mat.iron, 0.012, 0, 0, 0, 0, 0));
  for (const [x, z] of [[0.004, -0.009], [0.004, 0.009], [0.024, 0]]) hg.add(mk(new THREE.SphereGeometry(0.0042, 8, 6), mat.copper, x, 0.003, z));
  hg.position.set(r * 0.99, h * 0.84, 0);
  hg.rotation.z = 0.12;
  g.add(hg);
  const lp = new THREE.Vector3(handleLen + 0.014, 0, 0).applyEuler(hg.rotation).add(hg.position);
  g.userData.loop = lp;
  return g;
}

// =====================================================================================
// Victorian brass kitchen scale with pan and stacked weights. origin = base on table.
// =====================================================================================
export function buildScale(G, mat) {
  const g = new THREE.Group();
  g.add(mk(rbox(G, 0.3, 0.035, 0.14, 0.008), mat.iron, 0, 0.0175, 0));
  g.add(mk(lathe(G, [[0, 0], [0.025, 0], [0.018, 0.03], [0.014, 0.12], [0.02, 0.13], [0, 0.14]], 16), mat.iron, 0, 0.035, 0));
  g.add(mk(rbox(G, 0.3, 0.012, 0.02, 0.004), mat.brass, 0, 0.17, 0));
  // pan (left), platform (right)
  g.add(mk(lathe(G, [[0, 0], [0.06, 0], [0.11, 0.035], [0.115, 0.04], [0.105, 0.04], [0.055, 0.008], [0, 0.008]], 40), mat.brass, -0.12, 0.18, 0));
  g.add(mk(new THREE.CylinderGeometry(0.06, 0.06, 0.008, 32), mat.brass, 0.12, 0.18, 0));
  // weights stack
  let y = 0.184;
  for (const [r, hh] of [[0.045, 0.03], [0.036, 0.025], [0.028, 0.02], [0.021, 0.016]]) {
    g.add(mk(lathe(G, [[0, 0], [r, 0], [r, hh * 0.85], [r * 0.85, hh], [0.01, hh], [0.01, hh + 0.008], [0, hh + 0.01]], 24), mat.brass, 0.12, y, 0));
    y += hh;
  }
  return g;
}

// =====================================================================================
// Gas wall bracket with an etched globe. origin = wall plate centre, arm toward +Z.
// returns { group, globe, lightPos }
// =====================================================================================
export function buildGasBracket(G, mat, globeMat) {
  const g = new THREE.Group();
  g.add(mk(lathe(G, [[0, 0], [0.055, 0], [0.05, 0.012], [0.03, 0.02], [0, 0.025]], 24), mat.brass, 0, 0, 0, Math.PI / 2));
  g.add(mk(tube([[0, 0, 0.02], [0, -0.03, 0.12], [0, 0.02, 0.22], [0, 0.07, 0.26]], 0.009, 24, 8), mat.brass));
  // tap key
  g.add(mk(rbox(G, 0.05, 0.008, 0.01, 0.002), mat.brass, 0, -0.02, 0.1));
  // gallery + globe + chimney
  g.add(mk(lathe(G, [[0.015, 0], [0.05, 0.01], [0.055, 0.02], [0.05, 0.024], [0.015, 0.012]], 24), mat.brass, 0, 0.07, 0.26));
  const globe = mk(lathe(G, [[0.03, 0], [0.06, 0.02], [0.075, 0.07], [0.07, 0.12], [0.045, 0.16], [0.04, 0.17]], 32), globeMat, 0, 0.09, 0.26);
  globe.userData.noBake = true;
  g.add(globe);
  return { group: g, globe, lightPos: V3(0, 0.17, 0.26) };
}

/** Merge many (geometry, matrix) pairs into one geometry (strips extra attributes). */
export function mergeInto(list) {
  const geos = list.map(({ geo, m }) => {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (m) g.applyMatrix4(m);
    return g;
  });
  return mergeGeometries(geos, false);
}

// =====================================================================================
// Brass paraffin lamp with a glass chimney. origin = base. returns { group, flameY }
// =====================================================================================
export function buildOilLamp(ctx, mat) {
  const { geometry: G, fx } = ctx;
  const g = new THREE.Group();
  g.add(mk(lathe(G, [[0, 0], [0.07, 0], [0.072, 0.008], [0.06, 0.016], [0.025, 0.03], [0.02, 0.08], [0.03, 0.09], [0.065, 0.12], [0.072, 0.15], [0.06, 0.18], [0.025, 0.195], [0.03, 0.21], [0.0, 0.215]], 32), mat.brass));
  // burner gallery
  g.add(mk(lathe(G, [[0.02, 0.21], [0.036, 0.215], [0.04, 0.24], [0.035, 0.245], [0.02, 0.24]], 24), mat.brass));
  const chimney = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.22, emissive: new THREE.Color(1.0, 0.7, 0.4), emissiveIntensity: 0.06, clearcoat: 1, name: 'lampChimney' });
  const ch = mk(lathe(G, [[0.03, 0.24], [0.034, 0.26], [0.045, 0.3], [0.042, 0.33], [0.022, 0.38], [0.02, 0.47]], 28), chimney);
  ch.userData.noBake = true;
  g.add(ch);
  const flame = fx.flame({ height: 0.032, width: 0.011, intensity: 1.6 });
  flame.position.y = 0.255;
  g.add(flame);
  return { group: g, flameY: 0.3 };
}

// =====================================================================================
// Windsor kitchen chair (elm seat, turned legs, hoop back). origin = floor centre, faces +Z.
// =====================================================================================
export function buildWindsorChair(G, mat) {
  const g = new THREE.Group();
  const seatShape = new THREE.Shape();
  seatShape.moveTo(-0.2, -0.2); seatShape.quadraticCurveTo(0, -0.24, 0.2, -0.2); seatShape.quadraticCurveTo(0.23, 0, 0.19, 0.17);
  seatShape.quadraticCurveTo(0, 0.24, -0.19, 0.17); seatShape.quadraticCurveTo(-0.23, 0, -0.2, -0.2);
  const seat = new THREE.ExtrudeGeometry(seatShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 3, curveSegments: 16 });
  g.add(mk(G.applyBoxUVs(seat, 1), mat.pineDark, 0, 0.44, 0, Math.PI / 2, 0, 0));
  const legGeo = lathe(G, [[0.016, 0], [0.019, 0.04], [0.015, 0.12], [0.022, 0.2], [0.016, 0.26], [0.02, 0.32], [0.013, 0.41], [0.0, 0.42]], 12);
  const legs = [[-0.17, -0.15], [0.17, -0.15], [-0.16, 0.14], [0.16, 0.14]];
  for (const [x, z] of legs) {
    const l = mk(legGeo, mat.pineDark, x * 1.08, 0, z * 1.1);
    l.rotation.set(-z * 0.5, 0, x * 0.5);
    g.add(l);
  }
  g.add(mk(new THREE.CylinderGeometry(0.01, 0.01, 0.36, 8), mat.pineDark, 0, 0.17, 0, 0, 0, Math.PI / 2));
  for (const s of [-1, 1]) g.add(mk(new THREE.CylinderGeometry(0.009, 0.009, 0.32, 8), mat.pineDark, s * 0.18, 0.17, 0, Math.PI / 2, 0, 0));
  // hoop back + spindles (back at -z)
  const hoop = [];
  for (let i = 0; i <= 16; i++) { const a = Math.PI * (i / 16); hoop.push(V3(Math.cos(a) * 0.18, 0.46 + Math.sin(a) * 0.48, -0.17 - Math.sin(a) * 0.06)); }
  g.add(mk(tube(hoop, 0.012, 40, 8), mat.pineDark));
  for (let i = 0; i < 6; i++) {
    const x = -0.11 + i * 0.044;
    const top = 0.46 + Math.sqrt(Math.max(0, 0.18 * 0.18 - x * x)) / 0.18 * 0.48;
    g.add(mk(tube([V3(x, 0.47, -0.16), V3(x * 1.05, top - 0.01, -0.17 - Math.sin(Math.acos(Math.min(1, Math.abs(x) / 0.18))) * 0.06)], 0.006, 2, 6), mat.pineDark));
  }
  return g;
}

// =====================================================================================
// Set dressing for the kitchen's emptier corners.
// =====================================================================================

/** A brace of cock pheasants hung by the neck. origin = hook point; birds hang down -Y. */
export function buildPheasant(G, mat, seed = 0) {
  const g = new THREE.Group();
  const body = new THREE.SphereGeometry(0.075, 20, 14);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setXYZ(i, p.getX(i) * (1 - y * 2.5) * 0.95, y * 2.0, p.getZ(i) * (1 - y * 2.2) * 0.8); }
  body.computeVertexNormals();
  g.add(mk(body, mat.plumage, 0, -0.24, 0));
  // neck + head (copper-green sheen) + white collar + red wattle
  g.add(mk(new THREE.CylinderGeometry(0.013, 0.02, 0.12, 10), mat.pheasantHead, 0, -0.07, 0));
  g.add(mk(new THREE.TorusGeometry(0.019, 0.005, 6, 14), mat.collar, 0, -0.125, 0, Math.PI / 2));
  g.add(mk(new THREE.SphereGeometry(0.02, 12, 10), mat.pheasantHead, 0, -0.005, 0.01));
  g.add(mk(new THREE.SphereGeometry(0.009, 8, 6), mat.wattle, 0.012, -0.003, 0.016));
  g.add(mk(new THREE.ConeGeometry(0.006, 0.022, 6), mat.bone || mat.collar, 0, 0.0, 0.032, Math.PI / 2));
  // tail: long tapering barred feathers sweeping down
  for (let k = 0; k < 4; k++) {
    const len = 0.32 + k * 0.06;
    const f = new THREE.PlaneGeometry(0.03 - k * 0.004, len, 1, 8);
    f.translate(0, -len / 2, 0);
    const fp = f.attributes.position;
    for (let i = 0; i < fp.count; i++) { const y = fp.getY(i); fp.setX(i, fp.getX(i) * (1 + y * 1.5)); fp.setZ(i, y * y * 0.4); }
    f.computeVertexNormals();
    g.add(mk(f, mat.tail, (k - 1.5) * 0.012, -0.36, -0.02 + k * 0.006, 0.12, 0, (k - 1.5) * 0.06));
  }
  // dangling legs
  for (const s of [-1, 1]) g.add(mk(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 6), mat.bone || mat.collar, s * 0.03, -0.37, 0.05, 0.3, 0, s * 0.1));
  g.add(mk(new THREE.CylinderGeometry(0.0025, 0.0025, 0.06, 5), mat.rope, 0, 0.0, 0));
  g.rotation.y = seed * 1.3;
  return g;
}

/** Galvanised mop bucket with a string mop leaning in it. origin = floor centre. */
export function buildMopBucket(G, mat) {
  const g = new THREE.Group();
  g.add(mk(lathe(G, [[0, 0], [0.13, 0], [0.135, 0.01], [0.16, 0.27], [0.168, 0.28], [0.162, 0.285], [0.152, 0.27], [0.125, 0.018], [0, 0.018]], 36), mat.zincPail));
  for (const y of [0.09, 0.18]) g.add(mk(new THREE.TorusGeometry(0.142 + y * 0.09, 0.004, 6, 40), mat.zincPail, 0, y, 0, Math.PI / 2));
  g.add(mk(tube([[-0.165, 0.25, 0], [-0.12, 0.42, 0], [0.12, 0.42, 0], [0.165, 0.25, 0]], 0.004, 24, 6), mat.steel));
  g.add(mk(new THREE.CylinderGeometry(0.155, 0.155, 0.005, 32), mat.dirtyWater, 0, 0.17, 0));
  const mop = new THREE.Group();
  mop.add(mk(new THREE.CylinderGeometry(0.013, 0.013, 1.35, 8), mat.pine, 0, 0.675, 0));
  const strands = [];
  const sg = new THREE.CylinderGeometry(0.006, 0.005, 0.32, 5);
  for (let i = 0; i < 46; i++) {
    const a = i * 2.39996, rr = 0.02 + (i % 5) * 0.008;
    strands.push({ geo: sg, m: new THREE.Matrix4().compose(V3(Math.cos(a) * rr * 1.6, 0.0 + (i % 3) * 0.01, Math.sin(a) * rr * 1.6), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)), V3(1, 1, 1)) });
  }
  mop.add(mk(mergeInto(strands), mat.mopString, 0, 0.0, 0));
  mop.position.set(0.02, 0.12, 0.0); mop.rotation.set(0.0, 0, -0.24);
  g.add(mop);
  return g;
}

/** A pair of hob-nailed boots. origin = floor between them, toes +Z. */
export function buildBoots(G, mat) {
  const g = new THREE.Group();
  const boot = () => {
    const b = new THREE.Group();
    const sole = new THREE.Shape();
    sole.moveTo(-0.04, -0.13); sole.quadraticCurveTo(0, -0.15, 0.04, -0.13); sole.lineTo(0.048, 0.06); sole.quadraticCurveTo(0.05, 0.15, 0, 0.155); sole.quadraticCurveTo(-0.05, 0.15, -0.046, 0.06); sole.lineTo(-0.04, -0.13);
    const sg = new THREE.ExtrudeGeometry(sole, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 12 });
    sg.rotateX(Math.PI / 2); sg.translate(0, 0.026, 0);
    b.add(mk(G.applyBoxUVs(sg, 1), mat.bootSole));
    const vamp = new THREE.SphereGeometry(0.06, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    vamp.scale(0.78, 0.75, 1.6); vamp.translate(0, 0.026, 0.05);
    b.add(mk(vamp, mat.leatherBoot));
    const shaft = new THREE.CylinderGeometry(0.048, 0.054, 0.2, 18, 1, true);
    shaft.scale(1, 1, 1.15); shaft.translate(0, 0.12, -0.065);
    b.add(mk(shaft, mat.leatherBoot));
    b.add(mk(new THREE.TorusGeometry(0.05, 0.005, 6, 18), mat.leatherBoot, 0, 0.22, -0.065, Math.PI / 2, 0, 0)).scale.set(1, 1.15, 1);
    for (let i = 0; i < 4; i++) b.add(mk(new THREE.TorusGeometry(0.004, 0.0012, 4, 8), mat.brass, 0.034, 0.08 + i * 0.03, -0.02 - i * 0.008, 0, Math.PI / 2, 0));
    return b;
  };
  const l = boot(); l.position.set(-0.07, 0, 0); l.rotation.y = 0.12; g.add(l);
  const r = boot(); r.position.set(0.08, 0, 0.03); r.rotation.set(0, -0.2, 0); g.add(r);
  return g;
}

/** Coal hod (iron, Edwardian shape) with lumps of coal and a little shovel. origin = floor. */
export function buildCoalHod(G, mat) {
  const g = new THREE.Group();
  const hod = mk(lathe(G, [[0, 0], [0.14, 0], [0.16, 0.06], [0.17, 0.22], [0.158, 0.3], [0.165, 0.305], [0.15, 0.31], [0.14, 0.24], [0, 0.24]], 32), mat.iron);
  hod.scale.set(1, 1, 0.8);
  g.add(hod);
  // coal lumps heaped above the rim
  const lump = new THREE.IcosahedronGeometry(0.035, 0);
  const lumps = [];
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996, rr = Math.sqrt(i / 26) * 0.12;
    lumps.push({ geo: lump, m: new THREE.Matrix4().compose(V3(Math.cos(a) * rr, 0.25 + (0.12 - rr) * 0.5 + (i % 3) * 0.008, Math.sin(a) * rr * 0.8), new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 0.7, i * 1.3)), V3(1 + (i % 4) * 0.2, 0.7 + (i % 3) * 0.2, 1)) });
  }
  g.add(mk(mergeInto(lumps), mat.coal));
  g.add(mk(tube([[-0.17, 0.26, 0], [-0.1, 0.42, 0], [0.1, 0.42, 0], [0.17, 0.26, 0]], 0.007, 24, 8), mat.iron));
  g.add(mk(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 10), mat.pineDark, 0, 0.42, 0, 0, 0, Math.PI / 2));
  const sh = new THREE.Group();
  sh.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 8), mat.iron, 0, 0.18, 0));
  sh.add(mk(rbox(G, 0.09, 0.004, 0.11, 0.002), mat.iron, 0, 0.0, 0.03, 0.3, 0, 0));
  sh.position.set(0.12, 0.32, 0.02); sh.rotation.set(0.0, 0, -0.5);
  g.add(sh);
  return g;
}

/** A stuffed hessian sack, flat-bottomed, rounded shoulders, gathered & tied neck with a ruffled top. origin = floor centre. */
export function sackGeometry(seed = 0, { r = 0.2, h = 0.5, slump = 0.3 } = {}) {
  const prof = [];
  const N = 26;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let rr;
    if (t < 0.06) rr = r * (0.75 + 0.25 * Math.sin((t / 0.06) * Math.PI / 2));
    else if (t < 0.7) rr = r * (1 + slump * 0.18 * Math.sin(((t - 0.06) / 0.64) * Math.PI) - (t > 0.55 ? (t - 0.55) * 0.6 : 0));
    else if (t < 0.86) { const k = (t - 0.7) / 0.16; rr = r * (0.91 - 0.66 * Math.sin(k * Math.PI / 2)); }
    else { const k = (t - 0.86) / 0.14; rr = r * (0.25 + 0.22 * k); }
    let y = t * h;
    if (t < 0.06) y = (t / 0.06) * 0.05 * h;
    prof.push(new THREE.Vector2(Math.max(rr, 0.002), y));
  }
  prof.unshift(new THREE.Vector2(0.0001, 0));
  prof.push(new THREE.Vector2(r * 0.2, h * 0.97));
  const geo = new THREE.LatheGeometry(prof, 48);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x), t = y / h;
    // vertical creases + lumpy fill + ruffles at the mouth
    const crease = 0.03 * Math.sin(a * 7 + seed) * Math.sin(Math.PI * Math.min(1, t * 1.3)) + 0.02 * Math.sin(a * 13 + seed * 3 + t * 6);
    const ruffle = t > 0.86 ? 0.25 * Math.sin(a * 11 + seed) * (t - 0.86) / 0.14 : 0;
    const k = 1 + crease + ruffle;
    const lean = Math.sin(seed * 1.7) * 0.04 * t * h;
    p.setXYZ(i, x * k + lean, y * (1 + 0.03 * Math.sin(a * 3 + seed)), z * k * 0.88);
  }
  geo.computeVertexNormals();
  // sack texture wants ~metre UVs
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * r, uv.getY(i) * h);
  return geo;
}

/** Cottage loaf: two stacked, slashed domes. origin = base. */
export function loafGeometry(G) {
  const parts = [];
  const lower = new THREE.SphereGeometry(0.09, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
  lower.scale(1, 0.55, 1); lower.translate(0, 0.0, 0);
  const upper = new THREE.SphereGeometry(0.055, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.7);
  upper.scale(1, 0.75, 1); upper.translate(0, 0.045, 0);
  for (const g of [lower, upper]) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 - 0.035 * Math.max(0, Math.cos(a * 6)) ** 8; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    g.computeVertexNormals();
    parts.push(g);
  }
  return mergeInto(parts.map((geo) => ({ geo })));
}
