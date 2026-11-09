import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createState } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { TUNING } from '../../src/sim/tuning';
import { playRound, roundArb } from './arbitraries-slice';

// Feature: vertical-slice, Property 13: Replaying the input log reproduces the final state
describe('Property 13: replaying the input log reproduces the final state', () => {
  it('re-running step over the recorded per-Tick lists yields the last State', () => {
    // **Validates: Requirements 13.9, 13.10**
    fc.assert(
      fc.property(roundArb(TUNING, 40), ({ seed, showmanId, inputsPerTick }) => {
        const { states, inputs } = playRound(seed, showmanId, inputsPerTick, TUNING);

        // Replay from a fresh first State over the recorded lists, through JSON as a log would be stored.
        const log = JSON.parse(JSON.stringify(inputs)) as typeof inputs;
        let replayed = createState(seed, TUNING, { showmanId });
        for (const list of log) replayed = step(replayed, list, TUNING);

        expect(replayed).toStrictEqual(states[states.length - 1]);
      }),
    );
  });
});
