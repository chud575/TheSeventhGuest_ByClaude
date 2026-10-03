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

// ---------------------------------------------------------------------------- night sky (layered)
/** sky only: gradient, moon with halo, layered moonlit clouds. */
export function nightSky(ctx) {
  return ctx.textures.generate('gallery:nightsky2', {
    size: 1024, aspect: 1.0, tile: false,
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
    float seg(vec2 p, vec2 a, vec2 b, float ra, float rb) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - mix(ra, rb, h); }
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

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
