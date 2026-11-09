import fc from 'fast-check';
import { describe, it } from 'vitest';
import { nextShowmanSeat, SEAT_COUNT } from '../../src/server/room';

// Feature: vertical-slice, Property 11: Rematch rotation picks the next held seat
// **Validates: Requirements 7.7, 7.8**
describe('Property 11: Rematch rotation picks the next held seat', () => {
  const heldAndCurrent = fc
    .uniqueArray(fc.integer({ min: 0, max: SEAT_COUNT - 1 }), { minLength: 1, maxLength: SEAT_COUNT })
    .chain((held) => fc.tuple(fc.constant(held), fc.constantFrom(...held)));

  it('returns the smallest held seat above current, wrapping to the smallest', () => {
    fc.assert(
      fc.property(heldAndCurrent, ([held, current]) => {
        const sorted = [...held].sort((a, b) => a - b);
        const above = sorted.filter((s) => s > current);
        const expected = above.length > 0 ? above[0]! : sorted[0]!;
        return nextShowmanSeat(held, current) === expected;
      }),
      { numRuns: 100 },
    );
  });

  it('stays on the current seat when exactly one seat is held', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: SEAT_COUNT - 1 }), (seat) => nextShowmanSeat([seat], seat) === seat),
      { numRuns: 100 },
    );
  });
});
