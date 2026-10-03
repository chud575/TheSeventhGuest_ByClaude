// QA (real-time, real mouse clicks): open the Queens puzzle, place queens by clicking squares,
// check conflicts, remove one, then solve with the known answer and confirm the engine marks it solved.
//   node src/rooms/gameroom/tools/qa_queens.mjs
import { launch, startServer } from '../../../../scripts/lib/browser.mjs';
const server = await startServer(); const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1232, height: 928 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${server.url}?room=gameroom&node=chess&quality=low`);
await page.waitForFunction(() => window.__game?.room?.mod?.id === 'gameroom' && window.__debug?.gameroom, null, { timeout: 300000, polling: 500 });
await page.waitForTimeout(3000);
await page.evaluate(() => { const g = window.__game; const hs = g.hotspots.room.find((h) => h.id === 'queens'); g.startPuzzle(hs.puzzle); });
await page.waitForFunction(() => window.__game.puzzle && !window.__game.nav.moving, null, { timeout: 120000, polling: 300 });
await page.waitForTimeout(1500);
const sq = (c, r) => page.evaluate(([c, r]) => {
  const g = window.__game; const q = window.__debug.gameroom.queens; const grp = q.group;
  const size = 0.6 * 0.76, s = size / 8;
  const v = grp.localToWorld(new g.camera.position.constructor((c - 3.5) * s, 0.002, (3.5 - r) * s)).project(g.camera);
  const rect = g.renderer.domElement.getBoundingClientRect();
  return [rect.left + (v.x + 1) / 2 * rect.width, rect.top + (1 - v.y) / 2 * rect.height];
}, [c, r]);
const click = async (c, r) => { const [x, y] = await sq(c, r); await page.mouse.move(x, y, { steps: 3 }); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(900); };
const st = () => page.evaluate(() => window.__debug.state('gameroom'));
const out = {};
await click(0, 0); await click(1, 1);                  // diagonal conflict
out.afterConflict = await st();
await click(1, 1);                                      // lift her off
out.afterRemove = await st();
const SOL = [0, 4, 7, 5, 2, 6, 1, 3];
for (let r = 1; r < 8; r++) await click(SOL[r], r);
await page.waitForTimeout(4000);
out.final = await st();
out.engineSolved = await page.evaluate(() => window.__game.state.isSolved('gameroom.queens'));
out.puzzleOpen = await page.evaluate(() => !!window.__game.puzzle);
await page.screenshot({ path: 'review/gameroom/qa_after_solve.png' });
console.log(JSON.stringify({ ...out, errs: errs.slice(0, 5) }, null, 1));
await browser.close(); await server.close();
