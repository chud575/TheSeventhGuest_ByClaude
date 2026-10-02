// Victorian damask / flocked wallpaper. Tileable (half-drop ogee lattice).
// The motif is read mostly through sheen (satin motif on matte ground) like real
// silk damask, with a faint colour lift and a slightly raised flock.

export function damask({
  base = [0.12, 0.165, 0.38],       // ground colour (sRGB 0..1)
  motif = [0.17, 0.225, 0.47],      // motif colour
  accent = [0.55, 0.45, 0.25],      // thin metallic accent lines (set strength 0 to disable)
  accentStrength = 0.0,
  sheen = 0.55,                     // roughness contrast between ground and motif
  aging = 0.35,
  variant = 0,                      // 0 classic crown damask, 1 small fleur repeat
  size,
} = {}) {
  return {
    key: `damask:${base}:${motif}:${accent}:${accentStrength}:${sheen}:${aging}:${variant}`,
    size,
    normalStrength: 1.2,
    uniforms: { uBase: base, uMotif: motif, uAccent: accent, uAccentStrength: accentStrength, uSheen: sheen, uAging: aging, uVariant: variant },
    glsl: /* glsl */ `
// motif in local space: p.x mirrored, y up, roughly within [-0.5,0.5]
float leaf(vec2 p, vec2 c, float ang, float len, float wid) {
  p -= c; p = rot2(ang) * p;
  return sdVesica(p, len, len - wid);
}
float damaskMotif(vec2 p) {
  p.x = abs(p.x);
  float d = 1e5;
  // central spine
  d = min(d, sdVesica(p - vec2(0.0, 0.02), 0.42, 0.395));
  // crown: three upward petals
  d = min(d, leaf(p, vec2(0.0, 0.33), 0.0, 0.16, 0.06));
  d = min(d, leaf(p, vec2(0.07, 0.30), -0.75, 0.12, 0.045));
  // upper scrolls (C curls) with bud ends
  d = min(d, sdArc(rot2(-2.2) * (p - vec2(0.12, 0.2)), vec2(sin(1.9), cos(1.9)), 0.075, 0.012));
  d = min(d, sdCircle(p - vec2(0.205, 0.235), 0.022));
  // big side leaves
  d = min(d, leaf(p, vec2(0.13, 0.04), -1.05, 0.2, 0.075));
  d = min(d, leaf(p, vec2(0.25, 0.11), -0.35, 0.09, 0.035));
  // lower scroll
  d = min(d, sdArc(rot2(0.6) * (p - vec2(0.15, -0.14)), vec2(sin(2.0), cos(2.0)), 0.085, 0.013));
  d = min(d, sdCircle(p - vec2(0.24, -0.1), 0.02));
  // palmette fan at the base
  vec2 q = p - vec2(0.0, -0.26);
  float fan = 1e5;
  for (int i = 0; i < 5; i++) {
    float a = -1.25 + float(i) * 0.625;
    vec2 r = rot2(a) * q;
    fan = min(fan, sdVesica(r - vec2(0.0, -0.08), 0.09, 0.07));
  }
  d = min(d, max(fan, q.y - 0.02));
  d = min(d, sdCircle(q, 0.035));
  // small dots
  d = min(d, sdCircle(p - vec2(0.0, 0.47), 0.018));
  d = min(d, sdCircle(p - vec2(0.3, 0.0), 0.016));
  // cut a fine vein through the big leaves (negative space detail)
  float vein = sdSegment(rot2(-1.05) * (p - vec2(0.13, 0.04)), vec2(0.0, -0.15), vec2(0.0, 0.15)) - 0.004;
  d = max(d, -vein);
  float spineVein = abs(p.x) - 0.004;
  d = max(d, -max(spineVein, abs(p.y - 0.02) - 0.3));
  return d;
}
float fleurMotif(vec2 p) {
  p.x = abs(p.x);
  float d = sdVesica(p - vec2(0.0, 0.06), 0.2, 0.17);
  d = min(d, leaf(p, vec2(0.1, 0.0), -0.9, 0.14, 0.055));
  d = min(d, sdBox(p - vec2(0.0, -0.06), vec2(0.13, 0.018)));
  d = min(d, leaf(p, vec2(0.0, -0.15), PI, 0.08, 0.035));
  d = min(d, sdCircle(p - vec2(0.17, 0.12), 0.02));
  return d;
}
float motifAt(vec2 p) { return uVariant < 0.5 ? damaskMotif(p) : fleurMotif(p * 1.6) / 1.6; }

void surface(vec2 uv, inout Surface s) {
  // two motifs per tile: centre and (half-drop) corners
  vec2 g = uv;
  float dA = motifAt((g - vec2(0.5, 0.5)) * vec2(1.0, 1.0) * 1.15);
  vec2 gc = fract(g + 0.5) - 0.5;
  float dB = motifAt(gc * 1.15);
  float d = min(dA, dB);
  // ogee lattice of thin scrolling lines linking the motifs
  float ogee1 = abs((uv.x - 0.5) - 0.235 * sin(TAU * (uv.y + 0.25)));
  float ogee2 = abs((uv.x - 0.5) + 0.235 * sin(TAU * (uv.y + 0.25)));
  float og = min(ogee1, ogee2);
  // keep lattice away from motif bodies
  float lattice = stroke(og, 0.0035, 0.0015) * smoothstep(0.0, 0.04, d);
  float aa = 0.0016;
  float m = fill(d, aa);
  float outline = stroke(d, 0.0035, aa) * (1.0 - m);
  m = max(m, lattice * 0.8);

  // paper / ground texture
  float fib = fbm(uv + vec2(0.0, 0.0), vec2(64.0, 64.0), 4) * 0.5 + 0.5;
  float fibH = fbm(uv, vec2(220.0, 30.0), 3);
  float mott = fbm(uv, vec2(6.0), 4);
  vec3 ground = vec3(uBase) * (0.92 + 0.12 * fib) * (1.0 + mott * 0.06 * uAging);
  vec3 motifCol = vec3(uMotif) * (0.95 + 0.1 * fib);
  vec3 col = mix(ground, motifCol, m);
  col = mix(col, vec3(uAccent), outline * uAccentStrength);
  // ageing: faint foxing specks and a tired, dusty lift
  float fox = smoothstep(0.82, 0.95, vnoise(uv * 90.0, vec2(90.0)));
  col = mix(col, col * vec3(1.08, 1.0, 0.85) + 0.012, fox * 0.25 * uAging);
  col += 0.01 * uAging * (fibH * 0.5 + 0.5);

  s.albedo = col;
  // flocked motif slightly raised with soft shoulders
  float hm = smoothstep(0.004, -0.006, d);
  s.height = 0.35 + 0.35 * hm + 0.04 * fib + 0.03 * fibH + lattice * 0.15;
  s.rough = mix(0.86, 0.86 - uSheen * 0.62, m) + 0.04 * fib;
  s.metal = outline * uAccentStrength * 0.8;
  s.ao = 1.0 - 0.12 * stroke(d, 0.008, 0.006) * (1.0 - m);
}
`,
  };
}
