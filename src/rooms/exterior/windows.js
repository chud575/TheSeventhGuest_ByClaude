import * as THREE from 'three';
import { mat4 } from './lib.js';

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
  }

  /** Arbitrary glass shape (oculus, fanlight): geometry in XY with 0..1 UVs. */
  shape(geo, matrix, lit = 0) { this.shapes.push({ geo, matrix, lit }); }

  /**
   * Add a window. (x,y,z) = bottom centre of the opening on the wall plane, ry = facing.
   * type: 'flat' (cornice hood on brackets), 'seg' (segmental arched hood + keystone),
   *       'round' (round-headed opening), 'plain'. lit: 0..1 interior glow level.
   */
  add({ x, y, z, ry = 0, w = 1.1, h = 2.4, type = 'flat', lit = 0, tint = 0, shutters = false, panes = 2 }) {
    const B = this.bucket, T = this.trim, S = this.sash;
    const base = mat4(x, y, z, 0, ry, 0);
    const put = (geo, mat, lx, ly, lz) => B.add(geo, mat, base.clone().multiply(mat4(lx, ly, lz)), { uvScale: 1 });
    const box = (mat, bw, bh, bd, lx, ly, lz) => put(new THREE.BoxGeometry(bw, bh, bd), mat, lx, ly, lz);
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
        const sm = base.clone().multiply(mat4(sx * (w / 2 + cw + sw / 2 + 0.01), 0, 0.05, 0, sx * -0.18, 0));
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
    (round ? this.glassRound : this.glassRect).push({ matrix: gm, lit, tint });
  }

  /** Build the two instanced glass meshes. */
  buildGlass(parent, ctx) {
    const tex = interiorTexture(ctx, false);
    const texR = interiorTexture(ctx, true);
    const make = (list, map, name) => {
      if (!list.length) return null;
      const geo = new THREE.PlaneGeometry(1, 1);
      const mat = glassMaterial(map);
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      const c = new THREE.Color();
      list.forEach((g, i) => {
        m.setMatrixAt(i, g.matrix);
        if (g.lit > 0) c.setRGB(1.0, 0.56 + g.tint * 0.1, 0.24 + g.tint * 0.05).multiplyScalar(g.lit * 5.0);
        else c.setRGB(0, 0, 0);
        m.setColorAt(i, c);
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
      const mat = glassMaterial(tex);
      mat.emissive.setRGB(1.0, 0.58, 0.26).multiplyScalar(s.lit * 5.0);
      const m = new THREE.Mesh(s.geo, mat);
      m.applyMatrix4(s.matrix);
      m.name = `glassShape${i}`;
      parent.add(m);
      return m;
    });
    return { rect: make(this.glassRect, tex, 'glassRect'), round: make(this.glassRound, texR, 'glassRound'), shapes };
  }
}

/** Glass: glossy dark pane reflecting the sky; emissive interior scaled by instance colour. */
export function glassMaterial(map) {
  const m = new THREE.MeshStandardMaterial({
    color: 0x0a0c10, roughness: 0.07, metalness: 0.0, emissive: 0xffffff, emissiveMap: map,
    envMapIntensity: 2.2, alphaTest: 0.5, map: null, name: 'windowGlass',
  });
  m.alphaMap = map; // arch cut-out lives in the alpha channel -> use as alpha via onBeforeCompile
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_fragment>', '')
      .replace('#include <alphamap_fragment>', '#ifdef USE_ALPHAMAP\n diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).a;\n#endif')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  reflectedLight.directSpecular *= 0.04;   // no hot glints from the fill: glass reads by its env reflection`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#if defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR )
  totalEmissiveRadiance *= vColor.rgb;
#endif`);
  };
  m.customProgramCacheKey = () => 'ext-glass2';
  return m;
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
