import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
    return this.add(new THREE.BoxGeometry(w, h, d), material, mat4(x, y, z, opts.rx || 0, ry, opts.rz || 0), opts);
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
    uHFogMoonColor: { value: new THREE.Color(0.1, 0.12, 0.17) },
    uHFogMoonDir: { value: new THREE.Vector3(0, 0.4, -1).normalize() },
    uHFogDensity: { value: 0.016 },     // ground mist density at base height
    uHFogBase: { value: -5.5 },        // world y where the mist is at full density
    uHFogFalloff: { value: 0.7 },     // 1/m exponential height falloff
    uHFogHaze: { value: 0.0028 },       // aerial haze per metre
    uHFogMax: { value: 0.92 },
    uHFogFlash: { value: 0.0 },
    uHFogTime: { value: 0 },
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
${FX_NOISE.replace(/fx/g, 'hf')}
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
  od += uHFogHaze * dist;
  float f = min(1.0 - exp(-od), uHFogMax);
  float mo = max(dot(dir, uHFogMoonDir), 0.0);
  vec3 col = uHFogColor + uHFogMoonColor * (pow(mo, 6.0) * 0.8 + pow(mo, 40.0) * 1.2);
  col *= 1.0 + uHFogFlash * 5.0;
  return vec4(col, f);
}
`;

/** Patch a Standard/Physical/Basic material so it receives the exterior height fog. */
export function patchFog(material, U) {
  if (material.userData.hfog) return material;
  material.userData.hfog = true;
  material.fog = false;
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
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vHFogW;\n${HFOG_PARS}`)
      .replace('#include <fog_fragment>', `{ vec4 hf = hfogEval(cameraPosition, vHFogW); gl_FragColor.rgb = mix(gl_FragColor.rgb, hf.rgb, hf.a); }`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (key ? key() : '') + '|hfog';
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
