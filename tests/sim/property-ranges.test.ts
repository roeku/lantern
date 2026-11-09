import fc from 'fast-check';
import { describe, it } from 'vitest';
import { step } from '../../src/sim/step';
import { TUNING } from '../../src/sim/tuning';
import { gridArb, inputSequenceArb, makeState, seedArb } from './arbitraries';

describe('smoke-and-projection ranges', () => {
  // Feature: smoke-and-projection, Property 2: Smoke density and cart travel stay in range
  // **Validates: Requirements 2.4, 2.5, 2.7, 3.2, 6.1, 6.4**
  it('Feature: smoke-and-projection, Property 2: Smoke density and cart travel stay in range', () => {
    fc.assert(
      fc.property(seedArb, gridArb(), inputSequenceArb(), (seed, grid, ticks) => {
        let s = makeState(seed, grid);
        for (const inputs of ticks) {
          s = step(s, inputs, TUNING);
          if (s.grid.length !== TUNING.roomWidthM * TUNING.roomDepthM) return false;
          for (const v of s.grid) {
            if (!Number.isFinite(v) || v < 0 || v > 1) return false;
          }
          const t = s.cart.travel;
          if (!Number.isFinite(t) || t < 0 || t > TUNING.cartTravelMaxM) return false;
        }
        return true;
      }),
    );
  });
});
