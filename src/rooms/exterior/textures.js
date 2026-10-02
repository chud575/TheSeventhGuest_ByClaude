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

  // Ground: dead grass, bare earth, fallen leaves, pebbles. 1 tile = 6 m.
  const ground = T.generate('ext:ground3', {
    size: big, normalStrength: 2.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float n1 = fbm(uv, vec2(4.0), 6) * 0.5 + 0.5;
  float n2 = fbm(uv + 3.0, vec2(16.0), 5) * 0.5 + 0.5;
  // grass blade streaks
  vec2 g = uv * 140.0;
  float blades = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 gg = rot2(fi * 2.1) * uv;
    blades += smoothstep(0.55, 1.0, vnoise(vec2(gg.x * 600.0, gg.y * 60.0), vec2(600.0, 60.0))) * 0.4;
  }
  vec3 grass = mix(vec3(0.18, 0.17, 0.1), vec3(0.30, 0.26, 0.15), n2) * (0.7 + 0.5 * blades);
  grass = mix(grass, vec3(0.11, 0.13, 0.08), smoothstep(0.55, 0.75, n1) * 0.6);
  vec3 dirt = mix(vec3(0.10, 0.08, 0.06), vec3(0.17, 0.14, 0.11), n2);
  float bare = smoothstep(0.58, 0.72, fbm(uv + 9.0, vec2(3.0), 6) * 0.5 + 0.5);
  // leaves
  vec4 v = voronoi(uv * 60.0, vec2(60.0), 1.0);
  float leaf = smoothstep(0.32, 0.18, v.x) * step(0.9, hash12(v.zw));
  vec3 leafC = mix(vec3(0.24, 0.12, 0.05), vec3(0.32, 0.22, 0.09), hash12(v.zw + 1.0));
  // pebbles
  vec4 pv = voronoi(uv * 90.0, vec2(90.0), 1.0);
  float peb = smoothstep(0.25, 0.12, pv.x) * step(0.93, hash12(pv.zw + 5.0)) * bare;
  vec3 col = mix(grass, dirt, bare);
  col = mix(col, leafC, leaf * 0.85);
  col = mix(col, vec3(0.3, 0.29, 0.27) * (0.7 + 0.4 * hash12(pv.zw)), peb);
  s.albedo = col;
  s.height = 0.4 + blades * 0.25 * (1.0 - bare) + leaf * 0.15 + peb * 0.35 + n2 * 0.1;
  s.rough = 0.92 - leaf * 0.1 - peb * 0.2;
  s.metal = 0.0;
  s.ao = 0.75 + 0.25 * s.height;
}` });

  // Path: irregular flagstones set in dark earth and gravel; alpha-ragged edges across U.
  const path = T.generate('ext:path2', {
    size: 1024, aspect: 0.5, tile: true, normalStrength: 3.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = vec2(uv.x * 1.0, uv.y * 2.0);   // 1 x 2 aspect: 2.4 m wide, 4.8 m long
  vec4 v = voronoi(p * vec2(4.0, 4.0), vec2(4.0, 8.0), 0.85);
  float edge = voronoiEdge(p * vec2(4.0, 4.0), vec2(4.0, 8.0), 0.85);
  float n = fbm(p, vec2(8.0, 16.0), 5) * 0.5 + 0.5;
  float stone = smoothstep(0.03, 0.09, edge + (n - 0.5) * 0.04);
  float h = hash12(v.zw);
  vec3 sc = mix(vec3(0.26, 0.25, 0.235), vec3(0.36, 0.34, 0.31), h) * (0.75 + 0.45 * n);
  sc = mix(sc, vec3(0.16, 0.19, 0.12), smoothstep(0.6, 0.85, fbm(p + 1.3, vec2(6.0, 12.0), 4) * 0.5 + 0.5) * 0.5);
  vec4 gv = voronoi(p * 70.0, vec2(70.0, 140.0), 1.0);
  vec3 gravel = mix(vec3(0.07, 0.06, 0.05), vec3(0.2, 0.19, 0.18), hash12(gv.zw)) * smoothstep(0.6, 0.2, gv.x);
  vec3 col = mix(gravel, sc, stone);
  // wet dark wheel ruts / puddle sheen near centre
  float wet = smoothstep(0.62, 0.8, fbm(p + 5.0, vec2(3.0, 6.0), 5) * 0.5 + 0.5);
  col *= 1.0 - wet * 0.35;
  // ragged edges across the width, eaten by grass
  float e = min(uv.x, 1.0 - uv.x);
  float rag = fbm(vec2(uv.x * 0.2, p.y * 3.0), vec2(1.0, 6.0), 5) * 0.06;
  s.alpha = smoothstep(0.03, 0.09, e + rag);
  col = mix(vec3(0.12, 0.11, 0.07), col, smoothstep(0.05, 0.16, e + rag));
  s.albedo = col;
  s.height = stone * (0.6 + 0.2 * n) + (1.0 - stone) * 0.2 * smoothstep(0.6, 0.2, gv.x);
  s.rough = mix(0.85, 0.55, stone) - wet * 0.4;
  s.metal = 0.0;
  s.ao = mix(0.5, 1.0, stone);
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

  return { siding, slate, bark, ground, path, ashlar, trim, iron };
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
