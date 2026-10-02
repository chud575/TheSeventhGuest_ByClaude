// A row of antique leather-bound book spines standing on a shelf.
// Tileable along U. V = 0 at the shelf board, V = 1 at the underside of the shelf above.
// Use alpha (alphaTest) to cut the empty space above shorter books, or keep the dark backdrop.

export function books({
  count = 14,                 // books per tile
  palette = [[0.42, 0.08, 0.06], [0.1, 0.22, 0.13], [0.36, 0.2, 0.1], [0.09, 0.12, 0.26], [0.5, 0.33, 0.18], [0.16, 0.06, 0.05]],
  fill = 0.82,                // average book height relative to shelf
  dust = 0.3,
  cutout = 0,                 // 1 => alpha = 0 above the books
  seed = 1,
  size,
} = {}) {
  const pal = palette.slice(0, 6);
  while (pal.length < 6) pal.push(pal[pal.length - 1]);
  return {
    key: `books:${count}:${JSON.stringify(pal)}:${fill}:${dust}:${cutout}:${seed}`,
    size, seed, normalStrength: 2.0,
    uniforms: { uCount: count, uP0: pal[0], uP1: pal[1], uP2: pal[2], uP3: pal[3], uP4: pal[4], uP5: pal[5], uFill: fill, uDust: dust, uCut: cutout },
    glsl: /* glsl */ `
vec3 bpal(float h) {
  int i = int(floor(h * 6.0));
  if (i == 0) return uP0; if (i == 1) return uP1; if (i == 2) return uP2;
  if (i == 3) return uP3; if (i == 4) return uP4; return uP5;
}
void surface(vec2 uv, inout Surface s) {
  // irregular book widths: walk cumulative widths using a hashed partition of [0,1)
  float n = uCount;
  float x = uv.x * n;
  float id = floor(x);
  // merge neighbours occasionally into wider folios
  float w0 = hash11(id * 1.31 + uSeed);
  float local = fract(x);
  float bid = id;
  float h = uFill + (hash11(bid * 3.7 + uSeed) - 0.5) * 0.22;
  if (hash11(bid * 9.1 + uSeed) > 0.85) h = uFill + 0.12;       // tall folio
  float leanGap = smoothstep(0.0, 0.025, local) * smoothstep(1.0, 0.975, local);
  float inside = step(uv.y, h) * step(0.0, uv.y);
  vec3 c = bpal(hash11(bid * 5.3 + uSeed));
  c *= 0.75 + 0.45 * hash11(bid * 2.9 + uSeed);
  // spine roundness
  float round = sin(local * PI);
  // raised bands + gilt
  float bandY = fract((uv.y / max(h, 0.01)) * 6.0);
  float bands = smoothstep(0.0, 0.04, bandY) * smoothstep(0.14, 0.1, bandY);
  float giltLine = stroke(bandY - 0.15, 0.0, 0.01) + stroke(bandY - 0.95, 0.0, 0.01);
  float hasGilt = step(0.35, hash11(bid * 7.7 + uSeed));
  float yr = uv.y / max(h, 0.01);
  // title label panel
  float label = step(0.62, yr) * step(yr, 0.76) * step(0.18, local) * step(local, 0.82);
  float labelKind = hash11(bid * 4.4 + uSeed);
  vec3 labelCol = labelKind > 0.5 ? vec3(0.08, 0.05, 0.04) : vec3(0.3, 0.06, 0.04);
  float letters = step(0.5, hash12(floor(vec2(local * 7.0, yr * 60.0)) + bid)) * step(0.66, yr) * step(yr, 0.72) * step(0.25, local) * step(local, 0.75);
  float leather = fbm(uv + bid, vec2(n * 3.0, 24.0), 4) * 0.5 + 0.5;
  float scuff = smoothstep(0.65, 0.9, fbm(uv * vec2(1.0, 1.0) + bid * 0.37, vec2(n, 8.0), 4) * 0.5 + 0.5);
  vec3 col = c * (0.8 + 0.3 * leather);
  col = mix(col, col * 1.6 + 0.05, scuff * 0.35);
  col = mix(col, labelCol, label);
  vec3 gilt = vec3(0.8, 0.6, 0.28);
  float giltM = clamp((bands * 0.5 + giltLine + letters) * hasGilt, 0.0, 1.0);
  col = mix(col, gilt, giltM);
  col *= 0.5 + 0.5 * round;
  col *= mix(0.25, 1.0, leanGap);
  // dust on tops is out of view; darken toward top edge (shelf shadow)
  col *= mix(0.55, 1.0, smoothstep(1.0, 0.6, uv.y));
  // backdrop above books
  vec3 back = vec3(0.02, 0.015, 0.012);
  col = mix(back, col, inside);
  s.albedo = col;
  s.alpha = uCut > 0.5 ? inside : 1.0;
  s.height = inside * (0.4 + 0.35 * round + bands * 0.15 * (1.0 - label)) + leather * 0.03;
  s.rough = mix(0.95, mix(0.55, 0.3, giltM) + scuff * 0.2, inside);
  s.metal = giltM * inside * 0.9;
  s.ao = mix(0.2, mix(0.4, 1.0, leanGap), inside);
}
`,
  };
}
