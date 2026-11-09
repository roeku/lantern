import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildRecap, toReplayFrame } from '../../src/sim/recap';
import type { Input, State } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { nearOutcomeStateArb, playRound, roundArb, spectatorInputSequenceArb } from './arbitraries-slice';

function checkRecap(states: State[]): void {
  const recap = buildRecap(states.map(toReplayFrame));
  const final = states[states.length - 1] as State;
  const cutRopes = final.ropes.filter((r) => r.status === 'cut');

  expect(recap.snuffs.length).toBe(final.snuffedCount);
  expect(recap.ropeCuts.length).toBe(cutRopes.length);
  if (cutRopes.length === 0) {
    expect(recap.lastRopeCutTick).toBeNull();
  } else {
    expect(recap.lastRopeCutTick).toBe(Math.max(...cutRopes.map((r) => r.cutTick ?? -1)));
  }
  for (const list of [recap.snuffs, recap.ropeCuts]) {
    for (let i = 1; i < list.length; i++) {
      expect((list[i] as { tick: number }).tick).toBeGreaterThanOrEqual((list[i - 1] as { tick: number }).tick);
    }
  }
}

describe('Property 14: The Recap agrees with the final state', () => {
  /**
   * **Validates: Requirements 13.2, 13.3**
   */
  it('holds for rounds from the initial state with mixed inputs', () => {
    fc.assert(
      fc.property(roundArb(undefined, 60), ({ seed, showmanId, inputsPerTick }) => {
        checkRecap(playRound(seed, showmanId, inputsPerTick).states);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 13.2, 13.3**
   */
  it('holds for rounds that start next to an outcome edge (ropes cut, candles snuffed)', () => {
    fc.assert(
      fc.property(
        nearOutcomeStateArb().chain(({ state, inputs }) =>
          spectatorInputSequenceArb(state, undefined, 20).map((rest) => ({ state, first: inputs, rest })),
        ),
        ({ state, first, rest }) => {
          const states: State[] = [state];
          const lists: Input[][] = [first, ...rest];
          for (const list of lists) {
            states.push(step(states[states.length - 1] as State, structuredClone(list)));
          }
          checkRecap(states);
        },
      ),
      { numRuns: 100 },
    );
  });
});
