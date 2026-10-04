// Review capture of the spectral dinner guests (hotspot 'guests'): ?ghosts=1 at a node.
import { launch, startServer } from '../../../scripts/lib/browser.mjs';
const node = process.argv[2] || 'table', out = process.argv[3] || 'review/dining/guests.png';
const server = await startServer(); const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1232, height: 928 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${server.url}?room=dining&node=${node}&shot=1&time=2&ghosts=1`);
await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000 });
await page.evaluate(async () => { window.__debug.dining.ghosts(0.3); const g = window.__game; g.post.render(g.scene, g.camera, 0); await new Promise((r) => requestAnimationFrame(r)); });
await page.screenshot({ path: out });
console.log(JSON.stringify({ out, errs }));
await browser.close(); await server.close();
