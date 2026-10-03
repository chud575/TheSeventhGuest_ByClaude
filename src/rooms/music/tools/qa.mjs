#!/usr/bin/env node
// Real-time QA for the music room: plays the Simon piano puzzle through the same input path a
// click uses (wrong note, then every round correctly), checks state, then checks __debug.solve.
import { launch, startServer } from '../../../../scripts/lib/browser.mjs';
const server = await startServer({});
const browser = await launch();
const errs = [];
const open = async () => {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${server.url}?room=music&node=main&mute=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__debug?.states?.music && window.__game?.mode === 'explore', null, { timeout: 300000, polling: 500 });
  return page;
};
const st = (page) => page.evaluate(() => window.__debug.state('music'));
const until = (page, fn, arg, t = 120000) => page.waitForFunction(fn, arg, { timeout: t, polling: 100 });
let ok = true;
try {
  const page = await open();
  console.log('initial', JSON.stringify(await st(page)));
  await page.evaluate(() => window.__game.startPuzzle(window.__debug.music.puzzle));
  await until(page, () => window.__debug.state('music').phase === 'play');
  console.log('listening done', JSON.stringify(await st(page)));
  await page.evaluate(() => window.__debug.music.play(60));   // wrong note (C4)
  const afterWrong = await st(page);
  console.log('after wrong', JSON.stringify(afterWrong));
  if (afterWrong.fails !== 1 || afterWrong.phase !== 'wait') ok = false;
  for (let round = 0; round < 6; round++) {
    await until(page, () => ['play', 'done'].includes(window.__debug.state('music').phase));
    let s = await st(page);
    if (s.phase === 'done') break;
    for (let i = 0; i < s.length; i++) { await page.evaluate((m) => window.__debug.music.play(m), s.phrase[i]); }
    s = await st(page);
    console.log('round played', JSON.stringify(s));
    if (s.isSolved || s.phase === 'done') break;
  }
  await until(page, () => window.__debug.state('music').isSolved && window.__game.mode === 'explore', null, 60000);
  console.log('solved', JSON.stringify(await st(page)), 'mode', await page.evaluate(() => window.__game.mode));
  await page.close();
  const p2 = await open();
  await p2.evaluate(() => window.__debug.solve('music'));
  await until(p2, () => window.__debug.state('music').isSolved, null, 60000);
  console.log('debug solve', JSON.stringify(await st(p2)));
  await p2.close();
} catch (e) { ok = false; console.log('FAIL', e.message); }
console.log('errors', JSON.stringify(errs.slice(0, 5)));
console.log(ok && !errs.length ? 'QA PASS' : 'QA FAIL');
await browser.close(); await server.close();
