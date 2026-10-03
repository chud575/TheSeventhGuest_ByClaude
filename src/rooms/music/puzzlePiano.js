import * as THREE from 'three';
import { pianoNote } from './synth.js';

/**
 * "The Ghost's Nocturne" — a Simon-style memory puzzle on the grand piano.
 * The ghost plays the opening of a phrase; the guest must play it back. Each
 * correct repetition, the ghost adds a note, from four notes up to the whole
 * eight-note phrase. One wrong key and the ghost starts that phrase again.
 */
export const PUZZLE_ID = 'music.piano';
// D4 A4 F4 E4 D4 C#4 D4 Bb4 — a little minor-key lament (MIDI note numbers)
export const PHRASE = [62, 69, 65, 64, 62, 61, 62, 70];
const START_LEN = 4;
const NOTE_GAP = 0.62;
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const noteName = (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

export const meta = {
  id: PUZZLE_ID,
  title: 'The Ghost’s Nocturne',
  description: 'The dead pianist plays the opening of his last composition. Play it back to him, note for note — he will add more each time.',
  hints: [
    'Listen, and watch the keys: each note the ghost plays glows cold blue on the keyboard. All of them lie in the octave around middle C.',
    'The phrase never changes — each round only adds the next note. It begins D, A, F, E (D is the white key sitting between the pair of black keys just above middle C).',
    'The whole nocturne is D, A, F, E, D, C♯, D, B♭ — all within the octave above middle C (C♯ and B♭ are black keys).',
  ],
};

const STAUF_FAIL = [
  'Tsk. Even the *dead* have better ears.',
  'Again! And this time with *feeling*.',
  'He will play it for you as long as it takes. He has nothing but *time*.',
  'Wrong! Do you hear that? That is the sound of my *patience*.',
];

/**
 * @param {object} o  { piano (keys api), ghost (ghost api), toWorld(Vector3)->Vector3, deskObject, onSolvedScene }
 */
export function createPianoPuzzle({ keys, ghost, toWorld, desk, onSolvedScene }) {
  const S = {
    phase: 'idle',     // idle | listen | play | wait | done
    len: START_LEN,
    progress: 0,
    queue: [],         // scheduled ghost notes { t, midi }
    clock: 0,
    after: null,       // { t, fn }
    fails: 0,
    played: [],
  };
  let pctxRef = null;

  const status = (txt) => pctxRef?.status?.(txt);

  const ghostPlay = (midi, vel = 0.75) => {
    keys.press(midi);
    keys.flash(midi, { ghost: true, dur: 0.75 });
    ghost?.reachFor(keys.xOf(midi));
    pianoNote(pctxRef?.audio, midi, { velocity: vel, ghost: true });
  };

  const schedule = (t, fn) => { S.after = { t: S.clock + t, fn }; };

  const listen = (delay = 0.9) => {
    S.phase = 'listen';
    S.progress = 0;
    S.queue = [];
    for (let i = 0; i < S.len; i++) S.queue.push({ t: S.clock + delay + i * NOTE_GAP, midi: PHRASE[i] });
    status(`Listen… (${S.len} of ${PHRASE.length} notes)`);
    ghost?.want?.(0.95);
  };

  const yourTurn = () => {
    S.phase = 'play';
    S.progress = 0;
    status(`Your turn — play the ${S.len} notes back.  (Click the score to hear it again.)`);
  };

  /** A key struck by the guest (from a click or the QA hook). */
  const input = (midi) => {
    if (S.phase === 'listen' || S.phase === 'done') return false;
    keys.press(midi);
    keys.flash(midi, { ghost: false, dur: 0.5 });
    pianoNote(pctxRef?.audio, midi, { velocity: 0.85 });
    S.played.push(midi);
    if (S.phase !== 'play') return false;
    if (midi === PHRASE[S.progress]) {
      S.progress++;
      if (S.progress >= S.len) {
        if (S.len >= PHRASE.length) {
          S.phase = 'done';
          status('The ghost bows his head.');
          schedule(0.6, () => pctxRef?.solve());
        } else {
          S.phase = 'wait';
          S.len++;
          status('Yes… yes. He plays on.');
          schedule(0.9, () => listen(0.4));
        }
      } else {
        status(`${S.progress} of ${S.len}…`);
      }
      return true;
    }
    // wrong key
    S.fails++;
    S.phase = 'wait';
    pctxRef?.fail?.(`Wrong — that was ${noteName(midi)}. He begins again.`);
    if (S.fails % 2 === 1 && pctxRef?.say) pctxRef.say({ text: STAUF_FAIL[((S.fails - 1) / 2) % STAUF_FAIL.length], speaker: 'stauf', speakerName: 'Stauf' });
    schedule(1.6, () => listen(0.2));
    return false;
  };

  const puzzle = {
    ...meta,
    camera: null, // set by the room once the piano is placed
    solvedDelay: 4.2,
    setup(p) {
      pctxRef = p;
      S.played = [];
      if (S.phase === 'done' || p.state.isSolved(PUZZLE_ID)) { S.phase = 'done'; status('The keys are yours now. Play, if you like.'); return; }
      if (S.len < START_LEN) S.len = START_LEN;
      listen(1.0);
    },
    update(dt, t, p) {
      pctxRef = p;
      S.clock += dt;
      while (S.queue.length && S.queue[0].t <= S.clock) {
        const n = S.queue.shift();
        ghostPlay(n.midi);
        if (!S.queue.length) schedule(NOTE_GAP + 0.25, yourTurn);
      }
      if (S.after && S.after.t <= S.clock) { const f = S.after.fn; S.after = null; f(); }
    },
    teardown() {
      if (S.phase !== 'done') { S.phase = 'idle'; S.queue = []; S.after = null; }
      if (S.phase !== 'done') ghost?.want?.(null);
    },
    reset(p) {
      S.len = START_LEN; S.fails = 0; S.queue = []; S.after = null;
      p.status('From the beginning.');
      listen(0.8);
    },
    cursorAt(ndc, p) {
      const hit = p.raycast([keys.white, keys.black], ndc)[0];
      if (hit) return 'grab';
      if (desk && p.raycast(desk, ndc).length) return 'examine';
      return 'default';
    },
    onPointer(type, e, ndc, p) {
      if (type !== 'down') return;
      pctxRef = p;
      const hit = p.raycast([keys.white, keys.black], ndc)[0];
      const midi = keys.keyOf(hit);
      if (midi != null) { input(midi); return; }
      if (desk && p.raycast(desk, ndc).length && (S.phase === 'play' || S.phase === 'idle')) listen(0.3);
    },
    onKey(type, e, p) {
      if (type === 'down' && (e.key === 'r' || e.key === 'R') && S.phase === 'play') listen(0.3);
    },
    autoSolve(p) {
      pctxRef = p;
      S.queue = []; S.after = null;
      S.len = PHRASE.length; S.phase = 'done';
      PHRASE.forEach((m, i) => setTimeout(() => ghostPlay(m, 0.6), i * 260));
      setTimeout(() => p.solve(), PHRASE.length * 260 + 200);
    },
    async onSolved(p) {
      await onSolvedScene?.(p);
    },
  };

  return {
    puzzle,
    input,
    ghostPlay,
    state: () => ({ phase: S.phase, length: S.len, progress: S.progress, fails: S.fails, phrase: PHRASE.slice(), expected: S.phase === 'play' ? PHRASE[S.progress] : null }),
    markDone: () => { S.phase = 'done'; S.len = PHRASE.length; },
  };
}
