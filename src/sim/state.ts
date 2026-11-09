/**
 * Simulation state types and initial state. Plain serializable data only:
 * numbers, booleans, strings, arrays and plain objects.
 */

import { toRngState } from './rng';
import { TUNING, validateTuning, type Tuning } from './tuning';

export type PlayerId = number;

export type Input =
  | { player: PlayerId; kind: 'puff'; vent: number }
  | { player: PlayerId; kind: 'roll'; dir: 1 | -1 }
  | { player: PlayerId; kind: 'rush'; dir: 1 | -1 }
  | { player: PlayerId; kind: 'aim'; angle: number }
  | { player: PlayerId; kind: 'fan'; x: number; y: number }
  | { player: PlayerId; kind: 'shield' | 'unshield' | 'light'; candle: number }
  | { player: PlayerId; kind: 'move'; dx: number; dy: number }
  | { player: PlayerId; kind: 'cut'; rope: number }
  | { player: PlayerId; kind: 'snuff'; eventId: string; candle: number };

export type CandleStatus = 'lit' | 'shielded' | 'snuffed';

export interface Candle {
  id: number;
  x: number;
  y: number;
  status: CandleStatus;
}

export type RopeStatus = 'standing' | 'cut';

export interface Rope {
  id: number;
  x: number;
  y: number;
  status: RopeStatus;
  /** Integer ticks of held cut, in [0, hold ticks]. Resets to 0 on any tick without a Cutter. */
  cutProgressTicks: number;
  /** Tick on which the rope was cut, or null while standing. */
  cutTick: number | null;
}

export interface Spectator {
  player: PlayerId;
  /** Id of the candle this Spectator owns. */
  candleId: number;
  x: number;
  y: number;
}

export type OutcomeReason = 'all_candles_snuffed' | 'time_up' | 'all_ropes_cut';

export interface Outcome {
  winner: 'showman' | 'spectators';
  reason: OutcomeReason;
  tick: number;
}

export interface Fan {
  cx: number;
  cy: number;
  ticksLeft: number;
}

export interface Ghost {
  col: number;
  row: number;
  density: number;
  solid: boolean;
}

export interface State {
  tick: number;
  ended: boolean;
  /** uint32 RNG state. */
  rng: number;
  showmanId: PlayerId;
  /** Length W*H, row-major (index = row * W + col), each in [0, 1]. */
  grid: number[];
  cart: { travel: number; speedMps: number };
  /** Origin is derived from cart travel. */
  beam: { angle: number };
  fans: Fan[];
  /** Key: player id as text. */
  fanReadyTick: Record<string, number>;
  candles: Candle[];
  ropes: Rope[];
  /** One per non-Showman seat, in ascending player id; the Nth owns candle N. */
  spectators: Spectator[];
  /** Null while the round runs. Set on the same tick `ended` becomes true. */
  outcome: Outcome | null;
  /** Idempotence record of applied snuff event ids. */
  appliedSnuffIds: string[];
  snuffedCount: number;
  ghost: Ghost | null;
}

/**
 * Build the initial state. Throws an Error naming the field if tuning is invalid.
 * Candles start lit at TUNING.spectatorStartPositions, with ids equal to list indexes.
 */
export function createState(
  seed: number,
  tuning: Tuning = TUNING,
  opts?: { showmanId?: PlayerId },
): State {
  validateTuning(tuning);

  const showmanId = opts?.showmanId ?? tuning.showmanIdDefault;
  const seatIds = Array.from({ length: tuning.spectatorStartPositions.length + 1 }, (_, i) => i);
  const spectatorIds = seatIds.filter((id) => id !== showmanId);

  const cellCount = tuning.roomWidthM * tuning.roomDepthM;

  return {
    tick: 0,
    ended: false,
    rng: toRngState(seed),
    showmanId,
    grid: new Array<number>(cellCount).fill(0),
    cart: { travel: 0, speedMps: 0 },
    beam: { angle: tuning.beamAngleDefaultRad },
    fans: [],
    fanReadyTick: {},
    candles: tuning.spectatorStartPositions.map(([x, y], id) => ({ id, x, y, status: 'lit' as const })),
    ropes: tuning.ropePositions.map(([x, y], id) => ({
      id,
      x,
      y,
      status: 'standing' as const,
      cutProgressTicks: 0,
      cutTick: null,
    })),
    spectators: tuning.spectatorStartPositions.map(([x, y], candleId) => ({
      player: spectatorIds[candleId] as PlayerId,
      candleId,
      x,
      y,
    })),
    outcome: null,
    appliedSnuffIds: [],
    snuffedCount: 0,
    ghost: null,
  };
}
