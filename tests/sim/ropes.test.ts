import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applySnuffEvent } from '../../src/sim/candles';
import { createState, type Input, type State } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { TUNING, validateTuning } from '../../src/sim/tuning';

const NEEDED = Math.round(TUNING.ropeCutHoldS / TUNING.tickS);
const cut = (player: number, rope: number): Input => ({ player, kind: 'cut', rope });

/** Put Spectator N (player N + 1) and its candle on rope N. */
function atRopes(s: State): State {
  return {
    ...s,
    spectators: s.spectators.map((sp) => {
      const r = s.ropes[sp.candleId]!;
      return { ...sp, x: r.x, y: r.y };
    }),
    candles: s.candles.map((c) => ({ ...c, x: s.ropes[c.id]!.x, y: s.ropes[c.id]!.y })),
  };
}
const fresh = (): State => atRopes(createState(1));

function hold(state: State, inputs: Input[], ticks: number): State {
  let s = state;
  for (let i = 0; i < ticks; i++) s = step(s, inputs);
  return s;
}

describe('rope cutting', () => {
  it('cuts a rope after ropeCutS of holding, not one tick sooner', () => {
    const almost = hold(fresh(), [cut(1, 0)], NEEDED - 1);
    expect(almost.ropes[0]).toMatchObject({ status: 'standing', cutProgressTicks: NEEDED - 1 });
    const done = step(almost, [cut(1, 0)]);
    expect(done.ropes[0]?.status).toBe('cut');
    expect(done.ended).toBe(false); // two ropes still stand
  });

  it('resets progress on any tick without a valid cutter', () => {
    const half = hold(fresh(), [cut(1, 0)], NEEDED - 1);
    const reset = step(half, []);
    expect(reset.ropes[0]?.cutProgressTicks).toBe(0);
  });

  it('does not count the Showman, a far candle, a shielded or snuffed candle, or a bad rope id', () => {
    const base = fresh();
    const progressAfter = (s: State, input: Input): number => step(s, [input]).ropes[0]?.cutProgressTicks ?? -1;
    expect(progressAfter(base, cut(0, 0))).toBe(0); // Showman
    expect(progressAfter(base, cut(2, 0))).toBe(0); // Spectator 2 is far from rope 0
    const shielded = step(base, [{ player: 1, kind: 'shield', candle: 0 }]);
    expect(progressAfter(shielded, cut(1, 0))).toBe(0);
    const snuffed = applySnuffEvent(base, 0, 'x');
    expect(progressAfter(snuffed, cut(1, 0))).toBe(0);
    expect(() => step(base, [cut(1, 9), cut(1, Number.NaN)])).not.toThrow();
  });

  it('a cutter snuffed this tick still advanced the rope this tick, then cannot continue', () => {
    const base = fresh();
    const smoky: State = { ...base, grid: base.grid.map(() => 1) };
    const first = step(smoky, []).ghost;
    if (first === null) throw new Error('expected a ghost');
    const x = first.col + 0.5;
    const y = first.row + 0.5;
    const target: State = {
      ...smoky,
      spectators: smoky.spectators.map((sp) => (sp.candleId === 0 ? { ...sp, x, y } : sp)),
      candles: smoky.candles.map((c) => (c.id === 0 ? { ...c, x, y } : c)),
      ropes: smoky.ropes.map((r) => (r.id === 0 ? { ...r, x, y } : r)),
    };
    const after = step(target, [cut(1, 0)]);
    expect(after.candles[0]?.status).toBe('snuffed');
    expect(after.ropes[0]?.cutProgressTicks).toBe(1);
    expect(step(after, [cut(1, 0)]).ropes[0]?.cutProgressTicks).toBe(0);
  });
  it('several cutters on one rope do not speed it up, and a cut rope stays cut', () => {
    const two = hold(fresh(), [cut(1, 0), cut(1, 0), cut(1, 0)], NEEDED);
    expect(two.ropes[0]?.status).toBe('cut');
    expect(step(two, []).ropes[0]).toMatchObject({ status: 'cut' });
  });

  it('cutting all 3 ropes ends the round at once, with the Spectators winning', () => {
    const s = hold(fresh(), [cut(1, 0), cut(2, 1), cut(3, 2)], NEEDED);
    expect(s.ended).toBe(true);
    expect(s.tick).toBe(NEEDED);
    expect(s.outcome).toMatchObject({ winner: 'spectators', reason: 'all_ropes_cut', tick: s.tick });
    expect(step(s, [])).toEqual(s); // frozen once ended
  });

  it('the Showman wins when time runs out with a rope standing', () => {
    const total = TUNING.showLengthS / TUNING.tickS;
    const s = hold(fresh(), [cut(1, 0), cut(2, 1)], total);
    expect(s.ended).toBe(true);
    expect(s.tick).toBe(total);
    expect(s.outcome).toMatchObject({ winner: 'showman', reason: 'time_up', tick: total });
    expect(createState(1).outcome).toBeNull();
  });

  it('validates rope tuning', () => {
    expect(() => validateTuning({ ...TUNING, ropeCutHoldS: 0 })).toThrow('ropeCutHoldS');
    expect(() => validateTuning({ ...TUNING, ropePositions: [[1]] as unknown as [number, number][] })).toThrow('ropePositions');
  });
});

describe('rope cutting (properties)', () => {
  const inputArb: fc.Arbitrary<Input> = fc.oneof(
    fc.record({ player: fc.integer({ min: -1, max: 5 }), kind: fc.constant('cut' as const), rope: fc.integer({ min: -1, max: 4 }) }),
    fc.record({ player: fc.integer({ min: 1, max: 3 }), kind: fc.constant('shield' as const), candle: fc.integer({ min: 0, max: 2 }) }),
    fc.record({ player: fc.integer({ min: 1, max: 3 }), kind: fc.constant('light' as const), candle: fc.integer({ min: 0, max: 2 }) }),
  );

  it('a cut rope never un-cuts, progress stays below the threshold until cut, and the round ends exactly when all are cut or time is up', () => {
    fc.assert(
      fc.property(fc.integer(), fc.array(fc.array(inputArb, { maxLength: 4 }), { minLength: 1, maxLength: 150 }), (seed, ticks) => {
        let prev = atRopes(createState(seed));
        for (const inputs of ticks) {
          const next = step(prev, inputs);
          for (const r of next.ropes) {
            const before = prev.ropes.find((x) => x.id === r.id);
            if (before?.status === 'cut') expect(r.status).toBe('cut');
            expect(r.cutProgressTicks).toBeGreaterThanOrEqual(0);
            expect(r.status === 'cut' || r.cutProgressTicks < NEEDED).toBe(true);
          }
          if (!prev.ended) {
            expect(next.ended).toBe(next.outcome !== null);
          }
          prev = next;
        }
      }),
    );
  });

  it('is deterministic and does not mutate its input', () => {
    fc.assert(
      fc.property(fc.integer(), fc.array(inputArb, { maxLength: 6 }), (seed, inputs) => {
        const s = createState(seed);
        const before = structuredClone(s);
        const a = step(s, inputs);
        expect(s).toEqual(before);
        expect(step(structuredClone(s), structuredClone(inputs))).toEqual(a);
      }),
    );
  });
});
