import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { applyBoxUVs } from '../../engine/geometry/index.js';
import { FX_NOISE } from '../../engine/fx/noise.glsl.js';

/**
 * Shared helpers for the exterior: geometry buckets (merge many parts into one
 * draw call per material), world-space box UVs, and the height-fog patch that
 * every exterior material receives (ground mist hugging the hill + aerial haze,
 * brightened toward the moon and by lightning).
 */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/**
 * Box with chamfered/rounded arrises (~2 cm, clamped for thin parts) so key and rim
 * lights catch every edge. Cached by size.
 */
const _bev = new Map();
export function bevelBox(w, h, d, r = 0.02) {
  const m = Math.min(w, h, d);
  const rr = Math.min(r, m * 0.3);
  if (rr < 0.006 || Math.max(w, h, d) < 0.12) return new THREE.BoxGeometry(w, h, d);
  const k = `${w.toFixed(4)},${h.toFixed(4)},${d.toFixed(4)},${rr.toFixed(4)}`;
  let g = _bev.get(k);
  if (!g) { g = new RoundedBoxGeometry(w, h, d, 1, rr); _bev.set(k, g); }
  return g;
}

export function mat4(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

/** Normalise a geometry for merging: non-indexed, position/normal/uv only. */
export function clean(g) {
  let o = g.index ? g.toNonIndexed() : g;
  if (!o.attributes.normal) o.computeVertexNormals();
  if (!o.attributes.uv) o.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(o.attributes.position.count * 2), 2));
  for (const k of Object.keys(o.attributes)) if (!['position', 'normal', 'uv'].includes(k)) o.deleteAttribute(k);
  o.morphAttributes = {};
  o.clearGroups();
  return o;
}

export class Bucket {
  constructor() { this.map = new Map(); }
  /**
   * add(geometry, material, matrix, { uv: 'box'|'keep', uvScale })
   * 'box' re-projects UVs in WORLD space after transforming (seamless across parts).
   */
  add(geo, material, matrix = null, { uv = 'box', uvScale = 1 } = {}) {
    let g = geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (uv === 'box') g = applyBoxUVs(g, uvScale);
    g = clean(g);
    if (!this.map.has(material)) this.map.set(material, []);
    this.map.get(material).push(g);
    return g;
  }
  box(material, w, h, d, x, y, z, ry = 0, opts = {}) {
    return this.add(opts.sharp ? new THREE.BoxGeometry(w, h, d) : bevelBox(w, h, d, opts.bevel ?? 0.02), material, mat4(x, y, z, opts.rx || 0, ry, opts.rz || 0), opts);
  }
  build(parent, { cast = true, receive = true, name = 'merged' } = {}) {
    const out = [];
    for (const [mat, list] of this.map) {
      if (!list.length) continue;
      const g = mergeGeometries(list, false);
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = cast; mesh.receiveShadow = receive;
      mesh.name = `${name}:${mat.name || 'mat'}`;
      parent.add(mesh);
      out.push(mesh);
      for (const x of list) x.dispose();
    }
    this.map.clear();
    return out;
  }
}

/** Instanced mesh from a template and a list of matrices. */
export function instanced(geo, material, matrices, { cast = true, receive = true, name = 'inst' } = {}) {
  const m = new THREE.InstancedMesh(geo, material, matrices.length);
  matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
  m.instanceMatrix.needsUpdate = true;
  m.castShadow = cast; m.receiveShadow = receive;
  m.name = name;
  m.computeBoundingSphere();
  return m;
}

// ----------------------------------------------------------------------------- height fog
export function createFogUniforms() {
  return {
    uHFogColor: { value: new THREE.Color(0.035, 0.045, 0.07) },
    uHFogMoonColor: { value: new THREE.Color(0.05, 0.06, 0.085) },
    uHFogMoonDir: { value: new THREE.Vector3(0, 0.4, -1).normalize() },
    uHFogDensity: { value: 0.03 },     // ground mist density at base height
    uHFogBase: { value: -5.5 },        // world y where the mist is at full density
    uHFogFalloff: { value: 0.9 },     // 1/m exponential height falloff
    uHFogHaze: { value: 0.0009 },       // aerial haze per metre
    uHFogMax: { value: 0.92 },
    uHFogFlash: { value: 0.0 },
    uHFogTime: { value: 0 },
    // terrain-hugging ground mist (ray-marched against a baked height map)
    uHMap: { value: null },
    uHMapRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uMistD: { value: 0.0 },            // density at the ground surface (per metre)
    uMistH: { value: 0.9 },            // e-folding height above the ground (m)
    uMistColor: { value: new THREE.Color(0.05, 0.06, 0.08) },
    // moon rim light (backlit silhouettes): world-space light dir, colour, strength
    uRimDir: { value: new THREE.Vector3(0, 0.5, -1).normalize() },
    uRimColor: { value: new THREE.Color(0.55, 0.66, 1.0) },
    uRimStrength: { value: 1.0 },
    // lightning behind the house: a hard rim on every silhouette, no front fill
    uFlashRim: { value: 0.0 },
    uFlashDir: { value: new THREE.Vector3(0, 0.25, -1).normalize() },
  };
}

export const HFOG_PARS = /* glsl */ `
uniform vec3 uHFogColor;
uniform vec3 uHFogMoonColor;
uniform vec3 uHFogMoonDir;
uniform float uHFogDensity;
uniform float uHFogBase;
uniform float uHFogFalloff;
uniform float uHFogHaze;
uniform float uHFogMax;
uniform float uHFogFlash;
uniform float uHFogTime;
uniform sampler2D uHMap;
uniform vec4 uHMapRect;
uniform float uMistD;
uniform float uMistH;
uniform vec3 uMistColor;
uniform vec3 uRimDir;
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uFlashRim;
uniform vec3 uFlashDir;
${FX_NOISE.replace(/fx/g, 'hf')}
vec4 hmSample(vec2 xz) { return texture2D(uHMap, (xz - uHMapRect.xy) * uHMapRect.zw); }
vec4 hfogEval(vec3 camPos, vec3 wpos) {
  vec3 rd = wpos - camPos;
  float dist = length(rd);
  vec3 dir = rd / max(dist, 1e-4);
  float b = uHFogFalloff;
  float dy = rd.y;
  float c0 = exp(-b * (camPos.y - uHFogBase));
  float k = abs(dy * b) > 1e-3 ? (1.0 - exp(-b * dy)) / (b * dy) : 1.0;
  float od = uHFogDensity * c0 * dist * k;
  // drifting wisps: modulate with noise sampled along the ray
  vec3 m1 = camPos + rd * 0.55;
  vec3 m2 = camPos + rd * 0.85;
  vec3 w = vec3(uHFogTime * 0.18, 0.0, uHFogTime * 0.07);
  float n = hfNoise(m1 * vec3(0.16, 0.5, 0.16) + w) * 0.6 + hfNoise(m2 * vec3(0.33, 0.9, 0.33) + w * 1.7) * 0.4;
  od *= 0.35 + 1.3 * n;
  // ground mist: march the first 70 m of the ray against the terrain height
  float odm = 0.0;
  if (uMistD > 0.0) {
    float md = min(dist, 70.0);
    for (int i = 0; i < 8; i++) {
      float t = (float(i) + 0.5) / 8.0;
      t = t * t * md;       // denser sampling near the camera
      vec3 p = camPos + dir * t;
      float hh = max(p.y - hmSample(p.xz).r, 0.0);
      odm += exp(-hh / uMistH) * (2.0 * sqrt(t / md) + 0.06);
    }
    odm *= uMistD * md / 8.0 * 0.5;
    odm *= 0.4 + 1.2 * n;
  }
  float haze = uHFogHaze * dist;
  float odt = od + odm + haze;
  float f = min(1.0 - exp(-odt), uHFogMax);
  float mo = max(dot(dir, uHFogMoonDir), 0.0);
  float sc = pow(mo, 6.0) * 0.8 + pow(mo, 40.0) * 1.2;
  vec3 col = uHFogColor + uHFogMoonColor * sc;
  vec3 mcol = uMistColor * (1.0 + sc * 1.6);
  col = mix(col, mcol, odm / max(odt, 1e-4));
  col *= 1.0 + uHFogFlash * 5.0;
  return vec4(col, f);
}
`;

/**
 * Moon rim: a grazing-angle sheen on surfaces that face the (back-lighting) moon.
 * Lets rooflines, finials, cresting, branches and bars catch a silver edge while the
 * camera-facing facades stay in deep shadow. userData.rim = strength (e.g. 1).
 * Lightning adds a second, much harder rim from the strike direction.
 */
function rimChunk(m) {
  if (!m.userData.rim) return '';
  const tip = m.userData.rimTip;
  const tipTerm = tip ? `#ifdef USE_MAP
  float rtip = smoothstep(0.45, 1.0, vMapUv.y);
#else
  float rtip = 1.0;
#endif
` : 'float rtip = 1.0;\n';
  const mul = tip ? '(diffuseColor.rgb * 2.5) * rtip' : '(0.25 + diffuseColor.rgb * 2.0)';
  return `{
${tipTerm} vec3 rn = normalize(normal); vec3 rv = normalize(vViewPosition);
  vec3 rl = normalize((viewMatrix * vec4(uRimDir, 0.0)).xyz);
  float ndv = clamp(dot(rn, rv), 0.0, 1.0);
  float fr = pow(1.0 - ndv, 3.0);
  float face = smoothstep(-0.15, 0.55, dot(rn, rl));
  float back = 0.35 + 0.65 * clamp(-dot(rv, rl) * 0.5 + 0.5, 0.0, 1.0);
  // no rim on up-facing tops (cornice caps, sills): seen edge-on they alias into white speckle
${(m.userData.groundShade || m.userData.rimTops) ? '' : `  float rup = (vec4(rn, 0.0) * viewMatrix).y;
  fr *= 1.0 - smoothstep(0.45, 0.85, rup);
`}  gl_FragColor.rgb += uRimColor * (fr * face * back * uRimStrength * ${Number(m.userData.rim).toFixed(3)}) * ${mul};
  if (uFlashRim > 0.0) {
    vec3 fl = normalize((viewMatrix * vec4(uFlashDir, 0.0)).xyz);
    float ff = pow(1.0 - ndv, 2.2) * smoothstep(0.0, 0.7, dot(rn, fl));
    gl_FragColor.rgb += vec3(0.78, 0.84, 1.0) * ff * uFlashRim * ${Number(m.userData.flashRim ?? Math.min(1, m.userData.rim)).toFixed(3)} * ${tip ? 'diffuseColor.rgb * 1.5 * rtip' : '(0.2 + diffuseColor.rgb * 1.6)'};
  } }\n`;
}
/** Ground grime: darken + green the bottom of a surface (moss, rising damp) between world y0 and y0+h. */
function grimeChunk(m) {
  const g = m.userData.grime;
  if (!g) return '';
  const f = (v) => Number(v).toFixed(3);
  return `{ float gy = clamp((vHFogW.y - ${f(g.y0)}) / ${f(g.h)}, 0.0, 1.0);
  float gn = hfNoise(vHFogW * vec3(2.3, 5.0, 2.3)) * 0.5 + hfNoise(vHFogW * 7.0) * 0.25;
  float gm = 1.0 - smoothstep(0.0, 1.0, gy + (gn - 0.4) * 0.5);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.32, 0.4, 0.26), gm * ${f(g.moss ?? 1)}); }\n`;
}

/**
 * Surface chunks run before lighting (they edit diffuseColor / roughnessFactor):
 *  - splat: the hillside ground blends dead straw, olive turf, leaf litter and wet mud
 *    (the mud follows the carriage drive via the baked mask in uHMap.g)
 *  - wallGrime {y0, h, streak}: long rain runs down painted walls, a damp dark skirt above the ground
 *  - paintWear: white lead paint gone grey-brown in blotches
 *  - stoneVar: per-block hue/value variation, moss on the moon-shaded (+z) faces
 *  - specAA: roughness from normal derivatives (kills sparkle on thin iron)
 */
function surfaceChunk(m) {
  const u = m.userData;
  let s = '';
  const f = (v) => Number(v).toFixed(3);
  if (u.splat) s += `{
  vec4 hm = hmSample(vHFogW.xz);
  float pm = hm.g;
  float n1 = hfNoise(vec3(vHFogW.xz * 0.05, 3.1));
  float n2 = hfNoise(vec3(vHFogW.xz * 0.21, 7.7));
  float n3 = hfNoise(vec3(vHFogW.xz * 0.9, 1.3));
  vec3 straw = mix(vec3(0.66, 0.54, 0.38), vec3(0.46, 0.47, 0.32), smoothstep(0.3, 0.7, n1));
  float litter = smoothstep(0.55, 0.78, n2 + (n3 - 0.5) * 0.35) * (1.0 - pm);
  straw = mix(straw, vec3(0.7, 0.42, 0.22), litter * 0.75);
  float mud = clamp(pm * 1.2 + smoothstep(0.66, 0.85, n2) * 0.35, 0.0, 1.0);
  vec3 tint = mix(straw, vec3(0.30, 0.28, 0.27), mud);
  diffuseColor.rgb *= tint * (0.7 + 0.6 * n1) * (0.85 + 0.3 * n3);
  roughnessFactor = mix(roughnessFactor, 0.48, mud * 0.75);
}\n`;
  if (u.wallGrime) {
    const g = u.wallGrime;
    s += `{
  float wx = vHFogW.x + vHFogW.z;
  float sk = hfNoise(vec3(wx * 5.0, vHFogW.y * 0.28, 1.7));
  float sk2 = hfNoise(vec3(wx * 19.0, vHFogW.y * 0.7, 5.3));
  float streak = smoothstep(0.5, 0.85, sk * 0.65 + sk2 * 0.35) * ${f(g.streak ?? 1)};
  float blot = smoothstep(0.55, 0.8, hfNoise(vHFogW * 0.7 + 2.0));
  float skirt = 1.0 - smoothstep(0.0, ${f(g.h)}, vHFogW.y - ${f(g.y0)} + (sk2 - 0.5) * 0.5);
  diffuseColor.rgb *= (1.0 - streak * 0.45) * (1.0 - blot * 0.2) * mix(1.0, 0.4, skirt);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.75, 0.95, 0.62), skirt * 0.7);
  roughnessFactor = mix(roughnessFactor, 0.95, streak * 0.4);
}\n`;
  }
  if (u.paintWear) s += `{
  float pw = smoothstep(0.42, 0.78, hfNoise(vHFogW * 1.3 + 4.0) * 0.7 + hfNoise(vHFogW * 6.0) * 0.3);
  float pr = smoothstep(0.5, 0.9, hfNoise(vec3((vHFogW.x + vHFogW.z) * 9.0, vHFogW.y * 0.6, 2.0)));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.58, 0.5, 0.42), clamp(pw * ${f(u.paintWear)} + pr * 0.35, 0.0, 1.0));
}\n`;
  return s;
}
function preLightChunk(m) {
  const u = m.userData;
  let s = '';
  if (u.stoneVar) s += `{
  vec3 wn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 cid = floor(vec3(vHFogW.x * 2.6, vHFogW.y * 4.0, vHFogW.z * 2.6) + 0.5);
  float hv = hfHash(cid), hc = hfHash(cid + 7.1);
  diffuseColor.rgb *= (0.72 + 0.5 * hv) * mix(vec3(1.06, 1.0, 0.92), vec3(0.92, 0.98, 1.06), hc);
  float mf = smoothstep(0.1, 0.8, wn.z) * smoothstep(0.42, 0.68, hfNoise(vHFogW * 2.5) * 0.7 + hfNoise(vHFogW * 9.0) * 0.3);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.045, 0.06, 0.03), mf * ${Number(u.stoneVar).toFixed(3)});
}\n`;
  if (u.specAA !== false) s += `{
  vec3 dnx = dFdx(normal), dny = dFdy(normal);
  float va = 0.25 * (dot(dnx, dnx) + dot(dny, dny));
  roughnessFactor = sqrt(clamp(roughnessFactor * roughnessFactor + min(2.0 * va, ${u.specAA ? '0.5' : '0.18'}), 0.0, 1.0));
}\n`;
  return s;
}

/** Patch a Standard/Physical/Basic material so it receives the exterior height fog. */
export function patchFog(material, U) {
  if (material.userData.hfog) return material;
  material.userData.hfog = true;
  material.fog = false;
  const std = material.isMeshStandardMaterial;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.call(material, shader, r);
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHFogW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
{ vec4 hw = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  hw = instanceMatrix * hw;
#endif
  vHFogW = (modelMatrix * hw).xyz; }`);
    let fs = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vHFogW;\n${HFOG_PARS}`);
    if (std) {
      fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${surfaceChunk(material)}`)
        .replace('#include <lights_physical_fragment>', `${preLightChunk(material)}#include <lights_physical_fragment>`);
    }
    shader.fragmentShader = fs
      .replace('#include <fog_fragment>', `${rimChunk(material)}${grimeChunk(material)}${material.userData.groundShade ? `{ float gd = length(vHFogW - cameraPosition);
  float cs = hfNoise(vec3(vHFogW.xz * 0.045 + vec2(uHFogTime * 0.03, uHFogTime * 0.01), 3.7));
  gl_FragColor.rgb *= mix(0.85, 1.0, smoothstep(1.5, 9.0, gd)) * mix(0.7, 1.15, smoothstep(0.3, 0.7, cs)); }` : ''}
{ vec4 hf = hfogEval(cameraPosition, vHFogW); gl_FragColor.rgb = mix(gl_FragColor.rgb, hf.rgb, hf.a); }`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  const ud = material.userData;
  material.customProgramCacheKey = () => (key ? key() : '') + '|hfog2' + (ud.groundShade ? 'g' : '') + (ud.rim ? `r${ud.rim}${ud.rimTip ? 't' : ''}${ud.rimTops ? 'T' : ''}f${ud.flashRim}` : '') + (ud.grime ? `m${ud.grime.y0},${ud.grime.h},${ud.grime.moss ?? 1}` : '')
    + (ud.splat ? 'S' : '') + (ud.wallGrime ? `W${ud.wallGrime.y0},${ud.wallGrime.h},${ud.wallGrime.streak}` : '') + (ud.paintWear ? `P${ud.paintWear}` : '') + (ud.stoneVar ? `V${ud.stoneVar}` : '') + `A${ud.specAA}`;
  material.needsUpdate = true;
  return material;
}

/** Deterministic PRNG (mulberry32) for geometry generation. */
export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0;
  const f = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.gauss = () => { let u = 0, v = 0; while (!u) u = f(); while (!v) v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return f;
}
