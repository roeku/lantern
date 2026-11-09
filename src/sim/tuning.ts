/**
 * Every tuning number for the smoke and projection simulation lives here.
 * Rule code reads these values and contains no other numeric constants
 * (apart from the literals 0 and 1).
 */

export interface Tuning {
  /** Tick length in seconds. */
  tickS: number;
  /** Show length in seconds. */
  showLengthS: number;

  /** Room size in metres. Both must be positive integers. */
  roomWidthM: number;
  roomDepthM: number;

  /** Puff: density added and radius around a vent. */
  puffDensity: number;
  puffRadiusM: number;

  /** Smoke: per-second decay and spread rates. */
  smokeDecayPerS: number;
  smokeSpreadPerS: number;

  /** Solidity: threshold is solidityThresholdBase x imageScale^2. */
  solidityThresholdBase: number;

  /** Cart travel limit (m), roll and rush speeds (m/s). */
  cartTravelMaxM: number;
  cartRollSpeedMps: number;
  cartRushSpeedMps: number;
  /** Beam origin is (cartOriginXM, cartTrackStartYM + travel). */
  cartOriginXM: number;
  cartTrackStartYM: number;

  /** Image scale is linear in travel between these bounds. */
  imageScaleMin: number;
  imageScaleMax: number;

  /** Beam cone half-angle (radians) and placeholder slide reach (m). */
  beamHalfAngleRad: number;
  placeholderSlideReachM: number;

  /** Fan: radius (m), duration (s) and cooldown (s). */
  fanRadiusM: number;
  fanDurationS: number;
  fanCooldownS: number;

  /** Snuff radius at image scale 1 (m). */
  snuffRadiusBaseM: number;

  /** Vent positions as [x, y] metres. */
  ventPositions: [number, number][];

  /** Seed used when a caller gives none. */
  rngSeedDefault: number;

  /** Player id of the Showman in a new round. */
  showmanIdDefault: number;
  /** Starting beam angle in radians (pi/2 points from the cart toward the audience, +y). */
  beamAngleDefaultRad: number;
  /** Spectator start positions as [x, y] metres, exactly 3. Each Candle starts at its owner's position. */
  spectatorStartPositions: [number, number][];

  /** Number of ropes. Must equal ropePositions.length. */
  ropeCount: number;
  /** Rope positions as [x, y] metres. Ids are the list indexes. */
  ropePositions: [number, number][];
  /** Candle light radius when lit (m). */
  litCandleRadiusM: number;
  /** Candle light radius when shielded (m). */
  shieldedCandleRadiusM: number;
  /** Spectator walking speed (m/s). */
  spectatorSpeedMps: number;
  /** Furthest a Spectator can aim a fan from themselves (m). Client only. */
  fanReachM: number;
  /** A ghost this close to an unsnuffed candle counts as a near miss (m). */
  nearMissRadiusM: number;
  /** A rope is cut after its cutter holds the cut for this long (s). */
  ropeCutHoldS: number;
  /** A cutter's candle must be within this distance of the rope (m, inclusive). */
  ropeCutRadiusM: number;

  /** Spectator bots: how far beyond the snuff radius a bot starts to react (m). */
  botWarnMarginM: number;
  /** Spectator bots: chance per tick, in (0, 1], that a bot acts. Sets its reaction time. */
  botReactChancePerTick: number;
  /** Spectator bots: the first bot starts cutting its rope this long into the show (s). */
  botCutStartS: number;
  /** Spectator bots: each next bot starts cutting this much later than the one before (s). */
  botCutStaggerS: number;
}

export const TUNING: Tuning = {
  tickS: 0.05,
  showLengthS: 300,

  roomWidthM: 16,
  roomDepthM: 12,

  puffDensity: 0.6,
  puffRadiusM: 2,

  smokeDecayPerS: 0.05,
  smokeSpreadPerS: 0.2,

  solidityThresholdBase: 0.5,

  cartTravelMaxM: 8,
  cartRollSpeedMps: 1,
  cartRushSpeedMps: 4,
  cartOriginXM: 8,
  cartTrackStartYM: 2,

  imageScaleMin: 0.6,
  imageScaleMax: 1.3,

  beamHalfAngleRad: 0.15,
  placeholderSlideReachM: 12,

  fanRadiusM: 2,
  fanDurationS: 3,
  fanCooldownS: 8,

  snuffRadiusBaseM: 0.6,

  ventPositions: [
    [2.5, 6],
    [8, 11],
    [13.5, 6],
  ],

  rngSeedDefault: 1,

  showmanIdDefault: 0,
  beamAngleDefaultRad: Math.PI / 2,
  spectatorStartPositions: [
    [2.5, 1.5],
    [13.5, 1.5],
    [8.5, 4.5],
  ],
  ropeCount: 3,
  // Two far corners and one near the cart track, so cutting means leaving cover.
  ropePositions: [
    [2.5, 9.5],
    [13.5, 9.5],
    [8.5, 6.5],
  ],
  ropeCutHoldS: 4,
  ropeCutRadiusM: 1,
  litCandleRadiusM: 3,
  shieldedCandleRadiusM: 1,
  spectatorSpeedMps: 3,
  fanReachM: 4,
  nearMissRadiusM: 1,

  botWarnMarginM: 1.5,
  botReactChancePerTick: 0.25,
  // Bots start cutting at 60 s, 90 s and 120 s of a 300 s show, so the Showman has time to play.
  botCutStartS: 60,
  botCutStaggerS: 30,
};

/** Fields that must be finite numbers greater than 0. */
const POSITIVE_FIELDS = [
  'tickS',
  'showLengthS',
  'roomWidthM',
  'roomDepthM',
  'puffDensity',
  'puffRadiusM',
  'smokeDecayPerS',
  'smokeSpreadPerS',
  'solidityThresholdBase',
  'cartTravelMaxM',
  'cartRollSpeedMps',
  'cartRushSpeedMps',
  'imageScaleMin',
  'imageScaleMax',
  'beamHalfAngleRad',
  'placeholderSlideReachM',
  'fanRadiusM',
  'fanDurationS',
  'fanCooldownS',
  'snuffRadiusBaseM',
  'botWarnMarginM',
  'botReactChancePerTick',
  'ropeCutHoldS',
  'ropeCutRadiusM',
  'ropeCount',
  'litCandleRadiusM',
  'shieldedCandleRadiusM',
  'spectatorSpeedMps',
  'fanReachM',
  'nearMissRadiusM',
] as const;

/** Fields that must be finite numbers, zero allowed, never negative. */
const NON_NEGATIVE_FIELDS = ['botCutStartS', 'botCutStaggerS'] as const;

/** Fields that must be finite numbers (zero is allowed). */
const FINITE_FIELDS = [
  'cartOriginXM',
  'cartTrackStartYM',
  'rngSeedDefault',
  'showmanIdDefault',
  'beamAngleDefaultRad',
] as const;

/** Spectator seats in a round (four players minus the Showman). */
const SPECTATOR_COUNT = 3;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Throws an Error naming the invalid field when the tuning cannot be used.
 * Accepts unknown shapes at runtime so missing fields are reported by name.
 */
export function validateTuning(t: Tuning): void {
  const r = t as unknown as Record<string, unknown>;

  for (const name of POSITIVE_FIELDS) {
    const v = r[name];
    if (!isFiniteNumber(v) || v <= 0) {
      throw new Error(`Invalid TUNING field "${name}": must be a finite number greater than 0`);
    }
  }
  for (const name of NON_NEGATIVE_FIELDS) {
    const v = r[name];
    if (!isFiniteNumber(v) || v < 0) {
      throw new Error(`Invalid TUNING field "${name}": must be a finite number, 0 or greater`);
    }
  }
  for (const name of FINITE_FIELDS) {
    if (!isFiniteNumber(r[name])) {
      throw new Error(`Invalid TUNING field "${name}": must be a finite number`);
    }
  }
  for (const name of ['roomWidthM', 'roomDepthM'] as const) {
    if (!Number.isInteger(r[name])) {
      throw new Error(`Invalid TUNING field "${name}": must be a positive integer`);
    }
  }

  for (const name of ['ventPositions', 'spectatorStartPositions', 'ropePositions'] as const) {
    const list = r[name];
    const bad = `Invalid TUNING field "${name}": must be a list of [x, y] pairs`;
    if (!Array.isArray(list)) throw new Error(bad);
    for (const v of list as unknown[]) {
      if (!Array.isArray(v) || v.length !== 2 || !isFiniteNumber(v[0]) || !isFiniteNumber(v[1])) {
        throw new Error(bad);
      }
    }
  }

  if (!Number.isInteger(t.ropeCount)) {
    throw new Error('Invalid TUNING field "ropeCount": must be a positive integer');
  }
  if (t.ropePositions.length !== t.ropeCount) {
    throw new Error('Invalid TUNING field "ropePositions": length must equal ropeCount');
  }
  if (t.spectatorStartPositions.length !== SPECTATOR_COUNT) {
    throw new Error(
      `Invalid TUNING field "spectatorStartPositions": must hold exactly ${SPECTATOR_COUNT} positions`,
    );
  }
  for (const name of ['ropePositions', 'spectatorStartPositions'] as const) {
    for (const [x, y] of t[name]) {
      if (x < 0 || x > t.roomWidthM || y < 0 || y > t.roomDepthM) {
        throw new Error(`Invalid TUNING field "${name}": every position must lie inside the room`);
      }
    }
  }

  if (t.botReactChancePerTick > 1) {
    throw new Error('Invalid TUNING field "botReactChancePerTick": must not exceed 1');
  }
  if (t.imageScaleMax < t.imageScaleMin) {
    throw new Error('Invalid TUNING field "imageScaleMax": must not be less than imageScaleMin');
  }
  if (t.solidityThresholdBase * t.imageScaleMax * t.imageScaleMax > 1) {
    throw new Error(
      'Invalid TUNING field "solidityThresholdBase": solidityThresholdBase x imageScaleMax^2 must not exceed 1',
    );
  }
  // 4 x spread coefficient must stay at or under 1 for stable diffusion.
  if (4 * t.smokeSpreadPerS * t.tickS > 1) {
    throw new Error(
      'Invalid TUNING field "smokeSpreadPerS": 4 x smokeSpreadPerS x tickS must not exceed 1',
    );
  }
}
