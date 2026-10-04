import * as THREE from 'three';

/**
 * World-space grime for the kitchen shell. Patches a MeshStandard/Physical material so its
 * albedo / roughness are modulated by position in the room:
 *   - soot plumes rising above the range, the gas brackets and lamps (gaussian, widening upward)
 *   - a smoke band under the ceiling
 *   - grime on the lowest courses (mop water, boots)
 *   - (floors) a polished, darker worn path between given points
 * Breaks up texture tiling with low-frequency world noise too.
 *
 * plumes: [[x, z, yBase, strength, width]]  path: [[x, z], ...] (polyline, max 4 points)
 */
export function applyGrime(material, {
  plumes = [], ceiling = [3.4, 0.7, 0.45], floor = [0.35, 0.35], path = null, pathWidth = 0.45, pathStrength = 0.5, noise = 0.25, tag = 'g', tiles = null, sootTint = [0.92, 0.88, 0.8], sootTintAmt = 0.5,
  tide = [0, 0], smudges = [], hgrad = [0, 1, 0],
} = {}) {
  const T = tiles ? { grid: [8, 8], offset: 0, amp: 0.1, hue: 0.03, rough: 0.25, tilt: 0.0, ...tiles } : null;
  const P = plumes.slice(0, 8);
  while (P.length < 8) P.push([0, 0, 99, 0, 0.3]);
  const plumeA = P.map((p) => new THREE.Vector4(p[0], p[1], p[2], p[3]));
  const plumeW = P.map((p) => p[4] ?? 0.3);
  const SM = smudges.slice(0, 4); while (SM.length < 4) SM.push([0, -99, 0, 0.1, 0]);
  const pts = (path || []).slice(0, 4).map((p) => new THREE.Vector2(p[0], p[1]));
  const nPath = pts.length;
  while (pts.length < 4) pts.push(new THREE.Vector2());
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.(shader, r);
    Object.assign(shader.uniforms, {
      gPlumes: { value: plumeA }, gPlumeW: { value: plumeW },
      gCeil: { value: new THREE.Vector3(...ceiling) }, gFloor: { value: new THREE.Vector2(...floor) },
      gPath: { value: pts }, gPathW: { value: pathWidth }, gPathS: { value: pathStrength }, gNoise: { value: noise },
      gSootTint: { value: new THREE.Vector4(...sootTint, sootTintAmt) },
      gTide: { value: new THREE.Vector2(...tide) }, gHGrad: { value: new THREE.Vector3(...hgrad) },
      gSmudge: { value: SM.map((m) => new THREE.Vector4(m[0], m[1], m[2], m[3])) }, gSmudgeS: { value: SM.map((m) => m[4]) },
    });
    if (T) Object.assign(shader.uniforms, { gTGrid: { value: new THREE.Vector2(...T.grid) }, gTP: { value: new THREE.Vector4(T.amp, T.hue, T.rough, T.tilt) }, gTOff: { value: T.offset } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGW;
uniform vec4 gPlumes[8];
uniform float gPlumeW[8];
uniform vec3 gCeil;
uniform vec2 gFloor;
uniform vec2 gPath[4];
uniform float gPathW, gPathS, gNoise;
uniform vec4 gSootTint;
uniform vec2 gTide;
uniform vec3 gHGrad;
uniform vec4 gSmudge[4];
uniform float gSmudgeS[4];
float gH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gN(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gH(i), gH(i + vec3(1,0,0)), f.x), mix(gH(i + vec3(0,1,0)), gH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(gH(i + vec3(0,0,1)), gH(i + vec3(1,0,1)), f.x), mix(gH(i + vec3(0,1,1)), gH(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float gFbm(vec3 p) { return gN(p) * 0.55 + gN(p * 2.3 + 7.0) * 0.3 + gN(p * 5.1 + 3.0) * 0.15; }
${T ? `uniform vec2 gTGrid; uniform vec4 gTP; uniform float gTOff;
vec4 gTileH(vec2 tuv) {
  vec2 tg = tuv * gTGrid;
  tg.x += mod(floor(tg.y), 2.0) * 0.5 * gTOff;
  vec2 id = floor(tg);
  return vec4(gH(vec3(id, 1.7)), gH(vec3(id * 1.31, 5.3)), gH(vec3(id * 0.77, 9.1)), gH(vec3(id * 2.13, 3.7)));
}` : ''}
float gSoot() {
  float s = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 pl = gPlumes[i];
    float dy = vGW.y - pl.z;
    if (dy < -0.1 || pl.w <= 0.0) continue;
    float wdt = gPlumeW[i] + max(dy, 0.0) * 0.32;
    float d = length(vGW.xz - pl.xy);
    s += pl.w * exp(-d * d / (wdt * wdt)) * smoothstep(-0.1, 0.35, dy) * exp(-max(dy, 0.0) * 0.25);
  }
  return s;
}
// hand smudges: greasy, mottled darkening round things people touch
float gSmudgeV() {
  float m = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 sm = gSmudge[i];
    if (gSmudgeS[i] <= 0.0) continue;
    vec3 d = (vGW - sm.xyz) / sm.w;
    // grease runs down from where it is handled: below the centre the smudge stretches into streaks
    float below = step(vGW.y, sm.y);
    d.y *= mix(1.0, 0.4, below);
    float streak = mix(1.0, 0.35 + 1.1 * smoothstep(0.45, 0.8, gN(vec3(vGW.x * 45.0, vGW.y * 1.5, vGW.z * 45.0))), below);
    m += gSmudgeS[i] * exp(-dot(d, d) * 2.2) * streak;
  }
  return m * (0.4 + 0.9 * smoothstep(0.35, 0.75, gN(vGW * 38.0)));
}
float gPathMask() {
  float m = 0.0;
  ${nPath > 1 ? `for (int i = 0; i < ${nPath - 1}; i++) {
    vec2 a = gPath[i], b = gPath[i + 1];
    vec2 pa = vGW.xz - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float d = length(pa - ba * h);
    m = max(m, exp(-d * d / (gPathW * gPathW)));
  }` : ''}
  return m;
}
`)
      .replace('#include <map_fragment>', `#include <map_fragment>
float gn = gFbm(vGW * 1.3);
float gn2 = gFbm(vGW * 4.0 + 11.0);
// very large scale (2-3 m) world-space mottling: no two stretches of wall age alike, so texture tiling never lines up
float gnL = gFbm(vGW * 0.42 + 3.0);
float gSootV = clamp(gSoot() * (0.7 + 0.6 * gn), 0.0, 0.85);
float gCeilV = gCeil.z * smoothstep(gCeil.x - gCeil.y, gCeil.x, vGW.y) * (0.75 + 0.5 * gn);
float gFloorV = gFloor.y * smoothstep(gFloor.x, 0.0, vGW.y) * (0.6 + 0.8 * gn2);
float gPathV = gPathS * gPathMask() * (0.7 + 0.5 * gn2) * step(vGW.y, 0.05);
// mop-water tide marks: dirt carried up the bottom few cm, dried in wavering brown lines
float gTl = vGW.y - gTide.x * (1.0 + (gn2 - 0.5) * 0.5);
float gTideV = gTide.y * (smoothstep(0.02, -0.06, gTl) * (0.35 + 0.3 * gn2) + exp(-gTl * gTl / 0.000018) * 0.6 + exp(-pow(gTl + gTide.x * 0.45, 2.0) / 0.00001) * 0.3);
float gSmV = clamp(gSmudgeV(), 0.0, 0.7);
float gHG = gHGrad.z * smoothstep(gHGrad.x, gHGrad.y, vGW.y) * (0.6 + 0.8 * gn);
float gDark = 1.0 - clamp(gSootV + gCeilV + gFloorV + gTideV * 0.6 + gSmV * 0.55 + gHG, 0.0, 0.88);
diffuseColor.rgb *= gDark * (1.0 + (gn - 0.5) * gNoise) * (1.0 + (gnL - 0.5) * gNoise * 0.9);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.74, 0.72), gPathV);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * gSootTint.rgb, clamp(gSootV * 1.6 + gHG, 0.0, 1.0) * gSootTint.a);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.82, 0.7, 0.52), clamp(gTideV + gSmV, 0.0, 1.0) * 0.6);
${T ? `vec4 gTh = gTileH(vMapUv);
diffuseColor.rgb *= 1.0 + (gTh.x - 0.5) * gTP.x;
// the odd tile sits in a greasier patch than its neighbours (per world tile, so it never repeats)
diffuseColor.rgb *= 1.0 - step(0.82, gTh.w) * (0.08 + 0.1 * gn2) * smoothstep(0.3, 0.7, gnL);
diffuseColor.rgb *= 1.0 + (vec3(gTh.y, 0.5, 1.0 - gTh.y) - 0.5) * gTP.y;` : ''}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * (1.0 - gPathV * 0.55) + gSootV * 0.15 + gTideV * 0.25 - gSmV * 0.1, 0.04, 1.0);
${T ? 'roughnessFactor = clamp(roughnessFactor * (1.0 + (gTh.z - 0.5) * gTP.z * 2.0), 0.04, 1.0);' : ''}`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
${T ? `#ifdef USE_CLEARCOAT
material.clearcoatRoughness = clamp(material.clearcoatRoughness * (0.35 + 1.9 * gTh.z) + gFloorV * 0.35 + gSootV * 0.3, 0.02, 1.0);
material.clearcoat *= 1.0 - clamp(gFloorV * 0.8 + gSootV * 0.6, 0.0, 0.85);
#endif` : ''}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
${T ? 'normal = normalize(normal + (vec3(gTh.w, fract(gTh.w * 7.13), 0.0) - 0.5) * gTP.w);' : ''}`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (key ? key() : '') + `|kgrime5:${tag}:${nPath}:${T ? 1 : 0}`;
  material.needsUpdate = true;
  return material;
}
