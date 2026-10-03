import * as THREE from 'three';

/**
 * The figure on the burning stair: Henry Stauf as a sculpted silhouette. A tall,
 * gaunt man in a knee-length frock coat (sloped shoulders, peaked lapels, a high
 * collar, skirts that part over the trousers and fall into creased tails behind),
 * a stovepipe hat seated and tipped on a long skull with a hooked nose, brow and
 * jutting chin, one hand folded over the knob of a cane, the other raised palm-up,
 * long jointed fingers curling to beckon.
 *
 * Shading: a near-black cloth core that still carries a whisper of form (cold
 * room fill from the front, warm wrap from the furnace), a fresnel rim that is
 * strongest on the edges turned toward the light behind him, and a world-space
 * 3D smoke noise that frays the outline and eats holes through the coat. The feet
 * stay solid and sit on a soft contact shadow; the cane stops at the floor.
 */

const VERT = /* glsl */ `
uniform float uTime;
uniform float uBaseY;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float hy = wp.y - uBaseY;
  // the coat skirts stir in the furnace draught (feet and shoulders stay put)
  float m = smoothstep(0.28, 0.5, hy) * smoothstep(1.05, 0.55, hy);
  float sw = sin(uTime * 0.9 + wp.y * 2.2 + wp.x * 3.0) * 0.010 * m;
  wp.x += sw; wp.z += sw * 0.6;
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uCore;
uniform vec3 uRim;
uniform vec3 uFill;
uniform float uRimGain;
uniform float uFray;
uniform float uBaseY;
uniform vec3 uLightPos;
uniform float uSolid;
varying vec3 vN;
varying vec3 vW;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fb(vec3 p) { return 0.5 * n3(p) + 0.25 * n3(p * 2.02 + 3.1) + 0.125 * n3(p * 4.03 + 7.7) + 0.0625 * n3(p * 8.1 + 1.3); }
void main() {
  vec3 n = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  if (dot(n, V) < 0.0) n = -n;
  float ndv = clamp(dot(n, V), 0.0, 1.0);
  float edge = 1.0 - ndv;
  vec3 L = normalize(uLightPos - vW);
  // the rim lives on the side of the outline that faces the light (projected into the view plane)
  vec3 Lp = L - V * dot(L, V);
  float lpl = length(Lp);
  float side = mix(1.0, clamp(0.35 + 0.9 * dot(n, Lp / max(lpl, 1e-4)), 0.0, 1.0), clamp(lpl * 1.4, 0.0, 1.0));
  float back = 0.55 + 0.45 * clamp(-dot(L, V), 0.0, 1.0);
  float hy = vW.y - uBaseY;
  vec3 q = vW * vec3(6.0, 3.0, 6.0) + vec3(0.0, -uTime * 0.45, uTime * 0.12);
  float smoke = fb(q);
  float s2 = fb(vW * vec3(15.0, 7.0, 15.0) + vec3(0.0, -uTime * 0.8, 0.0));
  float rim = pow(edge, 3.0) * side * back * uRimGain * (0.7 + 0.6 * smoke) * mix(0.3, 1.0, smoothstep(0.08, 0.2, hy));
  // a whisper of volume inside the black: warm wrap from the furnace, cold fill from the room
  float wrap = clamp((dot(n, L) + 0.35) / 1.35, 0.0, 1.0);
  vec3 col = uCore * (0.65 + 0.7 * smoke) + uRim * (rim + 0.012 * wrap * wrap) + uFill * ndv * ndv;
  // outline frays into smoke; holes drift through the coat skirts. Feet (hy < 0.16) stay solid.
  float keep = max(uSolid, 1.0 - smoothstep(0.12, 0.3, hy));
  float fray = smoothstep(0.62, 0.98, edge + (s2 - 0.5) * 0.55) * uFray;
  float holes = smoothstep(0.64, 0.8, s2) * smoothstep(0.3, 0.55, hy) * smoothstep(1.2, 0.7, hy) * 0.75 * uFray;
  float a = 1.0 - max(fray, holes) * (1.0 - keep);
  a = max(a, clamp(rim, 0.0, 1.0) * 0.6);
  gl_FragColor = vec4(col, clamp(a * uOpacity, 0.0, 1.0));
  #include <colorspace_fragment>
}`;

export function apparitionMaterial(timeUniform, { core = 0x0a0403, rim = 0xff6a2a, fill = 0x0a0d16, opacity = 1.0, rimGain = 1.8, fray = 1.0, solid = 0 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uTime: timeUniform || { value: 0 },
      uOpacity: { value: opacity },
      uCore: { value: new THREE.Color(core) },
      uRim: { value: new THREE.Color(rim) },
      uFill: { value: new THREE.Color(fill) },
      uRimGain: { value: rimGain },
      uFray: { value: fray },
      uSolid: { value: solid },
      uBaseY: { value: 0 },
      uLightPos: { value: new THREE.Vector3(0, 1.5, -8) },
    },
    transparent: true, depthWrite: true, side: THREE.DoubleSide, name: 'apparition',
  });
}

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const gauss = (x, w) => Math.exp(-(x * x) / (w * w));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Loft through elliptical sections. sections: [{ y, a, b, z?, open? }], `open` = half-angle of a gap
 * centred on +z (the coat front). deform(x, y, z, theta, ringIndex, t) -> [x, y, z].
 */
function loft(sections, { seg = 64, deform, capTop = false, capBottom = false } = {}) {
  const pos = [], idx = [];
  const rows = sections.length, cols = seg + 1;
  for (let r = 0; r < rows; r++) {
    const s = sections[r];
    const open = s.open || 0;
    for (let c = 0; c < cols; c++) {
      const u = c / seg;
      const th = Math.PI / 2 + open + u * (Math.PI * 2 - 2 * open);
      let x = s.a * Math.cos(th), y = s.y, z = (s.z || 0) + s.b * Math.sin(th);
      if (deform) [x, y, z] = deform(x, y, z, th, r, u, s);
      pos.push(x, y, z);
    }
  }
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < seg; c++) {
    const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const cap = (r, up) => {
    const s = sections[r]; const ci = pos.length / 3; pos.push(0, s.y, s.z || 0);
    for (let c = 0; c < seg; c++) { const a = r * cols + c; up ? idx.push(ci, a + 1, a) : idx.push(ci, a, a + 1); }
  };
  if (capTop) cap(rows - 1, true);
  if (capBottom) cap(0, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** tapered tube along points (radius per point), optional per-point ellipse squash */
function limb(points, radii, seg = 12, tubular = 28) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const g = new THREE.TubeGeometry(curve, tubular, 1, seg, false);
  const p = g.attributes.position, nrm = g.attributes.normal;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const k = t * (radii.length - 1), i0 = Math.floor(k), i1 = Math.min(radii.length - 1, i0 + 1);
    const r = THREE.MathUtils.lerp(radii[i0], radii[i1], k - i0);
    curve.getPointAt(t, c);
    for (let j = 0; j <= seg; j++) {
      const id = i * (seg + 1) + j;
      v.fromBufferAttribute(nrm, id);
      p.setXYZ(id, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** sphere deformed into a gaunt head (local: +z = face, +y = up), ~0.24 m tall */
function headGeometry() {
  const R = 0.1;
  const g = new THREE.SphereGeometry(R, 56, 44);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) / R, y = p.getY(i) / R, z = p.getZ(i) / R;   // unit sphere
    const front = Math.max(0, z);
    // long skull, narrow temples, high crown
    y *= 1.2;
    x *= 0.74 * (1 - 0.08 * Math.max(0, y - 0.3));
    z *= 0.92;
    // jaw: narrows toward a long, jutting chin
    if (y < 0) {
      const k = -y / 1.2;
      x *= 1 - 0.42 * k * k;
      z *= 1 - 0.12 * k;
      z += front * 0.32 * k * k * gauss(x, 0.35);
      y -= 0.18 * k * k * gauss(x, 0.4) * (front > 0.2 ? 1 : 0.5);
    }
    // occiput bulge
    z -= 0.12 * Math.max(0, -z) * gauss(y - 0.25, 0.5);
    // brow ridge
    z += 0.13 * front * gauss(y - 0.32, 0.12) * gauss(x, 0.55);
    // eye sockets
    z -= 0.16 * front * gauss(y - 0.16, 0.12) * gauss(Math.abs(x) - 0.3, 0.16);
    // hollow cheeks under the cheekbones
    x -= Math.sign(x) * 0.08 * gauss(y + 0.32, 0.22) * gauss(z - 0.45, 0.4);
    x += Math.sign(x) * 0.05 * gauss(y - 0.05, 0.12) * gauss(z - 0.55, 0.3);
    // hooked nose: bridge from the brow, a beak, a drop to the lip
    const ny = y - 0.0;
    const nose = gauss(x, 0.11 + 0.05 * Math.max(0, 0.2 - ny)) * front;
    const prof = ny > 0.25 ? 0.12 * gauss(ny - 0.25, 0.08) : ny > -0.25 ? 0.12 + 0.5 * (0.25 - ny) * (ny > -0.17 ? 1 : (ny + 0.25) / 0.08) : 0;
    z += nose * Math.min(prof, 0.5);
    // thin lips, a sunken mouth line
    z -= 0.05 * front * gauss(y + 0.42, 0.04) * gauss(x, 0.3);
    // ears
    const ear = gauss(y - 0.05, 0.16) * gauss(z + 0.05, 0.18);
    x += Math.sign(x) * 0.12 * ear;
    p.setXYZ(i, x * R, y * R, z * R);
  }
  g.computeVertexNormals();
  return g;
}

/** stovepipe hat (origin = brim plane centre), brim curling up at the sides */
function hatGeometry() {
  const prof = [[0.0, 0.0], [0.09, 0.0], [0.128, 0.004], [0.142, 0.012], [0.136, 0.016], [0.1, 0.012], [0.086, 0.016], [0.081, 0.04], [0.084, 0.12], [0.089, 0.19], [0.091, 0.2], [0.085, 0.205], [0.0, 0.205]];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), 48);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i) * 0.86;
    const r = Math.hypot(x, z / 0.86);
    const brim = THREE.MathUtils.smoothstep(r, 0.09, 0.14);
    const ang = Math.atan2(z, x);
    p.setXYZ(i, x, y + brim * 0.03 * Math.cos(ang) ** 2 - brim * 0.006 * Math.sin(ang) ** 2, z);
  }
  g.computeVertexNormals();
  return g;
}

/** a long-fingered hand. local: fingers along +z, palm faces +y. curl = [base, mid, tip] per finger. */
function handGroup(mat, { curl = [[0.35, 0.6, 0.6], [0.3, 0.55, 0.55], [0.35, 0.65, 0.6], [0.45, 0.75, 0.7]], spread = 0.12, thumb = 0.6, scale = 1 } = {}) {
  const h = new THREE.Group();
  // palm: a flattened, slightly cupped block
  const palm = new THREE.SphereGeometry(0.045, 20, 14);
  palm.scale(0.9, 0.36, 1.05).translate(0, 0, 0.035);
  h.add(new THREE.Mesh(palm, mat));
  const lens = [[0.05, 0.034, 0.026], [0.056, 0.038, 0.028], [0.053, 0.036, 0.027], [0.042, 0.03, 0.022]];
  for (let f = 0; f < 4; f++) {
    const x0 = -0.027 + f * 0.018;
    let p = V3(x0, 0, 0.075 - Math.abs(f - 1.5) * 0.006);
    let dir = V3(Math.sin((f - 1.5) * spread), 0, Math.cos((f - 1.5) * spread));
    const pts = [p.clone()];
    let pitch = 0;
    for (let s = 0; s < 3; s++) {
      pitch += curl[f][s];
      const d = V3(dir.x * Math.cos(pitch), Math.sin(pitch), dir.z * Math.cos(pitch));
      p = p.clone().addScaledVector(d, lens[f][s]);
      pts.push(p.clone());
    }
    h.add(new THREE.Mesh(limb(pts, [0.0085, 0.0075, 0.0062, 0.0045], 8, 16), mat));
  }
  // thumb
  const tp = [V3(-0.032, -0.004, 0.02), V3(-0.05, 0.004, 0.05), V3(-0.055, 0.012 + thumb * 0.02, 0.078), V3(-0.05, 0.02 + thumb * 0.03, 0.098)];
  h.add(new THREE.Mesh(limb(tp, [0.011, 0.009, 0.0075, 0.005], 8, 16), mat));
  h.scale.setScalar(scale);
  return h;
}

/** orient a group so local +z points along `dir` and local +y leans toward `up` */
function aim(o, pos, dir, up) {
  const Z = dir.clone().normalize();
  const Y = up.clone().sub(Z.clone().multiplyScalar(up.dot(Z))).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  o.position.copy(pos);
  return o;
}

export function buildApparition(mat, { shadowTex } = {}) {
  const g = new THREE.Group(); g.name = 'staufSilhouette';
  const parts = [];
  const add = (geo, parent = g) => { const m = new THREE.Mesh(geo, mat); parent.add(m); parts.push(m); return m; };

  // ---------------------------------------------------------------- frock coat: torso (closed) + skirts (open front)
  const WAIST = 1.02;
  const crease = (th, k) => {
    // three or four deep vertical folds + a soft undulation, growing toward the hem
    const c = -0.07 * gauss(wrapA(th - 2.35), 0.11) - 0.08 * gauss(wrapA(th - 0.75), 0.1) - 0.06 * gauss(wrapA(th + 1.25), 0.12) - 0.07 * gauss(wrapA(th + 1.95), 0.1)
      + 0.05 * gauss(wrapA(th - 1.55 - Math.PI), 0.35) + 0.025 * Math.sin(th * 5 + 0.7);
    return 1 + c * k;
  };
  const torso = loft([
    { y: WAIST - 0.02, a: 0.148, b: 0.108, z: 0.0 },
    { y: WAIST + 0.06, a: 0.152, b: 0.112, z: 0.005 },
    { y: 1.16, a: 0.168, b: 0.12, z: 0.012 },
    { y: 1.26, a: 0.186, b: 0.126, z: 0.015 },
    { y: 1.34, a: 0.2, b: 0.12, z: 0.01 },
    { y: 1.395, a: 0.212, b: 0.108, z: 0.0 },
    { y: 1.43, a: 0.2, b: 0.098, z: -0.005 },
    { y: 1.462, a: 0.15, b: 0.088, z: -0.008 },
    { y: 1.49, a: 0.085, b: 0.07, z: -0.008 },
    { y: 1.505, a: 0.055, b: 0.052, z: -0.006 },
  ], {
    seg: 72, capTop: true,
    // sloping shoulders: the outer ends of the upper rings drop
    deform: (x, y, z, th, r) => { const s = Math.abs(Math.cos(th)); const drop = r >= 4 ? 0.035 * s * s * (r - 3) / 6 : 0; return [x, y - drop, z]; },
  });
  add(torso);
  const skirtRows = [
    { y: WAIST + 0.01, a: 0.15, b: 0.11, open: 0.02 },
    { y: 0.93, a: 0.168, b: 0.124, open: 0.12 },
    { y: 0.8, a: 0.188, b: 0.14, open: 0.26 },
    { y: 0.66, a: 0.206, b: 0.155, open: 0.38 },
    { y: 0.52, a: 0.222, b: 0.17, open: 0.48 },
    { y: 0.42, a: 0.232, b: 0.18, open: 0.55 },
    { y: 0.36, a: 0.236, b: 0.186, open: 0.6 },
  ];
  const skirt = loft(skirtRows, {
    seg: 96,
    deform: (x, y, z, th, r) => {
      const k = r / (skirtRows.length - 1);
      const f = crease(th, k * k * 1.4 + 0.15 * k);
      let yy = y;
      // tails: the back hangs lower, split at centre back; the front edges cut away
      const backness = Math.max(0, -Math.sin(th));
      yy -= backness * 0.1 * k * k;
      yy += 0.03 * k * gauss(wrapA(th + Math.PI / 2), 0.08);
      return [x * f, yy, z * f + backness * 0.02 * k];
    },
  });
  add(skirt);
  // a thin inner lining so the skirt reads with thickness at the open front edges
  { const lin = skirt.clone(); lin.scale(0.965, 1, 0.955); add(lin); }

  // peaked lapels standing proud of the chest, rolling out at the edge
  for (const s of [-1, 1]) {
    const outline = [[0.035, 1.49], [0.07, 1.47], [0.112, 1.405], [0.098, 1.39], [0.132, 1.345], [0.1, 1.25], [0.05, 1.13], [0.018, 1.07], [0.012, 1.1], [0.03, 1.3], [0.035, 1.45]];
    const sh = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x * s, y)));
    const lg = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 });
    const p = lg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      // follow the chest's front curve
      const a = THREE.MathUtils.lerp(0.15, 0.2, THREE.MathUtils.clamp((y - 1.02) / 0.35, 0, 1));
      const b = THREE.MathUtils.lerp(0.112, 0.124, THREE.MathUtils.clamp((y - 1.02) / 0.3, 0, 1)) * (y > 1.38 ? 1 - (y - 1.38) * 2.2 : 1);
      const zf = b * Math.sqrt(Math.max(0, 1 - (x / a) ** 2)) + 0.012;
      const roll = 0.012 * THREE.MathUtils.smoothstep(Math.abs(x), 0.06, 0.13);
      p.setZ(i, p.getZ(i) + zf + roll);
    }
    lg.computeVertexNormals();
    add(lg);
  }
  // high standing collar behind the neck, open at the throat
  add(loft([
    { y: 1.47, a: 0.078, b: 0.07, z: -0.01, open: 0.55 },
    { y: 1.53, a: 0.07, b: 0.064, z: -0.012, open: 0.6 },
    { y: 1.575, a: 0.066, b: 0.06, z: -0.016, open: 0.75 },
  ], { seg: 40 }));
  // cravat knot at the throat
  add(new THREE.SphereGeometry(0.026, 14, 10).scale(1.2, 0.9, 0.7).translate(0, 1.49, 0.055));

  // ---------------------------------------------------------------- neck + head + hat
  add(limb([V3(0, 1.48, -0.012), V3(0, 1.56, 0.0), V3(0.004, 1.63, 0.018)], [0.046, 0.04, 0.038], 16, 12));
  const head = new THREE.Group();
  head.position.set(0.008, 1.715, 0.03);
  head.rotation.set(0.14, 1.2, -0.04, 'YXZ');   // turned in profile toward the beckoning hand, chin down
  g.add(head);
  add(headGeometry(), head);
  const hat = new THREE.Group();
  hat.position.set(0.0, 0.082, -0.012);
  hat.rotation.set(-0.1, 0.0, 0.07);          // seated on the skull, tipped back and to one side
  head.add(hat);
  add(hatGeometry(), hat);
  // faint embers where the eyes should be
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.32, 0.08).multiplyScalar(2.2), toneMapped: false, name: 'staufEyes' });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 6).scale(1.4, 0.7, 0.5), eyeMat);
    e.position.set(s * 0.029, 0.017, 0.074); head.add(e); parts.push(e);
  }

  // ---------------------------------------------------------------- legs and shoes (opaque; the coat parts over them)
  const legs = [
    { x: -0.078, fwd: -0.01 },
    { x: 0.082, fwd: 0.07 },
  ];
  for (const L of legs) {
    add(limb([V3(L.x * 0.9, 1.0, 0.0), V3(L.x, 0.75, L.fwd * 0.4 + 0.01), V3(L.x * 1.04, 0.47, L.fwd * 0.8 + 0.02), V3(L.x * 1.08, 0.2, L.fwd), V3(L.x * 1.1, 0.07, L.fwd)], [0.064, 0.058, 0.05, 0.045, 0.047], 14, 24));
    // shoe: long pointed toe, heel block
    const sh = new THREE.SphereGeometry(0.05, 20, 12);
    const p = sh.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const fz = z / 0.05;
      x *= 0.85 * (fz > 0 ? 1 - 0.45 * fz * fz : 1);
      z = z * (fz > 0 ? 2.3 : 1.2);
      y = Math.max(y * 0.7, -0.034) * (fz > 0.3 ? 1 - 0.35 * (fz - 0.3) : 1);
      p.setXYZ(i, x, y, z);
    }
    sh.computeVertexNormals();
    sh.translate(L.x * 1.1, 0.036, L.fwd + 0.045);
    sh.rotateY(L.x > 0 ? -0.12 : 0.16);
    add(sh);
  }

  // ---------------------------------------------------------------- arms
  // left (-x): hangs, elbow bent, hand folded over the cane knob
  const shL = V3(-0.188, 1.4, -0.005), elL = V3(-0.245, 1.135, 0.03), wrL = V3(-0.262, 0.93, 0.16);
  add(limb([shL, V3(-0.225, 1.28, 0.01), elL, V3(-0.258, 1.03, 0.09), wrL], [0.058, 0.052, 0.047, 0.044, 0.048], 14, 30));
  add(limb([wrL.clone().add(V3(0.004, 0.025, -0.02)), wrL.clone().add(V3(0, -0.008, 0.008))], [0.05, 0.054], 14, 4)); // cuff flare
  const knob = V3(-0.27, 0.865, 0.2);
  const handL = handGroup(mat, { curl: [[1.15, 1.2, 0.9], [1.1, 1.25, 0.9], [1.1, 1.2, 0.9], [1.05, 1.15, 0.9]], spread: 0.05, thumb: -0.2 });
  aim(handL, wrL.clone().add(V3(-0.004, -0.02, 0.02)), V3(0.05, -0.55, 0.65), V3(-1, 0.2, 0.1));
  g.add(handL); handL.traverse((o) => o.isMesh && parts.push(o));
  // cane: silver knob, ebony shaft that ends exactly on the floor with a ferrule
  const caneMat = mat.clone(); caneMat.name = 'apparitionCane';
  caneMat.uniforms.uTime = mat.uniforms.uTime; caneMat.uniforms.uLightPos = mat.uniforms.uLightPos; caneMat.uniforms.uRimGain = { value: 0.55 };
  add(new THREE.SphereGeometry(0.022, 14, 10).scale(1, 0.85, 1).translate(knob.x, knob.y + 0.012, knob.z));
  const foot = V3(-0.3, 0.0, 0.26);
  const cg = new THREE.CylinderGeometry(0.0085, 0.0095, knob.distanceTo(foot), 10).translate(0, -knob.distanceTo(foot) / 2, 0);
  const cane = new THREE.Mesh(cg, caneMat);
  cane.position.copy(knob);
  cane.quaternion.setFromUnitVectors(V3(0, -1, 0), foot.clone().sub(knob).normalize());
  g.add(cane); parts.push(cane);
  add(new THREE.CylinderGeometry(0.0095, 0.0085, 0.03, 10).translate(foot.x, 0.015, foot.z));

  // right (+x): elbow out, forearm raised, palm up, fingers curling toward himself
  const shR = V3(0.188, 1.4, -0.005), elR = V3(0.3, 1.17, 0.07), wrR = V3(0.33, 1.32, 0.31);
  add(limb([shR, V3(0.255, 1.29, 0.0), elR, V3(0.322, 1.22, 0.18), wrR], [0.058, 0.052, 0.048, 0.044, 0.046], 14, 30));
  add(limb([wrR.clone().add(V3(-0.004, -0.018, -0.03)), wrR.clone().add(V3(0.002, 0.004, 0.006))], [0.048, 0.052], 14, 4));
  const handR = handGroup(mat, { curl: [[0.25, 0.55, 0.5], [0.45, 0.8, 0.7], [0.6, 0.95, 0.8], [0.75, 1.1, 0.9]], spread: 0.16, thumb: 0.4, scale: 1.08 });
  aim(handR, wrR.clone().add(V3(0.004, 0.012, 0.012)), V3(0.08, 0.35, 0.95), V3(-0.15, 1, -0.2));
  g.add(handR); handR.traverse((o) => o.isMesh && parts.push(o));

  // ---------------------------------------------------------------- contact shadow under the feet + cane
  if (shadowTex) {
    const cs = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false, name: 'staufContact' }));
    cs.position.set(-0.03, 0.004, 0.08); cs.renderOrder = 3; cs.userData.noShadow = true; cs.userData.noBake = true;
    // alpha from the texture's luminance
    cs.material.alphaMap = shadowTex; cs.material.map = null;
    g.add(cs);
  }

  for (const o of parts) { o.userData.noBake = true; o.userData.noShadow = true; o.renderOrder = 7; o.frustumCulled = false; }
  g.userData.parts = parts;
  return g;
}
