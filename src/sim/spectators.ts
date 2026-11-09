/**
 * Spectator movement, candle ownership and candle light radius. Pure: every
 * function returns a new State (or the same reference when nothing changes).
 */

import type { CandleStatus, Input, PlayerId, Spectator, State } from './state';
import { TUNING, type Tuning } from './tuning';

/** Light radius in metres for a candle status. Snuffed candles give no light. */
export function lightRadiusM(status: CandleStatus, tuning: Tuning = TUNING): number {
  if (status === 'lit') return tuning.litCandleRadiusM;
  if (status === 'shielded') return tuning.shieldedCandleRadiusM;
  return 0;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Apply `move` inputs. Each Spectator moves at most once per call, by
 * spectatorSpeedMps x tickS along the normalised vector, clamped to the room.
 * Zero, non-finite and Showman-sent vectors are ignored, as are senders that
 * are not Spectators. Snuffed (Audience_Side) Spectators keep moving. Candle
 * positions are re-synced to their owners.
 */
export function applyMoves(state: State, moves: readonly Input[], tuning: Tuning = TUNING): State {
  const step = tuning.spectatorSpeedMps * tuning.tickS;
  const moved = new Set<PlayerId>();
  let spectators = state.spectators;

  for (const input of moves) {
    if (input.kind !== 'move') continue;
    if (input.player === state.showmanId || moved.has(input.player)) continue;
    const { dx, dy } = input;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len === 0) continue;
    const idx = spectators.findIndex((s) => s.player === input.player);
    if (idx < 0) continue;

    const s = spectators[idx] as Spectator;
    const next: Spectator = {
      ...s,
      x: clamp(s.x + (dx / len) * step, 0, tuning.roomWidthM),
      y: clamp(s.y + (dy / len) * step, 0, tuning.roomDepthM),
    };
    moved.add(input.player);
    spectators = spectators.map((sp, i) => (i === idx ? next : sp));
  }

  if (spectators === state.spectators) return state;
  return syncCandlePositions({ ...state, spectators });
}

/** Set every candle's x and y to its owning Spectator's position. */
export function syncCandlePositions(state: State): State {
  let changed = false;
  const candles = state.candles.map((c) => {
    const owner = state.spectators.find((s) => s.candleId === c.id);
    if (owner === undefined || (owner.x === c.x && owner.y === c.y)) return c;
    changed = true;
    return { ...c, x: owner.x, y: owner.y };
  });
  return changed ? { ...state, candles } : state;
}

/** True when `player` is a Spectator whose owned candle has id `candleId`. */
export function ownsCandle(state: State, player: PlayerId, candleId: number): boolean {
  if (player === state.showmanId) return false;
  return state.spectators.some((s) => s.player === player && s.candleId === candleId);
}
