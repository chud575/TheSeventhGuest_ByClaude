#!/usr/bin/env node
// Library look-dev helper: like scripts/shot.mjs, but each --v "name:query" adds
// arbitrary URL params (e.g. ghostlab=1&pos=...&target=...&fov=30) and all
// variants render in one server/browser session.
//   node src/rooms/library/tools/lab.mjs --outdir review/library/lab --v "g1:ghostlab=1&node=main"
import fs from 'node:fs';
import path from 'node:path';
import { launch, parseArgs, startServer, ROOT } from '../../../../scripts/lib/browser.mjs';

const argv = process.argv.slice(2);
const args = parseArgs(argv);
const variants = [];
for (let i = 0; i < argv.length; i++) if (argv[i] === '--v') variants.push(argv[i + 1]);
const outdir = path.resolve(ROOT, args.outdir || 'review/library/lab');
fs.mkdirSync(outdir, { recursive: true });
const W = Number(args.w || 1232), H = Number(args.h || 928);
const server = await startServer({});
const browser = await launch();
try {
  for (const v of variants) {
    const [name, qs] = v.split(/:(.*)/s);
    const q = new URLSearchParams(`room=library&shot=1&time=2&${qs || ''}`);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const logs = [];
    page.on('console', (m) => { if (['error'].includes(m.type())) logs.push(m.text()); });
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    const t0 = Date.now();
    await page.goto(`${server.url}?${q}`, { waitUntil: 'load', timeout: 300000 });
    await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000, polling: 250 });
    const info = await page.evaluate(() => ({ i: window.__SHOT_INFO, e: window.__SHOT_ERROR }));
    const out = path.join(outdir, `${name}.png`);
    await page.screenshot({ path: out });
    await page.close();
    console.log(JSON.stringify({ out: path.relative(ROOT, out), ms: Date.now() - t0, calls: info.i?.calls, tris: info.i?.triangles, err: info.e }));
    if (logs.length) console.log(logs.slice(0, 10).join('\n'));
  }
} finally { await browser.close(); await server.close(); }
