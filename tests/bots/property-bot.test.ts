import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { spectatorBotInputs } from '../../src/bots/spectator-bot';
import { ownedCandle, TUNING, type Ghost, type State, type Tuning } from '../../src/sim';
import { ropeStateArb, spectatorIds } from '../sim/arbitraries-slice';

const ALWAYS: Tuning = { ...TUNING, botReactChancePerTick: 1 };

/** Nearest standing rope by distance, lower id on ties. */
function nearest(state: State, x: number, y: number) {
  const standing = state.ropes.filter((r) => r.status === 'standing');
  return standing.reduce<(typeof standing)[number] | undefined>((best, r) => {
    if (best === undefined) return r;
    const d = Math.hypot(r.x - x, r.y - y);
    const bd = Math.hypot(best.x - x, best.y - y);
    return d < bd || (d === bd && r.id < best.id) ? r : best;
  }, undefined);
}

const ghostArb: fc.Arbitrary<Ghost | null> = fc.option(
  fc.record({
    col: fc.integer({ min: 0, max: 40 }),
    row: fc.integer({ min: 0, max: 40 }),
    density: fc.double({ min: 0, max: 1, noNaN: true }),
    solid: fc.boolean(),
  }),
  { nil: null },
);

describe('Property 7: Bots are pure and walk to the nearest rope', () => {
  it('is pure: equal results on repeat calls and State (including rng) unchanged', () => {
    // **Validates: Requirements 5.1, 5.2**
    fc.assert(
      fc.property(ropeStateArb(), ghostArb, fc.integer({ min: 0, max: 500 }), (base, ghost, tick) => {
        const state: State = { ...base, ghost, tick };
        const before = structuredClone(state);
        const bots = spectatorIds(state);
        const a = spectatorBotInputs(state, bots);
        const b = spectatorBotInputs(state, bots);
        const c = spectatorBotInputs(state, bots, ALWAYS);
        const d = spectatorBotInputs(state, bots, ALWAYS);
        expect(b).toEqual(a);
        expect(d).toEqual(c);
        expect(state).toEqual(before);
      }),
    );
  });

  it('unthreatened lit bots move toward or cut the nearest standing rope', () => {
    // **Validates: Requirements 5.3**
    fc.assert(
      fc.property(ropeStateArb(), (base) => {
        const state: State = { ...base, ghost: null };
        const inputs = spectatorBotInputs(state, spectatorIds(state), ALWAYS);
        for (const player of spectatorIds(state)) {
          const candle = ownedCandle(state, player);
          if (candle === undefined || candle.status !== 'lit') continue;
          const rope = nearest(state, candle.x, candle.y);
          const mine = inputs.filter((i) => i.player === player);
          if (rope === undefined) {
            expect(mine).toEqual([]);
          } else if (Math.hypot(rope.x - candle.x, rope.y - candle.y) <= TUNING.ropeCutRadiusM) {
            expect(mine).toEqual([{ player, kind: 'cut', rope: rope.id }]);
          } else {
            expect(mine).toEqual([{ player, kind: 'move', dx: rope.x - candle.x, dy: rope.y - candle.y }]);
          }
        }
      }),
    );
  });

  it('threatened bots never send move or cut', () => {
    // **Validates: Requirements 5.4**
    fc.assert(
      fc.property(ropeStateArb(), fc.integer({ min: 0, max: 500 }), (base, tick) => {
        // Put a solid ghost in the cell holding the first spectator's candle.
        const player = spectatorIds(base)[0] as number;
        const candle = ownedCandle(base, player);
        fc.pre(candle !== undefined);
        const c = candle!;
        const ghost: Ghost = { col: Math.floor(c.x), row: Math.floor(c.y), density: 1, solid: true };
        const state: State = { ...base, ghost, tick };
        const inputs = spectatorBotInputs(state, [player], ALWAYS);
        expect(inputs.filter((i) => i.kind === 'move' || i.kind === 'cut')).toEqual([]);
      }),
    );
  });
});
