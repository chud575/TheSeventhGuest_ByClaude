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

/** Glazed cream tiles in running bond (0.15 x 0.075 m): per-tile glaze drift, crackle crazing, chips, odd replaced tiles. 1 tile = 1.2 x 1.2 m. */
export function wallTileTexture(forge, size = 2048) {
  return forge.generate('kitchen:walltile4', {
    size, normalStrength: 2.6,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 g = vec2(uv.x * 8.0, uv.y * 16.0);
      float row = floor(g.y);
      g.x += mod(row, 2.0) * 0.5;
      vec2 id = vec2(floor(g.x), row);
      vec2 f = fract(g);
      vec2 tid = vec2(mod(id.x, 8.0), mod(id.y, 16.0));
      vec3 h3 = hash32(tid + 3.1);
      vec3 h4 = hash32(tid * 2.3 + 17.0);
      // slightly irregular hand-set joints
      vec2 dm = min(f, 1.0 - f) * vec2(0.15, 0.075);
      float de = min(dm.x, dm.y);
      float grout = 1.0 - smoothstep(0.0011, 0.0021, de);
      float pillow = domeh(-de + 0.005, 0.005);
      float replaced = step(0.955, h4.x);           // a later, whiter, uncrazed tile
      float cracked = step(0.985, h4.y) * (1.0 - replaced);
      vec3 cream = mix(vec3(0.84, 0.79, 0.67), vec3(0.9, 0.89, 0.84), replaced);
      vec3 col = cream * (0.95 + 0.1 * h3.x);
      col = mix(col, vec3(0.82, 0.83, 0.76), h3.y * 0.3);
      col = mix(col, vec3(0.88, 0.8, 0.66), h4.z * 0.25);
      // glaze pools darker toward the edges
      col *= 0.88 + 0.12 * smoothstep(0.0, 0.012, de);
      // crackle crazing (fine voronoi), stained by grease
      float craze = 1.0 - smoothstep(0.0, 0.004, voronoiEdge(uv * 34.0 + h3.xy * 3.0, vec2(34.0), 1.0));
      float craze2 = 1.0 - smoothstep(0.0, 0.005, voronoiEdge(uv * 90.0 + h3.yz, vec2(90.0), 1.0));
      craze = max(craze, craze2 * 0.7) * (1.0 - replaced) * smoothstep(0.15, 0.6, fbm(uv + h3.z, vec2(10.0), 3) * 0.5 + 0.5);
      // a through-crack across some tiles
      float tc = cracked * (1.0 - smoothstep(0.0, 0.03, abs(f.y - 0.5 - 0.3 * sin(f.x * 4.0 + h4.z * 6.0) * (f.x - 0.3))));
      float grime = smoothstep(0.42, 0.9, fbm(uv + 5.0, vec2(6.0), 5) * 0.5 + 0.5);
      col = mix(col, col * vec3(0.72, 0.64, 0.5), grime * 0.55);
      col = mix(col, col * vec3(0.55, 0.5, 0.42), craze * 0.55);
      col = mix(col, vec3(0.3, 0.26, 0.2), tc * 0.8);
      // chipped arrises revealing the biscuit
      float chipN = vnoise(uv * 140.0 + h3.xy * 10.0, vec2(140.0));
      float chip = smoothstep(0.8, 0.9, chipN) * (1.0 - smoothstep(0.0, 0.007, de));
      // knocked corners: about one tile in three has lost a corner, showing the buff biscuit (dirty)
      vec2 cc = step(0.5, h3.yz);
      float cdist = length((f - cc) * vec2(0.15, 0.075));
      float corner = step(0.66, h4.z) * (1.0 - smoothstep(0.0045, 0.0065, cdist + (chipN - 0.5) * 0.004 - h3.x * 0.003));
      chip = max(chip, corner);
      col = mix(col, vec3(0.5, 0.41, 0.31) * (0.8 + 0.3 * chipN), chip);
      vec3 groutCol = vec3(0.3, 0.28, 0.25) * (0.75 + 0.5 * grime);
      col = mix(col, groutCol, grout);
      s.albedo = col;
      s.height = mix(0.55 + 0.45 * pillow - chip * 0.3 - tc * 0.2 + (h3.z - 0.5) * 0.06, 0.15, grout);
      s.rough = mix(0.08 + 0.25 * grime + 0.06 * h3.z + craze * 0.2, 0.95, max(grout, chip));
      s.metal = 0.0;
      s.ao = mix(1.0, 0.55, grout) * (1.0 - craze * 0.15);
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

/** End-grain butcher block: glued blocks of irregular size (40-90 mm) with soft radial growth rings, knife scoring,
 *  a worn polished hollow, oiled dark perimeter, stains, flour in the seams. Non-tiling, aspect w/h. */
export function butcherBlockTexture(forge, { aspect = 2, size = 2048 } = {}) {
  return forge.generate(`kitchen:butcher3:${aspect}`, {
    size, aspect, tile: false, normalStrength: 1.5,
    uniforms: { uAsp: aspect },
    glsl: /* glsl */ `
    // irregular 1D partition: returns (index, start, width) of the segment holding x, widths 40-90 mm
    vec3 seg(float x, float seed) {
      float p = -0.02 - hash11(seed) * 0.05;
      for (int i = 0; i < 64; i++) {
        float w = 0.04 + 0.05 * hash11(float(i) * 1.731 + seed * 7.13);
        if (x < p + w) return vec3(float(i), p, w);
        p += w;
      }
      return vec3(99.0, p, 0.06);
    }
    void surface(vec2 uv, inout Surface s) {
      vec2 m = vec2(uv.x * uAsp, uv.y) * 0.78;            // metres (top is 0.78 m deep)
      vec3 ry = seg(m.y, 3.3);                           // rows across the depth
      vec3 rx = seg(m.x, ry.x * 5.17 + 1.0);             // blocks along each row, staggered per row
      vec2 id = vec2(rx.x, ry.x);
      vec2 f = vec2((m.x - rx.y) / rx.z, (m.y - ry.y) / ry.z);
      vec2 sz = vec2(rx.z, ry.z);
      vec3 h = hash32(id + 7.0);
      vec2 dmm = min(f, 1.0 - f) * sz;                    // distance to the glue line, metres
      float seam = 1.0 - smoothstep(0.0, 0.0018, min(dmm.x, dmm.y));
      // growth rings: concentric about a pith that usually lies outside the block (end grain of a quartered log)
      vec2 pith = vec2(0.5) + (h.xy - 0.5) * 2.6 + normalize(h.xy - 0.5 + 0.001) * 0.6;
      vec2 pm = (f - pith) * sz;
      float wob = 0.0025 * fbm(f * 2.0 + h.z * 9.0, vec2(3.0), 3);
      float r = length(pm) + wob;
      float ringF = 160.0 + h.z * 140.0;                 // rings per metre
      float rings = sin(r * ringF * 6.2831) * 0.5 + 0.5;
      rings = smoothstep(0.2, 0.95, rings);
      float rays = smoothstep(0.85, 1.0, sin(atan(pm.y, pm.x) * (70.0 + h.x * 40.0)) * 0.5 + 0.5) * 0.5;   // medullary rays
      float pores = vnoise(uv * vec2(uAsp, 1.0) * 1400.0, vec2(1.0e4));
      vec3 wood = mix(vec3(0.56, 0.38, 0.23), vec3(0.7, 0.53, 0.35), h.x);
      wood = mix(wood, vec3(0.5, 0.33, 0.2), h.y * 0.35);
      vec3 col = wood * (0.9 + 0.1 * rings) * (0.94 + 0.06 * pores) * (1.0 + rays * 0.05);
      // worn hollow in the middle (darker, smoother, more scored)
      vec2 c = vec2(uv.x - 0.5, (uv.y - 0.57) * 0.9);
      float hollow = exp(-dot(c * vec2(2.2, 2.6), c * vec2(2.2, 2.6)) * 3.5);
      // knife scoring: many short straight cuts, mostly along two working directions, densest in the hollow
      float score = 0.0;
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        vec2 q = rot2((fi < 2.5 ? 0.15 : 1.5) + fi * 0.37) * m;
        float lane = q.y * (150.0 + fi * 37.0);
        float lid = floor(lane);
        float along = q.x * 9.0 + hash11(lid + fi * 13.0) * 50.0;
        float sg = step(0.8 - hollow * 0.2, hash12(vec2(lid, floor(along)) + fi));
        float ln = 1.0 - smoothstep(0.0, 0.16, abs(fract(lane) - 0.5));
        score = max(score, ln * sg * (0.5 + 0.5 * hash12(vec2(lid, fi))));
      }
      score *= 0.25 + hollow * 0.9;
      // stains: blood/wine/grease blotches
      float stn = fbm(uv + 3.0, vec2(2.0 * uAsp, 2.0), 5) * 0.5 + 0.5;
      float st = smoothstep(0.62, 0.85, stn);
      float ring2 = stroke(stn - 0.64, 0.0, 0.006);
      col = mix(col, col * vec3(0.6, 0.38, 0.32), st * 0.55);
      col = mix(col, col * vec3(0.55, 0.36, 0.3), ring2 * 0.4);
      col = mix(col, col * 0.84, hollow * 0.3);
      // oiled, handled perimeter: a dark band round the edge where hands and oil rags go
      vec2 em = min(uv, 1.0 - uv) * vec2(uAsp, 1.0) * 0.78;
      float edge = 1.0 - smoothstep(0.0, 0.07, min(em.x, em.y));
      edge *= 0.75 + 0.5 * fbm(uv + 44.0, vec2(6.0 * uAsp, 6.0), 3);
      col = mix(col, col * vec3(0.5, 0.38, 0.3), clamp(edge, 0.0, 1.0) * 0.65);
      col = mix(col, col * 0.55, seam * 0.6);
      col = mix(col, vec3(0.8, 0.7, 0.55), score * 0.22);   // pale fresh cuts
      // flour: dusted over the left (pastry) end, packed into the seams and knife scores
      float fl0 = fbm(uv + 17.0, vec2(3.0 * uAsp, 3.0), 4) * 0.5 + 0.5;
      float flourZone = smoothstep(0.62, 0.15, uv.x);
      float flour = smoothstep(0.45, 0.85, fl0) * flourZone;
      float flourSeam = (seam + score * 0.6) * smoothstep(0.3, 0.6, fl0) * smoothstep(0.85, 0.2, uv.x);
      float grit = vnoise(uv * vec2(uAsp, 1.0) * 900.0, vec2(1e4));
      col = mix(col, vec3(0.9, 0.88, 0.82), clamp(flour * (0.5 + 0.5 * grit) * 0.7 + flourSeam * 0.7, 0.0, 1.0));
      s.albedo = col;
      s.height = 0.7 - seam * 0.08 - score * 0.1 + rings * 0.012 - pores * 0.01;
      s.rough = mix(0.82, 0.48, hollow) + score * 0.1 + flour * 0.15 - edge * 0.25 + seam * 0.05;
      s.metal = 0.0;
      s.ao = 1.0 - seam * 0.3 - score * 0.15;
    }`,
  });
}

/** Sides of the end-grain block: vertical long-grain staves 55 mm wide (metre UVs, v = height above floor). 1 tile = 1 m. */
export function blockSideTexture(forge, size = 1024) {
  return forge.generate('kitchen:blockside2', {
    size, normalStrength: 1.4,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      // staves of irregular width (40-90 mm), repeating every metre
      float x = fract(uv.x), p = 0.0, id = 0.0, w = 0.06;
      for (int i = 0; i < 30; i++) { w = 0.04 + 0.05 * hash11(float(i) * 2.37 + 0.5); if (x < p + w || i == 29) { id = float(i); break; } p += w; }
      w = min(w, 1.0 - p);
      float f = clamp((x - p) / w, 0.0, 1.0);
      vec3 h = hash32(vec2(id, 3.7));
      float seam = 1.0 - smoothstep(0.0, 0.0018, min(f, 1.0 - f) * w);
      // long grain: wavy vertical lines
      float gx = f + 0.08 * sin(uv.y * 9.0 + h.x * 6.0) + 0.05 * fbm(vec2(f, uv.y) + h.yz, vec2(4.0, 8.0), 3);
      float grain = pow(sin(gx * (14.0 + h.z * 10.0) * 3.14159) * 0.5 + 0.5, 3.0);
      float fine = vnoise(vec2(uv.x * 900.0, uv.y * 30.0), vec2(900.0, 30.0));
      vec3 wood = mix(vec3(0.54, 0.37, 0.22), vec3(0.64, 0.47, 0.3), h.x);
      wood = mix(wood, vec3(0.46, 0.3, 0.18), h.y * 0.3);
      vec3 col = wood * (0.88 + 0.12 * grain) * (0.94 + 0.08 * fine);
      // handling grime: darker, greasier band along the top edge and at hip height corners
      float topBand = smoothstep(0.82, 0.88, fract(uv.y));
      float grime = smoothstep(0.35, 0.85, fbm(uv * vec2(1.0, 2.0) + 3.0, vec2(4.0, 8.0), 4) * 0.5 + 0.5);
      col *= 1.0 - 0.35 * grime;
      col = mix(col, col * vec3(0.55, 0.42, 0.34), topBand * 0.6);
      // knocks & cleaver nicks
      float nick = smoothstep(0.86, 0.95, vnoise(uv * vec2(60.0, 120.0) + 7.0, vec2(60.0, 120.0)));
      col = mix(col, vec3(0.78, 0.62, 0.42), nick * 0.5);
      col = mix(col, col * 0.45, seam * 0.7);
      s.albedo = col;
      s.height = 0.6 - seam * 0.2 - nick * 0.15 + grain * 0.03;
      s.rough = 0.68 + grime * 0.15 - topBand * 0.15 + seam * 0.1;
      s.metal = 0.0;
      s.ao = 1.0 - seam * 0.4;
    }`,
  });
}

/** Scrubbed pine for the block's legs, aprons and pot board: bleached grain, grey dirt in the pores. 1 tile = 1 m. */
export function scrubbedPineTexture(forge, size = 1024) {
  return forge.generate('kitchen:scrubpine2', {
    size, normalStrength: 1.2,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 p = uv * vec2(1.0, 1.0);
      float w = fbm(vec2(p.x * 3.0, p.y * 0.4), vec2(3.0, 0.4), 4);
      float rings = sin((p.x * 40.0 + w * 6.0) * 3.14159) * 0.5 + 0.5;
      rings = pow(rings, 4.0);
      float pores = fbm(vec2(p.x * 1.0, p.y * 1.0) + 5.0, vec2(300.0, 12.0), 3) * 0.5 + 0.5;
      float dirt = smoothstep(0.4, 0.9, fbm(p * 3.0 + 9.0, vec2(3.0), 4) * 0.5 + 0.5);
      vec3 col = mix(vec3(0.66, 0.55, 0.4), vec3(0.5, 0.38, 0.25), rings * 0.7);
      col *= 0.9 + 0.1 * pores;
      col = mix(col, col * vec3(0.62, 0.6, 0.58), dirt * 0.6);
      // raised grain from scrubbing: latewood stands proud
      s.albedo = col;
      s.height = 0.5 + rings * 0.06 + pores * 0.01;
      s.rough = 0.72 + 0.12 * dirt - rings * 0.06;
      s.metal = 0.0;
      s.ao = 1.0 - dirt * 0.15;
    }`,
  });
}

/** Graphite-blacked cast iron: satin grey-black blacking, sand-cast grain, rubbed brighter iron, rust freckles. */
export function castIronTexture(forge, size = 1024) {
  return forge.generate('kitchen:castiron2', {
    size, normalStrength: 1.1,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float n = fbm(uv, vec2(6.0), 5) * 0.5 + 0.5;
      float fine = vnoise(uv * 700.0, vec2(700.0));
      float sand = vnoise(uv * 260.0 + 3.0, vec2(260.0));
      float rust = smoothstep(0.72, 0.88, fbm(uv + 7.0, vec2(10.0), 5) * 0.5 + 0.5);
      float rub = smoothstep(0.5, 0.8, fbm(uv + 2.0, vec2(5.0), 4) * 0.5 + 0.5);
      // blacking brushed on in strokes, thinner in places
      float strokeN = fbm(vec2(uv.x * 1.0, uv.y) + 9.0, vec2(30.0, 4.0), 3) * 0.5 + 0.5;
      vec3 col = vec3(0.16, 0.16, 0.17) * (0.8 + 0.35 * n) * (0.9 + 0.18 * sand) * (0.92 + 0.12 * strokeN);
      col = mix(col, vec3(0.36, 0.36, 0.37), rub * 0.45);
      col = mix(col, vec3(0.3, 0.14, 0.07) * (0.7 + 0.6 * fine), rust * 0.75);
      s.albedo = col;
      s.height = 0.5 + 0.1 * sand + 0.04 * fine + rust * 0.08;
      s.rough = mix(0.6, 0.42, rub) + rust * 0.3 + 0.06 * fine - 0.05 * strokeN;
      s.metal = mix(0.62, 0.15, rust) + rub * 0.2;
      s.ao = 1.0 - rust * 0.2;
    }`,
  });
}

/** Planished copper: overlapping hammer dimples (~12 mm), polish wipe, tarnish blooms (darker, duller), verdigris in the
 *  hollows. 1 tile = one third of a pan's circumference (repeat [3,1]). */
export function copperTexture(forge, size = 1024) {
  return forge.generate('kitchen:copper4', {
    size, normalStrength: 1.6,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec4 v = voronoi(uv * 22.0, vec2(22.0), 0.9);
      vec4 v2 = voronoi(uv * 41.0 + 3.0, vec2(41.0), 0.9);
      // each hammer blow is a shallow dish: lowest at the cell centre, a soft ridge where blows overlap
      float dimple = smoothstep(0.0, 0.75, v.x);
      float dimple2 = smoothstep(0.0, 0.75, v2.x);
      float tarn = fbm(uv + 4.0, vec2(4.0), 5) * 0.5 + 0.5;
      float tarnM = smoothstep(0.42, 0.82, tarn);
      float wipe = vnoise(vec2(uv.x * 160.0, uv.y * 3.0), vec2(160.0, 3.0));
      float verd = smoothstep(0.84, 0.95, fbm(uv + 13.0, vec2(12.0), 4) * 0.5 + 0.5) * tarnM * (0.4 + 0.6 * (1.0 - dimple));
      float finger = smoothstep(0.7, 0.9, fbm(uv + 29.0, vec2(9.0), 3) * 0.5 + 0.5);
      vec3 cu = vec3(0.95, 0.62, 0.5);
      vec3 col = mix(cu, vec3(0.55, 0.3, 0.22), tarnM * 0.75);
      col = mix(col, vec3(0.42, 0.24, 0.2), finger * 0.25);
      col *= 0.92 + 0.08 * wipe;
      col *= 0.95 + 0.06 * dimple;
      col = mix(col, vec3(0.28, 0.45, 0.37), verd * 0.85);
      s.albedo = col;
      s.height = 0.5 + dimple * 0.1 + dimple2 * 0.04;
      s.rough = 0.2 + 0.24 * tarnM + 0.05 * wipe + finger * 0.08 + verd * 0.5 + (1.0 - dimple) * 0.04;
      s.metal = mix(1.0, 0.0, verd);
      s.ao = 1.0 - tarnM * 0.3 - verd * 0.2;
    }`,
  });
}

/** Tinned interior of copper pans: bright wiped tin, worn through to copper in places, scorch and heat tint. */
export function tinLiningTexture(forge, size = 512) {
  return forge.generate('kitchen:tinlining2', {
    size, normalStrength: 0.5,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float n = fbm(uv, vec2(5.0), 4) * 0.5 + 0.5;
      // circular scouring wipes (u = around, v = up the profile)
      float wipe = vnoise(vec2(uv.x * 260.0, uv.y * 5.0), vec2(260.0, 5.0));
      float wipe2 = vnoise(vec2(uv.x * 40.0 + uv.y * 30.0, uv.y * 60.0), vec2(40.0, 60.0));
      float scorch = smoothstep(0.55, 0.85, fbm(uv + 3.0, vec2(3.0), 4) * 0.5 + 0.5);
      float worn = smoothstep(0.78, 0.86, fbm(uv + 9.0, vec2(8.0), 4) * 0.5 + 0.5);
      vec3 col = vec3(0.68, 0.68, 0.66) * (0.86 + 0.18 * n) * (0.94 + 0.06 * wipe);
      col = mix(col, vec3(0.42, 0.33, 0.24), scorch * 0.55);
      col = mix(col, vec3(0.5, 0.36, 0.42), scorch * smoothstep(0.4, 0.6, wipe2) * 0.25);   // heat tint
      col = mix(col, vec3(0.85, 0.55, 0.45), worn * 0.8);
      s.albedo = col;
      s.height = 0.5 + 0.03 * wipe - worn * 0.02;
      s.rough = 0.3 + 0.12 * n + 0.08 * wipe2 + scorch * 0.12;
      s.metal = 1.0 - scorch * 0.4;
      s.ao = 1.0;
    }`,
  });
}

/** Limewashed lime plaster: trowel undulation, multi-coat brush mottle, tide-marked water stains, hairline cracks. 1 tile = 2 m. */
export function limewashTexture(forge, { color = [0.3, 0.37, 0.44], stain = 1, lath = 0, size = 2048, key = 'wall' } = {}) {
  return forge.generate(`kitchen:limewash2:${key}`, {
    size, normalStrength: 3.2,
    uniforms: { uColor: color, uStain: stain, uLath: lath },
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float low = fbm(uv, vec2(3.0), 5) * 0.5 + 0.5;
      float mid = fbm(uv + 4.0, vec2(12.0), 4) * 0.5 + 0.5;
      float fine = vnoise(uv * 700.0, vec2(700.0));
      vec2 q = uv + 0.035 * vec2(fbm(uv + 9.0, vec2(5.0), 3), fbm(uv + 2.0, vec2(5.0), 3));
      float trowel = fbm(q + 1.3, vec2(10.0, 7.0), 4) * 0.5 + 0.5;
      // limewash is brushed on in criss-cross strokes; each coat dries patchy (chalky / translucent)
      float brushA = fbm(rot2(0.6) * uv * 1.0 + 5.0, vec2(30.0, 6.0), 3) * 0.5 + 0.5;
      float brushB = fbm(rot2(-0.7) * uv + 11.0, vec2(26.0, 5.0), 3) * 0.5 + 0.5;
      float brush = mix(brushA, brushB, smoothstep(0.3, 0.7, mid));
      float chalk = smoothstep(0.45, 0.85, fbm(uv + 71.0, vec2(7.0), 5) * 0.5 + 0.5);
      vec3 col = vec3(uColor) * (0.74 + 0.48 * low) * (0.88 + 0.22 * brush) * (0.95 + 0.07 * fine) * (0.9 + 0.18 * mid);
      col = mix(col, col * 1.18 + vec3(0.03, 0.035, 0.04), chalk * 0.35);             // chalky bloom
      // thinned limewash: an older, paler coat ghosting through
      float thin = smoothstep(0.62, 0.82, fbm(uv + 13.0, vec2(6.0), 5) * 0.5 + 0.5);
      col = mix(col, col * 0.62 + vec3(0.24, 0.24, 0.22), thin * 0.45);
      // flaking: the top coat has lifted in islands, showing the earlier schemes beneath:
      // a sage green, then an ochre distemper, then the bare grey-pink plaster
      float fl = fbm(uv + 51.0, vec2(14.0), 5) * 0.5 + 0.5;
      float gate = smoothstep(0.45, 0.75, low) * smoothstep(0.35, 0.65, fbm(uv + 17.0, vec2(4.0), 3) * 0.5 + 0.5);
      float f1 = smoothstep(0.66, 0.675, fl) * gate;       // top coat gone
      float f2 = smoothstep(0.71, 0.72, fl) * gate;        // green gone
      float f3 = smoothstep(0.76, 0.77, fl) * gate;        // ochre gone
      col = mix(col, vec3(0.34, 0.4, 0.33) * (0.85 + 0.25 * mid), f1);
      col = mix(col, vec3(0.56, 0.47, 0.3) * (0.85 + 0.25 * mid), f2);
      col = mix(col, vec3(0.5, 0.43, 0.39) * (0.8 + 0.3 * fine), f3);
      float flakeEdge = (smoothstep(0.645, 0.665, fl) - f1) * gate;                   // lifted lip, lighter
      col = mix(col, col * 1.25 + 0.03, flakeEdge * 0.6);
      // damp: big blotches with layered brown tide-marks (several drying fronts)
      float wn = fbm(uv + 21.0, vec2(3.0), 5) * 0.5 + 0.5 + 0.04 * (fbm(uv + 5.0, vec2(24.0), 3));
      float stainM = smoothstep(0.58, 0.72, wn) * uStain;
      float tide = (stroke(wn - 0.585, 0.0, 0.0035) + stroke(wn - 0.63, 0.0, 0.003) * 0.7 + stroke(wn - 0.67, 0.0, 0.0025) * 0.5) * uStain;
      col = mix(col, col * vec3(0.82, 0.76, 0.64), stainM * 0.55);
      col = mix(col, col * vec3(0.55, 0.45, 0.33), tide * 0.6);
      // salts: white efflorescence just inside the damp patches
      float salt = stroke(wn - 0.6, 0.0, 0.012) * smoothstep(0.55, 0.8, fine + mid * 0.5) * uStain;
      col = mix(col, vec3(0.72, 0.72, 0.68), salt * 0.25);
      // hairline cracks: warped voronoi edges, gated so they wander and stop. Mostly relief (normal-map
      // shading gives a lit lip and a shadowed lip), only a faint dirt line in the albedo
      vec2 cw = uv + 0.025 * vec2(fbm(uv + 3.0, vec2(9.0), 3), fbm(uv + 7.0, vec2(9.0), 3));
      float ve = voronoiEdge(cw * 4.0, vec2(4.0), 1.0);
      float cm = smoothstep(0.55, 0.72, fbm(uv + 31.0, vec2(4.0), 4) * 0.5 + 0.5);
      float crack = (1.0 - smoothstep(0.0, 0.0022, ve)) * cm;
      float ve2 = voronoiEdge(cw * 15.0 + 2.0, vec2(15.0), 1.0);
      float crack2 = (1.0 - smoothstep(0.0, 0.004, ve2)) * cm * smoothstep(0.65, 0.85, fbm(uv + 41.0, vec2(9.0), 3) * 0.5 + 0.5);
      crack = max(crack, crack2 * 0.7);
      float lip = (1.0 - smoothstep(0.0, 0.012, ve)) * cm;   // the plaster either side has stepped a hair
      col *= 1.0 - crack * 0.22;
      // lath ghosting (ceilings): faint horizontal ridges + rust-brown nail-head dots
      float lathL = uLath * (sin(uv.y * 6.2831 * 56.0) * 0.5 + 0.5);
      float nails = uLath * (1.0 - smoothstep(0.0, 0.08, length(fract(uv * vec2(5.0, 56.0)) - 0.5))) * step(0.6, hash12(floor(uv * vec2(5.0, 56.0))));
      col *= 1.0 - lathL * 0.06;
      col = mix(col, vec3(0.32, 0.2, 0.12), nails * 0.5);
      s.albedo = col;
      float side = step(0.5, fract(ve * 0.0 + hash12(floor(cw * 4.0)) ));
      s.height = 0.5 + 0.2 * trowel + 0.05 * mid + 0.01 * fine + 0.015 * brush - crack * 0.22 - lip * 0.02 * (side - 0.5)
               + lathL * 0.05 - thin * 0.02 - f1 * 0.025 - f2 * 0.012 - f3 * 0.012 + flakeEdge * 0.02;
      s.rough = 0.9 - 0.1 * trowel + stainM * 0.04 - chalk * 0.04;
      s.metal = 0.0;
      s.ao = 1.0 - crack * 0.35;
    }`,
  });
}

/** Adzed, smoke-blackened oak beams: grain along U, scalloped adze facets, drying checks. 1 tile = 1 m. */
export function adzedOakTexture(forge, size = 1024) {
  return forge.generate('kitchen:adzedoak', {
    size, normalStrength: 2.6,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float warp = fbm(uv + 3.0, vec2(2.0, 6.0), 4);
      float grain = fbm(vec2(uv.x, uv.y + warp * 0.05) + 1.0, vec2(3.0, 90.0), 4) * 0.5 + 0.5;
      float rings = sin((uv.y + warp * 0.04) * 6.2831 * 34.0) * 0.5 + 0.5;
      // adze scallops: shallow dished facets ~8 x 5 cm, staggered
      vec2 a = vec2(uv.x * 13.0, uv.y * 20.0);
      float row = floor(a.y);
      a.x += hash11(row * 3.1) * 0.9;
      vec2 f = fract(a) - 0.5;
      vec2 cid = floor(a);
      vec3 h = hash32(cid + 5.0);
      float dish = 1.0 - dot(f * vec2(1.6, 1.9), f * vec2(1.6, 1.9));
      float ridge = 1.0 - smoothstep(0.38, 0.5, max(abs(f.x) * 1.0, abs(f.y) * 0.9));
      // drying checks: long dark splits along the grain
      float chk = 1.0 - smoothstep(0.0, 0.004, abs(fract(uv.y * 3.0 + fbm(uv + 8.0, vec2(2.0, 3.0), 3) * 0.2) - 0.5) - 0.0);
      chk *= smoothstep(0.55, 0.8, fbm(vec2(uv.x * 2.0, uv.y) + 17.0, vec2(4.0, 3.0), 3) * 0.5 + 0.5);
      vec3 oak = mix(vec3(0.28, 0.2, 0.13), vec3(0.36, 0.26, 0.17), grain);
      oak *= 0.85 + 0.15 * rings;
      oak *= 0.9 + 0.12 * h.x;
      float soot = fbm(uv + 23.0, vec2(3.0), 4) * 0.5 + 0.5;
      oak = mix(oak, oak * 0.5, smoothstep(0.35, 0.8, soot) * 0.6);
      oak = mix(oak, oak * 1.25, (1.0 - ridge) * 0.25);
      oak *= 1.0 - chk * 0.7;
      s.albedo = oak;
      s.height = 0.5 + dish * 0.22 * (0.7 + 0.3 * h.y) + grain * 0.05 - chk * 0.3;
      s.rough = 0.72 + 0.1 * grain - (1.0 - ridge) * 0.08;
      s.metal = 0.0;
      s.ao = 1.0 - chk * 0.6;
    }`,
  });
}

/** Red quarry tiles, 0.3 m, hand-made: muted per-tile firing colour (one hue family, +-15% value), dished worn faces,
 *  chipped arrises, dark grimy grout. 1 tile = 2.4 m (8x8). */
export function quarryTileTexture(forge, size = 2048) {
  return forge.generate('kitchen:quarry2', {
    size, normalStrength: 2.2,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 g = uv * 8.0;
      vec2 id = floor(g);
      vec2 f = fract(g);
      vec3 h = hash32(mod(id, 8.0) + 11.0);
      vec3 h2 = hash32(mod(id, 8.0) * 1.7 + 3.0);
      vec2 dm = min(f, 1.0 - f) * 0.3;
      float edgeN = (fbm(uv + h.xy, vec2(48.0), 3) * 0.5 + 0.5) * 0.004;
      float de = min(dm.x, dm.y) - edgeN * 0.6;
      float grout = 1.0 - smoothstep(0.0028, 0.0042, de);
      float chipN = fbm(uv + h.z * 7.0, vec2(80.0), 3) * 0.5 + 0.5;
      float chip = smoothstep(0.6, 0.74, chipN) * (1.0 - smoothstep(0.0045, 0.018, de)) * step(0.4, h2.x);
      // fired colour: one muted terracotta family; value +-15% per tile, a few tiles a touch darker (max -20%)
      vec3 red = mix(vec3(0.40, 0.215, 0.155), vec3(0.355, 0.2, 0.15), h.x);
      red = mix(red, vec3(0.43, 0.27, 0.19), h2.y * 0.4);
      float lum = dot(red, vec3(0.3, 0.59, 0.11));
      red = mix(vec3(lum), red, 0.72);                       // ~30% less saturated than raw terracotta
      vec3 col = red * (0.85 + 0.3 * h.z);
      col *= mix(1.0, 0.82, step(0.9, h.y));
      // kiln flashing + body mottling (low contrast)
      float body = fbm(uv + h.xy * 9.0, vec2(16.0), 4) * 0.5 + 0.5;
      float body2 = fbm(uv * 1.0 + h.yz * 4.0, vec2(40.0), 3) * 0.5 + 0.5;
      float grit = vnoise(uv * 1100.0, vec2(1100.0));
      vec2 fc = f - 0.5;
      float flash = smoothstep(0.15, 0.75, length(fc + (h2.yz - 0.5) * 0.6));
      col *= (0.88 + 0.2 * body) * (0.95 + 0.07 * body2) * (0.95 + 0.07 * grit);
      col = mix(col, col * vec3(0.8, 0.74, 0.72), flash * 0.25);
      // salt bloom / efflorescence, soft
      float bloom = smoothstep(0.72, 0.95, fbm(uv + 33.0, vec2(10.0), 4) * 0.5 + 0.5);
      col = mix(col, vec3(0.5, 0.46, 0.42), bloom * 0.22);
      // worn dished faces: the middle of each tile is hollowed and polished, the arrises stand proud and dull
      float rc = length(fc * vec2(1.0 + 0.2 * h.x, 1.0 + 0.2 * h.y));
      float dish = smoothstep(0.5, 0.05, rc);
      float pits = smoothstep(0.8, 0.93, vnoise(uv * 300.0 + h.xy * 40.0, vec2(300.0)));
      col = mix(col, col * 0.62, pits * 0.4);
      col *= 1.0 - dish * 0.06;                              // traffic darkens the worn hollow slightly
      // chips expose paler fired body
      col = mix(col, vec3(0.46, 0.33, 0.25) * (0.85 + 0.25 * body), chip * 0.85);
      // grout: dark, greasy, grey-brown
      float gn = fbm(uv + 61.0, vec2(24.0), 3) * 0.5 + 0.5;
      vec3 groutC = mix(vec3(0.055, 0.05, 0.045), vec3(0.16, 0.15, 0.13), smoothstep(0.6, 0.9, gn) * 0.6);
      col = mix(col, groutC, grout);
      s.albedo = col;
      float roll = 1.0 - smoothstep(0.004, 0.02, de);        // rounded arrises
      s.height = mix(0.7 - dish * 0.11 - roll * roll * 0.12 + 0.025 * body - pits * 0.05 - chip * 0.22 + (h.z - 0.5) * 0.04, 0.12, grout);
      s.rough = mix(0.66 + 0.1 * h2.z + 0.06 * grit - 0.16 * dish + bloom * 0.12, 0.95, max(grout, chip));
      s.metal = 0.0;
      s.ao = mix(1.0, 0.4, grout) * (1.0 - pits * 0.25);
    }`,
  });
}

/** Scrubbed sycamore worktop: pale bleached boards along U (0.18 m), knife scoring, damp rings, raised grain. 1 tile = 1 m. */
export function sycamoreTexture(forge, size = 1024) {
  return forge.generate('kitchen:sycamore', {
    size, normalStrength: 1.4,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float b = uv.y * 5.5;
      float bid = floor(b);
      float bf = fract(b);
      vec3 h = hash32(vec2(bid, 3.0));
      float seam = 1.0 - smoothstep(0.0, 0.02, min(bf, 1.0 - bf));
      float grain = fbm(vec2(uv.x + h.x, uv.y * 1.0 + h.y) , vec2(4.0, 140.0), 4) * 0.5 + 0.5;
      float fleck = smoothstep(0.75, 0.9, vnoise(vec2(uv.x * 60.0, uv.y * 900.0) + h.xy * 30.0, vec2(60.0, 900.0)));
      vec3 wood = mix(vec3(0.6, 0.53, 0.41), vec3(0.67, 0.6, 0.47), h.z) * (0.88 + 0.16 * grain);
      wood = mix(wood, wood * 1.08, fleck * 0.4);
      // scrubbing bleaches the middle, edges stay darker
      float scrub = fbm(uv + 2.0, vec2(3.0), 4) * 0.5 + 0.5;
      wood = mix(wood, wood * 0.78, smoothstep(0.5, 0.85, scrub) * 0.5);
      // knife scoring
      float score = 0.0;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        vec2 q = rot2(fi * 0.9 + 0.3) * uv;
        float lane = q.y * (180.0 + fi * 50.0);
        float lid = floor(lane);
        float seg = step(0.86, hash12(vec2(lid, floor(q.x * 10.0 + hash11(lid) * 9.0)) + fi));
        score = max(score, (1.0 - smoothstep(0.0, 0.14, abs(fract(lane) - 0.5))) * seg);
      }
      // damp rings from wet pots and jugs
      float rings = 0.0;
      for (int i = 0; i < 4; i++) {
        vec2 c = hash22(vec2(float(i), 7.0));
        float r = 0.04 + 0.05 * hash11(float(i) * 3.3);
        rings = max(rings, stroke(length(uv - c) - r, 0.0, 0.004) * (0.4 + 0.6 * hash11(float(i) + 0.5)));
      }
      wood = mix(wood, wood * vec3(0.72, 0.68, 0.6), rings * 0.6);
      wood = mix(wood, vec3(0.82, 0.78, 0.68), score * 0.25);
      wood *= 1.0 - seam * 0.55;
      s.albedo = wood;
      s.height = 0.6 + grain * 0.05 - seam * 0.3 - score * 0.1 + rings * 0.02;
      s.rough = 0.72 + 0.12 * grain - rings * 0.15 + score * 0.1;
      s.metal = 0.0;
      s.ao = 1.0 - seam * 0.5;
    }`,
  });
}

/** Old door paint over pine: brushed oil paint, chips to wood and undercoat, grime. 1 tile = 1 m. */
export function doorPaintTexture(forge, { color = [0.11, 0.13, 0.12], size = 1024, key = 'door' } = {}) {
  return forge.generate(`kitchen:doorpaint:${key}`, {
    size, normalStrength: 1.6,
    uniforms: { uColor: color },
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float brush = fbm(uv + 3.0, vec2(5.0, 60.0), 4) * 0.5 + 0.5;
      float grainW = fbm(uv + 9.0, vec2(3.0, 40.0), 4) * 0.5 + 0.5;
      float n = fbm(uv, vec2(5.0), 4) * 0.5 + 0.5;
      float chipN = fbm(uv + 17.0, vec2(30.0), 4) * 0.5 + 0.5;
      float chip = smoothstep(0.76, 0.8, chipN);
      float under = smoothstep(0.72, 0.76, chipN);
      vec3 col = vec3(uColor) * (0.85 + 0.25 * n) * (0.94 + 0.1 * brush);
      col = mix(col, vec3(0.38, 0.33, 0.24), (under - chip) * 0.7);        // buff undercoat
      col = mix(col, vec3(0.3, 0.21, 0.13) * (0.8 + 0.4 * grainW), chip);   // bare pine
      float grime = smoothstep(0.4, 0.9, fbm(uv + 27.0, vec2(4.0), 4) * 0.5 + 0.5);
      col = mix(col, col * 0.7, grime * 0.4);
      s.albedo = col;
      s.height = 0.55 + 0.05 * brush + 0.03 * grainW - chip * 0.15 - (under - chip) * 0.05;
      s.rough = 0.48 + 0.15 * n + chip * 0.35 + grime * 0.1;
      s.metal = 0.0;
      s.ao = 1.0 - chip * 0.3;
    }`,
  });
}

/** Scuffed kick zone / boot marks for the bottom of doors (alpha decal). */
export function scuffTexture(forge, size = 512) {
  return forge.generate('kitchen:scuff', {
    size, tile: false, aspect: 2.5,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float n = fbm(uv * vec2(2.5, 1.0), vec2(6.0, 3.0), 5) * 0.5 + 0.5;
      float marks = 0.0;
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        vec2 c = vec2(hash11(fi * 1.7), 0.15 + 0.5 * hash11(fi * 3.1));
        vec2 d = (uv - c) * vec2(2.5, 1.0);
        d = rot2(hash11(fi) * 0.8 - 0.4) * d;
        marks = max(marks, (1.0 - smoothstep(0.0, 0.02, abs(d.y))) * (1.0 - smoothstep(0.03, 0.12, abs(d.x))));
      }
      float fade = smoothstep(0.85, 0.1, uv.y);
      s.albedo = mix(vec3(0.07, 0.06, 0.05), vec3(0.3, 0.24, 0.16), marks * 0.5);
      s.alpha = saturate((smoothstep(0.45, 0.85, n) * 0.55 + marks * 0.8) * fade);
      s.height = 0.5; s.rough = 0.85; s.metal = 0.0; s.ao = 1.0;
    }`,
  });
}

/** Tinplate for soup cans: brushed, scratched, wiped; roughness varies along the drawing marks. */
export function tinplateTexture(forge, size = 512) {
  return forge.generate('kitchen:tinplate2', {
    size, normalStrength: 0.35,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float brush = vnoise(vec2(uv.x * 400.0, uv.y * 6.0), vec2(400.0, 6.0));
      float n = fbm(uv, vec2(4.0), 4) * 0.5 + 0.5;
      float scr = 0.0;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        vec2 q = rot2(fi * 1.3 + 0.2) * uv;
        float lane = q.y * (120.0 + fi * 40.0);
        float seg = step(0.9, hash12(vec2(floor(lane), floor(q.x * 6.0)) + fi * 9.0));
        scr = max(scr, (1.0 - smoothstep(0.0, 0.1, abs(fract(lane) - 0.5))) * seg);
      }
      float dull = smoothstep(0.5, 0.85, fbm(uv + 5.0, vec2(6.0), 4) * 0.5 + 0.5);
      // greasy fingerprints & thumb smears (oval whorls)
      float smudge = 0.0;
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        vec2 c = vec2(hash11(fi * 7.1 + 1.0), hash11(fi * 3.3 + 2.0));
        vec2 d = uv - c; d -= floor(d + 0.5);
        d = rot2(fi) * d * vec2(1.0, 1.6);
        float r = length(d);
        float whorl = sin(r * 900.0 + atan(d.y, d.x) * 0.5) * 0.5 + 0.5;
        smudge = max(smudge, smoothstep(0.07, 0.03, r) * (0.5 + 0.5 * whorl));
      }
      // rust blooms (pinholes in the tin coat)
      float rustN = fbm(uv + 13.0, vec2(10.0), 4) * 0.5 + 0.5;
      float rust = smoothstep(0.74, 0.82, rustN) * smoothstep(0.6, 0.9, vnoise(uv * 80.0, vec2(80.0)));
      vec3 col = vec3(0.74, 0.73, 0.7) * (0.9 + 0.1 * brush) * (0.92 + 0.1 * n);
      col = mix(col, vec3(0.5, 0.47, 0.42), dull * 0.4);
      col = mix(col, col * vec3(0.86, 0.84, 0.8), smudge * 0.5);
      col = mix(col, vec3(0.36, 0.17, 0.07), rust);
      s.albedo = col;
      s.height = 0.5 + 0.02 * brush - scr * 0.05 + rust * 0.06;
      s.rough = 0.4 + 0.08 * brush + dull * 0.12 + scr * 0.08 + smudge * 0.16 + rust * 0.4;
      s.metal = 1.0 - rust;
      s.ao = 1.0;
    }`,
  });
}

const FOOT_GLSL = /* glsl */ `
    // a small bare foot (about 16 cm), toes toward +y, the big toe on the inside (-x for side = 1).
    // returns flour density 0..1 transferred by that foot (heel and ball press hardest, the arch barely touches)
    float footPrint(vec2 p, float side, float seed) {
      p.x *= side;
      p /= 0.185;
      float heel = sdEllipse(p - vec2(0.03, -0.36), vec2(0.13, 0.15));
      float ball = sdEllipse(p - vec2(-0.02, 0.1), vec2(0.18, 0.11));
      float outer = sdEllipse(p - vec2(0.11, -0.1), vec2(0.075, 0.24));   // outside edge of the sole
      float sole = min(min(heel, ball), outer);
      sole = smin(sole, outer, 0.05);
      float toes = 1e5;
      toes = min(toes, sdEllipse(p - vec2(-0.13, 0.33), vec2(0.06, 0.075)));
      toes = min(toes, sdCircle(p - vec2(-0.025, 0.36), 0.042));
      toes = min(toes, sdCircle(p - vec2(0.055, 0.335), 0.037));
      toes = min(toes, sdCircle(p - vec2(0.12, 0.3), 0.032));
      toes = min(toes, sdCircle(p - vec2(0.175, 0.255), 0.028));
      float press = 0.0;
      press = max(press, (1.0 - smoothstep(-0.01, 0.006, heel)) * (0.75 + 0.25 * smoothstep(0.0, -0.08, heel)));
      press = max(press, (1.0 - smoothstep(-0.01, 0.006, ball)) * (0.7 + 0.3 * smoothstep(0.0, -0.06, ball)));
      press = max(press, (1.0 - smoothstep(-0.01, 0.006, outer)) * 0.22);
      press = max(press, (1.0 - smoothstep(-0.008, 0.004, toes)) * 0.85);
      return press;
    }`;

/**
 * Flour on the floor, one decal over the whole room (world metres). Granular and sharp-edged:
 * a dense spill round the block and from the split sack, drifts packed into the tile joints
 * and against the block legs, the range kerb, the sacks and the skirting; broom scuffs and a
 * drag mark; the first bare footprints are pressed out of the spill (the trail continues on
 * its own high-resolution decal, flourPrintsTexture).
 */
export function flourDecalTexture(forge, { size = 2560, rect = [-3.2, 3.4, 6.4, 7.2], block = [0.2, -0.6], blockHalf = [0.7, 0.34], kerb = [-1.97, -0.63, -3.1], sack = [-1.1, -1.45], sacks = [], tile = [-3.2, 3.4, 0.3], trail = [[0.05, -0.62], [2.95, -1.2]] } = {}) {
  const S = sacks.slice(0, 4); while (S.length < 4) S.push([99, 99, 0.01]);
  return forge.generate('kitchen:flour11', {
    size, aspect: rect[2] / rect[3], tile: false, normalStrength: 1.6,
    uniforms: { uRect: rect, uBlock: [...block, ...blockHalf], uKerb: kerb, uSack: sack, uS0: S[0], uS1: S[1], uS2: S[2], uS3: S[3], uTile: tile, uP0: trail[0], uP1: trail[1] },
    glsl: /* glsl */ `
    ${FOOT_GLSL}
    // soft drift: full at the obstacle, fading over ~w (30-60 cm total falloff), lumpy along its length
    float drift(float d, float w, float n) { return exp(-max(d, 0.0) / w) * (0.55 + 0.6 * n); }
    float sackDrift(vec2 w, vec3 sk, float n) { vec2 q = w - sk.xy; float ang = atan(q.y, q.x); float d = length(q) - sk.z * (0.9 + 0.15 * sin(ang * 3.0 + sk.x * 7.0)); return exp(-max(d, 0.0) / 0.11) * (0.35 + 0.75 * n) * (0.45 + 0.55 * smoothstep(0.2, 0.8, sin(ang * 2.0 + sk.y * 5.0) * 0.5 + 0.5)); }
    void surface(vec2 uv, inout Surface s) {
      vec2 w = vec2(uRect.x + uv.x * uRect.z, uRect.y - uv.y * uRect.w);   // world x, z
      vec2 asp = vec2(uRect.z / uRect.w, 1.0);
      float n1 = fbm(uv, vec2(3.0), 6) * 0.5 + 0.5;            // ~2 m blotches
      float n2 = fbm(uv + 4.0, vec2(9.0), 5) * 0.5 + 0.5;      // ~70 cm
      float n3 = fbm(uv + 9.0, vec2(20.0), 4) * 0.5 + 0.5;     // ~30 cm
      float grain = vnoise(uv * 2400.0, vec2(2400.0));
      float grain2 = vnoise(uv * 700.0 + 3.0, vec2(700.0));
      // tile joints (8 mm): thin flour gets swept into them
      vec2 tg = vec2((w.x - uTile.x) / uTile.z, (uTile.y - w.y) / uTile.z);
      vec2 tf = fract(tg);
      float jd = min(min(tf.x, 1.0 - tf.x), min(tf.y, 1.0 - tf.y)) * uTile.z;
      float joint = 1.0 - smoothstep(0.003, 0.007, jd);
      // ---- density field (all low frequency, no hard edges)
      vec2 c = w - (uBlock.xy + vec2(-0.25, 0.04));
      float spill = exp(-dot(c * vec2(0.75, 1.1), c * vec2(0.75, 1.1)) * 1.9);
      float a = spill * (0.45 + 0.75 * n1) * (0.7 + 0.45 * n2);
      // under the pastry end of the block: a heavier fall where the dough is worked
      vec2 cp = w - (uBlock.xy + vec2(-0.45, 0.05));
      a = max(a, exp(-dot(cp * vec2(1.5, 2.0), cp * vec2(1.5, 2.0)) * 2.2) * (0.85 + 0.35 * n3));
      // split sack: a dense fan poured toward the block, piled at the mouth
      vec2 cs = w - uSack;
      vec2 fanDir = normalize(uBlock.xy - uSack);
      float along = dot(cs, fanDir), across = dot(cs, vec2(-fanDir.y, fanDir.x));
      float fan = smoothstep(1.0, 0.0, along) * smoothstep(-0.25, 0.05, along) * exp(-across * across / (0.02 + 0.09 * max(along, 0.0)));
      a = max(a, fan * (1.0 + 0.35 * n3) * (0.92 + 0.08 * sin(along * 40.0 + n3 * 5.0)));
      a = max(a, exp(-dot(cs, cs) / 0.03) * 1.3);
      // drifts piled against the block legs
      vec2 lq = abs(abs(w - uBlock.xy) - (uBlock.zw - 0.08));
      float legD = length(lq) - 0.05;
      a = max(a, drift(legD, 0.09, n3) * 0.95);
      // along the range kerb
      float kd = (w.y - uKerb.z) * step(uKerb.x, w.x) * step(w.x, uKerb.y) + 10.0 * (1.0 - step(uKerb.x, w.x) * step(w.x, uKerb.y));
      a = max(a, drift(kd, 0.1, n3 * n2 * 1.6) * 0.7);
      // round the sacks
      a = max(a, max(max(sackDrift(w, uS0, n3), sackDrift(w, uS1, n3)), max(sackDrift(w, uS2, n3), sackDrift(w, uS3, n3))) * 0.8);
      // along the skirting: gathered by the broom into the corners and edges, broken along its length
      float wallD = min(min(w.x - uRect.x, uRect.x + uRect.z - w.x), min(uRect.y - w.y, w.y - (uRect.y - uRect.w)));
      a = max(a, drift(wallD - 0.01, 0.08, n3) * smoothstep(0.4, 0.75, n2) * 0.7);
      // tracked thin dusting over the working half of the room
      float dust = smoothstep(0.5, 0.95, n1) * 0.22 * smoothstep(1.2, -1.6, w.y + w.x * 0.2) * (0.6 + 0.4 * n3);
      a = max(a, dust);
      // broom: soft arcs that thin the spill, a drag mark from the sack to the pantry
      vec2 bc = w - vec2(-0.6, 0.3);
      float br = length(bc);
      float stroke1 = sin(br * 22.0 + n2 * 3.0) * 0.5 + 0.5;
      float sweepZone = smoothstep(1.5, 1.0, br) * smoothstep(0.45, 0.8, br) * smoothstep(0.4, 0.7, n1);
      a *= 1.0 - sweepZone * 0.5 * stroke1;
      vec2 dg = w - vec2(-1.55, -1.25);
      float drag = exp(-pow(dot(dg, vec2(0.86, 0.5)) / 0.08, 2.0)) * smoothstep(0.55, 0.0, abs(dot(dg, vec2(-0.5, 0.86)) - 0.25));
      a *= 1.0 - drag * 0.7;
      // ---- coverage: a smooth ramp. dense flour (a > ~0.9) is opaque enough to bury the grout; thin flour is a
      // translucent veil whose fine grain only shows where it is thin; thin flour also lodges in the joints.
      float n4 = fbm(uv + 13.0, vec2(36.0), 4) * 0.5 + 0.5;     // ~15 cm clumping at the margins
      float n5 = fbm(uv + 23.0, vec2(110.0), 3) * 0.5 + 0.5;    // ~5 cm feathering
      // body: the spill proper, a fairly tight (2-4 cm) but ragged, feathered margin
      float edgeV = a * 1.1 + (n4 - 0.5) * 0.3 + (n5 - 0.5) * 0.12;
      float body = smoothstep(0.34, 0.5, edgeV);
      // powder: scattered grains and puffs thrown just beyond the margin, densest close to it
      float halo = smoothstep(0.12, 0.34, edgeV) * (1.0 - body);
      float puff = halo * smoothstep(0.55, 0.85, grain2 * 0.6 + n5 * 0.6) * 0.55 + halo * step(0.9, grain) * 0.4;
      // a thin dusting (tracked flour) as a fine grained veil, never a fog
      float dustV = smoothstep(0.08, 0.3, dust) * (0.25 + 0.5 * step(0.62, grain * grain2 * 1.5 + n5 * 0.3)) * 0.4;
      float cov = max(body * (0.86 + 0.14 * n5), max(puff, dustV));
      float thin = 1.0 - body;
      cov += joint * smoothstep(0.1, 0.32, edgeV) * thin * 0.22;
      float alpha = clamp(cov, 0.0, 1.0) * 0.92;
      // first footprints pressed out of the spill
      vec2 dir = normalize(uP1 - uP0);
      vec2 nrm = vec2(-dir.y, dir.x);
      float fpOut = 0.0;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float side = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
        vec2 base = uP0 + dir * (0.05 + fi * 0.21) + nrm * side * 0.055;
        vec2 q = w - base;
        float ang = side * 0.12 + (hash11(fi * 3.7) - 0.5) * 0.15;
        vec2 dr = rot2(ang) * dir;
        vec2 fs = vec2(dot(q, vec2(dr.y, -dr.x)), dot(q, dr));
        fpOut = max(fpOut, smoothstep(0.1, 0.5, footPrint(fs, side, fi)));
      }
      alpha *= 1.0 - fpOut * 0.75;
      s.albedo = vec3(0.86, 0.84, 0.78) * (0.9 + 0.1 * n2) * (0.93 + 0.07 * grain) * mix(1.0, 0.92, thin);
      s.alpha = saturate(alpha);
      // height: the drifts are soft mounds (shading from the density itself) with fine grain on top
      s.height = 0.3 + min(a, 1.4) * 0.3 * body + body * 0.05 + grain * 0.025 * cov + n5 * 0.04 * body - fpOut * 0.08 * cov;
      s.rough = 0.92 - grain * 0.06;
      s.metal = 0.0;
      s.ao = 1.0;
    }`,
  });
}

/** The trail of small bare footprints from the spill to the dumbwaiter: rect = [x0, z0, w, d] (z0 = max z). */
export function flourPrintsTexture(forge, { size = 2048, rect = [0.0, -0.3, 3.2, 1.2], trail = [[0.05, -0.62], [2.95, -1.2]], steps = 9 } = {}) {
  return forge.generate('kitchen:prints3', {
    size, aspect: rect[2] / rect[3], tile: false, normalStrength: 0.6,
    uniforms: { uRect: rect, uP0: trail[0], uP1: trail[1], uSteps: steps },
    glsl: /* glsl */ `
    ${FOOT_GLSL}
    void surface(vec2 uv, inout Surface s) {
      vec2 w = vec2(uRect.x + uv.x * uRect.z, uRect.y - uv.y * uRect.w);
      vec2 dir = normalize(uP1 - uP0);
      vec2 nrm = vec2(-dir.y, dir.x);
      float L = length(uP1 - uP0);
      float grain = vnoise(uv * vec2(uRect.z / uRect.w, 1.0) * 1600.0, vec2(1e4));
      float blot = fbm(uv * vec2(uRect.z / uRect.w, 1.0) * 6.0, vec2(1e4), 4) * 0.5 + 0.5;
      float fp = 0.0;
      for (int i = 3; i < 14; i++) {
        float fi = float(i);
        if (fi >= uSteps + 3.0) break;
        float t = (0.05 + fi * 0.21) / L;
        float side = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
        // a wandering line: drifts a little left, then right, as the child walks
        vec2 base = uP0 + dir * (0.05 + fi * 0.21) + nrm * (side * 0.055 + sin(t * 4.0) * 0.06 + (hash11(fi * 1.3) - 0.5) * 0.02);
        float ang = side * 0.12 + (hash11(fi * 3.7) - 0.5) * 0.18 + cos(t * 4.0) * 0.08;
        vec2 dr = rot2(ang) * dir;
        vec2 q = w - base;
        vec2 fs = vec2(dot(q, vec2(dr.y, -dr.x)), dot(q, dr));
        float fade = pow(1.0 - clamp((fi - 3.0) / (uSteps + 1.0), 0.0, 1.0), 1.3);
        float pr = footPrint(fs, side, fi);
        // flour runs out: patchy, grainy transfer, the heel first to go
        float patchy = smoothstep(0.15 + (1.0 - fade) * 0.35, 0.6, blot + pr * 0.25);
        fp = max(fp, pr * (0.35 + 0.65 * fade) * patchy);
      }
      float alpha = smoothstep(0.12, 0.45, fp) * smoothstep(0.2, 0.55, grain * 0.6 + fp * 0.6);
      s.albedo = vec3(0.8, 0.77, 0.7) * (0.92 + 0.08 * grain);
      s.alpha = saturate(alpha * 0.48);
      s.height = 0.5 + alpha * 0.2;
      s.rough = 0.92; s.metal = 0.0; s.ao = 1.0;
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

/** Hessian sacking: plain weave of irregular jute yarns (slubs, thin spots, hairy fibres). 1 tile = 64 x 64 yarns. */
export function sackTexture(forge, size = 1024) {
  return forge.generate('kitchen:sack2', {
    size, normalStrength: 1.4,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 g = uv * 64.0;
      vec2 id = floor(g), f = fract(g);
      // per-yarn thickness & tone (warp along x index, weft along y index)
      float warpW = 0.32 + 0.16 * hash11(mod(id.x, 64.0) * 1.37);
      float weftW = 0.3 + 0.18 * hash11(mod(id.y, 64.0) * 2.11 + 4.0);
      // slubs: yarn thickens along its length now and then
      warpW += 0.12 * smoothstep(0.6, 1.0, vnoise(vec2(id.x * 3.1, uv.y * 24.0), vec2(192.0, 24.0)));
      weftW += 0.12 * smoothstep(0.6, 1.0, vnoise(vec2(uv.x * 24.0, id.y * 3.1), vec2(24.0, 192.0)));
      float over = mod(id.x + id.y, 2.0);           // which yarn is on top in this cell
      float warp = smoothstep(warpW, warpW * 0.4, abs(f.x - 0.5));
      float weft = smoothstep(weftW, weftW * 0.4, abs(f.y - 0.5));
      float hw = warp * (0.55 + 0.45 * sin(f.y * 3.14159)) * mix(0.75, 1.0, over);
      float hf = weft * (0.55 + 0.45 * sin(f.x * 3.14159)) * mix(1.0, 0.75, over);
      float hgt = max(hw, hf);
      float gap = 1.0 - max(warp, weft);
      // twisted fibre striations along each yarn
      float fib = vnoise(vec2(over > 0.5 ? g.x * 6.0 + g.y * 2.0 : g.y * 6.0 + g.x * 2.0, 0.0) + id * 13.0, vec2(1e4));
      float hair = smoothstep(0.82, 1.0, vnoise(uv * 700.0, vec2(700.0)));
      float tone = 0.86 + 0.22 * hash11(mod(over > 0.5 ? id.x : id.y + 100.0, 164.0) * 0.731);
      vec3 jute = vec3(0.53, 0.42, 0.27) * tone * (0.82 + 0.25 * fib);
      vec3 col = mix(jute, vec3(0.12, 0.09, 0.06), gap * 0.85);
      col = mix(col, vec3(0.72, 0.62, 0.45), hair * 0.4);
      s.albedo = col;
      s.height = 0.25 + 0.6 * hgt + 0.05 * fib;
      s.rough = 0.92; s.metal = 0.0; s.ao = mix(1.0, 0.55, gap);
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

/** Fine flour grain for heaps: soft granular relief and tiny clumps. 1 tile = 0.25 m (uv = 4/m). */
export function flourGrainTexture(forge, size = 512) {
  return forge.generate('kitchen:flourgrain2', {
    size, normalStrength: 1.4,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      float g1 = vnoise(uv * 220.0, vec2(220.0));
      float g2 = vnoise(uv * 90.0 + 3.0, vec2(90.0));
      float clump = smoothstep(0.7, 0.9, vnoise(uv * 40.0 + 7.0, vec2(40.0)));
      float n = fbm(uv, vec2(6.0), 4) * 0.5 + 0.5;
      s.albedo = vec3(0.8, 0.785, 0.74) * (0.94 + 0.06 * g1) * (0.96 + 0.05 * n) * (1.0 - clump * 0.04);
      s.height = 0.5 + 0.15 * g1 + 0.2 * g2 + clump * 0.25 + 0.1 * n;
      s.rough = 0.9 + 0.08 * g1; s.metal = 0.0; s.ao = 1.0 - clump * 0.1;
    }`,
  });
}

/** Ceiling boards between the beams: adzed pine boards running along V (≈16 cm wide, random lengths, butt joints),
 *  limewashed once long ago and smoked brown since. 1 tile = 2 m. */
export function ceilingBoardTexture(forge, size = 2048) {
  return forge.generate('kitchen:ceilboards', {
    size, normalStrength: 2.4,
    glsl: /* glsl */ `
    void surface(vec2 uv, inout Surface s) {
      vec2 m = uv * 2.0;                           // metres
      float bw = 0.16;
      float bx = m.x / bw;
      float bid = floor(bx), bf = fract(bx);
      vec3 h = hash32(vec2(mod(bid, 12.5), 2.0));
      // butt joints at random lengths along each board
      float L = 0.9 + h.x * 1.1;
      float by = (m.y + h.y * 3.0) / L;
      float jid = floor(by), jf = fract(by);
      vec3 h2 = hash32(vec2(bid, jid) + 5.0);
      float gap = 1.0 - smoothstep(0.0, 0.004, min(bf, 1.0 - bf) * bw);
      float butt = 1.0 - smoothstep(0.0, 0.003, min(jf, 1.0 - jf) * L);
      // grain along the board, adze scallops across it
      float grain = fbm(vec2(bf * 3.0 + h.z * 9.0, m.y * 0.6), vec2(3.0, 1.2), 4) * 0.5 + 0.5;
      float rings = sin((bf * 8.0 + grain * 3.0) * 3.14159) * 0.5 + 0.5;
      float adze = sin(m.y * 34.0 + h2.x * 6.0 + sin(bf * 3.0) * 0.6) * 0.5 + 0.5;
      // old limewash surviving in the hollows, smoke over everything
      float lime = smoothstep(0.5, 0.8, fbm(m * 1.5 + h.xy * 7.0, vec2(3.0), 4) * 0.5 + 0.5) * (1.0 - adze * 0.6);
      vec3 wood = mix(vec3(0.3, 0.21, 0.14), vec3(0.38, 0.28, 0.18), h2.y) * (0.85 + 0.15 * rings) * (0.92 + 0.12 * grain);
      vec3 col = mix(wood, vec3(0.52, 0.48, 0.4), lime * 0.55);
      float smoke = fbm(m * 0.7 + 3.0, vec2(1.4), 4) * 0.5 + 0.5;
      col *= 0.72 + 0.28 * smoke;
      col = mix(col, vec3(0.03, 0.025, 0.02), max(gap, butt) * 0.9);
      // nail heads at each joist line
      float nails = (1.0 - smoothstep(0.0, 0.006, length(vec2((bf - 0.5) * bw * 0.0 + (fract(bf * 2.0) - 0.5) * bw * 0.5, (fract(m.y / 0.6) - 0.5) * 0.6)))) ;
      col = mix(col, vec3(0.12, 0.08, 0.06), nails * 0.8);
      s.albedo = col;
      s.height = 0.55 + adze * 0.08 + grain * 0.03 - max(gap, butt) * 0.4 + (h2.z - 0.5) * 0.04;
      s.rough = 0.82 + 0.1 * grain - lime * 0.05;
      s.metal = 0.0;
      s.ao = 1.0 - max(gap, butt) * 0.6;
    }`,
  });
}
