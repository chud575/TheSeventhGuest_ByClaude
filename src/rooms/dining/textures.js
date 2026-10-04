/**
 * Dining-room procedural textures (TextureForge GLSL, authored for this room):
 * the moonlit winter garden seen through the window, the cake's chocolate
 * ganache and its blood-red layered sponge, blue-and-white china, and the
 * stamped-velvet wallpaper with its small fleur lattice.
 */

/** Night garden beyond the window: snow, bare trees, moon behind thin cloud. HDR-ish (multiplied in the material). */
export function nightGardenTexture(forge) {
  return forge.generate('dining:nightgarden', {
    size: 1024, aspect: 0.75, tile: false,
    glsl: /* glsl */ `
float tree(vec2 p, vec2 base, float hgt, float seed) {
  vec2 q = p - base;
  float d = 1e5;
  // trunk
  float tw = 0.012 * (1.0 - q.y / hgt) + 0.002;
  d = min(d, max(abs(q.x - 0.012 * sin(q.y * 14.0 + seed)) - tw, max(-q.y, q.y - hgt)));
  // branches
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float y0 = hgt * (0.28 + fi * 0.08);
    float side = mod(fi, 2.0) < 0.5 ? -1.0 : 1.0;
    float ang = side * (0.75 + 0.25 * sin(fi * 7.3 + seed));
    vec2 o = vec2(0.0, y0);
    vec2 b = rot2(ang) * (q - o);
    float len = hgt * (0.36 - fi * 0.028);
    float bw = 0.0045 * (1.0 - clamp(b.y / len, 0.0, 1.0)) + 0.0008;
    d = min(d, max(abs(b.x + 0.012 * sin(b.y * 40.0 + fi)) - bw, max(-b.y, b.y - len)));
    // twigs
    vec2 c = rot2(-side * 0.6) * (b - vec2(0.0, len * 0.55));
    d = min(d, max(abs(c.x) - 0.0012, max(-c.y, c.y - len * 0.45)));
  }
  return d;
}
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  vec2 moon = vec2(0.64, 0.8);
  float md = length((p - moon) * vec2(0.75, 1.0));
  vec3 sky = mix(vec3(0.05, 0.075, 0.16), vec3(0.32, 0.4, 0.6), smoothstep(0.35, 1.0, p.y));
  sky += vec3(0.6, 0.68, 0.85) * exp(-md * 5.0) * 0.8;
  float cl = fbm(p * vec2(1.4, 3.0) + vec2(0.3, 0.1), vec2(3.0, 3.0), 6);
  sky = mix(sky, sky * 0.5 + vec3(0.03, 0.035, 0.05), smoothstep(-0.1, 0.4, cl) * 0.7);
  sky += vec3(0.75, 0.8, 0.9) * smoothstep(0.15, 0.0, abs(cl - 0.05)) * exp(-md * 3.0) * 0.6;
  sky = mix(sky, vec3(1.0, 0.98, 0.93) * 1.3, smoothstep(0.042, 0.036, md));
  // distant treeline + snowy ground
  float hill = p.y - (0.3 + 0.03 * fbm(vec2(p.x * 3.0, 0.0), vec2(3.0, 1.0), 4));
  float far = p.y - (0.36 + 0.06 * fbm(vec2(p.x * 8.0, 1.0), vec2(8.0, 1.0), 5));
  vec3 col = sky;
  col = mix(col, vec3(0.12, 0.15, 0.24), smoothstep(0.004, -0.004, far));
  vec3 snow = mix(vec3(0.36, 0.42, 0.58), vec3(0.62, 0.68, 0.82), smoothstep(0.0, 0.3, p.y)) * (0.85 + 0.15 * fbm(p * 20.0, vec2(20.0), 3));
  col = mix(col, snow, smoothstep(0.004, -0.004, hill));
  float t = min(tree(p, vec2(0.2, 0.22), 0.7, 1.0), tree(p, vec2(0.86, 0.26), 0.55, 4.0));
  t = min(t, tree(p, vec2(0.48, 0.32), 0.18, 9.0));
  col = mix(col, vec3(0.012, 0.014, 0.025), smoothstep(0.0025, -0.0025, t));
  // snowflakes
  vec2 g = p * vec2(60.0, 80.0);
  vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  vec2 o = hash22(id) - 0.5;
  float fl = smoothstep(0.08, 0.0, length(f - o * 0.7)) * step(0.82, hash12(id + 3.1));
  col += vec3(0.6, 0.65, 0.8) * fl * 0.5;
  s.albedo = col; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Glossy dark chocolate ganache with palette-knife swirls. Tiles; UV in metres * repeat. */
export function ganacheTexture(forge) {
  return forge.generate('dining:ganache', {
    size: 512, normalStrength: 0.35,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float sw = fbm(uv * 3.0 + fbm(uv * 2.0, vec2(2.0), 3) * 0.8, vec2(3.0), 4);
  float ridge = 1.0 - abs(sin(sw * 5.0));
  vec3 c = mix(vec3(0.2, 0.1, 0.058), vec3(0.29, 0.15, 0.085), ridge * 0.35 + 0.25 * fbm(uv * 12.0, vec2(12.0), 3));
  s.albedo = c;
  s.height = 0.5 + ridge * 0.05 + sw * 0.04;
  s.rough = 0.16 + 0.12 * (1.0 - ridge);
  s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Cut face of the cake: red-velvet sponge with cream layers, ganache cap. v = 0 bottom .. 1 top; u tiles. */
export function spongeTexture(forge) {
  return forge.generate('dining:sponge', {
    size: 512, normalStrength: 1.4,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float v = uv.y;
  float pores = vnoise(uv * vec2(90.0, 90.0), vec2(90.0));
  float pores2 = vnoise(uv * vec2(190.0, 190.0) + 3.0, vec2(190.0));
  float por = smoothstep(0.55, 0.85, pores * 0.6 + pores2 * 0.4);
  vec3 sponge = mix(vec3(0.42, 0.04, 0.05), vec3(0.24, 0.02, 0.03), por);
  vec3 cream = vec3(0.88, 0.82, 0.72) * (0.92 + 0.08 * fbm(uv * 20.0, vec2(20.0), 3));
  vec3 gan = vec3(0.2, 0.1, 0.058);
  float wob = 0.012 * fbm(vec2(uv.x * 6.0, 0.0), vec2(6.0, 1.0), 3);
  float vv = v + wob;
  vec3 c = sponge; float h = 0.5 - por * 0.25; float r = 0.85;
  float cr1 = smoothstep(0.30, 0.31, vv) * (1.0 - smoothstep(0.37, 0.38, vv));
  float cr2 = smoothstep(0.60, 0.61, vv) * (1.0 - smoothstep(0.67, 0.68, vv));
  float cap = smoothstep(0.88, 0.895, vv);
  float base = 1.0 - smoothstep(0.03, 0.04, vv);
  c = mix(c, cream, max(cr1, cr2)); h = mix(h, 0.62, max(cr1, cr2)); r = mix(r, 0.55, max(cr1, cr2));
  c = mix(c, gan, max(cap, base)); h = mix(h, 0.7, cap); r = mix(r, 0.2, cap);
  s.albedo = c; s.height = h; s.rough = r; s.metal = 0.0; s.ao = 1.0 - por * 0.4;
}`,
  });
}

/** Blue-and-white transfer-ware plate (UV = disc, centre 0.5,0.5). Non-tiling. */
export function chinaTexture(forge, { seed = 1 } = {}) {
  return forge.generate(`dining:china${seed}`, {
    size: 512, tile: false, normalStrength: 0.2,
    uniforms: { uK: seed },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = (uv - 0.5) * 2.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  vec3 white = vec3(0.93, 0.92, 0.88);
  vec3 blue = vec3(0.08, 0.16, 0.48);
  float ink = 0.0;
  // rim band with scalloped garland
  float rim = smoothstep(0.78, 0.79, r) * (1.0 - smoothstep(0.96, 0.97, r));
  float garland = stroke(r - 0.87 - 0.035 * sin(a * 16.0), 0.0, 0.012);
  float dots = smoothstep(0.02, 0.0, length(vec2(fract(a / TAU * 32.0) - 0.5, (r - 0.93) * 6.0)) - 0.12);
  ink = max(ink, garland); ink = max(ink, dots * step(0.9, r));
  ink = max(ink, stroke(r - 0.78, 0.0, 0.006));
  ink = max(ink, stroke(r - 0.97, 0.0, 0.01));
  // centre medallion: willow-ish scene abstracted to arabesque petals
  vec2 q = polarRep(p, 8.0 + uK * 2.0);
  float petal = sdVesica(q - vec2(0.32, 0.0), 0.16, 0.1);
  ink = max(ink, fill(petal, 0.01) * step(r, 0.7) * (0.6 + 0.4 * fbm(p * 6.0, vec2(6.0), 3)));
  ink = max(ink, stroke(r - 0.18, 0.0, 0.01));
  ink = max(ink, fill(r - 0.08, 0.01));
  ink = max(ink, stroke(r - 0.66, 0.0, 0.008));
  ink *= 0.85 + 0.15 * fbm(p * 30.0, vec2(30.0), 2);
  s.albedo = mix(white, blue, saturate(ink));
  s.height = 0.5 + 0.05 * rim;
  s.rough = 0.12; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Small-repeat flocked wallpaper: lattice of fleur sprigs on deep Prussian blue (as in the 1993 room). */
export function wallpaperTexture(forge) {
  return forge.generate('dining:wallpaper', {
    size: 1024, normalStrength: 1.0,
    glsl: /* glsl */ `
float sprig(vec2 p) {
  p.x = abs(p.x);
  float d = sdVesica(p - vec2(0.0, 0.06), 0.13, 0.1);
  d = min(d, sdVesica(rot2(-0.9) * (p - vec2(0.07, 0.0)), 0.08, 0.06));
  d = min(d, sdCircle(p - vec2(0.0, -0.1), 0.028));
  d = min(d, sdCircle(p - vec2(0.12, 0.08), 0.018));
  return d;
}
void surface(vec2 uv, inout Surface s) {
  // two half-drop rows of sprigs per tile, plus tiny diamonds between
  vec2 g = uv * vec2(4.0, 4.0);
  vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float d = sprig(f * 1.6);
  vec2 g2 = g + vec2(0.5, 0.5);
  vec2 f2 = fract(g2) - 0.5;
  float dd = sdRhombus(f2, vec2(0.05, 0.075));
  float m = fill(d, 0.012);
  float m2 = fill(dd, 0.01);
  float ag = fbm(uv * 3.0, vec2(3.0), 4);
  vec3 ground = vec3(0.12, 0.17, 0.42) * (0.92 + 0.12 * ag);
  vec3 motif = vec3(0.3, 0.4, 0.74);
  vec3 c = mix(ground, motif, m * 0.75 + m2 * 0.45);
  // paper texture + age stains
  c *= 0.95 + 0.05 * vnoise(uv * 300.0, vec2(300.0));
  c *= 1.0 - 0.18 * smoothstep(0.3, 0.8, fbm(uv * 1.5 + 4.0, vec2(1.5), 5));
  s.albedo = c;
  s.height = 0.45 + 0.1 * (m + m2 * 0.6);
  s.rough = mix(0.85, 0.45, m);
  s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/**
 * Painted ceiling field inside the beam frame: mottled Prussian blue with a gilt
 * line border, corner fans and a large stencilled sunburst around the rose.
 * UV spans the field's bounding box; uRose = rose position in that UV space.
 */
export function ceilingFieldTexture(forge, { aspect = 0.67, rose = [0.5, 0.5] } = {}) {
  return forge.generate('dining:ceilingfield', {
    size: 1024, aspect, tile: false, normalStrength: 0.6,
    uniforms: { uRose: rose, uAsp: aspect },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = vec2(uv.x * uAsp, uv.y);              // metric-ish (y = 1 = long side)
  vec2 r = vec2(uRose.x * uAsp, uRose.y);
  float mott = fbm(uv * 6.0, vec2(6.0), 5);
  vec3 blue = vec3(0.11, 0.15, 0.32) * (0.85 + 0.3 * mott);
  float gold = 0.0;
  // borders: double gilt line inset from the edges
  vec2 e = min(vec2(p.x, p.y), vec2(uAsp - p.x, 1.0 - p.y));
  float de = min(e.x, e.y);
  gold = max(gold, stroke(de - 0.035, 0.0, 0.0025));
  gold = max(gold, stroke(de - 0.048, 0.0, 0.0012));
  // running scroll between the lines
  float along = e.x < e.y ? p.y : p.x;
  float sc = stroke(de - 0.0415 - 0.005 * sin(along * 140.0), 0.0, 0.0009);
  gold = max(gold, sc * 0.8);
  // corner fans
  for (int i = 0; i < 4; i++) {
    vec2 c = vec2(mod(float(i), 2.0) < 0.5 ? 0.048 : uAsp - 0.048, i < 2 ? 0.048 : 0.952);
    vec2 q = p - c;
    float rr = length(q);
    float ang = atan(q.y, q.x);
    float rays = smoothstep(0.6, 0.95, abs(sin(ang * 9.0)));
    gold = max(gold, rays * step(rr, 0.11) * step(0.02, rr) * 0.75);
    gold = max(gold, stroke(rr - 0.11, 0.0, 0.0015));
  }
  // sunburst medallion around the rose
  vec2 q = p - r;
  float rr = length(q);
  float ang = atan(q.y, q.x);
  float petals = 0.105 + 0.012 * cos(ang * 16.0);
  gold = max(gold, stroke(rr - petals, 0.0, 0.0012));
  gold = max(gold, stroke(rr - 0.14, 0.0, 0.0012));
  gold = max(gold, stroke(rr - 0.148, 0.0, 0.0007));
  float rays = smoothstep(0.85, 0.99, abs(sin(ang * 32.0))) * step(0.078, rr) * step(rr, petals - 0.006);
  gold = max(gold, rays * 0.7);
  vec2 qq = polarRep(q, 24.0);
  float lv = fill(sdVesica((qq - vec2(0.125, 0.0)).yx, 0.012, 0.0075), 0.0012);
  gold = max(gold, lv);
  // painted acanthus rinceau: eight scrolling arms leave the medallion, each throwing leaves and
  // ending in a curled volute, with a soft dark-blue glaze shadow under the gilding
  float arms = 0.0, armSh = 0.0;
  for (int i = 0; i < 8; i++) {
    float a0 = float(i) * 0.785398 + 0.39;
    float sg = mod(float(i), 2.0) < 0.5 ? 1.0 : -1.0;
    float t = clamp((rr - 0.16) / 0.2, 0.0, 1.0);
    float th = a0 + 0.55 * sin(t * 5.5) * (1.0 - 0.3 * t) + sg * t * 0.35;
    float dth = atan(sin(ang - th), cos(ang - th));
    float inr = step(0.16, rr) * step(rr, 0.37);
    float d = abs(dth) * rr;
    float w = mix(0.0045, 0.0018, t);
    arms = max(arms, inr * smoothstep(w, w * 0.4, d));
    armSh = max(armSh, inr * smoothstep(w * 4.0, w, d));
    // leaves: one every 1/7 of the arm, alternating sides, laid along the stem
    float li = floor(t * 7.0 + 0.5);
    float lt = li / 7.0;
    if (li > 0.5 && li < 6.5) {
      float lth = a0 + 0.55 * sin(lt * 5.5) * (1.0 - 0.3 * lt) + sg * lt * 0.35;
      float lrad = 0.16 + lt * 0.2;
      vec2 c = r + lrad * vec2(cos(lth), sin(lth));
      float side = mod(li, 2.0) < 0.5 ? 1.0 : -1.0;
      vec2 tang = vec2(-sin(lth), cos(lth));
      vec2 la = normalize(tang * side + vec2(cos(lth), sin(lth)) * 0.6);
      vec2 lq = p - (c + la * 0.014);
      float lu = dot(lq, la), lv = dot(lq, vec2(-la.y, la.x));
      float lf = smoothstep(1.0, 0.85, length(vec2(lu / 0.017, lv / (0.0065 * (1.0 + 0.4 * sin(lu * 500.0))))));
      arms = max(arms, lf * 0.9);
      armSh = max(armSh, smoothstep(1.6, 1.0, length(vec2(lu / 0.017, lv / 0.0065))));
    }
    // volute at the arm's end
    float th1 = a0 + 0.55 * sin(5.5) * 0.7 + sg * 0.35;
    vec2 vc = r + 0.38 * vec2(cos(th1), sin(th1));
    vec2 vq = p - vc; float vr = length(vq); float va = atan(vq.y, vq.x);
    float spiral = abs(fract((va / 6.2832) + vr / 0.008) - 0.5);
    arms = max(arms, smoothstep(0.2, 0.06, spiral) * step(vr, 0.02) * 0.9);
  }
  blue *= 1.0 - 0.35 * armSh * (1.0 - arms);
  gold = max(gold, arms * step(0.15, rr));
  // scattered gilt stars across the field
  vec2 sg = uv * vec2(uAsp * 9.0, 9.0);
  vec2 sf = fract(sg) - 0.5;
  float st = fill(sdStar(sf, 0.07, 5.0, 2.5), 0.01) * step(0.42, rr) * step(0.12, de);
  gold = max(gold, st * 0.65);
  gold *= 0.75 + 0.25 * fbm(uv * 40.0, vec2(40.0), 3);
  vec3 gilt = vec3(0.78, 0.58, 0.28);
  s.albedo = mix(blue, gilt, gold);
  s.metal = gold * 0.9;
  s.rough = mix(0.85, 0.38, gold);
  s.height = 0.5 + gold * 0.15;
  s.ao = 1.0;
}`,
  });
}

/** Diamond button-tufted velvet (seat cushions). UV in metres; one tile = 0.36 m. */
export function tuftedTexture(forge) {
  return forge.generate('dining:tufted', {
    size: 1024, normalStrength: 2.2,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  // diamond lattice: 4 x 4 cells per tile, offset rows
  vec2 g = uv * vec2(4.0, 4.0);
  vec2 q = vec2(g.x + g.y, g.x - g.y) * 0.5;      // rotate 45deg
  vec2 f = fract(q) - 0.5;
  vec2 dc = abs(f);
  float edge = max(dc.x, dc.y);                    // 0 centre -> 0.5 pleat line
  float dome = cos(min(edge, 0.5) * PI);          // pillow
  // buttons at the diamond corners
  vec2 bc = fract(q + 0.5) - 0.5;
  float bd = length(bc);
  float button = smoothstep(0.075, 0.055, bd);
  float dimple = smoothstep(0.22, 0.0, bd);
  // radiating creases into each button
  float ang = atan(bc.y, bc.x);
  float crease = pow(abs(sin(ang * 4.0)), 18.0) * smoothstep(0.32, 0.06, bd) * 0.6;
  float nap = fbm(uv * 30.0, vec2(30.0), 4);
  float crush = fbm(uv * 3.0 + nap * 0.2, vec2(3.0), 4);
  float h = dome * 0.55 - dimple * 0.35 - crease * 0.25 + button * 0.32 + nap * 0.02;
  vec3 velvet = vec3(0.07, 0.15, 0.2) * (0.75 + 0.5 * dome) * (0.85 + 0.25 * crush);
  velvet *= 1.0 - 0.35 * smoothstep(0.3, 0.5, edge);
  vec3 btn = vec3(0.06, 0.12, 0.16) * (0.8 + 0.4 * smoothstep(0.07, 0.0, length(bc + vec2(0.02, -0.02))));
  s.albedo = mix(velvet, btn, button);
  s.height = h;
  s.rough = mix(0.82, 0.55, button);
  s.metal = 0.0;
  s.ao = 1.0 - dimple * 0.45 - smoothstep(0.32, 0.5, edge) * 0.25;
}`,
  });
}

/** French-polished flame mahogany veneer (book-matched crotch figure). UV 0..1 across the top. */
export function flameMahoganyTexture(forge) {
  return forge.generate('dining:flamemahogany', {
    size: 2048, tile: false, normalStrength: 0.15,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv - 0.5;
  float bm = abs(p.x);                           // book-matched quartered veneer
  float w = fbm(vec2(bm * 3.0, p.y * 1.5) + 3.0, vec2(4.0), 4) * 0.05;
  float flame = p.y * 3.0 - bm * bm * 5.0 + w * 3.0;
  float rings = sin(flame * 26.0 + fbm(vec2(bm * 10.0, p.y * 6.0), vec2(12.0), 4) * 2.5);
  float fine = fbm(vec2(bm * 90.0, flame * 6.0), vec2(96.0), 3);
  float curl = sin(bm * 220.0 + fbm(p * 10.0, vec2(10.0), 3) * 4.0) * 0.5 + 0.5;
  vec3 dark = vec3(0.13, 0.04, 0.025), mid = vec3(0.24, 0.075, 0.04), lite = vec3(0.34, 0.12, 0.06);
  vec3 c = mix(dark, mid, smoothstep(-1.0, 1.0, rings) * 0.8 + 0.1);
  c = mix(c, lite, smoothstep(0.75, 1.0, rings) * 0.3);
  c *= 0.9 + 0.12 * fine + 0.06 * curl;
  // pores (very fine), darker crossband border banding
  float r = length(p);
  float band = smoothstep(0.455, 0.46, r) * (1.0 - smoothstep(0.49, 0.495, r));
  float bandGrain = sin(atan(p.y, p.x) * 220.0 + fbm(p * 30.0, vec2(30.0), 2) * 3.0) * 0.5 + 0.5;
  c = mix(c, vec3(0.2, 0.07, 0.035) * (0.8 + 0.35 * bandGrain), band);
  float string = smoothstep(0.004, 0.0, abs(r - 0.455)) + smoothstep(0.003, 0.0, abs(r - 0.43));
  c = mix(c, vec3(0.62, 0.48, 0.3), string * 0.7);
  s.albedo = c;
  s.height = 0.5 + fine * 0.03;
  s.rough = 0.16 + 0.06 * fine;
  s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Dinner plate: ivory porcelain, broad gilt rim band with a fine inner line and a small crest. */
export function giltPlateTexture(forge) {
  return forge.generate('dining:giltplate', {
    size: 1024, tile: false, normalStrength: 0.25,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = (uv - 0.5) * 2.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  vec3 ivory = vec3(0.86, 0.84, 0.79);
  float gold = 0.0;
  gold = max(gold, smoothstep(0.84, 0.845, r) * (1.0 - smoothstep(0.95, 0.955, r)));   // rim band
  gold = max(gold, stroke(r - 0.79, 0.0, 0.004));                                        // inner line
  gold = max(gold, stroke(r - 0.985, 0.0, 0.008));                                       // edge
  // Greek-key-ish notches inside the band (darker)
  float notch = step(0.5, fract(a / TAU * 48.0)) * smoothstep(0.87, 0.875, r) * (1.0 - smoothstep(0.92, 0.925, r));
  // crest at the top of the well: a little wreath + S
  vec2 cq = p - vec2(0.0, 0.62);
  float wreath = stroke(length(cq) - 0.085, 0.0, 0.006) * step(-0.05, cq.y + 0.06);
  float leaves = fill(sdVesica(rot2(0.6) * (vec2(abs(cq.x), cq.y) - vec2(0.07, 0.0)), 0.035, 0.022), 0.005);
  float S = stroke(length(cq - vec2(0.0, 0.02)) - 0.025, 0.0, 0.005) * step(0.0, cq.x * -1.0 + 0.0) + stroke(length(cq + vec2(0.0, 0.025)) - 0.025, 0.0, 0.005) * step(0.0, cq.x);
  gold = max(gold, max(wreath, max(leaves, S)));
  gold *= 0.85 + 0.15 * fbm(p * 20.0, vec2(20.0), 2);
  vec3 g = mix(vec3(0.78, 0.6, 0.3), vec3(0.5, 0.36, 0.16), notch);
  s.albedo = mix(ivory * (0.97 + 0.03 * fbm(p * 4.0, vec2(4.0), 2)), g, gold);
  s.metal = gold;
  s.rough = mix(0.08, 0.22, gold);
  s.height = 0.5 + gold * 0.1;
  s.ao = 1.0;
}`,
  });
}

/** Grey fondant tombstone face with an engraved R.I.P. and cross (UV 0..1 over the front). */
export function tombTexture(forge) {
  return forge.generate('dining:tomb', {
    size: 256, tile: false, normalStrength: 2.5,
    glsl: /* glsl */ `
float letterR(vec2 p) { float d = sdBox(p - vec2(-0.03, 0.0), vec2(0.008, 0.05)); d = min(d, abs(length(p - vec2(0.0, 0.022)) - 0.026) - 0.007); d = max(d, -(p.x + 0.03)); d = min(d, sdSegment(p, vec2(-0.01, 0.0), vec2(0.03, -0.05)) - 0.008); return d; }
float letterI(vec2 p) { return sdBox(p, vec2(0.008, 0.05)); }
float letterP(vec2 p) { float d = sdBox(p - vec2(-0.03, 0.0), vec2(0.008, 0.05)); d = min(d, max(abs(length(p - vec2(-0.005, 0.022)) - 0.024) - 0.007, -(p.x + 0.03))); return d; }
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv - vec2(0.5, 0.45);
  float d = 1.0;
  d = min(d, letterR((p - vec2(-0.2, 0.0)) * 1.6));
  d = min(d, letterI((p - vec2(0.0, 0.0)) * 1.6));
  d = min(d, letterP((p - vec2(0.17, 0.0)) * 1.6));
  float dots = min(length(p - vec2(-0.1, -0.035)), length(p - vec2(0.07, -0.035))) - 0.012;
  d = min(d, dots * 1.6);
  float cross = min(sdBox(p - vec2(0.0, 0.25), vec2(0.016, 0.085)), sdBox(p - vec2(0.0, 0.28), vec2(0.06, 0.016)));
  d = min(d, cross * 1.6);
  float eng = fill(d, 0.006);
  float speck = fbm(uv * 12.0, vec2(12.0), 4);
  s.albedo = vec3(0.56, 0.56, 0.58) * (0.9 + 0.2 * speck) * (1.0 - eng * 0.55);
  s.height = 0.6 - eng * 0.45 + speck * 0.04;
  s.rough = 0.7 + eng * 0.1;
  s.metal = 0.0; s.ao = 1.0 - eng * 0.4;
}`,
  });
}

/** Round crocheted lace doily with an alpha cut-out (UV 0..1 over the disc). */
export function laceTexture(forge) {
  return forge.generate('dining:lace', {
    size: 1024, tile: false, normalStrength: 1.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = (uv - 0.5) * 2.0;
  float r = length(p), a = atan(p.y, p.x);
  float thread = 0.0;
  // scalloped edge
  float edge = 0.93 + 0.05 * cos(a * 36.0);
  // concentric rings + radial chains
  thread = max(thread, stroke(r - 0.82, 0.0, 0.012));
  thread = max(thread, stroke(r - 0.62, 0.0, 0.01));
  thread = max(thread, stroke(r - 0.36, 0.0, 0.01));
  float rad = abs(fract(a / TAU * 36.0) - 0.5);
  thread = max(thread, (1.0 - smoothstep(0.03, 0.06, rad)) * step(0.36, r) * step(r, 0.82));
  // net between rings: diamond mesh
  vec2 g = vec2(a / TAU * 72.0, r * 30.0);
  vec2 q = abs(fract(vec2(g.x + g.y, g.x - g.y) * 0.5) - 0.5);
  float net = 1.0 - smoothstep(0.06, 0.12, min(q.x, q.y));
  thread = max(thread, net * step(0.62, r) * step(r, 0.82));
  // petals in the centre and picots at the rim
  vec2 pr = polarRep(p, 12.0);
  float pet = abs(sdVesica(rot2(PI * 0.5) * (pr - vec2(0.2, 0.0)), 0.13, 0.08)) - 0.012;
  thread = max(thread, fill(pet, 0.006) * step(r, 0.36));
  vec2 pr2 = polarRep(p, 36.0);
  thread = max(thread, stroke(length(pr2 - vec2(0.88, 0.0)) - 0.035, 0.0, 0.01));
  thread = max(thread, stroke(r - 0.08, 0.0, 0.012));
  thread *= step(r, edge);
  s.albedo = vec3(0.86, 0.83, 0.76);
  s.alpha = thread;
  s.height = 0.4 + thread * 0.3;
  s.rough = 0.9; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Acid-etched frosted glass with a cut star pattern (tulip shades, gasolier bowl). */
export function frostTexture(forge) {
  return forge.generate('dining:frost', {
    size: 512, normalStrength: 0.6,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 g = uv * vec2(6.0, 4.0);
  vec2 f = fract(g) - 0.5;
  float star = fill(sdStar(f, 0.22, 8.0, 3.0), 0.02);
  float ring = stroke(length(f) - 0.32, 0.0, 0.02);
  float grain = fbm(uv * 40.0, vec2(40.0), 3);
  float clear = max(star * 0.8, ring * 0.6);
  s.albedo = vec3(0.92, 0.9, 0.86) * (1.0 - clear * 0.45) * (0.95 + 0.05 * grain);
  s.height = 0.5 - clear * 0.2 + grain * 0.03;
  s.rough = mix(0.55, 0.15, clear);
  s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Mid-distance layer of bare winter trees (alpha cut-out), seen through the window. */
export function treeLayerTexture(forge) {
  return forge.generate('dining:treelayer', {
    size: 1024, aspect: 0.7, tile: false,
    glsl: /* glsl */ `
float branchy(vec2 p, vec2 base, float hgt, float seed) {
  vec2 q = p - base;
  float tw = 0.014 * (1.0 - q.y / hgt) + 0.003;
  float d = max(abs(q.x - 0.01 * sin(q.y * 11.0 + seed)) - tw, max(-q.y, q.y - hgt));
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float y0 = hgt * (0.22 + fi * 0.06);
    float side = mod(fi, 2.0) < 0.5 ? -1.0 : 1.0;
    float ang = side * (0.6 + 0.3 * sin(fi * 5.1 + seed));
    vec2 b = rot2(ang) * (q - vec2(0.0, y0));
    float len = hgt * (0.38 - fi * 0.024);
    float bw = 0.004 * (1.0 - clamp(b.y / len, 0.0, 1.0)) + 0.0007;
    d = min(d, max(abs(b.x + 0.01 * sin(b.y * 30.0 + fi)) - bw, max(-b.y, b.y - len)));
    for (int k = 0; k < 2; k++) {
      float fk = float(k);
      vec2 c = rot2(-side * (0.5 + 0.3 * fk)) * (b - vec2(0.0, len * (0.35 + 0.3 * fk)));
      d = min(d, max(abs(c.x + 0.004 * sin(c.y * 60.0)) - 0.0011, max(-c.y, c.y - len * 0.4)));
    }
  }
  return d;
}
void surface(vec2 uv, inout Surface s) {
  float d = branchy(uv, vec2(0.12, 0.0), 0.9, 2.0);
  d = min(d, branchy(uv, vec2(0.82, 0.0), 0.75, 5.0));
  d = min(d, branchy(uv, vec2(0.55, 0.05), 0.35, 8.0));
  float a = smoothstep(0.0015, -0.0005, d);
  // snow resting on the upper side of limbs
  s.albedo = vec3(0.025, 0.03, 0.05);
  s.alpha = a;
  s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Frost ferns creeping in from the edges of the window panes (alpha = frost density). */
export function frostPaneTexture(forge) {
  return forge.generate('dining:frostpane', {
    size: 1024, aspect: 0.62, tile: false,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  // 2 x 4 panes: distance to the nearest pane edge
  vec2 g = uv * vec2(2.0, 4.0);
  vec2 f = fract(g);
  float e = min(min(f.x, 1.0 - f.x) * 0.5, min(f.y, 1.0 - f.y) * 0.25) ;
  float n = fbm(uv * vec2(6.0, 9.0), vec2(6.0, 9.0), 6);
  float fern = abs(fbm(uv * vec2(18.0, 28.0) + n, vec2(18.0, 28.0), 4));
  float edge = smoothstep(0.07 + 0.05 * n, 0.0, e);
  float corner = smoothstep(0.16, 0.0, length(min(f, 1.0 - f) * vec2(0.5, 0.25)) - 0.02 * n);
  float a = clamp(max(edge, corner) * (0.55 + 0.6 * smoothstep(0.05, 0.3, fern)), 0.0, 1.0);
  // faint condensation haze over the lower panes
  a = max(a, 0.12 * smoothstep(0.5, 0.0, uv.y) * (0.6 + 0.4 * n));
  s.albedo = vec3(0.85, 0.9, 1.0);
  s.alpha = a * 0.75;
  s.height = 0.5; s.rough = 0.6; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Mirror foxing: silvering loss and brown spots, denser toward the edges (alpha overlay). */
export function foxingTexture(forge) {
  return forge.generate('dining:foxing', {
    size: 512, aspect: 0.6, tile: false,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 e = min(uv, 1.0 - uv);
  float edge = smoothstep(0.18, 0.0, min(e.x * 1.6, e.y));
  float n = fbm(uv * vec2(5.0, 8.0), vec2(5.0, 8.0), 5) * 0.5 + 0.5;
  vec4 v = voronoi(uv * vec2(14.0, 22.0), vec2(14.0, 22.0), 1.0);
  float spot = smoothstep(0.16, 0.05, v.x) * step(0.72, hash12(v.zw + 3.0));
  float a = clamp(edge * (0.4 + 0.8 * n) + spot * 0.7, 0.0, 0.9);
  s.albedo = mix(vec3(0.16, 0.12, 0.08), vec3(0.3, 0.26, 0.2), n);
  s.alpha = a;
  s.height = 0.5; s.rough = 0.9; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/**
 * Dense Heriz for the dining room: derived from the engine's rug design but with a
 * 2.4x finer herati field, finer spandrels and border repeat, and a wide pale-ivory
 * outer guard that catches the moon shaft (as in the reference paintings).
 */
export function denseHerizTexture(forge, rugGen, { colors, aspect, knots = 560, wear = 0.8, fringe = 0.03, seed = 21, size = 2048 } = {}) {
  const def = rugGen({ palette: 'heriz', colors, aspect, knots, wear, fringe, seed, size });
  let g = def.glsl;
  const rep = (a, b) => { if (!g.includes(a)) console.warn('[dining] rug patch miss:', a); g = g.split(a).join(b); };
  rep('vec2 h = fract(fa * 5.0 + 0.5) - 0.5;', 'vec2 h = fract(fa * 12.0 + 0.5) - 0.5;');
  rep('edge = min(edge, e2 / 5.0);', 'edge = min(edge, e2 / 12.0);');
  rep('vec2 h = fract(f * 7.0) - 0.5;', 'vec2 h = fract(f * 16.0) - 0.5;');
  rep('edge = min(edge, e2 / 7.0);', 'edge = min(edge, e2 / 16.0);');
  rep('floor(2.0 * L / 0.14)', 'floor(2.0 * L / 0.085)');
  rep('float b0 = 0.018, b1 = 0.05, b2 = 0.062, b3 = 0.2, b4 = 0.212, b5 = 0.245, b6 = 0.255;', 'float b0 = 0.012, b1 = 0.034, b2 = 0.082, b3 = 0.19, b4 = 0.2, b5 = 0.226, b6 = 0.236;');
  rep('int mc = medallion(f, min(FA, FL) * 0.62, er);', 'int mc = medallion(f, min(FA, FL) * 0.5, er);');
  rep('if (spLine < 0.0) { ci = 2; return; }', 'if (spLine < -0.004) { ci = 3; return; }');
  return forge.generate(`dining:denseheriz:${def.key}`, { ...def, glsl: g, key: undefined });
}

/** Fine damask-weave table linen: over-under threads with slub, a faint woven diamond. Tiles (1 tile ~ 2 cm). */
export function linenTexture(forge) {
  return forge.generate('dining:linen', {
    size: 512, normalStrength: 1.1,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 g = uv * 32.0;
  vec2 id = floor(g), f = fract(g);
  float over = mod(id.x + id.y, 2.0);
  // warp threads run along y where 'over', weft along x elsewhere
  float tw = over > 0.5 ? sin(f.x * 3.14159) : sin(f.y * 3.14159);
  float slub = 0.85 + 0.3 * vnoise(vec2(over > 0.5 ? id.x : id.y, (over > 0.5 ? g.y : g.x) * 0.25) * 1.7, vec2(64.0));
  float dia = smoothstep(0.3, 0.32, abs(fract((uv.x + uv.y) * 4.0) - 0.5)) * smoothstep(0.3, 0.32, abs(fract((uv.x - uv.y) * 4.0) - 0.5));
  vec3 c = vec3(0.9, 0.87, 0.81) * (0.9 + 0.1 * tw * slub) * (0.97 + 0.03 * dia);
  s.albedo = c;
  s.height = 0.5 + 0.25 * tw * slub + 0.04 * dia;
  s.rough = 0.78 - 0.12 * dia;
  s.metal = 0.0; s.ao = 0.85 + 0.15 * tw;
}`,
  });
}

/** Winter night sky only (no ground, no trees): gradient, moon with halo, torn cloud lit from behind, faint stars. */
export function winterSkyTexture(forge) {
  return forge.generate('dining:wintersky', {
    size: 1024, aspect: 1.2, tile: false,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  vec2 moon = vec2(0.6, 0.74);
  float md = length((p - moon) * vec2(1.2, 1.0));
  vec3 sky = mix(vec3(0.07, 0.09, 0.15), vec3(0.2, 0.25, 0.36), smoothstep(0.1, 0.95, p.y));
  sky = mix(vec3(0.17, 0.2, 0.28), sky, smoothstep(0.0, 0.35, p.y));          // brighter haze toward the horizon
  sky += vec3(0.55, 0.6, 0.72) * exp(-md * 6.0) * 0.7 + vec3(0.3, 0.34, 0.42) * exp(-md * 2.2) * 0.25;
  float cl = fbm(p * vec2(1.3, 3.6) + vec2(0.3, 0.1) + vec2(0.1 * fbm(p * vec2(2.0, 5.0), vec2(16.0), 2), 0.0), vec2(16.0, 16.0), 4);
  float cov = smoothstep(-0.05, 0.35, cl) * smoothstep(0.2, 0.55, p.y);
  sky = mix(sky, sky * 0.55 + vec3(0.025, 0.03, 0.045), cov * 0.75);
  sky += vec3(0.7, 0.74, 0.82) * smoothstep(0.14, 0.0, abs(cl - 0.04)) * exp(-md * 3.2) * 0.55;   // silver linings
  vec2 g = p * vec2(140.0, 116.0); vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float st = smoothstep(0.12, 0.0, length(f - (hash22(id) - 0.5) * 0.6)) * step(0.93, hash12(id + 1.7)) * (1.0 - cov) * smoothstep(0.35, 0.7, p.y);
  sky += vec3(0.8, 0.85, 1.0) * st * 0.5;
  sky = mix(sky, vec3(1.0, 0.98, 0.94) * 1.35, smoothstep(0.03, 0.025, md));
  s.albedo = sky; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Distant wooded ridge: a soft, ragged forest silhouette dissolving into ground mist (alpha). */
export function treelineTexture(forge) {
  return forge.generate('dining:treeline', {
    size: 1024, aspect: 4.0, tile: false,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float x = uv.x;
  float ridge = 0.42 + 0.12 * fbmv(vec2(x * 3.0, 0.0), vec2(64.0), 4);
  // individual crowns: spiky conifers and rounded bare crowns along the ridge
  // lumpy canopy of bare crowns, a few taller dark firs standing out of it
  float cr = 0.1 * fbmv(vec2(x * 28.0, 0.5), vec2(1024.0), 4) + 0.05 * fbmv(vec2(x * 90.0, 2.5), vec2(1024.0), 3);
  vec2 g = vec2(x * 22.0, 0.0); float c = fract(g.x) - 0.5; float pick = step(0.72, hash12(vec2(floor(g.x), 3.0)));
  float fir = pick * max(0.0, 0.16 * (1.0 - abs(c) * 7.0 * (1.0 + 0.6 * (1.0 - smoothstep(0.0, 1.0, abs(c) * 7.0)))));
  float top = ridge + cr * 1.6 + 0.012 * fbm(vec2(x * 260.0, uv.y * 40.0), vec2(1024.0), 3);
  float a = smoothstep(0.004, -0.006, uv.y - top);
  float mist = smoothstep(0.42, 0.0, uv.y);                 // ground mist eats the foot of the woods
  s.albedo = mix(vec3(0.06, 0.075, 0.11), vec3(0.2, 0.23, 0.31), mist);
  s.alpha = a;
  s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** A card of bare winter trees (alpha), seeded: trunks with bark taper, forking limbs, twig fans, snow on the upper limbs. */
export function treeCardTexture(forge, seed = 1) {
  return forge.generate(`dining:treecard${seed}`, {
    size: 1024, aspect: 1.0, tile: false,
    glsl: /* glsl */ `
const float SEED = ${seed.toFixed(1)};
vec2 limb(vec2 q, float len, float w0, float ang, float s, out float snow) {
  vec2 b = rot2(ang) * q;
  float t = clamp(b.y / len, 0.0, 1.0);
  float bw = mix(w0, w0 * 0.2, t);
  float bend = 0.035 * len * sin(t * 3.0 + s) + 0.012 * len * sin(t * 13.0 + s * 2.0);
  float d = max(abs(b.x - bend) - bw, max(-b.y, b.y - len));
  snow = smoothstep(0.0, bw * 1.2, b.x - bend) * step(0.0, ang * sign(ang));
  return vec2(d, t);
}
float tree(vec2 p, vec2 base, float hgt, float s, out float snowAmt) {
  vec2 q = p - base;
  float tw = mix(0.016, 0.003, clamp(q.y / hgt, 0.0, 1.0));
  float lean = 0.04 * sin(s) * q.y;
  float d = max(abs(q.x - lean - 0.008 * sin(q.y * 9.0 + s)) - tw, max(-q.y, q.y - hgt));
  snowAmt = 0.0;
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float y0 = hgt * (0.25 + fi * 0.053);
    float side = mod(fi + s, 2.0) < 1.0 ? -1.0 : 1.0;
    float ang = side * (0.45 + 0.45 * hash12(vec2(fi, s)));
    float len = hgt * (0.42 - fi * 0.024) * (0.7 + 0.5 * hash12(vec2(s, fi)));
    float sn;
    vec2 L = limb(q - vec2(0.04 * sin(s) * y0, y0), len, 0.0055 * (1.0 - fi * 0.05), ang, s + fi, sn);
    d = min(d, L.x);
    // forks and twig fans
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      vec2 b = rot2(ang) * (q - vec2(0.04 * sin(s) * y0, y0));
      vec2 c = rot2(-side * (0.35 + 0.25 * fk)) * (b - vec2(0.0, len * (0.3 + 0.22 * fk)));
      float ln2 = len * (0.45 - fk * 0.1);
      float tt = clamp(c.y / ln2, 0.0, 1.0);
      d = min(d, max(abs(c.x + 0.006 * sin(c.y * 70.0 + fk)) - mix(0.0022, 0.0006, tt), max(-c.y, c.y - ln2)));
    }
  }
  return d;
}
void surface(vec2 uv, inout Surface s) {
  float sn;
  float d = tree(uv, vec2(0.22 + 0.1 * sin(SEED), 0.0), 0.92, SEED, sn);
  d = min(d, tree(uv, vec2(0.74 + 0.08 * cos(SEED * 1.7), 0.0), 0.7 + 0.15 * sin(SEED * 2.3), SEED + 3.0, sn));
  d = min(d, tree(uv, vec2(0.5, 0.0), 0.38, SEED + 7.0, sn));
  float a = smoothstep(0.0015, -0.0008, d);
  float rim = smoothstep(-0.004, 0.0, d);                 // a lighter frost edge on the limbs
  s.albedo = mix(vec3(0.03, 0.035, 0.05), vec3(0.32, 0.36, 0.46), rim * 0.6);
  s.alpha = a;
  s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Wind-packed snow: soft drift ripples, sastrugi streaks and sparse ice glints (the glints live in alpha for the emissive mask). */
export function snowFieldTexture(forge) {
  return forge.generate('dining:snowfield', {
    size: 1024, normalStrength: 0.8,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float rip = fbmv(uv * vec2(3.0, 9.0), vec2(3.0, 9.0), 5);
  float st = fbmv(uv * vec2(1.5, 30.0) + rip, vec2(1.5, 30.0), 3);
  vec2 g = uv * 260.0; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float glint = smoothstep(0.16, 0.0, length(f - (hash22(id) - 0.5) * 0.6)) * step(0.965, hash12(id + 5.3));
  s.albedo = vec3(0.78, 0.82, 0.9) * (0.86 + 0.14 * rip) + glint * 0.5;
  s.height = 0.4 + 0.4 * rip + 0.08 * st;
  s.rough = mix(0.85, 0.15, glint);
  s.metal = 0.0; s.ao = 0.85 + 0.15 * rip;
  s.alpha = 1.0;
}`,
  });
}

/**
 * Carved gilt frieze tile (0.46 m x 0.40 m): an anthemion band of alternating nine-lobed palmettes and
 * three-petal lotus buds linked by C-scroll tendrils, over an egg-and-dart moulding with a bead-and-reel
 * fillet, all in high relief (height drives a strong normal map; cavities baked into AO and grime).
 * u tiles along the wall; v = 0 bottom .. 1 top.
 */
export function palmetteFriezeTexture(forge) {
  return forge.generate('dining:palmette', {
    size: 1024, aspect: 1.15, normalStrength: 7.0,
    glsl: /* glsl */ `
const float ASP = 1.15;
// rounded relief of a tapered lobe from b along unit d, length L, max half-width W; returns (height, wide-shadow)
vec2 lobe(vec2 p, vec2 b, vec2 d, float L, float W) {
  vec2 q = p - b;
  float t = dot(q, d) / L;
  float o = abs(q.x * d.y - q.y * d.x);
  float tt = clamp(t, 0.0, 1.0);
  float w = W * pow(sin(3.14159 * pow(tt, 0.75)), 0.7) + 0.0005;
  float inside = step(0.0, t) * step(t, 1.0);
  float h = inside * sqrt(max(0.0, 1.0 - (o / w) * (o / w))) * (0.65 + 0.35 * sin(3.14159 * tt));
  h -= inside * 0.18 * exp(-pow(o / (0.18 * w), 2.0)) * step(o, w);          // carved midrib
  float sh = inside * smoothstep(w * 1.9, w * 0.9, o);
  return vec2(max(h, 0.0), sh);
}
vec2 ring(vec2 p, vec2 c, float r, float w, float a0, float a1) {
  vec2 q = p - c; float a = atan(q.y, q.x);
  float on = step(a0, a) * step(a, a1);
  float o = abs(length(q) - r);
  return vec2(on * sqrt(max(0.0, 1.0 - (o / w) * (o / w))), on * smoothstep(w * 2.2, w, o));
}
void surface(vec2 uv, inout Surface s) {
  vec2 p = vec2(uv.x * ASP, uv.y);
  float h = 0.0, sh = 0.0;
  vec2 r;
  // --- main field: palmette at x = 0.25 tile, lotus at 0.75
  vec2 B = vec2(0.25 * ASP, 0.3);
  for (int i = 0; i < 9; i++) {
    float fi = float(i) - 4.0;
    float a = fi * 0.3;
    vec2 d = vec2(sin(a), cos(a));
    float L = 0.56 - abs(fi) * 0.045;
    r = lobe(p, B + d * 0.035, d, L, 0.036 - abs(fi) * 0.0016);
    h = max(h, r.x); sh = max(sh, r.y);
  }
  // heart-shaped base of the palmette
  float hb = length((p - B) * vec2(1.0, 1.3)) / 0.05;
  h = max(h, sqrt(max(0.0, 1.0 - hb * hb)) * 0.9); sh = max(sh, smoothstep(1.8, 1.0, hb));
  // lotus bud
  vec2 Lb = vec2(0.75 * ASP, 0.27);
  r = lobe(p, Lb, vec2(0.0, 1.0), 0.48, 0.06); h = max(h, r.x); sh = max(sh, r.y);
  r = lobe(p, Lb + vec2(-0.01, 0.0), normalize(vec2(-0.55, 1.0)), 0.3, 0.032); h = max(h, r.x * 0.9); sh = max(sh, r.y);
  r = lobe(p, Lb + vec2(0.01, 0.0), normalize(vec2(0.55, 1.0)), 0.3, 0.032); h = max(h, r.x * 0.9); sh = max(sh, r.y);
  float cb = length((p - Lb) * vec2(1.0, 1.6)) / 0.06;
  h = max(h, sqrt(max(0.0, 1.0 - cb * cb))); sh = max(sh, smoothstep(1.8, 1.0, cb));
  // C-scroll tendrils springing from the palmette base to the lotus, curling at the ends
  for (int k = 0; k < 2; k++) {
    float sx = k == 0 ? 1.0 : -1.0;
    vec2 c = vec2((0.5 + sx * 0.0) * ASP + sx * 0.0, 0.24);
    float cx = (k == 0 ? 0.5 : 0.0) * ASP;
    r = ring(p, vec2(cx + 0.0, 0.25), 0.11, 0.011, -0.2, 3.34); h = max(h, r.x * 0.75); sh = max(sh, r.y);
    r = ring(p, vec2(cx - 0.13, 0.2), 0.04, 0.009, -3.14, 3.14); h = max(h, r.x * 0.7); sh = max(sh, r.y);
    r = ring(p, vec2(cx + 0.13, 0.2), 0.04, 0.009, -3.14, 3.14); h = max(h, r.x * 0.7); sh = max(sh, r.y);
  }
  // wrap the tile seam: repeat the scrolls at the right edge
  r = ring(p, vec2(ASP, 0.25), 0.11, 0.011, -0.2, 3.34); h = max(h, r.x * 0.75); sh = max(sh, r.y);
  r = ring(p, vec2(ASP - 0.13, 0.2), 0.04, 0.009, -3.14, 3.14); h = max(h, r.x * 0.7); sh = max(sh, r.y);
  float field = step(0.165, p.y) * step(p.y, 0.92);
  h *= field; sh *= field;
  // --- egg-and-dart below
  float ed = 0.0, eds = 0.0;
  if (p.y < 0.13) {
    float cell = ASP / 5.0;
    float cx = (floor(p.x / cell) + 0.5) * cell;
    vec2 q = vec2(p.x - cx, p.y - 0.068);
    float eg = length(q / vec2(0.034, 0.05));
    float egg = sqrt(max(0.0, 1.0 - eg * eg));
    float shell = abs(length(q / vec2(0.044, 0.06)) - 1.0);
    float sl = smoothstep(0.16, 0.0, shell) * step(-0.02, q.y + 0.04);
    float dx = abs(abs(p.x - cx) - cell * 0.5);
    float dart = smoothstep(0.009 * (p.y / 0.13 + 0.2), 0.0, dx) * step(0.02, p.y);
    ed = max(egg * 0.95, max(sl * 0.55, dart * 0.6));
    eds = smoothstep(1.5, 1.0, eg);
  }
  // bead-and-reel fillet
  float br = 0.0;
  if (p.y > 0.13 && p.y < 0.165) {
    float bc = ASP / 20.0; float bx = mod(p.x, bc) - bc * 0.5;
    float bead = length(vec2(bx / 0.012, (p.y - 0.1475) / 0.013));
    br = sqrt(max(0.0, 1.0 - bead * bead));
  }
  // top fillet (plain gilt astragal)
  float top = smoothstep(0.92, 0.935, p.y) * (1.0 - 0.5 * smoothstep(0.96, 1.0, p.y));
  float H = max(max(h, ed), max(br, top));
  float raised = smoothstep(0.02, 0.12, H);
  float wear = fbm(uv * 30.0, vec2(30.0 * ASP, 30.0), 4);
  vec3 gold = mix(vec3(0.7, 0.52, 0.24), vec3(0.95, 0.76, 0.42), smoothstep(0.3, 1.0, H)) * (0.9 + 0.15 * wear);
  vec3 ground = vec3(0.05, 0.065, 0.12) * (0.85 + 0.3 * wear);
  float cav = max(sh, eds) * (1.0 - raised);
  s.albedo = mix(ground * (1.0 - 0.5 * cav), gold * (0.8 + 0.2 * H), raised);
  s.height = 0.25 + 0.6 * H;
  s.metal = raised;
  s.rough = mix(0.8, 0.32 + 0.2 * (1.0 - H), raised);
  s.ao = mix(1.0 - 0.6 * cav, 0.65 + 0.35 * H, raised);
}`,
  });
}
