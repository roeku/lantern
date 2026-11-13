import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createState, doorIndexAt, LEVEL, LEVEL_GRID, playerGrid, step, TUNING } from '../../src/sim';
import { circleHitsWall, isWallCell, cellOf } from '../../src/sim/grid';
import { inputRunsArb } from './arbitraries';

describe('invariants over random play', () => {
  it('notice and battery stay in [0, 1]; nobody enters a wall or a closed door', () => {
    fc.assert(
      fc.property(fc.integer(), inputRunsArb, (seed, inputs) => {
        let s = createState(seed);
        for (const input of inputs) {
          s = step(s, input);
          expect(s.notice).toBeGreaterThanOrEqual(0);
          expect(s.notice).toBeLessThanOrEqual(1);
          expect(s.player.battery).toBeGreaterThanOrEqual(0);
          expect(s.player.battery).toBeLessThanOrEqual(1);
          expect(s.player.lensRaise).toBeGreaterThanOrEqual(0);
          expect(s.player.lensRaise).toBeLessThanOrEqual(1);
          const grid = playerGrid(LEVEL, s.doors, s.exitOpen, s.gates);
          expect(circleHitsWall(grid, s.player.pos, TUNING.playerRadiusM - 1e-9)).toBe(false);
          if (s.ghost) expect(circleHitsWall(grid, s.ghost.player.pos, TUNING.playerRadiusM - 1e-9)).toBe(false);
          if (s.thing.mode === 'dormant') continue;
          const c = cellOf(s.thing.pos);
          expect(isWallCell(LEVEL_GRID, c.cx, c.cy)).toBe(false);
          const di = doorIndexAt(LEVEL, c);
          if (di >= 0) expect(s.doors[di]).toBe(true);
        }
      }),
      { numRuns: 40 },
    );
  });
});
