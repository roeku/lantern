import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decodeSnapshot, encodeSnapshot, quantizeState } from '../../src/net/snapshot-codec';
import { step, type State } from '../../src/sim';
import { nearOutcomeStateArb, playRound, roundArb, ropeStateArb } from '../sim/arbitraries-slice';

/**
 * Feature: vertical-slice, Property 12: Snapshot round trip against any baseline
 * **Validates: Requirements 8.3, 8.4, 8.5**
 */

const roundStatesArb: fc.Arbitrary<State[]> = roundArb(undefined, 40).map(
  (r) => playRound(r.seed, r.showmanId, r.inputsPerTick).states,
);

/** States with ropes, spectators, outcomes and ended rounds, beside played-round states. */
const endedStateArb: fc.Arbitrary<State> = nearOutcomeStateArb().map(({ state, inputs }) => {
  let s = state;
  for (let i = 0; i < 3; i++) s = step(s, i === 0 ? inputs : []);
  return s;
});

const anyStateArb: fc.Arbitrary<State> = fc.oneof(
  roundStatesArb.chain((states) => fc.constantFrom(...states)),
  ropeStateArb(),
  endedStateArb,
);

/** Baseline choice: none, an earlier state of the same round, or an unrelated state. */
const baselineKindArb = fc.constantFrom('null', 'earlier', 'unrelated');

function check(state: State, baseline: State | null): void {
  const expected = quantizeState(state);
  const held = baseline === null ? null : quantizeState(baseline);
  const frame = encodeSnapshot(state, held);
  expect(decodeSnapshot(frame, held)).toEqual(expected);
  // The sender may keep the raw state it sent: the frame is identical.
  expect(encodeSnapshot(state, baseline)).toEqual(frame);
}

describe('Property 12: snapshot round trip against any baseline', () => {
  it('decode(encode(state, baseline), baseline) equals quantizeState(state)', () => {
    fc.assert(
      fc.property(
        roundStatesArb,
        fc.nat(),
        fc.nat(),
        baselineKindArb,
        anyStateArb,
        (states, a, b, kind, other) => {
          const i = a % states.length;
          const j = b % (i + 1);
          const state = states[i] as State;
          const baseline = kind === 'null' ? null : kind === 'earlier' ? (states[j] as State) : other;
          check(state, baseline);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('holds for rope, ended and outcome states against any baseline', () => {
    fc.assert(
      fc.property(anyStateArb, anyStateArb, fc.boolean(), (state, other, useNull) => {
        check(state, useNull ? null : other);
        check(state, state);
      }),
      { numRuns: 100 },
    );
  });
});
