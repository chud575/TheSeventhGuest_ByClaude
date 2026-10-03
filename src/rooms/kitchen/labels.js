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
const ORM = { ink: 'rgb(255,120,40)', gold: 'rgb(255,80,235)', tin: 'rgb(255,70,255)', rust: 'rgb(255,240,0)' };

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

function drawLabel(g, i, letter, mode, H, style) {
  const W = 768;
  const pal = PALETTES[(i * 3 + 1) % PALETTES.length];
  const soup = SOUPS[(i * 5 + 3) % SOUPS.length];
  const C = mode === 'c';
  const ink = (css, kind = 'ink') => (C ? css : ORM[kind]);
  const gold = (x0, y0, x1, y1) => (C ? goldGrad(g, x0, y0, x1, y1) : ORM.gold);
  const R = rng(i * 97 + 13);
  const cx = W / 2, cy = H / 2;
  const squat = H < 220;
  // registration offset of the colour pass relative to the black keyline
  const mis = C ? [((i * 37) % 7 - 3) * 0.45, ((i * 53) % 5 - 2) * 0.4] : [0, 0];
  g.save();
  g.textAlign = 'center'; g.textBaseline = 'middle';

  // ---------------------------------------------------------------- ground
  g.fillStyle = ink(pal.ground); g.fillRect(0, 0, W, H);
  if (C) {
    g.save(); g.globalAlpha = 0.14; g.strokeStyle = '#000'; g.lineWidth = 1;
    if (style === 1) { for (let x = 0; x < W; x += 7) { g.fillStyle = 'rgba(255,240,200,0.6)'; g.fillRect(x, 0, 1.6, H); } }
    else if (style === 2) { for (let y = 0; y < H; y += 20) for (let x = ((y / 20) % 2) * 20; x < W; x += 40) { g.fillStyle = 'rgba(255,240,200,0.5)'; g.beginPath(); g.moveTo(x, y + 10); g.lineTo(x + 10, y); g.lineTo(x + 20, y + 10); g.lineTo(x + 10, y + 20); g.fill(); } }
    else for (let x = -H; x < W; x += 5) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); }
    g.restore();
  }
  // ---------------------------------------------------------------- crimped gold rims with a chain border
  const RIM = 17;
  for (const y of [0, H - RIM]) {
    g.fillStyle = gold(0, y, 0, y + RIM); g.fillRect(0, y, W, RIM);
    g.strokeStyle = ink('rgba(60,36,10,0.8)', 'gold'); g.lineWidth = 1.3;
    for (let x = 0; x < W + 12; x += 12) { g.beginPath(); g.ellipse(x, y + RIM / 2, 6.5, 3.4, 0, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = ink('rgba(255,245,200,0.35)', 'gold');
    for (let x = 6; x < W + 12; x += 12) { g.fillRect(x - 2, y + RIM / 2 - 0.6, 4, 1.2); }
  }
  g.fillStyle = ink(pal.panel); g.fillRect(0, RIM + 2, W, 1.6); g.fillRect(0, H - RIM - 3.6, W, 1.6);

  // ---------------------------------------------------------------- sides & back: medallion, directions, seam
  const medallion = (x, y, r) => {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = gold(x - r, y - r, x + r, y + r); g.fill();
    g.beginPath(); g.arc(x, y, r * 0.82, 0, Math.PI * 2); g.fillStyle = ink(pal.ground); g.fill();
    g.strokeStyle = ink(pal.panel); g.lineWidth = 1; g.beginPath(); g.arc(x, y, r * 0.76, 0, Math.PI * 2); g.stroke();
    // text around the ring
    g.fillStyle = ink(pal.panel); g.font = `600 ${r * 0.2}px Cinzel, Georgia, serif`;
    const t = 'STAUF & CO · LONDON · BY APPOINTMENT · ';
    for (let k = 0; k < t.length; k++) {
      const a = -Math.PI / 2 + (k / t.length) * Math.PI * 2;
      g.save(); g.translate(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62); g.rotate(a + Math.PI / 2); g.fillText(t[k], 0, 0); g.restore();
    }
    // a little tureen device in the centre
    g.fillStyle = gold(x - r * 0.3, y - r * 0.3, x + r * 0.3, y + r * 0.3);
    g.beginPath(); g.ellipse(x, y + r * 0.05, r * 0.3, r * 0.16, 0, 0, Math.PI); g.fill();
    g.beginPath(); g.ellipse(x, y + r * 0.03, r * 0.33, r * 0.06, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x, y, r * 0.24, r * 0.15, 0, Math.PI, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x, y - r * 0.17, r * 0.04, 0, Math.PI * 2); g.fill();
  };
  const sideR = squat ? 30 : Math.min(54, H * 0.2);
  const sideX = squat ? 265 : 250;
  medallion(cx - sideX, cy, sideR);
  medallion(cx + sideX, cy, sideR);
  if (!squat) {
    g.fillStyle = ink(pal.panel); g.font = '600 14px Cinzel, Georgia, serif';
    spaced(g, WEIGHTS[i % WEIGHTS.length], cx + sideX, cy + sideR + 16, 2);
    spaced(g, 'EST. 1871', cx - sideX, cy + sideR + 16, 2);
    spaced(g, 'SUPERIOR', cx - sideX, cy - sideR - 14, 2);
    spaced(g, 'SOUPS', cx + sideX, cy - sideR - 14, 2);
  }
  // directions tablet on the back, either side of the side seam (u = 0 / 1)
  for (const x0 of [0, W]) {
    g.fillStyle = ink(pal.panel);
    const tw = squat ? 80 : 92;
    g.beginPath(); g.roundRect(x0 - tw, RIM + 14, 2 * tw, H - 2 * RIM - 28, 8); g.fill();
    g.strokeStyle = gold(x0 - tw, 0, x0 + tw, 0); g.lineWidth = 2.5; g.stroke();
    g.fillStyle = ink(pal.ink); g.font = '600 13px Cinzel, Georgia, serif';
    const lines = squat ? ['DIRECTIONS', 'Add one tin of water.', 'Heat — do not boil.'] : ['DIRECTIONS', 'Empty into a pan, add', 'one tin of water, heat', 'gently. Do not boil.', 'Serve to the guest', 'before he asks.'];
    lines.forEach((ln, k) => { g.font = k ? 'italic 15px "IM Fell English", Georgia, serif' : '600 13px Cinzel, Georgia, serif'; g.fillText(ln, x0, RIM + 34 + k * ((H - 2 * RIM - 50) / Math.max(lines.length - 1, 1))); });
  }
  // ---------------------------------------------------------------- front: ribbon, roundel, name plate
  const rr = squat ? Math.min(58, H * 0.36) : Math.min(68, H * 0.24);
  const ry = squat ? cy : cy - (H > 300 ? 6 : 2);
  g.save(); g.translate(mis[0], mis[1]);
  // maker's ribbon above the roundel (or flanking it on squat tins)
  const ribbon = (x, y, w, txt, size) => {
    g.fillStyle = ink(pal.panel);
    g.beginPath(); g.moveTo(x - w / 2, y - 15); g.quadraticCurveTo(x, y - 25, x + w / 2, y - 15); g.lineTo(x + w / 2 - 12, y + 1); g.lineTo(x + w / 2, y + 16); g.quadraticCurveTo(x, y + 6, x - w / 2, y + 16); g.lineTo(x - w / 2 + 12, y + 1); g.closePath(); g.fill();
    g.strokeStyle = gold(x - w / 2, y, x + w / 2, y); g.lineWidth = 2.2; g.stroke();
    g.fillStyle = ink(pal.accent); g.font = `700 ${size}px Cinzel, Georgia, serif`;
    spaced(g, txt, x, y - 2, 3, w - 40);
  };
  // name plate below the roundel
  const plate = (x, y, w, h) => {
    g.fillStyle = ink(pal.accent);
    g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); g.fill();
    g.strokeStyle = gold(x - w / 2, y - h / 2, x + w / 2, y + h / 2); g.lineWidth = 2.5; g.stroke();
    g.fillStyle = ink(pal.panel); g.font = `700 ${h * 0.6}px Cinzel, Georgia, serif`;
    spaced(g, soup, x, y + 1, 2, w - h);
  };
  if (squat) {
    ribbon(cx - 136, cy - 22, 150, 'STAUF’S', 22);
    g.fillStyle = ink(pal.panel); g.font = 'italic 19px "IM Fell English", Georgia, serif'; g.fillText('superior soup', cx - 136, cy + 18);
    plate(cx + 140, cy - 6, 160, 30);
    g.fillStyle = ink(pal.panel); g.font = '600 13px Cinzel, Georgia, serif'; spaced(g, WEIGHTS[i % WEIGHTS.length], cx + 140, cy + 24, 2);
  } else {
    ribbon(cx, ry - rr - 24, 236, 'STAUF’S', 26);
    plate(cx, ry + rr + 26, 248, 34);
    g.fillStyle = ink(pal.panel); g.font = '600 12px Cinzel, Georgia, serif';
    if (H > 300) { g.font = 'italic 17px "IM Fell English", Georgia, serif'; g.fillText('superior soup · condensed', cx, ry + rr + 56); }
    // laurel sprays flanking the roundel
    for (const sd of [-1, 1]) {
      for (let k = 0; k < 7; k++) {
        const a = (k / 6) * 1.9 - 0.95;
        const px = cx + sd * (rr + 14 + Math.cos(a) * 8), py = ry + Math.sin(a) * (rr * 0.95);
        g.save(); g.translate(px, py); g.rotate(sd * (a + Math.PI / 2) * 0.9);
        g.fillStyle = gold(-9, -4, 9, 4); g.beginPath(); g.ellipse(0, 0, 9, 3.3, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
  }
  // the roundel: gilt ring, ground ring with beads, then an engraved field with the initial
  const shape = (r) => {
    g.beginPath();
    if (style === 1) { for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; const q = r * (k % 2 ? 0.94 : 1); g.lineTo(cx + Math.cos(a) * q, ry + Math.sin(a) * q); } g.closePath(); }
    else if (style === 2) { for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; g.lineTo(cx + Math.cos(a) * r, ry + Math.sin(a) * r); } g.closePath(); }
    else g.arc(cx, ry, r, 0, Math.PI * 2);
  };
  shape(rr); g.fillStyle = gold(cx - rr, ry - rr, cx + rr, ry + rr); g.fill();
  shape(rr * 0.9); g.fillStyle = ink(pal.ground); g.fill();
  g.fillStyle = ink(pal.panel, 'gold');
  for (let k = 0; k < 36; k++) { const a = (k / 36) * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * rr * 0.85, ry + Math.sin(a) * rr * 0.85, 1.5, 0, Math.PI * 2); g.fill(); }
  shape(rr * 0.79); g.fillStyle = gold(cx, ry - rr, cx, ry + rr); g.fill();
  shape(rr * 0.75);
  if (C) {
    const fg = g.createRadialGradient(cx - rr * 0.25, ry - rr * 0.3, rr * 0.1, cx, ry, rr * 0.8);
    fg.addColorStop(0, pal.panel); fg.addColorStop(1, pal.field);
    g.fillStyle = fg;
  } else g.fillStyle = ORM.ink;
  g.fill();
  if (C) {   // engraved horizontal line-tint in the field
    g.save(); shape(rr * 0.75); g.clip();
    g.strokeStyle = 'rgba(60,40,20,0.22)'; g.lineWidth = 0.9;
    for (let y = ry - rr; y < ry + rr; y += 3.2) { g.beginPath(); g.moveTo(cx - rr, y); g.lineTo(cx + rr, y); g.stroke(); }
    g.restore();
  }
  g.restore();   // colour pass done

  // the engraved initial: drop shadow, colour fill, then the black keyline (unshifted, so it misregisters a hair)
  const fs = rr * 1.38;
  g.font = `700 ${fs}px Cinzel, Georgia, serif`;
  const ly = ry + fs * 0.06;
  if (C) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillText(letter, cx + 2.5, ly + 3); }
  g.fillStyle = ink(pal.letter); g.fillText(letter, cx + mis[0], ly + mis[1]);
  if (C) {
    g.strokeStyle = 'rgba(15,8,4,0.85)'; g.lineWidth = 1.2; g.strokeText(letter, cx, ly);
    g.strokeStyle = 'rgba(255,240,200,0.4)'; g.lineWidth = 0.8; g.strokeText(letter, cx - 1.2, ly - 1.2);
  }
  // black keyline over the front design
  if (C) {
    g.strokeStyle = 'rgba(15,8,4,0.6)'; g.lineWidth = 1;
    shape(rr + 0.5); g.stroke();
  }

  // ---------------------------------------------------------------- print & age
  if (C) {
    // halftone: a fine dot screen multiplied over the inks, coarser where the press ran dry
    g.save(); g.globalCompositeOperation = 'multiply';
    for (let y = 1.5; y < H; y += 3) for (let x = (Math.floor(y / 3) % 2) * 1.5; x < W; x += 3) {
      const d = 0.55 + 0.35 * Math.sin(x * 0.013 + i) * Math.sin(y * 0.021 + i * 2);
      g.fillStyle = `rgba(120,100,80,${0.10 * d})`; g.fillRect(x, y, 1.1, 1.1);
    }
    g.restore();
    // uneven ink film / fading toward the back
    const fade = g.createLinearGradient(0, 0, W, 0);
    fade.addColorStop(0, 'rgba(235,220,185,0.14)'); fade.addColorStop(0.3, 'rgba(235,220,185,0.0)'); fade.addColorStop(0.7, 'rgba(235,220,185,0.0)'); fade.addColorStop(1, 'rgba(235,220,185,0.14)');
    g.fillStyle = fade; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 8; k++) {
      const x = R() * W, y = R() * H, r = 18 + R() * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(30,18,6,0.2)'); gr.addColorStop(1, 'rgba(30,18,6,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  // scratches to bare tin
  g.strokeStyle = ink('rgba(200,200,195,0.85)', 'tin');
  for (let k = 0; k < 22; k++) {
    const x = R() * W, y = 20 + R() * (H - 40), l = 5 + R() * 34, a = (R() - 0.5) * 0.9;
    g.lineWidth = 0.5 + R() * 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // rims rubbed through to tin where the tins are handled and stacked
  for (let k = 0; k < 70; k++) {
    const x = R() * W, top = R() < 0.5;
    const y = top ? R() * (RIM + 6) : H - R() * (RIM + 6);
    g.fillStyle = ink('rgba(196,194,186,0.8)', 'tin');
    g.beginPath(); g.ellipse(x, y, 2 + R() * 9, 0.8 + R() * 2.2, 0, 0, Math.PI * 2); g.fill();
  }
  // label scuffs (ink rubbed, not to bare tin) across the front
  if (C) for (let k = 0; k < 5; k++) {
    const x = cx + (R() - 0.5) * 300, y = R() * H;
    g.fillStyle = 'rgba(230,215,180,0.18)'; g.beginPath(); g.ellipse(x, y, 10 + R() * 30, 2 + R() * 4, (R() - 0.5) * 0.6, 0, Math.PI * 2); g.fill();
  }
  // rust: blooms at the side seam and along the bottom rim
  for (let k = 0; k < 12; k++) {
    const seam = R() < 0.55;
    const x = seam ? (R() < 0.5 ? R() * 26 : W - R() * 26) : R() * W;
    const y = seam ? R() * H : H - R() * (RIM + 10);
    const r = 2.5 + R() * (seam ? 9 : 6);
    if (C) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(96,38,12,0.95)'); gr.addColorStop(0.6, 'rgba(130,62,22,0.6)'); gr.addColorStop(1, 'rgba(130,62,22,0)');
      g.fillStyle = gr;
    } else g.fillStyle = ORM.rust;
    g.beginPath(); g.arc(x, y, r * (C ? 1 : 0.6), 0, Math.PI * 2); g.fill();
  }
  // the side seam itself: a soldered lap line at u = 0
  g.fillStyle = ink('rgba(150,148,140,0.9)', 'tin'); g.fillRect(0, 0, 3, H); g.fillRect(W - 2, 0, 2, H);
  g.restore();
}

/**
 * Build both atlases. heights[i] = authored label height (units, width 768) for tin i.
 * Returns { map, orm, uvRect(i) } (uv rect covers exactly that label's area).
 */
export async function buildLabelAtlas(letters, { extras = [], heights = [] } = {}) {
  try {
    await Promise.all([
      document.fonts.load('700 112px Cinzel'), document.fonts.load('600 30px Cinzel'),
      document.fonts.load('italic 31px "IM Fell English"'),
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
      drawLabel(g, i, L, mode, hOf(i), i >= letters.length ? 0 : (i * 7) % 3);
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
