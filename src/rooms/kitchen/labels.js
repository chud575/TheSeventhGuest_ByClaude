import * as THREE from 'three';

/**
 * Lithographed tin labels for "Stauf's Superior Soups" — drawn on a canvas atlas
 * (colour + a matching ORM atlas so gold inks and scratched tin read metallic while
 * the enamel inks stay dielectric). One cell per can; the big letter sits at
 * u = 0.5 so it faces the room once the can is turned to face outward.
 */

export const CELL_W = 1152, CELL_H = 384, COLS = 3, ROWS = 8;
const S = CELL_W / 768;            // drawing is authored on a 768 x 256 grid

const PALETTES = [
  { ground: '#9e1f1a', panel: '#efe2bf', ink: '#2a120c', accent: '#1d3b2a', letter: '#7a130f' },  // tomato red
  { ground: '#1d4631', panel: '#ecdcb2', ink: '#14231a', accent: '#8f1d18', letter: '#173d29' },  // bottle green
  { ground: '#1b2a57', panel: '#eadfc0', ink: '#111833', accent: '#a3241c', letter: '#1b2a57' },  // navy
  { ground: '#c4952c', panel: '#f1e6c6', ink: '#24170a', accent: '#8d1b17', letter: '#2a1a0c' },  // mustard
  { ground: '#e6d8b0', panel: '#f4ead0', ink: '#2b1a10', accent: '#9a231b', letter: '#9a231b' },  // cream
  { ground: '#5a1622', panel: '#eadcbc', ink: '#250a0f', accent: '#1f3d52', letter: '#5a1622' },  // oxblood
  { ground: '#26474f', panel: '#ece0c0', ink: '#0f2024', accent: '#a5521a', letter: '#26474f' },  // teal
];

const VARIETIES = [
  ['Mock', 'Turtle'], ['Ox', 'Tail'], ['Mulliga-', 'tawny'], ['Cock-a-', 'Leekie'], ['Brown', 'Windsor'], ['Pea', '& Ham'],
  ['Calf’s', 'Head'], ['Scotch', 'Broth'], ['Jugged', 'Hare'], ['Giblet', 'Cream'], ['Mutton', 'Barley'], ['Eel &', 'Parsley'],
  ['Kidney', 'Clear'], ['Cream of', 'Celery'], ['Beef', 'Tea'], ['Julienne', 'Garden'], ['Potage', 'Royal'], ['Oyster', 'Bisque'],
  ['Hotch-', 'potch'], ['Lentil', '& Bacon'], ['Game', 'Consommé'], ['Leek &', 'Potato'], ['Sheep’s', 'Trotter'], ['Nettle', 'Spring'],
];

// ORM encodings (R = ao, G = roughness, B = metalness)
const ORM = { ink: 'rgb(255,105,45)', gold: 'rgb(255,70,235)', tin: 'rgb(255,55,255)', rust: 'rgb(255,240,0)', worn: 'rgb(255,150,90)' };

function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function goldGrad(g, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, '#7a5a1e'); gr.addColorStop(0.35, '#e9c56a'); gr.addColorStop(0.5, '#fff0b0'); gr.addColorStop(0.65, '#d4a94a'); gr.addColorStop(1, '#6e4f18');
  return gr;
}

function drawLabel(g, i, letter, mode, fam) {
  const W = 768, H = 256;
  const pal = PALETTES[(i * 3 + 1) % PALETTES.length];
  const variety = VARIETIES[i % VARIETIES.length];
  const C = mode === 'c';
  const ink = (css, kind = 'ink') => (C ? css : ORM[kind]);
  const gold = (x0, y0, x1, y1) => (C ? goldGrad(g, x0, y0, x1, y1) : ORM.gold);
  const R = rng(i * 97 + 13);
  const cx = W / 2, cy = 142;
  g.save();
  g.textAlign = 'center'; g.textBaseline = 'middle';

  // ground
  g.fillStyle = ink(pal.ground); g.fillRect(0, 0, W, H);
  // fine engraved diagonal hatching on the ground
  if (C) {
    g.globalAlpha = 0.12; g.strokeStyle = '#000'; g.lineWidth = 1;
    for (let x = -H; x < W; x += 5) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); }
    g.globalAlpha = 1;
  }
  // crimped gold bands top and bottom with bead dots
  for (const [y, h] of [[0, 15], [H - 15, 15]]) {
    g.fillStyle = gold(0, y, 0, y + h); g.fillRect(0, y, W, h);
    g.fillStyle = ink('rgba(60,35,10,0.55)', 'gold');
    for (let x = 4; x < W; x += 10) { g.beginPath(); g.arc(x, y + h / 2, 2.2, 0, Math.PI * 2); g.fill(); }
  }
  // thin rules
  g.fillStyle = gold(0, 17, 0, 21); g.fillRect(0, 18, W, 3); g.fillRect(0, H - 21, W, 3);
  g.fillStyle = ink(pal.panel); g.fillRect(0, 23, W, 1.5); g.fillRect(0, H - 24.5, W, 1.5);

  if (fam === 0) drawMedallion(g, i, letter, pal, variety, ink, gold, C, cx, cy);
  else if (fam === 1) drawBanner(g, i, letter, pal, variety, ink, gold, C);
  else if (fam === 2) drawVignette(g, i, letter, pal, variety, ink, gold, C);
  else drawLozenge(g, i, letter, pal, variety, ink, gold, C);
  drawSeamZone(g, i, pal, ink, gold, C);

  // ---- age: fading, scratches to bare tin, rust at the seams, grease
  if (C) {
    const fade = g.createLinearGradient(0, 0, W, 0);
    fade.addColorStop(0, 'rgba(240,225,190,0.10)'); fade.addColorStop(0.5, 'rgba(240,225,190,0.0)'); fade.addColorStop(1, 'rgba(240,225,190,0.12)');
    g.fillStyle = fade; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 7; k++) {
      const x = R() * W, y = R() * H, r = 20 + R() * 60;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(30,18,6,0.22)'); gr.addColorStop(1, 'rgba(30,18,6,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  // scratches (bare tin)
  g.strokeStyle = ink('rgba(205,205,200,0.85)', 'tin');
  for (let k = 0; k < 26; k++) {
    const x = R() * W, y = 20 + R() * (H - 40), l = 6 + R() * 40, a = (R() - 0.5) * 0.9;
    g.lineWidth = 0.6 + R() * 1.4;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // rubbed edges near the bands
  for (let k = 0; k < 40; k++) {
    const x = R() * W, y = R() < 0.5 ? 16 + R() * 10 : H - 26 + R() * 10;
    g.fillStyle = ink('rgba(200,198,190,0.7)', 'tin');
    g.beginPath(); g.ellipse(x, y, 2 + R() * 7, 1 + R() * 2, 0, 0, Math.PI * 2); g.fill();
  }
  // rust blooms near the bottom seam and the side seam
  for (let k = 0; k < 9; k++) {
    const x = R() < 0.5 ? R() * 50 : W - R() * 50 + (R() < 0.4 ? -R() * W : 0), y = H - 8 - R() * 40;
    const r = 3 + R() * 10;
    if (C) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(110,45,15,0.9)'); gr.addColorStop(0.6, 'rgba(140,70,25,0.6)'); gr.addColorStop(1, 'rgba(140,70,25,0)');
      g.fillStyle = gr;
    } else g.fillStyle = ORM.rust;
    g.beginPath(); g.arc(x, y, r * (C ? 1 : 0.6), 0, Math.PI * 2); g.fill();
  }
  g.restore();
}


function drawMedallion(g, i, letter, pal, variety, ink, gold, C, cx, cy) {
  const W = 768, H = 256;
  // brand ribbon (cream) across the top, centred over the medallion
  const ribbon = (x) => {
    g.fillStyle = ink(pal.panel);
    g.beginPath();
    g.moveTo(x - 128, 30); g.lineTo(x + 128, 30); g.lineTo(x + 116, 47); g.lineTo(x + 128, 64); g.lineTo(x - 128, 64); g.lineTo(x - 116, 47); g.closePath(); g.fill();
    g.strokeStyle = gold(x - 128, 30, x + 128, 64); g.lineWidth = 2.5; g.stroke();
    g.fillStyle = ink(pal.accent);
    g.font = '600 30px Cinzel, Georgia, serif';
    g.fillText('STAUF’S', x, 48);
  };
  ribbon(cx);
  ribbon(0); ribbon(W);   // the seam side (also visible on turned cans)

  // central medallion with the letter
  g.beginPath(); g.arc(cx, cy, 84, 0, Math.PI * 2); g.fillStyle = gold(cx - 84, cy - 84, cx + 84, cy + 84); g.fill();
  g.beginPath(); g.arc(cx, cy, 77, 0, Math.PI * 2); g.fillStyle = ink(pal.ground); g.fill();
  g.beginPath(); g.arc(cx, cy, 72, 0, Math.PI * 2); g.fillStyle = gold(cx, cy - 72, cx, cy + 72); g.fill();
  g.beginPath(); g.arc(cx, cy, 68, 0, Math.PI * 2); g.fillStyle = ink(pal.panel); g.fill();
  // rope ring of dots
  g.fillStyle = ink(pal.accent);
  for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * 80.5, cy + Math.sin(a) * 80.5, 1.6, 0, Math.PI * 2); g.fill(); }
  // laurel sprigs either side of the medallion
  for (const s of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const a = Math.PI / 2 + s * (0.5 + k * 0.28);
      const px = cx + Math.cos(a) * 98 * s * -1 * -1, py = cy + Math.sin(a) * 92;
      g.save(); g.translate(cx + s * Math.abs(Math.cos(a)) * 98, py); g.rotate(s * (0.9 - k * 0.28));
      g.fillStyle = gold(-8, -4, 8, 4);
      g.beginPath(); g.ellipse(0, 0, 10, 3.6, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      void px;
    }
  }
  // the letter: engraved shadow + fill
  g.font = '600 112px Cinzel, Georgia, serif';
  if (C) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(letter, cx + 3, cy + 9); }
  g.fillStyle = ink(pal.letter);
  g.fillText(letter, cx, cy + 6);
  if (C) { g.strokeStyle = 'rgba(255,240,200,0.35)'; g.lineWidth = 1; g.strokeText(letter, cx - 1, cy + 5); }

  // side panels: variety (left) and SOUP (right)
  const panel = (x, w) => {
    g.fillStyle = ink(pal.panel);
    g.beginPath(); g.roundRect(x - w / 2, 82, w, 120, 10); g.fill();
    g.strokeStyle = gold(x - w / 2, 82, x + w / 2, 202); g.lineWidth = 3; g.stroke();
    g.strokeStyle = ink(pal.accent); g.lineWidth = 1; g.beginPath(); g.roundRect(x - w / 2 + 6, 88, w - 12, 108, 6); g.stroke();
  };
  panel(cx - 196, 150);
  panel(cx + 196, 150);
  g.fillStyle = ink(pal.ink);
  g.font = 'italic 31px "IM Fell English", Georgia, serif';
  g.fillText(variety[0], cx - 196, 122);
  g.fillText(variety[1], cx - 196, 156);
  g.font = '600 13px Cinzel, Georgia, serif';
  g.fillStyle = ink(pal.accent);
  g.fillText('SUPERIOR', cx - 196, 186);
  g.font = '600 40px Cinzel, Georgia, serif';
  g.fillStyle = ink(pal.accent);
  g.fillText('SOUP', cx + 196, 132);
  g.font = 'italic 17px "IM Fell English", Georgia, serif';
  g.fillStyle = ink(pal.ink);
  g.fillText('condensed', cx + 196, 162);
  g.font = '600 12px Cinzel, Georgia, serif';
  g.fillText('NET 10 OZ.', cx + 196, 184);

}

function drawSeamZone(g, i, pal, ink, gold, C) {
  const W = 768, H = 256;
  // seam zone: prize medals + small print
  const medal = (x, y) => {
    g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.fillStyle = gold(x - 22, y - 22, x + 22, y + 22); g.fill();
    g.beginPath(); g.arc(x, y, 17, 0, Math.PI * 2); g.strokeStyle = ink('rgba(70,40,10,0.7)', 'gold'); g.lineWidth = 1.2; g.stroke();
    g.fillStyle = ink('rgba(70,40,10,0.8)', 'gold'); g.font = '600 9px Cinzel, Georgia, serif'; g.fillText('1889', x, y + 1);
  };
  medal(W - 46, 112); medal(W - 46, 176);
  g.save(); g.translate(60, 150); g.rotate(-Math.PI / 2);
  g.fillStyle = ink(pal.panel); g.font = 'italic 12px "IM Fell English", Georgia, serif';
  g.fillText('Heat — do not boil. Serve to guests.', 0, 0);
  g.restore();
  

}


// shared: the big letter, engraved, with occasional misregistration of the colour pass
function bigLetter(g, i, letter, x, y, size, color, C) {
  g.font = `600 ${size}px Cinzel, Georgia, serif`;
  const mis = (i % 3 === 1) ? 2.2 : (i % 5 === 2 ? -1.6 : 0.6);
  if (C) { g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillText(letter, x + 3, y + 3); }
  g.fillStyle = color; g.fillText(letter, x + (C ? mis : 0), y + (C ? mis * 0.5 : 0));
  if (C) { g.strokeStyle = 'rgba(20,10,5,0.75)'; g.lineWidth = 1.4; g.strokeText(letter, x, y); }
}
function finePrintRim(g, y, ink, color, size = 9) {
  g.font = `600 ${size}px Cinzel, Georgia, serif`;
  g.fillStyle = color;
  const t = 'CONTENTS 1 LB. NET  ·  ESTABLISHED 1871  ·  STAUF’S SUPERIOR SOUPS  ·  ';
  const w = g.measureText(t).width;
  for (let x = w / 2; x < 768 + w; x += w) g.fillText(t, x, y);
}
function tureen(g, x, y, s, inkC, hatch) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = inkC; g.fillStyle = inkC; g.lineWidth = 2;
  // foot, bowl, rim, lid, knob, handles
  g.beginPath(); g.ellipse(0, 34, 22, 5, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(-46, -2); g.bezierCurveTo(-46, 30, -18, 34, 0, 34); g.bezierCurveTo(18, 34, 46, 30, 46, -2); g.closePath(); g.stroke();
  for (let k = -40; k < 40; k += 4) { g.globalAlpha = 0.5; g.beginPath(); g.moveTo(k, 2); g.lineTo(k + (k < 0 ? -3 : 3), 22 - Math.abs(k) * 0.3); g.stroke(); }
  g.globalAlpha = 1;
  g.beginPath(); g.ellipse(0, -2, 50, 7, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(-42, -6); g.bezierCurveTo(-36, -30, 36, -30, 42, -6); g.stroke();
  g.beginPath(); g.arc(0, -28, 5, 0, Math.PI * 2); g.fill();
  for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 50, 8, 8, -Math.PI / 2, Math.PI / 2, sx < 0); g.stroke(); }
  // steam
  g.lineWidth = 1.5;
  for (const sx of [-16, 0, 16]) { g.beginPath(); g.moveTo(sx, -36); g.bezierCurveTo(sx - 8, -46, sx + 8, -54, sx, -66); g.stroke(); }
  if (hatch) { g.globalAlpha = 0.35; for (let k = -30; k < 30; k += 5) { g.beginPath(); g.moveTo(k, -8); g.lineTo(k + 6, -20); g.stroke(); } g.globalAlpha = 1; }
  g.restore();
}
function oxHead(g, x, y, s, inkC) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = inkC; g.strokeStyle = inkC; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(-18, -18); g.bezierCurveTo(-22, 6, -12, 30, 0, 36); g.bezierCurveTo(12, 30, 22, 6, 18, -18); g.bezierCurveTo(8, -24, -8, -24, -18, -18); g.stroke();
  for (const sx of [-1, 1]) {
    g.beginPath(); g.moveTo(sx * 16, -16); g.bezierCurveTo(sx * 34, -18, sx * 44, -32, sx * 38, -46); g.stroke();
    g.beginPath(); g.ellipse(sx * 26, -6, 9, 4, sx * 0.4, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(sx * 8, -4, 2.6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(sx * 5, 28, 2, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 0.45; for (let k = -14; k <= 14; k += 4) { g.beginPath(); g.moveTo(k, -14); g.lineTo(k * 0.6, 20); g.stroke(); } g.globalAlpha = 1;
  g.restore();
}

/** Family 1: pinstriped ground, a swallow-tailed banner across, the letter on a gilt shield. */
function drawBanner(g, i, letter, pal, variety, ink, gold, C) {
  const W = 768, cx = W / 2, cy = 136;
  if (C) { g.fillStyle = 'rgba(255,240,200,0.12)'; for (let x = 0; x < W; x += 9) g.fillRect(x, 26, 2, 204); }
  // banner
  g.fillStyle = ink(pal.panel);
  g.beginPath(); g.moveTo(40, 100); g.lineTo(W - 40, 100); g.lineTo(W - 70, 134); g.lineTo(W - 40, 168); g.lineTo(40, 168); g.lineTo(70, 134); g.closePath(); g.fill();
  g.strokeStyle = gold(0, 100, 0, 168); g.lineWidth = 3; g.stroke();
  g.strokeStyle = ink(pal.accent); g.lineWidth = 1; g.strokeRect(84, 106, W - 168, 56);
  g.fillStyle = ink(pal.accent); g.font = '600 34px Cinzel, Georgia, serif';
  g.fillText('STAUF’S', cx - 200, 128); g.fillText('SOUPS', cx + 200, 128);
  g.fillStyle = ink(pal.ink); g.font = 'italic 19px "IM Fell English", Georgia, serif';
  g.fillText(`${variety[0]} ${variety[1]}`, cx - 200, 154); g.fillText('ready for the table', cx + 200, 154);
  // shield
  const sh = (s) => { g.beginPath(); g.moveTo(cx - 70 * s, cy - 92 * s); g.lineTo(cx + 70 * s, cy - 92 * s); g.lineTo(cx + 70 * s, cy - 10 * s); g.bezierCurveTo(cx + 70 * s, cy + 50 * s, cx + 20 * s, cy + 80 * s, cx, cy + 96 * s); g.bezierCurveTo(cx - 20 * s, cy + 80 * s, cx - 70 * s, cy + 50 * s, cx - 70 * s, cy - 10 * s); g.closePath(); };
  sh(1); g.fillStyle = gold(cx - 70, cy - 92, cx + 70, cy + 96); g.fill();
  sh(0.9); g.fillStyle = ink(pal.ground); g.fill();
  sh(0.84); g.fillStyle = ink(pal.panel); g.fill();
  g.fillStyle = ink(pal.accent);
  for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(cx - 30 + k * 30, cy - 66, 3, 0, Math.PI * 2); g.fill(); }
  bigLetter(g, i, letter, cx, cy + 10, 104, ink(pal.letter), C);
  finePrintRim(g, 36, ink, ink(pal.panel));
  finePrintRim(g, 220, ink, ink(pal.panel));
}

/** Family 2: tall oval cartouche + engraved vignettes (a tureen, an ox head). */
function drawVignette(g, i, letter, pal, variety, ink, gold, C) {
  const W = 768, cx = W / 2, cy = 132;
  // cartouche
  g.beginPath(); g.ellipse(cx, cy, 78, 98, 0, 0, Math.PI * 2); g.fillStyle = gold(cx - 78, cy - 98, cx + 78, cy + 98); g.fill();
  g.beginPath(); g.ellipse(cx, cy, 70, 90, 0, 0, Math.PI * 2); g.fillStyle = ink(pal.panel); g.fill();
  g.beginPath(); g.ellipse(cx, cy, 63, 83, 0, 0, Math.PI * 2); g.strokeStyle = ink(pal.accent); g.lineWidth = 1.2; g.stroke();
  g.fillStyle = ink(pal.accent); g.font = '600 15px Cinzel, Georgia, serif'; g.fillText('STAUF’S', cx, cy - 64);
  g.font = 'italic 14px "IM Fell English", Georgia, serif'; g.fillText(variety.join(' '), cx, cy + 68);
  bigLetter(g, i, letter, cx, cy + 4, 108, ink(pal.letter), C);
  // vignette panels
  for (const [x, f] of [[cx - 205, 0], [cx + 205, 1]]) {
    g.fillStyle = ink(pal.panel); g.fillRect(x - 82, 52, 164, 152);
    g.strokeStyle = gold(x - 82, 52, x + 82, 204); g.lineWidth = 3; g.strokeRect(x - 82, 52, 164, 152);
    g.strokeStyle = ink(pal.ink); g.lineWidth = 0.8; g.strokeRect(x - 75, 59, 150, 138);
    if (f === 0) tureen(g, x, 132, 1.15, ink(pal.ink), C); else oxHead(g, x, 124, 1.25, ink(pal.ink));
    g.fillStyle = ink(pal.accent); g.font = '600 12px Cinzel, Georgia, serif';
    g.fillText(f === 0 ? 'SUPERIOR SOUP' : 'FINEST OX STOCK', x, 186);
  }
}

/** Family 3: diagonal check ground, letter in a lozenge, fine-print rims. */
function drawLozenge(g, i, letter, pal, variety, ink, gold, C) {
  const W = 768, cx = W / 2, cy = 132;
  if (C) {
    g.save(); g.globalAlpha = 0.18; g.fillStyle = pal.panel;
    for (let y = 26; y < 232; y += 24) for (let x = ((y / 24) % 2) * 24; x < W; x += 48) { g.beginPath(); g.moveTo(x, y + 12); g.lineTo(x + 12, y); g.lineTo(x + 24, y + 12); g.lineTo(x + 12, y + 24); g.fill(); }
    g.restore();
  }
  const lz = (s) => { g.beginPath(); g.moveTo(cx, cy - 100 * s); g.lineTo(cx + 110 * s, cy); g.lineTo(cx, cy + 100 * s); g.lineTo(cx - 110 * s, cy); g.closePath(); };
  lz(1); g.fillStyle = gold(cx - 110, cy - 100, cx + 110, cy + 100); g.fill();
  lz(0.92); g.fillStyle = ink(pal.ground); g.fill();
  lz(0.86); g.fillStyle = ink(pal.panel); g.fill();
  bigLetter(g, i, letter, cx, cy + 6, 100, ink(pal.letter), C);
  // side tablets
  for (const [x, t1, t2] of [[cx - 220, 'STAUF’S', variety.join(' ')], [cx + 220, 'SOUP', 'condensed · 1 lb.']]) {
    g.fillStyle = ink(pal.panel); g.beginPath(); g.roundRect(x - 90, 92, 180, 84, 40); g.fill();
    g.strokeStyle = gold(x - 90, 92, x + 90, 176); g.lineWidth = 3; g.stroke();
    g.fillStyle = ink(pal.accent); g.font = '600 32px Cinzel, Georgia, serif'; g.fillText(t1, x, 124);
    g.fillStyle = ink(pal.ink); g.font = 'italic 17px "IM Fell English", Georgia, serif'; g.fillText(t2, x, 154);
  }
  g.fillStyle = gold(0, 28, 0, 46); g.fillRect(0, 28, W, 18); g.fillRect(0, 210, W, 18);
  finePrintRim(g, 37, ink, ink(pal.ink), 10);
  finePrintRim(g, 219, ink, ink(pal.ink), 10);
}

/** Build both atlases for the given letters. Returns { map, orm, uvRect(i) }. */
export async function buildLabelAtlas(letters, { extras = [] } = {}) {
  try {
    await Promise.all([
      document.fonts.load('600 112px Cinzel'), document.fonts.load('600 30px Cinzel'),
      document.fonts.load('italic 31px "IM Fell English"'),
    ]);
  } catch { /* fall back to Georgia */ }
  const W = CELL_W * COLS, H = CELL_H * ROWS;
  const mk = (mode) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    [...letters, ...extras].forEach((L, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      g.save(); g.translate(col * CELL_W, row * CELL_H);
      g.beginPath(); g.rect(0, 0, CELL_W, CELL_H); g.clip();
      g.scale(S, S);
      drawLabel(g, i, L, mode, i >= letters.length ? 2 : (i * 3) % 4);
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
    // flipY = true: v = 1 at canvas top
    return { u0: col / COLS, u1: (col + 1) / COLS, v0: 1 - (row + 1) / ROWS, v1: 1 - row / ROWS };
  };
  return { map, orm, uvRect };
}
