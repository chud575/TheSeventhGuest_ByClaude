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
// the hob, facing +Z. Width 1.3 m. Returns { group, fireLightPos, emberMat }.
// =====================================================================================
export function buildRange(ctx, mat) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'range';
  const W = 1.3, D = 0.6, HOB = 0.82;
  const z0 = -D;                       // back
  const iron = mat.iron, brass = mat.brass, steel = mat.steel;
  // plinth + body
  g.add(mk(rbox(G, W + 0.04, 0.08, D + 0.02, 0.01), iron, 0, 0.04, -D / 2));
  g.add(mk(rbox(G, W, HOB - 0.12, D - 0.04, 0.01), iron, 0, 0.08 + (HOB - 0.12) / 2, -D / 2 - 0.01));
  // hob slab with moulded edge
  const hob = mk(rbox(G, W + 0.06, 0.045, D + 0.04, 0.012), mat.ironPolished, 0, HOB - 0.02, -D / 2 + 0.005);
  g.add(hob);
  // hotplates: four rings with lifting notches
  for (const [x, z, r] of [[-0.42, -0.2, 0.11], [-0.14, -0.2, 0.1], [0.16, -0.2, 0.1], [0.44, -0.2, 0.11], [-0.28, -0.44, 0.09], [0.3, -0.44, 0.09]]) {
    g.add(mk(new THREE.CylinderGeometry(r, r + 0.004, 0.012, 40), mat.ironPolished, x, HOB + 0.008, z));
    g.add(mk(new THREE.TorusGeometry(r * 0.62, 0.0035, 6, 36), mat.ironPolished, x, HOB + 0.015, z, Math.PI / 2));
    g.add(mk(new THREE.BoxGeometry(0.02, 0.006, 0.012), iron, x + r * 0.62, HOB + 0.016, z));
  }
  // front: left oven door, firebox (centre), right oven (boiler) + ash-pit door
  const door = (x, y, w, h, label) => {
    const dg = new THREE.Group();
    dg.add(mk(G.raisedPanel(w, h, { border: 0.035, bevel: 0.018, fieldDepth: 0.008, frameDepth: 0.014 }), iron));
    // embossed sunburst ring
    dg.add(mk(new THREE.TorusGeometry(Math.min(w, h) * 0.26, 0.006, 8, 40), mat.ironPolished, 0, 0, 0.03));
    dg.add(mk(new THREE.CylinderGeometry(Math.min(w, h) * 0.08, Math.min(w, h) * 0.09, 0.012, 24), mat.ironPolished, 0, 0, 0.03, Math.PI / 2));
    // hinges (left) + brass latch handle (right)
    for (const hy of [h * 0.32, -h * 0.32]) dg.add(mk(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 12), steel, -w / 2 - 0.006, hy, 0.012));
    const handle = new THREE.Group();
    handle.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 10), brass, 0, 0, 0.025, Math.PI / 2));
    handle.add(mk(lathe(G, [[0, 0], [0.014, 0.0], [0.018, 0.03], [0.012, 0.075], [0.016, 0.1], [0, 0.11]], 16), brass, 0, -0.01, 0.05, 0, 0, Math.PI / 2));
    handle.position.set(w / 2 - 0.05, 0, 0.012);
    dg.add(handle);
    if (label) {
      // cast maker's plate
      dg.add(mk(rbox(G, w * 0.5, 0.035, 0.008, 0.003), brass, 0, h / 2 - 0.05, 0.024));
    }
    dg.position.set(x, y, 0.0);
    return dg;
  };
  g.add(door(-0.39, 0.42, 0.44, 0.44, true));
  g.add(door(0.39, 0.42, 0.44, 0.44, true));
  g.add(door(0.0, 0.17, 0.24, 0.16, false));          // ash pit
  // firebox opening with bars + glowing coals behind
  const fbW = 0.26, fbH = 0.26, fbY = 0.5;
  g.add(mk(rbox(G, fbW + 0.06, fbH + 0.06, 0.03, 0.006), mat.ironPolished, 0, fbY, -0.005));
  const emberMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff5a14, emissiveIntensity: 2.5, emissiveMap: mat.emberMap, roughness: 1 });
  emberMat.name = 'embers';
  const coals = mk(new THREE.PlaneGeometry(fbW, fbH * 0.8), emberMat, 0, fbY - 0.02, -0.06);
  coals.userData.noBake = true; coals.userData.keep = true;
  g.add(coals);
  // dark firebox interior
  g.add(mk(new THREE.BoxGeometry(fbW, fbH, 0.08), mat.soot, 0, fbY, -0.1));
  for (let i = 0; i < 7; i++) g.add(mk(new THREE.CylinderGeometry(0.006, 0.006, fbH, 8), iron, -fbW / 2 + 0.02 + (i * (fbW - 0.04)) / 6, fbY, 0.012));
  for (const y of [fbY - fbH * 0.3, fbY + fbH * 0.3]) g.add(mk(new THREE.BoxGeometry(fbW, 0.012, 0.012), iron, 0, y, 0.014));
  // damper knobs
  for (const x of [-0.18, 0.18]) g.add(mk(lathe(G, [[0, 0], [0.016, 0], [0.02, 0.012], [0.012, 0.03], [0, 0.034]], 16), brass, x, 0.7, 0.0, Math.PI / 2));
  // brass towel rail on brackets
  g.add(mk(new THREE.CylinderGeometry(0.011, 0.011, W + 0.1, 16), brass, 0, 0.73, 0.1, 0, 0, Math.PI / 2));
  for (const x of [-W / 2 - 0.02, W / 2 + 0.02]) {
    g.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.11, 10), brass, x, 0.73, 0.05, Math.PI / 2));
    g.add(mk(new THREE.SphereGeometry(0.018, 16, 12), brass, x + Math.sign(x) * 0.05, 0.73, 0.1));
  }
  // a tea towel over the rail
  {
    const cloth = new THREE.PlaneGeometry(0.24, 0.32, 10, 14);
    const p = cloth.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const t = (0.16 - y) / 0.32;
      p.setZ(i, Math.sin(x * 40) * 0.006 * t + (t < 0.15 ? Math.cos(t / 0.15 * Math.PI) * 0.0 : 0));
    }
    cloth.computeVertexNormals();
    const c1 = mk(cloth, mat.towel, 0.42, 0.6, 0.112);
    const c2 = mk(cloth, mat.towel, 0.42, 0.6, 0.088, 0, Math.PI, 0);
    g.add(c1, c2);
  }
  // back plate + warming shelf + flue
  g.add(mk(rbox(G, W, 0.6, 0.04, 0.008), iron, 0, HOB + 0.3, z0 + 0.02));
  g.add(mk(G.raisedPanel(W - 0.12, 0.46, { border: 0.05, bevel: 0.02, fieldDepth: 0.006 }), mat.ironPolished, 0, HOB + 0.3, z0 + 0.04));
  g.add(mk(rbox(G, W + 0.04, 0.03, 0.26, 0.008), iron, 0, HOB + 0.62, z0 + 0.13));
  for (const x of [-W / 2 + 0.03, W / 2 - 0.03]) {
    // scrolled brackets
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(0, 0.18); sh.lineTo(0.2, 0.18); sh.quadraticCurveTo(0.04, 0.14, 0.0, 0.0);
    const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: false });
    const b = mk(G.applyBoxUVs(bg, 1), iron, x - 0.007, HOB + 0.43, z0 + 0.04, 0, -Math.PI / 2, 0);
    g.add(b);
  }
  // flue pipe rising into the chimney
  g.add(mk(new THREE.CylinderGeometry(0.075, 0.075, 0.9, 32), iron, -0.38, HOB + 1.1, z0 + 0.12));
  g.add(mk(new THREE.TorusGeometry(0.078, 0.008, 8, 32), mat.ironPolished, -0.38, HOB + 0.8, z0 + 0.12, Math.PI / 2));
  g.add(mk(new THREE.TorusGeometry(0.078, 0.008, 8, 32), mat.ironPolished, -0.38, HOB + 1.2, z0 + 0.12, Math.PI / 2));
  // kettle (copper, on the left hotplate) and a stockpot
  {
    const k = new THREE.Group();
    k.add(mk(lathe(G, [[0, 0], [0.09, 0], [0.105, 0.02], [0.11, 0.06], [0.1, 0.11], [0.07, 0.15], [0.035, 0.165], [0.035, 0.175], [0.0, 0.18]], 40), mat.copper));
    k.add(mk(lathe(G, [[0, 0], [0.02, 0], [0.012, 0.02], [0, 0.025]], 16), mat.brass, 0, 0.178, 0));
    const spout = mk(tube([[0.09, 0.05, 0], [0.15, 0.1, 0], [0.19, 0.17, 0]], 0.014, 16, 10), mat.copper);
    k.add(spout);
    k.add(mk(tube([[-0.07, 0.15, 0], [-0.05, 0.28, 0], [0.05, 0.28, 0], [0.07, 0.15, 0]], 0.008, 24, 8), mat.brass));
    k.position.set(-0.42, HOB + 0.015, -0.2); k.rotation.y = 0.5;
    g.add(k);
    const pot = new THREE.Group();
    pot.add(mk(lathe(G, [[0, 0], [0.13, 0], [0.135, 0.01], [0.135, 0.2], [0.142, 0.205], [0.13, 0.21], [0.125, 0.2], [0.0, 0.2]], 48), mat.copper));
    pot.add(mk(lathe(G, [[0, 0.215], [0.136, 0.2], [0.14, 0.205], [0.06, 0.235], [0.02, 0.24], [0.02, 0.27], [0, 0.275]], 48), mat.copper));
    for (const s of [-1, 1]) pot.add(mk(new THREE.TorusGeometry(0.03, 0.007, 8, 16, Math.PI), mat.brass, s * 0.145, 0.16, 0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0));
    pot.position.set(0.3, HOB + 0.015, -0.27);
    g.add(pot);
  }
  return { group: g, fireLightPos: V3(0, fbY + 0.05, 0.38), emberMat, coals };
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
  const paint = mat.dresserPaint, pine = mat.pine, brass = mat.brass;
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
  const shelfYs = [1.24, 1.56, 1.88, 2.22, 2.52];
  for (const y of shelfYs) {
    g.add(mk(rbox(G, L - 0.06, 0.025, SD, 0.004), paint, 0, y - 0.0125, SD / 2));
    // front lip moulding
    g.add(mk(rbox(G, L - 0.06, 0.035, 0.02, 0.006), paint, 0, y - 0.01, SD - 0.005));
  }
  // cup hooks under the top shelf
  for (let i = 0; i < 9; i++) {
    const x = -L / 2 + 0.15 + i * ((L - 0.3) / 8);
    g.add(mk(new THREE.TorusGeometry(0.008, 0.0016, 6, 12, Math.PI * 1.4), brass, x, 2.48, SD - 0.04, 0, Math.PI / 2, 0));
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
// Butcher's block table. Origin = floor centre. Top (1.5 x 0.75, 0.13 thick) at y = 0.86.
// =====================================================================================
export function buildButcherBlock(ctx, mat, { W = 1.5, D = 0.78 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'butcherblock';
  const TOPY = 0.86, T = 0.13;
  // the block top: end-grain face on top, side-grain staves on the sides
  const top = mk(rbox(G, W, T, D, 0.012, 3), mat.maple, 0, TOPY - T / 2, 0);
  g.add(top);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.02, D - 0.02), mat.butcher);
  face.rotation.x = -Math.PI / 2; face.position.y = TOPY + 0.0005;
  g.add(face);
  // apron + legs (chamfered square, slightly splayed look via bevel)
  for (const s of [-1, 1]) {
    g.add(mk(rbox(G, W - 0.16, 0.12, 0.03, 0.004), mat.pineDark, 0, TOPY - T - 0.06, s * (D / 2 - 0.08)));
    g.add(mk(rbox(G, 0.03, 0.12, D - 0.16, 0.004), mat.pineDark, s * (W / 2 - 0.08), TOPY - T - 0.06, 0));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = mk(rbox(G, 0.1, TOPY - T, 0.1, 0.012, 2), mat.pineDark, sx * (W / 2 - 0.09), (TOPY - T) / 2, sz * (D / 2 - 0.09));
    g.add(leg);
    // iron castor cups
    g.add(mk(lathe(G, [[0, 0], [0.045, 0], [0.05, 0.02], [0.05, 0.04], [0, 0.04]], 16), mat.iron, sx * (W / 2 - 0.09), 0, sz * (D / 2 - 0.09)));
  }
  // pot board
  g.add(mk(rbox(G, W - 0.12, 0.025, D - 0.12, 0.004), mat.pineDark, 0, 0.17, 0));
  return { group: g, TOPY };
}

// =====================================================================================
// Copper saucepan with long iron handle, hung by the handle's ring. origin = pan rim centre.
// =====================================================================================
export function saucepanGeo(G, r = 0.1, h = 0.08) {
  const body = lathe(G, [[0, 0.001], [r * 0.9, 0.0], [r, h * 0.12], [r, h], [r * 1.05, h * 1.03], [r * 0.99, h * 1.04], [r * 0.95, h], [r * 0.95, h * 0.12], [0.0, h * 0.06]], 40);
  return body;
}
export function buildSaucepan(G, mat, r = 0.1, h = 0.08, handleLen = 0.22) {
  const g = new THREE.Group();
  g.add(mk(saucepanGeo(G, r, h), mat.copper));
  // iron handle, riveted
  const hg = new THREE.Group();
  hg.add(mk(rbox(G, handleLen, 0.012, 0.024, 0.004), mat.ironPolished, handleLen / 2, 0, 0));
  hg.add(mk(new THREE.TorusGeometry(0.018, 0.005, 8, 20), mat.ironPolished, handleLen + 0.012, 0, 0, Math.PI / 2));
  for (const z of [-0.007, 0.007]) hg.add(mk(new THREE.SphereGeometry(0.004, 8, 6), mat.brass, 0.012, 0.003, z));
  hg.position.set(r * 0.98, h * 0.82, 0);
  hg.rotation.z = 0.08;
  g.add(hg);
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
