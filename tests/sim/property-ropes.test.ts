import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ropeCutHoldTicks } from '../../src/sim/ropes';
import { step } from '../../src/sim/step';
import type { Input, Rope, State } from '../../src/sim/state';
import { TUNING } from '../../src/sim/tuning';
import { ropeStateArb, spectatorInputSequenceArb } from './arbitraries-slice';

const T = TUNING;
const HOLD = ropeCutHoldTicks(T);

/** A rope state where each Spectator may be snapped next to a rope (so Cutters are common). */
const snappedStateArb: fc.Arbitrary<State> = ropeStateArb(T).chain((base) =>
  fc
    .array(
      fc.record({
        snap: fc.boolean(),
        rope: fc.integer({ min: 0, max: T.ropeCount - 1 }),
        // Offsets reach just inside and just outside the cut radius.
        ox: fc.double({ min: -1.5 * T.ropeCutRadiusM, max: 1.5 * T.ropeCutRadiusM, noNaN: true }),
        oy: fc.double({ min: -1.5 * T.ropeCutRadiusM, max: 1.5 * T.ropeCutRadiusM, noNaN: true }),
      }),
      { minLength: base.spectators.length, maxLength: base.spectators.length },
    )
    .map((snaps) => {
      const s = structuredClone(base);
      s.spectators.forEach((sp, i) => {
        const o = snaps[i];
        if (o === undefined || !o.snap) return;
        const rope = s.ropes[o.rope] as Rope;
        sp.x = Math.min(T.roomWidthM, Math.max(0, rope.x + o.ox));
        sp.y = Math.min(T.roomDepthM, Math.max(0, rope.y + o.oy));
        const candle = s.candles.find((c) => c.id === sp.candleId);
        if (candle !== undefined) {
          candle.x = sp.x;
          candle.y = sp.y;
        }
      });
      return s;
    }),
);

/** Cut inputs from anyone (Showman, Spectators, strangers) naming good and bad ropes. */
function cutInputsArb(state: State): fc.Arbitrary<Input[][]> {
  const players = [state.showmanId, ...state.spectators.map((s) => s.player), 99];
  const cut = fc.record({
    player: fc.constantFrom(...players),
    kind: fc.constant('cut' as const),
    rope: fc.oneof(
      { arbitrary: fc.integer({ min: 0, max: T.ropeCount - 1 }), weight: 6 },
      { arbitrary: fc.constantFrom(-1, T.ropeCount, T.ropeCount + 5, 0.5, Number.NaN), weight: 1 },
    ),
  }) as fc.Arbitrary<Input>;
  return fc.array(fc.array(cut, { maxLength: 6 }), { minLength: 1, maxLength: HOLD + 6 });
}

/** Independent oracle for one step of the rope rule, computed from the pre-step state. */
function isValidCutter(state: State, input: Input): boolean {
  if (input.kind !== 'cut' || input.player === state.showmanId) return false;
  const sp = state.spectators.find((s) => s.player === input.player);
  const rope = state.ropes.find((r) => r.id === input.rope);
  if (sp === undefined || rope === undefined || rope.status !== 'standing') return false;
  const candle = state.candles.find((c) => c.id === sp.candleId);
  if (candle === undefined || candle.status !== 'lit') return false;
  return Math.hypot(sp.x - rope.x, sp.y - rope.y) <= T.ropeCutRadiusM;
}

function expectedRope(prev: State, rope: Rope, inputs: readonly Input[]): Rope {
  if (prev.ended || prev.outcome !== null) return rope;
  if (rope.status === 'cut') return rope;
  const held = inputs.some((i) => i.kind === 'cut' && i.rope === rope.id && isValidCutter(prev, i));
  if (!held) return { ...rope, cutProgressTicks: 0 };
  const progress = rope.cutProgressTicks + 1;
  if (progress >= HOLD) return { ...rope, cutProgressTicks: HOLD, status: 'cut', cutTick: prev.tick };
  return { ...rope, cutProgressTicks: progress };
}

describe('Property 1: Rope progress evolves by the Cutter rule', () => {
  it('Feature: vertical-slice, Property 1: Rope progress evolves by the Cutter rule', () => {
    // **Validates: Requirements 1.2, 1.3, 1.4, 1.6, 1.7, 1.8**
    fc.assert(
      fc.property(
        snappedStateArb.chain((state) => cutInputsArb(state).map((seq) => ({ state, seq }))),
        ({ state, seq }) => {
          let cur = state;
          for (const inputs of seq) {
            const next = step(cur, inputs, T);
            const expected = cur.ropes.map((r) => expectedRope(cur, r, inputs));
            expect(next.ropes).toEqual(expected);
            for (const r of next.ropes) {
              expect(r.cutProgressTicks).toBeGreaterThanOrEqual(0);
              expect(r.cutProgressTicks).toBeLessThanOrEqual(HOLD);
            }
            cur = next;
          }
        },
      ),
    );
  });

  it('holds across mixed move, shield, fan and cut inputs: bounds, resets, and cut ropes never change', () => {
    // **Validates: Requirements 1.2, 1.3, 1.4, 1.6, 1.7, 1.8**
    fc.assert(
      fc.property(
        snappedStateArb.chain((state) =>
          spectatorInputSequenceArb(state, T, HOLD + 10, 5).map((seq) => ({ state, seq })),
        ),
        ({ state, seq }) => {
          let cur = state;
          for (const inputs of seq) {
            const next = step(cur, inputs, T);
            const frozen = cur.ended || cur.outcome !== null;
            const hasSpectatorCut = inputs.some(
              (i) => i.kind === 'cut' && i.player !== cur.showmanId && cur.spectators.some((s) => s.player === i.player),
            );
            next.ropes.forEach((r, idx) => {
              const before = cur.ropes[idx] as Rope;
              expect(r.cutProgressTicks).toBeGreaterThanOrEqual(0);
              expect(r.cutProgressTicks).toBeLessThanOrEqual(HOLD);
              if (before.status === 'cut' || frozen) {
                expect(r).toEqual(before);
                return;
              }
              if (r.status === 'cut') {
                expect(before.cutProgressTicks + 1).toBeGreaterThanOrEqual(HOLD);
                expect(r.cutTick).toBe(cur.tick);
              } else {
                expect([0, before.cutProgressTicks + 1]).toContain(r.cutProgressTicks);
                if (!hasSpectatorCut) expect(r.cutProgressTicks).toBe(0);
              }
            });
            cur = next;
          }
        },
      ),
    );
  });
});
