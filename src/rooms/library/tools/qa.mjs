#!/usr/bin/env node
// Real-time QA for the library: loads the room (no shot mode), turns prisms, solves via __debug, checks state.
import { launch, startServer } from '../../../../scripts/lib/browser.mjs';
const server = await startServer({});
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
try {
  await page.goto(`${server.url}?room=library&node=main&mute=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__debug?.states?.library && window.__game?.mode === 'explore', null, { timeout: 240000, polling: 500 });
  console.log('initial', JSON.stringify(await page.evaluate(() => window.__debug.state('library'))));
  await page.evaluate(() => { window.__debug.library.turn(0); window.__debug.library.turn(0); });
  await page.waitForTimeout(500);
  console.log('after turns', JSON.stringify(await page.evaluate(() => window.__debug.state('library'))));
  await page.evaluate(() => window.__debug.solve('library'));
  await page.waitForFunction(() => window.__debug.state('library').isSolved, null, { timeout: 60000, polling: 300 });
  await page.waitForFunction(() => window.__game.mode === "explore", null, { timeout: 90000, polling: 500 }).catch(() => {});
  console.log('after solve', JSON.stringify(await page.evaluate(() => ({ ...window.__debug.state('library'), mode: window.__game.mode }))));
} catch (e) { console.log('QA FAIL', e.message); }
console.log('errors:', errs.length ? errs.slice(0, 8).join('\n') : 'none');
await browser.close(); await server.close();
