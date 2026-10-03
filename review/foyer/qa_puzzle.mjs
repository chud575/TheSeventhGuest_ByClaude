import { startServer, findChromium, CHROME_ARGS } from '../../scripts/lib/browser.mjs';
import { chromium } from 'playwright-core';
const launch = () => chromium.launch({ executablePath: findChromium(), args: [...CHROME_ARGS, '--autoplay-policy=no-user-gesture-required'], headless: true });
const server = await startServer();
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1232, height: 928 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${server.url}?room=foyer&node=main&quality=high`);
await page.waitForTimeout(3000); await page.mouse.click(5, 5);
await page.waitForFunction(() => window.__game?.room?.mod?.id === 'foyer' && window.__game.mode === 'explore' && !window.__game.nav.moving, null, { timeout: 300000 });
console.log('loaded');
await page.evaluate(async () => { const g = window.__game; const hs = g.hotspots.room.find((h) => h.puzzle); g.startPuzzle(hs.puzzle); });
await page.waitForFunction(() => window.__game.puzzle && !window.__game.nav.moving, null, { timeout: 120000 });
await page.waitForTimeout(1500);
const scr = async (i) => page.evaluate((i) => {
  const g = window.__game; const p = window.__debug.foyer.web.points[i].clone();
  p.project(g.camera); const r = g.renderer.domElement.getBoundingClientRect();
  return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
}, i);
// try an illegal move first: select 0 then 1 (not linked)
const moves = [[0, 3], [5, 0], [2, 5], [7, 2], [4, 7], [1, 4], [6, 1]];
for (let m = 0; m < moves.length; m++) {
  const [a, b] = moves[m];
  for (const i of [a, b]) { const s = await scr(i); await page.mouse.move(s.x, s.y); await page.waitForTimeout(150); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(300); }
  await page.waitForFunction((n) => window.__debug.state('foyer').placed >= n, m + 1, { timeout: 60000 });
  await page.waitForFunction(() => !window.__debug.state('foyer').animating, null, { timeout: 120000 });
  if (m === 2) await page.screenshot({ path: 'review/foyer/qa_puzzle_mid.png' });
  console.log('move', m, JSON.stringify(await page.evaluate(() => window.__debug.state('foyer'))));
}
await page.waitForFunction(() => window.__debug.state('foyer').isSolved, null, { timeout: 60000 });
await page.waitForTimeout(6000);
await page.screenshot({ path: 'review/foyer/qa_puzzle_solved.png' });
console.log('final', JSON.stringify(await page.evaluate(() => ({ s: window.__debug.state('foyer'), mode: window.__game.mode }))));
// fresh page: debug solve
await page.close();
const p2 = await browser.newPage({ viewport: { width: 800, height: 600 } });
await p2.goto(`${server.url}?room=foyer&node=main&quality=low`);
await p2.waitForTimeout(3000); await p2.mouse.click(5, 5);
await p2.waitForFunction(() => window.__game?.room?.mod?.id === 'foyer' && window.__game.mode === 'explore', null, { timeout: 300000 });
await p2.evaluate(() => window.__debug.solve('foyer'));
await p2.waitForFunction(() => window.__debug.state('foyer').isSolved, null, { timeout: 60000 });
console.log('debugsolve', JSON.stringify(await p2.evaluate(() => window.__debug.state('foyer'))));
console.log('errors', errs.slice(0, 5));
await browser.close(); await server.close();
