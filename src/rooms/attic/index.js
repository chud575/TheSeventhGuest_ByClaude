import * as THREE from 'three';
import { LightShaft } from '../../engine/fx/index.js';
import { mergeStatic } from '../../engine/lib/contrib/foyer-merge.js';
import { sarkBoardTexture, addBrickVariation, fabricStainTexture, cloudWispTexture, addTableWear, shoePrintTexture } from './textures.js';
import { timberTexture, sarkingTexture, floorTexture, lathPlasterTexture, linenTexture, moonSkyTexture, cobwebTexture, hellGlowTexture, brickTexture, addGrime, dappleTexture, dollFaceTexture } from './textures.js';
import {
  bevelBox, beam, hewnBeam, buildWorkbench, buildTrain, buildToolRack, buildSoldiers, buildTop, buildDrum,
  buildBlocks, buildPuzzleBox, buildLabTable, buildMicroscope, buildGlassware, buildBellJar,
  buildHangingLamp, buildToyChest, buildChair, buildTrunk, buildCrate, buildDressForm, buildBirdCage, dustSheetGeometry, buildFrameStack, hangingCoatGeometry, buildMicroscopeVictorian, buildStool, buildMicroscopeGreat, buildSuitcase, buildHatBox, buildRolledRug, buildBookBundle, buildGramophone,
} from './props.js';
import { moonDiscTexture, oculusGrimeTexture, addDust, decalAtlasTexture, sootPlumeTexture, peelingPaintTexture, treadWearTexture } from './textures.js';
import { webMaterial, cornerWebTexture, cornerWeb, strand, dangle, buildMotes, sheetWeb, hammockWeb, hammockWebTexture } from './webs.js';
import { createInfectionPuzzle, infectionMeta, INFECTION_ID } from './puzzleInfection.js';
import { apparitionMaterial, buildApparition } from './apparition.js';
import { buildBiplane, buildDoll, buildRockingHorse, buildModelHouse, buildMarionette, buildJackInBox, buildMusicBox, buildBurr, buildPaintPots, buildScrews, buildNotebook, taperTube } from './toys.js';

/**
 * Stauf's Attic — the finale.
 *
 * A long gabled garret under the slates, 7.4 m wide and nearly 10 m deep. Hand-hewn
 * rafters every 60 cm, two king-post trusses with collar beams, purlins and a ridge
 * beam; sarking boards stained by old leaks. The back gable is bare brick with a
 * round oculus full of moon, and beside it a low plank door left ajar on a stair
 * that glows like a furnace. Under the oculus stands Stauf's workbench, crowded
 * with the toys he made and sold; in the middle of the floor a laboratory table
 * with a great brass microscope and the specimen plate of his last game — the
 * Infection. Trunks, dust-sheeted furniture, a rocking horse and a dressmaker's
 * dummy crowd the low eaves. A chimney stack rises through the right slope.
 *
 * Axes: x right (looking from the stair toward the oculus), z toward the stair
 * end (front gable), y up. Back gable (oculus, door) at z = Z0.
 */

const X0 = -3.7, X1 = 3.7, Z0 = -5.2, Z1 = 4.6;
const KNEE = 0.9, RIDGE = 4.5;
const HALF = X1;
const RISE = RIDGE - KNEE;
const roofY = (x) => KNEE + RISE * (1 - Math.abs(x) / HALF);
const SLOPE = Math.atan2(RISE, HALF);
const SLOPE_LEN = Math.hypot(RISE, HALF);
const RAFTER = { w: 0.075, d: 0.17, step: 0.6 };
const COLLAR_Y = 2.55;
const TRUSS_Z = [-1.4, 1.75];
const OCULUS = { x: -0.3, y: 2.85, r: 0.62, depth: 0.36 };
const DOOR = { x0: 1.44, x1: 2.26, h: 1.9, open: 1.12 };
const WALL_T = 0.3;
const STAIR = { x0: -2.7, x1: -1.7, z0: 1.6, z1: 4.3, rise: 0.205, run: 0.245 };
const CHIM = { x0: 1.75, x1: 2.4, z0: 1.15, z1: 1.8 };
const TABLE = new THREE.Vector3(0.85, 0, -1.4);
const TABLE_H = 0.86;
const PLATE = new THREE.Vector3(0.6, TABLE_H + 0.06, -1.38);
const PLATE_R = 0.25;
const BENCH = new THREE.Vector3(-1.35, 0, Z0 + 0.42);
const BT_Y = 0.9;
const ROOM_GRADE = {
  exposure: 2.5, contrast: 1.1, saturation: 0.96, toneMapping: 'aces',
  shadowTint: [0.78, 0.92, 1.22], highlightTint: [1.14, 1.0, 0.82], splitAmount: 0.6,
  vignette: 0.5, grain: 0.04, bloomStrength: 0.26, bloomThreshold: 2.0,
  godRayWeight: 0.45, godRayThreshold: 2.0, aoIntensity: 1.15, aoRadius: 0.4,
};

// the finale: shadows lifted toward crimson, highlights hot
const CLIMAX_GRADE = { shadowTint: [1.3, 0.8, 0.78], highlightTint: [1.2, 0.95, 0.78], splitAmount: 0.72, saturation: 1.1, contrast: 1.14 };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

/** Orient a geometry built along local Z (length) and local Y (depth) into world: z -> dir, y -> up. */
function orient(geo, center, dir, up) {
  const Z = dir.clone().normalize();
  const Y = up.clone().sub(Z.clone().multiplyScalar(up.dot(Z))).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(center);
  return geo.applyMatrix4(m);
}
/** quad with metre UVs (a,b,c,d counter-clockwise seen from the front) */
function quad(a, b, c, d, uScale = 1, vScale = 1) {
  const g = new THREE.BufferGeometry();
  const ab = b.distanceTo(a), ad = d.distanceTo(a);
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray()], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, ab * uScale, 0, ab * uScale, ad * vScale, 0, ad * vScale], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

export default {
  id: 'attic',
  title: 'The Attic',
  floorName: 'Under the Eaves',
  map: { floor: 'attic', rect: [330, 200, 340, 220] },
  start: 'stairs',
  ambience: { wind: 0.75, creaks: 0.7, clock: 0.15, thunder: 0.35, rain: 0.2, heartbeat: 0.25, roomTone: 0.4 },
  music: { key: 38, mood: 'dread' },
  puzzles: [infectionMeta],

  async build(ctx) {
    const { materials: M, geometry: G, fx } = ctx;
    const Q = ctx.quality;
    const root = new THREE.Group();
    root.name = 'attic';
    const add = (o, parent = root) => { parent.add(o); return o; };
    const ghostMat = apparitionMaterial(ctx.time, { core: 0x040202, rim: 0xff5a1e, fill: 0x0c1020, opacity: 1.0, rimGain: 1.5 });
    const FIG = { rest: new THREE.Vector3(), fore: new THREE.Vector3(), obj: null };
    const SCOPE = { obj: null };
    const beamK = { value: 1 };
    let moonK = 1;   // climax: the moon dims as the furnace takes the room
    const dyn = (o) => { o.userData.dynamic = true; return o; };
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.6, metalness: 0.6, name: 'wire' });
    const strandLine = (a, b) => { const len = a.distanceTo(b); const o = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, len, 5), wireMat); o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()); return o; };

    // ================================================================ materials
    const pbr = (set, opts = {}, Phys = false) => new (Phys ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({ map: set.map, normalMap: set.normalMap, roughnessMap: set.ormMap, metalnessMap: set.ormMap, aoMap: set.ormMap, roughness: 1, metalness: 1, ...opts });
    const timber = timberTexture(ctx.textures);
    const timberDark = timberTexture(ctx.textures, { key: 'timberDark', base: [0.29, 0.21, 0.15] });
    const linen = linenTexture(ctx.textures);
    const brickTex = brickTexture(ctx.textures, { missing: 0.02 });
    const brickDarkTex = brickTexture(ctx.textures, { key: 'brickDark', base: [0.3, 0.15, 0.11], mortar: [0.28, 0.26, 0.24], bloom: 0.25, missing: 0.012 });
    const paint = (hex, o = {}) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.35, envMapIntensity: 0.6, ...o });
    const mat = {
      timber: pbr(timber.withRepeat(1 / 1.2, 1 / 0.3), { name: 'timber', envMapIntensity: 0.3 }),
      timberDark: pbr(timberDark.withRepeat(1 / 1.2, 1 / 0.3), { name: 'timberDark', envMapIntensity: 0.3 }),
      sarking: pbr(sarkingTexture(ctx.textures).withRepeat(1 / 1.2, 1 / 1.2), { name: 'sarking', envMapIntensity: 0.2 }),
      floor: pbr(floorTexture(ctx.textures).withRepeat(1 / 1.6, 1 / 1.6), { name: 'floor', envMapIntensity: 0.35 }),
      lath: addGrime(pbr(lathPlasterTexture(ctx.textures).withRepeat(1 / 3, 1 / 3), { name: 'lath', envMapIntensity: 0.25 }), {
        floor: 0.5, macro: 0.55, roof: { knee: KNEE, ridge: RIDGE, half: HALF }, roofDark: 0.45,
        streaks: [[-1.1, 3.9, 0.22, 0.85], [0.6, 4.2, 0.3, 0.7], [1.6, 3.4, 0.18, 0.8], [-2.4, 2.6, 0.2, 0.6], [2.7, 2.2, 0.14, 0.7], [0.0, 3.0, 0.08, 0.5]],
      }),
      brick: addGrime(pbr(brickTex.withRepeat(1 / 1.8, 1 / 1.8), { name: 'brick', envMapIntensity: 0.3 }), {
        floor: 0.55, macro: 0.5, roof: { knee: KNEE, ridge: RIDGE, half: HALF },
        streaks: [[OCULUS.x, OCULUS.y - OCULUS.r - 0.04, 0.36, 1.0], [-1.92, 2.6, 0.16, 0.8], [1.92, 2.6, 0.16, 0.7], [0.0, 4.25, 0.22, 0.9], [-2.95, 1.45, 0.12, 0.6], [(DOOR.x0 + DOOR.x1) / 2, DOOR.h + 0.12, 0.5, 0.55]],
      }),
      brickDark: addBrickVariation(addGrime(pbr(brickDarkTex.withRepeat(1 / 1.8, 1 / 1.8), { name: 'brickDark', envMapIntensity: 0.2 }), { floor: 0.5, macro: 0.6, floorDark: 0.6 }), { bloom: 0.25 }),
      stone: M.create('stone', { rows: 2, cols: 3, moss: 0.15, damp: 0.1, repeat: [2.4, 2.4], color: [0.42, 0.4, 0.38], roughness: 2.2, envMapIntensity: 0.15 }),
      benchTop: M.create('wood', { clearcoat: 0.0, species: 'oak', boards: 3, polish: 0.15, wear: 0.9, repeat: [2.6, 2.6], macro: 0.6, color: [0.66, 0.54, 0.43] }),
      benchFrame: M.create('wood', { clearcoat: 0.0, species: 'oak', boards: 0, polish: 0.12, wear: 0.95, repeat: [3.6, 3.6], color: [0.36, 0.26, 0.19] }),
      labTop: M.create('walnut', { boards: 5, wear: 0.85, repeat: [3.2, 1.22], macro: 0.6, color: [0.46, 0.39, 0.35], clearcoat: 0.2, clearcoatRoughness: 0.5, roughness: 1.3 }),
      labFrame: M.create('walnut', { repeat: [2, 2], color: [0.5, 0.4, 0.34] }),
      door: M.create('wood', { clearcoat: 0.0, species: 'oak', boards: 5, boardLength: 3, polish: 0.05, wear: 1.0, repeat: [1.1, 1.1], color: [0.32, 0.24, 0.18] }),
      slat: M.create('wood', { clearcoat: 0.0, species: 'oak', boards: 0, polish: 0.2, wear: 0.8, repeat: [3, 3], color: [0.42, 0.3, 0.2] }),
      crate: M.create('wood', { clearcoat: 0.0, species: 'pine', boards: 0, polish: 0.0, wear: 1.0, repeat: [2, 2], color: [0.72, 0.6, 0.45] }),
      brass: M.create('brass', { tarnish: 0.45, polish: 0.6, repeat: [3, 3] }),
      scopeBrass: M.create('brass', { tarnish: 0.32, polish: 0.62, scratches: 0.3, repeat: [5, 5] }),
      trunk: M.create('leather', { color: [0.16, 0.08, 0.045], wear: 0.8, repeat: [2.5, 2.5] }),
      leatherStrap: M.create('leather', { color: [0.1, 0.05, 0.03], wear: 0.5, repeat: [6, 6] }),
      painting: M.create('painting', { subject: 1, seed: 7, aspect: 0.65 / 0.85, varnish: 0.8, cracks: 0.8, size: 512 }),
      linen: pbr(linen.withRepeat(1.6, 1.6), { name: 'linen', side: THREE.DoubleSide, envMapIntensity: 0.25, sheen: 0.45, sheenRoughness: 0.8, sheenColor: new THREE.Color(0.75, 0.75, 0.78), metalness: 0 }, true),
      iron: M.basic('iron'),
      castIron: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.55, metalness: 0.7, name: 'castIron' }),
      strapIron: new THREE.MeshStandardMaterial({ color: 0x1c1a19, roughness: 0.7, metalness: 0.75, name: 'strapIron' }),
      peg: new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 0.85, name: 'peg' }),
      black: M.basic('black'),
      bone: M.basic('bone'),
      porcelain: M.basic('porcelain'),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xdfe8ee, roughness: 0.16, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false, clearcoat: 0, envMapIntensity: 1.0, side: THREE.DoubleSide, name: 'glassware' }),
      steel: new THREE.MeshStandardMaterial({ color: 0x8a8c90, roughness: 0.35, metalness: 1, name: 'steel' }),
      tin: new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.6, metalness: 0.85, side: THREE.DoubleSide, name: 'tin' }),
      handle: paint(0x5a3a1e, { clearcoat: 0.3, roughness: 0.6, name: 'handle' }),
      toyRed: paint(0x8a1410, { name: 'toyRed' }), toyBlue: paint(0x16306e, { name: 'toyBlue' }), toyGold: paint(0xb08a30, { metalness: 0.6, name: 'toyGold' }),
      toyWhite: paint(0xd8d0c0, { name: 'toyWhite' }), toyBlack: paint(0x0c0a0a, { name: 'toyBlack' }), toyGreen: paint(0x1f4a24, { name: 'toyGreen' }),
      vellum: new THREE.MeshStandardMaterial({ color: 0x5e5546, roughness: 0.7, name: 'vellum' }),
      hair: new THREE.MeshStandardMaterial({ color: 0x2a170c, roughness: 0.8, name: 'hair' }),
      glassEye: new THREE.MeshPhysicalMaterial({ color: 0x0a0806, roughness: 0.05, clearcoat: 1, name: 'glassEye' }),
      horse: paint(0x7c766c, { name: 'horse' }),
      chestPaint: paint(0x2c4a5a, { roughness: 0.7, clearcoat: 0.15, name: 'chestPaint' }),
      ball: paint(0x9a2a18, { name: 'ball' }),
      horseWood: paint(0x4a2414, { roughness: 0.5, name: 'horseWood' }),
      saddle: paint(0x5a0c0a, { roughness: 0.5, name: 'saddle' }),
      blackEnamel: new THREE.MeshPhysicalMaterial({ color: 0x080808, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, name: 'enamel' }),
      mirror: new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.05, metalness: 1, name: 'mirror' }),
      liquidGreen: new THREE.MeshStandardMaterial({ color: 0x1e5a10, emissive: new THREE.Color(0.2, 0.9, 0.1), emissiveIntensity: 0.6, roughness: 0.1, transparent: true, opacity: 0.85, name: 'liqG' }),
      liquidBlue: new THREE.MeshStandardMaterial({ color: 0x0f2a6a, emissive: new THREE.Color(0.1, 0.3, 1.0), emissiveIntensity: 0.5, roughness: 0.1, transparent: true, opacity: 0.85, name: 'liqB' }),
      liquidRed: new THREE.MeshStandardMaterial({ color: 0x5a0808, roughness: 0.1, transparent: true, opacity: 0.85, name: 'liqR' }),
      liquidAmber: new THREE.MeshStandardMaterial({ color: 0x7a4a0a, roughness: 0.1, transparent: true, opacity: 0.85, name: 'liqA' }),
      ruby: new THREE.MeshPhysicalMaterial({ color: 0x6a0a0a, roughness: 0.1, clearcoat: 1, transmission: 0, emissive: new THREE.Color(0.5, 0.05, 0.02), emissiveIntensity: 0.2, name: 'rubyGlass' }),
      chimney: new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: 0.07, depthWrite: false, name: 'lampChimney' }),
      dressForm: new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.85, name: 'dressForm' }),
      tape: new THREE.MeshStandardMaterial({ color: 0xc8b070, roughness: 0.6, name: 'tape' }),
      string: new THREE.MeshBasicMaterial({ color: 0x8a8070, name: 'string' }),
      straw: new THREE.MeshStandardMaterial({ color: 0x9a8448, roughness: 0.9, name: 'straw' }),
      slate: new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.6, name: 'slate' }),
      modelWall: new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: 0.8, name: 'modelWall' }),
      winLit: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.7, 0.35).multiplyScalar(2.2), toneMapped: false, name: 'winLit' }),
      winDark: new THREE.MeshBasicMaterial({ color: 0x050608, name: 'winDark' }),
      inlay: M.create('ebony', { repeat: [4, 4] }),
      gilt: M.create('gold', { wear: 0.6, dirt: 0.7, repeat: [3, 1] }),
      frameDark: M.create('walnut', { repeat: [3, 3], color: [0.35, 0.3, 0.28] }),
      canvasBack: new THREE.MeshStandardMaterial({ color: 0x6a5a44, roughness: 0.95, name: 'canvasBack' }),
      rope: new THREE.MeshStandardMaterial({ color: 0x5a4a32, roughness: 0.95, name: 'rope' }),
      lace: new THREE.MeshStandardMaterial({ color: 0xd8d0bc, roughness: 0.85, name: 'lace', side: THREE.DoubleSide }),
      stocking: new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.8, name: 'stocking' }),
      sash: paint(0x6a0e14, { roughness: 0.6, clearcoat: 0.1, sheen: 0.8, sheenColor: new THREE.Color(0.8, 0.4, 0.4), name: 'sash' }),
      dressBlue: new THREE.MeshPhysicalMaterial({ color: 0x3a4660, map: fabricStainTexture(ctx.textures).map, roughness: 0.9, sheen: 0.5, sheenRoughness: 0.7, sheenColor: new THREE.Color(0.4, 0.42, 0.48), side: THREE.DoubleSide, name: 'dressBlue' }),
      dressRed: new THREE.MeshPhysicalMaterial({ color: 0x6a3430, map: fabricStainTexture(ctx.textures).map, roughness: 0.9, sheen: 0.5, sheenRoughness: 0.7, sheenColor: new THREE.Color(0.5, 0.4, 0.38), side: THREE.DoubleSide, name: 'dressRed' }),
      hairBlonde: new THREE.MeshStandardMaterial({ color: 0x7a5a2a, roughness: 0.6, name: 'hairBlonde' }),
      bookLeather: M.create('leather', { color: [0.2, 0.07, 0.05], wear: 0.9, repeat: [8, 8] }),
      pageEdge: new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.9, name: 'pageEdge' }),
      lawn: new THREE.MeshStandardMaterial({ color: 0x1e2a14, roughness: 0.95, name: 'lawn' }),
      modelTrim: new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.7, name: 'modelTrim' }),
      brickToy: new THREE.MeshStandardMaterial({ color: 0x5a2418, roughness: 0.8, name: 'brickToy' }),
      saddleCloth: new THREE.MeshPhysicalMaterial({ color: 0x14285a, roughness: 0.7, sheen: 1, sheenColor: new THREE.Color(0.4, 0.5, 0.9), name: 'saddleCloth' }),
      velvetRed: new THREE.MeshPhysicalMaterial({ color: 0x4a0a10, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0.9, 0.3, 0.3), name: 'velvetRed' }),
      hairRed: new THREE.MeshStandardMaterial({ color: 0x8a2a10, roughness: 0.7, name: 'hairRed' }),
      shaving: new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.75, side: THREE.DoubleSide, name: 'shaving' }),
      fringe: new THREE.MeshStandardMaterial({ color: 0xb0a688, roughness: 0.95, name: 'fringe' }),
      rugEdge: new THREE.MeshStandardMaterial({ color: 0x2a1410, roughness: 0.95, name: 'rugEdge' }),
    };
    addBrickVariation(mat.brick, { damp: [OCULUS.x, OCULUS.y - OCULUS.r - 0.3, 0.55], bloom: 0.45, soot: [[-1.92, BT_Y + 0.25, 0.12, 0.5], [-2.2, 0.62, 0.15, 0.35], [(DOOR.x0 + DOOR.x1) / 2, DOOR.h + 0.1, 0.35, 0.3], [1.98, 1.3, 0.1, 0.4]] });
    // dust settles on everything that faces up; wiped where Stauf works and walks
    addDust(mat.benchTop, { amount: 0.5, scale: 0.35, threshold: 0.7, clean: [[-1.3, BENCH.z + 0.15, 0.5], [-0.5, BENCH.z + 0.1, 0.35]] });
    addTableWear(mat.labTop, { cx: TABLE.x, cz: TABLE.z, hw: 0.775, hd: 0.41, desat: 0.22, scorch: [PLATE.x + 0.06, PLATE.z + 0.02, 0.0], rings: [[TABLE.x - 0.6, TABLE.z + 0.27, 0.035], [TABLE.x - 0.52, TABLE.z + 0.3, 0.03], [TABLE.x + 0.38, TABLE.z - 0.26, 0.045], [TABLE.x + 0.66, TABLE.z - 0.05, 0.028], [TABLE.x - 0.2, TABLE.z + 0.33, 0.033], [TABLE.x + 0.05, TABLE.z - 0.3, 0.04]] });
    addTableWear(mat.benchTop, { cx: BENCH.x, cz: BENCH.z + 0.06, hw: 1.25, hd: 0.36, desat: 0.15, scorch: [-1.9, BENCH.z + 0.23, 0.09], rings: [[-1.45, BENCH.z + 0.28, 0.04], [-0.5, BENCH.z + 0.3, 0.035]] });
    addDust(mat.labTop, { amount: 0.45, scale: 0.3, threshold: 0.7, clean: [[PLATE.x, PLATE.z, 0.42], [TABLE.x + 0.1, TABLE.z + 0.26, 0.25]] });
    addDust(mat.benchFrame, { amount: 0.6, scale: 0.4, threshold: 0.7 });
    addDust(mat.timber, { amount: 0.9, scale: 0.8, threshold: 0.35, color: [0.42, 0.4, 0.37] });
    addDust(mat.timberDark, { amount: 0.85, scale: 0.8, threshold: 0.35, color: [0.42, 0.4, 0.37] });
    addDust(mat.crate, { amount: 0.6, scale: 0.3, threshold: 0.7 });
    addDust(mat.trunk, { amount: 0.55, scale: 0.3, threshold: 0.6 });
    addDust(mat.labFrame, { amount: 0.4, scale: 0.3, threshold: 0.7 });
    addDust(mat.floor, { amount: 0.42, scale: 1.1, threshold: 0.6, color: [0.3, 0.28, 0.25], clean: [[TABLE.x, TABLE.z + 0.4, 1.5], [-1.4, 0.4, 1.2], [-1.3, BENCH.z + 0.9, 0.9], [0.4, 2.4, 1.2]] });
    mat.floor.color.setScalar(1.45);
    mat.linen.vertexColors = true; mat.linen.color.setRGB(0.74, 0.72, 0.68); mat.linen.metalnessMap = null;
    mat.horse = mat.horseWood;
    // notebook pages: Stauf's notes on the game, a hex lattice sketched in ink
    mat.pages = new THREE.MeshStandardMaterial({ roughness: 0.85, name: 'pages', side: THREE.DoubleSide, map: ctx.textures.canvas('attic:pages', 1024, 768, (g2, w, h) => {
      g2.fillStyle = '#cbbd9c'; g2.fillRect(0, 0, w, h);
      const vg = g2.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.9); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(90,60,20,0.35)'); g2.fillStyle = vg; g2.fillRect(0, 0, w, h);
      g2.fillStyle = 'rgba(60,40,20,0.25)'; g2.fillRect(w / 2 - 6, 0, 12, h);
      g2.strokeStyle = 'rgba(80,90,110,0.22)'; g2.lineWidth = 1; for (let y = 60; y < h - 30; y += 26) { g2.beginPath(); g2.moveTo(24, y); g2.lineTo(w / 2 - 20, y); g2.moveTo(w / 2 + 20, y); g2.lineTo(w - 24, y); g2.stroke(); }
      let sd = 5; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      g2.strokeStyle = 'rgba(30,20,15,0.85)'; g2.lineWidth = 1.6;
      const scrawl = (x0, y0, x1) => { let x = x0; g2.beginPath(); g2.moveTo(x, y0); while (x < x1) { const wd = 6 + rnd() * 26; for (let k = 0; k < wd; k += 3) { g2.lineTo(x + k, y0 - 2 - Math.abs(Math.sin((x + k) * 0.9)) * (4 + rnd() * 5)); g2.lineTo(x + k + 1.5, y0); } x += wd + 8; g2.moveTo(x, y0); } g2.stroke(); };
      for (let y = 84; y < h - 40; y += 26) { if (y > 300 && y < 560) continue; scrawl(40, y, w / 2 - 40 - rnd() * 80); }
      for (let y = 84; y < h - 40; y += 26) scrawl(w / 2 + 40, y, w - 40 - rnd() * 100);
      // hex sketch on the left page
      const hx = (cx, cy, r) => { g2.beginPath(); for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2; g2.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g2.stroke(); };
      g2.lineWidth = 1.3;
      for (let q = -2; q <= 2; q++) for (let r2 = -2; r2 <= 2; r2++) { if (Math.abs(q + r2) > 2) continue; const cx = 250 + q * 33, cy = 430 + (r2 + q / 2) * 38; hx(cx, cy, 21); if ((q * 3 + r2 * 5) % 4 === 0) { g2.fillStyle = (q + r2) % 2 ? 'rgba(30,60,140,0.7)' : 'rgba(60,110,30,0.7)'; g2.beginPath(); g2.arc(cx, cy, 11, 0, Math.PI * 2); g2.fill(); } }
      g2.fillStyle = 'rgba(15,10,10,0.75)'; g2.beginPath(); g2.ellipse(820, 560, 22, 15, 0.4, 0, Math.PI * 2); g2.fill();
      for (let k = 0; k < 7; k++) { g2.beginPath(); g2.arc(820 + Math.cos(k) * 34, 560 + Math.sin(k * 1.3) * 26, 2 + rnd() * 4, 0, Math.PI * 2); g2.fill(); }
    }, { tile: false }) });
    // tops with painted bands, alphabet blocks
    {
      const bands = ctx.textures.canvas('attic:topbands', 64, 256, (g2, w, h) => { const cols = ['#7a1010', '#d8c8a0', '#16306e', '#b08a30', '#d8c8a0', '#7a1010', '#1f4a24', '#d8c8a0']; for (let i = 0; i < 8; i++) { g2.fillStyle = cols[i]; g2.fillRect(0, (i * h) / 8, w, h / 8 + 1); } });
      mat.topBands = paint(0xffffff, { map: bands, name: 'topBands' });
      mat.blocks = ['S', 'T', 'A', 'U', 'F', '7'].map((ch, i) => {
        const t = ctx.textures.canvas(`attic:block${ch}`, 128, 128, (g2, w, h) => {
          const bg = ['#c8b48a', '#8a1a14', '#1a3a6a', '#c8b48a', '#2a4a24', '#b08a30'][i];
          g2.fillStyle = bg; g2.fillRect(0, 0, w, h);
          g2.strokeStyle = 'rgba(0,0,0,0.5)'; g2.lineWidth = 8; g2.strokeRect(6, 6, w - 12, h - 12);
          g2.fillStyle = i % 3 === 0 ? '#5a1010' : '#e8dcc0'; g2.font = 'bold 84px serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(ch, w / 2, h / 2 + 4);
        });
        return paint(0xffffff, { map: t, roughness: 0.6, clearcoat: 0.3, name: `block${ch}` });
      });
    }

    // ================================================================ floor (with the stairwell)
    {
      const s = new THREE.Shape();
      s.moveTo(X0, -Z1); s.lineTo(X1, -Z1); s.lineTo(X1, -Z0); s.lineTo(X0, -Z0); s.lineTo(X0, -Z1);
      const hole = new THREE.Path();
      hole.moveTo(STAIR.x0, -STAIR.z1); hole.lineTo(STAIR.x0, -STAIR.z0); hole.lineTo(STAIR.x1, -STAIR.z0); hole.lineTo(STAIR.x1, -STAIR.z1); hole.lineTo(STAIR.x0, -STAIR.z1);
      s.holes.push(hole);
      const fg = new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
      const floor = add(new THREE.Mesh(fg, mat.floor)); floor.name = 'floor';
      // trimmer joists round the well
      add(new THREE.Mesh(orient(beam(G, 0.08, 0.2, STAIR.z1 - STAIR.z0 + 0.08), V3(STAIR.x1 + 0.04, -0.1, (STAIR.z0 + STAIR.z1) / 2), V3(0, 0, 1), V3(0, 1, 0)), mat.timberDark));
      add(new THREE.Mesh(orient(beam(G, 0.08, 0.2, STAIR.x1 - STAIR.x0 + 0.16), V3((STAIR.x0 + STAIR.x1) / 2, -0.1, STAIR.z0 - 0.04), V3(1, 0, 0), V3(0, 1, 0)), mat.timberDark));
      // well walls (lath and plaster going down into the dark)
      const D = 2.6;
      add(new THREE.Mesh(quad(V3(STAIR.x1, -D, STAIR.z1), V3(STAIR.x1, -D, STAIR.z0), V3(STAIR.x1, 0, STAIR.z0), V3(STAIR.x1, 0, STAIR.z1)), mat.lath));
      add(new THREE.Mesh(quad(V3(STAIR.x0, -D, STAIR.z0), V3(STAIR.x0, -D, STAIR.z1), V3(STAIR.x0, 0, STAIR.z1), V3(STAIR.x0, 0, STAIR.z0)), mat.lath));
      add(new THREE.Mesh(quad(V3(STAIR.x1, -D, STAIR.z0), V3(STAIR.x0, -D, STAIR.z0), V3(STAIR.x0, 0, STAIR.z0), V3(STAIR.x1, 0, STAIR.z0)), mat.lath));
      // treads + risers descending toward the front
      const n = Math.floor((STAIR.z1 - STAIR.z0) / STAIR.run);
      for (let i = 0; i < n; i++) {
        const y = -(i + 1) * STAIR.rise, z = STAIR.z0 + i * STAIR.run;
        add(at(new THREE.Mesh(bevelBox(G, STAIR.x1 - STAIR.x0, 0.035, STAIR.run + 0.03, 0.006), mat.benchFrame), (STAIR.x0 + STAIR.x1) / 2, y - 0.0175, z + STAIR.run / 2 + 0.015));
        add(new THREE.Mesh(quad(V3(STAIR.x0, y - STAIR.rise, z + 0.002), V3(STAIR.x1, y - STAIR.rise, z + 0.002), V3(STAIR.x1, y, z + 0.002), V3(STAIR.x0, y, z + 0.002)), mat.timberDark));
      }
      // balustrade along the open side
      const rx = STAIR.x1 + 0.05;
      const newel = G.latheFromProfile([[0, 0], [0.055, 0], [0.055, 0.85], [0.06, 0.88], [0.06, 0.95], [0.04, 0.97], [0.045, 1.0], [0.03, 1.04], [0.042, 1.08], [0, 1.13]], 4);
      for (const z of [STAIR.z0 - 0.04, STAIR.z1 - 0.06]) { const nw = add(at(new THREE.Mesh(newel, mat.timberDark), rx, 0, z)); nw.rotation.y = Math.PI / 4; }
      const rail = add(new THREE.Mesh(orient(bevelBox(G, 0.07, 0.06, STAIR.z1 - STAIR.z0, 0.012), V3(rx, 0.95, (STAIR.z0 + STAIR.z1) / 2 - 0.05), V3(0, 0, 1), V3(0, 1, 0)), mat.timberDark));
      void rail;
      add(new THREE.Mesh(orient(bevelBox(G, 0.06, 0.04, STAIR.z1 - STAIR.z0, 0.008), V3(rx, 0.07, (STAIR.z0 + STAIR.z1) / 2 - 0.05), V3(0, 0, 1), V3(0, 1, 0)), mat.timberDark));
      const bal = G.latheFromProfile([[0, 0], [0.024, 0], [0.024, 0.07], [0.016, 0.09], [0.02, 0.11], [0.032, 0.22], [0.036, 0.3], [0.028, 0.4], [0.015, 0.52], [0.012, 0.6], [0.018, 0.66], [0.014, 0.7], [0.022, 0.73], [0.022, 0.8], [0, 0.8]], 14);
      for (let z = STAIR.z0 + 0.12; z < STAIR.z1 - 0.12; z += 0.16) {
        const b = add(at(new THREE.Mesh(bal, mat.timberDark), rx, 0.09, z));
        if (Math.abs(z - 2.9) < 0.07) { b.rotation.z = 0.5; b.position.y = 0.2; b.position.x += 0.18; }   // one broken baluster
      }
    }

    // ================================================================ roof: sarking, rafters, purlins, ridge, trusses
    const sideU = (s) => V3(-s * Math.cos(SLOPE), Math.sin(SLOPE), 0);             // eave -> ridge, s = -1 left, +1 right
    const sideN = (s) => V3(s * Math.sin(SLOPE) * -1, -Math.cos(SLOPE), 0).multiplyScalar(1);   // inward (down into the room)
    {
      // sarking: individual sawn boards laid across the rafters, each its own tone and grain, with gaps
      // between them; above the boards a dim backing where the slates have slipped lets thin lines of
      // night through, so the underside of the roof is never a flat dark plane
      const boardTex = sarkBoardTexture(ctx.textures);
      mat.sarkBoard = pbr(boardTex.withRepeat(1 / 2.4, 1 / 0.2), { name: 'sarkBoard', envMapIntensity: 0.15, vertexColors: true });
      mat.sarkBoard.metalnessMap = null; mat.sarkBoard.metalness = 0;
      addDust(mat.sarkBoard, { amount: 0.25, scale: 0.6, threshold: -0.95, color: [0.3, 0.29, 0.27] });
      {
        let sd = 11; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
        const geos = [];
        const nailPos = [];
        const zsR = []; for (let z = Z0 + 0.12; z <= Z1 - 0.1; z += RAFTER.step) zsR.push(z + RAFTER.w / 2);
        for (const s2 of [-1, 1]) {
          const u = sideU(s2), n = sideN(s2);
          let along = 0.0;
          while (along < SLOPE_LEN - 0.02) {
            const bw = Math.min(0.15 + rnd() * 0.07, SLOPE_LEN - along);
            const gap = 0.004 + rnd() * rnd() * 0.012;
            // boards run in 2-3 lengths with butt joints on rafter lines
            const joints = [Z0]; let zc = Z0; while (true) { zc += RAFTER.step * (4 + Math.floor(rnd() * 8)); if (zc > Z1 - 0.8) break; joints.push(zc + 0.12 + RAFTER.w / 2); } joints.push(Z1);
            for (let j = 0; j < joints.length - 1; j++) {
              const za = joints[j] + 0.002, zb = joints[j + 1] - 0.002, L = zb - za;
              const th = 0.019 + rnd() * 0.004;
              const bg = new THREE.BoxGeometry(bw - gap, th, L, 1, 1, 1);
              // uv: u along the board (metres, random offset), v across (0..bw)
              const pp = bg.attributes.position, uvA = bg.attributes.uv;
              const ou = rnd() * 2.4, ov = rnd() * 0.03;
              for (let i = 0; i < pp.count; i++) uvA.setXY(i, pp.getZ(i) + L / 2 + ou, (pp.getX(i) + bw / 2) + ov);
              const tone = 0.75 + rnd() * 0.45, warm = 0.95 + rnd() * 0.1;
              const colA = new Float32Array(pp.count * 3); for (let i = 0; i < pp.count; i++) { colA[i * 3] = tone * warm; colA[i * 3 + 1] = tone; colA[i * 3 + 2] = tone * (2 - warm); }
              bg.setAttribute('color', new THREE.BufferAttribute(colA, 3));
              // slight cupping/tilt per board
              bg.rotateZ((rnd() - 0.5) * 0.04);
              const ctr = V3(s2 * HALF, KNEE, (za + zb) / 2).addScaledVector(u, along + bw / 2).addScaledVector(n, -th / 2 + 0.002);
              const X = u.clone(), Y = n.clone().negate(), Z = new THREE.Vector3().crossVectors(X, Y);
              const m4 = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(ctr);
              bg.applyMatrix4(m4);
              geos.push(bg);
              // two cut nails into every rafter the board crosses
              for (const zr of zsR) if (zr > za + 0.03 && zr < zb - 0.03) for (const f of [0.28, 0.72]) nailPos.push(V3(s2 * HALF, KNEE, zr + (rnd() - 0.5) * 0.02).addScaledVector(u, along + bw * f).addScaledVector(n, 0.003));
            }
            along += bw;
          }
        }
        const merged = G.mergeGeometries(geos.map((q) => q.index ? q.toNonIndexed() : q), false);
        const sk = add(new THREE.Mesh(merged, mat.sarkBoard)); sk.name = 'sarking';
        // nail heads
        const nailG = new THREE.CylinderGeometry(0.006, 0.0065, 0.004, 6);
        const nails = new THREE.InstancedMesh(nailG, new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.8, metalness: 0.4, name: 'sarkNail' }), nailPos.length);
        const mm = new THREE.Matrix4(), qq = new THREE.Quaternion();
        nailPos.forEach((q, i) => { const s2 = q.x < 0 ? -1 : 1; qq.setFromUnitVectors(V3(0, 1, 0), sideN(s2).negate()); mm.compose(q, qq, V3(1, 1, 1)); nails.setMatrixAt(i, mm); });
        nails.userData.noShadow = true; add(nails);
        // the backing: slate undersides, almost black, with a few places where the night shows through
        const leakTex = ctx.textures.canvas('attic:roofleak', 512, 256, (g2, w, h) => {
          g2.fillStyle = '#000'; g2.fillRect(0, 0, w, h);
          let sd2 = 5; const r2 = () => { sd2 = (sd2 * 16807) % 2147483647; return sd2 / 2147483647; };
          for (let i = 0; i < 70; i++) { const x = r2() * w, y = r2() * h, rr = 6 + r2() * 40; const gr = g2.createRadialGradient(x, y, 0, x, y, rr); const k = 0.15 + r2() * r2() * 0.85; gr.addColorStop(0, `rgba(255,255,255,${k})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = gr; g2.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
        }, { tile: true });
        const leakMat = new THREE.MeshBasicMaterial({ map: leakTex, color: new THREE.Color(0.1, 0.13, 0.24), name: 'roofLeak', side: THREE.DoubleSide });
        for (const s2 of [-1, 1]) {
          const lift = sideN(s2).multiplyScalar(-0.03);
          const e0 = V3(s2 * HALF, KNEE, Z0 + 0.2).add(lift), e1 = V3(s2 * HALF, KNEE, Z1 - 0.2).add(lift), r0 = V3(0, RIDGE, Z0 + 0.2).add(lift), r1 = V3(0, RIDGE, Z1 - 0.2).add(lift);
          const lg = s2 < 0 ? quad(e1, e0, r0, r1, 0.3, 0.6) : quad(e0, e1, r1, r0, 0.3, 0.6);
          const lm = add(new THREE.Mesh(lg, leakMat)); lm.userData.noShadow = true; lm.name = 'roofLeak';
          // a solid outer skin behind it so the moon spot can never leak in
          const f0 = V3(s2 * HALF, KNEE, Z0 - 0.4), f1 = V3(s2 * HALF, KNEE, Z1 + 0.2), q0 = V3(0, RIDGE + 0.02, Z0 - 0.4), q1 = V3(0, RIDGE + 0.02, Z1 + 0.2);
          const og = s2 < 0 ? quad(f1, f0, q0, q1) : quad(f0, f1, q1, q0);
          const outer = add(new THREE.Mesh(og, new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, name: 'roofSkin' })));
          outer.position.addScaledVector(sideN(s2), -0.06); outer.name = 'sarking';
        }
      }
      // common rafters: hewn, each with its own chamfers, sag and roll
      const zs = [];
      for (let z = Z0 + 0.12; z <= Z1 - 0.1; z += RAFTER.step) zs.push(z);
      let bseed = 1;
      for (const s of [-1, 1]) {
        const u = sideU(s), n = sideN(s);
        for (const z of zs) {
          const len = SLOPE_LEN + 0.05;
          const mid = V3(s * HALF / 2, KNEE + RISE / 2, z).addScaledVector(n, RAFTER.d / 2);
          const k = Math.round(z * 10);
          add(new THREE.Mesh(orient(hewnBeam(G, RAFTER.w, RAFTER.d, len, { seed: bseed++, sag: 0.006 + (k % 4) * 0.004, ch: 0.02 }), mid, u, n.clone().negate()), k % 3 === 0 ? mat.timberDark : mat.timber));
        }
        // purlin under the rafters at mid-slope
        const pm = V3(s * HALF * 0.52, KNEE + RISE * 0.48, (Z0 + Z1) / 2).addScaledVector(n, RAFTER.d + 0.1);
        add(new THREE.Mesh(orient(hewnBeam(G, 0.16, 0.2, Z1 - Z0, { seed: 100 + s, sag: 0.03, ch: 0.032, wobble: 0.006 }), pm, V3(0, 0, 1), n.clone().negate()), mat.timberDark));
        // wall plate on the knee wall
        add(new THREE.Mesh(orient(hewnBeam(G, 0.16, 0.12, Z1 - Z0, { seed: 110 + s, ch: 0.02 }), V3(s * (HALF - 0.08), KNEE - 0.06, (Z0 + Z1) / 2), V3(0, 0, 1), V3(0, 1, 0)), mat.timberDark));
      }
      // ridge beam
      add(new THREE.Mesh(orient(hewnBeam(G, 0.12, 0.26, Z1 - Z0, { seed: 120, sag: 0.025, ch: 0.03, wobble: 0.005 }), V3(0, RIDGE - 0.15, (Z0 + Z1) / 2), V3(0, 0, 1), V3(0, 1, 0)), mat.timberDark));
      // king-post trusses: principal rafters, collar, king post, struts
      for (const z of TRUSS_Z) {
        for (const s of [-1, 1]) {
          const u = sideU(s), n = sideN(s);
          const mid = V3(s * HALF / 2, KNEE + RISE / 2, z + 0.11).addScaledVector(n, RAFTER.d + 0.1);
          add(new THREE.Mesh(orient(hewnBeam(G, 0.14, 0.2, SLOPE_LEN - 0.3, { seed: 130 + z * 10 + s, sag: 0.012, ch: 0.032, wobble: 0.005 }), mid, u, n.clone().negate()), mat.timberDark));
          // strut from king post foot to principal
          const a = V3(0, COLLAR_Y + 0.1, z + 0.11), b = V3(s * 1.15, roofY(1.15) - 0.55, z + 0.11);
          add(new THREE.Mesh(orient(hewnBeam(G, 0.1, 0.1, a.distanceTo(b), { seed: 140 + z * 10 + s, ch: 0.022 }), a.clone().add(b).multiplyScalar(0.5), b.clone().sub(a), V3(0, 0, 1).cross(b.clone().sub(a)).normalize()), mat.timber));
        }
        const cw = 2 * (HALF * (1 - (COLLAR_Y - KNEE) / RISE)) - 0.35;
        add(new THREE.Mesh(orient(hewnBeam(G, 0.14, 0.22, cw, { seed: 150 + z * 10, sag: 0.02, ch: 0.032, wobble: 0.005 }), V3(0, COLLAR_Y, z + 0.11), V3(1, 0, 0), V3(0, 1, 0)), mat.timberDark));
        add(new THREE.Mesh(orient(hewnBeam(G, 0.14, 0.14, RIDGE - COLLAR_Y - 0.25, { seed: 160 + z * 10, ch: 0.03 }), V3(0, (RIDGE + COLLAR_Y) / 2 - 0.12, z + 0.11), V3(0, 1, 0), V3(0, 0, 1)), mat.timber));
        // wrought-iron stirrup strap round the king-post foot, bolted through, and oak pegs through every mortice
        {
          const zc = z + 0.11;
          const strapMat = mat.strapIron;
          // U-strap: down one face of the post, under the collar, up the other face
          for (const sz of [-1, 1]) add(at(new THREE.Mesh(bevelBox(G, 0.05, 0.42, 0.007, 0.002), strapMat), 0, COLLAR_Y + 0.08, zc + sz * 0.074));
          add(at(new THREE.Mesh(bevelBox(G, 0.05, 0.007, 0.155, 0.002), strapMat), 0, COLLAR_Y - 0.114, zc));
          for (const y of [COLLAR_Y + 0.0, COLLAR_Y + 0.2]) for (const sz of [-1, 1]) {
            const bolt = add(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 6).rotateX(Math.PI / 2), strapMat)); bolt.position.set(0, y, zc + sz * 0.08);
          }
          // pegs: collar to principals, struts to post
          for (const s2 of [-1, 1]) {
            const px = s2 * (cw / 2 - 0.06);
            for (const dy of [-0.04, 0.05]) { const pg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.16, 10).rotateX(Math.PI / 2), mat.peg)); pg.position.set(px, COLLAR_Y + dy, zc); }
            const pg2 = add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.011, 0.16, 10).rotateX(Math.PI / 2), mat.peg)); pg2.position.set(s2 * 0.0, COLLAR_Y + 0.32, zc); pg2.position.x = s2 * 0.035;
          }
          // ridge joint: a bolted fish-plate where the post meets the ridge beam
          for (const sz of [-1, 1]) add(at(new THREE.Mesh(bevelBox(G, 0.1, 0.24, 0.008, 0.002), strapMat), 0, RIDGE - 0.32, zc + sz * 0.074));
        }
      }
      // lighter collar ties between the trusses
      for (const z of zs) {
        if (TRUSS_Z.some((t) => Math.abs(t - z) < 0.5) || Math.round((z - Z0) / RAFTER.step) % 2 || z < Z0 + 0.6 || z > Z1 - 0.6) continue;
        const y = 3.05;
        const w = 2 * (HALF * (1 - (y - KNEE) / RISE)) - 0.25;
        add(new THREE.Mesh(orient(hewnBeam(G, 0.06, 0.14, w, { seed: 170 + z * 10, sag: 0.015, ch: 0.016 }), V3(0, y, z + RAFTER.w / 2 + 0.03), V3(1, 0, 0), V3(0, 1, 0)), mat.timber));
      }
      // knee walls: vertical boards
      for (const s of [-1, 1]) {
        const x = s * (HALF - 0.005);
        const g = s < 0 ? quad(V3(x, 0, Z1), V3(x, 0, Z0), V3(x, KNEE, Z0), V3(x, KNEE, Z1)) : quad(V3(x, 0, Z0), V3(x, 0, Z1), V3(x, KNEE, Z1), V3(x, KNEE, Z0));
        add(new THREE.Mesh(g, mat.lath));
        for (let z = Z0 + 0.6; z < Z1; z += 1.2) add(at(new THREE.Mesh(beam(G, 0.1, KNEE, 0.1, 0.01), mat.timberDark), x - s * 0.05, KNEE / 2, z));
        // skirting board
        add(new THREE.Mesh(orient(bevelBox(G, 0.025, 0.14, Z1 - Z0, 0.004), V3(x - s * 0.012, 0.07, (Z0 + Z1) / 2), V3(0, 0, 1), V3(0, 1, 0)), mat.timberDark));
      }
    }

    // ================================================================ back gable: brick, oculus, the door
    const gable = (z, holes, matl, front) => {
      const s = new THREE.Shape();
      const pts = [V2(X0, 0)];
      if (!front) { pts.push(V2(DOOR.x0, 0), V2(DOOR.x0, DOOR.h), V2(DOOR.x1, DOOR.h), V2(DOOR.x1, 0)); }
      pts.push(V2(X1, 0), V2(X1, KNEE), V2(0, RIDGE), V2(X0, KNEE));
      s.setFromPoints(pts);
      for (const h of holes) s.holes.push(h);
      const g = new THREE.ShapeGeometry(s, 128);
      if (front) g.rotateY(Math.PI);
      g.translate(0, 0, z);
      return add(new THREE.Mesh(g, matl));
    };
    {
      const oc = new THREE.Path(); oc.absarc(OCULUS.x, OCULUS.y, OCULUS.r, 0, Math.PI * 2, true);
      gable(Z0, [oc], mat.brick, false).name = 'backGable';
      // outer skin (to block the moon everywhere but the oculus)
      const back = gable(Z0 - WALL_T, [oc.clone()], mat.brickDark, false);
      void back;
      // black mask ring behind the walls: hides hairline triangulation cracks against the bright sky card
      const mask = add(new THREE.Mesh(new THREE.RingGeometry(OCULUS.r - 0.01, 1.85, 96, 1), new THREE.MeshBasicMaterial({ color: 0x000000, name: 'skyMask' })));
      mask.position.set(OCULUS.x, OCULUS.y, Z0 - WALL_T - 0.02); mask.userData.noShadow = true;
      // a bullseye arch of rubbed-brick voussoirs round the opening, each a tapered, chamfered wedge with its own tint,
      // set proud of the wall face on a bed of lime mortar; a dressed stone keystone at the crown
      {
        const NV = 30, r0 = OCULUS.r + 0.004, r1 = OCULUS.r + 0.235, gapA = 0.0045;
        const vMats = [[0.95, 0.6, 0.46], [0.82, 0.5, 0.4], [1.0, 0.7, 0.55]].map((c, i) => { const m2 = mat.stone.clone(); m2.color = new THREE.Color(...c); m2.name = `voussoir${i}`; return m2; });
        for (let k = 0; k < NV; k++) {
          const a0 = (k / NV) * Math.PI * 2 + gapA, a1 = ((k + 1) / NV) * Math.PI * 2 - gapA;
          if (k === Math.round(NV / 4) - 1 || k === Math.round(NV / 4)) continue;   // crown: keystone goes here
          const rr1 = r1 + (k % 3 === 0 ? 0.03 : 0) - (k % 2) * 0.012;
          const sh = new THREE.Shape(); sh.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0); sh.lineTo(Math.cos(a0) * rr1, Math.sin(a0) * rr1); sh.lineTo(Math.cos(a1) * rr1, Math.sin(a1) * rr1); sh.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0); sh.lineTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
          const vg = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2 });
          const vm = add(new THREE.Mesh(G.applyBoxUVs(vg, 1 / 0.6), vMats[(k * 7) % 3]));
          vm.position.set(OCULUS.x, OCULUS.y, Z0 - 0.06 + (k % 4) * 0.002);
        }
        // keystone: a dressed stone block projecting past the voussoirs
        const ks = new THREE.Shape(); const ka = Math.PI / 2, kw0 = 0.09, kw1 = 0.075;
        ks.moveTo(-kw1, r0); ks.lineTo(-kw0, r1 + 0.06); ks.lineTo(kw0, r1 + 0.06); ks.lineTo(kw1, r0); ks.lineTo(-kw1, r0);
        const kg = new THREE.ExtrudeGeometry(ks, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 3 });
        const km = add(new THREE.Mesh(G.applyBoxUVs(kg, 1 / 0.8), mat.stone)); km.position.set(OCULUS.x, OCULUS.y, Z0 - 0.06); void ka;
        // the mortar bed behind the arch
        const mortarMat = new THREE.MeshStandardMaterial({ color: 0x5a544a, roughness: 0.95, name: 'archMortar' });
        const mb = add(new THREE.Mesh(new THREE.RingGeometry(OCULUS.r - 0.005, r1 + 0.02, 120, 1), mortarMat)); mb.position.set(OCULUS.x, OCULUS.y, Z0 + 0.003);
      }
      // projecting sill with a throated drip edge under the ring
      const sy = OCULUS.y - OCULUS.r - 0.29;
      add(at(new THREE.Mesh(bevelBox(G, 0.82, 0.065, 0.2, 0.012), mat.stone), OCULUS.x, sy, Z0 + 0.08));
      add(at(new THREE.Mesh(bevelBox(G, 0.86, 0.025, 0.21, 0.006), mat.stone), OCULUS.x, sy + 0.045, Z0 + 0.085));
      add(at(new THREE.Mesh(bevelBox(G, 0.78, 0.02, 0.025, 0.004), mat.stone), OCULUS.x, sy - 0.04, Z0 + 0.165));
      // reveal (deep brick barrel)
      const revMat = pbr(brickTex.withRepeat((Math.PI * 2 * OCULUS.r) / 1.8, WALL_T / 1.8), { name: 'brickReveal', side: THREE.BackSide, envMapIntensity: 0.2, color: 0x8a8080 });
      const rev = new THREE.Mesh(new THREE.CylinderGeometry(OCULUS.r, OCULUS.r, WALL_T, 64, 1, true), revMat);
      rev.rotation.x = Math.PI / 2; rev.position.set(OCULUS.x, OCULUS.y, Z0 - WALL_T / 2); add(rev);
      // one cast-iron window, set a third of the way into the reveal: a flat-banded outer frame with a fillet,
      // an inner ring and eight glazing bars of the same section (chamfered, so they catch a line of moon)
      const wz = Z0 - WALL_T * 0.4;
      const band = (rIn, rOut, d, ch) => {
        const pr = [V2(rIn + ch, -d / 2), V2(rOut - ch, -d / 2), V2(rOut, -d / 2 + ch), V2(rOut, d / 2 - ch), V2(rOut - ch, d / 2), V2(rIn + ch, d / 2), V2(rIn, d / 2 - ch), V2(rIn, -d / 2 + ch), V2(rIn + ch, -d / 2)];
        const m2 = new THREE.Mesh(new THREE.LatheGeometry(pr, 128), mat.castIron); m2.rotation.x = Math.PI / 2; m2.position.set(OCULUS.x, OCULUS.y, wz); m2.castShadow = true; return add(m2);
      };
      band(OCULUS.r - 0.055, OCULUS.r + 0.002, 0.05, 0.006);
      band(OCULUS.r - 0.075, OCULUS.r - 0.05, 0.03, 0.004);   // glazing rebate fillet
      band(0.185, 0.215, 0.034, 0.005);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const L = OCULUS.r - 0.07 - 0.2;
        const sp = add(new THREE.Mesh(bevelBox(G, L, 0.024, 0.032, 0.005), mat.castIron));
        sp.position.set(OCULUS.x + Math.cos(a) * (0.2 + L / 2), OCULUS.y + Math.sin(a) * (0.2 + L / 2), wz);
        sp.rotation.z = a;
      }
      // a small iron catch and its hinge pin at the frame's foot (the window opens on a pivot)
      add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 12).rotateX(Math.PI / 2), mat.blackEnamel), OCULUS.x, OCULUS.y - OCULUS.r + 0.02, wz + 0.01));
      add(at(new THREE.Mesh(bevelBox(G, 0.05, 0.016, 0.012, 0.003), mat.iron), OCULUS.x + 0.03, OCULUS.y - OCULUS.r + 0.07, wz + 0.03));
      // grimy glass with one broken pane, dirt banked against the frame, a cracked pane, rain runs
      const glassMat = M.create('glass', { dirt: 0.75, transparent: true, opacity: 0.14 });
      const shape = new THREE.Shape(); shape.absarc(0, 0, OCULUS.r - 0.02, 0, Math.PI * 2);
      const brk = new THREE.Path(); const a0 = Math.PI * 1.15;
      brk.moveTo(Math.cos(a0) * 0.22, Math.sin(a0) * 0.22); brk.lineTo(Math.cos(a0) * 0.5, Math.sin(a0) * 0.5); brk.lineTo(Math.cos(a0 + 0.35) * 0.38, Math.sin(a0 + 0.35) * 0.38); brk.lineTo(Math.cos(a0 + 0.55) * 0.26, Math.sin(a0 + 0.55) * 0.26);
      shape.holes.push(brk);
      const glassGeo = new THREE.ShapeGeometry(shape, 48);
      { const uv = glassGeo.attributes.uv, ps = glassGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + ps.getX(i) / (2 * (OCULUS.r - 0.02)), 0.5 + ps.getY(i) / (2 * (OCULUS.r - 0.02))); }
      const gl = add(new THREE.Mesh(glassGeo, glassMat)); gl.position.set(OCULUS.x, OCULUS.y, wz + 0.005); gl.userData.noShadow = true; gl.userData.noBake = true;
      const grimeMat = new THREE.MeshBasicMaterial({ map: oculusGrimeTexture(ctx.textures), transparent: true, depthWrite: false, color: new THREE.Color(0.5, 0.5, 0.53), name: 'oculusGrime' });
      const grime = add(new THREE.Mesh(glassGeo, grimeMat)); grime.position.set(OCULUS.x, OCULUS.y, wz + 0.007); grime.userData.noShadow = true; grime.userData.noBake = true; grime.renderOrder = 3;
    }
    // sky beyond the oculus: the moon set on the line of sight from the main viewpoint
    const skyTex = moonSkyTexture(ctx.textures);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex.map, color: new THREE.Color(1, 1, 1).multiplyScalar(1.0), toneMapped: false, name: 'sky' });
    {
      const card = add(new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), skyMat));
      card.position.set(-0.55, 3.19, Z0 - 2.5); card.userData.noShadow = true; card.name = 'skycard';
    }
    // the full moon, close behind the glazing so that from the attic floor and the bench alike it sits in the window, crossed by the bars
    const moonMat = new THREE.MeshBasicMaterial({ map: moonDiscTexture(ctx.textures).map, transparent: true, alphaTest: 0.02, depthWrite: false, toneMapped: false, color: new THREE.Color(0.82, 0.86, 0.95), name: 'moonDisc', fog: false });
    const moonDisc = add(new THREE.Mesh(new THREE.CircleGeometry(0.2, 64), moonMat));
    { const uv = moonDisc.geometry.attributes.uv, ps = moonDisc.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + ps.getX(i) / 0.4, 0.5 + ps.getY(i) / 0.4); }
    moonDisc.position.set(-0.46, 2.99, Z0 - WALL_T * 0.55 - 0.5); moonDisc.lookAt(-0.5, 1.55, 0.0); moonDisc.userData.noShadow = true; moonDisc.renderOrder = -2;
    // a cold halo round it
    const haloTex = ctx.textures.canvas('attic:moonhalo', 256, 256, (g2, w, h) => { const rg = g2.createRadialGradient(w / 2, h / 2, w * 0.17, w / 2, h / 2, w / 2); rg.addColorStop(0, 'rgba(255,255,255,0.55)'); rg.addColorStop(0.3, 'rgba(255,255,255,0.14)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = rg; g2.fillRect(0, 0, w, h); }, { tile: false });
    const halo = add(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.4, 0.46, 0.66), toneMapped: false, name: 'moonHalo' })));
    halo.position.copy(moonDisc.position).add(V3(0, 0, -0.02)); halo.quaternion.copy(moonDisc.quaternion); halo.userData.noShadow = true; halo.renderOrder = -3;
    moonMat.color.setRGB(0.78, 0.86, 1.08);
    // two thin cloud layers drifting across the moon at different speeds, their edges silvered where they cross it
    {
      const layers = [[1, 0.9, 0.012, 0.25], [2, 0.55, -0.007, 0.18]];
      for (const [sd, op, speed, dz] of layers) {
        const ct = cloudWispTexture(ctx.textures, sd).map.clone(); ct.needsUpdate = true; ct.wrapS = THREE.RepeatWrapping;
        const cm = new THREE.MeshBasicMaterial({ map: ct, alphaMap: null, transparent: true, depthWrite: false, opacity: op, toneMapped: false, fog: false, color: new THREE.Color(0.16, 0.19, 0.28), name: `cloudLayer${sd}` });
        cm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          { vec2 cuv = vMapUv; float md = length((cuv - vec2(0.5)) * vec2(2.0, 1.0)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.8, 0.95), exp(-md * 3.5) * (1.0 - sampledDiffuseColor.a) * 1.2 + exp(-md * 6.0) * 0.5); diffuseColor.a = sampledDiffuseColor.a * opacity; }`); };
        const cl = add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), cm));
        cl.position.copy(moonDisc.position).addScaledVector(V3(-0.46, 2.99, Z0 - WALL_T * 0.55 - 0.5).sub(V3(-0.5, 1.55, 0)).normalize(), -0.0).add(V3(0.02, -0.04, dz));
        cl.quaternion.copy(moonDisc.quaternion); cl.userData.noShadow = true; cl.renderOrder = -1;
        ctx.onUpdate((dt, t) => { ct.offset.x = 0.31 * sd + t * speed; });
      }
    }

    // ---------------------------------------------------------------- the door, ajar on a glowing stair
    const doorPivot = dyn(new THREE.Group());
    {
      const W = DOOR.x1 - DOOR.x0;
      // linings + head (painted oak, flaking), filling the reveal; a moulded architrave on plinth blocks round the opening
      const peel = peelingPaintTexture(ctx.textures);
      mat.peel = pbr(peel.withRepeat(1 / 0.6, 1 / 0.6), { name: 'peelPaint', envMapIntensity: 0.3, metalness: 0 });
      mat.peel.metalnessMap = null;
      add(at(new THREE.Mesh(beam(G, 0.12, DOOR.h + 0.12, WALL_T + 0.005, 0.004), mat.peel), DOOR.x0 - 0.06, (DOOR.h + 0.12) / 2, Z0 - WALL_T / 2 + 0.0));
      add(at(new THREE.Mesh(beam(G, 0.12, DOOR.h + 0.12, WALL_T + 0.005, 0.004), mat.peel), DOOR.x1 + 0.06, (DOOR.h + 0.12) / 2, Z0 - WALL_T / 2 + 0.0));
      add(at(new THREE.Mesh(beam(G, W + 0.36, 0.16, WALL_T + 0.005, 0.004), mat.peel), (DOOR.x0 + DOOR.x1) / 2, DOOR.h + 0.08, Z0 - WALL_T / 2 + 0.0));
      add(at(new THREE.Mesh(bevelBox(G, W + 0.2, 0.04, WALL_T + 0.08, 0.008), mat.timberDark), (DOOR.x0 + DOOR.x1) / 2, 0.02, Z0 - WALL_T / 2 + 0.04));
      {
        // ogee-and-bead architrave profile: x = toward the opening, y = proud of the wall
        const pr = [[-0.125, 0.0], [-0.125, 0.012], [-0.118, 0.016], [-0.11, 0.017], [-0.1, 0.022], [-0.088, 0.03], [-0.074, 0.034], [-0.062, 0.031], [-0.054, 0.025], [-0.046, 0.024], [-0.04, 0.028], [-0.034, 0.03], [-0.028, 0.027], [-0.022, 0.022], [-0.012, 0.02], [-0.004, 0.017], [0.0, 0.012], [0.0, 0.0]].map(([x, y]) => V2(x, y));
        const PB = 0.24;   // plinth block height
        const path = [V3(DOOR.x0, PB, Z0), V3(DOOR.x0, DOOR.h, Z0), V3(DOOR.x1, DOOR.h, Z0), V3(DOOR.x1, PB, Z0)];
        const arch = add(new THREE.Mesh(G.sweepProfile(pr, path, { closed: false, up: V3(0, 0, 1), uvScale: 1 / 0.6 }), mat.peel)); arch.name = 'architrave';
        for (const x of [DOOR.x0 - 0.0625, DOOR.x1 + 0.0625]) add(at(new THREE.Mesh(bevelBox(G, 0.14, PB, 0.04, 0.006), mat.peel), x, PB / 2, Z0 + 0.02));
        // a carved head block over the opening: corner rosettes
        for (const x of [DOOR.x0 - 0.0625, DOOR.x1 + 0.0625]) {
          add(at(new THREE.Mesh(bevelBox(G, 0.135, 0.135, 0.036, 0.006), mat.peel), x, DOOR.h + 0.0625, Z0 + 0.018));
          const ros = add(new THREE.Mesh(G.latheFromProfile([[0, 0.012], [0.02, 0.011], [0.03, 0.006], [0.042, 0.008], [0.046, 0.0]], 24), mat.peel));
          ros.rotation.x = Math.PI / 2; ros.position.set(x, DOOR.h + 0.0625, Z0 + 0.036 + 0.012);
        }
      }
      // leaf: a four-panel door, stiles and rails with a centre muntin, raised and fielded panels, a brass
      // escutcheon with its keyhole, a drop ring pull, three iron butt hinges; the paint long gone to bare oak
      const leaf = new THREE.Group();
      const lw = W - 0.02, lh = DOOR.h - 0.03, T = 0.042;
      const SW = 0.11, TR = 0.11, LR = 0.17, BR = 0.2, MU = 0.085, LY = 0.95;
      const part = (w2, h2, x, y, z = 0, d = T) => leaf.add(at(new THREE.Mesh(bevelBox(G, w2, h2, d, 0.005), mat.door), x, y, z));
      part(SW, lh, -lw + SW / 2, lh / 2 + 0.01); part(SW, lh, -SW / 2, lh / 2 + 0.01);
      part(lw - 2 * SW, TR, -lw / 2, lh - TR / 2 + 0.01); part(lw - 2 * SW, LR, -lw / 2, LY); part(lw - 2 * SW, BR, -lw / 2, BR / 2 + 0.01);
      const cells = [[LY + LR / 2, lh - TR + 0.01], [BR + 0.01, LY - LR / 2]];
      const pw2 = (lw - 2 * SW - MU) / 2;
      for (const [y0, y1] of cells) for (const side of [0, 1]) {
        const ph = y1 - y0;
        const pg = G.raisedPanel(pw2 + 0.01, ph + 0.01, { border: 0.018, fieldDepth: 0.008, frameDepth: 0.012, bevel: 0.035 });
        const pm2 = new THREE.Mesh(pg, mat.door);
        pm2.position.set(-lw + SW + pw2 / 2 + side * (pw2 + MU), (y0 + y1) / 2, -0.012);
        leaf.add(pm2);
      }
      for (const [y0, y1] of cells) leaf.add(at(new THREE.Mesh(bevelBox(G, MU, y1 - y0, T * 0.9, 0.005), mat.door), -lw / 2, (y0 + y1) / 2, 0));
      // escutcheon + keyhole, ring pull on a rose
      const escX = -lw + SW / 2, escY = LY - 0.02;
      const esc = new THREE.Shape(); esc.moveTo(0, 0.045); esc.quadraticCurveTo(0.022, 0.04, 0.02, 0.0); esc.quadraticCurveTo(0.018, -0.04, 0, -0.05); esc.quadraticCurveTo(-0.018, -0.04, -0.02, 0.0); esc.quadraticCurveTo(-0.022, 0.04, 0, 0.045);
      const kh = new THREE.Path(); kh.absarc(0, 0.008, 0.006, 0, Math.PI * 2, true); esc.holes.push(kh);
      const kh2 = new THREE.Path(); kh2.moveTo(-0.003, 0.004); kh2.lineTo(-0.0045, -0.02); kh2.lineTo(0.0045, -0.02); kh2.lineTo(0.003, 0.004); kh2.lineTo(-0.003, 0.004); esc.holes.push(kh2);
      const eg = new THREE.ExtrudeGeometry(esc, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2 });
      leaf.add(at(new THREE.Mesh(eg, mat.brass), escX, escY, T / 2 + 0.001));
      leaf.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.03), new THREE.MeshBasicMaterial({ color: 0x0a0402, name: 'keyholeDark' })), escX, escY - 0.004, T / 2 - 0.002));
      leaf.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.026, 0], [0.026, 0.004], [0.016, 0.01], [0.008, 0.016], [0, 0.018]], 20).rotateX(Math.PI / 2), mat.iron), escX, escY + 0.09, T / 2));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.0055, 8, 28), mat.iron); ring.position.set(escX, escY + 0.09 - 0.036, T / 2 + 0.014); ring.rotation.x = -0.12; leaf.add(ring);
      for (const y of [0.24, lh / 2, lh - 0.24]) {
        leaf.add(at(new THREE.Mesh(bevelBox(G, 0.05, 0.11, 0.004, 0.001), mat.iron), -0.012, y, T / 2 + 0.002));
        leaf.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.115, 10), mat.iron), 0.004, y, T / 2));
      }
      leaf.userData.lockPos = V3(escX, escY, T / 2);
      doorPivot.add(leaf);
      doorPivot.position.set(DOOR.x1 - 0.01, 0, Z0 + 0.0);
      doorPivot.rotation.y = DOOR.open;
      add(doorPivot);
      // the stair beyond: brick passage rising toward a furnace glow
      const PZ = Z0 - WALL_T, PL = 2.6;
      const pw = W + 0.1, cx = (DOOR.x0 + DOOR.x1) / 2;
      add(new THREE.Mesh(quad(V3(cx - pw / 2, 0, PZ), V3(cx - pw / 2, 0, PZ - PL), V3(cx - pw / 2, 3, PZ - PL), V3(cx - pw / 2, 3, PZ)), mat.brickDark));
      add(new THREE.Mesh(quad(V3(cx + pw / 2, 0, PZ - PL), V3(cx + pw / 2, 0, PZ), V3(cx + pw / 2, 3, PZ), V3(cx + pw / 2, 3, PZ - PL)), mat.brickDark));
      add(new THREE.Mesh(quad(V3(cx - pw / 2, 3.0, PZ), V3(cx - pw / 2, 3.0, PZ - PL), V3(cx + pw / 2, 3.0, PZ - PL), V3(cx + pw / 2, 3.0, PZ)), mat.brickDark));
      // a short landing inside the door, then the stair climbing away into the glow: treads with bullnose nosings,
      // a polished, darkened path worn up the middle, grit and plaster crumbs in the corners
      const LAND = 0.42;
      const treadMat = M.create('wood', { clearcoat: 0.0, species: 'oak', boards: 0, polish: 0.2, wear: 1.0, repeat: [1.4, 1.4], color: [0.42, 0.31, 0.22] });
      const wearMat = new THREE.MeshStandardMaterial({ color: 0x1a0f08, alphaMap: treadWearTexture(ctx.textures), transparent: true, opacity: 0.55, roughness: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, name: 'treadWear' });
      const tread = (y, zc, depth) => {
        add(at(new THREE.Mesh(bevelBox(G, pw, 0.028, depth, 0.004), treadMat), cx, y - 0.014, zc));
        const nose = add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, pw, 16).rotateZ(Math.PI / 2), treadMat)); nose.position.set(cx, y - 0.014, zc + depth / 2);
        const wr = add(new THREE.Mesh(new THREE.PlaneGeometry(pw * 0.85, depth * 0.9).rotateX(-Math.PI / 2), wearMat)); wr.position.set(cx, y + 0.0008, zc + 0.01); wr.userData.noShadow = true;
      };
      tread(0.0, PZ - LAND / 2 + 0.01, LAND + 0.02);
      for (let i = 0; i < 8; i++) {
        tread(0.18 * (i + 1), PZ - LAND - 0.15 - i * 0.26, 0.3);
        add(at(new THREE.Mesh(new THREE.BoxGeometry(pw, 0.18, 0.02), mat.timberDark), cx, 0.18 * i + 0.09, PZ - LAND - i * 0.26 - 0.004));
      }
      // grit and crumbs of fallen plaster gathered against the risers, a dropped candle stub on the third step
      {
        let sd = 31; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
        const crumbG = new THREE.IcosahedronGeometry(0.008, 0);
        const crumbMat = new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: 0.95, name: 'crumbs' });
        const crumbs = new THREE.InstancedMesh(crumbG, crumbMat, 90);
        const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler();
        for (let i = 0; i < 90; i++) {
          const step = Math.floor(rnd() * 5);
          const y = step === 0 ? 0.004 : 0.18 * step + 0.004;
          const zEdge = step === 0 ? PZ - LAND + 0.02 : PZ - LAND - 0.15 - (step - 1) * 0.26 - 0.13;
          const side = rnd() < 0.5 ? -1 : 1;
          e.set(rnd() * 3, rnd() * 3, rnd() * 3); qq.setFromEuler(e);
          const sc = 0.4 + rnd() * 1.3;
          mm.compose(V3(cx + side * (pw / 2 - 0.02 - rnd() * rnd() * 0.25), y, zEdge + rnd() * 0.08), qq, V3(sc, sc * 0.6, sc));
          crumbs.setMatrixAt(i, mm);
        }
        add(crumbs);
        const stubC = add(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.05, 14).rotateZ(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xd8ccb0, roughness: 0.6, sheen: 0.3, name: 'waxStub' }))); stubC.position.set(cx + 0.16, 0.18 * 2 + 0.012, PZ - LAND - 0.15 - 0.26 + 0.05); stubC.rotation.y = 0.5;
      }
      // the top of the stair: a brick end wall and a landing; the stair turns left out of sight toward the
      // furnace (its glow pours round the corner), and an iron brazier of coals burns on the landing
      add(new THREE.Mesh(quad(V3(cx + pw / 2, 0, PZ - PL), V3(cx - pw / 2, 0, PZ - PL), V3(cx - pw / 2, 3, PZ - PL), V3(cx + pw / 2, 3, PZ - PL)), mat.brickDark));
      const topY = 0.18 * 8, landZ0 = PZ - LAND - 0.15 - 7 * 0.26 - 0.15;
      add(at(new THREE.Mesh(bevelBox(G, pw, 0.028, landZ0 - (PZ - PL), 0.004), treadMat), cx, topY - 0.014, (landZ0 + PZ - PL) / 2));
      const hell = new THREE.MeshBasicMaterial({ map: hellGlowTexture(ctx.textures).map, color: new THREE.Color(1, 1, 1).multiplyScalar(2.6), toneMapped: false, name: 'hellglow' });
      const turnW = 0.5, turnH = 1.5;
      const hg = add(new THREE.Mesh(new THREE.PlaneGeometry(turnW, turnH), hell)); hg.rotation.y = Math.PI / 2; hg.position.set(cx - pw / 2 + 0.004, topY + turnH / 2, PZ - PL + turnW / 2 + 0.02); hg.userData.noShadow = true;
      // the reveal of that opening: a dark brick jamb catching the light edge-on
      add(at(new THREE.Mesh(bevelBox(G, 0.06, turnH + 0.05, 0.06, 0.008), mat.brickDark), cx - pw / 2 + 0.03, topY + turnH / 2, PZ - PL + turnW + 0.05));
      add(at(new THREE.Mesh(bevelBox(G, 0.06, 0.08, turnW + 0.06, 0.008), mat.brickDark), cx - pw / 2 + 0.03, topY + turnH + 0.04, PZ - PL + turnW / 2 + 0.02));
      // brazier: a hammered iron bowl on three splayed legs, a heap of coals, flames licking over the rim
      {
        const bz = new THREE.Group(); bz.position.set(cx - 0.2, topY, PZ - PL + 0.22); add(bz);
        bz.add(at(new THREE.Mesh(G.latheFromProfile([[0.0, 0.0], [0.05, 0.0], [0.12, 0.03], [0.16, 0.08], [0.17, 0.1], [0.165, 0.105], [0.15, 0.085], [0.11, 0.04], [0.0, 0.02]], 28), mat.castIron), 0, 0.3, 0));
        for (let k = 0; k < 3; k++) { const a2 = (k / 3) * Math.PI * 2; const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.34, 6), mat.castIron); lg.position.set(Math.cos(a2) * 0.1, 0.16, Math.sin(a2) * 0.1); lg.rotation.set(Math.sin(a2) * 0.35, 0, -Math.cos(a2) * 0.35); bz.add(lg); }
        const coalMat = new THREE.MeshStandardMaterial({ color: 0x120806, roughness: 0.9, emissive: new THREE.Color(1.0, 0.28, 0.05), emissiveIntensity: 2.2, name: 'coals' });
        let cs = 3; const cr = () => { cs = (cs * 16807) % 2147483647; return cs / 2147483647; };
        for (let k = 0; k < 26; k++) { const a2 = cr() * Math.PI * 2, rr2 = Math.sqrt(cr()) * 0.13; const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.02 + cr() * 0.02, 0), coalMat); c.position.set(Math.cos(a2) * rr2, 0.37 + (0.13 - rr2) * 0.4 + cr() * 0.02, Math.sin(a2) * rr2); c.rotation.set(cr() * 3, cr() * 3, 0); bz.add(c); }
        for (let k = 0; k < 4; k++) { const f = fx.flame({ height: 0.14 + 0.08 * (k % 2), width: 0.05, intensity: 4.0, seed: 40 + k }); f.position.set(Math.cos(k * 1.7) * 0.05, 0.4, Math.sin(k * 1.7) * 0.05); bz.add(f); }
        const bl = new THREE.PointLight(0xff6a24, 9, 3.2, 2); bl.position.set(cx - 0.2, topY + 0.6, PZ - PL + 0.27); root.add(bl);
        ctx.onUpdate((dt, t) => { const fl = 0.8 + 0.12 * Math.sin(t * 13.1) * Math.sin(t * 7.7 + 1.0) + 0.08 * Math.sin(t * 23.3 + 2.0); bl.intensity = 9 * fl * (1 + 0.6 * climaxK); });
      }
      // furnace smoke hanging in the stairwell, so the glow has volume instead of ending on a card
      add(fx.fog({ box: new THREE.Box3(V3(cx - pw / 2 + 0.02, 0.0, PZ - PL + 0.05), V3(cx + pw / 2 - 0.02, 2.9, PZ - 0.05)), color: 0x1a0603, litColor: 0x8a2a0c, density: 0.9, heightFalloff: 0.6 }));
      // someone waits on the landing: a tall, gaunt silhouette against the glow, beckoning
      const contactTex = ctx.textures.canvas('attic:contact', 128, 128, (g2, w, h) => {
        g2.fillStyle = '#000'; g2.fillRect(0, 0, w, h);
        const rg = g2.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.35, 'rgba(255,255,255,0.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g2.fillStyle = rg; g2.fillRect(0, 0, w, h);
      }, { tile: false });
      const fig = buildApparition(ghostMat, { shadowTex: contactTex });
      FIG.rest.set(cx + 0.02, 0.0, PZ - 0.2);
      FIG.fore.set(cx - 0.05, 0.0, Z0 + 0.45);
      fig.position.copy(FIG.rest); fig.rotation.y = 0.12; fig.scale.setScalar(0.94);
      FIG.obj = fig;
      add(dyn(fig));
      // the embers in his sockets and grin breathe slowly; they flare as the furnace takes the room
      const gl = fig.userData.glow;
      ctx.onUpdate((dt, t) => {
        const pulse = 0.78 + 0.22 * Math.sin(t * 1.7) * Math.sin(t * 0.63 + 1.1) + 0.06 * Math.sin(t * 9.1);
        const k = (0.85 + 0.6 * climaxK) * pulse;
        gl.mats.forEach((m2, i) => m2.color.copy(gl.base[i]).multiplyScalar(k));
      });
    }

    // ================================================================ front gable (stair end), chimney stack
    {
      gable(Z1, [], mat.lath, true).name = 'frontGable';
      // a small louvred vent high in the front gable
      const vy = 3.1;
      add(at(new THREE.Mesh(beam(G, 0.7, 0.5, 0.06, 0.01), mat.timberDark), 0, vy, Z1 - 0.03));
      for (let i = 0; i < 5; i++) { const l = add(at(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.012, 0.08), mat.timber), 0, vy - 0.18 + i * 0.09, Z1 - 0.07)); l.rotation.x = 0.6; }
      // the front gable wall: a peg rail of old coats, a cheval mirror leaning in the dark, shelves of jars
      const FZ = Z1 - 0.02;
      add(at(new THREE.Mesh(bevelBox(G, 1.25, 0.1, 0.025, 0.006), mat.timberDark), 0.68, 1.72, FZ - 0.0125));
      const wool = [
        new THREE.MeshPhysicalMaterial({ color: 0x1a1c18, roughness: 0.95, sheen: 0.6, sheenColor: new THREE.Color(0.25, 0.27, 0.3), side: THREE.DoubleSide, name: 'woolA' }),
        new THREE.MeshPhysicalMaterial({ color: 0x3a2a1c, roughness: 0.95, sheen: 0.5, sheenColor: new THREE.Color(0.4, 0.32, 0.25), side: THREE.DoubleSide, name: 'woolB' }),
        new THREE.MeshPhysicalMaterial({ color: 0x0e0d10, roughness: 0.9, sheen: 0.7, sheenColor: new THREE.Color(0.2, 0.2, 0.28), side: THREE.DoubleSide, name: 'woolC' }),
      ];
      const pegs = [0.15, 0.45, 0.75, 1.0, 1.22];
      pegs.forEach((x, i) => {
        add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0], [0.01, 0.06], [0.016, 0.075], [0, 0.08]], 10).rotateX(-Math.PI / 2), mat.handle), x, 1.72, FZ - 0.025));
      });
      const coat = (x, opts, m, rz = 0) => { const c = add(new THREE.Mesh(hangingCoatGeometry(opts), m)); c.position.set(x, 1.73, FZ - 0.12); c.rotation.set(0, Math.PI, rz); return c; };
      coat(0.15, { len: 1.15, width: 0.19, seed: 1 }, wool[0], 0.02);
      coat(0.45, { len: 0.95, width: 0.21, seed: 4 }, wool[1], -0.03);
      coat(1.0, { len: 1.25, seed: 7, cape: true }, wool[2], 0.01);
      // a bowler on the last peg, a scarf over the second
      const bowler = new THREE.Group();
      bowler.add(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.12, 0], [0.13, 0.008], [0.09, 0.012], [0.085, 0.07], [0.06, 0.11], [0, 0.12]], 28), wool[2]));
      bowler.position.set(1.22, 1.64, FZ - 0.16); bowler.rotation.set(-1.35, 0, 0.2); add(bowler);
      // cheval mirror leaning on the wall, its glass grey with dust
      const cm = new THREE.Group();
      cm.add(new THREE.Mesh(G.frameGeometry(0.62, 1.55, { width: 0.06, depth: 0.04 }), mat.frameDark));
      const glassDust = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.38, metalness: 1.0, envMapIntensity: 0.8, name: 'dustyMirror' });
      const mg = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 1.45), glassDust); mg.position.z = 0.008; cm.add(mg);
      cm.position.set(-0.75, 0.77 * Math.cos(0.14), FZ - 0.2); cm.rotation.set(0.14, Math.PI, 0); add(cm);
      // wall shelves with stoneware jars, bottles, a stack of boxes and a guttering candle
      const fShelf = (x0, x1, y) => {
        add(at(new THREE.Mesh(bevelBox(G, x1 - x0, 0.03, 0.24, 0.005), mat.benchFrame), (x0 + x1) / 2, y, FZ - 0.12));
        for (const x of [x0 + 0.05, x1 - 0.05]) add(at(new THREE.Mesh(bevelBox(G, 0.025, 0.16, 0.2, 0.004), mat.benchFrame), x, y - 0.095, FZ - 0.1));
      };
      fShelf(1.35, 2.35, 1.15); fShelf(1.45, 2.25, 1.55);
      const jarG = G.latheFromProfile([[0, 0], [0.05, 0], [0.058, 0.03], [0.06, 0.1], [0.045, 0.14], [0.03, 0.15], [0.032, 0.17], [0, 0.17]], 18);
      const stoneware = new THREE.MeshPhysicalMaterial({ color: 0x6a5a44, roughness: 0.5, clearcoat: 0.4, name: 'stoneware' });
      const bottleG = G.latheFromProfile([[0, 0], [0.032, 0], [0.034, 0.14], [0.02, 0.18], [0.011, 0.2], [0.011, 0.25], [0, 0.25]], 14);
      const bottleMat = new THREE.MeshPhysicalMaterial({ color: 0x1e3a22, roughness: 0.15, transmission: 0, clearcoat: 1, transparent: true, opacity: 0.85, name: 'bottleGreen' });
      [[1.48, 1.165, 1.0], [1.62, 1.165, 0.8], [2.15, 1.565, 0.9]].forEach(([x, y, sc]) => { const j = add(at(new THREE.Mesh(jarG, stoneware), x, y, FZ - 0.12)); j.scale.setScalar(sc); });
      [[1.78, 1.165], [1.85, 1.165], [1.6, 1.565]].forEach(([x, y]) => add(at(new THREE.Mesh(bottleG, bottleMat), x, y, FZ - 0.1)));
      [[2.1, 1.165, 0.22, 0.12, 0.16], [2.12, 1.285, 0.18, 0.1, 0.14], [1.8, 1.565, 0.24, 0.16, 0.18]].forEach(([x, y, w2, h2, d2], i) => add(at(new THREE.Mesh(bevelBox(G, w2, h2, d2, 0.004), i === 1 ? mat.trunk : mat.crate), x, y + h2 / 2, FZ - 0.13)));
      const stub = fx.candle({ height: 0.05, radius: 0.016, light: false, seed: 77 }); stub.position.set(1.98, 1.165 + 0.012, FZ - 0.08); add(stub);
      add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.045, 0], [0.05, 0.012], [0, 0.012]], 18), mat.tin), 1.98, 1.165, FZ - 0.08));
      const shelfCandle = new THREE.PointLight(0xff9448, 2.4, 3.4, 2); shelfCandle.position.set(1.98, 1.3, FZ - 0.22); root.add(shelfCandle);
      ctx.onUpdate((dt, t) => { shelfCandle.intensity = 2.4 * (0.85 + 0.15 * Math.sin(t * 8.7) * Math.sin(t * 3.3 + 2)); });
      // chimney stack rising through the right slope
      const ch = new THREE.Group();
      const cw = CHIM.x1 - CHIM.x0, cd = CHIM.z1 - CHIM.z0;
      const ctop = roofY(CHIM.x0) + 0.3;
      ch.add(at(new THREE.Mesh(G.boxUV(cw, ctop, cd, 1), mat.brick), 0, ctop / 2, 0));
      ch.add(at(new THREE.Mesh(G.boxUV(cw + 0.08, 0.12, cd + 0.08, 1), mat.brick), 0, 1.25, 0));
      ch.add(at(new THREE.Mesh(G.boxUV(cw + 0.06, 0.1, cd + 0.06, 1), mat.brick), 0, 0.05, 0));
      // soot-blackened cleanout door
      ch.add(at(new THREE.Mesh(bevelBox(G, 0.22, 0.2, 0.02, 0.004), mat.iron), -0.05, 0.42, cd / 2 + 0.01));
      ch.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12), mat.iron), 0.03, 0.42, cd / 2 + 0.03));
      ch.position.set((CHIM.x0 + CHIM.x1) / 2, 0, (CHIM.z0 + CHIM.z1) / 2);
      add(ch);
    }

    // ================================================================ workbench + toys under the oculus
    const bench = buildWorkbench(ctx, mat, { w: 2.5, d: 0.72, h: 0.9 });
    bench.position.copy(BENCH); add(bench);
    const BT = 0.9;   // bench top height
    {
      // shelves on the gable above the bench (stepping down with the roof)
      const shelf = (x0, x1, y) => {
        add(at(new THREE.Mesh(bevelBox(G, x1 - x0, 0.03, 0.26, 0.005), mat.benchFrame), (x0 + x1) / 2, y, Z0 + 0.14));
        for (const x of [x0 + 0.06, x1 - 0.06]) {
          const br = new THREE.Shape(); br.moveTo(0, 0); br.lineTo(0.2, 0); br.lineTo(0, -0.2); br.lineTo(0, 0);
          const bg = new THREE.ExtrudeGeometry(br, { depth: 0.025, bevelEnabled: false }); bg.translate(0, 0, -0.0125); bg.rotateY(-Math.PI / 2);
          add(at(new THREE.Mesh(G.applyBoxUVs(bg, 2), mat.benchFrame), x, y - 0.015, Z0 + 0.0));
        }
      };
      shelf(-2.45, -1.05, 1.55);
      shelf(-2.1, -1.2, 1.95);
      const rack = buildToolRack(ctx, mat, { w: 1.0, h: 0.5 });
      rack.position.set(-0.65, 1.02, Z0 + 0.02); add(rack);
      // toys on the bench
      const jack = buildJackInBox(ctx, mat); jack.position.set(-2.25, BT, BENCH.z + 0.05); jack.rotation.y = 0.5; add(jack);
      const house = buildModelHouse(ctx, mat); house.position.set(-1.6, BT, BENCH.z - 0.08); house.rotation.y = 0.15; add(house);
      const sold = buildSoldiers(ctx, mat, 6, 2); sold.position.set(-1.12, BT, BENCH.z + 0.12); sold.rotation.y = -0.3; add(sold);
      const top = buildTop(ctx, mat); top.position.set(-0.85, BT, BENCH.z + 0.2); add(top);
      const blocks = buildBlocks(ctx, mat, [[-0.55, BT, BENCH.z + 0.15, 0.2, 0], [-0.505, BT, BENCH.z + 0.16, -0.1, 1], [-0.53, BT + 0.045, BENCH.z + 0.155, 0.4, 2], [-0.35, BT, BENCH.z + 0.25, 0.7, 3], [-0.42, BT, BENCH.z + 0.05, 0.1, 4], [-0.7, BT, BENCH.z + 0.28, 1.1, 5]]);
      add(blocks);
      const pb = buildPuzzleBox(ctx, mat, 0.1); pb.position.set(-0.95, BT, BENCH.z - 0.15); pb.rotation.y = 0.3; add(pb);
      const pb2 = buildPuzzleBox(ctx, mat, 0.07); pb2.position.set(-0.95, BT + 0.06, BENCH.z - 0.15); pb2.rotation.y = 0.9; add(pb2);
      // a half-carved puppet head on a carving block, a chisel, a drift of curled shavings
      add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.035, 0], [0.04, 0.02], [0.05, 0.05], [0.048, 0.08], [0.036, 0.1], [0.0, 0.11]], 20), mat.benchTop), -0.25, BT, BENCH.z + 0.02));
      { const ch = new THREE.Group(); ch.position.set(-0.16, BT + 0.012, BENCH.z + 0.2); ch.rotation.y = 0.6; add(ch);
        ch.add(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0.0], [0.014, 0.09], [0.01, 0.11], [0, 0.112]], 10).rotateZ(Math.PI / 2), mat.handle));
        ch.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.1, 0.004, 0.016, 1, 0.0015), mat.steel), 0.05, 0, 0)); }
      for (let i = 0; i < 40; i++) {
        const r0 = 0.008 + (i % 4) * 0.004, len = 1.2 + (i % 5) * 0.5;
        const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16; const a = t * Math.PI * len; pts.push(V3(Math.cos(a) * r0 * (1 - 0.3 * t), t * 0.012, Math.sin(a) * r0 * (1 - 0.3 * t))); }
        const sh = add(new THREE.Mesh(taperTube(pts, [0.0012, 0.002, 0.0018, 0.0008], 3, 24), mat.shaving));
        const ang = i * 2.399, rr = 0.03 + Math.sqrt((i * 0.618) % 1) * 0.16;
        sh.position.set(-0.27 + Math.cos(ang) * rr * 1.3, BT + 0.004 + (i % 3) * 0.003, BENCH.z + 0.1 + Math.sin(ang) * rr * 0.6); sh.rotation.set((i % 3) * 0.6, i * 0.7, Math.PI / 2 * (i % 2));
      }
      for (let i = 0; i < 18; i++) {
        const sh = add(new THREE.Mesh(new THREE.TorusGeometry(0.01 + (i % 3) * 0.004, 0.0025, 4, 10, Math.PI * 1.4), mat.shaving));
        sh.position.set(-0.6 + Math.sin(i * 2.3) * 0.5, 0.004 + (i % 2) * 0.002, BENCH.z + 0.5 + Math.cos(i * 1.7) * 0.15); sh.rotation.set(Math.PI / 2 + (i % 2) * 0.3, 0, i);
      }
      // music box, a half-solved burr puzzle, paint pots, screws and a brass hinge
      const mb = buildMusicBox(ctx, mat); mb.position.set(-0.62, BT, BENCH.z - 0.1); mb.rotation.y = -0.25; add(mb);
      const burr = buildBurr(ctx, mat, 0.075); burr.position.set(-1.3, BT, BENCH.z + 0.22); burr.rotation.y = 0.5; add(burr);
      const pots = buildPaintPots(ctx, mat); pots.position.set(-2.0, BT, BENCH.z - 0.2); pots.rotation.y = 0.2; add(pots);
      const scr = buildScrews(ctx, mat, 16, 7); scr.position.set(-0.75, BT, BENCH.z + 0.24); add(scr);
      const scr2 = buildScrews(ctx, mat, 9, 13); scr2.position.set(-1.65, BT, BENCH.z + 0.25); add(scr2);
      // toys on the shelves
      const doll = buildDoll(ctx, mat, { dress: mat.dressBlue, seed: 1, eye: '#4a6a8a', slump: 0.32, tilt: 0.62, turn: 0.15, missingEye: 1, chip: 1 }); doll.position.set(-2.2, 1.565, Z0 + 0.13); doll.rotation.y = 0.2; add(doll);
      const doll2 = buildDoll(ctx, mat, { dress: mat.dressRed, seed: 2, eye: '#4a3a24', hair: mat.hairBlonde, sash: mat.lace, slump: 0.18, tilt: -0.85, turn: -0.3, chip: -1 }); doll2.position.set(-1.75, 1.565, Z0 + 0.14); doll2.rotation.y = -0.4; doll2.rotation.z = 0.12; add(doll2);
      const drum = buildDrum(ctx, mat); drum.position.set(-1.35, 1.565, Z0 + 0.15); add(drum);
      const s2 = buildSoldiers(ctx, mat, 5, 1); s2.position.set(-1.95, 1.965, Z0 + 0.1); add(s2);
      const top2 = buildTop(ctx, mat); top2.rotation.z = 0; top2.position.set(-1.45, 1.965, Z0 + 0.14); add(top2);
      // marionette hanging off the shelf end
      const mar = buildMarionette(ctx, mat); mar.position.set(-1.05, 1.5, Z0 + 0.28); mar.rotation.y = 0.4; add(mar);
      // candles on the bench
      for (const [x, z, hgt, r] of [[-1.95, BENCH.z + 0.2, 0.16, 0.014], [-1.85, BENCH.z + 0.26, 0.09, 0.012]]) {
        const holder = add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.05, 0], [0.052, 0.006], [0.02, 0.012], [0.016, 0.03], [0.022, 0.035], [0, 0.035]], 20), mat.brass), x, BT, z));
        void holder;
        const cnd = fx.candle({ height: hgt, radius: r, light: false, seed: x * 10 });
        cnd.position.set(x, BT + 0.035, z); add(cnd);
      }
    }

    // ================================================================ the laboratory table & microscope
    const table = buildLabTable(ctx, mat, { w: 1.55, d: 0.82, h: TABLE_H });
    table.position.copy(TABLE); add(table);
    {
      // the microscope stands behind the specimen dish and leans its objective out over it
      // the great microscope stands just behind the dish and leans its objective out over the centre of the plate
      const scope = buildMicroscopeGreat(ctx, mat, { reach: 0.3, objY: 0.155, tilt: 0.42 });
      const sa = -0.85;
      scope.position.set(PLATE.x - Math.sin(sa) * 0.3, TABLE_H, PLATE.z - Math.cos(sa) * 0.3); scope.rotation.y = sa; add(dyn(scope));
      void buildMicroscopeVictorian;
      SCOPE.obj = scope;
      const gw = buildGlassware(ctx, mat); gw.position.set(TABLE.x - 0.52, TABLE_H, TABLE.z - 0.24); gw.rotation.y = 0.3; add(gw);
      const bj = buildBellJar(ctx, mat); bj.position.set(TABLE.x + 0.55, TABLE_H, TABLE.z + 0.22); add(bj);
      // brass stage under the specimen plate (three claw feet)
      const st = new THREE.Group();
      st.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0.03], [0.07, 0.03], [0.08, 0.04], [0.06, 0.05], [0, 0.05]], 24), mat.brass), 0, 0, 0));
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.3; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.07, 8), mat.brass); l.position.set(Math.cos(a) * 0.1, 0.02, Math.sin(a) * 0.1); l.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); st.add(l); }
      st.position.set(PLATE.x, TABLE_H, PLATE.z); add(st);
      // notebook and pen
      const nb = buildNotebook(ctx, mat, mat.pages); nb.position.set(TABLE.x + 0.1, TABLE_H, TABLE.z + 0.26); nb.rotation.y = 0.3; add(nb);
      // ink well
      add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.03, 0], [0.032, 0.01], [0.03, 0.035], [0.012, 0.045], [0.01, 0.055], [0.013, 0.058], [0, 0.058]], 20), mat.glass), TABLE.x + 0.32, TABLE_H, TABLE.z + 0.32));
      add(at(new THREE.Mesh(G.latheFromProfile([[0, 0.003], [0.027, 0.003], [0.028, 0.025], [0, 0.025]], 16), mat.blackEnamel), TABLE.x + 0.32, TABLE_H, TABLE.z + 0.32));
      // stains: an ink spill by the well, cup rings and a candle scorch, tool scuffs on the bench, wax under the candles
      const atlas = decalAtlasTexture(ctx.textures);
      const decal = (qu, qv, size, x, y, z, ry, op = 1) => {
        const g2 = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2);
        const uv = g2.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (qu + uv.getX(i)) * 0.5, (1 - qv) * 0.5 + uv.getY(i) * 0.5);
        const m2 = new THREE.MeshStandardMaterial({ map: atlas, transparent: true, depthWrite: false, roughness: qv === 1 && qu === 0 ? 0.55 : 0.85, opacity: op, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, name: 'decal' });
        const d = add(new THREE.Mesh(g2, m2)); d.position.set(x, y, z); d.rotation.y = ry; d.userData.noShadow = true; d.renderOrder = 2; return d;
      };
      decal(0, 0, 0.26, TABLE.x + 0.24, TABLE_H + 0.0015, TABLE.z + 0.3, 0.6);
      decal(1, 0, 0.36, TABLE.x - 0.34, TABLE_H + 0.0015, TABLE.z + 0.12, 1.9, 0.9);
      decal(1, 1, 0.7, -0.85, BT + 0.0015, BENCH.z + 0.08, 0.1, 0.8);
      decal(1, 1, 0.55, -1.95, BT + 0.0015, BENCH.z + 0.05, 1.7, 0.6);
      decal(0, 1, 0.2, -1.9, BT + 0.0015, BENCH.z + 0.23, 0.4);
      decal(1, 0, 0.3, -1.25, BT + 0.0015, BENCH.z - 0.2, 2.6, 0.7);
      // soot above the furnace door, rising up the brick
      const soot = add(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), new THREE.MeshBasicMaterial({ map: sootPlumeTexture(ctx.textures), color: 0x000000, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, name: 'soot' })));
      soot.position.set((DOOR.x0 + DOOR.x1) / 2 - 0.05, DOOR.h + 0.16 + 0.95, Z0 + 0.003); soot.userData.noShadow = true; soot.renderOrder = 2;
      // rug under the table
      const RW = 2.3, RL = 1.6, RT = 0.011;
      const rugG = new THREE.Group(); rugG.position.set(TABLE.x - 0.05, 0, TABLE.z + 0.1); rugG.rotation.y = 0.08; add(rugG);
      const rugTop = new THREE.PlaneGeometry(RW, RL, 46, 32).rotateX(-Math.PI / 2);
      { const rp = rugTop.attributes.position; for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), z = rp.getZ(i); const edge = Math.min(RW / 2 - Math.abs(x), RL / 2 - Math.abs(z)); rp.setY(i, RT - 0.004 * (1 - Math.min(1, edge / 0.03)) + 0.0025 * Math.sin(x * 3.1 + 1) * Math.sin(z * 4.3) * Math.min(1, edge / 0.2) + (x < -0.6 && z > 0.2 ? 0.012 * Math.exp(-((x + 0.95) ** 2 + (z - 0.55) ** 2) / 0.02) : 0)); } rugTop.computeVertexNormals(); }
      const rug = new THREE.Mesh(rugTop, M.create('rug', { palette: 'faded', aspect: RW / RL, knots: 220, wear: 0.9, fringe: 0, seed: 77, size: 2048, color: [0.52, 0.49, 0.5] }));
      rug.name = 'rug'; rugG.add(rug);
      for (const s2 of [-1, 1]) { rugG.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(RW + 0.004, RT, 0.012, 1, 0.003), mat.rugEdge), 0, RT / 2, s2 * (RL / 2 - 0.004))); rugG.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.012, RT, RL, 1, 0.003), mat.rugEdge), s2 * (RW / 2 - 0.004), RT / 2, 0)); }
      // fringe: knotted tassels along both ends
      { const nF = 150; const fg = new THREE.CylinderGeometry(0.0018, 0.0012, 1, 4, 1).translate(0, 0.5, 0).rotateX(Math.PI / 2);
        const fr = new THREE.InstancedMesh(fg, mat.fringe, nF * 2); const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler();
        for (let i = 0; i < nF * 2; i++) { const s2 = i < nF ? 1 : -1; const k = i % nF; const x = -RW / 2 + 0.01 + (k / (nF - 1)) * (RW - 0.02); const len = 0.045 + 0.02 * Math.abs(Math.sin(k * 12.9898 + s2)); e.set(-0.04, (Math.sin(k * 7.13) * 0.25) + (s2 < 0 ? Math.PI : 0), 0); qq.setFromEuler(e); mm.compose(V3(x, 0.004, s2 * (RL / 2)), qq, V3(1, 1, len)); fr.setMatrixAt(i, mm); }
        fr.castShadow = false; fr.receiveShadow = true; rugG.add(fr); }
      // a stool
      const stool = buildStool(ctx, mat);
      stool.position.set(-0.45, 0, -0.85); add(stool);
      // narrative clutter on the lab table: prepared slides, a pipette with its rubber bulb, a reading glass,
      // crumpled pages of failed notes, a slide box with its lid off
      {
        const slideMat = new THREE.MeshPhysicalMaterial({ color: 0xdfe8ec, roughness: 0.1, transparent: true, opacity: 0.35, clearcoat: 1, depthWrite: false, name: 'slideGlass' });
        const smear = [new THREE.MeshStandardMaterial({ color: 0x2a4a9a, roughness: 0.4, emissive: new THREE.Color(0.05, 0.12, 0.4), emissiveIntensity: 0.6, name: 'smearB' }), new THREE.MeshStandardMaterial({ color: 0x5a7a1a, roughness: 0.4, emissive: new THREE.Color(0.12, 0.3, 0.04), emissiveIntensity: 0.6, name: 'smearG' })];
        const slides = [[0.3, 0.27, 0.4], [0.33, 0.25, 0.9], [0.27, 0.31, 0.2], [-0.12, -0.3, 1.4], [-0.08, -0.27, 1.1]];
        slides.forEach(([dx, dz, ry], i) => {
          const sl = add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.0012, 0.025), slideMat)); sl.position.set(TABLE.x + dx, TABLE_H + 0.0008 + i * 0.0012, TABLE.z + dz); sl.rotation.y = ry; sl.userData.noShadow = true;
          const sm2 = add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.0005, 12), smear[i % 2])); sm2.position.copy(sl.position).add(V3(0, 0.0009, 0)); sm2.scale.set(1.3, 1, 0.9);
        });
        // slide box
        const sbx = add(new THREE.Mesh(bevelBox(G, 0.1, 0.03, 0.06, 0.003), mat.labFrame)); sbx.position.set(TABLE.x + 0.66, TABLE_H + 0.015, TABLE.z + 0.08); sbx.rotation.y = -0.3;
        const lidB = add(new THREE.Mesh(bevelBox(G, 0.102, 0.008, 0.062, 0.002), mat.labFrame)); lidB.position.set(TABLE.x + 0.62, TABLE_H + 0.004, TABLE.z + 0.2); lidB.rotation.y = 0.5;
        // pipette: a long glass tube drawn to a point, a red rubber bulb
        const pip = new THREE.Group(); pip.position.set(TABLE.x - 0.3, TABLE_H + 0.006, TABLE.z + 0.06); pip.rotation.y = 0.7; add(pip);
        pip.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.0012, 0.0], [0.003, 0.03], [0.004, 0.06], [0.004, 0.14], [0, 0.14]], 10).rotateZ(-Math.PI / 2), mat.glass), 0, 0, 0));
        pip.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 10).scale(1.6, 1, 1), new THREE.MeshPhysicalMaterial({ color: 0x5a1a12, roughness: 0.5, sheen: 0.4, name: 'rubber' })), 0.15, 0, 0));
        // reading glass: brass rim, horn handle, a glass lens
        const mg = new THREE.Group(); mg.position.set(TABLE.x - 0.05, TABLE_H + 0.006, TABLE.z + 0.3); mg.rotation.set(0, 2.2, 0); add(mg);
        mg.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.004, 8, 40).rotateX(Math.PI / 2), mat.brass), 0, 0.002, 0));
        mg.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.003, 32), mat.glass), 0, 0.002, 0));
        mg.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.006, 0], [0.007, 0.03], [0.005, 0.08], [0.007, 0.095], [0, 0.1]], 12).rotateZ(-Math.PI / 2), mat.handle), 0.04, 0.003, 0));
        // crumpled notes: wadded pages, the ink of the failed sketches showing on the creases
        let cs2 = 9; const cr2 = () => { cs2 = (cs2 * 16807) % 2147483647; return cs2 / 2147483647; };
        const wadG = new THREE.IcosahedronGeometry(0.03, 2); { const pp = wadG.attributes.position; for (let i = 0; i < pp.count; i++) { const v = V3(pp.getX(i), pp.getY(i), pp.getZ(i)); const k = 0.7 + 0.5 * Math.abs(Math.sin(v.x * 211 + v.y * 157) * Math.cos(v.z * 173)); pp.setXYZ(i, v.x * k, v.y * k * 0.8, v.z * k); } wadG.computeVertexNormals(); }
        for (const [dx, dz, s3] of [[0.55, -0.3, 1.0], [-0.65, -0.05, 0.8], [0.7, 0.32, 0.9]]) { const w2 = add(new THREE.Mesh(wadG, mat.pages)); w2.position.set(TABLE.x + dx, TABLE_H + 0.022 * s3, TABLE.z + dz); w2.scale.setScalar(s3); w2.rotation.set(cr2() * 3, cr2() * 3, cr2() * 3); }
        const fl = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 2), mat.pages)); fl.position.set(0.15, 0.02, -0.6); fl.scale.set(1, 0.7, 1.1); fl.rotation.set(1, 2, 0.5);
      }
      // footprints in the dust: a trail from the top of the stairs, round the table, to the burning door
      {
        const fpMat = new THREE.MeshStandardMaterial({ color: 0x0e0b09, alphaMap: shoePrintTexture(ctx.textures), transparent: true, opacity: 0.42, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, name: 'footprint' });
        const path = new THREE.CatmullRomCurve3([V3(-1.7, 0, 1.45), V3(-1.1, 0, 0.6), V3(-0.3, 0, -0.35), V3(0.3, 0, -2.4), V3(1.1, 0, -3.6), V3(1.82, 0, -4.85)]);
        const L = path.getLength(), stride = 0.36;
        for (let i = 0, d = 0.1; d < L - 0.1; i++, d += stride) {
          const t = d / L; const pnt = path.getPointAt(t), tan = path.getTangentAt(t);
          const side = i % 2 ? 1 : -1; const nrm = V3(-tan.z, 0, tan.x);
          const fp = add(new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.27).rotateX(-Math.PI / 2), fpMat));
          fp.position.copy(pnt).addScaledVector(nrm, side * 0.09).add(V3(0, 0.0012, 0));
          fp.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI + side * 0.08;
          if (side > 0) fp.scale.x = -1;
          fp.userData.noShadow = true; fp.renderOrder = 1;
          // the rug and the table legs: skip prints that would land on the rug
          if (Math.abs(pnt.x - (TABLE.x - 0.05)) < 1.2 && Math.abs(pnt.z - (TABLE.z + 0.1)) < 0.85) fp.visible = false;
        }
      }
    }
    // hanging lamp over the table (from the collar of the rear truss)
    const LAMP_X = PLATE.x + 0.05, LAMP_Z = TRUSS_Z[0] + 0.11;
    const lamp = dyn(buildHangingLamp(ctx, mat, { drop: COLLAR_Y - 0.11 - 2.05 }));
    lamp.position.set(LAMP_X, COLLAR_Y - 0.11, LAMP_Z); add(lamp);
    const lampFlame = fx.flame({ height: 0.045, width: 0.014, intensity: 2.6, seed: 11 });
    lampFlame.position.set(0, lamp.userData.flameY, 0); lamp.add(lampFlame);
    const LAMP_Y = COLLAR_Y - 0.11 + lamp.userData.flameY + 0.04;

    // ================================================================ eaves clutter: trunks, horse, dummy, sheets, crates, frames
    {
      const t1 = buildTrunk(ctx, mat, { w: 0.95, d: 0.52, h: 0.44 }); t1.position.set(-3.05, 0, -0.6); t1.rotation.y = Math.PI / 2 + 0.06; add(t1);
      const t2 = buildTrunk(ctx, mat, { w: 0.75, d: 0.45, h: 0.36, open: 0.0 }); t2.position.set(-3.1, 0.0, 0.45); t2.rotation.y = Math.PI / 2 - 0.1; add(t2);
      const t3 = buildTrunk(ctx, mat, { w: 0.85, d: 0.5, h: 0.4, open: 1.15 }); t3.position.set(3.05, 0, -2.4); t3.rotation.y = -Math.PI / 2 + 0.12; add(t3);
      // old letters spilling out of the open trunk
      for (let i = 0; i < 6; i++) { const l = add(new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.1).rotateX(-Math.PI / 2), mat.vellum)); l.position.set(2.75 - (i % 3) * 0.09, 0.006 + i * 0.001, -2.6 + Math.floor(i / 3) * 0.16 + (i % 2) * 0.03); l.rotation.y = i * 0.7; }
      const horse = dyn(buildRockingHorse(ctx, mat)); horse.position.set(-2.55, 0, -2.25); horse.rotation.y = -0.65; add(horse);
      horse.userData.keep = true;
      root.userData.horse = horse;
      const dummy = buildDressForm(ctx, mat); dummy.position.set(2.45, 0, 0.15); dummy.rotation.y = -0.9; add(dummy);
      const cage = buildBirdCage(ctx, mat); cage.position.set(-3.05, 0.44 + 0.12, -0.5); add(cage);
      // dust-sheeted furniture: an armchair and a tall mirror/wardrobe
      const chairTop = (x, z) => { const back = THREE.MathUtils.smoothstep(-z, 0.05, 0.3); const arms = THREE.MathUtils.smoothstep(Math.abs(x), 0.25, 0.36); return 0.45 + back * 0.5 + arms * 0.18 * (1 - back) + Math.sin(x * 9) * 0.01; };
      // sheeted furniture: the cloth stops short of the floor so turned legs and bun feet show beneath it
      const turnedLeg = G.latheFromProfile([[0, 0], [0.018, 0], [0.022, 0.02], [0.016, 0.05], [0.021, 0.09], [0.014, 0.14], [0.02, 0.2], [0.024, 0.24], [0, 0.24]], 12);
      const bunFoot = G.latheFromProfile([[0, 0], [0.035, 0], [0.05, 0.03], [0.045, 0.06], [0.03, 0.075], [0.03, 0.1], [0, 0.1]], 14);
      const sheeted = (opts, legGeo, legInset, pos, rotY) => {
        const grp = new THREE.Group();
        { const sm = new THREE.Mesh(dustSheetGeometry(opts), mat.linen); sm.userData.noShadow = true; grp.add(sm); }
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) grp.add(at(new THREE.Mesh(legGeo, mat.labFrame), sx * (opts.hw - legInset), 0, sz * (opts.hd - legInset)));
        grp.position.set(...pos); grp.rotation.y = rotY; return add(grp);
      };
      sheeted({ hw: 0.42, hd: 0.42, topH: chairTop, seed: 2, seg: 130, hem: 0.0, foldAmp: 2.6, flare: 0.09 }, turnedLeg, 0.06, [2.85, 0, 2.8], -Math.PI / 2 - 0.4);
      // a wardrobe with a cornice: crisp top edge, the sheet hanging straight, bun feet
      const wardTop = (x, z) => 1.86 + 0.04 * THREE.MathUtils.smoothstep(Math.max(Math.abs(x) / 0.42, Math.abs(z) / 0.24), 0.85, 1.0) + Math.sin(x * 9 + z * 5) * 0.006;
      sheeted({ hw: 0.42, hd: 0.24, topH: wardTop, seed: 5, seg: 150, flare: 0.1, hem: 0.0, foldAmp: 3.0 }, bunFoot, 0.05, [2.75, 0, -3.45], -Math.PI / 2 + 0.2);
      const sofaTop = (x, z) => 0.42 + THREE.MathUtils.smoothstep(-z, 0.1, 0.35) * 0.35 + THREE.MathUtils.smoothstep(Math.abs(x), 0.75, 0.9) * 0.15;
      sheeted({ hw: 0.95, hd: 0.4, topH: sofaTop, seed: 9, seg: 150, hem: 0.1, foldAmp: 2.4, flare: 0.08 }, turnedLeg, 0.07, [-3.0, 0, 1.9], Math.PI / 2);
      // crates
      const c1 = buildCrate(ctx, mat, { w: 0.6, h: 0.45, d: 0.5, seed: 0 }); c1.position.set(-3.1, 0, -3.6); c1.rotation.y = 0.2; add(c1);
      const c2 = buildCrate(ctx, mat, { w: 0.5, h: 0.38, d: 0.42, seed: 1 }); c2.position.set(-3.05, 0.465, -3.55); c2.rotation.y = -0.15; add(c2);
      const c3 = buildCrate(ctx, mat, { w: 0.55, h: 0.42, d: 0.5, seed: 2 }); c3.position.set(3.1, 0, -4.1); c3.rotation.y = -0.3; add(c3);
      const c4 = buildCrate(ctx, mat, { w: 0.7, h: 0.5, d: 0.55, seed: 3 }); c4.position.set(3.0, 0, 3.4); c4.rotation.y = 0.15; add(c4);
      // picture frames leaning on the right knee wall
      const fr = buildFrameStack(ctx, mat); fr.position.set(3.35, 0, -1.1); fr.rotation.y = -Math.PI / 2; add(fr);
      // the toy chest in the foreground, a ball rolled away from it, the bench chair
      const tc = buildToyChest(ctx, mat); tc.position.set(-2.05, 0, 0.55); tc.rotation.y = 1.25; add(tc);
      add(at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), mat.ball), -0.55, 0.06, 1.55));
      const tr = buildTrain(ctx, mat); tr.position.set(-0.75, 0, 1.95); tr.rotation.y = 2.2; add(tr);
      const chair = buildChair(ctx, mat); chair.position.set(-1.55, 0, BENCH.z + 0.85); chair.rotation.y = Math.PI + 0.35; add(chair);
      // coil of rope and a hat box
      add(at(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 28).rotateX(Math.PI / 2), mat.rope), 2.6, 0.035, 0.75));
      add(at(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.034, 8, 28).rotateX(Math.PI / 2), mat.rope), 2.62, 0.1, 0.74));
      // ---- round 3: the eaves are packed. Hat boxes, cases, rolled carpets, bundled books, a gramophone,
      // a crate of soldiers, a broken chair, more frames and more dust sheets, filling the low triangles both sides
      const paper = (key, a, b, stripe) => new THREE.MeshStandardMaterial({ roughness: 0.85, name: key, map: ctx.textures.canvas(`attic:${key}`, 512, 128, (g2, w, h) => {
        g2.fillStyle = a; g2.fillRect(0, 0, w, h);
        g2.fillStyle = b; for (let x = 0; x < w; x += stripe * 2) g2.fillRect(x, 0, stripe, h);
        let sd = key.length * 7; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
        for (let i = 0; i < 300; i++) { g2.fillStyle = `rgba(30,22,14,${rnd() * 0.12})`; g2.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 30, 1 + rnd() * 6); }
        const gr = g2.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(60,50,40,0.35)'); gr.addColorStop(0.3, 'rgba(0,0,0,0)'); gr.addColorStop(0.8, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,30,20,0.4)'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h);
      }) });
      const papers = [paper('hbStripe', '#6a5a46', '#3e2e22', 18), paper('hbRose', '#5a2e2a', '#7a4a3a', 6), paper('hbGreen', '#2e3a2a', '#4a5638', 24), paper('hbCream', '#9a8a6a', '#8a7454', 10)];
      const hatBox = (x, y, z, r, h, k, ry = 0, open = 0) => { const o = buildHatBox(ctx, mat, papers[k % 4], { r, h, lidOpen: open }); o.position.set(x, y, z); o.rotation.y = ry; return add(o); };
      hatBox(3.15, 0, 0.6, 0.2, 0.22, 2);
      hatBox(3.13, 0.25, 0.62, 0.16, 0.18, 1, 0.6);
      hatBox(-3.1, 0, -1.5, 0.22, 0.24, 0, 0.3); hatBox(-3.08, 0.27, -1.45, 0.17, 0.17, 3, 1.1, 0.4);
      hatBox(3.3, 0, -4.75, 0.18, 0.2, 1);
      hatBox(-1.3, 0, 4.2, 0.19, 0.22, 3, 0.4);
      // suitcases stacked against the knee walls
      const cases = [[-3.25, 0, -2.95, 0.66, 0.2, 0.42, 1.5], [-3.25, 0.2, -2.98, 0.58, 0.18, 0.38, 1.62], [-3.24, 0.38, -2.95, 0.5, 0.16, 0.34, 1.45],
        [3.25, 0, -1.65, 0.6, 0.22, 0.4, -1.5], [3.28, 0.22, -1.62, 0.52, 0.17, 0.36, -1.62],
        [3.2, 0, 1.55, 0.7, 0.24, 0.44, -1.4], [3.22, 0.24, 1.5, 0.6, 0.2, 0.4, -1.65], [-3.25, 0, 4.15, 0.62, 0.2, 0.4, 1.55], [-3.27, 0.2, 4.12, 0.5, 0.17, 0.34, 1.7]];
      const caseMats = [mat.trunk, mat.bookLeather, mat.leatherStrap];
      cases.forEach(([x, y, z, w, h, d, ry], i) => { const c = buildSuitcase(ctx, mat, { w, h, d, body: caseMats[i % 3] }); c.position.set(x, y, z); c.rotation.y = ry; add(c); });
      // rolled carpets: two lying under the left eave, one propped up against the right knee wall
      const rugRoll = M.create('rug', { palette: 'faded', aspect: 3, knots: 200, wear: 0.9, fringe: 0, seed: 12, size: 512, color: [0.5, 0.45, 0.45] });
      const rr1 = buildRolledRug(ctx, mat, rugRoll, { len: 1.7, r: 0.1 }); rr1.position.set(-3.52, 0.1, -0.95); rr1.rotation.y = Math.PI / 2 + 0.05; add(rr1);
      const rr2 = buildRolledRug(ctx, mat, rugRoll, { len: 1.4, r: 0.085 }); rr2.position.set(-3.53, 0.285, -1.0); rr2.rotation.y = Math.PI / 2 - 0.04; add(rr2);
      const rr3 = buildRolledRug(ctx, mat, rugRoll, { len: 1.5, r: 0.12 }); rr3.position.set(3.45, 0.72, 0.15); rr3.rotation.set(0, 0, 1.25); add(rr3);
      // book bundles
      [[-2.6, 0, -0.1, 1, 0.3], [2.75, 0, -0.95, 2, 1.2], [1.25, 0, 1.75, 3, 0.4], [-2.6, 0, -3.3, 4, 0.1], [3.0, 0.44, -4.12, 5, 0.6], [-1.1, 0, 2.3, 6, -0.4]].forEach(([x, y, z, sd, ry]) => { const b = buildBookBundle(ctx, mat, { n: 4 + (sd % 3), seed: sd }); b.position.set(x, y, z); b.rotation.y = ry; add(b); });
      // gramophone on the crate by the right knee wall
      const gram = buildGramophone(ctx, mat); gram.position.set(3.0, 0.5 + 0.018, 3.4); gram.rotation.y = -2.2; add(gram);
      // an open crate of tin soldiers in the foreground, straw spilling
      { const oc = buildCrate(ctx, mat, { w: 0.5, h: 0.3, d: 0.38, seed: 4 }); oc.position.set(1.75, 0, 1.1); oc.rotation.y = 0.35; oc.children.filter((c) => c.position.y > 0.29).forEach((c, i) => { if (i < 4) { c.visible = false; } }); add(oc);
        const sol = buildSoldiers(ctx, mat, 9, 5); sol.position.set(1.66, 0.2, 1.02); sol.rotation.y = 0.35; add(sol);
        for (let i = 0; i < 26; i++) { const st = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.1 + (i % 4) * 0.03, 3), mat.straw)); st.position.set(1.75 + Math.sin(i * 2.3) * 0.3, 0.004 + (i % 3) * 0.003, 1.1 + Math.cos(i * 1.7) * 0.28); st.rotation.set(Math.PI / 2, 0, i * 0.9); }
        // a lid propped against it
        const lid = add(new THREE.Mesh(bevelBox(G, 0.5, 0.38, 0.018, 0.003), mat.crate)); lid.position.set(1.95, 0.19, 1.36); lid.rotation.set(-0.25, 0.35, 0.05); }
      // foreground, inside the hero frame: a rolled carpet left lying across the boards, a crate of puzzle boxes, a fallen frame
      { const rr4 = buildRolledRug(ctx, mat, rugRoll, { len: 1.3, r: 0.09 }); rr4.position.set(1.95, 0.09, -0.35); rr4.rotation.y = 0.5; add(rr4);
        const pc = buildCrate(ctx, mat, { w: 0.46, h: 0.32, d: 0.36, seed: 8 }); pc.position.set(-1.45, 0, -0.25); pc.rotation.y = -0.3; add(pc);
        for (let i = 0; i < 4; i++) { const pbx = buildPuzzleBox(ctx, mat, 0.08 + (i % 2) * 0.02); pbx.position.set(-1.52 + (i % 2) * 0.12, 0.338 + Math.floor(i / 2) * 0.06, -0.28 + (i % 3) * 0.05); pbx.rotation.y = i * 0.7; add(pbx); }
        const bb = buildBookBundle(ctx, mat, { n: 6, seed: 9 }); bb.position.set(-1.0, 0, -0.05); bb.rotation.y = 0.9; add(bb); }
      // a broken chair tipped on its back under the left eave, one leg snapped off beside it
      { const bc = buildChair(ctx, mat); bc.position.set(-3.0, 0.22, 3.35); bc.rotation.set(-1.45, 0.6, 0.0); add(bc);
        const leg = add(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.016, 0], [0.02, 0.1], [0.016, 0.2], [0.012, 0.25], [0, 0.25]], 10), mat.benchFrame)); leg.position.set(-2.85, 0.018, 3.85); leg.rotation.set(0, 0, Math.PI / 2 - 0.05); }
      // more frames: a gilt one leaning by itself, a stack under the left eave
      { const fs2 = buildFrameStack(ctx, mat); fs2.position.set(-3.45, 0, -2.2); fs2.rotation.y = Math.PI / 2; add(fs2); }
      // stacked crates in the front-left corner under the eave
      { const c6 = buildCrate(ctx, mat, { w: 0.45, h: 0.34, d: 0.4, seed: 6 }); c6.position.set(3.15, 0, 4.15); c6.rotation.y = -0.2; add(c6);
      }
      // a second bird cage hanging from a purlin hook on the right, an empty one
      { const cg2 = buildBirdCage(ctx, mat); cg2.position.set(2.15, 1.65, -2.9); cg2.rotation.y = 0.4; add(cg2);
        add(strandLine(V3(2.15, 1.65 + 0.48, -2.9), V3(1.95, roofY(1.95) - 0.25, -2.9))); }
      // two more dust-sheeted pieces with heavy corner folds: a chest of drawers (right) and a pile of chairs (left)
      const chestTop = (x, z) => 0.95 + 0.012 * THREE.MathUtils.smoothstep(Math.max(Math.abs(x) / 0.5, Math.abs(z) / 0.26), 0.9, 1.0) + Math.sin(x * 11 + z * 7) * 0.005;
      sheeted({ hw: 0.5, hd: 0.26, topH: chestTop, seed: 13, seg: 130, flare: 0.09, hem: 0.0, foldAmp: 2.8 }, bunFoot, 0.06, [3.15, 0, -0.2], -Math.PI / 2 + 0.1);
      const pileTop = (x, z) => 0.5 + 0.55 * Math.exp(-((x + 0.1) ** 2) / 0.05 - ((z - 0.05) ** 2) / 0.06) + 0.3 * Math.exp(-((x - 0.2) ** 2) / 0.04 - ((z + 0.1) ** 2) / 0.03) + 0.04 * Math.sin(x * 13 + z * 9);
      sheeted({ hw: 0.4, hd: 0.35, topH: pileTop, seed: 21, seg: 130, flare: 0.1, hem: 0.0, foldAmp: 3.0 }, turnedLeg, 0.06, [-3.15, 0, -4.6], 0.3);
    }

    // ================================================================ things hung from the timbers: marionettes on the front collar, a toy biplane
    {
      const yC = COLLAR_Y - 0.11;
      [[-0.95, 0.3, 0.1], [-0.6, -0.4, -0.06], [1.15, 0.9, 0.08]].forEach(([x, ry, rz], i) => {
        const mr = buildMarionette(ctx, mat); mr.position.set(x, yC - 0.18 - i * 0.05, TRUSS_Z[1] + 0.11); mr.rotation.set(0, ry, rz); add(dyn(mr));
        add(strandLine(V3(x, yC, TRUSS_Z[1] + 0.11), V3(x, yC - 0.18 - i * 0.05, TRUSS_Z[1] + 0.11)));
      });
      const bp = buildBiplane(ctx, mat); bp.position.set(-1.05, 2.12, TRUSS_Z[0] + 0.11); bp.rotation.set(0.05, 0.6, -0.12); add(dyn(bp));
      for (const dz of [-0.18, 0.18]) add(strandLine(V3(-1.05 + dz * 0.55, yC, TRUSS_Z[0] + 0.11 + dz * 0.6), V3(-1.05 + 0.06 * 0.8 + dz * 0.55, 2.12 + 0.065, TRUSS_Z[0] + 0.11 + dz * 0.8)));
      ctx.onUpdate((dt, t) => { bp.rotation.y = 0.6 + Math.sin(t * 0.25) * 0.15; });
    }

    // ================================================================ cobwebs
    const ocC = V3(OCULUS.x, OCULUS.y, Z0 - WALL_T / 2);
    const moonAim = V3(PLATE.x + 0.15, 0.0, -0.4);
    const moonDir = moonAim.clone().sub(ocC).normalize();
    {
      // corner webs clustered where timbers meet, single catenary strands, loose ends in the beam
      const beamSpec = { origin: ocC, dir: moonDir, radius: OCULUS.r * 0.95 };
      const webTex = [1, 2, 3, 4].map((k) => cornerWebTexture(ctx.textures, k));
      const lampW = { pos: V3(LAMP_X, LAMP_Y, LAMP_Z), radius: 1.5, color: new THREE.Color(1.0, 0.62, 0.3).multiplyScalar(0.5) };
      const wm = webTex.map((t) => webMaterial({ map: t, beam: beamSpec, beamK, opacity: 0.55, lamp: lampW, time: ctx.time, base: 0x464c5a }));
      const doorWeb = webMaterial({ map: webTex[2], beam: beamSpec, beamK, opacity: 0.45, time: ctx.time, warm: { pos: V3((DOOR.x0 + DOOR.x1) / 2, 1.3, Z0 - WALL_T - 0.8), radius: 1.6, color: new THREE.Color(1.0, 0.35, 0.12).multiplyScalar(0.55) } });
      const strandMat = webMaterial({ beam: beamSpec, beamK, opacity: 0.26, lamp: lampW, time: ctx.time });
      const hamTex = [3, 7].map((k) => hammockWebTexture(ctx.textures, k));
      const hm = hamTex.map((t) => webMaterial({ map: t, beam: beamSpec, beamK, opacity: 0.6, lamp: lampW, time: ctx.time, base: 0x4a505e }));
      const cs = Math.cos(SLOPE), sn = Math.sin(SLOPE);
      // old sheet webs sagging in the angle under the collar of each truss and its principal rafter
      for (const z of TRUSS_Z) for (const s2 of [-1, 1]) {
        add(sheetWeb(V3(s2 * 1.6, COLLAR_Y - 0.11, z + 0.11), V3(-s2 * 0.7, 0, 0), V3(s2 * cs * 0.62, -sn * 0.62, 0), 0.16, wm[(z > 0 ? 1 : 0) + (s2 > 0 ? 2 : 0)], { down: V3(0, -0.6, z > 0 ? -0.8 : 0.8).normalize() }));
      }
      // hammocks of silk slung between neighbouring common rafters on both slopes, drooping into the room
      const rafterUnder = (s2, x, z) => V3(x, roofY(x), z).addScaledVector(sideN(s2), RAFTER.d + 0.005);
      const hams = [[-1, -2.75, -1.9, -0.88, 0.24], [-1, -1.6, -0.95, -3.28, 0.18], [1, 1.9, 2.75, -2.68, 0.22], [1, 1.05, 1.7, 0.32, 0.2], [-1, -2.9, -2.2, 1.52, 0.16], [1, 2.3, 3.0, -4.48, 0.2], [-1, -1.3, -0.7, -4.48, 0.12]];
      hams.forEach(([s2, xa, xb, z, sag], i) => {
        const za = z + RAFTER.w / 2, zb = z + RAFTER.step - RAFTER.w / 2;
        add(hammockWeb(rafterUnder(s2, xa, za), rafterUnder(s2, xb, za), V3(0, 0, zb - za), sag, hm[i % 2]));
      });
      // silk strung between the lamp chain and the rear collar, glowing amber in the lamp light
      add(sheetWeb(V3(LAMP_X + 0.01, COLLAR_Y - 0.11, LAMP_Z), V3(0.62, 0, 0), V3(0, -0.5, 0), 0.08, wm[1], { down: V3(0, 0, 1) }));
      add(sheetWeb(V3(LAMP_X - 0.01, COLLAR_Y - 0.11, LAMP_Z), V3(-0.45, 0, 0), V3(0, -0.36, 0), 0.06, wm[3], { down: V3(0, 0, -1) }));
      // webs at the rafter feet and under the low eaves, picked out by the lanterns set down there
      const lanternWeb = (pos, k) => webMaterial({ map: webTex[k], beam: beamSpec, beamK, opacity: 0.6, time: ctx.time, base: 0x3a404c, warm: { pos, radius: 1.5, color: new THREE.Color(1.0, 0.6, 0.28).multiplyScalar(0.55) } });
      const lwL = lanternWeb(V3(-2.85, 0.35, -1.95), 0), lwR = lanternWeb(V3(2.58, 0.2, -1.2), 2), lwF = lanternWeb(V3(-2.92, 0.62, 0.45), 3);
      for (const [z, m2, k] of [[-2.68, lwL, 0], [-1.48, lwL, 1], [0.32, lwF, 2], [-0.88, lwF, 3]]) {
        const za = z + RAFTER.w / 2, zb = z + RAFTER.step - RAFTER.w / 2;
        add(sheetWeb(rafterUnder(-1, -(HALF - 0.12), za), V3(0, 0, zb - za), sideU(-1).multiplyScalar(0.5 + 0.1 * k), 0.14, m2, { down: V3(0.3, -1, 0).normalize() }));
      }
      for (const [z, k] of [[-1.48, 0], [-0.28, 1], [-2.08, 2]]) {
        const za = z + RAFTER.w / 2, zb = z + RAFTER.step - RAFTER.w / 2;
        add(sheetWeb(rafterUnder(1, HALF - 0.12, za), V3(0, 0, zb - za), sideU(1).multiplyScalar(0.55 + 0.1 * k), 0.14, lwR, { down: V3(-0.3, -1, 0).normalize() }));
      }
      // a great sheet under the gable collar tie, strung back to the brickwork: right in the moonbeam
      {
        const cy2 = 3.08 - 0.07, cz2 = Z0 + 0.72;
        add(hammockWeb(V3(-1.1, cy2, cz2 - 0.03), V3(-0.3, cy2, cz2 - 0.03), V3(0, 0.02, Z0 + 0.015 - (cz2 - 0.03)), 0.26, hm[0]));
      }
      // above the rear collar, in the angle with the king post
      add(cornerWeb(V3(0.075, COLLAR_Y + 0.11, TRUSS_Z[0] + 0.11), V3(0.6, 0, 0), V3(0, 0.55, 0), wm[1]));
      // across the round window, spanning the reveal (the moon comes straight through it)
      add(cornerWeb(V3(OCULUS.x - 0.36, OCULUS.y + 0.44, Z0 - 0.07), V3(0.5, 0.06, 0), V3(-0.16, -0.46, 0), wm[0]));
      add(cornerWeb(V3(OCULUS.x + 0.44, OCULUS.y - 0.38, Z0 - 0.09), V3(-0.34, -0.02, 0), V3(0.06, 0.34, 0), wm[3]));
      // the head of the burning doorway: backlit by the furnace
      add(cornerWeb(V3(DOOR.x0 + 0.005, DOOR.h - 0.005, Z0 - 0.06), V3(0.34, 0, 0), V3(0, -0.36, 0), doorWeb));
      // rafter feet over the knee walls
      add(cornerWeb(V3(-(HALF - 0.03), KNEE + 0.02, -2.8), V3(0, 0, 0.55), V3(0.3, 0.32, 0), wm[2]));
      add(cornerWeb(V3(HALF - 0.03, KNEE + 0.02, -3.3), V3(0, 0, -0.5), V3(-0.28, 0.3, 0), wm[1]));
      // an extra collar tie near the gable, its strands sagging and dangling into the moonbeam
      const cy = 3.08, cz = Z0 + 0.72;
      const cw = 2 * (HALF * (1 - (cy - KNEE) / RISE)) - 0.25;
      add(new THREE.Mesh(orient(hewnBeam(G, 0.06, 0.14, cw, { seed: 181, sag: 0.02, ch: 0.016 }), V3(0, cy, cz), V3(1, 0, 0), V3(0, 1, 0)), mat.timberDark));
      add(cornerWeb(V3(-0.9, cy - 0.07, cz), V3(0.55, 0, 0), V3(0, 0, -0.66), wm[0]));
      const strands = [
        [[-0.75, cy - 0.06, cz], [-0.7, 2.98, Z0 + 0.03], 0.09], [[-0.42, cy - 0.06, cz], [-0.35, 3.0, Z0 + 0.03], 0.12], [[0.05, cy - 0.06, cz], [0.12, 3.05, Z0 + 0.03], 0.07],
        [[-1.15, roofY(-1.15) - 0.2, Z0 + 0.12], [-1.05, roofY(-1.05) - 0.24, Z0 + 0.72], 0.06], [[0.95, roofY(0.95) - 0.2, Z0 + 0.12], [0.9, roofY(0.9) - 0.22, Z0 + 0.72], 0.05],
        [[-1.6, COLLAR_Y - 0.1, TRUSS_Z[0] + 0.11], [-1.3, COLLAR_Y - 0.1, TRUSS_Z[0] + 0.11], 0.1], [[1.2, COLLAR_Y - 0.1, TRUSS_Z[0] + 0.11], [1.62, COLLAR_Y - 0.12, TRUSS_Z[0] + 0.11], 0.14],
        [[-0.1, COLLAR_Y - 0.1, TRUSS_Z[0] + 0.11], [-0.2, cy - 0.06, cz], 0.22],
      ];
      for (const [p0, p1, sg] of strands) add(strand(V3(...p0), V3(...p1), sg, strandMat, 0.0011));
      for (let i = 0; i < 7; i++) {
        const x = -0.95 + i * 0.17 + Math.sin(i * 3.7) * 0.04;
        add(dangle(V3(x, cy - 0.07, cz + 0.01 + (i % 3) * 0.012), 0.18 + ((i * 0.37) % 1) * 0.5, strandMat, 0.025, 0.0011));
      }
      for (const x of [-1.2, -0.75, 0.9]) add(dangle(V3(x, COLLAR_Y - 0.11, TRUSS_Z[0] + 0.11), 0.2 + Math.abs(x) * 0.15, strandMat, 0.02, 0.0011));
    }

    // ================================================================ lights
    // the moon through the oculus (shadowed, so the spokes print on the floor)
    const moonPos = ocC.clone().addScaledVector(moonDir, -9);
    const moon = new THREE.SpotLight(0xa8bcff, 1500, 26, 0.105, 0.35, 2);
    moon.position.copy(moonPos); moon.target.position.copy(moonAim);
    moon.castShadow = Q.shadows;
    moon.shadow.mapSize.set(Math.max(1024, Q.shadowMapSize), Math.max(1024, Q.shadowMapSize));
    moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.04; moon.shadow.radius = Q.shadowRadius ?? 3;
    moon.shadow.camera.near = 6; moon.shadow.camera.far = 22;
    root.add(moon, moon.target);
    const moonBase = moon.intensity;
    // cold bounce off the moonlit tabletop and rug, thrown up into the rafters (one-sided area lights: nothing under the table)
    root.add(fx.areaLight({ center: [PLATE.x + 0.1, TABLE_H + 0.02, TABLE.z + 0.05], normal: [0, 1, 0], width: 1.3, height: 0.8, color: 0x8496d8, intensity: 2.2 }));
    root.add(fx.areaLight({ center: [PLATE.x + 0.1, 0.03, -0.3], normal: [0, 1, 0], width: 1.4, height: 1.2, color: 0x7d8ccc, intensity: 1.6 }));
    // a dim fill along the ridge so the rafters keep their edges; the hemisphere's ground term is the floor bounce lighting the undersides
    const ridgeFill = new THREE.PointLight(0x5868a0, 7, 7, 2); ridgeFill.position.set(0.0, 3.3, -2.6); root.add(ridgeFill);
    const ridgeFill2 = new THREE.PointLight(0x6a5a50, 3.5, 6, 2); ridgeFill2.position.set(0.3, 3.2, 1.6); root.add(ridgeFill2);
    root.add(new THREE.HemisphereLight(0x34446e, 0x3e3c4c, 0.85));
    // the whole floor gives back a little of the moon: a broad, very dim cool bounce that keeps the
    // rafter sides and the sarking readable (a few percent) instead of crushing them to black
    const roofBounce = fx.areaLight({ center: [0, 0.4, (Z0 + Z1) / 2 - 0.5], normal: [0, 1, 0], width: 6.4, height: 8.5, color: 0x5d6c96, intensity: 2.4 });
    root.add(roofBounce);
    const ridgeWash = fx.areaLight({ center: [0, 3.9, -1.0], normal: [0, -1, 0.15], width: 1.2, height: 6.5, color: 0x4a5878, intensity: 1.8 });
    root.add(ridgeWash);
    // moon bounce washing up the near (west) slope by the stairs, so the rafters there are not a black void
    const westFill = new THREE.PointLight(0x5a6aa8, 1.2, 4.2, 2); westFill.position.set(-1.5, 2.2, 0.2); root.add(westFill);
    root.add(fx.areaLight({ center: [OCULUS.x, OCULUS.y, Z0 - 0.05], normal: [0, -0.25, 1], width: 1.0, height: 1.0, color: 0x8ea6ff, intensity: 4 }));
    // the oil lamp over the microscope table: a shadowed downlight + soft omni
    const lampSpot = new THREE.SpotLight(0xffae5a, 20, 7, 1.15, 0.92, 2);
    lampSpot.position.set(LAMP_X, LAMP_Y, LAMP_Z); lampSpot.target.position.set(LAMP_X, 0, LAMP_Z + 0.05);
    lampSpot.castShadow = Q.shadows;
    lampSpot.shadow.mapSize.set(1024, 1024); lampSpot.shadow.bias = -0.0012; lampSpot.shadow.normalBias = 0.02; lampSpot.shadow.radius = 5;
    lampSpot.shadow.camera.near = 0.1; lampSpot.shadow.camera.far = 5;
    root.add(lampSpot, lampSpot.target);
    // the lamp's omni carves the back of the attic out of the dark (shadowed: the chain, collar and rafters print on the roof)
    const lampGlow = new THREE.PointLight(0xffa050, 2.6, 5.5, 2); lampGlow.position.set(LAMP_X, LAMP_Y + 0.05, LAMP_Z);
    lampGlow.castShadow = Q.shadows; lampGlow.shadow.mapSize.set(512, 512); lampGlow.shadow.bias = -0.002; lampGlow.shadow.normalBias = 0.03; lampGlow.shadow.radius = 4; lampGlow.shadow.camera.near = 0.12; lampGlow.shadow.camera.far = 6;
    root.add(lampGlow);
    // workbench candles
    const candleLight = new THREE.PointLight(0xff9a48, 1.8, 3.5, 2); candleLight.position.set(-1.9, BT + 0.3, BENCH.z + 0.25); root.add(candleLight);
    // the furnace light from the stair beyond the door: a shadowed spot through the gap + red fill
    const doorCX = (DOOR.x0 + DOOR.x1) / 2;
    // set back up the stair so the figure on the landing throws his shadow out across the attic floor
    const hellSpot = new THREE.SpotLight(0xff5a24, 55, 9, 0.3, 0.92, 2);
    hellSpot.position.set(doorCX + 0.08, 1.75, Z0 - WALL_T - 1.45); hellSpot.target.position.set(doorCX - 0.3, 0.0, Z0 + 1.25);
    // a soft cookie: the pool on the boards is a feathered doorway trapezoid that dies out before the rug
    hellSpot.map = ctx.textures.canvas('attic:hellcookie', 256, 256, (g2, w, h) => {
      g2.fillStyle = '#000'; g2.fillRect(0, 0, w, h);
      const rg = g2.createRadialGradient(w * 0.5, h * 0.55, w * 0.05, w * 0.5, h * 0.5, w * 0.5);
      rg.addColorStop(0, 'rgba(255,240,230,1)'); rg.addColorStop(0.55, 'rgba(200,180,170,0.75)'); rg.addColorStop(1, 'rgba(0,0,0,1)');
      g2.fillStyle = rg; g2.filter = 'blur(6px)'; g2.fillRect(0, 0, w, h);
    }, { tile: false });
    ghostMat.uniforms.uLightPos.value.set(doorCX, 1.35, Z0 - WALL_T - 2.0);
    hellSpot.castShadow = Q.shadows;
    hellSpot.shadow.mapSize.set(1024, 1024); hellSpot.shadow.bias = -0.002; hellSpot.shadow.normalBias = 0.06; hellSpot.shadow.radius = 4;
    hellSpot.shadow.camera.near = 0.3; hellSpot.shadow.camera.far = 12;
    root.add(hellSpot, hellSpot.target);
    // the climax keeps a cold rim on the specimen plate so the blue/green fight still reads under the furnace light
    const plateRim = new THREE.SpotLight(0x9ab0ff, 0, 4, 0.32, 0.8, 2);
    plateRim.position.set(PLATE.x - 0.9, PLATE.y + 1.6, PLATE.z - 0.6); plateRim.target.position.copy(PLATE);
    root.add(plateRim, plateRim.target);
    const passage = new THREE.PointLight(0xff4a18, 14, 3.0, 2); passage.position.set(doorCX, 1.5, Z0 - WALL_T - 1.9); root.add(passage);
    const leafFill = new THREE.PointLight(0xff6a30, 1.4, 2.2, 2); leafFill.position.set(DOOR.x1 + 0.15, 1.1, Z0 + 0.55); root.add(leafFill);
    const doorSpill = fx.areaLight({ center: [doorCX - 0.2, 0.95, Z0 + 0.02], normal: [0, 0, 1], width: 0.4, height: 1.8, color: 0xff5020, intensity: 0.9 }); root.add(doorSpill);
    // flicker
    const base = { lampSpot: lampSpot.intensity, lampGlow: lampGlow.intensity, candle: candleLight.intensity, hell: hellSpot.intensity, passage: passage.intensity };
    ctx.onUpdate((dt, t) => {
      const f = 0.95 + 0.035 * Math.sin(t * 7.3) * Math.sin(t * 2.9) + 0.015 * Math.sin(t * 17.1);
      lampSpot.intensity = base.lampSpot * f; lampGlow.intensity = base.lampGlow * f;
      candleLight.intensity = base.candle * (0.88 + 0.12 * Math.sin(t * 9.7) * Math.sin(t * 3.1 + 1));
      const fl = Math.sin(t * 39.6) * 0.45 + Math.sin(t * 54.7 + 1.3) * 0.35 + Math.sin(t * 62.2 + 2.1) * 0.2;   // 6-10 Hz furnace flicker
      const h = (0.85 + 0.1 * Math.sin(t * 3.3) * Math.sin(t * 1.3 + 2) + 0.05 * Math.sin(t * 11.0)) * (1 + climaxK * 0.25 * fl);
      hellSpot.intensity = base.hell * h * hellBoost; passage.intensity = base.passage * h * hellBoost;
      // the lamp sways a hair on its chain
      lamp.rotation.z = Math.sin(t * 0.7) * 0.012; lamp.rotation.x = Math.sin(t * 0.53 + 1) * 0.008;
    });
    let hellBoost = 1, climaxK = 0;

    // ================================================================ broken slates: slivers of moon through the roof
    // two slipped slates: their slivers of moon land on the rocking horse (left) and the open trunk of letters (right)
    const holes = [{ s: -1, x: -2.75, z: -4.5, w: 0.36, h: 0.5 }, { s: 1, x: 2.35, z: -4.7, w: 0.34, h: 0.46 }];
    const holeTex = ctx.textures.canvas('attic:roofhole', 256, 256, (g2, w, h) => {
      g2.clearRect(0, 0, w, h);
      g2.fillStyle = '#fff';
      g2.beginPath();
      const pts = [[0.12, 0.08], [0.4, 0.14], [0.55, 0.02], [0.86, 0.1], [0.92, 0.42], [0.82, 0.6], [0.95, 0.9], [0.6, 0.86], [0.45, 0.97], [0.18, 0.88], [0.06, 0.6], [0.14, 0.4]];
      pts.forEach(([x, y], i) => (i ? g2.lineTo(x * w, y * h) : g2.moveTo(x * w, y * h))); g2.closePath(); g2.fill();
      // a couple of slate edges and a batten across the gap
      g2.fillStyle = '#000'; g2.fillRect(0, h * 0.46, w, h * 0.07);
    }, { tile: false });
    const holeMat = new THREE.MeshBasicMaterial({ map: skyTex.map, alphaMap: holeTex, alphaTest: 0.5, color: new THREE.Color(0.55, 0.65, 1.0).multiplyScalar(1.6), toneMapped: false, side: THREE.DoubleSide, name: 'roofhole' });
    const holeShafts = [];
    for (const hh of holes) {
      const y = roofY(hh.x);
      const u = sideU(hh.s), n = sideN(hh.s);
      const c = V3(hh.x, y, hh.z).addScaledVector(n, 0.012);
      const g = new THREE.PlaneGeometry(hh.w, hh.h);
      const m = add(new THREE.Mesh(g, holeMat));
      m.position.copy(c);
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V3(0, 0, 1).multiplyScalar(-hh.s), u, n.clone().negate().multiplyScalar(1)));
      m.userData.noShadow = true;
      const sp = new THREE.SpotLight(0x9fb4ff, 2200, 30, 0.028, 0.6, 2);
      sp.position.copy(c).addScaledVector(moonDir, -9); sp.target.position.copy(c).addScaledVector(moonDir, 4);
      root.add(sp, sp.target);
      holeShafts.push({ center: c, right: V3(0, 0, hh.w * 0.32), up: u.clone().multiplyScalar(hh.h * 0.32) });
    }
    // a tin lantern left burning on the trunk by the stairs
    {
      const ln = new THREE.Group();
      ln.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.025, 6), mat.tin), 0, 0.0125, 0));
      ln.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.07, 6), mat.tin), 0, 0.25, 0));
      ln.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 6, 14), mat.iron), 0, 0.31, 0));
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ln.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.2, 0.008), mat.tin), Math.cos(a) * 0.058, 0.12, Math.sin(a) * 0.058)); }
      const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.058, 0.19, 6, 1, true), mat.chimney); lg.position.y = 0.12; lg.userData.noShadow = true; ln.add(lg);
      const cnd = fx.candle({ height: 0.07, radius: 0.016, light: false, seed: 31 }); cnd.position.y = 0.025; ln.add(cnd);
      ln.position.set(-3.0, 0.36 + 0.13, 0.45); add(ln);
      const ll = new THREE.PointLight(0xff9448, 4.5, 4, 2); ll.position.set(-2.92, 0.62, 0.45); root.add(ll);
      // a second lantern set down on the hat boxes in the left eave, and a third on the floor in the right eave,
      // so the stored junk under the low rafters is picked out of the dark in pools of warm light
      const ln2 = ln.clone(); ln2.position.set(-2.92, 0.0, -1.98); add(ln2);
      const ll2 = new THREE.PointLight(0xff9448, 2.6, 2.6, 2); ll2.position.set(-2.85, 0.32, -1.95); root.add(ll2);
      const ln3 = ln.clone(); ln3.position.set(2.62, 0.0, -1.25); add(ln3);
      const ll3 = new THREE.PointLight(0xff9a50, 2.2, 2.6, 2); ll3.position.set(2.58, 0.2, -1.2); root.add(ll3);
      ctx.onUpdate((dt, t) => { ll2.intensity = 2.6 * (0.9 + 0.1 * Math.sin(t * 7.3 + 1) * Math.sin(t * 3.1)); ll3.intensity = 2.2 * (0.9 + 0.1 * Math.sin(t * 6.7 + 2) * Math.sin(t * 2.3)); });
      ctx.onUpdate((dt, t) => { ll.intensity = 4.5 * (0.9 + 0.1 * Math.sin(t * 8.1) * Math.sin(t * 2.7)); });
    }

    let solvedCine = false, puzzleActive = false;
    // ================================================================ volumetrics
    const shafts = [];
    {
      // round moon beam: a LightShaft with its cross-section made circular and the spoke pattern carved in
      const right = V3(OCULUS.r * 0.95, 0, 0), up = V3(0, OCULUS.r * 0.95, 0);
      const sh = new LightShaft({ timeUniform: ctx.time, steps: Q.volumetricSteps, center: V3(OCULUS.x, OCULUS.y, Z0 + 0.03), right, up, direction: moonDir, length: 6.8, color: 0x9fb6ff, intensity: 0.36, softness: 0.22, falloff: 0.9, panes: [0, 0], noise: 0.75 });
      sh.material.fragmentShader = sh.material.fragmentShader
        .replace('vec2 e = 1.0 - smoothstep(1.0 - uSoftness, 1.0, abs(b.xy));\n  float edge = e.x * e.y;',
          `vec2 bq = b.xy * (1.0 + b.z * 0.04);
  float rr = length(bq);
  float edge = 1.0 - smoothstep(1.0 - uSoftness, 1.0, rr);
  float ang = atan(bq.y, bq.x);
  float spoke = abs(sin((ang - 0.3927) * 4.0));
  float spokeMask = mix(1.0, smoothstep(0.0, 0.12 / max(rr, 0.15), spoke), step(0.33, rr) * (1.0 - smoothstep(0.35, 1.0, b.z)));
  float ringMask = 1.0 - (1.0 - smoothstep(0.0, 0.05, abs(rr - 0.32))) * (1.0 - smoothstep(0.3, 0.9, b.z));
  edge *= spokeMask * ringMask;`);
      sh.material.needsUpdate = true;
      add(sh); shafts.push(sh);
      // the furnace wedge through the door gap
      const dw = 0.24;
      const dsh = fx.shaft({ center: V3(DOOR.x0 + dw + 0.01, 0.98, Z0 + 0.05), right: V3(dw, 0, 0), up: V3(0, 0.93, 0), direction: V3(-0.35, -0.22, 1).normalize(), length: 2.1, color: 0xff6a30, intensity: 0.55, softness: 0.8, falloff: 1.6, panes: [0, 0], noise: 0.8 });
      add(dsh); shafts.push(dsh);
      for (const hs of holeShafts) { const sh2 = fx.shaft({ ...hs, direction: moonDir, length: 5.5, color: 0x9fb6ff, intensity: 0.3, softness: 0.75, falloff: 0.7, panes: [0, 0], noise: 0.8 }); add(sh2); shafts.push(sh2); }
      // soft-saturate the in-scattering so a beam seen end-on does not white out the frame
      for (const sh of shafts) { sh.material.fragmentShader = sh.material.fragmentShader.replace('float v = acc / steps * lenW;', 'float v = acc / steps * lenW; v = (1.0 - exp(-v * 1.6)) / 1.6;'); sh.material.needsUpdate = true; }
    }
    // fade beams the camera stands inside (the haze would otherwise fill the whole screen)
    {
      const camB = new THREE.Vector3();
      const beams = shafts.map((sh) => ({ sh, i0: sh.material.uniforms.uIntensity.value }));
      // per-viewpoint haze: from the table the beam is seen down its length and would veil the bench behind it
      const NODE_BEAM = { table: 0.5, back: 0.22, window: 0.55 };   // looking back down the room the beams would veil everything in blue
      let nodeMul = 1;
      ctx.onUpdate((dt) => {
        if (puzzleActive) return;
        const want = ctx.nav?.moving ? nodeMul : (NODE_BEAM[ctx.nav?.current] ?? 1);
        nodeMul = ctx.shot ? want : nodeMul + (want - nodeMul) * Math.min(1, (dt || 0) * 1.5);
        for (const b of beams) {
          const u = b.sh.material.uniforms;
          camB.copy(ctx.camera.position).sub(u.uOrigin.value).applyMatrix3(u.uInv.value);
          const r = Math.hypot(camB.x, camB.y);
          const inside = camB.z > -0.05 && camB.z < 1.05 ? 1 - THREE.MathUtils.smoothstep(r, 0.9, 2.2) : 0;
          u.uIntensity.value = b.i0 * (1 - 0.8 * inside) * (b === beams[1] ? 1 + climaxK * 1.2 : nodeMul * moonK);
        }
      });
    }
    // motes only where there is light to catch them: the moon cone, the lamp, the candles, the doorway
    const dust = buildMotes({
      box: new THREE.Box3(V3(-2.6, 0.1, Z0 + 0.1), V3(2.6, 3.4, 1.8)), count: Math.round(5200 * (Q.particles ?? 1)), time: ctx.time,
      beam: { origin: ocC, dir: moonDir, radius: OCULUS.r * 0.95 }, gain: 1.3, px: 900,
      lights: [{ pos: V3(LAMP_X, LAMP_Y, LAMP_Z), radius: 1.1 }, { pos: V3(-1.9, BT + 0.25, BENCH.z + 0.25), radius: 0.6 }, { pos: V3((DOOR.x0 + DOOR.x1) / 2, 1.0, Z0 + 0.25), radius: 0.8 }],
    });
    add(dust);
    add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.1, 0, Z0 + 0.1), V3(X1 - 0.1, 0.5, Z1 - 0.2)), color: 0x07090f, litColor: 0x2c3a58, density: 0.28, heightFalloff: 4 }));
    // a faint cold dust haze hanging just inside the oculus, so the beam is born at the glass
    add(fx.fog({ box: new THREE.Box3(V3(OCULUS.x - 0.75, OCULUS.y - 0.8, Z0 + 0.02), V3(OCULUS.x + 0.75, OCULUS.y + 0.7, Z0 + 0.55)), color: 0x0a0e18, litColor: 0x4a5a88, density: 0.35, heightFalloff: 0.3 }));
    add(fx.fog({ box: new THREE.Box3(V3(-2.5, 1.0, Z0 + 0.2), V3(2.5, 3.8, 1.0)), color: 0x0c1018, litColor: 0x232a3e, density: 0.06, heightFalloff: 0.5 }));

    // ================================================================ the infection puzzle
    const inf = createInfectionPuzzle(ctx, {
      parent: root,
      center: PLATE.clone().add(V3(0, 0.004, 0)),
      plateRadius: PLATE_R,
      mats: { brass: mat.brass },
      camera: { position: [PLATE.x, PLATE.y + 0.6, PLATE.z + 0.34], target: [PLATE.x, PLATE.y, PLATE.z + 0.035], fov: 50 },
      onSolved: async () => {
        ctx.state.set('attic.infectionWon', true);
        solvedCine = true;
        if (ctx.shot) doorOpen(1);
        await ctx.say({ text: 'No... *no!* My beautiful germs... You think you have *won*? Then come — come up the stairs, and claim your prize!', speaker: 'stauf', speakerName: 'Stauf' });
      },
    });
    // the moon beam crosses the puzzle camera: thin it while playing
    {
      const pz = inf.puzzle, setup0 = pz.setup, teardown0 = pz.teardown;
      const i0 = shafts.map((s) => s.material.uniforms.uIntensity.value);
      pz.setup = (p) => { puzzleActive = true; moon.intensity = moonBase * moonK * 0.42; moon.penumbra = 0.8; dust.visible = false; if (SCOPE.obj) SCOPE.obj.visible = false; shafts.forEach((s, i) => { s.material.uniforms.uIntensity.value = i0[i] * 0.15; }); ctx.post.set({ exposure: 1.55, bloomStrength: 0.25, godRayWeight: 0.05, vignette: 0.6, dof: null }, ctx.shot ? 0 : 0.8); return setup0(p); };
      pz.teardown = (p) => { puzzleActive = false; moon.intensity = moonBase * moonK; moon.penumbra = 0.35; dust.visible = true; if (SCOPE.obj) SCOPE.obj.visible = true; shafts.forEach((s, i) => { s.material.uniforms.uIntensity.value = i0[i]; }); ctx.post.set({ exposure: ROOM_GRADE.exposure, bloomStrength: ROOM_GRADE.bloomStrength, godRayWeight: ROOM_GRADE.godRayWeight, vignette: ROOM_GRADE.vignette }, 0.8); return teardown0(p); };
    }
    if (ctx.state.isSolved(INFECTION_ID)) inf.applySolved();
    const hx = ctx.params.get('hexx');
    if (hx === 'mid') { inf.simulate(14, 5); }
    if (hx === 'sel') { inf.simulate(14, 5); const leg = inf.legal(); if (leg.length) inf.select(leg[0].from); }
    if (hx === 'solved') { inf.applySolved(); }
    if (hx === 'think') { inf.simulate(15, 5); inf.think(); }
    ctx.onUpdate((dt, t) => { if (!puzzleActive) inf.tick(dt, t); });

    // ================================================================ interactions
    let rock = 0, jackT = -1;
    ctx.onUpdate((dt, t) => {
      const horse = root.userData.horse;
      if (rock > 0) { rock = Math.max(0, rock - dt * 0.25); }
      horse.rotation.z = Math.sin(t * 2.4) * 0.12 * rock;
      if (jackT >= 0) jackT += dt;
    });
    // the finale: the door swings wide, the furnace roars redder, and the figure comes down the stair to the threshold
    const hellCol0 = hellSpot.color.clone(), hellCol1 = new THREE.Color(0xff2a0c), passCol0 = passage.color.clone();
    let doorBase = DOOR.open;
    ctx.onUpdate((dt, t) => { if (climaxK > 0) doorPivot.rotation.y = doorBase + climaxK * (0.025 * Math.sin(t * 0.7) + 0.01 * Math.sin(t * 2.3 + 1.0)); });
    const doorOpen = (k) => {
      doorBase = DOOR.open + k * 0.65; doorPivot.rotation.y = doorBase; hellBoost = 1 + k * 1.1; climaxK = k; doorSpill.intensity = 0.9 * (1 + 3.0 * k); hellSpot.angle = 0.3 + 0.04 * k; plateRim.intensity = 9 * k;
      moonK = 1 - 0.45 * k; moon.intensity = moonBase * moonK; moonMat.color.setRGB(0.78, 0.86, 1.08).multiplyScalar(0.45 + 0.55 * moonK); skyMat.color.setScalar(0.4 + 0.6 * moonK);
      hellSpot.color.copy(hellCol0).lerp(hellCol1, k); passage.color.copy(passCol0).lerp(hellCol1, k);
      if (FIG.obj) { FIG.obj.position.lerpVectors(FIG.rest, FIG.fore, k); FIG.obj.rotation.y = 0.12 - 0.25 * k; FIG.obj.scale.setScalar(0.94 + 0.02 * k); ghostMat.uniforms.uRimGain.value = 1.5 + 1.3 * k; FIG.obj.userData.faceMat.uniforms.uKey.value = 1.0 + 0.6 * k; }
    };
    // lightning behind the oculus: the moon flares, threads in the beam blaze
    let flashT = -1;
    const flashAt = (f) => { moon.intensity = moonBase * moonK * (1 + 3.5 * f); skyMat.color.setScalar((0.4 + 0.6 * moonK) * (1 + 2.5 * f)); beamK.value = 1 + 2.5 * f; };
    ctx.onUpdate((dt) => {
      if (flashT < 0) return;
      flashT += dt;
      const f = Math.exp(-((flashT - 0.12) ** 2) / 0.003) + 0.65 * Math.exp(-((flashT - 0.5) ** 2) / 0.005) + 0.3 * Math.exp(-((flashT - 0.8) ** 2) / 0.004);
      flashAt(f);
      if (flashT > 1.4) { flashT = -1; flashAt(0); }
    });
    { const gf = ctx.params.get('gfade'); if (gf) ghostMat.uniforms.uFade.value = Number(gf); }
    const climaxP = ctx.params.get('climax');
    if (climaxP) { doorOpen(1); if (climaxP === 'flash') flashAt(0.8); }
    if (ctx.state.isSolved(INFECTION_ID)) doorOpen(1);

    // ================================================================ nodes, edges, exits
    const nodes = {
      main: { position: [0.4, 1.6, 2.9], target: [-0.15, 1.62, -5.2], fov: 58, label: 'The attic', look: { yaw: [-55, 55], pitch: [-30, 30] } },
      stairs: { position: [-2.2, 1.62, 1.15], target: [-0.4, 1.4, -5.0], fov: 60, label: 'Top of the stairs', look: { yaw: [-60, 60], pitch: [-35, 25] } },
      stairs_down: { position: [-2.2, 1.62, 1.15], target: [-2.2, -0.6, 4.2], fov: 60, label: 'The stairs down' },
      table: { position: [1.6, 1.55, -0.2], target: [0.55, 0.82, -1.5], fov: 55, label: 'The microscope table', look: { yaw: [-60, 60], pitch: [-40, 25] } },
      bench: { position: [-1.25, 1.52, -2.85], target: [-1.35, 1.12, -5.2], fov: 56, label: 'Stauf\'s workbench', look: { yaw: [-60, 60], pitch: [-35, 35] } },
      window: { position: [-1.3, 1.5, -3.15], target: [-0.3, 2.7, -5.2], fov: 55, label: 'The round window', look: { yaw: [-50, 50], pitch: [-30, 40] } },
      door: { position: [0.95, 1.52, -2.3], target: [1.85, 1.12, -5.2], fov: 56, label: 'The glowing door', grade: { bloomStrength: 0.12, bloomThreshold: 3.2 }, look: { yaw: [-50, 50], pitch: [-30, 25] } },
      back: { position: [1.1, 1.62, -3.3], target: [-0.9, 1.2, 4.6], fov: 60, label: 'Looking back', grade: { bloomStrength: 0.1, bloomThreshold: 3.2 }, look: { yaw: [-60, 60], pitch: [-30, 30] } },
    };
    const edges = [
      ['stairs', 'stairs_down'],
      ['stairs', 'main', [[-1.0, 1.62, 2.6]]],
      ['stairs', 'table', [[-1.2, 1.62, 0.2]]],
      ['stairs', 'bench', [[-1.5, 1.6, -1.0]]],
      ['main', 'table', [[0.9, 1.6, 1.2]]],
      ['main', 'bench', [[-0.4, 1.62, 1.0], [-1.0, 1.6, -1.2]]],
      ['table', 'bench', [[-0.6, 1.58, -1.6]]],
      ['table', 'door', [[0.2, 1.6, -2.2]]],
      ['table', 'window', [[-0.2, 1.56, -2.0]]],
      ['bench', 'window'],
      ['window', 'door'],
      ['bench', 'door', [[0.0, 1.58, -2.9]]],
      ['door', 'back'],
      ['bench', 'back'],
      ['window', 'back'],
      ['back', 'main', [[0.6, 1.62, 0.4]], { hotspot: { main: { position: [0.4, 1.4, 2.4], radius: 0.6 } } }],
      ['back', 'stairs', [[-1.2, 1.62, -0.6]], { hotspot: { stairs: { position: [-2.0, 1.4, 1.0], radius: 0.5 } } }],
    ];
    const wellBox = { min: [STAIR.x0, -1.2, STAIR.z0 + 0.2], max: [STAIR.x1, 0.3, STAIR.z1] };
    const doorBox = { min: [DOOR.x0, 0.05, Z0 - 0.5], max: [DOOR.x1, DOOR.h, Z0 + 0.7] };
    const solved = (st) => !!(st.isSolved?.(INFECTION_ID) || st.get?.('attic.infectionWon'));
    const exits = [
      { node: 'stairs_down', toRoom: 'gallery', toNode: 'attic', label: 'Down to the gallery', hotspot: { box: wellBox } },
      { node: 'back', toRoom: 'gallery', toNode: 'attic', label: 'Down to the gallery', hotspot: { box: wellBox } },
      { node: 'door', toRoom: 'foyer', toNode: null, label: 'Through the burning door', hotspot: { box: doorBox }, enabled: solved },
    ];

    // ================================================================ hotspots
    const cap = (title, text) => () => ctx.ui.caption(text, { title });
    const S = (text) => ctx.say({ text, speaker: 'stauf', speakerName: 'Stauf' });
    const hotspots = [
      { id: 'infection', nodes: ['table', 'main', 'stairs', 'window', 'door'], box: { min: [PLATE.x - PLATE_R - 0.03, PLATE.y - 0.03, PLATE.z - PLATE_R - 0.03], max: [PLATE.x + PLATE_R + 0.03, PLATE.y + 0.06, PLATE.z + PLATE_R + 0.03] }, cursor: 'puzzle', label: 'The specimen plate', puzzle: inf.puzzle, priority: 3 },
      { id: 'microscope', nodes: ['table'], box: { min: [PLATE.x - 0.12, TABLE_H + 0.15, PLATE.z - 0.42], max: [PLATE.x + 0.24, TABLE_H + 0.72, PLATE.z + 0.02] }, cursor: 'examine', label: 'The microscope', onActivate: cap('The Microscope', 'Brass, cold, and leaning over the dish like a heron over a pond. Through the eyepiece something on the plate is moving — dividing — and it is looking back.') },
      { id: 'belljar', nodes: ['table'], box: { min: [TABLE.x + 0.42, TABLE_H, TABLE.z + 0.1], max: [TABLE.x + 0.68, TABLE_H + 0.3, TABLE.z + 0.35] }, cursor: 'examine', label: 'A bell jar', onActivate: cap('The Bell Jar', 'A tiny skull, no bigger than a child\'s fist, on a brass pin. The label has been scratched away, all but the word "Guest".') },
      {
        id: 'jack', nodes: ['bench', 'window'], box: { min: [-2.4, BT, BENCH.z - 0.12], max: [-2.08, BT + 0.32, BENCH.z + 0.2] }, cursor: 'talk', label: 'A jack-in-the-box',
        onActivate: async () => { ctx.audio.sfx?.('laugh'); await S('Pop goes the weasel! I made every one of these toys myself. The children *loved* them. For a little while.'); },
      },
      { id: 'house', nodes: ['bench', 'window'], box: { min: [-1.85, BT, BENCH.z - 0.25], max: [-1.35, BT + 0.32, BENCH.z + 0.1] }, cursor: 'examine', label: 'A model house', onActivate: cap('The Model', 'This house, perfect to the last slate. Light burns in every window — and, in the attic, a tiny figure stands at a tiny workbench, building a tiny house.') },
      { id: 'soldiers', nodes: ['bench'], box: { min: [-1.2, BT, BENCH.z + 0.05], max: [-0.98, BT + 0.12, BENCH.z + 0.3] }, cursor: 'examine', label: 'Tin soldiers', onActivate: cap('The Soldiers', 'Six guardsmen in scarlet. One has fallen; his painted face has been carefully scraped away.') },
      { id: 'dolls', nodes: ['bench', 'window'], box: { min: [-2.4, 1.55, Z0], max: [-1.55, 1.85, Z0 + 0.3] }, cursor: 'ghost', label: 'Two dolls', onActivate: async () => { ctx.audio.sfx?.('whisper'); await ctx.say({ text: 'Did you hear them? Two little voices, singing in the dark... "Old Stauf, old Stauf, built a house and filled it..."', speaker: 'narrator', speakerName: '' }); } },
      { id: 'marionette', nodes: ['bench'], sphere: { center: [-1.05, 1.25, Z0 + 0.28], radius: 0.2 }, cursor: 'talk', label: 'A marionette', onActivate: () => S('Every one of my guests danced on strings. *Mine*. Just as you are dancing now.') },
      {
        id: 'horse', nodes: ['bench', 'stairs', 'table', 'main'], box: { min: [-3.0, 0.1, -2.7], max: [-2.1, 1.0, -1.8] }, cursor: 'ghost', label: 'A rocking horse',
        onActivate: async () => { rock = 1; ctx.audio.creak?.(); await ctx.ui.caption('Nobody touched it. It rocks, and rocks, and the floorboards answer in time.', { title: 'The Rocking Horse' }); },
      },
      { id: 'window', nodes: ['window', 'bench', 'main', 'table'], sphere: { center: [OCULUS.x, OCULUS.y, Z0 - 0.1], radius: OCULUS.r }, cursor: 'examine', label: 'The round window', onActivate: cap('The Oculus', 'A full moon fills the round window like an eye pressed to a keyhole. One pane is broken; the wind comes through it smelling of snow and the grave.') },
      {
        id: 'door-locked', nodes: ['door', 'main', 'window', 'table'], box: doorBox, cursor: 'examine', label: 'The glowing door', enabled: () => !ctx.state.isSolved(INFECTION_ID),
        onActivate: async () => { ctx.audio.sfx?.('thud'); await S('Not yet, not yet! Nobody goes up those stairs until they have played my *last* game.'); },
      },
      { id: 'dummy', nodes: ['door', 'table', 'main'], box: { min: [2.2, 0.8, -0.1], max: [2.7, 1.5, 0.4] }, cursor: 'ghost', label: 'A dressmaker\'s dummy', onActivate: cap('The Dummy', 'It is wearing a tape measure like a noose. For a moment its shoulders seem to rise and fall.') },
      { id: 'trunk', nodes: ['door', 'table'], box: { min: [2.75, 0.0, -2.9], max: [3.35, 0.7, -1.9] }, cursor: 'examine', label: 'An open trunk', onActivate: cap('The Trunk', 'Letters, hundreds of them, all addressed to the same man: "Mr. H. Stauf, Toymaker". Every one is an order for a doll.') },
      { id: 'sheets', nodes: ['main', 'stairs'], box: { min: [2.3, 0, 2.3], max: [3.4, 1.1, 3.3] }, cursor: 'ghost', label: 'A sheeted chair', onActivate: cap('Under the Sheet', 'The shape beneath the dust sheet is a chair. You are almost sure it is a chair. It was not facing that way a moment ago.') },
      { id: 'chimney', nodes: ['main', 'stairs', 'back'], box: { min: [CHIM.x0, 0, CHIM.z0], max: [CHIM.x1, 2.5, CHIM.z1] }, cursor: 'examine', label: 'The chimney stack', onActivate: cap('The Chimney', 'Warm to the touch, though every fire in the house below is cold. From somewhere inside it comes a child\'s laughter, rising.') },
      { id: 'lamp', nodes: ['table', 'main'], sphere: { center: [LAMP_X, LAMP_Y - 0.1, LAMP_Z], radius: 0.22 }, cursor: 'examine', label: 'The oil lamp', onActivate: cap('The Lamp', 'Someone has kept it trimmed and filled. Someone is expecting company.') },
    ];

    // ================================================================ QA hooks
    if (typeof window !== 'undefined') {
      const dbg = (window.__debug ||= {});
      dbg.solvers ||= {}; dbg.states ||= {};
      dbg.solvers.attic = async () => {
        const game = window.__game;
        if (game && !game.puzzle && game.room?.mod?.id === 'attic' && game.startPuzzle) { game.startPuzzle(inf.puzzle); await new Promise((r) => setTimeout(r, 60)); }
        if (game?.puzzle?.def?.id === INFECTION_ID) { inf.puzzle.autoSolve(game.puzzle.pctx); return true; }
        inf.applySolved(); ctx.state.markSolved?.(INFECTION_ID); doorOpen(1);
        return true;
      };
      dbg.states.attic = () => ({ ...inf.state(), isSolved: ctx.state.isSolved(INFECTION_ID), doorOpen: doorPivot.rotation.y > DOOR.open + 0.3 });
      dbg.solve ||= (id) => (dbg.solvers[id] ? dbg.solvers[id]() : Promise.reject(new Error(`no solver for ${id}`)));
      dbg.state ||= (id) => (dbg.states[id] ? dbg.states[id]() : null);
      dbg.attic = { inf, aiMove: inf.aiMove, move: inf.move, staufNow: inf.staufNow, simulate: inf.simulate, reset: inf.reset, legal: inf.legal, doorOpen };
    }

    // review/debug: ?atOff=moon,lamp,hell,hemi,area,candle
    {
      const off = (ctx.params.get('atOff') || '').split(',');
      const kill = (l) => { l.intensity = 0; l.visible = false; };
      if (off.includes('moon')) kill(moon);
      if (off.includes('lamp')) { kill(lampSpot); kill(lampGlow); base.lampSpot = 0; base.lampGlow = 0; }
      if (off.includes('hell')) { kill(hellSpot); kill(passage); base.hell = 0; base.passage = 0; }
      if (off.includes('candle')) { kill(candleLight); base.candle = 0; }
      root.traverse((o) => { if (off.includes('area') && o.isRectAreaLight) kill(o); if (off.includes('hemi') && o.isHemisphereLight) kill(o); });
    }

    // ================================================================ shadows + merge
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const fxLike = o.isPoints || m?.isShaderMaterial || m?.isMeshBasicMaterial || (m?.transparent && (m.opacity ?? 1) < 0.6) || o.userData.noBake;
      if (o.castShadow === false && o.receiveShadow === false && o.parent?.name === 'infectionPuzzle') { /* keep puzzle flags */ }
      o.castShadow = !o.userData.noShadow && !fxLike && !['floor', 'rug'].includes(o.name);
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });
    // walls must cast so the moon only enters through the oculus
    root.traverse((o) => { if (o.name === 'backGable' || o.name === 'sarking') o.castShadow = true; });
    // the silhouette throws a real shadow from the furnace spot behind him
    FIG.obj.traverse((o) => { if (o.isMesh && o.material === ghostMat) o.castShadow = true; });
    root.userData.merge = mergeStatic(root);

    const godRays = [{ position: V3(OCULUS.x, OCULUS.y, Z0 - 1.5), color: new THREE.Color(0.72, 0.8, 1.0), strength: 0.8, radius: 0.075 }];

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'stairs',
      grade: (climaxP || ctx.state.isSolved(INFECTION_ID)) ? { ...ROOM_GRADE, ...CLIMAX_GRADE } : ROOM_GRADE,
      environment: { position: [0.2, 1.7, 0.6], intensity: 0.42 },
      onEnter() {
        if (!ctx.state.has('attic.greeted')) {
          ctx.state.set('attic.greeted', true);
          setTimeout(() => S('So. You have come all the way to the top of my house. Welcome to my *workshop*, my little guest. Shall we play... one last game?'), 1400);
        }
      },
      update(dt) {
        if (solvedCine) {
          solvedCine = false;
          let k = 0;
          const off = ctx.onUpdate((d) => { k = Math.min(1, k + d * 0.4); doorOpen(k * k * (3 - 2 * k)); if (k >= 1) off?.(); });
          ctx.audio.creak?.(); ctx.audio.thunder?.();
          flashT = 0;
          ctx.post.set({ exposure: ROOM_GRADE.exposure * 0.7, saturation: 1.1, vignette: 0.62 }, 0.35);
          setTimeout(() => ctx.post.set({ ...CLIMAX_GRADE, exposure: ROOM_GRADE.exposure * 1.04, vignette: ROOM_GRADE.vignette }, 3.0), 1300);
        }
        void dt;
      },
      dispose() { const d = window.__debug; if (d) { delete d.attic; if (d.solvers) delete d.solvers.attic; if (d.states) delete d.states.attic; } },
    };
  },
};
