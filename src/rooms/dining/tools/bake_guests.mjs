// Offline: mesh the guest sculpts -> public/assets/dining/guest_<name>.bin
//   node src/rooms/dining/tools/bake_guests.mjs [h=0.0075]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { guestSDF, GUESTS, GUEST_BOUNDS, surfaceNets, packMesh } from '../guestSculpt.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../../../public/assets/dining');
const h = Number(process.argv[2] || 0.0075);
for (const [name, o] of Object.entries(GUESTS)) {
  const t0 = Date.now();
  const m = surfaceNets(guestSDF(o), GUEST_BOUNDS.min, GUEST_BOUNDS.max, h);
  const buf = packMesh(m);
  fs.writeFileSync(path.join(out, `guest_${name}.bin`), Buffer.from(buf));
  console.log(name, m.positions.length / 3, 'verts', m.indices.length / 3, 'tris', (buf.byteLength / 1024).toFixed(0) + 'KB', Date.now() - t0, 'ms');
}
