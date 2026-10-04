#!/usr/bin/env node
// Dump the kitchen tin label + letter atlases to PNGs (debug): node src/rooms/kitchen/tools/atlas.mjs <outdir>
import fs from 'node:fs';
import { launch, startServer } from '../../../../scripts/lib/browser.mjs';
const out = process.argv[2] || '/tmp';
const server = await startServer({});
const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error(e.message));
await page.goto(`${server.url}?room=_none&mute=1`, { waitUntil: 'load' });
const res = await page.evaluate(async () => {
  await import('/node_modules/@fontsource/cinzel/latin-700.css?inline').catch(() => {});
  const m = await import('/src/rooms/kitchen/labels.js');
  const letters = 'THESOUPISMADEOFGUESTS'.split('');
  const a = await m.buildLabelAtlas(letters, { extras: ['7'], families: letters.map((_, i) => [0, 3, 1, 2, 0, 2, 3, 1, 0, 1, 2, 3, 0, 2, 1, 3, 0, 1, 2, 0, 3, 1][i % 22]), metals: letters.map((_, i) => ([2, 9, 15, 20].includes(i) ? 'gold' : 'silver')) });
  return { map: a.map.image.toDataURL('image/jpeg', 0.85), letters: a.letterMap.image.toDataURL('image/png') };
});
for (const [k, v] of Object.entries(res)) fs.writeFileSync(`${out}/atlas_${k}.${k === 'map' ? 'jpg' : 'png'}`, Buffer.from(v.split(',')[1], 'base64'));
await browser.close(); await server.close();
