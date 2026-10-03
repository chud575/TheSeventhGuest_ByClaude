import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * "The Toymaker's Likeness" — a 4x4 sliding-tile portrait set into the gallery wall.
 * Fifteen lacquered tiles carry pieces of a painted face; one square is empty.
 * Click any tile in line with the gap to slide it (and the tiles between) along.
 * When the face is whole, its eyes kindle and the attic door unlatches.
 *
 * The tiles share one portrait material whose eye overlay reads the GLOBAL image
 * uv, so the assembled face follows the player like the other portraits do.
 */
export const SLIDE_ID = 'gallery.portrait';
export const meta = {
  id: SLIDE_ID,
  title: "The Toymaker's Likeness",
  description: 'A face cut into fifteen pieces and shuffled. Make him whole again, and he may let you pass.',
  hints: [
    'Only a tile beside the empty square can move — though a whole row or column can shuffle along at once.',
    'Work as a carpenter would: finish the top row, then the second. Leave the last two rows for the end and solve them column by column, left to right.',
    'For the final square of a row, park its tile below the gap, slide the row aside, drop it in and slide the row back. The last two tiles of a column are placed as a pair.',
  ],
};

const N = 4;
const SOLVED = Array.from({ length: N * N }, (_, i) => i);   // 15 = gap
const GAP = N * N - 1;

export function createSlidePuzzle(ctx, { material, backMaterial, edgeMaterial, tile = 0.215, pitch = 0.226, random, onSolvedCb, camera }) {
  const group = new THREE.Group();
  group.name = 'slidePuzzle';
  group.userData.dynamic = true;

  // ------------------------------------------------------------ tiles
  const tiles = [];
  const bodyGeo = new RoundedBoxGeometry(tile, tile, 0.028, 3, 0.006);
  for (let id = 0; id < N * N - 1; id++) {
    const r = Math.floor(id / N), c = id % N;
    const t = new THREE.Group();
    t.name = `tile${id}`;
    const body = new THREE.Mesh(bodyGeo, edgeMaterial);
    body.position.z = 0.014;
    body.castShadow = true; body.receiveShadow = true;
    t.add(body);
    // painted face: plane with the tile's sub-rect of the whole image
    const face = new THREE.PlaneGeometry(tile - 0.01, tile - 0.01);
    const uv = face.attributes.uv;
    const inset = 0.005 / (pitch * N);
    const u0 = c / N + inset, u1 = (c + 1) / N - inset;
    const v0 = 1 - (r + 1) / N + inset, v1 = 1 - r / N - inset;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) < 0.5 ? u0 : u1, uv.getY(i) < 0.5 ? v0 : v1);
    const fm = new THREE.Mesh(face, material);
    fm.position.z = 0.0285;
    fm.receiveShadow = true;
    t.add(fm);
    t.userData.id = id;
    tiles.push(t);
    group.add(t);
  }
  // recessed back board the tiles slide on
  const back = new THREE.Mesh(new THREE.BoxGeometry(pitch * N + 0.02, pitch * N + 0.02, 0.012), backMaterial);
  back.position.z = -0.006;
  back.receiveShadow = true;
  group.add(back);

  // ------------------------------------------------------------ state
  let board = SOLVED.slice();
  let moves = 0;
  let animating = 0;
  const saved = ctx.state.get('gallery.tiles');
  if (Array.isArray(saved) && saved.length === N * N && !ctx.state.isSolved(SLIDE_ID)) board = saved.slice();
  else if (!ctx.state.isSolved(SLIDE_ID)) board = scramble(random);

  const cellPos = (i, out = new THREE.Vector3()) => out.set((i % N - (N - 1) / 2) * pitch, ((N - 1) / 2 - Math.floor(i / N)) * pitch, 0);
  const targets = new Map();
  const place = (snap) => {
    board.forEach((id, i) => {
      if (id === GAP) return;
      const t = tiles[id];
      const p = cellPos(i);
      targets.set(t, p);
      if (snap) t.position.copy(p);
    });
  };
  place(true);

  const isSolved = () => board.every((v, i) => v === i);
  const gapIndex = () => board.indexOf(GAP);

  /** Slide the tile at board index i (and any between it and the gap). Returns tiles moved. */
  function slideAt(i) {
    const g = gapIndex();
    const r = Math.floor(i / N), c = i % N, gr = Math.floor(g / N), gc = g % N;
    if (i === g || (r !== gr && c !== gc)) return 0;
    const step = r === gr ? (c < gc ? -1 : 1) : (r < gr ? -N : N);
    let k = g, n = 0;
    while (k !== i) { board[k] = board[k + step]; k += step; n++; }
    board[i] = GAP;
    moves++;
    place(false);
    ctx.state.set('gallery.tiles', board.slice());
    return n;
  }

  function update(dt) {
    let moving = 0;
    const k = 1 - Math.exp(-dt * 16);
    for (const [t, p] of targets) {
      const d = t.position.distanceTo(p);
      if (d > 0.0004) { t.position.lerp(p, Math.min(1, ctx.shot ? 1 : k)); moving++; }
      else t.position.copy(p);
      // a slight lift while moving
      t.position.z = d > 0.002 ? 0.006 : 0;
    }
    animating = moving;
  }

  function tileFromHit(hit) {
    let o = hit?.object;
    while (o && o.userData.id === undefined) o = o.parent;
    return o ? o.userData.id : -1;
  }

  function setSolvedVisual() {
    // drop the missing final piece in from the side: the 16th tile is the toymaker's "signature"
    board = SOLVED.slice();
    place(false);
  }

  // ------------------------------------------------------------ puzzle definition (engine API)
  const puzzle = {
    ...meta,
    camera,
    setup(p) {
      p.status(isSolved() ? 'He is whole.' : 'Slide the pieces until the face is whole.');
    },
    cursorAt(ndc, p) {
      const hit = p.raycast(tiles, ndc)[0];
      if (!hit) return 'default';
      const id = tileFromHit(hit);
      const i = board.indexOf(id), g = gapIndex();
      return (Math.floor(i / N) === Math.floor(g / N) || i % N === g % N) ? 'grab' : 'default';
    },
    onPointer(type, e, ndc, p) {
      if (type !== 'down') return;
      const hit = p.raycast(tiles, ndc)[0];
      const id = tileFromHit(hit);
      if (id < 0) return;
      const n = slideAt(board.indexOf(id));
      if (!n) { p.audio.sfx('click', { freq: 180 }); return; }
      p.audio.sfx('click', { freq: 320 + n * 40 });
      if (isSolved()) { p.status(''); p.solve(); }
      else p.status(`${moves} move${moves === 1 ? '' : 's'}. ${correctCount()} of 15 pieces in place.`);
    },
    reset(p) {
      board = scramble(random);
      moves = 0;
      place(false);
      ctx.state.set('gallery.tiles', board.slice());
      p.status('The pieces shuffle themselves with a dry clatter.');
    },
    autoSolve(p) {
      setSolvedVisual();
      ctx.state.set('gallery.tiles', board.slice());
      p.solve();
    },
    async onSolved(p) {
      await onSolvedCb?.(p);
    },
    solvedDelay: 1.6,
  };

  function correctCount() { let n = 0; board.forEach((v, i) => { if (v !== GAP && v === i) n++; }); return n; }

  return {
    group, tiles, puzzle, update,
    state: () => ({ board: board.slice(), moves, solved: isSolved(), correct: correctCount(), animating }),
    slideAt, isSolved,
    forceSolved() { setSolvedVisual(); place(true); },
    setBoard(b) { board = b.slice(); place(true); },
  };
}

/** Random walk from the solved board (always solvable), never ending solved. */
function scramble(random) {
  const b = SOLVED.slice();
  let g = GAP, prev = -1;
  const rnd = random || { int: (a, z) => a + Math.floor(Math.random() * (z - a + 1)) };
  for (let m = 0; m < 160; m++) {
    const r = Math.floor(g / N), c = g % N;
    const opts = [];
    if (r > 0) opts.push(g - N);
    if (r < N - 1) opts.push(g + N);
    if (c > 0) opts.push(g - 1);
    if (c < N - 1) opts.push(g + 1);
    const choices = opts.filter((o) => o !== prev);
    const nxt = choices[rnd.int(0, choices.length - 1)];
    b[g] = b[nxt]; b[nxt] = GAP; prev = g; g = nxt;
  }
  // park the gap bottom-right for a classic start
  while (g % N < N - 1) { b[g] = b[g + 1]; b[g + 1] = GAP; g += 1; }
  while (Math.floor(g / N) < N - 1) { b[g] = b[g + N]; b[g + N] = GAP; g += N; }
  if (b.every((v, i) => v === i)) { [b[0], b[1], b[4]] = [b[4], b[0], b[1]]; }
  return b;
}
