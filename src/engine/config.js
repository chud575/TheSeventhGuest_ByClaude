// Global game configuration.
export const GAME_TITLE = 'The Seventh Guest';
export const GAME_SUBTITLE = 'Stauf Manor';

// Room the "New Game" button starts in (falls back to the first discovered room).
export const START_ROOM = 'foyer';
export const START_NODE = null; // null = room's `start` node or first node
export const FALLBACK_ROOM = '_sandbox';

// Mansion map layout. Rooms register themselves with `map: { floor, rect: [x,y,w,h] }`
// in their module; this list only names the floors (in display order).
export const FLOORS = [
  { id: 'ground', name: 'Ground Floor' },
  { id: 'upper', name: 'Upper Floor' },
  { id: 'attic', name: 'Attic' },
  { id: 'basement', name: 'Cellars' },
];

export const DEFAULT_SEED = 1993;
