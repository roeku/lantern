/**
 * Pure mapping from a View, roster and tuning to the strings the HUD shows.
 * No DOM, no clocks. Imports sim through its entry point only.
 */
import { imageScale, TUNING, type Tuning, type View } from '../../sim';
import type { ControlRole } from '../input/controls';

export interface HudRoster {
  role: ControlRole;
  roomCode: string;
  /** Seat of the local player. Reserved for labels; the View already carries own-player fields. */
  playerId: number;
}

export interface HudModel {
  /** Remaining show time as m:ss. */
  time: string;
  /** Ropes cut out of ropeCount, e.g. "1/3". */
  ropes: string;
  /** Candles not snuffed out of the number of Spectators, e.g. "2/3". */
  candles: string;
  /** "Ready" or "4.2s"; null when the fan does not apply (Showman, Audience_Side). */
  fan: string | null;
  role: string;
  roomCode: string;
  /** Showman only: cart travel, e.g. "3.0 / 8 m". */
  cartTravel: string | null;
  /** Showman only: Image_Scale, e.g. "x0.95". */
  imageScale: string | null;
}

/** Remaining time as m:ss, rounded up to whole seconds and never below 0:00. */
export function formatRemaining(tick: number, tuning: Tuning = TUNING): string {
  const secondsPerMinute = 60;
  const ten = 10;
  const left = Math.max(0, Math.ceil(tuning.showLengthS - tick * tuning.tickS));
  const m = Math.floor(left / secondsPerMinute);
  const s = left % secondsPerMinute;
  return `${m}:${s < ten ? '0' : ''}${s}`;
}

export interface HudOptions {
  /**
   * Snuffed candle count the caller has accumulated across Views. A Showman's View can omit
   * hidden candles, so the HUD takes the larger of this and the snuffed candles in the View.
   */
  snuffedCount?: number;
}

export function hudModel(view: View, roster: HudRoster, tuning: Tuning = TUNING, opts: HudOptions = {}): HudModel {
  const total = tuning.spectatorStartPositions.length;
  const snuffedInView = view.candles.filter((c) => c.status === 'snuffed').length;
  const snuffed = Math.min(total, Math.max(snuffedInView, opts.snuffedCount ?? 0));
  const isShowman = roster.role === 'showman';
  const fanApplies = !isShowman && view.ownCandle !== null && view.ownCandle !== 'snuffed';
  const oneDecimal = 1;
  let fan: string | null = null;
  if (fanApplies) {
    fan =
      view.ownFanReadyInTicks <= 0
        ? 'Ready'
        : `${(view.ownFanReadyInTicks * tuning.tickS).toFixed(oneDecimal)}s`;
  }
  return {
    time: formatRemaining(view.tick, tuning),
    ropes: `${view.ropesCut}/${tuning.ropeCount}`,
    candles: `${total - snuffed}/${total}`,
    fan,
    role: isShowman ? 'Showman' : 'Spectator',
    roomCode: roster.roomCode,
    cartTravel: isShowman
      ? `${view.cart.travel.toFixed(oneDecimal)} / ${tuning.cartTravelMaxM} m`
      : null,
    imageScale: isShowman ? `x${imageScale(view.cart.travel, tuning).toFixed(2)}` : null,
  };
}
