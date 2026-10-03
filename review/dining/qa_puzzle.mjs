// QA: open the cake puzzle, serve slices, check rules and the solved state; screenshot mid + solved.
import { launch, startServer } from '../../scripts/lib/browser.mjs';
const server = await startServer(); const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1232, height: 928 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${server.url}?room=dining&node=table&shot=1&ui=1&screen=puzzle`);
await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000 });
const step = async (secs) => page.evaluate(async (secs) => {
  const d = window.__debug.dining; const g = window.__game;
  for (let i = 0; i < secs * 30; i++) d.cake.tick(1 / 30, 2 + i / 30);
  g.post.render(g.scene, g.camera, 0); await new Promise((r) => requestAnimationFrame(r)); g.post.render(g.scene, g.camera, 0);
}, secs);
const res = await page.evaluate(() => {
  const d = window.__debug.dining; const st = d.cake.state(); const sol = st.solution; const out = {};
  const piece = (k) => sol.map((v, i) => (v === k ? i : -1)).filter((i) => i >= 0);
  // illegal: a plain wedge with two skulls (cells of the top-left sector incl. 8 and 11?) -> use pieces that break rules
  out.illegalDisconnected = d.trySlice([0, 1, 2, 3, 4, 5, 6, 53, 52]);
  out.afterIllegal = d.cake.state().served.length;
  out.slice1 = d.trySlice(piece(1));
  out.slice5 = d.trySlice(piece(5));
  out.served = d.cake.state().served.length;
  d.cake.select(piece(0).slice(0, 6));
  return out;
});
await step(2.5);
await page.screenshot({ path: 'review/dining/puzzle_mid.png' });
const res2 = await page.evaluate(async () => {
  const d = window.__debug.dining; const sol = d.cake.state().solution;
  const piece = (k) => sol.map((v, i) => (v === k ? i : -1)).filter((i) => i >= 0);
  d.cake.select([]);
  const r = [0, 2, 3, 4].map((k) => d.trySlice(piece(k)));
  return { r, state: d.cake.state().solved, served: d.cake.state().served.map((s) => s.plate) };
});
await step(3);
await page.screenshot({ path: 'review/dining/puzzle_solved.png' });
// full solve via the debug hook on a fresh load
await page.goto(`${server.url}?room=dining&node=main&shot=1`);
await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000 });
const res3 = await page.evaluate(async () => { await window.__debug.solve('dining'); return window.__debug.state('dining'); });
console.log(JSON.stringify({ res, res2, debugSolve: { solved: res3.solved, isSolved: res3.isSolved, served: res3.served.length }, errs: errs.slice(0, 5) }));
await browser.close(); await server.close();
