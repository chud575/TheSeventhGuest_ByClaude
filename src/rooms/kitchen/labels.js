import * as THREE from 'three';

/**
 * Lithographed tin labels for "Stauf's Superior Soups" — a full 360-degree wrap per tin,
 * drawn on a canvas atlas (colour + a matching ORM atlas so gold inks and scratched tin
 * read metallic while the enamel inks stay dielectric).
 *
 * Each wrap is authored on a 768-unit-wide grid; its height depends on the tin's format
 * (tall / standard / squat) so type is never stretched. The front (u = 0.5, facing the
 * room) carries the maker's ribbon, the engraved initial in a gilt roundel and the soup's
 * name plate; the sides carry the maker's medallion, directions and the weight; a chain
 * border runs round both crimped rims. A halftone + slight colour misregistration pass
 * and wear (rubbed rims, scratches to bare tin, rust at the side seam) finish it.
 */

export const CELL_W = 1152, CELL_H = 512, COLS = 4, ROWS = 6;
const S = CELL_W / 768;            // authored on a 768-wide grid; cell holds up to 341 units of height

const PALETTES = [
  { ground: '#8e1c17', panel: '#efe2bf', ink: '#24100b', accent: '#173826', field: '#d9c79c', letter: '#6e120e' },  // tomato red
  { ground: '#1c4330', panel: '#ecdcb2', ink: '#12201a', accent: '#8a1c17', field: '#d6c493', letter: '#163a27' },  // bottle green
  { ground: '#1a2853', panel: '#eadfc0', ink: '#101731', accent: '#9c231b', field: '#d4c9a6', letter: '#1a2853' },  // navy
  { ground: '#b8892a', panel: '#f1e6c6', ink: '#22160a', accent: '#7e1915', field: '#e6d3a2', letter: '#2a1a0c' },  // mustard
  { ground: '#ddcfa4', panel: '#f4ead0', ink: '#2a1a10', accent: '#931f19', field: '#c9b47e', letter: '#8e1d17' },  // cream
  { ground: '#561420', panel: '#eadcbc', ink: '#230a0e', accent: '#1d3a4f', field: '#d4bf98', letter: '#561420' },  // oxblood
  { ground: '#244449', panel: '#ece0c0', ink: '#0e1f22', accent: '#9e4e18', field: '#cfc197', letter: '#244449' },  // teal
];

const SOUPS = [
  'MOCK TURTLE', 'OX-TAIL', 'MULLIGATAWNY', 'COCK-A-LEEKIE', 'BROWN WINDSOR', 'PEA & HAM', 'CALF’S HEAD', 'SCOTCH BROTH',
  'JUGGED HARE', 'GIBLET', 'MUTTON BROTH', 'EEL & PARSLEY', 'KIDNEY', 'CELERY CREAM', 'BEEF TEA', 'JULIENNE',
  'POTAGE ROYAL', 'OYSTER BISQUE', 'HOTCH-POTCH', 'LENTIL', 'CONSOMMÉ', 'LEEK & POTATO', 'SHEEP’S TROTTER', 'NETTLE',
];
const WEIGHTS = ['NET 1 LB.', 'NET 1 LB.', 'NET 10 OZ.', 'NET 1 LB.', 'NET 2 LB.'];

// ORM encodings (R = ao, G = roughness, B = metalness)
const ORM = { ink: 'rgb(255,120,40)', gold: 'rgb(255,80,235)', tin: 'rgb(255,70,255)', rust: 'rgb(255,240,0)', paper: 'rgb(255,220,0)' };

function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function goldGrad(g, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, '#6e5019'); gr.addColorStop(0.35, '#d9b35a'); gr.addColorStop(0.5, '#f4dc98'); gr.addColorStop(0.65, '#c49a40'); gr.addColorStop(1, '#634614');
  return gr;
}

/** Fit text to a width by condensing it horizontally (litho type was cut condensed for long names). */
function fitText(g, txt, x, y, maxW, mode = 'fill') {
  const w = g.measureText(txt).width;
  const k = Math.min(1, maxW / w);
  g.save(); g.translate(x, y); g.scale(k, 1);
  if (mode === 'fill') g.fillText(txt, 0, 0); else g.strokeText(txt, 0, 0);
  g.restore();
}

/** Letter-spaced small caps. */
function spaced(g, txt, x, y, track, maxW) {
  const chars = [...txt];
  const widths = chars.map((c) => g.measureText(c).width);
  let total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  const k = maxW ? Math.min(1, maxW / total) : 1;
  g.save(); g.translate(x, y); g.scale(k, 1);
  let px = -total / 2;
  g.textAlign = 'left';
  chars.forEach((c, i) => { g.fillText(c, px, 0); px += widths[i] + track; });
  g.restore();
  g.textAlign = 'center';
}

// text along an arc (centre cx, cy, radius r), centred on angle a0 (radians, 0 = up), letters upright to the arc
function arcText(g, txt, cx, cy, r, a0, spread, inward = false) {
  const chars = [...txt];
  const n = chars.length;
  chars.forEach((c, k) => {
    const a = a0 + (n > 1 ? (k / (n - 1) - 0.5) * spread : 0) * (inward ? -1 : 1);
    g.save(); g.translate(cx + Math.sin(a) * r, cy - Math.cos(a) * r); g.rotate(inward ? a + Math.PI : a); g.fillText(c, 0, 0); g.restore();
  });
}

/**
 * One tin's 360-degree wrap. family: 0 banded roundel, 1 oval cartouche, 2 art-nouveau frame, 3 printed paper label
 * (glued over bare tin; drawn as paper, no gilt). The soup name is sized to stay within the front ~100 degrees
 * (<= 220 of 768 units) so it never wraps out of sight; the side seam sits at the back (u = 0 / 1).
 */
function drawLabel(g, i, letter, mode, H, style, family = 0) {
  const W = 768;
  const pal = PALETTES[(i * 3 + 1) % PALETTES.length];
  const soup = SOUPS[(i * 5 + 3) % SOUPS.length];
  const C = mode === 'c';
  const paper = family === 3;
  const ink = (css, kind = 'ink') => (C ? css : (paper && kind !== 'rust' && kind !== 'tin' ? ORM.paper : ORM[kind]));
  const gold = (x0, y0, x1, y1) => (C ? goldGrad(g, x0, y0, x1, y1) : ORM.gold);
  const R = rng(i * 97 + 13);
  const cx = W / 2, cy = H / 2;
  const squat = H < 200;
  const mis = C ? [((i * 37) % 7 - 3) * 0.45, ((i * 53) % 5 - 2) * 0.4] : [0, 0];
  g.save();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const RIM = paper ? 8 : 17;

  // ---------------------------------------------------------------- ground
  if (paper) {
    g.fillStyle = C ? '#d8c8a0' : ORM.paper; g.fillRect(0, 0, W, H);
    if (C) {
      // laid paper: chain lines, fibres, a little foxing
      g.save(); g.globalAlpha = 0.07; g.fillStyle = '#5a4020';
      for (let x = 0; x < W; x += 26) g.fillRect(x, 0, 1, H);
      for (let k = 0; k < 600; k++) g.fillRect(R() * W, R() * H, 2 + R() * 8, 0.6);
      g.restore();
    }
  } else {
    g.fillStyle = ink(pal.ground); g.fillRect(0, 0, W, H);
    if (C) {
      g.save(); g.globalAlpha = 0.14; g.strokeStyle = '#000'; g.lineWidth = 1;
      if (family === 2) {
        const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(0.5, 'rgba(255,235,190,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0.9)');
        g.globalAlpha = 0.25; g.fillStyle = gr; g.fillRect(0, 0, W, H);
      } else if (style === 1) { for (let x = 0; x < W; x += 7) { g.fillStyle = 'rgba(255,240,200,0.6)'; g.fillRect(x, 0, 1.6, H); } }
      else if (style === 2) { for (let y = 0; y < H; y += 20) for (let x = ((y / 20) % 2) * 20; x < W; x += 40) { g.fillStyle = 'rgba(255,240,200,0.5)'; g.beginPath(); g.moveTo(x, y + 10); g.lineTo(x + 10, y); g.lineTo(x + 20, y + 10); g.lineTo(x + 10, y + 20); g.fill(); } }
      else for (let x = -H; x < W; x += 5) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); }
      g.restore();
    }
  }
  // ---------------------------------------------------------------- rims
  if (paper) {
    g.fillStyle = ink('#8a1e16'); g.fillRect(0, 3, W, 3); g.fillRect(0, H - 6, W, 3);
    g.fillRect(0, 9, W, 1); g.fillRect(0, H - 10, W, 1);
  } else {
    for (const y of [0, H - RIM]) {
      g.fillStyle = gold(0, y, 0, y + RIM); g.fillRect(0, y, W, RIM);
      g.strokeStyle = ink('rgba(60,36,10,0.8)', 'gold'); g.lineWidth = 1.3;
      if (family === 1) { for (let x = 0; x < W + 12; x += 9) { g.beginPath(); g.moveTo(x, y + 3); g.lineTo(x + 4.5, y + RIM - 3); g.stroke(); } }
      else if (family === 2) { g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, y + RIM / 2 + Math.sin(x * 0.12) * 4); g.stroke(); }
      else for (let x = 0; x < W + 12; x += 12) { g.beginPath(); g.ellipse(x, y + RIM / 2, 6.5, 3.4, 0, 0, Math.PI * 2); g.stroke(); }
    }
    g.fillStyle = ink(pal.panel); g.fillRect(0, RIM + 2, W, 1.6); g.fillRect(0, H - RIM - 3.6, W, 1.6);
  }

  // ---------------------------------------------------------------- sides & back
  const medallion = (x, y, r) => {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = gold(x - r, y - r, x + r, y + r); g.fill();
    g.beginPath(); g.arc(x, y, r * 0.82, 0, Math.PI * 2); g.fillStyle = ink(pal.ground); g.fill();
    g.strokeStyle = ink(pal.panel); g.lineWidth = 1; g.beginPath(); g.arc(x, y, r * 0.76, 0, Math.PI * 2); g.stroke();
    g.fillStyle = ink(pal.panel); g.font = `600 ${r * 0.2}px Cinzel, Georgia, serif`;
    const t = 'STAUF & CO · LONDON · BY APPOINTMENT · ';
    for (let k = 0; k < t.length; k++) {
      const a = -Math.PI / 2 + (k / t.length) * Math.PI * 2;
      g.save(); g.translate(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62); g.rotate(a + Math.PI / 2); g.fillText(t[k], 0, 0); g.restore();
    }
    g.fillStyle = gold(x - r * 0.3, y - r * 0.3, x + r * 0.3, y + r * 0.3);
    g.beginPath(); g.ellipse(x, y + r * 0.05, r * 0.3, r * 0.16, 0, 0, Math.PI); g.fill();
    g.beginPath(); g.ellipse(x, y + r * 0.03, r * 0.33, r * 0.06, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x, y, r * 0.24, r * 0.15, 0, Math.PI, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x, y - r * 0.17, r * 0.04, 0, Math.PI * 2); g.fill();
  };
  const sideX = 250;
  if (paper) {
    // printed side columns: maker's address, contents, a small engraved tureen
    g.fillStyle = ink('#2a1a10');
    for (const sd of [-1, 1]) {
      const x = cx + sd * sideX;
      g.font = '600 15px Cinzel, Georgia, serif';
      const lines = sd < 0 ? ['PREPARED BY', 'STAUF & Co.', 'PURVEYORS', 'LONDON'] : ['CONTENTS', soup, WEIGHTS[i % WEIGHTS.length], 'KEEP COOL'];
      const n = squat ? 2 : lines.length;
      const step = (H - 2 * RIM - 30) / Math.max(n, 1);
      for (let k = 0; k < n; k++) { g.font = k % 2 ? 'italic 16px "IM Fell English", Georgia, serif' : '600 14px Cinzel, Georgia, serif'; spaced(g, lines[k], x, RIM + 22 + step * (k + 0.5) - 8, 1.5, 150); }
    }
  } else {
    const sideR = squat ? 30 : Math.min(54, H * 0.2);
    medallion(cx - sideX, cy, sideR);
    medallion(cx + sideX, cy, sideR);
    if (!squat) {
      g.fillStyle = ink(pal.panel); g.font = '600 14px Cinzel, Georgia, serif';
      spaced(g, WEIGHTS[i % WEIGHTS.length], cx + sideX, cy + sideR + 16, 2);
      spaced(g, 'EST. 1871', cx - sideX, cy + sideR + 16, 2);
      spaced(g, 'SUPERIOR', cx - sideX, cy - sideR - 14, 2);
      spaced(g, 'SOUPS', cx + sideX, cy - sideR - 14, 2);
    }
  }
  // directions tablet on the back, either side of the side seam (u = 0 / 1)
  for (const x0 of [0, W]) {
    const tw = squat ? 80 : 92;
    if (!paper) {
      g.fillStyle = ink(pal.panel);
      g.beginPath(); g.roundRect(x0 - tw, RIM + 14, 2 * tw, H - 2 * RIM - 28, 8); g.fill();
      g.strokeStyle = gold(x0 - tw, 0, x0 + tw, 0); g.lineWidth = 2.5; g.stroke();
    }
    g.fillStyle = ink(paper ? '#2a1a10' : pal.ink);
    const lines = squat ? ['DIRECTIONS', 'Add one tin of water.', 'Heat — do not boil.'] : ['DIRECTIONS', 'Empty into a pan, add', 'one tin of water, heat', 'gently. Do not boil.', 'Serve to the guest', 'before he asks.'];
    lines.forEach((ln, k) => { g.font = k ? 'italic 15px "IM Fell English", Georgia, serif' : '600 13px Cinzel, Georgia, serif'; g.fillText(ln, x0, RIM + 34 + k * ((H - 2 * RIM - 50) / Math.max(lines.length - 1, 1))); });
  }

  // ---------------------------------------------------------------- front
  const top = RIM + 4, bot = H - RIM - 4, avail = bot - top;
  g.save(); g.translate(mis[0], mis[1]);
  const ribbon = (x, y, w, txt, size) => {
    g.fillStyle = ink(pal.panel);
    g.beginPath(); g.moveTo(x - w / 2, y - 13); g.quadraticCurveTo(x, y - 21, x + w / 2, y - 13); g.lineTo(x + w / 2 - 10, y + 1); g.lineTo(x + w / 2, y + 14); g.quadraticCurveTo(x, y + 6, x - w / 2, y + 14); g.lineTo(x - w / 2 + 10, y + 1); g.closePath(); g.fill();
    g.strokeStyle = gold(x - w / 2, y, x + w / 2, y); g.lineWidth = 2.2; g.stroke();
    g.fillStyle = ink(pal.accent); g.font = `700 ${size}px Cinzel, Georgia, serif`;
    spaced(g, txt, x, y - 2, 3, w - 36);
  };
  const namePlate = (x, y, w, h, font = 'Cinzel, Georgia, serif', weight = 700) => {
    g.fillStyle = ink(pal.accent);
    g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); g.fill();
    g.strokeStyle = gold(x - w / 2, y - h / 2, x + w / 2, y + h / 2); g.lineWidth = 2.2; g.stroke();
    g.fillStyle = ink(pal.panel); g.font = `${weight} ${h * 0.62}px ${font}`;
    spaced(g, soup, x, y + 1, 1.5, w - h * 0.9);
  };
  let rr, ry, letterFont = 'cinzel', shapeKind = style, letterCol = pal.letter;
  if (family === 0) {
    // banded: ribbon over a gilt roundel over a pill name plate, laurel either side
    if (squat) {
      rr = Math.min(44, avail * 0.38); ry = top + rr + 2;
      ribbon(cx - 112, cy - 4, 104, 'STAUF’S', 17);
      g.fillStyle = ink(pal.panel); g.font = 'italic 18px "IM Fell English", Georgia, serif'; g.fillText('superior', cx + 112, cy - 10); g.fillText('soup', cx + 112, cy + 10);
      namePlate(cx, bot - 11, 176, 21);
    } else {
      rr = Math.min(66, avail * 0.23); ry = cy - 4;
      ribbon(cx, ry - rr - 22, 200, 'STAUF’S', 24);
      namePlate(cx, ry + rr + 24, 196, 30);
      if (H > 300) { g.fillStyle = ink(pal.panel); g.font = 'italic 16px "IM Fell English", Georgia, serif'; g.fillText('superior soup · condensed', cx, ry + rr + 52); }
      for (const sd of [-1, 1]) for (let k = 0; k < 7; k++) {
        const a = (k / 6) * 1.9 - 0.95;
        const px = cx + sd * (rr + 14 + Math.cos(a) * 8), py = ry + Math.sin(a) * (rr * 0.95);
        g.save(); g.translate(px, py); g.rotate(sd * (a + Math.PI / 2) * 0.9);
        g.fillStyle = gold(-9, -4, 9, 4); g.beginPath(); g.ellipse(0, 0, 9, 3.3, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
  } else if (family === 1) {
    // oval cartouche: a tall cream oval framed in gilt; name arched round its top, the maker below the initial
    const ow = squat ? 128 : 150, oh = avail * 0.5;
    ry = cy + (squat ? 0 : 6);
    g.beginPath(); g.ellipse(cx, cy, ow / 2 + 7, oh + 6, 0, 0, Math.PI * 2); g.fillStyle = gold(cx - ow, cy - oh, cx + ow, cy + oh); g.fill();
    g.beginPath(); g.ellipse(cx, cy, ow / 2, oh - 1, 0, 0, Math.PI * 2); g.fillStyle = ink(pal.panel); g.fill();
    g.strokeStyle = ink(pal.accent); g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy, ow / 2 - 6, oh - 7, 0, 0, Math.PI * 2); g.stroke();
    // flanking scroll brackets in gilt
    for (const sd of [-1, 1]) {
      g.strokeStyle = gold(cx + sd * ow / 2, cy - 20, cx + sd * (ow / 2 + 40), cy + 20); g.lineWidth = 4;
      g.beginPath(); g.moveTo(cx + sd * (ow / 2 + 6), cy - oh * 0.5); g.bezierCurveTo(cx + sd * (ow / 2 + 40), cy - oh * 0.3, cx + sd * (ow / 2 + 40), cy + oh * 0.3, cx + sd * (ow / 2 + 6), cy + oh * 0.5); g.stroke();
      g.beginPath(); g.arc(cx + sd * (ow / 2 + 30), cy, 5, 0, Math.PI * 2); g.fillStyle = gold(cx - 5, cy - 5, cx + 5, cy + 5); g.fill();
    }
    g.fillStyle = ink(pal.accent);
    g.font = `700 ${squat ? 12 : 16}px Cinzel, Georgia, serif`;
    fitText(g, soup, cx, cy - oh * 0.6, ow * 0.74);
    g.fillRect(cx - ow * 0.25, cy - oh * 0.6 + (squat ? 9 : 12), ow * 0.5, 1.2);
    g.fillStyle = ink(pal.ink); g.font = `italic ${squat ? 12 : 16}px "IM Fell English", Georgia, serif`;
    fitText(g, 'Stauf’s Superior', cx, cy + oh * 0.66, ow * 0.7);
    rr = Math.min(ow * 0.36, oh * 0.44); ry = cy + oh * 0.02;
    shapeKind = -1; letterCol = pal.ground;
  } else if (family === 2) {
    // art-nouveau frame: an arched panel with whiplash corners, the name in a straight IM Fell banner below
    const pw = squat ? 150 : 170, ph = avail - 8;
    const x0 = cx - pw / 2, y0 = top + 4;
    const arch = () => { g.beginPath(); g.moveTo(x0, y0 + ph); g.lineTo(x0, y0 + pw * 0.35); g.quadraticCurveTo(x0, y0, cx, y0); g.quadraticCurveTo(x0 + pw, y0, x0 + pw, y0 + pw * 0.35); g.lineTo(x0 + pw, y0 + ph); g.closePath(); };
    arch(); g.fillStyle = gold(x0, y0, x0 + pw, y0 + ph); g.fill();
    g.save(); g.translate(cx, y0 + ph / 2); g.scale(0.94, 0.95); g.translate(-cx, -(y0 + ph / 2)); arch(); g.fillStyle = ink(pal.panel); g.fill(); g.restore();
    // whiplash tendrils at the foot of the arch
    g.strokeStyle = gold(x0 - 40, y0, x0 + pw + 40, y0 + ph); g.lineWidth = 3; g.lineCap = 'round';
    for (const sd of [-1, 1]) {
      const bx = cx + sd * pw / 2;
      g.beginPath(); g.moveTo(bx, y0 + ph * 0.75); g.bezierCurveTo(bx + sd * 30, y0 + ph * 0.95, bx + sd * 50, y0 + ph * 0.4, bx + sd * 24, y0 + ph * 0.3); g.bezierCurveTo(bx + sd * 10, y0 + ph * 0.25, bx + sd * 18, y0 + ph * 0.42, bx + sd * 28, y0 + ph * 0.4); g.stroke();
      g.beginPath(); g.ellipse(bx + sd * 40, y0 + ph * 0.62, 7, 15, sd * 0.5, 0, Math.PI * 2); g.fillStyle = gold(bx, y0, bx + 40, y0 + ph); g.fill();
    }
    g.fillStyle = ink(pal.accent); g.font = `italic ${squat ? 13 : 17}px "IM Fell English", Georgia, serif`;
    g.fillText('Stauf’s', cx, y0 + (squat ? 16 : 22));
    // straight banner over the panel's foot
    const bh = squat ? 20 : 26, by = y0 + ph - bh / 2 - 4;
    g.fillStyle = ink(pal.accent); g.fillRect(cx - pw / 2 - 18, by - bh / 2, pw + 36, bh);
    g.strokeStyle = gold(cx - pw, by, cx + pw, by); g.lineWidth = 2; g.strokeRect(cx - pw / 2 - 18, by - bh / 2, pw + 36, bh);
    g.fillStyle = ink(pal.panel); g.font = `italic ${bh * 0.78}px "IM Fell English", Georgia, serif`;
    fitText(g, soup.charAt(0) + soup.slice(1).toLowerCase(), cx, by + 1, pw + 20);
    rr = Math.min(pw * 0.36, (ph - bh - (squat ? 26 : 40)) * 0.5); ry = y0 + (squat ? 26 : 36) + rr;
    shapeKind = 3; letterFont = 'cormorant';
  } else {
    // printed paper label: letterpress in black and red, the initial in a red-ruled circle
    rr = Math.min(squat ? 40 : 58, avail * 0.3); ry = cy - (squat ? 2 : 8);
    g.fillStyle = ink('#1c120c');
    if (squat) {
      g.font = '700 22px Cinzel, Georgia, serif'; spaced(g, 'STAUF’S', cx - 118, cy - 10, 2, 120);
      g.font = 'italic 16px "IM Fell English", Georgia, serif'; g.fillText('superior soup', cx - 118, cy + 14);
      g.font = '600 15px Cinzel, Georgia, serif'; g.fillStyle = ink('#8a1e16'); spaced(g, soup, cx + 118, cy - 4, 1.5, 120);
      g.fillStyle = ink('#1c120c'); g.font = 'italic 13px "IM Fell English", Georgia, serif'; g.fillText(WEIGHTS[i % WEIGHTS.length], cx + 118, cy + 16);
    } else {
      g.font = '700 26px Cinzel, Georgia, serif'; spaced(g, 'STAUF’S', cx, top + 19, 4, 200);
      g.fillStyle = ink('#8a1e16'); g.font = '400 14px "IM Fell English SC", Georgia, serif'; spaced(g, 'SUPERIOR SOUPS', cx, top + 39, 3, 190);
      g.fillStyle = ink('#1c120c'); g.font = '600 22px Cinzel, Georgia, serif'; spaced(g, soup, cx, bot - 30, 1.5, 200);
      g.fillStyle = ink('#8a1e16'); g.fillRect(cx - 95, bot - 52, 190, 1.5); g.fillRect(cx - 95, bot - 13, 190, 1.5);
      ry = (top + 52 + bot - 56) / 2; rr = Math.min(72, (bot - 56 - (top + 52)) * 0.5);
    }
    g.strokeStyle = ink('#8a1e16'); g.lineWidth = 3; g.beginPath(); g.arc(cx, ry, rr, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1; g.beginPath(); g.arc(cx, ry, rr - 5, 0, Math.PI * 2); g.stroke();
    shapeKind = -2; letterCol = '#1c120c'; letterFont = 'fell';
  }
  // the roundel for families 0 & 2 (gilt ring, beads, engraved field)
  const shape = (r) => {
    g.beginPath();
    if (shapeKind === 1) { for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; const q = r * (k % 2 ? 0.94 : 1); g.lineTo(cx + Math.cos(a) * q, ry + Math.sin(a) * q); } g.closePath(); }
    else if (shapeKind === 2) { for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; g.lineTo(cx + Math.cos(a) * r, ry + Math.sin(a) * r); } g.closePath(); }
    else if (shapeKind === 3) { for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; g.moveTo(cx + Math.cos(a) * r * 0.45 + r * 0.55, ry + Math.sin(a) * r * 0.45); g.arc(cx + Math.cos(a) * r * 0.45, ry + Math.sin(a) * r * 0.45, r * 0.55, 0, Math.PI * 2); } }
    else g.arc(cx, ry, r, 0, Math.PI * 2);
  };
  if (shapeKind >= 0) {
    shape(rr); g.fillStyle = gold(cx - rr, ry - rr, cx + rr, ry + rr); g.fill();
    shape(rr * 0.9); g.fillStyle = ink(pal.ground); g.fill();
    if (shapeKind !== 3) { g.fillStyle = ink(pal.panel, 'gold'); for (let k = 0; k < 36; k++) { const a = (k / 36) * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * rr * 0.85, ry + Math.sin(a) * rr * 0.85, 1.5, 0, Math.PI * 2); g.fill(); } }
    shape(rr * 0.79); g.fillStyle = gold(cx, ry - rr, cx, ry + rr); g.fill();
    shape(rr * 0.75);
    if (C) { const fg = g.createRadialGradient(cx - rr * 0.25, ry - rr * 0.3, rr * 0.1, cx, ry, rr * 0.8); fg.addColorStop(0, pal.panel); fg.addColorStop(1, pal.field); g.fillStyle = fg; } else g.fillStyle = ORM.ink;
    g.fill();
    if (C) { g.save(); shape(rr * 0.75); g.clip(); g.strokeStyle = 'rgba(60,40,20,0.22)'; g.lineWidth = 0.9; for (let y = ry - rr; y < ry + rr; y += 3.2) { g.beginPath(); g.moveTo(cx - rr, y); g.lineTo(cx + rr, y); g.stroke(); } g.restore(); }
  }
  g.restore();   // colour pass done

  // the initial: drop shadow, colour fill, then the black keyline (unshifted, so it misregisters a hair)
  const fs = rr * (letterFont === 'fell' ? 1.5 : letterFont === 'cormorant' ? 1.55 : 1.38);
  g.font = letterFont === 'fell' ? `400 ${fs}px "IM Fell English SC", Georgia, serif` : letterFont === 'cormorant' ? `500 ${fs}px "Cormorant Garamond", Georgia, serif` : `700 ${fs}px Cinzel, Georgia, serif`;
  const ly = ry + fs * (letterFont === 'cinzel' ? 0.06 : 0.04);
  if (C && !paper) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillText(letter, cx + 2.5, ly + 3); }
  g.fillStyle = ink(letterCol); g.fillText(letter, cx + mis[0], ly + mis[1]);
  if (C && !paper) {
    g.strokeStyle = 'rgba(15,8,4,0.85)'; g.lineWidth = 1.2; g.strokeText(letter, cx, ly);
    g.strokeStyle = 'rgba(255,240,200,0.4)'; g.lineWidth = 0.8; g.strokeText(letter, cx - 1.2, ly - 1.2);
    if (shapeKind >= 0) { g.strokeStyle = 'rgba(15,8,4,0.6)'; g.lineWidth = 1; shape(rr + 0.5); g.stroke(); }
  }
  if (C && paper) {   // letterpress: ink squeezed darker at the edges of the letter, a little uneven
    g.strokeStyle = 'rgba(10,6,4,0.5)'; g.lineWidth = 1.4; g.strokeText(letter, cx, ly);
  }

  // ---------------------------------------------------------------- print & age
  if (C) {
    if (!paper) {
      g.save(); g.globalCompositeOperation = 'multiply';
      for (let y = 1.5; y < H; y += 3) for (let x = (Math.floor(y / 3) % 2) * 1.5; x < W; x += 3) {
        const d = 0.55 + 0.35 * Math.sin(x * 0.013 + i) * Math.sin(y * 0.021 + i * 2);
        g.fillStyle = `rgba(120,100,80,${0.1 * d})`; g.fillRect(x, y, 1.1, 1.1);
      }
      g.restore();
    }
    const fade = g.createLinearGradient(0, 0, W, 0);
    fade.addColorStop(0, 'rgba(235,220,185,0.14)'); fade.addColorStop(0.3, 'rgba(235,220,185,0.0)'); fade.addColorStop(0.7, 'rgba(235,220,185,0.0)'); fade.addColorStop(1, 'rgba(235,220,185,0.14)');
    g.fillStyle = fade; g.fillRect(0, 0, W, H);
    for (let k = 0; k < (paper ? 14 : 8); k++) {
      const x = R() * W, y = R() * H, r = 18 + R() * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${paper ? '110,70,20' : '30,18,6'},${paper ? 0.16 : 0.2})`); gr.addColorStop(1, 'rgba(30,18,6,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (paper) {
      // a dried water ring and glue showing through as darker blotches
      g.strokeStyle = 'rgba(110,70,30,0.35)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx + 120 + R() * 80, H * 0.7, 40, H * 0.3, 0.2, 0, Math.PI * 1.6); g.stroke();
      for (let k = 0; k < 6; k++) { const x = R() * W, y = R() * H, r = 10 + R() * 20; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(150,110,50,0.22)'); gr.addColorStop(1, 'rgba(150,110,50,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    }
  }
  if (!paper) {
    // scratches to bare tin
    g.strokeStyle = ink('rgba(200,200,195,0.85)', 'tin');
    for (let k = 0; k < 22; k++) {
      const x = R() * W, y = 20 + R() * (H - 40), l = 5 + R() * 34, a = (R() - 0.5) * 0.9;
      g.lineWidth = 0.5 + R() * 1.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let k = 0; k < 70; k++) {
      const x = R() * W, tp = R() < 0.5;
      const y = tp ? R() * (RIM + 6) : H - R() * (RIM + 6);
      g.fillStyle = ink('rgba(196,194,186,0.8)', 'tin');
      g.beginPath(); g.ellipse(x, y, 2 + R() * 9, 0.8 + R() * 2.2, 0, 0, Math.PI * 2); g.fill();
    }
  }
  // varnish scuffs across the front (ink rubbed; in the ORM pass they raise the clearcoat roughness)
  for (let k = 0; k < 7; k++) {
    const x = cx + (R() - 0.5) * 320, y = R() * H, rx = 10 + R() * 34, ry2 = 2 + R() * 5, a = (R() - 0.5) * 0.6;
    if (C) { g.fillStyle = paper ? 'rgba(90,60,30,0.1)' : 'rgba(230,215,180,0.18)'; g.beginPath(); g.ellipse(x, y, rx, ry2, a, 0, Math.PI * 2); g.fill(); }
    else { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgb(0,70,0)'; g.beginPath(); g.ellipse(x, y, rx, ry2, a, 0, Math.PI * 2); g.fill(); g.restore(); }
  }
  // rust: blooms at the side seam and along the bottom rim (paper: foxing at the glued lap instead)
  for (let k = 0; k < 12; k++) {
    const seam = R() < 0.55;
    const x = seam ? (R() < 0.5 ? R() * 26 : W - R() * 26) : R() * W;
    const y = seam ? R() * H : H - R() * (RIM + 10);
    const r = 2.5 + R() * (seam ? 9 : 6);
    if (C) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      if (paper) { gr.addColorStop(0, 'rgba(120,70,25,0.5)'); gr.addColorStop(1, 'rgba(120,70,25,0)'); }
      else { gr.addColorStop(0, 'rgba(96,38,12,0.95)'); gr.addColorStop(0.6, 'rgba(130,62,22,0.6)'); gr.addColorStop(1, 'rgba(130,62,22,0)'); }
      g.fillStyle = gr;
    } else g.fillStyle = paper ? ORM.paper : ORM.rust;
    g.beginPath(); g.arc(x, y, r * (C ? 1 : 0.6), 0, Math.PI * 2); g.fill();
  }
  // the seam: a soldered lap on lithographed tins; on paper a glued overlap with a darker glue line
  if (paper) { g.fillStyle = C ? 'rgba(120,85,40,0.45)' : ORM.paper; g.fillRect(0, 0, 9, H); g.fillStyle = C ? 'rgba(60,40,20,0.5)' : ORM.paper; g.fillRect(8, 0, 1.5, H); }
  else { g.fillStyle = ink('rgba(150,148,140,0.9)', 'tin'); g.fillRect(0, 0, 3, H); g.fillRect(W - 2, 0, 2, H); }
  g.restore();
}

/**
 * Build both atlases. heights[i] = authored label height (units, width 768) for tin i.
 * Returns { map, orm, uvRect(i) } (uv rect covers exactly that label's area).
 */
export async function buildLabelAtlas(letters, { extras = [], heights = [], families = [] } = {}) {
  try {
    await Promise.all([
      document.fonts.load('700 112px Cinzel'), document.fonts.load('600 30px Cinzel'),
      document.fonts.load('italic 31px "IM Fell English"'), document.fonts.load('31px "IM Fell English"'),
      document.fonts.load('400 60px "IM Fell English SC"'), document.fonts.load('500 60px "Cormorant Garamond"'),
    ]);
  } catch { /* fall back to Georgia */ }
  const W = CELL_W * COLS, H = CELL_H * ROWS;
  const all = [...letters, ...extras];
  const hOf = (i) => Math.min(CELL_H / S, heights[i] || 270);
  const mk = (mode) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    all.forEach((L, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      g.save(); g.translate(col * CELL_W, row * CELL_H);
      g.beginPath(); g.rect(0, 0, CELL_W, hOf(i) * S); g.clip();
      g.scale(S, S);
      drawLabel(g, i, L, mode, hOf(i), i >= letters.length ? 0 : (i * 7) % 3, families[i] || 0);
      g.restore();
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = mode === 'c' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    t.flipY = true;
    return t;
  };
  const map = mk('c');
  const orm = mk('o');
  const uvRect = (i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const hp = hOf(i) * S;
    // flipY = true: v = 1 at canvas top
    return { u0: col / COLS, u1: (col + 1) / COLS, v0: 1 - (row * CELL_H + hp) / H, v1: 1 - (row * CELL_H) / H };
  };
  return { map, orm, uvRect };
}
