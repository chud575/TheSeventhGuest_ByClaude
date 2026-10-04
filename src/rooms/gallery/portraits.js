import * as THREE from 'three';
import DATA from './portraitData.json';

/**
 * Portraits whose eyes follow the player.
 *
 * The canvases are painted offline (tools/genPortraits.py) with real painted eyes. We never
 * draw a fake iris over them: instead, inside each eye opening the shader slides the texture
 * lookup a few pixels toward the viewer, so the *painted* iris itself drifts within the
 * socket while the lids stay put. Each frame the room computes where the camera is relative
 * to the canvas and eases the gaze toward it, slowly, with a small lag.
 */
const cache = new Map();
function loadTex(ctx, name, srgb) {
  const url = ctx.assetUrl(`portraits/${name}`);
  if (!cache.has(url)) {
    cache.set(url, new THREE.TextureLoader().loadAsync(url).then((t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      return t;
    }));
  }
  return cache.get(url);
}

export async function makePortraitMaterial(ctx, name) {
  const d = DATA[name];
  const [map, bump] = await Promise.all([loadTex(ctx, `${name}.jpg`, true), loadTex(ctx, `${name}_bump.png`, false)]);
  const mat = new THREE.MeshPhysicalMaterial({
    map, bumpMap: bump, bumpScale: 1.2,
    roughness: 0.72, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.5, envMapIntensity: 0.45,
    emissiveMap: map, emissive: new THREE.Color(0.045, 0.04, 0.035), emissiveIntensity: 1,
    name: `portrait:${name}`,
  });
  const uniforms = {
    uEyeL: { value: new THREE.Vector2(...d.left) },
    uEyeR: { value: new THREE.Vector2(...d.right) },
    uEyeRad: { value: new THREE.Vector2(...d.radius) },
    uLook: { value: new THREE.Vector2(0, 0) },
    uGlow: { value: 0 },
  };
  mat.userData.eyes = uniforms;
  mat.userData.aspect = d.aspect;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
uniform vec2 uEyeL; uniform vec2 uEyeR; uniform vec2 uEyeRad; uniform vec2 uLook; uniform float uGlow;
float gEyeMask(vec2 uv, vec2 c) { vec2 q = (uv - c) / uEyeRad; return smoothstep(1.0, 0.45, length(q)); }
vec2 gEyeWarp(vec2 uv, out float glow) {
  float mL = gEyeMask(uv, uEyeL), mR = gEyeMask(uv, uEyeR);
  float m = max(mL, mR);
  glow = m;
  // slide the lookup opposite to the gaze so the painted iris moves toward the viewer
  return uv - uLook * vec2(uEyeRad.x * 0.36, uEyeRad.y * 0.28) * m;
}`)
      .replace('#include <map_fragment>', /* glsl */ `
float gEyeM = 0.0;
vec2 gUv = gEyeWarp(vMapUv, gEyeM);
vec4 sampledDiffuseColor = texture2D(map, gUv);
diffuseColor *= sampledDiffuseColor;
float gIris = gEyeM * smoothstep(0.32, 0.12, dot(sampledDiffuseColor.rgb, vec3(0.3, 0.59, 0.11)));`)
      .replace('#include <emissivemap_fragment>', /* glsl */ `
totalEmissiveRadiance *= texture2D(emissiveMap, gUv).rgb;
totalEmissiveRadiance += vec3(1.0, 0.22, 0.06) * gIris * uGlow * 3.0;`);
  };
  mat.customProgramCacheKey = () => 'gallery-portrait-eyes2';
  return mat;
}

export function portraitAspect(name) { return DATA[name].aspect; }

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
