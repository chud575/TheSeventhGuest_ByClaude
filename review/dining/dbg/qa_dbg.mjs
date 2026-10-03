import { launch, startServer } from '../../../scripts/lib/browser.mjs';
const server = await startServer(); const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${server.url}?room=dining&node=main`);
await page.waitForFunction(() => window.__game?.room?.mod?.id === 'dining' && window.__debug?.dining, null, { timeout: 300000 });
await page.waitForTimeout(1500);
console.log(await page.evaluate(async () => {
  const g = window.__game; const d = window.__debug.dining; const THREE = g.room.ctx.THREE;
  g.startPuzzle(d.cake.puzzle);
  const t0 = performance.now(); const log = []; for (let i = 0; i < 12; i++) { await new Promise((res) => setTimeout(res, 1000)); log.push([g.mode, g.camera.position.y.toFixed(2), g.renderer.info.render.frame]); }
  const p = g.puzzle;
  const m = d.cake.meshes[10]; const w = new THREE.Vector3(0, 0.1, 0); m.localToWorld(w); const n = w.clone().project(g.camera);
  const hits = p.pctx.raycast(d.cake.meshes, { x: n.x, y: n.y });
  return JSON.stringify({ log, hasPuzzle: !!p, solved: p?.solved, mode: g.mode, cam: g.camera.position.toArray().map((v) => v.toFixed(2)), w: w.toArray().map((v) => v.toFixed(2)), n: [n.x, n.y], hits: hits.length, first: hits[0]?.object?.name, cellUD: hits[0]?.object?.userData });
}));
console.log(errs);
await browser.close(); await server.close();
