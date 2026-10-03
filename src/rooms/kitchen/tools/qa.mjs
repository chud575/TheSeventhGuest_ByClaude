#!/usr/bin/env node
// Real-time QA for the kitchen: loads the room (no shot mode), opens the can puzzle,
// swaps two tins with REAL mouse clicks, then solves via __debug and checks state.
import { launch, startServer } from '../../../../scripts/lib/browser.mjs';
const server = await startServer({});
const browser = await launch();
const W = 960, H = 720;
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const st = () => page.evaluate(() => ({ ...window.__debug.state('kitchen'), mode: window.__game.mode }));
try {
  await page.goto(`${server.url}?room=kitchen&node=pantry&mute=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__debug?.states?.kitchen && window.__game?.mode === 'explore', null, { timeout: 240000, polling: 500 });
  console.log('initial', JSON.stringify(await st()));
  await page.evaluate(() => { window.__game.startPuzzle(window.__debug.kitchen.cans.puzzle); });
  await page.waitForFunction(() => window.__game.mode === 'puzzle' && !window.__game.nav.moving, null, { timeout: 60000, polling: 300 });
  await page.waitForTimeout(1500);
  const screenOf = (slot) => page.evaluate(([slot, W, H]) => {
    const k = window.__debug.kitchen.cans;
    const order = k.word();
    // find which can is in this slot: slots are positions; nearest can to slot position
    const g = window.__game;
    const parent = k.cans[0].parent;
    const sp = k.slots[slot].clone(); sp.y += 0.06; parent.localToWorld(sp);
    sp.project(g.camera);
    return { x: (sp.x * 0.5 + 0.5) * W, y: (-sp.y * 0.5 + 0.5) * H, order };
  }, [slot, W, H]);
  const a = await screenOf(0), b = await screenOf(4);
  console.log('click targets', JSON.stringify(a), JSON.stringify(b));
  const before = (await st()).word;
  await page.mouse.move(a.x, a.y); await page.waitForTimeout(200);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(600);
  console.log('after first click', JSON.stringify(await st()));
  await page.mouse.move(b.x, b.y); await page.waitForTimeout(200);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(1200);
  const after = (await st()).word;
  const swapped = after[0] === before[4] && after[4] === before[0];
  console.log('after swap', after, swapped ? 'SWAP OK' : 'SWAP FAILED');
  await page.screenshot({ path: 'review/kitchen/qa_puzzle_rt.png' });
  await page.evaluate(() => window.__debug.solve('kitchen'));
  await page.waitForFunction(() => window.__debug.state('kitchen').isSolved, null, { timeout: 60000, polling: 300 });
  await page.waitForFunction(() => window.__game.mode === 'explore', null, { timeout: 90000, polling: 500 }).catch(() => {});
  const fin = await st();
  console.log('after solve', JSON.stringify(fin), fin.solved && fin.isSolved && fin.dumbwaiterOpen ? 'SOLVE OK' : 'SOLVE FAILED');
} catch (e) { console.log('QA FAIL', e.message); }
console.log('errors:', errs.length ? errs.slice(0, 8).join('\n') : 'none');
await browser.close(); await server.close();
