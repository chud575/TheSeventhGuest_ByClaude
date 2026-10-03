import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

/**
 * Surface treatments for the gallery:
 *  - patchWallpaper(): paper seams every 53 cm, soot plumes above the gas jets, smoke-darkened frieze band
 *  - makeReflectiveFloor(): varnished boards with a blurred planar reflection (long streaks of every flame)
 *  - frameGeometry(): stepped gilt frame (cove, torus, flat, sight bead) with per-profile cavity colours
 *  - giltMaterial(): metal gilt that reads dark in recesses and bright only on raised edges
 *  - mahoganyTexture(): figured quartersawn mahogany for doors
 */

// ----------------------------------------------------------------------------- wallpaper
export function patchWallpaper(mat, sconces = []) {
  const n = Math.max(1, sconces.length);
  const arr = sconces.length ? sconces : [new THREE.Vector3(0, -50, 0)];
  const uniforms = { uSconce: { value: arr }, };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGWorld; varying vec3 vGNrm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz; vGNrm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGWorld; varying vec3 vGNrm;
uniform vec3 uSconce[${n}];
float gHash(float x) { return fract(sin(x * 91.17) * 43758.5); }
float gH2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gVN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gH2(i), gH2(i + vec2(1, 0)), f.x), mix(gH2(i + vec2(0, 1)), gH2(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  float along = abs(vGNrm.x) > 0.5 ? vGWorld.z : vGWorld.x;
  float strip = floor(along / 0.533);
  float f = fract(along / 0.533);
  float seam = smoothstep(0.004, 0.0, f) + smoothstep(0.996, 1.0, f);
  float lift = smoothstep(0.012, 0.004, f) * (1.0 - seam);
  // each strip printed from a slightly different dye lot / faded differently
  diffuseColor.rgb *= 0.95 + 0.08 * gHash(strip + 3.0);
  diffuseColor.rgb *= 1.0 - 0.35 * seam;
  diffuseColor.rgb += 0.012 * lift;
  // smoke: darker toward the cornice, plumes above every gas jet
  float soot = smoothstep(2.3, 3.2, vGWorld.y) * 0.35;
  for (int i = 0; i < ${n}; i++) {
    vec3 d = vGWorld - uSconce[i];
    float up = clamp(d.y / 1.4, 0.0, 1.0);
    float w = 0.12 + 0.35 * up;
    soot += 0.55 * exp(-(dot(d.xz, d.xz)) / (w * w)) * smoothstep(-0.05, 0.25, d.y) * (1.0 - 0.55 * up);
  }
  diffuseColor.rgb *= 1.0 - clamp(soot, 0.0, 0.7);
  // large-scale fading and grime on world coordinates (breaks up the repeat): sun-faded patches,
  // darker damp bloom low on the wall, faint tide lines
  vec2 wq = vec2(along, vGWorld.y);
  float big = gVN(wq * 0.55) * 0.6 + gVN(wq * 1.7 + 4.0) * 0.4;
  diffuseColor.rgb *= 0.86 + 0.24 * big;
  float damp = smoothstep(1.4, 0.95, vGWorld.y) * smoothstep(0.45, 0.75, gVN(wq * vec2(0.9, 0.5) + 9.0));
  diffuseColor.rgb *= 1.0 - 0.22 * damp;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.33))) * vec3(1.0, 0.95, 0.85), 0.18 * smoothstep(0.55, 0.85, big));
}`);
  };
  mat.customProgramCacheKey = () => `gallery-wallpaper2-${n}`;
  mat.needsUpdate = true;
  return mat;
}

// ----------------------------------------------------------------------------- floor with planar reflection
/**
 * Plane in XZ (centre cx,cz, size w x l) whose material samples a blurred planar reflection.
 * Returns the Reflector mesh (already rotated); add it to the scene.
 */
export function makeReflectiveFloor(ctx, baseMat, { w, l, cx = 0, cz = 0, y = 0, res = 0.5, strength = 1.0, blur = 1.0, uvFn } = {}) {
  const g = new THREE.PlaneGeometry(w, l);
  if (uvFn) uvFn(g);
  const W = Math.max(256, Math.round((ctx.renderer.domElement.width || 1232) * res));
  const H = Math.max(256, Math.round((ctx.renderer.domElement.height || 928) * res));
  const refl = new Reflector(g, { textureWidth: W, textureHeight: H, clipBias: 0.003, multisample: 0 });
  refl.rotation.x = -Math.PI / 2;
  refl.position.set(cx, y, cz);
  refl.name = 'floor';
  refl.userData.dynamic = true;
  const rt = refl.getRenderTarget();
  rt.texture.generateMipmaps = false;
  rt.texture.minFilter = THREE.LinearFilter;
  // steal the reflector's texture matrix from its own ShaderMaterial before swapping materials
  const texMat = refl.material.uniforms.textureMatrix.value;
  refl.material.dispose();
  const mat = baseMat;
  const uniforms = {
    tRefl: { value: rt.texture },
    uTexMat: { value: texMat },
    uReflStrength: { value: strength },
    uBlur: { value: blur },
    uTexel: { value: new THREE.Vector2(1 / W, 1 / H) },
  };
  mat.userData.reflUniforms = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uTexMat; varying vec4 vReflUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvReflUv = uTexMat * vec4(position, 1.0);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tRefl; uniform float uReflStrength; uniform float uBlur; uniform vec2 uTexel;
varying vec4 vReflUv;`)
      .replace('#include <opaque_fragment>', `
{
  vec2 ruv = vReflUv.xy / vReflUv.w;
  // the board normals ripple the image; roughness stretches it into vertical streaks
  ruv += normal.xy * 0.012;
  float r = clamp(roughnessFactor, 0.05, 1.0);
  vec2 stepv = vec2(uTexel.x * 1.5, uTexel.y * (4.0 + 26.0 * r)) * uBlur;
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int i = -6; i <= 6; i++) {
    float fi = float(i);
    float wgt = exp(-fi * fi / 18.0);
    acc += texture2D(tRefl, ruv + vec2(stepv.x * sin(fi * 2.1), stepv.y * fi)).rgb * wgt;
    wsum += wgt;
  }
  vec3 refl = acc / wsum;
  vec3 V = normalize(vViewPosition);
  float ndv = clamp(dot(normalize(normal), V), 0.0, 1.0);
  float fres = 0.035 + 0.965 * pow(1.0 - ndv, 5.0);
  outgoingLight += refl * fres * uReflStrength * (1.0 - 0.75 * r);
}
#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'gallery-floor-refl';
  mat.needsUpdate = true;
  refl.material = mat;
  return refl;
}

// ----------------------------------------------------------------------------- gilt frames
/** profile points from the outer back edge to the sight edge: [x outward from sight, z height, cavity(0 deep..1 raised)] */
export const FRAME_PROFILES = {
  ornate: (fw) => [
    [fw, 0.0, 0.3], [fw, 0.03, 0.55], [fw - 0.004, 0.042, 0.9], [fw - 0.01, 0.046, 1.0], [fw - 0.016, 0.04, 0.45],
    [fw - 0.02, 0.046, 0.7], [fw - 0.028, 0.058, 1.0], [fw - 0.038, 0.06, 1.0], [fw - 0.048, 0.054, 0.75],
    [fw * 0.48, 0.034, 0.2], [fw * 0.4, 0.03, 0.15], [fw * 0.34, 0.032, 0.35], [0.03, 0.033, 0.55],
    [0.024, 0.04, 0.95], [0.017, 0.036, 0.7], [0.012, 0.026, 0.3], [0.006, 0.028, 0.75], [0.0, 0.02, 0.5], [0.0, 0.0, 0.2],
  ],
  slim: (fw) => [
    [fw, 0.0, 0.3], [fw, 0.022, 0.6], [fw - 0.006, 0.03, 1.0], [fw * 0.55, 0.02, 0.25], [0.012, 0.022, 0.6], [0.006, 0.026, 1.0], [0.0, 0.016, 0.4], [0.0, 0.0, 0.2],
  ],
};

/**
 * Mitred rectangular frame from a profile. Facing +Z, origin = centre of the sight opening.
 * Vertex colour = cavity (rgb), plus a red-bole tint on the raised corners.
 */
export function frameGeometry(w, h, profile) {
  const pos = [], col = [], uv = [], idx = [];
  const hw = w / 2, hh = h / 2;
  // corners of the sight opening, CCW; side i runs corner i -> i+1, outward normal o
  const C = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  const O = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  let base = 0;
  for (let s = 0; s < 4; s++) {
    const a = C[s], b = C[(s + 1) % 4], o = O[s];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dir = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    let vacc = 0;
    for (let k = 0; k < profile.length; k++) {
      const [x, z, cav] = profile[k];
      if (k > 0) vacc += Math.hypot(x - profile[k - 1][0], z - profile[k - 1][1]);
      // mitre: at corner a the outward offset x also extends backward along -dir
      const pa = [a[0] + o[0] * x - dir[0] * x, a[1] + o[1] * x - dir[1] * x];
      const pb = [b[0] + o[0] * x + dir[0] * x, b[1] + o[1] * x + dir[1] * x];
      pos.push(pa[0], pa[1], z, pb[0], pb[1], z);
      const c = 0.2 + 0.8 * cav;
      col.push(c, c, c, c, c, c);
      uv.push(0, vacc * 6, (len + 2 * x) * 2.5, vacc * 6);
    }
    for (let k = 0; k < profile.length - 1; k++) {
      const i0 = base + k * 2;
      idx.push(i0, i0 + 1, i0 + 3, i0, i0 + 3, i0 + 2);
    }
    base += profile.length * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  // ensure normals face outward/up (+z mostly); flip triangles that face backward
  const n = ng.attributes.normal;
  let flip = 0; for (let i = 0; i < n.count; i++) flip += n.getZ(i);
  if (flip < 0) { const p = ng.attributes.position; for (let i = 0; i < p.count; i += 3) for (const attr of ['position', 'color', 'uv']) { const a = ng.attributes[attr], s = a.itemSize; for (let k = 0; k < s; k++) { const t = a.array[(i + 1) * s + k]; a.array[(i + 1) * s + k] = a.array[(i + 2) * s + k]; a.array[(i + 2) * s + k] = t; } } ng.computeVertexNormals(); }
  return ng;
}

export function giltMaterial(ctx, { tone = 1.0, rough = 0.26, wear = 0.45 } = {}) {
  // carved acanthus/scroll relief rolls along every rail (normal + roughness only; the cavity
  // vertex colour still darkens the recesses), so frames read as cast ornament, not bars
  const set = ctx.materials.textures('gilded', { pattern: 1, repeats: 3, wear, dirt: 0.5 });
  const t = set.withRepeat(1.4, 1.6);
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.83 * tone, 0.62 * tone, 0.3 * tone),
    metalness: 1, roughness: rough, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.55, 0.55),
    vertexColors: true, envMapIntensity: 0.6, clearcoat: 0.0, name: 'gallery-gilt',
  });
  // cavity colour multiplies albedo AND darkens recesses toward brown (bole), raised areas stay bright
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGiltMinRough = { value: rough };
    sh.fragmentShader = 'uniform float uGiltMinRough;\nfloat gGiltK = 1.0;\n' + sh.fragmentShader;
    // cavity (vertex colour): raised beads burnished bright and warm; recesses fall to ~20% with the
    // red bole ground showing through worn, dirty leaf (and that bole is not metal)
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `
#ifdef USE_COLOR
  gGiltK = smoothstep(0.28, 0.92, vColor.r);
  vec3 gBole = vec3(0.21, 0.055, 0.028);
  diffuseColor.rgb = mix(gBole * 0.55, diffuseColor.rgb * vec3(1.08, 1.0, 0.9), gGiltK);
  diffuseColor.rgb *= 0.2 + 0.85 * gGiltK;
#endif`).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  // burnished raised work ~0.25, recesses ~0.6 (the texture adds the carved breakup in between)
  roughnessFactor = mix(0.62, max(roughnessFactor * 0.6, uGiltMinRough), gGiltK);`).replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  metalnessFactor *= mix(0.25, 1.0, gGiltK);`);
  };
  m.customProgramCacheKey = () => 'gallery-gilt3';
  return m;
}

// ----------------------------------------------------------------------------- figured mahogany
export function mahoganyTexture(ctx) {
  return ctx.textures.generate('gallery:mahogany2', {
    size: 1024, aspect: 0.5, tile: true, normalStrength: 0.35,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      // u across the board (0.5 m), v along the grain (1 m)
      vec2 p = uv;
      float warp = fbm(p * vec2(1.0, 1.0), vec2(3.0, 2.0), 4);
      float warp2 = fbm(p + 3.1, vec2(6.0, 3.0), 3);
      // quartersawn ribbon stripes: long bands across u, gently wavering
      float x = p.x * 26.0 + warp * 2.2 + warp2 * 0.6;
      float rib = sin(x * TAU * 0.5) * 0.5 + 0.5;
      float fine = sin((p.x * 210.0 + warp * 12.0) * TAU * 0.5) * 0.5 + 0.5;
      // interlocked grain: ribbon brightness flips with v (chatoyance)
      float flip = sin(p.y * TAU * 3.0 + p.x * 9.0 + warp * 3.0) * 0.5 + 0.5;
      float ribbon = mix(rib, 1.0 - rib, flip);
      // pores: tiny elongated dark flecks
      float pore = smoothstep(0.78, 0.92, vnoise(p * vec2(420.0, 60.0), vec2(420.0, 60.0)));
      vec3 dark = vec3(0.16, 0.055, 0.03);
      vec3 mid = vec3(0.33, 0.12, 0.06);
      vec3 light = vec3(0.47, 0.2, 0.1);
      vec3 col = mix(dark * 1.25, mid, 0.3 + 0.45 * ribbon);
      col = mix(col, light, smoothstep(0.75, 1.0, ribbon) * 0.3);
      col *= 0.9 + 0.12 * fine;
      col *= 0.92 + 0.1 * fbm(p, vec2(2.0, 1.0), 3);
      col = mix(col, dark * 0.6, pore * 0.5);
      s.albedo = col;
      s.height = 0.5 + 0.05 * fine - 0.25 * pore;
      s.rough = 0.38 + 0.12 * pore + 0.05 * (1.0 - ribbon);
      s.metal = 0.0; s.ao = 1.0;
    }`,
  });
}
