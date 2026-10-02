#!/usr/bin/env node
// Render several URL-param variants of one view in a single browser session (debug / A-B).
//   node scripts/variants.mjs --room _sandbox --node entry --outdir review/dbg --v "base:" --v "noenv:envi=0" --v "nobloom:nopost=bloom"
import fs from 'node:fs';
import path from 'node:path';
import { launch, startServer, ROOT } from './lib/browser.mjs';
const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const variants = argv.map((a, i) => (a === '--v' ? argv[i + 1] : null)).filter(Boolean);
const room = get('room', '_sandbox'), node = get('node', ''), outdir = path.resolve(ROOT, get('outdir', 'review/dbg'));
const W = Number(get('w', 1232)), H = Number(get('h', 928));
fs.mkdirSync(outdir, { recursive: true });
const server = await startServer();
const browser = await launch();
for (const v of variants) {
  const [name, qs = ''] = v.split(':');
  const q = new URLSearchParams(qs.replace(/;/g, '&'));
  q.set('room', room); q.set('shot', '1'); if (node) q.set('node', node); if (!q.has('time')) q.set('time', '2');
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${server.url}?${q}`);
  await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000 });
  const info = await page.evaluate(() => ({ i: window.__SHOT_INFO, e: window.__SHOT_ERROR }));
  const out = path.join(outdir, `${name}.png`);
  await page.screenshot({ path: out });
  await page.close();
  console.log(name, JSON.stringify({ renderMs: info.i?.renderMs, err: info.e?.slice(0, 300), errs: errs.slice(0, 3) }));
}
await browser.close(); await server.close();
