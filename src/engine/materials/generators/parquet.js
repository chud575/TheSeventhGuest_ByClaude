// Herringbone parquet (zig-zag runs along V). Tileable.
// One texture tile = `planksAcross` plank-widths of pattern in each direction.
import { WOOD_SPECIES } from './wood.js';

export function parquet({
  species = 'oak',
  ratio = 5,            // plank length / width (integer)
  planksAcross = 4,     // pattern scale (integer): how many staircase periods per tile
  polish = 0.55,
  wear = 0.35,
  tint = [1, 1, 1],
  gap = 0.035,          // gap width in plank widths
  size,
} = {}) {
  const sp = WOOD_SPECIES[species] || WOOD_SPECIES.oak;
  return {
    key: `parquet:${species}:${ratio}:${planksAcross}:${polish}:${wear}:${tint}:${gap}`,
    size,
    normalStrength: 1.0,
    uniforms: {
      uEarly: sp.early, uLate: sp.late, uPore: sp.pore, uRingFreq: sp.ringFreq, uWarp: sp.warp,
      uL: Math.round(ratio), uN: Math.round(planksAcross), uPolish: polish, uWear: wear, uTint: tint, uGap: gap,
    },
    glsl: /* glsl */ `
// returns: local plank coords (x along 0..1, y across 0..1), id, orientation in z
vec4 herring(vec2 p, float L, float N, out vec2 id) {
  vec2 c = floor(p);
  float xr = c.x - c.y;
  float m = mod(xr, 2.0 * L);
  float sIdx = floor(xr / (2.0 * L));
  if (m < L) {
    float x0 = c.x - m;
    id = vec2(mod(sIdx, N) * 131.0 + mod(c.y, L * N), 1.0);
    return vec4((p.x - x0) / L, fract(p.y), 0.0, 0.0);
  } else {
    float j = m - L;
    float k = c.y + j;
    float y0 = k + 1.0 - L;
    id = vec2(mod(sIdx, N) * 131.0 + mod(k, L * N), 2.0);
    return vec4((p.y - y0) / L, fract(p.x), 1.0, 0.0);
  }
}

vec3 plankGrain(vec2 q, float seed, float L, out float pore, out float ringH) {
  // q.x along plank (0..1), q.y across (0..1)
  vec2 off = hash22(vec2(seed, seed * 3.1)) * 50.0;
  vec2 g = vec2(q.x * L, q.y);  // in plank-width units
  float slow = gnoise(g * vec2(0.35, 0.8) + off, vec2(1000.0)) ;
  float med = gnoise(g * vec2(0.9, 2.5) + off * 1.7, vec2(1000.0));
  float depth = (q.y - 0.5 + (hash11(seed) - 0.5) * 2.0) + slow * 0.25 * uWarp + med * 0.04;
  float r = abs(depth) * uRingFreq * 1.6 + med * 0.4;
  float f = fract(r);
  float late = pow(smoothstep(0.0, 0.2, f) * (1.0 - smoothstep(0.55, 1.0, f)), 1.5);
  ringH = late;
  float streak = gnoise(g * vec2(0.6, 22.0) + off, vec2(1000.0)) * 0.5 + 0.5;
  vec3 col = mix(vec3(uEarly), vec3(uLate), clamp(late * 0.8 + (streak - 0.5) * 0.6, 0.0, 1.0));
  float pn = hash12(floor(g * vec2(30.0, 90.0)) + off);
  pore = step(0.93, pn);
  col = mix(col, vec3(uPore), pore * 0.6);
  return col;
}

void surface(vec2 uv, inout Surface s) {
  float L = uL;
  float N = uN;
  // tile spans sqrt2*L*N plank widths in x and y (rotated 45deg pattern)
  float span = 1.41421356 * L * N;
  vec2 pr = uv * span;
  vec2 p = rot2(PI * 0.25) * pr;   // into plank frame
  vec2 id;
  vec4 h = herring(p + 1e-4, L, N, id);
  vec2 q = h.xy;
  float seed = id.x * 1.13 + id.y * 17.0;
  float pore, ringH;
  vec3 col = plankGrain(q, seed, L, pore, ringH);
  col *= 0.82 + 0.3 * hash11(seed * 3.7);
  col *= vec3(uTint);
  // gaps + bevels
  float ex = min(q.x, 1.0 - q.x) * L;  // distance to plank end in plank widths
  float ey = min(q.y, 1.0 - q.y);
  float e = min(ex, ey);
  float gapM = smoothstep(uGap * 0.5, uGap, e);
  float bev = smoothstep(uGap, uGap * 3.0, e);
  col *= mix(0.18, 1.0, gapM);
  // traffic wear & finish
  float w = smoothstep(0.3, 0.85, fbm(uv, vec2(3.0), 4) * 0.5 + 0.5) * uWear;
  col = mix(col, col * 1.15 + 0.02, w * 0.6);
  float sc = smoothstep(0.97, 1.0, vnoise(rot2(0.7) * uv * vec2(6.0, 420.0), vec2(1000.0))) * uWear;
  s.albedo = col + sc * 0.02;
  s.height = 0.55 * bev + 0.45 * gapM - 0.05 * pore + ringH * 0.03;
  s.rough = mix(0.6, 0.18, uPolish) + w * 0.3 + pore * 0.2 + (1.0 - gapM) * 0.4 + sc * 0.2;
  s.metal = 0.0;
  s.ao = mix(0.35, 1.0, bev);
}
`,
  };
}
