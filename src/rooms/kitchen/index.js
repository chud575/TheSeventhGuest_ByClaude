import * as THREE from 'three';
import { mergeStatic } from '../../engine/lib/contrib/foyer-merge.js';
import {
  wallTileTexture, borderTileTexture, butcherBlockTexture, castIronTexture, copperTexture, tinLiningTexture,
  limewashTexture, adzedOakTexture, quarryTileTexture, sycamoreTexture, doorPaintTexture, scuffTexture, tinplateTexture,
  flourDecalTexture, gardenSkyTexture, boardingTexture, sackTexture, emberTexture, matFrom, blockSideTexture, scrubbedPineTexture, flourPrintsTexture, flourGrainTexture, ceilingBoardTexture,
} from './textures.js';
import {
  mk, rbox, lathe, tube, buildOilLamp, buildRange, buildDresser, buildButcherBlock, buildSaucepan, buildScale, buildGasBracket, buildWindsorChair, crock, jarGeo, mergeInto,
  buildPheasant, buildMopBucket, buildBoots, buildCoalHod, sackGeometry, sackTie, loafGeometry, buildOnionString, flourMound, buildGasolier, hungLinen,
} from './props.js';
import { applyGrime } from './grime.js';
import { makeBounce } from './bounce.js';
import { kitchenCanvases } from './canvases.js';
import { createCansPuzzle, cansMeta, CANS_ID } from './puzzleCans.js';

/**
 * The Kitchen — Stauf's scullery-kitchen, below stairs from the dining room.
 *
 * 6.4 x 7.2 x 3.4 m. Glazed cream tile to 1.25 m with a green majolica border,
 * blue-grey limewash above, smoke-dark oak beams, York-stone flags floured
 * round a butcher's block. Back wall: a cast-iron close range in a brick
 * chimney recess (copper batterie hung on the breast), a sash window over the
 * Belfast sink letting the moon in. Left wall: the painted dresser whose shelves
 * hold Stauf's Superior Soups (the can puzzle). Right wall: the dumbwaiter hatch
 * (bare footprints in the flour lead to it), the bell board and the service door
 * to the dining room. Front wall: the passage to the foyer.
 *
 * Axes: x right as seen from the foyer door, z toward the door, y up.
 */

const X0 = -3.2, X1 = 3.2, Z0 = -3.8, Z1 = 3.4, H = 3.4;
const TILE_TOP = 1.25, BORDER = 0.15, CAP = TILE_TOP + BORDER;
const CH = { x0: -2.3, x1: -0.3, d: 0.5, ax0: -2.0, ax1: -0.6, ah: 1.5 };   // chimney breast + range alcove
const WIN = { x: 1.6, w: 1.1, sill: 1.05, h: 1.8, depth: 0.36 };
const DUMB = { z: -1.2, w: 0.62, y: 0.86, h: 0.74 };
const DOORS = { foyer: { x: 0.55, w: 1.0, h: 2.3 }, dining: { z: 2.25, w: 0.9, h: 2.2 } };
const DRESSER_Z = -1.55;
const BLOCK = new THREE.Vector3(0.2, 0, -0.6);

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);

export default {
  id: 'kitchen',
  title: 'The Kitchen',
  floorName: 'Ground Floor',
  map: { floor: 'ground', rect: [205, 60, 180, 170] },
  start: 'main',
  ambience: { wind: 0.45, creaks: 0.35, clock: 0.5, thunder: 0.2, rain: 0, heartbeat: 0, roomTone: 0.35 },
  music: { key: 43, mood: 'dread' },
  puzzles: [cansMeta],

  async build(ctx) {
    const { materials: M, geometry: G, fx } = ctx;
    const Q = ctx.quality;
    const big = Q.textureSize >= 2048 ? 2048 : 1024;
    const root = new THREE.Group();
    root.name = 'kitchen';
    const add = (o, parent = root) => { parent.add(o); return o; };
    // S-hook over a horizontal rail (along x) at `at`; returns the point its lower curve holds.
    const sHookGeo = tube([[0, 0.004, -0.016], [0, 0.017, -0.006], [0, 0.017, 0.007], [0, 0.004, 0.015], [0, -0.03, 0.007], [0, -0.056, -0.007], [0, -0.07, 0.003], [0, -0.064, 0.015]], 0.0028, 40, 6);
    /** Hang a saucepan (built opening +Y, handle +X) by its loop from an S-hook on a rail at `at`. facing ±1 = which way (z) the inside faces. */
    function hangPan(parent, pan, at, facing = 1, swing = 0, yaw = 0) {
      parent.add(mk(sHookGeo, mat.iron, at.x, at.y, at.z));
      const basis = facing > 0 ? new THREE.Matrix4().makeBasis(V3(0, 1, 0), V3(0, 0, 1), V3(1, 0, 0)) : new THREE.Matrix4().makeBasis(V3(0, 1, 0), V3(0, 0, -1), V3(-1, 0, 0));
      pan.setRotationFromMatrix(basis);
      const loop = (pan.userData.loop || V3(0, 0, 0)).clone().applyMatrix4(basis);
      pan.position.copy(loop).multiplyScalar(-1);
      const holder = new THREE.Group();
      holder.add(pan);
      holder.position.set(at.x, at.y - 0.066, at.z);
      holder.rotation.set(0, yaw, swing);
      parent.add(holder);
      return holder;
    }
    try { await Promise.all(['700 40px Cinzel', '600 40px Cinzel', 'italic 30px "IM Fell English"'].map((f) => document.fonts.load(f))); } catch { /* fallback serif */ }

    // ================================================================ materials
    const forge = ctx.textures;
    const CV = kitchenCanvases(forge);
    // soot plumes: range flue, the four gas brackets, the pantry lamp, the candle on the block
    const PLUMES = [
      [(CH.ax0 + CH.ax1) / 2, Z0 + 0.3, 1.3, 1.35, 0.5],
      [X0 + 0.05, 0.15, 2.15, 0.75, 0.16], [X1 - 0.05, -0.05, 2.15, 0.75, 0.16], [CH.x1 + 0.05, Z0 + 0.25, 2.12, 0.75, 0.16], [2.7, Z1 - 0.05, 2.32, 0.7, 0.16],
      [X0 + 0.3, DRESSER_Z + 0.7, 1.35, 0.35, 0.2],
    ];
    const grime = (m, o = {}) => applyGrime(m, { plumes: PLUMES, ...o });
    // grease & smoke on the glazed tile: either side of the range recess, round the sink, under each gas bracket
    const TILE_GREASE = [
      [CH.ax0 - 0.04, Z0 + CH.d, 0.35, 1.4, 0.3], [CH.ax1 + 0.04, Z0 + CH.d, 0.35, 1.4, 0.3],
      [(CH.ax0 + CH.ax1) / 2, Z0 + 0.05, 0.4, 1.0, 0.5], [WIN.x, Z0, 0.7, 0.4, 0.5],
      [X0 + 0.02, 0.15, 0.9, 0.35, 0.22], [X1 - 0.02, -0.42, 0.9, 0.35, 0.22], [CH.x1 + 0.02, Z0 + 0.25, 0.9, 0.35, 0.22], [2.7, Z1 - 0.02, 0.95, 0.3, 0.2],
    ];
    const mat = {
      flags: grime(matFrom(quarryTileTexture(forge, 2048), { repeat: [1 / 2.4, 1 / 2.4], physical: true, clearcoat: 0.12, clearcoatRoughness: 0.45, name: 'quarry' }),
        { tiles: { grid: [8, 8], amp: 0.05, hue: 0.015, rough: 0.25, tilt: 0.03 }, ceiling: [9, 0.1, 0], floor: [0, 0], path: [[(CH.ax0 + CH.ax1) / 2, Z0 + 0.9], [BLOCK.x - 0.3, BLOCK.z - 0.55], [BLOCK.x - 0.9, BLOCK.z + 0.6], [0.55, Z1 - 0.3]], pathWidth: 0.42, pathStrength: 0.55, noise: 0.35, tag: 'floor' }),
      tile: applyGrime(matFrom(wallTileTexture(forge, 2048), { repeat: [1 / 1.2, 1 / 1.2], physical: true, clearcoat: 0.45, clearcoatRoughness: 0.16, name: 'walltile' }), { plumes: TILE_GREASE, tiles: { grid: [8, 16], offset: 1, amp: 0.05, hue: 0.02, rough: 0.5, tilt: 0.07 }, floor: [0.35, 0.45], tide: [0.15, 0.85], hgrad: [0.5, 1.25, 0.2], smudges: [[X1, 0.95, DUMB.z - 0.37, 0.14, 0.85], [X1, 0.9, DUMB.z + 0.37, 0.14, 0.75], [X1, 0.82, DUMB.z, 0.22, 0.6], [WIN.x, 0.98, Z0, 0.32, 0.45]], noise: 0.4, sootTint: [0.85, 0.66, 0.38], sootTintAmt: 0.85, tag: 'tile' }),
      border: grime(matFrom(borderTileTexture(forge, 512), { repeat: [1 / 0.15, 1 / 0.15], physical: true, clearcoat: 0.8, clearcoatRoughness: 0.1, name: 'bordertile' }), { tiles: { grid: [1, 1], amp: 0.25, hue: 0.08, rough: 0.5, tilt: 0.06 }, tag: 'border' }),
      glazeGreen: new THREE.MeshPhysicalMaterial({ color: 0x0d2a22, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, name: 'glazeGreen' }),
      plaster: grime(matFrom(limewashTexture(forge, { color: [0.284, 0.326, 0.368], stain: 1, size: 2048, key: 'wall' }), { repeat: [0.5, 0.5], name: 'limewash' }), { ceiling: [H, 0.95, 0.6], noise: 0.35, sootTint: [0.85, 0.8, 0.72], sootTintAmt: 0.7, smudges: [[WIN.x - 0.85, 1.75, Z0, 0.45, 0.55], [WIN.x + 0.8, 1.6, Z0, 0.35, 0.45], [X1, 2.9, -2.6, 0.6, 0.35], [X0, 2.6, 2.4, 0.55, 0.3]], tag: 'plaster' }),
      ceiling: grime(matFrom(ceilingBoardTexture(forge, 2048), { repeat: [0.5, 0.5], name: 'ceilBoards' }), { ceiling: [H, 0.2, 0.15], noise: 0.4, tag: 'ceil' }),
      beam: grime(matFrom(adzedOakTexture(forge, 1024), { repeat: [1, 1], name: 'adzedOak' }), { ceiling: [H, 0.6, 0.25], noise: 0.3, tag: 'beam' }),
      pine: M.create('wood', { species: 'pine', boards: 3, polish: 0.1, wear: 0.8, repeat: [1.2, 1.2], color: [0.95, 0.9, 0.82], clearcoat: 0.0 }),
      pineDark: M.create('wood', { species: 'oak', boards: 0, polish: 0.3, wear: 0.6, repeat: [1.5, 1.5], color: [0.55, 0.42, 0.33] }),
      maple: M.create('wood', { species: 'pine', boards: 8, polish: 0.25, wear: 0.6, repeat: [1.2, 1.2], color: [0.82, 0.68, 0.55] }),
      mahogany: M.create('mahogany', { repeat: [1.5, 1.5] }),
      brick: applyGrime(M.create('brick', { soot: 0.95, rows: 8, cols: 4, repeat: [1 / 0.9, 1 / 0.6] }), { plumes: [[(CH.ax0 + CH.ax1) / 2, Z0 + 0.1, 0.5, 2.2, 0.45], [CH.ax0 + 0.03, Z0 + 0.35, 0.7, 1.5, 0.16], [CH.ax1 - 0.03, Z0 + 0.35, 0.7, 1.5, 0.16]], ceiling: [CH.ah, 0.75, 0.8], floor: [0, 0], noise: 0.4, tag: 'brick' }),
      brass: M.create('brass', { tarnish: 0.45, polish: 0.65, repeat: [3, 3] }),
      steel: M.basic('iron', { color: 0x3a3a3c, roughness: 0.4 }),
      soot: new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.95, name: 'soot' }),
      skirting: new THREE.MeshPhysicalMaterial({ color: 0x15191b, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3, name: 'skirting' }),
      glass: M.create('glass', { dirt: 0.75, transparent: true, opacity: 0.2 }),
    };
    const ironSet = castIronTexture(forge, 1024);
    mat.iron = matFrom(ironSet, { repeat: [3, 3], name: 'iron', metalness: 0.55, color: new THREE.Color(1.25, 1.25, 1.25), envMapIntensity: 1.0 });
    mat.ironEdge = matFrom(ironSet, { repeat: [3, 3], name: 'ironEdge', color: new THREE.Color(1.9, 1.9, 1.9), roughness: 0.75, envMapIntensity: 1.2 });
    mat.ironPolished = mat.ironEdge;
    mat.ironGraphite = matFrom(ironSet, { repeat: [2, 2], name: 'ironGraphite', metalness: 0.45, color: new THREE.Color(0.95, 0.95, 0.98), envMapIntensity: 0.9 });
    mat.ironRelief = new THREE.MeshStandardMaterial({ map: CV.relief.map, bumpMap: CV.relief.bump, bumpScale: 3.5, roughnessMap: CV.relief.rough, metalness: 0.65, roughness: 1, envMapIntensity: 1.0, name: 'ironRelief' });
    mat.ironRelief2 = new THREE.MeshStandardMaterial({ map: CV.relief2.map, bumpMap: CV.relief2.bump, bumpScale: 3.5, roughnessMap: CV.relief2.rough, metalness: 0.65, roughness: 1, envMapIntensity: 1.0, name: 'ironRelief2' });
    mat.makerPlate = new THREE.MeshStandardMaterial({ map: CV.plate.map, bumpMap: CV.plate.bump, bumpScale: 2.5, metalness: 1, roughness: 0.38, name: 'makerPlate' });
    mat.dial = new THREE.MeshStandardMaterial({ map: CV.dial, roughness: 0.4, name: 'ovenDial' });
    mat.copper = matFrom(copperTexture(forge, 1024), { repeat: [3, 1], name: 'copper', metalness: 1, roughness: 1, envMapIntensity: 1.25, normalScale: new THREE.Vector2(0.6, 0.6) });
    mat.copperOld = mat.copper;
    mat.copperV = mat.copper.clone(); mat.copperV.vertexColors = true; mat.copperV.name = 'copperTarnish';
    mat.tinLining = matFrom(tinLiningTexture(forge, 512), { repeat: [3, 1.5], name: 'tinLining', envMapIntensity: 1.4, metalness: 0.6, color: new THREE.Color(1.2, 1.2, 1.2) });
    mat.tinLiningV = mat.tinLining.clone(); mat.tinLiningV.vertexColors = true; mat.tinLiningV.name = 'tinLiningBurn';
    mat.butcher = matFrom(butcherBlockTexture(forge, { aspect: 1.5 / 0.78, size: 2048 }), { name: 'butcher' });
    mat.blockSide = matFrom(blockSideTexture(forge, 1024), { name: 'blockSide' });
    mat.blockBase = grime(matFrom(scrubbedPineTexture(forge, 1024), { repeat: [1, 1], name: 'blockBase', color: new THREE.Color(0.78, 0.72, 0.66) }), { floor: [0.3, 0.55], noise: 0.35, tag: 'blockbase' });
    mat.counter = matFrom(sycamoreTexture(forge, 1024), { repeat: [1, 1], name: 'sycamore' });
    mat.boarding = matFrom(boardingTexture(forge, { color: [0.1, 0.17, 0.2] }), { repeat: [1 / 0.6, 1 / 0.6], name: 'boarding' });
    mat.dresserBack = matFrom(boardingTexture(forge, { color: [0.17, 0.25, 0.28] }), { repeat: [1 / 0.6, 1 / 0.6], name: 'dresserBack' });
    mat.dresserPaint = matFrom(boardingTexture(forge, { color: [0.13, 0.22, 0.26] }), { repeat: [0.4, 1.5], name: 'dresserPaint' });
    mat.cupboardPaint = matFrom(doorPaintTexture(forge, { color: [0.12, 0.2, 0.24], key: 'cupboard' }), { repeat: [1, 1], name: 'cupboardPaint' });
    mat.hatch = matFrom(doorPaintTexture(forge, { color: [0.2, 0.15, 0.1], key: 'brown' }), { repeat: [1, 1], name: 'doorBrown' });
    mat.door = matFrom(doorPaintTexture(forge, { color: [0.27, 0.2, 0.13], key: 'door2' }), { repeat: [1, 1], name: 'doorPaint' });
    mat.sack = matFrom(sackTexture(forge), { repeat: [4.2, 4.2], name: 'sack', vertexColors: true, normalScale: new THREE.Vector2(1.2, 1.2) });
    stencilSack(mat.sack, CV.sackStencil || makeSackStencil(forge));
    mat.towel = new THREE.MeshStandardMaterial({ map: CV.towel, roughness: 0.92, side: THREE.DoubleSide, name: 'towel' });
    mat.emberMap = emberTexture(forge).map;
    mat.stoneware = new THREE.MeshPhysicalMaterial({ color: 0xc8b48c, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2, name: 'stoneware' });
    mat.stonewareBrown = new THREE.MeshPhysicalMaterial({ color: 0x4a2a14, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, name: 'stonewareBrown' });
    mat.saltGlaze = new THREE.MeshPhysicalMaterial({ map: CV.saltGlaze, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.35, name: 'saltGlaze' });
    mat.bristol = new THREE.MeshPhysicalMaterial({ map: CV.bristol, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, name: 'bristolGlaze' });
    mat.porcelain = M.basic('porcelain', { color: 0xe6e1d4 });
    mat.flour = matFrom(flourGrainTexture(forge, 512), { repeat: [1, 1], name: 'flourHeap', metalness: 0, color: new THREE.Color(0.82, 0.78, 0.7), roughness: 1, normalScale: new THREE.Vector2(0.5, 0.5) });
    mat.flour.metalnessMap = null; mat.flour.vertexColors = true; mat.flour.transparent = true; mat.flour.depthWrite = true;
    mat.tinPlate = matFrom(tinplateTexture(forge, 512), { repeat: [2, 1], name: 'tinPlate', envMapIntensity: 0.9 });
    mat.cloth = new THREE.MeshStandardMaterial({ color: 0x3a1512, roughness: 0.9, side: THREE.DoubleSide, name: 'mantelCloth' });
    mat.rope = new THREE.MeshStandardMaterial({ color: 0x5a4a34, roughness: 1, name: 'rope' });
    mat.herbs = new THREE.MeshStandardMaterial({ color: 0x4a4a2a, roughness: 1, name: 'herbs' });
    mat.ham = new THREE.MeshPhysicalMaterial({ color: 0x5c2a18, roughness: 0.55, clearcoat: 0.3, name: 'ham' });
    mat.muslin = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.95, name: 'muslin' });
    mat.ebony = new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 0.35, name: 'ebonyKnob' });
    mat.plumage = new THREE.MeshStandardMaterial({ map: CV.plumage, roughness: 0.75, name: 'plumage' });
    mat.tail = new THREE.MeshStandardMaterial({ map: CV.tail, roughness: 0.7, side: THREE.DoubleSide, name: 'tailFeather' });
    mat.pheasantHead = new THREE.MeshPhysicalMaterial({ color: 0x0d2a24, roughness: 0.35, sheen: 1, sheenColor: new THREE.Color(0.2, 0.5, 0.35), name: 'pheasantHead' });
    mat.collar = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.8, name: 'collar' });
    mat.wattle = new THREE.MeshStandardMaterial({ color: 0x8a1410, roughness: 0.6, name: 'wattle' });
    mat.zincPail = new THREE.MeshStandardMaterial({ color: 0x8c9092, metalness: 0.85, roughness: 0.5, map: CV.zincMottle, name: 'zincPail' });
    mat.dirtyWater = new THREE.MeshPhysicalMaterial({ color: 0x1e1a14, roughness: 0.05, clearcoat: 1, name: 'dirtyWater' });
    mat.mopString = new THREE.MeshStandardMaterial({ color: 0x8c8474, roughness: 1, name: 'mopString' });
    mat.bootSole = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.8, name: 'bootSole' });
    mat.leatherBoot = new THREE.MeshPhysicalMaterial({ color: 0x2a1a10, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.5, side: THREE.DoubleSide, name: 'bootLeather' });
    mat.coal = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.35, metalness: 0.2, flatShading: true, name: 'coal' });
    mat.gingham = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide, name: 'gingham' });
    mat.gingham.map = forge.canvas('kitchen:gingham', 128, 128, (g2, w, h) => {
      g2.fillStyle = '#d8d0bf'; g2.fillRect(0, 0, w, h);
      g2.fillStyle = 'rgba(40,62,110,0.55)'; for (let i = 0; i < 4; i++) { g2.fillRect(i * 32, 0, 16, h); g2.fillRect(0, i * 32, w, 16); }
    });
    mat.gingham.map.repeat.set(6, 6);
    // onion skins: papery bronze to red, with a faint vertical streak; straw for the plait; garlic paper
    const skinTex = forge.canvas('kitchen:onionskin', 128, 256, (g2, w, h) => {
      g2.fillStyle = '#fff'; g2.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 2) { g2.fillStyle = `rgba(60,30,10,${0.06 + ((x * 37) % 11) / 60})`; g2.fillRect(x, 0, 1, h); }
      const gr = g2.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(40,20,5,0.45)'); gr.addColorStop(0.25, 'rgba(0,0,0,0)'); gr.addColorStop(0.85, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(255,240,210,0.4)');
      g2.fillStyle = gr; g2.fillRect(0, 0, w, h);
    });
    const onionMats = {
      onions: [0x8a5426, 0x9a6230, 0x6e3a22, 0x7a2a26, 0xa0703a].map((c, i) => new THREE.MeshPhysicalMaterial({ color: c, map: skinTex, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0.9, 0.7, 0.45), clearcoat: 0.25, clearcoatRoughness: 0.4, name: `onion${i}` })),
      garlic: new THREE.MeshPhysicalMaterial({ color: 0xd8ccb4, map: skinTex, roughness: 0.6, sheen: 0.5, name: 'garlic' }),
      straw: new THREE.MeshStandardMaterial({ color: 0x9a8150, roughness: 0.95, name: 'straw' }),
    };

    // ================================================================ shell helpers
    /** Flat quad: origin at (u=0,y=0), dir = u direction, normal = dir x up. UV = metres from vBase. */
    const face = (origin, dir, u0, u1, y0, y1, m, { vBase = 0, uBase = 0 } = {}) => {
      const d = dir.clone().normalize();
      const p = (u, y) => origin.clone().addScaledVector(d, u).setY(origin.y + y);
      const a = p(u0, y0), b = p(u1, y0), c = p(u1, y1), e = p(u0, y1);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...e.toArray()], 3));
      const n = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
      geo.setAttribute('normal', new THREE.Float32BufferAttribute([...n.toArray(), ...n.toArray(), ...n.toArray(), ...n.toArray()], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([u0 - uBase, y0 - vBase, u1 - uBase, y0 - vBase, u1 - uBase, y1 - vBase, u0 - uBase, y1 - vBase], 2));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      return add(new THREE.Mesh(geo, m));
    };
    /** Moulded casing round an opening, local frame: room at +z, opening x in [-w/2,w/2], y in [y0, y0+h]. */
    const casing = (w, h, y0, prof, m, off = 0.04) => {
      const pr = prof.map((p) => V2(-p.y, p.x));
      const geo = G.sweepProfile(pr, [V3(-w / 2 - off, y0, 0), V3(-w / 2 - off, y0 + h + off, 0), V3(w / 2 + off, y0 + h + off, 0), V3(w / 2 + off, y0, 0)], { up: V3(0, 0, 1), uvScale: 1 });
      return new THREE.Mesh(geo, m);
    };
    /** A banded wall run (tile / border / plaster) from u0..u1 with rectangular openings [{u0,u1,y0,y1}]. */
    const bands = [[0, TILE_TOP, () => mat.tile, 0], [TILE_TOP, CAP, () => mat.border, TILE_TOP], [CAP, H, () => mat.plaster, 0]];
    const wallRun = (origin, dir, u0, u1, openings = []) => {
      for (const [y0, y1, m, vBase] of bands) {
        // split the band into vertical strips at opening edges
        const cuts = new Set([u0, u1]);
        for (const o of openings) { if (o.u0 > u0 && o.u0 < u1) cuts.add(o.u0); if (o.u1 > u0 && o.u1 < u1) cuts.add(o.u1); }
        const xs = [...cuts].sort((a, b) => a - b);
        for (let i = 0; i < xs.length - 1; i++) {
          const a = xs[i], b = xs[i + 1], mid = (a + b) / 2;
          // y-intervals of this strip covered by openings
          const holes = openings.filter((o) => mid > o.u0 && mid < o.u1).map((o) => [Math.max(o.y0, y0), Math.min(o.y1, y1)]).filter(([p, q]) => q > p);
          let ys = [[y0, y1]];
          for (const [p, q] of holes) ys = ys.flatMap(([s, t]) => (q <= s || p >= t ? [[s, t]] : [[s, p], [q, t]].filter(([k, l]) => l - k > 1e-4)));
          for (const [s, t] of ys) face(origin, dir, a, b, s, t, m(), { vBase });
        }
      }
    };

    // soft contact shadow under props that stand on the floor (multiplied over the flags + flour)
    const csTex = forge.canvas('kitchen:contactShadow', 256, 256, (g2, w) => {
      const gr = g2.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g2.fillStyle = gr; g2.fillRect(0, 0, w, w);
    }, { tile: false });
    const csGeo = new THREE.PlaneGeometry(1, 1); csGeo.rotateX(-Math.PI / 2);
    function contactShadow(x, z, rx, rz, strength = 0.8, yaw = 0, y = 0.004) {
      const m = new THREE.Mesh(csGeo, new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: csTex, transparent: true, opacity: strength, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, name: 'contactShadow' }));
      m.scale.set(rx * 2, 1, rz * 2); m.position.set(x, y, z); m.rotation.y = yaw; m.renderOrder = 2;
      m.userData.noShadow = true;
      return add(m);
    }
    /** A sack laid on its side: axis along local +x, flattened under its own weight, resting on y = 0. */
    function lyingSack(seed, o, x, z, yaw, parent = root, y0 = 0) {
      const geo = sackGeometry(seed, o);
      geo.rotateZ(-Math.PI / 2); geo.scale(1, 0.74, 1.12);
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
      geo.computeVertexNormals();
      const m = mk(geo, mat.sack, x, y0, z, 0, yaw, 0);
      parent.add(m);
      const tie = sackTie(mat.rope, geo.userData.neckR + 0.004, seed);
      tie.rotation.z = -Math.PI / 2;
      const [l0, l1] = geo.userData.lean;
      tie.position.set(geo.userData.neckY - (bb.min.x + bb.max.x) / 2, -l0 * 0.74 - bb.min.y, l1 * 1.12 - (bb.min.z + bb.max.z) / 2);
      const tg = new THREE.Group(); tg.add(tie); tg.position.set(x, y0, z); tg.rotation.y = yaw; parent.add(tg);
      if (parent === root) contactShadow(x, z, (bb.max.x - bb.min.x) * 0.62, (bb.max.z - bb.min.z) * 0.7, 0.85, yaw);
      return m;
    }

    // ================================================================ floor + ceiling
    {
      const floor = new THREE.Mesh(G.planeUV(X1 - X0, Z1 - Z0, 1), mat.flags);
      floor.rotation.x = -Math.PI / 2; floor.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
      floor.name = 'floor';
      add(floor);
      const ceil = new THREE.Mesh(G.planeUV(X1 - X0, Z1 - Z0, 1), mat.ceiling);
      ceil.rotation.x = Math.PI / 2; ceil.position.set((X0 + X1) / 2, H, (Z0 + Z1) / 2);
      ceil.name = 'ceiling';
      add(ceil);
      // flour: one decal over the whole floor, authored in world metres, plus a fine decal for the footprint trail
      const trail = [[BLOCK.x - 0.1, BLOCK.z - 0.05], [X1 - 0.25, DUMB.z]];
      const fl = flourDecalTexture(forge, {
        size: 2560, rect: [X0, Z1, X1 - X0, Z1 - Z0], block: [BLOCK.x, BLOCK.z], blockHalf: [0.7, 0.34], kerb: [CH.ax0 + 0.03, CH.ax1 - 0.03, Z0 + 0.72],
        sack: [-1.3, -1.72], sacks: [[X1 - 0.72, -2.27, 0.24], [X1 - 0.33, -1.9, 0.22], [X1 - 0.98, -1.62, 0.3], [-0.95, -1.48, 0.2]], tile: [X0, Z1, 0.3], trail,
      });
      const flourMat = new THREE.MeshStandardMaterial({ map: fl.map, normalMap: fl.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 1, transparent: true, depthWrite: false, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, name: 'flourDecal' });
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), flourMat);
      decal.rotation.x = -Math.PI / 2; decal.position.set((X0 + X1) / 2, 0.002, (Z0 + Z1) / 2);
      decal.name = 'flour'; decal.renderOrder = 1;
      add(decal);
      const pr = flourPrintsTexture(forge, { size: 2048, rect: [0.0, -0.3, 3.2, 1.2], trail, steps: 10 });
      const printMat = new THREE.MeshStandardMaterial({ map: pr.map, normalMap: pr.normalMap, roughness: 0.92, transparent: true, depthWrite: false, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, name: 'flourPrints' });
      const prints = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), printMat);
      prints.rotation.x = -Math.PI / 2; prints.position.set(1.6, 0.0025, -0.9);
      prints.name = 'flourPrints'; prints.renderOrder = 1;
      add(prints);
    }

    // ================================================================ walls
    // back wall (z = Z0), u = x - X0
    wallRun(V3(X0, 0, Z0), V3(1, 0, 0), 0, X1 - X0, [{ u0: WIN.x - WIN.w / 2 - X0, u1: WIN.x + WIN.w / 2 - X0, y0: WIN.sill, y1: WIN.sill + WIN.h }]);
    // left wall (x = X0), u = Z1 - z
    wallRun(V3(X0, 0, Z1), V3(0, 0, -1), 0, Z1 - Z0);
    // right wall (x = X1), u = z - Z0
    wallRun(V3(X1, 0, Z0), V3(0, 0, 1), 0, Z1 - Z0, [
      { u0: DUMB.z - DUMB.w / 2 - Z0, u1: DUMB.z + DUMB.w / 2 - Z0, y0: DUMB.y, y1: DUMB.y + DUMB.h },
      { u0: DOORS.dining.z - DOORS.dining.w / 2 - Z0, u1: DOORS.dining.z + DOORS.dining.w / 2 - Z0, y0: -1, y1: DOORS.dining.h },
    ]);
    // front wall (z = Z1), u = X1 - x
    wallRun(V3(X1, 0, Z1), V3(-1, 0, 0), 0, X1 - X0, [{ u0: X1 - (DOORS.foyer.x + DOORS.foyer.w / 2), u1: X1 - (DOORS.foyer.x - DOORS.foyer.w / 2), y0: -1, y1: DOORS.foyer.h }]);

    // ---- chimney breast (projects CH.d from the back wall, alcove for the range)
    {
      const zf = Z0 + CH.d;
      // front face, u = x - CH.x0
      wallRun(V3(CH.x0, 0, zf), V3(1, 0, 0), 0, CH.x1 - CH.x0, [{ u0: CH.ax0 - CH.x0, u1: CH.ax1 - CH.x0, y0: -1, y1: CH.ah }]);
      // returns (sides)
      wallRun(V3(CH.x0, 0, Z0), V3(0, 0, 1), 0, CH.d);          // faces -x
      wallRun(V3(CH.x1, 0, zf), V3(0, 0, -1), 0, CH.d);         // faces +x
      // alcove: brick back, sides, soffit
      const zb = Z0 + 0.04;
      face(V3(CH.ax0, 0, zb), V3(1, 0, 0), 0, CH.ax1 - CH.ax0, 0, CH.ah, mat.brick);
      face(V3(CH.ax0, 0, zf), V3(0, 0, -1), 0, zf - zb, 0, CH.ah, mat.brick);
      face(V3(CH.ax1, 0, zb), V3(0, 0, 1), 0, zf - zb, 0, CH.ah, mat.brick);
      const soffit = new THREE.Mesh(G.planeUV(CH.ax1 - CH.ax0, zf - zb, 1), mat.soot);
      soffit.rotation.x = Math.PI / 2; soffit.position.set((CH.ax0 + CH.ax1) / 2, CH.ah, (zb + zf) / 2);
      add(soffit);
      // soot-blackened brick arch-bar (iron lintel) across the alcove head
      add(mk(rbox(G, CH.ax1 - CH.ax0 + 0.1, 0.08, 0.04, 0.006), mat.iron, (CH.ax0 + CH.ax1) / 2, CH.ah - 0.04, zf + 0.012));
      // mantel shelf with brackets and a fringed pelmet cloth
      const my = 1.66;
      add(mk(rbox(G, CH.x1 - CH.x0 + 0.24, 0.05, 0.3, 0.01), mat.pineDark, (CH.x0 + CH.x1) / 2, my, zf + 0.13));
      for (const x of [CH.x0 + 0.1, (CH.x0 + CH.x1) / 2, CH.x1 - 0.1]) {
        const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.24, 0); sh.quadraticCurveTo(0.06, -0.04, 0, -0.18); sh.lineTo(0, 0);
        const b = mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 }), 1), mat.pineDark, x + 0.0175, my - 0.025, zf, 0, -Math.PI / 2, 0);
        add(b);
      }
      // mantel pelmet: wool serge in deep swags (scalloped hem), a gilt braid following the hem, bobble fringe
      {
        const PW = CH.x1 - CH.x0 + 0.22, PTop = my - 0.02, nSc = 7, scW = PW / nSc;
        const hem = (x) => { const f = ((x + PW / 2) / scW) % 1; return 0.105 + 0.06 * Math.sin(Math.PI * f); };
        const pelTex = forge.canvas('kitchen:pelmet2', 1024, 256, (g2, w, h) => {
          g2.fillStyle = '#5a1712'; g2.fillRect(0, 0, w, h);
          for (let y = 0; y < h; y += 2) { g2.fillStyle = `rgba(${y % 4 ? 0 : 120},${y % 4 ? 0 : 40},${y % 4 ? 0 : 30},0.12)`; g2.fillRect(0, y, w, 1); }
          for (let x = 0; x < w; x += 3) { g2.fillStyle = 'rgba(0,0,0,0.06)'; g2.fillRect(x, 0, 1, h); }
          // braid: hem band (v 0..0.16) and a top band (v 0.86..0.94)
          const braid = (y0, y1) => {
            g2.fillStyle = '#8a6a2a'; g2.fillRect(0, y0, w, y1 - y0);
            g2.strokeStyle = '#a2843f'; g2.lineWidth = 3;
            for (let x = -20; x < w + 20; x += 14) { g2.beginPath(); g2.moveTo(x, y1); g2.lineTo(x + 10, y0); g2.stroke(); }
            g2.fillStyle = 'rgba(40,20,5,0.5)'; g2.fillRect(0, y0, w, 2); g2.fillRect(0, y1 - 2, w, 2);
          };
          braid(h * 0.84, h * 0.97); braid(h * 0.06, h * 0.2);
          // damask sprigs between, faded
          g2.fillStyle = 'rgba(140,50,35,0.35)';
          for (let x = 40; x < w; x += 80) for (const y of [h * 0.42, h * 0.62]) { g2.beginPath(); g2.ellipse(x + (y > h * 0.5 ? 40 : 0), y, 12, 22, 0, 0, Math.PI * 2); g2.fill(); }
          // dust & sun-fading along the top fold lines
          for (let k = 0; k < 40; k++) { g2.fillStyle = `rgba(160,120,90,${0.02 + (k % 4) * 0.012})`; g2.fillRect((k * 197) % w, 0, 6 + (k % 5) * 8, h); }
          // a century of smoke and dust: the top edge under the shelf has gone a dull grey-brown, moth-thinned patches
          const dg = g2.createLinearGradient(0, 0, 0, h * 0.4); dg.addColorStop(0, 'rgba(48,38,32,0.7)'); dg.addColorStop(1, 'rgba(48,38,32,0)');
          g2.fillStyle = dg; g2.fillRect(0, 0, w, h * 0.4);
          for (let k = 0; k < 60; k++) { const x = (k * 331) % w, y = (k * 113) % h; const gr = g2.createRadialGradient(x, y, 0, x, y, 8 + (k % 7) * 5); gr.addColorStop(0, 'rgba(30,18,14,0.35)'); gr.addColorStop(1, 'rgba(30,18,14,0)'); g2.fillStyle = gr; g2.fillRect(x - 45, y - 45, 90, 90); }
        }, { tile: false });
        pelTex.wrapS = THREE.RepeatWrapping; pelTex.repeat.set(PW / 0.9, 1);
        // wool serge: dull, a low sheen only at grazing angles
        const pelMat = new THREE.MeshPhysicalMaterial({ map: pelTex, roughness: 0.95, sheen: 0.3, sheenRoughness: 0.8, sheenColor: new THREE.Color(0.45, 0.22, 0.16), vertexColors: true, side: THREE.DoubleSide, name: 'pelmet' });
        // knife pleats: the cloth is gathered into ~4.5 cm pleats pinned along the shelf edge; they open out and
        // deepen toward the hem, where the cloth hangs free, and each swag bellies forward
        const NX = 520, NY = 18, pos = [], uv = [], col = [], idx = [];
        const nPl = Math.round(PW / 0.045);
        for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
          const u = i / NX, x = (u - 0.5) * PW, t = j / NY;     // t = 0 hem .. 1 top
          const ph = u * nPl + 0.15 * Math.sin(u * 37.0);
          const hb = hem(x) + 0.006 * Math.sin(ph * Math.PI * 2 + 0.5) * (1 - t) + 0.004 * Math.sin(u * 91.0);
          const y = -hb * (1 - t);
          const f = ((x + PW / 2) / scW) % 1;
          const saw = ph - Math.floor(ph);                       // knife pleat: a slow face then a sharp fold back
          const pleatShape = saw < 0.78 ? saw / 0.78 : 1 - (saw - 0.78) / 0.22;
          const open = 0.35 + 0.65 * (1 - t);
          const pleat = 0.011 * pleatShape * open + 0.014 * Math.sin(Math.PI * f) * (1 - t) ** 1.3 + 0.002 * Math.sin(u * 230.0) * (1 - t);
          pos.push(x, y, pleat); uv.push(u * PW / 0.9, t * 0.8 + 0.06);
          // occlusion in the pleat throats, darker under the shelf (dust and smoke settle on the top fold)
          const throat = saw >= 0.78 ? 0.55 + 0.45 * (1 - (saw - 0.78) / 0.22) : 0.7 + 0.3 * pleatShape;
          const top = 1 - 0.35 * Math.max(0, (t - 0.82) / 0.18);
          const v = Math.min(1, (0.55 + 0.45 * throat) * top);
          col.push(v, v * 0.97, v * 0.95);
        }
        for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
        const pg = new THREE.BufferGeometry();
        pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); pg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); pg.setIndex(idx); pg.computeVertexNormals();
        const pel = mk(pg, pelMat, (CH.x0 + CH.x1) / 2, PTop, zf + 0.285);
        add(pel);
        // bobble fringe hanging from the hem: cords of uneven drop, bobbles a little irregular, some missing
        const bob = new THREE.SphereGeometry(0.0085, 8, 6), cord = new THREE.CylinderGeometry(0.0012, 0.0012, 1, 4);
        const list = [];
        let k = 0;
        for (let x = -PW / 2 + 0.012; x < PW / 2; x += 0.025) {
          k++;
          const r1 = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1, r2 = Math.abs(Math.sin(k * 78.233) * 12345.678) % 1;
          if (r1 > 0.95) continue;                                // a bobble lost
          const xx = x + (r2 - 0.5) * 0.008;
          const drop = 0.016 + r1 * 0.014;
          const lean = (r2 - 0.5) * 0.25;
          const yb = PTop - hem(xx);
          list.push({ geo: cord, m: new THREE.Matrix4().compose(V3((CH.x0 + CH.x1) / 2 + xx + Math.sin(lean) * drop / 2, yb - drop / 2, zf + 0.29), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, lean)), V3(1, drop, 1)) });
          list.push({ geo: bob, m: new THREE.Matrix4().compose(V3((CH.x0 + CH.x1) / 2 + xx + Math.sin(lean) * drop, yb - drop - 0.007, zf + 0.29), new THREE.Quaternion(), V3(0.85 + r2 * 0.3, 1.1 + r1 * 0.3, 0.85 + r2 * 0.3)) });
        }
        add(new THREE.Mesh(mergeInto(list), new THREE.MeshStandardMaterial({ color: 0x6e5422, roughness: 0.85, name: 'fringe' })));
      }
      // copper batterie: S-hooks on a brass rail across the breast, pans hung by their handle loops, tinned insides to the room
      const railY = 2.42, railZ = zf + 0.15;
      add(mk(new THREE.CylinderGeometry(0.012, 0.012, CH.x1 - CH.x0 - 0.1, 16), mat.brass, (CH.x0 + CH.x1) / 2, railY, railZ, 0, 0, Math.PI / 2));
      for (const x of [CH.x0 + 0.08, CH.x1 - 0.08]) {
        add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.15, 10), mat.brass, x, railY, zf + 0.075, Math.PI / 2));
        add(mk(lathe(G, [[0, 0], [0.03, 0], [0.026, 0.008], [0.012, 0.014], [0, 0.016]], 20), mat.brass, x, railY, zf, Math.PI / 2));
      }
      // a graded set, deep-walled (8-12 cm), hung by their handle loops and turned so their copper flanks show
      const pans = [[0.125, 0.115, 0.25], [0.11, 0.105, 0.23], [0.098, 0.095, 0.21], [0.087, 0.088, 0.19], [0.076, 0.08, 0.17], [0.066, 0.072, 0.15]];
      let px = CH.x0 + 0.2;
      pans.forEach(([r, h, hl], i) => {
        const hx = px + r;
        hangPan(root, buildSaucepan(G, mat, r, h, hl, { seed: i + 1 }), V3(hx, railY, railZ), 1, (i % 2 ? 1 : -1) * 0.05, (i % 2 ? -1 : 1) * (0.62 + (i % 3) * 0.06));
        px += r * 2 + 0.05;
      });
      // a framed needlework sampler above the pans
      {
        const tex = forge.canvas('kitchen:sampler', 512, 640, (g2, W2, H2) => {
          // stitch the design on a coarse grid first, then enlarge it as cross-stitches
          const gw = 64, gh = 80;
          const sc = document.createElement('canvas'); sc.width = gw; sc.height = gh;
          const s2 = sc.getContext('2d');
          s2.fillStyle = '#000'; s2.fillRect(0, 0, gw, gh);
          s2.textAlign = 'center'; s2.textBaseline = 'middle';
          s2.fillStyle = '#7a1a16'; s2.font = 'bold 9px Georgia, serif';
          s2.fillText('ABCDEFGHI', gw / 2, 8); s2.fillText('KLMNOPQRS', gw / 2, 17);
          s2.fillStyle = '#1d3b6a'; s2.font = 'bold 10px Georgia, serif';
          s2.fillText('WASTE', gw / 2, 31); s2.fillText('NOT', gw / 2, 41);
          s2.fillStyle = '#2f4a22'; s2.font = 'bold 8px Georgia, serif';
          s2.fillText('NOT EVEN', gw / 2, 52); s2.fillText('GUESTS', gw / 2, 60);
          s2.fillStyle = '#5a2a14'; s2.fillRect(22, 66, 20, 9); s2.fillStyle = '#7a1a16'; s2.beginPath(); s2.moveTo(20, 66); s2.lineTo(32, 60); s2.lineTo(44, 66); s2.fill();
          s2.strokeStyle = '#7a1a16'; s2.lineWidth = 1; s2.strokeRect(1.5, 1.5, gw - 3, gh - 3);
          const px = s2.getImageData(0, 0, gw, gh).data;
          g2.fillStyle = '#cdbf9c'; g2.fillRect(0, 0, W2, H2);
          // linen weave
          g2.globalAlpha = 0.18; g2.fillStyle = '#6a5a3a';
          for (let y = 0; y < H2; y += 4) g2.fillRect(0, y, W2, 1);
          for (let x = 0; x < W2; x += 4) g2.fillRect(x, 0, 1, H2);
          g2.globalAlpha = 1;
          const cw = W2 / gw, ch = H2 / gh;
          for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
            const i = (y * gw + x) * 4;
            if (px[i] + px[i + 1] + px[i + 2] < 90) continue;
            g2.strokeStyle = `rgb(${px[i]},${px[i + 1]},${px[i + 2]})`; g2.lineWidth = 2.2;
            g2.beginPath(); g2.moveTo(x * cw + 1, y * ch + 1); g2.lineTo((x + 1) * cw - 1, (y + 1) * ch - 1);
            g2.moveTo((x + 1) * cw - 1, y * ch + 1); g2.lineTo(x * cw + 1, (y + 1) * ch - 1); g2.stroke();
          }
          // foxing
          for (let k = 0; k < 30; k++) { g2.fillStyle = 'rgba(120,80,30,0.12)'; g2.beginPath(); g2.arc((k * 97) % W2, (k * 61) % H2, 6 + (k % 5) * 4, 0, Math.PI * 2); g2.fill(); }
        }, { tile: false });
        const sw = 0.4, sh = 0.5;
        const smp = new THREE.Group();
        smp.add(new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, name: 'sampler' })));
        smp.add(mk(G.frameGeometry(sw, sh, { width: 0.045, depth: 0.03, uvScale: 1 }), mat.mahogany));
        smp.position.set((CH.x0 + CH.x1) / 2, 2.95, zf + 0.012);
        add(smp);
      }
      // mantel clutter: brass candlesticks, stoneware jars, a tea caddy, salt pig, a clock
      const mtop = my + 0.025;
      const stick = lathe(G, [[0, 0], [0.05, 0], [0.048, 0.01], [0.02, 0.025], [0.014, 0.06], [0.02, 0.07], [0.012, 0.16], [0.018, 0.2], [0.025, 0.21], [0.012, 0.22], [0, 0.22]], 24);
      for (const x of [CH.x0 + 0.12, CH.x1 - 0.12]) {
        add(mk(stick, mat.brass, x, mtop, zf + 0.15));
        const c = fx.candle({ height: 0.14, radius: 0.01, lit: false, light: false, seed: x * 10 });
        c.position.set(x, mtop + 0.22, zf + 0.15);
        waxDrips(c, 0.01, 0.14, Math.round(x * 10));
        add(c);
      }
      add(mk(crock(G, 0.24, 0.09, 0.55), mat.stonewareBrown, CH.x0 + 0.36, mtop, zf + 0.14));
      add(mk(crock(G, 0.18, 0.07, 0.6), mat.stoneware, CH.x0 + 0.53, mtop, zf + 0.16));
      add(mk(rbox(G, 0.12, 0.15, 0.1, 0.006), mat.copper, CH.x1 - 0.32, mtop + 0.075, zf + 0.15));
      add(mk(lathe(G, [[0, 0], [0.08, 0], [0.09, 0.08], [0.085, 0.13], [0.05, 0.17], [0.0, 0.18]], 28), mat.stonewareBrown, CH.x1 - 0.52, mtop, zf + 0.15));
      // mantel clock (stopped at 11:55) — canvas face
      {
        const faceTex = forge.canvas('kitchen:clockface', 256, 256, (g2, w) => {
          g2.fillStyle = '#e4dcc4'; g2.fillRect(0, 0, w, w);
          g2.translate(w / 2, w / 2);
          g2.strokeStyle = '#2a2018'; g2.lineWidth = 3; g2.beginPath(); g2.arc(0, 0, 118, 0, Math.PI * 2); g2.stroke();
          g2.lineWidth = 1; g2.beginPath(); g2.arc(0, 0, 92, 0, Math.PI * 2); g2.stroke();
          g2.fillStyle = '#2a2018'; g2.font = '600 22px Cinzel, Georgia, serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
          const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
          R.forEach((s, i) => { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; g2.save(); g2.translate(Math.cos(a) * 105, Math.sin(a) * 105); g2.rotate(a + Math.PI / 2); g2.fillText(s, 0, 0); g2.restore(); });
          const hand = (a, l, wd) => { g2.save(); g2.rotate(a); g2.lineWidth = wd; g2.beginPath(); g2.moveTo(0, 12); g2.lineTo(0, -l); g2.stroke(); g2.restore(); };
          hand((11.92 / 12) * Math.PI * 2, 55, 6); hand((55 / 60) * Math.PI * 2, 82, 3.5);
        }, { tile: false });
        const cg = new THREE.Group();
        // moulded mahogany case: stepped plinth on bun feet, a body with an arched (lancet) top and a turned finial
        cg.add(mk(rbox(G, 0.3, 0.035, 0.15, 0.008), mat.mahogany, 0, 0.032, 0));
        cg.add(mk(rbox(G, 0.28, 0.02, 0.14, 0.006), mat.mahogany, 0, 0.058, 0));
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) cg.add(mk(new THREE.SphereGeometry(0.014, 12, 8), mat.mahogany, sx * 0.125, 0.012, sz * 0.055)).scale.set(1, 0.85, 1);
        {
          const arch = new THREE.Shape();
          arch.moveTo(-0.12, 0); arch.lineTo(0.12, 0); arch.lineTo(0.12, 0.2); arch.quadraticCurveTo(0.12, 0.3, 0, 0.33); arch.quadraticCurveTo(-0.12, 0.3, -0.12, 0.2); arch.lineTo(-0.12, 0);
          cg.add(mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(arch, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 16 }), 1), mat.mahogany, 0, 0.068, -0.055));
          const cap = new THREE.Shape();
          cap.moveTo(-0.13, 0.2); cap.lineTo(-0.12, 0.2); cap.quadraticCurveTo(-0.12, 0.3, 0, 0.33); cap.quadraticCurveTo(0.12, 0.3, 0.12, 0.2); cap.lineTo(0.13, 0.2); cap.quadraticCurveTo(0.13, 0.315, 0, 0.345); cap.quadraticCurveTo(-0.13, 0.315, -0.13, 0.2);
          cg.add(mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(cap, { depth: 0.125, bevelEnabled: false, curveSegments: 16 }), 1), mat.mahogany, 0, 0.068, -0.0625));
        }
        cg.add(mk(lathe(G, [[0, 0], [0.016, 0], [0.012, 0.012], [0.006, 0.02], [0.01, 0.03], [0.004, 0.045], [0, 0.05]], 16), mat.brass, 0, 0.068 + 0.345, 0));
        // inlaid boxwood stringing round the dial door
        cg.add(mk(new THREE.TorusGeometry(0.104, 0.0025, 6, 48), new THREE.MeshStandardMaterial({ color: 0xc8a870, roughness: 0.5, name: 'stringing' }), 0, 0.18, 0.063));
        cg.add(mk(lathe(G, [[0, 0], [0.1, 0], [0.1, 0.02], [0.0, 0.02]], 32), mat.brass, 0, 0.18, 0.06, Math.PI / 2));
        const fm = new THREE.Mesh(new THREE.CircleGeometry(0.088, 40), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.5 }));
        fm.position.set(0, 0.18, 0.081); cg.add(fm);
        cg.position.set((CH.x0 + CH.x1) / 2 + 0.05, mtop, zf + 0.13);
        add(cg);
      }
    }

    // ---- skirting (dark painted) & tile cap (green glaze bullnose)
    {
      const fo0 = DOORS.foyer.x - DOORS.foyer.w / 2 - 0.1, fo1 = DOORS.foyer.x + DOORS.foyer.w / 2 + 0.1;
      const di0 = DOORS.dining.z - DOORS.dining.w / 2 - 0.1, di1 = DOORS.dining.z + DOORS.dining.w / 2 + 0.1;
      const capProf = G.PROFILES.chairRail(0.045, 0.028);
      const skirtProf = G.PROFILES.baseboard(0.16, 0.022);
      // run from the foyer door counter-clockwise (seen from above): front-left, left, back (with breast), right, front-right
      const zf = Z0 + CH.d;
      const runA = [V3(fo0, 0, Z1), V3(X0, 0, Z1), V3(X0, 0, Z0), V3(CH.x0, 0, Z0), V3(CH.x0, 0, zf), V3(CH.ax0, 0, zf)];
      const runB = [V3(CH.ax1, 0, zf), V3(CH.x1, 0, zf), V3(CH.x1, 0, Z0), V3(X1, 0, Z0), V3(X1, 0, di0)];
      const runC = [V3(X1, 0, di1), V3(X1, 0, Z1), V3(fo1, 0, Z1)];
      const lift = (pts, y) => pts.map((p) => V3(p.x, y, p.z));
      for (const run of [runA, runB, runC]) add(new THREE.Mesh(G.sweepProfile(skirtProf, run, { uvScale: 1 }), mat.skirting));
      // cap rail, broken by the window (back wall) and the dumbwaiter
      const wl = WIN.x - WIN.w / 2 - 0.06, wr = WIN.x + WIN.w / 2 + 0.06, d0 = DUMB.z - DUMB.w / 2 - 0.05, d1 = DUMB.z + DUMB.w / 2 + 0.05;
      const capRuns = [runA, [V3(CH.ax1, 0, zf), V3(CH.x1, 0, zf), V3(CH.x1, 0, Z0), V3(wl, 0, Z0)], [V3(wr, 0, Z0), V3(X1, 0, Z0), V3(X1, 0, d0)], [V3(X1, 0, d1), V3(X1, 0, di0)], runC];
      for (const run of capRuns) add(new THREE.Mesh(G.sweepProfile(capProf, lift(run, CAP - 0.02), { uvScale: 1 }), mat.glazeGreen));
      // cornice (simple cove) all round, painted
      const cove = [V2(0, 0), V2(0.01, 0), V2(0.01, 0.012)];
      for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; cove.push(V2(0.01 + 0.11 * (1 - Math.cos(a)) * 0 + 0.11 * Math.sin(a), 0.012 + 0.11 * (1 - Math.cos(a)))); }
      cove.push(V2(0.13, 0.125), V2(0.13, 0.14), V2(0, 0.14));
      const corn = [V3(X0, H - 0.14, Z0), V3(CH.x0, H - 0.14, Z0), V3(CH.x0, H - 0.14, zf), V3(CH.x1, H - 0.14, zf), V3(CH.x1, H - 0.14, Z0), V3(X1, H - 0.14, Z0), V3(X1, H - 0.14, Z1), V3(X0, H - 0.14, Z1)];
      add(new THREE.Mesh(G.sweepProfile(cove, corn, { closed: true, uvScale: 1 }), mat.plaster));
    }

    // ================================================================ picture rail at 2.4 m + a stencilled frieze above it
    const RAIL_Y = 2.38;
    {
      const zf = Z0 + CH.d;
      const fo0 = DOORS.foyer.x - DOORS.foyer.w / 2 - 0.14, fo1 = DOORS.foyer.x + DOORS.foyer.w / 2 + 0.14;
      const bl0 = DOORS.dining.z - 0.66, bl1 = DOORS.dining.z + 0.66;
      const wl = WIN.x - WIN.w / 2 - 0.07, wr = WIN.x + WIN.w / 2 + 0.07;
      const dz0 = DRESSER_Z - 0.97, dz1 = DRESSER_Z + 0.97;
      const runs = [
        [V3(fo0, 0, Z1), V3(X0, 0, Z1), V3(X0, 0, dz1)],
        [V3(X0, 0, dz0), V3(X0, 0, Z0), V3(CH.x0, 0, Z0), V3(CH.x0, 0, zf)],
        [V3(CH.x1, 0, zf), V3(CH.x1, 0, Z0), V3(0.18, 0, Z0)],
        [V3(0.66, 0, Z0), V3(wl, 0, Z0)],
        [V3(wr, 0, Z0), V3(X1, 0, Z0), V3(X1, 0, bl0)],
        [V3(X1, 0, bl1), V3(X1, 0, Z1), V3(fo1, 0, Z1)],
      ];
      const railProf = [[0, 0], [0.01, 0], [0.019, 0.006], [0.023, 0.015], [0.02, 0.024], [0.016, 0.027], [0.016, 0.031], [0.025, 0.036], [0.026, 0.043], [0.019, 0.048], [0.012, 0.049], [0.012, 0.054], [0, 0.054]].map(([x, y]) => V2(x, y));
      const railMat = mat.skirting;
      for (const run of runs) add(new THREE.Mesh(G.sweepProfile(railProf, run.map((p) => V3(p.x, RAIL_Y, p.z)), { uvScale: 1 }), railMat));
      // brass picture hooks over the rail where things hang from it
      const friezeTex = forge.canvas('kitchen:frieze', 960, 320, (g2, W2, H2) => {
        g2.clearRect(0, 0, W2, H2);
        const ox = '#6e2a1e', oc = '#8c6a2c', bl = '#24384a';
        // two ruled bands
        g2.fillStyle = ox; g2.fillRect(0, 18, W2, 10); g2.fillRect(0, H2 - 28, W2, 10);
        g2.fillStyle = oc; g2.fillRect(0, 36, W2, 4); g2.fillRect(0, H2 - 40, W2, 4);
        // running anthemion: palmette / lotus alternating, joined by S-scrolls (stencil shapes)
        const cy = H2 / 2;
        const palmette = (x, flip) => {
          g2.save(); g2.translate(x, cy + (flip ? -6 : 6)); if (flip) g2.scale(1, -1);
          g2.fillStyle = ox;
          for (let k = -3; k <= 3; k++) { g2.save(); g2.rotate(k * 0.26); g2.beginPath(); g2.ellipse(0, -46, 9 - Math.abs(k) * 1.2, 44 - Math.abs(k) * 5, 0, 0, Math.PI * 2); g2.fill(); g2.restore(); }
          g2.fillStyle = oc; g2.beginPath(); g2.arc(0, 4, 13, 0, Math.PI * 2); g2.fill();
          g2.restore();
        };
        for (let i = 0; i < 4; i++) {
          const x = i * 240 + 60;
          palmette(x, false); palmette(x + 120, true);
          // S-scroll between
          g2.strokeStyle = bl; g2.lineWidth = 9; g2.lineCap = 'round';
          g2.beginPath(); g2.moveTo(x + 18, cy + 30); g2.bezierCurveTo(x + 60, cy + 60, x + 60, cy - 60, x + 102, cy - 30); g2.stroke();
          g2.beginPath(); g2.moveTo(x + 138, cy - 30); g2.bezierCurveTo(x + 180, cy - 60, x + 180, cy + 60, x + 222, cy + 30); g2.stroke();
          g2.fillStyle = bl; for (const [dx, dy] of [[30, 34], [90, -34], [150, -34], [210, 34]]) { g2.beginPath(); g2.arc(x + dx, cy + dy, 7, 0, Math.PI * 2); g2.fill(); }
        }
        // stencil bridges + wear: patches rubbed back, dabbed edges
        g2.globalCompositeOperation = 'destination-out';
        for (let x = 6; x < W2; x += 30) { g2.fillStyle = 'rgba(0,0,0,0.9)'; g2.fillRect(x, 44, 2.5, H2 - 88); }
        let a = 31;
        const R = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
        for (let k = 0; k < 260; k++) { const x = R() * W2, y = R() * H2, r = 4 + R() * 30; const gr = g2.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${0.25 + R() * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g2.fillStyle = gr; g2.fillRect(x - r, y - r, 2 * r, 2 * r); }
        g2.globalCompositeOperation = 'source-over';
      }, { tile: false });
      friezeTex.wrapS = THREE.RepeatWrapping;
      friezeTex.repeat.set(1 / 0.6, 1 / 0.2);
      const friezeMat = grime(new THREE.MeshStandardMaterial({ map: friezeTex, transparent: true, depthWrite: false, roughness: 0.92, opacity: 0.82, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, name: 'frieze' }), { ceiling: [H, 0.75, 0.42], noise: 0.3, tag: 'frieze' });
      const fy0 = RAIL_Y + 0.06, fy1 = fy0 + 0.2;
      let ub = 0;
      for (const run of runs) {
        for (let i = 0; i < run.length - 1; i++) {
          const a = run[i], b = run[i + 1];
          const dir = b.clone().sub(a); const len = dir.length();
          const n = new THREE.Vector3().crossVectors(dir.clone().normalize(), V3(0, 1, 0)).multiplyScalar(0.004);
          const m = face(V3(a.x + n.x, 0, a.z + n.z), dir, 0, len, fy0, fy1, friezeMat, { vBase: fy0, uBase: -ub });
          m.renderOrder = 1; m.userData.noShadow = true;
          ub += len;
        }
      }
    }

    // ================================================================ wall dressing: jelly moulds on the breast, spice cabinet, onion string, enamel sign
    {
      const zf = Z0 + CH.d;
      // copper & tin jelly moulds hung from nails either side of the sampler (fluted, turreted, ring)
      const mouldProfiles = [
        [[0, 0], [0.07, 0], [0.072, 0.008], [0.065, 0.012], [0.068, 0.04], [0.055, 0.045], [0.058, 0.07], [0.042, 0.075], [0.044, 0.1], [0.026, 0.104], [0.02, 0.118], [0, 0.12]],
        [[0, 0], [0.075, 0], [0.078, 0.01], [0.07, 0.014], [0.072, 0.03], [0.064, 0.06], [0.05, 0.085], [0.03, 0.098], [0, 0.102]],
        [[0.02, 0], [0.08, 0], [0.082, 0.01], [0.074, 0.014], [0.07, 0.05], [0.055, 0.075], [0.036, 0.075], [0.03, 0.05], [0.026, 0.014], [0.02, 0.01]],
        [[0, 0], [0.06, 0], [0.062, 0.008], [0.058, 0.012], [0.06, 0.05], [0.048, 0.054], [0.05, 0.085], [0.034, 0.09], [0.034, 0.11], [0, 0.112]],
      ];
      const mouldGeo = mouldProfiles.map((pts, k) => {
        const g2 = lathe(G, pts, 40);
        const fl = [12, 16, 10, 14][k];
        const p = g2.attributes.position;
        for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const kk = 1 + 0.06 * Math.abs(Math.sin(a * fl * 0.5)) - 0.03; p.setX(i, p.getX(i) * kk); p.setZ(i, p.getZ(i) * kk); }
        g2.computeVertexNormals();
        return g2;
      });
      const tinMould = M.basic('silver', { color: 0x9a9890, roughness: 0.38 });
      [[-2.12, 2.86, 0, mat.copper], [-1.84, 2.98, 1, tinMould], [-0.78, 2.98, 3, mat.copper], [-0.5, 2.86, 2, mat.copper]].forEach(([x, y, k, m]) => {
        // seen from the room: the mould's crown faces out, hung by a ring at its rim
        add(mk(mouldGeo[k], m, x, y, zf + 0.004, Math.PI / 2, 0, 0));
        add(mk(new THREE.TorusGeometry(0.012, 0.0025, 6, 12), mat.brass, x, y + 0.085, zf + 0.008));
        add(mk(new THREE.CylinderGeometry(0.002, 0.002, 0.02, 5), mat.iron, x, y + 0.095, zf + 0.01, Math.PI / 2));
      });
      // a row of moulds on a narrow shelf over the slate (back wall, left of the breast)
      {
        const sx0 = X0 + 0.06, sx1 = CH.x0 - 0.06, sy = 2.72;
        add(mk(rbox(G, sx1 - sx0, 0.025, 0.16, 0.004), mat.dresserPaint, (sx0 + sx1) / 2, sy - 0.0125, Z0 + 0.08));
        for (const x of [sx0 + 0.08, sx1 - 0.08]) {
          const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.14, 0); sh.quadraticCurveTo(0.03, -0.03, 0, -0.13); sh.lineTo(0, 0);
          add(mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false }), 1), mat.dresserPaint, x + 0.01, sy - 0.025, Z0, 0, -Math.PI / 2, 0));
        }
        [[0, mat.copper, 1.0], [3, tinMould, 0.9], [1, mat.copper, 1.1], [2, mat.copper, 0.85]].forEach(([k, m, sc], i) => {
          const o = mk(mouldGeo[k], m, sx0 + 0.11 + i * 0.19, sy, Z0 + 0.08);
          o.scale.setScalar(sc); add(o);
        });
      }
      // spice cabinet on the back wall, right of the window: nine labelled drawers
      {
        const cx = 2.72, cy = 1.82, cw = 0.44, chh = 0.52, cd = 0.17;
        const cab = new THREE.Group();
        cab.add(mk(rbox(G, cw, chh, cd, 0.006), mat.dresserPaint, 0, 0, cd / 2));
        cab.add(mk(rbox(G, cw + 0.04, 0.03, cd + 0.03, 0.006), mat.dresserPaint, 0, chh / 2 + 0.015, cd / 2 + 0.01));
        cab.add(mk(rbox(G, cw + 0.02, 0.025, cd + 0.015, 0.006), mat.dresserPaint, 0, -chh / 2 - 0.0125, cd / 2 + 0.005));
        const names = ['NUTMEG', 'CLOVES', 'MACE', 'PEPPER', 'GINGER', 'ALLSPICE', 'SAGE', 'THYME', 'ARSENIC'];
        const lab = forge.canvas('kitchen:spicelabels', 768, 256, (g2, W2, H2) => {
          g2.fillStyle = '#d8ccaa'; g2.fillRect(0, 0, W2, H2);
          g2.fillStyle = '#2a1a10'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
          names.forEach((nm, k) => {
            const x = (k % 3 + 0.5) * (W2 / 3), y = (Math.floor(k / 3) + 0.5) * (H2 / 3);
            g2.strokeStyle = '#2a1a10'; g2.lineWidth = 2; g2.strokeRect(x - 118, y - 36, 236, 72);
            g2.font = `600 ${nm.length > 6 ? 34 : 40}px Cinzel, Georgia, serif`; g2.fillText(nm, x, y + 2);
          });
          for (let k = 0; k < 60; k++) { g2.fillStyle = `rgba(120,80,30,${0.05 + (k % 5) * 0.03})`; g2.beginPath(); g2.arc((k * 137) % W2, (k * 59) % H2, 4 + (k % 7) * 4, 0, Math.PI * 2); g2.fill(); }
        }, { tile: false });
        const labMat = new THREE.MeshStandardMaterial({ map: lab, roughness: 0.9, name: 'spiceLabels' });
        const dw = (cw - 0.04) / 3, dh = (chh - 0.04) / 3;
        for (let k = 0; k < 9; k++) {
          const c = k % 3, r = Math.floor(k / 3);
          const x = -cw / 2 + 0.02 + (c + 0.5) * dw, y = chh / 2 - 0.02 - (r + 0.5) * dh;
          cab.add(mk(G.raisedPanel(dw - 0.008, dh - 0.008, { border: 0.012, bevel: 0.006, fieldDepth: 0.003, frameDepth: 0.008 }), mat.dresserPaint, x, y, cd + (k === 8 ? 0.02 : 0)));
          const lg = new THREE.PlaneGeometry(dw * 0.62, dh * 0.24);
          const uv = lg.attributes.uv;
          for (let q = 0; q < uv.count; q++) uv.setXY(q, (c + 0.08 + uv.getX(q) * 0.84) / 3, 1 - (r + 1) / 3 + (0.1 + uv.getY(q) * 0.8) / 3);
          cab.add(mk(lg, labMat, x, y + dh * 0.18, cd + 0.0095 + (k === 8 ? 0.02 : 0)));
          cab.add(mk(lathe(G, [[0, 0], [0.008, 0], [0.01, 0.007], [0.005, 0.013], [0.008, 0.017], [0, 0.019]], 12), mat.brass, x, y - dh * 0.15, cd + 0.008 + (k === 8 ? 0.02 : 0), Math.PI / 2));
        }
        cab.position.set(cx, cy, Z0);
        add(cab);
      }
      // a string of onions from a hook on the picture rail, beside the window
      {
        const os = buildOnionString(G, onionMats, { seed: 9, len: 0.6, n: 15 });
        os.position.set(2.32, RAIL_Y + 0.02, Z0 + 0.07); os.rotation.y = 1.2;
        add(os);
        add(mk(tube([[2.32, RAIL_Y + 0.055, Z0 + 0.012], [2.32, RAIL_Y + 0.07, Z0 + 0.035], [2.32, RAIL_Y + 0.04, Z0 + 0.06], [2.32, RAIL_Y + 0.02, Z0 + 0.07]], 0.0025, 12, 5), mat.brass));
      }
      // a second salt box by the service end, hung on a nail through its shaped back board
      {
        const sb = new THREE.Group();
        const back = new THREE.Shape(); back.moveTo(-0.11, 0); back.lineTo(0.11, 0); back.lineTo(0.11, 0.3); back.quadraticCurveTo(0.11, 0.36, 0, 0.38); back.quadraticCurveTo(-0.11, 0.36, -0.11, 0.3); back.lineTo(-0.11, 0);
        const hole = new THREE.Path(); hole.absarc(0, 0.33, 0.012, 0, Math.PI * 2, true); back.holes.push(hole);
        sb.add(mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(back, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 12 }), 1), mat.pineDark, 0, -0.04, 0));
        sb.add(mk(rbox(G, 0.2, 0.2, 0.14, 0.006), mat.pineDark, 0, 0.06, 0.082));
        sb.add(mk(rbox(G, 0.21, 0.014, 0.17, 0.004), mat.pineDark, 0, 0.175, 0.095, 0.32, 0, 0));
        sb.add(mk(new THREE.CylinderGeometry(0.0035, 0.0035, 0.18, 6), mat.brass, 0, 0.163, 0.024, 0, 0, Math.PI / 2));
        const lab = forge.canvas('kitchen:saltlabel', 256, 96, (g2, w, h) => { g2.fillStyle = '#d4c6a2'; g2.fillRect(0, 0, w, h); g2.strokeStyle = '#2a1a10'; g2.lineWidth = 3; g2.strokeRect(6, 6, w - 12, h - 12); g2.fillStyle = '#2a1a10'; g2.font = '700 52px Cinzel, Georgia, serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('SALT', w / 2, h / 2 + 3); }, { tile: false });
        sb.add(mk(new THREE.PlaneGeometry(0.12, 0.045), new THREE.MeshStandardMaterial({ map: lab, roughness: 0.9, name: 'saltLabel' }), 0, 0.06, 0.153));
        sb.position.set(X1, 1.5, -0.2); sb.rotation.y = -Math.PI / 2;
        add(sb);
        add(mk(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 6), mat.iron, X1 - 0.02, 1.5 + 0.29, -0.2, 0, 0, Math.PI / 2));
      }
      // a chipped enamel advertising sign over the dumbwaiter
      {
        const sign = forge.canvas('kitchen:enamelsign', 768, 448, (g2, W2, H2) => {
          g2.fillStyle = '#16264a'; g2.fillRect(0, 0, W2, H2);
          g2.strokeStyle = '#e8dcc0'; g2.lineWidth = 10; g2.strokeRect(22, 22, W2 - 44, H2 - 44);
          g2.strokeStyle = '#b02a1e'; g2.lineWidth = 4; g2.strokeRect(38, 38, W2 - 76, H2 - 76);
          g2.fillStyle = '#e8dcc0'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
          g2.font = '700 78px Cinzel, Georgia, serif'; g2.fillText('STAUF’S', W2 / 2, 118);
          g2.fillStyle = '#e0b04a'; g2.font = 'italic 46px "IM Fell English", Georgia, serif'; g2.fillText('Superior Soups', W2 / 2, 196);
          g2.fillStyle = '#b02a1e'; g2.fillRect(120, 236, W2 - 240, 50);
          g2.fillStyle = '#e8dcc0'; g2.font = '700 30px Cinzel, Georgia, serif'; g2.fillText('NOURISHING · ECONOMICAL', W2 / 2, 262);
          g2.font = 'italic 30px "IM Fell English", Georgia, serif'; g2.fillText('“Every guest a meal in himself”', W2 / 2, 336);
          // chips: black iron showing through, rust bleeding down from them
          let a = 5;
          const R = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
          for (let k = 0; k < 26; k++) {
            const edge = R() < 0.7;
            const x = edge ? (R() < 0.5 ? R() * 60 : W2 - R() * 60) : R() * W2, y = edge ? R() * H2 : R() * H2;
            const r = 4 + R() * 16;
            const gr = g2.createLinearGradient(x, y, x, y + r * 5); gr.addColorStop(0, 'rgba(110,50,20,0.55)'); gr.addColorStop(1, 'rgba(110,50,20,0)');
            g2.fillStyle = gr; g2.fillRect(x - r * 0.5, y, r, r * 5);
            g2.fillStyle = '#e6e2d6'; g2.beginPath(); g2.arc(x, y, r + 2, 0, Math.PI * 2); g2.fill();
            g2.fillStyle = '#1a1612'; g2.beginPath(); for (let q = 0; q < 9; q++) { const an = q / 9 * Math.PI * 2; const rq = r * (0.6 + R() * 0.5); g2.lineTo(x + Math.cos(an) * rq, y + Math.sin(an) * rq); } g2.fill();
          }
          for (const [x, y] of [[30, 30], [W2 - 30, 30], [30, H2 - 30], [W2 - 30, H2 - 30]]) { g2.fillStyle = '#1a1612'; g2.beginPath(); g2.arc(x, y, 9, 0, Math.PI * 2); g2.fill(); }
        }, { tile: false });
        const sg = new THREE.Group();
        const sw = 0.5, sh2 = 0.29;
        const plate = new THREE.PlaneGeometry(sw, sh2, 12, 8);
        { const p = plate.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, 0.004 * Math.sin(x * 9 + 1) * Math.sin(y * 7) + (Math.abs(x) > sw / 2 - 0.01 || Math.abs(y) > sh2 / 2 - 0.01 ? -0.002 : 0)); } plate.computeVertexNormals(); }
        sg.add(new THREE.Mesh(plate, new THREE.MeshPhysicalMaterial({ map: sign, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.25, name: 'enamelSign' })));
        for (const [x, y] of [[-sw / 2 + 0.019, sh2 / 2 - 0.019], [sw / 2 - 0.019, sh2 / 2 - 0.019], [-sw / 2 + 0.019, -sh2 / 2 + 0.019], [sw / 2 - 0.019, -sh2 / 2 + 0.019]]) sg.add(mk(new THREE.SphereGeometry(0.006, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat.iron, x, y, 0.004, Math.PI / 2));
        sg.position.set(X1 - 0.006, 2.1, DUMB.z - 0.08); sg.rotation.y = -Math.PI / 2;
        add(sg);
      }
    }

    // ================================================================ beams (adzed oak, chamfered arrises, hook plates)
    const BEAMS = [-2.95, -1.78, BLOCK.z, 0.58, 1.76, 2.94];
    const BEAM_H = 0.26, BEAM_W = 0.2;
    {
      const c = 0.025;
      const sh = new THREE.Shape();
      sh.moveTo(-BEAM_W / 2 + c, -BEAM_H / 2); sh.lineTo(BEAM_W / 2 - c, -BEAM_H / 2); sh.lineTo(BEAM_W / 2, -BEAM_H / 2 + c); sh.lineTo(BEAM_W / 2, BEAM_H / 2);
      sh.lineTo(-BEAM_W / 2, BEAM_H / 2); sh.lineTo(-BEAM_W / 2, -BEAM_H / 2 + c); sh.lineTo(-BEAM_W / 2 + c, -BEAM_H / 2);
      BEAMS.forEach((z, bi) => {
        const L = X1 - X0;
        const geo = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false, steps: 24 });
        // slight sag + twist, so they read as hewn timbers not boxes
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) { const t = p.getZ(i) / L; p.setY(i, p.getY(i) - Math.sin(Math.PI * t) * 0.018 + Math.sin(t * 9 + bi) * 0.004); p.setX(i, p.getX(i) + Math.sin(t * 5 + bi * 2) * 0.006); }
        geo.computeVertexNormals();
        // UVs: u along the beam (grain), v around
        const uv = geo.attributes.uv;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); uv.setXY(i, p.getZ(i) + bi * 1.7, (Math.abs(x) > BEAM_W / 2 - 0.003 ? y : x) + bi * 0.3); }
        const m = add(mk(geo, mat.beam, X0, H - BEAM_H / 2, z, 0, Math.PI / 2, 0));
        m.name = 'beam';
        // forged nails / old hooks along the soffit
        for (let i = 0; i < 4; i++) add(mk(new THREE.TorusGeometry(0.02, 0.004, 6, 12, Math.PI * 1.4), mat.iron, X0 + 0.9 + i * 1.5 + (bi % 2) * 0.4, H - BEAM_H - 0.02, z, 0, 0, Math.PI * 0.7));
      });
    }

    // ================================================================ range
    const range = buildRange(ctx, mat);
    range.group.position.set((CH.ax0 + CH.ax1) / 2, 0, Z0 + 0.04 + 0.6 + 0.02);
    add(range.group);

    // ================================================================ window + sink
    {
      const ux0 = WIN.x - WIN.w / 2, ux1 = WIN.x + WIN.w / 2, top = WIN.sill + WIN.h;
      // deep reveals
      face(V3(ux0, 0, Z0 - WIN.depth), V3(0, 0, 1), 0, WIN.depth, WIN.sill, top, mat.plaster);
      face(V3(ux1, 0, Z0), V3(0, 0, -1), 0, WIN.depth, WIN.sill, top, mat.plaster);
      const head = new THREE.Mesh(G.planeUV(WIN.w, WIN.depth, 1), mat.plaster);
      head.rotation.x = Math.PI / 2; head.position.set(WIN.x, top, Z0 - WIN.depth / 2); add(head);
      // tiled sill (slopes slightly)
      add(mk(rbox(G, WIN.w + 0.1, 0.04, WIN.depth + 0.08, 0.008), mat.glazeGreen, WIN.x, WIN.sill - 0.02, Z0 - WIN.depth / 2 + 0.04));
      // architrave (thin painted) round the opening
      const arch = casing(WIN.w, WIN.h, WIN.sill, G.PROFILES.chairRail(0.08, 0.025), mat.dresserPaint, 0.0);
      arch.position.set(WIN.x, 0, Z0);
      add(arch);
      // sashes: 6-over-6
      const sg = new THREE.Group(); sg.name = 'sash';
      const fm = new THREE.MeshStandardMaterial({ color: 0x1c2326, roughness: 0.6, name: 'sashPaint' });
      const bar = (w, h, x, y, z, d = 0.06) => sg.add(mk(new THREE.BoxGeometry(w, h, d), fm, x, y, z));
      // old crown glass: grime in the corners, condensation beads and runs low down, faint moonlit haze
      const grimeTex = forge.canvas('kitchen:paneGrime3', 256, 256, (g2, w, h) => {
        g2.clearRect(0, 0, w, h);
        const R = (() => { let a = 77; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
        g2.fillStyle = 'rgba(150,165,185,0.04)'; g2.fillRect(0, 0, w, h);
        const edge = g2.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
        edge.addColorStop(0, 'rgba(60,62,58,0)'); edge.addColorStop(1, 'rgba(48,46,40,0.6)');
        g2.fillStyle = edge; g2.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h, r = 8 + R() * 30; const gr = g2.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(70,66,58,${0.08 + R() * 0.12})`); gr.addColorStop(1, 'rgba(70,66,58,0)'); g2.fillStyle = gr; g2.fillRect(x - r, y - r, 2 * r, 2 * r); }
        // condensation: a misted band at the bottom, beads, and a few runs
        const mist = g2.createLinearGradient(0, h, 0, h * 0.45);
        mist.addColorStop(0, 'rgba(170,182,200,0.2)'); mist.addColorStop(1, 'rgba(190,200,215,0)');
        g2.fillStyle = mist; g2.fillRect(0, 0, w, h);
        for (let i = 0; i < 140; i++) { const x = R() * w, y = h * (0.55 + 0.45 * R() ** 0.6), r = 0.5 + R() * 1.6; g2.fillStyle = `rgba(200,210,225,${0.12 + R() * 0.2})`; g2.beginPath(); g2.arc(x, y, r, 0, Math.PI * 2); g2.fill(); }
        g2.strokeStyle = 'rgba(30,34,40,0.35)'; g2.lineWidth = 1.6;
        for (let i = 0; i < 9; i++) { const x = R() * w; let y = h * (0.45 + R() * 0.3); g2.beginPath(); g2.moveTo(x, y); for (let k = 0; k < 8; k++) { y += 6 + R() * 8; g2.lineTo(x + (R() - 0.5) * 3, y); } g2.stroke(); }
      }, { tile: false });
      const paneMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: grimeTex, transparent: true, roughness: 0.35, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, name: 'paneGrime' });
      const half = WIN.h / 2;
      for (const [y0, z] of [[0, 0.03], [half - 0.02, -0.02]]) {
        bar(WIN.w, 0.05, 0, y0 + 0.025, z); bar(WIN.w, 0.04, 0, y0 + half - 0.02 + (y0 ? 0.02 : 0), z);
        bar(0.05, half + 0.02, -WIN.w / 2 + 0.025, y0 + half / 2, z); bar(0.05, half + 0.02, WIN.w / 2 - 0.025, y0 + half / 2, z);
        for (const x of [-WIN.w / 6, WIN.w / 6]) bar(0.022, half, x, y0 + half / 2, z, 0.03);
        bar(WIN.w, 0.022, 0, y0 + half / 2, z, 0.03);
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w - 0.06, half - 0.04), paneMat);
        glass.position.set(0, y0 + half / 2, z); glass.userData.noShadow = true;
        sg.add(glass);
      }
      // sash lift handles & catch
      sg.add(mk(new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI), mat.brass, -0.3, 0.1, 0.06, 0, 0, Math.PI));
      sg.add(mk(new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI), mat.brass, 0.3, 0.1, 0.06, 0, 0, Math.PI));
      sg.add(mk(rbox(G, 0.08, 0.015, 0.03, 0.004), mat.brass, 0, half + 0.0, 0.03));
      sg.position.set(WIN.x, WIN.sill, Z0 - WIN.depth * 0.55);
      add(sg);
      sg.traverse((o) => { if (o.userData.noShadow) o.castShadow = false; });
      // the kitchen garden beyond, in three parallax layers: moonlit sky, the garden wall & glasshouse, a near pear tree
      {
        const R = (() => { let a = 1234; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
        const skyT = forge.canvas('kitchen:winsky', 1024, 1024, (g2, w, h) => {
          const gr = g2.createLinearGradient(0, h, 0, 0);
          gr.addColorStop(0, '#16223e'); gr.addColorStop(0.35, '#22345a'); gr.addColorStop(0.7, '#3a5482'); gr.addColorStop(1, '#5a78a8');
          g2.fillStyle = gr; g2.fillRect(0, 0, w, h);
          // the moon is high and to the right, out of sight: its glow floods the upper right
          const mg = g2.createRadialGradient(w * 0.9, -h * 0.05, 10, w * 0.9, -h * 0.05, w * 0.9);
          mg.addColorStop(0, 'rgba(225,235,255,0.9)'); mg.addColorStop(0.35, 'rgba(160,185,230,0.35)'); mg.addColorStop(1, 'rgba(120,150,210,0)');
          g2.fillStyle = mg; g2.fillRect(0, 0, w, h);
          // banks of cloud, lit silver on their upper-right edges
          for (let k = 0; k < 26; k++) {
            const x = R() * w, y = h * (0.05 + R() * 0.55), rx = 80 + R() * 220, ry = 18 + R() * 40;
            const cg = g2.createRadialGradient(x, y, 0, x, y, rx);
            cg.addColorStop(0, 'rgba(18,26,46,0.75)'); cg.addColorStop(1, 'rgba(18,26,46,0)');
            g2.save(); g2.translate(x, y); g2.scale(1, ry / rx); g2.translate(-x, -y); g2.fillStyle = cg; g2.fillRect(x - rx, y - rx, rx * 2, rx * 2); g2.restore();
            g2.strokeStyle = `rgba(200,215,245,${0.12 + R() * 0.2})`; g2.lineWidth = 2 + R() * 3;
            g2.beginPath(); g2.ellipse(x + rx * 0.1, y - ry * 0.3, rx * 0.7, ry * 0.6, -0.05, Math.PI * 1.1, Math.PI * 1.85); g2.stroke();
          }
          for (let k = 0; k < 120; k++) { g2.fillStyle = `rgba(230,235,255,${R() * 0.6})`; g2.fillRect(R() * w, R() * h * 0.6, 1.5, 1.5); }
        }, { tile: false });
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: skyT, color: new THREE.Color(1.5, 1.5, 1.5), toneMapped: false, fog: false, name: 'winSky' }));
        sky.position.set(WIN.x + 0.3, WIN.sill + 2.6, Z0 - 6.5); sky.userData.noBake = true; add(sky);
        const wallT = forge.canvas('kitchen:wingarden', 1024, 512, (g2, w, h) => {
          g2.clearRect(0, 0, w, h);
          // brick garden wall with a stone coping, its top edge catching the moon
          const wy = h * 0.52;
          g2.fillStyle = '#0d1018'; g2.fillRect(0, wy, w, h - wy);
          for (let y = wy + 6; y < h; y += 14) for (let x = ((y / 14) % 2) * 22; x < w; x += 44) { g2.fillStyle = `rgba(40,46,64,${0.15 + R() * 0.25})`; g2.fillRect(x, y, 41, 11); }
          g2.fillStyle = '#1a2032'; g2.fillRect(0, wy - 10, w, 12);
          g2.fillStyle = 'rgba(150,170,215,0.55)'; g2.fillRect(0, wy - 10, w, 2.5);
          // espaliered pear on the wall
          g2.strokeStyle = '#06080d'; g2.lineCap = 'round';
          const ex = w * 0.28; g2.lineWidth = 9; g2.beginPath(); g2.moveTo(ex, h); g2.lineTo(ex, wy + 20); g2.stroke();
          for (let k = 0; k < 4; k++) { const yy = wy + 40 + k * 55; g2.lineWidth = 5; g2.beginPath(); g2.moveTo(ex, yy); g2.quadraticCurveTo(ex - 60, yy - 6, ex - 170, yy + 4); g2.moveTo(ex, yy); g2.quadraticCurveTo(ex + 60, yy - 6, ex + 170, yy + 2); g2.stroke(); }
          // the glasshouse leaning on the wall: dark frame, panes holding a faint sky reflection, fogged inside
          const gx = w * 0.58, gw = w * 0.36, gy = wy - 120;
          g2.fillStyle = '#0a0d14'; g2.beginPath(); g2.moveTo(gx, h); g2.lineTo(gx, gy + 40); g2.lineTo(gx + gw * 0.5, gy); g2.lineTo(gx + gw, gy + 40); g2.lineTo(gx + gw, h); g2.closePath(); g2.fill();
          for (let px = gx + 8; px < gx + gw - 8; px += 26) for (let py = gy + 50; py < h - 10; py += 34) {
            const pg = g2.createLinearGradient(px, py, px + 20, py + 30); pg.addColorStop(0, `rgba(110,135,185,${0.25 + R() * 0.3})`); pg.addColorStop(1, 'rgba(40,52,80,0.35)');
            g2.fillStyle = pg; g2.fillRect(px, py, 22, 30);
          }
          g2.strokeStyle = 'rgba(150,175,225,0.45)'; g2.lineWidth = 2; g2.beginPath(); g2.moveTo(gx, gy + 40); g2.lineTo(gx + gw * 0.5, gy); g2.lineTo(gx + gw, gy + 40); g2.stroke();
          // a single lit window far off in the house's other wing
          g2.fillStyle = 'rgba(255,190,110,0.85)'; g2.fillRect(w * 0.08, wy - 70, 10, 16);
        }, { tile: false });
        const gard = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ map: wallT, color: new THREE.Color(1.3, 1.3, 1.3), transparent: true, alphaTest: 0.02, toneMapped: false, fog: false, name: 'winGarden' }));
        gard.position.set(WIN.x + 0.2, 1.0, Z0 - 3.4); gard.userData.noBake = true; add(gard);
        const treeT = forge.canvas('kitchen:wintree', 1024, 1024, (g2, w, h) => {
          g2.clearRect(0, 0, w, h);
          g2.strokeStyle = '#030406'; g2.lineCap = 'round';
          const branch = (x, y, a, len, wd, depth) => {
            if (depth <= 0 || len < 5) return;
            const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
            g2.lineWidth = wd; g2.beginPath(); g2.moveTo(x, y); g2.quadraticCurveTo((x + x2) / 2 + (R() - 0.5) * len * 0.35, (y + y2) / 2 + (R() - 0.5) * len * 0.35, x2, y2); g2.stroke();
            branch(x2, y2, a + (R() - 0.5) * 0.7, len * 0.74, wd * 0.7, depth - 1);
            if (R() < 0.8) branch(x2, y2, a + (R() < 0.5 ? -1 : 1) * (0.4 + R() * 0.7), len * 0.62, wd * 0.62, depth - 1);
          };
          branch(-20, h * 0.35, -0.25, 260, 26, 9);
          branch(w + 20, h * 0.1, Math.PI + 0.35, 200, 18, 8);
          // moonlit rim along the upper side of the big limbs
          g2.globalCompositeOperation = 'source-atop';
          const rg = g2.createLinearGradient(w, 0, 0, h); rg.addColorStop(0, 'rgba(70,85,120,0.6)'); rg.addColorStop(0.5, 'rgba(20,26,40,0.2)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
          g2.fillStyle = rg; g2.fillRect(0, 0, w, h);
          g2.globalCompositeOperation = 'source-over';
        }, { tile: false });
        const tree = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: treeT, transparent: true, alphaTest: 0.05, toneMapped: false, fog: false, name: 'winTree' }));
        tree.position.set(WIN.x + 0.1, WIN.sill + 1.7, Z0 - 1.25); tree.userData.noBake = true; tree.userData.noShadow = true; add(tree);
      }
      // Belfast sink on brick piers
      const sinkG = new THREE.Group();
      const sw = 0.76, sh = 0.26, sd = 0.48, t = 0.04, sy = 0.62;
      sinkG.add(mk(rbox(G, sw, t, sd, 0.015), mat.porcelain, 0, sy + t / 2, 0));
      sinkG.add(mk(rbox(G, sw, sh, t, 0.015), mat.porcelain, 0, sy + sh / 2, sd / 2 - t / 2));
      sinkG.add(mk(rbox(G, sw, sh, t, 0.015), mat.porcelain, 0, sy + sh / 2, -sd / 2 + t / 2));
      for (const s of [-1, 1]) sinkG.add(mk(rbox(G, t, sh, sd, 0.015), mat.porcelain, s * (sw / 2 - t / 2), sy + sh / 2, 0));
      sinkG.add(mk(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 20), mat.steel, 0, sy + t + 0.002, 0));
      for (const s of [-1, 1]) sinkG.add(mk(rbox(G, 0.12, sy, sd - 0.06, 0.004), mat.brick, s * (sw / 2 - 0.08), sy / 2, -0.02));
      // gingham skirt between the piers
      const skirt = new THREE.Mesh(G.curtainGeometry({ width: sw - 0.3, height: sy - 0.03, folds: 9, depth: 0.025, seed: 12, segX: 80, segY: 20 }), mat.gingham);
      fixNaN(skirt.geometry, 80);
      skirt.position.set(0, sy - 0.01, sd / 2 - 0.08); sinkG.add(skirt);
      // brass pillar taps from the wall + a long swan-neck pump spout
      for (const s of [-1, 1]) {
        sinkG.add(mk(tube([[s * 0.13, sy + 0.5, -sd / 2], [s * 0.13, sy + 0.5, -sd / 2 + 0.12], [s * 0.13, sy + 0.42, -sd / 2 + 0.16]], 0.012, 12, 10), mat.brass));
        sinkG.add(mk(lathe(G, [[0, 0], [0.02, 0], [0.024, 0.02], [0.006, 0.03], [0.006, 0.05], [0.03, 0.055], [0.0, 0.06]], 16), mat.brass, s * 0.13, sy + 0.5, -sd / 2 + 0.12));
      }
      // scrubbing brush, enamel jug
      sinkG.add(mk(rbox(G, 0.16, 0.035, 0.06, 0.01), mat.pineDark, -0.2, sy + sh + 0.02, sd / 2 - 0.02, 0, 0.3, 0));
      sinkG.add(mk(lathe(G, [[0, 0], [0.06, 0], [0.065, 0.1], [0.05, 0.18], [0.055, 0.2], [0.0, 0.2]], 24), mat.porcelain, 0.48, 0.88, -0.05));
      sinkG.position.set(WIN.x, 0, Z0 + sd / 2 + 0.02);
      add(sinkG);
      // wooden draining board / counter to the left of the sink
      add(mk(rbox(G, 0.95, 0.05, 0.56, 0.008), mat.pine, WIN.x - 0.86, 0.865, Z0 + 0.28, 0, 0, 0.0));
      add(mk(rbox(G, 0.9, 0.78, 0.5, 0.006), mat.dresserPaint, WIN.x - 0.86, 0.43, Z0 + 0.25));
      for (let i = 0; i < 2; i++) add(mk(G.raisedPanel(0.4, 0.58, { border: 0.05, bevel: 0.02 }), mat.dresserPaint, WIN.x - 1.08 + i * 0.44, 0.42, Z0 + 0.5));
      // plate rack above the counter with willow plates
      const rx0 = WIN.x - 1.3, rx1 = WIN.x - 0.42, ry = 1.62;
      for (const y of [ry, ry + 0.34]) {
        add(mk(rbox(G, rx1 - rx0, 0.025, 0.2, 0.004), mat.dresserPaint, (rx0 + rx1) / 2, y, Z0 + 0.1));
        for (let i = 0; i < 18; i++) add(mk(new THREE.CylinderGeometry(0.004, 0.004, 0.26, 6), mat.dresserPaint, rx0 + 0.03 + i * ((rx1 - rx0 - 0.06) / 17), y + 0.13, Z0 + 0.17));
      }
      for (const s of [rx0, rx1]) add(mk(rbox(G, 0.025, 0.66, 0.2, 0.004), mat.dresserPaint, s, ry + 0.3, Z0 + 0.1));
      const plateGeo = lathe(G, [[0, 0], [0.07, 0], [0.075, 0.004], [0.1, 0.008], [0.12, 0.016], [0.118, 0.019], [0.095, 0.012], [0.07, 0.006], [0, 0.006]], 40);
      const willow = forge.canvas('kitchen:willow2', 512, 512, (g2, w) => {
        const c = w / 2, B = '#1d3a84';
        g2.fillStyle = '#ece8dc'; g2.fillRect(0, 0, w, w);
        g2.translate(c, c);
        // rim border: a dense band of diaper and fret with a scalloped inner edge
        g2.fillStyle = B; g2.beginPath(); g2.arc(0, 0, 246, 0, Math.PI * 2); g2.arc(0, 0, 196, 0, Math.PI * 2, true); g2.fill();
        g2.fillStyle = '#ece8dc';
        for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; g2.save(); g2.rotate(a); g2.fillRect(-3, -240, 6, 12); g2.beginPath(); g2.arc(0, -214, 7, 0, Math.PI * 2); g2.fill(); g2.restore(); }
        for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; g2.save(); g2.rotate(a); g2.beginPath(); g2.moveTo(-18, -196); g2.quadraticCurveTo(0, -178, 18, -196); g2.fill(); g2.restore(); }
        g2.strokeStyle = B; g2.lineWidth = 3;
        for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; g2.save(); g2.rotate(a); g2.beginPath(); g2.moveTo(-18, -194); g2.quadraticCurveTo(0, -172, 18, -194); g2.stroke(); g2.restore(); }
        g2.lineWidth = 2; g2.beginPath(); g2.arc(0, 0, 150, 0, Math.PI * 2); g2.stroke();
        // the scene: pagoda on the right, willow tree, a bridge with three figures, a boat, two birds
        g2.fillStyle = B; g2.strokeStyle = B;
        g2.fillRect(30, -40, 70, 50); g2.beginPath(); g2.moveTo(15, -40); g2.lineTo(65, -78); g2.lineTo(115, -40); g2.fill();
        g2.beginPath(); g2.moveTo(40, -78); g2.lineTo(65, -100); g2.lineTo(90, -78); g2.fill();
        g2.fillStyle = '#ece8dc'; for (let k = 0; k < 3; k++) g2.fillRect(40 + k * 20, -28, 10, 16); g2.fillStyle = B;
        g2.lineWidth = 6; g2.beginPath(); g2.moveTo(-40, 60); g2.quadraticCurveTo(-55, 0, -70, -50); g2.stroke();
        for (let k = 0; k < 12; k++) { g2.lineWidth = 2; g2.beginPath(); const sx = -70 + (k % 4) * 8, sy = -50 + Math.floor(k / 4) * 12; g2.moveTo(sx, sy); g2.quadraticCurveTo(sx - 30 + k * 4, sy + 30, sx - 20 + k * 5, sy + 70); g2.stroke(); }
        g2.lineWidth = 4; g2.beginPath(); g2.moveTo(-120, 70); g2.quadraticCurveTo(-60, 30, 0, 70); g2.stroke();
        for (let k = 0; k < 3; k++) { g2.beginPath(); g2.arc(-95 + k * 30, 48 - Math.sin((k + 1) / 4 * Math.PI) * 14, 6, 0, Math.PI * 2); g2.fill(); g2.fillRect(-99 + k * 30, 52 - Math.sin((k + 1) / 4 * Math.PI) * 14, 8, 14); }
        g2.beginPath(); g2.moveTo(10, 100); g2.lineTo(70, 100); g2.lineTo(60, 112); g2.lineTo(20, 112); g2.fill();
        for (const [bx, by] of [[-20, -110], [20, -125]]) { g2.lineWidth = 3; g2.beginPath(); g2.moveTo(bx - 14, by); g2.quadraticCurveTo(bx - 6, by - 10, bx, by); g2.quadraticCurveTo(bx + 6, by - 10, bx + 14, by); g2.stroke(); }
        // water lines and the fence
        g2.lineWidth = 1.5; for (let k = 0; k < 6; k++) { g2.beginPath(); g2.moveTo(-130 + k * 12, 90 + k * 6); g2.lineTo(-20 + k * 20, 90 + k * 6); g2.stroke(); }
        for (let x = -140; x < 140; x += 14) { g2.beginPath(); g2.moveTo(x, 120); g2.lineTo(x + 7, 128); g2.lineTo(x + 14, 120); g2.stroke(); }
        // the transfer print blurs slightly in the glaze
        g2.globalAlpha = 0.25; g2.filter = 'blur(2px)'; g2.drawImage(g2.canvas, -c, -c); g2.filter = 'none'; g2.globalAlpha = 1;
      }, { tile: false });
      const plateMat = new THREE.MeshPhysicalMaterial({ map: willow, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, name: 'willowPlate' });
      // planar UV for the plate face
      { const p = plateGeo.attributes.position, uv = plateGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.24 + 0.5, p.getZ(i) / 0.24 + 0.5); }
      for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
        const pm = mk(plateGeo, plateMat, rx0 + 0.1 + i * 0.13 + row * 0.05, ry + 0.135 + row * 0.34, Z0 + 0.1, Math.PI / 2 - 0.12, 0, 0);
        add(pm);
      }
    }

    // ================================================================ dresser + puzzle
    const dresser = buildDresser(ctx, mat, { L: 1.9 });
    dresser.group.position.set(X0, 0, DRESSER_Z);
    dresser.group.rotation.y = Math.PI / 2;
    add(dresser.group);
    // pantry clutter: crocks & jars on the upper shelves, bowls on the worktop
    {
      const dg = dresser.group;
      const L = dresser.L;
      const [s4, s5] = dresser.extraShelves;
      const jar = jarGeo(G, 0.17, 0.055);
      const jarGlass = new THREE.MeshPhysicalMaterial({ color: 0x9fb39c, roughness: 0.1, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1, name: 'jarGlass' });
      const preserve = [0x5a1410, 0x6b3a0c, 0x2f3a12, 0x4a0c22];
      const fillMats = preserve.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, name: 'preserve' }));
      // preserving shelf: a mixed run of glass - tall jars, squat pots, a bottle, a lidded storage jar - each its own fill
      {
        const R = ctx.random.fork('jars');
        const jarKinds = [
          (r, h) => lathe(G, [[0, 0], [r * 0.9, 0], [r, h * 0.05], [r, h * 0.78], [r * 0.8, h * 0.86], [r * 0.78, h * 0.95], [0, h * 0.95]], 28),
          (r, h) => lathe(G, [[0, 0], [r * 0.95, 0], [r * 1.08, h * 0.2], [r * 1.1, h * 0.55], [r * 0.95, h * 0.8], [r * 0.82, h * 0.86], [r * 0.84, h * 0.95], [0, h * 0.95]], 28),
          (r, h) => lathe(G, [[0, 0], [r * 0.9, 0], [r, h * 0.06], [r, h * 0.62], [r * 0.6, h * 0.74], [r * 0.32, h * 0.82], [r * 0.3, h * 0.98], [0, h * 0.98]], 28),
          (r, h) => lathe(G, [[0, 0], [r, 0], [r * 1.02, h * 0.5], [r, h * 0.9], [r * 0.92, h * 0.94], [0, h * 0.94]], 28),
        ];
        const glassCols = [0x9fb39c, 0xb4c0b0, 0x8a9a7a, 0xa8b0a0];
        const glassMats = glassCols.map((c, i) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.08 + i * 0.03, transparent: true, opacity: 0.5, clearcoat: 1, name: `jarGlass${i}` }));
        let x = -L / 2 + 0.1, i = 0;
        while (x < L / 2 - 0.12) {
          const kind = [0, 1, 0, 3, 2, 1, 0, 3, 1, 2][i % 10];
          const r = [0.052, 0.058, 0.045, 0.06][kind] * (0.88 + R.next() * 0.24), h = [0.17, 0.13, 0.2, 0.15][kind] * (0.85 + R.next() * 0.3);
          if (x + 2 * r > L / 2 - 0.06) break;
          x += r;
          const z = 0.15 + (R.next() - 0.5) * 0.06;
          const gm = glassMats[i % 4];
          add(mk(jarKinds[kind](r, h), gm, x, s4, z, 0, R.next() * 6, 0), dg);
          // contents: preserve, pickles, a half-empty jar
          const fillH = h * (kind === 2 ? 0.55 : 0.35 + R.next() * 0.45);
          add(mk(new THREE.CylinderGeometry(r * 0.88, r * 0.86, fillH, 20), fillMats[(i * 3) % 4], x, s4 + fillH / 2 + 0.004, z), dg);
          if (kind === 2) add(mk(new THREE.CylinderGeometry(r * 0.3, r * 0.28, 0.022, 12), new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9, name: 'cork2' }), x, s4 + h * 0.98 + 0.006, z), dg);
          else if (kind === 3) add(mk(lathe(G, [[0, 0], [r * 0.96, 0], [r * 0.98, 0.008], [r * 0.5, 0.018], [r * 0.18, 0.022], [r * 0.2, 0.04], [0, 0.044]], 24), gm, x, s4 + h * 0.94, z), dg);
          else {
            // muslin tied over the mouth with string
            add(mk(lathe(G, [[0, 0.012], [r * 0.86, 0.008], [r * 0.95, -0.012], [r * 0.97, -0.03], [r * 0.9, -0.03]], 24), mat.muslin, x, s4 + h * 0.95, z, 0, R.next() * 6, 0), dg);
            add(mk(new THREE.TorusGeometry(r * 0.86, 0.0018, 4, 24), mat.rope, x, s4 + h * 0.95 - 0.014, z, Math.PI / 2), dg);
          }
          x += r + 0.025 + R.next() * 0.045;
          i++;
        }
      }
      // top shelf: a mixed run of stoneware - salt-glaze, Bristol cream-and-brown, treacle brown - varied size, lids, labels
      {
        const R = ctx.random.fork('crocks');
        const greenGlaze = new THREE.MeshPhysicalMaterial({ color: 0x3e4a2c, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25, name: 'greenGlaze' });
        const ochreGlaze = new THREE.MeshPhysicalMaterial({ color: 0x8a6430, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3, name: 'ochreGlaze' });
        const greyGlaze = new THREE.MeshPhysicalMaterial({ color: 0x8d8a80, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4, name: 'greyGlaze' });
        const glazes = [mat.saltGlaze, mat.bristol, greenGlaze, mat.stonewareBrown, ochreGlaze, mat.bristol, greyGlaze, mat.saltGlaze, mat.stoneware];
        // a chip knocked out of the rim: the profile drops in a small notch over a short arc
        const chipRim = (geo, h, ang, wdt) => {
          const p = geo.attributes.position;
          for (let q = 0; q < p.count; q++) {
            const y = p.getY(q); if (y < h * 0.9) continue;
            const a = Math.atan2(p.getZ(q), p.getX(q)); const da = Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang)));
            if (da < wdt) p.setY(q, y - Math.min(y - h * 0.9, 0.012 * (1 - (da / wdt) ** 2)));
          }
          geo.computeVertexNormals();
        };
        const lblMat = new THREE.MeshStandardMaterial({ map: CV.crockLabels, roughness: 0.9, name: 'crockLabel' });
        let x = -L / 2 + 0.12;
        let k = 0;
        while (x < L / 2 - 0.12) {
          const sc = 0.85 + R.next() * 0.3;
          const r = (0.065 + R.next() * 0.03) * sc, h = (0.17 + R.next() * 0.08) * sc;
          if (x + 2 * r > L / 2 - 0.05) break;
          x += r;
          const gm = glazes[k % glazes.length];
          const cz = 0.14 + (R.next() - 0.5) * 0.06;
          const prof = k % 4;
          const vg = prof === 0 ? crock(G, h, r, 0.55 + R.next() * 0.35)
            : prof === 1 ? lathe(G, [[0, 0], [r * 0.92, 0], [r, h * 0.06], [r, h * 0.86], [r * 1.04, h * 0.9], [r * 1.04, h * 0.97], [r * 0.9, h], [0, h * 0.97]], 32)       // straight storage jar, rolled lip
            : prof === 2 ? lathe(G, [[0, 0], [r * 0.7, 0], [r * 1.05, h * 0.3], [r * 1.08, h * 0.5], [r * 0.85, h * 0.78], [r * 0.5, h * 0.88], [r * 0.55, h], [r * 0.45, h], [0, h * 0.95]], 32)   // bellied jug
            : lathe(G, [[0, 0], [r * 0.85, 0], [r * 0.95, h * 0.1], [r * 0.82, h * 0.5], [r * 0.95, h * 0.9], [r, h], [r * 0.9, h], [0, h * 0.96]], 32);   // waisted crock
          if (k % 3 === 0) chipRim(vg, h, R.next() * 6.28, 0.18 + R.next() * 0.12);
          const vm = mk(vg, gm, x, s5, cz, 0, R.next() * 6.28, 0);
          vm.scale.set(1 + (R.next() - 0.5) * 0.08, 1, 1 + (R.next() - 0.5) * 0.08);
          add(vm, dg);
          if (prof === 2) add(mk(tube([[r * 0.95, h * 0.72, 0], [r * 1.5, h * 0.7, 0], [r * 1.55, h * 0.4, 0], [r * 1.02, h * 0.3, 0]], 0.007, 16, 6), gm, x, s5, cz, 0, vm.rotation.y, 0), dg);
          // a glaze run or two down from the shoulder, and an impressed maker's stamp on some
          if (k % 3 !== 1) for (let q = 0; q < 2; q++) {
            const a = R.next() * Math.PI * 2, len = h * (0.15 + R.next() * 0.25);
            const run = new THREE.Mesh(new THREE.CapsuleGeometry(0.0035, len, 3, 6), gm === mat.saltGlaze ? mat.stonewareBrown : gm);
            run.position.set(x + Math.cos(a) * r * 1.01, s5 + h * 0.82 - len / 2, cz + Math.sin(a) * r * 1.01); run.scale.set(1, 1, 0.5); run.rotation.y = -a;
            add(run, dg);
          }
          const lt = k % 3;
          if (lt === 0) add(mk(lathe(G, [[0, 0], [r * 0.62, 0], [r * 0.64, 0.012], [r * 0.5, 0.018], [r * 0.12, 0.022], [r * 0.1, 0.04], [0, 0.042]], 20), mat.pineDark, x, s5 + h - 0.004, cz), dg);
          else if (lt === 1) add(mk(lathe(G, [[0, 0], [r * 0.7, 0], [r * 0.68, 0.01], [r * 0.3, 0.03], [r * 0.15, 0.04], [0, 0.045]], 20), gm === mat.bristol ? mat.stonewareBrown : gm, x, s5 + h - 0.002, cz), dg);
          else add(mk(lathe(G, [[0, -0.02], [r * 0.66, -0.02], [r * 0.7, 0.0], [r * 0.4, 0.02], [0, 0.026]], 20), mat.muslin, x, s5 + h, cz), dg);
          if (k % 2 === 0) {
            const li = (k / 2) % CV.crockLabelCount;
            const lg = new THREE.CylinderGeometry(r * 1.025, r * 1.025, 0.045, 16, 1, true, -0.45, 0.9);
            const uv = lg.attributes.uv;
            for (let q = 0; q < uv.count; q++) uv.setXY(q, uv.getX(q), 1 - (li + 1) / CV.crockLabelCount + uv.getY(q) / CV.crockLabelCount);
            add(mk(lg, lblMat, x, s5 + h * 0.5, cz, 0, (R.next() - 0.5) * 0.3, (R.next() - 0.5) * 0.06), dg);
          }
          x += r + 0.03 + R.next() * 0.05;
          k++;
        }
      }
      // mugs hung by their handles from brass cup hooks on a turned rail under the top shelf (well above the tins)
      {
        const mug = lathe(G, [[0, 0], [0.036, 0], [0.038, 0.01], [0.037, 0.075], [0.04, 0.085], [0.034, 0.085], [0.032, 0.012], [0, 0.01]], 24);
        const enamel = new THREE.MeshPhysicalMaterial({ color: 0xbdb7aa, roughness: 0.25, clearcoat: 0.8, name: 'enamelMug' });
        const blueRim = new THREE.MeshPhysicalMaterial({ color: 0x1c2f66, roughness: 0.25, clearcoat: 0.8, name: 'enamelBlue' });
        const railY = s5 - 0.04, railZ = dresser.SD - 0.03;
        add(mk(new THREE.CylinderGeometry(0.011, 0.011, L - 0.08, 12), mat.dresserPaint, 0, railY, railZ, 0, 0, Math.PI / 2), dg);
        const hookGeo = tube([[0, 0.016, 0], [0, -0.016, 0], [0, -0.032, 0.009], [0, -0.03, 0.024], [0, -0.016, 0.027]], 0.0034, 18, 6);
        for (let k = 0; k < 8; k++) {
          const x = -L / 2 + 0.17 + k * ((L - 0.34) / 7);
          add(mk(hookGeo, mat.brass, x, railY - 0.008, railZ + 0.008), dg);
          const side = k % 2 ? 1 : -1;
          const m = k % 3 === 0 ? blueRim : enamel;
          // pivot at the hook: handle loop at the pivot, body hanging out to one side and down
          const hold = new THREE.Group();
          // the handle loop hangs on the hook's crook; the mug's weight swings its body under the hook, mouth tilted up
          hold.add(mk(mug, m, 0, -0.088, -0.042));
          hold.add(mk(new THREE.TorusGeometry(0.022, 0.0055, 6, 16), m, 0, -0.024, -0.004, 0, Math.PI / 2, 0));
          hold.position.set(x, railY - 0.034, railZ + 0.032);
          hold.rotation.set(-0.32, side * 0.12, side * 0.06);
          add(hold, dg);
        }
      }
      // paraffin lamp at the near end of the worktop: warm raking light up the shelves
      const lamp = buildOilLamp(ctx, mat, { flame: 0.9 });
      lamp.group.position.set(0.7, dresser.BH, 0.3);
      add(lamp.group, dg);
      const lampLight = new THREE.PointLight(0xffa456, 1.5, 5, 2);
      lampLight.position.set(0.7, dresser.BH + lamp.flameY + 0.05, 0.36);
      add(lampLight, dg);
      ctx.onUpdate((dt, t) => { lampLight.intensity = 1.5 * (0.95 + 0.05 * Math.sin(t * 5.1) * Math.sin(t * 2.3)); });
      // worktop: mixing bowl, a crock of wooden spoons
      // yellowware mixing bowl: buff glaze, white slip band between blue lines, crazed
      {
        const ywTex = forge.canvas('kitchen:yellowware', 512, 256, (g2, W2, H2) => {
          g2.fillStyle = '#c99a4c'; g2.fillRect(0, 0, W2, H2);
          for (let k = 0; k < 60; k++) { g2.fillStyle = `rgba(${k % 2 ? 230 : 150},${k % 2 ? 190 : 110},${k % 2 ? 110 : 50},0.12)`; g2.beginPath(); g2.ellipse((k * 89) % W2, (k * 41) % H2, 30, 12, 0, 0, Math.PI * 2); g2.fill(); }
          // bands sit on the outside wall near the rim (lathe v runs base -> rim -> inside)
          const band = (v, h, c) => { g2.fillStyle = c; g2.fillRect(0, H2 * (1 - v) - h / 2, W2, h); };
          band(0.4, 16, '#efe3c4'); band(0.4 + 0.045, 4, '#2a4a8c'); band(0.4 - 0.045, 4, '#2a4a8c');
          g2.strokeStyle = 'rgba(60,40,20,0.35)'; g2.lineWidth = 0.7;
          for (let k = 0; k < 140; k++) { let x = (k * 131) % W2, y = (k * 71) % H2; g2.beginPath(); g2.moveTo(x, y); for (let q = 0; q < 4; q++) { x += ((k * (q + 3)) % 13) - 6; y += ((k * (q + 5)) % 11) - 5; g2.lineTo(x, y); } g2.stroke(); }
        });
        const yw = new THREE.MeshPhysicalMaterial({ map: ywTex, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2, name: 'yellowware' });
        const bowlG = new THREE.LatheGeometry([[0, 0], [0.08, 0], [0.16, 0.08], [0.18, 0.13], [0.175, 0.135], [0.15, 0.09], [0.07, 0.025], [0.0, 0.02]].map(([x, y]) => new THREE.Vector2(x, y)), 48);
        add(mk(bowlG, yw, 0.2, dresser.BH, 0.28), dg);
      }
      // a bloomer loaf, its end cut to show the crumb, on a bread board
      {
        const crustTex = forge.canvas('kitchen:crust', 512, 256, (g2, W2, H2) => {
          const gr = g2.createLinearGradient(0, 0, 0, H2);
          gr.addColorStop(0, '#5a3214'); gr.addColorStop(0.45, '#7a4a1e'); gr.addColorStop(0.75, '#9a6a34'); gr.addColorStop(1, '#6a4420');
          g2.fillStyle = gr; g2.fillRect(0, 0, W2, H2);
          for (let k = 0; k < 400; k++) { g2.fillStyle = `rgba(${k % 3 ? 40 : 200},${k % 3 ? 22 : 170},${k % 3 ? 8 : 120},${0.08 + (k % 4) * 0.03})`; g2.beginPath(); g2.arc((k * 97) % W2, (k * 53) % H2, 1 + (k % 5), 0, Math.PI * 2); g2.fill(); }
          // diagonal slashes over the top: pale, torn, floury
          for (let k = 0; k < 6; k++) {
            const x = 60 + k * 70;
            g2.save(); g2.translate(x, H2 * 0.32); g2.rotate(0.5);
            const sg = g2.createLinearGradient(-7, 0, 7, 0); sg.addColorStop(0, 'rgba(50,25,8,0.85)'); sg.addColorStop(0.4, '#b98a50'); sg.addColorStop(0.75, '#cfa86e'); sg.addColorStop(1, 'rgba(80,45,18,0.8)');
            g2.fillStyle = sg; g2.beginPath(); g2.ellipse(0, 0, 7, 46, 0, 0, Math.PI * 2); g2.fill();
            g2.restore();
          }
          // flour dusting
          for (let k = 0; k < 900; k++) { g2.fillStyle = `rgba(235,225,205,${0.1 + (k % 5) * 0.05})`; g2.fillRect((k * 211) % W2, (k * 137) % (H2 * 0.6), 2, 2); }
        });
        const crumbTex = forge.canvas('kitchen:crumb', 256, 256, (g2, W2) => {
          g2.fillStyle = '#5e3818'; g2.beginPath(); g2.arc(W2 / 2, W2 / 2, W2 / 2, 0, Math.PI * 2); g2.fill();
          g2.fillStyle = '#e2cc9c'; g2.beginPath(); g2.arc(W2 / 2, W2 / 2, W2 / 2 - 10, 0, Math.PI * 2); g2.fill();
          for (let k = 0; k < 700; k++) { const a = k * 2.399, r = Math.sqrt((k % 350) / 350) * (W2 / 2 - 14); g2.fillStyle = `rgba(150,110,60,${0.15 + (k % 4) * 0.08})`; g2.beginPath(); g2.ellipse(W2 / 2 + Math.cos(a) * r, W2 / 2 + Math.sin(a) * r, 1 + (k % 4), 0.8 + (k % 3), a, 0, Math.PI * 2); g2.fill(); }
        }, { tile: false });
        const crust = new THREE.MeshPhysicalMaterial({ map: crustTex, roughness: 0.8, sheen: 0.4, sheenColor: new THREE.Color(0.6, 0.45, 0.3), name: 'loafCrust' });
        const lg = new THREE.SphereGeometry(0.1, 96, 48);
        lg.scale(1.45, 0.68, 0.62);
        const cut = 0.1;
        {
          // scored bloomer: five diagonal slashes opened in the oven (a groove with one raised, torn ear), crackled crust
          const pp = lg.attributes.position;
          const ca = Math.cos(0.55), sa = Math.sin(0.55);
          for (let k = 0; k < pp.count; k++) {
            let x = pp.getX(k), y = pp.getY(k), z = pp.getZ(k);
            if (y > 0) {
              const along = (x * ca + z * sa * 1.6) / 0.042;
              const f = along - Math.round(along);
              const idxS = Math.round(along);
              const inBand = Math.abs(idxS) <= 2 ? 1 : 0;
              const across = Math.max(0, 1 - Math.abs(z) / 0.05) * Math.min(1, y / 0.03);
              const groove = Math.exp(-(f * f) / 0.012) * inBand * across;
              const ear = Math.exp(-((f - 0.22) ** 2) / 0.006) * inBand * across;
              const crackle = (Math.sin(x * 420 + z * 150) * Math.sin(z * 380 - x * 90) * 0.5 + 0.5) ** 6 * 0.0018;
              const k2 = 1 - groove * 0.16 + ear * 0.05 - crackle * 6;
              x *= 1; y *= k2; z *= 1 + (k2 - 1) * 0.4;
            }
            if (x > cut) x = cut;
            if (y < 0) y *= 0.25;
            pp.setXYZ(k, x, y, z);
          }
          lg.computeVertexNormals();
        }
        const loaf = new THREE.Group();
        loaf.add(mk(lg, crust, 0, 0.014, 0));
        const face = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), new THREE.MeshStandardMaterial({ map: crumbTex, roughness: 0.95, name: 'crumb' }));
        face.scale.set(0.62 * 0.98, 0.68 * 0.98, 1); face.rotation.y = Math.PI / 2; face.position.set(cut + 0.0005, 0.014 + 0.0, 0);
        { const fp = face.geometry.attributes.position; for (let k = 0; k < fp.count; k++) if (fp.getY(k) < 0) fp.setY(k, fp.getY(k) * 0.25); }
        loaf.add(face);
        add(mk(rbox(G, 0.42, 0.022, 0.26, 0.008), mat.counter, -0.25, dresser.BH + 0.011, 0.27, 0, 0.1, 0), dg);
        loaf.position.set(-0.27, dresser.BH + 0.022, 0.27); loaf.rotation.y = Math.PI - 0.55;
        add(loaf, dg);
        // a slice lying beside it
        const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 24), new THREE.MeshStandardMaterial({ map: crumbTex, color: 0xb8a888, roughness: 0.95, name: 'slice' }));
        sl.scale.set(1, 1, 0.9); sl.position.set(-0.08, dresser.BH + 0.028, 0.3); sl.rotation.set(0.0, 0.4, 0.06);
        add(sl, dg);
      }
      add(mk(crock(G, 0.18, 0.065, 0.95), mat.stonewareBrown, -0.55, dresser.BH, 0.3), dg);
      for (let i = 0; i < 4; i++) {
        const sp = new THREE.Group();
        sp.add(mk(new THREE.CylinderGeometry(0.007, 0.006, 0.22, 8), mat.pine, 0, 0.11, 0));
        sp.add(mk(new THREE.SphereGeometry(0.022, 12, 8), mat.pine, 0, 0.23, 0)).scale.set(1, 1.4, 0.4);
        sp.position.set(-0.55 + (i - 1.5) * 0.015, dresser.BH + 0.05, 0.3);
        sp.rotation.set((i - 1.5) * 0.15, i, (i % 2 ? 0.15 : -0.12));
        add(sp, dg);
      }
    }
    // warm wash over the tin shelves from the gas bracket beyond the dresser (motivated, soft)
    {
      const sp = new THREE.SpotLight(0xffb468, 3.6, 4.0, 0.55, 0.95, 2);
      sp.position.set(X0 + 0.32, 2.15, 0.15);
      sp.target.position.set(X0 + 0.1, 1.55, DRESSER_Z - 0.1);
      add(sp); add(sp.target);
      // a dim cool fill from the window side so the carcass and back boards keep their form
      const cf = new THREE.SpotLight(0x8fa6d8, 1.1, 4.5, 0.7, 1.0, 2);
      cf.position.set(X0 + 1.6, 2.3, DRESSER_Z - 1.6);
      cf.target.position.set(X0 + 0.1, 1.45, DRESSER_Z + 0.2);
      add(cf); add(cf.target);
      // a weak, low, raking warm wash up the back boards so the beading reads behind the tins (the pantry lamp's spill)
      const bw = new THREE.SpotLight(0xffa860, 1.6, 2.6, 0.75, 1.0, 2);
      bw.position.set(X0 + 0.75, 1.05, DRESSER_Z + 0.35);
      bw.target.position.set(X0 + 0.03, 1.75, DRESSER_Z - 0.05);
      add(bw); add(bw.target);
    }
    const camDist = 1.52;
    const shelfMidY = (dresser.shelves[2].y + dresser.shelves[0].y + 0.126) / 2;
    const cans = await createCansPuzzle(ctx, dresser.group, dresser.shelves, {
      tinMat: mat.tinPlate,
      camera: { position: [X0 + camDist, shelfMidY + 0.015, DRESSER_Z], target: [X0, shelfMidY, DRESSER_Z], fov: 35 },
      onSolved: async () => { revealDumbwaiter(true); await say('A pinch of salt, a splash of sherry... and a *guest*. Somewhere above you, the dumbwaiter begins to move.'); },
    });
    // ---- the pantry shelves round the tins: scalloped paper edging, and the cook's clutter
    {
      const dg = dresser.group, L = dresser.L, SD = dresser.SD;
      // pressed-tin shelf edging: a scalloped strip with punched rosettes, tacked to each shelf lip
      {
        const EL = L - 0.07, EH = 0.036, sc = 0.032;
        const sh = new THREE.Shape();
        sh.moveTo(-EL / 2, 0); sh.lineTo(EL / 2, 0); sh.lineTo(EL / 2, -EH * 0.55);
        const nS = Math.round(EL / sc), scw = EL / nS;
        for (let k = nS - 1; k >= 0; k--) { const xm = -EL / 2 + (k + 0.5) * scw; sh.absarc(xm, -EH * 0.55, scw / 2, 0, Math.PI, false); }
        sh.lineTo(-EL / 2, 0);
        for (let k = 0; k < nS; k++) {
          const xm = -EL / 2 + (k + 0.5) * scw;
          const hp = new THREE.Path(); hp.absarc(xm, -EH * 0.6, 0.0042, 0, Math.PI * 2, true); sh.holes.push(hp);
          if (k < nS - 1) { const hq = new THREE.Path(); hq.absarc(xm + scw / 2, -EH * 0.22, 0.0022, 0, Math.PI * 2, true); sh.holes.push(hq); }
        }
        const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.0008, bevelEnabled: false, curveSegments: 6 });
        // a pressed bead along the top: bend the upper band forward a touch
        { const p = eg.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k); p.setZ(k, p.getZ(k) + 0.0025 * Math.exp(-((y + 0.006) ** 2) / 0.00002) + Math.max(0, -y - 0.012) * 0.12); } eg.computeVertexNormals(); }
        G.applyBoxUVs(eg, 6);
        const edgeMat = new THREE.MeshStandardMaterial({ map: mat.tinPlate.map, normalMap: mat.tinPlate.normalMap, normalScale: new THREE.Vector2(1.5, 1.5), metalness: 0.85, roughness: 0.5, color: new THREE.Color(0.5, 0.42, 0.3), envMapIntensity: 0.45, side: THREE.DoubleSide, name: 'shelfTin' });
        for (const y of dresser.shelfYs) {
          add(mk(eg, edgeMat, 0, y - 0.004, SD + 0.0075), dg);
          for (let k = 0; k < 9; k++) add(mk(new THREE.SphereGeometry(0.0022, 6, 4), mat.iron, -EL / 2 + 0.05 + k * ((EL - 0.1) / 8), y - 0.009, SD + 0.0095), dg);
        }
      }
      // row ends: stoneware, a paper-wrapped parcel, a spice box, the cook's ledger, a jar of pickles
      const paper = new THREE.MeshStandardMaterial({ color: 0xb7a27c, roughness: 0.9, name: 'brownPaper' });
      const leather = new THREE.MeshPhysicalMaterial({ color: 0x3a1a12, roughness: 0.6, clearcoat: 0.2, name: 'ledger' });
      const pages = new THREE.MeshStandardMaterial({ color: 0xd8ccae, roughness: 0.9, name: 'pages' });
      const pickle = new THREE.MeshStandardMaterial({ color: 0x4d5420, roughness: 0.5, name: 'pickles' });
      const jarGl = new THREE.MeshPhysicalMaterial({ color: 0xa8b8a0, roughness: 0.08, transparent: true, opacity: 0.45, clearcoat: 1, name: 'jarGlass2' });
      const items = [
        (w) => { const g2 = new THREE.Group(); g2.add(mk(crock(G, 0.15, 0.052, 0.7), mat.saltGlaze)); g2.add(mk(lathe(G, [[0, 0], [0.036, 0], [0.034, 0.01], [0.012, 0.02], [0, 0.022]], 20), mat.stonewareBrown, 0, 0.148, 0)); return [g2, 0.11]; },
        (w) => { const g2 = new THREE.Group(); g2.add(mk(rbox(G, 0.15, 0.07, 0.11, 0.012), paper, 0, 0.035, 0)); g2.add(mk(rbox(G, 0.152, 0.004, 0.012, 0.002), mat.rope, 0, 0.071, 0)); g2.add(mk(rbox(G, 0.012, 0.072, 0.112, 0.002), mat.rope, 0.02, 0.036, 0)); return [g2, 0.17]; },
        (w) => { const g2 = new THREE.Group(); g2.add(mk(rbox(G, 0.13, 0.11, 0.1, 0.004), mat.pineDark, 0, 0.055, 0)); for (let r2 = 0; r2 < 2; r2++) for (let c2 = 0; c2 < 2; c2++) { g2.add(mk(rbox(G, 0.055, 0.045, 0.004, 0.002), mat.pineDark, -0.031 + c2 * 0.062, 0.03 + r2 * 0.05, 0.051)); g2.add(mk(new THREE.SphereGeometry(0.005, 8, 6), mat.brass, -0.031 + c2 * 0.062, 0.03 + r2 * 0.05, 0.056)); } return [g2, 0.15]; },
        (w) => { const g2 = new THREE.Group(); g2.add(mk(rbox(G, 0.17, 0.035, 0.22, 0.004), leather, 0, 0.0175, 0, 0, 0.15, 0)); g2.add(mk(rbox(G, 0.16, 0.028, 0.213, 0.002), pages, 0.006, 0.0175, 0, 0, 0.15, 0)); return [g2, 0.21]; },
        (w) => { const g2 = new THREE.Group(); g2.add(mk(jarGeo(G, 0.14, 0.045), jarGl)); g2.add(mk(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 18), pickle, 0, 0.055, 0)); g2.add(mk(new THREE.CylinderGeometry(0.047, 0.047, 0.012, 20), mat.muslin, 0, 0.137, 0)); return [g2, 0.11]; },
        (w) => { const g2 = new THREE.Group(); g2.add(mk(crock(G, 0.1, 0.045, 0.85), mat.stonewareBrown)); return [g2, 0.1]; },
      ];
      let ii = 0;
      cans.layout.forEach((row, ri) => {
        for (const side of [-1, 1]) {
          let x = side < 0 ? -L / 2 + 0.07 : row.x1 + 0.06;
          const lim = side < 0 ? row.x0 - 0.05 : L / 2 - 0.07;
          let guard = 0;
          while (guard++ < 8) {
            const [m, w] = items[(ii + ri * 2) % items.length]();
            if (x + w > lim) { ii++; if (guard > 3) break; continue; }
            m.position.set(x + w / 2, row.y, row.z - 0.01 + ((ii * 37) % 5 - 2) * 0.006);
            m.rotation.y = ((ii * 53) % 7 - 3) * 0.12;
            add(m, dg);
            x += w + 0.025; ii++;
          }
        }
      });
    }

    // ================================================================ butcher block + props
    const blk = buildButcherBlock(ctx, mat, { W: 1.5, D: 0.78 });
    blk.group.position.copy(BLOCK);
    add(blk.group);
    const TY = blk.TOPY;
    const sY = blk.surfaceY;
    let candle;
    {
      const bg = blk.group;
      // cleaver bitten into the block
      const cl = new THREE.Group();
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(0, 0); bladeShape.lineTo(0.2, 0); bladeShape.lineTo(0.21, 0.1); bladeShape.lineTo(0.0, 0.11); bladeShape.lineTo(0, 0);
      const blade = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.002, bevelSegments: 1 });
      cl.add(mk(G.applyBoxUVs(blade, 6), mat.steel));
      cl.add(mk(rbox(G, 0.13, 0.024, 0.02, 0.008), mat.mahogany, -0.06, 0.08, 0.002));
      for (const x of [-0.03, -0.09]) cl.add(mk(new THREE.CylinderGeometry(0.004, 0.004, 0.024, 8), mat.brass, x, 0.08, 0.002, Math.PI / 2));
      cl.position.set(0.42, sY(0.42, 0.12) - 0.025, 0.12); cl.rotation.set(0.1, 0.7, -0.15);
      add(cl, bg);
      // rolling pin, dough in a heap of flour, the scale, a bowl of eggs, a candle in a chamberstick
      add(mk(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 24), mat.maple, -0.1, sY(-0.1, 0.2) + 0.03, 0.2, 0, 0.4, Math.PI / 2), bg);
      for (const s of [-1, 1]) add(mk(new THREE.CylinderGeometry(0.012, 0.014, 0.1, 12), mat.maple, -0.1 + s * 0.2 * Math.cos(0.4), sY(-0.1, 0.2) + 0.03, 0.2 - s * 0.2 * Math.sin(0.4), 0, 0.4, Math.PI / 2), bg);
      add(mk(flourMound({ R: 0.2, h: 0.016, seed: 7, stretch: 1.15 }), mat.flour, -0.4, sY(-0.4, 0.05) - 0.002, 0.05, 0, 0.4, 0), bg).scale.set(1, 1, 0.85);
      add(mk(new THREE.SphereGeometry(0.075, 32, 20), new THREE.MeshPhysicalMaterial({ color: 0xd8c39a, roughness: 0.7, sheen: 0.4, name: 'dough' }), -0.38, sY(-0.38, 0.06) + 0.055, 0.06), bg).scale.set(1.15, 0.55, 1);
      const scale = buildScale(G, mat);
      scale.position.set(-0.45, sY(-0.45, -0.25), -0.25); scale.rotation.y = 0.2;
      add(scale, bg);
      const bowl = lathe(G, [[0, 0], [0.06, 0], [0.12, 0.06], [0.13, 0.085], [0.122, 0.085], [0.11, 0.06], [0.0, 0.012]], 36);
      add(mk(bowl, mat.stonewareBrown, 0.0, sY(0, -0.2), -0.2), bg);
      const egg = new THREE.SphereGeometry(0.022, 16, 12);
      const eggMat = new THREE.MeshStandardMaterial({ color: 0xcdb08a, roughness: 0.6, name: 'egg' });
      [[0.0, 0.05, -0.18], [0.03, 0.05, -0.22], [-0.03, 0.055, -0.21], [0.01, 0.075, -0.2]].forEach(([x, y, z]) => add(mk(egg, eggMat, x, sY(0, -0.2) + y, z), bg).scale.set(1, 1.3, 1));
      // a single dented Stauf tin, stood in the candlelight: a lure toward the pantry
      cans.lure.position.set(0.2, sY(0.2, 0.1) - 0.004, 0.1); cans.lure.rotation.set(0.04, -0.25, 0.02);
      add(cans.lure, bg);
      // chamberstick + lit candle: the warm key light of the room (shadowed)
      add(mk(lathe(G, [[0, 0], [0.075, 0], [0.078, 0.006], [0.07, 0.012], [0.02, 0.016], [0.016, 0.05], [0.026, 0.055], [0.022, 0.06], [0, 0.06]], 32), mat.brass, 0.62, sY(0.62, -0.18), -0.18), bg);
      add(mk(new THREE.TorusGeometry(0.025, 0.005, 8, 16), mat.brass, 0.7, sY(0.62, -0.18) + 0.03, -0.18, 0, 0, Math.PI / 2), bg);
      candle = fx.candle({ height: 0.13, radius: 0.012, light: true, lightIntensity: 3.2, lightDistance: 7, castShadow: Q.shadows, shadowMapSize: 1024, seed: 7, burn: 0.8 });
      candle.position.set(0.62, sY(0.62, -0.18) + 0.06, -0.18);
      waxDrips(candle, 0.012, 0.13, 7);
      add(candle, bg);
      // flour sack slumped on the pot board + a basket of onions
      lyingSack(5, { r: 0.15, h: 0.46, slump: 0.6, flour: 0.9 }, -0.4, 0.05, 0.25, bg, blk.POTY);
      add(mk(lathe(G, [[0, 0], [0.13, 0], [0.16, 0.1], [0.15, 0.11], [0.0, 0.11]], 24), mat.pine, 0.35, blk.POTY, 0), bg);
      const onion = new THREE.SphereGeometry(0.04, 12, 10);
      const onMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.5, name: 'onion' });
      for (let i = 0; i < 6; i++) add(mk(onion, onMat, 0.35 + Math.cos(i * 1.1) * 0.07, blk.POTY + 0.1 + (i > 3 ? 0.04 : 0), Math.sin(i * 1.1) * 0.07), bg);
    }

    // a Windsor chair pulled out from the block, and another by the range
    {
      const c1 = buildWindsorChair(G, mat);
      c1.position.set(BLOCK.x - 0.95, 0, BLOCK.z + 0.75); c1.rotation.y = 2.4;
      add(c1);
      const c2 = buildWindsorChair(G, mat);
      c2.position.set(CH.x1 + 0.35, 0, Z0 + 1.05); c2.rotation.y = -0.5;
      add(c2);
    }

    // ================================================================ pot rack over the block (chains up to hook plates on the beam)
    {
      const pr = new THREE.Group(); pr.name = 'potrack';
      const RY = 2.28, RW = 1.25, RD = 0.5;
      const frame = [V3(-RW / 2, 0, -RD / 2), V3(RW / 2, 0, -RD / 2), V3(RW / 2, 0, RD / 2), V3(-RW / 2, 0, RD / 2)];
      pr.add(mk(G.sweepProfile([V2(0, -0.02), V2(0.01, -0.02), V2(0.01, 0.02), V2(0, 0.02)], frame, { closed: true, uvScale: 2 }), mat.iron));
      pr.add(mk(new THREE.CylinderGeometry(0.008, 0.008, RW, 8), mat.iron, 0, 0, 0, 0, 0, Math.PI / 2));
      for (const x of [-RW / 2, RW / 2]) for (const z of [-RD / 2, RD / 2]) pr.add(mk(new THREE.SphereGeometry(0.016, 12, 8), mat.iron, x, 0, z));
      // chains: each corner up to one of two hook plates on the beam soffit
      const topY = H - BEAM_H - 0.012 - RY;
      const link = new THREE.TorusGeometry(0.012, 0.003, 6, 12);
      const links = [];
      for (const [x, z] of [[-RW / 2, -RD / 2], [RW / 2, -RD / 2], [-RW / 2, RD / 2], [RW / 2, RD / 2]]) {
        const a = V3(x, 0.02, z), b = V3(Math.sign(x) * 0.4, topY - 0.03, 0);
        const len = a.distanceTo(b), n = Math.floor(len / 0.021);
        const dir = b.clone().sub(a).normalize();
        const q0 = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir);
        for (let i = 0; i < n; i++) {
          const q = q0.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i % 2 ? Math.PI / 2 : 0, Math.PI / 2)));
          links.push({ geo: link, m: new THREE.Matrix4().compose(a.clone().addScaledVector(dir, (i + 0.5) * (len / n)), q, V3(1, 1.4, 1)) });
        }
      }
      pr.add(new THREE.Mesh(mergeInto(links), mat.iron));
      for (const x of [-0.4, 0.4]) {
        pr.add(mk(rbox(G, 0.1, 0.012, 0.1, 0.003), mat.iron, x, topY + 0.006, 0));
        for (const [dx, dz] of [[-0.035, -0.035], [0.035, -0.035], [-0.035, 0.035], [0.035, 0.035]]) pr.add(mk(new THREE.SphereGeometry(0.006, 8, 6), mat.iron, x + dx, topY - 0.002, dz));
        pr.add(mk(new THREE.TorusGeometry(0.016, 0.0045, 8, 16), mat.iron, x, topY - 0.022, 0, 0, Math.PI / 2, 0));
      }
      // S-hooks along both long bars, pans hung by their loops
      const hang = [];
      const hooksAt = [-0.52, -0.3, -0.08, 0.14, 0.36, 0.55];
      hooksAt.forEach((x, i) => { const z = i % 2 ? RD / 2 : -RD / 2; hang.push([x, -0.066, z]); });
      [[0, 0.11, 0.1, 0.22], [2, 0.09, 0.085, 0.2], [4, 0.1, 0.095, 0.21]].forEach(([hi, r, h, hl], k) => {
        const [x, , z] = hang[hi];
        hangPan(pr, buildSaucepan(G, mat, r, h, hl, { seed: 10 + k }), V3(x, 0, z), z > 0 ? 1 : -1, (k - 1) * 0.04, (k - 1) * 0.5 + 0.35);
      });
      for (const hi of [1, 3, 5]) { const [x, , z] = hang[hi]; pr.add(mk(sHookGeo, mat.iron, x, 0, z)); }
      // colander (perforated look via ring of dark dots), ladle, herb bundles, a ham in muslin
      {
        // a perforated tinned colander on a foot ring, hung by one of its two drop handles
        const [x, y, z] = hang[1];
        const holes = forge.canvas('kitchen:colanderHoles', 512, 256, (g2, w, h) => {
          g2.fillStyle = '#fff'; g2.fillRect(0, 0, w, h);
          g2.fillStyle = '#000';
          for (let r = 0; r < 9; r++) { const v = 0.16 + r * 0.075; const n = Math.round(12 + r * 6); for (let k = 0; k < n; k++) { g2.beginPath(); g2.arc(((k + (r % 2) * 0.5) / n) * w, h * (1 - v), 3.2, 0, Math.PI * 2); g2.fill(); } }
          // a rosette pierced in the floor
          for (let k = 0; k < 8; k++) { g2.beginPath(); g2.arc((k / 8) * w, h * 0.95, 3, 0, Math.PI * 2); g2.fill(); }
        }, { tile: false });
        const colMat = new THREE.MeshStandardMaterial({ color: 0xb8b4aa, metalness: 0.85, roughness: 0.42, alphaMap: holes, alphaTest: 0.5, side: THREE.DoubleSide, name: 'colander' });
        const cg = new THREE.Group();
        const bowl = new THREE.LatheGeometry([[0, 0.012], [0.05, 0.014], [0.085, 0.03], [0.11, 0.065], [0.122, 0.1], [0.125, 0.11]].map(([a, b]) => V2(a, b)), 40);
        cg.add(new THREE.Mesh(bowl, colMat));
        cg.add(mk(new THREE.TorusGeometry(0.126, 0.003, 6, 48), mat.tinPlate, 0, 0.11, 0, Math.PI / 2));
        cg.add(mk(lathe(G, [[0.055, 0], [0.062, 0], [0.06, 0.014], [0.052, 0.014]], 32), mat.tinPlate));
        for (const s2 of [-1, 1]) cg.add(mk(new THREE.TorusGeometry(0.025, 0.004, 6, 14, Math.PI), mat.tinPlate, s2 * 0.126, 0.095, 0, 0, s2 > 0 ? -Math.PI / 2 : Math.PI / 2, 0));
        // hang from the S-hook by the +x drop handle, opening toward the room
        cg.setRotationFromMatrix(new THREE.Matrix4().makeBasis(V3(0, 1, 0), V3(0, 0, 1), V3(1, 0, 0)));
        cg.rotateY(0.25);
        cg.position.set(x, y - 0.151, z - 0.095);
        pr.add(cg);
      }
      {
        const [x, y, z] = hang[3];
        const ladle = new THREE.Group();
        ladle.add(mk(new THREE.CylinderGeometry(0.006, 0.006, 0.36, 8), mat.steel, 0, -0.18, 0));
        ladle.add(mk(new THREE.SphereGeometry(0.045, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat.steel, 0, -0.36, 0.0));
        ladle.position.set(x, y, z);
        pr.add(ladle);
      }
      {
        // a plaited string of onions and garlic hung from the last hook
        const [x, y, z] = hang[5];
        pr.add(mk(sHookGeo, mat.iron, x, 0, z));
        const os = buildOnionString(G, onionMats, { seed: 3, len: 0.5, n: 12 });
        os.position.set(x, y - 0.02, z); os.rotation.y = 0.6;
        pr.add(os);
      }
      for (const [x, z] of [[-0.42, RD / 2], [0.25, -RD / 2]]) {
        const herb = new THREE.Group();
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2;
          herb.add(mk(new THREE.CylinderGeometry(0.002, 0.004, 0.32, 4), mat.herbs, Math.cos(a) * 0.015, -0.16, Math.sin(a) * 0.015, Math.sin(a) * 0.18, 0, Math.cos(a) * 0.18));
          herb.add(mk(new THREE.SphereGeometry(0.018, 6, 4), mat.herbs, Math.cos(a) * 0.05, -0.3 + (k % 3) * 0.03, Math.sin(a) * 0.05)).scale.set(1, 2.4, 1);
        }
        herb.add(mk(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 10), mat.rope, 0, -0.02, 0));
        herb.position.set(x, -0.0, z);
        pr.add(herb);
      }
      pr.position.set(BLOCK.x, RY, BLOCK.z);
      add(pr);
    }

    // ================================================================ dumbwaiter (right wall)
    let hatch, dumbLight, cloche;
    const dumb = { open: ctx.state.isSolved(CANS_ID), t: ctx.state.isSolved(CANS_ID) ? 1 : 0.42 };
    {
      const g = new THREE.Group(); g.name = 'dumbwaiter';
      const zc = DUMB.z, y0 = DUMB.y, w = DUMB.w, h = DUMB.h, D = 0.6;
      // shaft (behind the wall plane at x = X1)
      const shaftBack = new THREE.Mesh(G.planeUV(w + 0.02, 2.4, 1), mat.boarding);
      shaftBack.rotation.y = -Math.PI / 2; shaftBack.position.set(X1 + D, y0 + 0.5, zc); g.add(shaftBack);
      for (const s of [-1, 1]) {
        const side = new THREE.Mesh(G.planeUV(D, 2.4, 1), mat.boarding);
        side.rotation.y = s > 0 ? Math.PI : 0; side.position.set(X1 + D / 2, y0 + 0.5, zc + s * w / 2); g.add(side);
      }
      // the car: a shelf box with a silver cloche
      const car = new THREE.Group();
      // a short car (52 cm) so the dark shaft, its guide rails and the hauling ropes show above it
      const CHT = 0.52;
      car.add(mk(rbox(G, D - 0.06, 0.03, w - 0.04, 0.004), mat.pineDark, 0, 0, 0));
      car.add(mk(rbox(G, D - 0.06, 0.03, w - 0.04, 0.004), mat.pineDark, 0, CHT, 0));
      car.add(mk(rbox(G, 0.02, CHT, w - 0.04, 0.004), mat.pineDark, D / 2 - 0.04, CHT / 2, 0));
      // iron crosshead and shackle the ropes are spliced to
      car.add(mk(rbox(G, 0.05, 0.03, w - 0.1, 0.004), mat.iron, 0.02, CHT + 0.03, 0));
      for (const sd of [-1, 1]) car.add(mk(new THREE.TorusGeometry(0.016, 0.004, 6, 14), mat.iron, 0.02, CHT + 0.06, sd * (w / 2 - 0.07)));
      cloche = new THREE.Group();
      cloche.add(mk(lathe(G, [[0, 0], [0.17, 0], [0.18, 0.005], [0.17, 0.012], [0.0, 0.012]], 40), M.basic('silver', { roughness: 0.25 })));
      cloche.add(mk(lathe(G, [[0.155, 0.01], [0.155, 0.04], [0.14, 0.1], [0.1, 0.15], [0.05, 0.17], [0.0, 0.175]], 40), M.basic('silver', { roughness: 0.2 })));
      cloche.add(mk(lathe(G, [[0, 0], [0.012, 0], [0.006, 0.015], [0.02, 0.03], [0.0, 0.035]], 16), M.basic('silver', { roughness: 0.2 }), 0, 0.175, 0));
      cloche.position.set(-0.02, 0.015, 0);
      car.add(cloche);
      for (const sd of [-1, 1]) car.add(mk(rbox(G, D - 0.08, CHT, 0.016, 0.003), mat.pineDark, 0, CHT / 2, sd * (w / 2 - 0.03)));
      // a linen napkin and a folded note on the car's floor beside the cloche
      car.add(mk(rbox(G, 0.12, 0.004, 0.09, 0.001), new THREE.MeshStandardMaterial({ color: 0xd6cfbf, roughness: 0.9, name: 'note' }), 0.05, 0.017, w / 2 - 0.12, 0, 0.4, 0));
      car.position.set(X1 + D / 2 + 0.02, y0 + 0.005, zc);
      g.add(car);
      // hemp hauling ropes twisted (two strands), the car hangs from them
      const ropeGeo = (len) => { const pts = []; for (let i = 0; i <= 40; i++) pts.push([0.003 * Math.cos(i * 2.2), (i / 40) * len, 0.003 * Math.sin(i * 2.2)]); return tube(pts, 0.007, 80, 6); };
      const hemp = new THREE.MeshStandardMaterial({ color: 0x7a6342, roughness: 0.95, name: 'hemp' });
      hemp.map = forge.canvas('kitchen:hemp', 64, 256, (g2, W2, H2) => {
        g2.fillStyle = '#9a8460'; g2.fillRect(0, 0, W2, H2);
        g2.strokeStyle = 'rgba(40,28,14,0.6)'; g2.lineWidth = 3;
        for (let y = -W2; y < H2 + W2; y += 10) { g2.beginPath(); g2.moveTo(0, y); g2.lineTo(W2, y + W2 * 0.7); g2.stroke(); }
      });
      hemp.map.repeat.set(1, 12);
      // casing, sill, sash door
      const cs = casing(w, h, y0 - 0.06, G.PROFILES.chairRail(0.09, 0.032), mat.hatch, 0.0);
      cs.position.set(X1, 0, zc); cs.rotation.y = -Math.PI / 2;
      g.add(cs);
      g.add(mk(rbox(G, 0.14, 0.045, w + 0.24, 0.01), mat.hatch, X1 - 0.05, y0 - 0.0225, zc));
      // jambs with the sash grooves inside the wall thickness
      for (const sd of [-1, 1]) {
        g.add(mk(new THREE.BoxGeometry(0.1, h + 0.1, 0.022), mat.hatch, X1 + 0.05, y0 + h / 2, zc + sd * (w / 2 + 0.011)));
        g.add(mk(new THREE.BoxGeometry(0.012, h + 0.1, 0.012), mat.iron, X1 + 0.03, y0 + h / 2, zc + sd * (w / 2 - 0.006)));
      }
      // the sash door: framed & boarded, two brass finger pulls and a lift handle on the bottom rail
      hatch = new THREE.Group();
      {
        const dw = w - 0.01, dh = h + 0.04, T = 0.026;
        const fr = (bw, bh, z, y) => hatch.add(mk(rbox(G, T, bh, bw, 0.004), mat.hatch, 0, y, z));
        fr(dw, 0.075, 0, -dh / 2 + 0.0375); fr(dw, 0.06, 0, dh / 2 - 0.03); fr(0.06, dh, -dw / 2 + 0.03, 0); fr(0.06, dh, dw / 2 - 0.03, 0);
        hatch.add(mk(G.planeUV(dw - 0.1, dh - 0.12, 1), mat.boarding, -0.004, 0.005, 0, 0, -Math.PI / 2, 0));
        for (const zz of [-0.13, 0.13]) {
          hatch.add(mk(lathe(G, [[0, 0], [0.026, 0], [0.026, 0.004], [0.02, 0.006], [0.017, 0.002], [0, 0.002]], 24), mat.brass, -T / 2 - 0.001, -dh / 2 + 0.04, zz, 0, 0, Math.PI / 2));
        }
        hatch.add(mk(tube([[0, 0, -0.06], [-0.035, 0, -0.045], [-0.035, 0, 0.045], [0, 0, 0.06]], 0.0055, 20, 8), mat.brass, -T / 2, -dh / 2 + 0.1, 0));
      }
      hatch.position.set(X1 + 0.035, y0 + h / 2, zc);
      hatch.userData.dynamic = true;
      g.add(hatch);
      // ropes inside the shaft
      for (const sd of [-1, 1]) { const r = mk(ropeGeo(2.0), hemp, X1 + D / 2 + 0.04, y0 + 0.59, zc + sd * (w / 2 - 0.07)); g.add(r); }
      // guide rails: oak battens with iron wear strips up each side of the shaft, the car's runners between them
      for (const sd of [-1, 1]) for (const dx of [0.07, D - 0.07]) {
        g.add(mk(new THREE.BoxGeometry(0.035, 2.6, 0.016), mat.pineDark, X1 + dx, y0 + 0.4, zc + sd * (w / 2 - 0.008)));
        g.add(mk(new THREE.BoxGeometry(0.008, 2.6, 0.018), mat.iron, X1 + dx + 0.02, y0 + 0.4, zc + sd * (w / 2 - 0.008)));
      }
      // the shaft falls away to black: a sooty soffit far above and a dark well below the car
      g.add(mk(new THREE.BoxGeometry(D, 0.02, w), mat.soot, X1 + D / 2, y0 + 1.75, zc));
      // the sill: paint worn through to bare wood where trays have been slid across it
      g.add(mk(rbox(G, 0.035, 0.002, 0.38, 0.001), mat.blockBase, X1 - 0.03, y0 + 0.001, zc));
      // the hand rope: over a cast-iron pulley in a bracket above the casing, down to a cleat beside it
      {
        const py = y0 + h + 0.3, pz = zc + w / 2 + 0.05;
        const wheel = lathe(G, [[0.0, -0.012], [0.07, -0.012], [0.075, -0.014], [0.078, -0.01], [0.06, 0], [0.078, 0.01], [0.075, 0.014], [0.07, 0.012], [0, 0.012]], 40);
        g.add(mk(wheel, mat.iron, X1 - 0.09, py, pz, 0, 0, Math.PI / 2));
        for (let k = 0; k < 5; k++) g.add(mk(new THREE.BoxGeometry(0.006, 0.11, 0.012), mat.iron, X1 - 0.09, py, pz, (k / 5) * Math.PI, 0, 0));
        g.add(mk(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 12), mat.ironEdge, X1 - 0.09, py, pz, 0, 0, Math.PI / 2));
        for (const sd of [-1, 1]) g.add(mk(tube([[X1, py + 0.12, pz + sd * 0.05], [X1 - 0.06, py + 0.06, pz + sd * 0.03], [X1 - 0.09, py, pz + sd * 0.024]], 0.007, 12, 6), mat.iron));
        g.add(mk(rbox(G, 0.012, 0.06, 0.15, 0.003), mat.iron, X1 - 0.006, py + 0.13, pz));
        // rope: from the slot in the wall over the wheel and down the casing's side to a cleat
        g.add(mk(tube([[X1 - 0.01, py + 0.09, pz - 0.02], [X1 - 0.07, py + 0.08, pz], [X1 - 0.15, py + 0.02, pz], [X1 - 0.16, py - 0.1, pz], [X1 - 0.16, y0 + 0.3, pz + 0.01], [X1 - 0.155, y0 + 0.16, pz + 0.02]], 0.0075, 60, 6), hemp));
        g.add(mk(tube([[X1 - 0.01, py + 0.09, pz - 0.02], [X1 - 0.05, py + 0.075, pz - 0.035]], 0.0075, 4, 6), hemp));
        // cleat with the rope's tail wrapped round it
        const cy = y0 + 0.14;
        g.add(mk(rbox(G, 0.025, 0.14, 0.03, 0.008), mat.ironEdge, X1 - 0.03, cy, pz + 0.02));
        for (const sd of [-1, 1]) g.add(mk(new THREE.CylinderGeometry(0.008, 0.011, 0.07, 10), mat.ironEdge, X1 - 0.06, cy + sd * 0.05, pz + 0.02, 0, 0, Math.PI / 2));
        g.add(mk(tube([[X1 - 0.08, cy + 0.06, pz + 0.04], [X1 - 0.085, cy - 0.06, pz], [X1 - 0.08, cy + 0.06, pz], [X1 - 0.085, cy - 0.06, pz + 0.04], [X1 - 0.13, cy - 0.2, pz + 0.07], [X1 - 0.11, cy - 0.32, pz + 0.05]], 0.0075, 50, 6), hemp));
      }
      // brass speaking tube from the dining room, with its whistle cap, on the other side of the casing
      {
        const tz = zc - w / 2 - 0.12;
        g.add(mk(new THREE.CylinderGeometry(0.016, 0.016, H - 1.55, 16), mat.brass, X1 - 0.04, 1.55 + (H - 1.55) / 2, tz));
        for (const yy of [1.85, 2.5, 3.1]) g.add(mk(tube([[X1, yy, tz - 0.025], [X1 - 0.04, yy, tz - 0.022], [X1 - 0.04, yy, tz + 0.022], [X1, yy, tz + 0.025]], 0.004, 10, 6), mat.brass));
        g.add(mk(tube([[X1 - 0.04, 1.6, tz], [X1 - 0.045, 1.5, tz], [X1 - 0.08, 1.45, tz]], 0.016, 16, 12), mat.brass));
        const mouth = lathe(G, [[0.016, 0], [0.019, 0.025], [0.032, 0.06], [0.038, 0.068], [0.033, 0.07], [0.014, 0.04]], 24);
        g.add(mk(mouth, mat.brass, X1 - 0.085, 1.45, tz, 0, 0, Math.PI / 2 + 0.25));
        const cap = new THREE.Group();
        cap.add(mk(new THREE.CylinderGeometry(0.031, 0.031, 0.008, 24), mat.brass, 0, 0, 0));
        cap.add(mk(lathe(G, [[0, 0], [0.009, 0], [0.006, 0.012], [0.004, 0.014], [0, 0.015]], 12), M.basic('bone', { color: 0xd8ceb6 }), 0, 0.004, 0));
        cap.position.set(X1 - 0.142, 1.437, tz + 0.006); cap.rotation.set(0.25, 0, Math.PI / 2 + 0.25);
        g.add(cap);
        g.add(mk(new THREE.TorusGeometry(0.006, 0.0018, 6, 12), mat.brass, X1 - 0.12, 1.47, tz + 0.03));
      }
      // bell pull: a cranked brass lever on a back plate, the wire up to the board, a turned wooden grip on a cord
      {
        const bz = zc + w / 2 + 0.28, by = 1.46;
        g.add(mk(lathe(G, [[0, 0], [0.045, 0], [0.042, 0.008], [0.025, 0.014], [0, 0.016]], 24), mat.brass, X1, by, bz, 0, 0, Math.PI / 2));
        g.add(mk(tube([[X1 - 0.01, by, bz], [X1 - 0.06, by, bz], [X1 - 0.07, by - 0.02, bz]], 0.0045, 10, 6), mat.brass));
        g.add(mk(new THREE.CylinderGeometry(0.0018, 0.0018, 0.42, 4), mat.rope, X1 - 0.072, by - 0.23, bz));
        const grip = lathe(G, [[0, 0], [0.012, 0.004], [0.016, 0.025], [0.014, 0.06], [0.01, 0.075], [0.004, 0.08], [0, 0.082]], 16);
        g.add(mk(grip, mat.mahogany, X1 - 0.072, by - 0.52, bz));
        g.add(mk(new THREE.CylinderGeometry(0.0012, 0.0012, by + 0.6, 4), mat.steel, X1 - 0.006, by + 0.3 + (by - 0.0) * 0 + 0.0, bz));
      }
      // engraved brass plate with a green patina in the letters and four slotted screws
      const plate = forge.canvas('kitchen:liftplate2', 640, 160, (g2, W2, H2) => {
        const gr = g2.createLinearGradient(0, 0, W2, H2);
        gr.addColorStop(0, '#6e5524'); gr.addColorStop(0.3, '#b48d42'); gr.addColorStop(0.55, '#d8b464'); gr.addColorStop(0.8, '#9a7432'); gr.addColorStop(1, '#5e4519');
        g2.fillStyle = gr; g2.fillRect(0, 0, W2, H2);
        // brushed + tarnish clouds
        for (let y = 0; y < H2; y += 2) { g2.fillStyle = `rgba(${y % 6 ? 255 : 0},${y % 6 ? 230 : 0},${y % 6 ? 170 : 0},0.04)`; g2.fillRect(0, y, W2, 1); }
        for (let k = 0; k < 26; k++) { const x = (k * 197) % W2, y = (k * 83) % H2, r = 20 + (k % 5) * 14; const t = g2.createRadialGradient(x, y, 0, x, y, r); t.addColorStop(0, 'rgba(40,30,12,0.35)'); t.addColorStop(1, 'rgba(40,30,12,0)'); g2.fillStyle = t; g2.fillRect(x - r, y - r, 2 * r, 2 * r); }
        // bevelled edge
        g2.strokeStyle = 'rgba(255,235,170,0.5)'; g2.lineWidth = 4; g2.strokeRect(4, 4, W2 - 8, H2 - 8);
        g2.strokeStyle = 'rgba(40,28,8,0.6)'; g2.lineWidth = 2; g2.strokeRect(16, 16, W2 - 32, H2 - 32);
        g2.textAlign = 'center'; g2.textBaseline = 'middle';
        const engrave = (txt, y, font) => {
          g2.font = font;
          g2.fillStyle = 'rgba(255,240,190,0.55)'; g2.fillText(txt, W2 / 2 + 1.5, y + 1.5);
          g2.fillStyle = '#0e0c06'; g2.fillText(txt, W2 / 2, y);
          g2.fillStyle = 'rgba(60,110,80,0.45)'; g2.fillText(txt, W2 / 2 - 0.5, y - 0.5);
        };
        engrave('SERVICE  LIFT', 68, '700 64px Cinzel, Georgia, serif');
        engrave('— TO THE DINING ROOM —', 118, '600 24px Cinzel, Georgia, serif');
        // verdigris creeping from the screw holes and edges
        for (const [x, y] of [[34, 34], [W2 - 34, 34], [34, H2 - 34], [W2 - 34, H2 - 34]]) {
          const v = g2.createRadialGradient(x, y, 4, x, y, 30); v.addColorStop(0, 'rgba(70,130,100,0.55)'); v.addColorStop(1, 'rgba(70,130,100,0)'); g2.fillStyle = v; g2.fillRect(x - 30, y - 30, 60, 60);
        }
      }, { tile: false });
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.085), new THREE.MeshStandardMaterial({ map: plate, metalness: 0.7, roughness: 0.5, name: 'brassPlate' }));
      pm.position.set(X1 - 0.006, y0 + h + 0.13, zc); pm.rotation.y = -Math.PI / 2;
      g.add(pm);
      g.add(mk(rbox(G, 0.004, 0.089, 0.344, 0.0015), mat.brass, X1 - 0.003, y0 + h + 0.13, zc));
      for (const [dz, dy] of [[-0.15, 0.032], [0.15, 0.032], [-0.15, -0.032], [0.15, -0.032]]) {
        g.add(mk(lathe(G, [[0, 0], [0.006, 0], [0.0055, 0.0015], [0.003, 0.0025], [0, 0.0028]], 12), mat.brass, X1 - 0.007, y0 + h + 0.13 + dy, zc + dz, 0, 0, Math.PI / 2));
        g.add(mk(new THREE.BoxGeometry(0.001, 0.0012, 0.01), mat.soot, X1 - 0.0098, y0 + h + 0.13 + dy, zc + dz, 0.5 + dz * 9, 0, 0));
      }
      add(g);
      // warm candle-glow drifting down the shaft from the dining room above
      dumbLight = new THREE.PointLight(0xe0a468, 0, 1.3, 2);
      dumbLight.position.set(X1 + 0.42, y0 + 0.45, zc - 0.05);
      add(dumbLight);
    }
    const setHatch = (t) => {
      hatch.position.y = DUMB.y + DUMB.h / 2 + t * (DUMB.h + 0.08);
      dumbLight.intensity = 0.45 + t * 0.9;
    };
    setHatch(dumb.t);
    async function revealDumbwaiter(animate) {
      if (dumb.open && dumb.t >= 1) return;
      dumb.open = true;
      ctx.state.set('kitchen.dumbwaiterOpen', true);
      if (!animate) { dumb.t = 1; setHatch(1); return; }
      dumb.t0 = dumb.t; dumb.t = 0; dumb.anim = true;
      ctx.audio.sfx('chime', { freq: 1320 });
      await new Promise((r) => setTimeout(r, 400));
      ctx.audio.creak?.();
    }
    ctx.onUpdate((dt) => {
      if (!dumb.anim) return;
      dumb.t = Math.min(1, dumb.t + dt / 2.5);
      const e = dumb.t * dumb.t * (3 - 2 * dumb.t);
      setHatch((dumb.t0 ?? 0) + (1 - (dumb.t0 ?? 0)) * e);
      if (dumb.t >= 1) dumb.anim = false;
    });

    // ================================================================ four-panel doors: framed & fielded, rim lock, finger plate, scuffed kick
    const scuffMat = new THREE.MeshStandardMaterial({ map: scuffTexture(forge, 512).map, transparent: true, depthWrite: false, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, name: 'doorScuff' });
    const kickMat = new THREE.MeshStandardMaterial({ color: 0x9a7a40, metalness: 1, roughness: 0.55, map: scuffTexture(forge, 512).map, name: 'kickPlate' });
    const handWearMat = new THREE.MeshStandardMaterial({
      map: forge.canvas('kitchen:handwear', 256, 384, (g2, w, h) => {
        g2.clearRect(0, 0, w, h);
        let a = 17; const R = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
        for (let k = 0; k < 90; k++) {
          const x = w * (0.5 + (R() - 0.5) * 0.55), y = h * (0.6 + (R() - 0.5) * 0.7), r = 10 + R() * 40;
          const gr = g2.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(25,16,8,${0.05 + R() * 0.12})`); gr.addColorStop(1, 'rgba(25,16,8,0)');
          g2.fillStyle = gr; g2.fillRect(x - r, y - r, 2 * r, 2 * r);
        }
        // paint worn through to wood at the edge where the hand pushes
        for (let k = 0; k < 40; k++) { g2.fillStyle = `rgba(110,80,50,${0.15 + R() * 0.3})`; g2.beginPath(); g2.ellipse(w * (0.75 + R() * 0.2), h * (0.45 + R() * 0.35), 2 + R() * 6, 1 + R() * 3, 0, 0, Math.PI * 2); g2.fill(); }
      }, { tile: false }),
      transparent: true, depthWrite: false, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, name: 'handWear',
    });
    /** Leaf spanning x 0..w, y 0..h, thickness centred on z = 0; face +1 = side that gets the rim lock. */
    function panelDoor(w, h, { lockSide = 1 } = {}) {
      const g = new THREE.Group();
      const T = 0.045, st = 0.11, mull = 0.1, rb = 0.22, rl = 0.19, rt = 0.11;
      const lowH = 0.6, upH = h - rb - lowH - rl - rt, pw = (w - 2 * st - mull) / 2;
      const box = (bw, bh, x, y, d = T) => g.add(mk(rbox(G, bw, bh, d, 0.004), mat.door, x, y, 0));
      box(st, h, st / 2, h / 2); box(st, h, w - st / 2, h / 2);
      box(w - 2 * st, rb, w / 2, rb / 2); box(w - 2 * st, rl, w / 2, rb + lowH + rl / 2); box(w - 2 * st, rt, w / 2, h - rt / 2);
      box(mull, lowH, w / 2, rb + lowH / 2); box(mull, upH, w / 2, rb + lowH + rl + upH / 2);
      for (const [cy, ph] of [[rb + lowH / 2, lowH], [rb + lowH + rl + upH / 2, upH]]) for (const cx of [st + pw / 2, w - st - pw / 2]) {
        g.add(mk(rbox(G, pw + 0.01, ph + 0.01, 0.016, 0.002), mat.door, cx, cy, 0));
        for (const s of [1, -1]) {
          const fp = mk(G.raisedPanel(pw - 0.004, ph - 0.004, { border: 0.018, bevel: 0.045, fieldDepth: 0.009, frameDepth: 0.013 }), mat.door, cx, cy, s * 0.008, 0, s > 0 ? 0 : Math.PI, 0);
          g.add(fp);
        }
      }
      // butt hinges on the hinge edge (x = 0)
      for (const y of [0.25, h / 2, h - 0.25]) g.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 10), mat.brass, -0.004, y, 0));
      // rim lock + brass knob + escutcheon on the lock face; finger plate above
      const fz = lockSide * (T / 2);
      const lx = w - 0.1;
      g.add(mk(rbox(G, 0.17, 0.11, 0.026, 0.004), mat.iron, lx - 0.02, 1.0, fz + lockSide * 0.013));
      g.add(mk(rbox(G, 0.15, 0.09, 0.004, 0.002), mat.ironEdge, lx - 0.02, 1.0, fz + lockSide * 0.027));
      const knob = new THREE.Group();
      knob.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 10), mat.brass, 0, 0, 0.025, Math.PI / 2));
      knob.add(mk(lathe(G, [[0, 0], [0.014, 0], [0.026, 0.012], [0.028, 0.026], [0.02, 0.036], [0, 0.038]], 20), mat.brass, 0, 0, 0.042, Math.PI / 2));
      knob.position.set(lx - 0.06, 1.0, fz + lockSide * 0.026); if (lockSide < 0) knob.rotation.y = Math.PI;
      g.add(knob);
      g.add(mk(rbox(G, 0.022, 0.04, 0.004, 0.002), mat.brass, lx + 0.03, 0.975, fz + lockSide * 0.03));
      g.add(mk(rbox(G, 0.075, 0.3, 0.003, 0.0015), mat.brass, lx - 0.05, 1.32, fz + lockSide * 0.0015));
      // brass kick plate over the bottom rail, dulled and scratched by boots, on both faces
      for (const sd of [1, -1]) {
        const kp = mk(rbox(G, w - 0.06, 0.2, 0.003, 0.0012), kickMat, w / 2, 0.11, sd * (T / 2 + 0.0015));
        g.add(kp);
        for (const x of [0.05, w - 0.05]) for (const y of [0.03, 0.19]) g.add(mk(new THREE.SphereGeometry(0.004, 8, 6), mat.brass, x, y, sd * (T / 2 + 0.003)));
      }
      // hand wear: paint rubbed greasy and dark round the latch and finger plate
      const hw = mk(new THREE.PlaneGeometry(0.34, 0.5), handWearMat, lx - 0.06, 1.12, fz + lockSide * 0.0009, 0, lockSide > 0 ? 0 : Math.PI, 0);
      hw.renderOrder = 2;
      g.add(hw);
      // kick zone: scuffs and boot marks over the bottom rail
      const sc = mk(new THREE.PlaneGeometry(w - 0.03, 0.34), scuffMat, w / 2, 0.17, fz + lockSide * 0.0012, 0, lockSide > 0 ? 0 : Math.PI, 0);
      sc.renderOrder = 2;
      g.add(sc);
      return g;
    }

    // ================================================================ bell board + dining door (right wall)
    {
      const zc = DOORS.dining.z, w = DOORS.dining.w, h = DOORS.dining.h;
      // door leaf (ajar, opens into the passage)
      const leaf = panelDoor(w, h);
      leaf.position.set(X1 + 0.06, 0, zc - w / 2);
      leaf.rotation.y = -Math.PI / 2 + 0.45;
      add(leaf);
      // dark passage beyond
      const passage = new THREE.Mesh(G.planeUV(w + 0.4, h + 0.2, 1), mat.plaster);
      passage.rotation.y = -Math.PI / 2; passage.position.set(X1 + 1.2, h / 2, zc); add(passage);
      for (const s of [-1, 1]) {
        const side = new THREE.Mesh(G.planeUV(1.2, h, 1), mat.plaster);
        side.rotation.y = s > 0 ? Math.PI : 0; side.position.set(X1 + 0.6, h / 2, zc + s * w / 2); add(side);
      }
      const cs = casing(w, h, 0, G.PROFILES.chairRail(0.1, 0.03), mat.hatch, 0.0);
      cs.position.set(X1, 0, zc); cs.rotation.y = -Math.PI / 2;
      add(cs);
      // bell board above
      const bb = new THREE.Group();
      const names = ['DINING', 'LIBRARY', 'MUSIC RM', 'GALLERY', 'FRONT DOOR', 'BEDROOM', 'NURSERY', 'ATTIC'];
      const tabs = forge.canvas('kitchen:belltabs', 1024, 64, (g2, W2, H2) => {
        g2.fillStyle = '#1d1a14'; g2.fillRect(0, 0, W2, H2);
        g2.font = '600 20px Cinzel, Georgia, serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
        names.forEach((n, i) => {
          const x = (i + 0.5) * (W2 / names.length);
          g2.fillStyle = '#e7dcc0'; g2.fillRect(x - 56, 14, 112, 36);
          g2.strokeStyle = '#a07a2c'; g2.lineWidth = 2; g2.strokeRect(x - 56, 14, 112, 36);
          g2.fillStyle = '#2a1a10'; g2.fillText(n, x, 33);
        });
      }, { tile: false });
      bb.add(mk(rbox(G, 1.25, 0.5, 0.04, 0.01), mat.door, 0, 0, 0));
      const tabM = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.072), new THREE.MeshStandardMaterial({ map: tabs, roughness: 0.6 }));
      tabM.position.set(0, -0.17, 0.022); bb.add(tabM);
      bb.add(mk(G.frameGeometry(1.25, 0.5, { width: 0.04, depth: 0.03, uvScale: 1 }), mat.pineDark, 0, 0, 0.01));
      const bellGeo = lathe(G, [[0, 0], [0.032, 0], [0.03, 0.008], [0.022, 0.03], [0.016, 0.05], [0, 0.053]], 20);
      const springGeo = tube(Array.from({ length: 40 }, (_, i) => [Math.cos(i * 0.9) * 0.012, i * 0.0035, Math.sin(i * 0.9) * 0.012]), 0.0016, 120, 4);
      const bells = [];
      names.forEach((n, i) => {
        const x = -0.575 + (i + 0.5) * (1.15 / names.length);
        const bg2 = new THREE.Group();
        bg2.add(mk(springGeo, mat.steel, 0, 0.0, 0, Math.PI / 2, 0, 0));
        const b = mk(bellGeo, mat.brass, 0, -0.02, 0.16, Math.PI, 0, 0);
        bg2.add(b);
        bg2.position.set(x, 0.08, 0.02);
        bg2.userData.dynamic = true;
        bb.add(bg2);
        bells.push(bg2);
      });
      bb.position.set(X1 - 0.025, h + 0.42, zc);
      bb.rotation.y = -Math.PI / 2;
      add(bb);
      // the DINING bell trembles now and then
      ctx.onUpdate((dt, t) => {
        const k = Math.max(0, Math.sin(t * 0.7)) ** 12;
        bells[0].rotation.z = Math.sin(t * 31) * 0.12 * k;
      });
    }

    // ================================================================ foyer door (front wall, behind the start view)
    {
      const x0 = DOORS.foyer.x, w = DOORS.foyer.w, h = DOORS.foyer.h;
      const cs = casing(w, h, 0, G.PROFILES.chairRail(0.11, 0.035), mat.hatch, 0.0);
      cs.position.set(x0, 0, Z1); cs.rotation.y = Math.PI;
      add(cs);
      const passage = new THREE.Mesh(G.planeUV(w + 0.4, h + 0.2, 1), new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 1 }));
      passage.rotation.y = Math.PI; passage.position.set(x0, h / 2, Z1 + 1.4); add(passage);
      for (const s of [-1, 1]) {
        const side = new THREE.Mesh(G.planeUV(1.4, h, 1), mat.plaster);
        side.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; side.position.set(x0 + s * w / 2, h / 2, Z1 + 0.7); add(side);
      }
      const leaf = new THREE.Group();
      const inner = panelDoor(w, h); inner.rotation.y = Math.PI; leaf.add(inner);
      leaf.position.set(x0 + w / 2, 0, Z1 + 0.05);
      leaf.rotation.y = 1.25;
      add(leaf);
      // mop bucket, boots and a coal hod by the door; the broom against the wall
      const mb = buildMopBucket(G, mat); mb.position.set(x0 - 0.75, 0, Z1 - 0.36); mb.rotation.y = 0.6; add(mb);
      const bt = buildBoots(G, mat); bt.position.set(x0 + 0.68, 0, Z1 - 0.22); bt.rotation.y = Math.PI + 0.5; add(bt);
      const hod = buildCoalHod(G, mat); hod.position.set(2.12, 0, Z1 - 0.38); hod.rotation.y = 2.5; add(hod);
      // a besom: birch twigs bound to the handle with three withy lashings
      const broom = new THREE.Group();
      broom.add(mk(new THREE.CylinderGeometry(0.014, 0.016, 1.25, 10), mat.pine, 0, 0.92, 0));
      {
        const R = ctx.random.fork('besom');
        const twig = new THREE.CylinderGeometry(0.0016, 0.0022, 1, 4);
        const list = [];
        for (let k = 0; k < 150; k++) {
          const a = R.next() * Math.PI * 2, rr = Math.sqrt(R.next()) * 0.028;
          const len = 0.36 + R.next() * 0.14;
          const spread = 1.6 + R.next() * 0.8;
          const top = V3(Math.cos(a) * rr, 0.42 + R.next() * 0.06, Math.sin(a) * rr);
          const bot = V3(Math.cos(a) * rr * spread + (R.next() - 0.5) * 0.04, Math.max(0.004, 0.42 - len), Math.sin(a) * rr * spread * 0.8 + (R.next() - 0.5) * 0.03);
          const mid = top.clone().add(bot).multiplyScalar(0.5);
          const dir = bot.clone().sub(top);
          const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize());
          list.push({ geo: twig, m: new THREE.Matrix4().compose(mid, q, V3(1, dir.length(), 1)) });
        }
        broom.add(new THREE.Mesh(mergeInto(list), mat.herbsDry || new THREE.MeshStandardMaterial({ color: 0x5a4630, roughness: 1, name: 'twigs' })));
        for (const y of [0.3, 0.38, 0.45]) broom.add(mk(new THREE.TorusGeometry(0.03 + (0.45 - y) * 0.06, 0.0045, 6, 20), mat.rope, 0, y, 0, Math.PI / 2, 0, 0));
      }
      broom.position.set(x0 - 1.28, 0, Z1 - 0.15); broom.rotation.set(-0.1, 0.3, 0.1);
      add(broom);
      // a hair sweeping broom: turned handle into a stock with tufts of bristle drawn through it (alpha cards)
      {
        const hb = new THREE.Group();
        hb.add(mk(new THREE.CylinderGeometry(0.013, 0.015, 1.3, 10), mat.pine, 0, 0.73, 0));
        hb.add(mk(rbox(G, 0.3, 0.045, 0.06, 0.012), mat.pineDark, 0, 0.065, 0));
        const bristleTex = forge.canvas('kitchen:bristle', 128, 128, (g2, w, h) => {
          g2.clearRect(0, 0, w, h);
          let a = 5; const R = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
          for (let k = 0; k < 260; k++) { const x = R() * w; g2.strokeStyle = `rgba(${40 + R() * 40},${30 + R() * 25},${20 + R() * 15},${0.7 + R() * 0.3})`; g2.lineWidth = 0.8 + R() * 1.2; g2.beginPath(); g2.moveTo(x, 0); g2.lineTo(x + (R() - 0.5) * 10, h * (0.82 + R() * 0.18)); g2.stroke(); }
        }, { tile: false });
        const bm = new THREE.MeshStandardMaterial({ map: bristleTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85, name: 'bristles' });
        for (let k = 0; k < 4; k++) {
          const c = new THREE.PlaneGeometry(0.29, 0.07, 6, 1);
          const pp = c.attributes.position; for (let i = 0; i < pp.count; i++) { if (pp.getY(i) < 0) pp.setZ(i, (k - 1.5) * 0.006); }
          hb.add(mk(c, bm, 0, 0.008, (k - 1.5) * 0.013));
        }
        hb.position.set(-0.98, 0.035, Z1 - 0.43); hb.rotation.set(0.32, -0.25, 0.0);
        hb.traverse((o) => { if (o.isMesh) o.userData.noMerge = true; });
        add(hb);
      }
    }

    // ================================================================ front & service walls: rules board, peg rail, fish kettle, calendar, plinth blocks
    {
      // plinth blocks at the foot of every architrave
      for (const [x, z, ry] of [[DOORS.foyer.x - DOORS.foyer.w / 2 - 0.08, Z1, Math.PI], [DOORS.foyer.x + DOORS.foyer.w / 2 + 0.08, Z1, Math.PI], [X1, DOORS.dining.z - DOORS.dining.w / 2 - 0.08, -Math.PI / 2], [X1, DOORS.dining.z + DOORS.dining.w / 2 + 0.08, -Math.PI / 2]]) {
        const pb = mk(rbox(G, 0.15, 0.24, 0.05, 0.006), mat.hatch, x, 0.12, z, 0, ry, 0);
        pb.translateZ(0.022);
        add(pb);
      }
      // the servants' rules, printed and framed, beside the foyer door
      const rules = forge.canvas('kitchen:rules', 512, 704, (g2, W2, H2) => {
        g2.fillStyle = '#d9cba6'; g2.fillRect(0, 0, W2, H2);
        for (let k = 0; k < 50; k++) { g2.fillStyle = `rgba(130,90,40,${0.04 + (k % 5) * 0.025})`; g2.beginPath(); g2.arc((k * 173) % W2, (k * 97) % H2, 8 + (k % 7) * 9, 0, Math.PI * 2); g2.fill(); }
        g2.strokeStyle = '#2a1a10'; g2.lineWidth = 3; g2.strokeRect(18, 18, W2 - 36, H2 - 36); g2.lineWidth = 1; g2.strokeRect(26, 26, W2 - 52, H2 - 52);
        g2.fillStyle = '#2a1a10'; g2.textAlign = 'center';
        g2.font = '700 34px Cinzel, Georgia, serif'; g2.fillText('RULES', W2 / 2, 80);
        g2.font = 'italic 22px "IM Fell English", Georgia, serif'; g2.fillText('to be observed below stairs', W2 / 2, 112);
        g2.fillRect(120, 128, W2 - 240, 2);
        const lines = ['I. Rise at five. The range is lit by six.', 'II. No servant shall go above stairs', '      after the bell has rung eleven.', 'III. Waste nothing. Bones to the stock,', '      fat to the dripping, the rest to the pot.', 'IV. Guests are not to be spoken to.', 'V. The dumbwaiter is the Master’s.', '      It is not to be ridden.', 'VI. What is sent down is not to be', '      looked at. Only cooked.'];
        g2.textAlign = 'left'; g2.font = '20px "IM Fell English", Georgia, serif';
        lines.forEach((ln, k) => g2.fillText(ln, 52, 172 + k * 42));
        g2.textAlign = 'center'; g2.font = 'italic 20px "IM Fell English", Georgia, serif'; g2.fillText('By Order — H. S.', W2 / 2, H2 - 60);
      }, { tile: false });
      const rb = new THREE.Group();
      rb.add(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.55), new THREE.MeshStandardMaterial({ map: rules, roughness: 0.9, name: 'rulesSheet' })));
      rb.add(mk(G.frameGeometry(0.4, 0.55, { width: 0.035, depth: 0.025, uvScale: 1 }), mat.pineDark));
      for (const sx of [-1, 1]) rb.add(mk(new THREE.CylinderGeometry(0.0018, 0.0018, 0.27, 4), mat.rope, sx * 0.06, 0.38, -0.006, 0, 0, sx * 0.46));
      rb.add(mk(tube([[0, 0.505, -0.018], [0, 0.52, 0.004], [0, 0.495, 0.012], [0, 0.475, 0.0]], 0.0022, 10, 5), mat.brass));
      rb.position.set(-0.45, 1.93, Z1 - 0.015); rb.rotation.set(0.03, Math.PI, 0);
      add(rb);
      // peg rail with the cook's coat, an apron and a market basket
      const pr = new THREE.Group();
      const PX0 = -2.75, PX1 = -0.95, PY = 1.72;
      pr.add(mk(rbox(G, PX1 - PX0, 0.07, 0.022, 0.006), mat.dresserPaint, (PX0 + PX1) / 2, PY, Z1 - 0.011));
      const peg = lathe(G, [[0.0, 0], [0.012, 0], [0.01, 0.03], [0.008, 0.06], [0.014, 0.075], [0.0, 0.08]], 12);
      const pegXs = [-2.6, -2.2, -1.8, -1.4, -1.08];
      for (const x of pegXs) pr.add(mk(peg, mat.pineDark, x, PY, Z1 - 0.02, -Math.PI / 2 - 0.15, 0, 0));
      const wool = new THREE.MeshStandardMaterial({ color: 0x1d1c22, roughness: 0.95, side: THREE.DoubleSide, name: 'coatWool' });
      const linen = new THREE.MeshStandardMaterial({ color: 0xc9c1ad, roughness: 0.9, side: THREE.DoubleSide, name: 'apronLinen' });
      const coat = new THREE.Mesh(G.curtainGeometry({ width: 0.42, height: 0.95, folds: 5, depth: 0.05, gather: 2.5, seed: 21, segX: 40, segY: 30 }), wool);
      fixNaN(coat.geometry, 40);
      coat.position.set(-2.2, PY + 0.03, Z1 - 0.06); coat.rotation.y = Math.PI; pr.add(coat);
      pr.add(mk(new THREE.SphereGeometry(0.06, 14, 10), wool, -2.2, PY + 0.02, Z1 - 0.07)).scale.set(1.8, 0.6, 0.7);
      const apron = new THREE.Mesh(G.curtainGeometry({ width: 0.34, height: 0.72, folds: 4, depth: 0.025, gather: 1.6, seed: 5, segX: 40, segY: 30 }), linen);
      fixNaN(apron.geometry, 40);
      apron.position.set(-1.4, PY + 0.02, Z1 - 0.045); apron.rotation.y = Math.PI; pr.add(apron);
      pr.add(mk(tube([[-1.4, PY + 0.04, Z1 - 0.05], [-1.45, PY - 0.1, Z1 - 0.05], [-1.5, PY - 0.25, Z1 - 0.06]], 0.006, 12, 5), linen));
      pr.add(mk(tube([[-1.4, PY + 0.04, Z1 - 0.05], [-1.36, PY - 0.12, Z1 - 0.055], [-1.33, PY - 0.3, Z1 - 0.06]], 0.006, 12, 5), linen));
      // a stain on the apron's front
      { const st = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), new THREE.MeshStandardMaterial({ color: 0x4a1a12, roughness: 0.9, transparent: true, opacity: 0.55, name: 'apronStain' })); st.position.set(-1.39, PY - 0.42, Z1 - 0.075); st.rotation.y = Math.PI; st.scale.set(1, 1.4, 1); pr.add(st); }
      // market basket on the last peg
      {
        const bk = new THREE.Group();
        bk.add(mk(lathe(G, [[0, 0], [0.13, 0], [0.15, 0.1], [0.155, 0.12], [0.145, 0.12], [0.135, 0.1], [0.12, 0.012], [0, 0.012]], 28), mat.pine, 0, 0, 0));
        bk.add(mk(new THREE.TorusGeometry(0.15, 0.007, 6, 24, Math.PI), mat.pine, 0, 0.12, 0, 0, 0, 0));
        bk.position.set(-1.08, PY - 0.27, Z1 - 0.09); bk.rotation.set(0.2, 0.2, 0);
        pr.add(bk);
      }
      add(pr);
      // copper fish kettle standing on two iron brackets above the foyer door: stadium plan, rolled rim, domed lid
      // with a strap handle, a drop handle at each end
      {
        const fk = new THREE.Group();
        const L2 = 0.58, W2 = 0.2, Hb = 0.15;
        const stadium = (l, w) => { const sh = new THREE.Shape(); const r = w / 2; sh.moveTo(-l / 2 + r, -r); sh.lineTo(l / 2 - r, -r); sh.absarc(l / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false); sh.lineTo(-l / 2 + r, r); sh.absarc(-l / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false); return sh; };
        const body = new THREE.ExtrudeGeometry(stadium(L2, W2), { depth: Hb, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 4, curveSegments: 24 });
        body.rotateX(-Math.PI / 2); G.applyBoxUVs(body, 3);
        fk.add(mk(body, mat.copper, 0, 0.012, 0));
        // rolled rim bead and the lid
        const rimPts = []; { const sh = stadium(L2 + 0.02, W2 + 0.02); rimPts.push(...sh.getSpacedPoints(80).map((p) => V3(p.x, 0, -p.y))); }
        fk.add(mk(tube(rimPts, 0.005, 120, 6, true), mat.copper, 0, Hb + 0.02, 0));
        const lid = new THREE.ExtrudeGeometry(stadium(L2 - 0.01, W2 - 0.01), { depth: 0.012, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.012, bevelSegments: 5, curveSegments: 24 });
        lid.rotateX(-Math.PI / 2); G.applyBoxUVs(lid, 3);
        fk.add(mk(lid, mat.copper, 0, Hb + 0.024, 0));
        fk.add(mk(tube([[-0.16, Hb + 0.06, 0], [-0.13, Hb + 0.1, 0], [0.13, Hb + 0.1, 0], [0.16, Hb + 0.06, 0]], 0.007, 20, 8), mat.brass));
        for (const sx of [-1, 1]) {
          fk.add(mk(new THREE.TorusGeometry(0.035, 0.0065, 8, 18, Math.PI), mat.brass, sx * (L2 / 2 + 0.012), Hb * 0.72, 0, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI / 2));
          for (const z of [-0.035, 0.035]) fk.add(mk(new THREE.SphereGeometry(0.006, 8, 6), mat.copper, sx * (L2 / 2 + 0.008), Hb * 0.72, z));
          // iron brackets under it
          const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.22, 0); sh.quadraticCurveTo(0.05, -0.03, 0, -0.18); sh.lineTo(0, 0);
          add(mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: false }), 1), mat.iron, DOORS.foyer.x + sx * 0.2 - 0.009, DOORS.foyer.h + 0.32, Z1, 0, Math.PI / 2, 0));
        }
        add(mk(rbox(G, 0.66, 0.02, 0.23, 0.004), mat.dresserPaint, DOORS.foyer.x, DOORS.foyer.h + 0.33, Z1 - 0.115));
        fk.position.set(DOORS.foyer.x, DOORS.foyer.h + 0.34, Z1 - 0.12);
        add(fk);
      }
      // a grocer's calendar on a nail by the side table
      {
        const cal = forge.canvas('kitchen:calendar', 384, 576, (g2, W2, H2) => {
          g2.fillStyle = '#e2d6b6'; g2.fillRect(0, 0, W2, H2);
          g2.fillStyle = '#7d1c16'; g2.fillRect(0, 0, W2, 150);
          g2.fillStyle = '#e8d6a8'; g2.textAlign = 'center';
          g2.font = '700 30px Cinzel, Georgia, serif'; g2.fillText('STAUF’S', W2 / 2, 52);
          g2.font = 'italic 22px "IM Fell English", Georgia, serif'; g2.fillText('Superior Soups & Provisions', W2 / 2, 88);
          g2.font = '600 16px Cinzel, Georgia, serif'; g2.fillText('A GIFT TO OUR PATRONS', W2 / 2, 122);
          g2.fillStyle = '#2a1a10'; g2.font = '700 34px Cinzel, Georgia, serif'; g2.fillText('DECEMBER', W2 / 2, 200);
          g2.font = '20px "IM Fell English", Georgia, serif';
          const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
          days.forEach((d, k) => g2.fillText(d, 40 + k * 50, 240));
          for (let d = 1; d <= 31; d++) {
            const k = (d + 4) % 7, r = Math.floor((d + 4) / 7);
            g2.fillStyle = '#2a1a10'; g2.fillText(String(d), 40 + k * 50, 280 + r * 50);
            if (d < 24) { g2.strokeStyle = 'rgba(40,20,10,0.7)'; g2.lineWidth = 2; g2.beginPath(); g2.moveTo(26 + k * 50, 268 + r * 50); g2.lineTo(54 + k * 50, 288 + r * 50); g2.stroke(); }
            if (d === 24) { g2.strokeStyle = '#8a1a14'; g2.lineWidth = 3; g2.beginPath(); g2.arc(40 + k * 50, 274 + r * 50, 18, 0, Math.PI * 2); g2.stroke(); }
          }
          for (let k = 0; k < 30; k++) { g2.fillStyle = `rgba(110,70,30,${0.05 + (k % 4) * 0.03})`; g2.beginPath(); g2.arc((k * 149) % W2, (k * 251) % H2, 6 + (k % 6) * 6, 0, Math.PI * 2); g2.fill(); }
        }, { tile: false });
        const cg = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.33), new THREE.MeshStandardMaterial({ map: cal, roughness: 0.92, side: THREE.DoubleSide, name: 'calendar' }));
        cg.position.set(X1 - 0.008, 1.62, 2.95); cg.rotation.set(0, -Math.PI / 2, 0.02);
        add(cg);
        add(mk(new THREE.CylinderGeometry(0.002, 0.002, 0.02, 6), mat.iron, X1 - 0.01, 1.795, 2.95, 0, 0, Math.PI / 2));
      }
    }

    // ================================================================ ceiling airer (laundry rack) over the range side, hung with linen
    {
      const ag = new THREE.Group();
      const AX = -1.75, AZ = 0.35, AY = 2.62, AL = 1.7;
      const slatZ = [-0.2, -0.07, 0.07, 0.2];
      for (const z of slatZ) ag.add(mk(new THREE.CylinderGeometry(0.014, 0.014, AL, 10), mat.pine, 0, 0, z, 0, 0, Math.PI / 2));
      // cast-iron end brackets: a pierced S-scroll plate with the pulley hook on top
      for (const sx of [-1, 1]) {
        const sh = new THREE.Shape();
        sh.moveTo(-0.24, -0.02); sh.lineTo(0.24, -0.02); sh.lineTo(0.24, 0.02); sh.quadraticCurveTo(0.12, 0.02, 0.05, 0.12); sh.lineTo(0.02, 0.15); sh.lineTo(-0.02, 0.15); sh.lineTo(-0.05, 0.12); sh.quadraticCurveTo(-0.12, 0.02, -0.24, 0.02); sh.closePath();
        for (const hx of [-0.13, 0.13]) { const hole = new THREE.Path(); hole.absellipse(hx, 0.025, 0.035, 0.012, 0, Math.PI * 2, true); sh.holes.push(hole); }
        const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1, curveSegments: 10 });
        ag.add(mk(G.applyBoxUVs(bg, 3), mat.iron, sx * (AL / 2 - 0.15), 0, 0, 0, Math.PI / 2, 0));
        ag.add(mk(new THREE.TorusGeometry(0.018, 0.004, 6, 14), mat.iron, sx * (AL / 2 - 0.15), 0.17, 0));
        // rope up to the ceiling pulley
        const top = H - 0.02 - AY;
        ag.add(mk(new THREE.CylinderGeometry(0.004, 0.004, top - 0.19, 5), mat.rope, sx * (AL / 2 - 0.15), 0.19 + (top - 0.19) / 2, 0));
        ag.add(mk(lathe(G, [[0, -0.01], [0.04, -0.01], [0.042, 0], [0.04, 0.01], [0, 0.01]], 20), mat.iron, sx * (AL / 2 - 0.15), top - 0.06, 0, Math.PI / 2, 0, 0));
        ag.add(mk(rbox(G, 0.012, 0.06, 0.05, 0.003), mat.iron, sx * (AL / 2 - 0.15), top - 0.02, 0));
      }
      // linen drying over the slats: a sheet folded over two slats, tea towels, a pinafore
      // linen: soft sheen, a little light bleeding through where it is thin (faked with a faint emissive from the gas)
      const linenMat = new THREE.MeshPhysicalMaterial({ color: 0xd2cab8, roughness: 0.92, sheen: 0.5, sheenRoughness: 0.7, sheenColor: new THREE.Color(0.9, 0.85, 0.75), emissive: new THREE.Color(0.05, 0.035, 0.02), side: THREE.DoubleSide, name: 'drying' });
      const towelMat = mat.towel;
      const drape = (w, hFront, hBack, x, z, m, seed) => {
        const c = new THREE.Mesh(hungLinen({ width: w, front: hFront, back: hBack, r: 0.016, seed }), m);
        c.position.set(x, 0, z); c.rotation.y = (seed % 2 ? 1 : -1) * 0.03;
        ag.add(c);
      };
      drape(0.9, 0.42, 0.3, -0.25, slatZ[1], linenMat, 3);
      drape(0.36, 0.26, 0.2, 0.5, slatZ[2], towelMat, 8);
      drape(0.32, 0.22, 0.24, -0.55, slatZ[3], towelMat, 11);
      drape(0.4, 0.34, 0.18, 0.35, slatZ[0], linenMat, 15);
      ag.position.set(AX, AY, AZ);
      add(ag);
      // the haul rope runs to a cleat on the left wall
      add(mk(tube([[AX - AL / 2 + 0.15, H - 0.08, AZ], [X0 + 0.15, H - 0.1, AZ], [X0 + 0.03, 1.9, AZ + 0.02]], 0.004, 20, 5), mat.rope));
      add(mk(rbox(G, 0.03, 0.12, 0.025, 0.006), mat.ironEdge, X0 + 0.02, 1.86, AZ + 0.02));
    }
    // ================================================================ drop-dial kitchen clock high on the back wall, over the plate rack
    {
      const ck = new THREE.Group();
      const faceTex = forge.canvas('kitchen:dropdial', 256, 256, (g2, w) => {
        g2.fillStyle = '#e8e0c8'; g2.fillRect(0, 0, w, w);
        g2.translate(w / 2, w / 2);
        g2.strokeStyle = '#1e1810'; g2.lineWidth = 2; g2.beginPath(); g2.arc(0, 0, 120, 0, Math.PI * 2); g2.stroke();
        for (let k = 0; k < 60; k++) { const a = (k / 60) * Math.PI * 2; g2.lineWidth = k % 5 ? 1 : 3; g2.beginPath(); g2.moveTo(Math.cos(a) * 112, Math.sin(a) * 112); g2.lineTo(Math.cos(a) * (k % 5 ? 106 : 100), Math.sin(a) * (k % 5 ? 106 : 100)); g2.stroke(); }
        g2.fillStyle = '#1e1810'; g2.font = '600 24px Cinzel, Georgia, serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
        ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((t, k) => { const a = (k / 12) * Math.PI * 2 - Math.PI / 2; g2.fillText(t, Math.cos(a) * 82, Math.sin(a) * 82); });
        g2.font = 'italic 14px "IM Fell English", Georgia, serif'; g2.fillText('Stauf · London', 0, 40);
        const hand = (a, l, wd) => { g2.save(); g2.rotate(a); g2.lineWidth = wd; g2.beginPath(); g2.moveTo(0, 14); g2.lineTo(0, -l); g2.stroke(); g2.restore(); };
        hand((11.92 / 12) * Math.PI * 2, 56, 6); hand((55 / 60) * Math.PI * 2, 88, 3.5);
      }, { tile: false });
      ck.add(mk(lathe(G, [[0, 0], [0.19, 0], [0.2, 0.02], [0.19, 0.05], [0.16, 0.06], [0, 0.06]], 40), mat.mahogany, 0, 0, 0, Math.PI / 2, 0, 0));
      ck.add(mk(new THREE.TorusGeometry(0.155, 0.01, 8, 40), mat.brass, 0, 0, 0.062));
      const fm = new THREE.Mesh(new THREE.CircleGeometry(0.15, 40), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.45, name: 'dropDial' }));
      fm.position.z = 0.061; ck.add(fm);
      const drop = new THREE.Shape(); drop.moveTo(-0.11, 0); drop.lineTo(0.11, 0); drop.quadraticCurveTo(0.11, -0.2, 0, -0.26); drop.quadraticCurveTo(-0.11, -0.2, -0.11, 0);
      ck.add(mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(drop, { depth: 0.05, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 }), 1), mat.mahogany, 0, -0.13, 0.0));
      ck.add(mk(new THREE.CircleGeometry(0.03, 20), new THREE.MeshPhysicalMaterial({ color: 0x1a1410, roughness: 0.05, clearcoat: 1, name: 'pendWindow' }), 0, -0.3, 0.06));
      ck.position.set(0.42, 2.74, Z0 + 0.0);
      add(ck);
    }

    // ================================================================ right wall shelf: canisters, moulds, jugs
    {
      const z0 = -3.55, z1 = -1.75, y = 1.95, d = 0.26;
      const sg = new THREE.Group();
      sg.add(mk(rbox(G, d, 0.03, z1 - z0, 0.006), mat.dresserPaint, X1 - d / 2, y - 0.015, (z0 + z1) / 2));
      sg.add(mk(rbox(G, 0.02, 0.05, z1 - z0, 0.006), mat.dresserPaint, X1 - d + 0.01, y - 0.01, (z0 + z1) / 2));
      for (const z of [z0 + 0.12, (z0 + z1) / 2, z1 - 0.12]) {
        const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.22, 0); sh.quadraticCurveTo(0.05, -0.04, 0, -0.2); sh.lineTo(0, 0);
        sg.add(mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: false }), 1), mat.dresserPaint, X1, y - 0.03, z - 0.0125, 0, Math.PI, 0));
      }
      // japanned canisters with gilt names
      const words = ['TEA', 'SUGAR', 'FLOUR', 'RICE', 'SAGO'];
      const atlas = forge.canvas('kitchen:canisters', 1024, 640, (g2, W2, H2) => {
        const cols = ['#5a0f0c', '#14201a', '#5a0f0c', '#14201a', '#1a1a2a'];
        words.forEach((wd, i) => {
          const y0 = i * 128;
          g2.fillStyle = cols[i]; g2.fillRect(0, y0, W2, 128);
          g2.strokeStyle = '#c9a050'; g2.lineWidth = 3; g2.strokeRect(6, y0 + 10, W2 - 12, 108);
          g2.lineWidth = 1; g2.strokeRect(14, y0 + 18, W2 - 28, 92);
          g2.fillStyle = '#d8b25e'; g2.font = '600 54px Cinzel, Georgia, serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
          g2.fillText(wd, W2 / 2, y0 + 66);
          for (const x of [W2 / 2 - 190, W2 / 2 + 190]) { g2.beginPath(); g2.arc(x, y0 + 64, 14, 0, Math.PI * 2); g2.stroke(); }
        });
      }, { tile: false });
      atlas.flipY = true;
      const canMat = new THREE.MeshPhysicalMaterial({ map: atlas, roughness: 0.35, metalness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.2, name: 'canister' });
      words.forEach((wd, i) => {
        const r = 0.07 - (i % 3) * 0.008, h = 0.2 - i * 0.015;
        const geo = new THREE.CylinderGeometry(r, r, h, 32, 1, true);
        geo.rotateY(Math.PI);
        const uv = geo.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k), 1 - (i + 1) / 5 + uv.getY(k) / 5);
        const zc = z0 + 0.14 + i * 0.17;
        const c = mk(geo, canMat, X1 - 0.12, y + h / 2, zc, 0, -Math.PI / 2, 0);
        sg.add(c);
        sg.add(mk(new THREE.CylinderGeometry(r + 0.003, r + 0.003, 0.02, 32), mat.iron, X1 - 0.12, y + h + 0.01, zc));
        sg.add(mk(new THREE.SphereGeometry(0.012, 10, 8), mat.brass, X1 - 0.12, y + h + 0.026, zc));
      });
      // copper jelly moulds and a pewter charger standing at the end
      sg.add(mk(lathe(G, [[0, 0], [0.08, 0], [0.09, 0.03], [0.07, 0.06], [0.085, 0.09], [0.05, 0.13], [0.03, 0.15], [0.0, 0.155]], 28), mat.copper, X1 - 0.13, y, z1 - 0.12));
      const charger = mk(lathe(G, [[0, 0], [0.1, 0], [0.12, 0.01], [0.17, 0.02], [0.168, 0.026], [0.115, 0.016], [0, 0.012]], 40), M.basic('silver', { color: 0x8a8a8c, roughness: 0.45 }), X1 - 0.05, y + 0.17, z0 + 0.98, 0, 0, Math.PI / 2 - 0.15);
      sg.add(charger);
      add(sg);
    }

    // ================================================================ front wall: meat safe + utensil rail
    {
      // glazed china cupboard (faces -z): fielded lower doors, glazed upper doors with bars, china behind the glass
      const zinc = forge.canvas('kitchen:zinc', 256, 256, (g2, w) => {
        g2.fillStyle = '#6f7476'; g2.fillRect(0, 0, w, w);
        g2.fillStyle = '#0b0c0d';
        for (let y = 4; y < w; y += 8) for (let x = 4 + ((y / 8) % 2) * 4; x < w; x += 8) { g2.beginPath(); g2.arc(x, y, 2.2, 0, Math.PI * 2); g2.fill(); }
      });
      zinc.repeat.set(2, 3);
      const zincMat = new THREE.MeshStandardMaterial({ map: zinc, metalness: 0.7, roughness: 0.55, name: 'zinc' });
      const ms = new THREE.Group();
      const W2 = 0.8, H2 = 2.0, D2 = 0.42, P = mat.cupboardPaint;
      const LOW = 0.92;
      ms.add(mk(rbox(G, 0.025, H2, D2, 0.004), P, -W2 / 2 + 0.0125, H2 / 2, D2 / 2));
      ms.add(mk(rbox(G, 0.025, H2, D2, 0.004), P, W2 / 2 - 0.0125, H2 / 2, D2 / 2));
      ms.add(mk(rbox(G, W2, LOW, D2 - 0.02, 0.004), P, 0, LOW / 2, D2 / 2 - 0.01));
      ms.add(mk(G.planeUV(W2 - 0.05, H2 - LOW, 1), mat.boarding, 0, LOW + (H2 - LOW) / 2, 0.012));
      ms.add(mk(rbox(G, W2 + 0.04, 0.03, D2 + 0.04, 0.006), mat.counter, 0, LOW + 0.015, D2 / 2 + 0.01));      // ledge
      ms.add(mk(rbox(G, W2, 0.03, D2, 0.004), P, 0, H2 - 0.015, D2 / 2));
      for (const [y, hh] of [[0.47, 0.72]]) for (const sx of [-1, 1]) {
        ms.add(mk(G.raisedPanel(W2 / 2 - 0.05, hh, { border: 0.06, bevel: 0.02, fieldDepth: 0.006 }), P, sx * (W2 / 4 - 0.005), y, D2 - 0.01));
        ms.add(mk(lathe(G, [[0, 0], [0.012, 0], [0.016, 0.012], [0.008, 0.024], [0, 0.03]], 12), mat.brass, sx * 0.05, y + 0.1, D2 + 0.01, Math.PI / 2));
      }
      // inside the glazed section: two shelves of china
      const shelvesY = [LOW + 0.36, LOW + 0.7];
      for (const y of shelvesY) ms.add(mk(rbox(G, W2 - 0.05, 0.018, D2 - 0.06, 0.003), P, 0, y, D2 / 2 - 0.02));
      const china = M.basic('porcelain', { color: 0xe8e2d4 });
      const blueChina = new THREE.MeshPhysicalMaterial({ color: 0x2a3f7a, roughness: 0.2, clearcoat: 1, name: 'blueChina' });
      const plateG = lathe(G, [[0, 0], [0.07, 0], [0.075, 0.004], [0.1, 0.008], [0.11, 0.016], [0.108, 0.019], [0.09, 0.012], [0.07, 0.006], [0, 0.006]], 32);
      for (let i = 0; i < 5; i++) ms.add(mk(plateG, i % 2 ? blueChina : china, -0.27 + i * 0.03, LOW + 0.03 + 0.11, 0.07, Math.PI / 2 - 0.2, 0, 0));
      ms.add(mk(lathe(G, [[0, 0], [0.06, 0], [0.09, 0.03], [0.11, 0.08], [0.1, 0.12], [0.104, 0.125], [0.0, 0.125]], 32), china, 0.12, LOW + 0.03, 0.2));          // tureen
      ms.add(mk(lathe(G, [[0, 0], [0.1, 0], [0.098, 0.006], [0.06, 0.04], [0.02, 0.05], [0.025, 0.07], [0, 0.075]], 32), blueChina, 0.12, LOW + 0.155, 0.2));      // tureen lid
      for (const s of [-1, 1]) ms.add(mk(new THREE.TorusGeometry(0.02, 0.006, 6, 12, Math.PI), china, 0.12 + s * 0.112, LOW + 0.1, 0.2, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0));
      for (let i = 0; i < 4; i++) ms.add(mk(lathe(G, [[0, 0], [0.04, 0], [0.075, 0.04], [0.08, 0.05], [0.072, 0.05], [0.036, 0.008], [0, 0.008]], 28), i % 2 ? china : blueChina, -0.2, shelvesY[0] + 0.01 + i * 0.025, 0.2));
      for (let i = 0; i < 3; i++) ms.add(mk(lathe(G, [[0, 0], [0.045, 0], [0.055, 0.05], [0.05, 0.1], [0.04, 0.13], [0.045, 0.15], [0, 0.14]], 24), i === 1 ? blueChina : china, 0.0 + i * 0.12, shelvesY[0] + 0.01, 0.2));
      for (let i = 0; i < 6; i++) ms.add(mk(plateG, i % 3 === 0 ? blueChina : china, -0.3 + i * 0.12, shelvesY[1] + 0.12, 0.06, Math.PI / 2 - 0.15, 0, 0));
      // glazed doors: frame, two glazing bars, slightly green bevelled glass
      const glassM = new THREE.MeshPhysicalMaterial({ color: 0xd8e6dc, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4, name: 'cupboardGlass' });
      const gh = H2 - LOW - 0.06, gw = W2 / 2 - 0.02;
      for (const sx of [-1, 1]) {
        const dg = new THREE.Group();
        const fr = (w, h, x, y) => dg.add(mk(rbox(G, w, h, 0.03, 0.004), P, x, y, 0));
        fr(0.05, gh, -gw / 2 + 0.025, 0); fr(0.05, gh, gw / 2 - 0.025, 0); fr(gw, 0.06, 0, gh / 2 - 0.03); fr(gw, 0.07, 0, -gh / 2 + 0.035);
        for (const y of [-gh / 6, gh / 6]) dg.add(mk(rbox(G, gw - 0.1, 0.018, 0.022, 0.003), P, 0, y, 0));
        for (const y of [-gh / 3 + 0.01, 0, gh / 3 - 0.01]) {
          const pane = new THREE.Mesh(new THREE.PlaneGeometry(gw - 0.1, gh / 3 - 0.05), glassM);
          pane.position.set(0, y, 0.004); pane.userData.noShadow = true; dg.add(pane);
          // bevel: a thin bright chamfer frame inside each pane
          dg.add(mk(G.frameGeometry(gw - 0.1, gh / 3 - 0.05, { width: 0.012, depth: 0.004, uvScale: 1 }), glassM, 0, y, 0.006));
        }
        dg.add(mk(lathe(G, [[0, 0], [0.01, 0], [0.013, 0.01], [0.007, 0.02], [0, 0.025]], 12), mat.brass, -sx * (gw / 2 - 0.03), 0, 0.015, Math.PI / 2));
        dg.position.set(sx * (W2 / 4 - 0.002), LOW + 0.03 + gh / 2 + 0.01, D2 - 0.005);
        ms.add(dg);
      }
      // cornice
      const cprof = [V2(0, 0), V2(0.015, 0), V2(0.015, 0.02), V2(0.04, 0.035), V2(0.06, 0.06), V2(0.06, 0.08), V2(0, 0.08)];
      ms.add(mk(G.sweepProfile(cprof, [V3(-W2 / 2, H2, 0), V3(-W2 / 2, H2, D2), V3(W2 / 2, H2, D2), V3(W2 / 2, H2, 0)], { uvScale: 1 }), P));
      // jelly moulds + a copper fish kettle on top
      ms.add(mk(lathe(G, [[0, 0], [0.07, 0], [0.09, 0.03], [0.08, 0.06], [0.09, 0.09], [0.06, 0.12], [0.0, 0.13]], 24), mat.copper, -0.17, H2 + 0.08, 0.2));
      ms.add(mk(rbox(G, 0.42, 0.14, 0.16, 0.05, 3), mat.copper, 0.12, H2 + 0.15, 0.22));
      ms.position.set(1.75, 0, Z1); ms.rotation.y = Math.PI;
      add(ms);
      // a paraffin lamp on the side table: the warm practical for this end of the room
      {
        const lamp = buildOilLamp(ctx, mat);
        lamp.group.position.set(2.98, 0.82, Z1 - 0.3);
        add(lamp.group);
        // the focal warm pool at this end of the room: shadowed, so the table, cupboard and door throw shapes
        const ll = new THREE.PointLight(0xffa456, 1.4, 3.2, 2);
        ll.position.set(2.98, 0.82 + lamp.flameY + 0.05, Z1 - 0.36);
        add(ll);
        // one shadowed spot from the flame out into the room (cheaper than a cube shadow): table, cupboard and door cast shapes
        const ls = new THREE.SpotLight(0xffa456, 3.2, 4.2, 1.15, 0.8, 2);
        ls.position.copy(ll.position); ls.target.position.set(1.4, 0.2, Z1 - 1.6);
        ls.castShadow = Q.shadows; ls.shadow.mapSize.set(1024, 1024); ls.shadow.bias = -0.0008; ls.shadow.normalBias = 0.03; ls.shadow.radius = 3; ls.shadow.camera.near = 0.12; ls.shadow.camera.far = 5;
        add(ls); add(ls.target);
        lamp.group.traverse((o) => { if (o.isMesh) o.userData.noShadow = true; });
        ctx.onUpdate((dt, t) => { const f = 0.95 + 0.05 * Math.sin(t * 4.3 + 1) * Math.sin(t * 2.1); ll.intensity = 1.4 * f; ls.intensity = 3.2 * f; });
      }
      // utensil rail with hanging tools
      const rx0 = 2.35, rx1 = 3.05, ry = 1.78, rz = Z1 - 0.05;
      add(mk(new THREE.CylinderGeometry(0.01, 0.01, rx1 - rx0 + 0.1, 12), mat.brass, (rx0 + rx1) / 2, ry, rz, 0, 0, Math.PI / 2));
      for (const x of [rx0 - 0.03, rx1 + 0.03]) add(mk(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 8), mat.brass, x, ry, Z1 - 0.025, Math.PI / 2));
      const tools = [
        () => { const t = new THREE.Group(); t.add(mk(new THREE.CylinderGeometry(0.005, 0.005, 0.34, 8), mat.steel, 0, -0.19, 0)); t.add(mk(new THREE.SphereGeometry(0.05, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat.copper, 0, -0.38, 0)); return t; },
        () => { const t = new THREE.Group(); t.add(mk(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 8), mat.steel, 0, -0.17, 0)); t.add(mk(new THREE.CylinderGeometry(0.06, 0.06, 0.004, 24), zincMat, 0, -0.36, 0, Math.PI / 2 - 0.15)); return t; },
        () => { const t = new THREE.Group(); t.add(mk(new THREE.CylinderGeometry(0.006, 0.006, 0.28, 8), mat.pineDark, 0, -0.16, 0)); for (let k = 0; k < 6; k++) t.add(mk(new THREE.TorusGeometry(0.03, 0.0015, 4, 16, Math.PI), mat.steel, 0, -0.33, 0, 0, (k / 6) * Math.PI, Math.PI)); return t; },
        () => { const t = new THREE.Group(); t.add(mk(new THREE.CylinderGeometry(0.005, 0.005, 0.32, 8), mat.steel, 0, -0.18, 0)); for (const dx of [-0.012, 0, 0.012]) t.add(mk(new THREE.CylinderGeometry(0.0025, 0.002, 0.09, 6), mat.steel, dx, -0.38, 0)); return t; },
        () => { const t = new THREE.Group(); t.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), mat.pineDark, 0, -0.1, 0)); t.add(mk(lathe(G, [[0, 0], [0.07, 0.0], [0.08, 0.05], [0.0, 0.06]], 24), zincMat, 0, -0.27, 0, Math.PI / 2)); return t; },
      ];
      tools.forEach((f, i) => { const t = f(); t.position.set(rx0 + 0.06 + i * ((rx1 - rx0 - 0.12) / (tools.length - 1)), ry - 0.01, rz); t.rotation.z = (i % 2 ? 0.04 : -0.03); add(t); add(mk(new THREE.TorusGeometry(0.012, 0.0025, 6, 12), mat.steel, t.position.x, ry - 0.005, rz, 0, Math.PI / 2, 0)); });
      // a small side table under the rail with a stack of spare tins and a flour bin
      add(mk(rbox(G, 0.8, 0.04, 0.45, 0.006), mat.pine, 2.7, 0.8, Z1 - 0.25));
      for (const [x, z] of [[2.34, Z1 - 0.06], [3.06, Z1 - 0.06], [2.34, Z1 - 0.44], [3.06, Z1 - 0.44]]) add(mk(rbox(G, 0.05, 0.78, 0.05, 0.006), mat.pineDark, x, 0.39, z));
      add(mk(lathe(G, [[0, 0], [0.16, 0], [0.16, 0.36], [0.17, 0.37], [0.15, 0.4], [0, 0.42]], 32), mat.tinPlate, 2.55, 0.82, Z1 - 0.24));
    }

    // ================================================================ set dressing: right-hand half of the room
    {
      // pastry cupboard under the canister shelf (faces -x): marble slab, bread crock, a sugar loaf in its blue paper
      const cg = new THREE.Group();
      const CL = 1.25, CD = 0.52, CHh = 0.86;
      cg.add(mk(rbox(G, CL, CHh - 0.1, CD - 0.03, 0.005), mat.cupboardPaint, 0, 0.1 + (CHh - 0.1) / 2, CD / 2 - 0.015));
      cg.add(mk(rbox(G, CL - 0.04, 0.1, CD - 0.08, 0.004), mat.soot, 0, 0.05, CD / 2 - 0.04));
      for (const sx of [-1, 1]) {
        cg.add(mk(G.raisedPanel(CL / 2 - 0.06, 0.56, { border: 0.06, bevel: 0.02, fieldDepth: 0.006 }), mat.cupboardPaint, sx * (CL / 4 - 0.005), 0.44, CD - 0.01));
        cg.add(mk(new THREE.SphereGeometry(0.016, 14, 10), mat.brass, sx * 0.07, 0.5, CD + 0.012));
      }
      for (let i = 0; i < 2; i++) cg.add(mk(G.raisedPanel(CL / 2 - 0.06, 0.12, { border: 0.025, bevel: 0.01, fieldDepth: 0.004 }), mat.cupboardPaint, (i ? 1 : -1) * (CL / 4 - 0.005), CHh - 0.1, CD - 0.01));
      const marble = M.create('marble', { type: 'carrara', polish: 0.6, repeat: [1, 1] });
      cg.add(mk(rbox(G, CL + 0.04, 0.04, CD + 0.03, 0.008), marble, 0, CHh + 0.02, CD / 2));
      const T0 = CHh + 0.04;
      cg.add(mk(crock(G, 0.32, 0.15, 0.82), mat.stonewareBrown, -0.32, T0, 0.24));
      cg.add(mk(lathe(G, [[0, 0], [0.13, 0], [0.13, 0.015], [0.08, 0.04], [0.025, 0.05], [0.03, 0.075], [0, 0.08]], 32), mat.stonewareBrown, -0.32, T0 + 0.315, 0.24));
      // sugar loaf: white cone, the bottom half still in blue paper
      cg.add(mk(new THREE.ConeGeometry(0.075, 0.3, 24), new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.85, name: 'sugarLoaf' }), 0.05, T0 + 0.15, 0.22));
      cg.add(mk(new THREE.CylinderGeometry(0.052, 0.079, 0.13, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x1d3270, roughness: 0.9, side: THREE.DoubleSide, name: 'sugarPaper' }), 0.05, T0 + 0.065, 0.22));
      cg.add(mk(rbox(G, 0.32, 0.018, 0.22, 0.004), mat.counter, 0.36, T0 + 0.009, 0.25, 0, 0.15, 0));
      cg.add(mk(new THREE.CylinderGeometry(0.035, 0.035, 0.36, 20), mat.maple, 0.36, T0 + 0.054, 0.26, 0, 0.15 + Math.PI / 2, Math.PI / 2));
      cg.position.set(X1, 0, -2.95); cg.rotation.y = -Math.PI / 2;
      add(cg);
      // sacks: two stood against the cupboard, one lying across their feet; a split sack spilling flour by the pantry
      const standSack = (seed, o, x, z, yaw) => {
        const geo = sackGeometry(seed, o);
        const m = add(mk(geo, mat.sack, x, 0, z, 0, yaw, 0));
        const tie = sackTie(mat.rope, geo.userData.neckR + 0.004, seed);
        const l = new THREE.Vector3(geo.userData.lean[0], geo.userData.neckY, geo.userData.lean[1]).applyEuler(new THREE.Euler(0, yaw, 0));
        tie.position.set(x + l.x, l.y, z + l.z); tie.rotation.y = yaw + seed;
        add(tie);
        contactShadow(x, z, o.r * 1.5, o.r * 1.35, 0.85, yaw);
        return m;
      };
      standSack(1, { r: 0.21, h: 0.66, slump: 0.35 }, X1 - 0.72, -2.27, -0.35);
      standSack(2, { r: 0.19, h: 0.58, slump: 0.55 }, X1 - 0.33, -1.9, -1.0);
      lyingSack(3, { r: 0.2, h: 0.62, slump: 0.5, flour: 0.8 }, X1 - 0.98, -1.62, 2.0);
      // the split sack by the pantry: lying on its side, mouth toward the block, a heap of flour pouring out
      lyingSack(4, { r: 0.19, h: 0.58, slump: 0.7, flour: 1.0, neck: 0.06 }, -1.3, -1.72, -0.65 + Math.PI);
      // the heap poured from its mouth, slumped toward the block
      add(mk(flourMound({ R: 0.3, h: 0.026, seed: 3, stretch: 1.6 }), mat.flour, -1.08, 0.001, -1.6, 0, -0.75, 0));
      // a brace of pheasants and bunches of herbs hung from the beam over the sacks
      const bz = BEAMS[1], by = H - BEAM_H - 0.01;
      for (const [x, sd] of [[2.45, 0], [2.6, 1]]) {
        const ph = buildPheasant(G, mat, sd);
        ph.position.set(x, by - 0.04, bz + (sd ? 0.04 : -0.03));
        add(ph);
        add(mk(new THREE.TorusGeometry(0.02, 0.004, 6, 12, Math.PI * 1.4), mat.iron, x, by - 0.02, bz, 0, 0, Math.PI * 0.7));
      }
      for (const [x, n] of [[1.45, 0], [1.75, 1], [2.05, 2]]) {
        const herb = new THREE.Group();
        const herbMat = n === 1 ? new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 1, name: 'herbsDry' }) : mat.herbs;
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          herb.add(mk(new THREE.CylinderGeometry(0.002, 0.003, 0.3, 4), herbMat, Math.cos(a) * 0.015, -0.15, Math.sin(a) * 0.015, Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2));
          herb.add(mk(new THREE.SphereGeometry(0.02, 6, 4), herbMat, Math.cos(a) * 0.055, -0.28 + (k % 3) * 0.035, Math.sin(a) * 0.055)).scale.set(1, 2.6, 1);
        }
        herb.add(mk(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 10), mat.rope, 0, -0.03, 0));
        herb.add(mk(new THREE.CylinderGeometry(0.002, 0.002, 0.08, 4), mat.rope, 0, 0.02, 0));
        herb.position.set(x, by - 0.06, bz + (n % 2 ? 0.03 : -0.03));
        herb.rotation.y = n;
        add(herb);
      }
      // copper helmet scuttle in the corner by the breast
      const scut = new THREE.Group();
      scut.add(mk(lathe(G, [[0, 0], [0.15, 0], [0.16, 0.02], [0.19, 0.18], [0.18, 0.3], [0.17, 0.31], [0.165, 0.29], [0.0, 0.29]], 36), mat.copper));
      scut.add(mk(lathe(G, [[0, 0], [0.16, 0], [0.165, 0.02], [0.15, 0.03], [0, 0.03]], 32), mat.brass, 0, -0.0, 0));
      scut.add(mk(tube([[-0.16, 0.28, 0], [-0.12, 0.42, 0], [0.12, 0.42, 0], [0.16, 0.28, 0]], 0.008, 24, 8), mat.brass));
      const lumpG = new THREE.IcosahedronGeometry(0.035, 0);
      const lumps = [];
      for (let i = 0; i < 22; i++) { const a = i * 2.39996, rr = Math.sqrt(i / 22) * 0.14; lumps.push({ geo: lumpG, m: new THREE.Matrix4().compose(V3(Math.cos(a) * rr, 0.28 + (0.14 - rr) * 0.4, Math.sin(a) * rr), new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 0.7, i * 1.3)), V3(1, 0.8, 1)) }); }
      scut.add(mk(mergeInto(lumps), mat.coal));
      scut.position.set(-2.72, 0, Z0 + 0.35);
      add(scut);
    }

    // ================================================================ cook's slate & salt box (back wall, left of the breast)
    {
      const slate = forge.canvas('kitchen:slate', 512, 640, (g2, w, h) => {
        g2.fillStyle = '#1e2224'; g2.fillRect(0, 0, w, h);
        for (let i = 0; i < 60; i++) { g2.fillStyle = `rgba(200,200,190,${0.02 + (i % 7) * 0.006})`; g2.beginPath(); g2.ellipse((i * 137) % w, (i * 251) % h, 40 + (i % 5) * 18, 12, (i % 3) * 0.4, 0, Math.PI * 2); g2.fill(); }
        g2.fillStyle = 'rgba(225,222,210,0.85)'; g2.textAlign = 'center';
        g2.font = 'italic 46px "IM Fell English", Georgia, serif'; g2.fillText('Bill of Fare', w / 2, 80);
        g2.fillRect(120, 98, w - 240, 2);
        g2.font = 'italic 34px "IM Fell English", Georgia, serif';
        ['Mock Turtle', 'Jugged Hare', 'Calf’s Head', 'Brown Windsor', '— & the Guest —'].forEach((t, i) => g2.fillText(t, w / 2 + (i % 2 ? 6 : -4), 170 + i * 70));
        g2.font = 'italic 26px "IM Fell English", Georgia, serif'; g2.fillText('serve at midnight', w / 2, 560);
      }, { tile: false });
      const sg = new THREE.Group();
      sg.add(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), new THREE.MeshStandardMaterial({ map: slate, roughness: 0.8, name: 'slate' })));
      sg.add(mk(G.frameGeometry(0.4, 0.5, { width: 0.035, depth: 0.02, uvScale: 1 }), mat.pineDark));
      // hung by a cord from a brass hook on the picture rail
      sg.add(mk(new THREE.CylinderGeometry(0.0018, 0.0018, 0.33, 4), mat.rope, -0.07, 0.405, -0.004, 0, 0, -0.4));
      sg.add(mk(new THREE.CylinderGeometry(0.0018, 0.0018, 0.33, 4), mat.rope, 0.07, 0.405, -0.004, 0, 0, 0.4));
      sg.add(mk(tube([[0, 0.585, -0.016], [0, 0.6, 0.004], [0, 0.575, 0.012], [0, 0.555, 0.0]], 0.0022, 10, 5), mat.brass));
      sg.position.set(-2.78, 1.85, Z0 + 0.02); sg.rotation.x = -0.04;
      add(sg);
      // wooden salt box with a sloping lid
      const sb = new THREE.Group();
      sb.add(mk(rbox(G, 0.2, 0.24, 0.16, 0.006), mat.pineDark, 0, 0, 0.08));
      sb.add(mk(rbox(G, 0.21, 0.015, 0.19, 0.004), mat.pineDark, 0, 0.13, 0.09, 0.3, 0, 0));
      sb.add(mk(rbox(G, 0.08, 0.06, 0.012, 0.004), mat.pineDark, 0, 0.17, 0.006));
      sb.position.set(-2.78, 1.3, Z0);
      add(sb);
    }

    // ================================================================ high plate shelf along the right wall: platters, jugs, moulds
    {
      const z0 = -3.6, z1 = 1.3, y = 2.74, d = 0.2;
      const sg = new THREE.Group();
      sg.add(mk(rbox(G, d, 0.03, z1 - z0, 0.006), mat.dresserPaint, X1 - d / 2, y - 0.015, (z0 + z1) / 2));
      sg.add(mk(rbox(G, 0.02, 0.06, z1 - z0, 0.006), mat.dresserPaint, X1 - d + 0.012, y + 0.015, (z0 + z1) / 2));   // plate groove lip
      for (let z = z0 + 0.15; z < z1; z += 0.8) {
        const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.17, 0); sh.quadraticCurveTo(0.04, -0.03, 0, -0.16); sh.lineTo(0, 0);
        sg.add(mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: false }), 1), mat.dresserPaint, X1, y - 0.03, z - 0.011, 0, Math.PI, 0));
      }
      const china = M.basic('porcelain', { color: 0xe4ddcc });
      const blue = new THREE.MeshPhysicalMaterial({ color: 0x24386e, roughness: 0.2, clearcoat: 1, name: 'blueChina2' });
      const platter = lathe(G, [[0, 0], [0.09, 0], [0.1, 0.005], [0.15, 0.012], [0.17, 0.022], [0.166, 0.026], [0.14, 0.016], [0.1, 0.008], [0, 0.008]], 36);
      const R = ctx.random.fork('plateshelf');
      let z = z0 + 0.2, k = 0;
      while (z < z1 - 0.2) {
        if (z > DUMB.z - 0.45 && z < DUMB.z + 0.45 && k % 2) { z += 0.1; }
        const kind = k % 5;
        if (kind === 0 || kind === 3) {
          const sc = 0.8 + R.next() * 0.35;
          const p = mk(platter, kind === 3 ? blue : china, X1 - 0.06, y + 0.16 * sc, z, 0, 0, -Math.PI / 2 + 0.22);
          p.scale.setScalar(sc); sg.add(p); z += 0.36 * sc;
        } else if (kind === 1) {
          sg.add(mk(lathe(G, [[0, 0], [0.05, 0], [0.065, 0.06], [0.06, 0.13], [0.045, 0.17], [0.05, 0.19], [0, 0.18]], 24), k % 3 ? mat.saltGlaze : blue, X1 - 0.1, y, z));
          z += 0.16;
        } else if (kind === 2) {
          sg.add(mk(lathe(G, [[0, 0], [0.07, 0], [0.085, 0.03], [0.07, 0.06], [0.085, 0.09], [0.055, 0.12], [0.03, 0.14], [0.0, 0.145]], 24), mat.copper, X1 - 0.1, y, z));
          z += 0.2;
        } else {
          sg.add(mk(lathe(G, [[0, 0], [0.06, 0], [0.07, 0.04], [0.068, 0.1], [0.05, 0.13], [0.0, 0.135]], 24), mat.stonewareBrown, X1 - 0.1, y, z));
          z += 0.17;
        }
        k++;
      }
      add(sg);
    }

    // ================================================================ gas: a three-light gasolier over the block + four wall brackets
    const gasLights = [];
    {
      // thin acid-etched glass: mostly transparent, a faint warm glow where the flame lights it from inside
      const globeMat = new THREE.MeshPhysicalMaterial({ color: 0xf4ece0, emissive: new THREE.Color(1.0, 0.74, 0.46), emissiveMap: CV.mantle, emissiveIntensity: 0.14, roughness: 0.35, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.1, name: 'gasGlobe' });
      const spots = [
        { p: V3(X0, 1.98, 0.15), ry: Math.PI / 2, i: 2.4 },          // left wall, beyond the dresser
        { p: V3(X1, 1.98, -0.42), ry: -Math.PI / 2, i: 1.7 },        // right wall, by the dumbwaiter
        { p: V3(CH.x1, 1.95, Z0 + 0.25), ry: Math.PI / 2, i: 1.5 },    // on the breast return, beside the range
        { p: V3(2.7, 2.15, Z1), ry: Math.PI, i: 2.4 },                // front wall above the utensil rail
      ];
      spots.forEach((s, si) => {
        const b = buildGasBracket(G, mat, globeMat, fx, si * 1.7);
        b.group.position.copy(s.p); b.group.rotation.y = s.ry;
        add(b.group);
        // the gas supply: an iron pipe down the wall from the cornice, clipped every half metre
        const off = V3(0, 0, 0.022).applyEuler(new THREE.Euler(0, s.ry, 0));
        const top = H - 0.14, len = top - s.p.y;
        add(mk(new THREE.CylinderGeometry(0.008, 0.008, len, 8), mat.iron, s.p.x + off.x, s.p.y + len / 2, s.p.z + off.z));
        for (let yy = s.p.y + 0.35; yy < top - 0.05; yy += 0.45) add(mk(rbox(G, 0.03, 0.012, 0.03, 0.003), mat.iron, s.p.x + off.x * 0.6, yy, s.p.z + off.z * 0.6, 0, s.ry, 0));
        // short-range pool: a bare fishtail burner lights the wall round it and little else
        const pl = new THREE.PointLight(0xffa458, s.i, 2.7, 2);
        const lp = b.lightPos.clone().applyEuler(new THREE.Euler(0, s.ry, 0)).add(s.p);
        pl.position.copy(lp);
        add(pl);
        gasLights.push({ pl, base: s.i, seed: gasLights.length * 3.1 });
      });
      // gasolier: hung from the ceiling just in front of the pot rack, globes at head height over the block
      const GAS = V3(BLOCK.x + 0.05, 2.3, BLOCK.z + 0.56);
      const gz = buildGasolier(G, mat, globeMat, fx, { drop: (H - GAS.y) / 0.85, armR: 0.25, seed: 11 });
      gz.group.scale.setScalar(0.85);
      gz.group.position.copy(GAS); gz.group.rotation.y = 0.35;
      add(gz.group);
      // key: a 2700 K shadowed spot from under the font straight down onto the block (the pool on the floor round it)
      const gasKey = new THREE.SpotLight(0xffb066, 9.0, 5.5, 0.95, 0.75, 2);
      gasKey.position.set(GAS.x, GAS.y - 0.05, GAS.z);
      gasKey.target.position.set(BLOCK.x - 0.05, 0.0, BLOCK.z + 0.1);
      gasKey.castShadow = Q.shadows;
      gasKey.shadow.mapSize.set(1024, 1024); gasKey.shadow.bias = -0.0006; gasKey.shadow.normalBias = 0.02; gasKey.shadow.radius = 3;
      gasKey.shadow.camera.near = 0.2; gasKey.shadow.camera.far = 6;
      add(gasKey); add(gasKey.target);
      // the globes also light the pans, the beams and the smoke bell above them (no shadow)
      const gasUp = new THREE.PointLight(0xffa458, 1.6, 2.6, 2);
      gasUp.position.set(GAS.x, GAS.y + 0.12, GAS.z);
      add(gasUp);
      gasLights.push({ pl: gasKey, base: 9.0, seed: 7.7 }, { pl: gasUp, base: 1.6, seed: 7.7 });
      ctx.onUpdate((dt, t) => { for (const g of gasLights) g.pl.intensity = g.base * (0.97 + 0.03 * Math.sin(t * 7.3 + g.seed) * Math.sin(t * 2.9 + g.seed)); });
    }

    // ================================================================ lights
    // fire: a wide spot just inside the grille, pointing out & down - it only spills onto the hearth and floor
    range.group.updateMatrix();
    const fire = new THREE.SpotLight(0xff6a22, 1.2, 3.2, 1.05, 0.9, 2);
    fire.position.copy(range.fireLightPos).applyMatrix4(range.group.matrix);
    fire.target.position.copy(range.fireLightTarget).applyMatrix4(range.group.matrix);
    add(fire); add(fire.target);
    ctx.onUpdate((dt, t) => {
      const f = 0.85 + 0.1 * Math.sin(t * 3.3) * Math.sin(t * 1.7 + 1) + 0.05 * Math.sin(t * 11.0);
      fire.intensity = 1.2 * f; range.emberMat.emissiveIntensity = 1.5 * f; if (range.group.userData.ashMat) range.group.userData.ashMat.emissiveIntensity = 0.7 * (0.8 + 0.4 * (f - 0.8));
    });
    // faint warm bounce low in the brick recess so the sooty brick reads (below the hob)
    const alcove = new THREE.PointLight(0xff7a3a, 0.35, 1.2, 2);
    alcove.position.set((CH.ax0 + CH.ax1) / 2, 0.5, Z0 + 0.75);
    add(alcove);
    // warm rim on the kettle & stockpot from the gas bracket on the breast
    const rangeRim = new THREE.SpotLight(0xffb070, 5.0, 3.6, 0.75, 0.8, 2);
    rangeRim.position.set(CH.x1 + 0.25, 2.1, Z0 + 0.75);
    rangeRim.target.position.set((CH.ax0 + CH.ax1) / 2, 0.6, Z0 + 0.5);
    add(rangeRim); add(rangeRim.target);
    // the same bracket grazing the hob: picks out the raised lids, their chamfers and the lifting notches
    const hobLight = new THREE.SpotLight(0xffa860, 2.4, 3.0, 0.5, 0.7, 2);
    hobLight.position.set(CH.x1 - 0.1, 1.9, Z0 + 0.62);
    hobLight.target.position.set((CH.ax0 + CH.ax1) / 2, 0.82, Z0 + 0.3);
    add(hobLight); add(hobLight.target);
    // fake bounce: candle- and lamp-light thrown up off the floured block onto the beams
    const bounce = new THREE.PointLight(0xd89a5c, 0.8, 3.0, 2);
    bounce.position.set(BLOCK.x, 2.75, BLOCK.z + 0.2);
    add(bounce);
    const dinPassage = new THREE.PointLight(0xffa860, 1.0, 3.5, 2);
    dinPassage.position.set(X1 + 0.9, 1.9, DOORS.dining.z + 0.2);
    add(dinPassage);
    // a dim lamp somewhere down the foyer passage
    const passageLight = new THREE.PointLight(0xffb070, 2.0, 4.5, 2);
    passageLight.position.set(DOORS.foyer.x - 0.2, 1.9, Z1 + 0.55);
    add(passageLight);
    // moonlight through the sash window
    const moon = new THREE.SpotLight(0xa7bcff, 1500, 18, 0.3, 0.55, 2);
    moon.map = CV.gobo;
    moon.position.set(WIN.x + 1.6, 5.6, Z0 - 4.2);
    moon.target.position.set(BLOCK.x + 0.15, 0.4, BLOCK.z + 0.6);
    moon.castShadow = Q.shadows;
    moon.shadow.mapSize.set(Math.max(2048, Q.shadowMapSize), Math.max(2048, Q.shadowMapSize));
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.02; moon.shadow.radius = 2.5; moon.shadow.blurSamples = 12;
    moon.shadow.camera.near = 1; moon.shadow.camera.far = 16;
    add(moon); add(moon.target);
    const hemi = new THREE.HemisphereLight(0x4d64a8, 0x3a2a1c, 0.07);
    add(hemi);
    add(fx.areaLight({ center: [WIN.x, WIN.sill + WIN.h / 2, Z0 + 0.04], normal: [0, -0.35, 1], width: WIN.w, height: WIN.h, color: 0x8ea6ff, intensity: 4.2 }));

    // volumetrics: moon shaft, flour dust everywhere, low mist
    const winCenter = V3(WIN.x, WIN.sill + WIN.h * 0.68, Z0 - 0.05);
    const beamDir = new THREE.Vector3().subVectors(moon.target.position, moon.position).normalize();
    const shaft = fx.shaft({
      center: winCenter, right: V3(WIN.w / 2 - 0.03, 0, 0), up: V3(0, WIN.h * 0.3, 0), direction: beamDir, length: 2.6,
      color: 0xa4b8ff, intensity: 0.5, softness: 0.5, falloff: 1.8, panes: [3, 2], mullion: 0.03, noise: 0.8,
    });
    add(shaft);
    add(fx.dust({ box: new THREE.Box3(V3(0.4, 0.6, Z0 + 0.15), V3(2.4, 2.8, -0.6)), count: 800, shafts: [shaft], size: 0.0065, intensity: 2.0, ambient: 0.015, random: ctx.random.fork('dust') }));
    add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.2, 0, Z0 + 0.6), V3(X1 - 0.2, 0.9, -1.35)), color: 0x0c111c, litColor: 0x4a5c80, density: 0.2, heightFalloff: 3.6 }));

    // ================================================================ navigation
    const nodes = {
      main: { position: [0.55, 1.62, 2.95], target: [-0.35, 1.28, -3.8], fov: 60, label: 'The kitchen', look: { yaw: [-50, 50], pitch: [-28, 24] } },
      back: { position: [-0.9, 1.62, 0.1], target: [1.6, 1.3, 3.4], fov: 60, label: 'The doors' },
      range: { position: [-1.1, 1.62, -1.15], target: [-1.25, 1.1, -3.8], fov: 56, label: 'The range' },
      pantry: { position: [-1.35, 1.62, -0.35], target: [X0, 1.5, DRESSER_Z - 0.2], fov: 56, label: 'The dresser' },
      dumbwaiter: { position: [1.45, 1.6, -0.15], target: [X1, 1.25, DUMB.z - 0.15], fov: 56, label: 'The dumbwaiter' },
    };
    const edges = [
      ['main', 'range', [[-0.6, 1.62, 1.0]]],
      ['main', 'pantry', [[-0.7, 1.62, 1.3]]],
      ['main', 'dumbwaiter', [[1.5, 1.62, 1.3]]],
      ['main', 'back', null, { hotspot: { back: { position: [0.35, 0.35, 1.3], radius: 0.45 }, main: { position: [0.55, 1.2, 2.9], radius: 0.45 } } }],
      ['range', 'pantry'],
      ['range', 'dumbwaiter', [[0.2, 1.62, -1.6]]],
      ['pantry', 'dumbwaiter', [[0.3, 1.62, 0.35]]],
      ['back', 'pantry'],
      ['back', 'dumbwaiter'],
    ];
    const exits = [
      { node: 'back', toRoom: 'foyer', toNode: null, label: 'The passage to the foyer', hotspot: { box: { min: [DOORS.foyer.x - 0.55, 0.1, Z1 - 0.1], max: [DOORS.foyer.x + 0.55, 2.3, Z1 + 0.4] } } },
      { node: 'back', toRoom: 'dining', toNode: null, label: 'The service door', hotspot: { box: { min: [X1 - 0.1, 0.1, DOORS.dining.z - 0.5], max: [X1 + 0.4, 2.2, DOORS.dining.z + 0.5] } } },
    ];

    // ================================================================ hotspots
    const say = (text) => ctx.say({ text, speaker: 'stauf', speakerName: 'Stauf' });
    const hotspots = [
      { id: 'cans', nodes: ['pantry', 'main'], box: { min: [X0, 1.15, DRESSER_Z - 0.75], max: [X0 + 0.35, 2.05, DRESSER_Z + 0.75] }, cursor: 'puzzle', label: 'Stauf’s Superior Soups', puzzle: cans.puzzle, enabled: () => !ctx.state.isSolved(CANS_ID) },
      {
        id: 'cans-solved', nodes: ['pantry'], box: { min: [X0, 1.15, DRESSER_Z - 0.75], max: [X0 + 0.35, 2.05, DRESSER_Z + 0.75] }, cursor: 'examine', label: 'The recipe', enabled: () => ctx.state.isSolved(CANS_ID),
        onActivate: () => ctx.ui.caption('THE SOUP IS MADE OF GUESTS. The tins will not be moved again. They are glued to the shelf now — or something is holding them.', { title: 'The Pantry' }),
      },
      {
        id: 'range', nodes: ['range', 'main'], box: { min: [CH.ax0, 0.1, Z0], max: [CH.ax1, 1.45, Z0 + 0.75] }, cursor: 'examine', label: 'The range',
        onActivate: async () => { ctx.ui.caption('The fire has been banked for seventy years and has never once gone out. The stockpot is warm. You do not lift the lid.', { title: 'The Range' }); },
      },
      {
        id: 'pans', nodes: ['range'], box: { min: [CH.x0, 1.9, Z0 + CH.d - 0.05], max: [CH.x1, 2.55, Z0 + CH.d + 0.35] }, cursor: 'examine', label: 'Copper pans',
        onActivate: () => ctx.ui.caption('Six pans, polished to mirrors. In each one your reflection is a little further behind you.', { title: 'The Batterie' }),
      },
      {
        id: 'block', nodes: ['main', 'range', 'pantry', 'dumbwaiter'], box: { min: [BLOCK.x - 0.75, 0.6, BLOCK.z - 0.4], max: [BLOCK.x + 0.75, 1.05, BLOCK.z + 0.4] }, cursor: 'examine', label: 'The butcher’s block',
        onActivate: async () => { ctx.audio.sfx('thud'); await say('Fresh meat is *so* hard to come by. One must make do with whoever drops in.'); },
      },
      {
        id: 'footprints', nodes: ['dumbwaiter', 'main'], box: { min: [1.2, 0, -1.4], max: [3.0, 0.08, -0.4] }, cursor: 'examine', label: 'Footprints',
        onActivate: () => ctx.ui.caption('Bare feet, small ones, walked through the flour to the dumbwaiter. None walk back.', { title: 'In the Flour' }),
      },
      {
        id: 'dumbwaiter', nodes: ['dumbwaiter', 'main'], box: { min: [X1 - 0.15, DUMB.y - 0.05, DUMB.z - 0.4], max: [X1 + 0.1, DUMB.y + DUMB.h + 0.05, DUMB.z + 0.4] }, cursor: 'examine', label: 'The dumbwaiter',
        onActivate: async () => {
          if (!dumb.open) {
            ctx.audio.sfx('thud');
            ctx.ui.caption('The hatch will not lift. From somewhere above, the ropes creak as if a weight were being lowered — and stops. Perhaps the cook must be satisfied first.', { title: 'The Dumbwaiter' });
          } else {
            await ctx.cinematic(async (c, hh) => {
              await ctx.nav.lookAt(V3(X1 + 0.3, DUMB.y + 0.15, DUMB.z), 1.0);
              ctx.post.set({ saturation: 0.7, vignette: 0.6 }, 0.8);
              await say('Dinner is *served*. Do lift the cover — no? Suit yourself. It was only the last guest who asked too many questions.');
              await hh.wait(0.4);
              ctx.post.reset(1.0);
              await ctx.nav.returnToNode(1.0);
            });
          }
        },
      },
      {
        id: 'bells', nodes: ['back', 'dumbwaiter'], box: { min: [X1 - 0.2, DOORS.dining.h + 0.15, DOORS.dining.z - 0.65], max: [X1, DOORS.dining.h + 0.7, DOORS.dining.z + 0.65] }, cursor: 'examine', label: 'The bell board',
        onActivate: () => { ctx.audio.sfx('chime', { freq: 1567 }); ctx.ui.caption('DINING rings. No one is in the dining room. It rings again.', { title: 'The Bell Board' }); },
      },
      {
        id: 'window', nodes: ['range', 'main'], box: { min: [WIN.x - WIN.w / 2, WIN.sill, Z0 - 0.4], max: [WIN.x + WIN.w / 2, WIN.sill + WIN.h, Z0] }, cursor: 'examine', label: 'The kitchen garden',
        onActivate: () => ctx.ui.caption('The kitchen garden, gone to seed under the moon. The glasshouse panes are fogged from the inside.', { title: 'The Window' }),
      },
      {
        id: 'sampler', nodes: ['range', 'main'], box: { min: [(CH.x0 + CH.x1) / 2 - 0.25, 2.65, Z0 + CH.d - 0.02], max: [(CH.x0 + CH.x1) / 2 + 0.25, 3.25, Z0 + CH.d + 0.06] }, cursor: 'examine', label: 'A sampler',
        onActivate: () => ctx.ui.caption('WASTE NOT — NOT EVEN GUESTS. Stitched by a child, in thread the colour of old gravy.', { title: 'The Sampler' }),
      },
      {
        id: 'clock', nodes: ['range'], sphere: { center: [(CH.x0 + CH.x1) / 2 + 0.05, 1.86, Z0 + CH.d + 0.15], radius: 0.18 }, cursor: 'examine', label: 'The clock',
        onActivate: () => ctx.ui.caption('Five to midnight. It has been five to midnight in this kitchen for a very long time.', { title: 'The Kitchen Clock' }),
      },
    ];

    // ================================================================ QA hooks
    if (typeof window !== 'undefined') {
      const dbg = (window.__debug ||= {});
      dbg.solvers ||= {}; dbg.states ||= {};
      dbg.solvers.kitchen = async () => {
        const game = window.__game;
        if (game && !game.puzzle && game.room?.mod?.id === 'kitchen' && game.startPuzzle) {
          game.startPuzzle(cans.puzzle);
          await new Promise((r) => setTimeout(r, 50));
        }
        if (game?.puzzle?.def?.id === CANS_ID) { cans.puzzle.autoSolve(game.puzzle.pctx); return true; }
        cans.applySolved(); ctx.state.markSolved?.(CANS_ID); revealDumbwaiter(false);
        return true;
      };
      dbg.states.kitchen = () => ({ ...cans.state(), isSolved: ctx.state.isSolved(CANS_ID), dumbwaiterOpen: dumb.open });
      dbg.solve ||= (id) => (dbg.solvers[id] ? dbg.solvers[id]() : Promise.reject(new Error(`no solver for ${id}`)));
      dbg.state ||= (id) => (dbg.states[id] ? dbg.states[id]() : null);
      dbg.kitchen = { cans, swap: cans.swap, word: cans.word, order: cans.readout };
    }
    if (ctx.params?.get?.('kitchenSolved') === '1') { cans.applySolved(); revealDumbwaiter(false); }

    // ================================================================ shadows + merge
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      const fxLike = o.isPoints || m?.isShaderMaterial || m?.isMeshBasicMaterial || m?.transparent || o.userData.noBake;
      o.castShadow = !o.userData.noShadow && !fxLike && !['floor', 'ceiling'].includes(o.name);
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });
    // candle flame & wax shouldn't shadow the candle light itself
    candle.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    // hand-placed irradiance: light thrown back off the lit surfaces, corners falling away gradually
    const candleW = V3(BLOCK.x + 0.62, 0.98, BLOCK.z - 0.18);
    const gi = makeBounce({
      room: { min: [X0, 0, Z0], max: [X1, H, Z1] },
      sky: [0.04, 0.05, 0.095], ground: [0.035, 0.025, 0.018], cornerDark: 0.75,
      emitters: [
        { p: [(CH.ax0 + CH.ax1) / 2, 0.45, Z0 + 0.95], r: 1.0, c: [0.55, 0.24, 0.08] },          // range hearth
        { p: [candleW.x, candleW.y - 0.05, candleW.z], r: 1.25, c: [0.5, 0.32, 0.15] },           // candle off the block top
        { p: [BLOCK.x, 2.95, BLOCK.z], r: 1.2, c: [0.22, 0.14, 0.07] },                            // warm under the beams over the block
        { p: [0.55, 0.15, -0.35], r: 1.7, c: [0.12, 0.16, 0.3] },                                  // moon pool on the floor
        { p: [WIN.x, 1.6, Z0 + 0.35], r: 1.3, c: [0.13, 0.17, 0.32] },                             // window reveal + sink
        { p: [X0 + 0.35, 1.05, DRESSER_Z - 0.7], r: 1.0, c: [0.4, 0.24, 0.1] },                    // pantry lamp
        { p: [X0 + 0.35, 2.05, 0.15], r: 0.9, c: [0.28, 0.17, 0.08] },                             // gas, left wall
        { p: [X1 - 0.35, 2.05, -0.05], r: 0.9, c: [0.3, 0.18, 0.08] },                             // gas, right wall
        { p: [CH.x1 + 0.3, 2.1, Z0 + 0.25], r: 0.8, c: [0.22, 0.13, 0.06] },                       // gas, breast return
        { p: [BLOCK.x + 0.05, 2.3, BLOCK.z + 0.56], r: 1.1, c: [0.3, 0.19, 0.08] },                // gasolier globes
        { p: [2.7, 2.15, Z1 - 0.35], r: 0.9, c: [0.26, 0.16, 0.07] },                              // gas, front wall
        { p: [2.95, 1.0, Z1 - 0.35], r: 0.9, c: [0.3, 0.18, 0.08] },                               // side-table lamp
        { p: [X1 - 0.3, DUMB.y + 0.4, DUMB.z], r: 0.7, c: [0.2, 0.12, 0.06] },                     // dumbwaiter spill
        { p: [DOORS.foyer.x - 0.2, 1.2, Z1 - 0.35], r: 1.0, c: [0.22, 0.14, 0.07] },               // passage lamp through the foyer door
        { p: [X1 - 0.35, 1.2, DOORS.dining.z], r: 1.0, c: [0.24, 0.15, 0.07] },                     // service passage light
        { p: [-1.75, 2.3, 0.35], r: 0.9, c: [0.1, 0.09, 0.08] },                                    // pale linen on the airer
        { p: [X0 + 0.4, 1.6, DRESSER_Z], r: 0.9, c: [0.16, 0.1, 0.05] },                            // tins & crocks catching the lamp
      ],
    });
    gi.uniforms.kbGain.value = 0.9;
    gi.applyTree(root);
    mergeStatic(root);

    const godRays = [{ position: V3(WIN.x + 0.3, WIN.sill + 1.2, Z0 - 1.6), color: new THREE.Color(0.72, 0.8, 1.0), strength: 0.8, radius: 0.2 }];

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'main',
      grade: { exposure: 1.8, contrast: 1.08, saturation: 0.98, lift: [0.007, 0.008, 0.016], bloomStrength: 0.3, bloomThreshold: 1.6, godRayWeight: 0.3, godRayThreshold: 2.5, vignette: 0.42, aoIntensity: 1.0, aoRadius: 0.45 },
      environment: { position: [0.2, 1.7, 1.2], intensity: 0.5 },
      onEnter() {
        if (!ctx.state.has('kitchen.greeted')) {
          ctx.state.set('kitchen.greeted', true);
          setTimeout(() => say('Hungry? Stay for supper. Stay... *for* supper.'), 1600);
        }
      },
      dispose() { const d = window.__debug; if (d) { delete d.kitchen; if (d.solvers) delete d.solvers.kitchen; if (d.states) delete d.states.kitchen; } },
    };
  },
};

/** engine curtainGeometry can emit NaN in its top row; patch from the row below */
function fixNaN(g, segX = 140) {
  const a = g.attributes.position.array;
  const row = (segX + 1) * 3;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) a[i] = Number.isFinite(a[i + row]) ? a[i + row] : 0;
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Stencilled merchant's mark for the flour sacks (alpha = ink), distressed like a worn stencil on coarse hessian. */
function makeSackStencil(forge) {
  return forge.canvas('kitchen:sackStencil2', 512, 512, (g, W, H) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    // stencil bridges: break each glyph with thin vertical gaps after drawing
    g.font = '700 58px Cinzel, Georgia, serif'; g.fillText('STAUF', W / 2, 70);
    g.font = '600 30px Cinzel, Georgia, serif'; g.fillText('·  MILLS  ·', W / 2, 118);
    // a wheatsheaf in a double ring
    g.lineWidth = 6; g.beginPath(); g.arc(W / 2, 228, 74, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(W / 2, 228, 62, 0, Math.PI * 2); g.stroke();
    for (let k = -3; k <= 3; k++) {
      g.save(); g.translate(W / 2, 270); g.rotate(k * 0.16);
      g.fillRect(-2.5, -95, 5, 92);
      for (let j = 0; j < 5; j++) { g.beginPath(); g.ellipse(-6, -88 + j * 11, 6, 3, -0.6, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(6, -88 + j * 11, 6, 3, 0.6, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
    g.fillRect(W / 2 - 30, 238, 60, 8);
    g.font = '700 62px Cinzel, Georgia, serif'; g.fillText('FINEST WHITES', W / 2, 352);
    g.font = '700 74px Cinzel, Georgia, serif'; g.fillText('140 LB', W / 2, 440);
    g.fillStyle = '#000';
    for (let x = 8; x < W; x += 23) g.fillRect(x, 0, 2.2, H);           // stencil bridges
    // worn: blotchy loss of ink, scuffed by handling
    let a = 7;
    const R = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    for (let k = 0; k < 160; k++) { const x = R() * W, y = R() * H, r = 3 + R() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${0.3 + R() * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  }, { tile: false });
}

/** Multiply the merchant's stencil over a sack material, using the sack's own (u around, t up) parameterisation. */
function stencilSack(material, tex) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.(shader, r);
    shader.uniforms.sStencil = { value: tex };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 suv;\nvarying vec2 vSuv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSuv = suv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D sStencil;\nvarying vec2 vSuv;')
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec2 st = vec2((0.38 - vSuv.x) / 0.26, (vSuv.y - 0.2) / 0.62);
  if (st.x > 0.0 && st.x < 1.0 && st.y > 0.0 && st.y < 1.0) {
    float ink = texture2D(sStencil, vec2(st.x, st.y)).r;
    // ink sits on the yarn tops: the burlap's own brightness gates it
    float top = 0.7 + 0.3 * smoothstep(0.02, 0.12, dot(diffuseColor.rgb, vec3(0.33)));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.008, 0.012, 0.03), ink * top * 0.92);
  }
}`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (key ? key() : '') + '|sackStencil';
  material.needsUpdate = true;
}

/** Runs of wax down a candle's side from a slightly hollowed top, and a pooled skirt at its foot. */
const WAX = new THREE.MeshPhysicalMaterial({ color: 0xe8dcc0, roughness: 0.45, transmission: 0, sheen: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.4, name: 'waxDrip' });
function waxDrips(parent, r, h, seed) {
  const R = (k) => { const v = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  const n = 3 + (seed % 3);
  for (let k = 0; k < n; k++) {
    const a = R(k) * Math.PI * 2, len = 0.015 + R(k + 10) * 0.05, w = 0.0018 + R(k + 20) * 0.0016;
    const d = new THREE.Mesh(new THREE.CapsuleGeometry(w, len, 4, 8), WAX);
    d.position.set(Math.cos(a) * (r + w * 0.4), h - len / 2 - 0.002, Math.sin(a) * (r + w * 0.4));
    d.scale.set(0.7, 1, 1);
    d.rotation.y = -a;
    parent.add(d);
    // a bead where the run stopped
    const b = new THREE.Mesh(new THREE.SphereGeometry(w * 1.35, 8, 6), WAX);
    b.position.set(Math.cos(a) * (r + w * 0.5), h - len - 0.002, Math.sin(a) * (r + w * 0.5));
    parent.add(b);
  }
  // the lip: a ragged rim of wax standing round the hollowed top
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r * 0.92, r * 0.16, 6, 20), WAX);
  lip.rotation.x = Math.PI / 2; lip.position.y = h - 0.001; parent.add(lip);
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.5, r * 1.75, 0.004, 20), WAX);
  pool.position.y = 0.002; parent.add(pool);
}
