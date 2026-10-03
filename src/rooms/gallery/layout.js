/**
 * Upstairs gallery layout (metres). The hall runs along Z: the stair landing /
 * foyer arch is at the near end (z = Z1), the tall moonlit window at the far end
 * (z = Z0). x = 0 is the hall's centre line; left wall X0 (portraits + puzzle),
 * right wall X1 (bedroom + game-room doors).
 */
export const X0 = -1.6, X1 = 1.6, Z0 = -9.0, Z1 = 8.0, H = 3.6;
export const W = X1 - X0, L = Z1 - Z0;
export const DADO = 0.95;
export const CROWN_H = 0.2, FRIEZE_H = 0.26;
export const RAIL_Y = H - CROWN_H - FRIEZE_H - 0.04;       // picture rail
/** pilaster / beam lines between the five bays (near -> far) */
export const BAYS = [4.6, 1.2, -2.2, -5.6];
export const BAY_CENTERS = [6.3, 2.9, -0.5, -3.9, -7.3];
export const PIL = { w: 0.32, d: 0.09 };
export const BEAM = { w: 0.34, d: 0.3 };

export const DOORS = {
  bedroom: { side: 1, z: 2.9, w: 1.1, h: 2.55 },
  gameroom: { side: 1, z: -3.9, w: 1.1, h: 2.55 },
  attic: { side: -1, z: -7.3, w: 0.86, h: 2.3 },
};
export const ARCH = { w: 1.9, h: 2.95 };                    // near end, to the landing
export const WIN = { w: 1.5, sill: 0.6, h: 2.36, depth: 0.5 };
export const PUZZLE = { z: -0.5, y: 1.72 };
export const LANDING = { depth: 2.6 };
