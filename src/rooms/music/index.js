import * as THREE from 'three';
import { mergeStatic } from '../../engine/lib/contrib/foyer-merge.js';
import { nightLawnTexture, wallpaperTexture, portraitTexture } from './textures.js';
import { buildPiano, KEY } from './piano.js';
import { buildHarp, buildCello, buildMusicStand, buildBench } from './instruments.js';
import { buildFireplace, buildTorchere, buildCabinet, buildChair, buildGasolier, buildSconce, buildGramophone } from './furniture.js';
import { buildGhostPianist } from './ghost.js';
import { createPianoPuzzle, meta as pianoMeta, PUZZLE_ID, PHRASE } from './puzzlePiano.js';
import { pianoNote, harpNote, celloNote } from './synth.js';

/**
 * The Music Room — behind the foyer's north doors. A tall blue room with a bay
 * of three moonlit windows, a black concert grand with its lid raised, a gilt
 * harp and a cello by the windows, a marble chimneypiece with a live fire.
 * A dead pianist still sits at the keys: play his nocturne back to him.
 */

const W = 8, D = 9, H = 4.4;
const X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
const DADO = 0.95;
const WIN = { xs: [-2.35, 0, 2.35], w: 1.3, sill: 0.98, h: 2.78, depth: 0.42 };
const DOOR = { x: 0, w: 1.7, h: 2.9 };
const CROWN = 0.3, FRIEZE = 0.22;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const PIANO_POS = V3(-0.95, 0, -1.2), PIANO_ROT = -0.93;
const FIRE = { z: -0.2 };
const GHOST_IDLE = 0.55;

export default {
  id: 'music',
  title: 'The Music Room',
  floorName: 'Ground Floor',
  map: { floor: 'ground', rect: [395, 45, 210, 175] },
  start: 'main',
  ambience: { wind: 0.5, creaks: 0.35, clock: 0.15, thunder: 0.25, rain: 0, heartbeat: 0, roomTone: 0.3 },
  music: false,  // the piano is the music here
  puzzles: [pianoMeta],

  async build(ctx) {
    const { materials: M, geometry: G, fx } = ctx;
    const root = new THREE.Group();
    root.name = 'music';
    const add = (o) => { root.add(o); return o; };
    const hq = ctx.quality.textureSize >= 2048;

    // ================================================================ materials
    const wpSet = wallpaperTexture(ctx.textures).withRepeat(1 / 0.42, 1 / 0.42);
    const wallpaper = new THREE.MeshPhysicalMaterial({ map: wpSet.map, normalMap: wpSet.normalMap, roughnessMap: wpSet.roughnessMap, metalnessMap: wpSet.metalnessMap, roughness: 1, metalness: 1, normalScale: new THREE.Vector2(1.2, 1.2), sheen: 0.7, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.32, 0.4, 0.75), envMapIntensity: 0.6 });
    const parquet = M.create('parquet', { species: 'walnut', ratio: 5, planksAcross: 2, repeat: [0.9, 0.9], polish: 0.7, wear: 0.35 });
    const ebony = M.create('ebony', { repeat: [2, 2], color: [0.55, 0.55, 0.6], clearcoat: 1.0, clearcoatRoughness: 0.06, roughness: 0.6 });
    const mahogany = M.create('mahogany', { repeat: [1.2, 1.2] });
    const panelWood = M.create('wood', { species: 'mahogany', boards: 0, polish: 0.75, repeat: [1.2, 1.2], clearcoat: 0.5, clearcoatRoughness: 0.25, color: [0.55, 0.4, 0.36] });
    const celloWood = M.create('wood', { species: 'mahogany', boards: 0, polish: 0.9, figure: 0.8, repeat: [1, 1], clearcoat: 0.9, clearcoatRoughness: 0.12, color: [1.15, 0.8, 0.55] });
    const harpWood = M.create('walnut', { repeat: [2, 2], color: [1.0, 0.85, 0.7] });
    const plaster = M.create('plaster', { color: [0.3, 0.33, 0.42], cracks: 0.3, stains: 0.4, repeat: [0.45, 0.45] });
    const ceilPlaster = M.create('plaster', { color: [0.2, 0.25, 0.44], cracks: 0.25, stains: 0.5, repeat: [0.45, 0.45] });
    const ribPlaster = M.create('plaster', { color: [0.52, 0.5, 0.48], cracks: 0.2, stains: 0.6, repeat: [1.5, 1.5] });
    const crownGilt = M.create('gilded', { pattern: 0, repeats: 4, wear: 0.4, dirt: 0.55, repeat: [1 / 0.5, 1] });
    const frieze = M.create('gilded', { pattern: 6, repeats: 3, ground: 1, groundColor: [0.03, 0.04, 0.1], wear: 0.3, dirt: 0.5, repeat: [1 / 0.75, 1] });
    const giltFrame = M.create('gilded', { pattern: 1, repeats: 3, wear: 0.5, dirt: 0.7, repeat: [1 / 0.45, 1] });
    const giltFluted = M.create('gilded', { pattern: 5, repeats: 2, wear: 0.4, dirt: 0.5, repeat: [1 / 0.3, 1] });
    const giltPlain = M.create('gold', { wear: 0.5, dirt: 0.5, repeat: [2, 1] });
    const plateGold = new THREE.MeshPhysicalMaterial({ color: 0xb8892e, metalness: 0.8, roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.3 });
    const doorWoodV = M.create('wood', { species: 'mahogany', boards: 0, polish: 0.85, figure: 0.6, wear: 0.15, repeat: [0.9, 0.9], rotation: Math.PI / 2, clearcoat: 0.5, clearcoatRoughness: 0.35, envMapIntensity: 0.45, color: [1.0, 0.78, 0.66] });
    const doorWoodH = M.create('wood', { species: 'mahogany', boards: 0, polish: 0.85, figure: 0.6, wear: 0.15, repeat: [0.9, 0.9], clearcoat: 0.5, clearcoatRoughness: 0.35, envMapIntensity: 0.45, color: [1.0, 0.78, 0.66] });
    const velvet = M.create('velvet', { color: [0.05, 0.07, 0.22], crush: 0.55, repeat: [2, 2], side: THREE.DoubleSide });
    const seatVelvet = M.create('velvet', { color: [0.3, 0.04, 0.06], crush: 0.4, repeat: [3, 3] });
    const brass = M.create('brass', { tarnish: 0.35, polish: 0.7, repeat: [2, 2] });
    const glassMat = M.create('glass', { dirt: 0.5, transparent: true, opacity: 0.12 });
    const marble = M.create('marble', { type: 'nero', polish: 0.8, repeat: [1.2, 1.2] });
    const iron = M.basic('iron', { color: 0x060505, roughness: 0.9, metalness: 0.6 });
    const crystal = M.basic('crystal');
    const rugMat = M.create('rug', { palette: 'kashan', aspect: 4.0 / 5.4, knots: 300, wear: 0.4, fringe: 0.03, seed: 7, size: hq ? 2048 : 1536 });
    const bookMats = [0, 1, 2].map((i) => M.create('books', { count: 34, seed: 30 + i, fill: 0.92, repeat: [1, 1] }));

    // ================================================================ shell
    const floor = new THREE.Mesh(G.planeUV(W, D, 1), parquet);
    floor.name = 'floor';
    floor.rotation.x = -Math.PI / 2;
    add(floor);
    const ceil = new THREE.Mesh(G.planeUV(W, D, 1), ceilPlaster);
    ceil.name = 'ceiling';
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H;
    add(ceil);

    const upperH = H - DADO;
    const winOpenings = WIN.xs.map((x) => ({ x: x - X0 - WIN.w / 2, y: WIN.sill - DADO, w: WIN.w, h: WIN.h, arch: true }));
    const back = new THREE.Mesh(G.wallWithOpenings(W, upperH, winOpenings, { uvScale: 1 }), wallpaper);
    back.position.set(X0, DADO, Z0); add(back);
    const left = new THREE.Mesh(G.planeUV(D, upperH, 1), wallpaper);
    left.rotation.y = Math.PI / 2; left.position.set(X0, DADO + upperH / 2, 0); add(left);
    const right = new THREE.Mesh(G.planeUV(D, upperH, 1), wallpaper);
    right.rotation.y = -Math.PI / 2; right.position.set(X1, DADO + upperH / 2, 0); add(right);
    const front = new THREE.Mesh(G.wallWithOpenings(W, upperH, [{ x: W / 2 + DOOR.x - DOOR.w / 2, y: -1, w: DOOR.w, h: DOOR.h - DADO + 1 }], { uvScale: 1 }), wallpaper);
    front.rotation.y = Math.PI; front.position.set(X1, DADO, Z1); add(front);

    // window reveals, sills, sashes, glass
    const skyTex = nightLawnTexture(ctx.textures);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex.map, color: new THREE.Color(1, 1, 1).multiplyScalar(3.2), toneMapped: false });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), skyMat);
    sky.position.set(-0.5, 2.6, Z0 - 4.5);
    sky.userData.noBake = false;
    add(sky);
    const sashMat = M.basic('black', { color: 0x0e0b0a, roughness: 0.5 });
    for (const wx of WIN.xs) {
      const r = WIN.w / 2;
      const shape = new THREE.Shape();
      shape.moveTo(-r - 0.03, -0.02); shape.lineTo(r + 0.03, -0.02); shape.lineTo(r + 0.03, WIN.h + 0.05); shape.lineTo(-r - 0.03, WIN.h + 0.05); shape.closePath();
      const hole = new THREE.Path();
      hole.moveTo(-r, 0); hole.lineTo(-r, WIN.h - r); hole.absarc(0, WIN.h - r, r, Math.PI, 0, true); hole.lineTo(r, 0); hole.closePath();
      shape.holes.push(hole);
      const reveal = new THREE.Mesh(G.applyBoxUVs(new THREE.ExtrudeGeometry(shape, { depth: WIN.depth, bevelEnabled: false, curveSegments: 32 }), 1), plaster);
      reveal.position.set(wx, WIN.sill, Z0 - WIN.depth); add(reveal);
      // architrave around the opening (swept moulding)
      const archPath = [];
      archPath.push(V3(wx + r + 0.02, WIN.sill - 0.02, Z0));
      for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI; archPath.push(V3(wx + Math.cos(a) * (r + 0.02), WIN.sill + WIN.h - r + Math.sin(a) * (r + 0.02), Z0)); }
      archPath.push(V3(wx - r - 0.02, WIN.sill - 0.02, Z0));
      const archi = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.12, 0.04), archPath, { up: V3(0, 0, 1), uvScale: 1, flipOutward: true }), panelWood);
      add(archi);
      const keystone = new THREE.Mesh(new G.RoundedBoxGeometry(0.16, 0.24, 0.07, 2, 0.01), giltPlain);
      keystone.position.set(wx, WIN.sill + WIN.h + 0.06, Z0 + 0.04); add(keystone);
      const sill = new THREE.Mesh(new G.RoundedBoxGeometry(WIN.w + 0.32, 0.05, WIN.depth + 0.14, 2, 0.01), marble);
      sill.position.set(wx, WIN.sill - 0.025, Z0 - WIN.depth / 2 + 0.07); add(sill);
      // sash frame
      const win = new THREE.Group();
      win.position.set(wx, WIN.sill, Z0 - WIN.depth * 0.6);
      const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), sashMat); m.position.set(x, y, 0); win.add(m); };
      bar(WIN.w, 0.07, 0, 0.035);
      bar(0.045, WIN.h - r, 0, (WIN.h - r) / 2);
      for (const y of [0.7, 1.4, 1.48, 2.1 - 0.0]) bar(WIN.w, y === 1.48 ? 0.06 : 0.035, 0, y);
      bar(0.06, WIN.h - r, -r + 0.03, (WIN.h - r) / 2);
      bar(0.06, WIN.h - r, r - 0.03, (WIN.h - r) / 2);
      for (let i = 1; i < 4; i++) {
        const a = Math.PI * (i / 4);
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, r, 0.04), sashMat);
        m.position.set(Math.cos(a) * r * 0.5, WIN.h - r + Math.sin(a) * r * 0.5, 0); m.rotation.z = a - Math.PI / 2; win.add(m);
      }
      const arc = new THREE.Mesh(new THREE.TorusGeometry(r - 0.03, 0.03, 6, 32, Math.PI), sashMat);
      arc.position.set(0, WIN.h - r, 0); win.add(arc);
      const arc2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.45, 0.02, 6, 24, Math.PI), sashMat);
      arc2.position.set(0, WIN.h - r, 0); win.add(arc2);
      const gs = new THREE.Shape();
      gs.moveTo(-r, 0); gs.lineTo(-r, WIN.h - r); gs.absarc(0, WIN.h - r, r, Math.PI, 0, true); gs.lineTo(r, 0); gs.closePath();
      const glass = new THREE.Mesh(new THREE.ShapeGeometry(gs, 32), glassMat);
      glass.position.z = 0.012; glass.userData.noShadow = true; win.add(glass);
      add(win);
    }

    // ================================================================ mouldings
    const loop = (y) => [V3(X0, y, Z0), V3(X1, y, Z0), V3(X1, y, Z1), V3(X0, y, Z1)];
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(CROWN, 0.22), loop(H - CROWN), { closed: true, uvScale: 1 }), crownGilt));
    add(new THREE.Mesh(G.sweepProfile([new THREE.Vector2(0.006, 0), new THREE.Vector2(0.006, FRIEZE)], loop(H - CROWN - FRIEZE), { closed: true, uvScale: 1 }), frieze));
    add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.04, 0.025), loop(H - CROWN - FRIEZE - 0.04), { closed: true, uvScale: 2 }), giltPlain));
    // ceiling: sunken panel outlined with a gilt bead, and a rose
    {
      const inset = 0.75, y = H - 0.004;
      const path = [V3(X0 + inset, y, Z0 + inset), V3(X1 - inset, y, Z0 + inset), V3(X1 - inset, y, Z1 - inset), V3(X0 + inset, y, Z1 - inset)];
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.07, 0.035).map((p) => new THREE.Vector2(p.x, p.y)), path, { closed: true, up: V3(0, -1, 0), uvScale: 2 }), giltPlain));
      const rose = new THREE.Mesh(G.latheFromProfile([[0.0, 0], [0.55, 0], [0.55, -0.02], [0.48, -0.035], [0.4, -0.03], [0.3, -0.06], [0.16, -0.07], [0.07, -0.1], [0.0, -0.11]], 48), giltPlain);
      rose.position.set(-0.5, H, -0.6); add(rose);
      // coffered field: moulded ribs dividing the sunk panel into a 3 x 4 grid, gilt fillets, bosses
      const ribH = 0.1, ribW = 0.14;
      const xa = X0 + inset, xb = X1 - inset, za = Z0 + inset, zb = Z1 - inset;
      const ribs = [];
      for (let i = 1; i < 3; i++) ribs.push(['x', xa + (xb - xa) * (i / 3)]);
      for (let j = 1; j < 4; j++) ribs.push(['z', za + (zb - za) * (j / 4)]);
      for (const [axis, v] of ribs) {
        const len = axis === 'x' ? zb - za : xb - xa;
        const r = new THREE.Mesh(G.boxUV(axis === 'x' ? ribW : len, ribH, axis === 'x' ? len : ribW, 1), ribPlaster);
        r.position.set(axis === 'x' ? v : (xa + xb) / 2, H - ribH / 2, axis === 'x' ? (za + zb) / 2 : v); add(r);
        for (const sgn of [-1, 1]) {
          const f = new THREE.Mesh(G.boxUV(axis === 'x' ? 0.014 : len, 0.014, axis === 'x' ? len : 0.014, 2), giltPlain);
          f.position.set(axis === 'x' ? v + sgn * (ribW / 2 + 0.004) : (xa + xb) / 2, H - 0.012, axis === 'x' ? (za + zb) / 2 : v + sgn * (ribW / 2 + 0.004)); add(f);
        }
      }
      const boss = G.latheFromProfile([[0, 0], [0.09, 0], [0.085, -0.02], [0.05, -0.04], [0.02, -0.06], [0, -0.065]], 20);
      for (let i = 1; i < 3; i++) for (let j = 1; j < 4; j++) {
        const x = xa + (xb - xa) * (i / 3), z = za + (zb - za) * (j / 4);
        if (Math.hypot(x + 0.5, z + 0.6) < 0.7) continue;
        const b = new THREE.Mesh(boss, giltPlain); b.position.set(x, H - ribH, z); add(b);
      }
      // a frame of egg-and-dart around the sunk field
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.12, 0.1), [V3(xa, H - 0.12, za), V3(xb, H - 0.12, za), V3(xb, H - 0.12, zb), V3(xa, H - 0.12, zb)], { closed: true, uvScale: 1 }), crownGilt));
    }
    // chair rail + skirting, open at the door
    const dl = DOOR.x - DOOR.w / 2 - 0.16, dr = DOOR.x + DOOR.w / 2 + 0.16;
    const fA = FIRE.z + 0.86, fB = FIRE.z - 0.86;   // the chimneypiece interrupts the left-wall rails
    const chairPaths = [
      [V3(dl, DADO - 0.05, Z1), V3(X0, DADO - 0.05, Z1), V3(X0, DADO - 0.05, fA)],
      [V3(X0, DADO - 0.05, fB), V3(X0, DADO - 0.05, Z0), V3(X1, DADO - 0.05, Z0), V3(X1, DADO - 0.05, Z1), V3(dr, DADO - 0.05, Z1)],
    ];
    for (const cp of chairPaths) {
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.08, 0.04), cp, { uvScale: 1 }), panelWood));
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.baseboard(0.24, 0.03), cp.map((p) => V3(p.x, 0, p.z)), { uvScale: 1 }), panelWood));
    }
    // wainscot with raised panels
    {
      const panelGeo = G.raisedPanel(0.62, 0.56, { border: 0.07, bevel: 0.03 });
      const run = (x0, x1, z, rotY, skip = []) => {
        const len = Math.abs(x1 - x0);
        const mid = (x0 + x1) / 2;
        const pos = rotY === 0 || Math.abs(rotY) === Math.PI ? V3(mid, (DADO - 0.05) / 2, z) : V3(z, (DADO - 0.05) / 2, mid);
        const b = new THREE.Mesh(G.boxUV(len, DADO - 0.05, 0.02, 1), panelWood);
        b.position.copy(pos); b.rotation.y = rotY; add(b);
        const n = Math.max(1, Math.round(len / 0.78));
        for (let i = 0; i < n; i++) {
          const off = -len / 2 + (len / n) * (i + 0.5);
          if (skip.some(([a, c]) => off + mid > a && off + mid < c)) continue;
          const p = new THREE.Mesh(panelGeo, panelWood);
          const local = V3(off, 0.5 - (DADO - 0.05) / 2, 0.01).applyAxisAngle(V3(0, 1, 0), rotY);
          p.position.copy(pos).add(local); p.rotation.y = rotY;
          p.scale.set((len / n - 0.12) / 0.62, 1, 1);
          add(p);
        }
      };
      run(X0, X1, Z0 + 0.01, 0);
      run(Z0, fB, X0 + 0.01, Math.PI / 2);
      run(fA, Z1, X0 + 0.01, Math.PI / 2);
      run(Z0, Z1, X1 - 0.01, -Math.PI / 2);
      // front wall (two runs beside the door)
      const fb = (xa, xb) => { const b = new THREE.Mesh(G.boxUV(xb - xa, DADO - 0.05, 0.02, 1), panelWood); b.position.set((xa + xb) / 2, (DADO - 0.05) / 2, Z1 - 0.01); add(b); };
      fb(X0, dl); fb(dr, X1);
    }
    // pilasters between the windows: fluted gilt shafts on a panelled base
    for (const px of [-3.55, -1.175, 1.175, 3.55]) {
      const shaftH = H - CROWN - FRIEZE - DADO - 0.2;
      const shaft = new THREE.Mesh(G.boxUV(0.26, shaftH, 0.06, 1), panelWood);
      shaft.position.set(px, DADO + 0.1 + shaftH / 2, Z0 + 0.03); add(shaft);
      const sp = new THREE.Mesh(G.raisedPanel(0.18, shaftH - 0.16, { border: 0.03, bevel: 0.015, fieldDepth: 0.008 }), panelWood);
      sp.position.set(px, DADO + 0.1 + shaftH / 2, Z0 + 0.06); add(sp);
      const bead = new THREE.Mesh(G.frameGeometry(0.15, shaftH - 0.2, { width: 0.008, depth: 0.008, uvScale: 2 }), giltPlain);
      bead.position.set(px, DADO + 0.1 + shaftH / 2, Z0 + 0.075); add(bead);
      const back2 = new THREE.Mesh(G.boxUV(0.34, shaftH + 0.1, 0.03, 1), panelWood);
      back2.position.set(px, DADO + 0.05 + shaftH / 2, Z0 + 0.015); add(back2);
      const cap = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.14, 0.06), [V3(px - 0.2, H - CROWN - FRIEZE - 0.14, Z0), V3(px - 0.2, H - CROWN - FRIEZE - 0.14, Z0 + 0.06), V3(px + 0.2, H - CROWN - FRIEZE - 0.14, Z0 + 0.06), V3(px + 0.2, H - CROWN - FRIEZE - 0.14, Z0)], { uvScale: 1 }), giltPlain);
      add(cap);
      const base = new THREE.Mesh(new G.RoundedBoxGeometry(0.38, 0.14, 0.09, 2, 0.01), panelWood);
      base.position.set(px, DADO + 0.04, Z0 + 0.045); add(base);
    }

    // ================================================================ door (front wall)
    // a pair of six-panel mahogany doors: real stiles and rails (grain running along
    // each member), sunk fielded panels inside bolection mouldings with a gilt bead,
    // brass butt hinges, an escutcheon with lever handles, a meeting astragal.
    {
      const door = new THREE.Group();
      const lw = DOOR.w / 2 - 0.006, T = 0.055, st = 0.13;
      for (const s of [-1, 1]) {
        const leaf = new THREE.Group();
        leaf.position.set(s * (lw / 2 + 0.003), 0, 0);
        const box = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(G.boxUV(w, h, d, 1), mat); m.position.set(x, y, z); leaf.add(m); return m; };
        box(st, DOOR.h, T, -lw / 2 + st / 2, DOOR.h / 2, 0, doorWoodV);
        box(st, DOOR.h, T, lw / 2 - st / 2, DOOR.h / 2, 0, doorWoodV);
        const iw = lw - 2 * st;
        const rails = [[0.13, 0.26], [1.02, 0.2], [1.9, 0.14], [DOOR.h - 0.08, 0.16]];
        for (const [y, h] of rails) box(iw, h, T, 0, y, 0, doorWoodH);
        // panel backing (sunk below the frame face)
        box(iw, DOOR.h - 0.1, 0.02, 0, DOOR.h / 2, -0.012, doorWoodV);
        const panels = [[0.26, 0.89], [1.12, 1.83], [1.97, DOOR.h - 0.16]];
        for (const [y0, y1] of panels) {
          const ph = y1 - y0, cy = (y0 + y1) / 2;
          const p = new THREE.Mesh(G.raisedPanel(iw - 0.02, ph - 0.02, { border: 0.08, bevel: 0.045, fieldDepth: 0.016 }), doorWoodV);
          p.position.set(0, cy, -0.006); leaf.add(p);
          const bol = new THREE.Mesh(G.frameGeometry(iw - 0.01, ph - 0.01, { width: 0.05, depth: 0.034, uvScale: 1 }), doorWoodH);
          bol.position.set(0, cy, T / 2 - 0.012); leaf.add(bol);
          const bead = new THREE.Mesh(G.frameGeometry(iw - 0.1, ph - 0.1, { width: 0.009, depth: 0.012, uvScale: 2 }), giltPlain);
          bead.position.set(0, cy, T / 2 - 0.004); leaf.add(bead);
        }
        // hinges on the outer edge
        for (const y of [0.32, 1.45, 2.6]) {
          const kn = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0], [0.012, 0.14], [0.008, 0.15], [0.0, 0.16]], 14), brass);
          kn.position.set(s * (lw / 2 + 0.004) * 1 - s * lw / 2 + s * lw / 2, y - 0.08, T / 2 + 0.004); kn.position.x = s * lw / 2; leaf.add(kn);
          const fin1 = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.012, 0], [0.006, 0.012], [0, 0.016]], 12), brass);
          fin1.position.set(s * lw / 2, y + 0.08, T / 2 + 0.004); leaf.add(fin1);
        }
        // meeting edge: escutcheon plate, lever handle, keyhole
        const ex = -s * (lw / 2 - 0.065);
        const plate = new THREE.Mesh(new G.RoundedBoxGeometry(0.055, 0.24, 0.008, 2, 0.004), brass);
        plate.position.set(ex, 1.02, T / 2 + 0.004); leaf.add(plate);
        const rose = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.022, 0], [0.018, 0.01], [0.01, 0.016], [0, 0.018]], 16), brass);
        rose.rotation.x = Math.PI / 2; rose.position.set(ex, 1.07, T / 2 + 0.008); leaf.add(rose);
        const lever = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(ex, 1.07, T / 2 + 0.02), V3(ex, 1.07, T / 2 + 0.055), V3(ex + s * 0.05, 1.065, T / 2 + 0.065), V3(ex + s * 0.11, 1.055, T / 2 + 0.06)]), 16, 0.0065, 8), brass);
        leaf.add(lever);
        const kh = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12), M.basic('black'));
        kh.position.set(ex, 0.97, T / 2 + 0.0085); leaf.add(kh);
        const kh2 = new THREE.Mesh(new THREE.PlaneGeometry(0.005, 0.016), M.basic('black'));
        kh2.position.set(ex, 0.96, T / 2 + 0.0085); leaf.add(kh2);
        door.add(leaf);
      }
      const astragal = new THREE.Mesh(new G.RoundedBoxGeometry(0.03, DOOR.h - 0.02, 0.02, 2, 0.008), doorWoodV);
      astragal.position.set(0, DOOR.h / 2, T / 2 + 0.006); door.add(astragal);
      const casing = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.16, 0.05), [
        V3(-DOOR.w / 2 - 0.08, 0, 0), V3(-DOOR.w / 2 - 0.08, DOOR.h + 0.08, 0), V3(DOOR.w / 2 + 0.08, DOOR.h + 0.08, 0), V3(DOOR.w / 2 + 0.08, 0, 0),
      ], { up: V3(0, 0, 1), uvScale: 1, flipOutward: true }), doorWoodV);
      door.add(casing);
      for (const sx of [-1, 1]) {
        const plinth = new THREE.Mesh(new G.RoundedBoxGeometry(0.2, 0.3, 0.07, 2, 0.008), doorWoodV);
        plinth.position.set(sx * (DOOR.w / 2 + 0.08), 0.15, 0.02); door.add(plinth);
      }
      // reveal (jamb lining) so the opening has depth
      for (const sx of [-1, 1]) { const j = new THREE.Mesh(G.boxUV(0.03, DOOR.h, 0.2, 1), doorWoodV); j.position.set(sx * (DOOR.w / 2 + 0.015), DOOR.h / 2, -0.08); door.add(j); }
      const pediment = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.2, 0.12), [V3(-DOOR.w / 2 - 0.3, DOOR.h + 0.22, -0.12), V3(-DOOR.w / 2 - 0.3, DOOR.h + 0.22, 0.0), V3(DOOR.w / 2 + 0.3, DOOR.h + 0.22, 0.0), V3(DOOR.w / 2 + 0.3, DOOR.h + 0.22, -0.12)], { uvScale: 1 }), crownGilt);
      door.add(pediment);
      const lintel = new THREE.Mesh(G.boxUV(DOOR.w + 0.5, 0.22, 0.05, 1), doorWoodH);
      lintel.position.set(0, DOOR.h + 0.21, -0.02); door.add(lintel);
      const frz = new THREE.Mesh(G.boxUV(DOOR.w + 0.3, 0.14, 0.012, 1), frieze);
      frz.position.set(0, DOOR.h + 0.2, 0.01); door.add(frz);
      door.position.set(DOOR.x, 0, Z1 - 0.03);
      door.rotation.y = Math.PI;
      door.name = 'door';
      add(door);
    }

    // ================================================================ curtains
    // (engine curtainGeometry can emit NaN on the heading row when y rounds above 0: patch it here)
    const curtain = (o) => {
      const g = G.curtainGeometry(o);
      const a = g.attributes.position.array;
      let bad = false;
      for (let i = 0; i < a.length; i++) if (Number.isNaN(a[i])) { a[i] = 0; bad = true; }
      if (bad) g.computeVertexNormals();
      return g;
    };
    for (const wx of WIN.xs) {
      for (const side of [-1, 1]) {
        const c = new THREE.Mesh(curtain({ width: 0.62, height: 3.3, folds: 7, depth: 0.08, tieback: 0, pool: 0.1, seed: wx * 3 + side + 5, segX: 90, segY: 56 }), velvet);
        c.position.set(wx + side * (WIN.w / 2 + 0.02), WIN.sill + WIN.h + 0.28, Z0 + 0.13);
        if (side > 0) c.scale.x = -1;
        c.name = 'curtain';
        add(c);
        const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20), giltPlain);
        tie.position.set(wx + side * (WIN.w / 2 + 0.36), 1.25, Z0 + 0.06); add(tie);
      }
      const val = new THREE.Mesh(curtain({ width: WIN.w + 0.9, height: 0.4, folds: 12, depth: 0.05, gather: 1, seed: wx + 9, segX: 110, segY: 10 }), velvet);
      val.position.set(wx, WIN.sill + WIN.h + 0.36, Z0 + 0.17); val.name = 'curtain'; add(val);
      const pelmet = new THREE.Mesh(G.boxUV(WIN.w + 1.0, 0.12, 0.2, 1), giltFrame);
      pelmet.position.set(wx, WIN.sill + WIN.h + 0.42, Z0 + 0.1); add(pelmet);
    }

    // ================================================================ rug
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 5.4), rugMat);
    rug.name = 'rug';
    rug.rotation.x = -Math.PI / 2; rug.rotation.z = 0.0; rug.position.set(-0.2, 0.0135, -0.5);
    add(rug);
    {
      // pile thickness: a bound edge under the rug face, and knotted wool fringe at both ends
      const bind = new THREE.Mesh(new G.RoundedBoxGeometry(4.02, 0.013, 5.42, 2, 0.005), new THREE.MeshPhysicalMaterial({ color: 0x2a0d0c, roughness: 0.95, sheen: 0.6, sheenColor: new THREE.Color(0.5, 0.3, 0.25) }));
      bind.position.set(-0.2, 0.0065, -0.5); bind.name = 'rug'; add(bind);
      const tGeo = new THREE.CylinderGeometry(0.0022, 0.0016, 0.075, 4); tGeo.rotateX(Math.PI / 2); tGeo.translate(0, 0, 0.0375);
      const NT = 150;
      const fringe = new THREE.InstancedMesh(tGeo, new THREE.MeshStandardMaterial({ color: 0xcfc2a2, roughness: 0.95 }), NT * 2);
      const fr = ctx.random.fork('fringe');
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      let k = 0;
      for (const end of [-1, 1]) for (let i = 0; i < NT; i++) {
        const x = -0.2 - 1.98 + (i + 0.5) * (3.96 / NT) + (fr.next() - 0.5) * 0.008;
        const z = -0.5 + end * 2.71;
        e.set(0, (end > 0 ? 0 : Math.PI) + (fr.next() - 0.5) * 0.5, 0);
        q.setFromEuler(e);
        const L = 0.75 + fr.next() * 0.45;
        m4.compose(V3(x, 0.004, z), q, V3(1, 1, L));
        fringe.setMatrixAt(k++, m4);
      }
      fringe.castShadow = false; fringe.receiveShadow = true;
      add(fringe);
    }

    // ================================================================ the grand piano + bench + ghost
    const piano = buildPiano(ctx, { ebony, brass, gold: plateGold });
    piano.position.copy(PIANO_POS);
    piano.rotation.y = PIANO_ROT;
    add(piano);
    const keys = piano.userData.keys;
    const bench = buildBench(ctx, { ebony, velvet: seatVelvet });
    bench.position.set(0, 0, 0.58);
    piano.add(bench);
    const ghost = await buildGhostPianist(ctx);
    piano.add(ghost.group);
    ghost.group.userData.dynamic = true;
    keys.white.parent.updateMatrixWorld(true);
    const pianoToWorld = (x, y, z) => { piano.updateMatrixWorld(true); return piano.localToWorld(V3(x, y, z)); };

    // floor candelabrum beside the keyboard (the room's one shadowed warm light)
    const torch = buildTorchere(ctx, { brass });
    const torchPos = pianoToWorld(1.05, 0, -1.25);
    torch.position.copy(torchPos);
    add(torch);
    const torchLight = new THREE.PointLight(0xffa04e, 7.0, 10, 2);
    torchLight.position.set(torchPos.x, 1.72, torchPos.z);
    torchLight.castShadow = ctx.quality.shadows;
    torchLight.shadow.mapSize.set(1024, 1024);
    torchLight.shadow.bias = -0.003; torchLight.shadow.normalBias = 0.03; torchLight.shadow.radius = 5;
    torchLight.shadow.camera.near = 0.25;
    torchLight.shadow.camera.far = 7;
    add(torchLight);

    // ================================================================ harp, cello, stand, chair (right side, by the windows)
    const harp = buildHarp(ctx, { gilt: giltFluted, giltPlain, wood: giltPlain, box: harpWood });
    harp.position.set(2.65, 0, -3.2); harp.rotation.y = -0.75;
    harp.userData.dynamic = true;
    add(harp);
    // the right-wall sconce's warm spill finding the gilt of the harp (no shadows: cheap)
    const harpKey = new THREE.SpotLight(0xffb070, 3.2, 6, 0.42, 0.85, 2);
    harpKey.position.set(3.55, 2.3, -1.7);
    harpKey.target.position.set(2.6, 1.0, -3.2);
    add(harpKey); add(harpKey.target);
    const chair = buildChair(ctx, { wood: mahogany, velvet: seatVelvet });
    chair.position.set(2.55, 0, -1.45); chair.rotation.y = -1.9;
    add(chair);
    const cello = buildCello(ctx, { wood: celloWood, ebony, giltPlain });
    cello.position.set(2.95, 0.12, -0.95); cello.rotation.set(-0.0, -2.2, 0.28);
    cello.userData.dynamic = true;
    add(cello);
    const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.72, 6), mahogany);
    bow.position.set(2.62, 0.52, -1.42); bow.rotation.set(Math.PI / 2, 0, 0.4); add(bow);
    const stand = buildMusicStand(ctx, { brass, seed: 12 });
    stand.position.set(2.2, 0, -1.05); stand.rotation.y = 1.5;
    add(stand);

    // ================================================================ fireplace wall (left)
    const fire = buildFireplace(ctx, { marble, iron, brass, gilt: giltPlain });
    fire.position.set(X0, 0, FIRE.z); fire.rotation.y = Math.PI / 2;
    add(fire);
    const fireLight = new THREE.PointLight(0xff7a2a, 3.0, 9, 2);
    fireLight.position.set(X0 + 0.85, 0.5, FIRE.z);
    add(fireLight);
    const fireInner = new THREE.PointLight(0xff6a1c, 0.9, 2.2, 2);
    fireInner.position.set(X0 + 0.16, 0.24, FIRE.z);
    add(fireInner);
    // overmantel: a composer's portrait in a heavy gilt frame
    const portrait = new THREE.Group();
    {
      const pw = 0.95, ph = 1.25;
      let ptex;
      try { ptex = await new THREE.TextureLoader().loadAsync(ctx.assetUrl('portrait.jpg')); ptex.colorSpace = THREE.SRGBColorSpace; ptex.anisotropy = 8; } catch (e) { ptex = portraitTexture(ctx.textures); }
      portrait.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshPhysicalMaterial({ map: ptex, roughness: 0.55, clearcoat: 0.7, clearcoatRoughness: 0.22 })));
      portrait.add(new THREE.Mesh(G.frameGeometry(pw, ph, { width: 0.13, depth: 0.07, uvScale: 1 }), giltFrame));
      portrait.position.set(X0 + 0.04, 2.45, FIRE.z); portrait.rotation.y = Math.PI / 2;
      portrait.userData.dynamic = true;
      add(portrait);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 14, 1, false, 0, Math.PI), brass);
      lamp.rotation.z = Math.PI / 2; lamp.rotation.x = Math.PI / 2; lamp.position.set(X0 + 0.2, 3.24, FIRE.z); add(lamp);
      const lampArm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(X0 + 0.01, 3.2, FIRE.z), V3(X0 + 0.12, 3.28, FIRE.z), V3(X0 + 0.2, 3.25, FIRE.z)]), 10, 0.008, 6), brass);
      add(lampArm);
      const lampGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.8, 0.5).multiplyScalar(3), toneMapped: false }));
      lampGlow.rotation.x = Math.PI / 2; lampGlow.rotation.z = Math.PI / 2; lampGlow.position.set(X0 + 0.2, 3.215, FIRE.z); add(lampGlow);
      const picLight = new THREE.SpotLight(0xffc890, 2.4, 3, 0.75, 0.7, 2);
      picLight.position.set(X0 + 0.22, 3.2, FIRE.z);
      picLight.target.position.set(X0 + 0.02, 2.35, FIRE.z);
      add(picLight); add(picLight.target);
    }
    // mantel garniture: clock + candlesticks
    const mantelY = 1.31;
    {
      const clockBody = new THREE.Mesh(new G.RoundedBoxGeometry(0.3, 0.36, 0.14, 3, 0.03), marble);
      clockBody.position.set(X0 + 0.2, mantelY + 0.18, FIRE.z); add(clockBody);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.08, 32), M.basic('porcelain'));
      face.position.set(X0 + 0.272, mantelY + 0.22, FIRE.z); face.rotation.y = Math.PI / 2; add(face);
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.01, 8, 32), brass);
      bezel.position.set(X0 + 0.274, mantelY + 0.22, FIRE.z); bezel.rotation.y = Math.PI / 2; add(bezel);
      for (const s of [-1, 1]) {
        const stick = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.06, 0], [0.05, 0.02], [0.018, 0.05], [0.014, 0.2], [0.03, 0.22], [0.0, 0.23]], 20), brass);
        stick.position.set(X0 + 0.2, mantelY, FIRE.z + s * 0.62); add(stick);
        const c = fx.candle({ height: 0.2, radius: 0.012, light: false, seed: 60 + s, burn: 0.7 });
        c.position.set(X0 + 0.2, mantelY + 0.225, FIRE.z + s * 0.62); add(c);
        const urn = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.05, 0], [0.04, 0.02], [0.07, 0.08], [0.08, 0.14], [0.05, 0.2], [0.06, 0.22], [0, 0.22]], 20), M.basic('porcelain', { color: 0x1d2a55 }));
        urn.position.set(X0 + 0.2, mantelY, FIRE.z + s * 0.36); add(urn);
      }
    }
    // gas sconces flanking the chimneypiece
    const sconceLights = [];
    for (const s of [-1, 1]) {
      const sc = buildSconce(ctx, { brass });
      sc.position.set(X0 + 0.01, 2.05, FIRE.z + s * 1.35); sc.rotation.y = Math.PI / 2;
      add(sc);
      const pl = new THREE.PointLight(0xffa860, 4.5, 8, 2);
      pl.position.set(X0 + 0.25, 2.18, FIRE.z + s * 1.35);
      add(pl); sconceLights.push(pl);
    }

    // ================================================================ right wall: cabinet, paintings, gramophone
    const cabinet = buildCabinet(ctx, { wood: mahogany, glass: glassMat, brass, books: bookMats, giltPlain });
    cabinet.position.set(X1, 0, 0.9); cabinet.rotation.y = -Math.PI / 2;
    add(cabinet);
    {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.85), M.create('painting', { subject: 2, seed: 8, aspect: 1.3 / 0.85, size: 1024 })));
      g.add(new THREE.Mesh(G.frameGeometry(1.3, 0.85, { width: 0.1, depth: 0.06, uvScale: 1 }), giltFrame));
      g.position.set(X1 - 0.04, 3.0, 0.9); g.rotation.y = -Math.PI / 2; add(g);
      const g2 = new THREE.Group();
      g2.add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), M.create('painting', { subject: 0, seed: 14, aspect: 0.7 / 0.9, size: 1024 })));
      g2.add(new THREE.Mesh(G.frameGeometry(0.7, 0.9, { width: 0.09, depth: 0.05, uvScale: 1 }), giltFrame));
      g2.position.set(X1 - 0.04, 2.15, 3.0); g2.rotation.y = -Math.PI / 2; add(g2);
    }
    const gram = buildGramophone(ctx, { wood: mahogany, brass });
    gram.position.set(3.3, 0, 2.65); gram.rotation.y = -2.2;
    gram.userData.dynamic = true;
    add(gram);
    {
      const sc = buildSconce(ctx, { brass });
      sc.position.set(X1 - 0.01, 2.05, -1.55); sc.rotation.y = -Math.PI / 2; add(sc);
      const pl = new THREE.PointLight(0xffa860, 2.6, 8, 2);
      pl.position.set(X1 - 0.25, 2.18, -1.55); add(pl); sconceLights.push(pl);
    }
    // front wall: gas sconces flanking the doors (they graze the panels and the damask)
    for (const sx of [-1, 1]) {
      const sc = buildSconce(ctx, { brass });
      sc.position.set(sx * 1.32, 2.0, Z1 - 0.01); sc.rotation.y = Math.PI; add(sc);
      const pl = new THREE.PointLight(0xffa860, 2.4, 7, 2);
      pl.position.set(sx * 1.32, 2.13, Z1 - 0.24); add(pl); sconceLights.push(pl);
    }
    // front wall: two small paintings flanking the door + a settee
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.0), M.create('painting', { subject: s < 0 ? 3 : 1, seed: 40 + s, aspect: 0.75, size: 1024 })));
      g.add(new THREE.Mesh(G.frameGeometry(0.75, 1.0, { width: 0.09, depth: 0.05, uvScale: 1 }), giltFrame));
      g.position.set(s * 2.55, 2.2, Z1 - 0.04); g.rotation.y = Math.PI; add(g);
    }
    const chair2 = buildChair(ctx, { wood: mahogany, velvet: seatVelvet });
    chair2.position.set(-2.9, 0, 2.6); chair2.rotation.y = 2.3; add(chair2);

    // gasolier
    const gas = buildGasolier(ctx, { brass, crystal });
    gas.position.set(-0.5, H, -0.6);
    add(gas);
    const gasLight = new THREE.PointLight(0xffb070, 3.2, 12, 2);
    gasLight.position.set(-0.5, gas.userData.lightY + H, -0.6);
    add(gasLight);

    // ================================================================ moonlight
    const moon = new THREE.SpotLight(0xbcc8ec, 650, 26, 0.42, 0.18, 2);
    // high and almost straight behind the bay, so each window lays its own pane pattern
    // into the room: the centre one across the rug in front of the piano
    moon.position.set(5.0, 6.5, Z0 - 7.5);
    moon.target.position.set(0.2, 0, -0.4);
    moon.castShadow = ctx.quality.shadows;
    moon.shadow.mapSize.set(ctx.quality.shadowMapSize, ctx.quality.shadowMapSize);
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.02; moon.shadow.radius = ctx.quality.shadowRadius;
    moon.shadow.camera.near = 2; moon.shadow.camera.far = 20;
    add(moon); add(moon.target);

    add(new THREE.HemisphereLight(0x5068a8, 0x2a1a10, 1.25));
    for (const wx of WIN.xs) add(fx.areaLight({ center: [wx, WIN.sill + 1.3, Z0 + 0.05], normal: [0, -0.35, 1], width: WIN.w, height: WIN.h, color: 0x9aaee0, intensity: 0.3 }));

    const beamDir = new THREE.Vector3().subVectors(moon.target.position, moon.position).normalize();
    const shafts = [];
    for (const wx of WIN.xs) {
      const shaft = fx.shaft({
        center: V3(wx, WIN.sill + WIN.h * 0.47, Z0 - 0.02), right: V3(WIN.w / 2, 0, 0), up: V3(0, WIN.h * 0.5, 0),
        direction: beamDir, length: 4.2, color: 0xaebfee, intensity: 0.42, softness: 0.22, falloff: 1.2, panes: [2, 4], mullion: 0.035, noise: 1.0,
      });
      add(shaft); shafts.push(shaft);
    }
    const dust = add(fx.dust({ box: new THREE.Box3(V3(-3.4, 0.1, Z0 + 0.05), V3(3.4, 3.4, 1.2)), count: 2600, shafts, size: 0.011, intensity: 2.0, ambient: 0.05 }));
    add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.2, 0, Z0 + 0.1), V3(X1 - 0.2, 0.5, Z1 - 0.3)), color: 0x0b111e, litColor: 0x31405e, density: 0.3, heightFalloff: 4 }));

    // ================================================================ puzzle
    let solvedScenePlayed = false;
    const farewell = { pending: false, t0: -1 };
    const solvedScene = async () => {
      // the ghost plays the whole nocturne with its resolution; once the guest stands up,
      // he shows himself one last time, bows, and lets go (see the per-frame farewell)
      const tail = [...PHRASE, 65, 69, 74];
      tail.forEach((m, i) => setTimeout(() => { keys.press(m); keys.flash(m, { ghost: true, dur: 0.9 }); ghost.reachFor(keys.xOf(m)); pianoNote(ctx.audio, m, { velocity: 0.7, ghost: true, length: i === tail.length - 1 ? 5 : 2.8 }); }, i * 330));
      solvedScenePlayed = true;
      farewell.pending = true;
      ctx.state.set('music.nocturne', true);
    };
    const nocturne = createPianoPuzzle({ keys, ghost, desk: piano.userData.desk, onSolvedScene: solvedScene });
    const puzzleCam = (() => {
      const pos = pianoToWorld(0.03, 1.16, 0.5), tgt = pianoToWorld(0.03, 0.829, -0.15);
      return { position: pos.toArray(), target: tgt.toArray(), fov: 52 };
    })();
    // the engine reads `camera` as the puzzle starts (before the camera flight): the ghost
    // gives up his seat right then, so the camera never passes through him
    Object.defineProperty(nocturne.puzzle, 'camera', { enumerable: true, configurable: true, get: () => { ghost.want(0); ghostFade.speed = 1.4; return puzzleCam; } });
    const ghostFade = { target: ctx.state.isSolved(PUZZLE_ID) ? 0 : GHOST_IDLE, speed: 0.6, value: ctx.state.isSolved(PUZZLE_ID) ? 0 : GHOST_IDLE };
    if (ctx.state.isSolved(PUZZLE_ID)) { nocturne.markDone(); ghost.group.visible = false; }
    ghost.setOpacity(ghostFade.value);
    ghost.want = (v, now = false) => { ghostFade.target = v ?? (ctx.state.isSolved(PUZZLE_ID) ? 0 : GHOST_IDLE); if (now) ghostFade.value = ghostFade.target; };

    // ================================================================ navigation
    const nodes = {
      main: { position: [1.75, 1.6, 2.35], target: [-1.75, 1.32, -1.8], fov: 56, label: 'The music room', look: { yaw: [-50, 50], pitch: [-25, 30] } },
      piano: { position: pianoToWorld(2.0, 1.66, 0.25).toArray(), target: pianoToWorld(-0.3, 0.98, -0.05).toArray(), fov: 50, label: 'The piano' },
      harp: { position: [1.05, 1.58, -0.55], target: [3.0, 1.2, -3.25], fov: 54, label: 'The harp and the windows', look: { yaw: [-60, 60], pitch: [-25, 30] } },
      hearth: { position: [0.9, 1.6, 1.4], target: [-4.0, 1.45, 0.45], fov: 54, label: 'The fireplace' },
      door: { position: [0.6, 1.62, 0.9], target: [0.0, 1.45, 5.5], fov: 56, label: 'The doors' },
    };
    const edges = [
      ['main', 'piano', [[1.6, 1.6, 1.5]]],
      ['main', 'harp', [[1.4, 1.6, 1.6]]],
      ['main', 'hearth', [[1.2, 1.6, 2.4]]],
      ['piano', 'harp'],
      ['piano', 'hearth', [[0.9, 1.6, 0.9]]],
      ['harp', 'hearth'],
      ['hearth', 'door'],
      ['main', 'door', [[1.2, 1.62, 2.0]]],
      ['harp', 'door'],
    ];
    const exits = [
      { node: 'door', toRoom: 'foyer', toNode: 'center', label: 'Back to the foyer', hotspot: { box: { min: [-0.9, 0.1, Z1 - 0.2], max: [0.9, 2.9, Z1 + 0.05] } } },
      { node: 'main', toRoom: 'foyer', toNode: 'center', label: 'Back to the foyer', enabled: () => false, hotspot: { box: { min: [-0.9, 0.1, Z1 - 0.2], max: [0.9, 2.9, Z1 + 0.05] } } },
    ].slice(0, 1);

    // keyboard box in world space (for the puzzle hotspot)
    const kbBox = new THREE.Box3();
    for (const [x, y, z] of [[-0.7, 0.66, 0.2], [0.7, 0.66, 0.2], [-0.7, 1.05, -0.2], [0.7, 1.05, -0.2]]) kbBox.expandByPoint(pianoToWorld(x, y, z));
    const ghostCenter = pianoToWorld(0, 1.05, 0.5);

    const say = (text) => ctx.say({ text, speaker: 'stauf', speakerName: 'Stauf' });
    const hotspots = [
      { id: 'keys', nodes: ['piano', 'main'], box: { min: kbBox.min.toArray(), max: kbBox.max.toArray() }, cursor: 'puzzle', label: 'The keyboard', puzzle: nocturne.puzzle, priority: 2 },
      {
        id: 'ghost', nodes: ['main', 'piano', 'harp'], sphere: { center: ghostCenter.toArray(), radius: 0.42 }, cursor: 'ghost', label: 'The pianist',
        enabled: () => !ctx.state.isSolved(PUZZLE_ID), priority: 3,
        onActivate: () => ctx.cinematic(async (c, h) => {
          ctx.post.set({ saturation: 0.7, vignette: 0.6 }, 0.8);
          ghostFade.target = 1.0;
          await ctx.nav.lookAt(pianoToWorld(0, 1.0, 0.2), 1.2);
          const phrase = PHRASE.slice(0, 4);
          for (let i = 0; i < phrase.length; i++) { nocturne.ghostPlay(phrase[i]); await h.wait(0.6); }
          await say('Herr Kessler played this room every night, for a house that never *applauded*. He has been waiting for someone to finish his little piece.');
          await h.wait(0.3);
          ghostFade.target = GHOST_IDLE;
          ctx.post.reset(1.2);
          await ctx.nav.returnToNode(1.0);
        }),
      },
      {
        id: 'harp', nodes: ['harp', 'main'], object: harp, cursor: 'examine', label: 'The harp',
        onActivate: () => {
          [50, 57, 62, 65, 69, 74, 77, 81].forEach((m, i) => harpNote(ctx.audio, m, { when: i * 0.09 }));
          ctx.ui.caption('A gilt pedal harp. The strings are cold, and one of them is still quivering.', { title: 'The Harp' });
        },
      },
      {
        id: 'cello', nodes: ['harp'], object: cello, cursor: 'examine', label: 'The cello',
        onActivate: () => { celloNote(ctx.audio, 38, { length: 2.6 }); ctx.ui.caption('A cello resting against the chair, its bow beside it — as if the player only stepped out.', { title: 'The Cello' }); },
      },
      {
        id: 'portrait', nodes: ['hearth'], object: portrait, cursor: 'talk', label: 'The composer',
        onActivate: () => say('Kessler. A *genius*, he told everyone. He owed me a nocturne. I collected.'),
      },
      {
        id: 'fire', nodes: ['hearth'], box: { min: [X0, 0, FIRE.z - 0.5], max: [X0 + 0.6, 0.9, FIRE.z + 0.5] }, cursor: 'examine', label: 'The fire',
        onActivate: () => ctx.ui.caption('The coals are burning, though nobody has laid a fire in this house for years.', { title: 'The Fire' }),
      },
      {
        id: 'gramophone', nodes: ['door', 'hearth'], object: gram, cursor: 'examine', label: 'The gramophone',
        onActivate: () => { ctx.audio.sfx?.('creak'); ctx.ui.caption('The record is scratched at the same groove, over and over: a woman laughing.', { title: 'The Gramophone' }); },
      },
      {
        id: 'windows', nodes: ['harp'], box: { min: [-3.0, 1.0, Z0 - 0.4], max: [3.0, 3.8, Z0 + 0.05] }, cursor: 'examine', label: 'The windows',
        onActivate: () => ctx.ui.caption('Moonlight on the lawn, and the little temple beyond the hedges. Nothing moves out there. Nothing ever does.', { title: 'The Bay Windows' }),
      },
      {
        id: 'cabinet', nodes: ['door', 'hearth', 'main'], box: { min: [X1 - 0.45, 0.0, 0.15], max: [X1, 2.35, 1.65] }, cursor: 'examine', label: 'The music cabinet',
        onActivate: () => ctx.ui.caption('Bound scores, every one of them by the same hand, every one of them left unfinished at the same bar.', { title: 'The Music Cabinet' }),
      },
    ];

    // ================================================================ per-frame
    ctx.onUpdate((dt, t) => {
      keys.update(dt);
      if (farewell.pending && window.__game?.mode === 'explore') {
        if (farewell.t0 < 0) { farewell.t0 = t; ghostFade.target = 1.0; ghostFade.speed = 1.2; }
        if (t - farewell.t0 > 2.4 && ghostFade.target > 0) {
          ghostFade.target = 0; ghostFade.speed = 0.22;
          say('He finished it at last. How *touching*. I much preferred him unfinished.');
        }
        if (t - farewell.t0 > 9) farewell.pending = false;
      }
      ghostFade.value += (ghostFade.target - ghostFade.value) * Math.min(1, dt * ghostFade.speed * 3);
      ghost.setOpacity(ghostFade.value);
      ghost.group.visible = ghostFade.value > 0.01;
      ghost.update(dt, t, !(window.__game?.mode === 'puzzle' || solvedScenePlayed));
      const fl = 0.8 + 0.2 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.2) + 0.08 * Math.sin(t * 17.0);
      fireLight.intensity = 3.0 * fl;
      fireInner.intensity = 0.9 * (0.75 + 0.25 * Math.sin(t * 11.0 + 1.0) * Math.sin(t * 4.3));
      fire.userData.coalMat.emissiveIntensity = 1.4 + 0.3 * Math.sin(t * 1.3);
      fire.userData.bedMat.emissiveIntensity = 1.6 + 0.3 * Math.sin(t * 0.9 + 0.5);
      fire.userData.logMat.emissiveIntensity = 1.8 + 0.4 * Math.sin(t * 1.7 + 2.0);
      dust.visible = window.__game?.mode !== 'puzzle';
      for (const [i, pl] of sconceLights.entries()) pl.intensity = (i < 2 ? 4.5 : i === 2 ? 2.6 : 2.4) * (0.97 + 0.03 * Math.sin(t * 9.1 + i) * Math.sin(t * 3.7));
      torchLight.intensity = 7.0 * (0.94 + 0.06 * Math.sin(t * 8.3) * Math.sin(t * 2.9 + 0.4));
    });

    // ================================================================ QA hooks
    if (typeof window !== 'undefined') {
      const dbg = (window.__debug ||= {});
      dbg.solvers ||= {}; dbg.states ||= {};
      dbg.solvers.music = async () => {
        const game = window.__game;
        if (game && !game.puzzle && game.room?.mod?.id === 'music' && game.startPuzzle) {
          game.startPuzzle(nocturne.puzzle);
          await new Promise((r) => setTimeout(r, 60));
        }
        if (game?.puzzle?.def?.id === PUZZLE_ID) { nocturne.puzzle.autoSolve(game.puzzle.pctx); return true; }
        nocturne.markDone(); ctx.state.markSolved?.(PUZZLE_ID); ghostFade.target = 0;
        return true;
      };
      dbg.states.music = () => ({ ...nocturne.state(), isSolved: ctx.state.isSolved(PUZZLE_ID), ghostOpacity: +ghostFade.value.toFixed(3), node: ctx.nav.current });
      dbg.solve ||= (id) => (dbg.solvers[id] ? dbg.solvers[id]() : Promise.reject(new Error(`no solver for ${id}`)));
      dbg.state ||= (id) => (dbg.states[id] ? dbg.states[id]() : null);
      dbg.music = { play: (midi) => nocturne.input(midi), phrase: PHRASE, puzzle: nocturne.puzzle, keys };
    }

    // ================================================================ shadows + merge
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const fxLike = o.isPoints || m?.isShaderMaterial || m?.isMeshBasicMaterial || (m?.transparent && (m.opacity ?? 1) < 0.6) || o.userData.noBake || o.userData.noShadow;
      o.castShadow = !fxLike && !['floor', 'ceiling', 'rug', 'curtain'].includes(o.name);
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });
    gas.traverse((o) => { o.castShadow = false; });
    const merged = mergeStatic(root);
    root.userData.merged = merged;

    const godRays = WIN.xs.map((wx) => ({ position: V3(wx, WIN.sill + 1.7, Z0).addScaledVector(beamDir, -2.2), color: new THREE.Color(0.72, 0.8, 1.0), strength: 0.5, radius: 0.18 }));

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'main',
      grade: { exposure: 1.4, contrast: 1.2, saturation: 0.95, shadowTint: [0.8, 0.94, 1.22], highlightTint: [1.16, 1.0, 0.8], splitAmount: 0.7, bloomStrength: 0.4, bloomThreshold: 1.1, godRayWeight: 0.5, godRayThreshold: 2.2, vignette: 0.45, aoIntensity: 1.15, aoRadius: 0.4 },
      environment: { position: [0.8, 1.7, 1.2], intensity: 0.85 },
      onEnter() {
        if (!ctx.state.has('music.greeted')) {
          ctx.state.set('music.greeted', true);
          setTimeout(() => say('Do you play? *He* does. He simply cannot seem to *stop*.'), 1600);
        }
      },
      update() {},
      dispose() { const d = window.__debug; if (d) { delete d.music; if (d.solvers) delete d.solvers.music; if (d.states) delete d.states.music; } },
    };
  },
};
