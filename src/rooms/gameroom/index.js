import * as THREE from 'three';
import { baizeTexture, chessboardTexture, furTexture, nightSkyTexture, ballAtlas, cardAtlas, CARD_FACES, marbleNeroTexture, logTextures, sootTexture, antlerTexture, cofferTexture, huntPaintingTexture } from './textures.js';
import { buildStag } from './trophy.js';
import { clippedShaft, hazeCone } from './fx.js';
import {
  TABLE, buildBilliardTable, ballGeometry, cueGeometry, buildBilliardLamp, buildCueRack, buildSideChair, buildChesterfield,
  buildCardTable, buildGamesTable, buildFireplace, buildTrophy, buildSconce, taperedTube,
} from './props.js';
import { createQueensPuzzle, queensMeta, QUEENS_ID, queenGeometry } from './puzzleQueens.js';
import { mergeStatic } from './merge.js';

/**
 * The Game Room — upstairs, off the gallery. Stauf's gentlemen's retreat.
 *
 * A 6.6 x 8 x 3.7 m room: mahogany wainscot to the window sills, peacock-blue
 * damask above, a coffered mahogany ceiling. A full-size billiard table stands
 * under a three-shade green-glass lamp whose light hangs in cigar haze. Two tall
 * moonlit windows in the back wall, the left one falling across a games table
 * with an inlaid chessboard — the Queens puzzle. A marble fireplace with a
 * stag's head on the right wall, a cue rack and bead scoreboard on the left, a
 * card table by the door with a hand still dealt.
 *
 * Axes: x right as seen from the gallery door, z toward the door (front wall),
 * y up. Back wall (windows) at z = Z0.
 */

const X0 = -3.3, X1 = 3.3, Z0 = -4.0, Z1 = 4.0, H = 3.7;
const WAINS = 1.15;                                // wainscot / window sill height
const CROWN_H = 0.2, FRIEZE_H = 0.3;
const FRIEZE_Y = H - CROWN_H - FRIEZE_H;
const WIN = { w: 1.05, sill: WAINS, h: 2.0, depth: 0.36, xs: [-1.45, 1.45] };
const DOOR = { x: -1.7, w: 1.1, h: 2.55 };
const T = new THREE.Vector3(0.25, 0, -0.3);        // billiard table centre
const C = new THREE.Vector3(-1.6, 0, -2.85);       // games table (chessboard) centre
const FIRE_Z = -0.45;
const CARD = new THREE.Vector3(2.05, 0, 2.55);
const BOARD = 0.6, FIELD = BOARD * 0.76;
const ROOM_GRADE = { exposure: 2.05, contrast: 1.12, saturation: 1.0, bloomStrength: 0.35, bloomThreshold: 1.1, godRayWeight: 0.3, godRayThreshold: 3.0, vignette: 0.45, aoIntensity: 1.1, aoRadius: 0.4 };

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

/** engine curtainGeometry can emit NaN in its top row; patch from the row below */
function fixNaN(g, segX) {
  const a = g.attributes.position.array;
  const row = (segX + 1) * 3;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) a[i] = Number.isFinite(a[i + row]) ? a[i + row] : 0;
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export default {
  id: 'gameroom',
  title: 'The Game Room',
  floorName: 'Upper Floor',
  map: { floor: 'upper', rect: [640, 70, 190, 190] },
  start: 'main',
  ambience: { wind: 0.55, creaks: 0.45, clock: 0.35, thunder: 0.2, rain: 0, heartbeat: 0, roomTone: 0.35 },
  music: { key: 43, mood: 'dread' },
  puzzles: [queensMeta],

  async build(ctx) {
    const { materials: M, geometry: G, fx } = ctx;
    const Q = ctx.quality;
    const big = Q.textureSize >= 2048 ? 2048 : 1024;
    const root = new THREE.Group();
    root.name = 'gameroom';
    const add = (o, parent = root) => { parent.add(o); return o; };

    // ================================================================ materials
    const baize = baizeTexture(ctx.textures, { color: [0.02, 0.24, 0.1] });
    const baizeSet = baize.withRepeat(2, 2);
    const mkBaize = (set, tint = 1) => new THREE.MeshPhysicalMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.ormMap, aoMap: set.ormMap, roughness: 1, metalness: 0, sheen: 0.5, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.25, 0.62, 0.36), color: new THREE.Color(tint, tint, tint), envMapIntensity: 0.3, name: 'baize' });
    const furSet = furTexture(ctx.textures, { a: [0.06, 0.04, 0.025], b: [0.27, 0.17, 0.09], key: 'stag2' }).withRepeat(7, 7);
    const boarSet = furTexture(ctx.textures, { a: [0.05, 0.04, 0.035], b: [0.2, 0.15, 0.11], key: 'boar' }).withRepeat(8, 8);
    const furMat = (set) => new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.ormMap, aoMap: set.ormMap, roughness: 1, metalness: 0, envMapIntensity: 0.4, name: 'fur' });
    const mat = {
      wall: M.create('damask', { repeat: [1 / 0.78, 1 / 0.78], base: [0.03, 0.06, 0.13], motif: [0.1, 0.17, 0.31], sheen: 0.7, variant: 1 }),
      ceiling: M.create('plaster', { color: [0.06, 0.08, 0.15], cracks: 0.25, stains: 0.45, repeat: [0.5, 0.5] }),
      floor: M.create('parquet', { species: 'oak', ratio: 5, planksAcross: 2, repeat: [1.0, 1.0], polish: 0.2, wear: 0.7, color: [0.62, 0.55, 0.5], clearcoat: 0.12, clearcoatRoughness: 0.5, macro: 0.6, macroScale: 1.4 }),
      wood: M.create('mahogany', { repeat: [1.4, 1.4], color: [0.6, 0.4, 0.34] }),
      panel: M.create('wood', { species: 'mahogany', boards: 0, polish: 0.75, repeat: [1.1, 1.1], clearcoat: 0.5, clearcoatRoughness: 0.25, color: [0.34, 0.22, 0.19] }),
      tableWood: M.create('mahogany', { repeat: [1.6, 1.6], color: [0.5, 0.31, 0.26] }),
      walnut: M.create('walnut', { repeat: [1.5, 1.5] }),
      crown: M.create('gilded', { pattern: 0, repeats: 4, wear: 0.45, dirt: 0.55, repeat: [1 / 0.55, 1] }),
      frieze: M.create('gilded', { pattern: 6, repeats: 3, ground: 1, groundColor: [0.025, 0.05, 0.1], wear: 0.35, dirt: 0.5, repeat: [1 / 1.0, 1] }),
      gilt: M.create('gold', { wear: 0.45, dirt: 0.5, repeat: [2, 1] }),
      frame: M.create('gilded', { pattern: 1, repeats: 3, wear: 0.45, dirt: 0.65, repeat: [1 / 0.45, 1] }),
      drape: M.create('velvet', { color: [0.22, 0.02, 0.03], crush: 0.55, repeat: [1.6, 1.6], side: THREE.DoubleSide, sheen: 1, sheenRoughness: 0.4, sheenColor: [0.75, 0.2, 0.22] }),
      brass: M.create('brass', { tarnish: 0.3, polish: 0.75, repeat: [3, 3] }),
      glass: M.create('glass', { dirt: 0.6, transparent: true, opacity: 0.16, envMapIntensity: 1.6, roughness: 0.4 }),
      rug: M.create('rug', { palette: 'tabriz', colors: { field: [0.3, 0.035, 0.045], border: [0.06, 0.08, 0.2], ivory: [0.66, 0.57, 0.43], gold: [0.55, 0.36, 0.15] }, aspect: 3.0 / 4.2, knots: 420, wear: 0.45, fringe: 0.03, seed: 41, size: 2048, sheen: 0.4, sheenRoughness: 0.8, envMapIntensity: 0.25, normalScale: 1.6 }),
      marble: null, marbleDark: null,
      brick: M.create('brick', { rows: 10, cols: 4, soot: 1.0, repeat: [1.2, 1.2], color: [0.14, 0.11, 0.1] }),
      leather: M.create('leather', { color: [0.24, 0.05, 0.035], wear: 0.55, buttons: 1, repeat: [2.5, 2.5] }),
      seat: M.create('leather', { color: [0.2, 0.06, 0.04], wear: 0.4, repeat: [3, 3] }),
      baize: mkBaize(baizeSet),
      cushion: mkBaize(baize.withRepeat(6, 6), 0.8),
      cardBaize: mkBaize(baize.withRepeat(3, 3), 0.9),
      dark: M.basic('black', { color: 0x0b0806 }),
      hole: new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.9, name: 'pocket' }),
      pearl: new THREE.MeshPhysicalMaterial({ color: 0xe8e4dc, roughness: 0.2, iridescence: 0.8, clearcoat: 1, name: 'pearl' }),
      ivory: new THREE.MeshPhysicalMaterial({ color: 0xe6d8b8, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: new THREE.Color(1, 0.95, 0.85), name: 'ivory' }),
      ebony: M.create('ebony', { repeat: [2, 2] }),
      maple: new THREE.MeshPhysicalMaterial({ color: 0xc89a5e, roughness: 0.35, clearcoat: 0.5, name: 'maple' }),
      tip: new THREE.MeshStandardMaterial({ color: 0x2a4a7a, roughness: 0.9, name: 'chalk' }),
      iron: M.basic('iron'),
      silver: M.basic('silver', { roughness: 0.3 }),
      crystal: M.basic('crystal', { envMapIntensity: 1.5, opacity: 0.3 }),
      fur: furMat(furSet),
      furBoar: furMat(boarSet),
      eye: new THREE.MeshPhysicalMaterial({ color: 0x080504, roughness: 0.05, clearcoat: 1, name: 'glassEye' }),
      antler: new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 0.6, name: 'antler' }),
      globe: new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: new THREE.Color(1.0, 0.72, 0.42), emissiveIntensity: 0.9, roughness: 0.4, name: 'sconceGlobe' }),
      shadeOuter: new THREE.MeshPhysicalMaterial({ color: 0x0a3618, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, emissive: new THREE.Color(0.06, 0.42, 0.16), emissiveIntensity: 0.55, side: THREE.FrontSide, envMapIntensity: 1.4, name: 'shadeGreen' }),
      shadeInner: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe6b0).multiplyScalar(3.4), side: THREE.BackSide, toneMapped: false, name: 'shadeOpal' }),
      shadeRim: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0d0).multiplyScalar(2.2), toneMapped: false, name: 'shadeRim' }),
      bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.85, 0.6).multiplyScalar(8), toneMapped: false, name: 'bulb' }),
    };
    mat.leatherDark = M.create('leather', { color: [0.1, 0.02, 0.015], wear: 0.3, repeat: [4, 4] });
    {
      const nero = marbleNeroTexture(ctx.textures);
      const mk = (rep, tint = 1) => { const t = nero.withRepeat(rep, rep); return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.ormMap, roughness: 1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.3, color: new THREE.Color(tint, tint, tint), name: 'nero' }); };
      mat.marble = mk(1.6); mat.marbleDark = mk(2.2, 0.8);
      const logs = logTextures(ctx.textures);
      const lb = logs.bark.withRepeat(1, 1);
      mat.log = new THREE.MeshStandardMaterial({ map: lb.map, normalMap: lb.normalMap, roughness: 0.95, emissive: new THREE.Color(1, 1, 1), emissiveMap: logs.ember.map, emissiveIntensity: 2.2, name: 'log' });
      const soot = sootTexture(ctx.textures);
      mat.soot = new THREE.MeshStandardMaterial({ map: soot.map, normalMap: soot.normalMap, roughness: 0.95, name: 'soot' });
      const at2 = antlerTexture(ctx.textures).withRepeat(1, 1);
      mat.antler = new THREE.MeshPhysicalMaterial({ map: at2.map, normalMap: at2.normalMap, roughnessMap: at2.ormMap, roughness: 1, vertexColors: true, clearcoat: 0.2, clearcoatRoughness: 0.5, name: 'antler' });
      const fs2 = furTexture(ctx.textures, { a: [0.06, 0.048, 0.038], b: [0.3, 0.235, 0.165], key: 'stag3' }).withRepeat(5, 5);
      mat.stagFur = new THREE.MeshStandardMaterial({ map: fs2.map, normalMap: fs2.normalMap, roughnessMap: fs2.ormMap, aoMap: fs2.ormMap, roughness: 1, metalness: 0, vertexColors: true, envMapIntensity: 0.4, name: 'stagFur' });
      mat.stagFurD = mat.stagFur.clone(); mat.stagFurD.side = THREE.DoubleSide; mat.stagFurD.name = 'stagFurD';
      mat.noseLeather = new THREE.MeshPhysicalMaterial({ color: 0x0a0807, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3, name: 'noseLeather' });
      mat.shieldWalnut = M.create('walnut', { repeat: [3, 3], color: [0.2, 0.16, 0.135], roughness: 0.8, clearcoat: 0.25, clearcoatRoughness: 0.5 });
      mat.queenIvory = new THREE.MeshPhysicalMaterial({ color: 0xf2e6cc, roughness: 0.35, sheen: 0.3, sheenRoughness: 0.5, sheenColor: new THREE.Color(1, 0.94, 0.82), clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.9, name: 'queenIvory' });
    }

    // ================================================================ shell
    {
      const fg = G.planeUV(X1 - X0, Z1 - Z0, 1).rotateX(-Math.PI / 2);
      const floor = add(new THREE.Mesh(fg, mat.floor)); floor.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2); floor.name = 'floor';
      const cg = G.planeUV(X1 - X0, Z1 - Z0, 1).rotateX(Math.PI / 2);
      const ceil = add(new THREE.Mesh(cg, mat.ceiling)); ceil.position.set((X0 + X1) / 2, H, (Z0 + Z1) / 2); ceil.name = 'ceiling';
    }
    const P = [V3(X0, 0, Z0), V3(X1, 0, Z0), V3(X1, 0, Z1), V3(X0, 0, Z1)];
    const segs = [];
    for (let i = 0; i < 4; i++) {
      const A = P[i], B = P[(i + 1) % 4];
      const along = new THREE.Vector3().subVectors(B, A); const len = along.length(); along.normalize();
      const grp = new THREE.Group(); grp.position.copy(A); grp.rotation.y = -Math.atan2(along.z, along.x); root.add(grp);
      segs.push({ A, len, grp, name: ['back', 'right', 'front', 'left'][i] });
    }
    const S = Object.fromEntries(segs.map((s) => [s.name, s]));
    const lx = { back: (x) => x - X0, right: (z) => z - Z0, front: (x) => X1 - x, left: (z) => Z1 - z };
    const openU = { back: [], right: [], front: [], left: [] }, openL = { back: [], right: [], front: [], left: [] };
    for (const wx of WIN.xs) openU.back.push({ x: lx.back(wx) - WIN.w / 2, y: WIN.sill - WAINS, w: WIN.w, h: WIN.h });
    openL.front.push({ x: lx.front(DOOR.x) - DOOR.w / 2, y: -0.01, w: DOOR.w, h: WAINS + 0.02 });
    openU.front.push({ x: lx.front(DOOR.x) - DOOR.w / 2, y: -0.01, w: DOOR.w, h: DOOR.h - WAINS + 0.01 });
    for (const s of segs) {
      const up = new THREE.Mesh(G.wallWithOpenings(s.len, H - WAINS, openU[s.name], { uvScale: 1 }), mat.wall); up.position.y = WAINS; s.grp.add(up);
      s.grp.add(new THREE.Mesh(G.wallWithOpenings(s.len, WAINS, openL[s.name], { uvScale: 1 }), mat.panel));
    }
    const doorL = DOOR.x - DOOR.w / 2 - 0.14, doorR = DOOR.x + DOOR.w / 2 + 0.14;
    const loop = (y) => P.map((p) => V3(p.x, y, p.z));
    const runPath = (y) => [V3(doorL, y, Z1), V3(X0, y, Z1), V3(X0, y, Z0), V3(X1, y, Z0), V3(X1, y, Z1), V3(doorR, y, Z1)];

    // mouldings: crown, frieze, picture rail, wainscot cap, skirting
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(CROWN_H, 0.18), loop(H - CROWN_H), { closed: true, uvScale: 1 }), mat.crown));
    add(new THREE.Mesh(G.sweepProfile([V2(0.012, 0), V2(0.012, FRIEZE_H)], loop(FRIEZE_Y), { closed: true, uvScale: 1 }), mat.frieze));
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.05, 0.03), loop(FRIEZE_Y - 0.05), { closed: true, uvScale: 2 }), mat.gilt));
    const capProf = [V2(0, 0), V2(0.05, 0.0), V2(0.06, 0.012), V2(0.06, 0.03), V2(0.05, 0.04), V2(0.0, 0.045)];
    add(new THREE.Mesh(G.sweepProfile(capProf, runPath(WAINS - 0.045), { uvScale: 2 }), mat.panel));
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.03, 0.018), runPath(WAINS - 0.08), { uvScale: 2 }), mat.gilt));
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.baseboard(0.22, 0.03), runPath(0), { uvScale: 1 }), mat.panel));
    // wainscot raised panels (skip behind the fireplace and cue rack is fine — they sit in front)
    {
      const pg = G.raisedPanel(0.6, 0.6, { border: 0.06, bevel: 0.03, fieldDepth: 0.01, frameDepth: 0.014 });
      for (const s of segs) {
        let ranges = [[0.1, s.len - 0.1]];
        if (s.name === 'front') ranges = [[0.1, lx.front(DOOR.x) - DOOR.w / 2 - 0.2], [lx.front(DOOR.x) + DOOR.w / 2 + 0.2, s.len - 0.1]];
        if (s.name === 'right') ranges = [[0.1, lx.right(FIRE_Z) - 0.9], [lx.right(FIRE_Z) + 0.9, s.len - 0.1]];
        for (const [a, b] of ranges) {
          if (b - a < 0.3) continue;
          const n = Math.max(1, Math.round((b - a) / 0.72));
          const pw = (b - a) / n;
          for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(pg, mat.panel);
            m.position.set(a + pw * (i + 0.5), 0.22 + (WAINS - 0.22 - 0.1) / 2, 0.004);
            m.scale.set((pw - 0.08) / 0.6, (WAINS - 0.42) / 0.6, 1);
            s.grp.add(m);
          }
        }
      }
    }

    // ================================================================ coffered ceiling
    {
      const bw = 0.16, bd = 0.14;
      const nx = 3, nz = 4;
      const beamX = [], beamZ = [];
      for (let i = 1; i < nx; i++) beamX.push(X0 + (i / nx) * (X1 - X0));
      for (let i = 1; i < nz; i++) beamZ.push(Z0 + (i / nz) * (Z1 - Z0));
      const prof = [V2(-bw / 2, 0), V2(-bw / 2, -bd), V2(bw / 2, -bd), V2(bw / 2, 0)];
      for (const x of beamX) add(at(new THREE.Mesh(G.boxUV(bw, bd, Z1 - Z0, 1), mat.panel), x, H - bd / 2, 0));
      for (const z of beamZ) add(at(new THREE.Mesh(G.boxUV(X1 - X0, bd, bw, 1), mat.panel), 0, H - bd / 2, z));
      // gilt fillets along both lower edges of every beam
      for (const x of beamX) for (const sx of [-1, 1]) add(at(new THREE.Mesh(G.boxUV(0.018, 0.018, Z1 - Z0, 2), mat.gilt), x + sx * (bw / 2 - 0.009), H - bd - 0.006, 0));
      for (const z of beamZ) for (const sz of [-1, 1]) add(at(new THREE.Mesh(G.boxUV(X1 - X0, 0.018, 0.018, 2), mat.gilt), 0, H - bd - 0.006, z + sz * (bw / 2 - 0.009)));
      // sunken relief panel in every coffer (moulded border + faint acanthus wreath)
      const xs = [X0, ...beamX, X1], zs = [Z0, ...beamZ, Z1];
      const ct = cofferTexture(ctx.textures);
      const cofMat = new THREE.MeshStandardMaterial({ map: ct.map, normalMap: ct.normalMap, normalScale: new THREE.Vector2(1.5, 1.5), aoMap: ct.ormMap, roughness: 0.85, name: 'coffer' });
      for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
        const x0 = xs[i] + (i ? bw / 2 : 0.18), x1 = xs[i + 1] - (i < xs.length - 2 ? bw / 2 : 0.18);
        const z0 = zs[j] + (j ? bw / 2 : 0.18), z1 = zs[j + 1] - (j < zs.length - 2 ? bw / 2 : 0.18);
        const pnl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2), cofMat);
        pnl.position.set((x0 + x1) / 2, H - 0.004, (z0 + z1) / 2); add(pnl);
      }
      // plaster ceiling roses where the lamp's two rods are hung
      const roseG = G.latheFromProfile([[0, -0.06], [0.03, -0.058], [0.05, -0.045], [0.08, -0.05], [0.11, -0.035], [0.14, -0.04], [0.17, -0.02], [0.2, -0.022], [0.23, -0.008], [0.24, 0]], 48);
      {
        const p = roseG.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = Math.hypot(x, z), a = Math.atan2(z, x);
          if (r > 0.06 && r < 0.22) p.setY(i, y - 0.008 * Math.pow(0.5 + 0.5 * Math.cos(a * 16), 2) * Math.sin(((r - 0.06) / 0.16) * Math.PI));
        }
        roseG.computeVertexNormals();
      }
      const roseMat = M.create('plaster', { color: [0.2, 0.21, 0.26], cracks: 0.15, stains: 0.35, repeat: [4, 4] });
      for (const sz of [-1, 1]) add(at(new THREE.Mesh(roseG, roseMat), T.x, H - 0.002, T.z + sz * 1.75 * 0.38));
    }

    // ================================================================ windows, drapes, sky
    const sky = nightSkyTexture(ctx.textures);
    const skyMat = new THREE.MeshBasicMaterial({ map: sky.map, color: new THREE.Color(0.85, 0.92, 1.1).multiplyScalar(1.7), toneMapped: false, name: 'sky' });
    const frostTex = ctx.textures.canvas('gameroom:frost', 256, 256, (c) => {
      const rnd = ctx.random.fork('frost');
      c.clearRect(0, 0, 256, 256);
      const gr = c.createRadialGradient(128, 128, 60, 128, 128, 190);
      gr.addColorStop(0, 'rgba(220,232,255,0)'); gr.addColorStop(1, 'rgba(220,232,255,0.55)');
      c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
      c.strokeStyle = 'rgba(235,242,255,0.5)'; c.lineWidth = 1;
      for (let i = 0; i < 260; i++) {
        const side = Math.floor(rnd.next() * 4), u = rnd.next() * 256;
        let x = side === 0 ? u : side === 1 ? 256 : side === 2 ? u : 0, y = side === 0 ? 0 : side === 1 ? u : side === 2 ? 256 : u;
        let a = Math.atan2(128 - y, 128 - x) + (rnd.next() - 0.5) * 1.6;
        const len = 8 + rnd.next() * 50;
        c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += Math.cos(a) * len / 4; y += Math.sin(a) * len / 4; a += (rnd.next() - 0.5) * 0.9; c.lineTo(x, y); }
        c.stroke();
      }
    }, { tile: false });
    const frostMat = new THREE.MeshStandardMaterial({ map: frostTex, transparent: true, depthWrite: false, roughness: 0.6, color: 0xdfe8ff, emissive: 0x2a3a60, emissiveIntensity: 0.6, name: 'frost' });
    for (const [k, wxW] of WIN.xs.entries()) {
      const s = S.back;
      const wx = lx.back(wxW);
      const shape = new THREE.Shape();
      shape.moveTo(-WIN.w / 2 - 0.02, -0.02); shape.lineTo(WIN.w / 2 + 0.02, -0.02); shape.lineTo(WIN.w / 2 + 0.02, WIN.h + 0.02); shape.lineTo(-WIN.w / 2 - 0.02, WIN.h + 0.02);
      const hole = new THREE.Path(); hole.moveTo(-WIN.w / 2, 0); hole.lineTo(-WIN.w / 2, WIN.h); hole.lineTo(WIN.w / 2, WIN.h); hole.lineTo(WIN.w / 2, 0); hole.lineTo(-WIN.w / 2, 0);
      shape.holes.push(hole);
      const rv = new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(shape, { depth: WIN.depth, bevelEnabled: false }), 1), mat.panel);
      rv.position.set(wx, WIN.sill, -WIN.depth); s.grp.add(rv);
      s.grp.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(WIN.w + 0.22, 0.05, WIN.depth + 0.12, 2, 0.012), mat.panel), wx, WIN.sill - 0.02, -WIN.depth / 2 + 0.06));
      const arch = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.11, 0.032), [V3(-WIN.w / 2 - 0.055, 0, 0), V3(-WIN.w / 2 - 0.055, WIN.h + 0.055, 0), V3(WIN.w / 2 + 0.055, WIN.h + 0.055, 0), V3(WIN.w / 2 + 0.055, 0, 0)], { up: V3(0, 0, 1), uvScale: 2, flipOutward: true }), mat.panel);
      arch.position.set(wx, WIN.sill, 0.002); s.grp.add(arch);
      // sash with 2x3 panes
      const sash = new THREE.Group();
      const bar = (w, h, x, y, d = 0.045) => { sash.add(at(new THREE.Mesh(G.boxUV(w, h, d, 2), mat.dark), x, y, 0)); };
      bar(WIN.w, 0.06, 0, 0.03); bar(WIN.w, 0.06, 0, WIN.h - 0.03);
      bar(0.06, WIN.h, -WIN.w / 2 + 0.03, WIN.h / 2); bar(0.06, WIN.h, WIN.w / 2 - 0.03, WIN.h / 2);
      bar(WIN.w, 0.05, 0, WIN.h * 0.5, 0.06);
      bar(0.025, WIN.h, 0, WIN.h / 2, 0.03);
      for (const y of [WIN.h * 0.25, WIN.h * 0.75]) bar(WIN.w, 0.022, 0, y, 0.03);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w - 0.06, WIN.h - 0.06), mat.glass); gl.position.set(0, WIN.h / 2, 0.01); gl.userData.noShadow = true; sash.add(gl);
      // hoar frost creeping in from the corners of each pane
      for (let pi = 0; pi < 8; pi++) {
        const pw2 = (WIN.w - 0.1) / 2, ph2 = (WIN.h - 0.1) / 4;
        const fr = new THREE.Mesh(new THREE.PlaneGeometry(pw2, ph2), frostMat);
        fr.position.set((pi % 2 ? 1 : -1) * pw2 / 2, 0.05 + ph2 * (Math.floor(pi / 2) + 0.5), 0.016); fr.rotation.z = (pi * 1.7) % 3 > 1.5 ? Math.PI : 0;
        fr.userData.noShadow = true; fr.renderOrder = 3; sash.add(fr);
      }
      sash.position.set(wx, WIN.sill, -WIN.depth * 0.55); s.grp.add(sash);
      const card = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5.6), skyMat);
      card.position.set(wx + (k ? 0.9 : -0.6), WIN.sill + 1.1, -3.2); card.userData.noShadow = true; s.grp.add(card);
      // drapes + swagged valance
      const rodY = FRIEZE_Y - 0.12;
      for (const side of [-1, 1]) {
        const cg = fixNaN(G.curtainGeometry({ width: 0.62, height: rodY + 0.05, folds: 6, depth: 0.07, tieback: 0.55, pool: 0.1, seed: side + 3 + k * 5, segX: 60, segY: 56 }), 60);
        const c = new THREE.Mesh(cg, mat.drape);
        c.position.set(wx + side * (WIN.w / 2 + 0.14), rodY, 0.13);
        if (side > 0) c.scale.x = -1;
        s.grp.add(c);
      }
      const vw = WIN.w + 0.75;
      const vg = fixNaN(G.curtainGeometry({ width: vw, height: 0.5, folds: 12, depth: 0.035, gather: 1, seed: 9 + k, segX: 80, segY: 20 }), 80);
      const pos = vg.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const v = -y / 0.5, u = x / vw + 0.5;
        const f = (u * 2) - Math.floor(u * 2);
        const sw = Math.sin(f * Math.PI);
        const hem = 0.5 * (0.4 + 0.6 * Math.pow(sw, 0.8));
        pos.setXYZ(i, x, -v * hem, pos.getZ(i) + sw * v * 0.05);
      }
      vg.computeVertexNormals();
      s.grp.add(at(new THREE.Mesh(vg, mat.drape), wx, rodY + 0.07, 0.19));
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, vw + 0.24, 12), mat.gilt); rod.rotation.z = Math.PI / 2; rod.position.set(wx, rodY + 0.08, 0.15); s.grp.add(rod);
      const cb = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.09, 0.06), [V3(-vw / 2 - 0.1, 0, 0.28), V3(-vw / 2 - 0.1, 0, 0), V3(vw / 2 + 0.1, 0, 0), V3(vw / 2 + 0.1, 0, 0.28)].map((p) => V3(p.x, p.y, -p.z)), { uvScale: 1 }), mat.gilt);
      cb.position.set(wx, rodY + 0.1, 0.28); cb.scale.z = -1; s.grp.add(cb);
    }

    // ================================================================ door to the gallery
    {
      const s = S.front;
      const g = new THREE.Group(); g.position.set(lx.front(DOOR.x), 0, -0.04);
      const w = DOOR.w - 0.02, h = DOOR.h - 0.01;
      g.add(at(new THREE.Mesh(G.boxUV(w, h, 0.05, 1), mat.panel), 0, h / 2, 0));
      for (const [y, hh] of [[0.55, 0.75], [1.55, 0.95], [2.25, 0.36]]) for (const sx of [-1, 1]) {
        const p = new THREE.Mesh(G.raisedPanel(w / 2 - 0.12, hh, { border: 0.045, bevel: 0.022 }), mat.panel); p.position.set(sx * (w / 4 - 0.01), y, 0.025); g.add(p);
      }
      g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), mat.brass), w / 2 - 0.1, 1.02, 0.06));
      g.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.05, 0.16, 0.01, 2, 0.004), mat.brass), w / 2 - 0.1, 1.0, 0.03));
      const cas = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.13, 0.035), [V3(-DOOR.w / 2 - 0.065, 0, 0), V3(-DOOR.w / 2 - 0.065, DOOR.h + 0.065, 0), V3(DOOR.w / 2 + 0.065, DOOR.h + 0.065, 0), V3(DOOR.w / 2 + 0.065, 0, 0)], { up: V3(0, 0, 1), uvScale: 1, flipOutward: true }), mat.panel);
      cas.position.z = 0.04; g.add(cas);
      const ped = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.14, 0.1), [V3(-DOOR.w / 2 - 0.2, 0, 0.0), V3(-DOOR.w / 2 - 0.2, 0, -0.16), V3(DOOR.w / 2 + 0.2, 0, -0.16), V3(DOOR.w / 2 + 0.2, 0, 0.0)], { uvScale: 1, flipOutward: true }), mat.gilt);
      ped.position.set(0, DOOR.h + 0.2, 0.2); g.add(ped);
      s.grp.add(g);
    }

    // ================================================================ rug, billiard table, lamp, balls
    {
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.2), mat.rug);
      rug.rotation.x = -Math.PI / 2; rug.position.set(T.x, 0.007, T.z); rug.name = 'rug'; add(rug);
      // knotted wool fringe at both ends: individual tassels, slightly splayed
      const rnd = ctx.random.fork('fringe');
      const thread = new THREE.CylinderGeometry(0.0022, 0.0018, 1, 4, 1).rotateX(Math.PI / 2).translate(0, 0, 0.5);
      const n = 150;
      const fr = new THREE.InstancedMesh(thread, new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.95, name: 'fringe' }), n * 2);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      let k = 0;
      for (const sz of [-1, 1]) for (let i = 0; i < n; i++) {
        const x = T.x - 1.48 + (i / (n - 1)) * 2.96;
        const len = 0.07 + rnd.next() * 0.025;
        e.set(0, sz < 0 ? Math.PI + (rnd.next() - 0.5) * 0.35 : (rnd.next() - 0.5) * 0.35, 0); q.setFromEuler(e);
        m4.compose(V3(x, 0.008, T.z + sz * 2.1 - sz * 0.015), q, V3(1, 0.6, len)); fr.setMatrixAt(k++, m4);
      }
      fr.userData.keep = true; fr.name = 'cloth'; add(fr);
    }
    const tableMats = { wood: mat.tableWood, baize: mat.baize, cushion: mat.cushion, dark: mat.dark, hole: mat.hole, pearl: mat.pearl, brass: mat.brass, gilt: mat.gilt, leather: M.create('leather', { color: [0.13, 0.065, 0.035], wear: 0.5, repeat: [8, 8], roughness: 0.75 }) };
    const btable = buildBilliardTable(ctx, tableMats);
    btable.position.copy(T); add(btable);
    const BH = TABLE.BH, BR = TABLE.BALL_R;
    // balls: mid-game layout (table-local x across, z along; foot of the table at -z)
    const ballLayout = [
      [0, 0.18, 0.62], [1, -0.05, -0.62], [2, 0.03, -0.69], [3, -0.33, -0.36], [4, 0.37, -0.95], [5, 0.11, -0.74], [6, -0.2, 0.21], [7, -0.08, -0.74],
      [8, 0.0, -0.55], [9, 0.43, 0.36], [10, -0.47, -1.02], [11, 0.25, -0.18], [12, 0.06, -0.81], [13, -0.12, -0.92], [14, 0.5, -0.5], [15, -0.39, 0.82],
    ];
    const ballTex = ballAtlas(ctx.textures);
    const ballMat = new THREE.MeshPhysicalMaterial({ map: ballTex, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1, name: 'balls' });
    const ballGroup = new THREE.Group(); ballGroup.position.copy(T); ballGroup.userData.keep = true; add(ballGroup);
    const balls = [];
    for (const [n, x, z] of ballLayout) {
      const b = new THREE.Mesh(ballGeometry(n), ballMat);
      b.position.set(x, BH + BR, z);
      b.rotation.set((n * 1.7) % 3, (n * 2.3) % 6, (n * 0.9) % 2);
      b.castShadow = true; b.receiveShadow = true;
      ballGroup.add(b); balls.push(b);
    }
    // a cue left lying on the cloth, a triangle and chalk on the rail
    {
      const parts = cueGeometry(G, 1.46);
      const cue = new THREE.Group();
      cue.add(new THREE.Mesh(parts.butt, mat.ebony), new THREE.Mesh(parts.shaft, mat.maple), new THREE.Mesh(parts.ferrule, mat.ivory), new THREE.Mesh(parts.tip, mat.tip), new THREE.Mesh(parts.wrap, mat.leather));
      cue.rotation.set(Math.PI / 2 - 0.03, 0, 0);
      const holder = new THREE.Group(); holder.add(cue);
      holder.rotation.y = Math.PI + 0.42;
      holder.position.set(T.x - 0.02, BH + 0.016, T.z + 1.28);
      cue.position.set(0, 0, 0);
      add(holder);
      const tri = new THREE.Shape(); const R = 0.19;
      for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i / 3) * Math.PI * 2; i ? tri.lineTo(Math.cos(a) * R, Math.sin(a) * R) : tri.moveTo(Math.cos(a) * R, Math.sin(a) * R); }
      const th = new THREE.Path(); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 - (i / 3) * Math.PI * 2; i ? th.lineTo(Math.cos(a) * (R - 0.035), Math.sin(a) * (R - 0.035)) : th.moveTo(Math.cos(a) * (R - 0.035), Math.sin(a) * (R - 0.035)); }
      tri.holes.push(th);
      const trig = new THREE.ExtrudeGeometry(tri, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 }); trig.rotateX(-Math.PI / 2);
      add(at(new THREE.Mesh(G.applyBoxUVs(trig, 1), mat.wood), T.x - 0.32, BH + 0.004, T.z - 0.98)).rotation.y = 0.5;
      for (const [x, z] of [[0.71, 0.4], [-0.7, -1.27]]) { const ch = new THREE.Mesh(new G.RoundedBoxGeometry(0.022, 0.022, 0.022, 2, 0.003), mat.tip); ch.position.set(T.x + x, BH + 0.056, T.z + z); ch.rotation.y = 0.4; add(ch); }
    }
    const LAMP_DROP = 1.88;
    const lamp = buildBilliardLamp(ctx, { brass: mat.brass, shadeOuter: mat.shadeOuter, shadeInner: mat.shadeInner, shadeRim: mat.shadeRim, bulb: mat.bulb }, { length: 1.75, drop: LAMP_DROP, shades: 3 });
    lamp.position.set(T.x, H, T.z);
    lamp.traverse((o) => { if (o.isMesh && o.material?.isMeshBasicMaterial) o.userData.noBake = true; });
    add(lamp);

    // ================================================================ games table + chessboard (puzzle)
    const gtable = buildGamesTable(ctx, { wood: mat.walnut, dark: mat.dark, brass: mat.brass }, { board: BOARD });
    gtable.position.copy(C); add(gtable);
    const boardY = gtable.userData.topY + 0.001;
    {
      const bset = chessboardTexture(ctx.textures, { inner: FIELD / BOARD });
      const bm = new THREE.MeshPhysicalMaterial({ map: bset.map, normalMap: bset.normalMap, roughnessMap: bset.ormMap, roughness: 1, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.4, envMapIntensity: 0.35, name: 'chessboard' });
      const top = new THREE.Mesh(new THREE.PlaneGeometry(BOARD, BOARD).rotateX(-Math.PI / 2), bm);
      top.position.set(C.x, boardY - 0.001, C.z); top.name = 'chessboard'; top.userData.keep = true; top.receiveShadow = true;
      add(top);
    }
    // a toppled black king and a pair of side chairs
    const blackMat = new THREE.MeshPhysicalMaterial({ color: 0x0d0a09, roughness: 0.25, clearcoat: 0.8, name: 'ebonyPiece' });
    {
      const kingG = G.latheFromProfile([[0, 0], [0.023, 0], [0.023, 0.004], [0.02, 0.008], [0.016, 0.013], [0.012, 0.02], [0.009, 0.05], [0.0075, 0.065], [0.012, 0.068], [0.009, 0.072], [0.013, 0.085], [0.011, 0.09], [0, 0.09]], 28);
      const crossA = new THREE.BoxGeometry(0.005, 0.022, 0.005); crossA.translate(0, 0.1, 0);
      const crossB = new THREE.BoxGeometry(0.016, 0.005, 0.005); crossB.translate(0, 0.103, 0);
      const k = new THREE.Mesh(G.mergeGeometries([kingG.toNonIndexed(), crossA.toNonIndexed(), crossB.toNonIndexed()].map((g) => { g.deleteAttribute('uv'); return g; })), blackMat);
      k.rotation.set(0, 0.6, Math.PI / 2 - 0.12);
      k.position.set(C.x + 0.33, boardY + 0.018, C.z + 0.04);
      k.castShadow = true;
      add(k);
    }
    const chairMats = { wood: mat.walnut, seat: mat.seat, brass: mat.brass };
    {
      const ch = buildSideChair(ctx, chairMats); ch.position.set(C.x + 0.15, 0, C.z + 0.72); ch.rotation.y = Math.PI + 0.25; add(ch);
      const ch2 = buildSideChair(ctx, chairMats); ch2.position.set(C.x - 0.05, 0, C.z - 0.72); ch2.rotation.y = -0.1; add(ch2);
    }

    // ================================================================ fireplace + stag (right wall)
    const fire = buildFireplace(ctx, { marble: mat.marble, marbleDark: mat.marbleDark, brick: mat.brick, soot: mat.soot, log: mat.log, iron: mat.iron, brass: mat.brass });
    fire.position.set(lx.right(FIRE_Z), 0, 0); S.right.grp.add(fire);
    {
      // overmantel: gilt-framed mirror panel behind the stag
      const og = new THREE.Group();
      const mw = 1.2, mh = 1.1;
      og.add(new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), new THREE.MeshPhysicalMaterial({ color: 0x30343a, metalness: 1, roughness: 0.3, envMapIntensity: 0.6, name: 'mirror' })));
      og.add(new THREE.Mesh(G.frameGeometry(mw, mh, { width: 0.1, depth: 0.06, uvScale: 1 }), mat.frame));
      og.position.set(lx.right(FIRE_Z), fire.userData.Hm + 0.15 + mh / 2, 0.03);
      S.right.grp.add(og);
      const stag = buildStag(ctx, { shield: mat.shieldWalnut, fur: mat.stagFur, furDouble: mat.stagFurD, eye: mat.eye, nose: mat.noseLeather, antler: mat.antler, gilt: mat.gilt });
      stag.position.set(lx.right(FIRE_Z), fire.userData.Hm + 0.66, 0.035); stag.rotation.y = 0.1; stag.scale.setScalar(1.05);
      S.right.grp.add(stag);
      // mantel garniture: clock and two candlesticks
      const my = fire.userData.Hm;
      const clock = new THREE.Group();
      clock.add(at(new THREE.Mesh(slabTop(G, 0.36, 0.16, 0.035), mat.marble), 0, 0.0175, 0));
      clock.add(at(new THREE.Mesh(slabTop(G, 0.32, 0.13, 0.02), mat.gilt), 0, 0.045, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) clock.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), mat.gilt), sx * 0.15, 0.0, sz * 0.06));
      // drum case on a waisted plinth, flanked by scrolled consoles, an urn finial on top
      const caseG = G.latheFromProfile([[0, 0], [0.06, 0], [0.065, 0.01], [0.05, 0.03], [0.045, 0.06], [0.055, 0.075], [0.04, 0.085], [0, 0.085]], 32);
      clock.add(at(new THREE.Mesh(caseG, mat.gilt), 0, 0.055, 0));
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.08, 40).rotateX(Math.PI / 2), mat.gilt); drum.position.set(0, 0.235, 0); clock.add(drum);
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.01, 10, 40), mat.gilt); bezel.position.set(0, 0.235, 0.042); clock.add(bezel);
      clock.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.076, 40), new THREE.MeshPhysicalMaterial({ color: 0xece2c8, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, name: 'dial' })), 0, 0.235, 0.0405));
      for (let i = 0; i < 12; i++) { const a2 = (i / 12) * Math.PI * 2; const tk = new THREE.Mesh(new THREE.BoxGeometry(0.003, i % 3 ? 0.008 : 0.014, 0.001), mat.dark); tk.position.set(Math.sin(a2) * 0.064, 0.235 + Math.cos(a2) * 0.064, 0.041); tk.rotation.z = -a2; clock.add(tk); }
      for (const [ang, len] of [[-0.2, 0.045], [1.9, 0.062]]) { const hnd = new THREE.Mesh(new THREE.BoxGeometry(0.0035, len, 0.0015), mat.dark); hnd.geometry.translate(0, len / 2, 0); hnd.rotation.z = ang; hnd.position.set(0, 0.235, 0.043); clock.add(hnd); }
      for (const sx of [-1, 1]) {
        const sc = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 20, Math.PI * 1.3), mat.gilt); sc.position.set(sx * 0.1, 0.12, 0); sc.rotation.set(0, 0, sx > 0 ? -0.6 : Math.PI - 0.7); clock.add(sc);
        clock.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.018, 0], [0.012, 0.02], [0.02, 0.05], [0.008, 0.07], [0, 0.08]], 14), mat.gilt), sx * 0.13, 0.055, 0));
      }
      clock.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.02, 0], [0.028, 0.02], [0.03, 0.04], [0.015, 0.055], [0.022, 0.065], [0.006, 0.09], [0, 0.095]], 18), mat.gilt), 0, 0.32, 0));
      clock.position.set(lx.right(FIRE_Z) - 0.02, my, 0.24); S.right.grp.add(clock);
      for (const sx of [-1, 1]) {
        const cs = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.05, 0], [0.05, 0.01], [0.02, 0.03], [0.014, 0.12], [0.022, 0.2], [0.03, 0.21], [0.012, 0.215], [0, 0.215]], 18), mat.brass);
        cs.position.set(lx.right(FIRE_Z) + sx * 0.6, my, 0.18); S.right.grp.add(cs);
        const cnd = fx.candle({ height: 0.16, radius: 0.012, light: true, lightIntensity: 0.45, lightDistance: 2.5, seed: 30 + sx, burn: 0.6 });
        cnd.position.set(lx.right(FIRE_Z) + sx * 0.6, my + 0.215, 0.18); S.right.grp.add(cnd);
      }
    }

    let paintingLightAt = null;
    // ================================================================ left wall: cue rack, boar, painting over a cabinet
    {
      const rack = buildCueRack(ctx, { wood: mat.wood, brass: mat.brass, gilt: mat.gilt, dark: mat.dark, ivory: mat.ivory, ebony: mat.ebony, maple: mat.maple, tip: mat.tip, leather: mat.leather });
      rack.position.set(lx.left(0.85), 0.3, 0.02); S.left.grp.add(rack);
      const boar = buildTrophy(ctx, mat, 'boar');
      boar.position.set(lx.left(0.85), 2.72, 0.04); S.left.grp.add(boar);
      // hunting landscape
      const pg = new THREE.Group();
      const pw = 1.35, ph = 0.95;
      { const ht = huntPaintingTexture(ctx.textures, pw / ph); pg.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshPhysicalMaterial({ map: ht.map, normalMap: ht.normalMap, roughnessMap: ht.ormMap, roughness: 1, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.5, name: 'huntPainting' }))); }
      // brass picture light over it
      pg.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 14).rotateZ(Math.PI / 2), mat.brass), 0, ph / 2 + 0.16, 0.13));
      pg.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.14, 8).rotateX(Math.PI / 2), mat.brass), 0, ph / 2 + 0.16, 0.06));
      pg.add(new THREE.Mesh(G.frameGeometry(pw, ph, { width: 0.12, depth: 0.065, uvScale: 1 }), mat.frame));
      pg.position.set(lx.left(-1.55), 2.1, 0.035); S.left.grp.add(pg);
      paintingLightAt = pg;
      // cabinet (tantalus + humidor on top)
      const cab = new THREE.Group();
      cab.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(1.2, 0.86, 0.45, 2, 0.015), mat.wood), 0, 0.45, 0.225));
      cab.add(at(new THREE.Mesh(slabTop(G, 1.28, 0.5), mat.wood), 0, 0.88, 0.25));
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(G.raisedPanel(0.5, 0.56, { border: 0.05, bevel: 0.025 }), mat.wood); p.position.set(sx * 0.28, 0.45, 0.452); cab.add(p); cab.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), mat.brass), sx * 0.06, 0.5, 0.47)); }
      cab.add(at(new THREE.Mesh(G.boxUV(1.16, 0.06, 0.42, 1), mat.dark), 0, 0.03, 0.22));
      // tantalus: brass frame with three cut-glass decanters
      const tant = new THREE.Group();
      tant.add(at(new THREE.Mesh(new G.RoundedBoxGeometry(0.42, 0.03, 0.16, 2, 0.006), mat.walnut), 0, 0.015, 0));
      for (const sx of [-1, 1]) tant.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 8), mat.brass), sx * 0.2, 0.17, 0));
      tant.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 8).rotateZ(Math.PI / 2), mat.brass), 0, 0.3, 0));
      const decG = G.latheFromProfile([[0, 0], [0.05, 0], [0.055, 0.02], [0.055, 0.15], [0.03, 0.18], [0.016, 0.2], [0.016, 0.23], [0.022, 0.24], [0, 0.24]], 6);
      const liq = [0x5a2a08, 0x6a3a0c, 0x3a0a0a];
      for (let i = 0; i < 3; i++) {
        tant.add(at(new THREE.Mesh(decG, mat.crystal), -0.13 + i * 0.13, 0.03, 0));
        tant.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.047, 0], [0.051, 0.02], [0.051, 0.1 - i * 0.02], [0, 0.1 - i * 0.02]], 6), new THREE.MeshPhysicalMaterial({ color: liq[i], roughness: 0.05, clearcoat: 1, name: 'spirit' })), -0.13 + i * 0.13, 0.033, 0));
        tant.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), mat.crystal), -0.13 + i * 0.13, 0.29, 0));
      }
      tant.position.set(-0.25, 0.905, 0.25); cab.add(tant);
      const hum = new THREE.Mesh(new G.RoundedBoxGeometry(0.3, 0.12, 0.2, 2, 0.01), mat.walnut); hum.position.set(0.33, 0.965, 0.24); cab.add(hum);
      cab.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), mat.brass), 0.33, 0.96, 0.345));
      cab.position.set(lx.left(-1.55), 0, 0.0); S.left.grp.add(cab);
    }

    // ================================================================ back wall trophy (between the windows)
    {
      // a portrait of the master of the house, between the windows
      const pg = new THREE.Group();
      const pw = 0.62, ph = 0.82;
      pg.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), M.create('painting', { subject: 1, seed: 7, aspect: pw / ph, size: 1024, color: [0.8, 0.8, 0.8] })));
      pg.add(new THREE.Mesh(G.frameGeometry(pw, ph, { width: 0.1, depth: 0.06, uvScale: 1 }), mat.frame));
      const ct = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), mat.gilt); ct.scale.set(1.6, 0.8, 0.35); ct.position.set(0, ph / 2 + 0.11, 0.04); pg.add(ct);
      pg.position.set(lx.back(0), 2.2, 0.035); S.back.grp.add(pg);
      // a brass picture light over it
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 14).rotateZ(Math.PI / 2), mat.brass); pl.position.set(lx.back(0), 2.2 + ph / 2 + 0.2, 0.12); S.back.grp.add(pl);
      S.back.grp.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8).rotateX(Math.PI / 2), mat.brass), lx.back(0), 2.2 + ph / 2 + 0.2, 0.06));
    }

    // ================================================================ card table by the door, Chesterfield by the fire
    const cardTable = buildCardTable(ctx, { wood: mat.wood, baize: mat.cardBaize, gilt: mat.gilt, brass: mat.brass }, { r: 0.5 });
    cardTable.position.copy(CARD); add(cardTable);
    {
      for (const [a, pull] of [[Math.PI * 0.85, 0.12], [Math.PI * 1.55, 0.0], [Math.PI * 0.2, 0.25]]) {
        const ch = buildSideChair(ctx, { wood: mat.wood, seat: mat.seat, brass: mat.brass });
        ch.position.set(CARD.x + Math.sin(a) * (0.72 + pull), 0, CARD.z + Math.cos(a) * (0.72 + pull));
        ch.rotation.y = a + Math.PI + (pull > 0.2 ? 0.5 : 0.05);
        add(ch);
      }
      // cards
      const atlas = cardAtlas(ctx.textures);
      const cardMat = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.55, name: 'cards' });
      const cw = 0.063, chh = 0.088;
      const cardG = (face) => {
        const g = new THREE.PlaneGeometry(cw, chh).rotateX(-Math.PI / 2);
        const k = CARD_FACES.indexOf(face);
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / CARD_FACES.length);
        return g;
      };
      const y0 = 0.733;
      const deal = [
        ['7h', 0.12, 0.0, 0.2], ['Qs', 0.16, 0.05, -0.15], ['As', 0.2, -0.04, 0.5], ['3c', -0.12, 0.16, 1.1],
        ['back', -0.2, -0.12, 0.3], ['back', -0.16, -0.16, 0.42], ['back', 0.0, -0.26, -0.3], ['back', 0.03, -0.27, -0.1],
      ];
      deal.forEach(([f, x, z, r], i) => { const m = new THREE.Mesh(cardG(f), cardMat); m.position.set(CARD.x + x, y0 + 0.0006 * (i + 1), CARD.z + z); m.rotation.y = r; add(m); });
      // the deck
      for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(cardG('back'), cardMat); m.position.set(CARD.x - 0.02, y0 + 0.006 + i * 0.0007, CARD.z + 0.2); m.rotation.y = 1.2 + i * 0.01; add(m); }
      add(at(new THREE.Mesh(G.boxUV(cw, 0.01, chh, 1).rotateY(1.2), new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.8, name: 'deckEdge' })), CARD.x - 0.02, y0 + 0.006 - 0.0045 + 0.0044, CARD.z + 0.2));
      // poker chips
      const chipG = new THREE.CylinderGeometry(0.019, 0.019, 0.0034, 20);
      const chipMats = [0xe7dfcc, 0x8a1a1c, 0x162a4a, 0x121010].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 0.4, name: 'chip' }));
      const rnd = ctx.random.fork('chips');
      [[0.25, -0.18, 9], [0.29, -0.13, 6], [-0.27, 0.05, 12], [-0.22, 0.1, 5], [0.03, 0.08, 3]].forEach(([x, z, n], s) => {
        for (let i = 0; i < n; i++) { const m = new THREE.Mesh(chipG, chipMats[(s + (i > n / 2 ? 1 : 0)) % 4]); m.position.set(CARD.x + x + (rnd.next() - 0.5) * 0.003, y0 + 0.0017 + i * 0.0035, CARD.z + z + (rnd.next() - 0.5) * 0.003); add(m); }
      });
      // whisky tumbler, ashtray with a cigar, oil lamp
      const tum = G.latheFromProfile([[0, 0], [0.032, 0], [0.034, 0.004], [0.036, 0.09], [0.033, 0.09], [0.031, 0.012], [0, 0.012]], 8);
      add(at(new THREE.Mesh(tum, mat.crystal), CARD.x - 0.3, y0, CARD.z - 0.14));
      add(at(new THREE.Mesh(G.latheFromProfile([[0, 0.012], [0.03, 0.012], [0.03, 0.035], [0, 0.035]], 12), new THREE.MeshPhysicalMaterial({ color: 0x6a3208, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85, name: 'whisky' })), CARD.x - 0.3, y0, CARD.z - 0.14));
      add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0], [0.065, 0.015], [0.05, 0.02], [0.045, 0.008], [0, 0.008]], 24), mat.crystal), CARD.x + 0.08, y0, CARD.z + 0.3));
      const cigar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.13, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.9, name: 'cigar' }));
      cigar.position.set(CARD.x + 0.1, y0 + 0.02, CARD.z + 0.32); cigar.rotation.y = 0.5; add(cigar);
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.35, 0.08).multiplyScalar(4), toneMapped: false })); ember.position.set(CARD.x + 0.1 + Math.cos(0.5) * 0.065, y0 + 0.02, CARD.z + 0.32 - Math.sin(0.5) * 0.065); ember.userData.noBake = true; add(ember);
      // smoke wisp: a twisting tapered ribbon, ghost-lit
      const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push(V3(Math.sin(t * 9) * 0.03 * t + t * 0.05, t * 0.75, Math.cos(t * 7) * 0.025 * t)); }
      const smokeMat = fx.ghostMaterial({ color: 0x8a96aa, rimColor: 0xc8d2e0, opacity: 0.22, intensity: 0.5 });
      const smoke = new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3(pts), 60, 0.003, 0.03, 8), smokeMat);
      smoke.position.copy(ember.position); smoke.userData.noBake = true; smoke.userData.keep = true; smoke.renderOrder = 6; add(smoke);
      ctx.onUpdate((dt, t) => { smoke.rotation.y = t * 0.25; smoke.scale.set(1 + Math.sin(t * 0.7) * 0.15, 1, 1); });
      // oil lamp (lit) at the far side of the table
      const lampBase = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0], [0.06, 0.01], [0.025, 0.03], [0.02, 0.08], [0.05, 0.11], [0.055, 0.14], [0.03, 0.17], [0.015, 0.18], [0, 0.18]], 20), mat.brass);
      lampBase.position.set(CARD.x - 0.05, y0, CARD.z - 0.3); add(lampBase);
      const chimney = new THREE.Mesh(G.latheFromProfile([[0.02, 0], [0.028, 0.03], [0.034, 0.06], [0.02, 0.12], [0.017, 0.2]], 18), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.15, depthWrite: false, name: 'chimney' }));
      chimney.position.set(CARD.x - 0.05, y0 + 0.18, CARD.z - 0.3); chimney.userData.noShadow = true; add(chimney);
      const lf = fx.flame({ height: 0.045, width: 0.014, intensity: 7, seed: 77 });
      lf.position.set(CARD.x - 0.05, y0 + 0.19, CARD.z - 0.3); add(lf);
    }
    const chest = buildChesterfield(ctx, { leather: mat.leather, leatherDark: mat.leatherDark, wood: mat.wood });
    chest.position.set(1.85, 0, -2.85); chest.rotation.y = -0.55 + Math.PI * 0.5 - 0.35; add(chest);
    {
      // small wine table by the armchair with a brandy balloon
      const wt = new THREE.Group();
      wt.add(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.16, 0], [0.16, 0.02], [0.05, 0.05], [0.025, 0.1], [0.03, 0.3], [0.02, 0.5], [0.03, 0.55], [0, 0.56]], 18), mat.wood));
      wt.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.22, 0], [0.225, 0.015], [0.22, 0.03], [0, 0.03]], 32), mat.wood), 0, 0.56, 0));
      wt.add(at(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.03, 0], [0.004, 0.006], [0.004, 0.04], [0.035, 0.06], [0.045, 0.09], [0.035, 0.12], [0.03, 0.125]], 16), mat.crystal), 0.04, 0.59, 0.02));
      wt.position.set(2.65, 0, -2.0); add(wt);
    }

    // ================================================================ wall sconces
    const sconceLights = [];
    for (const [s, x] of [['right', lx.right(FIRE_Z) - 1.15], ['right', lx.right(FIRE_Z) + 1.15], ['left', lx.left(-0.2)], ['front', lx.front(-0.8)], ['front', lx.front(-2.6)]]) {
      const sc = buildSconce(ctx, { brass: mat.brass, globe: mat.globe });
      sc.position.set(x, 1.95, 0.0); S[s].grp.add(sc);
      sc.updateWorldMatrix(true, false);
      const l = new THREE.PointLight(0xffa860, 3.0, 7, 2);
      root.updateMatrixWorld(true);
      const wp = sc.localToWorld(sc.userData.lightPos.clone()); l.position.copy(root.worldToLocal(wp)); root.add(l); sconceLights.push(l);
    }

    // ================================================================ lights
    // Hierarchy: the billiard lamp is the key (warm, hot pool on the baize), the moon a cold
    // rim through the windows, fire + sconces warm practicals; everything else falls to blue-black.
    const moonPos = V3(-0.7, 8.65, Z0 - 5.0), moonTarget = V3(-0.3, 0, -2.5);
    const moon = new THREE.SpotLight(0xa9bfff, 1500, 26, 0.36, 0.3, 2);
    moon.position.copy(moonPos); moon.target.position.copy(moonTarget);
    moon.castShadow = Q.shadows;
    moon.shadow.mapSize.set(Q.shadowMapSize, Q.shadowMapSize);
    moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.02; moon.shadow.radius = Q.shadowRadius;
    moon.shadow.camera.near = 3; moon.shadow.camera.far = 22;
    root.add(moon, moon.target);
    root.add(new THREE.HemisphereLight(0x3a52a0, 0x1c1009, 1.35));
    for (const wx of WIN.xs) root.add(fx.areaLight({ center: [wx, WIN.sill + WIN.h / 2, Z0 - 0.1], normal: [0, -0.3, 1], width: WIN.w - 0.1, height: WIN.h - 0.1, color: 0x8ea6ff, intensity: 2.2 }));
    {
      const pls = new THREE.SpotLight(0xffc890, 2.2, 3, 0.7, 0.6, 2);
      pls.position.set(0, 2.2 + 0.41 + 0.18, Z0 + 0.14); pls.target.position.set(0, 2.0, Z0); root.add(pls, pls.target);
      // picture light over the hunting scene
      if (paintingLightAt) {
        root.updateMatrixWorld(true);
        const lp = root.worldToLocal(paintingLightAt.localToWorld(V3(0, 0.95 / 2 + 0.14, 0.16)));
        const lt = root.worldToLocal(paintingLightAt.localToWorld(V3(0, -0.45, -0.1)));
        const hl = new THREE.SpotLight(0xffc488, 4.5, 3.5, 0.95, 0.8, 2); hl.position.copy(lp); hl.target.position.copy(lt); root.add(hl, hl.target);
      }
    }
    // the billiard lamp: a tight warm spot under each shade (centre one shadowed) + a glow above the shades
    const lampY = H - LAMP_DROP - 0.16;
    let lampBase = 30;
    const lampSpots = lamp.userData.bulbs.map((b, i) => {
      const sp = new THREE.SpotLight(0xffd29a, lampBase, 5, 0.58, 0.7, 2);
      sp.position.set(T.x, lampY, T.z + b.z); sp.target.position.set(T.x, 0, T.z + b.z);
      if (i === 1) {
        sp.castShadow = Q.shadows;
        sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0012; sp.shadow.normalBias = 0.02; sp.shadow.radius = 4; sp.shadow.camera.near = 0.1; sp.shadow.camera.far = 4;
      }
      root.add(sp, sp.target);
      return sp;
    });
    const lampGlow = new THREE.PointLight(0xffb066, 1.2, 4, 2); lampGlow.position.set(T.x, lampY + 0.5, T.z); root.add(lampGlow);
    // fire: low in the firebox, flickering +-25% at 2-4 Hz
    const fireLight = new THREE.PointLight(0xff6a24, 7, 7, 2); fireLight.position.set(X1 - 0.6, 0.38, FIRE_Z); root.add(fireLight);
    // card table oil lamp
    const oilLight = new THREE.PointLight(0xffa04a, 1.5, 4, 2); oilLight.position.set(CARD.x - 0.05, 1.0, CARD.z - 0.3); root.add(oilLight);
    // a candle left burning on the games table: warm fill on the chessboard
    const chessCandle = fx.candle({ height: 0.15, radius: 0.012, light: true, lightIntensity: 1.6, lightDistance: 3, seed: 61, burn: 0.45 });
    {
      const cs = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.045, 0], [0.047, 0.008], [0.03, 0.016], [0.012, 0.03], [0.009, 0.1], [0.016, 0.115], [0.022, 0.12], [0.012, 0.125], [0, 0.125]], 20), mat.brass);
      cs.position.set(C.x - 0.355, boardY, C.z - 0.35); add(cs);
      chessCandle.position.set(C.x - 0.355, boardY + 0.125, C.z - 0.35); add(chessCandle);
    }
    // warm spill from the gallery beyond the door
    root.add(fx.areaLight({ center: [DOOR.x, 1.4, Z1 - 0.05], normal: [0, 0.05, -1], width: 1.0, height: 2.4, color: 0xffc896, intensity: 1.0 }));
    ctx.onUpdate((dt, t) => {
      const f = 0.97 + 0.02 * Math.sin(t * 5.3) * Math.sin(t * 2.1) + 0.01 * Math.sin(t * 11.1);
      lampSpots.forEach((s) => { s.intensity = lampBase * f; });
      lampGlow.intensity = 1.2 * f;
      const ff = 1 + 0.14 * Math.sin(t * 2 * Math.PI * 2.3) + 0.08 * Math.sin(t * 2 * Math.PI * 3.7 + 1.3) + 0.05 * Math.sin(t * 2 * Math.PI * 2.9 + 4.0);
      fireLight.intensity = 6.5 * ff;
      fire.userData.coalMat.emissiveIntensity = 0.7 * (0.85 + 0.3 * (ff - 0.75));
      fire.userData.logMat.emissiveIntensity = 2.2 * (0.8 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.3)) * ff);
      oilLight.intensity = 1.5 * (0.92 + 0.08 * Math.sin(t * 8.3) * Math.sin(t * 3.3 + 2));
    });

    // volumetrics: clipped moon shafts (shadowed by the games table), tobacco haze under the shades, dust, floor mist
    const shafts = [];
    const roomMin = V3(X0 + 0.02, 0.0, Z0 - 0.4), roomMax = V3(X1 - 0.02, H, Z1);
    const gtOcc = { x: C.x, z: C.z, top: gtable.userData.topY, hx: 0.41, hz: 0.41 };
    for (const wx of WIN.xs) {
      const winCenter = V3(wx, WIN.sill + WIN.h / 2, Z0 - 0.05);
      const dir = new THREE.Vector3().subVectors(winCenter, moonPos).normalize();
      const sh = clippedShaft({ center: winCenter, right: V3(WIN.w / 2 - 0.02, 0, 0), up: V3(0, WIN.h / 2 - 0.02, 0), direction: dir, length: 4.4, color: 0x8faaff, intensity: wx < 0 ? 0.2 : 0.14, softness: 0.25, falloff: 1.5, panes: [2, 4], mullion: 0.03, noise: 0.75, roomMin, roomMax, occluders: wx < 0 ? [gtOcc] : [], time: ctx.time });
      root.add(sh); shafts.push(sh);
    }
    lamp.userData.bulbs.forEach((b, i) => {
      const hz = hazeCone({ top: 0.17, bottom: 0.62, height: 0.9, color: 0xffc27a, opacity: 0.022, seed: i * 3.7, time: ctx.time });
      hz.position.set(T.x, lampY + 0.03, T.z + b.z); add(hz);
    });
    const dust = root.add(fx.dust({ box: new THREE.Box3(V3(-3.0, 0.3, Z0 + 0.1), V3(0.4, 3.0, -1.6)), count: 1800, shafts, size: 0.011, intensity: 2.0, ambient: 0.0 })) && root.children[root.children.length - 1];
    root.add(fx.fog({ box: new THREE.Box3(V3(T.x - 1.3, 1.2, T.z - 1.9), V3(T.x + 1.3, 2.4, T.z + 1.9)), color: 0x1a1a1e, litColor: 0x8a6a48, density: 0.22, heightFalloff: 0.8 }));
    root.add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.1, 0, Z0 + 0.1), V3(X1 - 0.1, 0.45, Z1 - 0.3)), color: 0x080c16, litColor: 0x2a3550, density: 0.35, heightFalloff: 4 }));

    // ================================================================ the queens puzzle
    const queens = createQueensPuzzle(ctx, {
      parent: root,
      center: V3(C.x, boardY, C.z),
      size: FIELD,
      homeZ: FIELD / 2 + (BOARD - FIELD) / 4,
      mats: { ivory: mat.queenIvory },
      borderOuter: (BOARD - FIELD) / 2 * 0.42,
      camera: { position: [C.x, boardY + 0.68, C.z + 0.5], target: [C.x, boardY, C.z + 0.04], fov: 42 },
      onSolved: async () => {
        ctx.state.set('gameroom.queensSolved', true);
        ctx.audio.sfx?.('chime', { freq: 880 });
        await ctx.say({ text: 'Eight queens, and not one of them at another\'s throat. How very *unlike* a family.', speaker: 'stauf', speakerName: 'Stauf' });
      },
    });
    if (ctx.state.isSolved(QUEENS_ID)) queens.applySolved();
    // the moon shaft passes right through the puzzle camera: thin it out while playing
    {
      const pz = queens.puzzle, setup0 = pz.setup, teardown0 = pz.teardown;
      const shaftI = shafts.map((sh) => sh.material.uniforms.uIntensity.value);
      pz.setup = (p) => { dust.visible = false; shafts.forEach((sh, i) => { sh.material.uniforms.uIntensity.value = shaftI[i] * 0.12; }); ctx.post.set({ exposure: 1.0, godRayWeight: 0.04, bloomStrength: 0.18, bloomThreshold: 1.4 }, ctx.shot ? 0 : 0.8); return setup0(p); };
      pz.teardown = (p) => { dust.visible = true; shafts.forEach((sh, i) => { sh.material.uniforms.uIntensity.value = shaftI[i]; }); ctx.post.set({ exposure: ROOM_GRADE.exposure, godRayWeight: ROOM_GRADE.godRayWeight, bloomStrength: ROOM_GRADE.bloomStrength, bloomThreshold: ROOM_GRADE.bloomThreshold }, 0.8); return teardown0(p); };
    }
    if (ctx.params.get('queens') === 'mid') queens.arrange([[0, 0], [4, 1], [7, 2], [3, 3], [2, 4]]);
    if (ctx.params.get('queens') === 'solved') queens.applySolved();

    // ================================================================ ghostly cue ball (examine the table)
    let rolling = null;
    ctx.onUpdate((dt) => {
      if (!rolling) return;
      rolling.t += dt;
      const u = Math.min(1, rolling.t / rolling.d);
      const e = 1 - (1 - u) * (1 - u);
      const b = rolling.ball;
      b.position.lerpVectors(rolling.from, rolling.to, e);
      b.rotation.x += dt * 9 * (1 - u);
      if (u >= 1) {
        if (rolling.sink) { b.position.y -= Math.min(0.08, (rolling.t - rolling.d) * 0.5); if (rolling.t > rolling.d + 0.3) { b.visible = false; rolling = null; } }
        else rolling = null;
      }
    });

    // ================================================================ nodes, edges, exits
    const nodes = {
      main: { position: [-1.75, 1.63, 3.4], target: [0.4, 1.18, -3.2], fov: 60, label: 'The game room', look: { yaw: [-50, 50], pitch: [-28, 24] } },
      door: { position: [-1.7, 1.63, 3.25], target: [-1.7, 1.35, 8.0], fov: 58, label: 'The way out' },
      billiards: { position: [1.62, 1.58, 1.95], target: [-0.25, 0.8, -1.05], fov: 55, label: 'The billiard table', look: { yaw: [-55, 55], pitch: [-35, 25] } },
      chess: { position: [-0.65, 1.52, -1.45], target: [C.x, 0.78, C.z], fov: 54, label: 'The games table', look: { yaw: [-60, 60], pitch: [-35, 25] } },
      hearth: { position: [1.25, 1.58, 1.45], target: [X1, 1.42, FIRE_Z - 0.15], fov: 60, label: 'The fireplace', look: { yaw: [-60, 60], pitch: [-25, 30] } },
      back: { position: [0.05, 1.62, -3.05], target: [-0.9, 1.3, 4.0], fov: 58, label: 'Looking back' },
    };
    const edges = [
      ['main', 'door', null, { hotspot: { door: { position: [-1.7, 1.3, 5.4], radius: 0.8 }, main: { position: [-1.0, 1.4, 0.5], radius: 0.8 } } }],
      ['main', 'billiards', [[-0.6, 1.6, 2.6]]],
      ['main', 'chess', [[-1.55, 1.6, 1.4], [-1.45, 1.58, -0.3]]],
      ['main', 'hearth', [[-0.4, 1.6, 2.4], [1.2, 1.6, 1.8]]],
      ['billiards', 'hearth'],
      ['billiards', 'back', [[1.55, 1.6, -0.8], [1.0, 1.6, -2.5]]],
      ['hearth', 'back', [[1.5, 1.6, -1.6]]],
      ['chess', 'back'],
      ['chess', 'billiards', [[-1.2, 1.6, 1.5], [0.5, 1.6, 1.8]]],
      ['back', 'main', [[-1.3, 1.6, -1.2], [-1.6, 1.6, 2.0]], { hotspot: { main: { position: [-1.2, 1.4, 2.6], radius: 0.6 } } }],
    ];
    const doorBox = { min: [DOOR.x - DOOR.w / 2, 0.1, Z1 - 0.12], max: [DOOR.x + DOOR.w / 2, DOOR.h, Z1 + 0.05] };
    const exits = [
      { node: 'door', toRoom: 'gallery', toNode: 'gamedoor', label: 'Back to the gallery', hotspot: { box: doorBox } },
      { node: 'back', toRoom: 'gallery', toNode: 'gamedoor', label: 'To the gallery', hotspot: { box: doorBox } },
    ];

    // ================================================================ hotspots
    const cap = (title, text) => () => ctx.ui.caption(text, { title });
    const hotspots = [
      { id: 'queens', nodes: ['chess', 'main', 'back'], box: { min: [C.x - 0.36, boardY - 0.02, C.z - 0.36], max: [C.x + 0.36, boardY + 0.12, C.z + 0.36] }, cursor: 'puzzle', label: 'The chessboard', puzzle: queens.puzzle, priority: 2 },
      {
        id: 'cueball', nodes: ['billiards', 'main'], sphere: { center: T.clone().add(V3(0.18, BH + BR, 0.62)).toArray(), radius: 0.12 }, cursor: 'grab', label: 'The cue ball', priority: 2,
        enabled: () => !ctx.state.has('gameroom.eightSunk'),
        onActivate: async () => {
          // the eight-ball rolls on its own into the far corner pocket
          const eight = balls[8];
          const pocket = btable.userData.pockets.find((p) => p.x < 0 && p.z < -0.5);
          rolling = { ball: eight, from: eight.position.clone(), to: V3(pocket.x * 0.94, BH + BR, pocket.z * 0.97), t: 0, d: 1.8, sink: true };
          ctx.state.set('gameroom.eightSunk', true);
          ctx.audio.sfx?.('click');
          await new Promise((r) => setTimeout(r, 1900));
          ctx.audio.sfx?.('thud');
          await ctx.say({ text: 'The eight ball, in the corner pocket. You *do* know what that means... you lose.', speaker: 'stauf', speakerName: 'Stauf' });
        },
      },
      { id: 'billiard-table', nodes: ['billiards', 'main', 'back'], box: { min: [T.x - 0.75, 0.2, T.z - 1.3], max: [T.x + 0.75, BH + 0.05, T.z + 1.3] }, cursor: 'examine', label: 'The billiard table', onActivate: cap('The Billiard Table', 'Green baize gone grey at the cushions. Someone was halfway through a game — the score on the wall stops at thirteen to seven.') },
      {
        id: 'lamp', nodes: ['billiards', 'main', 'back'], box: { min: [T.x - 0.25, lampY - 0.05, T.z - 1.0], max: [T.x + 0.25, lampY + 0.3, T.z + 1.0] }, cursor: 'examine', label: 'The billiard lamp',
        onActivate: async () => { lampBase = 4; await new Promise((r) => setTimeout(r, 300)); lampBase = 13; ctx.ui.caption('The green shades sway, though nothing touched them. Tobacco smoke hangs under them that no one has breathed for years.', { title: 'The Lamp' }); },
      },
      {
        id: 'stag', nodes: ['hearth', 'main', 'billiards'], sphere: { center: [X1 - 0.35, fire.userData.Hm + 0.75, FIRE_Z], radius: 0.42 }, cursor: 'talk', label: 'A stag\'s head',
        onActivate: async () => { ctx.audio.sfx?.('laugh'); await ctx.say({ text: 'A magnificent beast. He came for dinner, too. He simply... *stayed*.', speaker: 'stauf', speakerName: 'Stauf' }); },
      },
      { id: 'fire', nodes: ['hearth', 'main'], box: { min: [X1 - 0.6, 0.0, FIRE_Z - 0.7], max: [X1, 1.3, FIRE_Z + 0.7] }, cursor: 'examine', label: 'The fireplace', onActivate: cap('The Fireplace', 'The fire is burning, and has been burning, and nobody has fed it. The logs never grow smaller.') },
      { id: 'cuerack', nodes: ['main', 'chess', 'billiards', 'back'], box: { min: [X0, 0.3, 0.4], max: [X0 + 0.2, 2.15, 1.3] }, cursor: 'examine', label: 'The cue rack', onActivate: cap('The Cue Rack', 'Seven cues and an empty clip. The beads on the scoreboard have been pushed to thirteen.') },
      { id: 'boar', nodes: ['main', 'chess', 'billiards'], sphere: { center: [X0 + 0.25, 2.72, 0.85], radius: 0.3 }, cursor: 'examine', label: 'A boar\'s head', onActivate: cap('The Boar', 'Its tusks are yellowed and one is chipped. The glass eyes have been turned, very slightly, to watch the door.') },
      { id: 'cards', nodes: ['back', 'main', 'hearth'], box: { min: [CARD.x - 0.5, 0.6, CARD.z - 0.5], max: [CARD.x + 0.5, 0.95, CARD.z + 0.5] }, cursor: 'examine', label: 'A hand of cards', onActivate: cap('The Card Table', 'A seven of hearts, a queen of spades, an ace. Three hands dealt, and a fourth place laid for a player who never sat down.') },
      { id: 'painting', nodes: ['main', 'chess', 'back'], box: { min: [X0, 1.55, -2.3], max: [X0 + 0.15, 2.65, -0.8] }, cursor: 'examine', label: 'A hunting scene', onActivate: cap('The Painting', 'A moonlit hunt. The hounds are painted with great care. The quarry has been scraped out of the canvas.') },
      {
        id: 'armchair', nodes: ['hearth', 'back', 'billiards'], box: { min: [1.35, 0.1, -3.4], max: [2.4, 1.0, -2.3] }, cursor: 'ghost', label: 'A leather armchair',
        onActivate: async () => {
          ctx.post.set({ saturation: 0.6, vignette: 0.6 }, 0.6);
          await ctx.say({ text: 'The leather is warm, and holds the shape of someone heavy. A smell of cigars, and very faintly, of formaldehyde.', speaker: 'narrator', speakerName: '' });
          ctx.post.set(ROOM_GRADE, 1.0);
        },
      },
      { id: 'window', nodes: ['chess', 'back'], box: { min: [WIN.xs[0] - WIN.w / 2, WIN.sill, Z0 - 0.4], max: [WIN.xs[0] + WIN.w / 2, WIN.sill + WIN.h, Z0] }, cursor: 'examine', label: 'The window', onActivate: cap('The Window', 'The dead elm scratches at the glass. Down on the lawn the snow is unbroken — but the gate below is standing open.') },
    ];

    // ================================================================ QA hooks
    if (typeof window !== 'undefined') {
      const dbg = (window.__debug ||= {});
      dbg.solvers ||= {}; dbg.states ||= {};
      dbg.solvers.gameroom = async () => {
        const game = window.__game;
        if (game && !game.puzzle && game.room?.mod?.id === 'gameroom' && game.startPuzzle) {
          game.startPuzzle(queens.puzzle);
          await new Promise((r) => setTimeout(r, 50));
        }
        if (game?.puzzle?.def?.id === QUEENS_ID) { queens.puzzle.autoSolve(game.puzzle.pctx); return true; }
        queens.applySolved(); ctx.state.markSolved?.(QUEENS_ID);
        return true;
      };
      dbg.states.gameroom = () => ({ ...queens.state(), isSolved: ctx.state.isSolved(QUEENS_ID) });
      dbg.solve ||= (id) => (dbg.solvers[id] ? dbg.solvers[id]() : Promise.reject(new Error(`no solver for ${id}`)));
      dbg.state ||= (id) => (dbg.states[id] ? dbg.states[id]() : null);
      dbg.gameroom = { queens, click: queens.click, arrange: queens.arrange, reset: queens.reset };
    }

    // review/debug: ?grOff=moon,lamp,area,fire,sconce,hemi disables light groups
    {
      const off = (ctx.params.get('grOff') || '').split(',');
      const kill = (l) => { l.intensity = 0; l.visible = false; };
      if (off.includes('moon')) kill(moon);
      if (off.includes('lamp')) { lampSpots.forEach(kill); lampBase = 0; }
      if (off.includes('fire')) kill(fireLight);
      if (off.includes('sconce')) sconceLights.forEach(kill);
      root.traverse((o) => { if (off.includes('area') && o.isRectAreaLight) kill(o); if (off.includes('hemi') && o.isHemisphereLight) kill(o); });
    }

    // ================================================================ shadows + merge
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const fxLike = o.isPoints || m?.isShaderMaterial || m?.isMeshBasicMaterial || (m?.transparent && (m.opacity ?? 1) < 0.6) || o.userData.noBake;
      o.castShadow = !o.userData.noShadow && !fxLike && !['floor', 'rug', 'cloth'].includes(o.name);
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });
    root.userData.mergedCount = mergeStatic(root);

    const godRays = WIN.xs.map((wx) => ({ position: V3(wx + 0.3, WIN.sill + 1.4, Z0 - 1.8), color: new THREE.Color(0.72, 0.8, 1.0), strength: 0.7, radius: 0.18 }));

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'main',
      grade: ROOM_GRADE,
      environment: { position: [-0.6, 1.9, 1.6], intensity: 0.6 },
      onEnter() {
        if (!ctx.state.has('gameroom.greeted')) {
          ctx.state.set('gameroom.greeted', true);
          setTimeout(() => ctx.say({ text: 'Care for a game? I *insist*. Everyone who comes here ends up playing... *eventually*.', speaker: 'stauf', speakerName: 'Stauf' }), 1500);
        }
      },
      update() {},
      dispose() { const d = window.__debug; if (d) { delete d.gameroom; if (d.solvers) delete d.solvers.gameroom; if (d.states) delete d.states.gameroom; } },
    };
  },
};

/** bevelled rectangular top slab (XZ, y up) */
function slabTop(G, w, d, t = 0.04) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); s.lineTo(-w / 2, -d / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: t - 0.016, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2); g.translate(0, 0.008 - t / 2, 0);
  return G.applyBoxUVs(g, 1);
}
