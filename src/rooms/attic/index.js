import * as THREE from 'three';
import { LightShaft } from '../../engine/fx/index.js';
import { mergeStatic } from '../../engine/lib/contrib/foyer-merge.js';
import { timberTexture, sarkingTexture, floorTexture, lathPlasterTexture, linenTexture, moonSkyTexture, cobwebTexture, hellGlowTexture } from './textures.js';
import {
  bevelBox, beam, buildWorkbench, buildTrain, buildToolRack, buildJackInBox, buildSoldiers, buildTop, buildDrum, buildDoll, buildRockingHorse,
  buildModelHouse, buildBlocks, buildMarionette, buildPuzzleBox, buildLabTable, buildMicroscope, buildGlassware, buildBellJar,
  buildHangingLamp, buildToyChest, buildChair, buildTrunk, buildCrate, buildDressForm, buildBirdCage, dustSheetGeometry, buildFrameStack,
} from './props.js';
import { createInfectionPuzzle, infectionMeta, INFECTION_ID } from './puzzleInfection.js';

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
const ROOM_GRADE = {
  exposure: 2.5, contrast: 1.1, saturation: 0.96, toneMapping: 'aces',
  shadowTint: [0.78, 0.92, 1.22], highlightTint: [1.14, 1.0, 0.82], splitAmount: 0.6,
  vignette: 0.5, grain: 0.04, bloomStrength: 0.26, bloomThreshold: 2.0,
  godRayWeight: 0.45, godRayThreshold: 2.0, aoIntensity: 1.15, aoRadius: 0.4,
};

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
    const dyn = (o) => { o.userData.dynamic = true; return o; };

    // ================================================================ materials
    const pbr = (set, opts = {}, Phys = false) => new (Phys ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({ map: set.map, normalMap: set.normalMap, roughnessMap: set.ormMap, metalnessMap: set.ormMap, aoMap: set.ormMap, roughness: 1, metalness: 1, ...opts });
    const timber = timberTexture(ctx.textures);
    const timberDark = timberTexture(ctx.textures, { key: 'timberDark', base: [0.12, 0.075, 0.045] });
    const linen = linenTexture(ctx.textures);
    const paint = (hex, o = {}) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.35, envMapIntensity: 0.6, ...o });
    const mat = {
      timber: pbr(timber.withRepeat(1 / 1.2, 1 / 0.3), { name: 'timber', envMapIntensity: 0.3 }),
      timberDark: pbr(timberDark.withRepeat(1 / 1.2, 1 / 0.3), { name: 'timberDark', envMapIntensity: 0.3 }),
      sarking: pbr(sarkingTexture(ctx.textures).withRepeat(1 / 1.2, 1 / 1.2), { name: 'sarking', envMapIntensity: 0.2 }),
      floor: pbr(floorTexture(ctx.textures).withRepeat(1 / 1.6, 1 / 1.6), { name: 'floor', envMapIntensity: 0.35 }),
      lath: pbr(lathPlasterTexture(ctx.textures).withRepeat(1 / 1.5, 1 / 1.5), { name: 'lath', envMapIntensity: 0.25 }),
      brick: M.create('brick', { rows: 12, cols: 4, soot: 0.9, repeat: [1 / 0.9, 1 / 0.9], color: [0.62, 0.5, 0.45] }),
      brickDark: M.create('brick', { rows: 12, cols: 4, soot: 1.0, repeat: [1 / 0.9, 1 / 0.9], color: [0.3, 0.22, 0.2] }),
      stone: M.create('stone', { rows: 2, cols: 3, moss: 0.1, damp: 0.6, repeat: [1.6, 1.6], color: [0.6, 0.58, 0.55] }),
      benchTop: M.create('wood', { clearcoat: 0.0, species: 'oak', boards: 0, polish: 0.15, wear: 0.9, repeat: [1, 1], color: [0.75, 0.62, 0.5] }),
      benchFrame: M.create('wood', { clearcoat: 0.0, species: 'oak', boards: 0, polish: 0.1, wear: 0.8, repeat: [1.5, 1.5], color: [0.45, 0.35, 0.27] }),
      labTop: M.create('walnut', { repeat: [1.2, 1.2], color: [0.62, 0.5, 0.43], clearcoat: 0.0, roughness: 1.5 }),
      labFrame: M.create('walnut', { repeat: [2, 2], color: [0.5, 0.4, 0.34] }),
      door: M.create('wood', { clearcoat: 0.0, species: 'oak', boards: 5, boardLength: 3, polish: 0.05, wear: 1.0, repeat: [1.1, 1.1], color: [0.32, 0.24, 0.18] }),
      slat: M.create('wood', { clearcoat: 0.0, species: 'oak', boards: 0, polish: 0.2, wear: 0.8, repeat: [3, 3], color: [0.42, 0.3, 0.2] }),
      crate: M.create('wood', { clearcoat: 0.0, species: 'pine', boards: 0, polish: 0.0, wear: 1.0, repeat: [2, 2], color: [0.72, 0.6, 0.45] }),
      brass: M.create('brass', { tarnish: 0.45, polish: 0.6, repeat: [3, 3] }),
      trunk: M.create('leather', { color: [0.16, 0.08, 0.045], wear: 0.8, repeat: [2.5, 2.5] }),
      leatherStrap: M.create('leather', { color: [0.1, 0.05, 0.03], wear: 0.5, repeat: [6, 6] }),
      painting: M.create('painting', { subject: 1, seed: 7, aspect: 0.65 / 0.85, varnish: 0.8, cracks: 0.8, size: 512 }),
      linen: pbr(linen.withRepeat(2, 2), { name: 'linen', side: THREE.DoubleSide, envMapIntensity: 0.25 }),
      iron: M.basic('iron'),
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
    };
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
      const bal = G.latheFromProfile([[0, 0], [0.018, 0], [0.018, 0.08], [0.012, 0.12], [0.022, 0.3], [0.012, 0.5], [0.016, 0.7], [0.012, 0.76], [0.018, 0.8], [0, 0.8]], 10);
      for (let z = STAIR.z0 + 0.1; z < STAIR.z1 - 0.12; z += 0.13) {
        const b = add(at(new THREE.Mesh(bal, mat.timberDark), rx, 0.09, z));
        if (Math.abs(z - 2.9) < 0.07) { b.rotation.z = 0.5; b.position.y = 0.2; b.position.x += 0.18; }   // one broken baluster
      }
    }

    // ================================================================ roof: sarking, rafters, purlins, ridge, trusses
    const sideU = (s) => V3(-s * Math.cos(SLOPE), Math.sin(SLOPE), 0);             // eave -> ridge, s = -1 left, +1 right
    const sideN = (s) => V3(s * Math.sin(SLOPE) * -1, -Math.cos(SLOPE), 0).multiplyScalar(1);   // inward (down into the room)
    {
      // sarking on both slopes
      for (const s of [-1, 1]) {
        const e0 = V3(s * HALF, KNEE, Z0), e1 = V3(s * HALF, KNEE, Z1), r0 = V3(0, RIDGE, Z0), r1 = V3(0, RIDGE, Z1);
        const g = s < 0 ? quad(e1, e0, r0, r1) : quad(e0, e1, r1, r0);
        const m = add(new THREE.Mesh(g, mat.sarking)); m.name = 'sarking';
        m.userData.noShadow = true;
      }
      // common rafters
      const zs = [];
      for (let z = Z0 + 0.12; z <= Z1 - 0.1; z += RAFTER.step) zs.push(z);
      for (const s of [-1, 1]) {
        const u = sideU(s), n = sideN(s);
        for (const z of zs) {
          const len = SLOPE_LEN + 0.05;
          const mid = V3(s * HALF / 2, KNEE + RISE / 2, z).addScaledVector(n, RAFTER.d / 2);
          const k = Math.round(z * 10);
          add(new THREE.Mesh(orient(beam(G, RAFTER.w, RAFTER.d, len, 0.01), mid, u, n.clone().negate()), k % 3 === 0 ? mat.timberDark : mat.timber));
        }
        // purlin under the rafters at mid-slope
        const pm = V3(s * HALF * 0.52, KNEE + RISE * 0.48, (Z0 + Z1) / 2).addScaledVector(n, RAFTER.d + 0.1);
        add(new THREE.Mesh(orient(beam(G, 0.16, 0.2, Z1 - Z0, 0.015), pm, V3(0, 0, 1), n.clone().negate()), mat.timberDark));
        // wall plate on the knee wall
        add(new THREE.Mesh(orient(beam(G, 0.16, 0.12, Z1 - Z0, 0.012), V3(s * (HALF - 0.08), KNEE - 0.06, (Z0 + Z1) / 2), V3(0, 0, 1), V3(0, 1, 0)), mat.timberDark));
      }
      // ridge beam
      add(new THREE.Mesh(orient(beam(G, 0.12, 0.26, Z1 - Z0, 0.015), V3(0, RIDGE - 0.15, (Z0 + Z1) / 2), V3(0, 0, 1), V3(0, 1, 0)), mat.timberDark));
      // king-post trusses: principal rafters, collar, king post, struts
      for (const z of TRUSS_Z) {
        for (const s of [-1, 1]) {
          const u = sideU(s), n = sideN(s);
          const mid = V3(s * HALF / 2, KNEE + RISE / 2, z + 0.11).addScaledVector(n, RAFTER.d + 0.1);
          add(new THREE.Mesh(orient(beam(G, 0.14, 0.2, SLOPE_LEN - 0.3, 0.018), mid, u, n.clone().negate()), mat.timberDark));
          // strut from king post foot to principal
          const a = V3(0, COLLAR_Y + 0.1, z + 0.11), b = V3(s * 1.15, roofY(1.15) - 0.55, z + 0.11);
          add(new THREE.Mesh(orient(beam(G, 0.1, 0.1, a.distanceTo(b), 0.012), a.clone().add(b).multiplyScalar(0.5), b.clone().sub(a), V3(0, 0, 1).cross(b.clone().sub(a)).normalize()), mat.timber));
        }
        const cw = 2 * (HALF * (1 - (COLLAR_Y - KNEE) / RISE)) - 0.35;
        add(new THREE.Mesh(orient(beam(G, 0.14, 0.22, cw, 0.018), V3(0, COLLAR_Y, z + 0.11), V3(1, 0, 0), V3(0, 1, 0)), mat.timberDark));
        add(new THREE.Mesh(orient(beam(G, 0.14, 0.14, RIDGE - COLLAR_Y - 0.25, 0.015), V3(0, (RIDGE + COLLAR_Y) / 2 - 0.12, z + 0.11), V3(0, 1, 0), V3(0, 0, 1)), mat.timber));
        // iron strap at the king-post joint
        add(at(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.15), mat.iron), 0, COLLAR_Y + 0.08, z + 0.11));
      }
      // lighter collar ties between the trusses
      for (const z of zs) {
        if (TRUSS_Z.some((t) => Math.abs(t - z) < 0.5) || Math.round((z - Z0) / RAFTER.step) % 2 || z < Z0 + 0.6 || z > Z1 - 0.6) continue;
        const y = 3.05;
        const w = 2 * (HALF * (1 - (y - KNEE) / RISE)) - 0.25;
        add(new THREE.Mesh(orient(beam(G, 0.06, 0.14, w, 0.01), V3(0, y, z + RAFTER.w / 2 + 0.03), V3(1, 0, 0), V3(0, 1, 0)), mat.timber));
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
      const g = new THREE.ShapeGeometry(s, 48);
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
      // stone surround of the oculus: moulded ring + keystones
      const ringProf = [V2(OCULUS.r - 0.0, 0), V2(OCULUS.r + 0.02, 0.0), V2(OCULUS.r + 0.03, 0.04), V2(OCULUS.r + 0.09, 0.05), V2(OCULUS.r + 0.12, 0.03), V2(OCULUS.r + 0.16, 0.03), V2(OCULUS.r + 0.17, 0.0)];
      const ring = new THREE.Mesh(new THREE.LatheGeometry(ringProf.map((p) => V2(p.x, p.y)), 72), mat.stone);
      ring.rotation.x = Math.PI / 2; ring.position.set(OCULUS.x, OCULUS.y, Z0 + 0.0); add(ring);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 2;
        const ks = add(at(new THREE.Mesh(bevelBox(G, 0.14, 0.2, 0.08, 0.01), mat.stone), OCULUS.x + Math.cos(a) * (OCULUS.r + 0.1), OCULUS.y + Math.sin(a) * (OCULUS.r + 0.1), Z0 + 0.03));
        ks.rotation.z = a - Math.PI / 2;
      }
      // reveal (deep brick barrel)
      const revMat = mat.brick.clone(); revMat.side = THREE.BackSide;
      const rev = new THREE.Mesh(new THREE.CylinderGeometry(OCULUS.r, OCULUS.r, WALL_T, 64, 1, true), revMat);
      rev.rotation.x = Math.PI / 2; rev.position.set(OCULUS.x, OCULUS.y, Z0 - WALL_T / 2); add(rev);
      // window frame: outer ring, inner ring, 8 spokes (iron), set back in the reveal
      const wz = Z0 - WALL_T * 0.55;
      const frameRing = (r, t) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 72), mat.blackEnamel); m.position.set(OCULUS.x, OCULUS.y, wz); m.castShadow = true; return add(m); };
      frameRing(OCULUS.r - 0.02, 0.028); frameRing(0.2, 0.018); frameRing(0.42, 0.01);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const sp = add(new THREE.Mesh(new THREE.BoxGeometry(OCULUS.r - 0.22, 0.03, 0.035), mat.blackEnamel));
        sp.position.set(OCULUS.x + Math.cos(a) * (0.2 + (OCULUS.r - 0.22) / 2), OCULUS.y + Math.sin(a) * (0.2 + (OCULUS.r - 0.22) / 2), wz);
        sp.rotation.z = a;
      }
      // grimy glass with one broken pane
      const glassMat = M.create('glass', { dirt: 0.75, transparent: true, opacity: 0.18 });
      const shape = new THREE.Shape(); shape.absarc(0, 0, OCULUS.r - 0.02, 0, Math.PI * 2);
      const brk = new THREE.Path(); const a0 = Math.PI * 1.15;
      brk.moveTo(Math.cos(a0) * 0.22, Math.sin(a0) * 0.22); brk.lineTo(Math.cos(a0) * 0.5, Math.sin(a0) * 0.5); brk.lineTo(Math.cos(a0 + 0.35) * 0.38, Math.sin(a0 + 0.35) * 0.38); brk.lineTo(Math.cos(a0 + 0.55) * 0.26, Math.sin(a0 + 0.55) * 0.26);
      shape.holes.push(brk);
      const gl = add(new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), glassMat)); gl.position.set(OCULUS.x, OCULUS.y, wz + 0.005); gl.userData.noShadow = true; gl.userData.noBake = true;
      // sill of slate
      add(at(new THREE.Mesh(bevelBox(G, 0.5, 0.05, 0.12, 0.01), mat.stone), OCULUS.x, OCULUS.y - OCULUS.r - 0.05, Z0 + 0.04));
    }
    // sky beyond the oculus: the moon set on the line of sight from the main viewpoint
    const skyTex = moonSkyTexture(ctx.textures);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex.map, color: new THREE.Color(1, 1, 1).multiplyScalar(1.25), toneMapped: false, name: 'sky' });
    {
      const card = add(new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), skyMat));
      card.position.set(-0.55, 3.19, Z0 - 2.5); card.userData.noShadow = true; card.name = 'skycard';
    }

    // ---------------------------------------------------------------- the door, ajar on a glowing stair
    const doorPivot = dyn(new THREE.Group());
    {
      const W = DOOR.x1 - DOOR.x0;
      // jambs + lintel (heavy oak), reveal sides
      add(at(new THREE.Mesh(beam(G, 0.12, DOOR.h + 0.12, WALL_T + 0.04, 0.012), mat.timberDark), DOOR.x0 - 0.06, (DOOR.h + 0.12) / 2, Z0 - WALL_T / 2 + 0.02));
      add(at(new THREE.Mesh(beam(G, 0.12, DOOR.h + 0.12, WALL_T + 0.04, 0.012), mat.timberDark), DOOR.x1 + 0.06, (DOOR.h + 0.12) / 2, Z0 - WALL_T / 2 + 0.02));
      add(at(new THREE.Mesh(beam(G, W + 0.36, 0.16, WALL_T + 0.06, 0.014), mat.timberDark), (DOOR.x0 + DOOR.x1) / 2, DOOR.h + 0.08, Z0 - WALL_T / 2 + 0.03));
      add(at(new THREE.Mesh(bevelBox(G, W + 0.2, 0.04, WALL_T + 0.08, 0.008), mat.timberDark), (DOOR.x0 + DOOR.x1) / 2, 0.02, Z0 - WALL_T / 2 + 0.04));
      // leaf: ledged and braced planks, strap hinges, ring handle
      const leaf = new THREE.Group();
      const lw = W - 0.02, lh = DOOR.h - 0.03;
      for (let i = 0; i < 5; i++) leaf.add(at(new THREE.Mesh(bevelBox(G, lw / 5 - 0.004, lh, 0.04, 0.006), mat.door), -lw + (i + 0.5) * (lw / 5), lh / 2 + 0.01, 0));
      for (const y of [0.25, lh / 2, lh - 0.25]) leaf.add(at(new THREE.Mesh(bevelBox(G, lw - 0.06, 0.14, 0.03, 0.006), mat.door), -lw / 2, y, 0.035));
      const br = new THREE.Mesh(bevelBox(G, 0.11, Math.hypot(lw - 0.1, lh / 2 - 0.3), 0.026, 0.006), mat.door); br.position.set(-lw / 2, (0.25 + lh / 2) / 2 + 0.06, 0.035); br.rotation.z = Math.atan2(lw - 0.1, lh / 2 - 0.3); leaf.add(br);
      for (const y of [0.25, lh - 0.25]) {
        leaf.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.035, 0.008), mat.iron), -0.26, y, 0.054));
        leaf.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 10), mat.iron), 0, y, 0.0));
      }
      const ringH = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.007, 8, 20), mat.iron); ringH.position.set(-lw + 0.12, 1.0, 0.07); leaf.add(ringH);
      leaf.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12).rotateX(Math.PI / 2), mat.iron), -lw + 0.12, 1.05, 0.06));
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
      for (let i = 0; i < 8; i++) {
        add(at(new THREE.Mesh(bevelBox(G, pw, 0.03, 0.3, 0.005), mat.benchFrame), cx, 0.18 * (i + 1), PZ - 0.25 - i * 0.26));
        add(at(new THREE.Mesh(new THREE.BoxGeometry(pw, 0.18, 0.02), mat.timberDark), cx, 0.18 * i + 0.09, PZ - 0.1 - i * 0.26));
      }
      const hell = new THREE.MeshBasicMaterial({ map: hellGlowTexture(ctx.textures).map, color: new THREE.Color(1, 1, 1).multiplyScalar(5.0), toneMapped: false, name: 'hellglow' });
      const hg = add(new THREE.Mesh(new THREE.PlaneGeometry(pw, 3.2), hell)); hg.position.set(cx, 1.5, PZ - PL + 0.02); hg.userData.noShadow = true;
      // someone waits on the stair: a tall, thin silhouette against the glow
      const fig = new THREE.Group(); fig.name = 'staufSilhouette';
      const shade = fx.ghostMaterial({ color: 0xffb27a, rimColor: 0xffe6c8, opacity: 0.55, intensity: 1.4 });
      fig.add(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.24, 0.0], [0.2, 0.4], [0.17, 0.9], [0.2, 1.3], [0.22, 1.42], [0.09, 1.5], [0.06, 1.55], [0, 1.56]], 16), shade));
      fig.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), shade), 0, 1.66, 0));
      fig.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.17, 12), shade), 0, 1.82, 0));
      fig.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 16), shade), 0, 1.74, 0));
      for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.62, 4, 8), shade); arm.position.set(sx * 0.21, 1.08, 0.02); arm.rotation.z = sx * 0.08; fig.add(arm); }
      const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.9, 6), shade); cane.position.set(0.3, 0.45, 0.08); cane.rotation.z = -0.12; fig.add(cane);
      fig.traverse((o) => { if (o.isMesh) { o.userData.noBake = true; o.userData.noShadow = true; o.renderOrder = 7; } });
      fig.position.set(cx - 0.1, 0.18 * 3, PZ - 0.25 - 2 * 0.26 - 0.02); fig.rotation.y = -0.2; fig.scale.setScalar(0.95);
      add(fig);
    }

    // ================================================================ front gable (stair end), chimney stack
    {
      gable(Z1, [], mat.lath, true).name = 'frontGable';
      // a small louvred vent high in the front gable
      const vy = 3.1;
      add(at(new THREE.Mesh(beam(G, 0.7, 0.5, 0.06, 0.01), mat.timberDark), 0, vy, Z1 - 0.03));
      for (let i = 0; i < 5; i++) { const l = add(at(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.012, 0.08), mat.timber), 0, vy - 0.18 + i * 0.09, Z1 - 0.07)); l.rotation.x = 0.6; }
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
      // a half-carved puppet head, chisel and shavings
      add(at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 18, 14), mat.benchTop), -0.25, BT + 0.05, BENCH.z + 0.02));
      for (let i = 0; i < 14; i++) {
        const sh = add(new THREE.Mesh(new THREE.TorusGeometry(0.012 + (i % 3) * 0.004, 0.003, 4, 10, Math.PI * 1.5), mat.benchTop));
        sh.position.set(-0.3 + Math.sin(i * 2.3) * 0.12, BT + 0.004, BENCH.z + 0.12 + Math.cos(i * 1.7) * 0.08); sh.rotation.set(Math.PI / 2 + (i % 2) * 0.3, 0, i);
      }
      // toys on the shelves
      const doll = buildDoll(ctx, mat, { dress: mat.toyBlue }); doll.position.set(-2.2, 1.565, Z0 + 0.16); doll.rotation.y = 0.2; add(doll);
      const doll2 = buildDoll(ctx, mat, { dress: mat.toyRed }); doll2.position.set(-1.75, 1.565, Z0 + 0.18); doll2.rotation.y = -0.4; doll2.rotation.z = 0.35; add(doll2);
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
      const scope = buildMicroscope(ctx, mat, 1.7);
      scope.position.set(TABLE.x + 0.55, TABLE_H, TABLE.z - 0.15); scope.rotation.y = -0.6; add(scope);
      const gw = buildGlassware(ctx, mat); gw.position.set(TABLE.x - 0.52, TABLE_H, TABLE.z - 0.24); gw.rotation.y = 0.3; add(gw);
      const bj = buildBellJar(ctx, mat); bj.position.set(TABLE.x + 0.55, TABLE_H, TABLE.z + 0.22); add(bj);
      // brass stage under the specimen plate (three claw feet)
      const st = new THREE.Group();
      st.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0.03], [0.07, 0.03], [0.08, 0.04], [0.06, 0.05], [0, 0.05]], 24), mat.brass), 0, 0, 0));
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.3; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.07, 8), mat.brass); l.position.set(Math.cos(a) * 0.1, 0.02, Math.sin(a) * 0.1); l.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); st.add(l); }
      st.position.set(PLATE.x, TABLE_H, PLATE.z); add(st);
      // notebook and pen
      const book = add(at(new THREE.Mesh(bevelBox(G, 0.2, 0.025, 0.28, 0.004), mat.trunk), TABLE.x + 0.12, TABLE_H + 0.0125, TABLE.z + 0.3)); book.rotation.y = 0.35;
      const pg = add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.25).rotateX(-Math.PI / 2), mat.vellum), TABLE.x + 0.12, TABLE_H + 0.0255, TABLE.z + 0.3)); pg.rotation.y = 0.35;
      const pen = add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.15, 8), mat.black), TABLE.x + 0.18, TABLE_H + 0.03, TABLE.z + 0.28)); pen.rotation.set(Math.PI / 2, 0, 0.9);
      // rug under the table
      const rug = add(new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.6).rotateX(-Math.PI / 2), M.create('rug', { palette: 'faded', aspect: 2.3 / 1.6, knots: 160, wear: 0.85, fringe: 0.03, seed: 77, color: [0.55, 0.5, 0.5] })));
      rug.position.set(TABLE.x - 0.05, 0.006, TABLE.z + 0.1); rug.rotation.y = 0.08; rug.name = 'rug';
      // a stool
      const stool = new THREE.Group();
      stool.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.17, 0], [0.18, 0.015], [0.17, 0.035], [0, 0.04]], 28), mat.labFrame), 0, 0.6, 0));
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.62, 8), mat.labFrame); l.position.set(Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12); l.rotation.set(Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15); stool.add(l); }
      stool.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 6, 24).rotateX(Math.PI / 2), mat.labFrame), 0, 0.22, 0));
      stool.position.set(-0.45, 0, -0.85); add(stool);
    }
    // hanging lamp over the table (from the collar of the rear truss)
    const LAMP_X = PLATE.x + 0.05, LAMP_Z = TRUSS_Z[0] + 0.11;
    const lamp = dyn(buildHangingLamp(ctx, mat, { drop: COLLAR_Y - 0.11 - 2.05 }));
    lamp.position.set(LAMP_X, COLLAR_Y - 0.11, LAMP_Z); add(lamp);
    const lampFlame = fx.flame({ height: 0.045, width: 0.014, intensity: 4, seed: 11 });
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
      const dummy = buildDressForm(ctx, mat); dummy.position.set(2.7, 0, -0.2); dummy.rotation.y = -0.9; add(dummy);
      const cage = buildBirdCage(ctx, mat); cage.position.set(-3.05, 0.44 + 0.12, -0.5); add(cage);
      // dust-sheeted furniture: an armchair and a tall mirror/wardrobe
      const chairTop = (x, z) => { const back = THREE.MathUtils.smoothstep(-z, 0.05, 0.3); const arms = THREE.MathUtils.smoothstep(Math.abs(x), 0.25, 0.36); return 0.45 + back * 0.5 + arms * 0.18 * (1 - back) + Math.sin(x * 9) * 0.01; };
      const sheet1 = add(new THREE.Mesh(dustSheetGeometry({ hw: 0.42, hd: 0.42, topH: chairTop, seed: 2, seg: 90 }), mat.linen));
      sheet1.position.set(2.85, 0, 1.0 + 1.8); sheet1.rotation.y = -Math.PI / 2 - 0.4;
      const tallTop = (x, z) => 1.22 - Math.abs(x) * 0.12 + Math.sin(z * 12) * 0.01;
      const sheet2 = add(new THREE.Mesh(dustSheetGeometry({ hw: 0.4, hd: 0.2, topH: tallTop, seed: 5, seg: 80, flare: 0.04 }), mat.linen));
      sheet2.position.set(2.75, 0, -3.45); sheet2.rotation.y = -Math.PI / 2 + 0.2;
      const sofaTop = (x, z) => 0.42 + THREE.MathUtils.smoothstep(-z, 0.1, 0.35) * 0.35 + THREE.MathUtils.smoothstep(Math.abs(x), 0.75, 0.9) * 0.15;
      const sheet3 = add(new THREE.Mesh(dustSheetGeometry({ hw: 0.95, hd: 0.4, topH: sofaTop, seed: 9, seg: 110 }), mat.linen));
      sheet3.position.set(-3.0, 0, 2.2 - 0.3); sheet3.rotation.y = Math.PI / 2;
      // crates
      const c1 = buildCrate(ctx, mat, { w: 0.6, h: 0.45, d: 0.5, seed: 0 }); c1.position.set(-3.1, 0, -3.6); c1.rotation.y = 0.2; add(c1);
      const c2 = buildCrate(ctx, mat, { w: 0.5, h: 0.38, d: 0.42, seed: 1 }); c2.position.set(-3.05, 0.465, -3.55); c2.rotation.y = -0.15; add(c2);
      const c3 = buildCrate(ctx, mat, { w: 0.55, h: 0.42, d: 0.5, seed: 2 }); c3.position.set(3.1, 0, -4.1); c3.rotation.y = -0.3; add(c3);
      const c4 = buildCrate(ctx, mat, { w: 0.7, h: 0.5, d: 0.55, seed: 3 }); c4.position.set(3.0, 0, 3.4); c4.rotation.y = 0.15; add(c4);
      // picture frames leaning on the right knee wall
      const fr = buildFrameStack(ctx, mat); fr.position.set(3.35, 0, -1.1); fr.rotation.y = -Math.PI / 2; add(fr);
      // the toy chest in the foreground, a ball rolled away from it, the bench chair
      const tc = buildToyChest(ctx, mat); tc.position.set(-1.25, 0, 1.15); tc.rotation.y = 0.55; add(tc);
      add(at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), mat.ball), -0.55, 0.06, 1.55));
      const tr = buildTrain(ctx, mat); tr.position.set(-0.75, 0, 1.95); tr.rotation.y = 2.2; add(tr);
      const chair = buildChair(ctx, mat); chair.position.set(-1.55, 0, BENCH.z + 0.85); chair.rotation.y = Math.PI + 0.35; add(chair);
      // coil of rope and a hat box
      add(at(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 28).rotateX(Math.PI / 2), mat.rope), 2.6, 0.035, 0.75));
      add(at(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.034, 8, 28).rotateX(Math.PI / 2), mat.rope), 2.62, 0.1, 0.74));
      const hb = add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 32), mat.toyGreen), 3.15, 0.11, 0.6)); void hb;
      add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 32), mat.toyGreen), 3.15, 0.235, 0.6));
    }

    // ================================================================ cobwebs
    {
      const webTex = [cobwebTexture(ctx.textures, 1), cobwebTexture(ctx.textures, 2), cobwebTexture(ctx.textures, 3)];
      const webMats = webTex.map((t) => new THREE.MeshStandardMaterial({ map: t, color: 0xcfd2d8, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, roughness: 1, emissive: new THREE.Color(0.2, 0.22, 0.28), emissiveMap: t, name: 'cobweb' }));
      const web = (size, pos, rot, k = 0, sx = 1) => {
        const g = new THREE.PlaneGeometry(size, size); g.translate(size / 2, -size / 2, 0);
        const w = add(new THREE.Mesh(g, webMats[k % 3]));
        w.position.copy(pos); w.rotation.set(...rot); w.scale.x = sx; w.renderOrder = 4; w.userData.noShadow = true;
        return w;
      };
      // corners between the collar beams and the principals (truss plane)
      for (const z of TRUSS_Z) {
        const cx = HALF * (1 - (COLLAR_Y - KNEE) / RISE) - 0.38;
        web(0.55, V3(-cx, COLLAR_Y + 0.55, z + 0.11), [0, 0, 0], 0);
        web(0.5, V3(cx, COLLAR_Y + 0.5, z + 0.11), [0, 0, 0], 1, -1);
        web(0.4, V3(0.07, RIDGE - 0.3, z + 0.11), [0, 0, 0], 2);
      }
      // across the rafter bays near the ridge
      for (const [x, z, k] of [[0.06, -3.6, 0], [-0.06, -0.3, 1], [0.06, 2.8, 2], [-0.06, -4.8, 1]]) {
        web(0.6, V3(x, RIDGE - 0.3, z), [0, Math.PI / 2, 0], k, x > 0 ? 1 : -1);
      }
      // oculus: a big web across the lower left of the window
      web(0.55, V3(OCULUS.x - OCULUS.r + 0.02, OCULUS.y + 0.1, Z0 - 0.04), [0, 0, -Math.PI / 2 + 0.2], 0);
      web(0.4, V3(OCULUS.x + OCULUS.r - 0.05, OCULUS.y + 0.25, Z0 - 0.03), [0, 0, Math.PI], 2);
      // door frame head corners
      web(0.35, V3(DOOR.x0 - 0.01, DOOR.h + 0.0, Z0 + 0.06), [0, 0, 0], 1);
      // knee wall / rafter feet
      for (const [s, z, k] of [[-1, -2.8, 0], [1, -3.3, 1], [-1, 0.3, 2], [1, 2.2, 0]]) {
        web(0.5, V3(s * (HALF - 0.02), KNEE + 0.1, z), [0, s < 0 ? Math.PI / 2 : -Math.PI / 2, s < 0 ? -0.75 : 0.75], k);
      }
      // the bench to the wall
      web(0.4, V3(BENCH.x - 1.25, 0.86, Z0 + 0.03), [0, 0, Math.PI / 2], 2);
      // hanging strands from the collars
      const strandMat = new THREE.MeshStandardMaterial({ color: 0xbfc4cc, transparent: true, opacity: 0.12, depthWrite: false, roughness: 1, side: THREE.DoubleSide, emissive: new THREE.Color(0.03, 0.035, 0.05), name: 'strands' });
      for (let i = 0; i < 6; i++) {
        const z = TRUSS_Z[i % 2] + 0.11 + 0.05 * (i % 3 - 1);
        const x = -1.3 + (i * 0.37) % 2.6;
        const len = 0.25 + ((i * 0.53) % 0.4);
        const pts = [V3(0, 0, 0), V3(0.01, -len * 0.4, 0.005), V3(-0.005, -len * 0.8, 0), V3(0.012, -len, 0.01)];
        const s = add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.0015, 3), strandMat));
        s.position.set(x, COLLAR_Y - 0.11, z); s.renderOrder = 4; s.userData.noShadow = true;
      }
    }

    // ================================================================ lights
    // the moon through the oculus (shadowed, so the spokes print on the floor)
    const ocC = V3(OCULUS.x, OCULUS.y, Z0 - WALL_T / 2);
    const moonAim = V3(PLATE.x + 0.15, 0.0, -0.4);
    const moonDir = moonAim.clone().sub(ocC).normalize();
    const moonPos = ocC.clone().addScaledVector(moonDir, -9);
    const moon = new THREE.SpotLight(0xa8bcff, 1500, 26, 0.105, 0.35, 2);
    moon.position.copy(moonPos); moon.target.position.copy(moonAim);
    moon.castShadow = Q.shadows;
    moon.shadow.mapSize.set(Math.max(1024, Q.shadowMapSize), Math.max(1024, Q.shadowMapSize));
    moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.04; moon.shadow.radius = Q.shadowRadius ?? 3;
    moon.shadow.camera.near = 6; moon.shadow.camera.far = 22;
    root.add(moon, moon.target);
    { const b = new THREE.PointLight(0x8094d0, 7, 9, 2); b.position.set(PLATE.x - 0.1, 0.35, -0.6); root.add(b); }
    root.add(new THREE.HemisphereLight(0x3a4c86, 0x1a120c, 2.6));
    root.add(fx.areaLight({ center: [OCULUS.x, OCULUS.y, Z0 - 0.05], normal: [0, -0.25, 1], width: 1.0, height: 1.0, color: 0x8ea6ff, intensity: 10 }));
    // the oil lamp over the microscope table: a shadowed downlight + soft omni
    const lampSpot = new THREE.SpotLight(0xffae5a, 20, 7, 1.15, 0.75, 2);
    lampSpot.position.set(LAMP_X, LAMP_Y, LAMP_Z); lampSpot.target.position.set(LAMP_X, 0, LAMP_Z + 0.05);
    lampSpot.castShadow = Q.shadows;
    lampSpot.shadow.mapSize.set(1024, 1024); lampSpot.shadow.bias = -0.0012; lampSpot.shadow.normalBias = 0.02; lampSpot.shadow.radius = 5;
    lampSpot.shadow.camera.near = 0.1; lampSpot.shadow.camera.far = 5;
    root.add(lampSpot, lampSpot.target);
    const lampGlow = new THREE.PointLight(0xffa050, 3.0, 8, 2); lampGlow.position.set(LAMP_X, LAMP_Y - 0.06, LAMP_Z); root.add(lampGlow);
    // workbench candles
    const candleLight = new THREE.PointLight(0xff9a48, 1.8, 3.5, 2); candleLight.position.set(-1.9, BT + 0.3, BENCH.z + 0.25); root.add(candleLight);
    // the furnace light from the stair beyond the door: a shadowed spot through the gap + red fill
    const doorCX = (DOOR.x0 + DOOR.x1) / 2;
    const hellSpot = new THREE.SpotLight(0xff5a24, 34, 12, 0.85, 0.5, 2);
    hellSpot.position.set(doorCX + 0.15, 1.45, Z0 - WALL_T - 0.22); hellSpot.target.position.set(doorCX - 1.0, 0.0, Z0 + 3.0);
    hellSpot.castShadow = Q.shadows;
    hellSpot.shadow.mapSize.set(1024, 1024); hellSpot.shadow.bias = -0.002; hellSpot.shadow.normalBias = 0.06; hellSpot.shadow.radius = 4;
    hellSpot.shadow.camera.near = 0.3; hellSpot.shadow.camera.far = 12;
    root.add(hellSpot, hellSpot.target);
    const passage = new THREE.PointLight(0xff4a18, 14, 3.0, 2); passage.position.set(doorCX, 1.5, Z0 - WALL_T - 1.9); root.add(passage);
    root.add(fx.areaLight({ center: [doorCX - 0.2, 0.95, Z0 + 0.02], normal: [0, 0, 1], width: 0.4, height: 1.8, color: 0xff5020, intensity: 3.0 }));
    // flicker
    const base = { lampSpot: lampSpot.intensity, lampGlow: lampGlow.intensity, candle: candleLight.intensity, hell: hellSpot.intensity, passage: passage.intensity };
    ctx.onUpdate((dt, t) => {
      const f = 0.95 + 0.035 * Math.sin(t * 7.3) * Math.sin(t * 2.9) + 0.015 * Math.sin(t * 17.1);
      lampSpot.intensity = base.lampSpot * f; lampGlow.intensity = base.lampGlow * f;
      candleLight.intensity = base.candle * (0.88 + 0.12 * Math.sin(t * 9.7) * Math.sin(t * 3.1 + 1));
      const h = 0.85 + 0.1 * Math.sin(t * 3.3) * Math.sin(t * 1.3 + 2) + 0.05 * Math.sin(t * 11.0);
      hellSpot.intensity = base.hell * h * hellBoost; passage.intensity = base.passage * h * hellBoost;
      // the lamp sways a hair on its chain
      lamp.rotation.z = Math.sin(t * 0.7) * 0.012; lamp.rotation.x = Math.sin(t * 0.53 + 1) * 0.008;
    });
    let hellBoost = 1;

    // ================================================================ broken slates: slivers of moon through the roof
    const holes = [{ s: -1, x: -1.9, z: -2.0, w: 0.42, h: 0.6 }, { s: 1, x: 1.35, z: -3.45, w: 0.38, h: 0.52 }];
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
      ln.position.set(-3.08, 0.36 + 0.13, 0.45); add(ln);
      const ll = new THREE.PointLight(0xff9448, 1.6, 4, 2); ll.position.set(-3.0, 0.62, 0.45); root.add(ll);
      ctx.onUpdate((dt, t) => { ll.intensity = 1.6 * (0.9 + 0.1 * Math.sin(t * 8.1) * Math.sin(t * 2.7)); });
    }

    let solvedCine = false, puzzleActive = false;
    // ================================================================ volumetrics
    const shafts = [];
    {
      // round moon beam: a LightShaft with its cross-section made circular and the spoke pattern carved in
      const right = V3(OCULUS.r * 0.95, 0, 0), up = V3(0, OCULUS.r * 0.95, 0);
      const sh = new LightShaft({ timeUniform: ctx.time, steps: Q.volumetricSteps, center: V3(OCULUS.x, OCULUS.y, Z0 + 0.03), right, up, direction: moonDir, length: 6.8, color: 0x9fb6ff, intensity: 0.42, softness: 0.22, falloff: 0.9, panes: [0, 0], noise: 0.75 });
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
      const dsh = fx.shaft({ center: V3(DOOR.x0 + dw + 0.01, 0.98, Z0 + 0.05), right: V3(dw, 0, 0), up: V3(0, 0.93, 0), direction: V3(-0.35, -0.22, 1).normalize(), length: 3.6, color: 0xff6a30, intensity: 0.5, softness: 0.4, falloff: 1.3, panes: [0, 0], noise: 0.8 });
      add(dsh); shafts.push(dsh);
      for (const hs of holeShafts) { const sh2 = fx.shaft({ ...hs, direction: moonDir, length: 5.5, color: 0x9fb6ff, intensity: 0.3, softness: 0.75, falloff: 0.7, panes: [0, 0], noise: 0.8 }); add(sh2); shafts.push(sh2); }
      // soft-saturate the in-scattering so a beam seen end-on does not white out the frame
      for (const sh of shafts) { sh.material.fragmentShader = sh.material.fragmentShader.replace('float v = acc / steps * lenW;', 'float v = acc / steps * lenW; v = (1.0 - exp(-v * 1.6)) / 1.6;'); sh.material.needsUpdate = true; }
    }
    // fade beams the camera stands inside (the haze would otherwise fill the whole screen)
    {
      const camB = new THREE.Vector3();
      const beams = shafts.map((sh) => ({ sh, i0: sh.material.uniforms.uIntensity.value }));
      ctx.onUpdate(() => {
        if (puzzleActive) return;
        for (const b of beams) {
          const u = b.sh.material.uniforms;
          camB.copy(ctx.camera.position).sub(u.uOrigin.value).applyMatrix3(u.uInv.value);
          const r = Math.hypot(camB.x, camB.y);
          const inside = camB.z > -0.05 && camB.z < 1.05 ? 1 - THREE.MathUtils.smoothstep(r, 0.9, 2.2) : 0;
          u.uIntensity.value = b.i0 * (1 - 0.8 * inside);
        }
      });
    }
    const dust = fx.dust({ box: new THREE.Box3(V3(-2.0, 0.2, Z0 + 0.2), V3(2.6, 3.4, 1.5)), count: 3200, shafts, size: 0.011, intensity: 2.2, ambient: 0.05 });
    add(dust);
    add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.1, 0, Z0 + 0.1), V3(X1 - 0.1, 0.5, Z1 - 0.2)), color: 0x0a0f1a, litColor: 0x2c3a58, density: 0.45, heightFalloff: 4 }));
    add(fx.fog({ box: new THREE.Box3(V3(-2.5, 1.0, Z0 + 0.2), V3(2.5, 3.8, 1.0)), color: 0x10141e, litColor: 0x3a4664, density: 0.12, heightFalloff: 0.5 }));

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
      pz.setup = (p) => { puzzleActive = true; dust.visible = false; shafts.forEach((s, i) => { s.material.uniforms.uIntensity.value = i0[i] * 0.15; }); ctx.post.set({ exposure: 1.55, bloomStrength: 0.25, godRayWeight: 0.05, vignette: 0.6, dof: null }, ctx.shot ? 0 : 0.8); return setup0(p); };
      pz.teardown = (p) => { puzzleActive = false; dust.visible = true; shafts.forEach((s, i) => { s.material.uniforms.uIntensity.value = i0[i]; }); ctx.post.set({ exposure: ROOM_GRADE.exposure, bloomStrength: ROOM_GRADE.bloomStrength, godRayWeight: ROOM_GRADE.godRayWeight, vignette: ROOM_GRADE.vignette }, 0.8); return teardown0(p); };
    }
    if (ctx.state.isSolved(INFECTION_ID)) inf.applySolved();
    const hx = ctx.params.get('hexx');
    if (hx === 'mid') { inf.simulate(14, 5); }
    if (hx === 'sel') { inf.simulate(14, 5); const leg = inf.legal(); if (leg.length) inf.select(leg[0].from); }
    if (hx === 'solved') inf.applySolved();
    ctx.onUpdate((dt, t) => { if (!puzzleActive) inf.tick(dt, t); });

    // ================================================================ interactions
    let rock = 0, jackT = -1;
    ctx.onUpdate((dt, t) => {
      const horse = root.userData.horse;
      if (rock > 0) { rock = Math.max(0, rock - dt * 0.25); }
      horse.rotation.z = Math.sin(t * 2.4) * 0.12 * rock;
      if (jackT >= 0) jackT += dt;
    });
    const doorOpen = (k) => { doorPivot.rotation.y = DOOR.open + k * 0.65; hellBoost = 1 + k * 1.2; };
    if (ctx.state.isSolved(INFECTION_ID)) doorOpen(1);

    // ================================================================ nodes, edges, exits
    const nodes = {
      main: { position: [0.4, 1.6, 2.9], target: [-0.15, 1.62, -5.2], fov: 58, label: 'The attic', look: { yaw: [-55, 55], pitch: [-30, 30] } },
      stairs: { position: [-2.2, 1.62, 1.15], target: [-0.4, 1.4, -5.0], fov: 60, label: 'Top of the stairs', look: { yaw: [-60, 60], pitch: [-35, 25] } },
      stairs_down: { position: [-2.2, 1.62, 1.15], target: [-2.2, -0.6, 4.2], fov: 60, label: 'The stairs down' },
      table: { position: [1.6, 1.55, -0.2], target: [0.55, 0.82, -1.5], fov: 55, label: 'The microscope table', look: { yaw: [-60, 60], pitch: [-40, 25] } },
      bench: { position: [-1.25, 1.52, -2.85], target: [-1.35, 1.12, -5.2], fov: 56, label: 'Stauf\'s workbench', look: { yaw: [-60, 60], pitch: [-35, 35] } },
      window: { position: [-1.3, 1.5, -3.15], target: [-0.3, 2.7, -5.2], fov: 55, label: 'The round window', look: { yaw: [-50, 50], pitch: [-30, 40] } },
      door: { position: [1.05, 1.6, -2.75], target: [1.85, 1.22, -5.2], fov: 58, label: 'The glowing door', look: { yaw: [-50, 50], pitch: [-30, 25] } },
      back: { position: [1.1, 1.62, -3.3], target: [-0.9, 1.2, 4.6], fov: 60, label: 'Looking back', look: { yaw: [-60, 60], pitch: [-30, 30] } },
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
      { id: 'microscope', nodes: ['table'], box: { min: [TABLE.x + 0.4, TABLE_H, TABLE.z - 0.35], max: [TABLE.x + 0.75, TABLE_H + 0.5, TABLE.z + 0.0] }, cursor: 'examine', label: 'The microscope', onActivate: cap('The Microscope', 'Brass, and taller than any microscope has a right to be. Through the eyepiece something on the plate is moving — dividing — and it is looking back.') },
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
      { id: 'dummy', nodes: ['door', 'table', 'main'], box: { min: [2.45, 0.8, -0.45], max: [2.95, 1.5, 0.05] }, cursor: 'ghost', label: 'A dressmaker\'s dummy', onActivate: cap('The Dummy', 'It is wearing a tape measure like a noose. For a moment its shoulders seem to rise and fall.') },
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
    root.userData.merge = mergeStatic(root);

    const godRays = [{ position: V3(OCULUS.x, OCULUS.y, Z0 - 1.5), color: new THREE.Color(0.72, 0.8, 1.0), strength: 0.8, radius: 0.075 }];

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'stairs',
      grade: ROOM_GRADE,
      environment: { position: [0.2, 1.7, 0.6], intensity: 0.55 },
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
          const off = ctx.onUpdate((d) => { k = Math.min(1, k + d * 0.6); doorOpen(k * k * (3 - 2 * k)); if (k >= 1) off?.(); });
          ctx.audio.creak?.();
          ctx.post.set({ exposure: ROOM_GRADE.exposure * 1.08, saturation: 1.05 }, 2.0);
        }
        void dt;
      },
      dispose() { const d = window.__debug; if (d) { delete d.attic; if (d.solvers) delete d.solvers.attic; if (d.states) delete d.states.attic; } },
    };
  },
};
