import { describe, expect, it } from 'vitest';
import { beamCells } from '../../src/sim/beam';
import { imageScale } from '../../src/sim/cart';
import {
  applySnuffEvent,
  lightCandle,
  shieldCandle,
  snuffByContact,
  unshieldCandle,
} from '../../src/sim/candles';
import { placeGhost, scaledThreshold } from '../../src/sim/ghost';
import { createState, type CandleStatus, type State } from '../../src/sim/state';
import { TUNING } from '../../src/sim/tuning';

const T = TUNING;
const W = T.roomWidthM;

function base(): State {
  return createState(1, T);
}

function withStatus(s: State, id: number, status: CandleStatus): State {
  return { ...s, candles: s.candles.map((c) => (c.id === id ? { ...c, status } : c)) };
}

function statusOf(s: State, id: number): CandleStatus | undefined {
  return s.candles.find((c) => c.id === id)?.status;
}

describe('placeGhost', () => {
  const s0 = base();
  const scale = imageScale(s0.cart.travel, T);
  const threshold = scaledThreshold(scale, T);
  const cells = beamCells(s0, T);

  function withDensity(state: State, idx: number, d: number): State {
    const c = cells[idx]!;
    const grid = state.grid.slice();
    grid[c.row * W + c.col] = d;
    return { ...state, grid };
  }

  it('has beam cells to test against', () => {
    expect(cells.length).toBeGreaterThan(1);
  });

  it('places a solid ghost at density exactly equal to the threshold (Req 8.2, 8.4)', () => {
    const g = placeGhost(withDensity(s0, 0, threshold), T);
    expect(g).toEqual({ col: cells[0]!.col, row: cells[0]!.row, density: threshold, solid: true });
  });

  it('places no ghost just below the threshold (Req 8.3)', () => {
    const below = threshold - 1e-9;
    expect(placeGhost(withDensity(s0, 0, below), T)).toBeNull();
  });

  it('reports no ghost when no beam cell has smoke (Req 8.3)', () => {
    expect(placeGhost(s0, T)).toBeNull();
  });

  it('ignores dense cells that are off the beam (Req 8.3)', () => {
    const onBeam = new Set(cells.map((c) => c.row * W + c.col));
    const grid = s0.grid.map((_, i) => (onBeam.has(i) ? 0 : 1));
    expect(placeGhost({ ...s0, grid }, T)).toBeNull();
  });

  it('picks the first qualifying cell along the beam, skipping thin ones (Req 8.2)', () => {
    let s = withDensity(s0, 0, threshold / 2);
    s = withDensity(s, 1, threshold);
    s = withDensity(s, 2, 1);
    const g = placeGhost(s, T);
    expect(g?.col).toBe(cells[1]!.col);
    expect(g?.row).toBe(cells[1]!.row);
  });

  it('reports no ghost in a fanned cell despite density (Req 8.5)', () => {
    const c = cells[0]!;
    const s = withDensity(s0, 0, 1);
    const fanned: State = { ...s, fans: [{ cx: c.col + 0.5, cy: c.row + 0.5, ticksLeft: 5 }] };
    // Other beam cells are empty, and any within the fan radius are zero.
    expect(placeGhost(fanned, T)).toBeNull();
  });

  it('treats an expired fan (ticksLeft 0) as not fanned (Req 8.5)', () => {
    const c = cells[0]!;
    const s = withDensity(s0, 0, 1);
    const expired: State = { ...s, fans: [{ cx: c.col + 0.5, cy: c.row + 0.5, ticksLeft: 0 }] };
    expect(placeGhost(expired, T)?.solid).toBe(true);
  });

  it('does not mutate the state (Req 8.2)', () => {
    const s = withDensity(s0, 0, 1);
    const copy = structuredClone(s);
    placeGhost(s, T);
    expect(s).toEqual(copy);
  });
});

describe('candle transitions', () => {
  it('shields a lit candle (Req 9.2)', () => {
    const s = base();
    const n = shieldCandle(s, 0);
    expect(statusOf(n, 0)).toBe('shielded');
    expect(statusOf(s, 0)).toBe('lit');
    expect(statusOf(n, 1)).toBe('lit');
  });

  it('unshields and lights a shielded candle (Req 9.3)', () => {
    const shielded = withStatus(base(), 0, 'shielded');
    expect(statusOf(unshieldCandle(shielded, 0), 0)).toBe('lit');
    expect(statusOf(lightCandle(shielded, 0), 0)).toBe('lit');
  });

  it('leaves state unchanged for redundant transitions (Req 9.4)', () => {
    const lit = base();
    expect(unshieldCandle(lit, 0)).toEqual(lit);
    expect(lightCandle(lit, 0)).toEqual(lit);
    const shielded = withStatus(base(), 0, 'shielded');
    expect(shieldCandle(shielded, 0)).toEqual(shielded);
  });

  it('keeps a snuffed candle snuffed (Req 9.5)', () => {
    const s = withStatus(base(), 0, 'snuffed');
    expect(shieldCandle(s, 0)).toEqual(s);
    expect(unshieldCandle(s, 0)).toEqual(s);
    expect(lightCandle(s, 0)).toEqual(s);
  });

  it('ignores a missing candle', () => {
    const s = base();
    expect(shieldCandle(s, 99)).toEqual(s);
  });
});

describe('snuffByContact', () => {
  // Candle 0 at (4, 9). Put the ghost in cell (col 4, row 9): centre (4.5, 9.5).
  function ghostState(col: number, row: number, solid = true): State {
    return { ...base(), ghost: { col, row, density: 1, solid } };
  }
  const scale = 1;
  const radius = T.snuffRadiusBaseM * scale;

  it('snuffs a candle at exactly the radius (Req 9.6)', () => {
    // Ghost centre (4.5, 9.5); candle placed exactly `radius` away along x.
    const s = ghostState(4, 9);
    const placed: State = {
      ...s,
      candles: s.candles.map((c) => (c.id === 0 ? { ...c, x: 4.5 - radius, y: 9.5 } : c)),
    };
    // Use a radius that is exactly representable by choosing scale so distance == radius.
    const dist = Math.hypot(placed.candles[0]!.x - 4.5, placed.candles[0]!.y - 9.5);
    const n = snuffByContact(placed, dist / T.snuffRadiusBaseM, T);
    expect(statusOf(n, 0)).toBe('snuffed');
  });

  it('does not snuff just beyond the radius (Req 9.8)', () => {
    const s = ghostState(4, 9);
    const placed: State = {
      ...s,
      candles: s.candles.map((c) => (c.id === 0 ? { ...c, x: 4.5 - radius - 1e-6, y: 9.5 } : c)),
    };
    const n = snuffByContact(placed, scale, T);
    expect(n).toEqual(placed);
  });

  it('uses the scale parameter to widen the radius (Req 9.6, 9.8)', () => {
    const s = ghostState(4, 9);
    const gap = 0.9;
    const placed: State = {
      ...s,
      candles: s.candles.map((c) => (c.id === 0 ? { ...c, x: 4.5 - gap, y: 9.5 } : c)),
    };
    expect(statusOf(snuffByContact(placed, 1, T), 0)).toBe('lit');
    expect(statusOf(snuffByContact(placed, 1.5, T), 0)).toBe('snuffed');
  });

  it('snuffs a shielded candle in range (Req 9.6)', () => {
    const s = withStatus(ghostState(4, 9), 0, 'shielded');
    const placed: State = {
      ...s,
      candles: s.candles.map((c) => (c.id === 0 ? { ...c, x: 4.5, y: 9.5 } : c)),
    };
    const n = snuffByContact(placed, scale, T);
    expect(statusOf(n, 0)).toBe('snuffed');
    expect(n.snuffedCount).toBe(1);
  });

  it('does nothing for a non-solid ghost or no ghost (Req 9.7)', () => {
    const s = ghostState(4, 9, false);
    const placed: State = {
      ...s,
      candles: s.candles.map((c) => (c.id === 0 ? { ...c, x: 4.5, y: 9.5 } : c)),
    };
    expect(snuffByContact(placed, scale, T)).toEqual(placed);
    expect(snuffByContact(base(), scale, T)).toEqual(base());
  });

  it('records counts and event ids, and does not re-snuff (Req 10.1)', () => {
    const s = ghostState(4, 9);
    const placed: State = {
      ...s,
      tick: 7,
      candles: s.candles.map((c) => (c.id === 0 ? { ...c, x: 4.5, y: 9.5 } : c)),
    };
    const n = snuffByContact(placed, scale, T);
    expect(n.snuffedCount).toBe(1);
    expect(n.appliedSnuffIds).toEqual(['7:0']);
    expect(snuffByContact(n, scale, T)).toEqual(n);
  });
});

describe('applySnuffEvent', () => {
  it('snuffs the candle, counts it and records the id (Req 10.1)', () => {
    const s = base();
    const n = applySnuffEvent(s, 1, 'e1');
    expect(statusOf(n, 1)).toBe('snuffed');
    expect(n.snuffedCount).toBe(1);
    expect(n.appliedSnuffIds).toEqual(['e1']);
    expect(s.snuffedCount).toBe(0);
    expect(s.appliedSnuffIds).toEqual([]);
  });

  it('snuffs a shielded candle (Req 9.6)', () => {
    const n = applySnuffEvent(withStatus(base(), 1, 'shielded'), 1, 'e1');
    expect(statusOf(n, 1)).toBe('snuffed');
  });

  it('leaves state unchanged for a duplicate event id (Req 10.3)', () => {
    const once = applySnuffEvent(base(), 0, 'e1');
    expect(applySnuffEvent(once, 1, 'e1')).toEqual(once);
  });

  it('leaves state unchanged for an already snuffed candle (Req 10.2)', () => {
    const once = applySnuffEvent(base(), 0, 'e1');
    expect(applySnuffEvent(once, 0, 'e2')).toEqual(once);
  });

  it('leaves state unchanged for a missing candle (Req 10.4)', () => {
    const s = base();
    expect(applySnuffEvent(s, 42, 'e1')).toEqual(s);
  });

  it('applying twice equals applying once (Req 10.5)', () => {
    const once = applySnuffEvent(base(), 2, 'e9');
    expect(applySnuffEvent(once, 2, 'e9')).toEqual(once);
  });
});
