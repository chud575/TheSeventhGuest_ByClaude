import * as THREE from 'three';

/**
 * The grey lady, as one body rather than a stack of shells.
 *
 * Her figure (gown with deep folds and a ragged hem, folded arms and clasped hands, neck, a
 * sculpted head with brow, sockets, nose, lips and chin, and a heavy veil falling into a cape) is
 * a single closed surface polygonised offline from one SDF (tools/genGhost.mjs -> ghost_mesh.bin).
 * Drawn additively with front faces only, she therefore has exactly one layer wherever you look:
 * no inner shell boundaries. The fresnel shader glows cold just inside the silhouette, the core is
 * nearly clear, slow 3D noise drifts up through her, and the hem sways. The painted likeness
 * (ghost.png) is projected onto the sculpted face and faded by fresnel so it melts into the hood.
 * A soft glow sits behind her and wisps rise off the hem. The room turns her at most +/-15 deg.
 *
 * Origin at floor level, facing +Z. Returns { group, uniforms: { uFade } }.
 */
const NOISE = /* glsl */ `
float gh31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gvn(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gh31(i), gh31(i + vec3(1,0,0)), f.x), mix(gh31(i + vec3(0,1,0)), gh31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(gh31(i + vec3(0,0,1)), gh31(i + vec3(1,0,1)), f.x), mix(gh31(i + vec3(0,1,1)), gh31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float gfbm(vec3 p) { return gvn(p) * 0.55 + gvn(p * 2.03 + 7.1) * 0.3 + gvn(p * 4.1 + 3.3) * 0.15; }
`;

export async function makeGhost(ctx) {
  const tex = await new THREE.TextureLoader().loadAsync(ctx.assetUrl('ghost.png'));
  tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  group.name = 'ghost';
  const tint = 0x9fb6ff;
  const mats = [];

  // ---- the body: ONE closed sculpted surface (tools/genGhost.mjs), so there are no inner shells
  const buf = await (await fetch(ctx.assetUrl('ghost_mesh.bin'))).arrayBuffer();
  const [nv, ni] = new Uint32Array(buf, 0, 2);
  const bb = new Float32Array(buf, 8, 6);
  let off = 32;
  const qp = new Uint16Array(buf, off, nv * 3); off += Math.ceil(nv * 3 / 2) * 4;
  const qn = new Int8Array(buf, off, nv * 3); off += Math.ceil(nv * 3 / 4) * 4;
  const qpart = new Uint8Array(buf, off, nv); off += Math.ceil(nv / 4) * 4;
  const idx = new Uint32Array(buf, off, ni);
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), part = new Float32Array(nv);
  for (let v = 0; v < nv; v++) {
    for (let c = 0; c < 3; c++) pos[v * 3 + c] = bb[c] + (qp[v * 3 + c] / 65535) * (bb[c + 3] - bb[c]);
    const x = qn[v * 3] / 127, y = qn[v * 3 + 1] / 127, z = qn[v * 3 + 2] / 127, l = Math.hypot(x, y, z) || 1;
    nrm[v * 3] = x / l; nrm[v * 3 + 1] = y / l; nrm[v * 3 + 2] = z / l;
    part[v] = qpart[v];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('part', new THREE.BufferAttribute(part, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();

  const debugSolid = ctx.shot && typeof location !== 'undefined' && new URLSearchParams(location.search).get('gsolid') === '1';
  const bodyU = {
    uTime: ctx.time, uFade: { value: 1 }, uTint: { value: new THREE.Color(tint) }, tFace: { value: tex },
  };
  const bodyMat = debugSolid ? new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.6 }) : new THREE.ShaderMaterial({
    uniforms: bodyU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute float part;
      varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vL; varying vec3 vLN; varying float vPart;
      ${NOISE}
      void main() {
        vec3 p = position;
        float low = 1.0 - smoothstep(0.15, 1.25, p.y);
        // the cloth breathes: slow swell along the normal, and the hem sways like a drowned gown
        vec3 q = vec3(p.x * 3.0, p.y * 2.0 - uTime * 0.25, p.z * 3.0);
        p += normal * (gfbm(q) - 0.5) * (0.004 + 0.03 * low) * (1.0 - step(0.5, part) * step(part, 1.5));
        p.x += sin(uTime * 0.8 + p.y * 3.0) * 0.02 * low * low;
        p.z += sin(uTime * 0.6 + p.y * 2.3 + 1.7) * 0.014 * low * low;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vW = w.xyz; vL = p; vLN = normal; vPart = part;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = cameraPosition - w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uFade; uniform vec3 uTint; uniform sampler2D tFace;
      varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vL; varying vec3 vLN; varying float vPart;
      ${NOISE}
      void main() {
        vec3 N = normalize(vN), V = normalize(vV);
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float isFace = 1.0 - smoothstep(0.3, 0.7, abs(vPart - 1.0));
        isFace *= smoothstep(1.42, 1.45, vL.y);
        float isHood = 1.0 - smoothstep(0.3, 0.7, abs(vPart - 2.0));
        // rim brightest just inside the silhouette, the very edge itself dissolving (no drawn line)
        float rim = pow(1.0 - ndv, 2.4) * smoothstep(0.0, 0.22, ndv);
        vec3 q = vec3(vW.x * 3.0, vW.y * 2.2 - uTime * 0.22, vW.z * 3.0);
        float n = gfbm(q);
        float n2 = gfbm(q * 2.7 + 5.0);
        // long vertical mist streaks running down the gown, softened on the hood
        float streak = 0.65 + 0.35 * sin(atan(vL.x, vL.z) * 11.0 + n * 3.0 + vL.y * 0.8);
        float core = mix(0.05, 0.035, isHood);
        float dens = (core + 0.95 * rim * smoothstep(0.2, 0.65, n + 0.12)) * (0.5 + 0.8 * n) * mix(1.0, streak, 0.45 * (1.0 - isFace));
        // soft top light so folds and the sculpted head read as form, not just outline
        dens *= 0.75 + 0.35 * clamp(N.y * 0.6 + 0.5, 0.0, 1.0);
        // hem dissolves into ragged mist
        dens *= smoothstep(0.02, 0.5, vL.y + 0.35 * (n2 - 0.5));
        dens *= 0.75 + 0.5 * smoothstep(0.35, 0.65, n2);
        vec3 col = uTint * dens;
        // the face: the painted likeness projected onto the sculpted head, fading by fresnel so its
        // edges melt into the hood; light paint = denser ectoplasm, darks (eyes, mouth) see-through
        vec2 fuv = vec2((253.5 + vL.x * 1016.0) / 512.0, 1.0 - (176.5 - (vL.y - 1.535) * 1016.0) / 1536.0);
        vec4 f = texture2D(tFace, fuv);
        float lum = dot(f.rgb, vec3(0.33));
        float fo = length((vL.xy - vec2(0.0, 1.507)) / vec2(0.066, 0.088));
        float fm = smoothstep(1.0, 0.62, fo) * smoothstep(0.035, 0.06, vL.z) * mix(1.0, smoothstep(0.15, 0.6, ndv), smoothstep(0.45, 0.9, fo));
        vec3 face = vec3(0.7, 0.8, 1.0) * pow(lum, 1.5) * (0.6 + 0.5 * n) * 0.95;
        col = mix(col, uTint * dens * 0.35 + face, fm);
        gl_FragColor = vec4(col * uFade, 1.0);
      }`,
  });
  bodyMat.userData.noBake = true;
  mats.push({ mat: bodyMat, uniforms: debugSolid ? { uFade: { value: 1 } } : bodyU });
  const body = new THREE.Mesh(geo, bodyMat);
  body.name = 'ghostBody';
  group.add(body);

  // ---- wisps rising off the hem: tall ribbons of scrolling mist
  {
    const wispMat = new THREE.ShaderMaterial({
      uniforms: { uTime: ctx.time, uFade: { value: 1 }, uTint: { value: new THREE.Color(tint) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vW; uniform float uTime;
        void main() { vUv = uv; vec3 p = position; p.x += sin(uv.y * 6.0 + uTime * 0.9 + position.z * 9.0) * 0.04 * uv.y;
          vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `varying vec2 vUv; varying vec3 vW; uniform float uTime; uniform float uFade; uniform vec3 uTint;
        ${NOISE}
        void main() {
          float n = gfbm(vec3(vW.x * 6.0, vW.y * 3.0 - uTime * 0.45, vW.z * 6.0));
          float a = smoothstep(0.5, 0.0, abs(vUv.x - 0.5)) * smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
          a *= smoothstep(0.42, 0.75, n);
          gl_FragColor = vec4(uTint * a * 0.22 * uFade, 1.0);
        }`,
    });
    wispMat.userData.noBake = true;
    mats.push({ mat: wispMat, uniforms: wispMat.uniforms });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.75), wispMat);
      m.position.set(Math.sin(a) * 0.28, 0.32, Math.cos(a) * 0.22);
      m.rotation.y = a + Math.PI / 2;
      m.renderOrder = 9;
      group.add(m);
    }
  }

  // ---- soft glow behind her (round, so a camera-facing sprite is honest here)
  {
    const gt = ctx.textures.canvas('gallery:ghostGlow', 128, 128, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    }, { tile: false });
    const sm = new THREE.SpriteMaterial({ map: gt, color: new THREE.Color(tint).multiplyScalar(0.11), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    sm.userData.noBake = true;
    const sp = new THREE.Sprite(sm);
    sp.scale.set(1.1, 2.0, 1); sp.position.set(0, 1.0, -0.1); sp.renderOrder = 6;
    group.add(sp);
    mats.push({ mat: sm, uniforms: { uFade: { set value(v) { sm.opacity = v; } } }, sprite: true });
  }

  group.traverse((o) => { if (o.isMesh || o.isSprite) { o.userData.noShadow = true; o.renderOrder = o.renderOrder || 8; } });
  let fade = 1;
  const uniforms = {
    uFade: {
      get value() { return fade; },
      set value(v) { fade = v; for (const m of mats) m.uniforms.uFade.value = v; },
    },
  };
  return { group, uniforms };
}
