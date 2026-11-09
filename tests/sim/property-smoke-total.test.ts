import fc from 'fast-check';
import { describe, it } from 'vitest';
import { step } from '../../src/sim/step';
import { gridArb, makeState, noPuffInputSequenceArb, seedArb } from './arbitraries';

const sum = (g: readonly number[]): number => g.reduce((a, b) => a + b, 0);

describe('Feature: smoke-and-projection, Property 3: Total smoke never increases without a puff', () => {
  it('total density after each tick is at most the previous total + 1e-9', () => {
    // **Validates: Requirements 4.4, 4.5, 4.6, 4.7**
    fc.assert(
      fc.property(seedArb, gridArb(), noPuffInputSequenceArb(), (seed, grid, ticks) => {
        let state = makeState(seed, grid);
        let prev = sum(state.grid);
        for (const inputs of ticks) {
          state = step(state, inputs);
          const total = sum(state.grid);
          if (!(total <= prev + 1e-9)) return false;
          prev = total;
        }
        return true;
      }),
    );
  });
});
