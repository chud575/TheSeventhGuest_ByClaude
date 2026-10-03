// Library-specific procedural textures (GPU-generated via TextureForge + a few canvases).
import * as THREE from 'three';

// ------------------------------------------------------------------ book atlas
// 8 x 2 variant cells. Inside each cell (local u): spine [0, .6], cover [.6, .8], page block [.8, 1].
export const BOOK_ATLAS = { cols: 8, rows: 2, spine: [0, 0.6], cover: [0.6, 0.8], pages: [0.8, 1.0] };

export function bookAtlas(ctx) {
  return ctx.textures.generate('library:bookatlas:v4', {
    size: 2048, aspect: 2.0, tile: false, normalStrength: 1.6,
    glsl: /* glsl */ `
vec3 leatherCol(float k) {
  int i = int(floor(k * 8.0));
  if (i == 0) return vec3(0.40, 0.07, 0.05);   // oxblood
  if (i == 1) return vec3(0.10, 0.20, 0.12);   // bottle green
  if (i == 2) return vec3(0.33, 0.19, 0.09);   // tan calf
  if (i == 3) return vec3(0.05, 0.042, 0.036);  // black morocco
  if (i == 4) return vec3(0.42, 0.28, 0.15);   // tan / vellum-ish brown
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
    float hasBands = step(0.15, r2);
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
  return ctx.textures.generate('library:tapestry:v4', {
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
  vec3 rust = vec3(0.4, 0.15, 0.06), black = vec3(0.045, 0.03, 0.02), ochre = vec3(0.46, 0.3, 0.12), wine = vec3(0.24, 0.09, 0.045);
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
  // brushed, tarnished brass plates with a deeply engraved serif capital, the cut filled with bright gilt
  const cols = 8, rows = 4, cell = 256;
  return ctx.textures.canvas('library:letters:v3', cols * cell, rows * cell, (g, w, h) => {
    for (let i = 0; i < LETTERS.length; i++) {
      const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
      const grd = g.createLinearGradient(x, y, x, y + cell);
      grd.addColorStop(0, '#6e5428'); grd.addColorStop(0.45, '#8c6c34'); grd.addColorStop(0.55, '#7a5d2b'); grd.addColorStop(1, '#4a3618');
      g.fillStyle = grd; g.fillRect(x, y, cell, cell);
      // brushing (horizontal hairlines)
      for (let k = 0; k < 140; k++) {
        const a = Math.sin(i * 31.7 + k * 12.9898) * 43758.5453; const fr = a - Math.floor(a);
        g.fillStyle = `rgba(${fr > 0.5 ? '255,225,160' : '30,20,8'},${0.04 + 0.05 * fr})`;
        g.fillRect(x, y + fr * cell, cell, 1);
      }
      // tarnish blotches
      for (let k = 0; k < 30; k++) {
        const a = Math.sin(i * 91.7 + k * 7.13) * 43758.5453, b = Math.sin(i * 17.3 + k * 78.233) * 12345.678;
        const px = x + (a - Math.floor(a)) * cell, py = y + (b - Math.floor(b)) * cell;
        const rg = g.createRadialGradient(px, py, 0, px, py, 26);
        rg.addColorStop(0, 'rgba(25,30,15,0.25)'); rg.addColorStop(1, 'rgba(25,30,15,0)');
        g.fillStyle = rg; g.fillRect(px - 26, py - 26, 52, 52);
      }
      // bevelled border: bright top-left, dark bottom-right
      g.strokeStyle = 'rgba(255,230,170,0.45)'; g.lineWidth = 5; g.beginPath(); g.moveTo(x + 4, y + cell - 4); g.lineTo(x + 4, y + 4); g.lineTo(x + cell - 4, y + 4); g.stroke();
      g.strokeStyle = 'rgba(20,12,4,0.7)'; g.beginPath(); g.moveTo(x + cell - 4, y + 4); g.lineTo(x + cell - 4, y + cell - 4); g.lineTo(x + 4, y + cell - 4); g.stroke();
      // fine engraved border rule
      g.strokeStyle = 'rgba(20,12,4,0.6)'; g.lineWidth = 2; g.strokeRect(x + 16, y + 16, cell - 32, cell - 32);
      g.strokeStyle = 'rgba(255,220,140,0.35)'; g.lineWidth = 1; g.strokeRect(x + 18, y + 18, cell - 32, cell - 32);
      const ch = LETTERS[i];
      if (ch !== ' ') {
        g.font = `700 ${Math.round(cell * 0.66)}px Cinzel, "Times New Roman", serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        const cx = x + cell / 2, cy = y + cell / 2 + 8;
        // the cut: dark wall on the upper-left, highlight lip lower-right
        g.fillStyle = 'rgba(10,6,2,0.95)'; g.fillText(ch, cx - 3, cy - 3);
        g.fillStyle = 'rgba(255,235,180,0.5)'; g.fillText(ch, cx + 2, cy + 2);
        // gilt inlay
        const gg = g.createLinearGradient(cx - 60, cy - 70, cx + 60, cy + 70);
        gg.addColorStop(0, '#f6dc8a'); gg.addColorStop(0.5, '#d9a93e'); gg.addColorStop(1, '#a87a22');
        g.fillStyle = gg; g.fillText(ch, cx, cy);
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

// ------------------------------------------------------------------ Stauf's note (riddle): an aged, folded letter in a spidery hand
function prand(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; }
export function riddleCard(ctx, lines) {
  return ctx.textures.canvas('library:riddle:v3', 1024, 700, (g, w, h) => {
    const r = prand(77);
    g.fillStyle = '#b9a47c'; g.fillRect(0, 0, w, h);
    // mottled foxing + edge darkening
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${90 + r() * 40},${60 + r() * 30},${25},${0.03 + r() * 0.05})`; const rr = 6 + r() * 40; g.beginPath(); g.arc(r() * w, r() * h, rr, 0, 7); g.fill(); }
    const grd = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.68);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(70,40,15,0.6)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // fold creases (one vertical, one horizontal)
    for (const [x0, y0, x1, y1] of [[w * 0.5, 0, w * 0.505, h], [0, h * 0.5, w, h * 0.49]]) {
      g.strokeStyle = 'rgba(60,35,10,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = 'rgba(255,240,210,0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + 3, y0 + 3); g.lineTo(x1 + 3, y1 + 3); g.stroke();
    }
    // a ring stain from a glass
    g.strokeStyle = 'rgba(90,50,20,0.22)'; g.lineWidth = 7; g.beginPath(); g.arc(w * 0.8, h * 0.78, 70, 0.3, 5.6); g.stroke();
    // handwriting (slanted, uneven baseline, ink varying)
    g.textAlign = 'left';
    g.save(); g.translate(80, 0);
    lines.forEach((l, i) => {
      let x = 0; const y = 140 + i * 88;
      for (const ch of l) {
        g.font = `italic ${40 + r() * 4}px "IM Fell English", "Times New Roman", serif`;
        g.fillStyle = `rgba(${28 + r() * 20},${16 + r() * 10},${10},${0.78 + r() * 0.2})`;
        g.save(); g.translate(x, y + (r() - 0.5) * 3); g.rotate((r() - 0.5) * 0.06); g.fillText(ch, 0, 0); g.restore();
        x += g.measureText(ch).width * 0.98;
      }
    });
    g.restore();
    g.font = 'italic 46px "IM Fell English", serif'; g.fillStyle = 'rgba(30,16,8,0.9)';
    g.fillText('— H. S.', w * 0.66, h - 64);
    // an ink blot
    g.fillStyle = 'rgba(20,10,5,0.75)'; g.beginPath(); g.arc(w * 0.62, h - 80, 7, 0, 7); g.fill();
  }, { tile: false });
}

// ------------------------------------------------------------------ the Book of Hints: an open spread (two pages, ruled text, initial)
export function hintPagesTex(ctx) {
  return ctx.textures.canvas('library:hintpages:v1', 1536, 1024, (g, w, h) => {
    const r = prand(1993);
    for (const side of [0, 1]) {
      const x0 = side * w / 2;
      const grd = g.createLinearGradient(x0, 0, x0 + w / 2, 0);
      // gutter shading toward the spine
      if (side === 0) { grd.addColorStop(0, '#c9b58c'); grd.addColorStop(0.85, '#d6c49c'); grd.addColorStop(1, '#8a7652'); }
      else { grd.addColorStop(0, '#8a7652'); grd.addColorStop(0.15, '#d6c49c'); grd.addColorStop(1, '#c4b088'); }
      g.fillStyle = grd; g.fillRect(x0, 0, w / 2, h);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(110,75,30,${0.02 + r() * 0.05})`; g.beginPath(); g.arc(x0 + r() * w / 2, r() * h, 4 + r() * 26, 0, 7); g.fill(); }
      const mx = x0 + (side ? 90 : 70), mw = w / 2 - 160;
      // red ruled margins
      g.strokeStyle = 'rgba(140,30,20,0.55)'; g.lineWidth = 2;
      g.strokeRect(mx - 14, 70, mw + 28, h - 150);
      // heading
      g.fillStyle = 'rgba(120,20,15,0.9)'; g.font = '600 34px "IM Fell English SC", serif'; g.textAlign = 'center';
      g.fillText(side ? 'Of the Telescope' : 'Liber Auxilii', mx + mw / 2, 120);
      g.textAlign = 'left';
      // illuminated initial on the left page
      let y0 = 170;
      if (!side) {
        g.fillStyle = '#6a1410'; g.fillRect(mx, y0 - 10, 110, 110);
        g.strokeStyle = '#b8902e'; g.lineWidth = 5; g.strokeRect(mx + 4, y0 - 6, 102, 102);
        g.fillStyle = '#d8b04a'; g.font = '700 96px "Cinzel", serif'; g.fillText('T', mx + 22, y0 + 82);
      }
      // body text: pseudo-words in a book hand
      g.font = '26px "IM Fell English", serif';
      for (let line = 0; line < 22; line++) {
        const y = y0 + 34 + line * 34;
        let x = mx + (!side && line < 3 ? 124 : 0);
        const end = mx + mw - (line === 21 ? mw * 0.5 : 0);
        while (x < end - 40) {
          const n = 2 + Math.floor(r() * 7);
          let word = ''; for (let k = 0; k < n; k++) word += 'aeiounrstlhmcdpgwy'[Math.floor(r() * 18)];
          g.fillStyle = `rgba(35,20,10,${0.72 + r() * 0.2})`;
          g.fillText(word, x, y);
          x += g.measureText(word + ' ').width;
        }
      }
      // a small woodcut-style eye/telescope vignette on the right page
      if (side) {
        g.strokeStyle = 'rgba(40,25,12,0.8)'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(mx + mw / 2, h - 210, 90, 42, 0, 0, 7); g.stroke();
        g.beginPath(); g.arc(mx + mw / 2, h - 210, 28, 0, 7); g.stroke();
        g.fillStyle = 'rgba(40,25,12,0.85)'; g.beginPath(); g.arc(mx + mw / 2, h - 210, 12, 0, 7); g.fill();
      }
      g.fillStyle = 'rgba(60,40,20,0.7)'; g.font = 'italic 22px "IM Fell English", serif'; g.textAlign = 'center';
      g.fillText(side ? 'vii' : 'vi', mx + mw / 2, h - 40); g.textAlign = 'left';
    }
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

// ------------------------------------------------------------------ brick (tile = 4 x 8 bricks = 0.9 m x 0.56 m)
export function brickMap(ctx, size = 2048) {
  return ctx.textures.generate('library:brick:v2', {
    size, aspect: 0.9 / 0.56, tile: true, normalStrength: 3.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  const float COLS = 4.0, ROWS = 8.0;
  float r = floor(uv.y * ROWS);
  vec2 g = vec2(uv.x * COLS + 0.5 * mod(r, 2.0) + 0.13 * hash12(vec2(r, 3.0)) * 0.0, uv.y * ROWS);
  vec2 id = vec2(mod(floor(g.x), COLS), r);
  vec2 f = fract(g);
  // brick-space metres
  vec2 m = vec2(f.x * 0.225, f.y * 0.07);
  float ex = min(m.x, 0.225 - m.x), ey = min(m.y, 0.07 - m.y);
  float e = min(ex, ey);
  // chipped, irregular arrises
  float chip = (fbm(uv + id.x * 0.071 + id.y * 0.13, vec2(64.0, 40.0), 4) * 0.5 + 0.5);
  float bigChip = smoothstep(0.62, 0.85, fbm(uv * 1.0 + 3.7, vec2(24.0, 15.0), 3) * 0.5 + 0.5) * 0.006;
  float joint = 0.0048 + chip * 0.0028 + bigChip;
  float mortarM = 1.0 - smoothstep(joint - 0.0012, joint + 0.0006, e);
  // per-brick colour: hue/value jitter, flashed (darker) ends, a few over-burnt clinkers
  float h1 = hash12(id + 0.31), h2 = hash12(id * 1.7 + 4.0), h3 = hash12(id * 2.3 + 9.0);
  vec3 base = vec3(0.40, 0.19, 0.13);
  vec3 bc = base * (0.84 + 0.32 * h1);
  bc = mix(bc, bc * vec3(1.12, 0.92, 0.82), h2 * 0.6);              // hue drift
  bc = mix(bc, vec3(0.2, 0.12, 0.1), step(0.9, h3) * 0.6);           // clinker
  bc = mix(bc, bc * vec3(1.15, 1.05, 0.95), step(0.8, h2) * step(h3, 0.4) * 0.5); // pale salmon
  float flash = smoothstep(0.05, 0.0, min(m.x, 0.225 - m.x)) * 0.25;
  bc *= 1.0 - flash;
  // face texture: sandy pits + fire-mottle
  float mott = fbm(uv + id * 0.37, vec2(48.0, 30.0), 4) * 0.5 + 0.5;
  float pits = step(0.86, vnoise(uv * vec2(900.0, 560.0), vec2(900.0, 560.0)));
  bc *= 0.82 + 0.3 * mott;
  bc *= 1.0 - pits * 0.35;
  // mortar: lime, recessed, sandy, darkened by age
  float sand = vnoise(uv * vec2(700.0, 440.0), vec2(700.0, 440.0));
  vec3 mc = vec3(0.30, 0.28, 0.25) * (0.75 + 0.35 * sand);
  vec3 col = mix(bc, mc, mortarM);
  // soot / grime: heavier toward the top of the wall tile, streaks running down
  float streak = fbm(vec2(uv.x * 1.0, uv.y * 0.25), vec2(40.0, 1.0), 3) * 0.5 + 0.5;
  float soot = smoothstep(0.45, 0.85, fbm(uv + 7.0, vec2(3.0, 2.0), 5) * 0.5 + 0.5) * 0.6 + streak * 0.25;
  col *= 1.0 - soot * 0.45;
  // faint efflorescence on a few bricks
  float eff = smoothstep(0.7, 0.95, fbm(uv + 2.0, vec2(8.0, 5.0), 4) * 0.5 + 0.5) * step(0.7, h1);
  col = mix(col, vec3(0.42, 0.4, 0.37), eff * 0.25 * (1.0 - mortarM));
  float faceH = 0.86 + mott * 0.06 - pits * 0.12 - smoothstep(0.006, 0.0, e - joint) * 0.25;
  s.albedo = col;
  s.height = mix(faceH, 0.18 + sand * 0.06, mortarM);
  s.rough = mix(0.78 + pits * 0.1, 0.96, mortarM);
  s.metal = 0.0;
  s.ao = mix(1.0 - smoothstep(0.012, 0.0, e) * 0.25, 0.45, mortarM);
}`,
  });
}

// ------------------------------------------------------------------ aged, adzed oak timber (grain along U; tile 1.6 m x 0.4 m)
export function timberMap(ctx, size = 2048) {
  return ctx.textures.generate('library:timber:v4', {
    size, aspect: 4.0, tile: true, normalStrength: 2.2,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  // grain lines along u
  float wander = fbm(uv, vec2(2.0, 1.0), 3) * 0.08;
  float vy = uv.y + wander;
  float fine = fbm(vec2(uv.x, vy), vec2(4.0, 160.0), 3) * 0.5 + 0.5;
  float rings = fract(abs(vy - 0.5) * 22.0 + fbm(uv + 1.3, vec2(3.0, 2.0), 3) * 0.7);
  float late = smoothstep(0.0, 0.3, rings) * (1.0 - smoothstep(0.5, 1.0, rings));
  vec3 early = vec3(0.22, 0.15, 0.095), lateC = vec3(0.15, 0.1, 0.065);
  vec3 col = mix(early, lateC, clamp(0.4 + late * 0.2 + (fine - 0.5) * 0.7, 0.0, 1.0));
  // medullary ray flecks (oak)
  float ray = smoothstep(0.8, 0.95, vnoise(uv * vec2(40.0, 300.0), vec2(40.0, 300.0)));
  col = mix(col, col * 1.35, ray * 0.4);
  // adze scallops: shallow dished cuts across the grain, irregular spacing
  float ax = uv.x * 26.0 + fbm(uv + 4.0, vec2(4.0, 2.0), 3) * 1.2;
  float sc = fract(ax);
  float scallop = (1.0 - pow(abs(sc - 0.5) * 2.0, 2.0)) * 0.5;
  float scEdge = smoothstep(0.06, 0.0, min(sc, 1.0 - sc));
  // drying checks: long dark cracks along the grain
  float chk = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float y0 = hash12(vec2(fi, 7.0));
    float len = smoothstep(0.0, 0.1, fract(uv.x * 2.0 + hash12(vec2(fi, 3.0))) ) * smoothstep(0.75, 0.55, fract(uv.x * 2.0 + hash12(vec2(fi, 3.0))));
    float d = abs(vy - y0 - 0.01 * sin(uv.x * 40.0 + fi)) ;
    chk = max(chk, (1.0 - smoothstep(0.0015, 0.004, d)) * len);
  }
  // grime + polish from hands
  float grime = smoothstep(0.3, 0.9, fbm(uv + 9.0, vec2(6.0, 2.0), 4) * 0.5 + 0.5);
  col *= 0.85 + 0.25 * fine;
  col *= 1.0 - grime * 0.35;
  col *= 1.0 - scEdge * 0.18;
  col = mix(col, vec3(0.02, 0.015, 0.01), chk * 0.85);
  s.albedo = col;
  s.height = 0.5 + scallop * 0.18 - scEdge * 0.06 + (fine - 0.5) * 0.08 + late * 0.01 - chk * 0.4;
  s.rough = 0.72 - grime * 0.08 + chk * 0.2;
  s.metal = 0.0;
  s.ao = 1.0 - chk * 0.6 - scEdge * 0.1;
}`,
  });
}

// ------------------------------------------------------------------ coffer inserts: lozenge leaded glass in pressed-brass cames
export function cofferGlassMap(ctx) {
  return ctx.textures.generate('library:cofferglass:v1', {
    size: 1024, tile: true, normalStrength: 1.4,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  // 5 x 3 lozenges per tile (tile is stretched to each panel), bevelled glass, brass cames
  vec2 p = uv * vec2(5.0, 5.0);
  vec2 q = vec2(p.x + p.y, p.x - p.y) * 0.5;
  vec2 fq = fract(q);
  vec2 id = floor(q);
  float e = min(min(fq.x, 1.0 - fq.x), min(fq.y, 1.0 - fq.y));
  float came = 1.0 - smoothstep(0.035, 0.05, e);
  float bevel = smoothstep(0.05, 0.16, e);
  float t = hash12(id + 3.1);
  float wav = fbm(uv + id * 0.1, vec2(8.0), 3) * 0.5 + 0.5;
  // glass: cold, slightly green-grey, seeded with bubbles; brighter facets catch light
  vec3 glass = mix(vec3(0.42, 0.48, 0.55), vec3(0.62, 0.66, 0.68), t) * (0.7 + 0.45 * wav);
  glass *= 0.75 + 0.35 * (1.0 - bevel) + 0.2 * step(0.5, fq.x);   // bevel facets
  // little rosette jewel at every came crossing
  vec2 cp = fract(q + 0.5) - 0.5;
  float jewel = 1.0 - smoothstep(0.06, 0.08, length(cp));
  vec3 brass = vec3(0.5, 0.38, 0.18) * (0.75 + 0.4 * wav);
  float grime = smoothstep(0.0, 0.2, e) ;
  glass *= 0.6 + 0.4 * grime;
  vec3 col = mix(glass, brass, max(came, jewel));
  s.albedo = col;
  s.height = mix(0.55 + 0.25 * bevel, 0.9, max(came, jewel));
  s.rough = mix(0.12, 0.35, max(came, jewel));
  s.metal = max(came, jewel) * 0.9;
  s.ao = mix(0.7 + 0.3 * bevel, 1.0, came);
}`,
  });
}

// ------------------------------------------------------------------ vanitas still life (painted: chiaroscuro, brushwork, craquelure)
export function vanitasMap(ctx) {
  return ctx.textures.generate('library:vanitas:v3', {
    size: 1024, aspect: 0.72 / 0.52, tile: false, normalStrength: 0.6,
    glsl: /* glsl */ `
float sdEll(vec2 p, vec2 c, vec2 r) { vec2 q = (p - c) / r; return (length(q) - 1.0) * min(r.x, r.y); }
// lambert-ish shade of a pseudo-sphere (centre c, radius r) lit from the upper left
float sph(vec2 p, vec2 c, float r) {
  vec2 q = (p - c) / r; float z = sqrt(max(0.0, 1.0 - dot(q, q)));
  vec3 n = normalize(vec3(q, z + 0.001));
  return clamp(dot(n, normalize(vec3(-0.55, 0.55, 0.62))), 0.0, 1.0);
}
void surface(vec2 uv, inout Surface s) {
  vec2 p = vec2(uv.x * 1.385, uv.y);
  float stroke1 = fbm(vec2(p.x * 3.0 + p.y * 1.5, p.y * 0.6), vec2(60.0, 8.0), 4);
  float stroke2 = fbm(vec2(p.x * 0.8, p.y * 2.5 - p.x * 0.7), vec2(10.0, 50.0), 3);
  vec2 cand = vec2(1.0, 0.66);
  float glow = exp(-length((p - cand) * vec2(0.9, 1.1)) * 2.6);
  // murky umber ground, warmed around the flame and toward the upper left (the painted light source)
  vec3 col = mix(vec3(0.06, 0.045, 0.03), vec3(0.3, 0.2, 0.1), glow * 0.8 + 0.12 * (stroke2 * 0.5 + 0.5));
  col += vec3(0.08, 0.06, 0.035) * smoothstep(0.9, 0.0, length(p - vec2(0.2, 0.9)));
  // table top + front edge
  float table = step(p.y, 0.3);
  vec3 tcol = mix(vec3(0.16, 0.09, 0.05), vec3(0.36, 0.23, 0.12), smoothstep(0.05, 0.3, p.y)) * (0.8 + 0.35 * stroke1) * (0.7 + 0.6 * glow);
  col = mix(col, tcol, table);
  col = mix(col, vec3(0.55, 0.38, 0.2) * (0.6 + glow), stroke(p.y - 0.3, 0.0, 0.003) * 0.8);
  // crimson drape over the table edge at left, with deep folds
  float drapeX = 0.46 + 0.05 * sin(p.y * 9.0);
  float drape = step(p.x, drapeX) * step(p.y, 0.46 - 0.1 * p.x);
  float folds = sin(p.x * 40.0 + sin(p.y * 7.0) * 2.0) * 0.5 + 0.5;
  vec3 dcol = vec3(0.5, 0.07, 0.05) * (0.25 + 1.0 * folds) * (0.75 + 0.4 * smoothstep(0.5, 0.0, p.x));
  dcol += vec3(0.5, 0.2, 0.1) * pow(folds, 10.0) * 0.5;
  col = mix(col, dcol, drape);
  // book stack (right): three tilted volumes with page edges
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 c = vec2(1.02 + fi * 0.02, 0.335 + fi * 0.062);
    vec2 q = rot2(0.04 - fi * 0.05) * (p - c);
    float b = sdBox(q, vec2(0.21 - fi * 0.03, 0.03));
    vec3 bc = fi == 0.0 ? vec3(0.42, 0.2, 0.08) : (fi == 1.0 ? vec3(0.16, 0.2, 0.1) : vec3(0.5, 0.1, 0.06));
    float pages = step(0.0, q.x - (0.12 - fi * 0.03)) * step(abs(q.y), 0.022);
    bc = mix(bc, vec3(0.85, 0.72, 0.5), pages * 0.85);
    bc *= (0.45 + 0.75 * clamp(0.5 + q.y * 14.0, 0.0, 1.0)) * (0.65 + 0.6 * glow);
    col = mix(col, bc * (0.85 + 0.25 * stroke1), fill(b, 0.003));
  }
  // candle + flame + halo
  float candle = sdBox(p - vec2(1.04, 0.52), vec2(0.022, 0.075));
  col = mix(col, vec3(0.9, 0.82, 0.62) * (0.65 + 0.45 * smoothstep(1.065, 1.02, p.x)), fill(candle, 0.003));
  float fl = sdEll(p, vec2(1.04, 0.635), vec2(0.012, 0.03));
  col += vec3(1.0, 0.7, 0.3) * exp(-max(fl, 0.0) * 45.0) * 0.7;
  col = mix(col, vec3(1.0, 0.95, 0.75), fill(fl, 0.003));
  // the skull, three-quarter view toward the candle
  vec2 sc = vec2(0.66, 0.43);
  float cran = sdEll(p, sc + vec2(0.0, 0.035), vec2(0.13, 0.115));
  float face = sdEll(p, sc + vec2(0.055, -0.055), vec2(0.09, 0.08));
  float cheek = sdEll(p, sc + vec2(0.1, -0.075), vec2(0.03, 0.04));
  float jaw = sdEll(p, sc + vec2(0.07, -0.135), vec2(0.065, 0.035));
  float sk = min(min(min(cran, face), cheek), jaw + 0.003);
  float sh = sph(p, sc + vec2(0.03, -0.02), 0.17);
  // warm reflected light from the candle on the right side
  float bounce = smoothstep(0.0, 0.12, p.x - sc.x) * 0.35;
  vec3 bone = vec3(0.86, 0.78, 0.6) * (0.18 + 1.05 * sh) + vec3(0.5, 0.3, 0.1) * bounce;
  bone *= 0.88 + 0.25 * stroke1;
  // planes: brow ridge highlight, temple hollow, cheek shadow
  bone *= 1.0 + 0.3 * fill(sdEll(p, sc + vec2(0.045, -0.005), vec2(0.085, 0.012)), 0.012);
  bone *= 1.0 - 0.4 * fill(sdEll(p, sc + vec2(-0.045, -0.02), vec2(0.03, 0.045)), 0.02);
  float socketL = sdEll(p, sc + vec2(0.012, -0.038), vec2(0.036, 0.031));
  float socketR = sdEll(p, sc + vec2(0.094, -0.043), vec2(0.026, 0.029));
  float nasal = sdEll(p, sc + vec2(0.058, -0.088), vec2(0.013, 0.022));
  float holes = min(min(socketL, socketR), nasal);
  bone = mix(bone, vec3(0.025, 0.016, 0.01), fill(holes, 0.004));
  bone = mix(bone, bone * 0.55, stroke(holes, 0.004, 0.004));      // soft painted rim round each cavity
  // teeth: a row of small blocks with dark gaps, a missing one
  float ty = sc.y - 0.118;
  float tband = step(abs(p.y - ty), 0.013) * step(abs(p.x - sc.x - 0.062), 0.045);
  float gap = step(0.78, fract((p.x - sc.x) * 95.0)) + step(0.0, p.x - sc.x - 0.07) * step(p.x - sc.x - 0.08, 0.0);
  bone = mix(bone, vec3(0.03, 0.02, 0.015), tband * clamp(gap, 0.0, 1.0));
  bone = mix(bone, vec3(0.03, 0.02, 0.015), stroke(p.y - ty, 0.0, 0.0018) * step(abs(p.x - sc.x - 0.062), 0.045));
  col = mix(col, bone, fill(sk, 0.003));
  col *= 1.0 - stroke(sk, 0.0, 0.003) * 0.5;
  // cast shadow of the skull on the table
  col *= 1.0 - 0.5 * fill(sdEll(p, sc + vec2(-0.08, -0.17), vec2(0.13, 0.025)), 0.03) * table;
  // hourglass at the far left, behind the drape
  vec2 hp = p - vec2(0.24, 0.5);
  float hg = max(abs(hp.y) - 0.1, abs(hp.x) - (0.01 + 0.05 * abs(hp.y) / 0.1));
  col = mix(col, vec3(0.55, 0.45, 0.28) * (0.35 + 0.8 * smoothstep(0.05, -0.05, hp.x)), fill(hg, 0.003) * 0.8);
  col = mix(col, vec3(0.35, 0.2, 0.1), (fill(sdBox(hp - vec2(0.0, 0.105), vec2(0.06, 0.008)), 0.002) + fill(sdBox(hp + vec2(0.0, 0.105), vec2(0.06, 0.008)), 0.002)));
  // varnish: yellowed, darker toward the edges; fine craquelure
  float edgeV = smoothstep(0.0, 0.2, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  col *= mix(0.6, 1.0, edgeV);
  col *= vec3(1.0, 0.92, 0.75);
  float crack = 1.0 - smoothstep(0.0, 0.012, voronoiEdge(uv * vec2(46.0, 34.0), vec2(46.0, 34.0), 0.9));
  col *= 1.0 - crack * 0.18;
  s.albedo = col;
  s.height = 0.5 + stroke1 * 0.06 + stroke2 * 0.03 - crack * 0.12;
  s.rough = 0.4 + crack * 0.2;
  s.metal = 0.0; s.ao = 1.0 - crack * 0.15;
}`,
  });
}

// ------------------------------------------------------------------ distant landscape layer for the bay (alpha cut-out trees, gate lamp)
export function treelineMap(ctx) {
  return ctx.textures.generate('library:treeline:v1', {
    size: 1024, aspect: 1.6, tile: false, normalStrength: 0.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  // ragged treeline + bare oak + gate posts with a lamp
  float tl = 0.28 + 0.07 * fbm(vec2(uv.x * 1.0, 0.0), vec2(6.0, 1.0), 5) + 0.05 * (fbm(vec2(uv.x * 3.0, 0.3), vec2(24.0, 1.0), 4));
  float ground = 0.12 + 0.02 * sin(uv.x * 5.0);
  float a = step(uv.y, tl) ;
  // a bare tree (right) with branching arms
  float tr = abs(uv.x - 0.82 - 0.01 * sin(uv.y * 20.0)) - 0.008 * (1.4 - uv.y * 1.5);
  float br = 1.0;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    vec2 o = vec2(0.82, 0.3 + fi * 0.055);
    float side = mod(fi, 2.0) * 2.0 - 1.0;
    vec2 d = rot2(side * (0.7 + 0.3 * sin(fi * 1.7))) * (uv - o);
    float len = 0.18 - fi * 0.012;
    br = min(br, max(abs(d.y + 0.015 * sin(d.x * 30.0)) - 0.003 * (1.0 - d.x / len), max(-d.x, d.x - len)));
  }
  a = max(a, step(min(tr, br), 0.0) * step(uv.y, 0.85));
  // gate piers + lamp post (left of centre)
  float pier = step(abs(uv.x - 0.33), 0.012) * step(uv.y, 0.27);
  float pier2 = step(abs(uv.x - 0.45), 0.012) * step(uv.y, 0.27);
  float post = step(abs(uv.x - 0.39), 0.0025) * step(uv.y, 0.3);
  a = max(a, max(max(pier, pier2), post));
  vec3 col = vec3(0.012, 0.014, 0.02);
  // the gate lamp: warm glow
  float lampD = length((uv - vec2(0.39, 0.305)) * vec2(1.6, 1.0));
  vec3 glow = vec3(1.0, 0.62, 0.28) * (exp(-lampD * 60.0) * 2.5 + exp(-lampD * 14.0) * 0.25);
  col += glow;
  a = max(a, clamp(exp(-lampD * 14.0) * 0.6, 0.0, 1.0));
  s.albedo = clamp(col, 0.0, 1.0); s.alpha = a; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

// ------------------------------------------------------------------ rain-streaked, condensation-misted window glass (alpha = streaks)
export function rainGlassMap(ctx) {
  return ctx.textures.generate('library:rainglass:v1', {
    size: 1024, tile: true, normalStrength: 2.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  // vertical rivulets that wander, beads of water, misted lower edge
  float col = floor(uv.x * 40.0);
  float fx = fract(uv.x * 40.0);
  float wob = 0.18 * sin(uv.y * 30.0 + hash12(vec2(col, 1.0)) * 6.28) + 0.1 * fbm(vec2(uv.x * 1.0, uv.y), vec2(40.0, 6.0), 3);
  float lane = step(0.55, hash12(vec2(col, 5.0)));
  float riv = (1.0 - smoothstep(0.03, 0.09, abs(fx - 0.5 - wob))) * lane * smoothstep(0.2, 0.8, fbm(vec2(col * 0.1, uv.y), vec2(4.0, 3.0), 3) * 0.5 + 0.5 + 0.3);
  vec4 v = voronoi(uv * 60.0, vec2(60.0), 0.9);
  float bead = (1.0 - smoothstep(0.12, 0.2, v.x)) * step(0.62, hash12(v.zw));
  float mist = fbm(uv, vec2(6.0), 4) * 0.5 + 0.5;
  float a = clamp(riv * 0.55 + bead * 0.45 + mist * 0.1, 0.0, 1.0);
  s.albedo = vec3(0.7, 0.75, 0.8);
  s.alpha = a;
  s.height = 0.5 + riv * 0.3 + bead * (0.3 - v.x);
  s.rough = 0.05 + mist * 0.2; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}
