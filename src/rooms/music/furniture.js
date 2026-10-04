import * as THREE from 'three';
import { createFireSheet } from './fire.js';
import { logTextures, emberTexture, firebackTexture } from './textures.js';

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
  // the tablet's ormolu is its own darker, satin fire-gilt: lit only by the scene (the bright gilt
  // turned it into a glowing orange sign over the fire)
  gilt = new THREE.MeshStandardMaterial({ color: 0xb49a62, metalness: 1.0, roughness: 0.42, envMapIntensity: 0.5 });
  // frieze tablet: a carved marble panel with a gilt bead frame and a small gilt lyre
  const tablet = new THREE.Mesh(new G.RoundedBoxGeometry(0.42, 0.17, 0.03, 2, 0.008), marble);
  tablet.position.set(0, openH + 0.2, D * 0.55 + 0.012); g.add(tablet);
  const tFrame = new THREE.Mesh(G.frameGeometry(0.38, 0.14, { width: 0.014, depth: 0.016, uvScale: 2 }), gilt);
  tFrame.position.set(0, openH + 0.2, D * 0.55 + 0.028); g.add(tFrame);
  {
    const lyre = new THREE.Group();
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0045, 6, 18, Math.PI * 0.9), gilt);
      arm.position.set(s * 0.022, 0.0, 0); arm.rotation.z = s > 0 ? -0.2 : Math.PI * 0.1 + 0.2;
      lyre.add(arm);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), gilt);
      leaf.scale.set(2.4, 0.7, 0.5); leaf.position.set(s * 0.085, -0.01, 0); leaf.rotation.z = s * 0.4; lyre.add(leaf);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.006, 0.006), gilt); bar.position.y = 0.03; lyre.add(bar);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), gilt); foot.scale.set(1.4, 0.8, 0.6); foot.position.y = -0.03; lyre.add(foot);
    for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.058, 4), gilt); st.position.set(-0.012 + i * 0.008, 0.0, 0); lyre.add(st); }
    // carved relief round the lyre: C-scrolls with acanthus tips and a pair of husk garlands
    for (const s2 of [-1, 1]) {
      const sc = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0075, 10, 22, Math.PI * 1.55), gilt);
      sc.position.set(s2 * 0.105, 0.004, 0.004); sc.rotation.z = s2 > 0 ? -0.9 : Math.PI + 0.9; lyre.add(sc);
      const curl = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), gilt); curl.position.set(s2 * 0.118, -0.012, 0.006); lyre.add(curl);
      const pts = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3(s2 * (0.035 + 0.1 * t), 0.035 - 0.05 * Math.sin(t * Math.PI) - 0.005 * t, 0.006)); }
      lyre.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0042, 6), gilt));
      for (let k = 1; k < 6; k++) { const p = pts[k * 2]; const h = new THREE.Mesh(new THREE.SphereGeometry(0.0062, 8, 6), gilt); h.scale.set(1, 1.5, 0.8); h.position.copy(p).add(new THREE.Vector3(0, -0.004, 0.002)); lyre.add(h); }
    }
    lyre.scale.setScalar(1.35);
    lyre.position.set(0, openH + 0.2, D * 0.55 + 0.034); g.add(lyre);
  }
  // hearth slab
  const hearth = new THREE.Mesh(new G.RoundedBoxGeometry(W + 0.3, 0.05, 0.62, 2, 0.01), marble);
  hearth.position.set(0, 0.025, 0.31); g.add(hearth);
  // firebox: sooty cast-iron fireback with relief, splayed cheeks, a hearth of firebrick
  const fb = firebackTexture(ctx.textures);
  const ember = emberTexture(ctx.textures);
  const backMat = new THREE.MeshStandardMaterial({ map: fb.map, normalMap: fb.normalMap, roughness: 0.9, metalness: 0.2, emissiveMap: ember.map, emissive: new THREE.Color(1.0, 0.45, 0.15), emissiveIntensity: 0.16 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(openW * 0.86, openH), backMat);
  back.position.set(0, openH / 2, -0.26); g.add(back);
  const cheekMat = new THREE.MeshStandardMaterial({ map: fb.map, normalMap: fb.normalMap, roughness: 0.92, metalness: 0.15, color: 0x8a8580 });
  for (const sx of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.PlaneGeometry(0.3, openH), cheekMat);
    cheek.position.set(sx * openW * 0.43, openH / 2, -0.12); cheek.rotation.y = -sx * (Math.PI / 2 - 0.42); g.add(cheek);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(openW, 0.02, 0.4), iron);
  top.position.set(0, openH - 0.01, -0.05); g.add(top);
  const hearthIn = new THREE.Mesh(new THREE.PlaneGeometry(openW, 0.3), new THREE.MeshStandardMaterial({ color: 0x1a120e, roughness: 0.95 }));
  hearthIn.rotation.x = -Math.PI / 2; hearthIn.position.set(0, 0.052, -0.11); g.add(hearthIn);
  // basket grate: front bars with finials, side cheeks, bottom bars
  const grate = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6), iron);
    bar.position.set(-0.24 + i * 0.06, 0.13, 0.03); grate.add(bar);
  }
  for (const y of [0.06, 0.2]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.014, 0.018), iron); rail.position.set(0, y, 0.03); grate.add(rail); }
  for (const sx of [-1, 1]) {
    const fin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.018, 0], [0.012, 0.03], [0.02, 0.05], [0.0, 0.08]], 10), brass);
    fin.position.set(sx * 0.29, 0.2, 0.03); grate.add(fin);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.02), iron); leg.position.set(sx * 0.27, 0.02, 0.03); grate.add(leg);
  }
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.01, 0.26), iron); b.position.set(-0.25 + i * 0.1, 0.06, -0.09); grate.add(b); }
  grate.position.set(0, 0.0, 0.0); g.add(grate);
  // ember bed: a glowing mat of coals under and behind the logs
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 1, emissiveMap: ember.map, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1.6 });
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.3, 12, 8), bedMat);
  { const p = bed.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, 0.015 * Math.sin(p.getX(i) * 40) * Math.cos(p.getY(i) * 30)); bed.geometry.computeVertexNormals(); }
  bed.rotation.x = -Math.PI / 2; bed.position.set(0, 0.075, -0.1); bed.userData.noBake = true; g.add(bed);
  // coals: two populations — glowing and burnt-out — heaped under and behind the logs
  const rnd = ctx.random.fork('coals');
  const coalGeo = new THREE.DodecahedronGeometry(0.03, 0);
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x140b06, roughness: 0.9, emissive: new THREE.Color(1.0, 0.36, 0.08), emissiveIntensity: 1.4 });
  const ashMat = new THREE.MeshStandardMaterial({ color: 0x1c1816, roughness: 0.95, emissive: new THREE.Color(0.6, 0.12, 0.02), emissiveIntensity: 0.25 });
  const NC = 70;
  const coals = new THREE.InstancedMesh(coalGeo, coalMat, NC);
  const ash = new THREE.InstancedMesh(coalGeo, ashMat, NC);
  const m4 = new THREE.Matrix4();
  let ci = 0, ai = 0;
  for (let i = 0; i < NC * 2; i++) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd.next() * 3, rnd.next() * 3, rnd.next() * 3));
    const sc = (0.45 + rnd.next() * 0.5) * 0.6 / 0.6;
    const x = (rnd.next() - 0.5) * 0.5, z = -0.21 + rnd.next() * 0.2;
    const heap = 1 - Math.abs(x) / 0.28;
    const y = 0.07 + rnd.next() * 0.05 * heap + (z < -0.12 ? 0.03 : 0);
    m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sc, sc * 0.75, sc));
    const hot = rnd.next() < 0.35 + 0.5 * heap * (z > -0.15 ? 1 : 0.6);
    if (hot && ci < NC) coals.setMatrixAt(ci++, m4); else if (ai < NC) ash.setMatrixAt(ai++, m4);
  }
  coals.count = ci; ash.count = ai;
  coals.userData.noBake = true; ash.userData.noBake = true;
  g.add(coals, ash);
  // logs: charred bark with glowing cracks, two crossed + one at the back
  const lt = logTextures(ctx.textures);
  const logMat = new THREE.MeshStandardMaterial({ map: lt.bark.map, normalMap: lt.bark.normalMap, roughness: 0.95, emissiveMap: lt.glow.map, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1.8 });
  const endMat = new THREE.MeshStandardMaterial({ color: 0x1a0d06, roughness: 0.9, emissive: new THREE.Color(1.0, 0.3, 0.05), emissiveIntensity: 0.6 });
  for (const [x, y, z, ry, len, r] of [[-0.05, 0.16, -0.06, 0.28, 0.5, 0.055], [0.07, 0.17, -0.12, -0.32, 0.46, 0.06], [0.0, 0.22, -0.19, 0.04, 0.52, 0.05]]) {
    const geo = new THREE.CylinderGeometry(r * 0.92, r, len, 14, 6);
    { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.08 * Math.sin(a * 5 + p.getY(i) * 20) + 0.04 * Math.sin(a * 11); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } geo.computeVertexNormals(); }
    const log = new THREE.Mesh(geo, [logMat, endMat, endMat]);
    log.rotation.z = Math.PI / 2; log.rotation.y = ry; log.position.set(x, y, z); log.userData.noBake = true; g.add(log);
  }
  // flames: a few tongue sheets licking up between the logs (+ small licks), leaning back
  const flames = [];
  for (const [x, z, w, h, sd, k] of [[-0.02, -0.07, 0.5, 0.48, 3, 1.6], [0.07, -0.17, 0.46, 0.56, 9, 1.25], [-0.13, -0.13, 0.26, 0.36, 17, 1.1], [0.15, -0.1, 0.22, 0.3, 23, 1.0], [0.0, -0.21, 0.52, 0.42, 31, 0.8]]) {
    const f = createFireSheet(ctx, { width: w, height: h, seed: sd, intensity: k, tongues: 4 + (sd % 3) });
    f.position.set(x, 0.1, z); f.rotation.x = -0.12;
    g.add(f); flames.push(f);
  }
  // brass fender + fire irons
  const fender = new THREE.Mesh(G.sweepProfile([[0, 0], [0.01, 0], [0.012, 0.04], [0.006, 0.07], [0.012, 0.08], [0, 0.085]].map(([x, y]) => new THREE.Vector2(x, y)),
    [new THREE.Vector3(-0.62, 0.05, 0.0), new THREE.Vector3(-0.62, 0.05, 0.52), new THREE.Vector3(0.62, 0.05, 0.52), new THREE.Vector3(0.62, 0.05, 0.0)], { uvScale: 2 }), brass);
  g.add(fender);
  // companion set: a weighted stand (round foot, turned stem, a crossbar with hooks) holding a poker,
  // a shovel and tongs; blackened iron shafts, turned brass handles with ball finials
  {
    const set = new THREE.Group();
    const blk = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.55, metalness: 0.7 });
    set.add(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.09, 0], [0.095, 0.01], [0.08, 0.02], [0.03, 0.035], [0.014, 0.05], [0, 0.05]], 24), brass));
    const stem = new THREE.Mesh(G.latheFromProfile([[0.009, 0], [0.009, 0.55], [0.016, 0.57], [0.01, 0.6], [0.014, 0.62], [0, 0.66]], 12), brass);
    stem.position.y = 0.04; set.add(stem);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 8), brass); bar.rotation.z = Math.PI / 2; bar.position.y = 0.6; set.add(bar);
    const tools = [];
    const handle = () => G.latheFromProfile([[0.0, 0], [0.008, 0], [0.012, 0.02], [0.009, 0.05], [0.013, 0.08], [0.011, 0.1], [0.018, 0.115], [0.0, 0.135]], 12);
    for (const [k, x] of [[0, -0.06], [1, 0.0], [2, 0.06]]) {
      const t = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.5, 8), blk); shaft.position.y = 0.3; t.add(shaft);
      const h = new THREE.Mesh(handle(), brass); h.position.y = 0.55; t.add(h);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0025, 6, 12), brass); ring.position.y = 0.56; t.add(ring);
      if (k === 0) {   // poker: a point and a side hook
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.05, 8), blk); tip.rotation.x = Math.PI; tip.position.y = 0.03; t.add(tip);
        const hook = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI), blk); hook.position.set(0.018, 0.08, 0); hook.rotation.z = Math.PI; t.add(hook);
      } else if (k === 1) {   // shovel: a dished blade
        const blade = new THREE.Mesh(new G.RoundedBoxGeometry(0.1, 0.12, 0.006, 2, 0.003), blk); blade.position.y = 0.0; blade.rotation.x = 0.15; t.add(blade);
        const lip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.004, 0.025), blk); lip.position.set(0, -0.055, 0.012); t.add(lip);
      } else {   // tongs: two legs hinged under the handle, claw tips
        for (const sx of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.48, 6), blk); leg.position.set(sx * 0.012, 0.29, 0); leg.rotation.z = sx * 0.03; t.add(leg);
          const claw = new THREE.Mesh(new G.RoundedBoxGeometry(0.022, 0.03, 0.008, 2, 0.003), blk); claw.position.set(sx * 0.02, 0.04, 0); t.add(claw);
        }
      }
      t.position.set(x, 0.06, 0.02); t.rotation.z = -x * 0.25;
      set.add(t); tools.push(t);
    }
    set.position.set(0.78, 0.05, 0.4); set.rotation.y = -0.4;
    g.add(set);
  }
  g.userData = { flames, coals, coalMat, bedMat, logMat, backMat, opening: { w: openW, h: openH } };
  return g;
}

/** Five-light floor candelabrum (torchère), ~1.75 m. Returns group + candle list. */
export function buildTorchere(ctx, { brass, seed = 11 }) {
  const { geometry: G, fx } = ctx;
  const g = new THREE.Group();
  g.name = 'torchere';
  // the domed foot is dulled, tarnished brass (a polished dish right under five flames mirrored them
  // as a hot spot on the rug)
  const footBrass = brass.clone();
  footBrass.roughness = 1.6; footBrass.envMapIntensity = 0.5;
  if (footBrass.color) footBrass.color.multiplyScalar(0.7);
  const base = new THREE.Mesh(G.latheFromProfile([[0.0, 0], [0.16, 0], [0.16, 0.015], [0.12, 0.035], [0.06, 0.06], [0.045, 0.1], [0.06, 0.14], [0.03, 0.2], [0.0, 0.2]], 28), footBrass);
  g.add(base);
  const stem = new THREE.Mesh(G.latheFromProfile([
    [0.0, 0.2], [0.03, 0.2], [0.022, 0.5], [0.035, 0.55], [0.024, 0.6],
    [0.02, 1.2], [0.04, 1.25], [0.03, 1.3], [0.05, 1.36], [0.02, 1.4], [0.0, 1.41],
  ], 28), brass);
  g.add(stem);
  // tripod feet
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), footBrass);
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
/**
 * Victorian balloon-back side chair: a moulded rail swept round a pinched balloon (narrow at the
 * waist, a carved crest at the top), a carved cross-splat with a central boss, sabre back legs
 * that run up into the stiles, turned front legs, a serpentine seat rail and a stuffed velvet seat
 * with a domed cushion and a row of brass nailheads. Origin on the floor, seat front toward +Z.
 */
export function buildChair(ctx, { wood, velvet }) {
  const { geometry: G } = ctx;
  const V2 = (x, y) => new THREE.Vector2(x, y), V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const g = new THREE.Group();
  g.name = 'chair';
  const SEAT_Y = 0.44, BACK_Z = -0.2;
  const brassNail = new THREE.MeshStandardMaterial({ color: 0xb08a48, metalness: 1, roughness: 0.35 });
  // moulded cross-section (width in the plane of the back, depth front-to-back): a rounded rail with
  // a raised bead along its face, so the rim light traces two lines
  const rail = (w, d) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      let x = Math.cos(a) * w / 2, y = Math.sin(a) * d / 2;
      if (y > 0) y += d * 0.18 * Math.exp(-((x / (w * 0.18)) ** 2));   // bead on the front face
      pts.push(V2(x, y));
    }
    return pts;
  };
  // ---- the balloon: a smooth closed-top curve from stile to stile, pinched at the waist
  const half = [[0.185, 0.0], [0.178, 0.1], [0.15, 0.17], [0.128, 0.215], [0.14, 0.27], [0.175, 0.34], [0.19, 0.41], [0.178, 0.47], [0.14, 0.515], [0.08, 0.542], [0.0, 0.552]];
  const ctrl = [...half.map(([x, y]) => V3(-x, y, 0)), ...half.slice(0, -1).reverse().map(([x, y]) => V3(x, y, 0))];
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const pts = curve.getPoints(90);
  const back = new THREE.Group();
  back.position.set(0, SEAT_Y + 0.05, BACK_Z); back.rotation.x = -0.12;
  back.add(new THREE.Mesh(G.sweepProfile(rail(0.034, 0.026), pts, { up: V3(0, 0, 1), uvScale: 2 }), wood));
  // inner bead following the loop above the splat
  const innerPts = curve.getPoints(90).filter((p) => p.y > 0.25).map((p) => V3(p.x * 0.84, 0.25 + (p.y - 0.25) * 0.86, 0.004));
  back.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(innerPts), 80, 0.0045, 6), wood));
  // carved cross-splat at the waist: a shallow S-scrolled rail with a central oval boss and leaf carving
  {
    const sp = [];
    for (let i = 0; i <= 30; i++) { const t = i / 30, x = -0.13 + 0.26 * t; sp.push(V3(x, 0.215 + 0.018 * Math.cos(t * Math.PI * 2) - 0.012 * Math.sin(t * Math.PI), 0.002)); }
    back.add(new THREE.Mesh(G.sweepProfile(rail(0.028, 0.022), sp, { up: V3(0, 0, 1), uvScale: 2 }), wood));
    const boss = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.034, 0], [0.032, 0.006], [0.024, 0.012], [0.012, 0.016], [0, 0.017]], 24), wood);
    boss.rotation.x = Math.PI / 2; boss.scale.set(1.25, 1, 0.85); boss.position.set(0, 0.205, 0.008); back.add(boss);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 6), wood);
      leaf.scale.set(1.9, 0.55, 0.55); leaf.rotation.z = s * (0.35 + k * 0.35);
      leaf.position.set(s * (0.045 + k * 0.022), 0.21 + 0.008 * Math.sin(k), 0.012); back.add(leaf);
    }
  }
  // carved crest at the top of the balloon: a shell-and-leaf cartouche
  {
    const crest = new THREE.Group();
    const shell = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.04, 0], [0.036, 0.01], [0.022, 0.018], [0, 0.021]], 20, ), wood);
    { const p = shell.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.12 * Math.cos(a * 9); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } shell.geometry.computeVertexNormals(); }
    shell.rotation.x = Math.PI / 2; shell.scale.set(1, 1, 0.7); crest.add(shell);
    for (const s of [-1, 1]) {
      const sc = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0055, 8, 18, Math.PI * 1.5), wood);
      sc.position.set(s * 0.05, -0.006, 0.0); sc.rotation.z = s > 0 ? -0.6 : Math.PI + 0.6; crest.add(sc);
    }
    crest.position.set(0, 0.548, 0.012); back.add(crest);
  }
  g.add(back);
  // ---- sabre back legs sweeping up into the stiles
  for (const s of [-1, 1]) {
    const path = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; const y = t * (SEAT_Y + 0.06); path.push(V3(s * (0.185 + 0.012 * (1 - t)), y, BACK_Z - 0.07 * Math.pow(1 - t, 1.6) + 0.004)); }
    g.add(new THREE.Mesh(G.sweepProfile(rail(0.03, 0.03), path, { up: V3(1, 0, 0), uvScale: 2 }), wood));
  }
  // ---- turned front legs: vase, rings, a tapering shaft, a peg foot on a brass castor
  const legGeo = G.latheFromProfile([[0.0, 0], [0.016, 0], [0.016, 0.012], [0.011, 0.02], [0.014, 0.03], [0.012, 0.09], [0.017, 0.18], [0.02, 0.24], [0.016, 0.28], [0.022, 0.3], [0.016, 0.315], [0.02, 0.33], [0.024, 0.37], [0.024, 0.405], [0.0, 0.41]], 20);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, wood); leg.position.set(s * 0.2, 0.012, 0.19); g.add(leg);
    const cast = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 12), brassNail); cast.position.set(s * 0.2, 0.006, 0.19); g.add(cast);
  }
  // ---- seat rail: serpentine front, moulded apron
  const railPath = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20, x = -0.22 + 0.44 * t; railPath.push(V3(x, SEAT_Y - 0.035, 0.205 + 0.018 * Math.sin(t * Math.PI))); }
  const loopRail = [V3(-0.205, SEAT_Y - 0.035, BACK_Z + 0.01), ...railPath, V3(0.205, SEAT_Y - 0.035, BACK_Z + 0.01)];
  g.add(new THREE.Mesh(G.sweepProfile([V2(0, -0.035), V2(0.012, -0.035), V2(0.018, -0.022), V2(0.012, -0.01), V2(0.016, 0.02), V2(0.008, 0.035), V2(0, 0.035)], loopRail, { closed: true, uvScale: 2 }), wood));
  // ---- the stuffed seat: a domed, serpentine-fronted cushion in velvet
  {
    const sg = new G.RoundedBoxGeometry(0.44, 0.07, 0.42, 6, 0.03);
    const p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const u = x / 0.22, v = z / 0.21;
      const dome = Math.max(0, 1 - Math.pow(Math.abs(u), 3)) * Math.max(0, 1 - Math.pow(Math.abs(v), 3));
      if (y > 0) p.setY(i, y + dome * 0.035);
      if (z > 0.1) p.setZ(i, z + 0.018 * Math.cos(u * Math.PI / 2) * (z / 0.21));           // serpentine front
      p.setX(i, x * (1 - 0.06 * (0.5 - z / 0.42)));                                          // narrower at the back
    }
    sg.computeVertexNormals();
    const seat = new THREE.Mesh(sg, velvet);
    seat.position.set(0, SEAT_Y + 0.03, 0.0); g.add(seat);
    // brass nailheads along the bottom edge of the upholstery
    const nails = [];
    for (let i = 0; i <= 30; i++) { const t = i / 30, x = -0.21 + 0.42 * t; nails.push(V3(x, SEAT_Y + 0.004, 0.214 + 0.018 * Math.sin(t * Math.PI))); }
    for (const s of [-1, 1]) for (let i = 1; i < 14; i++) nails.push(V3(s * 0.222, SEAT_Y + 0.004, 0.2 - i * 0.029));
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0042, 8, 6), brassNail, nails.length);
    const m4 = new THREE.Matrix4();
    nails.forEach((pp, i) => { m4.makeTranslation(pp.x, pp.y, pp.z); im.setMatrixAt(i, m4); });
    g.add(im);
  }
  return g;
}

/** Crystal gasolier: chain, turned brass column, two tiers of scrolled arms with etched
 *  globes, festoons of cut-crystal drops. Origin at the ceiling. userData.lightY = light height. */
export function buildGasolier(ctx, { brass, crystal }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'gasolier';
  const DROP = 1.0;           // chain length below the canopy
  const rose = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.14, 0], [0.13, -0.02], [0.09, -0.04], [0.05, -0.07], [0.02, -0.1], [0.0, -0.11]], 28), brass);
  g.add(rose);
  // chain of alternating links
  const linkA = new THREE.TorusGeometry(0.018, 0.0045, 6, 14);
  const NL = Math.round(DROP / 0.03);
  const links = new THREE.InstancedMesh(linkA, brass, NL);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < NL; i++) {
    q.setFromEuler(new THREE.Euler(0, (i % 2) * Math.PI / 2, Math.PI / 2));
    m4.compose(new THREE.Vector3(0, -0.11 - i * 0.03, 0), q, new THREE.Vector3(1, 1.4, 1));
    links.setMatrixAt(i, m4);
  }
  links.castShadow = false;
  g.add(links);
  const y0 = -0.11 - DROP;
  const body = new THREE.Mesh(G.latheFromProfile([
    [0, 0], [0.03, -0.01], [0.05, -0.04], [0.035, -0.08], [0.06, -0.12], [0.1, -0.17], [0.13, -0.2], [0.1, -0.23], [0.05, -0.25], [0.07, -0.3],
    [0.04, -0.34], [0.05, -0.38], [0.02, -0.44], [0.035, -0.5], [0, -0.56]], 32), brass);
  body.position.y = y0; g.add(body);
  const globes = [];
  const globeMat = new THREE.MeshPhysicalMaterial({ color: 0xfff2dc, emissive: new THREE.Color(1.0, 0.74, 0.45), emissiveIntensity: 0.2, roughness: 0.55, transmission: 0, transparent: true, opacity: 0.96 });
  const cupProf = [[0, 0], [0.022, 0], [0.04, 0.025], [0.045, 0.035], [0.03, 0.04], [0, 0.04]];
  const globeProf = [[0.024, 0], [0.05, 0.025], [0.066, 0.07], [0.06, 0.12], [0.038, 0.155], [0.04, 0.165], [0.036, 0.17]];
  const tier = (n, r, yArm, yTip, rot, scale) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rot;
      const c = Math.cos(a), s2 = Math.sin(a);
      const P = (rr, yy) => new THREE.Vector3(c * rr, y0 + yy, s2 * rr);
      const curve = new THREE.CatmullRomCurve3([P(0.05, yArm), P(r * 0.35, yArm - 0.1), P(r * 0.75, yArm - 0.07), P(r, yTip - 0.04), P(r, yTip)]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.009 * scale, 8), brass));
      // C-scroll under each arm
      const sc = new THREE.Mesh(new THREE.TorusGeometry(0.035 * scale, 0.005, 6, 16, Math.PI * 1.5), brass);
      sc.position.copy(P(r * 0.45, yArm - 0.13)); sc.rotation.y = -a; g.add(sc);
      const cup = new THREE.Mesh(G.latheFromProfile(cupProf, 16), brass);
      cup.position.copy(P(r, yTip)); cup.scale.setScalar(scale); g.add(cup);
      const globe = new THREE.Mesh(G.latheFromProfile(globeProf, 24), globeMat);
      globe.position.copy(P(r, yTip + 0.035 * scale)); globe.scale.setScalar(scale); g.add(globe); globes.push(globe);
    }
  };
  tier(6, 0.5, -0.3, -0.22, 0, 1.0);
  tier(6, 0.27, -0.13, -0.02, Math.PI / 6, 0.75);
  // festoons of crystal drops between the lower arms + a pendant drop under the bowl
  const drops = [];
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2, a1 = ((i + 1) / 6) * Math.PI * 2;
    for (let k = 1; k < 10; k++) {
      const t = k / 10; const a = a0 + (a1 - a0) * t;
      const sag = Math.sin(t * Math.PI) * 0.09;
      drops.push(new THREE.Vector3(Math.cos(a) * 0.46, y0 - 0.25 - sag, Math.sin(a) * 0.46));
    }
    for (let k = 0; k < 4; k++) drops.push(new THREE.Vector3(Math.cos(a0) * 0.5, y0 - 0.27 - k * 0.035, Math.sin(a0) * 0.5));
  }
  for (let k = 0; k < 6; k++) drops.push(new THREE.Vector3(0, y0 - 0.58 - k * 0.04, 0));
  const drop = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.014, 0), crystal, drops.length);
  drops.forEach((p, i) => { m4.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i * 0.7, 0)), new THREE.Vector3(1, 1.7, 1)); drop.setMatrixAt(i, m4); });
  drop.castShadow = false;
  g.add(drop);
  g.userData = { globes, globeMat, lightY: y0 - 0.12 };
  return g;
}

/** Gas sconce (wall at -Z behind it, faces +Z). Returns group; light added by caller.
 *  A cast-brass back-plate and swan-neck arm carry a gas cock and a tulip of frosted, acid-etched
 *  glass (a smooth 64-segment lathe with real wall thickness), a small gas flame burning inside
 *  it; a soft IES-style scallop of light fans up and down the wallpaper behind. */
export function buildSconce(ctx, { brass }) {
  const { geometry: G } = ctx;
  const g = new THREE.Group();
  g.name = 'sconce';
  const plate = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.062, 0], [0.06, 0.008], [0.048, 0.018], [0.05, 0.024], [0.03, 0.03], [0.018, 0.04], [0, 0.042]], 32), brass);
  plate.rotation.x = Math.PI / 2; g.add(plate);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0.03), new THREE.Vector3(0, -0.07, 0.1), new THREE.Vector3(0, -0.02, 0.18), new THREE.Vector3(0, 0.04, 0.2)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0075, 10), brass));
  // gas cock + gallery ring that holds the glass
  const cock = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0], [0.014, 0.012], [0.01, 0.02], [0.016, 0.03], [0, 0.034]], 16), brass);
  cock.position.set(0, 0.035, 0.2); g.add(cock);
  const gallery = new THREE.Mesh(G.latheFromProfile([[0.02, 0], [0.034, 0.004], [0.036, 0.016], [0.03, 0.02], [0.028, 0.012], [0.018, 0.008]], 48), brass);
  gallery.position.set(0, 0.062, 0.2); g.add(gallery);
  // frosted tulip: outer and inner skins (3 mm glass), scalloped rim
  const etch = ctx.textures.canvas('music:sconce-etch', 256, 128, (c, w, h) => {
    c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ffffff'; c.lineWidth = 2.2;
    for (let i = 0; i < 12; i++) {                         // etched festoons and a fern band
      const x = (i / 12) * w;
      c.beginPath(); c.arc(x + w / 24, h * 0.42, w / 26, 0, Math.PI); c.stroke();
      c.beginPath(); c.moveTo(x + w / 24, h * 0.55); c.lineTo(x + w / 24, h * 0.85); c.stroke();
      for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x + w / 24, h * (0.6 + k * 0.06)); c.lineTo(x + w / 24 + 5, h * (0.57 + k * 0.06)); c.moveTo(x + w / 24, h * (0.6 + k * 0.06)); c.lineTo(x + w / 24 - 5, h * (0.57 + k * 0.06)); c.stroke(); }
    }
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(0, h * 0.18, w, 3); c.fillRect(0, h * 0.92, w, 3);
  });
  etch.wrapS = THREE.RepeatWrapping;
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = 0.022 + 0.05 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.62) - 0.012 * Math.max(0, t - 0.8) / 0.2 + (t > 0.96 ? 0.006 : 0);
    prof.push([r, t * 0.15]);
  }
  const outer = G.latheFromProfile(prof, 64);
  const inner = G.latheFromProfile(prof.map(([r, y]) => [Math.max(0.001, r - 0.003), y + 0.001]).reverse(), 64);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a2018, roughness: 0.5, metalness: 0, transparent: true, opacity: 0.92, side: THREE.DoubleSide,   // (dark albedo: it glows by its own flame, not by the room light hitting it)
    emissive: new THREE.Color(1.0, 0.68, 0.4), emissiveMap: etch, emissiveIntensity: 0.85, clearcoat: 0.6, clearcoatRoughness: 0.15, depthWrite: false,
  });
  glassMat.userData.noBake = true;
  const shade = new THREE.Group();
  const o = new THREE.Mesh(outer, glassMat); o.renderOrder = 3; shade.add(o);
  const iMesh = new THREE.Mesh(inner, glassMat); iMesh.renderOrder = 2; shade.add(iMesh);
  shade.position.set(0, 0.072, 0.2); g.add(shade);
  // the gas flame inside: a small bright teardrop (it blooms through the frosting)
  const flame = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.007, 0.006], [0.009, 0.016], [0.006, 0.028], [0, 0.04]], 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.95, 0.4), toneMapped: false }));
  flame.position.set(0, 0.09, 0.2); g.add(flame);
  // IES-like scallops on the wall: a fan of light up and a shorter one down, additive
  const fan = ctx.textures.canvas('music:sconce-scallop', 128, 256, (c, w, h) => {
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = (x / w - 0.5) * 2, v = 1 - y / h;                   // v: 0 bottom .. 1 top, source at v = 0.42
      const dy = v - 0.42;
      const spread = dy > 0 ? 0.12 + dy * 1.25 : 0.12 - dy * 0.9;
      const across = Math.exp(-((u / spread) ** 2) * 1.6);
      const along = dy > 0 ? Math.exp(-dy * 5.5) * (1 - Math.exp(-dy * 30)) : 0.8 * Math.exp(dy * 8.0) * (1 - Math.exp(dy * 40));
      const edge = 1 + 0.6 * Math.exp(-(((Math.abs(u) - spread * 0.9) / 0.05) ** 2)) * (dy > 0 ? 1 : 0.5);   // brighter scallop rim
      const core = 0.9 * Math.exp(-((u * u + dy * dy * 4) / 0.004));
      const ss = (e0, e1, t) => { const k = Math.max(0, Math.min(1, (t - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
      const a = Math.min(1, across * along * edge * 0.75 + core) * ss(1.0, 0.8, v) * ss(0.0, 0.12, v) * ss(1.0, 0.75, Math.abs(u));
      const k = (y * w + x) * 4;
      img.data[k] = 255; img.data[k + 1] = 190; img.data[k + 2] = 120; img.data[k + 3] = Math.round(a * 255);
    }
    c.putImageData(img, 0, 0);
  }, { tile: false });
  const fanMat = new THREE.MeshBasicMaterial({ map: fan, color: new THREE.Color(0.7, 0.52, 0.36), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: true, polygonOffset: true, polygonOffsetFactor: -4 });
  const fanMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.1), fanMat);
  fanMesh.position.set(0, 0.11 - 0.42 * 1.1 + 0.55, 0.004); fanMesh.renderOrder = 1; fanMesh.userData.noBake = true;
  g.add(fanMesh);
  g.userData.flame = flame;
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
