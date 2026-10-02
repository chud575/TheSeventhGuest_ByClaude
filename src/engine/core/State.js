import { Events } from './Events.js';

/**
 * Game state: flags (any JSON value), inventory (ordered list of item ids),
 * visited rooms/nodes, solved puzzles, hint usage. Fully serialisable.
 */
export class GameState extends Events {
  constructor() {
    super();
    this.reset();
  }

  reset() {
    this.flags = {};
    this.inventory = [];
    this.visitedRooms = [];
    this.visitedNodes = {};
    this.solved = [];
    this.hintsUsed = {};
    this.playTime = 0;
    this.location = { room: null, node: null };
    this.emit('reset');
  }

  // ---- flags
  get(key, fallback = undefined) { return key in this.flags ? this.flags[key] : fallback; }
  has(key) { return !!this.flags[key]; }
  set(key, value = true) {
    const prev = this.flags[key];
    this.flags[key] = value;
    if (prev !== value) this.emit('flag', key, value, prev);
    return value;
  }
  toggle(key) { return this.set(key, !this.flags[key]); }
  inc(key, by = 1) { return this.set(key, (this.flags[key] || 0) + by); }

  // ---- inventory
  addItem(id) {
    if (!this.inventory.includes(id)) { this.inventory.push(id); this.emit('inventory', 'add', id); }
  }
  removeItem(id) {
    const i = this.inventory.indexOf(id);
    if (i >= 0) { this.inventory.splice(i, 1); this.emit('inventory', 'remove', id); }
  }
  hasItem(id) { return this.inventory.includes(id); }

  // ---- progress
  markVisited(room, node) {
    if (room && !this.visitedRooms.includes(room)) { this.visitedRooms.push(room); this.emit('visitRoom', room); }
    if (room && node) {
      const list = (this.visitedNodes[room] ||= []);
      if (!list.includes(node)) list.push(node);
    }
    this.location = { room, node };
  }
  isSolved(puzzleId) { return this.solved.includes(puzzleId); }
  markSolved(puzzleId) {
    if (!this.solved.includes(puzzleId)) { this.solved.push(puzzleId); this.emit('solved', puzzleId); }
  }
  useHint(puzzleId) {
    this.hintsUsed[puzzleId] = (this.hintsUsed[puzzleId] || 0) + 1;
    this.emit('hint', puzzleId, this.hintsUsed[puzzleId]);
    return this.hintsUsed[puzzleId];
  }
  hintsFor(puzzleId) { return this.hintsUsed[puzzleId] || 0; }

  serialize() {
    return JSON.parse(JSON.stringify({
      flags: this.flags, inventory: this.inventory, visitedRooms: this.visitedRooms,
      visitedNodes: this.visitedNodes, solved: this.solved, hintsUsed: this.hintsUsed,
      playTime: this.playTime, location: this.location,
    }));
  }
  load(data) {
    this.reset();
    Object.assign(this, JSON.parse(JSON.stringify(data || {})));
    this.emit('loaded');
  }
}
