import fc from 'fast-check';
import { describe, it } from 'vitest';
import { beamCells } from '../../src/sim/beam';
import { imageScale } from '../../src/sim/cart';
import { placeGhost } from '../../src/sim/ghost';
import { TUNING } from '../../src/sim/tuning';
import { gridArb, makeState, seedArb } from './arbitraries';

// Biased towards the default angle so the beam often covers room cells.
const beamAngleArb = fc.oneof(
  { arbitrary: fc.constant(TUNING.beamAngleDefaultRad), weight: 3 },
  {
    arbitrary: fc.double({
      min: TUNING.beamAngleDefaultRad - 0.4,
      max: TUNING.beamAngleDefaultRad + 0.4,
      noNaN: true,
    }),
    weight: 4,
  },
  { arbitrary: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }), weight: 1 },
);

describe('Feature: smoke-and-projection, Property 4: A ghost is solid exactly at the scaled threshold', () => {
  it('placeGhost returns the first beam cell at or above base x scale^2, else null', () => {
    // **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.7**
    fc.assert(
      fc.property(
        seedArb,
        gridArb(),
        fc.double({ min: 0, max: TUNING.cartTravelMaxM, noNaN: true }),
        beamAngleArb,
        (seed, grid, travel, angle) => {
          const state = makeState(seed, grid);
          state.cart = { travel, speedMps: 0 };
          state.beam = { angle };
          state.fans = [];

          const scale = imageScale(travel, TUNING);
          const threshold = TUNING.solidityThresholdBase * scale * scale;
          const cells = beamCells(state, TUNING);
          const idx = cells.findIndex((c) => c.density >= threshold);
          const ghost = placeGhost(state, TUNING);

          if (idx < 0) return ghost === null;
          if (ghost === null) return false;
          const expected = cells[idx]!;
          return (
            ghost.col === expected.col &&
            ghost.row === expected.row &&
            ghost.density === expected.density &&
            ghost.solid === (ghost.density >= threshold) &&
            cells.slice(0, idx).every((c) => c.density < threshold)
          );
        },
      ),
    );
  });
});
