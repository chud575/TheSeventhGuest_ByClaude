import * as THREE from 'three';
import { mergeStatic } from './merge.js';
import { fatherPortrait, PORTRAIT_EYES, craquelure, boneGrain, ebonyGrain, laceTex, neroMarble, charLog, fringeTex, nightSky, tornDrape, quilt, linen, knightsBoard, crackedMirror, coals, dollFace, clockFace, cobweb, persianRug, bisqueCraze } from './textures.js';
import {
  rbox, curtain, velvetCurtain, buildCeilingRose, buildGasolier, buildBed, buildChest, buildFireplace, buildVanity, buildStool, buildNightstand, buildOilLamp, buildDoll, buildDollShelf,
  buildRockingChair, buildWardrobe, buildAtticStair, buildWingChair, buildMantelClock, buildCandlestick, buildBook, buildSconce, etchedGlassTex, MIRROR_IMPACT, MIRROR_ANGLES,
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
const BED = { z: -0.7, W: 1.78, L: 2.22 };            // headboard against the left wall
const FIRE = { z: -1.05 };
const CHEST = { x: X0 + 0.06 + BED.L + 0.48, z: BED.z };
const WARD = { x: -1.55 };
const RUG = { x: -0.55, z: 0.0 };                     // rug centre (3 m across z, 4 m along x)
const VAN = { x: -1.36 };                               // dressing table against the back wall, between bed and window
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
  const pk = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (pk ? pk() : '') + `|dust${amount}`;
  return mat;
}
/**
 * Age the wallpaper in world space: vertical paper seams (a few lifting), tide-marked water stains
 * running down from the cornice, soot blooms above every flame, a band of grime where the bed has
 * stood against the wall, and darkening into the room's corners, floor and ceiling.
 * soot: [[x, y, z, radius], ...] (max 8); band: { min: [x,y,z], max: [x,y,z] }.
 */
function ageWall(mat, { soot = [], band = null, room = [3.2, 3.6], height = 3.75 } = {}) {
  const prev = mat.onBeforeCompile;
  const S = soot.slice(0, 8); while (S.length < 8) S.push([0, -99, 0, 0.01]);
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uSoot = { value: S.map((q) => new THREE.Vector4(...q)) };
    sh.uniforms.uBandMin = { value: new THREE.Vector3(...(band?.min || [0, -9, 0])) };
    sh.uniforms.uBandMax = { value: new THREE.Vector3(...(band?.max || [0, -9, 0])) };
    sh.uniforms.uRoom = { value: new THREE.Vector3(room[0], room[1], height) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAgeW;\nvarying vec3 vAgeN;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvAgeN = normalize(mat3(modelMatrix) * objectNormal);')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvAgeW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vAgeW; varying vec3 vAgeN;
uniform vec4 uSoot[8]; uniform vec3 uBandMin; uniform vec3 uBandMax; uniform vec3 uRoom;
float aH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float aN(vec3 x) { vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(aH(i), aH(i + vec3(1,0,0)), f.x), mix(aH(i + vec3(0,1,0)), aH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(aH(i + vec3(0,0,1)), aH(i + vec3(1,0,1)), f.x), mix(aH(i + vec3(0,1,1)), aH(i + vec3(1,1,1)), f.x), f.y), f.z); }
float aF(vec3 p) { return aN(p) * 0.5 + aN(p * 2.1 + 7.0) * 0.3 + aN(p * 4.3 + 13.0) * 0.2; }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 W = vAgeW; vec3 N = normalize(vAgeN);
        float hz = abs(N.x) > abs(N.z) ? W.z : W.x;          // horizontal coordinate along this wall
        float k = 1.0;
        // paper seams every 53 cm, the odd one lifting (shadow line + paler lifted edge)
        float sp = hz / 0.533; float sid = floor(sp + 0.5); float sd = abs(sp - sid) * 0.533;
        float lift = step(0.62, aH(vec3(sid, 3.0, N.x * 7.0 + N.z * 3.0))) * smoothstep(1.2, 2.6, W.y + aN(vec3(sid, W.y * 2.0, 1.0)) * 0.6);
        k *= 1.0 - smoothstep(0.0016, 0.0004, sd) * (0.3 + 0.4 * lift);
        k *= 1.0 + smoothstep(0.006, 0.0016, sd) * step(0.0016, sd) * lift * 0.35 * step(0.0, sp - sid);
        // water: tide-marked stains bleeding down from the cornice
        float wn = aF(vec3(hz * 1.3, W.y * 0.6, N.x * 3.0 + 5.0));
        float wet = smoothstep(0.25, 1.0, (W.y - (uRoom.z - 1.6)) / 1.6 + (wn - 0.5) * 0.9);
        float tide = smoothstep(0.035, 0.0, abs(wet - 0.45));
        k *= 1.0 - wet * 0.28 - tide * 0.25;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 1.0, 0.82), wet * 0.6);
        // broad blotchy grime so the repeat breaks up
        float gr = aF(W * 0.9 + 3.0);
        k *= 0.82 + 0.3 * gr;
        // soot above the flames (rises: stronger above the source)
        for (int i = 0; i < 8; i++) {
          vec4 q = uSoot[i];
          vec3 d = W - q.xyz; d.y = d.y > 0.0 ? d.y * 0.45 : d.y * 1.6;
          k *= 1.0 - 0.7 * exp(-dot(d, d) / (q.w * q.w)) * (0.75 + 0.5 * aN(W * 6.0));
        }
        // grime band where the bed has stood
        vec3 bm = smoothstep(uBandMin - 0.15, uBandMin + 0.1, W) * (1.0 - smoothstep(uBandMax - 0.1, uBandMax + 0.15, W));
        k *= 1.0 - 0.42 * bm.x * bm.y * bm.z;
        // corners, floor and ceiling darken
        float cd = min(uRoom.x - abs(W.x), uRoom.y - abs(W.z));
        k *= mix(0.55, 1.0, smoothstep(0.0, 0.55, cd));
        k *= mix(0.6, 1.0, smoothstep(0.0, 0.5, uRoom.z - W.y));
        k *= mix(0.75, 1.0, smoothstep(0.0, 0.4, W.y));
        diffuseColor.rgb *= k;
      }`);
  };
  const key = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (key ? key() : '') + '|agewall';
  mat.needsUpdate = true;
  return mat;
}

/** Soft contact shadow decal (darkens the floor right under an object). */
let contactTex = null;
function contactShadow(ctx, parent, { x, z, w, d, rotY = 0, opacity = 0.7, y = 0.0078 }) {
  contactTex ||= ctx.textures.canvas('bedroom:contact', 256, 256, (g, W2) => {
    const img = g.createImageData(W2, W2);
    for (let j = 0; j < W2; j++) for (let i = 0; i < W2; i++) {
      const u = Math.abs(i / (W2 - 1) * 2 - 1), v = Math.abs(j / (W2 - 1) * 2 - 1);
      const dd = Math.pow(Math.pow(u, 4) + Math.pow(v, 4), 0.25);           // superellipse
      const a = Math.max(0, 1 - dd); const k = (i + j * W2) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 0; img.data[k + 3] = Math.round(255 * Math.pow(a, 1.6));
    }
    g.putImageData(img, 0, 0);
  }, { tile: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: contactTex, color: 0x000000, transparent: true, opacity, depthWrite: false, name: 'contactShadow' }));
  m.position.set(x, y, z); m.rotation.y = rotY; m.renderOrder = 1; m.userData.noShadow = true; m.userData.noBake = true;
  parent.add(m); return m;
}
const ROOM_GRADE = { exposure: 2.0, contrast: 1.1, saturation: 0.9, bloomStrength: 0.3, bloomRadius: 0.4, bloomThreshold: 2.6, shadowTint: [0.86, 0.98, 1.1], highlightTint: [1.1, 1.0, 0.86], splitAmount: 0.5, lift: [0.002, 0.0035, 0.007], godRayWeight: 0.35, godRayThreshold: 2.5, vignette: 0.45, aoIntensity: 1.7, aoRadius: 0.55 };
const DOOR_EXPOSURE = 3.6;     // +0.6 EV on the door / wardrobe view
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
    const drapeA = tornDrape(ctx, { seed: 1, color: [0.3, 0.085, 0.09] });
    const drapeB = tornDrape(ctx, { seed: 2, color: [0.26, 0.075, 0.08] });
    const drapeV = tornDrape(ctx, { seed: 3, color: [0.27, 0.08, 0.085], valance: true });
    const quiltSet = quilt(ctx).withRepeat(1.6, 1.6);
    const linenSet = linen(ctx).withRepeat(1.6, 1.6);
    const boardSet = knightsBoard(ctx, { aspect: 1.21 / 0.61, board: 0.82 });
    const mirrorSet = crackedMirror(ctx, { aspect: 0.65 / 0.87, impact: MIRROR_IMPACT, angles: MIRROR_ANGLES });
    const mirrorGlint = crackedMirror(ctx, { aspect: 0.65 / 0.87, impact: MIRROR_IMPACT, angles: MIRROR_ANGLES, glint: true });
    const coalSet = coals(ctx).withRepeat(2, 2);
    const charSet = charLog(ctx).withRepeat(1, 1);
    const charGlow = charLog(ctx, { glow: true }).withRepeat(1, 1);
    const neroSet = neroMarble(ctx);
    // rotted velvet: dark dusty oxblood, strong soft sheen on the folds, alpha-tested tatters
    const drapeMat = (set, base) => {
      const sc = new THREE.Color().setRGB(base[0] * 2, base[1] * 2, base[2] * 2, THREE.SRGBColorSpace);
      const m = new THREE.MeshPhysicalMaterial({ map: set.map, normalMap: set.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.9, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide, sheen: 1.0, sheenRoughness: 0.35, sheenColor: sc, specularIntensity: 0.25, envMapIntensity: 0.25, name: 'drape' });
      addDust(m, 0.5);
      m.shadowSide = THREE.DoubleSide;
      return m;
    };
    const faceCache = new Map();
    const mats = {
      // damask at ~23 cm repeat, low motif contrast; aged in world space below (ageWall)
      wall: M.create('damask', { repeat: [4.4, 4.4], base: [0.075, 0.095, 0.21], motif: [0.105, 0.13, 0.29], sheen: 0.35, aging: 0.6, variant: 0 }),
      floor: M.create('floorboards', { species: 'walnut', boards: 6, boardLength: 0.34, polish: 0.6, wear: 0.6, tint: [0.55, 0.45, 0.4], repeat: [1 / 3.0, 1 / 1.0] }),
      ceiling: M.create('plaster', { color: [0.46, 0.47, 0.53], cracks: 0.7, stains: 0.7, repeat: [0.45, 0.45] }),
      // mahogany pulled ~30% toward brown-black (the stock species reads saturated red)
      mahogany: M.create('mahogany', { tint: [0.66, 0.54, 0.5], wear: 0.5, repeat: [1.6, 1.6], clearcoatRoughness: 0.3 }),
      canopyWood: M.create('mahogany', { tint: [0.6, 0.5, 0.47], wear: 0.6, repeat: [1.6, 1.6], clearcoat: 0.15, clearcoatRoughness: 0.5, envMapIntensity: 0.3 }),
      vanityWood: M.create('mahogany', { tint: [0.5, 0.4, 0.37], wear: 0.6, repeat: [1.8, 1.8], clearcoat: 0.12, clearcoatRoughness: 0.5, envMapIntensity: 0.15 }),
      walnut: M.create('walnut', { tint: [0.8, 0.72, 0.66], wear: 0.75, repeat: [1.6, 1.6] }),
      panel: M.create('wood', { species: 'mahogany', boards: 0, polish: 0.6, wear: 0.45, tint: [0.66, 0.55, 0.5], repeat: [1.3, 1.3], clearcoat: 0.4, clearcoatRoughness: 0.32 }),
      // picture rail, dado and skirting: a higher-albedo varnished mahogany that catches rim light
      rail: M.create('wood', { species: 'mahogany', boards: 0, polish: 0.85, wear: 0.4, tint: [0.92, 0.74, 0.64], repeat: [1.3, 1.3], clearcoat: 0.8, clearcoatRoughness: 0.18 }),
      boardLight: M.create('wood', { species: 'pine', boards: 0, polish: 0.8, wear: 0.3, tint: [1.0, 0.95, 0.74], figure: 0.2, repeat: [9, 9], clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.5 }),
      boardDark: M.create('wood', { species: 'rosewood', boards: 0, polish: 0.8, wear: 0.3, tint: [0.8, 0.62, 0.55], figure: 0.7, repeat: [9, 9], clearcoat: 0.5, clearcoatRoughness: 0.22, envMapIntensity: 0.5 }),
      ebonyWood: M.create('ebony', { repeat: [2, 2] }),
      crown: M.create('gilded', { pattern: 0, repeats: 4, wear: 0.55, dirt: 0.7, repeat: [1 / 0.5, 1] }),
      frieze: M.create('gilded', { pattern: 6, repeats: 3, ground: 1, groundColor: [0.03, 0.04, 0.09], wear: 0.4, dirt: 0.65, repeat: [1 / 0.75, 1] }),
      gilt: M.create('gold', { wear: 0.55, dirt: 0.6, repeat: [2, 1] }),
      giltFrame: M.create('gilded', { pattern: 1, repeats: 3, wear: 0.55, dirt: 0.7, repeat: [1 / 0.45, 1] }),
      marble: new THREE.MeshPhysicalMaterial({ map: neroSet.map, normalMap: neroSet.normalMap, roughnessMap: neroSet.ormMap, roughness: 1, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.08, name: 'nero' }),
      marbleDark: new THREE.MeshPhysicalMaterial({ map: neroSet.map, normalMap: neroSet.normalMap, roughnessMap: neroSet.ormMap, roughness: 1.4, metalness: 0, color: new THREE.Color(0.6, 0.6, 0.6), clearcoat: 0.3, clearcoatRoughness: 0.2, name: 'neroDark' }),
      brick: M.create('brick', { soot: 0.85, repeat: [2.5, 2.5] }),
      brass: M.create('brass', { tarnish: 0.45, polish: 0.6, repeat: [2, 2] }),
      brassOld: M.create('brass', { tarnish: 0.8, polish: 0.35, repeat: [3, 3] }),
      iron: M.basic('iron', { color: 0x3a3631, roughness: 0.55, metalness: 0.7 }),
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
      log: new THREE.MeshStandardMaterial({ map: charSet.map, normalMap: charSet.normalMap, roughness: 0.92, emissive: new THREE.Color(1, 1, 1), emissiveMap: charGlow.map, emissiveIntensity: 2.2, name: 'charLog' }),
      logEnd: new THREE.MeshStandardMaterial({ color: 0x1a0c06, roughness: 0.9, emissive: new THREE.Color(1.0, 0.32, 0.06), emissiveIntensity: 1.2, name: 'logEnd' }),
      coals: new THREE.MeshStandardMaterial({ map: coalSet.map, normalMap: coalSet.normalMap, roughness: 0.9, emissive: new THREE.Color(1, 1, 1), emissiveMap: coalSet.map, emissiveIntensity: 1.6, name: 'coals' }),
      quilt: new THREE.MeshPhysicalMaterial({ map: quiltSet.map, normalMap: quiltSet.normalMap, normalScale: new THREE.Vector2(0.45, 0.45), roughnessMap: quiltSet.ormMap, roughness: 1.0, metalness: 0, side: THREE.DoubleSide, clearcoat: 0, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.55, 0.3, 0.28), specularIntensity: 0.2, envMapIntensity: 0.3, name: 'quilt' }),
      linen: fromSet(linenSet, { metalness: 0, name: 'linen' }),
      drapeA: drapeMat(drapeA, [0.3, 0.085, 0.09]), drapeB: drapeMat(drapeB, [0.26, 0.075, 0.08]), drapeVal: drapeMat(drapeV, [0.27, 0.08, 0.085]),
      board: new THREE.MeshPhysicalMaterial({ map: boardSet.map, normalMap: boardSet.normalMap, roughnessMap: boardSet.ormMap, roughness: 1, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.55, name: 'board' }),
      frostGlass: new THREE.MeshPhysicalMaterial({ color: 0xd8d4c8, roughness: 0.55, transmission: 0, transparent: true, opacity: 0.72, side: THREE.DoubleSide, name: 'frost' }),
      mirror: new THREE.MeshPhysicalMaterial({ map: mirrorSet.map, normalMap: mirrorSet.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: mirrorSet.ormMap, metalnessMap: mirrorSet.ormMap, roughness: 2.6, metalness: 1, envMapIntensity: 1.25, color: new THREE.Color(0.72, 0.72, 0.72), emissive: new THREE.Color(0.5, 0.48, 0.44), emissiveMap: mirrorGlint.map, emissiveIntensity: 0.1, side: THREE.DoubleSide, name: 'mirror' }),
      lampGlobe: new THREE.MeshBasicMaterial({ map: etchedGlassTex(ctx), color: new THREE.Color(0.62, 0.34, 0.14), transparent: true, opacity: 0.96, name: 'lampGlobe' }),
      sconceGlass: new THREE.MeshStandardMaterial({ color: 0x5a4a38, emissive: new THREE.Color(1.0, 0.7, 0.42), emissiveMap: etchedGlassTex(ctx), emissiveIntensity: 1.1, roughness: 0.5, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false, name: 'sconceGlass' }),
      velvetRose: M.create('velvet', { color: [0.24, 0.1, 0.11], crush: 0.6, repeat: [3, 3], sheen: 1.0, sheenRoughness: 0.4, sheenColor: [0.5, 0.24, 0.26], envMapIntensity: 0.2 }),
      velvetChair: M.create('leather', { color: [0.2, 0.07, 0.05], wear: 0.7, buttons: 1, repeat: [4, 4], clearcoat: 0.3, clearcoatRoughness: 0.45 }),
      curtain: M.create('velvet', { color: [0.055, 0.08, 0.21], crush: 0.85, repeat: [1.4, 1.4], side: THREE.DoubleSide, sheen: 0.45, sheenRoughness: 0.4, sheenColor: [0.3, 0.36, 0.6], envMapIntensity: 0.25 }),
      buttons: M.basic('black', { color: 0x0a0a12, roughness: 0.4 }),
      clockFace: new THREE.MeshStandardMaterial({ map: clockFace(ctx), roughness: 0.4 }),
      glass: M.create('glass', { dirt: 0.25, opacity: 0.07, repeat: [1.5, 1.5], depthWrite: false, envMapIntensity: 0.6, normalScale: 0.25 }),
      plasterRose: M.create('plaster', { color: [0.62, 0.6, 0.58], cracks: 0.5, stains: 0.8, repeat: [4, 4] }),
      atticBoard: M.create('wood', { species: 'oak', boards: 3, boardLength: 1.2, polish: 0.1, wear: 0.9, tint: [0.55, 0.5, 0.46], repeat: [1, 1], side: THREE.DoubleSide, clearcoat: 0 }),
      atticBeam: M.create('wood', { species: 'oak', boards: 0, polish: 0.05, wear: 0.8, tint: [0.42, 0.36, 0.32], repeat: [1.5, 1.5], clearcoat: 0 }),
      atticPlaster: M.create('plaster', { color: [0.42, 0.42, 0.44], cracks: 0.8, stains: 0.8, repeat: [0.8, 0.8], side: THREE.DoubleSide }),
      rug: (() => { const r = persianRug(ctx); return new THREE.MeshPhysicalMaterial({ map: r.map, normalMap: r.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: r.ormMap, aoMap: r.ormMap, roughness: 1, metalness: 0, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.45, 0.36, 0.32), specularIntensity: 0.35, envMapIntensity: 0.3, side: THREE.DoubleSide, name: 'rug' }); })(),
    };
    addDust(mats.canopyWood, 0.4);
    mats.curtain.shadowSide = THREE.DoubleSide;
    ageWall(mats.wall, {
      room: [W / 2, D / 2], height: H,
      soot: [[X1 - 0.02, 1.95, FIRE.z, 0.6], [X1 - 0.6, 2.35, FIRE.z, 0.5], [2.15, 2.95, Z0, 0.38], [X0, 1.45, BED.z + BED.W / 2 + 0.36, 0.35], [VAN.x + 0.45, 1.5, Z0, 0.3], [DOOR.x + 0.12, 2.3, Z1 + 1.1, 0.3], [X1 - 0.6, 1.55, FIRE.z + 0.55, 0.22]],
      band: { min: [X0 - 0.1, 0.9, BED.z - 1.0], max: [X0 + 0.1, 2.55, BED.z + 1.0] },
    });
    const clothCache = new Map();
    const hairSet = ctx.textures.generate('bedroom:hair', { size: 256, tile: true, normalStrength: 2.5, glsl: /* glsl */ `
      void surface(vec2 uv, inout Surface s) {
        float st = vnoise(vec2(uv.x * 90.0, uv.y * 4.0), vec2(90.0, 4.0));
        s.albedo = vec3(0.8 + 0.2 * st); s.height = st; s.rough = 0.45; s.metal = 0.0; s.ao = 1.0;
      }` });
    mats.dollCloth = (hex) => { if (!clothCache.has(hex)) clothCache.set(hex, M.basic('cloth', { color: new THREE.Color(hex), sheenColor: new THREE.Color(hex).lerp(new THREE.Color(1, 1, 1), 0.5) })); return clothCache.get(hex); };
    mats.dollHair = (hex) => { const k = `h${hex}`; if (!clothCache.has(k)) clothCache.set(k, new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex).multiplyScalar(0.8), roughness: 0.62, sheen: 0.35, sheenRoughness: 0.35, sheenColor: new THREE.Color(hex).lerp(new THREE.Color(1, 0.95, 0.85), 0.5), normalMap: hairSet.normalMap, normalScale: new THREE.Vector2(0.8, 0.8) })); return clothCache.get(k); };
    // aged bisque: warm off-white, satin (no glaze), hairline crazing in the normal map
    const craze = bisqueCraze(ctx).withRepeat(14, 14);
    const skin = new THREE.MeshPhysicalMaterial({ color: 0xdcccb8, roughness: 0.45, normalMap: craze.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), sheen: 0.15, sheenRoughness: 0.6, sheenColor: new THREE.Color(1, 0.9, 0.85), specularIntensity: 0.4, name: 'bisque' });
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
        eyeCache.set(hex, new THREE.MeshPhysicalMaterial({ map: tex, color: 0xb8b0a4, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4 }));
      }
      return eyeCache.get(hex);
    };
    mats.dollFace = (o) => {
      const k = `${o.seed}${o.cracked}`;
      if (!faceCache.has(k)) faceCache.set(k, { mat: new THREE.MeshPhysicalMaterial({ map: dollFace(ctx, o), color: 0xf2ebe2, roughness: 0.45, normalMap: craze.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), sheen: 0.15, sheenRoughness: 0.6, sheenColor: new THREE.Color(1, 0.9, 0.85), specularIntensity: 0.4, name: 'dollFace' }), skin, glass: eyeMat(o.eyes || '#3a5a8a') });
      return faceCache.get(k);
    };
    const velCache = new Map();
    mats.dollVelvet = (hex) => {
      if (!velCache.has(hex)) {
        const c0 = { r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255 };   // sRGB albedo
        // aged, dusty silk: desaturated ~45% and dimmed
        const l = 0.3 * c0.r + 0.59 * c0.g + 0.11 * c0.b;
        const c = { r: (l + (c0.r - l) * 0.55) * 0.85, g: (l + (c0.g - l) * 0.55) * 0.85, b: (l + (c0.b - l) * 0.55) * 0.85 };
        velCache.set(hex, addDust(M.create('velvet', { color: [c.r, c.g, c.b], crush: 0.7, repeat: [9, 9], sheen: 0.55, sheenRoughness: 0.5, sheenColor: [Math.min(1, c.r * 1.6 + 0.08), Math.min(1, c.g * 1.6 + 0.08), Math.min(1, c.b * 1.6 + 0.08)], envMapIntensity: 0.25 }), 0.45));
      }
      return velCache.get(hex);
    };
    mats.laceFrill = new THREE.MeshPhysicalMaterial({ map: laceTex(ctx), color: 0xbcb2a0, roughness: 0.85, alphaTest: 0.4, side: THREE.DoubleSide, sheen: 0.5, sheenColor: new THREE.Color(1, 1, 1), name: 'lace' });
    mats.laceFrill.map.repeat.set(1, 1);
    mats.dollSash = new THREE.MeshPhysicalMaterial({ color: 0x4a2a2c, roughness: 0.35, sheen: 0.8, sheenColor: new THREE.Color(0.9, 0.5, 0.55), name: 'sash' });
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
      const hs = buildSconce(ctx, mats, { out: 0.18, seed: 5 }); hs.rotation.y = Math.PI; hs.position.set(DOOR.x + 0.12, 1.88, Z1 + 1.09); add(hs);
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
      const casing = new THREE.Mesh(cas, mats.rail); casing.position.set(WIN.x, WIN.sill, Z0 + 0.002); add(casing);
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
      const skyMat = new THREE.MeshBasicMaterial({ map: skyTex.map, color: new THREE.Color(1, 1, 1).multiplyScalar(1.45), toneMapped: false, name: "sky" });
      const sky = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 5.5), skyMat); sky.position.set(WIN.x - 0.4, WIN.sill + 1.1, Z0 - 2.6); sky.userData.noShadow = true; add(sky);
      // heavy velvet curtains, gathered into tasselled tie-backs, pooling on the boards
      const top = WIN.sill + WIN.h + 0.32;
      for (const side of [-1, 1]) {
        const cw = 1.0;
        const cg = velvetCurtain({ width: cw, height: top, folds: 9, depth: 0.085, tieback: 0.78, tiebackV: 0.6, waist: 0.2, flare: 0.8, pool: 0.2, seed: side + 7, jitter: 1.15 });
        const c = new THREE.Mesh(cg, mats.curtain);
        // outer edge sits beside the casing; the inner edge reaches over the glass
        c.position.set(WIN.x + side * (WIN.w / 2 + 0.42), top, Z0 + 0.14);
        c.scale.x = -side;
        c.name = 'cloth'; add(c);
        c.material = mats.curtain;
        // tie-back: a twisted gilt cord looped round the gathered waist, a tassel hanging in front
        const wi = cg.userData.waist;
        const cx0 = c.position.x - side * wi.w * 0.5;
        const pts = []; for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI * 2; pts.push(V3(Math.cos(a) * (wi.w * 0.42), Math.sin(a * 2) * 0.008 - Math.max(0, Math.sin(a)) * 0.02, Math.sin(a) * 0.05)); }
        const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.011, 8, true), mats.gilt);
        cord.position.set(cx0, top + wi.y, Z0 + 0.16); cord.userData.noShadow = true; add(cord);
        const tassel = new THREE.Mesh(G.latheFromProfile([[0, 0.12], [0.018, 0.11], [0.022, 0.085], [0.014, 0.07], [0.03, 0.05], [0.038, 0.0], [0, -0.005]], 20), mats.gilt);
        tassel.position.set(cx0 + side * wi.w * 0.1, top + wi.y - 0.22, Z0 + 0.235); tassel.userData.noShadow = true; add(tassel);
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
        add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.075, 0.035), pth(DADO - 0.05), { uvScale: 1 }), mats.rail));
        add(new THREE.Mesh(G.sweepProfile(G.PROFILES.baseboard(0.24, 0.03), pth(0), { uvScale: 1 }), mats.rail));
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
      // moulded ceiling: a gilt-beaded panel frame, a deep ceiling rose with acanthus, a heavy gasolier
      {
        const inset = 0.55;
        const fl = [V3(X0 + inset, H - 0.002, Z0 + inset), V3(X1 - inset, H - 0.002, Z0 + inset), V3(X1 - inset, H - 0.002, Z1 - inset), V3(X0 + inset, H - 0.002, Z1 - inset)];
        const prof = [new THREE.Vector2(0, 0), new THREE.Vector2(0.03, -0.01), new THREE.Vector2(0.05, -0.035), new THREE.Vector2(0.07, -0.04), new THREE.Vector2(0.09, -0.02), new THREE.Vector2(0.11, 0)];
        add(new THREE.Mesh(G.sweepProfile(prof, fl, { closed: true, up: V3(0, -1, 0), uvScale: 2 }), mats.crown));
      }
      add(at(new THREE.Mesh(buildCeilingRose(G), mats.plasterRose), 0, H, 0));
      const gas = buildGasolier(ctx, mats); gas.position.set(0, H, 0); add(gas);
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
      // the near corner has curled up (rolled over on itself), the rest lies with a faint ripple
      const rg = new THREE.PlaneGeometry(3.0, 4.0, 96, 128);
      {
        const p = rg.attributes.position;
        const cx = -1.5, cy = -2.0, n = new THREE.Vector2(1, 1).normalize(), sf = 0.42, rc = 0.04;
        for (let i = 0; i < p.count; i++) {
          let x = p.getX(i), y = p.getY(i), z = 0.002 * Math.sin(x * 2.1 + y * 1.3) * Math.sin(y * 3.7);
          const sAlong = (x - cx) * n.x + (y - cy) * n.y;
          if (sAlong < sf) {
            // roll over a cylinder of radius rc, then lie folded back on top of the rug
            const b = sf - sAlong, phi = Math.min(b / rc, Math.PI), e = Math.max(0, b - rc * Math.PI);
            const sNew = sf - rc * Math.sin(phi) + e;
            z = rc * (1 - Math.cos(phi)) + (e > 0 ? 0.002 : 0);
            x += n.x * (sNew - sAlong); y += n.y * (sNew - sAlong);
          }
          p.setXYZ(i, x, y, z);
        }
        rg.computeVertexNormals();
      }
      rg.setAttribute('uv1', rg.attributes.uv);
      const rug = new THREE.Mesh(rg, mats.rug); rug.rotation.x = -Math.PI / 2; rug.rotation.z = Math.PI / 2;
      rug.position.set(RUG.x, 0.006, RUG.z); rug.name = 'rug'; add(rug);
      const maxAn = ctx.renderer.capabilities.getMaxAnisotropy();
      for (const k of ['map', 'normalMap', 'roughnessMap']) if (mats.rug[k]) { mats.rug[k].anisotropy = maxAn; mats.rug[k].needsUpdate = true; }
      // short knotted fringes at both ends, lying just off the boards
      const fr = new THREE.MeshStandardMaterial({ map: fringeTex(ctx), alphaTest: 0.45, roughness: 0.95, side: THREE.DoubleSide, name: 'fringe' });
      for (const e of [-1, 1]) {
        // (the near end stops short where the corner has flipped over)
        const fw = e > 0 ? 2.38 : 3.0;
        const fg = new THREE.PlaneGeometry(fw, 0.075, 1, 3).rotateX(-Math.PI / 2);
        const fp = fg.attributes.position; for (let i = 0; i < fp.count; i++) fp.setY(i, -0.004 * (fp.getZ(i) / 0.0375 + 1) * 0.5);
        const f = new THREE.Mesh(fg, fr); f.rotation.y = e > 0 ? Math.PI / 2 : -Math.PI / 2;
        f.position.set(RUG.x + e * (2.0 + 0.0375), 0.007, RUG.z - (3.0 - fw) / 2); f.name = 'rug'; add(f);
      }
    }

    // ================================================================ bed (headboard on the left wall)
    const bed = buildBed(ctx, mats, { W: BED.W, L: BED.L, postH: 2.5 });
    bed.position.set(X0 + 0.06 + BED.L / 2, 0, BED.z); bed.rotation.y = Math.PI / 2; add(bed);
    // a doll left sitting against the pillows
    {
      const d = buildDoll(ctx, mats, { size: 0.36, seed: 9, dress: 0xcfc4b0, hair: 0x6a4a20, eyes: '#2a3a5a', bonnet: true, bonnetBack: true, tilt: 0.18, pose: 'limp' });
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
    const boardField = chest.userData.fieldSize;     // field size in metres (matches the board texture)
    const puzzleCam = { position: [CHEST.x + 0.66, 1.3, CHEST.z], target: [CHEST.x + 0.03, 0.54, CHEST.z], fov: 34 };
    // a low warm candle on the far side of the board: the amber rim on the ebony knights
    const rimLight = new THREE.PointLight(0xffa04a, 0.35, 2.2, 2); rimLight.position.set(CHEST.x - 0.7, chest.userData.boardTop + 0.32, CHEST.z - 0.1); add(rimLight);
    const boneSet = boneGrain(ctx).withRepeat(3, 3);
    // cavity tint for the carved pieces: crevices (concave, facing down/in) go yellow-brown, judged
    // from the object-space normal and height so the mane grooves, jaw and eye read as carved
    const knightAO = (m, tint) => {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uCav = { value: new THREE.Color(...tint) };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vCav;')
          .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvCav = clamp(-objectNormal.y * 1.2, 0.0, 1.0);');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vCav;\nuniform vec3 uCav;')
          .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uCav, vCav * 0.6);');
      };
      m.customProgramCacheKey = () => 'knightCav' + tint.join();
      return m;
    };
    const ebonySet = ebonyGrain(ctx).withRepeat(3, 3);
    const wardrobe = buildWardrobe(ctx, mats);
    const knights = createKnightsPuzzle(ctx, {
      parent: chest, center: V3(0, chest.userData.boardTop, 0), size: boardField,
      mats: {
        bone: knightAO(new THREE.MeshPhysicalMaterial({ color: 0xdcc59c, map: boneSet.map, roughness: 0.35, normalMap: boneSet.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.25, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.9, 0.84, 0.7), specularIntensity: 0.6, envMapIntensity: 0.55, name: 'bone' }), [0.62, 0.5, 0.3]),
        ebony: knightAO(new THREE.MeshPhysicalMaterial({ color: 0x241810, map: ebonySet.map, roughness: 0.3, normalMap: ebonySet.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), clearcoat: 0.45, clearcoatRoughness: 0.25, specularColor: new THREE.Color(1.0, 0.85, 0.65), envMapIntensity: 0.35, name: 'ebonyPiece' }), [0.35, 0.3, 0.26]),
      },
      camera: puzzleCam,
      onSolved: async () => { openWardrobe(false); },
    });

    // ================================================================ fireplace (right wall)
    const fire = buildFireplace(ctx, mats, { H });
    fire.position.set(X1, 0, FIRE.z); fire.rotation.y = -Math.PI / 2; add(fire);
    const fireLight = new THREE.PointLight(0xff7a32, 5.2, 10, 2);
    fireLight.position.set(X1 - 0.62, 0.55, FIRE.z);
    fireLight.castShadow = ctx.quality.shadows;
    fireLight.shadow.mapSize.set(512, 512); fireLight.shadow.bias = -0.004; fireLight.shadow.normalBias = 0.03; fireLight.shadow.radius = 5; fireLight.shadow.camera.near = 0.1;
    add(fireLight);
    {
      const my = fire.userData.mantelY;
      const clock = buildMantelClock(ctx, mats); clock.position.set(X1 - 0.6, my, FIRE.z); clock.rotation.y = -Math.PI / 2; add(clock);
      for (const s of [-1, 1]) {
        const cs = buildCandlestick(ctx, mats, { h: 0.3 }); cs.position.set(X1 - 0.6, my, FIRE.z + s * 0.55); add(cs);
        const c = fx.candle({ height: s > 0 ? 0.16 : 0.07, radius: 0.012, lit: s > 0, light: s > 0, lightIntensity: 0.9, lightDistance: 3, seed: 40 + s, burn: 0.9 });
        c.position.set(X1 - 0.6, my + 0.3, FIRE.z + s * 0.55); add(c);
      }
      // over-mantel portrait: a child
      const pw = 0.62, ph = 0.8;
      const pg = new THREE.Group();
      // oil on canvas under yellowed varnish; the irises are drawn here, in the shader, offset
      // toward wherever the viewer stands — the eyes follow you round the room
      const craq = craquelure(ctx);
      const pm = new THREE.MeshPhysicalMaterial({ map: fatherPortrait(ctx), roughness: 0.6, normalMap: craq.normalMap, normalScale: new THREE.Vector2(0.12, 0.12), clearcoat: 0.5, clearcoatRoughness: 0.35, clearcoatNormalMap: craq.normalMap, clearcoatNormalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 0.45, name: 'father' });
      pm.onBeforeCompile = (sh) => {
        sh.uniforms.uEyes = { value: PORTRAIT_EYES.map(([u, v]) => new THREE.Vector2(u, v)) };
        sh.uniforms.uPSize = { value: new THREE.Vector2(pw, ph) };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vPUv;\nvarying vec3 vCamL;')
          .replace('#include <uv_vertex>', '#include <uv_vertex>\nvPUv = uv;\nvCamL = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vPUv;\nvarying vec3 vCamL;\nuniform vec2 uEyes[2];\nuniform vec2 uPSize;')
          .replace('#include <map_fragment>', `#include <map_fragment>
          for (int i = 0; i < 2; i++) {
            vec2 e = uEyes[i];
            vec3 eL = vec3((e.x - 0.5) * uPSize.x, (e.y - 0.5) * uPSize.y, 0.0);
            vec3 dv = normalize(vCamL - eL);
            vec2 off = dv.xy / max(dv.z, 0.35) * vec2(0.010, 0.006);        // iris travel, in uv
            vec2 px = (vPUv - e - off) * vec2(1024.0, 1320.0);
            vec2 ex = (vPUv - e) * vec2(1024.0, 1320.0);
            float almond = 1.0 - smoothstep(0.85, 1.0, length(ex / vec2(27.0, 12.0)));
            float r = length(px);
            float iris = (1.0 - smoothstep(10.0, 11.5, r)) * almond;
            float pupil = (1.0 - smoothstep(4.0, 5.0, r)) * almond;
            vec3 irisC = mix(vec3(0.16, 0.1, 0.06), vec3(0.32, 0.22, 0.12), smoothstep(10.0, 3.0, r)) * (i == 0 ? 1.0 : 0.45);
            diffuseColor.rgb = mix(diffuseColor.rgb, irisC * vec3(1.0, 0.92, 0.75), iris);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012, 0.008, 0.006), pupil);
            // the wet catch-light, fixed (painted) high on the iris
            float cl = 1.0 - smoothstep(1.2, 2.4, length(px - vec2(-3.5, 4.0)));
            diffuseColor.rgb += vec3(0.55, 0.5, 0.42) * cl * almond * (i == 0 ? 1.0 : 0.5);
          }`);
      };
      pm.customProgramCacheKey = () => 'fatherEyes';
      pg.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), pm));
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
        [1.2, -0.38, { size: 0.3, dress: 0x7a2232, hair: 0x3a1c0c, seed: 1, pose: 'lap' }],
        [1.2, -0.02, { size: 0.36, dress: 0x2c3e6a, hair: 0xb89050, seed: 2, cracked: true, bonnet: true, pose: 'reach', headYaw: 0.5, tilt: 0.12 }],
        [1.2, 0.36, { size: 0.28, dress: 0xcfc2aa, hair: 0x2a140a, seed: 3, pose: 'limp', tilt: 0.35 }],
        [1.63, -0.34, { size: 0.33, dress: 0x26232a, hair: 0x8a4a22, seed: 4, eyes: '#5a3a20', pose: 'lap', headYaw: -0.55, cracked: true }],
        [1.63, 0.3, { size: 0.31, dress: 0x8a6282, hair: 0xc8a060, seed: 5, bonnet: true, tilt: -0.3, pose: 'lap' }, { toppled: true }],
        [2.06, -0.36, { size: 0.35, dress: 0x4e6a52, hair: 0x5a2e14, seed: 6, pose: 'reach' }],
        [2.06, 0.34, { size: 0.29, dress: 0x8a2a22, hair: 0xa07840, seed: 8, tilt: 0.25, pose: 'limp', headYaw: 0.25 }],
      ];
      for (const [y, x, o, extra] of specs) {
        const d = buildDoll(ctx, mats, o);
        d.position.set(2.15 + x, y, Z0 + 0.1); d.rotation.y = (o.seed * 0.37) % 0.5 - 0.25;
        dollGroup.add(d);
        if (extra?.toppled) {
          // fallen on her side: rest her on the board (real contact, measured), well inside the shelf
          d.rotation.set(0, -0.25, -1.5); d.position.set(2.15 + x - 0.06, y, Z0 + 0.105);
          d.updateMatrixWorld(true);
          const bb = new THREE.Box3().setFromObject(d);
          d.position.y += y - bb.min.y + 0.001;
          const over = bb.max.x - (2.15 + 0.56 - 0.05); if (over > 0) d.position.x -= over;
          contactShadow(ctx, root, { x: d.position.x + 0.02, z: Z0 + 0.105, w: 0.3, d: 0.16, opacity: 0.55, y: y + 0.0015 });
        } else {
          contactShadow(ctx, root, { x: 2.15 + x, z: Z0 + 0.11, w: o.size * 0.75, d: o.size * 0.6, opacity: 0.5, y: y + 0.0015 });
        }
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
      const big = buildDoll(ctx, mats, { size: 0.62, seed: 12, dress: 0x8a7290, hair: 0xc09a58, eyes: '#4a6a9a', bonnet: true, bonnetBack: true, cracked: true, tilt: -0.28, headYaw: 0.35, pose: 'lap' });
      big.position.set(0, 0.42, 0.0); rc.add(big);
    }

    // ================================================================ vanity (back wall, between the bed and the window)
    let vanity;
    {
      vanity = buildVanity(ctx, { ...mats, walnut: mats.vanityWood });
      vanity.position.set(VAN.x, 0, Z0 + 0.02); add(vanity);
      const st = buildStool(ctx, { ...mats, walnut: mats.vanityWood }); st.position.set(VAN.x + 0.05, 0, Z0 + 0.78); st.rotation.y = 0.2; add(st);
      // the right-hand vanity candle is lit and throws the mirror into relief
      const vl = new THREE.PointLight(0xffa04a, 1.4, 4.5, 2); vl.position.set(VAN.x + 0.45, 0.76 + 0.37, Z0 + 0.32); add(vl);
      vanity.userData.light = vl;
    }

    // ================================================================ wardrobe (front wall, left) -> attic once the knights are solved
    wardrobe.position.set(WARD.x, 0, Z1); wardrobe.rotation.y = Math.PI; add(wardrobe);
    const stair = buildAtticStair(ctx, mats, { w: 1.18, y0: 0.16 });
    stair.position.set(WARD.x, 0, Z1); stair.rotation.y = Math.PI; add(stair);
    const stairLights = [stair.userData.light, stair.userData.fill];
    {
      const su = stair.userData;
      const sweb = (size, pos, flip, seed) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: cobweb(ctx, { seed }), transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0xa8acb8, roughness: 1, metalness: 0, name: 'cobweb' }));
        m.geometry.translate(size / 2, -size / 2, 0); m.position.copy(pos); if (flip) m.scale.x = -1; m.userData.noShadow = true; m.renderOrder = 3; stair.add(m);
      };
      sweb(0.7, V3(-1.18 / 2 + 0.01, su.topY + 1.0, su.endZ + 0.25), false, 11);
      sweb(0.55, V3(1.18 / 2 - 0.01, su.topY + 1.05, su.endZ + 0.6), true, 12);
      sweb(0.5, V3(-1.18 / 2 + 0.01, 2.35, -0.25), false, 13);
    }
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
      const OPEN = 2.35;     // swung right back so the stair is in full view
      if (instant) { l.rotation.y = -OPEN; r.rotation.y = OPEN; return; }
      const t0 = performance.now();
      ctx.audio.sfx?.('door');
      const step = () => { const k = Math.min(1, (performance.now() - t0) / 2200); const e = 1 - (1 - k) ** 3; l.rotation.y = -OPEN * e; r.rotation.y = OPEN * e; if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }

    // a small portrait between the bed canopy and the window
    {
      const pw = 0.46, ph = 0.6;
      const pg = new THREE.Group();
      pg.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), M.create('painting', { subject: 1, seed: 17, aspect: pw / ph, size: 1024, cracks: 0.7 })));
      pg.add(new THREE.Mesh(G.frameGeometry(pw, ph, { width: 0.08, depth: 0.05, uvScale: 1 }), mats.giltFrame));
      pg.position.set(VAN.x, 2.42, Z0 + 0.03); add(pg);
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
      web(root, 0.75, V3(X1 - 0.01, H - 0.46, Z1 - 0.53), -Math.PI * 0.75, false, 6);
      web(root, 0.6, V3(X0 + 0.43, H - 0.3, Z1 - 0.01), Math.PI * 0.75, true, 7);
      // brass gas sconce above the doll shelf: a real fixture (backplate, scrolled arm, etched tulip)
      const sc = buildSconce(ctx, mats, { out: 0.2, seed: 2 }); sc.position.set(2.15, 2.6, Z0 + 0.005); add(sc);
      const scl = new THREE.PointLight(0xffa860, 2.4, 6, 2); scl.position.set(2.15, 2.6 + 0.08, Z0 + 0.2); add(scl);
      ctx.onUpdate((dt, t) => { scl.intensity = 2.4 * (0.95 + 0.05 * Math.sin(t * 7.7) * Math.sin(t * 2.9)); });
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

    // ================================================================ peeling wallpaper: strips lifting at the seams
    {
      const plaster = new THREE.MeshStandardMaterial({ color: 0x5c564c, roughness: 0.95, name: 'barePlaster' });
      const paperBack = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.95, side: THREE.BackSide, name: 'paperBack' });
      const flap = (wallPos, rotY, w, h, curl, seed) => {
        const g = new THREE.PlaneGeometry(w, h, 6, 20); g.translate(w / 2, -h / 2, 0);   // anchor = top-left (at the seam)
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i);
          const t = Math.min(1, Math.max(0, (-y) / h));    // 0 top .. 1 bottom
          const lift = Math.pow(1 - t, 2.2) * curl;        // the top has come away and curls forward
          const a = lift / 0.06;                            // roll radius 6 cm
          p.setXYZ(i, x + Math.sin(seed + y * 9) * 0.004, y + (1 - Math.cos(Math.min(a, 2.4))) * 0.0 + (a > 0 ? 0.06 * Math.sin(Math.min(a, 2.4)) * 0.4 : 0), 0.004 + 0.06 * (1 - Math.cos(Math.min(a, 2.4))) * (0.6 + 0.4 * x / w));
        }
        g.computeVertexNormals();
        const grp = new THREE.Group(); grp.position.copy(wallPos); grp.rotation.y = rotY;
        const front = new THREE.Mesh(g, mats.wall); front.userData.noShadow = false; grp.add(front);
        const back = new THREE.Mesh(g, paperBack); grp.add(back);
        // bare plaster where the paper has gone
        const bare = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.55).translate(w * 0.45, -h * 0.28, 0.0015), plaster); grp.add(bare);
        add(grp);
      };
      flap(V3(-0.533, H - 0.5, Z0 + 0.002), 0, 0.17, 0.75, 1.0, 1);
      flap(V3(X1 - 0.002, H - 0.5, 1.066), -Math.PI / 2, 0.15, 0.6, 0.8, 2);
      flap(V3(X0 + 0.002, H - 0.5, -2.132 - 0.12), Math.PI / 2, 0.12, 0.5, 0.7, 3);
    }

    // ================================================================ contact shadows (furniture sits on the floor)
    {
      const bx = X0 + 0.06 + BED.L / 2, hw = BED.W / 2, hl = BED.L / 2;
      const C = (o) => contactShadow(ctx, root, o);
      C({ x: CHEST.x, z: CHEST.z, w: 0.78, d: 1.36, opacity: 0.8 });
      C({ x: bx, z: BED.z, w: BED.L + 0.25, d: BED.W + 0.25, opacity: 0.6 });
      for (const a of [-1, 1]) for (const b of [-1, 1]) C({ x: bx + a * hl, z: BED.z + b * hw, w: 0.22, d: 0.22, opacity: 0.85 });
      for (const b of [-1, 1]) C({ x: X0 + 0.3, z: BED.z + b * (BED.W / 2 + 0.36), w: 0.6, d: 0.62, opacity: 0.7 });
      C({ x: VAN.x, z: Z0 + 0.27, w: 1.35, d: 0.62, opacity: 0.7 });
      C({ x: VAN.x + 0.05, z: Z0 + 0.78, w: 0.6, d: 0.48, rotY: 0.2, opacity: 0.6 });
      C({ x: 2.25, z: FIRE.z + 1.75, w: 0.95, d: 0.95, rotY: Math.PI - 0.55, opacity: 0.75 });
      C({ x: 2.45, z: Z0 + 0.75, w: 0.62, d: 0.72, rotY: -0.55, opacity: 0.6 });
      C({ x: WARD.x, z: Z1 - 0.3, w: 1.65, d: 0.85, opacity: 0.75 });
      C({ x: 2.75, z: FIRE.z + 2.35, w: 0.5, d: 0.5, opacity: 0.55 });
      C({ x: WARD.x - 0.95, z: Z1 - 0.35, w: 0.5, d: 0.5, opacity: 0.55 });
      // dirt and occlusion gathered along the skirting
      C({ x: 0, z: Z0, w: W, d: 0.5, opacity: 0.45, y: 0.0072 });
      C({ x: 0, z: Z1, w: W, d: 0.5, opacity: 0.45, y: 0.0072 });
      C({ x: X0, z: 0, w: 0.5, d: D, opacity: 0.45, y: 0.0072 });
      C({ x: X1, z: 0, w: 0.5, d: D, opacity: 0.45, y: 0.0072 });
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
    root.add(new THREE.HemisphereLight(0x34405e, 0x1a120c, 0.5));
    // moonlight bounced off the floorboards up onto the ceiling, so the plaster separates from black
    root.add(fx.areaLight({ center: [WIN.x - 0.4, 0.05, -1.4], normal: [0, 1, 0], width: 2.6, height: 2.6, color: 0x7f92c8, intensity: 1.6 }));
    // moonlight bounced off the floor and the bed: a soft cold fill on the front (door / wardrobe) wall
    const frontFill = new THREE.PointLight(0x8094d0, 2.4, 5.5, 2); frontFill.position.set(-0.3, 2.6, 1.6); root.add(frontFill);
    // low cold bounce off the boards in front of the wardrobe, so it stands in the room, not in black
    const floorFill = new THREE.PointLight(0x7a8cc4, 1.8, 3.6, 2); floorFill.position.set(WARD.x + 0.6, 0.45, Z1 - 1.4); root.add(floorFill);
    root.add(fx.areaLight({ center: [WIN.x, WIN.sill + 1.2, Z0 + 0.04], normal: [0, -0.35, 1], width: WIN.w, height: WIN.h, color: 0x8ea6ff, intensity: 2.2 }));

    const winCenter = V3(WIN.x, WIN.sill + WIN.h * 0.47, Z0 - 0.02);
    const beamDir = new THREE.Vector3().subVectors(moon.target.position, moon.position).normalize();
    const shaft = fx.shaft({ center: winCenter, right: V3(WIN.w / 2, 0, 0), up: V3(0, WIN.h * 0.5, 0), direction: beamDir, length: 4.0, color: 0x9fb6ff, intensity: 0.13, softness: 0.35, falloff: 1.6, panes: [3, 4], mullion: 0.03, noise: 0.75 });
    root.add(shaft);
    root.add(fx.dust({ box: new THREE.Box3(V3(-1.6, 0.1, Z0 + 0.05), V3(2.0, 3.0, 1.2)), count: 2400, shafts: [shaft], size: 0.011, intensity: 2.2, ambient: 0.05 }));
    root.add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.2, 0, Z0 + 0.1), V3(X1 - 0.2, 0.5, Z1 - 0.3)), color: 0x0a0f1c, litColor: 0x2e3a58, density: 0.45, heightFalloff: 4 }));

    // flicker: fire + lamp + vanity candle glow
    const vlBase = vanity.userData.light.intensity;
    ctx.onUpdate((dt, t) => {
      const ff = 0.82 + 0.1 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1) + 0.08 * Math.sin(t * 17.0 + Math.sin(t * 5.0));
      fireLight.intensity = 5.2 * ff;
      fireLight.position.y = 0.55 + 0.03 * Math.sin(t * 9.0);
      mats.coals.emissiveIntensity = 1.6 * (0.85 + 0.15 * ff);
      mats.log.emissiveIntensity = 2.2 * (0.7 + 0.3 * ff);
      mats.logEnd.emissiveIntensity = 1.2 * (0.75 + 0.25 * ff);
      lampLight.intensity = 3.2 * (0.97 + 0.03 * Math.sin(t * 11.0) * Math.sin(t * 2.3));
      vanity.userData.light.intensity = vlBase * (0.9 + 0.1 * Math.sin(t * 8.0 + 2) * Math.sin(t * 3.3));
    });

    // ================================================================ ghost: a faint figure at the window
    const ghostMat = fx.ghostMaterial({ color: 0x7898ff, rimColor: 0xd0e0ff, opacity: 0.28, intensity: 1.0, dissolveY: 0.45, dissolveSoft: 0.7 });
    // a woman in a long gown, hands loosely clasped (shown only when the presence is called up)
    const ghostG = (() => {
      const body = G.latheFromProfile([
        [0.0, 1.71], [0.05, 1.7], [0.083, 1.65], [0.09, 1.58], [0.077, 1.51], [0.052, 1.475], [0.046, 1.42], [0.12, 1.385], [0.165, 1.34],
        [0.158, 1.22], [0.128, 1.12], [0.108, 1.03], [0.15, 0.96], [0.22, 0.72], [0.29, 0.4], [0.35, 0.08], [0.38, 0.0],
      ], 48);
      const bun = new THREE.SphereGeometry(0.055, 20, 14); bun.translate(0, 1.665, -0.075);
      const arms = [-1, 1].map((sx) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(sx * 0.16, 1.36, 0), V3(sx * 0.2, 1.16, 0.03), V3(sx * 0.13, 1.0, 0.12), V3(sx * 0.03, 0.96, 0.17)]), 24, 0.032, 10, false));
      const parts = [body, bun, ...arms].map((q) => { const g2 = q.index ? q.toNonIndexed() : q; for (const k of Object.keys(g2.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g2.deleteAttribute(k); return g2; });
      return G.mergeGeometries(parts);
    })();
    const ghost = new THREE.Mesh(ghostG, ghostMat);
    ghost.position.set(WIN.x + 0.95, 0.0, Z0 + 0.55); ghost.renderOrder = 7; ghost.visible = false; ghost.userData.keep = true; add(ghost);
    ctx.onUpdate((dt, t) => { ghost.position.y = Math.sin(t * 0.7) * 0.025; ghost.rotation.y = Math.sin(t * 0.25) * 0.3; });

    // ================================================================ navigation
    const nodes = {
      main: { position: [0.75, 1.62, 2.95], target: [-0.3, 1.18, -3.0], fov: 60, label: 'The bedroom', look: { yaw: [-60, 60], pitch: [-30, 28] } },
      chest: { position: [CHEST.x + 1.55, 1.68, CHEST.z + 1.2], target: [CHEST.x - 0.55, 0.62, CHEST.z - 0.3], fov: 54, label: 'The chest at the foot of the bed' },
      bed: { position: [-1.95, 1.64, 1.4], target: [-2.5, 0.88, BED.z - 0.05], fov: 58, label: 'The bed' },
      hearth: { position: [0.3, 1.6, 0.55], target: [X1, 1.15, FIRE.z - 0.35], fov: 56, label: 'The fireplace', look: { yaw: [-60, 60], pitch: [-25, 30] } },
      dolls: { position: [0.95, 1.6, -0.9], target: [2.25, 1.45, Z0], fov: 54, label: 'The doll shelf' },
      vanity: { position: [-0.45, 1.6, -1.85], target: [VAN.x - 0.1, 1.3, Z0], fov: 54, label: 'The dressing table' },
      door: { position: [0.1, 1.62, 0.5], target: [-0.25, 1.3, Z1], fov: 66, label: 'The door', grade: { exposure: DOOR_EXPOSURE } },
    };
    const edges = [
      ['main', 'chest', [[1.4, 1.6, 0.9]]],
      ['main', 'hearth', [[0.8, 1.6, 1.6]]],
      ['main', 'bed', [[0.6, 1.6, 1.6]]],
      ['main', 'vanity', [[0.35, 1.6, -0.6]]],
      ['main', 'door', null, { hotspot: { door: { position: [0.6, 1.3, 3.3], radius: 0.7 } } }],
      ['chest', 'dolls', [[1.4, 1.6, -0.6]]],
      ['chest', 'bed'],
      ['chest', 'hearth'],
      ['hearth', 'dolls'],
      ['bed', 'vanity', [[0.25, 1.6, -0.5]]],
      ['vanity', 'dolls'],
      ['bed', 'dolls', [[0.6, 1.6, -0.5]]],
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
        id: 'wardrobe', nodes: ['door'], box: { min: [WARD.x - 0.72, 0.1, Z1 - 0.7], max: [WARD.x + 0.72, 2.4, Z1] }, cursor: 'examine', label: 'The wardrobe', enabled: () => !ctx.state.isSolved(KNIGHTS_ID),
        onActivate: async () => { ctx.audio.sfx?.('thud'); await ctx.ui.caption('Locked. From inside comes a draught, and the smell of dust and old rafters — as if the wardrobe had no back at all.', { title: 'The Wardrobe' }); },
      },
      { id: 'mirror', nodes: ['vanity', 'main'], box: { min: [VAN.x - 0.4, 0.95, Z0], max: [VAN.x + 0.4, 1.95, Z0 + 0.3] }, cursor: 'examine', label: 'The cracked mirror', onActivate: async () => { ctx.post.set({ saturation: 0.5, vignette: 0.65 }, 0.4); await ctx.say({ text: 'Seven years bad luck? My dear, you will not *have* seven years.', speaker: 'stauf', speakerName: 'Stauf' }); ctx.post.set(ROOM_GRADE, 1.0); } },
      { id: 'vanity-things', nodes: ['vanity'], box: { min: [VAN.x - 0.58, 0.75, Z0 + 0.05], max: [VAN.x + 0.58, 0.95, Z0 + 0.55] }, cursor: 'examine', label: 'A scatter of pearls', onActivate: cap('The Dressing Table', 'A broken string of pearls, a silver brush still holding long fair hairs, and scent bottles gone to brown syrup. Someone dressed for a party here.') },
      { id: 'dolls', nodes: ['dolls', 'main', 'chest'], box: { min: [1.6, 1.15, Z0], max: [2.7, 2.3, Z0 + 0.3] }, cursor: 'talk', label: 'The dolls', onActivate: async () => { ctx.audio.sfx?.('chime', { freq: 1568 }); await ctx.say({ text: 'My little friends. They never sleep, you know. Somebody has to *watch*.', speaker: 'stauf', speakerName: 'Stauf' }); } },
      { id: 'bigdoll', nodes: ['dolls', 'hearth', 'chest'], sphere: { center: [2.45, 0.75, Z0 + 0.75], radius: 0.35 }, cursor: 'examine', label: 'A doll in a rocking chair', onActivate: async () => { ctx.audio.creak?.(); await ctx.ui.caption('A large doll with a painted, patient face. The chair rocks, once, though no one touched it.', { title: 'The Rocking Chair' }); } },
      { id: 'fire', nodes: ['hearth', 'main'], box: { min: [X1 - 0.75, 0.0, FIRE.z - 0.6], max: [X1, 1.1, FIRE.z + 0.6] }, cursor: 'examine', label: 'The fire', onActivate: cap('The Fireplace', 'Coals glow in a grate no one has laid in decades. The ash is cold. The flames are not.') },
      { id: 'clock', nodes: ['hearth'], box: { min: [X1 - 0.8, fire.userData.mantelY, FIRE.z - 0.2], max: [X1, fire.userData.mantelY + 0.4, FIRE.z + 0.2] }, cursor: 'examine', label: 'The mantel clock', onActivate: async () => { ctx.audio.chimeClock?.(3); await ctx.ui.caption('Stopped at twenty-seven minutes to four. It chimes anyway.', { title: 'The Clock' }); } },
      { id: 'child', nodes: ['hearth'], box: { min: [X1 - 0.1, fire.userData.mantelY + 0.45, FIRE.z - 0.45], max: [X1, fire.userData.mantelY + 1.45, FIRE.z + 0.45] }, cursor: 'examine', label: 'A portrait', onActivate: cap('The Portrait', 'A gentleman in a black coat, painted in thick, careful oils. Wherever you stand, his eyes have found you first. The brass plate reads only: "Father."') },
      { id: 'bed', nodes: ['bed', 'main'], box: { min: [X0 + 0.1, 0.5, BED.z - 0.9], max: [X0 + 2.2, 1.0, BED.z + 0.9] }, cursor: 'examine', label: 'The bed', onActivate: cap('The Bed', 'The counterpane is turned down, the pillows dented by a head. The hangings have rotted to rags, but the sheets are warm.') },
      { id: 'beddoll', nodes: ['bed'], sphere: { center: [X0 + 0.62, 1.05, BED.z + 0.25], radius: 0.2 }, cursor: 'talk', label: 'A doll on the pillow', onActivate: async () => { await ctx.say({ text: 'She was tucked in, once. Then the little girl went away... and *never* came back for her.', speaker: 'stauf', speakerName: 'Stauf' }); } },
      { id: 'window', nodes: ['dolls', 'main', 'chest'], box: { min: [WIN.x - WIN.w / 2, WIN.sill, Z0 - 0.4], max: [WIN.x + WIN.w / 2, WIN.sill + WIN.h, Z0] }, cursor: 'examine', label: 'The window', onActivate: cap('The Window', 'The dead oak taps at the glass. Across the grounds, one window in the east wing is lit — and someone is standing in it.') },
      {
        id: 'ghost', nodes: ['main', 'dolls', 'chest'], sphere: { center: [WIN.x + 0.95, 1.2, Z0 + 0.55], radius: 0.4 }, cursor: 'ghost', label: 'A presence',
        onActivate: () => ctx.cinematic(async (c, h) => {
          ctx.post.set({ saturation: 0.55, vignette: 0.65 }, 0.8);
          ghost.visible = true; ghostMat.uniforms.uOpacity.value = 0.85;
          await ctx.nav.lookAt(V3(WIN.x + 0.95, 1.4, Z0 + 0.55), 1.2);
          await ctx.say({ text: 'She waits by the window every night, for a carriage that will never come up the drive.', speaker: 'stauf', speakerName: 'Stauf' });
          await h.wait(0.4);
          ghostMat.uniforms.uOpacity.value = 0.28; ghost.visible = false;
          ctx.post.set(ROOM_GRADE, 1.2);
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
    if (ctx.params.get('brGhost') === '1') { ghost.visible = true; ghostMat.uniforms.uOpacity.value = 0.85; }
    if (ctx.params.get('brMid')) { const n = Number(ctx.params.get('brMid')); for (let i = 0; i < n; i++) knights.leap([23, 16, 13, 4, 7, 14, 3, 12, 15, 22, 11, 8, 19, 12, 21, 10, 17, 20][i]); }

    // ================================================================ shadows + merge
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const fxLike = o.isPoints || m?.isShaderMaterial || m?.isMeshBasicMaterial || (m?.transparent && (m.opacity ?? 1) < 0.6) || o.userData.noBake;
      o.castShadow = !o.userData.noShadow && !fxLike && !['floor', 'rug', 'ceiling'].includes(o.name);
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });
    for (const pc of knights.pieces || []) pc.mesh.receiveShadow = false;
    root.userData.mergedCount = mergeStatic(root);

    // the puzzle close-up sits in the moon beam: pull the exposure down while it is open so the
    // bone pieces keep their detail (and nothing blooms), and restore the room grade afterwards
    {
      const pz = knights.puzzle, su = pz.setup, td = pz.teardown;
      pz.setup = (p) => { ctx.post.set({ exposure: PUZZLE_EXPOSURE, bloomThreshold: 1.6, aoRadius: 0.1, aoIntensity: 1.1 }, ctx.shot ? 0 : 0.8); su(p); };
      pz.teardown = (p) => { ctx.post.set({ exposure: ROOM_GRADE.exposure, bloomThreshold: ROOM_GRADE.bloomThreshold, aoRadius: ROOM_GRADE.aoRadius, aoIntensity: ROOM_GRADE.aoIntensity }, ctx.shot ? 0 : 0.8); td(p); };
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
