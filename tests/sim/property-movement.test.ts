import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { step } from '../../src/sim/step';
import { TUNING } from '../../src/sim/tuning';
import type { Input, State } from '../../src/sim/state';
import { ropeStateArb, spectatorInputArb } from './arbitraries-slice';

const EPS = 1e-9;
const STEP_M = TUNING.spectatorSpeedMps * TUNING.tickS;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Independent oracle: the position each Spectator must have after one step. */
function expectedPositions(state: State, inputs: readonly Input[]): Map<number, { x: number; y: number }> {
  const out = new Map<number, { x: number; y: number }>();
  for (const sp of state.spectators) {
    // Last move from this player wins; Showman and unknown senders never match a Spectator.
    let last: Extract<Input, { kind: 'move' }> | null = null;
    for (const i of inputs) if (i.kind === 'move' && i.player === sp.player) last = i;
    let { x, y } = sp;
    if (last !== null) {
      const len = Math.hypot(last.dx, last.dy);
      if (Number.isFinite(last.dx) && Number.isFinite(last.dy) && Number.isFinite(len) && len > 0) {
        x = clamp(sp.x + (last.dx / len) * STEP_M, 0, TUNING.roomWidthM);
        y = clamp(sp.y + (last.dy / len) * STEP_M, 0, TUNING.roomDepthM);
      }
    }
    out.set(sp.player, { x, y });
  }
  return out;
}

const caseArb = ropeStateArb().chain((state) =>
  fc.array(spectatorInputArb(state), { maxLength: 8 }).map((inputs) => ({ state, inputs })),
);

describe('Spectator movement', () => {
  it('Feature: vertical-slice, Property 3: Spectators move at fixed speed inside the room and carry their candle', () => {
    // **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.7**
    fc.assert(
      fc.property(caseArb, ({ state, inputs }) => {
        const before = structuredClone(state);
        const next = step(state, inputs);
        const expected = expectedPositions(before, inputs);

        for (const sp of next.spectators) {
          const want = expected.get(sp.player);
          expect(want).toBeDefined();
          // 2.2, 2.3, 2.5, 2.6: speed, normalisation, ignored vectors, Showman senders, Audience_Side.
          expect(Math.abs(sp.x - (want?.x ?? NaN))).toBeLessThanOrEqual(EPS);
          expect(Math.abs(sp.y - (want?.y ?? NaN))).toBeLessThanOrEqual(EPS);
          // 2.4: inside the room.
          expect(sp.x).toBeGreaterThanOrEqual(0);
          expect(sp.x).toBeLessThanOrEqual(TUNING.roomWidthM);
          expect(sp.y).toBeGreaterThanOrEqual(0);
          expect(sp.y).toBeLessThanOrEqual(TUNING.roomDepthM);
        }
        // 2.7: candle position equals its owner's position.
        for (const sp of next.spectators) {
          const candle = next.candles.find((c) => c.id === sp.candleId);
          expect(candle?.x).toBe(sp.x);
          expect(candle?.y).toBe(sp.y);
        }
      }),
    );
  });

  it('moves exactly spectatorSpeedMps x tickS for a finite non-zero vector away from walls', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.double({ min: -10, max: 10, noNaN: true }),
        fc.double({ min: -10, max: 10, noNaN: true }),
        (seed, dx, dy) => {
          fc.pre(Math.hypot(dx, dy) > 1e-6);
          const s = ropeStateArbFixed(seed);
          const sp = s.spectators[0]!;
          const next = step(s, [{ player: sp.player, kind: 'move', dx, dy }]);
          const moved = next.spectators[0]!;
          expect(Math.abs(Math.hypot(moved.x - sp.x, moved.y - sp.y) - STEP_M)).toBeLessThanOrEqual(EPS);
        },
      ),
    );
  });
});

/** Fresh state with the first Spectator moved to the room centre, away from every wall. */
function ropeStateArbFixed(seed: number): State {
  const [s] = fc.sample(ropeStateArb(), { seed, numRuns: 1 });
  const state = structuredClone(s as State);
  const sp = state.spectators[0]!;
  sp.x = TUNING.roomWidthM / 2;
  sp.y = TUNING.roomDepthM / 2;
  return state;
}
