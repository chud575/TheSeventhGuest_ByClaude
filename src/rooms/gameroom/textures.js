/**
 * Game-room procedural textures (authored for this room): billiard baize, the
 * inlaid marquetry chessboard, trophy fur, the moonlit sky beyond the windows,
 * and canvas atlases for the billiard balls and the playing cards.
 */
import * as THREE from 'three';

/** Worsted billiard cloth: fine directional nap, faint chalk smudges and wear. Tiles (1 tile = 0.5 m). */
export function baizeTexture(forge, { color = [0.03, 0.2, 0.1] } = {}) {
  return forge.generate('gameroom:baize', {
    size: 1024, normalStrength: 0.6,
    uniforms: { uColor: color },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float fine = vnoise(uv * vec2(900.0, 900.0), vec2(900.0));
  float nap = vnoise(vec2(uv.x * 1400.0, uv.y * 160.0), vec2(1400.0, 160.0));
  float mot = fbmv(uv, vec2(5.0), 4);
  float chalk = smoothstep(0.62, 0.8, fbmv(uv + 0.37, vec2(3.0), 5)) * 0.35;
  vec3 c = uColor * (0.82 + 0.22 * mot) * (0.9 + 0.12 * nap + 0.06 * fine);
  c = mix(c, vec3(0.32, 0.42, 0.52), chalk * 0.35);
  s.albedo = c;
  s.height = 0.5 + 0.18 * nap + 0.1 * fine;
  s.rough = 0.93;
  s.metal = 0.0;
  s.ao = 0.92 + 0.08 * fine;
}`,
  });
}

/** Inlaid chessboard: straight-grained rippled maple + rosewood squares (each square's grain turned 0 or 90 degrees,
 * slight tint variance), bevelled seams, boxwood/ebony stringing, a dentil band and burr-walnut crossbanding.
 * uv 0..1 over the whole top. Albedo: sRGB. */
export function chessboardTexture(forge, { inner = 0.76 } = {}) {
  return forge.generate('gameroom:chessboard2', {
    size: 2048, tile: false, normalStrength: 2.2,
    uniforms: { uInner: inner },
    glsl: /* glsl */ `
// straight fine grain: g along 'u' (length), varying across 'v'
vec3 straightGrain(vec2 p, vec3 lite, vec3 dark, float seed, float lines) {
  float warp = fbm(vec2(p.x * 0.6, p.y * 0.08) + seed, vec2(64.0), 3) * 0.6;
  float v = p.x + warp * 0.08;
  float l1 = vnoise(vec2(v * lines, p.y * 1.5 + seed), vec2(4096.0));
  float l2 = vnoise(vec2(v * lines * 2.7, p.y * 3.0 + seed * 2.0), vec2(4096.0));
  float pores = vnoise(vec2(v * lines * 9.0, p.y * 60.0 + seed), vec2(4096.0));
  float band = 0.5 + 0.5 * sin((v * lines * 0.18 + seed) * 6.2831);
  float g = l1 * 0.55 + l2 * 0.25 + band * 0.2;
  g = smoothstep(0.25, 0.85, g);
  vec3 c = mix(lite, dark, g * 0.8);
  c *= 0.94 + 0.08 * pores;
  return c;
}
vec3 burl(vec2 p) {
  float w = fbm(p, vec2(6.0), 5);
  vec4 v = voronoi(p * 38.0 + w * 3.0, vec2(4096.0), 1.0);
  float eyes = smoothstep(0.12, 0.0, v.x);
  float sw = 0.5 + 0.5 * sin(w * 22.0 + v.x * 18.0);
  vec3 c = mix(vec3(0.24, 0.11, 0.045), vec3(0.42, 0.22, 0.09), sw * 0.6);
  return mix(c, vec3(0.12, 0.05, 0.02), eyes * 0.5);
}
void surface(vec2 uv, inout Surface s) {
  float b = (1.0 - uInner) * 0.5;
  vec2 q = (uv - b) / uInner;               // 0..1 over the 8x8 field
  vec3 col; float h = 0.6; float rough = 0.35;
  vec2 d2 = abs(uv - 0.5);
  float edge = max(d2.x, d2.y);
  float fieldEdge = uInner * 0.5;
  if (edge < fieldEdge) {
    vec2 id = floor(q * 8.0);
    vec2 f = fract(q * 8.0);
    bool light = mod(id.x + id.y, 2.0) > 0.5;
    vec3 rh = hash32(id + 3.7);
    float seed = rh.x * 40.0;
    vec2 p = rh.y > 0.5 ? f : f.yx;          // grain turned 0 or 90 per square
    if (light) col = straightGrain(p, vec3(0.86, 0.72, 0.5), vec3(0.7, 0.53, 0.32), seed, 70.0);
    else col = straightGrain(p, vec3(0.25, 0.1, 0.055), vec3(0.11, 0.04, 0.02), seed, 55.0);
    col *= 0.93 + 0.14 * rh.z;              // per-square tint variance
    // bevelled edge (~1.5 mm) + a dark glue line
    float ge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    float bev = smoothstep(0.0, 0.03, ge);
    h = 0.45 + 0.15 * sqrt(bev);
    col *= mix(0.55, 1.0, smoothstep(0.0, 0.012, ge));
    rough = 0.5;
  } else {
    float t = (edge - fieldEdge) / (0.5 - fieldEdge);
    vec2 along = d2.x > d2.y ? vec2(uv.y, edge) : vec2(uv.x, edge);
    if (t < 0.06) { col = vec3(0.88, 0.76, 0.52); }
    else if (t < 0.1) { col = vec3(0.02, 0.012, 0.01); }
    else if (t < 0.34) {
      float k = floor(along.x * 64.0);
      bool a = mod(k, 2.0) < 0.5;
      col = a ? vec3(0.84, 0.68, 0.42) : vec3(0.08, 0.03, 0.02);
      col *= 0.88 + 0.12 * vnoise(vec2(along.x * 900.0, t * 30.0), vec2(4096.0));
      float sm = abs(fract(along.x * 64.0) - 0.5);
      h = 0.6 - smoothstep(0.46, 0.5, sm) * 0.12;
    }
    else if (t < 0.38) { col = vec3(0.02, 0.012, 0.01); }
    else if (t < 0.42) { col = vec3(0.88, 0.76, 0.52); }
    else {
      col = burl(uv * 1.3);
      float cb = 0.5 + 0.5 * sin((t * 50.0 + fbm(along, vec2(20.0, 4.0), 3) * 3.0) * 3.14159);
      col *= 0.85 + 0.2 * cb;
      if (t > 0.94) { col *= 0.75; }
    }
    float seamB = min(abs(t - 0.06), min(abs(t - 0.1), min(abs(t - 0.34), min(abs(t - 0.38), abs(t - 0.42)))));
    h -= (1.0 - smoothstep(0.0, 0.004, seamB)) * 0.08;
    // the field sits a hair lower than the banding
    if (t < 0.02) h -= (0.02 - t) * 3.0;
  }
  float wear = fbmv(uv, vec2(4.0), 4);
  col *= 0.94 + 0.1 * wear;
  float ring = abs(length(uv - vec2(0.86, 0.12)) - 0.055);
  col *= 1.0 - 0.15 * smoothstep(0.006, 0.0, ring) * (0.5 + 0.5 * vnoise(uv * 300.0, vec2(4096.0)));
  s.albedo = col;
  s.height = h;
  s.rough = rough + 0.15 * wear;
  s.metal = 0.0;
  s.ao = 1.0;
}`,
  });
}

/** Polished Belgian black marble: near-black ground, sparse thin grey-gold veins drifting one way. Tiles (1 tile ~ 0.6 m). */
export function marbleNeroTexture(forge) {
  return forge.generate('gameroom:nero', {
    size: 1024, normalStrength: 0.25,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  float w = fbm(p * vec2(1.0, 1.0), vec2(3.0), 5);
  float w2 = fbm(p + 4.1, vec2(5.0), 4);
  // veins: iso-lines of a warped field stretched along one direction
  float f1 = fbm(vec2(p.x * 1.0 + w * 0.35, p.y * 0.35 + w2 * 0.2), vec2(3.0, 1.0), 5);
  float v1 = 1.0 - smoothstep(0.0, 0.012, abs(f1 - 0.05));
  float f2 = fbm(vec2(p.x * 2.0 + w2 * 0.4 + 0.3, p.y * 0.7 + w * 0.3), vec2(6.0, 2.0), 5);
  float v2 = (1.0 - smoothstep(0.0, 0.006, abs(f2 + 0.1))) * smoothstep(0.2, 0.6, fbmv(p + 2.0, vec2(4.0), 3));
  float hair = (1.0 - smoothstep(0.0, 0.003, abs(fbm(p * 1.3 + 9.0, vec2(8.0), 5)))) * 0.5;
  float cloud = fbmv(p * 1.0 + 7.0, vec2(6.0), 5);
  vec3 base = vec3(0.047, 0.043, 0.05) * (0.85 + 0.35 * cloud);
  vec3 vein = vec3(0.54, 0.5, 0.42);
  float v = max(max(v1 * 0.75, v2 * 0.55), hair * 0.35);
  v *= 0.6 + 0.4 * vnoise(p * 40.0, vec2(40.0));
  vec3 col = mix(base, vein, v * 0.8);
  s.albedo = col;
  s.height = 0.5 - v * 0.03;
  s.rough = 0.12 + 0.12 * v + 0.05 * cloud;
  s.metal = 0.0;
  s.ao = 1.0;
}`,
  });
}

/** Charred log bark (albedo) with deep fissures; the second texture's albedo is the ember-glow mask for those fissures. */
export function logTextures(forge) {
  const glslCommon = /* glsl */ `
float fiss(vec2 uv) {
  float w = fbm(uv, vec2(2.0, 1.0), 4);
  float e = voronoiEdge(vec2(uv.x * 6.0 + w * 1.5, uv.y * 5.0), vec2(6.0, 5.0), 1.0);
  return 1.0 - smoothstep(0.0, 0.09, e);
}`;
  const bark = forge.generate('gameroom:logbark', {
    size: 512, normalStrength: 2.5,
    glsl: glslCommon + /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float f = fiss(uv);
  float n = fbmv(uv * vec2(1.0, 0.5), vec2(24.0, 6.0), 4);
  vec3 c = mix(vec3(0.07, 0.05, 0.04), vec3(0.16, 0.11, 0.08), n);
  c = mix(c, vec3(0.02, 0.015, 0.012), f);
  float ash = smoothstep(0.62, 0.8, fbmv(uv + 0.3, vec2(8.0, 4.0), 4));
  c = mix(c, vec3(0.36, 0.34, 0.32), ash * 0.5);
  s.albedo = c; s.height = 0.6 - f * 0.4 + n * 0.1; s.rough = 0.95; s.metal = 0.0; s.ao = 1.0 - f * 0.5;
}`,
  });
  const ember = forge.generate('gameroom:logember', {
    size: 512,
    glsl: glslCommon + /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float f = fiss(uv);
  float hot = smoothstep(0.35, 0.75, fbmv(uv + 1.7, vec2(5.0, 3.0), 4));
  vec3 c = vec3(1.0, 0.42, 0.1) * f * (0.25 + 0.75 * hot);
  s.albedo = c; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
  return { bark, ember };
}

/** Firebox brick: a soot gradient so the back is near-black at the top and around the fire. uv 0..1 over the back wall. */
export function sootTexture(forge) {
  return forge.generate('gameroom:soot', {
    size: 512, tile: false, normalStrength: 2.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 b = vec2(uv.x * 4.0, uv.y * 10.0);
  b.x += mod(floor(b.y), 2.0) * 0.5;
  vec2 f = fract(b); vec2 id = floor(b);
  float m = min(min(f.x, 1.0 - f.x) * 0.25, min(f.y, 1.0 - f.y) * 0.1) * 40.0;
  float mortar = 1.0 - smoothstep(0.0, 0.35, m);
  vec3 brick = vec3(0.22, 0.1, 0.07) * (0.7 + 0.5 * hash12(id));
  vec3 c = mix(brick, vec3(0.1, 0.09, 0.08), mortar);
  float soot = smoothstep(0.1, 0.85, uv.y) + 0.5 * (1.0 - smoothstep(0.0, 0.35, abs(uv.x - 0.5))) * smoothstep(0.1, 0.4, uv.y);
  soot += 0.4 * fbmv(uv, vec2(5.0), 4);
  c *= mix(1.0, 0.06, clamp(soot, 0.0, 1.0));
  s.albedo = c; s.height = 0.6 - mortar * 0.4 + 0.05 * vnoise(uv * 200.0, vec2(200.0)); s.rough = 0.95; s.metal = 0.0; s.ao = 1.0 - mortar * 0.4;
}`,
  });
}

/** Antler: bone ridges and pearling running along the beam (v = along). Tiles. */
export function antlerTexture(forge) {
  return forge.generate('gameroom:antler', {
    size: 512, normalStrength: 3.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float g = vnoise(vec2(uv.x * 24.0, uv.y * 2.0), vec2(24.0, 2.0)) * 0.6 + vnoise(vec2(uv.x * 60.0, uv.y * 5.0), vec2(60.0, 5.0)) * 0.4;
  float pearl = smoothstep(0.55, 0.85, vnoise(uv * vec2(40.0, 40.0), vec2(40.0)));
  float h = g * 0.7 + pearl * 0.5;
  vec3 c = mix(vec3(0.3, 0.22, 0.14), vec3(0.62, 0.52, 0.38), h);
  s.albedo = c; s.height = h; s.rough = 0.55 - pearl * 0.15; s.metal = 0.0; s.ao = 0.7 + 0.3 * h;
}`,
  });
}

/** Coffer panel: sunken plaster field with a moulded border and a faint acanthus wreath. uv 0..1 per panel. */
export function cofferTexture(forge) {
  return forge.generate('gameroom:coffer', {
    size: 512, tile: false, normalStrength: 3.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv - 0.5;
  float e = max(abs(p.x), abs(p.y));
  float h = 0.5;
  h += 0.25 * smoothstep(0.5, 0.47, e) * (1.0 - smoothstep(0.44, 0.42, e));    // border torus
  h -= 0.15 * smoothstep(0.42, 0.40, e);                                        // sunken field
  h += 0.08 * (1.0 - smoothstep(0.0, 0.01, abs(e - 0.38)));                   // fillet
  // wreath of leaves
  float r = length(p), a = atan(p.y, p.x);
  float leaves = smoothstep(0.03, 0.0, abs(r - 0.22 - 0.02 * sin(a * 16.0))) * (0.6 + 0.4 * sin(a * 32.0));
  h += leaves * 0.12;
  vec3 c = vec3(0.07, 0.085, 0.14) * (0.85 + 0.3 * fbmv(uv, vec2(5.0), 4));
  c = mix(c, vec3(0.42, 0.32, 0.16), smoothstep(0.003, 0.0, abs(e - 0.38)) * 0.8);
  float stain = smoothstep(0.6, 0.85, fbmv(uv + 3.0, vec2(3.0), 5));
  c *= 1.0 - stain * 0.3;
  s.albedo = c; s.height = h; s.rough = 0.85; s.metal = 0.0; s.ao = 0.75 + 0.25 * smoothstep(0.3, 0.6, h);
}`,
  });
}

/** A dark, varnished hunting scene (homage, authored): dusk over a wood, a rider and hounds, the quarry scraped out. uv 0..1, aspect w/h. */
export function huntPaintingTexture(forge, aspect = 1.42) {
  return forge.generate('gameroom:hunt', {
    size: 1024, aspect, tile: false, normalStrength: 0.8,
    uniforms: { uPA: aspect },
    glsl: /* glsl */ `
float horse(vec2 p) {
  float d = sdEllipse(p - vec2(0.0, 0.0), vec2(0.075, 0.032));
  d = min(d, sdEllipse(rot2(-0.9) * (p - vec2(0.07, 0.035)), vec2(0.035, 0.014)));
  d = min(d, sdEllipse(rot2(-0.3) * (p - vec2(0.1, 0.06)), vec2(0.02, 0.01)));
  d = min(d, sdSegment(p, vec2(-0.05, -0.01), vec2(-0.08, -0.07)) - 0.006);
  d = min(d, sdSegment(p, vec2(-0.04, -0.01), vec2(-0.02, -0.075)) - 0.006);
  d = min(d, sdSegment(p, vec2(0.045, -0.01), vec2(0.09, -0.05)) - 0.006);
  d = min(d, sdSegment(p, vec2(0.05, -0.01), vec2(0.04, -0.075)) - 0.006);
  d = min(d, sdSegment(p, vec2(-0.07, 0.01), vec2(-0.11, -0.03)) - 0.007);
  // rider
  d = min(d, sdSegment(p, vec2(0.0, 0.03), vec2(0.012, 0.085)) - 0.012);
  d = min(d, sdCircle(p - vec2(0.016, 0.105), 0.011));
  d = min(d, sdBox(p - vec2(0.016, 0.118), vec2(0.008, 0.008)));
  d = min(d, sdSegment(p, vec2(0.01, 0.07), vec2(0.05, 0.05)) - 0.004);
  return d;
}
float hound(vec2 p, float s) {
  p /= s;
  float d = sdEllipse(p, vec2(0.04, 0.012));
  d = min(d, sdEllipse(rot2(-0.5) * (p - vec2(0.045, 0.012)), vec2(0.016, 0.007)));
  d = min(d, sdSegment(p, vec2(-0.03, 0.0), vec2(-0.05, -0.03)) - 0.003);
  d = min(d, sdSegment(p, vec2(-0.02, 0.0), vec2(-0.005, -0.03)) - 0.003);
  d = min(d, sdSegment(p, vec2(0.025, 0.0), vec2(0.05, -0.025)) - 0.003);
  d = min(d, sdSegment(p, vec2(0.03, 0.0), vec2(0.02, -0.03)) - 0.003);
  d = min(d, sdSegment(p, vec2(-0.04, 0.005), vec2(-0.065, 0.025)) - 0.002);
  return d * s;
}
void surface(vec2 uv, inout Surface s) {
  vec2 p = vec2(uv.x * uPA, uv.y);
  // sky: amber dusk at the horizon into olive-umber dark
  float hz = 0.42;
  vec3 sky = mix(vec3(0.55, 0.42, 0.24), vec3(0.12, 0.13, 0.12), smoothstep(hz, 0.95, uv.y));
  float cl = fbm(vec2(p.x * 0.8, uv.y * 2.0), vec2(4.0, 2.0), 5);
  sky = mix(sky, sky * 0.55 + vec3(0.04, 0.035, 0.03), smoothstep(-0.1, 0.4, cl) * smoothstep(hz + 0.05, 0.7, uv.y));
  sky += vec3(0.45, 0.3, 0.12) * exp(-length((p - vec2(uPA * 0.62, hz + 0.02)) * vec2(0.6, 3.0)) * 4.0) * 0.25;
  vec3 col = sky;
  // distant hills
  float hill = uv.y - (hz + 0.03 * fbm(vec2(p.x * 1.5, 0.0), vec2(6.0, 1.0), 4));
  col = mix(col, vec3(0.16, 0.14, 0.09), smoothstep(0.003, -0.003, hill));
  // meadow
  float mead = smoothstep(hz, 0.0, uv.y);
  vec3 grass = mix(vec3(0.2, 0.17, 0.08), vec3(0.06, 0.055, 0.03), mead);
  grass *= 0.8 + 0.4 * fbmv(vec2(p.x * 3.0, uv.y * 12.0), vec2(12.0, 12.0), 4);
  col = mix(col, grass, smoothstep(0.003, -0.003, hill + 0.02));
  // woods left and right: dark crowns
  float trees = fbm(p * vec2(3.0, 3.0), vec2(12.0, 3.0), 5);
  float wl = smoothstep(0.32, 0.0, uv.x) + smoothstep(0.8, 1.0, uv.x);
  float crown = smoothstep(0.02, -0.02, uv.y - (0.35 + wl * 0.6 + trees * 0.25));
  col = mix(col, vec3(0.05, 0.05, 0.03) * (0.8 + 0.5 * trees), crown * smoothstep(0.1, 0.4, wl));
  // trunks
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float x = fi < 3.0 ? 0.05 + fi * 0.09 : 0.82 + (fi - 3.0) * 0.06;
    float tr = abs(uv.x - x - 0.01 * sin(uv.y * 12.0 + fi)) - 0.006 * (1.4 - uv.y);
    col = mix(col, vec3(0.04, 0.035, 0.025), smoothstep(0.002, -0.002, tr) * smoothstep(0.75, 0.2, uv.y) * step(0.15, uv.y));
  }
  // the hunt: a rider and hounds crossing the meadow, catching the dusk light on their backs
  vec2 hp = p - vec2(uPA * 0.38, 0.3);
  float dh = horse(hp * 0.42) / 0.42;
  vec3 horseC = vec3(0.12, 0.06, 0.03);
  col = mix(col, horseC, smoothstep(0.002, -0.002, dh));
  col = mix(col, vec3(0.45, 0.12, 0.06), smoothstep(0.002, -0.002, sdSegment(hp * 0.42, vec2(0.0, 0.035), vec2(0.012, 0.085)) / 0.42 - 0.009 * 1.9));  // red coat
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 q = p - vec2(uPA * (0.55 + fi * 0.075 + 0.02 * sin(fi * 3.0)), 0.16 + 0.035 * sin(fi * 1.7));
    float d = hound(q, 2.2 + 0.4 * hash11(fi));
    vec3 hc = mix(vec3(0.5, 0.42, 0.3), vec3(0.15, 0.09, 0.05), hash11(fi + 3.0));
    col = mix(col, hc, smoothstep(0.0015, -0.0015, d));
  }
  // the quarry: scraped away to the ground
  vec2 sp = (p - vec2(uPA * 0.9, 0.22)) * vec2(1.0, 1.3);
  float scr = smoothstep(0.1, 0.06, length(sp) + 0.03 * fbm(sp * 8.0, vec2(16.0), 3));
  col = mix(col, vec3(0.55, 0.48, 0.36) * (0.8 + 0.3 * vnoise(p * 300.0, vec2(4096.0))), scr * 0.85);
  // brushwork, yellowed varnish, craquelure, darkened edges
  float brush = vnoise(vec2(p.x * 220.0 + fbm(p * 4.0, vec2(8.0), 2) * 20.0, uv.y * 60.0), vec2(4096.0));
  col *= 0.9 + 0.18 * brush;
  col = mix(col, col * vec3(1.05, 0.9, 0.6), 0.5);
  float cr = voronoiEdge(p * 90.0, vec2(4096.0), 1.0);
  float crack = (1.0 - smoothstep(0.0, 0.04, cr)) * smoothstep(0.3, 0.7, fbmv(p * 2.0, vec2(8.0), 3));
  col *= 1.0 - crack * 0.2;
  vec2 vq = uv - 0.5;
  col *= 1.0 - 0.35 * smoothstep(0.3, 0.75, length(vq * vec2(1.2, 1.4)));
  col *= 1.35;
  s.albedo = col; s.height = 0.5 + brush * 0.05 - crack * 0.06; s.rough = 0.45 + crack * 0.2; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Short taxidermy fur with flowing strands. Tiles. */
export function furTexture(forge, { a = [0.11, 0.065, 0.035], b = [0.36, 0.23, 0.12], key = 'stag' } = {}) {
  return forge.generate(`gameroom:fur:${key}`, {
    size: 512, normalStrength: 2.2,
    uniforms: { uA: a, uB: b },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float w = fbm(uv, vec2(3.0), 3);
  float s1 = vnoise(vec2(uv.x * 160.0 + w * 14.0, uv.y * 14.0), vec2(160.0, 14.0));
  float s2 = vnoise(vec2(uv.x * 340.0 + w * 22.0, uv.y * 26.0), vec2(340.0, 26.0));
  float h = s1 * 0.6 + s2 * 0.4;
  vec3 c = mix(uA, uB, smoothstep(0.2, 0.9, h));
  c *= 0.75 + 0.45 * fbmv(uv, vec2(4.0), 3);
  s.albedo = c;
  s.height = h;
  s.rough = 0.8 - 0.15 * h;
  s.metal = 0.0;
  s.ao = 0.6 + 0.4 * h;
}`,
  });
}

/** Moonlit winter sky over the grounds, seen from the upper floor: moon, torn cloud, the crown of a dead elm. HDR (multiply in material). */
export function nightSkyTexture(forge) {
  return forge.generate('gameroom:nightsky', {
    size: 1024, aspect: 0.75, tile: false,
    glsl: /* glsl */ `
float branch(vec2 p, vec2 a, vec2 b, float w0, float w1) {
  vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(w0, w1, h);
}
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  vec2 moon = vec2(0.34, 0.74);
  float md = length((p - moon) * vec2(0.75, 1.0));
  vec3 sky = mix(vec3(0.03, 0.05, 0.11), vec3(0.22, 0.3, 0.5), smoothstep(0.2, 1.0, p.y));
  sky += vec3(0.55, 0.64, 0.85) * exp(-md * 4.5) * 0.9;
  float cl = fbm(p + vec2(0.7, 0.2), vec2(2.0, 3.0), 6);
  float cl2 = fbm(p + 0.3, vec2(4.0, 7.0), 4);
  sky = mix(sky, sky * 0.45 + vec3(0.02, 0.025, 0.04), smoothstep(-0.05, 0.35, cl + cl2 * 0.3) * 0.75);
  sky += vec3(0.8, 0.85, 0.95) * smoothstep(0.18, 0.0, abs(cl - 0.02)) * exp(-md * 2.5) * 0.5;
  sky = mix(sky, vec3(1.0, 0.98, 0.94) * 1.4, smoothstep(0.045, 0.038, md));
  // stars
  vec2 g = p * vec2(90.0, 120.0); vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float st = smoothstep(0.06, 0.0, length(f - (hash22(id) - 0.5) * 0.7)) * step(0.93, hash12(id + 1.7));
  sky += vec3(0.7, 0.75, 0.9) * st * 0.6 * (1.0 - smoothstep(-0.1, 0.2, cl));
  // distant woods and a snowy roofline
  float far = p.y - (0.2 + 0.05 * fbm(vec2(p.x, 0.5), vec2(7.0, 1.0), 5));
  vec3 col = mix(sky, vec3(0.06, 0.075, 0.13), smoothstep(0.004, -0.004, far));
  float hill = p.y - (0.12 + 0.02 * fbm(vec2(p.x, 0.3), vec2(3.0, 1.0), 4));
  col = mix(col, vec3(0.3, 0.36, 0.5) * (0.8 + 0.2 * fbmv(p, vec2(30.0), 3)), smoothstep(0.004, -0.004, hill));
  // a dead elm: trunk from the lower right, limbs, branches and twigs (3 generations)
  float d = branch(p, vec2(0.98, -0.05), vec2(0.9, 0.42), 0.045, 0.024);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 a = mix(vec2(0.97, 0.0), vec2(0.9, 0.42), 0.35 + fi * 0.15);
    float ang = 1.7 + (hash11(fi * 3.1) - 0.3) * 1.6 + fi * 0.12;
    float len = 0.22 + hash11(fi + 7.0) * 0.18;
    vec2 b = a + vec2(cos(ang), sin(ang)) * len;
    d = min(d, branch(p, a, b, 0.016 - fi * 0.0015, 0.005));
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      vec2 a2 = mix(a, b, 0.35 + fj * 0.25);
      float ang2 = ang + (hash11(fi * 7.0 + fj) - 0.5) * 1.8;
      vec2 b2 = a2 + vec2(cos(ang2), sin(ang2)) * len * (0.45 - fj * 0.08);
      d = min(d, branch(p, a2, b2, 0.005, 0.0018));
      for (int k = 0; k < 2; k++) {
        float fk = float(k);
        vec2 a3 = mix(a2, b2, 0.5 + fk * 0.3);
        float ang3 = ang2 + (hash11(fi * 13.0 + fj * 3.0 + fk) - 0.5) * 2.0;
        vec2 b3 = a3 + vec2(cos(ang3), sin(ang3)) * len * 0.2;
        d = min(d, branch(p, a3, b3, 0.0018, 0.0007));
      }
    }
  }
  col = mix(col, vec3(0.008, 0.01, 0.018), smoothstep(0.002, -0.002, d));
  s.albedo = col; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

// ------------------------------------------------------------------ canvas atlases

export const BALL_COLORS = ['#f2ead2', '#e8b81c', '#1d3f9a', '#b8221c', '#4a1f6a', '#e0661c', '#12623a', '#6b1a1c', '#121010'];

/** 4x4 atlas of equirect billiard-ball maps (cell 256x128). Index 0 = cue ball, 1..15 numbered. */
export function ballAtlas(forge) {
  return forge.canvas('gameroom:balls', 1024, 512, (g) => {
    for (let n = 0; n < 16; n++) {
      const cx = (n % 4) * 256, cy = Math.floor(n / 4) * 128;
      const ivory = '#efe4c8';
      const col = n === 0 ? ivory : BALL_COLORS[n <= 8 ? n : n - 8];
      const stripe = n > 8;
      g.fillStyle = stripe ? ivory : col; g.fillRect(cx, cy, 256, 128);
      if (stripe) { g.fillStyle = col; g.fillRect(cx, cy + 128 * 0.24, 256, 128 * 0.52); }
      // patina: slight darkening toward poles, tiny speckles
      const gr = g.createLinearGradient(0, cy, 0, cy + 128);
      gr.addColorStop(0, 'rgba(60,40,20,0.18)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(60,40,20,0.18)');
      g.fillStyle = gr; g.fillRect(cx, cy, 256, 128);
      if (n === 0) {
        g.fillStyle = '#b8221c';
        for (const u of [0.25, 0.75]) { g.beginPath(); g.arc(cx + u * 256, cy + 64, 4, 0, Math.PI * 2); g.fill(); }
        continue;
      }
      for (const u of [0.25, 0.75]) {
        const x = cx + u * 256, y = cy + 64;
        g.fillStyle = ivory; g.beginPath(); g.ellipse(x, y, 21, 21, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#141010'; g.font = 'bold 25px "DejaVu Serif", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(n), x, y + 1);
        if (n === 6 || n === 9) { g.fillRect(x - 6, y + 14, 12, 2); }
      }
    }
  }, { tile: false });
}

function pip(g, suit, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = suit === 'h' || suit === 'd' ? '#a3151a' : '#121212';
  g.beginPath();
  if (suit === 'h') {
    g.moveTo(0, 0.9); g.bezierCurveTo(-1.2, 0.0, -1.0, -0.95, -0.5, -0.95); g.bezierCurveTo(-0.15, -0.95, 0, -0.6, 0, -0.45);
    g.bezierCurveTo(0, -0.6, 0.15, -0.95, 0.5, -0.95); g.bezierCurveTo(1.0, -0.95, 1.2, 0.0, 0, 0.9);
  } else if (suit === 'd') {
    g.moveTo(0, -1); g.quadraticCurveTo(0.35, -0.3, 0.75, 0); g.quadraticCurveTo(0.35, 0.3, 0, 1); g.quadraticCurveTo(-0.35, 0.3, -0.75, 0); g.quadraticCurveTo(-0.35, -0.3, 0, -1);
  } else if (suit === 's') {
    g.moveTo(0, -1); g.bezierCurveTo(-1.2, -0.1, -1.0, 0.75, -0.45, 0.7); g.bezierCurveTo(-0.2, 0.68, -0.08, 0.5, -0.05, 0.4);
    g.lineTo(-0.3, 1.0); g.lineTo(0.3, 1.0); g.lineTo(0.05, 0.4);
    g.bezierCurveTo(0.08, 0.5, 0.2, 0.68, 0.45, 0.7); g.bezierCurveTo(1.0, 0.75, 1.2, -0.1, 0, -1);
  } else {
    for (const [cx, cy] of [[0, -0.45], [-0.5, 0.2], [0.5, 0.2]]) { g.moveTo(cx + 0.42, cy); g.arc(cx, cy, 0.42, 0, Math.PI * 2); }
    g.moveTo(-0.1, 0.2); g.lineTo(-0.3, 1.0); g.lineTo(0.3, 1.0); g.lineTo(0.1, 0.2);
  }
  g.fill(); g.restore();
}

/** Card atlas 5 x (256x384): [7 of hearts, queen of spades, ace of spades, 3 of clubs, back]. */
export const CARD_FACES = ['7h', 'Qs', 'As', '3c', 'back'];
export function cardAtlas(forge) {
  return forge.canvas('gameroom:cards', 1280, 384, (g) => {
    CARD_FACES.forEach((card, k) => {
      const x0 = k * 256;
      g.save(); g.translate(x0, 0);
      const W = 256, H = 384;
      g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, W, H);
      const age = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 260);
      age.addColorStop(0, 'rgba(0,0,0,0)'); age.addColorStop(1, 'rgba(90,60,25,0.35)');
      g.fillStyle = age; g.fillRect(0, 0, W, H);
      if (card === 'back') {
        g.fillStyle = '#5a1015'; g.fillRect(14, 14, W - 28, H - 28);
        g.strokeStyle = '#c9a55a'; g.lineWidth = 3; g.strokeRect(22, 22, W - 44, H - 44);
        g.strokeStyle = 'rgba(201,165,90,0.55)'; g.lineWidth = 1.5;
        for (let i = -20; i < 40; i++) { g.beginPath(); g.moveTo(22 + i * 12, 22); g.lineTo(22 + i * 12 + 340, 362); g.stroke(); g.beginPath(); g.moveTo(22 + i * 12, 362); g.lineTo(22 + i * 12 + 340, 22); g.stroke(); }
        g.fillStyle = '#5a1015'; g.beginPath(); g.ellipse(W / 2, H / 2, 54, 70, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#c9a55a'; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#c9a55a'; g.font = 'bold 54px "DejaVu Serif", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('S', W / 2, H / 2 + 2);
        g.restore(); return;
      }
      const rank = card.slice(0, -1), suit = card.slice(-1);
      const red = suit === 'h' || suit === 'd';
      g.fillStyle = red ? '#a3151a' : '#121212';
      g.font = 'bold 40px "DejaVu Serif", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const flip of [0, 1]) {
        g.save(); if (flip) { g.translate(W, H); g.rotate(Math.PI); }
        g.fillText(rank, 28, 34); pip(g, suit, 28, 72, 13);
        g.restore();
      }
      if (rank === 'Q') {
        // the queen: a pale face under a crown, in a frame
        g.strokeStyle = '#121212'; g.lineWidth = 2; g.strokeRect(54, 60, W - 108, H - 120);
        g.fillStyle = '#d9c9a4'; g.fillRect(56, 62, W - 112, H - 124);
        for (const flip of [0, 1]) {
          g.save(); if (flip) { g.translate(W, H); g.rotate(Math.PI); }
          g.fillStyle = '#20263e'; g.beginPath(); g.moveTo(70, 190); g.quadraticCurveTo(128, 120, 186, 190); g.closePath(); g.fill();
          g.fillStyle = '#f0e2c8'; g.beginPath(); g.ellipse(128, 128, 24, 30, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#1a1010'; g.fillRect(117, 122, 6, 3); g.fillRect(133, 122, 6, 3);
          g.fillStyle = '#a3151a'; g.fillRect(122, 142, 12, 3);
          g.fillStyle = '#c9a55a'; g.beginPath(); g.moveTo(102, 104); for (let i = 0; i <= 4; i++) { g.lineTo(102 + i * 13, i % 2 ? 98 : 80); } g.lineTo(154, 104); g.closePath(); g.fill();
          g.fillStyle = '#a3151a'; g.fillRect(70, 170, 116, 8);
          pip(g, suit, 160, 168, 10);
          g.restore();
        }
      } else if (rank === 'A') {
        pip(g, suit, W / 2, H / 2, 58);
      } else {
        const n = Number(rank);
        const layouts = { 3: [[0.5, 0.2], [0.5, 0.5], [0.5, 0.8]], 7: [[0.3, 0.2], [0.7, 0.2], [0.5, 0.35], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]] };
        for (const [u, v] of layouts[n] || []) pip(g, suit, 58 + u * (W - 116), 60 + v * (H - 120), 22);
      }
      g.restore();
    });
  }, { tile: false });
}
