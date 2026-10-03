/**
 * Game-room procedural textures (authored for this room): billiard baize, the
 * inlaid marquetry chessboard, trophy fur, the moonlit sky beyond the windows,
 * and canvas atlases for the billiard balls and the playing cards.
 */
import * as THREE from 'three';

/** Worsted billiard cloth: fine directional nap, faint chalk smudges and wear. Tiles (1 tile = 0.5 m). */
export function baizeTexture(forge, { color = [0.03, 0.2, 0.1] } = {}) {
  return forge.generate('gameroom:baize', {
    size: 1024, normalStrength: 0.6,
    uniforms: { uColor: color },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float fine = vnoise(uv * vec2(900.0, 900.0), vec2(900.0));
  float nap = vnoise(vec2(uv.x * 1400.0, uv.y * 160.0), vec2(1400.0, 160.0));
  float mot = fbmv(uv, vec2(5.0), 4);
  float chalk = smoothstep(0.62, 0.8, fbmv(uv + 0.37, vec2(3.0), 5)) * 0.35;
  vec3 c = uColor * (0.82 + 0.22 * mot) * (0.9 + 0.12 * nap + 0.06 * fine);
  c = mix(c, vec3(0.32, 0.42, 0.52), chalk * 0.35);
  s.albedo = c;
  s.height = 0.5 + 0.18 * nap + 0.1 * fine;
  s.rough = 0.93;
  s.metal = 0.0;
  s.ao = 0.92 + 0.08 * fine;
}`,
  });
}

/** Inlaid chessboard: maple + rosewood squares with alternating grain, boxwood/ebony stringing, a dentil band and burr-walnut crossbanding. uv 0..1 over the whole top. */
export function chessboardTexture(forge, { inner = 0.76 } = {}) {
  return forge.generate('gameroom:chessboard', {
    size: 2048, tile: false, normalStrength: 1.2,
    uniforms: { uInner: inner },
    glsl: /* glsl */ `
vec3 grain(vec2 p, vec3 a, vec3 b, float seed, float freq) {
  float n = fbm(p * 0.25 + seed * 0.013, vec2(2.0, 12.0), 4);
  float g = 0.5 + 0.5 * sin((p.x * freq + n * 5.0 + seed) * 3.14159);
  g = pow(g, 2.5);
  float fine = vnoise(p * vec2(40.0, 900.0) + seed * 3.0, vec2(4096.0));
  float fl = smoothstep(0.55, 0.9, fbmv(p * 0.3 + seed * 0.017, vec2(3.0, 30.0), 3));
  return mix(a, b, clamp(g * 0.55 + fine * 0.3 + fl * 0.2, 0.0, 1.0));
}
vec3 burl(vec2 p) {
  float w = fbm(p, vec2(6.0), 5);
  vec4 v = voronoi(p * 38.0 + w * 3.0, vec2(4096.0), 1.0);
  float eyes = smoothstep(0.12, 0.0, v.x);
  float sw = 0.5 + 0.5 * sin(w * 22.0 + v.x * 18.0);
  vec3 c = mix(vec3(0.18, 0.08, 0.035), vec3(0.42, 0.22, 0.09), sw * 0.7);
  return mix(c, vec3(0.07, 0.03, 0.015), eyes * 0.8);
}
void surface(vec2 uv, inout Surface s) {
  float b = (1.0 - uInner) * 0.5;
  vec2 q = (uv - b) / uInner;               // 0..1 over the 8x8 field
  float sq = 1.0 / 8.0;
  vec3 col; float h = 0.5; float rough = 0.5;
  vec2 d2 = abs(uv - 0.5);
  float edge = max(d2.x, d2.y);              // 0 centre .. 0.5 edge
  float fieldEdge = uInner * 0.5;
  if (edge < fieldEdge) {
    vec2 id = floor(q * 8.0);
    vec2 f = fract(q * 8.0);
    bool light = mod(id.x + id.y, 2.0) > 0.5;
    float seed = hash12(id) * 40.0;
    vec2 p = light ? q : q.yx;               // alternate grain direction
    if (light) col = grain(p * 3.0 + id * 0.37, vec3(0.78, 0.6, 0.36), vec3(0.62, 0.43, 0.22), seed, 26.0);
    else col = grain(p * 3.0 + id * 0.41, vec3(0.2, 0.08, 0.04), vec3(0.09, 0.03, 0.015), seed, 34.0);
    float ge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    float seam = smoothstep(0.0, 0.012, ge);
    col *= 0.7 + 0.3 * seam;
    h = 0.5 - (1.0 - seam) * 0.12;
  } else {
    float t = (edge - fieldEdge) / (0.5 - fieldEdge);   // 0 at field .. 1 at outer edge
    vec2 along = d2.x > d2.y ? vec2(uv.y, edge) : vec2(uv.x, edge);
    if (t < 0.06) { col = vec3(0.86, 0.74, 0.5); rough = 0.5; }                // boxwood stringing
    else if (t < 0.1) { col = vec3(0.02, 0.012, 0.01); rough = 0.5; }          // ebony line
    else if (t < 0.34) {                                                      // dentil band: alternating blocks
      float k = floor(along.x * 64.0);
      bool a = mod(k, 2.0) < 0.5;
      col = a ? vec3(0.82, 0.66, 0.4) : vec3(0.08, 0.03, 0.02);
      col *= 0.85 + 0.15 * vnoise(vec2(along.x * 600.0, t * 40.0), vec2(4096.0));
      float sm = abs(fract(along.x * 64.0) - 0.5);
      h = 0.5 - smoothstep(0.47, 0.5, sm) * 0.1;
    }
    else if (t < 0.38) { col = vec3(0.02, 0.012, 0.01); }
    else if (t < 0.42) { col = vec3(0.86, 0.74, 0.5); }
    else {                                                                    // crossbanded burr walnut
      col = burl(uv * 1.3);
      float cb = 0.5 + 0.5 * sin((t * 50.0 + fbm(along, vec2(20.0, 4.0), 3) * 3.0) * 3.14159);
      col *= 0.85 + 0.2 * cb;
      if (t > 0.94) { col *= 0.75; }
    }
    float seamB = min(abs(t - 0.06), min(abs(t - 0.1), min(abs(t - 0.34), min(abs(t - 0.38), abs(t - 0.42)))));
    h -= (1.0 - smoothstep(0.0, 0.004, seamB)) * 0.06;
  }
  // varnish wear, dust in the seams, faint ring stain from a glass
  float wear = fbmv(uv, vec2(4.0), 4);
  col *= 0.9 + 0.15 * wear;
  float ring = abs(length(uv - vec2(0.86, 0.12)) - 0.055);
  col *= 1.0 - 0.18 * smoothstep(0.006, 0.0, ring) * (0.5 + 0.5 * vnoise(uv * 300.0, vec2(4096.0)));
  s.albedo = col;
  s.height = h + vnoise(uv * 700.0, vec2(4096.0)) * 0.015;
  s.rough = rough + 0.2 * wear;
  s.metal = 0.0;
  s.ao = 1.0;
}`,
  });
}

/** Short taxidermy fur with flowing strands. Tiles. */
export function furTexture(forge, { a = [0.11, 0.065, 0.035], b = [0.36, 0.23, 0.12], key = 'stag' } = {}) {
  return forge.generate(`gameroom:fur:${key}`, {
    size: 512, normalStrength: 2.2,
    uniforms: { uA: a, uB: b },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float w = fbm(uv, vec2(3.0), 3);
  float s1 = vnoise(vec2(uv.x * 160.0 + w * 14.0, uv.y * 14.0), vec2(160.0, 14.0));
  float s2 = vnoise(vec2(uv.x * 340.0 + w * 22.0, uv.y * 26.0), vec2(340.0, 26.0));
  float h = s1 * 0.6 + s2 * 0.4;
  vec3 c = mix(uA, uB, smoothstep(0.2, 0.9, h));
  c *= 0.75 + 0.45 * fbmv(uv, vec2(4.0), 3);
  s.albedo = c;
  s.height = h;
  s.rough = 0.8 - 0.15 * h;
  s.metal = 0.0;
  s.ao = 0.6 + 0.4 * h;
}`,
  });
}

/** Moonlit winter sky over the grounds, seen from the upper floor: moon, torn cloud, the crown of a dead elm. HDR (multiply in material). */
export function nightSkyTexture(forge) {
  return forge.generate('gameroom:nightsky', {
    size: 1024, aspect: 0.75, tile: false,
    glsl: /* glsl */ `
float branch(vec2 p, vec2 a, vec2 b, float w0, float w1) {
  vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(w0, w1, h);
}
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  vec2 moon = vec2(0.34, 0.74);
  float md = length((p - moon) * vec2(0.75, 1.0));
  vec3 sky = mix(vec3(0.03, 0.05, 0.11), vec3(0.22, 0.3, 0.5), smoothstep(0.2, 1.0, p.y));
  sky += vec3(0.55, 0.64, 0.85) * exp(-md * 4.5) * 0.9;
  float cl = fbm(p + vec2(0.7, 0.2), vec2(2.0, 3.0), 6);
  float cl2 = fbm(p + 0.3, vec2(4.0, 7.0), 4);
  sky = mix(sky, sky * 0.45 + vec3(0.02, 0.025, 0.04), smoothstep(-0.05, 0.35, cl + cl2 * 0.3) * 0.75);
  sky += vec3(0.8, 0.85, 0.95) * smoothstep(0.18, 0.0, abs(cl - 0.02)) * exp(-md * 2.5) * 0.5;
  sky = mix(sky, vec3(1.0, 0.98, 0.94) * 1.4, smoothstep(0.045, 0.038, md));
  // stars
  vec2 g = p * vec2(90.0, 120.0); vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float st = smoothstep(0.06, 0.0, length(f - (hash22(id) - 0.5) * 0.7)) * step(0.93, hash12(id + 1.7));
  sky += vec3(0.7, 0.75, 0.9) * st * 0.6 * (1.0 - smoothstep(-0.1, 0.2, cl));
  // distant woods and a snowy roofline
  float far = p.y - (0.2 + 0.05 * fbm(vec2(p.x, 0.5), vec2(7.0, 1.0), 5));
  vec3 col = mix(sky, vec3(0.06, 0.075, 0.13), smoothstep(0.004, -0.004, far));
  float hill = p.y - (0.12 + 0.02 * fbm(vec2(p.x, 0.3), vec2(3.0, 1.0), 4));
  col = mix(col, vec3(0.3, 0.36, 0.5) * (0.8 + 0.2 * fbmv(p, vec2(30.0), 3)), smoothstep(0.004, -0.004, hill));
  // dead elm reaching in from the right
  float d = 1e5;
  d = min(d, branch(p, vec2(1.05, 0.0), vec2(0.86, 0.52), 0.035, 0.016));
  d = min(d, branch(p, vec2(0.86, 0.52), vec2(0.7, 0.86), 0.016, 0.006));
  d = min(d, branch(p, vec2(0.86, 0.52), vec2(1.02, 0.95), 0.014, 0.005));
  d = min(d, branch(p, vec2(0.93, 0.3), vec2(0.62, 0.46), 0.014, 0.004));
  d = min(d, branch(p, vec2(0.62, 0.46), vec2(0.5, 0.58), 0.004, 0.002));
  d = min(d, branch(p, vec2(0.62, 0.46), vec2(0.52, 0.4), 0.004, 0.0015));
  d = min(d, branch(p, vec2(0.7, 0.86), vec2(0.58, 0.97), 0.006, 0.002));
  d = min(d, branch(p, vec2(0.76, 0.75), vec2(0.6, 0.72), 0.006, 0.002));
  d = min(d, branch(p, vec2(0.6, 0.72), vec2(0.5, 0.78), 0.003, 0.0012));
  d = min(d, branch(p, vec2(0.8, 0.43), vec2(0.72, 0.3), 0.005, 0.002));
  // twigs
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    vec2 a = vec2(0.55 + hash11(fi) * 0.4, 0.38 + hash11(fi + 9.0) * 0.6);
    vec2 b = a + vec2(-0.05 - hash11(fi + 3.0) * 0.08, (hash11(fi + 5.0) - 0.4) * 0.1);
    d = min(d, branch(p, a, b, 0.0022, 0.0008));
  }
  col = mix(col, vec3(0.008, 0.01, 0.018), smoothstep(0.002, -0.002, d));
  s.albedo = col; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

// ------------------------------------------------------------------ canvas atlases

export const BALL_COLORS = ['#f2ead2', '#e8b81c', '#1d3f9a', '#b8221c', '#4a1f6a', '#e0661c', '#12623a', '#6b1a1c', '#121010'];

/** 4x4 atlas of equirect billiard-ball maps (cell 256x128). Index 0 = cue ball, 1..15 numbered. */
export function ballAtlas(forge) {
  return forge.canvas('gameroom:balls', 1024, 512, (g) => {
    for (let n = 0; n < 16; n++) {
      const cx = (n % 4) * 256, cy = Math.floor(n / 4) * 128;
      const ivory = '#efe4c8';
      const col = n === 0 ? ivory : BALL_COLORS[n <= 8 ? n : n - 8];
      const stripe = n > 8;
      g.fillStyle = stripe ? ivory : col; g.fillRect(cx, cy, 256, 128);
      if (stripe) { g.fillStyle = col; g.fillRect(cx, cy + 128 * 0.24, 256, 128 * 0.52); }
      // patina: slight darkening toward poles, tiny speckles
      const gr = g.createLinearGradient(0, cy, 0, cy + 128);
      gr.addColorStop(0, 'rgba(60,40,20,0.18)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(60,40,20,0.18)');
      g.fillStyle = gr; g.fillRect(cx, cy, 256, 128);
      if (n === 0) {
        g.fillStyle = '#b8221c';
        for (const u of [0.25, 0.75]) { g.beginPath(); g.arc(cx + u * 256, cy + 64, 4, 0, Math.PI * 2); g.fill(); }
        continue;
      }
      for (const u of [0.25, 0.75]) {
        const x = cx + u * 256, y = cy + 64;
        g.fillStyle = ivory; g.beginPath(); g.ellipse(x, y, 21, 21, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#141010'; g.font = 'bold 25px "DejaVu Serif", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(n), x, y + 1);
        if (n === 6 || n === 9) { g.fillRect(x - 6, y + 14, 12, 2); }
      }
    }
  }, { tile: false });
}

function pip(g, suit, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = suit === 'h' || suit === 'd' ? '#a3151a' : '#121212';
  g.beginPath();
  if (suit === 'h') {
    g.moveTo(0, 0.9); g.bezierCurveTo(-1.2, 0.0, -1.0, -0.95, -0.5, -0.95); g.bezierCurveTo(-0.15, -0.95, 0, -0.6, 0, -0.45);
    g.bezierCurveTo(0, -0.6, 0.15, -0.95, 0.5, -0.95); g.bezierCurveTo(1.0, -0.95, 1.2, 0.0, 0, 0.9);
  } else if (suit === 'd') {
    g.moveTo(0, -1); g.quadraticCurveTo(0.35, -0.3, 0.75, 0); g.quadraticCurveTo(0.35, 0.3, 0, 1); g.quadraticCurveTo(-0.35, 0.3, -0.75, 0); g.quadraticCurveTo(-0.35, -0.3, 0, -1);
  } else if (suit === 's') {
    g.moveTo(0, -1); g.bezierCurveTo(-1.2, -0.1, -1.0, 0.75, -0.45, 0.7); g.bezierCurveTo(-0.2, 0.68, -0.08, 0.5, -0.05, 0.4);
    g.lineTo(-0.3, 1.0); g.lineTo(0.3, 1.0); g.lineTo(0.05, 0.4);
    g.bezierCurveTo(0.08, 0.5, 0.2, 0.68, 0.45, 0.7); g.bezierCurveTo(1.0, 0.75, 1.2, -0.1, 0, -1);
  } else {
    for (const [cx, cy] of [[0, -0.45], [-0.5, 0.2], [0.5, 0.2]]) { g.moveTo(cx + 0.42, cy); g.arc(cx, cy, 0.42, 0, Math.PI * 2); }
    g.moveTo(-0.1, 0.2); g.lineTo(-0.3, 1.0); g.lineTo(0.3, 1.0); g.lineTo(0.1, 0.2);
  }
  g.fill(); g.restore();
}

/** Card atlas 5 x (256x384): [7 of hearts, queen of spades, ace of spades, 3 of clubs, back]. */
export const CARD_FACES = ['7h', 'Qs', 'As', '3c', 'back'];
export function cardAtlas(forge) {
  return forge.canvas('gameroom:cards', 1280, 384, (g) => {
    CARD_FACES.forEach((card, k) => {
      const x0 = k * 256;
      g.save(); g.translate(x0, 0);
      const W = 256, H = 384;
      g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, W, H);
      const age = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 260);
      age.addColorStop(0, 'rgba(0,0,0,0)'); age.addColorStop(1, 'rgba(90,60,25,0.35)');
      g.fillStyle = age; g.fillRect(0, 0, W, H);
      if (card === 'back') {
        g.fillStyle = '#5a1015'; g.fillRect(14, 14, W - 28, H - 28);
        g.strokeStyle = '#c9a55a'; g.lineWidth = 3; g.strokeRect(22, 22, W - 44, H - 44);
        g.strokeStyle = 'rgba(201,165,90,0.55)'; g.lineWidth = 1.5;
        for (let i = -20; i < 40; i++) { g.beginPath(); g.moveTo(22 + i * 12, 22); g.lineTo(22 + i * 12 + 340, 362); g.stroke(); g.beginPath(); g.moveTo(22 + i * 12, 362); g.lineTo(22 + i * 12 + 340, 22); g.stroke(); }
        g.fillStyle = '#5a1015'; g.beginPath(); g.ellipse(W / 2, H / 2, 54, 70, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#c9a55a'; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#c9a55a'; g.font = 'bold 54px "DejaVu Serif", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('S', W / 2, H / 2 + 2);
        g.restore(); return;
      }
      const rank = card.slice(0, -1), suit = card.slice(-1);
      const red = suit === 'h' || suit === 'd';
      g.fillStyle = red ? '#a3151a' : '#121212';
      g.font = 'bold 40px "DejaVu Serif", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const flip of [0, 1]) {
        g.save(); if (flip) { g.translate(W, H); g.rotate(Math.PI); }
        g.fillText(rank, 28, 34); pip(g, suit, 28, 72, 13);
        g.restore();
      }
      if (rank === 'Q') {
        // the queen: a pale face under a crown, in a frame
        g.strokeStyle = '#121212'; g.lineWidth = 2; g.strokeRect(54, 60, W - 108, H - 120);
        g.fillStyle = '#d9c9a4'; g.fillRect(56, 62, W - 112, H - 124);
        for (const flip of [0, 1]) {
          g.save(); if (flip) { g.translate(W, H); g.rotate(Math.PI); }
          g.fillStyle = '#20263e'; g.beginPath(); g.moveTo(70, 190); g.quadraticCurveTo(128, 120, 186, 190); g.closePath(); g.fill();
          g.fillStyle = '#f0e2c8'; g.beginPath(); g.ellipse(128, 128, 24, 30, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#1a1010'; g.fillRect(117, 122, 6, 3); g.fillRect(133, 122, 6, 3);
          g.fillStyle = '#a3151a'; g.fillRect(122, 142, 12, 3);
          g.fillStyle = '#c9a55a'; g.beginPath(); g.moveTo(102, 104); for (let i = 0; i <= 4; i++) { g.lineTo(102 + i * 13, i % 2 ? 98 : 80); } g.lineTo(154, 104); g.closePath(); g.fill();
          g.fillStyle = '#a3151a'; g.fillRect(70, 170, 116, 8);
          pip(g, suit, 160, 168, 10);
          g.restore();
        }
      } else if (rank === 'A') {
        pip(g, suit, W / 2, H / 2, 58);
      } else {
        const n = Number(rank);
        const layouts = { 3: [[0.5, 0.2], [0.5, 0.5], [0.5, 0.8]], 7: [[0.3, 0.2], [0.7, 0.2], [0.5, 0.35], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]] };
        for (const [u, v] of layouts[n] || []) pip(g, suit, 58 + u * (W - 116), 60 + v * (H - 120), 22);
      }
      g.restore();
    });
  }, { tile: false });
}
