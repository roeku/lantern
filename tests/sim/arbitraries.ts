/**
 * Shared fast-check arbitraries and state builders for sim tests.
 * Imports only from src/sim/* modules (not index.ts).
 */

import fc from 'fast-check';
import { createState, type Input, type PlayerId, type State } from '../../src/sim/state';
import { TUNING, type Tuning } from '../../src/sim/tuning';

/** Tuning with a short show length (seconds). */
export function shortTuning(seconds: number): Tuning {
  return { ...TUNING, showLengthS: seconds };
}

/** Seeds as 32-bit integers (signed and unsigned range). */
export const seedArb: fc.Arbitrary<number> = fc.integer({ min: -0x80000000, max: 0xffffffff });

/** Grid cell count for a tuning. */
export function cellCount(tuning: Tuning = TUNING): number {
  return tuning.roomWidthM * tuning.roomDepthM;
}

const density = fc.double({ min: 0, max: 1, noNaN: true });

/** Densities in [0, 1], length roomWidthM * roomDepthM. */
export function gridArb(tuning: Tuning = TUNING): fc.Arbitrary<number[]> {
  const n = cellCount(tuning);
  const w = tuning.roomWidthM;
  const d = tuning.roomDepthM;
  const empty = fc.constant(new Array<number>(n).fill(0));
  const full = fc.constant(new Array<number>(n).fill(1));
  // Edge-heavy: dense along the room border, sparse inside.
  const edgeHeavy = fc.array(density, { minLength: n, maxLength: n }).map((cells) =>
    cells.map((v, i) => {
      const col = i % w;
      const row = Math.floor(i / w);
      const onEdge = col === 0 || row === 0 || col === w - 1 || row === d - 1;
      return onEdge ? 1 - v * 0.1 : v * 0.1;
    }),
  );
  // Extremes only (0 or 1) to stress clamping.
  const extremes = fc.array(fc.constantFrom(0, 1), { minLength: n, maxLength: n });
  return fc.oneof(
    { arbitrary: fc.array(density, { minLength: n, maxLength: n }), weight: 4 },
    { arbitrary: empty, weight: 1 },
    { arbitrary: full, weight: 1 },
    { arbitrary: edgeHeavy, weight: 2 },
    { arbitrary: extremes, weight: 1 },
  );
}

/** Build a state from a seed, optionally with a grid and tuning. */
export function makeState(seed: number, grid?: number[], tuning: Tuning = TUNING): State {
  const s = createState(seed, tuning);
  if (grid) s.grid = grid.slice();
  return s;
}

/** Players: the showman, ordinary players, and spectators (unknown ids). */
export function playerArb(tuning: Tuning = TUNING): fc.Arbitrary<PlayerId> {
  const showman = tuning.showmanIdDefault;
  return fc.oneof(
    { arbitrary: fc.constant(showman), weight: 3 },
    { arbitrary: fc.integer({ min: showman + 1, max: showman + 6 }), weight: 4 },
    { arbitrary: fc.integer({ min: -3, max: showman - 1 }), weight: 1 },
    { arbitrary: fc.integer({ min: 1000, max: 1010 }), weight: 1 },
  );
}

const dirArb = fc.constantFrom<1 | -1>(1, -1);

const weirdNumber = fc.constantFrom(NaN, Infinity, -Infinity, -1, 1e9, -1e9);

/** Vent index: mostly valid, sometimes out of range or non-integer. */
function ventArb(tuning: Tuning): fc.Arbitrary<number> {
  const n = tuning.ventPositions.length;
  return fc.oneof(
    { arbitrary: fc.integer({ min: 0, max: Math.max(0, n - 1) }), weight: 6 },
    { arbitrary: fc.integer({ min: n, max: n + 5 }), weight: 1 },
    { arbitrary: fc.integer({ min: -5, max: -1 }), weight: 1 },
    { arbitrary: fc.constantFrom(NaN, 0.5, Infinity), weight: 1 },
  );
}

/** Candle id: mostly valid, sometimes unknown. */
function candleArb(tuning: Tuning): fc.Arbitrary<number> {
  const n = tuning.spectatorStartPositions.length;
  return fc.oneof(
    { arbitrary: fc.integer({ min: 0, max: Math.max(0, n - 1) }), weight: 6 },
    { arbitrary: fc.integer({ min: n, max: n + 20 }), weight: 1 },
    { arbitrary: fc.integer({ min: -5, max: -1 }), weight: 1 },
    { arbitrary: fc.constantFrom(NaN, 0.5), weight: 1 },
  );
}

const angleArb = fc.oneof(
  { arbitrary: fc.double({ min: -Math.PI, max: 2 * Math.PI, noNaN: true }), weight: 6 },
  { arbitrary: weirdNumber, weight: 1 },
);

function fanCoordArb(max: number): fc.Arbitrary<number> {
  return fc.oneof(
    { arbitrary: fc.double({ min: 0, max, noNaN: true }), weight: 6 },
    { arbitrary: fc.double({ min: -max, max: 2 * max, noNaN: true }), weight: 2 }, // out of room
    { arbitrary: weirdNumber, weight: 1 },
  );
}

const eventIdArb = fc.oneof(
  fc.constantFrom('e1', 'e2', 'e3', 'dup'),
  fc.string({ minLength: 0, maxLength: 8 }),
);

/** Any Input kind, including invalid values. */
export function inputArb(tuning: Tuning = TUNING): fc.Arbitrary<Input> {
  const player = playerArb(tuning);
  const candle = candleArb(tuning);
  return fc.oneof(
    fc.record({ player, kind: fc.constant('puff' as const), vent: ventArb(tuning) }),
    fc.record({ player, kind: fc.constant('roll' as const), dir: dirArb }),
    fc.record({ player, kind: fc.constant('rush' as const), dir: dirArb }),
    fc.record({ player, kind: fc.constant('aim' as const), angle: angleArb }),
    fc.record({
      player,
      kind: fc.constant('fan' as const),
      x: fanCoordArb(tuning.roomWidthM),
      y: fanCoordArb(tuning.roomDepthM),
    }),
    fc.record({ player, kind: fc.constant('shield' as const), candle }),
    fc.record({ player, kind: fc.constant('unshield' as const), candle }),
    fc.record({ player, kind: fc.constant('light' as const), candle }),
    fc.record({ player, kind: fc.constant('snuff' as const), eventId: eventIdArb, candle }),
  );
}

/** Input excluding puffs. */
export function noPuffInputArb(tuning: Tuning = TUNING): fc.Arbitrary<Input> {
  return inputArb(tuning).filter((i) => i.kind !== 'puff');
}

/** Per-tick input lists. */
export function inputSequenceArb(
  tuning: Tuning = TUNING,
  maxTicks = 40,
  maxPerTick = 4,
): fc.Arbitrary<Input[][]> {
  return fc.array(fc.array(inputArb(tuning), { maxLength: maxPerTick }), { maxLength: maxTicks });
}

/** Per-tick input lists with no puffs. */
export function noPuffInputSequenceArb(
  tuning: Tuning = TUNING,
  maxTicks = 40,
  maxPerTick = 4,
): fc.Arbitrary<Input[][]> {
  return fc.array(fc.array(noPuffInputArb(tuning), { maxLength: maxPerTick }), {
    maxLength: maxTicks,
  });
}
