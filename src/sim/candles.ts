/**
 * Candle transitions and snuffing. Pure: every function returns a new State
 * (or the same reference when nothing changes) and never mutates its arguments.
 */

import type { Candle, CandleStatus, PlayerId, State } from './state';
import type { Tuning } from './tuning';

/** True when there is at least one candle and every candle is snuffed: the Showman has won. */
export function allSnuffed(candles: readonly Candle[]): boolean {
  return candles.length > 0 && candles.every((c) => c.status === 'snuffed');
}

/**
 * The candle a player owns: spectators are the players that are not the Showman, in
 * id order, and the Nth spectator owns the candle whose id is N. The Showman owns none.
 */
export function ownedCandle(state: State, player: PlayerId): Candle | undefined {
  if (player === state.showmanId) return undefined;
  const rank = player < state.showmanId ? player : player - 1;
  return state.candles.find((c) => c.id === rank);
}

/** Return a new state with the candle's status replaced, or the same state if no change. */
function setStatus(
  state: State,
  candle: number,
  from: CandleStatus,
  to: CandleStatus,
): State {
  const found = state.candles.find((c) => c.id === candle);
  if (found === undefined || found.status !== from) return state;
  return {
    ...state,
    candles: state.candles.map((c) => (c.id === candle ? { ...c, status: to } : c)),
  };
}

/** lit -> shielded. No-op for shielded, snuffed or missing candles. */
export function shieldCandle(state: State, candle: number): State {
  return setStatus(state, candle, 'lit', 'shielded');
}

/** shielded -> lit (unshield). No-op for lit, snuffed or missing candles. */
export function unshieldCandle(state: State, candle: number): State {
  return setStatus(state, candle, 'shielded', 'lit');
}

/** shielded -> lit (light). No-op for lit, snuffed or missing candles. */
export function lightCandle(state: State, candle: number): State {
  return setStatus(state, candle, 'shielded', 'lit');
}

/**
 * The single place a candle becomes snuffed. Returns the state unchanged when
 * the candle is missing or already snuffed, or when the event id was applied before.
 */
export function applySnuffEvent(state: State, candle: number, eventId: string): State {
  const found = state.candles.find((c) => c.id === candle);
  if (found === undefined || found.status === 'snuffed') return state;
  if (state.appliedSnuffIds.includes(eventId)) return state;
  return {
    ...state,
    candles: state.candles.map((c) => (c.id === candle ? { ...c, status: 'snuffed' as const } : c)),
    snuffedCount: state.snuffedCount + 1,
    appliedSnuffIds: [...state.appliedSnuffIds, eventId],
  };
}

/**
 * Snuff every lit or shielded candle within snuffRadiusBaseM x scale (inclusive)
 * of a solid ghost. The ghost sits at its cell centre. Event ids are `${tick}:${candleId}`.
 */
export function snuffByContact(state: State, scale: number, tuning: Tuning): State {
  const ghost = state.ghost;
  if (ghost === null || !ghost.solid) return state;

  const half = 1 / (1 + 1);
  const gx = ghost.col + half;
  const gy = ghost.row + half;
  const radius = tuning.snuffRadiusBaseM * scale;

  let next = state;
  for (const c of state.candles) {
    if (c.status === 'snuffed') continue;
    if (Math.hypot(c.x - gx, c.y - gy) <= radius) {
      next = applySnuffEvent(next, c.id, `${state.tick}:${c.id}`);
    }
  }
  return next;
}
