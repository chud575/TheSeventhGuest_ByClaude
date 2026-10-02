// Hardwood with grain (flat-sawn cathedral figure, pores, rays), optional boards.
// Grain runs along U. Tileable.

export const WOOD_SPECIES = {
  mahogany: { early: [0.52, 0.21, 0.115], late: [0.31, 0.11, 0.06], pore: [0.14, 0.045, 0.025], ringFreq: 4.5, warp: 1.0, rays: 0.0 },
  walnut:   { early: [0.44, 0.29, 0.18], late: [0.24, 0.14, 0.085], pore: [0.1, 0.06, 0.035], ringFreq: 4, warp: 1.6, rays: 0.0 },
  oak:      { early: [0.62, 0.45, 0.27], late: [0.44, 0.30, 0.16], pore: [0.25, 0.16, 0.08], ringFreq: 6, warp: 0.8, rays: 1.0 },
  ebony:    { early: [0.12, 0.09, 0.07], late: [0.06, 0.045, 0.035], pore: [0.03, 0.02, 0.015], ringFreq: 8, warp: 0.6, rays: 0.0 },
  rosewood: { early: [0.46, 0.18, 0.1], late: [0.2, 0.07, 0.045], pore: [0.07, 0.025, 0.018], ringFreq: 6, warp: 2.0, rays: 0.0 },
  pine:     { early: [0.72, 0.53, 0.32], late: [0.52, 0.32, 0.16], pore: [0.4, 0.25, 0.12], ringFreq: 5, warp: 1.2, rays: 0.0 },
};

export function wood({
  species = 'mahogany',
  boards = 1,            // boards across V per tile (0 = no seams, continuous figure)
  boardLength = 0,       // 0 = boards run the full tile; otherwise fraction of tile length (staggered joints)
  polish = 0.7,          // 0 = raw/matte, 1 = high gloss french polish
  wear = 0.25,
  tint = [1, 1, 1],
  figure = 0.5,          // amount of cathedral figure / irregularity
  size,
} = {}) {
  const sp = WOOD_SPECIES[species] || WOOD_SPECIES.mahogany;
  return {
    key: `wood:${species}:${boards}:${boardLength}:${polish}:${wear}:${tint}:${figure}`,
    size,
    normalStrength: 0.22,
    uniforms: {
      uEarly: sp.early, uLate: sp.late, uPore: sp.pore, uRingFreq: sp.ringFreq, uWarp: sp.warp, uRays: sp.rays,
      uBoards: boards, uBoardLen: boardLength, uPolish: polish, uWear: wear, uTint: tint, uFigure: figure,
    },
    glsl: /* glsl */ `
vec3 grainColor(vec2 uv, float seed, out float poreMask, out float ringH) {
  // uv: x along grain (0..1 periodic), y across (0..1 periodic)
  vec2 off = hash22(vec2(seed, seed * 1.7)) * 10.0;
  // gentle large-scale wander of the grain lines
  float wander = fbm(uv + off, vec2(2.0, 1.0), 3) * 0.06 * uWarp * (0.4 + uFigure);
  float vy = uv.y + wander;
  // 1) fine, dense, almost-straight grain lines (dominant read at furniture scale)
  float fineA = fbm(vec2(uv.x, vy) + off * 0.7, vec2(3.0, 180.0), 3) * 0.5 + 0.5;
  float fineB = fbm(vec2(uv.x, vy) + off * 1.9, vec2(6.0, 420.0), 2) * 0.5 + 0.5;
  // 2) soft growth rings: low contrast, slightly arched (flat-sawn cathedral hints)
  float arch = (vy - 0.5) + 0.12 * uFigure * sin(TAU * uv.x + seed * 6.0) * smoothstep(0.0, 0.5, 0.5 - abs(vy - 0.5));
  float r = abs(arch) * uRingFreq * 6.0 + fbm(uv + off * 1.3, vec2(4.0, 3.0), 3) * 0.6;
  float f = fract(r);
  float late = smoothstep(0.0, 0.25, f) * (1.0 - smoothstep(0.45, 1.0, f));
  ringH = late;
  // 3) ribbon / mottled figure (chatoyant bands across the grain)
  float ribbon = sin(TAU * (vy * uRingFreq * 2.0 + fbm(uv + off * 3.1, vec2(5.0, 2.0), 3) * 0.6)) * 0.5 + 0.5;
  float tone = fbm(uv + off * 2.3, vec2(2.0, 3.0), 4) * 0.5 + 0.5;
  vec3 col = mix(vec3(uEarly), vec3(uLate), clamp(0.3 + late * 0.22 + (fineA - 0.5) * 0.6 + (tone - 0.5) * 0.45, 0.0, 1.0));
  col *= 0.92 + 0.1 * fineB + 0.05 * (ribbon - 0.5) * uFigure;
  // pores: tiny dark dashes following the grain
  float pn = vnoise(vec2(uv.x, vy) * vec2(90.0, 1600.0) + off, vec2(90.0, 1600.0));
  poreMask = smoothstep(0.8, 0.93, pn);
  col = mix(col, vec3(uPore), poreMask * 0.55);
  if (uRays > 0.5) {
    float ray = smoothstep(0.82, 0.95, vnoise(uv * vec2(18.0, 260.0) + off * 3.0, vec2(18.0, 260.0)));
    col = mix(col, col * 1.2 + 0.03, ray * 0.5);
  }
  return col * vec3(uTint);
}

void surface(vec2 uv, inout Surface s) {
  float nb = max(uBoards, 1.0);
  float row = floor(uv.y * nb);
  float vy = fract(uv.y * nb);
  float seed = row * 7.31 + 1.0;
  float ux = uv.x;
  float jointX = 1.0; // distance to board end
  if (uBoardLen > 0.0) {
    float per = floor(1.0 / uBoardLen + 0.5);
    float shift = hash11(row * 3.1) ;
    float x = uv.x * per + shift * per;
    float seg = floor(x);
    seed += mod(seg, per) * 13.7;
    jointX = min(fract(x), 1.0 - fract(x)) / per;
  }
  vec2 guv = vec2(ux, uBoards > 0.5 ? vy : uv.y);
  float pore, ringH;
  vec3 col = grainColor(guv, uBoards > 0.5 ? seed : 1.0, pore, ringH);
  // per-board tone variation
  float tone = hash11(seed * 1.37);
  col *= 0.86 + 0.26 * tone;
  // seams
  float seam = 1.0;
  if (uBoards > 0.5) {
    float ey = min(vy, 1.0 - vy) / nb;
    seam = smoothstep(0.0007, 0.0035, ey);
  }
  if (uBoardLen > 0.0) seam = min(seam, smoothstep(0.0007, 0.003, jointX));
  col *= mix(0.25, 1.0, seam);
  // wear: lighter, duller patches
  float w = smoothstep(0.35, 0.9, fbm(uv, vec2(3.0), 4) * 0.5 + 0.5) * uWear;
  col = mix(col, col * 1.18 + 0.015, w * 0.5);
  float scratches = smoothstep(0.985, 1.0, vnoise(rot2(0.3) * uv * vec2(4.0, 300.0), vec2(4.0, 300.0))) * uWear;
  col += scratches * 0.03;

  s.albedo = col;
  s.height = 0.5 + ringH * 0.04 - pore * 0.08 - (1.0 - seam) * 0.4;
  float baseR = mix(0.62, 0.16, uPolish);
  s.rough = baseR + pore * 0.25 + w * 0.25 + (1.0 - seam) * 0.3 + scratches * 0.2;
  s.metal = 0.0;
  s.ao = mix(0.55, 1.0, seam) * (1.0 - pore * 0.15);
}
`,
  };
}
