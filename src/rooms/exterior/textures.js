import * as THREE from 'three';

/**
 * Procedural PBR texture definitions for the exterior (rendered by the engine's
 * TextureForge on the GPU). Each returns a TextureSet { map, normalMap, ormMap }.
 */

export function makeTextures(ctx) {
  const T = ctx.textures;
  const big = ctx.quality.textureSize >= 2048 ? 2048 : 1024;

  // Clapboard siding: 1 tile = 2 m x 2 m, 12 boards. Dark blue-grey paint, weathered,
  // peeling to silver wood, rain streaks below sills.
  const siding = T.generate('ext:siding2', {
    size: big, normalStrength: 3.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float boards = 12.0;
  float by = uv.y * boards;
  float row = floor(by);
  float f = fract(by);                 // 0 bottom edge .. 1 top (under next board)
  // board profile: thick bottom edge, thin top; shadow line under each lap
  float prof = 0.55 + 0.45 * (1.0 - f);
  float lap = smoothstep(0.0, 0.06, f);
  // board butt joints, staggered
  float jx = uv.x * 2.0 + hash11(row) * 1.0;
  float joint = smoothstep(0.004, 0.0, abs(fract(jx) - 0.5) - 0.0) ;
  float grain = fbm(vec2(uv.x * 1.0, uv.y * 24.0) + vec2(row * 0.37, 0.0), vec2(4.0, 96.0), 5);
  float n = fbm(uv, vec2(6.0), 6) * 0.5 + 0.5;
  vec3 paint = vec3(0.17, 0.19, 0.235) * (0.85 + 0.3 * hash11(row * 3.1));
  paint *= 0.88 + 0.24 * n;
  vec3 wood = vec3(0.34, 0.33, 0.31) * (0.8 + 0.3 * grain);
  // peeling: patches of exposed weathered wood with flaky edges
  float peelN = fbm(uv * vec2(1.0, 1.0) + 7.3, vec2(5.0), 6) * 0.5 + 0.5;
  float peel = smoothstep(0.66, 0.70, peelN + grain * 0.08);
  float peelEdge = smoothstep(0.62, 0.66, peelN + grain * 0.08) - peel;
  // vertical grime streaks
  float streak = fbm(vec2(uv.x * 16.0, uv.y * 0.6), vec2(32.0, 2.0), 4) * 0.5 + 0.5;
  vec3 col = mix(paint, wood, peel);
  col = mix(col, col * 1.25 + 0.03, peelEdge * 0.8);
  col *= 0.75 + 0.35 * smoothstep(0.2, 0.8, streak);
  col *= mix(0.45, 1.0, lap);
  col *= 1.0 - joint * 0.5;
  s.albedo = col;
  s.height = prof * lap * 0.8 + grain * 0.03 + (1.0 - peel) * 0.03 - joint * 0.1;
  s.rough = mix(0.62, 0.9, peel) + streak * 0.05;
  s.metal = 0.0;
  s.ao = mix(0.35, 1.0, lap) * (1.0 - joint * 0.4);
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
  const bark = T.generate('ext:bark2', {
    size: 1024, aspect: 0.5, normalStrength: 5.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv * vec2(1.0, 1.0);
  float warp = fbm(p * vec2(1.0, 0.5), vec2(4.0, 2.0), 4);
  float r = ridged(vec2(p.x + warp * 0.08, p.y * 0.25), vec2(9.0, 3.0), 6);
  float plates = voronoiEdge(vec2(p.x * 9.0 + warp, p.y * 4.0), vec2(9.0, 4.0), 0.9);
  float fiss = smoothstep(0.02, 0.2, plates);
  float n = fbm(p, vec2(16.0, 32.0), 5) * 0.5 + 0.5;
  float h = r * 0.6 + fiss * 0.4 + n * 0.1;
  vec3 col = mix(vec3(0.05, 0.045, 0.04), vec3(0.24, 0.22, 0.2), h);
  float li = smoothstep(0.6, 0.85, fbm(p + 4.0, vec2(6.0, 12.0), 5) * 0.5 + 0.5);
  col = mix(col, vec3(0.38, 0.4, 0.33), li * 0.5 * fiss);
  s.albedo = col;
  s.height = h;
  s.rough = 0.9;
  s.metal = 0.0;
  s.ao = mix(0.35, 1.0, h);
}` });

  // Ground: matted dead grass, bare earth, leaf litter, pebbles. 1 tile = 6 m.
  const ground = T.generate('ext:ground4', {
    size: big, normalStrength: 2.2,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float n1 = fbm(uv, vec2(4.0), 6) * 0.5 + 0.5;
  float n2 = fbm(uv + 3.0, vec2(16.0), 5) * 0.5 + 0.5;
  // matted thatch: short anisotropic streaks in a few clump directions (voronoi cells)
  vec4 cl = voronoi(uv * 24.0, vec2(24.0), 1.0);
  float ca = hash12(cl.zw) * 6.2831;
  vec2 dir = vec2(cos(ca), sin(ca));
  vec2 q = uv * 24.0;
  float along = dot(q, dir), acr = dot(q, vec2(-dir.y, dir.x));
  float thatch = vnoise(vec2(acr * 30.0, along * 3.0) + cl.zw * 17.0, vec2(1e4)) ;
  thatch = smoothstep(0.2, 0.9, thatch) * 0.6 + 0.2;
  float fine = fbm(uv * vec2(1.0), vec2(128.0), 3) * 0.5 + 0.5;
  vec3 straw = mix(vec3(0.16, 0.15, 0.11), vec3(0.27, 0.25, 0.18), thatch) * (0.8 + 0.35 * n2);
  straw = mix(straw, vec3(0.09, 0.105, 0.075), smoothstep(0.5, 0.75, n1) * 0.65);   // damp greener hollows
  vec3 dirt = mix(vec3(0.07, 0.06, 0.05), vec3(0.13, 0.11, 0.09), fine);
  float bare = smoothstep(0.6, 0.74, fbm(uv + 9.0, vec2(3.0), 6) * 0.5 + 0.5 + (fine - 0.5) * 0.15);
  // leaves
  vec4 v = voronoi(uv * 60.0, vec2(60.0), 1.0);
  float leaf = smoothstep(0.3, 0.16, v.x) * step(0.88, hash12(v.zw));
  vec3 leafC = mix(vec3(0.17, 0.09, 0.04), vec3(0.26, 0.17, 0.08), hash12(v.zw + 1.0));
  // pebbles
  vec4 pv = voronoi(uv * 90.0, vec2(90.0), 1.0);
  float peb = smoothstep(0.25, 0.12, pv.x) * step(0.9, hash12(pv.zw + 5.0)) * bare;
  vec3 col = mix(straw, dirt, bare);
  col = mix(col, leafC, leaf * 0.8);
  col = mix(col, vec3(0.24, 0.235, 0.22) * (0.7 + 0.4 * hash12(pv.zw)), peb);
  col *= 0.85 + 0.25 * fine;
  s.albedo = col;
  s.height = 0.4 + thatch * 0.03 * (1.0 - bare) + leaf * 0.12 + peb * 0.35 + n2 * 0.12 + fine * 0.06;
  s.rough = 0.94 - leaf * 0.08 - peb * 0.2;
  s.metal = 0.0;
  s.ao = 0.7 + 0.3 * s.height;
}` });

  // Carriage drive: packed gravel with two wheel ruts (puddled, mirror-wet), a mossy crown
  // between them, scattered larger cobbles, ragged grass-eaten verges. u across (2.5 m), v along (5 m/tile).
  const path = T.generate('ext:path4', {
    size: 1024, aspect: 0.5, tile: true, normalStrength: 3.2,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = vec2(uv.x * 1.0, uv.y * 2.0);
  float n = fbm(p, vec2(8.0, 16.0), 5) * 0.5 + 0.5;
  float wob = (fbm(vec2(0.0, p.y * 3.0), vec2(1.0, 6.0), 3)) * 0.035;
  float u = uv.x + wob;
  float rutD = min(abs(u - 0.29), abs(u - 0.71));
  float rut = 1.0 - smoothstep(0.035, 0.085, rutD + (n - 0.5) * 0.02);
  float crown = smoothstep(0.12, 0.05, abs(u - 0.5) + (n - 0.5) * 0.06);
  // gravel: three sizes of stones
  vec4 g1 = voronoi(p * vec2(55.0, 55.0), vec2(55.0, 110.0), 1.0);
  vec4 g2 = voronoi(p * vec2(22.0, 22.0), vec2(22.0, 44.0), 0.9);
  vec4 g3 = voronoi(p * vec2(7.0, 7.0), vec2(7.0, 14.0), 0.8);
  float s1 = smoothstep(0.55, 0.15, g1.x);
  float s2 = smoothstep(0.42, 0.18, g2.x) * step(0.55, hash12(g2.zw));
  float s3 = smoothstep(0.3, 0.16, g3.x) * step(0.8, hash12(g3.zw + 2.0));
  vec3 grav = mix(vec3(0.12, 0.115, 0.105), vec3(0.42, 0.40, 0.37), s1 * (0.5 + 0.5 * hash12(g1.zw)));
  grav = mix(grav, vec3(0.46, 0.44, 0.41) * (0.7 + 0.5 * hash12(g2.zw + 1.0)), s2);
  grav = mix(grav, vec3(0.5, 0.48, 0.45) * (0.75 + 0.4 * hash12(g3.zw + 3.0)), s3);
  grav *= 0.8 + 0.35 * n;
  // ruts: compacted dark mud, puddles in the low spots
  vec3 mud = vec3(0.06, 0.05, 0.04) * (0.8 + 0.4 * n);
  float pud = smoothstep(0.5, 0.56, fbm(p * vec2(1.0, 1.0) + 3.3, vec2(4.0, 8.0), 5) * 0.5 + 0.5) * smoothstep(0.3, 0.9, rut + crown * 0.0);
  vec3 col = mix(grav, mud, rut * 0.92);
  // mossy crown with a few straw blades
  float straw = vnoise(vec2(p.x * 300.0, p.y * 30.0), vec2(1e4));
  vec3 moss = mix(vec3(0.06, 0.07, 0.04), vec3(0.16, 0.15, 0.1), straw);
  col = mix(col, moss, crown * smoothstep(0.35, 0.65, n) * 0.85);
  col = mix(col, vec3(0.012, 0.014, 0.018), pud);
  // ragged edges, eaten by grass
  float e = min(uv.x, 1.0 - uv.x);
  float rag = fbm(vec2(uv.x * 0.2, p.y * 3.0), vec2(1.0, 6.0), 5) * 0.06;
  s.alpha = smoothstep(0.03, 0.09, e + rag);
  col = mix(vec3(0.09, 0.085, 0.06), col, smoothstep(0.05, 0.16, e + rag));
  s.albedo = col;
  s.height = 0.55 + s1 * 0.12 + s2 * 0.2 + s3 * 0.3 - rut * 0.35 - pud * 0.1;
  s.rough = mix(mix(0.92, 0.75, rut), 0.04, pud);
  s.metal = 0.0;
  s.ao = mix(0.55, 1.0, s1 * 0.5 + 0.5) * (1.0 - rut * 0.2);
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

  // Painted trim wood (bargeboards, columns, casings): worn light-grey paint over wood.
  const trim = T.generate('ext:trim2', {
    size: 512, normalStrength: 1.5,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float grain = fbm(vec2(uv.x * 2.0, uv.y * 30.0), vec2(4.0, 60.0), 5) * 0.5 + 0.5;
  float n = fbm(uv, vec2(6.0), 5) * 0.5 + 0.5;
  float peel = smoothstep(0.66, 0.7, fbm(uv + 2.0, vec2(5.0), 6) * 0.5 + 0.5 + grain * 0.05);
  vec3 paint = vec3(0.36, 0.37, 0.39) * (0.85 + 0.25 * n);
  vec3 wood = vec3(0.2, 0.18, 0.16) * (0.7 + 0.5 * grain);
  vec3 col = mix(paint, wood, peel);
  col *= 0.8 + 0.3 * smoothstep(0.2, 0.9, fbm(vec2(uv.x * 10.0, uv.y * 0.5), vec2(20.0, 1.0), 4) * 0.5 + 0.5);
  s.albedo = col;
  s.height = (1.0 - peel) * 0.08 + grain * 0.04;
  s.rough = mix(0.6, 0.85, peel);
  s.metal = 0.0;
  s.ao = 1.0;
}` });

  // Cast iron: pitted, rusty in crevices.
  const iron = T.generate('ext:iron2', {
    size: 512, normalStrength: 1.2,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float n = fbm(uv, vec2(8.0), 6) * 0.5 + 0.5;
  float rust = smoothstep(0.58, 0.78, fbm(uv + 3.0, vec2(6.0), 6) * 0.5 + 0.5);
  vec3 col = mix(vec3(0.035, 0.035, 0.04), vec3(0.07, 0.068, 0.07), n);
  col = mix(col, vec3(0.2, 0.09, 0.04), rust * 0.7);
  s.albedo = col;
  s.height = n * 0.3 + rust * 0.1;
  s.rough = mix(0.45, 0.9, rust);
  s.metal = mix(0.85, 0.2, rust);
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

  return { siding, slate, bark, ground, path, ashlar, trim, iron, rock, limestone, granite };
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
