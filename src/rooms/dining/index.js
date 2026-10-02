import * as THREE from 'three';
import { buildChair, webBackGeometry, buildTable, buildSideboard, buildCandelabrum, buildChandelier, buildPlaceSetting, plateGeometry, discUV, gobletGeometry } from './furniture.js';
import { nightGardenTexture, ganacheTexture, spongeTexture, chinaTexture, wallpaperTexture } from './textures.js';
import { createCakePuzzle, cakeMeta, CAKE_ID } from './puzzleCake.js';
import { mergeStatic } from './merge.js';

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
    const wpSet = wallpaperTexture(ctx.textures).withRepeat(1 / 0.9, 1 / 0.9);
    const mat = {
      wall: new THREE.MeshStandardMaterial({ map: wpSet.map, normalMap: wpSet.normalMap, roughnessMap: wpSet.ormMap, aoMap: wpSet.ormMap, roughness: 1, metalness: 0, name: 'wallpaper' }),
      paint: M.create('plaster', { color: [0.09, 0.12, 0.28], cracks: 0.15, stains: 0.35, roughness: 0.7, repeat: [0.7, 0.7] }),
      niche: M.create('plaster', { color: [0.035, 0.045, 0.1], cracks: 0.25, stains: 0.5, repeat: [1, 1] }),
      ceiling: M.create('plaster', { color: [0.1, 0.13, 0.28], cracks: 0.3, stains: 0.45, repeat: [0.45, 0.45] }),
      beam: M.create('plaster', { color: [0.34, 0.07, 0.06], cracks: 0.1, stains: 0.4, roughness: 0.6, repeat: [1, 1] }),
      floor: M.create('parquet', { species: 'walnut', ratio: 5, planksAcross: 2, repeat: [0.95, 0.95], polish: 0.65, wear: 0.45 }),
      wood: M.create('mahogany', { repeat: [1.4, 1.4], color: [0.62, 0.42, 0.36] }),
      woodTop: M.create('mahogany', { repeat: [0.8, 0.8], color: [0.6, 0.4, 0.34] }),
      panel: M.create('wood', { species: 'mahogany', boards: 0, polish: 0.75, repeat: [1.1, 1.1], clearcoat: 0.5, clearcoatRoughness: 0.25, color: [0.36, 0.24, 0.21] }),
      crown: M.create('gilded', { pattern: 0, repeats: 4, wear: 0.45, dirt: 0.55, repeat: [1 / 0.55, 1] }),
      frieze: M.create('gilded', { pattern: 2, repeats: 3, ground: 1, groundColor: [0.03, 0.04, 0.1], wear: 0.35, dirt: 0.5, repeat: [1 / 1.15, 1] }),
      gilt: M.create('gold', { wear: 0.45, dirt: 0.5, repeat: [2, 1] }),
      frame: M.create('gilded', { pattern: 1, repeats: 3, wear: 0.45, dirt: 0.65, repeat: [1 / 0.45, 1] }),
      drape: M.create('velvet', { color: [0.035, 0.075, 0.3], crush: 0.55, repeat: [1.6, 1.6], side: THREE.DoubleSide, sheenColor: [0.12, 0.22, 0.65] }),
      seat: M.create('velvet', { color: [0.1, 0.19, 0.3], crush: 0.4, pattern: 1, repeat: [4, 4], sheenColor: [0.3, 0.45, 0.6] }),
      brass: M.create('brass', { tarnish: 0.3, polish: 0.75, repeat: [3, 3] }),
      glass: M.create('glass', { dirt: 0.55, transparent: true, opacity: 0.12 }),
      rug: M.create('rug', { palette: 'heriz', aspect: 3.3 / 5.0, knots: 220, wear: 0.45, fringe: 0.03, seed: 21, size: big }),
      runner: M.create('rug', { palette: 'kashan', aspect: 0.85 / 5.8, knots: 90, wear: 0.5, fringe: 0.012, seed: 5, size: 1024 }),
      silver: M.basic('silver', { roughness: 0.25, envMapIntensity: 1.3 }),
      crystal: M.basic('crystal', { envMapIntensity: 1.5, opacity: 0.3 }),
      porcelain: M.basic('porcelain'),
      linen: M.basic('cloth', { color: 0xd8d2c4 }),
      iron: M.basic('iron'),
      black: M.basic('black', { color: 0x0a0806 }),
      wine: new THREE.MeshPhysicalMaterial({ color: 0x3a0308, roughness: 0.05, transmission: 0, clearcoat: 1, name: 'wine' }),
    };
    mat.giltDark = M.create('gold', { wear: 0.6, dirt: 0.8, repeat: [2, 1], color: [0.45, 0.4, 0.36] });
    mat.charger = new THREE.MeshStandardMaterial({ color: 0xc89a4a, metalness: 1, roughness: 0.3, envMapIntensity: 1.2, name: 'charger' });
    mat.frost = new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: new THREE.Color(1.0, 0.72, 0.42), emissiveIntensity: 0.8, roughness: 0.4, transparent: true, opacity: 0.9, name: 'frost' });
    mat.globe = new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: new THREE.Color(1.0, 0.7, 0.4), emissiveIntensity: 1.7, roughness: 0.3, name: 'globe' });
    const chinaSet = chinaTexture(ctx.textures, { seed: 1 });
    mat.china = new THREE.MeshPhysicalMaterial({ map: chinaSet.map, normalMap: chinaSet.normalMap, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, name: 'china' });
    const ganSet = ganacheTexture(ctx.textures), spSet = spongeTexture(ctx.textures);
    const cakeMats = {
      ganache: new THREE.MeshPhysicalMaterial({ map: ganSet.map, normalMap: ganSet.normalMap, roughnessMap: ganSet.ormMap, roughness: 1, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.18, name: 'ganache' }),
      sponge: new THREE.MeshStandardMaterial({ map: spSet.map, normalMap: spSet.normalMap, roughnessMap: spSet.ormMap, aoMap: spSet.ormMap, roughness: 1, metalness: 0, name: 'sponge' }),
      cream: new THREE.MeshPhysicalMaterial({ color: 0xe8dcc4, roughness: 0.45, sheen: 0.5, sheenColor: new THREE.Color(1, 0.95, 0.9), name: 'cream' }),
      sugar: new THREE.MeshPhysicalMaterial({ color: 0xf1ebdc, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3, name: 'sugar' }),
      socket: new THREE.MeshStandardMaterial({ color: 0x0b0503, roughness: 0.6, name: 'socket' }),
      stone: new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.75, name: 'tombstone' }),
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
    for (const s of segs) {
      const up = new THREE.Mesh(G.wallWithOpenings(s.len, H - DADO, openUpper[s.name], { uvScale: 1 }), mat.wall);
      up.position.y = DADO; s.grp.add(up);
      const lo = new THREE.Mesh(G.wallWithOpenings(s.len, DADO, openLower[s.name], { uvScale: 1 }), mat.paint);
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
      rose.material = mat.giltDark;
      // acanthus ring: radial leaves (instanced via merge later)
      const leafGeo = new THREE.SphereGeometry(0.06, 8, 6); leafGeo.scale(0.5, 0.25, 1.4);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const l = new THREE.Mesh(leafGeo, mat.giltDark);
        l.position.set(T.x + Math.cos(a) * 0.32, H - 0.035, T.z + Math.sin(a) * 0.32); l.rotation.y = -a + Math.PI / 2; add(l);
      }
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
      // the garden beyond (HDR emissive card)
      const sky = nightGardenTexture(ctx.textures);
      const skyMat = new THREE.MeshBasicMaterial({ map: sky.map, color: new THREE.Color(1, 1, 1).multiplyScalar(4.0), toneMapped: false, name: 'garden' });
      const card = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 6.0), skyMat);
      card.position.set(wx + 0.2, WIN.sill + 1.2, -3.2); card.userData.noBake = false; s.grp.add(card);
      // drapes
      const rodY = FRIEZE_Y - 0.1;
      for (const side of [-1, 1]) {
        const cg = fixNaN(G.curtainGeometry({ width: 0.95, height: rodY + 0.06, folds: 7, depth: 0.07, tieback: 0.5, pool: 0.12, seed: side + 7, segX: 70, segY: 56 }), 70);
        const c = new THREE.Mesh(cg, mat.drape);
        c.position.set(wx + side * (WIN.w / 2 + 0.2), rodY, 0.14);
        if (side > 0) c.scale.x = -1;
        s.grp.add(c);
        // tassel tieback
        const tb = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.025, 0.01], [0.035, 0.05], [0.02, 0.1], [0.01, 0.12], [0, 0.13]], 12), mat.gilt);
        tb.position.set(wx + side * (WIN.w / 2 + 0.43), 1.15, 0.2); tb.rotation.z = Math.PI; s.grp.add(tb);
      }
      // swagged valance: gathered pelmet whose hem dips in three swags, with jabots at the ends
      {
        const vw = WIN.w + 1.25;
        const vg = fixNaN(G.curtainGeometry({ width: vw, height: 0.62, folds: 16, depth: 0.04, gather: 1, seed: 3, segX: 90, segY: 24 }), 90);
        const pos = vg.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i);
          const v = -y / 0.62;
          const u = (x / vw + 0.5) * 2;
          const f = u - Math.floor(u);
          const sw = Math.sin(f * Math.PI);
          const hem = 0.62 * (0.38 + 0.62 * Math.pow(sw, 0.8));
          const yy = -v * hem;
          pos.setXYZ(i, x, yy, pos.getZ(i) + sw * v * 0.06);
        }
        vg.computeVertexNormals();
        const val = new THREE.Mesh(vg, mat.drape); val.position.set(wx, rodY + 0.08, 0.2); s.grp.add(val);
        for (const side of [-1, 1]) {
          const jg = fixNaN(G.curtainGeometry({ width: 0.32, height: 0.95, folds: 4, depth: 0.04, seed: 11 + side, segX: 24, segY: 30 }), 24);
          const j = new THREE.Mesh(jg, mat.drape); j.position.set(wx + side * (vw / 2 - 0.12), rodY + 0.08, 0.23); s.grp.add(j);
        }
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, vw + 0.3, 14), mat.gilt);
        rod.rotation.z = Math.PI / 2; rod.position.set(wx, rodY + 0.09, 0.16); s.grp.add(rod);
        // gilt cornice board over the valance
        const cb = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.1, 0.07), [V3(-vw / 2 - 0.12, 0, 0.3), V3(-vw / 2 - 0.12, 0, 0), V3(vw / 2 + 0.12, 0, 0), V3(vw / 2 + 0.12, 0, 0.3)].map((p) => V3(p.x, p.y, -p.z)), { uvScale: 1 }), mat.gilt);
        cb.position.set(wx, rodY + 0.11, 0.3); cb.scale.z = -1; s.grp.add(cb);
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
          const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.004, r * 0.85, 6), mat.gilt);
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
        const nl = new THREE.PointLight(0xffb070, 0.9, 2.2, 2);
        const wp = new THREE.Vector3(0, NICHE.bottom + h - 0.25, -NICHE.depth + 0.15);
        nl.position.copy(wp); g.add(nl); nicheLights.push(nl);
      }
    }

    // ================================================================ doors (front wall)
    {
      const s = S.front;
      const leaf = (w, h) => {
        const g = new THREE.Group();
        g.add(at(new THREE.Mesh(G.boxUV(w, h, 0.05, 1), mat.panel), 0, h / 2, 0));
        const rows = [[0.55, 0.75], [1.55, 0.95], [2.2, 0.3]].filter(([y, hh]) => y + hh / 2 < h - 0.05);
        for (const [y, hh] of rows) { const p = new THREE.Mesh(G.raisedPanel(w - 0.16, hh, { border: 0.05, bevel: 0.025 }), mat.panel); p.position.set(0, y, 0.025); g.add(p); }
        return g;
      };
      for (const [key, d] of Object.entries(DOORS)) {
        const g = new THREE.Group();
        g.position.set(lx.front(d.x), 0, -0.04);
        if (key === 'foyer') {
          for (const sd of [-1, 1]) { const l = leaf(d.w / 2 - 0.01, d.h - 0.01); l.position.x = sd * d.w / 4; g.add(l); const k = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), mat.brass); k.position.set(sd * 0.07, 1.02, 0.06); g.add(k); }
        } else {
          g.add(leaf(d.w - 0.02, d.h - 0.01));
          const k = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), mat.brass); k.position.set(d.w / 2 - 0.1, 1.0, 0.06); g.add(k);
        }
        const cas = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.12, 0.035), [V3(-d.w / 2 - 0.06, 0, 0), V3(-d.w / 2 - 0.06, d.h + 0.06, 0), V3(d.w / 2 + 0.06, d.h + 0.06, 0), V3(d.w / 2 + 0.06, 0, 0)], { up: V3(0, 0, 1), uvScale: 1, flipOutward: true }), mat.panel);
        cas.position.z = 0.04; g.add(cas);
        // pediment over the foyer door
        if (key === 'foyer') {
          const ped = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.14, 0.1), [V3(-d.w / 2 - 0.2, 0, 0.0), V3(-d.w / 2 - 0.2, 0, -0.16), V3(d.w / 2 + 0.2, 0, -0.16), V3(d.w / 2 + 0.2, 0, 0.0)].map((p) => V3(p.x, p.y, p.z)), { uvScale: 1, flipOutward: true }), mat.gilt);
          ped.position.set(0, d.h + 0.2, 0.2); g.add(ped);
        }
        s.grp.add(g);
      }
    }

    // ================================================================ rugs
    {
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 5.0), mat.rug);
      rug.rotation.x = -Math.PI / 2; rug.position.set(0.62, 0.008, -0.65); rug.name = 'rug'; add(rug);
      const run = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 5.8), mat.runner);
      run.rotation.x = -Math.PI / 2; run.position.set(-1.72, 0.006, 0.2); run.name = 'runner'; add(run);
    }

    // ================================================================ table, chairs, settings
    const furnMats = { wood: mat.wood, top: mat.woodTop, brass: mat.brass, gilt: mat.gilt, seat: mat.seat, metal: mat.silver };
    const table = buildTable(ctx, furnMats, { radius: TABLE_R, height: TABLE_H });
    table.position.copy(T); add(table);
    const backGeo = webBackGeometry(G);
    const places = [];
    for (let k = 0; k < 6; k++) {
      const phi = THREE.MathUtils.degToRad(30 + 60 * k);
      const dir = V3(Math.sin(phi), 0, Math.cos(phi));
      places.push({ phi, dir });
      const ch = buildChair(ctx, furnMats, { backGeo });
      const pull = [0.36, 0.06, 0.02, 0.02, 0.08, 0.3][k];
      ch.position.copy(T).addScaledVector(dir, TABLE_R + 0.2 + pull);
      ch.rotation.y = phi + Math.PI + [0.12, 0, 0.04, -0.05, 0, -0.1][k];
      add(ch);
      const ps = buildPlaceSetting(ctx, { charger: mat.charger, linen: mat.linen, silver: mat.silver, crystal: mat.crystal, wine: mat.wine }, { chinaMat: mat.china });
      ps.position.copy(T).addScaledVector(dir, PLACE_R); ps.position.y = TABLE_H;
      ps.rotation.y = phi;
      add(ps);
    }
    // cake stand + cake (the puzzle)
    const STAND_H = 0.07;
    {
      const st = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.11, 0], [0.11, 0.006], [0.08, 0.014], [0.03, 0.024], [0.022, 0.045], [0.03, 0.055], [0.06, 0.06], [0.31, 0.062], [0.315, 0.066], [0.3, STAND_H], [0, STAND_H]], 48), mat.silver);
      st.position.set(T.x, TABLE_H, T.z); add(st);
    }
    // two small candelabra flanking the cake
    const tableCandles = [];
    for (const [k, a] of [[0, -Math.PI / 2 + 0.0], [1, Math.PI / 2]]) {
      const cb = buildCandelabrum(ctx, { metal: mat.silver }, { arms: 2, armR: 0.1, seed: 5 + k, candleH: 0.16 });
      cb.position.set(T.x + Math.cos(a) * 0.43, TABLE_H, T.z + Math.sin(a) * 0.43);
      cb.rotation.y = a; cb.scale.setScalar(0.9);
      add(cb); tableCandles.push(...cb.userData.candles);
    }

    // ================================================================ sideboard (left wall) + its candelabrum
    const SB_Z = -0.7;
    {
      const sb = buildSideboard(ctx, furnMats, { w: 1.75, d: 0.55, h: 0.93 });
      sb.position.set(X0 + 0.3, 0, SB_Z); sb.rotation.y = Math.PI / 2; add(sb);
      const cb = buildCandelabrum(ctx, { metal: mat.silver }, { arms: 4, armR: 0.14, seed: 11, candleH: 0.22 });
      cb.position.set(X0 + 0.32, 0.93, SB_Z - 0.45); add(cb);
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
      const fruitG = new THREE.SphereGeometry(0.04, 14, 10);
      const fm = [new THREE.MeshPhysicalMaterial({ color: 0x5a0c12, roughness: 0.35, clearcoat: 0.5 }), new THREE.MeshPhysicalMaterial({ color: 0x2a1030, roughness: 0.3, clearcoat: 0.6 })];
      for (let i = 0; i < 7; i++) { const a = i * 2.4; const f = new THREE.Mesh(fruitG, fm[i % 2]); f.position.set(X0 + 0.3 + Math.cos(a) * 0.07 * (i ? 1 : 0), 0.93 + 0.13 + (i ? 0 : 0.05), SB_Z + 0.62 + Math.sin(a) * 0.07 * (i ? 1 : 0)); add(f); }
    }

    // ================================================================ paintings
    const hang = (s, x, y, w, h, opts) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.create('painting', { aspect: w / h, size: opts.size || 1024, ...opts })));
      g.add(new THREE.Mesh(G.frameGeometry(w, h, { width: opts.frameW ?? 0.11, depth: 0.065, uvScale: 1 }), mat.frame));
      // cartouche at the top of the big frames
      if ((opts.frameW ?? 0.11) >= 0.12) {
        const ct = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), mat.gilt); ct.scale.set(1.6, 0.8, 0.35); ct.position.set(0, h / 2 + 0.11, 0.04); g.add(ct);
        for (const sd of [-1, 1]) { const sc = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 14, Math.PI * 1.3), mat.gilt); sc.position.set(sd * 0.16, h / 2 + 0.1, 0.035); sc.rotation.z = sd > 0 ? 0.3 : Math.PI - 0.3 - Math.PI * 0.3; g.add(sc); }
      }
      g.position.set(x, y, 0.035); s.grp.add(g);
      return g;
    };
    hang(S.left, Z1 - SB_Z, 2.25, 1.0, 1.42, { subject: 1, seed: 17, frameW: 0.13, size: 1024 });
    hang(S.right, (-1.45 - (Z0 + C)), 2.2, 2.05, 1.28, { subject: 0, seed: 4, frameW: 0.14, size: 1024 });
    hang(S.back, S.back.len / 2 - 1.26, 2.36, 0.24, 0.3, { subject: 1, seed: 22, frameW: 0.05, size: 512 });
    hang(S.back, S.back.len / 2 - 1.26, 1.86, 0.24, 0.3, { subject: 3, seed: 9, frameW: 0.05, size: 512 });
    hang(S.back, S.back.len / 2 + 1.28, 2.08, 0.42, 0.54, { subject: 1, seed: 31, frameW: 0.07, size: 512 });

    // ================================================================ lights
    const moonPos = V3(0.9, 5.6, Z0 - 4.6), moonTarget = V3(-0.3, 0, 0.2);
    const moon = new THREE.SpotLight(0xa9bfff, 1700, 22, 0.24, 0.4, 2);
    moon.position.copy(moonPos); moon.target.position.copy(moonTarget);
    moon.castShadow = Q.shadows;
    moon.shadow.mapSize.set(Q.shadowMapSize, Q.shadowMapSize);
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.02; moon.shadow.radius = Q.shadowRadius;
    moon.shadow.camera.near = 2; moon.shadow.camera.far = 20;
    moon.map = fx.windowCookie({ cols: 2, rows: 4 });
    root.add(moon, moon.target);
    root.add(new THREE.HemisphereLight(0x5068c0, 0x1c120a, 1.9));
    root.add(fx.areaLight({ center: [0, WIN.sill + WIN.h / 2, Z0 + 0.05], normal: [0, -0.35, 1], width: WIN.w, height: WIN.h, color: 0x8ea6ff, intensity: 6 }));
    // gasolier: one shadowed warm light at the globe ring + a soft up-light for the ceiling
    let chandBase = 10;
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
    const upLight = new THREE.PointLight(0xffa860, 2.0, 6, 2); upLight.position.set(T.x, chandY + 0.12, T.z); root.add(upLight);
    // warm spill from the lit foyer through the doorway behind the player
    root.add(fx.areaLight({ center: [0, 1.5, Z1 - 0.05], normal: [0, 0.05, -1], width: 1.5, height: 2.5, color: 0xffc896, intensity: 2.2 }));
    // sideboard candles
    const sbLight = new THREE.PointLight(0xffa04a, 3.2, 6, 2); sbLight.position.set(X0 + 0.5, 1.35, SB_Z - 0.45); root.add(sbLight);
    // table candle glow (no shadow)
    const tLight = new THREE.PointLight(0xffa04a, 1.6, 4, 2); tLight.position.set(T.x, TABLE_H + 0.45, T.z + 0.2); root.add(tLight);
    ctx.onUpdate((dt, t) => {
      const f = 0.96 + 0.025 * Math.sin(t * 7.3) * Math.sin(t * 2.9) + 0.015 * Math.sin(t * 13.1);
      chandLight.intensity = chandBase * f; upLight.intensity = 2.0 * f; chandSpot.intensity = chandBase * 1.6 * f;
      sbLight.intensity = 3.2 * (0.9 + 0.1 * Math.sin(t * 9.7 + 1) * Math.sin(t * 4.1));
      tLight.intensity = 1.6 * (0.9 + 0.1 * Math.sin(t * 8.3) * Math.sin(t * 3.3 + 2));
    });

    // volumetric moon beam + dust + low mist
    const winCenter = V3(0, WIN.sill + WIN.h / 2, Z0 - 0.05);
    const beamDir = new THREE.Vector3().subVectors(moonTarget, moonPos).normalize();
    const shaft = fx.shaft({ center: winCenter, right: V3(WIN.w / 2, 0, 0), up: V3(0, WIN.h / 2, 0), direction: beamDir, length: 5.2, color: 0x9fb6ff, intensity: 0.55, softness: 0.3, falloff: 1.0, panes: [2, 4], mullion: 0.03, noise: 0.7 });
    root.add(shaft);
    root.add(fx.dust({ box: new THREE.Box3(V3(-1.6, 0.1, Z0 + 0.1), V3(1.4, 3.0, 0.8)), count: 2600, shafts: [shaft], size: 0.011, intensity: 2.2, ambient: 0.05 }));
    root.add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.1, 0, Z0 + 0.1), V3(X1 - 0.1, 0.5, Z1 - 0.3)), color: 0x0b111e, litColor: 0x33425f, density: 0.45, heightFalloff: 4 }));

    // ================================================================ the cake puzzle
    const plates = places.map(({ dir }) => T.clone().addScaledVector(dir, PLACE_R).setY(TABLE_H + 0.012));
    const cakeOrigin = V3(T.x, TABLE_H + STAND_H, T.z);
    const cake = createCakePuzzle(ctx, {
      parent: root, origin: cakeOrigin, side: 0.088, height: 0.1, plates, mats: cakeMats,
      camera: { position: [T.x, 2.12, T.z + 1.05], target: [T.x, TABLE_H, T.z + 0.06], fov: 50 },
      onSolved: async (p) => {
        ctx.state.set('dining.cakeServed', true);
        await summonGuests(true);
      },
    });
    if (ctx.state.isSolved(CAKE_ID)) cake.applySolved();

    // ================================================================ ghost guests
    const ghostMat = fx.ghostMaterial({ color: 0x7c9cff, rimColor: 0xd6e4ff, opacity: 0.0, intensity: 1.15, dissolveY: 0.45, dissolveSoft: 0.5 });
    const ghostGeo = (() => {
      const body = G.latheFromProfile([[0.0, 0.44], [0.17, 0.46], [0.2, 0.6], [0.18, 0.8], [0.2, 0.98], [0.23, 1.08], [0.19, 1.16], [0.07, 1.2], [0.055, 1.26], [0.0, 1.27]], 28);
      const head = new THREE.SphereGeometry(0.1, 20, 14); head.scale(0.9, 1.12, 1); head.translate(0, 1.37, 0.01);
      const parts = [body, head].map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; });
      return G.mergeGeometries(parts);
    })();
    const ghosts = places.map(({ phi, dir }, k) => {
      const m = new THREE.Mesh(ghostGeo, ghostMat);
      m.position.copy(T).addScaledVector(dir, TABLE_R + 0.24);
      m.rotation.y = phi + Math.PI;
      m.rotation.x = -0.05;
      m.renderOrder = 7; m.visible = false; m.userData.keep = true; m.userData.noBake = true;
      root.add(m);
      return m;
    });
    const ghostFade = { v: 0, target: 0 };
    ctx.onUpdate((dt, t) => {
      ghostFade.v += (ghostFade.target - ghostFade.v) * Math.min(1, dt * 1.6);
      const o = ghostFade.v * 0.7;
      ghostMat.uniforms.uOpacity.value = o;
      ghosts.forEach((g, k) => { g.visible = o > 0.01; g.position.y = Math.sin(t * 0.9 + k) * 0.012; g.rotation.y = places[k].phi + Math.PI + Math.sin(t * 0.4 + k * 1.7) * 0.12; });
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
      main: { position: [-0.22, 1.63, 3.72], target: [0.22, 1.36, -4.0], fov: 60, label: 'The doorway', look: { yaw: [-45, 45], pitch: [-28, 24] } },
      door: { position: [-0.22, 1.63, 3.6], target: [-0.1, 1.4, 8.0], fov: 58, label: 'The way out' },
      table: { position: [T.x - 0.55, 1.58, T.z + 1.95], target: [T.x, 0.86, T.z], fov: 52, label: 'The table', look: { yaw: [-50, 50], pitch: [-35, 25] } },
      window: { position: [-0.55, 1.6, -1.95], target: [0.0, 1.75, Z0], fov: 58, label: 'The window', look: { yaw: [-70, 70], pitch: [-30, 30] } },
      back: { position: [-0.55, 1.6, -2.15], target: [0.6, 1.35, Z1], fov: 58, label: 'Looking back' },
      sideboard: { position: [-0.7, 1.6, 1.0], target: [X0, 1.35, SB_Z - 0.1], fov: 56, label: 'The sideboard' },
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
    const cakeBox = { min: [T.x - 0.32, TABLE_H, T.z - 0.32], max: [T.x + 0.32, TABLE_H + 0.3, T.z + 0.32] };
    const hotspots = [
      { id: 'cake', nodes: ['main', 'table'], box: cakeBox, cursor: 'puzzle', label: 'The funeral cake', puzzle: cake.puzzle, priority: 2 },
      {
        id: 'guests', nodes: ['main', 'table', 'window'], sphere: { center: T.clone().addScaledVector(places[3].dir, TABLE_R + 0.25).setY(1.0).toArray(), radius: 0.4 }, cursor: 'ghost', label: 'An empty chair',
        onActivate: () => ctx.cinematic(async (c, h) => {
          ctx.post.set({ saturation: 0.55, vignette: 0.62, exposure: 1.6 }, 0.8);
          await ctx.nav.lookAt(V3(T.x, 1.05, T.z), 1.2);
          ghostFade.target = 1;
          chandBase = 7;
          await h.wait(1.4);
          await ctx.say({ text: 'A toast — to our host, who is always so *generous* with his hospitality.', speaker: 'guest', speakerName: 'A woman in pearls' });
          ctx.audio.sfx?.('chime', { freq: 1760 });
          await ctx.say({ text: 'Generous? He has not served a single course. We have been sitting here for *years*.', speaker: 'guest', speakerName: 'A stout gentleman' });
          await ctx.say({ text: 'Hush. He is waiting for the last guest to arrive.', speaker: 'guest', speakerName: 'A thin voice' });
          await ctx.say({ text: 'Patience, my dears. Dessert is always the *best* part.', speaker: 'stauf', speakerName: 'Stauf' });
          ghostFade.target = 0; chandBase = 10;
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
        id: 'painting-right', nodes: ['main', 'table', 'back'], box: { min: [X1 - 0.15, 1.4, -2.6], max: [X1, 3.0, -0.3] }, cursor: 'examine', label: 'A mountain storm',
        onActivate: () => ctx.ui.caption('Mountains in a storm. The varnish has crazed into a web so fine it seems to move.', { title: 'The Landscape' }),
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
          chandBase = 4; await new Promise((r) => setTimeout(r, 350)); chandBase = 10;
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
      dbg.dining = { cake, trySlice: cake.trySlice, reset: cake.reset };
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
      grade: { exposure: 1.8, contrast: 1.08, saturation: 1.0, bloomStrength: 0.35, bloomThreshold: 1.1, godRayWeight: 0.4, godRayThreshold: 3.0, vignette: 0.45, aoIntensity: 1.1, aoRadius: 0.4 },
      environment: { position: [0.0, 1.8, 1.2], intensity: 0.8 },
      onEnter() {
        if (!ctx.state.has('dining.greeted')) {
          ctx.state.set('dining.greeted', true);
          setTimeout(() => ctx.say({ text: 'Dinner is served! Well... *almost*.', speaker: 'stauf', speakerName: 'Stauf' }), 1500);
        }
      },
      update(dt, t) {},
      dispose() { if (window.__debug?.dining) delete window.__debug.dining; },
    };
  },
};
