# The Seventh Guest — an homage

A modern, real-time Three.js homage to Trilobyte's 1993 CD-ROM landmark *The 7th Guest*:
Henry Stauf's haunted mansion, explored node by node through gliding cinematic
fly-throughs, its rooms hiding devilish puzzles and the ghosts of six doomed guests.

The original pre-rendered every camera move as video. Here every glide is rendered
live — same rhythm, same mood — with physically based lighting, procedural PBR
materials, volumetric moonlight, candle flames, dust in the beams, filmic grading
and modern quality-of-life features. **All art, text, music and models are
original and generated from code**; only the *feel*, room archetypes and puzzle
archetypes are borrowed.

## Run

```bash
npm install
npm run dev          # http://127.0.0.1:5173  (?room=_sandbox&node=entry deep-links past the title)
npm run build        # production build in dist/
npm run preview
```

## Controls

| | |
|---|---|
| **Click** | move (beckoning hand), examine (eye), ghost scene (masks), talk (teeth), puzzle (brain) |
| **Drag / Arrows / WASD** | free-look around the current viewpoint |
| **Wheel** | lean in (zoom) |
| **Hold Tab** | reveal every hotspot with labels |
| **Q / E**, **Enter** | cycle hotspots, use the focused one |
| **Space** | skip a glide or a line of dialogue |
| **Backspace** | step back to the previous viewpoint |
| **M / H / Esc** | map of the house / Book of Hints / menu |
| **F5 / F9** | quick save / quick load |
| **Gamepad** | left stick cursor, right stick look, A use, B back, Y hints, Start menu |

Quality of life: autosave + 3 save slots with thumbnails, graduated hints (the third
solves the puzzle), map with fast travel to visited rooms, subtitles, skippable
transitions, reduced-motion mode (dissolves instead of glides), FOV / sensitivity /
invert / cursor size / subtitle size, quality presets with auto-detect and dynamic
resolution.

## Architecture

```
index.html, src/main.js
src/engine/
  Game.js               orchestrator: renderer, room lifecycle, input → actions, saves, puzzles, shot mode
  config.js             title, start room, floors
  core/                 Settings, SaveSystem (localStorage), GameState, Random (seeded), Quality presets,
                        Environment (generated interior IBL + room probe bakes), RoomRegistry (import.meta.glob)
  post/                 PostFX: HDR scene → GTAO → god rays → bloom → DOF/grade/ACES|AgX → SMAA → grain/vignette/CA/dissolve
  materials/            TextureForge (GPU procedural PBR → cached textures), generators (damask, woods, herringbone,
                        Persian rugs, gilded ornament, marble, plaster, velvet, brass, glass, wax, leather, brick,
                        stone, checker, books, oil paintings), MaterialLibrary (+ anti-tiling macro variation)
  fx/                   candle flames + flicker lights, volumetric light shafts, dust motes, fog volumes, ghost shader
  geometry/             metre-UV boxes/planes, walls with openings, mitred profile sweeps (mouldings, frames),
                        curtains, lathes, raised panels
  nav/                  Navigator (node graph, spline glides, head-bob, free-look), Hotspots, Input (mouse/keys/pad)
  audio/                procedural WebAudio: wind, creaks, clock, thunder, rain, heartbeat, music pad, sfx, voice + subtitles
  ui/                   DOM overlay: animated SVG cursors, title, pause, saves, settings, map, Book of Hints, puzzle chrome
  ROOM_API.md           ← the contract for room authors
src/rooms/<roomId>/     one module per room (auto-discovered); _sandbox and _materials are engine references
public/assets/<roomId>/ optional static assets per room
scripts/                shot.mjs (deterministic screenshots), blind.mjs (A/B pairs), sheet.mjs (contact sheets), variants.mjs
reference/              original 1993 frames and modern re-imaginings used as the quality bar
```

Rooms implement `export default { id, title, async build(ctx) → { scene, nodes, edges, exits, hotspots, … } }`.
See [`src/engine/ROOM_API.md`](src/engine/ROOM_API.md).

## Screenshot harness

```bash
npm run shot -- --room _sandbox --node entry --out review/_sandbox/entry.png [--w 1232 --h 928] [--time 2]
npm run blind -- review/_sandbox/entry.png reference/1.png review/blind A
npm run sheet -- --out review/sheet.png a.png b.png c.png
```

The harness starts its own Vite server, renders in headless Chromium with SwiftShader
WebGL (`--use-angle=swiftshader`), waits for `window.__SHOT_READY` and saves a PNG.
Renders are deterministic (fixed seed and time). Set `CHROMIUM_PATH` to override the
browser (defaults to `/opt/pw-browsers/chromium-*/chrome-linux/chrome`).

## Credits

An homage by Claude. *The 7th Guest* is © its respective owners; this project
contains no original game assets.
