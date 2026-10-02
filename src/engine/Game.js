import * as THREE from 'three';
import { Settings } from './core/Settings.js';
import { SaveSystem } from './core/SaveSystem.js';
import { GameState } from './core/State.js';
import { Random } from './core/Random.js';
import { resolvePreset, PRESETS } from './core/Quality.js';
import { createInteriorEnvironment, bakeRoomEnvironment } from './core/Environment.js';
import { RoomRegistry } from './core/RoomRegistry.js';
import { PostFX } from './post/PostFX.js';
import { TextureForge } from './materials/TextureForge.js';
import { MaterialLibrary } from './materials/index.js';
import { FXManager } from './fx/index.js';
import * as geometry from './geometry/index.js';
import { Navigator } from './nav/Navigator.js';
import { Hotspots } from './nav/Hotspots.js';
import { Input } from './nav/Input.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { UI } from './ui/UI.js';
import { CURSORS } from './ui/cursors/cursors.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { START_ROOM, START_NODE, FALLBACK_ROOM, FLOORS, DEFAULT_SEED } from './config.js';

/**
 * The engine: owns renderer, post stack, navigation, input, UI, audio, saves and
 * the room lifecycle. See src/engine/ROOM_API.md for the contract with rooms.
 */
export class Game {
  constructor(container, params = new URLSearchParams(location.search)) {
    this.container = container;
    this.params = params;
    this.shot = params.get('shot') === '1';
    this.settings = new Settings();
    this.saves = new SaveSystem();
    this.state = new GameState();
    this.rooms = new RoomRegistry();
    this.time = { value: 0 };     // shared shader time uniform
    this.clockT = 0;
    this.started = false;
    this.room = null;             // { id, mod, res, group, ctx }
    this.puzzle = null;
    this.mode = 'boot';           // boot | title | explore | puzzle | cinematic | loading
    this.revealHeld = false;
    this.revealToggle = false;
    this._flashUntil = 0;
    this.focusIndex = -1;
    this.hovered = null;
    this._frameMs = 16;
    this._lastPanelClose = 0;
  }

  // =================================================================== boot
  async init() {
    const root = document.createElement('div');
    root.className = 't7-root';
    this.container.replaceChildren(root);
    this.root = root;

    // renderer
    const canvas = document.createElement('canvas');
    canvas.className = 't7-canvas';
    canvas.tabIndex = 0;
    root.append(canvas);
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, stencil: false, depth: true,
      powerPreference: 'high-performance', preserveDrawingBuffer: this.shot,
    });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping; // tonemapping happens in PostFX grade pass
    r.shadowMap.enabled = true;
    r.shadowMap.type = { vsm: THREE.VSMShadowMap, basic: THREE.BasicShadowMap, pcf: THREE.PCFShadowMap }[this.params.get('shadowtype')] ?? THREE.PCFShadowMap;
    r.setClearColor(0x000000, 1);

    const qName = this.params.get('quality') || (this.shot ? 'shot' : this.settings.get('quality'));
    this.preset = qName === 'shot' ? { ...PRESETS.shot } : resolvePreset(qName, r);
    this._applyPixelRatio();
    r.shadowMap.enabled = this.preset.shadows && this.params.get('shadows') !== '0';

    RectAreaLightUniformsLib.init();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(this.settings.get('fov'), 1, 0.03, 80);
    this.scene.add(this.camera);

    this.post = new PostFX(r, this.preset);
    this.post.brightness = this.settings.get('brightness');
    // debug: ?post=ao,bloom,rays disables those passes; ?hide=FogVolume,DustMotes hides objects by name
    this.post.disabled = Object.fromEntries((this.params.get('nopost') || '').split(',').filter(Boolean).map((k) => [k, true]));
    this.post.grainEnabled = this.settings.get('filmGrain');

    this.forge = new TextureForge(r, { defaultSize: this.preset.textureSize, anisotropy: this.preset.anisotropy });
    this.materials = new MaterialLibrary(this.forge, { quality: this.preset });
    this.envDefault = createInteriorEnvironment(r, { size: 128 });
    this.scene.environment = this.envDefault.texture;
    this.scene.environmentIntensity = 0.6;

    this.random = new Random(Number(this.params.get('seed')) || DEFAULT_SEED);
    this.fx = new FXManager({ timeUniform: this.time, materials: this.materials, quality: this.preset, random: this.random, renderer: r });
    this.nav = new Navigator(this.camera, this.settings);
    this.hotspots = new Hotspots(this.camera);
    this.audio = new AudioEngine(this.settings, { enabled: !this.shot && this.params.get('mute') !== '1' });
    this.ui = new UI(root, this);
    this.audio.subtitleHook = (line, sec) => this.ui.subtitle(line, sec);
    this.input = new Input(canvas);

    this._bindSettings();
    this._bindInput();
    this._bindNav();
    this._resize();
    window.addEventListener('resize', () => this._resize());

    window.__game = this; // debugging & harness access
    if (this.shot) return this._runShot();

    this.ui.veil(true, 'Opening the mansion');
    await this.rooms.loadAllMeta();
    this._loop();
    const roomParam = this.params.get('room');
    if (roomParam) {
      // dev deep-link: ?room=foyer&node=n1 skips the title screen
      this.started = true;
      await this.audio.start().catch(() => {});
      await this.loadRoom(roomParam, this.params.get('node'), { silentTitle: false });
      this.ui.veil(false);
      return;
    }
    await this.showTitle();
  }

  _applyPixelRatio() {
    const p = this.preset;
    const pr = Math.min(window.devicePixelRatio || 1, p.maxPixelRatio) * (p.pixelRatio / Math.max(p.pixelRatio, 1));
    this.renderer.setPixelRatio(this.shot ? 1 : Math.max(0.5, pr));
  }

  _resize() {
    const w = this.root.clientWidth || window.innerWidth;
    const h = this.root.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h);
    this.width = w; this.height = h;
  }

  _bindSettings() {
    const s = this.settings;
    s.on('change', (k, v) => {
      if (k === 'brightness') this.post.brightness = v;
      if (k === 'filmGrain') this.post.grainEnabled = v;
      if (k === 'fov') { this.nav.baseFov = v; if (!this.nav.moving) this.nav.baseFovCur = this.nav.fovFor(this.nav.node(this.nav.current)); }
      if (k === 'subtitleSize') document.documentElement.style.setProperty('--sub-scale', v);
      if (k === 'quality' && !this.shot) this.setQuality(v);
      if (k === 'showFps' && !v) this.ui.setFps('');
    });
    document.documentElement.style.setProperty('--sub-scale', s.get('subtitleSize'));
  }

  setQuality(name) {
    this.preset = resolvePreset(name, this.renderer);
    this._applyPixelRatio();
    this.renderer.shadowMap.enabled = this.preset.shadows;
    this.post.setPreset(this.preset);
    this.fx.quality = this.preset;
    this.materials.quality = this.preset;
    this._resize();
    this.ui.toast(`Quality: ${this.preset.name}`);
  }

  // =================================================================== input
  _bindInput() {
    const inp = this.input;
    inp.on('pointer', (x, y, n) => {
      this.ui.moveCursor(x, y);
      this.ui.showBar(y < 80);
      this._hover(n);
    });
    inp.on('leave', () => this.ui.showCursor(false));
    inp.on('pointerdevice', (k) => { this.ui.showCursor(k === 'mouse' || k === 'pad'); });
    inp.on('click', (x, y, n) => {
      this.ui.showCursor(true);
      if (this.ui.panelOpen || performance.now() - this._lastPanelClose < 150) return;
      if (this.mode === 'explore') {
        if (this.nav.moving) { this.nav.skip(); return; }
        const h = this.hotspots.pick(new THREE.Vector2(n.x, n.y), this.nav.current);
        if (h) this.activate(h);
      } else if (this.mode === 'cinematic') this._skipCinematic?.();
    });
    inp.on('drag', (dx, dy) => {
      if (this.mode !== 'explore' || this.ui.panelOpen) return;
      const s = 0.0032 * this.settings.get('lookSensitivity');
      const ix = this.settings.get('invertX') ? -1 : 1, iy = this.settings.get('invertY') ? -1 : 1;
      this.nav.look(dx * s * ix, dy * s * iy);
      this.ui.setCursor('grab');
    });
    inp.on('dragend', () => this.ui.setCursor('default'));
    inp.on('wheel', (d) => { if (this.mode === 'explore' && !this.ui.panelOpen) this.nav.setZoom(this.nav.zoomTarget - d * 0.08); });
    inp.on('raw', (type, e, n) => {
      if (type === 'move') this.ui.moveCursor(e.clientX, e.clientY);
      if (this.mode === 'puzzle' && this.puzzle && !this.ui.panelOpen) this._puzzlePointer(type, e, n);
    });
    inp.on('rawkey', (type, e) => { if (this.mode === 'puzzle' && this.puzzle?.def.onKey && !this.ui.panelOpen) this.puzzle.def.onKey(type, e, this.puzzle.pctx); });
    inp.on('action', (a, down) => this._action(a, down));
    inp.on('pad', (st) => this._pad(st));
  }

  _action(a, down) {
    if (a === 'reveal') {
      const mode = this.settings.get('hotspotHints');
      if (mode === 'hold') this.revealHeld = down;
      else if (mode === 'toggle' && down) this.revealToggle = !this.revealToggle;
      return;
    }
    if (!down) return;
    if (a === 'menu') {
      if (this.ui.panelOpen) { if (this.ui.openPanel.closable) this.ui.closePanel(); return; }
      if (this.mode === 'puzzle') { this.leavePuzzle(); return; }
      if (this.mode === 'cinematic') { this._skipCinematic?.(); return; }
      if (this.started && this.mode !== 'title') this.openPause();
      return;
    }
    if (this.ui.panelOpen || !this.started) return;
    switch (a) {
      case 'map': this.openMap(); break;
      case 'hints': this.openHints(); break;
      case 'skip':
        if (this.mode === 'cinematic') this._skipCinematic?.();
        else if (this.nav.moving) this.nav.skip();
        else this._skipLine?.();
        break;
      case 'back': if (this.mode === 'explore' && !this.nav.moving) this.nav.back(); else if (this.mode === 'puzzle') this.leavePuzzle(); break;
      case 'cycleNext': case 'cyclePrev': this._cycle(a === 'cycleNext' ? 1 : -1); break;
      case 'activate': {
        const list = this._screenHotspots();
        const f = list[this.focusIndex];
        if (f && this.mode === 'explore') this.activate(f.h);
        break;
      }
      case 'quicksave': if (this.mode === 'explore') { this.saveTo('auto'); this.ui.toast('Quick-saved.'); } break;
      case 'quickload': this.loadFrom('auto'); break;
      case 'resetLook': this.nav.resetLook(); break;
      default: break;
    }
  }

  _pad(st) {
    if (!this.started) return;
    // left stick moves a virtual cursor, right stick looks
    if (st.lx || st.ly) {
      const sp = 900 * (this._dt || 0.016);
      const x = THREE.MathUtils.clamp(this.ui.cursorX + st.lx * sp, 0, this.width);
      const y = THREE.MathUtils.clamp(this.ui.cursorY + st.ly * sp, 0, this.height);
      this.ui.moveCursor(x, y);
      this._hover({ x: (x / this.width) * 2 - 1, y: -(y / this.height) * 2 + 1 });
    }
    if ((st.rx || st.ry) && this.mode === 'explore') {
      const s = 2.2 * (this._dt || 0.016) * this.settings.get('lookSensitivity');
      this.nav.look(-st.rx * s * (this.settings.get('invertX') ? -1 : 1), -st.ry * s * (this.settings.get('invertY') ? -1 : 1));
    }
  }

  _screenHotspots() {
    if (this.mode !== 'explore') return [];
    return this.hotspots.screenList(this.nav.current, this.width, this.height).sort((a, b) => a.x - b.x);
  }

  _cycle(dir) {
    const list = this._screenHotspots();
    if (!list.length) return;
    this.focusIndex = (this.focusIndex + dir + list.length) % list.length;
    const f = list[this.focusIndex];
    this.ui.moveCursor(f.x, f.y);
    this._hover(f.ndc);
    this._flashUntil = Math.max(this._flashUntil, this.clockT + 1.2);
  }

  flashHotspots(sec = 2.5) { this._flashUntil = this.clockT + sec; }

  _hover(n) {
    if (this.mode === 'puzzle' || this.ui.panelOpen) return;
    if (this.mode !== 'explore' || this.nav.moving) { this.ui.setCursor(this.nav.moving ? 'wait' : 'default'); this.ui.setCursorLabel(''); return; }
    const h = this.hotspots.pick(new THREE.Vector2(n.x, n.y), this.nav.current);
    if (h !== this.hovered) {
      this.hovered = h;
      if (h) this.audio.sfx('hover');
    }
    this.ui.setCursor(h ? h.cursor : 'default');
    this.ui.setCursorLabel(h?.label || '');
  }

  // =================================================================== nav
  _bindNav() {
    this.nav.on('depart', (from, to, info) => {
      this.ui.setCursor('wait'); this.ui.setCursorLabel('');
      if (info.mode === 'glide') this.audio.sfx('whoosh', { duration: info.duration, level: 0.6 });
      this.room?.res?.onDepart?.(from, to);
    });
    this.nav.on('cut', (tr) => {
      // reduced-motion dissolve: capture the last frame and cross-dissolve
      this.post.capture();
      this._animate((k) => { this.post.dissolve = 1 - k; }, tr.dur);
    });
    this.nav.on('arrive', (id, prev) => {
      if (!this.room) return;
      this.state.markVisited(this.room.id, id);
      const n = this.nav.node(id);
      if (n?.grade) this.post.set(n.grade, 0.8);
      if (n?.dof !== undefined) this.post.set({ dof: n.dof }, 0);
      this.ui.setCursor('default');
      this.room.res.onArrive?.(id, prev);
      this._refreshAutoHotspots();
      // refresh hover under the static cursor
      this._hover({ x: (this.ui.cursorX / this.width) * 2 - 1, y: -(this.ui.cursorY / this.height) * 2 + 1 });
    });
  }

  _refreshAutoHotspots() {
    const auto = [];
    const cur = this.nav.current;
    if (!cur) return;
    const A = this.nav.node(cur);
    for (const nb of this.nav.neighbors(cur)) {
      if (nb.edge.hidden) continue;
      const B = this.nav.node(nb.to);
      let sphere, box = null;
      const hs = nb.edge.hotspot;
      const hsFor = hs && (hs[nb.to] || (hs.position || hs.box || hs.bbox ? hs : null));
      if (hsFor?.box || hsFor?.bbox) {
        const b = hsFor.box || hsFor.bbox;
        box = b.isBox3 ? b : new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max));
      } else if (hsFor?.position) {
        sphere = new THREE.Sphere(new THREE.Vector3(...[].concat(hsFor.position.isVector3 ? hsFor.position.toArray() : hsFor.position)), hsFor.radius ?? 0.5);
      } else {
        const d = A.position.distanceTo(B.position);
        if (d > 0.5) {
          const c = B.position.clone(); c.y -= 0.25;
          sphere = new THREE.Sphere(c, THREE.MathUtils.clamp(d * 0.22, 0.35, 0.9));
        } else {
          const dir = new THREE.Vector3().subVectors(B.target, B.position).normalize();
          sphere = new THREE.Sphere(A.position.clone().addScaledVector(dir, 2.2), 0.65);
        }
      }
      auto.push({
        id: `move:${cur}->${nb.to}`, kind: 'move', cursor: 'move', label: B.label || '', priority: -0.5,
        nodes: null, sphere, box, enabled: () => true, onActivate: () => this.nav.goTo(nb.to, { viaEdge: nb.edge }),
      });
    }
    for (const ex of this.nav.exits) {
      if (ex.node !== cur) continue;
      const hs = ex.hotspot || {};
      let sphere = null, box = null;
      const b = hs.box || hs.bbox;
      if (b) box = b.isBox3 ? b : new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max));
      else if (hs.position) sphere = new THREE.Sphere(new THREE.Vector3(...[].concat(hs.position.isVector3 ? hs.position.toArray() : hs.position)), hs.radius ?? 0.6);
      else sphere = new THREE.Sphere(A.position.clone().addScaledVector(this.nav.nodeDirection(cur), 2.4), 0.7);
      auto.push({
        id: `exit:${cur}->${ex.toRoom}`, kind: 'exit', cursor: ex.cursor || 'move', label: ex.label || '', priority: 0.2,
        nodes: null, sphere, box, enabled: () => (ex.enabled ? ex.enabled(this.state) : true),
        onActivate: () => this.goToRoom(ex.toRoom, ex.toNode, { via: sphere?.center || box?.getCenter(new THREE.Vector3()) }),
      });
    }
    this.hotspots.setAuto(auto);
  }

  async activate(h) {
    if (this._activating) return;
    this.audio.sfx('click');
    this.focusIndex = -1;
    this._activating = true;
    try {
      if (h.puzzle) await this.startPuzzle(h.puzzle);
      else await h.onActivate?.(this.room?.ctx, h);
    } catch (e) { console.error('[hotspot]', h.id, e); }
    finally { this._activating = false; }
  }

  // =================================================================== title/new/continue
  async showTitle() {
    this.mode = 'title';
    this.started = false;
    // the title screen renders the sandbox/start room behind it as a living backdrop
    const backdrop = this.rooms.has(START_ROOM) ? START_ROOM : this.rooms.has(FALLBACK_ROOM) ? FALLBACK_ROOM : this.rooms.ids()[0];
    if (backdrop && this.room?.id !== backdrop) await this.loadRoom(backdrop, null, { silentTitle: true, noSave: true, noVisit: true });
    this.mode = 'title';
    this.ui.veil(false);
    this.ui.showTitle({ canContinue: !!this.saves.latest() });
  }

  async newGame() {
    await this.audio.start().catch(() => {});
    this.audio.sfx('stinger');
    this.ui.hideTitle();
    this.state.reset();
    this.started = true;
    const start = this.rooms.has(START_ROOM) ? START_ROOM : this.rooms.has(FALLBACK_ROOM) ? FALLBACK_ROOM : this.rooms.ids()[0];
    await this.loadRoom(start, START_NODE, {});
  }

  async continueGame() {
    const latest = this.saves.latest();
    if (!latest) return this.newGame();
    await this.audio.start().catch(() => {});
    this.ui.hideTitle();
    await this._loadSave(latest);
  }

  async quitToTitle() {
    this.ui.closePanel();
    if (this.puzzle) await this.leavePuzzle(true);
    this.saveTo('auto');
    this.audio.stopMusic(2);
    await this.showTitle();
  }

  // =================================================================== saves
  _thumb() {
    try {
      this.renderer.domElement.toDataURL; // ensure exists
      const c = document.createElement('canvas'); c.width = 224; c.height = 140;
      const g = c.getContext('2d');
      this.post.render(this.scene, this.camera, 0);
      g.drawImage(this.renderer.domElement, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.72);
    } catch { return null; }
  }
  saveTo(slot) {
    if (!this.room || !this.started) return;
    this.saves.write(slot, {
      room: this.room.id, node: this.nav.current, roomTitle: this.room.mod.title || this.room.id,
      playTime: this.state.playTime, state: this.state.serialize(), thumb: this._thumb(),
    });
  }
  async loadFrom(slot) {
    const d = this.saves.read(slot);
    if (!d) { this.ui.toast('That page of the ledger is blank.'); return; }
    await this._loadSave(d);
  }
  async _loadSave(d) {
    if (this.puzzle) await this.leavePuzzle(true);
    this.ui.closePanel();
    this.state.load(d.state);
    this.started = true;
    await this.loadRoom(d.room, d.node, { noSave: true });
    this.ui.toast('The house remembers you.');
  }

  // =================================================================== rooms
  _makeCtx(id, mod) {
    const game = this;
    const ctx = {
      THREE,
      game,
      id,
      roomId: id,
      renderer: this.renderer,
      camera: this.camera,
      scene: this.scene,
      quality: this.preset,
      materials: this.materials,
      textures: this.forge,
      forge: this.forge,
      fx: this.fx,
      geometry,
      audio: this.audio,
      ui: this.ui,
      state: this.state,
      settings: this.settings,
      random: new (this.random.constructor)(`${id}:${DEFAULT_SEED}`),
      time: this.time,
      post: this.post,
      params: this.params,
      shot: this.shot,
      nav: {
        goTo: (n, o) => this.nav.goTo(n, o),
        jumpTo: (n) => this.nav.jumpTo(n),
        flyTo: (pose, d) => this.nav.flyTo(pose, d),
        returnToNode: (d) => this.nav.returnToNode(d),
        lookAt: (target, d = 1) => this.nav.flyTo({ position: this.camera.position.clone(), target, fov: this.camera.fov }, d),
        get current() { return game.nav.current; },
        get moving() { return game.nav.moving; },
        lock: () => { game.nav.locked++; }, unlock: () => { game.nav.locked = Math.max(0, game.nav.locked - 1); },
      },
      hotspots: { add: (h) => this.hotspots.add(h), remove: (id2) => this.hotspots.remove(id2), refresh: () => this._refreshAutoHotspots() },
      puzzles: { start: (p) => this.startPuzzle(p), isSolved: (pid) => this.state.isSolved(pid) },
      say: (line) => this.say(line),
      cinematic: (fn, o) => this.cinematic(fn, o),
      addGodRay: (src) => { this.post.godRaySources.push(src); return src; },
      bakeEnvironment: (position, opts) => this.bakeEnvironment(position, opts),
      assetUrl: (p) => `${import.meta.env.BASE_URL}assets/${id}/${p}`,
      loadTexture: (url, { srgb = true, repeat } = {}) => {
        const t = new THREE.TextureLoader().load(url);
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = this.forge.anisotropy;
        if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
        return t;
      },
      goToRoom: (room, node) => this.goToRoom(room, node),
      onUpdate: (fn) => this.fx.onUpdate(fn),
    };
    return ctx;
  }

  async loadRoom(id, nodeId, opts = {}) {
    if (!this.rooms.has(id)) {
      console.warn(`[game] room "${id}" not found`);
      if (id !== FALLBACK_ROOM && this.rooms.has(FALLBACK_ROOM)) return this.loadRoom(FALLBACK_ROOM, null, opts);
      return;
    }
    const prevMode = this.mode;
    this.mode = 'loading';
    this.input.enabled = false;
    this.ui.showCursor(false);
    if (this.room && !this.shot) { this.ui.veil(true, ''); await wait(0.55); }
    this._unloadRoom();
    const mod = await this.rooms.load(id);
    if (!this.shot && opts.silentTitle !== true) this.ui.veil(true, mod.title || '');
    await nextFrame();
    const ctx = this._makeCtx(id, mod);
    const t0 = performance.now();
    let res;
    try {
      res = await mod.build(ctx);
    } catch (e) {
      console.error(`[game] room ${id} failed to build`, e);
      this.input.enabled = true;
      this.mode = prevMode;
      if (this.shot) throw e;
      this.ui.toast(`The way is barred (${id} failed to load).`);
      if (id !== FALLBACK_ROOM && this.rooms.has(FALLBACK_ROOM)) return this.loadRoom(FALLBACK_ROOM, null, opts);
      return;
    }
    const group = res.scene || res.group;
    this.scene.add(group);
    this.room = { id, mod, res, group, ctx, buildMs: performance.now() - t0 };
    this.nav.setGraph(res.nodes, res.edges || [], res.exits || []);
    this.hotspots.setRoom(res.hotspots || []);
    // look
    this.post.reset();
    if (res.grade) this.post.set(res.grade);
    for (const g of res.godRays || []) this.post.godRaySources.push(g);
    // lighting environment
    if (res.environment?.intensity !== undefined) this.scene.environmentIntensity = res.environment.intensity;
    else this.scene.environmentIntensity = 0.6;
    if (res.environment?.bake !== false && this.preset.envBake && res.environment?.position && this.params.get('envbake') !== '0') {
      this.bakeEnvironment(res.environment.position, res.environment);
    } else {
      this.scene.environment = this.envDefault.texture;
    }
    const start = nodeId && res.nodes[nodeId] ? nodeId : res.start || mod.start || Object.keys(res.nodes)[0];
    this.nav.jumpTo(start);
    this.camera.updateMatrixWorld();
    try { await this.renderer.compileAsync(this.scene, this.camera); } catch { this.renderer.compile(this.scene, this.camera); }

    if (!opts.noVisit) this.state.markVisited(id, start);
    if (!this.shot) {
      this.audio.setAmbience(res.ambience || mod.ambience || { wind: 0.5, creaks: 0.4, roomTone: 0.3 });
      if (this.started && (res.music ?? mod.music ?? true)) this.audio.startMusic(typeof (res.music ?? mod.music) === 'object' ? (res.music ?? mod.music) : {});
    }
    this.input.enabled = true;
    this.mode = prevMode === 'title' && !this.started ? 'title' : 'explore';
    if (this.started && !opts.noSave) this.saveTo('auto');
    this._refreshAutoHotspots();
    if (!this.shot) {
      this.ui.veil(false);
      this.ui.showCursor(true);
      if (this.started && !opts.silentTitle) this.ui.titleCard(mod.floorName || 'Stauf Manor', mod.title || id);
      res.onEnter?.(ctx);
    }
    return this.room;
  }

  _unloadRoom() {
    const room = this.room;
    if (!room) return;
    try { room.res.dispose?.(); } catch (e) { console.warn('[game] dispose failed', e); }
    this.scene.remove(room.group);
    room.group.traverse((o) => {
      if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
      const mats = o.material ? [].concat(o.material) : [];
      for (const m of mats) if (!m.userData?.shared) m.dispose?.();
    });
    this.fx.clear();
    this.hotspots.clear();
    this.post.godRaySources = [];
    if (this.roomEnv) { this.roomEnv.dispose(); this.roomEnv = null; }
    this.scene.environment = this.envDefault.texture;
    this.room = null;
  }

  bakeEnvironment(position, { size, intensity } = {}) {
    if (!this.room) return;
    const p = position?.isVector3 ? position : new THREE.Vector3(...position);
    // make sure flames & lights have their final state for the bake
    this.fx.update(0, this.clockT);
    this.room.res.update?.(0, this.clockT);
    const rt = bakeRoomEnvironment(this.renderer, this.scene, p, { size: size || this.preset.envBakeSize });
    if (this.roomEnv) this.roomEnv.dispose();
    this.roomEnv = rt;
    this.scene.environment = rt.texture;
    if (intensity !== undefined) this.scene.environmentIntensity = intensity;
  }

  async goToRoom(roomId, nodeId, { via } = {}) {
    if (!this.rooms.has(roomId)) {
      this.ui.caption('The door will not yield. Not yet.', { title: 'Locked' });
      this.audio.sfx('fail');
      return;
    }
    this.audio.sfx('door');
    if (via && !this.settings.get('reduceMotion')) {
      const pos = this.camera.position.clone().lerp(via, 0.55);
      pos.y = this.camera.position.y;
      await this.nav.flyTo({ position: pos, target: via, fov: this.camera.fov }, 0.9);
    }
    await this.loadRoom(roomId, nodeId, {});
  }

  async fastTravel(roomId) {
    if (this.puzzle) await this.leavePuzzle(true);
    await this.loadRoom(roomId, null, {});
  }

  // =================================================================== puzzles
  async startPuzzle(def) {
    if (this.puzzle) return;
    const ctx = this.room.ctx;
    this.mode = 'puzzle';
    this.hovered = null;
    this.ui.setCursorLabel('');
    this.ui.setCursor('default');
    const meta = this.puzzleMeta(def.id) || {};
    const p = { def: { ...meta, ...def }, solved: false };
    this.puzzle = p;
    const pctx = {
      ...ctx,
      puzzle: p.def,
      raycast: (objects, ndc) => {
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.camera);
        return rc.intersectObjects([].concat(objects), true);
      },
      setCursor: (t) => this.ui.setCursor(t),
      status: (txt) => this.ui.setPuzzleStatus(txt),
      solve: () => this._solvePuzzle(),
      fail: (msg) => { this.audio.sfx('fail'); if (msg) this.ui.setPuzzleStatus(msg); },
      leave: () => this.leavePuzzle(),
      say: (line) => this.say(line),
    };
    p.pctx = pctx;
    if (p.def.camera) await this.nav.flyTo(p.def.camera, p.def.cameraDuration ?? 1.3);
    this.ui.showPuzzle({
      title: p.def.title || 'A Puzzle', description: p.def.description, canReset: !!p.def.reset,
      onHint: () => this.openHints(p.def.id), onReset: () => p.def.reset?.(pctx), onLeave: () => this.leavePuzzle(),
    });
    await p.def.setup?.(pctx);
    if (p.def.update) p._off = this.fx.onUpdate((dt, t) => p.def.update(dt, t, pctx));
  }

  _puzzlePointer(type, e, n) {
    const p = this.puzzle;
    if (!p || p.solved) return;
    p.def.onPointer?.(type, e, n, p.pctx);
    if (type === 'move' && p.def.cursorAt) this.ui.setCursor(p.def.cursorAt(n, p.pctx) || 'default');
  }

  async _solvePuzzle() {
    const p = this.puzzle;
    if (!p || p.solved) return;
    p.solved = true;
    this.state.markSolved(p.def.id);
    this.audio.sfx('solved');
    this.ui.setPuzzleStatus('');
    this.ui.toast(`${p.def.title || 'Puzzle'} — solved`);
    await p.def.onSolved?.(p.pctx);
    await wait(p.def.solvedDelay ?? 1.4);
    await this.leavePuzzle();
    this.saveTo('auto');
  }

  async leavePuzzle(immediate = false) {
    const p = this.puzzle;
    if (!p) return;
    this.puzzle = null;
    p._off?.();
    try { await p.def.teardown?.(p.pctx); } catch (e) { console.warn(e); }
    this.ui.hidePuzzle();
    if (!immediate && p.def.camera) await this.nav.returnToNode(1.0);
    else if (p.def.camera) this.nav.jumpTo(this.nav.current);
    this.mode = 'explore';
    this._refreshAutoHotspots();
  }

  puzzleMeta(id) {
    for (const mod of Object.values(this.rooms.meta)) {
      const m = (mod.puzzles || []).find((p) => p.id === id);
      if (m) return { ...m, roomTitle: mod.title, roomId: mod.id };
    }
    return null;
  }

  hintBookData() {
    const list = [];
    const visited = new Set(this.state.visitedRooms);
    if (this.room) visited.add(this.room.id);
    for (const mod of Object.values(this.rooms.meta)) {
      if (!visited.has(mod.id)) continue;
      for (const p of mod.puzzles || []) {
        list.push({
          id: p.id, title: p.title, room: mod.title, description: p.description, hints: p.hints || [],
          used: this.state.hintsFor(p.id), solved: this.state.isSolved(p.id),
          current: this.puzzle?.def.id === p.id, canAutoSolve: !!(p.autoSolve !== false),
        });
      }
    }
    return list;
  }

  // =================================================================== panels
  onPanel(open) {
    if (!open) this._lastPanelClose = performance.now();
    this.ui.showCursor(true);
    if (open) { this.ui.setCursor('default'); this.ui.setCursorLabel(''); }
    this.root.classList.toggle('system-cursor', open);
  }
  openPause() { if (this.started) { this.audio.sfx('page'); this.ui.showPause(); } }
  openMap() {
    if (!this.started) return;
    const floors = FLOORS.map((f) => ({ ...f, rooms: [] }));
    for (const mod of Object.values(this.rooms.meta)) {
      if (!mod.map || mod.id.startsWith('_')) continue;
      const fl = floors.find((f) => f.id === mod.map.floor) || floors[0];
      fl.rooms.push({
        id: mod.id, title: mod.title || mod.id, rect: mod.map.rect,
        visited: this.state.visitedRooms.includes(mod.id), current: this.room?.id === mod.id,
        solved: (mod.puzzles || []).length > 0 && (mod.puzzles || []).every((p) => this.state.isSolved(p.id)),
        known: !!mod.map.known,
      });
    }
    const used = floors.filter((f) => f.rooms.length);
    const cur = this.room?.mod.map?.floor;
    this.audio.sfx('page');
    this.ui.showMap({ floors: used.length ? used : floors.slice(0, 1), floor: cur });
  }
  openHints(selected) {
    if (!this.started) return;
    this.audio.sfx('page');
    this.ui.showHintBook({
      puzzles: this.hintBookData(), selected: selected || this.puzzle?.def.id,
      onReveal: (id) => this.state.useHint(id),
      onSolve: (id) => {
        const p = this.puzzle;
        if (p && p.def.id === id) {
          if (p.def.autoSolve) p.def.autoSolve(p.pctx); else this._solvePuzzle();
        } else {
          this.state.markSolved(id);
          this.ui.toast('The Book has spoken. The riddle is answered.');
        }
      },
    });
  }

  // =================================================================== speech & cinematics
  async say(line) {
    const L = typeof line === 'string' ? { text: line, speaker: 'stauf', speakerName: 'Stauf' } : { speaker: 'stauf', speakerName: 'Stauf', ...line };
    if (L.speaker === 'stauf') this.audio.duck(0.45, 3);
    let skip;
    const skipP = new Promise((r) => { skip = r; });
    this._skipLine = () => { skip(); this.ui.subtitle('', 0.01); };
    await Promise.race([this.audio.say(L), skipP]);
    this._skipLine = null;
  }

  /** Run a skippable cinematic (letterboxed, input locked). fn(ctx, { wait, skipped }) */
  async cinematic(fn, { letterbox = true } = {}) {
    const prev = this.mode;
    this.mode = 'cinematic';
    this.ui.showCursor(false);
    if (letterbox) this.ui.letterbox(true);
    let skipped = false;
    let skipRes;
    const skipP = new Promise((r) => { skipRes = r; });
    this._skipCinematic = () => { skipped = true; skipRes(); };
    const helpers = {
      wait: (s) => Promise.race([wait(s), skipP]),
      get skipped() { return skipped; },
    };
    try { await Promise.race([fn(this.room.ctx, helpers), skipP]); }
    catch (e) { console.error('[cinematic]', e); }
    this._skipCinematic = null;
    if (letterbox) this.ui.letterbox(false);
    this.ui.showCursor(true);
    this.mode = prev === 'cinematic' ? 'explore' : prev;
    return !skipped;
  }

  _animate(fn, dur) {
    const start = this.clockT;
    const off = this.fx.onUpdate(() => {
      const k = Math.min(1, (this.clockT - start) / dur);
      fn(k);
      if (k >= 1) off();
    });
  }

  // =================================================================== loop
  _loop() {
    let last = performance.now();
    const tick = (now) => {
      requestAnimationFrame(tick);
      const dtRaw = (now - last) / 1000;
      last = now;
      const dt = Math.min(0.1, Math.max(0, dtRaw));
      this._dt = dt;
      this.frame(dt);
      this._perf(dtRaw);
    };
    requestAnimationFrame(tick);
  }

  frame(dt) {
    this.clockT += dt;
    this.time.value = this.clockT;
    this.post.time = this.clockT;
    if (this.started && this.mode !== 'title') this.state.playTime += dt;
    this.input.pollPad?.();
    // keyboard look
    if (this.mode === 'explore' && !this.ui.panelOpen) {
      const a = this.input.lookAxes();
      if (a.x || a.y) this.nav.look(-a.x * dt * 1.4 * (this.settings.get('invertX') ? -1 : 1), a.y * dt * 1.1 * (this.settings.get('invertY') ? -1 : 1));
    }
    if (this.mode === 'title') this._titleDrift(dt);
    else this.nav.update(dt, this.clockT);
    this.fx.update(dt, this.clockT);
    this.room?.res.update?.(dt, this.clockT);
    // hotspot reveal markers
    const reveal = this.revealHeld || this.revealToggle || this.clockT < this._flashUntil;
    if (this.mode === 'explore' && !this.nav.moving && (reveal || this.ui.markers.childElementCount)) {
      const list = this._screenHotspots();
      const f = list[this.focusIndex];
      this.ui.renderMarkers(list, reveal, f?.h.id);
    } else if (this.ui.markers.childElementCount) this.ui.renderMarkers([], false);
    this.post.render(this.scene, this.camera, dt);
  }

  _titleDrift(dt) {
    // slow cinematic drift around the start node behind the title screen
    if (!this.nav.current) return;
    this._titleT = (this._titleT || 0) + dt;
    const t = this._titleT;
    this.nav.yawTarget = Math.sin(t * 0.07) * 0.22;
    this.nav.pitchTarget = Math.sin(t * 0.05) * 0.04;
    this.nav.update(dt, this.clockT);
  }

  _perf(dtRaw) {
    const ms = dtRaw * 1000;
    this._frameMs = this._frameMs * 0.95 + ms * 0.05;
    if (this.settings.get('showFps')) {
      const i = this.post.sceneInfo || this.renderer.info.render;
      this.ui.setFps(`${(1000 / this._frameMs).toFixed(0)} fps  ${this._frameMs.toFixed(1)} ms\n${this.preset.name} x${this.post.resolutionScale.toFixed(2)}\n${i.calls} calls ${(i.triangles / 1000).toFixed(0)}k tris`);
    }
    // dynamic resolution
    if (this.preset.dynamicResolution && this.mode !== 'loading') {
      this._drT = (this._drT || 0) + dtRaw;
      if (this._drT > 1.0) {
        this._drT = 0;
        const s = this.post.resolutionScale;
        if (this._frameMs > 22) this.post.setResolutionScale(s - 0.08);
        else if (this._frameMs < 14 && s < 1) this.post.setResolutionScale(s + 0.05);
      }
    }
  }

  // =================================================================== shot mode
  async _runShot() {
    const t0 = performance.now();
    try {
      const roomId = this.params.get('room') || FALLBACK_ROOM;
      const nodeId = this.params.get('node');
      const t = parseFloat(this.params.get('time') ?? '2');
      this.clockT = t; this.time.value = t; this.post.time = t;
      this.ui.veil(false);
      this.ui.showCursor(false);
      if (this.params.get('ui') !== '1') this.ui.el.style.display = 'none';
      this.started = this.params.get('ui') === '1';
      await this.loadRoom(roomId, nodeId, { silentTitle: true, noSave: true });
      const tLoad = performance.now();
      const hide = (this.params.get('hide') || '').split(',').filter(Boolean);
      if (hide.length) this.scene.traverse((o) => { if (hide.includes(o.name) || hide.includes(o.type)) o.visible = false; });
      if (this.params.get('envi')) this.scene.environmentIntensity = Number(this.params.get('envi'));
      // optional camera override for reviewers: &pos=x,y,z&target=x,y,z&fov=50
      const pos = this.params.get('pos'), tgt = this.params.get('target'), fov = this.params.get('fov');
      if (pos && tgt) {
        this.camera.position.set(...pos.split(',').map(Number));
        this.camera.lookAt(new THREE.Vector3(...tgt.split(',').map(Number)));
        this.nav.basePos.copy(this.camera.position); this.nav.baseQuat.copy(this.camera.quaternion);
      }
      if (fov) { this.nav.baseFovCur = Number(fov); this.camera.fov = Number(fov); this.camera.updateProjectionMatrix(); }
      if (this.params.get('hotspots') === '1') { this.revealToggle = true; this.mode = 'explore'; }
      // UI review screens: &ui=1&screen=title|pause|settings|saves|map|hints|puzzle|caption|subtitle|cursors
      const screen = this.params.get('screen');
      if (screen) await this._shotScreen(screen);
      // deterministic frames: same time each frame, dt = 0
      this.settings.values.reduceMotion = true; // no idle drift in shots
      const frames = Number(this.params.get('frames') || 3);
      for (let i = 0; i < frames; i++) {
        this.fx.update(0, t);
        this.room.res.update?.(0, t);
        this.nav._apply(0, t);
        if (this.params.get('hotspots') === '1') {
          const list = this._screenHotspots();
          this.ui.renderMarkers(list, true);
        }
        this.post.render(this.scene, this.camera, 0);
        await nextFrame();
      }
      const gl = this.renderer.getContext();
      gl.finish();
      const tEnd = performance.now();
      window.__SHOT_INFO = {
        room: roomId, node: this.nav.current, buildMs: Math.round(this.room.buildMs), loadMs: Math.round(tLoad - t0),
        renderMs: Math.round(tEnd - tLoad), totalMs: Math.round(tEnd - t0), textures: this.forge.stats,
        calls: this.post.sceneInfo?.calls, triangles: this.post.sceneInfo?.triangles, nodes: Object.keys(this.room.res.nodes),
      };
      window.__SHOT_READY = true;
    } catch (e) {
      console.error(e);
      window.__SHOT_ERROR = String(e?.stack || e);
      window.__SHOT_READY = true;
    }
  }
}

Game.prototype._shotScreen = async function (screen) {
  const ui = this.ui;
  this.started = true;
  this.mode = 'explore';
  ui.el.style.display = '';
  const T = (fn) => { try { fn(); } catch (e) { console.error(e); } };
  switch (screen) {
    case 'title': this.started = false; this.mode = 'title'; T(() => ui.showTitle({ canContinue: true })); break;
    case 'pause': T(() => ui.showPause()); break;
    case 'settings': T(() => ui.showSettings(this.params.get('tab') || 'video')); break;
    case 'saves': T(() => ui.showSaves('load')); break;
    case 'map': T(() => this.openMap()); break;
    case 'hints': this.state.useHint('sandbox.candles'); T(() => this.openHints('sandbox.candles')); break;
    case 'puzzle': {
      const hs = this.hotspots.room.find((h) => h.puzzle);
      if (hs) {
        const pr = this.startPuzzle(hs.puzzle);
        for (let i = 0; i < 5; i++) { this.nav.update(1, this.clockT); await new Promise((r) => setTimeout(r, 0)); }
        await pr;
      }
      break;
    }
    case 'caption': ui.caption('A ruined castle on a crag, a single window lit. Someone painted this from memory — or from inside.', { title: 'The Landscape', duration: 60 }); ui.subtitle({ text: 'Admiring my likeness? It never did capture my *best* side.', speaker: 'stauf', speakerName: 'Stauf' }, 60); ui.titleCard('Stauf Manor', this.room?.mod.title || '', 60); break;
    case 'cursors': {
      const wrap = document.createElement('div');
      Object.assign(wrap.style, { position: 'absolute', inset: '0', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', placeItems: 'center', background: 'rgba(0,0,0,.55)', zIndex: 300 });
      for (const [name, c] of Object.entries(CURSORS)) {
        if (name === 'none') continue;
        const cell = document.createElement('div');
        cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;color:#c9a55a;font:16px Cinzel,serif;letter-spacing:.2em';
        cell.innerHTML = `<div style="width:120px;height:120px;filter:drop-shadow(0 3px 4px #000)">${c.svg}</div><div>${name.toUpperCase()}</div>`;
        wrap.append(cell);
      }
      ui.el.append(wrap);
      break;
    }
    default: break;
  }
  try { await document.fonts.ready; } catch { /* */ }
  await new Promise((r) => setTimeout(r, 900)); // let CSS transitions settle
};

function wait(s) { return new Promise((r) => setTimeout(r, s * 1000)); }
function nextFrame() { return new Promise((r) => requestAnimationFrame(() => r())); }
