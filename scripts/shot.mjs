#!/usr/bin/env node
/**
 * Deterministic screenshot harness.
 *
 *   npm run shot -- --room <id> --node <nodeId>[,<nodeId>...] --out <png> [--w 1232 --h 928] [--time <s>]
 *        [--quality shot|low|medium|high|ultra] [--pos x,y,z --target x,y,z --fov 50]
 *        [--hotspots] [--ui] [--frames 3] [--timeout 300] [--prod] [--seed 1993]
 *
 * --out may contain {node} / {room} placeholders when several nodes are given.
 * Starts its own Vite server on a free port, renders in headless Chromium with
 * SwiftShader WebGL, waits for window.__SHOT_READY and saves the PNG.
 * Prints one JSON line per shot with timings ({ out, renderMs, totalMs, ... }).
 */
import fs from 'node:fs';
import path from 'node:path';
import { launch, parseArgs, startServer, ROOT } from './lib/browser.mjs';

const args = parseArgs(process.argv.slice(2));
const room = args.room || '_sandbox';
const nodes = String(args.node || '').split(',').filter(Boolean);
if (!nodes.length) nodes.push('');
const W = Number(args.w || 1232), H = Number(args.h || 928);
const timeout = Number(args.timeout || 300) * 1000;
const outArg = args.out || path.join('review', room, '{node}.png');

const t0 = Date.now();
const server = await startServer({ prod: !!args.prod });
const browser = await launch();
let failed = 0;
try {
  for (const node of nodes) {
    const q = new URLSearchParams({ room, shot: '1', time: String(args.time ?? 2) });
    if (node) q.set('node', node);
    for (const k of ['quality', 'pos', 'target', 'fov', 'frames', 'seed', 'nopost', 'hide', 'envi', 'screen', 'tab']) if (args[k] !== undefined) q.set(k, String(args[k]));
    if (args.hotspots) q.set('hotspots', '1');
    if (args.ui || args.screen) q.set('ui', '1');
    const out = path.resolve(ROOT, outArg.replace('{node}', node || 'start').replace('{room}', room));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const logs = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    const ts = Date.now();
    await page.goto(`${server.url}?${q}`, { waitUntil: 'load', timeout });
    await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout, polling: 250 });
    const info = await page.evaluate(() => ({ info: window.__SHOT_INFO || null, error: window.__SHOT_ERROR || null }));
    await page.screenshot({ path: out, type: 'png' });
    await page.close();
    const res = { out: path.relative(ROOT, out), room, node: info.info?.node || node, wallMs: Date.now() - ts, ...(info.info || {}), error: info.error || undefined };
    if (info.error) failed++;
    console.log(JSON.stringify(res));
    const errs = logs.filter((l) => !/GPU stall|swiftshader|WebGL: INVALID_ENUM: getParameter|Automatic fallback/i.test(l));
    if (errs.length) console.error(errs.slice(0, 20).join('\n'));
  }
} finally {
  await browser.close();
  await server.close();
}
console.error(`[shot] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(failed ? 1 : 0);
