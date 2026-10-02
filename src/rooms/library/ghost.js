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
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, base + p.pos, p.vertices * 3), 3));
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

/** Lit spectral material: vertex-painted PBR, translucent toward the silhouette, glowing rim, fades below `fadeY`. */
export function spectralMaterial({ opacity = 0.9, coreAlpha = 1.0, edgeAlpha = 0.25, rim = 0x9fc0ff, rimStrength = 0.6, glow = 0.08, fadeY = -1, fadeSoft = 0.1, roughness = 0.6, sheen = 0, tint = 0xdfe8ff, depthWrite = true } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0, transparent: true, depthWrite, color: tint });
  const u = {
    uOpacity: { value: opacity }, uCoreA: { value: coreAlpha }, uEdgeA: { value: edgeAlpha },
    uRim: { value: new THREE.Color(rim) }, uRimS: { value: rimStrength }, uGlow: { value: glow },
    uFadeY: { value: fadeY }, uFadeSoft: { value: fadeSoft },
  };
  m.userData.uniforms = u;
  m.userData.noBake = true;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vGy;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGy = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vGy;
uniform float uOpacity, uCoreA, uEdgeA, uRimS, uGlow, uFadeY, uFadeSoft;
uniform vec3 uRim;`)
      .replace('#include <opaque_fragment>', `
  float gNdv = abs(dot(normalize(normal), normalize(vViewPosition)));
  float gFres = pow(1.0 - gNdv, 2.2);
  outgoingLight += diffuseColor.rgb * uGlow + uRim * gFres * uRimS;
  float gFade = smoothstep(uFadeY - uFadeSoft, uFadeY + uFadeSoft, vGy);
  diffuseColor.a = uOpacity * mix(uCoreA, uEdgeA, gFres) * gFade;
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `library-spectral-${depthWrite}`;
  return m;
}

export async function buildGhost(ctx, root) {
  const group = new THREE.Group();
  group.name = 'ghost';
  let parts;
  try { parts = await loadParts(ctx.assetUrl('ghost.bin')); } catch (e) { console.warn('[library] ghost mesh missing', e); return { group, materials: [] }; }
  const mats = {
    head: spectralMaterial({ opacity: 0.9, coreAlpha: 0.97, edgeAlpha: 0.12, rimStrength: 0.22, glow: 0.035, fadeY: -0.13, fadeSoft: 0.03, roughness: 0.5, tint: 0xc4bab2 }),
    hair: spectralMaterial({ opacity: 0.85, coreAlpha: 0.95, edgeAlpha: 0.25, rimStrength: 0.3, glow: 0.05, roughness: 0.8, tint: 0xbfc0c4 }),
    cravat: spectralMaterial({ opacity: 0.88, coreAlpha: 0.95, edgeAlpha: 0.2, rimStrength: 0.18, glow: 0.03, fadeY: -0.215, fadeSoft: 0.035, roughness: 0.9, tint: 0xa8a8ae }),
    coat: spectralMaterial({ opacity: 0.45, coreAlpha: 0.35, edgeAlpha: 0.9, rimStrength: 0.5, glow: 0.05, fadeY: -0.42, fadeSoft: 0.12, roughness: 0.5, depthWrite: false }),
  };
  const order = { coat: 1, cravat: 2, hair: 4, head: 3 };
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
  // ethereal wisps trailing from the coat (engine apparition shader)
  if (parts.coat) {
    const wisp = new THREE.Mesh(parts.coat, ctx.fx.ghostMaterial({ color: 0x5f7fc8, rimColor: 0xb8ccff, opacity: 0.35, intensity: 0.9, dissolveY: -0.36, dissolveSoft: 0.12, wobble: 0.01, flicker: 0.1 }));
    wisp.scale.setScalar(1.035);
    wisp.renderOrder = 9;
    wisp.userData.noBake = true;
    group.add(wisp);
    meshes.wisp = wisp;
  }
  // soft spectral halo behind the head
  {
    const tex = ctx.textures.canvas('library:ghosthalo', 128, 128, (g2, w, h) => {
      const grd = g2.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grd.addColorStop(0, 'rgba(150,180,255,0.55)'); grd.addColorStop(0.45, 'rgba(110,140,230,0.18)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g2.fillStyle = grd; g2.fillRect(0, 0, w, h);
    }, { tile: false });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35, toneMapped: false }));
    halo.scale.set(0.62, 0.72, 1);
    halo.position.set(0, 0.04, -0.06);
    halo.renderOrder = 8;
    halo.userData.noBake = true;
    group.add(halo);
    meshes.halo = halo;
  }
  root.add(group);
  return { group, meshes, materials: Object.values(mats) };
}
