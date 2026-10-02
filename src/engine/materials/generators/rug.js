// Persian / oriental rug with central medallion, spandrels, herati field,
// main border with rosettes + meandering vine, guard stripes, knot quantisation,
// abrash dye banding, pile + wear. NOT tileable: one texture = one rug.
// UV: u across the width, v along the length. `aspect` = width/length.

export const RUG_PALETTES = {
  heriz:   { field: [0.42, 0.06, 0.05], border: [0.06, 0.08, 0.2], ivory: [0.86, 0.79, 0.64], gold: [0.78, 0.55, 0.22], teal: [0.12, 0.32, 0.34], dark: [0.05, 0.035, 0.04], rose: [0.7, 0.32, 0.28] },
  tabriz:  { field: [0.08, 0.1, 0.24], border: [0.38, 0.06, 0.06], ivory: [0.85, 0.78, 0.62], gold: [0.74, 0.52, 0.2], teal: [0.15, 0.36, 0.38], dark: [0.04, 0.035, 0.045], rose: [0.66, 0.3, 0.3] },
  kashan:  { field: [0.34, 0.05, 0.07], border: [0.08, 0.07, 0.16], ivory: [0.82, 0.74, 0.58], gold: [0.68, 0.48, 0.2], teal: [0.18, 0.3, 0.4], dark: [0.04, 0.03, 0.04], rose: [0.6, 0.22, 0.25] },
  faded:   { field: [0.5, 0.17, 0.14], border: [0.16, 0.18, 0.28], ivory: [0.8, 0.74, 0.62], gold: [0.7, 0.55, 0.32], teal: [0.25, 0.38, 0.38], dark: [0.12, 0.09, 0.09], rose: [0.68, 0.42, 0.36] },
};

export function rug({
  palette = 'heriz',
  colors = null,          // override palette entries
  aspect = 0.66,          // width / length
  knots = 220,            // knots across the width
  wear = 0.35,
  fringe = 0.0,           // fringe length as a fraction of rug length at each end (alpha-cut)
  seed = 3,
  size,
} = {}) {
  const pal = { ...(RUG_PALETTES[palette] || RUG_PALETTES.heriz), ...(colors || {}) };
  return {
    key: `rug:${palette}:${JSON.stringify(colors)}:${aspect}:${knots}:${wear}:${fringe}:${seed}`,
    size,
    aspect,
    tile: false,
    seed,
    normalStrength: 0.8,
    uniforms: {
      cField: pal.field, cBorder: pal.border, cIvory: pal.ivory, cGold: pal.gold, cTeal: pal.teal, cDark: pal.dark, cRose: pal.rose,
      uKnots: knots, uWear: wear, uFringe: fringe,
    },
    glsl: /* glsl */ `
float bodyAspect() { return uAspect / (1.0 - 2.0 * uFringe); }
// palette index -> colour
vec3 pal(int i) {
  if (i == 0) return cField;
  if (i == 1) return cBorder;
  if (i == 2) return cIvory;
  if (i == 3) return cGold;
  if (i == 4) return cTeal;
  if (i == 5) return cDark;
  return cRose;
}
float leafS(vec2 p, vec2 c, float a, float l, float w) { p = rot2(a) * (p - c); return sdVesica(p, l, l - w); }

// small rosette: returns colour index or -1 via out
int rosette(vec2 p, float r, int petalC, int centreC, int ringC, inout float edge) {
  float d = length(p);
  vec2 q = polarRep(p, 8.0);
  float petal = sdVesica(rot2(PI * 0.5) * (q - vec2(r * 0.55, 0.0)), r * 0.5, r * 0.32);
  float centre = d - r * 0.25;
  float ring = abs(d - r * 0.38) - r * 0.05;
  edge = min(edge, min(abs(petal), abs(centre)));
  if (centre < 0.0) return centreC;
  if (ring < 0.0) return ringC;
  if (petal < 0.0) return petalC;
  return -1;
}

// herati motif cell (diamond + 4 curved leaves + central rosette), p in [-0.5,0.5]
int herati(vec2 p, inout float edge) {
  vec2 a = abs(p);
  float dia = sdRhombus(p, vec2(0.28, 0.28));
  float diaLine = abs(dia) - 0.018;
  // curved leaves pointing to corners
  vec2 lq = vec2(max(a.x, a.y), min(a.x, a.y));
  float lf = leafS(a, vec2(0.33, 0.33), -PI * 0.25, 0.17, 0.06);
  float ros = length(p) - 0.09;
  float dots = length(a - vec2(0.0, 0.42)) - 0.035;
  dots = min(dots, length(a - vec2(0.42, 0.0)) - 0.035);
  edge = min(edge, min(abs(diaLine), abs(lf)));
  if (ros < 0.0) return length(p) < 0.04 ? 3 : 2;
  if (diaLine < 0.0) return 1;
  if (lf < 0.0) return 4;
  if (dots < 0.0) return 3;
  if (dia < 0.0) return length(p) < 0.17 && length(p) > 0.12 ? 6 : 0;
  return 0;
}

// central medallion, p in field units (y along rug length)
int medallion(vec2 p, float R, inout float edge) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float lobes = R * (1.0 + 0.09 * cos(a * 16.0)) * (1.0 + 0.05 * cos(a * 4.0));
  float outer = r - lobes;
  // pendants (finials) along the long axis
  vec2 pp = vec2(p.x, abs(p.y) - R * 1.32);
  float pend = sdRhombus(pp, vec2(R * 0.18, R * 0.3));
  float pendStem = sdBox(vec2(p.x, abs(p.y) - R * 1.06), vec2(R * 0.035, R * 0.12));
  float pendIn = sdRhombus(pp, vec2(R * 0.09, R * 0.16));
  edge = min(edge, min(abs(outer), abs(pend)));
  if (pendIn < 0.0) return 3;
  if (pend < 0.0) return abs(pend) < R * 0.025 ? 2 : 1;
  if (pendStem < 0.0) return 2;
  if (outer > 0.0) return -1;
  if (outer > -R * 0.035) return 2;           // ivory outline
  // inner rings
  float ringStar = sdStar(rot2(PI / 16.0) * p, R * 0.62, 16.0, 5.0);
  float ring2 = r - R * 0.36;
  float ring3 = r - R * 0.16;
  edge = min(edge, min(abs(ringStar), abs(ring2)));
  if (ring3 < 0.0) {
    float e2 = 1.0;
    int c = rosette(p, R * 0.16, 6, 3, 2, e2);
    edge = min(edge, e2);
    return c < 0 ? 5 : c;
  }
  if (ring2 < 0.0) {
    vec2 q = polarRep(p, 8.0);
    float lf = sdVesica(rot2(PI * 0.5) * (q - vec2(R * 0.26, 0.0)), R * 0.09, R * 0.06);
    edge = min(edge, abs(lf));
    return lf < 0.0 ? 3 : 4;
  }
  if (abs(ringStar) < R * 0.02) return 2;
  if (ringStar < 0.0) {
    vec2 q = polarRep(p, 16.0);
    float bud = length(q - vec2(R * 0.48, 0.0)) - R * 0.04;
    float vine = abs(length(p) - R * 0.5 + 0.02 * R * sin(a * 32.0)) - R * 0.01;
    edge = min(edge, abs(bud));
    if (bud < 0.0) return 6;
    if (vine < 0.0) return 3;
    return 1;
  }
  // between star and lobed outline: field of the medallion
  vec2 q = polarRep(p, 16.0);
  float lf2 = sdVesica(rot2(PI * 0.5) * (q - vec2(R * 0.8, 0.0)), R * 0.11, R * 0.075);
  float dot2 = length(q - vec2(R * 0.66, 0.0)) - R * 0.025;
  edge = min(edge, abs(lf2));
  if (dot2 < 0.0) return 2;
  if (lf2 < 0.0) return abs(lf2) < R * 0.02 ? 2 : 6;
  return 3;
}

// border band motif; s = coordinate along the band, c = across (0..1)
int borderMotif(float s, float c, float period, inout float edge) {
  float m = mod(s, period) - period * 0.5;
  float k = floor(s / period);
  vec2 p = vec2(m / period, c - 0.5);   // p.x in [-0.5,0.5], p.y in [-0.5,0.5]
  // meandering vine
  float vine = abs(p.y - 0.28 * sin(TAU * (s / period) * 1.0)) - 0.035;
  // rosettes alternate with palmettes
  int col = -1;
  float e = 1.0;
  if (mod(k, 2.0) < 1.0) {
    col = rosette(p * vec2(1.0, 1.0), 0.36, 6, 3, 2, e);
  } else {
    vec2 q = p;
    q.x = abs(q.x);
    float palm = sdVesica(q - vec2(0.0, 0.0), 0.33, 0.2);
    float lf = leafS(q, vec2(0.18, 0.12), -0.9, 0.16, 0.07);
    e = min(abs(palm), abs(lf));
    if (palm < 0.0) col = abs(palm) < 0.05 ? 2 : 4;
    else if (lf < 0.0) col = 3;
  }
  edge = min(edge, e * period);
  if (col >= 0) return col;
  if (vine < 0.0) return 3;
  // small leaf buds along the vine
  float bud = length(vec2(p.x - 0.25, p.y - 0.28 * sin(TAU * (k + 0.75)))) - 0.06;
  if (bud < 0.0) return 6;
  return 1;
}

int guardStripe(float s, float c, inout float edge) {
  // reciprocal "running dog" / trefoil stripe
  float m = fract(s / 0.03) - 0.5;
  float d = abs(c - 0.5 - 0.3 * sign(m) * (abs(m) - 0.25));
  edge = min(edge, d * 0.03);
  if (d < 0.18) return 6;
  float dot1 = length(vec2(m * 1.0, (c - 0.5))) - 0.15;
  return dot1 < 0.0 ? 2 : 5;
}

void design(vec2 uv, out int ci, out float edge) {
  // body coordinates: x in [-A, A], y in [-1, 1]
  float A = bodyAspect();
  vec2 p = (uv - 0.5) * 2.0 * vec2(A, 1.0);
  float ex = A - abs(p.x);
  float ey = 1.0 - abs(p.y);
  float e = min(ex, ey);                 // distance from rug edge (in half-length units)
  edge = 1.0;
  // band layout (in half-length units)
  float b0 = 0.018, b1 = 0.05, b2 = 0.062, b3 = 0.2, b4 = 0.212, b5 = 0.245, b6 = 0.255;
  bool side = ex < ey;                   // closer to long side?
  float s = side ? p.y : p.x;            // along band
  if (e < b0) { ci = 5; return; }        // selvage
  if (e < b1) { ci = guardStripe(s, (e - b0) / (b1 - b0), edge); return; }
  if (e < b2) { ci = 2; return; }
  if (e < b3) {
    float c = (e - b2) / (b3 - b2);
    // corner squares
    if (ex < b3 && ey < b3) {
      vec2 cp = vec2(ex, ey) - vec2((b2 + b3) * 0.5);
      float er = 1.0;
      int rc = rosette(cp, (b3 - b2) * 0.42, 6, 3, 2, er);
      edge = min(edge, er);
      ci = rc < 0 ? 1 : rc; return;
    }
    float L = side ? 1.0 - b3 : A - b3;
    float period = (2.0 * L) / floor(2.0 * L / 0.14);
    ci = borderMotif(s + L, c, period, edge); return;
  }
  if (e < b4) { ci = 2; return; }
  if (e < b5) { ci = guardStripe(s * 1.0 + 0.5, (e - b4) / (b5 - b4), edge); ci = ci == 6 ? 3 : ci; return; }
  if (e < b6) { ci = 5; return; }

  // ---- field
  vec2 f = p;
  vec2 fa = abs(f);
  float FA = A - b6, FL = 1.0 - b6;
  // spandrels (corner quarter-medallions)
  vec2 cq = vec2(FA, FL) - fa;
  float spR = min(FA, FL) * 0.55;
  float spand = length(cq * vec2(1.0, 0.85)) - spR * (1.0 + 0.07 * cos(atan(cq.y, cq.x) * 12.0));
  float spLine = abs(spand) - 0.012;
  // medallion
  float er = 1.0;
  int mc = medallion(f, min(FA, FL) * 0.62, er);
  if (mc >= 0) { ci = mc; edge = er; return; }
  if (spLine < 0.0) { ci = 2; return; }
  if (spand < 0.0) {
    // spandrel interior: navy with herati-lite
    vec2 h = fract(f * 7.0) - 0.5;
    float e2 = 1.0;
    int hc = herati(h, e2);
    edge = min(edge, e2 / 7.0);
    ci = hc == 0 ? 1 : (hc == 1 ? 6 : hc); return;
  }
  // herati all-over field, mirrored about the centre
  vec2 h = fract(fa * 5.0 + 0.5) - 0.5;
  float e2 = 1.0;
  int hc = herati(h, e2);
  edge = min(edge, e2 / 5.0);
  ci = hc;
}

void surface(vec2 uv, inout Surface s) {
  // fringe zones at both ends
  float body = 1.0 - 2.0 * uFringe;
  float vy = (uv.y - uFringe) / body;
  if (vy < 0.0 || vy > 1.0) {
    float x = uv.x * uKnots * 0.5;
    float strand = smoothstep(0.42, 0.18, abs(fract(x) - 0.5));
    float lenN = hash11(floor(x) * 1.7) * 0.25;
    float t = vy < 0.0 ? -vy : vy - 1.0;
    float frLen = uFringe / body;
    float alive = step(t, frLen * (0.8 + lenN));
    s.albedo = vec3(0.82, 0.77, 0.66) * (0.8 + 0.2 * strand);
    s.alpha = strand * alive;
    s.height = strand * 0.6;
    s.rough = 0.95; s.ao = 0.8;
    return;
  }
  vec2 ruv = vec2(uv.x, vy);
  // knot grid quantisation
  vec2 grid = vec2(uKnots, uKnots / bodyAspect());
  vec2 cell = floor(ruv * grid);
  vec2 kuv = (cell + 0.5) / grid;
  // slight hand-knotted irregularity in rows
  kuv.x += (hash11(cell.y * 0.37) - 0.5) * 0.4 / grid.x;
  int ci; float edge;
  design(kuv, ci, edge);
  vec3 col = pal(ci);
  // abrash: horizontal dye-lot bands
  float abrash = fbm(vec2(0.0, ruv.y), vec2(1.0, 9.0), 3);
  col *= 1.0 + abrash * 0.09 * (ci == 0 || ci == 1 ? 1.0 : 0.4);
  // per-knot variation and pile
  float kn = hash12(cell + uSeed);
  col *= 0.9 + 0.2 * kn;
  vec2 inK = fract(ruv * grid) - 0.5;
  float tuft = 1.0 - dot(inK, inK) * 1.6;
  float pileN = fbm(ruv, vec2(40.0, 60.0), 4) * 0.5 + 0.5;
  // wear: low-pile patches show the ivory warp/weft grid
  float wearN = fbm(ruv + uSeed, vec2(3.0, 4.0), 5) * 0.5 + 0.5;
  float centreWear = 1.0 - smoothstep(0.0, 0.9, length((ruv - 0.5) * vec2(1.0, 1.6)));
  float w = smoothstep(0.55, 0.85, wearN + centreWear * 0.25) * uWear;
  vec2 weave = abs(fract(ruv * grid * 2.0) - 0.5);
  float warp = smoothstep(0.35, 0.5, max(weave.x, weave.y));
  vec3 worn = mix(col * 0.8 + vec3(0.05), vec3(0.62, 0.56, 0.46), warp * 0.6);
  col = mix(col, worn, w * 0.75);
  // fade sun-bleached edge a hair
  col = mix(col, col * 0.9 + 0.03, smoothstep(0.08, 0.0, min(min(ruv.x, 1.0 - ruv.x) * bodyAspect(), min(ruv.y, 1.0 - ruv.y))) * 0.4);
  // fine dirt
  col *= 0.94 + 0.06 * pileN;
  s.albedo = col;
  s.alpha = 1.0;
  s.height = 0.45 + 0.25 * tuft * (1.0 - w * 0.7) + 0.15 * pileN - 0.15 * smoothstep(0.004, 0.0, edge);
  s.rough = 0.92 - 0.06 * kn;
  s.metal = 0.0;
  s.ao = 0.75 + 0.25 * tuft;
}
`,
  };
}
