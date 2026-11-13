import { cellCenter } from './grid';
import { TUNING } from './tuning';
import { dist } from './vec2';
import type { Level } from './level';
import type { PlayerState } from './state';
import type { Vec2 } from './vec2';

export type InteractionKind = 'vcr' | 'door';

export interface Interaction {
  kind: InteractionKind;
  /** Door index. 0 for the VCR. */
  index: number;
  distM: number;
}

function facing(player: PlayerState, target: Vec2): boolean {
  const dx = target.x - player.pos.x;
  const dy = target.y - player.pos.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.9) return true;
  const fx = -Math.sin(player.yawRad);
  const fy = -Math.cos(player.yawRad);
  const cos = (fx * dx + fy * dy) / d;
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI <= TUNING.interactHalfAngleDeg;
}

/** The nearest thing the player could use right now. The VCR only counts once all the tapes are in hand. */
export function findInteraction(
  level: Level,
  doors: readonly boolean[],
  tapes: readonly boolean[],
  player: PlayerState,
): Interaction | null {
  void doors;
  let best: Interaction | null = null;
  const consider = (kind: InteractionKind, index: number, at: Vec2, range: number): void => {
    const d = dist(player.pos, at);
    if (d > range || !facing(player, at)) return;
    if (!best || d < best.distM) best = { kind, index, distM: d };
  };
  if (tapes.every(Boolean)) consider('vcr', 0, cellCenter(level.vcr), TUNING.interactRangeM + 0.4);
  level.doors.forEach((d, i) => consider('door', i, cellCenter(d), TUNING.interactRangeM + 0.2));
  return best;
}
