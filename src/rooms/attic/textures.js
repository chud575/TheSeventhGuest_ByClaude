/**
 * Attic procedural textures (authored for this room): adzed roof timbers, the
 * sarking boards under the slates, dusty floorboards, an old limewashed lath and
 * plaster gable, linen dust sheets, the moonlit sky beyond the oculus, cobwebs,
 * and the etched glass specimen plate of Stauf's microscope game.
 */
import * as THREE from 'three';
import { CELLS, RADIUS } from './hexx.js';

/**
 * Hand-hewn roof timber, 1 tile = 1.2 m (U, along the grain) x 0.3 m (V). Old oak gone silver-brown:
 * flowing growth rings with medullary flecks, adze scallops across the faces, long drying checks with
 * dark, soft-edged interiors, tannin streaks bled along the grain from old nail holes, woodworm flight
 * holes, scattered dark knots, and grey dust packed into the open grain.
 */
export function timberTexture(forge, { key = 'timber', base = [0.4, 0.31, 0.22] } = {}) {
  return forge.generate(`attic:${key}:v5`, {
    size: 1024, aspect: 2, normalStrength: 3.2,
    uniforms: { uBase: base },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  float warp = fbm(p * vec2(1.0, 1.0) + 0.3, vec2(2.0, 4.0), 5);
  float ringCoord = p.y * 22.0 + warp * 4.0 + 1.5 * sin(p.x * 6.2831 + warp * 2.0);
  float rings = 0.5 + 0.5 * sin(ringCoord * 3.14159);
  float late = pow(rings, 4.0);
  float fib = vnoise(p * vec2(24.0, 520.0), vec2(24.0, 520.0));
  float fib2 = vnoise(p * vec2(6.0, 160.0) + 3.1, vec2(6.0, 160.0));
  // medullary flecks (oak silver grain)
  vec4 fl = voronoi(p * vec2(40.0, 120.0), vec2(40.0, 120.0), 0.9);
  float fleck = smoothstep(0.12, 0.0, fl.x) * step(0.6, hash12(fl.zw));
  // adze scallops: shallow dished cuts across the grain, each a bit different
  float sx = p.x * 11.0 + fbm(p * vec2(2.0, 3.0), vec2(2.0, 3.0), 2) * 0.8;
  float sc = fract(sx);
  float scId = hash11(floor(sx) + 3.0);
  float adze = pow(4.0 * sc * (1.0 - sc), 0.6) * (0.6 + 0.4 * scId);
  float adzeEdge = smoothstep(0.06, 0.0, sc) + smoothstep(0.94, 1.0, sc);
  // drying checks: long splits with the grain, soft dark interiors
  float ck = 1e3;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float y0 = 0.08 + 0.15 * fi + 0.05 * hash11(fi + 2.0);
    float x0 = hash11(fi * 3.1), len = 0.3 + 0.45 * hash11(fi + 7.0);
    float dx = fract(p.x - x0);
    float wob = (fbm(vec2(p.x * 3.0, fi), vec2(3.0, 4.0), 3) - 0.5) * 0.03;
    float w = (0.003 + 0.004 * hash11(fi + 11.0)) * pow(sin(clamp(dx / len, 0.0, 1.0) * 3.14159), 0.7);
    ck = min(ck, dx < len ? abs(p.y - y0 - wob) - w : 1e3);
  }
  float crack = smoothstep(0.002, -0.001, ck);
  float crackHalo = smoothstep(0.012, 0.0, ck);
  // knots
  vec4 v = voronoi(p * vec2(3.0, 1.0), vec2(3.0, 1.0), 0.8);
  float knotOn = step(0.7, hash12(v.zw));
  float knots = smoothstep(0.08, 0.0, v.x) * knotOn;
  float knotRing = smoothstep(0.2, 0.06, v.x) * knotOn * (0.5 + 0.5 * sin(v.x * 140.0));
  // tannin streaks: dark bleeds trailing along the grain from nail holes
  float tan = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 c0 = vec2(hash11(fi * 5.3 + 1.0), 0.2 + 0.6 * hash11(fi * 2.9 + 4.0));
    vec2 d = vec2(fract(p.x - c0.x + 0.5) - 0.5, p.y - c0.y);
    float trail = exp(-abs(d.y) * 90.0) * exp(-max(d.x, 0.0) * 6.0) * step(-0.01, d.x);
    float hole = smoothstep(0.012, 0.006, length(d * vec2(1.0, 1.0)));
    tan = max(tan, trail * 0.7 + hole);
  }
  // woodworm flight holes
  vec4 ww = voronoi(p * vec2(60.0, 15.0), vec2(60.0, 15.0), 1.0);
  float worm = smoothstep(0.08, 0.04, ww.x) * step(0.93, hash12(ww.zw)) * step(0.55, fbm(p * 2.0 + 5.0, vec2(4.0), 3));
  vec3 c = uBase * (0.78 + 0.32 * fib2) * (1.06 - 0.32 * late);
  c *= 0.92 + 0.12 * fib;
  c = mix(c, uBase * 1.25 + 0.03, fleck * 0.35);
  c = mix(c, uBase * 0.42, knots * 0.85 + knotRing * 0.25);
  c = mix(c, c * vec3(0.55, 0.45, 0.38), tan);
  // silvering: weathered grey on the high spots, warmer brown down in the scallops
  float silver = smoothstep(0.35, 0.8, fbm(p * vec2(1.5, 4.0) + 9.0, vec2(3.0, 4.0), 5));
  c = mix(c, vec3(dot(c, vec3(0.333))) * vec3(1.02, 1.0, 0.97), silver * 0.35);
  c *= 0.9 + 0.12 * adze;
  // grey dust caught in the open grain and the scallop edges
  float grime = fbmv(p * vec2(1.0, 3.0) + 9.0, vec2(4.0, 6.0), 5);
  c = mix(c, vec3(0.34, 0.32, 0.29), (smoothstep(0.45, 0.8, grime) * 0.3 + adzeEdge * 0.12) * (1.0 - crack));
  c = mix(c, c * 0.35, crackHalo * 0.45);
  c *= 1.0 - crack * 0.85 - worm * 0.8;
  s.albedo = c;
  s.height = 0.55 + 0.1 * adze - 0.04 * adzeEdge + 0.05 * fib + 0.03 * late - crack * 0.4 - crackHalo * 0.05 - worm * 0.2 - knots * 0.03;
  s.rough = clamp(0.86 + 0.06 * fib - fleck * 0.1, 0.8, 0.98);
  s.metal = 0.0;
  s.ao = 1.0 - crack * 0.7 - crackHalo * 0.15 - worm * 0.5;
}`,
  });
}

/**
 * One sarking board, grain along U. 1 tile = 2.4 m (U) x 0.2 m (V). Sawn softwood gone dark with age:
 * kiln-saw marks, a water tide where a slate leaked, dark heart, a resin pocket or two.
 */
export function sarkBoardTexture(forge) {
  return forge.generate('attic:sarkboard', {
    size: 1024, aspect: 4, normalStrength: 2.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  float warp = fbm(p * vec2(2.0, 1.0) + 0.7, vec2(4.0, 2.0), 4);
  float rings = 0.5 + 0.5 * sin((p.y * 7.0 + warp * 2.5 + 0.6 * sin(p.x * 12.566)) * 6.2831);
  rings = pow(rings, 3.0);
  float fib = vnoise(p * vec2(60.0, 400.0), vec2(60.0, 400.0));
  // circular-saw marks: faint arcs across the board
  float saw = 0.5 + 0.5 * sin((p.x * 140.0 + sin(p.y * 3.0) * 1.5) * 6.2831);
  vec3 c = mix(vec3(0.3, 0.21, 0.13), vec3(0.42, 0.31, 0.2), fbm(p * vec2(3.0, 1.0) + 2.0, vec2(6.0, 2.0), 4));
  c *= (0.84 + 0.24 * fib) * (1.05 - 0.28 * rings) * (0.97 + 0.04 * saw);
  float tide = fbm(p * vec2(3.0, 1.0) + 0.37, vec2(6.0, 2.0), 5);
  float tl = smoothstep(0.02, 0.0, abs(tide - 0.62)) * 0.6 + smoothstep(0.62, 0.8, tide) * 0.5;
  c = mix(c, c * vec3(0.5, 0.44, 0.38), tl);
  vec4 v = voronoi(p * vec2(8.0, 1.0), vec2(8.0, 1.0), 0.8);
  float knot = smoothstep(0.1, 0.0, v.x) * step(0.8, hash12(v.zw));
  c = mix(c, vec3(0.12, 0.07, 0.04), knot * 0.8);
  float edge = smoothstep(0.0, 0.05, p.y) * smoothstep(1.0, 0.95, p.y);
  c *= mix(0.6, 1.0, edge);
  s.albedo = c;
  s.height = 0.5 + 0.06 * fib + 0.03 * saw - 0.05 * rings + 0.2 * edge;
  s.rough = 0.9; s.metal = 0.0; s.ao = mix(0.6, 1.0, edge);
}`,
  });
}

/** Sarking boards under the slates: horizontal boards (U = along, 1 tile = 1.2 m), dark gaps, rusted nails, water stains. */
export function sarkingTexture(forge) {
  return forge.generate('attic:sarking', {
    size: 1024, normalStrength: 2.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float rows = 7.0;
  float y = uv.y * rows;
  float id = floor(y), f = fract(y);
  float seed = hash11(id + 4.0);
  float xs = uv.x * 2.0 + seed;
  float bid = floor(xs);
  float bx = fract(xs);
  float tone = hash12(vec2(id, bid));
  float grain = vnoise(vec2(uv.x * 40.0, (y + seed * 7.0) * 18.0), vec2(40.0, rows * 18.0));
  float g2 = 0.5 + 0.5 * sin((uv.x * 3.0 + fbm(vec2(uv.x, y * 0.3 + seed), vec2(2.0, 3.0), 3) * 1.3 + f * 0.6) * 31.4);
  vec3 c = mix(vec3(0.24, 0.16, 0.1), vec3(0.4, 0.29, 0.19), tone) * (0.8 + 0.25 * grain) * (0.9 + 0.12 * g2);
  float gap = smoothstep(0.0, 0.035, f) * smoothstep(1.0, 0.965, f);
  float butt = smoothstep(0.0, 0.006, bx) * smoothstep(1.0, 0.994, bx);
  gap *= butt;
  // water stains: tide-lines from old leaks
  float st = fbm(uv + 0.7, vec2(3.0), 5);
  float tide = smoothstep(0.02, 0.0, abs(st - 0.18)) * 0.5 + smoothstep(0.2, 0.45, st) * 0.4;
  c = mix(c, c * vec3(0.55, 0.5, 0.45), tide);
  // nails at the rafter lines (every 0.5 tile)
  vec2 np = vec2(fract(uv.x * 2.0 + 0.25) - 0.5, f - 0.5);
  float nail = smoothstep(0.012, 0.006, length(np * vec2(1.0, 0.12)));
  c = mix(c * (1.0 - 0.6 * smoothstep(0.04, 0.0, length(np * vec2(1.0, 0.15)))), vec3(0.22, 0.1, 0.05), nail);
  c *= mix(0.15, 1.0, gap);
  s.albedo = c;
  s.height = 0.5 * gap + 0.08 * grain + nail * 0.2;
  s.rough = 0.9;
  s.metal = nail * 0.4;
  s.ao = mix(0.3, 1.0, gap);
}`,
  });
}

/** Dusty pine floorboards: long boards along V (1 tile = 1.6 m), dust settled in the gaps and away from the walking line. */
export function floorTexture(forge) {
  return forge.generate('attic:floor', {
    size: 2048, normalStrength: 2.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float cols = 8.0;
  float x = uv.x * cols;
  float id = floor(x), f = fract(x);
  float seed = hash11(id * 1.7 + 3.0);
  float ys = uv.y * 1.0 + seed;
  float bid = floor(ys), by = fract(ys);
  float tone = hash12(vec2(id, bid) + 0.3);
  float warp = fbm(vec2(f * 0.3 + id, ys * 2.0), vec2(cols, 2.0), 4);
  float ring = 0.5 + 0.5 * sin((f * 2.0 + warp * 2.5 + tone * 5.0) * 9.0);
  ring = pow(ring, 2.0);
  float fib = vnoise(vec2(uv.x * 600.0, uv.y * 30.0), vec2(600.0, 30.0));
  vec3 a = mix(vec3(0.3, 0.2, 0.12), vec3(0.42, 0.3, 0.19), tone);
  vec3 c = a * (0.78 + 0.3 * ring) * (0.88 + 0.2 * fib);
  float seam = smoothstep(0.0, 0.025, f) * smoothstep(1.0, 0.975, f);
  float butt = smoothstep(0.0, 0.004, by) * smoothstep(1.0, 0.996, by);
  float gap = seam * butt;
  // nails: two per board end
  vec2 np = vec2(f - 0.5, by);
  float nails = 0.0;
  for (int k = 0; k < 2; k++) {
    float nx = k == 0 ? -0.28 : 0.28;
    nails += smoothstep(0.035, 0.02, length(vec2(np.x - nx, (min(by, 1.0 - by) - 0.02) * 8.0)));
  }
  // dust: grey film, thicker in seams and patches
  float dust = smoothstep(0.35, 0.85, fbmv(uv * 1.0 + 4.2, vec2(5.0), 6));
  float fine = vnoise(uv * 900.0, vec2(900.0));
  vec3 dustC = vec3(0.36, 0.34, 0.31) * (0.9 + 0.2 * fine);
  c = mix(c, dustC, dust * 0.55);
  c = mix(c * 0.25, dustC * 0.6, (1.0 - gap) * 0.25);
  c = mix(c, vec3(0.08, 0.06, 0.05), nails * 0.85);
  c *= mix(0.25, 1.0, gap);
  s.albedo = c;
  s.height = 0.5 * gap + 0.05 * ring + 0.04 * fib + dust * 0.03;
  s.rough = mix(0.72, 0.95, dust);
  s.metal = nails * 0.3;
  s.ao = mix(0.35, 1.0, gap);
}`,
  });
}

/** Limewashed lath-and-plaster with blown patches showing the laths, damp and soot. 1 tile = 1.5 m. */
export function lathPlasterTexture(forge) {
  // 1 tile = 3 m. Limewashed plaster on riven laths: broad tonal drift, hairline cracks, blistered
  // limewash, and ragged patches where the plaster has fallen to show the laths, the plaster keys
  // squeezed between them and the dark void behind.
  return forge.generate('attic:lath3', {
    size: 2048, normalStrength: 2.6,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float n = fbm(uv + 1.3, vec2(4.0), 6);
  float big = fbm(uv * 1.0 + 7.7, vec2(3.0), 5);
  float edgeN = fbm(uv * 1.0 + 2.1, vec2(24.0), 4);
  // fallen patches: a few, various sizes, ragged edges
  float hole = big + 0.18 * (edgeN - 0.5) + 0.1 * (n - 0.5);
  float blown = smoothstep(0.69, 0.705, hole);
  float rim = smoothstep(0.655, 0.69, hole) * (1.0 - blown);
  // laths: 25 mm strips with 8 mm gaps, slightly wavy and of varying width; plaster keys in the gaps
  float ly = uv.y * 3.0 / 0.033 + vnoise(vec2(uv.x * 12.0, 0.0), vec2(12.0, 1.0)) * 0.4;
  float row = floor(ly), lf = fract(ly);
  float lw = 0.68 + 0.12 * hash11(row);
  float lath = smoothstep(0.0, 0.05, lf) * smoothstep(lw, lw - 0.05, lf);
  float lg = vnoise(vec2(uv.x * 160.0, row * 3.1), vec2(160.0, 300.0));
  float lgrain = vnoise(vec2(uv.x * 900.0, row * 7.3 + lf * 4.0), vec2(900.0, 900.0));
  vec3 lathC = vec3(0.3, 0.2, 0.12) * (0.7 + 0.35 * lg) * (0.85 + 0.25 * lgrain);
  float key = (1.0 - lath) * step(0.45, vnoise(vec2(uv.x * 60.0, row * 1.7), vec2(60.0, 300.0)));
  vec3 holeC = mix(vec3(0.02, 0.018, 0.016), vec3(0.36, 0.34, 0.3), key);
  holeC = mix(holeC, lathC, lath);
  // plaster body: limewash over grey lime, drifting tone, damp tide marks, fine pores
  vec3 pl = mix(vec3(0.5, 0.48, 0.44), vec3(0.6, 0.58, 0.53), smoothstep(0.3, 0.7, n));
  pl *= 0.86 + 0.14 * fbm(uv * 3.0 + 4.0, vec2(12.0), 4);
  float tide = smoothstep(0.015, 0.0, abs(fbm(uv * vec2(1.0, 2.0) + 3.3, vec2(3.0, 6.0), 5) - 0.52));
  pl = mix(pl, pl * vec3(0.72, 0.66, 0.55), tide * 0.5);
  float damp = smoothstep(0.45, 0.75, fbm(uv * vec2(2.0, 1.0) + 9.3, vec2(6.0, 3.0), 5));
  pl = mix(pl, pl * vec3(0.66, 0.64, 0.56), damp * 0.45);
  // blistered / flaking limewash: lighter flakes with dark edges
  vec4 fv = voronoi(uv * 30.0, vec2(90.0), 0.9);
  float flakeOn = step(0.62, fbm(uv * 2.0 + 5.0, vec2(6.0), 4)) * step(0.5, hash12(fv.zw));
  float flake = flakeOn * smoothstep(0.04, 0.09, fv.y - fv.x);
  pl = mix(pl, pl * 0.78, flakeOn * (1.0 - flake) * 0.6);
  pl = mix(pl, vec3(0.66, 0.64, 0.6), flake * 0.35);
  // hairline cracks
  float cr = voronoiEdge(uv * 7.0 + n * 0.25, vec2(21.0), 0.9);
  float crack = smoothstep(0.012, 0.0, cr) * step(0.55, fbmv(uv * 2.0, vec2(6.0), 3));
  pl *= 1.0 - crack * 0.45;
  float pores = vnoise(uv * 1400.0, vec2(1400.0));
  pl *= 0.94 + 0.08 * pores;
  vec3 c = mix(pl, holeC, blown);
  c = mix(c, c * 0.62, rim);   // broken edge: exposed brown coat
  c = mix(c, vec3(0.42, 0.36, 0.28), rim * 0.4);
  s.albedo = c;
  s.height = mix(0.78 + 0.04 * n - crack * 0.12 + flake * 0.03 - rim * 0.08, 0.12 + 0.28 * lath + 0.15 * key, blown);
  s.rough = mix(0.94, 0.86, blown);
  s.metal = 0.0;
  s.ao = mix(1.0 - rim * 0.3, 0.35 + 0.5 * max(lath, key), blown);
}`,
  });
}

/**
 * Old linen dust sheet, 1 tile = 0.5 m. No high-frequency checker in the colour (that is what moired):
 * the weave lives only as a faint, band-limited ripple in the height (well under Nyquist), while the
 * albedo carries what reads at distance: slubby yarn streaks, yellowed fold lines, tide-mark stains,
 * grey dust, mildew freckles.
 */
export function linenTexture(forge) {
  return forge.generate('attic:linen:v3', {
    size: 1024, normalStrength: 0.9,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  // weave: 96 threads per tile (~5 mm), soft sinusoid, in height only
  float wx = sin(uv.x * 6.2831 * 96.0), wy = sin(uv.y * 6.2831 * 96.0);
  float weave = 0.5 + 0.25 * wx * sign(wy) * 0.6 + 0.25 * wy * 0.4;
  // slubs: thicker threads, long streaks in warp and weft
  float slubU = vnoise(vec2(uv.x * 3.0, uv.y * 96.0), vec2(3.0, 96.0));
  float slubV = vnoise(vec2(uv.x * 96.0, uv.y * 3.0), vec2(96.0, 3.0));
  float slub = smoothstep(0.62, 0.9, slubU) * 0.5 + smoothstep(0.62, 0.9, slubV) * 0.5;
  float mott = fbm(uv * 2.0 + 0.2, vec2(2.0), 5);
  vec3 c = vec3(0.66, 0.63, 0.57) * (0.9 + 0.16 * mott) * (1.0 + 0.06 * slub);
  // yellowed stains with darker tide edges
  float st = fbm(uv + 3.7, vec2(1.0), 5);
  float stain = smoothstep(0.58, 0.68, st);
  float tide = smoothstep(0.015, 0.0, abs(st - 0.6));
  c = mix(c, c * vec3(0.93, 0.85, 0.68), stain * 0.6);
  c = mix(c, c * vec3(0.7, 0.62, 0.5), tide * 0.5);
  // dust: grey film in soft patches
  float dust = smoothstep(0.4, 0.8, fbm(uv * 1.0 + 8.1, vec2(1.0), 5));
  c = mix(c, vec3(0.5, 0.49, 0.47), dust * 0.35);
  // mildew freckles
  vec4 v = voronoi(uv * 40.0, vec2(40.0), 1.0);
  float mil = smoothstep(0.1, 0.03, v.x) * step(0.9, hash12(v.zw)) * smoothstep(0.55, 0.75, fbm(uv * 2.0 + 1.3, vec2(2.0), 3));
  c = mix(c, vec3(0.28, 0.3, 0.24), mil * 0.6);
  s.albedo = c;
  s.height = 0.5 + 0.12 * weave + 0.12 * slub + 0.05 * mott;
  s.rough = 0.93; s.metal = 0.0; s.ao = 0.94 + 0.06 * weave;
}`,
  });
}

/** multiplier map for old doll dresses: sun-faded patches, water stains with tide edges, dust in the pleats */
export function fabricStainTexture(forge) {
  return forge.generate('attic:fabricStain', {
    size: 512, normalStrength: 0.6,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float fade = smoothstep(0.35, 0.8, fbm(uv * 2.0 + 1.0, vec2(2.0), 5));
  float st = fbm(uv * 3.0 + 4.0, vec2(3.0), 5);
  float stain = smoothstep(0.55, 0.62, st), tide = smoothstep(0.012, 0.0, abs(st - 0.56));
  float dust = smoothstep(0.3, 0.9, fbm(uv * 6.0 + 2.0, vec2(6.0), 4));
  float thr = 0.5 + 0.5 * sin(uv.x * 6.2831 * 160.0) * sin(uv.y * 6.2831 * 160.0);
  vec3 c = vec3(1.0);
  c = mix(c, vec3(1.25, 1.2, 1.12), fade * 0.5);
  c = mix(c, vec3(0.75, 0.66, 0.5), stain * 0.55);
  c = mix(c, vec3(0.5, 0.42, 0.32), tide * 0.6);
  c = mix(c, vec3(1.3, 1.28, 1.22), dust * 0.35);
  s.albedo = c * 0.78;
  s.height = 0.5 + 0.06 * thr;
  s.rough = 0.9; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Night sky for the oculus: moon left of centre, torn cloud, a few stars. Non-tiling. */
export function moonSkyTexture(forge) {
  return forge.generate('attic:sky', {
    size: 1024, tile: false,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  vec2 moon = vec2(0.5, 0.52);
  float md = length(p - moon);
  vec3 sky = mix(vec3(0.012, 0.02, 0.05), vec3(0.07, 0.1, 0.2), smoothstep(0.0, 1.0, p.y));
  sky += vec3(0.5, 0.6, 0.85) * exp(-md * 4.0) * 0.55;
  float cl = fbm(p * vec2(1.0, 1.6) + vec2(0.2, 0.7), vec2(2.0, 3.0), 6);
  float cl2 = fbm(p + 0.3, vec2(5.0, 8.0), 4);
  float cloud = smoothstep(-0.02, 0.35, cl + cl2 * 0.3);
  // moon disc with maria
  float disc = 0.0;   // the moon itself is a separate, crisp disc mesh behind the glazing
  float maria = fbmv((p - moon) * 7.0 + 3.0, vec2(4.0), 5);
  vec3 moonC = vec3(1.0, 0.97, 0.9) * (1.15 - 0.35 * smoothstep(0.45, 0.7, maria)) * (1.0 - 0.25 * smoothstep(0.06, 0.11, md));
  vec3 col = mix(sky, moonC * 1.6, disc);
  // clouds drift across the lower part of the moon
  col = mix(col, col * 0.35 + vec3(0.02, 0.025, 0.045), cloud * (0.65 + 0.35 * (1.0 - disc)) * smoothstep(0.75, 0.3, p.y));
  col += vec3(0.75, 0.8, 0.95) * smoothstep(0.16, 0.0, abs(cl - 0.05)) * exp(-md * 2.5) * 0.9;
  col += vec3(0.5, 0.56, 0.72) * smoothstep(0.1, 0.0, abs(cl + cl2 * 0.3 - 0.12)) * exp(-md * 1.6) * 0.35;
  vec2 g = p * vec2(80.0); vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float st = smoothstep(0.07, 0.0, length(f - (hash22(id) - 0.5) * 0.7)) * step(0.94, hash12(id + 1.7));
  col += vec3(0.7, 0.75, 0.9) * st * 0.7 * (1.0 - cloud) * smoothstep(0.15, 0.25, md);
  s.albedo = col; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Cobweb: radial threads + spiral, sagging, with a torn side. Alpha in the albedo's alpha. */
export function cobwebTexture(forge, seed = 1) {
  return forge.canvas(`attic:cobweb${seed}`, 512, 512, (g, w, h) => {
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    g.clearRect(0, 0, w, h);
    // web anchored at the top-left corner (0,0) fanning into the quarter
    const cx = 6, cy = 6;
    const spokes = 11;
    const angles = [];
    for (let i = 0; i < spokes; i++) angles.push((i / (spokes - 1)) * Math.PI / 2 + (rnd() - 0.5) * 0.08);
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(235,235,240,0.8)';
    g.lineWidth = 1.6;
    const R = w * 0.98;
    for (const a of angles) {
      g.beginPath(); g.moveTo(cx, cy);
      const ex = cx + Math.cos(a) * R, ey = cy + Math.sin(a) * R;
      g.quadraticCurveTo((cx + ex) / 2 + 10, (cy + ey) / 2 + 14, ex, ey); g.stroke();
    }
    // spiral capture threads, sagging between spokes
    for (let k = 0; k < 30; k++) {
      const r = 22 + k * (R / 32) * (0.9 + rnd() * 0.2);
      if (rnd() < 0.12) continue;
      g.globalAlpha = 0.35 + 0.5 * rnd();
      g.lineWidth = 0.9 + rnd() * 0.8;
      g.beginPath();
      for (let i = 0; i < spokes; i++) {
        const a = angles[i];
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y);
        else {
          const am = (angles[i - 1] + a) / 2;
          const sag = r * 0.06 + 4;
          g.quadraticCurveTo(cx + Math.cos(am) * (r - sag), cy + Math.sin(am) * (r - sag) + sag * 0.4, x, y);
        }
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    // dust clumps + loose strands
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI / 2, r = rnd() * R * 0.9;
      g.fillStyle = `rgba(210,210,215,${0.15 + rnd() * 0.25})`;
      g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1 + rnd() * 3, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(230,230,235,0.5)';
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI / 2, r = R * (0.5 + rnd() * 0.45);
      g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.bezierCurveTo(cx + Math.cos(a) * r + 20, cy + Math.sin(a) * r + 60, cx + Math.cos(a) * r - 10, cy + Math.sin(a) * r + 90, cx + Math.cos(a) * r + 5, cy + Math.sin(a) * r + 130 * rnd());
      g.stroke();
    }
  }, { tile: false });
}

/**
 * Specimen plate of the infection game: dark glass with an etched hex lattice that
 * matches hexx.js exactly (flat-topped hexes), a graduated outer scale and a maker's ring.
 * `cell` = hex circumradius in plate units where the plate spans [-1, 1].
 */
export function plateTexture(forge, { cell }) {
  return forge.canvas('attic:plate', 1024, 1024, (g, w, h) => {
    const S = w / 2;
    const P = (x, y) => [S + x * S, S - y * S];
    const grd = g.createRadialGradient(S, S, 0, S, S, S);
    grd.addColorStop(0, '#16222a'); grd.addColorStop(0.75, '#0c1418'); grd.addColorStop(1, '#05080a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // faint culture smear
    for (let i = 0; i < 260; i++) {
      const a = (i * 2.399) % (Math.PI * 2), r = Math.sqrt((i * 0.618) % 1) * 0.9;
      g.fillStyle = `rgba(${90 + (i % 40)},${120 + (i % 30)},${110},0.025)`;
      const [x, y] = P(Math.cos(a) * r, Math.sin(a) * r);
      g.beginPath(); g.arc(x, y, 8 + (i % 17) * 2, 0, Math.PI * 2); g.fill();
    }
    const hexPath = (cx, cy, rr) => {
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const [x, y] = P(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
    };
    const center = ([q, r]) => [cell * 1.5 * q, -cell * Math.sqrt(3) * (r + q / 2)];
    // all 61 hexes, holes drawn as dark filled wells
    for (let q = -RADIUS; q <= RADIUS; q++) for (let r = -RADIUS; r <= RADIUS; r++) {
      if (Math.abs(q + r) > RADIUS) continue;
      const [cx, cy] = center([q, r]);
      const live = CELLS.some(([a, b]) => a === q && b === r);
      hexPath(cx, cy, cell * 0.97);
      if (!live) { g.fillStyle = '#020304'; g.fill(); g.strokeStyle = 'rgba(160,140,90,0.55)'; g.lineWidth = 3; g.stroke(); continue; }
      const cg = g.createRadialGradient(...P(cx, cy), 0, ...P(cx, cy), cell * S);
      cg.addColorStop(0, 'rgba(60,80,90,0.35)'); cg.addColorStop(1, 'rgba(10,16,20,0.0)');
      g.fillStyle = cg; g.fill();
      g.strokeStyle = 'rgba(190,205,215,0.55)'; g.lineWidth = 2.2; g.stroke();
      hexPath(cx, cy, cell * 0.86);
      g.strokeStyle = 'rgba(120,140,150,0.25)'; g.lineWidth = 1.2; g.stroke();
    }
    // graduated scale ring
    g.strokeStyle = 'rgba(200,180,120,0.7)';
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      const r0 = 0.93, r1 = i % 10 === 0 ? 0.985 : i % 5 === 0 ? 0.965 : 0.95;
      g.lineWidth = i % 10 === 0 ? 2.4 : 1.2;
      g.beginPath(); g.moveTo(...P(Math.cos(a) * r0, Math.sin(a) * r0)); g.lineTo(...P(Math.cos(a) * r1, Math.sin(a) * r1)); g.stroke();
    }
    g.beginPath(); g.arc(S, S, S * 0.925, 0, Math.PI * 2); g.lineWidth = 2; g.stroke();
    // engraved legend
    g.fillStyle = 'rgba(210,190,130,0.75)';
    g.font = 'italic 26px serif';
    g.textAlign = 'center';
    g.save(); g.translate(S, S);
    const txt = 'H. STAUF  ·  CULTURA  INFECTIONIS  ·  MCMXXXV  ·';
    for (let i = 0; i < txt.length; i++) {
      g.save(); g.rotate(-Math.PI * 0.82 + i * 0.048); g.translate(0, -S * 0.9); g.fillText(txt[i], 0, 0); g.restore();
    }
    g.restore();
  }, { tile: false });
}

/** Inner glow card for the sinister doorway: hot core fading to blood-red, with a silhouette hint of a stair beyond. */
export function hellGlowTexture(forge) {
  return forge.generate('attic:hellglow', {
    size: 512, aspect: 0.5, tile: false,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv - vec2(0.5, 0.35);
  float d = length(p * vec2(1.6, 1.0));
  float n = fbm(uv * vec2(2.0, 3.0) + 1.0, vec2(3.0, 4.0), 5);
  vec3 c = mix(vec3(1.0, 0.62, 0.25), vec3(0.55, 0.06, 0.02), smoothstep(0.0, 0.55, d + n * 0.12));
  c = mix(c, vec3(0.08, 0.01, 0.005), smoothstep(0.45, 0.9, d + n * 0.1));
  // stair treads rising into the light
  float st = fract(uv.y * 9.0);
  float tread = smoothstep(0.0, 0.06, st) * smoothstep(0.25, 0.15, st) * step(uv.y, 0.55);
  c *= 1.0 - tread * 0.55 * smoothstep(0.5, 0.0, abs(uv.x - 0.5));
  s.albedo = c; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/**
 * Attic brick: a 1.8 m tile of 24 courses x 8 stretchers, each brick with its own
 * hue, value, roughness and height; overfired clinkers, salt bloom (efflorescence),
 * chipped arrises, ragged mortar of varying width with dirt packed into it, the odd
 * missing or broken brick and fine surface pitting for close-ups.
 */
export function brickTexture(forge, { key = 'brick', base = [0.42, 0.235, 0.175], mortar = [0.55, 0.5, 0.43], bloom = 0.7, missing = 0.012, size = 2048 } = {}) {
  return forge.generate(`attic:${key}`, {
    size, normalStrength: 1.45,
    uniforms: { uBase: base, uMortar: mortar, uBloom: bloom, uMissing: missing },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  const float ROWS = 24.0, COLS = 8.0, TILE = 1.8;
  float ry = uv.y * ROWS;
  float r = floor(ry);
  float off = mod(r, 2.0) * 0.5 + (hash11(r * 1.37 + 2.0) - 0.5) * 0.18;
  // hand-made bricks: lengths wander by a few percent along each course (periodic over the tile)
  float gx = uv.x * COLS + off;
  gx += 0.09 * sin(uv.x * 6.2831853 * 3.0 + hash11(r + 9.0) * 6.28) + 0.05 * sin(uv.x * 6.2831853 * 5.0 + hash11(r + 3.0) * 6.28);
  float c = floor(gx);
  vec2 id = vec2(mod(c, COLS), mod(r, ROWS));
  vec2 f = vec2(fract(gx), fract(ry));
  float h1 = hash12(id + 0.31), h2 = hash12(id + 5.7), h3 = hash12(id * 1.9 + 11.0), h4 = hash12(id + 23.1), h5 = hash12(id * 3.3 + 1.0);
  vec2 bs = vec2(TILE / COLS, TILE / ROWS);           // brick size in metres
  // ragged mortar: per-brick inset + noisy edge
  float rag = fbm(uv, vec2(96.0), 3) * 0.003;
  vec2 inset = vec2(0.004 + 0.004 * h2, 0.0045 + 0.0035 * h3);
  vec2 dm = min(f, 1.0 - f) * bs - inset;
  float e = min(dm.x, dm.y) + rag;
  // chipped arrises / corners
  float chip = smoothstep(0.6, 0.9, fbmv(uv, vec2(140.0), 3)) * 0.004;
  float corner = length(max(vec2(0.012) - min(f, 1.0 - f) * bs, 0.0)) * step(0.6, h5) * 0.6;
  e -= chip + corner;
  float mortarM = 1.0 - smoothstep(0.0, 0.0012, e);
  float arris = smoothstep(-0.001, 0.014, e);
  float hM = 1.0 - smoothstep(-0.003, 0.007, e);   // a softer step for the height: a bedded, rounded joint, not a cliff
  // brick body colour: three clays + clinkers, ±15% value
  vec3 clayA = uBase, clayB = uBase * vec3(1.18, 1.1, 1.0), clayC = uBase * vec3(0.85, 0.72, 0.68);
  vec3 bc = mix(mix(clayA, clayB, step(0.45, h1)), clayC, step(0.78, h2));
  bc *= 0.85 + 0.3 * h3;
  float clinker = step(0.95, h4);
  bc = mix(bc, vec3(0.2, 0.12, 0.1) * (0.8 + 0.4 * h5), clinker * 0.75);
  // fire-flash: one end darker
  float flash = smoothstep(0.2, 1.0, mix(f.x, 1.0 - f.x, step(0.5, h5))) * step(0.55, h1) * 0.35;
  bc *= 1.0 - flash;
  // mottling + speckle inside the brick
  float mott = fbmv(uv, vec2(48.0), 4);
  float speck = vnoise(uv * 900.0, vec2(900.0));
  bc *= 0.82 + 0.3 * mott;
  bc = mix(bc, bc * vec3(0.7, 0.66, 0.62), smoothstep(0.82, 0.97, speck) * 0.4);
  // pitting
  vec4 vp = voronoi(uv * vec2(180.0), vec2(180.0), 1.0);
  float pit = smoothstep(0.07, 0.0, vp.x) * step(0.85, hash12(vp.zw));
  bc *= 1.0 - pit * 0.18;
  // salt bloom (efflorescence), patchy, collects at brick bottoms
  float bloom = smoothstep(0.55, 0.85, fbmv(uv + 0.37, vec2(3.0), 5) + 0.25 * (1.0 - f.y) * h1) * uBloom;
  bloom *= 0.5 + 0.5 * vnoise(uv * 220.0, vec2(220.0));
  bc = mix(bc, vec3(0.62, 0.6, 0.55), bloom * 0.55);
  // missing / broken bricks
  float gone = step(1.0 - uMissing, h4 * (1.0 - clinker) + clinker * 0.0);
  // mortar: varying tone, dirt packed into it
  float md = fbmv(uv, vec2(24.0), 4);
  // lime mortar: pale grey-tan, sandy, recessed; grime packs into it only in patches
  vec3 mc = uMortar * (0.8 + 0.25 * vnoise(uv * 420.0, vec2(420.0)));
  mc = mix(mc, uMortar * vec3(0.55, 0.52, 0.5), smoothstep(0.5, 0.85, md) * 0.55);
  vec3 col = mix(bc, mc, mortarM);
  col = mix(col, vec3(0.035, 0.03, 0.03), gone * (1.0 - mortarM));
  // large soot clouds
  float soot = smoothstep(0.4, 0.9, fbmv(uv + 0.71, vec2(2.0), 5));
  col *= 1.0 - soot * 0.55;
  // fine vertical run-marks (old damp) dragging grime down the face of the wall
  float runs = smoothstep(0.62, 0.9, vnoise(vec2(uv.x * 160.0, uv.y * 3.0), vec2(160.0, 3.0))) * smoothstep(0.3, 0.8, fbmv(uv + 0.13, vec2(3.0), 4));
  col *= 1.0 - runs * 0.35;
  s.albedo = col;
  float proud = (h1 - 0.5) * 0.08;
  float mdepth = 0.22 + 0.12 * hash12(id + 41.0);          // mortar raked to different depths
  s.height = mix(0.7 + proud + mott * 0.08 - pit * 0.06 - (1.0 - arris) * 0.05, mdepth + md * 0.05, hM) - gone * 0.55 * (1.0 - mortarM);
  s.rough = mix(mix(0.78 + 0.14 * h2, 0.66, clinker) + bloom * 0.1, 0.96, mortarM);
  s.metal = 0.0;
  s.ao = mix(mix(1.0, 0.96, 1.0 - arris), 0.8, mortarM) * (1.0 - gone * 0.6);
}`,
  });
}

/**
 * Kills the visible repeat of the brick tile: recomputes each brick's id from the map uv exactly as the
 * forge did, then re-tints it with a hash keyed by brick id AND tile repetition (hue, value, roughness),
 * so the same chipped brick never comes back with the same face. Adds world-space weathering on top:
 * white salt efflorescence rising from the floor, damp darkening under an opening, soot plumes above
 * flames. cfg: { damp: [x, yTop, width], soot: [[x, y, width, strength]...] }
 */
export function addBrickVariation(mat, cfg = {}) {
  const { damp = [0, -10, 0.1], soot = [], bloom = 0.5, floorY = 0 } = cfg;
  const S = soot.slice(0, 4); while (S.length < 4) S.push([0, -10, 0.1, 0]);
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uBvSoot = { value: S.map((q) => new THREE.Vector4(...q)) };
    sh.uniforms.uBvDamp = { value: new THREE.Vector3(...damp) };
    if (!sh.vertexShader.includes('varying vec3 vBvW;')) sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBvW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvBvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vBvW;
uniform vec4 uBvSoot[4];
uniform vec3 uBvDamp;
float bvH11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float bvH12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float bvN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bvH12(i), bvH12(i + vec2(1, 0)), f.x), mix(bvH12(i + vec2(0, 1)), bvH12(i + vec2(1, 1)), f.x), f.y); }
float bvF(vec2 p) { return 0.5 * bvN(p) + 0.25 * bvN(p * 2.03 + 1.7) + 0.125 * bvN(p * 4.01 + 3.1) + 0.0625 * bvN(p * 8.1 + 5.3); }
float gBvRough = 1.0;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  {
    vec2 buv = vMapUv;
    vec2 tile = floor(buv);
    vec2 u = fract(buv);
    const float ROWS = 24.0, COLS = 8.0;
    float ry = u.y * ROWS; float rr = floor(ry);
    float off = mod(rr, 2.0) * 0.5 + (bvH11(rr * 1.37 + 2.0) - 0.5) * 0.18;
    float gx = u.x * COLS + off;
    gx += 0.09 * sin(u.x * 6.2831853 * 3.0 + bvH11(rr + 9.0) * 6.28) + 0.05 * sin(u.x * 6.2831853 * 5.0 + bvH11(rr + 3.0) * 6.28);
    vec2 id = vec2(mod(floor(gx), COLS), rr);
    vec2 ff = vec2(fract(gx), fract(ry));
    float inBrick = smoothstep(0.02, 0.06, min(ff.x, 1.0 - ff.x)) * smoothstep(0.05, 0.14, min(ff.y, 1.0 - ff.y));
    vec2 key = id + tile * vec2(17.31, 29.77);
    float j1 = bvH12(key + 0.7), j2 = bvH12(key * 1.3 + 4.1), j3 = bvH12(key * 0.7 + 9.3);
    vec3 tint = vec3(1.0);
    tint *= 0.8 + 0.42 * j1;                                            // value
    tint *= mix(vec3(1.0), vec3(1.08, 0.94, 0.86), step(0.6, j2));      // warmer clay
    tint *= mix(vec3(1.0), vec3(0.86, 0.9, 1.0), step(0.85, j2));       // a cooler, harder-fired brick
    tint = mix(tint, vec3(0.45, 0.42, 0.42), step(0.93, j3) * 0.7);    // soot-blackened or clinker
    tint = mix(tint, vec3(1.25, 1.18, 1.08), step(0.965, j1) * 0.6);   // a pale replacement brick
    diffuseColor.rgb *= mix(vec3(1.0), tint, inBrick);
    gBvRough = mix(1.0, 0.85 + 0.3 * j3, inBrick);
    // second, non-integer-scale detail (world space) breaks the remaining tile rhythm
    vec2 wp = vec2(vBvW.x + vBvW.z, vBvW.y);
    diffuseColor.rgb *= 0.86 + 0.28 * bvF(wp * 1.37 + 3.3);
    // salt efflorescence wicking up from the floor: white, crystalline, patchy, fading up the wall
    float eff = (1.0 - smoothstep(0.0, 0.55 + 0.35 * bvF(wp * 2.1), vBvW.y - ${floorY.toFixed(3)})) * smoothstep(0.35, 0.75, bvF(wp * 3.7 + 1.1) + 0.15 * bvN(wp * 60.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.6, 0.56), eff * ${bloom.toFixed(3)});
    // damp under the opening: darker, spreading downward
    float dx = abs(vBvW.x - uBvDamp.x) / uBvDamp.z;
    float dmp = (1.0 - smoothstep(0.4, 1.0 + 0.4 * bvF(wp * 3.0), dx)) * step(vBvW.y, uBvDamp.y) * smoothstep(uBvDamp.y - 2.2, uBvDamp.y - 0.2, vBvW.y);
    diffuseColor.rgb *= 1.0 - 0.38 * dmp * (0.6 + 0.4 * bvF(wp * 8.0));
    gBvRough *= 1.0 - 0.3 * dmp;
    // soot plumes above flames: dense low, feathering out as they rise
    for (int i = 0; i < 4; i++) {
      vec4 q = uBvSoot[i];
      float h = vBvW.y - q.y;
      float w = q.z * (0.6 + h * 0.8);
      float plume = step(0.0, h) * exp(-h * 1.4) * (1.0 - smoothstep(0.2 * w, w, abs(vBvW.x - q.x + (bvN(vec2(h * 3.0, float(i))) - 0.5) * 0.12)));
      diffuseColor.rgb *= 1.0 - q.w * plume * (0.7 + 0.3 * bvF(wp * 6.0 + float(i)));
    }
  }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor * gBvRough, 0.3, 1.0);`);
  };
  mat.customProgramCacheKey = () => `${prevKey()}|brickvar:${JSON.stringify(cfg)}`;
  mat.needsUpdate = true;
  return mat;
}

/**
 * World-space grime for big surfaces (brick gables, timber): dirt banked along the
 * floor, soot along the roof line, vertical water/soot streaks below openings and at
 * rafter feet, and a broad tonal variation that kills visible tiling.
 * cfg: { floor: 0.5, roof: { knee, ridge, half } , streaks: [[x, yTop, width, strength]], tint, macro }
 */
export function addGrime(mat, cfg = {}) {
  const { floor = 0.45, roof = null, streaks = [], macro = 0.35, floorDark = 0.55, roofDark = 0.5, streakDark = 0.55 } = cfg;
  const S = streaks.slice(0, 6);
  while (S.length < 6) S.push([0, -10, 0.01, 0]);
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uGrStreak = { value: S.map((s) => new THREE.Vector4(...s)) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGrW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGrW;
uniform vec4 uGrStreak[6];
float grH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float grN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(grH(i), grH(i + vec2(1, 0)), f.x), mix(grH(i + vec2(0, 1)), grH(i + vec2(1, 1)), f.x), f.y); }
float grF(vec2 p) { return 0.5 * grN(p) + 0.25 * grN(p * 2.03 + 1.7) + 0.125 * grN(p * 4.01 + 3.1) + 0.0625 * grN(p * 8.1 + 5.3); }
float grimeMask(out float wet) {
  vec3 w = vGrW;
  vec2 hp = vec2(w.x + w.z, w.y);
  float g = 0.0;
  float fl = (1.0 - smoothstep(0.0, ${floor.toFixed(3)}, w.y + (grF(hp * 3.0) - 0.5) * 0.25)) * ${floorDark.toFixed(3)};
  g = max(g, fl);
  ${roof ? `float ry = ${roof.knee.toFixed(3)} + ${(roof.ridge - roof.knee).toFixed(3)} * (1.0 - abs(w.x) / ${roof.half.toFixed(3)});
  float rl = (1.0 - smoothstep(0.0, 0.7, ry - w.y + (grF(hp * 2.5 + 4.0) - 0.5) * 0.35)) * ${roofDark.toFixed(3)};
  g = max(g, rl);` : ''}
  wet = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 s = uGrStreak[i];
    float dx = abs(w.x - s.x + (grN(vec2(w.y * 3.0, float(i))) - 0.5) * 0.06);
    float cols = grN(vec2(w.x * 26.0 + float(i) * 7.0, 0.5));
    float st = (1.0 - smoothstep(s.z * 0.3, s.z, dx)) * step(w.y, s.y) * smoothstep(s.y - 2.6, s.y - 0.1, w.y);
    st *= 0.45 + 0.55 * smoothstep(0.3, 0.8, cols + 0.3 * grN(vec2(w.x * 60.0, w.y * 2.0)));
    st *= s.w;
    wet = max(wet, st);
  }
  g = max(g, wet * ${streakDark.toFixed(3)});
  return g;
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  float grWet; float grM = grimeMask(grWet);
  float grMac = grF(vec2(vGrW.x + vGrW.z * 0.7, vGrW.y) * 0.9);
  diffuseColor.rgb *= (1.0 - ${macro.toFixed(3)} * 0.5) + ${macro.toFixed(3)} * grMac;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.32, 0.3, 0.29), grM);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.72, grWet);`);
  };
  mat.customProgramCacheKey = () => `grime:${floor}:${JSON.stringify(roof)}:${macro}:${floorDark}:${roofDark}`;
  mat.needsUpdate = true;
  return mat;
}

/** Painted porcelain doll face for a sphere head (face centred at u = 0.25), craquelure, rosy cheeks. */
/** the crack path shared by the face albedo and its bump map (face canvas space, 1024 x 512) */
function dollCrackPath(seed, w, h) {
  let s = seed * 104729 + 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const cx = w * 0.25, cy = h * 0.56;
  const main = []; let x = cx + w * 0.07, y = cy - h * 0.3;
  main.push([x, y]);
  for (let k = 0; k < 14; k++) { x -= (4 + rnd() * 9) * (w / 512); y += (6 + rnd() * 6) * (h / 256); main.push([x, y]); }
  const branches = [];
  for (let b = 0; b < 4; b++) {
    const i0 = 2 + Math.floor(rnd() * 10), [bx0, by0] = main[i0]; let bx = bx0, by = by0; const br = [[bx, by]];
    const dir = rnd() < 0.5 ? -1 : 1;
    for (let k = 0; k < 4; k++) { bx += dir * (6 + rnd() * 10) * (w / 512); by += (rnd() - 0.3) * 10 * (h / 256); br.push([bx, by]); }
    branches.push(br);
  }
  return { main, branches };
}

/** bump map for the doll's porcelain: smooth, with the crack and hairlines cut in */
export function dollCrackBump(forge, { key = 'doll', seed = 1 } = {}) {
  return forge.canvas(`attic:facebump:${key}`, 1024, 512, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    const path = dollCrackPath(seed, w, h);
    const strokeP = (pts, lw, col, blur = 0) => { g.save(); g.filter = blur ? `blur(${blur}px)` : 'none'; g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); g.restore(); };
    strokeP(path.main, 6, '#5a5a5a', 2); strokeP(path.main, 2.2, '#101010');
    for (const b of path.branches) strokeP(b, 1.2, '#404040');
  }, { tile: false, srgb: false });
}

export function dollFaceTexture(forge, { key = 'doll', eye = '#2a3a5a', lip = '#9a2a2a', seed = 1 } = {}) {
  return forge.canvas(`attic:face:${key}`, 1024, 512, (g, w, h) => {
    g.save(); g.scale(2, 2); w /= 2; h /= 2;
    let s = seed * 7919 + 13;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    g.fillStyle = '#e8ddd0'; g.fillRect(0, 0, w, h);
    // slight yellowing toward the back
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(150,120,80,0.12)'); gr.addColorStop(0.25, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(150,120,80,0.15)'); gr.addColorStop(0.75, 'rgba(150,120,80,0.22)'); gr.addColorStop(1, 'rgba(150,120,80,0.12)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const cx = w * 0.25, cy = h * 0.56;
    g.save(); g.translate(cx, cy); g.scale(2.5, 2.2); g.translate(-cx, -cy);
    // cheeks
    for (const sx of [-1, 1]) {
      const rg = g.createRadialGradient(cx + sx * 26, cy + 18, 0, cx + sx * 26, cy + 18, 24);
      rg.addColorStop(0, 'rgba(210,90,90,0.55)'); rg.addColorStop(1, 'rgba(210,90,90,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(cx + sx * 26, cy + 18, 24, 0, Math.PI * 2); g.fill();
    }
    // eyes: dark glass with lids, lashes and highlight
    for (const sx of [-1, 1]) {
      const ex = cx + sx * 17, ey = cy - 4;
      g.fillStyle = '#f4f0ea'; g.beginPath(); g.ellipse(ex, ey, 9, 6.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = eye; g.beginPath(); g.arc(ex, ey + 0.5, 5.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#050505'; g.beginPath(); g.arc(ex, ey + 0.5, 2.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(ex - 1.8, ey - 1.6, 1.3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2a1810'; g.lineWidth = 1.8; g.beginPath(); g.ellipse(ex, ey, 9, 6.5, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      for (let k = 0; k < 6; k++) { const a = Math.PI * (1.1 + k * 0.15); g.lineWidth = 0.9; g.beginPath(); g.moveTo(ex + Math.cos(a) * 9, ey + Math.sin(a) * 6.5); g.lineTo(ex + Math.cos(a) * 12, ey + Math.sin(a) * 9.5); g.stroke(); }
      // brows
      g.strokeStyle = 'rgba(90,50,30,0.8)'; g.lineWidth = 1.4; g.beginPath(); g.arc(ex, ey + 6, 15, Math.PI * 1.3, Math.PI * 1.7); g.stroke();
    }
    // nose shadow + nostrils
    g.fillStyle = 'rgba(170,110,90,0.35)'; g.beginPath(); g.ellipse(cx, cy + 12, 3, 2, 0, 0, Math.PI * 2); g.fill();
    // rosebud lips
    g.fillStyle = lip;
    g.beginPath(); g.moveTo(cx - 7, cy + 24); g.quadraticCurveTo(cx - 3.5, cy + 20, cx, cy + 22.5); g.quadraticCurveTo(cx + 3.5, cy + 20, cx + 7, cy + 24); g.quadraticCurveTo(cx, cy + 29, cx - 7, cy + 24); g.fill();
    g.strokeStyle = 'rgba(60,10,10,0.7)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(cx - 6, cy + 24); g.lineTo(cx + 6, cy + 24); g.stroke();
    g.restore();
    g.restore(); w *= 2; h *= 2;
    // craquelure: hairline cracks, one bad crack across the cheek
    g.strokeStyle = 'rgba(70,55,45,0.35)'; g.lineWidth = 0.6;
    for (let i = 0; i < 40; i++) {
      let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 18; y += (rnd() - 0.5) * 18; g.lineTo(x, y); }
      g.stroke();
    }
    // the bad crack across the cheek: a grimy halo, the dark fissure, branching hairlines
    const path = dollCrackPath(seed, w, h);
    const strokeP = (pts, lw, col, blur = 0) => { g.save(); g.filter = blur ? `blur(${blur}px)` : 'none'; g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); g.restore(); };
    strokeP(path.main, 9, 'rgba(90,65,40,0.28)', 3);
    strokeP(path.main, 2.4, 'rgba(30,18,12,0.9)');
    strokeP(path.main, 0.8, 'rgba(10,5,3,1)');
    for (const b of path.branches) { strokeP(b, 4, 'rgba(90,65,40,0.18)', 2); strokeP(b, 1.0, 'rgba(35,22,15,0.75)'); }
    // grime in the hairline
    const hg = g.createLinearGradient(0, 0, 0, h * 0.3);
    hg.addColorStop(0, 'rgba(60,45,30,0.4)'); hg.addColorStop(1, 'rgba(60,45,30,0)');
    g.fillStyle = hg; g.fillRect(0, 0, w, h * 0.3);
  }, { tile: false });
}

/** Dapple-grey paint for the rocking horse: ring dapples, darker legs/points handled by geometry, worn varnish. */
export function dappleTexture(forge) {
  return forge.generate('attic:dapple', {
    size: 1024, normalStrength: 0.6,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  // dapple grey: pale rounded dapples inside a soft darker grey net, the net smoky and broken
  vec4 v = voronoi(uv * 9.0, vec2(9.0), 0.9);
  float n = fbmv(uv, vec2(4.0), 5);
  float br = fbmv(uv + 0.5, vec2(24.0), 3);
  float net = smoothstep(0.02, 0.16 + 0.08 * br, v.y - v.x);
  float spot = net * smoothstep(0.75, 0.25, v.x) ;
  vec3 dark = vec3(0.44, 0.44, 0.45) * (0.9 + 0.2 * n), light = vec3(0.8, 0.79, 0.76);
  vec3 c = mix(dark, light, mix(0.35, 1.0, spot) * (0.85 + 0.15 * n));
  c = mix(c, dark * 0.85, smoothstep(0.55, 0.8, n) * 0.5);     // smoky darker shading patches
  float wear = smoothstep(0.62, 0.8, fbmv(uv + 0.3, vec2(6.0), 4));
  c = mix(c, vec3(0.36, 0.25, 0.16), wear * 0.75);           // worn through to the wood
  float cr = smoothstep(0.02, 0.0, voronoiEdge(uv * 30.0, vec2(30.0), 1.0)) * 0.5;
  c *= 1.0 - cr * 0.4;
  s.albedo = c;
  s.height = 0.5 - cr * 0.2 - wear * 0.1;
  s.rough = mix(0.38, 0.75, wear) + cr * 0.2;
  s.metal = 0.0; s.ao = 1.0 - cr * 0.3;
}`,
  });
}

/** Sagging sheet web strung from a beam along the top edge: catenaries, cross threads, dust clumps, drooping strands. */
export function cobwebTangleTexture(forge, seed = 4) {
  return forge.canvas(`attic:tangle${seed}`, 1024, 768, (g, w, h) => {
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    // anchor points along the top edge
    const anchors = []; for (let i = 0; i < 22; i++) anchors.push(w * (0.02 + 0.96 * (i / 21)) + (rnd() - 0.5) * 20);
    // catenaries between anchors at many depths
    for (let k = 0; k < 70; k++) {
      const a = anchors[Math.floor(rnd() * anchors.length)], b = anchors[Math.floor(rnd() * anchors.length)];
      if (Math.abs(a - b) < 40) continue;
      const sag = Math.min(h * 0.92, Math.abs(a - b) * (0.25 + rnd() * 0.6));
      g.strokeStyle = `rgba(232,234,240,${0.18 + rnd() * 0.4})`; g.lineWidth = 0.7 + rnd() * 1.2;
      g.beginPath(); g.moveTo(a, 2); g.quadraticCurveTo((a + b) / 2, sag * 2 - 2, b, 2); g.stroke();
    }
    // fine cross threads between existing sags (dense near the middle)
    for (let k = 0; k < 260; k++) {
      const x = w * (0.1 + 0.8 * rnd()), y = h * Math.pow(rnd(), 1.4) * 0.8;
      const l = 30 + rnd() * 110, a = (rnd() - 0.5) * 1.2;
      g.strokeStyle = `rgba(225,228,235,${0.1 + rnd() * 0.25})`; g.lineWidth = 0.5 + rnd() * 0.6;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + 12, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // dust balls caught in the web
    for (let i = 0; i < 120; i++) {
      const x = w * (0.08 + 0.84 * rnd()), y = h * Math.pow(rnd(), 1.2) * 0.85;
      g.fillStyle = `rgba(200,200,205,${0.15 + rnd() * 0.35})`;
      g.beginPath(); g.arc(x, y, 1 + rnd() * 3.5, 0, Math.PI * 2); g.fill();
    }
    // drooping strands at the bottom
    for (let i = 0; i < 26; i++) {
      const x = w * (0.1 + 0.8 * rnd()), y0 = h * (0.3 + 0.4 * rnd()), l = h * (0.15 + rnd() * 0.3);
      g.strokeStyle = `rgba(230,230,235,${0.25 + rnd() * 0.35})`; g.lineWidth = 0.8 + rnd();
      g.beginPath(); g.moveTo(x, y0); g.bezierCurveTo(x + 10, y0 + l * 0.3, x - 12, y0 + l * 0.7, x + (rnd() - 0.5) * 20, Math.min(h - 2, y0 + l)); g.stroke();
    }
  }, { tile: false });
}

/** The full moon: limb darkening, maria, rayed craters, a torn wisp of cloud across the lower limb. Alpha = disc. */
export function moonDiscTexture(forge) {
  // the near side as seen from the northern hemisphere: Oceanus Procellarum sprawling down the left limb,
  // Imbrium's great round basin upper left, Serenitatis and Tranquillitatis joined across the middle,
  // Crisium an isolated oval on the right limb, Nubium and Humorum below; bright cratered highlands to the
  // south with Tycho's ray system splashed across them. Maria edges are warped by noise, never round blobs.
  return forge.generate('attic:moondisc:v2', {
    size: 1024, tile: false, normalStrength: 0.0,
    glsl: /* glsl */ `
float mare(vec2 p, vec2 c, vec2 r, float rot) { vec2 d = p - c; float cs = cos(rot), sn = sin(rot); d = vec2(cs * d.x - sn * d.y, sn * d.x + cs * d.y) / r; return 1.0 - length(d); }
void surface(vec2 uv, inout Surface s) {
  vec2 p = (uv - 0.5) * 2.0;
  float r = length(p);
  float disc = smoothstep(0.992, 0.978, r);
  float mu = sqrt(max(0.0, 1.0 - r * r));
  // sphere-projected coords so features foreshorten toward the limb
  vec2 q = p / max(0.35, pow(mu, 0.15));
  vec2 w = q + (vec2(fbm(q * 1.6 + 3.0, vec2(8.0), 5), fbm(q * 1.6 + 7.0, vec2(8.0), 5)) - 0.5) * 0.22;
  float m = -1.0;
  m = max(m, mare(w, vec2(-0.3, 0.38), vec2(0.3, 0.27), 0.2));        // Imbrium
  m = max(m, mare(w, vec2(-0.62, 0.05), vec2(0.26, 0.55), -0.15));    // Procellarum
  m = max(m, mare(w, vec2(0.12, 0.32), vec2(0.17, 0.16), 0.0));       // Serenitatis
  m = max(m, mare(w, vec2(0.28, 0.08), vec2(0.22, 0.17), 0.4));       // Tranquillitatis
  m = max(m, mare(w, vec2(0.66, 0.24), vec2(0.12, 0.09), 0.3));       // Crisium
  m = max(m, mare(w, vec2(0.45, -0.18), vec2(0.13, 0.17), -0.3));     // Fecunditatis
  m = max(m, mare(w, vec2(-0.2, -0.3), vec2(0.18, 0.13), 0.2));       // Nubium
  m = max(m, mare(w, vec2(-0.5, -0.36), vec2(0.1, 0.09), 0.0));       // Humorum
  m = max(m, mare(w, vec2(0.05, 0.62), vec2(0.3, 0.06), 0.05));       // Frigoris
  float mariaM = smoothstep(-0.05, 0.12, m + (fbm(w * 6.0, vec2(16.0), 4) - 0.5) * 0.25);
  float mTone = fbm(w * 3.0 + 1.0, vec2(8.0), 4);
  vec3 high = vec3(0.86, 0.85, 0.82) * (0.88 + 0.2 * fbm(q * 9.0 + 5.0, vec2(32.0), 4));
  vec3 low = vec3(0.42, 0.44, 0.47) * (0.85 + 0.3 * mTone);
  vec3 c = mix(high, low, mariaM * 0.92);
  // craters: two scales, much denser on the highlands; dark floors, a bright rim on the sun side
  for (int k = 0; k < 2; k++) {
    float sc = k == 0 ? 7.0 : 18.0;
    vec4 v = voronoi(q * sc + float(k) * 3.3, vec2(64.0), 0.95);
    float on = step(mix(0.55, 0.88, mariaM), hash12(v.zw + float(k)));
    float rr2 = 0.18 + 0.2 * hash12(v.zw * 1.7);
    float dd = v.x / rr2;
    float floorD = smoothstep(1.0, 0.6, dd);
    float rimB = smoothstep(0.75, 1.0, dd) * smoothstep(1.35, 1.0, dd);
    c *= 1.0 - floorD * on * (k == 0 ? 0.16 : 0.1);
    c += vec3(0.09) * rimB * on;
  }
  // Tycho and Copernicus with ray systems
  vec2 ty = q - vec2(-0.12, -0.58);
  float tycho = exp(-dot(ty, ty) * 260.0);
  float rays = pow(abs(sin(atan(ty.y, ty.x) * 11.0 + fbm(q * 4.0, vec2(8.0), 3) * 3.0)), 24.0) * exp(-length(ty) * 1.8);
  vec2 co = q - vec2(-0.32, 0.12);
  float cop = exp(-dot(co, co) * 500.0);
  float rays2 = pow(abs(sin(atan(co.y, co.x) * 8.0 + fbm(q * 5.0, vec2(8.0), 3) * 3.0)), 20.0) * exp(-length(co) * 4.0);
  c += vec3(0.55) * tycho + vec3(0.2) * rays + vec3(0.35) * cop + vec3(0.12) * rays2;
  c *= 0.95 + 0.06 * vnoise(p * 180.0, vec2(180.0));
  // limb darkening (the full moon is nearly flat, but the very edge falls off) and a faint cold rim
  c *= 0.62 + 0.38 * pow(mu, 0.35);
  c *= vec3(0.96, 0.98, 1.03);
  s.albedo = c;
  s.alpha = disc;
  s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** drifting cloud wisps for the layer in front of the moon: alpha in the albedo's alpha, tiles horizontally */
export function cloudWispTexture(forge, seed = 1) {
  return forge.generate(`attic:cloudwisp${seed}`, {
    size: 512, aspect: 2, normalStrength: 0.0, seed,
    uniforms: { uS: seed },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv * vec2(2.0, 1.0);
  float n = fbm(p * vec2(1.5, 3.0) + vec2(uS * 3.1, uS), vec2(3.0, 3.0), 6);
  float streak = fbm(vec2(p.x * 4.0, p.y * 14.0) + uS * 7.0, vec2(8.0, 14.0), 4);
  float band = smoothstep(0.0, 0.25, uv.y) * smoothstep(1.0, 0.75, uv.y);
  float a = smoothstep(0.42, 0.75, n * 0.8 + streak * 0.35) * band;
  s.albedo = vec3(0.5 + 0.5 * n);
  s.alpha = a;
  s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Grimy oculus glazing: dirt thickening toward the frame, rain runs, fly specks, and one cracked pane. RGBA. */
export function oculusGrimeTexture(forge) {
  return forge.canvas('attic:oculusgrime', 1024, 1024, (g, w, h) => {
    let sd = 41;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = w / 2;
    // radial dirt build-up against the outer frame and the inner ring
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    rg.addColorStop(0.0, 'rgba(46,44,40,0.12)'); rg.addColorStop(0.28, 'rgba(46,44,40,0.08)'); rg.addColorStop(0.34, 'rgba(46,44,40,0.35)'); rg.addColorStop(0.4, 'rgba(46,44,40,0.06)');
    rg.addColorStop(0.6, 'rgba(46,44,40,0.05)'); rg.addColorStop(0.82, 'rgba(40,38,34,0.25)'); rg.addColorStop(0.95, 'rgba(30,28,25,0.8)'); rg.addColorStop(1, 'rgba(30,28,25,0.9)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    // blotchy grime
    for (let i = 0; i < 260; i++) {
      const a = rnd() * Math.PI * 2, r = R * Math.sqrt(rnd());
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, s = 10 + rnd() * 60;
      const b = g.createRadialGradient(x, y, 0, x, y, s);
      b.addColorStop(0, `rgba(40,38,32,${(0.03 + rnd() * 0.08) * (0.3 + 0.7 * r / R)})`); b.addColorStop(1, 'rgba(40,38,32,0)');
      g.fillStyle = b; g.fillRect(x - s, y - s, s * 2, s * 2);
    }
    // rain runs: clean-ish channels with dirty edges dragging down
    for (let i = 0; i < 60; i++) {
      const x0 = rnd() * w, y0 = rnd() * h * 0.6, len = 60 + rnd() * 300;
      g.strokeStyle = `rgba(30,28,24,${0.12 + rnd() * 0.2})`; g.lineWidth = 1 + rnd() * 3;
      g.beginPath(); g.moveTo(x0, y0);
      let x = x0; for (let y = y0; y < y0 + len; y += 8) { x += (rnd() - 0.5) * 3; g.lineTo(x, y); }
      g.stroke();
    }
    // fly specks
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(15,12,10,${0.2 + rnd() * 0.4})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, 0.6 + rnd() * 1.6, 0, Math.PI * 2); g.fill(); }
    // cracked pane: a star of cracks in the lower-right pane, edges catching light
    const ox = cx + R * 0.48, oy = cy + R * 0.38;
    g.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      let a = k * 0.7 + rnd() * 0.4, x = ox, y = oy;
      const L = 60 + rnd() * 200;
      g.beginPath(); g.moveTo(x, y);
      for (let d = 0; d < L; d += 12) { a += (rnd() - 0.5) * 0.35; x += Math.cos(a) * 12; y += Math.sin(a) * 12; g.lineTo(x, y); }
      g.strokeStyle = 'rgba(210,220,240,0.85)'; g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = 'rgba(10,10,12,0.5)'; g.lineWidth = 3.5; g.globalCompositeOperation = 'destination-over'; g.stroke(); g.globalCompositeOperation = 'source-over';
    }
    for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(ox, oy, 18 + k * 26 + rnd() * 10, rnd() * 6, rnd() * 6 + 1.2); g.strokeStyle = 'rgba(200,210,235,0.5)'; g.lineWidth = 1.1; g.stroke(); }
    // two more damaged panes: a long running crack across the upper right, a small stone-strike star upper left
    const crackRun = (x, y, a, L, wl) => { g.beginPath(); g.moveTo(x, y); for (let d = 0; d < L; d += 10) { a += (rnd() - 0.5) * 0.25; x += Math.cos(a) * 10; y += Math.sin(a) * 10; g.lineTo(x, y); if (rnd() < 0.08) crackRun(x, y, a + (rnd() - 0.5) * 1.6, L * 0.25, wl * 0.7); } g.strokeStyle = 'rgba(10,10,12,0.45)'; g.lineWidth = wl * 2.2; g.stroke(); g.strokeStyle = 'rgba(215,225,245,0.8)'; g.lineWidth = wl; g.stroke(); };
    crackRun(cx + R * 0.15, cy - R * 0.85, 1.25, 330, 1.4);
    { const sx = cx - R * 0.45, sy = cy - R * 0.5; for (let k = 0; k < 7; k++) crackRun(sx, sy, k * 0.9 + rnd() * 0.3, 40 + rnd() * 90, 1.1); g.fillStyle = 'rgba(220,230,250,0.6)'; g.beginPath(); g.arc(sx, sy, 5, 0, Math.PI * 2); g.fill(); }
    // greasy smudges: a palm print where someone leaned to look out, finger drags
    { const px = cx + R * 0.05, py = cy + R * 0.62; const pg = g.createRadialGradient(px, py, 4, px, py, 46); pg.addColorStop(0, 'rgba(60,55,48,0.22)'); pg.addColorStop(1, 'rgba(60,55,48,0)'); g.fillStyle = pg; g.beginPath(); g.ellipse(px, py, 40, 50, 0.2, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 4; k++) { g.strokeStyle = 'rgba(60,55,48,0.16)'; g.lineWidth = 14; g.lineCap = 'round'; g.beginPath(); g.moveTo(px - 30 + k * 20, py - 40); g.lineTo(px - 34 + k * 22, py - 110 - k * 6); g.stroke(); } }
  }, { tile: false });
}

/**
 * World-space dust: a pale, rough, patchy layer that settles on every upward-facing surface
 * (vertex normal y), heavier in corners of the noise, thinner where hands and feet have been.
 * cfg: { amount 0..1, color [r,g,b] (linear-ish multiplier target), scale (patch size, m), clean: [[x,z,r]] wiped areas }
 */
export function addDust(mat, cfg = {}) {
  const { amount = 0.6, color = [0.36, 0.34, 0.31], scale = 1.6, threshold = 0.6, clean = [] } = cfg;
  const C = clean.slice(0, 4); while (C.length < 4) C.push([0, 0, 0]);
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uDuClean = { value: C.map((c) => new THREE.Vector3(...c)) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDuW; varying vec3 vDuN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvDuW = (modelMatrix * vec4(transformed, 1.0)).xyz; vDuN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vDuW; varying vec3 vDuN;
uniform vec3 uDuClean[4];
float duH(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float duN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(duH(i), duH(i + vec2(1, 0)), f.x), mix(duH(i + vec2(0, 1)), duH(i + vec2(1, 1)), f.x), f.y); }
float duF(vec2 p) { return 0.5 * duN(p) + 0.25 * duN(p * 2.07 + 1.3) + 0.125 * duN(p * 4.13 + 2.9) + 0.0625 * duN(p * 8.3 + 4.1); }
float gDust = 0.0;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  {
    vec2 dp = vDuW.xz / ${scale.toFixed(3)} + vDuW.y * 0.37;
    float up = smoothstep(${threshold.toFixed(3)}, ${(threshold + 0.25).toFixed(3)}, normalize(vDuN).y);
    float patchy = smoothstep(0.3, 0.75, duF(dp) + 0.25 * (duF(dp * 6.0 + 7.0) - 0.5));
    float fine = duN(vDuW.xz * 400.0);
    float wipe = 1.0;
    for (int i = 0; i < 4; i++) { if (uDuClean[i].z > 0.0) wipe *= smoothstep(uDuClean[i].z * 0.5, uDuClean[i].z, length(vDuW.xz - uDuClean[i].xy)); }
    gDust = up * patchy * wipe * ${amount.toFixed(3)} * (0.75 + 0.25 * fine);
    // a film, not paint: the grain and seams below still show through the dust
    vec3 duC = vec3(${color.map((c) => c.toFixed(3)).join(', ')}) * (0.9 + 0.2 * fine);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45 + duC * 0.7, gDust);
  }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 1.0, gDust);`);
  };
  mat.customProgramCacheKey = () => `${prevKey()}|dust:${amount}:${scale}:${threshold}:${color.join(',')}:${clean.length}`;
  mat.needsUpdate = true;
  return mat;
}

/** Decal sheet for the work surfaces (2x2 atlas): [0,0] ink spill + spatter, [1,0] cup rings + scorch, [0,1] wax drips, [1,1] tool scuffs. Alpha in the alpha channel. */
export function decalAtlasTexture(forge) {
  return forge.canvas('attic:decals', 1024, 1024, (g, w, h) => {
    let sd = 97;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    g.clearRect(0, 0, w, h);
    const Q = w / 2;
    const blob = (cx, cy, r, n, col, jag = 0.35) => {
      g.fillStyle = col; g.beginPath();
      for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; const rr = r * (1 - jag / 2 + jag * rnd()); i ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.closePath(); g.fill();
    };
    // [0,0] ink: a pool with a darker rim, runs, spatter
    g.save(); g.beginPath(); g.rect(0, 0, Q, Q); g.clip();
    blob(Q * 0.45, Q * 0.5, Q * 0.22, 40, 'rgba(12,10,20,0.55)');
    blob(Q * 0.45, Q * 0.5, Q * 0.15, 30, 'rgba(8,6,14,0.8)');
    g.strokeStyle = 'rgba(8,6,14,0.75)'; g.lineWidth = 6; g.beginPath(); g.moveTo(Q * 0.6, Q * 0.55); g.quadraticCurveTo(Q * 0.75, Q * 0.62, Q * 0.86, Q * 0.58); g.stroke();
    for (let i = 0; i < 70; i++) { const a = rnd() * 6.28, r = Q * (0.18 + rnd() * 0.3); blob(Q * 0.45 + Math.cos(a) * r, Q * 0.5 + Math.sin(a) * r, 2 + rnd() * 7, 8, `rgba(8,6,14,${0.4 + rnd() * 0.5})`); }
    g.restore();
    // [1,0] cup rings + a scorch from a set-down candle
    g.save(); g.translate(Q, 0); g.beginPath(); g.rect(0, 0, Q, Q); g.clip();
    for (const [x, y, r] of [[0.3, 0.3, 0.16], [0.42, 0.36, 0.15], [0.7, 0.68, 0.13]]) {
      g.strokeStyle = 'rgba(40,24,12,0.55)'; g.lineWidth = 5 + rnd() * 4; g.beginPath(); g.arc(Q * x, Q * y, Q * r, rnd() * 2, rnd() * 2 + 5.4); g.stroke();
      g.strokeStyle = 'rgba(40,24,12,0.25)'; g.lineWidth = 12; g.beginPath(); g.arc(Q * x, Q * y, Q * r - 6, 0, 6.28); g.stroke();
    }
    const sc = g.createRadialGradient(Q * 0.68, Q * 0.3, 0, Q * 0.68, Q * 0.3, Q * 0.16);
    sc.addColorStop(0, 'rgba(5,3,2,0.95)'); sc.addColorStop(0.5, 'rgba(20,10,4,0.6)'); sc.addColorStop(1, 'rgba(40,20,8,0)');
    g.fillStyle = sc; g.beginPath(); g.arc(Q * 0.68, Q * 0.3, Q * 0.16, 0, 6.28); g.fill();
    g.restore();
    // [0,1] wax: puddles and drips, cream, with thicker edges
    g.save(); g.translate(0, Q); g.beginPath(); g.rect(0, 0, Q, Q); g.clip();
    for (let i = 0; i < 9; i++) { const x = Q * (0.25 + rnd() * 0.5), y = Q * (0.25 + rnd() * 0.5); blob(x, y, Q * (0.03 + rnd() * 0.09), 24, `rgba(236,224,196,${0.75 + rnd() * 0.25})`, 0.5); }
    blob(Q * 0.5, Q * 0.5, Q * 0.14, 30, 'rgba(240,230,205,0.95)', 0.4);
    g.restore();
    // [1,1] tool scuffs, knife cuts, a ring of saw dust
    g.save(); g.translate(Q, Q); g.beginPath(); g.rect(0, 0, Q, Q); g.clip();
    for (let i = 0; i < 90; i++) {
      const x = rnd() * Q, y = rnd() * Q, a = (rnd() - 0.5) * 0.8 + (i % 3 ? 0 : 1.57), l = 10 + rnd() * 80;
      g.strokeStyle = rnd() < 0.5 ? `rgba(20,12,6,${0.25 + rnd() * 0.4})` : `rgba(220,190,150,${0.2 + rnd() * 0.3})`; g.lineWidth = 0.8 + rnd() * 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 18; i++) { const x = rnd() * Q, y = rnd() * Q; g.fillStyle = `rgba(20,12,6,${0.15 + rnd() * 0.2})`; g.beginPath(); g.ellipse(x, y, 4 + rnd() * 20, 2 + rnd() * 6, rnd() * 3, 0, 6.28); g.fill(); }
    g.restore();
  }, { tile: false });
}

/** Soot plume for the brick above the furnace door: black, feathered, rising and spreading. */
export function sootPlumeTexture(forge) {
  return forge.canvas('attic:soot', 512, 1024, (g, w, h) => {
    let sd = 13;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const t = rnd();                     // 0 = door head (bottom), 1 = top
      const y = h * (1 - t * 0.95), spread = w * (0.22 + 0.28 * t);
      const x = w / 2 + (rnd() - 0.5) * spread * 1.6 + Math.sin(t * 7 + i) * w * 0.04;
      const r = 20 + 60 * t * rnd() + 15;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const a = (0.1 + 0.15 * (1 - t)) * (0.5 + rnd() * 0.5);
      gr.addColorStop(0, `rgba(8,6,5,${a})`); gr.addColorStop(1, 'rgba(8,6,5,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // dense band right at the lintel
    const lb = g.createLinearGradient(0, h, 0, h * 0.82);
    lb.addColorStop(0, 'rgba(6,4,3,0.85)'); lb.addColorStop(1, 'rgba(6,4,3,0)');
    g.fillStyle = lb; g.fillRect(w * 0.12, h * 0.82, w * 0.76, h * 0.18);
  }, { tile: false });
}

/**
 * Old painted joinery: several coats of dull grey-green lead paint over oak, crazed into a
 * craquelure, flaking away in islands (lifted, pale edges) to show dark grain beneath, grime
 * packed into the cracks. 1 tile = 0.6 m; grain along V.
 */
export function peelingPaintTexture(forge, { key = 'peelPaint', paint = [0.34, 0.36, 0.31], wood = [0.16, 0.1, 0.06] } = {}) {
  return forge.generate(`attic:${key}`, {
    size: 1024, normalStrength: 3.0,
    uniforms: { uPaint: paint, uWood: wood },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  // wood beneath: grain along v
  float warp = fbm(uv * vec2(3.0, 1.0), vec2(3.0, 1.0), 3);
  float grain = 0.5 + 0.5 * sin((uv.x * 60.0 + warp * 6.0) * 3.14159);
  float fib = vnoise(uv * vec2(400.0, 20.0), vec2(400.0, 20.0));
  vec3 wood = uWood * (0.75 + 0.35 * grain) * (0.85 + 0.25 * fib);
  // craquelure: cells elongated along the grain
  float cr = voronoiEdge(uv * vec2(26.0, 9.0), vec2(26.0, 9.0), 0.9);
  float crack = smoothstep(0.06, 0.0, cr);
  // flaking: islands where the paint has let go
  float fl = fbm(uv * 1.0 + 3.7, vec2(5.0), 5) * 0.5 + 0.5;
  fl += (vnoise(uv * vec2(60.0, 22.0), vec2(60.0, 22.0)) - 0.5) * 0.16;
  float bare = smoothstep(0.66, 0.69, fl);
  float lift = smoothstep(0.6, 0.66, fl) * (1.0 - bare);                    // curling edge just before it goes
  // paint: two coats (green over cream) and chalky weathering
  float coat2 = smoothstep(0.58, 0.61, fl) * (1.0 - bare);
  vec3 p = uPaint * (0.85 + 0.2 * fbm(uv * 4.0, vec2(4.0), 3));
  p = mix(p, vec3(0.62, 0.58, 0.48), coat2 * 0.8);
  p = mix(p, p * 1.25 + 0.04, lift * 0.6);
  float grime = smoothstep(0.4, 0.85, fbmv(uv * 2.0 + 1.3, vec2(2.0), 4));
  p *= 1.0 - grime * 0.35;
  vec3 col = mix(p, wood, bare);
  col = mix(col, vec3(0.05, 0.04, 0.035), crack * (1.0 - bare) * 0.8);
  s.albedo = col;
  s.height = 0.5 + (1.0 - bare) * 0.25 + lift * 0.15 - crack * (1.0 - bare) * 0.12 + bare * grain * 0.05;
  s.rough = mix(mix(0.62, 0.85, grime), 0.88, bare);
  s.metal = 0.0;
  s.ao = 1.0 - crack * 0.4 - bare * 0.15;
}`,
  });
}

/** soft worn-path mask for a stair tread (alpha = wear): dark polished centre fading out to the dusty ends */
export function treadWearTexture(forge) {
  return forge.canvas('attic:treadwear', 256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const rg = g.createRadialGradient(w * 0.5, h * 0.62, 4, w * 0.5, h * 0.6, w * 0.42);
    rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.5, 'rgba(255,255,255,0.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.save(); g.scale(1, 0.75); g.fillRect(0, 0, w, h / 0.75); g.restore();
    let sd = 11; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.1 + rnd() * 0.2})`; g.fillRect(w * (0.25 + rnd() * 0.5), h * (0.25 + rnd() * 0.6), 1 + rnd() * 18, 1); }
  }, { tile: false });
}
