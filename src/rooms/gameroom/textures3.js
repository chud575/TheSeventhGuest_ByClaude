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
