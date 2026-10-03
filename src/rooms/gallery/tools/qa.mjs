#!/usr/bin/env node
// Real-time QA for the gallery: loads the room (no shot mode), opens the sliding-tile
// puzzle, slides a tile with a REAL mouse click, then solves via __debug and checks state.
//   node src/rooms/gallery/tools/qa.mjs
import { launch, startServer } from '../../../../scripts/lib/browser.mjs';
const server = await startServer({});
const browser = await launch();
const W = 1232, H = 928;
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const st = () => page.evaluate(() => ({ ...window.__debug.state('gallery'), mode: window.__game.mode }));
try {
  await page.goto(`${server.url}?room=gallery&node=portraits&mute=1&quality=ultra`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__debug?.states?.gallery && window.__game?.mode === 'explore', null, { timeout: 300000, polling: 500 });
  const s0 = await st();
  console.log('initial', JSON.stringify(s0));
  await page.evaluate(() => { window.__game.startPuzzle(window.__debug.gallery.slide.puzzle); });
  await page.waitForFunction(() => window.__game.mode === 'puzzle' && !window.__game.nav.moving, null, { timeout: 60000, polling: 300 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'review/gallery/qa_puzzle_start.png' });
  // pick the tile directly above the gap and click its centre on screen
  const target = await page.evaluate(([W, H]) => {
    const sl = window.__debug.gallery.slide;
    const b = sl.state().board, g = b.indexOf(15);
    const idx = g >= 4 ? g - 4 : g + 4;
    const id = b[idx];
    const t = sl.tiles[id];
    const p = new window.__game.camera.position.constructor();
    t.getWorldPosition(p);
    p.project(window.__game.camera);
    return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, id, idx, g };
  }, [W, H]);
  console.log('click target', JSON.stringify(target));
  await page.mouse.move(target.x, target.y); await page.waitForTimeout(300);
  await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
  await page.waitForTimeout(1200);
  const s1 = await st();
  const moved = s1.moves === 1 && s1.board[target.g] === target.id && s1.board[target.idx] === 15;
  console.log('after click', JSON.stringify(s1), moved ? 'SLIDE OK' : 'SLIDE FAILED');
  // an illegal click (diagonal tile) must not move anything
  await page.screenshot({ path: 'review/gallery/qa_puzzle_mid.png' });
  await page.evaluate(() => window.__debug.solve('gallery'));
  await page.waitForFunction(() => window.__debug.state('gallery').isSolved, null, { timeout: 60000, polling: 300 });
  await page.waitForFunction(() => window.__game.mode === 'explore', null, { timeout: 90000, polling: 500 }).catch(() => {});
  await page.waitForTimeout(2500);
  const fin = await st();
  const exitOk = await page.evaluate(() => {
    const ex = window.__game.room?.res?.exits || window.__game.room?.exits || [];
    const a = (Array.isArray(ex) ? ex : []).find((e) => e.toRoom === 'attic');
    return a ? (a.enabled ? a.enabled(window.__game.state) : true) : 'n/a';
  });
  console.log('after solve', JSON.stringify(fin), 'atticExitEnabled=', exitOk, fin.solved && fin.isSolved && fin.atticOpen ? 'SOLVE OK' : 'SOLVE FAILED');
  await page.screenshot({ path: 'review/gallery/qa_after_solve.png' });
} catch (e) { console.log('QA FAIL', e.message); }
console.log('errors:', errs.length ? errs.slice(0, 8).join('\n') : 'none');
await browser.close(); await server.close();
