import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createFixedStepClock } from '../../src/net/fixed-step';

// Feature: vertical-slice, Property 10: The fixed-step clock keeps the long-run rate
// **Validates: Requirements 7.5, 14.3**
describe('Property 10: The fixed-step clock keeps the long-run rate', () => {
  it('total steps up to t equals floor((t - start) / stepMs) and no query is negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 200 }),
        fc.integer({ min: 1, max: 60 }),
        fc.array(fc.double({ min: 0.001, max: 1, noNaN: true }), { minLength: 1, maxLength: 200 }),
        (startMs, stepMs, maxCatchUp, gapFractions) => {
          const clock = createFixedStepClock(startMs, stepMs, maxCatchUp);
          let now = startMs;
          let total = 0;
          for (const f of gapFractions) {
            // Strictly increasing times; each gap stays within the catch-up bound.
            now += Math.max(1e-3, f * maxCatchUp * stepMs);
            const n = clock.advance(now);
            expect(n).toBeGreaterThanOrEqual(0);
            total += n;
            expect(total).toBe(Math.floor((now - startMs) / stepMs));
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('drops the surplus beyond maxCatchUp and resumes pacing after a stall', () => {
    const clock = createFixedStepClock(0, 50, 40);
    expect(clock.advance(49)).toBe(0);
    expect(clock.advance(50)).toBe(1);
    expect(clock.advance(1_000_000)).toBe(40);
    expect(clock.advance(1_000_000 + 49)).toBe(0);
    expect(clock.advance(1_000_000 + 50)).toBe(1);
  });
});
