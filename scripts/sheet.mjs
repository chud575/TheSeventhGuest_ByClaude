#!/usr/bin/env node
/**
 * Contact sheet: tile several PNGs into one image with captions.
 *   npm run sheet -- --out review/sheet.png [--cols 3] [--width 1848] img1.png img2.png ...
 */
import sharp from 'sharp';
import path from 'node:path';
import { parseArgs } from './lib/browser.mjs';

const args = parseArgs(process.argv.slice(2));
const files = args._;
if (!files.length) { console.error('usage: sheet --out out.png [--cols N] [--width W] files...'); process.exit(1); }
const cols = Number(args.cols || Math.min(3, files.length));
const totalW = Number(args.width || 1848);
const pad = 8, capH = 26;
const cellW = Math.floor((totalW - pad * (cols + 1)) / cols);
const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
const cellH = Math.round(cellW * (metas[0].height / metas[0].width));
const rows = Math.ceil(files.length / cols);
const H = rows * (cellH + capH + pad) + pad;
const composites = [];
for (let i = 0; i < files.length; i++) {
  const x = pad + (i % cols) * (cellW + pad), y = pad + Math.floor(i / cols) * (cellH + capH + pad);
  const buf = await sharp(files[i]).resize(cellW, cellH, { fit: 'contain', background: '#000' }).toBuffer();
  composites.push({ input: buf, left: x, top: y + capH });
  const label = path.basename(files[i]).replace(/[<&>]/g, '');
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cellW}" height="${capH}"><text x="4" y="18" font-family="Georgia, serif" font-size="16" fill="#e8dcc0">${label}</text></svg>`);
  composites.push({ input: svg, left: x, top: y });
}
await sharp({ create: { width: totalW, height: H, channels: 3, background: '#111' } }).composite(composites).png().toFile(args.out || 'review/sheet.png');
console.log(args.out || 'review/sheet.png');
