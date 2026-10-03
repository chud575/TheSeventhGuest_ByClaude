import * as THREE from 'three';
import { applyMacroVariation } from '../../engine/materials/index.js';
import { createFogUniforms, patchFog, rng, mat4 } from './lib.js';
import { makeTextures, pbr } from './textures.js';
import { createSky } from './sky.js';
import { height, buildTerrain, buildPath, buildGrass, buildBladeGrass, grassTexture, GATE_Z } from './terrain.js';
import { buildMansion, F, DOOR, TOWER, PORCH } from './mansion.js';
import { gnarledTree } from './trees.js';
import { buildGate } from './gate.js';
import { buildGraveyard, placeTree, buildDressing, buildVerge, buildLeafLitter, buildBrokenUrn } from './props.js';
import { buildMist } from './mist.js';
import { buildBats } from './bats.js';
import { createMedallion, createGatePuzzle, gateMeta } from './puzzleGate.js';

/**
 * exterior — "The Approach": the night climb up the hill to Stauf Manor.
 * Title-screen backdrop and opening cinematic. Full moon behind racing cloud,
 * lightning, ground mist pooling in the valley, gnarled dead oaks, the iron gate
 * (its medallion lock is the room's puzzle), the family plot, and the house
 * itself with a few lamp-lit windows and the front door waiting.
 */

const MOON_DIR = new THREE.Vector3(-0.145, 0.485, -0.862).normalize();
const v3 = (a) => new THREE.Vector3(...a);
// the moonlight comes from a little higher than the visible disc (a cinematographer's cheat: shorter house shadow)
const LIGHT_DIR = new THREE.Vector3(-0.22, 0.74, -0.64).normalize();

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

/** Smoky, sooted lantern glass: glows hottest around the flame, darker at the edges and the sooty top. */
function lanternPaneMaterial(ctx) {
  const tex = ctx.textures.canvas('ext:lanternPane2', 128, 128, (g, w, h) => {
    const rg = g.createRadialGradient(w * 0.5, h * 0.62, 2, w * 0.5, h * 0.58, w * 0.62);
    rg.addColorStop(0, 'rgb(255,236,190)');
    rg.addColorStop(0.18, 'rgb(250,170,80)');
    rg.addColorStop(0.5, 'rgb(150,70,24)');
    rg.addColorStop(1, 'rgb(40,16,6)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    const sg = g.createLinearGradient(0, 0, 0, h * 0.35);
    sg.addColorStop(0, 'rgba(10,6,3,0.9)'); sg.addColorStop(1, 'rgba(10,6,3,0)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    // grime streaks
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(20,10,4,${0.12 + (i % 3) * 0.06})`; g.fillRect((i * 37) % w, 0, 2 + (i % 4), h); }
  }, { tile: false });
  return new THREE.MeshStandardMaterial({ color: 0x0c0a08, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 2.2, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.88, depthWrite: false, name: 'lanternPane' });
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
      doorWood: pbr(TX.trim, { name: 'doorWood', color: 0x3a2622, envMapIntensity: 0.25 }),   // oxblood paint, worn
      brass: ctx.materials.create('brass', { tarnish: 0.5, polish: 0.6 }),
      terracotta: new THREE.MeshStandardMaterial({ color: 0x3a1e14, roughness: 0.85, name: 'terracotta' }),
      mound: pbr(TX.ground, { name: 'mound', color: 0x5a554c, normalScale: 2 }),
      rock: pbr(TX.rock, { name: 'rock', color: 0xb0b0b4 }),
      grave: pbr(TX.granite, { name: 'grave', color: 0xd8d6d0 }),
      graveDark: pbr(TX.granite, { name: 'graveDark', color: 0x9c9c9e }),
      pierStone: pbr(TX.limestone, { name: 'pierStone', color: 0xd0ccc4 }),
      mortar: new THREE.MeshStandardMaterial({ color: 0x14130f, roughness: 0.95, name: 'mortar' }),
      lanternPane: lanternPaneMaterial(ctx),
      _x: null,
      lanternGlass: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(1.0, 0.62, 0.3), emissiveIntensity: 7, roughness: 0.2, transparent: true, opacity: 0.92, name: 'lanternGlass' }),
    };
    M.iron.color.setScalar(1.0);
    M.rock.userData.groundShade = true;
    M.pierStone.userData.rim = 0.35;
    M.grave.userData.grime = M.graveDark.userData.grime = { y0: -1.9, h: 0.85, moss: 0.75 };
    M.pierStone.userData.grime = { y0: -3.4, h: 1.3, moss: 0.85 };
    for (const k of ['siding', 'slate', 'ashlar', 'stoneDark']) applyMacroVariation(M[k], { amount: 0.45, scale: 0.18 });
    // backlit silhouettes: grazing moon rim on everything that should catch a silver edge
    for (const [k, r] of [['siding', 0.6], ['trim', 0.9], ['slate', 1.3], ['slateDark', 1.3], ['iron', 0.8], ['brick', 0.9], ['ashlar', 0.7], ['stoneDark', 0.6], ['grave', 0.8], ['graveDark', 0.8], ['terracotta', 0.8]]) M[k].userData.rim = r;

    // ------------------------------------------------------------ sky
    const sky = createSky({ timeUniform: ctx.time, moonDir: MOON_DIR });
    root.add(sky.mesh);
    if (P.get('skyoff')) sky.mesh.visible = false;

    // ------------------------------------------------------------ terrain + path + grass
    const groundMat = pbr(TX.ground, { name: 'ground', color: 0x3a3833 });
    applyMacroVariation(groundMat, { amount: 0.8, scale: 0.09 });
    groundMat.userData.groundShade = true;
    groundMat.userData.rim = 0.35;
    const terrain = buildTerrain({ material: groundMat });
    root.add(terrain);
    const pathMat = pbr(TX.path, { name: 'path', alphaTest: 0.5, color: 0xd8d4cc, envMapIntensity: 1.6 });
    pathMat.userData.groundShade = true;
    pathMat.polygonOffset = true; pathMat.polygonOffsetFactor = -2; pathMat.polygonOffsetUnits = -2;
    root.add(buildPath({ material: pathMat }));
    // far grass: crossed tuft cards (cheap), olive-grey
    const grassMat = new THREE.MeshStandardMaterial({ map: grassTexture(ctx), alphaTest: 0.4, side: THREE.FrontSide, roughness: 0.9, color: 0x4a4a3c, name: 'grass' });
    grassMat.userData.groundShade = true;
    grassMat.userData.rim = 0.7;
    const avoid = [[0, 3, 9.8], [9, 6, 3.2]];
    root.add(buildGrass({
      material: grassMat, count: ctx.quality.particles >= 1 ? 9000 : 5000,
      regions: [
        { x0: -12, x1: 12, z0: 12, z1: 31, weight: 3 },   // the drive
        { x0: -24, x1: -12, z0: 8, z1: 40, weight: 1.2 },
        { x0: 12, x1: 26, z0: 8, z1: 40, weight: 1.2 },
        { x0: -11, x1: 11, z0: -10, z1: 11, weight: 1.0 },
        { x0: -26, x1: 26, z0: 54, z1: 70, weight: 1.5 },
      ],
      avoid,
    }));
    // near grass: real blade clumps (hero foreground, along the path, the drive verges, the family plot)
    const bladeMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.82, color: 0xffffff, name: 'bladeGrass' });
    bladeMat.userData.groundShade = true;
    bladeMat.userData.rim = 0.3;
    const hiQ = ctx.quality.particles >= 1;
    root.add(buildBladeGrass({
      material: bladeMat, count: hiQ ? 16000 : 7000,
      regions: [
        { x0: -14, x1: 18, z0: 33, z1: 56, weight: 6 },
        { x0: -5, x1: 10, z0: 36, z1: 52, weight: 3 },
        { x0: -10, x1: 10, z0: 13, z1: 31, weight: 3 },
        { x0: -16, x1: -5, z0: 16, z1: 30, weight: 2.6, scale: 0.42 },   // the family plot: cropped short between the stones
      ],
      avoid,
    }));
    // verge stones, fallen leaves, a broken urn in the foreground
    root.add(buildVerge(ctx, { rock: pbr(TX.rock, { name: 'vergeRock', color: 0x9a9a9c }) }, { from: 0.18, to: 0.92 }));
    root.add(buildLeafLitter(ctx, {
      count: hiQ ? 3200 : 1600,
      regions: [
        { x0: -6, x1: 12, z0: 34, z1: 52, weight: 4 },
        { x0: -4, x1: 5, z0: 12, z1: 31, weight: 2 },
        { x0: -14, x1: -6, z0: 17, z1: 26, weight: 1.5 },
      ],
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
    // warm spill from the pier lanterns gathered on the lock medallion (keeps the puzzle legible)
    const medLight = new THREE.PointLight(0xffb070, 1.1, 3.2, 2);
    medLight.position.copy(medWorld).add(new THREE.Vector3(0.3, 0.9, 1.3));
    root.add(medLight);

    // ------------------------------------------------------------ trees
    const barkMat = pbr(TX.bark, { name: 'bark', color: 0xa09890 });
    barkMat.userData.rim = 0.25;
    const trees = [
      { seed: 11, x: 7.6, z: 33.8, ry: 2.6, s: 1.1, height: 11, trunkR: 0.62, spread: 1.15 },     // hero foreground, frames the right
      { seed: 23, x: 11.5, z: 30.5, ry: 2.2, s: 1.05, height: 10, trunkR: 0.5 },
      { seed: 37, x: -16, z: -4, ry: 1.1, s: 1.2, height: 12, trunkR: 0.55 },
      { seed: 41, x: 17, z: -9, ry: 0.2, s: 1.15, height: 11, trunkR: 0.5 },
      { seed: 53, x: -8.2, z: 26.8, ry: 3.0, s: 0.95, height: 9, trunkR: 0.45 },
      { seed: 67, x: -3.4, z: 18.0, ry: 4.0, s: 0.85, height: 8, trunkR: 0.38 },   // frames the drive view on the left
      { seed: 71, x: -6.4, z: 30.8, ry: 1.0, s: 1.1, height: 10, trunkR: 0.5 },   // frames the left
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
    root.add(buildBrokenUrn(ctx, M, { x: 7.6, z: 43.2, ry: 0.5 }));

    // ------------------------------------------------------------ lights
    // The moon is BEHIND the house: one shadowed directional from the moon's azimuth,
    // ~32 deg up, rim-lights rooflines/finials and throws the house's long shadow down the
    // drive toward the camera. The camera-facing facade only gets a faint cool sky fill.
    const moon = new THREE.DirectionalLight(0xa8bcff, Number(P.get('moon') || 5.0));
    const shadowCenter = new THREE.Vector3(0, 0, 16);
    moon.position.copy(shadowCenter).addScaledVector(P.get('ldir') ? new THREE.Vector3(...P.get('ldir').split(',').map(Number)).normalize() : LIGHT_DIR, 70);
    moon.target.position.copy(shadowCenter);
    moon.castShadow = ctx.quality.shadows;
    moon.shadow.mapSize.set(ctx.quality.shadowMapSize, ctx.quality.shadowMapSize);
    Object.assign(moon.shadow.camera, { left: -32, right: 32, top: 40, bottom: -40, near: 20, far: 130 });
    moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.04; moon.shadow.radius = 3;
    moon.shadow.camera.updateProjectionMatrix();
    root.add(moon, moon.target);
    U.uRimDir.value.copy(LIGHT_DIR);
    U.uRimStrength.value = Number(P.get('rim') || 1.0);
    // very faint cool fill from camera-left (the open sky over the valley) so porch detail survives
    const fill = new THREE.DirectionalLight(0x8494b8, Number(P.get('fill') || 6.0));
    fill.position.set(-45, 18, 70); fill.target.position.set(0, 4, 0);
    root.add(fill, fill.target);
    const hemi = new THREE.HemisphereLight(0x22305a, 0x050404, Number(P.get('hemi') || 0.22));
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
      const pl = new THREE.PointLight(0xffa050, 3, 6, 2);
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

    // ------------------------------------------------------------ bats wheeling about the tower
    const bats = buildBats({ count: 9, centers: [{ x: 0, z: 5, r: [4, 8], y: [17, 22] }, { x: 8.5, z: 6, r: [3, 6], y: [18, 23] }] });
    root.add(bats.mesh);

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
      main: { position: at(1.45, 40.5, 1.25), target: [0.6, 8.5, 6], fov: 44, label: 'The foot of the hill', look: { yaw: [-45, 45], pitch: [-20, 30] } },
      gate: { position: at(0.35, GATE_Z + 3.4), target: [0.0, gate.y0 + 4.3, 12], fov: 54, label: 'The gate', look: { yaw: [-55, 55], pitch: [-30, 35] } },
      drive: { position: at(5.6, 27.6, 1.3), target: [-0.6, 9.0, 5], fov: 56, label: 'The drive', grade: { godRayWeight: 0.0 }, look: { yaw: [-60, 60], pitch: [-25, 35] } },
      graves: { position: at(-13.3, 26.0, 1.5), target: [-7.4, 1.4, 14.5], fov: 52, label: 'The family plot', look: { yaw: [-50, 50], pitch: [-30, 30] } },
      porch: { position: [0.25, height(0.2, 15.4) + eye, 15.4], target: [0, F + 2.0, TOWER.z1], fov: 54, label: 'The front steps', grade: { godRayWeight: 0.0 }, look: { yaw: [-60, 60], pitch: [-25, 40] } },
      porch_back: { position: [0.25, height(0.2, 15.4) + eye, 15.4], target: [1.5, height(1, 32) + 1.2, 40], fov: 54, label: 'The way you came' },
    };
    const edges = [
      ['main', 'gate', [at(2.6, 42), at(0.8, 37.5)], { duration: 5.0 }],
      ['gate', 'drive', [at(0.0, 30.5), at(0.6, 26.5)], { hidden: true, duration: 4.5 }],
      ['drive', 'graves', [at(-3.0, 25.0), at(-9.0, 27.2)], { duration: 5.0 }],
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
        id: 'votive', nodes: ['graves'], object: graves.votive, cursor: 'examine', label: 'A votive lantern', priority: 2,
        onActivate: async () => {
          await ctx.ui.caption('A lantern burns on the newest grave. The wick is fresh, the glass still warm. Nobody has come up this hill in years.', { title: 'The Votive' });
          await say('I keep a light for each of them. It would be *rude* not to.');
        },
      },
      {
        id: 'knocker', nodes: ['porch'], sphere: { center: [0.45, F + 1.7, TOWER.z1 + 0.1], radius: 0.18 }, cursor: 'talk', label: 'The knocker', priority: 2,
        onActivate: async () => { ctx.audio.sfx?.('thud'); await say('No need to knock. I have been expecting you for *ever* so long.'); },
      },
      {
        id: 'hero-tree', nodes: ['main'], sphere: { center: [7.6, height(7.6, 33.8) + 3, 33.8], radius: 2.4 }, cursor: 'examine', label: 'A dead oak',
        onActivate: () => ctx.ui.caption('Its branches all lean toward the house, as if something up there were calling them.', { title: 'The Oak' }),
      },
    ].filter((h) => h.id !== 'moon');

    // ------------------------------------------------------------ god ray source = the moon
    const moonRay = { position: new THREE.Vector3(), color: new THREE.Color(0.7, 0.78, 1.0), strength: 1.0, radius: 0.13 };
    const ghostFade = { v: 0, target: 0 };

    // QA hooks (same convention as the other rooms: __debug.solve(id), __debug.state(id))
    const debug = (window.__debug ||= {});
    debug.solvers ||= {};
    debug.states ||= {};
    debug.solvers.exterior = async () => {
      const game = window.__game;
      if (game?.puzzle?.def?.id === gateMeta.id) { puzzle.autoSolve(game.puzzle.pctx); return true; }
      // not in the puzzle: solve directly (rings home, gate swings open)
      puzzle.autoSolve({ solve: () => {} });
      ctx.state.markSolved?.(gateMeta.id);
      puzzle.onSolved();
      return true;
    };
    debug.states.exterior = () => ({
      solved: ctx.state.isSolved(gateMeta.id), rings: puzzle.offsets, ringsAligned: puzzle.solvedNow(),
      gateOpen: gateOpen.v, gateTarget: gateOpen.target, door: doorOpen.v, node: ctx.nav.current,
    });
    debug.solve ||= (id) => (debug.solvers[id || 'exterior'] ? debug.solvers[id || 'exterior']() : Promise.reject(new Error(`no solver for ${id}`)));
    debug.state ||= (id) => (debug.states[id] ? debug.states[id]() : null);
    debug.exterior = {
      puzzle, gateOpen, doorOpen,
      state: () => debug.states.exterior(),
      turn: (i, d = 1) => puzzle.turn(i, d),
      flash: (v = 1) => { forceFlash = v; },
    };
    let forceFlash = P.get('flash') ? Number(P.get('flash')) : null;
    if (P.get('gate') === 'open') { gateOpen.v = gateOpen.target = 1; applyGate(); }

    // ------------------------------------------------------------ per-frame
    let lastThunder = -10;
    let strikeAt = -100;
    const strike = () => { strikeAt = ctx.time.value; };
    if (P.get('strike')) strikeAt = ctx.time.value - Number(P.get('strike'));
    const update = (dt, t) => {
      // lightning
      const ds = t - strikeAt;
      const fs = ds >= 0 && ds < 1.5 ? Math.max(Math.exp(-ds * 8), ds > 0.15 ? Math.exp(-(ds - 0.15) * 12) * 0.8 : 0, ds > 0.4 ? Math.exp(-(ds - 0.4) * 5) * 0.5 : 0) : 0;
      const f = forceFlash ?? Math.max(flashAt(t), fs);
      bats.update(t);
      sky.uniforms.uFlash.value = f;
      sky.uniforms.uBolt.value = f > 0.05 ? Math.min(1, f * 1.4) : 0;
      sky.uniforms.uBoltSeed.value = Math.floor(t / 41) * 7 + 3 + (fs > 0 ? 11 : 0);
      bolt.intensity = f * 8;
      U.uHFogFlash.value = f * 0.15;
      mist.uniforms.uFlash.value = f * 0.6;
      if (!ctx.shot && f > 0.6 && t - lastThunder > 3) { lastThunder = t; setTimeout(() => ctx.audio.thunder?.(), 900 + 600 * Math.random()); }
      // moon god-ray follows the camera (moon is at infinity)
      moonRay.position.copy(ctx.camera.position).addScaledVector(MOON_DIR, 70);
      // near the house the moon sits behind the tower with lit windows inside the ray radius: no rays there
      moonRay.strength = ['drive', 'porch', 'porch_back'].includes(ctx.nav.current) && !ctx.nav.moving ? 0 : 1;
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
      porchLights.forEach((l, i) => { l.intensity = 3 * (i ? fl : 2 - fl - 0.0) * 0.98; });
      graves.votive.userData.light.intensity = 0.9 * (0.85 + 0.15 * Math.sin(t * 9.1) * Math.sin(t * 4.3 + 0.7));
      gate.lights.forEach((l, i) => { l.intensity = 4.0 * (0.92 + 0.08 * Math.sin(t * (5.1 + i) + i * 2.0)); });
    };
    update(0, ctx.time.value);
    if (P.get('door') === 'open') { doorOpen.v = doorOpen.target = 1; applyDoor(); }

    return {
      scene: root,
      nodes, edges, exits, hotspots,
      godRays: [moonRay],
      start: 'main',
      grade: {
        exposure: Number(P.get('exposure') || 1.65), toneMapping: P.get('tm') || 'aces', contrast: Number(P.get('contrast') || 1.14), saturation: 1.0,
        shadowTint: [0.8, 0.93, 1.22], highlightTint: [1.16, 1.0, 0.8], splitAmount: 0.6, splitBalance: 0.4,
        lift: [-0.006, -0.005, -0.002], blackPoint: Number(P.get('bp') || 0.012),
        vignette: 0.42, grain: 0.035, bloomStrength: Number(P.get('bs') || 0.28), bloomThreshold: Number(P.get('bt') || 1.6), bloomRadius: 0.5,
        godRayWeight: Number(P.get('grw') || 0.9), godRayThreshold: Number(P.get('grt') || 0.55), godRayDecay: 0.972, godRayDensity: 0.95,
        aoIntensity: 0.55, aoRadius: 0.5, fogDensity: 0,
      },
      environment: { position: [0, 3.0, 20], intensity: Number(P.get('envi2') || 0.6) },
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
          // high over the valley, drifting down through the mist toward the house on the hill
          await ctx.nav.flyTo({ position: [16, 16, 84], target: [0, 9, 0], fov: 40 }, 0.01);
          forceFlash = null;
          const p1 = ctx.nav.flyTo({ position: [6.5, 0.5, 58], target: [-0.5, 7.5, 4], fov: 44 }, 9.0);
          await h.wait(1.4);
          await say('The house on the hill. You came, as the others came — drawn by an invitation you do not remember accepting.');
          await p1;
          // slow push-in on the front door, then the sky splits
          const p2 = ctx.nav.flyTo({ position: [2.6, -2.0, 42], target: [0, F + 2.2, TOWER.z1], fov: 24 }, 7.0);
          await say('Six guests. One house. And a seat at my table for *one* more.');
          await p2;
          strike();
          ctx.audio.thunder?.();
          await h.wait(1.2);
          await ctx.nav.flyTo({ position: n.position, target: n.target, fov: n.fov }, 3.5);
          await ctx.nav.returnToNode(0.3);
        });
      },
      dispose() { if (window.__debug?.exterior) delete window.__debug.exterior; },
    };
  },
};
