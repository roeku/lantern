// Pure seeded RNG (mulberry32). State is a uint32 stored in State.rng.
// next(rngState) returns [value in [0, 1), advancedRngState].

// Algorithm constants of mulberry32 (not tuning values).
const GOLDEN_INCREMENT = 0x6d2b79f5;
const SHIFT_A = 15;
const SHIFT_B = 7;
const SHIFT_C = 14;
const MIX_OR = 61;
const UINT32_RANGE = 0x100000000;

/** Coerce any number to a uint32 RNG state. Non-finite input maps to 0. */
export function toRngState(seed: number): number {
  return Number.isFinite(seed) ? seed >>> 0 : 0;
}

/** Advance the generator once. Never mutates; returns [value in [0, 1), new state]. */
export function next(rngState: number): [number, number] {
  const state = (toRngState(rngState) + GOLDEN_INCREMENT) >>> 0;
  let t = Math.imul(state ^ (state >>> SHIFT_A), 1 | state);
  t = (t + Math.imul(t ^ (t >>> SHIFT_B), MIX_OR | t)) ^ t;
  const value = ((t ^ (t >>> SHIFT_C)) >>> 0) / UINT32_RANGE;
  return [value, state];
}

/**
 * Deterministic roll in [0, 1) for one player on one tick, derived from
 * (state.rng, state.tick, player). Never reads or changes state.rng.
 */
export function deterministicRoll(state: { rng: number; tick: number }, player: number): number {
  let rngState = toRngState(state.rng + state.tick);
  let value = 0;
  for (let i = 0; i <= player; i++) [value, rngState] = next(rngState);
  return value;
}
