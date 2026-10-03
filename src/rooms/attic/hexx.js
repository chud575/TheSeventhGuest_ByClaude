/**
 * Pure game logic for the attic's "Infection" board (no three.js; runs in node for QA).
 *
 * Hexagonal Ataxx: a hex board of radius 4 (61 cells, three dead cells round the
 * centre). Blue (the player) and green (Stauf) start on alternating corners.
 * A move takes one of your cells to an empty cell either
 *   - one step away  -> the cell DIVIDES (a copy appears, the original stays), or
 *   - two steps away -> the cell LEAPS (the original is left empty).
 * Every enemy cell touching the destination is infected and turns to your colour.
 * If the side to move has no legal move, the game ends and the other side's
 * culture overruns every empty cell. The game also ends when the board is full
 * or a colour is wiped out. Most cells wins.
 */

export const RADIUS = 4;
export const EMPTY = 0, BLUE = 1, GREEN = 2;
export const HOLES = [[1, 0], [-1, 1], [0, -1]];
export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

export const CELLS = [];          // [q, r] for every playable index
const INDEX = new Map();          // "q,r" -> index
for (let q = -RADIUS; q <= RADIUS; q++) {
  for (let r = -RADIUS; r <= RADIUS; r++) {
    if (Math.abs(q + r) > RADIUS) continue;
    if (HOLES.some(([a, b]) => a === q && b === r)) continue;
    INDEX.set(`${q},${r}`, CELLS.length);
    CELLS.push([q, r]);
  }
}
export const N = CELLS.length;    // 58
export const indexOf = (q, r) => INDEX.get(`${q},${r}`) ?? -1;
export const hexDist = (a, b) => {
  const [q1, r1] = CELLS[a], [q2, r2] = CELLS[b];
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2;
};

/** NEAR[i] = indices at distance 1, FAR[i] = indices at distance 2 */
export const NEAR = [], FAR = [];
for (let i = 0; i < N; i++) {
  NEAR.push([]); FAR.push([]);
  for (let j = 0; j < N; j++) {
    if (i === j) continue;
    const d = hexDist(i, j);
    if (d === 1) NEAR[i].push(j); else if (d === 2) FAR[i].push(j);
  }
}

const CORNERS = [[RADIUS, -RADIUS], [RADIUS, 0], [0, RADIUS], [-RADIUS, RADIUS], [-RADIUS, 0], [0, -RADIUS]];
export function initialBoard() {
  const b = new Uint8Array(N);
  // blue: lower-left / right / top corners as seen from the player; green the others
  CORNERS.forEach(([q, r], k) => { b[indexOf(q, r)] = k % 2 === 0 ? GREEN : BLUE; });
  return b;
}

export const other = (p) => (p === BLUE ? GREEN : BLUE);
export const count = (b, p) => { let n = 0; for (let i = 0; i < N; i++) if (b[i] === p) n++; return n; };

/** All legal moves for `p`: { from, to, jump } (clones deduplicated: one clone per target). */
export function legalMoves(b, p) {
  const moves = [];
  const cloneSeen = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (b[i] !== p) continue;
    for (const j of NEAR[i]) if (b[j] === EMPTY && !cloneSeen[j]) { cloneSeen[j] = 1; moves.push({ from: i, to: j, jump: false }); }
  }
  for (let i = 0; i < N; i++) {
    if (b[i] !== p) continue;
    for (const j of FAR[i]) if (b[j] === EMPTY) moves.push({ from: i, to: j, jump: true });
  }
  return moves;
}
export const hasMove = (b, p) => {
  for (let i = 0; i < N; i++) {
    if (b[i] !== p) continue;
    for (const j of NEAR[i]) if (b[j] === EMPTY) return true;
    for (const j of FAR[i]) if (b[j] === EMPTY) return true;
  }
  return false;
};

/** Apply a move in place; returns the list of infected cell indices. */
export function applyMove(b, p, m) {
  const o = other(p);
  if (m.jump) b[m.from] = EMPTY;
  b[m.to] = p;
  const infected = [];
  for (const j of NEAR[m.to]) if (b[j] === o) { b[j] = p; infected.push(j); }
  return infected;
}
export function isLegal(b, p, from, to) {
  if (b[from] !== p || b[to] !== EMPTY) return null;
  const d = hexDist(from, to);
  if (d === 1) return { from, to, jump: false };
  if (d === 2) return { from, to, jump: true };
  return null;
}

/**
 * Game-over check. Returns null while the game goes on, otherwise
 * { winner, blue, green, filled: [indices claimed by the side that could still move] }.
 * Mutates `b` when the stuck rule fills the board.
 */
export function settle(b, toMove) {
  const blue = count(b, BLUE), green = count(b, GREEN);
  const empty = N - blue - green;
  if (blue === 0 || green === 0 || empty === 0) return result(b, []);
  if (!hasMove(b, toMove)) {
    const o = other(toMove);
    const filled = [];
    for (let i = 0; i < N; i++) if (b[i] === EMPTY) { b[i] = o; filled.push(i); }
    return result(b, filled);
  }
  return null;
}
function result(b, filled) {
  const blue = count(b, BLUE), green = count(b, GREEN);
  return { winner: blue > green ? BLUE : green > blue ? GREEN : EMPTY, blue, green, filled };
}

// ------------------------------------------------------------------ Stauf's mind
/** Material + a little positional sense: cells with many friendly neighbours resist infection. */
function evaluate(b, p) {
  const o = other(p);
  let s = 0;
  for (let i = 0; i < N; i++) {
    if (b[i] === p) s += 1; else if (b[i] === o) s -= 1;
  }
  return s;
}
function gainOf(b, p, m) {
  const o = other(p);
  let g = m.jump ? 0 : 1;
  for (const j of NEAR[m.to]) if (b[j] === o) g += 2;            // +1 for us, -1 for them
  // exposed holes left behind by a leap invite a counter-strike
  if (m.jump) { let own = 0; for (const j of NEAR[m.from]) if (b[j] === p) own++; g -= own * 0.35; }
  return g;
}
function bestReplyGain(b, p) {
  let best = -Infinity;
  for (const m of legalMoves(b, p)) { const g = gainOf(b, p, m); if (g > best) best = g; }
  return best === -Infinity ? 0 : best;
}

/**
 * Stauf's move. `level`:
 *   0 = greedy (immediate gain only),
 *   1 = greedy with a glance at the reply (default — beatable by a careful player),
 *   2 = full 2-ply search.
 * `rand()` in [0,1) breaks ties deterministically.
 */
export function chooseMove(b, p, { level = 1, rand = Math.random, foresight = 0.6 } = {}) {
  const moves = legalMoves(b, p);
  if (!moves.length) return null;
  const o = other(p);
  let best = null, bestScore = -Infinity;
  const tmp = new Uint8Array(N);
  for (const m of moves) {
    let score;
    if (level === 0) score = gainOf(b, p, m);
    else if (level === 1) {
      tmp.set(b); applyMove(tmp, p, m);
      score = gainOf(b, p, m) - foresight * bestReplyGain(tmp, o);
    } else {
      tmp.set(b); applyMove(tmp, p, m);
      let worst = Infinity;
      const replies = legalMoves(tmp, o);
      if (!replies.length) worst = evaluate(tmp, p) + 50;
      const t2 = new Uint8Array(N);
      for (const r of replies) { t2.set(tmp); applyMove(t2, o, r); const e = evaluate(t2, p); if (e < worst) worst = e; }
      score = worst;
    }
    score += rand() * 0.25;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

/** Seeded PRNG (mulberry32) so Stauf's play is reproducible for QA and shots. */
export function prng(seed = 7) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
