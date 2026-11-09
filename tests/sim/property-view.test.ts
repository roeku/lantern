import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { lightRadiusM } from '../../src/sim/spectators';
import type { Candle, State } from '../../src/sim/state';
import { TUNING } from '../../src/sim/tuning';
import { beamLitCells, viewFor } from '../../src/sim/view';
import { ropeStateArb } from './arbitraries-slice';

const W = TUNING.roomWidthM;
const H = TUNING.roomDepthM;

/** A state with ropes, spectators, candles plus a random grid, ghost, beam, cart and fan clocks. */
const viewStateArb: fc.Arbitrary<State> = fc
  .tuple(
    ropeStateArb(TUNING),
    fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: W * H, maxLength: W * H }),
    fc.oneof(
      fc.double({ min: Math.PI / 2 - 0.4, max: Math.PI / 2 + 0.4, noNaN: true }),
      fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
    ),
    fc.double({ min: 0, max: TUNING.cartTravelMaxM, noNaN: true }),
    fc.option(
      fc.record({
        col: fc.integer({ min: 0, max: W - 1 }),
        row: fc.integer({ min: 0, max: H - 1 }),
        density: fc.double({ min: 0, max: 1, noNaN: true }),
        solid: fc.boolean(),
      }),
      { nil: null },
    ),
    fc.integer({ min: 0, max: 400 }),
    fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 4, maxLength: 4 }),
    fc.boolean(),
  )
  .map(([base, grid, angle, travel, ghost, tick, fanReady, ended]) => {
    const s = base;
    s.grid = grid;
    s.beam = { angle };
    s.cart = { ...s.cart, travel };
    s.ghost = ghost;
    s.tick = tick;
    s.fanReadyTick = Object.fromEntries(fanReady.map((t, i) => [String(i), t]));
    s.outcome = ended ? { winner: 'showman', reason: 'time_up', tick } : null;
    return s;
  });

const stateAndPlayer = viewStateArb.chain((state) =>
  fc.integer({ min: 0, max: 3 }).map((player) => ({ state, player })),
);

function cellIndexOf(x: number, y: number): number {
  return Math.min(H - 1, Math.floor(y)) * W + Math.min(W - 1, Math.floor(x));
}

function expectedShowman(state: State) {
  const beamIdx = new Set(beamLitCells(state, TUNING).map((c) => c.row * W + c.col));
  const lit = state.candles.filter((c) => c.status === 'lit');
  const r = lightRadiusM('lit', TUNING);
  const inLight = (x: number, y: number) => lit.some((c) => Math.hypot(x - c.x, y - c.y) <= r);
  const inBeam = (x: number, y: number) => beamIdx.has(cellIndexOf(x, y));
  const visible = (x: number, y: number) => inBeam(x, y) || inLight(x, y);
  const cells = new Set<number>();
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      const i = row * W + col;
      if (beamIdx.has(i) || inLight(col + 0.5, row + 0.5)) cells.add(i);
    }
  }
  return {
    cells,
    ropes: new Set(state.ropes.filter((o) => visible(o.x, o.y)).map((o) => o.id)),
    spectators: new Set(state.spectators.filter((o) => visible(o.x, o.y)).map((o) => o.player)),
    candles: new Set(
      state.candles.filter((c: Candle) => c.status === 'lit' || inBeam(c.x, c.y)).map((c) => c.id),
    ),
    ghost: state.ghost !== null && beamIdx.has(state.ghost.row * W + state.ghost.col),
  };
}

describe('Property 6: A View contains only what the role may see', () => {
  /**
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9**
   */
  it('matches the visibility rules for every role, is a subset of State, and does not mutate State', () => {
    fc.assert(
      fc.property(stateAndPlayer, ({ state, player }) => {
        const before = structuredClone(state);
        const view = viewFor(state, player, TUNING);
        expect(state).toEqual(before); // 4.1 no mutation

        // 4.8 shared fields
        expect(view.tick).toBe(state.tick);
        expect(view.outcome).toEqual(state.outcome);
        expect(view.ropesCut).toBe(state.ropes.filter((r) => r.status === 'cut').length);

        // 4.9 subset of State, with identical values
        for (const c of view.cells) {
          expect(c.index).toBeGreaterThanOrEqual(0);
          expect(c.index).toBeLessThan(W * H);
          expect(c.density).toBe(state.grid[c.index]);
        }
        expect(new Set(view.cells.map((c) => c.index)).size).toBe(view.cells.length);
        for (const r of view.ropes) expect(state.ropes).toContainEqual(r);
        for (const sp of view.spectators) expect(state.spectators).toContainEqual(sp);
        for (const c of view.candles) expect(state.candles).toContainEqual(c);
        if (view.ghost) expect(view.ghost).toEqual(state.ghost);

        // No aliasing into State
        for (const r of view.ropes) expect(state.ropes.includes(r)).toBe(false);
        for (const sp of view.spectators) expect(state.spectators.includes(sp)).toBe(false);
        for (const c of view.candles) expect(state.candles.includes(c)).toBe(false);
        if (view.ghost) expect(view.ghost).not.toBe(state.ghost);

        const cellSet = new Set(view.cells.map((c) => c.index));
        const ropeSet = new Set(view.ropes.map((r) => r.id));
        const specSet = new Set(view.spectators.map((s) => s.player));
        const candleSet = new Set(view.candles.map((c) => c.id));

        if (player === state.showmanId) {
          // 4.2 to 4.5
          const exp = expectedShowman(state);
          expect(view.ownCandle).toBeNull();
          expect(view.ownFanReadyInTicks).toBe(0);
          expect(view.beam).toEqual({ angle: state.beam.angle });
          expect(cellSet).toEqual(exp.cells);
          expect(ropeSet).toEqual(exp.ropes);
          expect(specSet).toEqual(exp.spectators);
          expect(candleSet).toEqual(exp.candles);
          expect(view.ghost !== null).toBe(exp.ghost);
          // 4.4 shielded/snuffed candles outside the beam are absent
          const beamIdx = new Set(beamLitCells(state, TUNING).map((c) => c.row * W + c.col));
          for (const c of state.candles) {
            if (c.status !== 'lit' && !beamIdx.has(cellIndexOf(c.x, c.y))) {
              expect(candleSet.has(c.id)).toBe(false);
            }
          }
          return;
        }

        const me = state.spectators.find((s) => s.player === player);
        const myCandle = state.candles.find((c) => c.id === me?.candleId);
        expect(me).toBeDefined();
        expect(view.ownCandle).toBe(myCandle?.status);
        expect(view.ownFanReadyInTicks).toBe(
          Math.max(0, (state.fanReadyTick[String(player)] ?? 0) - state.tick),
        );
        expect(view.beam).toBeNull();

        if (myCandle?.status === 'snuffed') {
          // 4.7 full State except the beam angle
          expect(view.cells.map((c) => c.index)).toEqual(state.grid.map((_, i) => i));
          expect(view.ropes).toEqual(state.ropes);
          expect(view.spectators).toEqual(state.spectators);
          expect(view.candles).toEqual(state.candles);
          expect(view.ghost).toEqual(state.ghost);
          return;
        }

        // 4.6 lit or shielded Spectator
        const radius = lightRadiusM(myCandle!.status, TUNING);
        const near = (x: number, y: number) => Math.hypot(x - me!.x, y - me!.y) <= radius;
        const expCells = new Set<number>();
        for (let row = 0; row < H; row++) {
          for (let col = 0; col < W; col++) {
            if (near(col + 0.5, row + 0.5)) expCells.add(row * W + col);
          }
        }
        expect(cellSet).toEqual(expCells);
        expect(ropeSet).toEqual(new Set(state.ropes.filter((r) => near(r.x, r.y)).map((r) => r.id)));
        expect(specSet).toEqual(
          new Set(state.spectators.filter((s) => s.player === player || near(s.x, s.y)).map((s) => s.player)),
        );
        expect(candleSet).toEqual(
          new Set(
            state.candles
              .filter((c) => c.id === myCandle!.id || c.status === 'lit' || near(c.x, c.y))
              .map((c) => c.id),
          ),
        );
        const g = state.ghost;
        const ghostExpected = g !== null && (g.solid || near(g.col + 0.5, g.row + 0.5));
        expect(view.ghost !== null).toBe(ghostExpected);
        // Every solid ghost and every lit candle is visible anywhere
        if (g?.solid) expect(view.ghost).not.toBeNull();
        for (const c of state.candles) if (c.status === 'lit') expect(candleSet.has(c.id)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it('Showman sees nothing but lit candles when the beam misses and no candle is lit', () => {
    const state = fc.sample(viewStateArb, 1)[0] as State;
    state.candles.forEach((c) => (c.status = 'snuffed'));
    // Origin pushed past the far wall, so the beam lights no cell whatever its angle.
    state.cart = { ...state.cart, travel: TUNING.roomDepthM };
    state.beam = { angle: -Math.PI / 2 };
    state.ghost = { col: 0, row: 0, density: 1, solid: true };
    const view = viewFor(state, state.showmanId, TUNING);
    expect(view.cells).toEqual([]);
    expect(view.candles).toEqual([]);
    expect(view.ghost).toBeNull();
  });
});
