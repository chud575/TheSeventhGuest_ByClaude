import * as THREE from 'three';
import { mergeStatic } from '../../engine/lib/contrib/foyer-merge.js';
import { flicker } from '../../engine/fx/index.js';
import { X0, X1, Z0, Z1, H, DADO, BAYS, BAY_CENTERS, DOORS, ARCH, WIN, PUZZLE, PIL } from './layout.js';
import { buildShell, buildWindow, buildLanding, makeDoor, mount } from './architecture.js';
import { makeFramed, makeClock, makeConsole, makeBench, makePlaque, makeLantern } from './props.js';
import { runnerTexture, nightSky, treeLine, branchCard } from './textures.js';
import { makePortraitMaterial, createGaze } from './portraits.js';
import { patchWallpaper, makeReflectiveFloor, giltMaterial, mahoganyTexture } from './look.js';
import { makeGasBracket, makeGlobeMaterial, makeLightPool, makeGhostCard, silhouetteTexture, makeOvalFrame, makeGiltFrame, makePictureLight, makeSideChair, makeCoveredBust, makeBirdcage, transomTexture } from './dressing.js';
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
      wall: M.create('damask', { base: [0.05, 0.08, 0.25], motif: [0.09, 0.13, 0.36], accent: [0.5, 0.4, 0.22], accentStrength: 0.06, sheen: 0.75, aging: 0.5, variant: 0, normalScale: 0.15, repeat: [1 / 0.1777, 1 / 0.1777], size: hiTex }),
      floor: M.create('floorboards', { species: 'walnut', boards: 6, boardLength: 0.5, polish: 0.9, wear: 0.5, tint: [1.05, 0.86, 0.72], roughness: 0.85, repeat: [1 / 3.2, 1 / 1.0] }),
      ceiling: M.create('plaster', { color: [0.2, 0.23, 0.32], cracks: 0.3, stains: 0.45, repeat: [0.45, 0.45] }),
      beam: M.create('plaster', { color: [0.24, 0.27, 0.36], cracks: 0.15, stains: 0.3, repeat: [0.8, 0.8] }),
      plasterLight: M.create('plaster', { color: [0.42, 0.44, 0.5], cracks: 0.3, stains: 0.4, repeat: [0.8, 0.8] }),
      wainscot: M.create('wood', { species: 'mahogany', boards: 0, polish: 0.75, figure: 0.7, tint: [0.62, 0.5, 0.46], repeat: [1.3, 1.3], clearcoat: 0.5, clearcoatRoughness: 0.25 }),
      pilasterWood: M.create('wood', { species: 'mahogany', boards: 0, polish: 0.8, figure: 0.4, tint: [0.6, 0.48, 0.44], repeat: [2.2, 0.6], rotation: Math.PI / 2, clearcoat: 0.55, clearcoatRoughness: 0.2 }),
      doorWood: null,
      mahogany: M.create('mahogany', { repeat: [1.5, 1.5], color: new THREE.Color(0.62, 0.5, 0.48) }),
      crownGilt: M.create('gilded', { pattern: 0, repeats: 4, wear: 0.5, dirt: 0.65, repeat: [1 / 0.45, 1] }),
      capitalGilt: M.create('gilded', { pattern: 0, repeats: 4, wear: 0.4, dirt: 0.6, repeat: [1 / 0.2, 1 / 0.07] }),
      frieze: M.create('gilded', { pattern: 6, repeats: 3, ground: 1, groundColor: [0.03, 0.04, 0.09], wear: 0.35, dirt: 0.55, repeat: [1 / 0.7, 1] }),
      doorFrieze: M.create('gilded', { pattern: 1, repeats: 3, ground: 1, groundColor: [0.12, 0.04, 0.03], wear: 0.4, dirt: 0.6, repeat: [1 / 0.4, 1] }),
      soffit: M.create('gilded', { pattern: 2, repeats: 4, ground: 1, groundColor: [0.05, 0.06, 0.12], wear: 0.4, dirt: 0.6, repeat: [1 / 0.9, 1] }),
      giltFrame: M.create('gold', { wear: 0.5, dirt: 0.6, repeat: [2, 1], color: new THREE.Color(0.9, 0.82, 0.7) }),
      gilt: giltMaterial(ctx),
      sheet: M.basic('cloth', { color: 0xb8b4aa }),
      felt: M.create('velvet', { color: [0.03, 0.09, 0.05], crush: 0.3, repeat: [6, 6] }),
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
      mantle: new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 2.5, 1.2), name: 'mantle' }),
      lanternGlass: new THREE.MeshStandardMaterial({ color: 0x302010, emissive: new THREE.Color(1.0, 0.6, 0.28), emissiveIntensity: 0.55, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false, name: 'lanternGlass' }),
    };
    {
      const mt = mahoganyTexture(ctx).withRepeat(1 / 0.5, 1 / 1.0);
      mat.doorWood = new THREE.MeshPhysicalMaterial({ map: mt.map, normalMap: mt.normalMap, roughnessMap: mt.roughnessMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 1, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.3, color: new THREE.Color(1.1, 1.0, 1.0), name: 'doorMahogany' });
    }
    // sconce jet positions (needed for soot on the wallpaper): pilaster face + bracket reach
    const jetPos = [];
    for (const z of BAYS) for (const side of [-1, 1]) jetPos.push(V3(side < 0 ? X0 + PIL.d + 0.2 : X1 - PIL.d - 0.2, 1.98 + 0.11, z));
    patchWallpaper(mat.wall, jetPos);
    const skyTex = nightSky(ctx);
    mat.sky = new THREE.MeshBasicMaterial({ map: skyTex.map, color: new THREE.Color(1, 1, 1).multiplyScalar(2.6), toneMapped: false, name: 'sky' });
    mat.skipFloor = true;
    const runnerSet = runnerTexture(ctx);
    const RUN_W = 1.05;
    const runRep = runnerSet.withRepeat(1, 1);
    mat.runner = new THREE.MeshPhysicalMaterial({ map: runRep.map, normalMap: runRep.normalMap, roughnessMap: runRep.ormMap, aoMap: runRep.ormMap, roughness: 1, metalness: 0, sheen: 0.7, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.7, 0.3, 0.28), envMapIntensity: 0.4, name: 'runner' });

    // ================================================================ architecture
    buildShell(ctx, root, mat);
    const winInfo = buildWindow(ctx, root, mat);
    buildLanding(ctx, root, mat);

    {
      const zA = Z0 - WIN.depth, zB = Z1 + 2.7;
      const floor = makeReflectiveFloor(ctx, mat.floor, {
        w: 4.8, l: zB - zA, cx: 0, cz: (zA + zB) / 2, y: 0, res: ctx.shot ? 0.5 : 0.4, strength: 1.0, blur: 1.0,
        uvFn: (g) => { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getY(i) - (zA + zB) / 2, p.getX(i)); },
      });
      const orig = floor.onBeforeRender;
      let frameId = 0, last = -1;
      ctx.onUpdate(() => { frameId++; });
      floor.onBeforeRender = function (r, sc, cam) { if (cam !== ctx.camera || last === frameId) return; last = frameId; orig.call(this, r, sc, cam); };
      floor.receiveShadow = true;
      root.add(floor);
    }
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
    doors.attic.getObjectByName('void').visible = false;

    // ================================================================ gas brackets (one on every pilaster face)
    const sconces = [];
    {
      let k = 0;
      const base = [2.6, 3.2, 2.2, 2.9, 3.4, 2.4, 2.8, 2.0, 3.0, 2.5];
      for (const z of BAYS) for (const side of [-1, 1]) {
        const globeMat = makeGlobeMaterial(ctx);
        const s = makeGasBracket(ctx, mat, globeMat, mat.mantle);
        const holder = new THREE.Group();
        holder.add(s.group);
        s.group.position.z = PIL.d + 0.005;
        mount(holder, side, z, 1.98, 0);
        root.add(holder);
        // scalloped pool of light thrown up the wallpaper beside the pilaster (both sides of it)
        for (const off of [-1, 1]) {
          const pool = makeLightPool(ctx, { w: 1.2, h: 2.6, intensity: 0.22 * base[k] / 2.7 });
          const ph = new THREE.Group(); ph.add(pool);
          mount(ph, side, z + off * (PIL.w / 2 + 0.36), 1.98 + 0.11, 0.004);
          ph.userData.dynamic = true;
          root.add(ph);
          s.pools = s.pools || []; s.pools.push(pool);
        }
        const lp = s.lightPos.clone().add(V3(0, 0, PIL.d + 0.005));
        holder.updateMatrixWorld(true);
        const wp = lp.applyMatrix4(holder.matrixWorld);
        const pl = new THREE.PointLight(0xffb070, base[k], 6.5, 2);
        pl.position.copy(wp);
        root.add(pl);
        sconces.push({ light: pl, globe: globeMat, pools: s.pools, base: base[k], amp: 0.6 + 0.5 * ((k * 7) % 5) / 4, seed: 7 + k * 3.3, dying: k === 6 });
        k++;
      }
    }
    // the light of one bracket on the far bay sputters, as if the gas were failing
    ctx.onUpdate((dt, t) => {
      for (const s of sconces) {
        let f = 1 + (flicker(t, s.seed) - 1) * s.amp;
        if (s.dying) {
          const sp = Math.sin(t * 1.7) * Math.sin(t * 0.63 + 1.0);
          const cut = sp > 0.82 ? 0.25 : 1.0;
          f *= cut * (0.85 + 0.15 * Math.sin(t * 31.0));
        }
        s.light.intensity = s.base * f;
        s.globe.emissiveIntensity = 0.8 * f;
        for (const p of s.pools) p.material.opacity = f;
      }
    });

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
    ctx.onUpdate((dt, t) => { for (const l of lanterns) l.light.intensity = (l.base ?? 2.2) * flicker(t, l.seed); });

    // ================================================================ portraits (eyes follow)
    const portraits = [];
    const hang = async (name, side, z, { w = 0.74, h = 0.95, y = 1.86, frameW = 0.12, strength = 1, light = false } = {}) => {
      const pm = await makePortraitMaterial(ctx, name);
      const f = makeGiltFrame(ctx, mat, pm, w, h, { fw: frameW });
      mount(f.group, side, z, y, 0.03);
      f.group.userData.dynamic = true;     // keep the canvas raycastable + unmerged
      root.add(f.group);
      portraits.push({ name, mesh: f.canvas, mat: pm, strength, group: f.group, speed: 0.9 + portraits.length * 0.15 });
      if (light) {
        const pl = makePictureLight(ctx, mat, w * 0.62);
        mount(pl, side, z, y + h / 2 + frameW + 0.06, 0.0);
        root.add(pl);
        const nrm = side < 0 ? [1, -1.3, 0] : [-1, -1.3, 0];
        root.add(fx.areaLight({ center: [side < 0 ? X0 + 0.2 : X1 - 0.2, y + h / 2 + frameW + 0.06, z], normal: nrm, width: w * 0.6, height: 0.05, color: 0xffb877, intensity: 28 }));
      }
      return f;
    };
    const pLady = await hang('lady', -1, BAY_CENTERS[0], { light: true });
    const pColonel = await hang('colonel', -1, BAY_CENTERS[1], { w: 0.8, h: 1.02, light: true });
    const pElder = await hang('elder', 1, BAY_CENTERS[0] + 0.45);
    const pWidow = await hang('widow', 1, BAY_CENTERS[2] + 0.38, { w: 0.7, h: 0.9, y: 1.95 });
    const pChild = await hang('child', 1, BAY_CENTERS[2] - 0.62, { w: 0.46, h: 0.6, y: 1.84, frameW: 0.09 });
    const gaze = createGaze(portraits, ctx.camera, { instant: !!ctx.shot });

    // salon hang: cut-paper silhouettes and small landscapes between the big canvases
    const smalls = [
      ['sil', -1, BAY_CENTERS[0] - 0.78, 2.02, 1, true], ['sil', -1, BAY_CENTERS[0] + 0.78, 2.02, 2, false],
      ['sil', -1, BAY_CENTERS[1] - 0.82, 2.1, 3, false], ['sil', 1, BAY_CENTERS[0] - 0.55, 2.2, 4, true],
      ['land', -1, BAY_CENTERS[3] - 0.78, 2.15, 5, 0], ['land', -1, BAY_CENTERS[3] + 0.78, 2.15, 6, 2],
      ['land', -1, BAY_CENTERS[1] + 0.84, 2.0, 7, 3],
    ];
    for (const [kind, side, z, y, seed, extra] of smalls) {
      let g;
      if (kind === 'sil') {
        const sm = new THREE.MeshStandardMaterial({ map: silhouetteTexture(ctx, seed, extra), roughness: 0.8, name: 'silhouette' });
        g = makeOvalFrame(ctx, mat, sm, 0.2, 0.26);
      } else {
        const pm = M.create('painting', { subject: extra, seed: seed * 13, aspect: 1.3, size: 512 });
        g = makeGiltFrame(ctx, mat, pm, 0.34, 0.26, { fw: 0.055, profile: 'slim', corners: false }).group;
      }
      mount(g, side, z, y, 0.02);
      root.add(g);
    }

    // ================================================================ furniture
    // left bay 4: pier mirror over the demilune console (dead roses, candlesticks, an empty birdcage)
    const consoleT = makeConsole(ctx, mat);
    mount(consoleT.group, -1, BAY_CENTERS[3], 0, 0.0);
    root.add(consoleT.group);
    const cage = makeBirdcage(ctx, mat);
    cage.position.set(-0.3, 0.857, 0.12); cage.scale.setScalar(0.9);
    consoleT.group.add(cage);
    {
      const mirrorMat = new THREE.MeshStandardMaterial({ color: 0x8e8c84, metalness: 1.0, roughness: 0.07, envMapIntensity: 1.25, name: 'mirror' });
      const foxing = M.textures('plaster', { color: [0.5, 0.5, 0.5], cracks: 0.0, stains: 0.9 });
      mirrorMat.roughnessMap = foxing.withRepeat(1.4, 1.4).map;
      mirrorMat.roughness = 0.12;
      const mf = makeGiltFrame(ctx, mat, mirrorMat, 0.72, 1.12, { fw: 0.1 });
      mount(mf.group, -1, BAY_CENTERS[3], 1.82, 0.03);
      root.add(mf.group);
    }
    const consoleLight = new THREE.PointLight(0xffa04a, 1.4, 4.0, 2);
    {
      consoleT.group.updateMatrixWorld(true);
      consoleLight.position.copy(V3(0, 1.2, 0.22).applyMatrix4(consoleT.group.matrixWorld));
      root.add(consoleLight);
      ctx.onUpdate((dt, t) => { consoleLight.intensity = 1.4 * flicker(t, 5.5); });
    }
    // left bay 2: a pair of balloon-back side chairs under the colonel
    for (const dz of [-0.42, 0.42]) {
      const ch = makeSideChair(ctx, mat);
      mount(ch, -1, BAY_CENTERS[1] + dz, 0, 0.03);
      ch.rotation.y += dz > 0 ? -0.12 : 0.12;
      root.add(ch);
    }
    // right bay 1: a bust shrouded in a dust sheet on a marble pedestal
    const bust = makeCoveredBust(ctx, mat);
    mount(bust, 1, -2.75, 0, 0.32);
    root.add(bust);
    const bench = makeBench(ctx, mat);
    mount(bench, 1, BAY_CENTERS[2], 0, 0.02);
    root.add(bench);
    const clock = makeClock(ctx, mat);
    mount(clock, 1, BAY_CENTERS[4] + 0.2, 0, 0.02);
    root.add(clock);

    // ================================================================ puzzle panel (left wall, middle bay)
    const toyMat = await makePortraitMaterial(ctx, 'toymaker');
    const panel = new THREE.Group();
    panel.name = 'puzzlePanel';
    {
      const G = ctx.geometry;
      const back = new THREE.Mesh(G.raisedPanel(1.42, 1.66, { border: 0.12, bevel: 0.05, fieldDepth: 0.008 }), mat.doorWood);
      back.position.set(0, 0, 0.0); panel.add(back);
      const fr = makeGiltFrame(ctx, mat, mat.black, 0.93, 0.93, { fw: 0.12 });
      fr.canvas.visible = false;
      fr.group.position.set(0, 0.0, 0.03); panel.add(fr.group);
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
      backMaterial: mat.felt,
      edgeMaterial: mat.brass,
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
    const ghostCard = await makeGhostCard(ctx);
    const ghost = ghostCard.mesh;
    ghost.position.set(0.32, 0.9, -8.15);
    root.add(ghost);
    const ghostU = ghostCard.uniforms;
    let ghostBoost = 0;
    ctx.onUpdate((dt, t) => {
      ghost.position.y = 0.9 + Math.sin(t * 0.7) * 0.02;
      ghost.rotation.y = Math.atan2(ctx.camera.position.x - ghost.position.x, ctx.camera.position.z - ghost.position.z);
      // she comes and goes: never fully readable for long
      const cyc = Math.sin(t * 0.33) * 1.6 + 0.35 + Math.sin(t * 1.9) * 0.08;
      ghostU.uFade.value = THREE.MathUtils.clamp(cyc, 0, 1) * 0.85 + ghostBoost;
    });

    // ================================================================ moonlight + fills
    const moon = new THREE.SpotLight(0xa8bcff, 900, 30, 0.24, 0.75, 2);
    moon.position.set(0.35, 7.2, Z0 - 6.0);
    moon.target.position.set(-0.1, 0.0, -6.2);
    moon.castShadow = ctx.quality.shadows;
    moon.shadow.mapSize.set(ctx.quality.shadowMapSize, ctx.quality.shadowMapSize);
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.025; moon.shadow.radius = Math.max(6, ctx.quality.shadowRadius || 0); moon.shadow.blurSamples = 16;
    moon.shadow.camera.near = 3; moon.shadow.camera.far = 22;
    root.add(moon, moon.target);
    root.add(new THREE.HemisphereLight(0x3d5cc0, 0x1a1210, 1.15));
    root.add(fx.areaLight({ center: [0, WIN.sill + 1.2, Z0 + 0.05], normal: [0, -0.65, 1], width: WIN.w, height: WIN.h, color: 0x8ea6ff, intensity: 1.6 }));
    // warm glow from the foyer chandelier below the landing balustrade (the fitting itself is out of sight)
    const foyerGlow = new THREE.PointLight(0xffa860, 40, 14, 2);
    foyerGlow.position.set(0, -1.6, Z1 + 5.4);
    root.add(foyerGlow);
    // a gas lamp on the right-hand newel post lights the landing
    const landingFill = new THREE.PointLight(0xffb070, 2.5, 6, 2);
    {
      const G = ctx.geometry;
      const lamp = new THREE.Group();
      lamp.position.set(2.35, 1.15, Z1 + 2.6);
      const stem = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.07, 0], [0.072, 0.02], [0.04, 0.04], [0.03, 0.1], [0.018, 0.14], [0.016, 0.42], [0.026, 0.45], [0.012, 0.47], [0.03, 0.5], [0, 0.5]], 20), mat.brass);
      lamp.add(stem);
      const globeMat = makeGlobeMaterial(ctx);
      const globe = new THREE.Mesh(G.latheFromProfile([[0.03, 0], [0.06, 0.02], [0.085, 0.07], [0.09, 0.11], [0.08, 0.16], [0.05, 0.2], [0.045, 0.21], [0.05, 0.215]], 32), globeMat);
      globe.position.y = 0.5; globe.renderOrder = 2; lamp.add(globe);
      const mant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.04, 12), mat.mantle); mant.position.y = 0.58; lamp.add(mant);
      root.add(lamp);
      landingFill.position.set(2.2, 1.85, Z1 + 2.5);
      ctx.onUpdate((dt, t) => { const f = flicker(t, 12.7); landingFill.intensity = 2.5 * f; globeMat.emissiveIntensity = 0.8 * f; });
    }
    // a pendant lantern over the landing, its spill reaching back through the arch
    {
      const ln = makeLantern(ctx, mat, 1.0);
      ln.group.position.set(0, H, Z1 + 1.5);
      root.add(ln.group);
      const pl = new THREE.PointLight(0xffb070, 3.2, 7, 2);
      pl.position.set(0, H + ln.lightPos.y, Z1 + 1.5);
      root.add(pl);
      lanterns.push({ light: pl, seed: 31.7, base: 3.2 });
      const spill = new THREE.PointLight(0xffa860, 1.1, 5, 2);
      spill.position.set(0, 2.7, Z1 - 0.6);
      root.add(spill);
    }
    // a great dark landscape over the stairwell, lit from below by the chandelier
    {
      const pw = 2.2, ph = 1.45;
      const f = makeFramed(ctx, mat, M.create('painting', { subject: 0, seed: 11, aspect: pw / ph, size: 1024 }), pw, ph, { frameW: 0.16, cords: false });
      f.group.position.set(0, 2.0, Z1 + 8.55); f.group.rotation.y = Math.PI;
      root.add(f.group);
    }
    root.add(landingFill);

    // ---- what lies beyond the glass: sky dome, distant tree line, a near branch that sways
    {
      const sky = root.getObjectByName('sky');
      if (sky) { sky.scale.set(2.4, 1.4, 1); sky.position.set(0.6, 3.2, Z0 - 7.5); }
      const tl = treeLine(ctx);
      const tlm = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: tl.map, transparent: true, alphaTest: 0.02, color: new THREE.Color(1.3, 1.3, 1.5), name: 'treeLine' }));
      tlm.position.set(0.4, 0.4, Z0 - 5.0); tlm.userData.noShadow = true; tlm.name = 'treeLine'; root.add(tlm);
      const br = branchCard(ctx);
      const brm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: br.map, transparent: true, alphaTest: 0.05, name: 'branch' }));
      const pivot = new THREE.Group(); pivot.position.set(-1.6, 3.9, Z0 - 1.5); pivot.userData.dynamic = true;
      brm.position.set(1.3, -1.3, 0); brm.userData.noShadow = true; brm.name = 'branch'; pivot.add(brm); root.add(pivot);
      ctx.onUpdate((dt, t) => { pivot.rotation.z = Math.sin(t * 0.6) * 0.025 + Math.sin(t * 1.7) * 0.008; });
      // window seat: fringed cushion and two bolsters
      const G = ctx.geometry;
      const fr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0025, 0.0018, 0.05, 4), mat.velvetSeat, 120);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < 120; i++) { m4.makeTranslation(-WIN.w / 2 + 0.03 + i * ((WIN.w - 0.06) / 119), WIN.sill + 0.015, Z0 - WIN.depth / 2 + (WIN.depth - 0.05) / 2 + 0.005); fr.setMatrixAt(i, m4); }
      root.add(fr);
      for (const sx of [-1, 1]) {
        const bol = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.22, 6, 16), mat.velvet);
        bol.rotation.z = Math.PI / 2; bol.rotation.y = sx * 0.25; bol.position.set(sx * (WIN.w / 2 - 0.2), WIN.sill + 0.19, Z0 - WIN.depth / 2 - 0.05); root.add(bol);
        for (const e of [-1, 1]) { const tas = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0.0], [0.02, -0.03], [0.008, -0.05], [0, -0.05]], 8), mat.giltCap); tas.position.set(sx * (WIN.w / 2 - 0.2) + e * 0.19 * Math.cos(sx * 0.25), WIN.sill + 0.19, Z0 - WIN.depth / 2 - 0.05 - e * sx * 0.05); tas.rotation.z = e * Math.PI / 2; root.add(tas); }
      }
    }
    // ---- the game-room door: a leaded stained-glass transom lit faintly from the room beyond
    {
      const d = DOORS.gameroom;
      const tm = new THREE.MeshStandardMaterial({ map: transomTexture(ctx), emissiveMap: transomTexture(ctx), emissive: new THREE.Color(1.0, 0.8, 0.6), emissiveIntensity: 0.9, roughness: 0.15, metalness: 0, name: 'transom' });
      const t = new THREE.Mesh(new THREE.PlaneGeometry(d.w + 0.1, 0.34), tm);
      const g = new THREE.Group(); g.add(t); t.position.set(0, 0, 0.056);
      mount(g, 1, d.z, d.h + 0.24, 0.0);
      root.add(g);
    }
    // ---- the attic: a narrow, steep stair glimpsed behind the low door
    {
      const d = DOORS.attic, G = ctx.geometry;
      const st = new THREE.Group();
      for (let i = 0; i < 12; i++) {
        const tread = new THREE.Mesh(G.boxUV(0.26, 0.04, d.w - 0.04, 1), mat.wainscot);
        tread.position.set(X0 - 0.45 - i * 0.22, 0.2 + i * 0.22, d.z); st.add(tread);
        const riser = new THREE.Mesh(G.boxUV(0.02, 0.22, d.w - 0.04, 1), mat.black);
        riser.position.set(X0 - 0.33 - i * 0.22, 0.09 + i * 0.22, d.z); st.add(riser);
      }
      for (const sz of [-1, 1]) { const wl = new THREE.Mesh(G.boxUV(3.4, 3.6, 0.02, 1), mat.plasterLight); wl.position.set(X0 - 1.8, 1.8, d.z + sz * (d.w / 2 + 0.02)); st.add(wl); }
      root.add(st);
      const atticCold = new THREE.PointLight(0x7f95d8, 0.6, 3.5, 2); atticCold.position.set(X0 - 1.6, 2.6, d.z); root.add(atticCold);
    }

    // volumetric moon beam, dust in it, floor mist
    const winC = V3(0, WIN.sill + 0.4 + (WIN.h - 0.4) * 0.5, Z0 - 0.05);
    const beamDir = new THREE.Vector3().subVectors(moon.target.position, moon.position).normalize();
    const shaft = fx.shaft({
      center: winC, right: V3(WIN.w / 2, 0, 0), up: V3(0, (WIN.h - 0.4) * 0.5, 0), direction: beamDir, length: 7.5,
      color: 0x9fb6ff, intensity: 0.22, softness: 0.35, falloff: 1.1, panes: [2, 4], mullion: 0.03, noise: 0.7,
    });
    root.add(shaft);
    root.add(fx.dust({ box: new THREE.Box3(V3(X0 + 0.1, 0.05, Z0 + 0.1), V3(X1 - 0.1, 3.2, -2.5)), count: 1300, shafts: [shaft], size: 0.009, intensity: 1.6, ambient: 0.04 }));
    root.add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.05, 0, Z0 + 0.3), V3(X1 - 0.05, 0.6, Z1 - 0.2)), color: 0x080c18, litColor: 0x121a2e, density: 0.18, heightFalloff: 4 }));

    // ================================================================ navigation
    const nodes = {
      main: { position: [0.28, 1.62, 7.35], target: [-0.08, 1.48, -9.0], fov: 56, label: 'The gallery', look: { yaw: [-55, 55], pitch: [-28, 26] } },
      back: { position: [0.2, 1.62, 5.6], target: [0.0, 1.35, 14.0], fov: 58, label: 'The stair landing' },
      bedroom: { position: [-0.95, 1.62, 4.1], target: [1.6, 1.62, 2.75], fov: 58, label: 'The bedroom door' },
      portraits: { position: [0.62, 1.62, 1.15], target: [-1.6, 1.68, -0.75], fov: 56, label: 'The Toymaker', look: { yaw: [-60, 60], pitch: [-28, 26] } },
      gamedoor: { position: [-0.95, 1.62, -2.4], target: [1.6, 1.62, -4.05], fov: 58, label: 'The game room door' },
      far: { position: [0.12, 1.62, -3.4], target: [0.0, 1.62, -9.0], fov: 56, label: 'The window', look: { yaw: [-60, 60], pitch: [-28, 28] } },
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
    const panelBox = bbox(panel), clockBox = bbox(clock), consoleBox = bbox(consoleT.group), bustBox = bbox(bust);
    const say = (text) => ctx.say({ text, speaker: 'stauf', speakerName: 'Stauf' });
    const examine = (title, text) => () => ctx.ui.caption(text, { title });
    const hotspots = [
      { id: 'puzzle', nodes: ['portraits', 'main', 'bedroom'], box: panelBox, cursor: 'puzzle', label: "The Toymaker's likeness", puzzle: slide.puzzle, enabled: () => !ctx.state.isSolved(SLIDE_ID) },
      { id: 'puzzle-done', nodes: ['portraits'], box: panelBox, cursor: 'examine', label: 'The Toymaker', enabled: () => ctx.state.isSolved(SLIDE_ID), onActivate: async () => { ctx.audio.sfx('laugh'); await say('Handsome devil, isn\'t he? I had the eyes done *last*.'); } },
      { id: 'bust', nodes: ['portraits', 'gamedoor', 'bedroom'], box: bustBox, cursor: 'examine', label: 'A shrouded bust', onActivate: examine('Under the Sheet', 'Someone has covered a bust with a dust sheet. Under the cloth the features are just too sharp: the nose, the brow, the open mouth.') },
      { id: 'lady', nodes: ['main', 'bedroom'], object: pLady.group, cursor: 'examine', label: 'A lady in blue', onActivate: examine('The Lady in Blue', 'Her pearls are painted with real care. Her smile was painted over twice — you can see the ghost of a different mouth beneath the varnish.') },
      { id: 'colonel', nodes: ['bedroom', 'portraits', 'main'], object: pColonel.group, cursor: 'examine', label: 'The captain', onActivate: examine('The Captain', 'Scarlet coat, brass buttons, whiskers like a hedge in winter. A brass label once named him; someone has scratched it out with a pin.') },
      { id: 'child', nodes: ['portraits', 'gamedoor', 'bedroom'], object: pChild.group, cursor: 'talk', label: 'A pale child', onActivate: async () => { ctx.audio.sfx('chime', { freq: 1320 }); await ctx.ui.caption('A small child in a starched collar. For a moment you could swear the paint is still wet around the eyes.', { title: 'The Boy' }); } },
      { id: 'widow', nodes: ['portraits', 'gamedoor', 'bedroom'], object: pWidow.group, cursor: 'examine', label: 'A widow in black', onActivate: examine('The Widow', 'Black bombazine, a brooch at her throat. The canvas is warm to the touch, as though someone had been standing very close to it.') },
      { id: 'elder', nodes: ['main', 'back', 'portraits'], object: pElder.group, cursor: 'talk', label: 'An old man', onActivate: async () => { await say('My dear old patron. He *also* thought he could leave whenever he liked.'); } },
      { id: 'clock', nodes: ['far', 'attic', 'gamedoor'], box: clockBox, cursor: 'examine', label: 'The long-case clock', onActivate: () => { ctx.audio.chimeClock?.(1); ctx.ui.caption('Its hands are stopped at five minutes to midnight. Yet you can hear it ticking.', { title: 'The Clock' }); } },
      { id: 'window', nodes: ['far', 'attic'], box: { min: [-WIN.w / 2, WIN.sill + 0.1, Z0 - WIN.depth], max: [WIN.w / 2, WIN.sill + WIN.h, Z0 - WIN.depth + 0.2] }, cursor: 'examine', label: 'The window', onActivate: examine('The Window', 'The moon hangs over the grounds like a coin on a dead man\'s eye. Down in the garden nothing moves. Nothing at all.') },
      { id: 'attic-locked', nodes: ['attic', 'far'], box: dBox(DOORS.attic, 0.05), cursor: 'examine', label: 'A narrow door', enabled: () => !ctx.state.isSolved(SLIDE_ID), onActivate: async () => { ctx.audio.sfx('thud'); await ctx.ui.caption('Latched fast. The keyhole is shaped like a tiny eye — and it is shut.', { title: 'The Attic Door' }); } },
      { id: 'ghost', nodes: ['far', 'attic', 'main'], sphere: { center: [0.32, 1.1, -8.15], radius: 0.5 }, cursor: 'ghost', label: 'A grey shape', onActivate: () => ctx.cinematic(async (c, h) => {
        ctx.post.set({ saturation: 0.6, vignette: 0.6 }, 0.8);
        ghostBoost = 0.6;
        await ctx.nav.lookAt(V3(0.32, 1.45, -8.15), 1.2);
        await ctx.say({ text: 'She walks the gallery every night, looking for the child she lost. She never looks *up*.', speaker: 'stauf', speakerName: 'Stauf' });
        await h.wait(0.4);
        ghostBoost = 0;
        ctx.post.reset(1.2);
        await ctx.nav.returnToNode(1.0);
      }) },
      { id: 'console', nodes: ['portraits', 'gamedoor', 'far'], box: consoleBox, cursor: 'examine', label: 'A console table', onActivate: examine('Dried Roses', 'Roses dried in a blue jar, black at the edges, beside an empty birdcage. In the mirror above, the hall behind you looks a little longer than it should.') },
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
      grade: { exposure: 1.85, contrast: 1.1, saturation: 1.05, shadowTint: [0.76, 0.92, 1.28], splitAmount: 0.65, bloomStrength: 0.3, bloomThreshold: 1.35, godRayWeight: 0.35, godRayThreshold: 2.5, vignette: 0.48, aoIntensity: 1.1, aoRadius: 0.4, grain: 0.025 },
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
