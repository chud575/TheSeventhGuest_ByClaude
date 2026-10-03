import * as THREE from 'three';

/**
 * Bedroom procedural textures (all authored for this room, generated on the GPU
 * through ctx.textures / TextureForge or on a 2D canvas):
 *  - nightSky(): moonlit sky, scudding cloud and a dead oak seen through the window
 *  - tornDrape(): moth-eaten, rotted velvet for the bed hangings (alpha = tears/holes)
 *  - quilt(): diamond-quilted silk counterpane with tufts and stains (tiles)
 *  - linen(): creased, yellowed sheets and pillow slips (tiles)
 *  - knightsBoard(): the 5x5 board carved and inlaid into the chest lid (uv 0..1 = lid)
 *  - crackedMirror(): silvered glass with a radial impact fracture (metal/rough/height)
 *  - coals(): glowing ember bed for the grate (emissive driven by the albedo)
 *  - dollFace(): painted bisque face for each doll (canvas)
 *  - wallpaper(): faded striped damask with water stains (tiles 0.5 m)
 */

export function nightSky(ctx) {
  return ctx.textures.generate('bedroom:sky', {
    size: 1024, aspect: 0.8, tile: false,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv;
      vec2 moon = vec2(0.58, 0.78);
      float md = length((p - moon) * vec2(0.8, 1.0));
      float cl = fbm(p * vec2(2.2, 3.2) + vec2(0.35, 0.1), vec2(64.0), 6);
      float cl2 = fbm(p * vec2(5.0, 7.0) + 3.1, vec2(64.0), 5);
      vec3 sky = mix(vec3(0.02, 0.035, 0.09), vec3(0.16, 0.22, 0.4), smoothstep(0.0, 1.0, p.y));
      sky += vec3(0.5, 0.58, 0.8) * exp(-md * 5.0) * 0.9;
      float c = smoothstep(-0.1, 0.4, cl + cl2 * 0.35);
      sky = mix(sky, sky * 0.3 + vec3(0.015, 0.02, 0.035), c * 0.85);
      sky += vec3(0.75, 0.8, 0.95) * smoothstep(0.16, 0.0, abs(cl + cl2 * 0.35 - 0.05)) * exp(-md * 2.5) * 0.6;
      sky = mix(sky, vec3(1.0, 0.98, 0.9) * 1.25, smoothstep(0.048, 0.04, md) * (1.0 - c * 0.5));
      // stars in the clear patches
      vec2 sg = floor(p * 260.0);
      float st = step(0.996, hash12(sg)) * (1.0 - c) * smoothstep(0.3, 0.8, p.y);
      sky += vec3(0.6, 0.7, 1.0) * st * 0.6;
      // dead oak: trunk + recursive-looking branches
      float tree = 1.0;
      float tx = 0.2 + 0.03 * sin(p.y * 7.0);
      tree = min(tree, abs(p.x - tx) - 0.03 * (1.15 - p.y));
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        vec2 o = vec2(tx, 0.3 + fi * 0.075);
        float side = mod(fi, 2.0) * 2.0 - 1.0;
        vec2 d = rot2(side * (0.75 + 0.25 * sin(fi * 2.3))) * (p - o);
        d.y += 0.03 * sin(d.x * 18.0 + fi);
        float len = 0.42 - fi * 0.03;
        float b = max(abs(d.y) - 0.007 * (1.0 - d.x / len), -d.x);
        b = max(b, d.x - len);
        tree = min(tree, b);
        // twigs
        vec2 d2 = rot2(0.6 * side) * (d - vec2(len * 0.55, 0.0));
        float tw = max(abs(d2.y + 0.01 * sin(d2.x * 40.0)) - 0.0035, -d2.x);
        tw = max(tw, d2.x - len * 0.4);
        tree = min(tree, tw);
      }
      float hill = p.y - (0.13 + 0.05 * fbm(vec2(p.x * 3.0, 0.5), vec2(64.0), 4));
      // a distant gabled roofline of the east wing
      float roof = max(p.y - 0.22 - max(0.0, 0.08 - abs(p.x - 0.78) * 0.6), abs(p.x - 0.78) - 0.2);
      vec3 col = sky;
      float sil = smoothstep(0.003, -0.003, min(min(tree, hill), roof));
      col = mix(col, vec3(0.008, 0.01, 0.018), sil);
      // one lit window in the far wing
      float win = sdBox(p - vec2(0.83, 0.18), vec2(0.008, 0.014));
      col = mix(col, vec3(1.0, 0.62, 0.25) * 0.9, smoothstep(0.002, -0.002, win));
      s.albedo = col;
      s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
    }`,
  });
}

/** Rotted velvet for the bed hangings. uv 0..1 over one panel (u across, v bottom->top). */
export function tornDrape(ctx, { seed = 1, color = [0.3, 0.05, 0.07] } = {}) {
  return ctx.textures.generate(`bedroom:drape${seed}`, {
    size: 1024, aspect: 0.5, tile: false, normalStrength: 1.6, seed,
    uniforms: { uCol: color, uS: seed * 7.13 },
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv;
      float n = fbm(p * vec2(4.0, 8.0) + uS, vec2(64.0), 6);
      float n2 = fbm(p * vec2(18.0, 30.0) + uS * 1.7, vec2(256.0), 4);
      // ragged, shredded hem at an uneven height, hanging in strips
      float strip = fbm(vec2(p.x * 9.0 + uS, 0.5), vec2(64.0), 4);
      float hem = 0.06 + 0.3 * strip * strip + 0.05 * n;
      float sid = floor(p.x * 7.0 + strip * 1.5 + uS);
      float tearLine = abs(fract(p.x * 7.0 + strip * 1.5 + uS) - 0.5);
      // long rips running up from the hem (some reach two thirds of the way up)
      float ripLen = step(0.45, hash11(sid)) * (0.2 + 0.5 * hash11(sid + 3.1));
      float ripW = 0.035 * (1.0 - smoothstep(hem, hem + ripLen, p.y)) + 0.004;
      float rip = smoothstep(ripW, ripW * 0.5, tearLine + n2 * 0.02) * step(p.y, hem + ripLen);
      float alpha = smoothstep(hem - 0.01, hem + 0.01, p.y + n2 * 0.04) * (1.0 - rip);
      // moth holes (many, ragged) and rotted-through patches
      vec4 v = voronoi(p * vec2(10.0, 20.0) + uS, vec2(256.0), 1.0);
      float holeSel = step(0.58, hash12(v.zw + uS));
      float hole = smoothstep(0.2, 0.13, v.x + n2 * 0.16) * holeSel;
      vec4 v2 = voronoi(p * vec2(3.0, 5.0) + uS * 1.3, vec2(256.0), 1.0);
      float bigHole = smoothstep(0.26, 0.18, v2.x + n2 * 0.18 + n * 0.08) * step(0.7, hash12(v2.zw + uS * 2.0)) * smoothstep(0.95, 0.6, p.y);
      float rot = smoothstep(0.58, 0.72, n + n2 * 0.3) * smoothstep(0.85, 0.25, p.y);
      alpha *= 1.0 - max(max(hole, bigHole), rot);
      // frayed edges darken (scorched/rotten rims round every hole and rip)
      float edge = smoothstep(0.12, 0.0, p.y - hem) + smoothstep(0.28, 0.17, v.x) * holeSel * 0.7
                 + smoothstep(0.34, 0.24, v2.x) * step(0.7, hash12(v2.zw + uS * 2.0)) * 0.6 + smoothstep(ripW * 3.0, ripW, tearLine) * step(p.y, hem + ripLen) * 0.6;
      edge = clamp(edge, 0.0, 1.0);
      // velvet pile: vertical nap, crushed patches
      float nap = vnoise(vec2(p.x * 700.0, p.y * 90.0), vec2(700.0, 90.0));
      float crush = smoothstep(0.3, 0.7, fbm(p * vec2(3.0, 5.0) + uS * 2.0, vec2(64.0), 4));
      vec3 c = uCol * (0.65 + 0.5 * crush) * (0.9 + 0.15 * nap);
      // sun/moon fading toward the top folds, grime toward the hem
      c = mix(c, c * vec3(1.15, 1.05, 1.1) + vec3(0.03, 0.02, 0.03), smoothstep(0.5, 1.0, p.y) * 0.4);
      c = mix(c, vec3(0.05, 0.035, 0.03), edge * 0.7 + smoothstep(0.5, 0.0, p.y) * 0.35);
      // dust bloom
      c += vec3(0.05, 0.045, 0.04) * smoothstep(0.55, 0.85, n2) * 0.6;
      s.albedo = c;
      s.alpha = alpha;
      s.height = 0.5 + 0.12 * nap + 0.2 * crush - edge * 0.2;
      s.rough = 0.8 - 0.15 * crush;
      s.metal = 0.0;
      s.ao = 1.0 - edge * 0.3;
    }`,
  });
}

/** Diamond-quilted silk counterpane, tufted at the crossings. 1 tile = 0.4 m. */
export function quilt(ctx) {
  return ctx.textures.generate('bedroom:quilt', {
    size: 1024, tile: true, normalStrength: 3.0,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv;
      // diamond grid: 4 diamonds per tile
      vec2 q = rot2(0.785398) * (p * 4.0) ;
      vec2 f = fract(q * 0.7071) - 0.5;
      float d = max(abs(f.x), abs(f.y));
      float puff = 1.0 - pow(d * 2.0, 2.0);
      float seam = smoothstep(0.47, 0.5, d);
      vec2 cf = fract(q * 0.7071 + 0.5) - 0.5;
      float tuft = smoothstep(0.07, 0.02, length(cf));
      // brocade motif inside each diamond
      vec2 m = f * 2.0;
      float leaf = sdVesica(rot2(0.785398) * m * 1.6, 0.6, 0.38);
      float star = sdStar(m, 0.18, 6.0, 3.0);
      vec3 base = vec3(0.30, 0.07, 0.07);
      vec3 gold = vec3(0.55, 0.38, 0.16);
      float silk = vnoise(vec2(p.x * 900.0, p.y * 120.0), vec2(900.0, 120.0));
      vec3 c = base * (0.75 + 0.35 * puff) * (0.92 + 0.12 * silk);
      c = mix(c, gold * 0.7, smoothstep(0.01, -0.01, abs(leaf) - 0.02) * 0.7);
      c = mix(c, gold, smoothstep(0.01, -0.01, star) * 0.8);
      c *= 1.0 - seam * 0.6;
      c = mix(c, vec3(0.08, 0.05, 0.03), tuft * 0.8);
      // age stains and fading
      float st = fbm(p * 1.3, vec2(1.3), 5);
      c = mix(c, c * vec3(0.7, 0.62, 0.5) + vec3(0.06, 0.05, 0.03), smoothstep(0.55, 0.8, st) * 0.6);
      s.albedo = c;
      s.height = 0.3 + 0.55 * puff - seam * 0.3 - tuft * 0.4;
      s.rough = 0.55 - 0.15 * silk + seam * 0.3;
      s.metal = 0.0;
      s.ao = 0.75 + 0.25 * puff - seam * 0.3;
    }`,
  });
}

/** Yellowed linen with creases. 1 tile = 0.6 m. */
export function linen(ctx) {
  return ctx.textures.generate('bedroom:linen', {
    size: 512, tile: true, normalStrength: 1.4,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float weave = (sin(uv.x * 1600.0) * 0.5 + 0.5) * (sin(uv.y * 1600.0) * 0.5 + 0.5);
      float crease = ridged(uv * 3.0, vec2(3.0), 5);
      float st = fbm(uv * 2.0 + 4.0, vec2(2.0), 5);
      vec3 c = vec3(0.78, 0.74, 0.64) * (0.9 + 0.1 * weave);
      c = mix(c, vec3(0.62, 0.52, 0.36), smoothstep(0.5, 0.85, st) * 0.55);
      c *= 0.85 + 0.15 * crease;
      s.albedo = c;
      s.height = 0.4 + 0.4 * crease + 0.05 * weave;
      s.rough = 0.88; s.metal = 0.0; s.ao = 0.8 + 0.2 * crease;
    }`,
  });
}

/**
 * The chest lid: a carved walnut field with a 5x5 inlaid board (holly and bog-oak
 * squares) inside a fretted border, uv 0..1 over the lid top (aspect w/d).
 * board: fraction of the lid depth the board occupies.
 */
export function knightsBoard(ctx, { aspect = 2.0, board = 0.82 } = {}) {
  return ctx.textures.generate('bedroom:board', {
    size: 2048, aspect, tile: false, normalStrength: 2.2,
    uniforms: { uAspect2: aspect, uBoard: board },
    glsl: /* glsl */ `
    vec3 grain(vec2 p, vec3 a, vec3 b, float seed, float freq) {
      float n = fbm(p * 0.6 + seed, vec2(64.0), 4);
      float g = 0.5 + 0.5 * sin((p.y * freq + n * 6.0 + seed) * 3.14159);
      g = pow(g, 2.2);
      float fine = vnoise(p * vec2(900.0, 40.0) + seed, vec2(4096.0));
      return mix(a, b, clamp(g * 0.6 + fine * 0.3, 0.0, 1.0));
    }
    void surface(vec2 uv, inout Surface s) {
      // metric-ish coordinates: x spans [0, aspect], y spans [0, 1]
      vec2 m = vec2(uv.x * uAspect2, uv.y);
      vec2 c = m - vec2(uAspect2 * 0.5, 0.5);
      float hb = uBoard * 0.5;
      float field = hb * (5.0 / 6.0);          // inner 5x5 area; the rest is the carved border
      vec3 col; float h = 0.5; float rough = 0.42;
      vec3 walA = vec3(0.32, 0.19, 0.1), walB = vec3(0.14, 0.075, 0.04);
      vec3 wal = grain(m * vec2(1.0, 6.0), walA, walB, 3.0, 18.0);
      float ax = max(abs(c.x), abs(c.y));
      if (ax < field) {
        vec2 q = (c + field) / (2.0 * field) * 5.0;  // 0..5
        vec2 id = floor(q); vec2 f = fract(q);
        bool light = mod(id.x + id.y, 2.0) < 0.5;
        float sd = hash12(id) * 30.0;
        vec2 gp = light ? q : q.yx;
        col = light ? grain(gp * 2.0 + id, vec3(0.74, 0.62, 0.42), vec3(0.6, 0.46, 0.28), sd, 14.0)
                    : grain(gp * 2.0 + id, vec3(0.1, 0.06, 0.04), vec3(0.035, 0.02, 0.015), sd, 20.0);
        float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
        float seam = smoothstep(0.0, 0.02, e);
        col *= 0.75 + 0.25 * seam;
        h = 0.55 - (1.0 - seam) * 0.15;
        rough = light ? 0.36 : 0.3;
        // worn centre of each square (fingers)
        col = mix(col, col * 1.12, smoothstep(0.5, 0.0, length(f - 0.5)) * 0.2);
      } else if (ax < hb) {
        // carved border: brass stringing, a band of interlaced knotwork, ebony line
        float t = (ax - field) / (hb - field);
        vec2 along = abs(c.x) > abs(c.y) ? vec2(c.y, ax) : vec2(c.x, ax);
        if (t < 0.08) { col = vec3(0.75, 0.55, 0.25); rough = 0.3; h = 0.6; }
        else if (t < 0.9) {
          float k = along.x * 34.0;
          float w1 = abs(fract(k) - 0.5 - 0.25 * sin((t - 0.08) / 0.82 * 6.2832));
          float w2 = abs(fract(k + 0.5) - 0.5 + 0.25 * sin((t - 0.08) / 0.82 * 6.2832));
          float band = min(w1, w2);
          float rope = smoothstep(0.16, 0.06, band);
          col = mix(walB * 0.6, mix(walA, vec3(0.3, 0.17, 0.08), 0.5), rope);
          h = 0.3 + 0.45 * rope;
          rough = 0.5;
        } else { col = vec3(0.02, 0.015, 0.012); rough = 0.25; h = 0.5; }
      } else {
        // lid field: walnut with a sunk panel moulding line and carved corner fans
        col = wal;
        float d = max(abs(c.x) / (uAspect2 * 0.5 - 0.05), abs(c.y) / 0.45);
        float groove = smoothstep(0.012, 0.0, abs(d - 0.97));
        col *= 1.0 - groove * 0.5;
        h = 0.5 - groove * 0.3;
        // polish worn pale where hands lift the lid (front edge), grime collected round the board
        float front = smoothstep(0.42, 0.5, -c.y) * 0.5;
        col = mix(col, col * 1.45 + vec3(0.03, 0.02, 0.01), front);
        float nearBoard = smoothstep(hb + 0.06, hb, ax);
        col *= 1.0 - nearBoard * 0.35;
        rough = 0.38 + nearBoard * 0.25 - front * 0.1;
      }
      // grime in the low spots, scratches
      float sc = smoothstep(0.985, 1.0, vnoise(rot2(0.5) * m * vec2(300.0, 6.0), vec2(4096.0)));
      col = mix(col, col * 1.4 + 0.05, sc * 0.3);
      col *= 0.85 + 0.15 * fbm(m * 3.0, vec2(64.0), 4);
      s.albedo = col;
      s.height = h;
      s.rough = rough + sc * 0.2;
      s.metal = 0.0;
      s.ao = 0.7 + 0.3 * h;
    }`,
  });
}

/** Silvered mirror with a radial impact fracture and foxing at the edges. uv 0..1 over the glass. */
export function crackedMirror(ctx, { aspect = 0.7, impact = [0.62, 0.58] } = {}) {
  return ctx.textures.generate('bedroom:mirror', {
    size: 1024, aspect, tile: false, normalStrength: 6.0,
    uniforms: { uImp: impact, uAsp: aspect },
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 p = (uv - uImp) * vec2(uAsp, 1.0);
      float r = length(p);
      float a = atan(p.y, p.x);
      // radial cracks: irregular sectors
      float sectors = 13.0;
      float sa = a / 6.2832 * sectors;
      float wob = fbm(vec2(r * 5.0, floor(sa)), vec2(64.0), 3) * 0.6;
      float sid = floor(sa + wob);
      float fs = fract(sa + wob);
      float radial = min(fs, 1.0 - fs) * r * 6.2832 / sectors;   // distance to nearest radial crack (approx metres)
      // concentric cracks
      float ringIdx = floor(log(r * 12.0 + 1.0) * 2.4 + hash11(sid) * 0.8);
      float ringF = fract(log(r * 12.0 + 1.0) * 2.4 + hash11(sid) * 0.8);
      float ring = min(ringF, 1.0 - ringF) * r * 0.5;
      float crackD = min(radial, ring * step(0.03, r) * step(r, 0.45 + 0.1 * hash11(sid)));
      float crack = smoothstep(0.0025, 0.0, crackD) * smoothstep(0.75, 0.2, r);
      // each shard tilted a little: height ramps per shard
      vec2 shard = vec2(sid, ringIdx);
      vec2 tilt = (hash22(shard) - 0.5) * 2.0;
      float hs = dot(p, tilt) * 1.2 * smoothstep(0.6, 0.05, r);
      // the impact crater
      float crater = smoothstep(0.025, 0.0, r);
      // foxing / desilvering near the edges
      vec2 e = min(uv, 1.0 - uv);
      float edge = min(e.x, e.y);
      float fox = smoothstep(0.12, 0.0, edge + fbm(uv * 8.0, vec2(64.0), 5) * 0.08);
      float spots = smoothstep(0.7, 0.8, fbm(uv * 14.0 + 5.0, vec2(64.0), 4)) * 0.8;
      vec3 silver = vec3(0.82, 0.83, 0.85);
      vec3 col = silver * (1.0 - crack * 0.85) * (1.0 - crater * 0.7);
      col = mix(col, vec3(0.16, 0.13, 0.1), max(fox, spots) * 0.85);
      s.albedo = col;
      s.metal = 1.0 - max(fox, spots) * 0.8;
      s.rough = 0.04 + crack * 0.5 + crater * 0.6 + max(fox, spots) * 0.5;
      s.height = 0.5 + hs * 0.08 - crack * 0.15 - crater * 0.2;
      s.ao = 1.0 - crack * 0.5;
    }`,
  });
}

/** Ember bed. Emissive is driven by the map (bright orange cracks between charcoal). */
export function coals(ctx) {
  return ctx.textures.generate('bedroom:coals', {
    size: 512, tile: true, normalStrength: 3.0,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec4 v = voronoi(uv * 10.0, vec2(10.0), 1.0);
      float lump = smoothstep(0.0, 0.45, v.y - v.x);
      float glow = smoothstep(0.12, 0.0, v.y - v.x) * (0.5 + 0.5 * fbm(uv * 6.0, vec2(6.0), 4));
      vec3 c = mix(vec3(0.035, 0.03, 0.028), vec3(0.08, 0.06, 0.05), lump * hash12(v.zw));
      c = mix(c, vec3(1.0, 0.38, 0.06), glow);
      s.albedo = c;
      s.height = 0.3 + 0.6 * lump;
      s.rough = 0.9; s.metal = 0.0; s.ao = 0.6 + 0.4 * lump;
    }`,
  });
}

/** Faded striped damask (blue on blue) with tide-mark water stains. 1 tile = 0.5 m. */
export function wallpaper(ctx) {
  return ctx.textures.generate('bedroom:wallpaper', {
    size: 1024, tile: true, normalStrength: 0.8,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv;
      // stripes: wide damask band + narrow satin pinstripes
      float sx = fract(p.x * 2.0);
      float band = step(0.2, sx) * step(sx, 0.8);
      float pin = smoothstep(0.012, 0.0, abs(sx - 0.1)) + smoothstep(0.012, 0.0, abs(sx - 0.9));
      vec3 ground = vec3(0.075, 0.095, 0.23);
      vec3 satin = vec3(0.105, 0.13, 0.3);
      vec3 motif = vec3(0.16, 0.19, 0.4);
      vec3 gilt = vec3(0.45, 0.36, 0.2);
      // damask motif in the band: lily/flame shape, mirrored
      vec2 m = vec2((sx - 0.5) * 2.2, fract(p.y * 2.0) - 0.5);
      vec2 am = vec2(abs(m.x), m.y);
      float lily = sdVesica(am - vec2(0.0, 0.05), 0.42, 0.3);
      float side = sdVesica(rot2(0.7) * (am - vec2(0.22, -0.12)), 0.22, 0.16);
      float bud = sdCircle(am - vec2(0.0, 0.36), 0.05);
      float curl = abs(sdCircle(am - vec2(0.25, 0.22), 0.09)) - 0.012;
      float sh = min(min(lily, side), min(bud, curl));
      float inner = abs(sdVesica(am - vec2(0.0, 0.05), 0.3, 0.22)) - 0.01;
      vec3 c = mix(ground, satin, band);
      float mo = smoothstep(0.01, -0.01, sh) * band;
      c = mix(c, motif, mo);
      c = mix(c, ground * 1.1, smoothstep(0.008, -0.008, inner) * band);
      c = mix(c, gilt, pin * 0.8);
      float paper = fbm(p * 12.0, vec2(12.0), 4);
      c *= 0.88 + 0.16 * paper;
      // water stains / tide marks
      float st = fbm(p * 0.7 + 2.0, vec2(0.7), 5);
      float tide = smoothstep(0.02, 0.0, abs(st - 0.62));
      c = mix(c, c * vec3(0.8, 0.75, 0.62), smoothstep(0.62, 0.7, st) * 0.5);
      c = mix(c, vec3(0.2, 0.17, 0.12), tide * 0.4);
      s.albedo = c;
      s.height = 0.5 + mo * 0.15 + pin * 0.1 + paper * 0.05;
      s.rough = mix(0.85, 0.45, max(mo, pin * 0.6)) ;
      s.metal = pin * 0.5;
      s.ao = 1.0;
    }`,
  });
}

/** Painted bisque doll face (canvas, 1024x512). Face centred at u = 0.25 (SphereGeometry +Z). */
export function dollFace(ctx, { seed = 0, cracked = false, eyes = '#3a5a8a', hair = '#4a2a14' } = {}) {
  return ctx.textures.canvas(`bedroom:doll2_${seed}${cracked ? 'c' : ''}`, 1024, 512, (g, w, h) => {
    const rnd = (i) => { const x = Math.sin(i * 91.7 + seed * 47.3) * 43758.5453; return x - Math.floor(x); };
    // bisque ground: warm ivory with a cooler, slightly grey shading toward the back
    const base = g.createLinearGradient(0, 0, w, 0);
    base.addColorStop(0, '#d9cdbd'); base.addColorStop(0.25, '#efe4d4'); base.addColorStop(0.5, '#d6c9b8'); base.addColorStop(1, '#d9cdbd');
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${150 + rnd(i) * 60},${120 + rnd(i + 1) * 40},100,0.035)`; g.beginPath(); g.arc(rnd(i + 2) * w, rnd(i + 3) * h, 3 + rnd(i + 4) * 14, 0, 7); g.fill(); }
    const cx = w * 0.25, cy = h * 0.52;
    const S = 2.0;      // feature scale (px per old px)
    // hair line (the hair cap covers the rest)
    g.fillStyle = hair; g.fillRect(0, 0, w, h * 0.2);
    // cheeks: strong, rouged blush that reads from across the room
    for (const sd of [-1, 1]) {
      const x = cx + sd * 40 * S, y = cy + 26 * S;
      const gr = g.createRadialGradient(x, y, 2, x, y, 34 * S);
      gr.addColorStop(0, 'rgba(214,82,86,0.75)'); gr.addColorStop(0.6, 'rgba(214,92,96,0.3)'); gr.addColorStop(1, 'rgba(214,92,96,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 34 * S, 0, 7); g.fill();
    }
    // chin + nose-tip blush
    for (const [x, y, r, a] of [[cx, cy + 48 * S, 14 * S, 0.35], [cx, cy + 16 * S, 8 * S, 0.3]]) {
      const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(205,95,90,${a})`); gr.addColorStop(1, 'rgba(205,95,90,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    // eye sockets: dark, wide, painted lids; the glass eyeballs sit on top (see buildDoll)
    for (const sd of [-1, 1]) {
      const ex = cx + sd * 26 * S, ey = cy - 2 * S;
      // eye shadow
      const sh = g.createRadialGradient(ex, ey - 6 * S, 2, ex, ey - 4 * S, 22 * S);
      sh.addColorStop(0, 'rgba(120,70,70,0.45)'); sh.addColorStop(1, 'rgba(120,70,70,0)');
      g.fillStyle = sh; g.beginPath(); g.arc(ex, ey - 4 * S, 22 * S, 0, 7); g.fill();
      g.fillStyle = '#efe9de'; g.beginPath(); g.ellipse(ex, ey, 15 * S, 10 * S, 0, 0, 7); g.fill();
      g.fillStyle = eyes; g.beginPath(); g.arc(ex, ey + 1 * S, 8.5 * S, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(ex, ey + 1 * S, 8.5 * S, Math.PI, 0); g.fill();
      g.fillStyle = '#050403'; g.beginPath(); g.arc(ex, ey + 1 * S, 4 * S, 0, 7); g.fill();
      // heavy upper lid line + painted lashes (upper and lower)
      g.strokeStyle = '#1a0f08'; g.lineWidth = 3.4 * S; g.beginPath(); g.ellipse(ex, ey + 1 * S, 15.5 * S, 10.5 * S, 0, Math.PI * 1.04, Math.PI * 1.96); g.stroke();
      g.lineWidth = 1.4 * S;
      for (let k = 0; k < 9; k++) { const a = Math.PI * (1.1 + k * 0.1); g.beginPath(); g.moveTo(ex + Math.cos(a) * 15 * S, ey + 1 * S + Math.sin(a) * 10 * S); g.lineTo(ex + Math.cos(a) * 21 * S, ey + 1 * S + Math.sin(a) * 16 * S); g.stroke(); }
      g.lineWidth = 0.9 * S; g.strokeStyle = 'rgba(40,20,10,0.8)';
      for (let k = 0; k < 7; k++) { const a = Math.PI * (0.2 + k * 0.1); g.beginPath(); g.moveTo(ex + Math.cos(a) * 14 * S, ey + 1 * S + Math.sin(a) * 9 * S); g.lineTo(ex + Math.cos(a) * 17 * S, ey + 1 * S + Math.sin(a) * 13 * S); g.stroke(); }
      // feathered brows, high and thin (surprised)
      g.strokeStyle = 'rgba(80,45,22,0.85)'; g.lineWidth = 1.2 * S;
      for (let k = 0; k < 10; k++) { const t = k / 9; const bx = ex - 15 * S + t * 30 * S; const by = ey - 22 * S - Math.sin(t * Math.PI) * 6 * S; g.beginPath(); g.moveTo(bx, by + 2 * S); g.lineTo(bx + 4 * S, by - 1 * S); g.stroke(); }
    }
    // nostril dots and a tiny rosebud mouth, parted to show two painted teeth
    g.fillStyle = 'rgba(150,70,60,0.75)'; g.beginPath(); g.arc(cx - 3.5 * S, cy + 19 * S, 1.8 * S, 0, 7); g.arc(cx + 3.5 * S, cy + 19 * S, 1.8 * S, 0, 7); g.fill();
    g.fillStyle = '#a32a2c'; g.beginPath(); g.moveTo(cx - 11 * S, cy + 35 * S); g.quadraticCurveTo(cx - 5 * S, cy + 28 * S, cx, cy + 32 * S); g.quadraticCurveTo(cx + 5 * S, cy + 28 * S, cx + 11 * S, cy + 35 * S); g.quadraticCurveTo(cx, cy + 43 * S, cx - 11 * S, cy + 35 * S); g.fill();
    g.fillStyle = '#2a0808'; g.beginPath(); g.ellipse(cx, cy + 35.5 * S, 6 * S, 1.8 * S, 0, 0, 7); g.fill();
    g.fillStyle = '#f2ece0'; g.fillRect(cx - 3.2 * S, cy + 34 * S, 2.8 * S, 2.2 * S); g.fillRect(cx + 0.4 * S, cy + 34 * S, 2.8 * S, 2.2 * S);
    if (cracked) {
      g.strokeStyle = 'rgba(30,20,14,0.9)'; g.lineWidth = 1.8 * S;
      let x = cx + 36 * S, y = cy - 70 * S; g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < 11; i++) { x += (rnd(i + 30) - 0.62) * 16 * S; y += 10 * S + rnd(i + 40) * 6 * S; g.lineTo(x, y); }
      g.stroke();
      g.lineWidth = 1.2 * S; g.beginPath(); g.moveTo(cx + 26 * S, cy - 26 * S); g.lineTo(cx + 40 * S, cy - 10 * S); g.lineTo(cx + 34 * S, cy + 8 * S); g.stroke();
      g.fillStyle = '#140d08'; g.beginPath(); g.moveTo(cx + 30 * S, cy - 44 * S); g.lineTo(cx + 46 * S, cy - 34 * S); g.lineTo(cx + 37 * S, cy - 24 * S); g.lineTo(cx + 33 * S, cy - 30 * S); g.closePath(); g.fill();
    }
    // grime in the creases + a brown tear stain under one eye
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,45,30,${0.03 + rnd(i + 70) * 0.05})`; g.beginPath(); g.arc(rnd(i + 80) * w, rnd(i + 90) * h, 8 + rnd(i + 100) * 30, 0, 7); g.fill(); }
    const tx = cx + (seed % 2 ? 26 : -26) * S;
    const tg = g.createLinearGradient(tx, cy + 10 * S, tx, cy + 60 * S); tg.addColorStop(0, 'rgba(80,55,35,0.35)'); tg.addColorStop(1, 'rgba(80,55,35,0)');
    g.fillStyle = tg; g.fillRect(tx - 2.5 * S, cy + 10 * S, 5 * S, 50 * S);
  }, { tile: false });
}

/** Machine lace (canvas, alpha): scalloped edge band with eyelets; u wraps, v = 0 inner .. 1 scalloped edge. */
export function laceTex(ctx) {
  return ctx.textures.canvas('bedroom:lace', 256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(240,234,220,1)';
    g.fillRect(0, 0, w, h * 0.22);
    // scallops
    const n = 4;
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * (w / n);
      g.beginPath(); g.arc(cx, h * 0.22, w / n / 2, 0, Math.PI); g.fill();
    }
    // eyelets + net
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * (w / n);
      for (const [dx, dy, r] of [[0, 0.45, 7], [-14, 0.35, 4], [14, 0.35, 4], [0, 0.6, 3]]) { g.beginPath(); g.arc(cx + dx, h * dy, r, 0, 7); g.fill(); }
    }
    for (let x = 4; x < w; x += 8) for (let y = 4; y < h * 0.2; y += 8) { g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'source-over';
  }, { tile: true });
}

/** Clock face for the mantel clock (canvas). */
export function clockFace(ctx) {
  return ctx.textures.canvas('bedroom:clock', 256, 256, (g, w) => {
    g.fillStyle = '#d9cdb2'; g.fillRect(0, 0, w, w);
    const c = w / 2;
    g.strokeStyle = '#2a2018'; g.lineWidth = 3; g.beginPath(); g.arc(c, c, w * 0.46, 0, 7); g.stroke();
    g.lineWidth = 1; g.beginPath(); g.arc(c, c, w * 0.38, 0, 7); g.stroke();
    g.fillStyle = '#2a2018'; g.font = 'bold 22px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    R.forEach((t, i) => { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; g.save(); g.translate(c + Math.cos(a) * w * 0.42 * 0.86, c + Math.sin(a) * w * 0.42 * 0.86); g.rotate(a + Math.PI / 2); g.fillText(t, 0, 0); g.restore(); });
    // hands stopped at 3:33 — homage to a certain hour
    const hand = (ang, len, wd) => { g.save(); g.translate(c, c); g.rotate(ang); g.fillStyle = '#120c08'; g.beginPath(); g.moveTo(-wd, 0); g.lineTo(0, -len); g.lineTo(wd, 0); g.lineTo(0, len * 0.15); g.fill(); g.restore(); };
    hand(((3 + 33 / 60) / 12) * Math.PI * 2, w * 0.24, 5);
    hand((33 / 60) * Math.PI * 2, w * 0.36, 3.5);
    g.fillStyle = 'rgba(80,60,30,0.15)'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc((i * 37) % w, (i * 53) % w, 8, 0, 7); g.fill(); }
  }, { tile: false });
}

/** Corner cobweb (canvas, alpha): radial threads + sagging spiral, anchored at the top-left corner. */
export function cobweb(ctx, { seed = 0 } = {}) {
  return ctx.textures.canvas(`bedroom:web${seed}`, 512, 512, (g, w, h) => {
    const rnd = (i) => { const x = Math.sin(i * 63.7 + seed * 19.1) * 43758.5453; return x - Math.floor(x); };
    g.clearRect(0, 0, w, h);
    const n = 9;
    const spokes = [];
    for (let i = 0; i < n; i++) { const a = (i / (n - 1)) * Math.PI / 2 + (rnd(i) - 0.5) * 0.08; spokes.push({ a, len: w * (0.75 + rnd(i + 20) * 0.35) }); }
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(235,235,240,0.75)';
    g.lineWidth = 1.6;
    for (const s of spokes) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(s.a) * s.len, Math.sin(s.a) * s.len); g.stroke(); }
    g.lineWidth = 1.1;
    for (let r = 30; r < w * 0.95; r += 16 + rnd(r) * 10) {
      g.strokeStyle = `rgba(230,230,236,${0.35 + rnd(r + 3) * 0.35})`;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const s = spokes[i]; if (r > s.len) break;
        const x = Math.cos(s.a) * r, y = Math.sin(s.a) * r;
        if (i === 0) g.moveTo(x, y);
        else { const p = spokes[i - 1]; const mx = Math.cos((s.a + p.a) / 2) * r * 0.9, my = Math.sin((s.a + p.a) / 2) * r * 0.9; g.quadraticCurveTo(mx, my, x, y); }
      }
      g.stroke();
    }
    // broken, drooping strands and dust clumps
    for (let i = 0; i < 6; i++) {
      const s = spokes[Math.floor(rnd(i + 50) * n)]; const r = s.len * (0.4 + rnd(i + 60) * 0.5);
      const x = Math.cos(s.a) * r, y = Math.sin(s.a) * r;
      g.strokeStyle = 'rgba(220,220,225,0.5)'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 20, y + 60, x + 10 * rnd(i), y + 90 + rnd(i + 3) * 60); g.stroke();
      g.fillStyle = 'rgba(200,198,190,0.35)'; g.beginPath(); g.arc(x, y, 3 + rnd(i + 70) * 6, 0, 7); g.fill();
    }
  }, { tile: false });
}

/** Carved bone for the light knights: faint longitudinal grain, Haversian pores, age-yellowing. tiles; 1 unit = piece height */
export function boneGrain(ctx) {
  return ctx.textures.generate('bedroom:bone', {
    size: 512, tile: true, normalStrength: 0.6,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float g = fbm(vec2(uv.x * 3.0, uv.y * 24.0), vec2(3.0, 24.0), 5);
      float streak = smoothstep(0.1, 0.6, fbm(vec2(uv.x * 8.0, uv.y * 60.0), vec2(8.0, 60.0), 4));
      vec4 v = voronoi(uv * vec2(30.0, 12.0), vec2(30.0, 12.0), 1.0);
      float pore = smoothstep(0.08, 0.0, v.x) * step(0.6, hash12(v.zw));
      float age = fbm(uv * 2.0 + 3.0, vec2(2.0), 4);
      vec3 c = vec3(1.0);
      c *= 0.94 + 0.06 * g;
      c = mix(c, vec3(0.93, 0.86, 0.72), smoothstep(0.2, 0.8, age) * 0.5);
      c = mix(c, vec3(0.75, 0.66, 0.52), streak * 0.18 + pore * 0.4);
      s.albedo = c;
      s.height = 0.5 + 0.1 * g - pore * 0.2;
      s.rough = 0.34 + 0.12 * streak + pore * 0.3;
      s.metal = 0.0; s.ao = 1.0 - pore * 0.3;
    }`,
  });
}

/** Ebony end-grain: near-black with faint brown figure (the colour comes from the material tint). */
export function ebonyGrain(ctx) {
  return ctx.textures.generate('bedroom:ebonyp', {
    size: 512, tile: true, normalStrength: 0.4,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float n = fbm(uv * vec2(2.0, 3.0), vec2(2.0, 3.0), 4);
      float rings = 0.5 + 0.5 * sin((uv.y * 30.0 + n * 6.0) * 3.14159);
      float fine = vnoise(vec2(uv.x * 200.0, uv.y * 12.0), vec2(200.0, 12.0));
      vec3 c = mix(vec3(0.8), vec3(1.0, 0.82, 0.66), pow(rings, 6.0) * 0.7) * (0.88 + 0.12 * fine);
      s.albedo = clamp(c, 0.0, 1.0);
      s.height = 0.5 + 0.05 * fine;
      s.rough = 0.25; s.metal = 0.0; s.ao = 1.0;
    }`,
  });
}

/** Nero marble with thin, low-contrast grey-gold veins (the stock nero reads as white lightning). tiles; 1 tile = 0.8 m */
export function neroMarble(ctx) {
  return ctx.textures.generate('bedroom:nero', {
    size: 1024, tile: true, normalStrength: 0.25,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 per = vec2(2.0);
      vec2 w = vec2(fbm(uv, per, 6), fbm(uv + 5.2, per, 6));
      float v = fbm(uv * 1.0 + w * 0.35, per, 6);
      float veins = 1.0 - smoothstep(0.0, 0.016, abs(v));
      float v2 = fbm(uv * 2.0 + w * 0.5 + 3.3, per * 2.0, 5);
      float fine = 1.0 - smoothstep(0.0, 0.006, abs(v2));
      float cloud = fbm(uv * 3.0 + w, per * 3.0, 5) * 0.5 + 0.5;
      vec3 col = vec3(0.035, 0.032, 0.034) * (0.85 + 0.3 * cloud);
      col = mix(col, vec3(0.09, 0.08, 0.075), smoothstep(0.5, 0.95, cloud) * 0.5);
      col = mix(col, vec3(0.5, 0.46, 0.4), veins * 0.62);
      col = mix(col, vec3(0.3, 0.27, 0.24), fine * 0.45);
      float pits = step(0.992, hash12(floor(uv * 700.0)));
      s.albedo = col;
      s.height = 0.5 - pits * 0.3;
      s.rough = 0.12 + cloud * 0.06 + pits * 0.4 + veins * 0.05;
      s.metal = 0.0; s.ao = 1.0;
    }`,
  });
}

/** Charred log bark: alligator-checked char with ash on the ridges; alpha channel unused.
 *  The returned set's ORM blue (metal) channel is 0; glow mask is written into a second, emissive set. */
export function charLog(ctx, { glow = false } = {}) {
  return ctx.textures.generate(`bedroom:char${glow ? 'G' : ''}`, {
    size: 512, tile: true, normalStrength: 3.0,
    uniforms: { uGlow: glow ? 1 : 0 },
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec4 v = voronoi(uv * vec2(6.0, 14.0), vec2(6.0, 14.0), 1.0);
      float crack = 1.0 - smoothstep(0.0, 0.08, v.y - v.x);
      float ridge = smoothstep(0.1, 0.45, v.y - v.x);
      float n = fbm(uv * 8.0, vec2(8.0), 5);
      float ash = smoothstep(0.55, 0.85, ridge * 0.6 + n * 0.6 + hash12(v.zw) * 0.3);
      vec3 col = mix(vec3(0.018, 0.015, 0.013), vec3(0.06, 0.05, 0.045), ridge * hash12(v.zw));
      col = mix(col, vec3(0.42, 0.4, 0.37), ash * 0.6);
      float hot = crack * smoothstep(0.35, 0.75, fbm(uv * 3.0 + 1.7, vec2(3.0), 4) + 0.15);
      if (uGlow > 0.5) { col = vec3(1.0, 0.36, 0.06) * hot + vec3(0.25, 0.04, 0.0) * crack * 0.3; }
      s.albedo = col;
      s.height = 0.25 + 0.6 * ridge - crack * 0.2;
      s.rough = 0.9; s.metal = 0.0; s.ao = 0.5 + 0.5 * ridge;
    }`,
  });
}

/** Rug fringe strands (canvas, alpha): u across the rug end, v 0 = rug edge .. 1 = loose ends. */
export function fringeTex(ctx) {
  return ctx.textures.canvas('bedroom:fringe', 1024, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const rnd = (i) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i < 260; i++) {
      const x = (i + 0.5) * (w / 260) + (rnd(i) - 0.5) * 2;
      const len = h * (0.65 + rnd(i + 7) * 0.35) * (rnd(i + 11) < 0.06 ? 0.4 : 1);
      const bend = (rnd(i + 3) - 0.5) * 8;
      const c = 205 + rnd(i + 5) * 30;
      g.strokeStyle = `rgb(${c},${c - 10},${c - 30})`; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + bend * 0.3, len * 0.5, x + bend, len); g.stroke();
    }
    // the knotted band where the warp threads leave the rug
    g.fillStyle = 'rgb(200,188,160)'; g.fillRect(0, 0, w, 5);
  }, { tile: true });
}
