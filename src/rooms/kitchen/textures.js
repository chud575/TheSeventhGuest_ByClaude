import * as THREE from 'three';

/**
 * Kitchen-specific procedural PBR textures (GPU TextureForge, cached by key).
 * Every function returns a TextureSet { map, normalMap, ormMap, withRepeat() }.
 * Albedo is authored in sRGB. ORM = (ao, rough, metal).
 */

/** Flagstone floor: irregular rows of worn York-stone flags, flour ground into the joints. 1 tile = 2.4 m. */
export function flagstoneTexture(forge, size = 2048) {
  return forge.generate('kitchen:flags3', {
    size, normalStrength: 2.2,
    glsl: /* glsl */ `
    // rows of flags with random lengths, rows offset; returns (cellId, distToEdge)
    vec3 flag(vec2 p) {
      float rows = 4.0;
      float ry = p.y * rows;
      float row = mod(floor(ry), rows);
      float fy = fract(ry);
      float off = hash11(row * 7.13 + 1.0);
      float x = p.x * 3.0 + off;
      float k = mod(floor(x), 3.0);
      float fx = fract(x);
      float ex = min(fx, 1.0 - fx) / 3.0;
      float ey = min(fy, 1.0 - fy) / rows;
      return vec3(row * 10.0 + k, min(ex, ey), 0.0);
    }
    void surface(vec2 uv, inout Surface s) {
      vec2 wq = uv + vec2(fbm(uv + 3.0, vec2(4.0), 4), fbm(uv + 8.0, vec2(4.0), 4)) * 0.006;
      vec3 f = flag(wq);
      float id = f.x;
      float d = f.y;                         // distance to joint, uv units
      vec3 hc = hash32(vec2(id, id * 1.7));
      float joint = 1.0 - smoothstep(0.0012, 0.0045, d);
      float edgeWear = 1.0 - smoothstep(0.0, 0.02, d);
      // stone body
      float big = fbm(uv + hc.xy * 9.0, vec2(4.0), 5) * 0.5 + 0.5;
      float mid = fbm(uv + hc.yz * 5.0, vec2(16.0), 4) * 0.5 + 0.5;
      float grit = vnoise(uv * 900.0, vec2(900.0));
      float strata = sin((uv.x * 30.0 + uv.y * 6.0 + big * 4.0 + hc.x * 20.0)) * 0.5 + 0.5;
      vec3 c1 = mix(vec3(0.36, 0.34, 0.31), vec3(0.47, 0.44, 0.39), hc.x);
      c1 = mix(c1, vec3(0.33, 0.33, 0.33), hc.y * 0.5);
      vec3 col = c1 * (0.78 + 0.32 * big) * (0.9 + 0.12 * mid) * (0.94 + 0.08 * grit);
      col *= 0.95 + 0.05 * strata;
      // traffic polish: smoother, darker in the middle of flags
      float polish = smoothstep(0.35, 0.8, fbm(uv + 11.0, vec2(6.0), 4) * 0.5 + 0.5);
      // pits and chips
      float pits = smoothstep(0.75, 0.9, vnoise(uv * 220.0 + hc.xy * 50.0, vec2(220.0)));
      float chip = smoothstep(0.55, 0.8, fbm(uv + id * 0.37, vec2(48.0), 3) * 0.5 + 0.5) * edgeWear;
      // grime / damp patches
      float damp = smoothstep(0.55, 0.85, fbm(uv + 21.0, vec2(8.0), 5) * 0.5 + 0.5);
      col = mix(col, col * vec3(0.62, 0.6, 0.58), damp * 0.6);
      // flour in joints and pits
      vec3 flour = vec3(0.82, 0.8, 0.74);
      vec3 grout = mix(vec3(0.22, 0.21, 0.19), flour * 0.75, 0.45 + 0.4 * mid);
      col = mix(col, grout, joint);
      col = mix(col, flour * 0.8, pits * 0.5);
      col = mix(col, col * 0.7, chip * 0.6);
      s.albedo = col;
      float h = 0.78 + 0.06 * big + 0.03 * mid - 0.025 * pits;
      h -= edgeWear * edgeWear * 0.18;
      h -= chip * 0.1;
      h = mix(h, 0.25, joint);
      s.height = h;
      s.rough = mix(0.82, 0.55, polish) + 0.08 * grit - damp * 0.12;
      s.rough = mix(s.rough, 0.95, joint);
      s.metal = 0.0;
      s.ao = mix(1.0, 0.55, joint) * (1.0 - pits * 0.3);
    }`,
  });
}

/** Glazed cream tiles in running bond (0.15 x 0.075 m), crazed glaze, grimy grout. 1 tile = 0.6 x 0.6 m. */
export function wallTileTexture(forge, size = 1024) {
  return forge.generate('kitchen:walltile2', {
    size, normalStrength: 2.5,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 g = vec2(uv.x * 4.0, uv.y * 8.0);
      float row = floor(g.y);
      g.x += mod(row, 2.0) * 0.5;
      vec2 id = vec2(floor(g.x), row);
      vec2 f = fract(g);
      vec2 tid = vec2(mod(id.x, 4.0), mod(id.y, 8.0));
      vec3 h3 = hash32(tid + 3.1);
      // distance to tile edge in metres (tile 0.15 x 0.075)
      vec2 dm = min(f, 1.0 - f) * vec2(0.15, 0.075);
      float de = min(dm.x, dm.y);
      float grout = 1.0 - smoothstep(0.0012, 0.0022, de);
      float pillow = domeh(-de + 0.0045, 0.0045);
      // glaze colour: cream with per-tile drift, pooling darker at the edges
      vec3 cream = vec3(0.86, 0.83, 0.74);
      vec3 col = cream * (0.92 + 0.1 * h3.x);
      col = mix(col, vec3(0.8, 0.82, 0.76), h3.y * 0.35);
      col *= 0.9 + 0.1 * smoothstep(0.0, 0.01, de);
      // crazing: fine voronoi cracks
      float craze = 1.0 - smoothstep(0.0, 0.0035, voronoiEdge(uv * 22.0 + h3.xy, vec2(22.0), 1.0));
      craze *= smoothstep(0.2, 0.7, fbm(uv + h3.z, vec2(12.0), 3) * 0.5 + 0.5);
      // grime: soot/grease from the range, settling lower and into crazing
      float grime = fbm(uv + 5.0, vec2(8.0), 5) * 0.5 + 0.5;
      grime = smoothstep(0.45, 0.9, grime);
      col = mix(col, col * vec3(0.72, 0.66, 0.55), grime * 0.55);
      col = mix(col, col * 0.62, craze * 0.6);
      // chips revealing the biscuit body
      float chip = smoothstep(0.88, 0.95, vnoise(uv * 60.0 + h3.xy * 10.0, vec2(60.0))) * (1.0 - smoothstep(0.0, 0.008, de));
      col = mix(col, vec3(0.62, 0.52, 0.42), chip);
      vec3 groutCol = vec3(0.32, 0.3, 0.27) * (0.8 + 0.4 * grime);
      col = mix(col, groutCol, grout);
      s.albedo = col;
      s.height = mix(0.55 + 0.45 * pillow - chip * 0.3, 0.15, grout);
      s.rough = mix(0.1 + 0.25 * grime + 0.05 * h3.z, 0.95, max(grout, chip));
      s.metal = 0.0;
      s.ao = mix(1.0, 0.6, grout);
    }`,
  });
}

/** Majolica border tile strip: 0.15 m square relief tiles (dark green glaze pooling in the relief). Tile = 1 square. */
export function borderTileTexture(forge, size = 512) {
  return forge.generate('kitchen:bordertile', {
    size, normalStrength: 3.0,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv * 2.0 - 1.0;
      float de = min(1.0 - abs(p.x), 1.0 - abs(p.y)) * 0.075;
      float grout = 1.0 - smoothstep(0.001, 0.002, de);
      // relief: quatrefoil + corner quarter-rosettes + a bead ring
      vec2 q = abs(p);
      float lobe = 1e5;
      for (int i = 0; i < 4; i++) {
        float a = float(i) * 1.5707963;
        vec2 c = vec2(cos(a), sin(a)) * 0.36;
        lobe = min(lobe, sdCircle(p - c, 0.3));
      }
      float quat = lobe;
      float center = sdCircle(p, 0.14);
      float ring = abs(sdCircle(p, 0.78)) - 0.035;
      float corner = sdCircle(q - vec2(1.0), 0.42);
      float leaf = sdVesica(rot2(0.785398) * (p), 0.95, 0.75);
      float relief = 0.0;
      relief = max(relief, domeh(quat, 0.12) * 0.7);
      relief = max(relief, domeh(center, 0.1));
      relief = max(relief, domeh(ring, 0.03) * 0.8);
      relief = max(relief, domeh(corner, 0.12) * 0.6);
      relief = max(relief, domeh(abs(corner + 0.12) - 0.02, 0.02) * 0.9);
      float pool = 1.0 - relief;             // glaze pools darker in the hollows
      vec3 deep = vec3(0.04, 0.16, 0.13);
      vec3 hi = vec3(0.14, 0.42, 0.33);
      vec3 col = mix(deep, hi, pow(relief, 0.7));
      // ochre centre + cream bead accents
      col = mix(col, vec3(0.78, 0.55, 0.18), fill(center, 0.01) * 0.85);
      col = mix(col, vec3(0.72, 0.66, 0.5), domeh(ring, 0.03) * 0.5);
      float n = fbm(uv, vec2(4.0), 4) * 0.5 + 0.5;
      col *= 0.85 + 0.25 * n;
      float craze = 1.0 - smoothstep(0.0, 0.006, voronoiEdge(uv * 6.0, vec2(6.0), 1.0));
      col = mix(col, col * 0.6, craze * 0.4);
      col = mix(col, vec3(0.26, 0.24, 0.2), grout);
      s.albedo = col;
      s.height = mix(0.4 + relief * 0.6, 0.1, grout);
      s.rough = mix(0.12 + 0.1 * n, 0.9, grout);
      s.metal = 0.0;
      s.ao = mix(0.75 + 0.25 * relief, 0.6, grout);
    }`,
  });
}

/** End-grain butcher block: 5 cm blocks with growth rings, knife scoring, a worn hollow, stains. Non-tiling, aspect w/h. */
export function butcherBlockTexture(forge, { aspect = 2, size = 2048 } = {}) {
  return forge.generate(`kitchen:butcher:${aspect}`, {
    size, aspect, tile: false, normalStrength: 1.6,
    uniforms: { uAsp: aspect },
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 m = vec2(uv.x * uAsp, uv.y) * 0.8;  // metres (top is 0.8 m deep)
      vec2 g = m / 0.055;
      float row = floor(g.y);
      g.x += hash11(row * 1.37) * 0.6;
      vec2 id = floor(g); vec2 f = fract(g);
      vec3 h = hash32(id + 7.0);
      vec2 dm = min(f, 1.0 - f);
      float seam = 1.0 - smoothstep(0.0, 0.03, min(dm.x, dm.y));
      // growth rings around an off-block pith
      vec2 pith = vec2(h.x * 3.0 - 1.0, h.y * 3.0 - 1.0);
      float r = length(f - pith + 0.04 * vec2(fbm(f + h.z * 9.0, vec2(3.0), 3), fbm(f + 5.0, vec2(3.0), 3)));
      float rings = sin(r * (30.0 + h.z * 30.0) * 3.14159) * 0.5 + 0.5;
      rings = pow(rings, 2.0);
      float pores = vnoise(uv * vec2(uAsp, 1.0) * 1400.0, vec2(1.0e4));
      vec3 wood = mix(vec3(0.62, 0.45, 0.28), vec3(0.74, 0.58, 0.38), h.x);
      wood = mix(wood, vec3(0.5, 0.33, 0.2), h.y * 0.5);
      vec3 col = wood * (0.82 + 0.18 * rings) * (0.92 + 0.08 * pores);
      // worn hollow in the middle (darker, smoother, more scored)
      vec2 c = vec2(uv.x - 0.5, (uv.y - 0.5) * 0.9);
      float hollow = exp(-dot(c * vec2(2.2, 2.6), c * vec2(2.2, 2.6)) * 3.5);
      // knife scoring: many short straight scratches at random angles
      float score = 0.0;
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        vec2 q = rot2(fi * 1.1 + 0.4) * (m * 1.0);
        float lane = q.y * (140.0 + fi * 37.0);
        float lid = floor(lane);
        float along = q.x * 8.0 + hash11(lid + fi * 13.0) * 50.0;
        float seg = step(0.82, hash12(vec2(lid, floor(along)) + fi));
        float line = 1.0 - smoothstep(0.0, 0.18, abs(fract(lane) - 0.5));
        score = max(score, line * seg);
      }
      score *= 0.35 + hollow * 0.9;
      // stains: blood/wine/grease blotches
      float st = smoothstep(0.6, 0.85, fbm(uv + 3.0, vec2(2.0 * uAsp, 2.0), 5) * 0.5 + 0.5);
      float ring2 = stroke(fbm(uv + 3.0, vec2(2.0 * uAsp, 2.0), 5) * 0.5 + 0.5 - 0.62, 0.0, 0.008);
      col = mix(col, col * vec3(0.55, 0.32, 0.26), st * 0.65);
      col = mix(col, col * vec3(0.5, 0.3, 0.25), ring2 * 0.5);
      col = mix(col, col * 0.8, hollow * 0.35);
      col = mix(col, col * 0.55, seam * 0.6);
      col = mix(col, vec3(0.86, 0.8, 0.68), score * 0.25); // pale fresh cuts
      // flour dusting in the scoring at one end
      float flour = smoothstep(0.5, 0.9, fbm(uv + 17.0, vec2(3.0 * uAsp, 3.0), 4) * 0.5 + 0.5) * smoothstep(0.55, 0.85, uv.x);
      col = mix(col, vec3(0.88, 0.86, 0.8), flour * 0.6);
      s.albedo = col;
      s.height = 0.7 - hollow * 0.25 - seam * 0.1 - score * 0.08 + rings * 0.02;
      s.rough = mix(0.62, 0.48, hollow) + score * 0.2 + flour * 0.3;
      s.metal = 0.0;
      s.ao = 1.0 - seam * 0.3 - score * 0.2;
    }`,
  });
}

/** Cast iron with stove blacking: near-black, satin, graphite sheen, rust blooms. */
export function castIronTexture(forge, size = 1024) {
  return forge.generate('kitchen:castiron', {
    size, normalStrength: 1.4,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float n = fbm(uv, vec2(8.0), 5) * 0.5 + 0.5;
      float fine = vnoise(uv * 700.0, vec2(700.0));
      float sand = vnoise(uv * 220.0 + 3.0, vec2(220.0));
      float rust = smoothstep(0.68, 0.86, fbm(uv + 7.0, vec2(12.0), 5) * 0.5 + 0.5);
      float polish = smoothstep(0.4, 0.75, fbm(uv + 2.0, vec2(6.0), 4) * 0.5 + 0.5);
      vec3 col = vec3(0.07, 0.07, 0.075) * (0.75 + 0.5 * n) * (0.9 + 0.2 * sand);
      col = mix(col, vec3(0.2, 0.2, 0.21), polish * 0.35);
      col = mix(col, vec3(0.26, 0.11, 0.05) * (0.7 + 0.6 * fine), rust * 0.8);
      s.albedo = col;
      s.height = 0.5 + 0.12 * sand + 0.05 * fine + rust * 0.1;
      s.rough = mix(0.62, 0.38, polish) + rust * 0.35 + 0.05 * fine;
      s.metal = mix(0.75, 0.1, rust);
      s.ao = 1.0;
    }`,
  });
}

/** Hammered copper with tarnish and the odd verdigris freckle. */
export function copperTexture(forge, size = 1024) {
  return forge.generate('kitchen:copper', {
    size, normalStrength: 1.2,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec4 v = voronoi(uv * 26.0, vec2(26.0), 0.9);
      float dimple = smoothstep(0.0, 0.5, v.x);
      float tarn = fbm(uv + 4.0, vec2(10.0), 5) * 0.5 + 0.5;
      float streak = vnoise(vec2(uv.x * 300.0, uv.y * 6.0), vec2(300.0, 6.0));
      float verd = smoothstep(0.8, 0.92, fbm(uv + 13.0, vec2(16.0), 4) * 0.5 + 0.5);
      vec3 cu = vec3(0.95, 0.56, 0.38);
      vec3 col = mix(cu, vec3(0.52, 0.27, 0.17), smoothstep(0.35, 0.85, tarn) * 0.75);
      col *= 0.9 + 0.1 * streak;
      col = mix(col, vec3(0.28, 0.5, 0.42), verd * 0.8);
      s.albedo = col;
      s.height = 0.5 + dimple * 0.25;
      s.rough = 0.2 + 0.3 * smoothstep(0.35, 0.9, tarn) + 0.05 * streak + verd * 0.5;
      s.metal = mix(1.0, 0.0, verd);
      s.ao = 1.0;
    }`,
  });
}

/**
 * Flour decal for the floor (non-tiling, alpha): a spill round the butcher block,
 * drifts along the skirting and a trail of bare footprints walking to the dumbwaiter.
 * uv (0..1) spans the decal plane; footprint path given in uv units.
 */
export function flourDecalTexture(forge, size = 2048) {
  return forge.generate('kitchen:flour5', {
    size, aspect: 1.0, tile: false, normalStrength: 0.6,
    glsl: /* glsl */ `
    float foot(vec2 p, float side) {
      // p in foot space: y forward (toe at +y), units ~ metres*1 (foot length ~0.25)
      p.x *= side;
      float sole = sdEllipse(p - vec2(0.0, -0.02), vec2(0.04, 0.1));
      float heel = sdCircle(p - vec2(0.004, -0.085), 0.033);
      float ball = sdCircle(p - vec2(-0.005, 0.045), 0.042);
      float d = min(min(sole, heel), ball);
      // arch cut-out
      d = max(d, -sdEllipse(p - vec2(0.045, -0.02), vec2(0.022, 0.06)));
      float toes = 1e5;
      toes = min(toes, sdCircle(p - vec2(-0.025, 0.105), 0.016));
      toes = min(toes, sdCircle(p - vec2(0.0, 0.112), 0.012));
      toes = min(toes, sdCircle(p - vec2(0.019, 0.105), 0.011));
      toes = min(toes, sdCircle(p - vec2(0.034, 0.093), 0.009));
      toes = min(toes, sdCircle(p - vec2(0.045, 0.077), 0.008));
      return min(d, toes);
    }
    void surface(vec2 uv, inout Surface s) {
      // decal covers 6 x 6 m; metres:
      vec2 m = (uv - 0.5) * 6.0;
      float n1 = fbm(uv, vec2(3.0), 6) * 0.5 + 0.5;
      float n2 = fbm(uv + 4.0, vec2(18.0), 4) * 0.5 + 0.5;
      float speck = vnoise(uv * 1400.0, vec2(1.0e4));
      // main spill around the block centre (0.35, -0.35) — skewed toward the pantry
      vec2 c = m - vec2(0.15, -0.55);
      float spill = exp(-dot(c * vec2(0.75, 1.0), c * vec2(0.75, 1.0)) * 0.9);
      float a = smoothstep(0.2, 0.65, spill * (0.55 + 0.9 * n1));
      // thick heap where a sack split (block end nearest pantry)
      vec2 c2 = m - vec2(-0.75, -0.75);
      float heap = exp(-dot(c2, c2) * 9.0);
      a = max(a, smoothstep(0.1, 0.6, heap * (0.7 + 0.6 * n2)));
      // a scuffed drag streak toward the pantry
      vec2 c3 = rot2(-0.33) * (m - vec2(-1.7, 0.1));
      a = max(a, smoothstep(0.55, 0.9, exp(-c3.y * c3.y * 20.0 - c3.x * c3.x * 0.6) * n2 * 1.3) * 0.7);
      // fine dust everywhere else
      a = max(a, smoothstep(0.55, 0.95, n1) * 0.35);
      a *= 0.45 + 0.55 * smoothstep(0.3, 0.7, n2 * 0.7 + n1 * 0.5);
      // footprints: bare feet walking from the spill to the dumbwaiter (+x wall)
      float fp = 0.0;
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        float t = fi / 8.0;
        vec2 base = mix(vec2(-0.2, -0.55), vec2(2.75, 0.05), t);
        base.y += sin(t * 3.0) * 0.12;
        vec2 dir = normalize(vec2(2.95, 0.6));
        vec2 nrm = vec2(-dir.y, dir.x);
        float side = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
        vec2 pos = base + nrm * side * 0.085;
        vec2 q = m - pos;
        // rotate into foot space (y forward along dir)
        vec2 fs = vec2(dot(q, vec2(dir.y, -dir.x)), dot(q, dir));
        float d = foot(fs * 1.05, side);
        float print = 1.0 - smoothstep(-0.004, 0.004, d);
        // prints fade as the flour on the feet runs out
        fp = max(fp, print * (1.0 - t * 0.85));
      }
      // prints: flour pressed (brighter, denser) at the start, then faint white
      float inSpill = smoothstep(0.3, 0.6, a);
      float alpha = a;
      alpha = mix(alpha, alpha * 0.15, fp * inSpill);      // feet pressed flour away inside the spill
      alpha = max(alpha, fp * (1.0 - inSpill) * 0.95);    // and left it behind outside
      alpha *= 0.85 + 0.15 * speck;
      s.albedo = vec3(0.9, 0.88, 0.83) * (0.92 + 0.08 * n2);
      s.alpha = saturate(alpha * 1.25);
      s.height = 0.5 + alpha * 0.2;
      s.rough = 0.95;
      s.metal = 0.0;
      s.ao = 1.0;
    }`,
  });
}

/** Moonlit kitchen-garden view for the window (HDR via material colour gain). */
export function gardenSkyTexture(forge, size = 1024) {
  return forge.generate('kitchen:garden', {
    size, aspect: 1.0, tile: false,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv;
      vec2 moon = vec2(0.3, 0.8);
      float md = length((p - moon) * vec2(1.0, 1.0));
      float cl = fbm(p + vec2(0.4, 0.1), vec2(2.0, 4.0), 6);
      vec3 sky = mix(vec3(0.04, 0.06, 0.13), vec3(0.2, 0.28, 0.46), smoothstep(0.0, 1.0, p.y));
      sky += vec3(0.6, 0.68, 0.85) * exp(-md * 7.0) * 0.9;
      sky = mix(sky, sky * 0.3 + vec3(0.02, 0.025, 0.04), smoothstep(-0.05, 0.4, cl) * 0.75);
      sky += vec3(0.75, 0.8, 0.9) * smoothstep(0.1, 0.0, abs(cl - 0.05)) * exp(-md * 3.5) * 0.6;
      sky = mix(sky, vec3(1.0, 0.98, 0.92) * 1.2, smoothstep(0.045, 0.04, md));
      // garden wall with coping + a glasshouse silhouette and a gnarled pear tree
      float wall = p.y - (0.28 + 0.004 * sin(p.x * 80.0));
      float house = max(abs(p.x - 0.72) - 0.16, p.y - (0.42 - abs(p.x - 0.72) * 0.6));
      float tr = abs(p.x - 0.12 - 0.04 * sin(p.y * 7.0)) - 0.016 * (1.4 - p.y);
      float br = 1.0;
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        vec2 o = vec2(0.12 + 0.02 * sin(fi), 0.36 + fi * 0.075);
        vec2 d = rot2(0.5 + 0.5 * sin(fi * 2.3)) * (p - o);
        float side = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
        d.x *= side;
        br = min(br, max(abs(d.y + 0.03 * sin(d.x * 25.0)) - 0.005 * (1.0 - d.x * 2.5), -d.x));
        br = max(br, d.x - 0.3);
      }
      float sil = min(min(wall, house), min(tr, br));
      vec3 col = mix(sky, vec3(0.012, 0.014, 0.024), smoothstep(0.003, -0.003, sil));
      // glasshouse panes catch the moon faintly
      float panes = step(0.5, fract((p.x - 0.56) * 25.0)) * step(house, 0.0) * step(0.3, p.y);
      col += vec3(0.08, 0.1, 0.16) * panes * 0.5;
      s.albedo = col;
      s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
    }`,
  });
}

/** Painted, smoke-darkened tongue-and-groove boarding (dumbwaiter hatch, dresser back). 1 tile = 0.6 m. */
export function boardingTexture(forge, { color = [0.16, 0.24, 0.26], size = 1024 } = {}) {
  return forge.generate(`kitchen:boarding:${color}`, {
    size, normalStrength: 1.8,
    uniforms: { uColor: color },
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float x = uv.x * 6.0;
      float f = fract(x);
      float id = floor(x);
      float groove = 1.0 - smoothstep(0.0, 0.035, min(f, 1.0 - f));
      float bead = stroke(f - 0.5, 0.0, 0.02);
      float grain = fbm(vec2(uv.x + id * 0.31, uv.y), vec2(360.0, 3.0), 4) * 0.5 + 0.5;
      float chips = smoothstep(0.7, 0.85, fbm(uv + id * 0.13, vec2(48.0), 4) * 0.5 + 0.5);
      float soot = smoothstep(0.3, 1.0, fbm(uv, vec2(6.0), 4) * 0.5 + 0.5);
      vec3 col = vec3(uColor) * (0.85 + 0.2 * hash11(id * 1.7)) * (0.92 + 0.12 * grain);
      col = mix(col, vec3(0.32, 0.22, 0.14) * (0.7 + 0.5 * grain), chips * 0.85);
      col = mix(col, col * 0.6, soot * 0.4);
      col *= 1.0 - groove * 0.6;
      s.albedo = col;
      s.height = 0.6 - groove * 0.4 + grain * 0.03 - chips * 0.05 - bead * 0.03;
      s.rough = 0.55 + chips * 0.3 + soot * 0.15;
      s.metal = 0.0;
      s.ao = 1.0 - groove * 0.5;
    }`,
  });
}

/** Coarse hessian sacking (flour sacks). */
export function sackTexture(forge, size = 512) {
  return forge.generate('kitchen:sack', {
    size, normalStrength: 2.0,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 g = uv * 90.0;
      float wx = sin(g.x * 3.14159) * 0.5 + 0.5;
      float wy = sin(g.y * 3.14159) * 0.5 + 0.5;
      float checker = mod(floor(g.x) + floor(g.y), 2.0);
      float weave = mix(wx, wy, checker);
      float n = fbm(uv, vec2(4.0), 4) * 0.5 + 0.5;
      float flour = smoothstep(0.45, 0.8, fbm(uv + 5.0, vec2(3.0), 4) * 0.5 + 0.5);
      vec3 col = vec3(0.56, 0.45, 0.3) * (0.75 + 0.35 * weave) * (0.85 + 0.25 * n);
      col = mix(col, vec3(0.88, 0.85, 0.78), flour * 0.55);
      s.albedo = col;
      s.height = 0.4 + 0.5 * weave;
      s.rough = 0.95; s.metal = 0.0; s.ao = 0.8 + 0.2 * weave;
    }`,
  });
}

/** Glowing coals for the firebox (used as an emissive map). */
export function emberTexture(forge, size = 256) {
  return forge.generate('kitchen:embers', {
    size, tile: false,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec4 v = voronoi(uv * 9.0, vec2(9.0), 0.9);
      float lump = 1.0 - smoothstep(0.1, 0.55, v.x);
      float crack = smoothstep(0.0, 0.08, v.y - v.x);
      float n = fbm(uv, vec2(6.0), 4) * 0.5 + 0.5;
      float hot = (1.0 - crack) * 0.9 + lump * 0.25 * n;
      hot *= smoothstep(1.0, 0.35, uv.y) * (0.6 + 0.6 * n);
      vec3 col = mix(vec3(0.25, 0.03, 0.0), vec3(1.0, 0.55, 0.15), hot);
      col = mix(col, vec3(1.0, 0.85, 0.5), smoothstep(0.8, 1.0, hot));
      s.albedo = col * (0.3 + 0.7 * hot);
      s.height = 0.5; s.rough = 1.0; s.metal = 0.0; s.ao = 1.0;
    }`,
  });
}

/** Helper: MeshStandard/Physical material from a TextureSet. */
export function matFrom(set, { repeat = [1, 1], physical = false, ...opts } = {}) {
  const maps = repeat[0] !== 1 || repeat[1] !== 1 ? set.withRepeat(repeat[0], repeat[1]) : set;
  const M = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  return new M({ map: maps.map, normalMap: maps.normalMap, roughnessMap: maps.ormMap, metalnessMap: maps.ormMap, aoMap: maps.ormMap, roughness: 1, metalness: 1, ...opts });
}
