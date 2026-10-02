import * as THREE from 'three';
import { FX_NOISE } from './noise.glsl.js';

/**
 * Animated candle / lamp flame: a camera-facing (cylindrical billboard) quad with a
 * procedural flame shader in HDR (blooms nicely), plus a deterministic flicker
 * function shared with the companion light so light and flame dance together.
 */

export function flicker(t, seed = 0) {
  // deterministic, organic flicker in ~[0.75, 1.1]
  const s = seed * 13.37;
  const a = Math.sin(t * 7.3 + s) * 0.5 + Math.sin(t * 13.1 + s * 1.7) * 0.3 + Math.sin(t * 23.7 + s * 0.3) * 0.2;
  const b = Math.sin(t * 1.3 + s * 2.1) * 0.5 + 0.5;
  const gust = Math.max(0, Math.sin(t * 0.37 + s)) ** 8;
  return 0.92 + a * 0.06 * (0.6 + b) - gust * 0.18;
}

const VERT = /* glsl */ `
uniform float uTime;
uniform float uSeed;
varying vec2 vUv;
void main() {
  vUv = uv;
  // cylindrical billboard: keep local Y, face camera around it
  vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 up = normalize((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vec3 toCam = cameraPosition - center;
  toCam -= up * dot(toCam, up);            // project onto the plane orthogonal to up
  float tl = length(toCam);
  vec3 right = tl > 1e-4 ? normalize(cross(up, toCam / tl)) : normalize(cross(up, vec3(0.0, 0.0, 1.0) + up.yzx * 0.01));
  float sx = length((modelMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  float sy = length((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  // sway the tip
  float sway = sin(uTime * 3.1 + uSeed) * 0.04 + sin(uTime * 7.7 + uSeed * 2.0) * 0.02;
  vec3 pos = center + right * (position.x * sx + sway * sx * uv.y * uv.y) + up * position.y * sy;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uIntensity;
uniform vec3 uColorCore;
uniform vec3 uColorOuter;
uniform vec3 uColorBase;
varying vec2 vUv;
${FX_NOISE}
void main() {
  vec2 p = vec2(vUv.x * 2.0 - 1.0, vUv.y);
  float t = uTime;
  float n = fxNoise(vec3(p.x * 3.0, p.y * 4.0 - t * 6.0, uSeed + t * 0.7));
  float n2 = fxNoise(vec3(p.x * 7.0, p.y * 9.0 - t * 11.0, uSeed * 2.0));
  // teardrop width profile
  float y = p.y;
  float w = 0.55 * pow(max(y, 0.0), 0.45) * pow(max(1.0 - y, 0.0), 1.1) * 1.9;
  float x = p.x + (n - 0.5) * 0.25 * y * y + (n2 - 0.5) * 0.06 * y;
  float d = abs(x) / max(w, 1e-3);
  float body = (1.0 - smoothstep(0.55, 1.0, d)) * smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.85, 1.0, y + (n - 0.5) * 0.15));
  float core = (1.0 - smoothstep(0.0, 0.55, d)) * smoothstep(0.08, 0.25, y) * (1.0 - smoothstep(0.35, 0.7, y));
  float base = (1.0 - smoothstep(0.3, 1.0, d)) * (1.0 - smoothstep(0.05, 0.22, y)) * smoothstep(0.0, 0.05, y);
  vec3 col = uColorOuter * body;
  col = mix(col, uColorCore * 1.6, core);
  col += uColorBase * base * 0.8;
  // soft outer glow halo (helps bloom, avoids hard billboard edge)
  float halo = exp(-length(vec2(p.x * 1.4, (p.y - 0.35) * 1.1)) * 4.5) * 0.12;
  col += uColorOuter * halo;
  float a = clamp(body + halo + base * 0.5, 0.0, 1.0);
  gl_FragColor = vec4(col * uIntensity, a);
}
`;

export function createFlameMaterial({ intensity = 9, seed = 0, core = [1.0, 0.92, 0.7], outer = [1.0, 0.45, 0.1], base = [0.25, 0.35, 1.0], timeUniform } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: timeUniform || { value: 0 },
      uSeed: { value: seed },
      uIntensity: { value: intensity },
      uColorCore: { value: new THREE.Vector3(...core) },
      uColorOuter: { value: new THREE.Vector3(...outer) },
      uColorBase: { value: new THREE.Vector3(...base) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
}

let flameGeo = null;
export function createFlame({ height = 0.045, width = 0.018, ...opts } = {}) {
  flameGeo ||= (() => { const g = new THREE.PlaneGeometry(1, 1, 1, 8); g.translate(0, 0.5, 0); return g; })();
  const m = new THREE.Mesh(flameGeo, createFlameMaterial(opts));
  m.scale.set(width * 2.2, height, 1);
  m.renderOrder = 10;
  m.frustumCulled = false;
  m.castShadow = false; m.receiveShadow = false;
  m.userData.isFlame = true;
  return m;
}
