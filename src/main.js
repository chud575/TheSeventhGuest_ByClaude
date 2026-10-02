import { Game } from './engine/Game.js';

const game = new Game(document.getElementById('app'));
game.init().catch((e) => {
  console.error(e);
  window.__SHOT_ERROR = String(e?.stack || e);
  window.__SHOT_READY = true;
  const el = document.getElementById('app');
  if (el && !game.shot) el.innerHTML = `<div style="color:#c9a55a;font:16px Georgia;padding:40px">The mansion refused you: ${String(e).replace(/</g, '&lt;')}</div>`;
});
