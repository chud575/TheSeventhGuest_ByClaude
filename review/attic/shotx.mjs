// usage: node review/attic/shotx.mjs outdir name=node[&extra=1] ...
import fs from 'node:fs'; import path from 'node:path';
import { launch, startServer } from '../../scripts/lib/browser.mjs';
const [outdir, ...jobs] = process.argv.slice(2);
fs.mkdirSync(outdir, { recursive: true });
const server = await startServer(); const browser = await launch();
for (const j of jobs) {
  const [name, rest] = j.split('=');
  const [node, ...extra] = rest.split('&');
  const q = new URLSearchParams({ room: 'attic', shot: '1', time: '2', node });
  for (const e of extra) { const [k, v] = e.split(':'); q.set(k, v ?? '1'); }
  const page = await browser.newPage({ viewport: { width: 1232, height: 928 } });
  const logs = []; page.on('pageerror', (e) => logs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  const t = Date.now();
  await page.goto(`${server.url}?${q}`, { timeout: 300000 });
  await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000, polling: 250 });
  await page.screenshot({ path: path.join(outdir, name + '.png') });
  console.log(name, ((Date.now() - t) / 1000).toFixed(1) + 's', logs.filter((l) => !/GPU stall|swiftshader|INVALID_ENUM|fallback/i.test(l)).slice(0, 5).join(' | '));
  await page.close();
}
await browser.close(); await server.close();
