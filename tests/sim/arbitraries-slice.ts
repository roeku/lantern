/**
 * Shared fast-check arbitraries and helpers for the vertical-slice property tests.
 * Complements tests/sim/arbitraries.ts (which stays unchanged).
 * Imports only from src/sim/* modules (not index.ts).
 */

import fc from 'fast-check';
import { ropeCutHoldTicks } from '../../src/sim/ropes';
import { createState, type Input, type PlayerId, type Rope, type State } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { TUNING, type Tuning } from '../../src/sim/tuning';

export { seedArb } from './arbitraries';

const SEAT_COUNT = 4;

/** Seat ids 0..3 as Showman. */
export function showmanIdArb(): fc.Arbitrary<PlayerId> {
  return fc.integer({ min: 0, max: SEAT_COUNT - 1 });
}

/** Non-Showman seat ids for a state. */
export function spectatorIds(state: State): PlayerId[] {
  return state.spectators.map((s) => s.player);
}

// ---------- State builders ----------

/** Rope states: each rope standing with any progress, or cut with a past tick. */
export function ropesArb(tuning: Tuning = TUNING): fc.Arbitrary<Rope[]> {
  const hold = ropeCutHoldTicks(tuning);
  const one = (id: number): fc.Arbitrary<Rope> => {
    const [x, y] = tuning.ropePositions[id] as [number, number];
    return fc.oneof(
      fc
        .integer({ min: 0, max: Math.max(0, hold - 1) })
        .map((cutProgressTicks): Rope => ({ id, x, y, status: 'standing', cutProgressTicks, cutTick: null })),
      fc
        .integer({ min: 0, max: 100 })
        .map((cutTick): Rope => ({ id, x, y, status: 'cut', cutProgressTicks: hold, cutTick })),
    );
  };
  return fc.tuple(...tuning.ropePositions.map((_, id) => one(id))) as unknown as fc.Arbitrary<Rope[]>;
}

/** A state with arbitrary rope states and Spectators placed anywhere in the room. */
export function ropeStateArb(tuning: Tuning = TUNING): fc.Arbitrary<State> {
  const pos = fc.tuple(
    fc.double({ min: 0, max: tuning.roomWidthM, noNaN: true }),
    fc.double({ min: 0, max: tuning.roomDepthM, noNaN: true }),
  );
  return fc
    .tuple(
      fc.integer({ min: 0, max: 0xffffffff }),
      showmanIdArb(),
      ropesArb(tuning),
      fc.array(pos, { minLength: SEAT_COUNT - 1, maxLength: SEAT_COUNT - 1 }),
      fc.array(fc.constantFrom<'lit' | 'shielded' | 'snuffed'>('lit', 'shielded', 'snuffed'), {
        minLength: SEAT_COUNT - 1,
        maxLength: SEAT_COUNT - 1,
      }),
    )
    .map(([seed, showmanId, ropes, positions, statuses]) => {
      const s = createState(seed, tuning, { showmanId });
      s.ropes = ropes;
      s.spectators.forEach((sp, i) => {
        const [x, y] = positions[i] as [number, number];
        sp.x = x;
        sp.y = y;
      });
      s.candles.forEach((c, i) => {
        const sp = s.spectators.find((p) => p.candleId === c.id);
        c.x = sp?.x ?? c.x;
        c.y = sp?.y ?? c.y;
        c.status = statuses[i] as 'lit' | 'shielded' | 'snuffed';
      });
      s.snuffedCount = s.candles.filter((c) => c.status === 'snuffed').length;
      return s;
    });
}

/** Which edge of the outcome rule a near-edge state sits next to. */
export type OutcomeEdge = 'last_rope' | 'last_candle' | 'time_up' | 'rope_and_candle';

/**
 * States next to an outcome edge. `last_rope`: one standing rope with a lit Cutter on it
 * and progress at hold-1; stepping with the returned `inputs` cuts it (spectators win).
 * `time_up`: tick is showLength/tickS - 1; any step ends the round (showman wins).
 * `last_candle`: exactly one live candle, no guaranteed outcome (a snuff needs a ghost).
 * `rope_and_candle`: the rope edge plus every other candle snuffed.
 */
export function nearOutcomeStateArb(
  tuning: Tuning = TUNING,
): fc.Arbitrary<{ state: State; edge: OutcomeEdge; inputs: Input[] }> {
  const hold = ropeCutHoldTicks(tuning);
  const lastTick = Math.round(tuning.showLengthS / tuning.tickS) - 1;
  return fc
    .tuple(
      fc.integer({ min: 0, max: 0xffffffff }),
      showmanIdArb(),
      fc.constantFrom<OutcomeEdge>('last_rope', 'last_candle', 'time_up', 'rope_and_candle'),
      fc.integer({ min: 0, max: tuning.ropeCount - 1 }),
      fc.integer({ min: 0, max: SEAT_COUNT - 2 }),
    )
    .map(([seed, showmanId, edge, ropeIdx, liveIdx]) => {
      const s = createState(seed, tuning, { showmanId });
      const nearRope = edge === 'last_rope' || edge === 'rope_and_candle';
      const nearCandle = edge === 'last_candle' || edge === 'rope_and_candle';
      if (edge === 'time_up') s.tick = lastTick;
      // Keep one rope standing in every case but the final-rope states' rope is also the last.
      if (nearRope) {
        s.ropes.forEach((r) => {
          if (r.id !== ropeIdx) {
            r.status = 'cut';
            r.cutProgressTicks = hold;
            r.cutTick = 0;
          }
        });
        const rope = s.ropes[ropeIdx] as Rope;
        rope.cutProgressTicks = hold - 1;
      }
      if (nearCandle) {
        s.candles.forEach((c) => {
          if (c.id !== liveIdx) c.status = 'snuffed';
        });
        s.snuffedCount = s.candles.filter((c) => c.status === 'snuffed').length;
      }
      const inputs: Input[] = [];
      if (nearRope) {
        // Put the lit Spectator on the rope so the cut input is valid.
        const rope = s.ropes[ropeIdx] as Rope;
        const sp = s.spectators[liveIdx];
        const candle = s.candles.find((c) => c.id === sp?.candleId);
        if (sp !== undefined && candle !== undefined) {
          sp.x = rope.x;
          sp.y = rope.y;
          candle.x = rope.x;
          candle.y = rope.y;
          candle.status = 'lit';
          s.snuffedCount = s.candles.filter((c) => c.status === 'snuffed').length;
          inputs.push({ player: sp.player, kind: 'cut', rope: ropeIdx });
        }
      }
      return { state: s, edge, inputs };
    });
}

// ---------- Inputs ----------

const hostileNumber = fc.constantFrom(NaN, Infinity, -Infinity, -1, 1e9, -1e9, 0);

function validSpectator(state: State): fc.Arbitrary<PlayerId> {
  return fc.constantFrom(...spectatorIds(state));
}

/** Valid inputs from a real Spectator of `state` (own candle, existing rope, finite values). */
export function validSpectatorInputArb(state: State, tuning: Tuning = TUNING): fc.Arbitrary<Input> {
  const player = validSpectator(state);
  const own = (p: PlayerId): number => state.spectators.find((s) => s.player === p)?.candleId ?? 0;
  const unit = fc.double({ min: -1, max: 1, noNaN: true });
  return fc.oneof(
    fc.record({ player, kind: fc.constant('move' as const), dx: unit, dy: unit }),
    player.chain((p) =>
      fc.record({
        player: fc.constant(p),
        kind: fc.constant('cut' as const),
        rope: fc.integer({ min: 0, max: tuning.ropeCount - 1 }),
      }),
    ),
    fc.record({
      player,
      kind: fc.constant('fan' as const),
      x: fc.double({ min: 0, max: tuning.roomWidthM, noNaN: true }),
      y: fc.double({ min: 0, max: tuning.roomDepthM, noNaN: true }),
    }),
    player.chain((p) =>
      fc.record({
        player: fc.constant(p),
        kind: fc.constantFrom('shield' as const, 'unshield' as const, 'light' as const),
        candle: fc.constant(own(p)),
      }),
    ),
  );
}

/**
 * Hostile inputs: Showman senders for Spectator kinds, unknown players, other Spectators'
 * candles, missing ropes, non-finite vectors and coordinates.
 */
export function hostileSpectatorInputArb(state: State, tuning: Tuning = TUNING): fc.Arbitrary<Input> {
  const player = fc.oneof(
    { arbitrary: fc.constant(state.showmanId), weight: 2 },
    { arbitrary: validSpectator(state), weight: 4 },
    { arbitrary: fc.integer({ min: 100, max: 110 }), weight: 1 },
    { arbitrary: fc.integer({ min: -5, max: -1 }), weight: 1 },
  );
  const badRope = fc.oneof(
    fc.integer({ min: tuning.ropeCount, max: tuning.ropeCount + 10 }),
    fc.integer({ min: -5, max: -1 }),
    fc.constantFrom(NaN, 0.5, Infinity),
    fc.integer({ min: 0, max: tuning.ropeCount - 1 }), // may be already cut
  );
  const anyCandle = fc.oneof(
    fc.integer({ min: 0, max: SEAT_COUNT - 2 }), // possibly someone else's
    fc.integer({ min: SEAT_COUNT, max: SEAT_COUNT + 10 }),
    fc.constantFrom(NaN, -1, 0.5),
  );
  return fc.oneof(
    fc.record({ player, kind: fc.constant('move' as const), dx: hostileNumber, dy: hostileNumber }),
    fc.record({
      player,
      kind: fc.constant('move' as const),
      dx: fc.double({ min: -50, max: 50, noNaN: true }),
      dy: fc.double({ min: -50, max: 50, noNaN: true }),
    }),
    fc.record({ player, kind: fc.constant('cut' as const), rope: badRope }),
    fc.record({ player, kind: fc.constant('fan' as const), x: hostileNumber, y: hostileNumber }),
    fc.record({
      player,
      kind: fc.constantFrom('shield' as const, 'unshield' as const, 'light' as const),
      candle: anyCandle,
    }),
  );
}

/** Mixed valid and hostile inputs for one tick. */
export function spectatorInputArb(state: State, tuning: Tuning = TUNING): fc.Arbitrary<Input> {
  return fc.oneof(
    { arbitrary: validSpectatorInputArb(state, tuning), weight: 3 },
    { arbitrary: hostileSpectatorInputArb(state, tuning), weight: 2 },
  );
}

/** Per-tick input lists for a state's seats. */
export function spectatorInputSequenceArb(
  state: State,
  tuning: Tuning = TUNING,
  maxTicks = 40,
  maxPerTick = 4,
): fc.Arbitrary<Input[][]> {
  return fc.array(fc.array(spectatorInputArb(state, tuning), { maxLength: maxPerTick }), {
    maxLength: maxTicks,
  });
}

// ---------- Rounds ----------

export interface PlayedRound {
  /** states[0] is the initial state; states[i + 1] is the state after inputs[i]. */
  states: State[];
  /** The input list per tick, as given. */
  inputs: Input[][];
}

/** Play a round from `seed` with `showmanId`, one step per entry of `inputsPerTick`. */
export function playRound(
  seed: number,
  showmanId: PlayerId,
  inputsPerTick: readonly (readonly Input[])[],
  tuning: Tuning = TUNING,
): PlayedRound {
  const states: State[] = [createState(seed, tuning, { showmanId })];
  const inputs: Input[][] = [];
  for (const tickInputs of inputsPerTick) {
    const list = tickInputs.map((i) => structuredClone(i));
    inputs.push(list);
    states.push(step(states[states.length - 1] as State, list, tuning));
  }
  return { states, inputs };
}

/** Seed, Showman seat and per-tick inputs (valid and hostile, any seat) for a round. */
export function roundArb(
  tuning: Tuning = TUNING,
  maxTicks = 40,
): fc.Arbitrary<{ seed: number; showmanId: PlayerId; inputsPerTick: Input[][] }> {
  return fc
    .tuple(fc.integer({ min: -0x80000000, max: 0xffffffff }), showmanIdArb())
    .chain(([seed, showmanId]) =>
      spectatorInputSequenceArb(createState(seed, tuning, { showmanId }), tuning, maxTicks).map(
        (inputsPerTick) => ({ seed, showmanId, inputsPerTick }),
      ),
    );
}
