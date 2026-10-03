/**
 * Music-room textures, all authored for this room (TextureForge GLSL + canvas):
 * the moonlit lawn beyond the bay windows, hand-copied sheet music, the
 * piano's gilt fallboard lettering, spruce soundboard, and the fretwork
 * music desk.
 */

/** Night lawn + yew hedges + a distant folly under a cold moon. HDR multiplied in the material. */
export function nightLawnTexture(forge) {
  return forge.generate('music:nightlawn', {
    size: 1024, aspect: 1.6, tile: false,
    glsl: /* glsl */ `
float branchy(vec2 p, vec2 base, float hgt, float seed) {
  vec2 q = p - base;
  float d = 1e5;
  float tw = 0.014 * (1.0 - q.y / hgt) + 0.002;
  d = min(d, max(abs(q.x - 0.01 * sin(q.y * 12.0 + seed)) - tw, max(-q.y, q.y - hgt)));
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float y0 = hgt * (0.25 + fi * 0.075);
    float side = mod(fi, 2.0) < 0.5 ? -1.0 : 1.0;
    float ang = side * (0.7 + 0.3 * sin(fi * 5.3 + seed));
    vec2 b = rot2(ang) * (q - vec2(0.0, y0));
    float len = hgt * (0.38 - fi * 0.027);
    float bw = 0.004 * (1.0 - clamp(b.y / len, 0.0, 1.0)) + 0.0007;
    d = min(d, max(abs(b.x + 0.01 * sin(b.y * 38.0 + fi)) - bw, max(-b.y, b.y - len)));
    vec2 c = rot2(-side * 0.55) * (b - vec2(0.0, len * 0.5));
    d = min(d, max(abs(c.x) - 0.001, max(-c.y, c.y - len * 0.42)));
  }
  return d;
}
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  vec2 moon = vec2(0.30, 0.80);
  float md = length((p - moon) * vec2(1.6, 1.0));
  vec3 sky = mix(vec3(0.04, 0.06, 0.14), vec3(0.26, 0.34, 0.56), smoothstep(0.3, 1.0, p.y));
  sky += vec3(0.55, 0.64, 0.85) * exp(-md * 4.5) * 0.9;
  float cl = fbm(p * vec2(2.2, 3.4) + vec2(0.1, 0.4), vec2(4.0, 3.0), 6);
  sky = mix(sky, sky * 0.45 + vec3(0.025, 0.03, 0.05), smoothstep(-0.1, 0.45, cl) * 0.75);
  sky += vec3(0.75, 0.8, 0.95) * smoothstep(0.14, 0.0, abs(cl - 0.06)) * exp(-md * 2.6) * 0.55;
  sky = mix(sky, vec3(1.0, 0.98, 0.94) * 1.4, smoothstep(0.05, 0.043, md));
  // stars
  vec2 g = p * vec2(140.0, 90.0);
  vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float st = smoothstep(0.12, 0.0, length(f - (hash22(id) - 0.5) * 0.6)) * step(0.93, hash12(id));
  sky += vec3(0.7, 0.75, 0.9) * st * 0.6 * smoothstep(0.5, 0.8, p.y) * (1.0 - smoothstep(-0.1, 0.4, cl));
  vec3 col = sky;
  // distant woods
  float far = p.y - (0.34 + 0.05 * fbm(vec2(p.x * 9.0, 2.0), vec2(9.0, 1.0), 5));
  col = mix(col, vec3(0.05, 0.065, 0.11), smoothstep(0.003, -0.003, far));
  // folly (little domed temple) on a rise
  vec2 fp = p - vec2(0.72, 0.335);
  float dome = length(fp * vec2(1.0, 1.4) - vec2(0.0, 0.05)) - 0.022;
  float body = sdBox(fp - vec2(0.0, 0.02), vec2(0.03, 0.025));
  float folly = min(max(dome, -fp.y + 0.04), body);
  col = mix(col, vec3(0.16, 0.19, 0.28), smoothstep(0.002, -0.002, folly));
  // lawn (moonlit) and clipped yew hedges
  float lawn = p.y - (0.27 + 0.015 * sin(p.x * 6.0));
  vec3 grass = mix(vec3(0.07, 0.1, 0.14), vec3(0.2, 0.25, 0.34), smoothstep(0.0, 0.27, p.y)) * (0.8 + 0.2 * fbm(p * 30.0, vec2(30.0), 3));
  col = mix(col, grass, smoothstep(0.003, -0.003, lawn));
  float hedge = max(p.y - (0.17 + 0.012 * fbm(vec2(p.x * 25.0, 0.0), vec2(25.0, 1.0), 3)), -p.y + 0.0);
  col = mix(col, vec3(0.015, 0.022, 0.03), smoothstep(0.003, -0.003, hedge));
  float t = min(branchy(p, vec2(0.08, 0.15), 0.8, 1.0), branchy(p, vec2(0.93, 0.18), 0.62, 3.0));
  col = mix(col, vec3(0.01, 0.012, 0.02), smoothstep(0.0025, -0.0025, t));
  s.albedo = col; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Spruce soundboard: fine straight grain, honey colour, with the maker's rose decal near the bass. */
export function soundboardTexture(forge) {
  return forge.generate('music:soundboard', {
    size: 1024, normalStrength: 0.2,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float n = fbm(vec2(uv.x * 4.0, uv.y * 0.6), vec2(4.0, 1.0), 4);
  float grain = sin((uv.x * 90.0 + n * 3.0) * 6.2831);
  float fine = sin((uv.x * 360.0 + n * 9.0) * 6.2831);
  vec3 base = mix(vec3(0.62, 0.45, 0.24), vec3(0.74, 0.56, 0.32), 0.5 + 0.5 * grain);
  base *= 0.92 + 0.08 * fine;
  base *= 0.85 + 0.25 * fbm(uv * 3.0, vec2(3.0), 3);
  s.albedo = base;
  s.height = 0.5 + 0.02 * grain;
  s.rough = 0.42; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Aged hand-written score (canvas). `seed` varies the notes; `title` written across the top. */
export function sheetMusicTexture(forge, { seed = 1, title = '', w = 512, h = 680, stained = 0.5 } = {}) {
  return forge.canvas(`music:sheet:${seed}:${title}`, w, h, (g) => {
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    // paper
    const grad = g.createRadialGradient(w * 0.5, h * 0.45, h * 0.1, w * 0.5, h * 0.5, h * 0.75);
    grad.addColorStop(0, '#e9dcbc'); grad.addColorStop(1, '#b9a275');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(90,60,20,${rnd() * 0.05})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    // foxing / stains
    for (let i = 0; i < 6 * stained; i++) {
      const x = rnd() * w, y = rnd() * h, r = 10 + rnd() * 50;
      const sg = g.createRadialGradient(x, y, 0, x, y, r);
      sg.addColorStop(0, 'rgba(120,80,30,0.18)'); sg.addColorStop(0.8, 'rgba(120,80,30,0.08)'); sg.addColorStop(1, 'rgba(120,80,30,0)');
      g.fillStyle = sg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(30,20,12,0.85)'; g.fillStyle = 'rgba(25,16,10,0.9)';
    if (title) { g.font = `italic ${Math.round(h * 0.04)}px Georgia, serif`; g.textAlign = 'center'; g.fillText(title, w / 2, h * 0.07); }
    const sys = 9, top = h * 0.12, gap = (h * 0.84) / sys, ls = gap * 0.085;
    for (let k = 0; k < sys; k++) {
      const y0 = top + k * gap;
      g.lineWidth = Math.max(1, h / 700);
      for (let l = 0; l < 5; l++) { g.beginPath(); g.moveTo(w * 0.07, y0 + l * ls); g.lineTo(w * 0.93, y0 + l * ls); g.stroke(); }
      // clef-ish squiggle
      g.lineWidth = 2; g.beginPath(); g.arc(w * 0.1, y0 + ls * 2.5, ls * 1.3, 0, Math.PI * 1.6); g.stroke();
      // bar lines and notes
      const bars = 4;
      for (let b = 0; b <= bars; b++) { const x = w * 0.15 + (w * 0.78) * (b / bars); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + ls * 4); g.stroke(); }
      let x = w * 0.17;
      while (x < w * 0.91) {
        const step = Math.floor(rnd() * 9) - 2;
        const y = y0 + ls * 4 - step * ls * 0.5;
        g.save(); g.translate(x, y); g.rotate(-0.35); g.beginPath(); g.ellipse(0, 0, ls * 0.62, ls * 0.42, 0, 0, Math.PI * 2);
        if (rnd() < 0.8) g.fill(); else { g.lineWidth = 1.4; g.stroke(); }
        g.restore();
        g.lineWidth = 1.3; g.beginPath(); g.moveTo(x + ls * 0.55, y); g.lineTo(x + ls * 0.55, y - ls * 3.2); g.stroke();
        if (rnd() < 0.35) { g.beginPath(); g.moveTo(x + ls * 0.55, y - ls * 3.2); g.quadraticCurveTo(x + ls * 1.4, y - ls * 2.4, x + ls * 1.1, y - ls * 1.4); g.stroke(); }
        x += ls * (2.2 + rnd() * 2.6);
      }
    }
    // edge darkening
    const eg = g.createLinearGradient(0, 0, w, 0);
    eg.addColorStop(0, 'rgba(80,50,20,0.25)'); eg.addColorStop(0.06, 'rgba(80,50,20,0)'); eg.addColorStop(0.94, 'rgba(80,50,20,0)'); eg.addColorStop(1, 'rgba(80,50,20,0.25)');
    g.fillStyle = eg; g.fillRect(0, 0, w, h);
  }, { tile: false });
}

/** Gilt lettering on the fallboard: maker's name in a cartouche. Transparent background. */
export function nameboardTexture(forge) {
  return forge.canvas('music:nameboard', 1024, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, h * 0.2, 0, h * 0.8);
    grad.addColorStop(0, '#f6dc8a'); grad.addColorStop(0.5, '#b88a2e'); grad.addColorStop(1, '#f0cf78');
    g.fillStyle = grad; g.strokeStyle = grad;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${Math.round(h * 0.42)}px "Times New Roman", Georgia, serif`;
    g.fillText('H · STAUF  &  SÖHNE', w / 2, h * 0.47);
    g.font = `italic ${Math.round(h * 0.16)}px Georgia, serif`;
    g.fillText('Hof-Pianofortefabrik', w / 2, h * 0.86);
    g.lineWidth = 2;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(w / 2 + s * w * 0.27, h * 0.47); g.bezierCurveTo(w / 2 + s * w * 0.33, h * 0.2, w / 2 + s * w * 0.37, h * 0.8, w / 2 + s * w * 0.42, h * 0.47); g.stroke();
      g.beginPath(); g.arc(w / 2 + s * w * 0.43, h * 0.47, 4, 0, Math.PI * 2); g.fill();
    }
  }, { tile: false });
}

/** Fretwork for the music desk: scrolling lyre pattern cut through the panel (alpha). */
export function fretworkTexture(forge) {
  return forge.generate('music:fretwork', {
    size: 1024, aspect: 2.6, tile: false, normalStrength: 0.6,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv * vec2(2.6, 1.0);
  // border
  float border = max(abs(uv.x - 0.5) * 2.0, abs(uv.y - 0.5) * 2.0);
  float inBorder = step(0.9, max(abs(uv.x - 0.5) * 2.0 / 1.0, 0.0)) + step(0.86, abs(uv.y - 0.5) * 2.0);
  // repeating scroll cells
  vec2 cell = vec2(fract(p.x * 2.0) - 0.5, uv.y - 0.5);
  float c1 = abs(length(cell * vec2(1.0, 1.15) - vec2(0.0, 0.0)) - 0.28) - 0.035;
  float c2 = abs(length(cell - vec2(0.25, 0.22)) - 0.12) - 0.03;
  float c3 = abs(length(cell - vec2(-0.25, -0.22)) - 0.12) - 0.03;
  float c4 = abs(length(cell - vec2(0.25, -0.22)) - 0.12) - 0.03;
  float c5 = abs(length(cell - vec2(-0.25, 0.22)) - 0.12) - 0.03;
  float bar = abs(cell.y) - 0.025;
  float solid = min(min(min(c1, c2), min(c3, min(c4, c5))), bar);
  float keep = max(step(solid, 0.0), clamp(inBorder, 0.0, 1.0));
  vec3 wood = vec3(0.03, 0.025, 0.022) * (0.9 + 0.2 * fbm(uv * vec2(20.0, 4.0), vec2(20.0, 4.0), 3));
  s.albedo = wood;
  s.height = 0.5 + 0.2 * keep;
  s.rough = 0.25; s.metal = 0.0; s.ao = 1.0;
  s.alpha = keep;
}`,
  });
}
