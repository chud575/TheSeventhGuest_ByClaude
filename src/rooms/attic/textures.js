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
    size: 1024, aspect: 2, normalStrength: 2.2,
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
