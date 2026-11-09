/**
 * Beam geometry. Pure functions: nothing here mutates its arguments.
 * Rule code uses no numeric literals other than 0 and 1.
 */

import type { State } from './state';
import type { Tuning } from './tuning';

export interface Cell {
  col: number;
  row: number;
  /** Distance from the beam origin to the cell centre, in metres. */
  distance: number;
  /** Smoke density of the cell. */
  density: number;
}

const FULL_TURN = Math.PI * (1 + 1);
const HALF = 1 / (1 + 1);

/** Normalise an angle to [0, 2pi). */
export function normaliseAngle(a: number): number {
  const n = ((a % FULL_TURN) + FULL_TURN) % FULL_TURN;
  // Guard against a rounding result equal to FULL_TURN for tiny negative inputs.
  return n >= FULL_TURN ? 0 : n;
}

/** Beam origin in metres: (cartOriginXM, cartTrackStartYM + travel). */
export function beamOrigin(state: State, tuning: Tuning): { x: number; y: number } {
  return { x: tuning.cartOriginXM, y: tuning.cartTrackStartYM + state.cart.travel };
}

/** Absolute angular difference between two angles, wrapped into [0, pi]. */
function angularDifference(a: number, b: number): number {
  const d = normaliseAngle(a - b);
  return d > Math.PI ? FULL_TURN - d : d;
}

/**
 * Cells in the beam cone, ascending by distance, then row, then column.
 * Empty when the origin is outside the room.
 */
export function beamCells(state: State, tuning: Tuning): Cell[] {
  const width = tuning.roomWidthM;
  const depth = tuning.roomDepthM;
  const { x: ox, y: oy } = beamOrigin(state, tuning);

  if (!(ox >= 0 && ox <= width && oy >= 0 && oy <= depth)) return [];

  const originCol = Math.floor(ox);
  const originRow = Math.floor(oy);
  const cells: Cell[] = [];

  for (let row = 0; row < depth; row++) {
    for (let col = 0; col < width; col++) {
      if (col === originCol && row === originRow) continue;

      const dx = col + HALF - ox;
      const dy = row + HALF - oy;
      const distance = Math.hypot(dx, dy);
      if (distance > tuning.placeholderSlideReachM) continue;

      const diff = angularDifference(Math.atan2(dy, dx), state.beam.angle);
      if (diff > tuning.beamHalfAngleRad) continue;

      cells.push({ col, row, distance, density: state.grid[row * width + col] ?? 0 });
    }
  }

  cells.sort((a, b) => a.distance - b.distance || a.row - b.row || a.col - b.col);
  return cells;
}
