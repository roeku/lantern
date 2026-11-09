import { describe, expect, it } from 'vitest';
import {
  acceptFan,
  decay,
  isFanned,
  puff,
  spread,
  tickFans,
  zeroFanned,
} from '../../src/sim/smoke';
import type { Fan } from '../../src/sim/state';
import { TUNING, type Tuning } from '../../src/sim/tuning';

const W = TUNING.roomWidthM;
const D = TUNING.roomDepthM;
const idx = (col: number, row: number): number => row * W + col;
const empty = (): number[] => new Array<number>(W * D).fill(0);
const sum = (g: readonly number[]): number => g.reduce((a, b) => a + b, 0);

describe('puff (Req 3.1, 3.2, 3.3, 3.5)', () => {
  it('adds puffDensity to cells within the radius of the vent and nowhere else', () => {
    const grid = empty();
    const out = puff(grid, 0, TUNING);
    // Vent 0 is at (2.5, 6): the cell centred on (2.5, 5.5) is 0.5 m away.
    expect(out[idx(2, 5)]).toBeCloseTo(TUNING.puffDensity, 12);
    // Centre (4.5, 5.5) is sqrt(4.25) m away, outside the 2 m radius.
    expect(out[idx(4, 5)]).toBe(0);
    expect(out[idx(15, 0)]).toBe(0);
    expect(grid.every((v) => v === 0)).toBe(true); // argument not mutated
  });

  it('includes cells exactly on the radius (inclusive)', () => {
    // Vent 1 is at (8, 11): centre (7.5, 10.5) is sqrt(0.5) away; centre (8.5, 9.5) is sqrt(2.5).
    const out = puff(empty(), 1, TUNING);
    expect(out[idx(8, 9)]).toBeCloseTo(TUNING.puffDensity, 12);
    expect(out[idx(8, 8)]).toBe(0); // centre (8.5, 8.5) is sqrt(6.5) away
  });

  it('caps density at 1 on a second puff', () => {
    const once = puff(empty(), 0, TUNING);
    const twice = puff(once, 0, TUNING);
    expect(twice[idx(2, 5)]).toBeCloseTo(2 * TUNING.puffDensity > 1 ? 1 : 2 * TUNING.puffDensity, 12);
    const thrice = puff(twice, 0, TUNING);
    expect(Math.max(...thrice)).toBe(1);
    expect(Math.min(...thrice)).toBe(0);
  });

  it('puffs at a corner without error and only touches in-grid cells', () => {
    const t: Tuning = { ...TUNING, ventPositions: [[0, 0]] };
    const out = puff(empty(), 0, t);
    expect(out).toHaveLength(W * D);
    expect(out[idx(0, 0)]).toBeCloseTo(t.puffDensity, 12);
    expect(out[idx(1, 0)]).toBeCloseTo(t.puffDensity, 12);
    expect(out[idx(1, 1)]).toBe(0); // centre (1.5, 1.5) is sqrt(4.5) away
    expect(out.filter((v) => v > 0)).toHaveLength(3);
  });

  it('ignores an invalid vent', () => {
    const grid = puff(empty(), 0, TUNING);
    for (const vent of [-1, 3, 99, 1.5, Number.NaN]) {
      expect(puff(grid, vent, TUNING)).toEqual(grid);
    }
  });
});

describe('decay and spread (Req 4.1, 4.4, 4.5)', () => {
  it('decay subtracts smokeDecayPerS x tickS and clamps at 0', () => {
    const grid = empty();
    grid[0] = 1;
    grid[1] = 0.001;
    const out = decay(grid, TUNING);
    expect(out[0]).toBeCloseTo(1 - 0.05 * 0.05, 12);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(0);
  });

  it('spread moves k = smokeSpreadPerS x tickS of the difference to each neighbour', () => {
    const k = 0.2 * 0.05;
    const grid = empty();
    grid[idx(5, 5)] = 1;
    const out = spread(grid, TUNING);
    expect(out[idx(5, 5)]).toBeCloseTo(1 - 4 * k, 12);
    for (const [c, r] of [[4, 5], [6, 5], [5, 4], [5, 6]] as const) {
      expect(out[idx(c, r)]).toBeCloseTo(k, 12);
    }
    expect(out[idx(4, 4)]).toBe(0);
    expect(grid[idx(5, 5)]).toBe(1); // argument not mutated
  });

  it('sends no flux across a wall', () => {
    const k = 0.2 * 0.05;
    const grid = empty();
    grid[idx(0, 0)] = 1;
    const corner = spread(grid, TUNING);
    // Only 2 neighbours exist, so the corner loses 2k, not 4k.
    expect(corner[idx(0, 0)]).toBeCloseTo(1 - 2 * k, 12);

    const uniform = new Array<number>(W * D).fill(0.5);
    const out = spread(uniform, TUNING);
    for (const v of out) expect(v).toBeCloseTo(0.5, 12);
  });

  it('conserves total density', () => {
    const grid = Array.from({ length: W * D }, (_, i) => ((i * 37) % 100) / 100);
    let g = grid;
    for (let n = 0; n < 20; n++) g = spread(g, TUNING);
    expect(Math.abs(sum(g) - sum(grid))).toBeLessThan(1e-9);
  });
});

describe('fan (Req 5.1 to 5.6)', () => {
  const full = (): number[] => new Array<number>(W * D).fill(1);
  const fanAt = (ticksLeft: number): Fan => ({ cx: 8, cy: 6, ticksLeft });

  it('clears cells within fanRadiusM on the tick it is accepted', () => {
    const r = acceptFan(full(), [], {}, 1, 8, 6, 0, TUNING);
    expect(r.accepted).toBe(true);
    expect(r.grid[idx(7, 5)]).toBe(0);
    expect(r.grid[idx(8, 6)]).toBe(0);
    expect(r.grid[idx(0, 0)]).toBe(1);
    expect(r.fans).toEqual([{ cx: 8, cy: 6, ticksLeft: 60 }]);
  });

  it('holds fanned cells at 0 when zeroFanned runs after spread', () => {
    const fans = [fanAt(5)];
    const cleared = zeroFanned(full(), fans, TUNING);
    const spreadOut = spread(cleared, TUNING);
    // Neighbours just outside the fan leak smoke into the fanned cells...
    expect(spreadOut[idx(6, 6)]).toBeGreaterThan(0);
    // ...until zeroFanned is applied again.
    const held = zeroFanned(spreadOut, fans, TUNING);
    expect(held[idx(6, 6)]).toBe(0);
    expect(held[idx(8, 6)]).toBe(0);
    expect(held[idx(0, 0)]).toBe(spreadOut[idx(0, 0)]);
  });

  it('holds fanned cells at 0 against a puff', () => {
    const fans = [fanAt(5)];
    const puffed = puff(empty(), 0, { ...TUNING, ventPositions: [[8, 6]] });
    expect(puffed[idx(8, 6)]).toBeGreaterThan(0);
    expect(zeroFanned(puffed, fans, TUNING)[idx(8, 6)]).toBe(0);
  });

  it('releases cells when tickFans expires the fan', () => {
    let fans: Fan[] = [fanAt(2)];
    expect(isFanned(8, 6, fans, TUNING)).toBe(true);
    fans = tickFans(fans);
    expect(fans).toEqual([fanAt(1)]);
    expect(isFanned(8, 6, fans, TUNING)).toBe(true);
    fans = tickFans(fans);
    expect(fans).toEqual([]);
    expect(isFanned(8, 6, fans, TUNING)).toBe(false);
    expect(zeroFanned(full(), fans, TUNING)).toEqual(full());
  });

  it('expires after fanDurationS worth of ticks', () => {
    const r = acceptFan(full(), [], {}, 1, 8, 6, 0, TUNING);
    let fans = r.fans;
    for (let n = 0; n < 59; n++) fans = tickFans(fans);
    expect(fans).toHaveLength(1);
    fans = tickFans(fans);
    expect(fans).toHaveLength(0);
  });

  it('starts a cooldown and ignores a second fan while it runs', () => {
    const first = acceptFan(full(), [], {}, 1, 8, 6, 0, TUNING);
    expect(first.fanReadyTick).toEqual({ '1': 160 });

    const grid = full();
    const second = acceptFan(grid, first.fans, first.fanReadyTick, 1, 2, 2, 10, TUNING);
    expect(second.accepted).toBe(false);
    expect(second.grid).toEqual(grid);
    expect(second.fans).toEqual(first.fans);
    expect(second.fanReadyTick).toEqual(first.fanReadyTick);

    const later = acceptFan(grid, [], first.fanReadyTick, 1, 2, 2, 160, TUNING);
    expect(later.accepted).toBe(true);
    expect(later.fanReadyTick).toEqual({ '1': 320 });
  });

  it('does not let one spectator cooldown block another', () => {
    const first = acceptFan(full(), [], {}, 1, 8, 6, 0, TUNING);
    const other = acceptFan(full(), first.fans, first.fanReadyTick, 2, 2, 2, 1, TUNING);
    expect(other.accepted).toBe(true);
  });

  it('ignores an out-of-room fan and starts no cooldown', () => {
    const grid = full();
    for (const [x, y] of [[-1, 5], [17, 5], [5, -0.1], [5, 12.5], [Number.NaN, 3]]) {
      const r = acceptFan(grid, [], {}, 1, x as number, y as number, 0, TUNING);
      expect(r.accepted).toBe(false);
      expect(r.grid).toEqual(grid);
      expect(r.fans).toEqual([]);
      expect(r.fanReadyTick).toEqual({});
    }
  });
});
