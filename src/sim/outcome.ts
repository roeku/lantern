/**
 * End-of-tick outcome rule. Pure: reads state and tuning, returns a new value.
 * Order matters: ropes, then candles, then time, so a same-tick tie goes to
 * the Spectators.
 */

import type { Outcome, State } from './state';
import type { Tuning } from './tuning';

export function decideOutcome(state: State, tuning: Tuning): Outcome | null {
  const tick = state.tick + 1;

  if (!state.ropes.some((r) => r.status === 'standing')) {
    return { winner: 'spectators', reason: 'all_ropes_cut', tick };
  }

  if (!state.candles.some((c) => c.status === 'lit' || c.status === 'shielded')) {
    return { winner: 'showman', reason: 'all_candles_snuffed', tick };
  }

  if (tick >= tuning.showLengthS / tuning.tickS) {
    return { winner: 'showman', reason: 'time_up', tick };
  }

  return null;
}
