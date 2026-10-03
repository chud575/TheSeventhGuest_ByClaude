import { launch, startServer } from '../../scripts/lib/browser.mjs';
const server = await startServer();
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1232, height: 928 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type()==='warning') console.log('C', m.text().slice(0,200)); });
await page.goto(`${server.url}?room=foyer&node=main`);
for (let i = 0; i < 12; i++) { await page.waitForTimeout(15000); console.log(i, await page.evaluate(() => JSON.stringify({ m: window.__game?.mode, r: window.__game?.room?.id, mv: window.__game?.nav?.moving }))); }
await browser.close(); await server.close();
