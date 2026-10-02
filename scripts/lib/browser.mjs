// Shared helpers for the headless harness scripts (SwiftShader WebGL in Chromium).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function findChromium() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  const base = '/opt/pw-browsers';
  if (fs.existsSync(base)) {
    const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const d of dirs) {
      const p = path.join(base, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined; // let playwright try its default
}

export const CHROME_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage', '--no-sandbox'];

export async function launch() {
  const { chromium } = await import('playwright-core');
  return chromium.launch({ executablePath: findChromium(), args: CHROME_ARGS, headless: true });
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

/** Start a Vite dev server (or preview of dist with prod=true) on a free port. */
export async function startServer({ prod = false } = {}) {
  const vite = await import('vite');
  if (prod) {
    const server = await vite.preview({ root: ROOT, preview: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
    const url = server.resolvedUrls.local[0];
    return { url, close: () => new Promise((r) => server.httpServer.close(r)) };
  }
  const server = await vite.createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', hmr: false }, logLevel: 'error', clearScreen: false });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  return { url, close: () => server.close() };
}
