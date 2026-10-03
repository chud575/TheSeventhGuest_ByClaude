import * as THREE from 'three';
import { FX_NOISE } from '../../engine/fx/noise.glsl.js';

/**
 * Night sky: full moon with corona and 22-degree halo, two layers of wind-driven
 * cloud with silver moonlit edges, stars in the gaps, distant hills and tree
 * line, and lightning (a sheet flash inside the clouds plus a forked bolt).
 * Rendered first, at infinity, around whatever camera draws it (incl. env bakes).
 */

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + position * 10.0, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
}`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uMoonDir;
uniform float uMoonSize;
uniform float uMoonBright;
uniform float uFlash;
uniform vec3 uBoltDir;
uniform float uBolt;
uniform float uBoltSeed;
uniform float uBoltTop;
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform float uCloudCover;
uniform float uStars;
varying vec3 vDir;
${FX_NOISE}

float n2(vec2 p) { return fxNoise(vec3(p, 0.37)); }
float fbm2(vec2 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 7; i++) { if (i >= oct) break; s += a * n2(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(3.1, 1.7); a *= 0.5; }
  return s;
}
float hash2(vec2 p) { return fxHash12(p); }

// a forked lightning bolt in a 2D frame (x across, y down from cloud base): many short
// jagged segments with large lateral kinks, and forks that themselves kink.
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float boltDist(vec2 p, float seed, out float br) {
  float d = 1e3;
  br = 0.0;
  vec2 prev = vec2(0.0);
  float drift = (fxHash12(vec2(seed, 1.3)) - 0.5) * 0.01;
  for (int i = 1; i <= 52; i++) {
    float fi = float(i);
    vec2 cur = prev + vec2(drift + (fxHash12(vec2(fi, seed)) - 0.5) * 0.045, -0.016 - fxHash12(vec2(fi, seed + 5.0)) * 0.014);
    // the main channel tapers toward the ground
    d = min(d, segD(p, prev, cur) * (1.0 + fi * 0.015));
    if (fxHash12(vec2(fi * 3.1, seed)) > 0.7 && i < 44) {
      vec2 b0 = cur;
      float side = fxHash12(vec2(fi, seed + 7.0)) > 0.5 ? 1.0 : -1.0;
      int nk = 4 + int(fxHash12(vec2(fi, seed + 9.0)) * 8.0);
      for (int k = 1; k <= 12; k++) {
        if (k > nk) break;
        float fk = float(k);
        vec2 b1 = b0 + vec2(side * (0.008 + fxHash12(vec2(fi, fk + seed)) * 0.026), -0.01 - fxHash12(vec2(fk, fi + seed)) * 0.016);
        float bd = segD(p, b0, b1) * (2.2 + fk * 0.45);
        if (bd < d) { d = bd; br = 1.0; }
        if (k == 3) {
          vec2 c1 = b1 + vec2(-side * 0.012, -0.018);
          vec2 c2 = c1 + vec2(-side * 0.006 + (fxHash12(vec2(fk, seed + 2.0)) - 0.5) * 0.02, -0.016);
          d = min(d, min(segD(p, b1, c1), segD(p, c1, c2)) * 5.0);
        }
        b0 = b1;
      }
    }
    prev = cur;
  }
  return d;
}

void main() {
  vec3 d = normalize(vDir);
  float el = d.y;
  float az = atan(d.x, -d.z);
  // ---- base gradient: deep indigo zenith, misty blue-grey horizon, moon-side brighter
  float mo = max(dot(d, uMoonDir), 0.0);
  vec3 sky = mix(uHorizon, uZenith, pow(smoothstep(-0.05, 0.75, el), 0.7));
  sky += vec3(0.08, 0.11, 0.2) * pow(mo, 8.0) * 0.18;
  sky += vec3(0.25, 0.30, 0.42) * pow(mo, 40.0) * 0.6;

  // ---- stars
  vec2 sp = vec2(az * 180.0, el * 180.0);
  vec2 cell = floor(sp);
  float sh = hash2(cell);
  vec2 sc = fract(sp) - 0.5 - (vec2(hash2(cell + 1.3), hash2(cell + 2.7)) - 0.5) * 0.6;
  float star = step(0.985, sh) * smoothstep(0.12, 0.0, length(sc)) * (0.4 + 3.0 * pow(hash2(cell + 5.1), 6.0));
  star *= 0.7 + 0.3 * sin(uTime * (2.0 + sh * 5.0) + sh * 40.0);
  star *= smoothstep(0.03, 0.3, el) * (1.0 - pow(mo, 6.0)) * uStars;

  // ---- moon
  float md = acos(clamp(dot(d, uMoonDir), -1.0, 1.0));
  float disc = smoothstep(uMoonSize, uMoonSize * 0.96, md);
  vec3 mside = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
  vec3 mup = cross(mside, uMoonDir);
  vec2 mp = vec2(dot(d, mside), dot(d, mup)) / uMoonSize;   // -1..1 on the disc
  float maria = fbm2(mp * 1.6 + 4.0, 5);
  float craters = fbm2(mp * 6.0 + 1.0, 4);
  float limb = sqrt(max(0.0, 1.0 - dot(mp, mp)));
  vec3 moonC = vec3(1.0, 0.97, 0.9) * (0.62 + 0.38 * smoothstep(0.35, 0.65, maria)) * (0.85 + 0.15 * craters) * (0.55 + 0.45 * pow(limb, 0.5));
  vec3 moon = moonC * uMoonBright * disc;
  // corona + halo
  vec3 glow = vec3(0.55, 0.62, 0.8) * (exp(-md * 22.0) * 0.9 + exp(-md * 7.0) * 0.1);
  float halo = exp(-pow((md - 0.38) / 0.025, 2.0)) * 0.028;
  glow += vec3(0.6, 0.65, 0.8) * halo;

  // ---- clouds: projected on a dome, two layers drifting
  vec2 cp = d.xz / (el + 0.12);
  float t = uTime;
  vec2 w1 = vec2(t * 0.010, t * 0.004);
  float warp = fbm2(cp * 0.6 + w1 * 2.0, 4);
  float c1 = fbm2(cp * 0.75 + vec2(warp * 0.9, warp * 0.4) + w1, 7);
  float c2 = fbm2(cp * 2.6 + vec2(-t * 0.02, t * 0.006) + warp, 6);
  float c3 = fbm2(cp * 7.0 + vec2(-t * 0.03, 0.0) + warp * 2.0, 4);
  float cov = uCloudCover;
  float dens = smoothstep(0.6 - cov * 0.3, 0.72 - cov * 0.2, c1 + (c2 - 0.5) * 0.4 + (c3 - 0.5) * 0.12);
  float wisp = smoothstep(0.5, 0.8, c2) * (1.0 - dens) * 0.45;
  dens = clamp(dens + wisp, 0.0, 1.0);
  dens *= smoothstep(-0.02, 0.12, el);
  // a ragged clearing around the moon so the disc reads
  float clear = smoothstep(0.03, 0.2, md + (c2 - 0.5) * 0.16);
  dens *= mix(0.2, 1.0, clear);
  // a ragged veil drifting across the lower limb of the disc
  float veil = smoothstep(0.45, 0.75, fbm2(cp * 9.0 + vec2(t * 0.05, 0.0), 4)) * smoothstep(0.5, -0.4, mp.y + mp.x * 0.3);
  dens = max(dens, veil * disc * 0.35);
  // low dark scud bank along the horizon
  float scud = smoothstep(0.22, 0.02, el) * smoothstep(0.45, 0.7, fbm2(vec2(az * 4.0 + t * 0.01, el * 9.0), 5));
  dens = max(dens, scud * 0.9);
  // lighting: thin parts near the moon glow silver; thick parts are dark slate
  float thin = 1.0 - smoothstep(0.2, 1.0, dens);
  vec3 cloudDark = vec3(0.017, 0.021, 0.044) + uHorizon * 0.35;
  vec3 cloudLit = vec3(0.55, 0.64, 0.9) * (pow(mo, 90.0) * 1.25 + pow(mo, 14.0) * 0.2 + pow(mo, 3.0) * 0.06 + 0.035);
  float edge = smoothstep(0.0, 0.35, dens) * (1.0 - smoothstep(0.35, 0.9, dens));
  vec3 cloudCol = cloudDark + cloudLit * (thin * 0.45 + edge * 1.8);
  // lightning lights the cloud bellies
  float fl = uFlash * (0.2 + 0.8 * exp(-acos(clamp(dot(d, uBoltDir), -1.0, 1.0)) * 3.0));
  // a strike floods the whole cloud deck white-lilac: the house becomes a black cut-out
  cloudCol += vec3(0.78, 0.76, 1.0) * fl * (0.5 + dens * 1.3);
  sky += vec3(0.55, 0.54, 0.78) * fl * 0.8;

  vec3 col = sky + vec3(star) + glow;
  col += moon;
  // clouds occlude moon & stars partially (moon shows through thin veils)
  float occl = dens * (1.0 - disc * 0.35);
  col = mix(col, cloudCol + moon * 0.25 * (1.0 - dens), occl);

  // ---- lightning bolt
  if (uBolt > 0.001) {
    vec3 bs = normalize(cross(uBoltDir, vec3(0.0, 1.0, 0.0)));
    vec3 bu = cross(bs, uBoltDir);
    vec2 bp = vec2(dot(d, bs), dot(d, bu) - uBoltTop) * 1.2;
    if (bp.y < 0.02 && bp.y > -1.2 && dot(d, uBoltDir) > 0.0) {
      float brn;
      float bd = boltDist(bp, uBoltSeed, brn);
      float core = exp(-bd * 2600.0) * 16.0 + exp(-bd * 500.0) * 1.4 + exp(-bd * 60.0) * 0.18;
      col += vec3(0.75, 0.82, 1.0) * core * uBolt;
    }
  }

  // ---- distant hills and tree line (below ~4 degrees), fogged
  float hill = 0.035 + 0.035 * fbm2(vec2(az * 3.0, 0.0), 5) + 0.02 * fbm2(vec2(az * 11.0, 2.0), 3);
  float trees = hill + 0.012 * smoothstep(0.45, 0.75, fbm2(vec2(az * 60.0, 1.0), 3)) + 0.006 * fbm2(vec2(az * 240.0, 3.0), 2);
  vec3 hillC = uHorizon * 0.55 + vec3(0.02, 0.025, 0.04) * pow(mo, 2.0);
  col = mix(col, hillC, smoothstep(trees + 0.002, trees - 0.002, el));
  // below the horizon: dark misty ground
  col = mix(col, uHorizon * 0.4, smoothstep(0.0, -0.05, el));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky({ timeUniform, moonDir }) {
  const uniforms = {
    uTime: timeUniform,
    uMoonDir: { value: moonDir.clone().normalize() },
    uMoonSize: { value: 0.024 },
    uMoonBright: { value: 1.15 },
    uFlash: { value: 0 },
    uBoltDir: { value: new THREE.Vector3(-0.2, 0.06, -0.98).normalize() },
    uBolt: { value: 0 },
    uBoltSeed: { value: 3 },
    uBoltTop: { value: 0.66 },
    uHorizon: { value: new THREE.Color(0.009, 0.014, 0.034) },
    uZenith: { value: new THREE.Color(0.0035, 0.005, 0.016) },
    uCloudCover: { value: 0.86 },
    uStars: { value: 1.0 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms,
    side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), mat);
  mesh.name = 'Sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.castShadow = false; mesh.receiveShadow = false;
  return { mesh, uniforms };
}
