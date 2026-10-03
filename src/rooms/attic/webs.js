import * as THREE from 'three';

/**
 * Cobwebs and dust for the attic.
 *
 * Webs: old corner webs (spokes fanning from a joint, capture spiral sagging between
 * them, torn bays with dangling ends, gossamer haze and dust caught in the silk) on
 * sheared quads whose two edges run along the two timbers they are strung between,
 * plus single catenary strands drooping between rafters and walls. One additive
 * shader for both: almost invisible in the dark, they glint only where the moonbeam
 * crosses them, strongest when you look up the beam toward the window.
 *
 * Motes: soft round sprites of varied size that drift on a slow turbulent field and
 * are only visible inside the light volumes (moon cone, lamp, candle pools).
 */

const WEB_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vW;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const WEB_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uUseMap;
uniform vec3 uBO; uniform vec3 uBD; uniform float uBR;
uniform vec3 uBeamCol; uniform float uBeamK;
uniform vec3 uBase;
uniform float uOpacity;
uniform vec4 uWarm;   // xyz = warm light position, w = radius
uniform vec3 uWarmCol;
varying vec2 vUv;
varying vec3 vW;
void main() {
  float a = uUseMap > 0.5 ? texture2D(uMap, vUv).a : 1.0;
  if (a < 0.003) discard;
  vec3 d = vW - uBO; float t = dot(d, uBD); float r = length(d - uBD * t);
  float R = uBR * (1.0 + t * 0.04);
  float inBeam = (1.0 - smoothstep(R * 0.6, R * 1.12, r)) * smoothstep(-0.45, -0.05, t);
  vec3 V = normalize(cameraPosition - vW);
  // forward scatter: silk lights up when you look up the beam toward its source
  float fwd = 0.35 + 0.65 * pow(max(0.0, dot(V, -uBD)), 3.0);
  float warm = 1.0 - smoothstep(0.0, uWarm.w, length(vW - uWarm.xyz));
  vec3 col = uBase + uBeamCol * inBeam * fwd * uBeamK + uWarmCol * warm * warm;
  gl_FragColor = vec4(col * a * uOpacity, 1.0);
}`;

export function webMaterial({ map = null, beam, base = 0x1a1d24, beamColor = new THREE.Color(0.75, 0.85, 1.25), opacity = 0.35, beamK = { value: 1 }, warm = null }) {
  return new THREE.ShaderMaterial({
    vertexShader: WEB_VERT, fragmentShader: WEB_FRAG,
    uniforms: {
      uMap: { value: map }, uUseMap: { value: map ? 1 : 0 },
      uBO: { value: beam.origin }, uBD: { value: beam.dir }, uBR: { value: beam.radius },
      uBeamCol: { value: beamColor }, uBeamK: beamK,
      uBase: { value: new THREE.Color(base) }, uOpacity: { value: opacity },
      uWarm: { value: warm ? new THREE.Vector4(warm.pos.x, warm.pos.y, warm.pos.z, warm.radius) : new THREE.Vector4(0, -100, 0, 0.001) },
      uWarmCol: { value: warm ? new THREE.Color(warm.color) : new THREE.Color(0) },
    },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, name: 'cobweb',
  });
}

/** Corner web texture: anchored at the top-left corner, fanning into the quarter. Alpha only (white). */
export function cornerWebTexture(forge, seed = 1) {
  return forge.canvas(`attic:cornerweb${seed}`, 1024, 1024, (g, w, h) => {
    let s = seed * 15485863 % 2147483647 || 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const cx = 4, cy = 4;
    // gossamer haze thickest in the corner (old webs fill in with dust)
    const hz = g.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
    hz.addColorStop(0, 'rgba(255,255,255,0.22)'); hz.addColorStop(0.35, 'rgba(255,255,255,0.07)'); hz.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hz; g.beginPath(); g.moveTo(cx, cy); g.lineTo(w * 0.75, cy); g.quadraticCurveTo(w * 0.35, h * 0.35, cx, h * 0.75); g.closePath(); g.fill();
    // spokes: slightly irregular angles, gently bowed (gravity), different lengths
    const n = 9 + Math.floor(rnd() * 4);
    const spokes = [];
    for (let i = 0; i < n; i++) {
      const a = 0.04 + (i / (n - 1)) * (Math.PI / 2 - 0.08) + (rnd() - 0.5) * 0.06;
      const L = w * (0.75 + rnd() * 0.25) * (0.85 + 0.15 * Math.sin(a * 2));
      spokes.push({ a, L, bow: (rnd() - 0.3) * 0.06 });
    }
    const spokePt = (sp, r) => {
      const t = r / sp.L;
      const a = sp.a + sp.bow * Math.sin(t * Math.PI);
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r + t * t * 18];
    };
    for (const sp of spokes) {
      g.strokeStyle = `rgba(255,255,255,${0.55 + rnd() * 0.35})`; g.lineWidth = 1.5 + rnd() * 0.8;
      g.beginPath();
      for (let r = 0; r <= sp.L; r += 12) { const [x, y] = spokePt(sp, r); r ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    // a torn bay: capture threads missing between two spokes in a radial band
    const tearI = 2 + Math.floor(rnd() * (n - 5)), tearR0 = w * (0.25 + rnd() * 0.25), tearR1 = tearR0 + w * (0.15 + rnd() * 0.2);
    // capture spiral: catenaries between adjacent spokes, sagging away from the corner
    let r = 26;
    while (r < w * 0.95) {
      r += 11 + r * 0.035 + rnd() * 6;
      g.lineWidth = 0.8 + rnd() * 0.7;
      for (let i = 0; i < n - 1; i++) {
        const A = spokes[i], B = spokes[i + 1];
        if (r > A.L * 0.98 || r > B.L * 0.98) continue;
        const torn = i >= tearI && i <= tearI + 1 && r > tearR0 && r < tearR1;
        if (rnd() < 0.06) continue;
        const [x0, y0] = spokePt(A, r), [x1, y1] = spokePt(B, r * (0.97 + rnd() * 0.06));
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        const len = Math.hypot(x1 - x0, y1 - y0);
        const sag = len * (0.12 + rnd() * 0.12);
        g.strokeStyle = `rgba(255,255,255,${0.28 + rnd() * 0.4})`;
        g.beginPath();
        if (torn) {
          // broken thread: two ends dangling down
          if (rnd() < 0.6) { g.moveTo(x0, y0); g.quadraticCurveTo(x0 + 4, y0 + 20, x0 + (rnd() - 0.5) * 10, y0 + 30 + rnd() * 50); }
          if (rnd() < 0.5) { g.moveTo(x1, y1); g.quadraticCurveTo(x1 - 3, y1 + 18, x1 + (rnd() - 0.5) * 10, y1 + 25 + rnd() * 40); }
        } else {
          const ox = mx - cx, oy = my - cy, ol = Math.hypot(ox, oy) || 1;
          g.moveTo(x0, y0); g.quadraticCurveTo(mx + (ox / ol) * sag * 0.5, my + (oy / ol) * sag * 0.5 + sag * 0.6, x1, y1);
        }
        g.stroke();
      }
    }
    // dust clumps caught on the silk, more toward the corner
    for (let i = 0; i < 160; i++) {
      const a = rnd() * Math.PI / 2, rr = w * Math.pow(rnd(), 1.6) * 0.85;
      g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.45})`;
      g.beginPath(); g.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1 + rnd() * 3.5, 1 + rnd() * 2, rnd() * 3, 0, Math.PI * 2); g.fill();
    }
    // a few long sagging bridge lines across the mouth of the web
    for (let i = 0; i < 4; i++) {
      const x0 = w * (0.4 + rnd() * 0.55), y1 = h * (0.4 + rnd() * 0.55);
      g.strokeStyle = `rgba(255,255,255,${0.3 + rnd() * 0.3})`; g.lineWidth = 1 + rnd() * 0.6;
      g.beginPath(); g.moveTo(x0, cy); g.quadraticCurveTo(x0 * 0.55, y1 * 0.55 + 60, cx, y1); g.stroke();
    }
  }, { tile: false });
}

/**
 * A corner web on a sheared quad: `corner` = the joint, `a`/`b` = vectors along the two timbers
 * (their lengths set the web's reach). The texture's top-left corner maps onto the joint.
 */
export function cornerWeb(corner, a, b, mat) {
  const g = new THREE.BufferGeometry();
  const p0 = corner, p1 = corner.clone().add(a), p2 = corner.clone().add(a).add(b), p3 = corner.clone().add(b);
  g.setAttribute('position', new THREE.Float32BufferAttribute([...p0.toArray(), ...p1.toArray(), ...p2.toArray(), ...p3.toArray()], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 4; m.userData.noShadow = true; m.userData.noBake = true; m.frustumCulled = false;
  return m;
}

/** single silk strand hanging between two points with a catenary sag (sag in metres at mid-span) */
export function strand(p0, p1, sag, mat, radius = 0.0005) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const p = p0.clone().lerp(p1, t);
    p.y -= sag * (Math.cosh((t - 0.5) * 2.2) - Math.cosh(1.1)) / (1 - Math.cosh(1.1));
    pts.push(p);
  }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, radius, 3), mat);
  m.renderOrder = 4; m.userData.noShadow = true; m.userData.noBake = true;
  return m;
}

/** hanging strand: a loose end drooping from a point */
export function dangle(p0, len, mat, sway = 0.02, radius = 0.0005) {
  const pts = [p0.clone(), p0.clone().add(new THREE.Vector3(sway * 0.6, -len * 0.4, sway * 0.3)), p0.clone().add(new THREE.Vector3(-sway * 0.3, -len * 0.75, sway * 0.5)), p0.clone().add(new THREE.Vector3(sway * 0.4, -len, 0))];
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, radius, 3), mat);
  m.renderOrder = 4; m.userData.noShadow = true; m.userData.noBake = true;
  return m;
}

// ------------------------------------------------------------------------------------ dust motes
const MOTE_VERT = /* glsl */ `
uniform float uTime;
uniform float uPx;
uniform vec3 uBO; uniform vec3 uBD; uniform float uBR;
uniform vec4 uL0; uniform vec4 uL1; uniform vec4 uL2;
attribute float aSize;
attribute vec3 aSeed;
varying float vA;
varying vec3 vCol;
vec3 curl(vec3 p) {
  return vec3(sin(p.y * 1.7 + p.z * 0.9), sin(p.z * 1.3 + p.x * 1.1 + 1.7), sin(p.x * 1.5 + p.y * 0.7 + 3.1));
}
void main() {
  vec3 p = position;
  float t = uTime;
  // slow turbulent drift + a gentle settling
  p += curl(p * 0.9 + aSeed * 6.0 + t * 0.05) * 0.06;
  p += curl(p * 3.1 + aSeed * 11.0 - t * 0.11) * 0.015;
  p.y -= mod(t * 0.004 * (0.5 + aSeed.x), 0.2);
  vec3 d = p - uBO; float tt = dot(d, uBD); float r = length(d - uBD * tt);
  float R = uBR * (1.0 + tt * 0.04);
  float beam = (1.0 - smoothstep(R * 0.55, R * 1.05, r)) * smoothstep(0.0, 0.4, tt) * smoothstep(7.5, 4.0, tt);
  float l0 = 1.0 - smoothstep(0.0, uL0.w, length(p - uL0.xyz));
  float l1 = 1.0 - smoothstep(0.0, uL1.w, length(p - uL1.xyz));
  float l2 = 1.0 - smoothstep(0.0, uL2.w, length(p - uL2.xyz));
  vCol = vec3(0.62, 0.72, 1.0) * beam * 1.25 + vec3(1.0, 0.62, 0.3) * (l0 * l0 + l1 * l1 * 0.8 + l2 * l2 * 0.6) * 0.8;
  vA = clamp(beam + l0 * l0 + l1 * l1 + l2 * l2, 0.0, 1.0) * (0.55 + 0.45 * sin(t * (0.6 + aSeed.y) + aSeed.z * 30.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPx / -mv.z, 1.0, 9.0);
  if (vA < 0.01) gl_PointSize = 0.0;
}`;

const MOTE_FRAG = /* glsl */ `
varying float vA;
varying vec3 vCol;
uniform float uGain;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float f = exp(-dot(c, c) * 14.0);
  if (f * vA < 0.004) discard;
  gl_FragColor = vec4(vCol * f * vA * uGain, 1.0);
}`;

export function buildMotes({ box, count = 2400, seed = 3, time, beam, lights = [], gain = 1.0, px = 900 }) {
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const pos = new Float32Array(count * 3), size = new Float32Array(count), sd = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = box.min.x + rnd() * (box.max.x - box.min.x);
    pos[i * 3 + 1] = box.min.y + rnd() * (box.max.y - box.min.y);
    pos[i * 3 + 2] = box.min.z + rnd() * (box.max.z - box.min.z);
    const k = rnd();
    size[i] = 0.009 * (0.3 + 1.2 * k * k);
    sd[i * 3] = rnd(); sd[i * 3 + 1] = rnd(); sd[i * 3 + 2] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 3));
  const L = (i) => (lights[i] ? new THREE.Vector4(lights[i].pos.x, lights[i].pos.y, lights[i].pos.z, lights[i].radius) : new THREE.Vector4(0, -100, 0, 0.001));
  const mat = new THREE.ShaderMaterial({
    vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG,
    uniforms: { uTime: time, uPx: { value: px }, uGain: { value: gain }, uBO: { value: beam.origin }, uBD: { value: beam.dir }, uBR: { value: beam.radius }, uL0: { value: L(0) }, uL1: { value: L(1) }, uL2: { value: L(2) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, name: 'motes',
  });
  const pts = new THREE.Points(g, mat);
  pts.name = 'DustMotes'; pts.frustumCulled = false; pts.renderOrder = 8; pts.userData.noBake = true; pts.userData.noShadow = true;
  return pts;
}
