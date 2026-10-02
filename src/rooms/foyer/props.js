import * as THREE from 'three';

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
  const archProf = [[0, 0], [0.012, 0], [0.016, 0.01], [0.022, 0.02], [0.022, 0.05], [0.03, 0.06], [0.032, 0.09], [0.04, 0.11], [0.04, 0.13], [0.03, 0.14], [0, 0.14]].map(([x, y]) => V2(x, y * (cw / 0.14)));
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
export function buildColumn(ctx, { height, shaftMat, capMat, baseMat, radius = 0.16 }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'column';
  const plinthH = 0.18, baseH = 0.16, capH = 0.34;
  const plinth = new THREE.Mesh(new G.RoundedBoxGeometry(radius * 2.6, plinthH, radius * 2.6, 2, 0.01), baseMat); plinth.position.y = plinthH / 2; g.add(plinth);
  const base = new THREE.Mesh(G.latheFromProfile([[radius * 1.25, 0], [radius * 1.25, 0.03], [radius * 1.15, 0.05], [radius * 1.18, 0.07], [radius * 1.05, 0.1], [radius * 1.08, 0.12], [radius * 1.0, 0.15], [radius * 0.98, baseH]], 40), baseMat);
  base.position.y = plinthH; g.add(base);
  const shaftH = height - plinthH - baseH - capH;
  const prof = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; const ent = 1 - 0.12 * Math.pow(t, 1.6) + 0.02 * Math.sin(t * Math.PI); prof.push([radius * 0.98 * ent, t * shaftH]); }
  prof.unshift([0, 0]); prof.push([0, shaftH]);
  const shaft = new THREE.Mesh(G.latheFromProfile(prof, 48), shaftMat); shaft.position.y = plinthH + baseH; g.add(shaft);
  // capital: astragal + bell + abacus (gilt)
  const r2 = radius * 0.86;
  const cap = new THREE.Mesh(G.latheFromProfile([[r2, 0], [r2 * 1.08, 0.015], [r2 * 1.08, 0.03], [r2 * 1.0, 0.04], [r2 * 1.04, 0.1], [r2 * 1.16, 0.18], [r2 * 1.32, 0.25], [r2 * 1.45, 0.28], [0, 0.28]], 40), capMat);
  cap.position.y = height - capH; g.add(cap);
  // volute hint: four scroll rolls
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const vol = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.016, 8, 16), capMat);
    vol.position.set(Math.cos(a) * r2 * 1.32, height - capH + 0.2, Math.sin(a) * r2 * 1.32);
    vol.rotation.y = -a + Math.PI / 2;
    g.add(vol);
  }
  const abacus = new THREE.Mesh(new G.RoundedBoxGeometry(radius * 2.5, 0.06, radius * 2.5, 2, 0.008), capMat); abacus.position.y = height - 0.03; g.add(abacus);
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
export function spiderGeometry(G) {
  const parts = [];
  const abd = new THREE.SphereGeometry(0.032, 16, 12); abd.scale(1, 0.72, 1.25); abd.translate(0, 0.03, -0.035); parts.push(abd);
  const ceph = new THREE.SphereGeometry(0.02, 14, 10); ceph.scale(1, 0.7, 1.1); ceph.translate(0, 0.024, 0.012); parts.push(ceph);
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const a = (-0.9 + i * 0.55);
      const dir = new THREE.Vector3(Math.sin(a + Math.PI / 2) * side, 0, Math.cos(a + Math.PI / 2));
      const pts = [
        new THREE.Vector3(0, 0.026, 0.012),
        new THREE.Vector3(dir.x * 0.035, 0.05, 0.012 + dir.z * 0.035),
        new THREE.Vector3(dir.x * 0.065, 0.03, 0.012 + dir.z * 0.065),
        new THREE.Vector3(dir.x * 0.085, 0.0, 0.012 + dir.z * 0.085),
      ];
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.0032, 5, false));
    }
  }
  return G.mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
}
