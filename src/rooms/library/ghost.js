// The library's apparition: "Mr. Quill", an original elderly scholar ghost (bust).
// The head is authored offline (tools/mh/build_head.py: CC0 MakeHuman base mesh ->
// our own ageing/shape blend, sculpted folds, painted skin, baked fine-wrinkle bump
// and freckle maps, eyeballs, hair cards); the stock and coat are SDF sculpts
// (tools/ghostSdf.mjs). tools/genGhost.mjs packs everything into ghost.bin.
import * as THREE from 'three';

async function loadParts(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ghost.bin ${res.status}`);
  const buf = await res.arrayBuffer();
  const hl = new DataView(buf).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  const base = 4 + hl;
  const parts = {};
  for (const p of header.parts) {
    const g = new THREE.BufferGeometry();
    if (header.version >= 2) {
      const q = new Int16Array(buf, base + p.pos, p.vertices * 3);
      const f = new Float32Array(p.vertices * 3);
      for (let i = 0; i < f.length; i++) { const a = i % 3; f[i] = p.qmin[a] + (q[i] + 32767) * p.qs[a]; }
      g.setAttribute('position', new THREE.BufferAttribute(f, 3));
    } else g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, base + p.pos, p.vertices * 3), 3));
    // normals are stored as 4 x int8 (xyz + pad)
    const n4 = new Int8Array(buf, base + p.nrm, p.vertices * 4);
    const n3 = new Float32Array(p.vertices * 3);
    for (let i = 0; i < p.vertices; i++) { n3[i * 3] = n4[i * 4] / 127; n3[i * 3 + 1] = n4[i * 4 + 1] / 127; n3[i * 3 + 2] = n4[i * 4 + 2] / 127; }
    g.setAttribute('normal', new THREE.BufferAttribute(n3, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(buf, base + p.col, p.vertices * 4), 4, true));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(buf, base + p.idx, p.indices), 1));
    if (p.uv !== undefined) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(buf, base + p.uv, p.vertices * 2), 2));
    g.computeBoundingSphere();
    parts[p.name] = g;
  }
  return { parts, meta: header.meta || {} };
}

// shared rig for the ghost-only lights (set from the room via ghost.setRig)
const RIG = {
  keyDir: { value: new THREE.Vector3(0.6, 0.6, 0.5).normalize() }, keyCol: { value: new THREE.Color(0, 0, 0) }, sceneK: { value: 1 },
  fillDir: { value: new THREE.Vector3(-0.5, -0.6, 0.6).normalize() }, fillCol: { value: new THREE.Color(0, 0, 0) },
  rimDir: { value: new THREE.Vector3(-0.5, 0.5, -0.9).normalize() }, rimCol: { value: new THREE.Color(0, 0, 0) },
};

const NOISE_GLSL = `
float gHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1, 0, 0)), f.x), mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x), mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float gFbm(vec3 p) { return 0.5 * gNoise(p) + 0.25 * gNoise(p * 2.03 + 7.1) + 0.125 * gNoise(p * 4.1 + 3.3) + 0.0625 * gNoise(p * 8.3 + 1.7); }`;

/**
 * Lit spectral material (one family for every part of the apparition): vertex-painted PBR
 * with optional albedo/bump maps, wrap diffuse with a warm subsurface tint (skin), an
 * alpha that is densest in the core and thins to nothing at the silhouette (no cut-out
 * outline), a cold glow in an inner fresnel band, a drifting noise breakup and a soft
 * fade below `fadeY`.
 */
export function spectralMaterial({
  opacity = 1, coreAlpha = 0.78, edgeAlpha = 0.15, edgeStart = 0.35, edgeEnd = 0.95,
  rim = 0x9fb4dc, rimStrength = 0.25, rimBand = [0.2, 0.6], glow = 0.04,
  fadeY = -1, fadeSoft = 0.1, roughness = 0.6, tint = 0xc8d0dc, depthWrite = true, breakup = 0.3,
  bump = 0.0, bumpFreq = 700, desat = 0.35, wrap = 0.0, sss = [1.0, 0.45, 0.32], time = null,
  map = null, bumpMap = null, bumpScale = 1, side = THREE.FrontSide, key = '', envMapIntensity = 0.35, keySpec = 0.0, shine = 30,
} = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0, transparent: true, depthWrite, color: tint, map, bumpMap, bumpScale, side, envMapIntensity });
  const u = {
    uOpacity: { value: opacity }, uCoreA: { value: coreAlpha }, uEdgeA: { value: edgeAlpha }, uEdge: { value: new THREE.Vector2(edgeStart, edgeEnd) },
    uRim: { value: new THREE.Color(rim) }, uRimS: { value: rimStrength }, uRimBand: { value: new THREE.Vector2(...rimBand) }, uGlow: { value: glow },
    uFadeY: { value: fadeY }, uFadeSoft: { value: fadeSoft }, uBreak: { value: breakup },
    uBump: { value: bump }, uBumpF: { value: bumpFreq }, uDesat: { value: desat },
    uWrap: { value: wrap }, uSSS: { value: new THREE.Color(...sss) },
    // ghost-only lights (no cost to the room, no spill on it): warm under-fill + cold back-rim, world-space dirs
    uFillDir: RIG.fillDir, uFillCol: RIG.fillCol, uRimDir: RIG.rimDir, uRimCol: RIG.rimCol,
    uKeyDir: RIG.keyDir, uKeyCol: RIG.keyCol, uSceneK: RIG.sceneK, uKeySpec: { value: keySpec }, uShine: { value: shine },
    uTime: time || { value: 0 },
  };
  m.userData.uniforms = u;
  m.userData.noBake = true;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGp = position;');
    const lights = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      'reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;',
      'reflectedLight.directSpecular += irradiance * uSceneK * specularBRDF * material.multiScatteringCompensation;').replace(
      'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );',
      `{
        // wrap lighting: light bleeds past the terminator, reddened as if scattered under the skin
        float nl = dot( geometryNormal, directLight.direction );
        float wrapped = saturate( ( nl + uWrap ) / ( 1.0 + uWrap ) );
        vec3 sssIrr = directLight.color * uSceneK * ( dotNL + ( wrapped - dotNL ) * uSSS );
        reflectedLight.directDiffuse += sssIrr * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
      }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGp;
uniform float uOpacity, uCoreA, uEdgeA, uRimS, uGlow, uFadeY, uFadeSoft, uBreak, uBump, uBumpF, uDesat, uTime, uWrap;
uniform vec2 uEdge, uRimBand;
uniform vec3 uRim, uSSS, uFillDir, uFillCol, uRimDir, uRimCol, uKeyDir, uKeyCol;
uniform float uSceneK, uKeySpec, uShine;
${NOISE_GLSL}`)
      .replace('#include <lights_physical_pars_fragment>', lights)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (uBump > 0.0) {
    float gh = gFbm(vGp * uBumpF);
    vec2 dH = vec2(dFdx(gh), dFdy(gh)) * uBump;
    vec3 sX = dFdx(-vViewPosition), sY = dFdy(-vViewPosition);
    vec3 R1 = cross(sY, normal), R2 = cross(normal, sX);
    float fDet = dot(sX, R1);
    vec3 vGrad = sign(fDet) * (dH.x * R1 + dH.y * R2);
    normal = normalize(abs(fDet) * normal - vGrad);
  }`)
      .replace('#include <opaque_fragment>', `
  float gNdv = abs(dot(normalize(normal), normalize(vViewPosition)));
  float gFres = 1.0 - gNdv;
  {
    vec3 nV = normalize(normal);
    vec3 fd = normalize((viewMatrix * vec4(uFillDir, 0.0)).xyz);
    vec3 rd = normalize((viewMatrix * vec4(uRimDir, 0.0)).xyz);
    float fw = saturate((dot(nV, fd) + uWrap) / (1.0 + uWrap));
    outgoingLight += diffuseColor.rgb * uFillCol * fw;
    // the key: soft wrap diffuse with a reddened terminator + a broad skin sheen
    vec3 kd = normalize((viewMatrix * vec4(uKeyDir, 0.0)).xyz);
    float knl = dot(nV, kd);
    float kw = saturate((knl + uWrap) / (1.0 + uWrap));
    vec3 kdiff = uKeyCol * (saturate(knl) + (kw - saturate(knl)) * uSSS);
    vec3 hv = normalize(kd + normalize(vViewPosition));
    float ks = pow(saturate(dot(nV, hv)), uShine) * uKeySpec * saturate(knl * 4.0);
    outgoingLight += diffuseColor.rgb * kdiff + uKeyCol * ks;
    outgoingLight += uRimCol * pow(1.0 - gNdv, 2.5) * saturate(dot(nV, rd) + 0.25) * (0.35 + 0.65 * diffuseColor.rgb);
  }
  float gl = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
  outgoingLight = mix(outgoingLight, vec3(gl), uDesat);
  float gBand = smoothstep(uRimBand.x, uRimBand.y, gFres) * (1.0 - smoothstep(0.85, 1.0, gFres));
  outgoingLight += diffuseColor.rgb * uGlow + uRim * gBand * uRimS;
  float gFlow = gFbm(vGp * 22.0 + vec3(0.0, -uTime * 0.06, uTime * 0.025));
  float gBreak = mix(1.0, smoothstep(0.18, 0.62, gFlow), uBreak);
  float gFade = smoothstep(uFadeY - uFadeSoft, uFadeY + uFadeSoft, vGp.y + (gFlow - 0.5) * uFadeSoft * 1.6);
  diffuseColor.a *= min(1.0, uOpacity * mix(uCoreA, uEdgeA, smoothstep(uEdge.x, uEdge.y, gFres)) * gBreak * gFade);
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `library-spectral4-${depthWrite}-${!!map}-${!!bumpMap}-${key}`;
  return m;
}

async function loadTex(url, srgb) {
  const t = await new THREE.TextureLoader().loadAsync(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export async function buildGhost(ctx, root) {
  const group = new THREE.Group();
  group.name = 'ghost';
  let parts, meta;
  try { ({ parts, meta } = await loadParts(ctx.assetUrl('ghost.bin'))); } catch (e) { console.warn('[library] ghost mesh missing', e); return { group, materials: [] }; }
  let skinC = null, skinH = null, hairT = null;
  try {
    [skinC, skinH, hairT] = await Promise.all([
      loadTex(ctx.assetUrl('ghost_skin_c.jpg'), true), loadTex(ctx.assetUrl('ghost_skin_h.png'), false),
      parts.hair || parts.brows ? loadTex(ctx.assetUrl('ghost_hair.png'), true) : Promise.resolve(null),
    ]);
  } catch (e) { console.warn('[library] ghost maps missing', e); }
  const time = ctx.time;
  const cool = 0x9fb4dc;
  const mats = {
    // the face reads solid (the eye must find it); it only thins right at the silhouette
    head: spectralMaterial({ coreAlpha: 1.0, edgeAlpha: 0.5, edgeStart: 0.55, edgeEnd: 1.0, rim: cool, rimStrength: 0.05, rimBand: [0.45, 0.85], glow: 0.006, fadeY: -0.1, fadeSoft: 0.025, roughness: 0.5, tint: Number(ctx.params.get('gtint') || 0xb4b8c0), map: skinC, bumpMap: skinH, bumpScale: 1.2, bump: 0.00004, bumpFreq: 2600, breakup: 0.0, desat: Number(ctx.params.get('gdesat') || 0.35), wrap: Number(ctx.params.get('gwrap') || 0.3), keySpec: 0.22, shine: 22, time, key: 'skin' }),
    eye: spectralMaterial({ coreAlpha: 1.0, edgeAlpha: 1.0, rimStrength: 0.0, glow: 0.01, roughness: 0.35, tint: 0xf2f2f2, breakup: 0.0, desat: 0.12, wrap: 0.3, sss: [1, 0.7, 0.6], time, key: 'eye' }),
    cravat: spectralMaterial({ coreAlpha: 0.95, edgeAlpha: 0.25, edgeStart: 0.5, rim: cool, rimStrength: 0.12, glow: 0.01, fadeY: -0.235, fadeSoft: 0.045, roughness: 0.75, tint: 0x9c9a96, bump: 0.0004, bumpFreq: 260, breakup: 0.15, desat: 0.2, wrap: 0.5, sss: [0.9, 0.85, 0.8], time, key: 'cloth' }),
    waistcoat: spectralMaterial({ coreAlpha: 0.5, edgeAlpha: 0.05, edgeStart: 0.25, edgeEnd: 0.85, rim: cool, rimStrength: 0.35, rimBand: [0.15, 0.55], glow: 0.08, fadeY: -0.37, fadeSoft: 0.1, roughness: 0.7, tint: 0xd8e0ee, bump: 0.0003, bumpFreq: 420, breakup: 0.3, depthWrite: false, desat: 0.35, wrap: 0.3, time, key: 'wc' }),
    coat: spectralMaterial({ coreAlpha: 0.5, edgeAlpha: 0.05, edgeStart: 0.2, edgeEnd: 0.8, rim: cool, rimStrength: 0.45, rimBand: [0.12, 0.5], glow: 0.07, fadeY: -0.32, fadeSoft: 0.13, roughness: 0.78, tint: 0xd0d8e6, bump: 0.0003, bumpFreq: 380, breakup: 0.45, depthWrite: false, desat: 0.35, wrap: 0.3, time, key: 'coat' }),
    // white hair scatters light: strong wrap, a little self-glow, a cold sheen in the inner fresnel band
    hair: spectralMaterial({ map: hairT, coreAlpha: 0.95, edgeAlpha: 0.7, rim: cool, rimStrength: 0.12, rimBand: [0.3, 0.8], glow: 0.05, roughness: 0.45, tint: 0xeceae6, breakup: 0.1, depthWrite: false, desat: 0.35, wrap: 0.9, sss: [1, 0.95, 0.9], side: THREE.DoubleSide, time, key: 'hair' }),
    // cornea: black + additive, so only its wet specular and reflections land on the eye
    cornea: new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.06, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, specularIntensity: 1, envMapIntensity: 1.6, depthWrite: false }),
  };
  if (ctx.params.get('hairdbg')) mats.hair = new THREE.MeshBasicMaterial({ map: hairT, transparent: true, side: THREE.DoubleSide, depthWrite: false, vertexColors: ctx.params.get('hairdbg') === '2' });
  mats.hair.alphaTest = 0.03;
  mats.hair.userData.noBake = true; mats.cornea.userData.noBake = true;
  const matFor = (name) => (name.startsWith('eye') ? mats.eye : name.startsWith('cornea') ? mats.cornea : ['hair', 'brows', 'lashes'].includes(name) ? mats.hair : mats[name] || mats.head);
  const order = { coat: 1, waistcoat: 2, cravat: 3, head: 4, eyeL: 5, eyeR: 5, corneaL: 6, corneaR: 6, lashes: 7, brows: 7, hair: 8 };
  const meshes = {};
  const eyes = [];
  for (const [nm, ev] of Object.entries(meta.eyes || {})) {
    const pivot = new THREE.Group();
    pivot.name = `ghost-eye${nm}`;
    pivot.position.fromArray(ev.c);
    group.add(pivot);
    eyes.push(pivot);
    meshes[`pivot${nm}`] = pivot;
  }
  for (const [name, g] of Object.entries(parts)) {
    const m = new THREE.Mesh(g, matFor(name));
    m.name = `ghost-${name}`;
    m.renderOrder = 10 + (order[name] || 0);
    m.castShadow = false; m.receiveShadow = false;
    m.userData.noBake = true;
    const eyeSide = /^(eye|cornea)([LR])$/.exec(name);
    if (eyeSide && meshes[`pivot${eyeSide[2]}`]) meshes[`pivot${eyeSide[2]}`].add(m); else group.add(m);
    meshes[name] = m;
  }
  // the eyes follow the visitor (clamped), with a slight lazy lag
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), fwd = new THREE.Vector3(0, 0, 1), look = new THREE.Vector3();
  const aimEyes = (camPos, k = 1) => {
    group.updateMatrixWorld(true);
    for (const p of eyes) {
      look.copy(camPos);
      p.parent.worldToLocal(look);
      tmpV.copy(look).sub(p.position).normalize();
      // clamp to a comfortable cone (~28 deg)
      const c = Math.max(tmpV.z, Math.cos(0.5));
      if (tmpV.z < c) { const s = Math.sqrt(Math.max(0, 1 - c * c)) / Math.max(1e-6, Math.hypot(tmpV.x, tmpV.y)); tmpV.set(tmpV.x * s, tmpV.y * s, c); }
      tmpQ.setFromUnitVectors(fwd, tmpV);
      p.quaternion.slerp(tmpQ, k);
    }
  };
  const setRig = ({ fillDir, fillColor, fillI = 1, rimDir, rimColor, rimI = 1, keyDir, keyColor, keyI = 1, sceneK }) => {
    if (keyDir) RIG.keyDir.value.set(...keyDir).normalize();
    if (keyColor) RIG.keyCol.value.setRGB(...keyColor).multiplyScalar(keyI);
    if (sceneK !== undefined) RIG.sceneK.value = sceneK;
    if (fillDir) RIG.fillDir.value.set(...fillDir).normalize();
    if (fillColor) RIG.fillCol.value.setRGB(...fillColor).multiplyScalar(fillI);
    if (rimDir) RIG.rimDir.value.set(...rimDir).normalize();
    if (rimColor) RIG.rimCol.value.setRGB(...rimColor).multiplyScalar(rimI);
  };
  root.add(group);
  return { group, meshes, materials: Object.values(mats), aimEyes, setRig };
}
