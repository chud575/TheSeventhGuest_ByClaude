// Same as scripts/shot.mjs for one dining node, but tolerant of a loaded machine (long screenshot timeout).
//   node src/rooms/dining/tools/shot_long.mjs <node> <out.png> [ghosts]
import { launch, startServer } from '../../../../scripts/lib/browser.mjs';
const [node = 'main', out = 'review/dining/main.png', ghosts] = process.argv.slice(2);
const server = await startServer(); const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1232, height: 928 }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${server.url}?room=dining&node=${node}&shot=1&time=2${ghosts ? '&ghosts=1' : ''}`, { timeout: 600000 });
await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 600000, polling: 500 });
if (ghosts) await page.evaluate(async () => { window.__debug.dining.ghosts(1); const g = window.__game; g.post.render(g.scene, g.camera, 0); await new Promise((r) => requestAnimationFrame(r)); });
await page.screenshot({ path: out, timeout: 600000 });
console.log(JSON.stringify({ out, errs }));
await browser.close(); await server.close();
