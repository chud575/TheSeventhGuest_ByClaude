import * as THREE from 'three';
import { createForge } from './forge.js';

/**
 * Procedural PBR texture definitions for the exterior (rendered by the engine's
 * TextureForge on the GPU). Each returns a TextureSet { map, normalMap, ormMap }.
 */

export function makeTextures(ctx) {
  const T = createForge(ctx);   // 16-bit height -> no contour-ring artefacts in the normals
  const big = ctx.quality.textureSize >= 2048 ? 2048 : 1024;

  // Clapboard siding: 1 tile = 2 m x 2 m, 15 boards. Deep grey-green paint gone chalky,
  // darker in the lap shadows, long rain streaks running down from above, a little
  // mildew low on the boards. No peel speckle: wear lives in low-frequency fields.
  const siding = T.generate('ext:siding3', {
    size: big, normalStrength: 3.2,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float boards = 15.0;
  float by = uv.y * boards;
  float row = floor(by);
  float f = fract(by);                 // 0 bottom (butt edge) .. 1 top (under the next board)
  float lap = smoothstep(0.0, 0.09, f);
  float prof = 1.0 - f * 0.85;         // wedge profile: thick butt, thin top
  float jx = uv.x * 1.5 + hash11(row * 1.7 + 0.3);
  float joint = 1.0 - smoothstep(0.0, 0.0035, abs(fract(jx) - 0.5));
  float grain = fbm(vec2(uv.x, uv.y) + vec2(row * 0.37, 0.0), vec2(3.0, 150.0), 4) * 0.5 + 0.5;
  float n = fbm(uv, vec2(3.0), 6) * 0.5 + 0.5;
  float n2 = fbm(uv + 3.7, vec2(9.0), 5) * 0.5 + 0.5;
  vec3 paint = vec3(0.205, 0.235, 0.215) * (0.92 + 0.16 * hash11(row * 3.1)) * (0.86 + 0.26 * n);
  // chalky bloom on the exposed board faces
  paint = mix(paint, vec3(0.30, 0.32, 0.30), smoothstep(0.55, 0.85, n2) * 0.35 * lap);
  // rain streaks: narrow vertical runs, strongest where water comes off the lap above
  float st = fbm(uv + vec2(0.0, 0.31), vec2(26.0, 1.0), 4) * 0.5 + 0.5;
  float st2 = fbm(uv + vec2(0.5, 0.0), vec2(61.0, 2.0), 3) * 0.5 + 0.5;
  float streak = smoothstep(0.52, 0.8, st) * (0.6 + 0.4 * st2);
  vec3 col = paint * (1.0 - streak * 0.45);
  // mildew: greenish-black blooms
  float mil = smoothstep(0.62, 0.8, fbm(uv + 9.1, vec2(4.0), 5) * 0.5 + 0.5);
  col = mix(col, vec3(0.06, 0.075, 0.055), mil * 0.5);
  // worn butt edges catch light: slightly paler, rougher
  float edge = smoothstep(0.12, 0.02, f) * lap;
  col = mix(col, col * 1.35 + 0.015, edge * 0.5 * (0.5 + 0.5 * n2));
  col *= mix(0.32, 1.0, lap);
  col *= 1.0 - joint * 0.6;
  col *= 0.96 + 0.08 * grain;
  s.albedo = col;
  s.height = prof * lap * 0.85 + grain * 0.015 - joint * 0.12;
  s.rough = 0.58 + 0.25 * streak + 0.12 * n2 + mil * 0.1;
  s.metal = 0.0;
  s.ao = mix(0.3, 1.0, lap) * (1.0 - joint * 0.5);
}` });

  // Slate roof: alternating bands of fish-scale and square slates (classic Second Empire
  // polychrome), lichen, some broken/missing slates. 1 tile = 1.5 m.
  const slate = T.generate('ext:slate2', {
    size: big, normalStrength: 3.5,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float rows = 10.0, cols = 7.0;
  float ry = uv.y * rows;
  float r = floor(ry);
  float fy = fract(ry);
  float off = mod(r, 2.0) * 0.5;
  float cx = uv.x * cols + off;
  float c = floor(cx);
  float fx = fract(cx);
  vec2 id = vec2(mod(c, cols), r);
  // band type: rows 0-3 square, 4-7 fish-scale, 8-9 hexagonal points
  float band = mod(r, 10.0);
  float shape;
  vec2 q = vec2(fx - 0.5, fy);
  if (band >= 3.0 && band < 7.0) shape = length(vec2(q.x, max(0.5 - q.y, 0.0))) - 0.48;
  else if (band >= 7.0 && band < 9.0) shape = max(abs(q.x) - 0.48, abs(q.x) * 0.8 - q.y + 0.03);
  else shape = max(abs(q.x) - 0.48, 0.02 - q.y);
  float gap = smoothstep(0.0, 0.035, -shape);
  float h1 = hash12(id + 0.17), h2 = hash12(id + 3.1);
  float n = fbm(uv, vec2(12.0), 5) * 0.5 + 0.5;
  vec3 base = mix(vec3(0.095, 0.10, 0.115), vec3(0.13, 0.12, 0.135), h1);
  base = mix(base, vec3(0.09, 0.11, 0.10), step(0.82, h2) * 0.6);   // the odd greenish slate
  base *= 0.85 + 0.3 * n;
  // lichen & moss
  float li = smoothstep(0.62, 0.8, fbm(uv + 2.7, vec2(5.0), 6) * 0.5 + 0.5);
  base = mix(base, vec3(0.32, 0.33, 0.25), li * 0.55 * smoothstep(0.2, 0.9, h2));
  // under-lap shadow toward the top of each slate (covered by the row above)
  float cover = smoothstep(0.55, 1.0, fy);
  vec3 col = base * mix(1.0, 0.55, cover);
  col = mix(vec3(0.02), col, gap);
  float missing = step(0.975, hash12(id + 9.0));
  col = mix(col, vec3(0.05, 0.04, 0.035), missing);
  s.albedo = col;
  s.height = gap * (0.45 + 0.5 * (1.0 - fy)) + n * 0.04 - missing * 0.4;
  s.rough = 0.55 + 0.25 * h1 + li * 0.2;
  s.metal = 0.0;
  s.ao = mix(0.3, 1.0, gap) * mix(1.0, 0.7, cover);
}` });

  // Bark: deep vertical fissures, ridges, lichen. 1 tile = 1 m around x 2 m along.
  const bark = T.generate('ext:bark3', {
    size: 1024, aspect: 0.5, normalStrength: 6.5,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv * vec2(1.0, 1.0);
  float warp = fbm(p * vec2(1.0, 0.5), vec2(4.0, 2.0), 4);
  float r = ridged(vec2(p.x + warp * 0.08, p.y * 0.25), vec2(9.0, 3.0), 6);
  float plates = voronoiEdge(vec2(p.x * 9.0 + warp, p.y * 4.0), vec2(9.0, 4.0), 0.9);
  float fiss = smoothstep(0.02, 0.2, plates);
  float n = fbm(p, vec2(16.0, 32.0), 5) * 0.5 + 0.5;
  float h = r * 0.45 + fiss * 0.55 + n * 0.1;
  h = pow(h, 1.4);   // deep, narrow fissures between broad corky plates
  vec3 col = mix(vec3(0.05, 0.045, 0.04), vec3(0.24, 0.22, 0.2), h);
  float li = smoothstep(0.6, 0.85, fbm(p + 4.0, vec2(6.0, 12.0), 5) * 0.5 + 0.5);
  col = mix(col, vec3(0.38, 0.4, 0.33), li * 0.5 * fiss);
  s.albedo = col;
  s.height = h;
  s.rough = 0.9;
  s.metal = 0.0;
  s.ao = mix(0.35, 1.0, h);
}` });

  // Ground: matted dead turf combed flat by wind and rain (long strands in a slowly
  // turning direction field, not a cross-hatch), damp bare soil in patches, domed
  // pebbles, fallen twigs and leaf fragments. 1 tile = 6 m.
  const ground = T.generate('ext:ground7', {
    size: big, normalStrength: 1.4,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float n1 = fbm(uv, vec2(4.0), 6) * 0.5 + 0.5;
  float n2 = fbm(uv + 3.0, vec2(16.0), 5) * 0.5 + 0.5;
  float n3 = fbm(uv + 7.0, vec2(48.0), 4) * 0.5 + 0.5;
  // matted straw: clumps (Voronoi cells) each flattened in its own direction, two
  // overlapping clump scales so no coherent swirl/contour pattern can form
  vec4 cA = voronoi(uv * 18.0, vec2(18.0), 1.0);
  vec4 cB = voronoi(uv * 31.0 + 0.5, vec2(31.0), 1.0);
  float aA = hash12(cA.zw) * 6.2831, aB = hash12(cB.zw + 3.0) * 6.2831;
  vec2 q = uv * 160.0;
  vec2 dA = vec2(cos(aA), sin(aA)), dB = vec2(cos(aB), sin(aB));
  float str1 = vnoise(vec2(dot(q, vec2(-dA.y, dA.x)) * 3.4, dot(q, dA) * 0.3) + cA.zw * 13.0, vec2(1e4));
  float str2 = vnoise(vec2(dot(q, vec2(-dB.y, dB.x)) * 5.0, dot(q, dB) * 0.4) + cB.zw * 7.0, vec2(1e4));
  float wB = smoothstep(0.35, 0.65, hash12(cB.zw + 9.0));
  float strands = smoothstep(0.4, 0.9, mix(str1, str2, wB * 0.6));
  vec3 straw = mix(vec3(0.13, 0.115, 0.08), vec3(0.25, 0.22, 0.15), strands) * (0.75 + 0.4 * n2);
  straw = mix(straw, vec3(0.08, 0.09, 0.06), smoothstep(0.5, 0.78, n1) * 0.55);   // damp greener hollows
  // bare soil patches with fine grit
  float bare = smoothstep(0.58, 0.72, fbm(uv + 9.0, vec2(3.0), 6) * 0.5 + 0.5 + (n3 - 0.5) * 0.2);
  vec3 soil = mix(vec3(0.055, 0.045, 0.035), vec3(0.11, 0.09, 0.07), n3);
  // domed pebbles (smooth caps, no hard rims)
  vec4 pv = voronoi(uv * 70.0, vec2(70.0), 1.0);
  float pr = 0.18 + 0.2 * hash12(pv.zw + 1.0);
  float pd = clamp(1.0 - pv.x / pr, 0.0, 1.0);
  float peb = step(0.84, hash12(pv.zw + 5.0)) * (0.35 + 0.65 * bare);
  float dome = sqrt(pd) * peb;
  // twigs: thin dark segments
  vec4 tv = voronoi(uv * 22.0, vec2(22.0), 1.0);
  float ta = hash12(tv.zw) * 6.2831;
  vec2 tl = (fract(uv * 22.0) - 0.5);
  float tw = abs(dot(tl, vec2(-sin(ta), cos(ta)))) ;
  float twig = (1.0 - smoothstep(0.006, 0.016, tw)) * step(abs(dot(tl, vec2(cos(ta), sin(ta)))), 0.32) * step(0.8, hash12(tv.zw + 3.0));
  // leaf fragments (flat colour flecks)
  vec4 lv = voronoi(uv * 55.0, vec2(55.0), 1.0);
  float leaf = smoothstep(0.32, 0.22, lv.x + (n3 - 0.5) * 0.12) * step(0.86, hash12(lv.zw));
  vec3 leafC = mix(vec3(0.14, 0.075, 0.035), vec3(0.22, 0.14, 0.07), hash12(lv.zw + 1.0));
  vec3 col = mix(straw, soil, bare);
  col = mix(col, leafC, leaf * 0.7);
  col = mix(col, vec3(0.2, 0.195, 0.185) * (0.6 + 0.5 * hash12(pv.zw)), smoothstep(0.0, 0.25, dome));
  col = mix(col, vec3(0.05, 0.04, 0.03), twig * 0.85);
  col *= 0.86 + 0.2 * n3;
  s.albedo = col;
  s.height = 0.4 + strands * 0.025 * (1.0 - bare) + dome * 0.18 + twig * 0.04 + n2 * 0.1 + n3 * 0.03;
  s.rough = 0.95 - dome * 0.15;
  s.metal = 0.0;
  s.ao = 0.75 + 0.25 * s.height;
}` });

  // Carriage drive: packed gravel with two wheel ruts (puddled, mirror-wet), a mossy crown
  // between them, scattered larger cobbles, ragged grass-eaten verges. u across (2.5 m), v along (5 m/tile).
  const path = T.generate('ext:path5', {
    size: 1024, aspect: 0.5, tile: true, normalStrength: 2.6,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = vec2(uv.x * 1.0, uv.y * 2.0);
  float n = fbm(p, vec2(8.0, 16.0), 5) * 0.5 + 0.5;
  float nf = fbm(p + 1.9, vec2(40.0, 80.0), 3) * 0.5 + 0.5;
  float wob = (fbm(vec2(0.0, p.y * 3.0), vec2(1.0, 6.0), 3)) * 0.035;
  float u = uv.x + wob;
  float rutD = min(abs(u - 0.29), abs(u - 0.71));
  float rut = 1.0 - smoothstep(0.03, 0.09, rutD + (n - 0.5) * 0.03);
  float crown = smoothstep(0.13, 0.05, abs(u - 0.5) + (n - 0.5) * 0.06);
  // gravel: fine grit, pea gravel, and a few half-buried cobbles (domed Voronoi cells)
  vec4 g1 = voronoi(p * 70.0, vec2(70.0, 140.0), 1.0);
  vec4 g2 = voronoi(p * 26.0, vec2(26.0, 52.0), 0.95);
  vec4 g3 = voronoi(p * 8.0, vec2(8.0, 16.0), 0.85);
  float d1 = clamp(1.0 - g1.x / 0.5, 0.0, 1.0);
  float d2 = clamp(1.0 - g2.x / (0.32 + 0.12 * hash12(g2.zw + 4.0)), 0.0, 1.0) * step(0.35, hash12(g2.zw));
  float d3 = clamp(1.0 - g3.x / 0.3, 0.0, 1.0) * step(0.78, hash12(g3.zw + 2.0)) * (1.0 - rut);
  float s1 = sqrt(d1), s2 = sqrt(d2), s3 = sqrt(d3);
  vec3 grit = vec3(0.10, 0.095, 0.088) * (0.7 + 0.6 * nf);
  vec3 grav = mix(grit, vec3(0.30, 0.29, 0.27) * (0.6 + 0.7 * hash12(g1.zw)), smoothstep(0.05, 0.4, s1) * 0.8);
  vec3 pebC = mix(vec3(0.36, 0.34, 0.31), vec3(0.28, 0.29, 0.31), hash12(g2.zw + 7.0)) * (0.65 + 0.6 * hash12(g2.zw + 1.0));
  grav = mix(grav, pebC, smoothstep(0.02, 0.3, s2));
  grav = mix(grav, vec3(0.38, 0.37, 0.35) * (0.7 + 0.45 * hash12(g3.zw + 3.0)), smoothstep(0.02, 0.2, s3));
  grav *= 0.78 + 0.35 * n;
  // ruts: compacted dark mud, puddles in the low spots (mirror-wet), damp rims round them
  vec3 mud = vec3(0.055, 0.048, 0.04) * (0.8 + 0.4 * n);
  float pn = fbm(p + 3.3, vec2(4.0, 8.0), 5) * 0.5 + 0.5;
  float pud = smoothstep(0.47, 0.53, pn + rut * 0.08 - crown * 0.2) * smoothstep(0.2, 0.8, rut + 0.15 * (1.0 - crown));
  float damp = smoothstep(0.38, 0.5, pn) * (1.0 - pud);
  vec3 col = mix(grav, mud, rut * 0.85);
  // mossy crown with straw
  float straw = vnoise(vec2(p.x * 300.0, p.y * 30.0), vec2(1e4));
  vec3 moss = mix(vec3(0.05, 0.065, 0.035), vec3(0.15, 0.14, 0.09), straw);
  col = mix(col, moss, crown * smoothstep(0.35, 0.65, n) * 0.8);
  col *= 1.0 - damp * 0.35;
  col = mix(col, vec3(0.02, 0.022, 0.026), pud * 0.92);
  // ragged edges, eaten by grass
  float e = min(uv.x, 1.0 - uv.x);
  float rag = fbm(vec2(uv.x * 0.2, p.y * 3.0), vec2(1.0, 6.0), 5) * 0.07 + (nf - 0.5) * 0.03;
  s.alpha = smoothstep(0.03, 0.1, e + rag);
  col = mix(vec3(0.085, 0.08, 0.055), col, smoothstep(0.05, 0.18, e + rag));
  s.albedo = col;
  float hgt = 0.35 + s1 * 0.05 + s2 * 0.12 + s3 * 0.22 + nf * 0.02 - rut * 0.12;
  s.height = mix(hgt, 0.3 - rut * 0.1, pud);   // puddles are flat
  s.rough = mix(mix(0.86, 0.66, rut) - damp * 0.25 - s2 * 0.08, 0.06, pud);
  s.metal = 0.0;
  s.ao = mix(0.5, 1.0, max(s1, s2)) * (1.0 - rut * 0.15);
}` });

  // Weathered dressed stone blocks for the foundation, piers, steps. 1 tile = 2 m.
  const ashlar = T.generate('ext:ashlar2', {
    size: 1024, normalStrength: 3.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float rows = 5.0;
  float r = floor(uv.y * rows);
  float cols = 2.0 + mod(r, 2.0);
  vec2 g = vec2(uv.x * 3.0 + hash11(r) * 0.7, uv.y * rows);
  vec2 id = vec2(mod(floor(g.x), 3.0), r);
  vec2 f = fract(g);
  vec2 sz = vec2(1.0 / 3.0, 1.0 / rows);
  float n = fbm(uv, vec2(10.0), 6) * 0.5 + 0.5;
  float e = min(min(f.x, 1.0 - f.x) * sz.x, min(f.y, 1.0 - f.y) * sz.y) + (n - 0.5) * 0.006;
  float joint = 1.0 - smoothstep(0.003, 0.008, e);
  float chisel = smoothstep(0.008, 0.03, e);
  float pit = fbm(uv + id.x * 0.3, vec2(48.0), 4);
  vec3 col = vec3(0.30, 0.29, 0.28) * (0.78 + 0.35 * hash12(id)) * (0.75 + 0.4 * n);
  float moss = smoothstep(0.6, 0.85, fbm(uv + 6.0, vec2(4.0), 5) * 0.5 + 0.5 + (1.0 - chisel) * 0.25);
  col = mix(col, vec3(0.13, 0.16, 0.08), moss * 0.6);
  float stain = smoothstep(0.3, 1.0, fbm(vec2(uv.x * 8.0, uv.y * 0.5), vec2(16.0, 1.0), 4) * 0.5 + 0.5);
  col *= 0.8 + 0.25 * stain;
  col = mix(col, vec3(0.04), joint * 0.8);
  s.albedo = col;
  s.height = 0.3 + 0.5 * chisel + pit * 0.06 - joint * 0.3;
  s.rough = 0.88;
  s.metal = 0.0;
  s.ao = mix(0.4, 1.0, chisel);
}` });

  // Painted trim wood (bargeboards, casings, cornices): bone-white lead paint gone grey
  // with grime, darker in long vertical runs and soft blotches, fine grain showing
  // through, no speckles. Lighter than the body so the trim reads as trim.
  const trim = T.generate('ext:trim4', {
    size: 1024, normalStrength: 1.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float grain = fbm(uv, vec2(3.0, 60.0), 5) * 0.5 + 0.5;
  float n = fbm(uv, vec2(3.0), 6) * 0.5 + 0.5;
  float n2 = fbm(uv + 5.3, vec2(8.0), 5) * 0.5 + 0.5;
  vec3 paint = vec3(0.50, 0.49, 0.455) * (0.88 + 0.2 * n);
  float st = fbm(uv + vec2(0.13, 0.0), vec2(14.0, 1.0), 4) * 0.5 + 0.5;
  float streak = smoothstep(0.5, 0.82, st);
  vec3 col = paint * (1.0 - streak * 0.4);
  float grime = smoothstep(0.45, 0.85, n2);
  col = mix(col, vec3(0.17, 0.165, 0.15), grime * 0.45);
  // alligatored paint: faint crazing lines
  float craze = voronoiEdge(uv * 6.0, vec2(6.0, 6.0) * 1.0, 0.9);
  float crack = 1.0 - smoothstep(0.0, 0.03, craze);
  col *= 1.0 - crack * 0.11 * (0.4 + n2);
  col *= 0.94 + 0.12 * grain;
  s.albedo = col;
  s.height = grain * 0.04 + n * 0.03;   // crazing stays in albedo only (normal edges sparkled at grazing angles)
  s.rough = 0.5 + 0.3 * streak + 0.15 * grime;
  s.metal = 0.0;
  s.ao = 1.0 - crack * 0.25;
}` });

  // Varnished front-door wood: dark mahogany, straight quartersawn grain with ray fleck,
  // a little crazing in the old varnish, worn paler near the edges. Glossy (0.35-0.5).
  const doorWood = T.generate('ext:doorWood3', {
    size: 1024, normalStrength: 2.6,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  // grain runs along v (door leaves are tall); warped growth lines, not stripes
  float w = fbm(uv, vec2(3.0, 1.0), 4);
  float lines = fbm(vec2(uv.x + w * 0.08, uv.y * 0.05), vec2(24.0, 1.0), 4) * 0.5 + 0.5;
  float fine = fbm(uv, vec2(60.0, 4.0), 3) * 0.5 + 0.5;
  float fleck = smoothstep(0.78, 0.92, fbm(uv + 2.0, vec2(40.0, 6.0), 3) * 0.5 + 0.5);
  vec3 a = vec3(0.13, 0.055, 0.03), b = vec3(0.24, 0.11, 0.055);
  vec3 col = mix(a, b, smoothstep(0.3, 0.75, lines) * 0.7 + fine * 0.3);
  col = mix(col, vec3(0.3, 0.16, 0.08), fleck * 0.25);
  float n = fbm(uv + 7.0, vec2(3.0), 4) * 0.5 + 0.5;
  col *= 0.85 + 0.3 * n;
  float craze = 1.0 - smoothstep(0.0, 0.015, voronoiEdge(uv * 12.0, vec2(12.0), 0.9));
  col *= 1.0 - craze * 0.15;
  // wear: dings and scuffs in the varnish (paler, matte), worn patches where hands push
  vec4 dv = voronoi(uv * 26.0, vec2(26.0), 1.0);
  float ding = smoothstep(0.16, 0.04, dv.x) * step(0.86, hash12(dv.zw));
  float worn = smoothstep(0.6, 0.85, fbm(uv + 3.3, vec2(5.0), 5) * 0.5 + 0.5);
  col = mix(col, col * 1.45 + vec3(0.03, 0.015, 0.0), worn * 0.45);
  col = mix(col, vec3(0.06, 0.03, 0.015), ding * 0.6);
  s.albedo = col;
  s.height = lines * 0.05 + fine * 0.03 - craze * 0.02 - ding * 0.06;
  s.rough = 0.34 + 0.16 * n + craze * 0.15 + worn * 0.25 + ding * 0.2;
  s.metal = 0.0;
  s.ao = 1.0;
}` });

  // Worn bluestone step treads / porch stone: paler, polished in the walking line,
  // chipped darker arrises, damp at the risers. 1 tile = 1 m.
  const stepStone = T.generate('ext:stepStone1', {
    size: 1024, normalStrength: 2.4,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float n = fbm(uv, vec2(4.0), 6) * 0.5 + 0.5;
  float n2 = fbm(uv + 2.3, vec2(16.0), 5) * 0.5 + 0.5;
  float pits = smoothstep(0.66, 0.82, fbm(uv + 4.4, vec2(48.0), 4) * 0.5 + 0.5);
  vec3 col = mix(vec3(0.33, 0.33, 0.32), vec3(0.50, 0.49, 0.46), n) * (0.88 + 0.2 * n2);
  float lich = smoothstep(0.66, 0.8, fbm(uv + 8.8, vec2(6.0), 5) * 0.5 + 0.5);
  col = mix(col, vec3(0.42, 0.45, 0.36), lich * 0.4);
  float stain = smoothstep(0.5, 0.9, fbm(uv + 1.1, vec2(3.0, 1.0), 4) * 0.5 + 0.5);
  col *= 1.0 - stain * 0.35;
  col *= 1.0 - pits * 0.4;
  s.albedo = col;
  s.height = 0.5 + n * 0.2 + n2 * 0.08 - pits * 0.2;
  s.rough = 0.62 + 0.22 * n2 + pits * 0.1 - (1.0 - stain) * 0.08;
  s.metal = 0.0;
  s.ao = 1.0 - pits * 0.3;
}` });

  // Cast iron: black-lead paint over pitted iron, rust blooms and long orange-brown
  // rust runs bleeding down from joints (vertical streaks), a little raised scale.
  const iron = T.generate('ext:iron3', {
    size: 512, normalStrength: 1.4,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float n = fbm(uv, vec2(8.0), 6) * 0.5 + 0.5;
  float rust = smoothstep(0.6, 0.8, fbm(uv + 3.0, vec2(6.0), 6) * 0.5 + 0.5);
  float run = smoothstep(0.55, 0.85, fbm(uv + 1.7, vec2(18.0, 1.0), 4) * 0.5 + 0.5) * (0.5 + 0.5 * n);
  vec3 col = mix(vec3(0.03, 0.03, 0.034), vec3(0.075, 0.072, 0.075), n);
  col = mix(col, vec3(0.16, 0.075, 0.035), run * 0.55);
  col = mix(col, vec3(0.22, 0.10, 0.045), rust * 0.75);
  s.albedo = col;
  s.height = n * 0.3 + rust * 0.15;
  s.rough = mix(0.42, 0.92, max(rust, run * 0.7));
  s.metal = mix(0.8, 0.15, max(rust, run * 0.6));
  s.ao = 1.0;
}` });

  // Weathered field rock: lichen blotches, moss in the crevices. Triplanar-ish box UVs, 1 tile = 2 m.
  const rock = T.generate('ext:rock1', {
    size: 1024, normalStrength: 4.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float n = fbm(uv, vec2(6.0), 7) * 0.5 + 0.5;
  float r = ridged(uv + 1.7, vec2(4.0), 6);
  float cr = voronoiEdge(uv * 5.0, vec2(5.0), 0.9);
  float crack = (1.0 - smoothstep(0.0, 0.025, cr + (n - 0.5) * 0.05)) * smoothstep(0.45, 0.6, fbm(uv + 2.2, vec2(3.0), 4) * 0.5 + 0.5);
  vec3 col = mix(vec3(0.16, 0.16, 0.155), vec3(0.34, 0.33, 0.31), n) * (0.8 + 0.3 * r);
  float lich = smoothstep(0.6, 0.75, fbm(uv + 4.2, vec2(10.0), 5) * 0.5 + 0.5);
  col = mix(col, vec3(0.52, 0.53, 0.46), lich * 0.5);
  float moss = smoothstep(0.55, 0.8, fbm(uv + 8.1, vec2(5.0), 5) * 0.5 + 0.5 + crack * 0.3);
  col = mix(col, vec3(0.1, 0.13, 0.06), moss * 0.7);
  col *= 1.0 - crack * 0.6;
  s.albedo = col;
  s.height = r * 0.5 + n * 0.4 - crack * 0.35 + lich * 0.03;
  s.rough = 0.88 - lich * 0.05;
  s.metal = 0.0;
  s.ao = mix(0.4, 1.0, 1.0 - crack);
}` });

  // Tooled limestone without joints (geometry supplies the blocks): pitted, lichen
  // rosettes, black rain streaks, a little orange iron staining. 1 tile = 1 m.
  const limestone = T.generate('ext:limestone1', {
    size: 1024, normalStrength: 3.5,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float n = fbm(uv, vec2(5.0), 6) * 0.5 + 0.5;
  float n2 = fbm(uv + 4.1, vec2(20.0), 5) * 0.5 + 0.5;
  // tooling: fine parallel chisel strokes in patches
  float tool = vnoise(vec2(uv.x * 260.0 + n * 6.0, uv.y * 14.0), vec2(1e4));
  float pits = smoothstep(0.62, 0.8, fbm(uv + 1.7, vec2(60.0), 4) * 0.5 + 0.5);
  vec3 col = mix(vec3(0.27, 0.26, 0.24), vec3(0.42, 0.40, 0.36), n) * (0.85 + 0.25 * n2);
  col *= 0.94 + 0.08 * tool;
  // lichen rosettes (pale grey-green) and dark moss
  vec4 lv = voronoi(uv * 9.0, vec2(9.0), 1.0);
  float lich = smoothstep(0.42, 0.2, lv.x) * step(0.72, hash12(lv.zw)) * smoothstep(0.4, 0.7, n2);
  col = mix(col, vec3(0.55, 0.57, 0.48), lich * 0.6);
  float moss = smoothstep(0.62, 0.82, fbm(uv + 7.7, vec2(4.0), 5) * 0.5 + 0.5);
  col = mix(col, vec3(0.08, 0.1, 0.05), moss * 0.55);
  // black vertical rain streaks
  float streak = smoothstep(0.55, 0.95, fbm(vec2(uv.x * 14.0, uv.y * 0.7), vec2(14.0, 1.0), 4) * 0.5 + 0.5);
  col *= 1.0 - streak * 0.55;
  float rust = smoothstep(0.75, 0.9, fbm(vec2(uv.x * 6.0, uv.y * 1.2) + 9.0, vec2(6.0, 1.0), 4) * 0.5 + 0.5);
  col = mix(col, col * vec3(1.25, 0.85, 0.6), rust * 0.5);
  col *= 1.0 - pits * 0.45;
  s.albedo = col;
  s.height = 0.5 + n * 0.25 + tool * 0.03 - pits * 0.2 + lich * 0.05;
  s.rough = 0.9 - lich * 0.05;
  s.metal = 0.0;
  s.ao = 1.0 - pits * 0.4;
}` });

  // Granite headstones: grey speckled granite and pale limestone variants share one map;
  // 1 tile = 1 m. Lichen blooms, dark damp toward the base handled by grime chunk.
  const granite = T.generate('ext:granite2', {
    size: 1024, normalStrength: 2.5,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float n = fbm(uv, vec2(4.0), 6) * 0.5 + 0.5;
  float n3 = fbm(uv + 8.0, vec2(16.0), 4) * 0.5 + 0.5;
  vec4 c1 = voronoi(uv * 160.0, vec2(160.0), 1.0);
  float h1 = hash12(c1.zw);
  // weathered grey granite: fine low-contrast speckle under a soft mottling
  vec3 col = vec3(0.34, 0.335, 0.33) * (0.82 + 0.3 * n) * (0.92 + 0.12 * n3);
  col *= 1.0 - step(0.86, h1) * 0.35;
  col *= 1.0 + step(h1, 0.06) * 0.25;
  // lichen: irregular crusty patches (grey-green and the odd ochre), stronger on the top
  float ln = fbm(uv * 1.0 + 3.3, vec2(7.0), 6) * 0.5 + 0.5;
  float lich = smoothstep(0.6, 0.66, ln + (n3 - 0.5) * 0.12);
  float ochre = step(0.75, fbm(uv + 1.1, vec2(3.0), 3) * 0.5 + 0.5);
  col = mix(col, mix(vec3(0.46, 0.48, 0.4), vec3(0.45, 0.38, 0.2), ochre), lich * 0.7);
  float moss = smoothstep(0.64, 0.86, fbm(uv + 2.2, vec2(5.0), 5) * 0.5 + 0.5);
  col = mix(col, vec3(0.07, 0.09, 0.05), moss * 0.55);
  float streak = smoothstep(0.6, 0.95, fbm(vec2(uv.x * 10.0, uv.y * 0.8), vec2(10.0, 1.0), 4) * 0.5 + 0.5);
  col *= 1.0 - streak * 0.4;
  s.albedo = col;
  s.height = 0.5 + n * 0.15 + lich * 0.1 + n3 * 0.05;
  s.rough = 0.78 + lich * 0.15;
  s.metal = 0.0;
  s.ao = 1.0;
}` });

  return { siding, slate, bark, ground, path, ashlar, trim, iron, rock, limestone, granite, doorWood, stepStone };
}

/** Build a MeshStandardMaterial from a forge TextureSet. */
export function pbr(set, { repeat = [1, 1], color = 0xffffff, roughness = 1, metalness = 1, normalScale = 1, envMapIntensity = 1, side, alphaTest = 0, name = 'pbr', physical = false, ...rest } = {}) {
  const maps = (repeat[0] !== 1 || repeat[1] !== 1) ? set.withRepeat(repeat[0], repeat[1]) : set;
  const M = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new M({
    map: maps.map, normalMap: maps.normalMap, roughnessMap: maps.roughnessMap, metalnessMap: maps.metalnessMap, aoMap: maps.aoMap,
    color: new THREE.Color(color), roughness, metalness, normalScale: new THREE.Vector2(normalScale, normalScale),
    envMapIntensity, side: side ?? THREE.FrontSide, alphaTest, name, ...rest,
  });
  return m;
}
