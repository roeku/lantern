/**
 * Every sim tuning number lives here. Names carry the unit.
 * Starting values are guesses to be tuned in playtests (see docs/design.md).
 * Per-act arrays are indexed by act - 1 (act 1 Closing, act 2 Rain, act 3 Blackout).
 */
export const TUNING = {
  // Time
  tickHz: 60,

  // Player movement
  walkSpeedMps: 1.8,
  sprintSpeedMps: 4.2,
  crouchSpeedMps: 0.9,
  /** Walking speed multiplier at full lens raise. Sprinting is impossible with the lens up. */
  lensMoveSpeedFactor: 0.6,
  accelMps2: 14,
  playerRadiusM: 0.3,
  eyeHeightStandM: 1.6,
  eyeHeightCrouchM: 1.0,
  maxPitchRad: 1.45,
  /** Below this speed the player makes no walking noise. */
  movingSpeedMps: 0.3,

  // Lens
  normalFovDeg: 78,
  lensFovDeg: 42,
  lensRaiseTimeSec: 0.18,
  /** The lens counts as up (REC light on, Thing visible) once raise passes this. */
  lensVisibleRaise: 0.6,
  /** Anything inside this angle from the look direction is on the tape. Wider than the frame. */
  lensVisibleHalfAngleDeg: 40,
  /** The focus box. Only the Thing inside this angle fills the notice meter. */
  lensNoticeHalfAngleDeg: 18,
  lensRangeM: 14,
  batteryLifeSec: 90,
  batteryRechargePerSec: 1 / 225,
  /** After the battery dies the lens stays locked until it recharges to this level. */
  batteryUnlockLevel: 0.1,
  /** Finding a tape tops the battery up by this much. */
  tapeBatteryBonus: 0.5,

  // Notice meter
  noticeFillPerSec: 0.4,
  /** Fill multiplier when the Thing can also see the REC light. */
  recLightFillMultiplier: 2,
  /** Extra fill from the REC light alone, even when the Thing is not in the focus box. */
  recLightFillPerSec: 0.1,
  recLightRangeM: 6,
  noticeDecayPerSec: 0.25,

  // The Thing
  thingCenterHeightM: 1.1,
  thingRadiusM: 0.35,
  noiseWalkRadiusM: 2.5,
  noiseSprintRadiusM: 8,
  catchRadiusM: 0.8,
  actWanderSpeedMps: [0.7, 0.9, 1.1],
  actStalkSpeedMps: [1.0, 1.2, 1.5],
  /** Act 1 rush is slower than a sprint on purpose: it teaches that running works, once. */
  actRushSpeedMps: [3.0, 5.0, 5.2],
  actRushDurationSec: [4, 6, 7],
  /** After a rush ends the meter cannot fill for this long. */
  actRushCooldownSec: [6, 4, 2.5],
  actNoticeFillScale: [0.8, 1, 1.2],
  wanderPauseSec: 2,
  stalkGiveUpSec: 3,
  /** Doors slow the Thing but do not stop it. */
  doorBreakSec: 2.0,

  // Hiding
  /** A rushing Thing this close to a hidden player stops and searches. */
  searchRadiusM: 1.8,
  searchSec: 3.5,

  // Interaction
  interactRangeM: 1.6,
  interactHalfAngleDeg: 55,
  /** Closing a door is refused if anyone stands this close to it. */
  doorClearM: 1.0,

  // Finale
  vcrHoldSecHold: 20,
  vcrHoldSecRun: 2,
  /** Progress lost per second when you let go, as a fraction of the fill rate. */
  vcrDecayFactor: 0.5,
  /** Holding the VCR is loud. The Thing hears it from this far. */
  vcrNoiseRadiusM: 9,
  /** In the run finale the Thing hunts without ever giving up, a little slower than a sprint. */
  rageSpeedMps: 4.0,
  winRadiusM: 1.0,

  // Rewind
  rewindRestartSec: 0.4,
  /** On rewind the Thing respawns at least this far from you when the level allows it. */
  thingRespawnMinDistM: 10,
  /** After a catch the Thing stands still and deaf this long, so waking up is never an instant second catch. */
  wakeGraceSec: 3,

  // Echo: record a clip of yourself, rewind, and your tape-self plays it back beside you
  /** The tape runs out and stops itself after this long. */
  recordMaxSec: 15,
  /** A clip shorter than this is thrown away. */
  recordMinSec: 0.6,
  /** A body counts as standing on a plate inside this distance of its centre. */
  plateRadiusM: 0.55,
  /** Walk over a tape to take it. */
  tapePickupRadiusM: 0.8,
} as const;

export const DT_SEC = 1 / TUNING.tickHz;

export function secToTicks(sec: number): number {
  return Math.round(sec * TUNING.tickHz);
}

/** Reads a per-act tuning array. Act is 1 to 3. */
export function perAct(values: readonly number[], act: number): number {
  const v = values[Math.max(0, Math.min(values.length - 1, act - 1))];
  if (v === undefined) throw new Error('empty per-act tuning');
  return v;
}
