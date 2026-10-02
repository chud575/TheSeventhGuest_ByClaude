// GLSL for the custom post stack.

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Screen-space god rays (radial light scattering, Mitchell GPU Gems 3 style)
// computed at reduced resolution from the bright parts of the HDR frame.
// ---------------------------------------------------------------------------
export const GODRAYS_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform vec2 uLightPos[4];
uniform vec3 uLightColor[4];
uniform float uLightStrength[4];
uniform int uLightCount;
uniform float uThreshold;
uniform float uDensity;
uniform float uDecay;
uniform float uWeight;
uniform float uAspect;
uniform float uJitter;
#ifndef SAMPLES
#define SAMPLES 48
#endif

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

vec3 brightSample(vec2 uv) {
  vec3 c = texture2D(tColor, clamp(uv, 0.001, 0.999)).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return c * smoothstep(uThreshold, uThreshold * 2.5 + 0.001, l);
}

void main() {
  vec3 acc = vec3(0.0);
  float dither = ign(gl_FragCoord.xy + uJitter * 17.0);
  for (int li = 0; li < 4; li++) {
    if (li >= uLightCount) break;
    vec2 lp = uLightPos[li];
    vec2 delta = (vUv - lp) * uDensity / float(SAMPLES);
    vec2 uv = vUv - delta * dither;
    float illum = 1.0;
    vec3 sum = vec3(0.0);
    for (int i = 0; i < SAMPLES; i++) {
      uv -= delta;
      sum += brightSample(uv) * illum;
      illum *= uDecay;
    }
    // fade as the source leaves the frame
    vec2 d = abs(lp - 0.5);
    float edge = 1.0 - smoothstep(0.55, 1.25, max(d.x, d.y));
    // radial falloff from source
    vec2 dd = (vUv - lp) * vec2(uAspect, 1.0);
    float fall = 1.0 / (1.0 + dot(dd, dd) * 2.5);
    acc += sum * uWeight / float(SAMPLES) * uLightColor[li] * uLightStrength[li] * edge * fall;
  }
  gl_FragColor = vec4(acc, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Grade: (optional DOF) + god-ray composite + exposure + filmic tonemap +
// split-tone colour grade + sRGB encode. Output is display-referred.
// ---------------------------------------------------------------------------
export const GRADE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tRays;
uniform sampler2D tDepth;
uniform float uRaysOn;
uniform vec2 uTexel;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uSplitBalance;
uniform float uSplitAmount;
uniform vec3 uLift;
uniform vec3 uGamma;
uniform vec3 uGain;
uniform float uToneMapping; // 0 = ACES fitted, 1 = AgX, 2 = AgX punchy, 3 = none
uniform float uBlackPoint;
uniform float uHighlightRolloff;
uniform float uCameraNear;
uniform float uCameraFar;
uniform float uDofOn;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxBlur;
uniform vec3 uFogColor;
uniform float uFogDensity;

// --- ACES fitted (Stephen Hill)
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 ACESFitted(vec3 color) {
  const mat3 ACESInputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(
    vec3( 1.60475, -0.10208, -0.00327),
    vec3(-0.53108,  1.10813, -0.07276),
    vec3(-0.07367, -0.00605,  1.07602));
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}

// --- AgX (Filament / Blender), with optional Punchy look
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
  vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
  vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
vec3 agxContrast(vec3 x) {
  vec3 x2 = x * x; vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 AgX(vec3 color, bool punchy) {
  const mat3 inset = mat3(
    vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 outset = mat3(
    vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const float minEv = -12.47393;
  const float maxEv = 4.026069;
  color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
  color = inset * color;
  color = max(color, 1e-10);
  color = log2(color);
  color = (color - minEv) / (maxEv - minEv);
  color = clamp(color, 0.0, 1.0);
  color = agxContrast(color);
  if (punchy) {
    float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = pow(max(color, 0.0), vec3(1.35));
    l = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = l + 1.4 * (color - l);
  }
  color = outset * color;
  color = pow(max(vec3(0.0), color), vec3(2.2));
  color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
  return clamp(color, 0.0, 1.0);
}

vec3 linearToSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float linearizeDepth(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear));
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 sampleDof(vec2 uv) {
  float d = linearizeDepth(texture2D(tDepth, uv).x);
  float coc = clamp(abs(d - uFocus) / max(d, 0.001) * uAperture, 0.0, 1.0) * uMaxBlur;
  vec3 base = texture2D(tColor, uv).rgb;
  if (coc < 0.5) return base;
  const float GOLDEN = 2.39996323;
  vec3 acc = base; float wsum = 1.0;
  for (int i = 0; i < 24; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / 24.0) * coc;
    float a = fi * GOLDEN;
    vec2 o = vec2(cos(a), sin(a)) * r * uTexel;
    vec3 s = texture2D(tColor, uv + o).rgb;
    float sd = linearizeDepth(texture2D(tDepth, uv + o).x);
    // reject sharp foreground bleeding onto blurred background a bit
    float w = mix(1.0, 0.3, step(sd + 0.05, d) * step(abs(sd - uFocus) / max(sd, 0.001) * uAperture * uMaxBlur, 0.5));
    // bokeh highlight weighting
    w *= 1.0 + 1.5 * smoothstep(1.0, 4.0, luma(s));
    acc += s * w; wsum += w;
  }
  return acc / wsum;
}

void main() {
  vec3 hdr = uDofOn > 0.5 ? sampleDof(vUv) : texture2D(tColor, vUv).rgb;
  if (uRaysOn > 0.5) hdr += texture2D(tRays, vUv).rgb;

  // depth haze (very subtle aerial perspective inside large rooms)
  if (uFogDensity > 0.0) {
    float dist = linearizeDepth(texture2D(tDepth, vUv).x);
    float f = 1.0 - exp(-dist * uFogDensity);
    hdr = mix(hdr, uFogColor, f * 0.85);
  }

  hdr *= uExposure;
  // gentle highlight compression before the curve keeps flames rich, not clipped
  hdr = hdr / (1.0 + max(luma(hdr) - 4.0, 0.0) * uHighlightRolloff * 0.05);

  vec3 c;
  if (uToneMapping < 0.5) c = ACESFitted(hdr * 0.85);
  else if (uToneMapping < 1.5) c = AgX(hdr, false);
  else if (uToneMapping < 2.5) c = AgX(hdr, true);
  else c = clamp(hdr, 0.0, 1.0);

  // ---- colour grade in linear display space
  float l = luma(c);
  // split toning: teal-blue shadows, warm highlights
  float hw = smoothstep(uSplitBalance - 0.25, uSplitBalance + 0.35, sqrt(l));
  vec3 tint = mix(uShadowTint, uHighlightTint, hw);
  c = mix(c, c * tint, uSplitAmount);
  // lift / gamma / gain (ASC-CDL-ish)
  c = c * uGain + uLift * (1.0 - c);
  c = pow(max(c, 0.0), 1.0 / max(uGamma, vec3(0.01)));
  // saturation
  l = luma(c);
  c = mix(vec3(l), c, uSaturation);
  // contrast around mid grey (in perceptual space)
  vec3 p = linearToSRGB(c);
  p = (p - 0.5) * uContrast + 0.5;
  p = (p - uBlackPoint) / (1.0 - uBlackPoint);
  gl_FragColor = vec4(clamp(p, 0.0, 1.0), 1.0);
}
`;

// ---------------------------------------------------------------------------
// Finish: chromatic aberration, vignette, film grain, dithering, fades and
// the ink-bleed dissolve used for room transitions.
// ---------------------------------------------------------------------------
export const FINISH_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tCapture;
uniform float uDissolve;
uniform float uDissolveSoft;
uniform float uFade;
uniform vec3 uFadeColor;
uniform float uTime;
uniform float uGrain;
uniform float uGrainSize;
uniform float uVignette;
uniform float uVignetteSoftness;
uniform float uCA;
uniform vec2 uResolution;
uniform float uFlash;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}

void main() {
  vec2 uv = vUv;
  vec2 cc = uv - 0.5;
  float r2 = dot(cc, cc);
  vec3 col;
  if (uCA > 0.0) {
    vec2 off = cc * r2 * uCA * 4.0;
    col.r = texture2D(tColor, uv - off).r;
    col.g = texture2D(tColor, uv).g;
    col.b = texture2D(tColor, uv + off * 1.6).b;
  } else {
    col = texture2D(tColor, uv).rgb;
  }

  // dissolve between the captured previous frame and the live frame
  if (uDissolve > 0.0) {
    vec3 prev = texture2D(tCapture, uv).rgb;
    float n = fbm(uv * vec2(uResolution.x / uResolution.y, 1.0) * 3.5);
    n = mix(n, 1.0 - length(cc) * 1.2, 0.35);
    float t = uDissolve * (1.0 + uDissolveSoft * 2.0) - uDissolveSoft;
    float m = smoothstep(t - uDissolveSoft, t + uDissolveSoft, n);
    col = mix(col, prev, m);
  }

  // vignette (elliptical, filmic)
  vec2 vc = cc * vec2(uResolution.x / uResolution.y * 0.82, 1.0);
  float v = smoothstep(0.85, 0.85 - uVignetteSoftness, length(vc) * (1.0 + uVignette * 0.6));
  col *= mix(1.0 - uVignette, 1.0, v);

  // film grain: luminance-weighted, stronger in mid-shadows
  if (uGrain > 0.0) {
    vec2 gp = gl_FragCoord.xy / uGrainSize;
    float t = floor(uTime * 24.0);
    float g = hash12(gp + t * 13.17) + hash12(gp * 1.37 + t * 7.31) - 1.0;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    float w = uGrain * (1.0 - smoothstep(0.15, 0.95, lum)) * (0.55 + 0.45 * smoothstep(0.0, 0.12, lum));
    col += g * w;
  }

  col = mix(col, uFadeColor, uFade);
  col += uFlash;

  // triangular dither to kill banding in the deep blues
  float d = hash12(gl_FragCoord.xy + fract(uTime) * 61.0) + hash12(gl_FragCoord.yx * 1.13 + 3.7) - 1.0;
  col += d / 255.0;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const COPY_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
void main() { gl_FragColor = texture2D(tColor, vUv); }
`;
