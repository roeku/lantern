import { describe, expect, it } from 'vitest';
import { beamCells } from '../../src/sim/beam';
import { step } from '../../src/sim/step';
import { createState, type CandleStatus, type Input, type State } from '../../src/sim/state';
import { TUNING, type Tuning } from '../../src/sim/tuning';

const T = TUNING;
const SHOWMAN = T.showmanIdDefault;
const AUDIENCE = SHOWMAN + 1;
const AUDIENCE_B = SHOWMAN + 2;

function base(): State {
  return createState(7, T);
}
function withStatus(s: State, id: number, status: CandleStatus): State {
  return { ...s, candles: s.candles.map((c) => (c.id === id ? { ...c, status } : c)) };
}
function statusOf(s: State, id: number): CandleStatus | undefined {
  return s.candles.find((c) => c.id === id)?.status;
}

describe('step input ordering (Req 1.2)', () => {
  it('applies inputs sorted by player id regardless of list order', () => {
    const s = base();
    const a: Input = { player: AUDIENCE_B, kind: 'fan', x: 3, y: 3 };
    const b: Input = { player: AUDIENCE, kind: 'fan', x: 10, y: 8 };
    const r1 = step(s, [a, b]);
    const r2 = step(s, [b, a]);
    expect(r1).toEqual(r2);
    expect(r1.fans.map((f) => [f.cx, f.cy])).toEqual([
      [10, 8],
      [3, 3],
    ]);
  });

  it('keeps list order for inputs from the same player (last aim wins)', () => {
    const s = base();
    const r = step(s, [
      { player: SHOWMAN, kind: 'aim', angle: 1 },
      { player: SHOWMAN, kind: 'aim', angle: 2 },
    ]);
    expect(r.beam.angle).toBe(2);
    const r2 = step(s, [
      { player: SHOWMAN, kind: 'aim', angle: 2 },
      { player: SHOWMAN, kind: 'aim', angle: 1 },
    ]);
    expect(r2.beam.angle).toBe(1);
  });

  it('keeps list order for same-player fans (first accepted, second blocked by cooldown)', () => {
    const r = step(base(), [
      { player: AUDIENCE, kind: 'fan', x: 4, y: 4 },
      { player: AUDIENCE, kind: 'fan', x: 9, y: 9 },
    ]);
    expect(r.fans).toHaveLength(1);
    expect([r.fans[0]!.cx, r.fans[0]!.cy]).toEqual([4, 4]);
  });

  it('records snuff ids in player-id order, list order within a player', () => {
    const r = step(base(), [
      { player: AUDIENCE_B, kind: 'snuff', eventId: 'c', candle: 2 },
      { player: AUDIENCE, kind: 'snuff', eventId: 'a', candle: 0 },
      { player: AUDIENCE, kind: 'snuff', eventId: 'b', candle: 1 },
    ]);
    expect(r.appliedSnuffIds).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate its inputs', () => {
    const s = base();
    const frozen = structuredClone(s);
    const inputs: Input[] = [
      { player: AUDIENCE, kind: 'fan', x: 3, y: 3 },
      { player: SHOWMAN, kind: 'puff', vent: 0 },
    ];
    const inputsCopy = structuredClone(inputs);
    step(s, inputs);
    expect(s).toEqual(frozen);
    expect(inputs).toEqual(inputsCopy);
  });
});

describe('step role enforcement (Req 1.3, 1.4)', () => {
  it('ignores puff, roll, rush and aim from a non-showman', () => {
    const s = base();
    const noop = step(s, []);
    const r = step(s, [
      { player: AUDIENCE, kind: 'puff', vent: 0 },
      { player: AUDIENCE, kind: 'roll', dir: 1 },
      { player: AUDIENCE, kind: 'rush', dir: 1 },
      { player: AUDIENCE, kind: 'aim', angle: 1 },
    ]);
    expect(r).toEqual(noop);
  });

  it('applies puff, roll and aim from the showman', () => {
    const s = base();
    const r = step(s, [
      { player: SHOWMAN, kind: 'puff', vent: 0 },
      { player: SHOWMAN, kind: 'roll', dir: 1 },
      { player: SHOWMAN, kind: 'aim', angle: 1 },
    ]);
    expect(r.grid.some((d) => d > 0)).toBe(true);
    expect(r.cart.travel).toBeCloseTo(T.cartRollSpeedMps * T.tickS);
    expect(r.beam.angle).toBe(1);
  });

  it('ignores fan, shield, unshield and light from the showman', () => {
    let s = base();
    s = withStatus(s, 0, 'shielded');
    const noop = step(s, []);
    const r = step(s, [
      { player: SHOWMAN, kind: 'fan', x: 3, y: 3 },
      { player: SHOWMAN, kind: 'shield', candle: 1 },
      { player: SHOWMAN, kind: 'unshield', candle: 0 },
      { player: SHOWMAN, kind: 'light', candle: 0 },
    ]);
    expect(r).toEqual(noop);
    expect(r.fans).toEqual([]);
    expect(statusOf(r, 0)).toBe('shielded');
    expect(statusOf(r, 1)).toBe('lit');
  });

  it('applies shield, unshield and light from a non-showman', () => {
    let s = base();
    s = withStatus(s, 1, 'shielded');
    const r = step(s, [
      { player: AUDIENCE, kind: 'shield', candle: 0 },
      { player: AUDIENCE_B, kind: 'light', candle: 1 },
    ]);
    expect(statusOf(r, 0)).toBe('shielded');
    expect(statusOf(r, 1)).toBe('lit');
    const r2 = step(r, [{ player: AUDIENCE, kind: 'unshield', candle: 0 }]);
    expect(statusOf(r2, 0)).toBe('lit');
  });

  it('ignores shield, unshield and light aimed at another Spectator\'s candle', () => {
    const s = withStatus(base(), 1, 'shielded');
    const r = step(s, [
      { player: AUDIENCE, kind: 'shield', candle: 2 },
      { player: AUDIENCE, kind: 'light', candle: 1 },
      { player: AUDIENCE, kind: 'unshield', candle: 1 },
    ]);
    expect(statusOf(r, 1)).toBe('shielded');
    expect(statusOf(r, 2)).toBe('lit');
  });

  it('ignores fan from a Spectator whose candle is snuffed', () => {
    const s = withStatus(base(), 0, 'snuffed');
    const r = step(s, [{ player: AUDIENCE, kind: 'fan', x: 3, y: 3 }]);
    expect(r.fans).toEqual([]);
  });
});

describe('step ended state (Req 1.9)', () => {
  it('returns a deep-equal new object with tick and rng unchanged', () => {
    const s: State = { ...base(), ended: true, tick: 5 };
    const r = step(s, [
      { player: SHOWMAN, kind: 'puff', vent: 0 },
      { player: AUDIENCE, kind: 'fan', x: 3, y: 3 },
    ]);
    expect(r).toEqual(s);
    expect(r).not.toBe(s);
    expect(r.grid).not.toBe(s.grid);
    expect(r.tick).toBe(5);
    expect(r.rng).toBe(s.rng);
  });
});

describe('step RNG (Req 1.10)', () => {
  it('leaves the RNG state unchanged because no rule draws', () => {
    const s = base();
    const r = step(s, [
      { player: SHOWMAN, kind: 'puff', vent: 1 },
      { player: SHOWMAN, kind: 'roll', dir: 1 },
      { player: AUDIENCE, kind: 'fan', x: 5, y: 5 },
      { player: AUDIENCE, kind: 'snuff', eventId: 'e', candle: 0 },
    ]);
    expect(r.rng).toBe(s.rng);
  });
});

describe('step round end (Req 1.9)', () => {
  const short: Tuning = { ...T, tickS: 0.25, showLengthS: 1 };
  const total = short.showLengthS / short.tickS;

  it('ends exactly when tick reaches showLengthS / tickS', () => {
    let s = createState(1, short);
    for (let i = 1; i < total; i++) {
      s = step(s, [], short);
      expect(s.tick).toBe(i);
      expect(s.ended).toBe(false);
    }
    s = step(s, [], short);
    expect(s.tick).toBe(total);
    expect(s.ended).toBe(true);
    const after = step(s, [], short);
    expect(after.tick).toBe(total);
    expect(after).toEqual(s);
  });
});

describe('createState with invalid tuning (Req 11.3)', () => {
  it('throws an error naming the invalid field', () => {
    expect(() => createState(1, { ...T, tickS: 0 })).toThrow(/tickS/);
    expect(() => createState(1, { ...T, roomWidthM: 1.5 })).toThrow(/roomWidthM/);
    expect(() => createState(1, { ...T, ventPositions: [[1, Number.NaN]] })).toThrow(/ventPositions/);
  });
});

describe('step aim (Req 1.2)', () => {
  it('ignores non-finite angles', () => {
    const s = base();
    for (const angle of [Number.NaN, Infinity, -Infinity]) {
      const r = step(s, [{ player: SHOWMAN, kind: 'aim', angle }]);
      expect(r.beam.angle).toBe(s.beam.angle);
    }
  });

  it('normalises the angle into [0, 2pi)', () => {
    const s = base();
    const full = 2 * Math.PI;
    const neg = step(s, [{ player: SHOWMAN, kind: 'aim', angle: -Math.PI / 2 }]);
    expect(neg.beam.angle).toBeCloseTo((3 * Math.PI) / 2);
    const big = step(s, [{ player: SHOWMAN, kind: 'aim', angle: 5 * Math.PI / 2 }]);
    expect(big.beam.angle).toBeCloseTo(Math.PI / 2);
    for (const r of [neg, big]) {
      expect(r.beam.angle).toBeGreaterThanOrEqual(0);
      expect(r.beam.angle).toBeLessThan(full);
    }
  });
});

describe('step puff and cart', () => {
  it('ignores a puff to a missing vent', () => {
    const s = base();
    const noop = step(s, []);
    for (const vent of [-1, T.ventPositions.length, 0.5, Number.NaN]) {
      expect(step(s, [{ player: SHOWMAN, kind: 'puff', vent }])).toEqual(noop);
    }
  });

  it('lets rush win over roll', () => {
    const s: State = { ...base(), cart: { travel: 4, speedMps: 0 } };
    const r = step(s, [
      { player: SHOWMAN, kind: 'roll', dir: 1 },
      { player: SHOWMAN, kind: 'rush', dir: -1 },
    ]);
    expect(r.cart.travel).toBeCloseTo(4 - T.cartRushSpeedMps * T.tickS);
    expect(r.cart.speedMps).toBeCloseTo(T.cartRushSpeedMps);
  });

  it('ignores a roll with an invalid direction', () => {
    const s = base();
    const bad = { player: SHOWMAN, kind: 'roll', dir: 2 } as unknown as Input;
    expect(step(s, [bad])).toEqual(step(s, []));
  });
});

describe('step snuff (Req 3.6)', () => {
  it('routes snuff inputs through applySnuffEvent and is idempotent per event id', () => {
    const s = base();
    const once = step(s, [{ player: AUDIENCE, kind: 'snuff', eventId: 'x', candle: 0 }]);
    expect(statusOf(once, 0)).toBe('snuffed');
    expect(once.snuffedCount).toBe(1);
    expect(once.appliedSnuffIds).toEqual(['x']);
    const twice = step(once, [{ player: AUDIENCE, kind: 'snuff', eventId: 'x', candle: 0 }]);
    expect(twice.snuffedCount).toBe(1);
    expect(twice.appliedSnuffIds).toEqual(['x']);
    const dup = step(s, [
      { player: AUDIENCE, kind: 'snuff', eventId: 'x', candle: 0 },
      { player: AUDIENCE_B, kind: 'snuff', eventId: 'x', candle: 1 },
    ]);
    expect(statusOf(dup, 0)).toBe('snuffed');
    expect(statusOf(dup, 1)).toBe('lit');
    expect(dup.snuffedCount).toBe(1);
  });

  it('ignores a snuff for a missing candle', () => {
    const r = step(base(), [{ player: AUDIENCE, kind: 'snuff', eventId: 'x', candle: 99 }]);
    expect(r.snuffedCount).toBe(0);
    expect(r.appliedSnuffIds).toEqual([]);
  });

  it('snuffs a candle by contact with a solid ghost within the step', () => {
    const s0 = base();
    const cells = beamCells(s0, T);
    const first = cells[0]!;
    const candle = { id: 0, x: first.col + 0.5, y: first.row + 0.5, status: 'lit' as const };
    const s: State = {
      ...s0,
      grid: new Array<number>(s0.grid.length).fill(1),
      candles: [candle, ...s0.candles.slice(1).map((c) => ({ ...c, x: 0.1, y: 0.1 + c.id * 0.01 }))],
      spectators: s0.spectators.map((sp) =>
        sp.candleId === 0 ? { ...sp, x: candle.x, y: candle.y } : { ...sp, x: 0.1, y: 0.1 + sp.candleId * 0.01 },
      ),
    };
    const r = step(s, []);
    expect(r.ghost).not.toBeNull();
    expect(r.ghost!.solid).toBe(true);
    expect(statusOf(r, 0)).toBe('snuffed');
    expect(r.snuffedCount).toBeGreaterThanOrEqual(1);
    expect(r.appliedSnuffIds).toContain('0:0');
  });

  it('does not snuff by contact when there is no smoke', () => {
    const r = step(base(), []);
    expect(r.ghost).toBeNull();
    expect(r.snuffedCount).toBe(0);
  });
});
