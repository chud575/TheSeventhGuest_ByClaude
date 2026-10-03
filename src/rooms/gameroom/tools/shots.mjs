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
  // close-ups for self-review (not part of the standard set unless named)
  c_queen: 'node=chess&queens=solved&pos=-1.47,0.93,-2.42&target=-1.66,0.79,-2.78&fov=34',
  c_stag: 'node=hearth&pos=1.75,2.05,-1.25&target=3.2,2.25,-2.62&fov=42',
  c_fire: 'node=hearth&pos=1.7,1.05,0.4&target=3.3,0.6,-0.45&fov=50',
  c_drape: 'node=chess&pos=-0.2,1.7,-2.4&target=-1.45,1.8,-3.95&fov=50',
  c_chair: 'node=chess&pos=-0.9,1.2,-1.6&target=-1.45,0.55,-2.15&fov=50',
  c_boar: 'node=main&pos=-1.75,2.35,1.75&target=-3.2,2.7,0.85&fov=40',
  c_drape2: 'node=main&pos=-1.2,1.65,-1.6&target=-1.45,1.75,-4.0&fov=55',
  c_chest: 'node=hearth&pos=0.95,1.3,-0.95&target=2.0,0.5,-2.08&fov=50',
};
const OPTIONAL = new Set(Object.keys(SHOTS).filter((k) => k.startsWith('c_')));
const server = await startServer();
const browser = await launch();
fs.mkdirSync(path.resolve(ROOT, outdir), { recursive: true });
try {
  for (const [name, qs] of Object.entries(SHOTS)) {
    if (only.length ? !only.includes(name) : OPTIONAL.has(name)) continue;
    const page = await browser.newPage({ viewport: { width: 1232, height: 928 }, deviceScaleFactor: 1 });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    const t0 = Date.now();
    await page.goto(`${server.url}?room=gameroom&shot=1&time=2&${qs}${extra ? '&' + extra : ''}`, { waitUntil: 'load', timeout: 300000 });
    await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000, polling: 250 });
    const out = path.resolve(ROOT, outdir, `${name}.png`);
    await page.screenshot({ path: out, timeout: 180000 });
    const info = await page.evaluate(() => window.__SHOT_INFO || null);
    console.log(name, ((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(info?.stats || info?.renderMs || ''), errs.filter((e) => !/GPU stall|swiftshader|INVALID_ENUM/i.test(e)).slice(0, 5).join(' | '));
    await page.close();
  }
} finally {
  await browser.close(); await server.close();
}
