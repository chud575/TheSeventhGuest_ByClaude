import * as THREE from 'three';
import { portraitTexture, eyeLayout } from './textures.js';

/**
 * Portraits whose eyes follow the player.
 *
 * The canvas texture is painted with empty eye whites; the iris + pupil are drawn
 * in the material's fragment shader at a position driven by `uLook` (−1..1 in the
 * sclera's frame). Each frame the room computes where the camera is relative to the
 * canvas and eases the gaze toward it — slowly, with a small lag, so that you only
 * half-notice it happening.
 */
export function makePortraitMaterial(ctx, name, aspect, { size = 1024 } = {}) {
  const set = portraitTexture(ctx, name, aspect, size);
  const eyes = eyeLayout(name, aspect);
  const mat = new THREE.MeshPhysicalMaterial({
    map: set.map, normalMap: set.normalMap, roughnessMap: set.ormMap, aoMap: set.ormMap,
    roughness: 1, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.22, envMapIntensity: 0.6,
    emissiveMap: set.map, emissive: new THREE.Color(0.1, 0.09, 0.08), emissiveIntensity: 1,
    name: `portrait:${name}`,
  });
  const uniforms = {
    uEyeL: { value: new THREE.Vector2(...eyes.left) },
    uEyeR: { value: new THREE.Vector2(...eyes.right) },
    uEyeRad: { value: new THREE.Vector2(...eyes.radius) },
    uIris: { value: new THREE.Color(...eyes.iris) },
    uLook: { value: new THREE.Vector2(0, 0) },
    uGlow: { value: 0 },
  };
  mat.userData.eyes = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
uniform vec2 uEyeL; uniform vec2 uEyeR; uniform vec2 uEyeRad; uniform vec3 uIris; uniform vec2 uLook; uniform float uGlow;
float gEye(vec2 uv, vec2 c, inout vec3 col, inout float glowOut) {
  vec2 q = (uv - c) / uEyeRad;                    // sclera ellipse = unit circle
  float inside = smoothstep(1.02, 0.86, length(q));
  vec2 ic = uLook * vec2(0.55, 0.25);
  vec2 d = (q - ic) * vec2(1.0, uEyeRad.y / uEyeRad.x);   // circular iris in canvas space
  float r = length(d);
  float irisR = 0.5;
  float iris = smoothstep(irisR, irisR - 0.06, r);
  float pupil = smoothstep(0.22, 0.17, r);
  float ringD = smoothstep(irisR - 0.12, irisR, r);
  vec3 ir = uIris * (0.55 + 0.6 * smoothstep(0.1, 0.5, r)) * (1.0 - 0.5 * ringD);
  vec3 e = mix(col, ir, iris);
  e = mix(e, vec3(0.01), pupil);
  // catchlight from the upper left
  e += vec3(0.9, 0.85, 0.75) * smoothstep(0.1, 0.04, length(d - vec2(-0.14, 0.14))) * 0.8;
  // upper lid shadow on the eyeball
  e *= 1.0 - 0.45 * smoothstep(0.1, 0.9, q.y);
  glowOut = max(glowOut, iris * inside);
  col = mix(col, e, inside);
  return inside;
}`)
      .replace('#include <map_fragment>', /* glsl */ `#include <map_fragment>
float gEyeGlow = 0.0;
{
  vec3 ec = diffuseColor.rgb;
  gEye(vMapUv, uEyeL, ec, gEyeGlow);
  gEye(vMapUv, uEyeR, ec, gEyeGlow);
  diffuseColor.rgb = ec;
}`)
      .replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.25, 0.08) * gEyeGlow * uGlow;`);
  };
  mat.customProgramCacheKey = () => 'gallery-portrait-eyes';
  return mat;
}

/**
 * Gaze controller for a set of portraits. Each entry = { mesh, mat, strength }.
 * `instant` (shot mode) snaps the gaze; otherwise it eases with a slight lag.
 */
export function createGaze(entries, camera, { instant = false } = {}) {
  const tmp = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  return (dt) => {
    for (const e of entries) {
      e.mesh.updateWorldMatrix(true, false);
      inv.copy(e.mesh.matrixWorld).invert();
      tmp.copy(camera.position).applyMatrix4(inv);       // camera in canvas space (+z = in front)
      const z = Math.max(0.25, tmp.z);
      const tx = THREE.MathUtils.clamp((tmp.x / z) * 0.9, -1, 1) * (e.strength ?? 1);
      const ty = THREE.MathUtils.clamp(((tmp.y + 0.15) / z) * 0.9, -1, 1) * (e.strength ?? 1);
      const u = e.mat.userData.eyes.uLook.value;
      if (instant) u.set(tx, ty);
      else {
        const k = 1 - Math.exp(-dt * (e.speed ?? 1.4));
        u.x += (tx - u.x) * k; u.y += (ty - u.y) * k;
      }
    }
  };
}
