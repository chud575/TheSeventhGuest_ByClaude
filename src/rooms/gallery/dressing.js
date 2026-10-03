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
export async function makeGhostCard(ctx) {
  const tex = await new THREE.TextureLoader().loadAsync(ctx.assetUrl('ghost.png'));
  tex.colorSpace = THREE.SRGBColorSpace;
  const uniforms = { tMap: { value: tex }, uTime: ctx.time, uFade: { value: 1 }, uTint: { value: new THREE.Color(0.62, 0.74, 1.0) }, uGain: { value: 1.1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `varying vec2 vUv; uniform float uTime;
      void main() { vUv = uv; vec3 p = position; p.x += sin(uv.y * 7.0 + uTime * 1.1) * 0.02 * (1.0 - uv.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `varying vec2 vUv; uniform sampler2D tMap; uniform float uTime; uniform float uFade; uniform vec3 uTint; uniform float uGain;
      void main() {
        vec2 uv = vUv;
        uv.x += sin(uv.y * 90.0 + uTime * 4.0) * 0.0025 + sin(uv.y * 13.0 - uTime * 1.3) * 0.004;
        vec4 t = texture2D(tMap, uv);
        float scan = 0.82 + 0.18 * sin(uv.y * 520.0 + uTime * 12.0);
        float breath = 0.85 + 0.15 * sin(uTime * 2.3 + uv.y * 4.0);
        // edge-bright: the denser the figure the more transparent its core reads
        float edge = smoothstep(0.05, 0.4, t.a) * (1.0 - 0.3 * smoothstep(0.7, 1.0, t.a));
        vec3 c = pow(t.rgb, vec3(1.6)) * uTint * edge * scan * breath * uFade * uGain;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  mat.userData.noBake = true;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.74), mat);
  card.name = 'ghost';
  card.renderOrder = 8;
  card.userData.noShadow = true;
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

/** small brass picture light (hood on an arm) above a frame. Facing +Z, origin at the wall. */
export function makePictureLight(ctx, mat, width = 0.42) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  const base = new THREE.Mesh(new G.RoundedBoxGeometry(0.06, 0.04, 0.02, 2, 0.005), mat.brass); g.add(base);
  const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0, 0, 0.01), V3(0, 0.03, 0.08), V3(0, 0.02, 0.16)]), 12, 0.006, 8), mat.brass); g.add(arm);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, width, 20, 1, true, Math.PI * 0.15, Math.PI * 1.1), mat.brass);
  hood.rotation.z = Math.PI / 2; hood.position.set(0, 0.02, 0.17); hood.material = mat.brass; g.add(hood);
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), mat.brass); cap.position.set(s * width / 2, 0.02, 0.17); cap.rotation.y = s * Math.PI / 2; g.add(cap); }
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, width - 0.04, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 2.0, 1.1), name: 'picLamp' }));
  tube.rotation.z = Math.PI / 2; tube.position.set(0, 0.008, 0.17); g.add(tube);
  return g;
}

// ============================================================================ furniture
export function makeSideChair(ctx, mat) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'chair';
  const seat = new THREE.Mesh(new G.RoundedBoxGeometry(0.44, 0.09, 0.42, 4, 0.035), mat.velvetSeat); seat.position.set(0, 0.47, 0.25); g.add(seat);
  const rail = new THREE.Mesh(new G.RoundedBoxGeometry(0.46, 0.06, 0.44, 2, 0.01), mat.mahogany); rail.position.set(0, 0.415, 0.25); g.add(rail);
  const legF = G.latheFromProfile([[0.02, 0], [0.014, 0.03], [0.02, 0.1], [0.016, 0.2], [0.024, 0.3], [0.02, 0.38], [0.026, 0.4], [0, 0.4]], 12);
  for (const x of [-0.19, 0.19]) { const l = new THREE.Mesh(legF, mat.mahogany); l.position.set(x, 0, 0.43); g.add(l); }
  // sabre back legs continue up into the balloon back
  for (const x of [-0.18, 0.18]) {
    const c = new THREE.CatmullRomCurve3([V3(x, 0, 0.0), V3(x, 0.2, 0.05), V3(x, 0.42, 0.06), V3(x * 0.95, 0.62, 0.04), V3(x * 1.05, 0.8, 0.0)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.016, 8), mat.mahogany));
  }
  const balloon = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.017, 8, 40), mat.mahogany);
  balloon.position.set(0, 0.8, 0.0); balloon.scale.set(1.0, 0.82, 1.0); g.add(balloon);
  const splat = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 20), mat.mahogany); splat.position.set(0, 0.74, 0.0); splat.scale.set(1.2, 0.8, 1); g.add(splat);
  const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 8), mat.mahogany); cross.rotation.z = Math.PI / 2; cross.position.set(0, 0.64, 0.03); g.add(cross);
  return g;
}

/** Pedestal with a bust under a dust sheet. Origin at the floor, facing +Z. */
export function makeCoveredBust(ctx, mat, random) {
  const G = ctx.geometry;
  const g = new THREE.Group();
  g.name = 'coveredBust';
  const ped = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.2, 0], [0.2, 0.05], [0.16, 0.08], [0.15, 0.12], [0.11, 0.16], [0.1, 0.9], [0.13, 0.94], [0.17, 0.98], [0.17, 1.02], [0, 1.02]], 32), mat.marble);
  g.add(ped);
  // sheet: bust silhouette lathe, flaring into hanging cloth with vertical folds
  const prof = [[0, 1.62], [0.06, 1.61], [0.095, 1.57], [0.105, 1.5], [0.09, 1.44], [0.07, 1.39], [0.1, 1.36], [0.2, 1.32], [0.24, 1.26], [0.25, 1.16], [0.24, 1.06], [0.23, 1.0], [0.24, 0.9], [0.25, 0.8], [0.255, 0.74]];
  const geo = G.latheFromProfile(prof, 64);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x), r = Math.hypot(x, z);
    const hang = THREE.MathUtils.smoothstep(1.32, 0.9, y);
    const fold = (Math.sin(a * 9 + Math.sin(a * 3) * 1.5) * 0.6 + Math.sin(a * 17 + 1.3) * 0.4) * 0.03 * hang;
    const drape = THREE.MathUtils.smoothstep(1.4, 1.25, y) * 0.012 * Math.sin(a * 5 + y * 20);
    const nr = r + fold + drape;
    // the bust is narrower front-to-back
    p.setXYZ(i, Math.cos(a) * nr, y, Math.sin(a) * nr * (y > 1.0 ? 0.72 : 0.85));
  }
  geo.computeVertexNormals();
  const sheet = new THREE.Mesh(geo, mat.sheet);
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

/** Leaded stained-glass transom texture */
export function transomTexture(ctx) {
  return ctx.textures.canvas('gallery:transom', 512, 160, (g, w, h) => {
    const cols = ['#7a1418', '#16406e', '#b8892a', '#2a5a2a', '#5a1a5a', '#c8b890'];
    g.fillStyle = '#0a0806'; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h;
    for (let ring = 0; ring < 3; ring++) {
      const r0 = 30 + ring * 45, r1 = r0 + 42;
      const n = 6 + ring * 4;
      for (let i = 0; i < n; i++) {
        const a0 = Math.PI + (i / n) * Math.PI, a1 = Math.PI + ((i + 1) / n) * Math.PI;
        g.beginPath(); g.arc(cx, cy, r1, a0, a1); g.arc(cx, cy, r0, a1, a0, true); g.closePath();
        g.fillStyle = cols[(i + ring * 2) % cols.length]; g.fill();
        g.strokeStyle = '#141008'; g.lineWidth = 4; g.stroke();
      }
    }
    // side diamonds
    for (const side of [0, 1]) for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const x = (side ? w - 90 : 10) + i * 22 + (j % 2) * 11, y = 20 + j * 60;
      g.beginPath(); g.moveTo(x, y + 30); g.lineTo(x + 11, y); g.lineTo(x + 22, y + 30); g.lineTo(x + 11, y + 60); g.closePath();
      g.fillStyle = cols[(i + j + side) % cols.length]; g.fill(); g.strokeStyle = '#141008'; g.lineWidth = 3; g.stroke();
    }
    g.strokeStyle = '#141008'; g.lineWidth = 8; g.strokeRect(0, 0, w, h);
  }, { tile: false });
}
