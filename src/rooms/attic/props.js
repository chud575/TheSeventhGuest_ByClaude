import * as THREE from 'three';

/**
 * Attic props, all modelled here: Stauf's workbench and the toys on it, the lab
 * table with the great brass microscope, a hanging oil lamp, steamer trunks, a
 * rocking horse, a dressmaker's dummy, dust-sheeted furniture, crates, a bird
 * cage, a marionette and a little model of the mansion itself.
 * Every builder returns a Group whose origin sits on the floor (or the surface it stands on).
 */

const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const mesh = (g, m) => new THREE.Mesh(g, m);

/** bevelled box (ExtrudeGeometry, box UVs in metres) */
export function bevelBox(G, w, h, d, bevel = 0.006) {
  const b = Math.min(bevel, w / 4, h / 4, d / 4);
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + b, -h / 2 + b); s.lineTo(w / 2 - b, -h / 2 + b); s.lineTo(w / 2 - b, h / 2 - b); s.lineTo(-w / 2 + b, h / 2 - b); s.lineTo(-w / 2 + b, -h / 2 + b);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return G.applyBoxUVs(g, 1);
}

/** rough timber with chamfered arrises */
export function beam(G, w, h, len, ch = 0.012) {
  return bevelBox(G, w, h, len, ch);
}

/** lathe helper taking [r, y] pairs */
const lathe = (G, pts, seg = 24) => G.latheFromProfile(pts, seg);

// ====================================================================== workbench
export function buildWorkbench(ctx, m, { w = 2.5, d = 0.72, h = 0.9 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'workbench';
  const top = 0.07;
  // top: two thick planks with a tool well between
  g.add(at(mesh(bevelBox(G, w, top, d * 0.62, 0.008), m.benchTop), 0, h - top / 2, d * 0.19));
  g.add(at(mesh(bevelBox(G, w, top * 0.6, d * 0.12, 0.004), m.benchTop), 0, h - top * 0.8, -d * 0.2));
  g.add(at(mesh(bevelBox(G, w, top, d * 0.24, 0.008), m.benchTop), 0, h - top / 2, -d * 0.38));
  // legs, aprons, stretchers
  const lw = 0.09;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(mesh(beam(G, lw, h - top, lw, 0.01), m.benchFrame), sx * (w / 2 - 0.12), (h - top) / 2, sz * (d / 2 - 0.07)));
  for (const sz of [-1, 1]) g.add(at(mesh(beam(G, w - 0.2, 0.12, 0.04, 0.006), m.benchFrame), 0, h - top - 0.06, sz * (d / 2 - 0.05)));
  for (const sx of [-1, 1]) g.add(at(mesh(beam(G, 0.06, 0.07, d - 0.1, 0.006), m.benchFrame), sx * (w / 2 - 0.12), 0.18, 0));
  g.add(at(mesh(beam(G, w - 0.22, 0.07, 0.06, 0.006), m.benchFrame), 0, 0.18, 0));
  // lower shelf boards (with a gap)
  for (let i = 0; i < 4; i++) g.add(at(mesh(bevelBox(G, w - 0.3, 0.022, d * 0.2, 0.003), m.benchFrame), 0, 0.225, -d * 0.33 + i * d * 0.22));
  // drawers under the front plank
  const nd = 3;
  for (let i = 0; i < nd; i++) {
    const x = -w / 2 + 0.35 + i * 0.42;
    g.add(at(mesh(bevelBox(G, 0.38, 0.1, 0.02, 0.004), m.benchFrame), x, h - top - 0.07, d / 2 - 0.02));
    const pull = mesh(new THREE.TorusGeometry(0.014, 0.0035, 6, 14, Math.PI), m.brass); pull.rotation.z = Math.PI; at(pull, x, h - top - 0.06, d / 2 + 0.002); g.add(pull);
  }
  // front vice: chop, screw and tommy bar
  const vx = w / 2 - 0.3;
  g.add(at(mesh(bevelBox(G, 0.32, 0.2, 0.06, 0.008), m.benchTop), vx, h - 0.1, d / 2 + 0.04));
  const screw = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 16), m.benchFrame); screw.rotation.x = Math.PI / 2; at(screw, vx, h - 0.11, d / 2 + 0.12); g.add(screw);
  const bar = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8), m.benchFrame); bar.rotation.z = 1.2; at(bar, vx, h - 0.11, d / 2 + 0.2); g.add(bar);
  for (const s of [-1, 1]) g.add(at(mesh(new THREE.SphereGeometry(0.014, 10, 8), m.benchFrame), vx + Math.cos(1.2 + Math.PI / 2) * 0.15 * s, h - 0.11 + Math.sin(1.2 + Math.PI / 2) * 0.15 * s, d / 2 + 0.2));
  // bench dogs and a wooden mallet / plane on top
  for (let i = 0; i < 4; i++) g.add(at(mesh(lathe(G, [[0, 0], [0.011, 0], [0.011, 0.004], [0.009, 0.006], [0, 0.006]], 12), m.brass), -w / 2 + 0.4 + i * 0.5, h, d * 0.4));
  // holdfast and a wooden smoothing plane
  g.add(at(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.06, 10), m.iron), w / 2 - 0.62, h + 0.03, d * 0.05));
  { const hf = mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 16, Math.PI * 0.55), m.iron); hf.rotation.set(0, 0, Math.PI * 0.2); at(hf, w / 2 - 0.62 + 0.0, h + 0.0, d * 0.05); g.add(hf); }
  return g;
}

/** tool rack: back board with hanging tools (saw, chisels, hammer, pliers, coil of wire) */
export function buildToolRack(ctx, m, { w = 1.4, h = 0.55 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'toolRack';
  for (let i = 0; i < 5; i++) g.add(at(mesh(bevelBox(G, w, h / 5 - 0.006, 0.02, 0.003), m.benchFrame), 0, h / 10 + (i * h) / 5, 0.0));
  g.add(at(mesh(beam(G, w + 0.06, 0.05, 0.05, 0.006), m.benchFrame), 0, h * 0.78, 0.03));
  // pegs
  const pegs = [];
  for (let i = 0; i < 9; i++) { const x = -w / 2 + 0.1 + i * ((w - 0.2) / 8); pegs.push(x); const p = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 6), m.benchFrame); p.rotation.x = Math.PI / 2; at(p, x, h * 0.78, 0.07); g.add(p); }
  // hand saw
  {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.42, 0.04); s.lineTo(0.42, 0.12); s.lineTo(0, 0.1); s.lineTo(0, 0);
    const blade = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: false }), m.steel); blade.rotation.z = -Math.PI / 2 - 0.05; at(blade, pegs[0] - 0.05, h * 0.78 - 0.06, 0.05); g.add(blade);
    g.add(at(mesh(bevelBox(G, 0.05, 0.12, 0.025, 0.008), m.handle), pegs[0], h * 0.78 - 0.02, 0.055));
  }
  // chisels
  for (let i = 0; i < 4; i++) {
    const x = pegs[2] + i * 0.045;
    g.add(at(mesh(lathe(G, [[0, 0], [0.011, 0.005], [0.012, 0.07], [0.008, 0.1], [0.004, 0.11], [0, 0.11]], 10), m.handle), x, h * 0.78 - 0.13, 0.06));
    g.add(at(mesh(new THREE.BoxGeometry(0.008 + i * 0.003, 0.12, 0.003), m.steel), x, h * 0.78 - 0.2, 0.06));
  }
  // claw hammer
  {
    const hm = new THREE.Group();
    hm.add(at(mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.3, 8), m.handle), 0, -0.15, 0));
    hm.add(at(mesh(bevelBox(G, 0.1, 0.025, 0.025, 0.004), m.iron), 0.0, 0.0, 0));
    at(hm, pegs[6], h * 0.78 - 0.02, 0.07); hm.rotation.z = 0.08; g.add(hm);
  }
  // coil of wire
  const coil = mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 24), m.iron); at(coil, pegs[8], h * 0.78 - 0.07, 0.06); g.add(coil);
  return g;
}

// ====================================================================== toys
/** tin soldier: turned body, busby, painted red coat */
export function soldierGeometry(G) {
  return {
    legs: lathe(G, [[0, 0], [0.012, 0], [0.012, 0.004], [0.008, 0.006], [0.008, 0.04], [0, 0.04]], 10),
    coat: lathe(G, [[0, 0.04], [0.011, 0.04], [0.012, 0.06], [0.01, 0.075], [0.006, 0.08], [0, 0.08]], 12),
    head: new THREE.SphereGeometry(0.0055, 10, 8).translate(0, 0.086, 0),
    busby: lathe(G, [[0, 0.089], [0.0065, 0.089], [0.0075, 0.1], [0.0065, 0.11], [0, 0.112]], 10),
  };
}
export function buildSoldiers(ctx, m, n = 6, seed = 1) {
  const { geometry: G } = ctx;
  const sg = soldierGeometry(G);
  const g = new THREE.Group(); g.name = 'soldiers';
  for (let i = 0; i < n; i++) {
    const s = new THREE.Group();
    s.add(mesh(sg.legs, m.toyBlack)); s.add(mesh(sg.coat, m.toyRed)); s.add(mesh(sg.head, m.porcelain)); s.add(mesh(sg.busby, m.toyBlack));
    const rifle = mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.07, 4), m.toyBlack); at(rifle, 0.012, 0.075, 0.004); s.add(rifle);
    const fallen = (i * 7 + seed) % 5 === 0;
    s.position.set((i % 3) * 0.035 + (fallen ? 0.02 : 0), 0, Math.floor(i / 3) * 0.04);
    if (fallen) { s.rotation.z = Math.PI / 2; s.position.y = 0.012; s.rotation.y = 0.6; }
    g.add(s);
  }
  return g;
}

/** spinning top with painted bands */
export function buildTop(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'top';
  const body = mesh(lathe(G, [[0, 0], [0.004, 0.004], [0.03, 0.03], [0.045, 0.05], [0.046, 0.058], [0.03, 0.068], [0.008, 0.072], [0.006, 0.1], [0, 0.104]], 32), m.topBands);
  g.add(body);
  g.rotation.z = 0.35; g.position.y = 0.012;
  return g;
}

/** toy drum with zig-zag cords */
export function buildDrum(ctx, m) {
  const g = new THREE.Group(); g.name = 'drum';
  const r = 0.07, h = 0.08;
  g.add(at(mesh(new THREE.CylinderGeometry(r, r, h, 28, 1, true), m.toyBlue), 0, h / 2, 0));
  for (const y of [0.006, h - 0.006]) g.add(at(mesh(new THREE.TorusGeometry(r + 0.002, 0.006, 6, 28), m.toyRed), 0, y, 0).rotateX(Math.PI / 2));
  g.add(at(mesh(new THREE.CircleGeometry(r, 28).rotateX(-Math.PI / 2), m.vellum), 0, h, 0));
  const pts = [];
  for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; const y = i % 2 ? 0.01 : h - 0.01; pts.push(V3(Math.cos(a) * (r + 0.004), y, Math.sin(a) * (r + 0.004))); }
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.0), 96, 0.0018, 4, true), m.toyWhite));
  for (const s of [-1, 1]) { const st = mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.13, 6), m.handle); st.rotation.z = Math.PI / 2 + s * 0.3; at(st, 0.03 * s, h + 0.01, 0.03); g.add(st); }
  return g;
}

/** set of alphabet blocks */
export function buildBlocks(ctx, m, list) {
  const g = new THREE.Group(); g.name = 'blocks';
  const s = 0.045;
  const geo = new ctx.geometry.RoundedBoxGeometry(s, s, s, 2, 0.004);
  for (const [x, y, z, ry, k] of list) {
    const b = mesh(geo, m.blocks[k % m.blocks.length]); at(b, x, y + s / 2, z); b.rotation.y = ry; g.add(b);
  }
  return g;
}

/** small inlaid puzzle box (Stauf sells toys and puzzles) */
export function buildPuzzleBox(ctx, m, s = 0.09) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'puzzleBox';
  g.add(at(mesh(bevelBox(G, s, s * 0.6, s, 0.003), m.inlay), 0, s * 0.3, 0));
  for (let i = 0; i < 3; i++) g.add(at(mesh(new THREE.BoxGeometry(s * 1.002, s * 0.05, s * 0.3), m.benchTop), 0, s * (0.12 + i * 0.16), (i - 1) * s * 0.2));
  return g;
}

// ====================================================================== lab
export function buildLabTable(ctx, m, { w = 1.55, d = 0.82, h = 0.86 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'labTable';
  // top with moulded edge
  g.add(at(mesh(bevelBox(G, w, 0.05, d, 0.012), m.labTop), 0, h - 0.025, 0));
  const edge = [V2(0, 0), V2(0.012, 0), V2(0.02, 0.008), V2(0.016, 0.02), V2(0.006, 0.028), V2(0, 0.028)];
  g.add(at(mesh(G.sweepProfile(edge, [V3(-w / 2, 0, d / 2), V3(w / 2, 0, d / 2), V3(w / 2, 0, -d / 2), V3(-w / 2, 0, -d / 2)].reverse(), { closed: true, uvScale: 2 }), m.labTop), 0, h - 0.078, 0));
  // apron
  for (const sz of [-1, 1]) g.add(at(mesh(bevelBox(G, w - 0.16, 0.12, 0.025, 0.004), m.labFrame), 0, h - 0.11, sz * (d / 2 - 0.06)));
  for (const sx of [-1, 1]) g.add(at(mesh(bevelBox(G, 0.025, 0.12, d - 0.16, 0.004), m.labFrame), sx * (w / 2 - 0.06), h - 0.11, 0));
  // turned legs
  const legG = lathe(G, [[0, 0], [0.028, 0], [0.032, 0.02], [0.026, 0.05], [0.022, 0.25], [0.034, 0.32], [0.036, 0.36], [0.026, 0.42], [0.03, 0.5], [0.036, 0.6], [0.038, h - 0.17], [0.04, h - 0.05], [0, h - 0.05]], 18);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(mesh(legG, m.labFrame), sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08)));
  // H-stretcher: turned side rails and a centre rail (open, so light falls through to the rug)
  const rail = lathe(G, [[0, 0], [0.014, 0], [0.016, 0.03], [0.012, 0.1], [0.016, 0.5], [0.012, 0.9], [0.016, 0.97], [0.014, 1], [0, 1]], 10);
  for (const sx of [-1, 1]) { const r = mesh(rail, m.labFrame); r.scale.set(1, d - 0.16, 1); r.rotation.x = Math.PI / 2; at(r, sx * (w / 2 - 0.08), 0.18, -(d - 0.16) / 2); g.add(r); }
  { const r = mesh(rail, m.labFrame); r.scale.set(1, w - 0.16, 1); r.rotation.z = -Math.PI / 2; at(r, -(w - 0.16) / 2, 0.18, 0); g.add(r); }
  return g;
}

/** large brass compound microscope on a horseshoe foot */
export function buildMicroscope(ctx, m, s = 1.6) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'microscope';
  // horseshoe foot
  const sh = new THREE.Shape();
  sh.absarc(0, 0, 0.06, -Math.PI * 0.8, Math.PI * 0.8, false);
  sh.absarc(0, 0, 0.025, Math.PI * 0.8, -Math.PI * 0.8, true);
  const foot = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 24 }), m.blackEnamel);
  foot.rotation.x = -Math.PI / 2; foot.position.y = 0.003; g.add(foot);
  g.add(at(mesh(lathe(G, [[0, 0], [0.016, 0], [0.012, 0.01], [0.01, 0.07], [0.016, 0.08], [0, 0.08]], 16), m.brass), 0, 0.015, 0));
  // trunnion + arm
  g.add(at(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 16).rotateX(Math.PI / 2), m.brass), 0, 0.1, 0));
  const arm = new THREE.Group(); arm.position.set(0, 0.1, 0); arm.rotation.z = 0.32; g.add(arm);
  const ap = new THREE.Shape(); ap.moveTo(-0.012, 0); ap.quadraticCurveTo(-0.03, 0.08, -0.01, 0.15); ap.lineTo(0.012, 0.15); ap.quadraticCurveTo(-0.004, 0.08, 0.012, 0); ap.lineTo(-0.012, 0);
  const armG = new THREE.ExtrudeGeometry(ap, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2 }); armG.translate(0, 0, -0.008);
  arm.add(mesh(armG, m.brass));
  // stage
  arm.add(at(mesh(bevelBox(G, 0.08, 0.006, 0.08, 0.002), m.blackEnamel), 0.035, 0.05, 0));
  arm.add(at(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 16), m.brass), 0.035, 0.035, 0));
  // mirror below
  const mir = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 20), m.mirror); at(mir, 0.035, 0.01, 0); mir.rotation.z = 0.6; arm.add(mir);
  // tube, focusing knobs, revolver, eyepiece
  const tube = new THREE.Group(); tube.position.set(0.035, 0.07, 0); arm.add(tube);
  tube.add(mesh(lathe(G, [[0, 0], [0.006, 0], [0.008, 0.006], [0.01, 0.012], [0.014, 0.016], [0.014, 0.022], [0.012, 0.026], [0.012, 0.15], [0.014, 0.155], [0.014, 0.17], [0.01, 0.175], [0.0095, 0.2], [0.012, 0.205], [0.012, 0.215], [0, 0.215]], 24), m.brass));
  tube.add(at(mesh(new THREE.CylinderGeometry(0.0045, 0.0055, 0.02, 12), m.brass), 0.012, -0.005, 0).rotateZ(0.25));
  tube.add(at(mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.018, 12), m.brass), -0.01, -0.004, 0.006).rotateZ(-0.25));
  for (const sz of [-1, 1]) {
    const k = mesh(lathe(G, [[0, 0], [0.016, 0], [0.017, 0.004], [0.017, 0.008], [0.012, 0.011], [0, 0.011]], 20), m.brass); k.rotation.x = sz * Math.PI / 2; at(k, -0.01, 0.12, sz * 0.012); tube.add(k);
  }
  g.add(at(mesh(new THREE.SphereGeometry(0.005, 8, 6), m.glass), 0, 0, 0)); // keep bucket small
  g.scale.setScalar(s);
  return g;
}

/** glassware: flasks, retort, test tube rack, bell jar */
export function buildGlassware(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'glassware';
  const flask = lathe(G, [[0.0, 0], [0.045, 0.0], [0.06, 0.03], [0.058, 0.06], [0.03, 0.11], [0.013, 0.14], [0.013, 0.19], [0.016, 0.195]], 24);
  const liq = lathe(G, [[0, 0.003], [0.043, 0.003], [0.056, 0.03], [0.054, 0.055], [0, 0.055]], 20);
  const round = lathe(G, [[0, 0], [0.03, 0.005], [0.05, 0.03], [0.055, 0.06], [0.045, 0.09], [0.014, 0.115], [0.012, 0.18], [0.015, 0.185]], 24);
  const rliq = lathe(G, [[0, 0.006], [0.03, 0.008], [0.048, 0.03], [0.052, 0.05], [0, 0.05]], 20);
  const f1 = new THREE.Group(); f1.add(mesh(flask, m.glass)); f1.add(mesh(liq, m.liquidGreen)); at(f1, 0, 0, 0); g.add(f1);
  const f2 = new THREE.Group(); f2.add(mesh(round, m.glass)); f2.add(mesh(rliq, m.liquidBlue)); at(f2, 0.14, 0, -0.05); g.add(f2);
  // round flask needs a ring stand
  g.add(at(mesh(new THREE.TorusGeometry(0.04, 0.003, 6, 20).rotateX(Math.PI / 2), m.iron), 0.14, 0.02, -0.05));
  // test tube rack
  const rack = new THREE.Group(); at(rack, -0.16, 0, 0.02); g.add(rack);
  rack.add(at(mesh(bevelBox(G, 0.2, 0.012, 0.05, 0.002), m.labFrame), 0, 0.006, 0));
  rack.add(at(mesh(bevelBox(G, 0.2, 0.012, 0.05, 0.002), m.labFrame), 0, 0.08, 0));
  for (const sx of [-1, 1]) rack.add(at(mesh(new THREE.BoxGeometry(0.01, 0.09, 0.05), m.labFrame), sx * 0.095, 0.045, 0));
  const tubeG = lathe(G, [[0, 0], [0.006, 0.002], [0.008, 0.008], [0.008, 0.13], [0.009, 0.132]], 12);
  const tliq = new THREE.CylinderGeometry(0.0072, 0.0072, 0.05, 10).translate(0, 0.03, 0);
  const tl = [m.liquidGreen, m.liquidRed, m.liquidBlue, m.liquidGreen, m.liquidAmber];
  for (let i = 0; i < 5; i++) { rack.add(at(mesh(tubeG, m.glass), -0.07 + i * 0.035, 0.02, 0)); rack.add(at(mesh(tliq, tl[i]), -0.07 + i * 0.035, 0.02, 0)); }
  return g;
}

/** bell jar over a small specimen (a pickled thing on a stand) */
export function buildBellJar(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'bellJar';
  g.add(mesh(lathe(G, [[0, 0], [0.1, 0], [0.105, 0.01], [0.1, 0.02], [0, 0.02]], 32), m.labFrame));
  g.add(at(mesh(lathe(G, [[0, 0], [0.025, 0], [0.012, 0.01], [0.008, 0.06], [0, 0.06]], 12), m.brass), 0, 0.02, 0));
  // the specimen: a little skull
  const sk = mesh(new THREE.SphereGeometry(0.03, 18, 14), m.bone); sk.scale.set(0.9, 1, 1.15); at(sk, 0, 0.11, 0); g.add(sk);
  const jaw = mesh(new THREE.SphereGeometry(0.02, 12, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.bone); at(jaw, 0, 0.09, 0.012); g.add(jaw);
  for (const s of [-1, 1]) g.add(at(mesh(new THREE.SphereGeometry(0.008, 8, 6), m.black), s * 0.011, 0.11, 0.028));
  const jar = mesh(lathe(G, [[0.088, 0.02], [0.09, 0.15], [0.085, 0.2], [0.07, 0.235], [0.04, 0.25], [0.012, 0.255], [0.014, 0.27], [0.022, 0.285], [0.0, 0.29]], 40), m.glass);
  g.add(jar);
  return g;
}

/** hanging oil lamp: chain, smoke bell, font with brass collar, glass chimney (flame added by caller) */
export function buildHangingLamp(ctx, m, { drop = 0.7 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'hangingLamp';
  // chain: alternating torus links
  const link = new THREE.TorusGeometry(0.012, 0.0025, 5, 10);
  const n = Math.floor(drop / 0.02);
  for (let i = 0; i < n; i++) { const l = mesh(link, m.iron); l.position.y = -i * 0.02; l.rotation.y = (i % 2) * Math.PI / 2; l.scale.y = 1.25; g.add(l); }
  const y0 = -drop;
  // smoke bell / reflector
  // a coolie shade of pressed tin: a shallow cone with a rolled rim, knocked about (dents, a bent edge)
  {
    const sg = lathe(G, [[0.012, 0.05], [0.022, 0.048], [0.03, 0.04], [0.09, 0.0], [0.15, -0.04], [0.165, -0.05], [0.17, -0.056], [0.166, -0.062], [0.158, -0.058]], 64);
    const pp = sg.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i); const a = Math.atan2(z, x); const r = Math.hypot(x, z);
      const k = THREE.MathUtils.smoothstep(r, 0.05, 0.17);
      const dent = -0.012 * Math.exp(-((a - 0.9) ** 2) / 0.05) * k - 0.008 * Math.exp(-((a + 2.1) ** 2) / 0.03) * k + 0.006 * Math.sin(a * 7) * k * k;
      pp.setY(i, y + dent);
    }
    sg.computeVertexNormals();
    const shade = mesh(sg, m.tin); shade.position.y = y0 + 0.02; g.add(shade);
    // enamelled underside, a dull cream that throws the light down
    const under = mesh(sg, new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.5, side: THREE.BackSide, name: 'shadeEnamel' })); under.position.y = y0 + 0.018; under.scale.setScalar(0.995); g.add(under);
  }
  // three hanging rods
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const r = mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.3, 5), m.brass); at(r, Math.cos(a) * 0.06, y0 - 0.17, Math.sin(a) * 0.06); g.add(r); }
  // font
  const fy = y0 - 0.38;
  g.add(at(mesh(lathe(G, [[0, -0.02], [0.03, -0.02], [0.06, 0.0], [0.075, 0.03], [0.07, 0.06], [0.04, 0.08], [0.03, 0.085], [0.0, 0.085]], 32), m.ruby), 0, fy, 0));
  g.add(at(mesh(lathe(G, [[0, -0.06], [0.01, -0.06], [0.015, -0.035], [0.03, -0.02], [0.0, -0.02]], 18), m.brass), 0, fy, 0));
  g.add(at(mesh(lathe(G, [[0.024, 0.085], [0.036, 0.09], [0.036, 0.11], [0.028, 0.12], [0.024, 0.12]], 24), m.brass), 0, fy, 0));
  // gallery ring at the rods' ends
  g.add(at(mesh(new THREE.TorusGeometry(0.062, 0.004, 6, 32).rotateX(Math.PI / 2), m.brass), 0, fy + 0.04, 0));
  const chimMat = new THREE.MeshPhysicalMaterial({ color: 0xfff2dc, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide, name: 'lampGlass' });
  const chim = mesh(lathe(G, [[0.022, 0], [0.03, 0.02], [0.038, 0.05], [0.032, 0.08], [0.02, 0.12], [0.019, 0.2], [0.021, 0.204]], 32), chimMat);
  // soot staining the top of the chimney
  g.add(at(mesh(new THREE.CylinderGeometry(0.0195, 0.0195, 0.05, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false, name: 'chimSoot' })), 0, fy + 0.12 + 0.17, 0));
  chim.position.set(0, fy + 0.12, 0); chim.userData.noShadow = true; chim.renderOrder = 3; g.add(chim);
  g.userData.flameY = fy + 0.135;
  return g;
}

// ====================================================================== storage & furniture
/** domed steamer trunk: canvas/leather skin, wood slats, brass corners and lock */
export function buildTrunk(ctx, m, { w = 0.9, d = 0.5, h = 0.42, dome = 0.12, open = 0 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'trunk';
  g.add(at(mesh(bevelBox(G, w, h, d, 0.012), m.trunk), 0, h / 2, 0));
  // domed lid: extruded arch profile
  const lid = new THREE.Shape();
  lid.moveTo(-d / 2, 0); lid.lineTo(-d / 2, 0.03); lid.quadraticCurveTo(-d / 2, dome + 0.03, 0, dome + 0.03); lid.quadraticCurveTo(d / 2, dome + 0.03, d / 2, 0.03); lid.lineTo(d / 2, 0); lid.lineTo(-d / 2, 0);
  const lg = new THREE.ExtrudeGeometry(lid, { depth: w - 0.01, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 16 });
  lg.translate(0, 0, -(w - 0.01) / 2); lg.rotateY(Math.PI / 2);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, h, -d / 2); g.add(lidPivot);
  const lm = mesh(G.applyBoxUVs(lg, 1), m.trunk); lm.position.set(0, 0, d / 2); lidPivot.add(lm);
  lidPivot.rotation.x = -open;
  // slats
  for (const x of [-w * 0.32, w * 0.32]) {
    g.add(at(mesh(bevelBox(G, 0.05, h + 0.004, d + 0.012, 0.004), m.slat), x, h / 2, 0));
    const sl = new THREE.Shape(); sl.moveTo(-d / 2 - 0.006, 0); sl.lineTo(-d / 2 - 0.006, 0.03); sl.quadraticCurveTo(-d / 2 - 0.006, dome + 0.037, 0, dome + 0.037); sl.quadraticCurveTo(d / 2 + 0.006, dome + 0.037, d / 2 + 0.006, 0.03); sl.lineTo(d / 2 + 0.006, 0);
    const hole = new THREE.Path(); hole.moveTo(-d / 2 + 0.01, 0.002); hole.lineTo(d / 2 - 0.01, 0.002); hole.lineTo(d / 2 - 0.01, 0.028); hole.quadraticCurveTo(d / 2 - 0.01, dome + 0.02, 0, dome + 0.02); hole.quadraticCurveTo(-d / 2 + 0.01, dome + 0.02, -d / 2 + 0.01, 0.028); hole.lineTo(-d / 2 + 0.01, 0.002);
    sl.holes.push(hole);
    const sg = new THREE.ExtrudeGeometry(sl, { depth: 0.05, bevelEnabled: false, curveSegments: 16 }); sg.translate(0, 0, -0.025); sg.rotateY(Math.PI / 2);
    const s = mesh(G.applyBoxUVs(sg, 1), m.slat); s.position.set(x, 0, d / 2); lidPivot.add(s);
  }
  for (const y of [0.06, h - 0.05]) g.add(at(mesh(bevelBox(G, w + 0.008, 0.035, d + 0.008, 0.003), m.slat), 0, y, 0));
  // brass corners + lock + handles
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0.03, h - 0.03]) g.add(at(mesh(new THREE.SphereGeometry(0.022, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1), m.brass), sx * (w / 2 - 0.004), y, sz * (d / 2 - 0.004)).rotateX(y < 0.1 ? Math.PI : 0));
  g.add(at(mesh(bevelBox(G, 0.07, 0.08, 0.012, 0.003), m.brass), 0, h - 0.02, d / 2 + 0.006));
  for (const sx of [-1, 1]) { const hd = mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 16, Math.PI), m.leatherStrap); hd.rotation.y = Math.PI / 2; hd.rotation.z = Math.PI; at(hd, sx * (w / 2 + 0.01), h * 0.6, 0); g.add(hd); }
  return g;
}

/** slatted packing crate */
export function buildCrate(ctx, m, { w = 0.6, h = 0.45, d = 0.5, seed = 0 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'crate';
  const t = 0.018, n = 4;
  const boards = (len, axis, y, z, x, ww) => { const b = mesh(bevelBox(G, axis === 'x' ? len : t, ww, axis === 'x' ? t : len, 0.003), m.crate); at(b, x, y, z); g.add(b); };
  for (let i = 0; i < n; i++) {
    const y = (i + 0.5) * (h / n);
    const bh = h / n - 0.012;
    boards(w, 'x', y, d / 2 - t / 2, 0, bh); boards(w, 'x', y, -d / 2 + t / 2, 0, bh);
    boards(d - 2 * t, 'z', y, 0, w / 2 - t / 2, bh); boards(d - 2 * t, 'z', y, 0, -w / 2 + t / 2, bh);
  }
  for (let i = 0; i < 5; i++) g.add(at(mesh(bevelBox(G, w, t, d / 5 - 0.008, 0.003), m.crate), 0, h + t / 2, -d / 2 + (i + 0.5) * (d / 5)));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(mesh(bevelBox(G, 0.04, h, 0.04, 0.004), m.crate), sx * (w / 2 - 0.035), h / 2, sz * (d / 2 - 0.035)));
  // straw poking out
  if (seed % 2 === 0) for (let i = 0; i < 12; i++) { const s = mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.12, 3), m.straw); at(s, -w / 2 + 0.05 + (i * 0.37 % 1) * (w - 0.1), h + 0.03, d / 2 - 0.02); s.rotation.set(0.6 + (i % 3) * 0.2, 0, (i % 5 - 2) * 0.3); g.add(s); }
  return g;
}

/** dressmaker's dummy on a tripod */
export function buildDressForm(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'dressForm';
  const torso = mesh(lathe(G, [[0, 0.82], [0.13, 0.82], [0.16, 0.9], [0.15, 1.0], [0.12, 1.08], [0.135, 1.18], [0.17, 1.26], [0.16, 1.34], [0.11, 1.4], [0.05, 1.43], [0.045, 1.46], [0.05, 1.47], [0, 1.48]], 32), m.dressForm);
  torso.scale.set(1, 1, 0.75); g.add(torso);
  g.add(at(mesh(lathe(G, [[0, 0], [0.02, 0], [0.025, 0.02], [0.03, 0.04], [0, 0.04]], 12), m.labFrame), 0, 1.46, 0));
  g.add(at(mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.8, 10), m.labFrame), 0, 0.42, 0));
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const l = mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.36, 8), m.labFrame); at(l, Math.cos(a) * 0.14, 0.1, Math.sin(a) * 0.14); l.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); g.add(l); }
  // a tape measure draped over the shoulder
  const pts = [V3(-0.16, 1.2, 0.02), V3(-0.12, 1.36, 0.06), V3(0.0, 1.42, 0.1), V3(0.06, 1.38, 0.12), V3(0.1, 1.22, 0.1), V3(0.12, 1.05, 0.08)];
  const tape = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.006, 3), m.tape); tape.scale.set(1, 1, 0.75); g.add(tape);
  return g;
}

/** bird cage on a stand: domed wire cage, perch, an empty swing */
export function buildBirdCage(ctx, m) {
  const g = new THREE.Group(); g.name = 'birdCage';
  const r = 0.14, h = 0.3;
  g.add(mesh(new THREE.CylinderGeometry(r + 0.01, r + 0.015, 0.03, 32), m.brass));
  const wires = [];
  const nW = 24;
  for (let i = 0; i < nW; i++) {
    const a = (i / nW) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(V3(Math.cos(a) * r, 0.015 + t * h, Math.sin(a) * r)); }
    for (let k = 1; k <= 10; k++) { const t = k / 10; const rr = r * Math.cos(t * Math.PI / 2); pts.push(V3(Math.cos(a) * rr, 0.015 + h + Math.sin(t * Math.PI / 2) * r * 0.9, Math.sin(a) * rr)); }
    wires.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.0016, 3));
  }
  for (const w of wires) g.add(mesh(w, m.brass));
  for (const y of [0.1, 0.22, h]) g.add(at(mesh(new THREE.TorusGeometry(r, 0.0025, 4, 40).rotateX(Math.PI / 2), m.brass), 0, y, 0));
  g.add(at(mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 16), m.brass), 0, h + r * 0.9 + 0.035, 0));
  const perch = mesh(new THREE.CylinderGeometry(0.004, 0.004, r * 1.9, 6), m.handle); perch.rotation.z = Math.PI / 2; at(perch, 0, 0.12, 0); g.add(perch);
  return g;
}

/**
 * Dust sheet draped over an object: a grid shrink-wrapped over a height function,
 * the skirt falling to the floor with folds and a little pooling.
 * topH(x, z) gives the top surface over the footprint [-hw,hw]x[-hd,hd].
 */
export function dustSheetGeometry({ hw, hd, topH, seg = 72, seed = 1, flare = 0.06, hem: hemY = 0, foldAmp = 1 }) {
  const maxH = 2.2;
  const L = Math.max(hw, hd) + maxH;
  const g = new THREE.PlaneGeometry(2 * L, 2 * L, seg, seg).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  const col = [];
  let maxTop = 0.3;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / L, z = p.getZ(i) / L; maxTop = Math.max(maxTop, topH(THREE.MathUtils.clamp(x * (hw + 0.6), -hw, hw), THREE.MathUtils.clamp(z * (hd + 0.6), -hd, hd))); }
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    // map the outer square onto the footprint + hanging skirt
    const ux = x / L, uz = z / L;
    const cx = THREE.MathUtils.clamp(ux * (hw + 0.6), -hw, hw);
    const cz = THREE.MathUtils.clamp(uz * (hd + 0.6), -hd, hd);
    const ex = ux * (hw + 0.6) - cx, ez = uz * (hd + 0.6) - cz;
    const top = topH(cx, cz);
    const hemWave = 0.05 * Math.sin(Math.atan2(ez, ex) * 7 + seed) + 0.03 * Math.sin(Math.atan2(ez, ex) * 17 + seed * 3.1);
    let e = Math.min(Math.hypot(ex, ez) * (maxH / 0.6), hemY > 0 ? Math.max(0.02, top - hemY + hemWave) : top + 0.1 + hemWave);
    let y = top - e;
    const dirx = e > 0 ? ex / Math.hypot(ex, ez) : 0, dirz = e > 0 ? ez / Math.hypot(ex, ez) : 0;
    const per = Math.atan2(cz + dirz, cx + dirx);
    let fold = Math.sin(per * 13 + seed) * 0.5 + Math.sin(per * 29 + seed * 2.1) * 0.3 + Math.sin(per * 5 + seed * 0.7) * 0.35;
    // gravity folds hanging from the top corners: deep cones of cloth where the sheet breaks over each corner
    if (foldAmp > 1) {
      const ccx = Math.sign(cx || 1) * hw, ccz = Math.sign(cz || 1) * hd;
      const dc = Math.hypot(cx - ccx, cz - ccz) / Math.max(hw, hd);
      fold += (foldAmp - 1) * Math.exp(-dc * 3.0) * Math.sin(Math.atan2(cz - ccz, cx - ccx) * 6 + seed) * 1.2;
      fold *= 1 + (foldAmp - 1) * 0.35;
    }
    const hemK = Math.min(1, e / Math.max(top, 0.01));
    let out = Math.min(e, 0.25) * 0.08 + flare * hemK * (1 + 1.1 * fold) + hemK * hemK * 0.03 * (1 + fold) + 0.03 * fold * THREE.MathUtils.smoothstep(e, 0.0, 0.45);
    if (y < 0.004) { out += (0.004 - y) * 0.9; y = 0.004 + Math.abs(fold) * 0.014 * Math.min(1, (0.004 - y) * 6); }
    const nx = cx + dirx * out + (e > 0 ? -dirz : 0) * fold * 0.03 * hemK;
    const nz = cz + dirz * out + (e > 0 ? dirx : 0) * fold * 0.03 * hemK;
    const yy = y + (e > 0 ? 0 : Math.sin(cx * 13 + seed) * Math.sin(cz * 11) * 0.006 + Math.sin(cx * 31 + cz * 7 + seed) * 0.003);
    p.setXYZ(i, nx, yy, nz);
    uv.setXY(i, x * 1.0, z * 1.0);
    // dust settles on top; the hem is dirty from the floor
    const up = THREE.MathUtils.smoothstep(yy, 0.15, maxTop);
    const hem = 1 - THREE.MathUtils.smoothstep(yy, 0.0, 0.08);
    const c = [1.0 - 0.3 * up - 0.25 * hem, 0.95 - 0.27 * up - 0.27 * hem, 0.82 - 0.17 * up - 0.27 * hem];
    col.push(...c);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** stacked frames leaning against a wall (backs and one face) */
export function buildFrameStack(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'frames';
  const sizes = [[0.9, 0.7], [0.75, 0.95], [0.6, 0.5]];
  sizes.forEach(([w, h], i) => {
    const f = new THREE.Group();
    f.add(mesh(G.frameGeometry(w, h, { width: 0.07, depth: 0.04 }), i === 1 ? m.gilt : m.frameDark));
    const back = mesh(new THREE.PlaneGeometry(w - 0.1, h - 0.1), i === 1 ? m.painting : m.canvasBack);
    back.position.z = 0.01; f.add(back);
    f.position.set(i * 0.12 - 0.12, h / 2 * Math.cos(0.18), i * 0.07);
    f.rotation.x = -0.18;
    f.rotation.y = (i - 1) * 0.05;
    g.add(f);
  });
  return g;
}

/** painted toy chest, lid thrown back, toys spilling over the rim */
export function buildToyChest(ctx, m, { w = 0.8, d = 0.45, h = 0.42 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'toyChest';
  const t = 0.022;
  g.add(at(mesh(bevelBox(G, w, t, d, 0.004), m.chestPaint), 0, t / 2 + 0.03, 0));
  for (const sz of [-1, 1]) g.add(at(mesh(bevelBox(G, w, h, t, 0.005), m.chestPaint), 0, h / 2 + 0.03, sz * (d / 2 - t / 2)));
  for (const sx of [-1, 1]) g.add(at(mesh(bevelBox(G, t, h, d - 2 * t, 0.005), m.chestPaint), sx * (w / 2 - t / 2), h / 2 + 0.03, 0));
  // trim bands + bun feet
  for (const y of [0.05, h + 0.01]) for (const sz of [-1, 1]) g.add(at(mesh(bevelBox(G, w + 0.01, 0.03, 0.012, 0.003), m.toyRed), 0, y, sz * (d / 2 + 0.002)));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(mesh(new THREE.SphereGeometry(0.03, 10, 8), m.chestPaint), sx * (w / 2 - 0.05), 0.02, sz * (d / 2 - 0.05)));
  // painted star on the front
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? 0.03 : 0.07; const p = [Math.cos(a) * r, -Math.sin(a) * r]; i ? star.lineTo(...p) : star.moveTo(...p); }
  g.add(at(mesh(new THREE.ShapeGeometry(star), m.toyGold), 0, h / 2 + 0.03, d / 2 + 0.002));
  // lid hinged at the back, thrown open past vertical
  const lid = new THREE.Group(); lid.position.set(0, h + 0.03, -d / 2); lid.rotation.x = -1.95; g.add(lid);
  lid.add(at(mesh(bevelBox(G, w + 0.02, 0.025, d + 0.02, 0.005), m.chestPaint), 0, 0.0125, d / 2));
  lid.add(at(mesh(bevelBox(G, w * 0.7, 0.004, d * 0.6, 0.002), m.toyBlue), 0, 0.027, d / 2));
  // contents: a ball, a wooden train and a doll's legs
  g.add(at(mesh(new THREE.SphereGeometry(0.075, 24, 16), m.ball), -0.15, h - 0.02, 0.02));
  const train = buildTrain(ctx, m); train.position.set(0.12, h - 0.06, 0.0); train.rotation.set(0.5, 0.4, 0.2); g.add(train);
  for (const s of [-1, 1]) { const leg = mesh(new THREE.CapsuleGeometry(0.014, 0.11, 4, 8), m.porcelain); leg.position.set(0.3 + s * 0.02, h + 0.06, -0.08); leg.rotation.set(0.4, 0, -0.5 + s * 0.1); g.add(leg); }
  return g;
}

/** little wooden locomotive */
export function buildTrain(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'train';
  g.add(at(mesh(bevelBox(G, 0.2, 0.025, 0.07, 0.004), m.toyRed), 0, 0.03, 0));
  const boiler = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 18), m.toyGreen); boiler.rotation.z = Math.PI / 2; at(boiler, 0.035, 0.07, 0); g.add(boiler);
  g.add(at(mesh(bevelBox(G, 0.07, 0.08, 0.075, 0.004), m.toyBlue), -0.06, 0.08, 0));
  g.add(at(mesh(bevelBox(G, 0.085, 0.012, 0.085, 0.003), m.toyRed), -0.06, 0.125, 0));
  g.add(at(mesh(lathe(G, [[0, 0], [0.012, 0], [0.012, 0.03], [0.02, 0.045], [0, 0.045]], 12), m.toyBlack), 0.07, 0.095, 0));
  for (const x of [-0.06, 0.0, 0.06]) for (const s of [-1, 1]) { const wh = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), m.toyBlack); wh.rotation.x = Math.PI / 2; at(wh, x, 0.022, s * 0.04); g.add(wh); }
  return g;
}

/** Windsor-style workshop chair */
export function buildChair(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'chair';
  const seat = mesh(lathe(G, [[0, 0], [0.2, 0], [0.215, 0.015], [0.21, 0.035], [0, 0.04]], 28), m.benchFrame); seat.scale.set(1, 1, 0.9); at(seat, 0, 0.44, 0); g.add(seat);
  const legG = lathe(G, [[0, 0], [0.016, 0], [0.02, 0.1], [0.016, 0.2], [0.022, 0.3], [0.014, 0.44], [0, 0.44]], 10);
  for (const [x, z] of [[-0.15, 0.13], [0.15, 0.13], [-0.14, -0.13], [0.14, -0.13]]) { const l = mesh(legG, m.benchFrame); at(l, x * 1.15, 0, z * 1.15); l.rotation.set(-z * 0.5, 0, x * 0.5); g.add(l); }
  for (const z of [0.0]) { const st = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.34, 8), m.benchFrame); st.rotation.z = Math.PI / 2; at(st, 0, 0.2, z); g.add(st); }
  // spindle back + bow
  const bow = mesh(new THREE.TorusGeometry(0.19, 0.016, 8, 28, Math.PI), m.benchFrame); at(bow, 0, 0.62, -0.15); bow.rotation.x = -0.15; g.add(bow);
  for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI; const sp = mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.36, 6), m.benchFrame); at(sp, Math.cos(a) * 0.17, 0.62, -0.15 - 0.03); sp.rotation.x = -0.15; g.add(sp); sp.position.y = 0.46 + Math.sin(a) * 0.16; sp.scale.y = (Math.sin(a) * 0.16 + 0.17) / 0.36 * 1.0 + 0.1; sp.position.y = 0.46 + (Math.sin(a) * 0.19 + 0.17) / 2; sp.scale.y = (Math.sin(a) * 0.19 + 0.17) / 0.36; }
  return g;
}

/** an old coat hung from a peg by its collar: shoulders tented over the peg, folds deepening toward the hem, back flattened to the wall. origin = peg tip, +z = away from wall */
export function hangingCoatGeometry({ len = 1.1, width = 0.2, seed = 1, cape = false } = {}) {
  const prof = cape
    ? [[0.005, 0.0], [0.05, -0.02], [0.12, -0.08], [0.17, -0.2], [0.2, -0.45], [0.23, -len * 0.75], [0.25, -len]]
    : [[0.005, 0.0], [0.06, -0.025], [0.13, -0.07], [width, -0.14], [width * 0.95, -0.3], [width * 0.88, -0.5], [width * 0.95, -0.75], [width * 1.08, -len]];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => V2(Math.max(r, 1e-4), y)), 56, 0, Math.PI * 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = THREE.MathUtils.clamp(-y / len, 0, 1);
    const fold = Math.sin(a * 7 + seed) * 0.6 + Math.sin(a * 13 + seed * 1.7) * 0.4;
    const f = 1 + fold * 0.12 * k * k;
    x *= f; z *= f;
    z = z > 0 ? z * 0.42 : z * 0.12;       // flattened, back against the wall
    z += 0.035;
    y += Math.sin(a * 5 + seed) * 0.015 * k;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Victorian brass compound microscope, made to stand behind a specimen dish and reach over it:
 * black-japanned horseshoe foot, turned pillar, trunnion, a cast swan-neck limb carrying a slender
 * body tube with draw tube and eyepiece, rack and pinion with a pair of milled coarse-focus heads,
 * a fine-focus head on the limb, a gimballed mirror and a triple nosepiece whose objective looks
 * straight down. Origin = centre of the foot; +z = toward the dish. The objective tip sits at
 * local (0, objY, reach). Returns the group with userData.objective (local Vector3).
 */
export function buildMicroscopeVictorian(ctx, m, { reach = 0.24, objY = 0.2 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'microscope';
  const brass = m.brass, japan = m.blackEnamel;
  // horseshoe foot, open toward the dish
  const sh = new THREE.Shape();
  sh.absarc(0, 0, 0.085, Math.PI * 0.5 + 0.55, Math.PI * 2.5 - 0.55, false);
  sh.absarc(0, 0, 0.034, Math.PI * 2.5 - 0.55, Math.PI * 0.5 + 0.55, true);
  const foot = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 40 }), japan);
  foot.rotation.x = -Math.PI / 2; foot.rotation.z = Math.PI; foot.position.y = 0.004; g.add(foot);
  // turned pillar with mouldings
  g.add(at(mesh(lathe(G, [[0, 0], [0.026, 0], [0.026, 0.006], [0.018, 0.012], [0.014, 0.02], [0.012, 0.11], [0.016, 0.118], [0.016, 0.13], [0.012, 0.135], [0, 0.135]], 28), brass), 0, 0.02, -0.01));
  // trunnion: a cheek either side and the pivot
  for (const sx of [-1, 1]) g.add(at(mesh(new G.RoundedBoxGeometry(0.008, 0.05, 0.034, 2, 0.003), brass), sx * 0.02, 0.17, -0.01));
  g.add(at(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.056, 18).rotateZ(Math.PI / 2), brass), 0, 0.18, -0.01));
  for (const sx of [-1, 1]) g.add(at(mesh(lathe(G, [[0, 0], [0.012, 0], [0.012, 0.004], [0.008, 0.007], [0, 0.007]], 18).rotateZ(-sx * Math.PI / 2), brass), sx * 0.028, 0.18, -0.01));
  // the swan-neck limb: from the trunnion up, back, and over toward the dish
  const tubeZ = reach;
  const limbPts = [V3(0, 0.18, -0.01), V3(0, 0.25, -0.035), V3(0, 0.33, -0.02), V3(0, 0.375, 0.04), V3(0, 0.385, tubeZ - 0.07), V3(0, 0.375, tubeZ - 0.04)];
  const curve = new THREE.CatmullRomCurve3(limbPts, false, 'centripetal');
  const lg = new THREE.TubeGeometry(curve, 40, 0.016, 12, false);
  lg.scale(0.6, 1, 1);
  g.add(mesh(lg, brass));
  // fine-focus head on the limb's shoulder
  g.add(at(mesh(lathe(G, [[0, 0], [0.006, 0], [0.006, 0.01], [0.011, 0.012], [0.011, 0.02], [0.008, 0.023], [0, 0.023]], 20), brass), 0, 0.383, 0.05));
  // limb end block carrying the rack
  g.add(at(mesh(new G.RoundedBoxGeometry(0.03, 0.07, 0.028, 2, 0.004), brass), 0, 0.36, tubeZ - 0.035));
  // coarse-focus pinion with two milled heads
  g.add(at(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 10).rotateZ(Math.PI / 2), brass), 0, 0.345, tubeZ - 0.035));
  const knob = lathe(G, [[0, 0], [0.008, 0], [0.016, 0.002], [0.017, 0.006], [0.017, 0.01], [0.014, 0.012], [0.006, 0.014], [0, 0.014]], 32);
  for (const sx of [-1, 1]) { const k = mesh(knob, brass); k.rotation.z = -sx * Math.PI / 2; at(k, sx * 0.033, 0.345, tubeZ - 0.035); g.add(k); }
  // rack on the back of the tube
  g.add(at(mesh(new THREE.BoxGeometry(0.01, 0.17, 0.008), brass), 0, objY + 0.15, tubeZ - 0.02));
  // body tube, draw tube, eyepiece; collar rings
  const tube = lathe(G, [
    [0, 0], [0.004, 0], [0.006, 0.006], [0.009, 0.016], [0.011, 0.03], [0.012, 0.034],          // objective (looks down)
    [0.017, 0.036], [0.019, 0.04], [0.019, 0.052], [0.016, 0.056],                               // nosepiece
    [0.0155, 0.06], [0.0155, 0.235], [0.018, 0.238], [0.018, 0.248], [0.0125, 0.252],            // body tube
    [0.0125, 0.305], [0.015, 0.31], [0.016, 0.322], [0.0135, 0.326], [0.0135, 0.334], [0, 0.334], // draw tube + eyepiece cap
  ], 32);
  g.add(at(mesh(tube, brass), 0, objY, tubeZ));
  // spare objectives on the nosepiece, angled away
  for (const a of [2.1, 4.2]) {
    const ob = mesh(lathe(G, [[0, 0], [0.004, 0], [0.007, 0.01], [0.009, 0.025], [0, 0.025]], 16), brass);
    ob.position.set(Math.cos(a) * 0.012, objY + 0.044, tubeZ + Math.sin(a) * 0.012); ob.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); ob.rotation.x += Math.PI; g.add(ob);
  }
  // gimballed mirror on the pillar front
  const yoke = mesh(new THREE.TorusGeometry(0.022, 0.0025, 6, 24, Math.PI), brass); yoke.rotation.z = Math.PI; at(yoke, 0, 0.075, 0.025); g.add(yoke);
  const mir = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.005, 24), m.mirror); mir.rotation.x = 0.9; at(mir, 0, 0.068, 0.028); g.add(mir);
  g.userData.objective = V3(0, objY, tubeZ);
  return g;
}

/** a workshop stool: dished seat with a rounded edge, four splayed turned legs, a turned stretcher ring */
export function buildStool(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'stool';
  const H = 0.62;
  g.add(at(mesh(lathe(G, [[0, 0.028], [0.12, 0.022], [0.165, 0.03], [0.178, 0.038], [0.176, 0.05], [0.165, 0.056], [0.12, 0.05], [0, 0.046], [0, 0.0], [0.15, 0.0], [0.158, 0.012], [0.15, 0.022], [0, 0.028]], 40), m.labFrame), 0, H - 0.05, 0));
  const legG = lathe(G, [[0, 0], [0.012, 0], [0.016, 0.02], [0.013, 0.06], [0.017, 0.12], [0.02, 0.2], [0.015, 0.22], [0.019, 0.24], [0.015, 0.26], [0.018, 0.4], [0.021, 0.5], [0.016, 0.56], [0.019, 0.6], [0.015, 0.62], [0, 0.62]], 14);
  const splay = 0.1;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const l = mesh(legG, m.labFrame);
    l.position.set(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17);
    l.lookAt(Math.cos(a) * 0.12, 0.62, Math.sin(a) * 0.12);
    l.rotateX(Math.PI / 2);
    g.add(l);
  }
  void splay;
  g.add(at(mesh(new THREE.TorusGeometry(0.152, 0.009, 8, 40).rotateX(Math.PI / 2), m.labFrame), 0, 0.22, 0));
  g.add(at(mesh(new THREE.TorusGeometry(0.152, 0.004, 6, 40).rotateX(Math.PI / 2), m.brass), 0, 0.22 + 0.008, 0));
  return g;
}

/** a milled (knurled) knob: a cylinder along local Y whose rim carries `teeth` fine ridges, with chamfered faces */
export function knurledKnob(r, w, teeth = 40) {
  const seg = teeth * 2;
  const prof = [V2(0, -w / 2), V2(r * 0.86, -w / 2), V2(r, -w / 2 + w * 0.14), V2(r, w / 2 - w * 0.14), V2(r * 0.86, w / 2), V2(0, w / 2)];
  const g = new THREE.LatheGeometry(prof, seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const rr = Math.hypot(x, z);
    if (rr < r * 0.9 || Math.abs(y) > w / 2 - w * 0.13) continue;
    const a = Math.atan2(z, x);
    const k = Math.round((a / (Math.PI * 2)) * seg);
    const s = 1 - 0.06 * (k % 2 === 0 ? 1 : 0);
    p.setX(i, x * s); p.setZ(i, z * s);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A great Victorian monocular microscope, built to reach out over Stauf's specimen plate:
 * a black-lacquered cast-iron horseshoe foot, a turned brass pillar, a trunnion with a pivot
 * and clamp head, a cast swan-neck limb carrying the rack housing, coarse focus by a pair of
 * big milled heads, fine focus on the limb, a 40 mm body tube inclined toward the viewer
 * with draw tube and a flared eyepiece, and a triple-objective revolving nosepiece aimed
 * down at the plate. A gimballed concave mirror below the plate edge.
 * Origin = foot centre on the table; +z = toward the plate; the active objective's tip sits at
 * local (0, objY, reach). userData.objective = that point.
 */
export function buildMicroscopeGreat(ctx, m, { reach = 0.36, objY = 0.2, tilt = 0.42 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'microscope';
  const brass = m.scopeBrass || m.brass, japan = m.blackEnamel, steel = m.steel;
  // ------------------------------------------------ horseshoe foot (cast iron, black lacquer), opening toward the plate
  {
    const R0 = 0.125, R1 = 0.05, gap = 0.62;
    const sh = new THREE.Shape();
    sh.absarc(0, 0, R0, Math.PI / 2 + gap, Math.PI * 2.5 - gap, false);
    // rounded toes
    const a1 = Math.PI * 2.5 - gap, a0 = Math.PI / 2 + gap;
    const mid = (R0 + R1) / 2, tr = (R0 - R1) / 2;
    sh.absarc(Math.cos(a1) * mid, Math.sin(a1) * mid, tr, a1, a1 + Math.PI, false);
    sh.absarc(0, 0, R1, a1, a0, true);
    sh.absarc(Math.cos(a0) * mid, Math.sin(a0) * mid, tr, a0 + Math.PI, a0 + Math.PI * 2, false);
    const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 4, curveSegments: 56 });
    const foot = mesh(G.applyBoxUVs(fg, 4), japan);
    foot.rotation.x = -Math.PI / 2; foot.rotation.z = Math.PI; foot.position.y = 0.006; g.add(foot);
    // a raised boss under the pillar and three felt pads (hinted by a dark ring)
    g.add(at(mesh(lathe(G, [[0, 0], [0.05, 0], [0.052, 0.006], [0.045, 0.014], [0.034, 0.018], [0, 0.018]], 40), japan), 0, 0.026, -0.03));
  }
  // ------------------------------------------------ turned pillar with mouldings
  const PY = 0.044, PH = 0.2;
  g.add(at(mesh(lathe(G, [[0, 0], [0.032, 0], [0.032, 0.008], [0.026, 0.012], [0.026, 0.016], [0.02, 0.024], [0.016, 0.03], [0.015, 0.05], [0.017, 0.054], [0.015, 0.058], [0.0145, PH - 0.035], [0.018, PH - 0.03], [0.022, PH - 0.022], [0.022, PH - 0.012], [0.018, PH - 0.006], [0, PH - 0.006]], 40), brass), 0, PY, -0.03));
  // ------------------------------------------------ trunnion: two cheeks, pivot, clamp head
  const PIV = V3(0, PY + PH + 0.03, -0.03);
  for (const sx of [-1, 1]) {
    const ch = new THREE.Shape(); ch.moveTo(-0.022, -0.045); ch.lineTo(0.022, -0.045); ch.lineTo(0.02, 0.0); ch.absarc(0, 0.0, 0.02, 0, Math.PI, false); ch.lineTo(-0.022, -0.045);
    const cg = new THREE.ExtrudeGeometry(ch, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 20 });
    cg.translate(0, 0, -0.004); cg.rotateY(Math.PI / 2);
    g.add(at(mesh(cg, brass), PIV.x + sx * 0.024, PIV.y, PIV.z));
  }
  g.add(at(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.07, 20).rotateZ(Math.PI / 2), brass), PIV.x, PIV.y, PIV.z));
  { const kn = mesh(knurledKnob(0.017, 0.012, 32), brass); kn.rotation.z = Math.PI / 2; at(kn, PIV.x + 0.042, PIV.y, PIV.z); g.add(kn); }
  { const kn = mesh(lathe(G, [[0, 0], [0.012, 0], [0.012, 0.004], [0.008, 0.008], [0, 0.009]], 20), brass); kn.rotation.z = Math.PI / 2; at(kn, PIV.x - 0.03, PIV.y, PIV.z); g.add(kn); }
  // ------------------------------------------------ the optical axis
  const O = V3(0, objY, reach);
  const D = V3(0, Math.cos(tilt), -Math.sin(tilt));            // up the tube, leaning back toward the pillar
  const N = V3(0, Math.sin(tilt), Math.cos(tilt));             // the tube's front
  // the active objective sits a little off the tube axis (the turret leans): shift the whole optical train so its tip lands on O
  const O0 = O.clone().addScaledVector(D, 0.0166 + 0.05 - 0.05).addScaledVector(N, -0.0137);
  const along = (t, off = 0) => O0.clone().addScaledVector(D, t).addScaledVector(N, off);
  const tubeQ = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), D);
  const onAxis = (o, t, off = 0) => { o.position.copy(along(t, off)); o.quaternion.copy(tubeQ); g.add(o); return o; };
  // ------------------------------------------------ the cast swan-neck limb (extruded section, chamfered)
  {
    const rackC = along(0.2, -0.042);
    const c = [V2(PIV.z, PIV.y), V2(PIV.z - 0.03, PIV.y + 0.07), V2(PIV.z + 0.01, PIV.y + 0.15), V2(PIV.z + 0.1, PIV.y + 0.175), V2(rackC.z - 0.03, rackC.y + 0.03)];
    const curve = new THREE.SplineCurve(c);
    const n = 30, L = [], Rr = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = curve.getPoint(t), tg = curve.getTangent(t);
      const w = THREE.MathUtils.lerp(0.026, 0.018, t) + 0.006 * Math.sin(t * Math.PI);
      const nx = -tg.y, ny = tg.x;
      L.push(V2(p.x + nx * w, p.y + ny * w)); Rr.push(V2(p.x - nx * w, p.y - ny * w));
    }
    const sh = new THREE.Shape([...L, ...Rr.reverse()]);
    const lg = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 3, curveSegments: 8 });
    lg.translate(0, 0, -0.011);
    lg.rotateY(-Math.PI / 2);                // shape x -> world z, shape y -> world y
    g.add(mesh(G.applyBoxUVs(lg, 6), brass));
    // rack housing: a block on the back of the tube
    const rh = mesh(new G.RoundedBoxGeometry(0.036, 0.15, 0.034, 3, 0.006), brass);
    onAxis(rh, 0.2, -0.036);
    // pinion and the two big milled coarse-focus heads
    const pin = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.1, 12).rotateZ(Math.PI / 2), steel); onAxis(pin, 0.17, -0.04);
    for (const sx of [-1, 1]) {
      const kn = mesh(knurledKnob(0.026, 0.016, 44), brass); kn.rotation.z = Math.PI / 2;
      const kg = new THREE.Group(); kg.add(kn); kn.position.x = sx * 0.05; onAxis(kg, 0.17, -0.04);
      const cap = mesh(lathe(G, [[0, 0], [0.016, 0], [0.012, 0.006], [0, 0.007]], 24), brass); cap.rotation.z = -sx * Math.PI / 2; cap.position.x = sx * 0.058; kg.add(cap);
    }
    // fine-focus head on the shoulder of the limb
    const fpos = curve.getPoint(0.58);
    g.add(at(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 12), brass), 0, fpos.y + 0.03, fpos.x));
    { const kn = mesh(knurledKnob(0.015, 0.012, 30), brass); at(kn, 0, fpos.y + 0.045, fpos.x); g.add(kn); }
  }
  // ------------------------------------------------ body tube, collar rings, draw tube, flared eyepiece
  {
    const prof = [
      [0, 0.055], [0.024, 0.055], [0.026, 0.06], [0.026, 0.07], [0.021, 0.074],                 // nosepiece collar
      [0.02, 0.08], [0.02, 0.33], [0.024, 0.334], [0.024, 0.348], [0.0205, 0.352],              // body tube with milled collar
      [0.016, 0.356], [0.016, 0.43], [0.0175, 0.434], [0.0175, 0.44],                           // draw tube with engraved scale ring
      [0.015, 0.444], [0.016, 0.455], [0.024, 0.475], [0.0265, 0.49], [0.0265, 0.505], [0.022, 0.51], [0.012, 0.512], [0, 0.512], // eyepiece flare + cup
    ];
    onAxis(mesh(lathe(G, prof, 48), brass), 0);
    const lens = mesh(new THREE.CircleGeometry(0.011, 24).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x0a1018, roughness: 0.02, metalness: 0.2, clearcoat: 1, name: 'eyeLens' }));
    onAxis(lens, 0.5125);
    // the rack teeth visible along the back of the tube
    const rack = mesh(new THREE.BoxGeometry(0.008, 0.2, 0.006), steel); onAxis(rack, 0.2, -0.022);
  }
  // ------------------------------------------------ the revolving triple nosepiece: a domed turret on its own axis
  {
    const tq = new THREE.Group(); onAxis(tq, 0.05);
    const turAxis = new THREE.Group(); turAxis.rotation.x = 0.5; tq.add(turAxis);   // the turret's axis leans off the optical axis
    turAxis.add(mesh(lathe(G, [[0, 0.012], [0.034, 0.012], [0.036, 0.004], [0.032, -0.006], [0.02, -0.012], [0, -0.013]], 40), brass));
    turAxis.add(at(mesh(knurledKnob(0.037, 0.006, 48), brass), 0, 0.009, 0));
    // three objectives round the turret; the first lines up with the optical axis (pointing down the tube)
    const obj = (len, rTop) => lathe(G, [[0, 0], [rTop * 0.4, 0], [rTop * 0.55, len * 0.12], [rTop * 0.72, len * 0.45], [rTop * 0.8, len * 0.5], [rTop * 0.8, len * 0.7], [rTop, len * 0.74], [rTop, len], [0, len]], 28);
    const objs = [[0, 0.05, 0.012], [Math.PI * 2 / 3, 0.042, 0.011], [Math.PI * 4 / 3, 0.034, 0.0105]];
    for (const [a, len, r] of objs) {
      const og = new THREE.Group(); og.rotation.y = a; turAxis.add(og);
      const tilted = new THREE.Group(); tilted.position.set(0, -0.008, 0.02); tilted.rotation.x = -0.5; og.add(tilted);
      const o = mesh(obj(len, r), brass); o.rotation.x = Math.PI; tilted.add(o);
      const glass = mesh(new THREE.CircleGeometry(r * 0.35, 16).rotateX(Math.PI / 2), m.mirror); glass.position.y = -len - 0.0005; tilted.add(glass);
    }
    // re-aim: make the active objective's tip land on O
    tq.updateMatrixWorld(true);
  }
  // ------------------------------------------------ the gimballed concave mirror, below the plate rim on a swinging arm
  {
    const armY = PY + 0.06;
    const arm = mesh(new G.RoundedBoxGeometry(0.012, 0.012, 0.11, 2, 0.004), brass); at(arm, 0, armY, 0.035); g.add(arm);
    const yoke = mesh(new THREE.TorusGeometry(0.034, 0.004, 8, 32, Math.PI), brass); yoke.rotation.set(0, 0, Math.PI); at(yoke, 0, armY + 0.0, 0.1); g.add(yoke);
    const mg = new THREE.Group(); mg.position.set(0, armY - 0.0, 0.1); mg.rotation.x = -0.9; g.add(mg);
    mg.add(mesh(lathe(G, [[0, -0.006], [0.031, -0.006], [0.032, 0.002], [0.029, 0.004], [0, 0.0]], 36), brass));
    mg.add(at(mesh(new THREE.CircleGeometry(0.028, 36).rotateX(-Math.PI / 2), m.mirror), 0, 0.0035, 0));
  }
  g.userData.objective = O.clone();
  return g;
}

// ====================================================================== eaves storage (round 3 dressing)
/** a leather suitcase: rounded body, contrasting corner caps, two straps with buckles, handle, brass catches */
export function buildSuitcase(ctx, m, { w = 0.62, h = 0.2, d = 0.4, body = null, seed = 1 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'suitcase';
  const B = body || m.trunk;
  g.add(at(mesh(new G.RoundedBoxGeometry(w, h, d, 3, 0.022), B), 0, h / 2, 0));
  // lid seam: a dark welt round the middle
  g.add(at(mesh(new G.RoundedBoxGeometry(w + 0.004, 0.008, d + 0.004, 2, 0.004), m.leatherStrap), 0, h * 0.62, 0));
  // corner caps
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(mesh(new G.RoundedBoxGeometry(0.06, h + 0.006, 0.06, 2, 0.012), m.leatherStrap), sx * (w / 2 - 0.026), h / 2, sz * (d / 2 - 0.026)));
  // straps + buckles
  for (const sx of [-0.28, 0.28]) {
    g.add(at(mesh(bevelBox(G, 0.035, h + 0.008, d + 0.008, 0.002), m.leatherStrap), sx * w, h / 2, 0));
    g.add(at(mesh(new THREE.TorusGeometry(0.014, 0.0025, 4, 4), m.brass), sx * w, h * 0.7, d / 2 + 0.006));
  }
  // handle + catches
  const hd = mesh(new THREE.TorusGeometry(0.05, 0.009, 8, 16, Math.PI), m.leatherStrap); hd.position.set(0, h * 0.62, d / 2 + 0.012); hd.rotation.x = Math.PI / 2; hd.scale.z = 0.6; g.add(hd);
  for (const sx of [-0.14, 0.14]) g.add(at(mesh(bevelBox(G, 0.03, 0.03, 0.008, 0.002), m.brass), sx * w, h * 0.62, d / 2 + 0.004));
  void seed;
  return g;
}

/** a round hat box with a lid and a cord, in a papered finish */
export function buildHatBox(ctx, m, paper, { r = 0.2, h = 0.22, lidOpen = 0 } = {}) {
  const g = new THREE.Group(); g.name = 'hatBox';
  g.add(at(mesh(new THREE.CylinderGeometry(r, r, h, 40, 1, true), paper), 0, h / 2, 0));
  g.add(at(mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), m.canvasBack), 0, 0.002, 0));
  const lid = new THREE.Group(); lid.position.set(0, h - 0.03, 0); g.add(lid);
  lid.add(at(mesh(new THREE.CylinderGeometry(r + 0.006, r + 0.006, 0.05, 40, 1, true), paper), 0, 0.025, 0));
  lid.add(at(mesh(new THREE.CircleGeometry(r + 0.006, 40).rotateX(-Math.PI / 2), paper), 0, 0.05, 0));
  lid.add(at(mesh(new THREE.TorusGeometry(r + 0.007, 0.003, 4, 40).rotateX(Math.PI / 2), m.leatherStrap), 0, 0.002, 0));
  if (lidOpen) { lid.rotation.z = lidOpen; lid.position.x = r * 0.5; lid.position.y += 0.03; }
  // cord handle looped over the top
  const pts = [V3(-r * 0.7, h, 0), V3(-r * 0.5, h + 0.08, 0), V3(0, h + 0.11, 0.01), V3(r * 0.5, h + 0.08, 0), V3(r * 0.7, h, 0)];
  if (!lidOpen) g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.004, 5), m.rope));
  return g;
}

/** a carpet rolled up and tied with cord; the rug texture shows on the spiral end and the outer face */
export function buildRolledRug(ctx, m, rugMat, { len = 1.8, r = 0.11, turns = 6 } = {}) {
  const g = new THREE.Group(); g.name = 'rolledRug';
  const body = mesh(new THREE.CylinderGeometry(r, r, len, 28, 1, true), rugMat); body.rotation.z = Math.PI / 2; g.add(body);
  // spiral ends: a flat ring + a dark spiral line of the backing
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= turns * 40; i++) { const t = i / (turns * 40); const a = t * turns * Math.PI * 2; const rr = 0.012 + t * (r - 0.014); pts.push(V2(Math.cos(a) * rr, Math.sin(a) * rr)); }
    const sp = new THREE.Shape(); sp.absarc(0, 0, r, 0, Math.PI * 2);
    const end = mesh(new THREE.ShapeGeometry(sp, 32), rugMat); end.rotation.y = sx * Math.PI / 2; end.position.x = sx * len / 2; g.add(end);
    const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V3(0, p.x, p.y))), turns * 40, 0.0022, 3), m.rugEdge || m.leatherStrap);
    line.position.x = sx * (len / 2 + 0.001); g.add(line);
    g.add(at(mesh(new THREE.CircleGeometry(0.011, 12).rotateY(sx * Math.PI / 2), m.black), sx * (len / 2 + 0.002), 0, 0));
  }
  // cords
  for (const x of [-len * 0.3, len * 0.3]) { const c = mesh(new THREE.TorusGeometry(r + 0.003, 0.004, 5, 28), m.rope); c.rotation.y = Math.PI / 2; c.position.x = x; g.add(c); }
  return g;
}

/** a bundle of books tied with string, the top one askew */
export function buildBookBundle(ctx, m, { n = 5, seed = 1 } = {}) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'books';
  let s = seed * 9973 + 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  let y = 0;
  const cols = [m.bookLeather, m.trunk, m.saddleCloth || m.trunk, m.leatherStrap];
  for (let i = 0; i < n; i++) {
    const w = 0.2 + rnd() * 0.08, d = 0.14 + rnd() * 0.06, t = 0.025 + rnd() * 0.03;
    const bk = new THREE.Group(); bk.position.y = y; bk.rotation.y = (rnd() - 0.5) * (i === n - 1 ? 0.6 : 0.15); g.add(bk);
    bk.add(at(mesh(new G.RoundedBoxGeometry(w, t, d, 2, 0.004), cols[i % cols.length]), 0, t / 2, 0));
    bk.add(at(mesh(new THREE.BoxGeometry(w - 0.012, t - 0.008, d - 0.004), m.pageEdge), 0.008, t / 2, 0));
    y += t;
  }
  // string crossing both ways
  for (const [sx, sz] of [[1, 0], [0, 1]]) {
    const hw = sx ? 0.11 : 0.0025, hd = sz ? 0.08 : 0.0025;
    const sg = new THREE.BoxGeometry(sx ? 0.004 : 0.005, y + 0.006, sz ? 0.004 : 0.005);
    for (const k of [-1, 1]) g.add(at(mesh(sg, m.string), k * hw * sx, y / 2, k * hd * sz));
  }
  return g;
}

/** a gramophone: square oak case, turntable, tone arm and a great petalled brass horn */
export function buildGramophone(ctx, m) {
  const { geometry: G } = ctx;
  const g = new THREE.Group(); g.name = 'gramophone';
  g.add(at(mesh(bevelBox(G, 0.32, 0.15, 0.32, 0.01), m.labTop), 0, 0.075, 0));
  g.add(at(mesh(bevelBox(G, 0.34, 0.018, 0.34, 0.006), m.labTop), 0, 0.159, 0));
  g.add(at(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.01, 40), m.velvetRed || m.saddle), 0, 0.173, 0));
  g.add(at(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.003, 40), m.blackEnamel), 0, 0.18, 0));
  // crank
  const cr = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 8).rotateZ(Math.PI / 2), m.steel); cr.position.set(0.21, 0.08, 0); g.add(cr);
  g.add(at(mesh(lathe(G, [[0, 0], [0.009, 0], [0.008, 0.04], [0, 0.042]], 10).rotateZ(Math.PI / 2), m.handle), 0.26, 0.04, 0));
  // tone arm and horn: elbow up and back, then the flaring horn facing forward
  const elbow = [V3(0.12, 0.18, -0.12), V3(0.12, 0.3, -0.13), V3(0.08, 0.42, -0.08)];
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(elbow), 16, 0.015, 10), m.brass));
  const prof = []; for (let i = 0; i <= 24; i++) { const t = i / 24; prof.push([0.016 + 0.24 * Math.pow(t, 3.2), t * 0.48]); }
  const hornG = lathe(G, prof, 12 * 4);
  { const p = hornG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x); const k = Math.pow(y / 0.48, 3); const f = 1 + 0.08 * k * Math.cos(a * 12); p.setX(i, x * f); p.setZ(i, z * f); } hornG.computeVertexNormals(); }
  const horn = mesh(hornG, m.brass); horn.material = m.brass; horn.position.set(0.08, 0.42, -0.08); horn.rotation.set(1.15, 0, 0); g.add(horn);
  const inside = mesh(hornG, m.toyRed); inside.material = new THREE.MeshStandardMaterial({ color: 0x3a0c08, roughness: 0.6, side: THREE.BackSide, name: 'hornInside' }); inside.position.copy(horn.position); inside.rotation.copy(horn.rotation); inside.scale.setScalar(0.995); g.add(inside);
  return g;
}
