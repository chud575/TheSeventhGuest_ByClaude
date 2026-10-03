import * as THREE from 'three';

/**
 * The figure on the burning stair: a tall, gaunt man in a long frock coat and a
 * stovepipe hat, one hand on a cane, the other lifted to beckon. Rendered as a
 * smoky, dark silhouette against the furnace glow: near-opaque at the core, a hot
 * fresnel rim where the backlight wraps the edges, and drifting noise that eats
 * the outline and dissolves the hem into smoke.
 */

const VERT = /* glsl */ `
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
varying vec3 vL;
void main() {
  vec3 p = position;
  float sway = sin(uTime * 0.9 + p.y * 2.2) * 0.012 * smoothstep(0.9, 0.0, p.y);
  p.x += sway; p.z += sway * 0.6;
  vL = p;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uCore;
uniform vec3 uRim;
uniform float uRimGain;
varying vec3 vN;
varying vec3 vV;
varying vec3 vL;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fb(vec3 p) { return 0.5 * n3(p) + 0.25 * n3(p * 2.02 + 3.1) + 0.125 * n3(p * 4.03 + 7.7) + 0.0625 * n3(p * 8.1 + 1.3); }
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float ndv = clamp(abs(dot(n, normalize(vV))), 0.0, 1.0);
  float edge = 1.0 - ndv;
  float fres = pow(edge, 1.6);
  vec3 q = vL * vec3(7.0, 3.5, 7.0) + vec3(0.0, -uTime * 0.45, uTime * 0.12);
  float smoke = fb(q);
  float smoke2 = fb(vL * vec3(18.0, 6.0, 18.0) + vec3(0.0, -uTime * 0.9, 0.0));
  // body: an opaque core of shadow; toward the silhouette it thins into smoke and the outline frays
  float a = 1.0 - smoothstep(0.66, 1.02, edge + (smoke - 0.5) * 0.4);
  // holes drift through the lower coat
  a *= 1.0 - smoothstep(0.62, 0.8, smoke2) * smoothstep(1.0, 0.2, vL.y) * 0.8;
  // hem dissolves into smoke trailing over the boards
  float hem = smoothstep(0.0, 0.6, vL.y + (smoke2 - 0.5) * 0.45);
  a *= hem;
  // furnace light wraps the edges: a soft, broken, smouldering rim (not a clean outline)
  float rim = smoothstep(0.6, 0.97, edge) * smoothstep(0.3, 0.75, smoke2) * uRimGain;
  vec3 col = uCore * (0.5 + 0.7 * smoke) + uRim * rim * (0.6 + 0.6 * smoke);
  a = clamp((a + rim * 0.25) * uOpacity, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

export function apparitionMaterial(timeUniform, { core = 0x0a0403, rim = 0xff6a2a, opacity = 0.8, rimGain = 2.2 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uTime: timeUniform || { value: 0 },
      uOpacity: { value: opacity },
      uCore: { value: new THREE.Color(core) },
      uRim: { value: new THREE.Color(rim).multiplyScalar(1.0) },
      uRimGain: { value: rimGain },
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, name: 'apparition',
  });
}

/** elliptical lathe: profile [[r, y]], squashed front-to-back */
function latheE(pts, seg, sz = 0.62) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), seg);
  g.scale(1, 1, sz);
  return g;
}
/** tapered tube along points (radius per point) */
function limb(points, radii, seg = 10) {
  const curve = new THREE.CatmullRomCurve3(points);
  const tubular = 24;
  const g = new THREE.TubeGeometry(curve, tubular, 1, seg, false);
  const p = g.attributes.position, nrm = g.attributes.normal;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const k = t * (radii.length - 1), i0 = Math.floor(k), i1 = Math.min(radii.length - 1, i0 + 1);
    const r = THREE.MathUtils.lerp(radii[i0], radii[i1], k - i0);
    curve.getPointAt(t, c);
    for (let j = 0; j <= seg; j++) {
      const idx = i * (seg + 1) + j;
      v.fromBufferAttribute(nrm, idx);
      p.setXYZ(idx, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r);
    }
  }
  g.computeVertexNormals();
  return g;
}

export function buildApparition(mat) {
  const g = new THREE.Group(); g.name = 'staufSilhouette';
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // long frock coat: flared skirts, narrow waist, chest, sloping shoulders
  const robe = latheE([[0, 0.0], [0.29, 0.02], [0.27, 0.15], [0.225, 0.45], [0.185, 0.78], [0.152, 0.98], [0.162, 1.12], [0.188, 1.28], [0.2, 1.36], [0.185, 1.43], [0.14, 1.49], [0.08, 1.53], [0.05, 1.57], [0, 1.6]], 64, 0.58);
  { const p = robe.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x); const k = Math.max(0, 1 - y / 1.0); const f = 1 + k * (0.09 * Math.sin(a * 7 + 0.4) + 0.05 * Math.sin(a * 13 + 1.1)); p.setXYZ(i, x * f, y + k * 0.03 * Math.sin(a * 5), z * f); } robe.computeVertexNormals(); }
  g.add(new THREE.Mesh(robe, mat));
  // collar points flaring up
  g.add(new THREE.Mesh(latheE([[0.07, 1.48], [0.095, 1.53], [0.085, 1.6], [0.06, 1.62]], 18, 0.8), mat));
  // head: long skull, gaunt jaw
  // head + neck baked in figure space (the shader's smoke and hem fade read local Y)
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 16).scale(0.78, 1.14, 0.92).rotateX(0.18).translate(0, 1.675, 0.03), mat));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.12, 12).translate(0, 1.58, 0.0), mat));
  // stovepipe hat
  g.add(new THREE.Mesh(latheE([[0.0, 1.765], [0.125, 1.76], [0.13, 1.772], [0.085, 1.785], [0.078, 1.8], [0.084, 1.95], [0.086, 1.965], [0, 1.965]], 24, 0.9), mat));
  // left arm hanging onto a cane
  g.add(new THREE.Mesh(limb([V(-0.17, 1.4, 0), V(-0.22, 1.2, 0.02), V(-0.235, 1.0, 0.06), V(-0.24, 0.87, 0.1)], [0.058, 0.046, 0.046, 0.054]), mat));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10).scale(0.8, 1.2, 1).translate(-0.24, 0.82, 0.11), mat));
  g.add(new THREE.Mesh(limb([V(-0.24, 0.85, 0.11), V(-0.27, 0.4, 0.16), V(-0.29, 0.0, 0.2)], [0.012, 0.011, 0.01], 6), mat));
  // right arm raised, long fingers curling to beckon
  g.add(new THREE.Mesh(limb([V(0.17, 1.4, 0), V(0.25, 1.22, 0.08), V(0.29, 1.24, 0.24), V(0.3, 1.35, 0.35)], [0.058, 0.046, 0.044, 0.05]), mat));
  for (let k = 0; k < 4; k++) {
    const a = -0.3 + k * 0.2;
    g.add(new THREE.Mesh(limb([V(0.3, 1.38, 0.37), V(0.3 + Math.sin(a) * 0.04, 1.47, 0.4), V(0.3 + Math.sin(a) * 0.06, 1.52, 0.36), V(0.3 + Math.sin(a) * 0.06, 1.5, 0.32)], [0.011, 0.009, 0.007, 0.005], 5), mat));
  }
  g.traverse((o) => { if (o.isMesh) { o.userData.noBake = true; o.userData.noShadow = true; o.renderOrder = 7; o.frustumCulled = false; } });
  return g;
}
