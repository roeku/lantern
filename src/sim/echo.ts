import { stepPlayer } from './player';
import { IDLE_RECORDING, NEUTRAL_INPUT } from './state';
import { secToTicks, TUNING } from './tuning';
import type { Grid } from './grid';
import type { EchoRecording, Ghost, PlayerState, SimInput } from './state';

export type EchoEvent = 'none' | 'started' | 'committed' | 'cancelled';

export interface EchoUpdate {
  rec: EchoRecording;
  ghost: Ghost | null;
  player: PlayerState;
  event: EchoEvent;
}

/**
 * Steps the tape-self one tick: the next input of its clip, then standing still in its last posture.
 * A clip that ends with interact held keeps holding it, so your tape-self can hold the VCR for you.
 */
export function stepGhost(grid: Grid, ghost: Ghost): Ghost {
  const next = ghost.log[ghost.index];
  if (next) return { ...ghost, player: stepPlayer(grid, ghost.player, next), index: ghost.index + 1 };
  const last = ghost.log[ghost.log.length - 1] ?? NEUTRAL_INPUT;
  const parked: SimInput = {
    ...NEUTRAL_INPUT,
    yawRad: last.yawRad,
    pitchRad: last.pitchRad,
    crouch: last.crouch,
    interact: last.interact,
  };
  return { ...ghost, player: stepPlayer(grid, ghost.player, parked) };
}

/** Whether the tape-self held interact on the tick it just played. False on the tick it was created. */
export function ghostInteracting(ghost: Ghost): boolean {
  if (ghost.index === 0) return false;
  return ghost.log[Math.min(ghost.index, ghost.log.length) - 1]?.interact === true;
}

/**
 * Press record to start, press again (or run out of tape) to stop.
 * Stopping rewinds you to where the clip began and starts the tape-self playing it from there.
 * A clip shorter than recordMinSec is thrown away and you stay where you are.
 * `player` is the player after this tick's movement.
 */
export function stepEcho(
  rec: EchoRecording,
  ghost: Ghost | null,
  player: PlayerState,
  input: SimInput,
  pressed: boolean,
): EchoUpdate {
  if (!rec.active) {
    if (!pressed) return { rec, ghost, player, event: 'none' };
    return { rec: { active: true, ticks: 0, start: player, log: [] }, ghost, player, event: 'started' };
  }
  const full = rec.ticks >= secToTicks(TUNING.recordMaxSec);
  if (pressed || full) {
    const start = rec.start;
    if (!start || rec.log.length < secToTicks(TUNING.recordMinSec)) {
      return { rec: IDLE_RECORDING, ghost, player, event: 'cancelled' };
    }
    return {
      rec: IDLE_RECORDING,
      ghost: { player: start, log: rec.log, index: 0 },
      player: { ...start },
      event: 'committed',
    };
  }
  return {
    rec: { ...rec, ticks: rec.ticks + 1, log: [...rec.log, { ...input, record: false }] },
    ghost,
    player,
    event: 'none',
  };
}
