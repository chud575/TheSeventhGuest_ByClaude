import * as THREE from 'three';
import { buildBoar2 } from '../trophy2.js';
import { trophyMaterials } from '../trophyMats.js';
export default async (ctx, q) => {
  const m = trophyMaterials(ctx);
  const b = buildBoar2(ctx, m.boar);
  return { objs: [b], view: { target: [0, 0, 0.26], dist: 1.3 } };
};
