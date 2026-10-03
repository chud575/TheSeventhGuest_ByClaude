import * as THREE from 'three';
import { STAIR, buildStaircase, stairEye, stairXZ, pitchY } from './staircase.js';
import { buildDoorway, buildClock, buildSconce, buildColumn, buildConsole, buildCandelabrum, spiderGeometry } from './props.js';
import { fanlightTexture, greatWindowTexture, sidelightTexture, medallionTexture, carpetTexture, clockDialTexture, staufPortraitTexture, floorTexture, ancestorPortraitTexture } from './textures.js';
import { createWebPuzzle, webMeta, WEB_ID } from './puzzleWeb.js';
import { palmOnPedestal, hallStand, umbrellaStand, hallBench, portieres, corbelGeometry, torchere } from './dressing.js';
import { buildChandelier } from '../../engine/lib/contrib/foyer-chandelier.js';

/**
 * The Grand Foyer — hub of Stauf Manor.
 *
 * A double-height hall (12 x 14 x 8.4 m): diagonal Carrara/Nero marble floor
 * around an inlaid medallion (the octagram puzzle), a sweeping staircase up the
 * east wall onto a columned gallery along the north wall, a brass-and-crystal
 * chandelier, Stauf's portrait over the gallery, a long-case clock, and moonlight
 * pouring through the great stained-glass window above the front door.
 *
 * Axes: x east(+)/west(-), z south(+, front door)/north(-), y up.
 */

const X0 = -6, X1 = 6, Z0 = -7, Z1 = 7, H = 8.4;
const UF = 4.2;              // upper floor (gallery) level
const BAL_Z = -4.3;          // gallery front edge
const BAL_X1 = STAIR.cx;     // gallery runs west of the stair head (x <= 1.4)
const DADO = 1.25;
const MED = new THREE.Vector3(0, 0.004, 0.4);
const MED_R = 1.7, MED_PR = 1.25;
/** engine curtainGeometry can emit NaN in its top row (pow of a tiny negative); patch it from the row below */
function fixNaN(g) {
  const a = g.attributes.position.array;
  const row = (g.parameters?.widthSegments ?? 140) + 1;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) a[i] = Number.isFinite(a[i + row * 3]) ? a[i + row * 3] : 0;
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
const CURVE_R = STAIR.R + STAIR.half + 0.1;   // radius of the curved stair wall

const DOORS = {
  front: { w: 1.8, h: 2.85 },
  music: { x: -1.6, w: 1.7, h: 2.9 },
  kitchen: { x: -4.6, w: 1.05, h: 2.5 },
  dining: { z: -1.6, w: 1.7, h: 2.9 },
  library: { z: 4.3, w: 1.5, h: 2.9 },
  gallery: { z: -5.65, w: 1.1, h: 2.45 },
};
const WIN = { great: { y: 4.85, w: 2.4, h: 2.85 }, west: [{ z: -1.6 }, { z: 3.2 }], westY: 5.0, westW: 1.5, westH: 2.6 };

export default {
  id: 'foyer',
  title: 'The Grand Foyer',
  floorName: 'Ground Floor',
  map: { floor: 'ground', rect: [400, 230, 200, 220] },
  start: 'main',
  ambience: { wind: 0.55, creaks: 0.45, clock: 0.75, thunder: 0.3, rain: 0, heartbeat: 0, roomTone: 0.35 },
  music: { key: 50, mood: 'dread' },
  puzzles: [webMeta],

  async build(ctx) {
    const { materials: M, geometry: G, fx } = ctx;
    const Q = ctx.quality;
    const root = new THREE.Group();
    root.name = 'foyer';
    // shadow flags are resolved once at the end of build(); `cast: false` marks a subtree as non-casting
    const add = (o, { cast = true, parent = root } = {}) => {
      if (!cast) o.traverse?.((c) => { c.userData.noShadow = true; });
      parent.add(o); return o;
    };
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const big = Q.textureSize >= 2048 ? 2048 : 1024;
    const ROOM_GRADE = {
      exposure: 1.1, contrast: 1.2, saturation: 0.92, lift: [0.0, 0.001, 0.004], gamma: [1.0, 1.0, 0.98], blackPoint: 0.006,
      shadowTint: [0.78, 1.0, 1.12], highlightTint: [1.1, 1.0, 0.86], splitAmount: 0.5,
      bloomStrength: 0.3, bloomThreshold: 3.2, bloomRadius: 0.28, godRayWeight: 0.6, vignette: 0.46, aoIntensity: 1.2, aoRadius: 0.45, grain: 0.03,
    };
    // review knobs (stills only): &tm=agx &exp=1.2 &sat=1
    if (ctx.params.get('tm')) ROOM_GRADE.toneMapping = ctx.params.get('tm');
    if (ctx.params.get('exp')) ROOM_GRADE.exposure = Number(ctx.params.get('exp'));
    if (ctx.params.get('sat')) ROOM_GRADE.saturation = Number(ctx.params.get('sat'));
    // node grades always restate the keys any node overrides (the engine blends from whatever is current)
    const NODE_BASE = { exposure: ROOM_GRADE.exposure, godRayWeight: ROOM_GRADE.godRayWeight };

    // ================================================================ materials
    const mat = {
      wall: M.create('damask', { repeat: [1.35, 1.35], base: [0.05, 0.085, 0.2], motif: [0.11, 0.15, 0.3], sheen: 0.7 }),
      // dark, aged walnut throughout (joinery + furniture) -- reads brown-black under moonlight, never pink
      panel: M.create('wood', { species: 'walnut', boards: 0, polish: 0.7, repeat: [1.1, 1.1], clearcoat: 0.55, clearcoatRoughness: 0.3, color: [0.6, 0.52, 0.47], roughness: 0.9 }),
      mahogany: M.create('walnut', { repeat: [1, 1], color: [0.58, 0.5, 0.46], clearcoat: 0.6, clearcoatRoughness: 0.22 }),
      dark: M.create('ebony', { repeat: [1, 1] }),
      ceiling: M.create('plaster', { color: [0.13, 0.16, 0.27], cracks: 0.25, stains: 0.45, repeat: [0.4, 0.4] }),
      soffit: M.create('plaster', { color: [0.42, 0.42, 0.44], cracks: 0.3, stains: 0.5, repeat: [0.6, 0.6] }),
      crown: M.create('gilded', { pattern: 0, repeats: 4, wear: 0.45, dirt: 0.6, repeat: [1 / 0.6, 1] }),
      frieze: M.create('gilded', { pattern: 6, repeats: 3, ground: 1, groundColor: [0.03, 0.04, 0.09], wear: 0.3, dirt: 0.5, repeat: [1 / 0.8, 1] }),
      gilt: M.create('gold', { wear: 0.5, dirt: 0.5, repeat: [2, 1] }),
      frame: M.create('gilded', { pattern: 1, repeats: 3, wear: 0.45, dirt: 0.7, repeat: [1 / 0.5, 1] }),
      brass: M.create('brass', { tarnish: 0.35, polish: 0.7, repeat: [2, 2] }),
      columns: M.create('marble', { type: 'nero', polish: 0.9, repeat: [1, 1] }),
      sill: M.create('marble', { type: 'carrara', polish: 0.7, repeat: [1, 1] }),
      glass: M.create('glass', { dirt: 0.5, transparent: true, opacity: 0.16 }),
      // cut lead crystal: opaque-ish dark body so only the facet glints read (no milky blob)
      crystal: new THREE.MeshPhysicalMaterial({ color: 0x2a3036, roughness: 0.0, metalness: 0.15, ior: 2.0, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.0, iridescence: 0.35, iridescenceIOR: 1.6, envMapIntensity: 3.2, flatShading: true }),
      iron: M.basic('iron'),
      black: M.basic('black'),
      rug: M.create('rug', { palette: 'tabriz', aspect: 1.5 / 3.4, knots: 200, wear: 0.45, fringe: 0.04, seed: 11, size: big }),
      floorboards: M.create('parquet', { species: 'oak', ratio: 5, planksAcross: 2, repeat: [0.9, 0.9], polish: 0.55, wear: 0.4 }),
    };
    {
      // aged marble checker: ivory Carrara (~0.62 albedo) and Nero, per-tile jitter, dark grout, scuffs;
      // a worn traffic path (door -> stair, door -> music room) is added in world space below
      const fs = floorTexture(ctx.textures, big);
      mat.floor = new THREE.MeshPhysicalMaterial({ map: fs.map, normalMap: fs.normalMap, roughnessMap: fs.ormMap, aoMap: fs.ormMap, roughness: 1, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.2, envMapIntensity: 1.0, specularIntensity: 0.6 });
      for (const t of [fs.map, fs.normalMap, fs.ormMap]) t.repeat.set(1 / 3.2, 1 / 3.2);
      mat.floor.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWPos;
float fyPath(vec2 p, vec2 a, vec2 b, float w) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return 1.0 - smoothstep(w * 0.4, w, length(pa - ba * h)); }
float fyHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float fyNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fyHash(i), fyHash(i + vec2(1, 0)), f.x), mix(fyHash(i + vec2(0, 1)), fyHash(i + vec2(1, 1)), f.x), f.y); }
`).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
{
  vec2 wp = vWPos.xz;
  float wear = max(max(fyPath(wp, vec2(0.0, 6.8), vec2(0.0, 2.2), 1.3), fyPath(wp, vec2(0.0, 2.2), vec2(4.2, 1.6), 1.1)),
                   max(fyPath(wp, vec2(0.0, 2.2), vec2(-1.6, -6.8), 1.0), fyPath(wp, vec2(-1.0, 1.0), vec2(-5.8, -1.6), 0.9)));
  wear *= 0.55 + 0.45 * fyNoise(wp * 3.0);
  roughnessFactor = clamp(roughnessFactor + wear * 0.22 + 0.06 * fyNoise(wp * 0.7), 0.0, 1.0);
  // grime gathers along the skirting
  float edgeD = min(min(wp.x + 6.0, 6.0 - wp.x), min(wp.y + 7.0, 7.0 - wp.y));
  diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.0, 0.6, edgeD)) * (1.0 - wear * 0.08);
}`);
      };
    }
    const carpetSet = carpetTexture(ctx.textures);
    mat.carpet = new THREE.MeshPhysicalMaterial({ map: carpetSet.map, normalMap: carpetSet.normalMap, roughnessMap: carpetSet.ormMap, aoMap: carpetSet.ormMap, roughness: 1, metalness: 0, sheen: 0.7, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.8, 0.35, 0.3), envMapIntensity: 0.4 });
    mat.shade = new THREE.MeshStandardMaterial({ color: 0x2a2116, emissive: new THREE.Color(1.0, 0.6, 0.28), emissiveIntensity: 2.6, roughness: 0.35, transparent: true, opacity: 0.94 });
    // black-widow chitin: near-black, glossy clearcoat; legs a touch rougher; the hourglass is paint, not a light
    mat.spider = new THREE.MeshPhysicalMaterial({ color: 0x050405, roughness: 0.18, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.06, specularIntensity: 1, envMapIntensity: 1.6 });
    mat.spiderLeg = new THREE.MeshPhysicalMaterial({ color: 0x070607, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 1.2 });
    mat.mark = new THREE.MeshStandardMaterial({ color: 0x9a0a08, emissive: 0x3a0200, emissiveIntensity: 0.6, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2 });

    // ================================================================ floor, medallion, ceiling
    {
      const floor = new THREE.Mesh(G.planeUV(X1 - X0, Z1 - Z0, 1), mat.floor);
      floor.rotation.x = -Math.PI / 2; floor.name = 'floor';
      add(floor, { cast: false });
      const medSet = medallionTexture(ctx.textures, MED_PR / MED_R);
      const medMat = new THREE.MeshPhysicalMaterial({ map: medSet.map, normalMap: medSet.normalMap, roughnessMap: medSet.ormMap, metalnessMap: medSet.ormMap, aoMap: medSet.ormMap, roughness: 1, metalness: 1, clearcoat: 0.05, clearcoatRoughness: 0.5, envMapIntensity: 0.9 });
      const med = new THREE.Mesh(new THREE.CircleGeometry(MED_R, 160), medMat);
      med.rotation.x = -Math.PI / 2; med.position.copy(MED); med.name = 'medallion';
      add(med, { cast: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(MED_R - 0.004, MED_R + 0.03, 160), mat.brass);
      ring.rotation.x = -Math.PI / 2; ring.position.copy(MED).add(V3(0, 0.001, 0));
      add(ring, { cast: false });
      const ceil = new THREE.Mesh(G.planeUV(X1 - X0, Z1 - Z0, 1), mat.ceiling);
      ceil.rotation.x = Math.PI / 2; ceil.position.y = H; ceil.name = 'ceiling';
      add(ceil, { cast: false });
    }

    // ================================================================ walls
    // each wall is built in local space (x along the wall, y up, +z into the room)
    const walls = {
      back: { len: 12, pos: [X0, 0, Z0], rot: 0 },
      right: { len: 14, pos: [X1, 0, Z0], rot: -Math.PI / 2 },
      front: { len: 12, pos: [X1, 0, Z1], rot: Math.PI },
      left: { len: 14, pos: [X0, 0, Z1], rot: Math.PI / 2 },
    };
    for (const w of Object.values(walls)) {
      w.group = new THREE.Group();
      w.group.position.set(...w.pos); w.group.rotation.y = w.rot;
      root.add(w.group);
    }
    const lx = {
      back: (x) => x - X0, front: (x) => X1 - x, left: (z) => Z1 - z, right: (z) => z - Z0,
    };
    const openings = {
      back: [
        { x: lx.back(DOORS.music.x) - DOORS.music.w / 2, y: 0, w: DOORS.music.w, h: DOORS.music.h },
        { x: lx.back(DOORS.kitchen.x) - DOORS.kitchen.w / 2, y: 0, w: DOORS.kitchen.w, h: DOORS.kitchen.h },
      ],
      front: [
        { x: 6 - DOORS.front.w / 2, y: 0, w: DOORS.front.w, h: DOORS.front.h + DOORS.front.w / 2, arch: true },
        { x: 6 - 1.35 - 0.25, y: 0.55, w: 0.5, h: 2.3 },
        { x: 6 + 1.35 - 0.25, y: 0.55, w: 0.5, h: 2.3 },
        { x: 6 - WIN.great.w / 2, y: WIN.great.y, w: WIN.great.w, h: WIN.great.h, arch: true },
      ],
      left: [
        { x: lx.left(DOORS.dining.z) - DOORS.dining.w / 2, y: 0, w: DOORS.dining.w, h: DOORS.dining.h },
        ...WIN.west.map((wi) => ({ x: lx.left(wi.z) - WIN.westW / 2, y: WIN.westY, w: WIN.westW, h: WIN.westH, arch: true })),
        { x: lx.left(DOORS.gallery.z) - DOORS.gallery.w / 2, y: UF, w: DOORS.gallery.w, h: DOORS.gallery.h },
      ],
      right: [
        { x: lx.right(DOORS.library.z) - DOORS.library.w / 2, y: 0, w: DOORS.library.w, h: DOORS.library.h },
      ],
    };
    for (const [k, w] of Object.entries(walls)) {
      const plane = new THREE.Mesh(G.wallWithOpenings(w.len, H, openings[k], { uvScale: 1 }), mat.wall);
      plane.name = `wall_${k}`;
      add(plane, { parent: w.group });
    }
    // curved stair wall (inside face of a quarter cylinder) + the short return at the gallery end
    {
      const segs = 48;
      const g = new THREE.CylinderGeometry(CURVE_R, CURVE_R, H, segs, 1, true, Math.PI / 2, Math.PI / 2);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (1 - uv.getX(i)) * CURVE_R * Math.PI / 2, uv.getY(i) * H);
      const cw = new THREE.Mesh(g, mat.wall.clone());
      cw.material.side = THREE.BackSide;
      cw.position.set(STAIR.cx, H / 2, STAIR.cz);
      cw.name = 'curvedWall';
      add(cw);
      const endZ = STAIR.cz - CURVE_R;
      const ret = new THREE.Mesh(G.planeUV(endZ - Z0, H, 1), mat.wall);
      ret.rotation.y = -Math.PI / 2; ret.position.set(STAIR.cx, H / 2, (endZ + Z0) / 2);
      add(ret);
    }

    // ---------------------------------------------------------------- wainscot (ground floor)
    const wainscot = new THREE.Group();
    wainscot.name = 'wainscot';
    const panelGeo = G.raisedPanel(0.62, 0.7, { border: 0.075, bevel: 0.035 });
    const chairProf = G.PROFILES.chairRail(0.12, 0.06);
    // bolection moulding (proud, rounded) that frames every raised field; x = proud of the wall, y = out from the field
    const bolProf = [[0, -0.012], [0.008, -0.011], [0.015, -0.006], [0.022, 0.004], [0.025, 0.014], [0.022, 0.024], [0.014, 0.031], [0.006, 0.034], [0, 0.035]].map(([x, y]) => new THREE.Vector2(-y, x));
    const bolection = (w, h) => G.sweepProfile(bolProf, [V3(-w / 2, -h / 2, 0), V3(-w / 2, h / 2, 0), V3(w / 2, h / 2, 0), V3(w / 2, -h / 2, 0)], { closed: true, up: new THREE.Vector3(0, 0, 1), uvScale: 1 });
    const baseProf = G.PROFILES.baseboard(0.26, 0.032);
    const wainRun = (wall, a, b) => {
      const len = b - a;
      if (len < 0.2) return;
      const grp = walls[wall].group;
      const back = new THREE.Mesh(G.boxUV(len, DADO - 0.05, 0.02, 1), mat.panel);
      back.position.set((a + b) / 2, (DADO - 0.05) / 2, 0.01); grp.add(back);
      const n = Math.max(1, Math.round(len / 0.8));
      const bols = [];
      for (let i = 0; i < n; i++) {
        const p = new THREE.Mesh(panelGeo, mat.panel);
        const pw = Math.max(0.2, (len / n - 0.12));
        p.position.set(a + (len / n) * (i + 0.5), 0.26 + 0.35 + 0.04, 0.02);
        p.scale.set(pw / 0.62, 1, 1);
        grp.add(p);
        const bg = bolection(pw - 0.15, 0.7 - 0.15);
        bg.translate(p.position.x, p.position.y, 0.022);
        bols.push(bg.index ? bg.toNonIndexed() : bg);
      }
      if (bols.length) grp.add(new THREE.Mesh(G.mergeGeometries(bols), mat.mahogany));
      grp.add(new THREE.Mesh(G.sweepProfile(chairProf, [V3(a, DADO - 0.07, 0), V3(b, DADO - 0.07, 0)], { uvScale: 1 }), mat.mahogany));
      // stile-and-rail frame: a lower rail over the skirting and an upper rail under the chair rail
      const rl = new THREE.Mesh(G.boxUV(len, 0.07, 0.012, 1), mat.panel); rl.position.set((a + b) / 2, 0.29, 0.026); grp.add(rl);
      const ru = new THREE.Mesh(G.boxUV(len, 0.07, 0.012, 1), mat.panel); ru.position.set((a + b) / 2, DADO - 0.13, 0.026); grp.add(ru);
      grp.add(new THREE.Mesh(G.sweepProfile(baseProf, [V3(a, 0, 0), V3(b, 0, 0)], { uvScale: 1 }), mat.dark));
    };
    const gap = 0.32; // casing allowance either side of a door
    const runsFor = (len, ops) => {
      const cuts = ops.filter((o) => o.y < DADO).map((o) => [o.x - gap, o.x + o.w + gap]).sort((p, q) => p[0] - q[0]);
      const out = []; let cur = 0;
      for (const [a, b] of cuts) { if (a > cur) out.push([cur, a]); cur = Math.max(cur, b); }
      if (cur < len) out.push([cur, len]);
      return out;
    };
    for (const [a, b] of runsFor(12, openings.back)) wainRun('back', Math.max(a, 0), Math.min(b, lx.back(STAIR.cx)));
    for (const [a, b] of runsFor(12, openings.front.map((o) => (o.w === 0.5 ? { ...o, y: 0 } : o)))) wainRun('front', a, b);
    for (const [a, b] of runsFor(14, openings.left)) wainRun('left', a, b);
    // east wall: only in front of the stair foot
    for (const [a, b] of runsFor(14, openings.right)) wainRun('right', Math.max(a, lx.right(STAIR.z0 + 0.15)), b);
    // the sidelights sit on short panelled pedestals
    for (const sx of [-1.35, 1.35]) {
      const ped = new THREE.Mesh(G.raisedPanel(0.5, 0.5, { border: 0.06, bevel: 0.025 }), mat.panel);
      ped.position.set(6 + sx, 0.29, 0.02); walls.front.group.add(ped);
      const pb = new THREE.Mesh(G.boxUV(0.62, 0.55, 0.03, 1), mat.panel); pb.position.set(6 + sx, 0.275, 0.0); walls.front.group.add(pb);
    }
    add(wainscot);
    // wainscot following the curved wall beneath the stair sweep
    {
      const Rw = CURVE_R - 0.012, a0 = -0.03, a1 = -Math.PI / 2 + 0.03;
      const n = Math.round(((a0 - a1) * Rw) / 0.8);
      const pw = ((a0 - a1) * Rw) / n;
      const pg = G.raisedPanel(Math.max(0.2, pw - 0.12), 0.7, { border: 0.075, bevel: 0.035 });
      for (let i = 0; i < n; i++) {
        const a = a0 - (a0 - a1) * ((i + 0.5) / n);
        const p = new THREE.Mesh(pg, mat.panel);
        p.position.set(STAIR.cx + Math.cos(a) * (Rw - 0.02), 0.65, STAIR.cz + Math.sin(a) * (Rw - 0.02));
        p.lookAt(STAIR.cx, 0.65, STAIR.cz);
        add(p);
      }
      const arc = (r, y) => { const pts = []; for (let i = 0; i <= 40; i++) { const a = a1 + (a0 - a1) * (i / 40); pts.push(V3(STAIR.cx + Math.cos(a) * r, y, STAIR.cz + Math.sin(a) * r)); } return pts; };
      // panelled backing as a thin curved band
      const back = new THREE.Mesh(new THREE.CylinderGeometry(Rw - 0.006, Rw - 0.006, DADO - 0.05, 48, 1, true, Math.PI / 2, Math.PI / 2), mat.panel);
      back.position.set(STAIR.cx, (DADO - 0.05) / 2, STAIR.cz);
      const bm = mat.panel.clone(); bm.side = THREE.BackSide; back.material = bm;
      add(back);
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.09, 0.045), arc(Rw, DADO - 0.06).reverse(), { uvScale: 1 }), mat.panel));
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.baseboard(0.26, 0.032), arc(Rw, 0).reverse(), { uvScale: 1 }), mat.dark));
      // a pedestal and marble urn in the curve
      const a = -0.8, pr = Rw - 0.55;
      const ped = new THREE.Group();
      ped.add(new THREE.Mesh(G.latheFromProfile([[0.24, 0], [0.24, 0.08], [0.21, 0.1], [0.2, 0.16], [0.16, 0.2], [0.15, 0.95], [0.18, 0.98], [0.22, 1.04], [0.25, 1.06], [0.25, 1.12], [0, 1.12]], 4).rotateY(Math.PI / 4), mat.columns));
      const urn = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.14, 0], [0.14, 0.04], [0.08, 0.07], [0.06, 0.12], [0.1, 0.18], [0.2, 0.3], [0.24, 0.42], [0.23, 0.52], [0.17, 0.6], [0.14, 0.64], [0.16, 0.68], [0.2, 0.7], [0.2, 0.73], [0.0, 0.72]], 48), M.create('marble', { type: 'carrara', polish: 0.75 }));
      urn.position.y = 1.12; ped.add(urn);
      for (const sd of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 20, Math.PI * 1.2), mat.sill); h.position.set(sd * 0.22, 1.12 + 0.52, 0); h.rotation.z = sd > 0 ? -0.6 : Math.PI + 0.6 - Math.PI * 0.2; ped.add(h); }
      ped.position.set(STAIR.cx + Math.cos(a) * pr, 0, STAIR.cz + Math.sin(a) * pr);
      add(ped);
    }
    // a raked dado rail along the stair wall
    {
      const p = [];
      for (let i = 0; i <= 40; i++) { const s = (i / 40) * STAIR.L; const xz = stairXZ(s, -STAIR.half - 0.1 + 0.002); p.push(V3(xz.x, pitchY(s) + 0.55, xz.y)); }
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.07, 0.03), p.reverse().map((v) => v), { uvScale: 1 }), mat.panel));
    }

    // ---------------------------------------------------------------- perimeter path (CCW from above) incl. the curved wall
    const loop = [];
    {
      loop.push(V3(X0, 0, Z0), V3(STAIR.cx, 0, Z0), V3(STAIR.cx, 0, STAIR.cz - CURVE_R));
      for (let i = 1; i < 24; i++) { const a = -Math.PI / 2 + (i / 24) * (Math.PI / 2); loop.push(V3(STAIR.cx + Math.cos(a) * CURVE_R, 0, STAIR.cz + Math.sin(a) * CURVE_R)); }
      loop.push(V3(X1, 0, STAIR.cz), V3(X1, 0, Z1), V3(X0, 0, Z1));
    }
    const atY = (pts, y) => pts.map((p) => V3(p.x, y, p.z));
    // crown cornice at the ceiling
    {
      const ch = 0.42;
      const crown = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(ch, 0.32), atY(loop, H - ch), { closed: true, uvScale: 1 }), mat.crown);
      crown.name = 'crown';
      add(crown, { cast: false });
      // frieze band + bead below the crown
      const fh = 0.32;
      const fz = new THREE.Mesh(G.sweepProfile([new THREE.Vector2(0.006, 0), new THREE.Vector2(0.006, fh)], atY(loop, H - ch - fh), { closed: true, uvScale: 1 }), mat.frieze);
      add(fz, { cast: false });
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.04, 0.025), atY(loop, H - ch - fh - 0.04), { closed: true, uvScale: 2 }), mat.gilt), { cast: false });
    }
    // entablature belt at the gallery level (open path: skips the curved stair wall)
    {
      const path = [V3(X1, 0, STAIR.cz), V3(X1, 0, Z1), V3(X0, 0, Z1), V3(X0, 0, Z0), V3(STAIR.cx, 0, Z0)];
      const y0 = UF - 0.22;
      add(new THREE.Mesh(G.sweepProfile([new THREE.Vector2(0.01, 0), new THREE.Vector2(0.01, 0.36)], atY(path, y0), { uvScale: 1 }), mat.frieze), { cast: false });
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.2, 0.15), atY(path, y0 + 0.36), { uvScale: 1 }), mat.crown), { cast: false });
      add(new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.05, 0.03), atY(path, y0 - 0.05), { uvScale: 2 }), mat.gilt), { cast: false });
    }

    // ---------------------------------------------------------------- coffered ceiling
    {
      const beamW = 0.34, beamD = 0.38;
      const xs = [-2, 2], zs = [-4.3, -1.4, 2.2, 5.0];
      const geos = [];
      for (const x of xs) { const b = G.boxUV(beamW, beamD, Z1 - Z0, 1); b.translate(x, H - beamD / 2, 0); geos.push(b); }
      for (const z of zs) { const b = G.boxUV(X1 - X0, beamD, beamW, 1); b.translate(0, H - beamD / 2 - 0.001, z); geos.push(b); }
      const beams = new THREE.Mesh(G.mergeGeometries(geos), mat.ceiling);
      beams.name = 'beams';
      add(beams, { cast: false });
      // gilt cove moulding inside every coffer
      const bx = [X0 + 0.32, ...xs, X1 - 0.32], bz = [Z0 + 0.32, ...zs, Z1 - 0.32];
      const cg = [];
      const cove = G.PROFILES.crown(0.14, 0.1);
      for (let i = 0; i < bx.length - 1; i++) for (let j = 0; j < bz.length - 1; j++) {
        const xa = bx[i] + (i === 0 ? 0 : beamW / 2), xb = bx[i + 1] - (i === bx.length - 2 ? 0 : beamW / 2);
        const za = bz[j] + (j === 0 ? 0 : beamW / 2), zb = bz[j + 1] - (j === bz.length - 2 ? 0 : beamW / 2);
        const y = H - 0.14;
        cg.push(G.sweepProfile(cove, [V3(xa, y, za), V3(xb, y, za), V3(xb, y, zb), V3(xa, y, zb)], { closed: true, uvScale: 1 }));
        // bead on the beam soffit edges
      }
      add(new THREE.Mesh(G.mergeGeometries(cg), mat.crown), { cast: false });
      // ceiling rose for the chandelier
      const rose = new THREE.Mesh(G.latheFromProfile([[0.0, 0], [0.7, 0], [0.7, -0.03], [0.62, -0.05], [0.55, -0.045], [0.5, -0.07], [0.38, -0.07], [0.3, -0.1], [0.18, -0.12], [0.1, -0.16], [0.0, -0.17]], 64), mat.crown);
      rose.position.set(MED.x, H, MED.z);
      add(rose, { cast: false });
      const roseRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.035, 8, 96), mat.gilt);
      roseRing.rotation.x = Math.PI / 2; roseRing.position.set(MED.x, H - 0.03, MED.z);
      add(roseRing, { cast: false });
    }

    // ================================================================ doors
    const doorMats = { leafMat: mat.mahogany, caseMat: mat.panel, giltMat: mat.crown, brassMat: mat.brass, friezeMat: mat.frieze, ironMat: mat.iron, thresholdMat: mat.sill };
    const placeOnWall = (wall, along, obj, y = 0) => { obj.position.set(along, y, 0); walls[wall].group.add(obj); return obj; };
    const doorObjs = {};
    doorObjs.music = placeOnWall('back', lx.back(DOORS.music.x), buildDoorway(ctx, { ...doorMats, w: DOORS.music.w, h: DOORS.music.h, double: true, pediment: 'segment' }));
    doorObjs.kitchen = placeOnWall('back', lx.back(DOORS.kitchen.x), buildDoorway(ctx, { ...doorMats, w: DOORS.kitchen.w, h: DOORS.kitchen.h, head: false }));
    doorObjs.dining = placeOnWall('left', lx.left(DOORS.dining.z), buildDoorway(ctx, { ...doorMats, w: DOORS.dining.w, h: DOORS.dining.h, double: true, ajar: 0.08, pediment: 'triangle' }));
    doorObjs.library = placeOnWall('right', lx.right(DOORS.library.z), buildDoorway(ctx, { ...doorMats, w: DOORS.library.w, h: DOORS.library.h, double: true, pediment: 'segment' }));
    doorObjs.gallery = placeOnWall('left', lx.left(DOORS.gallery.z), buildDoorway(ctx, { ...doorMats, w: DOORS.gallery.w, h: DOORS.gallery.h, head: false }), UF);
    doorObjs.front = placeOnWall('front', 6, buildDoorway(ctx, { ...doorMats, w: DOORS.front.w, h: DOORS.front.h, double: true, arch: true, depth: 0.42 }));
    // a sliver of lamplight leaks from the ajar dining-room door
    {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.12, DOORS.dining.h - 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.55, 0.25).multiplyScalar(1.6), toneMapped: false }));
      glow.position.set(0, DOORS.dining.h / 2, -0.42); glow.userData.noBake = true;
      doorObjs.dining.add(glow);
      const voidBox = new THREE.Mesh(new THREE.BoxGeometry(DOORS.dining.w + 0.3, DOORS.dining.h + 0.2, 0.02), mat.black);
      voidBox.position.set(0, DOORS.dining.h / 2, -0.45); doorObjs.dining.add(voidBox);
    }

    // ================================================================ windows (stained glass)
    const glassMats = [];
    const cookieSources = [];   // glass the moon shines through -> rendered into the moon's colour cookie
    // backlit leaded glass: the transmitted colour is emissive, the lead came is a lit, oxidised metal relief
    const glassMatFor = (emSet, surfSet, gain, tint = [1, 1, 1]) => {
      const m = new THREE.MeshStandardMaterial({
        map: surfSet.map, normalMap: surfSet.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughnessMap: surfSet.ormMap, metalnessMap: surfSet.ormMap,
        roughness: 1, metalness: 1, emissiveMap: emSet.map, emissive: new THREE.Color(...tint).multiplyScalar(gain), emissiveIntensity: 1,
        side: THREE.DoubleSide, envMapIntensity: 0.6, alphaTest: 0.5,
      });
      glassMats.push(m);
      return m;
    };
    const glassMesh = (geo, emSet, surfSet, gain, tint, cookieGain = 1.9) => {
      const g = new THREE.Mesh(geo, glassMatFor(emSet, surfSet, gain, tint));
      g.userData.noShadow = true; g.castShadow = false;
      cookieSources.push({ mesh: g, map: emSet.map, gain: cookieGain });
      return g;
    };
    const archShape = (w, h) => { const r = w / 2; const s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0); return s; };
    const shapeUV = (geo, w, h, y0 = 0) => { const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) - y0) / h); return geo; };
    const reveal = (w, h, depth, arch = true) => {
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2 - 0.03, -0.03); shape.lineTo(w / 2 + 0.03, -0.03); shape.lineTo(w / 2 + 0.03, h + 0.05); shape.lineTo(-w / 2 - 0.03, h + 0.05);
      const hole = new THREE.Path(); const r = w / 2;
      if (arch) { hole.moveTo(-r, 0); hole.lineTo(-r, h - r); hole.absarc(0, h - r, r, Math.PI, 0, true); hole.lineTo(r, 0); hole.lineTo(-r, 0); }
      else { hole.moveTo(-r, 0); hole.lineTo(-r, h); hole.lineTo(r, h); hole.lineTo(r, 0); hole.lineTo(-r, 0); }
      shape.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 32 });
      g.translate(0, 0, -depth);
      return G.applyBoxUVs(g, 1);
    };
    const archCasing = (w, h, cwid = 0.12) => {
      const r = w / 2 + 0.005;
      const path = [V3(-r, 0, 0)];
      for (let i = 0; i <= 28; i++) { const a = Math.PI - (i / 28) * Math.PI; path.push(V3(Math.cos(a) * r, h - w / 2 + Math.sin(a) * r, 0)); }
      path.push(V3(r, 0, 0));
      const prof = [[0, 0], [0.012, 0], [0.02, 0.015], [0.02, 0.05], [0.03, 0.065], [0.035, 0.1], [0.025, cwid], [0, cwid]].map(([x, y]) => new THREE.Vector2(-y, x));
      return G.sweepProfile(prof, path, { up: V3(0, 0, 1), uvScale: 1 });
    };
    // great window over the door
    {
      const wg = new THREE.Group();
      const { w, h, y } = WIN.great;
      wg.add(new THREE.Mesh(reveal(w, h, 0.5), mat.soffit));
      const glass = glassMesh(shapeUV(new THREE.ShapeGeometry(archShape(w, h), 48), w, h), greatWindowTexture(ctx.textures, w / h, 0), greatWindowTexture(ctx.textures, w / h, 1), 1.75, [0.9, 0.95, 1.1], 2.2);
      glass.position.z = -0.3; glass.name = 'greatWindow';
      wg.add(glass);
      wg.add(new THREE.Mesh(archCasing(w, h, 0.16), mat.crown));
      const sill = new THREE.Mesh(new G.RoundedBoxGeometry(w + 0.4, 0.07, 0.58, 2, 0.012), M.create('marble', { type: 'carrara', polish: 0.25, color: [0.6, 0.6, 0.62] })); sill.position.set(0, -0.035, -0.2); wg.add(sill);
      // carved keystone
      const ks = new THREE.Mesh(new G.RoundedBoxGeometry(0.22, 0.34, 0.08, 2, 0.01), mat.crown); ks.position.set(0, h + 0.1, 0.03); wg.add(ks);
      // iron saddle bars
      for (let i = 1; i < 5; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, w, 8), mat.iron); b.rotation.z = Math.PI / 2; b.position.set(0, (h - w / 2) * (i / 5), -0.285); wg.add(b); }
      // wrought-iron T-bar armature: a mullion and the transom at the springing line
      const tb = new THREE.Mesh(G.boxUV(w, 0.035, 0.03, 1), mat.iron); tb.position.set(0, h - w / 2, -0.28); wg.add(tb);
      const mb = new THREE.Mesh(G.boxUV(0.03, h - w / 2, 0.03, 1), mat.iron); mb.position.set(0, (h - w / 2) / 2, -0.28); wg.add(mb);
      placeOnWall('front', 6, wg, y);
    }
    // west clerestory windows (moonlit sky through pale leaded glass)
    const westSet = sidelightTexture(ctx.textures, 0.5 / 2.3);
    for (const wi of WIN.west) {
      const wg = new THREE.Group();
      wg.add(new THREE.Mesh(reveal(WIN.westW, WIN.westH, 0.5), mat.soffit));
      const wmap = westSet.map.clone(); wmap.repeat.set(3, 1.13); wmap.wrapS = wmap.wrapT = THREE.RepeatWrapping; wmap.needsUpdate = true;
      const glass = new THREE.Mesh(shapeUV(new THREE.ShapeGeometry(archShape(WIN.westW, WIN.westH), 40), WIN.westW, WIN.westH), new THREE.MeshBasicMaterial({ map: wmap, color: new THREE.Color(0.55, 0.62, 0.95).multiplyScalar(0.95), toneMapped: false }));
      glass.position.z = -0.32; glass.castShadow = false;
      wg.add(glass);
      wg.add(new THREE.Mesh(archCasing(WIN.westW, WIN.westH, 0.12), mat.crown));
      const sill = new THREE.Mesh(new G.RoundedBoxGeometry(WIN.westW + 0.3, 0.06, 0.56, 2, 0.01), mat.sill); sill.position.set(0, -0.03, -0.2); wg.add(sill);
      placeOnWall('left', lx.left(wi.z), wg, WIN.westY);
      // heavy velvet drapes
      for (const side of [-1, 1]) {
        const c = new THREE.Mesh(fixNaN(G.curtainGeometry({ width: 0.75, height: WIN.westH + 0.55, folds: 7, depth: 0.07, tieback: 0.55, seed: side * 3 + wi.z })), mat.velvet || (mat.velvet = M.create('velvet', { color: [0.06, 0.07, 0.2], crush: 0.55, repeat: [2, 2], side: THREE.DoubleSide })));
        c.position.set(lx.left(wi.z) + side * (WIN.westW / 2 + 0.2), WIN.westY + WIN.westH + 0.35, 0.14);
        if (side > 0) c.scale.x = -1;
        walls.left.group.add(c);
      }
    }
    // fanlight + sidelights at the front door
    {
      const fw = DOORS.front.w, fh = DOORS.front.h;
      const fan = new THREE.Shape(); fan.moveTo(-fw / 2, 0); fan.absarc(0, 0, fw / 2, Math.PI, 0, true); fan.lineTo(-fw / 2, 0);
      const fg = shapeUV(new THREE.ShapeGeometry(fan, 48), fw, fw / 2);
      const fanMesh = glassMesh(fg, fanlightTexture(ctx.textures, 0), fanlightTexture(ctx.textures, 1), 1.8, [0.95, 0.95, 1.05], 2.0);
      fanMesh.position.set(6, fh + 0.04, -0.2);
      walls.front.group.add(fanMesh);
      const transom = new THREE.Mesh(new G.RoundedBoxGeometry(fw + 0.02, 0.09, 0.2, 2, 0.01), mat.panel); transom.position.set(6, fh + 0.0, -0.12); walls.front.group.add(transom);
      const sideSet = sidelightTexture(ctx.textures, 0.5 / 2.3, 0), sideSurf = sidelightTexture(ctx.textures, 0.5 / 2.3, 1);
      for (const sx of [-1.35, 1.35]) {
        const sl = glassMesh(new THREE.PlaneGeometry(0.5, 2.3), sideSet, sideSurf, 1.3, [0.95, 0.97, 1.05], 1.8);
        sl.position.set(6 + sx, 0.55 + 1.15, -0.2);
        walls.front.group.add(sl);
        const fr = new THREE.Mesh(G.frameGeometry(0.5, 2.3, { width: 0.07, depth: 0.05, uvScale: 1 }), mat.panel);
        fr.position.set(6 + sx, 0.55 + 1.15, 0.0); walls.front.group.add(fr);
        const jl = new THREE.Mesh(reveal(0.5, 2.3, 0.3, false), mat.panel); jl.position.set(6 + sx, 0.55, 0); walls.front.group.add(jl);
      }
    }

    // ================================================================ gallery (balcony) on the north wall
    const balcony = new THREE.Group();
    balcony.name = 'gallery';
    {
      const bw = BAL_X1 - X0, bd = BAL_Z - Z0;
      const slab = new THREE.Mesh(G.boxUV(bw, 0.4, bd, 1), mat.soffit);
      slab.position.set((X0 + BAL_X1) / 2, UF - 0.2, (Z0 + BAL_Z) / 2); balcony.add(slab);
      const top = new THREE.Mesh(G.planeUV(bw, bd, 1), mat.floorboards);
      top.rotation.x = -Math.PI / 2; top.position.set((X0 + BAL_X1) / 2, UF + 0.002, (Z0 + BAL_Z) / 2); balcony.add(top);
      // fascia frieze + bed moulding + nosing
      // a proper entablature: architrave fasciae, a deep frieze, a projecting cornice, carried on scroll corbels
      const fasc = new THREE.Mesh(G.sweepProfile([new THREE.Vector2(0.03, 0), new THREE.Vector2(0.03, 0.34)], [V3(X0, UF - 0.38, BAL_Z), V3(BAL_X1, UF - 0.38, BAL_Z)], { uvScale: 1 }), mat.frieze);
      balcony.add(fasc);
      const beam = new THREE.Mesh(G.boxUV(bw, 0.5, 0.2, 1), mat.soffit); beam.position.set((X0 + BAL_X1) / 2, UF - 0.45, BAL_Z - 0.08); balcony.add(beam);
      for (const [y, dz] of [[UF - 0.66, 0.012], [UF - 0.72, 0.0]]) {
        balcony.add(new THREE.Mesh(G.sweepProfile([new THREE.Vector2(dz + 0.018, 0), new THREE.Vector2(dz + 0.018, 0.06), new THREE.Vector2(dz, 0.06)], [V3(X0, y, BAL_Z), V3(BAL_X1, y, BAL_Z)], { uvScale: 1 }), mat.gilt));
      }
      const corbel = corbelGeometry(G, { w: 0.13, h: 0.36, d: 0.22 });
      const cgs = [];
      for (let x = X0 + 0.45; x < BAL_X1 - 0.2; x += 0.62) {
        if (Math.abs(x + 3.3) < 0.45 || Math.abs(x - 0.15) < 0.45) continue;     // the columns take those bays
        cgs.push(corbel.clone().translate(x, UF - 0.72, BAL_Z + 0.03));
      }
      balcony.add(new THREE.Mesh(G.mergeGeometries(cgs), mat.crown));
      const bed = new THREE.Mesh(G.sweepProfile(G.PROFILES.crown(0.3, 0.26), [V3(X0, UF - 0.04 - 0.3, BAL_Z + 0.03), V3(BAL_X1, UF - 0.04 - 0.3, BAL_Z + 0.03)], { uvScale: 1 }), mat.crown);
      balcony.add(bed);
      const nose = new THREE.Mesh(G.sweepProfile(G.PROFILES.chairRail(0.09, 0.07), [V3(X0, UF - 0.07, BAL_Z + 0.26), V3(BAL_X1, UF - 0.07, BAL_Z + 0.26)], { uvScale: 1 }), mat.panel);
      balcony.add(nose);
      // balustrade
      const plinth = new THREE.Mesh(new G.RoundedBoxGeometry(bw, 0.1, 0.2, 2, 0.012), mat.panel);
      plinth.position.set((X0 + BAL_X1) / 2, UF + 0.05, BAL_Z + 0.06); balcony.add(plinth);
      const ledge = new THREE.Mesh(G.boxUV(bw, 0.07, 0.3, 1), mat.panel); ledge.position.set((X0 + BAL_X1) / 2, UF - 0.035, BAL_Z + 0.12); balcony.add(ledge);
    }
    add(balcony);

    // ================================================================ staircase
    const stairMats = { tread: mat.mahogany, riser: mat.panel, carpet: mat.carpet, brass: mat.brass, string: mat.panel, rail: mat.mahogany, gilt: mat.gilt, soffit: mat.soffit, baluster: mat.dark, newel: mat.mahogany, bracket: mat.mahogany };
    const stair = buildStaircase(ctx, stairMats);
    add(stair.group);
    // gallery balusters + rail (share the stair's turned baluster)
    {
      const n = Math.floor((BAL_X1 - X0 - 0.2) / 0.155);
      const im = new THREE.InstancedMesh(stair.balGeo, mat.dark, n);
      const m = new THREE.Matrix4();
      for (let i = 0; i < n; i++) { m.makeTranslation(X0 + 0.15 + i * 0.155, UF + 0.1, BAL_Z + 0.06); im.setMatrixAt(i, m); }
      im.castShadow = true; im.receiveShadow = true;
      root.add(im);
      const railY = UF + 0.1 + stair.balusterH + 0.06;
      add(new THREE.Mesh(G.sweepProfile(stair.railProf.map((p) => p.clone().multiplyScalar(1.15)), [V3(BAL_X1, railY, BAL_Z + 0.06), V3(X0, railY, BAL_Z + 0.06)], { uvScale: 1 }), mat.mahogany));
      // carved newels at the bays (over the columns)
      for (const x of [X0 + 0.1, -3.3, 0.15]) {
        const post = stair.carvedNewel(railY - UF - 0.06, 0.17);
        post.position.set(x, UF + 0.04, BAL_Z + 0.06); add(post);
      }
    }
    // columns carrying the gallery
    for (const x of [-3.3, 0.15]) {
      const c = buildColumn(ctx, { height: UF - 0.7, shaftMat: mat.columns, capMat: mat.crown, baseMat: mat.sill, radius: 0.25 });
      c.position.set(x, 0, BAL_Z - 0.17);
      add(c);
    }

    // ================================================================ chandelier
    const chand = buildChandelier(ctx, {
      brass: mat.brass, crystal: mat.crystal, gilt: mat.gilt,
      tiers: [{ arms: 12, radius: 0.86, y: 0.0 }, { arms: 8, radius: 0.52, y: 0.4 }, { arms: 6, radius: 0.28, y: 0.72 }],
      chain: 2.0, bodyHeight: 1.35, candleHeight: 0.15, lit: 1, seed: 3, flameIntensity: 4.2,
    });
    chand.group.position.set(MED.x, H, MED.z);
    add(chand.group, { cast: false });
    // half the candles have guttered out (they rekindle when the web is solved)
    const gutter = (on) => chand.candles.forEach((c, i) => { const f = c.userData.flame; if (f) f.visible = on || (i * 7) % 5 < 3; c.userData.body.material.emissiveIntensity = f?.visible ? 0.04 : 0; });
    gutter(false);
    // one shadowed key hung just below the crystal cascade: far enough from the brass that nothing blows out
    const chandLight = new THREE.PointLight(0xffc088, 48, 22, 2);
    chandLight.position.copy(chand.lightAnchor).add(chand.group.position).add(V3(0, -0.62, 0));
    chandLight.castShadow = Q.shadows;
    chandLight.shadow.mapSize.set(512, 512);
    chandLight.shadow.bias = -0.004; chandLight.shadow.normalBias = 0.04; chandLight.shadow.radius = 5;
    chandLight.shadow.camera.near = 0.25;
    root.add(chandLight);
    let chandBase = 48;
    ctx.onUpdate((dt, t) => { chandLight.intensity = chandBase * (0.95 + 0.05 * Math.sin(t * 7.3) * Math.sin(t * 2.9 + 1.0)); });

    // ================================================================ portrait of Stauf (over the gallery)
    let portrait;
    {
      // the master of the house: twice the size of any ancestor, in a heavy carved frame with its own picture light
      const pw = 1.45, ph = 1.95, PY = UF + 1.98;
      portrait = new THREE.Group();
      portrait.name = 'staufPortrait';
      const ps = staufPortraitTexture(ctx.textures, pw / ph);
      const canvasMat = new THREE.MeshPhysicalMaterial({ map: ps.map, normalMap: ps.normalMap, normalScale: new THREE.Vector2(0.15, 0.15), roughnessMap: ps.ormMap, roughness: 1, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.3, envMapIntensity: 0.5 });
      const canvas = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), canvasMat);
      portrait.add(canvas);
      // inner gilt slip, main carved frame, outer bead
      portrait.add(new THREE.Mesh(G.frameGeometry(pw, ph, { width: 0.035, depth: 0.03, uvScale: 1 }), mat.gilt));
      const fr = new THREE.Mesh(G.frameGeometry(pw + 0.07, ph + 0.07, { width: 0.22, depth: 0.13, uvScale: 1 }), mat.frame);
      portrait.add(fr);
      const ob = new THREE.Mesh(G.frameGeometry(pw + 0.51, ph + 0.51, { width: 0.05, depth: 0.16, uvScale: 1 }), mat.crown);
      portrait.add(ob);
      // cresting: a carved shell-and-scroll cartouche on the top rail
      {
        const sh = new THREE.Shape();
        sh.moveTo(-0.42, 0); sh.bezierCurveTo(-0.36, 0.1, -0.22, 0.06, -0.16, 0.12); sh.bezierCurveTo(-0.12, 0.2, -0.05, 0.24, 0, 0.27);
        sh.bezierCurveTo(0.05, 0.24, 0.12, 0.2, 0.16, 0.12); sh.bezierCurveTo(0.22, 0.06, 0.36, 0.1, 0.42, 0); sh.lineTo(-0.42, 0);
        const cg = G.applyBoxUVs(new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 3, curveSegments: 16 }), 1);
        const cr = new THREE.Mesh(cg, mat.frame); cr.position.set(0, ph / 2 + 0.25, 0.06); portrait.add(cr);
        const boss = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 12), mat.gilt); boss.scale.set(1, 1, 0.5); boss.position.set(0, ph / 2 + 0.36, 0.13); portrait.add(boss);
        for (const sx of [-1, 1]) { const v = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.016, 8, 20, Math.PI * 1.5), mat.gilt); v.position.set(sx * 0.3, ph / 2 + 0.29, 0.1); v.rotation.z = sx > 0 ? -0.5 : Math.PI + 0.5; portrait.add(v); }
      }
      // engraved brass plaque
      const plaqueTex = ctx.textures.canvas('foyer:staufplaque', 512, 112, (g2, w2, h2) => {
        const gr = g2.createLinearGradient(0, 0, 0, h2); gr.addColorStop(0, '#9c7a3a'); gr.addColorStop(0.5, '#c9a35a'); gr.addColorStop(1, '#7a5a26');
        g2.fillStyle = gr; g2.fillRect(0, 0, w2, h2);
        g2.strokeStyle = '#3a2a10'; g2.lineWidth = 4; g2.strokeRect(8, 8, w2 - 16, h2 - 16);
        g2.fillStyle = '#2a1c08'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
        g2.font = 'bold 44px "Cinzel", "Times New Roman", serif'; g2.fillText('HENRY STAUF', w2 / 2, h2 / 2 - 4);
        g2.font = 'italic 20px "Cormorant Garamond", serif'; g2.fillText('Toymaker  ·  Master of this House', w2 / 2, h2 - 22);
      }, { tile: false });
      const pl = new THREE.Mesh(new G.RoundedBoxGeometry(0.46, 0.1, 0.012, 2, 0.004), [mat.brass, mat.brass, mat.brass, mat.brass, new THREE.MeshStandardMaterial({ map: plaqueTex, metalness: 0.85, roughness: 0.35 }), mat.brass]);
      pl.position.set(0, -ph / 2 - 0.16, 0.14); portrait.add(pl);
      // the faintest glint in his eyes
      portrait.position.set(DOORS.music.x, PY, Z0 + 0.07);
      portrait.rotation.x = 0.035;
      add(portrait);
      // long brass picture light on a swan-neck arm
      const top = PY + ph / 2 + 0.46;
      const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0, 0, 0), V3(0, 0.05, 0.12), V3(0, 0.0, 0.28)]), 12, 0.01, 8), mat.brass);
      arm.position.set(DOORS.music.x, top - 0.12, Z0 + 0.06); add(arm);
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.85, 20, 1, false, 0, Math.PI), mat.brass);
      hood.rotation.z = Math.PI / 2; hood.rotation.y = Math.PI / 2; hood.position.set(DOORS.music.x, top - 0.13, Z0 + 0.36); add(hood);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.78, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.75, 0.45).multiplyScalar(2.2), toneMapped: false }));
      tube.rotation.z = Math.PI / 2; tube.position.set(DOORS.music.x, top - 0.155, Z0 + 0.36); tube.userData.noBake = true; add(tube, { cast: false });
      const pLight = new THREE.SpotLight(0xffb070, 34, 6, 0.75, 0.7, 2);
      pLight.position.set(DOORS.music.x, top - 0.17, Z0 + 0.55);
      pLight.target.position.set(DOORS.music.x, PY - 0.45, Z0);
      root.add(pLight, pLight.target);
    }
    // a second, larger canvas on the east wall above the stair: a stormy landscape
    {
      const pw = 1.9, ph = 1.3;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), M.create('painting', { subject: 0, seed: 21, aspect: pw / ph, size: 1024 })));
      g.add(new THREE.Mesh(G.frameGeometry(pw, ph, { width: 0.13, depth: 0.07, uvScale: 1 }), mat.frame));
      g.position.set(X1 - 0.05, 5.0, 3.6); g.rotation.y = -Math.PI / 2;
      add(g);
      // seascape on the west wall between the windows
      const s = new THREE.Group();
      s.add(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), M.create('painting', { subject: 2, seed: 4, aspect: 1.1 / 0.8, size: 1024 })));
      s.add(new THREE.Mesh(G.frameGeometry(1.1, 0.8, { width: 0.1, depth: 0.06, uvScale: 1 }), mat.frame));
      s.position.set(X0 + 0.05, 2.95, 1.95); s.rotation.y = Math.PI / 2;
      add(s);
    }

    // ancestors climbing the stair wall (east wall over the straight flight, then the curve)
    {
      const hang = [
        { s: 0.9, w: 0.75, h: 1.0, p: { v: 1, ground: [0.09, 0.12, 0.08], coat: [0.03, 0.028, 0.03] } },
        { s: 2.6, w: 0.9, h: 1.15, p: { v: 2, ground: [0.2, 0.08, 0.06], coat: [0.025, 0.02, 0.03] } },
        { s: 4.6, w: 1.1, h: 0.8, subj: 0, seed: 33 },
        { s: 6.4, w: 0.75, h: 1.0, subj: 3, seed: 34 },
      ];
      for (const hp of hang) {
        const g = new THREE.Group();
        let cm;
        if (hp.p) {
          const ts = ancestorPortraitTexture(ctx.textures, hp.w / hp.h, hp.p);
          cm = new THREE.MeshPhysicalMaterial({ map: ts.map, normalMap: ts.normalMap, normalScale: new THREE.Vector2(0.15, 0.15), roughnessMap: ts.ormMap, roughness: 1, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.32, envMapIntensity: 0.5 });
        } else cm = M.create('painting', { subject: hp.subj, seed: hp.seed, aspect: hp.w / hp.h, size: 1024, cracks: 0.6, varnish: 0.8, clearcoat: 0.4, clearcoatRoughness: 0.3 });
        g.add(new THREE.Mesh(new THREE.PlaneGeometry(hp.w, hp.h), cm));
        g.add(new THREE.Mesh(G.frameGeometry(hp.w, hp.h, { width: 0.025, depth: 0.025, uvScale: 1 }), mat.gilt));
        g.add(new THREE.Mesh(G.frameGeometry(hp.w + 0.05, hp.h + 0.05, { width: 0.12, depth: 0.08, uvScale: 1 }), mat.frame));
        const y = pitchY(hp.s) + 1.75;
        if (hp.s <= STAIR.straight) { g.position.set(X1 - 0.04, y, STAIR.z0 - hp.s); g.rotation.y = -Math.PI / 2; }
        else {
          const a = -(hp.s - STAIR.straight) / STAIR.R;
          g.position.set(STAIR.cx + Math.cos(a) * (CURVE_R - 0.05), y, STAIR.cz + Math.sin(a) * (CURVE_R - 0.05));
          g.lookAt(STAIR.cx, y, STAIR.cz);
        }
        add(g);
      }
    }

    // ================================================================ grandfather clock, console, newel lamp, sconces
    const clock = buildClock(ctx, { case: mat.mahogany, dark: mat.dark, brass: mat.brass, gilt: mat.gilt, glass: mat.glass, dial: clockDialTexture(ctx.textures), iron: mat.iron });
    clock.position.set(X0 + 0.2, 0, -3.75); clock.rotation.y = Math.PI / 2;
    add(clock);
    {
      const { pendulum, hourHand, minuteHand } = clock.userData;
      // the clock stands at a quarter to midnight — and a quarter to midnight it stays
      hourHand.rotation.z = -(11.75 / 12) * Math.PI * 2;
      minuteHand.rotation.z = -(45 / 60) * Math.PI * 2;
      ctx.onUpdate((dt, t) => { pendulum.rotation.z = Math.sin(t * Math.PI) * 0.09; });
    }
    let consoleCandles;
    {
      const con = buildConsole(ctx, { wood: mat.mahogany, marble: M.create('marble', { type: 'rosso', polish: 0.85 }), gilt: mat.gilt });
      con.position.set(X0 + 0.26, 0, 4.7); con.rotation.y = Math.PI / 2;
      add(con);
      // tall gilt pier mirror
      const mw = 0.9, mh = 1.6;
      const mirror = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), new THREE.MeshPhysicalMaterial({ color: 0x1a1c22, metalness: 1, roughness: 0.06, envMapIntensity: 1.6, clearcoat: 0.6 }));
      mirror.add(glass);
      mirror.add(new THREE.Mesh(G.frameGeometry(mw, mh, { width: 0.12, depth: 0.07, uvScale: 1 }), mat.frame));
      mirror.position.set(X0 + 0.05, 1.86, 4.7); mirror.rotation.y = Math.PI / 2;
      add(mirror);
      const cand = buildCandelabrum(ctx, { brass: mat.brass, arms: 3 });
      cand.position.set(X0 + 0.3, 0.88, 4.35); cand.rotation.y = Math.PI / 2;
      add(cand, { cast: false });
      consoleCandles = cand.userData.candles;
      const cl = new THREE.PointLight(0xff9a50, 3.2, 7, 2);
      cl.position.set(X0 + 0.45, 1.35, 4.35);
      root.add(cl);
      ctx.onUpdate((dt, t) => { cl.intensity = 3.2 * (0.9 + 0.1 * Math.sin(t * 8.1) * Math.sin(t * 3.3)); });
      // the invitation on a silver salver
      const salver = new THREE.Mesh(G.latheFromProfile([[0, 0], [0.12, 0], [0.13, 0.008], [0.14, 0.012], [0.135, 0.014], [0.0, 0.006]], 36), M.basic('silver', { roughness: 0.25 }));
      salver.position.set(X0 + 0.3, 0.882, 5.05); add(salver);
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.002, 0.16), M.basic('bone', { color: 0xe6dcc0 }));
      card.position.set(X0 + 0.3, 0.892, 5.05); card.rotation.y = 0.4; add(card);
      ctx._card = card;
    }
    // ================================================================ set dressing
    {
      mat.velvetRed = M.create('velvet', { color: [0.2, 0.022, 0.035], crush: 0.55, repeat: [2, 2], side: THREE.DoubleSide });
      const marbleV = M.create('marble', { type: 'verde', polish: 0.8 });
      const porcelain = M.basic('porcelain', { color: 0x9aa6b8 });
      const mirrorMat = new THREE.MeshPhysicalMaterial({ color: 0x15171c, metalness: 1, roughness: 0.08, envMapIntensity: 1.4 });
      // parlour palms on pedestals in the bays under the gallery
      const p1 = palmOnPedestal(ctx, { marble: marbleV, brass: mat.brass, seed: 5 }); p1.position.set(-3.27, 0, -6.55); p1.rotation.y = 0.4; add(p1);
      const p2 = palmOnPedestal(ctx, { marble: marbleV, brass: mat.brass, seed: 9, palmH: 1.2 }); p2.position.set(0.86, 0, -6.6); p2.rotation.y = 1.3; add(p2);
      const p3 = palmOnPedestal(ctx, { marble: marbleV, brass: mat.brass, seed: 13, palmH: 1.5 }); p3.position.set(-5.45, 0, 6.45); add(p3);
      // hall stand + umbrella stand on the west wall
      const hs = hallStand(ctx, { wood: mat.mahogany, brass: mat.brass, mirrorMat, tile: M.create('marble', { type: 'nero', polish: 0.8 }) });
      hs.position.set(X0 + 0.17, 0, 1.95); hs.rotation.y = Math.PI / 2; add(hs);
      const us = umbrellaStand(ctx, { brass: mat.brass, porcelain }); us.position.set(X0 + 0.3, 0, 0.4); add(us);
      // a buttoned velvet bench in the curve under the stair
      const bench = hallBench(ctx, { wood: mat.mahogany, velvet: mat.velvetRed, brass: mat.brass });
      { const a = -0.3, r = 3.95; bench.position.set(STAIR.cx + Math.cos(a) * r, 0, STAIR.cz + Math.sin(a) * r); bench.lookAt(STAIR.cx, 0, STAIR.cz); add(bench); }
      // heavy portières on the dining-room and library doors
      const pd = portieres(ctx, { width: DOORS.dining.w + 0.3, height: DOORS.dining.h + 0.22, velvet: mat.velvetRed, brass: mat.brass, seed: 2, tassel: mat.gilt });
      placeOnWall('left', lx.left(DOORS.dining.z), pd);
      const pli = portieres(ctx, { width: DOORS.library.w + 0.3, height: DOORS.library.h + 0.22, velvet: mat.velvetRed, brass: mat.brass, seed: 4, tassel: mat.gilt });
      placeOnWall('right', lx.right(DOORS.library.z), pli);
      // a pair of brass torchères framing the inlaid web: warm pools in the middle distance
      for (const sx of [-1, 1]) {
        const tc = torchere(ctx, { brass: mat.brass, seed: sx > 0 ? 3 : 7 });
        tc.position.set(MED.x + sx * 2.45, 0, MED.z - 1.4); add(tc);
        const tl = new THREE.PointLight(0xff9c55, 4.2, 9, 2); tl.position.set(MED.x + sx * 2.45, 1.75, MED.z - 1.4); root.add(tl);
        ctx.onUpdate((dt, t) => { tl.intensity = 4.2 * (0.92 + 0.08 * Math.sin(t * 7.9 + sx * 2) * Math.sin(t * 2.7 + sx)); });
      }
      // console tables with lit candelabra beneath the sconces flanking the front door
      for (const sx of [-1, 1]) {
        const con = buildConsole(ctx, { wood: mat.mahogany, marble: M.create('marble', { type: 'rosso', polish: 0.85 }), gilt: mat.gilt });
        con.position.set(sx * 2.5, 0, Z1 - 0.26); con.rotation.y = Math.PI; add(con);
        const cand = buildCandelabrum(ctx, { brass: mat.brass, arms: 3 });
        cand.position.set(sx * 2.5, 0.88, Z1 - 0.3); cand.rotation.y = Math.PI; add(cand, { cast: false });
        cand.userData.candles.forEach((c) => { const f = c.userData.flame; if (f?.material?.uniforms?.uIntensity) f.material.uniforms.uIntensity.value = 4.5; });
        const cl = new THREE.PointLight(0xff9a50, 2.2, 6, 2); cl.position.set(sx * 2.5, 1.32, Z1 - 0.5); root.add(cl);
        ctx.onUpdate((dt, t) => { cl.intensity = 2.2 * (0.9 + 0.1 * Math.sin(t * 8.7 + sx) * Math.sin(t * 3.1)); });
      }
    }
    // newel lamp: bronze torchère with a frosted globe
    {
      const top = stair.newel.userData.top;
      const lamp = new THREE.Group();
      lamp.add(new THREE.Mesh(G.latheFromProfile([[0, 0], [0.09, 0], [0.085, 0.02], [0.05, 0.05], [0.035, 0.1], [0.05, 0.16], [0.02, 0.22], [0.016, 0.5], [0.03, 0.53], [0.06, 0.56], [0.0, 0.57]], 28), mat.brass));
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 20), new THREE.MeshStandardMaterial({ color: 0x302418, emissive: new THREE.Color(1.0, 0.55, 0.24), emissiveIntensity: 0.32, roughness: 0.3 }));
      globe.position.y = 0.66; globe.castShadow = false; lamp.add(globe);
      lamp.position.copy(top);
      add(lamp);
      const nl = new THREE.PointLight(0xffa25a, 12, 9, 2);
      nl.position.copy(top).add(V3(0, 0.66, 0));
      root.add(nl);
    }
    // gas sconces: flanking the front door and the music-room doors, plus one on the gallery
    const sconceLights = [];
    const sconceAt = (wall, along, y, light = true) => {
      const s = buildSconce(ctx, { brass: mat.brass, shadeMat: mat.shade, arms: 2 });
      s.position.set(along, y, 0.02);
      walls[wall].group.add(s);
      if (light) {
        const wp = new THREE.Vector3(along, y + 0.12, 0.3).applyMatrix4(walls[wall].group.matrixWorld.compose(walls[wall].group.position, walls[wall].group.quaternion, walls[wall].group.scale));
        const l = new THREE.PointLight(0xffa860, 6.5, 8, 2);
        l.position.copy(wp);
        root.add(l);
        sconceLights.push(l);
      }
      return s;
    };
    sconceAt('front', 6 - 2.25, 2.2); sconceAt('front', 6 + 2.25, 2.2);
    sconceAt('back', lx.back(-3.3) - 0.0, 2.4, false);
    sconceAt('back', lx.back(DOORS.music.x) + 1.35, 2.4);
    sconceAt('left', lx.left(DOORS.dining.z) + 1.35, 2.4);
    // a lone sconce on the curved stair wall, half way up
    {
      const a = -(5.5 - STAIR.straight) / STAIR.R, y = pitchY(5.5) + 1.55;
      const s = buildSconce(ctx, { brass: mat.brass, shadeMat: mat.shade, arms: 2 });
      s.position.set(STAIR.cx + Math.cos(a) * (CURVE_R - 0.02), y, STAIR.cz + Math.sin(a) * (CURVE_R - 0.02));
      s.lookAt(STAIR.cx, y, STAIR.cz);
      add(s);
      const l = new THREE.PointLight(0xffa860, 6.5, 8, 2);
      l.position.set(STAIR.cx + Math.cos(a) * (CURVE_R - 0.35), y + 0.12, STAIR.cz + Math.sin(a) * (CURVE_R - 0.35));
      root.add(l); sconceLights.push(l);
    }
    // a second sconce over the straight flight, between the first two ancestors
    {
      const sz = STAIR.z0 - 1.75, y = pitchY(1.75) + 1.55;
      const s2 = buildSconce(ctx, { brass: mat.brass, shadeMat: mat.shade, arms: 2 });
      s2.position.set(lx.right(sz), y, 0.02); walls.right.group.add(s2);
      const l = new THREE.PointLight(0xffa860, 6.5, 8, 2); l.position.set(X1 - 0.32, y + 0.12, sz); root.add(l); sconceLights.push(l);
    }
    // the clock face catches the sconce beside it
    {
      const cs = new THREE.SpotLight(0xffb070, 5, 4, 0.32, 0.6, 2);
      cs.position.set(X0 + 0.55, 2.55, -2.95); cs.target.position.set(X0 + 0.3, 1.9, -3.75);
      root.add(cs, cs.target);
    }
    ctx.onUpdate((dt, t) => sconceLights.forEach((l, i) => { l.intensity = 6.5 * (0.97 + 0.03 * Math.sin(t * (8.3 + i) + i * 2.1)); }));

    // ================================================================ rug runner from the door
    {
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.4), mat.rug);
      rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, 4.55);
      add(rug, { cast: false });
    }

    // ================================================================ the puzzle
    const puzzleHide = [];   // atmosphere that only adds speckle when looking straight down at the board
    const web = createWebPuzzle(ctx, {
      onView: (on) => puzzleHide.forEach((o) => { o.visible = !on; }),
      root, center: MED, radius: MED_R, pointsR: MED_PR,
      materials: { brass: mat.brass, spider: mat.spider, spiderLeg: mat.spiderLeg, mark: mat.mark, spiderGeo: spiderGeometry(G) },
      grade: ROOM_GRADE,
      onSolved: async (p) => {
        rekindle(true);
        await p.say?.({ text: 'Clever. But a web is only the *beginning* of a spider’s hospitality.', speaker: 'stauf', speakerName: 'Stauf' });
      },
    });
    const rekindle = (instant) => {
      gutter(true);
      chandBase = 85;
      ctx.state.set('foyer.chandelierLit', true);
      if (!instant) ctx.post?.set?.({ exposure: 1.2 }, 1.5);
    };
    if (ctx.state.isSolved(WEB_ID)) { web.applySolved(); rekindle(true); }

    // ================================================================ ghost on the stair
    const ghostMat = fx.ghostMaterial({ color: 0x86a6ff, rimColor: 0xdbe6ff, opacity: 0.38, intensity: 1.1, dissolveY: 0.45, dissolveSoft: 0.7 });
    const ghost = new THREE.Mesh(G.latheFromProfile([
      [0.0, 1.66], [0.055, 1.65], [0.09, 1.6], [0.1, 1.53], [0.09, 1.46], [0.06, 1.41], [0.055, 1.36], [0.15, 1.31], [0.19, 1.24], [0.18, 1.12],
      [0.14, 1.0], [0.15, 0.92], [0.22, 0.7], [0.3, 0.4], [0.38, 0.05], [0.4, 0.0],
    ], 40), ghostMat);
    const gS = 5.1, gp = stairXZ(gS, 0.25);
    ghost.position.set(gp.x, pitchY(gS) - STAIR.h * 0.5 - 0.05, gp.y);
    ghost.renderOrder = 7; ghost.name = 'ghost';
    root.add(ghost);
    // she is only glimpsed: a slow, rare apparition (fully gone most of the time, and in stills)
    let ghostHold = 0;
    ctx.onUpdate((dt, t) => {
      ghost.position.y = pitchY(gS) - STAIR.h * 0.5 - 0.05 + Math.sin(t * 0.7) * 0.03; ghost.rotation.y = 2.2 + Math.sin(t * 0.25) * 0.25;
      if (ghostHold > 0) { ghostHold -= dt; ghostMat.uniforms.uOpacity.value = 0.9; ghost.visible = true; return; }
      const cyc = Math.max(0, Math.sin(t * 0.21 - 1.2)) ** 6;
      ghostMat.uniforms.uOpacity.value = 0.36 * cyc;
      ghost.visible = cyc > 0.02;
    });

    // ================================================================ moonlight
    const winC = V3(0, WIN.great.y + 1.4, Z1);
    // the moon is the key: one shadowed spot through the great window, fanlight and sidelights.
    // Its cookie is rendered from the glass itself (see buildCookie), so the leaded colours fall on the floor.
    const moon = new THREE.SpotLight(0xb4c4ff, 26000, 44, 0.3, 0.12, 2);
    moon.position.set(-1.6, 12.6, 15.6);
    moon.target.position.set(-0.25, 0, 1.4);
    moon.castShadow = Q.shadows;
    moon.shadow.mapSize.set(Q.shadowMapSize, Q.shadowMapSize);
    moon.shadow.bias = -0.0003; moon.shadow.normalBias = 0.03; moon.shadow.radius = Q.shadowRadius;
    moon.shadow.camera.near = 6; moon.shadow.camera.far = 40;
    root.add(moon, moon.target);
    // the faintest cool ambient so nothing is pure black, desaturated so it never tints the walnut pink
    const fill = new THREE.HemisphereLight(0x2a3350, 0x0e0a07, 0.12);
    root.add(fill);
    root.add(fx.areaLight({ center: [0, WIN.great.y + 1.3, Z1 - 0.05], normal: [0, -0.35, -1], width: WIN.great.w, height: WIN.great.h, color: 0x8ea6ff, intensity: 6.0 }));
    root.add(fx.areaLight({ center: [0, 1.6, Z1 - 0.05], normal: [0, -0.1, -1], width: 3.0, height: 3.2, color: 0x7f95e8, intensity: 0.7 }));
    root.add(fx.areaLight({ center: [X0 + 0.05, WIN.westY + 1.3, 0.8], normal: [1, -0.3, 0], width: 6.0, height: 2.4, color: 0x7d93e6, intensity: 2.4 }));
    // bounce off the moonlit pool on the marble: soft cool up-light on the gallery soffit, columns and stair string
    root.add(fx.areaLight({ center: [0.2, 0.05, -0.4], normal: [0, 1, 0], width: 3.2, height: 3.0, color: 0x8c93b0, intensity: 2.4 }));

    const beamDir = new THREE.Vector3().subVectors(moon.target.position, moon.position).normalize();
    const shaft = fx.shaft({
      center: V3(0, WIN.great.y + 1.25, Z1 - 0.02), right: V3(WIN.great.w / 2 - 0.05, 0, 0), up: V3(0, WIN.great.h / 2 - 0.05, 0),
      direction: beamDir, length: 11.5, color: 0xa3b4ff, intensity: Number(ctx.params.get('shaft') || 0.09), softness: 0.35, falloff: 0.55, panes: [4, 5], mullion: 0.02, noise: 0.7,
    });
    root.add(shaft);
    const fanShaft = fx.shaft({
      center: V3(0, DOORS.front.h + 0.25, Z1 - 0.02), right: V3(0.85, 0, 0), up: V3(0, 0.3, 0),
      direction: beamDir, length: 4.5, color: 0xb8a8ff, intensity: 0.35, softness: 0.45, falloff: 0.9, panes: [6, 1], mullion: 0.03, noise: 0.6,
    });
    root.add(fanShaft);
    // the clerestory windows on the west wall throw long slanted beams across the hall
    const westDir = V3(0.78, -0.52, -0.34).normalize();
    const westCookie = fx.windowCookie({ cols: 3, rows: 4, arch: true });
    const westShafts = WIN.west.map((wi, wIdx) => {
      const sh = fx.shaft({
        center: V3(X0 + 0.02, WIN.westY + WIN.westH * 0.42, wi.z), right: V3(0, 0, -(WIN.westW / 2 - 0.05)), up: V3(0, WIN.westH * 0.42, 0),
        direction: westDir, length: 9.5, color: 0x9fb2ff, intensity: Number(ctx.params.get('wshaft') || 0.13), softness: 0.3, falloff: 0.9, panes: [3, 4], mullion: 0.025, noise: 0.75,
      });
      root.add(sh);
      // matching unshadowed moon spot so the leaded panes land on the floor
      const c = V3(X0 - 0.3, WIN.westY + WIN.westH * 0.42, wi.z);
      // the southern clerestory throws a cool, leaded pool across the hall towards the stair (shadowed so the gallery blocks it)
      const sp = new THREE.SpotLight(0xa3b6ff, 5200, 30, 0.27, 0.25, 2);
      sp.position.copy(c).addScaledVector(westDir, -4);
      sp.target.position.copy(c).addScaledVector(westDir, 12);
      sp.map = westCookie;
      if (wIdx === 1 || ctx.params.get('wspot')) {
        sp.castShadow = Q.shadows;
        sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0005; sp.shadow.normalBias = 0.03; sp.shadow.camera.near = 2; sp.shadow.camera.far = 30;
        root.add(sp, sp.target);
      }
      return sh;
    });
    const dustFx = fx.dust({ box: new THREE.Box3(V3(-5.6, 0.2, -4), V3(2.6, 7.5, 6.8)), count: 3600, shafts: [shaft, ...westShafts.slice(0, 2), fanShaft].slice(0, 4), size: 0.012, intensity: 2.4, ambient: 0.04 });
    root.add(dustFx); puzzleHide.push(dustFx);
    const floorFog = fx.fog({ box: new THREE.Box3(V3(X0 + 0.3, 0, -6.5), V3(X1 - 0.3, 0.6, 6.5)), color: 0x0a0f1c, litColor: 0x2c3a5c, density: 0.14, heightFalloff: 5 });
    root.add(floorFog); puzzleHide.push(floorFog);

    // ================================================================ navigation
    const stairPath = [0.4, 1.6, 2.8, 3.8, 4.8, 5.8, 6.8, 7.8, 8.6].map((s) => stairEye(s, 0.05));
    const nodes = {
      main: { position: [-0.35, 1.6, 6.45], target: [0.65, 3.65, -6], fov: 64, label: 'The Grand Foyer', look: { yaw: [-55, 55], pitch: [-28, 38] }, grade: NODE_BASE },
      center: { position: [-1.25, 1.62, 2.55], target: [-0.2, 2.25, -7], fov: 58, label: 'The gallery', look: { yaw: [-45, 45], pitch: [-25, 35] }, grade: NODE_BASE },
      center_w: { position: [-1.25, 1.62, 2.55], target: [-6, 1.75, -1.6], fov: 56, label: 'The dining-room doors', grade: NODE_BASE },
      center_e: { position: [-1.25, 1.62, 2.55], target: [6, 1.9, 3.0], fov: 56, label: 'The library doors', grade: NODE_BASE },
      center_s: { position: [-1.25, 1.62, 2.55], target: [0.0, 2.7, 7], fov: 58, label: 'The front door', look: { yaw: [-45, 45], pitch: [-20, 40] }, grade: NODE_BASE },
      stairs: { position: [3.25, 1.62, 3.65], target: [4.9, 3.0, -2.6], fov: 58, label: 'The staircase', look: { yaw: [-60, 50], pitch: [-25, 40] }, grade: { ...NODE_BASE, exposure: 1.3 } },
      landing: { position: [-1.3, UF + 1.62, -4.5], target: [-0.4, 3.3, 6], fov: 60, label: 'The gallery landing', look: { yaw: [-60, 60], pitch: [-40, 30] }, grade: { ...NODE_BASE, godRayWeight: 0 } },
      landing_n: { position: [-1.3, UF + 1.62, -4.5], target: [-2.6, UF + 1.85, -7], fov: 58, label: 'The portrait', grade: NODE_BASE },
    };
    const edges = [
      ['main', 'center', [[-0.9, 1.62, 4.2]]],
      ['main', 'stairs', [[1.4, 1.62, 4.8]]],
      ['center', 'center_w'], ['center', 'center_e'], ['center_w', 'center_s'], ['center_e', 'center_s'],
      ['center', 'center_s', null, { hidden: true }],
      ['center_s', 'main', null, { hotspot: { main: { position: [-0.45, 1.3, 5.2], radius: 0.6 } } }],
      ['center_e', 'stairs', [[1.2, 1.62, 3.6]]],
      ['stairs', 'landing', [...stairPath, [0.9, UF + 1.62, -4.95]], { duration: 7.5 }],
      ['landing', 'landing_n'],
    ];
    const exits = [
      { node: 'center_s', toRoom: 'exterior', toNode: null, label: 'The front door', hotspot: { box: { min: [-0.95, 0.1, 6.55], max: [0.95, 2.9, 7.1] } } },
      { node: 'center_w', toRoom: 'dining', toNode: null, label: 'The dining room', hotspot: { box: { min: [-6.15, 0.1, DOORS.dining.z - 0.85], max: [-5.6, 2.9, DOORS.dining.z + 0.85] } } },
      { node: 'center_e', toRoom: 'library', toNode: null, label: 'The library', hotspot: { box: { min: [5.6, 0.1, DOORS.library.z - 0.75], max: [6.15, 2.9, DOORS.library.z + 0.75] } } },
      { node: 'center', toRoom: 'music', toNode: null, label: 'The music room', hotspot: { box: { min: [DOORS.music.x - 0.85, 0.1, Z0 - 0.1], max: [DOORS.music.x + 0.85, 2.9, Z0 + 0.45] } } },
      { node: 'center', toRoom: 'kitchen', toNode: null, label: 'The kitchen passage', hotspot: { box: { min: [DOORS.kitchen.x - 0.55, 0.1, Z0 - 0.1], max: [DOORS.kitchen.x + 0.55, 2.5, Z0 + 0.45] } } },
      { node: 'landing_n', toRoom: 'gallery', toNode: null, label: 'The upstairs hall', hotspot: { box: { min: [X0 - 0.1, UF, DOORS.gallery.z - 0.6], max: [X0 + 0.45, UF + 2.5, DOORS.gallery.z + 0.6] } } },
    ];

    // ================================================================ hotspots
    const hotspots = [
      { id: 'web', nodes: ['main', 'center', 'center_s'], box: { min: [MED.x - MED_R, -0.05, MED.z - MED_R], max: [MED.x + MED_R, 0.2, MED.z + MED_R] }, cursor: 'puzzle', label: "Stauf's Web", puzzle: web.puzzle },
      {
        id: 'portrait', nodes: ['landing_n', 'center', 'landing'], object: portrait, cursor: 'talk', label: 'The portrait',
        onActivate: async () => {
          ctx.audio.sfx('laugh');
          await ctx.say({ text: 'Do come up. The house has been *expecting* you — and the house is very hungry.', speaker: 'stauf', speakerName: 'Stauf' });
        },
      },
      {
        id: 'clock', nodes: ['center_w', 'center', 'main'], object: clock, cursor: 'examine', label: 'The long-case clock',
        onActivate: async () => {
          ctx.audio.chimeClock?.(3);
          ctx.ui.caption('Its pendulum swings, yet the hands stand at a quarter to midnight. They have stood there a very long time.', { title: 'The Clock' });
        },
      },
      {
        id: 'chandelier', nodes: ['landing', 'main'], sphere: { center: [MED.x, H - 2.55, MED.z], radius: 1.0 }, cursor: 'examine', label: 'The chandelier',
        onActivate: () => ctx.ui.caption(ctx.state.has('foyer.chandelierLit') ? 'Every candle burns now, and not one of them is getting shorter.' : 'Half its candles have guttered. The other half burn without a breath of draught to bend them.', { title: 'The Chandelier' }),
      },
      {
        id: 'invitation', nodes: ['center_s'], position: [X0 + 0.3, 0.9, 5.05], radius: 0.35, cursor: 'examine', label: 'A card on a salver',
        onActivate: () => { ctx.audio.sfx('page'); ctx.ui.caption('“You are cordially invited. Bring nothing. You will be given *everything*.” — H.S.', { title: 'The Invitation' }); },
      },
      {
        id: 'ghost', nodes: ['main', 'stairs', 'center_e'], sphere: { center: [gp.x, pitchY(gS) + 0.6, gp.y], radius: 0.5 }, cursor: 'ghost', label: 'A pale figure',
        onActivate: () => ctx.cinematic(async (c, h) => {
          ctx.post.set({ saturation: 0.55, vignette: 0.6 }, 0.8);
          ghostHold = 9;
          await ctx.nav.lookAt(new THREE.Vector3(gp.x, pitchY(gS) + 1.2, gp.y), 1.2);
          await ctx.say({ text: 'Don’t go up. Every guest who went up the stairs thought they would come back down.', speaker: 'guest', speakerName: 'A woman’s voice' });
          await h.wait(0.4);
          ctx.post.reset(1.2);
          await ctx.nav.returnToNode(1.0);
        }),
      },
    ];

    // ================================================================ QA / debug hooks
    if (typeof window !== 'undefined') {
      const dbg = (window.__debug ||= {});
      dbg.solvers ||= {};
      dbg.states ||= {};
      dbg.solvers.foyer = async () => {
        const game = window.__game;
        if (game && !game.puzzle && game.room?.mod?.id === 'foyer') {
          game.startPuzzle(web.puzzle);
          await new Promise((r) => setTimeout(r, 50));
        }
        if (game?.puzzle?.def?.id === WEB_ID) { web.puzzle.autoSolve(game.puzzle.pctx); return true; }
        web.applySolved(); rekindle(true); ctx.state.markSolved?.(WEB_ID);
        return true;
      };
      dbg.states.foyer = () => ({ ...web.getState(), isSolved: ctx.state.isSolved(WEB_ID), chandelierLit: !!ctx.state.get('foyer.chandelierLit') });
      dbg.solve ||= (id) => (dbg.solvers[id] ? dbg.solvers[id]() : Promise.reject(new Error(`no solver for ${id}`)));
      dbg.state ||= (id) => (dbg.states[id] ? dbg.states[id]() : null);
      dbg.foyer = { web, tryMove: web.tryMove, reset: web.resetState };
    }

    // ---------------------------------------------------------------- moon cookie from the stained glass
    // Render every moonlit pane from the moon's own shadow camera; the result is the SpotLight.map, so the
    // leaded pattern (amber star, oxblood border, pale quarries, sunburst fanlight) lands on floor and stair.
    {
      root.updateMatrixWorld(true);
      const scene = new THREE.Scene();
      const axis = new THREE.Vector3().subVectors(moon.target.position, moon.position).normalize();
      let maxAng = 0;
      const tmp = new THREE.Vector3();
      for (const src of cookieSources) {
        const m = new THREE.Mesh(src.mesh.geometry, new THREE.MeshBasicMaterial({ map: src.map, color: new THREE.Color(src.gain, src.gain, src.gain), side: THREE.DoubleSide, toneMapped: false }));
        m.matrixAutoUpdate = false; m.matrix.copy(src.mesh.matrixWorld);
        scene.add(m);
        const pos = src.mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          tmp.fromBufferAttribute(pos, i).applyMatrix4(src.mesh.matrixWorld).sub(moon.position).normalize();
          maxAng = Math.max(maxAng, Math.acos(THREE.MathUtils.clamp(tmp.dot(axis), -1, 1)));
        }
      }
      moon.angle = Math.min(0.6, maxAng + 0.02);
      const cam = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(moon.angle) * 2, 1, 0.5, 60);
      cam.position.copy(moon.position); cam.lookAt(moon.target.position); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      const size = Q.shadowMapSize >= 2048 ? 2048 : 1024;
      const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
      const r = ctx.renderer;
      const prevT = r.getRenderTarget(), prevC = r.getClearColor(new THREE.Color()), prevA = r.getClearAlpha();
      r.setRenderTarget(rt); r.setClearColor(0x000000, 1); r.clear(); r.render(scene, cam);
      r.setRenderTarget(prevT); r.setClearColor(prevC, prevA);
      scene.traverse((o) => { if (o.isMesh) o.material.dispose(); });
      moon.map = rt.texture;
      moon.penumbra = 0.02;
    }

    // ---------------------------------------------------------------- shadow flags
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      const fxLike = o.isPoints || m?.isShaderMaterial || m?.isMeshBasicMaterial || (m?.transparent && (m.opacity ?? 1) < 0.6) || o.userData.noBake;
      o.castShadow = !o.userData.noShadow && !fxLike;
      o.receiveShadow = !m?.isShaderMaterial && !m?.isMeshBasicMaterial;
    });

    const godRays = [
      { position: V3(0, WIN.great.y + 1.3, Z1 + 0.6), color: new THREE.Color(0.72, 0.78, 1.0), strength: 0.9, radius: 0.24 },
    ];

    return {
      scene: root,
      nodes, edges, exits, hotspots, godRays,
      start: 'main',
      grade: ROOM_GRADE,
      environment: { position: [0, 2.2, 3.4], intensity: 0.85 },
      onArrive(id) {
        // the engine blends node grades over time; stills (dt = 0) need them applied at once
        if (ctx.shot && nodes[id]?.grade) ctx.post.set(nodes[id].grade, 0);
      },
      onEnter(c) {
        if (!ctx.state.has('foyer.greeted')) {
          ctx.state.set('foyer.greeted', true);
          setTimeout(() => ctx.say({ text: 'Welcome, my guest. Make yourself at *home* — you will be here a long, long time.', speaker: 'stauf', speakerName: 'Stauf' }), 1800);
        }
      },
      update() {},
    };
  },
};
