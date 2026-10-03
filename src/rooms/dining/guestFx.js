import * as THREE from 'three';
import { unpackMesh } from './guestSculpt.js';

/**
 * Spectral-guest material: Fresnel-only opacity (the body is nearly clear, the
 * silhouette and the sculpted planes of face and dress catch a cold rim), a soft
 * top light so brows, noses and shoulders read, and a scrolling 3D-noise erosion
 * that eats the figure away from the lap down into rising wisps.
 */
const VERT = /* glsl */ `
uniform float uTime;
varying vec3 vN;
varying vec3 vW;
varying vec3 vL;
void main() {
  vec3 p = position;
  // (no vertex wobble: the depth pre-pass must match exactly)
  vL = p;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uRim;
uniform float uOpacity;
uniform float uIntensity;
uniform float uSeed;
varying vec3 vN;
varying vec3 vW;
varying vec3 vL;
float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.9375; }
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  if (dot(n, v) < 0.0) n = -n;
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.4);
  float key = max(dot(n, normalize(vec3(0.15, 1.0, 0.45))), 0.0);
  // erosion: solid head and shoulders, eaten away below the chest into rising wisps
  vec3 q = vL * vec3(7.0, 4.5, 7.0) + vec3(uSeed, -uTime * 0.35, uSeed * 0.7);
  float e = fbm(q + 0.6 * vec3(fbm(q * 0.5 + 3.1), 0.0, fbm(q * 0.5 + 9.7)));
  float hgt = clamp((vL.y - 0.5) / 0.55, 0.0, 1.0);
  float thr = pow(1.0 - hgt, 1.15) * 0.8;
  float mask = smoothstep(thr - 0.06, thr + 0.06, e);
  float edge = clamp(mask * (1.0 - mask) * 4.0, 0.0, 1.0) * (1.0 - hgt);
  // drifting inner mist so the figure is never a flat shell
  float mist = fbm(vL * 9.0 + vec3(0.0, -uTime * 0.6, uTime * 0.2));
  float a = (mix(0.025, 0.5, fres) + 0.06 * key * key + 0.05 * mist) * mask + edge * 0.22;
  vec3 col = uColor * (0.35 + 0.9 * key * key + 0.25 * mist) + uRim * fres * 1.25 + uRim * edge * 0.9;
  gl_FragColor = vec4(col * uIntensity, a * uOpacity);
}
`;

export function createGuestMaterial(ctx, { color = 0x7f9eff, rim = 0xd6e4ff, intensity = 0.7, seed = 0 } = {}) {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uTime: ctx.time || { value: 0 },
      uColor: { value: new THREE.Color(color) }, uRim: { value: new THREE.Color(rim) },
      uOpacity: { value: 0 }, uIntensity: { value: intensity }, uSeed: { value: seed },
    },
    transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth,
    blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.FrontSide,
  });
  m.userData.noBake = true;
  return m;
}

/** load a baked guest mesh (see tools/bake_guests.mjs) */
export async function loadGuestGeometry(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`guest mesh ${url}: ${res.status}`);
  const { positions, normals, indices } = unpackMesh(await res.arrayBuffer());
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.computeBoundingSphere();
  return g;
}
