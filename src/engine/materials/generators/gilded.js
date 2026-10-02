// Gilded ornament strip (gold leaf over red bole, worn on the high points,
// grime in the recesses). Tileable along U (the length of a moulding); V spans
// the face of the moulding. Patterns:
//   0 egg-and-dart, 1 acanthus scroll, 2 rosette + guilloche, 3 bead-and-reel,
//   4 plain gilt (leaf sheets only), 5 fluted / reeded, 6 frieze of anthemion (palmettes)

export function gilded({
  pattern = 0,
  repeats = 4,           // motif repeats along one texture tile
  gold = [0.96, 0.74, 0.38],
  bole = [0.5, 0.16, 0.09],
  grime = [0.06, 0.045, 0.03],
  wear = 0.4,
  dirt = 0.5,
  ground = 0,            // 0 = background of the strip is gilt, 1 = dark painted ground
  groundColor = [0.05, 0.06, 0.12],
  size,
} = {}) {
  return {
    key: `gilded:${pattern}:${repeats}:${gold}:${bole}:${grime}:${wear}:${dirt}:${ground}:${groundColor}`,
    size,
    normalStrength: 3.0,
    uniforms: { uPattern: pattern, uRepeats: Math.max(1, Math.round(repeats)), uGold: gold, uBole: bole, uGrime: grime, uWear: wear, uDirt: dirt, uGround: ground, uGroundColor: groundColor },
    glsl: /* glsl */ `
// height field of the ornament in a single motif cell: p.x in [-0.5,0.5], p.y in [0,1]
float eggDart(vec2 p) {
  vec2 q = vec2(p.x, p.y - 0.5);
  float egg = sdEllipse(q, vec2(0.3, 0.36));
  float shell = sdEllipse(q, vec2(0.38, 0.43));
  float h = domeh(egg, 0.22) * 0.9;
  float rim = stroke(shell, 0.03, 0.02) * 0.7 * step(-0.4, q.y);
  // dart between eggs
  vec2 dq = vec2(abs(p.x) - 0.5, p.y - 0.45);
  float dart = sdVesica(dq, 0.38, 0.33);
  float tip = sdRhombus(vec2(dq.x, dq.y + 0.33), vec2(0.06, 0.09));
  h = max(h, domeh(min(dart, tip), 0.05) * 0.75);
  h = max(h, rim);
  // top and bottom fillets
  h = max(h, 0.55 * (smoothstep(0.92, 0.94, p.y) + smoothstep(0.08, 0.06, p.y)));
  return h;
}
// rinceau: a sinuous stem with curling volutes and serrated acanthus leaves
float spiralD(vec2 q, float r0, float pitch, float rmax, float th) {
  float r = length(q);
  float a = atan(q.y, q.x);
  float k = (r - r0) / pitch - a / TAU;
  float d = abs(fract(k) - 0.5) * pitch - th;
  return max(d, r - rmax);
}
float acanthus(vec2 p) {
  float x = p.x + 0.5;                       // 0..1 along the cell
  float sy = 0.5 + 0.2 * sin(TAU * x);
  float dsy = 0.2 * TAU * cos(TAU * x);
  float stem = abs(p.y - sy) / sqrt(1.0 + dsy * dsy) - 0.028;
  float h = domeh(stem, 0.03) * 0.7;
  // volutes at the crests, curling inward
  vec2 c1 = vec2(0.25, 0.7 - 0.12);
  vec2 c2 = vec2(0.75, 0.3 + 0.12);
  float v1 = spiralD(vec2(x, p.y) - c1, 0.015, 0.045, 0.115, 0.013);
  float v2 = spiralD(rot2(PI) * (vec2(x, p.y) - c2), 0.015, 0.045, 0.115, 0.013);
  h = max(h, domeh(min(v1, v2), 0.02) * 0.75);
  h = max(h, domeh(min(length(vec2(x, p.y) - c1), length(vec2(x, p.y) - c2)) - 0.022, 0.022) * 0.9);
  // serrated lobed leaves sprouting from the stem, alternating sides
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float lx = 0.08 + fi * 0.25;
    float side = mod(fi, 2.0) < 1.0 ? 1.0 : -1.0;
    float ly = 0.5 + 0.2 * sin(TAU * lx);
    float slope = atan(0.2 * TAU * cos(TAU * lx));
    vec2 q = vec2(x, p.y) - vec2(lx, ly);
    q = rot2(-(slope + side * 0.9)) * q;
    q.x -= 0.075;
    float along = q.x / 0.09;
    float lobes = 0.012 * sin(along * 14.0) * smoothstep(-1.0, 0.2, along);
    float leaf = sdEllipse(q, vec2(0.09, 0.034 + lobes));
    float vein = abs(q.y) - 0.004;
    float hl = domeh(leaf, 0.03) * 0.85;
    hl -= 0.2 * (1.0 - smoothstep(0.0, 0.006, vein)) * step(leaf, 0.0);
    // curled tip
    h = max(h, hl);
  }
  h = max(h, 0.45 * (smoothstep(0.93, 0.95, p.y) + smoothstep(0.07, 0.05, p.y)));
  return h;
}
float rosetteG(vec2 p) {
  vec2 q = vec2(p.x, p.y - 0.5);
  vec2 pq = polarRep(q, 10.0);
  float petal = sdVesica(rot2(PI * 0.5) * (pq - vec2(0.17, 0.0)), 0.16, 0.11);
  float h = domeh(petal, 0.06) * 0.8;
  h = max(h, domeh(length(q) - 0.07, 0.07));
  // guilloche (interlaced bands) around
  float g1 = abs(q.y - 0.3 * cos(p.x * PI * 2.0)) - 0.035;
  float g2 = abs(q.y + 0.3 * cos(p.x * PI * 2.0)) - 0.035;
  float ring = abs(length(q) - 0.33) - 0.03;
  h = max(h, domeh(min(min(g1, g2), ring), 0.03) * 0.6 * step(0.3, length(q)));
  h = max(h, 0.5 * (smoothstep(0.93, 0.95, p.y) + smoothstep(0.07, 0.05, p.y)));
  return h;
}
float beadReel(vec2 p) {
  vec2 q = vec2(p.x, p.y - 0.5);
  float bead = sdEllipse(q, vec2(0.28, 0.32));
  vec2 rq = vec2(abs(p.x) - 0.5, q.y);
  float reel = min(sdEllipse(vec2(rq.x - 0.0, rq.y), vec2(0.06, 0.22)), 1e5);
  float h = max(domeh(bead, 0.25), domeh(reel, 0.06) * 0.85);
  return h;
}
float fluted(vec2 p) {
  float x = fract(p.x * 3.0) - 0.5;
  float flute = 1.0 - pow(abs(x) * 2.0, 2.0);
  float ends = smoothstep(0.08, 0.16, p.y) * smoothstep(0.92, 0.84, p.y);
  return mix(0.85, 0.85 - flute * 0.6, ends);
}
// anthemion frieze: bold palmettes (fan of 7 ribbed petals) alternating with lotus buds, linked by S-scrolls
float palmette(vec2 q, float scale) {
  q /= scale;
  float h = 0.0;
  for (int i = 0; i < 7; i++) {
    float a = -1.05 + float(i) * 0.35;
    vec2 lq = rot2(a) * q;
    float petal = sdVesica(lq - vec2(0.0, 0.26), 0.2, 0.15);
    float rib = abs(lq.x) - 0.006;
    float hp = domeh(petal, 0.07) * 0.9 - 0.15 * (1.0 - smoothstep(0.0, 0.008, rib)) * step(petal, 0.0);
    h = max(h, hp);
  }
  h = max(h, domeh(sdEllipse(q - vec2(0.0, 0.05), vec2(0.08, 0.06)), 0.05));
  return h;
}
float anthemion(vec2 p) {
  float x = p.x;                    // -0.5..0.5
  float h = 0.0;
  // palmette at the centre of the cell, lotus at the cell edges
  h = max(h, palmette(vec2(x, p.y - 0.2), 1.25));
  vec2 lq = vec2(abs(x) - 0.5, p.y - 0.22);
  float lotus = sdVesica(lq - vec2(0.0, 0.25), 0.3, 0.24);
  float lotusSide = min(sdVesica(rot2(0.55) * (vec2(abs(lq.x), lq.y) - vec2(0.06, 0.12)), 0.18, 0.14), 1e5);
  h = max(h, domeh(lotus, 0.06) * 0.85);
  h = max(h, domeh(lotusSide, 0.05) * 0.7);
  // S-scrolls linking them along the base
  vec2 sq = vec2(abs(x) - 0.25, p.y - 0.18);
  float scroll = spiralD(sq, 0.012, 0.04, 0.09, 0.012);
  h = max(h, domeh(scroll, 0.02) * 0.7);
  // fillets
  h = max(h, 0.5 * (smoothstep(0.93, 0.95, p.y) + smoothstep(0.07, 0.05, p.y)));
  return h;
}

float ornament(vec2 uv, out float motifMask) {
  float n = uRepeats;
  vec2 p = vec2(fract(uv.x * n) - 0.5, uv.y);
  float h;
  if (uPattern < 0.5) h = eggDart(p);
  else if (uPattern < 1.5) h = acanthus(p);
  else if (uPattern < 2.5) h = rosetteG(p);
  else if (uPattern < 3.5) h = beadReel(p);
  else if (uPattern < 4.5) h = 0.6;
  else if (uPattern < 5.5) h = fluted(p);
  else h = anthemion(p);
  motifMask = smoothstep(0.02, 0.12, h);
  return h;
}

void surface(vec2 uv, inout Surface s) {
  float motif;
  float h = ornament(uv, motif);
  // blur-ish curvature estimate for wear/grime from neighbouring samples
  float e = 0.004;
  float m2;
  float hn = (ornament(uv + vec2(e, 0.0), m2) + ornament(uv - vec2(e, 0.0), m2) + ornament(uv + vec2(0.0, e), m2) + ornament(uv - vec2(0.0, e), m2)) * 0.25;
  float convex = clamp((h - hn) * 25.0, -1.0, 1.0);   // >0 ridges, <0 crevices
  float n1 = fbm(uv, vec2(float(uRepeats) * 4.0, 8.0), 5) * 0.5 + 0.5;
  float n2 = fbm(uv + 3.7, vec2(float(uRepeats) * 16.0, 32.0), 3) * 0.5 + 0.5;
  // gold leaf: square sheets with faint overlaps
  vec2 sheet = fract(uv * vec2(float(uRepeats) * 1.5, 1.6) + vec2(0.0, n1 * 0.05));
  float sheetEdge = 1.0 - smoothstep(0.0, 0.015, min(min(sheet.x, 1.0 - sheet.x), min(sheet.y, 1.0 - sheet.y)));
  vec3 gold = vec3(uGold) * (0.88 + 0.2 * n2) * (1.0 - 0.08 * sheetEdge);
  gold = mix(gold, gold * vec3(1.05, 0.92, 0.78), n1 * 0.4);   // tonal variation, some greener/redder leaf
  // wear on high points reveals bole
  float wearM = smoothstep(0.55, 0.9, convex * 0.6 + n1 * 0.7 + h * 0.3 - 0.35) * uWear;
  wearM *= smoothstep(0.3, 0.7, n2 + 0.2);
  vec3 col = mix(gold, vec3(uBole) * (0.8 + 0.3 * n2), wearM);
  float metal = 1.0 - wearM;
  // grime in recesses
  float grimeM = clamp(smoothstep(0.0, -0.6, convex) * 0.8 + (1.0 - h) * 0.35 * motif, 0.0, 1.0) * uDirt;
  grimeM *= 0.6 + 0.4 * n1;
  col = mix(col, vec3(uGrime), grimeM * 0.85);
  metal = mix(metal, 0.0, grimeM * 0.9);
  // painted ground behind motifs
  if (uGround > 0.5) {
    float g = 1.0 - smoothstep(0.03, 0.1, h);
    col = mix(col, vec3(uGroundColor) * (0.9 + 0.2 * n2), g);
    metal = mix(metal, 0.0, g);
  }
  s.albedo = col;
  s.metal = metal;
  float plain = step(3.5, uPattern) * step(uPattern, 4.5);
  s.rough = mix(0.42, 0.2, smoothstep(0.0, 0.6, convex + h * 0.5)) + grimeM * 0.4 + wearM * 0.25 + n2 * 0.06;
  s.rough = mix(s.rough, 0.28 + n1 * 0.22 + sheetEdge * 0.1, plain);
  s.height = h + n2 * 0.01;
  s.ao = mix(0.35, 1.0, smoothstep(-0.7, 0.2, convex)) * mix(0.6, 1.0, h);
}
`,
  };
}
