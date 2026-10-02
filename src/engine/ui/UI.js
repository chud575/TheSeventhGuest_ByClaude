import './styles.css';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import '@fontsource/im-fell-english-sc/400.css';
import { CURSORS } from './cursors/cursors.js';
import { GAME_TITLE, GAME_SUBTITLE } from '../config.js';

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
};

const ICONS = {
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
};

/**
 * DOM overlay UI. Owned by the engine; rooms use the small public API:
 *   ui.toast(text), ui.caption(text, { title, duration }), ui.subtitle(line, sec),
 *   ui.titleCard(small, big), ui.letterbox(on), ui.veil(on, msg), ui.setCursor(type)
 */
export class UI {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.el = h('div', { class: 't7-ui' });
    root.append(this.el);
    this.cursorType = 'default';
    this.cursorX = -100; this.cursorY = -100;
    this.mouseActive = true;
    this.openPanel = null;
    this._build();
  }

  _build() {
    const el = this.el;
    this.markers = h('div', { class: 't7-markers' });
    this.subs = h('div', { class: 't7-subs' });
    this.toasts = h('div', { class: 't7-toasts' });
    this.card = h('div', { class: 't7-title-card' });
    this.letter = h('div', { class: 't7-letterbox' });
    Object.assign(this.letter.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    this.veilEl = h('div', { class: 't7-veil show' }, h('div', { class: 'msg' }, 'Opening the mansion'));
    this.captionEl = h('div', { class: 't7-caption', onclick: () => this.hideCaption() });
    this.puzzleEl = h('div', { class: 't7-puzzle t7-hidden' });
    this.help = h('div', { class: 't7-help' });
    this.bar = h('div', { class: 't7-bar interactive' },
      this._icon('map', 'Map (M)', () => this.game.openMap()),
      this._icon('book', 'Book of Hints (H)', () => this.game.openHints()),
      this._icon('eye', 'Show hotspots (hold Tab)', () => this.flashMarkers()),
      this._icon('menu', 'Menu (Esc)', () => this.game.openPause()),
    );
    this.cursorEl = h('div', { class: 't7-cursor' });
    this.cursorLabel = h('div', { class: 't7-cursor-label' });
    this.fpsEl = h('div', { class: 't7-fps t7-hidden' });
    el.append(this.letter, this.markers, this.card, this.captionEl, this.puzzleEl, this.subs, this.toasts, this.help, this.bar, this.veilEl, this.cursorLabel, this.cursorEl, this.fpsEl);
    this.setCursor('default', true);
  }

  _icon(name, title, fn) {
    return h('button', { class: 't7-icon', title, 'aria-label': title, html: ICONS[name], onclick: (e) => { e.stopPropagation(); this.game.audio.sfx('click'); fn(); } });
  }

  // ---------------------------------------------------------------- cursor
  setCursor(type, force = false) {
    if (!CURSORS[type]) type = 'default';
    if (type === this.cursorType && !force) return;
    this.cursorType = type;
    this.cursorEl.innerHTML = CURSORS[type].svg;
    this.cursorEl.classList.remove('pop'); void this.cursorEl.offsetWidth; this.cursorEl.classList.add('pop');
    this._placeCursor();
  }
  setCursorLabel(text) {
    this.cursorLabel.textContent = text || '';
    this.cursorLabel.classList.toggle('show', !!text);
  }
  moveCursor(x, y) { this.cursorX = x; this.cursorY = y; this._placeCursor(); }
  _placeCursor() {
    const s = (this.game.settings.get('cursorSize') ?? 1) * 56;
    const [hx, hy] = CURSORS[this.cursorType].hot;
    this.cursorEl.style.width = this.cursorEl.style.height = `${s}px`;
    this.cursorEl.style.transform = `translate(${this.cursorX - (hx / 64) * s}px, ${this.cursorY - (hy / 64) * s}px)`;
    this.cursorLabel.style.transform = `translate(${this.cursorX + s * 0.45}px, ${this.cursorY + s * 0.35}px)`;
  }
  showCursor(on) { this.cursorEl.style.opacity = on ? '1' : '0'; if (!on) this.setCursorLabel(''); }

  // ---------------------------------------------------------------- markers
  renderMarkers(list, show, focusId) {
    this.markers.classList.toggle('show', show);
    if (!show && !this._markerFlash) { this.markers.replaceChildren(); return; }
    const frag = document.createDocumentFragment();
    for (const m of list) {
      const kind = m.h.kind === 'move' || m.h.kind === 'exit' ? 'move' : m.h.cursor;
      const d = h('div', { class: `t7-marker ${kind}${m.h.id === focusId ? ' focus' : ''}` }, m.h.label ? h('span', {}, m.h.label) : null);
      d.style.left = `${m.x}px`; d.style.top = `${m.y}px`;
      frag.append(d);
    }
    this.markers.replaceChildren(frag);
  }
  flashMarkers() { this.game.flashHotspots(2.5); }

  // ---------------------------------------------------------------- texts
  toast(text, sec = 2.6) {
    const t = h('div', { class: 't7-toast' }, text);
    this.toasts.append(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, sec * 1000);
  }

  subtitle(line, sec = 3) {
    if (!this.game.settings.get('subtitles')) return;
    const L = typeof line === 'string' ? { text: line } : line;
    const s = h('div', { class: `t7-sub ${L.speaker || ''}` });
    if (L.speaker) s.append(h('span', { class: 'who' }, L.speakerName || L.speaker));
    s.append(h('span', { html: escapeHtml(L.text).replace(/\*(.+?)\*/g, '<em>$1</em>') }));
    this.subs.replaceChildren(s);
    requestAnimationFrame(() => s.classList.add('show'));
    clearTimeout(this._subT);
    this._subT = setTimeout(() => { s.classList.remove('show'); setTimeout(() => s.remove(), 400); }, sec * 1000);
  }

  caption(text, { title = '', duration = 0 } = {}) {
    this.captionEl.replaceChildren(...(title ? [h('div', { class: 'ct' }, title)] : []), h('div', { class: 'cb' }, text));
    this.captionEl.classList.add('show');
    clearTimeout(this._capT);
    const d = duration || Math.max(3.5, text.split(/\s+/).length * 0.32 + 1.5);
    this._capT = setTimeout(() => this.hideCaption(), d * 1000);
  }
  hideCaption() { this.captionEl.classList.remove('show'); }

  titleCard(small, big, sec = 3.2) {
    this.card.replaceChildren(h('div', { class: 'small' }, small), h('div', { class: 'big' }, big), h('div', { class: 'rule' }));
    this.card.classList.add('show');
    clearTimeout(this._cardT);
    this._cardT = setTimeout(() => this.card.classList.remove('show'), sec * 1000);
  }

  letterbox(on) { this.letter.classList.toggle('on', !!on); }
  veil(on, msg) {
    if (msg) this.veilEl.firstChild.textContent = msg;
    this.veilEl.classList.toggle('show', !!on);
  }
  setHelp(html) { this.help.innerHTML = html || ''; }
  showBar(on) { this.bar.classList.toggle('show', !!on); }
  setFps(text) { this.fpsEl.classList.toggle('t7-hidden', !text); this.fpsEl.textContent = text || ''; }

  // ---------------------------------------------------------------- panels
  _overlay(content, { onClose, closable = true } = {}) {
    this.closePanel();
    const ov = h('div', { class: 't7-overlay interactive' }, content);
    ov.addEventListener('pointerdown', (e) => { if (e.target === ov && closable) this.closePanel(); });
    this.el.append(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
    this.openPanel = { el: ov, onClose, closable };
    this.game.onPanel(true);
    return ov;
  }
  closePanel() {
    const p = this.openPanel;
    if (!p) return false;
    this.openPanel = null;
    p.el.classList.remove('show');
    setTimeout(() => p.el.remove(), 350);
    p.onClose?.();
    this.game.onPanel(false);
    return true;
  }
  get panelOpen() { return !!this.openPanel; }

  showTitle({ canContinue }) {
    this.hideTitle();
    const menu = h('div', { class: 't7-menu interactive' },
      h('button', { class: 't7-btn', onclick: () => this.game.newGame() }, 'New Game'),
      h('button', { class: 't7-btn', disabled: !canContinue, onclick: () => this.game.continueGame() }, 'Continue'),
      h('button', { class: 't7-btn', onclick: () => this.showSaves('load') }, 'Load'),
      h('button', { class: 't7-btn', onclick: () => this.showSettings() }, 'Settings'),
    );
    this.titleEl = h('div', { class: 't7-title' },
      h('div', { class: 'pre' }, 'An Homage'),
      h('div', { class: 'logo' }, GAME_TITLE, h('small', {}, GAME_SUBTITLE)),
      h('div', { class: 'tag' }, 'Six guests were invited. One more was expected.'),
      menu,
      h('div', { class: 'foot' }, 'Original homage — all art, music & words generated anew. Best with headphones.'),
    );
    this.el.append(this.titleEl);
    requestAnimationFrame(() => this.titleEl.classList.add('show'));
  }
  hideTitle() {
    if (!this.titleEl) return;
    const t = this.titleEl; this.titleEl = null;
    t.classList.remove('show'); setTimeout(() => t.remove(), 1600);
  }

  showPause() {
    const p = h('div', { class: 'panel' },
      h('h2', {}, 'Paused'), h('div', { class: 'rule' }),
      h('div', { class: 't7-menu' },
        h('button', { class: 't7-btn', onclick: () => this.closePanel() }, 'Resume'),
        h('button', { class: 't7-btn', onclick: () => this.showSaves('save') }, 'Save Game'),
        h('button', { class: 't7-btn', onclick: () => this.showSaves('load') }, 'Load Game'),
        h('button', { class: 't7-btn', onclick: () => this.game.openMap() }, 'Map of the House'),
        h('button', { class: 't7-btn', onclick: () => this.game.openHints() }, 'Book of Hints'),
        h('button', { class: 't7-btn', onclick: () => this.showSettings() }, 'Settings'),
        h('button', { class: 't7-btn', onclick: () => this.game.quitToTitle() }, 'Quit to Title'),
      ));
    this._overlay(p);
  }

  showSaves(mode = 'save') {
    const sys = this.game.saves;
    const grid = h('div', { class: 't7-slots' });
    for (const { slot, data } of sys.list()) {
      if (mode === 'save' && slot === 'auto') continue;
      const empty = !data;
      const card = h('button', { class: `t7-slot${empty ? ' empty' : ''}`, disabled: mode === 'load' && empty },
        h('div', { class: 'thumb' }),
        h('div', { class: 'meta' },
          h('div', { class: 'name' }, slot === 'auto' ? 'Autosave' : `Slot ${slot}`),
          h('div', { class: 'room' }, empty ? 'Empty' : data.roomTitle || data.room),
          h('div', { class: 'when' }, empty ? '' : `${new Date(data.time).toLocaleString()} · ${fmtTime(data.playTime)}`),
        ));
      if (data?.thumb) card.querySelector('.thumb').style.backgroundImage = `url(${data.thumb})`;
      card.addEventListener('click', () => {
        this.game.audio.sfx('click');
        if (mode === 'save') { this.game.saveTo(slot); this.showSaves('save'); this.toast('The house remembers.'); }
        else { this.closePanel(); this.game.loadFrom(slot); }
      });
      grid.append(card);
    }
    const p = h('div', { class: 'panel' },
      h('h2', {}, mode === 'save' ? 'Save Game' : 'Load Game'),
      h('div', { class: 'sub' }, mode === 'save' ? 'Inscribe your progress in the ledger.' : 'Return to a moment past.'),
      grid,
      h('div', { class: 't7-row' }, h('button', { class: 't7-btn small framed', onclick: () => (this.game.started ? this.showPause() : this.closePanel()) }, 'Back')),
    );
    this._overlay(p);
  }

  showSettings(tab = 'video') {
    const s = this.game.settings;
    const tabs = ['video', 'audio', 'controls', 'access'];
    const names = { video: 'Video', audio: 'Audio', controls: 'Controls', access: 'Accessibility' };
    const body = h('div');
    const range = (key, label, min, max, step, hint) => {
      const out = h('span', { style: 'color:var(--gold);font-size:14px;margin-left:8px' }, String(s.get(key)));
      const inp = h('input', { type: 'range', min, max, step, value: s.get(key) });
      inp.addEventListener('input', () => { const v = parseFloat(inp.value); s.set(key, v); out.textContent = String(v); });
      return h('div', { class: 't7-setting' }, h('label', {}, label, out, hint ? h('span', { class: 'hint' }, hint) : null), inp);
    };
    const toggle = (key, label, hint) => {
      const t = h('div', { class: `t7-toggle${s.get(key) ? ' on' : ''}`, role: 'switch', tabindex: 0 });
      t.addEventListener('click', () => { s.set(key, !s.get(key)); t.classList.toggle('on', !!s.get(key)); this.game.audio.sfx('click'); });
      return h('div', { class: 't7-setting' }, h('label', {}, label, hint ? h('span', { class: 'hint' }, hint) : null), t);
    };
    const select = (key, label, opts, hint) => {
      const sel = h('select', {}, ...opts.map(([v, n]) => h('option', { value: v, selected: s.get(key) === v }, n)));
      sel.addEventListener('change', () => s.set(key, sel.value));
      return h('div', { class: 't7-setting' }, h('label', {}, label, hint ? h('span', { class: 'hint' }, hint) : null), sel);
    };
    const pages = {
      video: () => [
        select('quality', 'Quality', [['auto', `Auto (${this.game.preset.name})`], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], 'Ambient occlusion, shadows, volumetrics, texture detail'),
        range('fov', 'Field of view', 40, 80, 1),
        range('brightness', 'Brightness', 0.6, 1.6, 0.05, 'The house is meant to be dark — but not unplayably so'),
        toggle('filmGrain', 'Film grain'),
        toggle('showFps', 'Show frame rate'),
      ],
      audio: () => [
        range('masterVolume', 'Master', 0, 1, 0.05),
        range('musicVolume', 'Music', 0, 1, 0.05),
        range('ambienceVolume', 'Ambience', 0, 1, 0.05),
        range('sfxVolume', 'Effects', 0, 1, 0.05),
        range('voiceVolume', 'Voices', 0, 1, 0.05),
      ],
      controls: () => [
        range('lookSensitivity', 'Look sensitivity', 0.3, 2.5, 0.05),
        toggle('invertY', 'Invert vertical look'),
        toggle('invertX', 'Invert horizontal look'),
        range('transitionSpeed', 'Movement speed', 0.5, 2.5, 0.1, 'Speed of the glide between viewpoints'),
        h('div', { class: 't7-keys', style: 'margin-top:14px' },
          h('kbd', {}, 'Click'), 'Move / examine / interact',
          h('kbd', {}, 'Drag · Arrows · WASD'), 'Look around',
          h('kbd', {}, 'Wheel'), 'Lean in (zoom)',
          h('kbd', {}, 'Hold Tab'), 'Reveal hotspots',
          h('kbd', {}, 'Q / E'), 'Cycle hotspots · Enter to use',
          h('kbd', {}, 'Space'), 'Skip glide / dialogue',
          h('kbd', {}, 'Backspace'), 'Step back',
          h('kbd', {}, 'M · H · Esc'), 'Map · Hints · Menu',
          h('kbd', {}, 'F5 · F9'), 'Quick save · Quick load',
          h('kbd', {}, 'Gamepad'), 'L-stick cursor · R-stick look · A use · B back · Y hints · Start menu',
        ),
      ],
      access: () => [
        toggle('subtitles', 'Subtitles'),
        range('subtitleSize', 'Subtitle size', 0.7, 1.8, 0.05),
        range('cursorSize', 'Cursor size', 0.6, 2, 0.05),
        toggle('reduceMotion', 'Reduce motion', 'Dissolves instead of glides; no head-bob or sway'),
        select('hotspotHints', 'Hotspot reveal', [['hold', 'Hold Tab'], ['toggle', 'Toggle Tab'], ['off', 'Off']]),
      ],
    };
    const tabBar = h('div', { class: 't7-tabs' }, ...tabs.map((t) => h('button', { class: `t7-tab${t === tab ? ' on' : ''}`, onclick: () => this.showSettings(t) }, names[t])));
    body.append(...pages[tab]());
    const p = h('div', { class: 'panel', style: 'width:min(92vw,720px)' },
      h('h2', {}, 'Settings'), h('div', { class: 'rule' }), tabBar, body,
      h('div', { class: 't7-row' },
        h('button', { class: 't7-btn small framed', onclick: () => { s.resetToDefaults(); this.showSettings(tab); } }, 'Defaults'),
        h('button', { class: 't7-btn small framed', onclick: () => (this.game.started ? this.showPause() : this.closePanel()) }, 'Back')),
    );
    this._overlay(p);
  }

  showMap(data) {
    // data: { floors: [{ id, name, rooms: [{ id, title, rect:[x,y,w,h], visited, current, solved, known }] }], floor }
    const floorId = data.floor || data.floors[0]?.id;
    const floor = data.floors.find((f) => f.id === floorId) || data.floors[0];
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1000 640');
    const defs = `<defs><pattern id="t7grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(201,165,90,.06)"/></pattern></defs><rect width="1000" height="640" fill="url(#t7grid)"/>`;
    svg.innerHTML = defs + `<text x="500" y="40" text-anchor="middle" style="font-family:var(--font-display);font-size:22px;letter-spacing:.3em;fill:#c9a55a">${escapeHtml(floor?.name || '')}</text>`;
    for (const r of floor?.rooms || []) {
      const [x, y, w, hh] = r.rect;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'room');
      const cls = ['room-rect', r.visited ? 'visited' : '', r.current ? 'current' : '', r.solved ? 'solved' : ''].join(' ');
      g.innerHTML = `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${hh}" rx="2"/>` +
        `<text x="${x + w / 2}" y="${y + hh / 2 + 5}" text-anchor="middle" class="${r.visited ? '' : 'unknown'}">${escapeHtml(r.visited || r.known ? r.title : '? ? ?')}</text>` +
        (r.current ? `<circle cx="${x + w / 2}" cy="${y + hh / 2 + 18}" r="4" fill="#9fb8ff"><animate attributeName="r" values="3;6;3" dur="1.6s" repeatCount="indefinite"/></circle>` : '');
      if (r.visited && !r.current) g.addEventListener('click', () => { this.closePanel(); this.game.fastTravel(r.id); });
      svg.append(g);
    }
    const tabs = h('div', { class: 't7-tabs' }, ...data.floors.map((f) => h('button', { class: `t7-tab${f.id === floor?.id ? ' on' : ''}`, onclick: () => this.showMap({ ...data, floor: f.id }) }, f.name)));
    const p = h('div', { class: 'panel t7-map' },
      h('h2', {}, 'The House'), h('div', { class: 'rule' }), tabs, svg,
      h('div', { class: 'legend' }, 'Rooms you have entered may be revisited with a click.'),
      h('div', { class: 't7-row' }, h('button', { class: 't7-btn small framed', onclick: () => this.closePanel() }, 'Close')));
    this._overlay(p);
  }

  showHintBook({ puzzles, selected, onReveal, onSolve }) {
    const sel = puzzles.find((p) => p.id === selected) || puzzles.find((p) => p.current) || puzzles.find((p) => !p.solved) || puzzles[0];
    const list = h('div', { class: 'list' }, ...puzzles.map((p) => {
      const a = h('a', { class: p.solved ? 'solved' : '' }, `${p.title}${p.room ? ` — ${p.room}` : ''}`);
      a.addEventListener('click', () => { this.game.audio.sfx('page'); this.showHintBook({ puzzles, selected: p.id, onReveal, onSolve }); });
      return a;
    }));
    const left = h('div', { class: 'page' },
      h('h3', {}, 'Book of Hints'), h('div', { class: 'orn' }, '❧ ❦ ❧'),
      h('p', { style: 'font-style:italic;margin-top:0' }, 'The pages turn of their own accord. Each riddle the house poses may be consulted thrice; the third consultation answers it outright.'),
      puzzles.length ? list : h('p', {}, 'No riddles have yet presented themselves.'));
    const right = h('div', { class: 'page' });
    if (sel) {
      right.append(h('h3', {}, sel.title), h('div', { class: 'orn' }, '☙'));
      if (sel.description) right.append(h('p', { style: 'font-style:italic' }, sel.description));
      sel.hints.forEach((txt, i) => {
        const unlocked = i < sel.used;
        right.append(h('div', { class: `hint${unlocked ? '' : ' locked'}`, 'data-n': ['I', 'II', 'III', 'IV', 'V'][i] || i + 1 }, unlocked ? txt : 'This page is still sealed.'));
      });
      if (!sel.solved) {
        const canReveal = sel.used < sel.hints.length;
        right.append(h('div', { class: 't7-row' },
          canReveal ? h('button', { class: 't7-btn small', onclick: () => { onReveal(sel.id); this.game.audio.sfx('page'); this.showHintBook({ puzzles: this.game.hintBookData(), selected: sel.id, onReveal, onSolve }); } }, 'Consult the Book') : null,
          !canReveal && sel.canAutoSolve ? h('button', { class: 't7-btn small', onclick: () => { this.closePanel(); onSolve(sel.id); } }, 'Let the Book solve it') : null,
        ));
      } else right.append(h('p', { style: 'text-align:center;font-style:italic' }, 'Solved.'));
    }
    const book = h('div', { class: 'panel t7-book' }, left, right,
      h('button', { class: 't7-btn small close', onclick: () => this.closePanel() }, 'Close'));
    book.style.padding = '0';
    this._overlay(book);
  }

  // ---------------------------------------------------------------- puzzle chrome
  showPuzzle({ title, description, onHint, onReset, onLeave, canReset = true }) {
    this.puzzleEl.replaceChildren(
      h('div', { class: 'ptitle' }, title, description ? h('div', { class: 'pdesc' }, description) : null),
      this.puzzleStatus = h('div', { class: 'pstatus' }),
      h('div', { class: 'pbar' },
        h('button', { class: 't7-btn small', onclick: () => { this.game.audio.sfx('click'); onHint(); } }, 'Hint'),
        canReset ? h('button', { class: 't7-btn small', onclick: () => { this.game.audio.sfx('click'); onReset(); } }, 'Reset') : null,
        h('button', { class: 't7-btn small', onclick: () => { this.game.audio.sfx('click'); onLeave(); } }, 'Leave')),
    );
    this.puzzleEl.classList.remove('t7-hidden');
  }
  setPuzzleStatus(text) { if (this.puzzleStatus) this.puzzleStatus.textContent = text || ''; }
  hidePuzzle() { this.puzzleEl.classList.add('t7-hidden'); this.puzzleEl.replaceChildren(); }
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmtTime(sec = 0) { const m = Math.floor(sec / 60); const hh = Math.floor(m / 60); return hh ? `${hh}h ${m % 60}m` : `${m}m`; }
