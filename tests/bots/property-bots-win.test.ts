import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { spectatorBotInputs } from '../../src/bots/spectator-bot';
import { createState, step, TUNING, type State } from '../../src/sim';

/**
 * Feature: vertical-slice, Property 8: Three bots without a Showman win
 * **Validates: Requirements 5.8**
 */
describe('Property 8: three bots without a Showman win', () => {
  it('ends with spectators winning before showLengthS elapses', () => {
    const totalTicks = TUNING.showLengthS / TUNING.tickS;
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0x7fffffff }), (seed) => {
        let state: State = createState(seed, TUNING, { showmanId: 0 });
        const bots = [1, 2, 3];
        let guard = 0;
        while (!state.ended && guard < totalTicks) {
          state = step(state, spectatorBotInputs(state, bots, TUNING), TUNING);
          guard++;
        }
        expect(state.outcome).not.toBeNull();
        expect(state.outcome?.winner).toBe('spectators');
        expect(state.outcome?.tick).toBeLessThan(totalTicks);
      }),
    );
  });
});
