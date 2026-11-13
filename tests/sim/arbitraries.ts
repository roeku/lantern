import fc from 'fast-check';
import { LEVEL_GRID } from '../../src/sim';
import type { SimInput } from '../../src/sim';

export const inputArb: fc.Arbitrary<SimInput> = fc.record({
  moveX: fc.double({ min: -1, max: 1, noNaN: true }),
  moveZ: fc.double({ min: -1, max: 1, noNaN: true }),
  yawRad: fc.double({ min: -7, max: 7, noNaN: true }),
  pitchRad: fc.double({ min: -2, max: 2, noNaN: true }),
  lensHeld: fc.boolean(),
  sprint: fc.boolean(),
  crouch: fc.boolean(),
  interact: fc.boolean(),
  record: fc.boolean(),
  restart: fc.boolean(),
});

/** Runs of identical input so the lens, battery and rushes actually develop. */
export const inputRunsArb: fc.Arbitrary<SimInput[]> = fc
  .array(fc.tuple(inputArb, fc.integer({ min: 1, max: 90 })), { minLength: 1, maxLength: 40 })
  .map((runs) => runs.flatMap(([input, n]) => Array.from({ length: n }, () => input)));

export const floorPointArb = fc
  .constantFrom(...LEVEL_GRID.floorCells)
  .chain((c) =>
    fc.record({
      x: fc.double({ min: c.cx + 0.35, max: c.cx + 0.65, noNaN: true }),
      y: fc.double({ min: c.cy + 0.35, max: c.cy + 0.65, noNaN: true }),
    }),
  );
