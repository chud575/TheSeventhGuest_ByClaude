import * as THREE from 'three';
import { mergeStatic } from '../../engine/lib/contrib/foyer-merge.js';
import {
  flagstoneTexture, wallTileTexture, borderTileTexture, butcherBlockTexture, castIronTexture, copperTexture,
  flourDecalTexture, gardenSkyTexture, boardingTexture, sackTexture, emberTexture, matFrom,
} from './textures.js';
import {
  mk, rbox, lathe, tube, buildOilLamp, buildRange, buildDresser, buildButcherBlock, buildSaucepan, buildScale, buildGasBracket, buildWindsorChair, crock, jarGeo, mergeInto,
} from './props.js';
import { createCansPuzzle, cansMeta, CANS_ID } from './puzzleCans.js';

/**
 * The Kitchen — Stauf's scullery-kitchen, below stairs from the dining room.
 *
 * 6.4 x 7.2 x 3.4 m. Glazed cream tile to 1.25 m with a green majolica border,
 * blue-grey limewash above, smoke-dark oak beams, York-stone flags floured
 * round a butcher's block. Back wall: a cast-iron close range in a brick
 * chimney recess (copper batterie hung on the breast), a sash window over the
 * Belfast sink letting the moon in. Left wall: the painted dresser whose shelves
 * hold Stauf's Superior Soups (the can puzzle). Right wall: the dumbwaiter hatch
 * (bare footprints in the flour lead to it), the bell board and the service door
 * to the dining room. Front wall: the passage to the foyer.
 *
 * Axes: x right as seen from the foyer door, z toward the door, y up.
 */

const X0 = -3.2, X1 = 3.2, Z0 = -3.8, Z1 = 3.4, H = 3.4;
const TILE_TOP = 1.25, BORDER = 0.15, CAP = TILE_TOP + BORDER;
const CH = { x0: -2.3, x1: -0.3, d: 0.5, ax0: -2.0, ax1: -0.6, ah: 1.5 };   // chimney breast + range alcove
const WIN = { x: 1.6, w: 1.1, sill: 1.05, h: 1.8, depth: 0.36 };
const DUMB = { z: -1.2, w: 0.62, y: 0.86, h: 0.74 };
const DOORS = { foyer: { x: 0.55, w: 1.0, h: 2.3 }, dining: { z: 2.25, w: 0.9, h: 2.2 } };
const DRESSER_Z = -1.55;
const BLOCK = new THREE.Vector3(0.2, 0, -0.6);

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);

export default {
  id: 'kitchen',
  title: 'The Kitchen',
  floorName: 'Ground Floor',
  map: { floor: 'ground', rect: [205, 60, 180, 170] },
  start: 'main',
  ambience: { wind: 0.45, creaks: 0.35, clock: 0.5, thunder: 0.2, rain: 0, heartbeat: 0, roomTone: 0.35 },
  music: { key: 43, mood: 'dread' },
  puzzles: [cansMeta],

  async build(ctx) {
    const { materials: M, geometry: G, fx } = ctx;
    const Q = ctx.quality;
    const big = Q.textureSize >= 2048 ? 2048 : 1024;
    const root = new THREE.Group();
    root.name = 'kitchen';
    const add = (o, parent = root) => { parent.add(o); return o; };

    // ================================================================ materials
    const forge = ctx.textures;
    const mat = {
      flags: matFrom(flagstoneTexture(forge, big), { repeat: [1 / 2.4, 1 / 2.4], physical: true, clearcoat: 0.08, clearcoatRoughness: 0.5, name: 'flags' }),
      tile: matFrom(wallTileTexture(forge, 1024), { repeat: [1 / 0.6, 1 / 0.6], physical: true, clearcoat: 0.7, clearcoatRoughness: 0.12, name: 'walltile' }),
      border: matFrom(borderTileTexture(forge, 512), { repeat: [1 / 0.15, 1 / 0.15], physical: true, clearcoat: 0.8, clearcoatRoughness: 0.1, name: 'bordertile' }),
      glazeGreen: new THREE.MeshPhysicalMaterial({ color: 0x0d2a22, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, name: 'glazeGreen' }),
      plaster: M.create('plaster', { color: [0.3, 0.37, 0.44], cracks: 0.4, stains: 0.55, roughness: 0.95, repeat: [0.55, 0.55] }),
      ceiling: M.create('plaster', { color: [0.3, 0.3, 0.31], cracks: 0.5, stains: 0.8, repeat: [0.4, 0.4] }),
      beam: M.create('wood', { species: 'oak', boards: 0, polish: 0.15, wear: 0.7, repeat: [0.9, 0.9], color: [0.42, 0.34, 0.28], clearcoat: 0.0 }),
      pine: M.create('wood', { species: 'pine', boards: 3, polish: 0.1, wear: 0.8, repeat: [1.2, 1.2], color: [0.95, 0.9, 0.82], clearcoat: 0.0 }),
      pineDark: M.create('wood', { species: 'oak', boards: 0, polish: 0.3, wear: 0.6, repeat: [1.5, 1.5], color: [0.55, 0.42, 0.33] }),
      maple: M.create('wood', { species: 'pine', boards: 8, polish: 0.25, wear: 0.6, repeat: [1.2, 1.2], color: [0.82, 0.68, 0.55] }),
      mahogany: M.create('mahogany', { repeat: [1.5, 1.5] }),
      brick: M.create('brick', { soot: 0.85, rows: 8, cols: 4, repeat: [1 / 0.9, 1 / 0.6] }),
      brass: M.create('brass', { tarnish: 0.45, polish: 0.65, repeat: [3, 3] }),
      steel: M.basic('iron', { color: 0x3a3a3c, roughness: 0.4 }),
      soot: new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.95, name: 'soot' }),
      skirting: new THREE.MeshPhysicalMaterial({ color: 0x15191b, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3, name: 'skirting' }),
      glass: M.create('glass', { dirt: 0.75, transparent: true, opacity: 0.2 }),
    };
    const ironSet = castIronTexture(forge, 1024);
    mat.iron = matFrom(ironSet, { repeat: [3, 3], name: 'iron' });
    mat.ironPolished = matFrom(ironSet, { repeat: [3, 3], name: 'ironPolished', roughness: 0.7, envMapIntensity: 1.3 });
    mat.copper = matFrom(copperTexture(forge, 1024), { repeat: [4, 4], name: 'copper', envMapIntensity: 0.75, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.9, color: new THREE.Color(0.62, 0.56, 0.52) });
    mat.butcher = matFrom(butcherBlockTexture(forge, { aspect: 1.5 / 0.78, size: 2048 }), { name: 'butcher' });
    mat.boarding = matFrom(boardingTexture(forge, { color: [0.1, 0.17, 0.2] }), { repeat: [1 / 0.6, 1 / 0.6], name: 'boarding' });
    mat.dresserPaint = matFrom(boardingTexture(forge, { color: [0.13, 0.22, 0.26] }), { repeat: [0.4, 1.5], name: 'dresserPaint' });
    mat.hatch = matFrom(boardingTexture(forge, { color: [0.2, 0.17, 0.12] }), { repeat: [1 / 0.6, 1 / 0.6], name: 'hatch' });
    mat.sack = matFrom(sackTexture(forge), { repeat: [2, 2], name: 'sack' });
    mat.towel = new THREE.MeshStandardMaterial({ color: 0x7d7566, roughness: 0.95, side: THREE.DoubleSide, name: 'towel' });
    mat.emberMap = emberTexture(forge).map;
    mat.stoneware = new THREE.MeshPhysicalMaterial({ color: 0xc8b48c, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2, name: 'stoneware' });
    mat.stonewareBrown = new THREE.MeshPhysicalMaterial({ color: 0x4a2a14, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, name: 'stonewareBrown' });
    mat.porcelain = M.basic('porcelain', { color: 0xe6e1d4 });
    mat.flour = new THREE.MeshStandardMaterial({ color: 0xe4e0d4, roughness: 1, name: 'flourHeap' });
    mat.tinPlate = new THREE.MeshStandardMaterial({ color: 0xb9b5aa, roughness: 0.3, metalness: 1, envMapIntensity: 1.2, name: 'tinPlate' });
    mat.cloth = new THREE.MeshStandardMaterial({ color: 0x6e1a16, roughness: 0.9, side: THREE.DoubleSide, name: 'mantelCloth' });
    mat.rope = new THREE.MeshStandardMaterial({ color: 0x5a4a34, roughness: 1, name: 'rope' });
    mat.herbs = new THREE.MeshStandardMaterial({ color: 0x4a4a2a, roughness: 1, name: 'herbs' });
    mat.ham = new THREE.MeshPhysicalMaterial({ color: 0x5c2a18, roughness: 0.55, clearcoat: 0.3, name: 'ham' });
    mat.muslin = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.95, name: 'muslin' });
    mat.gingham = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide, name: 'gingham' });
    mat.gingham.map = forge.canvas('kitchen:gingham', 128, 128, (g2, w, h) => {
      g2.fillStyle = '#d8d0bf'; g2.fillRect(0, 0, w, h);
      g2.fillStyle = 'rgba(40,62,110,0.55)'; for (let i = 0; i < 4; i++) { g2.fillRect(i * 32, 0, 16, h); g2.fillRect(0, i * 32, w, 16); }
    });
    mat.gingham.map.repeat.set(6, 6);

    // ================================================================ shell helpers
    /** Flat quad: origin at (u=0,y=0), dir = u direction, normal = dir x up. UV = metres from vBase. */
    const face = (origin, dir, u0, u1, y0, y1, m, { vBase = 0, uBase = 0 } = {}) => {
      const d = dir.clone().normalize();
      const p = (u, y) => origin.clone().addScaledVector(d, u).setY(origin.y + y);
      const a = p(u0, y0), b = p(u1, y0), c = p(u1, y1), e = p(u0, y1);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...e.toArray()], 3));
      const n = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
      geo.setAttribute('normal', new THREE.Float32BufferAttribute([...n.toArray(), ...n.toArray(), ...n.toArray(), ...n.toArray()], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([u0 - uBase, y0 - vBase, u1 - uBase, y0 - vBase, u1 - uBase, y1 - vBase, u0 - uBase, y1 - vBase], 2));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      return add(new THREE.Mesh(geo, m));
    };
    /** Moulded casing round an opening, local frame: room at +z, opening x in [-w/2,w/2], y in [y0, y0+h]. */
    const casing = (w, h, y0, prof, m, off = 0.04) => {
      const pr = prof.map((p) => V2(-p.y, p.x));
      const geo = G.sweepProfile(pr, [V3(-w / 2 - off, y0, 0), V3(-w / 2 - off, y0 + h + off, 0), V3(w / 2 + off, y0 + h + off, 0), V3(w / 2 + off, y0, 0)], { up: V3(0, 0, 1), uvScale: 1 });
      return new THREE.Mesh(geo, m);
    };
    /** A banded wall run (tile / border / plaster) from u0..u1 with rectangular openings [{u0,u1,y0,y1}]. */
    const bands = [[0, TILE_TOP, () => mat.tile, 0], [TILE_TOP, CAP, () => mat.border, TILE_TOP], [CAP, H, () => mat.plaster, 0]];
    const wallRun = (origin, dir, u0, u1, openings = []) => {
      for (const [y0, y1, m, vBase] of bands) {
        // split the band into vertical strips at opening edges
        const cuts = new Set([u0, u1]);
        for (const o of openings) { if (o.u0 > u0 && o.u0 < u1) cuts.add(o.u0); if (o.u1 > u0 && o.u1 < u1) cuts.add(o.u1); }
        const xs = [...cuts].sort((a, b) => a - b);
        for (let i = 0; i < xs.length - 1; i++) {
          const a = xs[i], b = xs[i + 1], mid = (a + b) / 2;
          // y-intervals of this strip covered by openings
          const holes = openings.filter((o) => mid > o.u0 && mid < o.u1).map((o) => [Math.max(o.y0, y0), Math.min(o.y1, y1)]).filter(([p, q]) => q > p);
          let ys = [[y0, y1]];
          for (const [p, q] of holes) ys = ys.flatMap(([s, t]) => (q <= s || p >= t ? [[s, t]] : [[s, p], [q, t]].filter(([k, l]) => l - k > 1e-4)));
          for (const [s, t] of ys) face(origin, dir, a, b, s, t, m(), { vBase });
        }
      }
    };

    // ================================================================ floor + ceiling
    {
      const floor = new THREE.Mesh(G.planeUV(X1 - X0, Z1 - Z0, 1), mat.flags);
      floor.rotation.x = -Math.PI / 2; floor.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
      floor.name = 'floor';
      add(floor);
      const ceil = new THREE.Mesh(G.planeUV(X1 - X0, Z1 - Z0, 1), mat.ceiling);
      ceil.rotation.x = Math.PI / 2; ceil.position.set((X0 + X1) / 2, H, (Z0 + Z1) / 2);
      ceil.name = 'ceiling';
      add(ceil);
      // flour spill decal
      const fl = flourDecalTexture(forge, 2048);
      const flourMat = new THREE.MeshStandardMaterial({ map: fl.map, normalMap: fl.normalMap, transparent: true, depthWrite: false, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, name: 'flourDecal' });
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), flourMat);
      decal.rotation.x = -Math.PI / 2; decal.position.set(0, 0.002, -1.15);
      decal.name = 'flour'; decal.renderOrder = 1;
      add(decal);
    }

    // ================================================================ walls
    // back wall (z = Z0), u = x - X0
    wallRun(V3(X0, 0, Z0), V3(1, 0, 0), 0, X1 - X0, [{ u0: WIN.x - WIN.w / 2 - X0, u1: WIN.x + WIN.w / 2 - X0, y0: WIN.sill, y1: WIN.sill + WIN.h }]);
    // left wall (x = X0), u = Z1 - z
    wallRun(V3(X0, 0, Z1), V3(0, 0, -1), 0, Z1 - Z0);
    // right wall (x = X1), u = z - Z0
    wallRun(V3(X1, 0, Z0), V3(0, 0, 1), 0, Z1 - Z0, [
      { u0: DUMB.z - DUMB.w / 2 - Z0, u1: DUMB.z + DUMB.w / 2 - Z0, y0: DUMB.y, y1: DUMB.y + DUMB.h },
      { u0: DOORS.dining.z - DOORS.dining.w / 2 - Z0, u1: DOORS.dining.z + DOORS.dining.w / 2 - Z0, y0: -1, y1: DOORS.dining.h },
    ]);
    // front wall (z = Z1), u = X1 - x
    wallRun(V3(X1, 0, Z1), V3(-1, 0, 0), 0, X1 - X0, [{ u0: X1 - (DOORS.foyer.x + DOORS.foyer.w / 2), u1: X1 - (DOORS.foyer.x - DOORS.foyer.w / 2), y0: -1, y1: DOORS.foyer.h }]);

    // ---- chimney breast (projects CH.d from the back wall, alcove for the range)
    {
      const zf = Z0 + CH.d;
      // front face, u = x - CH.x0
      wallRun(V3(CH.x0, 0, zf), V3(1, 0, 0), 0, CH.x1 - CH.x0, [{ u0: CH.ax0 - CH.x0, u1: CH.ax1 - CH.x0, y0: -1, y1: CH.ah }]);
      // returns (sides)
      wallRun(V3(CH.x0, 0, Z0), V3(0, 0, 1), 0, CH.d);          // faces -x
      wallRun(V3(CH.x1, 0, zf), V3(0, 0, -1), 0, CH.d);         // faces +x
      // alcove: brick back, sides, soffit
      const zb = Z0 + 0.04;
      face(V3(CH.ax0, 0, zb), V3(1, 0, 0), 0, CH.ax1 - CH.ax0, 0, CH.ah, mat.brick);
      face(V3(CH.ax0, 0, zf), V3(0, 0, -1), 0, zf - zb, 0, CH.ah, mat.brick);
      face(V3(CH.ax1, 0, zb), V3(0, 0, 1), 0, zf - zb, 0, CH.ah, mat.brick);
      const soffit = new THREE.Mesh(G.planeUV(CH.ax1 - CH.ax0, zf - zb, 1), mat.soot);
      soffit.rotation.x = Math.PI / 2; soffit.position.set((CH.ax0 + CH.ax1) / 2, CH.ah, (zb + zf) / 2);
      add(soffit);
      // soot-blackened brick arch-bar (iron lintel) across the alcove head
      add(mk(rbox(G, CH.ax1 - CH.ax0 + 0.1, 0.08, 0.04, 0.006), mat.iron, (CH.ax0 + CH.ax1) / 2, CH.ah - 0.04, zf + 0.012));
      // mantel shelf with brackets and a fringed pelmet cloth
      const my = 1.66;
      add(mk(rbox(G, CH.x1 - CH.x0 + 0.24, 0.05, 0.3, 0.01), mat.pineDark, (CH.x0 + CH.x1) / 2, my, zf + 0.13));
      for (const x of [CH.x0 + 0.1, (CH.x0 + CH.x1) / 2, CH.x1 - 0.1]) {
        const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.24, 0); sh.quadraticCurveTo(0.06, -0.04, 0, -0.18); sh.lineTo(0, 0);
        const b = mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 }), 1), mat.pineDark, x + 0.0175, my - 0.025, zf, 0, -Math.PI / 2, 0);
        add(b);
      }
      const cloth = new THREE.Mesh(G.curtainGeometry({ width: CH.x1 - CH.x0 + 0.22, height: 0.16, folds: 22, depth: 0.012, gather: 0.2, seed: 4, segY: 8, segX: 120 }), mat.cloth);
      cloth.position.set((CH.x0 + CH.x1) / 2, my - 0.02, zf + 0.285);
      fixNaN(cloth.geometry, 120);
      add(cloth);
      // bobble fringe on the cloth
      {
        const bob = new THREE.SphereGeometry(0.009, 8, 6);
        const n = 38, list = [];
        for (let i = 0; i < n; i++) list.push({ geo: bob, m: new THREE.Matrix4().makeTranslation(CH.x0 - 0.1 + (i + 0.5) * ((CH.x1 - CH.x0 + 0.2) / n), my - 0.19, zf + 0.29) });
        add(new THREE.Mesh(mergeInto(list), mat.cloth));
      }
      // copper batterie on a brass rail across the breast
      const railY = 2.42, railZ = zf + 0.05;
      add(mk(new THREE.CylinderGeometry(0.012, 0.012, CH.x1 - CH.x0 - 0.1, 16), mat.brass, (CH.x0 + CH.x1) / 2, railY, railZ, 0, 0, Math.PI / 2));
      for (const x of [CH.x0 + 0.08, CH.x1 - 0.08]) add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 10), mat.brass, x, railY, zf + 0.025, Math.PI / 2));
      const pans = [[0.13, 0.1, 0.26], [0.115, 0.09, 0.24], [0.1, 0.08, 0.22], [0.088, 0.07, 0.2], [0.076, 0.062, 0.18], [0.065, 0.055, 0.16]];
      // hung bottom-out: polished copper bases face the room (x->up, y->into wall)
      const basis = new THREE.Matrix4().makeBasis(V3(0, 1, 0), V3(0, 0, -1), V3(-1, 0, 0));
      let px = CH.x0 + 0.2;
      pans.forEach(([r, h, hl], i) => {
        const pan = buildSaucepan(G, mat, r, h, hl);
        const holder = new THREE.Group();
        pan.setRotationFromMatrix(basis);
        // ring at local (r + hl, 0.82h, 0) -> after basis (0, r+hl, -0.82h)
        pan.position.set(0, -(r + hl + 0.012), 0.82 * h);
        holder.add(pan);
        holder.position.set(px + r, railY - 0.005, zf + 0.006 + 0.18 * h);
        holder.rotation.z = (i % 2 ? 1 : -1) * 0.03;
        add(holder);
        add(mk(new THREE.TorusGeometry(0.016, 0.003, 6, 14, Math.PI * 1.3), mat.brass, px + r, railY + 0.012, railZ, 0, Math.PI / 2, 0));
        px += r * 2 + 0.05;
      });
      // a framed needlework sampler above the pans
      {
        const tex = forge.canvas('kitchen:sampler', 512, 640, (g2, W2, H2) => {
          // stitch the design on a coarse grid first, then enlarge it as cross-stitches
          const gw = 64, gh = 80;
          const sc = document.createElement('canvas'); sc.width = gw; sc.height = gh;
          const s2 = sc.getContext('2d');
          s2.fillStyle = '#000'; s2.fillRect(0, 0, gw, gh);
          s2.textAlign = 'center'; s2.textBaseline = 'middle';
          s2.fillStyle = '#7a1a16'; s2.font = 'bold 9px Georgia, serif';
          s2.fillText('ABCDEFGHI', gw / 2, 8); s2.fillText('KLMNOPQRS', gw / 2, 17);
          s2.fillStyle = '#1d3b6a'; s2.font = 'bold 10px Georgia, serif';
          s2.fillText('WASTE', gw / 2, 31); s2.fillText('NOT', gw / 2, 41);
          s2.fillStyle = '#2f4a22'; s2.font = 'bold 8px Georgia, serif';
          s2.fillText('NOT EVEN', gw / 2, 52); s2.fillText('GUESTS', gw / 2, 60);
          s2.fillStyle = '#5a2a14'; s2.fillRect(22, 66, 20, 9); s2.fillStyle = '#7a1a16'; s2.beginPath(); s2.moveTo(20, 66); s2.lineTo(32, 60); s2.lineTo(44, 66); s2.fill();
          s2.strokeStyle = '#7a1a16'; s2.lineWidth = 1; s2.strokeRect(1.5, 1.5, gw - 3, gh - 3);
          const px = s2.getImageData(0, 0, gw, gh).data;
          g2.fillStyle = '#cdbf9c'; g2.fillRect(0, 0, W2, H2);
          // linen weave
          g2.globalAlpha = 0.18; g2.fillStyle = '#6a5a3a';
          for (let y = 0; y < H2; y += 4) g2.fillRect(0, y, W2, 1);
          for (let x = 0; x < W2; x += 4) g2.fillRect(x, 0, 1, H2);
          g2.globalAlpha = 1;
          const cw = W2 / gw, ch = H2 / gh;
          for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
            const i = (y * gw + x) * 4;
            if (px[i] + px[i + 1] + px[i + 2] < 90) continue;
            g2.strokeStyle = `rgb(${px[i]},${px[i + 1]},${px[i + 2]})`; g2.lineWidth = 2.2;
            g2.beginPath(); g2.moveTo(x * cw + 1, y * ch + 1); g2.lineTo((x + 1) * cw - 1, (y + 1) * ch - 1);
            g2.moveTo((x + 1) * cw - 1, y * ch + 1); g2.lineTo(x * cw + 1, (y + 1) * ch - 1); g2.stroke();
          }
          // foxing
          for (let k = 0; k < 30; k++) { g2.fillStyle = 'rgba(120,80,30,0.12)'; g2.beginPath(); g2.arc((k * 97) % W2, (k * 61) % H2, 6 + (k % 5) * 4, 0, Math.PI * 2); g2.fill(); }
        }, { tile: false });
        const sw = 0.4, sh = 0.5;
        const smp = new THREE.Group();
        smp.add(new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, name: 'sampler' })));
        smp.add(mk(G.frameGeometry(sw, sh, { width: 0.045, depth: 0.03, uvScale: 1 }), mat.mahogany));
        smp.position.set((CH.x0 + CH.x1) / 2, 2.95, zf + 0.012);
        add(smp);
      }
      // mantel clutter: brass candlesticks, stoneware jars, a tea caddy, salt pig, a clock
      const mtop = my + 0.025;
      const stick = lathe(G, [[0, 0], [0.05, 0], [0.048, 0.01], [0.02, 0.025], [0.014, 0.06], [0.02, 0.07], [0.012, 0.16], [0.018, 0.2], [0.025, 0.21], [0.012, 0.22], [0, 0.22]], 24);
      for (const x of [CH.x0 + 0.12, CH.x1 - 0.12]) {
        add(mk(stick, mat.brass, x, mtop, zf + 0.15));
        const c = fx.candle({ height: 0.14, radius: 0.01, lit: false, light: false, seed: x * 10 });
        c.position.set(x, mtop + 0.22, zf + 0.15);
        add(c);
      }
      add(mk(crock(G, 0.24, 0.09, 0.55), mat.stonewareBrown, CH.x0 + 0.36, mtop, zf + 0.14));
      add(mk(crock(G, 0.18, 0.07, 0.6), mat.stoneware, CH.x0 + 0.53, mtop, zf + 0.16));
      add(mk(rbox(G, 0.12, 0.15, 0.1, 0.006), mat.copper, CH.x1 - 0.32, mtop + 0.075, zf + 0.15));
      add(mk(lathe(G, [[0, 0], [0.08, 0], [0.09, 0.08], [0.085, 0.13], [0.05, 0.17], [0.0, 0.18]], 28), mat.stonewareBrown, CH.x1 - 0.52, mtop, zf + 0.15));
      // mantel clock (stopped at 11:55) — canvas face
      {
        const faceTex = forge.canvas('kitchen:clockface', 256, 256, (g2, w) => {
          g2.fillStyle = '#e4dcc4'; g2.fillRect(0, 0, w, w);
          g2.translate(w / 2, w / 2);
          g2.strokeStyle = '#2a2018'; g2.lineWidth = 3; g2.beginPath(); g2.arc(0, 0, 118, 0, Math.PI * 2); g2.stroke();
          g2.lineWidth = 1; g2.beginPath(); g2.arc(0, 0, 92, 0, Math.PI * 2); g2.stroke();
          g2.fillStyle = '#2a2018'; g2.font = '600 22px Cinzel, Georgia, serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
          const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
          R.forEach((s, i) => { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; g2.save(); g2.translate(Math.cos(a) * 105, Math.sin(a) * 105); g2.rotate(a + Math.PI / 2); g2.fillText(s, 0, 0); g2.restore(); });
          const hand = (a, l, wd) => { g2.save(); g2.rotate(a); g2.lineWidth = wd; g2.beginPath(); g2.moveTo(0, 12); g2.lineTo(0, -l); g2.stroke(); g2.restore(); };
          hand((11.92 / 12) * Math.PI * 2, 55, 6); hand((55 / 60) * Math.PI * 2, 82, 3.5);
        }, { tile: false });
        const cg = new THREE.Group();
        cg.add(mk(rbox(G, 0.26, 0.3, 0.12, 0.02), mat.mahogany, 0, 0.15, 0));
        cg.add(mk(lathe(G, [[0, 0], [0.1, 0], [0.1, 0.02], [0.0, 0.02]], 32), mat.brass, 0, 0.18, 0.06, Math.PI / 2));
        const fm = new THREE.Mesh(new THREE.CircleGeometry(0.088, 40), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.5 }));
        fm.position.set(0, 0.18, 0.081); cg.add(fm);
        cg.position.set((CH.x0 + CH.x1) / 2 + 0.05, mtop, zf + 0.13);
        add(cg);
      }
    }

    // ---- skirting (dark painted) & tile cap (green glaze bullnose)
    {
      const fo0 = DOORS.foyer.x - DOORS.foyer.w / 2 - 0.1, fo1 = DOORS.foyer.x + DOORS.foyer.w / 2 + 0.1;
      const di0 = DOORS.dining.z - DOORS.dining.w / 2 - 0.1, di1 = DOORS.dining.z + DOORS.dining.w / 2 + 0.1;
      const capProf = G.PROFILES.chairRail(0.045, 0.028);
      const skirtProf = G.PROFILES.baseboard(0.16, 0.022);
      // run from the foyer door counter-clockwise (seen from above): front-left, left, back (with breast), right, front-right
      const zf = Z0 + CH.d;
      const runA = [V3(fo0, 0, Z1), V3(X0, 0, Z1), V3(X0, 0, Z0), V3(CH.x0, 0, Z0), V3(CH.x0, 0, zf), V3(CH.ax0, 0, zf)];
      const runB = [V3(CH.ax1, 0, zf), V3(CH.x1, 0, zf), V3(CH.x1, 0, Z0), V3(X1, 0, Z0), V3(X1, 0, di0)];
      const runC = [V3(X1, 0, di1), V3(X1, 0, Z1), V3(fo1, 0, Z1)];
      const lift = (pts, y) => pts.map((p) => V3(p.x, y, p.z));
      for (const run of [runA, runB, runC]) add(new THREE.Mesh(G.sweepProfile(skirtProf, run, { uvScale: 1 }), mat.skirting));
      // cap rail, broken by the window (back wall) and the dumbwaiter
      const wl = WIN.x - WIN.w / 2 - 0.06, wr = WIN.x + WIN.w / 2 + 0.06, d0 = DUMB.z - DUMB.w / 2 - 0.05, d1 = DUMB.z + DUMB.w / 2 + 0.05;
      const capRuns = [runA, [V3(CH.ax1, 0, zf), V3(CH.x1, 0, zf), V3(CH.x1, 0, Z0), V3(wl, 0, Z0)], [V3(wr, 0, Z0), V3(X1, 0, Z0), V3(X1, 0, d0)], [V3(X1, 0, d1), V3(X1, 0, di0)], runC];
      for (const run of capRuns) add(new THREE.Mesh(G.sweepProfile(capProf, lift(run, CAP - 0.02), { uvScale: 1 }), mat.glazeGreen));
      // cornice (simple cove) all round, painted
      const cove = [V2(0, 0), V2(0.01, 0), V2(0.01, 0.012)];
      for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; cove.push(V2(0.01 + 0.11 * (1 - Math.cos(a)) * 0 + 0.11 * Math.sin(a), 0.012 + 0.11 * (1 - Math.cos(a)))); }
      cove.push(V2(0.13, 0.125), V2(0.13, 0.14), V2(0, 0.14));
      const corn = [V3(X0, H - 0.14, Z0), V3(CH.x0, H - 0.14, Z0), V3(CH.x0, H - 0.14, zf), V3(CH.x1, H - 0.14, zf), V3(CH.x1, H - 0.14, Z0), V3(X1, H - 0.14, Z0), V3(X1, H - 0.14, Z1), V3(X0, H - 0.14, Z1)];
      add(new THREE.Mesh(G.sweepProfile(cove, corn, { closed: true, uvScale: 1 }), mat.plaster));
    }

    // ================================================================ beams
    for (const z of [-2.85, -1.45, -0.05, 1.35, 2.75]) {
      const x0 = z < Z0 + CH.d + 0.1 ? X0 : X0;
      add(mk(rbox(G, X1 - x0, 0.24, 0.19, 0.02, 2), mat.beam, (x0 + X1) / 2, H - 0.12, z)).name = 'beam';
      // iron hooks
      for (let i = 0; i < 4; i++) add(mk(new THREE.TorusGeometry(0.02, 0.004, 6, 12, Math.PI * 1.4), mat.iron, X0 + 0.9 + i * 1.5, H - 0.26, z, 0, 0, Math.PI * 0.7));
    }

    // ================================================================ range
    const range = buildRange(ctx, mat);
    range.group.position.set((CH.ax0 + CH.ax1) / 2, 0, Z0 + 0.04 + 0.6 + 0.02);
    add(range.group);

    // ================================================================ window + sink
    {
      const ux0 = WIN.x - WIN.w / 2, ux1 = WIN.x + WIN.w / 2, top = WIN.sill + WIN.h;
      // deep reveals
      face(V3(ux0, 0, Z0 - WIN.depth), V3(0, 0, 1), 0, WIN.depth, WIN.sill, top, mat.plaster);
      face(V3(ux1, 0, Z0), V3(0, 0, -1), 0, WIN.depth, WIN.sill, top, mat.plaster);
      const head = new THREE.Mesh(G.planeUV(WIN.w, WIN.depth, 1), mat.plaster);
      head.rotation.x = Math.PI / 2; head.position.set(WIN.x, top, Z0 - WIN.depth / 2); add(head);
      // tiled sill (slopes slightly)
      add(mk(rbox(G, WIN.w + 0.1, 0.04, WIN.depth + 0.08, 0.008), mat.glazeGreen, WIN.x, WIN.sill - 0.02, Z0 - WIN.depth / 2 + 0.04));
      // architrave (thin painted) round the opening
      const arch = casing(WIN.w, WIN.h, WIN.sill, G.PROFILES.chairRail(0.08, 0.025), mat.dresserPaint, 0.0);
      arch.position.set(WIN.x, 0, Z0);
      add(arch);
      // sashes: 6-over-6
      const sg = new THREE.Group(); sg.name = 'sash';
      const fm = new THREE.MeshStandardMaterial({ color: 0x1c2326, roughness: 0.6, name: 'sashPaint' });
      const bar = (w, h, x, y, z, d = 0.045) => sg.add(mk(new THREE.BoxGeometry(w, h, d), fm, x, y, z));
      const half = WIN.h / 2;
      for (const [y0, z] of [[0, 0.03], [half - 0.02, -0.02]]) {
        bar(WIN.w, 0.05, 0, y0 + 0.025, z); bar(WIN.w, 0.04, 0, y0 + half - 0.02 + (y0 ? 0.02 : 0), z);
        bar(0.05, half + 0.02, -WIN.w / 2 + 0.025, y0 + half / 2, z); bar(0.05, half + 0.02, WIN.w / 2 - 0.025, y0 + half / 2, z);
        for (const x of [-WIN.w / 6, WIN.w / 6]) bar(0.022, half, x, y0 + half / 2, z, 0.03);
        bar(WIN.w, 0.022, 0, y0 + half / 2, z, 0.03);
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w - 0.06, half - 0.04), mat.glass);
        glass.position.set(0, y0 + half / 2, z); glass.userData.noShadow = true;
        sg.add(glass);
      }
      // sash lift handles & catch
      sg.add(mk(new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI), mat.brass, -0.3, 0.1, 0.06, 0, 0, Math.PI));
      sg.add(mk(new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI), mat.brass, 0.3, 0.1, 0.06, 0, 0, Math.PI));
      sg.add(mk(rbox(G, 0.08, 0.015, 0.03, 0.004), mat.brass, 0, half + 0.0, 0.03));
      sg.position.set(WIN.x, WIN.sill, Z0 - WIN.depth * 0.55);
      add(sg);
      sg.traverse((o) => { if (o.userData.noShadow) o.castShadow = false; });
      // garden beyond
      const sky = gardenSkyTexture(forge, 1024);
      const skyMat = new THREE.MeshBasicMaterial({ map: sky.map, color: new THREE.Color(1, 1, 1).multiplyScalar(3.2), toneMapped: false, name: 'garden' });
      const skyM = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), skyMat);
      skyM.position.set(WIN.x - 0.4, WIN.sill + 1.2, Z0 - 2.6);
      skyM.userData.noBake = true;
      add(skyM);
      // Belfast sink on brick piers
      const sinkG = new THREE.Group();
      const sw = 0.76, sh = 0.26, sd = 0.48, t = 0.04, sy = 0.62;
      sinkG.add(mk(rbox(G, sw, t, sd, 0.015), mat.porcelain, 0, sy + t / 2, 0));
      sinkG.add(mk(rbox(G, sw, sh, t, 0.015), mat.porcelain, 0, sy + sh / 2, sd / 2 - t / 2));
      sinkG.add(mk(rbox(G, sw, sh, t, 0.015), mat.porcelain, 0, sy + sh / 2, -sd / 2 + t / 2));
      for (const s of [-1, 1]) sinkG.add(mk(rbox(G, t, sh, sd, 0.015), mat.porcelain, s * (sw / 2 - t / 2), sy + sh / 2, 0));
      sinkG.add(mk(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 20), mat.steel, 0, sy + t + 0.002, 0));
      for (const s of [-1, 1]) sinkG.add(mk(rbox(G, 0.12, sy, sd - 0.06, 0.004), mat.brick, s * (sw / 2 - 0.08), sy / 2, -0.02));
      // gingham skirt between the piers
      const skirt = new THREE.Mesh(G.curtainGeometry({ width: sw - 0.3, height: sy - 0.03, folds: 9, depth: 0.025, seed: 12, segX: 80, segY: 20 }), mat.gingham);
      fixNaN(skirt.geometry, 80);
      skirt.position.set(0, sy - 0.01, sd / 2 - 0.08); sinkG.add(skirt);
      // brass pillar taps from the wall + a long swan-neck pump spout
      for (const s of [-1, 1]) {
        sinkG.add(mk(tube([[s * 0.13, sy + 0.5, -sd / 2], [s * 0.13, sy + 0.5, -sd / 2 + 0.12], [s * 0.13, sy + 0.42, -sd / 2 + 0.16]], 0.012, 12, 10), mat.brass));
        sinkG.add(mk(lathe(G, [[0, 0], [0.02, 0], [0.024, 0.02], [0.006, 0.03], [0.006, 0.05], [0.03, 0.055], [0.0, 0.06]], 16), mat.brass, s * 0.13, sy + 0.5, -sd / 2 + 0.12));
      }
      // scrubbing brush, enamel jug
      sinkG.add(mk(rbox(G, 0.16, 0.035, 0.06, 0.01), mat.pineDark, -0.2, sy + sh + 0.02, sd / 2 - 0.02, 0, 0.3, 0));
      sinkG.add(mk(lathe(G, [[0, 0], [0.06, 0], [0.065, 0.1], [0.05, 0.18], [0.055, 0.2], [0.0, 0.2]], 24), mat.porcelain, 0.48, 0.88, -0.05));
      sinkG.position.set(WIN.x, 0, Z0 + sd / 2 + 0.02);
      add(sinkG);
      // wooden draining board / counter to the left of the sink
      add(mk(rbox(G, 0.95, 0.05, 0.56, 0.008), mat.pine, WIN.x - 0.86, 0.865, Z0 + 0.28, 0, 0, 0.0));
      add(mk(rbox(G, 0.9, 0.78, 0.5, 0.006), mat.dresserPaint, WIN.x - 0.86, 0.43, Z0 + 0.25));
      for (let i = 0; i < 2; i++) add(mk(G.raisedPanel(0.4, 0.58, { border: 0.05, bevel: 0.02 }), mat.dresserPaint, WIN.x - 1.08 + i * 0.44, 0.42, Z0 + 0.5));
      // plate rack above the counter with willow plates
      const rx0 = WIN.x - 1.3, rx1 = WIN.x - 0.42, ry = 1.62;
      for (const y of [ry, ry + 0.34]) {
        add(mk(rbox(G, rx1 - rx0, 0.025, 0.2, 0.004), mat.dresserPaint, (rx0 + rx1) / 2, y, Z0 + 0.1));
        for (let i = 0; i < 18; i++) add(mk(new THREE.CylinderGeometry(0.004, 0.004, 0.26, 6), mat.dresserPaint, rx0 + 0.03 + i * ((rx1 - rx0 - 0.06) / 17), y + 0.13, Z0 + 0.17));
      }
      for (const s of [rx0, rx1]) add(mk(rbox(G, 0.025, 0.66, 0.2, 0.004), mat.dresserPaint, s, ry + 0.3, Z0 + 0.1));
      const plateGeo = lathe(G, [[0, 0], [0.07, 0], [0.075, 0.004], [0.1, 0.008], [0.12, 0.016], [0.118, 0.019], [0.095, 0.012], [0.07, 0.006], [0, 0.006]], 40);
      const willow = forge.canvas('kitchen:willow', 256, 256, (g2, w) => {
        g2.fillStyle = '#e8e4da'; g2.fillRect(0, 0, w, w);
        g2.translate(w / 2, w / 2);
        g2.strokeStyle = '#1f3d8a'; g2.fillStyle = '#2a4a9a';
        g2.lineWidth = 10; g2.beginPath(); g2.arc(0, 0, 118, 0, Math.PI * 2); g2.stroke();
        g2.lineWidth = 2; g2.beginPath(); g2.arc(0, 0, 80, 0, Math.PI * 2); g2.stroke();
        for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g2.beginPath(); g2.arc(Math.cos(a) * 100, Math.sin(a) * 100, 7, 0, Math.PI * 2); g2.fill(); }
        g2.globalAlpha = 0.8; g2.beginPath(); g2.moveTo(-50, 30); g2.lineTo(-10, -20); g2.lineTo(30, 30); g2.closePath(); g2.fill();
        g2.fillRect(-60, 30, 120, 6); g2.beginPath(); g2.arc(30, -30, 16, 0, Math.PI * 2); g2.fill();
      }, { tile: false });
      const plateMat = new THREE.MeshPhysicalMaterial({ map: willow, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, name: 'willowPlate' });
      // planar UV for the plate face
      { const p = plateGeo.attributes.position, uv = plateGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.24 + 0.5, p.getZ(i) / 0.24 + 0.5); }
      for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
        const pm = mk(plateGeo, plateMat, rx0 + 0.1 + i * 0.13 + row * 0.05, ry + 0.135 + row * 0.34, Z0 + 0.1, Math.PI / 2 - 0.12, 0, 0);
        add(pm);
      }
    }

    // ================================================================ dresser + puzzle
    const dresser = buildDresser(ctx, mat, { L: 1.9 });
    dresser.group.position.set(X0, 0, DRESSER_Z);
    dresser.group.rotation.y = Math.PI / 2;
    add(dresser.group);
    // pantry clutter: crocks & jars on the upper shelves, bowls on the worktop
    {
      const dg = dresser.group;
      const L = dresser.L;
      const [s4, s5] = dresser.extraShelves;
      const jar = jarGeo(G, 0.17, 0.055);
      const jarGlass = new THREE.MeshPhysicalMaterial({ color: 0x9fb39c, roughness: 0.1, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1, name: 'jarGlass' });
      const preserve = [0x5a1410, 0x6b3a0c, 0x2f3a12, 0x4a0c22];
      const fillMats = preserve.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, name: 'preserve' }));
      for (let i = 0; i < 9; i++) {
        const x = -L / 2 + 0.16 + i * 0.19;
        add(mk(jar, jarGlass, x, s4, 0.15), dg);
        add(mk(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 20), fillMats[i % 4], x, s4 + 0.065, 0.15), dg);
        add(mk(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 20), mat.muslin, x, s4 + 0.165, 0.15), dg);
      }
      for (let i = 0; i < 6; i++) {
        const x = -L / 2 + 0.2 + i * 0.3;
        const h = 0.2 + (i % 3) * 0.04;
        add(mk(crock(G, h, 0.08 + (i % 2) * 0.015, 0.6), i % 2 ? mat.stoneware : mat.stonewareBrown, x, s5, 0.15), dg);
      }
      // outside the can rows: a mortar & pestle, a salt box, tins
      const [ry0, ry1, ry2] = dresser.shelves.map((s) => s.y);
      add(mk(lathe(G, [[0, 0], [0.06, 0], [0.075, 0.05], [0.07, 0.09], [0.055, 0.09], [0.05, 0.04], [0, 0.03]], 28), mat.stoneware, L / 2 - 0.15, ry1, 0.15), dg);
      add(mk(rbox(G, 0.12, 0.18, 0.1, 0.01), mat.pineDark, -L / 2 + 0.14, ry2, 0.14), dg).position.y = ry2 + 0.09;
      add(mk(crock(G, 0.15, 0.06), mat.stonewareBrown, L / 2 - 0.13, ry2, 0.15), dg);
      add(mk(jar, jarGlass, -L / 2 + 0.13, ry1, 0.15), dg);
      add(mk(jar, jarGlass, L / 2 - 0.13, ry0, 0.15), dg);
      add(mk(jar, jarGlass, -L / 2 + 0.13, ry0, 0.15), dg);
      // jugs and mugs hanging from cup hooks along the shelf fronts (between the can rows)
      {
        const mug = lathe(G, [[0, 0], [0.036, 0], [0.038, 0.01], [0.037, 0.075], [0.04, 0.085], [0.034, 0.085], [0.032, 0.012], [0, 0.01]], 24);
        const jug = lathe(G, [[0, 0], [0.04, 0], [0.05, 0.03], [0.052, 0.07], [0.04, 0.1], [0.038, 0.115], [0.046, 0.125], [0.04, 0.127], [0.032, 0.11], [0, 0.1]], 24);
        const enamel = new THREE.MeshPhysicalMaterial({ color: 0xe6e2d6, roughness: 0.25, clearcoat: 0.8, name: 'enamelMug' });
        const blueRim = new THREE.MeshPhysicalMaterial({ color: 0x1c2f66, roughness: 0.25, clearcoat: 0.8, name: 'enamelBlue' });
        const ys = [dresser.shelves[0].y, dresser.shelves[1].y];
        ys.forEach((yy, r) => {
          for (let k = 0; k < 5; k++) {
            const x = -L / 2 + 0.2 + k * ((L - 0.4) / 4) + (r ? 0.1 : 0);
            const hook = mk(new THREE.TorusGeometry(0.008, 0.0016, 6, 12, Math.PI * 1.4), mat.brass, x, yy - 0.035, dresser.SD - 0.012, 0, Math.PI / 2, 0);
            add(hook, dg);
            const isJug = (k + r) % 2 === 0;
            const m = mk(isJug ? jug : mug, (k + r) % 3 === 0 ? blueRim : enamel, x, yy - 0.05 - (isJug ? 0.128 : 0.088), dresser.SD - 0.012 + 0.0, 0, k * 0.7, 0);
            add(m, dg);
            add(mk(new THREE.TorusGeometry(0.022, 0.005, 6, 12), (k + r) % 3 === 0 ? blueRim : enamel, x + 0.045, yy - 0.05 - (isJug ? 0.07 : 0.045), dresser.SD - 0.012), dg);
          }
        });
      }
      // paraffin lamp at the near end of the worktop: warm raking light up the shelves
      const lamp = buildOilLamp(ctx, mat);
      lamp.group.position.set(0.7, dresser.BH, 0.3);
      add(lamp.group, dg);
      const lampLight = new THREE.PointLight(0xffa456, 2.4, 5, 2);
      lampLight.position.set(0.7, dresser.BH + lamp.flameY + 0.05, 0.36);
      add(lampLight, dg);
      ctx.onUpdate((dt, t) => { lampLight.intensity = 2.4 * (0.95 + 0.05 * Math.sin(t * 5.1) * Math.sin(t * 2.3)); });
      // worktop: mixing bowl, a crock of wooden spoons
      add(mk(lathe(G, [[0, 0], [0.08, 0], [0.16, 0.08], [0.18, 0.13], [0.175, 0.135], [0.15, 0.09], [0.0, 0.02]], 40), mat.stoneware, 0.2, dresser.BH, 0.28), dg);
      add(mk(crock(G, 0.18, 0.065, 0.95), mat.stonewareBrown, -0.55, dresser.BH, 0.3), dg);
      for (let i = 0; i < 4; i++) {
        const sp = new THREE.Group();
        sp.add(mk(new THREE.CylinderGeometry(0.007, 0.006, 0.22, 8), mat.pine, 0, 0.11, 0));
        sp.add(mk(new THREE.SphereGeometry(0.022, 12, 8), mat.pine, 0, 0.23, 0)).scale.set(1, 1.4, 0.4);
        sp.position.set(-0.55 + (i - 1.5) * 0.015, dresser.BH + 0.05, 0.3);
        sp.rotation.set((i - 1.5) * 0.15, i, (i % 2 ? 0.15 : -0.12));
        add(sp, dg);
      }
    }
    const camDist = 1.42;
    const shelfMidY = (dresser.shelves[0].y + dresser.shelves[2].y) / 2 + 0.05;
    const cans = await createCansPuzzle(ctx, dresser.group, dresser.shelves, {
      tinMat: mat.tinPlate,
      camera: { position: [X0 + camDist, shelfMidY + 0.02, DRESSER_Z], target: [X0, shelfMidY, DRESSER_Z], fov: 46 },
      onSolved: async () => { revealDumbwaiter(true); await say('A pinch of salt, a splash of sherry... and a *guest*. Somewhere above you, the dumbwaiter begins to move.'); },
    });

    // ================================================================ butcher block + props
    const blk = buildButcherBlock(ctx, mat, { W: 1.5, D: 0.78 });
    blk.group.position.copy(BLOCK);
    add(blk.group);
    const TY = blk.TOPY;
    let candle;
    {
      const bg = blk.group;
      // cleaver bitten into the block
      const cl = new THREE.Group();
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(0, 0); bladeShape.lineTo(0.2, 0); bladeShape.lineTo(0.21, 0.1); bladeShape.lineTo(0.0, 0.11); bladeShape.lineTo(0, 0);
      const blade = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.002, bevelSegments: 1 });
      cl.add(mk(G.applyBoxUVs(blade, 6), mat.steel));
      cl.add(mk(rbox(G, 0.13, 0.024, 0.02, 0.008), mat.mahogany, -0.06, 0.08, 0.002));
      for (const x of [-0.03, -0.09]) cl.add(mk(new THREE.CylinderGeometry(0.004, 0.004, 0.024, 8), mat.brass, x, 0.08, 0.002, Math.PI / 2));
      cl.position.set(0.42, TY - 0.025, 0.12); cl.rotation.set(0.1, 0.7, -0.15);
      add(cl, bg);
      // rolling pin, dough in a heap of flour, the scale, a bowl of eggs, a candle in a chamberstick
      add(mk(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 24), mat.maple, -0.1, TY + 0.03, 0.2, 0, 0.4, Math.PI / 2), bg);
      for (const s of [-1, 1]) add(mk(new THREE.CylinderGeometry(0.012, 0.014, 0.1, 12), mat.maple, -0.1 + s * 0.2 * Math.cos(0.4), TY + 0.03, 0.2 - s * 0.2 * Math.sin(0.4), 0, 0.4, Math.PI / 2), bg);
      add(mk(lathe(G, [[0, 0], [0.22, 0], [0.16, 0.025], [0.08, 0.05], [0.0, 0.06]], 40), mat.flour, -0.4, TY, 0.05), bg).scale.set(1, 1, 0.8);
      add(mk(new THREE.SphereGeometry(0.075, 32, 20), new THREE.MeshPhysicalMaterial({ color: 0xd8c39a, roughness: 0.7, sheen: 0.4, name: 'dough' }), -0.38, TY + 0.06, 0.06), bg).scale.set(1.15, 0.55, 1);
      const scale = buildScale(G, mat);
      scale.position.set(-0.45, TY, -0.25); scale.rotation.y = 0.2;
      add(scale, bg);
      const bowl = lathe(G, [[0, 0], [0.06, 0], [0.12, 0.06], [0.13, 0.085], [0.122, 0.085], [0.11, 0.06], [0.0, 0.012]], 36);
      add(mk(bowl, mat.stonewareBrown, 0.0, TY, -0.2), bg);
      const egg = new THREE.SphereGeometry(0.022, 16, 12);
      const eggMat = new THREE.MeshStandardMaterial({ color: 0xcdb08a, roughness: 0.6, name: 'egg' });
      [[0.0, 0.05, -0.18], [0.03, 0.05, -0.22], [-0.03, 0.055, -0.21], [0.01, 0.075, -0.2]].forEach(([x, y, z]) => add(mk(egg, eggMat, x, TY + y, z), bg).scale.set(1, 1.3, 1));
      // spare soup tin, opened, on its side
      add(mk(new THREE.CylinderGeometry(0.039, 0.039, 0.11, 32, 1, true), mat.tinPlate, 0.2, TY + 0.039, -0.27, 0, 0.6, Math.PI / 2), bg);
      // chamberstick + lit candle: the warm key light of the room (shadowed)
      add(mk(lathe(G, [[0, 0], [0.075, 0], [0.078, 0.006], [0.07, 0.012], [0.02, 0.016], [0.016, 0.05], [0.026, 0.055], [0.022, 0.06], [0, 0.06]], 32), mat.brass, 0.62, TY, -0.18), bg);
      add(mk(new THREE.TorusGeometry(0.025, 0.005, 8, 16), mat.brass, 0.7, TY + 0.03, -0.18, 0, 0, Math.PI / 2), bg);
      candle = fx.candle({ height: 0.13, radius: 0.012, light: true, lightIntensity: 3.2, lightDistance: 7, castShadow: Q.shadows, shadowMapSize: 1024, seed: 7, burn: 0.8 });
      candle.position.set(0.62, TY + 0.06, -0.18);
      add(candle, bg);
      // flour sack slumped on the pot board + a basket of onions
      const sackGeo = new THREE.SphereGeometry(0.22, 32, 24);
      { const p = sackGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = y > 0 ? 1 - y * 0.6 : 1; p.setXYZ(i, x * k * (1 + 0.05 * Math.sin(y * 30 + x * 9)), y * 1.25 + (y > 0.15 ? 0.04 * Math.sin(x * 20) : 0), z * k * 0.8); } sackGeo.computeVertexNormals(); }
      add(mk(sackGeo, mat.sack, -0.42, 0.42, 0.05, 0, 0, 0.18), bg);
      add(mk(lathe(G, [[0, 0], [0.13, 0], [0.16, 0.1], [0.15, 0.11], [0.0, 0.11]], 24), mat.pine, 0.35, 0.185, 0), bg);
      const onion = new THREE.SphereGeometry(0.04, 12, 10);
      const onMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.5, name: 'onion' });
      for (let i = 0; i < 6; i++) add(mk(onion, onMat, 0.35 + Math.cos(i * 1.1) * 0.07, 0.29 + (i > 3 ? 0.04 : 0), Math.sin(i * 1.1) * 0.07), bg);
    }

    // a Windsor chair pulled out from the block, and another by the range
    {
      const c1 = buildWindsorChair(G, mat);
      c1.position.set(BLOCK.x - 0.95, 0, BLOCK.z + 0.75); c1.rotation.y = 2.4;
      add(c1);
      const c2 = buildWindsorChair(G, mat);
      c2.position.set(CH.x1 + 0.35, 0, Z0 + 1.05); c2.rotation.y = -0.5;
      add(c2);
    }

    // ================================================================ pot rack over the block
    {
      const pr = new THREE.Group(); pr.name = 'potrack';
      const RY = 2.28, RW = 1.25, RD = 0.5;
      const frame = [V3(-RW / 2, 0, -RD / 2), V3(RW / 2, 0, -RD / 2), V3(RW / 2, 0, RD / 2), V3(-RW / 2, 0, RD / 2)];
      const barProf = [V2(-0.012, -0.004), V2(0.012, -0.004), V2(0.012, 0.004), V2(-0.012, 0.004)];
      pr.add(mk(G.sweepProfile([V2(0, -0.02), V2(0.01, -0.02), V2(0.01, 0.02), V2(0, 0.02)], frame, { closed: true, uvScale: 2 }), mat.iron));
      pr.add(mk(new THREE.CylinderGeometry(0.008, 0.008, RW, 8), mat.iron, 0, 0, 0, 0, 0, Math.PI / 2));
      void barProf;
      // chains up to the beam (z = -0.05 beam is close: use the -1.45 beam? chains go straight up to ceiling hooks)
      const link = new THREE.TorusGeometry(0.012, 0.003, 6, 12);
      const links = [];
      for (const [x, z] of [[-RW / 2, -RD / 2], [RW / 2, -RD / 2], [-RW / 2, RD / 2], [RW / 2, RD / 2]]) {
        const top = H - RY;
        const n = Math.floor(top / 0.02);
        for (let i = 0; i < n; i++) {
          const m4 = new THREE.Matrix4().compose(V3(x * (1 - i / n * 0.25), 0.02 + i * 0.02, z * (1 - i / n * 0.25)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i % 2 ? Math.PI / 2 : 0, Math.PI / 2)), V3(1, 1.4, 1));
          links.push({ geo: link, m: m4 });
        }
      }
      pr.add(new THREE.Mesh(mergeInto(links), mat.iron));
      // S-hooks + hanging things
      const sHook = tube([[0, 0.01, 0], [0.012, 0.0, 0], [0.0, -0.025, 0], [-0.012, -0.05, 0], [0, -0.065, 0]], 0.0028, 20, 6);
      const hang = [];
      const hooksAt = [-0.52, -0.3, -0.08, 0.14, 0.36, 0.55];
      hooksAt.forEach((x, i) => { const z = i % 2 ? RD / 2 : -RD / 2; pr.add(mk(sHook, mat.iron, x, -0.0, z)); hang.push([x, -0.065, z]); });
      // pans hanging with handle up
      const basis = new THREE.Matrix4().makeBasis(V3(0, 1, 0), V3(0, 0, 1), V3(1, 0, 0));
      [[0, 0.11, 0.085, 0.22], [2, 0.09, 0.07, 0.2], [4, 0.1, 0.075, 0.21]].forEach(([hi, r, h, hl]) => {
        const pan = buildSaucepan(G, mat, r, h, hl);
        pan.setRotationFromMatrix(basis);
        const holder = new THREE.Group();
        pan.position.set(0, -(r + hl + 0.012), -0.82 * h);
        holder.add(pan);
        const [x, y, z] = hang[hi];
        holder.position.set(x, y, z);
        holder.rotation.y = hi * 0.8 + 0.3;
        pr.add(holder);
      });
      // colander (perforated look via ring of dark dots), ladle, herb bundles, a ham in muslin
      {
        const [x, y, z] = hang[1];
        const col = mk(lathe(G, [[0.04, 0], [0.1, 0.07], [0.115, 0.1], [0.11, 0.105], [0.095, 0.075], [0.035, 0.01]], 32), mat.copper, x, y - 0.25, z, Math.PI, 0, 0.2);
        pr.add(col);
        pr.add(mk(tube([[x, y, z], [x + 0.03, y - 0.1, z], [x + 0.1, y - 0.14, z]], 0.003, 10, 5), mat.brass));
      }
      {
        const [x, y, z] = hang[3];
        const ladle = new THREE.Group();
        ladle.add(mk(new THREE.CylinderGeometry(0.006, 0.006, 0.36, 8), mat.steel, 0, -0.18, 0));
        ladle.add(mk(new THREE.SphereGeometry(0.045, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat.steel, 0, -0.36, 0.0));
        ladle.position.set(x, y, z);
        pr.add(ladle);
      }
      {
        const [x, y, z] = hang[5];
        const ham = mk(lathe(G, [[0, 0], [0.05, 0.02], [0.1, 0.1], [0.11, 0.18], [0.08, 0.26], [0.03, 0.32], [0.02, 0.38], [0.0, 0.4]], 24), mat.ham, x, y - 0.46, z, 0, 0, 0.05);
        pr.add(mk(lathe(G, [[0.026, 0], [0.034, 0.03], [0.03, 0.09], [0.022, 0.12], [0.0, 0.125]], 16), mat.muslin, x + 0.02, y - 0.17, z, 0, 0, 0.05));
        pr.add(ham);
        pr.add(mk(new THREE.CylinderGeometry(0.002, 0.002, 0.07, 4), mat.rope, x, y - 0.03, z));
      }
      for (const [x, z] of [[-0.42, RD / 2], [0.25, -RD / 2]]) {
        const herb = new THREE.Group();
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2;
          herb.add(mk(new THREE.CylinderGeometry(0.002, 0.004, 0.32, 4), mat.herbs, Math.cos(a) * 0.015, -0.16, Math.sin(a) * 0.015, Math.sin(a) * 0.18, 0, Math.cos(a) * 0.18));
          herb.add(mk(new THREE.SphereGeometry(0.018, 6, 4), mat.herbs, Math.cos(a) * 0.05, -0.3 + (k % 3) * 0.03, Math.sin(a) * 0.05)).scale.set(1, 2.4, 1);
        }
        herb.add(mk(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 10), mat.rope, 0, -0.02, 0));
        herb.position.set(x, -0.0, z);
        pr.add(herb);
      }
      pr.position.set(BLOCK.x, RY, BLOCK.z);
      add(pr);
    }

    // ================================================================ dumbwaiter (right wall)
    let hatch, dumbLight, cloche;
    const dumb = { open: ctx.state.isSolved(CANS_ID), t: ctx.state.isSolved(CANS_ID) ? 1 : 0.16 };
    {
      const g = new THREE.Group(); g.name = 'dumbwaiter';
      const zc = DUMB.z, y0 = DUMB.y, w = DUMB.w, h = DUMB.h, D = 0.6;
      // shaft (behind the wall plane at x = X1)
      const shaftBack = new THREE.Mesh(G.planeUV(w + 0.02, 2.4, 1), mat.boarding);
      shaftBack.rotation.y = -Math.PI / 2; shaftBack.position.set(X1 + D, y0 + 0.5, zc); g.add(shaftBack);
      for (const s of [-1, 1]) {
        const side = new THREE.Mesh(G.planeUV(D, 2.4, 1), mat.boarding);
        side.rotation.y = s > 0 ? Math.PI : 0; side.position.set(X1 + D / 2, y0 + 0.5, zc + s * w / 2); g.add(side);
      }
      // the car: a shelf box with a silver cloche
      const car = new THREE.Group();
      car.add(mk(rbox(G, D - 0.06, 0.03, w - 0.04, 0.004), mat.pineDark, 0, 0, 0));
      car.add(mk(rbox(G, D - 0.06, 0.03, w - 0.04, 0.004), mat.pineDark, 0, 0.7, 0));
      car.add(mk(rbox(G, 0.02, 0.7, w - 0.04, 0.004), mat.pineDark, D / 2 - 0.04, 0.35, 0));
      cloche = new THREE.Group();
      cloche.add(mk(lathe(G, [[0, 0], [0.17, 0], [0.18, 0.005], [0.17, 0.012], [0.0, 0.012]], 40), M.basic('silver', { roughness: 0.25 })));
      cloche.add(mk(lathe(G, [[0.155, 0.01], [0.155, 0.04], [0.14, 0.1], [0.1, 0.15], [0.05, 0.17], [0.0, 0.175]], 40), M.basic('silver', { roughness: 0.2 })));
      cloche.add(mk(lathe(G, [[0, 0], [0.012, 0], [0.006, 0.015], [0.02, 0.03], [0.0, 0.035]], 16), M.basic('silver', { roughness: 0.2 }), 0, 0.175, 0));
      cloche.position.set(-0.02, 0.015, 0);
      car.add(cloche);
      car.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 2.0, 6), mat.rope, 0.1, 1.5, -w / 2 + 0.06));
      car.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 2.0, 6), mat.rope, 0.1, 1.5, w / 2 - 0.06));
      car.position.set(X1 + D / 2 + 0.02, y0 + 0.005, zc);
      g.add(car);
      // casing, sill, hatch
      const cs = casing(w, h, y0 - 0.06, G.PROFILES.chairRail(0.08, 0.03), mat.hatch, 0.0);
      cs.position.set(X1, 0, zc); cs.rotation.y = -Math.PI / 2;
      g.add(cs);
      g.add(mk(rbox(G, 0.12, 0.04, w + 0.2, 0.008), mat.pineDark, X1 - 0.04, y0 - 0.02, zc));
      // jambs inside the wall thickness
      for (const s of [-1, 1]) g.add(mk(new THREE.BoxGeometry(0.08, h, 0.02), mat.hatch, X1 + 0.04, y0 + h / 2, zc + s * (w / 2 + 0.01)));
      hatch = new THREE.Group();
      hatch.add(mk(G.raisedPanel(w - 0.02, h - 0.02, { border: 0.06, bevel: 0.02 }), mat.hatch, 0, 0, 0, 0, -Math.PI / 2, 0));
      hatch.add(mk(rbox(G, 0.02, 0.025, 0.16, 0.006), mat.brass, -0.02, -h / 2 + 0.08, 0));
      hatch.position.set(X1 + 0.05, y0 + h / 2, zc);
      hatch.userData.dynamic = true;
      g.add(hatch);
      // brass bell on a coiled spring bracket, and an enamel plate
      const bell = new THREE.Group();
      bell.add(mk(lathe(G, [[0, 0], [0.065, 0], [0.062, 0.012], [0.045, 0.05], [0.032, 0.09], [0.0, 0.095]], 28), mat.brass, 0, -0.06, 0));
      bell.add(mk(new THREE.SphereGeometry(0.012, 10, 8), mat.steel, 0, -0.012, 0));
      bell.add(mk(tube(Array.from({ length: 30 }, (_, i) => [0.05 + i * 0.004, 0.02 + Math.sin(i * 0.9) * 0.014, Math.cos(i * 0.9) * 0.014]), 0.0022, 90, 4), mat.steel, 0, 0, 0, 0, Math.PI / 2, 0));
      bell.add(mk(rbox(G, 0.012, 0.06, 0.05, 0.004), mat.brass, 0, 0.02, -0.18 + 0.0));
      bell.position.set(X1 - 0.17, y0 + h + 0.36, zc);
      g.add(bell);
      const plate = forge.canvas('kitchen:liftplate', 512, 128, (g2, W2, H2) => {
        g2.fillStyle = '#e9e3d2'; g2.fillRect(0, 0, W2, H2);
        g2.strokeStyle = '#1d2b55'; g2.lineWidth = 8; g2.strokeRect(10, 10, W2 - 20, H2 - 20);
        g2.fillStyle = '#1d2b55'; g2.font = '600 44px Cinzel, Georgia, serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
        g2.fillText('SERVICE LIFT', W2 / 2, 52);
        g2.font = '600 20px Cinzel, Georgia, serif'; g2.fillText('TO THE DINING ROOM', W2 / 2, 92);
      }, { tile: false });
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.09), new THREE.MeshPhysicalMaterial({ map: plate, roughness: 0.2, clearcoat: 1, name: 'enamelPlate' }));
      pm.position.set(X1 - 0.004, y0 + h + 0.13, zc); pm.rotation.y = -Math.PI / 2;
      g.add(pm);
      add(g);
      dumbLight = new THREE.PointLight(0x7f9cff, 0, 3.2, 2);
      dumbLight.position.set(X1 - 0.06, y0 + 0.35, zc);
      add(dumbLight);
    }
    const setHatch = (t) => {
      hatch.position.y = DUMB.y + DUMB.h / 2 + t * (DUMB.h + 0.05);
      dumbLight.intensity = 0.9 + t * 1.6;
    };
    setHatch(dumb.t);
    async function revealDumbwaiter(animate) {
      if (dumb.open && dumb.t >= 1) return;
      dumb.open = true;
      ctx.state.set('kitchen.dumbwaiterOpen', true);
      if (!animate) { dumb.t = 1; setHatch(1); return; }
      dumb.t0 = dumb.t; dumb.t = 0; dumb.anim = true;
      ctx.audio.sfx('chime', { freq: 1320 });
      await new Promise((r) => setTimeout(r, 400));
      ctx.audio.creak?.();
    }
    ctx.onUpdate((dt) => {
      if (!dumb.anim) return;
      dumb.t = Math.min(1, dumb.t + dt / 2.5);
      const e = dumb.t * dumb.t * (3 - 2 * dumb.t);
      setHatch((dumb.t0 ?? 0) + (1 - (dumb.t0 ?? 0)) * e);
      if (dumb.t >= 1) dumb.anim = false;
    });

    // ================================================================ bell board + dining door (right wall)
    {
      const zc = DOORS.dining.z, w = DOORS.dining.w, h = DOORS.dining.h;
      // door leaf (ajar, opens into the passage)
      const leaf = new THREE.Group();
      leaf.add(mk(rbox(G, w, h, 0.045, 0.006), mat.hatch, w / 2, h / 2, 0));
      for (const [y, hh] of [[0.55, 0.75], [1.6, 0.8]]) leaf.add(mk(G.raisedPanel(w - 0.2, hh, { border: 0.05 }), mat.hatch, w / 2, y, 0.022));
      leaf.add(mk(new THREE.SphereGeometry(0.03, 16, 12), mat.brass, w - 0.08, 1.0, 0.06));
      leaf.position.set(X1 + 0.06, 0, zc - w / 2);
      leaf.rotation.y = -Math.PI / 2 + 0.45;
      add(leaf);
      // dark passage beyond
      const passage = new THREE.Mesh(G.planeUV(w + 0.4, h + 0.2, 1), mat.plaster);
      passage.rotation.y = -Math.PI / 2; passage.position.set(X1 + 1.2, h / 2, zc); add(passage);
      for (const s of [-1, 1]) {
        const side = new THREE.Mesh(G.planeUV(1.2, h, 1), mat.plaster);
        side.rotation.y = s > 0 ? Math.PI : 0; side.position.set(X1 + 0.6, h / 2, zc + s * w / 2); add(side);
      }
      const cs = casing(w, h, 0, G.PROFILES.chairRail(0.1, 0.03), mat.hatch, 0.0);
      cs.position.set(X1, 0, zc); cs.rotation.y = -Math.PI / 2;
      add(cs);
      // bell board above
      const bb = new THREE.Group();
      const names = ['DINING', 'LIBRARY', 'MUSIC RM', 'GALLERY', 'FRONT DOOR', 'BEDROOM', 'NURSERY', 'ATTIC'];
      const tabs = forge.canvas('kitchen:belltabs', 1024, 64, (g2, W2, H2) => {
        g2.fillStyle = '#1d1a14'; g2.fillRect(0, 0, W2, H2);
        g2.font = '600 20px Cinzel, Georgia, serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
        names.forEach((n, i) => {
          const x = (i + 0.5) * (W2 / names.length);
          g2.fillStyle = '#e7dcc0'; g2.fillRect(x - 56, 14, 112, 36);
          g2.strokeStyle = '#a07a2c'; g2.lineWidth = 2; g2.strokeRect(x - 56, 14, 112, 36);
          g2.fillStyle = '#2a1a10'; g2.fillText(n, x, 33);
        });
      }, { tile: false });
      bb.add(mk(rbox(G, 1.25, 0.5, 0.04, 0.01), mat.mahogany, 0, 0, 0));
      const tabM = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.072), new THREE.MeshStandardMaterial({ map: tabs, roughness: 0.6 }));
      tabM.position.set(0, -0.17, 0.022); bb.add(tabM);
      bb.add(mk(G.frameGeometry(1.25, 0.5, { width: 0.04, depth: 0.03, uvScale: 1 }), mat.pineDark, 0, 0, 0.01));
      const bellGeo = lathe(G, [[0, 0], [0.032, 0], [0.03, 0.008], [0.022, 0.03], [0.016, 0.05], [0, 0.053]], 20);
      const springGeo = tube(Array.from({ length: 40 }, (_, i) => [Math.cos(i * 0.9) * 0.012, i * 0.0035, Math.sin(i * 0.9) * 0.012]), 0.0016, 120, 4);
      const bells = [];
      names.forEach((n, i) => {
        const x = -0.575 + (i + 0.5) * (1.15 / names.length);
        const bg2 = new THREE.Group();
        bg2.add(mk(springGeo, mat.steel, 0, 0.0, 0, Math.PI / 2, 0, 0));
        const b = mk(bellGeo, mat.brass, 0, -0.02, 0.16, Math.PI, 0, 0);
        bg2.add(b);
        bg2.position.set(x, 0.08, 0.02);
        bg2.userData.dynamic = true;
        bb.add(bg2);
        bells.push(bg2);
      });
      bb.position.set(X1 - 0.025, h + 0.42, zc);
      bb.rotation.y = -Math.PI / 2;
      add(bb);
      // the DINING bell trembles now and then
      ctx.onUpdate((dt, t) => {
        const k = Math.max(0, Math.sin(t * 0.7)) ** 12;
        bells[0].rotation.z = Math.sin(t * 31) * 0.12 * k;
      });
    }

    // ================================================================ foyer door (front wall, behind the start view)
    {
      const x0 = DOORS.foyer.x, w = DOORS.foyer.w, h = DOORS.foyer.h;
      const cs = casing(w, h, 0, G.PROFILES.chairRail(0.11, 0.035), mat.hatch, 0.0);
      cs.position.set(x0, 0, Z1); cs.rotation.y = Math.PI;
      add(cs);
      const passage = new THREE.Mesh(G.planeUV(w + 0.4, h + 0.2, 1), new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 1 }));
      passage.rotation.y = Math.PI; passage.position.set(x0, h / 2, Z1 + 1.4); add(passage);
      for (const s of [-1, 1]) {
        const side = new THREE.Mesh(G.planeUV(1.4, h, 1), mat.plaster);
        side.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; side.position.set(x0 + s * w / 2, h / 2, Z1 + 0.7); add(side);
      }
      const leaf = new THREE.Group();
      leaf.add(mk(rbox(G, w, h, 0.045, 0.006), mat.hatch, -w / 2, h / 2, 0));
      for (const [y, hh] of [[0.55, 0.75], [1.65, 0.85]]) for (const xx of [-0.25, 0.25]) leaf.add(mk(G.raisedPanel(0.36, hh, { border: 0.05 }), mat.hatch, -w / 2 + xx, y, -0.022, 0, Math.PI, 0));
      leaf.position.set(x0 + w / 2, 0, Z1 + 0.05);
      leaf.rotation.y = 1.25;
      add(leaf);
      // coal scuttle, broom and a mangle by the door
      add(mk(lathe(G, [[0, 0], [0.16, 0], [0.18, 0.2], [0.2, 0.32], [0.17, 0.34], [0.0, 0.34]], 28), mat.copper, x0 - 0.9, 0, Z1 - 0.3));
      const broom = new THREE.Group();
      broom.add(mk(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 8), mat.pine, 0, 0.85, 0));
      broom.add(mk(new THREE.CylinderGeometry(0.03, 0.09, 0.28, 16), mat.herbs, 0, 0.14, 0));
      broom.position.set(x0 - 1.45, 0, Z1 - 0.12); broom.rotation.z = 0.12;
      add(broom);
    }

    // ================================================================ right wall shelf: canisters, moulds, jugs
    {
      const z0 = -3.55, z1 = -1.75, y = 1.95, d = 0.26;
      const sg = new THREE.Group();
      sg.add(mk(rbox(G, d, 0.03, z1 - z0, 0.006), mat.dresserPaint, X1 - d / 2, y - 0.015, (z0 + z1) / 2));
      sg.add(mk(rbox(G, 0.02, 0.05, z1 - z0, 0.006), mat.dresserPaint, X1 - d + 0.01, y - 0.01, (z0 + z1) / 2));
      for (const z of [z0 + 0.12, (z0 + z1) / 2, z1 - 0.12]) {
        const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.22, 0); sh.quadraticCurveTo(0.05, -0.04, 0, -0.2); sh.lineTo(0, 0);
        sg.add(mk(G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: false }), 1), mat.dresserPaint, X1, y - 0.03, z - 0.0125, 0, Math.PI, 0));
      }
      // japanned canisters with gilt names
      const words = ['TEA', 'SUGAR', 'FLOUR', 'RICE', 'SAGO'];
      const atlas = forge.canvas('kitchen:canisters', 1024, 640, (g2, W2, H2) => {
        const cols = ['#5a0f0c', '#14201a', '#5a0f0c', '#14201a', '#1a1a2a'];
        words.forEach((wd, i) => {
          const y0 = i * 128;
          g2.fillStyle = cols[i]; g2.fillRect(0, y0, W2, 128);
          g2.strokeStyle = '#c9a050'; g2.lineWidth = 3; g2.strokeRect(6, y0 + 10, W2 - 12, 108);
          g2.lineWidth = 1; g2.strokeRect(14, y0 + 18, W2 - 28, 92);
          g2.fillStyle = '#d8b25e'; g2.font = '600 54px Cinzel, Georgia, serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
          g2.fillText(wd, W2 / 2, y0 + 66);
          for (const x of [W2 / 2 - 190, W2 / 2 + 190]) { g2.beginPath(); g2.arc(x, y0 + 64, 14, 0, Math.PI * 2); g2.stroke(); }
        });
      }, { tile: false });
      atlas.flipY = true;
      const canMat = new THREE.MeshPhysicalMaterial({ map: atlas, roughness: 0.35, metalness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.2, name: 'canister' });
      words.forEach((wd, i) => {
        const r = 0.07 - (i % 3) * 0.008, h = 0.2 - i * 0.015;
        const geo = new THREE.CylinderGeometry(r, r, h, 32, 1, true);
        geo.rotateY(Math.PI);
        const uv = geo.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k), 1 - (i + 1) / 5 + uv.getY(k) / 5);
        const zc = z0 + 0.14 + i * 0.17;
        const c = mk(geo, canMat, X1 - 0.12, y + h / 2, zc, 0, -Math.PI / 2, 0);
        sg.add(c);
        sg.add(mk(new THREE.CylinderGeometry(r + 0.003, r + 0.003, 0.02, 32), mat.iron, X1 - 0.12, y + h + 0.01, zc));
        sg.add(mk(new THREE.SphereGeometry(0.012, 10, 8), mat.brass, X1 - 0.12, y + h + 0.026, zc));
      });
      // copper jelly moulds and a pewter charger standing at the end
      sg.add(mk(lathe(G, [[0, 0], [0.08, 0], [0.09, 0.03], [0.07, 0.06], [0.085, 0.09], [0.05, 0.13], [0.03, 0.15], [0.0, 0.155]], 28), mat.copper, X1 - 0.13, y, z1 - 0.12));
      const charger = mk(lathe(G, [[0, 0], [0.1, 0], [0.12, 0.01], [0.17, 0.02], [0.168, 0.026], [0.115, 0.016], [0, 0.012]], 40), M.basic('silver', { color: 0x8a8a8c, roughness: 0.45 }), X1 - 0.05, y + 0.17, z0 + 0.98, 0, 0, Math.PI / 2 - 0.15);
      sg.add(charger);
      add(sg);
    }

    // ================================================================ front wall: meat safe + utensil rail
    {
      // meat safe: tall painted cupboard with perforated zinc panels (faces -z)
      const ms = new THREE.Group();
      const zinc = forge.canvas('kitchen:zinc', 256, 256, (g2, w) => {
        g2.fillStyle = '#6f7476'; g2.fillRect(0, 0, w, w);
        g2.fillStyle = '#0b0c0d';
        for (let y = 4; y < w; y += 8) for (let x = 4 + ((y / 8) % 2) * 4; x < w; x += 8) { g2.beginPath(); g2.arc(x, y, 2.2, 0, Math.PI * 2); g2.fill(); }
      });
      zinc.repeat.set(2, 3);
      const zincMat = new THREE.MeshStandardMaterial({ map: zinc, metalness: 0.7, roughness: 0.55, name: 'zinc' });
      const W2 = 0.74, H2 = 1.95, D2 = 0.42;
      ms.add(mk(rbox(G, W2, H2, D2, 0.008), mat.dresserPaint, 0, H2 / 2, D2 / 2));
      for (const [y, hh] of [[1.38, 0.8], [0.55, 0.72]]) {
        const fr = mk(G.raisedPanel(W2 - 0.06, hh, { border: 0.06, bevel: 0.012, fieldDepth: 0.002 }), mat.dresserPaint, 0, y, D2 + 0.002);
        ms.add(fr);
        const zp = new THREE.Mesh(new THREE.PlaneGeometry(W2 - 0.2, hh - 0.14), zincMat);
        zp.position.set(0, y, D2 + 0.018); ms.add(zp);
        ms.add(mk(lathe(G, [[0, 0], [0.012, 0], [0.016, 0.012], [0.008, 0.024], [0, 0.03]], 12), mat.brass, W2 / 2 - 0.08, y, D2 + 0.02, Math.PI / 2));
      }
      ms.add(mk(rbox(G, W2 + 0.08, 0.06, D2 + 0.05, 0.01), mat.dresserPaint, 0, H2 + 0.03, D2 / 2 + 0.01));
      // jelly moulds + a copper fish kettle on top
      ms.add(mk(lathe(G, [[0, 0], [0.07, 0], [0.09, 0.03], [0.08, 0.06], [0.09, 0.09], [0.06, 0.12], [0.0, 0.13]], 24), mat.copper, -0.15, H2 + 0.06, 0.2));
      ms.add(mk(rbox(G, 0.42, 0.14, 0.16, 0.05, 3), mat.copper, 0.12, H2 + 0.13, 0.22));
      ms.position.set(1.75, 0, Z1); ms.rotation.y = Math.PI;
      add(ms);
      // utensil rail with hanging tools
      const rx0 = 2.35, rx1 = 3.05, ry = 1.78, rz = Z1 - 0.05;
      add(mk(new THREE.CylinderGeometry(0.01, 0.01, rx1 - rx0 + 0.1, 12), mat.brass, (rx0 + rx1) / 2, ry, rz, 0, 0, Math.PI / 2));
      for (const x of [rx0 - 0.03, rx1 + 0.03]) add(mk(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 8), mat.brass, x, ry, Z1 - 0.025, Math.PI / 2));
      const tools = [
        () => { const t = new THREE.Group(); t.add(mk(new THREE.CylinderGeometry(0.005, 0.005, 0.34, 8), mat.steel, 0, -0.19, 0)); t.add(mk(new THREE.SphereGeometry(0.05, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat.copper, 0, -0.38, 0)); return t; },
        () => { const t = new THREE.Group(); t.add(mk(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 8), mat.steel, 0, -0.17, 0)); t.add(mk(new THREE.CylinderGeometry(0.06, 0.06, 0.004, 24), zincMat, 0, -0.36, 0, Math.PI / 2 - 0.15)); return t; },
        () => { const t = new THREE.Group(); t.add(mk(new THREE.CylinderGeometry(0.006, 0.006, 0.28, 8), mat.pineDark, 0, -0.16, 0)); for (let k = 0; k < 6; k++) t.add(mk(new THREE.TorusGeometry(0.03, 0.0015, 4, 16, Math.PI), mat.steel, 0, -0.33, 0, 0, (k / 6) * Math.PI, Math.PI)); return t; },
        () => { const t = new THREE.Group(); t.add(mk(new THREE.CylinderGeometry(0.005, 0.005, 0.32, 8), mat.steel, 0, -0.18, 0)); for (const dx of [-0.012, 0, 0.012]) t.add(mk(new THREE.CylinderGeometry(0.0025, 0.002, 0.09, 6), mat.steel, dx, -0.38, 0)); return t; },
        () => { const t = new THREE.Group(); t.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), mat.pineDark, 0, -0.1, 0)); t.add(mk(lathe(G, [[0, 0], [0.07, 0.0], [0.08, 0.05], [0.0, 0.06]], 24), zincMat, 0, -0.27, 0, Math.PI / 2)); return t; },
      ];
      tools.forEach((f, i) => { const t = f(); t.position.set(rx0 + 0.06 + i * ((rx1 - rx0 - 0.12) / (tools.length - 1)), ry - 0.01, rz); t.rotation.z = (i % 2 ? 0.04 : -0.03); add(t); add(mk(new THREE.TorusGeometry(0.012, 0.0025, 6, 12), mat.steel, t.position.x, ry - 0.005, rz, 0, Math.PI / 2, 0)); });
      // a small side table under the rail with a stack of spare tins and a flour bin
      add(mk(rbox(G, 0.8, 0.04, 0.45, 0.006), mat.pine, 2.7, 0.8, Z1 - 0.25));
      for (const [x, z] of [[2.34, Z1 - 0.06], [3.06, Z1 - 0.06], [2.34, Z1 - 0.44], [3.06, Z1 - 0.44]]) add(mk(rbox(G, 0.05, 0.78, 0.05, 0.006), mat.pineDark, x, 0.39, z));
      add(mk(lathe(G, [[0, 0], [0.16, 0], [0.16, 0.36], [0.17, 0.37], [0.15, 0.4], [0, 0.42]], 32), mat.tinPlate, 2.55, 0.82, Z1 - 0.24));
    }

    // ================================================================ gas brackets
    const gasLights = [];
    {
      const globeMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: new THREE.Color(1.0, 0.7, 0.38), emissiveIntensity: 2.6, roughness: 0.35, transparent: true, opacity: 0.94, name: 'gasGlobe' });
      const spots = [
        { p: V3(X0, 1.98, -0.3), ry: Math.PI / 2, i: 3.4 },          // left wall, beyond the dresser
        { p: V3(X1, 1.98, -0.05), ry: -Math.PI / 2, i: 3.2 },        // right wall, by the dumbwaiter
        { p: V3(0.12, 2.02, Z0), ry: 0, i: 1.4 },                     // back wall between breast and plate rack
        { p: V3(2.7, 2.15, Z1), ry: Math.PI, i: 2.6 },                // front wall above the utensil rail
      ];
      for (const s of spots) {
        const b = buildGasBracket(G, mat, globeMat);
        b.group.position.copy(s.p); b.group.rotation.y = s.ry;
        add(b.group);
        const pl = new THREE.PointLight(0xffaa5c, s.i, 7, 2);
        const lp = b.lightPos.clone().applyEuler(new THREE.Euler(0, s.ry, 0)).add(s.p);
        pl.position.copy(lp);
        add(pl);
        gasLights.push({ pl, base: s.i, seed: gasLights.length * 3.1 });
      }
      ctx.onUpdate((dt, t) => { for (const g of gasLights) g.pl.intensity = g.base * (0.97 + 0.03 * Math.sin(t * 7.3 + g.seed) * Math.sin(t * 2.9 + g.seed)); });
    }

    // ================================================================ lights
    const fire = new THREE.PointLight(0xff6a22, 2.6, 4.5, 2);
    fire.position.copy(range.fireLightPos).applyMatrix4(range.group.matrix.compose(range.group.position, range.group.quaternion, range.group.scale));
    add(fire);
    ctx.onUpdate((dt, t) => {
      const f = 0.85 + 0.1 * Math.sin(t * 3.3) * Math.sin(t * 1.7 + 1) + 0.05 * Math.sin(t * 11.0);
      fire.intensity = 2.6 * f; range.emberMat.emissiveIntensity = 2.5 * f;
    });
    // faint warm bounce inside the brick recess so the sooty brick reads
    const alcove = new THREE.PointLight(0xff7a3a, 0.9, 2.2, 2);
    alcove.position.set((CH.ax0 + CH.ax1) / 2, 1.3, Z0 + 0.25);
    add(alcove);
    const dinPassage = new THREE.PointLight(0xffa860, 1.0, 3.5, 2);
    dinPassage.position.set(X1 + 0.9, 1.9, DOORS.dining.z + 0.2);
    add(dinPassage);
    // a dim lamp somewhere down the foyer passage
    const passageLight = new THREE.PointLight(0xffb070, 1.2, 4, 2);
    passageLight.position.set(DOORS.foyer.x - 0.2, 2.0, Z1 + 1.0);
    add(passageLight);
    // moonlight through the sash window
    const moon = new THREE.SpotLight(0xa7bcff, 1500, 18, 0.26, 0.4, 2);
    moon.position.set(WIN.x + 1.6, 5.6, Z0 - 4.2);
    moon.target.position.set(BLOCK.x + 0.15, 0.4, BLOCK.z + 0.6);
    moon.castShadow = Q.shadows;
    moon.shadow.mapSize.set(Q.shadowMapSize, Q.shadowMapSize);
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.02; moon.shadow.radius = Q.shadowRadius;
    moon.shadow.camera.near = 1; moon.shadow.camera.far = 16;
    add(moon); add(moon.target);
    const hemi = new THREE.HemisphereLight(0x4d64a8, 0x20160e, 0.95);
    add(hemi);
    add(fx.areaLight({ center: [WIN.x, WIN.sill + WIN.h / 2, Z0 + 0.04], normal: [0, -0.35, 1], width: WIN.w, height: WIN.h, color: 0x8ea6ff, intensity: 6 }));

    // volumetrics: moon shaft, flour dust everywhere, low mist
    const winCenter = V3(WIN.x, WIN.sill + WIN.h * 0.5, Z0 - 0.05);
    const beamDir = new THREE.Vector3().subVectors(moon.target.position, moon.position).normalize();
    const shaft = fx.shaft({
      center: winCenter, right: V3(WIN.w / 2, 0, 0), up: V3(0, WIN.h * 0.5, 0), direction: beamDir, length: 4.2,
      color: 0xa4b8ff, intensity: 1.05, softness: 0.3, falloff: 1.0, panes: [3, 4], mullion: 0.03, noise: 0.8,
    });
    add(shaft);
    add(fx.dust({ box: new THREE.Box3(V3(-1.2, 0.1, Z0 + 0.1), V3(2.6, 3.0, 1.0)), count: 2600, shafts: [shaft], size: 0.011, intensity: 2.4, ambient: 0.07 }));
    add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.2, 0, Z0 + 0.6), V3(X1 - 0.2, 0.45, Z1 - 0.3)), color: 0x0c111c, litColor: 0x36435f, density: 0.45, heightFalloff: 4.5 }));

    // ================================================================ navigation
    const nodes = {
      main: { position: [0.55, 1.62, 2.95], target: [-0.35, 1.28, -3.8], fov: 60, label: 'The kitchen', look: { yaw: [-50, 50], pitch: [-28, 24] } },
      back: { position: [-0.9, 1.62, 0.1], target: [1.6, 1.3, 3.4], fov: 60, label: 'The doors' },
      range: { position: [-1.1, 1.62, -1.15], target: [-1.25, 1.1, -3.8], fov: 56, label: 'The range' },
      pantry: { position: [-1.35, 1.62, -0.35], target: [X0, 1.5, DRESSER_Z - 0.2], fov: 56, label: 'The dresser' },
      dumbwaiter: { position: [1.45, 1.6, -0.15], target: [X1, 1.25, DUMB.z - 0.15], fov: 56, label: 'The dumbwaiter' },
    };
    const edges = [
      ['main', 'range', [[-0.6, 1.62, 1.0]]],
      ['main', 'pantry', [[-0.7, 1.62, 1.3]]],
      ['main', 'dumbwaiter', [[1.5, 1.62, 1.3]]],
      ['main', 'back', null, { hotspot: { back: { position: [0.35, 0.35, 1.3], radius: 0.45 }, main: { position: [0.55, 1.2, 2.9], radius: 0.45 } } }],
      ['range', 'pantry'],
      ['range', 'dumbwaiter', [[0.2, 1.62, -1.6]]],
      ['pantry', 'dumbwaiter', [[0.3, 1.62, 0.35]]],
      ['back', 'pantry'],
      ['back', 'dumbwaiter'],
    ];
    const exits = [
      { node: 'back', toRoom: 'foyer', toNode: null, label: 'The passage to the foyer', hotspot: { box: { min: [DOORS.foyer.x - 0.55, 0.1, Z1 - 0.1], max: [DOORS.foyer.x + 0.55, 2.3, Z1 + 0.4] } } },
      { node: 'back', toRoom: 'dining', toNode: null, label: 'The service door', hotspot: { box: { min: [X1 - 0.1, 0.1, DOORS.dining.z - 0.5], max: [X1 + 0.4, 2.2, DOORS.dining.z + 0.5] } } },
    ];

    // ================================================================ hotspots
    const say = (text) => ctx.say({ text, speaker: 'stauf', speakerName: 'Stauf' });
    const hotspots = [
      { id: 'cans', nodes: ['pantry', 'main'], box: { min: [X0, 1.15, DRESSER_Z - 0.75], max: [X0 + 0.35, 2.05, DRESSER_Z + 0.75] }, cursor: 'puzzle', label: 'Stauf’s Superior Soups', puzzle: cans.puzzle, enabled: () => !ctx.state.isSolved(CANS_ID) },
      {
        id: 'cans-solved', nodes: ['pantry'], box: { min: [X0, 1.15, DRESSER_Z - 0.75], max: [X0 + 0.35, 2.05, DRESSER_Z + 0.75] }, cursor: 'examine', label: 'The recipe', enabled: () => ctx.state.isSolved(CANS_ID),
        onActivate: () => ctx.ui.caption('THE SOUP IS MADE OF GUESTS. The tins will not be moved again. They are glued to the shelf now — or something is holding them.', { title: 'The Pantry' }),
      },
      {
        id: 'range', nodes: ['range', 'main'], box: { min: [CH.ax0, 0.1, Z0], max: [CH.ax1, 1.45, Z0 + 0.75] }, cursor: 'examine', label: 'The range',
        onActivate: async () => { ctx.ui.caption('The fire has been banked for seventy years and has never once gone out. The stockpot is warm. You do not lift the lid.', { title: 'The Range' }); },
      },
      {
        id: 'pans', nodes: ['range'], box: { min: [CH.x0, 1.9, Z0 + CH.d - 0.05], max: [CH.x1, 2.55, Z0 + CH.d + 0.35] }, cursor: 'examine', label: 'Copper pans',
        onActivate: () => ctx.ui.caption('Six pans, polished to mirrors. In each one your reflection is a little further behind you.', { title: 'The Batterie' }),
      },
      {
        id: 'block', nodes: ['main', 'range', 'pantry', 'dumbwaiter'], box: { min: [BLOCK.x - 0.75, 0.6, BLOCK.z - 0.4], max: [BLOCK.x + 0.75, 1.05, BLOCK.z + 0.4] }, cursor: 'examine', label: 'The butcher’s block',
        onActivate: async () => { ctx.audio.sfx('thud'); await say('Fresh meat is *so* hard to come by. One must make do with whoever drops in.'); },
      },
      {
        id: 'footprints', nodes: ['dumbwaiter', 'main'], box: { min: [1.2, 0, -1.4], max: [3.0, 0.08, -0.4] }, cursor: 'examine', label: 'Footprints',
        onActivate: () => ctx.ui.caption('Bare feet, small ones, walked through the flour to the dumbwaiter. None walk back.', { title: 'In the Flour' }),
      },
      {
        id: 'dumbwaiter', nodes: ['dumbwaiter', 'main'], box: { min: [X1 - 0.15, DUMB.y - 0.05, DUMB.z - 0.4], max: [X1 + 0.1, DUMB.y + DUMB.h + 0.05, DUMB.z + 0.4] }, cursor: 'examine', label: 'The dumbwaiter',
        onActivate: async () => {
          if (!dumb.open) {
            ctx.audio.sfx('thud');
            ctx.ui.caption('The hatch will not lift. From somewhere above, the ropes creak as if a weight were being lowered — and stops. Perhaps the cook must be satisfied first.', { title: 'The Dumbwaiter' });
          } else {
            await ctx.cinematic(async (c, hh) => {
              await ctx.nav.lookAt(V3(X1 + 0.3, DUMB.y + 0.15, DUMB.z), 1.0);
              ctx.post.set({ saturation: 0.7, vignette: 0.6 }, 0.8);
              await say('Dinner is *served*. Do lift the cover — no? Suit yourself. It was only the last guest who asked too many questions.');
              await hh.wait(0.4);
              ctx.post.reset(1.0);
              await ctx.nav.returnToNode(1.0);
            });
          }
        },
      },
      {
        id: 'bells', nodes: ['back', 'dumbwaiter'], box: { min: [X1 - 0.2, DOORS.dining.h + 0.15, DOORS.dining.z - 0.65], max: [X1, DOORS.dining.h + 0.7, DOORS.dining.z + 0.65] }, cursor: 'examine', label: 'The bell board',
        onActivate: () => { ctx.audio.sfx('chime', { freq: 1567 }); ctx.ui.caption('DINING rings. No one is in the dining room. It rings again.', { title: 'The Bell Board' }); },
      },
      {
        id: 'window', nodes: ['range', 'main'], box: { min: [WIN.x - WIN.w / 2, WIN.sill, Z0 - 0.4], max: [WIN.x + WIN.w / 2, WIN.sill + WIN.h, Z0] }, cursor: 'examine', label: 'The kitchen garden',
        onActivate: () => ctx.ui.caption('The kitchen garden, gone to seed under the moon. The glasshouse panes are fogged from the inside.', { title: 'The Window' }),
      },
      {
        id: 'sampler', nodes: ['range', 'main'], box: { min: [(CH.x0 + CH.x1) / 2 - 0.25, 2.65, Z0 + CH.d - 0.02], max: [(CH.x0 + CH.x1) / 2 + 0.25, 3.25, Z0 + CH.d + 0.06] }, cursor: 'examine', label: 'A sampler',
        onActivate: () => ctx.ui.caption('WASTE NOT — NOT EVEN GUESTS. Stitched by a child, in thread the colour of old gravy.', { title: 'The Sampler' }),
      },
      {
        id: 'clock', nodes: ['range'], sphere: { center: [(CH.x0 + CH.x1) / 2 + 0.05, 1.86, Z0 + CH.d + 0.15], radius: 0.18 }, cursor: 'examine', label: 'The clock',
        onActivate: () => ctx.ui.caption('Five to midnight. It has been five to midnight in this kitchen for a very long time.', { title: 'The Kitchen Clock' }),
      },
    ];

    // ================================================================ QA hooks
    if (typeof window !== 'undefined') {
      const dbg = (window.__debug ||= {});
      dbg.solvers ||= {}; dbg.states ||= {};
      dbg.solvers.kitchen = async () => {
        const game = window.__game;
        if (game && !game.puzzle && game.room?.mod?.id === 'kitchen' && game.startPuzzle) {
          game.startPuzzle(cans.puzzle);
          await new Promise((r) => setTimeout(r, 50));
        }
        if (game?.puzzle?.def?.id === CANS_ID) { cans.puzzle.autoSolve(game.puzzle.pctx); return true; }
        cans.applySolved(); ctx.state.markSolved?.(CANS_ID); revealDumbwaiter(false);
        return true;
      };
      dbg.states.kitchen = () => ({ ...cans.state(), isSolved: ctx.state.isSolved(CANS_ID), dumbwaiterOpen: dumb.open });
      dbg.solve ||= (id) => (dbg.solvers[id] ? dbg.solvers[id]() : Promise.reject(new Error(`no solver for ${id}`)));
      dbg.state ||= (id) => (dbg.states[id] ? dbg.states[id]() : null);
      dbg.kitchen = { cans, swap: cans.swap, word: cans.word, order: cans.readout };
    }
    if (ctx.params?.get?.('kitchenSolved') === '1') { cans.applySolved(); revealDumbwaiter(false); }

    // ================================================================ shadows + merge
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      const fxLike = o.isPoints || m?.isShaderMaterial || m?.isMeshBasicMaterial || m?.transparent || o.userData.noBake;
      o.castShadow = !o.userData.noShadow && !fxLike && !['floor', 'ceiling'].includes(o.name);
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });
    // candle flame & wax shouldn't shadow the candle light itself
    candle.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    mergeStatic(root);

    const godRays = [{ position: V3(WIN.x + 0.3, WIN.sill + 1.2, Z0 - 1.6), color: new THREE.Color(0.72, 0.8, 1.0), strength: 0.8, radius: 0.2 }];

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'main',
      grade: { exposure: 1.9, contrast: 1.08, saturation: 0.98, bloomStrength: 0.38, bloomThreshold: 1.0, godRayWeight: 0.35, godRayThreshold: 2.5, vignette: 0.45, aoIntensity: 1.1, aoRadius: 0.4 },
      environment: { position: [0.2, 1.7, 1.2], intensity: 0.8 },
      onEnter() {
        if (!ctx.state.has('kitchen.greeted')) {
          ctx.state.set('kitchen.greeted', true);
          setTimeout(() => say('Hungry? Stay for supper. Stay... *for* supper.'), 1600);
        }
      },
      dispose() { const d = window.__debug; if (d) { delete d.kitchen; if (d.solvers) delete d.solvers.kitchen; if (d.states) delete d.states.kitchen; } },
    };
  },
};

/** engine curtainGeometry can emit NaN in its top row; patch from the row below */
function fixNaN(g, segX = 140) {
  const a = g.attributes.position.array;
  const row = (segX + 1) * 3;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) a[i] = Number.isFinite(a[i + row]) ? a[i + row] : 0;
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
