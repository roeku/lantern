import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { step } from '../../src/sim/step';
import { createState, type Input } from '../../src/sim/state';
import { inputArb, seedArb, shortTuning } from './arbitraries';

/** Keep the first input per player so ids are distinct within a tick. */
function distinctByPlayer(inputs: Input[]): Input[] {
  const seen = new Set<number>();
  // Spread into plain objects (fc.record yields null-prototype objects).
  return inputs
    .filter((i) => (seen.has(i.player) ? false : (seen.add(i.player), true)))
    .map((i) => ({ ...i }));
}

/** Rotate then optionally reverse: a deterministic permutation of a list. */
function permute<T>(xs: readonly T[], rotate: number, reverse: boolean): T[] {
  if (xs.length === 0) return [];
  const k = rotate % xs.length;
  const rotated = [...xs.slice(k), ...xs.slice(0, k)];
  return reverse ? rotated.reverse() : rotated;
}

describe('Property 1: deterministic, pure replay', () => {
  it('Feature: smoke-and-projection, Property 1: Deterministic, pure replay with tick-based round end', () => {
    // Validates: Requirements 1.1, 1.2, 1.6, 1.9, 1.10, 1.11
    fc.assert(
      fc.property(
        seedArb,
        fc.integer({ min: 1, max: 3 }),
        fc.array(
          fc.record({
            inputs: fc.array(inputArb(), { maxLength: 4 }).map(distinctByPlayer),
            rotate: fc.nat({ max: 10 }),
            reverse: fc.boolean(),
          }),
          { maxLength: 40 },
        ),
        (seed, seconds, plan) => {
          const tuning = shortTuning(seconds);
          const endTick = tuning.showLengthS / tuning.tickS;
          const steps = endTick + 3; // run past the end to cover the frozen state

          let a = createState(seed, tuning);
          let b = createState(seed, tuning);
          let c = createState(seed, tuning); // fed permuted inputs

          for (let t = 0; t < steps; t++) {
            const entry = plan[t];
            const inputs = entry ? entry.inputs : [];
            const permuted = entry ? permute(inputs, entry.rotate, entry.reverse) : [];

            const stateBefore = structuredClone(a);
            const inputsBefore = structuredClone(inputs);

            const nextA = step(a, inputs, tuning);
            const nextB = step(b, inputs, tuning);
            const nextC = step(c, permuted, tuning);

            // Purity: neither state nor inputs were mutated.
            expect(a).toStrictEqual(stateBefore);
            expect(inputs).toStrictEqual(inputsBefore);

            // Same seed and inputs: identical state at every tick.
            expect(nextB).toStrictEqual(nextA);

            // Input order does not matter with distinct player ids.
            expect(nextC).toStrictEqual(nextA);

            // Plain serializable data.
            expect(JSON.parse(JSON.stringify(nextA))).toStrictEqual(nextA);

            // Round ends on an Outcome (early win or time-up), never otherwise; time is a hard bound.
            expect(nextA.ended).toBe(nextA.outcome !== null);
            if (nextA.tick >= endTick) expect(nextA.ended).toBe(true);

            // An ended state is frozen.
            if (a.ended) {
              expect(nextA).toStrictEqual(a);
              expect(nextA).not.toBe(a);
            }

            a = nextA;
            b = nextB;
            c = nextC;
          }

          expect(a.ended).toBe(true);
        },
      ),
    );
  });
});
