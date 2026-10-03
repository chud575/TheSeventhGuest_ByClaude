import * as THREE from 'three';
import { frameGeometry, FRAME_PROFILES } from './look.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** add a constant/derived vertex colour so vertex-coloured gilt works on any geometry */
export function withCavity(geo, fn = () => 0.85) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, n = g.attributes.normal;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i), n ? n.getZ(i) : 1); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = 0.2 + 0.8 * v; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// ============================================================================ gas bracket
let etchTex = null;
function etchTexture(ctx) {
  if (etchTex) return etchTex;
  etchTex = ctx.textures.canvas('gallery:etch', 256, 256, (g, w, h) => {
    // frosted ground (light) with a clear-cut band of stars and a fern garland (dark = clear glass)
    g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) { const n = 200 + ((i * 2654435761) >>> 24) % 40; img.data[i] = img.data[i + 1] = img.data[i + 2] = n; }
    g.putImageData(img, 0, 0);
    g.fillStyle = '#383838';
    for (let k = 0; k < 8; k++) {
      const x = (k + 0.5) * (w / 8), y = h * 0.52;
      g.save(); g.translate(x, y); g.beginPath();
      for (let j = 0; j < 10; j++) { const r = j % 2 ? 5 : 13, a = (j / 10) * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill(); g.restore();
    }
    g.strokeStyle = '#444'; g.lineWidth = 2;
    for (const y of [h * 0.3, h * 0.74]) {
      g.beginPath();
      for (let x = 0; x <= w; x += 4) g.lineTo(x, y + Math.sin(x / w * Math.PI * 8) * 7);
      g.stroke();
      for (let x = 8; x < w; x += 16) { g.beginPath(); g.ellipse(x, y + Math.sin(x / w * Math.PI * 8) * 7 - 6, 2.5, 6, 0.5, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = '#505050'; g.fillRect(0, h - 10, w, 10); g.fillRect(0, 0, w, 6);
  }, { tile: true });
  etchTex.colorSpace = THREE.NoColorSpace;
  return etchTex;
}

export function makeGlobeMaterial(ctx) {
  // unlit (the jet sits inside it, so a lit material would just blow out): frosted etch glows,
  // clear-cut pattern stays darker, brighter where we look straight through the glass at the mantle
  const etch = etchTexture(ctx);
  const m = new THREE.ShaderMaterial({
    uniforms: { tEtch: { value: etch }, uColor: { value: new THREE.Color(1.0, 0.6, 0.28) }, uIntensity: { value: 0.8 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform sampler2D tEtch; uniform vec3 uColor; uniform float uIntensity;
      void main() {
        float e = texture2D(tEtch, vUv * vec2(3.0, 1.0)).r;
        float ndv = abs(dot(normalize(vN), normalize(vV)));
        float core = pow(ndv, 2.0);
        vec3 c = uColor * uIntensity * (0.35 + 0.9 * e) * (0.3 + 1.1 * core);
        c += vec3(1.0, 0.85, 0.6) * pow(1.0 - ndv, 3.0) * 0.25 * uIntensity;   // rim catching the room
        gl_FragColor = vec4(c, 0.55 + 0.4 * e);
      }`,
    name: 'gasGlobe',
  });
  m.userData.noBake = true;
  Object.defineProperty(m, 'emissiveIntensity', { get() { return m.uniforms.uIntensity.value; }, set(v) { m.uniforms.uIntensity.value = v; } });
  return m;
}

/** Gas bracket: backplate, scrolled arm, cock, gallery, etched globe, glowing mantle. Facing +Z, backplate at origin. */
export function makeGasBracket(ctx, mat, globeMat, mantleMat) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'gasBracket';
  const plate = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.05, 0], [0.054, 0.006], [0.046, 0.012], [0.04, 0.016], [0.03, 0.02], [0.022, 0.03], [0, 0.034]], 28), mat.brass);
  plate.rotation.x = Math.PI / 2; plate.scale.set(1, 1, 1.8); g.add(plate);
  const arm = new THREE.CatmullRomCurve3([V3(0, 0, 0.03), V3(0, -0.035, 0.08), V3(0, -0.03, 0.14), V3(0, 0.0, 0.185), V3(0, 0.045, 0.2), V3(0, 0.07, 0.2)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(arm, 32, 0.0075, 10), mat.brass));
  // a curl hanging under the arm (spiral) and a smaller one above
  const spiral = (cx, cy, cz, r0, turns, dir, sc = 1) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40; const a = t * turns * Math.PI * 2; const r = r0 * (1 - 0.75 * t); pts.push(V3(0, cy + dir * Math.sin(a) * r * sc, cz + Math.cos(a) * r)); }
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0042, 6), mat.brass);
  };
  g.add(spiral(0, -0.075, 0.075, 0.036, 1.3, -1));
  g.add(spiral(0, 0.03, 0.09, 0.022, 1.1, 1));
  // leaf drop under the plate
  const drop = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.01, 0.008], [0.014, 0.025], [0.007, 0.045], [0, 0.055]], 14), mat.brass);
  drop.position.set(0, -0.11, 0.03); drop.rotation.x = Math.PI; g.add(drop);
  // gas cock with a T key
  const cock = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.022, 10), mat.brass); cock.position.set(0, -0.03, 0.14); g.add(cock);
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.006, 0.006), mat.brass); key.position.set(0, -0.016, 0.14); g.add(key);
  // burner + gallery ring with three claws
  const gal = new THREE.Mesh(G.latheFromProfile([[0.007, 0], [0.012, 0.006], [0.03, 0.014], [0.036, 0.02], [0.037, 0.028], [0.033, 0.03], [0.03, 0.022], [0.01, 0.014]], 28), mat.brass);
  gal.position.set(0, 0.07, 0.2); g.add(gal);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.022, 0.006), mat.brass);
    claw.position.set(Math.cos(a) * 0.037, 0.1, 0.2 + Math.sin(a) * 0.037); claw.rotation.y = -a; g.add(claw);
  }
  // mantle: small incandescent sock — the only part that should bloom
  const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.03, 12), mantleMat);
  mantle.position.set(0, 0.112, 0.2); mantle.userData.noShadow = true; g.add(mantle);
  // etched globe (open crimped top)
  const globe = new THREE.Mesh(G.latheFromProfile([[0.03, 0], [0.042, 0.012], [0.06, 0.04], [0.068, 0.07], [0.066, 0.1], [0.055, 0.126], [0.04, 0.142], [0.036, 0.152], [0.042, 0.158], [0.039, 0.161]], 36), globeMat);
  globe.position.set(0, 0.092, 0.2); globe.userData.noShadow = true; globe.name = 'globe';
  globe.renderOrder = 2;
  g.add(globe);
  return { group: g, lightPos: V3(0, 0.15, 0.2), globe, mantle };
}

// ============================================================================ wall light pools (scalloped up/down cones)
let poolTex = null;
export function lightPoolTexture(ctx) {
  if (poolTex) return poolTex;
  poolTex = ctx.textures.canvas('gallery:pool', 256, 512, (g, w, h) => {
    const img = g.createImageData(w, h);
    const sy = h * 0.42;  // source height in the texture
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / (w / 2), dy = (sy - y) / h;     // dy > 0 above the jet
      let v = 0;
      const r = Math.hypot(dx * 0.55, dy);
      if (dy > 0) {
        const ang = Math.atan2(Math.abs(dx) * 0.55, dy);          // 0 = straight up
        const edge = 0.95 + 0.06 * Math.cos(ang * 18);           // scalloped rim from the gallery claws
        v = THREE.MathUtils.smoothstep(edge, edge - 0.25, ang) * Math.exp(-r * 3.2) * 1.0;
      } else {
        const ang = Math.atan2(Math.abs(dx) * 0.55, -dy);
        v = THREE.MathUtils.smoothstep(0.75, 0.45, ang) * Math.exp(-r * 5.0) * 0.5;
      }
      const c = Math.min(255, Math.round(v * 255));
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = c; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { tile: false });
  return poolTex;
}

export function makeLightPool(ctx, { w = 1.1, h = 2.2, color = 0xffa25a, intensity = 0.35 } = {}) {
  const m = new THREE.MeshBasicMaterial({ map: lightPoolTexture(ctx), color: new THREE.Color(color).multiplyScalar(intensity), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, name: 'lightPool' });
  m.userData.noBake = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.position.y = h * (0.5 - 0.42);       // texture's source point at the local origin
  mesh.userData.noShadow = true;
  mesh.renderOrder = 1;
  return mesh;
}

// ============================================================================ ghost card
/**
 * The grey lady: a soft painted card (no scan-lines) whose density is modulated by slow 3D
 * noise drifting upward, brightest at her silhouette (a fresnel stand-in taken from the alpha
 * gradient), dissolving at the hem. A second, larger, fainter card behind gives her volume.
 */
export async function makeGhostCard(ctx) {
  const tex = await new THREE.TextureLoader().loadAsync(ctx.assetUrl('ghost.png'));
  tex.colorSpace = THREE.SRGBColorSpace;
  const mk = (seed, gain) => {
    const uniforms = { tMap: { value: tex }, uTime: ctx.time, uFade: { value: 1 }, uTint: { value: new THREE.Color(0.66, 0.76, 1.0) }, uGain: { value: gain }, uSeed: { value: seed } };
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vW; uniform float uTime; uniform float uSeed;
        void main() {
          vUv = uv; vec3 p = position;
          // the hem stirs as if in a draught; the head stays still
          float sway = (1.0 - smoothstep(0.35, 1.0, uv.y));
          p.x += (sin(uv.y * 5.0 + uTime * 0.9 + uSeed) * 0.018 + sin(uv.y * 11.0 - uTime * 0.6) * 0.006) * sway;
          vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `varying vec2 vUv; varying vec3 vW; uniform sampler2D tMap; uniform float uTime; uniform float uFade; uniform vec3 uTint; uniform float uGain; uniform float uSeed;
        float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float vn(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
        float fbm3(vec3 p) { return vn(p) * 0.55 + vn(p * 2.03 + 7.1) * 0.3 + vn(p * 4.1 + 3.3) * 0.15; }
        void main() {
          vec2 uv = vUv;
          // slow smoke drift upward through the figure
          vec3 q = vec3(vW.x * 2.2, vW.y * 1.6 - uTime * 0.18, vW.z * 2.2 + uSeed);
          vec2 wob = vec2(fbm3(q * 0.7) - 0.5, fbm3(q * 0.7 + 11.0) - 0.5) * 0.02;
          vec4 t = texture2D(tMap, uv + wob * (1.0 - smoothstep(0.75, 0.9, uv.y)));
          float n = fbm3(q);
          float a = t.a;
          // rim: the thin part of the silhouette glows, the dense core is see-through
          float rim = smoothstep(0.03, 0.22, a) * (1.0 - 0.45 * smoothstep(0.35, 0.7, a));
          float face = smoothstep(0.78, 0.86, uv.y);                 // keep her face legible
          float dens = mix(rim * (0.45 + 0.75 * n), a * 1.15, face);
          dens *= smoothstep(0.0, 0.25, uv.y + 0.15 * (n - 0.5));    // ragged mist at the hem
          vec3 c = mix(vec3(dot(t.rgb, vec3(0.33))), t.rgb, 0.6) * uTint * dens * uFade * uGain;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    mat.userData.noBake = true;
    return { mat, uniforms };
  };
  const A = mk(0.0, 0.95), B = mk(5.3, 0.3);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.74), A.mat);
  card.name = 'ghost';
  card.renderOrder = 8;
  card.userData.noShadow = true;
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.74), B.mat);
  halo.scale.set(1.12, 1.04, 1); halo.position.set(0.015, 0.02, -0.07);
  halo.renderOrder = 7; halo.userData.noShadow = true; halo.name = 'ghostHalo';
  card.add(halo);
  // both cards share uFade through a proxy
  const uniforms = { uFade: { get value() { return A.uniforms.uFade.value; }, set value(v) { A.uniforms.uFade.value = v; B.uniforms.uFade.value = v; } } };
  return { mesh: card, uniforms };
}

// ============================================================================ silhouettes (cut-paper profiles in small ovals)
export function silhouetteTexture(ctx, seed, female) {
  return ctx.textures.canvas(`gallery:sil:${seed}`, 256, 320, (g, w, h) => {
    const grd = g.createRadialGradient(w * 0.5, h * 0.45, 20, w * 0.5, h * 0.5, w * 0.7);
    grd.addColorStop(0, '#e6dcc0'); grd.addColorStop(1, '#a8946a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // foxing
    for (let i = 0; i < 40; i++) { const x = (Math.sin(i * 12.9898 + seed) * 43758.5453 % 1 + 1) % 1 * w, y = (Math.sin(i * 78.233 + seed) * 12345.678 % 1 + 1) % 1 * h; g.fillStyle = 'rgba(120,80,30,0.12)'; g.beginPath(); g.arc(x, y, 2 + (i % 5), 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#0d0b0a';
    g.save(); g.translate(w * 0.52, h * 0.5); if (seed % 2) g.scale(-1, 1);
    g.beginPath();
    // profile facing left: forehead, nose, lips, chin, neck, bust
    g.moveTo(10, -110); g.bezierCurveTo(-30, -112, -52, -88, -54, -60);
    g.lineTo(-58, -40); g.lineTo(-72, -22); g.lineTo(-58, -16); g.lineTo(-60, -6); g.lineTo(-54, -2); g.lineTo(-58, 6); g.bezierCurveTo(-56, 20, -44, 26, -34, 28);
    g.bezierCurveTo(-30, 40, -30, 52, -36, 62); g.bezierCurveTo(-70, 80, -96, 100, -100, 140); g.lineTo(90, 140);
    g.bezierCurveTo(84, 96, 50, 78, 34, 60);
    if (female) { g.bezierCurveTo(60, 40, 76, -10, 62, -50); g.bezierCurveTo(80, -60, 84, -96, 52, -110); }
    else { g.bezierCurveTo(46, 20, 54, -20, 50, -60); g.bezierCurveTo(52, -90, 40, -110, 10, -110); }
    g.closePath(); g.fill();
    if (female) { g.beginPath(); g.ellipse(52, -82, 26, 22, 0, 0, Math.PI * 2); g.fill(); }
    g.restore();
    g.strokeStyle = 'rgba(60,40,15,0.5)'; g.lineWidth = 3; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 6, h / 2 - 6, 0, 0, Math.PI * 2); g.stroke();
  }, { tile: false });
}

/** small oval frame (gilt torus) with a canvas/paper inside. Facing +Z, origin at centre. */
export function makeOvalFrame(ctx, mat, innerMat, w = 0.24, h = 0.3) {
  const g = new THREE.Group();
  g.name = 'oval';
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), innerMat);
  disc.scale.set(w, h, 1); disc.position.z = 0.012; g.add(disc);
  const tor = withCavity(new THREE.TorusGeometry(0.5, 0.045, 10, 64), (x, y, z, nz) => 0.35 + 0.65 * Math.max(0, nz));
  const ring = new THREE.Mesh(tor, mat.gilt);
  ring.scale.set(w + 0.02, h + 0.02, 0.45); ring.position.z = 0.014; g.add(ring);
  const tor2 = withCavity(new THREE.TorusGeometry(0.5, 0.02, 8, 64), () => 1.0);
  const bead = new THREE.Mesh(tor2, mat.gilt);
  bead.scale.set(w + 0.07, h + 0.07, 0.35); bead.position.z = 0.008; g.add(bead);
  // ribbon bow on top
  const bow = new THREE.Mesh(withCavity(new THREE.TorusKnotGeometry(0.012, 0.004, 40, 6, 2, 3), () => 0.9), mat.gilt);
  bow.position.set(0, h / 2 + 0.05, 0.012); bow.scale.set(1.6, 1, 0.6); g.add(bow);
  const back = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), mat.black);
  back.scale.set(w + 0.1, h + 0.1, 1); back.position.z = 0.002; g.add(back);
  return g;
}

/** Ornate rectangular gilt frame + canvas. Facing +Z, origin canvas centre. */
export function makeGiltFrame(ctx, mat, canvasMat, w, h, { fw = 0.12, profile = 'ornate', corners = true } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'framed';
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), canvasMat);
  canvas.position.z = 0.017; canvas.name = 'canvas';
  g.add(canvas);
  const fr = new THREE.Mesh(frameGeometry(w, h, FRAME_PROFILES[profile](fw)), mat.gilt);
  fr.position.z = 0.0; g.add(fr);
  if (corners) {
    // cast corner cartouches: lathe rosette + acanthus leaves (real relief)
    const rose = withCavity(G.latheFromProfile([[0, 0.034], [0.012, 0.03], [0.02, 0.022], [0.026, 0.012], [0.03, 0.0], [0, 0]], 12), (x, y, z) => 0.3 + 0.7 * Math.min(1, Math.max(0, y / 0.034)));
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const r = new THREE.Mesh(rose, mat.gilt);
      r.rotation.x = Math.PI / 2;
      r.position.set(sx * (w / 2 + fw * 0.62), sy * (h / 2 + fw * 0.62), 0.052);
      r.scale.set(fw * 9, 1.2, fw * 9);
      g.add(r);
      for (let k = 0; k < 2; k++) {
        const leaf = new THREE.Mesh(withCavity(new THREE.SphereGeometry(0.5, 10, 6), (x, y, z, nz) => 0.3 + 0.7 * Math.max(0, nz)), mat.gilt);
        leaf.scale.set(fw * 0.85, fw * 0.28, 0.022);
        const along = k === 0;
        leaf.position.set(sx * (w / 2 + fw * 0.62 - (along ? fw * 0.75 : 0)), sy * (h / 2 + fw * 0.62 - (along ? 0 : fw * 0.75)), 0.05);
        leaf.rotation.z = along ? 0 : Math.PI / 2;
        g.add(leaf);
      }
    }
    // centre-top shell cresting
    const shell = new THREE.Mesh(withCavity(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), (x, y, z) => 0.4 + 0.6 * Math.abs(Math.sin(Math.atan2(x, z) * 7))), mat.gilt);
    shell.rotation.x = Math.PI / 2; shell.scale.set(fw * 1.6, 0.05, fw * 1.0);
    shell.position.set(0, h / 2 + fw * 0.7, 0.04); g.add(shell);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + fw * 2 - 0.01, h + fw * 2 - 0.01, 0.015), mat.black);
  back.position.z = 0.0; g.add(back);
  return { group: g, canvas, frame: fr };
}

/**
 * Brass picture light above a frame: a chased rosette on the wall, two swan-neck arms, and a
 * trough reflector (rolled bead lip, domed end caps) with a glowing lamp strip on its underside.
 * Facing +Z, origin at the wall.
 */
export function makePictureLight(ctx, mat, width = 0.42) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  const brass = mat.brassBright || mat.brass;
  const rose = new THREE.Mesh(G.latheFromProfile([[0, 0.016], [0.012, 0.015], [0.022, 0.01], [0.03, 0.004], [0.032, 0], [0, 0]], 24), mat.brass);
  rose.rotation.x = Math.PI / 2; g.add(rose);
  const reach = 0.17, lift = 0.05;
  for (const s of [-1, 1]) {
    const x = s * width * 0.3;
    const c = new THREE.CatmullRomCurve3([V3(0, 0, 0.012), V3(x * 0.5, 0.035, 0.05), V3(x, 0.06, 0.11), V3(x, lift + 0.01, reach - 0.012)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.005, 8), brass));
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), brass); knuckle.position.set(x, lift + 0.01, reach - 0.012); g.add(knuckle);
  }
  // trough: an open-bottomed rolled sheet (profile swept along x), bead along the front lip
  const sh = new THREE.Shape();
  const prof = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14, a = -0.35 + t * (Math.PI + 0.55); prof.push([Math.cos(a) * 0.034, Math.sin(a) * 0.03]); }
  sh.moveTo(prof[0][0], prof[0][1]); for (const [px, py] of prof.slice(1)) sh.lineTo(px, py);
  for (const [px, py] of prof.slice().reverse()) sh.lineTo(px * 0.9, py * 0.88);
  const tg = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: false, curveSegments: 4 });
  tg.translate(0, 0, -width / 2); tg.rotateY(Math.PI / 2); tg.rotateZ(0);
  const trough = new THREE.Mesh(G.applyBoxUVs ? G.applyBoxUVs(tg, 0.2) : tg, brass);
  trough.position.set(0, lift, reach); trough.rotation.x = -0.35; g.add(trough);
  const bead = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, width + 0.01, 10), brass);
  bead.rotation.z = Math.PI / 2; bead.position.set(0, lift - 0.018, reach + 0.03); g.add(bead);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.034, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), brass);
    cap.scale.set(1, 0.35, 0.9); cap.rotation.z = -s * Math.PI / 2; cap.position.set(s * width / 2, lift, reach); g.add(cap);
    const fin = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.006, 0.002], [0.004, 0.012], [0, 0.016]], 10), brass);
    fin.rotation.z = -s * Math.PI / 2; fin.position.set(s * (width / 2 + 0.012), lift, reach); g.add(fin);
  }
  // the lamp strip tucked inside the trough, glowing warm on the underside only
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.03, 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.72, 0.42).multiplyScalar(1.6), name: 'picLamp' }));
  strip.rotation.x = Math.PI / 2 + 0.35; strip.position.set(0, lift - 0.012, reach + 0.006); g.add(strip);
  return g;
}

// ============================================================================ furniture
export function makeSideChair(ctx, mat) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'chair';
  // seat rail (serpentine front) + a crowned, piped velvet cushion with brass nailheads
  const rail = new THREE.Mesh(G.applyBoxUVs(new G.RoundedBoxGeometry(0.46, 0.065, 0.44, 2, 0.012), 1), mat.mahogany); rail.position.set(0, 0.41, 0.25); g.add(rail);
  const cush = makeCushion(ctx, 0.45, 0.06, 0.43, mat.velvetSeat, { crown: 0.03, radius: 0.022, piping: mat.velvetSeat });
  cush.position.set(0, 0.442, 0.25); g.add(cush);
  const nail = new THREE.SphereGeometry(0.0045, 8, 5);
  const nails = [];
  for (let i = 0; i <= 22; i++) nails.push([-0.225 + i * (0.45 / 22), 0.25 + 0.218]);
  for (let i = 1; i < 20; i++) { const z = 0.25 + 0.215 - i * (0.43 / 20); nails.push([-0.228, z], [0.228, z]); }
  const nm = new THREE.InstancedMesh(nail, mat.brass, nails.length);
  const m4 = new THREE.Matrix4();
  nails.forEach(([x, z], i) => {
    const onFront = Math.abs(z - 0.468) < 0.001;
    m4.makeTranslation(onFront ? x : x + Math.sign(x) * 0.004, 0.452, onFront ? z + 0.004 : z);
    nm.setMatrixAt(i, m4);
  });
  g.add(nm);
  // cabriole-ish turned front legs
  const legF = G.latheFromProfile([[0.02, 0], [0.014, 0.03], [0.02, 0.1], [0.016, 0.2], [0.024, 0.3], [0.02, 0.36], [0.026, 0.38], [0, 0.38]], 14);
  for (const x of [-0.19, 0.19]) { const l = new THREE.Mesh(legF, mat.mahogany); l.position.set(x, 0, 0.43); g.add(l); }
  // sabre back legs sweep up into the balloon back
  for (const x of [-0.18, 0.18]) {
    const c = new THREE.CatmullRomCurve3([V3(x, 0, -0.02), V3(x, 0.2, 0.05), V3(x, 0.42, 0.065), V3(x * 0.96, 0.62, 0.045), V3(x * 1.05, 0.8, 0.0)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 20, 0.017, 10), mat.mahogany));
  }
  const balloon = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.019, 10, 48), mat.mahogany);
  balloon.position.set(0, 0.81, 0.0); balloon.scale.set(1.0, 0.8, 1.0); g.add(balloon);
  // pierced fiddle-back splat: vase silhouette with three cut-outs
  const sp = new THREE.Shape();
  sp.moveTo(-0.035, 0); sp.bezierCurveTo(-0.075, 0.04, -0.03, 0.08, -0.045, 0.12); sp.bezierCurveTo(-0.07, 0.17, -0.09, 0.2, -0.055, 0.25);
  sp.lineTo(0.055, 0.25); sp.bezierCurveTo(0.09, 0.2, 0.07, 0.17, 0.045, 0.12); sp.bezierCurveTo(0.03, 0.08, 0.075, 0.04, 0.035, 0); sp.lineTo(-0.035, 0);
  const h1 = new THREE.Path(); h1.absellipse(0, 0.19, 0.022, 0.035, 0, Math.PI * 2, true); sp.holes.push(h1);
  const h2 = new THREE.Path(); h2.absellipse(-0.022, 0.1, 0.009, 0.025, 0, Math.PI * 2, true); sp.holes.push(h2);
  const h3 = new THREE.Path(); h3.absellipse(0.022, 0.1, 0.009, 0.025, 0, Math.PI * 2, true); sp.holes.push(h3);
  const sg = G.applyBoxUVs(new THREE.ExtrudeGeometry(sp, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 16 }), 1);
  const splat = new THREE.Mesh(sg, mat.mahogany); splat.position.set(0, 0.6, 0.035); splat.rotation.x = -0.08; g.add(splat);
  const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.36, 10), mat.mahogany); cross.rotation.z = Math.PI / 2; cross.position.set(0, 0.6, 0.045); g.add(cross);
  return g;
}

/**
 * Pedestal with a bust under a dust sheet. Origin at the floor, facing +Z.
 * The sheet is an offline cloth simulation (tools/simSheet.mjs -> dustsheet.bin): a square of
 * linen dropped over a sculpted bust proxy, gripping the brow, nose and shoulders, with tension
 * lines radiating from them and free folds below. Vertex colour carries settled dust on the
 * upward-facing cloth and occlusion in the fold valleys.
 */
export async function makeCoveredBust(ctx, mat) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'coveredBust';
  // ---- turned ebonised column on a square plinth, moulded capital + square abacus
  const plinth = new THREE.Mesh(G.applyBoxUVs(new G.RoundedBoxGeometry(0.36, 0.12, 0.36, 2, 0.008), 1), mat.pedestal); plinth.position.y = 0.06; g.add(plinth);
  const prof = [[0, 0.12], [0.15, 0.12], [0.155, 0.13], [0.14, 0.14], [0.145, 0.155], [0.13, 0.17], [0.112, 0.175], [0.11, 0.19], [0.1, 0.21], [0.098, 0.24], [0.094, 0.5], [0.088, 0.82], [0.086, 0.86], [0.1, 0.87], [0.1, 0.885], [0.088, 0.895], [0.1, 0.91], [0.13, 0.935], [0.145, 0.95], [0.145, 0.96], [0, 0.96]];
  const col = new THREE.Mesh(G.latheFromProfile(prof, 48), mat.pedestal); g.add(col);
  // fluting: shallow reeds proud of the shaft (same ebonised wood, not a separate colour)
  const reed = new THREE.CylinderGeometry(0.0055, 0.0055, 0.56, 6);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const f = new THREE.Mesh(reed, mat.pedestal);
    f.position.set(Math.cos(a) * 0.09, 0.53, Math.sin(a) * 0.09); f.scale.set(1, 1, 0.5); f.rotation.y = -a; g.add(f);
  }
  const abacus = new THREE.Mesh(G.applyBoxUVs(new G.RoundedBoxGeometry(0.32, 0.04, 0.32, 2, 0.005), 1), mat.pedestal); abacus.position.y = 0.98; g.add(abacus);

  // ---- the simulated sheet
  const buf = await (await fetch(ctx.assetUrl('dustsheet.bin'))).arrayBuffer();
  const N = new Uint32Array(buf, 0, 1)[0];
  const src = new Float32Array(buf, 4, N * N * 3);
  const contact = new Float32Array(buf, 4 + N * N * 12, N * N);
  const pos = new Float32Array(src);
  const uvs = new Float32Array(N * N * 2);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * N + i; uvs[a * 2] = i / (N - 1); uvs[a * 2 + 1] = j / (N - 1); }
  const index = [];
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    const a = j * N + i;
    index.push(a, a + N, a + 1, a + 1, a + N, a + N + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  // outward normals (relative to the bust's axis)
  {
    const n = geo.attributes.normal;
    let out = 0; for (let i = 0; i < n.count; i++) out += n.getX(i) * pos[i * 3] + n.getY(i) * (pos[i * 3 + 1] - 1.2) + n.getZ(i) * pos[i * 3 + 2];
    if (out < 0) { for (let i = 0; i < index.length; i += 3) { const t = index[i + 1]; index[i + 1] = index[i + 2]; index[i + 2] = t; } geo.setIndex(index); geo.computeVertexNormals(); }
  }
  // dust + cavity: valleys (vertex below the average of its ring) darken; up-facing cloth greys
  {
    const n = geo.attributes.normal;
    const colr = new Float32Array(N * N * 3);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * N + i;
      let cav = 0;
      if (i > 1 && j > 1 && i < N - 2 && j < N - 2) {
        let ax = 0, ay = 0, az = 0;
        for (const o of [-2, 2, -2 * N, 2 * N]) { ax += pos[(a + o) * 3]; ay += pos[(a + o) * 3 + 1]; az += pos[(a + o) * 3 + 2]; }
        ax = ax / 4 - pos[a * 3]; ay = ay / 4 - pos[a * 3 + 1]; az = az / 4 - pos[a * 3 + 2];
        cav = ax * n.getX(a) + ay * n.getY(a) + az * n.getZ(a);    // > 0 = concave valley
      }
      const occ = THREE.MathUtils.clamp(1 - cav * 60, 0.45, 1.08);
      const up = Math.max(0, n.getY(a));
      const dust = up * up * 0.32;
      // dust is a dull grey-brown film: darker and less saturated than the clean linen
      colr[a * 3] = occ * (1 - dust * 0.85);
      colr[a * 3 + 1] = occ * (1 - dust * 0.88);
      colr[a * 3 + 2] = occ * (1 - dust * 0.95);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  }
  const sheet = new THREE.Mesh(geo, mat.sheet);
  sheet.name = 'dustSheet';
  g.add(sheet);
  return g;
}

/** Domed brass birdcage with a perch. Origin at its base. */
export function makeBirdcage(ctx, mat) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'birdcage';
  const base = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.13, 0], [0.135, 0.01], [0.12, 0.03], [0.125, 0.045], [0, 0.045]], 24), mat.brass); g.add(base);
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const y = 0.045 + t * 0.32;
      const r = t < 0.62 ? 0.115 : 0.115 * Math.cos(((t - 0.62) / 0.38) * Math.PI / 2);
      pts.push(V3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.0016, 4), mat.brass));
  }
  for (const y of [0.1, 0.2, 0.245]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.003, 4, 32), mat.brass); ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring); }
  const top = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.015, 0], [0.01, 0.02], [0.016, 0.03], [0, 0.045]], 12), mat.brass); top.position.y = 0.365; g.add(top);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.003, 6, 16), mat.brass); hook.position.y = 0.425; g.add(hook);
  const perch = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.2, 6), mat.mahogany); perch.rotation.z = Math.PI / 2; perch.position.y = 0.14; g.add(perch);
  // a single grey feather on the floor of the cage
  const feather = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.012), mat.sheet); feather.rotation.x = -Math.PI / 2; feather.rotation.z = 0.6; feather.position.set(0.03, 0.047, 0.02); g.add(feather);
  return g;
}

/**
 * Leaded stained-glass transom: a sunburst fan between quarry-glazed side lights, in a muted
 * jewel palette (oxblood, bottle green, amber, cobalt), seedy/hammered glass, 3 px lead cames
 * with a rounded highlight, and grime gathered at the edges.
 */
export function transomTexture(ctx) {
  return ctx.textures.canvas('gallery:transom2', 1024, 136, (g, w, h) => {
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pal = ['#5a1216', '#173a24', '#9a6a1c', '#1a2c5c', '#6e5a2a', '#3c1830', '#8a7a52'];
    const panes = [];   // [path builder, colour]
    const cx = w / 2, cy = h + 4;
    // sunburst fan (two rings) in the middle third
    const R0 = 34, R1 = 82, R2 = 128;
    for (let ring = 0; ring < 2; ring++) {
      const n = ring ? 11 : 7, ra = ring ? R1 : R0, rb = ring ? R2 : R1;
      for (let i = 0; i < n; i++) {
        const a0 = Math.PI + (i / n) * Math.PI, a1 = Math.PI + ((i + 1) / n) * Math.PI;
        panes.push([(c) => { c.beginPath(); c.arc(cx, cy, rb, a0, a1); c.arc(cx, cy, ra, a1, a0, true); c.closePath(); }, ring ? pal[[0, 2, 3, 2, 1, 2, 0, 2, 3, 2, 1][i]] : pal[[4, 6, 4, 6, 4, 6, 4][i]]]);
      }
    }
    panes.push([(c) => { c.beginPath(); c.arc(cx, cy, R0, Math.PI, 0); c.closePath(); }, '#b08a3a']);
    // side lights: diamond quarries in a border
    for (const side of [0, 1]) {
      const x0 = side ? cx + R2 + 14 : 10, x1 = side ? w - 10 : cx - R2 - 14;
      const qw = 46, qh = 58, rows = 3;
      for (let r = -1; r < rows; r++) for (let q = -1; q * qw < x1 - x0 + qw; q++) {
        const x = x0 + q * qw + (r % 2 ? qw / 2 : 0), y = 10 + r * qh / 2 + qh / 2;
        const col = (q + r + side) % 5 === 0 ? pal[(q + r * 3 + 7) % 4] : '#5c5f50';
        panes.push([(c) => { c.save(); c.beginPath(); c.rect(x0, 10, x1 - x0, h - 20); c.clip(); c.beginPath(); c.moveTo(x, y - qh / 2); c.lineTo(x + qw / 2, y); c.lineTo(x, y + qh / 2); c.lineTo(x - qw / 2, y); c.closePath(); c.restore(); }, col, [x0, x1]]);
      }
    }
    g.fillStyle = '#5c5f50'; g.fillRect(0, 0, w, h);
    // fill panes with hammered glass: base colour * cell noise
    for (const [path, col, clip] of panes) {
      g.save();
      if (clip) { g.beginPath(); g.rect(clip[0], 10, clip[1] - clip[0], h - 20); g.clip(); }
      path(g); g.fillStyle = col; g.fill();
      g.restore();
    }
    // seedy / hammered texture over everything
    const img = g.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const ham = 0.82 + 0.3 * (0.5 + 0.25 * Math.sin(x * 0.9 + Math.sin(y * 0.7) * 2) + 0.25 * Math.sin(y * 1.1 + Math.sin(x * 0.5) * 2));
      const seedB = rnd() < 0.004 ? 1.5 : 1.0;
      const ex = Math.min(x, w - 1 - x, y * 6, (h - 1 - y) * 6) / 60;           // grime toward the frame
      const grime = 0.45 + 0.55 * Math.min(1, ex);
      for (let k = 0; k < 3; k++) img.data[i + k] = Math.min(255, img.data[i + k] * ham * seedB * grime);
    }
    g.putImageData(img, 0, 0);
    // lead cames: dark 4 px line with a soft highlight on top
    const lead = (path, clip) => {
      g.save(); if (clip) { g.beginPath(); g.rect(clip[0], 10, clip[1] - clip[0], h - 20); g.clip(); }
      path(g); g.strokeStyle = '#0d0b09'; g.lineWidth = 4; g.stroke();
      path(g); g.strokeStyle = 'rgba(120,110,95,0.35)'; g.lineWidth = 1; g.stroke();
      g.restore();
    };
    for (const [path, , clip] of panes) lead(path, clip);
    g.strokeStyle = '#0d0b09'; g.lineWidth = 6;
    for (const side of [0, 1]) { const x0 = side ? cx + R2 + 14 : 10, x1 = side ? w - 10 : cx - R2 - 14; g.strokeRect(x0, 10, x1 - x0, h - 20); }
    g.lineWidth = 12; g.strokeRect(0, 0, w, h);
  }, { tile: false });
}

// ============================================================================ upholstery
/**
 * Crowned, piped, button-tufted cushion. Origin at the centre of its base, top facing +Y.
 * opts: crown (m), buttons [[nx,nz],...] in -1..1, piping material, button material, dimple depth.
 */
export function makeCushion(ctx, w, h, d, fabric, { crown = 0.02, radius = 0.025, buttons = [], piping = null, buttonMat = null, dimple = 0.012, seg = 10 } = {}) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'cushion';
  const geo = new G.RoundedBoxGeometry(w, h, d, seg, radius);
  const p = geo.attributes.position;
  const bpos = buttons.map(([nx, nz]) => [nx * w / 2, nz * d / 2]);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = THREE.MathUtils.smoothstep(y, -h * 0.1, h / 2);           // top faces move most
    const fx = 1 - Math.pow(Math.min(1, Math.abs(x) / (w / 2)), 2.2), fz = 1 - Math.pow(Math.min(1, Math.abs(z) / (d / 2)), 2.2);
    let dy = crown * fx * fz * t;
    // tufting: dimples pulled down toward each button, with soft pleats radiating between
    for (const [bx, bz] of bpos) {
      const r2 = ((x - bx) ** 2 + (z - bz) ** 2) / (0.045 * 0.045);
      dy -= dimple * Math.exp(-r2) * t;
    }
    // sides bulge a little
    const side = (1 - Math.abs(y) / (h / 2)) * 0.006;
    const sx = Math.sign(x) * side * THREE.MathUtils.smoothstep(Math.abs(x), w / 2 - radius * 1.2, w / 2);
    const sz = Math.sign(z) * side * THREE.MathUtils.smoothstep(Math.abs(z), d / 2 - radius * 1.2, d / 2);
    p.setXYZ(i, x + sx, y + h / 2 + dy, z + sz);
  }
  geo.computeVertexNormals();
  // metre UVs on the top for patterned fabrics
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) + w / 2, p.getZ(i) + d / 2);
  const body = new THREE.Mesh(geo, fabric);
  g.add(body);
  if (piping) {
    // piping cord around the top and bottom seams (rounded-rectangle loops)
    for (const yy of [h - radius * 0.32, radius * 0.32]) {
      const ix = w / 2 - radius * 0.3, iz = d / 2 - radius * 0.3, rr = radius * 0.7;
      const shape = new THREE.Path();
      shape.moveTo(-ix + rr, -iz); shape.lineTo(ix - rr, -iz); shape.quadraticCurveTo(ix, -iz, ix, -iz + rr); shape.lineTo(ix, iz - rr);
      shape.quadraticCurveTo(ix, iz, ix - rr, iz); shape.lineTo(-ix + rr, iz); shape.quadraticCurveTo(-ix, iz, -ix, iz - rr); shape.lineTo(-ix, -iz + rr); shape.quadraticCurveTo(-ix, -iz, -ix + rr, -iz);
      const pts = shape.getSpacedPoints(160).map((q) => V3(q.x, yy, q.y));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, 0.0045, 6, true), piping);
      g.add(tube);
    }
  }
  if (buttonMat) {
    const bg = new THREE.SphereGeometry(0.009, 10, 6);
    for (const [bx, bz] of bpos) {
      const b = new THREE.Mesh(bg, buttonMat);
      const fx = 1 - Math.pow(Math.abs(bx) / (w / 2), 2.2), fz = 1 - Math.pow(Math.abs(bz) / (d / 2), 2.2);
      b.position.set(bx, h + crown * fx * fz - dimple + 0.003, bz); b.scale.set(1, 0.55, 1);
      g.add(b);
    }
  }
  return g;
}

/** linen weave normal/roughness set for dust sheets */
export function linenTexture(ctx) {
  return ctx.textures.generate('gallery:linen', {
    size: 512, tile: true, normalStrength: 1.0,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv * 64.0;
      float wx = sin(p.x * 6.2832) * 0.5 + 0.5, wy = sin(p.y * 6.2832) * 0.5 + 0.5;
      float over = step(0.5, fract((floor(p.x) + floor(p.y)) * 0.5));
      float thread = mix(wx, wy, over);
      float slub = fbm(vec2(uv.x * 8.0, uv.y * 64.0), vec2(8.0, 64.0), 3) * 0.5 + 0.5;
      float stain = fbm(uv * 3.0, vec2(3.0), 4) * 0.5 + 0.5;
      s.albedo = vec3(0.62, 0.6, 0.55) * (0.88 + 0.12 * thread) * (0.92 + 0.1 * slub) * (1.0 - 0.18 * smoothstep(0.55, 0.8, stain));
      s.height = 0.5 + 0.3 * thread + 0.1 * slub;
      s.rough = 0.88; s.metal = 0.0; s.ao = 0.9 + 0.1 * thread;
    }`,
  });
}

/**
 * Jardiniere on a turned mahogany torchère stand, holding an aspidistra gone brown at the tips.
 * Facing +Z, origin at the floor (the stand stands ~0.22 m off the wall).
 */
export function makeJardiniere(ctx, mat) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'jardiniere';
  const z = 0.24;
  // tripod stand: three splayed legs, turned shaft, dished top
  const shaft = new THREE.Mesh(G.latheFromProfile([[0, 0.12], [0.035, 0.12], [0.04, 0.16], [0.022, 0.2], [0.026, 0.42], [0.018, 0.6], [0.03, 0.66], [0.02, 0.7], [0, 0.7]], 16), mat.mahogany);
  shaft.position.set(0, 0, z); g.add(shaft);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const c = new THREE.CatmullRomCurve3([V3(0, 0.15, 0), V3(Math.cos(a) * 0.08, 0.08, Math.sin(a) * 0.08), V3(Math.cos(a) * 0.17, 0.012, Math.sin(a) * 0.17)]);
    const leg = new THREE.Mesh(new THREE.TubeGeometry(c, 10, 0.014, 8), mat.mahogany); leg.position.z = z; g.add(leg);
  }
  const top = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.13, 0], [0.135, 0.01], [0.13, 0.022], [0.12, 0.024], [0.115, 0.012], [0, 0.012]], 32), mat.mahogany);
  top.position.set(0, 0.7, z); g.add(top);
  // the pot: blue-and-white porcelain jardiniere with a rolled lip
  const pot = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.07, 0], [0.085, 0.015], [0.12, 0.08], [0.135, 0.14], [0.13, 0.19], [0.14, 0.205], [0.135, 0.215], [0.12, 0.21], [0, 0.2]], 40), mat.porcelainBlue);
  pot.position.set(0, 0.724, z); g.add(pot);
  // aspidistra: long lanceolate leaves arching out of the pot, tips browned
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x24301a, roughness: 0.6, side: THREE.DoubleSide, vertexColors: true, name: 'aspidistra' });
  let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2, tilt = 0.25 + rnd() * 0.75, L = 0.38 + rnd() * 0.22;
    const segs = 10, pos = [], col = [], idx = [];
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const w = 0.035 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) * (1 - 0.2 * t);
      const r = Math.sin(tilt) * L * t, y = Math.cos(tilt) * L * t - 0.5 * L * t * t * tilt;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
      pos.push(cx - px, y + 0.012 * t, cz - pz, cx + px, y + 0.012 * t, cz + pz, cx, y + 0.02 * Math.sin(Math.PI * t), cz);
      const brown = THREE.MathUtils.smoothstep(t, 0.7, 1.0) * (0.5 + 0.5 * rnd());
      for (let q = 0; q < 3; q++) col.push(1 + 1.6 * brown, 1 + 0.5 * brown, 1 - 0.2 * brown);
      if (k < segs) { const b = k * 3; idx.push(b, b + 3, b + 2, b + 2, b + 3, b + 5, b + 2, b + 5, b + 1, b + 1, b + 5, b + 4); }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    lg.setIndex(idx); lg.computeVertexNormals();
    const leaf = new THREE.Mesh(lg, leafMat);
    leaf.position.set(0, 0.9, z);
    g.add(leaf);
  }
  return g;
}
