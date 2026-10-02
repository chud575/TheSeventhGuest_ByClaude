// Original animated SVG cursors in the spirit of the 1993 classic:
//   default  — a bony hand at rest, fingers slowly flexing
//   move     — skeletal hand beckoning "come hither"
//   examine  — an eye that blinks and glances about
//   ghost    — comedy & tragedy theatre masks, swaying (a ghost scene awaits)
//   talk     — a chattering jaw of teeth
//   puzzle   — a pulsing, glowing brain
//   grab     — clenched bony fist (dragging puzzle pieces)
//   wait     — hourglass trickling sand
//   back     — hand gesturing downward / away (leave a close-up)
//   none     — hidden
// Each entry: { svg, hot: [x, y] in a 64x64 box }

const BONE = '#e9dfc6';
const BONE_SH = '#9c8f74';
const INK = '#1a1410';

const bone = (x1, y1, x2, y2, w = 4.2) => `
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="${w + 2.4}" stroke-linecap="round"/>
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${BONE}" stroke-width="${w}" stroke-linecap="round"/>
  <line x1="${x1 + 0.6}" y1="${y1 + 0.6}" x2="${x2 + 0.6}" y2="${y2 + 0.6}" stroke="${BONE_SH}" stroke-width="${w * 0.35}" stroke-linecap="round" opacity=".55"/>
  <circle cx="${x1}" cy="${y1}" r="${w * 0.62}" fill="${BONE}" stroke="${INK}" stroke-width="1.1"/>`;

// finger built from 3 phalanges with nested groups so each joint can rotate
function finger(id, x, y, lens, angle, curlAnim = '') {
  const [a, b, c] = lens;
  return `
  <g transform="translate(${x} ${y}) rotate(${angle})">
    ${bone(0, 0, 0, -a)}
    <g class="${id}-j1" style="transform-origin:0px ${-a}px">
      ${bone(0, -a, 0, -a - b, 3.8)}
      <g class="${id}-j2" style="transform-origin:0px ${-a - b}px">
        ${bone(0, -a - b, 0, -a - b - c, 3.3)}
        <circle cx="0" cy="${-a - b - c}" r="1.9" fill="${BONE}" stroke="${INK}" stroke-width="1"/>
      </g>
    </g>
  </g>${curlAnim}`;
}

function hand({ cls, pose = 'point', extraStyle = '' }) {
  // palm (carpals + metacarpal heads) around (30,40), fingers upward
  const idx = pose === 'fist' ? [6, 5, 4] : [10, 8, 6];
  const others = pose === 'point' || pose === 'beckon' ? [8, 6, 5] : pose === 'fist' ? [6, 5, 4] : [10, 8, 6];
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" class="${cls}">
  <style>
    ${extraStyle}
  </style>
  <defs><filter id="${cls}-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <g filter="url(#${cls}-glow)" class="${cls}-hand">
    <!-- wrist bones -->
    ${bone(30, 60, 29, 50, 5)}
    ${bone(35, 60, 34, 50, 4.4)}
    <!-- carpals -->
    <ellipse cx="31" cy="46" rx="7.5" ry="4.6" fill="${BONE}" stroke="${INK}" stroke-width="1.4"/>
    <circle cx="27.5" cy="45.5" r="2" fill="${BONE_SH}" opacity=".6"/>
    <circle cx="33" cy="46.5" r="1.8" fill="${BONE_SH}" opacity=".6"/>
    <!-- thumb -->
    ${finger(`${cls}-th`, 24, 45, [6, 5, 4], -52)}
    <!-- metacarpals + fingers -->
    ${finger(`${cls}-f1`, 27, 41, [7, idx[0], idx[1]], -14)}
    ${finger(`${cls}-f2`, 31, 40.5, [7.5, others[0], others[1]], -3)}
    ${finger(`${cls}-f3`, 34.5, 41, [7, others[1], others[2]], 8)}
    ${finger(`${cls}-f4`, 37.5, 42.5, [6, others[2], others[2] - 1], 20)}
  </g>
</svg>`;
}

const DEFAULT = hand({
  cls: 'cz-def',
  pose: 'open',
  extraStyle: `
  .cz-def-hand { transform-origin: 32px 56px; animation: czdef 4s ease-in-out infinite; }
  @keyframes czdef { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(3deg); } }
  .cz-def-f2-j1, .cz-def-f3-j1 { animation: czdefc 4s ease-in-out infinite; }
  @keyframes czdefc { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(10deg); } }`,
});

const MOVE = hand({
  cls: 'cz-mv',
  pose: 'beckon',
  extraStyle: `
  .cz-mv-hand { transform-origin: 32px 56px; animation: czmvh 1.1s ease-in-out infinite; }
  @keyframes czmvh { 0%,100% { transform: rotate(-6deg) translateY(0); } 50% { transform: rotate(2deg) translateY(1px); } }
  .cz-mv-f1-j1 { animation: czmv1 1.1s ease-in-out infinite; }
  .cz-mv-f1-j2 { animation: czmv2 1.1s ease-in-out infinite; }
  .cz-mv-f2-j1, .cz-mv-f3-j1, .cz-mv-f4-j1 { transform: rotate(-75deg); }
  .cz-mv-f2-j2, .cz-mv-f3-j2, .cz-mv-f4-j2 { transform: rotate(-80deg); }
  @keyframes czmv1 { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-70deg); } }
  @keyframes czmv2 { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-85deg); } }`,
});

const GRAB = hand({
  cls: 'cz-gr',
  pose: 'fist',
  extraStyle: `
  .cz-gr-f1-j1, .cz-gr-f2-j1, .cz-gr-f3-j1, .cz-gr-f4-j1 { transform: rotate(-95deg); }
  .cz-gr-f1-j2, .cz-gr-f2-j2, .cz-gr-f3-j2, .cz-gr-f4-j2 { transform: rotate(-95deg); }
  .cz-gr-th-j1 { transform: rotate(60deg); }`,
});

const BACK = hand({
  cls: 'cz-bk',
  pose: 'open',
  extraStyle: `
  .cz-bk-hand { transform-origin: 32px 32px; transform: rotate(180deg); animation: czbk 1.4s ease-in-out infinite; }
  @keyframes czbk { 0%,100% { transform: rotate(180deg) translateY(0); } 50% { transform: rotate(180deg) translateY(-4px); } }`,
});

const EXAMINE = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" class="cz-eye">
  <style>
    .cz-eye-iris { animation: czeyei 5s ease-in-out infinite; }
    @keyframes czeyei { 0%,18% { transform: translate(0,0); } 24%,40% { transform: translate(-5px,1px); } 46%,62% { transform: translate(4px,-1px); } 68%,100% { transform: translate(0,0); } }
    .cz-eye-lid { transform-origin: 32px 18px; animation: czeyel 5s ease-in-out infinite; }
    .cz-eye-lidb { transform-origin: 32px 46px; animation: czeyel 5s ease-in-out infinite; }
    @keyframes czeyel { 0%,86%,100% { transform: scaleY(0.0); } 90%,92% { transform: scaleY(1); } }
    .cz-eye-glow { animation: czeyeg 2.4s ease-in-out infinite; }
    @keyframes czeyeg { 0%,100% { opacity: .55; } 50% { opacity: .95; } }
  </style>
  <defs>
    <radialGradient id="cz-eye-ir" cx="50%" cy="45%" r="55%">
      <stop offset="0" stop-color="#f6e7a0"/><stop offset=".35" stop-color="#9a8a2c"/><stop offset=".75" stop-color="#2f4a1e"/><stop offset="1" stop-color="#0e1608"/>
    </radialGradient>
    <radialGradient id="cz-eye-sc" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#fff8ea"/><stop offset=".8" stop-color="#d8c6a8"/><stop offset="1" stop-color="#8a6450"/></radialGradient>
    <clipPath id="cz-eye-clip"><path d="M4 32 Q32 6 60 32 Q32 58 4 32 Z"/></clipPath>
    <filter id="cz-eye-bl"><feGaussianBlur stdDeviation="2.2"/></filter>
  </defs>
  <path class="cz-eye-glow" d="M4 32 Q32 6 60 32 Q32 58 4 32 Z" fill="#c9a55a" filter="url(#cz-eye-bl)" opacity=".7"/>
  <path d="M4 32 Q32 6 60 32 Q32 58 4 32 Z" fill="url(#cz-eye-sc)" stroke="${INK}" stroke-width="2.4"/>
  <g clip-path="url(#cz-eye-clip)">
    <path d="M10 33 Q20 30 26 36 M54 31 Q46 28 41 34" stroke="#b0503c" stroke-width=".8" fill="none" opacity=".6"/>
    <g class="cz-eye-iris">
      <circle cx="32" cy="32" r="11" fill="url(#cz-eye-ir)" stroke="#0b0a06" stroke-width="1.2"/>
      <circle cx="32" cy="32" r="4.6" fill="#050403"/>
      <circle cx="28.5" cy="28.5" r="2.2" fill="#fff" opacity=".85"/>
    </g>
    <rect class="cz-eye-lid" x="0" y="0" width="64" height="32" fill="#5a3a2e"/>
    <rect class="cz-eye-lidb" x="0" y="32" width="64" height="32" fill="#5a3a2e"/>
  </g>
  <path d="M4 32 Q32 6 60 32" fill="none" stroke="${INK}" stroke-width="3"/>
  <path d="M8 26 L5 22 M16 19 L14 14 M26 15 L25 10 M38 15 L39 10 M48 19 L50 14 M56 26 L59 22" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

const GHOST = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" class="cz-mk">
  <style>
    .cz-mk-a { transform-origin: 24px 30px; animation: czmka 2.2s ease-in-out infinite; }
    .cz-mk-b { transform-origin: 40px 34px; animation: czmkb 2.2s ease-in-out infinite; }
    @keyframes czmka { 0%,100% { transform: rotate(-12deg); } 50% { transform: rotate(-4deg) translateY(-1px); } }
    @keyframes czmkb { 0%,100% { transform: rotate(10deg); } 50% { transform: rotate(3deg) translateY(1px); } }
    .cz-mk-sh { animation: czmks 2.2s ease-in-out infinite; }
    @keyframes czmks { 0%,100% { opacity: .5; } 50% { opacity: .9; } }
  </style>
  <defs>
    <linearGradient id="cz-mk-g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6dc"/><stop offset="1" stop-color="#c9b48a"/></linearGradient>
    <linearGradient id="cz-mk-g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8c66c"/><stop offset="1" stop-color="#8a6220"/></linearGradient>
    <filter id="cz-mk-bl"><feGaussianBlur stdDeviation="2"/></filter>
  </defs>
  <ellipse class="cz-mk-sh" cx="32" cy="34" rx="26" ry="20" fill="#7aa0ff" filter="url(#cz-mk-bl)" opacity=".5"/>
  <!-- tragedy (gold) behind -->
  <g class="cz-mk-b">
    <path d="M28 18 Q40 12 54 18 Q56 34 48 46 Q41 54 34 46 Q26 34 28 18 Z" fill="url(#cz-mk-g2)" stroke="${INK}" stroke-width="2"/>
    <path d="M33 27 Q36 24 40 28 Q36 30 33 27 Z M44 28 Q47 24 51 27 Q48 30 44 28 Z" fill="${INK}"/>
    <path d="M36 42 Q41 37 47 42" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M33 23 Q36 21 39 24 M45 24 Q48 21 51 23" stroke="${INK}" stroke-width="1.4" fill="none"/>
  </g>
  <!-- comedy (bone) in front -->
  <g class="cz-mk-a">
    <path d="M8 14 Q22 8 36 14 Q38 30 30 42 Q23 50 16 42 Q8 30 8 14 Z" fill="url(#cz-mk-g1)" stroke="${INK}" stroke-width="2"/>
    <path d="M13 24 Q16 20 20 24 Q16 25 13 24 Z M24 24 Q28 20 31 24 Q27 25 24 24 Z" fill="${INK}"/>
    <path d="M14 33 Q22 42 30 33 Q22 37 14 33 Z" fill="${INK}"/>
    <path d="M12 19 Q16 16 19 19 M25 19 Q28 16 32 19" stroke="${INK}" stroke-width="1.4" fill="none"/>
    <path d="M36 16 Q44 12 46 20" stroke="#7a1010" stroke-width="1.6" fill="none"/>
  </g>
</svg>`;

const TALK = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" class="cz-tk">
  <style>
    .cz-tk-jaw { transform-origin: 32px 30px; animation: cztk .32s ease-in-out infinite; }
    @keyframes cztk { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(7px) rotate(2deg); } }
    .cz-tk-top { animation: cztkt .32s ease-in-out infinite; }
    @keyframes cztkt { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
  </style>
  <defs><linearGradient id="cz-tk-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#cdbb94"/></linearGradient>
  <filter id="cz-tk-bl"><feGaussianBlur stdDeviation="1.5"/></filter></defs>
  <ellipse cx="32" cy="34" rx="25" ry="17" fill="#3a0606" filter="url(#cz-tk-bl)" opacity=".7"/>
  <g class="cz-tk-top">
    <path d="M6 22 Q32 6 58 22 L56 30 Q32 24 8 30 Z" fill="#8a2a2a" stroke="${INK}" stroke-width="2"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const x = 10 + i * 5.6; const h = i === 3 || i === 4 ? 9 : i === 2 || i === 5 ? 8 : 7; return `<path d="M${x} 27 L${x + 5} 27 L${x + 4.4} ${27 + h} Q${x + 2.5} ${29 + h} ${x + 0.6} ${27 + h} Z" fill="url(#cz-tk-g)" stroke="${INK}" stroke-width="1.2"/>`; }).join('')}
  </g>
  <g class="cz-tk-jaw">
    <path d="M8 38 Q32 34 56 38 L54 46 Q32 58 10 46 Z" fill="#8a2a2a" stroke="${INK}" stroke-width="2"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => { const x = 12.5 + i * 5.6; const h = 6.5; return `<path d="M${x} 41 L${x + 5} 41 L${x + 4.4} ${41 - h} Q${x + 2.5} ${39 - h} ${x + 0.6} ${41 - h} Z" fill="url(#cz-tk-g)" stroke="${INK}" stroke-width="1.2"/>`; }).join('')}
  </g>
</svg>`;

const PUZZLE = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" class="cz-br">
  <style>
    .cz-br-b { transform-origin: 32px 32px; animation: czbr 1.3s ease-in-out infinite; }
    @keyframes czbr { 0%,100% { transform: scale(.94); } 30% { transform: scale(1.04); } 45% { transform: scale(.98); } 60% { transform: scale(1.02); } }
    .cz-br-g { animation: czbrg 1.3s ease-in-out infinite; }
    @keyframes czbrg { 0%,100% { opacity: .35; } 30% { opacity: .95; } }
  </style>
  <defs>
    <radialGradient id="cz-br-f" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#f6c8c0"/><stop offset=".6" stop-color="#c47c78"/><stop offset="1" stop-color="#6a2e34"/></radialGradient>
    <filter id="cz-br-bl"><feGaussianBlur stdDeviation="2.6"/></filter>
  </defs>
  <ellipse class="cz-br-g" cx="32" cy="30" rx="28" ry="22" fill="#ff8a6a" filter="url(#cz-br-bl)"/>
  <g class="cz-br-b">
    <path d="M10 32 Q6 18 18 13 Q24 6 34 9 Q44 6 50 14 Q60 18 56 30 Q60 40 50 44 Q46 52 36 49 Q30 54 22 49 Q10 50 10 40 Q4 36 10 32 Z" fill="url(#cz-br-f)" stroke="${INK}" stroke-width="2.2"/>
    <path d="M32 10 Q30 20 33 30 Q30 40 33 49" stroke="${INK}" stroke-width="1.8" fill="none"/>
    <path d="M14 22 Q20 20 22 26 Q18 30 22 34 M12 38 Q18 36 20 42 M24 14 Q22 20 26 22 Q28 28 24 30 M40 12 Q38 18 42 20 Q46 24 42 28 M50 20 Q46 24 50 28 Q54 32 50 36 M42 34 Q38 38 42 42 Q44 46 40 47 M26 38 Q30 42 26 46" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <path d="M18 18 Q22 16 24 18 M44 16 Q48 16 49 19" stroke="#fff" stroke-width="1.2" fill="none" opacity=".6"/>
    <path d="M22 50 Q24 58 30 60" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M22 50 Q24 58 30 60" stroke="#c47c78" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;

const WAIT = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" class="cz-hg">
  <style>
    .cz-hg-all { transform-origin: 32px 32px; animation: czhg 2.4s ease-in-out infinite; }
    @keyframes czhg { 0%,80% { transform: rotate(0deg); } 100% { transform: rotate(180deg); } }
    .cz-hg-top { transform-origin: 32px 30px; animation: czhgt 2.4s linear infinite; }
    .cz-hg-bot { transform-origin: 32px 50px; animation: czhgb 2.4s linear infinite; }
    @keyframes czhgt { 0% { transform: scaleY(1); } 80%,100% { transform: scaleY(0.05); } }
    @keyframes czhgb { 0% { transform: scaleY(0.05); } 80%,100% { transform: scaleY(1); } }
  </style>
  <g class="cz-hg-all">
    <rect x="16" y="6" width="32" height="4" rx="1" fill="#c9a55a" stroke="${INK}" stroke-width="1.5"/>
    <rect x="16" y="54" width="32" height="4" rx="1" fill="#c9a55a" stroke="${INK}" stroke-width="1.5"/>
    <path d="M20 10 Q20 26 31 32 Q20 38 20 54 L44 54 Q44 38 33 32 Q44 26 44 10 Z" fill="rgba(220,235,255,.18)" stroke="${BONE}" stroke-width="1.6"/>
    <path class="cz-hg-top" d="M23 16 Q24 26 32 30 Q40 26 41 16 Z" fill="#d8b46a"/>
    <path class="cz-hg-bot" d="M22 52 Q24 42 32 40 Q40 42 42 52 Z" fill="#d8b46a"/>
    <line x1="32" y1="30" x2="32" y2="50" stroke="#d8b46a" stroke-width="1" stroke-dasharray="1.5 2"/>
  </g>
</svg>`;

export const CURSORS = {
  default: { svg: DEFAULT, hot: [21, 17] },
  move: { svg: MOVE, hot: [22, 18] },
  examine: { svg: EXAMINE, hot: [32, 32] },
  ghost: { svg: GHOST, hot: [32, 32] },
  talk: { svg: TALK, hot: [32, 32] },
  puzzle: { svg: PUZZLE, hot: [32, 30] },
  grab: { svg: GRAB, hot: [30, 30] },
  wait: { svg: WAIT, hot: [32, 32] },
  back: { svg: BACK, hot: [32, 50] },
  none: { svg: '', hot: [0, 0] },
};
export const CURSOR_TYPES = Object.keys(CURSORS);
