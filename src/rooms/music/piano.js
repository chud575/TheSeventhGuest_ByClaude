import * as THREE from 'three';
import { nameboardTexture, soundboardTexture, fretworkTexture, sheetMusicTexture } from './textures.js';

/**
 * A black concert grand, modelled from the classic outline: straight bass side,
 * S-curved bentside, round tail. Local frame: origin on the floor under the
 * centre of the keyboard front, the pianist sits at +Z looking -Z, bass at -X.
 *
 * Keys are two InstancedMeshes (52 white, 36 black) so the puzzle can press any
 * of the 88 keys for two draw calls. Returns helpers for key animation + glow.
 */

export const KEY = {
  whiteW: 0.0235, whiteL: 0.148, whiteH: 0.022, gap: 0.0011,
  blackW: 0.0128, blackL: 0.094, blackH: 0.012,
  top: 0.735,         // height of white key tops
  front: 0.17,        // z of white key fronts
  first: 21,          // MIDI of the lowest key (A0)
  count: 88,
};
const CASE = { halfW: 0.75, rimBottom: 0.6, rimTop: 0.99, len: 1.95 };
const LID_FRONT = 0.3;

const isBlack = (midi) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

/** Outline polyline (x, y=back) sampled clockwise from the front-left corner. */
function outline() {
  const pts = [];
  const W = CASE.halfW;
  const cubic = (p0, p1, p2, p3, n, skipFirst = true) => {
    for (let i = skipFirst ? 1 : 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      pts.push(new THREE.Vector2(
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ));
    }
  };
  pts.push(new THREE.Vector2(-W, 0), new THREE.Vector2(W, 0), new THREE.Vector2(W, 0.3));
  cubic([W, 0.3], [W, 0.82], [0.12, 0.9], [0.0, 1.32], 26);
  cubic([0.0, 1.32], [-0.12, 1.78], [-0.5, CASE.len + 0.03], [-W + 0.09, CASE.len], 20);
  // rounded corner into the straight side
  cubic([-W + 0.09, CASE.len], [-W + 0.02, CASE.len - 0.005], [-W, CASE.len - 0.03], [-W, CASE.len - 0.1], 6);
  return pts; // closed implicitly back to (-W,0)
}

/** Offset a closed polygon inward by d (polygon is clockwise in (x, y) with y pointing back). */
function offsetPoly(pts, d) {
  const n = pts.length;
  // signed area to decide the inward side
  let area = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a.x * b.y - b.x * a.y; }
  const sgn = area > 0 ? 1 : -1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const e1 = new THREE.Vector2().subVectors(b, a).normalize();
    const e2 = new THREE.Vector2().subVectors(c, b).normalize();
    const n1 = new THREE.Vector2(-e1.y, e1.x).multiplyScalar(sgn);
    const n2 = new THREE.Vector2(-e2.y, e2.x).multiplyScalar(sgn);
    const nm = n1.clone().add(n2).normalize();
    const k = d / Math.max(0.3, nm.dot(n1));
    out.push(b.clone().addScaledVector(nm, k));
  }
  return out;
}

/** Clip a polygon to y >= y0 (simple Sutherland–Hodgman against one plane). */
function clipBelow(pts, y0) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ai = a.y >= y0, bi = b.y >= y0;
    if (ai) out.push(a.clone());
    if (ai !== bi) { const t = (y0 - a.y) / (b.y - a.y); out.push(new THREE.Vector2(a.x + (b.x - a.x) * t, y0)); }
  }
  return out;
}

const shapeOf = (pts) => { const s = new THREE.Shape(); s.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, pts[i].y); s.closePath(); return s; };
const pathOf = (pts) => { const s = new THREE.Path(); s.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, pts[i].y); s.closePath(); return s; };

/** Extrude a shape drawn in (x, back) so it lies horizontally: thickness grows +Y from y0. */
function flatExtrude(shape, thickness, y0, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 12 });
  g.rotateX(-Math.PI / 2);         // shape y -> world -z, extrude z -> world +y
  g.translate(0, y0, 0);
  return g;
}

/** Y of the bentside outline at a given x (the furthest-back point), used for string lengths. */
function backAt(pts, x) {
  let best = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) { const t = (x - a.x) / (b.x - a.x); best = Math.max(best, a.y + (b.y - a.y) * t); }
  }
  return best;
}

export function buildPiano(ctx, { ebony, brass, gold }) {
  const { materials: M, geometry: G } = ctx;
  const piano = new THREE.Group();
  piano.name = 'piano';
  const add = (m, parent = piano) => { parent.add(m); return m; };
  const pts = outline();
  const inner = offsetPoly(pts, 0.035);

  // ---------------------------------------------------------------- case
  const rimShape = shapeOf(pts);
  rimShape.holes.push(pathOf(inner));
  const rimH = CASE.rimTop - CASE.rimBottom;
  const rim = add(new THREE.Mesh(flatExtrude(rimShape, rimH - 0.012, CASE.rimBottom + 0.006, 0.006), ebony));
  rim.name = 'piano-rim';
  // moulded bottom edge (slightly proud band)
  const band = add(new THREE.Mesh(flatExtrude(shapeOf(offsetPoly(pts, -0.008)), 0.035, CASE.rimBottom - 0.02, 0.004), ebony));
  band.name = 'piano-band';
  // keybed / bottom board inside
  add(new THREE.Mesh(flatExtrude(shapeOf(inner), 0.02, CASE.rimBottom + 0.02), ebony));
  // soundboard
  const sbTex = soundboardTexture(ctx.textures);
  const sbMat = new THREE.MeshStandardMaterial({ map: sbTex.map, normalMap: sbTex.normalMap, roughness: 0.5, metalness: 0, envMapIntensity: 0.6 });
  const sbGeo = flatExtrude(shapeOf(clipBelow(inner, 0.2)), 0.01, 0.8);
  {
    // planar UVs in metres for the soundboard grain
    const p = sbGeo.attributes.position, uv = sbGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 0.6) * 0.5, -p.getZ(i) * 0.5);
  }
  add(new THREE.Mesh(sbGeo, sbMat));

  // cast-iron plate, gilt-bronze lacquer, with lightening holes
  {
    const plateOuter = clipBelow(offsetPoly(pts, 0.06), 0.06);
    const s = shapeOf(plateOuter);
    const holes = [
      [-0.42, 0.62, 0.11, 0.2], [-0.12, 0.62, 0.1, 0.18], [0.2, 0.58, 0.09, 0.15], [0.48, 0.5, 0.06, 0.1],
      [-0.42, 1.18, 0.12, 0.25], [-0.12, 1.1, 0.09, 0.2], [-0.45, 1.65, 0.1, 0.16],
    ];
    for (const [x, y, rx, ry] of holes) {
      const h = new THREE.Path();
      h.absellipse(x, y, rx, ry, 0, Math.PI * 2, true, 0);
      s.holes.push(h);
    }
    const plate = add(new THREE.Mesh(flatExtrude(s, 0.018, 0.84, 0.006), gold));
    plate.name = 'piano-plate';
    // struts over the holes (radiating bars)
    const strutMat = gold;
    const bars = [[-0.6, 0.18, -0.55, 1.75], [-0.3, 0.18, -0.25, 1.5], [0.0, 0.18, -0.05, 1.25], [0.32, 0.18, 0.28, 0.85]];
    for (const [x0, y0, x1, y1] of bars) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const b = new THREE.Mesh(new G.RoundedBoxGeometry(0.035, 0.03, len, 2, 0.008), strutMat);
      b.position.set((x0 + x1) / 2, 0.875, -(y0 + y1) / 2);
      b.rotation.y = Math.atan2(-(x1 - x0), -(y1 - y0)) + Math.PI;
      add(b);
    }
  }

  // strings: one InstancedMesh, from the tuning pins (front) to the bridge along the bentside
  {
    const n = 150;
    const sGeo = new THREE.CylinderGeometry(0.0007, 0.0007, 1, 4, 1, true);
    sGeo.rotateX(Math.PI / 2);
    const steel = new THREE.MeshStandardMaterial({ color: 0xc9c4b8, roughness: 0.25, metalness: 1.0 });
    const copper = new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.35, metalness: 1.0 });
    const strings = new THREE.InstancedMesh(sGeo, steel, n);
    const bass = new THREE.InstancedMesh(sGeo, copper, 30);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    let bi = 0, si = 0;
    for (let i = 0; i < n + 30; i++) {
      const t = i / (n + 30 - 1);
      const x = -0.66 + t * 1.36;
      const yb = backAt(inner, x) - 0.07;
      const y0 = 0.2;
      const len = Math.max(0.1, yb - y0);
      const isBass = i < 30;
      // bass strings cross over diagonally, higher above the plate
      const ang = isBass ? 0.18 : 0;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      sc.set(isBass ? 2.2 : 1, isBass ? 2.2 : 1, len / Math.cos(ang));
      const cx = x + (isBass ? Math.tan(ang) * len * -0.5 + 0.12 : 0);
      m.compose(new THREE.Vector3(cx, isBass ? 0.915 : 0.9, -(y0 + len / 2)), q, sc);
      if (isBass) bass.setMatrixAt(bi++, m); else strings.setMatrixAt(si++, m);
    }
    strings.count = si; bass.count = bi;
    strings.castShadow = false; bass.castShadow = false;
    add(strings); add(bass);
    // tuning pins: tiny cylinders in rows across the pin block
    const pin = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.03, 6), steel, 220);
    for (let i = 0; i < 220; i++) {
      const x = -0.64 + (i / 219) * 1.3;
      const row = i % 2;
      m.compose(new THREE.Vector3(x, 0.89, -(0.11 + row * 0.03)), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      pin.setMatrixAt(i, m);
    }
    pin.castShadow = false;
    add(pin);
    // dampers: felt-topped wooden blocks over the treble half
    const damperMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.7 });
    const dampers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.03, 0.035), damperMat, 66);
    for (let i = 0; i < 66; i++) {
      const x = -0.5 + (i / 65) * 1.12;
      m.compose(new THREE.Vector3(x, 0.935, -0.33), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      dampers.setMatrixAt(i, m);
    }
    add(dampers);
    // damper rail
    const rail = add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.025), ebony));
    rail.position.set(0.06, 0.955, -0.33);
  }

  // ---------------------------------------------------------------- lid (raised on the long stick)
  const lidPivot = new THREE.Group();
  lidPivot.name = 'piano-lid';
  lidPivot.position.set(-CASE.halfW, CASE.rimTop, 0);
  {
    const lidPts = clipBelow(offsetPoly(pts, -0.006), LID_FRONT);
    const g = flatExtrude(shapeOf(lidPts), 0.02, 0, 0.004);
    g.translate(CASE.halfW, 0, 0);
    const lid = new THREE.Mesh(g, ebony);
    lidPivot.add(lid);
    // folded front flap lying on top of the lid
    const flapPts = [new THREE.Vector2(-CASE.halfW, 0.0), new THREE.Vector2(CASE.halfW, 0.0), new THREE.Vector2(CASE.halfW, LID_FRONT - 0.005), new THREE.Vector2(-CASE.halfW, LID_FRONT - 0.005)];
    const fg = flatExtrude(shapeOf(flapPts), 0.018, 0.026, 0.003);
    fg.translate(CASE.halfW, 0, -LID_FRONT - 0.01);
    lidPivot.add(new THREE.Mesh(fg, ebony));
    // brass hinges along the straight side
    for (const z of [-0.45, -1.05, -1.6]) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 12), brass);
      h.rotation.x = Math.PI / 2; h.position.set(0, 0.004, z);
      lidPivot.add(h);
    }
  }
  const LID_ANGLE = 0.62;
  lidPivot.rotation.z = -LID_ANGLE;
  // note: rotation about +z, negative = the +x edge rises (pivot on the left, lifting the treble side)
  lidPivot.rotation.z = LID_ANGLE;
  add(lidPivot);
  // prop stick from the rim (treble side) up to the lid underside
  {
    const base = new THREE.Vector3(0.48, CASE.rimTop + 0.01, -0.95);
    // lid underside point above base: lid plane passes through pivot with angle
    const dx = base.x + CASE.halfW;
    const lidY = CASE.rimTop + Math.tan(LID_ANGLE) * dx;
    const top = new THREE.Vector3(base.x - 0.03, lidY - 0.02, base.z);
    const len = top.distanceTo(base);
    const stick = new THREE.Mesh(G.latheFromProfile([[0.009, 0], [0.012, 0.02], [0.01, len * 0.5], [0.012, len - 0.02], [0.008, len]], 12), ebony);
    stick.position.copy(base);
    stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(base).normalize());
    add(stick);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.012, 16), brass);
    cup.position.copy(base); add(cup);
  }

  // ---------------------------------------------------------------- keyboard
  const keys = buildKeys(ctx, piano);
  // key slip (the rail in front of the keys) + cheek blocks
  const slip = add(new THREE.Mesh(new G.RoundedBoxGeometry(1.32, 0.05, 0.025, 2, 0.006), ebony));
  slip.position.set(0, KEY.top - 0.03, KEY.front + 0.014);
  const keybed = add(new THREE.Mesh(new G.RoundedBoxGeometry(1.5, 0.075, 0.22, 2, 0.01), ebony));
  keybed.position.set(0, KEY.top - 0.07, 0.07);
  for (const s of [-1, 1]) {
    const cheekShape = new THREE.Shape();
    cheekShape.moveTo(0, 0); cheekShape.lineTo(0.2, 0); cheekShape.lineTo(0.2, 0.06);
    cheekShape.bezierCurveTo(0.2, 0.1, 0.12, 0.1, 0.08, 0.13); cheekShape.lineTo(0, 0.17); cheekShape.lineTo(0, 0);
    const cg = new THREE.ExtrudeGeometry(cheekShape, { depth: 0.075, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
    cg.rotateY(-Math.PI / 2);
    const cheek = new THREE.Mesh(G.applyBoxUVs(cg, 2), ebony);
    cheek.position.set(s < 0 ? -0.66 : 0.735, KEY.top - 0.06, 0.2);
    add(cheek);
  }
  // fallboard folded open: a bevelled board just behind the keys with the gilt name
  {
    const fb = add(new THREE.Mesh(new G.RoundedBoxGeometry(1.33, 0.11, 0.03, 2, 0.008), ebony));
    fb.position.set(0, KEY.top + 0.06, -0.005);
    fb.rotation.x = -0.12;
    const name = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.052), new THREE.MeshStandardMaterial({ map: nameboardTexture(ctx.textures), transparent: true, metalness: 0.9, roughness: 0.3, color: 0xffffff, depthWrite: false }));
    name.position.set(0, KEY.top + 0.062, 0.0115);
    name.rotation.x = -0.12;
    add(name);
    const top = add(new THREE.Mesh(new G.RoundedBoxGeometry(1.33, 0.025, 0.12, 2, 0.008), ebony));
    top.position.set(0, KEY.top + 0.12, -0.06);
  }
  // music desk with fretwork + a score
  const desk = new THREE.Group();
  desk.name = 'piano-desk';
  {
    const fret = fretworkTexture(ctx.textures);
    const fm = new THREE.MeshStandardMaterial({ map: fret.map, normalMap: fret.normalMap, alphaTest: 0.5, roughness: 0.25, metalness: 0, side: THREE.DoubleSide, color: 0x7a7a7a });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.3), fm);
    panel.position.y = 0.17; desk.add(panel);
    const frameG = new THREE.Mesh(G.frameGeometry(0.78, 0.3, { width: 0.018, depth: 0.012, uvScale: 2 }), ebony);
    frameG.position.y = 0.17; desk.add(frameG);
    const ledge = new THREE.Mesh(new G.RoundedBoxGeometry(0.84, 0.014, 0.045, 2, 0.005), ebony);
    ledge.position.set(0, 0.01, 0.02); desk.add(ledge);
    const sheetMat = (seed, title) => new THREE.MeshStandardMaterial({ map: sheetMusicTexture(ctx.textures, { seed, title }), roughness: 0.85, side: THREE.DoubleSide });
    for (const [x, seed, ry, title] of [[-0.135, 3, 0.05, 'Nocturne for the Seventh Guest'], [0.135, 4, -0.05, '']]) {
      const page = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.33, 6, 1), sheetMat(seed, title));
      const p = page.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) / 0.125; p.setZ(i, 0.012 * (1 - u * u) + (x < 0 ? -1 : 1) * u * 0.004); }
      page.geometry.computeVertexNormals();
      page.position.set(x, 0.19, 0.012); page.rotation.y = ry;
      desk.add(page);
    }
  }
  desk.position.set(0, KEY.top + 0.13, -0.12);
  desk.rotation.x = -0.24;
  add(desk);

  // ---------------------------------------------------------------- legs, lyre, pedals
  const legProfile = [[0.0, 0], [0.034, 0], [0.04, 0.02], [0.036, 0.045], [0.05, 0.08], [0.062, 0.14], [0.058, 0.2], [0.045, 0.25], [0.04, 0.3], [0.05, 0.36], [0.058, 0.42], [0.055, 0.48], [0.075, 0.52], [0.075, 0.56], [0.0, 0.57]];
  const legGeo = G.latheFromProfile(legProfile, 28);
  const legPos = [[-0.6, 0.12], [0.62, 0.12], [-0.42, 1.72]];
  for (const [x, y] of legPos) {
    const leg = new THREE.Mesh(legGeo, ebony);
    leg.position.set(x, 0.035, -y);
    add(leg);
    const castor = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 16), brass);
    castor.rotation.z = Math.PI / 2; castor.position.set(x, 0.022, -y);
    add(castor);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.005, 8, 28), brass);
    ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.56, -y);
    add(ring);
  }
  // lyre
  {
    const lyre = new THREE.Group();
    const armProfile = [new THREE.Vector2(-0.015, -0.012), new THREE.Vector2(0.015, -0.012), new THREE.Vector2(0.015, 0.012), new THREE.Vector2(-0.015, 0.012), new THREE.Vector2(-0.015, -0.012)];
    for (const s of [-1, 1]) {
      const path = [];
      for (let i = 0; i <= 14; i++) { const t = i / 14; path.push(new THREE.Vector3(s * (0.05 + 0.06 * Math.sin(t * Math.PI) - 0.02 * t), 0.1 + t * 0.48, 0)); }
      const arm = new THREE.Mesh(G.sweepProfile(armProfile, path, { up: new THREE.Vector3(0, 0, 1) }), ebony);
      lyre.add(arm);
    }
    const box = new THREE.Mesh(new G.RoundedBoxGeometry(0.26, 0.07, 0.11, 2, 0.012), ebony);
    box.position.y = 0.07; lyre.add(box);
    for (const x of [-0.065, 0, 0.065]) {
      const ped = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.012, 0.1), brass);
      ped.position.set(x, 0.055, 0.09); ped.rotation.x = 0.12; lyre.add(ped);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 16), brass);
      tip.position.set(x, 0.05, 0.14); lyre.add(tip);
    }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 8), brass);
    rod.position.set(0, 0.35, -0.03); lyre.add(rod);
    lyre.position.set(0, 0, -0.42);
    add(lyre);
  }

  piano.userData = { keys, lidPivot, desk };
  return piano;
}

/** 88 keys as two InstancedMeshes. Returns { white, black, keyOf(instanceHit), setPress(midi, amount), xOf(midi), glow } */
function buildKeys(ctx, piano) {
  const { geometry: G } = ctx;
  const whiteMidi = [], blackMidi = [];
  for (let k = 0; k < KEY.count; k++) { const m = KEY.first + k; (isBlack(m) ? blackMidi : whiteMidi).push(m); }
  const x0 = -(whiteMidi.length * KEY.whiteW) / 2;
  const xOf = new Map();
  whiteMidi.forEach((m, i) => xOf.set(m, x0 + (i + 0.5) * KEY.whiteW));
  // black keys sit between white neighbours, nudged like a real keyboard
  const nudge = { 1: -0.15, 3: 0.15, 6: -0.2, 8: 0, 10: 0.2 };
  for (const m of blackMidi) {
    const l = xOf.get(m - 1), r = xOf.get(m + 1);
    xOf.set(m, (l + r) / 2 + nudge[m % 12] * KEY.blackW * 0.6);
  }
  // white key geometry: bevelled top front edge; pivot at the back (z = 0 at the back end)
  const wg = new G.RoundedBoxGeometry(KEY.whiteW - KEY.gap, KEY.whiteH, KEY.whiteL + 0.25, 2, 0.0022);
  wg.translate(0, -KEY.whiteH / 2, -(KEY.whiteL + 0.25) / 2);
  const bgeo = new G.RoundedBoxGeometry(KEY.blackW, KEY.blackH + 0.012, KEY.blackL + 0.2, 3, 0.0028);
  bgeo.translate(0, (KEY.blackH + 0.012) / 2 - 0.012, -(KEY.blackL + 0.2) / 2);
  // taper the black key top (narrower at the top like real sharps)
  {
    const p = bgeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.004) p.setX(i, p.getX(i) * 0.8); }
    bgeo.computeVertexNormals();
  }
  const ivory = new THREE.MeshPhysicalMaterial({ color: 0xe9e0c8, roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0.2, emissive: new THREE.Color(0x000000) });
  const jet = new THREE.MeshPhysicalMaterial({ color: 0x0b0a0a, roughness: 0.28, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12 });
  const white = new THREE.InstancedMesh(wg, ivory, whiteMidi.length);
  const black = new THREE.InstancedMesh(bgeo, jet, blackMidi.length);
  white.name = 'keys-white'; black.name = 'keys-black';
  white.userData.dynamic = true; black.userData.dynamic = true;
  const backZ = KEY.front - KEY.whiteL - 0.25;  // pivot line z for white keys
  const press = new Map();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), axis = new THREE.Vector3(1, 0, 0);
  const place = (midi) => {
    const blackKey = isBlack(midi);
    const list = blackKey ? blackMidi : whiteMidi;
    const idx = list.indexOf(midi);
    const a = (press.get(midi) || 0) * 0.045;
    q.setFromAxisAngle(axis, a);
    const z = blackKey ? KEY.front - 0.05 : KEY.front;
    const len = blackKey ? KEY.blackL + 0.2 : KEY.whiteL + 0.25;
    // geometry origin is at the key FRONT top; rotate around the back end
    const pivot = new THREE.Vector3(xOf.get(midi), KEY.top, z - len);
    const off = new THREE.Vector3(0, 0, len).applyQuaternion(q);
    m4.compose(pivot.clone().add(off), q, one);
    (blackKey ? black : white).setMatrixAt(idx, m4);
  };
  // the translate above put the origin at the back... fix: geometry spans z in [-(len), 0] from origin => origin = front.
  for (const m of whiteMidi) place(m);
  for (const m of blackMidi) place(m);
  white.instanceMatrix.needsUpdate = true; black.instanceMatrix.needsUpdate = true;
  piano.add(white, black);

  // glow overlays (pooled): additive quads hovering over a key top
  const glowMat = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glows = [];
  for (let i = 0; i < 4; i++) {
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(new THREE.Color(0.5, 0.75, 1.6)));
    gm.rotation.x = -Math.PI / 2; gm.visible = false; gm.renderOrder = 5; gm.userData.noBake = true; gm.userData.noShadow = true;
    piano.add(gm);
    glows.push({ mesh: gm, life: 0, midi: -1 });
  }

  const api = {
    white, black, whiteMidi, blackMidi, xOf: (m) => xOf.get(m), isBlack,
    keyOf(hit) {
      if (!hit || hit.instanceId === undefined) return null;
      if (hit.object === white) return whiteMidi[hit.instanceId];
      if (hit.object === black) return blackMidi[hit.instanceId];
      return null;
    },
    setPress(midi, amount) { press.set(midi, amount); place(midi); (isBlack(midi) ? black : white).instanceMatrix.needsUpdate = true; },
    /** flash a key: ghost=true blue-white, otherwise warm */
    flash(midi, { ghost = true, dur = 0.6 } = {}) {
      const g = glows.find((x) => x.life <= 0) || glows[0];
      const bk = isBlack(midi);
      g.mesh.material.color.set(ghost ? new THREE.Color(0.45, 0.7, 1.7) : new THREE.Color(1.6, 0.9, 0.4));
      g.mesh.scale.set(bk ? KEY.blackW * 1.25 : KEY.whiteW * 0.95, bk ? KEY.blackL : KEY.whiteL * 0.98, 1);
      g.mesh.position.set(xOf.get(midi), KEY.top + (bk ? KEY.blackH + 0.002 : 0.0015), (bk ? KEY.front - 0.05 : KEY.front) - (bk ? KEY.blackL : KEY.whiteL) / 2);
      g.life = dur; g.dur = dur; g.midi = midi; g.mesh.visible = true;
    },
    update(dt) {
      for (const g of glows) {
        if (g.life <= 0) continue;
        g.life -= dt;
        const k = Math.max(0, g.life / g.dur);
        g.mesh.material.opacity = 0.9 * Math.pow(k, 0.7);
        if (g.life <= 0) g.mesh.visible = false;
      }
      for (const [m, a] of press) {
        if (a <= 0) continue;
        const na = Math.max(0, a - dt * 4.5);
        api.setPress(m, na);
      }
    },
    press(midi) { api.setPress(midi, 1); },
  };
  return api;
}
