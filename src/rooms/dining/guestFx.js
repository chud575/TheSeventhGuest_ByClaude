import * as THREE from 'three';
import { unpackMesh, guestSDF, GUESTS } from './guestSculpt.js';

/**
 * Spectral-guest material. The figures are almost clear: what you see is a cold
 * Fresnel rim (power ~3) tracing the silhouette and the sculpted planes of brow,
 * cheek and dress, a faint warm inner rim on the side that faces the candlelit
 * table, and a whisper of interior mist. The body fades out toward the lap/hem,
 * and a slow upward-scrolling noise both bends the surface (heat-shimmer) and
 * frays the lower edge into rising wisps. Additive, no depth write, front faces
 * only, so overlapping layers never self-occlude into static.
 */
const NOISE = /* glsl */ `
float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.875; }
`;
const VERT = /* glsl */ `
uniform float uTime;
uniform float uSeed;
varying vec3 vN;
varying vec3 vNl;
varying vec3 vW;
varying vec3 vL;
${NOISE}
void main() {
  vec3 p = position;
  vL = p;
  // slow upward-scrolling shimmer: a few millimetres along the normal, stronger toward the lap
  float low = 1.0 - smoothstep(0.7, 1.25, p.y);
  float w = vnoise(p * vec3(9.0, 5.0, 9.0) + vec3(uSeed, -uTime * 0.45, 0.0)) - 0.5;
  p += normal * w * (0.004 + 0.012 * low);
  p.x += sin(p.y * 7.0 - uTime * 0.9 + uSeed) * 0.006 * low;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  vNl = normal;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uRim;
uniform vec3 uWarm;
uniform float uOpacity;
uniform float uIntensity;
uniform float uSeed;
varying vec3 vN;
varying vec3 vNl;
varying vec3 vW;
varying vec3 vL;
${NOISE}
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  vec3 nl = normalize(vNl);
  if (dot(n, v) < 0.0) { n = -n; nl = -nl; }
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 4.0);
  // soft top/front key so brows, noses, cheekbones and shoulders hold a little form
  float key = max(dot(nl, normalize(vec3(0.1, 0.8, 0.6))), 0.0);
  // warm inner rim on the side facing the table (+z local) where the candles are
  float warm = pow(1.0 - ndv, 1.8) * smoothstep(0.0, 0.8, nl.z);
  // vertical fade: solid head and shoulders, thinning through the bodice, gone by the hem
  float hgt = smoothstep(0.64, 1.14, vL.y);
  // frayed lower edge: upward-scrolling low-frequency noise erodes the fade line into wisps
  vec3 q = vL * vec3(5.0, 3.2, 5.0) + vec3(uSeed, -uTime * 0.3, uSeed * 0.7);
  float e = fbm(q + 0.5 * vec3(fbm(q * 0.6 + 3.1), 0.0, fbm(q * 0.6 + 9.7)));
  float mask = smoothstep(0.72 - hgt * 0.9, 0.92 - hgt * 0.9, e);
  float mist = fbm(vL * 4.0 + vec3(0.0, -uTime * 0.35, uTime * 0.12));
  float a = (0.012 + 0.75 * fres + 0.02 * key * key + 0.012 * mist) * mask;
  vec3 col = uColor * (0.15 + 0.35 * key * key + 0.12 * mist) + uRim * fres * 1.5 + uWarm * warm * 1.1;
  gl_FragColor = vec4(col * uIntensity * a * uOpacity, 1.0);
}
`;

export function createGuestMaterial(ctx, { color = 0x8fa6e8, rim = 0xdce6ff, warm = 0xffb27a, intensity = 1.0, seed = 0 } = {}) {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uTime: ctx.time || { value: 0 },
      uColor: { value: new THREE.Color(color) }, uRim: { value: new THREE.Color(rim) }, uWarm: { value: new THREE.Color(warm) },
      uOpacity: { value: 0 }, uIntensity: { value: intensity }, uSeed: { value: seed },
    },
    // premultiplied additive: colour already carries the alpha
    transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    toneMapped: false, side: THREE.FrontSide,
  });
  m.userData.noBake = true;
  return m;
}

/**
 * Pearl strands for the ladies: real 6 mm beads, projected onto the sculpted bodice
 * (the SDF is evaluated here to find the surface), merged into the figure's mesh so
 * they share the spectral shader.
 */
function pearlStrands(name) {
  const o = GUESTS[name];
  if (!o?.lady) return null;
  const f = guestSDF(o);
  const r = 0.003, gap = 0.0068;
  const strands = name === 'pearls' ? [[1.135, 0.06, 0.058], [1.13, 0.1, 0.064], [1.125, 0.145, 0.07]] : [[1.13, 0.085, 0.06]];
  const beads = [];
  for (const [yTop, drop, half] of strands) {
    // walk the curve at even arc length
    const curve = (t) => [half * t, yTop - drop * (1 - t * t) * (1 - 0.15 * t * t)];
    let prev = curve(-1), acc = 0;
    for (let i = 1; i <= 400; i++) {
      const t = -1 + (2 * i) / 400, c = curve(t);
      acc += Math.hypot(c[0] - prev[0], c[1] - prev[1]); prev = c;
      if (acc < gap) continue;
      acc = 0;
      // march in from the front until we meet the dress, then rest the bead on it
      let z = 0.55;
      for (let k = 0; k < 220 && z > -0.1; k++) { const d = f(c[0], c[1], z); if (d < r * 0.9) break; z -= Math.max(d - r, 0.0015); }
      beads.push([c[0], c[1], z + r * 0.3]);
    }
  }
  const sg = new THREE.SphereGeometry(r, 8, 6);
  const parts = beads.map(([x, y, z]) => sg.clone().translate(x, y, z));
  const pos = [], nor = [], idx = [];
  for (const g of parts) {
    const base = pos.length / 3;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (const i of g.index.array) idx.push(base + i);
  }
  return { positions: pos, normals: nor, indices: idx };
}

/** load a baked guest mesh (see tools/bake_guests.mjs) */
export async function loadGuestGeometry(url, name) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`guest mesh ${url}: ${res.status}`);
  let { positions, normals, indices } = unpackMesh(await res.arrayBuffer());
  const extra = name ? pearlStrands(name) : null;
  if (extra) {
    const nv = positions.length / 3;
    const P = new Float32Array(positions.length + extra.positions.length); P.set(positions); P.set(extra.positions, positions.length);
    const N = new Float32Array(normals.length + extra.normals.length); N.set(normals); N.set(extra.normals, normals.length);
    const I = new Uint32Array(indices.length + extra.indices.length); I.set(indices); for (let i = 0; i < extra.indices.length; i++) I[indices.length + i] = nv + extra.indices[i];
    positions = P; normals = N; indices = I;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.computeBoundingSphere();
  return g;
}
