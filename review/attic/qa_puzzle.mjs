// QA for the attic Infection puzzle: mid-game screenshot with a selection, a full
// game (blue = level-2 search vs Stauf), the solved screenshot, and the debug solve hook.
import { launch, startServer } from '../../scripts/lib/browser.mjs';
const server = await startServer(); const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1232, height: 928 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const render = () => page.evaluate(async () => { const g = window.__game; g.post.render(g.scene, g.camera, 0); await new Promise((r) => requestAnimationFrame(r)); g.post.render(g.scene, g.camera, 0); });
const tick = (secs) => page.evaluate((secs) => { const d = window.__debug.attic; for (let i = 0; i < secs * 30; i++) d.inf.tick(1 / 30, 2 + i / 30); }, secs);
await page.goto(`${server.url}?room=attic&node=table&shot=1&ui=1&screen=puzzle&hexx=sel`);
await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000 });
await page.screenshot({ path: 'review/attic/puzzle_mid.png' });
const mid = await page.evaluate(() => window.__debug.state('attic'));
// illegal move check: from a blue cell to a far cell
const illegal = await page.evaluate(() => { const d = window.__debug.attic; const st = window.__debug.state('attic'); const b = st.board; const from = b.indexOf(1); const far = b.findIndex((v, j) => v === 0 && Math.abs(j - from) > 30); return d.move(from, far); });
// play out a whole game
const game = await page.evaluate(async () => {
  const d = window.__debug.attic; let guard = 0; const log = [];
  d.reset();
  while (guard++ < 200) {
    const st = window.__debug.state('attic');
    if (st.phase === 'over' || st.phase === 'solved') break;
    if (st.phase === 'player') { d.aiMove(2); }
    for (let i = 0; i < 90; i++) d.inf.tick(1 / 30, i / 30);
    d.staufNow();
    for (let i = 0; i < 60; i++) d.inf.tick(1 / 30, i / 30);
    if (guard % 10 === 0) log.push(`${st.blue}-${st.green}`);
  }
  await new Promise((r) => setTimeout(r, 2500));
  const st = window.__debug.state('attic');
  return { phase: st.phase, blue: st.blue, green: st.green, moves: st.moves, isSolved: st.isSolved, log };
});
await tick(1.5); await render();
await page.screenshot({ path: 'review/attic/puzzle_end.png' });
await page.goto(`${server.url}?room=attic&node=main&shot=1`);
await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000 });
const solved = await page.evaluate(async () => { await window.__debug.solve('attic'); await new Promise((r) => setTimeout(r, 2500)); return window.__debug.state('attic'); });
console.log(JSON.stringify({ mid: { phase: mid.phase, blue: mid.blue, green: mid.green, selected: mid.selected }, illegal, game, debugSolve: { phase: solved.phase, isSolved: solved.isSolved, doorOpen: solved.doorOpen, blue: solved.blue }, errs: errs.slice(0, 5) }));
await browser.close(); await server.close();
