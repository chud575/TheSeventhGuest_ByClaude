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
  // one tile = full runner width (u 0..1 = 1.05 m) x 2.1 m along v: a Persian runner repeat with
  // a lobed central medallion and pendant palmettes on a dense, hand-irregular herati ground,
  // half-diamond spandrels at the tile ends, and a triple border (guards + vine-and-rosette band).
  // Wear, fading and dirt are NOT baked here (they would repeat every 2.1 m); the material adds
  // them in world space (see index.js runner material patch).
  return ctx.textures.generate('gallery:runner3', {
    size: 2048, aspect: 0.5, tile: true, normalStrength: 0.9,
    glsl: /* glsl */ `
    float nz(vec2 p, vec2 per) { return gnoise(p, per); }
    float leafD(vec2 p, vec2 c, float ang, float len, float wid) { p -= c; p = rot2(ang) * p; return sdVesica(p, len, len - wid); }
    // lobed medallion outline: an elongated octagon whose edge carries a ring of rounded lobes
    float medD(vec2 q, vec2 r, float lobes, float lobeA) {
      float d = sdRhombus(q, r) * 0.6 + sdEllipse(q, r * vec2(0.82, 0.8)) * 0.4;
      float a = atan(q.y / r.y, q.x / r.x);
      return d - lobeA * (0.5 + 0.5 * cos(a * lobes));
    }
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv;
      float ax = abs(p.x - 0.5);
      float py = p.y * 4.0;                                  // border units (old 0.525 m tile)
      vec3 crimson = vec3(0.40, 0.065, 0.055);
      vec3 madder = vec3(0.30, 0.048, 0.045);
      vec3 navy = vec3(0.055, 0.075, 0.18);
      vec3 gold = vec3(0.66, 0.48, 0.22);
      vec3 ivory = vec3(0.74, 0.67, 0.53);
      vec3 teal = vec3(0.08, 0.22, 0.22);
      vec3 rose = vec3(0.58, 0.27, 0.22);
      vec3 col;
      float h = 0.55;
      // hand-knotted irregularity: every motif boundary wanders by a few knots
      vec2 wob = vec2(nz(p * vec2(30.0, 60.0), vec2(30.0, 60.0)), nz(p * vec2(30.0, 60.0) + 7.0, vec2(30.0, 60.0))) * 0.004;
      if (ax < 0.29) {
        // metres in the field, origin at the medallion centre
        vec2 m = vec2((p.x - 0.5) * 1.05, (p.y - 0.5) * 2.1) + wob * vec2(1.05, 2.1);
        // ---- ground: small herati repeat (~5 x 6 cm), low contrast so it reads as texture
        vec2 g = vec2(m.x / 0.0508, m.y / 0.0583);
        vec2 gi = floor(g), gf = fract(g) - 0.5;
        float par = mod(gi.x + gi.y, 2.0);
        col = mix(crimson, madder, 0.35 + 0.3 * par);
        float lat = abs(abs(gf.x) + abs(gf.y) - 0.5);
        col = mix(col, mix(col, ivory, 0.45), smoothstep(0.06, 0.02, lat));
        float ros = length(polarRep(gf, 4.0) - vec2(0.16, 0.0)) - 0.08;
        col = mix(col, par > 0.5 ? navy * 1.3 : teal * 0.9, smoothstep(0.03, -0.03, ros) * 0.8);
        col = mix(col, gold * 0.8, smoothstep(0.05, 0.0, length(gf) - 0.06) * 0.7);
        // ---- central medallion (0.9 m long, fills the field width)
        vec2 mq = m;
        float md = medD(mq, vec2(0.27, 0.44), 16.0, 0.014);
        float inMed = smoothstep(0.004, -0.004, md);
        if (md < 0.0) {
          // concentric bands: navy outer field, ivory reciprocal band, crimson heart, gold core
          col = navy * (1.0 + 0.15 * nz(m * 40.0, vec2(40.0)));
          // scrolling vine inside the navy band
          float vr = atan(mq.y, mq.x);
          float rr = length(mq / vec2(0.27, 0.44));
          float vine = abs(rr - 0.78 - 0.045 * sin(vr * 14.0)) - 0.012;
          col = mix(col, gold * 0.75, smoothstep(0.012, -0.004, vine));
          float pal = length(polarRep(mq / vec2(0.27, 0.44), 14.0) - vec2(0.86, 0.0)) - 0.035;
          col = mix(col, rose, smoothstep(0.01, -0.01, pal));
          float md2 = medD(mq, vec2(0.19, 0.31), 12.0, 0.01);
          col = mix(col, ivory * 0.92, smoothstep(0.004, -0.004, md2));
          float md3 = medD(mq, vec2(0.155, 0.255), 12.0, 0.008);
          col = mix(col, crimson * 1.05, smoothstep(0.004, -0.004, md3));
          // heart: eight-petal rosette inside a star
          float st = sdStar(mq * vec2(1.0, 0.7), 0.11, 8.0, 3.0);
          col = mix(col, teal * 1.2, smoothstep(0.004, -0.004, st));
          float pet = length(polarRep(mq, 8.0) - vec2(0.05, 0.0)) - 0.022;
          col = mix(col, ivory, smoothstep(0.004, -0.004, pet));
          col = mix(col, gold, smoothstep(0.004, -0.004, length(mq) - 0.022));
          col = mix(col, navy, smoothstep(0.003, -0.003, length(mq) - 0.01));
          // fine ivory outline at each band edge
          col = mix(col, ivory * 0.8, stroke(md2, 0.0, 0.004) + stroke(md3, 0.0, 0.003));
          h += 0.05;
        }
        col = mix(col, ivory * 0.85, stroke(md, 0.0, 0.0045));
        // pendant palmettes above and below the medallion
        for (int k = 0; k < 2; k++) {
          float sg = k == 0 ? 1.0 : -1.0;
          vec2 pq = vec2(m.x, (m.y - sg * 0.53) * sg);
          float stem = sdBox(pq - vec2(0.0, -0.05), vec2(0.008, 0.05));
          float palm = sdEllipse(pq - vec2(0.0, 0.03), vec2(0.07, 0.05));
          float fan = length(polarRep(pq - vec2(0.0, 0.0), 9.0) - vec2(0.075, 0.0)) - 0.02;
          float dd = min(min(stem, palm), max(fan, -pq.y));
          col = mix(col, navy * 1.2, smoothstep(0.004, -0.004, dd));
          col = mix(col, gold * 0.8, smoothstep(0.004, -0.004, sdEllipse(pq - vec2(0.0, 0.03), vec2(0.035, 0.022))));
        }
        // half-diamond spandrels at the tile ends (they meet between medallions)
        vec2 sq = vec2(m.x, 1.05 - abs(m.y));
        float sp = sdRhombus(sq, vec2(0.2, 0.2));
        if (sp < 0.0) {
          col = mix(navy, teal, 0.35);
          float sp2 = sdRhombus(sq, vec2(0.13, 0.13));
          col = mix(col, ivory * 0.9, smoothstep(0.004, -0.004, sp2));
          col = mix(col, crimson, smoothstep(0.004, -0.004, sdRhombus(sq, vec2(0.1, 0.1))));
          col = mix(col, gold * 0.85, smoothstep(0.004, -0.004, length(polarRep(sq, 6.0) - vec2(0.04, 0.0)) - 0.016));
        }
        col = mix(col, ivory * 0.8, stroke(sp, 0.0, 0.004));
        // four-leaf sprays scattered on the open ground between figures
        h += 0.04 * inMed;
      } else {
        float b = (ax - 0.29) / 0.21 + wob.x * 2.0;          // 0 inner .. 1 outer edge
        col = navy;
        if (b < 0.16) {
          col = mix(crimson, madder, 0.4);
          float dy = fract(py * 18.0) - 0.5;
          col = mix(col, ivory * 0.9, smoothstep(0.02, 0.0, length(vec2((b - 0.08) * 6.0, dy * 0.35)) - 0.07));
          col = mix(col, gold * 0.8, smoothstep(0.02, 0.0, abs(b - 0.01)) + smoothstep(0.02, 0.0, abs(b - 0.15)));
        } else if (b < 0.76) {
          float bb = (b - 0.46) / 0.3;
          float vy = py * 4.0;
          float ph = fract(vy);
          float vine = abs(bb - 0.55 * sin(vy * 6.2832)) - 0.07;
          col = mix(col, gold * 0.8, smoothstep(0.05, -0.02, vine));
          vec2 rp = vec2(bb * 0.3, (ph - 0.5) * 0.25);
          float side = step(0.5, fract(vy * 0.5));
          vec2 rc = vec2((side > 0.5 ? 0.55 : -0.55) * 0.3, 0.0);
          float ro = length(polarRep((rp - rc) * vec2(1.0, 0.95), 6.0) - vec2(0.032, 0.0)) - 0.02;
          col = mix(col, side > 0.5 ? ivory * 0.92 : rose * 1.1, smoothstep(0.006, -0.006, ro));
          col = mix(col, crimson, smoothstep(0.006, -0.006, length(rp - rc) - 0.014));
          float lv = leafD(rp, -rc * 0.9 + vec2(0.0, 0.02), side > 0.5 ? 0.8 : -0.8, 0.045, 0.018);
          col = mix(col, teal * 1.3, smoothstep(0.006, -0.006, lv));
          h += 0.05 * smoothstep(0.006, -0.006, min(ro, lv));
        } else if (b < 0.9) {
          col = ivory * 0.8;
          float rd = abs((b - 0.83) * 14.0 - 0.6 * sin(py * 18.0 * 6.2832 + abs(fract(py * 18.0) - 0.5) * 3.0)) - 0.18;
          col = mix(col, crimson * 0.95, smoothstep(0.08, -0.08, rd));
        } else {
          col = vec3(0.13, 0.05, 0.035);
          h -= 0.25 * smoothstep(0.92, 1.0, b);
        }
        col = mix(col, gold * 0.6, smoothstep(0.012, 0.0, abs(b - 0.16)) + smoothstep(0.012, 0.0, abs(b - 0.76)) + smoothstep(0.012, 0.0, abs(b - 0.9)));
      }
      // abrash: dye lots band across the runner
      float abrash = nz(vec2(p.y * 2.0, ax * 1.0), vec2(2.0, 4.0));
      col *= 0.9 + 0.16 * abrash;
      // hand-knotted pile (~2.5 mm knots) + fuzz
      vec2 kn = fract(p * vec2(420.0, 840.0));
      float knot = smoothstep(0.55, 0.1, length(kn - 0.5));
      float fuzz = nz(p * vec2(380.0, 760.0), vec2(380.0, 760.0)) * 0.5 + 0.5;
      col *= 0.84 + 0.12 * knot + 0.1 * fuzz;
      s.albedo = col;
      s.height = h * 0.5 + knot * 0.16 + fuzz * 0.12;
      s.rough = 0.95;
      s.metal = 0.0;
      s.ao = 0.82 + 0.18 * knot;
    }`,
  });
}

// ---------------------------------------------------------------------------- night sky (layered)
/** sky only: gradient, moon with halo, layered moonlit clouds. */
export function nightSky(ctx) {
  return ctx.textures.generate('gallery:nightsky2', {
    size: 2048, aspect: 1.0, tile: false,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv;
      vec2 moon = vec2(0.6, 0.7);
      float md = length(p - moon);
      vec3 sky = mix(vec3(0.012, 0.02, 0.05), vec3(0.09, 0.13, 0.26), smoothstep(0.0, 1.0, p.y));
      sky += vec3(0.4, 0.48, 0.7) * exp(-md * 5.5) * 0.9;
      sky += vec3(0.7, 0.75, 0.9) * exp(-md * 22.0) * 0.8;
      // clouds: two drifting layers, lit on the moon side
      vec2 q = p * vec2(1.0, 2.4);
      float c1 = fbm(q + vec2(0.0, 0.1), vec2(3.0, 3.0), 7) * 0.5 + 0.5;
      float c2 = fbm(q * 1.7 + vec2(4.2, 1.3), vec2(5.0, 5.0), 6) * 0.5 + 0.5;
      float dens = smoothstep(0.45, 0.75, c1 * 0.7 + c2 * 0.4);
      float lit = smoothstep(0.6, 0.0, md) * (0.4 + 0.6 * smoothstep(0.5, 0.8, c2));
      vec3 cloud = mix(vec3(0.02, 0.025, 0.04), vec3(0.45, 0.5, 0.62), lit);
      float rim = smoothstep(0.42, 0.5, c1 * 0.7 + c2 * 0.4) * (1.0 - dens) * smoothstep(0.45, 0.0, md);
      vec3 col = mix(sky, cloud, dens * 0.9);
      col += vec3(0.8, 0.85, 1.0) * rim * 0.7;
      // the moon disc with maria, partially veiled
      float disc = smoothstep(0.042, 0.037, md);
      float maria = fbm((p - moon) * 18.0, vec2(4.0), 4);
      vec3 mc = vec3(1.0, 0.98, 0.92) * (0.85 + 0.15 * maria);
      col = mix(col, mc * 1.6, disc * (1.0 - 0.6 * dens));
      // a few stars in clear sky
      float st = smoothstep(0.985, 1.0, hash12(floor(p * 420.0))) * (1.0 - dens) * smoothstep(0.3, 0.7, p.y);
      col += st * 0.5;
      s.albedo = col;
      s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
    }`,
  });
}

/** distant tree line + hill + chapel spire silhouette (alpha). */
export function treeLine(ctx) {
  return ctx.textures.generate('gallery:treeline', {
    size: 1024, aspect: 2.0, tile: false,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv;
      float hill = 0.22 + 0.06 * sin(p.x * 3.0 + 1.0) + 0.02 * fbm(vec2(p.x * 3.0, 0.0), vec2(3.0, 1.0), 4);
      // tree crowns: bumpy upper edge, ragged with fine noise
      float crowns = hill + 0.08 + 0.1 * pow(abs(fbm(vec2(p.x * 9.0, 0.5), vec2(9.0, 1.0), 5)), 0.8) + 0.02 * fbm(p * vec2(60.0, 40.0), vec2(60.0, 40.0), 3);
      float bare = 0.0;
      // a few tall bare trees with branching tops
      for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float x0 = 0.08 + fi * 0.17 + 0.03 * sin(fi * 7.1);
        float h = 0.55 + 0.25 * fract(sin(fi * 3.7) * 43.1);
        float dx = p.x - x0 - 0.01 * sin(p.y * 30.0 + fi);
        float trunk = step(abs(dx), 0.004 * (1.2 - p.y)) * step(p.y, h);
        float twig = smoothstep(0.62, 0.7, fbm(vec2(dx * 30.0, p.y * 18.0 + fi), vec2(30.0, 18.0), 4) * 0.5 + 0.5);
        float crown = twig * smoothstep(0.12, 0.0, abs(dx)) * step(h - 0.28, p.y) * step(p.y, h + 0.04);
        bare = max(bare, max(trunk, crown));
      }
      float spire = step(abs(p.x - 0.78), 0.008 * (1.0 - (p.y - 0.25) * 2.2)) * step(p.y, 0.68);
      float chapel = step(abs(p.x - 0.78), 0.05) * step(p.y, 0.36);
      float a = max(max(step(p.y, crowns), bare), max(spire, chapel));
      float win = step(abs(p.x - 0.765), 0.006) * step(abs(p.y - 0.31), 0.012);
      s.albedo = mix(vec3(0.01, 0.012, 0.022), vec3(0.03, 0.04, 0.07), smoothstep(0.0, 0.5, p.y)) + vec3(0.9, 0.6, 0.25) * win * 2.0;
      s.alpha = a;
      s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
    }`,
  });
}

/** near gnarled branch silhouette entering from the upper left (alpha). */
export function branchCard(ctx) {
  return ctx.textures.generate('gallery:branch', {
    size: 1024, aspect: 1.0, tile: false,
    glsl: /* glsl */ `
    float seg(vec2 p, vec2 a, vec2 b, float ra, float rb) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - mix(ra, rb, h) * 2.2 - 0.002; }
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv;
      p += 0.006 * vec2(fbm(p * 8.0, vec2(8.0), 3), fbm(p * 8.0 + 3.0, vec2(8.0), 3));
      float d = 1e5;
      vec2 a = vec2(-0.05, 0.95), b = vec2(0.35, 0.78);
      d = min(d, seg(p, a, b, 0.035, 0.022));
      vec2 c = vec2(0.62, 0.72); d = min(d, seg(p, b, c, 0.022, 0.012));
      vec2 e = vec2(0.85, 0.58); d = min(d, seg(p, c, e, 0.012, 0.004));
      d = min(d, seg(p, b, vec2(0.45, 0.55), 0.014, 0.004));
      d = min(d, seg(p, vec2(0.45, 0.55), vec2(0.42, 0.4), 0.004, 0.0015));
      d = min(d, seg(p, c, vec2(0.7, 0.92), 0.008, 0.002));
      d = min(d, seg(p, vec2(0.2, 0.86), vec2(0.18, 0.6), 0.012, 0.003));
      d = min(d, seg(p, vec2(0.18, 0.6), vec2(0.26, 0.46), 0.003, 0.0012));
      d = min(d, seg(p, vec2(0.55, 0.74), vec2(0.6, 0.5), 0.006, 0.0015));
      d = min(d, seg(p, e, vec2(0.98, 0.6), 0.004, 0.001));
      d = min(d, seg(p, vec2(0.75, 0.66), vec2(0.82, 0.8), 0.004, 0.001));
      // twig clutter near the tips
      float tw = smoothstep(0.66, 0.72, fbm(p * vec2(26.0, 30.0), vec2(26.0, 30.0), 4) * 0.5 + 0.5) * smoothstep(0.12, 0.0, d) * step(0.3, p.x);
      float a1 = max(smoothstep(0.0015, -0.0015, d), tw);
      s.albedo = vec3(0.006, 0.007, 0.012);
      s.alpha = a1;
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

/**
 * Painted arch-top dial (aged cream iron dial): Roman chapter ring, Arabic minutes, gilt
 * spandrel scrolls in the corners and a rolling moon-phase disc in the arch.
 * Texture is W x H = 512 x 704; the square part is the bottom 512 px, the arch above it.
 */
export function archDialTexture(ctx) {
  return ctx.textures.canvas('gallery:archdial', 512, 704, (g, w, h) => {
    const sq = 512, ay = h - sq;            // top of the square part
    // aged paper ground with foxing and a darker rim
    g.fillStyle = '#d6c9a6'; g.fillRect(0, 0, w, h);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${110 + rnd() * 40},${80 + rnd() * 30},${40 + rnd() * 20},${0.03 + rnd() * 0.06})`; const r = 1 + rnd() * 9; g.beginPath(); g.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2); g.fill(); }
    const vg = g.createRadialGradient(w / 2, ay + sq / 2, 60, w / 2, ay + sq / 2, 420);
    vg.addColorStop(0, 'rgba(255,248,225,0.12)'); vg.addColorStop(1, 'rgba(70,45,20,0.55)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    // ---- moon-phase arch: night-blue disc with stars and two painted moons
    g.save();
    g.beginPath(); g.arc(w / 2, ay, 236, Math.PI, 0); g.closePath(); g.clip();
    const sky = g.createLinearGradient(0, ay - 236, 0, ay); sky.addColorStop(0, '#13234a'); sky.addColorStop(1, '#2a3f72');
    g.fillStyle = sky; g.fillRect(0, 0, w, ay);
    for (let i = 0; i < 70; i++) { const x = w / 2 + (rnd() - 0.5) * 460, y = ay - rnd() * 230; g.fillStyle = `rgba(240,220,160,${0.5 + rnd() * 0.5})`; g.beginPath(); g.arc(x, y, 1 + rnd() * 2, 0, Math.PI * 2); g.fill(); }
    // a landscape strip (hills + a house with one lit window) along the bottom of the arch
    g.fillStyle = '#1d2a1e'; g.beginPath(); g.moveTo(0, ay); for (let x = 0; x <= w; x += 8) g.lineTo(x, ay - 22 - 14 * Math.sin(x / 60) - 8 * Math.sin(x / 23)); g.lineTo(w, ay); g.closePath(); g.fill();
    const moonFace = (cx, cy) => { const mg = g.createRadialGradient(cx - 12, cy - 12, 4, cx, cy, 52); mg.addColorStop(0, '#fff6d8'); mg.addColorStop(1, '#c7a860'); g.fillStyle = mg; g.beginPath(); g.arc(cx, cy, 50, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(120,80,30,0.55)'; g.beginPath(); g.arc(cx - 16, cy - 8, 6, 0, Math.PI * 2); g.arc(cx + 16, cy - 8, 6, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(cx, cy + 14, 14, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = 3; g.strokeStyle = 'rgba(120,80,30,0.6)'; g.stroke(); };
    moonFace(w / 2 + 28, ay - 128); moonFace(w / 2 + 240, ay - 40);
    g.restore();
    // humps that hide the moons at the arch springing
    g.fillStyle = '#d0c29d';
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(w / 2 + sx * 118, ay + 2, 118, Math.PI, 0); g.fill(); }
    g.strokeStyle = '#3a2a14'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, ay, 236, Math.PI, 0); g.stroke();
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(w / 2 + sx * 118, ay + 2, 118, Math.PI, 0); g.stroke(); }
    // gilt spandrel scrolls in the four corners of the square
    const scroll = (cx, cy, sx, sy) => {
      g.save(); g.translate(cx, cy); g.scale(sx, sy);
      g.strokeStyle = '#8a6420'; g.fillStyle = '#c49a48'; g.lineWidth = 4;
      g.beginPath(); for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * 3.6 * Math.PI, r = 46 * (1 - t); g.lineTo(18 + Math.cos(a) * r + t * 40, 18 + Math.sin(a) * r * 0.8 + t * 30); } g.stroke();
      for (let k = 0; k < 6; k++) { const a = k * 0.9; g.beginPath(); g.ellipse(30 + Math.cos(a) * 30, 30 + Math.sin(a) * 26, 12, 5, a + 0.6, 0, Math.PI * 2); g.fill(); g.stroke(); }
      g.restore();
    };
    scroll(4, ay + 4, 1, 1); scroll(w - 4, ay + 4, -1, 1); scroll(4, h - 4, 1, -1); scroll(w - 4, h - 4, -1, -1);
    // chapter ring
    g.save(); g.translate(w / 2, ay + sq / 2);
    g.fillStyle = 'rgba(232,222,196,0.55)'; g.beginPath(); g.arc(0, 0, 226, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1b1510'; g.fillStyle = '#1b1510';
    for (const [r, lw] of [[224, 3], [214, 1.5], [168, 1.5], [140, 2.5]]) { g.lineWidth = lw; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; g.lineWidth = i % 5 === 0 ? 4 : 1.5; g.beginPath(); g.moveTo(Math.sin(a) * 214, -Math.cos(a) * 214); g.lineTo(Math.sin(a) * 224, -Math.cos(a) * 224); g.stroke(); }
    g.font = '15px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 5; i <= 60; i += 5) { const a = (i / 60) * Math.PI * 2; g.fillText(String(i), Math.sin(a) * 236 * 0.0 + Math.sin(a) * 240, -Math.cos(a) * 240); }
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    g.font = 'bold 40px Georgia, serif';
    R.forEach((r, i) => { const a = (i / 12) * Math.PI * 2; g.save(); g.translate(Math.sin(a) * 191, -Math.cos(a) * 191); g.rotate(a); g.scale(0.8, 1); g.fillText(r, 0, 0); g.restore(); });
    // seconds subsidiary + date aperture + winding holes
    g.lineWidth = 1.5; g.beginPath(); g.arc(0, -78, 34, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(Math.sin(a) * 30, -78 - Math.cos(a) * 30); g.lineTo(Math.sin(a) * 34, -78 - Math.cos(a) * 34); g.stroke(); }
    g.fillStyle = '#e9dfc3'; g.fillRect(-16, 58, 32, 22); g.strokeRect(-16, 58, 32, 22); g.fillStyle = '#1b1510'; g.font = '16px Georgia'; g.fillText('13', 0, 70);
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 70, 40, 9, 0, Math.PI * 2); g.fillStyle = '#20180e'; g.fill(); g.strokeStyle = '#8a6a30'; g.lineWidth = 3; g.stroke(); }
    g.fillStyle = '#2a1c0e'; g.font = 'italic 22px Georgia, serif'; g.fillText('H. Stauf', 0, 118);
    g.font = 'italic 14px Georgia, serif'; g.fillText('fecit', 0, 138);
    // pierced blued-steel hands at five to midnight
    g.fillStyle = '#10131c';
    const hand = (a, len, wdt, spade) => { g.save(); g.rotate(a); g.beginPath(); g.moveTo(-wdt * 0.4, 24); g.lineTo(-wdt * 0.4, -len * 0.7); g.quadraticCurveTo(-wdt * 1.6, -len * 0.8, 0, -len); g.quadraticCurveTo(wdt * 1.6, -len * 0.8, wdt * 0.4, -len * 0.7); g.lineTo(wdt * 0.4, 24); g.closePath(); g.fill(); if (spade) { g.beginPath(); g.arc(0, -len * 0.62, wdt * 1.4, 0, Math.PI * 2); g.fill(); } g.restore(); };
    hand((11 + 55 / 60) / 12 * Math.PI * 2, 120, 8, true);
    hand((55 / 60) * Math.PI * 2, 182, 5, false);
    g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fill();
    g.restore();
  }, { tile: false });
}

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------- moon cookie
/**
 * Projected texture for the moon spot: thin cloud dapple and the soft shadows of the bare
 * branches outside, so the moonlight on the boards and the clock is broken and alive rather
 * than a clean lit oval. (Glazing-bar shadows come from the real window geometry.)
 */
export function moonCookie(ctx) {
  return ctx.textures.canvas('gallery:moonCookie', 512, 512, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const grd = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.5);
    grd.addColorStop(0, '#fff'); grd.addColorStop(1, '#000');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // cloud dapple
    let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    g.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = rnd() * h, r = 30 + rnd() * 90;
      const c = g.createRadialGradient(x, y, 0, x, y, r);
      c.addColorStop(0, 'rgba(150,150,160,1)'); c.addColorStop(1, 'rgba(255,255,255,1)');
      g.fillStyle = c; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // soft branch shadows (blurred), entering from one side
    g.filter = 'blur(5px)';
    g.strokeStyle = 'rgba(40,40,48,1)'; g.lineCap = 'round';
    const branch = (x, y, ang, len, wd, depth) => {
      if (depth <= 0 || wd < 0.8) return;
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      g.lineWidth = wd; g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo((x + x2) / 2 + (rnd() - 0.5) * len * 0.3, (y + y2) / 2 + (rnd() - 0.5) * len * 0.3, x2, y2); g.stroke();
      branch(x2, y2, ang + 0.35 + rnd() * 0.3, len * 0.72, wd * 0.62, depth - 1);
      branch(x2, y2, ang - 0.4 - rnd() * 0.3, len * 0.66, wd * 0.58, depth - 1);
    };
    branch(-10, h * 0.22, 0.32, 150, 13, 6);
    branch(w + 10, h * 0.85, Math.PI + 0.25, 120, 9, 5);
    g.filter = 'none';
    g.globalCompositeOperation = 'source-over';
  }, { tile: false });
}
