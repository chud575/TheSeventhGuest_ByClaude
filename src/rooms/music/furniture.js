import * as THREE from 'three';

/**
 * Furniture for the music room: marble chimneypiece with a live coal fire,
 * a floor candelabrum, a glazed music cabinet, a balloon-back chair, a
 * crystal gasolier, gas sconces and a gramophone.
 */

/** Chimneypiece on a wall facing +Z (origin = floor at the wall face, centred). */
export function buildFireplace(ctx, { marble, iron, brass, gilt }) {
  const { geometry: G, fx } = ctx;
  const g = new THREE.Group();
  g.name = 'fireplace';
  const W = 1.7, H = 1.25, D = 0.32;
  const openW = 0.86, openH = 0.82;
  // surround: shape with an arched opening, extruded
  // surround: a U-shaped outline (no hole touching the edge) around an arched opening
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0); s.lineTo(-openW / 2, 0); s.lineTo(-openW / 2, openH - 0.12);
  s.quadraticCurveTo(-openW / 2, openH, -openW / 2 + 0.16, openH);
  s.lineTo(openW / 2 - 0.16, openH); s.quadraticCurveTo(openW / 2, openH, openW / 2, openH - 0.12);
  s.lineTo(openW / 2, 0); s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.closePath();
  const surround = new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(s, { depth: D * 0.55, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 16 }), 1.2), marble);
  g.add(surround);
  // pilasters with corbels
  for (const sx of [-1, 1]) {
    const pil = new THREE.Mesh(new G.RoundedBoxGeometry(0.2, H - 0.12, 0.08, 2, 0.01), marble);
    pil.position.set(sx * (W / 2 - 0.12), (H - 0.12) / 2, D * 0.55 + 0.04); g.add(pil);
    const corbel = new THREE.Mesh(G.latheFromProfile([[0.0, 0], [0.09, 0], [0.12, 0.04], [0.1, 0.08], [0.13, 0.12], [0.0, 0.12]], 4), marble);
    corbel.rotation.y = Math.PI / 4; corbel.scale.set(1, 1, 0.6);
    corbel.position.set(sx * (W / 2 - 0.12), H - 0.12, D * 0.55 + 0.04); g.add(corbel);
    const plinth = new THREE.Mesh(new G.RoundedBoxGeometry(0.24, 0.14, 0.12, 2, 0.01), marble);
    plinth.position.set(sx * (W / 2 - 0.12), 0.07, D * 0.55 + 0.05); g.add(plinth);
  }
  // mantel shelf with a moulded edge (swept profile)
  const shelfProf = [[0, 0], [0.03, 0], [0.04, 0.012], [0.05, 0.02], [0.05, 0.04], [0.035, 0.05], [0.0, 0.05]].map(([x, y]) => new THREE.Vector2(x, y));
  const shelf = new THREE.Mesh(new G.RoundedBoxGeometry(W + 0.2, 0.06, D + 0.1, 2, 0.012), marble);
  shelf.position.set(0, H + 0.03, (D + 0.1) / 2); g.add(shelf);
  const shelfEdge = new THREE.Mesh(G.sweepProfile(shelfProf, [new THREE.Vector3(-W / 2 - 0.1, H - 0.05, 0), new THREE.Vector3(-W / 2 - 0.1, H - 0.05, D + 0.1), new THREE.Vector3(W / 2 + 0.1, H - 0.05, D + 0.1), new THREE.Vector3(W / 2 + 0.1, H - 0.05, 0)], { uvScale: 1 }), marble);
  g.add(shelfEdge);
  // frieze tablet with gilt lyre motif (simple: gilt plaque)
  const tablet = new THREE.Mesh(new G.RoundedBoxGeometry(0.42, 0.16, 0.03, 2, 0.008), gilt);
  tablet.position.set(0, openH + 0.2, D * 0.55 + 0.012); g.add(tablet);
  // hearth slab
  const hearth = new THREE.Mesh(new G.RoundedBoxGeometry(W + 0.3, 0.05, 0.62, 2, 0.01), marble);
  hearth.position.set(0, 0.025, 0.31); g.add(hearth);
  // firebox (dark iron, sooty)
  const back = new THREE.Mesh(new THREE.BoxGeometry(openW, openH, 0.02), iron);
  back.position.set(0, openH / 2, -0.24); g.add(back);
  for (const sx of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.02, openH, 0.3), iron);
    cheek.position.set(sx * openW * 0.42, openH / 2, -0.1); cheek.rotation.y = sx * 0.35; g.add(cheek);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(openW, 0.02, 0.4), iron);
  top.position.set(0, openH - 0.01, -0.05); g.add(top);
  // cast-iron insert frame with an arched grate
  const grate = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 6), iron);
    bar.position.set(-0.24 + i * 0.08, 0.15, 0.02); grate.add(bar);
  }
  for (const y of [0.07, 0.24]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.015, 0.02), iron); rail.position.set(0, y, 0.02); grate.add(rail); }
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.012, 0.22), iron);
  basket.position.set(0, 0.07, -0.08); grate.add(basket);
  grate.position.set(0, 0.05, 0.0); g.add(grate);
  // coals: little emissive lumps
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x120a06, roughness: 0.9, emissive: new THREE.Color(1.0, 0.32, 0.08), emissiveIntensity: 2.2 });
  const coalGeo = new THREE.DodecahedronGeometry(0.035, 0);
  const coals = new THREE.InstancedMesh(coalGeo, coalMat, 26);
  const rnd = ctx.random.fork('coals');
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 26; i++) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd.next() * 3, rnd.next() * 3, rnd.next() * 3));
    const sc = 0.6 + rnd.next() * 0.7;
    m4.compose(new THREE.Vector3(-0.24 + rnd.next() * 0.48, 0.15 + rnd.next() * 0.08, -0.17 + rnd.next() * 0.17), q, new THREE.Vector3(sc, sc * 0.8, sc));
    coals.setMatrixAt(i, m4);
  }
  coals.userData.noBake = true;
  g.add(coals);
  // logs
  const logMat = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.95, emissive: new THREE.Color(0.9, 0.25, 0.05), emissiveIntensity: 0.25 });
  for (const [x, ry] of [[-0.08, 0.25], [0.1, -0.3]]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.5, 10), logMat);
    log.rotation.z = Math.PI / 2; log.rotation.y = ry; log.position.set(x, 0.24, -0.1); g.add(log);
  }
  // flames
  const flames = [];
  for (let i = 0; i < 11; i++) {
    const big = i % 3 === 1;
    const f = fx.flame({
      height: (big ? 0.22 : 0.1) + rnd.next() * 0.1, width: (big ? 0.05 : 0.035) + rnd.next() * 0.02, intensity: big ? 0.6 : 0.4, seed: 40 + i * 7,
      core: [1.0, 0.75, 0.38], outer: [1.0, 0.3, 0.05], base: [0.6, 0.12, 0.02],
    });
    f.position.set(-0.24 + (i / 10) * 0.48 + (rnd.next() - 0.5) * 0.03, 0.2 + rnd.next() * 0.04, -0.15 + rnd.next() * 0.12);
    g.add(f); flames.push(f);
  }
  // brass fender + fire irons
  const fender = new THREE.Mesh(G.sweepProfile([[0, 0], [0.01, 0], [0.012, 0.04], [0.006, 0.07], [0.012, 0.08], [0, 0.085]].map(([x, y]) => new THREE.Vector2(x, y)),
    [new THREE.Vector3(-0.62, 0.05, 0.0), new THREE.Vector3(-0.62, 0.05, 0.52), new THREE.Vector3(0.62, 0.05, 0.52), new THREE.Vector3(0.62, 0.05, 0.0)], { uvScale: 2 }), brass);
  g.add(fender);
  for (let i = 0; i < 3; i++) {
    const tool = new THREE.Mesh(G.latheFromProfile([[0.006, 0], [0.006, 0.6], [0.014, 0.62], [0.01, 0.66], [0.016, 0.7], [0.0, 0.72]], 10), brass);
    tool.position.set(0.72 + i * 0.03, 0.05, 0.42); tool.rotation.z = 0.08 - i * 0.05; g.add(tool);
  }
  g.userData = { flames, coals, coalMat, opening: { w: openW, h: openH } };
  return g;
}

/** Five-light floor candelabrum (torchère), ~1.75 m. Returns group + candle list. */
export function buildTorchere(ctx, { brass, seed = 11 }) {
  const { geometry: G, fx } = ctx;
  const g = new THREE.Group();
  g.name = 'torchere';
  const stem = new THREE.Mesh(G.latheFromProfile([
    [0.0, 0], [0.16, 0], [0.16, 0.015], [0.12, 0.035], [0.06, 0.06], [0.045, 0.1], [0.06, 0.14], [0.03, 0.2], [0.022, 0.5], [0.035, 0.55], [0.024, 0.6],
    [0.02, 1.2], [0.04, 1.25], [0.03, 1.3], [0.05, 1.36], [0.02, 1.4], [0.0, 1.41],
  ], 28), brass);
  g.add(stem);
  // tripod feet
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), brass);
    foot.position.set(Math.cos(a) * 0.14, 0.02, Math.sin(a) * 0.14); g.add(foot);
  }
  const candles = [];
  const arms = 4;
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + Math.PI / 4;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.33, 0), new THREE.Vector3(Math.cos(a) * 0.1, 1.29, Math.sin(a) * 0.1),
      new THREE.Vector3(Math.cos(a) * 0.2, 1.36, Math.sin(a) * 0.2), new THREE.Vector3(Math.cos(a) * 0.22, 1.45, Math.sin(a) * 0.22),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.008, 8), brass));
    const cup = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0], [0.03, 0.02], [0.035, 0.03], [0.015, 0.03], [0, 0.03]], 18), brass);
    cup.position.set(Math.cos(a) * 0.22, 1.45, Math.sin(a) * 0.22); g.add(cup);
    const c = fx.candle({ height: 0.16 + (i % 2) * 0.03, radius: 0.012, light: false, seed: seed + i * 13, burn: 0.75 });
    c.position.set(Math.cos(a) * 0.22, 1.475, Math.sin(a) * 0.22); g.add(c); candles.push(c);
  }
  const cupC = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0], [0.032, 0.025], [0.038, 0.035], [0, 0.035]], 18), brass);
  cupC.position.set(0, 1.41, 0); g.add(cupC);
  const cc = fx.candle({ height: 0.24, radius: 0.013, light: false, seed: seed + 99, burn: 0.6 });
  cc.position.set(0, 1.44, 0); g.add(cc); candles.push(cc);
  g.userData.candles = candles;
  return g;
}

/** Glazed music cabinet / bookcase (origin floor-centre at the wall, faces +Z). */
export function buildCabinet(ctx, { wood, glass, brass, books, giltPlain }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'cabinet';
  const W = 1.5, H = 2.3, D = 0.42;
  const carcass = new THREE.Mesh(G.boxUV(W, H, D, 1), wood);
  carcass.position.set(0, H / 2, D / 2); g.add(carcass);
  // inside: dark back + shelves of scores/books (instanced via the books material)
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.12, 1.25), new THREE.MeshStandardMaterial({ color: 0x0b0806, roughness: 0.9 }));
  inner.position.set(0, 1.45, D + 0.001); g.add(inner);
  for (let i = 0; i < 3; i++) {
    const shelfY = 0.9 + i * 0.4;
    const row = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.14, 0.33), books[i % books.length]);
    row.position.set(0, shelfY + 0.17, D + 0.004); g.add(row);
    const sh = new THREE.Mesh(G.boxUV(W - 0.1, 0.025, 0.05, 1), wood);
    sh.position.set(0, shelfY, D + 0.02); g.add(sh);
  }
  // glazed doors: frames + glass
  for (const sx of [-1, 1]) {
    const dw = (W - 0.1) / 2;
    const frame = new THREE.Mesh(G.frameGeometry(dw - 0.08, 1.26, { width: 0.04, depth: 0.02, uvScale: 1 }), wood);
    frame.position.set(sx * dw / 2, 1.45, D + 0.03); g.add(frame);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(dw - 0.08, 1.26), glass);
    gl.position.set(sx * dw / 2, 1.45, D + 0.035); gl.userData.noShadow = true; g.add(gl);
    // glazing bars
    for (const y of [1.08, 1.45, 1.82]) { const b = new THREE.Mesh(new THREE.BoxGeometry(dw - 0.08, 0.014, 0.012), wood); b.position.set(sx * dw / 2, y, D + 0.04); g.add(b); }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 8), brass);
    knob.position.set(sx * 0.04, 1.45, D + 0.06); g.add(knob);
    // lower solid doors with raised panels
    const p = new THREE.Mesh(G.raisedPanel(dw - 0.04, 0.6, { border: 0.06, bevel: 0.02 }), wood);
    p.position.set(sx * dw / 2, 0.42, D + 0.005); g.add(p);
  }
  // waist moulding + cornice
  const corn = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.16, 0.12), [new THREE.Vector3(-W / 2, H - 0.02, 0), new THREE.Vector3(-W / 2, H - 0.02, D), new THREE.Vector3(W / 2, H - 0.02, D), new THREE.Vector3(W / 2, H - 0.02, 0)], { uvScale: 1, flipOutward: false }), wood);
  g.add(corn);
  const waist = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.05, 0.025), [new THREE.Vector3(-W / 2, 0.76, 0), new THREE.Vector3(-W / 2, 0.76, D), new THREE.Vector3(W / 2, 0.76, D), new THREE.Vector3(W / 2, 0.76, 0)], { uvScale: 1 }), wood);
  g.add(waist);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.02, 0.02), giltPlain);
  gl.position.set(0, H + 0.03, D + 0.1); g.add(gl);
  return g;
}

/** Balloon-back side chair. */
export function buildChair(ctx, { wood, velvet }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'chair';
  const seat = new THREE.Mesh(new G.RoundedBoxGeometry(0.46, 0.08, 0.44, 3, 0.03), velvet);
  seat.position.y = 0.47; g.add(seat);
  const rail = new THREE.Mesh(new G.RoundedBoxGeometry(0.47, 0.06, 0.45, 2, 0.01), wood);
  rail.position.y = 0.41; g.add(rail);
  for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) {
    const leg = new THREE.Mesh(G.latheFromProfile([[0.02, 0], [0.014, 0.04], [0.02, 0.1], [0.024, 0.25], [0.018, 0.33], [0.024, 0.4], [0.0, 0.41]], 12), wood);
    leg.position.set(x, 0, z); if (z < 0) leg.rotation.x = -0.06; g.add(leg);
  }
  // balloon back: a torus-ish loop
  const back = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 8, 36), wood);
  back.scale.set(1, 1.15, 1);
  back.position.set(0, 0.83, -0.2); back.rotation.x = 0.12; g.add(back);
  const splat = new THREE.Mesh(new G.RoundedBoxGeometry(0.34, 0.05, 0.025, 2, 0.01), wood);
  splat.position.set(0, 0.7, -0.205); splat.rotation.x = 0.12; g.add(splat);
  for (const x of [-0.2, 0.2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.3, 8), wood);
    post.position.set(x, 0.6, -0.205); g.add(post);
  }
  return g;
}

/** Crystal gasolier with frosted globes. Origin at the ceiling. Returns { group, globes }. */
export function buildGasolier(ctx, { brass, crystal }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'gasolier';
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 6), brass);
  chain.position.y = -0.35; g.add(chain);
  const rose = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.12, 0], [0.1, -0.03], [0.04, -0.06], [0.0, -0.07]], 24), brass);
  g.add(rose);
  const body = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.04, -0.02], [0.08, -0.08], [0.06, -0.12], [0.12, -0.18], [0.1, -0.22], [0.03, -0.28], [0.05, -0.34], [0, -0.4]], 28), brass);
  body.position.y = -0.7; g.add(body);
  const globes = [];
  const globeMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: new THREE.Color(1.0, 0.72, 0.42), emissiveIntensity: 0.6, roughness: 0.3, transparent: true, opacity: 0.95 });
  const arms = 6;
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(c * 0.06, -0.86, s * 0.06), new THREE.Vector3(c * 0.25, -0.95, s * 0.25), new THREE.Vector3(c * 0.42, -0.9, s * 0.42), new THREE.Vector3(c * 0.46, -0.8, s * 0.46),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.01, 8), brass));
    const cup = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.025, 0], [0.04, 0.03], [0.03, 0.04], [0, 0.04]], 16), brass);
    cup.position.set(c * 0.46, -0.8, s * 0.46); g.add(cup);
    const globe = new THREE.Mesh(G.latheFromProfile([[0.022, 0], [0.05, 0.03], [0.065, 0.08], [0.055, 0.13], [0.03, 0.16], [0.035, 0.17]], 20), globeMat);
    globe.position.set(c * 0.46, -0.76, s * 0.46); g.add(globe); globes.push(globe);
  }
  // crystal drops
  const drop = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.018, 0), crystal, 30);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    m4.compose(new THREE.Vector3(Math.cos(a) * 0.3, -0.98 - (i % 2) * 0.03, Math.sin(a) * 0.3), new THREE.Quaternion(), new THREE.Vector3(1, 1.8, 1));
    drop.setMatrixAt(i, m4);
  }
  drop.castShadow = false;
  g.add(drop);
  g.userData = { globes, globeMat };
  return g;
}

/** Gas sconce (wall at -Z behind it, faces +Z). Returns group; light added by caller. */
export function buildSconce(ctx, { brass }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'sconce';
  const plate = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0], [0.05, 0.02], [0.02, 0.03], [0, 0.035]], 20), brass);
  plate.rotation.x = Math.PI / 2; g.add(plate);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0.02), new THREE.Vector3(0, -0.06, 0.1), new THREE.Vector3(0, 0.0, 0.18), new THREE.Vector3(0, 0.06, 0.2)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.008, 8), brass));
  const shade = new THREE.Mesh(G.latheFromProfile([[0.02, 0], [0.055, 0.03], [0.07, 0.09], [0.06, 0.14], [0.035, 0.16]], 20), new THREE.MeshStandardMaterial({ color: 0x241a10, emissive: new THREE.Color(1.0, 0.66, 0.36), emissiveIntensity: 1.5, roughness: 0.4, transparent: true, opacity: 0.94 }));
  shade.position.set(0, 0.06, 0.2); g.add(shade);
  return g;
}

/** Gramophone with a brass morning-glory horn on a small table. */
export function buildGramophone(ctx, { wood, brass }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'gramophone';
  // little round table
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 40), wood);
  top.position.y = 0.72; g.add(top);
  const ped = new THREE.Mesh(G.latheFromProfile([[0.0, 0], [0.2, 0], [0.18, 0.03], [0.05, 0.08], [0.035, 0.2], [0.05, 0.3], [0.03, 0.45], [0.05, 0.62], [0.08, 0.7], [0.0, 0.71]], 24), wood);
  g.add(ped);
  const box = new THREE.Mesh(new G.RoundedBoxGeometry(0.3, 0.13, 0.3, 2, 0.01), wood);
  box.position.y = 0.8; g.add(box);
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.01, 32), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3 }));
  plat.position.y = 0.87; g.add(plat);
  const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 6), brass);
  crank.rotation.z = Math.PI / 2; crank.position.set(0.19, 0.8, 0); g.add(crank);
  // tone arm + horn
  const arm = new THREE.CatmullRomCurve3([new THREE.Vector3(0.1, 0.88, -0.1), new THREE.Vector3(0.1, 0.98, -0.12), new THREE.Vector3(0.05, 1.05, -0.16)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(arm, 12, 0.012, 8), brass));
  const pts = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(0.012 + Math.pow(t, 3.2) * 0.26, t * 0.48)); }
  const horn = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), new THREE.MeshStandardMaterial({ color: 0xc89a48, metalness: 1, roughness: 0.28, side: THREE.DoubleSide }));
  horn.position.set(0.05, 1.05, -0.16);
  horn.rotation.x = -1.05;
  g.add(horn);
  return g;
}
