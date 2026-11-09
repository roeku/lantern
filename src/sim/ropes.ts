/**
 * Rope cutting. Pure: returns new values, never mutates arguments.
 *
 * A Spectator cuts a rope by holding `cut` on it while their own candle is lit and
 * within ropeCutRadiusM. A rope is cut after ropeCutHoldTicks consecutive ticks with a
 * Cutter; any tick without one resets its progress. Several Cutters do not speed it up.
 */

import type { PlayerId, Rope, State } from './state';
import { TUNING, type Tuning } from './tuning';

/** Ticks a Rope must be held to be cut: max(1, round(ropeCutHoldS / tickS)). */
export function ropeCutHoldTicks(tuning: Tuning = TUNING): number {
  return Math.max(1, Math.round(tuning.ropeCutHoldS / tuning.tickS));
}

/** Cut progress in seconds: integer ticks times tickS. */
export function cutProgressS(rope: Rope, tuning: Tuning = TUNING): number {
  return rope.cutProgressTicks * tuning.tickS;
}

/**
 * True when `player` is a non-Showman Spectator with a lit Candle, the Rope is standing,
 * and the Spectator is within ropeCutRadiusM (inclusive) of the Rope.
 */
export function isCutter(state: State, player: PlayerId, ropeId: number, tuning: Tuning = TUNING): boolean {
  if (player === state.showmanId) return false;
  const spectator = state.spectators.find((sp) => sp.player === player);
  const rope = state.ropes.find((r) => r.id === ropeId);
  if (spectator === undefined || rope === undefined || rope.status !== 'standing') return false;
  const candle = state.candles.find((c) => c.id === spectator.candleId);
  if (candle === undefined || candle.status !== 'lit') return false;
  return Math.hypot(spectator.x - rope.x, spectator.y - rope.y) <= tuning.ropeCutRadiusM;
}

/**
 * Rope phase. A standing Rope with at least one Cutter gains exactly 1 tick (several
 * Cutters count once); other standing Ropes reset to 0. Reaching the hold cuts the Rope
 * and records cutTick = state.tick. Cut Ropes never change. Returns a new State.
 */
export function applyRopePhase(
  state: State,
  cutInputs: readonly { player: PlayerId; rope: number }[],
  tuning: Tuning = TUNING,
): State {
  const hold = ropeCutHoldTicks(tuning);
  const held = new Set<number>();
  for (const input of cutInputs) {
    if (isCutter(state, input.player, input.rope, tuning)) held.add(input.rope);
  }
  const ropes = state.ropes.map((rope): Rope => {
    if (rope.status === 'cut') return { ...rope };
    const cutProgressTicks = held.has(rope.id) ? Math.min(hold, rope.cutProgressTicks + 1) : 0;
    if (cutProgressTicks >= hold) return { ...rope, cutProgressTicks, status: 'cut', cutTick: state.tick };
    return { ...rope, cutProgressTicks };
  });
  return { ...state, ropes };
}
