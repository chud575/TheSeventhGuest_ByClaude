// The library's apparition: "Mr. Quill", an original elderly scholar ghost (bust).
// Geometry is sculpted offline (tools/ghostSdf.mjs -> tools/genGhost.mjs -> ghost.bin);
// here we load it and give it a lit-but-translucent spectral material.
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
    g.computeBoundingSphere();
    parts[p.name] = g;
  }
  return parts;
}

/**
 * Lit spectral material (one family for every part of the apparition): vertex-painted PBR,
 * translucent toward the silhouette (fresnel), a slow drifting noise breakup of the alpha,
 * fine procedural skin/cloth bump, a cold desaturating tint, and a soft fade below `fadeY`.
 */
export function spectralMaterial({ opacity = 1, coreAlpha = 0.78, edgeAlpha = 0.15, rim = 0x9fb4dc, rimStrength = 0.25, glow = 0.04, fadeY = -1, fadeSoft = 0.1, roughness = 0.6, tint = 0xc8d0dc, depthWrite = true, breakup = 0.3, bump = 0.0, bumpFreq = 700, desat = 0.35, time = null } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0, transparent: true, depthWrite, color: tint });
  const u = {
    uOpacity: { value: opacity }, uCoreA: { value: coreAlpha }, uEdgeA: { value: edgeAlpha },
    uRim: { value: new THREE.Color(rim) }, uRimS: { value: rimStrength }, uGlow: { value: glow },
    uFadeY: { value: fadeY }, uFadeSoft: { value: fadeSoft }, uBreak: { value: breakup },
    uBump: { value: bump }, uBumpF: { value: bumpFreq }, uDesat: { value: desat },
    uTime: time || { value: 0 },
  };
  m.userData.uniforms = u;
  m.userData.noBake = true;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGp = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGp;
uniform float uOpacity, uCoreA, uEdgeA, uRimS, uGlow, uFadeY, uFadeSoft, uBreak, uBump, uBumpF, uDesat, uTime;
uniform vec3 uRim;
float gHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1, 0, 0)), f.x), mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x), mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float gFbm(vec3 p) { return 0.5 * gNoise(p) + 0.25 * gNoise(p * 2.03 + 7.1) + 0.125 * gNoise(p * 4.1 + 3.3) + 0.0625 * gNoise(p * 8.3 + 1.7); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (uBump > 0.0) {
    float gh = gFbm(vGp * uBumpF) + 0.5 * gNoise(vGp * uBumpF * 3.7);
    vec2 dH = vec2(dFdx(gh), dFdy(gh)) * uBump;
    vec3 sX = dFdx(-vViewPosition), sY = dFdy(-vViewPosition);
    vec3 R1 = cross(sY, normal), R2 = cross(normal, sX);
    float fDet = dot(sX, R1);
    vec3 vGrad = sign(fDet) * (dH.x * R1 + dH.y * R2);
    normal = normalize(abs(fDet) * normal - vGrad);
  }`)
      .replace('#include <opaque_fragment>', `
  float gNdv = abs(dot(normalize(normal), normalize(vViewPosition)));
  float gFres = pow(1.0 - gNdv, 2.0);
  float gl = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
  outgoingLight = mix(outgoingLight, vec3(gl), uDesat);
  outgoingLight += diffuseColor.rgb * uGlow + uRim * gFres * uRimS;
  float gFlow = gFbm(vGp * 22.0 + vec3(0.0, -uTime * 0.06, uTime * 0.025));
  float gBreak = mix(1.0, smoothstep(0.18, 0.62, gFlow), uBreak);
  float gFade = smoothstep(uFadeY - uFadeSoft, uFadeY + uFadeSoft, vGp.y + (gFlow - 0.5) * uFadeSoft * 1.6);
  diffuseColor.a = min(1.0, uOpacity * mix(uCoreA, uEdgeA, smoothstep(0.4, 0.95, gFres)) * gBreak * gFade);
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `library-spectral3-${depthWrite}`;
  return m;
}

export async function buildGhost(ctx, root) {
  const group = new THREE.Group();
  group.name = 'ghost';
  let parts;
  try { parts = await loadParts(ctx.assetUrl('ghost.bin')); } catch (e) { console.warn('[library] ghost mesh missing', e); return { group, materials: [] }; }
  const time = ctx.time;
  const mats = {
    // the face reads near-solid (the eye must find it); the body thins to a cold, rim-lit veil
    head: spectralMaterial({ coreAlpha: 1.0, edgeAlpha: 0.72, rimStrength: 0.35, glow: 0.02, fadeY: -0.1, fadeSoft: 0.02, roughness: 0.5, tint: 0xc8ccd4, bump: 0.00022, bumpFreq: 320, breakup: 0.0, desat: 0.28, time }),
    hair: spectralMaterial({ coreAlpha: 0.9, edgeAlpha: 0.3, rimStrength: 1.0, glow: 0.12, roughness: 0.55, tint: 0xe4e8f0, breakup: 0.25, desat: 0.4, time }),
    eyes: spectralMaterial({ coreAlpha: 0.97, edgeAlpha: 0.9, rimStrength: 0.05, glow: 0.02, roughness: 0.06, tint: 0xe8ecf2, breakup: 0.0, desat: 0.2, time }),
    cravat: spectralMaterial({ coreAlpha: 0.95, edgeAlpha: 0.45, rimStrength: 0.35, glow: 0.04, fadeY: -0.235, fadeSoft: 0.045, roughness: 0.6, tint: 0xf0ece4, bump: 0.0006, bumpFreq: 220, breakup: 0.2, desat: 0.25, time }),
    waistcoat: spectralMaterial({ coreAlpha: 0.42, edgeAlpha: 0.45, rimStrength: 0.8, glow: 0.16, fadeY: -0.37, fadeSoft: 0.1, roughness: 0.7, tint: 0xd8e0ee, breakup: 0.35, depthWrite: false, desat: 0.4, time }),
    coat: spectralMaterial({ coreAlpha: 0.3, edgeAlpha: 0.55, rimStrength: 1.0, glow: 0.18, fadeY: -0.32, fadeSoft: 0.13, roughness: 0.75, tint: 0xd8e0ee, breakup: 0.6, depthWrite: false, desat: 0.4, time }),
  };
  const order = { coat: 1, waistcoat: 2, cravat: 3, head: 4, eyes: 5, hair: 6 };
  const meshes = {};
  for (const [name, g] of Object.entries(parts)) {
    const m = new THREE.Mesh(g, mats[name] || mats.head);
    m.name = `ghost-${name}`;
    m.renderOrder = 10 + (order[name] || 0);
    m.castShadow = false; m.receiveShadow = false;
    m.userData.noBake = true;
    group.add(m);
    meshes[name] = m;
  }
  // catchlights: the wet glint of the key light on each cornea (keeps the eyes alive at a distance)
  {
    const cl = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.65, 1.8), transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
    for (const sx of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.0009, 8, 6), cl);
      d.position.set(sx * 0.0315 - 0.0016, 0.0702, 0.0896);
      d.renderOrder = 17; d.userData.noBake = true;
      group.add(d);
    }
  }
  // a very faint cold aura behind the head
  {
    const tex = ctx.textures.canvas('library:ghosthalo', 128, 128, (g2, w, h) => {
      const grd = g2.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grd.addColorStop(0, 'rgba(170,185,215,0.5)'); grd.addColorStop(0.45, 'rgba(120,135,170,0.14)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g2.fillStyle = grd; g2.fillRect(0, 0, w, h);
    }, { tile: false });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.2, toneMapped: false }));
    halo.scale.set(0.7, 0.9, 1);
    halo.position.set(0, 0.04, -0.08);
    halo.renderOrder = 8;
    halo.userData.noBake = true;
    group.add(halo);
    meshes.halo = halo;
  }
  root.add(group);
  return { group, meshes, materials: Object.values(mats) };
}
