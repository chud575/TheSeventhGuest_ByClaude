import * as THREE from 'three';

/**
 * Hand-authored irradiance field for the kitchen (a cheap stand-in for baked GI).
 *
 * Patches every MeshStandard/Physical material in the room so its *indirect diffuse*
 * term (the one ambient occlusion and the material's AO map darken) receives:
 *   - a sky/ground ambient (cool from above, warm-brown from the floor) that falls off
 *     gradually into the room's corners and the wall/floor/ceiling junctions
 *   - up to 12 coloured "bounce emitters": soft spherical sources standing in for light
 *     thrown back off lit surfaces (the candle-lit block, the range hearth, the moon
 *     pool on the floor, each lamp's wall), normal-weighted and inverse-square-ish.
 * The scene's HemisphereLight should be removed (or kept tiny) when this is used.
 *
 * room: { min: [x,y,z], max: [x,y,z] }  emitters: [{ p: [x,y,z], r, c: [r,g,b] }]
 */
export function makeBounce({ room, sky = [0.1, 0.13, 0.24], ground = [0.07, 0.05, 0.04], emitters = [], cornerDark = 0.55 }) {
  const E = emitters.slice(0, 12);
  const pos = [], col = [];
  for (let i = 0; i < 12; i++) {
    const e = E[i];
    pos.push(e ? new THREE.Vector4(e.p[0], e.p[1], e.p[2], e.r) : new THREE.Vector4(0, -99, 0, 0.01));
    col.push(e ? new THREE.Vector3(...e.c) : new THREE.Vector3());
  }
  const uniforms = {
    kbRoomMin: { value: new THREE.Vector3(...room.min) },
    kbRoomMax: { value: new THREE.Vector3(...room.max) },
    kbSky: { value: new THREE.Vector3(...sky) },
    kbGround: { value: new THREE.Vector3(...ground) },
    kbPos: { value: pos },
    kbCol: { value: col },
    kbCorner: { value: cornerDark },
    kbGain: { value: 1.0 },
  };
  const patched = new WeakSet();
  function apply(material) {
    if (!material || patched.has(material)) return;
    if (!(material.isMeshStandardMaterial || material.isMeshPhysicalMaterial || material.isMeshLambertMaterial)) return;
    patched.add(material);
    const prev = material.onBeforeCompile;
    material.onBeforeCompile = (shader, r) => {
      prev?.(shader, r);
      if (!shader.fragmentShader.includes('#include <lights_fragment_maps>')) return;
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vKBW;')
        .replace('#include <project_vertex>', `#include <project_vertex>
{ vec4 kbw = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  kbw = instanceMatrix * kbw;
#endif
  vKBW = (modelMatrix * kbw).xyz; }`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vKBW;
uniform vec3 kbRoomMin, kbRoomMax, kbSky, kbGround;
uniform vec4 kbPos[12];
uniform vec3 kbCol[12];
uniform float kbCorner, kbGain;
vec3 kbIrradiance(vec3 p, vec3 n) {
  // distances to the six room planes; the smallest is the surface we sit on, the next two occlude
  vec3 d0 = max(p - kbRoomMin, 0.0), d1 = max(kbRoomMax - p, 0.0);
  vec3 dm = min(d0, d1);
  float a = dm.x, b = dm.y, c = dm.z;
  float lo = min(a, min(b, c)), hi = max(a, max(b, c));
  float mid = a + b + c - lo - hi;
  float occ = mix(1.0 - kbCorner, 1.0, smoothstep(0.0, 1.1, mid)) * mix(1.0 - kbCorner * 0.4, 1.0, smoothstep(0.0, 1.4, hi));
  // ceiling stays darker (smoke, nothing bright below most of it), floor near walls dims
  float up = n.y * 0.5 + 0.5;
  vec3 amb = mix(kbGround, kbSky, up);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    vec4 e = kbPos[i];
    vec3 L = e.xyz - p;
    float d = length(L);
    float wrap = clamp(dot(n, L / max(d, 1e-3)) * 0.6 + 0.4, 0.0, 1.0);
    float x = d / e.w;
    acc += kbCol[i] * wrap * wrap / (1.0 + x * x * x);
  }
  return (amb + acc) * occ * kbGain;
}
`)
        .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
{ vec3 kbN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  irradiance += kbIrradiance(vKBW, kbN) * PI; }`);
    };
    const key = material.customProgramCacheKey?.bind(material);
    material.customProgramCacheKey = () => (key ? key() : '') + '|kbounce';
    material.needsUpdate = true;
  }
  return {
    uniforms,
    apply,
    applyTree(root) {
      root.traverse((o) => {
        if (!o.isMesh || o.isPoints) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(apply);
      });
    },
  };
}
