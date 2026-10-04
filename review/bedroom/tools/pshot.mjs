import { launch, startServer } from '../../../scripts/lib/browser.mjs';
const [out, qs] = process.argv.slice(2);
const server = await startServer(); const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
page.on('pageerror', (e) => console.log('ERR', e.message)); page.on('console', (m) => { if (m.type() === 'error') console.log('CERR', m.text()); });
await page.goto(`${server.url}review/bedroom/tools/preview.html?${qs || ''}`);
await page.waitForFunction(() => window.__READY === true, null, { timeout: 120000 });
await page.screenshot({ path: out }); await browser.close(); await server.close();
