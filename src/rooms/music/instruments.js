import * as THREE from 'three';
import { sheetMusicTexture } from './textures.js';

/**
 * Harp, cello (on its stand), music stand and piano bench for the music room.
 * Every builder returns a Group with its origin on the floor.
 */

/** Pedal harp, ~1.75 m: fluted gilt column, carved crown, swan-neck, flared soundbox, 40 strings. */
export function buildHarp(ctx, { gilt, giltPlain, wood }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'harp';
  // frame plane = XY; the column stands at x=+0.32 (front), soundbox leans from the base at x=0 up to the neck end at x=-0.42
  const base = new THREE.Mesh(new G.RoundedBoxGeometry(0.46, 0.09, 0.3, 3, 0.02), wood);
  base.position.set(0.05, 0.075, 0); g.add(base);
  const plinth = new THREE.Mesh(new G.RoundedBoxGeometry(0.5, 0.03, 0.34, 2, 0.01), giltPlain);
  plinth.position.set(0.05, 0.13, 0); g.add(plinth);
  for (const [x, z] of [[-0.17, -0.12], [0.27, -0.12], [-0.17, 0.12], [0.27, 0.12]]) {
    const foot = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.035, 0.0], [0.04, 0.015], [0.025, 0.035], [0, 0.04]], 16), giltPlain);
    foot.position.set(x, 0, z); g.add(foot);
  }
  // pedals
  for (let i = 0; i < 7; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.01, 0.07), giltPlain);
    p.position.set(-0.13 + i * 0.045, 0.045, 0.17); g.add(p);
  }
  // column (fluted shaft via lathe + gilt capital)
  const colH = 1.42;
  const colPts = [[0.035, 0], [0.042, 0.02], [0.03, 0.05], [0.028, colH * 0.5], [0.026, colH - 0.1], [0.032, colH - 0.08], [0.028, colH - 0.06]];
  const column = new THREE.Mesh(G.latheFromProfile(colPts, 24), gilt);
  column.position.set(0.24, 0.145, 0); g.add(column);
  // capital: stack of lathe rings + a crown of leaves (cones)
  const cap = new THREE.Mesh(G.latheFromProfile([[0.03, 0], [0.05, 0.02], [0.06, 0.06], [0.075, 0.1], [0.07, 0.13], [0.04, 0.15], [0.05, 0.17], [0.0, 0.18]], 24), gilt);
  cap.position.set(0.24, 0.145 + colH - 0.06, 0); g.add(cap);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.08, 6), gilt);
    leaf.position.set(0.24 + Math.cos(a) * 0.055, 0.145 + colH + 0.04, Math.sin(a) * 0.055);
    leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(leaf);
  }
  // swan neck: tube along an S-curve from the column top down to the soundbox head
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.24, 1.7, 0),
    new THREE.Vector3(0.12, 1.74, 0),
    new THREE.Vector3(-0.05, 1.62, 0),
    new THREE.Vector3(-0.2, 1.52, 0),
    new THREE.Vector3(-0.33, 1.6, 0),
    new THREE.Vector3(-0.42, 1.68, 0),
    new THREE.Vector3(-0.48, 1.62, 0),
  ], false, 'centripetal');
  const neckGeo = new THREE.TubeGeometry(neckCurve, 80, 0.032, 12, false);
  // flatten the tube into a deep board (harp necks are thin side-to-side)
  { const p = neckGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * 0.55); neckGeo.computeVertexNormals(); }
  g.add(new THREE.Mesh(neckGeo, wood));
  // gilt edge strip along the neck
  const neckEdge = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 80, 0.008, 6, false), giltPlain);
  neckEdge.position.z = 0.02; g.add(neckEdge);
  const neckEdge2 = neckEdge.clone(); neckEdge2.position.z = -0.02; g.add(neckEdge2);
  // scroll at the neck end
  const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 20, Math.PI * 1.6), gilt);
  scroll.position.set(-0.47, 1.6, 0); g.add(scroll);
  // soundbox: tapered half-round, from base (0.0, 0.16) up to (-0.44, 1.57)
  const sbA = new THREE.Vector3(0.0, 0.17, 0), sbB = new THREE.Vector3(-0.44, 1.56, 0);
  const sbLen = sbA.distanceTo(sbB);
  const sbShape = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; sbShape.push([0.17 - t * 0.12, t * sbLen]); }
  const sbGeo = new THREE.CylinderGeometry(0.05, 0.16, sbLen, 24, 8, false, 0, Math.PI);
  sbGeo.rotateY(Math.PI);   // half-cylinder bulging toward -X (the back)
  { const p = sbGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * 0.9); sbGeo.computeVertexNormals(); }
  const soundbox = new THREE.Mesh(sbGeo, wood);
  soundbox.position.copy(sbA).lerp(sbB, 0.5);
  soundbox.rotation.z = Math.atan2(sbB.x - sbA.x, -(sbB.y - sbA.y)) + Math.PI;
  g.add(soundbox);
  // soundboard face (flat, lighter spruce strip with gilt painted motif)
  const faceGeo = new THREE.PlaneGeometry(1, sbLen, 1, 8);
  { const p = faceGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = p.getY(i) / sbLen + 0.5; p.setX(i, p.getX(i) * (0.3 - v * 0.2) * 0.98); } }
  const face = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 0.45 }));
  face.rotation.y = Math.PI / 2;
  const holder = new THREE.Group(); holder.add(face);
  holder.position.copy(soundbox.position); holder.rotation.z = soundbox.rotation.z;
  face.position.x = 0.001;
  g.add(holder);
  // strings: from points along the neck underside to the soundboard centreline
  const n = 38;
  const sGeo = new THREE.CylinderGeometry(0.0009, 0.0009, 1, 4, 1, true);
  const strMat = new THREE.MeshStandardMaterial({ color: 0xd8cdb0, roughness: 0.35, metalness: 0.3 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x8a1a14, roughness: 0.4, metalness: 0.1 });
  const strings = new THREE.InstancedMesh(sGeo, strMat, n);
  const reds = new THREE.InstancedMesh(sGeo, redMat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  let si = 0, ri = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const bottom = sbA.clone().lerp(sbB, 0.06 + t * 0.9);
    const top = neckCurve.getPoint(0.05 + (1 - t) * 0.85);
    top.y -= 0.03;
    // the string runs vertically on a real harp; keep it near-vertical by taking the neck point above the bottom
    const topV = new THREE.Vector3(bottom.x, 0, 0);
    // find neck y at this x by sampling
    let best = top, bd = 1e9;
    for (let k = 0; k <= 60; k++) { const pt = neckCurve.getPoint(k / 60); const d = Math.abs(pt.x - bottom.x); if (d < bd && pt.x < 0.2) { bd = d; best = pt; } }
    topV.set(bottom.x + 0.015, best.y - 0.035, 0);
    const len = topV.distanceTo(bottom);
    if (len < 0.05) continue;
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), topV.clone().sub(bottom).normalize());
    m.compose(bottom.clone().lerp(topV, 0.5), q, new THREE.Vector3(1, len, 1));
    if (i % 7 === 2) reds.setMatrixAt(ri++, m); else strings.setMatrixAt(si++, m);
  }
  strings.count = si; reds.count = ri;
  strings.castShadow = false; reds.castShadow = false;
  g.add(strings, reds);
  return g;
}

/** Violin-family outline (half), y from 0 (bottom) to 1 (top), x = half width (normalised). */
function celloOutline() {
  const half = [
    [0.0, 0.0], [0.17, 0.008], [0.3, 0.04], [0.38, 0.1], [0.42, 0.18], [0.43, 0.26], [0.41, 0.33], [0.37, 0.38],
    [0.33, 0.41], [0.29, 0.43], [0.27, 0.46], [0.27, 0.5], [0.28, 0.54], [0.31, 0.57], [0.35, 0.62], [0.37, 0.69],
    [0.36, 0.77], [0.32, 0.84], [0.25, 0.9], [0.16, 0.95], [0.07, 0.985], [0.0, 1.0],
  ];
  return half;
}

export function buildCello(ctx, { wood, ebony, giltPlain }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'cello';
  const L = 0.76, Wd = 0.5;
  const half = celloOutline();
  const shape = new THREE.Shape();
  const pts = [...half.map(([x, y]) => new THREE.Vector2(x * Wd, y * L)), ...half.slice(1, -1).reverse().map(([x, y]) => new THREE.Vector2(-x * Wd, y * L))];
  shape.setFromPoints(new THREE.SplineCurve(pts.concat([pts[0]])).getPoints(120));
  const body = new THREE.ExtrudeGeometry(shape, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.012, bevelSegments: 5, curveSegments: 48 });
  body.translate(0, 0, -0.055);
  // arch the top and back plates
  {
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / (Wd * 0.43), y = p.getY(i) / L, z = p.getZ(i);
      const arch = Math.max(0, 1 - x * x) * Math.sin(Math.PI * Math.min(1, Math.max(0, y))) * 0.022;
      p.setZ(i, z + Math.sign(z) * arch);
    }
    body.computeVertexNormals();
  }
  const varnish = wood;
  const bodyMesh = new THREE.Mesh(G.applyBoxUVs(body, 2.5), varnish);
  bodyMesh.position.y = 0.0;
  g.add(bodyMesh);
  // f-holes (dark slivers)
  const fMat = new THREE.MeshBasicMaterial({ color: 0x050302 });
  for (const s of [-1, 1]) {
    const fs = new THREE.Shape();
    fs.moveTo(0, 0); fs.bezierCurveTo(0.012, 0.05, -0.012, 0.11, 0.004, 0.16); fs.lineTo(0.0, 0.16); fs.bezierCurveTo(-0.016, 0.11, 0.008, 0.05, -0.004, 0); fs.closePath();
    const f = new THREE.Mesh(new THREE.ShapeGeometry(fs, 12), fMat);
    f.position.set(s * 0.085, L * 0.36, 0.11);
    f.scale.x = s;
    g.add(f);
  }
  // neck, fingerboard, pegbox, scroll
  const neck = new THREE.Mesh(new G.RoundedBoxGeometry(0.045, 0.3, 0.05, 2, 0.012), varnish);
  neck.position.set(0, L + 0.13, 0.03); g.add(neck);
  const fbGeo = new G.RoundedBoxGeometry(0.06, 0.58, 0.018, 2, 0.006);
  { const p = fbGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = p.getY(i) / 0.58 + 0.5; p.setX(i, p.getX(i) * (1.15 - v * 0.45)); } fbGeo.computeVertexNormals(); }
  const fb = new THREE.Mesh(fbGeo, ebony);
  fb.position.set(0, L + 0.0, 0.15); fb.rotation.x = 0.06; g.add(fb);
  const pegbox = new THREE.Mesh(new G.RoundedBoxGeometry(0.04, 0.16, 0.05, 2, 0.01), varnish);
  pegbox.position.set(0, L + 0.34, 0.02); pegbox.rotation.x = -0.15; g.add(pegbox);
  const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.014, 10, 24, Math.PI * 1.8), varnish);
  scroll.rotation.y = Math.PI / 2; scroll.position.set(0, L + 0.44, 0.0); g.add(scroll);
  for (let i = 0; i < 4; i++) {
    const peg = new THREE.Mesh(G.latheFromProfile([[0.006, 0], [0.007, 0.04], [0.016, 0.05], [0.016, 0.07], [0.0, 0.075]], 10), ebony);
    peg.rotation.z = (i % 2 ? 1 : -1) * Math.PI / 2;
    peg.position.set(0, L + 0.29 + i * 0.03, 0.02); g.add(peg);
  }
  // bridge, tailpiece, strings, endpin
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.008), new THREE.MeshStandardMaterial({ color: 0xc8a878, roughness: 0.6 }));
  bridge.position.set(0, L * 0.38, 0.15); g.add(bridge);
  const tail = new THREE.Mesh(new G.RoundedBoxGeometry(0.06, 0.2, 0.014, 2, 0.006), ebony);
  tail.position.set(0, L * 0.17, 0.14); tail.rotation.x = 0.1; g.add(tail);
  const strMat = new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.3, metalness: 0.8 });
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.011;
    const a = new THREE.Vector3(x * 1.4, L * 0.25, 0.155), b = new THREE.Vector3(x * 0.7, L + 0.27, 0.165);
    const len = a.distanceTo(b);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0008, len, 4), strMat);
    s.position.copy(a).lerp(b, 0.5); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(s);
  }
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.3, metalness: 1 }));
  pin.position.set(0, -0.11, 0); g.add(pin);
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), ebony);
  button.position.set(0, -0.005, 0); g.add(button);
  return g;
}

/** Wrought brass music stand with a lyre desk and a score. */
export function buildMusicStand(ctx, { brass, seed = 7 }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'musicstand';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(G.sweepProfile([new THREE.Vector2(-0.006, -0.006), new THREE.Vector2(0.006, -0.006), new THREE.Vector2(0.006, 0.006), new THREE.Vector2(-0.006, 0.006), new THREE.Vector2(-0.006, -0.006)], [
      new THREE.Vector3(0, 0.32, 0), new THREE.Vector3(0.1, 0.12, 0), new THREE.Vector3(0.24, 0.02, 0), new THREE.Vector3(0.27, 0.0, 0),
    ]), brass);
    leg.rotation.y = a; g.add(leg);
  }
  const shaft = new THREE.Mesh(G.latheFromProfile([[0.016, 0.3], [0.02, 0.33], [0.009, 0.36], [0.009, 1.0], [0.014, 1.02], [0.006, 1.06]], 12), brass);
  g.add(shaft);
  const desk = new THREE.Group();
  const frame = new THREE.Mesh(G.frameGeometry(0.5, 0.32, { width: 0.012, depth: 0.008, uvScale: 2 }), brass);
  desk.add(frame);
  // lyre bars
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.004, 6, 24, Math.PI), brass);
    c.position.set(s * 0.11, -0.02, 0); c.rotation.z = s > 0 ? 0 : 0; desk.add(c);
  }
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.008, 0.04), brass);
  ledge.position.set(0, -0.165, 0.018); desk.add(ledge);
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.31), new THREE.MeshStandardMaterial({ map: sheetMusicTexture(ctx.textures, { seed, title: 'Danse des Ombres', w: 640, h: 432 }), roughness: 0.85, side: THREE.DoubleSide }));
  page.position.set(0, 0.0, 0.012); desk.add(page);
  desk.position.set(0, 1.18, 0.03); desk.rotation.x = -0.35;
  g.add(desk);
  return g;
}

/** Duet piano bench: tufted velvet seat on cabriole legs. */
export function buildBench(ctx, { ebony, velvet }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'bench';
  const seat = new THREE.Mesh(new G.RoundedBoxGeometry(0.9, 0.07, 0.38, 4, 0.03), velvet);
  seat.position.y = 0.5; g.add(seat);
  const frame = new THREE.Mesh(new G.RoundedBoxGeometry(0.92, 0.07, 0.4, 2, 0.01), ebony);
  frame.position.y = 0.44; g.add(frame);
  // buttons
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), velvet);
    b.position.set(-0.3 + i * 0.2, 0.535, -0.08 + j * 0.16); g.add(b);
  }
  const legProfile = [new THREE.Vector2(-0.018, -0.018), new THREE.Vector2(0.018, -0.018), new THREE.Vector2(0.018, 0.018), new THREE.Vector2(-0.018, 0.018), new THREE.Vector2(-0.018, -0.018)];
  for (const [x, z] of [[-0.4, -0.15], [0.4, -0.15], [-0.4, 0.15], [0.4, 0.15]]) {
    const sx = Math.sign(x), sz = Math.sign(z);
    const path = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; const bow = Math.sin(t * Math.PI * 1.2) * 0.035 - t * t * 0.03; path.push(new THREE.Vector3(x + sx * bow, 0.42 - t * 0.41, z + sz * bow)); }
    const leg = new THREE.Mesh(G.sweepProfile(legProfile.map((p) => p.clone().multiplyScalar(1)), path, { up: new THREE.Vector3(0, 0, 1) }), ebony);
    g.add(leg);
  }
  return g;
}
