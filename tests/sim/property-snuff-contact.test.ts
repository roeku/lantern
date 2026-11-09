import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { imageScale, step, TUNING, type Candle, type Input } from '../../src/sim';
import { gridArb, inputArb, makeState, seedArb } from './arbitraries';

const CENTRE = 0.5;

// Dense grids so solid ghosts occur often.
const denseGridArb = fc.array(fc.double({ min: 0.4, max: 1, noNaN: true }), {
  minLength: TUNING.roomWidthM * TUNING.roomDepthM,
  maxLength: TUNING.roomWidthM * TUNING.roomDepthM,
});

const anyGridArb = fc.oneof(
  { arbitrary: denseGridArb, weight: 3 },
  { arbitrary: gridArb(), weight: 1 },
);

// Candles placed just in front of the cart on the default beam line, where the
// nearest solid ghost appears.
const candlesArb = fc.array(
  fc.record({
    x: fc.double({ min: TUNING.cartOriginXM - 1.5, max: TUNING.cartOriginXM + 1.5, noNaN: true }),
    y: fc.double({
      min: TUNING.cartTrackStartYM + 2,
      max: TUNING.cartTrackStartYM + 8,
      noNaN: true,
    }),
    status: fc.constantFrom<Candle['status']>('lit', 'lit', 'shielded', 'snuffed'),
  }),
  { minLength: 1, maxLength: 6 },
);

// Inputs without external snuff events, so contact is the only snuff path.
const noSnuffInputArb: fc.Arbitrary<Input> = inputArb().filter((i) => i.kind !== 'snuff');

// Aim and cart stay near defaults: few inputs per tick, and often none.
const sequenceArb = fc.array(fc.array(noSnuffInputArb, { maxLength: 2 }), { maxLength: 30 });

type CandleSeed = { x: number; y: number; status: Candle['status'] };

/**
 * A fixed case that always makes contact: a full-smoke room, with a lit candle placed
 * on the cell where the ghost appears. Passed to fast-check as an explicit example, so
 * the coverage checks below never depend on random luck.
 */
function contactExample(): [number, number[], CandleSeed[], Input[][]] {
  const seed = 1;
  const grid = new Array<number>(TUNING.roomWidthM * TUNING.roomDepthM).fill(1);
  const ghost = step(makeState(seed, grid), []).ghost;
  if (ghost === null || !ghost.solid) throw new Error('contact example needs a solid ghost');
  const candle: CandleSeed = { x: ghost.col + CENTRE, y: ghost.row + CENTRE, status: 'lit' };
  return [seed, grid, [candle], [[]]];
}

describe('snuff by contact', () => {
  it('Feature: smoke-and-projection, Property 6: Candles are snuffed only by a nearby solid ghost', () => {
    // **Validates: Requirements 9.6, 9.7, 9.8, 9.9**
    let ghostTicks = 0;
    let snuffTicks = 0;

    fc.assert(
      fc.property(seedArb, anyGridArb, candlesArb, sequenceArb, (seed, grid, candles, ticks) => {
        let prev = makeState(seed, grid);
        prev.candles = candles.map((c, id) => ({ id, x: c.x, y: c.y, status: c.status }));

        for (const inputs of ticks) {
          const next = step(prev, inputs);
          if (next.ended) break;

          const ghost = next.ghost;
          const solid = ghost !== null && ghost.solid;
          if (solid) ghostTicks++;
          const radius = TUNING.snuffRadiusBaseM * imageScale(next.cart.travel, TUNING);
          const inRange = (c: { x: number; y: number }): boolean =>
            solid && Math.hypot(c.x - (ghost.col + CENTRE), c.y - (ghost.row + CENTRE)) <= radius;

          for (const before of prev.candles) {
            const after = next.candles.find((c) => c.id === before.id);
            expect(after).toBeDefined();
            if (before.status === 'snuffed' || after === undefined) continue;

            const newlySnuffed = after.status === 'snuffed';
            if (newlySnuffed) snuffTicks++;
            // Snuffed only with a solid ghost in range; and always snuffed when one is.
            expect(newlySnuffed).toBe(inRange(after));
          }
          prev = next;
        }
      }),
      { examples: [contactExample()] },
    );

    // The fixed example guarantees contact happened at least once.
    expect(ghostTicks).toBeGreaterThan(0);
    expect(snuffTicks).toBeGreaterThan(0);
  });
});
