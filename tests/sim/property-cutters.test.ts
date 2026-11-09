/**
 * Property 2: Several Cutters advance a Rope like one Cutter
 * **Validates: Requirements 1.5**
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isCutter, ropeCutHoldTicks } from '../../src/sim/ropes';
import type { Input, State } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { TUNING } from '../../src/sim/tuning';
import { ropeStateArb } from './arbitraries-slice';

/**
 * A state with one standing rope that k >= 1 lit Spectators stand on, plus the rope id.
 * Other spectators are left wherever the arbitrary put them (they may or may not cut).
 */
const scenarioArb = ropeStateArb().chain((base) => {
  const standing = base.ropes.filter((r) => r.status === 'standing').map((r) => r.id);
  // Force at least one standing rope so the property is never vacuous.
  const ropeIdArb = standing.length > 0 ? fc.constantFrom(...standing) : fc.constant(base.ropes[0]!.id);
  return fc
    .tuple(
      ropeIdArb,
      fc.subarray(
        base.spectators.map((s) => s.player),
        { minLength: 1 },
      ),
    )
    .map(([ropeId, chosen]) => {
      const state = structuredClone(base);
      const rope = state.ropes.find((r) => r.id === ropeId)!;
      rope.status = 'standing';
      rope.cutTick = null;
      // A cut rope has progress == hold; a revived one starts from a fresh, in-range progress.
      if (rope.cutProgressTicks >= ropeCutHoldTicks(TUNING)) rope.cutProgressTicks = 0;
      for (const player of chosen) {
        const sp = state.spectators.find((s) => s.player === player)!;
        sp.x = rope.x;
        sp.y = rope.y;
        const candle = state.candles.find((c) => c.id === sp.candleId)!;
        candle.x = rope.x;
        candle.y = rope.y;
        candle.status = 'lit';
      }
      state.snuffedCount = state.candles.filter((c) => c.status === 'snuffed').length;
      return { state, ropeId, cutters: chosen };
    });
});

const cutInputs = (players: readonly number[], rope: number): Input[] =>
  players.map((player) => ({ player, kind: 'cut', rope }));

describe('Property 2: Several Cutters advance a Rope like one Cutter', () => {
  it('a Rope after k valid Cutters equals the Rope after any one of them', () => {
    fc.assert(
      fc.property(scenarioArb, fc.nat(), ({ state, ropeId, cutters }, pick) => {
        // Every chosen Spectator is a valid Cutter for this rope.
        for (const p of cutters) expect(isCutter(state, p, ropeId, TUNING)).toBe(true);

        const one = cutters[pick % cutters.length] as number;
        const many = step(structuredClone(state) as State, cutInputs(cutters, ropeId), TUNING);
        const single = step(structuredClone(state) as State, cutInputs([one], ropeId), TUNING);

        expect(many.ropes.find((r) => r.id === ropeId)).toEqual(single.ropes.find((r) => r.id === ropeId));
      }),
    );
  });

  it('duplicate cut inputs from one Cutter also count once', () => {
    fc.assert(
      fc.property(scenarioArb, fc.integer({ min: 2, max: 5 }), ({ state, ropeId, cutters }, times) => {
        const one = cutters[0] as number;
        const dup = step(structuredClone(state) as State, cutInputs(Array(times).fill(one), ropeId), TUNING);
        const single = step(structuredClone(state) as State, cutInputs([one], ropeId), TUNING);
        expect(dup.ropes.find((r) => r.id === ropeId)).toEqual(single.ropes.find((r) => r.id === ropeId));
      }),
    );
  });
});
