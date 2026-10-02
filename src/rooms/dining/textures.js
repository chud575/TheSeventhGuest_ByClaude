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
  float ridge = 1.0 - abs(sin(sw * 9.0));
  vec3 c = mix(vec3(0.07, 0.03, 0.02), vec3(0.13, 0.06, 0.035), ridge * 0.6 + 0.2 * fbm(uv * 12.0, vec2(12.0), 3));
  s.albedo = c;
  s.height = 0.5 + ridge * 0.12 + sw * 0.05;
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
  vec3 gan = vec3(0.08, 0.035, 0.02);
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
