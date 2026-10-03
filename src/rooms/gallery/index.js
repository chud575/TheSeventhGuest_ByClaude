import * as THREE from 'three';
import { mergeStatic } from '../../engine/lib/contrib/foyer-merge.js';
import { flicker } from '../../engine/fx/index.js';
import { X0, X1, Z0, Z1, H, DADO, BAYS, BAY_CENTERS, DOORS, ARCH, WIN, PUZZLE, PIL } from './layout.js';
import { buildShell, buildWindow, buildLanding, makeDoor, mount } from './architecture.js';
import { makeSconce, makeFramed, makeClock, makeConsole, makeBench, makePlaque, makeLantern } from './props.js';
import { runnerTexture, nightSky } from './textures.js';
import { makePortraitMaterial, createGaze } from './portraits.js';
import { createSlidePuzzle, meta as slideMeta, SLIDE_ID } from './puzzleSlide.js';

/**
 * The Upstairs Gallery — a long, narrow portrait hall on the upper floor.
 *
 * Five bays divided by fluted mahogany pilasters and plaster cross-beams recede
 * toward a tall arched window where the moon pours in along a crimson runner.
 * Gas sconces hiss on every pilaster. The family on the walls watch you pass —
 * literally: their eyes follow the camera. Doors lead to the bedroom and the game
 * room; a narrow door at the far end hides the attic stair, latched until the
 * Toymaker's sliding-tile likeness (the room's puzzle) is made whole.
 *
 * Axes: hall runs along Z, near end (stair landing arch) at z = +8, window at z = -9.
 */

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export default {
  id: 'gallery',
  title: 'The Portrait Gallery',
  floorName: 'Upper Floor',
  map: { floor: 'upper', rect: [380, 120, 240, 90] },
  start: 'main',
  ambience: { wind: 0.5, creaks: 0.7, clock: 0.25, thunder: 0.3, rain: 0, heartbeat: 0.1, roomTone: 0.35 },
  music: { mood: 'dread' },
  puzzles: [slideMeta],

  async build(ctx) {
    const { materials: M, fx } = ctx;
    const root = new THREE.Group();
    root.name = 'gallery';
    const hiTex = ctx.quality.textureSize >= 2048 ? 2048 : 1024;

    // ================================================================ materials
    const mat = {
      wall: M.create('damask', { base: [0.06, 0.1, 0.3], motif: [0.1, 0.15, 0.38], accent: [0.5, 0.4, 0.22], accentStrength: 0.12, sheen: 0.7, aging: 0.45, variant: 0, normalScale: 0.45, repeat: [1 / 0.46, 1 / 0.46], size: hiTex }),
      floor: M.create('floorboards', { species: 'walnut', boards: 6, boardLength: 0.5, polish: 0.85, wear: 0.45, tint: [0.62, 0.52, 0.46], repeat: [1 / 3.2, 1 / 1.0] }),
      ceiling: M.create('plaster', { color: [0.2, 0.23, 0.32], cracks: 0.3, stains: 0.45, repeat: [0.45, 0.45] }),
      beam: M.create('plaster', { color: [0.24, 0.27, 0.36], cracks: 0.15, stains: 0.3, repeat: [0.8, 0.8] }),
      plasterLight: M.create('plaster', { color: [0.42, 0.44, 0.5], cracks: 0.3, stains: 0.4, repeat: [0.8, 0.8] }),
      wainscot: M.create('wood', { species: 'mahogany', boards: 0, polish: 0.75, figure: 0.7, tint: [0.62, 0.5, 0.46], repeat: [1.3, 1.3], clearcoat: 0.5, clearcoatRoughness: 0.25 }),
      pilasterWood: M.create('wood', { species: 'mahogany', boards: 0, polish: 0.8, figure: 0.4, tint: [0.6, 0.48, 0.44], repeat: [2.2, 0.6], rotation: Math.PI / 2, clearcoat: 0.55, clearcoatRoughness: 0.2 }),
      doorWood: M.create('wood', { species: 'rosewood', boards: 0, polish: 0.8, figure: 0.8, tint: [0.75, 0.62, 0.58], repeat: [1.1, 1.1], clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      mahogany: M.create('mahogany', { repeat: [1.5, 1.5], color: new THREE.Color(0.62, 0.5, 0.48) }),
      crownGilt: M.create('gilded', { pattern: 0, repeats: 4, wear: 0.5, dirt: 0.65, repeat: [1 / 0.45, 1] }),
      capitalGilt: M.create('gilded', { pattern: 0, repeats: 4, wear: 0.4, dirt: 0.6, repeat: [1 / 0.2, 1 / 0.07] }),
      frieze: M.create('gilded', { pattern: 6, repeats: 3, ground: 1, groundColor: [0.03, 0.04, 0.09], wear: 0.35, dirt: 0.55, repeat: [1 / 0.7, 1] }),
      doorFrieze: M.create('gilded', { pattern: 1, repeats: 3, ground: 1, groundColor: [0.12, 0.04, 0.03], wear: 0.4, dirt: 0.6, repeat: [1 / 0.4, 1] }),
      soffit: M.create('gilded', { pattern: 2, repeats: 4, ground: 1, groundColor: [0.05, 0.06, 0.12], wear: 0.4, dirt: 0.6, repeat: [1 / 0.9, 1] }),
      giltFrame: M.create('gilded', { pattern: 1, repeats: 3, wear: 0.45, dirt: 0.7, repeat: [1 / 0.4, 1] }),
      giltPlain: M.create('gold', { wear: 0.5, dirt: 0.55, repeat: [2, 1] }),
      giltCap: M.create('gold', { wear: 0.3, dirt: 0.4, repeat: [3, 3] }),
      brass: M.create('brass', { tarnish: 0.4, polish: 0.7, repeat: [3, 3] }),
      brassBright: M.create('brass', { tarnish: 0.1, polish: 0.95, repeat: [3, 3] }),
      velvet: M.create('velvet', { color: [0.05, 0.08, 0.24], crush: 0.55, repeat: [2, 2], side: THREE.DoubleSide }),
      velvetSeat: M.create('velvet', { color: [0.3, 0.04, 0.06], crush: 0.4, repeat: [3, 3] }),
      marble: M.create('marble', { type: 'nero', polish: 0.8, repeat: [1, 1] }),
      glass: M.create('glass', { dirt: 0.55, transparent: true, opacity: 0.12 }),
      black: M.basic('black', { color: 0x020203, roughness: 0.9 }),
      windowFrame: M.basic('black', { color: 0x110c0a, roughness: 0.55 }),
      cord: M.basic('black', { color: 0x3a2a12, roughness: 0.8 }),
      porcelainBlue: M.basic('porcelain', { color: 0xc8d2ec }),
      stem: M.basic('black', { color: 0x1a1a0e, roughness: 0.9 }),
      rose: M.basic('black', { color: 0x3a0c10, roughness: 0.85 }),
      shade: new THREE.MeshStandardMaterial({ color: 0x3a2610, emissive: new THREE.Color(1.0, 0.55, 0.24), emissiveIntensity: 1.3, roughness: 0.35, transparent: true, opacity: 0.92, name: 'sconceShade' }),
      lanternGlass: new THREE.MeshStandardMaterial({ color: 0x302010, emissive: new THREE.Color(1.0, 0.6, 0.28), emissiveIntensity: 0.55, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false, name: 'lanternGlass' }),
    };
    const skyTex = nightSky(ctx);
    mat.sky = new THREE.MeshBasicMaterial({ map: skyTex.map, color: new THREE.Color(1, 1, 1).multiplyScalar(3.4), toneMapped: false, name: 'sky' });
    const runnerSet = runnerTexture(ctx);
    const RUN_W = 1.05;
    const runRep = runnerSet.withRepeat(1, 1);
    mat.runner = new THREE.MeshPhysicalMaterial({ map: runRep.map, normalMap: runRep.normalMap, roughnessMap: runRep.ormMap, aoMap: runRep.ormMap, roughness: 1, metalness: 0, sheen: 0.7, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.7, 0.3, 0.28), envMapIntensity: 0.4, name: 'runner' });

    // ================================================================ architecture
    buildShell(ctx, root, mat);
    const winInfo = buildWindow(ctx, root, mat);
    buildLanding(ctx, root, mat);

    // runner carpet down the centre of the hall (metre UVs, one medallion per RUN_W)
    {
      const len = (Z1 + 0.9) - (Z0 + 0.55);
      const g = new THREE.PlaneGeometry(RUN_W, len);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i) * len / RUN_W);
      g.rotateX(-Math.PI / 2);
      const run = new THREE.Mesh(g, mat.runner);
      run.position.set(0, 0.007, (Z1 + 0.9 + Z0 + 0.55) / 2);
      run.name = 'runner';
      root.add(run);
      // brass stair-rod style edge pins every metre (tiny but they catch the light)
      const pinGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.004, 8);
      const n = Math.floor(len / 0.9);
      const pins = new THREE.InstancedMesh(pinGeo, mat.brass, n * 2);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) for (const s of [-1, 1]) { m4.makeTranslation(s * (RUN_W / 2 - 0.012), 0.009, Z0 + 0.9 + i * 0.9); pins.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m4); }
      root.add(pins);
    }

    // ================================================================ doors
    const doors = {};
    for (const [name, d] of Object.entries(DOORS)) {
      const door = makeDoor(ctx, mat, { w: d.w, h: d.h, name, open: 0 });
      mount(door, d.side, d.z, 0, 0);
      root.add(door);
      doors[name] = door;
    }
    const atticHinge = doors.attic.userData.hinge;

    // ================================================================ sconces (one on every pilaster face)
    const sconces = [];
    {
      const proto = makeSconce(ctx, mat);
      let k = 0;
      for (const z of BAYS) for (const side of [-1, 1]) {
        const s = makeSconce(ctx, mat);
        const holder = new THREE.Group();
        holder.add(s.group);
        s.group.position.z = PIL.d + 0.005;
        mount(holder, side, z, 1.98, 0);
        root.add(holder);
        const lp = s.lightPos.clone().add(V3(0, 0, PIL.d + 0.005));
        holder.updateMatrixWorld(true);
        const wp = lp.applyMatrix4(holder.matrixWorld);
        const pl = new THREE.PointLight(0xffb878, 2.9, 6.5, 2);
        pl.position.copy(wp);
        root.add(pl);
        sconces.push({ light: pl, shade: s.shade, flame: s.flame, base: 2.9, seed: 7 + k * 3.3, dying: k === 6 });
        k++;
      }
      proto.group.traverse((o) => o.geometry?.dispose?.());
    }
    // the light of one sconce on the far bay sputters, as if the gas were failing
    ctx.onUpdate((dt, t) => {
      for (const s of sconces) {
        let f = flicker(t, s.seed);
        if (s.dying) {
          const sp = Math.sin(t * 1.7) * Math.sin(t * 0.63 + 1.0);
          const cut = sp > 0.82 ? 0.25 : 1.0;
          f *= cut * (0.85 + 0.15 * Math.sin(t * 31.0));
        }
        s.light.intensity = s.base * f;
        s.shade.material.emissiveIntensity = 1.3 * f;
        if (s.flame) s.flame.visible = f > 0.3;
      }
    });
    // the shades share one material; give the dying sconce its own so it can dim alone
    for (const s of sconces) if (s.dying) s.shade.material = s.shade.material.clone();

    // hanging lanterns in bays 2 and 4 (break up the ceiling, warm pools on the runner)
    const lanterns = [];
    for (const z of [BAY_CENTERS[1], BAY_CENTERS[3]]) {
      const ln = makeLantern(ctx, mat, 1.05);
      ln.group.position.set(0, H, z);
      root.add(ln.group);
      const pl = new THREE.PointLight(0xffb070, 2.2, 6, 2);
      pl.position.set(0, H + ln.lightPos.y, z);
      root.add(pl);
      lanterns.push({ light: pl, seed: z * 1.7 });
    }
    ctx.onUpdate((dt, t) => { for (const l of lanterns) l.light.intensity = 2.2 * flicker(t, l.seed); });

    // ================================================================ portraits (eyes follow)
    const portraits = [];
    const hang = (name, side, z, { w = 0.74, h = 0.95, y = 1.86, frameW = 0.12, strength = 1 } = {}) => {
      const pm = makePortraitMaterial(ctx, name, w / h, { size: 1024 });
      const f = makeFramed(ctx, mat, pm, w, h, { frameW, centreY: y });
      mount(f.group, side, z, y, 0.07);
      f.group.userData.dynamic = true;     // keep the canvas raycastable + unmerged
      root.add(f.group);
      portraits.push({ name, mesh: f.canvas, mat: pm, strength, group: f.group, speed: 0.9 + portraits.length * 0.15 });
      return f;
    };
    const pLady = hang('lady', -1, BAY_CENTERS[0]);
    const pColonel = hang('colonel', -1, BAY_CENTERS[1], { w: 0.8, h: 1.02 });
    const pElder = hang('elder', -1, BAY_CENTERS[3]);
    const pChild = hang('child', 1, BAY_CENTERS[0], { w: 0.6, h: 0.78, y: 1.95 });
    const pWidow = hang('widow', 1, BAY_CENTERS[2], { w: 0.74, h: 0.95, y: 1.92 });
    const gaze = createGaze(portraits, ctx.camera, { instant: !!ctx.shot });

    // ================================================================ furniture
    const consoleT = makeConsole(ctx, mat);
    mount(consoleT.group, 1, BAY_CENTERS[0], 0, 0.0);
    root.add(consoleT.group);
    const consoleLight = new THREE.PointLight(0xffa04a, 1.6, 4.5, 2);
    {
      consoleT.group.updateMatrixWorld(true);
      consoleLight.position.copy(V3(0, 1.2, 0.22).applyMatrix4(consoleT.group.matrixWorld));
      root.add(consoleLight);
      ctx.onUpdate((dt, t) => { consoleLight.intensity = 1.6 * flicker(t, 5.5); });
    }
    const bench = makeBench(ctx, mat);
    mount(bench, 1, BAY_CENTERS[2], 0, 0.02);
    root.add(bench);
    const clock = makeClock(ctx, mat);
    mount(clock, 1, BAY_CENTERS[4] + 0.2, 0, 0.02);
    root.add(clock);

    // ================================================================ puzzle panel (left wall, middle bay)
    const toyMat = makePortraitMaterial(ctx, 'toymaker', 1.0, { size: 1024 });
    const panel = new THREE.Group();
    panel.name = 'puzzlePanel';
    {
      const G = ctx.geometry;
      const back = new THREE.Mesh(G.raisedPanel(1.42, 1.66, { border: 0.12, bevel: 0.05, fieldDepth: 0.008 }), mat.doorWood);
      back.position.set(0, 0, 0.0); panel.add(back);
      const frame = new THREE.Mesh(G.frameGeometry(0.93, 0.93, { width: 0.13, depth: 0.09, uvScale: 1 }), mat.giltFrame);
      frame.position.set(0, 0.0, 0.03); panel.add(frame);
      const plaque = makePlaque(ctx, mat, 'The Toymaker', 0.34, 0.07);
      plaque.position.set(0, -0.67, 0.04); panel.add(plaque);
    }
    mount(panel, -1, PUZZLE.z, PUZZLE.y, 0.025);
    root.add(panel);
    // brass girandoles either side of the panel, each with a candle; one light between them
    for (const s of [-1, 1]) {
      const G = ctx.geometry;
      const gir = new THREE.Group();
      const plate = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.04, 0], [0.045, 0.006], [0.035, 0.014], [0, 0.02]], 20), mat.brass);
      plate.rotation.x = Math.PI / 2; plate.scale.set(1, 1, 1.8); gir.add(plate);
      const curve = new THREE.CatmullRomCurve3([V3(0, 0, 0.015), V3(0, -0.06, 0.08), V3(0, -0.02, 0.15), V3(0, 0.03, 0.17)]);
      gir.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.007, 8), mat.brass));
      const cup = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0], [0.03, 0.012], [0.034, 0.02], [0.016, 0.026], [0.014, 0.04], [0, 0.04]], 20), mat.brass);
      cup.position.set(0, 0.03, 0.17); gir.add(cup);
      const c = fx.candle({ height: 0.16, radius: 0.011, light: false, seed: 31 + s * 4, burn: 0.7 });
      c.position.set(0, 0.07, 0.17); gir.add(c);
      mount(gir, -1, PUZZLE.z + s * 0.86, PUZZLE.y + 0.12, 0.03);
      root.add(gir);
    }
    const puzzleLight = new THREE.PointLight(0xffa860, 1.1, 4, 2);
    puzzleLight.position.set(X0 + 0.6, PUZZLE.y + 0.75, PUZZLE.z);
    root.add(puzzleLight);
    ctx.onUpdate((dt, t) => { puzzleLight.intensity = 1.1 * flicker(t, 9.1); });
    let solvedFx = 0;
    const slide = createSlidePuzzle(ctx, {
      material: toyMat,
      backMaterial: M.basic('black', { color: 0x080605, roughness: 0.7 }),
      edgeMaterial: mat.mahogany,
      random: ctx.random.fork('gallery-slide'),
      camera: { position: [X0 + 1.7, PUZZLE.y - 0.02, PUZZLE.z], target: [X0, PUZZLE.y - 0.02, PUZZLE.z], fov: 40 },
      onSolvedCb: async () => {
        applySolved(true);
        ctx.audio.sfx('door');
        await ctx.say({ text: 'There! Now he can *see* you. And so — at last — can the attic.', speaker: 'stauf', speakerName: 'Stauf' });
      },
    });
    mount(slide.group, -1, PUZZLE.z, PUZZLE.y, 0.07);
    root.add(slide.group);
    portraits.push({ name: 'toymaker', mesh: slide.group, mat: toyMat, strength: 0.8, speed: 0.7 });

    function applySolved(animate) {
      ctx.state.set('gallery.atticOpen', true);
      solvedFx = animate ? 0.001 : 1;
      if (!animate) { atticHinge.rotation.y = -0.55; toyMat.userData.eyes.uGlow.value = 0.6; }
      slide.forceSolved();
    }
    if (ctx.state.isSolved(SLIDE_ID)) applySolved(false);

    // ================================================================ ghost (a grey lady in the moonlight)
    const ghostMat = fx.ghostMaterial({ color: 0x86a4ff, rimColor: 0xdfe8ff, opacity: 0.45, intensity: 1.1, dissolveY: 0.25, dissolveSoft: 0.9 });
    const ghostProfile = new THREE.SplineCurve([
      [0.0, 1.69], [0.055, 1.675], [0.088, 1.625], [0.097, 1.565], [0.088, 1.5], [0.062, 1.46], [0.05, 1.43], [0.1, 1.395], [0.168, 1.355],
      [0.184, 1.29], [0.168, 1.18], [0.135, 1.08], [0.15, 0.98], [0.2, 0.78], [0.26, 0.5], [0.31, 0.22], [0.35, 0.02], [0.0, 0.0],
    ].map(([r, y]) => new THREE.Vector2(r, y))).getPoints(90).map((v) => [Math.max(v.x, 0), v.y]);
    const ghost = new THREE.Mesh(ctx.geometry.latheFromProfile(ghostProfile, 48), ghostMat);
    ghost.scale.set(1, 1, 0.75);
    ghost.position.set(0.32, 0.0, -8.15);
    ghost.renderOrder = 7;
    ghost.name = 'ghost';
    root.add(ghost);
    ctx.onUpdate((dt, t) => {
      ghost.position.y = Math.sin(t * 0.7) * 0.02;
      ghost.rotation.y = -0.3 + Math.sin(t * 0.25) * 0.15;
    });

    // ================================================================ moonlight + fills
    const moon = new THREE.SpotLight(0xa8bcff, 850, 30, 0.2, 0.45, 2);
    moon.position.set(0.35, 7.2, Z0 - 6.0);
    moon.target.position.set(-0.1, 0.0, -6.2);
    moon.castShadow = ctx.quality.shadows;
    moon.shadow.mapSize.set(ctx.quality.shadowMapSize, ctx.quality.shadowMapSize);
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.025; moon.shadow.radius = ctx.quality.shadowRadius;
    moon.shadow.camera.near = 3; moon.shadow.camera.far = 22;
    root.add(moon, moon.target);
    root.add(new THREE.HemisphereLight(0x3d5cc0, 0x1a1210, 1.15));
    root.add(fx.areaLight({ center: [0, WIN.sill + 1.2, Z0 + 0.05], normal: [0, -0.65, 1], width: WIN.w, height: WIN.h, color: 0x8ea6ff, intensity: 1.6 }));
    // warm glow from the foyer chandelier below the landing balustrade
    const foyerGlow = new THREE.PointLight(0xffa860, 55, 14, 2);
    foyerGlow.position.set(0, -0.9, Z1 + 5.4);
    // the crown of the foyer chandelier, glimpsed below the balustrade
    {
      const ch = new THREE.Group();
      ch.position.set(0, -0.75, Z1 + 5.4);
      const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.012, 8, 48), mat.brass); ringM.rotation.x = Math.PI / 2; ch.add(ringM);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.01, 8, 40), mat.brass); ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.3; ch.add(ring2);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.2, 8), mat.brass); rod.position.y = 1.9; ch.add(rod);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const r = i % 2 ? 0.36 : 0.62; const yy = i % 2 ? 0.3 : 0; const f = fx.flame({ height: 0.05, width: 0.014, intensity: 9 }); f.position.set(Math.cos(a) * r, yy + 0.07, Math.sin(a) * r); ch.add(f); const cnd = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.07, 8), M.basic('bone')); cnd.position.set(Math.cos(a) * r, yy + 0.035, Math.sin(a) * r); ch.add(cnd); }
      root.add(ch);
    }
    root.add(foyerGlow);
    const landingFill = new THREE.PointLight(0xffb070, 0.9, 5, 2);
    landingFill.position.set(1.4, 2.2, Z1 + 2.2);
    // a great dark landscape over the stairwell, lit from below by the chandelier
    {
      const pw = 2.2, ph = 1.45;
      const f = makeFramed(ctx, mat, M.create('painting', { subject: 0, seed: 11, aspect: pw / ph, size: 1024 }), pw, ph, { frameW: 0.16, cords: false });
      f.group.position.set(0, 2.0, Z1 + 8.55); f.group.rotation.y = Math.PI;
      root.add(f.group);
    }
    root.add(landingFill);

    // volumetric moon beam, dust in it, floor mist
    const winC = V3(0, WIN.sill + 0.4 + (WIN.h - 0.4) * 0.5, Z0 - 0.05);
    const beamDir = new THREE.Vector3().subVectors(moon.target.position, moon.position).normalize();
    const shaft = fx.shaft({
      center: winC, right: V3(WIN.w / 2, 0, 0), up: V3(0, (WIN.h - 0.4) * 0.5, 0), direction: beamDir, length: 7.5,
      color: 0x9fb6ff, intensity: 0.22, softness: 0.35, falloff: 1.1, panes: [2, 4], mullion: 0.03, noise: 0.7,
    });
    root.add(shaft);
    root.add(fx.dust({ box: new THREE.Box3(V3(X0 + 0.1, 0.05, Z0 + 0.1), V3(X1 - 0.1, 3.2, -2.5)), count: 2600, shafts: [shaft], size: 0.011, intensity: 2.2, ambient: 0.04 }));
    root.add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.05, 0, Z0 + 0.3), V3(X1 - 0.05, 0.6, Z1 - 0.2)), color: 0x080c18, litColor: 0x121a2e, density: 0.18, heightFalloff: 4 }));

    // ================================================================ texture debug board (only when ?node=_texdbg)
    if (ctx.params.get('node') === '_texdbg') {
      const names = ['lady', 'colonel', 'child', 'elder', 'widow', 'toymaker'];
      names.forEach((n, i) => {
        const asp = n === 'toymaker' ? 1.0 : (n === 'child' ? 0.6 / 0.78 : n === 'colonel' ? 0.8 / 1.02 : 0.74 / 0.95);
        const pm = makePortraitMaterial(ctx, n, asp);
        const bm = new THREE.MeshBasicMaterial({ map: pm.map });
        const q = new THREE.Mesh(new THREE.PlaneGeometry(asp, 1), bm);
        q.position.set((i % 3 - 1) * 1.1, 1.0 + (i < 3 ? 1.05 : 0), 40);
        q.rotation.y = Math.PI;
        root.add(q);
      });
    }

    // ================================================================ navigation
    const nodes = {
      main: { position: [0.28, 1.62, 7.35], target: [-0.08, 1.48, -9.0], fov: 56, label: 'The gallery', look: { yaw: [-55, 55], pitch: [-28, 26] } },
      back: { position: [0.2, 1.62, 5.6], target: [0.0, 1.35, 14.0], fov: 58, label: 'The stair landing' },
      bedroom: { position: [-0.95, 1.62, 4.1], target: [1.6, 1.62, 2.75], fov: 58, label: 'The bedroom door' },
      portraits: { position: [0.62, 1.62, 1.15], target: [-1.6, 1.68, -0.75], fov: 56, label: 'The Toymaker', look: { yaw: [-60, 60], pitch: [-28, 26] } },
      gamedoor: { position: [-0.95, 1.62, -2.4], target: [1.6, 1.62, -4.05], fov: 58, label: 'The game room door' },
      far: { position: [0.12, 1.62, -3.4], target: [0.0, 1.62, -9.0], fov: 56, label: 'The window', look: { yaw: [-60, 60], pitch: [-28, 28] } },
      _texdbg: { position: [0, 1.5, 37.0], target: [0, 1.5, 40], fov: 50 },
      attic: { position: [0.85, 1.62, -5.6], target: [-1.6, 1.45, -7.4], fov: 58, label: 'The attic door' },
    };
    const edges = [
      ['main', 'back', null, { hotspot: { back: { position: [0.0, 1.4, 8.6], radius: 0.8 }, main: { position: [0.0, 1.5, 2.0], radius: 0.8 } } }],
      ['main', 'bedroom', [[0.1, 1.62, 5.4]]],
      ['main', 'portraits', [[0.4, 1.62, 3.6]]],
      ['bedroom', 'portraits', [[-0.1, 1.62, 2.4]]],
      ['portraits', 'gamedoor', [[0.0, 1.62, -1.6]]],
      ['portraits', 'far', [[0.25, 1.62, -1.2]]],
      ['gamedoor', 'far', null],
      ['far', 'attic', [[0.35, 1.62, -5.0]]],
      ['gamedoor', 'attic', [[0.2, 1.62, -4.8]]],
      ['far', 'main', [[0.2, 1.62, 1.0], [0.25, 1.62, 5.0]], { hidden: true }],
    ];
    const dBox = (d, pad = 0.0) => {
      const x = d.side < 0 ? X0 : X1;
      return { min: [Math.min(x, x - d.side * 0.25), 0.1, d.z - d.w / 2 - pad], max: [Math.max(x, x - d.side * 0.25), d.h, d.z + d.w / 2 + pad] };
    };
    const exits = [
      { node: 'back', toRoom: 'foyer', toNode: 'landing_n', label: 'Down to the foyer', hotspot: { box: { min: [-ARCH.w / 2, 0.1, Z1 + 0.2], max: [ARCH.w / 2, 2.6, Z1 + 2.6] } } },
      { node: 'bedroom', toRoom: 'bedroom', toNode: null, label: 'The bedroom', hotspot: { box: dBox(DOORS.bedroom) } },
      { node: 'gamedoor', toRoom: 'gameroom', toNode: null, label: 'The game room', hotspot: { box: dBox(DOORS.gameroom) } },
      { node: 'attic', toRoom: 'attic', toNode: null, label: 'Up to the attic', hotspot: { box: dBox(DOORS.attic, 0.05) }, enabled: (st) => !!(st.get?.('gallery.atticOpen') || st.isSolved?.(SLIDE_ID)) },
    ];

    // ================================================================ hotspots
    // boxes for props that get merged into static batches below
    const bbox = (o, pad = 0.02) => { o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o).expandByScalar(pad); return { min: b.min.toArray(), max: b.max.toArray() }; };
    const panelBox = bbox(panel), clockBox = bbox(clock), consoleBox = bbox(consoleT.group);
    const say = (text) => ctx.say({ text, speaker: 'stauf', speakerName: 'Stauf' });
    const examine = (title, text) => () => ctx.ui.caption(text, { title });
    const hotspots = [
      { id: 'puzzle', nodes: ['portraits', 'main', 'bedroom'], box: panelBox, cursor: 'puzzle', label: "The Toymaker's likeness", puzzle: slide.puzzle, enabled: () => !ctx.state.isSolved(SLIDE_ID) },
      { id: 'puzzle-done', nodes: ['portraits'], box: panelBox, cursor: 'examine', label: 'The Toymaker', enabled: () => ctx.state.isSolved(SLIDE_ID), onActivate: async () => { ctx.audio.sfx('laugh'); await say('Handsome devil, isn\'t he? I had the eyes done *last*.'); } },
      { id: 'lady', nodes: ['main', 'bedroom'], object: pLady.group, cursor: 'examine', label: 'A lady in blue', onActivate: examine('The Lady in Blue', 'Her pearls are painted with real care. Her smile was painted over twice — you can see the ghost of a different mouth beneath the varnish.') },
      { id: 'colonel', nodes: ['bedroom', 'portraits', 'main'], object: pColonel.group, cursor: 'examine', label: 'The colonel', onActivate: examine('The Colonel', 'Scarlet coat, brass buttons, a jaw like a portcullis. A brass label once named him; someone has scratched it out with a pin.') },
      { id: 'child', nodes: ['main', 'bedroom'], object: pChild.group, cursor: 'talk', label: 'A child in a sailor suit', onActivate: async () => { ctx.audio.sfx('chime', { freq: 1320 }); await ctx.ui.caption('A small boy in a sailor collar. For a moment you could swear the paint is still wet around his eyes.', { title: 'The Boy' }); } },
      { id: 'widow', nodes: ['portraits', 'gamedoor'], object: pWidow.group, cursor: 'examine', label: 'A widow in black', onActivate: examine('The Widow', 'Black bombazine, a cameo at her throat. The canvas is warm to the touch, as though someone had been standing very close to it.') },
      { id: 'elder', nodes: ['portraits', 'gamedoor', 'far'], object: pElder.group, cursor: 'talk', label: 'An old man', onActivate: async () => { await say('My dear old patron. He *also* thought he could leave whenever he liked.'); } },
      { id: 'clock', nodes: ['far', 'attic', 'gamedoor'], box: clockBox, cursor: 'examine', label: 'The long-case clock', onActivate: () => { ctx.audio.chimeClock?.(1); ctx.ui.caption('Its hands are stopped at five minutes to midnight. Yet you can hear it ticking.', { title: 'The Clock' }); } },
      { id: 'window', nodes: ['far', 'attic'], box: { min: [-WIN.w / 2, WIN.sill + 0.1, Z0 - WIN.depth], max: [WIN.w / 2, WIN.sill + WIN.h, Z0 - WIN.depth + 0.2] }, cursor: 'examine', label: 'The window', onActivate: examine('The Window', 'The moon hangs over the grounds like a coin on a dead man\'s eye. Down in the garden nothing moves. Nothing at all.') },
      { id: 'attic-locked', nodes: ['attic', 'far'], box: dBox(DOORS.attic, 0.05), cursor: 'examine', label: 'A narrow door', enabled: () => !ctx.state.isSolved(SLIDE_ID), onActivate: async () => { ctx.audio.sfx('thud'); await ctx.ui.caption('Latched fast. The keyhole is shaped like a tiny eye — and it is shut.', { title: 'The Attic Door' }); } },
      { id: 'ghost', nodes: ['far', 'attic', 'main'], sphere: { center: [0.32, 1.0, -8.15], radius: 0.5 }, cursor: 'ghost', label: 'A grey shape', onActivate: () => ctx.cinematic(async (c, h) => {
        ctx.post.set({ saturation: 0.6, vignette: 0.6 }, 0.8);
        ghostMat.uniforms.uOpacity.value = 0.8;
        await ctx.nav.lookAt(V3(0.32, 1.45, -8.15), 1.2);
        await ctx.say({ text: 'She walks the gallery every night, looking for the child she lost. She never looks *up*.', speaker: 'stauf', speakerName: 'Stauf' });
        await h.wait(0.4);
        ghostMat.uniforms.uOpacity.value = 0.45;
        ctx.post.reset(1.2);
        await ctx.nav.returnToNode(1.0);
      }) },
      { id: 'console', nodes: ['main', 'bedroom'], box: consoleBox, cursor: 'examine', label: 'A console table', onActivate: examine('Dried Roses', 'Roses dried in a blue jar, black at the edges. Their scent is somehow still fresh.') },
    ];

    // ================================================================ QA hooks
    if (typeof window !== 'undefined') {
      const dbg = (window.__debug ||= {});
      dbg.solvers ||= {}; dbg.states ||= {};
      dbg.solvers.gallery = async () => {
        const game = window.__game;
        if (game && !game.puzzle && game.room?.mod?.id === 'gallery' && game.startPuzzle && !ctx.state.isSolved(SLIDE_ID)) {
          game.startPuzzle(slide.puzzle);
          await new Promise((r) => setTimeout(r, 50));
        }
        if (game?.puzzle?.def?.id === SLIDE_ID) { slide.puzzle.autoSolve(game.puzzle.pctx); return true; }
        slide.forceSolved(); ctx.state.markSolved?.(SLIDE_ID); applySolved(false);
        return true;
      };
      dbg.states.gallery = () => ({ ...slide.state(), isSolved: ctx.state.isSolved(SLIDE_ID), atticOpen: !!ctx.state.get('gallery.atticOpen') });
      dbg.solve ||= (id) => (dbg.solvers[id] ? dbg.solvers[id]() : Promise.reject(new Error(`no solver for ${id}`)));
      dbg.state ||= (id) => (dbg.states[id] ? dbg.states[id]() : null);
      dbg.gallery = { slide, slideAt: slide.slideAt, portraits };
    }

    // ================================================================ shadows + merge
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const fxLike = o.isPoints || m?.isShaderMaterial || m?.isMeshBasicMaterial || (m?.transparent && (m.opacity ?? 1) < 0.95) || o.userData.noBake;
      o.castShadow = !o.userData.noShadow && !fxLike && !['floor', 'runner'].includes(o.name);
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });
    const merged = mergeStatic(root);
    root.userData.mergedCount = merged;

    const godRays = [{ position: V3(0.3, WIN.sill + 1.5, Z0 - 2.0), color: new THREE.Color(0.72, 0.8, 1.0), strength: 0.8, radius: 0.18 }];

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'main',
      grade: { exposure: 1.85, contrast: 1.1, saturation: 1.05, shadowTint: [0.76, 0.92, 1.28], splitAmount: 0.65, bloomStrength: 0.38, bloomThreshold: 1.0, godRayWeight: 0.35, godRayThreshold: 2.5, vignette: 0.48, aoIntensity: 1.1, aoRadius: 0.4 },
      environment: { position: [0.0, 1.7, 0.4], intensity: 0.8 },
      onEnter() {
        if (!ctx.state.has('gallery.greeted')) {
          ctx.state.set('gallery.greeted', true);
          setTimeout(() => say('My family. Such *attentive* company. Do mind your manners — they never forget a face.'), 1600);
        }
      },
      update(dt, t) {
        gaze(dt);
        slide.update(dt);
        if (solvedFx > 0 && solvedFx < 1) {
          solvedFx = Math.min(1, solvedFx + dt * 0.5);
          const e = solvedFx * solvedFx * (3 - 2 * solvedFx);
          atticHinge.rotation.y = -0.55 * e;
          toyMat.userData.eyes.uGlow.value = 0.6 * e + Math.sin(t * 8) * 0.1 * (1 - e);
        }
      },
      dispose() { const d = window.__debug; if (d) { delete d.gallery; if (d.solvers) delete d.solvers.gallery; if (d.states) delete d.states.gallery; } },
    };
  },
};
