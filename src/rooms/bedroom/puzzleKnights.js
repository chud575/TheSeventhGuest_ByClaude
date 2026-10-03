import * as THREE from 'three';
import { knightGeometry } from '../../engine/lib/contrib/bedroom-knight.js';

/**
 * "The Knights" — homage to the knight-swap puzzle of the 1993 game.
 *
 * Twelve ebony and twelve bone knights stand on a 5x5 board carved into the lid of
 * the chest at the foot of the bed; one square (the centre) is empty. A knight may
 * only leap — in its L-shaped chess move — into the empty square. Exchange the two
 * armies: every bone knight where an ebony one stood and vice versa.
 *
 * The shortest solution is 36 leaps (verified by exhaustive breadth-first search
 * over all 67 million positions; see SOLUTION).
 */

export const KNIGHTS_ID = 'bedroom.knights';
export const knightsMeta = {
  id: KNIGHTS_ID,
  title: 'The Knights',
  description: 'Bone and ebony face each other across the carved board. A knight may leap only as a knight leaps, and only into the empty square. Exchange the two armies.',
  hints: [
    'Only a knight standing an L-shaped leap away from the empty square can move — two squares one way and one square to the side. Hover the board: the squares of the knights that may leap are ringed in faint gold.',
    'Do not try to march one army across. Work around the rim: bring the corner knights out early, and keep returning the empty square to the centre to change direction. The fewest leaps that will do it is thirty-six.',
    'Rows top to bottom are 1-5, columns left to right A-E. Leap from: D5, B4, D3, E1, C2, E3, D1, C3, A4, C5, B3, D2, E4, C3, B5, A3, C4, A5, B3, A1, C2, D4, B3, D2, B1, C3, A2, B4, D3, E5, C4, B2, D3, C1, E2, C3.',
  ],
};

const N = 5;
const START = ['BBBBW', 'BBBWW', 'BB.WW', 'BBWWW', 'BWWWW'];
/** Optimal 36-leap solution: index (r*5+c) of the knight that leaps into the empty square each turn. */
export const SOLUTION = [23, 16, 13, 4, 7, 14, 3, 12, 15, 22, 11, 8, 19, 12, 21, 10, 17, 20, 11, 0, 7, 18, 11, 8, 1, 12, 5, 16, 13, 24, 17, 6, 13, 2, 9, 12];

const NEIGH = [];
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  const a = [];
  for (const [dr, dc] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < N && cc >= 0 && cc < N) a.push(rr * N + cc);
  }
  NEIGH.push(a);
}
const startGrid = () => START.join('').split('');
const goalGrid = () => startGrid().map((ch) => (ch === 'B' ? 'W' : ch === 'W' ? 'B' : '.'));
const sqName = (i) => `${'ABCDE'[i % N]}${Math.floor(i / N) + 1}`;

/**
 * @param ctx room ctx
 * @param opts.parent  Object3D the board sits in (its local +Y up; board centred at `center`)
 * @param opts.center  Vector3 in parent space (top surface of the board)
 * @param opts.size    side length of the 5x5 field in metres
 * @param opts.mats    { bone, ebony } materials
 * @param opts.camera  puzzle camera {position,target,fov} (world)
 */
export function createKnightsPuzzle(ctx, { parent, center, size, mats, camera, onSolved, onChange }) {
  const sq = size / N;
  const group = new THREE.Group();
  group.name = 'knightsPuzzle';
  group.position.copy(center);
  group.userData.keep = true;
  parent.add(group);

  const posOf = (i) => new THREE.Vector3((i % N - 2) * sq, 0, (Math.floor(i / N) - 2) * sq);

  // ---------------------------------------------------------------- pieces
  const geo = knightGeometry(sq * 1.08);
  const pieces = [];      // { mesh, color: 'W'|'B', sq }
  let grid = startGrid();
  const boardIdx = new Array(N * N).fill(-1); // square -> piece index
  grid.forEach((ch, i) => {
    if (ch === '.') return;
    // pieces never glow: the hover cue is a ring decal on the square (see overlays)
    const m = new THREE.Mesh(geo, ch === 'W' ? mats.bone : mats.ebony);
    m.castShadow = true; m.receiveShadow = true;
    m.position.copy(posOf(i));
    // side-on to the player so the horse-head silhouettes read: ebony looks toward the
    // bone host (screen right), bone toward the ebony (screen left); each piece turned a
    // little toward the camera, with a per-piece 10-20 degree variation.
    const jitter = (((i * 37) % 11) / 10 - 0.5) * 0.34;
    m.rotation.y = (ch === 'W' ? -Math.PI / 2 + 0.32 : Math.PI / 2 - 0.32) + jitter;
    m.userData.piece = pieces.length;
    m.userData.noBloom = true;
    boardIdx[i] = pieces.length;
    group.add(m);
    pieces.push({ mesh: m, color: ch, sq: i, baseRot: m.rotation.y });
  });

  // invisible pick plane + square highlight overlays
  const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  const pick = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), pickMat);
  pick.position.y = 0.001; pick.userData.noBake = true; pick.userData.noShadow = true;
  group.add(pick);
  const ovG = new THREE.PlaneGeometry(sq * 0.96, sq * 0.96).rotateX(-Math.PI / 2);
  // thin inlaid ring (additive, tone-mapped so it never blooms)
  const ringTex = ctx.textures.canvas('bedroom:knightRing', 128, 128, (g2, w) => {
    g2.clearRect(0, 0, w, w);
    const c = w / 2;
    const gr = g2.createRadialGradient(c, c, w * 0.3, c, c, w * 0.48);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.12)');
    gr.addColorStop(0.8, 'rgba(255,255,255,1)'); gr.addColorStop(0.9, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = gr; g2.beginPath(); g2.arc(c, c, w * 0.48, 0, 7); g2.fill();
  }, { tile: false });
  const overlays = [];
  for (let i = 0; i < N * N; i++) {
    const o = new THREE.Mesh(ovG, new THREE.MeshBasicMaterial({ map: ringTex, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, toneMapped: true, blending: THREE.AdditiveBlending }));
    o.position.copy(posOf(i)); o.position.y = 0.0015; o.visible = false; o.renderOrder = 5;
    o.userData.noBake = true; o.userData.noShadow = true;
    group.add(o); overlays.push(o);
  }

  // ---------------------------------------------------------------- state
  let moves = 0, history = [], hover = -1, solvedFlag = false, active = false;
  const anims = [];
  const empty = () => grid.indexOf('.');
  const canMove = (i) => grid[i] !== '.' && NEIGH[empty()].includes(i);
  const isGoal = () => { const g = goalGrid(); return grid.every((ch, i) => ch === g[i]); };
  const placedRight = () => { const g = goalGrid(); let n = 0; grid.forEach((ch, i) => { if (ch !== '.' && ch === g[i]) n++; }); return n; };

  function animate(piece, from, to, d = 0.55) {
    for (let k = anims.length - 1; k >= 0; k--) if (anims[k].p === piece) anims.splice(k, 1);
    anims.push({ p: piece, from: from.clone(), to: to.clone(), t: 0, d });
  }

  function leap(i, { instant = false, record = true, sound = true } = {}) {
    if (!canMove(i)) return false;
    const e = empty();
    const pi = boardIdx[i];
    const piece = pieces[pi];
    grid[e] = grid[i]; grid[i] = '.';
    boardIdx[e] = pi; boardIdx[i] = -1;
    piece.sq = e;
    if (instant) piece.mesh.position.copy(posOf(e));
    else animate(piece, piece.mesh.position, posOf(e));
    if (record) { history.push([i, e]); moves++; }
    if (sound) ctx.audio.sfx?.('click', { freq: piece.color === 'W' ? 520 : 330 });
    onChange?.(state());
    return true;
  }

  function setGrid(target, instant) {
    // reassign pieces to the target layout (pieces of a colour are interchangeable)
    const free = { W: [], B: [] };
    pieces.forEach((p) => free[p.color].push(p));
    boardIdx.fill(-1);
    target.forEach((ch, i) => {
      if (ch === '.') return;
      const p = free[ch].shift();
      p.sq = i; boardIdx[i] = pieces.indexOf(p);
      if (instant) p.mesh.position.copy(posOf(i)); else animate(p, p.mesh.position, posOf(i), 0.9);
    });
    grid = target.slice();
  }

  function refresh(t = 0) {
    for (const o of overlays) { o.visible = false; o.material.opacity = 0; }
    const show = (i, r, g2, b, op) => { const o = overlays[i]; o.visible = true; o.material.color.setRGB(r, g2, b); o.material.opacity = op; };
    if (solvedFlag) {
      if (active) for (let i = 0; i < N * N; i++) if (grid[i] !== '.') show(i, 1, 0.85, 0.55, 0.12 + 0.06 * Math.sin(t * 2 + i));
      return;
    }
    if (!active) return;
    const em = empty();
    show(em, 1, 0.85, 0.6, 0.22 + 0.08 * Math.sin(t * 2.5));
    for (let i = 0; i < N * N; i++) {
      if (!canMove(i)) continue;
      if (i === hover) show(i, 1, 0.9, 0.65, 0.55);
      else show(i, 1, 0.85, 0.55, 0.2 + 0.08 * Math.sin(t * 3 + i));
    }
    if (hover >= 0 && canMove(hover)) show(em, 1, 0.9, 0.65, 0.5);
    else if (hover >= 0 && grid[hover] !== '.') show(hover, 1, 0.25, 0.12, 0.35);
  }

  function status() {
    if (solvedFlag) return 'The armies have changed sides. Behind you, wood creaks and a latch gives.';
    const n = placedRight();
    return `Leaps: ${moves}   ·   ${n} of 24 knights on the far side`;
  }

  function check(p) {
    if (!solvedFlag && isGoal()) {
      solvedFlag = true;
      p?.status?.(status());
      setTimeout(() => p?.solve?.(), 900);
      return true;
    }
    p?.status?.(status());
    return false;
  }

  function squareAt(ndc, p) {
    const hits = p.raycast([group], ndc);
    // a knight in front may intercept the ray aimed at the one behind (the ray clips its base on
    // the way down): among the knights along the ray that can leap, take the one struck highest,
    // i.e. the head the player is actually pointing at
    let best = null;
    for (const h of hits) {
      const pi = h.object.userData.piece;
      if (pi === undefined || !canMove(pieces[pi].sq)) continue;
      if (!best || h.point.y > best.point.y) best = h;
    }
    if (best) return pieces[best.object.userData.piece].sq;
    for (const h of hits) {
      if (h.object.userData.piece !== undefined) return pieces[h.object.userData.piece].sq;
      if (h.object === pick) {
        const l = group.worldToLocal(h.point.clone());
        const c = Math.floor(l.x / sq + 2.5), r = Math.floor(l.z / sq + 2.5);
        if (c >= 0 && c < N && r >= 0 && r < N) return r * N + c;
      }
    }
    return -1;
  }

  function update(dt, t) {
    for (let k = anims.length - 1; k >= 0; k--) {
      const a = anims[k];
      a.t = Math.min(1, a.t + dt / a.d);
      const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2;
      a.p.mesh.position.lerpVectors(a.from, a.to, e);
      a.p.mesh.position.y = Math.sin(Math.PI * a.t) * sq * 0.9;
      a.p.mesh.rotation.z = Math.sin(Math.PI * a.t) * 0.25 * (a.to.x - a.from.x > 0 ? -1 : 1);
      if (a.t >= 1) { a.p.mesh.rotation.z = 0; a.p.mesh.position.y = 0; anims.splice(k, 1); }
    }
    refresh(t);
  }
  ctx.onUpdate(update);

  function state() {
    return { grid: grid.join(''), rows: [0, 1, 2, 3, 4].map((r) => grid.slice(r * N, r * N + N).join('')), moves, empty: empty(), correct: placedRight(), solved: solvedFlag || ctx.state.isSolved(KNIGHTS_ID) };
  }

  function applySolved() {
    solvedFlag = true; active = false;
    setGrid(goalGrid(), true);
    onChange?.(state());
  }
  if (ctx.state.isSolved(KNIGHTS_ID)) applySolved();

  const puzzle = {
    ...knightsMeta,
    camera,
    setup(p) {
      active = true;
      if (ctx.state.isSolved(KNIGHTS_ID)) { solvedFlag = true; }
      p.status(solvedFlag ? status() : 'Click a ringed knight to leap it into the empty square.   (Right-click or U: undo)');
    },
    teardown() { active = false; hover = -1; },
    reset(p) {
      if (solvedFlag) return;
      setGrid(startGrid(), false); moves = 0; history = [];
      ctx.audio.sfx?.('whoosh');
      p.status('The knights return to their posts.');
      onChange?.(state());
    },
    cursorAt(ndc, p) {
      const i = squareAt(ndc, p);
      return i >= 0 && canMove(i) ? 'grab' : 'default';
    },
    onPointer(type, e, ndc, p) {
      if (solvedFlag) return;
      if (type === 'move') { hover = squareAt(ndc, p); return; }
      if (type !== 'up') return;
      if (e && e.button === 2) { undo(p); return; }
      const i = squareAt(ndc, p);
      if (i < 0) return;
      if (grid[i] === '.') { p.status('That square is the empty one — choose a knight that can leap into it.'); return; }
      if (!canMove(i)) { p.fail?.(`The knight on ${sqName(i)} cannot reach the empty square.`); return; }
      leap(i);
      check(p);
    },
    onKey(type, e, p) {
      if (type !== 'down') return;
      if (e.key === 'u' || e.key === 'U' || e.key === 'Backspace' || ((e.ctrlKey || e.metaKey) && e.key === 'z')) undo(p);
    },
    autoSolve(p) {
      // the Book glides every knight to its exchanged square
      setGrid(goalGrid(), false);
      solvedFlag = true;
      p.status?.(status());
      setTimeout(() => p.solve?.(), 1300);
    },
    async onSolved(p) {
      await onSolved?.(p);
    },
  };

  function undo(p) {
    if (solvedFlag || !history.length) return;
    const [from, to] = history.pop();
    // the knight now on `to` leaps back to `from` (which is the empty square)
    leap(to, { record: false });
    moves = Math.max(0, moves - 1);
    p?.status?.(status());
  }

  /** QA: play the optimal solution from the start position (interval seconds per leap). */
  async function playSolution(interval = 0.3, p = null) {
    setGrid(startGrid(), true); moves = 0; history = [];
    for (const i of SOLUTION) {
      leap(i, { sound: interval > 0.05 });
      if (interval > 0) await new Promise((r) => setTimeout(r, interval * 1000));
    }
    return check(p);
  }

  return {
    group, pieces, puzzle, state, applySolved, playSolution,
    leap: (i) => leap(i), click: (name) => { const c = 'ABCDE'.indexOf(name[0].toUpperCase()); const r = Number(name[1]) - 1; return leap(r * N + c); },
    arrange: (rows) => setGrid(rows.join('').split(''), true),
    reset: () => { setGrid(startGrid(), true); moves = 0; history = []; solvedFlag = false; },
  };
}
