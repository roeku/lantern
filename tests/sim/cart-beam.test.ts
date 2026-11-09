import { describe, expect, it } from 'vitest';
import { beamCells, beamOrigin, normaliseAngle } from '../../src/sim/beam';
import { imageScale, moveCart } from '../../src/sim/cart';
import { createState } from '../../src/sim/state';
import { TUNING, type Tuning } from '../../src/sim/tuning';

const T = TUNING;
const rollStep = T.cartRollSpeedMps * T.tickS;
const rushStep = T.cartRushSpeedMps * T.tickS;

describe('moveCart', () => {
  it('rolls by rollSpeed x tickS in either direction (Req 6.2)', () => {
    const up = moveCart({ travel: 4, speedMps: 0 }, 1, null, T);
    expect(up.travel).toBeCloseTo(4 + rollStep, 12);
    const down = moveCart({ travel: 4, speedMps: 0 }, -1, null, T);
    expect(down.travel).toBeCloseTo(4 - rollStep, 12);
  });

  it('rushes by rushSpeed x tickS in either direction (Req 6.3)', () => {
    expect(moveCart({ travel: 4, speedMps: 0 }, null, 1, T).travel).toBeCloseTo(4 + rushStep, 12);
    expect(moveCart({ travel: 4, speedMps: 0 }, null, -1, T).travel).toBeCloseTo(4 - rushStep, 12);
  });

  it('clamps at the upper bound (Req 6.4)', () => {
    const c = moveCart({ travel: T.cartTravelMaxM - 0.01, speedMps: 0 }, null, 1, T);
    expect(c.travel).toBe(T.cartTravelMaxM);
    expect(c.speedMps).toBeCloseTo(0.01 / T.tickS, 9);
  });

  it('clamps at the lower bound (Req 6.4)', () => {
    const c = moveCart({ travel: 0.01, speedMps: 0 }, -1, null, T);
    expect(c.travel).toBe(0);
    expect(c.speedMps).toBeCloseTo(0.01 / T.tickS, 9);
    const atEdge = moveCart({ travel: 0, speedMps: 0 }, null, -1, T);
    expect(atEdge).toEqual({ travel: 0, speedMps: 0 });
  });

  it('applies only rush when roll and rush are both present (Req 6.5)', () => {
    const c = moveCart({ travel: 4, speedMps: 0 }, -1, 1, T);
    expect(c.travel).toBeCloseTo(4 + rushStep, 12);
  });

  it('leaves travel unchanged and reports speed 0 with no movement (Req 6.6)', () => {
    expect(moveCart({ travel: 3, speedMps: 7 }, null, null, T)).toEqual({ travel: 3, speedMps: 0 });
  });

  it('reports speed as abs travel change / tickS (Req 6.8)', () => {
    expect(moveCart({ travel: 4, speedMps: 0 }, 1, null, T).speedMps).toBeCloseTo(T.cartRollSpeedMps, 9);
    expect(moveCart({ travel: 4, speedMps: 0 }, null, -1, T).speedMps).toBeCloseTo(T.cartRushSpeedMps, 9);
  });

  it('does not mutate its input', () => {
    const cart = { travel: 4, speedMps: 0 };
    moveCart(cart, 1, 1, T);
    expect(cart).toEqual({ travel: 4, speedMps: 0 });
  });
});

describe('imageScale', () => {
  it('maps the ends to min and max (Req 6.7)', () => {
    expect(imageScale(0, T)).toBeCloseTo(T.imageScaleMin, 12);
    expect(imageScale(T.cartTravelMaxM, T)).toBeCloseTo(T.imageScaleMax, 12);
  });

  it('is strictly increasing across [0, cartTravelMaxM] (Req 6.7)', () => {
    let prev = -Infinity;
    for (let i = 0; i <= 80; i++) {
      const s = imageScale((i / 80) * T.cartTravelMaxM, T);
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });
});

describe('normaliseAngle', () => {
  const TWO_PI = Math.PI * 2;

  it('leaves in-range angles alone (Req 7.1)', () => {
    expect(normaliseAngle(0)).toBe(0);
    expect(normaliseAngle(1.5)).toBeCloseTo(1.5, 12);
  });

  it('wraps negative and large angles into [0, 2pi) (Req 7.1)', () => {
    expect(normaliseAngle(-Math.PI / 2)).toBeCloseTo(1.5 * Math.PI, 12);
    expect(normaliseAngle(TWO_PI)).toBe(0);
    expect(normaliseAngle(5 * TWO_PI + 1)).toBeCloseTo(1, 9);
    for (const a of [-1e-18, -TWO_PI, -100, 100, 1e6]) {
      const n = normaliseAngle(a);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(TWO_PI);
    }
  });
});

describe('beamCells', () => {
  // Origin at the centre of cell (8, 2): a wide cone sees every neighbour.
  const wide: Tuning = {
    ...T,
    cartOriginXM: 8.5,
    cartTrackStartYM: 2.5,
    beamHalfAngleRad: Math.PI,
  };

  it('orders by distance, then row, then column (Req 7.5)', () => {
    const state = createState(1, wide);
    const reach1: Tuning = { ...wide, placeholderSlideReachM: 1 };
    const cells = beamCells(state, reach1);
    expect(cells.map((c) => [c.col, c.row])).toEqual([
      [8, 1],
      [7, 2],
      [9, 2],
      [8, 3],
    ]);
    expect(cells.every((c) => c.distance === 1)).toBe(true);
  });

  it('is ascending by distance over the whole room (Req 7.5)', () => {
    const cells = beamCells(createState(1, wide), wide);
    for (let i = 1; i < cells.length; i++) {
      const a = cells[i - 1]!;
      const b = cells[i]!;
      const key = (a.distance - b.distance) || (a.row - b.row) || (a.col - b.col);
      expect(key).toBeLessThan(0);
    }
  });

  it('breaks ties by column when row and distance match (Req 7.5)', () => {
    // Default origin x = 8 is a cell edge, so columns 7 and 8 are mirror images.
    const state = createState(1);
    const cells = beamCells(state, T);
    const row5 = cells.filter((c) => c.row === 5).map((c) => c.col);
    expect(row5).toEqual([7, 8]);
  });

  it('is empty when the origin is outside the room (Req 7.7)', () => {
    const state = createState(1);
    expect(beamCells(state, { ...T, cartOriginXM: -1 })).toEqual([]);
    expect(beamCells(state, { ...T, cartOriginXM: T.roomWidthM + 1 })).toEqual([]);
    expect(beamCells(state, { ...T, cartTrackStartYM: -1 })).toEqual([]);
    expect(beamCells(state, { ...T, cartTrackStartYM: T.roomDepthM + 1 })).toEqual([]);
  });

  it('derives the origin from cart travel (Req 7.3)', () => {
    const state = { ...createState(1), cart: { travel: 3, speedMps: 0 } };
    expect(beamOrigin(state, T)).toEqual({ x: T.cartOriginXM, y: T.cartTrackStartYM + 3 });
  });

  it('keeps only cells inside the cone (Req 7.4)', () => {
    const state = createState(1);
    const { x, y } = beamOrigin(state, T);
    const cells = beamCells(state, T);
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) {
      const ang = Math.atan2(c.row + 0.5 - y, c.col + 0.5 - x);
      expect(Math.abs(ang - state.beam.angle)).toBeLessThanOrEqual(T.beamHalfAngleRad);
    }
    // On the axis: included. Far off to the side: excluded.
    expect(cells.some((c) => c.col === 8 && c.row === 8)).toBe(true);
    expect(cells.some((c) => c.col === 13 && c.row === 3)).toBe(false);
    // Behind the origin: excluded.
    expect(cells.some((c) => c.row < 2)).toBe(false);
  });

  it('wraps the cone across the 0 / 2pi seam (Req 7.4)', () => {
    const state = { ...createState(1), beam: { angle: Math.PI * 2 - 0.01 } };
    const cells = beamCells(state, T);
    expect(cells.some((c) => c.row === 2 && c.col > 8)).toBe(true);
  });

  it('drops cells beyond the slide reach (Req 7.4)', () => {
    const reach = 5;
    const cells = beamCells(createState(1, wide), { ...wide, placeholderSlideReachM: reach });
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => c.distance <= reach)).toBe(true);
    const all = beamCells(createState(1, wide), wide);
    expect(all.length).toBeGreaterThan(cells.length);
  });

  it('excludes the origin cell (Req 7.5)', () => {
    const cells = beamCells(createState(1, wide), wide);
    expect(cells.some((c) => c.col === 8 && c.row === 2)).toBe(false);
  });

  it('reports cell density from the grid', () => {
    const state = createState(1, wide);
    state.grid[3 * T.roomWidthM + 8] = 0.7;
    const cell = beamCells(state, wide).find((c) => c.col === 8 && c.row === 3);
    expect(cell?.density).toBe(0.7);
  });
});
