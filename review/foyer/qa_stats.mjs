import { launch, startServer } from '../../scripts/lib/browser.mjs';
const server = await startServer(); const browser = await launch();
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
await page.goto(`${server.url}?room=foyer&node=main&shot=1`);
await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000 });
console.log(await page.evaluate(() => {
  const g = window.__game; const root = g.room.group; const agg = {};
  root.traverse((o) => { if (!o.isMesh) return; const geo = o.geometry; const tri = (geo.index ? geo.index.count : geo.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    let k = o.name || ''; let p = o.parent; while (!k && p && p !== root) { k = p.name; p = p.parent; } k = k || o.geometry.type;
    agg[k] ||= { n: 0, tri: 0 }; agg[k].n++; agg[k].tri += tri; });
  return JSON.stringify(Object.entries(agg).sort((a, b) => b[1].tri - a[1].tri).slice(0, 25));
}));
await browser.close(); await server.close();
