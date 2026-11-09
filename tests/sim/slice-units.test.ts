import { describe, expect, it } from 'vitest';
import { applySnuffEvent } from '../../src/sim/candles';
import { applyMoves, lightRadiusM, ownsCandle } from '../../src/sim/spectators';
import { createState, type Input, type State } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { TUNING, validateTuning, type Tuning } from '../../src/sim/tuning';

const bad = (patch: Record<string, unknown>): Tuning => ({ ...TUNING, ...patch }) as unknown as Tuning;

describe('slice tuning values and validation', () => {
  it('has the design starting values for the slice fields', () => {
    expect(TUNING.ropeCutHoldS).toBe(4);
    expect(TUNING.ropeCutRadiusM).toBe(1);
    expect(TUNING.litCandleRadiusM).toBe(3);
    expect(TUNING.shieldedCandleRadiusM).toBe(1);
    expect(TUNING.spectatorSpeedMps).toBe(3);
    expect(TUNING.ropeCount).toBe(TUNING.ropePositions.length);
    expect(TUNING.spectatorStartPositions).toHaveLength(3);
  });

  it.each([
    ['ropeCount', bad({ ropeCount: 0 })],
    ['ropeCount', bad({ ropeCount: 2.5 })],
    ['ropePositions', bad({ ropeCount: 4 })],
    ['ropePositions', bad({ ropePositions: [[1, 1], [2, 2], [3, TUNING.roomDepthM + 1]] })],
    ['spectatorStartPositions', bad({ spectatorStartPositions: [[1, 1]] })],
    ['spectatorStartPositions', bad({ spectatorStartPositions: [[1, 1], [2, 2], [-1, 3]] })],
    ['ropeCutHoldS', bad({ ropeCutHoldS: Number.NaN })],
    ['ropeCutRadiusM', bad({ ropeCutRadiusM: -1 })],
    ['litCandleRadiusM', bad({ litCandleRadiusM: undefined })],
    ['shieldedCandleRadiusM', bad({ shieldedCandleRadiusM: '1' })],
    ['spectatorSpeedMps', bad({ spectatorSpeedMps: 0 })],
    ['fanReachM', bad({ fanReachM: 0 })],
    ['nearMissRadiusM', bad({ nearMissRadiusM: -0.5 })],
  ])('rejects bad %s by name', (field, tuning) => {
    expect(() => validateTuning(tuning)).toThrow(`"${field}"`);
    expect(() => createState(1, tuning)).toThrow(`"${field}"`);
  });
});

describe('createState with showmanId', () => {
  it('uses the other seats as Spectators in ascending order, candle N owned by Spectator N', () => {
    const s = createState(1, TUNING, { showmanId: 2 });
    expect(s.showmanId).toBe(2);
    expect(s.spectators.map((sp) => sp.player)).toEqual([0, 1, 3]);
    expect(s.spectators.map((sp) => sp.candleId)).toEqual([0, 1, 2]);
    s.spectators.forEach((sp, i) => {
      expect([sp.x, sp.y]).toEqual(TUNING.spectatorStartPositions[i]);
      expect([s.candles[i]?.x, s.candles[i]?.y]).toEqual([sp.x, sp.y]);
    });
    expect(s.ropes).toHaveLength(TUNING.ropeCount);
    expect(s.outcome).toBeNull();
  });

  it('defaults the Showman to seat 0', () => {
    expect(createState(1).spectators.map((sp) => sp.player)).toEqual([1, 2, 3]);
  });
});

describe('lightRadiusM', () => {
  it('maps status to radius', () => {
    expect(lightRadiusM('lit')).toBe(TUNING.litCandleRadiusM);
    expect(lightRadiusM('shielded')).toBe(TUNING.shieldedCandleRadiusM);
    expect(lightRadiusM('snuffed')).toBe(0);
  });
});

describe('audience movement', () => {
  it('a snuffed Spectator keeps moving, and the candle follows', () => {
    const s = applySnuffEvent(createState(1), 0, 'e1');
    expect(s.candles[0]?.status).toBe('snuffed');
    const moved = applyMoves(s, [{ player: 1, kind: 'move', dx: 0, dy: 1 }]);
    const stepM = TUNING.spectatorSpeedMps * TUNING.tickS;
    expect(moved.spectators[0]?.y).toBeCloseTo((s.spectators[0]?.y ?? 0) + stepM, 9);
    expect(moved.candles[0]?.y).toBe(moved.spectators[0]?.y);
  });

  it('works through step too', () => {
    const s = applySnuffEvent(createState(1), 0, 'e1');
    const after = step(s, [{ player: 1, kind: 'move', dx: 1, dy: 0 }]);
    expect(after.spectators[0]?.x).toBeGreaterThan(s.spectators[0]?.x ?? 0);
  });
});

describe('ownership checks', () => {
  const s = createState(1);
  it('ownsCandle is true only for the owning Spectator', () => {
    expect(ownsCandle(s, 1, 0)).toBe(true);
    expect(ownsCandle(s, 1, 1)).toBe(false);
    expect(ownsCandle(s, 0, 0)).toBe(false); // Showman
    expect(ownsCandle(s, 9, 0)).toBe(false);
  });

  it('step ignores shield and light on a candle the sender does not own', () => {
    const shielded = step(s, [{ player: 2, kind: 'shield', candle: 0 }]);
    expect(shielded.candles[0]?.status).toBe('lit');
    const own = step(s, [{ player: 1, kind: 'shield', candle: 0 }]);
    expect(own.candles[0]?.status).toBe('shielded');
    const stolen = step(own, [{ player: 2, kind: 'unshield', candle: 0 }]);
    expect(stolen.candles[0]?.status).toBe('shielded');
  });
});

describe('fan from a snuffed Spectator', () => {
  it('is ignored: no fan, no cooldown', () => {
    const s = applySnuffEvent(createState(1), 0, 'e1');
    const after = step(s, [{ player: 1, kind: 'fan', x: 5, y: 5 }]);
    expect(after.fans).toEqual([]);
    expect(after.fanReadyTick).toEqual({});
  });

  it('a lit Spectator can still fan', () => {
    const after = step(createState(1), [{ player: 1, kind: 'fan', x: 5, y: 5 }]);
    expect(after.fans).toHaveLength(1);
  });
});

describe('same-tick rope and snuff tie', () => {
  it('the Spectators win when the last rope is cut and the last candle is snuffed on one tick', () => {
    const needed = Math.round(TUNING.ropeCutHoldS / TUNING.tickS);
    const base = createState(1);
    const smoky: State = { ...base, grid: base.grid.map(() => 1) };
    const ghost = step(smoky, []).ghost;
    if (ghost === null) throw new Error('expected a ghost');
    const x = ghost.col + 0.5;
    const y = ghost.row + 0.5;
    const tie: State = {
      ...smoky,
      spectators: smoky.spectators.map((sp) => (sp.candleId === 0 ? { ...sp, x, y } : sp)),
      candles: smoky.candles.map((c) =>
        c.id === 0 ? { ...c, x, y } : { ...c, status: 'snuffed' as const },
      ),
      ropes: smoky.ropes.map((r) =>
        r.id === 0
          ? { ...r, x, y, cutProgressTicks: needed - 1 }
          : { ...r, status: 'cut' as const, cutTick: 0, cutProgressTicks: needed },
      ),
    };
    const cutInput: Input = { player: 1, kind: 'cut', rope: 0 };
    const after = step(tie, [cutInput]);
    expect(after.candles.every((c) => c.status === 'snuffed')).toBe(true);
    expect(after.ropes.every((r) => r.status === 'cut')).toBe(true);
    expect(after.ended).toBe(true);
    expect(after.outcome).toEqual({ winner: 'spectators', reason: 'all_ropes_cut', tick: tie.tick + 1 });
  });
});

describe('JSON round trip of the new State', () => {
  it('survives after play, including ropes, spectators and outcome', () => {
    let s = createState(7, TUNING, { showmanId: 3 });
    s = step(s, [
      { player: 0, kind: 'move', dx: 1, dy: 1 },
      { player: 0, kind: 'cut', rope: 0 },
    ]);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    const ended: State = { ...s, ended: true, outcome: { winner: 'showman', reason: 'time_up', tick: s.tick } };
    expect(JSON.parse(JSON.stringify(ended))).toEqual(ended);
  });
});
