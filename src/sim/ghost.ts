/**
 * Ghost projection rules. Pure: nothing here mutates its arguments.
 * Rule code uses no numeric literals other than 0 and 1.
 */

import { beamCells } from './beam';
import { imageScale } from './cart';
import { isFanned } from './smoke';
import type { Ghost, State } from './state';
import type { Tuning } from './tuning';

/** Density needed for a solid ghost at the given image scale: base x scale^2, unrounded. */
export function scaledThreshold(scale: number, tuning: Tuning): number {
  return tuning.solidityThresholdBase * scale * scale;
}

/**
 * First beam cell (ascending distance, row, column) that is not fanned and whose
 * density is at or above the scaled threshold, or null when there is none.
 */
export function placeGhost(state: State, tuning: Tuning): Ghost | null {
  const threshold = scaledThreshold(imageScale(state.cart.travel, tuning), tuning);

  for (const cell of beamCells(state, tuning)) {
    const fanned = isFanned(cell.col, cell.row, state.fans, tuning);
    const solid = cell.density >= threshold && !fanned;
    if (solid) {
      return { col: cell.col, row: cell.row, density: cell.density, solid };
    }
  }
  return null;
}
