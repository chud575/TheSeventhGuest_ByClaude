import * as THREE from 'three';
import { FX_NOISE } from './noise.glsl.js';

/**
 * Ghost shader: translucent, fresnel-rimmed, wispy apparition. Works on any mesh.
 * Optional `map` (e.g. a painted face texture or video texture) is shown faintly
 * inside the body. The lower part dissolves into drifting wisps.
 *
 *   const mat = createGhostMaterial({ color: 0x9fc4ff, timeUniform: ctx.time });
 *   mat.uniforms.uOpacity.value = 0.8; // fade in/out
 */
const VERT = /* glsl */ `
uniform float uTime;
uniform float uWobble;
varying vec3 vN;
varying vec3 vV;
varying vec3 vLocal;
varying vec2 vUv;
${FX_NOISE}
void main() {
  vUv = uv;
  vec3 p = position;
  float w = fxNoise(p * 2.5 + vec3(0.0, uTime * 0.6, 0.0)) - 0.5;
  p += normal * w * uWobble;
  p.x += sin(uTime * 1.3 + p.y * 3.0) * uWobble * 0.3;
  vLocal = p;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uRimColor;
uniform float uOpacity;
uniform float uRimPower;
uniform float uIntensity;
uniform float uDissolveY;     // local Y below which the ghost dissolves
uniform float uDissolveSoft;
uniform sampler2D uMap;
uniform float uHasMap;
uniform float uMapStrength;
uniform float uFlicker;
varying vec3 vN;
varying vec3 vV;
varying vec3 vLocal;
varying vec2 vUv;
${FX_NOISE}
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float ndv = abs(dot(n, normalize(vV)));
  float fres = pow(1.0 - ndv, uRimPower);
  float flow = fxFbm(vLocal * 3.0 + vec3(0.0, -uTime * 0.5, uTime * 0.2));
  float wisps = fxFbm(vLocal * vec3(6.0, 2.0, 6.0) + vec3(0.0, -uTime * 1.2, 0.0));
  // rising ectoplasmic streaks
  float streak = fxFbm(vec3(vLocal.x * 9.0, vLocal.y * 1.5 - uTime * 0.6, vLocal.z * 9.0));
  streak = smoothstep(0.45, 0.85, streak);
  // luminous core that breathes, brighter toward the rim, broken up by drifting noise
  float core = (0.35 + 0.65 * flow) * (0.4 + 0.6 * smoothstep(0.2, 0.8, flow + 0.25 * sin(uTime * 0.7 + vLocal.y * 4.0)));
  vec3 col = uColor * (0.6 + 0.8 * flow) + uRimColor * fres * 1.6 + uRimColor * streak * 0.5;
  float a = 0.14 * core + fres * 0.75 * (0.55 + 0.65 * flow) + streak * 0.16;
  if (uHasMap > 0.5) {
    vec4 m = texture2D(uMap, vUv);
    col = mix(col, m.rgb * uColor * 2.0, uMapStrength * m.a);
    a = max(a, m.a * uMapStrength * 0.85 * (0.75 + 0.25 * flow));
  }
  // dissolve into wisps at the bottom
  float d = (vLocal.y - uDissolveY) / max(uDissolveSoft, 1e-3) + (wisps - 0.5) * 1.5;
  a *= smoothstep(0.0, 1.0, d);
  // spectral flicker
  float fl = 1.0 - uFlicker * (0.5 + 0.5 * sin(uTime * 23.0) * sin(uTime * 7.0 + 1.3)) * step(0.85, fract(uTime * 0.37));
  a *= uOpacity * fl;
  gl_FragColor = vec4(col * uIntensity * a, a);
}
`;

export function createGhostMaterial({ color = 0x8fb4ff, rimColor = 0xd8e6ff, opacity = 0.85, rimPower = 2.2, intensity = 1.6, wobble = 0.015, dissolveY = -1e3, dissolveSoft = 0.3, map = null, mapStrength = 0.8, flicker = 0.25, timeUniform, additive = true } = {}) {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: timeUniform || { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uRimColor: { value: new THREE.Color(rimColor) },
      uOpacity: { value: opacity },
      uRimPower: { value: rimPower },
      uIntensity: { value: intensity },
      uWobble: { value: wobble },
      uDissolveY: { value: dissolveY },
      uDissolveSoft: { value: dissolveSoft },
      uMap: { value: map },
      uHasMap: { value: map ? 1 : 0 },
      uMapStrength: { value: mapStrength },
      uFlicker: { value: flicker },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    premultipliedAlpha: !additive,
    toneMapped: false,
  });
  m.userData.noBake = true;
  return m;
}
