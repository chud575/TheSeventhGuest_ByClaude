import * as THREE from 'three';

/**
 * The grey lady, as a body rather than a card.
 *
 * A low-poly draped figure (gown flaring to a ragged hem, bodice, shoulders, arms folded at the
 * waist, a veil falling from the crown) rendered with an additive fresnel shader: the silhouette
 * glows cold (rim^3), the core is nearly clear, and slow 3D noise drifts up through her so she
 * never quite holds still. Only the head proxy carries the painted face (front-projected from
 * ghost.png). Wisps rise off the hem, and a soft glow sits behind her. No billboarding: the room
 * turns her at most +/-15 deg toward the camera.
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

function bodyMaterial(ctx, { tint, rimPow = 3.0, core = 0.06, rim = 1.25, face = null, seed = 0, gap = 0 }) {
  const uniforms = {
    uTime: ctx.time, uFade: { value: 1 }, uTint: { value: new THREE.Color(tint) }, uRimPow: { value: rimPow },
    uCore: { value: core }, uRim: { value: rim }, uSeed: { value: seed }, tFace: { value: face }, uHasFace: { value: face ? 1 : 0 }, uGap: { value: gap },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uSeed;
      attribute vec2 faceUv;
      varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vL; varying vec2 vFace;
      ${NOISE}
      void main() {
        vec3 p = position;
        // soft breathing distortion, stronger toward the hem
        float low = 1.0 - smoothstep(0.2, 1.3, p.y);
        vec3 q = vec3(p.x * 3.0, p.y * 2.0 - uTime * 0.25, p.z * 3.0 + uSeed);
        p += normal * (gfbm(q) - 0.5) * (0.012 + 0.035 * low);
        p.x += sin(p.y * 4.0 + uTime * 0.8 + uSeed) * 0.02 * low;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vW = w.xyz; vL = p;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = cameraPosition - w.xyz;
        vFace = faceUv;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uFade; uniform vec3 uTint; uniform float uRimPow; uniform float uCore; uniform float uRim; uniform float uSeed;
      uniform sampler2D tFace; uniform float uHasFace; uniform float uGap;
      varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vL; varying vec2 vFace;
      ${NOISE}
      void main() {
        vec3 N = normalize(vN), V = normalize(vV);
        float ndv = abs(dot(N, V));
        // the brightest band sits just inside the silhouette, which itself fades out: no drawn outline
        float rim = pow(1.0 - ndv, uRimPow) * smoothstep(0.02, 0.32, ndv);
        vec3 q = vec3(vW.x * 3.0, vW.y * 2.2 - uTime * 0.22, vW.z * 3.0 + uSeed);
        float n = gfbm(q);
        float n2 = gfbm(q * 2.7 + 5.0);
        // long vertical drapery streaks: brighter ridges of mist running down the gown
        float streak = 0.6 + 0.4 * sin(atan(vL.x, vL.z) * 9.0 + n * 3.0);
        // the rim itself is broken up by the noise so no edge reads as a drawn outline
        float dens = (uCore + uRim * rim * smoothstep(0.25, 0.7, n + 0.15)) * (0.45 + 0.9 * n) * mix(1.0, streak, 0.5);
        // open edges of the veil dissolve instead of ending in a line
        float az = abs(atan(vL.x, vL.z));
        dens *= mix(1.0, smoothstep(uGap * 0.5, uGap * 0.5 + 0.6, az), step(0.01, uGap));
        // ragged mist at the hem and wherever the noise thins out
        dens *= smoothstep(0.02, 0.55, vL.y + 0.35 * (n2 - 0.5));
        dens *= 0.75 + 0.5 * smoothstep(0.35, 0.65, n2);
        vec3 col = uTint * dens;
        if (uHasFace > 0.5) {
          vec4 f = texture2D(tFace, vFace);
          // only the features survive: an oval mask in face space, thinned by the drifting noise
          vec2 fq = (vFace - vec2(0.485, 0.868)) / vec2(0.105, 0.062);
          float mask = smoothstep(1.0, 0.35, length(fq)) * smoothstep(0.55, 0.9, ndv);
          float lum = dot(f.rgb, vec3(0.33));
          // lighter paint = denser ectoplasm; the darks (eyes, brows, mouth) stay see-through
          vec3 face = vec3(0.72, 0.8, 1.0) * pow(lum, 1.6) * mask * (0.55 + 0.6 * n);
          col = uTint * (0.02 + uRim * rim * smoothstep(0.25, 0.7, n + 0.15)) * (0.6 + 0.6 * n) + face * 0.8;
        }
        gl_FragColor = vec4(col * uFade, 1.0);
      }`,
  });
  mat.userData.noBake = true;
  return { mat, uniforms };
}

/** elliptical lathe: profile [[y, rx, rz]], optional angular gap (open veil front) */
function ellLathe(profile0, segs = 40, { gap = 0, fold = null, rings = 36 } = {}) {
  // resample the profile smoothly (Catmull-Rom through the key rings) so silhouettes are not faceted
  const cr = new THREE.CatmullRomCurve3(profile0.map(([y, rx, rz]) => new THREE.Vector3(rx, y, rz)), false, 'centripetal');
  const profile = cr.getPoints(rings).map((v) => [v.y, Math.max(0.005, v.x), Math.max(0.005, v.z)]);
  const pos = [], idx = [];
  const a0 = gap / 2, a1 = Math.PI * 2 - gap / 2;
  const cols = segs + 1;
  for (let i = 0; i < profile.length; i++) {
    const [y, rx, rz] = profile[i];
    for (let j = 0; j <= segs; j++) {
      const a = a0 + (a1 - a0) * (j / segs);           // a = 0 is the front (+z)
      let r = 1;
      if (fold) r += fold(a, y);
      pos.push(Math.sin(a) * rx * r, y, Math.cos(a) * rz * r);
    }
  }
  for (let i = 0; i < profile.length - 1; i++) for (let j = 0; j < segs; j++) {
    const a = i * cols + j, b = a + cols;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export async function makeGhost(ctx) {
  const tex = await new THREE.TextureLoader().loadAsync(ctx.assetUrl('ghost.png'));
  tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  group.name = 'ghost';
  const tint = 0x9fb6ff;
  const mats = [];
  const mk = (o) => { const m = bodyMaterial(ctx, o); mats.push(m); return m.mat; };

  // ---- gown: bodice to flared, folded hem (y metres; floor at 0, she hovers a little)
  const gown = ellLathe([
    [0.02, 0.33, 0.27], [0.18, 0.31, 0.25], [0.42, 0.27, 0.21], [0.66, 0.22, 0.17], [0.86, 0.17, 0.13],
    [0.98, 0.145, 0.11], [1.1, 0.16, 0.115], [1.2, 0.175, 0.12], [1.28, 0.185, 0.112], [1.33, 0.165, 0.095],
    [1.37, 0.1, 0.07], [1.39, 0.02, 0.02],
  ], 48, { fold: (a, y) => (0.06 * Math.sin(a * 9 + 0.7) + 0.03 * Math.sin(a * 17 + 2.1)) * (1 - THREE.MathUtils.smoothstep(y, 0.2, 0.95)) });
  group.add(new THREE.Mesh(gown, mk({ tint, rimPow: 2.2, core: 0.075, rim: 0.85, seed: 1.3 })));

  // ---- arms: sleeves from the shoulders, hands folded at the waist
  for (const s of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.175, 1.3, -0.01), new THREE.Vector3(s * 0.205, 1.12, 0.0),
      new THREE.Vector3(s * 0.19, 0.98, 0.07), new THREE.Vector3(s * 0.08, 0.9, 0.15), new THREE.Vector3(s * 0.015, 0.89, 0.155),
    ]);
    const tube = new THREE.TubeGeometry(c, 20, 0.042, 10, false);
    // sleeve tapers toward the wrist
    const p = tube.attributes.position;
    const cnt = 11;
    for (let i = 0; i < p.count; i++) {
      const ring = Math.floor(i / cnt), t = ring / 20;
      const ctr = c.getPoint(Math.min(1, t));
      const k = 1.0 - 0.45 * t;
      p.setXYZ(i, ctr.x + (p.getX(i) - ctr.x) * k, ctr.y + (p.getY(i) - ctr.y) * k, ctr.z + (p.getZ(i) - ctr.z) * k);
    }
    tube.computeVertexNormals();
    group.add(new THREE.Mesh(tube, mk({ tint, rimPow: 2.0, core: 0.03, rim: 0.35, seed: 4.1 + s })));
  }

  // ---- head proxy with the painted face front-projected from ghost.png
  {
    const g = new THREE.SphereGeometry(1, 28, 20);
    g.scale(0.082, 0.108, 0.094);
    const p = g.attributes.position;
    // flatten the face a touch and pull the chin forward
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); if (z > 0) p.setZ(i, z * (0.92 + 0.12 * (y < -0.04 ? 1 : 0))); }
    g.computeVertexNormals();
    const fuv = new Float32Array(p.count * 2);
    // face in ghost.png: u 0.36..0.61, v 0.814..0.935 (head width/height in metres -> that rect)
    for (let i = 0; i < p.count; i++) {
      fuv[i * 2] = 0.485 + (p.getX(i) / 0.082) * 0.13;
      fuv[i * 2 + 1] = 0.873 + (p.getY(i) / 0.108) * 0.068;
    }
    g.setAttribute('faceUv', new THREE.BufferAttribute(fuv, 2));
    const head = new THREE.Mesh(g, mk({ tint, rimPow: 1.6, core: 0.03, rim: 0.45, face: tex, seed: 2.2 }));
    head.position.set(0, 1.55, 0.01);
    head.rotation.x = 0.12;     // she looks a little down
    group.add(head);
  }

  // ---- veil: from the crown over the back of the head, falling past the shoulders (open front)
  const veil = ellLathe([
    [1.69, 0.02, 0.02], [1.66, 0.075, 0.08], [1.6, 0.105, 0.11], [1.5, 0.12, 0.12], [1.4, 0.16, 0.13],
    [1.3, 0.23, 0.15], [1.15, 0.26, 0.16], [0.95, 0.27, 0.17],
  ], 40, { gap: 1.9, fold: (a, y) => 0.05 * Math.sin(a * 7 + y * 4) * (1 - THREE.MathUtils.smoothstep(y, 1.2, 1.6)) });
  group.add(new THREE.Mesh(veil, mk({ tint: 0x8ea8f0, rimPow: 2.0, core: 0.04, rim: 0.6, seed: 7.7, gap: 1.9 })));

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
