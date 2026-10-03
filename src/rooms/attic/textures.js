/**
 * Attic procedural textures (authored for this room): adzed roof timbers, the
 * sarking boards under the slates, dusty floorboards, an old limewashed lath and
 * plaster gable, linen dust sheets, the moonlit sky beyond the oculus, cobwebs,
 * and the etched glass specimen plate of Stauf's microscope game.
 */
import * as THREE from 'three';
import { CELLS, RADIUS } from './hexx.js';

/** Hand-hewn roof timber: grain along U (1 tile = 1.2 m x 0.3 m), adze facets, drying checks, dust in the pores. */
export function timberTexture(forge, { key = 'timber', base = [0.2, 0.13, 0.08] } = {}) {
  return forge.generate(`attic:${key}`, {
    size: 1024, aspect: 2, normalStrength: 3.6,
    uniforms: { uBase: base },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  float warp = fbm(p + 0.3, vec2(2.0, 4.0), 4);
  float rings = 0.5 + 0.5 * sin((p.y * 26.0 + warp * 3.2) * 3.14159);
  rings = pow(rings, 3.0);
  float fib = vnoise(p * vec2(30.0, 700.0), vec2(30.0, 700.0));
  float fib2 = vnoise(p * vec2(8.0, 260.0) + 3.1, vec2(8.0, 260.0));
  // adze facets: shallow scallops across the grain
  float sc = fract(p.x * 9.0 + fbm(p, vec2(3.0, 2.0), 2) * 0.6);
  float adze = smoothstep(0.0, 0.5, sc) * smoothstep(1.0, 0.6, sc);
  // drying checks: thin dark splits running with the grain
  float ck = 1e3;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float y0 = 0.15 + 0.22 * fi + 0.05 * hash11(fi + 2.0);
    float x0 = hash11(fi * 3.1) , len = 0.25 + 0.35 * hash11(fi + 7.0);
    float dx = fract(p.x - x0);
    float on = step(dx, len);
    float wob = fbm(vec2(p.x * 2.0, fi), vec2(2.0, 4.0), 3) * 0.02;
    float w = 0.004 * sin(clamp(dx / len, 0.0, 1.0) * 3.14159);
    ck = min(ck, on > 0.5 ? abs(p.y - y0 - wob) - w : 1e3);
  }
  float crack = smoothstep(0.003, 0.0, ck);
  float knots = 0.0;
  vec4 v = voronoi(p * vec2(3.0, 1.0), vec2(3.0, 1.0), 0.8);
  knots = smoothstep(0.09, 0.0, v.x) * step(0.72, hash12(v.zw));
  vec3 c = uBase * (0.75 + 0.45 * fib2) * (0.85 + 0.25 * rings);
  c = mix(c, uBase * 0.45, knots * 0.8);
  float grime = fbmv(p * vec2(1.0, 3.0) + 9.0, vec2(4.0, 6.0), 5);
  c = mix(c, vec3(0.27, 0.25, 0.22), smoothstep(0.45, 0.8, grime) * 0.35);   // grey dust
  c *= 1.0 - crack * 0.8;
  s.albedo = c;
  s.height = 0.55 + 0.12 * adze + 0.08 * fib + 0.06 * rings - crack * 0.5 - knots * 0.05;
  s.rough = 0.88 - rings * 0.06;
  s.metal = 0.0;
  s.ao = 1.0 - crack * 0.6;
}`,
  });
}

/** Sarking boards under the slates: horizontal boards (U = along, 1 tile = 1.2 m), dark gaps, rusted nails, water stains. */
export function sarkingTexture(forge) {
  return forge.generate('attic:sarking', {
    size: 1024, normalStrength: 2.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float rows = 7.0;
  float y = uv.y * rows;
  float id = floor(y), f = fract(y);
  float seed = hash11(id + 4.0);
  float xs = uv.x * 2.0 + seed;
  float bid = floor(xs);
  float bx = fract(xs);
  float tone = hash12(vec2(id, bid));
  float grain = vnoise(vec2(uv.x * 40.0, (y + seed * 7.0) * 18.0), vec2(40.0, rows * 18.0));
  float g2 = 0.5 + 0.5 * sin((uv.x * 3.0 + fbm(vec2(uv.x, y * 0.3 + seed), vec2(2.0, 3.0), 3) * 1.3 + f * 0.6) * 31.4);
  vec3 c = mix(vec3(0.16, 0.1, 0.065), vec3(0.28, 0.19, 0.12), tone) * (0.8 + 0.25 * grain) * (0.9 + 0.12 * g2);
  float gap = smoothstep(0.0, 0.035, f) * smoothstep(1.0, 0.965, f);
  float butt = smoothstep(0.0, 0.006, bx) * smoothstep(1.0, 0.994, bx);
  gap *= butt;
  // water stains: tide-lines from old leaks
  float st = fbm(uv + 0.7, vec2(3.0), 5);
  float tide = smoothstep(0.02, 0.0, abs(st - 0.18)) * 0.5 + smoothstep(0.2, 0.45, st) * 0.4;
  c = mix(c, c * vec3(0.55, 0.5, 0.45), tide);
  // nails at the rafter lines (every 0.5 tile)
  vec2 np = vec2(fract(uv.x * 2.0 + 0.25) - 0.5, f - 0.5);
  float nail = smoothstep(0.012, 0.006, length(np * vec2(1.0, 0.12)));
  c = mix(c * (1.0 - 0.6 * smoothstep(0.04, 0.0, length(np * vec2(1.0, 0.15)))), vec3(0.22, 0.1, 0.05), nail);
  c *= mix(0.15, 1.0, gap);
  s.albedo = c;
  s.height = 0.5 * gap + 0.08 * grain + nail * 0.2;
  s.rough = 0.9;
  s.metal = nail * 0.4;
  s.ao = mix(0.3, 1.0, gap);
}`,
  });
}

/** Dusty pine floorboards: long boards along V (1 tile = 1.6 m), dust settled in the gaps and away from the walking line. */
export function floorTexture(forge) {
  return forge.generate('attic:floor', {
    size: 2048, normalStrength: 2.0,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float cols = 8.0;
  float x = uv.x * cols;
  float id = floor(x), f = fract(x);
  float seed = hash11(id * 1.7 + 3.0);
  float ys = uv.y * 1.0 + seed;
  float bid = floor(ys), by = fract(ys);
  float tone = hash12(vec2(id, bid) + 0.3);
  float warp = fbm(vec2(f * 0.3 + id, ys * 2.0), vec2(cols, 2.0), 4);
  float ring = 0.5 + 0.5 * sin((f * 2.0 + warp * 2.5 + tone * 5.0) * 9.0);
  ring = pow(ring, 2.0);
  float fib = vnoise(vec2(uv.x * 600.0, uv.y * 30.0), vec2(600.0, 30.0));
  vec3 a = mix(vec3(0.3, 0.2, 0.12), vec3(0.42, 0.3, 0.19), tone);
  vec3 c = a * (0.78 + 0.3 * ring) * (0.88 + 0.2 * fib);
  float seam = smoothstep(0.0, 0.025, f) * smoothstep(1.0, 0.975, f);
  float butt = smoothstep(0.0, 0.004, by) * smoothstep(1.0, 0.996, by);
  float gap = seam * butt;
  // nails: two per board end
  vec2 np = vec2(f - 0.5, by);
  float nails = 0.0;
  for (int k = 0; k < 2; k++) {
    float nx = k == 0 ? -0.28 : 0.28;
    nails += smoothstep(0.035, 0.02, length(vec2(np.x - nx, (min(by, 1.0 - by) - 0.02) * 8.0)));
  }
  // dust: grey film, thicker in seams and patches
  float dust = smoothstep(0.35, 0.85, fbmv(uv * 1.0 + 4.2, vec2(5.0), 6));
  float fine = vnoise(uv * 900.0, vec2(900.0));
  vec3 dustC = vec3(0.36, 0.34, 0.31) * (0.9 + 0.2 * fine);
  c = mix(c, dustC, dust * 0.55);
  c = mix(c * 0.25, dustC * 0.6, (1.0 - gap) * 0.25);
  c = mix(c, vec3(0.08, 0.06, 0.05), nails * 0.85);
  c *= mix(0.25, 1.0, gap);
  s.albedo = c;
  s.height = 0.5 * gap + 0.05 * ring + 0.04 * fib + dust * 0.03;
  s.rough = mix(0.72, 0.95, dust);
  s.metal = nails * 0.3;
  s.ao = mix(0.35, 1.0, gap);
}`,
  });
}

/** Limewashed lath-and-plaster with blown patches showing the laths, damp and soot. 1 tile = 1.5 m. */
export function lathPlasterTexture(forge) {
  return forge.generate('attic:lath', {
    size: 1024, normalStrength: 2.4,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float n = fbm(uv + 1.3, vec2(3.0), 6);
  float blown = smoothstep(0.32, 0.36, fbm(uv * 1.0 + 7.7, vec2(2.0), 5) + 0.12 * n);
  // laths: horizontal strips with gaps
  float ly = uv.y * 40.0;
  float lf = fract(ly);
  float lath = smoothstep(0.0, 0.08, lf) * smoothstep(0.72, 0.62, lf);
  float lg = vnoise(vec2(uv.x * 30.0, floor(ly) * 3.1), vec2(30.0, 120.0));
  vec3 lathC = mix(vec3(0.03, 0.025, 0.02), vec3(0.32, 0.22, 0.13) * (0.7 + 0.4 * lg), lath);
  vec3 pl = vec3(0.6, 0.58, 0.53) * (0.82 + 0.18 * n);
  float damp = smoothstep(0.1, 0.55, fbm(uv * vec2(1.0, 0.5) + 3.3, vec2(2.0, 1.0), 5) + (0.5 - uv.y) * 0.3);
  pl = mix(pl, pl * vec3(0.62, 0.6, 0.5), damp * 0.6);
  float soot = smoothstep(0.3, 0.9, uv.y) * 0.25;
  pl *= 1.0 - soot;
  float cr = voronoiEdge(uv * 6.0 + n * 0.3, vec2(6.0), 0.9);
  float crack = smoothstep(0.03, 0.0, cr) * step(0.4, fbmv(uv * 3.0, vec2(3.0), 3));
  pl *= 1.0 - crack * 0.5;
  float rim = smoothstep(0.30, 0.34, fbm(uv * 1.0 + 7.7, vec2(2.0), 5) + 0.12 * n) - blown;
  vec3 c = mix(pl, lathC, blown);
  c = mix(c, c * 0.6, clamp(rim, 0.0, 1.0));
  s.albedo = c;
  s.height = mix(0.75 + 0.05 * n - crack * 0.1, 0.25 * lath, blown);
  s.rough = mix(0.93, 0.85, blown);
  s.metal = 0.0;
  s.ao = mix(1.0, 0.45 + 0.4 * lath, blown);
}`,
  });
}

/** Coarse linen dust sheet with weave, slubs and grime. 1 tile = 0.5 m. */
export function linenTexture(forge) {
  return forge.generate('attic:linen', {
    size: 512, normalStrength: 0.8,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  float wx = 0.5 + 0.5 * sin(uv.x * 3.14159 * 360.0);
  float wy = 0.5 + 0.5 * sin(uv.y * 3.14159 * 360.0);
  float slub = vnoise(vec2(uv.x * 20.0, uv.y * 360.0), vec2(20.0, 360.0));
  float slub2 = vnoise(vec2(uv.x * 360.0, uv.y * 20.0), vec2(360.0, 20.0));
  float weave = mix(wx * (0.7 + 0.3 * slub), wy * (0.7 + 0.3 * slub2), step(0.5, fract((floor(uv.x * 360.0) + floor(uv.y * 360.0)) * 0.5)));
  float grime = fbm(uv + 2.0, vec2(4.0), 5);
  vec3 c = vec3(0.62, 0.6, 0.55) * (0.88 + 0.12 * weave);
  c = mix(c, vec3(0.4, 0.37, 0.32), smoothstep(0.0, 0.5, grime) * 0.55);
  s.albedo = c;
  s.height = 0.5 + 0.3 * weave;
  s.rough = 0.95; s.metal = 0.0; s.ao = 0.9 + 0.1 * weave;
}`,
  });
}

/** Night sky for the oculus: moon left of centre, torn cloud, a few stars. Non-tiling. */
export function moonSkyTexture(forge) {
  return forge.generate('attic:sky', {
    size: 1024, tile: false,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv;
  vec2 moon = vec2(0.5, 0.52);
  float md = length(p - moon);
  vec3 sky = mix(vec3(0.02, 0.035, 0.08), vec3(0.12, 0.17, 0.32), smoothstep(0.0, 1.0, p.y));
  sky += vec3(0.5, 0.6, 0.85) * exp(-md * 5.0) * 0.8;
  float cl = fbm(p * vec2(1.0, 1.6) + vec2(0.2, 0.7), vec2(2.0, 3.0), 6);
  float cl2 = fbm(p + 0.3, vec2(5.0, 8.0), 4);
  float cloud = smoothstep(-0.02, 0.35, cl + cl2 * 0.3);
  // moon disc with maria
  float disc = smoothstep(0.112, 0.104, md);
  float maria = fbmv((p - moon) * 7.0 + 3.0, vec2(4.0), 5);
  vec3 moonC = vec3(1.0, 0.97, 0.9) * (1.15 - 0.35 * smoothstep(0.45, 0.7, maria)) * (1.0 - 0.25 * smoothstep(0.06, 0.11, md));
  vec3 col = mix(sky, moonC * 1.6, disc);
  // clouds drift across the lower part of the moon
  col = mix(col, col * 0.35 + vec3(0.02, 0.025, 0.045), cloud * (0.65 + 0.35 * (1.0 - disc)) * smoothstep(0.75, 0.3, p.y));
  col += vec3(0.75, 0.8, 0.95) * smoothstep(0.16, 0.0, abs(cl - 0.05)) * exp(-md * 3.0) * 0.6;
  vec2 g = p * vec2(80.0); vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float st = smoothstep(0.07, 0.0, length(f - (hash22(id) - 0.5) * 0.7)) * step(0.94, hash12(id + 1.7));
  col += vec3(0.7, 0.75, 0.9) * st * 0.7 * (1.0 - cloud) * smoothstep(0.15, 0.25, md);
  s.albedo = col; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/** Cobweb: radial threads + spiral, sagging, with a torn side. Alpha in the albedo's alpha. */
export function cobwebTexture(forge, seed = 1) {
  return forge.canvas(`attic:cobweb${seed}`, 512, 512, (g, w, h) => {
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    g.clearRect(0, 0, w, h);
    // web anchored at the top-left corner (0,0) fanning into the quarter
    const cx = 6, cy = 6;
    const spokes = 11;
    const angles = [];
    for (let i = 0; i < spokes; i++) angles.push((i / (spokes - 1)) * Math.PI / 2 + (rnd() - 0.5) * 0.08);
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(235,235,240,0.8)';
    g.lineWidth = 1.6;
    const R = w * 0.98;
    for (const a of angles) {
      g.beginPath(); g.moveTo(cx, cy);
      const ex = cx + Math.cos(a) * R, ey = cy + Math.sin(a) * R;
      g.quadraticCurveTo((cx + ex) / 2 + 10, (cy + ey) / 2 + 14, ex, ey); g.stroke();
    }
    // spiral capture threads, sagging between spokes
    for (let k = 0; k < 30; k++) {
      const r = 22 + k * (R / 32) * (0.9 + rnd() * 0.2);
      if (rnd() < 0.12) continue;
      g.globalAlpha = 0.35 + 0.5 * rnd();
      g.lineWidth = 0.9 + rnd() * 0.8;
      g.beginPath();
      for (let i = 0; i < spokes; i++) {
        const a = angles[i];
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y);
        else {
          const am = (angles[i - 1] + a) / 2;
          const sag = r * 0.06 + 4;
          g.quadraticCurveTo(cx + Math.cos(am) * (r - sag), cy + Math.sin(am) * (r - sag) + sag * 0.4, x, y);
        }
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    // dust clumps + loose strands
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI / 2, r = rnd() * R * 0.9;
      g.fillStyle = `rgba(210,210,215,${0.15 + rnd() * 0.25})`;
      g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1 + rnd() * 3, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(230,230,235,0.5)';
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI / 2, r = R * (0.5 + rnd() * 0.45);
      g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.bezierCurveTo(cx + Math.cos(a) * r + 20, cy + Math.sin(a) * r + 60, cx + Math.cos(a) * r - 10, cy + Math.sin(a) * r + 90, cx + Math.cos(a) * r + 5, cy + Math.sin(a) * r + 130 * rnd());
      g.stroke();
    }
  }, { tile: false });
}

/**
 * Specimen plate of the infection game: dark glass with an etched hex lattice that
 * matches hexx.js exactly (flat-topped hexes), a graduated outer scale and a maker's ring.
 * `cell` = hex circumradius in plate units where the plate spans [-1, 1].
 */
export function plateTexture(forge, { cell }) {
  return forge.canvas('attic:plate', 1024, 1024, (g, w, h) => {
    const S = w / 2;
    const P = (x, y) => [S + x * S, S - y * S];
    const grd = g.createRadialGradient(S, S, 0, S, S, S);
    grd.addColorStop(0, '#16222a'); grd.addColorStop(0.75, '#0c1418'); grd.addColorStop(1, '#05080a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // faint culture smear
    for (let i = 0; i < 260; i++) {
      const a = (i * 2.399) % (Math.PI * 2), r = Math.sqrt((i * 0.618) % 1) * 0.9;
      g.fillStyle = `rgba(${90 + (i % 40)},${120 + (i % 30)},${110},0.025)`;
      const [x, y] = P(Math.cos(a) * r, Math.sin(a) * r);
      g.beginPath(); g.arc(x, y, 8 + (i % 17) * 2, 0, Math.PI * 2); g.fill();
    }
    const hexPath = (cx, cy, rr) => {
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const [x, y] = P(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
    };
    const center = ([q, r]) => [cell * 1.5 * q, -cell * Math.sqrt(3) * (r + q / 2)];
    // all 61 hexes, holes drawn as dark filled wells
    for (let q = -RADIUS; q <= RADIUS; q++) for (let r = -RADIUS; r <= RADIUS; r++) {
      if (Math.abs(q + r) > RADIUS) continue;
      const [cx, cy] = center([q, r]);
      const live = CELLS.some(([a, b]) => a === q && b === r);
      hexPath(cx, cy, cell * 0.97);
      if (!live) { g.fillStyle = '#020304'; g.fill(); g.strokeStyle = 'rgba(160,140,90,0.55)'; g.lineWidth = 3; g.stroke(); continue; }
      const cg = g.createRadialGradient(...P(cx, cy), 0, ...P(cx, cy), cell * S);
      cg.addColorStop(0, 'rgba(60,80,90,0.35)'); cg.addColorStop(1, 'rgba(10,16,20,0.0)');
      g.fillStyle = cg; g.fill();
      g.strokeStyle = 'rgba(190,205,215,0.55)'; g.lineWidth = 2.2; g.stroke();
      hexPath(cx, cy, cell * 0.86);
      g.strokeStyle = 'rgba(120,140,150,0.25)'; g.lineWidth = 1.2; g.stroke();
    }
    // graduated scale ring
    g.strokeStyle = 'rgba(200,180,120,0.7)';
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      const r0 = 0.93, r1 = i % 10 === 0 ? 0.985 : i % 5 === 0 ? 0.965 : 0.95;
      g.lineWidth = i % 10 === 0 ? 2.4 : 1.2;
      g.beginPath(); g.moveTo(...P(Math.cos(a) * r0, Math.sin(a) * r0)); g.lineTo(...P(Math.cos(a) * r1, Math.sin(a) * r1)); g.stroke();
    }
    g.beginPath(); g.arc(S, S, S * 0.925, 0, Math.PI * 2); g.lineWidth = 2; g.stroke();
    // engraved legend
    g.fillStyle = 'rgba(210,190,130,0.75)';
    g.font = 'italic 26px serif';
    g.textAlign = 'center';
    g.save(); g.translate(S, S);
    const txt = 'H. STAUF  ·  CULTURA  INFECTIONIS  ·  MCMXXXV  ·';
    for (let i = 0; i < txt.length; i++) {
      g.save(); g.rotate(-Math.PI * 0.82 + i * 0.048); g.translate(0, -S * 0.9); g.fillText(txt[i], 0, 0); g.restore();
    }
    g.restore();
  }, { tile: false });
}

/** Inner glow card for the sinister doorway: hot core fading to blood-red, with a silhouette hint of a stair beyond. */
export function hellGlowTexture(forge) {
  return forge.generate('attic:hellglow', {
    size: 512, aspect: 0.5, tile: false,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec2 p = uv - vec2(0.5, 0.35);
  float d = length(p * vec2(1.6, 1.0));
  float n = fbm(uv * vec2(2.0, 3.0) + 1.0, vec2(3.0, 4.0), 5);
  vec3 c = mix(vec3(1.0, 0.62, 0.25), vec3(0.55, 0.06, 0.02), smoothstep(0.0, 0.55, d + n * 0.12));
  c = mix(c, vec3(0.08, 0.01, 0.005), smoothstep(0.45, 0.9, d + n * 0.1));
  // stair treads rising into the light
  float st = fract(uv.y * 9.0);
  float tread = smoothstep(0.0, 0.06, st) * smoothstep(0.25, 0.15, st) * step(uv.y, 0.55);
  c *= 1.0 - tread * 0.55 * smoothstep(0.5, 0.0, abs(uv.x - 0.5));
  s.albedo = c; s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
}`,
  });
}

/**
 * Attic brick: a 1.8 m tile of 24 courses x 8 stretchers, each brick with its own
 * hue, value, roughness and height; overfired clinkers, salt bloom (efflorescence),
 * chipped arrises, ragged mortar of varying width with dirt packed into it, the odd
 * missing or broken brick and fine surface pitting for close-ups.
 */
export function brickTexture(forge, { key = 'brick', base = [0.46, 0.22, 0.15], mortar = [0.43, 0.4, 0.36], bloom = 0.55, missing = 0.012, size = 2048 } = {}) {
  return forge.generate(`attic:${key}`, {
    size, normalStrength: 3.2,
    uniforms: { uBase: base, uMortar: mortar, uBloom: bloom, uMissing: missing },
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  const float ROWS = 24.0, COLS = 8.0, TILE = 1.8;
  float ry = uv.y * ROWS;
  float r = floor(ry);
  float off = mod(r, 2.0) * 0.5 + (hash11(r * 1.37 + 2.0) - 0.5) * 0.18;
  float gx = uv.x * COLS + off;
  float c = floor(gx);
  vec2 id = vec2(mod(c, COLS), mod(r, ROWS));
  vec2 f = vec2(fract(gx), fract(ry));
  float h1 = hash12(id + 0.31), h2 = hash12(id + 5.7), h3 = hash12(id * 1.9 + 11.0), h4 = hash12(id + 23.1), h5 = hash12(id * 3.3 + 1.0);
  vec2 bs = vec2(TILE / COLS, TILE / ROWS);           // brick size in metres
  // ragged mortar: per-brick inset + noisy edge
  float rag = fbm(uv, vec2(96.0), 3) * 0.003;
  vec2 inset = vec2(0.0035 + 0.003 * h2, 0.004 + 0.003 * h3);
  vec2 dm = min(f, 1.0 - f) * bs - inset;
  float e = min(dm.x, dm.y) + rag;
  // chipped arrises / corners
  float chip = smoothstep(0.55, 0.85, fbmv(uv, vec2(140.0), 3)) * 0.006;
  float corner = length(max(vec2(0.012) - min(f, 1.0 - f) * bs, 0.0)) * step(0.6, h5) * 0.6;
  e -= chip + corner;
  float mortarM = 1.0 - smoothstep(0.0, 0.0012, e);
  float arris = smoothstep(0.0, 0.007, e);
  // brick body colour: three clays + clinkers, ±15% value
  vec3 clayA = uBase, clayB = uBase * vec3(1.18, 1.1, 1.0), clayC = uBase * vec3(0.85, 0.72, 0.68);
  vec3 bc = mix(mix(clayA, clayB, step(0.45, h1)), clayC, step(0.78, h2));
  bc *= 0.85 + 0.3 * h3;
  float clinker = step(0.95, h4);
  bc = mix(bc, vec3(0.2, 0.12, 0.1) * (0.8 + 0.4 * h5), clinker * 0.75);
  // fire-flash: one end darker
  float flash = smoothstep(0.2, 1.0, mix(f.x, 1.0 - f.x, step(0.5, h5))) * step(0.55, h1) * 0.35;
  bc *= 1.0 - flash;
  // mottling + speckle inside the brick
  float mott = fbmv(uv, vec2(48.0), 4);
  float speck = vnoise(uv * 900.0, vec2(900.0));
  bc *= 0.82 + 0.3 * mott;
  bc = mix(bc, bc * vec3(0.55, 0.5, 0.48), smoothstep(0.78, 0.95, speck) * 0.6);
  // pitting
  vec4 vp = voronoi(uv * vec2(260.0), vec2(260.0), 1.0);
  float pit = smoothstep(0.12, 0.0, vp.x) * step(0.7, hash12(vp.zw));
  bc *= 1.0 - pit * 0.35;
  // salt bloom (efflorescence), patchy, collects at brick bottoms
  float bloom = smoothstep(0.55, 0.85, fbmv(uv + 0.37, vec2(3.0), 5) + 0.25 * (1.0 - f.y) * h1) * uBloom;
  bloom *= 0.5 + 0.5 * vnoise(uv * 220.0, vec2(220.0));
  bc = mix(bc, vec3(0.62, 0.6, 0.55), bloom * 0.55);
  // missing / broken bricks
  float gone = step(1.0 - uMissing, h4 * (1.0 - clinker) + clinker * 0.0);
  // mortar: varying tone, dirt packed into it
  float md = fbmv(uv, vec2(24.0), 4);
  vec3 mc = uMortar * (0.7 + 0.35 * vnoise(uv * 420.0, vec2(420.0)));
  mc = mix(mc, vec3(0.12, 0.1, 0.09), smoothstep(0.35, 0.75, md) * 0.7);
  vec3 col = mix(bc, mc, mortarM);
  col = mix(col, vec3(0.035, 0.03, 0.03), gone * (1.0 - mortarM));
  // large soot clouds
  float soot = smoothstep(0.45, 0.95, fbmv(uv + 0.71, vec2(2.0), 5));
  col *= 1.0 - soot * 0.45;
  s.albedo = col;
  float proud = (h1 - 0.5) * 0.08;
  s.height = mix(0.7 + proud + mott * 0.08 - pit * 0.12 - (1.0 - arris) * 0.18, 0.18 + md * 0.06, mortarM) - gone * 0.55 * (1.0 - mortarM);
  s.rough = mix(mix(0.78 + 0.14 * h2, 0.66, clinker) + bloom * 0.1, 0.96, mortarM);
  s.metal = 0.0;
  s.ao = mix(mix(1.0, 0.75, 1.0 - arris), 0.42, mortarM) * (1.0 - gone * 0.6);
}`,
  });
}

/**
 * World-space grime for big surfaces (brick gables, timber): dirt banked along the
 * floor, soot along the roof line, vertical water/soot streaks below openings and at
 * rafter feet, and a broad tonal variation that kills visible tiling.
 * cfg: { floor: 0.5, roof: { knee, ridge, half } , streaks: [[x, yTop, width, strength]], tint, macro }
 */
export function addGrime(mat, cfg = {}) {
  const { floor = 0.45, roof = null, streaks = [], macro = 0.35, floorDark = 0.55, roofDark = 0.5, streakDark = 0.55 } = cfg;
  const S = streaks.slice(0, 6);
  while (S.length < 6) S.push([0, -10, 0.01, 0]);
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uGrStreak = { value: S.map((s) => new THREE.Vector4(...s)) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGrW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGrW;
uniform vec4 uGrStreak[6];
float grH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float grN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(grH(i), grH(i + vec2(1, 0)), f.x), mix(grH(i + vec2(0, 1)), grH(i + vec2(1, 1)), f.x), f.y); }
float grF(vec2 p) { return 0.5 * grN(p) + 0.25 * grN(p * 2.03 + 1.7) + 0.125 * grN(p * 4.01 + 3.1) + 0.0625 * grN(p * 8.1 + 5.3); }
float grimeMask(out float wet) {
  vec3 w = vGrW;
  vec2 hp = vec2(w.x + w.z, w.y);
  float g = 0.0;
  float fl = (1.0 - smoothstep(0.0, ${floor.toFixed(3)}, w.y + (grF(hp * 3.0) - 0.5) * 0.25)) * ${floorDark.toFixed(3)};
  g = max(g, fl);
  ${roof ? `float ry = ${roof.knee.toFixed(3)} + ${(roof.ridge - roof.knee).toFixed(3)} * (1.0 - abs(w.x) / ${roof.half.toFixed(3)});
  float rl = (1.0 - smoothstep(0.0, 0.7, ry - w.y + (grF(hp * 2.5 + 4.0) - 0.5) * 0.35)) * ${roofDark.toFixed(3)};
  g = max(g, rl);` : ''}
  wet = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 s = uGrStreak[i];
    float dx = abs(w.x - s.x + (grN(vec2(w.y * 3.0, float(i))) - 0.5) * 0.06);
    float cols = grN(vec2(w.x * 26.0 + float(i) * 7.0, 0.5));
    float st = (1.0 - smoothstep(s.z * 0.3, s.z, dx)) * step(w.y, s.y) * smoothstep(s.y - 2.6, s.y - 0.1, w.y);
    st *= 0.45 + 0.55 * smoothstep(0.3, 0.8, cols + 0.3 * grN(vec2(w.x * 60.0, w.y * 2.0)));
    st *= s.w;
    wet = max(wet, st);
  }
  g = max(g, wet * ${streakDark.toFixed(3)});
  return g;
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  float grWet; float grM = grimeMask(grWet);
  float grMac = grF(vec2(vGrW.x + vGrW.z * 0.7, vGrW.y) * 0.9);
  diffuseColor.rgb *= (1.0 - ${macro.toFixed(3)} * 0.5) + ${macro.toFixed(3)} * grMac;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.32, 0.3, 0.29), grM);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.72, grWet);`);
  };
  mat.customProgramCacheKey = () => `grime:${floor}:${JSON.stringify(roof)}:${macro}:${floorDark}:${roofDark}`;
  mat.needsUpdate = true;
  return mat;
}

/** Painted porcelain doll face for a sphere head (face centred at u = 0.25), craquelure, rosy cheeks. */
export function dollFaceTexture(forge, { key = 'doll', eye = '#2a3a5a', lip = '#9a2a2a', seed = 1 } = {}) {
  return forge.canvas(`attic:face:${key}`, 512, 256, (g, w, h) => {
    let s = seed * 7919 + 13;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    g.fillStyle = '#e8ddd0'; g.fillRect(0, 0, w, h);
    // slight yellowing toward the back
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(150,120,80,0.12)'); gr.addColorStop(0.25, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(150,120,80,0.15)'); gr.addColorStop(0.75, 'rgba(150,120,80,0.22)'); gr.addColorStop(1, 'rgba(150,120,80,0.12)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const cx = w * 0.25, cy = h * 0.52;
    // cheeks
    for (const sx of [-1, 1]) {
      const rg = g.createRadialGradient(cx + sx * 26, cy + 18, 0, cx + sx * 26, cy + 18, 24);
      rg.addColorStop(0, 'rgba(210,90,90,0.55)'); rg.addColorStop(1, 'rgba(210,90,90,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(cx + sx * 26, cy + 18, 24, 0, Math.PI * 2); g.fill();
    }
    // eyes: dark glass with lids, lashes and highlight
    for (const sx of [-1, 1]) {
      const ex = cx + sx * 17, ey = cy - 4;
      g.fillStyle = '#f4f0ea'; g.beginPath(); g.ellipse(ex, ey, 9, 6.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = eye; g.beginPath(); g.arc(ex, ey + 0.5, 5.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#050505'; g.beginPath(); g.arc(ex, ey + 0.5, 2.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(ex - 1.8, ey - 1.6, 1.3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2a1810'; g.lineWidth = 1.8; g.beginPath(); g.ellipse(ex, ey, 9, 6.5, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      for (let k = 0; k < 6; k++) { const a = Math.PI * (1.1 + k * 0.15); g.lineWidth = 0.9; g.beginPath(); g.moveTo(ex + Math.cos(a) * 9, ey + Math.sin(a) * 6.5); g.lineTo(ex + Math.cos(a) * 12, ey + Math.sin(a) * 9.5); g.stroke(); }
      // brows
      g.strokeStyle = 'rgba(90,50,30,0.8)'; g.lineWidth = 1.4; g.beginPath(); g.arc(ex, ey + 6, 15, Math.PI * 1.3, Math.PI * 1.7); g.stroke();
    }
    // nose shadow + nostrils
    g.fillStyle = 'rgba(170,110,90,0.35)'; g.beginPath(); g.ellipse(cx, cy + 12, 3, 2, 0, 0, Math.PI * 2); g.fill();
    // rosebud lips
    g.fillStyle = lip;
    g.beginPath(); g.moveTo(cx - 7, cy + 24); g.quadraticCurveTo(cx - 3.5, cy + 20, cx, cy + 22.5); g.quadraticCurveTo(cx + 3.5, cy + 20, cx + 7, cy + 24); g.quadraticCurveTo(cx, cy + 29, cx - 7, cy + 24); g.fill();
    g.strokeStyle = 'rgba(60,10,10,0.7)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(cx - 6, cy + 24); g.lineTo(cx + 6, cy + 24); g.stroke();
    // craquelure: hairline cracks, one bad crack across the cheek
    g.strokeStyle = 'rgba(70,55,45,0.35)'; g.lineWidth = 0.6;
    for (let i = 0; i < 40; i++) {
      let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 18; y += (rnd() - 0.5) * 18; g.lineTo(x, y); }
      g.stroke();
    }
    g.strokeStyle = 'rgba(40,25,20,0.8)'; g.lineWidth = 1.1;
    g.beginPath(); let x = cx + 30, y = cy - 30; g.moveTo(x, y);
    for (let k = 0; k < 9; k++) { x -= 4 + rnd() * 4; y += 5 + rnd() * 3; g.lineTo(x, y); }
    g.stroke();
    // grime in the hairline
    const hg = g.createLinearGradient(0, 0, 0, h * 0.3);
    hg.addColorStop(0, 'rgba(60,45,30,0.4)'); hg.addColorStop(1, 'rgba(60,45,30,0)');
    g.fillStyle = hg; g.fillRect(0, 0, w, h * 0.3);
  }, { tile: false });
}

/** Dapple-grey paint for the rocking horse: ring dapples, darker legs/points handled by geometry, worn varnish. */
export function dappleTexture(forge) {
  return forge.generate('attic:dapple', {
    size: 1024, normalStrength: 0.6,
    glsl: /* glsl */ `
void surface(vec2 uv, inout Surface s) {
  vec4 v = voronoi(uv * 5.0, vec2(5.0), 0.9);
  float ring = smoothstep(0.15, 0.32, v.x) * (1.0 - smoothstep(0.32, 0.5, v.x));
  float n = fbmv(uv, vec2(4.0), 5);
  vec3 base = vec3(0.5, 0.5, 0.49) * (0.85 + 0.2 * n);
  vec3 c = mix(base * 0.55, base * 1.15, 1.0 - ring * 0.8);
  float wear = smoothstep(0.62, 0.8, fbmv(uv + 0.3, vec2(6.0), 4));
  c = mix(c, vec3(0.36, 0.25, 0.16), wear * 0.75);           // worn through to the wood
  float cr = smoothstep(0.02, 0.0, voronoiEdge(uv * 30.0, vec2(30.0), 1.0)) * 0.5;
  c *= 1.0 - cr * 0.4;
  s.albedo = c;
  s.height = 0.5 - cr * 0.2 - wear * 0.1;
  s.rough = mix(0.38, 0.75, wear) + cr * 0.2;
  s.metal = 0.0; s.ao = 1.0 - cr * 0.3;
}`,
  });
}

/** Sagging sheet web strung from a beam along the top edge: catenaries, cross threads, dust clumps, drooping strands. */
export function cobwebTangleTexture(forge, seed = 4) {
  return forge.canvas(`attic:tangle${seed}`, 1024, 768, (g, w, h) => {
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    // anchor points along the top edge
    const anchors = []; for (let i = 0; i < 22; i++) anchors.push(w * (0.02 + 0.96 * (i / 21)) + (rnd() - 0.5) * 20);
    // catenaries between anchors at many depths
    for (let k = 0; k < 70; k++) {
      const a = anchors[Math.floor(rnd() * anchors.length)], b = anchors[Math.floor(rnd() * anchors.length)];
      if (Math.abs(a - b) < 40) continue;
      const sag = Math.min(h * 0.92, Math.abs(a - b) * (0.25 + rnd() * 0.6));
      g.strokeStyle = `rgba(232,234,240,${0.18 + rnd() * 0.4})`; g.lineWidth = 0.7 + rnd() * 1.2;
      g.beginPath(); g.moveTo(a, 2); g.quadraticCurveTo((a + b) / 2, sag * 2 - 2, b, 2); g.stroke();
    }
    // fine cross threads between existing sags (dense near the middle)
    for (let k = 0; k < 260; k++) {
      const x = w * (0.1 + 0.8 * rnd()), y = h * Math.pow(rnd(), 1.4) * 0.8;
      const l = 30 + rnd() * 110, a = (rnd() - 0.5) * 1.2;
      g.strokeStyle = `rgba(225,228,235,${0.1 + rnd() * 0.25})`; g.lineWidth = 0.5 + rnd() * 0.6;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + 12, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // dust balls caught in the web
    for (let i = 0; i < 120; i++) {
      const x = w * (0.08 + 0.84 * rnd()), y = h * Math.pow(rnd(), 1.2) * 0.85;
      g.fillStyle = `rgba(200,200,205,${0.15 + rnd() * 0.35})`;
      g.beginPath(); g.arc(x, y, 1 + rnd() * 3.5, 0, Math.PI * 2); g.fill();
    }
    // drooping strands at the bottom
    for (let i = 0; i < 26; i++) {
      const x = w * (0.1 + 0.8 * rnd()), y0 = h * (0.3 + 0.4 * rnd()), l = h * (0.15 + rnd() * 0.3);
      g.strokeStyle = `rgba(230,230,235,${0.25 + rnd() * 0.35})`; g.lineWidth = 0.8 + rnd();
      g.beginPath(); g.moveTo(x, y0); g.bezierCurveTo(x + 10, y0 + l * 0.3, x - 12, y0 + l * 0.7, x + (rnd() - 0.5) * 20, Math.min(h - 2, y0 + l)); g.stroke();
    }
  }, { tile: false });
}
