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
uniform vec3 uFillDir;
uniform float uSolid;
uniform float uFade;
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
  // the glow lives on the side of the outline that faces the light (projected into the view plane)
  vec3 Lp = L - V * dot(L, V);
  float lpl = length(Lp);
  float side = mix(1.0, clamp(0.3 + 0.9 * dot(n, Lp / max(lpl, 1e-4)), 0.0, 1.0), clamp(lpl * 1.4, 0.0, 1.0));
  float back = 0.55 + 0.45 * clamp(-dot(L, V), 0.0, 1.0);
  float hy = vW.y - uBaseY;
  vec3 q = vW * vec3(6.0, 3.0, 6.0) + vec3(0.0, -uTime * 0.45, uTime * 0.12);
  float smoke = fb(q);
  float s2 = fb(vW * vec3(15.0, 7.0, 15.0) + vec3(0.0, -uTime * 0.8, 0.0));
  // soft view-dependent backlight: a broad falloff modulated by a drifting thickness mask, so the
  // edge glows like light scattering through smoke rather than drawing a line along every seam
  float thick = 0.25 + 0.95 * smoothstep(0.3, 0.72, fb(vW * vec3(9.0, 4.5, 9.0) + vec3(0.0, -uTime * 0.3, 0.0)));
  float rim = pow(edge, 4.2) * side * back * uRimGain * thick * 1.5;
  rim = rim / (1.0 + rim * 0.5);
  // translucency: thin smoke lets the furnace through where the light is right behind
  float trans = pow(clamp(-dot(L, V), 0.0, 1.0), 6.0) * 0.05 * smoothstep(0.55, 0.95, smoke) * edge * edge;
  // a whisper of volume inside the black: warm wrap from the furnace, cold fill from the room
  float wrap = clamp((dot(n, L) + 0.35) / 1.35, 0.0, 1.0);
  float cold = clamp(dot(n, normalize(uFillDir)) * 0.6 + 0.4, 0.0, 1.0);
  vec3 col = uCore * (0.65 + 0.7 * smoke) + uRim * (rim + trans + 0.02 * wrap * wrap) + uFill * cold * cold;
  // he is a ghost: below the knee the cloth thins into drifting vapour. A soft, wide dissolve (no hard
  // threshold), streaked vertically so it reads as smoke rising off the hem rather than torn alpha
  float wisp = fb(vW * vec3(9.0, 2.2, 9.0) + vec3(0.0, -uTime * 0.35, 0.0)) * 0.7 + fb(vW * vec3(22.0, 5.0, 22.0) + vec3(0.0, -uTime * 0.7, uTime * 0.1)) * 0.4;
  float fadeT = (1.0 - smoothstep(-0.05, 0.85, hy)) * uFade * 1.3;
  float fade = smoothstep(fadeT - 0.3, fadeT + 0.25, wisp);
  // the outline itself stays clean: only a faint, soft thinning right at grazing angles low on the coat
  float fray = smoothstep(0.9, 1.0, edge) * (1.0 - smoothstep(0.3, 0.9, hy)) * 0.5 * uFray * smoothstep(0.35, 0.75, s2);
  // the cut hem itself never shows: the cloth is fully vapour before it reaches the geometric edge
  fade = clamp(fade * (smoothstep(0.3, 0.62, hy + (wisp - 0.5) * 0.2) + (1.0 - step(0.0, 0.58 - hy))), 0.0, 1.0);
  float a = (1.0 - fray) * fade;
  // vapour glows faintly where it thins, lit from the furnace behind
  col += uRim * 0.03 * (1.0 - fade) * fade * 4.0 * back;
  if (a * uOpacity < 0.02) discard;
  gl_FragColor = vec4(max(col, vec3(0.0)), clamp(a * uOpacity, 0.0, 1.0));
  #include <colorspace_fragment>
}`;

const FACE_VERT = /* glsl */ `
uniform float uTime;
attribute float aCav;
varying vec3 vN;
varying vec3 vW;
varying float vCav;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vCav = aCav;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

/** the face: dead, waxy skin over a skull. Lit by a cold key from the attic and the furnace wrap from behind,
 *  sockets, grin and the hollows under the cheekbones sunk in shadow by a sculpted cavity term */
const FACE_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSkin;
uniform vec3 uRim;
uniform float uRimGain;
uniform vec3 uLightPos;
uniform vec3 uFillDir;
uniform float uKey;
varying vec3 vN;
varying vec3 vW;
varying float vCav;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main() {
  vec3 n = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  if (dot(n, V) < 0.0) n = -n;
  float ndv = clamp(dot(n, V), 0.0, 1.0);
  vec3 L = normalize(uLightPos - vW);
  vec3 F = normalize(uFillDir);
  // half-lambert cold key from the room, a hard furnace rim from behind
  float key = pow(clamp(dot(n, F) * 0.5 + 0.5, 0.0, 1.0), 4.0);
  float wrap = pow(clamp(dot(n, L), 0.0, 1.0), 1.5);
  float rim = pow(1.0 - ndv, 3.0) * (0.4 + 0.6 * clamp(dot(n, L) + 0.6, 0.0, 1.0)) * uRimGain;
  float mottle = 0.8 + 0.4 * n3(vW * 160.0) * n3(vW * 37.0 + 3.0);
  float cav = clamp(vCav, 0.0, 1.0);
  float occ = pow(1.0 - cav, 3.0);
  // a sickly cast: greyer in the hollows, a hint of green-yellow wax on the high planes
  vec3 skin = mix(uSkin * vec3(0.8, 0.85, 0.95), uSkin * vec3(1.05, 1.02, 0.85), key);
  vec3 col = skin * mottle * (0.035 + key * uKey) * occ + uRim * (wrap * 0.18 * occ + rim * 0.35) * (0.4 + 0.6 * occ);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function apparitionFaceMaterial(coat, { skin = 0x2c2a25, key = 0.8 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: FACE_VERT, fragmentShader: FACE_FRAG,
    uniforms: { uTime: coat.uniforms.uTime, uRim: coat.uniforms.uRim, uRimGain: coat.uniforms.uRimGain, uLightPos: coat.uniforms.uLightPos, uFillDir: coat.uniforms.uFillDir, uSkin: { value: new THREE.Color(skin) }, uKey: { value: key } },
    side: THREE.FrontSide, name: 'apparitionFace',
  });
}

export function apparitionMaterial(timeUniform, { core = 0x0a0403, rim = 0xff6a2a, fill = 0x0a0d16, opacity = 1.0, rimGain = 1.8, fray = 1.0, solid = 0, fade = 1 } = {}) {
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
      uFade: { value: fade },
      uFillDir: { value: new THREE.Vector3(0.2, 0.5, 1.0) },
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
function limb(points, radii, seg = 12, tubular = 28, folds = null) {
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
      const rr = folds ? r * folds(t, (j / seg) * Math.PI * 2) : r;
      p.setXYZ(id, c.x + v.x * rr, c.y + v.y * rr, c.z + v.z * rr);
    }
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A skull wearing a face (local: +z = face, +y = up), ~0.27 m chin to crown. Built from a dense sphere
 * displaced by anatomical landmarks: domed cranium, narrow temples, a heavy brow shelf over deep orbits,
 * blade-like cheekbones with hollows sunk beneath them, a long hooked nose, a lantern jaw and pointed chin,
 * and the grin: a mouth slit pulled far too wide, corners hooked up into the cheeks, lips drawn back thin,
 * nasolabial creases cut deep. Returns the geometry with an aCav attribute (0..1 cavity) for the shader,
 * plus the landmark positions (eyes, mouth curve) in the same local space.
 */
function headGeometry() {
  const R = 0.1;
  const g = new THREE.SphereGeometry(R, 110, 84);
  const p = g.attributes.position;
  const sm = THREE.MathUtils.smoothstep;
  const cav = new Float32Array(p.count);
  // grin centreline in unit coords: y as a function of x (corners hook upward)
  const grinY = (x) => -0.47 + 0.55 * x * x + 0.9 * Math.max(0, Math.abs(x) - 0.3) ** 2;
  const GRIN_W = 0.5;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) / R, y = p.getY(i) / R, z = p.getZ(i) / R;   // unit sphere
    const front = Math.max(0, z);
    const ax = Math.abs(x), sx = Math.sign(x) || 1;
    let c = 0;
    // long skull, narrow temples, high domed crown
    y *= 1.26;
    x *= 0.74 * (1 - 0.12 * Math.max(0, y - 0.35));
    z *= 0.95;
    // jaw: long, narrowing to a jutting pointed chin
    if (y < 0) {
      const k = -y / 1.26;
      x *= 1 - 0.46 * k * k;
      z *= 1 - 0.12 * k;
      z += front * 0.34 * k * k * gauss(x, 0.3);
      y -= 0.3 * k * k * gauss(x, 0.38) * (front > 0.15 ? 1 : 0.45);
    }
    // the jaw angle: a hard bony corner under the ear, the masseter wasted away in front of it
    x += sx * 0.06 * gauss(y + 0.62, 0.16) * gauss(z + 0.08, 0.32);
    x -= sx * 0.05 * gauss(y + 0.4, 0.14) * gauss(z - 0.3, 0.25);
    // occiput
    z -= 0.14 * Math.max(0, -z) * gauss(y - 0.25, 0.5);
    // brow shelf: a heavy overhang across the forehead, a furrow of a frown between the brows
    const brow = front * gauss(y - 0.36, 0.085) * gauss(x, 0.62);
    z += 0.24 * brow; y += 0.035 * brow;
    z -= 0.05 * front * gauss(y - 0.42, 0.05) * gauss(x, 0.05);
    c += 0.25 * front * gauss(y - 0.43, 0.04) * gauss(x, 0.06);
    // orbits: deep, round, set under the brow
    const orb = front * gauss(y - 0.17, 0.12) * gauss(ax - 0.31, 0.15);
    z -= 0.34 * orb; c += 1.1 * orb;
    // temples pinched in
    x -= sx * 0.09 * gauss(y - 0.3, 0.2) * gauss(z - 0.2, 0.32);
    c += 0.3 * gauss(y - 0.28, 0.16) * gauss(ax - 0.62, 0.12) * front;
    // cheekbones: sharp ridge under the orbit; the hollow sunk under it
    const cb = gauss(y + 0.02, 0.075) * gauss(z - 0.5, 0.3);
    x += sx * 0.1 * cb;
    z += 0.07 * front * gauss(y + 0.0, 0.08) * gauss(ax - 0.45, 0.13);
    const hollow = gauss(y + 0.26, 0.14) * gauss(z - 0.42, 0.3);
    x -= sx * 0.16 * hollow;
    c += 0.65 * hollow * gauss(ax - 0.45, 0.2);
    // hooked nose: bridge from the brow, a bony hump, a beak drooping over the grin
    const ny = y;
    const nw = 0.085 + 0.05 * sm(-ny, -0.1, 0.25);
    const nose = gauss(x, nw) * sm(front, 0.5, 0.85);
    let prof = 0;
    if (ny > 0.24) prof = 0.12 * gauss(ny - 0.24, 0.07);
    else if (ny > -0.2) prof = 0.12 + 0.8 * (0.24 - ny) + 0.16 * gauss(ny - 0.08, 0.07);
    else if (ny > -0.32) prof = (0.12 + 0.8 * 0.44) * (1 - (-0.2 - ny) / 0.12);
    z += nose * Math.min(prof, 0.56);
    y -= nose * 0.07 * sm(-ny, 0.05, 0.25);
    // nostril wings and the shadow under them
    x += sx * 0.035 * gauss(ny + 0.22, 0.05) * gauss(ax - 0.1, 0.06) * front;
    c += 0.5 * gauss(ny + 0.28, 0.035) * gauss(ax - 0.07, 0.05) * front;
    // nasolabial creases: deep cuts from the nostril wing down to the grin corners
    {
      const t = THREE.MathUtils.clamp((-y - 0.22) / 0.3, 0, 1);
      const lx = 0.15 + 0.3 * t;
      const crease = front * gauss(ax - lx, 0.035) * sm(-y, 0.18, 0.26) * (1 - sm(-y, 0.5, 0.6));
      z -= 0.07 * crease; c += 0.75 * crease;
      // the cheek bunches up above the crease (a smile that does not reach the eyes)
      z += 0.05 * front * gauss(ax - lx - 0.08, 0.06) * gauss(y + 0.3, 0.1);
    }
    // the grin: a slit following grinY, very wide, lips pulled back thin against the teeth
    {
      const gy = grinY(x);
      const inW = 1 - sm(ax, GRIN_W - 0.06, GRIN_W);
      const d = y - gy;
      const slit = front * gauss(d, 0.03) * inW;
      z -= 0.13 * slit; c += 1.0 * slit;
      // drawn lips: a thin ridge above and below the slit
      z += 0.025 * front * gauss(Math.abs(d) - 0.05, 0.02) * inW;
      // corner dimples
      const cr = front * gauss(ax - GRIN_W, 0.04) * gauss(y - grinY(GRIN_W), 0.05);
      z -= 0.06 * cr; c += 0.6 * cr;
    }
    // chin cleft and the hollow under the lower lip
    c += 0.3 * front * gauss(y + 0.66, 0.05) * gauss(x, 0.16);
    z -= 0.03 * front * gauss(y + 0.66, 0.05) * gauss(x, 0.16);
    // ears, set high and back, with a dark bowl
    const ear = gauss(y - 0.06, 0.17) * gauss(z + 0.08, 0.14);
    x += sx * 0.17 * ear;
    c += 0.3 * ear * gauss(z + 0.02, 0.05);
    p.setXYZ(i, x * R, y * R, z * R);
    cav[i] = Math.min(1, c);
  }
  g.computeVertexNormals();
  g.setAttribute('aCav', new THREE.BufferAttribute(cav, 1));
  // landmarks for the glows: find the deepest orbit point and sample the grin curve on the surface
  const pts = { eyes: [], grin: [] };
  const pos = g.attributes.position;
  for (const s2 of [-1, 1]) {
    let best = -1, bz = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / R, y = pos.getY(i) / R, z = pos.getZ(i) / R;
      if (Math.sign(x) !== s2 || z < 0.3) continue;
      const score = cav[i] - Math.abs(y - 0.2) * 2 - Math.abs(Math.abs(x) - 0.23) * 2;
      if (best < 0 || score > bz) { bz = score; best = i; }
    }
    pts.eyes.push(new THREE.Vector3(pos.getX(best), pos.getY(best), pos.getZ(best)));
  }
  for (let k = 0; k <= 16; k++) {
    const ux = -GRIN_W * 0.92 + (k / 16) * GRIN_W * 1.84;
    // surface z at (ux, grinY): scan vertices near it
    let bz = -1;
    const yy = grinY(ux);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / R, y = pos.getY(i) / R, z = pos.getZ(i) / R;
      if (z > 0 && Math.abs(x - ux) < 0.03 && Math.abs(y - yy) < 0.04) bz = Math.max(bz, z);
    }
    pts.grin.push(new THREE.Vector3(ux * R, yy * R, (bz > 0 ? bz - 0.06 : 0.5) * R));
  }
  g.userData.landmarks = pts;
  return g;
}

/** stovepipe hat (origin = brim plane centre): a crown flaring wider toward the top and slightly crushed,
 *  a ribbon band, a brim with a rolled, upturned lip that curls high at the sides and dips front and back */
function hatGeometry() {
  const prof = [
    [0.0, -0.002], [0.07, -0.004], [0.11, -0.003], [0.135, 0.0], [0.148, 0.006], [0.155, 0.015], [0.153, 0.022], [0.146, 0.02], [0.138, 0.012],
    [0.12, 0.006], [0.095, 0.006], [0.083, 0.01],
    // band (a proud ribbon), then the crown flaring out to the top
    [0.0845, 0.012], [0.0855, 0.016], [0.0858, 0.05], [0.0835, 0.054],
    [0.0835, 0.06], [0.086, 0.11], [0.09, 0.16], [0.095, 0.205], [0.097, 0.22], [0.094, 0.227], [0.08, 0.229], [0.0, 0.226],
  ];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), 72);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z0 = p.getZ(i);
    const z = z0 * 0.86;
    const r = Math.hypot(x, z0);
    const brim = THREE.MathUtils.smoothstep(r, 0.095, 0.15);
    const ang = Math.atan2(z0, x);
    let yy = y + brim * 0.034 * Math.cos(ang) ** 2 - brim * 0.01 * Math.sin(ang) ** 2;
    // a crush: the crown leans and dents on one side, the top caves a little
    const up = THREE.MathUtils.smoothstep(y, 0.06, 0.23);
    const dent = -0.008 * up * Math.exp(-((ang - 2.4) ** 2) / 0.25) - 0.004 * up * Math.exp(-((ang + 0.6) ** 2) / 0.4);
    const k = r > 1e-4 ? (r + dent * (1 - brim)) / r : 1;
    if (y > 0.224 && r < 0.085) yy -= 0.006 * (1 - r / 0.085);
    p.setXYZ(i, x * k + up * 0.012 * (y / 0.23), yy, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** a long-fingered hand. local: fingers along +z, palm faces +y. curl = [base, mid, tip] per finger (index..little). */
function handGroup(mat, { curl = [[0.35, 0.6, 0.6], [0.3, 0.55, 0.55], [0.35, 0.65, 0.6], [0.45, 0.75, 0.7]], spread = 0.12, thumb = 0.6, scale = 1 } = {}) {
  const h = new THREE.Group();
  // palm: a lofted slab, broad at the knuckles, narrowing to the wrist, the heel padded
  const palm = loft([
    { y: -0.004, a: 0.02, b: 0.013 },
    { y: 0.012, a: 0.027, b: 0.0125 },
    { y: 0.035, a: 0.034, b: 0.0115 },
    { y: 0.062, a: 0.038, b: 0.0105 },
    { y: 0.078, a: 0.036, b: 0.0095 },
  ], { seg: 28, capTop: true, capBottom: true });
  palm.rotateX(Math.PI / 2);          // loft axis y -> +z (fingers), ellipse b -> y (thickness)
  h.add(new THREE.Mesh(palm, mat));
  // fingers: three bones each, knuckle bulges at the joints, nails tapering to a point
  const lens = [[0.046, 0.032, 0.025], [0.052, 0.035, 0.027], [0.049, 0.033, 0.026], [0.038, 0.027, 0.021]];
  const rad = [0.0082, 0.0086, 0.0084, 0.0072];
  for (let f = 0; f < 4; f++) {
    const x0 = -0.026 + f * 0.0172;
    let p = V3(x0, 0.0005, 0.074 - Math.abs(f - 1.3) * 0.004);
    const dir = V3(Math.sin((f - 1.5) * spread), 0, Math.cos((f - 1.5) * spread));
    const pts = [p.clone()], radii = [rad[f] * 1.12];
    let pitch = 0;
    for (let s = 0; s < 3; s++) {
      pitch += curl[f][s];
      const d = V3(dir.x * Math.cos(pitch), Math.sin(pitch), dir.z * Math.cos(pitch));
      const mid = p.clone().addScaledVector(d, lens[f][s] * 0.5);
      p = p.clone().addScaledVector(d, lens[f][s]);
      pts.push(mid, p.clone());
      const r0 = rad[f] * (1 - 0.17 * s);
      radii.push(r0 * 0.82, s < 2 ? r0 * 0.98 : r0 * 0.5);          // shaft thins, the joint bulges
    }
    h.add(new THREE.Mesh(limb(pts, radii, 9, 30), mat));
  }
  // thumb: from the heel of the palm, two bones and a fat base
  const tp = [V3(-0.03, -0.004, 0.012), V3(-0.045, 0.0, 0.032), V3(-0.054, 0.006 + thumb * 0.012, 0.052), V3(-0.058, 0.012 + thumb * 0.022, 0.07), V3(-0.057, 0.018 + thumb * 0.03, 0.088)];
  h.add(new THREE.Mesh(limb(tp, [0.0135, 0.011, 0.0092, 0.0088, 0.005], 9, 24), mat));
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

/** wool sleeve: a fuller sleeve head, folds bunching on the inside of the elbow, stacked rings at the cuff */
function sleeveFolds(elbowT, seed) {
  return (t, a) => {
    const elbow = Math.exp(-((t - elbowT) ** 2) / 0.012);
    const inner = 0.5 + 0.5 * Math.cos(a - 1.2 - seed);   // folds concentrate on one side (inside of the bend)
    const zig = Math.sin(t * 62 + a * 2 + seed * 3) * 0.5 + Math.sin(t * 37 - a * 3 + seed) * 0.5;
    const cuff = THREE.MathUtils.smoothstep(t, 0.72, 0.95);
    const rings = Math.sin(t * 90 + seed) * cuff;
    const head = Math.exp(-(t * t) / 0.01) * 0.08;
    return 1 + 0.16 * elbow * inner * zig + 0.05 * rings + head + 0.025 * Math.sin(a * 5 + t * 20 + seed) * (1 - cuff * 0.5);
  };
}

export function buildApparition(mat, { shadowTex } = {}) {
  const g = new THREE.Group(); g.name = 'staufSilhouette';
  const parts = [];
  const add = (geo, parent = g, m2 = mat) => { const m = new THREE.Mesh(geo, m2); parent.add(m); parts.push(m); return m; };
  // interior detail (lapels, lining, collar, cravat) sits inside the silhouette: it takes only a trace of the
  // backlight, otherwise every lapel edge and seam would draw a bright line across the black
  const inner = mat.clone(); inner.name = 'apparitionInner';
  for (const k of ['uTime', 'uLightPos', 'uOpacity', 'uFray', 'uFade', 'uFillDir', 'uCore', 'uFill', 'uRim', 'uBaseY', 'uSolid']) inner.uniforms[k] = mat.uniforms[k];
  inner.uniforms.uRimGain = { value: 0.22 };
  g.userData.innerMat = inner;
  const addIn = (geo, parent = g) => add(geo, parent, inner);

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
  { const lin = skirt.clone(); lin.scale(0.965, 1, 0.955); addIn(lin); }

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
    addIn(lg);
  }
  // high standing collar behind the neck, open at the throat
  addIn(loft([
    { y: 1.47, a: 0.078, b: 0.07, z: -0.01, open: 0.55 },
    { y: 1.53, a: 0.07, b: 0.064, z: -0.012, open: 0.6 },
    { y: 1.575, a: 0.066, b: 0.06, z: -0.016, open: 0.75 },
  ], { seg: 40 }));
  // cravat knot at the throat
  addIn(new THREE.SphereGeometry(0.026, 14, 10).scale(1.2, 0.9, 0.7).translate(0, 1.49, 0.055));

  // ---------------------------------------------------------------- neck + head + hat
  add(limb([V3(0, 1.48, -0.012), V3(0, 1.56, 0.0), V3(0.004, 1.63, 0.018)], [0.046, 0.04, 0.038], 16, 12));
  const head = new THREE.Group();
  head.position.set(0.008, 1.715, 0.03);
  head.rotation.set(0.2, 0.32, 0.1, 'YXZ');   // chin down, turned toward the beckoning hand, the head cocked
  g.add(head);
  const faceMat = apparitionFaceMaterial(mat);
  g.userData.faceMat = faceMat;
  const hg = headGeometry();
  add(hg, head, faceMat);
  const LM = hg.userData.landmarks;
  const hat = new THREE.Group();
  hat.position.set(0.0, 0.07, -0.012);
  hat.rotation.set(-0.12, 0.0, 0.08);          // seated on the skull, tipped back and to one side
  head.add(hat);
  add(hatGeometry(), hat);
  // a pointed goatee jutting from the chin, and a thin moustache drooping past the grin
  add(limb([V3(0, -0.118, 0.045), V3(0, -0.14, 0.055), V3(0.002, -0.165, 0.06), V3(0.004, -0.19, 0.058)], [0.014, 0.011, 0.007, 0.0012], 10, 16), head);
  // lank hair hanging from under the hat brim to the collar, a few strands lifting in the draught
  for (let k = 0; k < 30; k++) {
    const a = Math.PI * (0.55 + (k / 29) * 0.9) + Math.sin(k * 7.3) * 0.05;          // round the back of the head
    const r0 = 0.072 + 0.004 * Math.sin(k * 3.1);
    const top = V3(Math.sin(a) * r0 * 0.76, 0.07 - 0.01 * Math.abs(Math.cos(a)), Math.cos(a) * r0 * 0.95);
    const len = 0.13 + 0.06 * Math.abs(Math.sin(k * 5.7));
    const o = V3(Math.sin(a), 0, Math.cos(a));
    const pts = [top, top.clone().add(V3(o.x * 0.014, -len * 0.35, o.z * 0.01)), top.clone().add(V3(o.x * 0.016, -len * 0.7, o.z * 0.006 + 0.004)), top.clone().add(V3(o.x * 0.014 + Math.sin(k) * 0.008, -len, o.z * 0.002 + 0.012))];
    add(limb(pts, [0.005, 0.004, 0.0028, 0.0007], 5, 12), head);
  }
  // teeth: a row of small, long, uneven teeth set just inside the grin, the furnace glow shining between them
  {
    const toothMat = new THREE.MeshStandardMaterial({ color: 0x6a604c, roughness: 0.5, emissive: new THREE.Color(0.35, 0.1, 0.03), emissiveIntensity: 0.6, name: 'staufTeeth' });
    const grin = LM.grin;
    for (let k = 4; k < grin.length - 5; k++) {
      const a = grin[k], b = grin[k + 1] || grin[k];
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.0038, 0.0085 + 0.002 * Math.sin(k * 2.7), 0.004), toothMat);
      t.position.copy(a).lerp(b, 0.5).add(V3(0, 0.0, 0.002));
      t.rotation.z = Math.atan2(b.y - a.y, b.x - a.x) + Math.sin(k * 4.1) * 0.12;
      head.add(t); parts.push(t);
    }
  }
  // the inner glow: embers in the deep sockets and a seam of furnace light through the grin. Additive sprites,
  // pulsing slowly (driven from index.js through userData.glow), so he reads from across the attic
  {
    const glowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      const rg = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.12, 'rgba(255,240,200,0.9)'); rg.addColorStop(0.35, 'rgba(255,150,60,0.28)'); rg.addColorStop(1, 'rgba(255,80,20,0)');
      x.fillStyle = rg; x.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const eyeCol = new THREE.Color(1.0, 0.42, 0.12);
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: eyeCol.clone().multiplyScalar(2.8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false, name: 'staufGlow' });
    const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.75, 0.4).multiplyScalar(5.0), toneMapped: false, name: 'staufEyes' });
    const glows = [];
    for (const e of LM.eyes) {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8).scale(1.3, 0.75, 0.6), coreMat);
      core.position.copy(e).add(V3(0, 0.002, 0.004)); head.add(core); parts.push(core);
      const sp = new THREE.Sprite(glowMat); sp.scale.setScalar(0.085); sp.position.copy(e).add(V3(0, 0.002, 0.012)); sp.renderOrder = 9; head.add(sp); glows.push(sp);
    }
    // the grin seam: a thin bright tube along the slit, behind the teeth
    const mouthMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.38, 0.1).multiplyScalar(2.6), toneMapped: false, name: 'staufMouth' });
    const seam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(LM.grin.map((q) => q.clone().add(V3(0, 0, -0.002)))), 40, 0.0028, 6, false), mouthMat);
    head.add(seam); parts.push(seam);
    const mGlowMat = glowMat.clone(); mGlowMat.color = eyeCol.clone().multiplyScalar(1.1);
    for (const k of [4, 8, 12]) { const sp = new THREE.Sprite(mGlowMat); sp.scale.set(0.07, 0.035, 1); sp.position.copy(LM.grin[k]).add(V3(0, 0, 0.012)); sp.renderOrder = 9; head.add(sp); glows.push(sp); }
    g.userData.glow = { mats: [glowMat, mGlowMat, coreMat, mouthMat], base: [glowMat.color.clone(), mGlowMat.color.clone(), coreMat.color.clone(), mouthMat.color.clone()], sprites: glows };
  }

  // a watch chain slung across the waistcoat and a row of jet buttons: small things that catch the light and
  // break up the black of the coat front
  {
    const metal = new THREE.MeshStandardMaterial({ color: 0x6a5434, metalness: 1, roughness: 0.32, name: 'staufChain' });
    const jet = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.2, roughness: 0.15, name: 'staufJet' });
    const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(V3(-0.07 + 0.15 * t, 1.12 - 0.045 * Math.sin(t * Math.PI), 0.13 + 0.012 * Math.sin(t * Math.PI))); }
    const ch = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0022, 5, false), metal); g.add(ch);
    const fob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.005, 16).rotateX(Math.PI / 2), metal); fob.position.set(0.085, 1.1, 0.132); g.add(fob);
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 8).scale(1, 1, 0.6), jet); b.position.set(0.0, 1.06 + k * 0.065, 0.134 + (k > 2 ? 0.004 : 0)); g.add(b); }
    for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8).scale(1, 1, 0.6), jet); b.position.set(sx * 0.105, 1.02 - k * 0.09, 0.142 - k * 0.006); g.add(b); }
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
  add(limb([shL, V3(-0.232, 1.27, -0.005), elL, V3(-0.262, 1.03, 0.1), wrL], [0.062, 0.055, 0.05, 0.047, 0.054], 18, 48, sleeveFolds(0.5, 1)));
  add(limb([wrL.clone().add(V3(0.004, 0.025, -0.02)), wrL.clone().add(V3(0, -0.008, 0.008))], [0.05, 0.054], 14, 4)); // cuff flare
  const knob = V3(-0.27, 0.865, 0.2);
  const handL = handGroup(mat, { curl: [[1.15, 1.2, 0.9], [1.1, 1.25, 0.9], [1.1, 1.2, 0.9], [1.05, 1.15, 0.9]], spread: 0.05, thumb: -0.2 });
  aim(handL, wrL.clone().add(V3(-0.004, -0.02, 0.02)), V3(0.05, -0.55, 0.65), V3(-1, 0.2, 0.1));
  g.add(handL); handL.traverse((o) => o.isMesh && parts.push(o));
  // cane: silver knob, ebony shaft that ends exactly on the floor with a ferrule
  const caneMat = mat.clone(); caneMat.name = 'apparitionCane';
  caneMat.uniforms.uTime = mat.uniforms.uTime; caneMat.uniforms.uLightPos = mat.uniforms.uLightPos; caneMat.uniforms.uRimGain = { value: 0.55 };
  add(new THREE.SphereGeometry(0.022, 14, 10).scale(1, 0.85, 1).translate(knob.x, knob.y + 0.012, knob.z));
  const foot = V3(-0.29, 0.0, 0.17);
  const cg = new THREE.CylinderGeometry(0.0085, 0.0095, knob.distanceTo(foot), 10).translate(0, -knob.distanceTo(foot) / 2, 0);
  const cane = new THREE.Mesh(cg, caneMat);
  cane.position.copy(knob);
  cane.quaternion.setFromUnitVectors(V3(0, -1, 0), foot.clone().sub(knob).normalize());
  g.add(cane); parts.push(cane);
  add(new THREE.CylinderGeometry(0.0095, 0.0085, 0.03, 10).translate(foot.x, 0.015, foot.z));

  // right (+x): elbow out, forearm raised, palm up, fingers curling toward himself
  const shR = V3(0.188, 1.4, -0.005), elR = V3(0.3, 1.17, 0.07), wrR = V3(0.33, 1.32, 0.31);
  add(limb([shR, V3(0.262, 1.28, -0.012), elR, V3(0.33, 1.2, 0.19), wrR], [0.062, 0.055, 0.05, 0.047, 0.052], 18, 48, sleeveFolds(0.5, 2)));
  add(limb([wrR.clone().add(V3(-0.004, -0.018, -0.03)), wrR.clone().add(V3(0.002, 0.004, 0.006))], [0.048, 0.052], 14, 4));
  const handR = handGroup(mat, { curl: [[0.25, 0.55, 0.5], [0.45, 0.8, 0.7], [0.6, 0.95, 0.8], [0.75, 1.1, 0.9]], spread: 0.16, thumb: 0.4, scale: 1.08 });
  aim(handR, wrR.clone().add(V3(0.004, 0.012, 0.012)), V3(0.08, 0.35, 0.95), V3(-0.15, 1, -0.2));
  g.add(handR); handR.traverse((o) => o.isMesh && parts.push(o));

  // ---------------------------------------------------------------- where the legs dissolve: a low pool of smoke, no hard contact
  if (shadowTex) {
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x050202, alphaMap: shadowTex, transparent: true, opacity: 0.55, depthWrite: false, name: 'staufSmoke' });
    for (let k = 0; k < 3; k++) {
      const cs = new THREE.Mesh(new THREE.PlaneGeometry(0.9 - k * 0.2, 0.7 - k * 0.15).rotateX(-Math.PI / 2), smokeMat);
      cs.position.set(-0.03 + k * 0.03, 0.006 + k * 0.05, 0.06 - k * 0.02); cs.rotation.y = k * 0.9; cs.renderOrder = 3; cs.userData.noShadow = true; cs.userData.noBake = true;
      g.add(cs);
    }
  }

  for (const o of parts) { o.userData.noBake = true; o.userData.noShadow = true; o.renderOrder = 7; o.frustumCulled = false; }
  g.userData.parts = parts;
  return g;
}
