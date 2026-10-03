import * as THREE from 'three';
import { FX_NOISE } from '../../engine/fx/noise.glsl.js';

/**
 * A log-fire flame sheet: a camera-facing (around Y) quad filled with several
 * licking tongues of flame that rise off a glowing base, driven by scrolling
 * noise. Colour runs deep red -> orange -> pale yellow only in the hot root,
 * so the fire reads orange instead of clipping to white. Additive.
 */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 up = normalize((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vec3 toCam = cameraPosition - center;
  toCam -= up * dot(toCam, up);
  vec3 right = normalize(cross(up, normalize(toCam) + vec3(1e-4, 0.0, 0.0)));
  float sx = length((modelMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  float sy = length((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vec3 pos = center + right * position.x * sx + up * position.y * sy;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uIntensity;
uniform float uTongues;
varying vec2 vUv;
${FX_NOISE}
void main() {
  vec2 uv = vUv;
  float x = uv.x * 2.0 - 1.0;
  float t = uTime;
  // horizontal turbulence that grows with height
  float turb = fxFbm(vec3(x * 2.2, uv.y * 2.6 - t * 1.9, uSeed)) - 0.5;
  float xw = x + turb * 0.35 * uv.y;
  // tongues: columns of differing heights
  float col = 0.5 + 0.5 * sin(xw * uTongues * 3.14159 + uSeed * 3.0 + fxNoise(vec3(xw * 3.0, t * 0.7, uSeed)) * 2.5);
  float envelope = 1.0 - pow(abs(x), 2.2);
  float top = envelope * (0.38 + 0.6 * col * (0.55 + 0.45 * fxNoise(vec3(xw * 4.0, t * 1.3, uSeed + 7.0))));
  float lick = fxFbm(vec3(xw * 5.0, uv.y * 5.5 - t * 3.4, uSeed + 3.0));
  float f = top - uv.y + (lick - 0.5) * 0.32;
  float body = smoothstep(-0.04, 0.3, f);                      // soft, feathered tongues (no cut-out edge)
  // breakaway wisps above the tongues
  float wisp = smoothstep(0.62, 0.8, fxFbm(vec3(xw * 7.0, uv.y * 4.0 - t * 4.5, uSeed + 11.0))) * (1.0 - smoothstep(-0.12, 0.0, f)) * smoothstep(-0.3, -0.05, f) * envelope;
  float heat = clamp(f * 2.6 + (1.0 - uv.y) * 0.35, 0.0, 1.0);
  vec3 c = mix(vec3(0.55, 0.06, 0.01), vec3(1.0, 0.36, 0.06), smoothstep(0.0, 0.45, heat));
  c = mix(c, vec3(1.0, 0.56, 0.18), smoothstep(0.55, 1.0, heat));
  float base = (1.0 - smoothstep(0.0, 0.25, uv.y)) * envelope;
  float a = clamp(body * body * (0.5 + 0.5 * heat) + wisp * 0.3, 0.0, 1.0) * smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.55, abs(x));
  vec3 outc = (c * a + vec3(1.0, 0.4, 0.08) * base * 0.25) * uIntensity;
  gl_FragColor = vec4(outc, a);
}`;

export function createFireSheet(ctx, { width = 0.5, height = 0.4, seed = 1, intensity = 1.2, tongues = 5 } = {}) {
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { uTime: ctx.time, uSeed: { value: seed }, uIntensity: { value: intensity }, uTongues: { value: tongues } },
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, toneMapped: false, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(width, height, 1);
  m.renderOrder = 10;
  m.frustumCulled = false;
  m.castShadow = false; m.receiveShadow = false;
  m.userData.noBake = true; m.userData.isFlame = true;
  return m;
}
