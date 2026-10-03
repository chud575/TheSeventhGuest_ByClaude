// usage: node review/foyer/qa_shotq.mjs out.png "room=foyer&node=main&tm=agx" [more pairs...]
import { launch, startServer } from '../../scripts/lib/browser.mjs';
const pairs = [];
for (let i = 2; i < process.argv.length; i += 2) pairs.push([process.argv[i], process.argv[i + 1]]);
const server = await startServer({});
const browser = await launch();
for (const [out, qs] of pairs) {
  const page = await browser.newPage({ viewport: { width: 1232, height: 928 }, deviceScaleFactor: 1 });
  await page.goto(`${server.url}?shot=1&time=2&${qs}`, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000, polling: 250 });
  const err = await page.evaluate(() => window.__SHOT_ERROR || null);
  await page.screenshot({ path: out });
  console.log(out, err || 'ok');
  await page.close();
}
await browser.close(); await server.close();
