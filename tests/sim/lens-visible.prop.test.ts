import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createState, LEVEL_GRID, readLens, TUNING } from '../../src/sim';
import { lineOfSight } from '../../src/sim/grid';
import { floorPointArb } from './arbitraries';

const playerArb = fc.record({
  pos: floorPointArb,
  yawRad: fc.double({ min: -7, max: 7, noNaN: true }),
  pitchRad: fc.double({ min: -1.4, max: 1.4, noNaN: true }),
  crouching: fc.boolean(),
  lensRaise: fc.constantFrom(0, 0.3, 0.59, 0.6, 1),
  battery: fc.constantFrom(0, 0.05, 1),
});

describe('lens-visible rule', () => {
  it('visible exactly when the lens is up, battery > 0, in range, in the visible angle and in line of sight', () => {
    fc.assert(
      fc.property(playerArb, floorPointArb, (p, thingPos) => {
        const base = createState(1).player;
        const player = { ...base, ...p, vel: { x: 0, y: 0 } };
        const reading = readLens(LEVEL_GRID, player, thingPos);

        // Independent geometry
        const eye = player.crouching ? TUNING.eyeHeightCrouchM : TUNING.eyeHeightStandM;
        const dx = thingPos.x - player.pos.x;
        const dy = thingPos.y - player.pos.y;
        const dUp = TUNING.thingCenterHeightM - eye;
        const len = Math.hypot(dx, dy, dUp);
        const lx = -Math.sin(player.yawRad) * Math.cos(player.pitchRad);
        const ly = -Math.cos(player.yawRad) * Math.cos(player.pitchRad);
        const lu = Math.sin(player.pitchRad);
        const cos = (lx * dx + ly * dy + lu * dUp) / len;
        const angle = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
        const expected =
          player.lensRaise >= TUNING.lensVisibleRaise &&
          player.battery > 0 &&
          Math.hypot(dx, dy) <= TUNING.lensRangeM &&
          angle <= TUNING.lensVisibleHalfAngleDeg &&
          lineOfSight(LEVEL_GRID, player.pos, thingPos);

        expect(reading.visible).toBe(expected);
        if (reading.inFocusBox) expect(reading.visible).toBe(true);
        if (!player.lensRaise || player.battery === 0) expect(reading.visible).toBe(false);
      }),
      { numRuns: 500 },
    );
  });
});
