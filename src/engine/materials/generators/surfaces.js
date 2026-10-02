// Misc. tileable surfaces: marble, plaster, velvet, brass, glass, wax, leather,
// brick, ashlar stone, checkered marble tiles.

export const MARBLE_TYPES = {
  carrara: { base: [0.86, 0.86, 0.84], vein: [0.42, 0.44, 0.47], vein2: [0.62, 0.63, 0.64] },
  nero:    { base: [0.035, 0.033, 0.036], vein: [0.85, 0.83, 0.78], vein2: [0.35, 0.33, 0.32] },
  verde:   { base: [0.05, 0.12, 0.09], vein: [0.65, 0.72, 0.65], vein2: [0.12, 0.25, 0.18] },
  rosso:   { base: [0.36, 0.09, 0.07], vein: [0.85, 0.75, 0.68], vein2: [0.2, 0.05, 0.04] },
  siena:   { base: [0.78, 0.66, 0.45], vein: [0.38, 0.24, 0.14], vein2: [0.6, 0.45, 0.28] },
};

export function marble({ type = 'carrara', base, vein, vein2, polish = 0.85, scale = 2, size } = {}) {
  const t = MARBLE_TYPES[type] || MARBLE_TYPES.carrara;
  base ||= t.base; vein ||= t.vein; vein2 ||= t.vein2;
  return {
    key: `marble:${base}:${vein}:${vein2}:${polish}:${scale}`,
    size, normalStrength: 0.3,
    uniforms: { uBase: base, uVein: vein, uVein2: vein2, uPolish: polish, uScale: Math.max(1, Math.round(scale)) },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 per = vec2(uScale);
  vec2 w = vec2(fbm(uv, per * 1.0, 6), fbm(uv + 5.2, per * 1.0, 6));
  vec2 w2 = vec2(fbm(uv + w * 0.15 + 1.7, per * 2.0, 5), fbm(uv + w * 0.15 + 9.2, per * 2.0, 5));
  float v = fbm(uv + w2 * 0.25, per * 2.0, 6);
  float veins = 1.0 - smoothstep(0.0, 0.035, abs(v));
  float veinsFine = 1.0 - smoothstep(0.0, 0.012, abs(fbm(uv + w * 0.3 + 3.3, per * 4.0, 5)));
  float cloud = fbm(uv + w * 0.4, per * 3.0, 5) * 0.5 + 0.5;
  vec3 col = vec3(uBase) * (0.9 + 0.18 * cloud);
  col = mix(col, vec3(uVein2), smoothstep(0.35, 0.9, cloud) * 0.35);
  col = mix(col, vec3(uVein), veins * 0.85);
  col = mix(col, mix(vec3(uVein), vec3(uVein2), 0.5), veinsFine * 0.45);
  float pits = step(0.985, hash12(floor(uv * 900.0)));
  s.albedo = col;
  s.height = 0.5 - pits * 0.3 - veins * 0.02;
  s.rough = mix(0.55, 0.06, uPolish) + veins * 0.04 + pits * 0.3 + cloud * 0.03;
  s.metal = 0.0;
  s.ao = 1.0 - pits * 0.3;
}
`,
  };
}

export function plaster({ color = [0.72, 0.7, 0.66], cracks = 0.3, stains = 0.3, roughness = 0.9, size } = {}) {
  return {
    key: `plaster:${color}:${cracks}:${stains}:${roughness}`,
    size, normalStrength: 1.2,
    uniforms: { uColor: color, uCracks: cracks, uStains: stains, uRough: roughness },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float trowel = fbm(uv, vec2(5.0), 5);
  float fine = fbm(uv + 2.0, vec2(48.0), 4);
  float grit = vnoise(uv * 512.0, vec2(512.0));
  vec2 wq = uv + vec2(fbm(uv + 9.0, vec2(4.0), 4), fbm(uv + 4.0, vec2(4.0), 4)) * 0.05;
  float crack = 1.0 - smoothstep(0.0, 0.004, voronoiEdge(wq * 3.0, vec2(3.0), 1.0));
  crack *= smoothstep(0.1, 0.6, fbm(uv + 7.0, vec2(3.0), 4) * 0.5 + 0.5) * uCracks;
  float stain = smoothstep(0.55, 0.85, fbm(uv + 13.0, vec2(2.0), 5) * 0.5 + 0.5) * uStains;
  float stainRing = stroke(fbm(uv + 13.0, vec2(2.0), 5) * 0.5 + 0.5 - 0.6, 0.0, 0.01) * uStains;
  vec3 col = vec3(uColor) * (0.92 + 0.08 * trowel + 0.05 * fine + 0.03 * grit);
  col = mix(col, col * vec3(0.82, 0.74, 0.6), stain * 0.45);
  col = mix(col, col * vec3(0.7, 0.6, 0.45), stainRing * 0.4);
  col *= 1.0 - crack * 0.55;
  s.albedo = col;
  s.height = 0.5 + trowel * 0.12 + fine * 0.05 + grit * 0.03 - crack * 0.3;
  s.rough = uRough + fine * 0.04 - stain * 0.1;
  s.metal = 0.0;
  s.ao = 1.0 - crack * 0.5;
}
`,
  };
}

export function velvet({ color = [0.09, 0.12, 0.3], crush = 0.5, pattern = 0, size } = {}) {
  return {
    key: `velvet:${color}:${crush}:${pattern}`,
    size, normalStrength: 0.5,
    uniforms: { uColor: color, uCrush: crush, uPattern: pattern },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  // pile direction variation (crushed velvet) + fine weave
  float crushN = fbm(uv + vec2(fbm(uv, vec2(3.0), 3) * 0.3), vec2(6.0), 5) * 0.5 + 0.5;
  vec2 wv = fract(uv * 256.0);
  float weave = (sin(uv.x * 256.0 * TAU) * sin(uv.y * 256.0 * TAU)) * 0.5 + 0.5;
  float fib = vnoise(uv * vec2(700.0, 700.0), vec2(700.0));
  vec3 col = vec3(uColor) * mix(1.0, 0.55 + 0.9 * crushN, uCrush);
  col *= 0.94 + 0.06 * fib;
  // optional woven stripe (pattern 1) — subtle moiré stripes like Victorian upholstery
  if (uPattern > 0.5) {
    float st = smoothstep(0.45, 0.5, abs(fract(uv.x * 12.0) - 0.5));
    col *= 1.0 - st * 0.18;
  }
  s.albedo = col;
  s.height = 0.5 + 0.12 * weave + 0.08 * fib + 0.1 * crushN * uCrush;
  s.rough = 0.78 + 0.18 * (1.0 - crushN) * uCrush;
  s.metal = 0.0;
  s.ao = 0.9 + 0.1 * weave;
}
`,
  };
}

export function brass({ color = [0.88, 0.7, 0.4], tarnish = 0.22, polish = 0.7, scratches = 0.35, size } = {}) {
  return {
    key: `brass:${color}:${tarnish}:${polish}:${scratches}`,
    size, normalStrength: 0.25,
    uniforms: { uColor: color, uTarnish: tarnish, uPolish: polish, uScratch: scratches },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float t = smoothstep(0.45, 0.85, fbm(uv, vec2(6.0), 5) * 0.5 + 0.5) * uTarnish;
  float spots = smoothstep(0.75, 0.92, fbm(uv + 3.0, vec2(24.0), 4) * 0.5 + 0.5) * uTarnish;
  float sc = 0.0;
  for (int i = 0; i < 3; i++) {
    float a = float(i) * 1.1 + 0.4;
    vec2 r = rot2(a) * uv;
    sc = max(sc, smoothstep(0.93, 1.0, vnoise(r * vec2(3.0, 500.0) + float(i) * 7.0, vec2(1e4))));
  }
  sc *= uScratch;
  float fp = smoothstep(0.6, 0.9, fbm(uv + 11.0, vec2(10.0), 4) * 0.5 + 0.5);
  vec3 col = vec3(uColor) * (0.92 + 0.1 * fbm(uv + 1.0, vec2(24.0), 3));
  col = mix(col, col * vec3(0.55, 0.45, 0.3), t * 0.8);
  col = mix(col, vec3(0.2, 0.26, 0.18), spots * 0.35);
  s.albedo = col;
  s.metal = 1.0 - t * 0.4 - spots * 0.4;
  s.rough = mix(0.5, 0.12, uPolish) + t * 0.35 + fp * 0.08 + sc * 0.15;
  s.height = 0.5 - sc * 0.15;
  s.ao = 1.0 - t * 0.2;
}
`,
  };
}

export function glass({ dirt = 0.4, tint = [0.95, 0.97, 1.0], size } = {}) {
  return {
    key: `glass:${dirt}:${tint}`,
    size, normalStrength: 0.15,
    uniforms: { uDirt: dirt, uTint: tint },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float smudge = smoothstep(0.4, 0.9, fbm(uv, vec2(4.0), 5) * 0.5 + 0.5) * uDirt;
  float dust = vnoise(uv * 300.0, vec2(300.0));
  float drip = smoothstep(0.8, 1.0, vnoise(uv * vec2(40.0, 3.0), vec2(40.0, 3.0))) * uDirt * 0.5;
  // old crown glass ripples
  float ripple = fbm(uv, vec2(2.0, 8.0), 4);
  s.albedo = vec3(uTint) * (1.0 - smudge * 0.15);
  s.rough = 0.04 + smudge * 0.35 + dust * 0.05 * uDirt + drip * 0.2;
  s.metal = 0.0;
  s.height = 0.5 + ripple * 0.2;
  s.ao = 1.0;
}
`,
  };
}

export function wax({ color = [0.9, 0.85, 0.72], drips = 0.6, size } = {}) {
  return {
    key: `wax:${color}:${drips}`,
    size, normalStrength: 0.8,
    uniforms: { uColor: color, uDrips: drips },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  // v runs up the candle; drips are vertical runs from the top
  float x = uv.x * 10.0;
  float id = floor(x);
  float len = hash11(id * 1.3) * 0.7 * uDrips;
  float wid = 0.25 + 0.2 * hash11(id * 2.1);
  float dx = abs(fract(x) - 0.5) / wid;
  float drip = smoothstep(1.0, 0.6, dx) * smoothstep(1.0 - len - 0.05, 1.0 - len + 0.02, uv.y);
  float blob = smoothstep(1.0, 0.0, length(vec2((fract(x) - 0.5) / wid, (uv.y - (1.0 - len)) * 20.0)));
  float h = max(drip, blob) * step(0.05, len);
  float n = fbm(uv, vec2(6.0, 12.0), 4) * 0.5 + 0.5;
  s.albedo = vec3(uColor) * (0.95 + 0.07 * n) * (1.0 + h * 0.04);
  s.height = 0.5 + h * 0.35 + n * 0.05;
  s.rough = 0.42 - h * 0.12 + n * 0.08;
  s.metal = 0.0;
  s.ao = 1.0;
}
`,
  };
}

export function leather({ color = [0.24, 0.1, 0.06], wear = 0.4, buttons = 0, size } = {}) {
  return {
    key: `leather:${color}:${wear}:${buttons}`,
    size, normalStrength: 1.4,
    uniforms: { uColor: color, uWear: wear, uButtons: buttons },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec4 v = voronoi(uv * 90.0, vec2(90.0), 0.9);
  float pebble = smoothstep(0.0, 0.35, v.y - v.x);
  float crease = 1.0 - smoothstep(0.0, 0.01, abs(fbm(uv, vec2(3.0), 5)));
  float w = smoothstep(0.45, 0.85, fbm(uv + 2.0, vec2(3.0), 5) * 0.5 + 0.5) * uWear;
  vec3 col = vec3(uColor) * (0.85 + 0.25 * pebble);
  col = mix(col, col * 1.45 + 0.02, w * 0.6);
  col *= 1.0 - crease * 0.35;
  float h = pebble * 0.25 - crease * 0.3;
  float ao = 1.0;
  if (uButtons > 0.5) { // chesterfield tufting
    vec2 g = uv * 4.0; g.x += step(1.0, mod(floor(g.y), 2.0)) * 0.5;
    vec2 c = fract(g) - 0.5;
    float r = length(c);
    float puff = 1.0 - smoothstep(0.0, 0.7, r);
    h += puff * 0.6 - (1.0 - smoothstep(0.0, 0.06, r)) * 0.5;
    float fold = stroke(min(abs(c.x + c.y), abs(c.x - c.y)), 0.0, 0.015) * smoothstep(0.5, 0.15, r);
    h -= fold * 0.15;
    ao = mix(0.45, 1.0, smoothstep(0.02, 0.4, r)) * (1.0 - fold * 0.3);
    col *= mix(0.55, 1.08, puff);
  }
  s.albedo = col;
  s.height = 0.5 + h;
  s.rough = 0.55 - w * 0.2 + pebble * 0.1;
  s.metal = 0.0;
  s.ao = ao;
}
`,
  };
}

export function brick({ color = [0.42, 0.18, 0.12], mortar = [0.45, 0.42, 0.38], rows = 8, cols = 4, soot = 0.3, size } = {}) {
  return {
    key: `brick:${color}:${mortar}:${rows}:${cols}:${soot}`,
    size, normalStrength: 2.0,
    uniforms: { uColor: color, uMortar: mortar, uRows: rows, uCols: cols, uSoot: soot },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float r = floor(uv.y * uRows);
  vec2 g = vec2(uv.x * uCols + 0.5 * mod(r, 2.0), uv.y * uRows);
  vec2 id = vec2(mod(floor(g.x), uCols), r);
  vec2 f = fract(g);
  vec2 sz = vec2(1.0 / uCols, 1.0 / uRows);
  float ex = min(f.x, 1.0 - f.x) * sz.x;
  float ey = min(f.y, 1.0 - f.y) * sz.y;
  float e = min(ex, ey);
  float chip = fbm(uv + id.x * 0.1, vec2(32.0), 4) * 0.004;
  float mortarM = 1.0 - smoothstep(0.004, 0.0065, e + chip);
  float h1 = hash12(id + 0.3);
  vec3 bc = vec3(uColor) * (0.75 + 0.45 * h1);
  bc = mix(bc, bc * vec3(1.2, 0.95, 0.8), hash12(id + 4.0) * 0.4);
  float n = fbm(uv, vec2(48.0), 4) * 0.5 + 0.5;
  bc *= 0.85 + 0.25 * n;
  float burn = smoothstep(0.6, 1.0, hash12(id * 1.7));
  bc = mix(bc, bc * 0.45, burn * 0.5);
  vec3 mc = vec3(uMortar) * (0.8 + 0.3 * vnoise(uv * 300.0, vec2(300.0)));
  vec3 col = mix(bc, mc, mortarM);
  float sootM = smoothstep(0.3, 0.9, fbm(uv + 7.0, vec2(2.0), 5) * 0.5 + 0.5) * uSoot;
  col *= 1.0 - sootM * 0.6;
  s.albedo = col;
  s.height = mix(0.8 + n * 0.12 - smoothstep(0.02, 0.0, e) * 0.2, 0.2 + n * 0.05, mortarM);
  s.rough = mix(0.8, 0.95, mortarM);
  s.metal = 0.0;
  s.ao = mix(1.0, 0.55, mortarM);
}
`,
  };
}

export function stone({ color = [0.42, 0.4, 0.37], rows = 4, cols = 2, moss = 0.15, damp = 0.3, size } = {}) {
  return {
    key: `stone:${color}:${rows}:${cols}:${moss}:${damp}`,
    size, normalStrength: 2.5,
    uniforms: { uColor: color, uRows: rows, uCols: cols, uMoss: moss, uDamp: damp },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float r = floor(uv.y * uRows);
  vec2 g = vec2(uv.x * uCols + 0.5 * mod(r, 2.0) + 0.17 * hash11(r) * 0.0, uv.y * uRows);
  vec2 id = vec2(mod(floor(g.x), uCols), r);
  vec2 f = fract(g);
  vec2 sz = vec2(1.0 / uCols, 1.0 / uRows);
  float ex = min(f.x, 1.0 - f.x) * sz.x, ey = min(f.y, 1.0 - f.y) * sz.y;
  float rough = fbm(uv + id.x * 0.37, vec2(16.0), 6);
  float e = min(ex, ey) + rough * 0.012;
  float joint = 1.0 - smoothstep(0.004, 0.012, e);
  float face = smoothstep(0.0, 0.05, e);
  float n = fbm(uv, vec2(24.0), 5) * 0.5 + 0.5;
  vec3 col = vec3(uColor) * (0.75 + 0.4 * hash12(id)) * (0.8 + 0.35 * n);
  float mossM = smoothstep(0.55, 0.85, fbm(uv + 3.0, vec2(4.0), 5) * 0.5 + 0.5 + (1.0 - face) * 0.3) * uMoss;
  col = mix(col, vec3(0.12, 0.16, 0.07), mossM);
  float dampM = smoothstep(0.4, 0.0, uv.y) * uDamp;
  col *= 1.0 - dampM * 0.35;
  col = mix(col, col * 0.4, joint);
  s.albedo = col;
  s.height = 0.25 + 0.55 * face * (0.7 + 0.3 * rough) - joint * 0.2;
  s.rough = 0.88 - dampM * 0.35;
  s.metal = 0.0;
  s.ao = mix(0.4, 1.0, face);
}
`,
  };
}

export function checker({ tiles = 4, a = 'carrara', b = 'nero', polish = 0.8, grout = [0.5, 0.48, 0.44], diagonal = false, size } = {}) {
  const A = MARBLE_TYPES[a] || MARBLE_TYPES.carrara, B = MARBLE_TYPES[b] || MARBLE_TYPES.nero;
  return {
    key: `checker:${tiles}:${a}:${b}:${polish}:${grout}:${diagonal}`,
    size, normalStrength: 0.6,
    uniforms: { uTiles: Math.max(2, Math.round(tiles / 2) * 2), uA: A.base, uAV: A.vein, uB: B.base, uBV: B.vein, uPolish: polish, uGrout: grout, uDiag: diagonal ? 1 : 0 },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  if (uDiag > 0.5) p = rot2(PI * 0.25) * (uv) * 1.41421356;
  vec2 g = p * uTiles;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float which = mod(id.x + id.y, 2.0);
  vec2 off = hash22(id) * 10.0;
  vec2 w = vec2(fbm(uv + off * 0.01, vec2(uTiles), 5), fbm(uv + 3.0 + off * 0.01, vec2(uTiles), 5));
  float v = fbm(uv + w * 0.2 + off * 0.003, vec2(uTiles * 2.0), 6);
  float veins = 1.0 - smoothstep(0.0, 0.04, abs(v));
  float cloud = fbm(uv + w * 0.3, vec2(uTiles * 3.0), 4) * 0.5 + 0.5;
  vec3 base = which < 0.5 ? vec3(uA) : vec3(uB);
  vec3 vein = which < 0.5 ? vec3(uAV) : vec3(uBV);
  vec3 col = base * (0.9 + 0.15 * cloud);
  col = mix(col, vein, veins * 0.6);
  float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) / uTiles;
  float groutM = 1.0 - smoothstep(0.0008, 0.0016, e);
  col = mix(col, vec3(uGrout), groutM);
  s.albedo = col;
  s.height = mix(0.6 + cloud * 0.02, 0.3, groutM);
  s.rough = mix(mix(0.5, 0.05, uPolish) + cloud * 0.05 + veins * 0.03, 0.85, groutM);
  s.metal = 0.0;
  s.ao = mix(1.0, 0.6, groutM);
}
`,
  };
}
