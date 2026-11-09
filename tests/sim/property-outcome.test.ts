import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Input, Outcome, State } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { TUNING } from '../../src/sim/tuning';
import {
  nearOutcomeStateArb,
  ropeStateArb,
  spectatorInputSequenceArb,
} from './arbitraries-slice';

/** The precedence rule of Requirement 3, evaluated on the state after the step. */
function expectedOutcome(after: State, previousTick: number): Outcome | null {
  const tick = previousTick + 1;
  if (!after.ropes.some((r) => r.status === 'standing')) {
    return { winner: 'spectators', reason: 'all_ropes_cut', tick };
  }
  if (!after.candles.some((c) => c.status === 'lit' || c.status === 'shielded')) {
    return { winner: 'showman', reason: 'all_candles_snuffed', tick };
  }
  if (tick >= TUNING.showLengthS / TUNING.tickS) {
    return { winner: 'showman', reason: 'time_up', tick };
  }
  return null;
}

const lastTick = TUNING.showLengthS / TUNING.tickS - 1;

/** A state with arbitrary ropes/candles, a tick anywhere including the final edge, and hostile inputs. */
const anyStateWithInputs = ropeStateArb(TUNING).chain((base) =>
  fc
    .tuple(
      fc.oneof(
        fc.integer({ min: 0, max: lastTick }),
        fc.constantFrom(0, lastTick - 1, lastTick),
      ),
      spectatorInputSequenceArb(base, TUNING, 1, 6),
    )
    .map(([tick, seq]) => ({ state: { ...base, tick } as State, inputs: (seq[0] ?? []) as Input[] })),
);

describe('Feature: vertical-slice, Property 4: Outcome follows the precedence rule', () => {
  it('outcome matches the rope, candle, time precedence and ended iff outcome, for arbitrary states', () => {
    // **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.7**
    fc.assert(
      fc.property(anyStateWithInputs, ({ state, inputs }) => {
        const next = step(state, inputs, TUNING);
        expect(next.outcome).toEqual(expectedOutcome(next, state.tick));
        expect(next.ended).toBe(next.outcome !== null);
        if (next.outcome !== null) expect(next.tick).toBe(next.outcome.tick);
      }),
    );
  });

  it('matches the rule next to each outcome edge, and the guaranteed edges end the round', () => {
    // **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.7**
    fc.assert(
      fc.property(nearOutcomeStateArb(TUNING), ({ state, edge, inputs }) => {
        const next = step(state, inputs, TUNING);
        expect(next.outcome).toEqual(expectedOutcome(next, state.tick));
        expect(next.ended).toBe(next.outcome !== null);
        if (edge === 'last_rope' || edge === 'rope_and_candle') {
          expect(next.outcome).toEqual({
            winner: 'spectators',
            reason: 'all_ropes_cut',
            tick: state.tick + 1,
          });
        }
        if (edge === 'time_up') {
          expect(next.outcome).not.toBeNull();
          expect(next.outcome?.winner === 'showman' || next.outcome?.reason === 'all_ropes_cut').toBe(true);
        }
      }),
    );
  });

  it('goes to the Spectators when no rope stands and no candle is lit or shielded', () => {
    // **Validates: Requirements 3.4**
    fc.assert(
      fc.property(ropeStateArb(TUNING), fc.integer({ min: 0, max: lastTick }), (base, tick) => {
        const state: State = structuredClone(base);
        state.tick = tick;
        state.ropes.forEach((r) => {
          r.status = 'cut';
          r.cutTick = r.cutTick ?? 0;
        });
        state.candles.forEach((c) => {
          c.status = 'snuffed';
        });
        state.snuffedCount = state.candles.length;
        const next = step(state, [], TUNING);
        expect(next.outcome).toEqual({ winner: 'spectators', reason: 'all_ropes_cut', tick: tick + 1 });
        expect(next.ended).toBe(true);
      }),
    );
  });

  it('leaves the outcome null when nothing triggers and the time has not run out', () => {
    // **Validates: Requirements 3.7**
    fc.assert(
      fc.property(ropeStateArb(TUNING), fc.integer({ min: 0, max: lastTick - 1 }), (base, tick) => {
        const state: State = structuredClone(base);
        state.tick = tick;
        const next = step(state, [], TUNING);
        const expected = expectedOutcome(next, tick);
        expect(next.outcome).toEqual(expected);
        if (expected === null) expect(next.ended).toBe(false);
      }),
    );
  });
});
