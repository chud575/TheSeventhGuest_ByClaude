import * as THREE from 'three';
import { FX_NOISE } from '../../engine/fx/noise.glsl.js';
import { rng } from './lib.js';
import { height } from './terrain.js';

/**
 * Ground mist: large soft, wind-drifting sheets that hug the hillside. Each sheet is a
 * cylindrical billboard (turns about Y to face the camera) whose lower edge fades out
 * so it melts into the ground, textured with drifting 3D noise sampled in world space
 * (so neighbouring sheets read as one continuous bank). Forward-scatters the moon:
 * banks between the camera and the moon glow silver. Lightning flashes light it.
 */

const VERT = /* glsl */ `
attribute vec4 aSheet;     // xyz centre, w = seed
attribute vec2 aSize;      // width, height
varying vec2 vUv;
varying vec3 vWorld;
varying float vSeed;
varying float vCamDist;
void main() {
  vUv = uv;
  vec3 c = aSheet.xyz;
  vec3 toCam = cameraPosition - c; toCam.y = 0.0;
  float d = length(toCam);
  vec3 f = toCam / max(d, 1e-3);
  vec3 r = vec3(f.z, 0.0, -f.x);
  vec3 w = c + r * position.x * aSize.x + vec3(0.0, 1.0, 0.0) * position.y * aSize.y;
  vWorld = w;
  vSeed = aSheet.w;
  vCamDist = length(cameraPosition - w);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uMoonDir;
uniform vec3 uDark;
uniform vec3 uLit;
uniform float uOpacity;
uniform float uFlash;
varying vec2 vUv;
varying vec3 vWorld;
varying float vSeed;
varying float vCamDist;
${FX_NOISE}
void main() {
  // soft sheet shape: fades at the sides, melts at the bottom, wispy top
  float sx = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
  float bottom = smoothstep(0.0, 0.35, vUv.y);
  vec3 wind = vec3(uTime * 0.35, 0.0, uTime * 0.12);
  vec3 p = vWorld * vec3(0.16, 0.42, 0.16) + wind * 0.16 + vSeed;
  float n = fxFbm(p);
  float n2 = fxNoise(vWorld * vec3(0.5, 1.2, 0.5) + wind * 0.4 + vSeed * 3.0);
  float top = smoothstep(1.0, 0.25 + 0.35 * n, vUv.y);
  // wispy, broken banks (not flat sheets): high-contrast noise, density thinning with height
  float a = sx * bottom * top * smoothstep(0.3, 0.88, n * 0.8 + n2 * 0.34) * mix(1.0, 0.5, vUv.y);
  // fade when the camera walks into it
  a *= smoothstep(2.5, 9.0, vCamDist);
  vec3 vd = normalize(vWorld - cameraPosition);
  float mo = max(dot(vd, uMoonDir), 0.0);
  vec3 col = uDark + uLit * (0.3 + pow(mo, 4.0) * 0.55 + pow(mo, 24.0) * 0.7) * (0.7 + 0.6 * n2);
  col *= 1.0 + uFlash * 4.0;
  gl_FragColor = vec4(col, a * uOpacity);
}`;

export function buildMist({ timeUniform, moonDir, sheets, seed = 9, opacity = 0.55 }) {
  const R = rng(seed);
  const list = [];
  for (const s of sheets) {
    for (let i = 0; i < (s.count || 1); i++) {
      const x = s.x0 + (s.x1 - s.x0) * R();
      const z = s.z0 + (s.z1 - s.z0) * R();
      const w = s.w[0] + (s.w[1] - s.w[0]) * R();
      const h = s.h[0] + (s.h[1] - s.h[0]) * R();
      const y = height(x, z) - h * 0.18 + (s.lift || 0);
      list.push([x, y, z, R() * 50, w, h]);
    }
  }
  const base = new THREE.PlaneGeometry(1, 1, 1, 1);
  base.translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.attributes.position);
  g.setAttribute('uv', base.attributes.uv);
  g.setAttribute('aSheet', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap((l) => l.slice(0, 4))), 4));
  g.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap((l) => l.slice(4, 6))), 2));
  g.instanceCount = list.length;
  const uniforms = {
    uTime: timeUniform,
    uMoonDir: { value: moonDir.clone().normalize() },
    uDark: { value: new THREE.Color(0.03, 0.034, 0.043) },
    uLit: { value: new THREE.Color(0.072, 0.078, 0.092) },
    uOpacity: { value: opacity },
    uFlash: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  mat.userData.noBake = true;
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'GroundMist';
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.userData.noBake = true;
  return { mesh, uniforms };
}
