import * as THREE from 'three';
import { archDialTexture } from './textures.js';
import { RAIL_Y } from './layout.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Gas sconce, authored facing +Z with the backplate at the origin. Returns { group, lightPos (local), shade }. */
export function makeSconce(ctx, mat) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'sconce';
  const plate = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.055, 0], [0.058, 0.006], [0.05, 0.014], [0.035, 0.02], [0.02, 0.03], [0, 0.034]], 28), mat.brass);
  plate.rotation.x = Math.PI / 2; plate.scale.set(1, 1, 1.7); g.add(plate);
  // swan-neck arm
  const curve = new THREE.CatmullRomCurve3([V3(0, -0.02, 0.025), V3(0, -0.07, 0.09), V3(0, -0.05, 0.17), V3(0, 0.02, 0.21), V3(0, 0.07, 0.215)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.0085, 10), mat.brass));
  // decorative scroll under the arm
  const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 8, 20, Math.PI * 1.5), mat.brass);
  scroll.position.set(0, -0.1, 0.07); scroll.rotation.y = Math.PI / 2; g.add(scroll);
  const drop = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0.01], [0.016, 0.03], [0.008, 0.05], [0, 0.06]], 16), mat.brass);
  drop.position.set(0, -0.19, 0.02); g.add(drop);
  // gas cock + gallery (shade holder)
  const tap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.006, 0.006), mat.brass); tap.position.set(0, 0.0, 0.2); g.add(tap);
  const gal = new THREE.Mesh(G.latheFromProfile([[0.008, 0], [0.022, 0.004], [0.034, 0.016], [0.036, 0.024], [0.03, 0.026], [0.01, 0.012]], 24), mat.brass);
  gal.position.set(0, 0.075, 0.215); g.add(gal);
  // etched tulip shade (frosted, lit from inside)
  const shade = new THREE.Mesh(G.latheFromProfile([[0.026, 0], [0.034, 0.012], [0.05, 0.04], [0.06, 0.075], [0.062, 0.1], [0.058, 0.118], [0.064, 0.126], [0.056, 0.128]], 32), mat.shade);
  shade.position.set(0, 0.095, 0.215);
  shade.name = 'shade';
  shade.userData.noShadow = true;
  g.add(shade);
  const flame = ctx.fx.flame({ height: 0.045, width: 0.016, intensity: 7 });
  flame.position.set(0, 0.105, 0.215);
  g.add(flame);
  return { group: g, lightPos: V3(0, 0.15, 0.215), shade, flame };
}

/** Picture frame + canvas hung from the picture rail on two cords. Facing +Z, origin = canvas centre. */
export function makeFramed(ctx, mat, canvasMat, w, h, { frameW = 0.12, cords = true, centreY = 1.85 } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'framed';
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), canvasMat);
  canvas.position.z = 0.012;
  canvas.name = 'canvas';
  g.add(canvas);
  const frame = new THREE.Mesh(G.frameGeometry(w, h, { width: frameW, depth: 0.075, uvScale: 1 }), mat.giltFrame);
  frame.position.z = -0.01;
  g.add(frame);
  // inner sight slip
  const slip = new THREE.Mesh(G.frameGeometry(w - 0.01, h - 0.01, { width: 0.018, depth: 0.02, uvScale: 4 }), mat.giltPlain);
  slip.position.z = 0.008; g.add(slip);
  // back board shadow-catcher
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + frameW * 2 - 0.02, h + frameW * 2 - 0.02, 0.02), mat.black);
  back.position.z = -0.02; g.add(back);
  if (cords) {
    const topY = h / 2 + frameW;
    const railRel = RAIL_Y - centreY;
    for (const s of [-1, 1]) {
      const a = V3(s * (w / 2 - 0.05), topY - 0.04, -0.015), b = V3(s * 0.04, railRel, -0.07);
      const len = a.distanceTo(b);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, len, 5), mat.cord);
      cord.position.copy(a).add(b).multiplyScalar(0.5);
      cord.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
      g.add(cord);
    }
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 12, Math.PI), mat.brass);
    hook.position.set(0, railRel, -0.07); hook.rotation.z = Math.PI; g.add(hook);
  }
  return { group: g, canvas, frame };
}

/**
 * Long-case clock, facing +Z, origin at the floor against the wall.
 * Ogee bracket feet, panelled base, glazed trunk door showing a swinging brass pendulum and
 * weights, hood with turned columns, a painted arch dial behind glass, and a swan-neck pediment
 * with brass finials. Returns the group; group.userData.pendulum is the pivot to animate.
 */
export function makeClock(ctx, mat) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'clock';
  const wood = mat.clockWood || mat.doorWood, trim = mat.mahogany;
  const box = (w, h, d, x, y, z, m = wood, r = 0.004) => {
    const geo = r > 0 ? G.applyBoxUVs(new G.RoundedBoxGeometry(w, h, d, 2, r), 1) : G.boxUV(w, h, d, 1);
    const b = new THREE.Mesh(geo, m); b.position.set(x, y, z); g.add(b); return b;
  };
  // stepped moulding: a run of rounded slabs, each narrower/wider than the last
  const steps = (y0, list, depth0) => { let y = y0; for (const [w, h, inset] of list) { box(w, h, depth0 - inset, 0, y + h / 2, (depth0 - inset) / 2, trim, Math.min(0.006, h / 2.2)); y += h; } return y; };
  // ---- ogee bracket feet
  const foot = new THREE.Shape();
  foot.moveTo(0, 0); foot.lineTo(0.1, 0); foot.bezierCurveTo(0.1, 0.03, 0.03, 0.02, 0.025, 0.065); foot.lineTo(0, 0.07); foot.lineTo(0, 0);
  const footGeo = G.applyBoxUVs(new THREE.ExtrudeGeometry(foot, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 }), 1);
  for (const sx of [-1, 1]) {
    const f1 = new THREE.Mesh(footGeo, trim); f1.scale.x = -sx; f1.position.set(sx * 0.285, 0, 0.3); g.add(f1);       // front face
    const f2 = new THREE.Mesh(footGeo, trim); f2.rotation.y = sx * Math.PI / 2; f2.scale.x = -1; f2.position.set(sx * 0.285, 0, 0.32); g.add(f2);
  }
  box(0.52, 0.06, 0.28, 0, 0.04, 0.15, trim);
  // ---- base
  let y = steps(0.07, [[0.6, 0.03, 0.0], [0.58, 0.02, 0.01]], 0.34);
  box(0.54, 0.4, 0.3, 0, y + 0.2, 0.15);
  const bp = new THREE.Mesh(G.raisedPanel(0.38, 0.28, { border: 0.045, bevel: 0.02 }), wood); bp.position.set(0, y + 0.2, 0.301); g.add(bp);
  y += 0.4;
  // waist moulding steps in to the trunk
  y = steps(y, [[0.58, 0.022, 0.0], [0.52, 0.018, 0.03], [0.47, 0.02, 0.055], [0.44, 0.03, 0.07]], 0.34);
  // ---- trunk with glazed door
  const trunkH = 1.08, ty0 = y;
  box(0.42, trunkH, 0.24, 0, ty0 + trunkH / 2, 0.12, wood, 0.003);
  // reeded quarter columns at the front corners
  for (const sx of [-1, 1]) {
    const col = new THREE.Mesh(G.latheFromProfile([[0.022, 0], [0.026, 0.02], [0.018, 0.04], [0.016, 0.06], [0.016, trunkH - 0.06], [0.018, trunkH - 0.04], [0.026, trunkH - 0.02], [0.022, trunkH], [0, trunkH]], 16), trim);
    col.position.set(sx * 0.205, ty0, 0.235); g.add(col);
    for (const yy of [ty0 + 0.012, ty0 + trunkH - 0.012]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.016, 16), mat.brass); c.position.set(sx * 0.205, yy, 0.235); g.add(c); }
  }
  const dw = 0.3, dh = 0.94, dy = ty0 + 0.07;
  const door = new THREE.Shape();
  door.moveTo(-dw / 2, 0); door.lineTo(dw / 2, 0); door.lineTo(dw / 2, dh); door.lineTo(-dw / 2, dh); door.lineTo(-dw / 2, 0);
  const gw = 0.2, gh0 = 0.12, gTop = dh - 0.16;
  const hole = new THREE.Path();
  hole.moveTo(-gw / 2, gh0); hole.lineTo(gw / 2, gh0); hole.lineTo(gw / 2, gTop); hole.absarc(0, gTop, gw / 2, 0, Math.PI, false); hole.lineTo(-gw / 2, gh0);
  door.holes.push(hole);
  const doorGeo = G.applyBoxUVs(new THREE.ExtrudeGeometry(door, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2, curveSegments: 24 }), 1);
  const doorM = new THREE.Mesh(doorGeo, wood); doorM.position.set(0, dy, 0.24); g.add(doorM);
  // moulded bead round the glazing
  const beadPts = hole.getSpacedPoints(80).map((q) => V3(q.x, q.y + dy, 0.264));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(beadPts, true), 120, 0.006, 8, true), trim));
  const glassShape = new THREE.Shape(hole.getPoints(24));
  const clockGlass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.04, metalness: 0, envMapIntensity: 0.25, depthWrite: false, name: 'clockGlass' });
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(glassShape, 24), clockGlass); glass.position.set(0, dy, 0.252); glass.userData.noShadow = true; glass.name = 'clockGlass'; g.add(glass);
  // dark interior behind the glass
  box(0.36, trunkH - 0.04, 0.01, 0, ty0 + trunkH / 2, 0.02, trim, 0);
  // weights on their lines
  for (const sx of [-1, 1]) {
    const wy = ty0 + 0.62 + sx * 0.08;
    const wgt = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.026, 0], [0.03, 0.01], [0.03, 0.2], [0.026, 0.21], [0.008, 0.22], [0.008, 0.24], [0, 0.24]], 20), mat.brassBright);
    wgt.position.set(sx * 0.085, wy, 0.07); g.add(wgt);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, ty0 + trunkH - wy - 0.24, 4), mat.cord);
    line.position.set(sx * 0.085, (wy + 0.24 + ty0 + trunkH) / 2, 0.07); g.add(line);
  }
  // pendulum: rod + lenticular bob, swinging from the top of the trunk
  const pend = new THREE.Group(); pend.name = 'pendulum';
  pend.position.set(0, ty0 + trunkH - 0.02, 0.13);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.82, 6), mat.brass); rod.position.y = -0.41; pend.add(rod);
  const bob = new THREE.Mesh(G.latheFromProfile([[0, -0.012], [0.04, -0.01], [0.065, -0.005], [0.07, 0], [0.065, 0.005], [0.04, 0.01], [0, 0.012]], 32), mat.brassBright);
  bob.rotation.x = Math.PI / 2; bob.position.y = -0.82; pend.add(bob);
  pend.userData.dynamic = true;
  g.add(pend);
  g.userData.pendulum = pend;
  y = ty0 + trunkH;
  // ---- hood
  y = steps(y, [[0.44, 0.02, 0.06], [0.5, 0.02, 0.04], [0.56, 0.03, 0.0]], 0.34);
  const hy0 = y, hoodH = 0.66;
  box(0.5, hoodH, 0.3, 0, hy0 + hoodH / 2, 0.15, wood, 0.003);
  // dial (segmental arch top) behind a glazed hood door
  const DW = 0.34, sc = DW / 512, ay = 192, k = 74.7, R = 266.7;
  const dial = new THREE.Shape();
  dial.moveTo(0, 0); dial.lineTo(512, 0); dial.lineTo(512, 704 - ay);
  const a0 = Math.atan2((704 - ay) - (704 - ay - k), 512 - 256), a1 = Math.PI - a0;
  dial.absarc(256, 704 - ay - k, R, a0, a1, false); dial.lineTo(0, 0);
  const dg = new THREE.ShapeGeometry(dial, 32);
  const duv = dg.attributes.uv, dp = dg.attributes.position;
  for (let i = 0; i < dp.count; i++) { duv.setXY(i, dp.getX(i) / 512, dp.getY(i) / 704); dp.setXYZ(i, (dp.getX(i) - 256) * sc, dp.getY(i) * sc, 0); }
  const dialMat = new THREE.MeshStandardMaterial({ map: archDialTexture(ctx), color: new THREE.Color(0.78, 0.76, 0.72), roughness: 0.55, metalness: 0, name: 'clockDial' });
  dialMat.map.colorSpace = THREE.SRGBColorSpace;
  const dialM = new THREE.Mesh(dg, dialMat); dialM.position.set(0, hy0 + 0.06, 0.302); g.add(dialM);
  // hood door frame: outer rect minus the dial opening (slightly smaller than the dial)
  const hd = new THREE.Shape();
  hd.moveTo(-0.215, 0); hd.lineTo(0.215, 0); hd.lineTo(0.215, hoodH - 0.03); hd.lineTo(-0.215, hoodH - 0.03); hd.lineTo(-0.215, 0);
  const dPts = dial.getPoints(40).map((q) => new THREE.Vector2((q.x - 256) * sc * 0.96, q.y * sc * 0.96 + 0.065));
  hd.holes.push(new THREE.Path(dPts.reverse()));
  const hdM = new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(hd, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 24 }), 1), wood);
  hdM.position.set(0, hy0 + 0.0, 0.302); g.add(hdM);
  const hbead = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(dPts.map((q) => V3(q.x, q.y + hy0, 0.325)), true), 160, 0.005, 8, true), mat.brass); g.add(hbead);
  const hglass = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(dPts), 24), clockGlass); hglass.position.set(0, hy0, 0.31); hglass.userData.noShadow = true; g.add(hglass);
  // turned free-standing hood columns with brass capitals
  for (const sx of [-1, 1]) {
    const col = new THREE.Mesh(G.latheFromProfile([[0.02, 0], [0.024, 0.015], [0.016, 0.03], [0.015, 0.1], [0.017, 0.3], [0.015, hoodH - 0.08], [0.017, hoodH - 0.06], [0, hoodH - 0.06]], 16), trim);
    col.position.set(sx * 0.255, hy0, 0.305); g.add(col);
    const cap = new THREE.Mesh(G.latheFromProfile([[0.016, 0], [0.026, 0.02], [0.03, 0.035], [0.03, 0.06], [0, 0.06]], 16), mat.brass); cap.position.set(sx * 0.255, hy0 + hoodH - 0.06, 0.305); g.add(cap);
    const base = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.028, 0], [0.028, 0.012], [0.02, 0.02], [0, 0.02]], 16), mat.brass); base.position.set(sx * 0.255, hy0 - 0.005, 0.305); g.add(base);
  }
  y = hy0 + hoodH;
  // cornice + fretted frieze
  box(0.56, 0.06, 0.32, 0, y + 0.03, 0.16, mat.black, 0.003);
  y = steps(y + 0.06, [[0.58, 0.02, 0.0], [0.62, 0.025, -0.01]], 0.34);
  // ---- swan-neck pediment: two S scrolls rising toward a central plinth, with rosettes
  const ped = new THREE.Shape();
  const pw = 0.31;
  ped.moveTo(-pw, 0); ped.lineTo(pw, 0); ped.lineTo(pw, 0.05);
  ped.bezierCurveTo(0.2, 0.06, 0.16, 0.22, 0.06, 0.22); ped.lineTo(0.06, 0.17); ped.bezierCurveTo(0.13, 0.17, 0.16, 0.04, 0.24, 0.04);
  ped.lineTo(-0.24, 0.04); ped.bezierCurveTo(-0.16, 0.04, -0.13, 0.17, -0.06, 0.17); ped.lineTo(-0.06, 0.22);
  ped.bezierCurveTo(-0.16, 0.22, -0.2, 0.06, -pw, 0.05); ped.lineTo(-pw, 0);
  const pedGeo = G.applyBoxUVs(new THREE.ExtrudeGeometry(ped, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 3, curveSegments: 20 }), 1);
  const pedM = new THREE.Mesh(pedGeo, wood); pedM.position.set(0, y, 0.27); g.add(pedM);
  box(0.6, 0.05, 0.28, 0, y + 0.025, 0.14, wood, 0.004);
  for (const sx of [-1, 1]) {
    const ros = new THREE.Mesh(G.latheFromProfile([[0, 0.016], [0.012, 0.014], [0.022, 0.008], [0.026, 0], [0, 0]], 16), mat.brass);
    ros.rotation.x = Math.PI / 2; ros.position.set(sx * 0.07, y + 0.195, 0.33); g.add(ros);
  }
  // central plinth + finials (urn and flame)
  box(0.08, 0.1, 0.08, 0, y + 0.05 + 0.02, 0.29, wood, 0.003);
  const finial = G.latheFromProfile([[0, 0], [0.028, 0], [0.03, 0.012], [0.016, 0.022], [0.034, 0.05], [0.036, 0.07], [0.022, 0.09], [0.012, 0.1], [0.018, 0.115], [0.01, 0.14], [0.004, 0.17], [0, 0.18]], 18);
  for (const [x, yy, z] of [[0, y + 0.12, 0.29], [-0.27, y + 0.05, 0.27], [0.27, y + 0.05, 0.27]]) { const f = new THREE.Mesh(finial, mat.brass); f.position.set(x, yy, z); g.add(f); }
  return g;
}

/** Demilune console with a pair of candlesticks. Facing +Z, origin at the wall/floor. Returns { group, candles }. */
export function makeConsole(ctx, mat) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'console';
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.035, 48, 1, false, -Math.PI / 2, Math.PI), mat.marble);
  top.position.set(0, 0.84, 0.0); g.add(top);
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.11, 48, 1, true, -Math.PI / 2, Math.PI), mat.mahogany);
  apron.position.set(0, 0.765, 0); apron.material = mat.mahogany; g.add(apron);
  const apronGilt = new THREE.Mesh(new THREE.CylinderGeometry(0.465, 0.465, 0.025, 48, 1, true, -Math.PI / 2, Math.PI), mat.giltCap);
  apronGilt.position.set(0, 0.79, 0); g.add(apronGilt);
  for (const a of [-1.2, -0.4, 0.4, 1.2]) {
    const leg = new THREE.Mesh(G.latheFromProfile([[0.008, 0], [0.014, 0.02], [0.012, 0.06], [0.018, 0.3], [0.024, 0.55], [0.02, 0.66], [0.03, 0.7], [0.0, 0.71]], 12), mat.mahogany);
    leg.position.set(Math.sin(a) * 0.42, 0, Math.cos(a) * 0.42 * 0.98); g.add(leg);
  }
  const stretcher = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.01, 6, 32, Math.PI), mat.mahogany);
  stretcher.rotation.x = -Math.PI / 2; stretcher.rotation.z = -Math.PI / 2; stretcher.position.y = 0.18; g.add(stretcher);
  const candles = [];
  for (const s of [-1, 1]) {
    const stick = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.055, 0], [0.05, 0.012], [0.02, 0.03], [0.014, 0.08], [0.024, 0.1], [0.012, 0.16], [0.012, 0.22], [0.024, 0.235], [0.018, 0.25], [0, 0.25]], 24), mat.brass);
    stick.position.set(s * 0.28, 0.857, 0.16); g.add(stick);
    const c = ctx.fx.candle({ height: 0.17 - (s > 0 ? 0.05 : 0), radius: 0.011, light: false, seed: 20 + s, burn: 0.8 });
    c.position.set(s * 0.28, 0.857 + 0.245, 0.16); g.add(c);
    candles.push(c);
  }
  // a blue-and-white jar with dried roses
  const jar = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0], [0.085, 0.06], [0.09, 0.12], [0.07, 0.2], [0.04, 0.23], [0.045, 0.25], [0.0, 0.25]], 32), mat.porcelainBlue);
  jar.position.set(0, 0.857, 0.12); g.add(jar);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, r = 0.03 + (i % 3) * 0.015;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.003, 0.32, 4), mat.stem);
    stem.position.set(Math.cos(a) * r, 1.22, 0.12 + Math.sin(a) * r); stem.rotation.set(Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25); g.add(stem);
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 1), mat.rose);
    bloom.position.set(Math.cos(a) * r * 2.4, 1.37 + (i % 2) * 0.03, 0.12 + Math.sin(a) * r * 2.4); g.add(bloom);
  }
  return { group: g, candles };
}

/** Upholstered hall bench, facing +Z, origin at the wall/floor. */
export function makeBench(ctx, mat) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'bench';
  const seat = new THREE.Mesh(new G.RoundedBoxGeometry(1.3, 0.12, 0.44, 4, 0.04), mat.velvetSeat);
  seat.position.set(0, 0.5, 0.3); g.add(seat);
  const rail = new THREE.Mesh(new G.RoundedBoxGeometry(1.34, 0.08, 0.46, 2, 0.012), mat.mahogany);
  rail.position.set(0, 0.42, 0.3); g.add(rail);
  for (const [x, z] of [[-0.6, 0.12], [0.6, 0.12], [-0.6, 0.48], [0.6, 0.48]]) {
    const leg = new THREE.Mesh(G.latheFromProfile([[0.024, 0], [0.018, 0.04], [0.026, 0.1], [0.02, 0.18], [0.03, 0.26], [0.022, 0.34], [0.03, 0.38], [0, 0.38]], 14), mat.mahogany);
    leg.position.set(x, 0, z); g.add(leg);
  }
  // buttons
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), mat.velvetSeat);
    b.position.set(-0.5 + i * 0.2, 0.562, 0.3 + (i % 2 ? 0.08 : -0.08)); g.add(b);
  }
  return g;
}

/** Brass plaque with an engraved title (canvas texture). Facing +Z. */
export function makePlaque(ctx, mat, text, w = 0.3, h = 0.07) {
  // engraved brass: letters cut into the plate and filled with black wax (albedo), the cuts and a
  // bevelled border carried as a normal map, the field brushed (roughness streaks), edges worn bright
  const lines = text.split('\n');
  const CW = 1024, CH = Math.round(1024 * h / w);
  const draw = (g, cw, ch, fillText) => {
    lines.forEach((ln, i) => {
      const n = lines.length, fs = Math.round(ch * (n > 1 ? (i === 0 ? 0.34 : 0.22) : 0.46));
      g.font = `${i === 0 ? '' : 'italic '}${fs}px "Cinzel", Georgia, serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const y = n > 1 ? ch * (i === 0 ? 0.4 : 0.73) : ch / 2 + 2;
      fillText(ln, cw / 2, y);
    });
  };
  const height = document.createElement('canvas'); height.width = CW; height.height = CH;
  {
    const g = height.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, CW, CH);
    // bevel: a ramp in from the edge, then a fine incised border line
    for (let k = 0; k < 14; k++) { const v = Math.round(130 + k * 9); g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 2; g.strokeRect(k, k, CW - 2 * k, CH - 2 * k); }
    g.strokeStyle = '#555'; g.lineWidth = 3; g.strokeRect(26, 26, CW - 52, CH - 52);
    g.fillStyle = '#404040';
    draw(g, CW, CH, (t, x, y) => g.fillText(t, x, y));
  }
  const hd = height.getContext('2d').getImageData(0, 0, CW, CH).data;
  const nrm = ctx.textures.canvas(`gallery:plaqueN:${text}`, CW, CH, (g, cw, ch) => {
    const img = g.createImageData(cw, ch);
    const H = (x, y) => hd[(Math.min(ch - 1, Math.max(0, y)) * cw + Math.min(cw - 1, Math.max(0, x))) * 4] / 255;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 2.2, dy = (H(x, y + 1) - H(x, y - 1)) * 2.2;
      const l = Math.hypot(dx, dy, 1), i = (y * cw + x) * 4;
      img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { tile: false, srgb: false });
  nrm.colorSpace = THREE.NoColorSpace;
  const tex = ctx.textures.canvas(`gallery:plaque2:${text}`, CW, CH, (g, cw, ch) => {
    const grd = g.createLinearGradient(0, 0, cw, ch);
    grd.addColorStop(0, '#9a7634'); grd.addColorStop(0.45, '#c8a256'); grd.addColorStop(1, '#86622a');
    g.fillStyle = grd; g.fillRect(0, 0, cw, ch);
    // tarnish blooms toward the corners
    let sd = 9; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 40; i++) { const x = rnd() * cw, y = rnd() * ch, r = 20 + rnd() * 90; const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, 'rgba(60,40,15,0.25)'); q.addColorStop(1, 'rgba(60,40,15,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    g.strokeStyle = '#2a1c0a'; g.lineWidth = 3; g.strokeRect(26, 26, cw - 52, ch - 52);
    g.fillStyle = '#120c06';
    draw(g, cw, ch, (t, x, y) => g.fillText(t, x, y));
  }, { tile: false });
  const rough = ctx.textures.canvas(`gallery:plaqueR:${text}`, CW, CH, (g, cw, ch) => {
    g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, cw, ch);
    // brushed: fine horizontal streaks
    let sd = 4; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 500; i++) { const y = rnd() * ch, v = 70 + rnd() * 50; g.strokeStyle = `rgba(${v},${v},${v},0.5)`; g.lineWidth = 1; g.beginPath(); g.moveTo(rnd() * cw * 0.3, y); g.lineTo(cw * (0.7 + rnd() * 0.3), y); g.stroke(); }
    g.fillStyle = '#e0e0e0';
    draw(g, cw, ch, (t, x, y) => g.fillText(t, x, y));
  }, { tile: false, srgb: false });
  rough.colorSpace = THREE.NoColorSpace;
  const m = new THREE.Mesh(new ctx.geometry.RoundedBoxGeometry(w, h, 0.006, 2, 0.002), new THREE.MeshPhysicalMaterial({ map: tex, normalMap: nrm, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: rough, metalness: 0.65, roughness: 0.5, envMapIntensity: 1.4, emissiveMap: tex, emissive: new THREE.Color(0.16, 0.13, 0.09), name: 'plaque' }));
  return m;
}

/** Hanging hexagonal gas lantern on a chain. Origin at the ceiling. Returns { group, glass, lightPos }. */
export function makeLantern(ctx, mat, drop = 0.95) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'lantern';
  const canopy = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.07, 0], [0.065, -0.015], [0.03, -0.04], [0.012, -0.06], [0, -0.065]], 24), mat.brass);
  g.add(canopy);
  // chain of alternating links
  const linkGeo = new THREE.TorusGeometry(0.012, 0.0028, 6, 12);
  const n = Math.floor((drop - 0.45) / 0.02);
  for (let i = 0; i < n; i++) {
    const l = new THREE.Mesh(linkGeo, mat.brass);
    l.position.y = -0.07 - i * 0.02; l.rotation.y = (i % 2) * Math.PI / 2; l.scale.set(1, 1.5, 1);
    g.add(l);
  }
  const y0 = -drop;                         // bottom of the lantern
  const body = new THREE.Group();
  body.position.y = y0;
  g.add(body);
  const hh = 0.34, r = 0.13;
  // crown, roof, smoke bell
  body.add(new THREE.Mesh(G.latheFromProfile([[0, hh + 0.13], [0.012, hh + 0.12], [0.02, hh + 0.09], [0.05, hh + 0.07], [0.1, hh + 0.04], [r + 0.025, hh + 0.01], [r + 0.025, hh - 0.005], [0, hh - 0.005]], 6), mat.brass));
  body.add(new THREE.Mesh(G.latheFromProfile([[0, -0.07], [0.02, -0.065], [0.05, -0.04], [r + 0.02, -0.01], [r + 0.02, 0.01], [0, 0.01]], 6), mat.brass));
  const fin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.018, 0.0], [0.012, -0.03], [0.004, -0.06], [0, -0.07]], 12), mat.brass); fin.position.y = -0.07; body.add(fin);
  // six corner posts + glass panes
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.97, r * 0.97, hh - 0.01, 6, 1, true), mat.lanternGlass);
  glass.position.y = hh / 2; glass.rotation.y = Math.PI / 6; glass.name = 'lanternGlass'; glass.userData.noShadow = true;
  body.add(glass);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, hh, 6), mat.brass);
    post.position.set(Math.cos(a) * r, hh / 2, Math.sin(a) * r); body.add(post);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.005, 6, 6), mat.brass); ring.rotation.x = Math.PI / 2; ring.position.y = hh * 0.55; body.add(ring);
  // gas mantle burner inside
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.08, 8), mat.brass); burner.position.y = 0.05; body.add(burner);
  const flame = ctx.fx.flame({ height: 0.07, width: 0.025, intensity: 8 });
  flame.position.y = 0.1; body.add(flame);
  return { group: g, glass, lightPos: new THREE.Vector3(0, y0 + 0.16, 0), flame };
}
