import { lineOfSight } from './grid';
import { TUNING } from './tuning';
import { dist } from './vec2';
import type { Grid } from './grid';
import type { PlayerState } from './state';
import type { Vec2 } from './vec2';

export interface LensReading {
  /** The Thing is on the tape. The one rule for seeing it. Render, audio and notice all read this. */
  visible: boolean;
  /** Visible and inside the focus box. This is what fills the notice meter. */
  inFocusBox: boolean;
  /** The Thing can see the REC light. */
  recSeen: boolean;
  angleDeg: number;
  distM: number;
}

export function eyeHeightM(player: PlayerState): number {
  return player.crouching ? TUNING.eyeHeightCrouchM : TUNING.eyeHeightStandM;
}

/**
 * Look direction in sim space (x, up, y).
 * Matches a Three.js camera with rotation order YXZ: x = -sin(yaw)cos(pitch), z = -cos(yaw)cos(pitch).
 */
export function lookDirection(player: PlayerState): { x: number; up: number; y: number } {
  const cp = Math.cos(player.pitchRad);
  return {
    x: -Math.sin(player.yawRad) * cp,
    up: Math.sin(player.pitchRad),
    y: -Math.cos(player.yawRad) * cp,
  };
}

export function lensIsUp(player: PlayerState): boolean {
  return player.lensRaise >= TUNING.lensVisibleRaise && player.battery > 0;
}

export function readLens(grid: Grid, player: PlayerState, thingPos: Vec2): LensReading {
  const distM = dist(player.pos, thingPos);
  const dx = thingPos.x - player.pos.x;
  const dy = thingPos.y - player.pos.y;
  const dUp = TUNING.thingCenterHeightM - eyeHeightM(player);
  const len = Math.hypot(dx, dy, dUp);
  const look = lookDirection(player);
  const cos = len === 0 ? 1 : (look.x * dx + look.up * dUp + look.y * dy) / len;
  const angleDeg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;

  const up = lensIsUp(player);
  const los = lineOfSight(grid, player.pos, thingPos);
  const visible = up && los && distM <= TUNING.lensRangeM && angleDeg <= TUNING.lensVisibleHalfAngleDeg;
  const inFocusBox = visible && angleDeg <= TUNING.lensNoticeHalfAngleDeg;
  const recSeen = player.lensRaise >= TUNING.lensVisibleRaise && los && distM <= TUNING.recLightRangeM;
  return { visible, inFocusBox, recSeen, angleDeg, distM };
}
