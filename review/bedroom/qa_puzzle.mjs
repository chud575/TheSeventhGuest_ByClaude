// QA for the bedroom Knights puzzle: open it via the engine, play legal/illegal clicks through the
// real raycast path (projected knight positions -> onPointer), undo, then the full optimal solution,
// then __debug.solve on a fresh load. Screenshots: puzzle start / mid / solved.
import { launch, startServer } from '../../scripts/lib/browser.mjs';
const server = await startServer(); const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1232, height: 928 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${server.url}?room=bedroom&node=chest&shot=1&ui=1&screen=puzzle`);
await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 400000 });
const render = () => page.evaluate(async () => { const g = window.__game; for (let i = 0; i < 40; i++) g.fx.update(1 / 30, 2 + i / 30); g.post.render(g.scene, g.camera, 0); await new Promise((r) => requestAnimationFrame(r)); });
await render();
await page.screenshot({ path: 'review/bedroom/qa_puzzle_start.png' });
const res = await page.evaluate(async () => {
  const g = window.__game; const k = window.__debug.bedroom.knights; const p = g.puzzle;
  const ndcOf = (sq) => {
    const piece = k.pieces.find((q) => q.sq === sq);
    const v = new (g.camera.position.constructor)(); piece.mesh.getWorldPosition(v); v.y += 0.065; v.project(g.camera); return { x: v.x, y: v.y };
  };
  const click = (sq) => { const n = ndcOf(sq); p.def.onPointer('move', { button: 0 }, n, p.pctx); p.def.onPointer('up', { button: 0 }, n, p.pctx); };
  const out = { open: p?.def?.id, start: k.state().rows };
  click(0);                                   // A1 corner: not a knight's move from the centre -> refused
  out.afterIllegal = k.state().moves;
  out.cursorLegal = p.def.cursorAt(ndcOf(23), p.pctx);
  click(23);                                  // D5 -> centre (legal)
  out.afterLegal = k.state();
  p.def.onKey('down', { key: 'u' }, p.pctx);  // undo
  out.afterUndo = k.state().grid;
  return out;
});
// play the optimal solution through real clicks
const res2 = await page.evaluate(async () => {
  const g = window.__game; const k = window.__debug.bedroom.knights; const p = g.puzzle;
  const { SOLUTION } = await import('/src/rooms/bedroom/puzzleKnights.js');
  const v = new (g.camera.position.constructor)();
  for (let i = 0; i < SOLUTION.length; i++) {
    const sq = SOLUTION[i];
    const piece = k.pieces.find((q) => q.sq === sq);
    piece.mesh.getWorldPosition(v); v.y += 0.065; v.project(g.camera);
    p.def.onPointer('move', { button: 0 }, { x: v.x, y: v.y }, p.pctx);
    p.def.onPointer('up', { button: 0 }, { x: v.x, y: v.y }, p.pctx);
    for (let f = 0; f < 20; f++) g.fx.update(1 / 30, 3 + i + f / 30);   // finish the leap animation
    if (i === 17) window.__mid = k.state();
  }
  return { mid: window.__mid.moves, end: k.state() };
});
await render();
await page.screenshot({ path: 'review/bedroom/qa_puzzle_solved.png' });
await new Promise((r) => setTimeout(r, 2500));
const solvedFlag = await page.evaluate(() => window.__game.state.isSolved('bedroom.knights'));
// fresh load: debug solver
await page.goto(`${server.url}?room=bedroom&node=door&shot=1`);
await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 400000 });
const res3 = await page.evaluate(async () => { await window.__debug.solve('bedroom'); return window.__debug.state('bedroom'); });
console.log(JSON.stringify({ res, res2, engineSolved: solvedFlag, debugSolve: res3, errs: errs.slice(0, 8) }, null, 1));
await browser.close(); await server.close();
