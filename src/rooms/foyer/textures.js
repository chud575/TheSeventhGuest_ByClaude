/**
 * Foyer-specific procedural textures (TextureForge GLSL + one canvas dial).
 * All authored for this room: leaded stained glass (fanlight sunburst, the great
 * Stauf-star window, diamond-quarry sidelights), the inlaid marble floor medallion
 * that carries the octagram puzzle, the stair carpet and the clock dial.
 */

// ------------------------------------------------------------------ shared GLSL
const GLASS_COMMON = /* glsl */ `
// seedy, streaky antique glass: returns a brightness modulation around 1
float antique(vec2 uv, float k) {
  float s = fbm(uv * vec2(3.0, 9.0) + k, vec2(3.0, 9.0), 4) * 0.5 + 0.5;
  float b = vnoise(uv * 140.0 + k * 7.0, vec2(140.0));
  return 0.72 + 0.42 * s - 0.1 * smoothstep(0.82, 0.98, b);
}
vec3 glassPal(float i) {
  // 0 ruby, 1 cobalt, 2 amber, 3 emerald, 4 amethyst, 5 pale moon, 6 gold
  if (i < 0.5) return vec3(0.62, 0.05, 0.08);
  if (i < 1.5) return vec3(0.07, 0.16, 0.62);
  if (i < 2.5) return vec3(0.85, 0.5, 0.1);
  if (i < 3.5) return vec3(0.08, 0.42, 0.22);
  if (i < 4.5) return vec3(0.36, 0.14, 0.5);
  if (i < 5.5) return vec3(0.55, 0.62, 0.7);
  return vec3(0.95, 0.72, 0.25);
}
`;

/** Fanlight over the front door: a half sunburst. UV covers the bounding rect (aspect 2:1). */
export function fanlightTexture(forge) {
  return forge.generate('foyer:fanlight', {
    size: 1024, aspect: 2, tile: false,
    glsl: GLASS_COMMON + /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = vec2(uv.x * 2.0 - 1.0, uv.y);          // semicircle radius 1, centre at bottom middle
  float r = length(p);
  float a = atan(p.y, p.x);                       // 0..PI
  float lead = 0.0;
  vec3 col;
  float n = antique(uv, 1.0);
  // hub
  if (r < 0.24) {
    col = glassPal(2.0);
    float petals = abs(sin(a * 6.0)) * 0.08 + 0.1;
    col = mix(col, glassPal(0.0), step(r, petals));
    lead = max(lead, stroke(r - petals, 0.0, 0.008));
  } else if (r < 0.86) {
    // 12 rays alternating cobalt / moon with ruby tips
    float k = a / PI * 12.0;
    float id = floor(k);
    float f = fract(k);
    float tip = smoothstep(0.7, 0.72, r);
    col = mod(id, 2.0) < 0.5 ? glassPal(1.0) : glassPal(5.0);
    col = mix(col, mod(id, 2.0) < 0.5 ? glassPal(0.0) : glassPal(6.0), tip);
    lead = max(lead, 1.0 - smoothstep(0.0, 0.035, min(f, 1.0 - f) * r * 2.0));
    lead = max(lead, stroke(r - 0.71, 0.0, 0.006));
  } else {
    // jewel border
    float k = a / PI * 22.0;
    float f = fract(k);
    col = mod(floor(k), 2.0) < 0.5 ? glassPal(3.0) : glassPal(2.0);
    float jew = length(vec2((f - 0.5) * 0.14, r - 0.93));
    col = mix(col, glassPal(0.0), smoothstep(0.035, 0.03, jew));
    lead = max(lead, stroke(jew - 0.034, 0.0, 0.005));
    lead = max(lead, 1.0 - smoothstep(0.0, 0.006, min(f, 1.0 - f) * 0.14));
  }
  lead = max(lead, stroke(r - 0.24, 0.0, 0.008));
  lead = max(lead, stroke(r - 0.86, 0.0, 0.008));
  lead = max(lead, stroke(r - 0.995, 0.0, 0.012));
  lead = max(lead, 1.0 - smoothstep(0.0, 0.012, p.y));
  col *= n;
  col = mix(col, vec3(0.012, 0.01, 0.01), lead);
  s.albedo = col;
  s.alpha = step(r, 1.0);
  s.height = 1.0 - lead; s.rough = mix(0.08, 0.6, lead); s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** The great arched window over the door: leaded quarries, a jewel border and an eight-pointed star. aspect = w/h. */
export function greatWindowTexture(forge, aspect) {
  return forge.generate('foyer:greatwindow', {
    size: 1536, aspect, tile: false, uniforms: { uAsp: aspect },
    glsl: GLASS_COMMON + /* glsl */ `
float sdStarPoly(vec2 p, float r) { return sdStar(p, r, 8.0, 3.0); }
void surface(vec2 uv, inout Surface s) {
  // metric coordinates: width 1 unit (=window width), height 1/uAsp
  vec2 m = vec2(uv.x - 0.5, uv.y / uAsp);
  float H = 1.0 / uAsp;
  float R = 0.5;                                      // arch radius
  float springY = H - R;
  // inside-shape distance (negative inside)
  float dRect = max(abs(m.x) - 0.5, -m.y);
  float dArch = length(m - vec2(0.0, springY)) - R;
  float inside = m.y < springY ? dRect : max(dArch, -m.y);
  float n = antique(uv * vec2(1.0, H), 3.0);
  float lead = 0.0;
  vec3 col;
  // jewel border band 0.07 wide
  float edge = -inside;
  if (edge < 0.07) {
    float along = m.y < springY ? m.y : springY + atan(m.y - springY, abs(m.x) + 1e-4) * R;
    float k = along / 0.07;
    float f = fract(k);
    col = mod(floor(k), 2.0) < 0.5 ? glassPal(0.0) : glassPal(1.0);
    float sq = sdBox(vec2(f - 0.5, (edge - 0.035) / 0.07), vec2(0.22));
    col = mix(col, glassPal(6.0), smoothstep(0.02, 0.0, sq));
    lead = max(lead, stroke(sq, 0.0, 0.025));
    lead = max(lead, 1.0 - smoothstep(0.0, 0.05, min(f, 1.0 - f)));
    lead = max(lead, stroke(edge - 0.07, 0.0, 0.004));
  } else {
    // diamond quarries
    vec2 q = rot2(PI * 0.25) * (m * vec2(1.0, 0.75)) * 9.0;
    vec2 qf = fract(q) - 0.5;
    vec2 qi = floor(q);
    float h = hash12(qi);
    col = mix(vec3(0.42, 0.5, 0.58), vec3(0.5, 0.52, 0.6), h);
    col = mix(col, glassPal(4.0) * 1.2, step(0.86, h) * 0.6);
    lead = max(lead, 1.0 - smoothstep(0.0, 0.05, 0.5 - max(abs(qf.x), abs(qf.y))));
    // central medallion: the octagram, ruby on gold, in a cobalt roundel
    vec2 c = m - vec2(0.0, H * 0.42);
    float rc = length(c);
    if (rc < 0.3) {
      col = glassPal(1.0);
      float st = sdStarPoly(c, 0.25);
      col = mix(col, glassPal(6.0), step(st, 0.0));
      col = mix(col, glassPal(0.0), step(rc, 0.07));
      lead = max(lead, stroke(st, 0.0, 0.006));
      lead = max(lead, stroke(rc - 0.07, 0.0, 0.006));
      // star ray subdivisions
      float aa = atan(c.y, c.x) / TAU * 16.0;
      float fa = fract(aa);
      lead = max(lead, (1.0 - smoothstep(0.0, 0.02, min(fa, 1.0 - fa) * rc * 6.0)) * step(st, 0.0) * step(0.07, rc));
    }
    lead = max(lead, stroke(rc - 0.3, 0.0, 0.008));
    lead = max(lead, stroke(rc - 0.315, 0.0, 0.005));
    col = mix(col, glassPal(2.0), smoothstep(0.31, 0.3, rc) * smoothstep(0.3, 0.31, rc + 0.012));
    // arch rose: radiating panes in the semicircle
    vec2 ar = m - vec2(0.0, springY);
    float ra = length(ar);
    if (m.y > springY && ra < R - 0.07) {
      float k = atan(ar.y, ar.x) / PI * 10.0;
      float f = fract(k);
      col = mix(glassPal(5.0), mod(floor(k), 2.0) < 0.5 ? glassPal(3.0) : glassPal(4.0), smoothstep(0.18, 0.2, ra));
      col = mix(col, glassPal(2.0), step(ra, 0.1));
      lead = max(lead, (1.0 - smoothstep(0.0, 0.03, min(f, 1.0 - f) * ra * 3.0)) * step(0.1, ra));
      lead = max(lead, stroke(ra - 0.1, 0.0, 0.005));
      lead = max(lead, stroke(ra - 0.19, 0.0, 0.005));
    }
    lead = max(lead, stroke(m.y - springY, 0.0, 0.006) * step(R - 0.07, ra) * 0.0);
    // horizontal saddle bars
    for (int i = 1; i < 5; i++) lead = max(lead, stroke(m.y - float(i) * springY / 5.0, 0.0, 0.006) * step(0.32, rc));
    lead = max(lead, stroke(m.y - springY, 0.0, 0.007));
  }
  col *= n;
  col = mix(col, vec3(0.01), lead);
  s.albedo = col;
  s.alpha = step(inside, 0.0);
  s.height = 1.0 - lead; s.rough = mix(0.1, 0.6, lead); s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Sidelight panes: tall leaded diamonds with a roundel every metre. */
export function sidelightTexture(forge, aspect) {
  return forge.generate('foyer:sidelight', {
    size: 1024, aspect, tile: false, uniforms: { uAsp: aspect },
    glsl: GLASS_COMMON + /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 m = vec2(uv.x - 0.5, uv.y / uAsp);
  float H = 1.0 / uAsp;
  float edge = min(0.5 - abs(m.x), min(m.y, H - m.y));
  float lead = 0.0;
  vec3 col;
  float n = antique(uv * vec2(1.0, H), 5.0);
  if (edge < 0.12) {
    col = glassPal(1.0);
    float k = m.y / 0.24; float f = fract(k);
    col = mix(col, glassPal(0.0), step(0.5, fract(k * 0.5)) * 0.9);
    lead = max(lead, 1.0 - smoothstep(0.0, 0.08, min(f, 1.0 - f)));
    lead = max(lead, stroke(edge - 0.12, 0.0, 0.012));
  } else {
    vec2 q = rot2(PI * 0.25) * vec2(m.x * 1.4, m.y) * 3.2;
    vec2 qf = fract(q) - 0.5;
    col = mix(vec3(0.45, 0.52, 0.6), vec3(0.52, 0.55, 0.62), hash12(floor(q)));
    lead = max(lead, 1.0 - smoothstep(0.0, 0.05, 0.5 - max(abs(qf.x), abs(qf.y))));
    float cy = (floor(m.y / 0.9) + 0.5) * 0.9;
    float rc = length(vec2(m.x, m.y - cy));
    if (rc < 0.22) {
      col = glassPal(6.0);
      col = mix(col, glassPal(0.0), step(rc, 0.1));
      float st = sdStar(vec2(m.x, m.y - cy), 0.19, 8.0, 3.0);
      col = mix(col, glassPal(3.0), step(0.0, st) * step(0.1, rc));
      lead = max(lead, stroke(st, 0.0, 0.01));
      lead = max(lead, stroke(rc - 0.1, 0.0, 0.01));
    }
    lead = max(lead, stroke(rc - 0.22, 0.0, 0.012));
  }
  col *= n;
  col = mix(col, vec3(0.01), lead);
  s.albedo = col; s.alpha = 1.0;
  s.height = 1.0 - lead; s.rough = mix(0.1, 0.6, lead); s.metal = 0.0; s.ao = 1.0;
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
  return forge.generate('foyer:medallion', {
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
  vec3 nero = marbleCol(p, vec3(0.035, 0.035, 0.04), vec3(0.62, 0.6, 0.58), 1.0, 3.0);
  vec3 rosso = marbleCol(p, vec3(0.42, 0.09, 0.07), vec3(0.85, 0.7, 0.62), 4.0, 4.0);
  vec3 verde = marbleCol(p, vec3(0.05, 0.16, 0.11), vec3(0.62, 0.75, 0.68), 9.0, 4.0);
  vec3 carrara = marbleCol(p, vec3(0.86, 0.85, 0.82), vec3(0.42, 0.43, 0.46), 13.0, 2.5);
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
  rough = mix(0.24 + 0.12 * wear, 0.3 + 0.15 * wear, inl);
  col = mix(col, vec3(0.08, 0.07, 0.06), joint * 0.8);
  h = 0.6 - joint * 0.3 - inl * 0.03;
  // scuffs & dull traffic patina
  float scuff = smoothstep(0.55, 0.8, fbm(p * 2.2 + 3.0, vec2(64.0), 5) * 0.5 + 0.5);
  rough = mix(rough, rough + 0.18, scuff);
  s.albedo = col;
  s.alpha = step(r, 1.0);
  s.height = h; s.rough = rough; s.metal = metal; s.ao = 1.0 - joint * 0.4;
}`,
  });
}

/** Stair runner: crimson Wilton carpet with gold guilloche borders. u across (1.2 m), v along (period 0.6 m). */
export function carpetTexture(forge) {
  return forge.generate('foyer:carpet', {
    size: 1024, aspect: 2, tile: true, normalStrength: 1.6,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float u = uv.x;                    // 0..1 across
  float v = uv.y;                    // 0..1 along (one period)
  vec3 crimson = vec3(0.36, 0.035, 0.045);
  vec3 deep = vec3(0.16, 0.015, 0.03);
  vec3 gold = vec3(0.72, 0.5, 0.18);
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
  // worn tread centre
  float wear = smoothstep(0.4, 0.0, abs(u - 0.5)) * 0.15;
  col *= (0.82 + 0.3 * pile) * (1.0 - wear * 0.5);
  col = mix(col, col * vec3(1.1, 1.0, 0.9) + 0.02, wear);
  s.albedo = col;
  s.height = 0.5 + pile * 0.35 - step(0.12, e) * 0.0;
  s.rough = 0.95; s.metal = 0.0; s.ao = 0.85 + 0.15 * pile;
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
 * Portrait of Henry Stauf, toymaker: a gaunt, bald old man in a high wing collar,
 * lit from below-left by a single candle (Rembrandt-in-reverse), with a jester
 * marionette dangling from his fingers and the house itself glimpsed through a
 * storm window behind him. Painted, varnished, crazed.
 */
export function staufPortraitTexture(forge, aspect) {
  return forge.generate('foyer:stauf', {
    size: 1536, aspect, tile: false, uniforms: { uAsp: aspect }, normalStrength: 0.6,
    glsl: /* glsl */ `
float fb(vec2 p, int o) { return fbm(p, vec2(64.0), o) * 0.5 + 0.5; }
vec3 staufPaint(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(uAsp, 1.0);
  // ---- ground: umber dark with a warm bloom behind the head
  vec3 col = mix(vec3(0.03, 0.022, 0.018), vec3(0.2, 0.13, 0.07), exp(-length((p - vec2(-0.12, 0.1)) * vec2(1.0, 0.75)) * 3.0));
  col *= 0.8 + 0.35 * fb(uv * 5.0 + 2.0, 4);
  // ---- storm window, upper right: moon, clouds, the house on its hill
  vec2 w = p - vec2(0.23, 0.27);
  float win = sdBox(w, vec2(0.085, 0.13));
  float winArch = length(w - vec2(0.0, 0.13)) - 0.085;
  float inWin = min(win, max(winArch, -(w.y - 0.13)));
  if (inWin < 0.0) {
    vec3 sky = mix(vec3(0.05, 0.07, 0.11), vec3(0.28, 0.3, 0.34), smoothstep(-0.12, 0.2, w.y));
    float cl = fb(w * vec2(9.0, 18.0) + 3.0, 5);
    sky = mix(sky, vec3(0.08, 0.08, 0.1), smoothstep(0.45, 0.7, cl));
    sky += vec3(0.85, 0.82, 0.7) * smoothstep(0.022, 0.016, length(w - vec2(0.035, 0.12)));
    float hill = w.y + 0.07 - 0.03 * sin(w.x * 30.0);
    float house = sdBox(w - vec2(-0.015, -0.045), vec2(0.035, 0.03));
    house = min(house, sdBox(w - vec2(-0.03, -0.01), vec2(0.008, 0.03)));   // tower
    house = min(house, max(abs(w.x + 0.03) - 0.016 + (w.y - 0.02) * 0.6, abs(w.y - 0.03) - 0.012)); // spire
    vec3 c = sky;
    c = mix(c, vec3(0.015, 0.015, 0.02), smoothstep(0.002, -0.002, min(hill, house)));
    c += vec3(0.9, 0.6, 0.2) * smoothstep(0.004, 0.0, sdBox(w - vec2(-0.005, -0.045), vec2(0.004, 0.004)));
    col = c;
  }
  col = mix(col, vec3(0.06, 0.04, 0.025), smoothstep(0.006, 0.0, abs(inWin) - 0.004));
  // ---- coat & shoulders (sloping, thin)
  float coat = sdEllipse(p - vec2(-0.01, -0.56), vec2(0.4, 0.4));
  float lightCoat = smoothstep(0.25, -0.35, p.x + p.y * 0.3);
  vec3 coatCol = vec3(0.025, 0.022, 0.026) + vec3(0.07, 0.06, 0.07) * lightCoat * fb(uv * 22.0, 3);
  float lapL = abs(p.x + 0.05 - (p.y + 0.3) * 0.55) - 0.01;
  float lapR = abs(p.x - 0.06 + (p.y + 0.3) * 0.5) - 0.01;
  coatCol += vec3(0.045) * (1.0 - smoothstep(0.0, 0.02, min(lapL, lapR))) * step(p.y, -0.18);
  col = mix(col, coatCol, smoothstep(0.012, -0.012, coat));
  // ---- wing collar + black silk stock
  float vee = max(abs(p.x - 0.005) - (p.y + 0.4) * 0.36, p.y + 0.16);
  vec3 linen = vec3(0.8, 0.76, 0.66) * (0.35 + 0.65 * smoothstep(0.12, -0.12, p.x));
  col = mix(col, linen, smoothstep(0.01, -0.01, vee) * step(-0.55, p.y));
  float wingL = sdBox(rot2(-0.5) * (p - vec2(-0.045, -0.115)), vec2(0.035, 0.016));
  float wingR = sdBox(rot2(0.5) * (p - vec2(0.05, -0.115)), vec2(0.035, 0.016));
  col = mix(col, linen * 1.1, smoothstep(0.006, -0.006, min(wingL, wingR)));
  float stock = sdEllipse(p - vec2(0.0, -0.165), vec2(0.06, 0.032));
  col = mix(col, vec3(0.02, 0.018, 0.02) + 0.04 * lightCoat, smoothstep(0.008, -0.008, stock));
  col += vec3(0.8, 0.55, 0.2) * 0.5 * smoothstep(0.006, 0.0, abs(length((p - vec2(0.09, -0.36)) * vec2(1.0, 2.2)) - 0.07) - 0.002) * step(p.x, 0.15) * step(0.04, p.x); // watch chain
  // ---- neck (scrawny, in shadow)
  float neck = sdBox(p - vec2(0.0, -0.075), vec2(0.035, 0.05));
  col = mix(col, vec3(0.16, 0.1, 0.07) * (0.5 + smoothstep(0.03, -0.03, p.x)), smoothstep(0.008, -0.008, neck));
  // ---- head: long, bald, turned a little to his left
  vec2 hp = rot2(0.07) * (p - vec2(-0.005, 0.085));
  float head = sdEllipse(hp, vec2(0.092, 0.142));
  // narrow jaw: pinch the bottom
  head = max(head, sdEllipse(hp - vec2(0.0, 0.02), vec2(0.105, 0.17)));
  vec2 hn = hp / vec2(0.092, 0.142);
  // key light from lower left (a candle), fill from the window at right
  float key = clamp(0.55 - hn.x * 0.85 - hn.y * 0.25 - dot(hn, hn) * 0.3, 0.0, 1.0);
  float rim = smoothstep(0.7, 1.0, hn.x) * smoothstep(-0.3, 0.6, hn.y) * 0.35;
  vec3 skin = mix(vec3(0.09, 0.05, 0.035), vec3(0.88, 0.7, 0.52), pow(key, 1.1));
  skin += vec3(0.25, 0.3, 0.38) * rim;
  // dome highlight (bald crown catches the light)
  skin += vec3(0.25, 0.2, 0.15) * smoothstep(0.35, 0.0, length(hn - vec2(-0.25, 0.62))) * 0.8;
  // heavy brow ridge, arched, sinister
  float browL = abs(hn.y - 0.25 - 0.18 * (1.0 - pow((hn.x + 0.38) / 0.32, 2.0))) - 0.035;
  browL = max(browL, abs(hn.x + 0.38) - 0.3);
  float browR = abs(hn.y - 0.25 - 0.22 * (1.0 - pow((hn.x - 0.38) / 0.3, 2.0))) - 0.035;
  browR = max(browR, abs(hn.x - 0.38) - 0.28);
  // deep sockets
  float sockL = sdEllipse(hn - vec2(-0.36, 0.1), vec2(0.23, 0.15));
  float sockR = sdEllipse(hn - vec2(0.37, 0.1), vec2(0.21, 0.15));
  skin *= mix(0.3, 1.0, smoothstep(-0.06, 0.1, min(sockL, sockR)));
  skin = mix(skin, vec3(0.5, 0.48, 0.45) * (0.3 + key), (1.0 - smoothstep(-0.01, 0.03, min(browL, browR))) * 0.75);
  // eyes: small, hooded, glinting
  float eyeL = sdEllipse(hn - vec2(-0.35, 0.09), vec2(0.12, 0.04));
  float eyeR = sdEllipse(hn - vec2(0.36, 0.1), vec2(0.11, 0.04));
  skin = mix(skin, vec3(0.03, 0.02, 0.02), 1.0 - smoothstep(-0.01, 0.02, min(eyeL, eyeR)));
  float glint = min(length(hn - vec2(-0.32, 0.1)), length(hn - vec2(0.39, 0.11)));
  skin += vec3(0.9, 0.85, 0.7) * (1.0 - smoothstep(0.012, 0.03, glint));
  // long hooked nose
  float ridge = sdSegment(hn, vec2(-0.03, 0.08), vec2(0.06, -0.36)) - 0.045;
  float noseSh = sdSegment(hn, vec2(0.1, 0.02), vec2(0.18, -0.38)) - 0.06;
  skin = mix(skin, skin * 1.25 + 0.04, (1.0 - smoothstep(0.0, 0.05, ridge)) * 0.6);
  skin *= mix(0.45, 1.0, smoothstep(0.0, 0.08, noseSh));
  float nost = sdEllipse(hn - vec2(0.05, -0.42), vec2(0.14, 0.045));
  skin *= mix(0.5, 1.0, smoothstep(0.0, 0.04, nost));
  // hollow cheeks
  skin *= mix(0.65, 1.0, smoothstep(0.0, 0.25, sdEllipse(hn - vec2(0.48, -0.3), vec2(0.25, 0.3)) + 0.1));
  skin *= mix(0.8, 1.0, smoothstep(0.0, 0.25, sdEllipse(hn - vec2(-0.5, -0.32), vec2(0.2, 0.28)) + 0.1));
  // the smile: thin, curling up at his left
  float mx = hn.x - 0.03;
  float mouth = abs(hn.y + 0.62 - 0.22 * mx * mx - 0.12 * max(mx, 0.0)) - 0.018;
  mouth = max(mouth, abs(mx) - 0.33);
  skin = mix(skin, vec3(0.12, 0.04, 0.035), 1.0 - smoothstep(0.0, 0.025, mouth));
  float lip = abs(hn.y + 0.67 - 0.15 * mx * mx) - 0.02;
  lip = max(lip, abs(mx) - 0.22);
  skin = mix(skin, skin * 1.2, (1.0 - smoothstep(0.0, 0.03, lip)) * 0.4);
  // grey wisps at the temples and behind the ears
  float wisp = smoothstep(0.62, 0.95, abs(hn.x)) * smoothstep(0.55, -0.1, hn.y) * smoothstep(-0.55, -0.1, hn.y);
  wisp *= 0.6 + 0.6 * fb(hn * vec2(3.0, 22.0), 3);
  skin = mix(skin, vec3(0.55, 0.53, 0.5) * (0.35 + key), clamp(wisp, 0.0, 1.0));
  // ears
  float ear = sdEllipse(hn - vec2(-1.02, 0.02), vec2(0.12, 0.26));
  skin *= 0.92 + 0.15 * fb(uv * 50.0, 3);
  col = mix(col, skin, smoothstep(0.01, -0.01, head));
  col = mix(col, vec3(0.5, 0.33, 0.24) * 0.8, smoothstep(0.004, -0.004, (ear) * 0.1) * (1.0 - smoothstep(0.01, -0.01, head)) * step(p.x, -0.06));
  // ---- hand + jester marionette (lower left)
  vec2 hd = p - vec2(-0.2, -0.27);
  float hand = sdEllipse(rot2(0.6) * hd, vec2(0.05, 0.028));
  float fingers = min(sdSegment(hd, vec2(0.02, 0.01), vec2(0.06, 0.03)) - 0.01, sdSegment(hd, vec2(0.02, -0.01), vec2(0.065, 0.0)) - 0.01);
  vec3 handCol = mix(vec3(0.15, 0.09, 0.06), vec3(0.8, 0.62, 0.46), smoothstep(0.05, -0.05, hd.x + hd.y));
  col = mix(col, handCol, smoothstep(0.006, -0.006, min(hand, fingers)));
  // strings
  for (int i = 0; i < 3; i++) {
    float fx0 = -0.16 + float(i) * 0.012;
    float s = abs(p.x - fx0 - (p.y + 0.27) * 0.02 * float(i - 1)) - 0.0012;
    col = mix(col, vec3(0.6, 0.55, 0.45), (1.0 - smoothstep(0.0, 0.002, s)) * step(p.y, -0.28) * step(-0.39, p.y) * 0.7);
  }
  vec2 jp = p - vec2(-0.155, -0.43);
  float jHead = length(jp) - 0.022;
  float jHat = min(sdSegment(jp, vec2(0.0, 0.015), vec2(-0.03, 0.045)), sdSegment(jp, vec2(0.0, 0.015), vec2(0.03, 0.048))) - 0.008;
  float jBody = sdEllipse(jp - vec2(0.0, -0.05), vec2(0.03, 0.035));
  col = mix(col, vec3(0.5, 0.06, 0.05) * (0.5 + smoothstep(0.03, -0.03, jp.x)), smoothstep(0.004, -0.004, min(jBody, jHat)));
  col = mix(col, vec3(0.8, 0.75, 0.66) * (0.5 + smoothstep(0.02, -0.02, jp.x)), smoothstep(0.004, -0.004, jHead));
  col = mix(col, vec3(0.05), smoothstep(0.003, 0.0, abs(jHead + 0.01) - 0.0015) * step(jp.y, -0.004) * step(abs(jp.x), 0.012));
  col += vec3(0.9, 0.7, 0.2) * 0.6 * smoothstep(0.008, 0.0, min(length(jp - vec2(-0.03, 0.045)), length(jp - vec2(0.03, 0.048))));
  // painted oval spandrel
  float oval = sdEllipse((uv - 0.5) * vec2(uAsp, 1.0), vec2(0.465 * uAsp, 0.475));
  col = mix(col, vec3(0.025, 0.02, 0.016), smoothstep(-0.02, 0.025, oval));
  return col;
}
void surface(vec2 uv, inout Surface s) {
  vec2 b = uv + (vec2(fb(uv * 7.0, 3), fb(uv * 7.0 + 5.0, 3)) - 0.5) * 0.006;
  vec3 col = staufPaint(b);
  col = pow(max(col, 0.0), vec3(0.9)) * 1.2;
  float strokes = fb(rot2(fb(uv * 3.0, 2) * 3.0) * uv * vec2(70.0, 20.0), 3);
  col *= 0.9 + 0.16 * strokes;
  // yellowed varnish, darker at the rebate
  float edge = min(min(uv.x, 1.0 - uv.x) * uAsp, min(uv.y, 1.0 - uv.y));
  col = mix(col, col * vec3(1.0, 0.8, 0.5), 0.55);
  col *= mix(0.5, 1.0, smoothstep(0.0, 0.1, edge));
  // craquelure
  vec2 cq = uv * vec2(uAsp, 1.0) * 80.0;
  float cr = voronoiEdge(cq + (vec2(fb(uv * 9.0, 3), fb(uv * 9.0 + 3.0, 3)) - 0.5) * 1.2, vec2(1e4), 1.0);
  float crack = 1.0 - smoothstep(0.0, 0.06, cr);
  col *= 1.0 - crack * 0.35;
  s.albedo = col;
  s.height = 0.5 + strokes * 0.25 - crack * 0.3;
  s.rough = 0.35 + strokes * 0.2 + crack * 0.3;
  s.metal = 0.0; s.ao = 1.0 - crack * 0.3;
}`,
  });
}
