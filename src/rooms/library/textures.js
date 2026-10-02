// Library-specific procedural textures (GPU-generated via TextureForge + a few canvases).
import * as THREE from 'three';

// ------------------------------------------------------------------ book atlas
// 8 x 2 variant cells. Inside each cell (local u): spine [0, .6], cover [.6, .8], page block [.8, 1].
export const BOOK_ATLAS = { cols: 8, rows: 2, spine: [0, 0.6], cover: [0.6, 0.8], pages: [0.8, 1.0] };

export function bookAtlas(ctx) {
  return ctx.textures.generate('library:bookatlas:v3', {
    size: 2048, aspect: 2.0, tile: false, normalStrength: 1.6,
    glsl: /* glsl */ `
vec3 leatherCol(float k) {
  int i = int(floor(k * 8.0));
  if (i == 0) return vec3(0.40, 0.07, 0.05);   // oxblood
  if (i == 1) return vec3(0.10, 0.20, 0.12);   // bottle green
  if (i == 2) return vec3(0.33, 0.19, 0.09);   // tan calf
  if (i == 3) return vec3(0.09, 0.11, 0.24);   // navy
  if (i == 4) return vec3(0.48, 0.32, 0.17);   // vellum-ish brown
  if (i == 5) return vec3(0.17, 0.06, 0.045);  // dark chocolate
  if (i == 6) return vec3(0.27, 0.05, 0.10);   // claret
  return vec3(0.20, 0.16, 0.11);               // faded umber
}
void surface(vec2 uv, inout Surface s) {
  vec2 g = uv * vec2(8.0, 2.0);
  vec2 cell = floor(g);
  vec2 f = fract(g);
  float id = cell.x + cell.y * 8.0;
  float r1 = hash11(id * 3.17 + 1.0), r2 = hash11(id * 7.31 + 2.0), r3 = hash11(id * 1.93 + 5.0);
  vec3 base = leatherCol(fract(id * 0.618 + 0.05));
  float grain = fbm(uv * vec2(1.0, 2.0) + id, vec2(48.0, 24.0), 4) * 0.5 + 0.5;
  float scuff = smoothstep(0.62, 0.9, fbm(uv + id * 0.3, vec2(10.0, 5.0), 4) * 0.5 + 0.5);
  vec3 gilt = vec3(0.78, 0.6, 0.3);
  vec3 col; float h = 0.5; float rough = 0.6; float metal = 0.0; float ao = 1.0;
  if (f.x < 0.6) {
    // ---- spine
    float u = f.x / 0.6, v = f.y;
    float round = sin(u * PI);
    col = base * (0.75 + 0.4 * grain);
    col = mix(col, col * 1.5 + 0.04, scuff * 0.35);
    // head/tail caps worn
    float edge = smoothstep(0.0, 0.03, v) * smoothstep(1.0, 0.97, v);
    col *= mix(0.55, 1.0, edge);
    // raised bands (style depends on cell)
    float nb = r1 > 0.5 ? 5.0 : 4.0;
    float by = fract(v * nb + 0.5);
    float band = smoothstep(0.0, 0.05, by) * smoothstep(0.12, 0.07, by) * step(0.15, v) * step(v, 0.9);
    float hasBands = step(0.25, r2);
    float giltRule = (stroke(by - 0.02, 0.0, 0.006) + stroke(by - 0.15, 0.0, 0.006)) * step(0.15, v) * step(v, 0.9);
    // title label
    float lab = step(0.66, v) * step(v, 0.78) * step(0.16, u) * step(u, 0.84);
    vec3 labCol = r3 > 0.5 ? vec3(0.07, 0.045, 0.035) : vec3(0.36, 0.06, 0.04);
    float letters = step(0.55, hash12(floor(vec2(u * 9.0, v * 90.0)) + id * 13.0)) * step(0.69, v) * step(v, 0.75) * step(0.24, u) * step(u, 0.76);
    // small gilt fleurons between bands
    vec2 fp = vec2((u - 0.5) * 3.0, (fract(v * nb) - 0.55) * nb * 1.6);
    float fleur = step(length(fp), 0.18) * hasBands * step(0.2, v) * step(v, 0.62) * step(0.4, r3);
    col = mix(col, labCol, lab);
    float gm = clamp((giltRule * 0.9 + band * 0.35) * hasBands + letters + fleur, 0.0, 1.0);
    gm *= 0.75 + 0.25 * grain;
    col = mix(col, gilt * (0.7 + 0.4 * grain), gm);
    col *= 0.55 + 0.45 * round;
    h = 0.3 + 0.45 * round + band * hasBands * 0.25 + lab * 0.04 + grain * 0.03;
    rough = mix(0.55 + scuff * 0.25, 0.32, gm);
    metal = gm * 0.9;
    ao = mix(0.6, 1.0, round);
  } else if (f.x < 0.8) {
    // ---- cover boards (marbled paper on some)
    col = base * (0.7 + 0.35 * grain);
    float marb = step(0.55, r2);
    float m = fbm(vec2(f.x * 3.0, f.y) + fbm(uv * 3.0 + id, vec2(4.0, 4.0), 3), vec2(6.0, 6.0), 4);
    vec3 paper = mix(vec3(0.15, 0.12, 0.2), vec3(0.45, 0.3, 0.18), m * 0.5 + 0.5);
    col = mix(col, paper, marb * step(0.18, (f.x - 0.6) / 0.2) * step(0.12, f.y) * step(f.y, 0.88));
    h = 0.5 + grain * 0.05; rough = 0.65;
  } else {
    // ---- page block (foxed, uneven)
    float u = (f.x - 0.8) / 0.2;
    float lines = 0.85 + 0.15 * vnoise(vec2(u * 400.0, f.y * 4.0), vec2(400.0, 4.0));
    col = vec3(0.70, 0.62, 0.47) * lines;
    col = mix(col, vec3(0.45, 0.33, 0.2), smoothstep(0.55, 0.85, fbm(uv * 2.0 + id, vec2(6.0), 3) * 0.5 + 0.5) * 0.5);
    // gilt top edge on some books
    col = mix(col, gilt * 0.8, step(0.7, r1) * 0.7);
    h = 0.45 + 0.05 * lines; rough = 0.85; metal = step(0.7, r1) * 0.5;
  }
  s.albedo = col; s.height = h; s.rough = rough; s.metal = metal; s.ao = ao;
}`,
  });
}

// ------------------------------------------------------------------ antique globe (equirect)
export function globeMap(ctx) {
  return ctx.textures.generate('library:globe:v2', {
    size: 2048, aspect: 2.0, tile: true, normalStrength: 0.6,
    glsl: /* glsl */ `
float landField(vec2 uv) {
  // fictional continents: low-frequency fbm with a few seeded masses
  float n = fbm(uv + vec2(0.13, 0.4), vec2(4.0, 2.0), 6);
  float lat = (uv.y - 0.5) * PI;
  n += 0.25 * cos(lat * 2.0) - 0.08;
  n += 0.22 * exp(-pow(length((uv - vec2(0.3, 0.62)) * vec2(1.0, 1.6)) / 0.16, 2.0));
  n += 0.2 * exp(-pow(length((uv - vec2(0.62, 0.55)) * vec2(1.0, 1.4)) / 0.2, 2.0));
  n += 0.16 * exp(-pow(length((uv - vec2(0.83, 0.33)) * vec2(1.0, 1.8)) / 0.12, 2.0));
  n -= 0.3 * smoothstep(0.12, 0.0, uv.y);   // southern ocean
  return n;
}
void surface(vec2 uv, inout Surface s) {
  float L = landField(uv);
  float land = smoothstep(0.1, 0.115, L);
  float coast = stroke(L - 0.11, 0.0, 0.004);
  float hatch = stroke(L - 0.08, 0.0, 0.0025) * 0.6 + stroke(L - 0.05, 0.0, 0.002) * 0.35; // ocean contour lines (old maps)
  vec3 ocean = vec3(0.78, 0.70, 0.52);
  vec3 earth = mix(vec3(0.66, 0.52, 0.30), vec3(0.55, 0.47, 0.30), fbm(uv, vec2(16.0, 8.0), 4) * 0.5 + 0.5);
  earth = mix(earth, vec3(0.5, 0.3, 0.2), smoothstep(0.25, 0.4, L) * 0.5);     // highlands
  // mountains as tiny strokes
  float mnt = smoothstep(0.32, 0.36, L) * step(0.6, hash12(floor(uv * vec2(400.0, 200.0))));
  vec3 col = mix(ocean, earth, land);
  col = mix(col, vec3(0.25, 0.16, 0.08), coast * 0.9 + mnt * 0.5);
  col = mix(col, vec3(0.45, 0.36, 0.22), hatch * (1.0 - land));
  // graticule
  float lon = abs(fract(uv.x * 24.0 + 0.5) - 0.5) / 24.0;
  float lat = abs(fract(uv.y * 12.0 + 0.5) - 0.5) / 12.0;
  float grid = max(1.0 - smoothstep(0.0, 0.0009, lon), 1.0 - smoothstep(0.0, 0.0012, lat));
  float equator = 1.0 - smoothstep(0.0, 0.0018, abs(uv.y - 0.5));
  float tropic = 1.0 - smoothstep(0.0, 0.0012, min(abs(uv.y - 0.5 - 0.13), abs(uv.y - 0.5 + 0.13)));
  col = mix(col, vec3(0.35, 0.22, 0.12), grid * 0.45 + equator * 0.6 + tropic * 0.3);
  // compass rose + cartouche in the ocean
  vec2 rp = (uv - vec2(0.47, 0.32)) * vec2(2.0, 1.0) * 9.0;
  float rose = sdStar(rp, 1.0, 8.0, 3.0);
  col = mix(col, vec3(0.42, 0.18, 0.1), fill(rose, 0.02) * 0.7);
  col = mix(col, vec3(0.3, 0.2, 0.1), stroke(length(rp) - 1.15, 0.0, 0.03) * 0.8);
  vec2 cp = (uv - vec2(0.16, 0.3)) * vec2(2.0, 1.0);
  float cart = sdRoundBox(cp, vec2(0.07, 0.04), 0.012);
  col = mix(col, vec3(0.86, 0.8, 0.64), fill(cart, 0.002));
  col = mix(col, vec3(0.32, 0.2, 0.1), stroke(cart, 0.0, 0.0025));
  col = mix(col, vec3(0.3, 0.18, 0.1), step(0.6, hash12(floor(cp * vec2(220.0, 140.0)))) * fill(sdBox(cp, vec2(0.05, 0.006)), 0.001));
  // age: varnish yellowing, foxing, darker toward the poles, rubbed equator
  float fox = smoothstep(0.7, 0.85, fbm(uv + 3.0, vec2(24.0, 12.0), 4) * 0.5 + 0.5);
  col *= mix(vec3(1.0), vec3(0.75, 0.6, 0.42), fox * 0.6);
  col *= 0.75 + 0.25 * sin(uv.y * PI);
  col = mix(col, col * vec3(1.0, 0.86, 0.62), 0.35);
  float crack = smoothstep(0.02, 0.0, abs(fbm(uv * 1.0 + 9.0, vec2(30.0, 15.0), 3))) * 0.25;
  col *= 1.0 - crack;
  s.albedo = col;
  s.height = 0.5 + land * 0.04 - crack * 0.2 + mnt * 0.05;
  s.rough = 0.38 + fox * 0.2;
  s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

// ------------------------------------------------------------------ leaded skylight glass
export function skylightMap(ctx) {
  return ctx.textures.generate('library:skylight:v2', {
    size: 512, tile: true, normalStrength: 0.5,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  // diamond quarries, 4 x 4 per tile
  vec2 p = uv * 4.0;
  vec2 q = vec2(p.x + p.y, p.x - p.y);
  vec2 fq = fract(q);
  float e = min(min(fq.x, 1.0 - fq.x), min(fq.y, 1.0 - fq.y));
  float lead = 1.0 - smoothstep(0.03, 0.05, e);
  vec2 id = floor(q);
  float tint = hash12(id + 2.0);
  float bubble = vnoise(uv * 120.0, vec2(120.0)) * 0.15;
  float wav = fbm(uv + id * 0.1, vec2(6.0), 3) * 0.5 + 0.5;
  vec3 glass = mix(vec3(0.55, 0.66, 0.85), vec3(0.75, 0.82, 0.95), tint) * (0.75 + 0.35 * wav - bubble);
  // grime in the corners of each pane
  glass *= 0.75 + 0.25 * smoothstep(0.0, 0.2, e);
  vec3 col = mix(glass, vec3(0.02, 0.02, 0.025), lead);
  s.albedo = col; s.height = 1.0 - lead; s.rough = 0.2; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

// ------------------------------------------------------------------ wing-chair tapestry
export function tapestryMap(ctx) {
  return ctx.textures.generate('library:tapestry:v3', {
    size: 1024, tile: true, normalStrength: 1.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  // a blurry, ikat-like medallion pattern in rust, black and ochre (cut velvet look)
  vec2 p = uv * 2.0;
  vec2 c = fract(p) - 0.5;
  vec2 id = floor(p);
  vec2 q = c; q.x += 0.035 * sin(uv.y * 90.0) + 0.02 * fbm(uv * 4.0, vec2(8.0), 3);   // ikat bleed
  float med = sdRhombus(q, vec2(0.36, 0.44));
  float inner = sdRhombus(q, vec2(0.2, 0.26));
  float dots = length(fract(q * 6.0) - 0.5) - 0.18;
  float stripes = sin(q.y * 70.0 + sin(q.x * 18.0) * 2.0);
  vec3 rust = vec3(0.36, 0.1, 0.05), black = vec3(0.04, 0.025, 0.02), ochre = vec3(0.42, 0.24, 0.09), wine = vec3(0.2, 0.045, 0.035);
  vec3 col = wine;
  col = mix(col, black, smoothstep(0.02, -0.02, med));
  col = mix(col, rust, smoothstep(0.02, -0.02, med + 0.06) * (0.6 + 0.4 * stripes));
  col = mix(col, ochre, smoothstep(0.02, -0.02, inner) * 0.8);
  col = mix(col, black, smoothstep(0.03, -0.03, inner + 0.08));
  col = mix(col, ochre * 0.8, smoothstep(0.05, -0.05, dots) * smoothstep(-0.02, 0.05, med) * 0.4);
  float pile = vnoise(uv * vec2(300.0, 300.0), vec2(300.0));
  float wear = smoothstep(0.55, 0.85, fbm(uv, vec2(3.0), 4) * 0.5 + 0.5);
  col *= 0.8 + 0.3 * pile;
  col = mix(col, col * 0.6 + vec3(0.08, 0.06, 0.05), wear * 0.5);
  s.albedo = col;
  s.height = 0.5 + 0.2 * pile - smoothstep(0.02, -0.02, med) * 0.1;
  s.rough = 0.85; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

// ------------------------------------------------------------------ letter atlas (brass prisms of the frieze)
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
export function letterAtlas(ctx) {
  const cols = 8, rows = 4, cell = 192;
  return ctx.textures.canvas('library:letters:v2', cols * cell, rows * cell, (g, w, h) => {
    for (let i = 0; i < LETTERS.length; i++) {
      const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
      // tarnished brass tile
      const grd = g.createLinearGradient(x, y, x + cell, y + cell);
      grd.addColorStop(0, '#b08a45'); grd.addColorStop(0.5, '#8a6a32'); grd.addColorStop(1, '#5c4520');
      g.fillStyle = grd; g.fillRect(x, y, cell, cell);
      // bevel
      g.strokeStyle = 'rgba(255,230,170,0.5)'; g.lineWidth = 6; g.strokeRect(x + 6, y + 6, cell - 12, cell - 12);
      g.strokeStyle = 'rgba(40,25,10,0.7)'; g.lineWidth = 3; g.strokeRect(x + 12, y + 12, cell - 24, cell - 24);
      // grime speckle (deterministic)
      for (let k = 0; k < 220; k++) {
        const a = Math.sin(i * 91.7 + k * 12.9898) * 43758.5453, b = Math.sin(i * 17.3 + k * 78.233) * 12345.678;
        const px = x + (a - Math.floor(a)) * cell, py = y + (b - Math.floor(b)) * cell;
        g.fillStyle = `rgba(30,20,8,${0.08 + 0.12 * ((a * 7) % 1 + 1) % 1})`; g.fillRect(px, py, 3, 3);
      }
      const ch = LETTERS[i];
      if (ch !== ' ') {
        g.font = `700 ${Math.round(cell * 0.66)}px Cinzel, "Times New Roman", serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(255,236,190,0.55)'; g.fillText(ch, x + cell / 2 + 2, y + cell / 2 + 6);
        g.fillStyle = '#1a1006'; g.fillText(ch, x + cell / 2, y + cell / 2 + 4);
      }
    }
  }, { tile: false });
}
export function letterUV(ch) {
  const i = Math.max(0, LETTERS.indexOf(ch));
  const cols = 8, rows = 4;
  const u0 = (i % cols) / cols, v0 = Math.floor(i / cols) / rows;
  return [u0, v0, u0 + 1 / cols, v0 + 1 / rows];
}

// ------------------------------------------------------------------ Stauf's card (riddle)
export function riddleCard(ctx, lines) {
  return ctx.textures.canvas('library:riddle:v2', 768, 512, (g, w, h) => {
    g.fillStyle = '#d9c9a3'; g.fillRect(0, 0, w, h);
    const grd = g.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(90,55,20,0.55)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5a3a18'; g.lineWidth = 4; g.strokeRect(22, 22, w - 44, h - 44);
    g.fillStyle = '#2a1a0c'; g.textAlign = 'center';
    g.font = 'italic 34px "IM Fell English", "Times New Roman", serif';
    lines.forEach((l, i) => g.fillText(l, w / 2, 110 + i * 62));
    g.font = '28px "IM Fell English SC", serif';
    g.fillText('— H. S.', w * 0.72, h - 60);
  }, { tile: false });
}

// ------------------------------------------------------------------ night sky for the bay window
export function nightSky(ctx) {
  return ctx.textures.generate('library:nightsky:v1', {
    size: 512, aspect: 0.75, tile: false,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 moon = vec2(0.32, 0.78);
  float md = length((uv - moon) * vec2(0.75, 1.0));
  float cl = fbm(uv * vec2(1.0, 1.4) + vec2(0.4, 0.1), vec2(3.0, 2.0), 6);
  vec3 sky = mix(vec3(0.02, 0.035, 0.08), vec3(0.16, 0.22, 0.38), smoothstep(0.0, 1.0, uv.y));
  sky += vec3(0.5, 0.58, 0.78) * exp(-md * 7.0) * 0.9;
  sky = mix(sky, sky * 0.4 + vec3(0.015, 0.02, 0.03), smoothstep(-0.05, 0.35, cl) * 0.8);
  sky = mix(sky, vec3(1.0, 0.98, 0.9), smoothstep(0.05, 0.043, md));
  float hill = uv.y - (0.16 + 0.06 * fbm(vec2(uv.x * 2.0, 0.0), vec2(2.0, 1.0), 4));
  float trunk = abs(uv.x - 0.78 - 0.02 * sin(uv.y * 11.0)) - 0.016 * (1.3 - uv.y);
  float br = 1.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 o = vec2(0.78, 0.3 + fi * 0.09);
    vec2 d = rot2(2.4 + 0.5 * sin(fi * 2.3)) * (uv - o);
    br = min(br, max(abs(d.y + 0.02 * sin(d.x * 25.0)) - 0.005 * (1.0 - d.x * 2.5), -d.x));
    br = max(br, d.x - 0.3);
  }
  float sil = min(min(trunk, br), hill);
  sky = mix(sky, vec3(0.006, 0.008, 0.014), smoothstep(0.004, -0.004, sil));
  s.albedo = sky; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}
