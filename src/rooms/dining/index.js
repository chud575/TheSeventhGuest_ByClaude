import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { heavyFrameProfile, cartoucheGeometry, buildDoorLeaf, buildArchitrave, buildChair, webBackGeometry, buildTable, buildSideboard, buildCandelabrum, buildChandelier, buildPlaceSetting, plateGeometry, discUV, gobletGeometry, napkinGeometry, cutleryGeometries } from './furniture.js';
import { ganacheTexture, spongeTexture, chinaTexture, ceilingFieldTexture, tuftedTexture, flameMahoganyTexture, giltPlateTexture, tombTexture, laceTexture, frostTexture } from './textures.js';
import { buildCurtain, buildSwagValance, buildTassel } from './drapery.js';
import { frostPaneTexture, foxingTexture, winterSkyTexture, treelineTexture, treeCardTexture, snowFieldTexture } from './textures.js';
import { createCakePuzzle, cakeMeta, CAKE_ID } from './puzzleCake.js';
import { denseHerizTexture, linenTexture, palmetteFriezeTexture } from './textures.js';
import { rug as rugGenerator } from '../../engine/materials/generators/rug.js';
import { mergeStatic } from './merge.js';
import { createGuestMaterial, loadGuestGeometry } from './guestFx.js';

/**
 * The Dining Room — Stauf's table is still laid for six.
 *
 * A long Prussian-blue room (5.8 x 8 x 3.7 m) entered from the foyer. Canted
 * back corners hold arched china niches; between them a tall window with blue
 * velvet drapes lets the winter moon in across a Heriz carpet. A round mahogany
 * table with six spider-web-back chairs stands under a brass gasolier; on it,
 * the hexagonal Funeral Cake (the room's puzzle). Sideboard and a tall painting
 * on the left wall, a stormy mountain landscape on the right.
 *
 * Axes (room-local): x right as seen from the doorway, z toward the doorway
 * (front wall, foyer door), y up. Back wall (window) at z = -4.
 */

const X0 = -2.9, X1 = 2.9, Z0 = -4.0, Z1 = 4.0, H = 3.7;
const C = 1.0;                       // canted back corners
const DADO = 0.92;
const CROWN_H = 0.17, FRIEZE_H = 0.4;
const FRIEZE_Y = H - CROWN_H - FRIEZE_H;
const WIN = { w: 1.2, sill: 0.98, h: 1.95, depth: 0.34 };
const NICHE = { w: 0.74, bottom: 1.0, top: 2.72, depth: 0.32 };
const DOORS = { foyer: { x: 0.0, w: 1.5, h: 2.62 }, kitchen: { x: 1.95, w: 0.9, h: 2.3 } };
const T = new THREE.Vector3(0.38, 0, -0.85);       // table centre
const TABLE_R = 0.86, TABLE_H = 0.76;
const PLACE_R = 0.6;

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

/** engine curtainGeometry can emit NaN in its top row; patch from the row below */
function fixNaN(g, segX = 140) {
  const a = g.attributes.position.array;
  const row = (segX + 1) * 3;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) a[i] = Number.isFinite(a[i + row]) ? a[i + row] : 0;
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export default {
  id: 'dining',
  title: 'The Dining Room',
  floorName: 'Ground Floor',
  map: { floor: 'ground', rect: [205, 250, 180, 180] },
  start: 'main',
  ambience: { wind: 0.5, creaks: 0.4, clock: 0.55, thunder: 0.25, rain: 0, heartbeat: 0, roomTone: 0.3 },
  music: { key: 45, mood: 'dread' },
  puzzles: [cakeMeta],

  async build(ctx) {
    const { materials: M, geometry: G, fx } = ctx;
    const Q = ctx.quality;
    const big = Q.textureSize >= 2048 ? 2048 : 1024;
    const root = new THREE.Group();
    root.name = 'dining';
    const add = (o, parent = root) => { parent.add(o); return o; };

    // ================================================================ materials
    const mat = {
      wall: M.create('damask', { base: [0.1, 0.17, 0.33], motif: [0.2, 0.3, 0.5], sheen: 0.5, aging: 0.45, variant: 0, repeat: [1 / 0.26, 1 / 0.26], macro: 0.4, size: 1024, normalScale: 0.45 }),
      paint: M.create('plaster', { color: [0.1, 0.16, 0.3], cracks: 0.15, stains: 0.35, roughness: 0.7, repeat: [0.7, 0.7] }),
      niche: M.create('plaster', { color: [0.035, 0.045, 0.1], cracks: 0.25, stains: 0.5, repeat: [1, 1] }),
      ceiling: M.create('plaster', { color: [0.12, 0.16, 0.34], cracks: 0.3, stains: 0.45, repeat: [0.45, 0.45] }),
      beam: M.create('plaster', { color: [0.34, 0.07, 0.06], cracks: 0.1, stains: 0.4, roughness: 0.6, repeat: [1, 1] }),
      floor: M.create('parquet', { species: 'walnut', ratio: 5, planksAcross: 2, repeat: [1.35, 1.35], polish: 0.6, wear: 0.5, macro: 0.5 }),
      wood: M.create('mahogany', { repeat: [1.4, 1.4], color: [0.62, 0.42, 0.36] }),
      woodTop: M.create('mahogany', { repeat: [0.8, 0.8], color: [0.6, 0.4, 0.34] }),
      panel: M.create('wood', { species: 'mahogany', boards: 0, polish: 0.75, repeat: [1.1, 1.1], clearcoat: 0.5, clearcoatRoughness: 0.28, color: [0.24, 0.15, 0.12] }),
      doorWood: M.create('wood', { species: 'mahogany', boards: 0, polish: 0.7, repeat: [1.6, 1.6], clearcoat: 0.45, clearcoatRoughness: 0.3, color: [0.2, 0.12, 0.09] }),
      crown: M.create('gilded', { pattern: 0, repeats: 4, wear: 0.45, dirt: 0.55, repeat: [1 / 0.55, 1] }),
      frieze: M.create('gilded', { pattern: 2, repeats: 3, ground: 1, groundColor: [0.03, 0.04, 0.1], wear: 0.35, dirt: 0.5, repeat: [1 / 1.15, 1], normalScale: 0.55 }),
      gilt: M.create('gold', { wear: 0.45, dirt: 0.5, repeat: [2, 1] }),
      frame: M.create('gilded', { pattern: 1, repeats: 3, wear: 0.45, dirt: 0.65, repeat: [1 / 0.45, 1] }),
      drape: M.create('velvet', { color: [0.05, 0.1, 0.36], crush: 0.3, repeat: [1.4, 1.4], side: THREE.DoubleSide, sheen: 0.6, sheenColor: [0.3, 0.42, 0.8], sheenRoughness: 0.75, roughness: 0.9, normalScale: 0.15 }),
      seat: M.create('velvet', { color: [0.1, 0.19, 0.3], crush: 0.4, pattern: 1, repeat: [4, 4], sheenColor: [0.3, 0.45, 0.6] }),
      brass: M.create('brass', { tarnish: 0.3, polish: 0.75, repeat: [3, 3] }),
      glass: M.create('glass', { dirt: 0.55, transparent: true, opacity: 0.12 }),
      rug: null,
      runner: M.create('rug', { palette: 'kashan', colors: { ivory: [0.5, 0.44, 0.36], field: [0.26, 0.05, 0.07], gold: [0.45, 0.32, 0.15] }, aspect: 0.85 / 5.8, knots: 150, wear: 0.75, fringe: 0.012, seed: 5, size: 2048, alphaTest: 0.5, roughness: 0.95 }),
      silver: M.basic('silver', { roughness: 0.25, envMapIntensity: 1.3 }),
      crystal: M.basic('crystal', { envMapIntensity: 1.5, opacity: 0.3 }),
      porcelain: M.basic('porcelain'),
      linen: null,
      iron: M.basic('iron'),
      black: M.basic('black', { color: 0x0a0806 }),
      wine: new THREE.MeshPhysicalMaterial({ color: 0x3a0308, roughness: 0.12, transmission: 0, clearcoat: 1, clearcoatRoughness: 0.12, name: 'wine' }),
    };
    {
      const rs = denseHerizTexture(ctx.textures, rugGenerator, { colors: { field: [0.26, 0.045, 0.05], border: [0.05, 0.065, 0.16], ivory: [0.62, 0.55, 0.45], gold: [0.46, 0.31, 0.14], teal: [0.1, 0.18, 0.21], dark: [0.04, 0.03, 0.035], rose: [0.4, 0.16, 0.15] }, aspect: 3.3 / 5.0, knots: 600, wear: 0.75, fringe: 0.03, seed: 21, size: 2048 });
      mat.rug = new THREE.MeshPhysicalMaterial({ map: rs.map, normalMap: rs.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughnessMap: rs.ormMap, aoMap: rs.ormMap, roughness: 1, metalness: 0, alphaTest: 0.5, sheen: 0.8, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.55, 0.42, 0.38), envMapIntensity: 0.5, name: 'rug' });
      mat.rug.map.anisotropy = 8;
    }
    // the drapes: a smooth velvet (the generator's crushed-pile noise sparkled as white static under the moon);
    // the folds come from the geometry, the pile from a soft sheen lobe
    mat.drape = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.05, 0.062, 0.105), roughness: 0.88, metalness: 0, sheen: 0.45, sheenRoughness: 0.7, sheenColor: new THREE.Color(0.2, 0.22, 0.27), side: THREE.DoubleSide, envMapIntensity: 0.35, name: 'drapeVelvet' });
    {
      const ln = linenTexture(ctx.textures);
      mat.linen = new THREE.MeshPhysicalMaterial({ map: ln.map, normalMap: ln.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: ln.ormMap, aoMap: ln.ormMap, color: 0xf0ebe0, roughness: 1, metalness: 0, sheen: 0.7, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.95, 0.93, 0.9), side: THREE.DoubleSide, envMapIntensity: 0.6, name: 'linen' });
      // flatware: brushed old silver; broad soft highlights from the room, never a hot slab in the bloom
      mat.flatware = new THREE.MeshPhysicalMaterial({ color: 0xc0c0c4, metalness: 1, roughness: 0.38, envMapIntensity: 0.7, name: 'flatware' });
    }
    {
      const pf = palmetteFriezeTexture(ctx.textures).withRepeat(1 / 0.46, 1);
      mat.frieze = new THREE.MeshPhysicalMaterial({ map: pf.map, normalMap: pf.normalMap, normalScale: new THREE.Vector2(1.6, 1.6), roughnessMap: pf.ormMap, metalnessMap: pf.ormMap, aoMap: pf.ormMap, aoMapIntensity: 1.0, roughness: 1, metalness: 1, envMapIntensity: 1.1, name: 'palmetteFrieze' });
    }
    mat.rosePlaster = M.create('plaster', { color: [0.22, 0.24, 0.3], cracks: 0.2, stains: 0.5, roughness: 0.9, repeat: [3, 3] });
    mat.tassel = M.create('velvet', { color: [0.5, 0.36, 0.16], crush: 0.2, repeat: [6, 6], sheen: 1, sheenColor: [0.9, 0.7, 0.35] });
    mat.giltDark = M.create('gold', { wear: 0.6, dirt: 0.8, repeat: [2, 1], color: [0.45, 0.4, 0.36] });
    mat.standSilver = M.basic('silver', { roughness: 0.25, metalness: 1, envMapIntensity: 0.9, color: 0xb0b0b4 });
    mat.chairWood = M.create('mahogany', { repeat: [1.4, 1.4], color: [0.13, 0.065, 0.05], roughness: 1.1, clearcoat: 0.5, clearcoatRoughness: 0.32 });
    // M.create's `color` does not take arrays: apply the intended albedo multipliers here
    mat.panel.color.setRGB(0.6, 0.48, 0.45); mat.doorWood.color.setRGB(0.48, 0.38, 0.35);
    mat.chairWood.color.setRGB(0.5, 0.37, 0.33); mat.giltDark.color.setRGB(0.45, 0.4, 0.36);
    mat.chairWood.roughness = 1;
    const tuft = tuftedTexture(ctx.textures).withRepeat(1 / 0.36, 1 / 0.36);
    mat.seat = new THREE.MeshPhysicalMaterial({ map: tuft.map, normalMap: tuft.normalMap, roughnessMap: tuft.ormMap, aoMap: tuft.ormMap, roughness: 1, metalness: 0, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.3, 0.5, 0.6), name: 'tufted' });
    const fm = flameMahoganyTexture(ctx.textures);
    mat.woodTop = new THREE.MeshPhysicalMaterial({ map: fm.map, normalMap: fm.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughnessMap: fm.ormMap, roughness: 1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.22, envMapIntensity: 0.8, name: 'flameMahogany' });
    const gp = giltPlateTexture(ctx.textures);
    mat.plate = new THREE.MeshPhysicalMaterial({ map: gp.map, normalMap: gp.normalMap, roughnessMap: gp.ormMap, metalnessMap: gp.ormMap, roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.12, color: 0xe0dcd4, name: 'giltPlate' });
    const lc = laceTexture(ctx.textures);
    mat.lace = new THREE.MeshStandardMaterial({ map: lc.map, alphaMap: null, alphaTest: 0.5, roughness: 0.9, metalness: 0, color: 0xb8b0a2, name: 'lace', polygonOffset: true, polygonOffsetFactor: -1 });
    mat.charger = new THREE.MeshStandardMaterial({ color: 0xc89a4a, metalness: 1, roughness: 0.3, envMapIntensity: 1.2, name: 'charger' });
    const frostSet = frostTexture(ctx.textures);
    mat.frost = new THREE.MeshPhysicalMaterial({ color: 0xc8beb0, map: frostSet.map, emissive: new THREE.Color(1.0, 0.74, 0.46), emissiveMap: frostSet.map, emissiveIntensity: 0.32, roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.35, side: THREE.DoubleSide, name: 'frost' });
    mat.globe = new THREE.MeshPhysicalMaterial({ color: 0xc8beb0, map: frostSet.map, emissive: new THREE.Color(1.0, 0.72, 0.44), emissiveMap: frostSet.map, emissiveIntensity: 0.55, roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.35, side: THREE.DoubleSide, name: 'globe' });
    const chinaSet = chinaTexture(ctx.textures, { seed: 1 });
    mat.china = new THREE.MeshPhysicalMaterial({ map: chinaSet.map, normalMap: chinaSet.normalMap, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, name: 'china' });
    const ganSet = ganacheTexture(ctx.textures), spSet = spongeTexture(ctx.textures);
    const cakeMats = {
      ganache: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(1.15, 1.0, 0.95), map: ganSet.map, normalMap: ganSet.normalMap, roughnessMap: ganSet.ormMap, roughness: 1, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2, sheen: 0.3, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.5, 0.3, 0.2), name: 'ganache' }),
      sponge: new THREE.MeshStandardMaterial({ map: spSet.map, normalMap: spSet.normalMap, roughnessMap: spSet.ormMap, aoMap: spSet.ormMap, roughness: 1, metalness: 0, name: 'sponge' }),
      cream: new THREE.MeshPhysicalMaterial({ color: 0xd8c8a8, roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color(1, 0.95, 0.9), name: 'cream' }),
      sugar: new THREE.MeshPhysicalMaterial({ color: 0xd6ccb8, roughness: 0.55, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color(1, 0.92, 0.85), emissive: new THREE.Color(0.32, 0.2, 0.12), emissiveIntensity: 0.12, clearcoat: 0.3, clearcoatRoughness: 0.35, name: 'sugar' }),
      crumb: new THREE.MeshStandardMaterial({ color: 0x4a2010, roughness: 0.85, name: 'crumb' }),
      ganacheDrip: new THREE.MeshPhysicalMaterial({ color: 0x4a2414, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15, name: 'ganacheDrip' }),
      socket: new THREE.MeshStandardMaterial({ color: 0x0b0503, roughness: 0.6, name: 'socket' }),
      stone: (() => { const t = tombTexture(ctx.textures); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.ormMap, roughness: 1, metalness: 0, color: 0xb0b0b4, name: 'tombstone' }); })(),
    };

    const cornerG = cartoucheGeometry(G, 'corner'), centreG = cartoucheGeometry(G, 'centre');
    /** heavy carved frame: stepped profile + acanthus corner sprays and a centre cartouche, patina in the recesses */
    const carvedFrame = (g, w, h, fw, depth) => {
      g.add(new THREE.Mesh(G.frameGeometry(w, h, { width: fw, depth, profile: heavyFrameProfile(fw, depth), uvScale: 1 }), mat.frame));
      const k = fw / 0.14;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const c = new THREE.Mesh(cornerG, mat.gilt);
        c.position.set(sx * (w / 2 + fw * 0.82), sy * (h / 2 + fw * 0.82), depth * 0.72);
        c.rotation.z = Math.atan2(-sy, -sx) + Math.PI / 4; c.scale.setScalar(k); g.add(c);
      }
      for (const sy of [-1, 1]) {
        const c = new THREE.Mesh(centreG, mat.gilt);
        c.position.set(0, sy * (h / 2 + fw * 0.55), depth * 0.7); c.rotation.z = sy > 0 ? 0 : Math.PI; c.scale.setScalar(k * (sy > 0 ? 1.15 : 0.8)); g.add(c);
      }
    };
    // ================================================================ shell: floor, ceiling
    const P = [V3(X0 + C, 0, Z0), V3(X1 - C, 0, Z0), V3(X1, 0, Z0 + C), V3(X1, 0, Z1), V3(X0, 0, Z1), V3(X0, 0, Z0 + C)];
    {
      const sh = new THREE.Shape(P.map((p) => V2(p.x, -p.z)));
      const fg = new THREE.ShapeGeometry(sh);
      fg.rotateX(-Math.PI / 2);
      const floor = add(new THREE.Mesh(fg, mat.floor)); floor.name = 'floor';
      const cg = new THREE.ShapeGeometry(sh);
      cg.rotateX(Math.PI / 2); cg.scale(1, 1, -1);
      // flip winding after mirror
      const ix = cg.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      cg.computeVertexNormals();
      const ceil = add(new THREE.Mesh(cg, mat.ceiling)); ceil.position.y = H; ceil.name = 'ceiling';
    }

    // ================================================================ walls
    // each segment: group at A, local x along A->B, local +z into the room
    const segs = [];
    for (let i = 0; i < P.length; i++) {
      const A = P[i], B = P[(i + 1) % P.length];
      const along = new THREE.Vector3().subVectors(B, A); const len = along.length(); along.normalize();
      const grp = new THREE.Group();
      grp.position.copy(A); grp.rotation.y = -Math.atan2(along.z, along.x);
      root.add(grp);
      segs.push({ A, B, len, along, grp, name: ['back', 'cantR', 'right', 'front', 'left', 'cantL'][i] });
    }
    const S = Object.fromEntries(segs.map((s) => [s.name, s]));
    const lx = { front: (x) => X1 - x };
    const openUpper = { back: [], cantR: [], right: [], front: [], left: [], cantL: [] };
    const openLower = { back: [], cantR: [], right: [], front: [], left: [], cantL: [] };
    // window
    openUpper.back.push({ x: S.back.len / 2 - WIN.w / 2, y: WIN.sill - DADO, w: WIN.w, h: WIN.h });
    // niches
    for (const n of ['cantR', 'cantL']) openUpper[n].push({ x: S[n].len / 2 - NICHE.w / 2, y: NICHE.bottom - DADO, w: NICHE.w, h: NICHE.top - NICHE.bottom, arch: true });
    // doors
    for (const d of Object.values(DOORS)) {
      const x = lx.front(d.x) - d.w / 2;
      openLower.front.push({ x, y: -0.01, w: d.w, h: DADO + 0.02 });
      openUpper.front.push({ x, y: -0.01, w: d.w, h: d.h - DADO + 0.01 });
    }
    /** wall piece whose openings touch the bottom edge become notches in the outline (earcut drops holes that cross the boundary) */
    const wallPiece = (len, h, opens) => {
      const holes = opens.filter((o) => o.y > 0.001), notches = opens.filter((o) => o.y <= 0.001).sort((a, b) => a.x - b.x);
      if (!notches.length) return G.wallWithOpenings(len, h, holes, { uvScale: 1 });
      const geos = [];
      const outline = (x0, x1, ns) => {
        const pts = [V2(x0, 0)];
        for (const n of ns) { const top = Math.min(n.y + n.h, h); pts.push(V2(n.x, 0), V2(n.x, top), V2(n.x + n.w, top), V2(n.x + n.w, 0)); }
        pts.push(V2(x1, 0), V2(x1, h), V2(x0, h));
        const sh = new THREE.Shape(pts);
        for (const o of holes.filter((o) => o.x > x0 && o.x + o.w < x1)) { const hp = new THREE.Path(); hp.moveTo(o.x, o.y); hp.lineTo(o.x, o.y + o.h); hp.lineTo(o.x + o.w, o.y + o.h); hp.lineTo(o.x + o.w, o.y); hp.lineTo(o.x, o.y); sh.holes.push(hp); }
        geos.push(new THREE.ShapeGeometry(sh, 24));
      };
      // full-height notches split the wall into separate pieces
      let x0 = 0, run = [];
      for (const n of notches) {
        if (n.y + n.h >= h - 0.001) { if (n.x - x0 > 0.001) outline(x0, n.x, run); run = []; x0 = n.x + n.w; } else run.push(n);
      }
      if (len - x0 > 0.001) outline(x0, len, run);
      return G.mergeGeometries(geos);
    };
    for (const s of segs) {
      const up = new THREE.Mesh(wallPiece(s.len, H - DADO, openUpper[s.name]), mat.wall);
      up.position.y = DADO; s.grp.add(up);
      const lo = new THREE.Mesh(wallPiece(s.len, DADO, openLower[s.name]), mat.paint);
      s.grp.add(lo);
    }
    // open-path helper in world space
    const doorEdges = Object.values(DOORS).map((d) => [d.x - d.w / 2 - 0.13, d.x + d.w / 2 + 0.13]);
    const runPaths = (y) => [
      [V3(doorEdges[0][0], y, Z1), V3(X0, y, Z1), V3(X0, y, Z0 + C), V3(X0 + C, y, Z0), V3(X1 - C, y, Z0), V3(X1, y, Z0 + C), V3(X1, y, Z1), V3(doorEdges[1][1], y, Z1)],
      [V3(doorEdges[1][0], y, Z1), V3(doorEdges[0][1], y, Z1)],
    ];
    const loop = (y) => P.map((p) => V3(p.x, y, p.z));

    // ================================================================ mouldings
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(CROWN_H, 0.17), loop(H - CROWN_H), { closed: true, uvScale: 1 }), mat.crown));
    add(new THREE.Mesh(G.sweepProfile([V2(0.012, 0), V2(0.012, FRIEZE_H)], loop(FRIEZE_Y), { closed: true, uvScale: 1 }), mat.frieze));
    // bead + fillet under the frieze (picture rail)
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.05, 0.03), loop(FRIEZE_Y - 0.05), { closed: true, uvScale: 2 }), mat.gilt));
    for (const pth of runPaths(DADO - 0.06)) add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.07, 0.035), pth, { uvScale: 2 }), mat.gilt));
    for (const pth of runPaths(0)) add(new THREE.Mesh(G.sweepProfile(G.PROFILES.baseboard(0.2, 0.028), pth, { uvScale: 1 }), mat.panel));

    // wainscot raised panels below the dado (painted, same blue as the lower wall)
    {
      const pg = G.raisedPanel(0.6, 0.5, { border: 0.06, bevel: 0.03, fieldDepth: 0.01, frameDepth: 0.012 });
      for (const s of segs) {
        let ranges = [[0.12, s.len - 0.12]];
        if (s.name === 'front') {
          ranges = [];
          const cuts = Object.values(DOORS).map((d) => [lx.front(d.x) - d.w / 2 - 0.2, lx.front(d.x) + d.w / 2 + 0.2]).sort((a, b) => a[0] - b[0]);
          let x = 0.12;
          for (const [a, b] of cuts) { if (a - x > 0.4) ranges.push([x, a]); x = b; }
          if (s.len - 0.12 - x > 0.4) ranges.push([x, s.len - 0.12]);
        }
        for (const [a, b] of ranges) {
          const n = Math.max(1, Math.round((b - a) / 0.78));
          const pw = (b - a) / n;
          for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(pg, mat.paint);
            m.position.set(a + pw * (i + 0.5), 0.2 + (DADO - 0.27) / 2 + 0.01, 0.004);
            m.scale.set((pw - 0.1) / 0.6, (DADO - 0.33) / 0.5, 1);
            s.grp.add(m);
          }
        }
      }
    }

    // pilasters (mahogany) framing the canted bays
    {
      const ph = FRIEZE_Y - 0.05;
      const pil = (s, x) => {
        const g = new THREE.Group();
        g.add(at(new THREE.Mesh(G.boxUV(0.2, ph, 0.05, 1), mat.panel), 0, ph / 2, 0.025));
        const fl = new THREE.Mesh(G.raisedPanel(0.13, ph - 0.7, { border: 0.025, bevel: 0.012, fieldDepth: 0.004, frameDepth: 0.008 }), mat.panel);
        fl.position.set(0, 0.3 + (ph - 0.7) / 2 + 0.05, 0.05); g.add(fl);
        g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.26, 0.3, 0.08, 2, 0.01), mat.panel), 0, 0.15, 0.04));
        g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.25, 0.1, 0.075, 2, 0.01), mat.panel), 0, ph - 0.05, 0.04));
        g.add(at(new THREE.Mesh(G.boxUV(0.27, 0.025, 0.09, 2), mat.gilt), 0, ph - 0.11, 0.045));
        g.position.x = x; s.grp.add(g);
      };
      pil(S.back, 0.11); pil(S.back, S.back.len - 0.11);
      pil(S.right, 0.11); pil(S.left, S.left.len - 0.11);
    }

    // ceiling: red-painted beam frame with gilt fillets, rose + gasolier
    {
      const d = 0.5, k = C + 0.207;
      const Qp = [V3(X0 + k, H, Z0 + d), V3(X1 - k, H, Z0 + d), V3(X1 - d, H, Z0 + k), V3(X1 - d, H, Z1 - d), V3(X0 + d, H, Z1 - d), V3(X0 + d, H, Z0 + k)];
      const prof = [V2(-0.14, 0), V2(-0.14, -0.13), V2(0.14, -0.13), V2(0.14, 0)];
      add(new THREE.Mesh(G.sweepProfile(prof, Qp, { closed: true, uvScale: 1 }), mat.beam));
      for (const off of [-0.14, 0.14]) {
        const bead = [];
        for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI * 2; bead.push(V2(off + Math.cos(a) * 0.012, -0.13 + Math.sin(a) * 0.012)); }
        add(new THREE.Mesh(G.sweepProfile(bead, Qp, { closed: true, uvScale: 3 }), mat.gilt));
      }
      // inner fillet frame
      const inner = Qp.map((p) => V3(p.x + (T.x - p.x) * 0.0, p.y, p.z));
      const prof2 = [V2(0.2, 0), V2(0.2, -0.03), V2(0.26, -0.03), V2(0.26, 0)];
      add(new THREE.Mesh(G.sweepProfile(prof2, inner, { closed: true, uvScale: 2 }), mat.gilt));
      const rose = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.5, 0], [0.5, -0.02], [0.44, -0.03], [0.4, -0.025], [0.36, -0.045], [0.28, -0.05], [0.24, -0.04], [0.18, -0.07], [0.1, -0.08], [0.06, -0.11], [0.0, -0.12]].reverse(), 64), mat.gilt);
      rose.position.set(T.x, H - 0.004, T.z); add(rose);
      rose.material = mat.rosePlaster;
      // acanthus ring: radial leaves (instanced via merge later)
      const leafGeo = new THREE.SphereGeometry(0.06, 8, 6); leafGeo.scale(0.5, 0.25, 1.4);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const l = new THREE.Mesh(leafGeo, mat.rosePlaster);
        l.position.set(T.x + Math.cos(a) * 0.32, H - 0.035, T.z + Math.sin(a) * 0.32); l.rotation.y = -a + Math.PI / 2; add(l);
      }
    }
    {
      const d = 0.64, k = C + 0.265;
      const pts = [V2(X0 + k, Z0 + d), V2(X1 - k, Z0 + d), V2(X1 - d, Z0 + k), V2(X1 - d, Z1 - d), V2(X0 + d, Z1 - d), V2(X0 + d, Z0 + k)];
      const xmin = X0 + d, w = (X1 - d) - xmin, zmin = Z0 + d, h = (Z1 - d) - zmin;
      const tex = ceilingFieldTexture(ctx.textures, { aspect: w / h, rose: [(T.x - xmin) / w, (T.z - zmin) / h] });
      const tris = THREE.ShapeUtils.triangulateShape(pts, []);
      const pos = [], uv = [];
      for (const t of tris) {
        const [a, b, c] = t.map((i) => pts[i]);
        const cross = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
        const order = cross > 0 ? [a, b, c] : [a, c, b];
        for (const q of order) { pos.push(q.x, H - 0.004, q.y); uv.push((q.x - xmin) / w, (q.y - zmin) / h); }
      }
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      fg.computeVertexNormals();
      if (fg.attributes.normal.getY(0) > 0) { const n = fg.attributes.normal; for (let i = 0; i < n.count; i++) n.setY(i, -n.getY(i)); fg.index = null; const p2 = fg.attributes.position.array; for (let i = 0; i < p2.length; i += 9) for (let j = 0; j < 3; j++) { const t0 = p2[i + 3 + j]; p2[i + 3 + j] = p2[i + 6 + j]; p2[i + 6 + j] = t0; } const u2 = fg.attributes.uv.array; for (let i = 0; i < u2.length; i += 6) for (let j = 0; j < 2; j++) { const t0 = u2[i + 2 + j]; u2[i + 2 + j] = u2[i + 4 + j]; u2[i + 4 + j] = t0; } fg.computeVertexNormals(); }
      const fm = new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normalMap, roughnessMap: tex.ormMap, metalnessMap: tex.ormMap, roughness: 1, metalness: 1, envMapIntensity: 1.2, name: 'ceilingField' });
      const field = add(new THREE.Mesh(fg, fm)); field.name = 'ceiling';
    }
    const chand = buildChandelier(ctx, { brass: mat.brass, frost: mat.frost, globe: mat.globe, crystal: mat.crystal }, { drop: 1.25, arms: 5, armR: 0.4 });
    chand.position.set(T.x, H - 0.1, T.z);
    add(chand);
    const chandY = H - 0.1 + chand.userData.hubY;

    // ================================================================ window, drapes, night garden
    {
      const s = S.back;
      const wx = s.len / 2;
      // deep reveal
      const shape = new THREE.Shape();
      shape.moveTo(-WIN.w / 2 - 0.02, -0.02); shape.lineTo(WIN.w / 2 + 0.02, -0.02); shape.lineTo(WIN.w / 2 + 0.02, WIN.h + 0.02); shape.lineTo(-WIN.w / 2 - 0.02, WIN.h + 0.02);
      const hole = new THREE.Path(); hole.moveTo(-WIN.w / 2, 0); hole.lineTo(-WIN.w / 2, WIN.h); hole.lineTo(WIN.w / 2, WIN.h); hole.lineTo(WIN.w / 2, 0); hole.lineTo(-WIN.w / 2, 0);
      shape.holes.push(hole);
      const rv = new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(shape, { depth: WIN.depth, bevelEnabled: false }), 1), mat.paint);
      rv.position.set(wx, WIN.sill, -WIN.depth); s.grp.add(rv);
      const sill = new THREE.Mesh(new G.RoundedBoxGeometry(WIN.w + 0.2, 0.05, WIN.depth + 0.1, 2, 0.012), mat.panel);
      sill.position.set(wx, WIN.sill - 0.02, -WIN.depth / 2 + 0.05); s.grp.add(sill);
      // architrave
      const arch = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.1, 0.03), [V3(-WIN.w / 2 - 0.05, 0, 0), V3(-WIN.w / 2 - 0.05, WIN.h + 0.05, 0), V3(WIN.w / 2 + 0.05, WIN.h + 0.05, 0), V3(WIN.w / 2 + 0.05, 0, 0)], { up: V3(0, 0, 1), uvScale: 2, flipOutward: true }), mat.gilt);
      arch.position.set(wx, WIN.sill, 0.002); s.grp.add(arch);
      // sash: frame, glazing bars
      const sash = new THREE.Group();
      const fm = mat.black;
      const bar = (w, h, x, y, d = 0.045) => { const m = new THREE.Mesh(G.boxUV(w, h, d, 2), fm); m.position.set(x, y, 0); sash.add(m); };
      bar(WIN.w, 0.06, 0, 0.03); bar(WIN.w, 0.06, 0, WIN.h - 0.03);
      bar(0.06, WIN.h, -WIN.w / 2 + 0.03, WIN.h / 2); bar(0.06, WIN.h, WIN.w / 2 - 0.03, WIN.h / 2);
      bar(WIN.w, 0.05, 0, WIN.h * 0.52, 0.06);
      bar(0.025, WIN.h, 0, WIN.h / 2, 0.03);
      for (const y of [WIN.h * 0.27, WIN.h * 0.77]) bar(WIN.w, 0.022, 0, y, 0.03);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w - 0.06, WIN.h - 0.06), mat.glass);
      gl.position.set(0, WIN.h / 2, 0.01); gl.userData.noShadow = true; sash.add(gl);
      sash.position.set(wx, WIN.sill, -WIN.depth * 0.55); s.grp.add(sash);
      // the garden beyond, layered for parallax: far sky/treeline card, a mid layer of bare
      // trees (alpha), and a real snowy ground plane catching the moon
      // the winter garden beyond, built in depth for parallax: sky dome card, a wooded ridge in mist,
      // three tree cards at 5 / 8 / 12 m tinted by aerial perspective, ground-mist veils, and a real
      // sloping snowfield with drifts and ice glints
      const outside = new THREE.Group(); outside.position.set(wx, 0, 0); s.grp.add(outside);
      const basic = (map, col, extra = {}) => new THREE.MeshBasicMaterial({ map, color: new THREE.Color(...col), toneMapped: false, fog: false, ...extra });
      const sky = winterSkyTexture(ctx.textures);
      const skyCard = new THREE.Mesh(new THREE.PlaneGeometry(44, 30), basic(sky.map, [2.4, 2.4, 2.4], { name: 'sky' }));
      skyCard.position.set(1.0, 6.0, -26); outside.add(skyCard);
      const tline = treelineTexture(ctx.textures);
      const tl = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), basic(tline.map, [1.5, 1.55, 1.7], { alphaTest: 0.4, name: 'treeline' }));
      tl.position.set(0, 3.2, -19); outside.add(tl);
      const cards = [[3, -12.5, 13, [2.1, 2.2, 2.5], -1.4], [2, -8.2, 8.5, [1.0, 1.06, 1.22], 1.9], [1, -4.9, 6.2, [0.7, 0.75, 0.9], -1.15]];
      for (const [seed, z, size, col, x] of cards) {
        const t = treeCardTexture(ctx.textures, seed);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), basic(t.map, col, { alphaTest: 0.5, side: THREE.DoubleSide, name: `trees${seed}` }));
        m.position.set(x, size / 2 + 0.1 + (-z) * 0.06, z); m.userData.noShadow = true; outside.add(m);
      }
      // mist veils hugging the ground between the layers (vertex-alpha gradient)
      const veil = (w, h, z, a, col) => {
        const g = new THREE.PlaneGeometry(w, h, 1, 8);
        const c = []; const pp = g.attributes.position;
        for (let i = 0; i < pp.count; i++) { const v = (pp.getY(i) + h / 2) / h; c.push(...col, a * Math.pow(Math.max(0, 1 - v), 1.6)); }
        g.setAttribute('color', new THREE.Float32BufferAttribute(c, 4));
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, fog: false, name: 'mist' }));
        m.position.set(0, h / 2 - 0.2 + (-z) * 0.06, z); m.userData.noShadow = true; m.userData.noBake = true; outside.add(m);
      };
      veil(40, 3.5, -16, 0.75, [0.36, 0.41, 0.54]);
      veil(30, 2.4, -10.5, 0.5, [0.32, 0.37, 0.5]);
      veil(20, 1.4, -6.5, 0.3, [0.3, 0.35, 0.48]);
      // the snowfield: rises gently toward the woods, wind drifts banked against the house wall
      const sf = snowFieldTexture(ctx.textures);
      sf.map.wrapS = sf.map.wrapT = THREE.RepeatWrapping; sf.map.repeat.set(6, 4);
      const snowG = new THREE.PlaneGeometry(44, 26, 110, 64);
      {
        const pp = snowG.attributes.position, cols = [];
        for (let i = 0; i < pp.count; i++) {
          const x = pp.getX(i), d = pp.getY(i) + 13;            // d: distance out from the wall (0..26)
          let y = 0.28 + d * 0.055 + 0.18 * Math.sin(x * 0.7 + d * 0.3) * Math.cos(d * 0.5 + x * 0.2) * Math.min(1, d / 4);
          y += 0.32 * Math.exp(-d / 0.9) * (0.7 + 0.3 * Math.sin(x * 1.7));   // drift against the wall
          y += 0.1 * Math.exp(-Math.pow((d - 3.2 - 0.6 * Math.sin(x * 0.4)) / 0.7, 2));   // a wind ridge
          pp.setZ(i, y);
        }
        snowG.computeVertexNormals();
        // baked moonlight: the moon hangs low over the woods, so the far faces of the drifts glow and the
        // near faces fall into blue shade; everything fades into the mist with distance
        const nn = snowG.attributes.normal, L = new THREE.Vector3(0.25, 0.9, 0.45).normalize();   // (plane space: +y = away, +z = up)
        for (let i = 0; i < pp.count; i++) {
          const d = pp.getY(i) + 13, k = Math.min(1, d / 22);
          const lam = Math.max(0, nn.getX(i) * L.x + nn.getY(i) * L.y + nn.getZ(i) * L.z);
          const sh = 0.55 + 0.6 * Math.pow(lam, 3);
          cols.push((0.36 * sh) * (1 - k) + 0.46 * k, (0.41 * sh) * (1 - k) + 0.51 * k, (0.56 * sh) * (1 - k) + 0.64 * k);
        }
        snowG.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      }
      const snowMat = new THREE.MeshBasicMaterial({ map: sf.map, vertexColors: true, toneMapped: false, fog: false, name: 'snow' });
      snowMat.color.setScalar(1.6);
      const snow = new THREE.Mesh(snowG, snowMat); snow.rotation.x = -Math.PI / 2; snow.position.set(0, 0, -13.2); snow.userData.noShadow = true; outside.add(snow);
      // frost creeping in from the corners of the panes
      const fr = frostPaneTexture(ctx.textures);
      const frostGlass = new THREE.MeshStandardMaterial({ map: fr.map, transparent: true, depthWrite: false, roughness: 0.6, metalness: 0, color: 0xc8d4ee, name: 'frostPane' });
      const fp = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w - 0.06, WIN.h - 0.06), frostGlass);
      fp.position.set(wx, WIN.sill + WIN.h / 2, -WIN.depth * 0.55 + 0.016); fp.userData.noShadow = true; fp.userData.noBake = true; s.grp.add(fp);
      // drapes: pleated velvet gathered into cord tie-backs, hems pooled on the floor
      const rodY = FRIEZE_Y - 0.1;
      for (const side of [-1, 1]) {
        const cg = buildCurtain({ width: 0.9, height: rodY, folds: 11, depth: 0.045, tieback: 0.37, squeeze: 0.34, pool: 0.16, seed: side + 7 });
        const c = new THREE.Mesh(cg, mat.drape);
        c.position.set(wx + side * (WIN.w / 2 + 0.56), rodY, 0.12);
        c.scale.x = -side;
        s.grp.add(c);
        // tie-back cord, brass holdback and tassel
        const ty = rodY * 0.37;
        const hx = wx + side * (WIN.w / 2 + 0.6);
        const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(hx, ty + 0.02, 0.03), V3(hx - side * 0.12, ty - 0.03, 0.2), V3(hx - side * 0.3, ty, 0.22), V3(hx - side * 0.34, ty + 0.02, 0.1)]), 20, 0.009, 6), mat.giltDark);
        s.grp.add(cord);
        const hb = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.04, 0], [0.045, 0.012], [0.03, 0.025], [0.012, 0.03], [0, 0.034]], 20).rotateX(Math.PI / 2), mat.brass);
        hb.position.set(hx, ty + 0.02, 0.0); s.grp.add(hb);
        const ts = buildTassel(G, { length: 0.22, radius: 0.034 });
        const th = new THREE.Mesh(ts.head, mat.giltDark), tk = new THREE.Mesh(ts.skirt, mat.tassel);
        for (const m of [th, tk]) { m.position.set(hx - side * 0.12, ty - 0.03, 0.21); s.grp.add(m); }
      }
      // swagged valance with jabots, gilt cornice and tassels between the swags
      {
        const vw = WIN.w + 1.4;
        for (const g of buildSwagValance({ width: vw, n: 3, drop: 0.52 })) {
          const m = new THREE.Mesh(g, mat.drape); m.position.set(wx, rodY + 0.1, 0.16); s.grp.add(m);
        }
        for (const k of [1, 2]) {
          const ts = buildTassel(G, { length: 0.26, radius: 0.04 });
          const x = wx - vw / 2 + (k * vw) / 3;
          const th = new THREE.Mesh(ts.head, mat.giltDark), tk = new THREE.Mesh(ts.skirt, mat.tassel);
          for (const m of [th, tk]) { m.position.set(x, rodY + 0.04, 0.24); s.grp.add(m); }
        }
        // gilt cornice board over the valance
        const cb = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.12, 0.08), [V3(-vw / 2 - 0.14, 0, 0.3), V3(-vw / 2 - 0.14, 0, 0), V3(vw / 2 + 0.14, 0, 0), V3(vw / 2 + 0.14, 0, 0.3)].map((p) => V3(p.x, p.y, -p.z)), { uvScale: 1 }), mat.gilt);
        cb.position.set(wx, rodY + 0.13, 0.3); cb.scale.z = -1; s.grp.add(cb);
        const board = new THREE.Mesh(G.boxUV(vw + 0.26, 0.06, 0.3, 1), mat.panel); board.position.set(wx, rodY + 0.1, 0.15); s.grp.add(board);
      }
    }

    // ================================================================ china niches
    const nicheLights = [];
    {
      const plateG = discUV(plateGeometry(G, 0.105), 0.105);
      const urnG = G.latheFromProfile([[0, 0], [0.045, 0], [0.04, 0.012], [0.025, 0.03], [0.055, 0.08], [0.07, 0.13], [0.06, 0.18], [0.035, 0.21], [0.03, 0.24], [0.045, 0.255], [0.0, 0.26]], 24);
      const lidG = G.latheFromProfile([[0, 0], [0.035, 0], [0.03, 0.015], [0.012, 0.025], [0.014, 0.04], [0, 0.05]], 16);
      const cupG = G.latheFromProfile([[0, 0], [0.04, 0], [0.03, 0.02], [0.012, 0.035], [0.01, 0.08], [0.035, 0.1], [0.05, 0.16], [0.052, 0.17], [0.0, 0.16]], 20);
      for (const n of ['cantL', 'cantR']) {
        const s = S[n];
        const cx = s.len / 2;
        const g = new THREE.Group(); g.position.set(cx, 0, 0); s.grp.add(g);
        const r = NICHE.w / 2, h = NICHE.top - NICHE.bottom;
        // reveal ring (arched)
        const sh = new THREE.Shape();
        sh.moveTo(-r - 0.03, -0.02); sh.lineTo(r + 0.03, -0.02); sh.lineTo(r + 0.03, h + 0.03); sh.lineTo(-r - 0.03, h + 0.03);
        const ho = new THREE.Path(); ho.moveTo(-r, 0); ho.lineTo(-r, h - r); ho.absarc(0, h - r, r, Math.PI, 0, true); ho.lineTo(r, 0); ho.lineTo(-r, 0);
        sh.holes.push(ho);
        const rv = new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: NICHE.depth, bevelEnabled: false, curveSegments: 28 }), 1), mat.niche);
        rv.position.set(0, NICHE.bottom, -NICHE.depth); g.add(rv);
        const bs = new THREE.Shape(); bs.moveTo(-r, 0); bs.lineTo(r, 0); bs.lineTo(r, h - r); bs.absarc(0, h - r, r, 0, Math.PI, false); bs.lineTo(-r, 0);
        const back = new THREE.Mesh(new THREE.ShapeGeometry(bs, 28), mat.niche); back.position.set(0, NICHE.bottom, -NICHE.depth + 0.002); g.add(back);
        // shell hood carved in the arch: radial flutes
        for (let i = 0; i < 11; i++) {
          const a = Math.PI * (i + 0.5) / 11;
          const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.004, r * 0.85, 6), mat.giltDark);
          fl.position.set(Math.cos(a) * r * 0.45, NICHE.bottom + h - r + Math.sin(a) * r * 0.45, -NICHE.depth + 0.02);
          fl.rotation.z = a - Math.PI / 2; g.add(fl);
        }
        // gilt arch moulding
        const path = [V3(-r - 0.04, 0, 0)];
        path.push(V3(-r - 0.04, h - r, 0));
        for (let i = 1; i < 24; i++) { const a = Math.PI - (i / 24) * Math.PI; path.push(V3(Math.cos(a) * (r + 0.04), h - r + Math.sin(a) * (r + 0.04), 0)); }
        path.push(V3(r + 0.04, h - r, 0)); path.push(V3(r + 0.04, 0, 0));
        const am = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.07, 0.03), path, { up: V3(0, 0, 1), uvScale: 2, flipOutward: true }), mat.gilt);
        am.position.set(0, NICHE.bottom, 0.002); g.add(am);
        // keystone
        const ks = new THREE.Mesh(new G.RoundedBoxGeometry(0.09, 0.14, 0.05, 2, 0.01), mat.gilt); ks.position.set(0, NICHE.bottom + h + 0.05, 0.02); g.add(ks);
        // sill ledge + two shelves
        const shelfYs = [NICHE.bottom, NICHE.bottom + 0.5, NICHE.bottom + 1.0];
        shelfYs.forEach((y, k) => {
          const w = k === 0 ? NICHE.w + 0.16 : NICHE.w;
          const d = k === 0 ? NICHE.depth + 0.08 : NICHE.depth;
          const sb = new THREE.Mesh(new G.RoundedBoxGeometry(w, 0.03, d, 2, 0.006), mat.panel); sb.position.set(0, y - 0.015, -NICHE.depth + d / 2); g.add(sb);
          const edge = new THREE.Mesh(G.boxUV(w, 0.008, 0.006, 2), mat.gilt); edge.position.set(0, y - 0.006, -NICHE.depth + d + 0.002); g.add(edge);
          // contents
          const zb = -NICHE.depth + 0.07;
          if (k < 2) {
            for (const x of [-0.22, 0.0, 0.22]) {
              const pl = new THREE.Mesh(plateG, mat.china);
              pl.rotation.x = Math.PI / 2 - 0.22; pl.position.set(x, y + 0.105, zb - 0.01);
              g.add(pl);
            }
            const cup = new THREE.Mesh(cupG, mat.gilt); cup.position.set(-0.12, y, zb + 0.12); cup.scale.setScalar(k ? 0.8 : 1); g.add(cup);
            const gob = new THREE.Mesh(gobletGeometry(G, 1.1), mat.crystal); gob.position.set(0.12, y, zb + 0.13); g.add(gob);
          } else {
            const urn = new THREE.Mesh(urnG, mat.china); urn.position.set(0, y, zb + 0.06); g.add(urn);
            const lid = new THREE.Mesh(lidG, mat.porcelain); lid.position.set(0, y + 0.26, zb + 0.06); g.add(lid);
            for (const x of [-0.22, 0.22]) { const gb = new THREE.Mesh(gobletGeometry(G, 1.3), mat.charger); gb.position.set(x, y, zb + 0.05); g.add(gb); }
          }
        });
        // a weak lamp hidden in the hood keeps the china glinting
        const nl = new THREE.PointLight(0xffb070, 0.6, 2.2, 2);
        const wp = new THREE.Vector3(0, NICHE.bottom + h - 0.25, -NICHE.depth + 0.15);
        nl.position.copy(wp); g.add(nl); nicheLights.push(nl);
      }
    }

    // ================================================================ doors (front wall)
    {
      const s = S.front;
      // brass knob on a rose, with a keyhole escutcheon below
      const knobG = G.latheFromProfile([[0, 0], [0.012, 0], [0.01, 0.025], [0.022, 0.04], [0.028, 0.055], [0.022, 0.068], [0, 0.072]], 20).rotateX(Math.PI / 2);
      const roseG = G.latheFromProfile([[0, 0], [0.032, 0], [0.034, 0.004], [0.026, 0.01], [0.012, 0.012], [0, 0.012]], 24).rotateX(Math.PI / 2);
      const escG = (() => { const sh = new THREE.Shape(); sh.moveTo(-0.018, -0.045); sh.quadraticCurveTo(0, -0.06, 0.018, -0.045); sh.lineTo(0.018, 0.035); sh.quadraticCurveTo(0, 0.055, -0.018, 0.035); sh.lineTo(-0.018, -0.045);
        const kh = new THREE.Path(); kh.absarc(0, 0.008, 0.0055, 0, Math.PI * 2, false); sh.holes.push(kh);
        const kh2 = new THREE.Path(); kh2.moveTo(-0.0025, 0.004); kh2.lineTo(-0.004, -0.018); kh2.lineTo(0.004, -0.018); kh2.lineTo(0.0025, 0.004); sh.holes.push(kh2);
        return new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2 }); })();
      const hardware = (g, x, y) => {
        const r = new THREE.Mesh(roseG, mat.brass); r.position.set(x, y, 0.025); g.add(r);
        const k = new THREE.Mesh(knobG, mat.brass); k.position.set(x, y, 0.035); g.add(k);
        const e = new THREE.Mesh(escG, mat.brass); e.position.set(x, y - 0.13, 0.026); g.add(e);
      };
      const doorMats = { wood: mat.doorWood, brass: mat.brass, gilt: mat.gilt };
      for (const [key, d] of Object.entries(DOORS)) {
        const g = new THREE.Group();
        g.position.set(lx.front(d.x), 0, -0.04);
        if (key === 'foyer') {
          for (const sd of [-1, 1]) {
            const l = buildDoorLeaf(G, doorMats, { w: d.w / 2 - 0.006, h: d.h - 0.01, stile: 0.11, hingeSide: sd, rows: [[0.24, 0.86], [1.06, 2.0], [2.14, d.h - 0.13]] });
            l.position.x = sd * d.w / 4; g.add(l); hardware(g, sd * 0.07, 1.02);
          }
        } else {
          g.add(buildDoorLeaf(G, doorMats, { w: d.w - 0.02, h: d.h - 0.01, stile: 0.11, hingeSide: -1, rows: [[0.22, 0.84], [1.02, 1.82], [1.96, d.h - 0.13]] }));
          hardware(g, d.w / 2 - 0.1, 1.0);
        }
        const arc = buildArchitrave(G, doorMats, { w: d.w + 0.01, h: d.h + 0.005, width: 0.13, cornice: key !== 'foyer' });
        arc.position.z = 0.04; g.add(arc);
        // pediment over the foyer door
        if (key === 'foyer') {
          const fw = d.w + 0.3;
          const fr = new THREE.Mesh(new G.RoundedBoxGeometry(fw + 0.04, 0.18, 0.035, 2, 0.006), mat.doorWood); fr.position.set(0, d.h + 0.24, 0.058); g.add(fr);
          const ped = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.14, 0.1), [V3(-fw / 2 - 0.1, 0, 0.0), V3(-fw / 2 - 0.1, 0, -0.16), V3(fw / 2 + 0.1, 0, -0.16), V3(fw / 2 + 0.1, 0, 0.0)], { uvScale: 1, flipOutward: true }), mat.gilt);
          ped.position.set(0, d.h + 0.33, 0.2); g.add(ped);
        }
        s.grp.add(g);
      }
    }

    // gas sconces flanking the foyer door, and a pier mirror (seen from the window end)
    const sconceLights = [];
    {
      const s = S.front;
      const sconce = (x) => {
        const g = new THREE.Group();
        // oval brass backplate with a cast scroll crest and a drop below
        const bp = G.latheFromProfile([[0, 0], [0.06, 0], [0.065, 0.006], [0.055, 0.014], [0.03, 0.02], [0, 0.022]], 28).rotateX(Math.PI / 2); bp.scale(0.75, 1.5, 1);
        g.add(new THREE.Mesh(bp, mat.brass));
        for (const sx of [-1, 1]) { const sc = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 14, Math.PI * 1.4), mat.brass); sc.position.set(sx * 0.022, 0.1, 0.012); sc.rotation.z = sx > 0 ? -0.4 : Math.PI + 0.4 - Math.PI * 0.4; g.add(sc); }
        const drop = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.014, -0.01], [0.009, -0.03], [0.012, -0.045], [0, -0.06]], 12), mat.brass); drop.position.set(0, -0.09, 0.012); g.add(drop);
        // S-curved gas arm with a leaf collar and the burner cup
        const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0, 0, 0.02), V3(0, -0.05, 0.1), V3(0, -0.01, 0.18), V3(0, 0.05, 0.2)]), 16, 0.009, 8), mat.brass); g.add(arm);
        const col = new THREE.Mesh(G.latheFromProfile([[0, -0.01], [0.016, -0.01], [0.02, 0.0], [0.014, 0.01], [0, 0.012]], 12).rotateX(Math.PI / 2 - 0.6), mat.brass); col.position.set(0, -0.035, 0.08); g.add(col);
        const cup = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.018, 0], [0.034, 0.012], [0.038, 0.022], [0.03, 0.028], [0, 0.028]], 16), mat.brass); cup.position.set(0, 0.05, 0.2); g.add(cup);
        // frosted tulip shade, open at the top with a crimped lip
        const tulip = G.latheFromProfile([[0.022, 0], [0.03, 0.012], [0.048, 0.04], [0.058, 0.08], [0.062, 0.12], [0.07, 0.15], [0.078, 0.158]], 28);
        const tp = tulip.attributes.position;
        for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); if (y > 0.13) { const a = Math.atan2(tp.getZ(i), tp.getX(i)); const k = 1 + 0.08 * Math.sin(a * 8) * (y - 0.13) / 0.03; tp.setX(i, tp.getX(i) * k); tp.setZ(i, tp.getZ(i) * k); } }
        tulip.computeVertexNormals();
        const shade = new THREE.Mesh(tulip, mat.globe); shade.position.set(0, 0.075, 0.2); g.add(shade);
        const fl = fx.flame({ height: 0.035, width: 0.01, intensity: 3 }); fl.position.set(0, 0.085, 0.2); fl.userData.keep = true; g.add(fl);
        g.position.set(lx.front(x), 1.95, 0.0); s.grp.add(g);
        const wp = new THREE.Vector3(x, 2.15, Z1 - 0.25);
        const l = new THREE.PointLight(0xffa860, 2.2, 6, 2); l.position.copy(wp); root.add(l); sconceLights.push(l);
      };
      sconce(-1.12); sconce(1.12);
      const mg = new THREE.Group();
      const mw = 0.9, mh = 1.5;
      // a real (half-resolution) planar reflection, silvering slightly tarnished
      const mirror = new Reflector(new THREE.PlaneGeometry(mw, mh), { clipBias: 0.003, textureWidth: Math.round(ctx.renderer.domElement.width * 0.5) || 512, textureHeight: Math.round(ctx.renderer.domElement.height * 0.5) || 512, color: 0x8f8a82 });
      mirror.userData.keep = true; mirror.userData.noBake = true; mirror.userData.noShadow = true;
      // the reflection is a whole extra scene render: refresh it only every 20th frame (the room is static but for flames)
      { const orig = mirror.onBeforeRender.bind(mirror); let n = 0; mirror.onBeforeRender = (...args) => { if (n++ % 20 === 0) orig(...args); }; }
      mg.add(mirror);
      const fox = foxingTexture(ctx.textures);
      const foxM = new THREE.MeshStandardMaterial({ map: fox.map, transparent: true, depthWrite: false, roughness: 0.9, metalness: 0, name: 'foxing' });
      const fp = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), foxM); fp.position.z = 0.002; fp.userData.noBake = true; fp.userData.noShadow = true; mg.add(fp);
      // a faint smoky veil over the glass so it reads as old silvering, not a window
      const veil = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), new THREE.MeshBasicMaterial({ color: 0x0a0c12, transparent: true, opacity: 0.28, depthWrite: false }));
      veil.position.z = 0.001; veil.userData.noBake = true; veil.userData.noShadow = true; mg.add(veil);
      carvedFrame(mg, mw, mh, 0.13, 0.08);
      mg.position.set(lx.front(-2.0), 1.95, 0.035); s.grp.add(mg);
    }

    // ================================================================ rugs
    {
      const curl = (w, l, lift) => {
        const g = new THREE.PlaneGeometry(w, l, 48, 64);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const ex = w / 2 - Math.abs(p.getX(i)), ey = (l / 2) * 0.97 - Math.abs(p.getY(i));
          const d = Math.min(ex, ey > 0 ? ey : 1);
          // edges lift slightly (rolled binding) with a gentle wave along the length
          p.setZ(i, lift * Math.exp(-Math.max(d, 0) / 0.025) * (0.6 + 0.4 * Math.sin(p.getY(i) * 3.1 + p.getX(i))));
        }
        g.computeVertexNormals();
        return g;
      };
      const rug = new THREE.Mesh(curl(3.3, 5.0, 0.012), mat.rug);
      rug.rotation.x = -Math.PI / 2; rug.position.set(0.62, 0.008, -0.65); rug.name = 'rug'; add(rug);
      const run = new THREE.Mesh(curl(0.85, 5.8, 0.008), mat.runner);
      run.rotation.x = -Math.PI / 2; run.position.set(-1.72, 0.006, 0.2); run.name = 'runner'; add(run);
    }

    // ================================================================ table, chairs, settings
    const furnMats = { wood: mat.chairWood, top: mat.woodTop, brass: mat.brass, gilt: mat.gilt, seat: mat.seat, metal: mat.silver };
    const table = buildTable(ctx, furnMats, { radius: TABLE_R, height: TABLE_H });
    table.position.copy(T); add(table);
    const backGeo = webBackGeometry(G);
    const napkinG = napkinGeometry(G), cutlery = cutleryGeometries(G);
    const places = [];
    for (let k = 0; k < 6; k++) {
      const phi = THREE.MathUtils.degToRad(30 + 60 * k);
      const dir = V3(Math.sin(phi), 0, Math.cos(phi));
      places.push({ phi, dir });
      const ch = buildChair(ctx, furnMats, { backGeo });
      // the near-right chair is pulled out toward the doorway, its pierced back framing the table from the hero view
      const cphi = k === 0 ? THREE.MathUtils.degToRad(13) : phi, cdir = V3(Math.sin(cphi), 0, Math.cos(cphi));
      const pull = [0.62, 0.06, 0.02, 0.02, 0.08, 0.3][k];
      ch.position.copy(T).addScaledVector(cdir, TABLE_R + 0.2 + pull);
      ch.rotation.y = cphi + Math.PI + [0.12, 0, 0.04, -0.05, 0, -0.1][k];
      add(ch);
      const ps = buildPlaceSetting(ctx, { charger: mat.charger, linen: mat.linen, silver: mat.flatware, crystal: mat.crystal, wine: mat.wine, lace: mat.lace }, { chinaMat: mat.plate, cutlery, napkin: napkinG });
      ps.position.copy(T).addScaledVector(dir, PLACE_R); ps.position.y = TABLE_H;
      ps.rotation.y = phi;
      add(ps);
    }
    // cake stand + cake (the puzzle)
    const STAND_H = 0.15;
    {
      // footed silver pedestal: domed, gadrooned foot, baluster stem with a knop, broad dished plate
      const st = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.13, 0], [0.132, 0.006], [0.125, 0.012], [0.1, 0.022], [0.07, 0.035], [0.045, 0.045], [0.03, 0.055], [0.024, 0.07], [0.034, 0.082], [0.038, 0.09], [0.03, 0.098], [0.02, 0.108], [0.022, 0.12], [0.04, 0.13], [0.09, 0.138], [0.31, 0.142], [0.318, 0.146], [0.314, 0.15], [0.3, STAND_H], [0, STAND_H]], 64), mat.standSilver);
      st.position.set(T.x, TABLE_H, T.z); add(st);
      const doily = new THREE.Mesh(new THREE.CircleGeometry(0.3, 64), mat.lace); doily.rotation.x = -Math.PI / 2; doily.position.set(T.x, TABLE_H + STAND_H + 0.0015, T.z); add(doily);
      // chased rim band on the stand
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.312, 0.006, 8, 96), mat.silver); rim.rotation.x = Math.PI / 2; rim.position.set(T.x, TABLE_H + STAND_H - 0.002, T.z); add(rim);
    }
    // wax only glows where the flame lights it from inside: a gradient emissive mask on the top ~12%
    const waxGrad = (() => {
      const c = document.createElement('canvas'); c.width = 4; c.height = 128;
      const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 128, 0, 0);
      gr.addColorStop(0, '#000'); gr.addColorStop(0.8, '#000'); gr.addColorStop(0.93, '#555'); gr.addColorStop(1, '#fff');
      g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const waxGlow = (candles) => candles.forEach((c) => {
      const w = c.userData.body?.material; if (!w) return;
      w.emissiveMap = waxGrad; w.emissive.setRGB(9, 4.6, 1.6); w.color.setRGB(0.78, 0.74, 0.66); w.roughness = 0.6; w.needsUpdate = true;
    });
    // two small candelabra flanking the cake
    const tableCandles = [];
    for (const [k, phi] of [[0, THREE.MathUtils.degToRad(120)], [1, THREE.MathUtils.degToRad(240)]]) {
      const cb = buildCandelabrum(ctx, { metal: mat.silver }, { arms: 2, armR: 0.1, seed: 5 + k, candleH: 0.16 });
      cb.position.set(T.x + Math.sin(phi) * 0.44, TABLE_H, T.z + Math.cos(phi) * 0.44);
      cb.rotation.y = phi; cb.scale.setScalar(0.9);
      add(cb); tableCandles.push(...cb.userData.candles); waxGlow(cb.userData.candles);
      for (const c of cb.userData.candles) if (c.userData.flame) c.userData.flame.material.uniforms.uIntensity.value = 3;
    }

    // ================================================================ sideboard (left wall) + its candelabrum
    const SB_Z = -0.7;
    {
      const sb = buildSideboard(ctx, furnMats, { w: 1.75, d: 0.55, h: 0.93 });
      sb.position.set(X0 + 0.3, 0, SB_Z); sb.rotation.y = Math.PI / 2; add(sb);
      const cb = buildCandelabrum(ctx, { metal: mat.silver }, { arms: 4, armR: 0.14, seed: 11, candleH: 0.22 });
      cb.position.set(X0 + 0.32, 0.93, SB_Z - 0.45); add(cb); waxGlow(cb.userData.candles);
      // decanter, tray, glasses, fruit
      const tray = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.2, 0], [0.22, 0.012], [0.225, 0.02], [0.21, 0.016], [0, 0.008]], 40), mat.silver);
      tray.position.set(X0 + 0.32, 0.93, SB_Z + 0.2); add(tray);
      const dec = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.065, 0.0], [0.075, 0.03], [0.07, 0.11], [0.04, 0.16], [0.018, 0.2], [0.018, 0.25], [0.026, 0.26], [0.0, 0.26]], 28), mat.crystal);
      dec.position.set(X0 + 0.32, 0.95, SB_Z + 0.17); add(dec);
      const port = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0.0], [0.07, 0.03], [0.066, 0.09], [0.0, 0.09]], 24), mat.wine);
      port.position.set(X0 + 0.32, 0.952, SB_Z + 0.17); add(port);
      const stop = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), mat.crystal); stop.position.set(X0 + 0.32, 0.95 + 0.29, SB_Z + 0.17); add(stop);
      for (const dz of [0.06, 0.3]) { const g = new THREE.Mesh(gobletGeometry(G, 0.7), mat.crystal); g.position.set(X0 + 0.38, 0.95, SB_Z + dz); add(g); }
      const bowl = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0], [0.04, 0.03], [0.025, 0.06], [0.06, 0.075], [0.16, 0.12], [0.165, 0.13], [0, 0.09]], 32), mat.silver);
      bowl.position.set(X0 + 0.3, 0.93, SB_Z + 0.62); add(bowl);
      // fruit: two pears and a bunch of black grapes spilling over the rim
      const pearG = G.latheFromProfile([[0, 0], [0.022, 0.003], [0.034, 0.018], [0.036, 0.035], [0.028, 0.055], [0.018, 0.075], [0.014, 0.09], [0.008, 0.1], [0, 0.102]], 20);
      const pearM = new THREE.MeshPhysicalMaterial({ color: 0x8a7a2a, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.5, name: 'pear' });
      const stalkM = new THREE.MeshStandardMaterial({ color: 0x3a2814, roughness: 0.8 });
      for (const [dx, dz, rx, rz] of [[-0.04, 0.03, 0.15, 0.1], [0.05, -0.02, -0.25, 0.35]]) {
        const pr = new THREE.Mesh(pearG, pearM); pr.position.set(X0 + 0.3 + dx, 0.93 + 0.1, SB_Z + 0.62 + dz); pr.rotation.set(rx, 0, rz); add(pr);
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.002, 0.03, 6), stalkM); st.position.set(0, 0.11, 0); pr.add(st);
      }
      const grapeM = new THREE.MeshPhysicalMaterial({ color: 0x1c0c22, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.4, sheen: 0.6, sheenRoughness: 0.4, sheenColor: new THREE.Color(0.35, 0.32, 0.45), name: 'grape' });
      const gG = new THREE.SphereGeometry(0.0115, 10, 8); gG.scale(1, 1.12, 1);
      const grapes = [];
      for (let i = 0; i < 46; i++) {
        const t = i / 46, a = i * 2.39996, r = 0.045 * (1 - t * 0.8);
        const m = new THREE.Matrix4().makeTranslation(Math.cos(a) * r, 0.04 - t * 0.12 + 0.01 * Math.sin(i * 1.7), Math.sin(a) * r * 0.8);
        grapes.push(gG.clone().applyMatrix4(m));
      }
      const bunch = new THREE.Mesh(G.mergeGeometries(grapes), grapeM);
      bunch.position.set(X0 + 0.36, 0.93 + 0.12, SB_Z + 0.53); bunch.rotation.set(0.2, 0, -1.1); add(bunch);
    }

    // ================================================================ paintings
    const texLoader = new THREE.TextureLoader();
    const loadTex = async (name, srgb = true) => {
      try {
        const t = await texLoader.loadAsync(ctx.assetUrl(name));
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8;
        return t;
      } catch (e) { console.warn('[dining] missing', name); return null; }
    };
    const oil = async (name) => {
      const [map, bump] = await Promise.all([loadTex(`${name}.jpg`), loadTex(`${name}_bump.png`, false)]);
      return new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 1.6, roughness: 0.5, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.5, name: `oil:${name}` });
    };
    const oils = Object.fromEntries(await Promise.all(['lady', 'abbey', 'gent', 'youth', 'vale'].map(async (n) => [n, await oil(n)])));
    const hang = (s, x, y, w, h, opts) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), oils[opts.oil]));
      const fw = opts.frameW ?? 0.11;
      if (fw >= 0.12) carvedFrame(g, w, h, fw, 0.08);
      else g.add(new THREE.Mesh(G.frameGeometry(w, h, { width: fw, depth: 0.05, profile: heavyFrameProfile(fw, 0.045), uvScale: 1 }), mat.frame));
      g.position.set(x, y, 0.035); s.grp.add(g);
      return g;
    };
    hang(S.left, Z1 - SB_Z, 2.05, 1.0, 1.42, { oil: 'lady', frameW: 0.14 });
    /** brass picture light: shaded hood on two swan-neck arms, a soft warm spot washing the canvas */
    const pictureLight = (s, x, y, w, h, intensity) => {
      const g = new THREE.Group();
      const top = y + h / 2 + 0.24;
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, w * 0.42, 24, 1, true, Math.PI * 0.15, Math.PI * 1.2), mat.brass);
      hood.material = mat.brass; hood.rotation.z = Math.PI / 2; hood.position.set(x, top, 0.24); g.add(hood);
      for (const sd of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), mat.brass); cap.rotation.y = sd * Math.PI / 2; cap.position.set(x + sd * w * 0.21, top, 0.24); g.add(cap);
        const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(x + sd * w * 0.12, top - 0.2, 0.0), V3(x + sd * w * 0.12, top - 0.12, 0.12), V3(x + sd * w * 0.12, top, 0.2), V3(x + sd * w * 0.12, top + 0.01, 0.235)]), 16, 0.008, 8), mat.brass);
        g.add(arm);
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 16), mat.brass); plate.rotation.x = Math.PI / 2; plate.position.set(x + sd * w * 0.12, top - 0.2, 0.006); g.add(plate);
      }
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.4, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.75, 0.45).multiplyScalar(3), toneMapped: false }));
      glow.rotation.x = Math.PI / 2; glow.position.set(x, top - 0.035, 0.24); glow.userData.noBake = true; g.add(glow);
      const L = new THREE.SpotLight(0xffc690, intensity, 3.2, 0.75, 0.9, 2);
      L.position.set(x, top - 0.04, 0.26); L.target.position.set(x, y - h * 0.12, 0); g.add(L, L.target);
      s.grp.add(g);
    };
    pictureLight(S.left, Z1 - SB_Z, 2.05, 1.0, 1.42, 2.2);
    pictureLight(S.right, (-1.45 - (Z0 + C)), 2.15, 2.0, 1.25, 3.2);
    hang(S.right, (-1.45 - (Z0 + C)), 2.1, 2.0, 1.25, { oil: 'abbey', frameW: 0.15 });
    hang(S.back, S.back.len / 2 - 1.26, 2.36, 0.24, 0.3, { oil: 'youth', frameW: 0.05 });
    hang(S.back, S.back.len / 2 - 1.26, 1.86, 0.24, 0.3, { oil: 'vale', frameW: 0.05 });
    hang(S.back, S.back.len / 2 + 1.28, 2.08, 0.42, 0.54, { oil: 'gent', frameW: 0.07 });

    // ================================================================ lights
    const moonPos = V3(1.9, 5.4, Z0 - 4.4), moonTarget = V3(-1.05, 0, 0.5);
    const moon = new THREE.SpotLight(0xb2c0e4, 2600, 22, 0.24, 0.35, 2);
    moon.position.copy(moonPos); moon.target.position.copy(moonTarget);
    moon.castShadow = Q.shadows;
    moon.shadow.mapSize.set(Q.shadowMapSize, Q.shadowMapSize);
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.02; moon.shadow.radius = Q.shadowRadius;
    moon.shadow.camera.near = 2; moon.shadow.camera.far = 20;
    moon.map = fx.windowCookie({ cols: 2, rows: 4 });
    root.add(moon, moon.target);
    root.add(new THREE.HemisphereLight(0x5a78c0, 0x1a120c, 1.25));
    // broad cool fill: the moonlit room must read as a blue room, not a black box with three lights.
    // Large, soft, unshadowed panels wash the long walls from the window end and from behind the camera.
    const fills = [
      fx.areaLight({ center: [X0 + 0.9, 2.4, -2.2], normal: [-1, -0.15, 0.25], width: 3.0, height: 1.6, color: 0x7896c8, intensity: 0.55 }),
      fx.areaLight({ center: [X1 - 0.9, 2.4, -2.2], normal: [1, -0.15, 0.25], width: 3.0, height: 1.6, color: 0x7896c8, intensity: 0.55 }),
      fx.areaLight({ center: [0.0, 2.6, Z1 - 0.6], normal: [0, -0.25, -1], width: 4.2, height: 1.8, color: 0x7896c8, intensity: 0.5 }),
      fx.areaLight({ center: [0.0, 2.2, Z0 + 1.6], normal: [0, 0.1, -1], width: 3.6, height: 1.4, color: 0x7896c8, intensity: 0.35 }),
      fx.areaLight({ center: [X1 - 0.6, 1.8, 1.4], normal: [1, 0, -0.1], width: 3.4, height: 1.6, color: 0x7896c8, intensity: 0.4 }),
      fx.areaLight({ center: [X0 + 0.6, 1.8, 1.4], normal: [-1, 0, -0.1], width: 3.4, height: 1.6, color: 0x7896c8, intensity: 0.35 }),
    ];
    for (const f of fills) root.add(f);
    root.add(fx.areaLight({ center: [0, WIN.sill + WIN.h / 2, Z0 + 0.06], normal: [0, -0.3, 1], width: WIN.w - 0.1, height: WIN.h - 0.1, color: 0x8ea6ff, intensity: 2.5 }));
    // gasolier: one shadowed warm light at the globe ring + a soft up-light for the ceiling
    let chandBase = 7, spotK = 0.6;
    const chandLight = new THREE.PointLight(0xffa860, 10, 12, 2);
    chandLight.position.set(T.x, chandY - 0.3, T.z);
    root.add(chandLight);
    // the table's shadow pool comes from a single downward spot (1 shadow pass instead of a cube map's 6)
    const chandSpot = new THREE.SpotLight(0xffa860, 25, 8, 1.05, 0.7, 2);
    chandSpot.position.set(T.x, chandY - 0.32, T.z); chandSpot.target.position.set(T.x, 0, T.z);
    chandSpot.castShadow = Q.shadows;
    chandSpot.shadow.mapSize.set(1024, 1024);
    chandSpot.shadow.bias = -0.0015; chandSpot.shadow.normalBias = 0.02; chandSpot.shadow.radius = 5; chandSpot.shadow.camera.near = 0.2; chandSpot.shadow.camera.far = 6;
    root.add(chandSpot, chandSpot.target);
    const upLight = new THREE.PointLight(0xffa860, 0.6, 4, 2); upLight.position.set(T.x, chandY + 0.12, T.z); root.add(upLight);
    // a soft warm up-spot from the font so the rose, medallion and painted rinceau read overhead
    const upSpot = new THREE.SpotLight(0xffb070, 6, 3.5, 1.15, 1.0, 2);
    upSpot.position.set(T.x, chandY + 0.05, T.z); upSpot.target.position.set(T.x, H, T.z); root.add(upSpot, upSpot.target);
    // warm spill from the lit foyer through the doorway behind the player
    const foyerSpill = fx.areaLight({ center: [0, 1.5, Z1 - 0.05], normal: [0, 0.05, -1], width: 1.5, height: 2.5, color: 0xffc896, intensity: 2.2 });
    root.add(foyerSpill);
    // sideboard candles
    const sbLight = new THREE.PointLight(0xffa04a, 2.0, 3.2, 2); sbLight.position.set(X0 + 0.78, 1.62, SB_Z - 0.3); root.add(sbLight);
    // table candle glow (no shadow)
    let tBase = 1.2;
    const tLight = new THREE.PointLight(0xffa04a, 1.2, 3, 2); tLight.position.set(T.x, TABLE_H + 0.45, T.z + 0.2); root.add(tLight);
    ctx.onUpdate((dt, t) => {
      const f = 0.96 + 0.025 * Math.sin(t * 7.3) * Math.sin(t * 2.9) + 0.015 * Math.sin(t * 13.1);
      chandLight.intensity = chandBase * f; upLight.intensity = 0.6 * f; chandSpot.intensity = chandBase * spotK * f;
      sbLight.intensity = 2.0 * (0.9 + 0.1 * Math.sin(t * 9.7 + 1) * Math.sin(t * 4.1));
      tLight.intensity = tBase * (0.9 + 0.1 * Math.sin(t * 8.3) * Math.sin(t * 3.3 + 2));
    });

    // volumetric moon beam + dust + low mist
    const winCenter = V3(0, WIN.sill + WIN.h / 2, Z0 - 0.05);
    const beamDir = new THREE.Vector3().subVectors(moonTarget, moonPos).normalize();
    const shaft = fx.shaft({ center: winCenter, right: V3(WIN.w / 2, 0, 0), up: V3(0, WIN.h / 2, 0), direction: beamDir, length: 5.2, color: 0x9fb6ff, intensity: 0.32, softness: 0.3, falloff: 1.0, panes: [2, 4], mullion: 0.03, noise: 0.35 });
    root.add(shaft);
    // seen from beside the window the camera looks down the length of the beam and the volume turns into
    // grainy haze over the drapes and wainscot: thin it out there
    { let k = 1; const shaftI = shaft.material?.uniforms?.uIntensity; const base = shaftI?.value ?? 0.32;
      ctx.onUpdate((dt) => { if (!shaftI) return; const cur = ctx.nav?.current; const tgt = cur === 'window' || cur === 'back' ? 0.15 : cur === 'table' ? 0.4 : 1; k += (tgt - k) * Math.min(1, dt * 2); if (ctx.shot) k = tgt; shaftI.value = base * k; }); }
    root.add(fx.dust({ box: new THREE.Box3(V3(-1.5, 0.15, Z0 + 0.2), V3(0.7, 2.6, 0.6)), count: 520, shafts: [shaft], size: 0.009, intensity: 2.0, ambient: 0.0 }));
    root.add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.1, 0, Z0 + 0.1), V3(X1 - 0.1, 0.5, Z1 - 0.3)), color: 0x0b111e, litColor: 0x33425f, density: 0.45, heightFalloff: 4 }));

    // ================================================================ the cake puzzle
    const plates = places.map(({ dir }) => T.clone().addScaledVector(dir, PLACE_R).setY(TABLE_H + 0.012));
    const cakeOrigin = V3(T.x, TABLE_H + STAND_H, T.z);
    const cake = createCakePuzzle(ctx, {
      parent: root, origin: cakeOrigin, side: 0.088, height: 0.1, plates, mats: cakeMats,
      camera: { position: [T.x, 2.15, T.z + 1.02], target: [T.x, TABLE_H + 0.06, T.z + 0.06], fov: 52 },
      onSetup: () => {
        spotK = 0.18; chandBase = 4; tBase = 0.3; chandSpot.penumbra = 1.0; chandSpot.angle = 1.2; mat.woodTop.clearcoatRoughness = 0.5; mat.woodTop.clearcoat = 0.35; mat.woodTop.roughness = 1.4; foyerSpill.intensity = 0.15; sconceLights.forEach((l) => { l.userData.i0 ??= l.intensity; l.intensity = l.userData.i0 * 0.3; });
        ctx.post.set({ exposure: 1.45, bloomThreshold: 1.9, bloomStrength: 0.15, godRayWeight: 0.0, vignette: 0.5 }, 0.8);
      },
      onTeardown: () => { spotK = 0.6; chandBase = 7; tBase = 1.2; chandSpot.penumbra = 0.7; chandSpot.angle = 1.05; mat.woodTop.clearcoatRoughness = 0.22; mat.woodTop.clearcoat = 1; mat.woodTop.roughness = 1; foyerSpill.intensity = 2.2; sconceLights.forEach((l) => { if (l.userData.i0) l.intensity = l.userData.i0; }); ctx.post.reset(1.0); },
      onBeat: () => {
        // the candles gutter, the gasolier dims, and the guests take their seats
        ghostFade.target = 1; chandBase = 4.5; gutter.t = 0;
      },
      onSolved: async (p) => {
        ctx.state.set('dining.cakeServed', true);
        await summonGuests(true);
      },
    });
    if (ctx.state.isSolved(CAKE_ID)) cake.applySolved();

    // ================================================================ ghost guests
    // sculpted, baked period figures (tools/bake_guests.mjs); the seat by the window stays empty
    const guestSeats = [[1, 'pearls'], [2, 'stout'], [4, 'hat'], [5, 'thin']];
    const guestGeos = Object.fromEntries(await Promise.all(guestSeats.map(async ([, n]) => {
      try { return [n, await loadGuestGeometry(ctx.assetUrl(`guest_${n}.bin`), n)]; } catch (e) { console.warn('[dining]', e.message); return [n, null]; }
    })));
    const ghostMats = guestSeats.map((_, i) => createGuestMaterial(ctx, { seed: i * 3.7, color: i % 2 ? 0x92a8e6 : 0x889ee0 }));
    const ghostDepth = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true, opacity: 1, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 });
    ghostDepth.userData.noBake = true;
    const ghosts = guestSeats.filter(([, n]) => guestGeos[n]).map(([k, n], i) => {
      const { phi, dir } = places[k];
      const m = new THREE.Mesh(guestGeos[n], ghostMats[i]);
      m.position.copy(T).addScaledVector(dir, TABLE_R + 0.27);
      m.rotation.y = phi + Math.PI;
      m.renderOrder = 7; m.visible = false; m.userData.keep = true; m.userData.noBake = true; m.userData.seat = k;
      m.frustumCulled = false;
      // (no depth pre-pass: written depth would feed the SSAO and darken the room behind the figures;
      //  back faces are culled instead, so only the outer shell is drawn)
      root.add(m);
      return m;
    });
    const ghostMat = { uniforms: { uOpacity: { set value(v) { ghostMats.forEach((g) => { g.uniforms.uOpacity.value = v; }); }, get value() { return ghostMats[0].uniforms.uOpacity.value; } } } };
    const _gp = new THREE.Vector3();
    /** never let a figure fill the lens: cull a guest within 0.9 m of the camera, or sitting between it and the table */
    const guestClear = (g) => {
      g.getWorldPosition(_gp); _gp.y += 1.0;
      const cam = ctx.camera.position, dg = _gp.distanceTo(cam);
      if (dg < 0.9) return false;
      const dt = Math.hypot(cam.x - T.x, cam.z - T.z), dgt = Math.hypot(_gp.x - T.x, _gp.z - T.z);
      return !(dg < 1.5 && dt > dgt && Math.hypot(cam.x - _gp.x, cam.z - _gp.z) < dt);
    };
    const ghostFade = { v: 0, target: 0 };
    const gutter = { t: 99 };
    const _fw = new THREE.Vector3(), _fd = new THREE.Vector3(), _ft = new THREE.Vector3();
    const allFlames = [...tableCandles].map((c) => c.userData.flame).filter(Boolean);
    const flameBase = allFlames.map((f) => f.material.uniforms.uIntensity.value);
    if (ctx.params.get('ghosts') === '1') { ghostFade.v = ghostFade.target = 1; }   // review: show the spectral guests
    ctx.onUpdate((dt, t) => {
      ghostFade.v += (ghostFade.target - ghostFade.v) * Math.min(1, dt * 1.6);
      gutter.t += dt;
      const gk = gutter.t < 2.5 ? 0.35 + 0.65 * Math.abs(Math.sin(gutter.t * 9.0)) * (gutter.t / 2.5) : 1;
      allFlames.forEach((f, i) => { f.material.uniforms.uIntensity.value = flameBase[i] * gk; });
      const o = ghostFade.v;
      ghostMat.uniforms.uOpacity.value = o;
      // every flame on the table leans toward the guests
      const lean = ghostFade.v * 0.45;
      allFlames.forEach((f) => {
        if (!f.parent) return;
        f.getWorldPosition(_fw); _fd.subVectors(_fw, T).setY(0).normalize();
        _ft.copy(_fw).addScaledVector(_fd, 1); f.parent.worldToLocal(_ft); _ft.sub(f.position).setY(0).normalize();
        f.rotation.z = -lean * _ft.x * (1 + 0.15 * Math.sin(t * 7 + _fw.x * 10)); f.rotation.x = lean * _ft.z;
      });
      ghosts.forEach((g, k) => {
        const seat = places[g.userData.seat];
        g.position.y = Math.sin(t * 0.9 + k) * 0.01;
        g.rotation.y = seat.phi + Math.PI + Math.sin(t * 0.4 + k * 1.7) * 0.05;
        g.visible = o > 0.01 && guestClear(g);
      });
    });
    async function summonGuests(afterCake = false) {
      const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
      ghostFade.target = 1;
      ctx.audio.sfx?.('whoosh');
      await wait(1.2);
      if (afterCake) {
        await ctx.say({ text: 'Six slices, six guests... and not a crumb for the *seventh*.', speaker: 'stauf', speakerName: 'Stauf' });
      }
      await wait(0.6);
      ghostFade.target = 0;
    }

    // ================================================================ nodes, edges, exits
    const nodes = {
      main: { position: [0.2, 1.42, 3.05], target: [-0.15, 1.15, -4.0], fov: 57, label: 'The doorway', look: { yaw: [-45, 45], pitch: [-28, 24] } },
      door: { position: [-0.22, 1.63, 3.6], target: [-0.1, 1.4, 8.0], fov: 58, label: 'The way out' },
      table: { position: [T.x - 0.55, 1.58, T.z + 1.95], target: [T.x, 0.86, T.z], fov: 52, label: 'The table', look: { yaw: [-50, 50], pitch: [-35, 25] }, grade: { exposure: 1.45, bloomStrength: 0.2, godRayWeight: 0.12 } },
      window: { position: [-1.35, 1.62, -1.55], target: [0.35, 1.62, Z0], fov: 60, label: 'The window', look: { yaw: [-70, 70], pitch: [-30, 30] }, grade: { exposure: 1.15, contrast: 1.12 } },
      back: { position: [-0.55, 1.6, -2.15], target: [0.6, 1.35, Z1], fov: 58, label: 'Looking back' },
      sideboard: { position: [-0.7, 1.6, 1.0], target: [X0, 1.35, SB_Z - 0.1], fov: 56, label: 'The sideboard', grade: { bloomStrength: 0.14 } },
    };
    const edges = [
      ['main', 'door', null, { hotspot: { door: { position: [-0.2, 1.4, 5.6], radius: 0.9 }, main: { position: [0.1, 1.4, 0.5], radius: 0.9 } } }],
      ['main', 'table', [[-0.4, 1.6, 2.2]]],
      ['main', 'window', [[-1.15, 1.6, 1.6], [-1.25, 1.6, -0.9]]],
      ['main', 'sideboard', [[-0.5, 1.6, 2.3]]],
      ['table', 'window', [[-1.0, 1.6, 0.6], [-1.15, 1.6, -1.2]]],
      ['table', 'sideboard'],
      ['sideboard', 'window', [[-1.2, 1.6, -1.0]]],
      ['window', 'back'],
      ['back', 'main', [[-1.25, 1.6, -0.6], [-1.0, 1.6, 2.2]], { hotspot: { main: { position: [-0.3, 1.4, 3.2], radius: 0.7 } } }],
    ];
    const exits = [
      { node: 'door', toRoom: 'foyer', toNode: 'center_w', label: 'Back to the foyer', hotspot: { box: { min: [-0.75, 0.1, 3.9], max: [0.75, 2.6, 4.1] } } },
      { node: 'back', toRoom: 'foyer', toNode: 'center_w', label: 'To the foyer', hotspot: { box: { min: [-0.75, 0.1, 3.88], max: [0.75, 2.6, 4.1] } } },
      { node: 'back', toRoom: 'kitchen', toNode: null, label: 'The service door', hotspot: { box: { min: [1.5, 0.1, 3.88], max: [2.4, 2.3, 4.1] } } },
    ];

    // ================================================================ hotspots
    const cakeBox = { min: [T.x - 0.32, TABLE_H, T.z - 0.32], max: [T.x + 0.32, TABLE_H + 0.36, T.z + 0.32] };
    const hotspots = [
      { id: 'cake', nodes: ['main', 'table'], box: cakeBox, cursor: 'puzzle', label: 'The funeral cake', puzzle: cake.puzzle, priority: 2 },
      {
        id: 'guests', nodes: ['main', 'table', 'window'], sphere: { center: T.clone().addScaledVector(places[3].dir, TABLE_R + 0.25).setY(1.0).toArray(), radius: 0.4 }, cursor: 'ghost', label: 'An empty chair',
        onActivate: () => ctx.cinematic(async (c, h) => {
          ctx.post.set({ saturation: 0.55, vignette: 0.62, exposure: 1.6 }, 0.8);
          await ctx.nav.lookAt(V3(T.x, 1.05, T.z), 1.2);
          ghostFade.target = 1;
          chandBase = 4.5;
          await h.wait(1.4);
          await ctx.say({ text: 'A toast — to our host, who is always so *generous* with his hospitality.', speaker: 'guest', speakerName: 'A woman in pearls' });
          ctx.audio.sfx?.('chime', { freq: 1760 });
          await ctx.say({ text: 'Generous? He has not served a single course. We have been sitting here for *years*.', speaker: 'guest', speakerName: 'A stout gentleman' });
          await ctx.say({ text: 'Hush. He is waiting for the last guest to arrive.', speaker: 'guest', speakerName: 'A thin voice' });
          await ctx.say({ text: 'Patience, my dears. Dessert is always the *best* part.', speaker: 'stauf', speakerName: 'Stauf' });
          ghostFade.target = 0; chandBase = 7;
          await h.wait(0.8);
          ctx.post.reset(1.2);
          await ctx.nav.returnToNode(1.0);
        }),
      },
      {
        id: 'painting-left', nodes: ['main', 'sideboard'], box: { min: [X0, 1.4, SB_Z - 0.65], max: [X0 + 0.15, 3.1, SB_Z + 0.65] }, cursor: 'examine', label: 'A lady in black',
        onActivate: () => ctx.ui.caption('A lady in black, painted by candlelight. Her place card is still on the table: the seat nearest the window.', { title: 'The Portrait' }),
      },
      {
        id: 'painting-right', nodes: ['main', 'table', 'back'], box: { min: [X1 - 0.15, 1.4, -2.6], max: [X1, 3.0, -0.3] }, cursor: 'examine', label: 'A ruined abbey',
        onActivate: () => ctx.ui.caption('A ruined abbey by moonlight. Look long enough and a light seems to move behind the great window.', { title: 'The Landscape' }),
      },
      {
        id: 'portrait', nodes: ['window', 'main'], box: { min: [1.0, 1.7, Z0], max: [1.55, 2.45, Z0 + 0.12] }, cursor: 'talk', label: 'A small portrait',
        onActivate: async () => {
          ctx.audio.sfx?.('laugh');
          await ctx.say({ text: 'I sat for that portrait for three days. The painter sat for it... somewhat longer.', speaker: 'stauf', speakerName: 'Stauf' });
        },
      },
      {
        id: 'china', nodes: ['window', 'main', 'table'], box: { min: [X0 - 0.1, 0.95, Z0 - 0.1], max: [X0 + C + 0.1, 2.8, Z0 + C + 0.1] }, cursor: 'examine', label: 'Blue-and-white china',
        onActivate: () => ctx.ui.caption('Willow-pattern plates, every one chipped in the same place, as if bitten.', { title: 'The China Niche' }),
      },
      {
        id: 'china-r', nodes: ['window', 'main', 'table'], box: { min: [X1 - C - 0.1, 0.95, Z0 - 0.1], max: [X1 + 0.1, 2.8, Z0 + C + 0.1] }, cursor: 'examine', label: 'Gilt goblets',
        onActivate: () => ctx.ui.caption('Gilt goblets, dusted daily by no one. The urn on the top shelf is warm to the touch.', { title: 'The China Niche' }),
      },
      {
        id: 'window-look', nodes: ['window'], box: { min: [-WIN.w / 2, WIN.sill, Z0 - 0.4], max: [WIN.w / 2, WIN.sill + WIN.h, Z0] }, cursor: 'examine', label: 'The garden',
        onActivate: () => ctx.ui.caption('Snow on the lawn, and no footprints in it — though the gate stands open.', { title: 'The Window' }),
      },
      {
        id: 'decanter', nodes: ['sideboard', 'main'], box: { min: [X0, 0.93, SB_Z + 0.05], max: [X0 + 0.5, 1.3, SB_Z + 0.35] }, cursor: 'examine', label: 'A decanter',
        onActivate: () => ctx.ui.caption('Port, black as ink. The level has not changed in seventy years, but the stopper is always a little loose.', { title: 'The Decanter' }),
      },
      {
        id: 'gasolier', nodes: ['table', 'main'], sphere: { center: [T.x, chandY, T.z], radius: 0.45 }, cursor: 'examine', label: 'The gasolier',
        onActivate: async () => {
          chandBase = 3; await new Promise((r) => setTimeout(r, 350)); chandBase = 7;
          ctx.ui.caption('The gas hisses. For a moment every flame leans toward the empty chair.', { title: 'The Gasolier' });
        },
      },
    ];

    // ================================================================ QA hooks
    if (typeof window !== 'undefined') {
      const dbg = (window.__debug ||= {});
      dbg.solvers ||= {}; dbg.states ||= {};
      dbg.solvers.dining = async () => {
        const game = window.__game;
        if (game && !game.puzzle && game.room?.mod?.id === 'dining' && game.startPuzzle) {
          game.startPuzzle(cake.puzzle);
          await new Promise((r) => setTimeout(r, 50));
        }
        if (game?.puzzle?.def?.id === CAKE_ID) { cake.puzzle.autoSolve(game.puzzle.pctx); return true; }
        cake.applySolved(); ctx.state.markSolved?.(CAKE_ID);
        return true;
      };
      dbg.states.dining = () => ({ ...cake.state(), isSolved: ctx.state.isSolved(CAKE_ID) });
      dbg.solve ||= (id) => (dbg.solvers[id] ? dbg.solvers[id]() : Promise.reject(new Error(`no solver for ${id}`)));
      dbg.state ||= (id) => (dbg.states[id] ? dbg.states[id]() : null);
      dbg.dining = { ghostMeshes: ghosts, cake, trySlice: cake.trySlice, reset: cake.reset, ghosts: (v) => { ghostFade.v = ghostFade.target = v; ghostMat.uniforms.uOpacity.value = v; ghosts.forEach((g) => { g.visible = v > 0.01 && guestClear(g); }); } };
    }

    // ================================================================ shadows + merge
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const fxLike = o.isPoints || m?.isShaderMaterial || m?.isMeshBasicMaterial || (m?.transparent && (m.opacity ?? 1) < 0.6) || o.userData.noBake;
      o.castShadow = !o.userData.noShadow && !fxLike && !['floor', 'ceiling', 'rug', 'runner'].includes(o.name);
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });
    // walls/floor/ceiling cast shadows only where it matters (moon through the window)
    const merged = mergeStatic(root);
    root.userData.mergedCount = merged;

    const godRays = [{ position: V3(0.15, WIN.sill + 1.3, Z0 - 1.6), color: new THREE.Color(0.72, 0.8, 1.0), strength: 0.85, radius: 0.2 }];

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'main',
      grade: { chromaticAberration: 0.00012, exposure: 2.1, contrast: 1.12, saturation: 0.95, bloomStrength: 0.28, bloomThreshold: 1.7, godRayWeight: 0.1, godRayThreshold: 3.0, vignette: 0.45, aoIntensity: 1.1, aoRadius: 0.4, shadowTint: [0.9, 0.97, 1.1], highlightTint: [1.1, 1.0, 0.86] },
      environment: { position: [0.0, 1.8, 1.2], intensity: 0.8 },
      onEnter() {
        if (!ctx.state.has('dining.greeted')) {
          ctx.state.set('dining.greeted', true);
          setTimeout(() => ctx.say({ text: 'Dinner is served! Well... *almost*.', speaker: 'stauf', speakerName: 'Stauf' }), 1500);
        }
      },
      update(dt, t) {},
      dispose() { const d = window.__debug; if (d) { delete d.dining; if (d.solvers) delete d.solvers.dining; if (d.states) delete d.states.dining; } },
    };
  },
};
