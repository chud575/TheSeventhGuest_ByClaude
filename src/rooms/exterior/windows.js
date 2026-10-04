import * as THREE from 'three';
import { mat4, bevelBox } from './lib.js';

/**
 * Victorian window kit. Windows are built from trim parts merged into the
 * mansion's geometry buckets (trim + sash materials); the glass panes are
 * collected into two instanced meshes (square-headed, round-headed) whose
 * per-instance colour drives a warm interior glow (lamp-lit rooms with drawn
 * curtains) or leaves them dark and mirror-like, reflecting the moonlit sky.
 */

let _bracket = null;
/** Scroll console bracket (side profile extruded), origin at top-back, faces +z, hangs down. */
export function bracketGeometry() {
  if (_bracket) return _bracket;
  const s = new THREE.Shape();
  // profile in (z out from wall, y down) -> we draw in x=z, y=y
  s.moveTo(0, 0);
  s.lineTo(0.30, 0);
  s.lineTo(0.30, -0.05);
  s.bezierCurveTo(0.27, -0.06, 0.22, -0.05, 0.18, -0.09);
  s.bezierCurveTo(0.12, -0.15, 0.16, -0.24, 0.1, -0.3);
  s.bezierCurveTo(0.07, -0.34, 0.03, -0.38, 0.05, -0.43);
  s.bezierCurveTo(0.06, -0.47, 0.02, -0.5, 0.0, -0.5);
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 5 });
  g.translate(0, 0, -0.045);
  g.rotateY(-Math.PI / 2); // extrude axis -> x, profile x -> z
  _bracket = g;
  return g;
}

/** Segmental / round arch band shape geometry (in XY), extruded along +z by depth. */
export function archBand(span, rise, thick, depth, segs = 20) {
  // circle through (-span/2,0), (span/2,0), (0,rise)
  const R = (span * span / 4 + rise * rise) / (2 * rise);
  const cy = rise - R;
  const a0 = Math.atan2(-cy, span / 2);
  const s = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (Math.PI - 2 * a0) * (i / segs);
    const x = Math.cos(a) * (R + thick), y = cy + Math.sin(a) * (R + thick);
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  for (let i = segs; i >= 0; i--) {
    const a = a0 + (Math.PI - 2 * a0) * (i / segs);
    s.lineTo(Math.cos(a) * R, cy + Math.sin(a) * R);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: segs });
  return g;
}

/** Spandrel fill (rect with a semicircular hole at the top) for round-headed openings. */
function halfDisc(r, segs = 20) {
  const s = new THREE.Shape();
  s.moveTo(-r, 0);
  for (let i = 0; i <= segs; i++) { const a = Math.PI - Math.PI * (i / segs); s.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  s.lineTo(-r, 0);
  return new THREE.ShapeGeometry(s, segs);
}

export class WindowKit {
  constructor({ bucket, trim, sash, stone }) {
    this.bucket = bucket; this.trim = trim; this.sash = sash; this.stone = stone || trim;
    this.glassRect = []; // { matrix, lit }
    this.glassRound = [];
    this.shapes = [];
    this.streaks = [];   // { matrix } unit quads (rain-run decals under sills)
    this.lit = [];       // { pos: Vector3, normal: Vector3, lit, tint } for spill lights
  }

  /** Rain-streak decal: quad of width w, height h hanging down from (local) top centre. */
  streak(matrix, w, h, seed = 0) { this.streaks.push({ matrix: matrix.clone().multiply(mat4(0, -h / 2, 0, 0, 0, 0, w, h, 1)), seed }); }

  /** Arbitrary glass shape (oculus, fanlight): geometry in XY with 0..1 UVs. */
  shape(geo, matrix, lit = 0) { this.shapes.push({ geo, matrix, lit }); }

  /**
   * Add a window. (x,y,z) = bottom centre of the opening on the wall plane, ry = facing.
   * type: 'flat' (cornice hood on brackets), 'seg' (segmental arched hood + keystone),
   *       'round' (round-headed opening), 'plain'. lit: 0..1 interior glow level.
   */
  add({ x, y, z, ry = 0, w = 1.1, h = 2.4, type = 'flat', lit = 0, tint = 0, shutters = false, panes = 2, streak = true, flicker = 0, hanging = false }) {
    const B = this.bucket, T = this.trim, S = this.sash;
    const base = mat4(x, y, z, 0, ry, 0);
    const put = (geo, mat, lx, ly, lz) => B.add(geo, mat, base.clone().multiply(mat4(lx, ly, lz)), { uvScale: 1 });
    const box = (mat, bw, bh, bd, lx, ly, lz) => put(bevelBox(bw, bh, bd, 0.015), mat, lx, ly, lz);
    const cw = 0.13, cd = 0.07;
    const round = type === 'round';
    const hs = round ? h - w / 2 : h;          // springline height
    // casing
    box(T, cw, hs + (round ? 0 : cw), cd, -(w / 2 + cw / 2), (hs + (round ? 0 : cw)) / 2, cd / 2);
    box(T, cw, hs + (round ? 0 : cw), cd, (w / 2 + cw / 2), (hs + (round ? 0 : cw)) / 2, cd / 2);
    if (!round) box(T, w + cw * 2, cw, cd, 0, h + cw / 2, cd / 2);
    else {
      const ring = archBand(w, w / 2, cw, cd, 24);
      put(ring, T, 0, hs, 0);
      // keystone
      const ks = new THREE.BoxGeometry(0.16, 0.26, cd + 0.05);
      put(ks, T, 0, h + 0.05, (cd + 0.05) / 2);
    }
    // back-band: a proud outer bead round the casing (stepped profile -> a crisp shadow line)
    {
      const bb = 0.045, bdp = cd + 0.045, ht = hs + (round ? 0 : cw + bb);
      for (const sx of [-1, 1]) box(T, bb, ht, bdp, sx * (w / 2 + cw + bb / 2), ht / 2, bdp / 2);
      if (!round) box(T, w + (cw + bb) * 2, bb, bdp, 0, h + cw + bb / 2, bdp / 2);
      // inner stop bead against the sash
      for (const sx of [-1, 1]) box(T, 0.025, hs, 0.03, sx * (w / 2 - 0.0125), hs / 2, 0.05);
    }
    // sill + apron + little corbels
    box(T, w + 0.38, 0.075, 0.2, 0, -0.04, 0.1);
    box(T, w + 0.06, 0.16, 0.035, 0, -0.16, 0.018);
    for (const sx of [-1, 1]) box(T, 0.09, 0.14, 0.12, sx * (w / 2 + 0.06), -0.14, 0.06);
    // hoods
    if (type === 'flat') {
      box(T, w + 0.34, 0.26, 0.09, 0, h + cw + 0.13, 0.045);           // frieze
      box(T, w + 0.6, 0.06, 0.28, 0, h + cw + 0.29, 0.14);             // cornice soffit
      box(T, w + 0.66, 0.08, 0.31, 0, h + cw + 0.36, 0.155);           // cornice
      box(T, w + 0.5, 0.05, 0.22, 0, h + cw + 0.425, 0.11);            // cap
      const br = bracketGeometry();
      for (const sx of [-1, 1]) put(br.clone().scale(0.75, 0.65, 0.75), T, sx * (w / 2 + 0.1), h + cw + 0.26, 0.0);
    } else if (type === 'seg') {
      const band = archBand(w + 0.42, 0.3, 0.16, 0.1, 18);
      put(band, T, 0, h + 0.06, 0);
      box(T, 0.2, 0.34, 0.16, 0, h + 0.28, 0.08); // keystone
      for (const sx of [-1, 1]) box(T, 0.24, 0.1, 0.12, sx * (w / 2 + 0.17), h + 0.08, 0.06); // imposts
    }
    // sash bars (dark paint)
    const sd = 0.045, sz = 0.03;
    box(S, w, 0.06, sd, 0, 0.03, sz);
    box(S, 0.055, hs, sd, -w / 2 + 0.0275, hs / 2, sz);
    box(S, 0.055, hs, sd, w / 2 - 0.0275, hs / 2, sz);
    if (!round) box(S, w, 0.06, sd, 0, h - 0.03, sz);
    else put(archBand(w - 0.11, (w - 0.11) / 2, 0.055, sd, 20), S, 0, hs, sz - sd / 2);
    box(S, w, 0.055, sd + 0.01, 0, hs * 0.5, sz + 0.005);                // meeting rail
    if (panes >= 2) box(S, 0.032, round ? h - 0.04 : h, sd * 0.8, 0, (round ? h - 0.04 : h) / 2, sz);
    if (panes >= 3) for (const fy of [0.25, 0.75]) box(S, w, 0.03, sd * 0.8, 0, hs * fy, sz);
    // shutters (louvred, slightly ajar)
    if (shutters) {
      for (const sx of [-1, 1]) {
        const sw = w / 2 + 0.05;
        let sm = base.clone().multiply(mat4(sx * (w / 2 + cw + sw / 2 + 0.01), 0, 0.05, 0, sx * -0.18, 0));
        if (hanging === sx) {
          // the lower hinge has rusted through: the shutter hangs off its top inner corner,
          // swung out from the wall and dropped askew
          const px = -sx * sw / 2, py = hs;
          sm = base.clone().multiply(mat4(sx * (w / 2 + cw + sw / 2 + 0.01), 0, 0.05))
            .multiply(mat4(px, py, 0)).multiply(mat4(0, 0, 0, 0.1, -sx * 0.75, -sx * 0.32)).multiply(mat4(-px, -py - 0.08, 0));
        }
        const add = (g, lx, ly, lz) => B.add(g, S, sm.clone().multiply(mat4(lx, ly, lz)), { uvScale: 1 });
        add(new THREE.BoxGeometry(sw, 0.07, 0.04), 0, 0.035, 0);
        add(new THREE.BoxGeometry(sw, 0.07, 0.04), 0, hs - 0.035, 0);
        add(new THREE.BoxGeometry(0.06, hs, 0.04), -sw / 2 + 0.03, hs / 2, 0);
        add(new THREE.BoxGeometry(0.06, hs, 0.04), sw / 2 - 0.03, hs / 2, 0);
        add(new THREE.BoxGeometry(sw, 0.05, 0.04), 0, hs * 0.5, 0);
        const n = Math.floor(hs / 0.07);
        for (let i = 1; i < n; i++) {
          if (Math.abs(i * 0.07 - hs * 0.5) < 0.04) continue;
          B.add(new THREE.BoxGeometry(sw - 0.1, 0.055, 0.012), S, sm.clone().multiply(mat4(0, i * 0.07, 0, -0.6, 0, 0)), { uvScale: 1 });
        }
      }
    }
    // glass (instanced later)
    const gm = base.clone().multiply(mat4(0, round ? h / 2 : h / 2, 0.012, 0, 0, 0, w, h, 1));
    (round ? this.glassRound : this.glassRect).push({ matrix: gm, lit, tint, flicker });
    if (streak) this.streak(base.clone().multiply(mat4(0, -0.22, 0.004)), w + 0.5, 1.3 + Math.abs(Math.sin(x * 3.1 + z)) * 0.9, x + z);
    if (lit > 0) {
      const pos = new THREE.Vector3(0, h * 0.5, 0.6).applyMatrix4(base);
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(base);
      this.lit.push({ pos, normal, lit, tint, sill: new THREE.Vector3(0, 0, 0).applyMatrix4(base) });
    }
  }

  /** Build the two instanced glass meshes (+ the streak decals). */
  buildGlass(parent, ctx) {
    const tex = interiorTexture(ctx, false);
    const texR = interiorTexture(ctx, true);
    const curt = curtainTexture(ctx);
    const flick = [];
    const colorFor = (g, c) => {
      if (g.lit > 0) {
        // colour temperature: tint 0 = oil lamp, 0.4 = gas mantle, 1 = candle
        const t = g.tint;
        if (t >= 1.5) c.setRGB(1.0, 0.27, 0.1);          // deep red: lamp behind a crimson curtain
        else if (t >= 0.9) c.setRGB(1.0, 0.46, 0.15);     // candle
        else c.setRGB(1.0, 0.56 + t * 0.3, 0.26 + t * 0.35);
        c.multiplyScalar(g.lit * 5.6);
      } else c.setRGB(0, 0, 0);
      return c;
    };
    const make = (list, map, name) => {
      if (!list.length) return null;
      const geo = new THREE.PlaneGeometry(1, 1);
      const mat = glassMaterial(map, curt);
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      const c = new THREE.Color();
      list.forEach((g, i) => {
        m.setMatrixAt(i, g.matrix);
        m.setColorAt(i, colorFor(g, c));
        if (g.flicker) flick.push({ mesh: m, i, g, base: colorFor(g, new THREE.Color()) });
      });
      m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
      m.castShadow = false; m.receiveShadow = false;
      m.name = name;
      m.userData.list = list;
      m.computeBoundingSphere();
      parent.add(m);
      return m;
    };
    const shapes = this.shapes.map((s, i) => {
      const mat = glassMaterial(tex, curt, true);
      mat.emissive.setRGB(1.0, 0.58, 0.26).multiplyScalar(s.lit * 3.2);
      const m = new THREE.Mesh(s.geo, mat);
      m.applyMatrix4(s.matrix);
      m.name = `glassShape${i}`;
      parent.add(m);
      return m;
    });
    // rain-streak decals
    let streaks = null;
    if (this.streaks.length) {
      const sm = new THREE.MeshStandardMaterial({ color: 0x050605, map: streakTexture(ctx), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, name: 'rainStreaks' });
      const g = new THREE.PlaneGeometry(1, 1);
      streaks = new THREE.InstancedMesh(g, sm, this.streaks.length);
      this.streaks.forEach((st, i) => streaks.setMatrixAt(i, st.matrix));
      streaks.instanceMatrix.needsUpdate = true;
      streaks.receiveShadow = true; streaks.castShadow = false;
      streaks.name = 'rainStreaks';
      streaks.renderOrder = 2;
      streaks.computeBoundingSphere();
      parent.add(streaks);
    }
    const c = new THREE.Color();
    const update = (t) => {
      for (const f of flick) {
        const k = 0.82 + 0.1 * Math.sin(t * 11.0 + f.i) * Math.sin(t * 5.3 + f.i * 2.0) + 0.08 * Math.sin(t * 23.0 + f.i * 0.7);
        c.copy(f.base).multiplyScalar(k);
        f.mesh.setColorAt(f.i, c);
        f.mesh.instanceColor.needsUpdate = true;
      }
    };
    return { rect: make(this.glassRect, tex, 'glassRect'), round: make(this.glassRound, texR, 'glassRound'), shapes, streaks, lit: this.lit, update };
  }
}

/**
 * Glass: slightly rough, grimy pane reflecting the sky over an interior-mapped room.
 * The instanced plane is the window opening (local x,y in -0.5..0.5); behind it a
 * box room (wider than the window, floor below the sill) is ray-cast per pixel:
 * papered back wall with a picture and a doorway, side walls, floorboards, a ceiling
 * and a lamp whose warm pool falls off with distance. Drawn velvet curtains and a lace
 * sheer hang just behind the glass (texture with alpha). Instance colour = lamp
 * colour x intensity (black = unlit room, the glass just reflects).
 */
export function glassMaterial(alphaMap, curtainMap, flat = false) {
  const m = new THREE.MeshStandardMaterial({
    color: 0x080a0d, roughness: 0.16, metalness: 0.0, emissive: 0xffffff,
    envMapIntensity: 1.8, alphaTest: 0.5, map: null, name: 'windowGlass',
  });
  m.alphaMap = alphaMap;
  m.emissiveMap = curtainMap;   // sampled manually (curtain layer), declared so the uv varying exists
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vIntPos; varying vec3 vIntDir; varying vec2 vIntScale; varying float vIntSeed;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
{
#ifdef USE_INSTANCING
  mat4 im = modelMatrix * instanceMatrix;
#else
  mat4 im = modelMatrix;
#endif
  vec3 camL = (inverse(im) * vec4(cameraPosition, 1.0)).xyz;
  vIntPos = position;
  vIntDir = position - camL;
  vIntScale = vec2(length(im[0].xyz), length(im[1].xyz));
  vIntSeed = fract(dot(im[3].xyz, vec3(0.137, 0.713, 0.371)) * 7.31);
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <emissivemap_pars_fragment>', `#include <emissivemap_pars_fragment>
varying vec3 vIntPos; varying vec3 vIntDir; varying vec2 vIntScale; varying float vIntSeed;
float ihash(float n) { return fract(sin(n) * 43758.5453); }
vec3 interiorRoom(vec3 ro, vec3 rd, vec2 sc, float seed, out float curtA, out vec3 curtC) {
  // room box in window-local units: x,y scaled by the opening; z in metres
  float D = 3.2 + seed * 1.6;
  float xw = 1.7 + seed * 0.6;
  float yf = -0.5 - 0.85 / sc.y, yc = 0.5 + 0.75 / sc.y;
  float tx = ((rd.x > 0.0 ? xw : -xw) - ro.x) / rd.x;
  float ty = ((rd.y > 0.0 ? yc : yf) - ro.y) / rd.y;
  float tz = (-D - ro.z) / rd.z;
  float t = min(min(tx, ty), tz);
  vec3 hp = ro + rd * t;
  vec3 m = vec3(hp.x * sc.x, hp.y * sc.y, hp.z);          // metres
  float fy = (hp.y - yf) * sc.y;                             // height above floor (m)
  // lamp: on a table, off to one side, part way back
  vec3 L = vec3((seed > 0.5 ? 0.9 : -0.8) * sc.x, (yf * sc.y) + 0.95, -D * 0.45);
  float dl = length(m - L);
  float lamp = 1.0 / (1.0 + dl * dl * 0.55);
  vec3 col;
  if (t == tz) {
    // back wall: striped paper, dado, a picture and a dark doorway
    float stripe = 0.85 + 0.15 * step(0.5, fract(m.x * 3.2));
    vec3 paper = mix(vec3(0.42, 0.2, 0.1), vec3(0.3, 0.22, 0.12), seed) * stripe;
    paper = mix(paper, vec3(0.16, 0.08, 0.04), step(fy, 0.9));
    float pic = step(abs(m.x - (seed - 0.5) * 1.4), 0.38) * step(abs(fy - 1.75), 0.3);
    float frame = pic * (1.0 - step(abs(m.x - (seed - 0.5) * 1.4), 0.31) * step(abs(fy - 1.75), 0.23));
    paper = mix(paper, vec3(0.05, 0.035, 0.02), pic);
    paper = mix(paper, vec3(0.55, 0.36, 0.12), frame);
    float door = step(abs(m.x + (seed - 0.5) * 2.6 - 0.2), 0.45) * step(fy, 2.2);
    paper = mix(paper, vec3(0.012, 0.008, 0.006), door * step(0.35, seed));
    col = paper;
  } else if (t == ty) {
    if (rd.y < 0.0) { // floorboards + rug
      float b = 0.8 + 0.2 * ihash(floor(m.x * 6.0));
      col = vec3(0.16, 0.08, 0.04) * b;
      float rug = step(abs(m.x), 0.9 * sc.x) * step(abs(m.z + D * 0.5), D * 0.3);
      col = mix(col, vec3(0.32, 0.07, 0.05), rug);
    } else {
      col = vec3(0.35, 0.3, 0.24) * (0.6 + 0.4 * lamp);   // ceiling
    }
  } else {
    // side walls: paper, darker
    col = vec3(0.3, 0.15, 0.08) * (0.85 + 0.15 * step(0.5, fract(m.z * 3.2)));
  }
  // furniture silhouette: a high-backed chair and a table shape against the light
  vec3 lit = col * (0.05 + lamp * 1.25);
  // the lamp itself (shade glow)
  vec3 rp = ro + rd * ((L.z - ro.z) / rd.z);
  vec2 lq = vec2(rp.x * sc.x - L.x, rp.y * sc.y - (L.y + 0.18));
  float shade = smoothstep(0.16, 0.12, length(lq * vec2(1.0, 1.6)));
  lit = mix(lit, vec3(2.2, 1.4, 0.75), shade * step(L.z, ro.z) * step(0.5, sc.x));   // (no lamp in the narrow sidelights)
  // curtain layer just behind the glass
  vec3 cp = ro + rd * ((-0.07 - ro.z) / rd.z);
  vec4 cu = texture2D(emissiveMap, cp.xy + 0.5);
  curtA = cu.a * step(abs(cp.x), 0.5) * step(abs(cp.y), 0.5);
  curtC = cu.rgb;
  return lit;
}`)
      .replace('#include <alphamap_fragment>', '#ifdef USE_ALPHAMAP\n diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).a;\n#endif')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  reflectedLight.directSpecular *= 0.05;
  reflectedLight.indirectSpecular *= 1.0 - holeM;
  reflectedLight.indirectDiffuse *= 1.0 - holeM;
  reflectedLight.indirectSpecular *= 1.0 + crackM * 2.5;`)
      .replace('#include <emissivemap_fragment>', `
  float holeM = 0.0, crackM = 0.0;
#if defined( USE_INSTANCING_COLOR )
  {
    // a few dark (unlit) windows have a broken pane: a jagged black hole with cracks
    float hs1 = fract(vIntSeed * 13.7), hs2 = fract(vIntSeed * 41.3), hs3 = fract(vIntSeed * 7.9);
    if (hs1 > 0.72 && dot(vColor.rgb, vec3(1.0)) < 0.01) {
      vec2 c = vec2((hs2 - 0.5) * 0.45, (hs3 > 0.5 ? 0.22 : -0.25) + (hs3 - 0.5) * 0.12);
      vec2 q = (vIntPos.xy - c) * vIntScale;
      float th = atan(q.y, q.x);
      float seg = floor((th + 3.14159) / 6.28318 * 9.0);
      float rr = (0.07 + 0.16 * ihash(seg + vIntSeed * 31.0)) * (0.8 + 0.4 * hs2);
      float rl = length(q);
      holeM = 1.0 - smoothstep(rr - 0.004, rr + 0.004, rl * (1.0 + 0.25 * sin(th * 7.0 + hs1 * 20.0)));
      float ray = abs(fract((th + 3.14159) / 6.28318 * 9.0 + 0.5 * ihash(seg)) - 0.5);
      crackM = (1.0 - smoothstep(0.0, 0.012 / max(rl, 0.05), ray)) * smoothstep(rr * 2.6, rr, rl) * (1.0 - holeM);
    }
  }
#endif
  {
    float cA; vec3 cC;
    vec3 rd = normalize(vIntDir);
    vec3 room = ${flat ? 'vec3(1.0, 0.62, 0.3) * (0.35 + 0.9 * smoothstep(0.55, 0.0, length(vIntPos.xy - vec2(0.0, -0.05)))); cA = 0.0; cC = vec3(0.0);' : 'interiorRoom(vIntPos, rd, vIntScale, vIntSeed, cA, cC);'}
    // curtains: lit from behind (translucent velvet / lace)
    vec3 curtLit = cC * (0.25 + 0.45 * (1.0 - cA));
    vec3 e = mix(room, curtLit, cA);
    totalEmissiveRadiance = e * (1.0 - holeM);
#if defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR )
    totalEmissiveRadiance *= vColor.rgb;
#else
    totalEmissiveRadiance *= emissive;
#endif
  }`)
      .replace('#include <color_fragment>', '');
  };
  m.customProgramCacheKey = () => 'ext-glass4' + (flat ? 'f' : '');
  return m;
}

/** Curtains behind the glass: velvet drapes tied back to the sides, a lace sheer, a pelmet (RGBA). */
export function curtainTexture(ctx) {
  return ctx.textures.canvas('ext:curtains4', 512, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    // lace sheer: soft vertical folds (light where the fabric bunches toward the lamp),
    // a fine floral net that only reads up close, a scalloped hem
    for (let x = 0; x < w; x++) {
      const fold = 0.5 + 0.5 * Math.sin(x * 0.11 + Math.sin(x * 0.023) * 2.0);
      g.fillStyle = `rgba(236,206,160,${(0.05 + 0.12 * fold * fold).toFixed(3)})`;
      g.fillRect(x, h * 0.06, 1, h * 0.86);
    }
    g.strokeStyle = 'rgba(240,215,170,0.07)'; g.lineWidth = 1;
    for (let y = h * 0.08; y < h * 0.9; y += 22) for (let x = ((y / 22) % 2) * 11; x < w; x += 22) {
      g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = 'rgba(236,206,160,0.12)';
    for (let x = 0; x < w; x += 18) { g.beginPath(); g.arc(x + 9, h * 0.92, 9, 0, Math.PI); g.fill(); }
    // velvet drapes tied back (hourglass), deep folds: crests glow with lamp-light coming
    // through the thinner pile, troughs nearly black; brighter toward the gathered tie-back
    for (const side of [0, 1]) {
      g.save();
      if (side) { g.translate(w, 0); g.scale(-1, 1); }
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(w * 0.36, 0);
      g.bezierCurveTo(w * 0.3, h * 0.25, w * 0.12, h * 0.48, w * 0.13, h * 0.58);
      g.bezierCurveTo(w * 0.14, h * 0.7, w * 0.3, h * 0.85, w * 0.34, h);
      g.lineTo(0, h); g.closePath();
      g.clip();
      for (let y = 0; y < h; y += 4) {
        // the folds converge on the tie-back
        const pinch = 1 - 0.55 * Math.exp(-Math.pow((y / h - 0.58) / 0.12, 2));
        for (let x = 0; x < w * 0.4; x += 2) {
          const ph = (x / pinch) * 0.085 + side * 1.3 + Math.sin(y * 0.004 + x * 0.01) * 0.6;
          const crest = Math.pow(0.5 + 0.5 * Math.sin(ph), 1.6);
          const trans = 0.18 + 0.82 * crest;
          const glow = 1 + 0.5 * Math.exp(-Math.pow((y / h - 0.58) / 0.2, 2));
          const r = Math.min(255, 150 * trans * glow), gg = Math.min(255, 34 * trans * glow), b = Math.min(255, 20 * trans * glow);
          g.fillStyle = `rgba(${r | 0},${gg | 0},${b | 0},0.98)`;
          g.fillRect(x, y, 2, 4);
        }
      }
      const sg = g.createLinearGradient(0, 0, w * 0.4, 0);
      sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg; g.fillRect(0, 0, w * 0.4, h);
      g.restore();
      // tasselled cord tie-back
      g.fillStyle = 'rgba(160,118,44,1)';
      g.fillRect(side ? w * 0.8 : w * 0.08, h * 0.57, w * 0.12, 10);
      g.beginPath(); g.ellipse(side ? w * 0.86 : w * 0.14, h * 0.6, 7, 16, 0, 0, Math.PI * 2); g.fill();
    }
    // pelmet with a swagged edge
    g.fillStyle = 'rgba(46,9,7,1)'; g.fillRect(0, 0, w, h * 0.065);
    for (let x = 0; x < w; x += 32) { g.beginPath(); g.ellipse(x + 16, h * 0.065, 16, 12, 0, 0, Math.PI); g.fill(); }
  }, { tile: false });
}

/** Rain-run decal: alpha = dark streaks hanging down from the top edge, ragged and fading. */
export function streakTexture(ctx) {
  return ctx.textures.canvas('ext:streaks1', 256, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    let seed = 7;
    const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 70; i++) {
      const x = w * (0.08 + 0.84 * R());
      const len = h * (0.25 + 0.75 * Math.pow(R(), 0.7));
      const wd = 2 + R() * 9;
      const a = 0.1 + R() * 0.3;
      const gr = g.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(0.6, `rgba(255,255,255,${a * 0.55})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x - wd / 2, 0); g.lineTo(x + wd / 2, 0);
      g.quadraticCurveTo(x + wd * 0.3 + (R() - 0.5) * 6, len * 0.6, x + (R() - 0.5) * 4, len);
      g.quadraticCurveTo(x - wd * 0.3, len * 0.5, x - wd / 2, 0);
      g.fill();
    }
    // a soft dirty wash directly under the sill
    const wg = g.createLinearGradient(0, 0, 0, h * 0.25);
    wg.addColorStop(0, 'rgba(255,255,255,0.35)'); wg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = wg; g.fillRect(w * 0.05, 0, w * 0.9, h * 0.25);
    // fade the sides
    const id = g.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x) / (w * 0.12);
      if (e < 1) id.data[(y * w + x) * 4 + 3] *= Math.max(0, e);
    }
    g.putImageData(id, 0, 0);
  }, { tile: false });
}

/** Lamp-lit interior seen through glass: warm falloff, drawn lace + velvet curtains. */
export function interiorTexture(ctx, round) {
  return ctx.textures.canvas(`ext:interior:${round ? 'r' : 'q'}3`, 128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    // warm room glow, hottest low and off-centre (a lamp on a table)
    const rg = g.createRadialGradient(w * 0.58, h * 0.62, 4, w * 0.5, h * 0.55, h * 0.75);
    rg.addColorStop(0, 'rgb(255,236,190)');
    rg.addColorStop(0.25, 'rgb(225,160,90)');
    rg.addColorStop(0.6, 'rgb(120,62,28)');
    rg.addColorStop(1, 'rgb(40,18,8)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    // lace sheer: faint pattern
    g.globalAlpha = 0.18;
    for (let y = 0; y < h; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < w; x += 6) { g.fillStyle = '#000'; g.fillRect(x, y, 2, 2); }
    g.globalAlpha = 1;
    // velvet curtains drawn to the sides with folds
    for (const side of [0, 1]) {
      for (let i = 0; i < 18; i++) {
        const t = i / 17;
        const cw = w * (0.2 + 0.06 * Math.sin(i));
        const x0 = side ? w - cw * (1 - t * 0.35) : 0;
        const fold = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7));
        g.fillStyle = `rgba(${Math.floor(40 * fold)},${Math.floor(10 * fold)},${Math.floor(8 * fold)},0.35)`;
        g.fillRect(x0, 0, cw * (1 - t * 0.35), h);
      }
      // tie-back curve
      g.fillStyle = 'rgba(20,6,4,0.8)';
      g.beginPath();
      if (!side) { g.moveTo(0, 0); g.lineTo(w * 0.3, 0); g.quadraticCurveTo(w * 0.12, h * 0.5, w * 0.2, h); g.lineTo(0, h); }
      else { g.moveTo(w, 0); g.lineTo(w * 0.7, 0); g.quadraticCurveTo(w * 0.88, h * 0.5, w * 0.8, h); g.lineTo(w, h); }
      g.fill();
    }
    // pelmet
    const pg = g.createLinearGradient(0, 0, 0, h * 0.12);
    pg.addColorStop(0, 'rgba(15,5,3,1)'); pg.addColorStop(1, 'rgba(15,5,3,0)');
    g.fillStyle = pg; g.fillRect(0, 0, w, h * 0.12);
    // arch alpha cut
    if (round) {
      const id = g.getImageData(0, 0, w, h);
      const r = w / 2;
      for (let y = 0; y < r; y++) for (let x = 0; x < w; x++) {
        const dx = x + 0.5 - r, dy = r - (y + 0.5);
        if (dx * dx + dy * dy > r * r) id.data[(y * w + x) * 4 + 3] = 0;
      }
      g.putImageData(id, 0, 0);
    }
  }, { tile: false });
}
