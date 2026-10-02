import * as THREE from 'three';
import { L, V3 } from './lib.js';
import { buildShell, wallToWorld, OPEN } from './shell.js';
import { buildBookcase } from './bookcase.js';
import { buildProps, SPOTS } from './props.js';
import { buildGhost } from './ghost.js';
import { createTelescopePuzzle, telescopeMeta, PUZZLE_ID, RIDDLE, PHRASE } from './puzzleTelescope.js';
import { tapestryMap, globeMap, skylightMap, nightSky, riddleCard } from './textures.js';

/**
 * The Library — brick-and-timber walls, a coffered skylight ceiling washing the
 * room in moonlight, a columned bookcase, a terrestrial globe, the writing desk
 * and its oil lamp, a wing chair, a floating ghostly scholar, the Book of Hints
 * on its lectern, and the Telescope puzzle.
 */
const { X0, X1, Z0, Z1, H } = L;
const GHOST_POS = V3(-0.03, 1.83, 0.3);

export default {
  id: 'library',
  title: 'The Library',
  floorName: 'Ground Floor',
  map: { floor: 'ground', rect: [600, 250, 190, 200] },
  start: 'main',
  ambience: { wind: 0.35, creaks: 0.45, clock: 0.55, thunder: 0.2, rain: 0, heartbeat: 0, roomTone: 0.35 },
  music: { key: 45, mood: 'dread' },
  puzzles: [telescopeMeta],

  async build(ctx) {
    const { materials: M, fx } = ctx;
    const root = new THREE.Group();
    root.name = 'library';
    const hi = ctx.quality.textureSize >= 2048;
    if (ctx.params.get('ghostlab') === '1') return ghostLab(ctx, root);

    // ================================================================ materials
    const tap = tapestryMap(ctx);
    const tapRep = tap.withRepeat(1.3, 1.3);
    const glob = globeMap(ctx);
    const sky = skylightMap(ctx);
    const skyRep = sky.withRepeat(1, 1);
    const mat = {
      floor: M.create('wood', { species: 'oak', boards: 6, boardLength: 0.36, polish: 0.32, wear: 0.75, figure: 0.6, tint: [0.44, 0.39, 0.36], repeat: [1 / 3.0, 1 / 1.02], size: hi ? 2048 : 1024, physical: true, clearcoat: 0.18, clearcoatRoughness: 0.45, macro: 0.45 }),
      brick: M.create('brick', { color: [0.32, 0.15, 0.11], mortar: [0.3, 0.28, 0.26], rows: 8, cols: 4, soot: 0.55, repeat: [1 / 0.9, 1 / 0.56], size: hi ? 2048 : 1024, macro: 0.4 }),
      timber: M.create('wood', { species: 'oak', boards: 0, polish: 0.25, wear: 0.55, figure: 0.8, tint: [0.3, 0.24, 0.2], repeat: [1 / 1.6, 1 / 0.8], physical: true, clearcoat: 0.12, clearcoatRoughness: 0.5 }),
      timberDark: M.create('wood', { species: 'walnut', boards: 0, polish: 0.4, wear: 0.4, tint: [0.42, 0.36, 0.33], repeat: [1, 1], physical: true, clearcoat: 0.3, clearcoatRoughness: 0.35 }),
      beam: M.create('wood', { species: 'oak', boards: 0, polish: 0.2, wear: 0.5, figure: 0.8, tint: [0.27, 0.22, 0.19], repeat: [1 / 1.8, 1 / 0.9], physical: true, clearcoat: 0.1, clearcoatRoughness: 0.5 }),
      caseWood: M.create('wood', { species: 'walnut', boards: 0, polish: 0.65, wear: 0.3, tint: [0.42, 0.34, 0.3], repeat: [1.4, 1.4], physical: true, clearcoat: 0.45, clearcoatRoughness: 0.3 }),
      caseDark: new THREE.MeshStandardMaterial({ color: 0x0d0907, roughness: 0.85, metalness: 0 }),
      column: M.create('ebony', { repeat: [3, 1], color: [0.62, 0.82, 0.82] }),
      gilt: M.create('gold', { wear: 0.55, dirt: 0.65, repeat: [4, 1] }),
      giltCap: M.create('gold', { wear: 0.5, dirt: 0.7, repeat: [6, 6] }),
      frameGilt: M.create('gilded', { pattern: 1, repeats: 3, wear: 0.55, dirt: 0.7, repeat: [1 / 0.45, 1] }),
      mahogany: M.create('mahogany', { repeat: [1.5, 1.5], color: [0.55, 0.45, 0.42] }),
      doorWood: M.create('wood', { species: 'walnut', boards: 0, polish: 0.4, wear: 0.5, tint: [0.45, 0.38, 0.34], repeat: [1, 1], physical: true, clearcoat: 0.2, clearcoatRoughness: 0.4 }),
      deskLeather: M.create('leather', { color: [0.05, 0.12, 0.07], wear: 0.55, repeat: [2, 2] }),
      tapestry: new THREE.MeshPhysicalMaterial({ map: tapRep.map, normalMap: tapRep.normalMap, roughnessMap: tapRep.roughnessMap, roughness: 1, metalness: 0, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.55, 0.35, 0.25), envMapIntensity: 0.4, name: 'tapestry' }),
      brass: M.create('brass', { tarnish: 0.45, polish: 0.6, repeat: [2, 2] }),
      brassBright: M.create('brass', { tarnish: 0.2, polish: 0.85, repeat: [3, 3] }),
      iron: M.basic('iron', { color: 0x1c1b1a, roughness: 0.65 }),
      glassClear: M.basic('crystal', { transparent: true, opacity: 0.25 }),
      glassDark: new THREE.MeshPhysicalMaterial({ color: 0x0c140f, roughness: 0.08, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.85 }),
      lens: new THREE.MeshPhysicalMaterial({ color: 0x223040, roughness: 0.02, metalness: 0.2, clearcoat: 1 }),
      paper: new THREE.MeshStandardMaterial({ color: 0xc8b48c, roughness: 0.9, side: THREE.DoubleSide }),
      feather: new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.8, side: THREE.DoubleSide }),
      leatherBox: M.create('leather', { color: [0.2, 0.09, 0.05], wear: 0.5, repeat: [4, 4] }),
      leatherRed: M.create('leather', { color: [0.28, 0.04, 0.035], wear: 0.45, repeat: [4, 4] }),
      leatherGreen: M.create('leather', { color: [0.05, 0.12, 0.07], wear: 0.45, repeat: [4, 4] }),
      hintPages: new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.85, emissive: new THREE.Color(1.0, 0.82, 0.5), emissiveIntensity: 0.06 }),
      ribbon: new THREE.MeshStandardMaterial({ color: 0x5a0a10, roughness: 0.6, side: THREE.DoubleSide }),
      lampShade: new THREE.MeshStandardMaterial({ color: 0x302418, emissive: new THREE.Color(1.0, 0.66, 0.34), emissiveIntensity: 1.5, roughness: 0.4, transparent: true, opacity: 0.94, side: THREE.DoubleSide }),
      sconceShade: new THREE.MeshStandardMaterial({ color: 0x302418, emissive: new THREE.Color(1.0, 0.6, 0.3), emissiveIntensity: 2.0, roughness: 0.4, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
      globe: new THREE.MeshPhysicalMaterial({ map: glob.map, normalMap: glob.normalMap, roughnessMap: glob.roughnessMap, roughness: 1, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 0.35, name: 'globe' }),
      horizonRing: new THREE.MeshStandardMaterial({ color: 0xb59f74, roughness: 0.7 }),
      curtain: M.create('velvet', { color: [0.05, 0.08, 0.2], crush: 0.55, repeat: [2, 2], side: THREE.DoubleSide }),
      plasterDark: M.create('plaster', { color: [0.3, 0.29, 0.3], cracks: 0.4, stains: 0.5, repeat: [0.8, 0.8] }),
      windowFrame: new THREE.MeshStandardMaterial({ color: 0x0b0908, roughness: 0.6 }),
      glass: M.create('glass', { dirt: 0.6, transparent: true, opacity: 0.16 }),
      sky: new THREE.MeshBasicMaterial({ map: nightSky(ctx).map, color: new THREE.Color(1, 1, 1).multiplyScalar(2.6), toneMapped: false }),
      skylight: new THREE.MeshBasicMaterial({ map: skyRep.map, vertexColors: true, color: new THREE.Color(0.62, 0.74, 1.0).multiplyScalar(0.9), toneMapped: false, name: 'skylight-glass' }),
      sand: new THREE.MeshStandardMaterial({ color: 0xb89a66, roughness: 0.95 }),
      wax: M.create('wax', { color: [0.88, 0.83, 0.7], drips: 0.6, size: 256 }),
      bone: M.basic('bone'),
      black: new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.9 }),
      miniature: M.create('painting', { subject: 1, seed: 77, aspect: 0.77, size: 512 }),
      cord: new THREE.MeshStandardMaterial({ color: 0x1a0c08, roughness: 0.8 }),
    };

    // ================================================================ build
    const shell = buildShell(ctx, root, mat);
    const bookcase = buildBookcase(ctx, root, mat);
    const props = buildProps(ctx, root, mat);
    const ghost = await buildGhost(ctx, root);

    // riddle card on the bay-window sill
    const cardTex = riddleCard(ctx, RIDDLE);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.14), new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.85 }));
    card.name = 'riddle-card';
    card.position.copy(wallToWorld('left', OPEN.bay.x + OPEN.bay.w / 2 + 0.25, OPEN.bay.y + 0.006, 0.1));
    card.rotation.set(-Math.PI / 2, 0, Math.PI / 2 + 0.25);
    card.receiveShadow = true;
    root.add(card);

    // candlestick pair on the bookcase counter (warm light on the books)
    {
      const cs = new THREE.Group();
      const lathe = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), 24);
      for (const dx of [-0.11, 0.11]) {
        const stick = new THREE.Mesh(lathe([[0.001, 0], [0.055, 0], [0.05, 0.012], [0.018, 0.04], [0.012, 0.16], [0.022, 0.2], [0.03, 0.215], [0.001, 0.215]]), mat.brass);
        stick.position.x = dx; cs.add(stick);
        const c = fx.candle({ height: 0.17 + (dx > 0 ? -0.04 : 0), radius: 0.012, light: false, seed: dx > 0 ? 5 : 9, burn: 0.7 });
        c.position.set(dx, 0.215, 0); cs.add(c);
      }
      cs.position.copy(bookcase.toWorld(0.95, 0.8, 0.3));
      root.add(cs);
      const pl = new THREE.PointLight(0xffa456, 1.6, 5, 2);
      pl.position.copy(bookcase.toWorld(0.95, 1.12, 0.42));
      root.add(pl);
      ctx.onUpdate((dt, t) => { pl.intensity = 1.6 * (0.93 + 0.07 * Math.sin(t * 8.3) * Math.sin(t * 3.1 + 1)); });
    }

    // ================================================================ telescope aim + puzzle
    const friezeWorld = bookcase.frieze.worldCenter.clone();
    props.telescopeTube.lookAt(props.telescopeTube.getWorldPosition(new THREE.Vector3()).multiplyScalar(2).sub(friezeWorld));
    props.telescope.updateMatrixWorld(true);
    const eyePose = () => {
      const tube = props.telescopeTube;
      tube.updateMatrixWorld(true);
      const pos = tube.localToWorld(V3(0, 0.0, 0.8));
      return { position: pos.toArray(), target: friezeWorld.toArray(), fov: 10.5 };
    };
    const tel = createTelescopePuzzle(ctx, {
      parent: bookcase.group,
      frieze: bookcase.frieze,
      telescope: { tubeVisible: (v) => { props.telescopeTube.visible = v; } },
      eyePose,
      onSolvedFx: () => {
        ctx.state.set('library.friezeSpoken', true);
        props.lampBase = 5.5;
        setTimeout(() => { props.lampBase = 3.0; }, 2500);
        ctx.say?.({ text: 'The house is hungry, my guest. And you — you look *delicious*.', speaker: 'stauf', speakerName: 'Stauf' });
      },
    });

    // ================================================================ ghost placement + idle motion
    const g = ghost.group;
    g.position.copy(GHOST_POS);
    g.scale.setScalar(1.12);
    const faceTo = V3(0.05, 1.62, 1.45);
    g.rotation.y = Math.atan2(faceTo.x - GHOST_POS.x, faceTo.z - GHOST_POS.z) + 0.12;
    g.rotation.x = 0.05;
    g.rotation.z = -0.04;
    ctx.onUpdate((dt, t) => {
      g.position.y = GHOST_POS.y + Math.sin(t * 0.7) * 0.025;
      g.rotation.z = -0.04 + Math.sin(t * 0.45) * 0.02;
    });

    // ================================================================ lighting
    // moonlight through the skylights (shadowed by the beam grid)
    const moon = new THREE.SpotLight(0xa8bcff, 2600, 26, 0.5, 0.55, 2);
    moon.position.set(-2.6, 10.5, 2.4);
    moon.target.position.set(-0.6, 0, -1.6);
    moon.castShadow = ctx.quality.shadows;
    moon.shadow.mapSize.set(ctx.quality.shadowMapSize, ctx.quality.shadowMapSize);
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.03; moon.shadow.radius = ctx.quality.shadowRadius;
    moon.shadow.camera.near = 4; moon.shadow.camera.far = 20;
    root.add(moon, moon.target);
    // cool skylight spill + deep-blue ambient
    root.add(fx.areaLight({ center: [(X0 + X1) / 2, H - 0.03, (Z0 + Z1) / 2], normal: [0, -1, 0], width: L.W * 0.8, height: L.D * 0.8, color: 0x8ea6ff, intensity: 0.6 }));
    root.add(new THREE.HemisphereLight(0x3a4778, 0x2a1a10, 0.5));
    // the bay window's moon spill
    root.add(fx.areaLight({ center: wallToWorld('left', OPEN.bay.x + OPEN.bay.w / 2, OPEN.bay.y + 1.1, 0.05).toArray(), normal: [1, -0.2, 0], width: OPEN.bay.w, height: OPEN.bay.h, color: 0x8ea6ff, intensity: 3 }));
    // a cold key on the ghost's face (as if a skylight pane singled him out)
    const gk = new THREE.SpotLight(0xc8d8ff, 9, 5, 0.2, 0.8, 2);
    gk.position.copy(GHOST_POS).add(V3(-0.9, 1.3, 0.7));
    gk.target.position.copy(GHOST_POS).add(V3(0, 0.08, 0));
    root.add(gk, gk.target);

    // ================================================================ volumetrics: shafts from the skylights + dust + floor mist
    const moonDir = new THREE.Vector3().subVectors(moon.target.position, moon.position).normalize();
    const shafts = [];
    const { bx, bz } = shell.coffer;
    for (const [i, j, s] of [[1, 3, 0.32], [2, 2, 0.26], [1, 1, 0.22], [2, 4, 0.2]]) {
      const cx = (bx(i) + bx(i + 1)) / 2, cz = (bz(j) + bz(j + 1)) / 2;
      const w = (bx(i + 1) - bx(i)) - 0.55, d = (bz(j + 1) - bz(j)) - 0.5;
      const sh = fx.shaft({ center: V3(cx, H + 0.35, cz), right: V3(w / 2, 0, 0), up: V3(0, 0, d / 2), direction: moonDir, length: 4.4, color: 0x9fb6ff, intensity: s, softness: 0.4, falloff: 0.9, panes: [3, 3], mullion: 0.02, noise: 0.8 });
      root.add(sh);
      shafts.push(sh);
    }
    const dust = fx.dust({ box: new THREE.Box3(V3(-3.0, 0.1, -4.2), V3(1.2, 3.3, 1.6)), count: Math.round(2600 * (ctx.quality.particles ?? 1)), shafts, size: 0.01, intensity: 2.0, ambient: 0.04 });
    root.add(dust);
    const mist = fx.fog({ box: new THREE.Box3(V3(X0 + 0.2, 0, Z0 + 0.6), V3(X1 - 0.2, 0.5, Z1 - 0.4)), color: 0x0a0f1a, litColor: 0x2c3a58, density: 0.45, heightFalloff: 5 });
    root.add(mist);

    // ================================================================ navigation
    const nodes = {
      main: { position: [0.05, 1.62, 1.45], target: [0.0, 1.68, -5.0], fov: 58, label: 'The Library', look: { yaw: [-55, 50], pitch: [-30, 32] } },
      main_back: { position: [0.05, 1.62, 1.6], target: [-1.2, 1.35, 7.0], fov: 58, label: 'The way out' },
      shelves: { position: [-2.05, 1.62, -1.95], target: [-2.25, 1.95, -5.0], fov: 58, label: 'The bookcase', look: { yaw: [-50, 50], pitch: [-30, 38] } },
      bay: { position: [-1.9, 1.6, 0.35], target: [-4.3, 1.35, 2.2], fov: 56, label: 'The telescope', look: { yaw: [-50, 50], pitch: [-30, 32] } },
      door: { position: [-0.6, 1.62, -1.9], target: [1.1, 1.45, -3.85], fov: 56, label: 'The music-room door' },
      corner: { position: [-1.2, 1.62, -3.4], target: [0.2, 1.25, 3.8], fov: 58, label: 'The reading corner', look: { yaw: [-50, 50], pitch: [-28, 30] } },
    };
    const edges = [
      ['main', 'main_back'],
      ['main', 'shelves', [[-0.6, 1.62, 0.4], [-1.35, 1.62, -1.2]], { duration: 3.6 }],
      ['main', 'bay', [[-0.8, 1.62, 1.5]]],
      ['main', 'door', [[-0.3, 1.62, 0.6], [-0.55, 1.62, -1.0]]],
      ['bay', 'shelves', [[-1.9, 1.62, -0.7]]],
      ['shelves', 'door'],
      ['shelves', 'corner'],
      ['corner', 'door'],
      ['corner', 'bay', [[-1.6, 1.62, -1.2]]],
      ['main_back', 'corner', null, { hidden: true }],
    ];
    const exits = [
      { node: 'main_back', toRoom: 'foyer', toNode: 'center_e', label: 'Back to the foyer', hotspot: { box: { min: [-2.55, 0.1, Z1 - 0.25], max: [-0.9, 2.65, Z1 + 0.1] } } },
      { node: 'door', toRoom: 'music', toNode: null, label: 'The music room', hotspot: { box: { min: [X1 - 0.3, 0.05, Z0 + OPEN.rightDoor.x], max: [X1 + 0.05, 2.45, Z0 + OPEN.rightDoor.x + OPEN.rightDoor.w] } } },
    ];

    // ================================================================ hotspots
    let ghostTalks = 0;
    const ghostLines = [
      { text: 'Shh! A library, sir. Even the dead keep their voices down… mostly.', speaker: 'ghost', speakerName: 'The Scholar' },
      { text: 'Forty years I catalogued this room for him. He never once returned a book.', speaker: 'ghost', speakerName: 'The Scholar' },
      { text: 'He reads from a distance, does Stauf. Mind the telescope — it sees what the eye will not.', speaker: 'ghost', speakerName: 'The Scholar' },
    ];
    const hotspots = [
      {
        id: 'ghost', nodes: ['main', 'shelves', 'door', 'corner'], sphere: { center: GHOST_POS.clone().add(V3(0, -0.05, 0)).toArray(), radius: 0.32 }, cursor: 'ghost', label: 'A pale scholar',
        onActivate: () => ctx.cinematic(async (c, h) => {
          ctx.post.set({ saturation: 0.6, vignette: 0.6 }, 0.8);
          await ctx.nav.lookAt(GHOST_POS.clone().add(V3(0, 0.1, 0)), 1.1);
          await ctx.say(ghostLines[ghostTalks++ % ghostLines.length]);
          await h.wait(0.4);
          ctx.post.reset(1.0);
          await ctx.nav.returnToNode(1.0);
        }),
      },
      {
        id: 'telescope', nodes: ['bay', 'main'], object: props.telescope, cursor: 'puzzle', label: 'The telescope',
        puzzle: tel.puzzle,
      },
      {
        id: 'riddle', nodes: ['bay'], object: card, cursor: 'examine', label: 'A card on the sill',
        onActivate: () => { ctx.audio.sfx('page'); ctx.ui.caption(RIDDLE.join(' '), { title: 'A card, signed “H. S.”', duration: 9 }); },
      },
      {
        id: 'globe', nodes: ['main', 'door', 'corner', 'shelves'], object: props.globe, cursor: 'examine', label: 'The globe',
        onActivate: () => { spin.v = 3.5; ctx.ui.caption('Every coastline is wrong. Somebody has drawn a black dot where the house should be — on every continent.', { title: 'The Globe' }); },
      },
      {
        id: 'desk', nodes: ['bay', 'main'], object: props.desk, cursor: 'examine', label: 'The writing desk',
        onActivate: () => ctx.ui.caption('A ledger of guests, each name struck through in a careful hand. The ink on the last line is still wet.', { title: 'The Desk' }),
      },
      {
        id: 'wing', nodes: ['main', 'corner'], object: props.wing, cursor: 'examine', label: 'The wing chair',
        onActivate: () => ctx.ui.caption('The cushion is still warm, and pressed into the shape of someone who is not there.', { title: 'The Wing Chair' }),
      },
      {
        id: 'frieze', nodes: ['shelves'], box: { min: [-3.05, 2.72, -4.6], max: [-1.45, 3.0, -4.3] }, cursor: 'examine', label: 'The frieze',
        onActivate: () => ctx.ui.caption('A row of little brass blocks, far too small and too dusty to read from down here.', { title: 'The Frieze' }),
      },
      {
        id: 'books', nodes: ['shelves'], box: { min: [-4.0, 0.85, -4.75], max: [-0.5, 2.6, -4.6] }, cursor: 'examine', label: 'The books',
        onActivate: () => ctx.ui.caption('Every spine is blank but one, and that one reads only “Your Name Here”.', { title: 'The Shelves' }),
      },
      {
        id: 'hints', nodes: ['main_back', 'corner'], object: props.hintBook, cursor: 'examine', label: 'The Book of Hints',
        onActivate: () => { ctx.audio.sfx('page'); const game = ctx.ui.game || window.__game; if (game?.openHints) game.openHints(PUZZLE_ID); else ctx.ui.caption('The Book of Hints lies open, its pages waiting.', { title: 'The Book of Hints' }); },
      },
    ];
    const spin = { v: 0 };
    ctx.onUpdate((dt) => { if (spin.v > 0.001) { props.globeSphere.rotation.y += spin.v * dt; spin.v *= Math.exp(-dt * 0.8); } });

    // ================================================================ QA / debug hooks
    if (typeof window !== 'undefined') {
      const dbg = (window.__debug ||= {});
      dbg.solvers ||= {};
      dbg.states ||= {};
      dbg.solvers.library = async () => {
        const game = window.__game;
        if (game && !game.puzzle && game.room?.mod?.id === 'library') {
          game.startPuzzle(tel.puzzle);
          await new Promise((r) => setTimeout(r, 60));
        }
        if (game?.puzzle?.def?.id === PUZZLE_ID) { tel.puzzle.autoSolve(game.puzzle.pctx); return true; }
        tel.applySolved(); ctx.state.markSolved?.(PUZZLE_ID);
        return true;
      };
      dbg.states.library = () => ({ phrase: PHRASE, frieze: tel.letters(), alignedNow: tel.isSolvedNow(), isSolved: ctx.state.isSolved(PUZZLE_ID), node: ctx.nav.current });
      dbg.solve ||= (id) => (dbg.solvers[id] ? dbg.solvers[id]() : Promise.reject(new Error(`no solver for ${id}`)));
      dbg.state ||= (id) => (dbg.states[id] ? dbg.states[id]() : null);
      dbg.library = { turn: (i, d) => tel.turn(i, d), letters: tel.letters, reset: tel.resetState, puzzle: tel.puzzle };
    }

    // ================================================================ shadow flags
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      const fxLike = o.isPoints || m?.isShaderMaterial || m?.isMeshBasicMaterial || (m?.transparent && (m.opacity ?? 1) < 0.6) || o.userData.noBake || o.userData.noShadow;
      if (fxLike) o.castShadow = false;
      else if (o.castShadow === false && !o.name.startsWith('floor')) o.castShadow = true;
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });
    // the floor, rug, ceiling glass never cast
    root.getObjectByName('floor').castShadow = false;

    const godRays = [
      { position: V3(-1.6, H + 0.4, 0.4), color: new THREE.Color(0.7, 0.8, 1.0), strength: 0.35, radius: 0.3 },
    ];

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'main',
      grade: { exposure: 1.75, contrast: 1.12, saturation: 0.9, bloomStrength: 0.35, bloomThreshold: 1.6, godRayWeight: 0.3, vignette: 0.48, aoIntensity: 1.2, aoRadius: 0.4 },
      environment: { position: [-0.6, 1.9, -0.8], intensity: 0.8 },
      onEnter() {
        if (!ctx.state.has('library.greeted')) {
          ctx.state.set('library.greeted', true);
          setTimeout(() => ctx.say({ text: 'My library. Read anything you like, my guest — the endings are all the *same*.', speaker: 'stauf', speakerName: 'Stauf' }), 1500);
        }
      },
      update() {},
      dispose() { if (window.__debug?.library) delete window.__debug.library; },
    };
  },
};

// Look-dev stage for the ghost (?ghostlab=1): just the bust, a backdrop and the face key.
async function ghostLab(ctx, root) {
  const ghost = await buildGhost(ctx, root);
  const g = ghost.group;
  g.position.copy(GHOST_POS);
  const yaw = Number(ctx.params.get('yaw') || 0);
  g.rotation.y = yaw;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.9 }));
  back.position.set(GHOST_POS.x, GHOST_POS.y, GHOST_POS.z - 2.5);
  root.add(back);
  const gk = new THREE.SpotLight(0xc8d8ff, Number(ctx.params.get('key') || 26), 5, 0.22, 0.8, 2);
  gk.position.copy(GHOST_POS).add(V3(-0.9, 1.5, 0.9));
  gk.target.position.copy(GHOST_POS).add(V3(0, 0.08, 0));
  root.add(gk, gk.target);
  root.add(new THREE.HemisphereLight(0x3a4778, 0x2a1a10, 0.5));
  const warm = new THREE.PointLight(0xffa252, 3, 10, 2);
  warm.position.copy(GHOST_POS).add(V3(1.6, -0.6, 0.8));
  root.add(warm);
  const c = GHOST_POS.clone().add(V3(0, 0.02, 0));
  return {
    scene: root,
    nodes: {
      main: { position: c.clone().add(V3(0, 0.05, 0.75)).toArray(), target: c.toArray(), fov: 30 },
      side: { position: c.clone().add(V3(0.75, 0.05, 0.1)).toArray(), target: c.toArray(), fov: 30 },
      far: { position: c.clone().add(V3(0.2, -0.2, 1.9)).toArray(), target: c.clone().add(V3(0, -0.12, 0)).toArray(), fov: 40 },
    },
    edges: [], exits: [], hotspots: [],
    grade: { exposure: 1.9, contrast: 1.1, saturation: 0.92, bloomStrength: 0.35, bloomThreshold: 1.6, vignette: 0.45 },
    environment: { position: [0, 1.5, 0], intensity: 0.5 },
  };
}
