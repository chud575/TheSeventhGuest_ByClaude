#!/usr/bin/env node
/**
 * Blind A/B pair for side-by-side review.
 *
 *   npm run blind -- <candidate.png> <original.png> <outDir> <A|B>
 *
 * The candidate is written to outDir/<A|B>.png and the original to the other
 * letter. Both are normalised to identical 1232x928 PNGs: the original's black
 * letterbox bars (e.g. the 1993 640x480 frames) are detected and cropped away,
 * then both images are scaled to cover 1232x928 (centre crop) with the same
 * Lanczos kernel and stripped of metadata, so a reviewer can't tell them apart
 * by size or format. A pair.json (not to be shown to the reviewer) records which is which.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [cand, orig, outDir, letter] = process.argv.slice(2);
if (!cand || !orig || !outDir || !/^[AB]$/i.test(letter || '')) {
  console.error('usage: blind.mjs <candidate.png> <original.png> <outDir> <A|B>');
  process.exit(1);
}
const W = 1232, H = 928;

/** Find the content box by trimming near-black rows/columns at the borders. */
async function contentBox(file, thresh = 14) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const rowMax = (y) => { let m = 0; for (let x = 0; x < w; x += 2) { const i = (y * w + x) * c; m = Math.max(m, data[i], data[i + 1], data[i + 2]); } return m; };
  const colMax = (x, y0, y1) => { let m = 0; for (let y = y0; y < y1; y += 2) { const i = (y * w + x) * c; m = Math.max(m, data[i], data[i + 1], data[i + 2]); } return m; };
  // a "bar" row must be dark across (almost) its whole width
  const rowIsBar = (y) => { let bright = 0; for (let x = 0; x < w; x += 2) { const i = (y * w + x) * c; if (Math.max(data[i], data[i + 1], data[i + 2]) > thresh) bright++; } return bright < (w / 2) * 0.01 && rowMax(y) < 255; };
  let top = 0, bottom = h - 1;
  while (top < h / 3 && rowIsBar(top)) top++;
  while (bottom > (h * 2) / 3 && rowIsBar(bottom)) bottom--;
  let left = 0, right = w - 1;
  while (left < w / 3 && colMax(left, top, bottom) <= thresh) left++;
  while (right > (w * 2) / 3 && colMax(right, top, bottom) <= thresh) right--;
  return { left, top, width: right - left + 1, height: bottom - top + 1, srcW: w, srcH: h };
}

async function normalise(file, out) {
  const box = await contentBox(file);
  let img = sharp(file).removeAlpha();
  if (box.width < box.srcW || box.height < box.srcH) img = img.extract({ left: box.left, top: box.top, width: box.width, height: box.height });
  await img.resize(W, H, { fit: 'cover', position: 'centre', kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(out);
  return box;
}

fs.mkdirSync(outDir, { recursive: true });
const L = letter.toUpperCase();
const other = L === 'A' ? 'B' : 'A';
const cBox = await normalise(cand, path.join(outDir, `${L}.png`));
const oBox = await normalise(orig, path.join(outDir, `${other}.png`));
fs.writeFileSync(path.join(outDir, 'pair.json'), JSON.stringify({ candidate: L, original: other, candidateSrc: cand, originalSrc: orig, cropped: { candidate: cBox, original: oBox } }, null, 2));
console.log(JSON.stringify({ A: path.join(outDir, 'A.png'), B: path.join(outDir, 'B.png'), candidate: L }));
