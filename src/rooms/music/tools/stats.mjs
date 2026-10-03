// Scene stats for the music room: triangle counts per (named) object, NaN geometry check.
import { launch, startServer } from '../../../../scripts/lib/browser.mjs';
const server = await startServer(); const browser = await launch();
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)); });
await page.goto(`${server.url}?room=music&node=main&shot=1`);
await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000 });
console.log(await page.evaluate(() => {
  const g = window.__game; const root = g.room.group || g.room.scene; const agg = {}; let total = 0, cast = 0, meshes = 0; const nan = [];
  root.traverse((o) => { if (!o.isMesh) return; meshes++; const geo = o.geometry; const tri = (geo.index ? geo.index.count : geo.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    total += tri; if (o.castShadow) cast += tri;
    const a = geo.attributes.position.array; for (let i = 0; i < a.length; i++) if (Number.isNaN(a[i])) { nan.push(o.name + ':' + (o.material?.name || '')); break; }
    let k = o.name || ''; let p = o.parent; while (!k && p && p !== root) { k = p.name; p = p.parent; } k = (k || o.geometry.type) + (o.castShadow ? '*' : '');
    agg[k] ||= { n: 0, tri: 0 }; agg[k].n++; agg[k].tri += tri; });
  return JSON.stringify({ total, cast, meshes, nan, merged: root.userData.merged, top: Object.entries(agg).sort((a, b) => b[1].tri - a[1].tri).slice(0, 30) }, null, 0);
}));
await browser.close(); await server.close();
