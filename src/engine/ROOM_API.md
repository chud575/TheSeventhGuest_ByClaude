# Room API — the contract between the engine and every room

Each room lives in `src/rooms/<roomId>/index.js` and is discovered automatically
(`import.meta.glob`). Everything under `src/rooms/<roomId>/**` and
`public/assets/<roomId>/**` belongs to that room. **Never edit `src/engine/**` or
another room** — list engine needs as `engineRequests`, or add a shared helper as
`src/engine/lib/contrib/<roomId>-<name>.js`.

Reference implementations: `src/rooms/_sandbox` (everything: mouldings, moonlight,
volumetrics, candles, ghost, hotspots, puzzle, cinematic, exit) and
`src/rooms/_materials` (gallery of every procedural material).

---

## 1. Module shape

```js
import * as THREE from 'three';

export default {
  id: 'library',                       // must equal the folder name
  title: 'The Library',                // shown on the title card, map, saves
  floorName: 'Ground Floor',           // small caption above the title card
  map: { floor: 'ground', rect: [x, y, w, h] },   // map placement, 1000x640 canvas; floors in src/engine/config.js
  start: 'door',                       // default node when entering without a node
  ambience: { wind: 0.4, creaks: 0.5, clock: 0.6, thunder: 0.3, rain: 0, heartbeat: 0, roomTone: 0.3 },
  music: true,                         // or false, or { key: 50, mood: 'dread' }
  puzzles: [                            // static metadata (Book of Hints lists these)
    { id: 'library.telescope', title: 'The Telescope', description: '…', hints: ['…', '…', '…'] },
  ],

  async build(ctx) {
    const root = new THREE.Group();
    // … build the room into `root` …
    return {
      scene: root,                     // THREE.Group added to the engine scene
      nodes,                           // { id: { position, target, fov?, look?, label?, grade?, dof? } }
      edges,                           // [[a, b, pathPoints?, options?], …]
      exits,                           // [{ node, toRoom, toNode, label?, hotspot?, enabled?(state) }]
      hotspots,                        // [{ id, node|nodes, object|box|sphere|position+radius, cursor, label, onActivate | puzzle }]
      godRays,                         // [{ position: Vector3, color: Color, strength, radius }] screen-space ray sources (windows)
      grade,                           // post/colour-grade overrides (see §6)
      environment,                     // { position: [x,y,z], intensity, size? } bake an IBL probe from the room itself
      start,                           // optional override of the start node
      update(dt, t) {},                // per frame (t = engine time, fixed in shot mode)
      onArrive(nodeId, prevId) {},     // optional
      onDepart(fromId, toId) {},       // optional
      onEnter(ctx) {},                 // optional: after the room is visible (not called in shot mode)
      dispose() {},                    // optional: engine already disposes geometries/materials in `scene`
    };
  },
};
```

### Nodes (camera viewpoints)
```js
nodes = {
  door:   { position: [0, 1.6, 4], target: [0, 1.4, 0], fov: 55, label: 'Doorway' },
  table:  { position: [1, 1.5, 1], target: [0, 0.8, 0], fov: 50, look: { yaw: [-50, 50], pitch: [-30, 25] } },
  turned: { position: [0, 1.6, 4], target: [4, 1.5, 4] },   // same position, other direction = turn-in-place node
};
```
* `position`/`target` are arrays or `Vector3`, metres, Y up. Eye height ≈ 1.55–1.65 m.
* `fov` = vertical degrees (default = player setting, 55). `look` limits free-look (degrees, defaults yaw ±40, pitch −24…22).
* `grade` = per-node post overrides blended in on arrival; `dof: { focus, aperture, maxBlur }` or `null`.

### Edges (cinematic glides)
```js
edges = [
  ['door', 'table', [[0.8, 1.6, 2.6]]],                       // via a waypoint (spline is centripetal Catmull-Rom)
  ['door', 'turned'],                                          // turn in place (slerp)
  ['table', 'window', null, { duration: 2.5, oneWay: true }],
  ['door', 'hall', null, { hotspot: { hall: { box: { min: [...], max: [...] } }, door: { position: [...], radius: 0.6 } } }],
  ['a', 'b', null, { hidden: true }],                          // no click target; reachable via ctx.nav.goTo only
];
```
Glides ease in/out, look ahead along the path, add subtle head-bob/sway (off with
*Reduce motion*, which turns glides into ink-bleed dissolves). Speed ≈ 1.55 m/s ×
player setting; Space/click skips. A **move hotspot** is created automatically for
each edge: a sphere at the destination node (or 2.2 m along its view direction for
turn nodes). Override per destination with `options.hotspot`.

### Exits
`{ node: 'door', toRoom: 'foyer', toNode: 'stairs', label: 'To the foyer', hotspot: { box: { min, max } } }`.
If the target room does not exist yet the player is told the door is locked.

### Hotspots
```js
{ id: 'globe', nodes: ['desk'], object: globeMesh, cursor: 'examine', label: 'A globe',
  onActivate: async (ctx, hs) => ctx.ui.caption('…', { title: 'The Globe' }) }
{ id: 'ghost1', node: 'door', sphere: { center: [0, 1.4, 0], radius: 0.5 }, cursor: 'ghost', onActivate: () => ctx.cinematic(async (c, h) => { … }) }
{ id: 'puzzle', nodes: ['table'], box: { min: [...], max: [...] }, cursor: 'puzzle', puzzle: myPuzzle }
```
Shapes: `object` (raycast against meshes, recursive), `box`/`bbox` (`Box3` or `{min,max}`),
`sphere` (`Sphere` or `{center,radius}`) or `position` + `radius`. `enabled: () => bool`
hides it dynamically. `priority` (default 1 for room hotspots) breaks ties. Nearest hit wins.

Cursors: `default`, `move` (beckoning skeletal hand), `examine` (eye), `ghost`
(theatre masks), `talk` (chattering teeth), `puzzle` (pulsing brain), `grab`, `wait`, `back`.
Hold **Tab** to reveal hotspots (markers + labels); **Q/E** cycle; **Enter** uses.

---

## 2. `ctx` reference

| member | what it is |
|---|---|
| `ctx.THREE` | three.js namespace |
| `ctx.renderer`, `ctx.camera`, `ctx.scene` | engine renderer, the single camera, root scene (add only to your own group) |
| `ctx.quality` | active preset: `{ name, textureSize, shadows, shadowMapSize, shadowRadius, particles, volumetricSteps, envBake, … }` — scale your effort with it |
| `ctx.materials` | `MaterialLibrary` (§3): `create(name, opts)`, `textures(name, opts)`, `basic(kind, opts)` |
| `ctx.textures` / `ctx.forge` | `TextureForge`: `generate(key, { glsl, size, aspect, tile, uniforms, normalStrength })`, `canvas(key, w, h, draw)` |
| `ctx.fx` | FX factory (§4): `candle`, `flame`, `shaft`, `dust`, `fog`, `ghostMaterial`, `areaLight`, `windowCookie`, `onUpdate` |
| `ctx.geometry` | geometry helpers (§5) |
| `ctx.audio` | `sfx(name)`, `say(line)`, `creak()`, `thunder()`, `bell(f)`, `chimeClock(n)`, `setAmbience({...})`, `play(url,{bus,loop})`, `duck()` |
| `ctx.ui` | `caption(text,{title,duration})`, `toast(text)`, `subtitle(line,sec)`, `titleCard(small,big)`, `letterbox(on)`, `setCursor(type)` |
| `ctx.say(line)` | Stauf (default) speaks with subtitles + placeholder murmur: `'text'` or `{ text, speaker, speakerName, url, duration }`. `*word*` = emphasis |
| `ctx.cinematic(async (ctx, { wait, skipped }) => {…})` | letterboxed, input-locked, skippable sequence |
| `ctx.nav` | `goTo(node)`, `jumpTo(node)`, `flyTo({position,target,fov}, sec)`, `returnToNode(sec)`, `lookAt(vec3, sec)`, `current`, `moving`, `lock()/unlock()` |
| `ctx.hotspots` | `add(h)`, `remove(id)`, `refresh()` |
| `ctx.puzzles` | `start(puzzle)`, `isSolved(id)` |
| `ctx.state` | flags `get/set/has/toggle/inc`, inventory `addItem/removeItem/hasItem`, `isSolved`, `visitedRooms` — all saved |
| `ctx.post` | `set(gradeParams, blendSeconds)`, `reset(sec)`, `godRaySources` (array) |
| `ctx.addGodRay(src)` | push a screen-space god-ray source |
| `ctx.bakeEnvironment(position, { intensity, size })` | re-bake the IBL probe (e.g. after lights change) |
| `ctx.random` | seeded `Random` (`next`, `range`, `int`, `pick`, `chance`, `gauss`, `fork(name)`) — **never use Math.random** (shots must be deterministic) |
| `ctx.time` | `{ value }` shared shader time uniform (fixed in shot mode) |
| `ctx.onUpdate(fn)` | per-frame callback `(dt, t)`, auto-cleared when the room unloads |
| `ctx.assetUrl(path)` | `./assets/<roomId>/<path>` (files in `public/assets/<roomId>/`) |
| `ctx.loadTexture(url, { srgb, repeat })` | texture loader with sane defaults |
| `ctx.goToRoom(room, node)` | scripted room change |
| `ctx.params`, `ctx.shot` | URL params; `true` when rendering for the screenshot harness |

---

## 3. Materials (`ctx.materials`)

All textures are generated on the GPU (albedo + normal + ORM), read back once and cached,
so clones with different `repeat` share memory. Preview them all:
`npm run shot -- --room _materials --node all --out review/materials.png` (close-ups `t0`…`t34`).

```js
const M = ctx.materials;
M.create('damask', { repeat: [1.9, 1.9], base: [0.12,0.165,0.38], motif: [0.17,0.225,0.47], sheen: 0.6, variant: 0|1 });
M.create('parquet', { species: 'oak'|'walnut'|…, ratio: 5, planksAcross: 2, polish, wear, repeat });   // herringbone
M.create('floorboards', { repeat });  M.create('wood', { species, boards, boardLength, polish, wear, figure, tint });
M.create('mahogany'|'walnut'|'ebony', { repeat });     // polished furniture woods (clearcoat)
M.create('rug', { palette: 'heriz'|'tabriz'|'kashan'|'faded', colors: {field,border,ivory,gold,teal,dark,rose}, aspect: w/l, knots: 220, wear, fringe: 0..0.06, seed });  // one texture = one rug
M.create('gilded', { pattern: 0..6, repeats, wear, dirt, ground: 0|1, groundColor });  // 0 egg&dart 1 scroll 2 rosette 3 bead&reel 4 plain 5 fluted 6 anthemion
M.create('gold', {});  // plain worn gilt (frames, rails)
M.create('marble', { type: 'carrara'|'nero'|'verde'|'rosso'|'siena', polish });  M.create('checker', { tiles, a, b, diagonal });
M.create('plaster', { color, cracks, stains });  M.create('stone', { rows, cols, moss, damp });  M.create('brick', { rows, cols, soot });
M.create('velvet', { color, crush, pattern });  M.create('leather', { color, wear, buttons: 1 });
M.create('brass', { tarnish, polish });  M.create('glass', { dirt, opacity });  M.create('wax', { color, drips });
M.create('books', { count, palette, fill, cutout, seed });   // shelf of spines, V = shelf height
M.create('painting', { subject: 0 landscape|1 portrait|2 seascape|3 still life, seed, aspect, varnish, cracks, size: 1024 });
M.basic('porcelain'|'crystal'|'silver'|'gold'|'iron'|'black'|'bone'|'cloth'|'emissiveWarm'|'emissiveMoon', overrides);
```
Common options for `create`: `repeat [x,y]`, `rotation`, `offset`, `color` (multiplier),
`roughness`/`metalness` (multipliers), `normalScale`, `envMapIntensity`, `side`,
`transparent`, `opacity`, `alphaTest`, `emissive`, `emissiveIntensity`, `macro` (world-space
anti-tiling variation 0..1), `size` (texture px), plus physical params
(`clearcoat`, `clearcoatRoughness`, `sheen`, `sheenRoughness`, `sheenColor`, `transmission`, `ior`, …).
Geometry helpers produce UVs **in metres**, so `repeat = 1 / tileSizeInMetres`.

Custom textures: `ctx.textures.generate('myroom:thing', { size: 1024, glsl: 'void surface(vec2 uv, inout Surface s) { … }', uniforms: { uColor: [1,0,0] } })`.
The GLSL library (`src/engine/materials/glsl/common.js`) provides tileable `fbm/gnoise/vnoise/voronoi/ridged`, SDFs
(`sdCircle, sdBox, sdVesica, sdArc, sdStar, sdEllipse, sdRhombus, polarRep, smin`) and helpers (`fill, stroke, domeh, rot2`).
Write `s.albedo` in **sRGB** (0..1), `s.height` 0..1 (normal map is derived), `s.rough`, `s.metal`, `s.ao`, `s.alpha`.

---

## 4. FX (`ctx.fx`)

```js
const candle = ctx.fx.candle({ height: 0.22, radius: 0.011, lit: true, light: true, lightIntensity: 1.2, castShadow: false, seed });
// -> Group (origin = base); userData { flame, light, body }. Flame + light flicker in sync.
const flame = ctx.fx.flame({ height: 0.05, width: 0.012, intensity: 9 });       // bare flame (lamps, fireplaces: use several)
const shaft = ctx.fx.shaft({ center, right, up, direction, length: 4, color: 0x9fb6ff, intensity: 0.3, panes: [2,3], mullion: 0.035 });
const dust  = ctx.fx.dust({ box: new THREE.Box3(min, max), count: 2000, shafts: [shaft], size: 0.011, intensity: 2 });  // motes glow inside shafts
const fog   = ctx.fx.fog({ box, color: 0x0b111e, litColor: 0x31405e, density: 0.5, heightFalloff: 4 });
const mat   = ctx.fx.ghostMaterial({ color, rimColor, opacity, intensity, dissolveY, map, mapStrength });  // any mesh -> apparition
const spill = ctx.fx.areaLight({ center, normal, width, height, color: 0x8ea6ff, intensity: 5 });     // RectAreaLight window spill (no shadows)
const cookie = ctx.fx.windowCookie({ cols: 2, rows: 3 });   // SpotLight.map for window patterns
ctx.fx.onUpdate((dt, t) => { … });
```
FX objects are excluded from environment bakes automatically (`userData.noBake`).

---

## 5. Geometry (`ctx.geometry`)

`boxUV(w,h,d,uvScale)`, `planeUV(w,h,uvScale)`, `applyBoxUVs(geo, scale)`,
`wallWithOpenings(w, h, [{x,y,w,h,arch}], { thickness, uvScale })`,
`sweepProfile(profile2D, path3D, { closed, up, uvScale, flipOutward })` (mitred mouldings),
`PROFILES.crown/baseboard/chairRail/frame`, `frameGeometry(w, h, { width, depth })` (picture frames),
`curtainGeometry({ width, height, folds, depth, pool, tieback, seed })`, `latheFromProfile([[r,y],…])`,
`raisedPanel(w, h, { border, bevel })` (doors, wainscot), `RoundedBoxGeometry`, `mergeGeometries`.
Sweep paths around a room must run counter-clockwise seen from above
(+x along the back wall, then +z …) so the profile faces into the room.

---

## 6. Look: lighting & grade

* Lights are **physical units**: `PointLight`/`SpotLight` intensity in candela (a candle ≈ 1–3 cd
  stylised, gas sconce 3–5 cd, moon spot through a window 800–1500 cd at ~9 m), decay 2.
  Use `castShadow` sparingly: point-light shadows cost 6 renders each. One shadowed moon spot
  + one shadowed candle cluster is a good budget. Hemisphere fill ~0.5–1.2 with deep blue sky colour.
* `environment: { position, intensity }` bakes a PMREM probe *from your room* (great for gilt,
  brass, glass, varnish). Put the probe where it sees the lit room, away from flames.
* Default grade (override any key via `grade` or `ctx.post.set`):
  `exposure 1.0, toneMapping 'aces'|'agx'|'agx-punchy', contrast 1.06, saturation 0.95,
  shadowTint [0.82,0.96,1.18], highlightTint [1.12,1.0,0.84], splitAmount 0.55, vignette 0.38,
  grain 0.035, chromaticAberration 0.0007, bloomStrength 0.42, bloomThreshold 0.92,
  aoIntensity 1, aoRadius 0.35, godRayWeight 0.55, godRayThreshold 1.1, fogDensity 0, dof null`.
* Emissive "HDR" surfaces (window skies, lamp shades) should be > 1.0 to bloom / emit god rays.

---

## 7. Puzzles

```js
export const myPuzzle = {
  id: 'library.telescope', title: 'The Telescope', description: '…', hints: ['…','…','…'],
  camera: { position: [...], target: [...], fov: 40 },  // engine flies here, and back on leave
  async setup(p) {},  update(dt, t, p) {},  teardown(p) {},
  onPointer(type /* down|move|up|wheel */, event, ndc, p) {},   onKey(type, event, p) {},
  cursorAt(ndc, p) { return 'grab' | 'default' | … },
  reset(p) {},  autoSolve(p) { …; p.solve(); },  onSolved(p) {},
};
```
`p` = room ctx + `{ raycast(objects, ndc), solve(), fail(msg), status(text), leave(), setCursor(t) }`.
Puzzles may build their own sub-scene inside the room group (e.g. a board on a table) —
the camera simply flies to it. Solving marks `state.isSolved(id)`, plays a stinger, autosaves.
List `meta` (id/title/description/hints) in the module's `puzzles` array for the Book of Hints;
the third consultation offers "Let the Book solve it" (calls `autoSolve`).

---

## 8. Screenshot harness & review

```
npm run shot -- --room <id> --node <a,b,c> --out review/<id>/{node}.png [--w 1232 --h 928] [--time 2]
                [--quality shot|high|ultra] [--pos x,y,z --target x,y,z --fov 50] [--hotspots] [--screen title|pause|settings|saves|map|hints|puzzle|caption|cursors]
                [--nopost ao,bloom,rays] [--hide FogVolume,DustMotes] [--envi 0.5]
npm run sheet -- --out review/sheet.png --cols 3 a.png b.png c.png
npm run blind -- review/<id>/x.png reference/1.png review/blind/<id> A      # A/B pair for a blind critic
node scripts/variants.mjs --room <id> --node <n> --outdir review/dbg --v "base:" --v "noao:nopost=ao"
npm run build
```
Shots are deterministic (fixed seed + time). SwiftShader renders a typical room in
~20–30 s wall time. Commit only `review/**/final*.png`.
