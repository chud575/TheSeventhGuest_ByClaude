// Shared GLSL library for procedural texture generation (TextureForge) and FX shaders.
// All *tileable* functions take a `per` (period, in lattice cells) so that
// f(uv * per, per) tiles seamlessly over uv in [0,1].

export const GLSL_COMMON = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }
float remap(float x, float a, float b, float c, float d) { return c + (x - a) * (d - c) / (b - a); }
float remapc(float x, float a, float b, float c, float d) { return clamp(remap(x, a, b, c, d), min(c, d), max(c, d)); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 srgb2lin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 rgb255(float r, float g, float b) { return vec3(r, g, b) / 255.0; }
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// ---- hashes (Dave Hoskins)
float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 hash32(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }

// ---- periodic value noise [0,1]
float vnoise(vec2 p, vec2 per) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(mod(i, per));
  float b = hash12(mod(i + vec2(1.0, 0.0), per));
  float c = hash12(mod(i + vec2(0.0, 1.0), per));
  float d = hash12(mod(i + vec2(1.0, 1.0), per));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// ---- periodic gradient noise [-1,1]
vec2 grad2(vec2 i) { float a = hash12(i) * TAU; return vec2(cos(a), sin(a)); }
float gnoise(vec2 p, vec2 per) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(grad2(mod(i, per)), f);
  float b = dot(grad2(mod(i + vec2(1.0, 0.0), per)), f - vec2(1.0, 0.0));
  float c = dot(grad2(mod(i + vec2(0.0, 1.0), per)), f - vec2(0.0, 1.0));
  float d = dot(grad2(mod(i + vec2(1.0, 1.0), per)), f - vec2(1.0, 1.0));
  return 1.4142 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// fbm of gradient noise, result roughly [-1,1]
float fbm(vec2 uv, vec2 per, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  vec2 p = uv * per;
  for (int i = 0; i < 10; i++) {
    if (i >= oct) break;
    s += a * gnoise(p, per);
    n += a;
    p = p * 2.0; per = per * 2.0;
    a *= 0.5;
  }
  return s / n;
}
float fbmv(vec2 uv, vec2 per, int oct) { // value-noise fbm [0,1]
  float s = 0.0, a = 0.5, n = 0.0;
  vec2 p = uv * per;
  for (int i = 0; i < 10; i++) {
    if (i >= oct) break;
    s += a * vnoise(p, per);
    n += a;
    p *= 2.0; per *= 2.0; a *= 0.5;
  }
  return s / n;
}
float ridged(vec2 uv, vec2 per, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  vec2 p = uv * per;
  for (int i = 0; i < 10; i++) {
    if (i >= oct) break;
    float r = 1.0 - abs(gnoise(p, per));
    s += a * r * r;
    n += a;
    p *= 2.0; per *= 2.0; a *= 0.5;
  }
  return s / n;
}
// ---- periodic voronoi: x=F1, y=F2, zw = cell id
vec4 voronoi(vec2 p, vec2 per, float jitter) {
  vec2 i = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0; vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 c = mod(i + g, per);
    vec2 o = hash22(c) * jitter;
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; id = c; } else if (d < f2) { f2 = d; }
  }
  return vec4(sqrt(f1), sqrt(f2), id);
}
// distance to voronoi edges (good for craquelure / cracks)
float voronoiEdge(vec2 p, vec2 per, float jitter) {
  vec2 i = floor(p), f = fract(p);
  vec2 mg, mr; float md = 8.0;
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = hash22(mod(i + g, per)) * jitter;
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int y = -2; y <= 2; y++)
  for (int x = -2; x <= 2; x++) {
    vec2 g = mg + vec2(float(x), float(y));
    vec2 o = hash22(mod(i + g, per)) * jitter;
    vec2 r = g + o - f;
    if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return md;
}

// ---- SDF helpers (2D)
float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdRoundBox(vec2 p, vec2 b, float r) { return sdBox(p, b - r) - r; }
float sdEllipse(vec2 p, vec2 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }
float sdSegment(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float sdVesica(vec2 p, float r, float d) { // pointed leaf shape, symmetric about y axis
  p = abs(p);
  float b = sqrt(r * r - d * d);
  return ((p.y - b) * d > p.x * b) ? length(p - vec2(0.0, b)) : length(p - vec2(-d, 0.0)) - r;
}
float sdArc(vec2 p, vec2 sc, float ra, float rb) { // sc = sin/cos of aperture
  p.x = abs(p.x);
  return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra)) - rb;
}
float sdRhombus(vec2 p, vec2 b) {
  p = abs(p);
  float ndot = b.x * (b.x - 2.0 * p.x) - b.y * (b.y - 2.0 * p.y);
  float h = clamp(ndot / dot(b, b), -1.0, 1.0);
  float d = length(p - 0.5 * b * vec2(1.0 - h, 1.0 + h));
  return d * sign(p.x * b.y + p.y * b.x - b.x * b.y);
}
float sdStar(vec2 p, float r, float n, float m) { // n points, m in [2,n]
  float an = PI / n, en = PI / m;
  vec2 acs = vec2(cos(an), sin(an)), ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
// polar repetition: returns p rotated into the first of n sectors
vec2 polarRep(vec2 p, float n) {
  float an = TAU / n;
  float a = atan(p.y, p.x) + an * 0.5;
  a = mod(a, an) - an * 0.5;
  return vec2(cos(a), sin(a)) * length(p);
}
// filled mask from sdf with screen-independent AA width w
float fill(float d, float w) { return 1.0 - smoothstep(-w, w, d); }
float stroke(float d, float t, float w) { return 1.0 - smoothstep(t - w, t + w, abs(d)); }
// soft raised profile from sdf (for height maps)
float bevel(float d, float width) { return saturate(-d / width); }
float domeh(float d, float width) { float x = saturate(-d / width); return sqrt(1.0 - (1.0 - x) * (1.0 - x)); }
`;
