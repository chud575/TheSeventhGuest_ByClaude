import * as THREE from 'three';
import { FX_NOISE } from './noise.glsl.js';

/**
 * Volumetric light shaft ("god ray" beam) through a window: a ray-marched
 * parallelepiped defined by a window rectangle (origin, halfU, halfV) extruded
 * along a light direction. Window mullions are carved out of the beam so the
 * pane pattern reads in the air (pair it with a SpotLight using
 * windowCookie() for the matching pattern on the floor).
 */

const SHAFT_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const SHAFT_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uOrigin;
uniform mat3 uInv;      // world -> beam space (u,v in [-1,1], t in [0,1])
uniform mat3 uM;        // beam -> world (linear part)
uniform vec3 uColor;
uniform float uIntensity;
uniform float uSoftness;
uniform float uFalloff;
uniform vec2 uPanes;    // mullion grid (cols, rows); 0 = none
uniform float uMullion; // mullion thickness (beam units)
uniform float uNoise;
uniform float uSteps;
varying vec3 vWorld;
${FX_NOISE}

float paneMask(vec2 uv) {
  if (uPanes.x < 0.5) return 1.0;
  vec2 g = (uv * 0.5 + 0.5) * uPanes;
  vec2 f = abs(fract(g) - 0.5);
  float m = smoothstep(0.5 - uMullion * uPanes.x * 0.5 - 0.02, 0.5 - uMullion * uPanes.x * 0.5 + 0.02, max(f.x, 0.0));
  float m2 = smoothstep(0.5 - uMullion * uPanes.y * 0.5 - 0.02, 0.5 - uMullion * uPanes.y * 0.5 + 0.02, max(f.y, 0.0));
  return (1.0 - m) * (1.0 - m2);
}

float density(vec3 b) {
  // b: beam coords
  vec2 e = 1.0 - smoothstep(1.0 - uSoftness, 1.0, abs(b.xy));
  float edge = e.x * e.y;
  // the beam widens/softens with distance from the window (penumbra)
  float pm = paneMask(b.xy * (1.0 + b.z * 0.05));
  pm = mix(pm, 1.0, smoothstep(0.2, 1.0, b.z) * 0.6);
  float fall = exp(-b.z * uFalloff) * smoothstep(0.0, 0.04, b.z) * (1.0 - smoothstep(0.85, 1.0, b.z));
  float n = fxFbm(vec3(b.xy * vec2(3.0, 3.0), b.z * 2.0) + vec3(0.0, uTime * 0.03, uTime * 0.05));
  float streak = fxNoise(vec3(b.xy * 9.0, uTime * 0.1));
  float nn = mix(1.0, (0.55 + 0.9 * n) * (0.85 + 0.3 * streak), uNoise);
  return edge * pm * fall * nn;
}

void main() {
  vec3 ro = uInv * (cameraPosition - uOrigin);
  vec3 rd = uInv * normalize(vWorld - cameraPosition);
  // slab intersection with box [-1,1]x[-1,1]x[0,1] in beam space
  vec3 bmin = vec3(-1.0, -1.0, 0.0), bmax = vec3(1.0, 1.0, 1.0);
  vec3 inv = 1.0 / rd;
  vec3 t0 = (bmin - ro) * inv, t1 = (bmax - ro) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), max(tmin.z, 0.0));
  float tf = min(min(tmax.x, tmax.y), tmax.z);
  if (tf <= tn) discard;
  // world-space length of the segment for energy conservation
  float steps = uSteps;
  float dt = (tf - tn) / steps;
  float jitter = fxHash12(gl_FragCoord.xy + fract(uTime) * 13.0);
  float acc = 0.0;
  for (int i = 0; i < 32; i++) {
    if (float(i) >= steps) break;
    vec3 b = ro + rd * (tn + (float(i) + jitter) * dt);
    acc += density(b);
  }
  // convert beam-space segment length to world metres
  float lenW = tf - tn; // rd is the image of a unit world vector, so t is in metres
  float v = acc / steps * lenW;
  gl_FragColor = vec4(uColor * v * uIntensity, 1.0);
}
`;

export class LightShaft extends THREE.Mesh {
  /**
   * @param {object} o
   * @param {THREE.Vector3} o.center  centre of the window opening (world)
   * @param {THREE.Vector3} o.right   half-extent vector across the window (world)
   * @param {THREE.Vector3} o.up      half-extent vector up the window (world)
   * @param {THREE.Vector3} o.direction light travel direction (normalised*length = beam length)
   */
  constructor({ center, right, up, direction, length = 6, color = 0x9db4ff, intensity = 0.25, softness = 0.25, falloff = 1.2, panes = [0, 0], mullion = 0.04, noise = 0.6, steps = 16, timeUniform } = {}) {
    const dir = direction.clone().normalize().multiplyScalar(length);
    const M = new THREE.Matrix3().set(
      right.x, up.x, dir.x,
      right.y, up.y, dir.y,
      right.z, up.z, dir.z,
    );
    const inv = M.clone().invert();
    // geometry: unit box in beam space mapped to world
    const g = new THREE.BoxGeometry(2, 2, 1);
    g.translate(0, 0, 0.5);
    const m4 = new THREE.Matrix4().set(
      right.x, up.x, dir.x, center.x,
      right.y, up.y, dir.y, center.y,
      right.z, up.z, dir.z, center.z,
      0, 0, 0, 1,
    );
    g.applyMatrix4(m4);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SHAFT_VERT,
      fragmentShader: SHAFT_FRAG,
      uniforms: {
        uTime: timeUniform || { value: 0 },
        uOrigin: { value: center.clone() },
        uInv: { value: inv },
        uM: { value: M },
        uColor: { value: new THREE.Color(color) },
        uIntensity: { value: intensity },
        uSoftness: { value: softness },
        uFalloff: { value: falloff },
        uPanes: { value: new THREE.Vector2(...panes) },
        uMullion: { value: mullion },
        uNoise: { value: noise },
        uSteps: { value: steps },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,     // works with the camera inside the beam too
      toneMapped: false,
    });
    super(g, mat);
    this.name = 'LightShaft';
    this.userData.noBake = true;
    this.renderOrder = 5;
    this.frustumCulled = true;
    this.castShadow = false;
    this.receiveShadow = false;
    this.userData.beam = { center: center.clone(), right: right.clone(), up: up.clone(), dir };
  }
  /** Is a world point inside the beam? returns 0..1 density-ish (for dust). */
  get beamUniforms() { return { origin: this.material.uniforms.uOrigin.value, inv: this.material.uniforms.uInv.value }; }
}

/**
 * Canvas "cookie" texture for a SpotLight.map: window panes with mullions,
 * slightly blurred, so the moonlight on the floor shows the window pattern.
 */
export function windowCookie({ cols = 2, rows = 3, mullion = 0.05, frame = 0.06, blur = 2, size = 256, arch = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  g.filter = `blur(${blur}px)`;
  const pad = size * 0.12;
  const w = size - pad * 2, h = size - pad * 2;
  g.fillStyle = '#fff';
  g.save();
  if (arch) {
    g.beginPath();
    g.moveTo(pad, pad + w / 2);
    g.arc(size / 2, pad + w / 2, w / 2, Math.PI, 0);
    g.lineTo(pad + w, pad + h); g.lineTo(pad, pad + h); g.closePath(); g.clip();
  }
  const f = frame * w, m = mullion * w;
  const cw = (w - 2 * f - (cols - 1) * m) / cols;
  const rh = (h - 2 * f - (rows - 1) * m) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    g.fillRect(pad + f + i * (cw + m), pad + f + j * (rh + m), cw, rh);
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
// Dust motes: soft points drifting in a box, brightest inside light shafts.
// ---------------------------------------------------------------------------
const DUST_VERT = /* glsl */ `
uniform float uTime;
uniform vec3 uBoxMin;
uniform vec3 uBoxSize;
uniform float uSize;
uniform float uPixelRatio;
uniform float uProjScale;
uniform vec3 uShaftOrigin[4];
uniform mat3 uShaftInv[4];
uniform int uShaftCount;
uniform float uAmbient;
attribute vec4 aSeed;
varying float vAlpha;
varying float vLit;
${FX_NOISE}
void main() {
  vec3 p = position;
  float t = uTime * (0.6 + aSeed.w * 0.6);
  vec3 drift = vec3(
    fxNoise(vec3(aSeed.xy * 10.0, t * 0.05)) - 0.5,
    (fxNoise(vec3(aSeed.yz * 10.0, t * 0.05 + 3.0)) - 0.5) - 0.12,
    fxNoise(vec3(aSeed.zx * 10.0, t * 0.05 + 7.0)) - 0.5) * 0.8;
  p += drift * t * 0.08;
  p += vec3(sin(t * 0.7 + aSeed.x * 6.28), sin(t * 0.5 + aSeed.y * 6.28), cos(t * 0.6 + aSeed.z * 6.28)) * 0.04;
  // wrap inside the box
  p = uBoxMin + mod(p - uBoxMin, uBoxSize);
  vec3 rel = (p - uBoxMin) / uBoxSize;
  vec3 edge = smoothstep(0.0, 0.08, rel) * smoothstep(1.0, 0.92, rel);
  float lit = uAmbient;
  for (int i = 0; i < 4; i++) {
    if (i >= uShaftCount) break;
    vec3 b = uShaftInv[i] * (p - uShaftOrigin[i]);
    vec2 e = 1.0 - smoothstep(0.75, 1.0, abs(b.xy));
    float inside = e.x * e.y * step(0.0, b.z) * (1.0 - smoothstep(0.8, 1.0, b.z));
    lit = max(lit, inside);
  }
  vLit = lit;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = uSize * (0.35 + aSeed.w * 0.9);
  gl_PointSize = max(1.0, size * uProjScale / -mv.z);
  // twinkle as motes tumble and catch the light
  float tw = 0.55 + 0.45 * sin(uTime * (1.0 + aSeed.x * 3.0) + aSeed.y * 40.0);
  vAlpha = edge.x * edge.y * edge.z * tw * smoothstep(0.15, 0.6, -mv.z);
}
`;
const DUST_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying float vAlpha;
varying float vLit;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  gl_FragColor = vec4(uColor * uIntensity * vLit * vAlpha * a, 1.0);
}
`;

export class DustMotes extends THREE.Points {
  constructor({ box, count = 1500, size = 0.012, color = 0xcfd8ff, intensity = 1.5, ambient = 0.06, shafts = [], random, timeUniform, pixelRatio = 1 } = {}) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    const rnd = random ? () => random.next() : Math.random;
    const min = box.min, sz = new THREE.Vector3().subVectors(box.max, box.min);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = min.x + rnd() * sz.x;
      pos[i * 3 + 1] = min.y + rnd() * sz.y;
      pos[i * 3 + 2] = min.z + rnd() * sz.z;
      seed[i * 4] = rnd(); seed[i * 4 + 1] = rnd(); seed[i * 4 + 2] = rnd(); seed[i * 4 + 3] = rnd();
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.boundingBox = box.clone();
    g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    const shaftOrigins = [0, 1, 2, 3].map(() => new THREE.Vector3());
    const shaftInv = [0, 1, 2, 3].map(() => new THREE.Matrix3());
    shafts.slice(0, 4).forEach((s, i) => { shaftOrigins[i].copy(s.beamUniforms.origin); shaftInv[i].copy(s.beamUniforms.inv); });
    const mat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      uniforms: {
        uTime: timeUniform || { value: 0 },
        uBoxMin: { value: box.min.clone() },
        uBoxSize: { value: sz },
        uSize: { value: size },
        uProjScale: { value: 800 },
        uPixelRatio: { value: pixelRatio },
        uShaftOrigin: { value: shaftOrigins },
        uShaftInv: { value: shaftInv },
        uShaftCount: { value: Math.min(4, shafts.length) },
        uAmbient: { value: shafts.length ? ambient : 1 },
        uColor: { value: new THREE.Color(color) },
        uIntensity: { value: intensity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    super(g, mat);
    this.name = 'DustMotes';
    this.renderOrder = 6;
    this.frustumCulled = false;
    this.userData.noBake = true;
    const _v = new THREE.Vector2();
    this.onBeforeRender = (renderer, scene, camera) => {
      // world-size points: pixels per metre at 1 m distance
      renderer.getDrawingBufferSize(_v);
      const rt = renderer.getRenderTarget();
      const h = rt ? rt.height : _v.y;
      mat.uniforms.uProjScale.value = (h * 0.5) / Math.tan(THREE.MathUtils.degToRad((camera.fov || 50) * 0.5));
    };
  }
}

// ---------------------------------------------------------------------------
// Fog volume: ray-marched box of drifting fbm mist, densest near the floor.
// ---------------------------------------------------------------------------
const FOG_VERT = SHAFT_VERT;
const FOG_FRAG = /* glsl */ `
uniform float uTime;
uniform mat4 uWorldToLocal;
uniform vec3 uColor;
uniform vec3 uLitColor;
uniform float uDensity;
uniform float uHeightFalloff;
uniform float uScale;
uniform float uSteps;
uniform vec3 uWind;
varying vec3 vWorld;
${FX_NOISE}
void main() {
  vec3 ro = (uWorldToLocal * vec4(cameraPosition, 1.0)).xyz;
  vec3 rd = normalize((uWorldToLocal * vec4(vWorld, 1.0)).xyz - ro);
  vec3 inv = 1.0 / rd;
  vec3 t0 = (vec3(-0.5) - ro) * inv, t1 = (vec3(0.5) - ro) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), max(tmin.z, 0.0));
  float tf = min(min(tmax.x, tmax.y), tmax.z);
  if (tf <= tn) discard;
  float dt = (tf - tn) / uSteps;
  float jitter = fxHash12(gl_FragCoord.xy + fract(uTime) * 7.0);
  float T = 1.0; vec3 L = vec3(0.0);
  for (int i = 0; i < 32; i++) {
    if (float(i) >= uSteps) break;
    vec3 p = ro + rd * (tn + (float(i) + jitter) * dt);
    vec3 e3 = smoothstep(vec3(0.5), vec3(0.32), abs(p));
    float edge = e3.x * e3.y * e3.z;
    float h = p.y + 0.5;
    float n = fxFbm(p * uScale + uWind * uTime);
    float d = max(n - 0.35, 0.0) * exp(-h * uHeightFalloff) * edge * uDensity;
    float a = 1.0 - exp(-d * dt * 8.0);
    vec3 c = mix(uColor, uLitColor, smoothstep(0.4, 0.9, n));
    L += T * a * c;
    T *= 1.0 - a;
  }
  gl_FragColor = vec4(L, 1.0 - T);
}
`;

export class FogVolume extends THREE.Mesh {
  /** box: THREE.Box3 in world space */
  constructor({ box, color = 0x1a2233, litColor = 0x4a5a7a, density = 1.0, heightFalloff = 3.0, scale = 1.5, steps = 12, wind = [0.05, 0.0, 0.02], timeUniform } = {}) {
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const g = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.ShaderMaterial({
      vertexShader: FOG_VERT,
      fragmentShader: FOG_FRAG,
      uniforms: {
        uTime: timeUniform || { value: 0 },
        uWorldToLocal: { value: new THREE.Matrix4() },
        uColor: { value: new THREE.Color(color) },
        uLitColor: { value: new THREE.Color(litColor) },
        uDensity: { value: density },
        uHeightFalloff: { value: heightFalloff },
        uScale: { value: scale },
        uSteps: { value: steps },
        uWind: { value: new THREE.Vector3(...wind) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      toneMapped: false,
    });
    super(g, mat);
    this.name = 'FogVolume';
    this.userData.noBake = true;
    this.position.copy(center);
    this.scale.copy(size);
    this.renderOrder = 4;
    this.onBeforeRender = () => {
      this.updateMatrixWorld();
      mat.uniforms.uWorldToLocal.value.copy(this.matrixWorld).invert();
    };
  }
}
