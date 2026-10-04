import * as THREE from 'three';

/**
 * Game-room FX, authored for this room:
 *  - ClippedShaft: a moonlight beam ray-marched like the engine shaft, but clipped
 *    against the floor / room box and shadowed analytically by box occluders (the
 *    games table), drawn front-face so geometry in front of it occludes it cleanly
 *    (no cut-out haloes where furniture sits inside the beam).
 *  - hazeCone: the tobacco haze hanging in each billiard shade's light cone.
 *  - fireFlames: crossed noise-distorted flame sheets (FBM, white->orange->red ramp).
 *  - sparks: a few embers rising from the grate.
 */

const NOISE = /* glsl */ `
float grHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float grNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(grHash(i + vec3(0,0,0)), grHash(i + vec3(1,0,0)), f.x), mix(grHash(i + vec3(0,1,0)), grHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(grHash(i + vec3(0,0,1)), grHash(i + vec3(1,0,1)), f.x), mix(grHash(i + vec3(0,1,1)), grHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float grFbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * grNoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float grHash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

// ----------------------------------------------------------------------------- moon shaft
const SHAFT_VERT = /* glsl */ `
varying vec3 vWorld;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SHAFT_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uOrigin; uniform mat3 uInv; uniform vec3 uDir;
uniform vec3 uColor; uniform float uIntensity; uniform float uSoftness; uniform float uFalloff;
uniform vec2 uPanes; uniform float uMullion; uniform float uNoise;
uniform vec3 uRoomMin; uniform vec3 uRoomMax; uniform float uSteps;
uniform vec4 uOcc[2];       // xyz = box centre top (x, topY, z), w = unused
uniform vec2 uOccHalf[2];   // half extents in x / z
uniform int uOccCount;
varying vec3 vWorld;
${NOISE}
float paneMask(vec2 uv) {
  vec2 g = (uv * 0.5 + 0.5) * uPanes;
  vec2 f = abs(fract(g) - 0.5);
  float m = smoothstep(0.5 - uMullion * uPanes.x * 0.5 - 0.03, 0.5 - uMullion * uPanes.x * 0.5 + 0.03, f.x);
  float m2 = smoothstep(0.5 - uMullion * uPanes.y * 0.5 - 0.03, 0.5 - uMullion * uPanes.y * 0.5 + 0.03, f.y);
  return (1.0 - m) * (1.0 - m2);
}
float occluded(vec3 w) {
  for (int i = 0; i < 2; i++) {
    if (i >= uOccCount) break;
    float top = uOcc[i].y;
    if (w.y > top) continue;
    // walk back toward the light to the plane of the occluder's top
    float s = (top - w.y) / max(-uDir.y, 1e-3);
    vec3 q = w - uDir * s;
    vec2 d = abs(q.xz - uOcc[i].xz) - uOccHalf[i];
    if (max(d.x, d.y) < 0.0) return 0.0;
  }
  return 1.0;
}
float density(vec3 b, vec3 w) {
  vec2 e = 1.0 - smoothstep(1.0 - uSoftness, 1.0, abs(b.xy));
  float pm = paneMask(b.xy * (1.0 + b.z * 0.04));
  pm = mix(pm, 1.0, smoothstep(0.3, 1.0, b.z) * 0.5);
  float fall = exp(-b.z * uFalloff) * smoothstep(0.0, 0.05, b.z) * (1.0 - smoothstep(0.8, 1.0, b.z));
  float n = grFbm(vec3(b.xy * 2.5, b.z * 2.0) + vec3(0.0, uTime * 0.03, uTime * 0.05));
  float nn = mix(1.0, 0.45 + 1.1 * n, uNoise);
  vec3 inR = step(uRoomMin, w) * step(w, uRoomMax);
  float soft = smoothstep(0.0, 0.25, w.y - uRoomMin.y);   // thins out toward the floor
  return e.x * e.y * pm * fall * nn * inR.x * inR.y * inR.z * soft * occluded(w);
}
void main() {
  vec3 ro = uInv * (cameraPosition - uOrigin);
  vec3 rdw = normalize(vWorld - cameraPosition);
  vec3 rd = uInv * rdw;
  vec3 inv = 1.0 / rd;
  vec3 t0 = (vec3(-1.0, -1.0, 0.0) - ro) * inv, t1 = (vec3(1.0) - ro) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), max(tmin.z, 0.0));
  float tf = min(min(tmax.x, tmax.y), tmax.z);
  if (tf <= tn) discard;
  float STEPS = uSteps;
  float dt = (tf - tn) / STEPS;
  float jitter = grHash12(gl_FragCoord.xy);
  float acc = 0.0;
  for (int i = 0; i < 24; i++) {
    if (float(i) >= STEPS) break;
    float t = tn + (float(i) + jitter) * dt;
    acc += density(ro + rd * t, cameraPosition + rdw * t);
  }
  float v = acc / STEPS * (tf - tn);
  gl_FragColor = vec4(uColor * v * uIntensity, 1.0);
}`;

export function clippedShaft({ center, right, up, direction, length = 4, color = 0x9fb6ff, intensity = 0.3, softness = 0.3, falloff = 1.0, panes = [2, 4], mullion = 0.03, noise = 0.7, roomMin, roomMax, occluders = [], time, steps = 20 }) {
  const dir = direction.clone().normalize().multiplyScalar(length);
  const M = new THREE.Matrix3().set(right.x, up.x, dir.x, right.y, up.y, dir.y, right.z, up.z, dir.z);
  const inv = M.clone().invert();
  const g = new THREE.BoxGeometry(2, 2, 1); g.translate(0, 0, 0.5);
  g.applyMatrix4(new THREE.Matrix4().set(right.x, up.x, dir.x, center.x, right.y, up.y, dir.y, center.y, right.z, up.z, dir.z, center.z, 0, 0, 0, 1));
  const occ = [0, 1].map((i) => occluders[i] ? new THREE.Vector4(occluders[i].x, occluders[i].top, occluders[i].z, 0) : new THREE.Vector4());
  const occH = [0, 1].map((i) => occluders[i] ? new THREE.Vector2(occluders[i].hx, occluders[i].hz) : new THREE.Vector2());
  const mat = new THREE.ShaderMaterial({
    vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG,
    uniforms: {
      uTime: time, uOrigin: { value: center.clone() }, uInv: { value: inv }, uDir: { value: direction.clone().normalize() },
      uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity }, uSoftness: { value: softness }, uFalloff: { value: falloff },
      uPanes: { value: new THREE.Vector2(...panes) }, uMullion: { value: mullion }, uNoise: { value: noise },
      uRoomMin: { value: roomMin.clone() }, uRoomMax: { value: roomMax.clone() },
      uOcc: { value: occ }, uOccHalf: { value: occH }, uOccCount: { value: Math.min(2, occluders.length) }, uSteps: { value: Math.max(4, Math.min(24, steps)) },
    },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, toneMapped: false,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'LightShaft';
  mesh.renderOrder = 5;
  mesh.userData.noBake = true; mesh.userData.keep = true; mesh.userData.noShadow = true;
  // pick the face set: front faces normally, back faces when the camera is inside the beam
  const tmp = new THREE.Vector3();
  mesh.onBeforeRender = (r, s, cam) => {
    tmp.copy(cam.position).sub(center).applyMatrix3(inv);
    const inside = Math.abs(tmp.x) < 1.02 && Math.abs(tmp.y) < 1.02 && tmp.z > -0.02 && tmp.z < 1.02;
    const side = inside ? THREE.BackSide : THREE.FrontSide;
    if (mat.side !== side) { mat.side = side; mat.needsUpdate = true; }
  };
  // the engine dust shader reads beam uniforms through this getter
  Object.defineProperty(mesh, 'beamUniforms', { get: () => ({ origin: mat.uniforms.uOrigin.value, inv: mat.uniforms.uInv.value }) });
  return mesh;
}

// ----------------------------------------------------------------------------- lamp haze cone
const HAZE_VERT = /* glsl */ `
varying vec3 vWorld; varying vec3 vN; varying float vH;
uniform float uHeight;
void main() {
  vH = -position.y / uHeight;                // 0 at the shade rim .. 1 at the cloth
  vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const HAZE_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uOpacity; uniform float uSeed;
varying vec3 vWorld; varying vec3 vN; varying float vH;
${NOISE}
void main() {
  vec3 v = normalize(cameraPosition - vWorld);
  float facing = abs(dot(normalize(vN), v));
  float thick = pow(facing, 1.6);             // thickest through the middle of the cone
  float n = grFbm(vec3(vWorld.x * 3.0 + uSeed, vWorld.y * 2.2 - uTime * 0.12, vWorld.z * 3.0 + uTime * 0.05));
  float wisps = smoothstep(0.35, 0.8, n);
  float fall = smoothstep(0.0, 0.08, vH) * (1.0 - smoothstep(0.55, 1.0, vH)) * (1.15 - vH * 0.6);
  float a = thick * fall * (0.15 + 1.4 * wisps) * uOpacity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

export function hazeCone({ top = 0.17, bottom = 0.55, height = 0.95, color = 0xffc890, opacity = 0.07, seed = 0, time }) {
  const g = new THREE.CylinderGeometry(top, bottom, height, 40, 8, true);
  g.translate(0, -height / 2, 0);
  const mat = new THREE.ShaderMaterial({
    vertexShader: HAZE_VERT, fragmentShader: HAZE_FRAG,
    uniforms: { uTime: time, uColor: { value: new THREE.Color(color).multiplyScalar(4) }, uOpacity: { value: opacity }, uHeight: { value: height }, uSeed: { value: seed } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  });
  const m = new THREE.Mesh(g, mat);
  m.name = 'LampHaze'; m.renderOrder = 6;
  m.userData.noBake = true; m.userData.keep = true; m.userData.noShadow = true;
  return m;
}

// ----------------------------------------------------------------------------- fire
const FLAME_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FLAME_FRAG = /* glsl */ `
uniform float uTime; uniform float uSeed; uniform float uIntensity; uniform float uLean; uniform float uBlue;
varying vec2 vUv;
${NOISE}
vec3 ramp(float h) {
  // h: heat 0..1  -> deep red, orange, yellow, white-hot
  vec3 c = mix(vec3(0.3, 0.025, 0.0), vec3(1.0, 0.22, 0.02), smoothstep(0.0, 0.35, h));
  c = mix(c, vec3(1.0, 0.58, 0.13), smoothstep(0.3, 0.65, h));
  c = mix(c, vec3(1.0, 0.9, 0.66), smoothstep(0.68, 1.0, h));
  return c;
}
void main() {
  vec2 p = vUv;
  float t = uTime * (0.85 + 0.3 * fract(uSeed * 0.731));
  // two-level domain warp, scrolling upward faster than the flame body
  vec3 q = vec3(p.x * 2.1, p.y * 1.5 - t * 1.25, uSeed + t * 0.18);
  vec2 warp = vec2(grFbm(q), grFbm(q + vec3(5.2, 1.3, 2.7))) - 0.5;
  vec2 pw = p + warp * vec2(0.42, 0.22) * (0.25 + p.y);
  float n = grFbm(vec3(pw.x * 4.2, pw.y * 3.2 - t * 2.3, uSeed * 1.7));
  float n2 = grFbm(vec3(pw.x * 9.0, pw.y * 6.0 - t * 3.4, uSeed * 2.9));
  float x = (pw.x - 0.5) * 2.0 - uLean * p.y * p.y;
  float prof = pow(max(1.0 - p.y, 0.0), 0.75);
  float body = 1.0 - smoothstep(prof * 0.4, prof * 0.95 + 0.04, abs(x));
  float heat = body * (1.25 - p.y * 1.05) * (0.45 + 0.75 * n + 0.2 * n2);
  // the upper tongues tear off into separate licks
  heat -= smoothstep(0.3, 1.0, p.y) * (1.0 - n) * 1.15;
  heat = clamp(heat, 0.0, 1.0) * smoothstep(0.0, 0.05, p.y);
  float a = smoothstep(0.05, 0.3, heat);
  vec3 c = ramp(heat) * a;
  // a narrow blue-violet band where the gas leaves the wood
  float blue = smoothstep(0.0, 0.025, p.y) * (1.0 - smoothstep(0.04, 0.11, p.y)) * smoothstep(0.2, 0.7, body) * (0.6 + 0.4 * n2);
  c = c * (1.0 - blue * 0.75) + vec3(0.22, 0.26, 1.0) * blue * uBlue;
  gl_FragColor = vec4(c * uIntensity, 1.0);
}`;

/**
 * A ragged fire: `count` overlapping flame sheets with randomised height (0.4-1.0x), lean, width, yaw and phase,
 * so the tongues cross and merge instead of standing in a row. Origin = base (the top of the logs).
 */
export function fireFlames({ width = 0.5, height = 0.42, count = 16, rnd, intensity = 3.2, time }) {
  const g = new THREE.Group(); g.name = 'fireFlames';
  const mats = [];
  for (let i = 0; i < count; i++) {
    // centre-weighted placement, tallest tongues near the middle of the grate
    const u = (rnd.next() + rnd.next()) / 2;
    const x = (u - 0.5) * width;
    const centre = 1 - Math.abs(u - 0.5) * 1.4;
    const h = height * (0.4 + 0.6 * rnd.next()) * (0.65 + 0.35 * centre);
    const w = width * (0.22 + 0.2 * rnd.next());
    const mat = new THREE.ShaderMaterial({
      vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG,
      uniforms: { uTime: time, uSeed: { value: i * 7.31 + rnd.next() * 10 }, uIntensity: { value: intensity * (0.45 + rnd.next() * 0.35) }, uLean: { value: (rnd.next() - 0.5) * 0.5 - x * 0.9 }, uBlue: { value: 0.5 + rnd.next() * 0.4 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    });
    mats.push(mat);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1).translate(0, h / 2, 0), mat);
    pl.rotation.y = (rnd.next() - 0.5) * 1.3;
    pl.rotation.z = (rnd.next() - 0.5) * 0.12;
    pl.position.set(x, (rnd.next() - 0.3) * 0.02, (rnd.next() - 0.5) * 0.1);
    pl.userData.noBake = true; pl.userData.noShadow = true; pl.renderOrder = 7;
    g.add(pl);
  }
  g.userData.keep = true; g.userData.noBake = true;
  g.userData.mats = mats;
  return g;
}

const SMOKE_FRAG = /* glsl */ `
uniform float uTime; uniform float uSeed; uniform float uOpacity;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = vUv;
  vec3 q = vec3(p.x * 2.0, p.y * 1.2 - uTime * 0.35, uSeed);
  vec2 warp = vec2(grFbm(q), grFbm(q + vec3(3.1, 7.7, 1.9))) - 0.5;
  float n = grFbm(vec3((p.x + warp.x * 0.5) * 3.0, (p.y + warp.y * 0.3) * 2.0 - uTime * 0.5, uSeed * 1.3));
  float x = abs(p.x - 0.5 - warp.x * 0.25 * p.y) * 2.0;
  float body = 1.0 - smoothstep(0.25 + 0.5 * p.y, 0.6 + 0.4 * p.y, x);
  float a = body * smoothstep(0.35, 0.75, n) * smoothstep(0.0, 0.25, p.y) * (1.0 - smoothstep(0.7, 1.0, p.y)) * uOpacity;
  gl_FragColor = vec4(vec3(0.018, 0.015, 0.013), a);
}`;

/** dark soot / smoke sheets rolling up off the flames into the flue (normal blending, darkens what is behind). */
export function smokeSheets({ width = 0.4, height = 0.5, count = 3, rnd, time, opacity = 0.55 }) {
  const g = new THREE.Group(); g.name = 'fireSmoke';
  for (let i = 0; i < count; i++) {
    const mat = new THREE.ShaderMaterial({ vertexShader: FLAME_VERT, fragmentShader: SMOKE_FRAG, uniforms: { uTime: time, uSeed: { value: 3.3 + i * 5.1 }, uOpacity: { value: opacity * (0.7 + 0.3 * rnd.next()) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(width * (0.8 + 0.3 * rnd.next()), height).translate(0, height / 2, 0), mat);
    pl.rotation.y = (rnd.next() - 0.5) * 0.8; pl.position.set((rnd.next() - 0.5) * width * 0.3, 0, -0.03 - i * 0.025);
    pl.userData.noBake = true; pl.userData.noShadow = true; pl.renderOrder = 6;
    g.add(pl);
  }
  g.userData.keep = true; g.userData.noBake = true;
  return g;
}

const SPARK_VERT = /* glsl */ `
uniform float uTime; uniform float uHeight;
attribute vec4 aSeed;
varying float vA;
void main() {
  float life = 1.6 + aSeed.w * 1.4;
  float ph = fract(uTime / life + aSeed.x);
  vec3 p = position;
  p.y += ph * uHeight * (0.6 + aSeed.y * 0.6);
  p.x += sin(ph * 9.0 + aSeed.z * 30.0) * 0.03 * ph;
  p.z += cos(ph * 7.0 + aSeed.y * 20.0) * 0.02 * ph;
  vA = (1.0 - ph) * smoothstep(0.0, 0.08, ph) * (0.5 + 0.5 * sin(uTime * 20.0 + aSeed.z * 50.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.5, 0.012 * 800.0 / -mv.z);
}`;
const SPARK_FRAG = /* glsl */ `
varying float vA;
void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(1.0, 0.55, 0.15) * 5.0 * a * a * vA, 1.0); }`;

export function sparks({ count = 26, width = 0.45, depth = 0.15, height = 0.7, rnd, time }) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    pos.set([(rnd.next() - 0.5) * width, rnd.next() * 0.05, (rnd.next() - 0.5) * depth], i * 3);
    seed.set([rnd.next(), rnd.next(), rnd.next(), rnd.next()], i * 4);
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({ vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, uniforms: { uTime: time, uHeight: { value: height } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.name = 'sparks'; p.userData.noBake = true; p.userData.keep = true; p.renderOrder = 8;
  return p;
}
