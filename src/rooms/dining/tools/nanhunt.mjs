// QA: find the mesh that produces non-finite pixels (bloom goes black) at a node.
import { launch, startServer } from '../../../../scripts/lib/browser.mjs';
const node = process.argv[2] || 'table';
const server = await startServer(); const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1232, height: 928 } });
await page.goto(`${server.url}?room=dining&node=${node}&shot=1`);
await page.waitForFunction(() => window.__SHOT_READY === true, null, { timeout: 300000 });
const res = await page.evaluate(async () => {
  const g = window.__game;
  const root = g.room.scene || g.scene;
  const meshes = []; root.traverse((o) => { if (o.isMesh || o.isPoints) meshes.push(o); });
  const canvas = g.renderer.domElement;
  const lum = () => { g.post.render(g.scene, g.camera, 0); const c = document.createElement('canvas'); c.width = 64; c.height = 48; const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, 64, 48); const d = x.getImageData(0, 0, 64, 48).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / (64 * 48); };
  const base = lum();
  const out = { base, n: meshes.length, culprits: [] };
  // bisect over meshes
  let cand = meshes.slice();
  while (cand.length > 1) {
    const half = cand.slice(0, cand.length >> 1);
    half.forEach((m) => (m.visible = false));
    const l = lum();
    half.forEach((m) => (m.visible = true));
    cand = l > base * 3 ? half : cand.slice(cand.length >> 1);
  }
  const m = cand[0];
  out.culprits.push({ name: m.name, type: m.type, mat: m.material?.name, matType: m.material?.type, parent: m.parent?.name, tris: m.geometry?.index ? m.geometry.index.count / 3 : m.geometry?.attributes.position.count / 3 });
  m.visible = false; out.after = lum(); m.visible = true;
  const T = g.THREE || window.THREE;
  const orig = m.material;
  const tryMat = (k, mm) => { m.material = mm; out[k] = lum(); };
  const C = orig.constructor;
  tryMat('noClearcoat', Object.assign(orig.clone(), { clearcoat: 0 }));
  tryMat('noMaps', Object.assign(orig.clone(), { map: null, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null }));
  tryMat('rough1', Object.assign(orig.clone(), { roughnessMap: null, roughness: 1, clearcoat: 0 }));
  m.material = orig;
  // which triangles? test halves of the index range by drawRange
  const geo = m.geometry; const total = geo.index ? geo.index.count : geo.attributes.position.count;
  let lo = 0, hi = total;
  while (hi - lo > 3) {
    const mid = lo + Math.floor((hi - lo) / 6) * 3;
    geo.setDrawRange(lo, mid - lo); const l = lum();
    if (l < out.base * 3) hi = mid; else lo = mid;
  }
  geo.setDrawRange(0, Infinity);
  const ix = geo.index ? [geo.index.getX(lo), geo.index.getX(lo + 1), geo.index.getX(lo + 2)] : [lo, lo + 1, lo + 2];
  out.tri = ix.map((i) => [geo.attributes.position.getX(i), geo.attributes.position.getY(i), geo.attributes.position.getZ(i), geo.attributes.normal.getX(i), geo.attributes.normal.getY(i), geo.attributes.normal.getZ(i), geo.attributes.uv.getX(i), geo.attributes.uv.getY(i)]);
  return out;
});
console.log(JSON.stringify(res));
await browser.close(); await server.close();
