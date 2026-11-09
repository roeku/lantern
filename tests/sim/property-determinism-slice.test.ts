import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { step } from '../../src/sim/step';
import { createState, type Input } from '../../src/sim/state';
import { TUNING } from '../../src/sim/tuning';
import { inputArb } from './arbitraries';
import { nearOutcomeStateArb, roundArb, spectatorInputArb } from './arbitraries-slice';

// Feature: vertical-slice, Property 5: Determinism and freeze on the extended State
describe('Property 5: determinism and freeze on the extended State', () => {
  it('two runs from createState(seed) are deep-equal at every Tick (extended input set)', () => {
    // **Validates: Requirements 3.5, 3.6**
    fc.assert(
      fc.property(
        roundArb(TUNING, 40),
        fc.array(fc.array(inputArb(), { maxLength: 2 }), { maxLength: 40 }),
        ({ seed, showmanId, inputsPerTick }, showmanInputs) => {
          let a = createState(seed, TUNING, { showmanId });
          let b = createState(seed, TUNING, { showmanId });
          inputsPerTick.forEach((spectatorInputs, t) => {
            // Spread into plain objects (fc.record yields null-prototype objects).
            const inputs: Input[] = [...spectatorInputs, ...(showmanInputs[t] ?? [])].map((i) => ({ ...i }));
            const before = structuredClone(a);
            const inputsBefore = structuredClone(inputs);
            const nextA = step(a, inputs, TUNING);
            const nextB = step(b, inputs, TUNING);
            expect(a).toStrictEqual(before); // purity
            expect(inputs).toStrictEqual(inputsBefore);
            expect(nextB).toStrictEqual(nextA);
            expect(JSON.parse(JSON.stringify(nextA))).toStrictEqual(nextA);
            a = nextA;
            b = nextB;
          });
        },
      ),
    );
  });

  it('step on a State with an Outcome returns a deep-equal State for any inputs', () => {
    // **Validates: Requirements 3.5, 3.6**
    fc.assert(
      fc.property(
        nearOutcomeStateArb(TUNING).filter((n) => n.edge === 'last_rope' || n.edge === 'time_up'),
        fc.array(fc.array(fc.oneof(inputArb(), spectatorInputArb(createState(1, TUNING))), { maxLength: 4 }), {
          minLength: 1,
          maxLength: 5,
        }),
        ({ state, inputs }, extra) => {
          let s = step(state, inputs, TUNING);
          expect(s.outcome).not.toBeNull();
          expect(s.ended).toBe(true);
          for (const list of extra) {
            const copy = list.map((i) => ({ ...i }));
            const next = step(s, copy, TUNING);
            expect(next).toStrictEqual(s);
            expect(next).not.toBe(s);
            s = next;
          }
        },
      ),
    );
  });
});
