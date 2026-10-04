#!/usr/bin/env node
// Batch review renders for the gallery (nodes + close-up views), sequential pages on one server.
//   node src/rooms/gallery/tools/shots.mjs --dir review/gallery --prefix r10_ [--only main,far,...]
import fs from 'node:fs';
import path from 'node:path';
import { launch, parseArgs, startServer, ROOT } from '../../../../scripts/lib/browser.mjs';

const VIEWS = {
  main: { node: 'main' }, back: { node: 'back' }, bedroom: { node: 'bedroom' }, portraits: { node: 'portraits' },
  gamedoor: { node: 'gamedoor' }, far: { node: 'far' }, attic: { node: 'attic' },
  clock: { pos: '-0.55,1.6,-5.2', target: '1.5,1.25,-7.1', fov: 50 },
  seat: { pos: '0.05,1.45,-7.0', target: '0.0,1.15,-9.2', fov: 52 },
  bust: { pos: '-0.6,1.62,-1.3', target: '1.25,1.2,-2.75', fov: 50 },
  lady: { pos: '0.9,1.65,6.1', target: '-1.6,1.86,6.3', fov: 52 },
  puzzle: { pos: '0.3,1.72,-0.5', target: '-1.6,1.72,-0.5', fov: 48 },
  wallR: { pos: '-1.0,1.62,4.0', target: '1.6,1.75,5.8', fov: 56 },
  mirror: { pos: '0.6,1.7,-2.6', target: '-1.6,1.8,-3.9', fov: 50 },
  ghost: { pos: '-0.25,1.5,-6.9', target: '-0.32,1.2,-8.25', fov: 45 },
  ghostface: { pos: '-0.3,1.52,-7.55', target: '-0.32,1.5,-8.25', fov: 40 },
  solved: { pos: '0.3,1.72,-0.5', target: '-1.6,1.72,-0.5', fov: 48, extra: 'gsolved=1' },
};
const args = parseArgs(process.argv.slice(2));
const dir = path.resolve(ROOT, args.dir || 'review/gallery');
const prefix = args.prefix || 'r10_';
const only = args.only ? String(args.only).split(',') : Object.keys(VIEWS);
fs.mkdirSync(dir, { recursive: true });
const server = await startServer({});
const browser = await launch();
try {
  for (const name of only) {
    const v = VIEWS[name];
    const q = new URLSearchParams({ room: 'gallery', shot: '1', time: String(args.time ?? 2) });
    q.set('node', v.node || 'far');
    if (v.pos) { q.set('pos', v.pos); q.set('target', v.target); q.set('fov', String(v.fov)); }
    if (args.nopost) q.set('nopost', args.nopost);
    const extra = (v.extra ? `&${v.extra}` : '') + (args.q ? `&${args.q}` : '');
    const page = await browser.newPage({ viewport: { width: 1232, height: 928 }, deviceScaleFactor: 1 });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    const t0 = Date.now();
    await page.goto(`${server.url}?${q}${extra}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
    await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000, polling: 250 });
    const out = path.join(dir, `${prefix}${name}.png`);
    await page.screenshot({ path: out, timeout: 180000 });
    await page.close();
    console.log(name, `${((Date.now() - t0) / 1000).toFixed(0)}s`, path.relative(ROOT, out), errs.slice(0, 3).join(' | '));
  }
} finally { await browser.close(); await server.close(); }
