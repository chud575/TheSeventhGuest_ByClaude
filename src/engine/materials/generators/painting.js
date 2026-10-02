// Procedurally "painted" aged oil canvases: brush-stroke domain warping,
// yellowed varnish, craquelure. NOT tileable. Subjects:
//   0 stormy landscape with a ruined castle on a crag under the moon
//   1 Victorian portrait (dark ground, lit face, black coat, white cravat)
//   2 seascape: ship in a storm
//   3 still life: fruit, ewer and a skull (memento mori)

export function painting({ subject = 0, seed = 1, aspect = 0.8, varnish = 0.6, cracks = 0.5, palette = null, size } = {}) {
  return {
    key: `painting:${subject}:${seed}:${aspect}:${varnish}:${cracks}:${palette}`,
    size, aspect, tile: false, seed,
    normalStrength: 0.5,
    uniforms: { uSubject: subject, uVarnish: varnish, uCracks: cracks, uPal: palette || [1, 1, 1] },
    glsl: /* glsl */ `
float nz(vec2 p) { return gnoise(p, vec2(1e4)); }
float fb(vec2 p, int o) { float s = 0.0, a = 0.5; for (int i = 0; i < 8; i++) { if (i >= o) break; s += a * nz(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }

// brush-stroke warp: short directional smears
vec2 brush(vec2 uv, float scale, float amt) {
  float a = fb(uv * scale * 0.5 + uSeed, 3) * PI * 2.0;
  vec2 dir = vec2(cos(a), sin(a));
  float st = fb(uv * scale * 4.0 + uSeed * 3.0, 2);
  return uv + dir * st * amt;
}

vec3 landscape(vec2 uv) {
  vec2 p = uv;
  // sky: stormy gradient, moon glow
  vec2 moon = vec2(0.68 + 0.1 * sin(uSeed), 0.78);
  float md = length((p - moon) * vec2(uAspect, 1.0));
  float clouds = fb(p * vec2(3.0, 6.0) + vec2(uSeed, 0.0), 6);
  vec3 sky = mix(vec3(0.05, 0.06, 0.07), vec3(0.32, 0.3, 0.24), smoothstep(0.35, 1.0, p.y));
  sky = mix(sky, vec3(0.62, 0.58, 0.44), exp(-md * 7.0) * 0.8);
  sky = mix(sky, vec3(0.03, 0.03, 0.035), smoothstep(-0.1, 0.4, clouds) * 0.7);
  sky += vec3(0.5, 0.45, 0.32) * smoothstep(0.1, 0.0, abs(clouds - 0.1)) * exp(-md * 3.0) * 0.6; // silver linings
  sky = mix(sky, vec3(0.9, 0.86, 0.7), smoothstep(0.045, 0.035, md));
  // distant mountains
  float m1 = 0.42 + 0.08 * fb(vec2(p.x * 3.0 + uSeed, 0.0), 5);
  vec3 col = sky;
  col = mix(col, vec3(0.1, 0.11, 0.1), smoothstep(m1 + 0.005, m1 - 0.005, p.y));
  // crag with castle
  float cx = 0.3 + 0.08 * sin(uSeed * 2.0);
  float crag = 0.25 + 0.3 * exp(-pow((p.x - cx) * 5.0, 2.0)) + 0.04 * fb(vec2(p.x * 9.0, 1.0), 4);
  vec3 rock = mix(vec3(0.06, 0.05, 0.04), vec3(0.18, 0.15, 0.1), smoothstep(0.0, 0.5, fb(p * 12.0, 4) + (p.x - cx) * 2.0));
  col = mix(col, rock, smoothstep(crag + 0.004, crag - 0.004, p.y));
  // castle silhouette (towers + crenellations)
  float top = 0.25 + 0.3;
  float bx = (p.x - cx) * uAspect;
  float keep = sdBox(vec2(bx, p.y - (top + 0.06)), vec2(0.05, 0.08));
  float t1 = sdBox(vec2(bx + 0.08, p.y - (top + 0.1)), vec2(0.018, 0.12));
  float t2 = sdBox(vec2(bx - 0.085, p.y - (top + 0.05)), vec2(0.02, 0.07));
  float cren = sdBox(vec2(fract(bx * 40.0) - 0.5, p.y - (top + 0.145)), vec2(0.25, 0.01));
  float castle = min(min(keep, t1), t2);
  castle = min(castle, max(cren, sdBox(vec2(bx, p.y - (top + 0.14)), vec2(0.05, 0.02))));
  float roof = sdBox(vec2(bx + 0.08, p.y - (top + 0.23 - abs(bx + 0.08) * 1.5)), vec2(0.03, 0.02));
  castle = min(castle, roof);
  col = mix(col, vec3(0.025, 0.022, 0.02), smoothstep(0.003, -0.003, castle));
  // a lit window
  float win = sdBox(vec2(bx - 0.01, p.y - (top + 0.08)), vec2(0.006, 0.01));
  col = mix(col, vec3(0.9, 0.6, 0.25), smoothstep(0.003, 0.0, win));
  // foreground: dark lake reflecting the moon, trees at left
  float shore = 0.2 + 0.02 * fb(vec2(p.x * 6.0, 3.0), 3);
  if (p.y < shore) {
    float ripple = fb(vec2(p.x * 4.0, p.y * 60.0), 3);
    vec3 refl = mix(vec3(0.03, 0.035, 0.04), vec3(0.4, 0.38, 0.3), exp(-abs(p.x - moon.x) * 12.0) * smoothstep(0.0, 0.2, p.y) * (0.5 + 0.5 * ripple));
    col = refl;
  }
  float tree = p.y - (0.15 + 0.6 * smoothstep(0.18, 0.0, p.x) + 0.1 * fb(p * 14.0, 4));
  col = mix(col, vec3(0.02, 0.025, 0.018), smoothstep(0.01, -0.01, tree));
  return col;
}

vec3 portrait(vec2 uv) {
  // Victorian gentleman, three-quarter light from the upper left (Rembrandt lighting)
  vec2 p = (uv - vec2(0.5, 0.5)) * vec2(uAspect, 1.0);
  // warm umber ground with a glow behind the head
  vec3 col = mix(vec3(0.05, 0.04, 0.03), vec3(0.24, 0.17, 0.09), exp(-length((p - vec2(-0.06, 0.16)) * vec2(1.0, 0.8)) * 2.6));
  col *= 0.85 + 0.25 * fb(uv * 4.0 + uSeed, 4);
  // shoulders / frock coat (wide soft ellipse cut by the canvas bottom)
  float coat = sdEllipse(p - vec2(0.0, -0.5), vec2(0.46, 0.36));
  vec3 coatCol = vec3(0.035, 0.03, 0.035) + vec3(0.06, 0.055, 0.06) * smoothstep(0.2, -0.3, p.x) * fb(uv * 18.0, 3);
  // lapels (lighter V edges)
  float lapelL = abs(p.x + 0.06 - (p.y + 0.3) * 0.45) - 0.012;
  float lapelR = abs(p.x - 0.06 + (p.y + 0.3) * 0.45) - 0.012;
  coatCol += vec3(0.05) * (1.0 - smoothstep(0.0, 0.02, min(lapelL, lapelR))) * step(p.y, -0.17);
  col = mix(col, coatCol, smoothstep(0.015, -0.015, coat));
  // shirt front + cravat (white V between the lapels)
  float vee = max(abs(p.x) - (p.y + 0.42) * 0.42, p.y + 0.15);
  vec3 linen = vec3(0.82, 0.78, 0.68) * (0.65 + 0.45 * smoothstep(0.1, -0.1, p.x)) * (0.85 + 0.25 * fb(uv * 30.0, 3));
  col = mix(col, linen, smoothstep(0.01, -0.01, vee) * step(-0.62, p.y));
  float cravat = sdEllipse(p - vec2(0.0, -0.14), vec2(0.07, 0.045));
  col = mix(col, linen * 1.05, smoothstep(0.01, -0.01, cravat));
  // neck
  float neck = sdBox(p - vec2(0.005, -0.075), vec2(0.045, 0.06));
  // head: egg shape tilted slightly
  vec2 hp = rot2(0.06) * (p - vec2(0.0, 0.07));
  float head = sdEllipse(hp, vec2(0.105, 0.14));
  vec2 hn = hp / vec2(0.105, 0.14);                          // -1..1 inside the head
  float light = clamp(0.62 - hn.x * 0.75 + hn.y * 0.25 - dot(hn, hn) * 0.25, 0.0, 1.0);
  vec3 skin = mix(vec3(0.16, 0.08, 0.05), vec3(0.86, 0.64, 0.48), pow(light, 0.9));
  // features (soft, painterly)
  float browL = sdEllipse(hn - vec2(-0.38, 0.22), vec2(0.28, 0.07));
  float browR = sdEllipse(hn - vec2(0.38, 0.22), vec2(0.26, 0.07));
  float sockL = sdEllipse(hn - vec2(-0.36, 0.08), vec2(0.22, 0.12));
  float sockR = sdEllipse(hn - vec2(0.36, 0.08), vec2(0.2, 0.12));
  skin *= mix(0.55, 1.0, smoothstep(-0.02, 0.12, min(sockL, sockR)));
  skin = mix(skin, vec3(0.12, 0.08, 0.06), (1.0 - smoothstep(-0.02, 0.03, min(browL, browR))) * 0.7);
  float eyeL = sdEllipse(hn - vec2(-0.35, 0.07), vec2(0.11, 0.045));
  float eyeR = sdEllipse(hn - vec2(0.35, 0.07), vec2(0.1, 0.045));
  skin = mix(skin, vec3(0.06, 0.04, 0.035), 1.0 - smoothstep(-0.01, 0.02, min(eyeL, eyeR)));
  skin = mix(skin, vec3(0.75, 0.68, 0.6) * light, (1.0 - smoothstep(-0.005, 0.005, length(hn - vec2(-0.32, 0.085)) - 0.018)) * 0.8);
  // nose: lit ridge + cast shadow to the right
  float noseRidge = sdSegment(hn, vec2(-0.02, 0.05), vec2(0.04, -0.32)) - 0.05;
  float noseShadow = sdSegment(hn, vec2(0.1, 0.0), vec2(0.16, -0.34)) - 0.06;
  skin = mix(skin, skin * 1.15, (1.0 - smoothstep(0.0, 0.05, noseRidge)) * 0.6);
  skin *= mix(0.6, 1.0, smoothstep(0.0, 0.08, noseShadow));
  float nostril = sdEllipse(hn - vec2(0.03, -0.38), vec2(0.12, 0.05));
  skin *= mix(0.65, 1.0, smoothstep(0.0, 0.04, nostril));
  // mouth with a thin, unsmiling line + moustache shadow
  float mouth = sdEllipse(hn - vec2(0.02, -0.6), vec2(0.26, 0.025));
  skin = mix(skin, vec3(0.2, 0.08, 0.06), 1.0 - smoothstep(-0.01, 0.03, mouth));
  float stache = sdEllipse(hn - vec2(0.02, -0.5), vec2(0.32, 0.06));
  skin = mix(skin, vec3(0.1, 0.075, 0.06), (1.0 - smoothstep(-0.02, 0.04, stache)) * 0.75);
  // receding hair, grey at the temples, mutton-chop sideburns
  float scalp = hn.y - 0.5 + 0.25 * hn.x * hn.x;
  float sideburn = max(abs(hn.x) - 0.82, 0.0) * step(hn.y, 0.45) * step(-0.45, hn.y);
  float hairM = smoothstep(-0.05, 0.08, scalp) * 0.85 + step(0.0001, sideburn);
  vec3 hairCol = mix(vec3(0.07, 0.06, 0.05), vec3(0.42, 0.4, 0.37), smoothstep(0.4, 0.9, abs(hn.x))) * (0.6 + 0.6 * light);
  skin = mix(skin, hairCol, clamp(hairM, 0.0, 1.0));
  skin *= 0.9 + 0.2 * fb(uv * 40.0, 3);
  float faceM = smoothstep(0.012, -0.012, min(head, neck));
  vec3 neckCol = mix(vec3(0.1, 0.05, 0.035), vec3(0.55, 0.38, 0.27), smoothstep(0.05, -0.05, p.x));
  col = mix(col, neckCol, smoothstep(0.01, -0.01, neck) * (1.0 - smoothstep(0.01, -0.01, head)));
  col = mix(col, skin, smoothstep(0.012, -0.012, head));
  // painted oval spandrel
  float oval = sdEllipse((uv - 0.5) * vec2(uAspect, 1.0), vec2(0.46 * uAspect, 0.47));
  col = mix(col, vec3(0.03, 0.025, 0.02), smoothstep(-0.02, 0.03, oval));
  return col;
}

vec3 seascape(vec2 uv) {
  vec2 p = uv;
  float clouds = fb(p * vec2(2.5, 5.0) + uSeed, 6);
  vec3 sky = mix(vec3(0.08, 0.08, 0.07), vec3(0.45, 0.4, 0.3), smoothstep(0.4, 1.0, p.y) * (0.5 + 0.5 * clouds));
  sky = mix(sky, vec3(0.6, 0.55, 0.42), smoothstep(0.2, 0.6, clouds) * smoothstep(0.5, 0.9, p.y) * 0.5);
  float horizon = 0.38 + 0.02 * sin(p.x * 3.0 + uSeed);
  vec3 col = sky;
  if (p.y < horizon + 0.05 * fb(vec2(p.x * 8.0, 0.0), 3)) {
    float waves = fb(vec2(p.x * 6.0, p.y * 18.0) + uSeed, 6);
    float crest = smoothstep(0.25, 0.45, waves) * smoothstep(0.0, 0.3, p.y);
    col = mix(vec3(0.03, 0.05, 0.05), vec3(0.12, 0.16, 0.14), smoothstep(-0.4, 0.4, waves));
    col = mix(col, vec3(0.7, 0.68, 0.6), crest * 0.6);
  }
  // ship
  vec2 sp = (p - vec2(0.58, horizon + 0.02)) * vec2(uAspect, 1.0);
  sp = rot2(0.18) * sp;
  float hull = sdBox(sp - vec2(0.0, 0.0), vec2(0.1, 0.02)) ;
  float mast = min(sdBox(sp - vec2(-0.03, 0.12), vec2(0.004, 0.12)), sdBox(sp - vec2(0.04, 0.1), vec2(0.004, 0.1)));
  float sail = min(sdBox(sp - vec2(-0.03, 0.13), vec2(0.045, 0.05)), sdBox(sp - vec2(0.04, 0.11), vec2(0.035, 0.04)));
  col = mix(col, vec3(0.04, 0.03, 0.02), smoothstep(0.004, -0.004, min(hull, mast)));
  col = mix(col, vec3(0.55, 0.5, 0.4) * (0.6 + 0.4 * fb(uv * 30.0, 2)), smoothstep(0.004, -0.004, sail));
  return col;
}

vec3 stillLife(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  vec3 col = mix(vec3(0.03, 0.025, 0.02), vec3(0.14, 0.1, 0.06), exp(-length(p - vec2(-0.25, 0.2)) * 3.0));
  float table = p.y + 0.18;
  col = mix(col, vec3(0.12, 0.05, 0.03) * (0.7 + 0.5 * fb(uv * vec2(4.0, 40.0), 3)), smoothstep(0.005, -0.005, table));
  // skull
  vec2 sk = p - vec2(0.1, -0.08);
  float skull = min(sdEllipse(sk - vec2(0.0, 0.03), vec2(0.1, 0.09)), sdBox(sk - vec2(0.0, -0.05), vec2(0.055, 0.04)));
  float eyeS = min(length(sk - vec2(-0.035, -0.01)) - 0.022, length(sk - vec2(0.035, -0.01)) - 0.022);
  float litS = clamp(0.6 - sk.x * 4.0 + sk.y * 3.0, 0.15, 1.0);
  col = mix(col, vec3(0.72, 0.64, 0.5) * litS, smoothstep(0.004, -0.004, skull));
  col = mix(col, vec3(0.02), smoothstep(0.004, -0.004, eyeS) * step(skull, 0.0));
  // apples / grapes
  for (int i = 0; i < 3; i++) {
    vec2 c = vec2(-0.2 + float(i) * 0.07, -0.14 + 0.02 * float(i % 2));
    float a = length(p - c) - 0.035;
    float l = clamp(0.7 - (p.x - c.x) * 15.0 + (p.y - c.y) * 12.0, 0.1, 1.0);
    col = mix(col, vec3(0.45, 0.1, 0.05) * l, smoothstep(0.003, -0.003, a));
  }
  // ewer
  vec2 e = p - vec2(-0.08, 0.02);
  float ewer = sdEllipse(e - vec2(0.0, -0.06), vec2(0.06, 0.1));
  ewer = min(ewer, sdBox(e - vec2(0.0, 0.08), vec2(0.02, 0.06)));
  float litE = clamp(0.5 - e.x * 6.0, 0.08, 1.0);
  col = mix(col, vec3(0.55, 0.42, 0.2) * litE + vec3(0.9, 0.8, 0.5) * smoothstep(0.012, 0.0, abs(e.x + 0.025)) * step(ewer, 0.0) * 0.4, smoothstep(0.004, -0.004, ewer));
  return col;
}

void surface(vec2 uv, inout Surface s) {
  vec2 b = brush(uv, 6.0, 0.012);
  b = brush(b, 22.0, 0.003);
  vec3 col;
  if (uSubject < 0.5) col = landscape(b);
  else if (uSubject < 1.5) col = portrait(b);
  else if (uSubject < 2.5) col = seascape(b);
  else col = stillLife(b);
  col *= vec3(uPal);
  // lift the darks a little: these are read under candlelight, not gallery lights
  col = pow(max(col, 0.0), vec3(0.85)) * 1.3;
  // impasto stroke texture
  float strokes = fb(rot2(fb(uv * 3.0, 2)) * uv * vec2(60.0, 18.0), 3);
  float canvasW = (sin(uv.x * uResolution.x * 0.9) * sin(uv.y * uResolution.y * 0.9)) * 0.5 + 0.5;
  col *= 0.92 + 0.12 * strokes;
  // varnish: yellow/brown, darker at edges (frame rebate) + grime
  float edge = min(min(uv.x, 1.0 - uv.x) * uAspect, min(uv.y, 1.0 - uv.y));
  vec3 varnish = vec3(1.0, 0.82, 0.52);
  col = mix(col, col * varnish * 0.9, uVarnish);
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.12, edge));
  // craquelure
  vec2 cq = uv * vec2(uAspect, 1.0) * 70.0;
  float cr = voronoiEdge(cq + vec2(fb(uv * 8.0, 3), fb(uv * 8.0 + 3.0, 3)) * 0.6, vec2(1e4), 1.0);
  float crackMask = smoothstep(0.35, 0.75, fb(uv * 3.0 + 7.0, 3) * 0.5 + 0.5 + 0.2);
  float crack = (1.0 - smoothstep(0.0, 0.03, cr)) * uCracks * crackMask;
  col *= 1.0 - crack * 0.35;
  s.albedo = col;
  s.height = 0.5 + strokes * 0.1 + canvasW * 0.05 - crack * 0.08;
  s.rough = 0.38 - uVarnish * 0.12 + crack * 0.3 + (1.0 - canvasW) * 0.05;
  s.metal = 0.0;
  s.ao = 1.0 - crack * 0.4;
}
`,
  };
}
