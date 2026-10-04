// node src/rooms/gameroom/tools/pshot.mjs out.png "what=boar&yaw=0.6" ["what=boar&yaw=-1" out2.png ...]
import { launch, startServer } from '../../../../scripts/lib/browser.mjs';
const args = process.argv.slice(2);
const server = await startServer(); const browser = await launch();
for (let i = 0; i < args.length; i += 2) {
  const [out, qs] = [args[i], args[i + 1] || ''];
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', (e) => console.log('ERR', e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'log') console.log(m.type(), m.text()); });
  await page.goto(`${server.url}src/rooms/gameroom/tools/preview.html?${qs}`);
  await page.waitForFunction(() => window.__READY === true, null, { timeout: 300000 });
  console.log(out, JSON.stringify(await page.evaluate(() => window.__INFO)));
  await page.screenshot({ path: out }); await page.close();
}
await browser.close(); await server.close();
