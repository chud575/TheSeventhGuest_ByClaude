import * as THREE from 'three';
import { mergeStatic } from './merge.js';
import { boneGrain, ebonyGrain, laceTex, nightSky, tornDrape, quilt, linen, knightsBoard, crackedMirror, coals, dollFace, clockFace, cobweb } from './textures.js';
import {
  rbox, curtain, velvetCurtain, buildBed, buildChest, buildFireplace, buildVanity, buildStool, buildNightstand, buildOilLamp, buildDoll, buildDollShelf,
  buildRockingChair, buildWardrobe, buildAtticStair, buildWingChair, buildMantelClock, buildCandlestick, buildBook,
} from './furniture.js';
import { createKnightsPuzzle, knightsMeta, KNIGHTS_ID } from './puzzleKnights.js';

/**
 * The Bedroom — upper floor. A grim Victorian bedchamber that has not been aired
 * since the night of the party: a four-poster canopy bed whose hangings have rotted
 * into rags, a dressing table with a shattered mirror, a black-marble fireplace that
 * is somehow still burning, a shelf of watching bisque dolls — and at the foot of
 * the bed, a blanket chest with a chessboard carved into its lid where bone and
 * ebony knights wait to change sides (the Knights puzzle).
 *
 * Layout (metres, Y up): back wall (z = Z0) holds the arched moonlit window and the
 * doll shelf; the bed's headboard is against the left wall (x = X0); the fireplace
 * is on the right wall (x = X1); the door to the gallery and the wardrobe (which,
 * once the knights are solved, opens onto the attic stair) are on the front wall.
 */

const W = 6.4, D = 7.2, H = 3.75;
const X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
const DADO = 0.98;
const DOOR_DADO = 0.95;
const WIN = { x: 0.35, w: 1.3, sill: 0.68, h: 2.45, depth: 0.42 };
const DOOR = { x: 1.75, w: 1.05, h: 2.42 };
const BED = { z: -1.35, W: 1.78, L: 2.22 };            // headboard against the left wall
const FIRE = { z: -1.05 };
const CHEST = { x: X0 + 0.06 + BED.L + 0.48, z: BED.z };
const WARD = { x: -1.55 };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Settle a layer of dust on the upward-facing surfaces of a material (lighter, desaturated
 * albedo and rougher where the world normal points up). Patched into the standard shader.
 */
function addDust(mat, amount = 0.4, color = [0.33, 0.31, 0.29]) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uDustAmt = { value: amount };
    sh.uniforms.uDustCol = { value: new THREE.Color(...color) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vDustUp;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvDustUp = normalize(mat3(modelMatrix) * objectNormal).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDustUp;\nuniform float uDustAmt;\nuniform vec3 uDustCol;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float dustK = uDustAmt * smoothstep(0.35, 0.95, vDustUp);
        float dustL = dot(diffuseColor.rgb, vec3(0.333));
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(dustL), uDustCol, 0.7), dustK);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.95, uDustAmt * smoothstep(0.35, 0.95, vDustUp));');
  };
  mat.customProgramCacheKey = () => `dust${amount}`;
  return mat;
}
const ROOM_GRADE = { exposure: 2.0, contrast: 1.08, saturation: 0.98, bloomStrength: 0.38, bloomThreshold: 1.0, godRayWeight: 0.35, godRayThreshold: 2.5, vignette: 0.45, aoIntensity: 1.1, aoRadius: 0.4 };
const DOOR_EXPOSURE = 3.0;     // +0.6 EV on the door / wardrobe view
const PUZZLE_EXPOSURE = 1.45;

export default {
  id: 'bedroom',
  title: 'The Bedroom',
  floorName: 'Upper Floor',
  map: { floor: 'upper', rect: [150, 70, 210, 190] },
  start: 'main',
  ambience: { wind: 0.55, creaks: 0.55, clock: 0.45, thunder: 0.25, rain: 0.15, heartbeat: 0.05, roomTone: 0.35 },
  music: { key: 45, mood: 'dread' },
  puzzles: [knightsMeta],

  async build(ctx) {
    const { materials: M, geometry: G, fx } = ctx;
    const root = new THREE.Group();
    root.name = 'bedroom';
    const add = (o, parent = root) => { parent.add(o); return o; };
    const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
    const hiQ = ctx.quality.textureSize >= 2048;

    // ================================================================ materials
    const fromSet = (set, opts = {}, physical = false) => {
      const C = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
      return new C({ map: set.map, normalMap: set.normalMap, roughnessMap: set.ormMap, metalnessMap: set.ormMap, aoMap: set.ormMap, roughness: 1, metalness: 1, ...opts });
    };
    const drapeA = tornDrape(ctx, { seed: 1, color: [0.42, 0.07, 0.09] });
    const drapeB = tornDrape(ctx, { seed: 2, color: [0.36, 0.06, 0.08] });
    const quiltSet = quilt(ctx).withRepeat(2.5, 2.5);
    const linenSet = linen(ctx).withRepeat(1.6, 1.6);
    const boardSet = knightsBoard(ctx, { aspect: 1.21 / 0.61, board: 0.82 });
    const mirrorSet = crackedMirror(ctx, { aspect: 0.65 / 0.87 });
    const coalSet = coals(ctx).withRepeat(2, 2);
    const drapeMat = (set) => {
      const m = new THREE.MeshPhysicalMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.ormMap, roughness: 1, metalness: 0, alphaTest: 0.4, side: THREE.DoubleSide, sheen: 0.4, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.6, 0.35, 0.38), envMapIntensity: 0.3, name: 'drape' });
      addDust(m, 0.45);
      m.shadowSide = THREE.DoubleSide;
      return m;
    };
    const faceCache = new Map();
    const mats = {
      wall: M.create('damask', { repeat: [1.9, 1.9], base: [0.07, 0.09, 0.22], motif: [0.13, 0.16, 0.36], sheen: 0.5, variant: 0 }),
      floor: M.create('floorboards', { species: 'walnut', boards: 6, boardLength: 0.34, polish: 0.6, wear: 0.6, tint: [0.55, 0.45, 0.4], repeat: [1 / 3.0, 1 / 1.0] }),
      ceiling: M.create('plaster', { color: [0.2, 0.22, 0.3], cracks: 0.6, stains: 0.6, repeat: [0.45, 0.45] }),
      mahogany: M.create('mahogany', { repeat: [1.6, 1.6] }),
      canopyWood: M.create('mahogany', { repeat: [1.6, 1.6], clearcoat: 0.15, clearcoatRoughness: 0.5, envMapIntensity: 0.3 }),
      walnut: M.create('walnut', { repeat: [1.6, 1.6] }),
      panel: M.create('wood', { species: 'mahogany', boards: 0, polish: 0.65, repeat: [1.3, 1.3], clearcoat: 0.45, clearcoatRoughness: 0.3 }),
      ebonyWood: M.create('ebony', { repeat: [2, 2] }),
      crown: M.create('gilded', { pattern: 0, repeats: 4, wear: 0.55, dirt: 0.7, repeat: [1 / 0.5, 1] }),
      frieze: M.create('gilded', { pattern: 6, repeats: 3, ground: 1, groundColor: [0.03, 0.04, 0.09], wear: 0.4, dirt: 0.65, repeat: [1 / 0.75, 1] }),
      gilt: M.create('gold', { wear: 0.55, dirt: 0.6, repeat: [2, 1] }),
      giltFrame: M.create('gilded', { pattern: 1, repeats: 3, wear: 0.55, dirt: 0.7, repeat: [1 / 0.45, 1] }),
      marble: M.create('marble', { type: 'nero', polish: 0.8, repeat: [1.2, 1.2] }),
      marbleDark: M.create('marble', { type: 'nero', polish: 0.5, repeat: [2, 2], color: [0.6, 0.6, 0.6] }),
      brick: M.create('brick', { soot: 0.85, repeat: [2.5, 2.5] }),
      brass: M.create('brass', { tarnish: 0.45, polish: 0.6, repeat: [2, 2] }),
      iron: M.basic('iron', { color: 0x1a1918, roughness: 0.6 }),
      castIron: M.basic('iron', { color: 0x111010, roughness: 0.5, metalness: 0.85 }),
      black: M.basic('black'),
      soot: new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.95, metalness: 0 }),
      silver: M.basic('silver', { roughness: 0.3 }),
      porcelain: M.basic('porcelain'),
      crystal: M.basic('crystal'),
      crystalAmber: M.basic('crystal', { color: 0xd7a35a, opacity: 0.55 }),
      pearl: M.basic('porcelain', { color: 0xe8e0d0, roughness: 0.2 }),
      lace: M.basic('cloth', { color: 0xd8d0bc }),
      stocking: M.basic('cloth', { color: 0xcfc8b8 }),
      paper: new THREE.MeshStandardMaterial({ color: 0xc8b890, roughness: 0.9 }),
      log: new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.95, emissive: new THREE.Color(0.6, 0.15, 0.02), emissiveIntensity: 0.25 }),
      coals: new THREE.MeshStandardMaterial({ map: coalSet.map, normalMap: coalSet.normalMap, roughness: 0.9, emissive: new THREE.Color(1, 1, 1), emissiveMap: coalSet.map, emissiveIntensity: 1.6, name: 'coals' }),
      quilt: fromSet(quiltSet, { metalness: 0, side: THREE.DoubleSide, name: 'quilt' }, false),
      linen: fromSet(linenSet, { metalness: 0, name: 'linen' }),
      drapeA: drapeMat(drapeA), drapeB: drapeMat(drapeB),
      board: new THREE.MeshPhysicalMaterial({ map: boardSet.map, normalMap: boardSet.normalMap, roughnessMap: boardSet.ormMap, roughness: 1, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.25, name: 'board' }),
      mirror: new THREE.MeshPhysicalMaterial({ map: mirrorSet.map, normalMap: mirrorSet.normalMap, normalScale: new THREE.Vector2(1, 1), roughnessMap: mirrorSet.ormMap, metalnessMap: mirrorSet.ormMap, roughness: 1, metalness: 1, envMapIntensity: 1.0, color: new THREE.Color(0.75, 0.75, 0.78), name: 'mirror' }),
      lampGlobe: new THREE.MeshStandardMaterial({ color: 0x3a2a18, emissive: new THREE.Color(1.0, 0.62, 0.3), emissiveIntensity: 3.0, roughness: 0.4, transparent: true, opacity: 0.94, name: 'lampGlobe' }),
      velvetRose: M.create('velvet', { color: [0.3, 0.08, 0.1], crush: 0.5, repeat: [3, 3] }),
      velvetChair: M.create('velvet', { color: [0.06, 0.1, 0.22], crush: 0.6, repeat: [2.5, 2.5] }),
      curtain: M.create('velvet', { color: [0.055, 0.08, 0.21], crush: 0.85, repeat: [1.4, 1.4], side: THREE.DoubleSide, sheen: 0.45, sheenRoughness: 0.4, sheenColor: [0.3, 0.36, 0.6], envMapIntensity: 0.25 }),
      buttons: M.basic('black', { color: 0x0a0a12, roughness: 0.4 }),
      clockFace: new THREE.MeshStandardMaterial({ map: clockFace(ctx), roughness: 0.4 }),
      glass: new THREE.MeshBasicMaterial({ color: 0x0a1020, transparent: true, opacity: 0.18, depthWrite: false, name: 'winGlass' }),
      atticBoard: M.create('wood', { species: 'oak', boards: 3, boardLength: 1.2, polish: 0.1, wear: 0.9, tint: [0.55, 0.5, 0.46], repeat: [1, 1], side: THREE.DoubleSide, clearcoat: 0 }),
      atticBeam: M.create('wood', { species: 'oak', boards: 0, polish: 0.05, wear: 0.8, tint: [0.42, 0.36, 0.32], repeat: [1.5, 1.5], clearcoat: 0 }),
      atticPlaster: M.create('plaster', { color: [0.42, 0.42, 0.44], cracks: 0.8, stains: 0.8, repeat: [0.8, 0.8], side: THREE.DoubleSide }),
      rug: M.create('rug', { palette: 'faded', aspect: 3.0 / 4.0, knots: 220, wear: 0.65, fringe: 0.04, seed: 11, size: hiQ ? 2048 : 1536 }),
    };
    const clothCache = new Map();
    mats.dollCloth = (hex) => { if (!clothCache.has(hex)) clothCache.set(hex, M.basic('cloth', { color: new THREE.Color(hex), sheenColor: new THREE.Color(hex).lerp(new THREE.Color(1, 1, 1), 0.5) })); return clothCache.get(hex); };
    mats.dollHair = (hex) => { const k = `h${hex}`; if (!clothCache.has(k)) clothCache.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55 })); return clothCache.get(k); };
    const skin = new THREE.MeshPhysicalMaterial({ color: 0xead9c6, roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.22, sheen: 0.2, sheenColor: new THREE.Color(1, 0.85, 0.8) });
    const eyeCache = new Map();
    const eyeMat = (hex) => {
      if (!eyeCache.has(hex)) {
        const tex = ctx.textures.canvas(`bedroom:eye${hex}`, 256, 128, (g2, w, h) => {
          g2.fillStyle = '#efe9dc'; g2.fillRect(0, 0, w, h);
          const cx = w * 0.25, cy = h * 0.5;
          const gr = g2.createRadialGradient(cx, cy, 2, cx, cy, 22);
          gr.addColorStop(0, '#000'); gr.addColorStop(0.32, '#000'); gr.addColorStop(0.36, hex); gr.addColorStop(0.85, hex); gr.addColorStop(1, '#120c08');
          g2.fillStyle = gr; g2.beginPath(); g2.arc(cx, cy, 22, 0, 7); g2.fill();
          g2.strokeStyle = 'rgba(255,255,255,0.18)'; g2.lineWidth = 1;
          for (let k = 0; k < 24; k++) { const a = (k / 24) * 6.283; g2.beginPath(); g2.moveTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9); g2.lineTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20); g2.stroke(); }
        }, { tile: false });
        eyeCache.set(hex, new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 }));
      }
      return eyeCache.get(hex);
    };
    mats.dollFace = (o) => {
      const k = `${o.seed}${o.cracked}`;
      if (!faceCache.has(k)) faceCache.set(k, { mat: new THREE.MeshPhysicalMaterial({ map: dollFace(ctx, o), roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.22, sheen: 0.2, sheenColor: new THREE.Color(1, 0.85, 0.8) }), skin, glass: eyeMat(o.eyes || '#3a5a8a') });
      return faceCache.get(k);
    };
    const velCache = new Map();
    mats.dollVelvet = (hex) => {
      if (!velCache.has(hex)) {
        const c = new THREE.Color(hex);
        velCache.set(hex, M.create('velvet', { color: [c.r, c.g, c.b], crush: 0.7, repeat: [9, 9], sheen: 0.6, sheenRoughness: 0.5, sheenColor: [Math.min(1, c.r * 2 + 0.15), Math.min(1, c.g * 2 + 0.15), Math.min(1, c.b * 2 + 0.15)], envMapIntensity: 0.3 }));
      }
      return velCache.get(hex);
    };
    mats.laceFrill = new THREE.MeshPhysicalMaterial({ map: laceTex(ctx), color: 0xe4dccb, roughness: 0.85, alphaTest: 0.4, side: THREE.DoubleSide, sheen: 0.5, sheenColor: new THREE.Color(1, 1, 1), name: 'lace' });
    mats.laceFrill.map.repeat.set(1, 1);
    mats.dollSash = new THREE.MeshPhysicalMaterial({ color: 0x5a1820, roughness: 0.35, sheen: 0.8, sheenColor: new THREE.Color(0.9, 0.5, 0.55), name: 'sash' });
    mats.shoe = new THREE.MeshPhysicalMaterial({ color: 0x080606, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1, name: 'shoe' });
    const bookCache = new Map();
    mats.bookCover = (hex) => { if (!bookCache.has(hex)) bookCache.set(hex, M.create('leather', { color: new THREE.Color(hex).multiplyScalar(2.2), wear: 0.6, repeat: [4, 4] })); return bookCache.get(hex); };

    // ================================================================ shell
    {
      const floor = new THREE.Mesh(G.planeUV(W, D, 1), mats.floor); floor.rotation.x = -Math.PI / 2; floor.name = 'floor'; add(floor);
      const ceil = new THREE.Mesh(G.planeUV(W, D, 1), mats.ceiling); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; ceil.name = 'ceiling'; add(ceil);
      // back wall with the arched window
      const back = new THREE.Mesh(G.wallWithOpenings(W, H, [{ x: W / 2 + WIN.x - WIN.w / 2, y: WIN.sill, w: WIN.w, h: WIN.h, arch: true }], { uvScale: 1 }), mats.wall);
      back.position.set(X0, 0, Z0); add(back);
      const left = new THREE.Mesh(G.planeUV(D, H, 1), mats.wall); left.rotation.y = Math.PI / 2; left.position.set(X0, H / 2, 0); add(left);
      const right = new THREE.Mesh(G.planeUV(D, H, 1), mats.wall); right.rotation.y = -Math.PI / 2; right.position.set(X1, H / 2, 0); add(right);
      const front = new THREE.Mesh(G.wallWithOpenings(W, H, [
        { x: W / 2 - DOOR.x - DOOR.w / 2, y: 0.0005, w: DOOR.w, h: DOOR.h },     // (a hole must stay inside the outline or earcut fills it)
        { x: X1 - (WARD.x + 0.59), y: 0.15, w: 1.18, h: 2.02 },                  // hidden stair, behind the wardrobe
      ], { uvScale: 1 }), mats.wall);
      front.rotation.y = Math.PI; front.position.set(X1, 0, Z1); front.name = 'frontWall'; add(front);
      // dark landing beyond the door
      const land = new THREE.Mesh(G.planeUV(DOOR.w + 1.4, DOOR.h + 0.3, 1), mats.wall); land.rotation.y = Math.PI; land.position.set(DOOR.x, DOOR.h / 2, Z1 + 1.1); add(land);
      // the gallery's gaslight beyond the half-open door
      const hall = new THREE.PointLight(0xffa860, 3, 7, 2); hall.position.set(DOOR.x + 0.12, 1.98, Z1 + 0.95); add(hall);
      // the gas sconce on the gallery wall that the light comes from
      const hs = new THREE.Group();
      hs.add(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.055, 0], [0.045, 0.02], [0, 0.03]], 20).rotateX(-Math.PI / 2), mats.brass));
      const harm = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 8, 20, Math.PI / 2), mats.brass); harm.position.set(0, -0.09, 0); harm.rotation.y = Math.PI / 2; hs.add(harm);
      const hsh = new THREE.Mesh(G.latheFromProfile([[0.02, 0], [0.05, 0.03], [0.06, 0.08], [0.045, 0.13], [0.028, 0.14]], 20), mats.lampGlobe); hsh.position.set(0, 0.0, -0.09); hsh.userData.noShadow = true; hs.add(hsh);
      hs.position.set(DOOR.x + 0.12, 1.9, Z1 + 1.09); add(hs);
      // landing side walls, ceiling, skirting and a dado rail, a picture in shadow
      for (const sx of [-1, 1]) {
        const sw = new THREE.Mesh(G.planeUV(1.15, DOOR.h + 0.3, 1), mats.wall); sw.rotation.y = -sx * Math.PI / 2; sw.position.set(DOOR.x + sx * 1.22, (DOOR.h + 0.3) / 2, Z1 + 0.55); add(sw);
      }
      const lc = new THREE.Mesh(G.planeUV(DOOR.w + 1.4, 1.2, 1), mats.ceiling); lc.rotation.x = Math.PI / 2; lc.position.set(DOOR.x, DOOR.h + 0.3, Z1 + 0.55); add(lc);
      const lsk = new THREE.Mesh(G.boxUV(DOOR.w + 1.4, 0.2, 0.025, 1), mats.panel); lsk.position.set(DOOR.x, 0.1, Z1 + 1.085); add(lsk);
      const ldr = new THREE.Mesh(G.boxUV(DOOR.w + 1.4, 0.05, 0.03, 1), mats.panel); ldr.position.set(DOOR.x, DOOR_DADO, Z1 + 1.08); add(ldr);
      const lpic = new THREE.Group();
      lpic.add(new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.44), M.create('painting', { subject: 0, seed: 23, aspect: 0.34 / 0.44, size: 512, cracks: 0.5 })));
      lpic.add(new THREE.Mesh(G.frameGeometry(0.34, 0.44, { width: 0.05, depth: 0.03, uvScale: 1 }), mats.giltFrame));
      lpic.position.set(DOOR.x - 0.42, 1.55, Z1 + 1.085); lpic.rotation.y = Math.PI; add(lpic);
      const hfl = new THREE.Mesh(G.planeUV(DOOR.w + 1.4, 1.2, 1), mats.floor); hfl.rotation.x = -Math.PI / 2; hfl.position.set(DOOR.x, 0.001, Z1 + 0.55); add(hfl);
    }

    // window reveal, sill, sash, sky
    {
      const r = WIN.w / 2;
      const shape = new THREE.Shape();
      shape.moveTo(-r - 0.02, -0.02); shape.lineTo(r + 0.02, -0.02); shape.lineTo(r + 0.02, WIN.h + 0.04); shape.lineTo(-r - 0.02, WIN.h + 0.04);
      const hole = new THREE.Path();
      hole.moveTo(-r, 0); hole.lineTo(-r, WIN.h - r); hole.absarc(0, WIN.h - r, r, Math.PI, 0, true); hole.lineTo(r, 0); hole.lineTo(-r, 0);
      shape.holes.push(hole);
      const rg = new THREE.ExtrudeGeometry(shape, { depth: WIN.depth, bevelEnabled: false, curveSegments: 32 });
      const reveal = new THREE.Mesh(G.applyBoxUVs(rg, 1), mats.wall); reveal.position.set(WIN.x, WIN.sill, Z0 - WIN.depth); add(reveal);
      const sill = new THREE.Mesh(rbox(G, WIN.w + 0.26, 0.05, WIN.depth + 0.14, 0.01), mats.marble); sill.position.set(WIN.x, WIN.sill - 0.025, Z0 - WIN.depth / 2 + 0.07); add(sill);
      // window casing (architrave) on the room face
      const cas = G.sweepProfile(G.PROFILES.chairRail(0.1, 0.03), (() => {
        const p = [V3(-r - 0.05, 0, 0), V3(-r - 0.05, WIN.h - r, 0)];
        for (let i = 1; i < 16; i++) { const a = Math.PI - (i / 16) * Math.PI; p.push(V3(Math.cos(a) * (r + 0.05), WIN.h - r + Math.sin(a) * (r + 0.05), 0)); }
        p.push(V3(r + 0.05, WIN.h - r, 0), V3(r + 0.05, 0, 0));
        return p;
      })(), { up: V3(0, 0, 1), uvScale: 1, flipOutward: true });
      const casing = new THREE.Mesh(cas, mats.panel); casing.position.set(WIN.x, WIN.sill, Z0 + 0.002); add(casing);
      // sash frame + glazing bars
      const wg = new THREE.Group(); wg.position.set(WIN.x, WIN.sill, Z0 - WIN.depth * 0.6);
      const fm = new THREE.MeshStandardMaterial({ color: 0x0b0908, roughness: 0.6 });
      const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), fm); m.position.set(x, y, 0); wg.add(m); };
      bar(WIN.w, 0.07, 0, 0.035);
      bar(0.045, WIN.h - r, 0, (WIN.h - r) / 2);
      for (const x of [-r + 0.02, r - 0.02]) bar(0.04, WIN.h - r, x, (WIN.h - r) / 2);
      for (const y of [0.62, 1.22, WIN.h - r]) bar(WIN.w, y === WIN.h - r ? 0.05 : 0.035, 0, y);
      for (const x of [-r / 2, r / 2]) bar(0.025, WIN.h - r, x, (WIN.h - r) / 2);
      for (let i = 1; i < 5; i++) { const a = Math.PI * (i / 5); const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, r, 0.04), fm); m.position.set(Math.cos(a) * r * 0.5, WIN.h - r + Math.sin(a) * r * 0.5, 0); m.rotation.z = a - Math.PI / 2; wg.add(m); }
      const arc = new THREE.Mesh(new THREE.TorusGeometry(r - 0.02, 0.022, 6, 40, Math.PI), fm); arc.position.set(0, WIN.h - r, 0); wg.add(arc);
      // a cracked pane: one glass piece missing (dark shards) handled in the sky by a chip; glass itself
      const gs = new THREE.Shape(); gs.moveTo(-r, 0); gs.lineTo(-r, WIN.h - r); gs.absarc(0, WIN.h - r, r, Math.PI, 0, true); gs.lineTo(r, 0); gs.lineTo(-r, 0);
      const glass = new THREE.Mesh(new THREE.ShapeGeometry(gs, 32), mats.glass); glass.position.z = 0.012; glass.userData.noShadow = true; wg.add(glass);
      add(wg);
      const skyTex = nightSky(ctx);
      const skyMat = new THREE.MeshBasicMaterial({ map: skyTex.map, color: new THREE.Color(1, 1, 1).multiplyScalar(3.2), toneMapped: false, name: 'sky' });
      const sky = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 5.5), skyMat); sky.position.set(WIN.x - 0.4, WIN.sill + 1.1, Z0 - 2.6); sky.userData.noShadow = true; add(sky);
      // heavy velvet curtains, gathered into tasselled tie-backs, pooling on the boards
      const top = WIN.sill + WIN.h + 0.32;
      for (const side of [-1, 1]) {
        const cw = 1.0;
        const cg = velvetCurtain({ width: cw, height: top, folds: 9, depth: 0.075, tieback: 0.78, tiebackV: 0.6, waist: 0.2, flare: 0.8, pool: 0.2, seed: side + 7 });
        const c = new THREE.Mesh(cg, mats.curtain);
        // outer edge sits beside the casing; the inner edge reaches over the glass
        c.position.set(WIN.x + side * (WIN.w / 2 + 0.42), top, Z0 + 0.14);
        c.scale.x = -side;
        c.name = 'cloth'; add(c);
        // tie-back: a twisted gilt cord round the waist with a hanging tassel
        const wi = cg.userData.waist;
        const cord = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 32), mats.gilt);
        cord.scale.set(wi.w * 0.55, 0.06, 0.1); cord.rotation.x = Math.PI / 2;
        cord.position.set(c.position.x - side * wi.x, top + wi.y, Z0 + 0.15); add(cord);
        const tassel = new THREE.Mesh(G.latheFromProfile([[0, 0.12], [0.018, 0.11], [0.022, 0.085], [0.014, 0.07], [0.03, 0.05], [0.038, 0.0], [0, -0.005]], 16), mats.gilt);
        tassel.position.set(c.position.x - side * (wi.x + wi.w * 0.45), top + wi.y - 0.2, Z0 + 0.22); add(tassel);
        const hook = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.04, 0], [0.035, 0.02], [0.015, 0.03], [0, 0.05]], 16).rotateX(Math.PI / 2), mats.brass);
        hook.position.set(c.position.x - side * 0.02, top + wi.y, Z0 + 0.005); add(hook);
      }
      // swagged valance across the top
      const val = new THREE.Mesh(curtain(G, { width: WIN.w + 1.25, height: 0.45, folds: 12, depth: 0.05, gather: 1, seed: 19 }), mats.curtain);
      val.position.set(WIN.x, WIN.sill + WIN.h + 0.4, Z0 + 0.17); val.name = 'cloth'; add(val);
      const pel = new THREE.Mesh(rbox(G, WIN.w + 1.4, 0.09, 0.14, 0.01), mats.gilt); pel.position.set(WIN.x, WIN.sill + WIN.h + 0.44, Z0 + 0.1); add(pel);
    }

    // ================================================================ mouldings + wainscot
    {
      const crownH = 0.26, friezeH = 0.2;
      const loop = (y) => [V3(X0, y, Z0), V3(X1, y, Z0), V3(X1, y, Z1), V3(X0, y, Z1)];
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(crownH, 0.2), loop(H - crownH), { closed: true, uvScale: 1 }), mats.crown));
      add(new THREE.Mesh(G.sweepProfile([new THREE.Vector2(0.004, 0), new THREE.Vector2(0.004, friezeH)], loop(H - crownH - friezeH), { closed: true, uvScale: 1 }), mats.frieze));
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.035, 0.02), loop(H - crownH - friezeH - 0.035), { closed: true, uvScale: 2 }), mats.gilt));
      // chair rail + baseboard: open path from the door's right jamb round to its left jamb
      const dl = DOOR.x + DOOR.w / 2 + 0.11, dr = DOOR.x - DOOR.w / 2 - 0.11;
      const wl = WARD.x - 0.7, wr = WARD.x + 0.7;      // the wardrobe hides the wall (and the stair hole) between these
      const path = (y) => [V3(wl, y, Z1), V3(X0, y, Z1), V3(X0, y, Z0), V3(X1, y, Z0), V3(X1, y, Z1), V3(dl, y, Z1)];
      const path2 = (y) => [V3(dr, y, Z1), V3(wr, y, Z1)];
      for (const pth of [path, path2]) {
        add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.075, 0.035), pth(DADO - 0.05), { uvScale: 1 }), mats.panel));
        add(new THREE.Mesh(G.sweepProfile(G.PROFILES.baseboard(0.24, 0.03), pth(0), { uvScale: 1 }), mats.panel));
      }
      // wainscot backing + raised panels
      const panelGeo = G.raisedPanel(0.6, 0.58, { border: 0.07, bevel: 0.03 });
      const run = (x0, z0, x1, z1, skip = []) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const dir = V3((x1 - x0) / len, 0, (z1 - z0) / len);
        const nrm = V3(-dir.z, 0, dir.x);               // into the room for CCW runs
        const rotY = Math.atan2(dir.x, dir.z) - Math.PI / 2;
        const back = new THREE.Mesh(G.boxUV(len, DADO - 0.05, 0.02, 1), mats.panel);
        back.position.set((x0 + x1) / 2 + nrm.x * 0.01, (DADO - 0.05) / 2, (z0 + z1) / 2 + nrm.z * 0.01); back.rotation.y = rotY; add(back);
        const n = Math.max(1, Math.round(len / 0.75));
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
          if (skip.some(([a, b]) => { const s = dir.x !== 0 ? px : pz; return s > a && s < b; })) continue;
          const p = new THREE.Mesh(panelGeo, mats.panel);
          p.position.set(px + nrm.x * 0.02, 0.52, pz + nrm.z * 0.02); p.rotation.y = rotY;
          p.scale.set((len / n - 0.1) / 0.6, 1, 1); add(p);
        }
      };
      run(X0, Z1, X0, Z0);                         // left wall (front -> back)
      run(X0, Z0, X1, Z0, [[WIN.x - 0.5, WIN.x + 0.5]]);
      run(X1, Z0, X1, Z1, [[FIRE.z - 1.0, FIRE.z + 1.0]]);
      run(X1, Z1, dl, Z1); run(dr, Z1, wr, Z1); run(wl, Z1, X0, Z1);
      // ceiling rose + bare gas pendant
      const rose = new THREE.Mesh(G.latheFromProfile([[0.0, 0], [0.5, 0], [0.5, -0.02], [0.44, -0.035], [0.36, -0.03], [0.26, -0.055], [0.14, -0.065], [0.06, -0.1], [0.0, -0.11]], 48), mats.gilt);
      rose.position.set(0, H, 0); add(rose);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 10), mats.brass); stem.position.set(0, H - 0.45, 0); add(stem);
      const hub = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0.02], [0.08, 0.06], [0.05, 0.1], [0.02, 0.12], [0, 0.12]], 24), mats.brass); hub.position.set(0, H - 0.92, 0); add(hub);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const arm = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.009, 8, 20, Math.PI * 0.6), mats.brass);
        arm.position.set(Math.cos(a) * 0.16, H - 0.86, Math.sin(a) * 0.16); arm.rotation.set(0, -a, Math.PI * 1.2); add(arm);
        const shade = new THREE.Mesh(G.latheFromProfile([[0.02, 0], [0.05, 0.03], [0.06, 0.08], [0.045, 0.12]], 18), mats.glass);
        shade.position.set(Math.cos(a) * 0.3, H - 0.92, Math.sin(a) * 0.3); shade.userData.noShadow = true; add(shade);
      }
    }

    // ================================================================ door (front wall) + casing; the leaf stands ajar
    {
      const door = new THREE.Group();
      const hinge = new THREE.Group(); hinge.position.set(-DOOR.w / 2, 0, 0); hinge.rotation.y = -1.1; door.add(hinge);
      const leafG = new THREE.Group(); leafG.position.x = DOOR.w / 2; hinge.add(leafG);
      const leaf = new THREE.Mesh(G.boxUV(DOOR.w, DOOR.h, 0.05, 1), mats.panel); leaf.position.y = DOOR.h / 2; leafG.add(leaf);
      for (const [y, hgt] of [[0.6, 0.86], [1.7, 1.0]]) for (const x of [-0.24, 0.24]) {
        const p = new THREE.Mesh(G.raisedPanel(0.4, hgt, { border: 0.05 }), mats.panel); p.position.set(x, y, 0.025); leafG.add(p);
      }
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), mats.brass); knob.position.set(0.42, 1.0, 0.065); leafG.add(knob);
      const plate = new THREE.Mesh(rbox(G, 0.05, 0.18, 0.01, 0.004), mats.brass); plate.position.set(0.42, 1.0, 0.03); leafG.add(plate);
      const casing = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.11, 0.035), [V3(-DOOR.w / 2 - 0.06, 0, 0), V3(-DOOR.w / 2 - 0.06, DOOR.h + 0.06, 0), V3(DOOR.w / 2 + 0.06, DOOR.h + 0.06, 0), V3(DOOR.w / 2 + 0.06, 0, 0)], { up: V3(0, 0, 1), uvScale: 1, flipOutward: true }), mats.panel);
      door.add(casing);
      const ped = new THREE.Mesh(rbox(G, DOOR.w + 0.4, 0.08, 0.1, 0.01), mats.panel); ped.position.set(0, DOOR.h + 0.2, 0.03); door.add(ped);
      door.position.set(DOOR.x, 0, Z1 - 0.03); door.rotation.y = Math.PI; add(door);
    }

    // ================================================================ rug
    {
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.0), mats.rug); rug.rotation.x = -Math.PI / 2; rug.rotation.z = Math.PI / 2;
      rug.position.set(-0.85, 0.006, BED.z + 0.1); rug.name = 'rug'; add(rug);
    }

    // ================================================================ bed (headboard on the left wall)
    const bed = buildBed(ctx, mats, { W: BED.W, L: BED.L, postH: 2.5 });
    bed.position.set(X0 + 0.06 + BED.L / 2, 0, BED.z); bed.rotation.y = Math.PI / 2; add(bed);
    // a doll left sitting against the pillows
    {
      const d = buildDoll(ctx, mats, { size: 0.36, seed: 9, dress: 0xcfc4b0, hair: 0x6a4a20, eyes: '#2a3a5a', bonnet: true, tilt: 0.18, pose: 'limp' });
      d.position.set(X0 + 0.62, 0.86, BED.z + 0.25); d.rotation.y = Math.PI / 2 + 0.2; d.rotation.x = -0.15; add(d);
    }

    // nightstands + lamp + candle
    let lampLight, standCandle;
    {
      const nsA = buildNightstand(ctx, mats); nsA.position.set(X0 + 0.3, 0, BED.z - BED.W / 2 - 0.36); nsA.rotation.y = Math.PI / 2; add(nsA);
      const nsB = buildNightstand(ctx, mats); nsB.position.set(X0 + 0.3, 0, BED.z + BED.W / 2 + 0.36); nsB.rotation.y = Math.PI / 2; add(nsB);
      const lamp = buildOilLamp(ctx, mats); lamp.position.set(X0 + 0.3, 0.715, BED.z + BED.W / 2 + 0.36); add(lamp);
      lampLight = new THREE.PointLight(0xffa65a, 3.2, 7, 2); lampLight.position.set(X0 + 0.3, 0.715 + 0.38, BED.z + BED.W / 2 + 0.36); add(lampLight);
      const bk = buildBook(G, mats, { color: 0x3a1410 }); bk.position.set(X0 + 0.34, 0.715, BED.z + BED.W / 2 + 0.2); bk.rotation.y = 0.3; add(bk);
      const cs = buildCandlestick(ctx, mats, { h: 0.2 }); cs.position.set(X0 + 0.32, 0.715, BED.z - BED.W / 2 - 0.38); add(cs);
      standCandle = fx.candle({ height: 0.09, radius: 0.012, light: true, lightIntensity: 1.4, lightDistance: 4, seed: 23, burn: 0.9 });
      standCandle.position.set(X0 + 0.32, 0.715 + 0.2, BED.z - BED.W / 2 - 0.38); add(standCandle);
      const bk2 = buildBook(G, mats, { color: 0x14202a, t: 0.05 }); bk2.position.set(X0 + 0.25, 0.715, BED.z - BED.W / 2 - 0.25); bk2.rotation.y = -0.4; add(bk2);
    }

    // ================================================================ chest + knights puzzle
    const chest = buildChest(ctx, mats, { w: 1.18, d: 0.58 });
    chest.position.set(CHEST.x, 0, CHEST.z); chest.rotation.y = Math.PI / 2; add(chest);
    const boardField = 0.82 * 0.61 * (5 / 6);     // field size in metres (matches the board texture)
    const puzzleCam = { position: [CHEST.x + 0.74, 1.2, CHEST.z], target: [CHEST.x + 0.02, 0.5, CHEST.z], fov: 40 };
    const boneSet = boneGrain(ctx).withRepeat(3, 3);
    const ebonySet = ebonyGrain(ctx).withRepeat(3, 3);
    const wardrobe = buildWardrobe(ctx, mats);
    const knights = createKnightsPuzzle(ctx, {
      parent: chest, center: V3(0, chest.userData.boardTop, 0), size: boardField,
      mats: {
        bone: new THREE.MeshPhysicalMaterial({ color: 0xe6dac2, map: boneSet.map, roughness: 1, roughnessMap: boneSet.ormMap, normalMap: boneSet.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), clearcoat: 0.4, clearcoatRoughness: 0.3, sheen: 0.3, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.9, 0.86, 0.78), envMapIntensity: 0.8, name: 'bone' }),
        ebony: new THREE.MeshPhysicalMaterial({ color: 0x0e0a08, map: ebonySet.map, roughness: 0.22, normalMap: ebonySet.normalMap, normalScale: new THREE.Vector2(0.25, 0.25), clearcoat: 0.9, clearcoatRoughness: 0.15, envMapIntensity: 1.2, name: 'ebonyPiece' }),
      },
      camera: puzzleCam,
      onSolved: async () => { openWardrobe(false); },
    });

    // ================================================================ fireplace (right wall)
    const fire = buildFireplace(ctx, mats, { H });
    fire.position.set(X1, 0, FIRE.z); fire.rotation.y = -Math.PI / 2; add(fire);
    const fireLight = new THREE.PointLight(0xff7a32, 7, 9, 2);
    fireLight.position.set(X1 - 0.75, 0.45, FIRE.z);
    fireLight.castShadow = ctx.quality.shadows;
    fireLight.shadow.mapSize.set(512, 512); fireLight.shadow.bias = -0.004; fireLight.shadow.normalBias = 0.03; fireLight.shadow.radius = 5; fireLight.shadow.camera.near = 0.1;
    add(fireLight);
    {
      const my = fire.userData.mantelY;
      const clock = buildMantelClock(ctx, mats); clock.position.set(X1 - 0.6, my, FIRE.z); clock.rotation.y = -Math.PI / 2; add(clock);
      for (const s of [-1, 1]) {
        const cs = buildCandlestick(ctx, mats, { h: 0.3 }); cs.position.set(X1 - 0.6, my, FIRE.z + s * 0.55); add(cs);
        const c = fx.candle({ height: s > 0 ? 0.16 : 0.07, radius: 0.012, lit: s > 0, light: false, seed: 40 + s, burn: 0.9 });
        c.position.set(X1 - 0.6, my + 0.3, FIRE.z + s * 0.55); add(c);
      }
      // over-mantel portrait: a child
      const pw = 0.62, ph = 0.8;
      const pg = new THREE.Group();
      pg.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), M.create('painting', { subject: 1, seed: 31, aspect: pw / ph, size: 1024, cracks: 0.6 })));
      pg.add(new THREE.Mesh(G.frameGeometry(pw, ph, { width: 0.1, depth: 0.06, uvScale: 1 }), mats.giltFrame));
      pg.position.set(X1 - 0.44, my + 0.95, FIRE.z); pg.rotation.y = -Math.PI / 2; add(pg);
    }
    // wing chair before the fire
    {
      const wc = buildWingChair(ctx, mats); wc.position.set(2.25, 0, FIRE.z + 1.75); wc.rotation.y = Math.PI - 0.55; add(wc);
    }

    // ================================================================ doll shelf (back wall, right) + rocking chair
    const dollGroup = new THREE.Group(); dollGroup.name = 'dolls'; add(dollGroup);
    {
      const shelf = buildDollShelf(ctx, mats, { w: 1.12, levels: [1.2, 1.63, 2.06] });
      shelf.position.set(2.15, 0, Z0); add(shelf);
      // [shelfY, x, opts, extra]  — deliberately uneven: heights differ, one has toppled onto
      // her side, one has turned her head to watch the room, one place is empty (a clean
      // ring in the dust shows where she sat)
      const specs = [
        [1.2, -0.38, { size: 0.3, dress: 0x5a1a26, hair: 0x2a1408, seed: 1, pose: 'lap' }],
        [1.2, -0.02, { size: 0.36, dress: 0x1e2a48, hair: 0x8a6a30, seed: 2, cracked: true, bonnet: true, pose: 'reach', headYaw: 0.5, tilt: 0.12 }],
        [1.2, 0.36, { size: 0.28, dress: 0xb8ac98, hair: 0x1a0c06, seed: 3, pose: 'limp', tilt: 0.35 }],
        [1.63, -0.34, { size: 0.33, dress: 0x161518, hair: 0x5a3a1a, seed: 4, eyes: '#5a3a20', pose: 'lap', headYaw: -0.55 }],
        [1.63, 0.3, { size: 0.31, dress: 0x6a4a62, hair: 0x3a2010, seed: 5, bonnet: true, tilt: -0.3, pose: 'lap' }, { toppled: true }],
        [2.06, -0.36, { size: 0.35, dress: 0x7a5a3a, hair: 0x2a1a0c, seed: 6, pose: 'reach' }],
        [2.06, 0.34, { size: 0.29, dress: 0x4a1414, hair: 0x1a0c06, seed: 8, tilt: 0.25, pose: 'limp', headYaw: 0.25 }],
      ];
      for (const [y, x, o, extra] of specs) {
        const d = buildDoll(ctx, mats, o);
        d.position.set(2.15 + x, y, Z0 + 0.1); d.rotation.y = (o.seed * 0.37) % 0.5 - 0.25;
        if (extra?.toppled) { d.rotation.set(0, -0.3, -1.45); d.position.set(2.15 + x - 0.02, y + 0.065, Z0 + 0.11); }
        dollGroup.add(d);
      }
      // the empty place on the top shelf: a ring of clean wood in the dust
      const ringG = new THREE.RingGeometry(0.075, 0.13, 40).rotateX(-Math.PI / 2);
      const dustRing = new THREE.Mesh(ringG, new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 1, transparent: true, opacity: 0.4, depthWrite: false, name: 'dust' }));
      dustRing.scale.set(1, 1, 0.75); dustRing.position.set(2.15, 2.06 + 0.002, Z0 + 0.11); dustRing.renderOrder = 2; add(dustRing);
      const dustFilm = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.18).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x77726c, roughness: 1, transparent: true, opacity: 0.22, depthWrite: false, name: 'dustFilm' }));
      for (const yy of [1.2, 1.63]) { const f = dustFilm.clone(); f.position.set(2.15, yy + 0.0015, Z0 + 0.11); f.renderOrder = 1; add(f); }
      // a vigil candle on the middle shelf
      const vc = buildCandlestick(ctx, mats, { h: 0.12 }); vc.position.set(2.15 - 0.04, 1.63, Z0 + 0.12); add(vc);
      const vcan = fx.candle({ height: 0.08, radius: 0.013, light: true, lightIntensity: 1.1, lightDistance: 3.5, seed: 91, burn: 0.95 });
      vcan.position.set(2.15 - 0.04, 1.63 + 0.12, Z0 + 0.12); add(vcan);
      const rc = buildRockingChair(ctx, mats); rc.position.set(2.45, 0, Z0 + 0.75); rc.rotation.y = -0.55; add(rc);
      const big = buildDoll(ctx, mats, { size: 0.62, seed: 12, dress: 0x6e5a72, hair: 0xb08a50, eyes: '#4a6a9a', bonnet: true, tilt: -0.28, headYaw: 0.35, pose: 'lap' });
      big.position.set(0, 0.42, 0.0); rc.add(big);
    }

    // ================================================================ vanity (left wall, front)
    let vanity;
    {
      vanity = buildVanity(ctx, mats);
      vanity.position.set(X0 + 0.02, 0, 1.75); vanity.rotation.y = Math.PI / 2; add(vanity);
      const st = buildStool(ctx, mats); st.position.set(X0 + 0.85, 0, 1.75); st.rotation.y = Math.PI / 2 + 0.25; add(st);
      const vl = new THREE.PointLight(0xffa04a, 1.6, 5, 2); vl.position.set(X0 + 0.55, 1.12, 1.75 - 0.75); add(vl);
      vanity.userData.light = vl;
    }

    // ================================================================ wardrobe (front wall, left) -> attic once the knights are solved
    wardrobe.position.set(WARD.x, 0, Z1); wardrobe.rotation.y = Math.PI; add(wardrobe);
    const stair = buildAtticStair(ctx, mats, { w: 1.18, y0: 0.16 });
    stair.position.set(WARD.x, 0, Z1); stair.rotation.y = Math.PI; add(stair);
    const stairLights = [stair.userData.light, stair.userData.fill];
    for (const l of stairLights) l.visible = false;
    // the cold shaft from the attic skylight, with dust hanging in it (shown once the stair is revealed)
    {
      const su = stair.userData;
      const sc = V3(WARD.x - 0.28, su.roofY + 0.6, Z1 - (su.endZ - 0.15));
      const sd = new THREE.Vector3(WARD.x, 0.2, Z1 + 0.2).sub(sc).normalize();
      const stairShaft = fx.shaft({ center: sc, right: V3(0.2, 0, 0), up: V3(0, 0.12, 0.25), direction: sd, length: 4.6, color: 0x9fb4ff, intensity: 0.55, softness: 0.4, falloff: 0.8, panes: [1, 2], mullion: 0.02, noise: 0.8 });
      stairShaft.visible = false; stairShaft.userData.keep = true; root.add(stairShaft);
      const stairDust = fx.dust({ box: new THREE.Box3(V3(WARD.x - 0.55, 0.2, Z1 + 0.05), V3(WARD.x + 0.55, 3.2, Z1 + 2.9)), count: 700, shafts: [stairShaft], size: 0.009, intensity: 2.0, ambient: 0.25 });
      stairDust.visible = false; stairDust.userData.keep = true; root.add(stairDust);
      stairLights.push(stairShaft, stairDust);
    }
    let wardrobeOpen = false;
    function openWardrobe(instant) {
      wardrobeOpen = true;
      wardrobe.userData.back.visible = false;
      for (const l of stairLights) l.visible = true;
      const [l, r] = wardrobe.userData.doors;
      if (instant) { l.rotation.y = -1.6; r.rotation.y = 1.6; return; }
      const t0 = performance.now();
      ctx.audio.sfx?.('door');
      const step = () => { const k = Math.min(1, (performance.now() - t0) / 2200); const e = 1 - (1 - k) ** 3; l.rotation.y = -1.6 * e; r.rotation.y = 1.6 * e; if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }

    // a small portrait between the bed canopy and the window
    {
      const pw = 0.46, ph = 0.6;
      const pg = new THREE.Group();
      pg.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), M.create('painting', { subject: 1, seed: 17, aspect: pw / ph, size: 1024, cracks: 0.7 })));
      pg.add(new THREE.Mesh(G.frameGeometry(pw, ph, { width: 0.08, depth: 0.05, uvScale: 1 }), mats.giltFrame));
      pg.position.set(-0.75, 2.05, Z0 + 0.03); add(pg);
      const ls = new THREE.Mesh(G.frameGeometry(0.5, 0.36, { width: 0.06, depth: 0.04, uvScale: 1 }), mats.giltFrame);
      ls.position.set(X1 - 0.03, 1.85, 2.4); ls.rotation.y = -Math.PI / 2; add(ls);
      const lsC = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), M.create('painting', { subject: 2, seed: 4, aspect: 0.5 / 0.36, size: 512 }));
      lsC.position.set(X1 - 0.025, 1.85, 2.4); lsC.rotation.y = -Math.PI / 2; add(lsC);
    }

    // ================================================================ dressing: cobwebs, sconce, small props
    {
      const webMat = (seed) => new THREE.MeshStandardMaterial({ map: cobweb(ctx, { seed }), transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0xb8bcc8, roughness: 1, metalness: 0, name: 'cobweb' });
      const web = (parent, size, pos, rotY, flipX, seed) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), webMat(seed));
        m.geometry.translate(size / 2, -size / 2, 0);           // anchor = top-left corner
        m.position.copy(pos); m.rotation.y = rotY; if (flipX) m.scale.x = -1;
        m.userData.noShadow = true; m.renderOrder = 3; parent.add(m); return m;
      };
      const bw = BED.W / 2, bl = BED.L / 2, ty = bed.userData.postH;
      // canopy: between the foot posts and the side rails
      web(bed, 0.55, V3(bw + 0.05, ty - 0.02, bl - 0.03), Math.PI / 2, false, 1);
      web(bed, 0.45, V3(-bw - 0.05, ty - 0.02, bl - 0.03), -Math.PI / 2, true, 2);
      web(bed, 0.5, V3(bw - 0.03, ty - 0.02, bl + 0.05), 0, true, 3);
      // room corners near the ceiling
      web(root, 0.9, V3(X1 - 0.64, H - 0.46, Z0 + 0.01), Math.PI * 0.25, true, 4);
      web(root, 0.8, V3(X0 + 0.01, H - 0.46, Z0 + 0.57), Math.PI * 0.25, false, 5);
      // brass gas sconce between window and doll shelf (lit, warm)
      const sc = new THREE.Group();
      sc.add(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0], [0.05, 0.02], [0, 0.03]], 24).rotateX(Math.PI / 2), mats.brass));
      const arm = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 24, Math.PI / 2), mats.brass); arm.position.set(0, -0.1, 0); arm.rotation.y = -Math.PI / 2; sc.add(arm);
      const cup = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.025, 0.0], [0.03, 0.02], [0, 0.02]], 16), mats.brass); cup.position.set(0, 0.0, 0.1); sc.add(cup);
      const shade = new THREE.Mesh(G.latheFromProfile([[0.025, 0], [0.055, 0.03], [0.065, 0.08], [0.05, 0.14], [0.03, 0.15]], 24), mats.lampGlobe); shade.position.set(0, 0.02, 0.1); shade.userData.noShadow = true; sc.add(shade);
      sc.position.set(2.15, 2.62, Z0 + 0.01); add(sc);
      const scl = new THREE.PointLight(0xffa860, 2.6, 6, 2); scl.position.set(2.15, 2.72, Z0 + 0.2); add(scl);
      ctx.onUpdate((dt, t) => { scl.intensity = 2.6 * (0.95 + 0.05 * Math.sin(t * 7.7) * Math.sin(t * 2.9)); });
      // velvet slippers by the bed, a hatbox by the wardrobe, a side table and cold tea by the chair
      const hb = new THREE.Group();
      hb.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 32), mats.dollCloth(0x6a5a48)), 0, 0.11, 0));
      hb.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 32), mats.dollCloth(0x2a2a3a)), 0, 0.235, 0));
      hb.position.set(WARD.x - 0.95, 0, Z1 - 0.35); add(hb);
      const tbl = new THREE.Group();
      tbl.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.025, 40), mats.mahogany), 0, 0.62, 0));
      tbl.add(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.16, 0], [0.12, 0.03], [0.03, 0.08], [0.025, 0.3], [0.04, 0.4], [0.025, 0.5], [0.05, 0.6], [0, 0.61]], 24), mats.mahogany));
      const cupG = G.latheFromProfile([[0, 0], [0.025, 0], [0.03, 0.01], [0.042, 0.05], [0.04, 0.052], [0.028, 0.012], [0, 0.012]], 24);
      tbl.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0.0], [0.075, 0.012], [0.07, 0.014], [0, 0.006]], 28), mats.porcelain), 0.04, 0.633, 0.02));
      tbl.add(at(new THREE.Mesh(cupG, mats.porcelain), 0.04, 0.64, 0.02));
      tbl.position.set(2.75, 0, FIRE.z + 2.35); add(tbl);
    }

    // ================================================================ lighting
    const moon = new THREE.SpotLight(0xa8bcff, 1500, 20, 0.28, 0.4, 2);
    moon.position.set(WIN.x + 1.6, 5.6, Z0 - 4.6);
    moon.target.position.set(WIN.x - 0.9, 0.0, -0.7);
    moon.castShadow = ctx.quality.shadows;
    moon.shadow.mapSize.set(ctx.quality.shadowMapSize, ctx.quality.shadowMapSize);
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.02; moon.shadow.radius = ctx.quality.shadowRadius;
    moon.shadow.camera.near = 1.5; moon.shadow.camera.far = 16;
    root.add(moon, moon.target);
    root.add(new THREE.HemisphereLight(0x4a62b0, 0x22140c, 0.9));
    // moonlight bounced off the floor and the bed: a soft cold fill on the front (door / wardrobe) wall
    const frontFill = new THREE.PointLight(0x8094d0, 1.6, 5.5, 2); frontFill.position.set(-0.3, 2.6, 1.6); root.add(frontFill);
    root.add(fx.areaLight({ center: [WIN.x, WIN.sill + 1.2, Z0 + 0.04], normal: [0, -0.35, 1], width: WIN.w, height: WIN.h, color: 0x8ea6ff, intensity: 5 }));

    const winCenter = V3(WIN.x, WIN.sill + WIN.h * 0.47, Z0 - 0.02);
    const beamDir = new THREE.Vector3().subVectors(moon.target.position, moon.position).normalize();
    const shaft = fx.shaft({ center: winCenter, right: V3(WIN.w / 2, 0, 0), up: V3(0, WIN.h * 0.5, 0), direction: beamDir, length: 4.2, color: 0x9fb6ff, intensity: 0.3, softness: 0.3, falloff: 1.2, panes: [3, 4], mullion: 0.03, noise: 0.75 });
    root.add(shaft);
    root.add(fx.dust({ box: new THREE.Box3(V3(-1.6, 0.1, Z0 + 0.05), V3(2.0, 3.0, 1.2)), count: 2400, shafts: [shaft], size: 0.011, intensity: 2.2, ambient: 0.05 }));
    root.add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.2, 0, Z0 + 0.1), V3(X1 - 0.2, 0.5, Z1 - 0.3)), color: 0x0a0f1c, litColor: 0x2e3a58, density: 0.45, heightFalloff: 4 }));

    // flicker: fire + lamp + vanity candle glow
    const vlBase = vanity.userData.light.intensity;
    ctx.onUpdate((dt, t) => {
      const ff = 0.82 + 0.1 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1) + 0.08 * Math.sin(t * 17.0 + Math.sin(t * 5.0));
      fireLight.intensity = 7 * ff;
      fireLight.position.y = 0.45 + 0.03 * Math.sin(t * 9.0);
      mats.coals.emissiveIntensity = 1.6 * (0.85 + 0.15 * ff);
      lampLight.intensity = 3.2 * (0.97 + 0.03 * Math.sin(t * 11.0) * Math.sin(t * 2.3));
      vanity.userData.light.intensity = vlBase * (0.9 + 0.1 * Math.sin(t * 8.0 + 2) * Math.sin(t * 3.3));
    });

    // ================================================================ ghost: a faint figure at the window
    const ghostMat = fx.ghostMaterial({ color: 0x7898ff, rimColor: 0xd0e0ff, opacity: 0.28, intensity: 1.0, dissolveY: 0.45, dissolveSoft: 0.7 });
    const ghost = new THREE.Mesh(G.latheFromProfile([
      [0.0, 1.72], [0.06, 1.71], [0.095, 1.66], [0.105, 1.58], [0.09, 1.5], [0.065, 1.46], [0.06, 1.41], [0.16, 1.36], [0.2, 1.28], [0.18, 1.1],
      [0.15, 0.95], [0.24, 0.6], [0.34, 0.2], [0.38, 0.0],
    ], 40), ghostMat);
    ghost.position.set(WIN.x + 0.95, 0.0, Z0 + 0.55); ghost.renderOrder = 7; add(ghost);
    ctx.onUpdate((dt, t) => { ghost.position.y = Math.sin(t * 0.7) * 0.025; ghost.rotation.y = Math.sin(t * 0.25) * 0.3; });

    // ================================================================ navigation
    const nodes = {
      main: { position: [0.45, 1.62, 2.95], target: [-0.15, 1.2, -3.0], fov: 60, label: 'The bedroom', look: { yaw: [-60, 60], pitch: [-30, 28] } },
      chest: { position: [CHEST.x + 1.55, 1.68, CHEST.z + 1.2], target: [CHEST.x - 0.55, 0.62, CHEST.z - 0.3], fov: 54, label: 'The chest at the foot of the bed' },
      bed: { position: [-0.3, 1.65, 1.35], target: [X0 + 0.6, 0.95, BED.z + 0.1], fov: 56, label: 'The bed' },
      hearth: { position: [0.3, 1.6, 0.55], target: [X1, 1.15, FIRE.z - 0.35], fov: 56, label: 'The fireplace', look: { yaw: [-60, 60], pitch: [-25, 30] } },
      dolls: { position: [0.95, 1.6, -0.9], target: [2.25, 1.45, Z0], fov: 54, label: 'The doll shelf' },
      vanity: { position: [-0.85, 1.6, 0.95], target: [X0, 1.35, 1.95], fov: 54, label: 'The dressing table' },
      door: { position: [0.1, 1.62, 0.5], target: [0.1, 1.3, Z1], fov: 66, label: 'The door', grade: { exposure: DOOR_EXPOSURE } },
    };
    const edges = [
      ['main', 'chest', [[1.4, 1.6, 0.9]]],
      ['main', 'hearth', [[0.8, 1.6, 1.6]]],
      ['main', 'bed', [[0.6, 1.6, 1.6]]],
      ['main', 'vanity', [[0.0, 1.6, 1.8]]],
      ['main', 'door', null, { hotspot: { door: { position: [0.6, 1.3, 3.3], radius: 0.7 } } }],
      ['chest', 'dolls', [[1.4, 1.6, -0.6]]],
      ['chest', 'bed'],
      ['chest', 'hearth'],
      ['hearth', 'dolls'],
      ['bed', 'vanity'],
      ['bed', 'dolls', [[0.6, 1.6, -0.5]]],
      ['vanity', 'door'],
      ['door', 'hearth'],
    ];
    const exits = [
      { node: 'door', toRoom: 'gallery', toNode: 'bedroom', label: 'To the gallery', hotspot: { box: { min: [DOOR.x - 0.55, 0.1, Z1 - 0.2], max: [DOOR.x + 0.55, 2.4, Z1 + 0.3] } } },
      { node: 'door', toRoom: 'attic', toNode: null, label: 'Up the hidden stair', enabled: (s) => s.isSolved(KNIGHTS_ID), hotspot: { box: { min: [WARD.x - 0.7, 0.2, Z1 - 0.75], max: [WARD.x + 0.7, 2.3, Z1] } } },
    ];

    const cap = (title, text) => () => ctx.ui.caption(text, { title });
    const hotspots = [
      { id: 'knights', nodes: ['chest', 'main', 'bed'], box: { min: [CHEST.x - 0.32, 0.4, CHEST.z - 0.62], max: [CHEST.x + 0.32, 0.66, CHEST.z + 0.62] }, cursor: 'puzzle', label: 'A carved chessboard', puzzle: knights.puzzle, enabled: () => !ctx.state.isSolved(KNIGHTS_ID) },
      { id: 'knights-done', nodes: ['chest', 'main'], box: { min: [CHEST.x - 0.32, 0.4, CHEST.z - 0.62], max: [CHEST.x + 0.32, 0.66, CHEST.z + 0.62] }, cursor: 'examine', label: 'The chessboard', enabled: () => ctx.state.isSolved(KNIGHTS_ID), onActivate: cap('The Knights', 'Bone where ebony stood, ebony where bone stood. The board is warm to the touch, like a bed only just left.') },
      {
        id: 'wardrobe', nodes: ['door', 'vanity'], box: { min: [WARD.x - 0.72, 0.1, Z1 - 0.7], max: [WARD.x + 0.72, 2.4, Z1] }, cursor: 'examine', label: 'The wardrobe', enabled: () => !ctx.state.isSolved(KNIGHTS_ID),
        onActivate: async () => { ctx.audio.sfx?.('thud'); await ctx.ui.caption('Locked. From inside comes a draught, and the smell of dust and old rafters — as if the wardrobe had no back at all.', { title: 'The Wardrobe' }); },
      },
      { id: 'mirror', nodes: ['vanity'], box: { min: [X0, 0.95, 1.35], max: [X0 + 0.25, 1.95, 2.15] }, cursor: 'examine', label: 'The cracked mirror', onActivate: async () => { ctx.post.set({ saturation: 0.5, vignette: 0.65 }, 0.4); await ctx.say({ text: 'Seven years bad luck? My dear, you will not *have* seven years.', speaker: 'stauf', speakerName: 'Stauf' }); ctx.post.reset(1.0); } },
      { id: 'vanity-things', nodes: ['vanity'], box: { min: [X0 + 0.05, 0.75, 1.15], max: [X0 + 0.55, 0.95, 2.35] }, cursor: 'examine', label: 'A scatter of pearls', onActivate: cap('The Dressing Table', 'A broken string of pearls, a silver brush still holding long fair hairs, and scent bottles gone to brown syrup. Someone dressed for a party here.') },
      { id: 'dolls', nodes: ['dolls', 'main', 'chest'], box: { min: [1.6, 1.15, Z0], max: [2.7, 2.3, Z0 + 0.3] }, cursor: 'talk', label: 'The dolls', onActivate: async () => { ctx.audio.sfx?.('chime', { freq: 1568 }); await ctx.say({ text: 'My little friends. They never sleep, you know. Somebody has to *watch*.', speaker: 'stauf', speakerName: 'Stauf' }); } },
      { id: 'bigdoll', nodes: ['dolls', 'hearth', 'chest'], sphere: { center: [2.45, 0.75, Z0 + 0.75], radius: 0.35 }, cursor: 'examine', label: 'A doll in a rocking chair', onActivate: async () => { ctx.audio.creak?.(); await ctx.ui.caption('A large doll with a painted, patient face. The chair rocks, once, though no one touched it.', { title: 'The Rocking Chair' }); } },
      { id: 'fire', nodes: ['hearth', 'main'], box: { min: [X1 - 0.75, 0.0, FIRE.z - 0.6], max: [X1, 1.1, FIRE.z + 0.6] }, cursor: 'examine', label: 'The fire', onActivate: cap('The Fireplace', 'Coals glow in a grate no one has laid in decades. The ash is cold. The flames are not.') },
      { id: 'clock', nodes: ['hearth'], box: { min: [X1 - 0.8, fire.userData.mantelY, FIRE.z - 0.2], max: [X1, fire.userData.mantelY + 0.4, FIRE.z + 0.2] }, cursor: 'examine', label: 'The mantel clock', onActivate: async () => { ctx.audio.chimeClock?.(3); await ctx.ui.caption('Stopped at twenty-seven minutes to four. It chimes anyway.', { title: 'The Clock' }); } },
      { id: 'child', nodes: ['hearth'], box: { min: [X1 - 0.1, fire.userData.mantelY + 0.45, FIRE.z - 0.45], max: [X1, fire.userData.mantelY + 1.45, FIRE.z + 0.45] }, cursor: 'examine', label: 'A portrait', onActivate: cap('The Portrait', 'A gentleman in a black coat, painted with great care everywhere but the eyes, which someone has rubbed away with a thumb. The brass plate reads only: "Father."') },
      { id: 'bed', nodes: ['bed', 'main'], box: { min: [X0 + 0.1, 0.5, BED.z - 0.9], max: [X0 + 2.2, 1.0, BED.z + 0.9] }, cursor: 'examine', label: 'The bed', onActivate: cap('The Bed', 'The counterpane is turned down, the pillows dented by a head. The hangings have rotted to rags, but the sheets are warm.') },
      { id: 'beddoll', nodes: ['bed'], sphere: { center: [X0 + 0.62, 1.05, BED.z + 0.25], radius: 0.2 }, cursor: 'talk', label: 'A doll on the pillow', onActivate: async () => { await ctx.say({ text: 'She was tucked in, once. Then the little girl went away... and *never* came back for her.', speaker: 'stauf', speakerName: 'Stauf' }); } },
      { id: 'window', nodes: ['dolls', 'main', 'chest'], box: { min: [WIN.x - WIN.w / 2, WIN.sill, Z0 - 0.4], max: [WIN.x + WIN.w / 2, WIN.sill + WIN.h, Z0] }, cursor: 'examine', label: 'The window', onActivate: cap('The Window', 'The dead oak taps at the glass. Across the grounds, one window in the east wing is lit — and someone is standing in it.') },
      {
        id: 'ghost', nodes: ['main', 'dolls', 'chest'], sphere: { center: [WIN.x + 0.95, 1.2, Z0 + 0.55], radius: 0.4 }, cursor: 'ghost', label: 'A presence',
        onActivate: () => ctx.cinematic(async (c, h) => {
          ctx.post.set({ saturation: 0.55, vignette: 0.65 }, 0.8);
          ghostMat.uniforms.uOpacity.value = 0.85;
          await ctx.nav.lookAt(V3(WIN.x + 0.95, 1.4, Z0 + 0.55), 1.2);
          await ctx.say({ text: 'She waits by the window every night, for a carriage that will never come up the drive.', speaker: 'stauf', speakerName: 'Stauf' });
          await h.wait(0.4);
          ghostMat.uniforms.uOpacity.value = 0.28;
          ctx.post.reset(1.2);
          await ctx.nav.returnToNode(1.0);
        }),
      },
    ];

    // ================================================================ state restore + QA hooks
    if (ctx.state.isSolved(KNIGHTS_ID)) openWardrobe(true);
    if (typeof window !== 'undefined') {
      const dbg = (window.__debug ||= {});
      dbg.solvers ||= {}; dbg.states ||= {};
      dbg.solvers.bedroom = async () => {
        const game = window.__game;
        if (game && !game.puzzle && game.room?.mod?.id === 'bedroom' && game.startPuzzle && !ctx.state.isSolved(KNIGHTS_ID)) {
          game.startPuzzle(knights.puzzle);
          await new Promise((r) => setTimeout(r, 50));
        }
        if (game?.puzzle?.def?.id === KNIGHTS_ID) {
          knights.puzzle.autoSolve(game.puzzle.pctx);
          for (let i = 0; i < 50 && !ctx.state.isSolved(KNIGHTS_ID); i++) await new Promise((r) => setTimeout(r, 100));
          return ctx.state.isSolved(KNIGHTS_ID);
        }
        knights.applySolved(); (ctx.state.markSolved ? ctx.state : game?.state)?.markSolved?.(KNIGHTS_ID); openWardrobe(true);
        return true;
      };
      dbg.states.bedroom = () => ({ ...knights.state(), isSolved: ctx.state.isSolved(KNIGHTS_ID), wardrobeOpen });
      dbg.solve ||= (id) => (dbg.solvers[id] ? dbg.solvers[id]() : Promise.reject(new Error(`no solver for ${id}`)));
      dbg.state ||= (id) => (dbg.states[id] ? dbg.states[id]() : null);
      dbg.bedroom = { knights, leap: knights.leap, click: knights.click, playSolution: knights.playSolution, arrange: knights.arrange, reset: knights.reset };
    }
    // review/debug: ?brOff=moon,fire,lamp,area,hemi
    {
      const off = (ctx.params.get('brOff') || '').split(',');
      const kill = (l) => { l.intensity = 0; l.visible = false; };
      if (off.includes('moon')) kill(moon);
      if (off.includes('fire')) kill(fireLight);
      if (off.includes('lamp')) kill(lampLight);
      root.traverse((o) => { if (off.includes('area') && o.isRectAreaLight) kill(o); if (off.includes('hemi') && o.isHemisphereLight) kill(o); });
    }
    if (ctx.params.get('brNoSheen') === '1') { mats.curtain.sheen = 0; }
    // review: ?brSolved=1 shows the solved board, ?brMid=N plays N leaps of the solution
    if (ctx.params.get('brSolved') === '1') { knights.applySolved(); openWardrobe(true); }
    if (ctx.params.get('brMid')) { const n = Number(ctx.params.get('brMid')); for (let i = 0; i < n; i++) knights.leap([23, 16, 13, 4, 7, 14, 3, 12, 15, 22, 11, 8, 19, 12, 21, 10, 17, 20][i]); }

    // ================================================================ shadows + merge
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const fxLike = o.isPoints || m?.isShaderMaterial || m?.isMeshBasicMaterial || (m?.transparent && (m.opacity ?? 1) < 0.6) || o.userData.noBake;
      o.castShadow = !o.userData.noShadow && !fxLike && !['floor', 'rug', 'ceiling'].includes(o.name);
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });
    root.userData.mergedCount = mergeStatic(root);

    // the puzzle close-up sits in the moon beam: pull the exposure down while it is open so the
    // bone pieces keep their detail (and nothing blooms), and restore the room grade afterwards
    {
      const pz = knights.puzzle, su = pz.setup, td = pz.teardown;
      pz.setup = (p) => { ctx.post.set({ exposure: PUZZLE_EXPOSURE, bloomThreshold: 1.6 }, ctx.shot ? 0 : 0.8); su(p); };
      pz.teardown = (p) => { ctx.post.set({ exposure: ROOM_GRADE.exposure, bloomThreshold: ROOM_GRADE.bloomThreshold }, ctx.shot ? 0 : 0.8); td(p); };
    }
    const godRays = [{ position: V3(WIN.x - 0.3, WIN.sill + 1.4, Z0 - 2.0), color: new THREE.Color(0.72, 0.8, 1.0), strength: 0.8, radius: 0.2 }];

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'main',
      // in shot mode the engine does not blend node grades in (dt = 0), so apply the door lift directly
      grade: { ...ROOM_GRADE, ...(ctx.shot && ctx.params.get('node') === 'door' ? { exposure: DOOR_EXPOSURE } : {}) },
      environment: { position: [0.4, 1.7, 0.6], intensity: 0.5 },
      onEnter() {
        if (!ctx.state.has('bedroom.greeted')) {
          ctx.state.set('bedroom.greeted', true);
          setTimeout(() => ctx.say({ text: 'Tired? Lie down, rest your head. Nobody who sleeps in that bed is ever... *disturbed*.', speaker: 'stauf', speakerName: 'Stauf' }), 1500);
        }
      },
      update() {},
      dispose() { const d = window.__debug; if (d) { delete d.bedroom; if (d.solvers) delete d.solvers.bedroom; if (d.states) delete d.states.bedroom; } },
    };
  },
};
