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
  return ctx.textures.generate('bedroom:sky2', {
    size: 1024, aspect: 0.8, tile: false,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv;
      vec2 moon = vec2(0.58, 0.78);
      float md = length((p - moon) * vec2(0.8, 1.0));
      float cl = fbm(p * vec2(2.2, 3.2) + vec2(0.35, 0.1), vec2(64.0), 6);
      float cl2 = fbm(p * vec2(5.0, 7.0) + 3.1, vec2(64.0), 5);
      vec3 sky = mix(vec3(0.02, 0.03, 0.07), vec3(0.08, 0.11, 0.22), smoothstep(0.2, 1.0, p.y));
      sky += vec3(0.5, 0.58, 0.8) * exp(-md * 7.0) * 0.4;
      float c = smoothstep(-0.1, 0.4, cl + cl2 * 0.35);
      sky = mix(sky, sky * 0.3 + vec3(0.015, 0.02, 0.035), c * 0.85);
      sky += vec3(0.75, 0.8, 0.95) * smoothstep(0.16, 0.0, abs(cl + cl2 * 0.35 - 0.05)) * exp(-md * 3.5) * 0.35;
      // the moon disk keeps an edge: limb-darkened, a few maria, no blow-out
      float disk = smoothstep(0.046, 0.042, md);
      float maria = fbm((p - moon) * 60.0, vec2(64.0), 4) * 0.5 + 0.5;
      vec3 moonC = vec3(0.95, 0.94, 0.88) * (0.78 + 0.22 * sqrt(max(0.0, 1.0 - md / 0.046))) * (0.82 + 0.18 * smoothstep(0.35, 0.7, maria));
      sky = mix(sky, moonC, disk * (1.0 - c * 0.6));
      // stars in the clear patches
      vec2 sg = floor(p * 260.0);
      float st = step(0.996, hash12(sg)) * (1.0 - c) * smoothstep(0.3, 0.8, p.y);
      sky += vec3(0.6, 0.7, 1.0) * st * 0.6;
      // dead oak: trunk + recursive-looking branches
      float tree = 1.0;
      float tx = 0.4 + 0.03 * sin(p.y * 7.0);
      tree = min(tree, abs(p.x - tx) - 0.03 * (1.15 - p.y));
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        vec2 o = vec2(tx, 0.36 + fi * 0.06);
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
      float hill = p.y - (0.28 + 0.05 * fbm(vec2(p.x * 3.0, 0.5), vec2(64.0), 4));
      // a distant gabled roofline of the east wing
      float roof = max(p.y - 0.36 - max(0.0, 0.08 - abs(p.x - 0.7) * 0.6), abs(p.x - 0.7) - 0.16);
      // ground mist rolling over the grounds below the hill line
      sky = mix(sky, vec3(0.1, 0.12, 0.18), smoothstep(0.42, 0.25, p.y) * 0.55 * (0.7 + 0.3 * (fbm(vec2(p.x * 4.0, p.y * 12.0), vec2(64.0), 4) * 0.5 + 0.5)));
      vec3 col = sky;
      float sil = smoothstep(0.003, -0.003, min(min(tree, hill), roof));
      col = mix(col, vec3(0.008, 0.01, 0.018), sil);
      // one lit window in the far wing
      float win = sdBox(p - vec2(0.74, 0.33), vec2(0.008, 0.014));
      col = mix(col, vec3(1.0, 0.62, 0.25) * 0.9, smoothstep(0.002, -0.002, win));
      s.albedo = col;
      s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
    }`,
  });
}

/**
 * Rotted velvet for the bed hangings. uv 0..1 over one panel (u across, v bottom->top).
 * Alpha (use alphaTest 0.5): the hem is torn off in tatters at uneven heights, long rips run up
 * from it, a few ragged diagonal slashes cut the body, and loose threads hang from every torn
 * edge. No round holes, no wood-like streaks: the nap is a soft isotropic pile with crushed patches.
 * Dust settles toward the top (lighter, greyer), grime and fraying darken the torn edges.
 */
export function tornDrape(ctx, { seed = 1, color = [0.3, 0.085, 0.09], valance = false } = {}) {
  return ctx.textures.generate(`bedroom:velvetDrape${seed}${valance ? 'v' : ''}`, {
    size: 1024, aspect: valance ? 3.0 : 0.5, tile: false, normalStrength: 1.1, seed,
    uniforms: { uCol: color, uS: seed * 7.13, uVal: valance ? 1 : 0 },
    glsl: /* glsl */ `
    float n01(vec2 p, float per, int o) { return fbm(p, vec2(per), o) * 0.5 + 0.5; }
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv;
      float xs = uVal > 0.5 ? 3.0 : 1.0;            // valance panels are wide: keep features metric
      vec2 m = vec2(p.x * xs, p.y);
      // ---- tattered hem: strips of random width torn off at different heights
      float sx = m.x * 5.0 + 0.8 * n01(vec2(m.x * 0.7, 0.2) + uS, 64.0, 3);
      float sid = floor(sx), sf = fract(sx);
      float hs = uVal > 0.5 ? (0.05 + 0.32 * pow(hash11(sid * 1.7 + uS), 2.0)) : (0.02 + 0.2 * pow(hash11(sid * 1.7 + uS), 2.2));
      // the tatter tapers toward a ragged point at its lower end
      hs += 0.06 * pow(abs(sf - 0.5) * 2.0, 2.0) * step(0.5, hash11(sid + 9.0 + uS));
      float rag = 0.025 * fbm(vec2(m.x * 30.0, uS), vec2(512.0), 4) + 0.01 * fbm(vec2(m.x * 140.0, uS * 2.0), vec2(2048.0), 3);
      float hem = hs + rag;
      float eHem = p.y - hem;                        // > 0 cloth above the torn hem
      // ---- rips running up from between the tatters
      float tl = min(sf, 1.0 - sf) / 5.0;            // distance (uv) to the strip boundary
      float ripLen = step(0.35, hash11(sid + 3.3 + uS)) * (0.12 + 0.45 * hash11(sid + 5.1 + uS)) * (uVal > 0.5 ? 1.6 : 1.0);
      float rt = clamp((p.y - hem) / max(ripLen, 1e-3), 0.0, 1.0);
      float ripW = (0.016 * (1.0 - rt) * (1.0 - rt) + 0.0015) * step(p.y, hem + ripLen);
      float eRip = tl + 0.004 * fbm(vec2(m.x * 60.0, p.y * 40.0) + uS, vec2(512.0), 3) - ripW;
      // ---- ragged slashes through the body (lens-shaped, wandering)
      float eSl = 1.0;
      if (uVal < 0.5) {
        for (int i = 0; i < 6; i++) {
          float fi = float(i) + uS;
          if (hash11(fi * 3.7) < 0.35) continue;
          vec2 c = vec2(0.15 + 0.7 * hash11(fi * 1.3), 0.2 + 0.6 * hash11(fi * 2.9));
          float ang = (hash11(fi * 5.1) - 0.5) * 0.9;
          float len = 0.06 + 0.12 * hash11(fi * 7.7);
          vec2 q = rot2(ang) * ((p - c) * vec2(2.0, 1.0));
          q.x += 0.012 * fbm(vec2(q.y * 25.0, fi), vec2(256.0), 3);
          float t = clamp(q.y / len, -1.0, 1.0);
          float w = (0.03 + 0.05 * hash11(fi * 9.3)) * (1.0 - t * t) * (0.75 + 0.5 * (fbm(vec2(q.y * 30.0, fi), vec2(256.0), 2) * 0.5 + 0.5));
          float d = max(abs(q.x) - w, abs(q.y) - len) * 0.5;
          eSl = min(eSl, d + 0.003 * fbm(p * 90.0 + fi, vec2(1024.0), 3));
        }
      }
      float edgeD = min(min(eHem, eRip), eSl);       // signed distance-ish to the nearest torn edge
      float alpha = step(0.0, edgeD);
      // ---- loose threads hanging below the torn hem (thin, uneven lengths)
      float tc = m.x * 420.0;
      float thr = step(fract(tc), 0.42) * step(0.35, hash11(floor(tc) + uS));
      float tlen = 0.035 * hash11(floor(tc) * 1.31 + uS) * (uVal > 0.5 ? 1.4 : 1.0);
      float hang = step(-tlen, eHem) * step(eHem, 0.0) * thr * step(0.0, eRip);
      alpha = max(alpha, hang);
      // ---- pile: soft isotropic nap + broad crushed patches (no directional streaks)
      float crush = n01(p * vec2(2.5 * xs, 4.0) + uS * 2.0, 32.0, 4);
      float nap = fbm(p * vec2(xs, 2.0) * 160.0, vec2(1024.0), 3);
      float fray = 1.0 - smoothstep(0.0, 0.03, edgeD);
      vec3 c = uCol * (0.72 + 0.45 * crush) * (0.95 + 0.05 * nap);
      // worn threads at the torn edges go pale and greyed; grime toward the hem
      float dl = dot(c, vec3(0.333));
      c = mix(c, vec3(dl) * 1.6 + vec3(0.03, 0.025, 0.02), fray * 0.55);
      c = mix(c, c * 0.55, smoothstep(0.35, 0.0, p.y) * 0.4);
      // dust: a grey film that thickens toward the top (and on the tatters' ends)
      float dust = smoothstep(0.35, 1.0, p.y) * 0.45 + 0.12 * n01(p * 9.0 + uS, 64.0, 4);
      c = mix(c, vec3(0.26, 0.24, 0.22), clamp(dust, 0.0, 0.6) * 0.55);
      // threads are lighter, fibrous
      c = mix(c, vec3(0.36, 0.3, 0.27), hang * step(edgeD, 0.0) * 0.6);
      s.albedo = c;
      s.alpha = alpha;
      s.height = 0.5 + 0.18 * crush + 0.04 * nap - fray * 0.12;
      s.rough = 0.9;
      s.metal = 0.0;
      s.ao = 1.0 - fray * 0.25;
    }`,
  });
}

/**
 * Faded Victorian counterpane: a wine-on-old-rose damask (motif read mostly by sheen and a faint
 * colour lift), shallow running-stitch quilting in a large diamond, foxing and tea-coloured stains.
 * 1 tile = 0.6 m. Very low relief: this is cloth, not upholstery.
 */
export function quilt(ctx) {
  return ctx.textures.generate('bedroom:counterpane', {
    size: 1024, tile: true, normalStrength: 0.9,
    glsl: /* glsl */ `
    float motif(vec2 p) {
      p.x = abs(p.x);
      float d = sdVesica(p - vec2(0.0, 0.02), 0.34, 0.31);
      d = min(d, sdVesica(rot2(-1.0) * (p - vec2(0.12, 0.05)), 0.17, 0.12));
      d = min(d, sdVesica(rot2(-0.4) * (p - vec2(0.21, 0.13)), 0.08, 0.05));
      d = min(d, abs(sdCircle(p - vec2(0.15, -0.16), 0.07)) - 0.012);
      d = min(d, sdCircle(p - vec2(0.0, 0.4), 0.03));
      vec2 q = p - vec2(0.0, -0.27);
      for (int i = 0; i < 5; i++) { vec2 r = rot2(-1.2 + float(i) * 0.6) * q; d = min(d, sdVesica(r - vec2(0.0, -0.07), 0.075, 0.06)); }
      return d;
    }
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv;
      float dA = motif((p - 0.5) * 1.25);
      float dB = motif((fract(p + 0.5) - 0.5) * 1.25);
      float mo = smoothstep(0.006, -0.006, min(dA, dB));
      // quilting: one big diamond per tile, a soft valley along each stitch line
      vec2 q = rot2(0.785398) * p * 1.41421 * 2.0;
      vec2 f = fract(q) - 0.5;
      float ld = min(abs(f.x), abs(f.y));
      float stitchV = smoothstep(0.12, 0.0, ld);
      float stitch = step(ld, 0.006) * step(0.5, fract((q.x + q.y) * 18.0));
      float weave = (sin(p.x * 2600.0) * sin(p.y * 2600.0)) * 0.5 + 0.5;
      vec3 ground = vec3(0.33, 0.13, 0.13);
      vec3 mcol = vec3(0.4, 0.2, 0.17);
      vec3 c = mix(ground, mcol, mo * 0.55);
      c *= 0.94 + 0.06 * weave;
      c *= 1.0 - stitchV * 0.12;
      c = mix(c, vec3(0.5, 0.42, 0.33), stitch * 0.5);
      // fading: patches bleached toward a dusty rose, tea stains with darker tide lines
      float fade = fbm(p * 1.0 + 3.0, vec2(1.0), 5) * 0.5 + 0.5;
      c = mix(c, c * 1.25 + vec3(0.05, 0.035, 0.03), smoothstep(0.5, 0.8, fade) * 0.6);
      float st = fbm(p * 1.7 + 8.0, vec2(1.7), 5) * 0.5 + 0.5;
      c = mix(c, c * vec3(0.72, 0.6, 0.45), smoothstep(0.62, 0.7, st) * 0.45);
      c = mix(c, c * 0.6, smoothstep(0.012, 0.0, abs(st - 0.62)) * 0.35);
      float fox = smoothstep(0.75, 0.82, fbm(p * 9.0 + 1.0, vec2(9.0), 4) * 0.5 + 0.5);
      c = mix(c, vec3(0.32, 0.22, 0.14), fox * 0.35);
      s.albedo = c;
      s.height = 0.5 - stitchV * 0.35 + mo * 0.04 + weave * 0.02;
      s.rough = 0.92 - mo * 0.16;
      s.metal = 0.0;
      s.ao = 1.0 - stitchV * 0.25;
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
  return ctx.textures.generate('bedroom:board2', {
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
        // carved border: brass stringing, then a relief band of acanthus scrolls cut into the
        // walnut (the ground sunk and dark, the leaves domed and catching the light), ebony line
        float t = (ax - field) / (hb - field);
        float alongC = abs(c.x) > abs(c.y) ? c.y : c.x;
        if (t < 0.07) { col = vec3(0.62, 0.45, 0.2); rough = 0.32; h = 0.62; }
        else if (t < 0.9) {
          float tt = (t - 0.07) / 0.83;                 // 0..1 across the band
          float P = 0.052;
          float a = alongC / P;
          float lx = (fract(a) - 0.5) * P, ly = (tt - 0.5) * (hb - field) * 0.83;
          float bw = (hb - field) * 0.83;
          float cellA = floor(a);
          float sgn = mod(cellA, 2.0) < 0.5 ? 1.0 : -1.0;
          // undulating stem (thin) carrying big lobed acanthus leaves and spiral curls
          float stemY = 0.22 * bw * sin(a * 3.14159);
          float stem = abs(ly - stemY) - 0.035 * bw;
          // spiral curl in each half-wave, alternating up and down
          vec2 sc = vec2(lx - 0.12 * P, ly - sgn * 0.16 * bw);
          float ca = atan(sc.y, sc.x * sgn);
          float sr = 0.06 * bw + 0.045 * bw * (ca + 3.14159) / 6.2832;
          float curl = abs(length(sc) - sr) - 0.03 * bw;
          curl = max(curl, length(sc) - 0.17 * bw);
          float lf = 1e3;
          for (int k = 0; k < 4; k++) {
            float ang = (float(k) - 1.5) * 0.55 + sgn * 0.35;
            vec2 q = rot2(ang) * (vec2(lx + 0.15 * P, ly) - vec2(0.0, stemY));
            lf = min(lf, sdVesica(q - vec2(0.0, -sgn * 0.2 * bw), 0.3 * bw, 0.2 * bw));
          }
          lf += 0.006 * bw / 0.05 * abs(sin(atan(ly - stemY, lx) * 9.0));   // serrated, lobed edges
          float shape = min(min(stem, curl), lf);
          float relief = domeh(shape, 0.12 * bw);
          float carved = smoothstep(0.002, -0.002, shape);
          vec3 lit = mix(walA * 1.15, vec3(0.38, 0.23, 0.12), 0.4);
          col = mix(walB * 0.45, lit, carved);
          // veins cut into the leaves
          col *= 1.0 - smoothstep(0.003, 0.0, abs(shape + 0.03 * bw)) * carved * 0.35;
          h = 0.25 + 0.55 * relief;
          rough = mix(0.65, 0.42, carved);
        } else { col = vec3(0.02, 0.015, 0.012); rough = 0.28; h = 0.5; }
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

/**
 * Silvered glass for the broken dressing-table mirror. uv 0..1 over the glass (aspect w/h).
 * The big radial fractures are real geometry (separate tilted shards, see buildVanity); this map
 * adds what lies inside them: a crushed impact star, short branching cracks, two broken concentric
 * rings, and desilvering (dark foxing blotches creeping in from the edges).
 * glint = true returns a mask of the thin bright crack edges (use it as an emissiveMap / sparkle).
 * angles: up to 6 radial crack angles (radians) so the grooves line up with the shard edges.
 */
export function crackedMirror(ctx, { aspect = 0.7, impact = [0.62, 0.58], angles = [0, 1, 2, 3, 4, 5], glint = false } = {}) {
  const a = angles.concat([9, 9, 9, 9, 9, 9]).slice(0, 6);
  return ctx.textures.generate(`bedroom:mirror2${glint ? 'G' : ''}`, {
    size: 1024, aspect, tile: false, normalStrength: 2.0,
    uniforms: { uImp: impact, uAsp: aspect, uA0: a.slice(0, 3), uA1: a.slice(3, 6), uGlint: glint ? 1 : 0 },
    glsl: /* glsl */ `
    float lineD(vec2 p, float ang, float wob, float seed) {
      vec2 d = vec2(cos(ang), sin(ang));
      float along = dot(p, d);
      float across = dot(p, vec2(-d.y, d.x));
      across += wob * fbm(vec2(along * 6.0, seed), vec2(64.0), 3) * smoothstep(0.0, 0.15, along);
      return along < 0.0 ? 1.0 : abs(across);
    }
    void surface(vec2 uv, inout Surface s) {
      vec2 p = (uv - uImp) * vec2(uAsp, 1.0);
      float r = length(p);
      float ang = atan(p.y, p.x);
      float A[6]; A[0] = uA0.x; A[1] = uA0.y; A[2] = uA0.z; A[3] = uA1.x; A[4] = uA1.y; A[5] = uA1.z;
      float crack = 1.0;
      // main radials (straight, they coincide with the shard seams)
      for (int i = 0; i < 6; i++) { if (A[i] > 8.0) continue; crack = min(crack, lineD(p, A[i], 0.0, float(i))); }
      // secondary cracks: branch off the radials and wander, dying out with distance
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        float a0 = A[int(mod(fi, 6.0))] + (hash11(fi * 3.1) - 0.5) * 0.9;
        vec2 o = vec2(cos(a0), sin(a0)) * (0.03 + 0.12 * hash11(fi * 7.3));
        float len = 0.05 + 0.18 * hash11(fi * 1.9);
        float dd = lineD(p - o, a0 + (hash11(fi * 5.7) - 0.5) * 1.2, 0.03, fi + 10.0);
        float along = length(p - o);
        crack = min(crack, dd + step(len, along) * 1.0 + along * 0.004);
      }
      // two broken concentric rings
      float ring = 1.0;
      for (int k = 0; k < 2; k++) {
        float rr = k == 0 ? 0.075 : 0.16;
        float wob = 0.012 * fbm(vec2(ang * 3.0, float(k) * 7.0), vec2(64.0), 3);
        float rd = abs(r - rr - wob);
        // rings are broken into arcs
        float on = step(0.35, fbm(vec2(ang * 2.0 + float(k) * 4.0, 1.0), vec2(64.0), 2) * 0.5 + 0.5);
        ring = min(ring, rd + (1.0 - on));
      }
      crack = min(crack, ring);
      // impact star: dense short spokes + crushed glass at the centre
      float starA = fract(ang / 6.2832 * 23.0 + 0.3 * fbm(vec2(r * 30.0, 0.0), vec2(64.0), 2));
      float star = min(starA, 1.0 - starA) * r * 6.2832 / 23.0 + step(0.045 + 0.02 * hash11(floor(ang / 6.2832 * 23.0)), r);
      crack = min(crack, star);
      float crushed = smoothstep(0.022, 0.0, r + 0.006 * fbm(p * 200.0, vec2(256.0), 3));
      float line = smoothstep(0.0022, 0.0004, crack);
      float halo = smoothstep(0.008, 0.0, crack);
      // desilvering: dark blotches eating in from the frame, a few freckles of foxing
      vec2 e = min(uv, 1.0 - uv) * vec2(uAsp, 1.0);
      float edge = min(e.x, e.y);
      float fn = fbm(uv * 5.0, vec2(64.0), 5);
      float desil = smoothstep(0.1, 0.0, edge + fn * 0.06 - 0.01);
      float blot = smoothstep(0.62, 0.72, fbm(uv * 7.0 + 3.0, vec2(64.0), 5) * 0.5 + 0.5) * smoothstep(0.25, 0.05, edge);
      float fox = smoothstep(0.86, 0.9, fbm(uv * 30.0 + 5.0, vec2(256.0), 3) * 0.5 + 0.5);
      float bad = clamp(max(max(desil, blot), fox * 0.7), 0.0, 1.0);
      vec3 silver = vec3(0.78, 0.78, 0.76);
      vec3 col = mix(silver, vec3(0.03, 0.026, 0.022), bad);
      col *= 1.0 - halo * 0.25;
      col = mix(col, vec3(0.6, 0.6, 0.58), line * 0.4);
      col = mix(col, vec3(0.35), crushed);
      if (uGlint > 0.5) { col = vec3(line * (1.0 - bad) * (0.6 + 0.4 * hash12(floor(p * 300.0)))) + vec3(crushed * 0.25); }
      s.albedo = col;
      s.metal = 1.0 - bad;
      s.rough = 0.035 + halo * 0.25 + crushed * 0.5 + bad * 0.55;
      s.height = 0.5 - line * 0.25 - halo * 0.08 - crushed * 0.2 + bad * 0.04;
      s.ao = 1.0 - halo * 0.3;
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
  return ctx.textures.canvas(`bedroom:doll3_${seed}${cracked ? 'c' : ''}`, 1024, 512, (g, w, h) => {
    const rnd = (i) => { const x = Math.sin(i * 91.7 + seed * 47.3) * 43758.5453; return x - Math.floor(x); };
    // bisque ground: warm ivory with a cooler, slightly grey shading toward the back
    const base = g.createLinearGradient(0, 0, w, 0);
    base.addColorStop(0, '#d9cdbd'); base.addColorStop(0.25, '#efe4d4'); base.addColorStop(0.5, '#d6c9b8'); base.addColorStop(1, '#d9cdbd');
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { const x = rnd(i + 2) * w, y = rnd(i + 3) * h, r = 3 + rnd(i + 4) * 14; const gg = g.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, `rgba(${150 + rnd(i) * 60},${120 + rnd(i + 1) * 40},100,0.06)`); gg.addColorStop(1, 'rgba(150,120,100,0)'); g.fillStyle = gg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    const cx = w * 0.25, cy = h * 0.52;
    const S = 2.0;      // feature scale (px per old px)
    // hair line (the hair cap covers the rest)
    g.fillStyle = hair; g.fillRect(0, 0, w, h * 0.2);
    // cheeks: strong, rouged blush that reads from across the room
    for (const sd of [-1, 1]) {
      const x = cx + sd * 40 * S, y = cy + 26 * S;
      const ox = x + (rnd(sd + 9) - 0.5) * 10 * S;
      const gr = g.createRadialGradient(ox, y, 2, ox, y, 30 * S);
      const fa = 0.18 + rnd(sd + 5) * 0.2;   // the rouge has faded unevenly
      gr.addColorStop(0, `rgba(190,96,92,${fa})`); gr.addColorStop(0.6, `rgba(190,104,100,${fa * 0.4})`); gr.addColorStop(1, 'rgba(190,104,100,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(ox, y, 30 * S, 0, 7); g.fill();
    }
    // chin + nose-tip blush
    for (const [x, y, r, a] of [[cx, cy + 48 * S, 14 * S, 0.12], [cx, cy + 16 * S, 8 * S, 0.1]]) {
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
      // small, deep-set painted eye under a heavy lid (the glass eyeball sits in the socket)
      g.fillStyle = '#d8d0c2'; g.beginPath(); g.ellipse(ex, ey + 1 * S, 10 * S, 5.5 * S, 0, 0, 7); g.fill();
      g.fillStyle = eyes; g.beginPath(); g.arc(ex, ey + 1.6 * S, 5 * S, 0, 7); g.fill();
      g.fillStyle = '#050403'; g.beginPath(); g.arc(ex, ey + 1.6 * S, 2.4 * S, 0, 7); g.fill();
      // heavy upper lid: a painted crease and a dark lash line that cuts the top of the iris
      g.fillStyle = 'rgba(150,110,96,0.55)'; g.beginPath(); g.ellipse(ex, ey - 2.5 * S, 12 * S, 6 * S, 0, Math.PI, 0); g.fill();
      g.strokeStyle = '#1a0f08'; g.lineWidth = 2.6 * S; g.beginPath(); g.ellipse(ex, ey + 1 * S, 10.5 * S, 5.5 * S, 0, Math.PI * 1.02, Math.PI * 1.98); g.stroke();
      g.strokeStyle = 'rgba(90,60,45,0.6)'; g.lineWidth = 1.0 * S; g.beginPath(); g.ellipse(ex, ey - 3.5 * S, 12 * S, 6 * S, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.lineWidth = 0.9 * S; g.strokeStyle = '#1a0f08';
      for (let k = 0; k < 8; k++) { const a = Math.PI * (1.12 + k * 0.11); g.beginPath(); g.moveTo(ex + Math.cos(a) * 10 * S, ey + 1 * S + Math.sin(a) * 5.5 * S); g.lineTo(ex + Math.cos(a) * 13 * S, ey + 1 * S + Math.sin(a) * 9 * S); g.stroke(); }
      // feathered brows, high and thin (surprised)
      g.strokeStyle = 'rgba(90,60,36,0.45)'; g.lineWidth = 0.7 * S;
      for (let k = 0; k < 10; k++) { const t = k / 9; const bx = ex - 15 * S + t * 30 * S; const by = ey - 22 * S - Math.sin(t * Math.PI) * 6 * S; g.beginPath(); g.moveTo(bx, by + 2 * S); g.lineTo(bx + 4 * S, by - 1 * S); g.stroke(); }
    }
    // nostril dots and a tiny rosebud mouth, parted to show two painted teeth
    g.fillStyle = 'rgba(150,70,60,0.75)'; g.beginPath(); g.arc(cx - 3.5 * S, cy + 19 * S, 1.8 * S, 0, 7); g.arc(cx + 3.5 * S, cy + 19 * S, 1.8 * S, 0, 7); g.fill();
    g.fillStyle = '#7a4a44'; g.beginPath(); g.moveTo(cx - 11 * S, cy + 35 * S); g.quadraticCurveTo(cx - 5 * S, cy + 28 * S, cx, cy + 32 * S); g.quadraticCurveTo(cx + 5 * S, cy + 28 * S, cx + 11 * S, cy + 35 * S); g.quadraticCurveTo(cx, cy + 43 * S, cx - 11 * S, cy + 35 * S); g.fill();
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
    for (let i = 0; i < 90; i++) {
      const x = rnd(i + 80) * w, y = rnd(i + 90) * h, r = 8 + rnd(i + 100) * 30;
      const gg = g.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, `rgba(60,45,30,${0.04 + rnd(i + 70) * 0.08})`); gg.addColorStop(1, 'rgba(60,45,30,0)');
      g.fillStyle = gg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
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

/**
 * Over-mantel portrait (canvas, 1024 x 1320): a gentleman in a black frock coat and white stock,
 * lit Rembrandt-fashion from the upper left out of a brown-black varnish ground. The face is built
 * from layered glazes (light, half-tone, reflected light, cast shadow) and then the whole canvas is
 * re-laid in ~40k directional brush strokes sampled from itself, so it reads as oil paint, not as a
 * gradient. The eye whites are painted; the irises are added by the material at render time so the
 * eyes follow the viewer (see EYES). Yellowed varnish and craquelure over everything.
 */
export const PORTRAIT_EYES = [[(512 - 58) / 1024, 1 - (0.34 * 1320 - 12) / 1320], [(512 + 58) / 1024, 1 - (0.34 * 1320 - 12) / 1320]];
export function fatherPortrait(ctx) {
  return ctx.textures.canvas('bedroom:father2', 1024, 1320, (g, w, h) => {
    const rnd = (i) => { const x = Math.sin(i * 51.37 + 7.1) * 43758.5453; return x - Math.floor(x); };
    const blob = (x, y, rx, ry, col, rot = 0) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); g.fill(); };
    const glow = (x, y, r, c0, c1 = 'rgba(0,0,0,0)', sx = 1, sy = 1) => {
      g.save(); g.translate(x, y); g.scale(sx, sy);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.restore();
    };
    // ground: warm umber, lighter behind the head (old-master halo)
    const bg = g.createRadialGradient(w * 0.42, h * 0.3, 40, w * 0.5, h * 0.42, h * 0.75);
    bg.addColorStop(0, '#4e3c28'); bg.addColorStop(0.4, '#261c13'); bg.addColorStop(1, '#0a0806');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) glow(rnd(i + 2) * w, rnd(i + 3) * h, 20 + rnd(i + 4) * 80, `rgba(${50 + rnd(i) * 40},${36 + rnd(i + 1) * 25},20,0.06)`);
    const cx = w * 0.5, hy = h * 0.34;
    // coat
    g.fillStyle = '#0c0a09';
    g.beginPath(); g.moveTo(cx - 480, h); g.bezierCurveTo(cx - 440, h * 0.66, cx - 270, h * 0.56, cx - 120, h * 0.52); g.lineTo(cx + 120, h * 0.52);
    g.bezierCurveTo(cx + 260, h * 0.56, cx + 430, h * 0.66, cx + 470, h); g.closePath(); g.fill();
    glow(cx - 260, h * 0.68, 220, 'rgba(60,52,46,0.35)', 'rgba(0,0,0,0)', 1, 1.4);       // light on the left shoulder
    g.fillStyle = '#1b1816';
    g.beginPath(); g.moveTo(cx - 110, h * 0.53); g.lineTo(cx - 205, h * 0.76); g.lineTo(cx - 60, h * 0.96); g.lineTo(cx - 30, h * 0.62); g.closePath(); g.fill();
    g.fillStyle = '#121010';
    g.beginPath(); g.moveTo(cx + 110, h * 0.53); g.lineTo(cx + 200, h * 0.75); g.lineTo(cx + 60, h * 0.95); g.lineTo(cx + 30, h * 0.62); g.closePath(); g.fill();
    // stock + shirt, the light falling across from the left
    const st = g.createLinearGradient(cx - 100, 0, cx + 100, 0); st.addColorStop(0, '#d8cfbd'); st.addColorStop(0.45, '#c4baa6'); st.addColorStop(1, '#5e574c');
    g.fillStyle = st; g.beginPath(); g.moveTo(cx - 98, h * 0.5); g.quadraticCurveTo(cx, h * 0.565, cx + 95, h * 0.5); g.lineTo(cx + 40, h * 0.7); g.lineTo(cx, h * 0.77); g.lineTo(cx - 42, h * 0.7); g.closePath(); g.fill();
    for (let k = 0; k < 7; k++) { g.strokeStyle = `rgba(70,62,52,${0.25 + rnd(k) * 0.2})`; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 60 + k * 18, h * 0.53); g.quadraticCurveTo(cx - 40 + k * 14, h * 0.62, cx - 30 + k * 10, h * 0.7); g.stroke(); }
    g.fillStyle = '#0a0808'; g.beginPath(); g.moveTo(cx - 32, h * 0.532); g.lineTo(cx + 30, h * 0.532); g.lineTo(cx + 12, h * 0.6); g.lineTo(cx - 12, h * 0.6); g.closePath(); g.fill();
    // neck in shadow under the jaw
    g.fillStyle = '#6a4c3a'; g.fillRect(cx - 62, hy + 150, 124, 110);
    glow(cx + 30, hy + 175, 90, 'rgba(30,18,12,0.8)', 'rgba(30,18,12,0)', 1.2, 0.6);
    // ---- head: base half-tone, then light, then shadow
    blob(cx, hy + 10, 150, 200, '#9c7258');
    glow(cx - 70, hy - 30, 210, 'rgba(232,200,168,0.95)', 'rgba(232,200,168,0)', 0.9, 1.1);   // light side
    glow(cx + 120, hy + 40, 170, 'rgba(48,30,22,0.92)', 'rgba(48,30,22,0)', 0.7, 1.2);         // shadow side
    glow(cx + 135, hy + 60, 50, 'rgba(120,88,72,0.5)', 'rgba(120,88,72,0)', 0.6, 1.6);          // reflected light on the far cheek
    glow(cx - 75, hy + 30, 55, 'rgba(240,206,176,0.6)');                                       // cheekbone
    glow(cx - 40, hy - 115, 80, 'rgba(240,214,186,0.55)', 'rgba(0,0,0,0)', 1.4, 0.6);          // forehead highlight
    glow(cx - 60, hy + 115, 50, 'rgba(150,96,80,0.35)');                                        // ruddy jaw
    glow(cx + 10, hy + 165, 60, 'rgba(70,42,30,0.6)', 'rgba(0,0,0,0)', 1.4, 0.7);              // under-chin shadow
    // ears
    blob(cx - 150, hy + 30, 22, 46, '#a07a5e', 0.1); blob(cx - 150, hy + 30, 10, 28, '#6a4a38', 0.1);
    blob(cx + 150, hy + 30, 20, 44, '#3e2a20', -0.1);
    // eye sockets (deep, the far one in full shadow)
    for (const sd of [-1, 1]) glow(cx + sd * 58, hy - 12, 50, sd < 0 ? 'rgba(90,58,44,0.7)' : 'rgba(40,24,18,0.85)', 'rgba(0,0,0,0)', 1.2, 0.85);
    // brows
    g.lineCap = 'round';
    for (const sd of [-1, 1]) { for (let k = 0; k < 18; k++) { g.strokeStyle = `rgba(30,20,14,${0.35 + rnd(k + sd * 9) * 0.3})`; g.lineWidth = 4 + rnd(k) * 4; const t = k / 17; g.beginPath(); g.moveTo(cx + sd * (24 + t * 70), hy - 48 - Math.sin(t * 3.1) * 12 + rnd(k) * 4); g.lineTo(cx + sd * (34 + t * 70), hy - 54 - Math.sin(t * 3.1) * 12); g.stroke(); } }
    // nose: lit bridge, shadow plane on the right, nostrils, tip highlight, cast shadow
    g.fillStyle = 'rgba(70,42,30,0.55)'; g.beginPath(); g.moveTo(cx + 8, hy - 15); g.quadraticCurveTo(cx + 34, hy + 60, cx + 30, hy + 92); g.lineTo(cx + 4, hy + 94); g.closePath(); g.fill();
    glow(cx - 6, hy + 30, 16, 'rgba(246,220,192,0.55)', 'rgba(0,0,0,0)', 0.5, 3.2);
    glow(cx - 2, hy + 80, 16, 'rgba(246,220,192,0.6)');
    blob(cx - 16, hy + 96, 8, 5, 'rgba(50,26,20,0.8)'); blob(cx + 18, hy + 96, 8, 5, 'rgba(30,16,12,0.85)');
    glow(cx + 40, hy + 108, 40, 'rgba(50,30,20,0.55)', 'rgba(0,0,0,0)', 1.4, 0.6);
    // mouth: shadowed upper lip, line, lit lower lip; deep naso-labial folds
    g.fillStyle = 'rgba(96,52,40,0.8)'; g.beginPath(); g.moveTo(cx - 46, hy + 128); g.quadraticCurveTo(cx, hy + 118, cx + 44, hy + 126); g.quadraticCurveTo(cx, hy + 132, cx - 46, hy + 128); g.fill();
    g.strokeStyle = '#3a1e16'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 46, hy + 129); g.quadraticCurveTo(cx, hy + 135, cx + 44, hy + 127); g.stroke();
    glow(cx - 8, hy + 142, 30, 'rgba(200,140,120,0.45)', 'rgba(0,0,0,0)', 1.4, 0.5);
    for (const sd of [-1, 1]) { g.strokeStyle = sd < 0 ? 'rgba(110,70,52,0.5)' : 'rgba(40,24,18,0.6)'; g.lineWidth = 7; g.beginPath(); g.moveTo(cx + sd * 34, hy + 84); g.quadraticCurveTo(cx + sd * 62, hy + 112, cx + sd * 58, hy + 150); g.stroke(); }
    // hair: dark, oiled, receding; grey side-whiskers laid in as strands
    g.fillStyle = '#140e0a';
    g.beginPath(); g.ellipse(cx, hy - 128, 162, 100, 0, Math.PI, 0); g.fill();
    g.beginPath(); g.moveTo(cx - 162, hy - 128); g.quadraticCurveTo(cx - 176, hy - 20, cx - 142, hy + 60); g.lineTo(cx - 122, hy - 60); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx + 162, hy - 128); g.quadraticCurveTo(cx + 176, hy - 20, cx + 142, hy + 60); g.lineTo(cx + 122, hy - 60); g.closePath(); g.fill();
    for (let k = 0; k < 160; k++) { const sd = k % 2 ? 1 : -1; const y0 = hy - 40 + rnd(k) * 200; g.strokeStyle = `rgba(${110 + rnd(k + 1) * 60},${104 + rnd(k + 1) * 50},${96 + rnd(k + 1) * 40},${sd < 0 ? 0.35 : 0.15})`; g.lineWidth = 2 + rnd(k + 2) * 2; g.beginPath(); g.moveTo(cx + sd * (140 - (y0 - hy) * 0.2), y0); g.quadraticCurveTo(cx + sd * (148 - (y0 - hy) * 0.25), y0 + 20, cx + sd * (132 - (y0 - hy) * 0.28), y0 + 40); g.stroke(); }
    for (let k = 0; k < 90; k++) { g.strokeStyle = `rgba(80,60,44,${0.15 + rnd(k + 5) * 0.15})`; g.lineWidth = 2; const x0 = cx - 140 + rnd(k + 7) * 280; g.beginPath(); g.moveTo(x0, hy - 200 + rnd(k) * 20); g.quadraticCurveTo(x0 + 30, hy - 170, x0 + 50, hy - 150 + rnd(k + 3) * 30); g.stroke(); }
    // ---- re-lay the canvas in directional brush strokes sampled from itself
    {
      const src = g.getImageData(0, 0, w, h).data;
      const at = (x, y) => { const i = ((Math.min(h - 1, Math.max(0, y | 0)) * w) + Math.min(w - 1, Math.max(0, x | 0))) * 4; return [src[i], src[i + 1], src[i + 2]]; };
      for (let i = 0; i < 42000; i++) {
        const x = rnd(i * 2 + 101) * w, y = rnd(i * 2 + 102) * h;
        const [r, gg, b] = at(x, y);
        const inFace = Math.hypot((x - cx) / 170, (y - hy) / 220) < 1;
        // strokes follow the form: around the head they curve with it, elsewhere a loose diagonal
        const ang = inFace ? Math.atan2(y - hy, x - cx) + Math.PI / 2 + (rnd(i + 7) - 0.5) * 0.5 : 0.7 + Math.sin(x * 0.01 + y * 0.013) * 0.6 + (rnd(i + 7) - 0.5) * 0.4;
        const len = inFace ? 5 + rnd(i + 3) * 8 : 10 + rnd(i + 3) * 26, wd = inFace ? 1.6 + rnd(i + 4) * 2 : 2.5 + rnd(i + 4) * 4;
        const j = (rnd(i + 5) - 0.5) * 14;
        g.fillStyle = `rgba(${r + j},${gg + j * 0.9},${b + j * 0.7},${inFace ? 0.55 : 0.4})`;
        g.beginPath(); g.ellipse(x, y, len, wd, ang, 0, 7); g.fill();
      }
      // impasto: a few thick strokes of light on the forehead, nose and collar
      for (let i = 0; i < 260; i++) {
        const k = rnd(i + 900); const [x, y] = k < 0.4 ? [cx - 90 + rnd(i + 901) * 110, hy - 150 + rnd(i + 902) * 70] : k < 0.6 ? [cx - 12 + rnd(i + 901) * 12, hy + rnd(i + 902) * 90] : [cx - 90 + rnd(i + 901) * 110, h * 0.5 + rnd(i + 902) * 60];
        const [r, gg, b] = at(x, y);
        g.fillStyle = `rgba(${Math.min(255, r + 18)},${Math.min(255, gg + 14)},${Math.min(255, b + 8)},0.5)`;
        g.beginPath(); g.ellipse(x, y, 7 + rnd(i) * 8, 2 + rnd(i + 1) * 2, -0.4 + rnd(i + 2) * 0.8, 0, 7); g.fill();
      }
    }
    // ---- eye whites (almond, aged ivory, darker under the lids); irises are added in the shader
    for (const [k, [u, v]] of PORTRAIT_EYES.entries()) {
      const ex = u * w, ey = (1 - v) * h, sd = k ? 1 : -1;
      g.save(); g.beginPath(); g.ellipse(ex, ey, 27, 12, 0, 0, 7); g.clip();
      const wg = g.createLinearGradient(ex, ey - 12, ex, ey + 12); wg.addColorStop(0, sd < 0 ? '#6e5e4c' : '#3a3026'); wg.addColorStop(0.5, sd < 0 ? '#c4b49a' : '#6a5c4a'); wg.addColorStop(1, sd < 0 ? '#a8987e' : '#4a3e32');
      g.fillStyle = wg; g.fillRect(ex - 30, ey - 14, 60, 28); g.restore();
      g.strokeStyle = 'rgba(30,16,10,0.9)'; g.lineWidth = 5; g.beginPath(); g.ellipse(ex, ey + 1, 28, 13, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      g.strokeStyle = 'rgba(60,34,24,0.6)'; g.lineWidth = 3; g.beginPath(); g.ellipse(ex, ey - 7, 30, 14, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.strokeStyle = 'rgba(80,50,38,0.5)'; g.lineWidth = 2; g.beginPath(); g.ellipse(ex, ey + 2, 26, 12, 0, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
    }
    // varnish: yellowed, darker toward the edges
    g.fillStyle = 'rgba(120,90,30,0.18)'; g.fillRect(0, 0, w, h);
    const vg = g.createRadialGradient(cx, h * 0.4, h * 0.22, cx, h * 0.5, h * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    // craquelure network
    g.strokeStyle = 'rgba(10,6,4,0.4)'; g.lineWidth = 1.1;
    for (let i = 0; i < 700; i++) {
      let x = rnd(i * 3) * w, y = rnd(i * 3 + 1) * h; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rnd(i * 7 + k) - 0.5) * 50; y += (rnd(i * 11 + k) - 0.5) * 50; g.lineTo(x, y); }
      g.stroke();
    }
  }, { tile: false });
}

/** Craquelure height for the portrait varnish (normal map; tiles once over the canvas). */
export function craquelure(ctx) {
  return ctx.textures.generate('bedroom:craq', {
    size: 1024, tile: true, normalStrength: 1.5,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float e = voronoiEdge(uv * vec2(28.0, 36.0), vec2(28.0, 36.0), 1.0);
      float e2 = voronoiEdge(uv * vec2(70.0, 90.0) + 2.0, vec2(70.0, 90.0), 1.0);
      float cr = smoothstep(0.04, 0.0, e) + smoothstep(0.03, 0.0, e2) * 0.5;
      float brush = fbm(uv * vec2(60.0, 20.0), vec2(60.0, 20.0), 3) * 0.5 + 0.5;
      s.albedo = vec3(1.0); s.height = 0.5 - cr * 0.3 + brush * 0.12; s.rough = 0.3 + cr * 0.4; s.metal = 0.0; s.ao = 1.0;
    }`,
  });
}

/**
 * Worn Persian (Heriz/Tabriz-style) carpet, 3.0 x 4.0 m, uv 0..1 over the whole rug
 * (u across the 3 m width, v along the 4 m length). A dense medallion-and-corner field on madder
 * red, an all-over herati lattice, and six nested borders (guards, a main indigo border with a
 * rosette-and-vine cartouche run). The pattern is quantised to the knot grid and dyed in uneven
 * lots (abrash). Wear: a threadbare walking path and a worn centre where the pile is gone and the
 * beige warp/weft shows through (flatter, smoother), plus two old stains.
 */
export function persianRug(ctx) {
  return ctx.textures.generate('bedroom:persian2', {
    size: 2048, aspect: 0.75, tile: false, normalStrength: 1.4,
    glsl: /* glsl */ `
    const vec3 RED = vec3(0.43, 0.12, 0.085);
    const vec3 RED2 = vec3(0.34, 0.09, 0.07);
    const vec3 IND = vec3(0.11, 0.14, 0.25);
    const vec3 NAVY = vec3(0.045, 0.05, 0.085);
    const vec3 OCH = vec3(0.6, 0.44, 0.2);
    const vec3 IVO = vec3(0.7, 0.62, 0.48);
    const vec3 TEAL = vec3(0.2, 0.29, 0.26);
    const vec3 ROSE = vec3(0.56, 0.3, 0.24);
    float sdLoz(vec2 p, vec2 b) { p = abs(p); return (p.x / b.x + p.y / b.y - 1.0) * min(b.x, b.y) * 0.7; }
    // small flower: 6-8 petals + eye
    float flower(vec2 p, float r, float n) { float a = atan(p.y, p.x); float rr = r * (0.65 + 0.35 * abs(cos(a * n * 0.5))); return length(p) - rr; }
    vec3 herati(vec2 c) {
      // all-over herati: a rosette in a lozenge framed by four curling lancet leaves, on a lattice of
      // indigo vines; alternate cells are dyed a shade darker so the field reads dense, not dotted
      vec2 q = c / vec2(0.115, 0.115);
      vec2 id = floor(q); vec2 f = fract(q) - 0.5;
      vec3 col = mod(id.x + id.y, 2.0) < 0.5 ? RED : RED2 * 1.1;
      float lat = abs(abs(f.x) + abs(f.y) - 0.5);
      col = mix(col, IND, smoothstep(0.06, 0.035, lat));
      col = mix(col, OCH * 0.8, smoothstep(0.018, 0.006, lat));
      float loz = abs(f.x) + abs(f.y);
      col = mix(col, NAVY * 1.4, smoothstep(0.24, 0.22, loz) * (1.0 - smoothstep(0.2, 0.18, loz)));
      float fl = flower(f, 0.15, 8.0);
      col = mix(col, IVO, smoothstep(0.012, -0.012, fl));
      col = mix(col, ROSE, smoothstep(0.012, -0.012, flower(f, 0.085, 6.0)));
      col = mix(col, NAVY, smoothstep(0.01, -0.01, length(f) - 0.03));
      for (int k = 0; k < 4; k++) {
        float a = 0.785398 + float(k) * 1.570796;
        vec2 r = rot2(-a) * f;
        r.y += 0.05 * sin(r.x * 12.0);
        float lf = sdVesica(vec2(r.y, r.x - 0.33), 0.15, 0.1);
        col = mix(col, mod(float(k) + id.x, 2.0) < 0.5 ? TEAL : OCH * 0.85, smoothstep(0.012, -0.012, lf));
        col = mix(col, NAVY, smoothstep(0.008, 0.0, abs(lf + 0.02)) * 0.6);
      }
      // small blossoms where the lattice crosses
      vec2 fc = f - sign(f) * 0.5 * vec2(1.0, 0.0);
      col = mix(col, IVO * 0.9, smoothstep(0.012, -0.012, flower(abs(f) - vec2(0.5, 0.0), 0.07, 6.0)));
      col = mix(col, ROSE * 0.9, smoothstep(0.012, -0.012, flower(abs(f) - vec2(0.0, 0.5), 0.07, 6.0)));
      return col;
    }
    vec3 medallion(vec2 c, vec3 col) {
      float a = atan(c.y, c.x);
      float scal = 0.025 * cos(a * 18.0);
      float md = abs(c.x) / 0.6 + abs(c.y) / 0.98;
      float e = md + scal;
      if (e < 1.0) {
        col = IND;
        // inner pattern of the medallion: a smaller herati in ivory/rose on indigo
        vec2 f = fract(c / 0.07) - 0.5;
        float fl = flower(f, 0.16, 6.0);
        col = mix(col, ROSE, smoothstep(0.01, -0.01, fl) * 0.85);
        col = mix(col, IVO, smoothstep(0.02, 0.0, abs(abs(f.x) + abs(f.y) - 0.5)) * 0.4);
        col = mix(col, IVO, smoothstep(0.02, 0.0, abs(e - 0.93)));
        if (e < 0.7) {
          col = RED;
          float s8 = sdStar(c, 0.2, 8.0, 3.0);
          col = mix(col, IVO, smoothstep(0.012, 0.0, abs(e - 0.66)));
          vec2 g = fract(c / 0.06) - 0.5;
          col = mix(col, NAVY, smoothstep(0.02, 0.0, abs(abs(g.x) + abs(g.y) - 0.45)) * 0.7);
          if (s8 < 0.0) {
            col = OCH;
            col = mix(col, NAVY, smoothstep(0.012, 0.0, abs(s8 + 0.03)));
            col = mix(col, IND, smoothstep(0.01, -0.01, flower(c, 0.08, 8.0)));
            col = mix(col, IVO, smoothstep(0.01, -0.01, length(c) - 0.025));
          }
        }
      }
      // pendants top and bottom: palmette on a stem
      vec2 pc = vec2(c.x, abs(c.y) - 1.1);
      float pend = min(flower(pc, 0.12, 6.0), sdBox(pc + vec2(0.0, 0.11), vec2(0.015, 0.06)));
      col = mix(col, IND, smoothstep(0.01, -0.01, pend));
      col = mix(col, IVO, smoothstep(0.01, -0.01, length(pc) - 0.035));
      return col;
    }
    vec3 mainBorder(float along, float t) {
      // t: 0 (outer) .. 1 (inner) across the band
      float per = 0.19;
      float x = (fract(along / per) - 0.5) * per;
      float y = (t - 0.5) * 0.22;
      float cell = floor(along / per);
      vec3 col = NAVY * 1.25;
      // a ground of tiny ivory/rose florets between the big motifs
      vec2 fg = fract(vec2(along, y) / 0.03) - 0.5;
      col = mix(col, mod(floor(along / 0.03), 2.0) < 0.5 ? ROSE * 0.7 : IVO * 0.6, smoothstep(0.1, 0.05, length(fg)) * 0.8);
      // undulating vine
      float vine = abs(y - 0.055 * sin(along / per * 6.2832));
      col = mix(col, OCH * 0.85, smoothstep(0.009, 0.004, vine));
      // alternating rosettes and cartouches
      if (mod(cell, 2.0) < 0.5) {
        float fl = flower(vec2(x, y), 0.07, 8.0);
        col = mix(col, RED, smoothstep(0.008, -0.008, fl));
        col = mix(col, IVO, smoothstep(0.006, -0.006, flower(vec2(x, y), 0.035, 6.0)));
        col = mix(col, NAVY, smoothstep(0.006, -0.006, length(vec2(x, y)) - 0.012));
      } else {
        float lz = sdLoz(vec2(x, y), vec2(0.1, 0.07));
        col = mix(col, ROSE, smoothstep(0.006, -0.006, lz));
        col = mix(col, TEAL, smoothstep(0.006, -0.006, sdLoz(vec2(x, y), vec2(0.06, 0.04))));
        col = mix(col, IVO, smoothstep(0.004, 0.0, abs(lz + 0.012)));
      }
      // small leaves along the vine
      vec2 lp = vec2(fract(along / (per * 0.5)) - 0.5, y / 0.11);
      float lf = sdVesica(rot2(0.9) * (lp - vec2(0.0, 0.5 * sin(along / per * 6.2832 + 1.57))), 0.18, 0.12);
      col = mix(col, TEAL, smoothstep(0.02, -0.02, lf) * 0.8);
      return col;
    }
    void surface(vec2 uv, inout Surface s) {
      vec2 m = uv * vec2(3.0, 4.0);
      // knot grid quantisation (~5 knots/cm is too fine to see; 2.2 mm reads as woven)
      const float K = 0.0045;
      vec2 kid = floor(m / K);
      vec2 kf = fract(m / K);
      vec2 mq = (kid + 0.5) * K;
      vec2 c = mq - vec2(1.5, 2.0);
      float d = min(1.5 - abs(c.x), 2.0 - abs(c.y));     // distance to the rug edge
      bool vertEdge = (1.5 - abs(c.x)) < (2.0 - abs(c.y));
      float along = vertEdge ? c.y : c.x;
      vec3 col;
      if (d < 0.035) {                                  // outer guard: reciprocal teeth
        float tooth = abs(fract(along / 0.03) - 0.5) * 2.0;
        col = (d / 0.035) < tooth ? NAVY : RED2;
      } else if (d < 0.065) {                           // ochre guard with beads
        col = OCH * 0.8;
        col = mix(col, RED2, smoothstep(0.006, 0.003, length(vec2(fract(along / 0.03) - 0.5, (d - 0.05) / 0.03) * vec2(0.03, 0.03))));
      } else if (d < 0.08) { col = RED;                 // red line
      } else if (d < 0.31) { col = mainBorder(along, (d - 0.08) / 0.23);
      } else if (d < 0.345) {                           // ivory guard with a running S
        float t = (d - 0.31) / 0.035;
        col = IVO;
        float sv = abs(t - 0.5 - 0.3 * sin(along / 0.04 * 3.14159));
        col = mix(col, RED2, smoothstep(0.16, 0.08, sv));
      } else if (d < 0.37) { col = RED2;
      } else if (d < 0.38) { col = NAVY;
      } else {
        col = herati(c);
        // corner spandrels (quarter medallions)
        vec2 cc = abs(c) - vec2(1.12, 1.62);
        float sp = length(cc * vec2(1.0, 0.8)) - 0.42;
        if (sp < 0.0) {
          vec2 g = fract(c / 0.08) - 0.5;
          col = IND;
          col = mix(col, ROSE, smoothstep(0.01, -0.01, flower(g, 0.14, 6.0)) * 0.8);
          col = mix(col, IVO, smoothstep(0.012, 0.0, abs(sp + 0.025)));
        }
        col = medallion(c, col);
      }
      // abrash: dye lots change in bands across the length
      float ab = fbm(vec2(mq.y * 0.6, 0.5), vec2(64.0), 3);
      col *= 1.0 + ab * 0.12;
      col = mix(col, col * vec3(1.08, 0.95, 0.9), smoothstep(0.2, 0.5, ab) * 0.4);
      // per-knot jitter and the knot's own shading (each knot is a little dome)
      float kn = hash12(kid);
      float dome = 1.0 - length(kf - 0.5) * 1.2;
      col *= 0.9 + 0.12 * kn;
      // ---- wear: threadbare path (door -> chest diagonal) and a worn centre
      float path = abs((m.x - 1.5) * 0.85 + (m.y - 2.0) * 0.5 - 0.15) ;
      float wearN = fbm(m * 1.5, vec2(64.0), 5) * 0.5 + 0.5;
      float wear = smoothstep(0.55, 0.0, path) * 0.7 + smoothstep(0.9, 0.0, length((m - vec2(1.6, 2.1)) * vec2(1.0, 0.8))) * 0.5;
      wear = clamp(wear * (0.6 + 0.8 * wearN) - 0.25, 0.0, 1.0);
      wear += smoothstep(0.03, 0.0, d) * 0.4;           // edges rubbed
      wear = clamp(wear, 0.0, 1.0);
      vec3 warp = vec3(0.52, 0.46, 0.37) * (0.85 + 0.2 * step(0.5, fract(m.x / K * 0.5)) * step(0.5, fract(m.y / K * 0.5)) + 0.1 * kn);
      float bare = smoothstep(0.55, 0.9, wear);
      col = mix(col, mix(col * 0.85 + vec3(0.06, 0.05, 0.04), warp, bare), smoothstep(0.15, 0.6, wear));
      // stains: one dark wine/tea, one grey water mark
      float st1 = smoothstep(0.18, 0.1, length((m - vec2(0.95, 2.9)) * vec2(1.0, 1.3)) + fbm(m * 6.0, vec2(64.0), 4) * 0.05);
      col = mix(col, col * vec3(0.45, 0.35, 0.3), st1 * 0.7);
      float st2r = length((m - vec2(2.2, 1.1)) * vec2(1.2, 1.0)) + fbm(m * 5.0 + 3.0, vec2(64.0), 4) * 0.06;
      col = mix(col, col * 0.8 + vec3(0.04), smoothstep(0.25, 0.15, st2r) * 0.4);
      col = mix(col, col * 0.6, smoothstep(0.012, 0.0, abs(st2r - 0.22)) * 0.5);
      // dust and grime toward the edges
      col *= 0.82 + 0.18 * smoothstep(0.0, 0.5, d);
      s.albedo = col;
      float pile = (1.0 - bare) * (0.55 + 0.25 * dome + 0.1 * kn);
      s.height = 0.25 + pile * 0.5 + wearN * 0.08;
      s.rough = mix(0.95, 0.8, bare) - 0.06 * fbm(m * 3.0 + 7.0, vec2(64.0), 3);
      s.metal = 0.0;
      s.ao = 0.75 + 0.25 * dome * (1.0 - bare) + bare * 0.2;
    }`,
  });
}

/** Bisque crazing + pores for the doll heads (tiles; normal map only matters). 1 tile ~ 6 cm. */
export function bisqueCraze(ctx) {
  return ctx.textures.generate('bedroom:craze', {
    size: 512, tile: true, normalStrength: 1.2,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float e = voronoiEdge(uv * 9.0, vec2(9.0), 1.0);
      float e2 = voronoiEdge(uv * 23.0 + 3.0, vec2(23.0), 1.0);
      float craze = smoothstep(0.035, 0.0, e) * 0.8 + smoothstep(0.025, 0.0, e2) * 0.4;
      float pores = fbm(uv * 40.0, vec2(40.0), 3) * 0.5 + 0.5;
      s.albedo = vec3(1.0 - craze * 0.35) * (0.95 + 0.05 * pores);
      s.height = 0.5 - craze * 0.25 + pores * 0.05;
      s.rough = 0.45 + craze * 0.2; s.metal = 0.0; s.ao = 1.0 - craze * 0.4;
    }`,
  });
}
