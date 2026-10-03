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

/**
 * Aged engraved score (canvas, high-res): title and tempo, braced grand-staff
 * systems with drawn treble/bass clefs, key signature, time signature, beamed
 * quavers, crotchets, minims, rests, ledger lines, slurs, hairpins, dynamics,
 * bar numbers, foxing and a soft gutter shadow. `seed` varies the music.
 */
export function sheetMusicTexture(forge, { seed = 1, title = '', w = 1024, h = 1360, stained = 0.5 } = {}) {
  return forge.canvas(`music:sheet2:${seed}:${title}:${w}`, w, h, (g) => {
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const grad = g.createRadialGradient(w * 0.5, h * 0.45, h * 0.1, w * 0.5, h * 0.5, h * 0.78);
    grad.addColorStop(0, '#efe3c6'); grad.addColorStop(1, '#c4ad80');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(90,60,20,${rnd() * 0.05})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    for (let i = 0; i < 8 * stained; i++) {
      const x = rnd() * w, y = rnd() * h, r = 12 + rnd() * 70;
      const sg = g.createRadialGradient(x, y, 0, x, y, r);
      sg.addColorStop(0, 'rgba(130,85,30,0.14)'); sg.addColorStop(0.85, 'rgba(120,80,30,0.07)'); sg.addColorStop(1, 'rgba(120,80,30,0)');
      g.fillStyle = sg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const ink = 'rgba(22,15,10,0.92)';
    g.strokeStyle = ink; g.fillStyle = ink; g.textAlign = 'center';
    const U = w / 1024;  // unit scale
    if (title) {
      g.font = `italic ${Math.round(34 * U)}px Georgia, "Times New Roman", serif`; g.fillText(title, w / 2, 62 * U);
      g.font = `${Math.round(18 * U)}px Georgia, serif`; g.fillText('H. Kessler, op. posth.', w * 0.8, 96 * U);
      g.textAlign = 'left'; g.font = `italic bold ${Math.round(20 * U)}px Georgia, serif`; g.fillText('Lento, con dolore', w * 0.08, 112 * U); g.textAlign = 'center';
    }
    const left = w * 0.07, right = w * 0.94;
    const ls = 9.5 * U;                    // staff line spacing
    const systems = title ? 5 : 6;
    const top0 = title ? 150 * U : 70 * U;
    const sysGap = (h - top0 - 40 * U) / systems;
    const trebleClef = (x, y) => {   // y = G line (2nd from bottom)
      g.save(); g.lineWidth = 2.2 * U; g.beginPath();
      g.moveTo(x + 2 * U, y + ls * 3.4);
      g.bezierCurveTo(x - 6 * U, y + ls * 3.6, x - 6 * U, y + ls * 2.6, x + 1 * U, y + ls * 2.5);
      g.moveTo(x + 3 * U, y + ls * 3.2); g.lineTo(x + 6 * U, y - ls * 3.6);
      g.bezierCurveTo(x + 12 * U, y - ls * 4.6, x + 13 * U, y - ls * 2.6, x - 2 * U, y - ls * 0.6);
      g.bezierCurveTo(x - 10 * U, y + ls * 0.6, x - 6 * U, y + ls * 1.9, x + 4 * U, y + ls * 1.6);
      g.bezierCurveTo(x + 14 * U, y + ls * 1.2, x + 11 * U, y - ls * 0.6, x + 2 * U, y - ls * 0.2);
      g.bezierCurveTo(x - 3 * U, y + ls * 0.1, x - 1 * U, y + ls * 0.9, x + 3 * U, y + ls * 0.8);
      g.stroke(); g.beginPath(); g.arc(x - 2 * U, y + ls * 3.25, 2.6 * U, 0, Math.PI * 2); g.fill(); g.restore();
    };
    const bassClef = (x, y) => {     // y = F line (2nd from top)
      g.save(); g.lineWidth = 2.6 * U; g.beginPath();
      g.arc(x + 1 * U, y + 0.2 * ls, 2.8 * U, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(x - 1 * U, y); g.bezierCurveTo(x + 2 * U, y - ls * 1.4, x + 16 * U, y - ls * 1.2, x + 14 * U, y + ls * 0.6);
      g.bezierCurveTo(x + 12 * U, y + ls * 2.0, x + 4 * U, y + ls * 2.8, x - 2 * U, y + ls * 3.2); g.stroke();
      g.beginPath(); g.arc(x + 20 * U, y - ls * 0.5, 1.7 * U, 0, Math.PI * 2); g.arc(x + 20 * U, y + ls * 0.5, 1.7 * U, 0, Math.PI * 2); g.fill(); g.restore();
    };
    const flat = (x, y) => { g.save(); g.lineWidth = 1.3 * U; g.beginPath(); g.moveTo(x, y - ls * 2); g.lineTo(x, y + ls * 0.5); g.bezierCurveTo(x + 6 * U, y - ls * 0.2, x + 6 * U, y - ls * 1.0, x, y - ls * 0.3); g.stroke(); g.restore(); };
    const head = (x, y, filled) => {
      g.save(); g.translate(x, y); g.rotate(-0.38); g.beginPath(); g.ellipse(0, 0, ls * 0.66, ls * 0.44, 0, 0, Math.PI * 2);
      if (filled) g.fill(); else { g.lineWidth = 1.6 * U; g.stroke(); }
      g.restore();
    };
    for (let k = 0; k < systems; k++) {
      const y0 = top0 + k * sysGap;              // top line of treble staff
      const yB = y0 + ls * 4 + ls * 6.5;         // top line of bass staff
      g.lineWidth = 1.05 * U;
      for (const yy of [y0, yB]) for (let l = 0; l < 5; l++) { g.beginPath(); g.moveTo(left, yy + l * ls); g.lineTo(right, yy + l * ls); g.stroke(); }
      // brace + system line
      g.lineWidth = 1.6 * U; g.beginPath(); g.moveTo(left, y0); g.lineTo(left, yB + ls * 4); g.stroke();
      g.lineWidth = 3 * U; g.beginPath(); g.moveTo(left - 7 * U, y0); g.bezierCurveTo(left - 14 * U, y0 + ls * 3, left - 2 * U, (y0 + yB + 4 * ls) / 2 - ls, left - 12 * U, (y0 + yB + 4 * ls) / 2);
      g.bezierCurveTo(left - 2 * U, (y0 + yB + 4 * ls) / 2 + ls, left - 14 * U, yB + ls, left - 7 * U, yB + ls * 4); g.stroke();
      trebleClef(left + 14 * U, y0 + ls * 3);
      bassClef(left + 10 * U, yB + ls);
      // key signature: three flats
      let kx = left + 42 * U;
      for (const [st, sb] of [[2, 3], [-0.5, 0.5], [2.5, 3.5]]) { flat(kx, y0 + st * ls + ls * 0.5); flat(kx, yB + sb * ls + ls * 0.5); kx += 8 * U; }
      if (k === 0) {
        g.font = `bold ${Math.round(ls * 2.3)}px Georgia, serif`;
        for (const yy of [y0, yB]) { g.fillText('3', kx + 12 * U, yy + ls * 1.8); g.fillText('4', kx + 12 * U, yy + ls * 3.9); }
        kx += 20 * U;
      }
      if (k > 0) { g.font = `italic ${Math.round(12 * U)}px Georgia, serif`; g.textAlign = 'left'; g.fillText(String(k * 4 + 1), left, y0 - ls * 1.6); g.textAlign = 'center'; }
      const bars = 4;
      const bx0 = kx + 14 * U, bw = (right - bx0) / bars;
      g.lineWidth = 1.4 * U;
      for (let b = 1; b <= bars; b++) { const x = bx0 + bw * b; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, yB + ls * 4); g.stroke(); }
      for (let b = 0; b < bars; b++) {
        // right hand: a figure per bar
        const fig = Math.floor(rnd() * 3);
        const xs = bx0 + bw * b + bw * 0.12;
        let pitch = Math.floor(rnd() * 6) - 1;
        const noteY = (stp, yTop) => yTop + ls * 4 - stp * ls * 0.5;
        const stemUp = (x, y, len = 3.3) => { g.lineWidth = 1.3 * U; g.beginPath(); g.moveTo(x + ls * 0.6, y); g.lineTo(x + ls * 0.6, y - ls * len); g.stroke(); };
        const ledger = (x, stp) => { if (stp <= -2) for (let l = -2; l >= stp; l -= 2) { g.beginPath(); g.moveTo(x - ls, noteY(l, y0)); g.lineTo(x + ls, noteY(l, y0)); g.stroke(); } };
        if (fig === 0) {   // beamed quavers x6
          const n = 6, dx = (bw * 0.8) / n; const ys = [];
          for (let i = 0; i < n; i++) { pitch += Math.floor(rnd() * 5) - 2; pitch = Math.max(-2, Math.min(9, pitch)); const y = noteY(pitch, y0); ys.push(y); head(xs + i * dx, y, true); ledger(xs + i * dx, pitch); }
          for (let grp = 0; grp < 2; grp++) {
            const i0 = grp * 3, i1 = i0 + 2;
            const top = Math.min(ys[i0], ys[i0 + 1], ys[i1]) - ls * 3.2;
            for (let i = i0; i <= i1; i++) { g.lineWidth = 1.3 * U; g.beginPath(); g.moveTo(xs + i * dx + ls * 0.6, ys[i]); g.lineTo(xs + i * dx + ls * 0.6, top); g.stroke(); }
            g.lineWidth = 4 * U; g.beginPath(); g.moveTo(xs + i0 * dx + ls * 0.6, top); g.lineTo(xs + i1 * dx + ls * 0.6, top); g.stroke();
          }
        } else if (fig === 1) {  // minim + crotchet
          const y = noteY(pitch + 2, y0); head(xs, y, false); stemUp(xs, y);
          const y2 = noteY(pitch + 1, y0); head(xs + bw * 0.55, y2, true); stemUp(xs + bw * 0.55, y2);
          // slur
          g.lineWidth = 1.2 * U; g.beginPath(); g.moveTo(xs, y - ls * 4); g.quadraticCurveTo(xs + bw * 0.3, y - ls * 6, xs + bw * 0.6, y2 - ls * 4.2); g.stroke();
        } else {  // dotted crotchet, quaver, crotchet + a chord
          const y = noteY(pitch + 3, y0); head(xs, y, true); stemUp(xs, y); g.beginPath(); g.arc(xs + ls * 1.2, y, 1.6 * U, 0, Math.PI * 2); g.fill();
          const y2 = noteY(pitch + 4, y0); head(xs + bw * 0.38, y2, true); stemUp(xs + bw * 0.38, y2);
          g.lineWidth = 1.3 * U; g.beginPath(); g.moveTo(xs + bw * 0.38 + ls * 0.6, y2 - ls * 3.3); g.quadraticCurveTo(xs + bw * 0.38 + ls * 1.8, y2 - ls * 2.2, xs + bw * 0.38 + ls * 1.4, y2 - ls * 1.2); g.stroke();
          for (const st of [pitch, pitch + 2, pitch + 4]) head(xs + bw * 0.66, noteY(st, y0), true);
          stemUp(xs + bw * 0.66, noteY(pitch, y0), 5.2);
        }
        // left hand: broken-chord crotchets with a rest
        for (let i = 0; i < 3; i++) {
          const xx = bx0 + bw * b + bw * (0.16 + i * 0.28);
          if (i === 1 && rnd() < 0.3) { g.lineWidth = 2 * U; g.beginPath(); g.moveTo(xx, yB + ls * 1); g.lineTo(xx + ls * 0.6, yB + ls * 1.8); g.lineTo(xx - ls * 0.2, yB + ls * 2.4); g.lineTo(xx + ls * 0.6, yB + ls * 3.2); g.stroke(); continue; }
          const stp = Math.floor(rnd() * 6) + 1; const yy = yB + ls * 4 - stp * ls * 0.5;
          head(xx, yy, true); g.lineWidth = 1.3 * U; g.beginPath(); g.moveTo(xx - ls * 0.6, yy); g.lineTo(xx - ls * 0.6, yy + ls * 3.3); g.stroke();
        }
      }
      // dynamics + hairpin between the staves
      const midY = y0 + ls * 4 + ls * 3.4;
      g.font = `italic bold ${Math.round(17 * U)}px Georgia, serif`;
      g.fillText(['pp', 'p', 'mf', 'pp', 'p', 'ppp'][(k + seed) % 6], bx0 + 6 * U, midY + 5 * U);
      g.lineWidth = 1.1 * U; const hx = bx0 + bw * (1 + rnd()), hw = bw * 0.9;
      g.beginPath(); g.moveTo(hx, midY); g.lineTo(hx + hw, midY - ls * 0.7); g.moveTo(hx, midY); g.lineTo(hx + hw, midY + ls * 0.7); g.stroke();
    }
    // page edge darkening + gutter shadow
    const eg = g.createLinearGradient(0, 0, w, 0);
    eg.addColorStop(0, 'rgba(80,50,20,0.28)'); eg.addColorStop(0.05, 'rgba(80,50,20,0)'); eg.addColorStop(0.95, 'rgba(80,50,20,0)'); eg.addColorStop(1, 'rgba(80,50,20,0.28)');
    g.fillStyle = eg; g.fillRect(0, 0, w, h);
    const vg = g.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, 'rgba(80,50,20,0.18)'); vg.addColorStop(0.04, 'rgba(80,50,20,0)'); vg.addColorStop(0.96, 'rgba(80,50,20,0)'); vg.addColorStop(1, 'rgba(80,50,20,0.22)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
  }, { tile: false });
}

/** Painted harp soundboard: pale spruce with a gilt ribbon border and a trailing garland. */
export function harpSoundboardTexture(forge) {
  return forge.canvas('music:harpboard', 256, 1024, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, '#9c7a48'); bg.addColorStop(0.5, '#caa36a'); bg.addColorStop(1, '#9c7a48');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    let s = 7; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < 140; i++) { const x = rnd() * w; g.strokeStyle = `rgba(90,60,25,${0.05 + rnd() * 0.1})`; g.lineWidth = 0.6 + rnd(); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (rnd() - 0.5) * 6, h); g.stroke(); }
    g.strokeStyle = '#d9b45a'; g.lineWidth = 5; g.strokeRect(12, 8, w - 24, h - 16);
    g.strokeStyle = 'rgba(60,30,10,0.6)'; g.lineWidth = 1.5; g.strokeRect(20, 16, w - 40, h - 32);
    // garland: a sine vine with leaves and rosettes, gilt with dark outline
    for (let side = -1; side <= 1; side += 2) {
      g.strokeStyle = '#c99a40'; g.lineWidth = 3; g.beginPath();
      for (let y = 30; y < h - 30; y += 4) { const x = w / 2 + side * (34 + 18 * Math.sin(y * 0.03)); if (y === 30) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
      for (let y = 50; y < h - 40; y += 46) {
        const x = w / 2 + side * (34 + 18 * Math.sin(y * 0.03));
        g.fillStyle = '#d4a94c'; g.save(); g.translate(x, y); g.rotate(side * 0.8 + Math.sin(y) * 0.3); g.beginPath(); g.ellipse(side * 10, 0, 11, 4.5, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(70,40,10,0.7)'; g.lineWidth = 1; g.stroke(); g.restore();
        if ((y / 46) % 3 < 1) { g.fillStyle = '#7a2a22'; g.beginPath(); g.arc(x, y + 20, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e0bf6a'; g.beginPath(); g.arc(x, y + 20, 2.5, 0, Math.PI * 2); g.fill(); }
      }
    }
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

/**
 * Dense flocked damask for the upper walls: a satin crown-damask in a half-drop
 * ogee lattice, small sprigs between, a fine trellis ground and a hair-line of
 * tarnished gilt on the lattice. Tone-on-tone deep Prussian blue. One tile =
 * two big motifs + two sprigs (use repeat ~ 1/0.42 m).
 */
export function wallpaperTexture(forge) {
  return forge.generate('music:wallpaper:v3', {
    size: 1024, normalStrength: 1.1,
    glsl: /* glsl */ `
float leafV(vec2 p, vec2 c, float ang, float len, float wid) { p -= c; p = rot2(ang) * p; return sdVesica(p, len, len - wid); }
float bigMotif(vec2 p) {
  p.x = abs(p.x);
  float d = sdVesica(p - vec2(0.0, 0.01), 0.34, 0.318);
  d = min(d, leafV(p, vec2(0.0, 0.29), 0.0, 0.12, 0.045));
  d = min(d, leafV(p, vec2(0.055, 0.265), -0.8, 0.095, 0.036));
  d = min(d, sdArc(rot2(-2.2) * (p - vec2(0.105, 0.165)), vec2(sin(1.9), cos(1.9)), 0.066, 0.011));
  d = min(d, sdCircle(p - vec2(0.18, 0.195), 0.019));
  d = min(d, leafV(p, vec2(0.115, 0.02), -1.05, 0.17, 0.066));
  d = min(d, leafV(p, vec2(0.215, 0.085), -0.35, 0.075, 0.028));
  d = min(d, sdArc(rot2(0.6) * (p - vec2(0.13, -0.125)), vec2(sin(2.0), cos(2.0)), 0.075, 0.011));
  d = min(d, sdCircle(p - vec2(0.205, -0.09), 0.017));
  vec2 q = p - vec2(0.0, -0.235);
  float fan = 1e5;
  for (int i = 0; i < 5; i++) { float a = -1.2 + float(i) * 0.6; fan = min(fan, sdVesica(rot2(a) * q - vec2(0.0, -0.07), 0.075, 0.058)); }
  d = min(d, max(fan, q.y - 0.02));
  d = min(d, sdCircle(q, 0.03));
  d = min(d, sdCircle(p - vec2(0.0, 0.43), 0.016));
  float vein = sdSegment(rot2(-1.05) * (p - vec2(0.115, 0.02)), vec2(0.0, -0.13), vec2(0.0, 0.13)) - 0.0035;
  d = max(d, -vein);
  d = max(d, -max(abs(p.x) - 0.0035, abs(p.y - 0.01) - 0.27));
  // inner outline of the spine (a satin keyline)
  d = max(d, -(abs(sdVesica(p - vec2(0.0, 0.01), 0.3, 0.29)) - 0.003));
  return d;
}
float sprig(vec2 p) {
  p.x = abs(p.x);
  float d = sdVesica(p - vec2(0.0, 0.02), 0.11, 0.1);
  d = min(d, leafV(p, vec2(0.05, -0.01), -1.0, 0.07, 0.028));
  d = min(d, sdCircle(p - vec2(0.0, 0.12), 0.014));
  d = min(d, sdCircle(p - vec2(0.075, 0.06), 0.01));
  return d;
}
float ogeeLine(vec2 uv, float x0, float sgn) {
  float f = x0 + sgn * 0.25 * cos(TAU * uv.y);
  float df = sgn * 0.25 * TAU * sin(TAU * uv.y);
  float dx = uv.x - f; dx -= floor(dx + 0.5);
  return abs(dx) / sqrt(1.0 + df * df);
}
void surface(vec2 uv, inout Surface s) {
  vec3 ground = vec3(0.15, 0.19, 0.38);
  vec3 satin  = vec3(0.25, 0.31, 0.56);
  vec3 latC   = vec3(0.2, 0.25, 0.47);
  // motifs: big at (0.5,0.5) and (0,0); sprigs at (0,0.5),(0.5,0)
  vec2 a = uv - vec2(0.5); vec2 b = fract(uv + 0.5) - 0.5;
  vec2 c = vec2(fract(uv.x + 0.5) - 0.5, uv.y - 0.5); vec2 e = vec2(uv.x - 0.5, fract(uv.y + 0.5) - 0.5);
  float dm = min(bigMotif(a * 2.05), bigMotif(b * 2.05)) / 2.05;
  float ds = min(sprig(c * 2.4), sprig(e * 2.4)) / 2.4;
  float dMot = min(dm, ds);
  // ogee lattice: double keyline
  float ol = min(min(ogeeLine(uv, 0.5, 1.0), ogeeLine(uv, 0.5, -1.0)), min(ogeeLine(uv, 0.0, 1.0), ogeeLine(uv, 0.0, -1.0)));
  float lat = max(stroke(ol, 0.0042, 0.0012), 0.0);
  float latOuter = stroke(abs(ol - 0.011), 0.0016, 0.001);
  // beads at lattice crossings
  vec2 cr = vec2(fract(uv.x * 2.0 + 0.0) - 0.5, fract(uv.y * 2.0 + 0.5) - 0.5) / 2.0;
  float bead = fill(length(cr) - 0.012, 0.0015);
  // fine trellis ground (diaper) - barely visible
  vec2 tg = rot2(0.785398) * uv * 22.627;
  float tre = stroke(min(abs(fract(tg.x) - 0.5), abs(fract(tg.y) - 0.5)), 0.03, 0.03);
  float mot = fill(dMot, 0.0018);
  float edge = stroke(dMot, 0.0025, 0.0015);
  // woven / flocked fibre noise
  float fib = fbm(uv * vec2(160.0, 160.0), vec2(160.0), 3) * 0.5 + 0.5;
  float warp = fbm(uv * vec2(512.0, 8.0), vec2(512.0, 8.0), 2) * 0.5 + 0.5;
  vec3 col = ground * (0.92 + 0.12 * fib) * (1.0 + 0.06 * tre);
  col = mix(col, latC, max(lat, latOuter) * 0.9);
  col = mix(col, satin * (0.9 + 0.2 * warp), mot);
  col = mix(col, ground * 0.75, edge * (1.0 - mot) * 0.6);
  // gilt hair-line: centre of the lattice keyline + beads, tarnished
  float gold = max(stroke(ol, 0.0011, 0.0009), bead);
  float tarn = smoothstep(0.2, 0.8, fbm(uv * 6.0, vec2(6.0), 3) * 0.5 + 0.5);
  col = mix(col, mix(vec3(0.62, 0.48, 0.24), vec3(0.32, 0.27, 0.18), tarn), gold * 0.85);
  // ageing: soft macro mottle + faint vertical sun-fade streaks
  float mott = fbm(uv * 2.0, vec2(2.0), 4) * 0.5 + 0.5;
  col *= 0.88 + 0.2 * mott;
  s.albedo = col;
  s.height = 0.45 + 0.28 * domeh(dMot, 0.01) + 0.12 * lat + 0.08 * bead + 0.03 * fib;
  s.rough = mix(0.88, 0.42, mot) - 0.1 * gold;
  s.metal = gold * 0.9;
  s.ao = 1.0 - 0.25 * edge * (1.0 - mot);
}`,
  });
}

/** Charred log bark (albedo) and its glowing crack mask (albedo = ember colour) — same pattern. */
const LOG_GLSL = (glow) => /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv * vec2(3.0, 6.0);
  vec2 q = p + vec2(fbm(uv * vec2(2.0, 4.0), vec2(2.0, 4.0), 3) * 0.5, 0.0);
  float e = voronoiEdge(q * vec2(1.0, 0.5) * 3.0, vec2(9.0, 9.0), 0.9);
  float ridge = fbm(uv * vec2(4.0, 40.0), vec2(4.0, 40.0), 4) * 0.5 + 0.5;
  float crack = 1.0 - smoothstep(0.0, 0.06, e);
  float hot = smoothstep(0.35, 0.8, fbm(uv * vec2(2.0, 3.0) + 3.1, vec2(2.0, 3.0), 4) * 0.5 + 0.5);
  ${glow ? `
  vec3 ember = mix(vec3(0.9, 0.18, 0.02), vec3(1.0, 0.62, 0.2), hot);
  float g = crack * (0.25 + 0.75 * hot) + 0.12 * hot * (1.0 - ridge);
  s.albedo = ember * g; s.height = 0.5; s.rough = 1.0;` : `
  vec3 coal = mix(vec3(0.035, 0.03, 0.028), vec3(0.11, 0.1, 0.095), ridge);
  coal = mix(coal, vec3(0.32, 0.3, 0.28), smoothstep(0.7, 0.95, ridge) * 0.6); // ash on the ridges
  s.albedo = mix(coal, vec3(0.02, 0.01, 0.005), crack);
  s.height = 0.5 + 0.35 * ridge - 0.4 * crack;
  s.rough = 0.95;`}
  s.metal = 0.0; s.ao = 1.0 - 0.5 * crack;
}`;
export function logTextures(forge) {
  return {
    bark: forge.generate('music:logbark', { size: 512, normalStrength: 2.0, glsl: LOG_GLSL(false) }),
    glow: forge.generate('music:logglow', { size: 512, glsl: LOG_GLSL(true) }),
  };
}

/** Ember bed / fireback glow mask: cellular coals, hot at the centre front. (albedo = glow colour) */
export function emberTexture(forge) {
  return forge.generate('music:embers', {
    size: 512, tile: false,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec4 v = voronoi(uv * vec2(14.0, 9.0), vec2(14.0, 9.0), 0.9);
  float cellHot = hash12(v.zw);
  float inner = 1.0 - smoothstep(0.0, 0.5, v.x);
  float gap = smoothstep(0.02, 0.12, v.y - v.x);
  float n = fbm(uv * 5.0, vec2(5.0), 4) * 0.5 + 0.5;
  float centre = exp(-pow(length((uv - vec2(0.5, 0.42)) * vec2(1.3, 2.2)), 2.0) * 3.0);
  float heat = clamp(centre * (0.35 + 0.9 * cellHot) * (0.6 + 0.6 * n), 0.0, 1.2);
  vec3 col = mix(vec3(0.5, 0.06, 0.0), vec3(1.0, 0.45, 0.1), smoothstep(0.3, 0.9, heat));
  col = mix(col, vec3(1.0, 0.75, 0.4), smoothstep(0.9, 1.15, heat * inner));
  s.albedo = col * heat * mix(0.25, 1.0, gap) * (0.6 + 0.4 * inner);
  s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Sooty cast-iron fireback with a raised lyre-and-wreath relief. */
export function firebackTexture(forge) {
  return forge.generate('music:fireback', {
    size: 512, tile: false, normalStrength: 2.5,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = (uv - vec2(0.5, 0.55)) * vec2(1.0, 1.1);
  float wreath = abs(length(p) - 0.28) - 0.03;
  vec2 ap = vec2(abs(p.x), p.y);
  float lyre = abs(length((ap - vec2(0.09, 0.0)) * vec2(1.6, 0.8)) - 0.12) - 0.012;
  lyre = max(lyre, -p.y - 0.12);
  float bar = sdBox(p - vec2(0.0, 0.1), vec2(0.12, 0.01));
  float strs = max(abs(fract(p.x * 30.0) - 0.5) - 0.12, abs(p.y + 0.02) - 0.11);
  strs = max(strs, abs(p.x) - 0.07);
  float border = abs(sdBox(uv - 0.5, vec2(0.44, 0.44))) - 0.012;
  float relief = min(min(min(wreath, lyre), bar), min(strs * 0.02, border));
  float rel = fill(relief, 0.004);
  float soot = fbm(uv * 6.0, vec2(6.0), 5) * 0.5 + 0.5;
  vec3 col = mix(vec3(0.03, 0.028, 0.027), vec3(0.09, 0.08, 0.075), soot * 0.6 + rel * 0.4);
  s.albedo = col;
  s.height = 0.5 + 0.35 * domeh(relief, 0.01) + 0.05 * soot;
  s.rough = mix(0.95, 0.6, rel); s.metal = 0.3 * rel; s.ao = 1.0;
}`,
  });
}

/**
 * Oil portrait of the composer (canvas): a three-quarter bust in Rembrandt
 * chiaroscuro — umber ground, black coat, white stock, a gaunt lit face with a
 * wild grey mane — finished with brush texture, canvas weave, craquelure and
 * yellowed varnish. Authored for this room.
 */
export function portraitTexture(forge, { w = 1024, h = 1348 } = {}) {
  return forge.canvas('music:portrait:v2', w, h, (g) => {
    let sd = 1879; const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
    const X = (v) => v * w, Y = (v) => v * h;
    const ell = (cx, cy, rx, ry, color, rot = 0) => { g.save(); g.translate(X(cx), Y(cy)); g.rotate(rot); g.scale(X(rx), Y(ry)); g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.restore(); g.fillStyle = color; g.fill(); };
    const soft = (cx, cy, r, color, a) => { const gr = g.createRadialGradient(X(cx), Y(cy), 0, X(cx), Y(cy), X(r)); gr.addColorStop(0, color.replace('A', a)); gr.addColorStop(1, color.replace('A', 0)); g.fillStyle = gr; g.fillRect(0, 0, w, h); };
    // ground: warm umber, lit behind the head on the left
    const bg = g.createRadialGradient(X(0.36), Y(0.3), X(0.05), X(0.45), Y(0.45), X(0.9));
    bg.addColorStop(0, '#5a4630'); bg.addColorStop(0.45, '#2c2016'); bg.addColorStop(1, '#0d0906');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const x = rnd() * w, y = rnd() * h, l = 20 + rnd() * 60; g.strokeStyle = `rgba(${60 + rnd() * 40},${45 + rnd() * 25},${25 + rnd() * 15},${0.05 + rnd() * 0.06})`; g.lineWidth = 6 + rnd() * 10; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * Math.cos(rnd() * 6), y + l * Math.sin(rnd() * 6)); g.stroke(); }
    // coat: broad black shoulders with a dull highlight on the lit shoulder
    g.fillStyle = '#0a0807';
    g.beginPath(); g.moveTo(X(-0.05), Y(1.0)); g.bezierCurveTo(X(0.0), Y(0.78), X(0.18), Y(0.66), X(0.36), Y(0.62)); g.lineTo(X(0.62), Y(0.62));
    g.bezierCurveTo(X(0.82), Y(0.66), X(0.98), Y(0.76), X(1.05), Y(1.0)); g.closePath(); g.fill();
    soft(0.2, 0.74, 0.22, 'rgba(70,60,50,A)', 0.45);
    // lapels
    g.strokeStyle = 'rgba(40,34,30,0.9)'; g.lineWidth = X(0.008);
    g.beginPath(); g.moveTo(X(0.38), Y(0.66)); g.lineTo(X(0.3), Y(1.0)); g.moveTo(X(0.6), Y(0.66)); g.lineTo(X(0.7), Y(1.0)); g.stroke();
    // white stock and shirt front, with folds
    g.fillStyle = '#d9cfb8';
    g.beginPath(); g.moveTo(X(0.4), Y(0.6)); g.bezierCurveTo(X(0.42), Y(0.7), X(0.44), Y(0.82), X(0.49), Y(1.0)); g.lineTo(X(0.56), Y(1.0));
    g.bezierCurveTo(X(0.58), Y(0.82), X(0.6), Y(0.7), X(0.6), Y(0.6)); g.closePath(); g.fill();
    ell(0.5, 0.63, 0.1, 0.045, '#e4dbc6');
    for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(120,105,85,${0.25 + rnd() * 0.25})`; g.lineWidth = 2 + rnd() * 3; const x = 0.43 + rnd() * 0.15; g.beginPath(); g.moveTo(X(x), Y(0.6 + rnd() * 0.05)); g.quadraticCurveTo(X(x + 0.02), Y(0.7), X(x + (rnd() - 0.5) * 0.04), Y(0.8 + rnd() * 0.15)); g.stroke(); }
    soft(0.58, 0.72, 0.12, 'rgba(20,15,10,A)', 0.6);
    // neck in shadow
    ell(0.5, 0.56, 0.065, 0.06, '#5a3c2a');
    // head: gaunt oval, turned three-quarters to the left, lit from upper left
    const fx0 = 0.49, fy0 = 0.38;
    g.save();
    g.beginPath(); g.ellipse(X(fx0), Y(fy0 + 0.01), X(0.105), Y(0.15), -0.08, 0, Math.PI * 2);
    g.ellipse(X(fx0 + 0.005), Y(fy0 + 0.12), X(0.07), Y(0.05), 0, 0, Math.PI * 2);
    g.clip();
    g.filter = 'blur(6px)';
    g.fillStyle = '#6e4a34'; g.fillRect(0, 0, w, h);
    soft(fx0 - 0.05, fy0 - 0.05, 0.15, 'rgba(226,186,148,A)', 0.9);       // light on forehead / cheek
    soft(fx0 - 0.03, fy0 + 0.06, 0.06, 'rgba(210,160,125,A)', 0.5);
    soft(fx0 + 0.1, fy0 + 0.03, 0.09, 'rgba(30,18,12,A)', 0.85);           // shadow side
    soft(fx0 + 0.02, fy0 + 0.17, 0.07, 'rgba(40,24,16,A)', 0.6);           // under the jaw
    g.filter = 'blur(2px)';
    // clip the soft light to the head shape: repaint the outside with the ground (cheap mask)
    // (done by drawing hair + coat afterwards, which cover the edges)
    // brows, sockets, eyes
    for (const [ex, sz] of [[fx0 - 0.055, 1.0], [fx0 + 0.05, 0.85]]) {
      ell(ex, fy0 - 0.015, 0.036 * sz, 0.022, 'rgba(60,36,24,0.55)');
      ell(ex, fy0 - 0.012, 0.016 * sz, 0.008, '#1a100a');
      ell(ex - 0.004, fy0 - 0.015, 0.004, 0.003, 'rgba(240,230,210,0.9)');
      g.strokeStyle = 'rgba(70,60,55,0.95)'; g.lineWidth = X(0.009); g.lineCap = 'round';
      g.beginPath(); g.moveTo(X(ex - 0.03 * sz), Y(fy0 - 0.035)); g.quadraticCurveTo(X(ex), Y(fy0 - 0.05), X(ex + 0.03 * sz), Y(fy0 - 0.036)); g.stroke();
      g.strokeStyle = 'rgba(70,40,28,0.5)'; g.lineWidth = X(0.003);
      g.beginPath(); g.moveTo(X(ex - 0.02 * sz), Y(fy0 + 0.004)); g.quadraticCurveTo(X(ex), Y(fy0 + 0.012), X(ex + 0.02 * sz), Y(fy0 + 0.004)); g.stroke();
    }
    // nose: lit bridge, shadow on the right, nostril
    g.strokeStyle = 'rgba(245,215,180,0.7)'; g.lineWidth = X(0.008); g.beginPath(); g.moveTo(X(fx0 - 0.008), Y(fy0 - 0.01)); g.quadraticCurveTo(X(fx0 - 0.012), Y(fy0 + 0.04), X(fx0 - 0.004), Y(fy0 + 0.065)); g.stroke();
    g.strokeStyle = 'rgba(50,28,18,0.75)'; g.lineWidth = X(0.01); g.beginPath(); g.moveTo(X(fx0 + 0.012), Y(fy0 + 0.0)); g.quadraticCurveTo(X(fx0 + 0.02), Y(fy0 + 0.05), X(fx0 + 0.01), Y(fy0 + 0.075)); g.stroke();
    ell(fx0 + 0.006, fy0 + 0.078, 0.022, 0.01, 'rgba(60,32,20,0.8)');
    ell(fx0 - 0.004, fy0 + 0.07, 0.012, 0.008, 'rgba(240,205,170,0.6)');
    // hollow cheeks + nasolabial folds
    soft(fx0 - 0.07, fy0 + 0.07, 0.04, 'rgba(70,40,28,A)', 0.4);
    soft(fx0 + 0.07, fy0 + 0.07, 0.04, 'rgba(30,18,12,A)', 0.5);
    g.strokeStyle = 'rgba(80,48,32,0.55)'; g.lineWidth = X(0.004);
    g.beginPath(); g.moveTo(X(fx0 - 0.03), Y(fy0 + 0.075)); g.quadraticCurveTo(X(fx0 - 0.045), Y(fy0 + 0.1), X(fx0 - 0.04), Y(fy0 + 0.125)); g.stroke();
    // mouth: thin, downturned; grey moustache
    g.strokeStyle = 'rgba(55,25,18,0.95)'; g.lineWidth = X(0.006);
    g.beginPath(); g.moveTo(X(fx0 - 0.04), Y(fy0 + 0.118)); g.quadraticCurveTo(X(fx0 - 0.005), Y(fy0 + 0.108), X(fx0 + 0.035), Y(fy0 + 0.12)); g.stroke();
    ell(fx0 - 0.004, fy0 + 0.13, 0.028, 0.008, 'rgba(150,90,70,0.45)');
    for (let i = 0; i < 40; i++) { const s = rnd() < 0.5 ? -1 : 1; const x = fx0 + s * (0.005 + rnd() * 0.035); g.strokeStyle = `rgba(${170 + rnd() * 50},${165 + rnd() * 40},${155 + rnd() * 30},0.5)`; g.lineWidth = 1.5 + rnd() * 2; g.beginPath(); g.moveTo(X(fx0), Y(fy0 + 0.098)); g.quadraticCurveTo(X(x), Y(fy0 + 0.1), X(x + s * 0.01), Y(fy0 + 0.125 + rnd() * 0.01)); g.stroke(); }
    g.restore();
    g.filter = 'blur(1px)';
    // hair: long grey mane swept back from the brow, falling to the collar, lit on the left
    // dark mass first, then locks
    g.fillStyle = 'rgba(40,36,32,0.85)';
    g.beginPath(); g.moveTo(X(fx0 - 0.1), Y(fy0 - 0.06)); g.bezierCurveTo(X(fx0 - 0.08), Y(fy0 - 0.2), X(fx0 + 0.12), Y(fy0 - 0.22), X(fx0 + 0.16), Y(fy0 - 0.08));
    g.bezierCurveTo(X(fx0 + 0.19), Y(fy0 + 0.05), X(fx0 + 0.17), Y(fy0 + 0.2), X(fx0 + 0.14), Y(fy0 + 0.26));
    g.lineTo(X(fx0 + 0.1), Y(fy0 + 0.1)); g.bezierCurveTo(X(fx0 + 0.09), Y(fy0 - 0.05), X(fx0 + 0.02), Y(fy0 - 0.12), X(fx0 - 0.1), Y(fy0 - 0.06)); g.fill();
    g.beginPath(); g.moveTo(X(fx0 - 0.1), Y(fy0 - 0.06)); g.bezierCurveTo(X(fx0 - 0.14), Y(fy0 + 0.02), X(fx0 - 0.13), Y(fy0 + 0.14), X(fx0 - 0.12), Y(fy0 + 0.2));
    g.lineTo(X(fx0 - 0.1), Y(fy0 + 0.06)); g.closePath(); g.fill();
    for (let i = 0; i < 420; i++) {
      // locks start along the hairline and sweep back (to the right) and down
      const t = rnd();
      const x0 = fx0 - 0.09 + t * 0.12 + (rnd() - 0.5) * 0.02, y0 = fy0 - 0.08 - Math.sin(t * Math.PI) * 0.09 + (rnd() - 0.5) * 0.02;
      const len = 0.1 + rnd() * 0.16;
      const x1 = x0 + len * (0.55 + rnd() * 0.3), y1 = y0 + len * (0.35 + t * 0.9);
      const lit = 1 - t;
      const v = 70 + lit * 120 + rnd() * 25;
      g.strokeStyle = `rgba(${v},${v * 0.97},${v * 0.92},${0.22 + rnd() * 0.3})`; g.lineWidth = 1.5 + rnd() * 3;
      g.beginPath(); g.moveTo(X(x0), Y(y0)); g.bezierCurveTo(X(x0 + len * 0.3), Y(y0 - 0.04), X(x1 - 0.02), Y(y1 - len * 0.4), X(x1), Y(y1)); g.stroke();
    }
    for (let i = 0; i < 90; i++) { const y0 = fy0 - 0.03 + rnd() * 0.2; const x0 = fx0 - 0.105 - rnd() * 0.02; const v = 130 + rnd() * 70; g.strokeStyle = `rgba(${v},${v},${v * 0.94},0.3)`; g.lineWidth = 1.5 + rnd() * 2; g.beginPath(); g.moveTo(X(x0), Y(y0)); g.quadraticCurveTo(X(x0 - 0.02), Y(y0 + 0.05), X(x0 - 0.005), Y(y0 + 0.1)); g.stroke(); }
    g.filter = 'none';
    // side-whiskers
    for (let i = 0; i < 120; i++) { const s = rnd() < 0.5 ? -1 : 1; const x = fx0 + s * (0.105 + rnd() * 0.02); const y = fy0 + rnd() * 0.08; const v = s < 0 ? 170 + rnd() * 50 : 60 + rnd() * 40; g.strokeStyle = `rgba(${v},${v},${v * 0.95},0.4)`; g.lineWidth = 2; g.beginPath(); g.moveTo(X(x), Y(y)); g.lineTo(X(x - s * 0.01), Y(y + 0.03)); g.stroke(); }
    // brush texture over everything + canvas weave
    for (let i = 0; i < 2500; i++) { const x = rnd() * w, y = rnd() * h; const l = 6 + rnd() * 16; const a = rnd() * Math.PI; g.strokeStyle = `rgba(${rnd() < 0.5 ? '255,240,210' : '0,0,0'},${0.03 + rnd() * 0.04})`; g.lineWidth = 2 + rnd() * 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    for (let x = 0; x < w; x += 3) g.fillRect(x, 0, 1, h);
    // craquelure: a network of fine dark cracks
    g.strokeStyle = 'rgba(15,10,5,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 700; i++) {
      let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; g.lineTo(x, y); }
      g.stroke();
    }
    // yellowed varnish + darkened edges
    g.fillStyle = 'rgba(120,90,20,0.12)'; g.fillRect(0, 0, w, h);
    const vg = g.createRadialGradient(w / 2, h * 0.42, w * 0.3, w / 2, h / 2, w * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,6,2,0.65)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
  }, { tile: false });
}

/**
 * The view out of the bay in three parallax layers (each HDR-multiplied in its material):
 *  sky  — gradient, a cold moon with a soft halo and a faint 22-degree ring, moonlit cloud banks, stars
 *  mid  — the lawn with mown stripes, clipped yew hedges and topiary, the domed folly, a ragged
 *         treeline of pines and bare oaks against the sky (alpha above the trees)
 *  near — a gnarled bare tree just outside the glass, its twigs silhouetted (alpha elsewhere)
 */
const NIGHT_COMMON = /* glsl */ `
float twig(vec2 p, vec2 base, float hgt, float seed, float lean) {
  vec2 q = p - base;
  q.x -= lean * q.y * q.y;
  float d = 1e5;
  float tw = 0.02 * (1.0 - clamp(q.y / hgt, 0.0, 1.0)) + 0.002;
  d = min(d, max(abs(q.x - 0.012 * sin(q.y * 9.0 + seed)) - tw, max(-q.y, q.y - hgt)));
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float y0 = hgt * (0.18 + fi * 0.058);
    float side = mod(fi, 2.0) < 0.5 ? -1.0 : 1.0;
    float ang = side * (0.6 + 0.35 * sin(fi * 5.3 + seed));
    vec2 b = rot2(ang) * (q - vec2(0.0, y0));
    float len = hgt * (0.5 - fi * 0.03);
    float bw = 0.006 * (1.0 - clamp(b.y / len, 0.0, 1.0)) + 0.0008;
    d = min(d, max(abs(b.x + 0.012 * sin(b.y * 30.0 + fi)) - bw, max(-b.y, b.y - len)));
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      vec2 c = rot2(-side * (0.5 + 0.2 * fj)) * (b - vec2(0.0, len * (0.3 + 0.22 * fj)));
      float cl = len * (0.38 - 0.08 * fj);
      d = min(d, max(abs(c.x + 0.006 * sin(c.y * 60.0 + fj)) - 0.0012 * (1.0 - clamp(c.y / cl, 0.0, 1.0)) - 0.0004, max(-c.y, c.y - cl)));
    }
  }
  return d;
}
`;
export function nightLayers(forge) {
  const sky = forge.generate('music:nightsky2', {
    size: 2048, aspect: 1.6, tile: false,
    glsl: NIGHT_COMMON + /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  vec2 moon = vec2(0.33, 0.78);
  float md = length((p - moon) * vec2(1.6, 1.0));
  vec3 sky = mix(vec3(0.05, 0.07, 0.15), vec3(0.2, 0.27, 0.46), smoothstep(0.1, 1.0, p.y));
  sky += vec3(0.12, 0.13, 0.16) * smoothstep(0.45, 0.0, p.y);                      // horizon glow
  sky += vec3(0.55, 0.64, 0.85) * exp(-md * 5.0) * 0.8;                           // halo
  sky += vec3(0.25, 0.3, 0.42) * smoothstep(0.012, 0.0, abs(md - 0.2)) * 0.25;    // faint ring
  // long, soft, wind-stretched cloud banks (no fractal islands): low-frequency, smoothly thresholded
  float cl = fbm(p * vec2(1.6, 4.2) + vec2(0.1, 0.4), vec2(2.0, 4.0), 5);
  float cl2 = fbm(p * vec2(4.0, 10.0) + vec2(3.1, 0.2), vec2(4.0, 10.0), 3);
  float c = cl + cl2 * 0.12;
  float cov = smoothstep(-0.2, 0.5, c);
  vec3 cloudCol = sky * 0.5 + vec3(0.025, 0.03, 0.05);
  sky = mix(sky, cloudCol, cov * 0.7);
  // soft silver linings toward the moon
  sky += vec3(0.7, 0.76, 0.95) * smoothstep(0.22, 0.0, abs(c - 0.05)) * exp(-md * 3.0) * 0.4;
  // moon disc with maria
  float mare = fbm((p - moon) * 60.0, vec2(60.0), 4);
  sky = mix(sky, vec3(1.0, 0.98, 0.94) * (1.45 - 0.25 * smoothstep(0.0, 0.5, mare)), smoothstep(0.034, 0.03, md));
  vec2 g = p * vec2(220.0, 140.0);
  vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float st = smoothstep(0.1, 0.0, length(f - (hash22(id) - 0.5) * 0.6)) * step(0.955, hash12(id));
  sky += vec3(0.75, 0.8, 0.95) * st * 0.7 * smoothstep(0.35, 0.8, p.y) * (1.0 - cov);
  s.albedo = sky; s.alpha = 1.0; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
  const mid = forge.generate('music:nightmid2', {
    size: 2048, aspect: 2.2, tile: false,
    glsl: NIGHT_COMMON + /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  float a = 0.0;
  vec3 col = vec3(0.0);
  // treeline: rounded oak crowns and pointed pines, ragged
  float crown = 0.5 + 0.05 * fbm(vec2(p.x * 7.0, 1.0), vec2(7.0, 1.0), 5) + 0.03 * fbm(vec2(p.x * 40.0, 3.0), vec2(40.0, 1.0), 3);
  float pine = 0.0;
  for (int i = 0; i < 9; i++) { float fi = float(i); float x0 = fract(sin(fi * 91.7) * 437.1); float h = 0.08 + 0.06 * fract(sin(fi * 13.1) * 91.3); pine = max(pine, (h - abs(p.x - x0) * 3.2) * step(abs(p.x - x0), 0.04)); }
  float top = max(crown, 0.48 + pine);
  float tree = smoothstep(0.002, -0.002, p.y - top);
  vec3 woods = mix(vec3(0.03, 0.04, 0.07), vec3(0.08, 0.1, 0.16), smoothstep(top - 0.2, top, p.y) * 0.6);
  woods += vec3(0.12, 0.14, 0.2) * smoothstep(0.01, 0.0, top - p.y) * 0.35;     // moonlit crown edges
  col = mix(col, woods, tree); a = max(a, tree);
  // lawn: moonlit, with mown stripes receding
  float horizon = 0.38 + 0.008 * sin(p.x * 5.0);
  float lawn = smoothstep(0.002, -0.002, p.y - horizon);
  float depth = clamp(p.y / horizon, 0.0, 1.0);
  float stripes = 0.5 + 0.5 * sin((p.x - 0.5) / (0.06 + 0.25 * depth) * 3.14159 + 1.0);
  vec3 grass = mix(vec3(0.16, 0.2, 0.28), vec3(0.08, 0.11, 0.16), depth) * (0.85 + 0.15 * stripes) * (0.85 + 0.15 * fbm(p * 40.0, vec2(40.0), 3));
  col = mix(col, grass, lawn); a = max(a, lawn);
  // the folly: a little domed temple on a rise, columns picked out by the moon
  vec2 fp = p - vec2(0.64, horizon);
  float dome = length(fp * vec2(1.0, 1.25) - vec2(0.0, 0.085)) - 0.03;
  float ent = sdBox(fp - vec2(0.0, 0.075), vec2(0.036, 0.006));
  float body = sdBox(fp - vec2(0.0, 0.036), vec2(0.032, 0.036));
  float folly = min(min(max(dome, -fp.y + 0.08), body), ent);
  float cols = step(0.5, fract((fp.x + 0.032) / 0.0128 + 0.25)) * step(abs(fp.x), 0.03) * step(abs(fp.y - 0.036), 0.032);
  vec3 stone = mix(vec3(0.2, 0.23, 0.32), vec3(0.06, 0.07, 0.1), cols);
  stone *= 0.8 + 0.4 * smoothstep(0.03, -0.03, fp.x);
  float fm = smoothstep(0.0015, -0.0015, folly);
  col = mix(col, stone, fm); a = max(a, fm);
  // clipped yew hedges + topiary cones in the middle distance
  float hedgeTop = 0.27 + 0.006 * fbm(vec2(p.x * 30.0, 0.0), vec2(30.0, 1.0), 3);
  float hedge = smoothstep(0.002, -0.002, p.y - hedgeTop) * step(0.2, p.y) * step(0.12, abs(p.x - 0.5));
  for (int i = 0; i < 4; i++) { float fi = float(i); float x0 = 0.18 + fi * 0.21; float cone = (0.12 - abs(p.x - x0) * 2.4) - (p.y - 0.2); hedge = max(hedge, smoothstep(0.0, 0.003, cone) * step(0.2, p.y) * step(p.y, 0.33)); }
  col = mix(col, vec3(0.018, 0.026, 0.034) + vec3(0.04, 0.05, 0.07) * smoothstep(0.0, 0.02, p.y - hedgeTop + 0.02), hedge); a = max(a, hedge);
  s.albedo = col; s.alpha = a; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
  const near = forge.generate('music:nightnear2', {
    size: 1536, aspect: 1.4, tile: false,
    glsl: NIGHT_COMMON + /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv * vec2(1.4, 1.0);
  float t = min(twig(p, vec2(0.06, -0.05), 1.0, 1.0, 0.35), twig(p, vec2(1.36, -0.05), 0.85, 3.0, -0.4));
  float a = smoothstep(0.0022, -0.0022, t);
  s.albedo = vec3(0.012, 0.014, 0.024); s.alpha = a; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
  return { sky, mid, near };
}
