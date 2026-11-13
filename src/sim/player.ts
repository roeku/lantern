import { circleHitsWall } from './grid';
import { DT_SEC, TUNING } from './tuning';
import { clamp } from './vec2';
import type { Grid } from './grid';
import type { PlayerState, SimInput } from './state';

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

/** Noise radius the Thing can hear this tick. Crouching and standing still are silent. */
export function noiseRadiusM(player: PlayerState): number {
  if (player.crouching) return 0;
  const speed = Math.hypot(player.vel.x, player.vel.y);
  if (speed < TUNING.movingSpeedMps) return 0;
  return player.sprinting ? TUNING.noiseSprintRadiusM : TUNING.noiseWalkRadiusM;
}

export function stepPlayer(grid: Grid, player: PlayerState, input: SimInput): PlayerState {
  const yawRad = finiteOr(input.yawRad, player.yawRad);
  const pitchRad = clamp(finiteOr(input.pitchRad, player.pitchRad), -TUNING.maxPitchRad, TUNING.maxPitchRad);

  // Lens and battery
  const lensActive = input.lensHeld && !player.lensLocked && player.battery > 0;
  const raiseStep = DT_SEC / TUNING.lensRaiseTimeSec;
  const lensRaise = clamp(player.lensRaise + (lensActive ? raiseStep : -raiseStep), 0, 1);
  let battery = player.battery;
  let lensLocked = player.lensLocked;
  if (lensActive) {
    battery = Math.max(0, battery - DT_SEC / TUNING.batteryLifeSec);
    if (battery === 0) lensLocked = true;
  } else {
    battery = Math.min(1, battery + TUNING.batteryRechargePerSec * DT_SEC);
    if (lensLocked && battery >= TUNING.batteryUnlockLevel) lensLocked = false;
  }

  // Movement intent
  const mx = clamp(finiteOr(input.moveX, 0), -1, 1);
  const mz = clamp(finiteOr(input.moveZ, 0), -1, 1);
  const mag = Math.min(1, Math.hypot(mx, mz));
  const crouching = input.crouch;
  const sprinting = input.sprint && !crouching && !lensActive && mz > 0.1;
  const baseSpeed = crouching
    ? TUNING.crouchSpeedMps
    : sprinting
      ? TUNING.sprintSpeedMps
      : TUNING.walkSpeedMps;
  const speed = baseSpeed * (1 - (1 - TUNING.lensMoveSpeedFactor) * lensRaise);

  // Forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw)
  const fx = -Math.sin(yawRad);
  const fy = -Math.cos(yawRad);
  const rx = Math.cos(yawRad);
  const ry = -Math.sin(yawRad);
  const len = Math.hypot(mx, mz);
  const dirX = len === 0 ? 0 : (fx * mz + rx * mx) / len;
  const dirY = len === 0 ? 0 : (fy * mz + ry * mx) / len;
  const wantX = dirX * speed * mag;
  const wantY = dirY * speed * mag;

  // Accelerate toward the wanted velocity
  const dvx = wantX - player.vel.x;
  const dvy = wantY - player.vel.y;
  const dvLen = Math.hypot(dvx, dvy);
  const maxDv = TUNING.accelMps2 * DT_SEC;
  const k = dvLen <= maxDv || dvLen === 0 ? 1 : maxDv / dvLen;
  let vx = player.vel.x + dvx * k;
  let vy = player.vel.y + dvy * k;

  // Move one axis at a time so the player slides along walls
  let x = player.pos.x;
  let y = player.pos.y;
  const nx = x + vx * DT_SEC;
  if (circleHitsWall(grid, { x: nx, y }, TUNING.playerRadiusM)) vx = 0;
  else x = nx;
  const ny = y + vy * DT_SEC;
  if (circleHitsWall(grid, { x, y: ny }, TUNING.playerRadiusM)) vy = 0;
  else y = ny;

  return {
    pos: { x, y },
    vel: { x: vx, y: vy },
    yawRad,
    pitchRad,
    crouching,
    sprinting,
    lensRaise,
    lensLocked,
    battery,
    interactHeld: input.interact,
  };
}
