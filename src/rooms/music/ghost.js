import * as THREE from 'three';
import { FX_NOISE } from '../../engine/fx/noise.glsl.js';

/**
 * The ghost pianist, Herr Kessler: a seated maestro in a tailcoat, swept-back
 * hair, hands over the keys. The figure is sculpted offline as an SDF and
 * meshed (tools/genGhost.mjs -> public/assets/music/ghost.bin); here it is
 * loaded and drawn with the engine's ghost shader. Local frame = piano frame
 * (pianist at +Z facing -Z). Head and arms are separate so they can move.
 */

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
    const n4 = new Int8Array(buf, base + p.nrm, p.vertices * 4);
    const n3 = new Float32Array(p.vertices * 3);
    for (let i = 0; i < p.vertices; i++) { n3[i * 3] = n4[i * 4] / 127; n3[i * 3 + 1] = n4[i * 4 + 1] / 127; n3[i * 3 + 2] = n4[i * 4 + 2] / 127; }
    g.setAttribute('normal', new THREE.BufferAttribute(n3, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.vertices * 2), 2));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(buf, base + p.idx, p.indices), 1));
    const ao = new Float32Array(p.vertices).fill(1);
    if (p.ao !== undefined) { const a8 = new Uint8Array(buf, base + p.ao, p.vertices); for (let i = 0; i < p.vertices; i++) ao[i] = a8[i] / 255; }
    g.setAttribute('aOcc', new THREE.BufferAttribute(ao, 1));
    const tint = new Float32Array(p.vertices).fill(0.3);
    if (p.tint !== undefined) { const t8 = new Uint8Array(buf, base + p.tint, p.vertices); for (let i = 0; i < p.vertices; i++) tint[i] = t8[i] / 255; }
    g.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
    g.computeBoundingSphere();
    parts[p.name] = g;
  }
  return { parts, header };
}


/*
 * Ghost shader for Kessler: a fresnel-rim-dominant apparition. A depth pre-pass means only the
 * front-most skin is shaded, so the dense sculpt never stacks into line-art. Surfaces facing the
 * viewer are nearly clear (alpha ~0.15) and grazing ones glow (alpha ~0.8, cool 0x9fb8ff rim), so
 * the silhouette, the brow / nose / beard planes and the folds all carve out as bright contours;
 * a cool key from the windows plus baked cavity occlusion models the forms inside them, a faint
 * volumetric noise drifts through, the hands (nearest the keys) are the most solid, and the legs
 * dissolve into wisps.
 */
const VERT = /* glsl */ `
uniform float uTime;
uniform float uWobble;
attribute float aOcc;
attribute float aTint;
varying float vTint;
varying vec3 vN;
varying vec3 vW;
varying vec3 vLocal;
varying float vOcc;
${FX_NOISE}
void main() {
  vec3 p = position;
  float w = fxNoise(p * 3.0 + vec3(0.0, uTime * 0.5, 0.0)) - 0.5;
  p += normal * w * uWobble;
  vLocal = (uLocalMatrix * vec4(p, 1.0)).xyz;
  vOcc = aOcc;
  vTint = aTint;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uShadow;
uniform vec3 uRim;
uniform vec3 uKey;
uniform vec3 uFillPos;
uniform vec3 uFillColor;
uniform float uOpacity;
uniform float uIntensity;
uniform float uDissolveY;
uniform float uDissolveSoft;
uniform float uHandBoost;
varying vec3 vN;
varying vec3 vW;
varying vec3 vLocal;
varying float vOcc;
varying float vTint;
${FX_NOISE}
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  if (dot(n, v) < 0.0) n = -n;
  // regions from the sculpt: 0.05 silk, 0.1 coat cloth, 0.35 hair, 0.8 linen, 1.0 skin
  float skin = smoothstep(0.9, 0.97, vTint);
  float linen = smoothstep(0.6, 0.75, vTint) * (1.0 - skin);
  float hair = smoothstep(0.25, 0.32, vTint) * (1.0 - smoothstep(0.45, 0.6, vTint));
  float cloth = 1.0 - skin - linen - hair;
  // fine surface detail so the rim light has structure to trace: a twill weave + nap on the cloth,
  // strand grain on the hair, pores and fine creasing on the skin (procedural bump on the normal)
  vec3 q = vLocal;
  float e = 0.0015;
  float fs = mix(mix(mix(55.0, 70.0, hair), 90.0, skin), 60.0, linen);
  vec3 sc = mix(vec3(1.0), vec3(3.0, 0.6, 3.0), hair);
  float h0 = fxNoise(q * fs * sc);
  vec3 grad = vec3(fxNoise((q + vec3(e, 0.0, 0.0)) * fs * sc) - h0, fxNoise((q + vec3(0.0, e, 0.0)) * fs * sc) - h0, fxNoise((q + vec3(0.0, 0.0, e)) * fs * sc) - h0) / e;
  float bump = mix(mix(0.0005, 0.0012, hair), 0.0004, skin);
  n = normalize(n - (grad - n * dot(grad, n)) * bump);
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.4);
  float key = clamp(dot(n, uKey), 0.0, 1.0);
  vec3 toFill = uFillPos - vW;
  float fillD = length(toFill);
  float fill = clamp(dot(n, toFill / fillD), 0.0, 1.0) * clamp(1.2 / (fillD * fillD), 0.0, 1.0);
  float occ = pow(vOcc, 1.5);
  // slow inner "smoke" drifting upward through the body
  float flow = 0.6 * fxNoise(vLocal * 6.0 + vec3(0.0, -uTime * 0.35, uTime * 0.1)) + 0.4 * fxNoise(vLocal * 15.0 + vec3(0.0, -uTime * 0.7, 0.0));
  float d0 = (vLocal.y - uDissolveY) / max(uDissolveSoft, 1e-3);
  float mist = 0.5;
  if (d0 < 2.0) mist = fxFbm(vLocal * vec3(9.0, 3.0, 9.0) + vec3(0.0, -uTime * 0.8, 0.0));
  // albedo by region: pale skin and linen, a grey-blue ghost of the black coat, dim hair
  float val = cloth * 0.26 + hair * 0.48 + linen * 1.05 + skin * 1.0;
  float lit = 0.1 + 0.9 * key * key;
  vec3 body = mix(uShadow, uColor * val, lit * occ) + uFillColor * fill * val * occ * 0.55;
  // a soft specular sheen on skin and silk (wet-looking cold light on the brow, nose, cheekbones)
  vec3 hv = normalize(uKey + v);
  float spec = pow(clamp(dot(n, hv), 0.0, 1.0), mix(18.0, 40.0, skin)) * (0.15 + 0.35 * skin) * occ;
  vec3 col = body * (0.6 + 0.4 * occ) + uRim * fres * (1.0 + 0.3 * (linen + skin)) + uColor * spec;
  col += uColor * 0.05 * (0.5 + val);   // a faint inner glow, so he never goes dead grey against the light
  col *= 0.88 + 0.24 * flow;
  // hands nearest the keys are among the most solid parts of him
  float hands = uHandBoost * smoothstep(0.3, 0.17, vLocal.z) * step(vLocal.y, 0.86);
  // facing planes are nearly clear (the room shows through him); grazing ones glow; the lit planes of
  // the face, the linen and the hands gain body so the features model in the cold key light
  float solid = skin * 0.62 + linen * 0.5 + hair * 0.22 + cloth * 0.1;
  float a = mix(0.05, 0.78, fres) + (0.2 + 0.8 * key) * occ * solid + fill * 0.12 * solid + hands;
  a *= (0.82 + 0.3 * flow) * mix(0.55, 1.0, occ);
  // dissolve below uDissolveY into drifting wisps
  float d = d0 + (mist - 0.5) * 1.8;
  a *= smoothstep(0.0, 1.0, d);
  float vis = smoothstep(0.0, 1.0, d);
  a = clamp(a, 0.0, 0.92) * uOpacity;
  // premultiplied output with an additive glow on top: he lights the air around his contours
  // without turning opaque (blend: ONE, ONE_MINUS_SRC_ALPHA)
  vec3 glowAdd = (uRim * fres * 0.32 + uColor * 0.035 * (0.6 + val)) * uOpacity * vis * (0.85 + 0.3 * flow);
  gl_FragColor = vec4(col * uIntensity * a + glowAdd, a);
}`;

function ghostMaterials(ctx, { dissolveY = -10, dissolveSoft = 0.25, wobble = 0.003, handBoost = 0, localMatrix = new THREE.Matrix4() } = {}) {
  const uniforms = {
    uTime: ctx.time,
    uWobble: { value: wobble },
    uColor: { value: new THREE.Color(0xd6e2ff) },
    uShadow: { value: new THREE.Color(0x26345f) },
    uRim: { value: new THREE.Color(0x9fb8ff) },
    uKey: { value: new THREE.Vector3(0.45, 0.5, -0.74).normalize() },
    uFillPos: { value: new THREE.Vector3(0, 1.7, 0) },
    uFillColor: { value: new THREE.Color(1.0, 0.62, 0.32) },
    uOpacity: { value: 0.8 },
    uIntensity: { value: 1.15 },
    uDissolveY: { value: dissolveY },
    uDissolveSoft: { value: dissolveSoft },
    uHandBoost: { value: handBoost },
    uLocalMatrix: { value: localMatrix },
  };
  const defs = 'uniform mat4 uLocalMatrix;\n';
  const color = new THREE.ShaderMaterial({
    vertexShader: defs + VERT, fragmentShader: FRAG, uniforms,
    transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth, side: THREE.FrontSide, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const depth = new THREE.ShaderMaterial({
    vertexShader: defs + VERT, fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }', uniforms,
    transparent: true, colorWrite: false, depthWrite: true, side: THREE.FrontSide,
  });
  color.userData.noBake = true; depth.userData.noBake = true;
  return { color, depth, uniforms };
}

/** Sculpted ghost (public/assets/music/ghost.bin, made by tools/genGhost.mjs). */
export async function buildGhostPianist(ctx) {
  const { parts, header } = await loadParts(ctx.assetUrl('ghost.bin'));
  const group = new THREE.Group();
  group.name = 'ghostPianist';
  const mats = [];
  const addPart = (geo, opts, pos, order) => {
    const holder = new THREE.Group();
    if (pos) holder.position.fromArray(pos);
    // local -> piano frame (for the dissolve height), constant for the static offset
    const lm = new THREE.Matrix4().makeTranslation(...(pos || [0, 0, 0]));
    const m = ghostMaterials(ctx, { ...opts, localMatrix: lm });
    mats.push(m);
    // all depth pre-passes first, then all colour passes: only the front-most skin of the whole figure is shaded
    const pre = new THREE.Mesh(geo, m.depth); pre.renderOrder = 6;
    const vis = new THREE.Mesh(geo, m.color); vis.renderOrder = 7 + order * 0;
    holder.add(pre, vis);
    group.add(holder);
    return holder;
  };
  addPart(parts.body, { dissolveY: 0.6, dissolveSoft: 0.13, wobble: 0.003 }, null, 6);   // the legs dissolve into wisps at the seat
  const head = addPart(parts.head, { wobble: 0.0012 }, header.head, 8);
  const arms = ['L', 'R'].map((k) => addPart(parts['arm' + k], { wobble: 0.0015, handBoost: 0.3 }, header.shoulders[k], 10));
  // a faint cold aura behind him, and a light that he casts on the keys and music desk
  const glowTex = ctx.textures.canvas('music:ghostglow', 128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { tile: false });
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(0.32, 0.42, 0.75), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(0.95, 0.95, 1); glow.position.set(0, 1.16, 0.62); glow.renderOrder = 5;
  group.add(glow);
  // a tighter cold halo round the head and shoulders, so he separates from the moonlit wall
  const haloMat = glowMat.clone(); haloMat.color = new THREE.Color(0.45, 0.58, 1.0);
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(0.5, 0.5, 1); halo.position.set(0, 1.28, 0.5); halo.renderOrder = 5;
  group.add(halo);
  // his cold light falls on the keys and the music desk only (it used to wash the bench cushion lavender)
  const light = new THREE.PointLight(0xbfd0ff, 0.6, 0.9, 2);
  light.position.set(0, 0.95, 0.1);
  group.add(light);
  group.traverse((o) => { o.userData.noBake = true; o.castShadow = false; o.receiveShadow = false; });

  const target = [0, 0];
  const dip = [0, 0];
  const LIGHT = 0.35;
  return {
    group, arms, head, light,
    setOpacity(v) {
      for (const m of mats) m.uniforms.uOpacity.value = v;
      glowMat.opacity = 0.55 * v;
      haloMat.opacity = 0.45 * v;
      light.intensity = LIGHT * v / 0.55;
    },
    want: null,
    setFill(p) { for (const m of mats) m.uniforms.uFillPos.value.copy(p); },   // set by the room: (opacity) => void, eases toward it
    reachFor(x) {
      const side = x < 0.0 ? 0 : 1;
      target[side] = x; dip[side] = 1;
    },
    update(dt, t, idle = true) {
      for (let i = 0; i < 2; i++) {
        const s = i === 0 ? -1 : 1;
        const arm = arms[i];
        const base = s * 0.17;
        const want = idle ? Math.sin(t * 1.3 + i * 1.7) * 0.04 : THREE.MathUtils.clamp((target[i] - base) * 1.4, -0.45, 0.45);
        arm.rotation.y += (-want - arm.rotation.y) * Math.min(1, dt * 8);
        dip[i] = Math.max(0, dip[i] - dt * 5);
        arm.rotation.x = -0.06 * dip[i] + (idle ? Math.sin(t * 2.1 + i) * 0.015 : 0);
      }
      // his head half-turned toward the room (the treble side), as if he heard you come in
      head.rotation.y = -0.38 + Math.sin(t * 0.5) * 0.06;
      head.rotation.x = -0.22 + Math.sin(t * 0.7) * 0.03;   // bowed over the keys
    },
  };
}
