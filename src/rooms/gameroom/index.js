import * as THREE from 'three';
import { baizeTexture, chessboardTexture, furTexture, nightSkyTexture, ballAtlas, cardAtlas, CARD_FACES, marbleNeroTexture, logTextures, sootTexture, antlerTexture, cofferTexture, huntPaintingTexture, ivoryTexture, persianRugTexture, castIronTexture, majolicaTileTexture } from './textures.js';
import { buildStag, buildBoar } from './trophy.js';
import { flockDamaskTexture, hairStrandTexture, glassEyeTexture, boxwoodTexture, marbleNero3Texture, oilPortraitTexture, engravingTexture, clubLeatherTexture, treeSilhouetteTexture } from './textures2.js';
import { clippedShaft, hazeCone } from './fx.js';
import {
  TABLE, buildBilliardTable, ballGeometry, cueGeometry, buildBilliardLamp, buildCueRack, buildSideChair, buildChesterfield,
  buildCardTable, buildGamesTable, buildFireplace, buildTrophy, buildSconce, taperedTube,
} from './props.js';
import { createQueensPuzzle, queensMeta, QUEENS_ID, queenGeometry } from './puzzleQueens.js';
import { mergeStatic } from './merge.js';
import { buildChesterfield2 } from './props2.js';
import { drapeGeometry, swagGeometry, jabotGeometry, tiebackGeometry } from './drapery.js';
import { buildScoreboard, buildPrint, buildDrinksCart, buildSpittoon, buildHatStand } from './clutter.js';

/**
 * The Game Room — upstairs, off the gallery. Stauf's gentlemen's retreat.
 *
 * A 6.6 x 8 x 3.7 m room: mahogany wainscot to the window sills, peacock-blue
 * damask above, a coffered mahogany ceiling. A full-size billiard table stands
 * under a three-shade green-glass lamp whose light hangs in cigar haze. Two tall
 * moonlit windows in the back wall, the left one falling across a games table
 * with an inlaid chessboard — the Queens puzzle. A marble fireplace with a
 * stag's head on the right wall, a cue rack and bead scoreboard on the left, a
 * card table by the door with a hand still dealt.
 *
 * Axes: x right as seen from the gallery door, z toward the door (front wall),
 * y up. Back wall (windows) at z = Z0.
 */

const X0 = -3.3, X1 = 3.3, Z0 = -4.0, Z1 = 4.0, H = 3.7;
const WAINS = 1.15;                                // wainscot / window sill height
const CROWN_H = 0.2, FRIEZE_H = 0.3;
const FRIEZE_Y = H - CROWN_H - FRIEZE_H;
const WIN = { w: 1.05, sill: WAINS, h: 2.0, depth: 0.36, xs: [-1.45, 1.45] };
const DOOR = { x: -1.7, w: 1.1, h: 2.55 };
const T = new THREE.Vector3(0.25, 0, -0.3);        // billiard table centre
const C = new THREE.Vector3(-1.6, 0, -2.85);       // games table (chessboard) centre
const FIRE_Z = -0.45;
const STAG_Z = -2.62;
const CARD = new THREE.Vector3(2.05, 0, 2.55);
const BOARD = 0.6, FIELD = BOARD * 0.76;
const ROOM_GRADE = { exposure: 2.1, contrast: 1.1, saturation: 0.84, shadowTint: [0.92, 1.0, 1.01], highlightTint: [1.07, 1.0, 0.88], splitAmount: 0.5, bloomStrength: 0.24, bloomThreshold: 1.75, godRayWeight: 0.24, godRayThreshold: 3.0, vignette: 0.45, aoIntensity: 1.1, aoRadius: 0.4 };

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

/** engine curtainGeometry can emit NaN in its top row; patch from the row below */
function fixNaN(g, segX) {
  const a = g.attributes.position.array;
  const row = (segX + 1) * 3;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) a[i] = Number.isFinite(a[i + row]) ? a[i + row] : 0;
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export default {
  id: 'gameroom',
  title: 'The Game Room',
  floorName: 'Upper Floor',
  map: { floor: 'upper', rect: [640, 70, 190, 190] },
  start: 'main',
  ambience: { wind: 0.55, creaks: 0.45, clock: 0.35, thunder: 0.2, rain: 0, heartbeat: 0, roomTone: 0.35 },
  music: { key: 43, mood: 'dread' },
  puzzles: [queensMeta],

  async build(ctx) {
    const { materials: M, geometry: G, fx } = ctx;
    const Q = ctx.quality;
    const big = Q.textureSize >= 2048 ? 2048 : 1024;
    const root = new THREE.Group();
    root.name = 'gameroom';
    const add = (o, parent = root) => { parent.add(o); return o; };

    // ================================================================ materials
    const baize = baizeTexture(ctx.textures, { color: [0.02, 0.24, 0.1] });
    const baizeSet = baize.withRepeat(2, 2);
    const mkBaize = (set, tint = 1) => new THREE.MeshPhysicalMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.ormMap, aoMap: set.ormMap, roughness: 1, metalness: 0, sheen: 0.5, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.25, 0.62, 0.36), color: new THREE.Color(tint, tint, tint), envMapIntensity: 0.3, name: 'baize' });
    const furSet = furTexture(ctx.textures, { a: [0.06, 0.04, 0.025], b: [0.27, 0.17, 0.09], key: 'stag2' }).withRepeat(7, 7);
    const boarSet = furTexture(ctx.textures, { a: [0.09, 0.07, 0.055], b: [0.44, 0.34, 0.25], key: 'boar3' }).withRepeat(8, 8);
    const furMat = (set) => new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.ormMap, aoMap: set.ormMap, roughness: 1, metalness: 0, envMapIntensity: 0.4, name: 'fur' });
    const mat = {
      wall: (() => {
        // dense flock damask, bottle green: velvet flock motif on a satin ground, 0.35 m repeat
        const t = flockDamaskTexture(ctx.textures).withRepeat(1 / 0.35, 1 / 0.35);
        return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: t.ormMap, aoMap: t.ormMap, roughness: 1, metalness: 0,
          sheen: 0.6, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.1, 0.17, 0.11), envMapIntensity: 0.35, color: new THREE.Color(1.25, 1.2, 1.15), name: 'flockDamask' });
      })(),
      ceiling: M.create('plaster', { color: [0.06, 0.08, 0.15], cracks: 0.25, stains: 0.45, repeat: [0.5, 0.5] }),
      floor: M.create('parquet', { species: 'oak', ratio: 5, planksAcross: 2, repeat: [1.0, 1.0], polish: 0.2, wear: 0.85, color: [0.5, 0.45, 0.43], clearcoat: 0.12, clearcoatRoughness: 0.5, macro: 0.6, macroScale: 1.4 }),
      wood: M.create('mahogany', { repeat: [1.4, 1.4], color: [0.6, 0.4, 0.34] }),
      panel: M.create('wood', { species: 'mahogany', boards: 0, polish: 0.6, repeat: [1.1, 1.1], clearcoat: 0.25, clearcoatRoughness: 0.45, color: [0.34, 0.22, 0.19] }),
      tableWood: M.create('mahogany', { repeat: [1.6, 1.6], color: [0.5, 0.31, 0.26] }),
      walnut: M.create('walnut', { repeat: [1.5, 1.5], envMapIntensity: 0.45 }),
      crown: M.create('gilded', { pattern: 0, repeats: 4, wear: 0.45, dirt: 0.55, repeat: [1 / 0.55, 1] }),
      frieze: M.create('gilded', { pattern: 6, repeats: 3, ground: 1, groundColor: [0.025, 0.05, 0.1], wear: 0.35, dirt: 0.5, repeat: [1 / 1.0, 1] }),
      gilt: M.create('gold', { wear: 0.45, dirt: 0.5, repeat: [2, 1] }),
      frame: M.create('gilded', { pattern: 1, repeats: 3, wear: 0.5, dirt: 0.7, repeat: [1 / 0.45, 1], roughness: 1.6, envMapIntensity: 0.6, color: [0.72, 0.66, 0.6] }),
      drape: M.create('velvet', { color: [0.15, 0.028, 0.034], crush: 0.35, repeat: [3.2, 3.2], side: THREE.DoubleSide, sheen: 1, sheenRoughness: 0.3, sheenColor: [0.69, 0.19, 0.23], roughness: 0.95, normalScale: 0.8 }),
      cord: new THREE.MeshPhysicalMaterial({ color: 0x9a7432, roughness: 0.45, metalness: 0.2, sheen: 0.6, sheenColor: new THREE.Color(1.0, 0.85, 0.5), name: 'cord' }),
      brass: M.create('brass', { tarnish: 0.3, polish: 0.75, repeat: [3, 3] }),
      glass: M.create('glass', { dirt: 0.6, transparent: true, opacity: 0.16, envMapIntensity: 1.6, roughness: 0.4 }),
      rug: (() => { const r = persianRugTexture(ctx.textures, { size: [3.0, 4.2], legs: [0.655, 1.225] }); return new THREE.MeshPhysicalMaterial({ map: r.map, normalMap: r.normalMap, normalScale: new THREE.Vector2(1.3, 1.3), roughnessMap: r.ormMap, aoMap: r.ormMap, roughness: 1, metalness: 0, sheen: 0.4, sheenRoughness: 0.7, sheenColor: new THREE.Color(0.55, 0.32, 0.26), envMapIntensity: 0.2, name: 'persianRug' }); })(),
      marble: null, marbleDark: null,
      brick: M.create('brick', { rows: 10, cols: 4, soot: 1.0, repeat: [1.2, 1.2], color: [0.14, 0.11, 0.1] }),
      leather: M.create('leather', { color: [0.24, 0.05, 0.035], wear: 0.55, buttons: 1, repeat: [2.5, 2.5] }),
      seat: M.create('leather', { color: [0.2, 0.06, 0.04], wear: 0.4, repeat: [3, 3] }),
      baize: mkBaize(baizeSet),
      cushion: mkBaize(baize.withRepeat(6, 6), 0.8),
      cardBaize: mkBaize(baize.withRepeat(3, 3), 0.9),
      dark: M.basic('black', { color: 0x0b0806 }),
      hole: new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.9, name: 'pocket' }),
      pearl: new THREE.MeshPhysicalMaterial({ color: 0xb8b0a0, roughness: 0.25, iridescence: 0.8, clearcoat: 1, name: 'pearl' }),
      ivory: new THREE.MeshPhysicalMaterial({ color: 0xe6d8b8, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: new THREE.Color(1, 0.95, 0.85), name: 'ivory' }),
      ebony: M.create('ebony', { repeat: [2, 2] }),
      maple: new THREE.MeshPhysicalMaterial({ color: 0xc89a5e, roughness: 0.35, clearcoat: 0.5, name: 'maple' }),
      tip: new THREE.MeshStandardMaterial({ color: 0x2a4a7a, roughness: 0.9, name: 'chalk' }),
      iron: M.basic('iron'),
      silver: M.basic('silver', { roughness: 0.3 }),
      crystal: M.basic('crystal', { envMapIntensity: 1.5, opacity: 0.3 }),
      fur: furMat(furSet),
      furBoar: furMat(boarSet),
      eye: new THREE.MeshPhysicalMaterial({ color: 0x080504, roughness: 0.05, clearcoat: 1, name: 'glassEye' }),
      antler: new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 0.6, name: 'antler' }),
      // acid-etched tulip shade: frosted, glowing hottest round the mantle low in the bowl, falling off to a cool rim
      globe: new THREE.MeshPhysicalMaterial({ color: 0x3a3028, emissive: new THREE.Color(1.0, 0.64, 0.34), emissiveIntensity: 2.0, roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.35, name: 'sconceGlobe',
        emissiveMap: ctx.textures.canvas('gameroom:tulipGlow', 4, 128, (c) => { const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#2a2a2a'); g.addColorStop(0.25, '#9a9a9a'); g.addColorStop(0.45, '#c8c8c8'); g.addColorStop(0.7, '#6a6a6a'); g.addColorStop(0.9, '#2e2e2e'); g.addColorStop(1, '#1a1a1a'); c.fillStyle = g; c.fillRect(0, 0, 4, 128); }, { tile: false }) }),
      shadeOuter: new THREE.MeshPhysicalMaterial({ color: 0x0a3618, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, emissive: new THREE.Color(0.1, 0.62, 0.24), emissiveIntensity: 1.3, side: THREE.FrontSide, envMapIntensity: 1.4, name: 'shadeGreen',
        // cased glass glows where it is thin and nearest the bulb: dark at the crown, bright toward the rim
        emissiveMap: ctx.textures.canvas('gameroom:shadeGlow', 4, 128, (c) => { const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#000'); g.addColorStop(0.35, '#151515'); g.addColorStop(0.8, '#7a7a7a'); g.addColorStop(0.93, '#d0d0d0'); g.addColorStop(1, '#ffffff'); c.fillStyle = g; c.fillRect(0, 0, 4, 128); }, { tile: false }) }),
      shadeInner: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe6b0).multiplyScalar(3.4), side: THREE.BackSide, toneMapped: false, name: 'shadeOpal' }),
      shadeRim: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0d0).multiplyScalar(2.2), toneMapped: false, name: 'shadeRim' }),
      bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.85, 0.6).multiplyScalar(8), toneMapped: false, name: 'bulb' }),
    };
    mat.leatherDark = M.create('leather', { color: [0.1, 0.02, 0.015], wear: 0.3, repeat: [4, 4] });
    mat.bronze = M.create('brass', { tarnish: 0.85, polish: 0.25, repeat: [3, 3], color: [0.42, 0.33, 0.24], roughness: 1.6 });
    {
      // re-authored nero: wide soft veins + sparse fine ones, white-grey, ~10% cover; three seeded variants so
      // neighbouring slabs do not repeat the same figure
      const neroV = [0, 1, 2].map((k) => marbleNero3Texture(ctx.textures, { key: `gameroom:nero3:${k}`, seed: k * 1.7 }));
      const mk = (rep, tint = 1, k = 0) => { const t = neroV[k].withRepeat(rep, rep); return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: t.ormMap, roughness: 1, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.2, envMapIntensity: 0.8, color: new THREE.Color(tint, tint, tint), name: `nero${k}` }); };
      mat.marble = mk(1.4); mat.marbleDark = mk(1.9, 0.85, 1);
      mat.marbleVariants = [mat.marble, mk(1.4, 1, 1), mk(1.4, 1, 2)];
      const logs = logTextures(ctx.textures);
      const lb = logs.bark.withRepeat(1, 1);
      mat.log = new THREE.MeshStandardMaterial({ map: lb.map, normalMap: lb.normalMap, roughness: 0.95, emissive: new THREE.Color(1, 1, 1), emissiveMap: logs.ember.map, emissiveIntensity: 2.2, name: 'log' });
      const soot = sootTexture(ctx.textures);
      mat.soot = new THREE.MeshStandardMaterial({ map: soot.map, normalMap: soot.normalMap, roughness: 0.95, name: 'soot' });
      const at2 = antlerTexture(ctx.textures).withRepeat(1, 1);
      // antler: rough bone, colour entirely from the vertex ramp (dark burr -> brown beam -> ivory tips)
      mat.antler = new THREE.MeshPhysicalMaterial({ normalMap: at2.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.7, vertexColors: true, clearcoat: 0.12, clearcoatRoughness: 0.6, envMapIntensity: 0.5, name: 'antler' });
      mat.tusk = new THREE.MeshPhysicalMaterial({ roughness: 0.35, vertexColors: true, clearcoat: 0.4, clearcoatRoughness: 0.3, envMapIntensity: 0.7, name: 'tusk' });
      const fs2 = furTexture(ctx.textures, { a: [0.11, 0.08, 0.055], b: [0.5, 0.37, 0.23], key: 'stag4' }).withRepeat(5, 5);
      mat.stagFur = new THREE.MeshStandardMaterial({ map: fs2.map, normalMap: fs2.normalMap, normalScale: new THREE.Vector2(1.3, 1.3), roughnessMap: fs2.ormMap, aoMap: fs2.ormMap, roughness: 1, metalness: 0, vertexColors: true, envMapIntensity: 0.4, color: new THREE.Color(0.95, 0.82, 0.7), name: 'stagFur' });
      mat.stagFurD = mat.stagFur.clone(); mat.stagFurD.side = THREE.DoubleSide; mat.stagFurD.name = 'stagFurD';
      const strand = hairStrandTexture(ctx.textures, { root: [0.08, 0.05, 0.032], tip: [0.42, 0.31, 0.2] });
      mat.stagHair = new THREE.MeshStandardMaterial({ map: strand.map, normalMap: strand.normalMap, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.72, metalness: 0, vertexColors: true, envMapIntensity: 0.3, name: 'stagHair' });
      const strandB = hairStrandTexture(ctx.textures, { root: [0.05, 0.04, 0.032], tip: [0.36, 0.33, 0.3], key: 'gameroom:strandBoar' });
      mat.boarHair = new THREE.MeshStandardMaterial({ map: strandB.map, normalMap: strandB.normalMap, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7, metalness: 0, vertexColors: true, envMapIntensity: 0.3, name: 'boarHair' });
      mat.boarFur = new THREE.MeshStandardMaterial({ map: boarSet.map, normalMap: boarSet.normalMap, normalScale: new THREE.Vector2(1.4, 1.4), roughnessMap: boarSet.ormMap, aoMap: boarSet.ormMap, roughness: 1, metalness: 0, vertexColors: true, envMapIntensity: 0.4, color: new THREE.Color(0.85, 0.8, 0.76), name: 'boarFur' });
      mat.boarFurD = mat.boarFur.clone(); mat.boarFurD.side = THREE.DoubleSide; mat.boarFurD.name = 'boarFurD';
      mat.bristle = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, name: 'bristle' });
      mat.noseLeather = new THREE.MeshPhysicalMaterial({ color: 0x090706, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12, name: 'noseLeather' });
      mat.nostril = new THREE.MeshStandardMaterial({ color: 0x020101, roughness: 0.9, name: 'nostril' });
      mat.snout = new THREE.MeshPhysicalMaterial({ color: 0x6a5048, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3, name: 'snout' });
      const eyeT = glassEyeTexture(ctx.textures, { iris: [0.3, 0.15, 0.05], pupilW: 0.48, pupilH: 0.2 });
      mat.glassEye = new THREE.MeshPhysicalMaterial({ map: eyeT.map, roughness: 0.25, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.0, transmission: 0, envMapIntensity: 1.5, name: 'glassEye' });
      const eyeB = glassEyeTexture(ctx.textures, { iris: [0.34, 0.2, 0.06], pupilW: 0.32, pupilH: 0.32, key: 'gameroom:eyeBoar' });
      mat.glassEyeBoar = new THREE.MeshPhysicalMaterial({ map: eyeB.map, roughness: 0.25, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.0, envMapIntensity: 1.5, name: 'glassEyeBoar' });
      // shields: the room's dark walnut (~#3a1f12) under a clearcoat, not orange
      const wal = M.create('walnut', { repeat: [3, 3] });
      mat.shieldWalnut = new THREE.MeshPhysicalMaterial({ map: wal.map, normalMap: wal.normalMap, roughnessMap: wal.roughnessMap, color: new THREE.Color(0.36, 0.25, 0.2), roughness: 0.6, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 0.08, name: 'shieldWalnut' });
      const iv = ivoryTexture(ctx.textures).withRepeat(1, 1);
      const bx = boxwoodTexture(ctx.textures).withRepeat(1, 1);
      // turned, waxed boxwood (~#d8bf8c): long grain + turning rings, low wax clearcoat, crevice tone from vertex colours
      mat.queenIvory = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(1.0, 0.97, 0.92), map: bx.map, normalMap: bx.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: bx.ormMap, roughness: 1.0, metalness: 0, vertexColors: true, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.6, name: 'queenBoxwood' });
    }

    // ================================================================ shell
    {
      const fg = G.planeUV(X1 - X0, Z1 - Z0, 1).rotateX(-Math.PI / 2);
      const floor = add(new THREE.Mesh(fg, mat.floor)); floor.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2); floor.name = 'floor';
      const cg = G.planeUV(X1 - X0, Z1 - Z0, 1).rotateX(Math.PI / 2);
      const ceil = add(new THREE.Mesh(cg, mat.ceiling)); ceil.position.set((X0 + X1) / 2, H, (Z0 + Z1) / 2); ceil.name = 'ceiling';
    }
    const P = [V3(X0, 0, Z0), V3(X1, 0, Z0), V3(X1, 0, Z1), V3(X0, 0, Z1)];
    const segs = [];
    for (let i = 0; i < 4; i++) {
      const A = P[i], B = P[(i + 1) % 4];
      const along = new THREE.Vector3().subVectors(B, A); const len = along.length(); along.normalize();
      const grp = new THREE.Group(); grp.position.copy(A); grp.rotation.y = -Math.atan2(along.z, along.x); root.add(grp);
      segs.push({ A, len, grp, name: ['back', 'right', 'front', 'left'][i] });
    }
    const S = Object.fromEntries(segs.map((s) => [s.name, s]));
    const lx = { back: (x) => x - X0, right: (z) => z - Z0, front: (x) => X1 - x, left: (z) => Z1 - z };
    const openU = { back: [], right: [], front: [], left: [] }, openL = { back: [], right: [], front: [], left: [] };
    for (const wx of WIN.xs) openU.back.push({ x: lx.back(wx) - WIN.w / 2, y: WIN.sill - WAINS, w: WIN.w, h: WIN.h });
    openL.front.push({ x: lx.front(DOOR.x) - DOOR.w / 2, y: -0.01, w: DOOR.w, h: WAINS + 0.02 });
    openU.front.push({ x: lx.front(DOOR.x) - DOOR.w / 2, y: -0.01, w: DOOR.w, h: DOOR.h - WAINS + 0.01 });
    for (const s of segs) {
      const up = new THREE.Mesh(G.wallWithOpenings(s.len, H - WAINS, openU[s.name], { uvScale: 1 }), mat.wall); up.position.y = WAINS; s.grp.add(up);
      s.grp.add(new THREE.Mesh(G.wallWithOpenings(s.len, WAINS, openL[s.name], { uvScale: 1 }), mat.panel));
    }
    const doorL = DOOR.x - DOOR.w / 2 - 0.14, doorR = DOOR.x + DOOR.w / 2 + 0.14;
    const loop = (y) => P.map((p) => V3(p.x, y, p.z));
    const runPath = (y) => [V3(doorL, y, Z1), V3(X0, y, Z1), V3(X0, y, Z0), V3(X1, y, Z0), V3(X1, y, Z1), V3(doorR, y, Z1)];

    // mouldings: crown, frieze, picture rail, wainscot cap, skirting
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(CROWN_H, 0.18), loop(H - CROWN_H), { closed: true, uvScale: 1 }), mat.crown));
    add(new THREE.Mesh(G.sweepProfile([V2(0.012, 0), V2(0.012, FRIEZE_H)], loop(FRIEZE_Y), { closed: true, uvScale: 1 }), mat.frieze));
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.05, 0.03), loop(FRIEZE_Y - 0.05), { closed: true, uvScale: 2 }), mat.gilt));
    const capProf = [V2(0, 0), V2(0.05, 0.0), V2(0.06, 0.012), V2(0.06, 0.03), V2(0.05, 0.04), V2(0.0, 0.045)];
    add(new THREE.Mesh(G.sweepProfile(capProf, runPath(WAINS - 0.045), { uvScale: 2 }), mat.panel));
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.03, 0.018), runPath(WAINS - 0.08), { uvScale: 2 }), mat.gilt));
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.baseboard(0.22, 0.03), runPath(0), { uvScale: 1 }), mat.panel));
    // wainscot raised panels (skip behind the fireplace and cue rack is fine — they sit in front)
    {
      const pg = G.raisedPanel(0.6, 0.6, { border: 0.06, bevel: 0.03, fieldDepth: 0.01, frameDepth: 0.014 });
      for (const s of segs) {
        let ranges = [[0.1, s.len - 0.1]];
        if (s.name === 'front') ranges = [[0.1, lx.front(DOOR.x) - DOOR.w / 2 - 0.2], [lx.front(DOOR.x) + DOOR.w / 2 + 0.2, s.len - 0.1]];
        if (s.name === 'right') ranges = [[0.1, lx.right(FIRE_Z) - 0.9], [lx.right(FIRE_Z) + 0.9, s.len - 0.1]];
        for (const [a, b] of ranges) {
          if (b - a < 0.3) continue;
          const n = Math.max(1, Math.round((b - a) / 0.72));
          const pw = (b - a) / n;
          for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(pg, mat.panel);
            m.position.set(a + pw * (i + 0.5), 0.22 + (WAINS - 0.22 - 0.1) / 2, 0.004);
            m.scale.set((pw - 0.08) / 0.6, (WAINS - 0.42) / 0.6, 1);
            s.grp.add(m);
          }
        }
      }
    }

    // ================================================================ coffered ceiling
    {
      const bw = 0.16, bd = 0.14;
      const nx = 3, nz = 4;
      const beamX = [], beamZ = [];
      for (let i = 1; i < nx; i++) beamX.push(X0 + (i / nx) * (X1 - X0));
      for (let i = 1; i < nz; i++) beamZ.push(Z0 + (i / nz) * (Z1 - Z0));
      const prof = [V2(-bw / 2, 0), V2(-bw / 2, -bd), V2(bw / 2, -bd), V2(bw / 2, 0)];
      for (const x of beamX) add(at(new THREE.Mesh(G.boxUV(bw, bd, Z1 - Z0, 1), mat.panel), x, H - bd / 2, 0));
      for (const z of beamZ) add(at(new THREE.Mesh(G.boxUV(X1 - X0, bd, bw, 1), mat.panel), 0, H - bd / 2, z));
      // gilt fillets along both lower edges of every beam
      for (const x of beamX) for (const sx of [-1, 1]) add(at(new THREE.Mesh(G.boxUV(0.018, 0.018, Z1 - Z0, 2), mat.gilt), x + sx * (bw / 2 - 0.009), H - bd - 0.006, 0));
      for (const z of beamZ) for (const sz of [-1, 1]) add(at(new THREE.Mesh(G.boxUV(X1 - X0, 0.018, 0.018, 2), mat.gilt), 0, H - bd - 0.006, z + sz * (bw / 2 - 0.009)));
      // sunken relief panel in every coffer (moulded border + faint acanthus wreath)
      const xs = [X0, ...beamX, X1], zs = [Z0, ...beamZ, Z1];
      const ct = cofferTexture(ctx.textures, ((X1 - X0) / nx - bw) / ((Z1 - Z0) / nz - bw));
      const cofMat = new THREE.MeshStandardMaterial({ map: ct.map, normalMap: ct.normalMap, normalScale: new THREE.Vector2(1.6, 1.6), aoMap: ct.ormMap, roughnessMap: ct.ormMap, metalnessMap: ct.ormMap, roughness: 1, metalness: 1, envMapIntensity: 0.8, name: 'coffer' });
      for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
        const x0 = xs[i] + (i ? bw / 2 : 0.18), x1 = xs[i + 1] - (i < xs.length - 2 ? bw / 2 : 0.18);
        const z0 = zs[j] + (j ? bw / 2 : 0.18), z1 = zs[j + 1] - (j < zs.length - 2 ? bw / 2 : 0.18);
        const pnl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2), cofMat);
        pnl.position.set((x0 + x1) / 2, H - 0.004, (z0 + z1) / 2); add(pnl);
      }
      // plaster ceiling roses where the lamp's two rods are hung
      const roseG = G.latheFromProfile([[0, -0.06], [0.03, -0.058], [0.05, -0.045], [0.08, -0.05], [0.11, -0.035], [0.14, -0.04], [0.17, -0.02], [0.2, -0.022], [0.23, -0.008], [0.24, 0]], 48);
      {
        const p = roseG.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = Math.hypot(x, z), a = Math.atan2(z, x);
          if (r > 0.06 && r < 0.22) p.setY(i, y - 0.008 * Math.pow(0.5 + 0.5 * Math.cos(a * 16), 2) * Math.sin(((r - 0.06) / 0.16) * Math.PI));
        }
        roseG.computeVertexNormals();
      }
      const roseMat = M.create('plaster', { color: [0.2, 0.21, 0.26], cracks: 0.15, stains: 0.35, repeat: [4, 4] });
      for (const sz of [-1, 1]) add(at(new THREE.Mesh(roseG, roseMat), T.x, H - 0.002, T.z + sz * 1.75 * 0.38));
    }

    // ================================================================ windows, drapes, sky
    const sky = nightSkyTexture(ctx.textures);
    const skyMat = new THREE.MeshBasicMaterial({ map: sky.map, color: new THREE.Color(0.9, 0.94, 1.02).multiplyScalar(1.45), toneMapped: false, name: 'sky' });
    const treeT = treeSilhouetteTexture(ctx.textures, { aspect: 0.75 });
    const treeMat = new THREE.MeshBasicMaterial({ map: treeT.map, transparent: true, depthWrite: false, color: new THREE.Color(0.55, 0.62, 0.8), toneMapped: false, name: 'treeSil' });
    const frostTex = ctx.textures.canvas('gameroom:frost', 256, 256, (c) => {
      const rnd = ctx.random.fork('frost');
      c.clearRect(0, 0, 256, 256);
      const gr = c.createRadialGradient(128, 128, 60, 128, 128, 190);
      gr.addColorStop(0, 'rgba(220,232,255,0)'); gr.addColorStop(1, 'rgba(220,232,255,0.55)');
      c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
      // condensation beads and grime toward the corners (no scribbled strokes)
      for (let i = 0; i < 900; i++) {
        const x = rnd.next() * 256, y = rnd.next() * 256;
        const e = Math.max(Math.abs(x - 128), Math.abs(y - 128)) / 128;
        if (rnd.next() > e * e) continue;
        const r = 0.6 + rnd.next() * 1.8;
        c.fillStyle = rnd.next() < 0.3 ? 'rgba(60,55,45,0.35)' : 'rgba(230,238,255,0.45)';
        c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      }
    }, { tile: false });
    const frostMat = new THREE.MeshStandardMaterial({ map: frostTex, transparent: true, depthWrite: false, roughness: 0.6, color: 0xdfe8ff, emissive: 0x2a3a60, emissiveIntensity: 0.6, name: 'frost' });
    for (const [k, wxW] of WIN.xs.entries()) {
      const s = S.back;
      const wx = lx.back(wxW);
      const shape = new THREE.Shape();
      shape.moveTo(-WIN.w / 2 - 0.02, -0.02); shape.lineTo(WIN.w / 2 + 0.02, -0.02); shape.lineTo(WIN.w / 2 + 0.02, WIN.h + 0.02); shape.lineTo(-WIN.w / 2 - 0.02, WIN.h + 0.02);
      const hole = new THREE.Path(); hole.moveTo(-WIN.w / 2, 0); hole.lineTo(-WIN.w / 2, WIN.h); hole.lineTo(WIN.w / 2, WIN.h); hole.lineTo(WIN.w / 2, 0); hole.lineTo(-WIN.w / 2, 0);
      shape.holes.push(hole);
      const rv = new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(shape, { depth: WIN.depth, bevelEnabled: false }), 1), mat.panel);
      rv.position.set(wx, WIN.sill, -WIN.depth); s.grp.add(rv);
      s.grp.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(WIN.w + 0.22, 0.05, WIN.depth + 0.12, 2, 0.012), mat.panel), wx, WIN.sill - 0.02, -WIN.depth / 2 + 0.06));
      const arch = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.11, 0.032), [V3(-WIN.w / 2 - 0.055, 0, 0), V3(-WIN.w / 2 - 0.055, WIN.h + 0.055, 0), V3(WIN.w / 2 + 0.055, WIN.h + 0.055, 0), V3(WIN.w / 2 + 0.055, 0, 0)], { up: V3(0, 0, 1), uvScale: 2, flipOutward: true }), mat.panel);
      arch.position.set(wx, WIN.sill, 0.002); s.grp.add(arch);
      // sash with 2x3 panes
      const sash = new THREE.Group();
      const bar = (w, h, x, y, d = 0.045) => { sash.add(at(new THREE.Mesh(G.boxUV(w, h, d, 2), mat.dark), x, y, 0)); };
      bar(WIN.w, 0.06, 0, 0.03); bar(WIN.w, 0.06, 0, WIN.h - 0.03);
      bar(0.06, WIN.h, -WIN.w / 2 + 0.03, WIN.h / 2); bar(0.06, WIN.h, WIN.w / 2 - 0.03, WIN.h / 2);
      bar(WIN.w, 0.05, 0, WIN.h * 0.5, 0.06);
      bar(0.025, WIN.h, 0, WIN.h / 2, 0.03);
      for (const y of [WIN.h * 0.25, WIN.h * 0.75]) bar(WIN.w, 0.022, 0, y, 0.03);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w - 0.06, WIN.h - 0.06), mat.glass); gl.position.set(0, WIN.h / 2, 0.01); gl.userData.noShadow = true; sash.add(gl);
      // hoar frost creeping in from the corners of each pane
      for (let pi = 0; pi < 8; pi++) {
        const pw2 = (WIN.w - 0.1) / 2, ph2 = (WIN.h - 0.1) / 4;
        const fr = new THREE.Mesh(new THREE.PlaneGeometry(pw2, ph2), frostMat);
        fr.position.set((pi % 2 ? 1 : -1) * pw2 / 2, 0.05 + ph2 * (Math.floor(pi / 2) + 0.5), 0.016); fr.rotation.z = (pi * 1.7) % 3 > 1.5 ? Math.PI : 0;
        fr.userData.noShadow = true; fr.renderOrder = 3; sash.add(fr);
      }
      sash.position.set(wx, WIN.sill, -WIN.depth * 0.55); s.grp.add(sash);
      const trees = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.0), treeMat);
      trees.position.set(wx + (k ? 0.5 : -0.3), WIN.sill + 1.0, -2.0); trees.userData.noShadow = true; trees.renderOrder = 1; s.grp.add(trees);
      const card = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5.6), skyMat);
      card.position.set(wx + (k ? 0.9 : -0.6), WIN.sill + 1.1, -3.2); card.userData.noShadow = true; s.grp.add(card);
      // drapes: pinch-pleated velvet panels gathered by silk tiebacks, pooling on the boards
      const rodY = FRIEZE_Y - 0.1;
      for (const side of [-1, 1]) {
        const dg = drapeGeometry({ width: 0.64, height: rodY, folds: 7, depth: 0.05, tieback: 0.57, tieW: 0.17, pool: 0.13, seed: 11 + side * 3 + k * 7 });
        const c = new THREE.Mesh(dg, mat.drape);
        const cx = wx + side * (WIN.w / 2 + 0.15);
        c.position.set(cx, rodY, 0.12);
        if (side > 0) c.scale.x = -1;
        s.grp.add(c);
        // cord tieback + brass hook rosette on the wall at the gather
        const tg = G.mergeGeometries(tiebackGeometry({ hw: 0.1, depth: 0.15 }));
        const tie = new THREE.Mesh(tg, mat.cord);
        tie.position.set(cx + side * -1 * (dg.userData.tieX), rodY + dg.userData.tieY + 0.05, 0.1);
        if (side > 0) tie.scale.x = -1;
        s.grp.add(tie);
        const hook = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.03, 0], [0.032, 0.008], [0.02, 0.016], [0.012, 0.03], [0, 0.034]], 18).rotateX(Math.PI / 2), mat.brass);
        hook.position.set(cx + side * 0.3, rodY + dg.userData.tieY + 0.05, 0.0); s.grp.add(hook);
      }
      // swagged valance on a gilt pole: three festoons with pleated jabots at the ends
      const vw = WIN.w + 0.8;
      for (const [sx, sw, sd, sz] of [[0, 0.86, 0.46, 0.27], [-0.5, 0.74, 0.4, 0.24], [0.5, 0.74, 0.4, 0.24]]) {
        const sg = swagGeometry({ width: sw, drop: sd, top: 0.07, pleats: 5, belly: 0.075 });
        s.grp.add(at(new THREE.Mesh(sg, mat.drape), wx + sx * (vw / 2 - 0.37), rodY + 0.06, sz));
      }
      for (const side of [-1, 1]) {
        const jg = jabotGeometry({ width: 0.22, long: 0.85, short: 0.32, pleats: 4, depth: 0.045 });
        const j = new THREE.Mesh(jg, mat.drape);
        j.position.set(wx + side * (vw / 2 - 0.08), rodY + 0.06, 0.29); if (side > 0) j.scale.x = -1;
        s.grp.add(j);
      }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, vw + 0.2, 16), mat.gilt); pole.rotation.z = Math.PI / 2; pole.position.set(wx, rodY + 0.1, 0.3); s.grp.add(pole);
      const finG = G.latheFromProfile([[0, 0], [0.03, 0], [0.034, 0.012], [0.024, 0.024], [0.03, 0.03], [0.042, 0.055], [0.036, 0.08], [0.016, 0.1], [0.022, 0.11], [0.008, 0.15], [0, 0.17]], 20);
      for (const side of [-1, 1]) {
        const fin = new THREE.Mesh(finG, mat.gilt); fin.rotation.z = -side * Math.PI / 2; fin.position.set(wx + side * (vw / 2 + 0.1), rodY + 0.1, 0.3); s.grp.add(fin);
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.3, 10).rotateX(Math.PI / 2), mat.gilt); br.position.set(wx + side * (vw / 2 - 0.02), rodY + 0.1, 0.15); s.grp.add(br);
        s.grp.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.04, 0], [0.042, 0.01], [0.025, 0.02], [0, 0.024]], 18).rotateX(Math.PI / 2), mat.gilt), wx + side * (vw / 2 - 0.02), rodY + 0.1, 0.0));
      }
      // rings on the pole
      for (let i = 0; i < 12; i++) { const rg = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 20), mat.gilt); rg.rotation.y = Math.PI / 2; rg.position.set(wx - vw / 2 + 0.05 + (i / 11) * (vw - 0.1), rodY + 0.1, 0.3); s.grp.add(rg); }
    }

    // ================================================================ door to the gallery
    {
      const s = S.front;
      // mahogany (~#4a1e12, low saturation), raised-and-fielded panels, a deep moulded architrave on plinth blocks,
      // a frieze and cornice head, brass knob on a rose and a keyhole escutcheon
      const doorWood = M.create('mahogany', { repeat: [1.2, 1.2], color: [0.36, 0.22, 0.17], clearcoat: 0.25, clearcoatRoughness: 0.45, roughness: 1.15, envMapIntensity: 0.35 });
      const g = new THREE.Group(); g.position.set(lx.front(DOOR.x), 0, -0.04);
      const w = DOOR.w - 0.02, h = DOOR.h - 0.01;
      g.add(at(new THREE.Mesh(G.boxUV(w, h, 0.05, 1), doorWood), 0, h / 2, 0));
      // stiles, rails and muntin proud of the slab; fielded panels with 18 mm bevels between them
      for (const [y, hh] of [[0.55, 0.78], [1.6, 0.98], [2.3, 0.3]]) for (const sx of [-1, 1]) {
        const p = new THREE.Mesh(G.raisedPanel(w / 2 - 0.13, hh, { border: 0.05, bevel: 0.018, fieldDepth: 0.014, frameDepth: 0.02 }), doorWood); p.position.set(sx * (w / 4 - 0.005), y, 0.025); g.add(p);
      }
      // brass: knob on a rose, keyhole escutcheon below, finger plate above
      const knobG = G.latheFromProfile([[0, 0], [0.026, 0], [0.028, 0.006], [0.012, 0.014], [0.009, 0.03], [0.02, 0.04], [0.028, 0.055], [0.024, 0.068], [0.0, 0.072]], 28).rotateX(Math.PI / 2);
      g.add(at(new THREE.Mesh(knobG, mat.brass), w / 2 - 0.1, 1.0, 0.045));
      const roseG = G.latheFromProfile([[0, 0.006], [0.02, 0.006], [0.032, 0.004], [0.036, 0]], 28).rotateX(Math.PI / 2);
      g.add(at(new THREE.Mesh(roseG, mat.brass), w / 2 - 0.1, 1.0, 0.044));
      const esc = new THREE.Shape(); esc.absellipse(0, 0, 0.018, 0.034, 0, Math.PI * 2);
      const kh = new THREE.Path(); kh.absarc(0, 0.006, 0.0045, 0, Math.PI * 2, true); esc.holes.push(kh);
      const escG = new THREE.ExtrudeGeometry(esc, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 20 });
      g.add(at(new THREE.Mesh(escG, mat.brass), w / 2 - 0.1, 0.9, 0.045));
      g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.06, 0.24, 0.004, 2, 0.002), mat.brass), w / 2 - 0.1, 1.28, 0.047));
      // architrave: a deep moulded casing standing ~60 mm proud, 140 mm wide, on plinth blocks
      const archProf = [V2(0, 0), V2(0.14, 0), V2(0.14, 0.018), V2(0.125, 0.024), V2(0.11, 0.034), V2(0.09, 0.034), V2(0.08, 0.044), V2(0.06, 0.05), V2(0.04, 0.056), V2(0.02, 0.06), V2(0.0, 0.06)];
      const cas = new THREE.Mesh(G.sweepProfile(archProf, [V3(-DOOR.w / 2 - 0.14, 0.2, 0), V3(-DOOR.w / 2 - 0.14, DOOR.h + 0.14, 0), V3(DOOR.w / 2 + 0.14, DOOR.h + 0.14, 0), V3(DOOR.w / 2 + 0.14, 0.2, 0)], { up: V3(0, 0, 1), uvScale: 2, flipOutward: true }), doorWood);
      cas.position.z = 0.04; g.add(cas);
      for (const sx of [-1, 1]) g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.17, 0.22, 0.075, 2, 0.006), doorWood), sx * (DOOR.w / 2 + 0.07), 0.11, 0.075));
      // frieze board and a moulded cornice head with a small pediment
      g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(DOOR.w + 0.36, 0.2, 0.05, 2, 0.006), doorWood), 0, DOOR.h + 0.25, 0.065));
      const corn = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.12, 0.1), [V3(-DOOR.w / 2 - 0.24, 0, 0.0), V3(-DOOR.w / 2 - 0.24, 0, -0.1), V3(DOOR.w / 2 + 0.24, 0, -0.1), V3(DOOR.w / 2 + 0.24, 0, 0.0)], { uvScale: 2, flipOutward: true }), doorWood);
      corn.position.set(0, DOOR.h + 0.35, 0.19); g.add(corn);
      s.grp.add(g);
    }

    // ================================================================ rug, billiard table, lamp, balls
    {
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.2), mat.rug);
      rug.rotation.x = -Math.PI / 2; rug.position.set(T.x, 0.009, T.z); rug.name = 'rug'; add(rug);
      // the rug has thickness: overcast selvedge edges standing ~8 mm proud of the parquet, so it sits and shadows
      const edgeMat = new THREE.MeshStandardMaterial({ color: 0x1a0f0b, roughness: 0.95, name: 'rugEdge' });
      for (const [w, d, x, z] of [[3.0, 0.012, 0, 2.094], [3.0, 0.012, 0, -2.094], [0.012, 4.2, 1.494, 0], [0.012, 4.2, -1.494, 0]]) {
        const eg = new G.RoundedBoxGeometry(w, 0.009, d, 2, 0.003); const em = new THREE.Mesh(eg, edgeMat); em.position.set(T.x + x, 0.0045, T.z + z); add(em);
      }
      // knotted wool fringe at both ends: individual tassels, slightly splayed
      const rnd = ctx.random.fork('fringe');
      const thread = new THREE.CylinderGeometry(0.0022, 0.0018, 1, 4, 1).rotateX(Math.PI / 2).translate(0, 0, 0.5);
      const n = 150;
      const fr = new THREE.InstancedMesh(thread, new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.95, name: 'fringe' }), n * 2);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      let k = 0;
      for (const sz of [-1, 1]) for (let i = 0; i < n; i++) {
        const x = T.x - 1.48 + (i / (n - 1)) * 2.96;
        const len = 0.07 + rnd.next() * 0.025;
        e.set(0, sz < 0 ? Math.PI + (rnd.next() - 0.5) * 0.35 : (rnd.next() - 0.5) * 0.35, 0); q.setFromEuler(e);
        m4.compose(V3(x, 0.008, T.z + sz * 2.1 - sz * 0.015), q, V3(1, 0.6, len)); fr.setMatrixAt(k++, m4);
      }
      fr.userData.keep = true; fr.name = 'cloth'; add(fr);
    }
    const tableMats = { apron: M.create('mahogany', { repeat: [1.6, 1.6], color: [0.5, 0.31, 0.26], clearcoat: 0.2, clearcoatRoughness: 0.35 }), wood: mat.tableWood, baize: mat.baize, cushion: mat.cushion, dark: mat.dark, hole: mat.hole, pearl: mat.pearl, brass: mat.brass, gilt: mat.gilt, leather: M.create('leather', { color: [0.13, 0.065, 0.035], wear: 0.5, repeat: [8, 8], roughness: 0.75 }) };
    const btable = buildBilliardTable(ctx, tableMats);
    btable.position.copy(T); add(btable);
    const BH = TABLE.BH, BR = TABLE.BALL_R;
    // balls: mid-game layout (table-local x across, z along; foot of the table at -z)
    const ballLayout = [
      // the break has been taken: a loose rack still knotted round the foot spot, a few balls run out to the rails
      [0, 0.16, 0.58], [1, -0.02, -0.66], [2, 0.05, -0.72], [3, -0.06, -0.73], [4, 0.36, -0.98], [5, 0.0, -0.79], [6, -0.22, 0.24], [7, -0.09, -0.8],
      [8, 0.03, -0.86], [9, 0.43, 0.38], [10, -0.47, -1.04], [11, 0.24, -0.2], [12, 0.1, -0.85], [13, -0.13, -0.92], [14, 0.07, -0.95], [15, -0.39, 0.84],
    ];
    const ballTex = ballAtlas(ctx.textures);
    const ballMat = new THREE.MeshPhysicalMaterial({ map: ballTex, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1, name: 'balls' });
    const ballGroup = new THREE.Group(); ballGroup.position.copy(T); ballGroup.userData.keep = true; add(ballGroup);
    const balls = [];
    for (const [n, x, z] of ballLayout) {
      const b = new THREE.Mesh(ballGeometry(n), ballMat);
      b.position.set(x, BH + BR, z);
      b.rotation.set((n * 1.7) % 3, (n * 2.3) % 6, (n * 0.9) % 2);
      b.castShadow = true; b.receiveShadow = true;
      ballGroup.add(b); balls.push(b);
    }
    {
      // soft contact shadows on the cloth under every ball
      const aoT = ctx.textures.canvas('gameroom:ballAO', 64, 64, (c) => { const g2 = c.createRadialGradient(32, 32, 0, 32, 32, 32); g2.addColorStop(0, 'rgba(0,0,0,0.85)'); g2.addColorStop(0.35, 'rgba(0,0,0,0.45)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); c.clearRect(0, 0, 64, 64); c.fillStyle = g2; c.fillRect(0, 0, 64, 64); }, { tile: false });
      const aoM = new THREE.MeshBasicMaterial({ map: aoT, transparent: true, depthWrite: false, opacity: 0.75, name: 'ballAO' });
      const aoG = new THREE.PlaneGeometry(BR * 3.2, BR * 3.2).rotateX(-Math.PI / 2);
      for (const b of balls) { const d = new THREE.Mesh(aoG, aoM); d.position.set(b.position.x, BH + 0.0015, b.position.z); d.userData.noShadow = true; d.renderOrder = 2; ballGroup.add(d); b.userData.ao = d; }
    }
    // a cue left lying on the cloth, a triangle and chalk on the rail
    {
      const parts = cueGeometry(G, 1.46);
      const cue = new THREE.Group();
      cue.add(new THREE.Mesh(parts.butt, mat.ebony), new THREE.Mesh(parts.shaft, mat.maple), new THREE.Mesh(parts.ferrule, mat.ivory), new THREE.Mesh(parts.tip, mat.tip), new THREE.Mesh(parts.wrap, mat.leather));
      cue.rotation.set(Math.PI / 2 - 0.03, 0, 0);
      const holder = new THREE.Group(); holder.add(cue);
      holder.rotation.y = Math.PI + 0.42;
      holder.position.set(T.x - 0.02, BH + 0.016, T.z + 1.28);
      cue.position.set(0, 0, 0);
      add(holder);
      const tri = new THREE.Shape(); const R = 0.19;
      for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i / 3) * Math.PI * 2; i ? tri.lineTo(Math.cos(a) * R, Math.sin(a) * R) : tri.moveTo(Math.cos(a) * R, Math.sin(a) * R); }
      const th = new THREE.Path(); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 - (i / 3) * Math.PI * 2; i ? th.lineTo(Math.cos(a) * (R - 0.035), Math.sin(a) * (R - 0.035)) : th.moveTo(Math.cos(a) * (R - 0.035), Math.sin(a) * (R - 0.035)); }
      tri.holes.push(th);
      const trig = new THREE.ExtrudeGeometry(tri, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 }); trig.rotateX(-Math.PI / 2);
      add(at(new THREE.Mesh(G.applyBoxUVs(trig, 1), mat.wood), T.x - 0.32, BH + 0.004, T.z - 0.98)).rotation.y = 0.5;
      for (const [x, z] of [[0.71, 0.4], [-0.7, -1.27]]) { const ch = new THREE.Mesh(new G.RoundedBoxGeometry(0.022, 0.022, 0.022, 2, 0.003), mat.tip); ch.position.set(T.x + x, BH + 0.056, T.z + z); ch.rotation.y = 0.4; add(ch); }
    }
    const LAMP_DROP = 1.88;
    const lamp = buildBilliardLamp(ctx, { brass: mat.brass, shadeOuter: mat.shadeOuter, shadeInner: mat.shadeInner, shadeRim: mat.shadeRim, bulb: mat.bulb }, { length: 1.75, drop: LAMP_DROP, shades: 3 });
    lamp.position.set(T.x, H, T.z);
    lamp.traverse((o) => { if (o.isMesh && (o.material?.isMeshBasicMaterial || o.material === mat.shadeOuter)) o.userData.noBake = true; });
    add(lamp);

    // ================================================================ games table + chessboard (puzzle)
    const gtable = buildGamesTable(ctx, { wood: mat.walnut, dark: mat.dark, brass: mat.brass }, { board: BOARD });
    gtable.position.copy(C); add(gtable);
    const boardY = gtable.userData.topY + 0.001;
    {
      const bset = chessboardTexture(ctx.textures, { inner: FIELD / BOARD });
      const bm = new THREE.MeshPhysicalMaterial({ map: bset.map, normalMap: bset.normalMap, roughnessMap: bset.ormMap, roughness: 1, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.55, envMapIntensity: 0.15, color: new THREE.Color(1.04, 0.98, 0.92), name: 'chessboard' });
      const top = new THREE.Mesh(new THREE.PlaneGeometry(BOARD, BOARD).rotateX(-Math.PI / 2), bm);
      top.position.set(C.x, boardY - 0.001, C.z); top.name = 'chessboard'; top.userData.keep = true; top.receiveShadow = true;
      add(top);
    }
    // the black king, standing alone at the far corner of the table: the one piece Stauf left on the board
    const blackMat = new THREE.MeshPhysicalMaterial({ color: 0x0b0807, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 0.9, name: 'ebonyPiece' });
    {
      const s = (FIELD / 8 / 0.057) * 1.12;
      const kp = [[0, 0], [0.0222, 0], [0.023, 0.0006], [0.023, 0.0036], [0.0222, 0.0042], [0.0206, 0.005], [0.0199, 0.0062], [0.0207, 0.0074], [0.0212, 0.0086], [0.0205, 0.0097], [0.0188, 0.0104], [0.0184, 0.0112], [0.0189, 0.012], [0.0186, 0.013], [0.0168, 0.0138], [0.0162, 0.0146]];
      for (let i = 1; i <= 16; i++) { const u = i / 16; kp.push([0.0078 + (0.0162 - 0.0078) * Math.pow(1 - u, 2.4), 0.0146 + (0.0604 - 0.0146) * u]); }
      kp.push([0.0084, 0.0612], [0.0128, 0.062], [0.0136, 0.0628], [0.0136, 0.064], [0.0126, 0.0648], [0.0096, 0.0654], [0.0112, 0.0662], [0.0114, 0.067], [0.0098, 0.0678], [0.0086, 0.0686],
        [0.0098, 0.072], [0.0118, 0.0765], [0.0134, 0.0805], [0.0138, 0.0832], [0.0128, 0.0852], [0.0098, 0.0868], [0.0062, 0.0878], [0.0042, 0.0884], [0.0052, 0.0892], [0.0046, 0.0902], [0, 0.0904]);
      const kingG = G.latheFromProfile(kp.map(([r, y]) => [r * s, y * s]), 56);
      const crossA = new G.RoundedBoxGeometry(0.0062 * s, 0.024 * s, 0.0062 * s, 2, 0.0012 * s); crossA.translate(0, 0.1012 * s, 0);
      const crossB = new G.RoundedBoxGeometry(0.018 * s, 0.0062 * s, 0.0062 * s, 2, 0.0012 * s); crossB.translate(0, 0.1048 * s, 0);
      const k = new THREE.Mesh(G.mergeGeometries([kingG.toNonIndexed(), crossA.toNonIndexed(), crossB.toNonIndexed()].map((g) => { g.deleteAttribute('uv'); return g; })), blackMat);
      k.rotation.y = 0.5;
      k.position.set(C.x + 0.358, boardY, C.z - 0.1);
      k.castShadow = true; k.userData.keep = true; k.name = 'blackKing';
      add(k);
    }
    // chair carving in the same dark mahogany as the table legs (fine grain, not blown-out birch)
    mat.carve = M.create('mahogany', { repeat: [1, 1], color: [0.3, 0.17, 0.13], clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.4 });
    const chairMats = { wood: mat.tableWood, carve: mat.carve, seat: mat.seat, brass: mat.brass };
    {
      const ch = buildSideChair(ctx, chairMats); ch.position.set(C.x + 0.15, 0, C.z + 0.72); ch.rotation.y = Math.PI + 0.25; add(ch);
      const ch2 = buildSideChair(ctx, chairMats); ch2.position.set(C.x - 0.05, 0, C.z - 0.72); ch2.rotation.y = -0.1; add(ch2);
    }

    // ================================================================ fireplace + stag (right wall)
    const ci = castIronTexture(ctx.textures).withRepeat(3, 3);
    const tl = majolicaTileTexture(ctx.textures).withRepeat(1, 1);
    const fireMats = {
      marble: mat.marble, marbleDark: mat.marbleDark, brick: mat.brick, soot: mat.soot, log: mat.log, brass: mat.bronze,
      iron: new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 0.55, metalness: 0.7, envMapIntensity: 0.5, name: 'blackIron' }),
      castIron: new THREE.MeshStandardMaterial({ map: ci.map, normalMap: ci.normalMap, normalScale: new THREE.Vector2(1.4, 1.4), roughnessMap: ci.ormMap, metalnessMap: ci.ormMap, roughness: 1, metalness: 1, envMapIntensity: 0.7, name: 'castIron' }),
      tile: new THREE.MeshPhysicalMaterial({ map: tl.map, normalMap: tl.normalMap, roughnessMap: tl.ormMap, roughness: 1, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 0.9, name: 'majolica' }),
      ash: new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 1, name: 'ash' }),
    };
    const fire = buildFireplace(ctx, fireMats);
    { let k = 0; fire.traverse((o) => { if (o.isMesh && o.material === mat.marble) o.material = mat.marbleVariants[(k++) % 3]; }); }
    fire.position.set(lx.right(FIRE_Z), 0, 0); S.right.grp.add(fire);
    {
      // overmantel: a dark varnished landscape in a heavy carved gilt frame
      const og = new THREE.Group();
      const mw = 1.12, mh = 0.84;
      og.add(new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), M.create('painting', { subject: 0, seed: 23, aspect: mw / mh, size: 1024, varnish: 0.3, cracks: 0.3, color: [0.95, 0.9, 0.84], normalScale: 0.35 })));
      og.add(new THREE.Mesh(G.frameGeometry(mw, mh, { width: 0.12, depth: 0.07, uvScale: 1 }), mat.frame));
      const ocrest = new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 10), mat.gilt); ocrest.scale.set(1.8, 0.7, 0.3); ocrest.position.set(0, mh / 2 + 0.13, 0.04); og.add(ocrest);
      og.position.set(lx.right(FIRE_Z), fire.userData.Hm + 0.2 + mh / 2, 0.035);
      S.right.grp.add(og);
      // the stag, on its own carved shield on the bare damask further along the wall, over the armchair
      const stag = buildStag(ctx, { shield: mat.shieldWalnut, fur: mat.stagFur, furDouble: mat.stagFurD, hair: mat.stagHair, eye: mat.glassEye, nose: mat.noseLeather, nostril: mat.nostril, antler: mat.antler, gilt: mat.gilt });
      stag.position.set(lx.right(STAG_Z), 2.02, 0.035); stag.rotation.y = -0.14; stag.scale.setScalar(1.1);
      S.right.grp.add(stag);
      // mantel garniture: clock and two candlesticks
      const my = fire.userData.Hm;
      const clock = new THREE.Group();
      clock.add(at(new THREE.Mesh(slabTop(G, 0.36, 0.16, 0.035), mat.marble), 0, 0.0175, 0));
      clock.add(at(new THREE.Mesh(slabTop(G, 0.32, 0.13, 0.02), mat.gilt), 0, 0.045, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) clock.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), mat.gilt), sx * 0.15, 0.0, sz * 0.06));
      // drum case on a waisted plinth, flanked by scrolled consoles, an urn finial on top
      const caseG = G.latheFromProfile([[0, 0], [0.06, 0], [0.065, 0.01], [0.05, 0.03], [0.045, 0.06], [0.055, 0.075], [0.04, 0.085], [0, 0.085]], 32);
      clock.add(at(new THREE.Mesh(caseG, mat.gilt), 0, 0.055, 0));
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.08, 40).rotateX(Math.PI / 2), mat.gilt); drum.position.set(0, 0.235, 0); clock.add(drum);
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.01, 10, 40), mat.gilt); bezel.position.set(0, 0.235, 0.042); clock.add(bezel);
      clock.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.076, 40), new THREE.MeshPhysicalMaterial({ color: 0xece2c8, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, name: 'dial' })), 0, 0.235, 0.0405));
      for (let i = 0; i < 12; i++) { const a2 = (i / 12) * Math.PI * 2; const tk = new THREE.Mesh(new THREE.BoxGeometry(0.003, i % 3 ? 0.008 : 0.014, 0.001), mat.dark); tk.position.set(Math.sin(a2) * 0.064, 0.235 + Math.cos(a2) * 0.064, 0.041); tk.rotation.z = -a2; clock.add(tk); }
      for (const [ang, len] of [[-0.2, 0.045], [1.9, 0.062]]) { const hnd = new THREE.Mesh(new THREE.BoxGeometry(0.0035, len, 0.0015), mat.dark); hnd.geometry.translate(0, len / 2, 0); hnd.rotation.z = ang; hnd.position.set(0, 0.235, 0.043); clock.add(hnd); }
      for (const sx of [-1, 1]) {
        const sc = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 20, Math.PI * 1.3), mat.gilt); sc.position.set(sx * 0.1, 0.12, 0); sc.rotation.set(0, 0, sx > 0 ? -0.6 : Math.PI - 0.7); clock.add(sc);
        clock.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.018, 0], [0.012, 0.02], [0.02, 0.05], [0.008, 0.07], [0, 0.08]], 14), mat.gilt), sx * 0.13, 0.055, 0));
      }
      clock.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.02, 0], [0.028, 0.02], [0.03, 0.04], [0.015, 0.055], [0.022, 0.065], [0.006, 0.09], [0, 0.095]], 18), mat.gilt), 0, 0.32, 0));
      clock.position.set(lx.right(FIRE_Z) - 0.02, my, 0.24); S.right.grp.add(clock);
      for (const sx of [-1, 1]) {
        const cs = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.05, 0], [0.05, 0.01], [0.02, 0.03], [0.014, 0.12], [0.022, 0.2], [0.03, 0.21], [0.012, 0.215], [0, 0.215]], 18), mat.brass);
        cs.position.set(lx.right(FIRE_Z) + sx * 0.6, my, 0.18); S.right.grp.add(cs);
        const cnd = fx.candle({ height: 0.16, radius: 0.012, light: true, lightIntensity: 0.3, lightDistance: 2.5, seed: 30 + sx, burn: 0.6 });
        cnd.position.set(lx.right(FIRE_Z) + sx * 0.6, my + 0.215, 0.18); S.right.grp.add(cnd);
      }
    }

    let paintingLightAt = null;
    // ================================================================ left wall: cue rack, boar, painting over a cabinet
    {
      const rack = buildCueRack(ctx, { wood: mat.wood, brass: mat.brass, gilt: mat.gilt, dark: mat.dark, ivory: mat.ivory, ebony: mat.ebony, maple: mat.maple, tip: mat.tip, leather: mat.leather });
      rack.position.set(lx.left(0.85), 0.3, 0.02); S.left.grp.add(rack);
      const boar = buildBoar(ctx, { shield: mat.shieldWalnut, fur: mat.boarFur, furDouble: mat.boarFurD, hair: mat.boarHair, eye: mat.glassEyeBoar, nose: mat.noseLeather, nostril: mat.nostril, snout: mat.snout, tusk: mat.tusk, antler: mat.antler, bristle: mat.bristle, gilt: mat.gilt });
      boar.position.set(lx.left(0.85), 2.72, 0.04); S.left.grp.add(boar);
      // hunting landscape
      const pg = new THREE.Group();
      const pw = 1.35, ph = 0.95;
      { const ht = huntPaintingTexture(ctx.textures, pw / ph); pg.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshPhysicalMaterial({ map: ht.map, normalMap: ht.normalMap, roughnessMap: ht.ormMap, roughness: 1, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.5, name: 'huntPainting' }))); }
      // brass picture light over it
      pg.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 14).rotateZ(Math.PI / 2), mat.brass), 0, ph / 2 + 0.16, 0.13));
      pg.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.14, 8).rotateX(Math.PI / 2), mat.brass), 0, ph / 2 + 0.16, 0.06));
      pg.add(new THREE.Mesh(G.frameGeometry(pw, ph, { width: 0.12, depth: 0.065, uvScale: 1 }), mat.frame));
      pg.position.set(lx.left(-1.55), 2.1, 0.035); S.left.grp.add(pg);
      paintingLightAt = pg;
      // cabinet (tantalus + humidor on top)
      const cab = new THREE.Group();
      cab.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(1.2, 0.86, 0.45, 2, 0.015), mat.wood), 0, 0.45, 0.225));
      cab.add(at(new THREE.Mesh(slabTop(G, 1.28, 0.5), mat.wood), 0, 0.88, 0.25));
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(G.raisedPanel(0.5, 0.56, { border: 0.05, bevel: 0.025 }), mat.wood); p.position.set(sx * 0.28, 0.45, 0.452); cab.add(p); cab.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), mat.brass), sx * 0.06, 0.5, 0.47)); }
      cab.add(at(new THREE.Mesh(G.boxUV(1.16, 0.06, 0.42, 1), mat.dark), 0, 0.03, 0.22));
      // tantalus: brass frame with three cut-glass decanters
      const tant = new THREE.Group();
      tant.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.42, 0.03, 0.16, 2, 0.006), mat.walnut), 0, 0.015, 0));
      for (const sx of [-1, 1]) tant.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 8), mat.brass), sx * 0.2, 0.17, 0));
      tant.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 8).rotateZ(Math.PI / 2), mat.brass), 0, 0.3, 0));
      const decG = G.latheFromProfile([[0, 0], [0.05, 0], [0.055, 0.02], [0.055, 0.15], [0.03, 0.18], [0.016, 0.2], [0.016, 0.23], [0.022, 0.24], [0, 0.24]], 6);
      const liq = [0x5a2a08, 0x6a3a0c, 0x3a0a0a];
      for (let i = 0; i < 3; i++) {
        tant.add(at(new THREE.Mesh(decG, mat.crystal), -0.13 + i * 0.13, 0.03, 0));
        tant.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.047, 0], [0.051, 0.02], [0.051, 0.1 - i * 0.02], [0, 0.1 - i * 0.02]], 6), new THREE.MeshPhysicalMaterial({ color: liq[i], roughness: 0.05, clearcoat: 1, name: 'spirit' })), -0.13 + i * 0.13, 0.033, 0));
        tant.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), mat.crystal), -0.13 + i * 0.13, 0.29, 0));
      }
      tant.position.set(-0.25, 0.905, 0.25); cab.add(tant);
      const hum = new THREE.Mesh(new G.RoundedBoxGeometry(0.3, 0.12, 0.2, 2, 0.01), mat.walnut); hum.position.set(0.33, 0.965, 0.24); cab.add(hum);
      cab.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), mat.brass), 0.33, 0.96, 0.345));
      cab.position.set(lx.left(-1.55), 0, 0.0); S.left.grp.add(cab);
    }

    // ================================================================ back wall trophy (between the windows)
    {
      // a portrait of the master of the house, between the windows
      const pg = new THREE.Group();
      const pw = 0.62, ph = 0.82;
      {
        // tenebrist oil portrait of the master of the house: craquelure, yellowed varnish, a soft clearcoat sheen
        const pt = oilPortraitTexture(ctx.textures, { aspect: pw / ph });
        pg.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshPhysicalMaterial({ map: pt.map, normalMap: pt.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: pt.ormMap, roughness: 1, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.4, color: new THREE.Color(1.25, 1.2, 1.15), name: 'portrait' })));
      }
      pg.add(new THREE.Mesh(G.frameGeometry(pw, ph, { width: 0.1, depth: 0.06, uvScale: 1 }), mat.frame));
      const ct = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), mat.gilt); ct.scale.set(1.6, 0.8, 0.35); ct.position.set(0, ph / 2 + 0.11, 0.04); pg.add(ct);
      pg.position.set(lx.back(0), 2.2, 0.035); S.back.grp.add(pg);
      // a brass picture light over it
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 14).rotateZ(Math.PI / 2), mat.brass); pl.position.set(lx.back(0), 2.2 + ph / 2 + 0.2, 0.12); S.back.grp.add(pl);
      S.back.grp.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8).rotateX(Math.PI / 2), mat.brass), lx.back(0), 2.2 + ph / 2 + 0.2, 0.06));
    }

    // ================================================================ card table by the door, Chesterfield by the fire
    const cardTable = buildCardTable(ctx, { wood: mat.wood, baize: mat.cardBaize, gilt: mat.gilt, brass: mat.brass }, { r: 0.5 });
    cardTable.position.copy(CARD); add(cardTable);
    {
      for (const [a, pull] of [[Math.PI * 0.85, 0.12], [Math.PI * 1.55, 0.0], [Math.PI * 0.2, 0.25]]) {
        const ch = buildSideChair(ctx, { wood: mat.wood, carve: mat.carve, seat: mat.seat, brass: mat.brass });
        ch.position.set(CARD.x + Math.sin(a) * (0.72 + pull), 0, CARD.z + Math.cos(a) * (0.72 + pull));
        ch.rotation.y = a + Math.PI + (pull > 0.2 ? 0.5 : 0.05);
        add(ch);
      }
      // cards
      const atlas = cardAtlas(ctx.textures);
      const cardMat = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.55, name: 'cards' });
      const cw = 0.063, chh = 0.088;
      const cardG = (face) => {
        const g = new THREE.PlaneGeometry(cw, chh).rotateX(-Math.PI / 2);
        const k = CARD_FACES.indexOf(face);
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / CARD_FACES.length);
        return g;
      };
      const y0 = 0.733;
      const deal = [
        ['7h', 0.12, 0.0, 0.2], ['Qs', 0.16, 0.05, -0.15], ['As', 0.2, -0.04, 0.5], ['3c', -0.12, 0.16, 1.1],
        ['back', -0.2, -0.12, 0.3], ['back', -0.16, -0.16, 0.42], ['back', 0.0, -0.26, -0.3], ['back', 0.03, -0.27, -0.1],
      ];
      deal.forEach(([f, x, z, r], i) => { const m = new THREE.Mesh(cardG(f), cardMat); m.position.set(CARD.x + x, y0 + 0.0006 * (i + 1), CARD.z + z); m.rotation.y = r; add(m); });
      // the deck
      for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(cardG('back'), cardMat); m.position.set(CARD.x - 0.02, y0 + 0.006 + i * 0.0007, CARD.z + 0.2); m.rotation.y = 1.2 + i * 0.01; add(m); }
      add(at(new THREE.Mesh(G.boxUV(cw, 0.01, chh, 1).rotateY(1.2), new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.8, name: 'deckEdge' })), CARD.x - 0.02, y0 + 0.006 - 0.0045 + 0.0044, CARD.z + 0.2));
      // poker chips
      const chipG = new THREE.CylinderGeometry(0.019, 0.019, 0.0034, 20);
      const chipMats = [0xe7dfcc, 0x8a1a1c, 0x162a4a, 0x121010].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 0.4, name: 'chip' }));
      const rnd = ctx.random.fork('chips');
      [[0.25, -0.18, 9], [0.29, -0.13, 6], [-0.27, 0.05, 12], [-0.22, 0.1, 5], [0.03, 0.08, 3]].forEach(([x, z, n], s) => {
        for (let i = 0; i < n; i++) { const m = new THREE.Mesh(chipG, chipMats[(s + (i > n / 2 ? 1 : 0)) % 4]); m.position.set(CARD.x + x + (rnd.next() - 0.5) * 0.003, y0 + 0.0017 + i * 0.0035, CARD.z + z + (rnd.next() - 0.5) * 0.003); add(m); }
      });
      // whisky tumbler, ashtray with a cigar, oil lamp
      const tum = G.latheFromProfile([[0, 0], [0.032, 0], [0.034, 0.004], [0.036, 0.09], [0.033, 0.09], [0.031, 0.012], [0, 0.012]], 8);
      add(at(new THREE.Mesh(tum, mat.crystal), CARD.x - 0.3, y0, CARD.z - 0.14));
      add(at(new THREE.Mesh(G.latheFromProfile([[0, 0.012], [0.03, 0.012], [0.03, 0.035], [0, 0.035]], 12), new THREE.MeshPhysicalMaterial({ color: 0x6a3208, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85, name: 'whisky' })), CARD.x - 0.3, y0, CARD.z - 0.14));
      add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0], [0.065, 0.015], [0.05, 0.02], [0.045, 0.008], [0, 0.008]], 24), mat.crystal), CARD.x + 0.08, y0, CARD.z + 0.3));
      const cigar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.13, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.9, name: 'cigar' }));
      cigar.position.set(CARD.x + 0.1, y0 + 0.02, CARD.z + 0.32); cigar.rotation.y = 0.5; add(cigar);
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.35, 0.08).multiplyScalar(4), toneMapped: false })); ember.position.set(CARD.x + 0.1 + Math.cos(0.5) * 0.065, y0 + 0.02, CARD.z + 0.32 - Math.sin(0.5) * 0.065); ember.userData.noBake = true; add(ember);
      // smoke wisp: a twisting tapered ribbon, ghost-lit
      const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push(V3(Math.sin(t * 9) * 0.03 * t + t * 0.05, t * 0.75, Math.cos(t * 7) * 0.025 * t)); }
      const smokeMat = fx.ghostMaterial({ color: 0x8a96aa, rimColor: 0xc8d2e0, opacity: 0.22, intensity: 0.5 });
      const smoke = new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3(pts), 60, 0.003, 0.03, 8), smokeMat);
      smoke.position.copy(ember.position); smoke.userData.noBake = true; smoke.userData.keep = true; smoke.renderOrder = 6; add(smoke);
      ctx.onUpdate((dt, t) => { smoke.rotation.y = t * 0.25; smoke.scale.set(1 + Math.sin(t * 0.7) * 0.15, 1, 1); });
      // oil lamp (lit) at the far side of the table
      const lampBase = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0], [0.06, 0.01], [0.025, 0.03], [0.02, 0.08], [0.05, 0.11], [0.055, 0.14], [0.03, 0.17], [0.015, 0.18], [0, 0.18]], 20), mat.brass);
      lampBase.position.set(CARD.x - 0.05, y0, CARD.z - 0.3); add(lampBase);
      const chimney = new THREE.Mesh(G.latheFromProfile([[0.02, 0], [0.028, 0.03], [0.034, 0.06], [0.02, 0.12], [0.017, 0.2]], 18), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.15, depthWrite: false, name: 'chimney' }));
      chimney.position.set(CARD.x - 0.05, y0 + 0.18, CARD.z - 0.3); chimney.userData.noShadow = true; add(chimney);
      const lf = fx.flame({ height: 0.045, width: 0.014, intensity: 7, seed: 77 });
      lf.position.set(CARD.x - 0.05, y0 + 0.19, CARD.z - 0.3); add(lf);
    }
    const clT = clubLeatherTexture(ctx.textures).withRepeat(2.4, 2.4);
    const oxblood = new THREE.MeshPhysicalMaterial({ map: clT.map, normalMap: clT.normalMap, normalScale: new THREE.Vector2(0.65, 0.65), roughnessMap: clT.ormMap, aoMap: clT.ormMap, roughness: 1.0, metalness: 0, vertexColors: true, clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.45, color: new THREE.Color(1.0, 0.95, 0.92), name: 'clubLeather' });
    const chest = buildChesterfield2(ctx, { leather: oxblood, leatherDark: mat.leatherDark, wood: mat.wood, brass: mat.brass });
    chest.position.set(2.0, 0, -2.08); chest.rotation.y = -0.75; add(chest);
    {
      // small wine table by the armchair with a brandy balloon
      const wt = new THREE.Group();
      wt.add(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.16, 0], [0.16, 0.02], [0.05, 0.05], [0.025, 0.1], [0.03, 0.3], [0.02, 0.5], [0.03, 0.55], [0, 0.56]], 18), mat.wood));
      wt.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.22, 0], [0.225, 0.015], [0.22, 0.03], [0, 0.03]], 32), mat.wood), 0, 0.56, 0));
      wt.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.03, 0], [0.004, 0.006], [0.004, 0.04], [0.035, 0.06], [0.045, 0.09], [0.035, 0.12], [0.03, 0.125]], 16), mat.crystal), 0.04, 0.59, 0.02));
      wt.position.set(2.82, 0, -2.85); add(wt);
    }

    // ================================================================ front (door) wall + floor dressing
    {
      const sb = buildScoreboard(ctx, { wood: mat.wood, brass: mat.brass, gilt: mat.gilt, chalk: mat.tip });
      sb.position.set(lx.left(2.45), 1.72, 0.0); S.left.grp.add(sb);
      const printGlass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2, depthWrite: false, name: 'printGlass' });
      const pm = { mount: new THREE.MeshStandardMaterial({ color: 0xcfc2a2, roughness: 0.92, name: 'mount' }), mountCore: new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9, name: 'mountCore' }), ebony: mat.ebony, gilt: mat.gilt, glass: printGlass,
        engraving: (subject, aspect) => engravingTexture(ctx.textures, { subject, aspect }) };
      for (const [x, seed, subj] of [[2.0, 31, 0], [2.85, 47, 1]]) { const pr = buildPrint(ctx, pm, { w: 0.44, h: 0.56, seed, subject: subj }); pr.position.set(lx.front(x), 1.88, 0.02); S.front.grp.add(pr); }
      const pr3 = buildPrint(ctx, pm, { w: 0.6, h: 0.42, seed: 53, subject: 2 }); pr3.position.set(lx.front(2.42), 2.52, 0.02); S.front.grp.add(pr3);
      const cart = buildDrinksCart(ctx, { wood: mat.wood, brass: mat.brass, crystal: mat.crystal, silver: mat.silver, siphon: new THREE.MeshPhysicalMaterial({ color: 0x3a6a8a, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1, name: 'siphon' }) });
      cart.position.set(-0.5, 0, Z1 - 0.32); cart.rotation.y = Math.PI; add(cart);
      const spit = buildSpittoon(ctx, { brass: mat.brass }); spit.position.set(-1.12, 0, 1.98); add(spit);
      const hs = buildHatStand(ctx, { wood: mat.walnut, brass: mat.brass, ebony: mat.ebony, silver: mat.silver, felt: new THREE.MeshStandardMaterial({ color: 0x14110f, roughness: 0.85, name: 'felt' }), ribbon: new THREE.MeshStandardMaterial({ color: 0x080606, roughness: 0.5, name: 'ribbon' }) });
      hs.position.set(-2.9, 0, Z1 - 0.38); add(hs);
      // a worn runner from the gallery door in toward the table
      const rr = persianRugTexture(ctx.textures, { key: 'gameroom:runner', size: [0.9, 2.3], legs: [20, 20], scale: 0.5, runner: 1, px: 1024 });
      const rmat = new THREE.MeshPhysicalMaterial({ map: rr.map, normalMap: rr.normalMap, roughnessMap: rr.ormMap, aoMap: rr.ormMap, roughness: 1, metalness: 0, sheen: 0.4, sheenRoughness: 0.7, sheenColor: new THREE.Color(0.55, 0.32, 0.26), envMapIntensity: 0.2, color: new THREE.Color(0.9, 0.88, 0.85), name: 'runner' });
      const runner = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.3).rotateX(-Math.PI / 2), rmat); runner.position.set(DOOR.x, 0.008, Z1 - 0.15 - 1.15); runner.name = 'rug'; add(runner);
      const edgeMat2 = new THREE.MeshStandardMaterial({ color: 0x1a0f0b, roughness: 0.95, name: 'rugEdge' });
      for (const sx of [-1, 1]) add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.012, 0.008, 2.3, 2, 0.003), edgeMat2), DOOR.x + sx * 0.444, 0.004, Z1 - 0.15 - 1.15));
    }

    // ================================================================ wall sconces
    const sconceLights = [];
    for (const [s, x] of [['right', lx.right(FIRE_Z) - 1.15], ['right', lx.right(FIRE_Z) + 1.15], ['left', lx.left(-0.2)], ['front', lx.front(-0.8)], ['front', lx.front(-2.6)]]) {
      const sc = buildSconce(ctx, { brass: mat.bronze, globe: mat.globe });
      sc.position.set(x, 1.95, 0.0); S[s].grp.add(sc);
      sc.updateWorldMatrix(true, false);
      const l = new THREE.PointLight(0xffb070, 1.6, 5, 2);
      root.updateMatrixWorld(true);
      const wp = sc.localToWorld(sc.userData.lightPos.clone()); l.position.copy(root.worldToLocal(wp)); root.add(l); sconceLights.push(l);
    }

    // ================================================================ lights
    // Hierarchy: the billiard lamp is the key (warm, hot pool on the baize), the moon a cold
    // rim through the windows, fire + sconces warm practicals; everything else falls to blue-black.
    const moonPos = V3(-0.7, 8.65, Z0 - 5.0), moonTarget = V3(-1.0, 0, -2.6);
    const moon = new THREE.SpotLight(0xb8c4dc, 520, 26, 0.31, 0.6, 2);
    moon.position.copy(moonPos); moon.target.position.copy(moonTarget);
    moon.castShadow = Q.shadows;
    moon.shadow.mapSize.set(Q.shadowMapSize, Q.shadowMapSize);
    moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.02; moon.shadow.radius = Math.max(4, Q.shadowRadius || 0);
    moon.shadow.camera.near = 3; moon.shadow.camera.far = 22;
    root.add(moon, moon.target);
    root.add(new THREE.HemisphereLight(0x323a48, 0x2a1c10, 0.92));
    // soft bounce: the lamp pool on the baize lifts the upper walls and ceiling, the hearth warms its corner
    root.add(fx.areaLight({ center: [T.x, 0.84, T.z], normal: [0.001, 1, 0.01], width: 1.3, height: 2.4, color: 0xc8b080, intensity: 0.55 }));
    root.add(fx.areaLight({ center: [X1 - 0.7, 0.5, FIRE_Z], normal: [-1, 0.35, 0], width: 1.3, height: 0.9, color: 0xff9a52, intensity: 0.5 }));
    for (const wx of WIN.xs) root.add(fx.areaLight({ center: [wx, WIN.sill + WIN.h / 2, Z0 - 0.1], normal: [0, -0.3, 1], width: WIN.w - 0.1, height: WIN.h - 0.1, color: 0xa6b6d4, intensity: 1.7 }));
    {
      const pls = new THREE.SpotLight(0xffc890, 2.2, 3, 0.7, 0.6, 2);
      pls.position.set(0, 2.2 + 0.41 + 0.18, Z0 + 0.14); pls.target.position.set(0, 2.0, Z0); root.add(pls, pls.target);
      // picture light over the hunting scene
      if (paintingLightAt) {
        root.updateMatrixWorld(true);
        const lp = root.worldToLocal(paintingLightAt.localToWorld(V3(0, 0.95 / 2 + 0.14, 0.16)));
        const lt = root.worldToLocal(paintingLightAt.localToWorld(V3(0, -0.45, -0.1)));
        const hl = new THREE.SpotLight(0xffc488, 4.5, 3.5, 0.95, 0.8, 2); hl.position.copy(lp); hl.target.position.copy(lt); root.add(hl, hl.target);
      }
    }
    // the billiard lamp: a tight warm spot under each shade (centre one shadowed) + a glow above the shades
    const lampY = H - LAMP_DROP - 0.16;
    let lampBase = 30;
    const lampSpots = lamp.userData.bulbs.map((b, i) => {
      const sp = new THREE.SpotLight(0xffd29a, lampBase, 5, 0.58, 0.7, 2);
      sp.position.set(T.x, lampY, T.z + b.z); sp.target.position.set(T.x, 0, T.z + b.z);
      if (i === 1) {
        sp.castShadow = Q.shadows;
        sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0012; sp.shadow.normalBias = 0.02; sp.shadow.radius = 4; sp.shadow.camera.near = 0.1; sp.shadow.camera.far = 4;
      }
      root.add(sp, sp.target);
      return sp;
    });
    const lampGlow = new THREE.PointLight(0xffb066, 2.6, 5, 2); lampGlow.position.set(T.x, lampY + 0.55, T.z); root.add(lampGlow);
    // warm bounce off the rug and the floor around the table (the lamp pool spilling past the rails)
    for (const sx of [-1, 1]) { const b = new THREE.PointLight(0xc88a58, 0.9, 2.6, 2); b.position.set(T.x + sx * 1.15, 0.32, T.z + sx * 0.3); root.add(b); }
    // fire: low in the firebox, flickering +-25% at 2-4 Hz
    const fireLight = new THREE.PointLight(0xff7c34, 5, 7, 2); fireLight.position.set(X1 - 0.48, 0.42, FIRE_Z); root.add(fireLight);
    {
      // dedicated narrow picture-light spots on the trophies: warm, from above and in front, so the antlers
      // rim-light and throw their shadow on the damask
      const sl = new THREE.SpotLight(0xffcf98, 11, 4.5, 0.28, 0.55, 2);
      sl.position.set(X1 - 1.05, 3.32, STAG_Z + 0.42); sl.target.position.set(X1 - 0.3, 2.3, STAG_Z - 0.02);
      sl.castShadow = Q.shadows; sl.shadow.mapSize.set(1024, 1024); sl.shadow.bias = -0.0008; sl.shadow.normalBias = 0.01; sl.shadow.radius = 3; sl.shadow.camera.near = 0.3; sl.shadow.camera.far = 3;
      root.add(sl, sl.target);
      const bl = new THREE.SpotLight(0xffcf98, 8, 4, 0.36, 0.55, 2);
      bl.position.set(X0 + 1.0, 3.4, 1.6); bl.target.position.set(X0 + 0.25, 2.66, 0.85);
      bl.castShadow = Q.shadows; bl.shadow.mapSize.set(512, 512); bl.shadow.bias = -0.0008; bl.shadow.normalBias = 0.01; bl.shadow.radius = 3; bl.shadow.camera.near = 0.3; bl.shadow.camera.far = 3;
      root.add(bl, bl.target);
    }
    // card table oil lamp
    const oilLight = new THREE.PointLight(0xffa04a, 1.5, 4, 2); oilLight.position.set(CARD.x - 0.05, 1.0, CARD.z - 0.3); root.add(oilLight);
    // a candle left burning on the games table: warm fill on the chessboard
    const chessCandle = fx.candle({ height: 0.1, radius: 0.012, light: true, lightIntensity: 1.5, lightDistance: 3, seed: 61, burn: 0.55 });
    {
      // a brass chamberstick: drip pan with a ring handle and a short socket
      const cs = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.05, 0], [0.054, 0.004], [0.052, 0.012], [0.046, 0.009], [0.016, 0.012], [0.011, 0.02], [0.011, 0.038], [0.016, 0.042], [0.013, 0.046], [0, 0.046]], 24), mat.brass);
      // the chamberstick stands at the far left corner, away from the puzzle camera
      const CX = C.x - 0.352, CZ = C.z - 0.14;
      cs.position.set(CX, boardY, CZ); add(cs);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0035, 8, 18), mat.brass); ring.position.set(CX + 0.06, boardY + 0.018, CZ); add(ring);
      chessCandle.position.set(CX, boardY + 0.044, CZ); add(chessCandle);
      // a calmer flame: layered (blue root, warm core, orange tip) at a third of the default HDR level, plus a soft halo
      const fl = chessCandle.userData.flame;
      if (fl?.material?.uniforms) { fl.material.uniforms.uIntensity.value = 3.2; fl.material.uniforms.uColorBase.value.set(0.2, 0.32, 1.0); fl.material.uniforms.uColorCore.value.set(1.0, 0.9, 0.62); }
      {
        const haloTex = ctx.textures.canvas('gameroom:halo', 64, 64, (c) => { const g2 = c.createRadialGradient(32, 32, 0, 32, 32, 32); g2.addColorStop(0, 'rgba(255,200,130,0.9)'); g2.addColorStop(0.25, 'rgba(255,160,80,0.35)'); g2.addColorStop(1, 'rgba(255,140,60,0)'); c.clearRect(0, 0, 64, 64); c.fillStyle = g2; c.fillRect(0, 0, 64, 64); }, { tile: false });
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(0.5, 0.4, 0.3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
        halo.scale.set(0.09, 0.11, 1); halo.position.set(CX, boardY + 0.044 + 0.1 + 0.02, CZ); halo.userData.noBake = true; halo.userData.keep = true; halo.renderOrder = 11; add(halo);
      }
      // felt-lined walnut tray along the near edge of the table for the queens not yet in play: recessed, baize-lined, brass-edged
      const tl = 0.5, tw = 0.074, th = 0.016;
      const ts = new THREE.Shape(); ts.moveTo(-tl / 2, -tw / 2); ts.lineTo(tl / 2, -tw / 2); ts.lineTo(tl / 2, tw / 2); ts.lineTo(-tl / 2, tw / 2); ts.lineTo(-tl / 2, -tw / 2);
      const thole = new THREE.Path(); const ti = 0.007; thole.moveTo(-tl / 2 + ti, -tw / 2 + ti); thole.lineTo(-tl / 2 + ti, tw / 2 - ti); thole.lineTo(tl / 2 - ti, tw / 2 - ti); thole.lineTo(tl / 2 - ti, -tw / 2 + ti); thole.lineTo(-tl / 2 + ti, -tw / 2 + ti); ts.holes.push(thole);
      const tg = new THREE.ExtrudeGeometry(ts, { depth: th - 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0018, bevelSegments: 2 }); tg.rotateX(-Math.PI / 2); tg.translate(0, 0.002, 0);
      const TZ = C.z + BOARD / 2 + 0.055;
      add(at(new THREE.Mesh(G.applyBoxUVs(tg, 6), mat.walnut), C.x, boardY, TZ));
      const bz = baize.withRepeat(8, 8);
      const felt = new THREE.MeshPhysicalMaterial({ map: bz.map, normalMap: bz.normalMap, normalScale: new THREE.Vector2(1.5, 1.5), roughness: 0.95, metalness: 0, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.35, 0.6, 0.4), color: new THREE.Color(1.5, 1.35, 1.25), name: 'trayFelt' });
      add(at(new THREE.Mesh(G.boxUV(tl - 0.012, 0.004, tw - 0.012, 3), felt), C.x, boardY + 0.003, TZ));
      // brass edge strip round the rim
      const rim = new THREE.Shape(); const ro = 0.0012;
      rim.moveTo(-tl / 2 - ro, -tw / 2 - ro); rim.lineTo(tl / 2 + ro, -tw / 2 - ro); rim.lineTo(tl / 2 + ro, tw / 2 + ro); rim.lineTo(-tl / 2 - ro, tw / 2 + ro); rim.lineTo(-tl / 2 - ro, -tw / 2 - ro);
      const rh = new THREE.Path(); const rw = 0.0035; rh.moveTo(-tl / 2 + rw, -tw / 2 + rw); rh.lineTo(-tl / 2 + rw, tw / 2 - rw); rh.lineTo(tl / 2 - rw, tw / 2 - rw); rh.lineTo(tl / 2 - rw, -tw / 2 + rw); rh.lineTo(-tl / 2 + rw, -tw / 2 + rw); rim.holes.push(rh);
      const rg = new THREE.ExtrudeGeometry(rim, { depth: 0.0012, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 1 }); rg.rotateX(-Math.PI / 2);
      add(at(new THREE.Mesh(rg, mat.brass), C.x, boardY + th + 0.0004, TZ));
    }
    // warm spill from the gallery beyond the door
    root.add(fx.areaLight({ center: [DOOR.x, 1.4, Z1 - 0.05], normal: [0, 0.05, -1], width: 1.0, height: 2.4, color: 0xffc896, intensity: 1.0 }));
    ctx.onUpdate((dt, t) => {
      const f = 0.97 + 0.02 * Math.sin(t * 5.3) * Math.sin(t * 2.1) + 0.01 * Math.sin(t * 11.1);
      lampSpots.forEach((s) => { s.intensity = lampBase * f; });
      lampGlow.intensity = 2.6 * f;
      const ff = 1 + 0.14 * Math.sin(t * 2 * Math.PI * 2.3) + 0.08 * Math.sin(t * 2 * Math.PI * 3.7 + 1.3) + 0.05 * Math.sin(t * 2 * Math.PI * 2.9 + 4.0);
      fireLight.intensity = 4.6 * ff;
      fireLight.color.setRGB(1.0, 0.47 + 0.05 * (ff - 1), 0.19 + 0.04 * (ff - 1));
      fire.userData.coalMat.emissiveIntensity = 0.7 * (0.85 + 0.3 * (ff - 0.75));
      fire.userData.logMat.emissiveIntensity = 2.2 * (0.8 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.3)) * ff);
      oilLight.intensity = 1.5 * (0.92 + 0.08 * Math.sin(t * 8.3) * Math.sin(t * 3.3 + 2));
    });

    // volumetrics: clipped moon shafts (shadowed by the games table), tobacco haze under the shades, dust, floor mist
    const shafts = [];
    const roomMin = V3(X0 + 0.02, 0.0, Z0 - 0.4), roomMax = V3(X1 - 0.02, H, Z1);
    const gtOcc = { x: C.x, z: C.z, top: gtable.userData.topY, hx: 0.41, hz: 0.41 };
    for (const wx of WIN.xs) {
      const winCenter = V3(wx, WIN.sill + WIN.h / 2, Z0 - 0.05);
      const dir = new THREE.Vector3().subVectors(winCenter, moonPos).normalize();
      const sh = clippedShaft({ center: winCenter, right: V3(WIN.w / 2 - 0.02, 0, 0), up: V3(0, WIN.h / 2 - 0.02, 0), direction: dir, length: wx < 0 ? 4.4 : 2.3, color: 0xa8b8d8, intensity: wx < 0 ? 0.14 : 0.1, softness: 0.25, falloff: 1.5, panes: [2, 4], mullion: 0.03, noise: 0.75, roomMin, roomMax, occluders: wx < 0 ? [gtOcc] : [], time: ctx.time, steps: Math.round((Q.volumetricSteps || 16) * 1.25) });
      root.add(sh); shafts.push(sh);
    }
    lamp.userData.bulbs.forEach((b, i) => {
      const hz = hazeCone({ top: 0.17, bottom: 0.62, height: 0.9, color: 0xffc27a, opacity: 0.009, seed: i * 3.7, time: ctx.time });
      hz.position.set(T.x, lampY + 0.03, T.z + b.z); add(hz);
    });
    const dust = root.add(fx.dust({ box: new THREE.Box3(V3(-3.0, 0.3, Z0 + 0.1), V3(0.4, 3.0, -1.6)), count: 1400, shafts, size: 0.0036, intensity: 1.3, ambient: 0.0 })) && root.children[root.children.length - 1];
    root.add(fx.fog({ box: new THREE.Box3(V3(T.x - 1.3, 1.2, T.z - 1.9), V3(T.x + 1.3, 2.4, T.z + 1.9)), color: 0x1a1a1e, litColor: 0x8a6a48, density: 0.14, heightFalloff: 0.8 }));
    root.add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.1, 0, Z0 + 0.1), V3(X1 - 0.1, 0.45, Z1 - 0.3)), color: 0x080c16, litColor: 0x2a3550, density: 0.35, heightFalloff: 4 }));

    // ================================================================ the queens puzzle
    const queens = createQueensPuzzle(ctx, {
      parent: root,
      center: V3(C.x, boardY, C.z),
      size: FIELD,
      homeZ: BOARD / 2 + 0.055, homeY: 0.005, homeSpacing: 0.058,
      mats: { ivory: mat.queenIvory },
      borderOuter: (BOARD - FIELD) / 2 * 0.42,
      camera: { position: [C.x, boardY + 0.84, C.z + 0.6], target: [C.x, boardY, C.z + 0.1], fov: 40 },
      onSolved: async () => {
        ctx.state.set('gameroom.queensSolved', true);
        ctx.audio.sfx?.('chime', { freq: 880 });
        await ctx.say({ text: 'Eight queens, and not one of them at another\'s throat. How very *unlike* a family.', speaker: 'stauf', speakerName: 'Stauf' });
      },
    });
    if (ctx.state.isSolved(QUEENS_ID)) queens.applySolved();
    // the moon shaft passes right through the puzzle camera: thin it out while playing
    {
      const pz = queens.puzzle, setup0 = pz.setup, teardown0 = pz.teardown;
      const shaftI = shafts.map((sh) => sh.material.uniforms.uIntensity.value);
      const moonI = moon.intensity;
      // a soft warm key over the board while playing, so the felt tray and the pieces read
      const pzFill = new THREE.SpotLight(0xffd6a0, 0, 3, 0.75, 0.9, 2);
      pzFill.position.set(C.x - 0.2, boardY + 1.1, C.z + 0.55); pzFill.target.position.set(C.x, boardY, C.z + 0.12); root.add(pzFill, pzFill.target);
      pz.setup = (p) => { dust.visible = false; moon.intensity = moonI * 0.55; pzFill.intensity = 1.6; shafts.forEach((sh, i) => { sh.material.uniforms.uIntensity.value = shaftI[i] * 0.12; }); ctx.post.set({ exposure: 0.92, godRayWeight: 0.04, bloomStrength: 0.18, bloomThreshold: 1.4 }, ctx.shot ? 0 : 0.8); return setup0(p); };
      pz.teardown = (p) => { dust.visible = true; moon.intensity = moonI; pzFill.intensity = 0; shafts.forEach((sh, i) => { sh.material.uniforms.uIntensity.value = shaftI[i]; }); ctx.post.set({ exposure: ROOM_GRADE.exposure, godRayWeight: ROOM_GRADE.godRayWeight, bloomStrength: ROOM_GRADE.bloomStrength, bloomThreshold: ROOM_GRADE.bloomThreshold }, 0.8); return teardown0(p); };
    }
    if (ctx.params.get('queens') === 'mid') queens.arrange([[0, 0], [4, 1], [7, 2], [3, 3], [2, 4]]);
    if (ctx.params.get('queens') === 'solved') queens.applySolved();

    // ================================================================ ghostly cue ball (examine the table)
    let rolling = null;
    ctx.onUpdate((dt) => {
      if (!rolling) return;
      rolling.t += dt;
      const u = Math.min(1, rolling.t / rolling.d);
      const e = 1 - (1 - u) * (1 - u);
      const b = rolling.ball;
      b.position.lerpVectors(rolling.from, rolling.to, e);
      if (b.userData.ao) { b.userData.ao.position.x = b.position.x; b.userData.ao.position.z = b.position.z; if (u >= 1 && rolling.sink) b.userData.ao.visible = false; }
      b.rotation.x += dt * 9 * (1 - u);
      if (u >= 1) {
        if (rolling.sink) { b.position.y -= Math.min(0.08, (rolling.t - rolling.d) * 0.5); if (rolling.t > rolling.d + 0.3) { b.visible = false; rolling = null; } }
        else rolling = null;
      }
    });

    // ================================================================ nodes, edges, exits
    const nodes = {
      main: { position: [-1.75, 1.63, 3.4], target: [0.4, 1.18, -3.2], fov: 60, label: 'The game room', look: { yaw: [-50, 50], pitch: [-28, 24] } },
      door: { position: [-1.7, 1.63, 3.25], target: [-1.7, 1.35, 8.0], fov: 58, label: 'The way out' },
      billiards: { position: [1.62, 1.58, 1.95], target: [-0.25, 0.8, -1.05], fov: 55, label: 'The billiard table', look: { yaw: [-55, 55], pitch: [-35, 25] } },
      chess: { position: [-0.65, 1.52, -1.45], target: [C.x, 0.78, C.z], fov: 54, label: 'The games table', look: { yaw: [-60, 60], pitch: [-35, 25] } },
      hearth: { position: [1.25, 1.58, 1.45], target: [X1, 1.42, FIRE_Z - 0.15], fov: 60, label: 'The fireplace', look: { yaw: [-60, 60], pitch: [-25, 30] } },
      back: { position: [0.05, 1.62, -3.05], target: [-0.9, 1.3, 4.0], fov: 58, label: 'Looking back' },
    };
    const edges = [
      ['main', 'door', null, { hotspot: { door: { position: [-1.7, 1.3, 5.4], radius: 0.8 }, main: { position: [-1.0, 1.4, 0.5], radius: 0.8 } } }],
      ['main', 'billiards', [[-0.6, 1.6, 2.6]]],
      ['main', 'chess', [[-1.55, 1.6, 1.4], [-1.45, 1.58, -0.3]]],
      ['main', 'hearth', [[-0.4, 1.6, 2.4], [1.2, 1.6, 1.8]]],
      ['billiards', 'hearth'],
      ['billiards', 'back', [[1.55, 1.6, -0.8], [1.0, 1.6, -2.5]]],
      ['hearth', 'back', [[1.5, 1.6, -1.6]]],
      ['chess', 'back'],
      ['chess', 'billiards', [[-1.2, 1.6, 1.5], [0.5, 1.6, 1.8]]],
      ['back', 'main', [[-1.3, 1.6, -1.2], [-1.6, 1.6, 2.0]], { hotspot: { main: { position: [-1.2, 1.4, 2.6], radius: 0.6 } } }],
    ];
    const doorBox = { min: [DOOR.x - DOOR.w / 2, 0.1, Z1 - 0.12], max: [DOOR.x + DOOR.w / 2, DOOR.h, Z1 + 0.05] };
    const exits = [
      { node: 'door', toRoom: 'gallery', toNode: 'gamedoor', label: 'Back to the gallery', hotspot: { box: doorBox } },
      { node: 'back', toRoom: 'gallery', toNode: 'gamedoor', label: 'To the gallery', hotspot: { box: doorBox } },
    ];

    // ================================================================ hotspots
    const cap = (title, text) => () => ctx.ui.caption(text, { title });
    const hotspots = [
      { id: 'queens', nodes: ['chess', 'main', 'back'], box: { min: [C.x - 0.36, boardY - 0.02, C.z - 0.36], max: [C.x + 0.36, boardY + 0.12, C.z + 0.36] }, cursor: 'puzzle', label: 'The chessboard', puzzle: queens.puzzle, priority: 2 },
      {
        id: 'cueball', nodes: ['billiards', 'main'], sphere: { center: T.clone().add(V3(0.18, BH + BR, 0.62)).toArray(), radius: 0.12 }, cursor: 'grab', label: 'The cue ball', priority: 2,
        enabled: () => !ctx.state.has('gameroom.eightSunk'),
        onActivate: async () => {
          // the eight-ball rolls on its own into the far corner pocket
          const eight = balls[8];
          const pocket = btable.userData.pockets.find((p) => p.x < 0 && p.z < -0.5);
          rolling = { ball: eight, from: eight.position.clone(), to: V3(pocket.x * 0.94, BH + BR, pocket.z * 0.97), t: 0, d: 1.8, sink: true };
          ctx.state.set('gameroom.eightSunk', true);
          ctx.audio.sfx?.('click');
          await new Promise((r) => setTimeout(r, 1900));
          ctx.audio.sfx?.('thud');
          await ctx.say({ text: 'The eight ball, in the corner pocket. You *do* know what that means... you lose.', speaker: 'stauf', speakerName: 'Stauf' });
        },
      },
      { id: 'billiard-table', nodes: ['billiards', 'main', 'back'], box: { min: [T.x - 0.75, 0.2, T.z - 1.3], max: [T.x + 0.75, BH + 0.05, T.z + 1.3] }, cursor: 'examine', label: 'The billiard table', onActivate: cap('The Billiard Table', 'Green baize gone grey at the cushions. Someone was halfway through a game — the score on the wall stops at thirteen to seven.') },
      {
        id: 'lamp', nodes: ['billiards', 'main', 'back'], box: { min: [T.x - 0.25, lampY - 0.05, T.z - 1.0], max: [T.x + 0.25, lampY + 0.3, T.z + 1.0] }, cursor: 'examine', label: 'The billiard lamp',
        onActivate: async () => { lampBase = 4; await new Promise((r) => setTimeout(r, 300)); lampBase = 13; ctx.ui.caption('The green shades sway, though nothing touched them. Tobacco smoke hangs under them that no one has breathed for years.', { title: 'The Lamp' }); },
      },
      {
        id: 'stag', nodes: ['hearth', 'main', 'billiards'], sphere: { center: [X1 - 0.35, 2.3, STAG_Z], radius: 0.45 }, cursor: 'talk', label: 'A stag\'s head',
        onActivate: async () => { ctx.audio.sfx?.('laugh'); await ctx.say({ text: 'A magnificent beast. He came for dinner, too. He simply... *stayed*.', speaker: 'stauf', speakerName: 'Stauf' }); },
      },
      { id: 'fire', nodes: ['hearth', 'main'], box: { min: [X1 - 0.6, 0.0, FIRE_Z - 0.7], max: [X1, 1.3, FIRE_Z + 0.7] }, cursor: 'examine', label: 'The fireplace', onActivate: cap('The Fireplace', 'The fire is burning, and has been burning, and nobody has fed it. The logs never grow smaller.') },
      { id: 'cuerack', nodes: ['main', 'chess', 'billiards', 'back'], box: { min: [X0, 0.3, 0.4], max: [X0 + 0.2, 2.15, 1.3] }, cursor: 'examine', label: 'The cue rack', onActivate: cap('The Cue Rack', 'Seven cues and an empty clip. The beads on the scoreboard have been pushed to thirteen.') },
      { id: 'boar', nodes: ['main', 'chess', 'billiards'], sphere: { center: [X0 + 0.25, 2.72, 0.85], radius: 0.3 }, cursor: 'examine', label: 'A boar\'s head', onActivate: cap('The Boar', 'Its tusks are yellowed and one is chipped. The glass eyes have been turned, very slightly, to watch the door.') },
      { id: 'scoreboard', nodes: ['back', 'main'], box: { min: [X0, 1.3, 1.95], max: [X0 + 0.15, 2.3, 2.95] }, cursor: 'examine', label: 'The scoreboard', onActivate: cap('The Scoreboard', 'Sixty-five to forty, and the pointers rusted where they stand. The second player never came back from the cellar.') },
      { id: 'cards', nodes: ['back', 'main', 'hearth'], box: { min: [CARD.x - 0.5, 0.6, CARD.z - 0.5], max: [CARD.x + 0.5, 0.95, CARD.z + 0.5] }, cursor: 'examine', label: 'A hand of cards', onActivate: cap('The Card Table', 'A seven of hearts, a queen of spades, an ace. Three hands dealt, and a fourth place laid for a player who never sat down.') },
      { id: 'painting', nodes: ['main', 'chess', 'back'], box: { min: [X0, 1.55, -2.3], max: [X0 + 0.15, 2.65, -0.8] }, cursor: 'examine', label: 'A hunting scene', onActivate: cap('The Painting', 'A moonlit hunt. The hounds are painted with great care. The quarry has been scraped out of the canvas.') },
      {
        id: 'armchair', nodes: ['hearth', 'back', 'billiards'], box: { min: [1.5, 0.1, -2.6], max: [2.6, 1.0, -1.5] }, cursor: 'ghost', label: 'A leather armchair',
        onActivate: async () => {
          ctx.post.set({ saturation: 0.6, vignette: 0.6 }, 0.6);
          await ctx.say({ text: 'The leather is warm, and holds the shape of someone heavy. A smell of cigars, and very faintly, of formaldehyde.', speaker: 'narrator', speakerName: '' });
          ctx.post.set(ROOM_GRADE, 1.0);
        },
      },
      { id: 'window', nodes: ['chess', 'back'], box: { min: [WIN.xs[0] - WIN.w / 2, WIN.sill, Z0 - 0.4], max: [WIN.xs[0] + WIN.w / 2, WIN.sill + WIN.h, Z0] }, cursor: 'examine', label: 'The window', onActivate: cap('The Window', 'The dead elm scratches at the glass. Down on the lawn the snow is unbroken — but the gate below is standing open.') },
    ];

    // ================================================================ QA hooks
    if (typeof window !== 'undefined') {
      const dbg = (window.__debug ||= {});
      dbg.solvers ||= {}; dbg.states ||= {};
      dbg.solvers.gameroom = async () => {
        const game = window.__game;
        if (game && !game.puzzle && game.room?.mod?.id === 'gameroom' && game.startPuzzle) {
          game.startPuzzle(queens.puzzle);
          await new Promise((r) => setTimeout(r, 50));
        }
        if (game?.puzzle?.def?.id === QUEENS_ID) { queens.puzzle.autoSolve(game.puzzle.pctx); return true; }
        queens.applySolved(); ctx.state.markSolved?.(QUEENS_ID);
        return true;
      };
      dbg.states.gameroom = () => ({ ...queens.state(), isSolved: ctx.state.isSolved(QUEENS_ID) });
      dbg.solve ||= (id) => (dbg.solvers[id] ? dbg.solvers[id]() : Promise.reject(new Error(`no solver for ${id}`)));
      dbg.state ||= (id) => (dbg.states[id] ? dbg.states[id]() : null);
      dbg.gameroom = { queens, click: queens.click, arrange: queens.arrange, reset: queens.reset };
    }

    // review/debug: ?grOff=moon,lamp,area,fire,sconce,hemi disables light groups
    {
      const off = (ctx.params.get('grOff') || '').split(',');
      const kill = (l) => { l.intensity = 0; l.visible = false; };
      if (off.includes('moon')) kill(moon);
      if (off.includes('lamp')) { lampSpots.forEach(kill); lampBase = 0; }
      if (off.includes('fire')) kill(fireLight);
      if (off.includes('sconce')) sconceLights.forEach(kill);
      root.traverse((o) => { if (off.includes('area') && o.isRectAreaLight) kill(o); if (off.includes('hemi') && o.isHemisphereLight) kill(o); });
    }

    // ================================================================ shadows + merge
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const fxLike = o.isPoints || m?.isShaderMaterial || m?.isMeshBasicMaterial || (m?.transparent && (m.opacity ?? 1) < 0.6) || o.userData.noBake;
      o.castShadow = !o.userData.noShadow && !fxLike && !['floor', 'rug', 'cloth'].includes(o.name);
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });
    root.userData.mergedCount = mergeStatic(root);

    const godRays = WIN.xs.map((wx) => ({ position: V3(wx + 0.3, WIN.sill + 1.4, Z0 - 1.8), color: new THREE.Color(0.72, 0.8, 1.0), strength: 0.7, radius: 0.18 }));

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'main',
      grade: ROOM_GRADE,
      environment: { position: [-0.9, 1.05, 2.0], intensity: 0.6 },
      onEnter() {
        if (!ctx.state.has('gameroom.greeted')) {
          ctx.state.set('gameroom.greeted', true);
          setTimeout(() => ctx.say({ text: 'Care for a game? I *insist*. Everyone who comes here ends up playing... *eventually*.', speaker: 'stauf', speakerName: 'Stauf' }), 1500);
        }
      },
      update() {},
      dispose() { const d = window.__debug; if (d) { delete d.gameroom; if (d.solvers) delete d.solvers.gameroom; if (d.states) delete d.states.gameroom; } },
    };
  },
};

/** bevelled rectangular top slab (XZ, y up) */
function slabTop(G, w, d, t = 0.04) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); s.lineTo(-w / 2, -d / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: t - 0.016, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2); g.translate(0, 0.008 - t / 2, 0);
  return G.applyBoxUVs(g, 1);
}
