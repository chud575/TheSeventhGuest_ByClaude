import * as THREE from 'three';
import { buildStag2 } from '../trophy2.js';
import { trophyMaterials } from '../trophyMats.js';
export default async (ctx, q) => {
  const m = trophyMaterials(ctx);
  const b = buildStag2(ctx, m.stag);
  return { objs: [b], view: { target: [0, 0.25, 0.3], dist: 1.9 } };
};
