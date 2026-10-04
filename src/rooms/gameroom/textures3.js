/**
 * Game-room textures, round 4: directional clumped pelt (strands lie along +v, roots dark, agouti tips),
 * a domain-warped Portoro/Nero marble, a small symmetric pomegranate damask for the flock, oak herringbone
 * block tint data, rain streaks for the window glass and bark for the fire logs.
 * All GPU-generated through the engine TextureForge (albedo sRGB + normal + ORM).
 */

/**
 * Taxidermy pelt. Tiles. Hair lies along +v (root at low v, tip at high v within each stagger row). Clumps of
 * strands part and overlap, each strand darkens toward its root and lightens to a banded (agouti) tip.
 * Pair with a uv that runs from the nose back along the skull so the lay follows the head.
 */
export function peltTexture(forge, { root = [0.05, 0.035, 0.025], mid = [0.24, 0.15, 0.08], tip = [0.5, 0.42, 0.32], tipAmt = 0.5, key = 'gameroom:pelt' } = {}) {
  return forge.generate(key, {
    size: 1024, normalStrength: 1.1,
    uniforms: { uR: root, uM: mid, uT: tip, uTip: tipAmt },
    glsl: /* glsl */ `
float lockLayer(vec2 uv, float cols, float rows, float seed, out float tt, out float lum) {
  float w = fbm(uv * 1.0 + seed, vec2(1.0), 3);
  float x = uv.x * cols + w * 4.0 + 0.6 * sin(uv.y * rows * 6.2831 * 0.5 + seed);
  float c = floor(x);
  float ph = hash11(c * 1.37 + seed * 17.0);
  float y = uv.y * rows + ph + w * 0.5;
  float r = floor(y);
  float t = fract(y);                                  // 0 root .. 1 tip of this lock
  float h1 = hash11(c * 3.1 + r * 7.7 + seed);
  float off = 0.5 + 0.3 * (hash11(c * 9.3 + r * 2.1 + seed) - 0.5) + 0.08 * sin(t * 3.0 + c);
  float wid = (0.55 + 0.35 * h1) * (1.0 - 0.8 * pow(t, 1.4));
  float ax = abs(fract(x) - off) / max(wid * 0.5, 1e-3);
  float prof = sqrt(max(0.0, 1.0 - ax * ax));
  tt = t;
  lum = 0.8 + 0.4 * hash11(c * 5.7 + r * 3.3 + seed);
  return prof * (0.25 + 0.75 * smoothstep(0.0, 0.6, t));
}
void surface(vec2 uv, inout Surface s) {
  float t1, l1, t2, l2;
  float a = lockLayer(uv, 30.0, 7.0, 0.0, t1, l1);
  float b = lockLayer(uv + vec2(0.5 / 30.0, 0.37), 30.0, 7.0, 2.3, t2, l2) * 0.9;
  bool top = a >= b;
  float h = max(a, b);
  float t = top ? t1 : t2;
  float l = top ? l1 : l2;
  // fine strands inside each lock, running along v
  float wv = fbm(uv * 2.0 + 5.0, vec2(2.0), 3);
  float fs = vnoise(vec2(uv.x * 420.0 + wv * 20.0, uv.y * 10.0), vec2(420.0, 10.0));
  float fs2 = vnoise(vec2(uv.x * 900.0 + wv * 30.0, uv.y * 16.0), vec2(900.0, 16.0));
  float strands = 0.6 * fs + 0.4 * fs2;
  vec3 col = mix(uR, uM, smoothstep(0.0, 0.55, h) * (0.75 + 0.25 * strands));
  float band = smoothstep(0.5, 0.72, t) * (1.0 - smoothstep(0.86, 0.97, t));
  col = mix(col, uT, band * uTip * smoothstep(0.15, 0.5, h) * (0.7 + 0.3 * strands));
  col *= l * (0.88 + 0.24 * fbmv(uv * 3.0, vec2(3.0), 3));
  s.albedo = col;
  s.height = h * 0.55 + strands * 0.2;
  s.rough = 0.78 + 0.15 * (1.0 - h);
  s.metal = 0.0;
  s.ao = 0.5 + 0.5 * smoothstep(0.0, 0.6, h);
}`,
  });
}

/** Bare skin / snout leather: fine pebbling and crease lines, used on the boar's rhinarium disc and the deer nose. Tiles. */
export function snoutLeatherTexture(forge, { color = [0.2, 0.13, 0.12], key = 'gameroom:snoutLeather' } = {}) {
  return forge.generate(key, {
    size: 512, normalStrength: 1.2,
    uniforms: { uC: color },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec4 v = voronoi(uv * 40.0, vec2(40.0), 0.9);
  float peb = smoothstep(0.0, 0.35, v.x);
  float crease = 1.0 - smoothstep(0.0, 0.05, voronoiEdge(uv * vec2(6.0, 10.0), vec2(6.0, 10.0), 1.0));
  float mot = fbmv(uv, vec2(5.0), 4);
  s.albedo = uC * (0.75 + 0.35 * mot) * (1.0 - 0.45 * crease) * (0.92 + 0.12 * peb);
  s.height = 0.5 + 0.25 * peb - 0.35 * crease;
  s.rough = 0.35 + 0.25 * crease + 0.1 * (1.0 - peb);
  s.metal = 0.0;
  s.ao = 1.0 - 0.4 * crease;
}`,
  });
}

/**
 * Portoro / Nero marble: a jet ground clouded with umber, primary veins as domain-warped FBM ridges (|noise| thresholded)
 * with a bright gold-cream core and a soft warm-grey halo, plus hairline secondary veins at ~3x the frequency and lower
 * contrast. Tiles. Very low emboss (polished stone). uVar picks a different figure.
 */
export function marblePortoroTexture(forge, { key = 'gameroom:portoro2', seed = 0 } = {}) {
  return forge.generate(key, {
    size: 1024, normalStrength: 0.04,
    uniforms: { uVar: seed },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  vec2 q = vec2(fbm(p + vec2(uVar, 0.0), vec2(2.0), 5), fbm(p + vec2(5.2, 1.3 + uVar), vec2(2.0), 5));
  vec2 r = vec2(fbm(p + 1.4 * q + vec2(1.7, 9.2), vec2(2.0), 5), fbm(p + 1.4 * q + vec2(8.3, 2.8), vec2(2.0), 5));
  float f = fbm(p + 0.9 * r + vec2(uVar * 0.3), vec2(1.0), 6);
  // veins swell, thin and die out along their length: only ~a third of the zero-contour network carries a vein
  float width = smoothstep(0.45, 0.72, fbmv(p + r * 0.5, vec2(2.0), 4));
  float core = (1.0 - smoothstep(0.0, 0.012 + 0.014 * width, abs(f))) * width;
  float vein = (1.0 - smoothstep(0.0, 0.05, abs(f))) * width;
  float halo = (1.0 - smoothstep(0.0, 0.16, abs(f))) * (0.3 + 0.7 * width);
  float f2 = fbm(p + 0.7 * r + vec2(3.3, 1.1), vec2(3.0), 5);
  float hair = (1.0 - smoothstep(0.0, 0.012, abs(f2))) * smoothstep(0.5, 0.75, fbmv(p * 1.0 + 2.0, vec2(3.0), 3));
  float cloud = fbmv(p + q * 0.4, vec2(4.0), 5);
  vec3 col = vec3(0.022, 0.02, 0.022);
  col = mix(col, vec3(0.06, 0.05, 0.042), smoothstep(0.45, 0.8, cloud) * 0.8);
  col = mix(col, vec3(0.16, 0.135, 0.1), halo * 0.35);
  col = mix(col, vec3(0.42, 0.36, 0.27), vein * 0.55);
  col = mix(col, vec3(0.78, 0.66, 0.44), core * 0.85);
  col = mix(col, vec3(0.3, 0.28, 0.25), hair * 0.4);
  s.albedo = col;
  s.height = 0.5 - 0.02 * core;
  s.rough = 0.14 + 0.06 * vein + 0.03 * cloud;
  s.metal = 0.0;
  s.ao = 1.0;
}`,
  });
}

const DAMASK = /* glsl */ `
mat2 r2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// pointed leaf from c along angle ang (0 = +y), len x wid; bend curls the tip sideways; lobes serrates the edge
float leaf(vec2 p, vec2 c, float ang, float len, float wid, float bend, float lobes) {
  vec2 d = r2(-ang) * (p - c);
  d.x -= bend * d.y * d.y / max(len, 1e-4);
  float t = clamp(d.y / len, 0.0, 1.0);
  float w = wid * 0.5 * pow(sin(3.14159 * pow(t, 0.8)), 0.9);
  w *= 1.0 + lobes * 0.35 * (0.5 + 0.5 * sin(t * 6.2831 * 3.5));
  float dx = abs(d.x) - w;
  float dy = max(-d.y, d.y - len);
  return max(dx, dy) * 0.7;
}
// the ogee lattice stem: x = xc(y) waving so mirrored copies close into pointed ogival cells
float ogeeX(float y) { return 0.35 * cos(3.14159 * y); }
float motif(vec2 q, out float detail) {
  vec2 m = vec2(abs(q.x), q.y);
  detail = 0.0;
  float d = 1e3;
  // lattice: a twin stem with a bead row between
  float sx = m.x - ogeeX(q.y);
  float stem = abs(abs(sx) - 0.016) - 0.0045;
  d = min(d, stem);
  float beadY = fract(q.y * 26.0) - 0.5;
  d = min(d, length(vec2(sx, beadY / 26.0)) - 0.0042);
  // the cell ornament, drawn at 1/1.45 scale so it fills the ogival cell
  float lat = d;
  vec2 q0 = q;
  q = q / 1.45 + vec2(0.0, 0.015); m = vec2(abs(q.x), q.y);
  d = 1e3;
  // pomegranate: a full oval fruit on a short stalk, split crown of three sepals
  vec2 f = m - vec2(0.0, 0.0);
  float fruit = sdEllipse(f, vec2(0.075, 0.095));
  float crown = min(leaf(m, vec2(0.0, 0.085), 0.0, 0.06, 0.03, 0.0, 0.0), min(leaf(m, vec2(0.012, 0.085), 0.55, 0.05, 0.026, -0.4, 0.0), sdCircle(m - vec2(0.0, 0.155), 0.008)));
  // seeds: a hex stipple inside the fruit, cut slightly smaller than the rind
  vec2 hs = vec2(q.x * 46.0, q.y * 46.0);
  hs.x += mod(floor(hs.y), 2.0) * 0.5;
  float seeds = length(fract(hs) - 0.5) / 46.0 - 0.005;
  float rind = abs(fruit) - 0.006;
  float inside = max(seeds, fruit + 0.011);
  d = min(d, min(rind, inside));
  d = min(d, crown);
  d = min(d, sdSegment(m, vec2(0.0, -0.095), vec2(0.0, -0.13)) - 0.004);
  // a pair of serrated acanthus leaves cupping the fruit, sweeping up its sides and curling out at the tips
  float ac = leaf(m, vec2(0.015, -0.125), 0.55, 0.23, 0.085, -0.6, 1.0);
  ac = min(ac, leaf(m, vec2(0.03, -0.13), 1.25, 0.15, 0.055, 0.45, 1.0));
  ac = max(ac, -(fruit - 0.012));
  float rib = leaf(m, vec2(0.015, -0.125), 0.55, 0.22, 0.007, -0.6, 0.0);
  rib = min(rib, leaf(m, vec2(0.03, -0.13), 1.25, 0.14, 0.006, 0.45, 0.0));
  detail = max(detail, (1.0 - smoothstep(0.0, 0.0015, rib)));
  d = min(d, ac);
  // an inverted fan palmette under the stalk
  for (int i = 0; i < 3; i++) {
    float fa = 3.14159 - float(i) * 0.5;
    d = min(d, leaf(m, vec2(0.0, -0.17), fa, 0.11 - float(i) * 0.02, 0.034, 0.0, 0.0));
  }
  d = min(d, sdCircle(m - vec2(0.0, -0.17), 0.016));
  // a small tulip spray climbing beside the fruit toward the lattice
  d = min(d, leaf(m, vec2(0.13, 0.03), 0.25, 0.09, 0.04, 0.0, 0.0));
  d = min(d, leaf(m, vec2(0.15, 0.06), 0.85, 0.07, 0.032, -0.3, 0.0));
  d = min(d, sdSegment(m, vec2(0.1, -0.06), vec2(0.13, 0.03)) - 0.0035);
  d = min(d, sdCircle(m - vec2(0.135, 0.2), 0.011));
  d = min(d, leaf(m, vec2(0.12, 0.215), -0.5, 0.06, 0.022, 0.3, 0.0));
  d = min(d, leaf(m, vec2(0.12, -0.3), 2.5, 0.07, 0.026, -0.3, 0.0));
  d = min(d, leaf(m, vec2(0.0, 0.2), 0.0, 0.09, 0.03, 0.0, 0.0));
  d *= 1.45;
  d = min(d, lat);
  q = q0; m = vec2(abs(q.x), q.y);
  // the crossing of the lattice above / below: a small four-petal rosette
  vec2 rc = vec2(m.x, abs(q.y) - 0.5);
  vec2 pr = polarRep(rc, 4.0);
  d = min(d, sdCircle(pr - vec2(0.022, 0.0), 0.013));
  d = max(d, -sdCircle(rc, 0.008));
  d = min(d, sdCircle(rc, 0.004));
  return d;
}`;

/**
 * Flock damask, round 4: a small symmetric pomegranate damask in an ogee lattice (one tile = one pomegranate cell,
 * ~0.21 m x 0.3 m: pass aspect), seeds stippled in the fruit, serrated acanthus with carved midribs, beaded twin
 * lattice stems and rosettes at the crossings. Low motif/ground contrast (it is green-on-green flock); the ORM
 * makes the flock velvet-rough and the satin paper smoother. `mask` returns a white-on-black motif mask for sheen.
 */
export function flockDamask4Texture(forge, { ground = [0.07, 0.135, 0.1], motif = [0.088, 0.168, 0.125], mask = false, key = 'gameroom:flock9' } = {}) {
  return forge.generate(key + (mask ? ':mask' : ''), {
    size: 1024, aspect: 0.7, normalStrength: mask ? 0.0 : 0.3,
    uniforms: { uG: ground, uM: motif, uMask: mask ? 1 : 0 },
    glsl: DAMASK + /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 q = vec2((uv.x - 0.5) * 0.7, uv.y - 0.5);         // metres-ish, cell 0.7 wide x 1 tall
  float det;
  float d = motif(q, det);
  // half-drop: a small sprig centred on the cell corners (inside the lattice gaps)
  vec2 c = vec2((fract(uv.x) - 0.5) * 0.7, fract(uv.y + 0.5) - 0.5);
  float aa = 0.0018;
  float mk = fill(d, aa);
  float cut = stroke(d + 0.007, 0.0012, aa) * mk;          // engraved inner outline of the flock
  float fib = vnoise(uv * vec2(640.0, 900.0), vec2(640.0, 900.0)) * 0.55 + vnoise(uv * vec2(320.0, 1400.0), vec2(320.0, 1400.0)) * 0.45;
  float sat = 0.98 + 0.02 * sin(uv.x * 6.2831 * 110.0 + fbm(uv * 3.0, vec2(3.0), 2) * 4.0);
  float age = fbmv(uv * 2.0 + 3.0, vec2(2.0), 4);
  vec3 g = uG * sat * (0.93 + 0.1 * age);
  vec3 f = uM * (0.86 + 0.24 * fib) * (0.95 + 0.1 * age);
  f = mix(f, uG * 0.92, max(cut, det) * 0.7);
  vec3 col = mix(g, f, mk);
  if (uMask > 0.5) col = vec3(mk * (1.0 - 0.6 * max(cut, det)));
  s.albedo = col;
  s.height = 0.5 + 0.2 * domeh(d, 0.004) + 0.05 * fib * mk - 0.05 * max(cut, det);
  s.rough = mix(0.46, 0.95, mk) + 0.03 * fib;
  s.metal = 0.0;
  s.ao = 1.0 - 0.15 * max(cut, det) - 0.06 * (1.0 - mk) * fill(d - 0.003, 0.003);
}`,
  });
}

/**
 * Carved boxwood for the chessmen. Cylindrical uv: u around (tiles), v up the piece (1 unit = ~2 cm). Fine, close,
 * slightly wavy vertical grain with darker late-wood streaks and a few pin knots, wax pooled darker in the grain;
 * no turning rings. Albedo warm honey (~#c9a064 .. #e0c48e).
 */
export function boxwood2Texture(forge) {
  return forge.generate('gameroom:boxwood2', {
    size: 512, normalStrength: 0.35,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float w = fbm(vec2(uv.x * 1.0, uv.y * 0.5), vec2(3.0, 2.0), 4);
  float x = uv.x * 34.0 + w * 2.2 + 0.25 * sin(uv.y * 6.2831 * 2.0 + uv.x * 12.0);
  float lines = 0.5 + 0.5 * sin(x * 6.2831);
  float late = smoothstep(0.55, 0.95, lines);
  float streak = smoothstep(0.55, 0.85, fbmv(vec2(uv.x * 12.0, uv.y * 1.0), vec2(12.0, 1.0), 4));
  float pores = vnoise(vec2(uv.x * 420.0, uv.y * 30.0), vec2(420.0, 30.0));
  float fleck = smoothstep(0.82, 0.96, vnoise(vec2(uv.x * 60.0, uv.y * 140.0), vec2(60.0, 140.0)));
  vec3 c = vec3(0.86, 0.71, 0.47);
  c = mix(c, vec3(0.7, 0.52, 0.3), late * 0.45);
  c = mix(c, vec3(0.66, 0.48, 0.27), streak * 0.35);
  c *= 0.96 + 0.06 * pores;
  c = mix(c, vec3(0.93, 0.8, 0.58), fleck * 0.3);
  s.albedo = c;
  s.height = 0.5 - 0.08 * late - 0.04 * pores;
  s.rough = 0.38 + 0.12 * late + 0.06 * pores;
  s.metal = 0.0;
  s.ao = 1.0 - 0.08 * late;
}`,
  });
}

/** Rain on a window pane: beads of water and the wandering trails they leave running down. Tiles (1 tile ~0.4 m). */
export function rainGlassTexture(forge) {
  return forge.generate('gameroom:rainGlass', {
    size: 512, normalStrength: 2.5,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float h = 0.0;
  // trails: thin vertical rivulets that wander left/right
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float cols = 9.0 + fi * 5.0;
    float x = uv.x * cols + 0.35 * sin(uv.y * 6.2831 * (2.0 + fi) + fi * 3.0) + 0.2 * fbm(vec2(uv.x * 2.0, uv.y * 1.0) + fi, vec2(2.0, 1.0), 3);
    float c = floor(x);
    float on = step(0.55, hash11(c * 7.1 + fi * 13.0));
    float d = abs(fract(x) - 0.5);
    float w = 0.05 + 0.03 * hash11(c * 3.3 + fi);
    float br = smoothstep(0.3, 0.6, fract(uv.y * (1.0 + hash11(c + fi * 5.0)) + hash11(c * 1.9 + fi)));
    h = max(h, on * (1.0 - smoothstep(w * 0.4, w, d)) * br * 0.6);
  }
  // beads
  vec4 v = voronoi(uv * 22.0, vec2(22.0), 0.95);
  float r = 0.12 + 0.18 * hash12(v.zw);
  float bead = step(0.45, hash12(v.zw + 3.1)) * sqrt(max(0.0, 1.0 - pow(v.x / r, 2.0)));
  vec4 v2 = voronoi(uv * 60.0 + 3.7, vec2(60.0), 0.95);
  float r2 = 0.1 + 0.15 * hash12(v2.zw);
  float mist = step(0.5, hash12(v2.zw + 1.3)) * sqrt(max(0.0, 1.0 - pow(v2.x / r2, 2.0))) * 0.5;
  h = max(h, max(bead, mist));
  s.albedo = vec3(1.0);
  s.alpha = h;
  s.height = h;
  s.rough = 0.05;
  s.metal = 0.0;
  s.ao = 1.0;
}`,
  });
}

/**
 * Oak herringbone: 70 x 350 mm blocks (ratio 5), one tile = 10 x 10 block widths (0.7 m) so it repeats exactly.
 * Every block gets its own tint, grain offset and figure (hash of the block id), a 1 mm dark joint with a micro
 * bevel either side, wax build-up in the joints, and its own wax sheen (roughness). uv 0..1 per tile.
 */
export function herringboneTexture(forge, { key = 'gameroom:herring3' } = {}) {
  return forge.generate(key, {
    size: 2048, normalStrength: 1.4,
    glsl: /* glsl */ `
const float NB = 5.0;
// returns vec4(u along block 0..NB, v across 0..1, orientation 0/1, id hash)
vec4 herring(vec2 p) {
  float s = floor((p.x + p.y) * 0.5), t = floor((p.x - p.y) / (2.0 * NB));
  vec4 best = vec4(0.0);
  for (int i = -4; i <= 0; i++) for (int j = -1; j <= 1; j++) {
    float S = s + float(i), T = t + float(j);
    vec2 o = S * vec2(1.0) + T * vec2(NB, -NB);
    float k = mod(S - NB * T, 2.0 * NB);                 // invariant under the tile translations
    vec2 q = p - o;
    if (q.x >= 0.0 && q.x < NB && q.y >= 0.0 && q.y < 1.0) best = vec4(q.x, q.y, 0.0, hash11(k * 1.7 + 0.31));
    q = p - (o + vec2(NB, 1.0 - NB));
    if (q.x >= 0.0 && q.x < 1.0 && q.y >= 0.0 && q.y < NB) best = vec4(q.y, 1.0 - q.x, 1.0, hash11(k * 5.3 + 7.7));
  }
  return best;
}
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv * 2.0 * NB;
  vec4 h = herring(p);
  float u = h.x, v = h.y, id = h.w;
  // joint + micro bevel (block width = 70 mm, so 1 mm = 0.0143)
  float eu = min(u, NB - u), ev = min(v, 1.0 - v);
  float e = min(eu, ev);
  float joint = 1.0 - smoothstep(0.004, 0.009, e);
  float bevel = smoothstep(0.006, 0.03, e);
  // oak grain along the block: warped growth rings, open pores, a few silver-grain ray flecks
  float off = id * 37.0;
  float warp = vnoise(vec2(u * 0.7 + off, v * 1.3), vec2(1000.0)) * 0.7 + vnoise(vec2(u * 1.9 + off, v * 3.1), vec2(1000.0)) * 0.3;
  float rings = sin((v * (6.0 + 8.0 * fract(id * 7.3)) + warp * 0.9 + u * 0.05 + off) * 6.2831);
  float late = smoothstep(0.45, 1.0, rings);
  float streak = vnoise(vec2(u * 2.5 + off, v * 34.0), vec2(1000.0));
  float pores = vnoise(vec2(u * 28.0 + off, v * 160.0), vec2(1000.0));
  float ray = smoothstep(0.8, 0.93, vnoise(vec2(u * 6.0 + off, v * 30.0), vec2(1000.0))) * step(0.55, fract(id * 3.1));
  vec3 base = mix(vec3(0.46, 0.31, 0.18), vec3(0.6, 0.43, 0.26), fract(id * 13.7));
  base *= 0.85 + 0.3 * fract(id * 5.9);
  vec3 col = mix(base, base * 0.7, late * 0.35);
  col *= 0.9 + 0.18 * streak;
  col *= 0.94 + 0.08 * pores;
  col = mix(col, base * 1.18, ray * 0.4);
  // wax and grime collect in the joints and along the bevels
  col = mix(col, vec3(0.05, 0.035, 0.025), joint * 0.92);
  col *= 0.86 + 0.14 * bevel;
  s.albedo = col;
  s.height = 0.5 + 0.08 * bevel - 0.25 * joint - 0.012 * late - 0.006 * pores;
  float wax = 0.3 + 0.25 * fract(id * 23.1);
  s.rough = mix(0.85, wax + 0.12 * late + 0.08 * pores, bevel);
  s.metal = 0.0;
  s.ao = 1.0 - 0.5 * joint - 0.12 * (1.0 - bevel);
}`,
  });
}
