import * as THREE from 'three';
import { mergeStatic } from '../../engine/lib/contrib/foyer-merge.js';
import { nightLayers, wallpaperTexture, portraitTexture } from './textures.js';
import { buildPiano, KEY } from './piano.js';
import { buildHarp, buildCello, buildMusicStand, buildBench } from './instruments.js';
import { buildFireplace, buildTorchere, buildCabinet, buildChair, buildGasolier, buildSconce, buildGramophone } from './furniture.js';
import { buildGhostPianist } from './ghost.js';
import { createPianoPuzzle, meta as pianoMeta, PUZZLE_ID, PHRASE } from './puzzlePiano.js';
import { pianoNote, harpNote, celloNote } from './synth.js';

/**
 * The Music Room — behind the foyer's north doors. A tall blue room with a bay
 * of three moonlit windows, a black concert grand with its lid raised, a gilt
 * harp and a cello by the windows, a marble chimneypiece with a live fire.
 * A dead pianist still sits at the keys: play his nocturne back to him.
 */

const W = 8, D = 9, H = 4.4;
const X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
const DADO = 0.95;
const WIN = { xs: [-2.35, 0, 2.35], w: 1.3, sill: 0.98, h: 2.78, depth: 0.42 };
const DOOR = { x: 0, w: 1.7, h: 2.9 };
const CROWN = 0.3, FRIEZE = 0.22;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const PIANO_POS = V3(-0.95, 0, -1.2), PIANO_ROT = -0.93;
const FIRE = { z: -0.2 };
const GHOST_IDLE = 0.85;

const pianoToWorldEarly = (piano, x, y, z) => { piano.updateMatrixWorld(true); return piano.localToWorld(new THREE.Vector3(x, y, z)); };

export default {
  id: 'music',
  title: 'The Music Room',
  floorName: 'Ground Floor',
  map: { floor: 'ground', rect: [395, 45, 210, 175] },
  start: 'main',
  ambience: { wind: 0.5, creaks: 0.35, clock: 0.15, thunder: 0.25, rain: 0, heartbeat: 0, roomTone: 0.3 },
  music: false,  // the piano is the music here
  puzzles: [pianoMeta],

  async build(ctx) {
    const { materials: M, geometry: G, fx } = ctx;
    const root = new THREE.Group();
    root.name = 'music';
    const add = (o) => { root.add(o); return o; };
    const hq = ctx.quality.textureSize >= 2048;

    // ================================================================ materials
    const wpSet = wallpaperTexture(ctx.textures).withRepeat(1 / 0.42, 1 / 0.42);
    const wallpaper = new THREE.MeshPhysicalMaterial({ map: wpSet.map, normalMap: wpSet.normalMap, roughnessMap: wpSet.roughnessMap, metalnessMap: wpSet.metalnessMap, roughness: 1, metalness: 1, normalScale: new THREE.Vector2(1.2, 1.2), sheen: 0.7, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.32, 0.4, 0.75), envMapIntensity: 0.6 });
    // age the damask: a macro mask in world space -- low-frequency water staining and grime, the paper
    // sun-faded paler around the bay windows, darkened in the corners under the cornice and above the
    // dado and in the room corners -- and a second, offset sample of the print
    // blended in by noise so the repeat never lines up
    wallpaper.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWpW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWpW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWpW;
float wpH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wpN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wpH(i), wpH(i + vec2(1, 0)), f.x), mix(wpH(i + vec2(0, 1)), wpH(i + vec2(1, 1)), f.x), f.y); }
float wpF(vec2 p) { return 0.5 * wpN(p) + 0.25 * wpN(p * 2.03 + 7.1) + 0.125 * wpN(p * 4.1 + 3.3) + 0.0625 * wpN(p * 8.3); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
  {
    vec2 wq = vec2(vWpW.x + vWpW.z, vWpW.y);
    // break the repeat: a second sample of the print, shifted half a drop, blended in by noise
    vec4 alt = texture2D(map, vMapUv + vec2(0.5, 0.37));
    float bm = smoothstep(0.42, 0.62, wpF(wq * 0.6 + 11.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, alt.rgb * diffuse, bm * 0.5);
    float stain = wpF(wq * 0.9);
    float tide = smoothstep(0.55, 0.75, wpF(wq * vec2(0.7, 0.35) + 3.0));
    float macro = 0.8 + 0.32 * stain - 0.18 * tide;
    // corners: under the frieze and just above the chair rail
    macro *= mix(1.0, 0.62, smoothstep(${(H - CROWN - FRIEZE - 0.55).toFixed(2)}, ${(H - CROWN - FRIEZE).toFixed(2)}, vWpW.y));
    macro *= mix(1.0, 0.75, 1.0 - smoothstep(${(DADO).toFixed(2)}, ${(DADO + 0.3).toFixed(2)}, vWpW.y));
    // the vertical room corners
    float cx = min(vWpW.x - (${X0.toFixed(2)}), ${X1.toFixed(2)} - vWpW.x), cz = min(vWpW.z - (${Z0.toFixed(2)}), ${Z1.toFixed(2)} - vWpW.z);
    macro *= mix(0.7, 1.0, smoothstep(0.0, 0.5, min(cx, cz)));
    // sun-faded near the bay
    float fade = smoothstep(2.2, 0.0, vWpW.z - (${Z0.toFixed(2)})) * 0.5;
    vec3 faded = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.33))) * vec3(0.95, 0.98, 1.08), 0.5) * 1.15;
    diffuseColor.rgb = mix(diffuseColor.rgb, faded, fade);
    diffuseColor.rgb *= macro;
  }`);
    };
    const parquet = M.create('parquet', { species: 'walnut', ratio: 5, planksAcross: 2, repeat: [0.9, 0.9], polish: 0.7, wear: 0.35 });
    {
      // a quieter herringbone: rift-sawn walnut with fine straight grain (no cartoon swirls), each plank
      // its own tone, waxed with a patchy sheen that breaks the reflections up
      const pq = ctx.textures.generate('music:parquet2', {
        size: hq ? 2048 : 1024, normalStrength: 0.9,
        glsl: /* glsl */ `
vec4 herring(vec2 p, float L, float N, out vec2 id) {
  vec2 c = floor(p);
  float xr = c.x - c.y;
  float m = mod(xr, 2.0 * L);
  float sIdx = floor(xr / (2.0 * L));
  if (m < L) {
    float x0 = c.x - m;
    id = vec2(mod(sIdx, N) * 131.0 + mod(c.y, L * N), 1.0);
    return vec4((p.x - x0) / L, fract(p.y), 0.0, 0.0);
  } else {
    float j = m - L; float k = c.y + j; float y0 = k + 1.0 - L;
    id = vec2(mod(sIdx, N) * 131.0 + mod(k, L * N), 2.0);
    return vec4((p.y - y0) / L, fract(p.x), 1.0, 0.0);
  }
}
void surface(vec2 uv, inout Surface s) {
  float L = 5.0, N = 2.0;
  float span = 1.41421356 * L * N;
  vec2 p = rot2(PI * 0.25) * (uv * span);
  vec2 id;
  vec4 h = herring(p + 1e-4, L, N, id);
  vec2 q = h.xy;
  float seed = id.x * 1.13 + id.y * 17.0;
  vec2 off = hash22(vec2(seed, seed * 3.1)) * 50.0;
  vec2 g = vec2(q.x * L, q.y);
  float wob = gnoise(g * vec2(0.3, 0.6) + off, vec2(1000.0)) * 0.08;
  float y = q.y + wob;
  float lines = smoothstep(0.35, 1.0, sin((y * 7.0 + hash11(seed) * 3.0) * 6.2831) * 0.5 + 0.5) * 0.5
              + smoothstep(0.6, 1.0, sin((y * 19.0 + hash11(seed + 1.0) * 5.0) * 6.2831) * 0.5 + 0.5) * 0.3;
  float streak = gnoise(g * vec2(0.5, 14.0) + off, vec2(1000.0)) * 0.5 + 0.5;
  vec3 early = vec3(0.36, 0.23, 0.14), late = vec3(0.25, 0.15, 0.09);
  vec3 col = mix(early, late, clamp(lines * 0.7 + (streak - 0.5) * 0.35, 0.0, 1.0));
  float pore = step(0.94, hash12(floor(g * vec2(26.0, 80.0)) + off));
  col = mix(col, late * 0.6, pore * 0.35);
  // per-plank tone: three families of boards (sapwood-pale, honey, deep)
  float t = hash11(seed * 3.7);
  col *= t < 0.2 ? 1.12 : (t < 0.75 ? 0.95 + 0.1 * hash11(seed * 9.1) : 0.78);
  float ex = min(q.x, 1.0 - q.x) * L, ey = min(q.y, 1.0 - q.y);
  float e = min(ex, ey);
  float gapM = smoothstep(0.012, 0.03, e), bev = smoothstep(0.03, 0.09, e);
  col *= mix(0.22, 1.0, gapM);
  // wax: patchy sheen, duller in the traffic, buffed where nobody walks
  float wax = fbm(uv * 5.0, vec2(5.0), 4) * 0.5 + 0.5;
  float w = smoothstep(0.35, 0.85, fbm(uv + 3.0, vec2(3.0), 4) * 0.5 + 0.5) * 0.3;
  col = mix(col, col * 1.1 + 0.015, w * 0.5);
  s.albedo = col;
  s.height = 0.55 * bev + 0.45 * gapM - 0.04 * pore + lines * 0.015;
  s.rough = 0.24 + 0.22 * wax + w * 0.3 + pore * 0.15 + (1.0 - gapM) * 0.4;
  s.metal = 0.0;
  s.ao = mix(0.4, 1.0, bev);
}`,
      }).withRepeat(0.9, 0.9);
      for (const k of ['map', 'normalMap', 'roughnessMap']) parquet[k] = pq[k];
      if (parquet.metalnessMap) parquet.metalnessMap = pq.metalnessMap;
      if (parquet.aoMap) parquet.aoMap = pq.aoMap;
      parquet.needsUpdate = true;
    }
    const ebony = M.create('ebony', { repeat: [2, 2], color: [0.55, 0.55, 0.6], clearcoat: 1.0, clearcoatRoughness: 0.06, roughness: 0.6 });
    const mahogany = M.create('mahogany', { repeat: [1.2, 1.2] });
    // (satin, not gloss: a sharp clearcoat on the panel bevels mirrored the bright bay as white slits)
    const panelWood = M.create('wood', { species: 'mahogany', boards: 0, polish: 0.6, wear: 0.35, figure: 0.7, repeat: [1.2, 1.2], clearcoat: 0.2, clearcoatRoughness: 0.5, envMapIntensity: 0.5, color: [0.46, 0.44, 0.46] });
    const celloWood = M.create('wood', { species: 'mahogany', boards: 0, polish: 0.7, figure: 0.8, repeat: [1, 1], clearcoat: 0.45, clearcoatRoughness: 0.18, envMapIntensity: 0.18, color: [1.1, 0.55, 0.28] });
    const harpWood = M.create('walnut', { repeat: [2, 2], color: [1.0, 0.85, 0.7] });
    const plaster = M.create('plaster', { color: [0.3, 0.33, 0.42], cracks: 0.3, stains: 0.4, repeat: [0.45, 0.45] });
    const ceilPlaster = M.create('plaster', { color: [0.2, 0.25, 0.44], cracks: 0.25, stains: 0.5, repeat: [0.45, 0.45] });
    const ribPlaster = M.create('plaster', { color: [0.52, 0.5, 0.48], cracks: 0.2, stains: 0.6, repeat: [1.5, 1.5] });
    const crownGilt = M.create('gilded', { pattern: 0, repeats: 4, wear: 0.4, dirt: 0.55, repeat: [1 / 0.5, 1] });
    const frieze = M.create('gilded', { pattern: 6, repeats: 3, ground: 1, groundColor: [0.03, 0.04, 0.1], wear: 0.3, dirt: 0.5, repeat: [1 / 0.75, 1] });
    const giltFrame = M.create('gilded', { pattern: 1, repeats: 3, wear: 0.5, dirt: 0.7, repeat: [1 / 0.45, 1] });
    const giltFluted = M.create('gilded', { pattern: 5, repeats: 2, wear: 0.4, dirt: 0.5, repeat: [1 / 0.3, 1] });
    const giltPlain = M.create('gold', { wear: 0.5, dirt: 0.5, repeat: [2, 1] });
    // warm gilt-bronze lacquer on the cast-iron plate
    const plateGold = new THREE.MeshPhysicalMaterial({ color: 0xa8742a, metalness: 0.9, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.75 });
    // mirror-black piano lacquer: crisp streaks of the windows and candles in the room probe
    const pianoLacquer = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.08, metalness: 0, clearcoat: 1.0, clearcoatRoughness: 0.03, envMapIntensity: 1.25 });
    // quarter-sawn Cuban mahogany for the doors: dead-straight grain lines with fine pore dashes, the
    // soft ribbon stripe of quarter-sawn stock and small medullary flecks across it. The texture
    // carries its grain along v; one tile = 0.5 m, ~0.5 mm per texel. Rails get it turned 90 degrees.
    const qsTex = ctx.textures.generate('music:quartersawn', {
      size: hq ? 2048 : 1024, normalStrength: 0.35,
      glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float wav = fbm(vec2(uv.x * 3.0, uv.y * 1.0), vec2(3.0, 1.0), 3) * 0.006;
  float x = uv.x + wav;
  // growth lines: several superimposed frequencies so the spacing is irregular
  float g1 = sin(x * 6.2831 * 140.0 + fbm(vec2(uv.x * 20.0, uv.y * 2.0), vec2(20.0, 2.0), 3) * 2.5);
  float g2 = sin(x * 6.2831 * 330.0 + fbm(vec2(uv.x * 40.0, uv.y * 3.0), vec2(40.0, 3.0), 2) * 3.0);
  float lines = smoothstep(0.55, 1.0, g1) * 0.6 + smoothstep(0.7, 1.0, g2) * 0.4;
  // ribbon stripe: broad light/dark bands along the grain that change with the light
  float ribbon = sin(x * 6.2831 * 14.0 + fbm(vec2(uv.x * 4.0, uv.y * 1.0), vec2(4.0, 1.0), 3) * 1.6);
  // pores: short dark dashes along the grain
  float pore = smoothstep(0.78, 0.95, vnoise(vec2(uv.x * 900.0, uv.y * 60.0), vec2(900.0, 60.0)));
  // medullary flecks: small lens-shaped flecks lying across the grain
  float fl = smoothstep(0.86, 0.97, vnoise(vec2(uv.x * 70.0, uv.y * 260.0), vec2(70.0, 260.0)));
  vec3 dark = vec3(0.21, 0.075, 0.04), mid = vec3(0.33, 0.13, 0.07), light = vec3(0.42, 0.18, 0.1);
  vec3 c = mix(mid, light, 0.5 + 0.35 * ribbon);
  c = mix(c, dark, lines * 0.55);
  c = mix(c, dark * 0.7, pore * 0.5);
  c = mix(c, light * 1.12, fl * 0.35);
  c *= 0.9 + 0.12 * fbm(uv * 2.0, vec2(2.0), 3);
  s.albedo = c;
  s.height = 0.5 - 0.04 * lines - 0.12 * pore + 0.03 * fl;
  s.rough = 0.38 + 0.12 * lines + 0.2 * pore - 0.08 * fl;
  s.metal = 0.0; s.ao = 1.0;
}`,
    });
    const doorWoodOf = (rot) => {
      const t = qsTex.withRepeat(2, 2, rot);
      return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1.0, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.4, normalScale: new THREE.Vector2(0.6, 0.6) });
    };
    const doorWoodV = doorWoodOf(0);
    const doorWoodH = doorWoodOf(Math.PI / 2);
    // deep navy silk velvet: almost black where it faces you, a saturated blue-violet sheen
    // rolling over the fold crests (no grey specular: that is what made it read as plastic)
    // deep wine silk velvet: near-black in the hollows, a saturated crimson sheen rolling over every fold crest
    // (M.create ignores array colours for its material multiplier, so tint the woods directly: a deep,
    // desaturated mahogany toward #4a2216 rather than the raw orange-red of the generator)
    panelWood.color.setRGB(0.5, 0.46, 0.46);
    const velvet = M.create('velvet', { color: [0.05, 0.004, 0.009], crush: 0.45, repeat: [2, 2], side: THREE.DoubleSide });
    velvet.sheen = 1.0; velvet.sheenRoughness = 0.4; velvet.sheenColor = new THREE.Color().setRGB(0.78, 0.07, 0.1);
    // velvet has almost no specular: the pile scatters it into the sheen. (With the texture's roughness map
    // and a dielectric F0 the folds mirrored the bright bay as pale blue-grey satin.)
    velvet.roughnessMap = null; velvet.roughness = 1.0; velvet.metalnessMap = null; velvet.metalness = 0; velvet.envMapIntensity = 0.06; velvet.specularIntensity = 0.04;
    const seatVelvet = M.create('velvet', { color: [0.3, 0.04, 0.06], crush: 0.4, repeat: [3, 3] });
    // a deep crimson sheen (the default pale sheen turned the bench cushion into a lilac slab under the moon)
    seatVelvet.sheen = 0.8; seatVelvet.sheenRoughness = 0.5; seatVelvet.sheenColor = new THREE.Color().setRGB(0.42, 0.04, 0.06); seatVelvet.specularIntensity = 0.06; seatVelvet.envMapIntensity = 0.1; seatVelvet.roughnessMap = null; seatVelvet.roughness = 1; seatVelvet.metalnessMap = null; seatVelvet.metalness = 0;
    const brass = M.create('brass', { tarnish: 0.35, polish: 0.7, repeat: [2, 2] });
    const glassMat = M.create('glass', { dirt: 0.5, transparent: true, opacity: 0.12 });
    // old crown glass in the sashes: faint horizontal waviness (drawn-glass ripple) so the room's
    // candles and the gasolier swim across the panes as soft reflections
    const ripple = ctx.textures.generate('music:oldglass', {
      size: 512, normalStrength: 0.6,
      glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float h = fbm(vec2(uv.x * 2.0, uv.y * 14.0), vec2(2.0, 14.0), 4) * 0.7 + fbm(uv * 6.0, vec2(6.0), 3) * 0.3;
  s.albedo = vec3(1.0); s.height = 0.5 + 0.5 * h; s.rough = 0.05; s.metal = 0.0; s.ao = 1.0;
}`,
    });
    const winGlass = new THREE.MeshPhysicalMaterial({ color: 0xdfe6f0, transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0, envMapIntensity: 1.6, specularIntensity: 1, normalMap: ripple.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), depthWrite: false });
    // Nero Marquina: thin, directional, low-contrast veins in a deep black, polished to catch the fire
    const marble = M.create('marble', { type: 'nero', vein: [0.55, 0.52, 0.47], vein2: [0.16, 0.15, 0.14], scale: 2.6, polish: 0.92, repeat: [1.2, 1.2] });
    if (marble.isMeshPhysicalMaterial) { marble.clearcoat = 0.8; marble.clearcoatRoughness = 0.08; }
    const iron = M.basic('iron', { color: 0x060505, roughness: 0.9, metalness: 0.6 });
    const crystal = M.basic('crystal');
    // an old Kashan in deep oxblood and indigo, its ivory and gold dulled with age (the value is
    // held well below the piano and the ghost; only the moonlight lifts it)
    const rugMat = M.create('rug', {
      palette: 'kashan', aspect: 4.0 / 5.4, knots: 520, wear: 0.55, fringe: 0.03, seed: 7, size: hq ? 2048 : 1536,
      colors: { field: [0.19, 0.03, 0.038], border: [0.035, 0.04, 0.1], ivory: [0.42, 0.36, 0.28], gold: [0.33, 0.22, 0.1], teal: [0.07, 0.13, 0.18], dark: [0.028, 0.02, 0.026], rose: [0.3, 0.1, 0.11] },
    });
    rugMat.roughness = 1.0; rugMat.envMapIntensity = 0.2;
    // the carpet itself is an offline 2K design (tools/genRug.py): a full border hierarchy round a
    // lattice field and a lobed medallion, abrash banding, knot grain and a pile normal map
    try {
      const L = new THREE.TextureLoader();
      const [rmap, rnrm] = await Promise.all(['rug.jpg', 'rug_n.jpg'].map((f) => L.loadAsync(ctx.assetUrl(f))));
      rmap.colorSpace = THREE.SRGBColorSpace;
      for (const t of [rmap, rnrm]) { t.anisotropy = 16; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
      rugMat.map = rmap; rugMat.normalMap = rnrm; rugMat.normalScale = new THREE.Vector2(0.8, 0.8);
      rugMat.roughnessMap = null; rugMat.metalnessMap = null; rugMat.metalness = 0;
      rugMat.color.setRGB(0.82, 0.8, 0.8);
      if ('sheen' in rugMat) { rugMat.sheen = 0.5; rugMat.sheenRoughness = 0.6; rugMat.sheenColor = new THREE.Color(0.4, 0.28, 0.24); }
      rugMat.needsUpdate = true;
    } catch (e) { console.warn('music rug', e); }
    for (const m of [rugMat, parquet]) for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k].anisotropy = 16; }
    {
      // wear + dirt darkening toward the edges (trodden, never beaten), as an AO map
      const wearTex = ctx.textures.canvas('music:rugwear', 256, 256, (g2, w, h) => {
        g2.fillStyle = '#fff'; g2.fillRect(0, 0, w, h);
        const gr = g2.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w * 0.72);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
        g2.fillStyle = gr; g2.fillRect(0, 0, w, h);
      }, { tile: false, srgb: false });
      rugMat.aoMap = wearTex; rugMat.aoMapIntensity = 1.0; rugMat.needsUpdate = true;
    }
    const bookMats = [0, 1, 2].map((i) => M.create('books', { count: 34, seed: 30 + i, fill: 0.92, repeat: [1, 1] }));

    // ================================================================ shell
    const floor = new THREE.Mesh(G.planeUV(W, D, 1), parquet);
    floor.name = 'floor';
    floor.rotation.x = -Math.PI / 2;
    add(floor);
    const ceil = new THREE.Mesh(G.planeUV(W, D, 1), ceilPlaster);
    ceil.name = 'ceiling';
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H;
    add(ceil);

    const upperH = H - DADO;
    const winOpenings = WIN.xs.map((x) => ({ x: x - X0 - WIN.w / 2, y: WIN.sill - DADO, w: WIN.w, h: WIN.h, arch: true }));
    const back = new THREE.Mesh(G.wallWithOpenings(W, upperH, winOpenings, { uvScale: 1 }), wallpaper);
    back.position.set(X0, DADO, Z0); add(back);
    const left = new THREE.Mesh(G.planeUV(D, upperH, 1), wallpaper);
    left.rotation.y = Math.PI / 2; left.position.set(X0, DADO + upperH / 2, 0); add(left);
    const right = new THREE.Mesh(G.planeUV(D, upperH, 1), wallpaper);
    right.rotation.y = -Math.PI / 2; right.position.set(X1, DADO + upperH / 2, 0); add(right);
    const front = new THREE.Mesh(G.wallWithOpenings(W, upperH, [{ x: W / 2 + DOOR.x - DOOR.w / 2, y: -1, w: DOOR.w, h: DOOR.h - DADO + 1 }], { uvScale: 1 }), wallpaper);
    front.rotation.y = Math.PI; front.position.set(X1, DADO, Z1); add(front);

    // window reveals, sills, sashes, glass
    // the view in three parallax layers: sky (far), lawn + folly + treeline (mid), a bare tree (near)
    const night = nightLayers(ctx.textures);
    for (const t of [night.sky.map, night.mid.map, night.near.map]) t.anisotropy = 8;
    // the sky is an offline plate (tools/genSky.py, 4096 x 2560): back-lit cloud banks with silver
    // linings, a large moon with a soft halo; the procedural one is the fallback
    let skyTex = night.sky.map;
    try {
      skyTex = await new THREE.TextureLoader().loadAsync(ctx.assetUrl('sky.jpg'));
      skyTex.colorSpace = THREE.SRGBColorSpace; skyTex.anisotropy = 8;
    } catch (e) { console.warn('music sky plate', e); }
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, color: new THREE.Color(1, 1, 1).multiplyScalar(2.6), toneMapped: false });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(18, 11.25), skyMat);
    sky.position.set(-0.5, 3.2, Z0 - 7.0);
    add(sky);
    const midMat = new THREE.MeshBasicMaterial({ map: night.mid.map, color: new THREE.Color(1, 1, 1).multiplyScalar(2.6), transparent: true, alphaTest: 0.02, depthWrite: false, toneMapped: false });
    const midL = new THREE.Mesh(new THREE.PlaneGeometry(13, 5.9), midMat);
    midL.position.set(-0.2, -0.85 + 5.9 / 2, Z0 - 3.4); midL.renderOrder = 1;
    void midL;   // (the treeline + lawn now live in the sky plate; the old card's pine cones read as grey pyramids)
    const nearMat = new THREE.MeshBasicMaterial({ map: night.near.map, color: new THREE.Color(1, 1, 1), transparent: true, alphaTest: 0.05, depthWrite: false, toneMapped: false });
    const nearL = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 5.4), nearMat);
    nearL.position.set(0.0, 2.3, Z0 - 1.3); nearL.renderOrder = 2;
    add(nearL);
    const sashMat = M.basic('black', { color: 0x15110f, roughness: 0.38 });
    const frostTex = ctx.textures.canvas('music:frost', 512, 1096, (g2, w, h) => {
      g2.clearRect(0, 0, w, h);
      const X = (x) => ((x + WIN.w / 2) / WIN.w) * w, Y = (y) => (1 - y / WIN.h) * h;
      let sd = 5; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      const panes = [[0, 0.7], [0.7, 1.4], [1.48, 2.1]];
      for (const [y0, y1] of panes) for (const [x0, x1] of [[-WIN.w / 2, 0], [0, WIN.w / 2]]) {
        const k = y0 < 0.1 ? 1 : y0 < 1 ? 0.6 : 0.35;
        for (const cx of [x0, x1]) {
          const gr = g2.createRadialGradient(X(cx), Y(y0), 0, X(cx), Y(y0), (x1 - x0) * w / WIN.w * 0.9 * k);
          gr.addColorStop(0, `rgba(235,242,255,${0.55 * k})`); gr.addColorStop(0.5, `rgba(225,235,255,${0.18 * k})`); gr.addColorStop(1, 'rgba(225,235,255,0)');
          g2.fillStyle = gr; g2.fillRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1));
          // dendrites: short branching strokes fanning out of the corner
          g2.strokeStyle = `rgba(240,246,255,${0.35 * k})`; g2.lineWidth = 1;
          for (let i = 0; i < 40 * k; i++) {
            let px = X(cx), py = Y(y0); const a0 = (cx === x0 ? -Math.PI / 2 : -Math.PI / 2) + (rnd() - 0.5) * 1.4 + (cx === x0 ? 0.5 : -0.5);
            let a = a0; const L = (12 + rnd() * 60) * k;
            g2.beginPath(); g2.moveTo(px, py);
            for (let s2 = 0; s2 < 6; s2++) { a += (rnd() - 0.5) * 0.6; px += Math.cos(a) * L / 6; py += Math.sin(a) * L / 6; g2.lineTo(px, py); }
            g2.stroke();
          }
        }
      }
    }, { tile: false });
    frostTex.repeat.set(1 / WIN.w, 1 / WIN.h); frostTex.offset.set(0.5, 0);
    const frostMat = new THREE.MeshStandardMaterial({ map: frostTex, transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.7, metalness: 0, color: 0xdfe8ff, emissive: new THREE.Color(0.08, 0.1, 0.15), emissiveMap: frostTex });
    for (const wx of WIN.xs) {
      const r = WIN.w / 2;
      const shape = new THREE.Shape();
      shape.moveTo(-r - 0.03, -0.02); shape.lineTo(r + 0.03, -0.02); shape.lineTo(r + 0.03, WIN.h + 0.05); shape.lineTo(-r - 0.03, WIN.h + 0.05); shape.closePath();
      const hole = new THREE.Path();
      hole.moveTo(-r, 0); hole.lineTo(-r, WIN.h - r); hole.absarc(0, WIN.h - r, r, Math.PI, 0, true); hole.lineTo(r, 0); hole.closePath();
      shape.holes.push(hole);
      const reveal = new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(shape, { depth: WIN.depth, bevelEnabled: false, curveSegments: 32 }), 1), plaster);
      reveal.position.set(wx, WIN.sill, Z0 - WIN.depth); add(reveal);
      // architrave around the opening (swept moulding)
      const archPath = [];
      archPath.push(V3(wx + r + 0.02, WIN.sill - 0.02, Z0));
      for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI; archPath.push(V3(wx + Math.cos(a) * (r + 0.02), WIN.sill + WIN.h - r + Math.sin(a) * (r + 0.02), Z0)); }
      archPath.push(V3(wx - r - 0.02, WIN.sill - 0.02, Z0));
      const archi = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.12, 0.04), archPath, { up: V3(0, 0, 1), uvScale: 1, flipOutward: true }), panelWood);
      add(archi);
      const keystone = new THREE.Mesh(new G.RoundedBoxGeometry(0.16, 0.24, 0.07, 2, 0.01), giltPlain);
      keystone.position.set(wx, WIN.sill + WIN.h + 0.06, Z0 + 0.04); add(keystone);
      const sill = new THREE.Mesh(new G.RoundedBoxGeometry(WIN.w + 0.32, 0.05, WIN.depth + 0.14, 2, 0.01), marble);
      sill.position.set(wx, WIN.sill - 0.025, Z0 - WIN.depth / 2 + 0.07); add(sill);
      // sash frame
      const win = new THREE.Group();
      win.position.set(wx, WIN.sill, Z0 - WIN.depth * 0.6);
      // slim glazing bars with a rounded (lamb's-tongue) bevel, painted
      const bar = (w, h, x, y) => { const m = new THREE.Mesh(new G.RoundedBoxGeometry(w, h, 0.045, 2, Math.min(w, h) * 0.35), sashMat); m.position.set(x, y, 0); win.add(m); };
      bar(WIN.w, 0.06, 0, 0.03);
      bar(0.026, WIN.h - r, 0, (WIN.h - r) / 2);
      for (const y of [0.7, 1.4, 1.48, 2.1 - 0.0]) bar(WIN.w, y === 1.48 ? 0.05 : 0.022, 0, y);
      bar(0.06, WIN.h - r, -r + 0.03, (WIN.h - r) / 2);
      bar(0.06, WIN.h - r, r - 0.03, (WIN.h - r) / 2);
      for (let i = 1; i < 4; i++) {
        const a = Math.PI * (i / 4);
        const m = new THREE.Mesh(new G.RoundedBoxGeometry(0.02, r, 0.035, 2, 0.007), sashMat);
        m.position.set(Math.cos(a) * r * 0.5, WIN.h - r + Math.sin(a) * r * 0.5, 0); m.rotation.z = a - Math.PI / 2; win.add(m);
      }
      const arc = new THREE.Mesh(new THREE.TorusGeometry(r - 0.03, 0.03, 6, 32, Math.PI), sashMat);
      arc.position.set(0, WIN.h - r, 0); win.add(arc);
      const arc2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.45, 0.013, 8, 24, Math.PI), sashMat);
      arc2.position.set(0, WIN.h - r, 0); win.add(arc2);
      const gs = new THREE.Shape();
      gs.moveTo(-r, 0); gs.lineTo(-r, WIN.h - r); gs.absarc(0, WIN.h - r, r, Math.PI, 0, true); gs.lineTo(r, 0); gs.closePath();
      const glass = new THREE.Mesh(new THREE.ShapeGeometry(gs, 32), winGlass);
      glass.position.z = 0.012; glass.userData.noShadow = true; win.add(glass);
      // hoar frost creeping in from the bottom corners of each pane (catches the moon, dims the view)
      const frost = new THREE.Mesh(new THREE.ShapeGeometry(gs, 32), frostMat);
      frost.position.z = 0.016; frost.renderOrder = 3; frost.userData.noShadow = true; win.add(frost);
      add(win);
    }

    // ================================================================ mouldings
    const loop = (y) => [V3(X0, y, Z0), V3(X1, y, Z0), V3(X1, y, Z1), V3(X0, y, Z1)];
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(CROWN, 0.22), loop(H - CROWN), { closed: true, uvScale: 1 }), crownGilt));
    add(new THREE.Mesh(G.sweepProfile([new THREE.Vector2(0.006, 0), new THREE.Vector2(0.006, FRIEZE)], loop(H - CROWN - FRIEZE), { closed: true, uvScale: 1 }), frieze));
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.04, 0.025), loop(H - CROWN - FRIEZE - 0.04), { closed: true, uvScale: 2 }), giltPlain));
    // ceiling: sunken panel outlined with a gilt bead, and a rose
    {
      const inset = 0.75, y = H - 0.004;
      const path = [V3(X0 + inset, y, Z0 + inset), V3(X1 - inset, y, Z0 + inset), V3(X1 - inset, y, Z1 - inset), V3(X0 + inset, y, Z1 - inset)];
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.07, 0.035).map((p) => new THREE.Vector2(p.x, p.y)), path, { closed: true, up: V3(0, -1, 0), uvScale: 2 }), giltPlain));
      const rose = new THREE.Mesh(G.latheFromProfile([[0.0, 0], [0.55, 0], [0.55, -0.02], [0.48, -0.035], [0.4, -0.03], [0.3, -0.06], [0.16, -0.07], [0.07, -0.1], [0.0, -0.11]], 48), giltPlain);
      rose.position.set(-0.5, H, -0.6); add(rose);
      // coffered field: moulded ribs dividing the sunk panel into a 3 x 4 grid, gilt fillets, bosses
      const ribH = 0.1, ribW = 0.14;
      const xa = X0 + inset, xb = X1 - inset, za = Z0 + inset, zb = Z1 - inset;
      const ribs = [];
      for (let i = 1; i < 3; i++) ribs.push(['x', xa + (xb - xa) * (i / 3)]);
      for (let j = 1; j < 4; j++) ribs.push(['z', za + (zb - za) * (j / 4)]);
      for (const [axis, v] of ribs) {
        const len = axis === 'x' ? zb - za : xb - xa;
        const r = new THREE.Mesh(G.boxUV(axis === 'x' ? ribW : len, ribH, axis === 'x' ? len : ribW, 1), ribPlaster);
        r.position.set(axis === 'x' ? v : (xa + xb) / 2, H - ribH / 2, axis === 'x' ? (za + zb) / 2 : v); add(r);
        for (const sgn of [-1, 1]) {
          const f = new THREE.Mesh(G.boxUV(axis === 'x' ? 0.014 : len, 0.014, axis === 'x' ? len : 0.014, 2), giltPlain);
          f.position.set(axis === 'x' ? v + sgn * (ribW / 2 + 0.004) : (xa + xb) / 2, H - 0.012, axis === 'x' ? (za + zb) / 2 : v + sgn * (ribW / 2 + 0.004)); add(f);
        }
      }
      const boss = G.latheFromProfile([[0, 0], [0.09, 0], [0.085, -0.02], [0.05, -0.04], [0.02, -0.06], [0, -0.065]], 20);
      for (let i = 1; i < 3; i++) for (let j = 1; j < 4; j++) {
        const x = xa + (xb - xa) * (i / 3), z = za + (zb - za) * (j / 4);
        if (Math.hypot(x + 0.5, z + 0.6) < 0.7) continue;
        const b = new THREE.Mesh(boss, giltPlain); b.position.set(x, H - ribH, z); add(b);
      }
      // a frame of egg-and-dart around the sunk field
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.12, 0.1), [V3(xa, H - 0.12, za), V3(xb, H - 0.12, za), V3(xb, H - 0.12, zb), V3(xa, H - 0.12, zb)], { closed: true, uvScale: 1 }), crownGilt));
    }
    // chair rail + skirting, open at the door
    const dl = DOOR.x - DOOR.w / 2 - 0.16, dr = DOOR.x + DOOR.w / 2 + 0.16;
    const fA = FIRE.z + 0.86, fB = FIRE.z - 0.86;   // the chimneypiece interrupts the left-wall rails
    const chairPaths = [
      [V3(dl, DADO - 0.05, Z1), V3(X0, DADO - 0.05, Z1), V3(X0, DADO - 0.05, fA)],
      [V3(X0, DADO - 0.05, fB), V3(X0, DADO - 0.05, Z0), V3(X1, DADO - 0.05, Z0), V3(X1, DADO - 0.05, Z1), V3(dr, DADO - 0.05, Z1)],
    ];
    for (const cp of chairPaths) {
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.08, 0.04), cp, { uvScale: 1 }), panelWood));
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.baseboard(0.24, 0.03), cp.map((p) => V3(p.x, 0, p.z)), { uvScale: 1 }), panelWood));
    }
    // wainscot with raised panels
    {
      const panelGeo = G.raisedPanel(0.62, 0.56, { border: 0.075, bevel: 0.035, fieldDepth: 0.02, frameDepth: 0.024 });
      // an ogee bolection moulding standing proud round each field (the panel reads ~20 mm deep)
      const bolGeo = G.frameGeometry(0.6, 0.54, { width: 0.032, depth: 0.026, uvScale: 1 });
      const run = (x0, x1, z, rotY, skip = []) => {
        const len = Math.abs(x1 - x0);
        const mid = (x0 + x1) / 2;
        const pos = rotY === 0 || Math.abs(rotY) === Math.PI ? V3(mid, (DADO - 0.05) / 2, z) : V3(z, (DADO - 0.05) / 2, mid);
        const b = new THREE.Mesh(G.boxUV(len, DADO - 0.05, 0.02, 1), panelWood);
        b.position.copy(pos); b.rotation.y = rotY; add(b);
        const n = Math.max(1, Math.round(len / 0.78));
        for (let i = 0; i < n; i++) {
          const off = -len / 2 + (len / n) * (i + 0.5);
          if (skip.some(([a, c]) => off + mid > a && off + mid < c)) continue;
          const p = new THREE.Mesh(panelGeo, panelWood);
          const local = V3(off, 0.5 - (DADO - 0.05) / 2, 0.01).applyAxisAngle(V3(0, 1, 0), rotY);
          p.position.copy(pos).add(local); p.rotation.y = rotY;
          p.scale.set((len / n - 0.12) / 0.62, 1, 1);
          add(p);
          const bo = new THREE.Mesh(bolGeo, panelWood);
          bo.position.copy(p.position).add(V3(0, 0, 0.012).applyAxisAngle(V3(0, 1, 0), rotY)); bo.rotation.y = rotY; bo.scale.set((len / n - 0.12) / 0.62, 1, 1);
          add(bo);
        }
      };
      run(X0, X1, Z0 + 0.01, 0);
      run(Z0, fB, X0 + 0.01, Math.PI / 2);
      run(fA, Z1, X0 + 0.01, Math.PI / 2);
      run(Z0, Z1, X1 - 0.01, -Math.PI / 2);
      // front wall (two runs beside the door)
      const fb = (xa, xb) => { const b = new THREE.Mesh(G.boxUV(xb - xa, DADO - 0.05, 0.02, 1), panelWood); b.position.set((xa + xb) / 2, (DADO - 0.05) / 2, Z1 - 0.01); add(b); };
      fb(X0, dl); fb(dr, X1);
      // raised, bolection-moulded panels on the door wall too
      for (const [xa, xb] of [[X0, dl], [dr, X1]]) {
        const len = xb - xa, n = Math.max(1, Math.round(len / 0.78));
        for (let i = 0; i < n; i++) {
          const cx = xa + (len / n) * (i + 0.5);
          const p = new THREE.Mesh(panelGeo, panelWood);
          p.position.set(cx, 0.5, Z1 - 0.02); p.rotation.y = Math.PI; p.scale.set((len / n - 0.12) / 0.62, 1, 1); add(p);
          const bo = new THREE.Mesh(bolGeo, panelWood);
          bo.position.set(cx, 0.5, Z1 - 0.032); bo.rotation.y = Math.PI; bo.scale.set((len / n - 0.12) / 0.62, 1, 1); add(bo);
        }
      }
    }
    // pilasters between the windows: fluted gilt shafts on a panelled base
    for (const px of [-3.55, -1.175, 1.175, 3.55]) {
      const shaftH = H - CROWN - FRIEZE - DADO - 0.2;
      const shaft = new THREE.Mesh(G.boxUV(0.26, shaftH, 0.06, 1), panelWood);
      shaft.position.set(px, DADO + 0.1 + shaftH / 2, Z0 + 0.03); add(shaft);
      const sp = new THREE.Mesh(G.raisedPanel(0.18, shaftH - 0.16, { border: 0.03, bevel: 0.015, fieldDepth: 0.008 }), panelWood);
      sp.position.set(px, DADO + 0.1 + shaftH / 2, Z0 + 0.06); add(sp);
      const bead = new THREE.Mesh(G.frameGeometry(0.15, shaftH - 0.2, { width: 0.008, depth: 0.008, uvScale: 2 }), giltPlain);
      bead.position.set(px, DADO + 0.1 + shaftH / 2, Z0 + 0.075); add(bead);
      const back2 = new THREE.Mesh(G.boxUV(0.34, shaftH + 0.1, 0.03, 1), panelWood);
      back2.position.set(px, DADO + 0.05 + shaftH / 2, Z0 + 0.015); add(back2);
      const cap = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.14, 0.06), [V3(px - 0.2, H - CROWN - FRIEZE - 0.14, Z0), V3(px - 0.2, H - CROWN - FRIEZE - 0.14, Z0 + 0.06), V3(px + 0.2, H - CROWN - FRIEZE - 0.14, Z0 + 0.06), V3(px + 0.2, H - CROWN - FRIEZE - 0.14, Z0)], { uvScale: 1 }), giltPlain);
      add(cap);
      const base = new THREE.Mesh(new G.RoundedBoxGeometry(0.38, 0.14, 0.09, 2, 0.01), panelWood);
      base.position.set(px, DADO + 0.04, Z0 + 0.045); add(base);
    }

    // ================================================================ door (front wall)
    // a pair of six-panel mahogany doors: real stiles and rails (grain running along
    // each member), sunk fielded panels inside bolection mouldings with a gilt bead,
    // brass butt hinges, an escutcheon with lever handles, a meeting astragal.
    {
      const door = new THREE.Group();
      const lw = DOOR.w / 2 - 0.006, T = 0.055, st = 0.13;
      for (const s of [-1, 1]) {
        const leaf = new THREE.Group();
        leaf.position.set(s * (lw / 2 + 0.003), 0, 0);
        const box = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(G.boxUV(w, h, d, 1), mat); m.position.set(x, y, z); leaf.add(m); return m; };
        box(st, DOOR.h, T, -lw / 2 + st / 2, DOOR.h / 2, 0, doorWoodV);
        box(st, DOOR.h, T, lw / 2 - st / 2, DOOR.h / 2, 0, doorWoodV);
        const iw = lw - 2 * st;
        const rails = [[0.13, 0.26], [1.02, 0.2], [1.9, 0.14], [DOOR.h - 0.08, 0.16]];
        for (const [y, h] of rails) box(iw, h, T, 0, y, 0, doorWoodH);
        // panel backing (sunk below the frame face)
        box(iw, DOOR.h - 0.1, 0.02, 0, DOOR.h / 2, -0.012, doorWoodV);
        const panels = [[0.26, 0.89], [1.12, 1.83], [1.97, DOOR.h - 0.16]];
        for (const [y0, y1] of panels) {
          const ph = y1 - y0, cy = (y0 + y1) / 2;
          const p = new THREE.Mesh(G.raisedPanel(iw - 0.02, ph - 0.02, { border: 0.08, bevel: 0.045, fieldDepth: 0.016 }), doorWoodV);
          p.position.set(0, cy, -0.006); leaf.add(p);
          const bol = new THREE.Mesh(G.frameGeometry(iw - 0.01, ph - 0.01, { width: 0.062, depth: 0.046, uvScale: 1 }), doorWoodH);   // deep bolection
          bol.position.set(0, cy, T / 2 - 0.012); leaf.add(bol);
          // a fine quirk bead inside the bolection, in the same mahogany (no gilt: it read as a glowing outline)
          const bead = new THREE.Mesh(G.frameGeometry(iw - 0.1, ph - 0.1, { width: 0.009, depth: 0.008, uvScale: 2 }), doorWoodH);
          bead.position.set(0, cy, T / 2 - 0.006); leaf.add(bead);
        }
        // hinges on the outer edge: cast-brass butt hinges, a barrel of five knuckles (alternate ones on the
        // frame and the leaf, hairline gaps between), the leaf plate let into the stile with three screws,
        // a steeple finial at each end of the pin
        for (const y of [0.32, 1.45, 2.6]) {
          const hx = s * (lw / 2 + 0.006), hz = T / 2 + 0.002;
          const KN = 5, KH = 0.026, GAP = 0.0015;
          for (let k = 0; k < KN; k++) {
            const kn = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.0085, 0], [0.0095, 0.002], [0.0095, KH - 0.002], [0.0085, KH], [0, KH]], 16), brass);
            kn.position.set(hx, y - (KN * (KH + GAP)) / 2 + k * (KH + GAP), hz); leaf.add(kn);
          }
          for (const e of [-1, 1]) {
            const fin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.0075, 0], [0.006, 0.004], [0.0035, 0.009], [0.002, 0.014], [0, 0.017]], 12), brass);
            fin.position.set(hx, y + e * (KN * (KH + GAP)) / 2, hz); if (e < 0) fin.rotation.x = Math.PI; leaf.add(fin);
          }
          const leafPl = new THREE.Mesh(new G.RoundedBoxGeometry(0.05, KN * (KH + GAP) - 0.004, 0.003, 2, 0.001), brass);
          leafPl.position.set(hx - s * 0.03, y, T / 2 + 0.0005); leaf.add(leafPl);
          for (let k = -1; k <= 1; k++) {
            const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 10), brass);
            sc.rotation.x = Math.PI / 2; sc.position.set(hx - s * 0.035, y + k * 0.04, T / 2 + 0.0025); leaf.add(sc);
          }
        }
        // meeting edge: escutcheon plate, lever handle, keyhole
        const ex = -s * (lw / 2 - 0.065);
        const plate = new THREE.Mesh(new G.RoundedBoxGeometry(0.055, 0.24, 0.008, 2, 0.004), brass);
        plate.position.set(ex, 1.02, T / 2 + 0.004); leaf.add(plate);
        const rose = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.022, 0], [0.018, 0.01], [0.01, 0.016], [0, 0.018]], 16), brass);
        rose.rotation.x = Math.PI / 2; rose.position.set(ex, 1.07, T / 2 + 0.008); leaf.add(rose);
        const lever = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(ex, 1.07, T / 2 + 0.02), V3(ex, 1.07, T / 2 + 0.055), V3(ex + s * 0.05, 1.065, T / 2 + 0.065), V3(ex + s * 0.11, 1.055, T / 2 + 0.06)]), 16, 0.0065, 8), brass);
        leaf.add(lever);
        const kh = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12), M.basic('black'));
        kh.position.set(ex, 0.97, T / 2 + 0.0085); leaf.add(kh);
        const kh2 = new THREE.Mesh(new THREE.PlaneGeometry(0.005, 0.016), M.basic('black'));
        kh2.position.set(ex, 0.96, T / 2 + 0.0085); leaf.add(kh2);
        door.add(leaf);
      }
      const astragal = new THREE.Mesh(new G.RoundedBoxGeometry(0.03, DOOR.h - 0.02, 0.02, 2, 0.008), doorWoodV);
      astragal.position.set(0, DOOR.h / 2, T / 2 + 0.006); door.add(astragal);
      const casing = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.16, 0.05), [
        V3(-DOOR.w / 2 - 0.08, 0, 0), V3(-DOOR.w / 2 - 0.08, DOOR.h + 0.08, 0), V3(DOOR.w / 2 + 0.08, DOOR.h + 0.08, 0), V3(DOOR.w / 2 + 0.08, 0, 0),
      ], { up: V3(0, 0, 1), uvScale: 1, flipOutward: true }), doorWoodV);
      door.add(casing);
      for (const sx of [-1, 1]) {
        const plinth = new THREE.Mesh(new G.RoundedBoxGeometry(0.2, 0.3, 0.07, 2, 0.008), doorWoodV);
        plinth.position.set(sx * (DOOR.w / 2 + 0.08), 0.15, 0.02); door.add(plinth);
      }
      // reveal (jamb lining) so the opening has depth
      for (const sx of [-1, 1]) { const j = new THREE.Mesh(G.boxUV(0.03, DOOR.h, 0.2, 1), doorWoodV); j.position.set(sx * (DOOR.w / 2 + 0.015), DOOR.h / 2, -0.08); door.add(j); }
      const pediment = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.2, 0.12), [V3(-DOOR.w / 2 - 0.3, DOOR.h + 0.22, -0.12), V3(-DOOR.w / 2 - 0.3, DOOR.h + 0.22, 0.0), V3(DOOR.w / 2 + 0.3, DOOR.h + 0.22, 0.0), V3(DOOR.w / 2 + 0.3, DOOR.h + 0.22, -0.12)], { uvScale: 1 }), crownGilt);
      door.add(pediment);
      const lintel = new THREE.Mesh(G.boxUV(DOOR.w + 0.5, 0.22, 0.05, 1), doorWoodH);
      lintel.position.set(0, DOOR.h + 0.21, -0.02); door.add(lintel);
      const frz = new THREE.Mesh(G.boxUV(DOOR.w + 0.3, 0.14, 0.012, 1), frieze);
      frz.position.set(0, DOOR.h + 0.2, 0.01); door.add(frz);
      door.position.set(DOOR.x, 0, Z1 - 0.03);
      door.rotation.y = Math.PI;
      door.name = 'door';
      add(door);
      // a low warm fill off the threshold (the sconces' bounce off the boards): the herringbone in
      // front of the doors reads instead of crushing to black
      const sill = new THREE.PointLight(0xffa868, 1.3, 4.0, 2);
      sill.position.set(0, 0.6, Z1 - 1.5); add(sill);
    }

    // ================================================================ curtains
    // (engine curtainGeometry can emit NaN on the heading row when y rounds above 0: patch it here)
    const curtain = (o) => {
      const g = G.curtainGeometry(o);
      const a = g.attributes.position.array;
      let bad = false;
      for (let i = 0; i < a.length; i++) if (Number.isNaN(a[i])) { a[i] = 0; bad = true; }
      if (bad) g.computeVertexNormals();
      return g;
    };
    // swag valance: a shallow festoon of velvet sagging between the pelmet corners, its folds
    // running in concentric arcs, finished with a deep bullion fringe
    const swagGeometry = (width, drop, depth, folds = 5, seg = [80, 28]) => {
      const g = new THREE.PlaneGeometry(1, 1, seg[0], seg[1]);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) + 0.5, v = 0.5 - p.getY(i);          // u across, v 0 top .. 1 hem
        const sag = drop * (0.32 + 0.68 * Math.sin(Math.PI * u));
        const y = -v * sag;
        const arc = Math.sin(Math.PI * u);
        let z = depth * arc * Math.sin(Math.PI * Math.min(1, v * 1.1)) * 0.9;
        z += 0.022 * arc * Math.cos(v * folds * Math.PI * 2) * (0.3 + 0.7 * v);   // the festoon folds
        const x = (u - 0.5) * width * (1 - 0.06 * v * arc);
        p.setXYZ(i, x, y, z);
      }
      g.computeVertexNormals();
      return g;
    };
    /*
     * A heavy velvet drape, built as a tailor would hang it: a pinch-pleated heading (a pleat every
     * ~8 cm) relaxes within ~30 cm into 5-7 deep, irregular folds of random width and depth; the
     * weight pulls them a little wider toward the hem, and the last few cm break onto the boards.
     * Optional tieback at ~1/3 height gathers the GLASS-side of the cloth toward the outer edge
     * (u = 0 stays a straight plumb line, so two drapes meeting on a pier never pinch into an
     * hourglass), the cloth blousing over the cord and flaring out again below it.
     * The top of the drape is at y = 0; the floor at y = -height.
     */
    const drapeGeometry = ({ width, height, seed = 1, folds = 6, depth = 0.11, tie = 0, tieV = 0.66, brk = 0.07, segX = 120, segY = 90 }) => {
      let sd = Math.floor(Math.abs(seed) * 7919) % 2147483646 + 1;
      const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      // irregular fold widths (normalised cumulative) and per-fold depth
      const ws = [], amps = [];
      for (let i = 0; i < folds; i++) { ws.push(0.55 + rnd() * 0.9); amps.push(0.65 + rnd() * 0.55); }
      const tot = ws.reduce((a, b) => a + b, 0);
      const edges = [0]; for (const w of ws) edges.push(edges[edges.length - 1] + w / tot);
      const foldAt = (u) => {
        let i = 0; while (i < folds - 1 && u > edges[i + 1]) i++;
        const f = (u - edges[i]) / (edges[i + 1] - edges[i]);
        // a fold is a rounded crest and a deeper, narrower valley (cloth hangs in catenary loops)
        const sgn = i % 2 ? -1 : 1;
        return sgn * amps[i] * Math.sin(f * Math.PI) * (sgn > 0 ? 1.0 : 0.85);
      };
      const len = height + brk;
      const g = new THREE.PlaneGeometry(1, 1, segX, segY);
      const p = g.attributes.position, uv = g.attributes.uv;
      const pleatN = Math.max(4, Math.round(width / 0.08));
      const ph0 = rnd() * 6.28, ph1 = rnd() * 6.28;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) + 0.5, v = 0.5 - p.getY(i);       // u 0 outer edge .. 1 glass edge, v 0 top .. 1 hem
        const yDrop = v * len;                                   // metres below the heading
        // heading: crisp pinch pleats blending into the body folds over the first ~0.3 m
        const pleat = (Math.pow(Math.abs(Math.sin(u * pleatN * Math.PI)), 0.5) - 0.6) * 0.03;
        const hb = Math.min(1, yDrop / 0.32); const blend = hb * hb * (3 - 2 * hb);
        // the folds widen slightly toward the hem (u is remapped about the centre) and wander a little
        const uu = 0.5 + (u - 0.5) * (1 - 0.06 * v) + 0.012 * Math.sin(v * 5.0 + ph0 + u * 3.0);
        const body = foldAt(Math.min(1, Math.max(0, uu))) * depth * (0.8 + 0.35 * v) + 0.006 * Math.sin(u * 37.0 + v * 9.0 + ph1);
        let z = pleat * (1 - blend) + body * blend;
        let x = (u - 0.5) * width * (1 - 0.12 * (1 - blend));    // the heading is gathered narrower
        let y = -yDrop;
        if (tie > 0) {
          const t = v < tieV ? Math.pow(v / tieV, 1.4) : 1 - 0.62 * Math.pow((v - tieV) / (1 - tieV), 0.8);
          const pull = tie * t * (v < tieV ? 1 : 1);
          // gather toward the outer edge (x = -width/2): the glass edge sweeps, the outer edge stays plumb
          x = -width / 2 + (x + width / 2) * (1 - 0.62 * pull);
          z *= 1 + 0.7 * pull;
          // the cloth blouses forward just above the cord
          const bl = Math.exp(-((v - (tieV - 0.06)) ** 2) / 0.004);
          z += 0.05 * tie * bl * Math.sin(Math.PI * Math.min(1, u * 1.1));
        }
        if (y < -height) {   // the break: the last few cm fold forward onto the floor
          const over = -height - y;
          y = -height + 0.004 + over * 0.08;
          z += over * 0.9;
        }
        p.setXYZ(i, x, y, z);
        uv.setXY(i, u * width * 0.55, (1 - v) * len * 0.55);
      }
      g.computeVertexNormals();
      return g;
    };
    const fringeMat = new THREE.MeshStandardMaterial({ color: 0x8a6a2c, roughness: 0.6, metalness: 0.4 });
    const fringeGeo = new THREE.CylinderGeometry(0.0035, 0.003, 1, 4); fringeGeo.translate(0, -0.5, 0);
    for (const wx of WIN.xs) {
      for (const side of [-1, 1]) {
        // full drapes hanging straight beside the glass (deep folds, pooled hems)
        // drawn back to a tasselled cord at two-thirds height, the hem pooling on the boards
        const CW = 0.78, cy = WIN.sill + WIN.h + 0.28, CH = cy;
        const TIE_V = 0.66;
        // only the two drapes at the ends of the bay are tied back (toward the side walls); the pairs
        // meeting on the piers hang straight in heavy columns, so no pier ever pinches into an hourglass
        const tied = Math.abs(wx) > 1 && Math.sign(wx) === side;
        const cg = drapeGeometry({ width: CW, height: CH, folds: 5 + ((wx * 3 + side + 7) % 3 + 3) % 3, depth: 0.12, tie: tied ? 1 : 0, tieV: TIE_V, seed: wx * 3 + side * 1.7 + 5 });
        const c = new THREE.Mesh(cg, velvet);
        const cx = wx + side * (WIN.w / 2 + 0.22);
        c.position.set(cx, cy, Z0 + 0.15);
        if (side > 0) c.scale.x = -1;   // outer edge (u = 0) away from the glass
        c.name = 'curtain';
        add(c);
        if (!tied) continue;
        // the tie: a twisted gold cord round the gathered drape, a brass rosette hook on the wall,
        // and a heavy bullion tassel hanging from it
        const ty = cy - TIE_V * (CH + 0.07);
        const gx = cx + side * (0.33 * CW);                // where the tieback gathers the cloth
        const cord = [];
        for (let k = 0; k <= 20; k++) { const a = (k / 20) * Math.PI; cord.push(V3(gx + side * Math.cos(a) * 0.11 - side * 0.02, ty + Math.sin(a * 2) * 0.012, Z0 + 0.15 + Math.sin(a) * 0.15)); }
        add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cord), 40, 0.009, 8), fringeMat));
        const rosette = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.035, 0], [0.032, 0.01], [0.02, 0.02], [0.0, 0.024]], 16), brass);
        rosette.rotation.x = Math.PI / 2; rosette.position.set(gx + side * 0.14, ty, Z0 + 0.03); add(rosette);
        const tassel = new THREE.Mesh(G.latheFromProfile([[0, 0.0], [0.012, 0.004], [0.022, 0.02], [0.026, 0.05], [0.03, 0.14], [0.024, 0.16], [0.012, 0.17], [0.0, 0.175]], 18), fringeMat);
        { const p = tassel.geometry.attributes.position; for (let k = 0; k < p.count; k++) { const a = Math.atan2(p.getZ(k), p.getX(k)), y = p.getY(k); const r = 1 + (y < 0.13 ? 0.08 * Math.sin(a * 22) : 0); p.setX(k, p.getX(k) * r); p.setZ(k, p.getZ(k) * r); } tassel.geometry.computeVertexNormals(); }
        tassel.rotation.x = Math.PI; tassel.position.set(gx + side * 0.13, ty - 0.02, Z0 + 0.1); add(tassel);
      }
      const VW = WIN.w + 1.0;
      const val = new THREE.Mesh(swagGeometry(VW, 0.46, 0.08, 4), velvet);
      val.position.set(wx, WIN.sill + WIN.h + 0.37, Z0 + 0.2); val.name = 'curtain'; add(val);
      // jabots (cascading tails) at each end
      for (const side of [-1, 1]) {
        const jab = new THREE.Mesh(curtain({ width: 0.24, height: 0.85, folds: 3, depth: 0.05, seed: wx + side * 7, segX: 24, segY: 20 }), velvet);
        jab.position.set(wx + side * (VW / 2 - 0.1), WIN.sill + WIN.h + 0.37, Z0 + 0.24); jab.name = 'curtain'; add(jab);
      }
      // bullion fringe along the swag hem (instanced cords)
      const NF = 110;
      const fr = new THREE.InstancedMesh(fringeGeo, fringeMat, NF);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < NF; i++) {
        const u = (i + 0.5) / NF;
        const sag = 0.46 * (0.32 + 0.68 * Math.sin(Math.PI * u));
        const zz = 0.022 * Math.sin(Math.PI * u) * Math.cos(4 * Math.PI * 2);
        const len = 0.07 + 0.01 * Math.sin(i * 12.9898);
        m4.makeScale(1, len, 1).setPosition(wx + (u - 0.5) * VW * (1 - 0.06 * Math.sin(Math.PI * u)), WIN.sill + WIN.h + 0.37 - sag + 0.004, Z0 + 0.2 + zz);
        fr.setMatrixAt(i, m4);
      }
      fr.castShadow = false; add(fr);
      // gilt curtain pole on scrolled brackets, with acorn-and-leaf finials; the swag is draped over it
      const py = WIN.sill + WIN.h + 0.42;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, VW + 0.12, 20), giltPlain);
      pole.rotation.z = Math.PI / 2; pole.position.set(wx, py, Z0 + 0.17); add(pole);
      for (const sx of [-1, 1]) {
        const fin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.03, 0], [0.034, 0.012], [0.024, 0.02], [0.04, 0.05], [0.048, 0.08], [0.036, 0.11], [0.014, 0.13], [0.02, 0.14], [0.0, 0.17]], 24), giltFluted);
        fin.rotation.z = -sx * Math.PI / 2; fin.position.set(wx + sx * (VW / 2 + 0.06), py, Z0 + 0.17); add(fin);
        const br = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0, -0.06, 0), V3(0, -0.02, 0.07), V3(0, 0.0, 0.17)]), 12, 0.012, 8), giltPlain);
        br.position.set(wx + sx * (VW / 2 - 0.04), py, Z0); add(br);
        const bp = new THREE.Mesh(new G.RoundedBoxGeometry(0.06, 0.12, 0.02, 2, 0.006), giltPlain);
        bp.position.set(wx + sx * (VW / 2 - 0.04), py - 0.05, Z0 + 0.01); add(bp);
      }
    }

    // ================================================================ rug
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 5.4), rugMat);
    rug.name = 'rug';
    rug.rotation.x = -Math.PI / 2; rug.rotation.z = 0.0; rug.position.set(-0.2, 0.0135, -0.5);
    add(rug);
    {
      // pile thickness: a bound edge under the rug face, and knotted wool fringe at both ends
      const bind = new THREE.Mesh(new G.RoundedBoxGeometry(4.02, 0.013, 5.42, 2, 0.005), new THREE.MeshPhysicalMaterial({ color: 0x2a0d0c, roughness: 0.95, sheen: 0.6, sheenColor: new THREE.Color(0.5, 0.3, 0.25) }));
      bind.position.set(-0.2, 0.0065, -0.5); bind.name = 'rug'; add(bind);
      const tGeo = new THREE.CylinderGeometry(0.0022, 0.0016, 0.075, 4); tGeo.rotateX(Math.PI / 2); tGeo.translate(0, 0, 0.0375);
      const NT = 150;
      const fringe = new THREE.InstancedMesh(tGeo, new THREE.MeshStandardMaterial({ color: 0xcfc2a2, roughness: 0.95 }), NT * 2);
      const fr = ctx.random.fork('fringe');
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      let k = 0;
      for (const end of [-1, 1]) for (let i = 0; i < NT; i++) {
        const x = -0.2 - 1.98 + (i + 0.5) * (3.96 / NT) + (fr.next() - 0.5) * 0.008;
        const z = -0.5 + end * 2.71;
        e.set(0, (end > 0 ? 0 : Math.PI) + (fr.next() - 0.5) * 0.5, 0);
        q.setFromEuler(e);
        const L = 0.75 + fr.next() * 0.45;
        m4.compose(V3(x, 0.004, z), q, V3(1, 1, L));
        fringe.setMatrixAt(k++, m4);
      }
      fringe.castShadow = false; fringe.receiveShadow = true;
      add(fringe);
    }

    // ================================================================ the grand piano + bench + ghost
    const piano = buildPiano(ctx, { ebony: pianoLacquer, brass, gold: plateGold });
    piano.position.copy(PIANO_POS);
    piano.rotation.y = PIANO_ROT;
    add(piano);
    const keys = piano.userData.keys;
    const pianoProbe = { done: false, pos: pianoToWorldEarly(piano, 1.25, 1.35, -0.5), posIn: pianoToWorldEarly(piano, 0.1, 1.08, -1.0), mats: [] };
    piano.traverse((o) => { const m = o.material; if (m && (m === pianoLacquer || m === plateGold || m.metalness > 0.8) && !pianoProbe.mats.includes(m)) pianoProbe.mats.push(m); });
    const bench = buildBench(ctx, { ebony, velvet: seatVelvet });
    bench.position.set(0, 0, 0.58);
    bench.scale.y = 0.92;   // seat top ~0.515: Kessler sits ON the cushion, his thighs clear of it
    piano.add(bench);
    const ghost = await buildGhostPianist(ctx);
    piano.add(ghost.group);
    ghost.group.userData.dynamic = true;
    keys.white.parent.updateMatrixWorld(true);
    const pianoToWorld = (x, y, z) => { piano.updateMatrixWorld(true); return piano.localToWorld(V3(x, y, z)); };

    // floor candelabrum beside the keyboard (the room's one shadowed warm light)
    const torch = buildTorchere(ctx, { brass });
    const torchPos = pianoToWorld(1.05, 0, -1.25);
    torch.position.copy(torchPos);
    add(torch);
    const torchLight = new THREE.PointLight(0xffa04e, 7.0, 10, 2);
    torchLight.position.set(torchPos.x, 1.72, torchPos.z);
    torchLight.castShadow = ctx.quality.shadows;
    torchLight.shadow.mapSize.set(1024, 1024);
    torchLight.shadow.bias = -0.003; torchLight.shadow.normalBias = 0.03; torchLight.shadow.radius = 5;
    torchLight.shadow.camera.near = 0.25;
    torchLight.shadow.camera.far = 7;
    add(torchLight);
    ghost.setFill(torchLight.position);
    piano.userData.wireU.uL1Pos.value.copy(torchLight.position);

    // a cool moonlit fill over the keyboard (window side): the ivory reads ivory rather than
    // candle-pink; brighter while the puzzle is up close
    const keyFill = new THREE.SpotLight(0xb4c6ff, 0.5, 4, 0.55, 1.0, 2);
    keyFill.position.copy(pianoToWorld(0.25, 2.3, -0.6));
    keyFill.target.position.copy(pianoToWorld(0.03, 0.74, 0.08));
    add(keyFill); add(keyFill.target);

    // ================================================================ harp, cello, stand, chair (right side, by the windows)
    const harp = buildHarp(ctx, { gilt: giltFluted, giltPlain, wood: giltPlain, box: harpWood });
    harp.position.set(2.65, 0, -3.2); harp.rotation.y = -0.75;
    harp.userData.dynamic = true;
    add(harp);
    // the right-wall sconce's warm spill finding the gilt of the harp (no shadows: cheap)
    // (one warm key for the whole harp / cello / stand group by the bay: candle-warm rims on the gilt and varnish)
    const harpKey = new THREE.SpotLight(0xffb070, 4.2, 7, 0.62, 0.8, 2);
    harpKey.position.set(1.4, 2.5, -1.2);
    harpKey.target.position.set(1.75, 0.8, -3.7);
    add(harpKey); add(harpKey.target);
    const chair = buildChair(ctx, { wood: mahogany, velvet: seatVelvet });
    chair.position.set(1.55, 0, -2.85); chair.rotation.y = 2.62;
    add(chair);
    // the cello leans against the pier beside the centre window, in the hero view between the
    // candelabrum and the bay: moonlight on its shoulder, a warm candle rim down its varnish
    const cello = buildCello(ctx, { wood: celloWood, ebony, giltPlain });
    // (stood clear of the drapes now they hang to the floor: it leans back against their folds)
    cello.position.set(0.98, 0.1, -3.93); cello.rotation.set(-0.19, -0.3, 0.05);
    cello.userData.dynamic = true;
    add(cello);
    // a small warm bounce off the parquet and the chair, from the candelabrum side, so the cello's
    // arching and varnish catch a highlight instead of reading as a flat cut-out
    const celloKey = new THREE.SpotLight(0xffa860, 2.2, 3.2, 0.5, 0.9, 2);
    celloKey.position.set(0.05, 1.45, -2.75);
    celloKey.target.position.set(0.98, 0.55, -3.95);
    add(celloKey); add(celloKey.target);
    const stand = buildMusicStand(ctx, { brass, seed: 12 });
    stand.position.set(1.95, 0, -3.55); stand.rotation.y = -0.52;
    add(stand);

    // ================================================================ fireplace wall (left)
    const fire = buildFireplace(ctx, { marble, iron, brass, gilt: giltPlain });
    fire.position.set(X0, 0, FIRE.z); fire.rotation.y = Math.PI / 2;
    add(fire);
    const fireLight = new THREE.PointLight(0xff7a2a, 3.0, 9, 2);
    fireLight.position.set(X0 + 0.85, 0.5, FIRE.z);
    add(fireLight);
    const fireInner = new THREE.PointLight(0xff6a1c, 1.6, 2.6, 2);
    fireInner.position.set(X0 + 0.16, 0.24, FIRE.z);
    add(fireInner);
    // overmantel: a composer's portrait in a heavy gilt frame
    const portrait = new THREE.Group();
    {
      const pw = 0.95, ph = 1.25;
      let ptex;
      const loader = new THREE.TextureLoader();
      let pbump = null, prough = null;
      try {
        [ptex, pbump, prough] = await Promise.all(['portrait.jpg', 'portrait_bump.png', 'portrait_rough.png'].map((f) => loader.loadAsync(ctx.assetUrl(f))));
        ptex.colorSpace = THREE.SRGBColorSpace; ptex.anisotropy = 8;
      } catch (e) { ptex = portraitTexture(ctx.textures); pbump = prough = null; }
      // aged oil on canvas: satin varnish broken up by the craquelure + weave (bump), duller in the grime
      portrait.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshPhysicalMaterial({ map: ptex, bumpMap: pbump, bumpScale: 1.2, roughnessMap: prough, roughness: 1.0, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.35 })));
      portrait.add(new THREE.Mesh(G.frameGeometry(pw, ph, { width: 0.13, depth: 0.07, uvScale: 1 }), giltFrame));
      portrait.position.set(X0 + 0.04, 2.45, FIRE.z); portrait.rotation.y = Math.PI / 2;
      portrait.userData.dynamic = true;
      add(portrait);
      const lamp = new THREE.Mesh(new G.RoundedBoxGeometry(0.075, 0.045, 0.42, 3, 0.018), brass);
      lamp.position.set(X0 + 0.2, 3.245, FIRE.z); add(lamp);
      const lampArm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(X0 + 0.01, 3.2, FIRE.z), V3(X0 + 0.12, 3.28, FIRE.z), V3(X0 + 0.2, 3.25, FIRE.z)]), 10, 0.008, 6), brass);
      add(lampArm);
      const lampGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.8, 0.5).multiplyScalar(3), toneMapped: false }));
      lampGlow.rotation.x = Math.PI / 2; lampGlow.rotation.z = Math.PI / 2; lampGlow.position.set(X0 + 0.2, 3.215, FIRE.z); add(lampGlow);
      // the picture light grazes down the canvas from close above: bright along the top of the
      // frame and the brow, falling away toward the coat (not a flat spotlight on the face)
      const picLight = new THREE.SpotLight(0xffc890, 1.5, 2.4, 0.9, 0.85, 2);
      picLight.position.set(X0 + 0.24, 3.22, FIRE.z);
      picLight.target.position.set(X0 + 0.0, 1.95, FIRE.z);
      add(picLight); add(picLight.target);
    }
    // mantel garniture: clock + candlesticks
    const mantelY = 1.31;
    {
      const clockBody = new THREE.Mesh(new G.RoundedBoxGeometry(0.3, 0.36, 0.14, 3, 0.03), marble);
      clockBody.position.set(X0 + 0.2, mantelY + 0.18, FIRE.z); add(clockBody);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.08, 32), M.basic('porcelain'));
      face.position.set(X0 + 0.272, mantelY + 0.22, FIRE.z); face.rotation.y = Math.PI / 2; add(face);
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.01, 8, 32), brass);
      bezel.position.set(X0 + 0.274, mantelY + 0.22, FIRE.z); bezel.rotation.y = Math.PI / 2; add(bezel);
      for (const s of [-1, 1]) {
        const stick = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0], [0.05, 0.02], [0.018, 0.05], [0.014, 0.2], [0.03, 0.22], [0.0, 0.23]], 20), brass);
        stick.position.set(X0 + 0.2, mantelY, FIRE.z + s * 0.62); add(stick);
        const c = fx.candle({ height: 0.2, radius: 0.012, light: false, seed: 60 + s, burn: 0.7 });
        c.position.set(X0 + 0.2, mantelY + 0.225, FIRE.z + s * 0.62); add(c);
        const urn = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.05, 0], [0.04, 0.02], [0.07, 0.08], [0.08, 0.14], [0.05, 0.2], [0.06, 0.22], [0, 0.22]], 20), M.basic('porcelain', { color: 0x1d2a55 }));
        urn.position.set(X0 + 0.2, mantelY, FIRE.z + s * 0.36); add(urn);
      }
    }
    // gas sconces flanking the chimneypiece
    const sconceLights = [];
    // each sconce throws its light OUT and down from the flame (a wide spot, the wall behind left
    // outside the cone): no flat hot pool on the paper, which gets the etched scallop decal instead
    const sconceLight = (sc, intensity) => {
      sc.updateMatrixWorld(true);
      // the light sits well out from the paper (0.42 m), so the wall gets a broad soft gradient
      // rather than a hot disc behind the shade; the etched scallop decal adds the up/down fans
      const pl = new THREE.PointLight(0xffa860, intensity, 8, 2);
      pl.position.copy(sc.localToWorld(V3(0, 0.05, 0.42)));
      add(pl); sconceLights.push(pl);
    };
    for (const s of [-1, 1]) {
      const sc = buildSconce(ctx, { brass });
      sc.position.set(X0 + 0.01, 2.05, FIRE.z + s * 1.35); sc.rotation.y = Math.PI / 2;
      add(sc);
      sconceLight(sc, 3.6);
    }

    // ================================================================ right wall: cabinet, paintings, gramophone
    const cabinet = buildCabinet(ctx, { wood: mahogany, glass: glassMat, brass, books: bookMats, giltPlain });
    cabinet.position.set(X1, 0, 0.9); cabinet.rotation.y = -Math.PI / 2;
    add(cabinet);
    {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.85), M.create('painting', { subject: 2, seed: 8, aspect: 1.3 / 0.85, size: 1024 })));
      g.add(new THREE.Mesh(G.frameGeometry(1.3, 0.85, { width: 0.1, depth: 0.06, uvScale: 1 }), giltFrame));
      g.position.set(X1 - 0.04, 3.0, 0.9); g.rotation.y = -Math.PI / 2; add(g);
      const g2 = new THREE.Group();
      g2.add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), M.create('painting', { subject: 0, seed: 14, aspect: 0.7 / 0.9, size: 1024 })));
      g2.add(new THREE.Mesh(G.frameGeometry(0.7, 0.9, { width: 0.09, depth: 0.05, uvScale: 1 }), giltFrame));
      g2.position.set(X1 - 0.04, 2.15, 3.0); g2.rotation.y = -Math.PI / 2; add(g2);
    }
    const gram = buildGramophone(ctx, { wood: mahogany, brass });
    gram.position.set(3.3, 0, 2.65); gram.rotation.y = -2.2;
    gram.userData.dynamic = true;
    add(gram);
    {
      const sc = buildSconce(ctx, { brass });
      sc.position.set(X1 - 0.01, 2.05, -1.55); sc.rotation.y = -Math.PI / 2; add(sc);
      sconceLight(sc, 2.6);
    }
    // front wall: gas sconces flanking the doors (they graze the panels and the damask)
    for (const sx of [-1, 1]) {
      const sc = buildSconce(ctx, { brass });
      sc.position.set(sx * 1.32, 2.0, Z1 - 0.01); sc.rotation.y = Math.PI; add(sc);
      sconceLight(sc, 2.4);
    }
    // front wall: two small paintings flanking the door + a settee
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.0), M.create('painting', { subject: s < 0 ? 3 : 1, seed: 40 + s, aspect: 0.75, size: 1024 })));
      g.add(new THREE.Mesh(G.frameGeometry(0.75, 1.0, { width: 0.09, depth: 0.05, uvScale: 1 }), giltFrame));
      g.position.set(s * 2.55, 2.2, Z1 - 0.04); g.rotation.y = Math.PI; add(g);
    }
    // brass picture lights over the side paintings (front + right walls), each with a soft spot
    {
      const pics = [
        [V3(-2.55, 2.2 + 0.58, Z1 - 0.04), Math.PI, 0.75], [V3(2.55, 2.2 + 0.58, Z1 - 0.04), Math.PI, 0.75],
        [V3(X1 - 0.04, 3.0 + 0.5, 0.9), -Math.PI / 2, 1.3], [V3(X1 - 0.04, 2.15 + 0.53, 3.0), -Math.PI / 2, 0.7],
      ];
      const glowM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.8, 0.5).multiplyScalar(3), toneMapped: false });
      for (const [p, ry, w] of pics) {
        const out = V3(0, 0, 1).applyAxisAngle(V3(0, 1, 0), ry);
        const lamp = new THREE.Group();
        const hood = new THREE.Mesh(new G.RoundedBoxGeometry(w * 0.55, 0.04, 0.07, 3, 0.016), brass); hood.position.set(0, 0, 0.17); lamp.add(hood);
        const armL = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0, -0.08, 0), V3(0, 0.0, 0.08), V3(0, 0.0, 0.16)]), 10, 0.007, 6), brass); lamp.add(armL);
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, 0.01), glowM); gl.rotation.x = Math.PI / 2; gl.position.set(0, -0.021, 0.17); lamp.add(gl);
        lamp.position.copy(p); lamp.rotation.y = ry; add(lamp);
        const sp = new THREE.SpotLight(0xffc890, 1.3, 2.2, 0.85, 0.85, 2);
        sp.position.copy(p).addScaledVector(out, 0.2);
        sp.target.position.copy(p).addScaledVector(out, 0.02).add(V3(0, -0.75, 0));
        add(sp); add(sp.target);
      }
    }
    const chair2 = buildChair(ctx, { wood: mahogany, velvet: seatVelvet });
    chair2.position.set(-2.9, 0, 2.6); chair2.rotation.y = 2.3; add(chair2);

    // gasolier
    const gas = buildGasolier(ctx, { brass, crystal });
    gas.position.set(-0.5, H, -0.6);
    add(gas);
    const gasLight = new THREE.PointLight(0xffb070, 3.2, 12, 2);
    gasLight.position.set(-0.5, gas.userData.lightY + H, -0.6);
    add(gasLight);

    // ================================================================ moonlight
    const moon = new THREE.SpotLight(0xbcc8ec, 430, 26, 0.42, 0.18, 2);
    // high and almost straight behind the bay, so each window lays its own pane pattern
    // into the room: the centre one across the rug in front of the piano
    moon.position.set(5.0, 6.5, Z0 - 7.5);
    moon.target.position.set(0.2, 0, -0.4);
    moon.castShadow = ctx.quality.shadows;
    moon.shadow.mapSize.set(ctx.quality.shadowMapSize, ctx.quality.shadowMapSize);
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.035; moon.shadow.radius = ctx.quality.shadowRadius;
    moon.shadow.camera.near = 3; moon.shadow.camera.far = 17;
    add(moon); add(moon.target);

    // a lower, cooler sky fill (deeper shadows) with a warm floor bounce so the lower walls hold detail
    add(new THREE.HemisphereLight(0x4a62a4, 0x5a3420, 0.95));
    // a whisper of cool ambient so the deepest shadows (the bay corners, behind the harp) hold detail
    add(new THREE.AmbientLight(0x30406a, 0.12));
    // warm bounce off the boards and the rug (soft area lights lying on the floor, facing up): the wainscot
    // and the lower walls keep their detail instead of crushing to black, with no point-light hotspots
    add(fx.areaLight({ center: [X0 + 1.1, 0.03, FIRE.z], normal: [0.25, 1, 0], width: 1.4, height: 1.8, color: 0xff9255, intensity: 0.55 }));
    add(fx.areaLight({ center: [0.3, 0.03, Z1 - 1.1], normal: [0, 1, 0.45], width: 3.6, height: 1.4, color: 0xffa060, intensity: 0.55 }));

    // opaque shadow blockers behind the bay wall: the wainscot board and the wall plane are thin,
    // so without these the moon leaks through the panel joints as bright slits
    {
      const blk = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1 });
      const box = (x0, x1, y0, y1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.3), blk); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, Z0 - 0.16 - WIN.depth * 0 - 0.0); m.name = 'shadowWall'; add(m); };
      box(X0 - 0.3, X1 + 0.3, -0.05, WIN.sill - 0.02);                                // under the sills
      box(X0 - 0.3, X1 + 0.3, WIN.sill + WIN.h + 0.06, H + 0.3);                       // over the arches
      const r = WIN.w / 2 + 0.035;
      const xs = [X0 - 0.3, ...WIN.xs.flatMap((wx) => [wx - r, wx + r]), X1 + 0.3];
      for (let i = 0; i < xs.length; i += 2) box(xs[i], xs[i + 1], WIN.sill - 0.03, WIN.sill + WIN.h + 0.07);   // piers
    }
    // window glow: the rect spans exactly the glazing (sill to arch); it used to hang below the sill
    // and lit the wainscot bevels from point-blank range, which read as light leaks
    // (one rect for the whole bay: three LTC area lights per pixel were the single biggest shading cost)
    add(fx.areaLight({ center: [0, WIN.sill + WIN.h / 2 + 0.05, Z0 - 0.05], normal: [0, -0.3, 1], width: 2 * WIN.xs[2] + WIN.w * 0.9, height: WIN.h * 0.9, color: 0x9aaee0, intensity: 0.12 }));

    const beamDir = new THREE.Vector3().subVectors(moon.target.position, moon.position).normalize();
    const shafts = [];
    for (const wx of WIN.xs) {
      // the beam volume starts ~0.4 m into the room (its densest part used to sit right against the
      // glass, veiling the drapes and the cello by the bay in a milky haze)
      const c0 = V3(wx, WIN.sill + WIN.h * 0.47, Z0 - 0.02).addScaledVector(beamDir, 0.45 / Math.max(0.2, beamDir.z));
      const shaft = fx.shaft({
        center: c0, right: V3(WIN.w / 2, 0, 0), up: V3(0, WIN.h * 0.5, 0),
        // (the left beam is cut short of the fireplace wall: where the beam volume pierced the wall its
        // clipped face drew a ruler-straight seam down the damask)
        direction: beamDir, length: wx < -1 ? 2.25 : 3.9, color: 0xaebfee, intensity: 0.22, softness: wx < -1 ? 0.42 : 0.3, falloff: wx < -1 ? 0.7 : 1.0, panes: [2, 4], mullion: 0.035, noise: 1.0,
      });
      // the left beam (beside the ghost) carries the composition; the centre and right beams are seen
      // end-on from most nodes, so they are kept thin or they veil the bay, the cello and the drapes
      shaft.userData.base = wx < -1 ? 0.12 : wx < 1 ? 0.065 : 0.035;
      add(shaft); shafts.push(shaft);
    }
    const dust = add(fx.dust({ box: new THREE.Box3(V3(-3.4, 0.1, Z0 + 0.05), V3(3.4, 3.4, 1.2)), count: 1600, shafts, size: 0.0075, intensity: 1.5, ambient: 0.0 }));
    const fog = add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.2, 0, Z0 + 0.1), V3(X1 - 0.2, 0.5, Z1 - 0.3)), color: 0x0b111e, litColor: 0x31405e, density: 0.3, heightFalloff: 4 }));
    // looking straight into the bay (the harp view) the shafts and floor mist sit between the camera
    // and everything else: thin them there so the cello, drapes and parquet keep their colour
    const veil = { k: 1 };

    // ================================================================ puzzle
    let solvedScenePlayed = false;
    const farewell = { pending: false, t0: -1 };
    const solvedScene = async () => {
      // the ghost plays the whole nocturne with its resolution; once the guest stands up,
      // he shows himself one last time, bows, and lets go (see the per-frame farewell)
      const tail = [...PHRASE, 65, 69, 74];
      tail.forEach((m, i) => setTimeout(() => { keys.press(m); keys.flash(m, { ghost: true, dur: 0.9 }); ghost.reachFor(keys.xOf(m)); pianoNote(ctx.audio, m, { velocity: 0.7, ghost: true, length: i === tail.length - 1 ? 5 : 2.8 }); }, i * 330));
      solvedScenePlayed = true;
      farewell.pending = true;
      ctx.state.set('music.nocturne', true);
    };
    const nocturne = createPianoPuzzle({ keys, ghost, desk: piano.userData.desk, onSolvedScene: solvedScene });
    const puzzleCam = (() => {
      // low and close over the keys: the keyboard fills the lower third, the lacquered fallboard
      // is a thin band with the decal, the lower half of the score fills the top
      const pos = pianoToWorld(0.03, 1.12, 0.36), tgt = pianoToWorld(0.03, 0.789, -0.014);
      return { position: pos.toArray(), target: tgt.toArray(), fov: 44 };
    })();
    // the engine reads `camera` as the puzzle starts (before the camera flight): the ghost
    // gives up his seat right then, so the camera never passes through him
    Object.defineProperty(nocturne.puzzle, 'camera', { enumerable: true, configurable: true, get: () => { ghost.want(0); ghostFade.speed = 1.4; return puzzleCam; } });
    const ghostFade = { target: ctx.state.isSolved(PUZZLE_ID) ? 0 : GHOST_IDLE, speed: 0.6, value: ctx.state.isSolved(PUZZLE_ID) ? 0 : GHOST_IDLE };
    if (ctx.state.isSolved(PUZZLE_ID)) { nocturne.markDone(); ghost.group.visible = false; }
    ghost.setOpacity(ghostFade.value);
    ghost.want = (v, now = false) => { ghostFade.target = v ?? (ctx.state.isSolved(PUZZLE_ID) ? 0 : GHOST_IDLE); if (now) ghostFade.value = ghostFade.target; };

    // ================================================================ navigation
    const nodes = {
      main: { position: [1.75, 1.6, 2.35], target: [-1.75, 1.32, -1.8], fov: 56, label: 'The music room', look: { yaw: [-50, 50], pitch: [-25, 30] } },
      piano: { position: pianoToWorld(2.0, 1.66, 0.25).toArray(), target: pianoToWorld(-0.3, 0.98, -0.05).toArray(), fov: 50, label: 'The piano' },
      harp: { position: [1.35, 1.55, -0.35], target: [1.7, 1.0, -3.8], fov: 54, label: 'The harp, the cello and the windows', look: { yaw: [-60, 60], pitch: [-25, 30] }, grade: { exposure: 0.85, bloomThreshold: 1.4 } },
      hearth: { position: [0.9, 1.6, 1.4], target: [-4.0, 1.45, 0.45], fov: 54, label: 'The fireplace' },
      door: { position: [0.6, 1.62, 0.9], target: [0.0, 1.45, 5.5], fov: 56, label: 'The doors', grade: { exposure: 1.55 } },
    };
    const edges = [
      ['main', 'piano', [[1.6, 1.6, 1.5]]],
      ['main', 'harp', [[1.4, 1.6, 1.6]]],
      ['main', 'hearth', [[1.2, 1.6, 2.4]]],
      ['piano', 'harp'],
      ['piano', 'hearth', [[0.9, 1.6, 0.9]]],
      ['harp', 'hearth'],
      ['hearth', 'door'],
      ['main', 'door', [[1.2, 1.62, 2.0]]],
      ['harp', 'door'],
    ];
    const exits = [
      { node: 'door', toRoom: 'foyer', toNode: 'center', label: 'Back to the foyer', hotspot: { box: { min: [-0.9, 0.1, Z1 - 0.2], max: [0.9, 2.9, Z1 + 0.05] } } },
      { node: 'main', toRoom: 'foyer', toNode: 'center', label: 'Back to the foyer', enabled: () => false, hotspot: { box: { min: [-0.9, 0.1, Z1 - 0.2], max: [0.9, 2.9, Z1 + 0.05] } } },
    ].slice(0, 1);

    // keyboard box in world space (for the puzzle hotspot)
    const kbBox = new THREE.Box3();
    for (const [x, y, z] of [[-0.7, 0.66, 0.2], [0.7, 0.66, 0.2], [-0.7, 1.05, -0.2], [0.7, 1.05, -0.2]]) kbBox.expandByPoint(pianoToWorld(x, y, z));
    const ghostCenter = pianoToWorld(0, 1.05, 0.5);

    const say = (text) => ctx.say({ text, speaker: 'stauf', speakerName: 'Stauf' });
    const hotspots = [
      { id: 'keys', nodes: ['piano', 'main'], box: { min: kbBox.min.toArray(), max: kbBox.max.toArray() }, cursor: 'puzzle', label: 'The keyboard', puzzle: nocturne.puzzle, priority: 2 },
      {
        id: 'ghost', nodes: ['main', 'piano', 'harp'], sphere: { center: ghostCenter.toArray(), radius: 0.42 }, cursor: 'ghost', label: 'The pianist',
        enabled: () => !ctx.state.isSolved(PUZZLE_ID), priority: 3,
        onActivate: () => ctx.cinematic(async (c, h) => {
          ctx.post.set({ saturation: 0.7, vignette: 0.6 }, 0.8);
          ghostFade.target = 1.0;
          await ctx.nav.lookAt(pianoToWorld(0, 1.0, 0.2), 1.2);
          const phrase = PHRASE.slice(0, 4);
          for (let i = 0; i < phrase.length; i++) { nocturne.ghostPlay(phrase[i]); await h.wait(0.6); }
          await say('Herr Kessler played this room every night, for a house that never *applauded*. He has been waiting for someone to finish his little piece.');
          await h.wait(0.3);
          ghostFade.target = GHOST_IDLE;
          ctx.post.reset(1.2);
          await ctx.nav.returnToNode(1.0);
        }),
      },
      {
        id: 'harp', nodes: ['harp', 'main'], object: harp, cursor: 'examine', label: 'The harp',
        onActivate: () => {
          [50, 57, 62, 65, 69, 74, 77, 81].forEach((m, i) => harpNote(ctx.audio, m, { when: i * 0.09 }));
          ctx.ui.caption('A gilt pedal harp. The strings are cold, and one of them is still quivering.', { title: 'The Harp' });
        },
      },
      {
        id: 'cello', nodes: ['harp', 'main'], object: cello, cursor: 'examine', label: 'The cello',
        onActivate: () => { celloNote(ctx.audio, 38, { length: 2.6 }); ctx.ui.caption('A cello leaning by the window, its bow beside it — as if the player only stepped out.', { title: 'The Cello' }); },
      },
      {
        id: 'portrait', nodes: ['hearth'], object: portrait, cursor: 'talk', label: 'The composer',
        onActivate: () => say('Kessler. A *genius*, he told everyone. He owed me a nocturne. I collected.'),
      },
      {
        id: 'fire', nodes: ['hearth'], box: { min: [X0, 0, FIRE.z - 0.5], max: [X0 + 0.6, 0.9, FIRE.z + 0.5] }, cursor: 'examine', label: 'The fire',
        onActivate: () => ctx.ui.caption('The coals are burning, though nobody has laid a fire in this house for years.', { title: 'The Fire' }),
      },
      {
        id: 'gramophone', nodes: ['door', 'hearth'], object: gram, cursor: 'examine', label: 'The gramophone',
        onActivate: () => { ctx.audio.sfx?.('creak'); ctx.ui.caption('The record is scratched at the same groove, over and over: a woman laughing.', { title: 'The Gramophone' }); },
      },
      {
        id: 'windows', nodes: ['harp'], box: { min: [-3.0, 1.0, Z0 - 0.4], max: [3.0, 3.8, Z0 + 0.05] }, cursor: 'examine', label: 'The windows',
        onActivate: () => ctx.ui.caption('Moonlight on the lawn, and the little temple beyond the hedges. Nothing moves out there. Nothing ever does.', { title: 'The Bay Windows' }),
      },
      {
        id: 'cabinet', nodes: ['door', 'hearth', 'main'], box: { min: [X1 - 0.45, 0.0, 0.15], max: [X1, 2.35, 1.65] }, cursor: 'examine', label: 'The music cabinet',
        onActivate: () => ctx.ui.caption('Bound scores, every one of them by the same hand, every one of them left unfinished at the same bar.', { title: 'The Music Cabinet' }),
      },
    ];

    // ================================================================ per-frame
    ctx.onUpdate((dt, t) => {
      keys.update(dt);
      if (farewell.pending && window.__game?.mode === 'explore') {
        if (farewell.t0 < 0) { farewell.t0 = t; ghostFade.target = 1.0; ghostFade.speed = 1.2; }
        if (t - farewell.t0 > 2.4 && ghostFade.target > 0) {
          ghostFade.target = 0; ghostFade.speed = 0.22;
          say('He finished it at last. How *touching*. I much preferred him unfinished.');
        }
        if (t - farewell.t0 > 9) farewell.pending = false;
      }
      ghostFade.value += (ghostFade.target - ghostFade.value) * Math.min(1, dt * ghostFade.speed * 3);
      ghost.setOpacity(ghostFade.value);
      ghost.group.visible = ghostFade.value > 0.01;
      ghost.update(dt, t, !(window.__game?.mode === 'puzzle' || solvedScenePlayed));
      const fl = 0.8 + 0.2 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.2) + 0.08 * Math.sin(t * 17.0);
      fireLight.intensity = 3.6 * fl;
      fireInner.intensity = 1.6 * (0.75 + 0.25 * Math.sin(t * 11.0 + 1.0) * Math.sin(t * 4.3));
      fire.userData.coalMat.emissiveIntensity = 1.4 + 0.3 * Math.sin(t * 1.3);
      fire.userData.bedMat.emissiveIntensity = 1.6 + 0.3 * Math.sin(t * 0.9 + 0.5);
      fire.userData.logMat.emissiveIntensity = 1.8 + 0.4 * Math.sin(t * 1.7 + 2.0);
      dust.visible = window.__game?.mode !== 'puzzle';
      const veilT = ctx.nav.current === 'harp' ? 0.4 : 1;
      veil.k += (veilT - veil.k) * (dt > 0 ? Math.min(1, dt * 1.5) : 1);
      for (const sh of shafts) if (sh.material?.uniforms?.uIntensity) sh.material.uniforms.uIntensity.value = sh.userData.base * veil.k;
      if (fog.material?.uniforms?.uDensity) fog.material.uniforms.uDensity.value = 0.3 * (0.35 + 0.65 * veil.k);
      for (const [i, pl] of sconceLights.entries()) pl.intensity = (i < 2 ? 3.6 : i === 2 ? 2.6 : 2.4) * (0.97 + 0.03 * Math.sin(t * 9.1 + i) * Math.sin(t * 3.7));
      keyFill.intensity += ((window.__game?.mode === 'puzzle' ? 3.6 : 0.5) - keyFill.intensity) * Math.min(1, dt * 3);
      torchLight.intensity = 7.0 * (0.94 + 0.06 * Math.sin(t * 8.3) * Math.sin(t * 2.9 + 0.4));
    });

    // ================================================================ QA hooks
    if (typeof window !== 'undefined') {
      const dbg = (window.__debug ||= {});
      dbg.solvers ||= {}; dbg.states ||= {};
      dbg.solvers.music = async () => {
        const game = window.__game;
        if (game && !game.puzzle && game.room?.mod?.id === 'music' && game.startPuzzle) {
          game.startPuzzle(nocturne.puzzle);
          await new Promise((r) => setTimeout(r, 60));
        }
        if (game?.puzzle?.def?.id === PUZZLE_ID) { nocturne.puzzle.autoSolve(game.puzzle.pctx); return true; }
        nocturne.markDone(); ctx.state.markSolved?.(PUZZLE_ID); ghostFade.target = 0;
        return true;
      };
      dbg.states.music = () => ({ ...nocturne.state(), isSolved: ctx.state.isSolved(PUZZLE_ID), ghostOpacity: +ghostFade.value.toFixed(3), node: ctx.nav.current });
      dbg.solve ||= (id) => (dbg.solvers[id] ? dbg.solvers[id]() : Promise.reject(new Error(`no solver for ${id}`)));
      dbg.state ||= (id) => (dbg.states[id] ? dbg.states[id]() : null);
      dbg.music = { play: (midi) => nocturne.input(midi), phrase: PHRASE, puzzle: nocturne.puzzle, keys };
    }

    // ================================================================ shadows + merge
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const fxLike = o.isPoints || m?.isShaderMaterial || m?.isMeshBasicMaterial || (m?.transparent && (m.opacity ?? 1) < 0.6) || o.userData.noBake || o.userData.noShadow;
      o.castShadow = !fxLike && !['floor', 'ceiling', 'rug', 'curtain'].includes(o.name);
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });
    gas.traverse((o) => { o.castShadow = false; });
    const merged = mergeStatic(root);
    root.userData.merged = merged;

    const godRays = WIN.xs.map((wx) => ({ position: V3(wx, WIN.sill + 1.7, Z0).addScaledVector(beamDir, -2.2), color: new THREE.Color(0.72, 0.8, 1.0), strength: 0.5, radius: 0.18 }));

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'main',
      // restrained navy-and-gold grade: less saturation and split-toning than a game trailer, a gentle toe, grain + soft vignette
      grade: { exposure: 1.36, contrast: 1.14, saturation: 0.86, shadowTint: [0.86, 0.95, 1.14], highlightTint: [1.1, 1.0, 0.86], splitAmount: 0.42, bloomStrength: 0.38, bloomThreshold: 1.1, godRayWeight: 0.5, godRayThreshold: 2.2, vignette: 0.5, grain: 0.02, aoIntensity: 1.15, aoRadius: 0.4, highlightRolloff: 3.0 },
      environment: { position: [0.8, 1.7, 1.2], intensity: 0.85 },
      onEnter() {
        if (!ctx.state.has('music.greeted')) {
          ctx.state.set('music.greeted', true);
          setTimeout(() => say('Do you play? *He* does. He simply cannot seem to *stop*.'), 1600);
        }
      },
      update() {
        // a local reflection probe at the piano (the room's IBL probe sits by the door): the arched
        // windows, the candelabrum flames and the gasolier mirror in the lid and bentside lacquer
        if (pianoProbe.done) return;
        pianoProbe.done = true;
        try {
          const scene = ctx.scene, hidden = [];
          scene.traverse((o) => { if ((o.userData?.noBake || o.material?.userData?.noBake || o.name === 'ghostPianist') && o.visible) { o.visible = false; hidden.push(o); } });
          const pm = new THREE.PMREMGenerator(ctx.renderer);
          const rt = pm.fromScene(scene, 0.0, 0.04, 40, { size: hq ? 256 : 128, position: pianoProbe.pos });
          // a second probe inside the case, under the raised lid: its underside mirrors the gilt plate + strings
          const rt2 = pm.fromScene(scene, 0.0, 0.02, 40, { size: hq ? 256 : 128, position: pianoProbe.posIn });
          pm.dispose();
          for (const o of hidden) o.visible = true;
          for (const m of pianoProbe.mats) { m.envMap = rt.texture; m.needsUpdate = true; }
          const lidMat = piano.userData.lidPivot.userData.lidMat;
          lidMat.envMap = rt2.texture; lidMat.envMapIntensity = 0.6; lidMat.roughness = 0.14; lidMat.clearcoatRoughness = 0.07; lidMat.needsUpdate = true;
          pianoProbe.rt = rt; pianoProbe.rt2 = rt2;
        } catch (e) { console.warn('piano probe', e); }
      },
      dispose() { pianoProbe.rt?.dispose(); pianoProbe.rt2?.dispose(); const d = window.__debug; if (d) { delete d.music; if (d.solvers) delete d.solvers.music; if (d.states) delete d.states.music; } },
    };
  },
};
