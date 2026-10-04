/**
 * Game-room textures, round 3: flock damask wallpaper, alpha-tested hair strands for the trophies,
 * glass taxidermy eyes, turned boxwood for the queens, a re-authored nero marble, a tenebrist oil
 * portrait, sepia line engravings for the prints, and crackled oxblood club leather.
 * All GPU-generated through the engine TextureForge (albedo sRGB + normal + ORM).
 */

// ------------------------------------------------------------------ shared GLSL snippets
const LEAF = /* glsl */ `
// pointed leaf from c, pointing along angle ang (radians from +y toward +x), len x wid, bend curls the tip sideways
float leafD(vec2 p, vec2 c, float ang, float len, float wid, float bend) {
  vec2 d = p - c;
  vec2 dir = vec2(sin(ang), cos(ang));
  vec2 per = vec2(cos(ang), -sin(ang));
  vec2 q = vec2(dot(d, per), dot(d, dir));
  q.x -= bend * q.y * q.y / max(len, 1e-4);
  q.y -= len * 0.5;
  float rpd = len * len / (2.0 * wid);
  float r = (wid * 0.5 + rpd) * 0.5, dd = (rpd - wid * 0.5) * 0.5;
  return sdVesica(q, r, dd);
}
`;

/**
 * Flock damask: a dense half-drop damask (palmette medallions with acanthus scrolls, a small rosette in the
 * drop) in raised velvet flock on a satin paper ground. 1 tile = 0.35 m. Low emboss (normalStrength small).
 * Albedo deep bottle green, motif ~18% lighter in luminance; the ORM roughness is velvet (0.9) on the flock and
 * satin (0.5) on the ground. Use the albedo also as the sheenColorMap so the flock picks up grazing light.
 */
export function flockDamaskTexture(forge, { ground = [0.075, 0.15, 0.11], motif = [0.115, 0.225, 0.165], key = 'gameroom:flock6' } = {}) {
  return forge.generate(key, {
    size: 1024, normalStrength: 0.35,
    uniforms: { uG: ground, uM: motif },
    glsl: LEAF + /* glsl */ `
float mainMotif(vec2 p) {
  vec2 m = vec2(abs(p.x), p.y);
  // tall ogee medallion: a narrow rounded body under a long pointed crown
  float body = sdEllipse(m - vec2(0.0, -0.08), vec2(0.13, 0.19));
  float dome = leafD(m, vec2(0.0, -0.02), 0.0, 0.36, 0.2, 0.0);
  float og = smin(body, dome, 0.05);
  float band = abs(og + 0.014) - 0.008;                       // flocked outline band
  // inside: a tulip of three rounded petals on a small cup, a round bud above it
  float fruit = sdEllipse(m - vec2(0.0, -0.2), vec2(0.05, 0.02));
  fruit = min(fruit, sdEllipse(m - vec2(0.0, -0.1), vec2(0.036, 0.085)));
  fruit = min(fruit, sdEllipse(rot2(0.42) * (m - vec2(0.05, -0.125)), vec2(0.028, 0.066)));
  float vein = abs(m.x) - 0.0028;
  fruit = max(fruit, -max(vein, abs(m.y + 0.1) - 0.06));
  fruit = min(fruit, sdCircle(m - vec2(0.0, 0.04), 0.03));
  fruit = max(fruit, -sdCircle(m - vec2(0.0, 0.04), 0.014));
  fruit = min(fruit, sdCircle(m - vec2(0.0, 0.04), 0.007));
  fruit = min(fruit, sdCircle(m - vec2(0.0, 0.17), 0.012));
  float inner = leafD(m, vec2(0.02, 0.07), 0.6, 0.07, 0.03, 0.3);
  inner = max(inner, og + 0.026);
  // outside: thick C-scrolls ending in curls, rounded acanthus leaves curling outward, a trefoil finial
  vec2 s1 = m - vec2(0.245, 0.11);
  float scr = abs(length(s1) - 0.058) - 0.014;
  scr = max(scr, -(s1.y + s1.x * 0.2 + 0.02));
  scr = min(scr, sdCircle(m - vec2(0.2, 0.065), 0.02));
  vec2 s2 = m - vec2(0.235, -0.2);
  float scr2 = abs(length(s2) - 0.05) - 0.012;
  scr2 = max(scr2, s2.y - s2.x * 0.3 - 0.01);
  scr2 = min(scr2, sdCircle(m - vec2(0.27, -0.165), 0.016));
  float ac = leafD(m, vec2(0.13, -0.22), 2.0, 0.17, 0.085, -0.45);
  ac = min(ac, leafD(m, vec2(0.15, 0.2), 0.7, 0.15, 0.075, 0.5));
  ac = max(ac, -(og - 0.012));
  float fin = min(sdCircle(m - vec2(0.0, 0.385), 0.024), sdCircle(m - vec2(0.03, 0.36), 0.019));
  fin = min(fin, sdCircle(m - vec2(0.0, -0.3), 0.02));
  float d = min(min(band, fruit), min(inner, min(scr, min(ac, fin))));
  return d;
}
float dropMotif(vec2 p) {
  vec2 m = vec2(abs(p.x), p.y);
  float d = 1e3;
  // six-petal rosette of round petals, ring of four rounded leaves
  vec2 r = polarRep(p, 6.0);
  d = min(d, sdCircle(r - vec2(0.03, 0.0), 0.017));
  d = max(d, -sdCircle(p, 0.012));
  d = min(d, sdCircle(p, 0.007));
  vec2 r2 = polarRep(rot2(0.785398) * p, 4.0);
  d = min(d, leafD(r2.yx, vec2(0.0, 0.05), 0.0, 0.07, 0.034, 0.0));
  return d;
}
void surface(vec2 uv, inout Surface s) {
  vec2 q = uv - 0.5;
  vec2 c = uv - floor(uv + 0.5);                        // relative to the nearest tile corner (half-drop)
  float d1 = mainMotif(q * vec2(1.0, 1.0));
  float d2 = dropMotif(c * 1.0);
  // scattered foliate sprigs filling the ground between the medallions (no ruled lines)
  vec2 vq = vec2(abs(q.x), q.y);
  float spr = leafD(vq, vec2(0.4, -0.3), 2.2, 0.07, 0.034, 0.4);
  spr = min(spr, leafD(vq, vec2(0.4, -0.3), 0.6, 0.06, 0.03, -0.4));
  spr = min(spr, leafD(vq, vec2(0.36, 0.3), 0.9, 0.065, 0.032, -0.35));
  spr = min(spr, leafD(vq, vec2(0.36, 0.3), 2.6, 0.05, 0.026, 0.35));
  spr = min(spr, sdCircle(vq - vec2(0.42, 0.02), 0.012));
  spr = min(spr, sdCircle(vq - vec2(0.3, -0.42), 0.01));
  spr = min(spr, leafD(vq, vec2(0.25, -0.38), 1.9, 0.05, 0.018, 0.3));
  float d = min(min(d1, d2), spr);
  float aa = 0.0016;
  float mk = fill(d, aa);
  // engraved inner outline inside each flocked shape (the darker 'cut' line of a damask)
  float inner = stroke(d + 0.011, 0.0018, aa) * mk;
  float fib = vnoise(uv * 900.0, vec2(900.0)) * 0.55 + vnoise(uv * vec2(450.0, 1600.0), vec2(450.0, 1600.0)) * 0.45;
  float fibC = vnoise(uv * 2200.0, vec2(2200.0));
  float sat = 0.975 + 0.025 * sin(uv.x * 6.2831 * 160.0 + fbm(uv * 3.0, vec2(3.0), 2) * 4.0);   // satin moire of the paper
  float age = fbmv(uv * 2.0 + 3.0, vec2(2.0), 4);
  vec3 g = uG * sat * (0.92 + 0.12 * age);
  vec3 f = uM * (0.82 + 0.3 * fib) * (0.94 + 0.12 * age);
  f = mix(f, uG * 0.9, inner * 0.8);
  vec3 col = mix(g, f, mk);
  // velvet pile catches a little gold-olive at its tips
  col += vec3(0.012, 0.012, 0.004) * mk * fibC;
  s.albedo = col;
  s.height = 0.5 + 0.22 * domeh(d, 0.006) + 0.04 * fib * mk - 0.05 * inner;
  s.rough = mix(0.5, 0.92, mk) + 0.04 * fibC;
  s.metal = 0.0;
  s.ao = 1.0 - 0.18 * inner - 0.08 * (1.0 - mk) * fill(d - 0.004, 0.004);
}`,
  });
}

/** Alpha-tested hair-lock card: ~26 tapering strands from the root (v=0) to the tip (v=1), grizzled tips. */
export function hairStrandTexture(forge, { root = [0.09, 0.06, 0.04], tip = [0.42, 0.33, 0.24], key = 'gameroom:strand' } = {}) {
  return forge.generate(key, {
    size: 256, aspect: 0.5, tile: false, normalStrength: 1.2,
    uniforms: { uR: root, uT: tip },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float a = 0.0; float h = 0.0; vec3 col = vec3(0.0); float wsum = 0.0;
  for (int i = 0; i < 26; i++) {
    float fi = float(i);
    float x0 = 0.08 + 0.84 * hash11(fi * 7.13 + 1.0);
    float len = 0.55 + 0.45 * hash11(fi * 3.71 + 2.0);
    float w0 = 0.018 + 0.016 * hash11(fi * 5.3 + 3.0);
    float v = uv.y / len;
    if (v > 1.0) continue;
    float x = x0 + 0.06 * sin(v * 3.0 + fi) * v + (0.5 - x0) * v * 0.25;
    float w = w0 * (1.0 - v * 0.92);
    float k = 1.0 - smoothstep(w * 0.4, w, abs(uv.x - x));
    if (k > 0.0) {
      vec3 c = mix(uR, uT, smoothstep(0.35, 1.0, v) * (0.6 + 0.4 * hash11(fi * 1.7)));
      c *= 0.75 + 0.5 * hash11(fi * 9.1);
      col += c * k; wsum += k;
      a = max(a, k);
      h = max(h, k * (1.0 - abs(uv.x - x) / max(w, 1e-4)));
    }
  }
  s.albedo = wsum > 0.0 ? col / wsum : uR;
  s.alpha = a * (1.0 - smoothstep(0.0, 0.04, -uv.y + 0.02));
  s.height = 0.4 + 0.6 * h;
  s.rough = 0.62;
  s.metal = 0.0;
  s.ao = 0.55 + 0.45 * smoothstep(0.0, 0.6, uv.y);
}`,
  });
}

/** Glass taxidermy eye: lat-long uv on a sphere whose +Y pole looks out. Amber-brown iris, horizontal pupil (deer) or round (boar). */
export function glassEyeTexture(forge, { iris = [0.32, 0.16, 0.05], pupilW = 0.42, pupilH = 0.2, key = 'gameroom:eye' } = {}) {
  return forge.generate(key, {
    size: 256, tile: false, normalStrength: 0.2,
    uniforms: { uIris: iris, uPW: pupilW, uPH: pupilH },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float r = (1.0 - uv.y) / 0.32;                     // 0 at the pole, 1 at the iris edge
  float a = uv.x * 6.28318;
  vec2 p = vec2(cos(a), sin(a)) * r;
  float fib = 0.5 + 0.5 * sin(a * 60.0 + vnoise(vec2(a * 6.0, r * 8.0), vec2(1000.0)) * 6.0);
  vec3 c = uIris * (0.7 + 0.5 * smoothstep(0.2, 0.9, r)) * (0.8 + 0.35 * fib);
  c = mix(c, uIris * 0.25, smoothstep(0.82, 1.0, r));  // dark limbal ring
  float pupil = sdEllipse(p, vec2(uPW, uPH));
  c = mix(c, vec3(0.008), 1.0 - smoothstep(-0.02, 0.02, pupil));
  c = mix(c, vec3(0.02, 0.015, 0.012), smoothstep(1.0, 1.08, r));
  s.albedo = c;
  s.height = 0.5;
  s.rough = 0.04;
  s.metal = 0.0;
  s.ao = 1.0;
}`,
  });
}

/** Turned boxwood for the chessmen. Lathe uv: u around, v along the profile. Long grain runs along the piece (u-stripes
 * that wander along v), fine circumferential turning rings (v), wax build-up. Albedo ~#d8bf8c. */
export function boxwoodTexture(forge) {
  return forge.generate('gameroom:boxwood', {
    size: 512, normalStrength: 0.5,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float w = fbm(vec2(uv.x * 2.0, uv.y * 0.6), vec2(2.0, 1.0), 4);
  float grain = vnoise(vec2(uv.x * 70.0 + w * 6.0, uv.y * 3.0), vec2(70.0, 3.0));
  float grain2 = vnoise(vec2(uv.x * 190.0 + w * 9.0, uv.y * 6.0), vec2(190.0, 6.0));
  float fleck = smoothstep(0.78, 0.95, vnoise(vec2(uv.x * 40.0, uv.y * 90.0), vec2(40.0, 90.0)));
  float rings = 0.5 + 0.5 * sin(uv.y * 6.28318 * 140.0 + w * 2.0);
  float pores = vnoise(vec2(uv.x * 500.0, uv.y * 40.0), vec2(500.0, 40.0));
  vec3 c = vec3(0.85, 0.75, 0.55);
  c = mix(c, vec3(0.74, 0.6, 0.38), smoothstep(0.35, 0.8, grain) * 0.55);
  c *= 0.95 + 0.06 * grain2;
  c = mix(c, vec3(0.9, 0.82, 0.62), fleck * 0.25);
  c *= 0.985 + 0.015 * rings;
  c *= 0.97 + 0.03 * pores;
  s.albedo = c;
  s.height = 0.5 + 0.12 * rings + 0.06 * grain2 - 0.05 * pores;
  s.rough = 0.42 + 0.08 * grain + 0.05 * pores;
  s.metal = 0.0;
  s.ao = 1.0;
}`,
  });
}

/** Belgian black marble, re-authored: clouded charcoal ground with mid-grey drifts; one wide soft vein system (~0.3 m)
 * and a sparse fine one (~0.03 m), both domain-warped along a dominant diagonal, white-grey #cfc6b8, ~10% coverage.
 * 1 tile = 0.6 m. */
export function marbleNero3Texture(forge, { key = 'gameroom:nero3', seed = 0 } = {}) {
  return forge.generate(key + 'c', {
    size: 1024, normalStrength: 0.1,
    uniforms: { uVar: seed },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv + uVar * 0.37;
  // everything flows along one dominant diagonal
  vec2 dir = normalize(vec2(1.0, 0.42));
  vec2 per = vec2(-dir.y, dir.x);
  float wA = fbm(p * 1.0 + 3.1, vec2(1.0), 4);
  float wB = fbm(p * 2.0 + 7.7, vec2(2.0), 4);
  vec2 pw = p + vec2(wA, wB) * 0.08;
  float along = dot(pw, dir), across = dot(pw, per);
  // wide soft veins (~0.3 m apart): long gently-waving bands, a bright core inside a grey halo
  float fW = across * 2.0 + 0.35 * wA + 0.08 * sin(along * 6.2831 + wB * 2.0);
  float bandW = abs(fract(fW) - 0.5) * 2.0;                       // 0 at the vein centre line
  float veinW = exp(-pow((1.0 - bandW) / 0.09, 2.0));
  float coreW = exp(-pow((1.0 - bandW) / 0.018, 2.0)) * smoothstep(0.35, 0.65, fbmv(p * 2.0 + 1.3, vec2(2.0), 3));
  // fine fracture veins (~3 cm cells), straight-ish segments stretched along the flow, kept sparse
  vec2 fq = vec2(along * 10.0, across * 26.0) + vec2(wB, wA) * 1.5;
  float fe = voronoiEdge(fq, vec2(1000.0), 1.0);
  float veinF = (1.0 - smoothstep(0.0, 0.025, fe)) * smoothstep(0.7, 0.86, fbmv(p * 3.0 + 5.0, vec2(3.0), 3));
  // clouded mid-grey drifts under the veins
  float cloud = fbmv(vec2(along * 1.5, across * 3.0) + 2.0, vec2(1000.0), 5);
  vec3 base = vec3(0.034, 0.033, 0.036);
  base = mix(base, vec3(0.1, 0.098, 0.1), smoothstep(0.52, 0.85, cloud) * 0.7);
  base = mix(base, vec3(0.15, 0.145, 0.14), veinW * 0.5);
  vec3 vein = vec3(0.81, 0.776, 0.72);
  float v = max(coreW * 0.8, veinF * 0.45);
  v *= 0.75 + 0.25 * vnoise(p * 80.0, vec2(80.0));
  vec3 col = mix(base, vein, v);
  s.albedo = col;
  s.height = 0.5 - v * 0.015;
  s.rough = 0.12 + 0.05 * v + 0.04 * cloud;
  s.metal = 0.0;
  s.ao = 1.0;
}`,
  });
}

/**
 * Tenebrist oil portrait of a Victorian gentleman: three-quarter view lit from the upper left, most of the face and all
 * of the coat falling into shadow, side-whiskers and a moustache, a pale stock at the throat, a warm glow on the
 * ground behind the lit side. Brushwork, craquelure and yellowed varnish. uv 0..1 over the canvas, uAspect = w/h.
 */
export function oilPortraitTexture(forge, { aspect = 0.756, key = 'gameroom:portrait3' } = {}) {
  return forge.generate(key, {
    size: 1024, aspect, tile: false, normalStrength: 0.35,
    glsl: /* glsl */ `
float sstep(float a, float b, float x) { return smoothstep(a, b, x); }
float g2(vec2 p, vec2 c, vec2 r) { vec2 d = (p - c) / r; return exp(-dot(d, d)); }
void surface(vec2 uv, inout Surface s) {
  vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y);
  float bw = fbm(uv * 3.0, vec2(1000.0), 4);
  float brush = vnoise(vec2(uv.x * 30.0 + bw * 3.0, uv.y * 140.0), vec2(1000.0));
  float brush2 = vnoise(rot2(0.7) * uv * vec2(160.0, 26.0), vec2(1000.0));
  // ground: dark umber; a warm glow behind the lit (left) side of the head so the silhouette reads
  float glow = g2(p, vec2(-0.1, 0.64), vec2(0.32, 0.4));
  vec3 col = mix(vec3(0.03, 0.024, 0.018), vec3(0.3, 0.2, 0.1), glow * 0.8);
  col *= 0.85 + 0.25 * bw + 0.08 * brush;
  // ---- coat: broad shoulders rising to the neck, lit rim along the near shoulder
  float shoulder = p.y - (0.43 - 0.75 * p.x * p.x - 0.04 * p.x);
  float coat = 1.0 - sstep(-0.012, 0.012, shoulder);
  vec3 coatC = vec3(0.02, 0.018, 0.02) * (0.8 + 0.4 * brush2);
  coatC += vec3(0.16, 0.12, 0.09) * exp(-pow(shoulder / 0.02, 2.0)) * sstep(0.02, 0.25, -p.x);
  float lapel = exp(-pow((abs(p.x) - (0.035 + (0.42 - p.y) * 0.5)) / 0.008, 2.0)) * sstep(0.08, 0.38, p.y) * (1.0 - sstep(0.39, 0.42, p.y));
  coatC += vec3(0.05, 0.042, 0.035) * lapel * sstep(0.1, -0.1, p.x);
  // soft cravat and shirt front, grey in shadow and warm in the light
  float shirt = g2(p, vec2(-0.005, 0.36), vec2(0.04, 0.07)) + 0.6 * g2(p, vec2(0.0, 0.27), vec2(0.025, 0.08));
  vec3 shirtC = mix(vec3(0.18, 0.16, 0.13), vec3(0.62, 0.55, 0.43), sstep(0.03, -0.04, p.x));
  coatC = mix(coatC, shirtC, clamp(shirt, 0.0, 1.0) * 0.85);
  float chain = exp(-pow((p.y - (0.14 + 0.6 * pow(p.x + 0.02, 2.0))) / 0.003, 2.0)) * sstep(-0.12, -0.03, p.x) * (1.0 - sstep(0.05, 0.11, p.x));
  coatC += vec3(0.4, 0.3, 0.1) * chain * (0.5 + 0.5 * sin(p.x * 420.0));
  col = mix(col, coatC, coat);
  // neck in shadow
  float neck = (1.0 - sstep(0.03, 0.048, abs(p.x - 0.006))) * sstep(0.38, 0.42, p.y) * (1.0 - sstep(0.52, 0.55, p.y));
  col = mix(col, vec3(0.09, 0.05, 0.035), neck * (1.0 - coat * 0.0));
  // ---- head: an ellipsoid turned three-quarters to the left, lit from the upper left; most of the far side in shadow
  vec2 hc = vec2(0.012, 0.625);
  vec2 hr = vec2(0.088, 0.118);
  vec2 hp = (p - hc) / hr;
  float hd = length(hp);
  float headM = 1.0 - sstep(0.86, 1.04, hd);
  float z = sqrt(max(0.0, 1.0 - min(1.0, hd * hd)));
  vec3 n = normalize(vec3(hp.x * 0.9 + 0.12, hp.y * 0.8, z));
  // features as gentle normal/occlusion modulations around the midline (shifted left by the turn)
  float mx = -0.28;
  float sock = g2(hp, vec2(mx - 0.34, 0.08), vec2(0.2, 0.11)) + 0.8 * g2(hp, vec2(mx + 0.3, 0.08), vec2(0.18, 0.1));
  float nose = g2(hp, vec2(mx - 0.06, -0.18), vec2(0.07, 0.2));
  float noseSh = g2(hp, vec2(mx + 0.1, -0.24), vec2(0.08, 0.16));
  float cheekbone = g2(hp, vec2(mx - 0.42, -0.12), vec2(0.18, 0.12));
  float mouth = g2(hp, vec2(mx - 0.02, -0.56), vec2(0.18, 0.03));
  vec3 L = normalize(vec3(-0.8, 0.5, 0.35));
  float lam = clamp(dot(n, L) * 0.85 + 0.15, 0.0, 1.0);
  lam *= 1.0 - 0.45 * sock;
  lam += 0.18 * nose * sstep(0.0, 0.2, -hp.x + mx + 0.15);
  lam *= 1.0 - 0.5 * noseSh;
  lam += 0.12 * cheekbone;
  lam *= 1.0 - 0.45 * mouth;
  lam = max(lam, 0.3 * g2(hp, vec2(mx + 0.3, -0.12), vec2(0.09, 0.07)));      // Rembrandt triangle
  vec3 skinS = vec3(0.06, 0.03, 0.02), skinM = vec3(0.42, 0.25, 0.17), skinH = vec3(0.78, 0.6, 0.45);
  vec3 skin = mix(skinS, skinM, sstep(0.08, 0.5, lam));
  skin = mix(skin, skinH, sstep(0.55, 0.95, lam));
  skin = mix(skin, skin * vec3(1.1, 0.88, 0.82), cheekbone * 0.4);
  // eyes: a dark glint deep in each socket, a single catch-light on the lit eye
  skin = mix(skin, vec3(0.04, 0.025, 0.018), g2(hp, vec2(mx - 0.34, 0.06), vec2(0.07, 0.03)) * 0.55);
  skin = mix(skin, vec3(0.03, 0.02, 0.015), g2(hp, vec2(mx + 0.28, 0.06), vec2(0.06, 0.028)) * 0.4);
  skin += vec3(0.4, 0.36, 0.3) * g2(hp, vec2(mx - 0.37, 0.075), vec2(0.016, 0.013)) * 0.5;
  // hair: dark mass over the crown and down to the ears, sheen where the light catches it; side-whiskers, moustache
  float hairTop = sstep(0.18, 0.42, hp.y + 0.1 * hp.x * hp.x + 0.12 * hp.x);
  float whisk = sstep(0.5, 0.78, abs(hp.x - mx + 0.08)) * sstep(-0.75, -0.25, hp.y) * (1.0 - sstep(0.15, 0.35, hp.y));
  float mous = g2(hp, vec2(mx - 0.03, -0.44), vec2(0.24, 0.055));
  float hairM = clamp(hairTop + whisk * 0.9 + mous * 0.85, 0.0, 1.0);
  float strand = vnoise(vec2(hp.x * 30.0 + hp.y * 12.0, hp.y * 5.0), vec2(1000.0));
  vec3 hairC = vec3(0.035, 0.025, 0.018) * (0.7 + 0.6 * strand);
  hairC += vec3(0.2, 0.14, 0.08) * sstep(0.45, 0.95, lam) * strand * hairTop;
  vec3 face = mix(skin, hairC, hairM * 0.92);
  // hair mass beyond the face oval at the crown and the back of the head, catching a rim of light
  float skull = 1.0 - sstep(0.9, 1.06, length((p - (hc + vec2(0.03, 0.028))) / (hr * vec2(1.12, 1.04))));
  float beyond = skull * (1.0 - headM) * sstep(-0.1, 0.25, (p.y - hc.y) / hr.y + 0.5 * (p.x - hc.x) / hr.x);
  col = mix(col, hairC + vec3(0.05, 0.035, 0.02) * sstep(0.0, -0.08, p.x - hc.x), beyond);
  col = mix(col, face, headM);
  // an ear at the far edge of the turned head, mostly in shadow
  col = mix(col, vec3(0.16, 0.09, 0.06), g2(p, hc + vec2(0.07, -0.005), vec2(0.014, 0.026)) * 0.8 * (1.0 - hairM));
  // ---- paint layer, fine craquelure, yellowed varnish, darkened edges
  col *= 0.94 + 0.12 * brush;
  float crack = 1.0 - smoothstep(0.0, 0.03, voronoiEdge(uv * vec2(90.0 * uAspect, 90.0), vec2(1000.0), 0.9));
  float crack2 = 1.0 - smoothstep(0.0, 0.04, voronoiEdge(uv * vec2(220.0 * uAspect, 220.0) + 3.0, vec2(1000.0), 0.9));
  col *= 1.0 - 0.22 * crack - 0.08 * crack2;
  col *= mix(vec3(1.0), vec3(1.0, 0.86, 0.6), 0.5);
  float vig = sstep(0.0, 0.3, uv.x) * sstep(1.0, 0.7, uv.x) * sstep(0.0, 0.25, uv.y) * sstep(1.0, 0.8, uv.y);
  col *= 0.6 + 0.4 * vig;
  s.albedo = col;
  s.height = 0.5 + 0.1 * brush + 0.06 * brush2 - 0.06 * crack - 0.03 * crack2;
  s.rough = 0.4 + 0.15 * crack + 0.1 * brush;
  s.metal = 0.0;
  s.ao = 1.0 - 0.15 * crack;
}`,
  });
}

/**
 * Sepia line engraving on cream laid paper with a plate mark, foxing and a caption line.
 * subject 0 = the hunt (rider and hounds by a tree), 1 = a stag on a crag, 2 = gentlemen at billiards.
 */
export function engravingTexture(forge, { aspect = 0.8, subject = 0, key } = {}) {
  return forge.generate(key || `gameroom:engr${subject}@${aspect.toFixed(2)}`, {
    size: 1024, aspect, tile: false, normalStrength: 0.4,
    uniforms: { uSubj: subject },
    glsl: /* glsl */ `
float seg(vec2 p, vec2 a, vec2 b, float r) { return sdSegment(p, a, b) - r; }
float tone(vec2 p) {     // 0 = paper white, 1 = black; p in plate coords (x 0..1, y 0..1)
  float t = 0.0;
  float sky = 0.12 + 0.1 * (p.y);
  float cl = fbmv(p * vec2(3.0, 6.0) + uSubj, vec2(1000.0), 4);
  t = sky * (0.6 + 0.8 * cl);
  if (uSubj < 0.5) {
    // the hunt: rolling ground, a dark oak at left, a rider on a horse, hounds
    float ground = p.y - (0.32 + 0.04 * sin(p.x * 5.0) + 0.02 * fbm(p * 8.0, vec2(1000.0), 3));
    t = mix(t, 0.4 + 0.2 * fbmv(p * 10.0, vec2(1000.0), 3), 1.0 - smoothstep(-0.005, 0.005, ground));
    float hills = p.y - (0.42 + 0.05 * sin(p.x * 3.0 + 1.0));
    t = mix(t, 0.3, (1.0 - smoothstep(-0.004, 0.004, hills)) * smoothstep(-0.005, 0.0, ground));
    float trunk = seg(p, vec2(0.14, 0.3), vec2(0.17, 0.62), 0.022);
    float crown = length((p - vec2(0.17, 0.72)) * vec2(1.0, 1.3)) - 0.17 - 0.05 * fbm(p * 12.0, vec2(1000.0), 4);
    t = mix(t, 0.85, 1.0 - smoothstep(-0.004, 0.004, min(trunk, crown)));
    vec2 h = p - vec2(0.58, 0.38);
    float body = length(h * vec2(1.0, 1.9)) - 0.1;
    float neck = seg(p, vec2(0.65, 0.4), vec2(0.73, 0.5), 0.028);
    float head = seg(p, vec2(0.73, 0.5), vec2(0.79, 0.45), 0.02);
    float legs = min(min(seg(p, vec2(0.5, 0.36), vec2(0.46, 0.25), 0.011), seg(p, vec2(0.53, 0.35), vec2(0.55, 0.24), 0.011)),
                     min(seg(p, vec2(0.64, 0.36), vec2(0.7, 0.27), 0.011), seg(p, vec2(0.66, 0.35), vec2(0.62, 0.25), 0.011)));
    float tail = seg(p, vec2(0.48, 0.41), vec2(0.43, 0.33), 0.01);
    float rider = min(seg(p, vec2(0.58, 0.45), vec2(0.6, 0.56), 0.026), length(p - vec2(0.605, 0.6)) - 0.022);
    float hat = seg(p, vec2(0.59, 0.625), vec2(0.62, 0.625), 0.008);
    float horse = min(min(min(body, neck), min(head, legs)), min(min(tail, rider), hat));
    t = mix(t, 0.92, 1.0 - smoothstep(-0.003, 0.003, horse));
    for (int i = 0; i < 3; i++) {
      vec2 o = vec2(0.3 + 0.12 * float(i), 0.27 + 0.01 * float(i));
      float hb = length((p - o) * vec2(1.0, 2.2)) - 0.04;
      float hh = length(p - o - vec2(0.045, 0.02)) - 0.013;
      float hl = min(seg(p, o + vec2(-0.03, -0.01), o + vec2(-0.04, -0.04), 0.005), seg(p, o + vec2(0.03, -0.01), o + vec2(0.04, -0.04), 0.005));
      t = mix(t, 0.8, 1.0 - smoothstep(-0.003, 0.003, min(min(hb, hh), hl)));
    }
  } else if (uSubj < 1.5) {
    // a stag on a crag against mountains
    float mtn = p.y - (0.5 + 0.18 * abs(sin(p.x * 4.0 + 0.5)) * (1.0 - p.x * 0.4) + 0.03 * fbm(p * 10.0, vec2(1000.0), 3));
    t = mix(t, 0.35, 1.0 - smoothstep(-0.004, 0.004, mtn));
    float crag = p.y - (0.28 + 0.15 * (1.0 - smoothstep(0.3, 0.75, p.x)) + 0.03 * fbm(p * 14.0, vec2(1000.0), 4));
    t = mix(t, 0.7 + 0.2 * fbmv(p * 16.0, vec2(1000.0), 3), 1.0 - smoothstep(-0.004, 0.004, crag));
    vec2 o = vec2(0.38, 0.52);
    float body = length((p - o) * vec2(1.0, 1.8)) - 0.09;
    float neck = seg(p, o + vec2(0.06, 0.02), o + vec2(0.11, 0.12), 0.026);
    float head = seg(p, o + vec2(0.11, 0.12), o + vec2(0.16, 0.1), 0.017);
    float legs = min(min(seg(p, o + vec2(-0.06, -0.02), o + vec2(-0.07, -0.13), 0.01), seg(p, o + vec2(-0.03, -0.02), o + vec2(-0.02, -0.13), 0.01)),
                     min(seg(p, o + vec2(0.05, -0.02), o + vec2(0.06, -0.13), 0.01), seg(p, o + vec2(0.07, -0.02), o + vec2(0.09, -0.12), 0.01)));
    float ant = 1e3;
    for (int i = 0; i < 2; i++) {
      float sx = i == 0 ? -1.0 : 1.0;
      vec2 b = o + vec2(0.115 + 0.01 * sx, 0.15);
      ant = min(ant, seg(p, b, b + vec2(-0.04 + 0.02 * sx, 0.1), 0.005));
      ant = min(ant, seg(p, b + vec2(-0.02 + 0.01 * sx, 0.05), b + vec2(0.02 + 0.01 * sx, 0.08), 0.004));
      ant = min(ant, seg(p, b + vec2(-0.035 + 0.02 * sx, 0.09), b + vec2(-0.01 + 0.02 * sx, 0.14), 0.004));
      ant = min(ant, seg(p, b + vec2(-0.035 + 0.02 * sx, 0.09), b + vec2(-0.08 + 0.02 * sx, 0.13), 0.004));
    }
    t = mix(t, 0.92, 1.0 - smoothstep(-0.003, 0.003, min(min(body, neck), min(min(head, legs), ant))));
  } else {
    // gentlemen at billiards under a hanging lamp
    float wall = 0.3 + 0.12 * fbmv(p * 8.0, vec2(1000.0), 3);
    t = mix(t, wall, step(0.3, p.y));
    float floorT = 0.45;
    t = mix(t, floorT, 1.0 - step(0.3, p.y));
    float top = sdBox(p - vec2(0.5, 0.36), vec2(0.36 - (p.y - 0.36) * 0.4, 0.05));
    t = mix(t, 0.55, 1.0 - smoothstep(-0.003, 0.003, top));
    float rail = abs(sdBox(p - vec2(0.5, 0.36), vec2(0.36 - (p.y - 0.36) * 0.4, 0.05))) - 0.006;
    float legs = min(min(seg(p, vec2(0.2, 0.31), vec2(0.21, 0.16), 0.014), seg(p, vec2(0.8, 0.31), vec2(0.79, 0.16), 0.014)), seg(p, vec2(0.5, 0.31), vec2(0.5, 0.17), 0.016));
    float apron = sdBox(p - vec2(0.5, 0.29), vec2(0.34, 0.025));
    t = mix(t, 0.9, 1.0 - smoothstep(-0.003, 0.003, min(min(rail, legs), apron)));
    // a player bending over the cue, another standing with his cue grounded
    float pl = min(seg(p, vec2(0.66, 0.44), vec2(0.78, 0.5), 0.03), length(p - vec2(0.64, 0.45)) - 0.025);
    pl = min(pl, min(seg(p, vec2(0.78, 0.5), vec2(0.8, 0.32), 0.02), seg(p, vec2(0.76, 0.5), vec2(0.74, 0.32), 0.02)));
    float cue = seg(p, vec2(0.45, 0.42), vec2(0.85, 0.47), 0.003);
    float st = min(seg(p, vec2(0.18, 0.4), vec2(0.18, 0.62), 0.035), length(p - vec2(0.18, 0.67)) - 0.028);
    st = min(st, min(seg(p, vec2(0.17, 0.4), vec2(0.16, 0.2), 0.016), seg(p, vec2(0.2, 0.4), vec2(0.21, 0.2), 0.016)));
    float cue2 = seg(p, vec2(0.23, 0.2), vec2(0.25, 0.7), 0.003);
    float lamp = min(seg(p, vec2(0.5, 1.0), vec2(0.5, 0.78), 0.003), sdBox(p - vec2(0.5, 0.75), vec2(0.18, 0.02)));
    t = mix(t, 0.94, 1.0 - smoothstep(-0.003, 0.003, min(min(pl, cue), min(min(st, cue2), lamp))));
    // light pool on the cloth
    t -= 0.25 * exp(-dot((p - vec2(0.5, 0.38)) * vec2(2.0, 6.0), (p - vec2(0.5, 0.38)) * vec2(2.0, 6.0)));
  }
  return clamp(t, 0.0, 1.0);
}
void surface(vec2 uv, inout Surface s) {
  vec2 px = vec2(uv.x * uAspect, uv.y);
  // plate area inside a margin, the caption band below it
  float mx = 0.09, myB = 0.17, myT = 0.08;
  vec2 lo = vec2(mx, myB), hi = vec2(1.0 - mx, 1.0 - myT);
  vec2 p = (uv - lo) / (hi - lo);
  float inPlate = step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
  float t = tone(p);
  // engraving: parallel hatching whose width follows tone, cross-hatching in the darks, stipple in the sky
  float freq = 260.0;
  float h1 = abs(fract(dot(px, vec2(0.94, 0.34)) * freq + 0.3 * fbm(px * 6.0, vec2(1000.0), 2)) - 0.5);
  float h2 = abs(fract(dot(px, vec2(-0.5, 0.87)) * freq * 0.9) - 0.5);
  float ink = smoothstep(0.5 - t * 0.5 - 0.06, 0.5 - t * 0.5, 0.5 - h1);
  ink = max(ink, smoothstep(0.5 - (t - 0.5) * 0.9 - 0.06, 0.5 - (t - 0.5) * 0.9, 0.5 - h2) * step(0.5, t));
  ink *= inPlate;
  // plate border lines
  float border = (1.0 - smoothstep(0.0, 0.004, abs(sdBox(uv - 0.5 * (lo + hi), 0.5 * (hi - lo))))) ;
  float plateMark = (1.0 - smoothstep(0.0, 0.003, abs(sdBox(uv - 0.5 * (lo + hi), 0.5 * (hi - lo) + 0.025)))) * 0.35;
  // caption: a row of small dashes like a lettered title
  vec2 cp = (uv - vec2(0.5, myB * 0.5)) * vec2(1.0, 1.0);
  float letters = step(abs(cp.y), 0.012) * step(abs(cp.x), 0.28) * step(0.45, vnoise(vec2(cp.x * 90.0, 0.0), vec2(1000.0))) * step(0.3, fract(cp.x * 90.0));
  ink = max(ink, max(border, plateMark));
  ink = max(ink, letters * 0.8);
  // paper: cream, laid lines, foxing spots, toned edges
  float laid = 0.985 + 0.015 * sin(uv.y * 6.2831 * 180.0);
  vec3 paper = vec3(0.86, 0.79, 0.64) * laid * (0.95 + 0.05 * fbmv(uv * 20.0, vec2(1000.0), 3));
  float fox = smoothstep(0.72, 0.8, fbmv(uv * 9.0 + 4.0, vec2(1000.0), 4));
  paper = mix(paper, vec3(0.62, 0.44, 0.26), fox * 0.5);
  float edge = min(min(uv.x, 1.0 - uv.x) * uAspect, min(uv.y, 1.0 - uv.y));
  paper *= mix(vec3(0.82, 0.72, 0.55), vec3(1.0), smoothstep(0.0, 0.06, edge));
  vec3 inkC = vec3(0.16, 0.1, 0.06);
  s.albedo = mix(paper, inkC, ink * 0.92);
  s.height = 0.5 - 0.15 * ink + (inPlate > 0.5 ? -0.05 : 0.0);
  s.rough = 0.85 - 0.15 * ink;
  s.metal = 0.0;
  s.ao = 1.0;
}`,
  });
}

/** Crackled oxblood club leather: fine crackle network, pores, soft creases; tiles at ~0.4 m. */
export function clubLeatherTexture(forge, { color = [0.3, 0.055, 0.04], key = 'gameroom:clubLeather' } = {}) {
  return forge.generate(key, {
    size: 1024, normalStrength: 1.6,
    uniforms: { uC: color },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float w = fbm(uv * 3.0, vec2(3.0), 4);
  float crk = voronoiEdge(uv * 34.0 + w * 1.5, vec2(34.0), 1.0);
  float crack = 1.0 - smoothstep(0.0, 0.05, crk);
  float crk2 = voronoiEdge(uv * 90.0 + w * 2.0 + 7.0, vec2(90.0), 1.0);
  float crack2 = (1.0 - smoothstep(0.0, 0.06, crk2)) * smoothstep(0.4, 0.7, fbmv(uv * 4.0, vec2(4.0), 3));
  float pores = vnoise(uv * 420.0, vec2(420.0));
  float crease = ridged(uv * vec2(2.0, 5.0) + 1.3, vec2(2.0, 5.0), 4);
  float patina = fbmv(uv * 2.0 + 9.0, vec2(2.0), 4);
  vec3 c = uC * (0.8 + 0.45 * patina);
  c = mix(c, uC * 0.4, crack * 0.6 + crack2 * 0.4);
  c = mix(c, uC * vec3(1.35, 1.6, 1.5), smoothstep(0.75, 1.0, crease) * 0.3);   // rubbed crease ridges
  c *= 0.95 + 0.08 * pores;
  s.albedo = c;
  s.height = 0.5 - 0.3 * crack - 0.15 * crack2 + 0.06 * pores + 0.25 * crease;
  s.rough = 0.5 + 0.15 * crack + 0.1 * patina - 0.15 * smoothstep(0.75, 1.0, crease);
  s.metal = 0.0;
  s.ao = 1.0 - 0.35 * crack;
}`,
  });
}

/** Bare winter tree silhouettes for beyond the window, alpha-masked, blurred for depth. uv 0..1, aspect w/h. */
export function treeSilhouetteTexture(forge, { aspect = 0.75, key = 'gameroom:trees' } = {}) {
  return forge.generate(key, {
    size: 1024, aspect, tile: false, normalStrength: 0.0,
    glsl: /* glsl */ `
float br(vec2 p, vec2 a, vec2 b, float w0, float w1) {
  vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(w0, w1, h);
}
// a recursive-looking branching tree built from three generations of segments with hashed angles
float tree(vec2 p, vec2 root, float scale, float seed) {
  float d = 1e3;
  vec2 a = root, b = root + vec2(0.02, 0.55) * scale;
  d = min(d, br(p, a, b, 0.028 * scale, 0.014 * scale));
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float t = 0.35 + 0.11 * fi;
    vec2 o = mix(a, b, t);
    float side = mod(fi, 2.0) * 2.0 - 1.0;
    float ang = side * (0.5 + 0.5 * hash11(seed + fi * 3.1));
    float len = (0.38 - 0.04 * fi) * scale;
    vec2 e = o + vec2(sin(ang), cos(ang)) * len;
    d = min(d, br(p, o, e, 0.012 * scale, 0.004 * scale));
    for (int j = 0; j < 4; j++) {
      float fj = float(j);
      vec2 o2 = mix(o, e, 0.3 + 0.18 * fj);
      float a2 = ang + (mod(fj, 2.0) * 2.0 - 1.0) * (0.5 + 0.4 * hash11(seed + fi * 7.0 + fj));
      vec2 e2 = o2 + vec2(sin(a2), cos(a2)) * len * (0.45 - 0.06 * fj);
      d = min(d, br(p, o2, e2, 0.005 * scale, 0.0015 * scale));
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        vec2 o3 = mix(o2, e2, 0.35 + 0.25 * fk);
        float a3 = a2 + (mod(fk + fj, 2.0) * 2.0 - 1.0) * (0.6 + 0.3 * hash11(seed + fi * 13.0 + fj * 5.0 + fk));
        vec2 e3 = o3 + vec2(sin(a3), cos(a3)) * len * 0.16;
        d = min(d, br(p, o3, e3, 0.0022 * scale, 0.0008 * scale));
      }
    }
  }
  return d;
}
void surface(vec2 uv, inout Surface s) {
  vec2 p = vec2(uv.x * uAspect, uv.y);
  float d1 = tree(p, vec2(0.62 * uAspect, -0.05), 1.35, 3.0);
  float d2 = tree(p, vec2(0.05 * uAspect, 0.08), 0.75, 11.0);
  float near = 1.0 - smoothstep(-0.0015, 0.0025, d1);
  float far = (1.0 - smoothstep(-0.002, 0.006, d2)) * 0.6;
  s.albedo = vec3(0.012, 0.014, 0.02);
  s.alpha = max(near, far);
  s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}
