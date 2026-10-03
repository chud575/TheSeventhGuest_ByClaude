import * as THREE from 'three';

/**
 * Custom procedural textures for the upstairs gallery:
 *  - runner(): long hall runner (tiles along V), crimson field, medallions, guard borders
 *  - portrait(): painted Victorian sitters with EMPTY eye whites (irises are drawn
 *    at runtime by portraits.js so the eyes can follow the player)
 *  - nightSky(): moonlit sky + bare trees seen through the far window
 *  - clockFace(): enamel dial for the tall-case clock
 */

// ---------------------------------------------------------------------------- runner
export function runnerTexture(ctx) {
  return ctx.textures.generate('gallery:runner', {
    size: 1024, aspect: 1.0, tile: true, normalStrength: 1.4,
    glsl: /* glsl */ `
    float nz(vec2 p, vec2 per) { return gnoise(p, per); }
    void surface(vec2 uv, inout Surface s) {
      // u across the runner (0..1 = full width), v along it (one motif per tile)
      vec2 p = uv;
      float ax = abs(p.x - 0.5);                         // 0 centre .. 0.5 edge
      vec3 crimson = vec3(0.36, 0.05, 0.05);
      vec3 wine = vec3(0.2, 0.025, 0.035);
      vec3 navy = vec3(0.05, 0.07, 0.17);
      vec3 gold = vec3(0.72, 0.52, 0.22);
      vec3 ivory = vec3(0.78, 0.7, 0.55);
      vec3 teal = vec3(0.07, 0.25, 0.26);
      vec3 col = crimson;
      float h = 0.5;
      // knotted pile: tiny grid of knots
      vec2 kn = fract(p * vec2(180.0, 180.0));
      float knot = smoothstep(0.5, 0.15, length(kn - 0.5));
      // ---------------- field (centre 0..0.3)
      vec2 c = vec2(ax, abs(fract(p.y) - 0.5));          // mirrored quadrant coordinates
      // central medallion: a lobed rhombus
      vec2 m = vec2(ax, fract(p.y) - 0.5);
      float lobes = sdRhombus(m, vec2(0.2, 0.36));
      float ring = abs(length(m * vec2(1.0, 0.62)) - 0.13) - 0.012;
      float star = sdStar(m * vec2(1.0, 0.7), 0.09, 8.0, 0.45);
      float petals = length(polarRep(m * vec2(1.0, 0.7), 12.0) - vec2(0.1, 0.0)) - 0.022;
      // field lattice of small guls (offset rows)
      vec2 g = vec2(ax * 10.0, p.y * 6.0);
      vec2 gi = floor(g); vec2 gf = fract(g) - 0.5;
      float gul = sdRhombus(gf, vec2(0.32, 0.38));
      float gulIn = sdRhombus(gf, vec2(0.16, 0.2));
      if (ax < 0.3) {
        col = mix(crimson, wine, smoothstep(0.0, 0.3, nz(p * vec2(4.0, 3.0), vec2(4.0, 3.0)) * 0.5 + 0.25));
        col = mix(col, navy, smoothstep(0.006, -0.006, gul) * 0.55 * step(0.18, length(m * vec2(1.0, 0.55))));
        col = mix(col, gold * 0.8, smoothstep(0.006, -0.006, gulIn) * 0.6 * step(0.18, length(m * vec2(1.0, 0.55))));
        // medallion layers
        col = mix(col, navy, smoothstep(0.006, -0.006, lobes));
        col = mix(col, ivory * 0.9, smoothstep(0.006, -0.006, abs(lobes) - 0.008));
        col = mix(col, crimson * 1.2, smoothstep(0.006, -0.006, length(m * vec2(1.0, 0.62)) - 0.13));
        col = mix(col, gold, smoothstep(0.004, -0.004, ring));
        col = mix(col, teal, smoothstep(0.004, -0.004, petals));
        col = mix(col, ivory, smoothstep(0.004, -0.004, star));
        col = mix(col, navy, smoothstep(0.004, -0.004, length(m) - 0.025));
        // corner spandrels where the medallion meets the next
        float sp = sdRhombus(vec2(ax - 0.3, abs(fract(p.y) - 0.5) - 0.5), vec2(0.16, 0.22));
        col = mix(col, navy * 1.3, smoothstep(0.006, -0.006, sp));
      }
      // ---------------- borders
      if (ax >= 0.3) {
        float b = (ax - 0.3) / 0.2;                         // 0..1 across the border
        col = navy;
        // main border band with a running vine and rosettes
        float band = step(0.18, b) * step(b, 0.78);
        float vy = fract(p.y * 4.0);
        float vine = abs(b - 0.48 - 0.12 * sin(vy * 6.2832)) - 0.035;
        float ros = length(vec2((b - 0.48) * 0.2, (vy - 0.5) * 0.25 ) * vec2(5.0, 4.0)) - 0.11;
        vec3 bandCol = mix(wine * 1.1, crimson * 0.9, 0.4);
        col = mix(col, bandCol, band);
        col = mix(col, gold * 0.85, smoothstep(0.02, -0.02, vine) * band);
        col = mix(col, ivory, smoothstep(0.02, -0.02, ros) * band);
        col = mix(col, teal, smoothstep(0.02, -0.02, ros + 0.05) * band);
        // guard stripes
        col = mix(col, gold, smoothstep(0.03, 0.0, abs(b - 0.12)) );
        col = mix(col, ivory * 0.85, smoothstep(0.025, 0.0, abs(b - 0.84)));
        col = mix(col, crimson, smoothstep(0.03, 0.0, abs(b - 0.93)));
        // binding at the very edge
        float bind = smoothstep(0.965, 0.985, b);
        col = mix(col, vec3(0.12, 0.05, 0.03), bind);
        h -= bind * 0.25;
      }
      // abrash (dye lot banding) and wear along the walking line
      float abrash = nz(vec2(p.y * 1.3, ax * 2.0), vec2(1.0, 64.0));
      col *= 0.9 + 0.18 * abrash;
      float wear = smoothstep(0.22, 0.0, ax) * (0.5 + 0.5 * nz(p * vec2(6.0, 9.0), vec2(6.0, 9.0)));
      col = mix(col, col * 0.72 + vec3(0.05, 0.035, 0.03), wear * 0.55);
      // pile shading
      float fuzz = nz(p * 420.0, vec2(420.0));
      col *= 0.86 + 0.16 * knot + 0.08 * fuzz;
      s.albedo = col;
      s.height = h + knot * 0.12 + fuzz * 0.06 - wear * 0.05;
      s.rough = 0.92;
      s.metal = 0.0;
      s.ao = 0.85 + 0.15 * knot;
    }`,
  });
}

// ---------------------------------------------------------------------------- portraits
/**
 * Sitter presets. Head geometry is shared so the runtime eye overlay can find the eyes:
 * head centre (canvas-centred, height units) = HEAD_C, radii = HEAD_R * scale.
 */
export const HEAD_C = [0.0, 0.11];
export const HEAD_R = [0.15, 0.198];
export const EYE_OFF = [0.36, 0.06];      // in head-normalised units
export const EYE_R = [0.105, 0.044];        // sclera radii (head-normalised)

export const SITTERS = {
  // name: { sex 0 man / 1 woman / 2 child, age 0..1, hair rgb, bg rgb, coat rgb, beard, hat, iris rgb }
  lady:    { sex: 1, age: 0.35, hair: [0.17, 0.09, 0.05], bg: [0.08, 0.11, 0.14], coat: [0.05, 0.07, 0.16], beard: 0, hat: 0, scale: 1.0, iris: [0.22, 0.3, 0.38] },
  colonel: { sex: 0, age: 0.6, hair: [0.32, 0.3, 0.28], bg: [0.16, 0.11, 0.06], coat: [0.22, 0.04, 0.04], beard: 0.5, hat: 0, scale: 1.0, iris: [0.25, 0.17, 0.1] },
  child:   { sex: 2, age: 0.0, hair: [0.55, 0.38, 0.18], bg: [0.1, 0.12, 0.09], coat: [0.06, 0.08, 0.2], beard: 0, hat: 0, scale: 0.9, iris: [0.25, 0.35, 0.45] },
  elder:   { sex: 0, age: 1.0, hair: [0.75, 0.73, 0.7], bg: [0.07, 0.07, 0.09], coat: [0.03, 0.03, 0.035], beard: 1.0, hat: 0, scale: 1.0, iris: [0.2, 0.18, 0.15] },
  widow:   { sex: 1, age: 0.75, hair: [0.4, 0.38, 0.36], bg: [0.12, 0.05, 0.06], coat: [0.02, 0.02, 0.025], beard: 0, hat: 0, scale: 1.0, iris: [0.18, 0.12, 0.08] },
  toymaker:{ sex: 0, age: 0.55, hair: [0.08, 0.07, 0.07], bg: [0.1, 0.2, 0.17], coat: [0.03, 0.03, 0.04], beard: 0.25, hat: 1, scale: 0.92, iris: [0.3, 0.32, 0.12] },
};

export function portraitTexture(ctx, name, aspect = 0.78, size = 1024) {
  const s = SITTERS[name];
  return ctx.textures.generate(`gallery:portrait:${name}:${aspect}`, {
    size, aspect, tile: false, normalStrength: 0.22, seed: name.length * 3.7 + s.age * 11.0,
    uniforms: {
      uSex: s.sex, uAge: s.age, uHair: s.hair, uBg: s.bg, uCoat: s.coat, uBeard: s.beard, uHat: s.hat, uScale: s.scale,
      uHeadC: HEAD_C, uHeadR: HEAD_R, uEyeOff: EYE_OFF, uEyeR: EYE_R,
    },
    glsl: PORTRAIT_GLSL,
  });
}

const PORTRAIT_GLSL = /* glsl */ `
float nz(vec2 p) { return gnoise(p, vec2(1e4)); }
float fb(vec2 p, int o) { float s = 0.0, a = 0.5; for (int i = 0; i < 8; i++) { if (i >= o) break; s += a * nz(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
vec2 brush(vec2 uv, float scale, float amt) {
  float a = fb(uv * scale * 0.5 + uSeed, 3) * PI * 2.0;
  return uv + vec2(cos(a), sin(a)) * fb(uv * scale * 4.0 + uSeed * 3.0, 2) * amt;
}
float sm(float d, float w) { return smoothstep(w, -w, d); }
float gs(vec2 q, vec2 c, vec2 r) { vec2 d = (q - c) / r; return exp(-dot(d, d)); }

const vec3 LKEY = vec3(-0.58, 0.5, 0.64);

// egg-shaped head: narrower toward the jaw
vec2 eggQ(vec2 q) { float w = 1.0 - 0.27 * smoothstep(0.05, -1.0, q.y) - 0.06 * smoothstep(0.4, 1.0, q.y); return vec2(q.x / w, q.y); }

// facial relief (head-normalised units, +y up, +x to the sitter's left as seen)
float relief(vec2 q) {
  float h = 0.0;
  float ex = uEyeOff.x, ey = uEyeOff.y;
  h += 0.12 * exp(-pow(q.x / 0.12, 2.0)) * smoothstep(0.12, -0.02, q.y) * smoothstep(-0.46, -0.3, q.y) * (0.5 + (0.1 - q.y));
  h += 0.07 * gs(q, vec2(0.0, -0.36), vec2(0.1, 0.07));
  h += 0.05 * gs(q, vec2(-0.09, -0.38), vec2(0.06, 0.04)) + 0.05 * gs(q, vec2(0.09, -0.38), vec2(0.06, 0.04));
  h += 0.05 * exp(-pow((q.y - ey - 0.17) / 0.07, 2.0)) * smoothstep(0.75, 0.3, abs(q.x));
  h -= 0.09 * (gs(q, vec2(-ex, ey), vec2(0.2, 0.11)) + gs(q, vec2(ex, ey), vec2(0.2, 0.11)));
  h += 0.035 * (gs(q, vec2(-ex, ey), vec2(0.11, 0.05)) + gs(q, vec2(ex, ey), vec2(0.11, 0.05)));   // eyeballs
  h += 0.05 * (gs(q, vec2(-0.5, -0.18), vec2(0.18, 0.12)) + gs(q, vec2(0.5, -0.18), vec2(0.18, 0.12)));
  h -= 0.035 * (gs(q, vec2(-0.42, -0.42), vec2(0.15, 0.2)) + gs(q, vec2(0.42, -0.42), vec2(0.15, 0.2))) * (0.4 + uAge);
  h += 0.045 * gs(q, vec2(0.0, -0.575), vec2(0.2, 0.035)) + 0.05 * gs(q, vec2(0.0, -0.645), vec2(0.17, 0.04));
  h -= 0.03 * gs(q, vec2(0.0, -0.61), vec2(0.22, 0.012));
  h -= 0.025 * gs(q, vec2(0.0, -0.74), vec2(0.18, 0.04));
  h += 0.06 * gs(q, vec2(0.0, -0.86), vec2(0.2, 0.1));
  h -= 0.02 * gs(q, vec2(0.0, -0.48), vec2(0.04, 0.06));   // philtrum
  return h;
}

vec3 shadeN(vec3 n, vec3 base, float spec) {
  float d = dot(n, normalize(LKEY));
  float wrap = clamp((d + 0.25) / 1.25, 0.0, 1.0);
  vec3 c = base * (0.08 + 1.05 * wrap);
  c += vec3(0.28, 0.04, 0.0) * base * wrap * (1.0 - wrap) * 1.6;             // warm terminator (subsurface)
  c += vec3(0.05, 0.065, 0.09) * smoothstep(0.1, 0.9, n.x) * 0.6;           // cool fill from the right
  vec3 r = reflect(-normalize(LKEY), n);
  c += vec3(1.0, 0.9, 0.75) * pow(max(r.z, 0.0), 18.0) * spec;
  return c;
}

vec3 paint(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  vec2 R = uHeadR * uScale;
  vec2 C = uHeadC;
  // ---------------- background
  float glow = exp(-length((p - C - vec2(-0.1, 0.02)) * vec2(1.0, 0.7)) * 2.2);
  vec3 col = mix(uBg * 0.45, uBg * 2.4 + vec3(0.05, 0.035, 0.015), glow);
  col *= 0.8 + 0.35 * fb(uv * 3.0 + uSeed, 5);
  float swag = smoothstep(0.15, 0.55, fb(vec2(p.x * 3.0 + p.y * 1.5, p.y * 7.0) + uSeed, 4)) * smoothstep(0.05, 0.35, p.x + p.y * 0.6);
  col = mix(col, (uBg * 0.5 + uCoat * 0.5) * (0.6 + 0.8 * fb(p * vec2(4.0, 20.0), 3)), swag * 0.45);
  // a painted column / pilaster at the far left for the gentlemen
  if (uSex < 0.5) col = mix(col, uBg * 1.3 + vec3(0.03, 0.025, 0.015), smoothstep(0.01, -0.01, p.x + uAspect * 0.5 - 0.09) * (0.6 + 0.4 * fb(p * vec2(30.0, 3.0), 3)));

  vec2 hp = rot2(0.05) * (p - C);
  vec2 q = hp / R;
  vec2 qe = eggQ(q);
  float headD = (length(qe) - 1.0) * R.x;
  float neckTop = C.y - R.y * 0.7;

  // ---------------- body (shoulders + chest), shaded as a broad ellipsoid
  float sw = uSex > 1.5 ? 0.26 : (uSex > 0.5 ? 0.3 : 0.36);
  vec2 bc = vec2(0.0, C.y - R.y - 0.33);
  vec2 bq = (p - bc) / vec2(sw, 0.33);
  float bodyD = (length(bq) - 1.0) * 0.3;
  vec3 bn = normalize(vec3(bq.x, bq.y * 0.6, sqrt(max(0.0, 1.0 - dot(bq, bq))) + 0.15));
  vec3 cloth = uCoat * (0.85 + 0.3 * fb(uv * vec2(18.0, 40.0), 3));
  float folds = fb(vec2(p.x * 9.0 + p.y * 2.0, p.y * 3.0) + uSeed, 4);
  bn = normalize(bn + vec3((folds - 0.5) * 0.8, 0.0, 0.0));
  vec3 coat = shadeN(bn, cloth * 1.6, 0.15);
  float chestY = C.y - R.y * 1.0;
  if (uSex < 0.5) {
    // lapels + shirt + cravat
    float lapL = abs(p.x + 0.05 - (p.y - chestY + 0.16) * 0.42) - 0.012;
    float lapR = abs(p.x - 0.05 + (p.y - chestY + 0.16) * 0.42) - 0.012;
    coat = mix(coat, coat * 1.7 + 0.01, sm(min(lapL, lapR), 0.008) * step(p.y, chestY - 0.04) * 0.6);
    col = mix(col, coat, sm(bodyD, 0.01));
    float vee = max(abs(p.x) - (p.y - chestY + 0.3) * 0.32, p.y - chestY + 0.01);
    vec3 linenN = normalize(vec3(p.x * 4.0, 0.2, 1.0));
    vec3 linen = shadeN(linenN, vec3(0.7, 0.66, 0.58), 0.15) * (0.9 + 0.15 * fb(uv * 40.0, 3));
    col = mix(col, linen, sm(vee, 0.006) * sm(bodyD, 0.01));
    vec2 cq = (p - vec2(0.0, chestY - 0.035)) / vec2(0.06, 0.035);
    vec3 cn = normalize(vec3(cq.x, cq.y, sqrt(max(0.0, 1.0 - dot(cq, cq))) + 0.2));
    vec3 cravCol = uCoat.r > 0.15 ? vec3(0.08, 0.07, 0.07) : (uHat > 0.5 ? vec3(0.5, 0.06, 0.07) : vec3(0.84, 0.8, 0.72));
    col = mix(col, shadeN(cn, cravCol, 0.3), sm(length(cq) - 1.0, 0.08));
    if (uCoat.r > 0.15) {   // the colonel: gold epaulettes, frogging, medal
      for (int s = -1; s <= 1; s += 2) {
        vec2 eq = (p - vec2(float(s) * sw * 0.72, bc.y + 0.33 * 0.69 - 0.03)) / vec2(0.07, 0.022);
        vec3 en = normalize(vec3(eq.x, eq.y, sqrt(max(0.0, 1.0 - dot(eq, eq))) + 0.1));
        col = mix(col, shadeN(en, vec3(0.85, 0.62, 0.25), 0.8), sm(length(eq) - 1.0, 0.1));
        for (int f = 0; f < 6; f++) { float fy = float(f) / 6.0; vec2 fq = p - vec2(float(s) * (0.03 + fy * 0.0), chestY - 0.13 - fy * 0.25); float fr = abs(fq.y) - 0.004; col = mix(col, vec3(0.7, 0.52, 0.24) * (0.25 + 0.6 * bn.z), sm(max(fr, abs(fq.x) - 0.05), 0.003) * 0.8); }
      }
      vec2 mq = p - vec2(-0.12, chestY - 0.18);
      col = mix(col, vec3(0.75, 0.6, 0.3), sm(length(mq) - 0.016, 0.004));
      col = mix(col, vec3(0.1, 0.15, 0.4), sm(max(abs(mq.x) - 0.008, abs(mq.y - 0.03) - 0.02), 0.003));
    }
  } else if (uSex < 1.5) {
    // gown: high lace collar, cameo, pearls; a lace shawl edge over the shoulders
    col = mix(col, coat, sm(bodyD, 0.01));
    vec2 cq = (p - vec2(0.0, chestY + 0.02)) / vec2(R.x * 0.55, 0.05);
    float collar = max(abs(cq.x) - 1.0, abs(cq.y) - 1.0);
    float lace = 0.6 + 0.4 * sin(p.x * 420.0) * sin(p.y * 380.0 + sin(p.x * 90.0) * 2.0);
    col = mix(col, shadeN(normalize(vec3(cq.x * 0.8, 0.0, 1.0)), vec3(0.85, 0.8, 0.72), 0.1) * lace, sm(collar, 0.06));
    float cameo = (length((p - vec2(0.0, chestY - 0.07)) / vec2(0.022, 0.029)) - 1.0);
    col = mix(col, vec3(0.72, 0.55, 0.28), sm(cameo, 0.12));
    col = mix(col, vec3(0.78, 0.5, 0.42), sm(cameo + 0.3, 0.1));
    for (int i = 0; i < 11; i++) { float a = -1.3 + float(i) * 0.26; vec2 pp = vec2(sin(a) * 0.105, chestY - 0.03 - cos(a) * 0.06); float pd = length(p - pp) - 0.0075; vec3 pn = normalize(vec3((p - pp) / 0.0075, 0.6)); col = mix(col, shadeN(pn, vec3(0.92, 0.88, 0.82), 0.9), sm(pd, 0.002)); }
  } else {
    // child: sailor collar with navy stripes, a bow
    col = mix(col, coat, sm(bodyD, 0.01));
    float sailor = max(abs(p.x) - (p.y - chestY + 0.17) * 1.1, p.y - chestY - 0.01);
    float sailorIn = max(abs(p.x) - (p.y - chestY + 0.17) * 1.1 + 0.035, p.y - chestY + 0.02);
    vec3 wht = shadeN(bn, vec3(0.86, 0.84, 0.78), 0.1);
    float band = sm(sailor, 0.004) * (1.0 - sm(sailorIn, 0.004));
    col = mix(col, wht, band);
    col = mix(col, uCoat, band * smoothstep(0.004, 0.0, abs(sailor + 0.012)) );
    col = mix(col, wht, sm(max(abs(p.x) - 0.022, abs(p.y - chestY + 0.11) - 0.07), 0.004));
    vec2 bw = p - vec2(0.0, chestY - 0.03);
    float bow = min(length(bw / vec2(0.045, 0.02)) - 1.0, 1.0);
    col = mix(col, vec3(0.45, 0.06, 0.06) * (0.4 + 0.8 * bn.z), sm(bow, 0.1));
  }
  // ---------------- neck
  vec2 nq = (p - vec2(0.008, neckTop - 0.02)) / vec2(R.x * 0.5, R.y * 0.45);
  float neckD = max(abs(nq.x) * (1.0 - 0.12 * nq.y) - 1.0, abs(nq.y) - 1.0);
  vec3 skinBase = mix(vec3(0.88, 0.66, 0.53), vec3(0.82, 0.68, 0.6), uAge);
  if (uSex > 1.5) skinBase = vec3(0.95, 0.75, 0.64);
  if (uSex > 0.5 && uSex < 1.5) skinBase = vec3(0.92, 0.74, 0.65);
  vec3 neckN = normalize(vec3(nq.x * 0.9, -0.3, 1.0));
  vec3 neckCol = shadeN(neckN, skinBase * 0.8, 0.05) * (1.0 - 0.6 * smoothstep(-0.4, 0.6, nq.y));   // jaw shadow
  float showNeck = (uSex > 0.5 && uSex < 1.5) ? step(chestY + 0.05, p.y) : 1.0;
  col = mix(col, neckCol, sm(neckD, 0.12) * showNeck * smoothstep(chestY - 0.03, chestY - 0.01, p.y));

  // ---------------- ears (behind the head)
  for (int s = -1; s <= 1; s += 2) {
    vec2 eq = (q - vec2(float(s) * 0.93, -0.02)) / vec2(0.13, 0.22);
    vec3 en = normalize(vec3(eq.x * 0.6 + float(s) * 0.6, eq.y * 0.5, 1.0));
    col = mix(col, shadeN(en, skinBase * vec3(1.0, 0.9, 0.88), 0.1) * (0.85 + 0.15 * smoothstep(1.0, 0.4, length(eq))), sm(length(eq) - 1.0, 0.08) * (uSex > 0.5 && uSex < 1.5 ? 0.0 : 1.0));
  }

  // ---------------- face
  float e = 0.012;
  float h0 = relief(q);
  float hx = (relief(q + vec2(e, 0.0)) - relief(q - vec2(e, 0.0))) / (2.0 * e);
  float hy = (relief(q + vec2(0.0, e)) - relief(q - vec2(0.0, e))) / (2.0 * e);
  float zz = sqrt(max(0.0, 1.0 - dot(qe, qe)));
  vec3 n = normalize(vec3(qe.x, qe.y * 0.85, zz + 0.05) + vec3(-hx, -hy, 0.0) * 1.1);
  vec3 sb = skinBase;
  sb = mix(sb, sb * vec3(1.08, 0.82, 0.8), gs(q, vec2(-0.48, -0.25), vec2(0.22, 0.16)) * (uSex > 0.5 ? 0.55 : 0.3) + gs(q, vec2(0.48, -0.25), vec2(0.22, 0.16)) * (uSex > 0.5 ? 0.4 : 0.2));
  sb = mix(sb, sb * vec3(1.05, 0.85, 0.82), gs(q, vec2(0.0, -0.36), vec2(0.08, 0.06)) * 0.4);
  vec3 skin = shadeN(n, sb, 0.12 + 0.1 * (1.0 - uAge));
  skin *= 1.0 - 0.55 * clamp(-h0 * 7.0, 0.0, 1.0);                      // cavities (sockets, mouth corners)
  vec2 eo = uEyeOff, er = uEyeR;
  // brows
  float browA = 0.05 + (uSex > 0.5 ? -0.016 : 0.01);
  for (int s = -1; s <= 1; s += 2) {
    vec2 bq2 = q - vec2(float(s) * (eo.x + 0.02), eo.y + 0.17 + (uHat > 0.5 && s > 0 ? 0.035 : 0.0));
    bq2.y -= 0.12 * bq2.x * bq2.x * 4.0 * (uSex > 0.5 ? 1.0 : 0.4);
    float bd = length(bq2 / vec2(0.27, browA)) - 1.0;
    vec3 browCol = mix(uHair * 0.55, uHair * 0.9, uAge) * (0.8 + 0.2 * fb(q * vec2(60.0, 10.0), 2));
    skin = mix(skin, browCol * (0.35 + 0.7 * max(dot(n, normalize(LKEY)), 0.0)), sm(bd, 0.25) * 0.85);
  }
  // eyes: lid crease, upper lash line, sclera (iris drawn at runtime), lower lid
  for (int s = -1; s <= 1; s += 2) {
    vec2 c = vec2(float(s) * eo.x, eo.y);
    float crease = length((q - c - vec2(0.0, 0.055)) / (er * vec2(1.15, 1.6))) - 1.0;
    skin *= 1.0 - 0.25 * smoothstep(0.15, 0.0, abs(crease)) * step(c.y + 0.04, q.y);
    float lid = length((q - c - vec2(0.0, 0.012)) / (er * vec2(1.1, 1.3))) - 1.0;
    skin = mix(skin, vec3(0.06, 0.035, 0.03), sm(lid, 0.12) * 0.95);
    float eye = length((q - c) / er) - 1.0;
    float eyeLit = 0.28 + 0.42 * clamp(dot(n, normalize(LKEY)) + 0.3, 0.0, 1.0);
    vec3 sclera = vec3(0.84, 0.78, 0.7) * eyeLit * (1.0 - 0.3 * smoothstep(0.3, 1.0, abs((q.x - c.x) / er.x)));
    skin = mix(skin, sclera, sm(eye, 0.1));
    float under = length((q - c - vec2(0.0, -0.075)) / vec2(0.12, 0.028)) - 1.0;
    skin *= 1.0 - (0.12 + 0.25 * uAge) * sm(under, 0.5);
  }
  // lips colour + mouth line
  vec3 lipCol = (uSex > 0.5) ? vec3(0.62, 0.24, 0.22) : vec3(0.5, 0.25, 0.21);
  float lips = gs(q, vec2(0.0, -0.575), vec2(0.2, 0.033)) + gs(q, vec2(0.0, -0.645), vec2(0.16, 0.04));
  skin = mix(skin, shadeN(n, lipCol, 0.3), clamp(lips, 0.0, 1.0) * 0.8);
  float mline = abs(q.y + 0.608 + (uHat > 0.5 ? (-0.15 * q.x * q.x * 4.0 - q.x * 0.1) : 0.02 * q.x * q.x)) - 0.008;
  skin = mix(skin, vec3(0.1, 0.04, 0.035), sm(max(mline, abs(q.x) - (uHat > 0.5 ? 0.27 : 0.21)), 0.008));
  // age: forehead lines, nasolabial folds
  skin *= 1.0 - uAge * 0.18 * smoothstep(0.6, 1.0, sin(q.y * 70.0)) * smoothstep(0.3, 0.42, q.y) * smoothstep(0.7, 0.55, q.y) * smoothstep(0.6, 0.2, abs(q.x));
  for (int s = -1; s <= 1; s += 2) {
    float nl = abs(q.x - float(s) * (0.17 + (-0.4 - q.y) * 0.35)) - 0.01;
    skin *= 1.0 - (0.15 + 0.35 * uAge) * sm(nl, 0.02) * step(q.y, -0.38) * step(-0.66, q.y);
  }
  // facial hair
  if (uBeard > 0.01) {
    vec3 bcol = uHair * (0.85 + 0.3 * fb(q * vec2(40.0, 9.0), 3));
    float st = length((q - vec2(0.0, -0.5)) / vec2(0.33, 0.07)) - 1.0;
    st = min(st, length((q - vec2(0.0, -0.53)) / vec2(0.38, 0.05)) - 1.0);
    skin = mix(skin, shadeN(n, bcol, 0.15), sm(st, 0.2) * 0.95);
    if (uHat > 0.5) {
      float gt = length((q - vec2(0.02, -0.86)) / vec2(0.13, 0.15)) - 1.0;
      skin = mix(skin, shadeN(n, bcol, 0.1), sm(gt, 0.2));
    } else {
      // sideburns -> full beard with age
      float sbm = smoothstep(0.7, 0.86, abs(q.x)) * smoothstep(0.3, 0.1, q.y) * smoothstep(-0.45 - uBeard * 0.4, -0.15, q.y) * 0.8;
      float jaw = step(q.y, -0.42) * smoothstep(0.35 - 0.3 * uBeard, 0.6 - 0.3 * uBeard, length(q * vec2(0.9, 1.0) - vec2(0.0, -0.55)) + (uBeard > 0.8 ? 0.4 : 0.0));
      float bm = max(sbm, uBeard > 0.8 ? step(q.y, -0.47) * (1.0 - smoothstep(0.08, 0.0, abs(q.y + 0.61) - 0.0) * smoothstep(0.24, 0.1, abs(q.x)) * 0.0) : jaw * 0.0);
      skin = mix(skin, shadeN(n, bcol, 0.1), clamp(bm, 0.0, 1.0));
    }
  }
  // ---------------- hair (volume shell)
  vec2 hq = (q - vec2(0.0, 0.08)) / vec2(1.1, 1.04);
  if (uSex >= 0.5) hq = (q - vec2(0.0, 0.1)) / vec2(uSex > 1.5 ? 1.16 : 1.14, 1.04);
  vec3 hn3 = normalize(vec3(hq.x, hq.y, sqrt(max(0.0, 1.0 - dot(hq, hq))) + 0.1));
  float ang = uSex >= 0.5 ? atan(q.x + 0.04, 1.3 - q.y) * 2.2 : atan(q.y - 0.2, q.x);
  float strands = 0.82 + 0.1 * sin(ang * 150.0 + fb(q * 6.0, 3) * 10.0) + 0.25 * (fb(vec2(ang * 18.0, length(q) * 3.0), 4) - 0.25);
  vec3 hairCol = shadeN(hn3, uHair * strands * 1.3, 0.35);
  float hairFront = 0.0;
  if (uSex < 0.5) {
    float line = q.y - (0.5 - 0.22 * q.x * q.x - 0.2 * smoothstep(0.25, 0.6, abs(q.x)) * uAge + uAge * 0.2);
    hairFront = smoothstep(-0.03, 0.05, line) * (1.0 - smoothstep(0.55, 1.0, uAge) * smoothstep(-0.2, 0.3, 0.75 - abs(q.x) * 1.6));
    hairFront = max(hairFront, smoothstep(0.74, 0.9, abs(q.x)) * smoothstep(-0.25, 0.05, q.y) * smoothstep(0.7, 0.5, q.y) * 0.85);
    hairCol = mix(hairCol, shadeN(hn3, vec3(0.6, 0.58, 0.55) * strands, 0.3), smoothstep(0.65, 0.95, abs(q.x)) * clamp(uAge * 1.3, 0.0, 1.0));
  } else {
    float cap = q.y - (0.28 - 0.48 * q.x * q.x);
    hairFront = max(smoothstep(-0.03, 0.05, cap), smoothstep(0.6, 0.78, abs(q.x)) * step(-0.25, q.y));
    float part = smoothstep(0.025, 0.0, abs(q.x + 0.04)) * step(0.35, q.y);
    hairCol *= 1.0 - part * 0.7;
    // waves swept to the sides
    hairCol *= 0.9 + 0.14 * sin(atan(q.x + 0.04, 1.3 - q.y) * 9.0 + 0.6 * fb(q * 4.0, 3));
  }
  skin = mix(skin, hairCol, clamp(hairFront, 0.0, 1.0));
  // composite: hair shell behind/around the head, then the face
  float shellD = length(hq) - 1.0;
  float shellMask = sm(shellD, 0.04);
  if (uSex < 0.5) shellMask *= step(-0.1, q.y) * (1.0 - smoothstep(0.5, 1.0, uAge) * smoothstep(0.2, 0.7, q.y) * 0.9);
  else {
    // bun behind the crown
    vec2 bq2 = (q - vec2(0.12, 1.02)) / vec2(0.5, 0.3);
    float bunD = length(bq2) - 1.0;
    vec3 bn2 = normalize(vec3(bq2, sqrt(max(0.0, 1.0 - dot(bq2, bq2))) + 0.1));
    if (uSex < 1.5) col = mix(col, shadeN(bn2, uHair * (0.75 + 0.3 * sin(atan(bq2.y, bq2.x) * 14.0 + length(bq2) * 9.0)) * 1.2, 0.3), sm(bunD, 0.06));
    shellMask *= step(-0.4, q.y);
  }
  col = mix(col, hairCol, shellMask * (1.0 - sm(headD, 0.004)));
  col = mix(col, skin, sm(headD, 0.004));
  // full white beard for the elder: flows over chin and chest
  if (uBeard > 0.8 && uHat < 0.5) {
    vec2 bq3 = (q - vec2(0.0, -0.95)) / vec2(0.78, 0.62);
    float bd3 = max(length(bq3) - 1.0, q.y + 0.45);
    vec3 bn3 = normalize(vec3(bq3.x, bq3.y * 0.5, sqrt(max(0.0, 1.0 - dot(bq3, bq3))) + 0.2));
    float bstr = 0.85 + 0.08 * sin(q.x * 160.0 + fb(q * vec2(6.0, 2.0), 3) * 14.0) + 0.2 * (fb(q * vec2(14.0, 3.0), 4) - 0.25);
    vec3 beardCol = shadeN(bn3, uHair * bstr * 1.1, 0.2);
    col = mix(col, beardCol, sm(bd3, 0.08) * (1.0 - sm(abs(q.y + 0.61) - 0.012, 0.01) * step(abs(q.x), 0.2) * 0.8));
  }
  // top hat
  if (uHat > 0.5) {
    vec2 bq4 = (q - vec2(0.0, 0.66)) / vec2(1.55, 0.14);
    float brim = length(bq4) - 1.0;
    float crownD = max(abs(q.x) - (0.96 + (q.y - 0.7) * 0.06), abs(q.y - 1.38) - 0.68);
    float band = max(abs(q.x) - 0.99, abs(q.y - 0.84) - 0.1);
    vec3 cn2 = normalize(vec3(clamp(q.x / 0.98, -1.0, 1.0), 0.0, sqrt(max(0.0, 1.0 - q.x * q.x))));
    vec3 silk = shadeN(cn2, vec3(0.05, 0.05, 0.06), 1.4);
    col = mix(col, shadeN(normalize(vec3(bq4.x * 0.3, 1.0, 0.5)), vec3(0.04, 0.04, 0.05), 0.6), sm(brim, 0.06));
    col = mix(col, silk, sm(crownD, 0.012));
    col = mix(col, shadeN(cn2, vec3(0.32, 0.05, 0.05), 0.5), sm(band, 0.01));
  }
  // painted oval spandrel for the ladies + child
  if (uSex > 0.5 || uHat > 0.5) {
    float oval = sdEllipse((uv - 0.5) * vec2(uAspect, 1.0), vec2(0.46 * uAspect, 0.47));
    col = mix(col, uBg * 0.3, smoothstep(-0.006, 0.012, oval));
    col = mix(col, vec3(0.55, 0.4, 0.17), smoothstep(0.007, 0.0, abs(oval - 0.004)) * 0.55);
  }
  return col;
}

void surface(vec2 uv, inout Surface s) {
  vec2 b = brush(uv, 6.0, 0.004);
  b = brush(b, 26.0, 0.0012);
  vec3 col = paint(b);
  col = pow(max(col, 0.0), vec3(0.92)) * 1.25;
  float strokes = fb(rot2(fb(uv * 3.0, 2) * 3.0) * uv * vec2(80.0, 22.0), 3);
  float canvasW = (sin(uv.x * uResolution.x * 0.8) * sin(uv.y * uResolution.y * 0.8)) * 0.5 + 0.5;
  col *= 0.94 + 0.1 * strokes;
  float edge = min(min(uv.x, 1.0 - uv.x) * uAspect, min(uv.y, 1.0 - uv.y));
  col = mix(col, col * vec3(1.0, 0.86, 0.62), 0.5);       // aged varnish
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.1, edge));
  vec2 cq = uv * vec2(uAspect, 1.0) * 60.0;
  float cr = voronoiEdge(cq + vec2(fb(uv * 8.0, 3), fb(uv * 8.0 + 3.0, 3)) * 0.6, vec2(1e4), 1.0);
  float crack = (1.0 - smoothstep(0.0, 0.03, cr)) * 0.45 * smoothstep(0.4, 0.8, fb(uv * 3.0 + 7.0, 3) + 0.6);
  col *= 1.0 - crack * 0.3;
  s.albedo = col;
  s.height = 0.5 + strokes * 0.12 + canvasW * 0.04 - crack * 0.1;
  s.rough = 0.42 + crack * 0.3;
  s.metal = 0.0;
  s.ao = 1.0 - crack * 0.4;
}
`;

/** UV-space eye centres + radii for a sitter painted at `aspect` (w/h). */
export function eyeLayout(name, aspect) {
  const s = SITTERS[name];
  const R = [HEAD_R[0] * s.scale, HEAD_R[1] * s.scale];
  const rot = 0.05, c = Math.cos(-rot), sn = Math.sin(-rot);       // inverse of rot2(0.05) used on hp
  const toUV = (hx, hy) => {
    const lx = hx * R[0], ly = hy * R[1];
    // hp = rot2(0.05) * (p - C) -> p = C + rot2(-0.05) * hp
    // GLSL rot2(a) = mat2(cos, -sin, sin, cos) (column-major) => v' = (c*x + s*y, -s*x + c*y)
    const px = HEAD_C[0] + (c * lx + sn * ly);
    const py = HEAD_C[1] + (-sn * lx + c * ly);
    return [0.5 + px / aspect, 0.5 + py];
  };
  return {
    left: toUV(-EYE_OFF[0], EYE_OFF[1]),
    right: toUV(EYE_OFF[0], EYE_OFF[1]),
    radius: [(EYE_R[0] * R[0]) / aspect, EYE_R[1] * R[1]],
    iris: s.iris,
  };
}

// ---------------------------------------------------------------------------- night sky
export function nightSky(ctx) {
  return ctx.textures.generate('gallery:nightsky', {
    size: 512, aspect: 0.62, tile: false,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv;
      vec2 moon = vec2(0.62, 0.8);
      float md = length((p - moon) * vec2(0.62, 1.0));
      float cl = fbm(p * vec2(1.2, 2.2) + vec2(0.7, 0.1), vec2(3.0, 2.0), 6);
      vec3 sky = mix(vec3(0.02, 0.035, 0.09), vec3(0.18, 0.26, 0.46), smoothstep(0.1, 1.0, p.y));
      sky += vec3(0.55, 0.62, 0.85) * exp(-md * 7.0) * 1.1;
      sky = mix(sky, sky * 0.3 + vec3(0.015, 0.02, 0.035), smoothstep(-0.05, 0.35, cl) * 0.85);
      sky += vec3(0.7, 0.76, 0.9) * smoothstep(0.1, 0.0, abs(cl - 0.05)) * exp(-md * 3.5) * 0.6;
      sky = mix(sky, vec3(1.0, 0.98, 0.92) * 1.2, smoothstep(0.034, 0.028, md));
      // gnarled tree branches across the panes
      float br = 1.0;
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        vec2 o = vec2(-0.05, 0.25 + fi * 0.09);
        vec2 d = rot2(-0.35 - 0.3 * sin(fi * 2.3)) * (p - o);
        float wig = 0.015 * sin(d.x * 25.0 + fi) + 0.008 * sin(d.x * 61.0);
        br = min(br, max(abs(d.y + wig) - 0.006 * (1.3 - d.x * 1.5), -d.x));
        br = max(br, d.x - 0.5 - 0.1 * sin(fi * 5.0));
        // twigs
        vec2 tw = rot2(0.8) * (d - vec2(0.25 + 0.05 * fi, 0.0));
        br = min(br, max(max(abs(tw.y + 0.01 * sin(tw.x * 40.0)) - 0.0025, -tw.x), tw.x - 0.12));
      }
      float trunk = abs(p.x + 0.02 - 0.03 * sin(p.y * 7.0)) - 0.05;
      float hill = p.y - (0.1 + 0.04 * fbm(vec2(p.x * 2.0, 0.0), vec2(2.0, 1.0), 4));
      // distant spire
      float spire = max(abs(p.x - 0.82) - 0.012 * (1.0 - (p.y - 0.1) * 3.0), p.y - 0.42);
      vec3 col = sky;
      col = mix(col, vec3(0.006, 0.008, 0.015), smoothstep(0.003, -0.003, min(min(br, trunk), min(hill, spire))));
      s.albedo = col;
      s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
    }`,
  });
}

// ---------------------------------------------------------------------------- clock dial
export function clockFace(ctx) {
  return ctx.textures.canvas('gallery:clockface', 512, 512, (g, w, h) => {
    g.fillStyle = '#d9cfb4'; g.fillRect(0, 0, w, h);
    const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.55);
    grd.addColorStop(0, 'rgba(255,250,235,0.0)'); grd.addColorStop(1, 'rgba(90,70,40,0.55)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.translate(w / 2, h / 2);
    g.strokeStyle = '#1b1510'; g.fillStyle = '#1b1510';
    g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 236, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 180, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(0, 0, 150, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      g.lineWidth = i % 5 === 0 ? 5 : 1.5;
      g.beginPath(); g.moveTo(Math.sin(a) * 222, -Math.cos(a) * 222); g.lineTo(Math.sin(a) * (i % 5 === 0 ? 200 : 212), -Math.cos(a) * (i % 5 === 0 ? 200 : 212)); g.stroke();
    }
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    g.font = 'bold 38px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    R.forEach((r, i) => {
      const a = (i / 12) * Math.PI * 2;
      g.save(); g.translate(Math.sin(a) * 165, -Math.cos(a) * 165); g.rotate(a); g.fillText(r, 0, 0); g.restore();
    });
    // hands stopped at 11:55 (an hour that never comes)
    const hand = (a, len, wdt) => { g.save(); g.rotate(a); g.beginPath(); g.moveTo(-wdt, 20); g.lineTo(0, -len); g.lineTo(wdt, 20); g.closePath(); g.fill(); g.restore(); };
    hand((11 + 55 / 60) / 12 * Math.PI * 2, 110, 9);
    hand((55 / 60) * Math.PI * 2, 170, 6);
    g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
    g.font = 'italic 20px Georgia, serif'; g.fillText('Stauf · Fecit', 0, 70);
  }, { tile: false });
}

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
