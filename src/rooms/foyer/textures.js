/**
 * Foyer-specific procedural textures (TextureForge GLSL + one canvas dial).
 * All authored for this room: leaded stained glass (fanlight sunburst, the great
 * Stauf-star window, diamond-quarry sidelights), the inlaid marble floor medallion
 * that carries the octagram puzzle, the stair carpet and the clock dial.
 */

// ------------------------------------------------------------------ shared GLSL
// Every window texture is generated twice: uMode 0 = transmitted colour (what the
// moon pushes through the glass: emissive map + light cookie), uMode 1 = the lit
// interior surface (oxidised lead came, near-black glass) with a came relief normal.
const GLASS_COMMON = /* glsl */ `
// seedy, streaky antique glass: returns a brightness modulation around 1
float antique(vec2 uv, float k) {
  float s = fbm(uv * vec2(2.0, 11.0) + k, vec2(2.0, 11.0), 4) * 0.5 + 0.5;      // vertical draw streaks
  float w = fbm(uv * 5.0 + k * 3.1, vec2(5.0), 3) * 0.5 + 0.5;                  // broad thickness waves
  float b = vnoise(uv * 160.0 + k * 7.0, vec2(160.0));                         // seeds (bubbles)
  float b2 = vnoise(uv * 90.0 + k * 3.0, vec2(90.0));
  return (0.7 + 0.38 * s) * (0.82 + 0.3 * w) - 0.07 * smoothstep(0.86, 0.97, b) + 0.04 * smoothstep(0.9, 0.99, b2);
}
// per-pane value + slight hue jitter (each piece of glass was cut from a different sheet)
vec3 paneJitter(vec3 c, vec2 id) {
  float h = hash12(id * 1.37 + 0.71);
  float h2 = hash12(id * 2.91 + 5.3);
  c *= 0.72 + 0.5 * h;
  c *= vec3(1.0 + (h2 - 0.5) * 0.18, 1.0, 1.0 - (h2 - 0.5) * 0.18);
  return c;
}
vec3 glassPal(float i) {
  // muted Victorian cathedral glass:
  // 0 oxblood, 1 cobalt, 2 amber, 3 bottle green, 4 smoky violet, 5 pale seedy (greenish clear), 6 old gold, 7 opal cream
  if (i < 0.5) return vec3(0.36, 0.045, 0.05);
  if (i < 1.5) return vec3(0.06, 0.11, 0.38);
  if (i < 2.5) return vec3(0.62, 0.36, 0.09);
  if (i < 3.5) return vec3(0.07, 0.24, 0.13);
  if (i < 4.5) return vec3(0.2, 0.11, 0.26);
  if (i < 5.5) return vec3(0.46, 0.52, 0.5);
  if (i < 6.5) return vec3(0.7, 0.52, 0.2);
  return vec3(0.62, 0.58, 0.46);
}
float leadLine(float d, float w) { return 1.0 - smoothstep(w * 0.55, w, abs(d)); }
void glassOut(inout Surface s, vec2 uv, vec3 col, float lead, float alpha) {
  lead = clamp(lead, 0.0, 1.0);
  if (uMode < 0.5) {
    s.albedo = mix(col, vec3(0.0), lead);
  } else {
    float ox = fbm(uv * 23.0, vec2(23.0), 3) * 0.5 + 0.5;
    vec3 came = mix(vec3(0.11, 0.105, 0.1), vec3(0.24, 0.23, 0.21), ox) * (0.75 + 0.25 * lead);
    // a little white putty/cement squeezed out along the came
    float putty = smoothstep(0.15, 0.3, lead) * (1.0 - smoothstep(0.3, 0.5, lead)) * step(0.7, ox);
    came = mix(came, vec3(0.32, 0.31, 0.28), putty * 0.5);
    s.albedo = mix(vec3(0.012, 0.013, 0.016), came, smoothstep(0.25, 0.6, lead));
  }
  s.alpha = alpha;
  s.height = 0.25 + 0.65 * sqrt(lead);
  s.rough = mix(uMode > 0.5 ? 0.3 : 0.06, 0.42, lead);
  s.metal = lead * 0.7;
  s.ao = 1.0;
}
`;

/** Fanlight over the front door: a half sunburst. UV covers the bounding rect (aspect 2:1). */
export function fanlightTexture(forge, mode = 0) {
  return forge.generate(`foyer:fanlight2:${mode}`, {
    size: 1024, aspect: 2, tile: false, uniforms: { uMode: mode }, normalStrength: 2.5,
    glsl: GLASS_COMMON + /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = vec2(uv.x * 2.0 - 1.0, uv.y);          // semicircle radius 1, centre at bottom middle
  float r = length(p);
  float a = atan(p.y, p.x);                       // 0..PI
  float lead = 0.0;
  vec3 col;
  vec2 id;
  float n = antique(uv, 1.0);
  if (r < 0.24) {
    float petals = abs(sin(a * 6.0)) * 0.07 + 0.1;
    col = r < petals ? glassPal(0.0) : glassPal(6.0);
    id = vec2(r < petals ? 1.0 : 2.0, 0.0);
    lead = max(lead, leadLine(r - petals, 0.012));
  } else if (r < 0.86) {
    float k = a / PI * 12.0;
    float idr = floor(k);
    float f = fract(k);
    float tip = step(0.71, r);
    col = mod(idr, 2.0) < 0.5 ? glassPal(5.0) : glassPal(7.0);
    col = mix(col, mod(idr, 2.0) < 0.5 ? glassPal(3.0) : glassPal(2.0), tip);
    id = vec2(idr, tip + 3.0);
    lead = max(lead, leadLine(min(f, 1.0 - f) * r * PI / 12.0, 0.011));
    lead = max(lead, leadLine(r - 0.71, 0.01));
  } else {
    float k = a / PI * 22.0;
    float f = fract(k);
    col = mod(floor(k), 2.0) < 0.5 ? glassPal(1.0) : glassPal(0.0);
    id = vec2(floor(k), 7.0);
    float jew = length(vec2((f - 0.5) * 0.14, r - 0.93));
    col = mix(col, glassPal(6.0), smoothstep(0.03, 0.026, jew));
    lead = max(lead, leadLine(jew - 0.03, 0.008));
    lead = max(lead, leadLine(min(f, 1.0 - f) * 0.14, 0.009));
  }
  lead = max(lead, leadLine(r - 0.24, 0.013));
  lead = max(lead, leadLine(r - 0.86, 0.014));
  lead = max(lead, leadLine(r - 0.985, 0.03));
  lead = max(lead, 1.0 - smoothstep(0.0, 0.02, p.y));
  col = paneJitter(col, id) * n;
  glassOut(s, uv, col, lead, step(r, 1.0));
}`,
  });
}

/** The great arched window over the door: leaded quarries, a jewel border and an eight-pointed star. aspect = w/h. */
export function greatWindowTexture(forge, aspect, mode = 0) {
  return forge.generate(`foyer:greatwindow2:${mode}`, {
    size: 1536, aspect, tile: false, uniforms: { uAsp: aspect, uMode: mode }, normalStrength: 2.5,
    glsl: GLASS_COMMON + /* glsl */ `
float sdStarPoly(vec2 p, float r) { return sdStar(p, r, 8.0, 3.0); }
void surface(vec2 uv, inout Surface s) {
  // metric coordinates: width 1 unit (=window width), height 1/uAsp
  vec2 m = vec2(uv.x - 0.5, uv.y / uAsp);
  float H = 1.0 / uAsp;
  float R = 0.5;                                      // arch radius
  float springY = H - R;
  float dRect = max(abs(m.x) - 0.5, -m.y);
  float dArch = length(m - vec2(0.0, springY)) - R;
  float inside = m.y < springY ? dRect : max(dArch, -m.y);
  float n = antique(uv * vec2(1.0, H), 3.0);
  float lead = 0.0;
  vec3 col;
  vec2 id = vec2(0.0);
  float edge = -inside;
  if (edge < 0.075) {
    // jewel border: oxblood / cobalt oblongs with amber squares
    float along = m.y < springY ? m.y : springY + atan(m.y - springY, abs(m.x) + 1e-4) * R;
    float k = along / 0.075;
    float f = fract(k);
    col = mod(floor(k), 2.0) < 0.5 ? glassPal(0.0) : glassPal(1.0);
    id = vec2(floor(k), sign(m.x) + 9.0);
    float sq = sdBox(vec2(f - 0.5, (edge - 0.0375) / 0.075), vec2(0.2));
    if (sq < 0.0) { col = glassPal(2.0); id += 50.0; }
    lead = max(lead, leadLine(sq, 0.03));
    lead = max(lead, leadLine(min(f, 1.0 - f) * 0.075, 0.006));
    lead = max(lead, leadLine(edge - 0.075, 0.007));
  } else {
    // diamond quarries of pale seedy glass, the odd smoky or green pane
    vec2 q = rot2(PI * 0.25) * (m * vec2(1.0, 0.72)) * 8.0;
    vec2 qf = fract(q) - 0.5;
    vec2 qi = floor(q);
    float h = hash12(qi + 3.1);
    col = glassPal(5.0);
    if (h > 0.9) col = glassPal(4.0) * 1.4; else if (h > 0.82) col = glassPal(3.0) * 1.6; else if (h > 0.76) col = glassPal(7.0);
    id = qi;
    lead = max(lead, leadLine((0.5 - max(abs(qf.x), abs(qf.y))) / 8.0, 0.0055));
    // central roundel: the octagram, amber on cobalt, oxblood eye
    vec2 c = m - vec2(0.0, H * 0.4);
    float rc = length(c);
    float ang = atan(c.y, c.x);
    if (rc < 0.315) {
      float st = sdStarPoly(c, 0.255);
      float seg = floor((ang / TAU + 0.5) * 16.0);
      if (rc < 0.075) { col = glassPal(0.0); id = vec2(70.0, 0.0); }
      else if (st < 0.0) { col = mod(seg, 2.0) < 0.5 ? glassPal(6.0) : glassPal(2.0); id = vec2(seg, 71.0); }
      else if (rc < 0.3) { col = glassPal(1.0); id = vec2(seg, 72.0); }
      else { col = glassPal(2.0) * 0.8; id = vec2(floor((ang / TAU + 0.5) * 24.0), 73.0); }
      lead = max(lead, leadLine(st, 0.007) * step(0.075, rc));
      lead = max(lead, leadLine(rc - 0.075, 0.008));
      float fa = fract((ang / TAU + 0.5) * 16.0);
      lead = max(lead, leadLine(min(fa, 1.0 - fa) * rc * TAU / 16.0, 0.005) * step(st, 0.0) * step(0.075, rc));
      float fb2 = fract((ang / TAU + 0.5) * 24.0);
      lead = max(lead, leadLine(min(fb2, 1.0 - fb2) * rc * TAU / 24.0, 0.005) * step(0.3, rc));
    }
    lead = max(lead, leadLine(rc - 0.3, 0.008));
    lead = max(lead, leadLine(rc - 0.315, 0.009));
    // arch head: radiating petals around an amber boss
    vec2 ar = m - vec2(0.0, springY);
    float ra = length(ar);
    if (m.y > springY && ra < R - 0.075) {
      float k = atan(ar.y, ar.x) / PI * 10.0;
      float f = fract(k);
      float ring = step(0.19, ra);
      col = ring > 0.5 ? (mod(floor(k), 2.0) < 0.5 ? glassPal(3.0) * 1.2 : glassPal(5.0) * 0.9) : glassPal(7.0);
      if (ra < 0.1) col = glassPal(2.0);
      id = vec2(floor(k), ring + (ra < 0.1 ? 5.0 : 0.0) + 80.0);
      lead = max(lead, leadLine(min(f, 1.0 - f) * ra * PI / 10.0, 0.006) * step(0.1, ra));
      lead = max(lead, leadLine(ra - 0.1, 0.007));
      lead = max(lead, leadLine(ra - 0.19, 0.007));
    }
    lead = max(lead, leadLine(m.y - springY, 0.009));
  }
  col = paneJitter(col, id) * n;
  glassOut(s, uv, col, lead, step(inside, 0.0));
}`,
  });
}

/** Sidelight panes: tall leaded diamonds with a roundel every metre. */
export function sidelightTexture(forge, aspect, mode = 0) {
  return forge.generate(`foyer:sidelight2:${mode}`, {
    size: 1024, aspect, tile: false, uniforms: { uAsp: aspect, uMode: mode }, normalStrength: 2.5,
    glsl: GLASS_COMMON + /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 m = vec2(uv.x - 0.5, uv.y / uAsp);
  float H = 1.0 / uAsp;
  float edge = min(0.5 - abs(m.x), min(m.y, H - m.y));
  float lead = 0.0;
  vec3 col;
  vec2 id;
  float n = antique(uv * vec2(1.0, H), 5.0);
  if (edge < 0.12) {
    float k = m.y / 0.24; float f = fract(k);
    col = step(0.5, fract(k * 0.5)) > 0.5 ? glassPal(0.0) : glassPal(3.0);
    id = vec2(floor(k), sign(m.x));
    lead = max(lead, leadLine(min(f, 1.0 - f) * 0.24, 0.016));
    lead = max(lead, leadLine(edge - 0.12, 0.018));
  } else {
    vec2 q = rot2(PI * 0.25) * vec2(m.x * 1.4, m.y) * 3.2;
    vec2 qf = fract(q) - 0.5;
    col = glassPal(5.0);
    id = floor(q);
    lead = max(lead, leadLine((0.5 - max(abs(qf.x), abs(qf.y))) / 3.2, 0.014));
    float cy = (floor(m.y / 0.9) + 0.5) * 0.9;
    float rc = length(vec2(m.x, m.y - cy));
    if (rc < 0.22) {
      float st = sdStar(vec2(m.x, m.y - cy), 0.19, 8.0, 3.0);
      col = rc < 0.1 ? glassPal(0.0) : (st < 0.0 ? glassPal(2.0) : glassPal(1.0));
      id = vec2(cy, rc < 0.1 ? 1.0 : (st < 0.0 ? 2.0 : 3.0));
      lead = max(lead, leadLine(st, 0.014) * step(0.1, rc));
      lead = max(lead, leadLine(rc - 0.1, 0.014));
    }
    lead = max(lead, leadLine(rc - 0.22, 0.016));
  }
  col = paneJitter(col, id) * n;
  glassOut(s, uv, col, lead, 1.0);
}`,
  });
}

/**
 * Floor medallion: inlaid marble rosette, radius 1 = full texture. The octagram
 * {8/3} (the puzzle board) is a brass inlay on Belgian black; around it bands of
 * rosso, verde antico, brass and Carrara.
 * pointsR = radius (normalised) of the eight star points.
 */
export function medallionTexture(forge, pointsR) {
  return forge.generate('foyer:medallion2', {
    size: 2048, aspect: 1, tile: false, uniforms: { uPR: pointsR },
    normalStrength: 0.8,
    glsl: /* glsl */ `
vec3 marbleCol(vec2 p, vec3 base, vec3 vein, float k, float sc) {
  vec2 w = vec2(fbm(p * sc + k, vec2(64.0), 5), fbm(p * sc + k + 7.3, vec2(64.0), 5));
  float v = fbm(p * sc * 0.7 + w * 0.9 + k, vec2(64.0), 6);
  float veins = 1.0 - smoothstep(0.0, 0.045, abs(v));
  float fine = 1.0 - smoothstep(0.0, 0.02, abs(fbm(p * sc * 2.3 + w * 1.4 + k * 2.0, vec2(64.0), 5)));
  float cloud = fbm(p * sc * 0.5 + w * 0.4, vec2(64.0), 4) * 0.5 + 0.5;
  vec3 c = base * (0.85 + 0.25 * cloud);
  c = mix(c, vein, veins * 0.75);
  c = mix(c, vein, fine * 0.35);
  return c;
}
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  // field: polished lapis -- deep ultramarine clouds, soft low-frequency veining, a few pyrite flecks
  vec2 lw = vec2(fbm(p * 1.3 + 2.0, vec2(64.0), 4), fbm(p * 1.3 + 9.0, vec2(64.0), 4));
  float lc = fbm(p * 1.6 + lw * 0.8, vec2(64.0), 5) * 0.5 + 0.5;
  float lv = 1.0 - smoothstep(0.0, 0.06, abs(fbm(p * 1.1 + lw * 1.2 + 5.0, vec2(64.0), 4)));
  vec3 nero = mix(vec3(0.02, 0.03, 0.085), vec3(0.06, 0.09, 0.24), smoothstep(0.3, 0.8, lc));
  nero = mix(nero, vec3(0.32, 0.36, 0.44), lv * 0.35);
  float pyr = smoothstep(0.93, 0.98, vnoise(p * 70.0, vec2(1e4))) * smoothstep(0.45, 0.7, lc);
  nero = mix(nero, vec3(0.7, 0.58, 0.3), pyr * 0.6);
  vec3 rosso = marbleCol(p, vec3(0.24, 0.045, 0.04), vec3(0.55, 0.36, 0.3), 4.0, 1.6);
  // malachite heart: concentric botryoidal banding
  float mb = sin((length(p - vec2(0.02, -0.03)) + 0.04 * fbm(p * 6.0, vec2(64.0), 3)) * 160.0) * 0.5 + 0.5;
  vec3 verde = mix(vec3(0.01, 0.08, 0.045), vec3(0.08, 0.36, 0.2), pow(mb, 1.6));
  verde = mix(verde, vec3(0.02, 0.14, 0.08), smoothstep(0.6, 0.9, fbm(p * 3.0 + 1.0, vec2(64.0), 3) * 0.5 + 0.5) * 0.5);
  // the border ring uses the hall's own aged ivory Carrara (same albedo, veins and polish as the floor)
  vec3 carrara = marbleCol(p, vec3(0.6, 0.58, 0.53), vec3(0.3, 0.31, 0.33), 13.0, 1.4);
  vec3 brassC = vec3(0.86, 0.66, 0.34);
  vec3 col = nero;
  float metal = 0.0;
  float rough = 0.12;
  float h = 0.6;
  float inl = 0.0;            // brass inlay mask
  float joint = 0.0;          // fine stone joints
  // ---- field: octagram lines + inscribed circle
  float PR = uPR;
  float dl = 1e3;
  for (int i = 0; i < 8; i++) {
    float a0 = float(i) * TAU / 8.0 + PI * 0.5;
    float a1 = float(i + 3) * TAU / 8.0 + PI * 0.5;
    dl = min(dl, sdSegment(p, vec2(cos(a0), sin(a0)) * PR, vec2(cos(a1), sin(a1)) * PR));
  }
  inl = max(inl, stroke(dl, 0.0055, 0.0015));
  inl = max(inl, stroke(r - PR, 0.003, 0.0012));
  inl = max(inl, stroke(r - PR * 0.36, 0.0025, 0.0012));
  // inner star (the octagon where the lines cross) in rosso
  float st = sdStar(p, PR * 0.405, 8.0, 3.0);
  col = mix(col, rosso, step(st, 0.0) * step(PR * 0.36, r));
  col = mix(col, verde, step(r, PR * 0.36));
  // ray lozenges between the star points (verde slivers)
  // ---- rings
  float ringIn = 0.84;
  if (r > ringIn) {
    // band 1: brass thin
    col = carrara;
    if (r < 0.845) { inl = 1.0; }
    else if (r < 0.925) {
      // rosso band with verde cartouches every 22.5deg
      float k = (a / TAU + 0.5) * 16.0;
      float f = fract(k) - 0.5;
      vec2 q = vec2(f * 0.885 * TAU / 16.0 * 6.0, (r - 0.885) * 6.0);
      float ov = sdEllipse(q, vec2(0.36, 0.18));
      col = mix(rosso, verde, step(ov, 0.0));
      inl = max(inl, stroke(ov, 0.006, 0.003));
      joint = max(joint, 1.0 - smoothstep(0.0, 0.0025, abs(f) * 0.885 * TAU / 16.0));
    } else if (r < 0.932) { inl = 1.0; }
    else {
      // carrara border with fine radial joints
      float k = (a / TAU + 0.5) * 48.0;
      float f = fract(k);
      joint = max(joint, 1.0 - smoothstep(0.0, 0.0018, min(f, 1.0 - f) * TAU / 48.0));
      col = carrara;
    }
  } else {
    // compass ticks just inside the rings
    float k = (a / TAU + 0.5) * 64.0;
    float f = fract(k);
    float tick = (1.0 - smoothstep(0.0, 0.08, min(f, 1.0 - f))) * step(0.8, r) * step(r, 0.835);
    float big = (1.0 - smoothstep(0.0, 0.2, min(fract(k / 8.0), 1.0 - fract(k / 8.0)) * 8.0)) * step(0.78, r) * step(r, 0.835);
    inl = max(inl, max(tick, big));
    inl = max(inl, stroke(r - 0.8, 0.0018, 0.001));
  }
  joint = max(joint, stroke(r - 0.925, 0.0, 0.0015));
  joint = max(joint, stroke(r - PR * 0.36, 0.0, 0.001));
  // brass with wear
  float wear = fbm(p * 6.0, vec2(64.0), 4) * 0.5 + 0.5;
  vec3 b = brassC * (0.75 + 0.35 * wear);
  col = mix(col, b, inl);
  metal = inl;
  rough = mix(0.07 + 0.05 * wear, 0.3 + 0.12 * wear, inl);
  col = mix(col, vec3(0.08, 0.07, 0.06), joint * 0.8);
  h = 0.6 - joint * 0.3 - inl * 0.03;
  // scuffs & dull traffic patina
  float scuff = smoothstep(0.55, 0.8, fbm(p * 2.2 + 3.0, vec2(64.0), 5) * 0.5 + 0.5);
  rough = mix(rough, rough + 0.12, scuff);
  s.albedo = col;
  s.alpha = step(r, 1.0);
  s.height = h; s.rough = rough; s.metal = metal; s.ao = 1.0 - joint * 0.4;
}`,
  });
}

/** Stair runner: crimson Wilton carpet with gold guilloche borders. u across (1.2 m), v along (period 0.6 m). */
export function carpetTexture(forge) {
  return forge.generate('foyer:carpet3', {
    size: 1024, aspect: 2, tile: true, normalStrength: 1.6,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float u = uv.x;                    // 0..1 across
  float v = uv.y;                    // 0..1 along (one period)
  vec3 crimson = vec3(0.2, 0.025, 0.03);     // oxblood Wilton
  vec3 deep = vec3(0.08, 0.012, 0.018);
  vec3 gold = vec3(0.46, 0.33, 0.13);
  vec3 navy = vec3(0.03, 0.04, 0.1);
  float e = min(u, 1.0 - u);
  vec3 col;
  float pile = vnoise(uv * vec2(420.0, 210.0), vec2(420.0, 210.0));
  if (e < 0.03) col = navy;
  else if (e < 0.04) col = gold;
  else if (e < 0.12) {
    // guilloche: two interlaced sine bands
    float y = (e - 0.08) / 0.04;
    float w1 = abs(y - 0.7 * sin(v * TAU * 4.0));
    float w2 = abs(y + 0.7 * sin(v * TAU * 4.0));
    float band = 1.0 - smoothstep(0.12, 0.22, min(w1, w2));
    col = mix(deep, gold, band);
    float dotm = 1.0 - smoothstep(0.1, 0.2, length(vec2(fract(v * 8.0 + 0.25) - 0.5, y * 0.4)));
    col = mix(col, crimson * 1.3, dotm * (1.0 - band));
  }
  else if (e < 0.13) col = gold;
  else {
    // field: small lattice of quatrefoils
    vec2 q = vec2((u - 0.5) * 2.0 * 3.0, v * 2.0);
    vec2 f = fract(q) - 0.5;
    float qf = min(length(f - vec2(0.18, 0.0)), min(length(f + vec2(0.18, 0.0)), min(length(f - vec2(0.0, 0.18)), length(f + vec2(0.0, 0.18)))));
    float motif = 1.0 - smoothstep(0.1, 0.13, qf);
    float lat = 1.0 - smoothstep(0.0, 0.04, abs(abs(f.x) + abs(f.y) - 0.5));
    col = mix(crimson, deep, lat * 0.8);
    col = mix(col, gold * 0.8, motif * 0.7);
    col = mix(col, navy * 2.0, (1.0 - smoothstep(0.0, 0.05, length(f))) * 0.9);
  }
  // pile: tufted rows plus a soft tonal mottle; the pattern bleeds into the nap
  float tuft = vnoise(uv * vec2(160.0, 80.0), vec2(160.0, 80.0));
  float mott = fbm(uv * vec2(3.0, 1.5), vec2(3.0, 1.5), 4) * 0.5 + 0.5;
  // traffic wear: down the centre of each tread (the nosing, v ~ 0.5 of the period, takes the most), threadbare in patches
  float centre = smoothstep(0.36, 0.05, abs(u - 0.5));
  float nose = 0.55 + 0.45 * smoothstep(0.35, 0.0, abs(fract(v * 2.0) - 0.5));
  float wear = centre * nose * (0.45 + 0.55 * smoothstep(0.35, 0.75, mott));
  vec3 lum = vec3(dot(col, vec3(0.3, 0.59, 0.11)));
  col *= (0.78 + 0.28 * pile) * (0.85 + 0.25 * tuft) * (0.9 + 0.2 * mott);
  col = mix(col, mix(col, lum * 1.4 + vec3(0.05, 0.035, 0.03), 0.6), wear * 0.55);   // crushed, greyed, dusty nap
  float bare = smoothstep(0.75, 0.95, wear + (tuft - 0.5) * 0.4);
  col = mix(col, vec3(0.16, 0.12, 0.09) * (0.8 + 0.4 * tuft), bare * 0.5);          // the jute backing shows through
  s.albedo = col;
  s.height = 0.5 + pile * 0.25 + tuft * 0.2 - wear * 0.2;
  s.rough = 0.95; s.metal = 0.0; s.ao = (0.8 + 0.2 * pile) * (0.9 + 0.1 * tuft);
}`,
  });
}

/** Grandfather-clock dial (canvas): arched brass dial, silvered chapter ring, roman numerals, painted moon arch. */
export function clockDialTexture(forge) {
  return forge.canvas('foyer:clockdial', 512, 768, (g, w, h) => {
    const cx = w / 2, cy = h - w / 2;
    // brass ground
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#6d5320'); gr.addColorStop(0.5, '#b8913f'); gr.addColorStop(1, '#5a4219');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // matted centre texture
    for (let i = 0; i < 9000; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * w, y = (Math.sin(i * 78.233) * 12543.123 % 1 + 1) % 1 * h;
      g.fillStyle = `rgba(${i % 2 ? '255,230,170' : '40,25,5'},0.08)`; g.fillRect(x, y, 1.5, 1.5);
    }
    // moon arch
    g.save();
    g.beginPath(); g.arc(cx, h - w, w * 0.42, Math.PI, 0); g.closePath(); g.clip();
    const sky = g.createLinearGradient(0, 0, 0, h - w);
    sky.addColorStop(0, '#0b1636'); sky.addColorStop(1, '#22386b');
    g.fillStyle = sky; g.fillRect(0, 0, w, h - w);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,240,200,0.8)'; g.beginPath(); g.arc((i * 97) % w, ((i * 53) % (h - w)), 1.2, 0, 7); g.fill(); }
    g.fillStyle = '#efe6c8'; g.beginPath(); g.arc(cx + w * 0.17, h - w - w * 0.06, w * 0.09, 0, 7); g.fill();
    g.fillStyle = '#c9bc95'; g.beginPath(); g.arc(cx + w * 0.15, h - w - w * 0.08, w * 0.02, 0, 7); g.fill();
    // a ghostly face in the moon-arch: Stauf's grin
    g.fillStyle = '#e8dcb5'; g.beginPath(); g.arc(cx - w * 0.17, h - w - w * 0.06, w * 0.09, 0, 7); g.fill();
    g.strokeStyle = '#2a1d10'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx - w * 0.17, h - w - w * 0.05, w * 0.045, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = '#2a1d10';
    g.beginPath(); g.arc(cx - w * 0.2, h - w - w * 0.09, 3, 0, 7); g.fill();
    g.beginPath(); g.arc(cx - w * 0.14, h - w - w * 0.09, 3, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = '#3b2a0e'; g.lineWidth = 4;
    g.beginPath(); g.arc(cx, h - w, w * 0.42, Math.PI, 0); g.stroke();
    // silvered chapter ring
    g.beginPath(); g.arc(cx, cy, w * 0.44, 0, Math.PI * 2); g.arc(cx, cy, w * 0.31, 0, Math.PI * 2, true);
    const sil = g.createRadialGradient(cx, cy, w * 0.3, cx, cy, w * 0.45);
    sil.addColorStop(0, '#cfcbbf'); sil.addColorStop(1, '#a9a597');
    g.fillStyle = sil; g.fill('evenodd');
    g.strokeStyle = '#1b1712'; g.lineWidth = 2;
    for (const rr of [0.44, 0.415, 0.33, 0.31]) { g.beginPath(); g.arc(cx, cy, w * rr, 0, Math.PI * 2); g.stroke(); }
    // minute ticks
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      g.beginPath(); g.moveTo(cx + Math.sin(a) * w * 0.415, cy - Math.cos(a) * w * 0.415); g.lineTo(cx + Math.sin(a) * w * 0.44, cy - Math.cos(a) * w * 0.44);
      g.lineWidth = i % 5 ? 1.2 : 3; g.stroke();
    }
    // roman numerals
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    g.fillStyle = '#15110c';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.save();
      g.translate(cx + Math.sin(a) * w * 0.362, cy - Math.cos(a) * w * 0.362);
      g.rotate(a);
      g.font = `bold ${Math.round(w * 0.075)}px "Cinzel", "Times New Roman", serif`;
      g.fillText(R[i], 0, 0);
      g.restore();
    }
    // spandrel scrolls
    g.strokeStyle = 'rgba(40,25,5,0.8)'; g.lineWidth = 3;
    for (const [sx, sy] of [[0.08, h - 0.08 * w], [w - 0.08 * w, h - 0.08 * w], [0.08 * w, h - w + 0.08 * w], [w - 0.08 * w, h - w + 0.08 * w]]) {
      g.beginPath(); for (let t = 0; t < 12; t += 0.1) { const r = 4 + t * 2.4; g.lineTo(sx + Math.cos(t) * r * 0.9, sy + Math.sin(t) * r * 0.9); } g.stroke();
    }
    // maker's cartouche
    g.font = `italic ${Math.round(w * 0.04)}px "Cormorant Garamond", serif`;
    g.fillStyle = '#2a1d0a';
    g.fillText('H. Stauf · Harley', cx, cy + w * 0.17);
  }, { tile: false });
}

/**
 * Portrait of Henry Stauf, toymaker: a gaunt, bald old man in a wing collar and black silk
 * bow, turned three-quarters, lit by a single high key from the left. Two passes:
 *  1. the head and bust are a raymarched sculpted SDF (real form, soft shadow, occlusion) so the
 *     light models the skull, the sockets and the hooked nose ("the underpainting");
 *  2. paintCanvas() repaints that image with oriented brush strokes that follow the form
 *     (structure-tensor flow), quantised values, bristle streaks, impasto, canvas weave,
 *     craquelure and a yellowed varnish.
 */
export function staufPortraitTexture(forge, aspect) {
  const raw = forge.generate('foyer:stauf5raw', {
    size: 1280, aspect, tile: false, uniforms: { uAsp: aspect, uV: 0, uCoat: [0.028, 0.026, 0.03] }, normalStrength: 0.0,
    glsl: PORTRAIT_SDF + /* glsl */ `
vec3 background(vec2 p, vec2 uv) {
  // warm umber ground glowing behind the head, falling to near-black at the edges (soft, painted, never a hard oval)
  vec3 col = mix(vec3(0.03, 0.022, 0.016), vec3(0.24, 0.15, 0.08), exp(-length((p - vec2(-0.14, 0.13)) * vec2(1.0, 0.72)) * 2.6));
  col *= 0.7 + 0.5 * fb2(uv * 3.0 + 2.0, 4);
  col = mix(col, col * vec3(0.7, 0.75, 0.9), smoothstep(0.1, 0.45, length(p)) * 0.5);
  // storm window, upper right: moon, clouds, the house on its hill
  vec2 w = p - vec2(0.21, 0.25);
  float win = sdBox(w, vec2(0.08, 0.12));
  float winArch = length(w - vec2(0.0, 0.12)) - 0.08;
  float inWin = min(win, max(winArch, -(w.y - 0.12)));
  if (inWin < 0.0) {
    vec3 sky = mix(vec3(0.03, 0.04, 0.07), vec3(0.2, 0.22, 0.27), smoothstep(-0.12, 0.2, w.y));
    float cl = fb2(w * vec2(9.0, 18.0) + 3.0, 5);
    sky = mix(sky, vec3(0.05, 0.05, 0.07), smoothstep(0.45, 0.7, cl));
    sky += vec3(0.8, 0.78, 0.66) * smoothstep(0.02, 0.012, length(w - vec2(0.03, 0.11)));
    float hill = w.y + 0.07 - 0.03 * sin(w.x * 30.0);
    float house = sdBox(w - vec2(-0.015, -0.045), vec2(0.035, 0.03));
    house = min(house, sdBox(w - vec2(-0.03, -0.01), vec2(0.008, 0.03)));
    vec3 c = mix(sky, vec3(0.012, 0.012, 0.016), smoothstep(0.003, -0.003, min(hill, house)));
    c += vec3(0.9, 0.6, 0.2) * smoothstep(0.005, 0.0, sdBox(w - vec2(-0.005, -0.045), vec2(0.004, 0.004)));
    col = c;
  }
  col = mix(col, vec3(0.05, 0.035, 0.022), smoothstep(0.008, 0.0, abs(inWin) - 0.004));
  // a heavy oxblood drape at the left edge
  float dr = smoothstep(-0.2, -0.34, p.x + 0.04 * sin(p.y * 30.0)) * 0.75;
  float fold = 0.35 + 0.9 * pow(0.5 + 0.5 * sin(p.x * 140.0 + 3.0 * fb2(vec2(p.y * 4.0, 1.0), 2)), 2.0);
  col = mix(col, vec3(0.16, 0.025, 0.02) * fold * (0.6 + 0.6 * smoothstep(-0.4, 0.3, p.y)), dr);
  return col;
}
void surface(vec2 uv, inout Surface s) {
  vec2 p = (uv - 0.5) * vec2(uAsp, 1.0);
  vec3 col = renderSitter(p, uv, background(p, uv), 0.0);
  s.albedo = col;
  s.height = 0.5; s.rough = 0.5; s.ao = 1.0;
  s.metal = gDetail;
}`,
  });
  return paintCanvas(forge, 'foyer:stauf5', raw, aspect, 1280, { varnish: 0.62 });
}

/**
 * Oil-painting pass over a raw (underpainting) TextureSet: two layers of oriented brush strokes
 * (coarse everywhere, fine where the raw's detail mask -- metal channel -- is set), each stroke a
 * tapered dab whose colour is smeared along its axis and modulated by bristle streaks; soft value
 * quantisation; impasto height; canvas weave; craquelure; yellowed varnish; darkened edges.
 */
export function paintCanvas(forge, key, raw, aspect, size, { varnish = 0.6, coarse = 19, fine = 9 } = {}) {
  return forge.generate(key, {
    size, aspect, tile: false, normalStrength: 0.07,
    uniforms: { tRaw: raw.map, tDet: raw.ormMap, uAsp: aspect, uVarn: varnish, uCoarse: coarse, uFine: fine },
    glsl: /* glsl */ `
vec3 l2s(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 rawAt(vec2 uv, float lod) { return l2s(textureLod(tRaw, clamp(uv, 0.0, 1.0), lod).rgb); }
float lumAt(vec2 uv, float lod) { return sqrt(dot(textureLod(tRaw, clamp(uv, 0.0, 1.0), lod).rgb, vec3(0.3, 0.59, 0.11))); }
float detAt(vec2 uv) { return textureLod(tDet, clamp(uv, 0.0, 1.0), 2.0).b; }
// stroke direction: along the isophotes of the (blurred) underpainting, so strokes wrap the form
vec2 flowAt(vec2 uv, float rpx) {
  vec2 o = rpx / uResolution;
  float lod = log2(max(rpx * 0.6, 1.0));
  vec2 g = vec2(lumAt(uv + vec2(o.x, 0.0), lod) - lumAt(uv - vec2(o.x, 0.0), lod), lumAt(uv + vec2(0.0, o.y), lod) - lumAt(uv - vec2(0.0, o.y), lod));
  float m = length(g);
  vec2 def = normalize(vec2(0.55, 0.83));
  vec2 t = m > 1e-5 ? vec2(-g.y, g.x) / m : def;
  if (dot(t, def) < 0.0) t = -t;
  return normalize(mix(def, t, smoothstep(0.004, 0.04, m)) + 1e-4);
}
// one layer of dabs on a jittered grid; returns (colour, coverage); h += impasto
vec4 dabs(vec2 uv, float cellPx, float lenK, float widK, float seed, float lod, float gate, inout float h) {
  vec2 pix = uv * uResolution;
  vec2 cell = floor(pix / cellPx);
  float best = 0.0; vec3 bc = vec3(0.0); float bh = 0.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 cid = cell + vec2(float(i), float(j));
    vec2 hh = hash22(cid * 1.17 + seed);
    vec2 cpx = (cid + 0.15 + 0.7 * hh) * cellPx;
    vec2 cuv = cpx / uResolution;
    if (gate > 0.5 && detAt(cuv) < 0.5) continue;
    vec2 t = flowAt(cuv, cellPx * 0.8);
    t = rot2((hash12(cid * 1.31 + seed) - 0.5) * 0.4) * t;
    vec2 d = pix - cpx;
    float a = dot(d, t), b = dot(d, vec2(-t.y, t.x));
    float L = cellPx * lenK * (0.7 + 0.6 * hash12(cid + 7.1 + seed));
    float W = cellPx * widK * (0.75 + 0.5 * hash12(cid + 3.3 + seed));
    float an = clamp(a / L, -1.0, 1.0);
    float Wt = W * (1.0 - 0.45 * an * an) * (1.0 + 0.15 * an);           // tapered at both ends, loaded at the start
    float wob = (vnoise(vec2(a * 0.35, cid.x * 3.1 + cid.y), vec2(1e4)) - 0.5) * W * 0.5;   // ragged edges
    float e = (a * a) / (L * L) + ((b + wob) * (b + wob)) / (Wt * Wt);
    float cov = 1.0 - smoothstep(0.7, 1.0, e);
    float pri = cov * (0.35 + hash12(cid * 2.71 + seed + 1.0));
    if (pri > best) {
      best = pri;
      vec3 c = rawAt((cpx + t * a * 0.85) / uResolution, lod);
      float bristle = vnoise(vec2(a * 0.18, b * 1.9) + cid * 13.7, vec2(1e4));
      float dry = smoothstep(0.55, 1.0, abs(an)) * (0.5 + 0.5 * bristle);          // dry-brush tail breaks up
      c *= 0.86 + 0.28 * bristle;
      bc = c; bh = cov * (0.55 + 0.45 * bristle) - dry * 0.3;
      best = pri * (1.0 - dry * 0.6);
    }
  }
  float covOut = clamp(best * 1.6, 0.0, 1.0);
  h = mix(h, 0.5 + bh * 0.5, covOut);
  return vec4(bc, covOut);
}
void surface(vec2 uv, inout Surface s) {
  float h = 0.45;
  vec3 col = rawAt(uv, 2.5);                                   // scumbled ground
  vec4 c1 = dabs(uv, uCoarse, 1.7, 0.42, 1.0, 1.2, 0.0, h);
  col = mix(col, c1.rgb, c1.a);
  vec4 c2 = dabs(uv, uFine, 1.6, 0.4, 9.0, 0.0, 1.0, h);
  float det = detAt(uv);
  col = mix(col, c2.rgb, c2.a * smoothstep(0.3, 0.7, det));
  // let the sharpest accents (catch-lights, lid creases) survive the brush
  vec3 sharp = rawAt(uv, 0.0);
  float acc = smoothstep(0.08, 0.25, abs(dot(sharp - col, vec3(0.33)))) * smoothstep(0.6, 0.9, det);
  col = mix(col, sharp, acc * 0.6);
  // soft value quantisation (painters' value steps), hue preserved
  float lum = dot(col, vec3(0.3, 0.59, 0.11));
  float q = (floor(lum * 6.0) + smoothstep(0.3, 0.7, fract(lum * 6.0))) / 6.0;
  col *= mix(1.0, q / max(lum, 1e-3), 0.55);
  // canvas weave shows through the thin passages
  vec2 wv = uv * vec2(uAsp, 1.0) * 260.0;
  float weave = (sin(wv.x * TAU) * 0.5 + 0.5) * (sin(wv.y * TAU + step(0.5, fract(wv.x * 0.5)) * PI) * 0.5 + 0.5);
  float thin = 1.0 - smoothstep(0.55, 0.8, h);
  col *= 1.0 - weave * 0.07 * thin;
  // craquelure
  vec2 cq = uv * vec2(uAsp, 1.0) * 120.0;
  float cr = voronoiEdge(cq + (vec2(fbm(uv * 9.0, vec2(64.0), 3), fbm(uv * 9.0 + 3.0, vec2(64.0), 3))) * 0.6, vec2(1e4), 1.0);
  float crack = (1.0 - smoothstep(0.0, 0.035, cr)) * (0.35 + 0.65 * (fbm(uv * 6.0, vec2(64.0), 3) * 0.5 + 0.5));
  col *= 1.0 - crack * 0.22;
  // yellowed, unevenly cleaned varnish
  float vn = fbm(uv * 2.5 + 4.0, vec2(64.0), 4) * 0.5 + 0.5;
  col = mix(col, col * vec3(0.85, 0.72, 0.5), uVarn * (0.75 + 0.5 * vn));
  float edge = min(min(uv.x, 1.0 - uv.x) * uAsp, min(uv.y, 1.0 - uv.y));
  col *= mix(0.5, 1.0, smoothstep(0.0, 0.12, edge));
  s.albedo = col;
  s.height = h + weave * 0.04 * thin - crack * 0.18;
  s.rough = 0.4 + (1.0 - h) * 0.15 + crack * 0.3;
  s.metal = 0.0; s.ao = 1.0 - crack * 0.25;
}`,
  });
}

// Raymarched sitter: sculpted head & bust. renderSitter(p, uv, bg, variant)
const PORTRAIT_SDF = /* glsl */ `
float fb2(vec2 p, int o) { return fbm(p, vec2(64.0), o) * 0.5 + 0.5; }
float gDetail = 0.0;   // detail mask for the paint pass (face = 1, linen/silk = 0.6)
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-6); }
float sdCap(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float smin3(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float smax3(float a, float b, float k) { return -smin3(-a, -b, k); }
// materials: 0 skin, 1 eye, 2 coat, 3 linen, 4 silk
const float YAW = 0.42;
const vec3 HEAD = vec3(0.0, 0.115, 0.0);
vec3 toHead(vec3 p) {
  vec3 q = p - HEAD;
  float c = cos(YAW), s = sin(YAW);
  q.xz = mat2(c, -s, s, c) * q.xz;
  float t = -0.08;                         // a slight downward tilt: he looks at us from under his brow
  q.yz = mat2(cos(t), -sin(t), sin(t), cos(t)) * q.yz;
  return q;
}
float headSDF(vec3 q, out float mat) {
  vec3 m = vec3(abs(q.x), q.yz);
  float d = sdEll(q - vec3(0.0, 0.035, -0.012), vec3(0.077, 0.094, 0.097));            // cranium
  d = smin3(d, sdEll(q - vec3(0.0, -0.035, 0.02), vec3(0.056, 0.074, 0.07)), 0.03);    // face mass
  d = smin3(d, sdEll(q - vec3(0.0, -0.078, 0.028), vec3(0.04, 0.034, 0.048)), 0.022); // jaw
  d = smin3(d, sdEll(m - vec3(0.042, -0.01, 0.052), vec3(0.021, 0.015, 0.02)), 0.014);// cheekbones
  if (uV < 0.5) {
    d = smax3(d, -sdEll(m - vec3(0.07, 0.025, 0.035), vec3(0.018, 0.03, 0.03)), 0.02);  // sunken temples
    d = smax3(d, -sdEll(m - vec3(0.046, -0.05, 0.068), vec3(0.018, 0.024, 0.018)), 0.02);// hollow cheeks
  } else {
    d = smin3(d, sdEll(m - vec3(0.038, -0.04, 0.05), vec3(0.025, 0.03, 0.025)), 0.02);  // fuller cheeks
  }
  d = smin3(d, sdCap(q, vec3(-0.042, 0.016, 0.074), vec3(0.042, 0.016, 0.074), 0.011), 0.014); // brow ridge
  d = smax3(d, -sdEll(m - vec3(0.029, 0.0, 0.085), vec3(0.02, 0.016, 0.02)), 0.009);   // sockets
  float nz = uV > 1.5 ? 0.82 : 1.0;      // the lady's nose is finer
  d = smin3(d, sdCap(q, vec3(0.0, 0.006, 0.086), vec3(0.0, -0.03 * nz, 0.086 + 0.022 * nz), 0.0085 * nz), 0.012); // nose bridge
  d = smin3(d, length(q - vec3(0.0, -0.033 * nz, 0.083 + 0.021 * nz)) - 0.011 * nz, 0.008);                  // tip
  d = smin3(d, length(m - vec3(0.012, -0.036, 0.09)) - 0.0085, 0.008);                // wings
  if (uV < 0.5) {
    d = smin3(d, length(q - vec3(0.0, -0.012, 0.1)) - 0.0072, 0.01);                     // the hook on the bridge
    d = smin3(d, length(q - vec3(0.0, -0.04, 0.104)) - 0.0075, 0.008);                   // a tip that droops over the lip
    d = smin3(d, sdCap(q, vec3(-0.03, 0.022, 0.082), vec3(-0.008, 0.012, 0.09), 0.006), 0.008);   // knotted brows, pulled down
    d = smin3(d, sdCap(q, vec3(0.03, 0.024, 0.082), vec3(0.008, 0.013, 0.09), 0.006), 0.008);
  }
  d = smin3(d, sdEll(q - vec3(0.002, -0.061, 0.087), vec3(0.021, 0.0055, 0.009)), 0.006);  // thin lips
  d = smax3(d, -sdCap(q, vec3(-0.022, -0.061, 0.093), vec3(0.024, -0.056, 0.093), 0.0022), 0.003); // the mouth line, lifted at his left
  d = smin3(d, sdEll(q - vec3(0.0, -0.096, 0.06), vec3(0.02, 0.016, 0.017)), 0.016);  // pointed chin
  d = smin3(d, sdEll(m - vec3(0.077, 0.002, -0.006), vec3(0.011, 0.03, 0.019)), 0.008);// ears
  d = smin3(d, sdCap(q, vec3(0.0, -0.08, -0.015), vec3(0.0, -0.22, -0.02), 0.036), 0.02); // neck
  mat = 0.0;
  // hair (material 5)
  if (uV > 0.5) {
    float hair;
    if (uV < 1.5) {
      // patriarch: receding grey hair swept back, a full beard and moustache
      hair = sdEll(q - vec3(0.0, 0.036, -0.02), vec3(0.082, 0.096, 0.1));
      hair = smax3(hair, -(q.y - 0.07 + q.x * q.x * 6.0 + (q.z - 0.02) * 0.9), 0.02);       // high, receding hairline
      float beard = sdEll(q - vec3(0.0, -0.092, 0.038), vec3(0.062, 0.062, 0.056));
      beard = smax3(beard, q.y + 0.04 - abs(q.x) * 0.2 - max(0.0, q.z - 0.075) * 0.0, 0.015);
      beard = smin3(beard, sdCap(vec3(abs(q.x), q.y, q.z), vec3(0.0, -0.05, 0.093), vec3(0.03, -0.062, 0.084), 0.0075), 0.006);
      beard = smin3(beard, sdEll(vec3(abs(q.x), q.y, q.z) - vec3(0.06, -0.04, 0.03), vec3(0.018, 0.04, 0.03)), 0.015);   // whiskers
      hair = min(hair, beard);
    } else {
      // lady: hair parted in the centre, smooth bands over the ears, a chignon behind
      hair = sdEll(q - vec3(0.0, 0.038, -0.014), vec3(0.081, 0.096, 0.1));
      hair = smax3(hair, -(q.y - 0.052 + q.x * q.x * 9.0 + (q.z - 0.06) * 0.55), 0.018);   // soft, arched hairline
      float bands = sdEll(vec3(abs(q.x), q.y, q.z) - vec3(0.06, 0.0, 0.0), vec3(0.028, 0.05, 0.06));
      hair = smin3(hair, bands, 0.02);
      hair = smin3(hair, length(q - vec3(0.0, 0.0, -0.105)) - 0.042, 0.02);
      hair = smax3(hair, -sdCap(q, vec3(0.0, 0.15, 0.09), vec3(0.0, 0.07, 0.0), 0.0025), 0.002);   // the parting
    }
    if (hair < d) { d = hair; mat = 5.0; }
  }
  // heavy hooded upper lids and a lower lid roll (skin), drawn over the eyeballs
  float nar = uV < 0.5 ? 1.0 : 0.0;     // Stauf narrows his eyes
  d = smin3(d, sdEll(m - vec3(0.029, 0.007 - 0.0012 * nar, 0.075 + 0.0008 * nar), vec3(0.016, 0.0065 + 0.0005 * nar, 0.009)), 0.004);
  d = smin3(d, sdEll(m - vec3(0.029, -0.011 + 0.0012 * nar, 0.074), vec3(0.014, 0.004 + 0.0005 * nar, 0.007)), 0.004);
  float eye = length(m - vec3(0.029, -0.001, 0.0675)) - 0.0105;
  if (eye < d) { d = eye; mat = 1.0; }
  return d;
}
float bodySDF(vec3 p, out float mat) {
  vec3 b = p;
  b.xz = mat2(cos(0.25), -sin(0.25), sin(0.25), cos(0.25)) * b.xz;
  float coat = sdEll(b - vec3(0.0, -0.31, -0.06), uV > 1.5 ? vec3(0.21, 0.23, 0.11) : vec3(0.24, 0.23, 0.12));
  coat = smin3(coat, sdEll(b - vec3(0.0, -0.11, -0.04), vec3(0.11, 0.05, 0.075)), 0.07);
  mat = 2.0;
  // wing collar: a short tube round the neck, open at the front
  vec3 c = toHead(p);
  float ring = max(abs(length(c.xz - vec2(0.0, -0.012)) - (uV > 1.5 ? 0.038 : 0.041)) - 0.003, abs(c.y + 0.155) - (uV > 1.5 ? 0.03 : 0.022));
  float wings = sdEll(vec3(abs(c.x), c.y, c.z) - vec3(0.014, -0.168, 0.033), vec3(0.011, 0.006, 0.005));
  float collar = uV < 0.5 ? ring : min(ring, wings);
  if (collar < coat) { coat = collar; mat = 3.0; }
  vec3 cb = c - vec3(0.0, -0.184, 0.034);
  float bow = min(sdEll(vec3(abs(cb.x) - 0.017, cb.y + abs(cb.x) * 0.0 , cb.z), vec3(0.017, 0.012 + abs(cb.x) * 0.25, 0.008)), length(cb) - 0.0075);
  float stock = uV > 1.5 ? length(c - vec3(0.0, -0.19, 0.04)) - 0.012 : bow;
  if (stock < coat) { coat = stock; mat = uV > 1.5 ? 6.0 : 4.0; }
  return coat;
}
float sceneSDF(vec3 p, out float mat) {
  float mh, mb;
  float h = headSDF(toHead(p), mh);
  float b = bodySDF(p, mb);
  if (h < b) { mat = mh; return h; }
  mat = mb; return b;
}
float sceneD(vec3 p) { float m; return sceneSDF(p, m); }
vec3 sceneN(vec3 p) {
  vec2 e = vec2(0.0007, 0.0);
  return normalize(vec3(sceneD(p + e.xyy) - sceneD(p - e.xyy), sceneD(p + e.yxy) - sceneD(p - e.yxy), sceneD(p + e.yyx) - sceneD(p - e.yyx)));
}
float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.004;
  for (int i = 0; i < 28; i++) {
    float h = sceneD(ro + rd * t);
    res = min(res, 9.0 * h / t);
    t += clamp(h, 0.003, 0.03);
    if (res < 0.002 || t > 0.4) break;
  }
  return clamp(res, 0.0, 1.0);
}
float occl(vec3 p, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 5; i++) { float h = 0.006 * float(i); o += w * (h - sceneD(p + n * h)); w *= 0.6; }
  return clamp(1.0 - o * 22.0, 0.0, 1.0);
}
vec3 renderSitter(vec2 p, vec2 uv, vec3 bg, float variant) {
  vec3 ro = vec3(p * 0.95, 0.4);
  if (abs(ro.x) > 0.32 || ro.y > 0.26) return bg;
  vec3 rd = vec3(0.0, 0.0, -1.0);
  float t = 0.0, mat = -1.0;
  bool hit = false;
  for (int i = 0; i < 96; i++) {
    float m;
    float d = sceneSDF(ro + rd * t, m);
    if (d < 0.0004) { hit = true; mat = m; break; }
    t += d * 0.9;
    if (t > 0.8) break;
  }
  if (!hit) return bg;
  vec3 pos = ro + rd * t;
  vec3 n = sceneN(pos);
  vec3 L = normalize(vec3(-0.62, 0.62, 0.5));
  float sh = softShadow(pos + n * 0.0015, L);
  float ao = occl(pos, n);
  float dif = clamp(dot(n, L), 0.0, 1.0);
  float wrap = clamp((dot(n, L) + 0.35) / 1.35, 0.0, 1.0);
  vec3 H = normalize(L - rd);
  float spec = pow(clamp(dot(n, H), 0.0, 1.0), 28.0);
  float fill = clamp(dot(n, normalize(vec3(0.8, 0.1, 0.6))), 0.0, 1.0);
  float rim = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0) * clamp(dot(n, normalize(vec3(0.9, 0.3, -0.2))), 0.0, 1.0);
  vec3 alb; float sp = 0.0;
  vec3 hp = toHead(pos);
  gDetail = mat < 1.5 || mat > 4.5 ? 1.0 : (mat > 2.5 ? 0.6 : 0.0);
  if (mat < 0.5) {
    alb = uV > 1.5 ? vec3(0.74, 0.6, 0.52) : vec3(0.64, 0.5, 0.41);
    alb *= 0.9 + 0.2 * fb2(uv * 70.0, 3);                                     // mottled old skin
    alb = mix(alb, vec3(0.62, 0.32, 0.28), smoothstep(0.03, 0.0, length(hp.xy - vec2(0.0, -0.034))) * 0.35);   // reddened nose
    alb = mix(alb, alb * vec3(0.8, 0.75, 0.85), smoothstep(0.0, 0.02, -hp.y - 0.06) * 0.3);  // stubble shadow
    // grey wisps of hair over the ears and the back of the skull
    float wisp = smoothstep(0.045, 0.075, abs(hp.x)) * smoothstep(0.06, -0.01, hp.y) * smoothstep(-0.05, 0.0, hp.y) * step(hp.z, 0.03);
    wisp *= 0.5 + 0.7 * fb2(vec2(hp.x * 60.0, hp.y * 400.0), 3);
    alb = mix(alb, vec3(0.62, 0.6, 0.57), clamp(wisp, 0.0, 1.0));
    sp = 0.22;
  } else if (mat < 1.5) {
    vec3 m = vec3(abs(hp.x), hp.yz);
    float ir = length((m.xy - vec2(0.029 - 0.004, -0.002)) * vec2(1.0, 1.1));
    alb = mix(vec3(0.6, 0.57, 0.5), vec3(0.06, 0.05, 0.04), smoothstep(0.0062, 0.0048, ir));
    sp = 1.4;
  } else if (mat < 2.5) {
    alb = uCoat * (0.85 + 0.3 * fb2(uv * 30.0, 3));
    sp = uV > 1.5 ? 0.5 : 0.08;
  } else if (mat < 3.5) { alb = vec3(uV < 0.5 ? 0.3 : 0.42, uV < 0.5 ? 0.28 : 0.39, uV < 0.5 ? 0.24 : 0.33) * (uV > 1.5 ? 0.85 + 0.25 * sin(atan(hp.z, hp.x) * 40.0) : 1.0); sp = 0.1; }
  else if (mat < 4.5) { alb = vec3(0.03, 0.026, 0.032) * (0.8 + 0.4 * fb2(uv * 90.0, 2)); sp = 0.6; }
  else if (mat < 5.5) {
    float str = fb2(vec2(atan(hp.z, hp.x) * 30.0, hp.y * 60.0), 3);
    alb = (uV < 1.5 ? vec3(0.55, 0.53, 0.5) : vec3(0.1, 0.065, 0.04)) * (0.7 + 0.6 * str);
    sp = 0.35;
  } else { alb = vec3(0.7, 0.55, 0.4); sp = 0.6; }   // cameo
  vec3 key = vec3(1.0, 0.86, 0.66) * 2.1;
  vec3 col = alb * (key * mix(wrap * 0.25, dif, 0.8) * mix(0.12, 1.0, sh) + vec3(0.1, 0.12, 0.16) * fill * 0.6 + vec3(0.05, 0.04, 0.035)) * ao;
  col += key * spec * sp * sh * 0.25;
  // a single hard catch-light in each eye
  if (mat > 0.5 && mat < 1.5) col += vec3(1.0, 0.92, 0.8) * pow(clamp(dot(n, H), 0.0, 1.0), 500.0) * 5.0 * max(sh, 0.5);
  col += vec3(0.25, 0.3, 0.4) * rim * 0.25 * ao;
  // a painter's flesh: cool greenish half-tones at the terminator, warm reflected light in the shadow side
  if (mat < 0.5) {
    float term = smoothstep(0.55, 0.2, dif) * smoothstep(0.0, 0.12, dif);
    col = mix(col, col * vec3(0.82, 0.95, 0.9), term * 0.6);
    col += vec3(0.05, 0.02, 0.008) * (1.0 - dif) * ao * 0.6;
  }
  // the shirt front V under the stock
  if (mat > 1.5 && mat < 2.5 && uV < 1.5) {
    vec3 b = pos;
    float vee = max(abs(b.x + 0.025) - (b.y + 0.27) * 0.32, b.y + 0.085);
    // a pleated, rumpled shirt-front: greyed linen, folds and creases, falling into shadow
    float pleat = 0.95 + 0.05 * sin((b.x + 0.025) * 300.0 + fb2(b.xy * 40.0, 2) * 3.0);
    float crease = 0.8 + 0.35 * fb2(vec2(b.x * 60.0, b.y * 22.0), 3);
    vec3 shirt = vec3(0.36, 0.33, 0.28) * pleat * crease;
    float inV = smoothstep(0.004, -0.004, vee) * step(-0.36, b.y);
    col = mix(col, shirt * (key * mix(0.2, 1.0, dif) * mix(0.2, 1.0, sh) * (0.45 + 0.6 * smoothstep(0.05, -0.08, b.x)) * smoothstep(-0.36, -0.12, b.y) + 0.03) * ao, inV);
    gDetail = max(gDetail, inV * 0.7);
    // lapel edges catch the key
    float lap = min(abs(b.x + 0.025 - (b.y + 0.27) * 0.32 - 0.012), abs(b.x + 0.025 + (b.y + 0.27) * 0.32 + 0.012)) - 0.002;
    col += vec3(0.07, 0.065, 0.06) * smoothstep(0.005, 0.0, lap) * step(b.y, -0.09) * (dif + 0.2);   // satin lapel facings catch the key
    col += key * 0.03 * pow(clamp(dot(n, H), 0.0, 1.0), 12.0) * sh * (1.0 - inV);                        // sheen on the black broadcloth
    // a gold watch chain looping from a waistcoat button (lower arc only)
    float ch = abs(length((b.xy - vec2(0.07, -0.27)) * vec2(1.0, 2.4)) - 0.06) - 0.0014;
    col += vec3(0.9, 0.62, 0.22) * 0.5 * smoothstep(0.002, 0.0, ch) * step(0.03, b.x) * step(b.x, 0.12) * step(b.y, -0.27) * dif;
  }
  return col;
}
`;

/**
 * Hall floor: diagonal checker of aged ivory Carrara and Nero Marquina (period 1 = 3.2 m,
 * 0.57 m tiles). Each tile has its own vein field, value/hue jitter and polish; the
 * grout is dark and grimy; the chamfered edges are slightly lifted; light scuffing.
 */
export function floorTexture(forge, size = 1024) {
  return forge.generate('foyer:floor', {
    size, aspect: 1, tile: true, normalStrength: 0.9,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  const float T = 4.0;
  vec2 p = rot2(PI * 0.25) * uv * 1.41421356;
  vec2 g = p * T;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float which = mod(id.x + id.y, 2.0);
  // tile ids must repeat with the texture period: the rotated grid repeats every (T, T) on the diagonal lattice
  vec2 tid = mod(id, vec2(T));
  float h1 = hash12(tid + 11.3), h2 = hash12(tid * 1.7 + 3.1), h3 = hash12(tid * 2.3 + 7.9);
  vec2 off = vec2(h1, h2) * 37.0;
  vec2 w = vec2(fbm(uv * 1.0 + off * 0.013, vec2(1.0) * 2.0, 5), fbm(uv + 3.0 + off * 0.017, vec2(2.0), 5));
  float v = fbm(uv * 1.0 + w * 0.22 + off * 0.004, vec2(8.0), 6);
  float veins = 1.0 - smoothstep(0.0, 0.03 + 0.02 * h3, abs(v));
  float v2 = fbm(uv * 2.0 + w * 0.35 + off * 0.007 + 4.0, vec2(16.0), 5);
  float fine = 1.0 - smoothstep(0.0, 0.012, abs(v2));
  float cloud = fbm(uv * 1.0 + w * 0.3 + off * 0.01, vec2(12.0), 4) * 0.5 + 0.5;
  vec3 col;
  if (which < 0.5) {
    // aged Carrara: ivory, never paper white
    vec3 base = vec3(0.6, 0.58, 0.53) * (0.9 + 0.16 * h1) * vec3(1.0 + (h2 - 0.5) * 0.06, 1.0, 1.0 - (h2 - 0.5) * 0.1);
    col = base * (0.88 + 0.18 * cloud);
    col = mix(col, vec3(0.3, 0.31, 0.33), veins * (0.45 + 0.3 * h3));
    col = mix(col, vec3(0.42, 0.41, 0.4), fine * 0.35);
    col = mix(col, col * vec3(0.95, 0.88, 0.74), smoothstep(0.55, 0.9, cloud) * 0.5);   // yellowed patches
  } else {
    vec3 base = vec3(0.03, 0.029, 0.032) * (0.85 + 0.35 * h1);
    col = base * (0.85 + 0.3 * cloud);
    col = mix(col, vec3(0.62, 0.6, 0.56), veins * (0.35 + 0.35 * h3));
    col = mix(col, vec3(0.22, 0.21, 0.2), fine * 0.3);
  }
  // grout + chamfer
  float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) / T;     // distance to tile edge in uv
  float groutM = 1.0 - smoothstep(0.0009, 0.0018, e);
  float chamfer = smoothstep(0.0009, 0.004, e);
  col = mix(col, vec3(0.075, 0.068, 0.06), groutM);
  col *= mix(0.86, 1.0, smoothstep(0.0, 0.008, e));                 // grime creeping in from the joints
  // scuffs: short random arcs
  float sc = fbm(uv * vec2(9.0, 40.0) + off * 0.02, vec2(9.0, 40.0), 3) * 0.5 + 0.5;
  float scuff = smoothstep(0.7, 0.85, sc) * (0.5 + 0.5 * hash12(floor(uv * 60.0)));
  float pits = step(0.996, hash12(floor(uv * 1100.0)));
  float polish = mix(0.07, 0.16, h2) + cloud * 0.04;
  s.albedo = col * (1.0 - scuff * 0.05);
  s.height = mix(0.45 + 0.1 * chamfer + cloud * 0.02 - pits * 0.2, 0.2, groutM);
  s.rough = mix(polish + veins * 0.03 + scuff * 0.22 + pits * 0.3, 0.85, groutM);
  s.metal = 0.0;
  s.ao = mix(1.0, 0.5, groutM) * (1.0 - pits * 0.3);
}`,
  });
}

/**
 * Ancestor portraits for the stair wall, painted the same way as Stauf's (raymarched sculpted
 * sitter + brushwork + varnish): o = { v: 1 bearded patriarch | 2 lady, ground:[r,g,b], coat:[r,g,b] }
 */
export function ancestorPortraitTexture(forge, aspect, o = {}) {
  const key = `foyer:ancestor3:${JSON.stringify(o)}:${aspect.toFixed(3)}`;
  const raw = forge.generate(key + ':raw', {
    size: 1024, aspect, tile: false, normalStrength: 0.0,
    uniforms: { uAsp: aspect, uV: o.v ?? 1, uCoat: o.coat || [0.03, 0.028, 0.032], uGround: o.ground || [0.16, 0.12, 0.07] },
    glsl: PORTRAIT_SDF + /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = (uv - 0.5) * vec2(uAsp, 1.0);
  vec3 bg = mix(uGround * 0.12, uGround, exp(-length((p - vec2(-0.12, 0.12)) * vec2(1.0, 0.8)) * 2.6));
  bg *= 0.7 + 0.5 * fb2(uv * 3.0 + uV, 4);
  vec3 col = renderSitter(p + vec2(0.0, -0.02), uv, bg, uV);
  s.albedo = col;
  s.height = 0.5; s.rough = 0.5; s.ao = 1.0;
  s.metal = gDetail;
}`,
  });
  return paintCanvas(forge, key, raw, aspect, 1024, { varnish: 0.7, coarse: 16, fine: 7 });
}
