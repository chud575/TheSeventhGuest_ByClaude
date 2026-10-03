// Render the game-room review set (all nodes + puzzle states) in one browser session.
//   node src/rooms/gameroom/tools/shots.mjs [outdir=review/gameroom] [names=hero,chess,...] [extra=k=v&k=v]
import fs from 'node:fs';
import path from 'node:path';
import { launch, startServer, ROOT } from '../../../../scripts/lib/browser.mjs';

const outdir = process.argv[2] || 'review/gameroom';
const only = (process.argv[3] || '').split(',').filter(Boolean);
const extra = process.argv[4] || '';
const SHOTS = {
  hero: 'node=main',
  billiards: 'node=billiards',
  chess: 'node=chess',
  hearth: 'node=hearth',
  back: 'node=back',
  puzzle_mid: 'node=chess&queens=mid&ui=1&screen=puzzle',
  puzzle_solved: 'node=chess&queens=solved&ui=1&screen=puzzle',
};
const server = await startServer();
const browser = await launch();
fs.mkdirSync(path.resolve(ROOT, outdir), { recursive: true });
try {
  for (const [name, qs] of Object.entries(SHOTS)) {
    if (only.length && !only.includes(name)) continue;
    const page = await browser.newPage({ viewport: { width: 1232, height: 928 }, deviceScaleFactor: 1 });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    const t0 = Date.now();
    await page.goto(`${server.url}?room=gameroom&shot=1&time=2&${qs}${extra ? '&' + extra : ''}`, { waitUntil: 'load', timeout: 300000 });
    await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000, polling: 250 });
    const out = path.resolve(ROOT, outdir, `${name}.png`);
    await page.screenshot({ path: out });
    const info = await page.evaluate(() => window.__SHOT_INFO || null);
    console.log(name, ((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(info?.stats || info?.renderMs || ''), errs.filter((e) => !/GPU stall|swiftshader|INVALID_ENUM/i.test(e)).slice(0, 5).join(' | '));
    await page.close();
  }
} finally {
  await browser.close(); await server.close();
}
