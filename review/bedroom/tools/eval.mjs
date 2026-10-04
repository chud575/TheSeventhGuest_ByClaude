import { launch, startServer } from '../../../scripts/lib/browser.mjs';
const [qs, expr] = process.argv.slice(2);
const server = await startServer(); const browser = await launch();
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
page.on('console', (m) => { if (['error', 'warning', 'log'].includes(m.type())) console.log('[c]', m.text().slice(0, 300)); });
await page.goto(`${server.url}?room=bedroom&shot=1&time=2&${qs}`, { timeout: 600000 });
await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 600000, polling: 250 });
console.log(JSON.stringify(await page.evaluate(expr)));
await browser.close(); await server.close();
