// Small geometry helpers shared by the library's modules.
import * as THREE from 'three';
import { RoundedBoxGeometry, mergeGeometries } from '../../engine/geometry/index.js';

/** Box-project metre UVs by dominant normal, keeping existing (smooth) normals. */
export function applyBoxUVs(geometry, scale = 1) {
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position, nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  // choose the projection per triangle (by face normal) so a triangle never straddles two projections
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const nx = Math.abs(n.x), ny = Math.abs(n.y), nz = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const x = pos.getX(i + k), y = pos.getY(i + k), z = pos.getZ(i + k);
      if (nx >= ny && nx >= nz) { uv[(i + k) * 2] = z * scale; uv[(i + k) * 2 + 1] = y * scale; }
      else if (ny >= nz) { uv[(i + k) * 2] = x * scale; uv[(i + k) * 2 + 1] = z * scale; }
      else { uv[(i + k) * 2] = x * scale; uv[(i + k) * 2 + 1] = y * scale; }
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Room layout (metres). Back wall (bookcase) at Z0, entrance at Z1.
export const L = {
  X0: -4.3, X1: 1.1, Z0: -5.0, Z1: 3.8,
  H: 3.45,          // top of the walls / underside of the ceiling beams
  CEIL: 3.85,       // skylight glass plane inside the coffers
};
L.W = L.X1 - L.X0; L.D = L.Z1 - L.Z0;

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Keep only position/normal/uv, non-indexed, so anything can be merged. */
export function normGeo(g) {
  let n = g.index ? g.toNonIndexed() : g;
  if (!n.attributes.normal) n.computeVertexNormals();
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
  n.morphAttributes = {};
  return n;
}
export function merge(geos) {
  const list = geos.filter(Boolean).map(normGeo);
  if (!list.length) return new THREE.BufferGeometry();
  return mergeGeometries(list, false);
}

/** Rounded (bevelled) box with metre UVs projected by face normal. */
export function bbox(w, h, d, r = 0.006, uvScale = 1, seg = 2) {
  const rr = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const g = new RoundedBoxGeometry(w, h, d, seg, Math.max(rr, 1e-4));
  return applyBoxUVs(g, uvScale);
}
/** bbox placed at (x,y,z) with optional rotation (Euler y / x / z). */
export function bboxAt(w, h, d, x, y, z, { r = 0.006, uv = 1, ry = 0, rx = 0, rz = 0 } = {}) {
  const g = bbox(w, h, d, r, uv);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}
export function at(g, x, y, z, { ry = 0, rx = 0, rz = 0, s = 1 } = {}) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s));
  g.applyMatrix4(m);
  return g;
}
export function lathe(points, seg = 32, uvScale = 0) {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg);
  if (uvScale) return applyBoxUVs(g, uvScale);
  return g;
}
/** Extrude a 2D outline (array of [x,y]) along +Z with a soft bevel; returns metre-UV geometry centred on z. */
export function extrudeOutline(pts, depth, { bevel = 0.004, uv = 1, curveSegments = 12 } = {}) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-4, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments });
  g.translate(0, 0, -depth / 2 + bevel);
  return applyBoxUVs(g, uv);
}
/** Fluted column shaft (cylinder with concave flutes), UV u = angle*r (metres), v = y. */
export function flutedShaft(r, h, { flutes = 16, depth = 0.006, radial = 96, hseg = 1, taper = 0.92 } = {}) {
  const g = new THREE.CylinderGeometry(r * taper, r, h, radial, hseg, true);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const a = Math.atan2(z, x);
    const rr = Math.hypot(x, z);
    const f = Math.pow(Math.abs(Math.cos(a * flutes / 2)), 0.6);
    const ends = Math.min(1, Math.min(y + h / 2, h / 2 - y) / 0.06);
    const nr = rr - depth * (1 - f) * ends;
    pos.setXYZ(i, Math.cos(a) * nr, y, Math.sin(a) * nr);
    uv.setXY(i, uv.getX(i) * 2 * Math.PI * r, (y + h / 2));
  }
  g.computeVertexNormals();
  return g;
}

/** Mesh helper that names and flags shadow casting. */
export function mesh(geo, mat, name, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

/** World-space low-frequency albedo variation (breaks up texture tiling on walls). */
export function addMacro(material, { amount = 0.25, scale = 0.7, key = 'macro' } = {}) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    prev?.call(material, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMacroW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMacroW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vMacroW;
float mHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float mNoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(mHash(i), mHash(i + vec3(1, 0, 0)), f.x), mix(mHash(i + vec3(0, 1, 0)), mHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(mHash(i + vec3(0, 0, 1)), mHash(i + vec3(1, 0, 1)), f.x), mix(mHash(i + vec3(0, 1, 1)), mHash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  { float mn = mNoise(vMacroW * ${scale.toFixed(3)}) * 0.6 + mNoise(vMacroW * ${(scale * 2.7).toFixed(3)}) * 0.4;
    diffuseColor.rgb *= 1.0 - ${amount.toFixed(3)} * (mn - 0.35); }`);
  };
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|${key}-${amount}-${scale}`;
  return material;
}
