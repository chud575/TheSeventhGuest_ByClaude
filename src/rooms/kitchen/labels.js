import * as THREE from 'three';

/**
 * Lithographed tin labels for "Stauf's Superior Soups" — drawn on a canvas atlas
 * (colour + a matching ORM atlas so gold inks and scratched tin read metallic while
 * the enamel inks stay dielectric). One cell per can; the big letter sits at
 * u = 0.5 so it faces the room once the can is turned to face outward.
 */

export const CELL_W = 768, CELL_H = 256, COLS = 2, ROWS = 12;

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

function drawLabel(g, i, letter, mode) {
  const W = CELL_W, H = CELL_H;
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

  // seam zone: prize medals + small print
  const medal = (x, y) => {
    g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.fillStyle = gold(x - 22, y - 22, x + 22, y + 22); g.fill();
    g.beginPath(); g.arc(x, y, 17, 0, Math.PI * 2); g.strokeStyle = ink('rgba(70,40,10,0.7)', 'gold'); g.lineWidth = 1.2; g.stroke();
    g.fillStyle = ink('rgba(70,40,10,0.8)', 'gold'); g.font = '600 9px Cinzel, Georgia, serif'; g.fillText('1889', x, y + 1);
  };
  medal(60, 112); medal(W - 60, 112); medal(60, 176); medal(W - 60, 176);
  g.fillStyle = ink(pal.panel);
  g.font = 'italic 13px "IM Fell English", Georgia, serif';
  g.fillText('Purveyors to', 138, 220); g.fillText('the Household', W - 138, 220);
  g.font = '600 10px Cinzel, Georgia, serif';
  g.fillText('PRIZE MEDAL', 138, 96); g.fillText('EST. 1871', W - 138, 96);
  g.fillText('NO. ' + String(100 + i * 7), 138, 112);
  g.font = 'italic 12px "IM Fell English", Georgia, serif';
  g.fillText('Heat — do not boil.', 138, 140); g.fillText('Serve to guests.', W - 138, 140);
  g.fillText('Keep in the dark.', 138, 158); g.fillText('Mind the bones.', W - 138, 158);

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

/** Build both atlases for the given letters. Returns { map, orm, uvRect(i) }. */
export async function buildLabelAtlas(letters) {
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
    letters.forEach((L, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      g.save(); g.translate(col * CELL_W, row * CELL_H);
      g.beginPath(); g.rect(0, 0, CELL_W, CELL_H); g.clip();
      drawLabel(g, i, L, mode);
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
