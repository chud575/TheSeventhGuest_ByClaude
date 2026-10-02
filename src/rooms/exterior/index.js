import * as THREE from 'three';
import { applyMacroVariation } from '../../engine/materials/index.js';
import { createFogUniforms, patchFog, rng, mat4 } from './lib.js';
import { makeTextures, pbr } from './textures.js';
import { createSky } from './sky.js';
import { height, buildTerrain, buildPath, buildGrass, grassTexture, GATE_Z } from './terrain.js';
import { buildMansion, F, DOOR, TOWER, PORCH } from './mansion.js';
import { gnarledTree } from './trees.js';
import { buildGate } from './gate.js';
import { buildGraveyard, placeTree, buildDressing } from './props.js';
import { buildMist } from './mist.js';
import { createMedallion, createGatePuzzle, gateMeta } from './puzzleGate.js';

/**
 * exterior — "The Approach": the night climb up the hill to Stauf Manor.
 * Title-screen backdrop and opening cinematic. Full moon behind racing cloud,
 * lightning, ground mist pooling in the valley, gnarled dead oaks, the iron gate
 * (its medallion lock is the room's puzzle), the family plot, and the house
 * itself with a few lamp-lit windows and the front door waiting.
 */

const MOON_DIR = new THREE.Vector3(-0.18, 0.5, -0.847).normalize();
const v3 = (a) => new THREE.Vector3(...a);
// the moonlight comes from a little higher than the visible disc (a cinematographer's cheat: shorter house shadow)
const LIGHT_DIR = new THREE.Vector3(-0.2, 0.66, -0.72).normalize();

// lightning schedule (seconds within a 41 s cycle): strike times; each strike is a few flickers
const STRIKES = [6.2, 17.8, 18.35, 29.4, 36.9];
function flashAt(t) {
  const c = ((t % 41) + 41) % 41;
  let f = 0;
  for (const s of STRIKES) {
    const d = c - s;
    if (d < 0 || d > 1.4) continue;
    // main stroke + two return strokes, decaying
    f = Math.max(f, Math.exp(-d * 9) * 1.0, d > 0.12 ? Math.exp(-(d - 0.12) * 14) * 0.75 : 0, d > 0.3 ? Math.exp(-(d - 0.3) * 6) * 0.45 : 0);
  }
  return f;
}

export default {
  id: 'exterior',
  title: 'The Approach',
  floorName: 'Stauf Manor',
  map: { floor: 'ground', rect: [400, 560, 200, 70] },
  start: 'main',
  ambience: { wind: 0.95, creaks: 0.15, clock: 0, thunder: 0.8, rain: 0, heartbeat: 0, roomTone: 0.0 },
  music: { mood: 'dread' },
  puzzles: [gateMeta],

  async build(ctx) {
    const root = new THREE.Group();
    root.name = 'exterior';
    const P = ctx.params;
    if (P.get('mdir')) MOON_DIR.set(...P.get('mdir').split(',').map(Number)).normalize();
    const U = createFogUniforms();
    U.uHFogMoonDir.value.copy(MOON_DIR);
    U.uHFogTime = ctx.time;   // share the engine clock
    for (const [k, u] of [['fogd', 'uHFogDensity'], ['fogb', 'uHFogBase'], ['fogf', 'uHFogFalloff'], ['haze', 'uHFogHaze']]) if (P.get(k) !== null) U[u].value = Number(P.get(k));

    // ------------------------------------------------------------ materials
    const TX = makeTextures(ctx);
    const M = {
      siding: pbr(TX.siding, { name: 'siding', color: 0xb8c0d0 }),
      trim: pbr(TX.trim, { name: 'trim', color: 0xb4b8c2 }),
      sash: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.55, name: 'sash' }),
      slate: pbr(TX.slate, { name: 'slate', envMapIntensity: 1.3 }),
      slateDark: pbr(TX.slate, { name: 'slateDark', color: 0x8890a0, repeat: [1, 1] }),
      ashlar: pbr(TX.ashlar, { name: 'ashlar', color: 0xc8c8cc }),
      stoneDark: pbr(TX.ashlar, { name: 'stoneDark', color: 0x7c7e84 }),
      brick: ctx.materials.create('brick', { color: [0.3, 0.13, 0.09], soot: 0.7, rows: 8, cols: 4 }),
      iron: pbr(TX.iron, { name: 'iron', repeat: [4, 4], envMapIntensity: 1.2 }),
      porchFloor: ctx.materials.create('floorboards', { color: 0x66605a, repeat: [1, 1] }),
      doorWood: ctx.materials.create('walnut', { repeat: [1, 1], color: 0x8a6a58 }),
      brass: ctx.materials.create('brass', { tarnish: 0.5, polish: 0.6 }),
      terracotta: new THREE.MeshStandardMaterial({ color: 0x3a1e14, roughness: 0.85, name: 'terracotta' }),
      mound: pbr(TX.ground, { name: 'mound', color: 0x9a9080 }),
      rock: pbr(TX.rock, { name: 'rock', color: 0xb0b0b4 }),
      _x: null,
      lanternGlass: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(1.0, 0.62, 0.3), emissiveIntensity: 7, roughness: 0.2, transparent: true, opacity: 0.92, name: 'lanternGlass' }),
    };
    M.iron.color.setScalar(1.0);
    M.rock.userData.groundShade = true;
    for (const k of ['siding', 'slate', 'ashlar', 'stoneDark']) applyMacroVariation(M[k], { amount: 0.45, scale: 0.18 });

    // ------------------------------------------------------------ sky
    const sky = createSky({ timeUniform: ctx.time, moonDir: MOON_DIR });
    root.add(sky.mesh);
    if (P.get('skyoff')) sky.mesh.visible = false;

    // ------------------------------------------------------------ terrain + path + grass
    const groundMat = pbr(TX.ground, { name: 'ground', color: 0x3a3833 });
    applyMacroVariation(groundMat, { amount: 0.8, scale: 0.09 });
    groundMat.userData.groundShade = true;
    const terrain = buildTerrain({ material: groundMat });
    root.add(terrain);
    const pathMat = pbr(TX.path, { name: 'path', alphaTest: 0.5, color: 0xc4c0b8 });
    pathMat.userData.groundShade = true;
    pathMat.polygonOffset = true; pathMat.polygonOffsetFactor = -2; pathMat.polygonOffsetUnits = -2;
    root.add(buildPath({ material: pathMat }));
    const grassMat = new THREE.MeshStandardMaterial({ map: grassTexture(ctx), alphaTest: 0.4, side: THREE.FrontSide, roughness: 0.9, color: 0x5e584a, name: 'grass' });
    grassMat.userData.groundShade = true;
    root.add(buildGrass({
      material: grassMat, count: ctx.quality.particles >= 1 ? 14000 : 7000,
      regions: [
        { x0: -14, x1: 16, z0: 33, z1: 54, weight: 5 },   // valley side of the gate (hero foreground)
        { x0: -6, x1: 9, z0: 36, z1: 52, weight: 3 },     // either side of the path near the camera
        { x0: -12, x1: 12, z0: 12, z1: 31, weight: 3 },   // the drive
        { x0: -24, x1: -12, z0: 8, z1: 40, weight: 1.2 },
        { x0: 12, x1: 26, z0: 8, z1: 40, weight: 1.2 },
        { x0: -11, x1: 11, z0: -10, z1: 11, weight: 1.0 },
      ],
      avoid: [[0, 7, 10.2], [9, 6, 3.2], [-10.5, 21, 1.0]],
    }));

    // ------------------------------------------------------------ mansion
    const house = buildMansion(ctx, M);
    root.add(house.group);

    // ------------------------------------------------------------ gate + fence + medallion lock
    const gate = buildGate(ctx, M);
    root.add(gate.group);
    const med = createMedallion(ctx);
    med.group.position.set(-0.03, 1.5, 0.05);
    gate.rightLeaf.add(med.group);
    // the medallion straddles the meeting stiles; it rides with the right leaf
    med.group.position.x = -(gate.rightLeaf.position.x) + 0.0;
    root.updateMatrixWorld(true);
    const medWorld = new THREE.Vector3();
    med.group.getWorldPosition(medWorld);

    // ------------------------------------------------------------ trees
    const barkMat = pbr(TX.bark, { name: 'bark', color: 0xa09890 });
    const trees = [
      { seed: 11, x: 19.0, z: 37.5, ry: 0.4, s: 1.1, height: 11, trunkR: 0.62, spread: 1.15 },     // hero foreground, frames the right
      { seed: 23, x: 11.5, z: 30.5, ry: 2.2, s: 1.05, height: 10, trunkR: 0.5 },
      { seed: 37, x: -16, z: -4, ry: 1.1, s: 1.2, height: 12, trunkR: 0.55 },
      { seed: 41, x: 17, z: -9, ry: 0.2, s: 1.15, height: 11, trunkR: 0.5 },
      { seed: 53, x: -8.2, z: 26.8, ry: 3.0, s: 0.95, height: 9, trunkR: 0.45 },
      { seed: 67, x: 7.5, z: 19.0, ry: 4.0, s: 0.8, height: 8, trunkR: 0.38 },
      { seed: 71, x: 21, z: 44, ry: 1.0, s: 1.1, height: 10, trunkR: 0.5 },
    ];
    for (const t of trees) {
      const g = gnarledTree({ seed: t.seed, height: t.height, trunkR: t.trunkR, spread: t.spread ?? 1, depth: 5 });
      root.add(placeTree(g, barkMat, t));
    }

    // ------------------------------------------------------------ foreground dressing
    M.bark = barkMat;
    root.add(buildDressing(ctx, M, {
      rocks: [[7.0, 41.5, 0.9, 0.3], [8.3, 42.7, 0.5, 1.2], [6.1, 42.4, 0.32, 2.0], [-0.9, 40.4, 0.55, 0.8], [-1.7, 39.6, 0.3, 1.4], [9.5, 44.5, 1.1, 0.3],
        [2.6, 34.2, 0.4, 0.5], [-2.9, 34.6, 0.5, 2.3], [14.5, 40.0, 1.4, 0.7], [-9, 38.5, 1.2, 1.9], [6.5, 51.5, 0.5, 0.2]],
      bushes: [[7.7, 40.6, 1.0, 5], [-1.3, 39.0, 0.9, 8], [9.6, 38.4, 1.1, 31], [12.8, 41.5, 1.2, 12], [-6.5, 40.2, 1.1, 17], [3.4, 35.5, 0.7, 21], [-1.8, 35.2, 0.8, 26]],
    }));

    // ------------------------------------------------------------ graveyard
    const graves = buildGraveyard(ctx, M, { cx: -10.5, cz: 21 });
    root.add(graves.group);

    // ------------------------------------------------------------ lights
    const moon = new THREE.DirectionalLight(0xa8bcff, Number(P.get('moon') || 2.0));
    const shadowCenter = new THREE.Vector3(0, 0, 14);
    moon.position.copy(shadowCenter).addScaledVector(P.get('ldir') ? new THREE.Vector3(...P.get('ldir').split(',').map(Number)).normalize() : LIGHT_DIR, 60);
    moon.target.position.copy(shadowCenter);
    moon.castShadow = ctx.quality.shadows;
    moon.shadow.mapSize.set(ctx.quality.shadowMapSize, ctx.quality.shadowMapSize);
    Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 34, bottom: -34, near: 20, far: 110 });
    moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.04; moon.shadow.radius = 3;
    moon.shadow.camera.updateProjectionMatrix();
    root.add(moon, moon.target);
    // cool sky fill from the open sky in front (no shadows)
    const fill = new THREE.DirectionalLight(0x6f86c8, Number(P.get('fill') || 0.35));
    fill.position.set(-30, 25, 60); fill.target.position.set(0, 4, 0);
    root.add(fill, fill.target);
    // cinematic key: cool, high and to the front-right so the facades read under the backlit moon
    const key = new THREE.DirectionalLight(0x8fa6e8, Number(P.get('key') || 0.55));
    key.position.set(60, 28, 22); key.target.position.set(0, 5, 0);
    root.add(key, key.target);
    const hemi = new THREE.HemisphereLight(0x3a4c80, 0x0e0c0a, Number(P.get('hemi') || 0.6));
    root.add(hemi);
    // lightning (key light from the strike direction)
    const bolt = new THREE.DirectionalLight(0xc8d4ff, 0);
    bolt.position.set(-40, 50, -30); bolt.target.position.set(0, 0, 10);
    root.add(bolt, bolt.target);
    // porch lanterns flanking the door + warm spill from the hall through the open door
    const porchLights = [];
    for (const s of [-1, 1]) {
      const x = s * (DOOR.w / 2 + 0.95);
      const L = new THREE.Group();
      L.position.set(x, F + 2.6, TOWER.z1 + 0.22);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.36, 6), M.lanternGlass);
      L.add(body);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 6), M.iron); cap.position.y = 0.27; L.add(cap);
      const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.03, 0.12, 6), M.iron); bot.position.y = -0.24; L.add(bot);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.24), M.iron); arm.position.set(0, 0.1, -0.12); L.add(arm);
      root.add(L);
      const pl = new THREE.PointLight(0xffa04c, 7, 12, 2);
      pl.position.set(x, F + 2.6, TOWER.z1 + 0.45);
      root.add(pl);
      porchLights.push(pl);
    }
    const doorSpill = new THREE.SpotLight(0xffa860, 0, 16, 0.75, 0.6, 2);
    doorSpill.position.set(0, F + 2.3, TOWER.z1 - 0.8);
    doorSpill.target.position.set(0, 0, TOWER.z1 + 6);
    root.add(doorSpill, doorSpill.target);
    // warm spill from a few lit windows
    for (const [x, y, z, i] of [[-6.7, F + 2.2, 7.9, 2.5], [0, 10.9, 8.9, 2.0]]) {
      const pl = new THREE.PointLight(0xff9a50, i, 8, 2);
      pl.position.set(x, y, z);
      root.add(pl);
    }

    // ------------------------------------------------------------ ghostly figure in the tower window
    const ghostMat = ctx.fx.ghostMaterial({ color: 0x9fb8ff, rimColor: 0xe0ecff, opacity: 0.0, intensity: 1.4, dissolveY: 0.0 });
    const ghost = new THREE.Mesh(ctx.geometry.latheFromProfile([[0.0, 1.7], [0.08, 1.68], [0.11, 1.6], [0.1, 1.5], [0.07, 1.45], [0.19, 1.36], [0.24, 1.15], [0.22, 0.6], [0.28, 0.0]], 24), ghostMat);
    ghost.position.set(0.15, 9.95 + 0.1, TOWER.z1 - 0.25);
    ghost.scale.setScalar(0.95);
    ghost.renderOrder = 8;
    root.add(ghost);

    // ------------------------------------------------------------ fog patch on every lit material
    root.traverse((o) => {
      if (!o.material || o === sky.mesh) return;
      for (const m of [].concat(o.material)) {
        if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshBasicMaterial) patchFog(m, U);
      }
    });

    // ------------------------------------------------------------ ground mist (added after the fog patch: own shader)
    const mist = buildMist({
      timeUniform: ctx.time, moonDir: MOON_DIR, opacity: Number(P.get('mist') ?? 0.6),
      sheets: [
        { x0: -24, x1: 26, z0: 38, z1: 64, count: 16, w: [10, 18], h: [2.0, 3.6] },
        { x0: -26, x1: 26, z0: 29, z1: 36, count: 9, w: [8, 14], h: [1.4, 2.4] },
        { x0: -22, x1: 22, z0: 13, z1: 28, count: 9, w: [6, 12], h: [1.1, 2.0] },
        { x0: -14, x1: -6, z0: 17, z1: 25, count: 3, w: [5, 8], h: [1.0, 1.6] },
        { x0: -28, x1: 28, z0: -14, z1: 2, count: 7, w: [10, 16], h: [2.0, 3.5] },
      ],
    });
    root.add(mist.mesh);

    // ------------------------------------------------------------ gate state
    const gateOpen = { v: ctx.state.isSolved(gateMeta.id) ? 1 : 0, target: ctx.state.isSolved(gateMeta.id) ? 1 : 0 };
    const applyGate = () => {
      const e = gateOpen.v * gateOpen.v * (3 - 2 * gateOpen.v);
      gate.leftLeaf.rotation.y = e * 1.25;
      gate.rightLeaf.rotation.y = -e * 1.2;
    };
    applyGate();
    const doorOpen = { v: 0, target: 0 };
    const applyDoor = () => {
      const e = doorOpen.v * doorOpen.v * (3 - 2 * doorOpen.v);
      house.door.userData.left.rotation.y = -e * 1.1;
      house.door.userData.right.rotation.y = e * 1.05;
      doorSpill.intensity = e * 40;
    };

    const puzzle = createGatePuzzle(ctx, {
      rings: med.rings, material: med.material, worldCenter: medWorld,
      onSolved: () => {
        gateOpen.target = 1;
        ctx.state.set('exterior.gateOpen', true);
        ctx.audio.sfx?.('door');
        setTimeout(() => ctx.say({ text: 'A key made of *riddles*. How fitting. Come up, come up — the others are waiting.', speaker: 'stauf', speakerName: 'Stauf' }), 1800);
      },
    });

    // ------------------------------------------------------------ navigation graph
    const eye = 1.64;
    const at = (x, z, dy = eye) => [x, height(x, z) + dy, z];
    const nodes = {
      main: { position: at(5.5, 47.0), target: [-0.5, 6.5, 6], fov: 46, label: 'The foot of the hill', look: { yaw: [-45, 45], pitch: [-20, 30] } },
      gate: { position: at(0.35, GATE_Z + 3.4), target: [0.0, gate.y0 + 3.6, 12], fov: 54, label: 'The gate', look: { yaw: [-55, 55], pitch: [-30, 35] } },
      drive: { position: at(1.1, 22.5), target: [-0.2, 7.2, 0], fov: 54, label: 'The drive', look: { yaw: [-60, 60], pitch: [-25, 35] } },
      graves: { position: at(1.1, 22.5), target: [-10.5, height(-10.5, 21) + 0.6, 20.6], fov: 50, label: 'The family plot' },
      porch: { position: [0.25, height(0.2, 15.4) + eye, 15.4], target: [0, F + 2.0, TOWER.z1], fov: 54, label: 'The front steps', look: { yaw: [-60, 60], pitch: [-25, 40] } },
      porch_back: { position: [0.25, height(0.2, 15.4) + eye, 15.4], target: [1.5, height(1, 32) + 1.2, 40], fov: 54, label: 'The way you came' },
    };
    const edges = [
      ['main', 'gate', [at(2.6, 42), at(0.8, 37.5)], { duration: 5.0 }],
      ['gate', 'drive', [at(0.0, 30.5), at(0.6, 26.5)], { hidden: true, duration: 4.5 }],
      ['drive', 'graves'],
      ['drive', 'porch', [at(1.0, 18.5)], { duration: 3.6 }],
      ['porch', 'porch_back'],
    ];
    const exits = [
      { node: 'porch', toRoom: 'foyer', toNode: null, label: 'Enter the house', hotspot: { box: { min: [-1.0, F, TOWER.z1 - 0.3], max: [1.0, F + DOOR.h, TOWER.z1 + 0.4] } } },
    ];

    // ------------------------------------------------------------ hotspots
    const say = (text) => ctx.say({ text, speaker: 'stauf', speakerName: 'Stauf' });
    const solved = () => ctx.state.isSolved(gateMeta.id);
    const hotspots = [
      { id: 'gate-lock', nodes: ['gate'], sphere: { center: medWorld.toArray(), radius: 0.5 }, cursor: 'puzzle', label: 'The lock medallion', enabled: () => !solved(), puzzle },
      {
        id: 'gate-through', nodes: ['gate'], box: { min: [-1.8, gate.y0, GATE_Z - 0.4], max: [1.8, gate.y0 + 3.2, GATE_Z + 0.4] }, cursor: 'move', label: 'Through the gate', priority: 0.5,
        enabled: () => solved(), onActivate: () => ctx.nav.goTo('drive'),
      },
      {
        id: 'gate-locked', nodes: ['gate'], box: { min: [-1.8, gate.y0, GATE_Z - 0.3], max: [1.8, gate.y0 + 3.2, GATE_Z + 0.3] }, cursor: 'examine', label: 'The iron gate', priority: 0.2,
        enabled: () => !solved(), onActivate: () => ctx.ui.caption('The gate is chained by nothing at all — yet it will not move. There is no keyhole: only a medallion of iron rings where the two leaves meet.', { title: 'The Gate' }),
      },
      {
        id: 'back-to-gate', nodes: ['drive'], sphere: { center: [0, gate.y0 + 1.4, GATE_Z], radius: 1.6 }, cursor: 'back', label: 'Back down to the gate',
        onActivate: () => ctx.nav.goTo('gate'),
      },
      {
        id: 'mansion', nodes: ['main'], box: { min: [-9, 1, -6], max: [9, 18, 8] }, cursor: 'examine', label: 'Stauf Manor', priority: 0.3,
        onActivate: () => ctx.ui.caption('Henry Stauf built it with toymaker’s money — every gable a puzzle box, every window an eye. The town below stopped looking up at it years ago.', { title: 'Stauf Manor' }),
      },
      {
        id: 'moon', nodes: ['main', 'drive', 'gate'], position: new THREE.Vector3(0, 0, 0), radius: 0, enabled: () => false,
      },
      {
        id: 'tower-window', nodes: ['drive', 'porch'], sphere: { center: [0, 11.0, TOWER.z1 + 0.1], radius: 0.9 }, cursor: 'ghost', label: 'A light in the tower',
        onActivate: () => ctx.cinematic(async (c, h) => {
          ghostMat.uniforms.uOpacity.value = 0.0;
          ghostFade.target = 0.85;
          ctx.audio.sfx?.('laugh');
          await ctx.nav.lookAt(new THREE.Vector3(0, 10.6, TOWER.z1), 1.4);
          await say('Someone is always watching from the tower. Tonight, it is *you* who are late.');
          await h.wait(0.4);
          ghostFade.target = 0.0;
          await ctx.nav.returnToNode(1.2);
        }),
      },
      {
        id: 'graves', nodes: ['graves'], sphere: { center: [-10.5, height(-10.5, 21) + 0.6, 21], radius: 3.6 }, cursor: 'examine', label: 'The family plot',
        onActivate: () => ctx.ui.caption('The stones are older than the house. Six bear no names at all — only dates, all the same night, and room left for a seventh.', { title: 'The Family Plot' }),
      },
      {
        id: 'knocker', nodes: ['porch'], sphere: { center: [0.45, F + 1.7, TOWER.z1 + 0.1], radius: 0.18 }, cursor: 'talk', label: 'The knocker', priority: 2,
        onActivate: async () => { ctx.audio.sfx?.('thud'); await say('No need to knock. I have been expecting you for *ever* so long.'); },
      },
      {
        id: 'hero-tree', nodes: ['main'], sphere: { center: [19, height(19, 37.5) + 3, 37.5], radius: 2.4 }, cursor: 'examine', label: 'A dead oak',
        onActivate: () => ctx.ui.caption('Its branches all lean toward the house, as if something up there were calling them.', { title: 'The Oak' }),
      },
    ].filter((h) => h.id !== 'moon');

    // ------------------------------------------------------------ god ray source = the moon
    const moonRay = { position: new THREE.Vector3(), color: new THREE.Color(0.7, 0.78, 1.0), strength: 0.8, radius: 0.18 };
    const ghostFade = { v: 0, target: 0 };

    // QA hooks
    const debug = (window.__debug = window.__debug || {});
    debug.solve = (room) => { if (!room || room === 'exterior') { puzzle.autoSolve({ solve: () => { ctx.state.markSolved?.(gateMeta.id); puzzle.onSolved(); } }); } };
    debug.exterior = {
      puzzle, gateOpen, doorOpen,
      state: () => ({ solved: ctx.state.isSolved(gateMeta.id), rings: puzzle.offsets, gateOpen: gateOpen.v, door: doorOpen.v, node: ctx.nav.current }),
      turn: (i, d = 1) => puzzle.turn(i, d),
      flash: (v = 1) => { forceFlash = v; },
    };
    let forceFlash = P.get('flash') ? Number(P.get('flash')) : null;
    if (P.get('gate') === 'open') { gateOpen.v = gateOpen.target = 1; applyGate(); }

    // ------------------------------------------------------------ per-frame
    let lastThunder = -10;
    const update = (dt, t) => {
      // lightning
      const f = forceFlash ?? flashAt(t);
      sky.uniforms.uFlash.value = f;
      sky.uniforms.uBolt.value = f > 0.05 ? Math.min(1, f * 1.4) : 0;
      sky.uniforms.uBoltSeed.value = Math.floor(t / 41) * 7 + 3;
      bolt.intensity = f * 6;
      U.uHFogFlash.value = f * 0.15;
      mist.uniforms.uFlash.value = f * 0.6;
      if (!ctx.shot && f > 0.6 && t - lastThunder > 3) { lastThunder = t; setTimeout(() => ctx.audio.thunder?.(), 900 + 600 * Math.random()); }
      // moon god-ray follows the camera (moon is at infinity)
      moonRay.position.copy(ctx.camera.position).addScaledVector(MOON_DIR, 70);
      // gate / door animation
      if (gateOpen.v !== gateOpen.target) { gateOpen.v += Math.sign(gateOpen.target - gateOpen.v) * Math.min(Math.abs(gateOpen.target - gateOpen.v), dt / 3.2); applyGate(); }
      if (doorOpen.v !== doorOpen.target) { doorOpen.v += Math.sign(doorOpen.target - doorOpen.v) * Math.min(Math.abs(doorOpen.target - doorOpen.v), dt / 2.6); applyDoor(); }
      puzzle.update(dt);
      if (!ctx.state.isSolved(gateMeta.id)) med.material.emissiveIntensity = 0;
      // ghost
      ghostFade.v += (ghostFade.target - ghostFade.v) * Math.min(1, dt * 1.5);
      ghostMat.uniforms.uOpacity.value = ghostFade.v;
      ghost.visible = ghostFade.v > 0.01;
      // lamps flicker gently
      const fl = 0.93 + 0.07 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.0);
      porchLights.forEach((l, i) => { l.intensity = 7 * (i ? fl : 2 - fl - 0.0) * 0.98; });
      gate.lights.forEach((l, i) => { l.intensity = 14 * (0.92 + 0.08 * Math.sin(t * (5.1 + i) + i * 2.0)); });
    };
    update(0, ctx.time.value);
    if (P.get('door') === 'open') { doorOpen.v = doorOpen.target = 1; applyDoor(); }

    return {
      scene: root,
      nodes, edges, exits, hotspots,
      godRays: [moonRay],
      start: 'main',
      grade: {
        exposure: Number(P.get('exposure') || 1.7), toneMapping: 'agx', contrast: 1.12, saturation: 1.05,
        shadowTint: [0.78, 0.92, 1.25], highlightTint: [1.15, 1.0, 0.82], splitAmount: 0.6,
        vignette: 0.45, grain: 0.04, bloomStrength: Number(P.get('bs') || 0.2), bloomThreshold: Number(P.get('bt') || 2.2), bloomRadius: 0.45,
        godRayWeight: 0.18, godRayThreshold: 3.0, aoIntensity: 0.8, aoRadius: 0.6, fogDensity: 0,
      },
      environment: { position: [0, 3.0, 20], intensity: 0.8 },
      update,
      onArrive(node) {
        if (node === 'porch' && doorOpen.target === 0) {
          doorOpen.target = 1;
          ctx.audio.sfx?.('door');
          setTimeout(() => say('Do come in. The door is open — it is *always* open, for my guests.'), 1600);
        }
      },
      onEnter() {
        if (ctx.state.get('exterior.intro')) return;
        ctx.state.set('exterior.intro', true);
        ctx.cinematic(async (c, h) => {
          const n = nodes.main;
          await ctx.nav.flyTo({ position: [18, 22, 78], target: [0, 9, 0], fov: 42 }, 0.01);
          forceFlash = null;
          const p1 = ctx.nav.flyTo({ position: [9, 9, 60], target: [0, 9, 0], fov: 46 }, 7.5);
          await h.wait(1.2);
          await say('The house on the hill. You came, as the others came — drawn by an invitation you do not remember accepting.');
          await p1;
          await ctx.nav.flyTo({ position: n.position, target: n.target, fov: n.fov }, 4.5);
          await say('Six guests. One house. And a seat at my table for *one* more.');
          await ctx.nav.returnToNode(0.4);
        });
      },
      dispose() { if (window.__debug?.exterior) delete window.__debug.exterior; },
    };
  },
};
