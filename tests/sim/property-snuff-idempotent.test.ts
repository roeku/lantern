import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applySnuffEvent } from '../../src/sim/candles';
import type { CandleStatus } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { gridArb, inputSequenceArb, makeState, seedArb } from './arbitraries';

const statusArb = fc.constantFrom<CandleStatus>('lit', 'shielded', 'snuffed');
const eventIdArb = fc.oneof(fc.constantFrom('e1', 'e2', 'dup', ''), fc.string({ maxLength: 8 }));
const candleIdArb = fc.oneof(
  fc.integer({ min: 0, max: 8 }),
  fc.integer({ min: -5, max: 30 }),
  fc.constantFrom(NaN, 0.5),
);

describe('Feature: smoke-and-projection, Property 7: Snuff events are idempotent', () => {
  it('applying the same snuff event twice equals applying it once, and snuffedCount rises by at most 1', () => {
    // **Validates: Requirements 10.1, 10.2, 10.3, 10.5**
    fc.assert(
      fc.property(
        seedArb,
        gridArb(),
        inputSequenceArb(undefined, 8),
        fc.array(statusArb, { minLength: 0, maxLength: 16 }),
        fc.array(eventIdArb, { maxLength: 3 }),
        candleIdArb,
        eventIdArb,
        (seed, grid, ticks, statuses, priorIds, candle, eventId) => {
          let state = makeState(seed, grid);
          for (const inputs of ticks) state = step(state, inputs);
          state = {
            ...state,
            candles: state.candles.map((c, i) => ({ ...c, status: statuses[i] ?? c.status })),
          };
          // Previously applied ids (without touching snuffedCount) to model replays.
          state = { ...state, appliedSnuffIds: [...state.appliedSnuffIds, ...priorIds] };

          const once = applySnuffEvent(state, candle, eventId);
          const twice = applySnuffEvent(once, candle, eventId);

          expect(twice).toEqual(once);
          expect(once.snuffedCount - state.snuffedCount).toBeLessThanOrEqual(1);
          expect(once.snuffedCount - state.snuffedCount).toBeGreaterThanOrEqual(0);
          expect(twice.snuffedCount - state.snuffedCount).toBeLessThanOrEqual(1);
        },
      ),
    );
  });
});
