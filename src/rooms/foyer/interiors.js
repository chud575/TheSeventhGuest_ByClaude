import * as THREE from 'three';

/**
 * Cheap "rooms beyond" seen through the ajar doors: an unlit box behind each doorway whose faces carry
 * painted lamp-lit walls (wainscot, dado, a picture or bookshelves, a warm pool from a lamp deeper in the
 * room), plus one or two dark silhouette props standing in front of the lit back wall for parallax.
 * Everything is MeshBasicMaterial (no lights, no shadows), multiplied by the room's light colour.
 *
 * Local space = the doorway group's: x along the wall, y up, +z into the foyer; the wall plane is z = 0.
 */
const cache = new Map();

function canvasTex(ctx, key, w, h, draw) {
  return ctx.textures.canvas(key, w, h, draw, { tile: false });
}

function wallFace(ctx, kind, face) {
  const key = `foyer:int:${kind}:${face}`;
  if (cache.has(key)) return cache.get(key);
  const tex = canvasTex(ctx, key, 512, 512, (g, w, h) => {
    // base: dark paper with a faint stripe/damask, wainscot below the dado
    const paper = { dining: '#5a2a1e', library: '#3a2c1c', music: '#2a3650', kitchen: '#4a3a26' }[kind];
    g.fillStyle = paper; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.18;
    for (let x = 0; x < w; x += 18) { g.fillStyle = x % 36 ? '#000' : '#fff'; g.fillRect(x, 0, 6, h * 0.62); }
    g.globalAlpha = 1;
    const dado = h * 0.64;
    if (kind !== 'kitchen') {
      g.fillStyle = '#1a0e08'; g.fillRect(0, dado, w, h - dado);
      g.strokeStyle = 'rgba(255,200,150,0.18)'; g.lineWidth = 3;
      for (let x = 14; x < w - 40; x += 92) g.strokeRect(x, dado + 22, 74, h - dado - 50);
      g.fillStyle = '#3a2214'; g.fillRect(0, dado - 8, w, 10);
    } else {
      // scullery tiles below, a shelf of crockery above
      g.fillStyle = '#6a6458'; g.fillRect(0, dado, w, h - dado);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
      for (let y = dado; y < h; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      for (let x = 0; x < w; x += 24) { g.beginPath(); g.moveTo(x, dado); g.lineTo(x, h); g.stroke(); }
    }
    if (face === 'back') {
      if (kind === 'library') {
        // floor-to-ceiling shelves of books, the spines catching the fire
        g.fillStyle = '#120a05'; g.fillRect(40, 20, w - 80, h - 40);
        let sd = 9; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
        for (let sy = 40; sy < h - 60; sy += 74) {
          let x = 52;
          while (x < w - 60) {
            const bw = 6 + rnd() * 12, bh = 48 + rnd() * 18;
            const hue = rnd();
            g.fillStyle = hue < 0.3 ? '#5a1810' : hue < 0.5 ? '#1c2a18' : hue < 0.7 ? '#3a2410' : hue < 0.85 ? '#222838' : '#6a5030';
            g.fillRect(x, sy + 64 - bh, bw, bh);
            if (rnd() < 0.4) { g.fillStyle = 'rgba(220,170,80,0.5)'; g.fillRect(x + 1, sy + 64 - bh + 8, bw - 2, 2); }
            x += bw + 1;
          }
          g.fillStyle = '#2a1608'; g.fillRect(40, sy + 64, w - 80, 8);
        }
      } else if (kind === 'dining') {
        // a gilt-framed still life over a sideboard
        g.fillStyle = '#8a6a30'; g.fillRect(150, 90, 210, 150); g.fillStyle = '#1a120a'; g.fillRect(164, 104, 182, 122);
        g.fillStyle = 'rgba(160,90,40,0.6)'; g.beginPath(); g.ellipse(250, 180, 40, 26, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#140a06'; g.fillRect(110, 300, 290, 60);
      } else if (kind === 'music') {
        // a tall moonlit window, curtains half drawn
        g.fillStyle = '#6a80b0'; g.fillRect(190, 60, 140, 230); g.fillStyle = '#20283c'; g.fillRect(256, 60, 8, 230); g.fillRect(190, 170, 140, 8);
        g.fillStyle = '#10141e'; g.fillRect(160, 40, 50, 300); g.fillRect(310, 40, 50, 300);
      } else {
        // the range: a black iron mass with a glowing firebox
        g.fillStyle = '#0c0a08'; g.fillRect(140, 200, 240, 200);
        g.fillStyle = '#ff8a30'; g.fillRect(200, 300, 60, 30);
        g.fillStyle = '#2a2018'; g.fillRect(120, 180, 280, 24);
        for (let i = 0; i < 5; i++) { g.fillStyle = '#4a3a2a'; g.beginPath(); g.arc(150 + i * 55, 120, 18, 0, Math.PI * 2); g.fill(); }
      }
    }
    // light: a warm pool from a lamp off to one side, falling off to the corners and towards the foyer
    const lx = face === 'back' ? w * 0.62 : face === 'left' ? w * 0.95 : face === 'right' ? w * 0.05 : w * 0.5;
    const ly = face === 'floor' ? h * 0.2 : face === 'ceiling' ? h * 0.8 : h * 0.5;
    const gr = g.createRadialGradient(lx, ly, 10, lx, ly, w * 0.95);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.7)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (face === 'left' || face === 'right') {
      // fall to dark towards the doorway (front = the far end of these faces' u axis)
      const fg = face === 'left' ? g.createLinearGradient(w, 0, 0, 0) : g.createLinearGradient(0, 0, w, 0);
      fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = fg; g.fillRect(0, 0, w, h);
    }
    if (face === 'floor') {
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = kind === 'kitchen' ? '#7a6a5a' : '#6a3a20'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 0.25; g.strokeStyle = '#000';
      for (let x = 0; x < w; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      g.globalAlpha = 1;
      if (kind !== 'kitchen') { g.fillStyle = 'rgba(90,20,15,0.6)'; g.fillRect(w * 0.15, h * 0.15, w * 0.7, h * 0.6); }
    }
  });
  cache.set(key, tex);
  return tex;
}

function propTex(ctx, kind) {
  const key = `foyer:intprop:${kind}`;
  if (cache.has(key)) return cache.get(key);
  const tex = canvasTex(ctx, key, 256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#fff';
    if (kind === 'dining') {
      // shield-back dining chair + the end of the table with a cloth and a candlestick
      g.fillRect(30, 150, 10, 106); g.fillRect(96, 150, 10, 106); g.fillRect(28, 150, 80, 12);
      g.beginPath(); g.moveTo(34, 150); g.bezierCurveTo(20, 90, 50, 50, 68, 46); g.bezierCurveTo(86, 50, 116, 90, 102, 150); g.closePath(); g.fill();
      g.fillRect(130, 140, 126, 18); g.fillRect(130, 158, 126, 30); g.fillRect(150, 188, 10, 68); g.fillRect(236, 188, 10, 68);
      g.fillRect(196, 90, 6, 50); g.fillRect(188, 132, 22, 8);
    } else if (kind === 'library') {
      // a wing chair and a globe on a stand
      g.beginPath(); g.moveTo(30, 256); g.lineTo(34, 120); g.bezierCurveTo(36, 80, 110, 80, 112, 120); g.lineTo(116, 256); g.closePath(); g.fill();
      g.fillRect(20, 150, 30, 60); g.fillRect(100, 150, 30, 60); g.fillRect(16, 200, 120, 40);
      g.beginPath(); g.arc(200, 120, 34, 0, Math.PI * 2); g.fill(); g.fillRect(196, 150, 8, 70); g.fillRect(176, 220, 48, 8); g.fillRect(180, 228, 6, 28); g.fillRect(214, 228, 6, 28);
    } else if (kind === 'music') {
      // the curve of a grand piano with its lid raised
      g.beginPath(); g.moveTo(0, 150); g.lineTo(180, 150); g.bezierCurveTo(240, 150, 250, 190, 220, 200); g.lineTo(0, 200); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(10, 148); g.lineTo(150, 40); g.lineTo(160, 46); g.lineTo(40, 148); g.closePath(); g.fill();
      g.fillRect(20, 200, 12, 56); g.fillRect(190, 200, 12, 56);
    } else {
      // a scrubbed table and hanging copper pans
      g.fillRect(20, 160, 216, 14); g.fillRect(30, 174, 10, 82); g.fillRect(216, 174, 10, 82);
      for (let i = 0; i < 4; i++) { g.fillRect(60 + i * 40, 0, 2, 50 + i * 6); g.beginPath(); g.arc(61 + i * 40, 66 + i * 6, 14, 0, Math.PI * 2); g.fill(); }
    }
  });
  cache.set(key, tex);
  return tex;
}

/**
 * @param ctx room ctx
 * @param kind 'dining' | 'library' | 'music' | 'kitchen'
 * @param d { w, h } door opening
 * @param color light colour of the room beyond, gain multiplier
 */
export function roomBeyond(ctx, kind, d, color, gain = 1) {
  const g = new THREE.Group();
  g.name = `beyond:${kind}`;
  const W = d.w + 2.2, Hh = d.h + 0.9, D = 3.4, z0 = -0.36;
  // lit for real by one warm, low lamp inside the room (no more self-lit cardboard): a desaturated tint keeps
  // the painted paper and woodwork from going candy-red under the coloured light
  const tint = new THREE.Color(color).lerp(new THREE.Color(1, 1, 1), 0.55);
  const mk = (face) => new THREE.MeshStandardMaterial({ map: wallFace(ctx, kind, face), color: tint, roughness: face === 'floor' ? 0.55 : 0.85, metalness: 0, side: THREE.BackSide, envMapIntensity: 0.1 });
  // BoxGeometry material order: +x, -x, +y, -y, +z, -z
  const front = new THREE.MeshBasicMaterial({ visible: false });
  const box = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, D), [mk('right'), mk('left'), mk('ceiling'), mk('floor'), front, mk('back')]);
  box.position.set(0, Hh / 2 - 0.02, z0 - D / 2);
  box.userData.noShadow = true; box.userData.noBake = true;
  g.add(box);
  const lamp = new THREE.PointLight(color, 5.5 * gain, 4.2, 2);
  lamp.position.set(W * 0.22, Hh * 0.55, z0 - D * 0.62);
  lamp.name = `beyondLamp:${kind}`;
  g.add(lamp);
  if (kind === 'library') g.add(bookcase(ctx, W, Hh, z0 - D + 0.02));
  // silhouettes: one mid-room, one near the back wall, both nearly black against the lit wall
  const pm = new THREE.MeshBasicMaterial({ map: propTex(ctx, kind), alphaMap: propTex(ctx, kind), color: new THREE.Color(color).multiplyScalar(gain * 0.05), alphaTest: 0.5, side: THREE.DoubleSide });
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), pm);
  p1.position.set(0.35, 0.73, z0 - D * 0.55); p1.userData.noShadow = true; p1.userData.noBake = true;
  g.add(p1);
  // a soft haze of lamplight hanging in the room's air, so the light reads as coming from deeper inside
  const hz = canvasTex(ctx, 'foyer:int:haze', 128, 128, (q, w, h) => {
    const gr = q.createRadialGradient(w * 0.5, h * 0.55, 2, w * 0.5, h * 0.55, w * 0.5);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    q.fillStyle = gr; q.fillRect(0, 0, w, h);
  });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.2), new THREE.MeshBasicMaterial({ map: hz, color: new THREE.Color(color).multiplyScalar(gain * 0.12), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  haze.position.set(0.5, 1.4, z0 - D * 0.75); haze.userData.noShadow = true; haze.userData.noBake = true;
  g.add(haze);
  return g;
}

/** real shelves of books against the library's back wall: instanced spines with gilt bands, catching the lamp */
function bookcase(ctx, W, Hh, zBack) {
  const grp = new THREE.Group();
  const spine = ctx.textures.canvas('foyer:int:spine', 64, 256, (g, w, h) => {
    g.fillStyle = '#d8d0c4'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
    g.fillStyle = '#c9a050';
    for (const y of [18, 26, 222, 230]) g.fillRect(4, y, w - 8, 4);
    g.fillRect(10, 60, w - 20, 26); g.fillStyle = '#3a2a10'; g.fillRect(14, 64, w - 28, 18);
    g.fillStyle = '#c9a050'; for (let i = 0; i < 5; i++) g.fillRect(18 + i * 6, 70, 3, 6);
    g.fillStyle = 'rgba(201,160,80,0.8)'; g.fillRect(10, 120, w - 20, 3); g.fillRect(10, 170, w - 20, 3);
  }, { tile: false });
  const wood = new THREE.MeshStandardMaterial({ color: 0x2a1609, roughness: 0.6 });
  const width = Math.min(W - 0.5, 2.6), x0 = -width / 2;
  const shelfGeo = new THREE.BoxGeometry(width, 0.025, 0.26);
  const rows = [];
  for (let y = 0.12; y < Hh - 0.45; y += 0.4) rows.push(y);
  for (const y of rows) { const sh = new THREE.Mesh(shelfGeo, wood); sh.position.set(0, y, zBack + 0.13); grp.add(sh); }
  for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, rows[rows.length - 1] + 0.42, 0.28), wood); st.position.set(sx * (width / 2 + 0.025), (rows[rows.length - 1] + 0.42) / 2, zBack + 0.14); grp.add(st); }
  let sd = 31; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const mats = [];
  for (const y of rows) {
    let x = x0 + 0.02;
    while (x < -x0 - 0.06) {
      const bw = 0.028 + rnd() * 0.05, bh = 0.24 + rnd() * 0.1, bd = 0.17 + rnd() * 0.06;
      const lean = rnd() < 0.06 ? (rnd() - 0.5) * 0.3 : 0;
      mats.push({ x: x + bw / 2, y: y + 0.0125 + bh / 2, w: bw, h: bh, d: bd, lean, c: rnd() });
      x += bw + 0.002 + (rnd() < 0.04 ? 0.08 : 0);
    }
  }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: spine, roughness: 0.6, metalness: 0.05 }), mats.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  const pal = [[0.32, 0.07, 0.05], [0.09, 0.16, 0.08], [0.22, 0.13, 0.06], [0.08, 0.1, 0.2], [0.36, 0.26, 0.14], [0.14, 0.05, 0.06], [0.05, 0.05, 0.05]];
  mats.forEach((b, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), b.lean);
    m.compose(new THREE.Vector3(b.x, b.y, zBack + 0.03 + b.d / 2), q, new THREE.Vector3(b.w, b.h, b.d));
    im.setMatrixAt(i, m);
    const p = pal[Math.floor(b.c * pal.length)];
    col.setRGB(p[0], p[1], p[2]).multiplyScalar(0.8 + 0.4 * ((b.c * 97) % 1));
    im.setColorAt(i, col);
  });
  grp.add(im);
  grp.traverse((o) => { o.userData.noShadow = true; o.userData.noBake = true; });
  return grp;
}
