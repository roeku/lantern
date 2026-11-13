import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createState, step } from '../../src/sim';
import { inputArb, inputRunsArb } from './arbitraries';

describe('determinism', () => {
  it('same seed and inputs always give the same state', () => {
    fc.assert(
      fc.property(fc.integer(), inputRunsArb, (seed, inputs) => {
        let a = createState(seed);
        let b = createState(seed);
        for (const input of inputs) {
          a = step(a, input);
          b = step(b, input);
        }
        expect(a).toEqual(b);
      }),
      { numRuns: 40 },
    );
  });

  it('step never mutates its arguments', () => {
    fc.assert(
      fc.property(fc.integer(), inputArb, fc.integer({ min: 0, max: 200 }), (seed, input, warmup) => {
        let state = createState(seed);
        for (let i = 0; i < warmup; i++) state = step(state, input);
        const stateBefore = JSON.stringify(state);
        const inputBefore = JSON.stringify(input);
        step(state, input);
        expect(JSON.stringify(state)).toBe(stateBefore);
        expect(JSON.stringify(input)).toBe(inputBefore);
      }),
      { numRuns: 100 },
    );
  });
});
