// QA (real-time, no shot mode): deep-link into the dining room, open the cake puzzle through the
// engine, paint a slice with simulated pointer events on projected cell centres, then play the ghost scene.
import { launch, startServer } from '../../scripts/lib/browser.mjs';
const server = await startServer(); const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${server.url}?room=dining&node=main`);
await page.waitForFunction(() => window.__game?.room?.mod?.id === 'dining' && window.__debug?.dining, null, { timeout: 300000 });
await page.waitForFunction(() => window.__game.mode === 'explore', null, { timeout: 120000 });
await page.waitForTimeout(1000);
const r = await page.evaluate(async () => {
  const g = window.__game; const d = window.__debug.dining; const THREE = g.room.ctx.THREE;
  const hs = g.hotspots.room.map((h) => h.id);
  const started = g.startPuzzle(d.cake.puzzle);
  await started;   // resolves once the camera has arrived and setup ran
  await new Promise((res) => setTimeout(res, 300));
  const sol = d.cake.state().solution;
  const ids = sol.map((v, i) => (v === 1 ? i : -1)).filter((i) => i >= 0);
  const ndcOf = (i) => { const m = d.cake.meshes[i]; const p = new THREE.Vector3(0, 0.1, 0); m.localToWorld(p); p.project(g.camera); return { x: p.x, y: p.y }; };
  const ev = { preventDefault() {}, button: 0 };
  g._puzzlePointer('down', ev, ndcOf(ids[0]));
  for (const i of ids.slice(1)) g._puzzlePointer('move', ev, ndcOf(i));
  g._puzzlePointer('up', ev, ndcOf(ids[ids.length - 1]));
  await new Promise((res) => setTimeout(res, 200));
  const st = d.cake.state();
  const mode = g.mode;
  await g.leavePuzzle();
  return { hs, served: st.served.length, servedCells: st.served[0]?.cells, selectedAfter: st.selected.length, mode };
});
console.log(JSON.stringify(r));
// ghost scene through its hotspot
const r2 = await page.evaluate(async () => {
  const g = window.__game; const h = g.hotspots.room.find((x) => x.id === 'guests');
  const p = h.onActivate(g.room.ctx, h);
  await new Promise((res) => setTimeout(res, 3500));
  return { ok: true, cinematic: g.mode };
});
console.log(JSON.stringify(r2));
await page.screenshot({ path: 'review/dining/dbg/qa_ghosts.png' });
console.log(JSON.stringify({ errs: errs.filter((e) => !/AudioContext|autoplay/i.test(e)).slice(0, 8) }));
await browser.close(); await server.close();
