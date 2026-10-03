import * as THREE from 'three';
import { mergeStatic } from '../../engine/lib/contrib/foyer-merge.js';
import { nightLawnTexture } from './textures.js';
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
    const wallpaper = M.create('damask', { repeat: [1.6, 1.6], base: [0.075, 0.105, 0.27], motif: [0.13, 0.17, 0.4], sheen: 0.65, variant: 1 });
    const parquet = M.create('parquet', { species: 'walnut', ratio: 5, planksAcross: 2, repeat: [0.9, 0.9], polish: 0.7, wear: 0.35 });
    const ebony = M.create('ebony', { repeat: [2, 2], color: [0.55, 0.55, 0.6], clearcoat: 1.0, clearcoatRoughness: 0.06, roughness: 0.6 });
    const mahogany = M.create('mahogany', { repeat: [1.2, 1.2] });
    const panelWood = M.create('wood', { species: 'mahogany', boards: 0, polish: 0.75, repeat: [1.2, 1.2], clearcoat: 0.5, clearcoatRoughness: 0.25, color: [0.75, 0.62, 0.6] });
    const celloWood = M.create('wood', { species: 'mahogany', boards: 0, polish: 0.9, figure: 0.8, repeat: [1, 1], clearcoat: 0.9, clearcoatRoughness: 0.12, color: [1.15, 0.8, 0.55] });
    const harpWood = M.create('walnut', { repeat: [2, 2], color: [1.0, 0.85, 0.7] });
    const plaster = M.create('plaster', { color: [0.3, 0.33, 0.42], cracks: 0.3, stains: 0.4, repeat: [0.45, 0.45] });
    const crownGilt = M.create('gilded', { pattern: 0, repeats: 4, wear: 0.4, dirt: 0.55, repeat: [1 / 0.5, 1] });
    const frieze = M.create('gilded', { pattern: 6, repeats: 3, ground: 1, groundColor: [0.03, 0.04, 0.1], wear: 0.3, dirt: 0.5, repeat: [1 / 0.75, 1] });
    const giltFrame = M.create('gilded', { pattern: 1, repeats: 3, wear: 0.5, dirt: 0.7, repeat: [1 / 0.45, 1] });
    const giltFluted = M.create('gilded', { pattern: 5, repeats: 2, wear: 0.4, dirt: 0.5, repeat: [1 / 0.3, 1] });
    const giltPlain = M.create('gold', { wear: 0.5, dirt: 0.5, repeat: [2, 1] });
    const plateGold = M.create('gold', { wear: 0.25, dirt: 0.35, repeat: [3, 3], color: [0.95, 0.78, 0.5] });
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
    const ceil = new THREE.Mesh(G.planeUV(W, D, 1), plaster);
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
    {
      const door = new THREE.Group();
      for (const s of [-1, 1]) {
        const leaf = new THREE.Mesh(G.boxUV(DOOR.w / 2 - 0.01, DOOR.h, 0.05, 1), panelWood);
        leaf.position.set(s * DOOR.w / 4, DOOR.h / 2, 0); door.add(leaf);
        for (const [y, hgt] of [[0.6, 0.85], [1.75, 1.3]]) {
          const p = new THREE.Mesh(G.raisedPanel(DOOR.w / 2 - 0.18, hgt, { border: 0.05 }), panelWood);
          p.position.set(s * DOOR.w / 4, y, 0.025); door.add(p);
        }
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), brass);
        knob.position.set(s * 0.08, 1.05, 0.07); door.add(knob);
        const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 20), brass);
        rose.rotation.x = Math.PI / 2; rose.position.set(s * 0.08, 1.05, 0.03); door.add(rose);
      }
      const casing = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.14, 0.04), [
        V3(-DOOR.w / 2 - 0.07, 0, 0), V3(-DOOR.w / 2 - 0.07, DOOR.h + 0.07, 0), V3(DOOR.w / 2 + 0.07, DOOR.h + 0.07, 0), V3(DOOR.w / 2 + 0.07, 0, 0),
      ], { up: V3(0, 0, 1), uvScale: 1, flipOutward: true }), panelWood);
      door.add(casing);
      const pediment = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.2, 0.12), [V3(-DOOR.w / 2 - 0.3, DOOR.h + 0.22, -0.12), V3(-DOOR.w / 2 - 0.3, DOOR.h + 0.22, 0.0), V3(DOOR.w / 2 + 0.3, DOOR.h + 0.22, 0.0), V3(DOOR.w / 2 + 0.3, DOOR.h + 0.22, -0.12)], { uvScale: 1 }), crownGilt);
      door.add(pediment);
      const lintel = new THREE.Mesh(G.boxUV(DOOR.w + 0.5, 0.22, 0.05, 1), panelWood);
      lintel.position.set(0, DOOR.h + 0.21, -0.02); door.add(lintel);
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
      val.position.set(wx, WIN.sill + WIN.h + 0.36, Z0 + 0.17); add(val);
      const pelmet = new THREE.Mesh(G.boxUV(WIN.w + 1.0, 0.12, 0.2, 1), giltFrame);
      pelmet.position.set(wx, WIN.sill + WIN.h + 0.42, Z0 + 0.1); add(pelmet);
    }

    // ================================================================ rug
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 5.4), rugMat);
    rug.name = 'rug';
    rug.rotation.x = -Math.PI / 2; rug.rotation.z = 0.0; rug.position.set(-0.2, 0.006, -0.5);
    add(rug);

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
    torchLight.shadow.camera.near = 0.05;
    add(torchLight);

    // ================================================================ harp, cello, stand, chair (right side, by the windows)
    const harp = buildHarp(ctx, { gilt: giltFluted, giltPlain, wood: harpWood });
    harp.position.set(2.75, 0, -3.35); harp.rotation.y = -0.55;
    harp.userData.dynamic = true;
    add(harp);
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
    stand.position.set(1.95, 0, -1.85); stand.rotation.y = 1.2;
    add(stand);

    // ================================================================ fireplace wall (left)
    const fire = buildFireplace(ctx, { marble, iron, brass, gilt: giltPlain });
    fire.position.set(X0, 0, FIRE.z); fire.rotation.y = Math.PI / 2;
    add(fire);
    const fireLight = new THREE.PointLight(0xff7a2a, 3.2, 9, 2);
    fireLight.position.set(X0 + 0.85, 0.5, FIRE.z);
    add(fireLight);
    // overmantel: a composer's portrait in a heavy gilt frame
    const portrait = new THREE.Group();
    {
      const pw = 0.95, ph = 1.25;
      portrait.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), M.create('painting', { subject: 1, seed: 21, aspect: pw / ph, size: 1024 })));
      portrait.add(new THREE.Mesh(G.frameGeometry(pw, ph, { width: 0.13, depth: 0.07, uvScale: 1 }), giltFrame));
      portrait.position.set(X0 + 0.04, 2.45, FIRE.z); portrait.rotation.y = Math.PI / 2;
      portrait.userData.dynamic = true;
      add(portrait);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 14, 1, false, 0, Math.PI), brass);
      lamp.rotation.z = Math.PI / 2; lamp.rotation.x = Math.PI / 2; lamp.position.set(X0 + 0.2, 3.24, FIRE.z); add(lamp);
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
      const pl = new THREE.PointLight(0xffa860, 3.2, 8, 2);
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
    // front wall: two small paintings flanking the door + a settee
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.0), M.create('painting', { subject: s < 0 ? 3 : 1, seed: 40 + s, aspect: 0.75, size: 1024 })));
      g.add(new THREE.Mesh(G.frameGeometry(0.75, 1.0, { width: 0.09, depth: 0.05, uvScale: 1 }), giltFrame));
      g.position.set(s * 2.4, 2.2, Z1 - 0.04); g.rotation.y = Math.PI; add(g);
    }
    const chair2 = buildChair(ctx, { wood: mahogany, velvet: seatVelvet });
    chair2.position.set(-2.9, 0, 2.6); chair2.rotation.y = 2.3; add(chair2);

    // gasolier
    const gas = buildGasolier(ctx, { brass, crystal });
    gas.position.set(-0.5, H, -0.6);
    add(gas);
    const gasLight = new THREE.PointLight(0xffb070, 1.4, 12, 2);
    gasLight.position.set(-0.5, H - 0.85, -0.6);
    add(gasLight);

    // ================================================================ moonlight
    const moon = new THREE.SpotLight(0xa9bfff, 1500, 22, 0.42, 0.4, 2);
    moon.position.set(-3.2, 6.6, Z0 - 6.5);
    moon.target.position.set(0.4, 0, -0.6);
    moon.castShadow = ctx.quality.shadows;
    moon.shadow.mapSize.set(ctx.quality.shadowMapSize, ctx.quality.shadowMapSize);
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.02; moon.shadow.radius = ctx.quality.shadowRadius;
    moon.shadow.camera.near = 2; moon.shadow.camera.far = 20;
    add(moon); add(moon.target);
    add(new THREE.HemisphereLight(0x4a62b0, 0x22150c, 0.9));
    for (const wx of WIN.xs) add(fx.areaLight({ center: [wx, WIN.sill + 1.3, Z0 + 0.05], normal: [0, -0.35, 1], width: WIN.w, height: WIN.h, color: 0x8ea6ff, intensity: 0.9 }));

    const beamDir = new THREE.Vector3().subVectors(moon.target.position, moon.position).normalize();
    const shafts = [];
    for (const wx of WIN.xs) {
      const shaft = fx.shaft({
        center: V3(wx, WIN.sill + WIN.h * 0.47, Z0 - 0.02), right: V3(WIN.w / 2, 0, 0), up: V3(0, WIN.h * 0.5, 0),
        direction: beamDir, length: 4.2, color: 0x9fb6ff, intensity: 0.32, softness: 0.3, falloff: 1.0, panes: [2, 4], mullion: 0.035, noise: 0.7,
      });
      add(shaft); shafts.push(shaft);
    }
    add(fx.dust({ box: new THREE.Box3(V3(-3.4, 0.1, Z0 + 0.05), V3(3.4, 3.4, 1.2)), count: 2600, shafts, size: 0.011, intensity: 2.0, ambient: 0.05 }));
    add(fx.fog({ box: new THREE.Box3(V3(X0 + 0.2, 0, Z0 + 0.1), V3(X1 - 0.2, 0.5, Z1 - 0.3)), color: 0x0b111e, litColor: 0x31405e, density: 0.3, heightFalloff: 4 }));

    // ================================================================ puzzle
    let solvedScenePlayed = false;
    const solvedScene = async (p) => {
      // the ghost plays the whole nocturne with its answer, then lets go
      const tail = [...PHRASE, 65, 69, 74];
      tail.forEach((m, i) => setTimeout(() => { keys.press(m); keys.flash(m, { ghost: true, dur: 0.9 }); ghost.reachFor(keys.xOf(m)); pianoNote(ctx.audio, m, { velocity: 0.7, ghost: true, length: i === tail.length - 1 ? 5 : 2.8 }); }, i * 330));
      ghostFade.target = 0;
      ghostFade.speed = 0.25;
      solvedScenePlayed = true;
      setTimeout(() => ctx.say({ text: 'He finished it at last. How *touching*. I much preferred him unfinished.', speaker: 'stauf', speakerName: 'Stauf' }), 2600);
    };
    const nocturne = createPianoPuzzle({ keys, ghost, desk: piano.userData.desk, onSolvedScene: solvedScene });
    nocturne.puzzle.camera = (() => {
      const pos = pianoToWorld(0.03, 1.32, 0.66), tgt = pianoToWorld(0.03, 0.72, -0.02);
      return { position: pos.toArray(), target: tgt.toArray(), fov: 38 };
    })();
    const ghostFade = { target: ctx.state.isSolved(PUZZLE_ID) ? 0 : GHOST_IDLE, speed: 0.6, value: ctx.state.isSolved(PUZZLE_ID) ? 0 : GHOST_IDLE };
    if (ctx.state.isSolved(PUZZLE_ID)) { nocturne.markDone(); ghost.group.visible = false; }
    ghost.setOpacity(ghostFade.value);
    ghost.want = (v) => { ghostFade.target = v ?? GHOST_IDLE; };

    // ================================================================ navigation
    const nodes = {
      main: { position: [2.55, 1.62, 3.3], target: [-1.7, 1.2, -1.75], fov: 56, label: 'The music room', look: { yaw: [-50, 50], pitch: [-25, 30] } },
      piano: { position: pianoToWorld(1.6, 1.62, 0.3).toArray(), target: pianoToWorld(-0.35, 0.9, -0.15).toArray(), fov: 50, label: 'The piano' },
      harp: { position: [0.9, 1.6, 0.2], target: [3.1, 1.25, -3.2], fov: 54, label: 'The harp and the windows', look: { yaw: [-60, 60], pitch: [-25, 30] } },
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
      ghostFade.value += (ghostFade.target - ghostFade.value) * Math.min(1, dt * ghostFade.speed * 3);
      ghost.setOpacity(ghostFade.value);
      ghost.group.visible = ghostFade.value > 0.01;
      ghost.update(dt, t, !(window.__game?.mode === 'puzzle' || solvedScenePlayed));
      const fl = 0.8 + 0.2 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.2) + 0.08 * Math.sin(t * 17.0);
      fireLight.intensity = 3.2 * fl;
      fire.userData.coalMat.emissiveIntensity = 2.0 + 0.4 * Math.sin(t * 1.3);
      for (const [i, pl] of sconceLights.entries()) pl.intensity = (i < 2 ? 3.2 : 2.6) * (0.97 + 0.03 * Math.sin(t * 9.1 + i) * Math.sin(t * 3.7));
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
      o.castShadow = !fxLike && !['floor', 'ceiling', 'rug'].includes(o.name);
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });
    const merged = mergeStatic(root);
    root.userData.merged = merged;

    const godRays = WIN.xs.map((wx) => ({ position: V3(wx * 1.4 - 1.2, WIN.sill + 1.6, Z0 - 2.0), color: new THREE.Color(0.7, 0.8, 1.0), strength: 0.5, radius: 0.18 }));

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'main',
      grade: { exposure: 1.8, contrast: 1.1, saturation: 0.95, bloomStrength: 0.38, bloomThreshold: 1.2, godRayWeight: 0.3, godRayThreshold: 2.5, vignette: 0.45, aoIntensity: 1.15, aoRadius: 0.4 },
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
