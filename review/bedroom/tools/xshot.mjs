// Bedroom review shots with arbitrary URL params (e.g. brSolved=1).
//   node review/bedroom/tools/xshot.mjs out.png "node=door&brSolved=1" [out2.png "node=..."]...
import { launch, startServer } from '../../../scripts/lib/browser.mjs';
const args = process.argv.slice(2);
const server = await startServer(); const browser = await launch();
try {
  for (let i = 0; i < args.length; i += 2) {
    const out = args[i], q = args[i + 1];
    const page = await browser.newPage({ viewport: { width: 1232, height: 928 }, deviceScaleFactor: 1 });
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    const t = Date.now();
    await page.goto(`${server.url}?room=bedroom&shot=1&time=2&${q}`, { timeout: 600000 });
    await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 600000, polling: 250 });
    const err = await page.evaluate(() => window.__SHOT_ERROR || null);
    await page.screenshot({ path: out });
    console.log(out, ((Date.now() - t) / 1000).toFixed(1) + 's', err || '', errs.slice(0, 5).join(' | '));
    await page.close();
  }
} finally { await browser.close(); await server.close(); }
