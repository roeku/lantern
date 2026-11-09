import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { beamCells } from '../../src/sim/beam';
import { isFanned } from '../../src/sim/smoke';
import { step } from '../../src/sim/step';
import type { Input, State } from '../../src/sim/state';
import { TUNING } from '../../src/sim/tuning';
import { gridArb, inputArb, makeState, seedArb } from './arbitraries';

const T = TUNING;

const denseGridArb = fc.oneof(
  { arbitrary: gridArb(T), weight: 1 },
  { arbitrary: fc.constant(new Array<number>(T.roomWidthM * T.roomDepthM).fill(1)), weight: 2 },
  {
    arbitrary: fc
      .array(fc.double({ min: 0.5, max: 1, noNaN: true }), {
        minLength: T.roomWidthM * T.roomDepthM,
        maxLength: T.roomWidthM * T.roomDepthM,
      }),
    weight: 3,
  },
);

describe('Property 5: Clearing a cell removes the threat there', () => {
  it('Feature: smoke-and-projection, Property 5: Clearing a cell removes the threat there', () => {
    // **Validates: Requirements 8.5, 8.8**
    fc.assert(
      fc.property(
        seedArb,
        denseGridArb,
        fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
        fc.double({ min: 0, max: 8, noNaN: true }),
        fc.nat(),
        fc.boolean(),
        fc.integer({ min: 1, max: 6 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.array(fc.array(inputArb(T), { maxLength: 4 }), { minLength: 1, maxLength: 40 }),
        (seed, grid, angle, travel, pick, onBeam, spectatorOffset, fx, fy, rest) => {
          const start = makeState(seed, grid, T);
          start.beam = { angle };
          start.cart = { travel, speedMps: 0 };

          // Aim the fan at a beam cell when possible so the beam crosses it.
          const cells = beamCells(start, T);
          const target = cells.length > 0 ? cells[pick % cells.length] : undefined;
          const x = onBeam && target ? target.col + 0.5 : fx * T.roomWidthM;
          const y = onBeam && target ? target.row + 0.5 : fy * T.roomDepthM;
          const spectator = T.showmanIdDefault + spectatorOffset;

          const fanInput: Input = { player: spectator, kind: 'fan', x, y };
          let state: State = step(start, [fanInput], T);
          expect(state.fans.length).toBeGreaterThan(0);

          const check = (s: State): void => {
            for (let i = 0; i < s.grid.length; i++) {
              const col = i % T.roomWidthM;
              const row = (i - col) / T.roomWidthM;
              if (isFanned(col, row, s.fans, T)) expect(s.grid[i]).toBe(0);
            }
            if (s.ghost !== null) {
              expect(isFanned(s.ghost.col, s.ghost.row, s.fans, T)).toBe(false);
            }
          };
          check(state);

          for (const inputs of rest) {
            if (state.fans.length === 0) break;
            state = step(state, inputs, T);
            check(state);
          }
        },
      ),
    );
  });
});
