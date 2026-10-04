import * as THREE from 'three';
import { sdfGeometry, sdEllipsoid, sdRoundCone, smin, smax } from '../../engine/lib/contrib/bedroom-sdf.js';

/**
 * Foyer furniture and architectural set pieces. Every builder returns a Group in
 * local space (origin on the floor, facing +Z = into the room) so the room can
 * place it on any wall with a single rotation.
 */

const V2 = (x, y) => new THREE.Vector2(x, y);

// -------------------------------------------------------------------- doorway
/**
 * A recessed doorway: jamb linings, panelled leaves (single or double), moulded
 * casing, an entablature head with a dentil-ish cornice, brass furniture.
 * opts: { w, h, double, arch (fanlight radius = w/2 above h), leafMat, caseMat, giltMat, brassMat, depth, ajar }
 */
export function buildDoorway(ctx, o) {
  const { geometry: G } = ctx;
  const { w, h, double = false, depth = 0.32, head = true, ajar = 0 } = o;
  const g = new THREE.Group();
  g.name = 'doorway';
  const lin = 0.05;
  // jamb linings (inside the wall thickness)
  const jambL = new THREE.Mesh(G.boxUV(lin, h, depth, 1), o.caseMat); jambL.position.set(-w / 2 - lin / 2, h / 2, -depth / 2); g.add(jambL);
  const jambR = jambL.clone(); jambR.position.x = w / 2 + lin / 2; g.add(jambR);
  if (!o.arch) { const jt = new THREE.Mesh(G.boxUV(w + lin * 2, lin, depth, 1), o.caseMat); jt.position.set(0, h + lin / 2, -depth / 2); g.add(jt); }
  // threshold
  const thr = new THREE.Mesh(G.boxUV(w + 0.1, 0.025, depth + 0.06, 1), o.thresholdMat || o.caseMat); thr.position.set(0, 0.0125, -depth / 2 + 0.03); g.add(thr);
  // leaves
  const leaves = double ? 2 : 1;
  const lw = w / leaves;
  const leafT = 0.055;
  const leafGroup = [];
  for (let i = 0; i < leaves; i++) {
    const leaf = new THREE.Group();
    const body = new THREE.Mesh(G.boxUV(lw - 0.006, h - 0.01, leafT, 1), o.leafMat);
    body.position.set(0, h / 2, 0); leaf.add(body);
    // panel layout: tall upper pair, small middle rail, lower pair
    const pw = lw * 0.36, cols = lw > 0.8 ? 2 : 1;
    const rows = [[h * 0.66, h * 0.44], [h * 0.2, h * 0.24]];
    for (const [cy, ph] of rows) {
      for (let c = 0; c < cols; c++) {
        const px = cols === 1 ? 0 : (c === 0 ? -1 : 1) * lw * 0.22;
        const pnl = new THREE.Mesh(G.raisedPanel(cols === 1 ? lw * 0.62 : pw, ph, { border: 0.045, bevel: 0.03, fieldDepth: 0.01 }), o.leafMat);
        pnl.position.set(px, cy, leafT / 2); leaf.add(pnl);
      }
    }
    // brass: knob + escutcheon on the meeting stile (or the latch side)
    const side = double ? (i === 0 ? 1 : -1) : 1;
    const esc = new THREE.Mesh(G.boxUV(0.05, 0.22, 0.008, 1), o.brassMat); esc.position.set(side * (lw / 2 - 0.07), 1.0, leafT / 2 + 0.004); leaf.add(esc);
    const knob = new THREE.Mesh(G.latheFromProfile([[0.0, 0], [0.012, 0], [0.012, 0.03], [0.03, 0.045], [0.034, 0.06], [0.028, 0.075], [0.0, 0.078]], 20), o.brassMat);
    knob.rotation.x = Math.PI / 2; knob.position.set(side * (lw / 2 - 0.07), 1.03, leafT / 2); leaf.add(knob);
    const key = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 10), o.ironMat || o.brassMat); key.rotation.x = Math.PI / 2; key.position.set(side * (lw / 2 - 0.07), 0.94, leafT / 2 + 0.01); leaf.add(key);
    // hinges
    for (const hy of [0.25, h - 0.3]) { const hg = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.12, 10), o.brassMat); hg.position.set(-side * (lw / 2 - 0.003), hy, leafT / 2); leaf.add(hg); }
    // pivot at the hinge edge for ajar
    const pivot = new THREE.Group();
    pivot.position.set(double ? (i === 0 ? -w / 2 : w / 2) : -w / 2, 0, -depth * 0.55);
    leaf.position.set(double ? (i === 0 ? lw / 2 : -lw / 2) : lw / 2, 0, 0);
    pivot.add(leaf);
    if (ajar) pivot.rotation.y = (double ? (i === 0 ? -1 : 1) : -1) * ajar;
    g.add(pivot);
    leafGroup.push(pivot);
  }
  // casing (moulded architrave) around the opening
  const cw = 0.14;
  // deep three-fascia architrave with a back-band: stands ~7 cm proud of the wall
  const archProf = [[0, 0], [0.014, 0], [0.018, 0.01], [0.026, 0.02], [0.026, 0.045], [0.036, 0.055], [0.038, 0.08], [0.05, 0.095], [0.052, 0.112], [0.068, 0.118], [0.072, 0.13], [0.06, 0.14], [0, 0.14]].map(([x, y]) => V2(x, y * (cw / 0.14)));
  let casePath;
  if (o.arch) {
    const r = w / 2 + 0.005;
    casePath = [new THREE.Vector3(-w / 2 - 0.005, 0, 0)];
    for (let i = 0; i <= 24; i++) { const a = Math.PI - (i / 24) * Math.PI; casePath.push(new THREE.Vector3(Math.cos(a) * r, h + Math.sin(a) * r, 0)); }
    casePath.push(new THREE.Vector3(w / 2 + 0.005, 0, 0));
  } else {
    casePath = [new THREE.Vector3(-w / 2 - 0.005, 0, 0), new THREE.Vector3(-w / 2 - 0.005, h + 0.005, 0), new THREE.Vector3(w / 2 + 0.005, h + 0.005, 0), new THREE.Vector3(w / 2 + 0.005, 0, 0)];
  }
  // profile local: x = out of wall (+z), y = outward from opening. sweepProfile with up=+Z: outward = cross(t, up)
  const casing = new THREE.Mesh(G.sweepProfile(archProf.map((p) => V2(-p.y, p.x)), casePath, { up: new THREE.Vector3(0, 0, 1), uvScale: 1 }), o.caseMat);
  casing.name = 'casing';
  g.add(casing);
  // plinth blocks
  for (const sx of [-1, 1]) { const pb = new THREE.Mesh(G.boxUV(cw + 0.03, 0.26, 0.055, 1), o.caseMat); pb.position.set(sx * (w / 2 + cw / 2 + 0.005), 0.13, 0.027); g.add(pb); }
  // entablature head over rectangular doors: frieze + cornice
  if (head && !o.arch) {
    const hw = w + cw * 2 + 0.16;
    const fr = new THREE.Mesh(G.boxUV(hw - 0.08, 0.2, 0.05, 1), o.friezeMat || o.caseMat);
    fr.position.set(0, h + cw + 0.1, 0.025); g.add(fr);
    const corniceProf = [[0, 0], [0.02, 0], [0.025, 0.012], [0.05, 0.03], [0.075, 0.06], [0.09, 0.075], [0.095, 0.09], [0.1, 0.1], [0, 0.1]].map(([x, y]) => V2(x, y));
    const corn = new THREE.Mesh(G.sweepProfile(corniceProf, [new THREE.Vector3(-hw / 2 - 0.1, 0, 0), new THREE.Vector3(hw / 2 + 0.1, 0, 0)], { uvScale: 2 }), o.giltMat);
    // the sweep runs along +x so the profile faces +z; lift into place
    corn.position.set(0, h + cw + 0.2, 0.0);
    g.add(corn);
    const capB = new THREE.Mesh(G.boxUV(hw + 0.2, 0.03, 0.13, 1), o.caseMat); capB.position.set(0, h + cw + 0.315, 0.065); g.add(capB);
    // scrolled consoles carrying the cornice
    for (const sx of [-1, 1]) {
      const cs = new THREE.Shape();
      cs.moveTo(0, 0); cs.lineTo(0.09, 0); cs.bezierCurveTo(0.09, -0.06, 0.03, -0.08, 0.04, -0.15); cs.bezierCurveTo(0.05, -0.2, 0.02, -0.26, 0, -0.26); cs.lineTo(0, 0);
      const cg = G.applyBoxUVs(new THREE.ExtrudeGeometry(cs, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 10 }), 1);
      cg.rotateY(-Math.PI / 2); cg.translate(0.035, 0, 0);
      const cm = new THREE.Mesh(cg, o.caseMat); cm.position.set(sx * (w / 2 + cw / 2 + 0.005), h + cw + 0.2, 0.0); g.add(cm);
    }
    // pediment: open segmental (double doors) or triangular, walnut with a gilt-edged tympanum
    if (o.pediment) {
      const pw = hw + 0.16, top = h + cw + 0.33;
      const rise = o.pediment === 'segment' ? 0.32 : 0.42;
      const outer = new THREE.Shape(), inner = new THREE.Path();
      if (o.pediment === 'segment') {
        const R = (pw * pw / 4 + rise * rise) / (2 * rise), cy = rise - R, a0 = Math.asin((pw / 2) / R);
        outer.moveTo(-pw / 2, 0); outer.absarc(0, cy, R, Math.PI / 2 + a0, Math.PI / 2 - a0, true); outer.lineTo(pw / 2, 0); outer.lineTo(-pw / 2, 0);
        const Ri = R - 0.09; const ai = Math.asin(Math.min(0.99, (pw / 2 - 0.12) / Ri));
        inner.moveTo(-(pw / 2 - 0.12), 0.07); inner.absarc(0, cy, Ri, Math.PI / 2 + ai, Math.PI / 2 - ai, true); inner.lineTo(pw / 2 - 0.12, 0.07); inner.lineTo(-(pw / 2 - 0.12), 0.07);
      } else {
        outer.moveTo(-pw / 2, 0); outer.lineTo(0, rise); outer.lineTo(pw / 2, 0); outer.lineTo(-pw / 2, 0);
        const k = 0.11; inner.moveTo(-pw / 2 + k * 2.4, 0.06); inner.lineTo(0, rise - k * 1.2); inner.lineTo(pw / 2 - k * 2.4, 0.06); inner.lineTo(-pw / 2 + k * 2.4, 0.06);
      }
      const frameShape = outer.clone(); frameShape.holes.push(inner);
      const pg = G.applyBoxUVs(new THREE.ExtrudeGeometry(frameShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 24 }), 1);
      const pm = new THREE.Mesh(pg, o.caseMat); pm.position.set(0, top, 0.0); g.add(pm);
      const tymp = new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(new THREE.Shape(inner.getPoints(24)), { depth: 0.03, bevelEnabled: false }), 1), o.friezeMat || o.caseMat);
      tymp.position.set(0, top, 0.0); g.add(tymp);
      // gilt cartouche at the centre
      if (!o.noCartouche) { const cart = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 12), o.giltMat); cart.scale.set(1, 1.25, 0.35); cart.position.set(0, top + rise * 0.42, 0.045); g.add(cart); }
    }
  }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.userData.leaves = leafGroup;
  return g;
}

// -------------------------------------------------------------------- grandfather clock
export function buildClock(ctx, { case: wood, dark, brass, gilt, glass, dial, iron }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'grandfatherClock';
  const RB = (w, h, d, r = 0.008) => new G.RoundedBoxGeometry(w, h, d, 2, r);
  const box = (w, h, d, x, y, z, m = wood, r) => { const b = new THREE.Mesh(r ? RB(w, h, d, r) : G.boxUV(w, h, d, 1), m); b.position.set(x, y, z); g.add(b); return b; };
  // plinth with bracket feet
  box(0.58, 0.07, 0.34, 0, 0.1, 0, wood, 0.01);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const foot = new THREE.Mesh(G.latheFromProfile([[0.0, 0], [0.04, 0], [0.05, 0.03], [0.035, 0.06], [0.045, 0.075], [0.0, 0.075]], 12), wood);
    foot.position.set(sx * 0.24, 0, sz * 0.12); g.add(foot);
  }
  box(0.54, 0.38, 0.31, 0, 0.32, 0, wood, 0.006);
  const basePanel = new THREE.Mesh(G.raisedPanel(0.38, 0.26, { border: 0.035, bevel: 0.02, fieldDepth: 0.008 }), wood); basePanel.position.set(0, 0.32, 0.155); g.add(basePanel);
  box(0.58, 0.04, 0.34, 0, 0.53, 0, wood, 0.01);
  // trunk
  box(0.44, 1.02, 0.25, 0, 1.06, 0, wood, 0.006);
  // trunk door with glazed lenticle showing the pendulum
  const doorF = new THREE.Mesh(G.frameGeometry(0.2, 0.62, { width: 0.06, depth: 0.025, uvScale: 1 }), wood); doorF.position.set(0, 1.08, 0.126); g.add(doorF);
  const back = box(0.2, 0.62, 0.01, 0, 1.08, 0.09, dark);
  void back;
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.62), glass); lens.position.set(0, 1.08, 0.13); lens.castShadow = false; g.add(lens);
  // quarter columns on the trunk corners
  for (const sx of [-1, 1]) {
    const col = new THREE.Mesh(G.latheFromProfile([[0.0, 0], [0.022, 0], [0.022, 0.02], [0.016, 0.03], [0.016, 0.9], [0.022, 0.91], [0.022, 0.94], [0.0, 0.94]], 12), wood);
    col.position.set(sx * 0.2, 0.58, 0.115); g.add(col);
    for (const y of [0.6, 1.5]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 12), brass); cap.position.set(sx * 0.2, y, 0.115); g.add(cap); }
  }
  // pendulum (animated)
  const pend = new THREE.Group();
  pend.position.set(0, 1.62, 0.1);
  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.62, 0.004), brass); rod.position.y = -0.31; pend.add(rod);
  const bob = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0.004], [0.065, 0.012], [0.06, 0.02], [0, 0.024]], 32), brass);
  bob.rotation.x = Math.PI / 2; bob.position.set(0, -0.62, -0.012); pend.add(bob);
  g.add(pend);
  // waist moulding
  box(0.5, 0.04, 0.29, 0, 1.585, 0, wood, 0.01);
  // hood
  box(0.54, 0.62, 0.3, 0, 1.93, 0, wood, 0.008);
  // dial: square + arch, the arch carries the moon
  const dw = 0.34;
  const dShape = new THREE.Shape();
  dShape.moveTo(-dw / 2, 0); dShape.lineTo(dw / 2, 0); dShape.lineTo(dw / 2, dw); dShape.absarc(0, dw, dw / 2, 0, Math.PI, false); dShape.lineTo(-dw / 2, 0);
  const dGeo = new THREE.ShapeGeometry(dShape, 24);
  { // UVs: map the bounding box (w x 1.5w) to 0..1
    const p = dGeo.attributes.position, uv = dGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + dw / 2) / dw, 1 - p.getY(i) / (dw * 1.5));
  }
  const dialMat = new THREE.MeshStandardMaterial({ map: dial, roughness: 0.45, metalness: 0.35 });
  const dialMesh = new THREE.Mesh(dGeo, dialMat); dialMesh.position.set(0, 1.66, 0.153); g.add(dialMesh);
  // dial surround (gilt arched bezel)
  const bez = [];
  bez.push(new THREE.Vector3(-dw / 2 - 0.004, 0, 0));
  bez.push(new THREE.Vector3(-dw / 2 - 0.004, dw, 0));
  for (let i = 1; i < 16; i++) { const a = Math.PI - (i / 16) * Math.PI; bez.push(new THREE.Vector3(Math.cos(a) * (dw / 2 + 0.004), dw + Math.sin(a) * (dw / 2 + 0.004), 0)); }
  bez.push(new THREE.Vector3(dw / 2 + 0.004, dw, 0));
  bez.push(new THREE.Vector3(dw / 2 + 0.004, 0, 0));
  const bezProf = [[0, 0], [0.006, 0], [0.012, 0.008], [0.012, 0.02], [0, 0.026]].map(([x, y]) => V2(-y, x));
  const bezel = new THREE.Mesh(G.sweepProfile(bezProf, bez, { closed: true, up: new THREE.Vector3(0, 0, 1), uvScale: 2 }), gilt);
  bezel.position.set(0, 1.66, 0.152); g.add(bezel);
  // hands
  const handMat = iron;
  const mkHand = (len, wid) => {
    const s = new THREE.Shape();
    s.moveTo(-wid * 0.25, -len * 0.18); s.lineTo(wid * 0.25, -len * 0.18); s.lineTo(wid * 0.35, len * 0.55); s.lineTo(wid, len * 0.68); s.lineTo(0, len); s.lineTo(-wid, len * 0.68); s.lineTo(-wid * 0.35, len * 0.55); s.lineTo(-wid * 0.25, -len * 0.18);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: false }), handMat);
    return m;
  };
  const hourHand = mkHand(0.085, 0.012), minuteHand = mkHand(0.135, 0.008);
  const hub = new THREE.Vector3(0, 1.66 + dw / 2, 0.158);
  hourHand.position.copy(hub); minuteHand.position.copy(hub).add(new THREE.Vector3(0, 0, 0.003));
  g.add(hourHand, minuteHand);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.012, 12), brass); pin.rotation.x = Math.PI / 2; pin.position.copy(hub).add(new THREE.Vector3(0, 0, 0.004)); g.add(pin);
  // hood columns
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.022, 0], [0.022, 0.02], [0.015, 0.035], [0.015, 0.47], [0.022, 0.49], [0.024, 0.52], [0, 0.52]], 14), dark);
    c.position.set(sx * 0.235, 1.64, 0.14); g.add(c);
    for (const y of [1.645, 2.15]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.018, 14), brass); r.position.set(sx * 0.235, y, 0.14); g.add(r); }
  }
  // cornice + swan-neck pediment
  box(0.6, 0.05, 0.34, 0, 2.265, 0.0, wood, 0.01);
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector3(sx * (0.28 - t * 0.22), 2.29 + Math.sin(t * Math.PI * 0.8) * 0.17 + t * 0.03, 0.15)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.022, 8, false), wood));
    const ros = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), gilt);
    ros.rotation.x = Math.PI / 2; ros.position.set(sx * 0.06, 2.47, 0.16); g.add(ros);
    const fin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.025, 0], [0.025, 0.02], [0.012, 0.03], [0.03, 0.06], [0.03, 0.08], [0.012, 0.11], [0.004, 0.16], [0, 0.17]], 14), brass);
    fin.position.set(sx * 0.27, 2.29, 0.12); g.add(fin);
  }
  // tympanum board behind the pediment
  const tymp = new THREE.Shape();
  tymp.moveTo(-0.28, 0); tymp.lineTo(0.28, 0); tymp.lineTo(0.28, 0.06); tymp.quadraticCurveTo(0.12, 0.26, 0.04, 0.2); tymp.lineTo(-0.04, 0.2); tymp.quadraticCurveTo(-0.12, 0.26, -0.28, 0.06); tymp.lineTo(-0.28, 0);
  const tm = new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(tymp, { depth: 0.03, bevelEnabled: false }), 1), wood); tm.position.set(0, 2.29, 0.11); g.add(tm);
  const cfin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.03, 0], [0.03, 0.02], [0.018, 0.03], [0.04, 0.08], [0.035, 0.11], [0.012, 0.14], [0.005, 0.22], [0, 0.23]], 16), brass);
  cfin.position.set(0, 2.47, 0.12); g.add(cfin);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.userData = { pendulum: pend, hourHand, minuteHand, dial: dialMesh };
  return g;
}

// -------------------------------------------------------------------- gas sconce
export function buildSconce(ctx, { brass, shadeMat, arms = 2 }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'sconce';
  const plate = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.075, 0], [0.07, 0.015], [0.05, 0.03], [0.02, 0.04], [0, 0.045]], 24), brass);
  plate.rotation.x = Math.PI / 2; plate.scale.set(1, 1, 1.6); g.add(plate);
  const shades = [];
  for (let i = 0; i < arms; i++) {
    const sx = arms === 1 ? 0 : (i === 0 ? -1 : 1);
    const pts = [new THREE.Vector3(0, 0, 0.03), new THREE.Vector3(sx * 0.05, -0.06, 0.12), new THREE.Vector3(sx * 0.15, -0.02, 0.2), new THREE.Vector3(sx * 0.18, 0.08, 0.2)];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.009, 6, false), brass));
    const tip = pts[3];
    const cup = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.025, 0], [0.035, 0.02], [0.03, 0.03], [0, 0.03]], 16), brass); cup.position.copy(tip); g.add(cup);
    // tulip shade of etched glass
    const shade = new THREE.Mesh(G.latheFromProfile([[0.022, 0], [0.04, 0.02], [0.055, 0.06], [0.058, 0.1], [0.05, 0.13], [0.054, 0.14], [0.05, 0.145]], 20), shadeMat);
    shade.position.copy(tip).add(new THREE.Vector3(0, 0.03, 0)); g.add(shade);
    shade.castShadow = false;
    shades.push(shade.position.clone().add(new THREE.Vector3(0, 0.06, 0)));
  }
  const finial = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0], [0.018, 0.03], [0.008, 0.07], [0, 0.08]], 12), brass);
  finial.rotation.x = Math.PI; finial.position.set(0, -0.04, 0.03); g.add(finial);
  g.userData.shades = shades;
  return g;
}

// -------------------------------------------------------------------- column
/** fluted shaft with entasis: 24 concave flutes separated by fillets, stopping short of both ends */
function flutedShaft(height, radius, { flutes = 24, depth = 0.11, radial = 144, rows = 40 } = {}) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const y = t * height;
    const ent = 1 - 0.13 * Math.pow(t, 1.5) + 0.025 * Math.sin(t * Math.PI);
    const R = radius * ent;
    const endFade = Math.min(1, Math.min(t / 0.05, (1 - t) / 0.04));
    const fade = Math.max(0, Math.min(1, endFade)) ** 0.5;
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      const ph = ((a / (Math.PI * 2)) * flutes) % 1;
      const d = Math.abs(ph - 0.5) / 0.4;
      const flute = d < 1 ? Math.sqrt(1 - d * d) : 0;
      const r = R * (1 - depth * flute * fade);
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uv.push((i / radial) * Math.PI * 2 * radius, y);
    }
  }
  const w = radial + 1;
  for (let j = 0; j < rows; j++) for (let i = 0; i < radial; i++) {
    const a = j * w + i, b = a + 1, c = a + w, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** an acanthus leaf: a tapered, cupped strip that bows out and curls over at the tip (local: +z out, +y up) */
function acanthusLeaf(w, h, curl = 0.6) {
  const g = new THREE.PlaneGeometry(1, 1, 6, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = p.getY(i) + 0.5;               // u -0.5..0.5, v 0..1
    const width = Math.pow(Math.sin(Math.PI * Math.min(1, v * 0.9 + 0.08)), 0.7) * (1 - 0.35 * v);
    const lobes = 1 + 0.18 * Math.sin(v * Math.PI * 7) * (1 - v);
    const x = u * w * width * lobes;
    const out = Math.sin(v * Math.PI * 0.5) * h * 0.22 + Math.max(0, v - 0.7) ** 2 * h * curl * 2.2;
    const y = v * h - Math.max(0, v - 0.75) ** 2 * h * curl * 1.6;
    const cup = -Math.abs(u) * w * 0.25 * width;
    p.setXYZ(i, x, y, out + cup);
  }
  g.computeVertexNormals();
  return g;
}

export function buildColumn(ctx, { height, shaftMat, capMat, baseMat, radius = 0.25 }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'column';
  const R = radius;
  const plinthH = 0.26, baseH = 0.2, capH = 0.62;
  // square plinth with a moulded cap
  const plinth = new THREE.Mesh(new G.RoundedBoxGeometry(R * 2.75, plinthH, R * 2.75, 2, 0.012), baseMat); plinth.position.y = plinthH / 2; g.add(plinth);
  const pcap = new THREE.Mesh(new G.RoundedBoxGeometry(R * 2.85, 0.035, R * 2.85, 2, 0.01), baseMat); pcap.position.y = plinthH - 0.01; g.add(pcap);
  // Attic base: lower torus, scotia between fillets, upper torus, apophyge into the shaft
  const base = G.latheFromProfile([
    [R * 1.3, 0], [R * 1.36, 0.02], [R * 1.38, 0.045], [R * 1.33, 0.07], [R * 1.22, 0.08], [R * 1.2, 0.085], [R * 1.1, 0.1], [R * 1.07, 0.115],
    [R * 1.12, 0.125], [R * 1.16, 0.14], [R * 1.14, 0.16], [R * 1.07, 0.172], [R * 1.03, 0.18], [R * 1.0, baseH],
  ], 64);
  const bm = new THREE.Mesh(base, baseMat); bm.position.y = plinthH; g.add(bm);
  const shaftH = height - plinthH - baseH - capH;
  const shaft = new THREE.Mesh(flutedShaft(shaftH, R), shaftMat); shaft.position.y = plinthH + baseH; g.add(shaft);
  // Corinthian capital: astragal, bell with two rows of acanthus, corner volutes, concave abacus
  const r2 = R * 0.87;
  const y0 = height - capH;
  const astr = new THREE.Mesh(new THREE.TorusGeometry(r2 * 1.04, 0.018, 10, 48), capMat); astr.rotation.x = Math.PI / 2; astr.position.y = y0 + 0.01; g.add(astr);
  const bell = G.latheFromProfile([[r2, 0], [r2 * 1.0, 0.03], [r2 * 1.02, 0.2], [r2 * 1.1, 0.36], [r2 * 1.24, 0.48], [r2 * 1.32, 0.52], [0, 0.52]], 48);
  const bellM = new THREE.Mesh(bell, capMat); bellM.position.y = y0 + 0.03; g.add(bellM);
  const leafGeos = [];
  const lower = acanthusLeaf(R * 0.75, capH * 0.42, 0.5), upper = acanthusLeaf(R * 0.8, capH * 0.62, 0.7);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const m1 = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeTranslation(0, y0 + 0.035, r2 * 0.98));
    leafGeos.push(lower.clone().applyMatrix4(m1));
    const a2 = a + Math.PI / 8;
    const m2 = new THREE.Matrix4().makeRotationY(a2).multiply(new THREE.Matrix4().makeTranslation(0, y0 + 0.1, r2 * 1.0));
    leafGeos.push(upper.clone().applyMatrix4(m2));
  }
  const leaves = new THREE.Mesh(G.mergeGeometries(leafGeos), capMat.clone());
  leaves.material.side = THREE.DoubleSide;
  g.add(leaves);
  // corner volutes (spiral tubes) under the abacus horns
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const pts = [];
    for (let k = 0; k <= 30; k++) { const t = k / 30; const ang = t * Math.PI * 3.2; const rr = 0.06 * (1 - t * 0.75); pts.push(new THREE.Vector3(0, -Math.cos(ang) * rr + 0.02, Math.sin(ang) * rr + 0.02)); }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.011, 6, false);
    const vol = new THREE.Mesh(tube, capMat);
    vol.position.set(Math.cos(a) * r2 * 1.34, height - 0.12, Math.sin(a) * r2 * 1.34);
    vol.rotation.y = -a + Math.PI / 2;
    g.add(vol);
  }
  // concave-sided abacus with a central fleuron per face
  const ab = new THREE.Shape();
  const A = R * 1.55, c = R * 0.28;
  ab.moveTo(-A, -A + c); ab.quadraticCurveTo(-A + c * 1.6, 0, -A, A - c); ab.lineTo(-A + c, A); ab.quadraticCurveTo(0, A - c * 1.6, A - c, A); ab.lineTo(A, A - c);
  ab.quadraticCurveTo(A - c * 1.6, 0, A, -A + c); ab.lineTo(A - c, -A); ab.quadraticCurveTo(0, -A + c * 1.6, -A + c, -A); ab.lineTo(-A, -A + c);
  const abg = new THREE.ExtrudeGeometry(ab, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 12 });
  abg.rotateX(-Math.PI / 2);
  G.applyBoxUVs(abg, 1);
  const abm = new THREE.Mesh(abg, capMat); abm.position.y = height - 0.078; g.add(abm);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), capMat);
    fl.scale.set(1, 1, 0.5); fl.position.set(Math.sin(a) * (A - c * 0.9), height - 0.04, Math.cos(a) * (A - c * 0.9)); g.add(fl);
  }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

// -------------------------------------------------------------------- console table
export function buildConsole(ctx, { wood, marble, gilt }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'console';
  const top = new THREE.Mesh(new G.RoundedBoxGeometry(1.3, 0.04, 0.46, 3, 0.012), marble); top.position.y = 0.86; g.add(top);
  const apron = new THREE.Mesh(new G.RoundedBoxGeometry(1.2, 0.13, 0.4, 2, 0.006), wood); apron.position.set(0, 0.775, -0.01); g.add(apron);
  const fr = new THREE.Mesh(G.boxUV(1.1, 0.06, 0.01, 1), gilt); fr.position.set(0, 0.775, 0.192); g.add(fr);
  // cabriole-ish legs (swept tubes)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pts = [new THREE.Vector3(0, 0.72, 0), new THREE.Vector3(sz * 0.04 * 0 + sx * 0.03, 0.5, sz * 0.04), new THREE.Vector3(0, 0.22, 0), new THREE.Vector3(sx * 0.03, 0.05, sz * 0.05)];
    const leg = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.026, 8, false), wood);
    leg.position.set(sx * 0.55, 0, sz * 0.16); g.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), gilt); foot.position.set(sx * 0.58, 0.03, sz * 0.21); g.add(foot);
  }
  const stretcher = new THREE.Mesh(G.boxUV(1.0, 0.03, 0.03, 1), wood); stretcher.position.set(0, 0.16, 0); g.add(stretcher);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

// -------------------------------------------------------------------- candelabrum
export function buildCandelabrum(ctx, { brass, arms = 3, candleOpts = {} }) {
  const { geometry: G, fx } = ctx;
  const g = new THREE.Group();
  const stem = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.085, 0], [0.08, 0.015], [0.04, 0.04], [0.03, 0.08], [0.045, 0.12], [0.02, 0.17], [0.016, 0.3], [0.03, 0.32], [0.02, 0.36], [0, 0.37]], 28), brass);
  g.add(stem);
  const candles = [];
  for (let i = 0; i < arms; i++) {
    const sx = arms === 1 ? 0 : -1 + (2 * i) / (arms - 1);
    let tipY = 0.37;
    if (sx !== 0) {
      const pts = [new THREE.Vector3(0, 0.27, 0), new THREE.Vector3(sx * 0.07, 0.25, 0), new THREE.Vector3(sx * 0.14, 0.29, 0), new THREE.Vector3(sx * 0.15, 0.33, 0)];
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.008, 6, false), brass));
      tipY = 0.33;
    }
    const cup = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.018, 0], [0.028, 0.02], [0.022, 0.03], [0, 0.03]], 16), brass);
    cup.position.set(sx * 0.15, tipY, 0); g.add(cup);
    const c = fx.candle({ height: 0.2, radius: 0.011, light: false, seed: 300 + i * 7, burn: 0.7, ...candleOpts });
    c.position.set(sx * 0.15, tipY + 0.028, 0); g.add(c);
    candles.push(c);
  }
  g.userData.candles = candles;
  return g;
}

// -------------------------------------------------------------------- spider (puzzle token)
/**
 * Black widow, sculpted as signed distance fields and polygonised once (Surface Nets):
 * a glossy globose abdomen on a thin pedicel (waist), a small separate cephalothorax with
 * chelicerae, and eight legs of four jointed segments each (coxa, femur arching high,
 * tibia/metatarsus sweeping down, a fine tarsus whose tip rests ON the floor), plus pedipalps.
 * Returns { body, legs, hourglass } geometries (local +z = forward, origin on the floor).
 */
export function spiderGeometry() {
  const ABD = { c: [0, 0.03, -0.035], r: [0.024, 0.0205, 0.029] };
  const CEP = { c: [0, 0.019, 0.011], r: [0.0115, 0.0072, 0.0138] };
  const body = (x, y, z) => {
    let d = sdEllipsoid(x - ABD.c[0], y - ABD.c[1], z - ABD.c[2], ...ABD.r);
    // spinnerets: a small blunt cone at the tail
    d = smin(d, sdRoundCone(x, y, z, [0, 0.022, -0.06], [0, 0.019, -0.066], 0.004, 0.0018), 0.003);
    // pedicel: the narrow waist joining abdomen and cephalothorax
    const ped = sdRoundCone(x, y, z, [0, 0.022, -0.01], [0, 0.02, 0.0], 0.0026, 0.0028);
    let c = sdEllipsoid(x - CEP.c[0], y - CEP.c[1], z - CEP.c[2], ...CEP.r);
    // fovea groove and a raised eye mound at the front of the carapace
    c = smax(c, -sdEllipsoid(x, y - 0.0262, z - 0.009, 0.0016, 0.0016, 0.004), 0.001);
    c = smin(c, sdEllipsoid(x, y - 0.0235, z - 0.021, 0.0042, 0.0025, 0.003), 0.0025);
    // chelicerae (fangs) hanging below the eyes
    for (const sx of [-1, 1]) c = smin(c, sdRoundCone(x, y, z, [sx * 0.0032, 0.0175, 0.022], [sx * 0.0026, 0.011, 0.026], 0.0027, 0.0012), 0.0015);
    return Math.min(d, smin(ped, c, 0.0018));
  };
  // legs: [x, y, z, r] chains, smooth-unioned with a hint of joint bulge
  const chains = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const az = [0.42, 1.08, 1.92, 2.6][i];           // I & II reach forward, III sideways, IV back
      const reach = [0.112, 0.082, 0.066, 0.098][i];   // leg I longest, then IV, II, III
      const lift = [0.036, 0.031, 0.026, 0.034][i];
      const dir = [Math.sin(az) * side, Math.cos(az)];
      const a = 0.85 * Math.atan2(dir[1], Math.abs(dir[0]));
      const rx = side * CEP.r[0] * 0.92 * Math.cos(a * 0.5), rz = CEP.c[2] + CEP.r[2] * 0.6 * Math.sin(a);
      const P = (t, y, r) => [rx + dir[0] * reach * t, y, rz + dir[1] * reach * t, r];
      chains.push([
        P(0.0, 0.017, 0.0032),     // coxa
        P(0.1, 0.022, 0.0031),     // trochanter
        P(0.4, lift, 0.0027),      // femur up to the knee (patella)
        P(0.47, lift - 0.001, 0.0025),
        P(0.78, lift * 0.42, 0.0019),  // tibia + metatarsus sweeping down
        P(0.93, 0.006, 0.0012),
        P(1.0, 0.0009, 0.0008),    // tarsus: the claw rests on the floor
      ]);
    }
    // pedipalps
    chains.push([[side * 0.004, 0.016, 0.022, 0.0016], [side * 0.008, 0.019, 0.03, 0.0014], [side * 0.009, 0.012, 0.037, 0.0011]]);
  }
  const boxes = chains.map((ch) => {
    const mn = [1, 1, 1], mx = [-1, -1, -1];
    for (const p of ch) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k] - p[3]); mx[k] = Math.max(mx[k], p[k] + p[3]); }
    return [mn, mx];
  });
  const legs = (x, y, z) => {
    let d = 1e9;
    for (let c = 0; c < chains.length; c++) {
      const [mn, mx] = boxes[c];
      const bx = Math.max(mn[0] - x, 0, x - mx[0]), by = Math.max(mn[1] - y, 0, y - mx[1]), bz = Math.max(mn[2] - z, 0, z - mx[2]);
      const lb = Math.hypot(bx, by, bz);
      if (lb > d || lb > 0.006) { d = Math.min(d, lb + 0.002); continue; }
      const ch = chains[c];
      for (let k = 0; k < ch.length - 1; k++) {
        const pa = ch[k], pb = ch[k + 1];
        d = smin(d, sdRoundCone(x, y, z, pa, pb, pa[3], pb[3]), 0.0006);
      }
      // joint knobs
      for (const k of [2, 4]) if (ch[k]) d = Math.min(d, Math.hypot(x - ch[k][0], y - ch[k][1], z - ch[k][2]) - ch[k][3] * 1.18);
    }
    return d;
  };
  const bodyGeo = sdfGeometry(body, { min: [-0.03, 0.004, -0.075], max: [0.03, 0.056, 0.036], step: 0.0011, ao: 0.006 });
  const legGeo = sdfGeometry(legs, { min: [-0.125, -0.001, -0.12], max: [0.125, 0.045, 0.135], step: 0.0009 });
  // a red hourglass painted on the dorsal abdomen, draped onto the sculpted surface
  const hg = new THREE.Shape();
  hg.moveTo(-0.0055, 0.008); hg.lineTo(0.0055, 0.008); hg.lineTo(0.0012, 0.0); hg.lineTo(0.0055, -0.008); hg.lineTo(-0.0055, -0.008); hg.lineTo(-0.0012, 0.0); hg.lineTo(-0.0055, 0.008);
  const hgGeo = new THREE.ShapeGeometry(hg, 4);
  hgGeo.rotateX(-Math.PI / 2);
  const pp = hgGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), z = pp.getZ(i) + ABD.c[2] - 0.004;
    const nx = x / ABD.r[0], nz = (z - ABD.c[2]) / ABD.r[2];
    const y = ABD.c[1] + ABD.r[1] * Math.sqrt(Math.max(0, 1 - nx * nx - nz * nz)) + 0.00045;
    pp.setXYZ(i, x, y, z);
  }
  hgGeo.computeVertexNormals();
  return { body: bodyGeo, legs: legGeo, hourglass: hgGeo };
}
