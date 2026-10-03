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
      // ragged, shredded hem: long vertical tears hanging in strips
      float strip = fbm(vec2(p.x * 9.0 + uS, 0.5), vec2(64.0), 4);
      float hem = 0.16 + 0.22 * strip + 0.06 * n;
      float tearLine = abs(fract(p.x * 6.0 + strip * 1.5 + uS) - 0.5);
      hem += smoothstep(0.06, 0.0, tearLine) * 0.35 * step(0.4, hash11(floor(p.x * 6.0 + strip * 1.5 + uS)));
      float alpha = smoothstep(hem - 0.01, hem + 0.01, p.y + n2 * 0.03);
      // moth holes and rot patches
      vec4 v = voronoi(p * vec2(9.0, 18.0) + uS, vec2(256.0), 1.0);
      float hole = smoothstep(0.17, 0.12, v.x + n2 * 0.12) * step(0.72, hash12(v.zw + uS));
      float rot = smoothstep(0.6, 0.75, n + n2 * 0.25) * smoothstep(0.8, 0.3, p.y);
      alpha *= 1.0 - max(hole, rot);
      // frayed edge darkening
      float edge = smoothstep(0.12, 0.0, p.y - hem) + smoothstep(0.22, 0.12, v.x) * step(0.72, hash12(v.zw + uS)) * 0.6;
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
      vec3 walA = vec3(0.17, 0.09, 0.045), walB = vec3(0.08, 0.04, 0.02);
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
        // a carved rose in the left and right fields
        vec2 r = vec2(abs(c.x) - (hb + (uAspect2 * 0.5 - hb) * 0.5), c.y);
        float rr = length(r);
        vec2 pr = polarRep(r, 8.0);
        float petal = length(pr - vec2(0.09, 0.0)) - 0.05;
        float petal2 = length(polarRep(rot2(0.39) * r, 8.0) - vec2(0.05, 0.0)) - 0.03;
        float leafy = min(petal, petal2);
        float carve = smoothstep(0.004, -0.004, leafy) * step(rr, 0.2);
        col = mix(col, col * 1.35 + vec3(0.02, 0.01, 0.0), carve * 0.6);
        h += carve * 0.25 - smoothstep(0.004, -0.004, abs(leafy) - 0.003) * 0.15;
        col = mix(col, vec3(0.03, 0.02, 0.012), smoothstep(0.014, 0.0, rr) * 0.9);
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

/** Painted bisque doll face (canvas). Face centred at u = 0.25 (SphereGeometry +Z). */
export function dollFace(ctx, { seed = 0, cracked = false, eyes = '#3a5a8a', hair = '#4a2a14' } = {}) {
  return ctx.textures.canvas(`bedroom:doll${seed}${cracked ? 'c' : ''}`, 512, 256, (g, w, h) => {
    const rnd = (i) => { const x = Math.sin(i * 91.7 + seed * 47.3) * 43758.5453; return x - Math.floor(x); };
    g.fillStyle = '#e9dccb'; g.fillRect(0, 0, w, h);
    // subtle bisque mottling
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${150 + rnd(i) * 60},${120 + rnd(i + 1) * 40},${100},0.05)`; g.beginPath(); g.arc(rnd(i + 2) * w, rnd(i + 3) * h, 2 + rnd(i + 4) * 8, 0, 7); g.fill(); }
    const cx = w * 0.25, cy = h * 0.52;
    // hair cap (top + back)
    g.fillStyle = hair;
    g.fillRect(0, 0, w, h * 0.3);
    g.beginPath(); g.ellipse(cx, h * 0.28, w * 0.12, h * 0.07, 0, 0, Math.PI); g.fill();
    g.fillRect(w * 0.42, 0, w * 0.66, h * 0.62);
    for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(20,10,4,${0.2 + rnd(i) * 0.3})`; g.lineWidth = 1; g.beginPath(); const x = rnd(i + 9) * w; g.moveTo(x, 0); g.lineTo(x + (rnd(i) - 0.5) * 20, h * 0.3); g.stroke(); }
    // cheeks
    for (const s of [-1, 1]) {
      const gr = g.createRadialGradient(cx + s * 34, cy + 22, 2, cx + s * 34, cy + 22, 26);
      gr.addColorStop(0, 'rgba(210,90,90,0.55)'); gr.addColorStop(1, 'rgba(210,90,90,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx + s * 34, cy + 22, 26, 0, 7); g.fill();
    }
    // eyes: almond whites, irises, heavy upper lid line, lashes
    for (const s of [-1, 1]) {
      const ex = cx + s * 22, ey = cy - 2;
      g.fillStyle = '#f4f0e6'; g.beginPath(); g.ellipse(ex, ey, 11, 7, 0, 0, 7); g.fill();
      g.fillStyle = eyes; g.beginPath(); g.arc(ex + s * 0.5, ey + 0.5, 6, 0, 7); g.fill();
      g.fillStyle = '#080605'; g.beginPath(); g.arc(ex + s * 0.5, ey + 0.5, 2.8, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(ex - 2, ey - 2, 1.4, 0, 7); g.fill();
      g.strokeStyle = '#1a0f08'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(ex, ey + 1, 11.5, 7.5, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      for (let k = 0; k < 6; k++) { const a = Math.PI * (1.15 + k * 0.13); g.lineWidth = 1; g.beginPath(); g.moveTo(ex + Math.cos(a) * 11, ey + 1 + Math.sin(a) * 7.5); g.lineTo(ex + Math.cos(a) * 15, ey + 1 + Math.sin(a) * 11); g.stroke(); }
      // brows
      g.strokeStyle = 'rgba(70,40,20,0.8)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(ex - 10, ey - 13 + s * 0); g.quadraticCurveTo(ex, ey - 17, ex + 10, ey - 13); g.stroke();
    }
    // nose dots and rosebud mouth
    g.fillStyle = 'rgba(160,80,70,0.6)'; g.beginPath(); g.arc(cx - 2.5, cy + 15, 1.3, 0, 7); g.arc(cx + 2.5, cy + 15, 1.3, 0, 7); g.fill();
    g.fillStyle = '#9a2626'; g.beginPath(); g.moveTo(cx - 8, cy + 30); g.quadraticCurveTo(cx - 4, cy + 25, cx, cy + 28); g.quadraticCurveTo(cx + 4, cy + 25, cx + 8, cy + 30); g.quadraticCurveTo(cx, cy + 36, cx - 8, cy + 30); g.fill();
    g.fillStyle = '#3a0c0c'; g.fillRect(cx - 6, cy + 29.5, 12, 1.2);
    if (cracked) {
      g.strokeStyle = 'rgba(30,20,14,0.85)'; g.lineWidth = 1.4;
      let x = cx + 30, y = cy - 60; g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < 9; i++) { x += (rnd(i + 30) - 0.6) * 14; y += 9 + rnd(i + 40) * 6; g.lineTo(x, y); }
      g.stroke();
      g.beginPath(); g.moveTo(cx + 22, cy - 22); g.lineTo(cx + 34, cy - 8); g.lineTo(cx + 30, cy + 6); g.stroke();
      // chipped piece showing dark interior
      g.fillStyle = '#1a120c'; g.beginPath(); g.moveTo(cx + 28, cy - 38); g.lineTo(cx + 40, cy - 30); g.lineTo(cx + 33, cy - 22); g.closePath(); g.fill();
    }
    // grime
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(60,45,30,${0.03 + rnd(i + 70) * 0.05})`; g.beginPath(); g.arc(rnd(i + 80) * w, rnd(i + 90) * h, 6 + rnd(i + 100) * 20, 0, 7); g.fill(); }
  }, { tile: false });
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
