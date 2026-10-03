import * as THREE from 'three';
import { sheetMusicTexture, harpSoundboardTexture } from './textures.js';

/**
 * Harp, cello (on its stand), music stand and piano bench for the music room.
 * Every builder returns a Group with its origin on the floor.
 */

/** Pedal harp, ~1.8 m: fluted gilt column with a carved acanthus crown, double-curved
 *  neck, a flared loft soundbox with a painted soundboard, 44 strings, 7 pedals. */
export function buildHarp(ctx, { gilt, giltPlain, wood, box = wood }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'harp';
  // frame plane = XY (z = side to side). Column at x = +0.25 (front), soundbox leans back from the base.
  // ---- base: moulded plinth on gilt paw feet, pedal slots, seven pedals
  const base = new THREE.Mesh(new G.RoundedBoxGeometry(0.5, 0.1, 0.32, 3, 0.025), box);
  base.position.set(0.06, 0.08, 0); g.add(base);
  const plinth = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.035, 0.02), [new THREE.Vector3(-0.19, 0.13, -0.16), new THREE.Vector3(0.31, 0.13, -0.16), new THREE.Vector3(0.31, 0.13, 0.16), new THREE.Vector3(-0.19, 0.13, 0.16)], { closed: true, uvScale: 2 }), giltPlain);
  g.add(plinth);
  const top = new THREE.Mesh(new G.RoundedBoxGeometry(0.44, 0.03, 0.27, 2, 0.01), box);
  top.position.set(0.06, 0.145, 0); g.add(top);
  for (const [x, z] of [[-0.16, -0.13], [0.28, -0.13], [-0.16, 0.13], [0.28, 0.13]]) {
    const foot = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.032, 0.0], [0.04, 0.012], [0.03, 0.03], [0.036, 0.04], [0, 0.045]], 16), giltPlain);
    foot.position.set(x, 0, z); g.add(foot);
  }
  for (let i = 0; i < 7; i++) {
    const zz = -0.12 + i * 0.04;
    const ped = new THREE.Mesh(new G.RoundedBoxGeometry(0.11, 0.012, 0.022, 2, 0.005), giltPlain);
    const side = i < 3 ? -1 : 1;
    ped.position.set(i === 3 ? 0.34 : 0.33, 0.05 + (i % 2) * 0.012, zz); ped.rotation.z = -0.15; g.add(ped);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), giltPlain);
    tip.position.set(0.385, 0.045 + (i % 2) * 0.012, zz); g.add(tip);
    void side;
  }
  // ---- column: fluted gilt shaft on a turned base, carved crown capital
  const colX = 0.25, colY0 = 0.16, colH = 1.36;
  const shaftGeo = G.latheFromProfile([[0.045, 0], [0.05, 0.02], [0.038, 0.05], [0.042, 0.07], [0.032, 0.1], [0.03, colH * 0.5], [0.028, colH - 0.04], [0.034, colH - 0.02], [0.03, colH]], 40);
  {
    // flutes: shallow grooves in the shaft section (between turnings)
    const p = shaftGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i); if (y < 0.12 || y > colH - 0.05) continue;
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const k = 1 - 0.09 * Math.pow(Math.max(0, Math.cos(a * 12)), 4);
      p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
    }
    shaftGeo.computeVertexNormals();
  }
  const column = new THREE.Mesh(shaftGeo, gilt);
  column.position.set(colX, colY0, 0); g.add(column);
  // spiral garland twined about the shaft
  {
    const pts = [];
    for (let i = 0; i <= 160; i++) { const t = i / 160; const a = t * Math.PI * 9; pts.push(new THREE.Vector3(colX + Math.cos(a) * 0.033, colY0 + 0.15 + t * (colH - 0.25), Math.sin(a) * 0.033)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.0045, 5), giltPlain));
  }
  // capital: bell of acanthus leaves (lathe with angular ridges), abacus, and a crown of anthemion
  const capGeo = G.latheFromProfile([[0.03, 0], [0.034, 0.015], [0.05, 0.05], [0.07, 0.1], [0.085, 0.14], [0.08, 0.16], [0.06, 0.165]], 64, );
  {
    const p = capGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i));
      const leaf = Math.pow(Math.abs(Math.cos(a * 4)), 3) * Math.min(1, y / 0.06);
      const curl = 1 + 0.18 * leaf * Math.sin(Math.min(1, y / 0.16) * Math.PI) + 0.04 * Math.sin(a * 24) * Math.min(1, y / 0.1);
      p.setX(i, p.getX(i) * curl); p.setZ(i, p.getZ(i) * curl);
    }
    capGeo.computeVertexNormals();
  }
  const cap = new THREE.Mesh(capGeo, gilt);
  cap.position.set(colX, colY0 + colH, 0); g.add(cap);
  const abacus = new THREE.Mesh(new G.RoundedBoxGeometry(0.16, 0.025, 0.12, 2, 0.008), giltPlain);
  abacus.position.set(colX, colY0 + colH + 0.175, 0); g.add(abacus);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), gilt);
    leaf.scale.set(0.5, 1.6, 0.25);
    leaf.position.set(colX + Math.cos(a) * 0.065, colY0 + colH + 0.215, Math.sin(a) * 0.05);
    leaf.rotation.set(Math.sin(a) * 0.35, -a, -Math.cos(a) * 0.35);
    g.add(leaf);
  }
  const finial = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.03, 0], [0.04, 0.03], [0.022, 0.06], [0.03, 0.08], [0.0, 0.11]], 20), gilt);
  finial.position.set(colX, colY0 + colH + 0.19, 0); g.add(finial);
  // ---- soundbox: loft along the axis, flared at the base, half-round back, flat soundboard in front
  const A = new THREE.Vector2(0.0, 0.16), B = new THREE.Vector2(-0.45, 1.55);
  const u = B.clone().sub(A); const L = u.length(); u.normalize();
  const nb = new THREE.Vector2(-u.y, u.x);    // points to -x (behind); soundboard faces -nb
  if (nb.x > 0) nb.negate();
  const NS = 40, NA = 24;
  const halfW = (t) => 0.045 + 0.13 * Math.pow(1 - t, 1.3) + 0.03 * Math.pow(1 - t, 8);
  const bulge = (t) => 0.04 + 0.13 * Math.pow(1 - t, 1.1);
  {
    const pos = [], idx = [], uv = [];
    for (let i = 0; i <= NS; i++) {
      const t = i / NS;
      const c = A.clone().addScaledVector(u, L * t);
      for (let j = 0; j <= NA; j++) {
        const ph = (j / NA) * Math.PI;
        const bx = Math.sin(ph) * bulge(t), z = Math.cos(ph) * halfW(t);
        pos.push(c.x + nb.x * bx, c.y + nb.y * bx, z);
        uv.push(j / NA * 0.6, t * L);
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NA; j++) { const a0 = i * (NA + 1) + j, a1 = a0 + NA + 1; idx.push(a0, a0 + 1, a1, a0 + 1, a1 + 1, a1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    // make sure normals face outward (away from the axis)
    const sb = new THREE.Mesh(geo, box);
    const n0 = geo.attributes.normal; const p0 = geo.attributes.position;
    const k = Math.floor(NA / 2);
    const test = new THREE.Vector3(n0.getX(k), n0.getY(k), n0.getZ(k));
    if (test.x * nb.x + test.y * nb.y < 0) { geo.setIndex(idx.map((_, i2, arr) => arr[i2 - (i2 % 3) + [0, 2, 1][i2 % 3]])); geo.computeVertexNormals(); }
    void p0;
    g.add(sb);
    // painted spruce soundboard (flat face) with a gilt border
    const sbPos = [], sbUv = [], sbIdx = [];
    for (let i = 0; i <= NS; i++) {
      const t = i / NS; const c = A.clone().addScaledVector(u, L * t); const w = halfW(t);
      sbPos.push(c.x - nb.x * 0.002, c.y - nb.y * 0.002, -w, c.x - nb.x * 0.002, c.y - nb.y * 0.002, w);
      sbUv.push(0, t, 1, t);
    }
    for (let i = 0; i < NS; i++) { const a0 = i * 2; sbIdx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(sbPos, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(sbUv, 2));
    fg.setIndex(sbIdx); fg.computeVertexNormals();
    const face = new THREE.Mesh(fg, new THREE.MeshPhysicalMaterial({ map: harpSoundboardTexture(ctx.textures), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2, side: THREE.DoubleSide }));
    g.add(face);
    // gilt edge beads along both sides of the soundboard
    for (const sgn of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= NS; i += 2) { const t = i / NS; const c = A.clone().addScaledVector(u, L * t); pts.push(new THREE.Vector3(c.x - nb.x * 0.004, c.y - nb.y * 0.004, sgn * halfW(t))); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.007, 6), giltPlain));
    }
    // centre strip (string rib) down the soundboard
    const rib = new THREE.Mesh(new G.RoundedBoxGeometry(0.022, L * 0.9, 0.012, 2, 0.004), box);
    const mid = A.clone().addScaledVector(u, L * 0.5);
    rib.position.set(mid.x - nb.x * 0.006, mid.y - nb.y * 0.006, 0);
    rib.rotation.z = Math.atan2(u.y, u.x) - Math.PI / 2; rib.rotation.y = 0;
    g.add(rib);
  }
  // ---- neck: double S-curve from the column crown to the soundbox head, gilt-edged, scroll end
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(colX, colY0 + colH + 0.2, 0),
    new THREE.Vector3(0.14, 1.79, 0),
    new THREE.Vector3(0.0, 1.73, 0),
    new THREE.Vector3(-0.13, 1.6, 0),
    new THREE.Vector3(-0.27, 1.56, 0),
    new THREE.Vector3(-0.4, 1.63, 0),
    new THREE.Vector3(-0.49, 1.66, 0),
    new THREE.Vector3(-0.53, 1.6, 0),
  ], false, 'centripetal');
  const neckGeo = new THREE.TubeGeometry(neckCurve, 120, 0.04, 14, false);
  { const p = neckGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * 0.5); neckGeo.computeVertexNormals(); }
  g.add(new THREE.Mesh(neckGeo, box));
  for (const zz of [-0.02, 0.02]) {
    const e = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 120, 0.009, 6, false), giltPlain);
    e.position.z = zz; g.add(e);
  }
  // carved gilt leaf run along the top of the neck
  for (let i = 0; i < 26; i++) {
    const t = 0.06 + (i / 25) * 0.86;
    const pt = neckCurve.getPoint(t), tg = neckCurve.getTangent(t);
    const nrm = new THREE.Vector3(-tg.y, tg.x, 0);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), giltPlain);
    leaf.scale.set(1.8, 0.6, 0.8);
    leaf.position.copy(pt).addScaledVector(nrm, 0.036);
    leaf.rotation.z = Math.atan2(tg.y, tg.x) + 0.4;
    g.add(leaf);
  }
  const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.014, 8, 24, Math.PI * 1.6), gilt);
  scroll.position.set(-0.52, 1.63, 0); scroll.rotation.z = 2.2; g.add(scroll);
  // ---- strings: soundboard eyelets up to tuning pins under the neck
  const n = 44;
  const strMat = new THREE.MeshPhysicalMaterial({ color: 0xe6dcc4, roughness: 0.3, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.15 });
  const redMat = new THREE.MeshPhysicalMaterial({ color: 0x9a1e16, roughness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.15 });
  const blueMat = new THREE.MeshPhysicalMaterial({ color: 0x1a2440, roughness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.15 });
  const sGeo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
  const mk = (mat) => { const im = new THREE.InstancedMesh(sGeo, mat, n); im.count = 0; im.castShadow = false; return im; };
  const sets = { w: mk(strMat), r: mk(redMat), b: mk(blueMat) };
  const pinGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.07, 6); pinGeo.rotateX(Math.PI / 2);
  const pins = new THREE.InstancedMesh(pinGeo, new THREE.MeshStandardMaterial({ color: 0xc8c0b0, metalness: 1, roughness: 0.3 }), n);
  const eyelets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.005, 8, 6), giltPlain, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const neckSamples = []; for (let k = 0; k <= 400; k++) neckSamples.push(neckCurve.getPoint(k / 400));
  for (let i = 0; i < n; i++) {
    const t = 0.05 + (i / (n - 1)) * 0.88;
    const c = A.clone().addScaledVector(u, L * t);
    const bottom = new THREE.Vector3(c.x - nb.x * 0.008, c.y - nb.y * 0.008, 0);
    // neck underside straight above
    let best = neckSamples[0], bd = 1e9;
    for (const ns of neckSamples) { if (ns.x > colX - 0.06) continue; const d = Math.abs(ns.x - bottom.x); if (d < bd) { bd = d; best = ns; } }
    const topP = new THREE.Vector3(bottom.x + 0.004, best.y - 0.036, 0);
    const len = topP.distanceTo(bottom);
    if (len < 0.06) continue;
    const r = 0.0007 + 0.0013 * (1 - i / n);
    q.setFromUnitVectors(up, topP.clone().sub(bottom).normalize());
    m.compose(bottom.clone().lerp(topP, 0.5), q, new THREE.Vector3(r, len, r));
    const note = i % 7;
    const set = note === 0 ? sets.r : note === 4 ? sets.b : sets.w;
    set.setMatrixAt(set.count++, m);
    m.compose(new THREE.Vector3(topP.x, best.y - 0.01, 0), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); pins.setMatrixAt(i, m);
    m.compose(bottom, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); eyelets.setMatrixAt(i, m);
  }
  g.add(sets.w, sets.r, sets.b, pins, eyelets);
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
  // an open folio: two pages bowing away from the spine, outer corners lifting
  for (const sx of [-1, 1]) {
    const pg = new THREE.PlaneGeometry(0.225, 0.31, 12, 6);
    const p = pg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i) / 0.225 + 0.5);         // 0 at spine side (after mirroring) -> 1 outer
      const uu = sx < 0 ? 1 - u : u;
      const v = p.getY(i) / 0.31 + 0.5;
      p.setZ(i, 0.018 * Math.sin(uu * Math.PI * 0.85) + 0.012 * uu * uu * (v > 0.75 ? (v - 0.75) * 4 : 0));
    }
    pg.computeVertexNormals();
    const page = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: sheetMusicTexture(ctx.textures, { seed: seed + (sx > 0 ? 1 : 0), title: sx < 0 ? 'Danse des Ombres' : '' }), roughness: 0.85, side: THREE.DoubleSide }));
    page.position.set(sx * 0.1135, 0.0, 0.01);
    desk.add(page);
  }
  desk.position.set(0, 1.18, 0.03); desk.rotation.x = -0.35;
  g.add(desk);
  return g;
}

/** Duet piano bench: tufted velvet seat on cabriole legs. */
export function buildBench(ctx, { ebony, velvet }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'bench';
  // domed, button-tufted cushion
  const cg = new G.RoundedBoxGeometry(0.88, 0.08, 0.37, 6, 0.035);
  {
    const tufts = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) tufts.push([-0.3 + i * 0.2, -0.08 + j * 0.16]);
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y <= 0) continue;
      const dome = Math.max(0, 1 - (x / 0.44) ** 4) * Math.max(0, 1 - (z / 0.185) ** 4);
      let dy = dome * 0.022;
      for (const [tx, tz] of tufts) dy -= 0.012 * Math.exp(-((x - tx) ** 2 + (z - tz) ** 2) / 0.0006);
      p.setY(i, y + dy * (y / 0.04));
    }
    cg.computeVertexNormals();
  }
  const seat = new THREE.Mesh(cg, velvet);
  seat.position.y = 0.5; g.add(seat);
  const frame = new THREE.Mesh(new G.RoundedBoxGeometry(0.92, 0.075, 0.4, 2, 0.01), ebony);
  frame.position.y = 0.445; g.add(frame);
  const apron = new THREE.Mesh(G.sweepProfile([new THREE.Vector2(0, 0), new THREE.Vector2(0.012, 0.0), new THREE.Vector2(0.016, 0.02), new THREE.Vector2(0.008, 0.035), new THREE.Vector2(0, 0.04)],
    [new THREE.Vector3(-0.46, 0.39, -0.2), new THREE.Vector3(0.46, 0.39, -0.2), new THREE.Vector3(0.46, 0.39, 0.2), new THREE.Vector3(-0.46, 0.39, 0.2)], { closed: true, uvScale: 2 }), ebony);
  g.add(apron);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), velvet);
    b.position.set(-0.3 + i * 0.2, 0.531, -0.08 + j * 0.16); g.add(b);
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
