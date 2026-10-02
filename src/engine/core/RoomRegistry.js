// Discovers room modules (src/rooms/<id>/index.js) via Vite's import.meta.glob.
// Modules are lazy (one chunk per room); metadata is read on import.

const modules = import.meta.glob('../../rooms/*/index.js');

export class RoomRegistry {
  constructor() {
    this.loaders = {};
    for (const [path, loader] of Object.entries(modules)) {
      const id = path.split('/').slice(-2, -1)[0];
      this.loaders[id] = loader;
    }
    this.meta = {}; // id -> module default export (after import)
  }
  ids() { return Object.keys(this.loaders); }
  has(id) { return !!this.loaders[id]; }
  async load(id) {
    if (this.meta[id]) return this.meta[id];
    if (!this.loaders[id]) throw new Error(`[rooms] no room module "${id}"`);
    const mod = await this.loaders[id]();
    const room = mod.default || mod;
    if (!room.id) room.id = id;
    this.meta[id] = room;
    return room;
  }
  /** Import every room module for its metadata (map, puzzles). Failures are isolated. */
  async loadAllMeta() {
    await Promise.all(this.ids().map((id) => this.load(id).catch((e) => console.warn(`[rooms] ${id} failed to import`, e))));
    return this.meta;
  }
}
