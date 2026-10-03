/**
 * Small canvas-drawn textures for the kitchen: cast-iron relief panels (colour + bump +
 * roughness), the brass maker's plate, the oven thermometer, linen tea towel, glazes,
 * pheasant plumage, gas-mantle globes, a moonlight gobo, crock labels. All cached by key.
 */

function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Cast relief: oval cartouche, scrolls, rosettes, bead border, lettering. mode 'h' height | 'c' colour | 'r' roughness */
function drawRelief(g, W, H, mode, { title = 'No 7', sub = 'PATENT', seed = 3 } = {}) {
  const R = rng(seed);
  const lvl = (v) => { const c = Math.round(v * 255); return `rgb(${c},${c},${c})`; };
  const base = mode === 'h' ? lvl(0.35) : mode === 'r' ? lvl(0.62) : '#232325';
  const raised = mode === 'h' ? lvl(0.85) : mode === 'r' ? lvl(0.4) : '#4c4c50';
  const raised2 = mode === 'h' ? lvl(1.0) : mode === 'r' ? lvl(0.32) : '#5e5e62';
  const sunk = mode === 'h' ? lvl(0.1) : mode === 'r' ? lvl(0.75) : '#151516';
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  // sand-cast speckle
  for (let i = 0; i < W * H / 60; i++) {
    const v = R();
    g.fillStyle = mode === 'h' ? lvl(0.3 + v * 0.12) : mode === 'r' ? lvl(0.55 + v * 0.15) : `rgba(${v > 0.5 ? 90 : 10},${v > 0.5 ? 90 : 10},${v > 0.5 ? 95 : 12},0.25)`;
    g.fillRect(R() * W, R() * H, 1 + R() * 2, 1 + R() * 2);
  }
  const m = Math.min(W, H);
  g.lineCap = 'round'; g.lineJoin = 'round';
  // bead border
  g.strokeStyle = raised; g.lineWidth = m * 0.018;
  g.strokeRect(m * 0.05, m * 0.05, W - m * 0.1, H - m * 0.1);
  g.fillStyle = raised2;
  const bead = (x, y) => { g.beginPath(); g.arc(x, y, m * 0.012, 0, Math.PI * 2); g.fill(); };
  for (let x = m * 0.1; x < W - m * 0.08; x += m * 0.04) { bead(x, m * 0.09); bead(x, H - m * 0.09); }
  for (let y = m * 0.13; y < H - m * 0.1; y += m * 0.04) { bead(m * 0.09, y); bead(W - m * 0.09, y); }
  // corner rosettes
  const rosette = (cx, cy, r) => {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.fillStyle = raised; g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.45, r * 0.2, a, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = raised2; g.beginPath(); g.arc(cx, cy, r * 0.28, 0, Math.PI * 2); g.fill();
    g.fillStyle = sunk; g.beginPath(); g.arc(cx, cy, r * 0.1, 0, Math.PI * 2); g.fill();
  };
  const rr = m * 0.075;
  for (const [x, y] of [[m * 0.19, m * 0.19], [W - m * 0.19, m * 0.19], [m * 0.19, H - m * 0.19], [W - m * 0.19, H - m * 0.19]]) rosette(x, y, rr);
  // acanthus-ish C-scrolls flanking the cartouche
  const cx = W / 2, cy = H / 2, ex = W * 0.27, ey = H * 0.24;
  g.strokeStyle = raised; g.lineWidth = m * 0.026;
  for (const s of [-1, 1]) for (const v of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * ex * 0.6, cy + v * ey * 1.05);
    g.bezierCurveTo(cx + s * ex * 1.4, cy + v * ey * 1.5, cx + s * ex * 1.75, cy + v * ey * 0.5, cx + s * ex * 1.45, cy + v * ey * 0.15);
    g.stroke();
    g.beginPath(); g.arc(cx + s * ex * 1.38, cy + v * ey * 0.32, m * 0.035, 0, Math.PI * 2); g.stroke();
    // leaves
    g.fillStyle = raised;
    for (let k = 0; k < 4; k++) {
      const t = 0.2 + k * 0.2;
      const lx = cx + s * ex * (0.6 + t * 1.0), ly = cy + v * ey * (1.05 + Math.sin(t * Math.PI) * 0.35);
      g.beginPath(); g.ellipse(lx, ly, m * 0.04, m * 0.014, s * v * (0.6 + t), 0, Math.PI * 2); g.fill();
    }
  }
  // cartouche: double oval with sunk field
  g.lineWidth = m * 0.03; g.strokeStyle = raised2;
  g.beginPath(); g.ellipse(cx, cy, ex, ey, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = sunk; g.beginPath(); g.ellipse(cx, cy, ex * 0.9, ey * 0.86, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = m * 0.01; g.strokeStyle = raised;
  g.beginPath(); g.ellipse(cx, cy, ex * 0.83, ey * 0.78, 0, 0, Math.PI * 2); g.stroke();
  // lettering, raised out of the sunk field
  g.fillStyle = raised2; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(ey * 0.62)}px Cinzel, Georgia, serif`;
  g.fillText(title, cx, cy - ey * 0.12);
  g.font = `700 ${Math.round(ey * 0.26)}px Cinzel, Georgia, serif`;
  g.fillText(sub, cx, cy + ey * 0.45);
}

function drawPlate(g, W, H, mode) {
  const C = mode === 'c';
  if (C) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#6a4a18'); gr.addColorStop(0.45, '#d8b060'); gr.addColorStop(0.55, '#c49a48'); gr.addColorStop(1, '#5a3c12');
    g.fillStyle = gr;
  } else g.fillStyle = '#5a5a5a';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = C ? '#f0d890' : '#e0e0e0'; g.lineWidth = 6; g.strokeRect(8, 8, W - 16, H - 16);
  g.strokeStyle = C ? '#4a3210' : '#202020'; g.lineWidth = 2; g.strokeRect(18, 18, W - 36, H - 36);
  g.fillStyle = C ? '#f6e2a0' : '#ffffff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 58px Cinzel, Georgia, serif';
  g.fillText('STAUF & SONS', W / 2, H / 2 + 2);
  g.font = '700 30px Cinzel, Georgia, serif';
  g.fillText('ECONOMIST', 150, H / 2 + 2); g.fillText('No 7 · LEEDS', W - 160, H / 2 + 2);
  if (C) {
    const R = rng(11);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(30,20,5,${R() * 0.25})`; g.fillRect(R() * W, R() * H, 2 + R() * 6, 1 + R() * 3); }
  }
}

export function kitchenCanvases(forge) {
  const out = {};
  const reliefSet = (key, W, H, opts) => ({
    map: forge.canvas(`kitchen:${key}:c`, W, H, (g) => drawRelief(g, W, H, 'c', opts), { tile: false }),
    bump: forge.canvas(`kitchen:${key}:h`, W, H, (g) => drawRelief(g, W, H, 'h', opts), { srgb: false, tile: false }),
    rough: forge.canvas(`kitchen:${key}:r`, W, H, (g) => drawRelief(g, W, H, 'r', opts), { srgb: false, tile: false }),
  });
  out.relief = reliefSet('relief', 512, 640, { title: 'No 7', sub: 'PATENT', seed: 3 });
  out.relief2 = reliefSet('relief2', 1280, 466, { title: 'ECONOMIST', sub: 'STAUF & SONS · LEEDS', seed: 5 });
  out.plate = {
    map: forge.canvas('kitchen:plate:c', 1024, 136, (g, W, H) => drawPlate(g, W, H, 'c'), { tile: false }),
    bump: forge.canvas('kitchen:plate:h', 1024, 136, (g, W, H) => drawPlate(g, W, H, 'h'), { srgb: false, tile: false }),
  };
  out.dial = forge.canvas('kitchen:ovendial', 256, 256, (g, w) => {
    g.fillStyle = '#d9cfb4'; g.fillRect(0, 0, w, w);
    g.translate(w / 2, w / 2);
    g.strokeStyle = '#2a2018'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 110, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i <= 20; i++) { const a = Math.PI * 0.8 + (i / 20) * Math.PI * 1.4; g.lineWidth = i % 5 ? 2 : 4; g.beginPath(); g.moveTo(Math.cos(a) * 96, Math.sin(a) * 96); g.lineTo(Math.cos(a) * (i % 5 ? 84 : 76), Math.sin(a) * (i % 5 ? 84 : 76)); g.stroke(); }
    g.fillStyle = '#2a2018'; g.font = '700 22px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('COOL', -52, 46); g.fillText('HOT', 56, 46); g.fillText('MOD', 0, -58);
    g.font = 'italic 16px "IM Fell English", Georgia, serif'; g.fillText('oven', 0, 62);
    g.strokeStyle = '#7a1410'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); const na = Math.PI * 1.95; g.lineTo(Math.cos(na) * 80, Math.sin(na) * 80); g.stroke();
    g.fillStyle = '#2a2018'; g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(0, 0, 60, 0, 0, 128); gr.addColorStop(0, 'rgba(60,40,10,0)'); gr.addColorStop(1, 'rgba(60,40,10,0.45)');
    g.fillStyle = gr; g.fillRect(-128, -128, 256, 256);
  }, { tile: false });
  out.towel = forge.canvas('kitchen:towel', 256, 256, (g, w, h) => {
    g.fillStyle = '#cfc6b2'; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.16; g.fillStyle = '#5a4e3a';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    for (let x = 0; x < w; x += 3) g.fillRect(x, 0, 1, h);
    g.globalAlpha = 1;
    g.fillStyle = '#7a1c18'; g.fillRect(28, 0, 14, h); g.fillRect(50, 0, 5, h); g.fillRect(w - 42, 0, 14, h); g.fillRect(w - 55, 0, 5, h);
    const R = rng(4);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(90,70,40,${0.05 + R() * 0.1})`; g.beginPath(); g.arc(R() * w, R() * h, 4 + R() * 18, 0, Math.PI * 2); g.fill(); }
  });
  out.saltGlaze = forge.canvas('kitchen:saltglaze', 256, 256, (g, w, h) => {
    g.fillStyle = '#8c8a80'; g.fillRect(0, 0, w, h);
    const R = rng(8);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${R() > 0.5 ? 200 : 40},${R() > 0.5 ? 190 : 40},${R() > 0.5 ? 170 : 35},0.12)`; g.beginPath(); g.arc(R() * w, R() * h, 0.5 + R() * 2.2, 0, Math.PI * 2); g.fill(); }
    // cobalt-blue slip band and a brushed flower
    g.fillStyle = 'rgba(30,48,110,0.75)'; g.fillRect(0, h * 0.7, w, 6); g.fillRect(0, h * 0.2, w, 4);
    g.strokeStyle = 'rgba(30,48,110,0.7)'; g.lineWidth = 5;
    for (const cx of [w * 0.25, w * 0.75]) { g.beginPath(); g.moveTo(cx, h * 0.62); g.quadraticCurveTo(cx + 20, h * 0.45, cx, h * 0.32); g.stroke(); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 14, h * 0.45, 12, 5, s * 0.6, 0, Math.PI * 2); g.stroke(); } }
  });
  out.bristol = forge.canvas('kitchen:bristol', 256, 256, (g, w, h) => {
    // lathe v = 0 at the foot, 1 at the lip (canvas y is flipped: top of canvas = v 1)
    g.fillStyle = '#d9cba6'; g.fillRect(0, 0, w, h);
    const R = rng(9);
    g.fillStyle = '#5a3416';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0);
    for (let x = w; x >= 0; x -= 8) g.lineTo(x, h * 0.3 + Math.sin(x * 0.11) * 4 + (R() < 0.12 ? 10 + R() * 18 : 0));
    g.closePath(); g.fill();
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(80,60,30,${R() * 0.08})`; g.fillRect(R() * w, R() * h, 2, 2); }
  });
  out.plumage = forge.canvas('kitchen:plumage', 256, 256, (g, w, h) => {
    g.fillStyle = '#6a3a1a'; g.fillRect(0, 0, w, h);
    const R = rng(12);
    for (let y = 0; y < h; y += 7) for (let x = (y / 7) % 2 ? 0 : 6; x < w; x += 12) {
      g.fillStyle = R() > 0.5 ? '#8a4c1e' : '#4a2410'; g.beginPath(); g.ellipse(x, y, 6, 4, 0, 0, Math.PI); g.fill();
      g.fillStyle = '#1a0e08'; g.beginPath(); g.ellipse(x, y + 2, 2.2, 1.6, 0, 0, Math.PI * 2); g.fill();
    }
  });
  out.tail = forge.canvas('kitchen:tail', 64, 256, (g, w, h) => {
    g.fillStyle = '#8a6a3a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a1a0c';
    for (let y = 6; y < h; y += 14) g.fillRect(0, y, w, 4);
    g.fillStyle = 'rgba(60,30,10,0.6)'; g.fillRect(w / 2 - 1, 0, 2, h);
  }, { tile: false });
  out.zincMottle = forge.canvas('kitchen:zincmottle', 256, 256, (g, w, h) => {
    g.fillStyle = '#b8bcbd'; g.fillRect(0, 0, w, h);
    const R = rng(21);
    for (let i = 0; i < 120; i++) {
      const x = R() * w, y = R() * h, r = 6 + R() * 26;
      g.fillStyle = `rgba(${R() > 0.5 ? 230 : 120},${R() > 0.5 ? 232 : 124},${R() > 0.5 ? 234 : 126},0.25)`;
      g.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; g.lineTo(x + Math.cos(a) * r * (0.6 + R() * 0.4), y + Math.sin(a) * r * (0.6 + R() * 0.4)); } g.fill();
    }
  });
  // gas globe: frosted, etched band, a brighter mantle silhouette inside (lathe u around, v up)
  out.mantle = forge.canvas('kitchen:mantle', 256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, 'rgb(40,28,16)'); gr.addColorStop(0.25, 'rgb(150,110,70)'); gr.addColorStop(0.5, 'rgb(255,214,160)'); gr.addColorStop(0.72, 'rgb(190,140,90)'); gr.addColorStop(1, 'rgb(60,40,24)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // mantle mesh: brighter vertical cross-hatch in the middle of the globe
    g.globalAlpha = 0.35; g.strokeStyle = 'rgb(255,240,210)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 6) { g.beginPath(); g.moveTo(x, h * 0.35); g.lineTo(x + 12, h * 0.68); g.stroke(); g.beginPath(); g.moveTo(x + 12, h * 0.35); g.lineTo(x, h * 0.68); g.stroke(); }
    // etched frieze band
    g.globalAlpha = 0.5; g.fillStyle = 'rgb(60,40,25)';
    for (let x = 0; x < w; x += 32) { g.beginPath(); g.ellipse(x + 16, h * 0.22, 10, 5, 0, 0, Math.PI * 2); g.fill(); }
    g.fillRect(0, h * 0.27, w, 2); g.fillRect(0, h * 0.17, w, 2);
    g.globalAlpha = 1;
  });
  // moonlight gobo: soft cloud noise + bare pear-tree branches
  out.gobo = forge.canvas('kitchen:gobo', 512, 512, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    const R = rng(31);
    for (let i = 0; i < 70; i++) { const x = R() * w, y = R() * h, r = 30 + R() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${0.12 + R() * 0.15})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineCap = 'round';
    const branch = (x, y, a, len, wdt, depth) => {
      if (depth <= 0 || len < 6) return;
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.lineWidth = wdt; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (R() - 0.5) * len * 0.4, (y + y2) / 2 + (R() - 0.5) * len * 0.4, x2, y2); g.stroke();
      branch(x2, y2, a + (R() - 0.5) * 0.9, len * 0.72, wdt * 0.68, depth - 1);
      if (R() < 0.75) branch(x2, y2, a + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6), len * 0.6, wdt * 0.6, depth - 1);
    };
    branch(w * 0.05, h * 0.95, -0.9, 150, 14, 7);
    branch(w * 0.95, h * 0.1, 2.5, 110, 9, 6);
    // radial falloff so the pool rolls off softly
    const fall = g.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w * 0.5);
    fall.addColorStop(0, 'rgba(0,0,0,0)'); fall.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = fall; g.fillRect(0, 0, w, h);
  }, { tile: false });
  // crock labels (paper, hand-lettered)
  const words = ['FLOUR', 'SUET', 'LARD', 'SALT', 'OATS', 'RICE', 'PEASE', 'SUGAR', 'BONES', 'DRIPPING'];
  out.crockLabels = forge.canvas('kitchen:crocklabels', 512, 640, (g, w, h) => {
    const R = rng(5);
    words.forEach((wd, i) => {
      const y = i * 64;
      g.fillStyle = `rgb(${215 - R() * 30},${200 - R() * 30},${165 - R() * 30})`; g.fillRect(0, y, w, 64);
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.strokeRect(10, y + 8, w - 20, 48);
      g.fillStyle = '#2a1a10'; g.font = 'italic 40px "IM Fell English", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(wd.charAt(0) + wd.slice(1).toLowerCase(), w / 2, y + 34);
      for (let k = 0; k < 10; k++) { g.fillStyle = `rgba(110,70,30,${R() * 0.18})`; g.beginPath(); g.arc(R() * w, y + R() * 64, 3 + R() * 14, 0, Math.PI * 2); g.fill(); }
    });
  }, { tile: false });
  out.crockLabelCount = words.length;
  return out;
}

