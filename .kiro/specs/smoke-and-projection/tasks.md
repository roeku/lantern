# Implementation Plan: Smoke and Projection

## Overview

Implement the pure simulation in `src/sim` in TypeScript, following `design.md`. The workspace has no `package.json` yet, so the plan starts with project setup (vitest, fast-check, the `FC_NUM_RUNS` setup file). It then builds tuning, RNG and state, the smoke, cart, beam, ghost and candle modules, and finally `step`. Each of the 7 correctness properties is one fast-check test. Rule code reads every number from `TUNING` and imports no DOM or Three.js modules.

## Tasks

- [x] 1. Set up the project and test harness
  - [x] 1.1 Create `package.json`, `tsconfig.json` and `vitest.config.ts`
    - No `package.json` exists, so create one with scripts `test` (`vitest --run`) and `typecheck` (`tsc --noEmit`)
    - Add dev dependencies `typescript`, `vitest` and `fast-check` at exact pinned versions
    - Use strict TypeScript, `"type": "module"`, and include `src` and `tests`
    - Register `tests/sim/setup.ts` in `setupFiles` and set the test include glob to `tests/**/*.test.ts`
    - Run the install command to create the lock file
    - _Requirements: 12.1, 12.6_

  - [x] 1.2 Create the fast-check setup file `tests/sim/setup.ts`
    - Export `parseNumRuns(raw)`: return 100 for unset or empty, and for any value that is not a base-10 integer in 1 to 1,000,000
    - Call `fc.configureGlobal({ numRuns: parseNumRuns(process.env.FC_NUM_RUNS) })`
    - Must not throw for invalid values
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 1.3 Write unit tests for `parseNumRuns`
    - Cover unset, empty string, `"250"`, `"0"`, `"1000001"`, `"12abc"`, `"1e3"`, `" 5"` and `"-3"`
    - Import the parser directly as a plain function; this is not one of the 7 properties
    - _Requirements: 12.2, 12.3_

- [x] 2. Implement tuning, RNG and state
  - [x] 2.1 Implement `src/sim/tuning.ts`
    - Define the `Tuning` type and the `TUNING` object with every starting value from the design table (including `tickS`, `cartOriginXM`, `cartTrackStartYM`, `imageScaleMin`, `imageScaleMax`, `beamHalfAngleRad`, `placeholderSlideReachM`, `ventPositions`, `rngSeedDefault`)
    - Implement `validateTuning` to throw an error naming the invalid field for missing, non-numeric, NaN or non-positive duration, radius, speed or length fields
    - Also reject `imageScaleMax < imageScaleMin`, `solidityThresholdBase x imageScaleMax^2 > 1` and `4 x smokeSpreadPerS x tickS > 1`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 2.2 Implement `src/sim/rng.ts`
    - Pure mulberry32-style generator: `next(rngState) -> [value, rngState]`, uint32 state
    - No `Math.random`
    - _Requirements: 1.4, 1.5_

  - [x] 2.3 Implement `src/sim/state.ts`
    - Define `State`, `Input`, `Ghost` and candle types from the design
    - Implement `createState(seed, tuning?)` that validates tuning, builds an empty grid of `roomWidthM x roomDepthM` cells, the cart at travel 0, the default beam angle, no fans, candles, `showmanId`, and `ended = false`
    - Use plain serializable data only (no `undefined`, `Map`, `Set`, functions, `NaN` or `Infinity`)
    - _Requirements: 1.6, 2.1, 2.2, 11.3_

  - [x] 2.4 Write unit tests for tuning and state creation
    - Check each starting value, each `validateTuning` failure naming its field, and the 192-cell grid
    - Check that `createState` output survives a JSON round trip
    - _Requirements: 2.1, 11.1, 11.2, 11.3_

- [x] 3. Implement the smoke module
  - [x] 3.1 Implement `src/sim/smoke.ts`
    - `puff` for an existing vent: add `puffDensity` to cells whose centre `(col + 0.5, row + 0.5)` is within `puffRadiusM` (inclusive), clamp to 1, ignore cells outside the grid
    - `decay`: subtract `smokeDecayPerS x tickS`, clamp at 0
    - `spread`: Jacobi-style update from a snapshot in row-major order with `k = smokeSpreadPerS x tickS`; missing neighbours at walls contribute nothing
    - Fan helpers: accept a fan (position inside the room, cooldown elapsed), set `ticksLeft` and `fanReadyTick`, test whether a cell is fanned, zero fanned cells, count down and drop expired fans
    - Clamp every stored density to [0, 1], storing 0 for non-finite values
    - Do not mutate arguments
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 3.2 Write unit tests for the smoke module
    - Single puff on an empty grid, puff cap at 1, puff at a corner, invalid vent
    - Exact decay and spread numbers, no flux across a wall, total conserved by spread
    - Fan clears, holds, releases, cooldown ignore, and out-of-room fan starts no cooldown
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 4.1, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.6_

- [x] 4. Implement cart and beam
  - [x] 4.1 Implement `src/sim/cart.ts`
    - `roll` and `rush` change travel by speed x `tickS` in the requested direction, clamped to `[0, cartTravelMaxM]`
    - Rush wins when both are present; no movement leaves travel unchanged and speed 0
    - Report speed as `abs(travel change) / tickS`
    - `imageScale(travel, tuning)`: linear from `imageScaleMin` to `imageScaleMax` over the travel range
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 4.2 Implement `src/sim/beam.ts`
    - `normaliseAngle` to [0, 2π), ignoring non-finite angles at the caller
    - Beam origin is `(cartOriginXM, cartTrackStartYM + travel)`
    - `beamCells(state, tuning)`: cells inside the room, within `placeholderSlideReachM`, with angular difference at most `beamHalfAngleRad`, excluding the origin cell; sorted by distance, then row, then column; empty if the origin is outside the room
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 4.3 Write unit tests for cart and beam
    - Roll, rush, clamping at both ends, rush precedence, speed report, strictly increasing image scale
    - Angle normalisation, NaN angle ignored, beam ordering and tie-breaks, empty beam when origin is outside
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 7.1, 7.2, 7.5, 7.7_

- [x] 5. Implement ghost and candles
  - [x] 5.1 Implement `src/sim/ghost.ts`
    - `scaledThreshold(scale, tuning) = solidityThresholdBase x scale^2` with no rounding
    - `placeGhost(state, tuning)`: first beam cell with density at or above the threshold and not fanned, else `null`
    - `solid` is true exactly when density is at or above the threshold and the cell is not fanned
    - Read placement parameters from `TUNING`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 5.2 Implement `src/sim/candles.ts`
    - Transitions: shield (lit to shielded), light and unshield (shielded to lit), no-ops for repeated or snuffed cases
    - `applySnuffEvent(state, candle, eventId)`: the single place a candle becomes snuffed; sets snuffed, increments `snuffedCount` by 1 and records the id; returns the state unchanged for a snuffed candle, a known id or a missing candle
    - `snuffByContact`: for a solid ghost within `snuffRadiusBaseM x imageScale` (Euclidean, inclusive) of a lit or shielded candle, apply an internal event with id `tick:candleId`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 10.1, 10.2, 10.3, 10.4_

  - [x] 5.3 Write unit tests for ghost and candles
    - Ghost at exactly the threshold, below it, none along the beam, fanned cell
    - Candle transitions, snuff at exactly the radius and just beyond it, shielded candle still snuffed
    - Duplicate id, snuffed candle and missing candle leave state unchanged
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 9.2, 9.3, 9.4, 9.5, 9.6, 9.8, 10.2, 10.3, 10.4_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement `step` and wire the module together
  - [x] 7.1 Implement `src/sim/step.ts`
    - `step(state, inputs, tuning = TUNING)` in the tick order from the design: return a deep copy if ended; stable-sort inputs by player id; apply inputs; decay; spread; enforce fans and count them down; recompute cart speed, beam and ghost; snuff by contact; increment tick and set `ended` when tick reaches `showLengthS / tickS`
    - Enforce roles: puff, roll, rush and aim only from the Showman; fan and candle inputs not from the Showman
    - Ignore unknown input kinds; route `snuff` inputs through `applySnuffEvent`
    - Never mutate the state or inputs; return a new object
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8, 1.9, 1.10, 3.6, 4.2, 6.5, 7.3_

  - [x] 7.2 Write shared fast-check arbitraries in `tests/sim/arbitraries.ts`
    - Seeds as 32-bit integers; an input arbitrary for every kind, including invalid values (bad vent index, NaN angle, out-of-room fan, unknown candle)
    - A grid arbitrary of densities in [0, 1] with biased variants for empty, full and edge-heavy grids
    - A helper that builds a state with a short `showLengthS` through the tuning argument
    - Import only from `src/sim`, `vitest` and `fast-check`
    - _Requirements: 12.4, 12.6_

  - [x] 7.3 Create `src/sim/index.ts` exports
    - Export `TUNING`, `validateTuning`, `createState`, `step`, `imageScale`, `scaledThreshold`, `beamCells`, `placeGhost`, `applySnuffEvent` and the public types
    - _Requirements: 1.1, 11.4_

- [x] 8. Write the property-based tests and final checks
  - [x] 8.1 Write property test for deterministic, pure replay
    - File `tests/sim/property-determinism.test.ts`, tagged `Feature: smoke-and-projection, Property 1: Deterministic, pure replay with tick-based round end`
    - **Property 1: Deterministic, pure replay with tick-based round end**
    - Check equal state at every tick across two runs, no mutation of state or inputs, permutation of distinct-player inputs gives the same state, JSON round trip, `ended` exactly at the show length in ticks, and ended state is unchanged by `step`
    - **Validates: Requirements 1.1, 1.2, 1.6, 1.9, 1.10, 1.11**

  - [x] 8.2 Write property test for density and cart ranges
    - File `tests/sim/property-ranges.test.ts`
    - **Property 2: Smoke density and cart travel stay in range**
    - Check every cell is finite and in [0, 1] and travel is in `[0, cartTravelMaxM]` after every input and tick
    - **Validates: Requirements 2.4, 2.5, 2.7, 3.2, 6.1, 6.4**

  - [x] 8.3 Write property test for total smoke without puffs
    - File `tests/sim/property-smoke-total.test.ts`
    - **Property 3: Total smoke never increases without a puff**
    - Generate states and input sequences without puffs; total density never rises by more than 1e-9 per tick
    - **Validates: Requirements 4.4, 4.5, 4.6, 4.7**

  - [x] 8.4 Write property test for solidity at the scaled threshold
    - File `tests/sim/property-solidity.test.ts`
    - **Property 4: A ghost is solid exactly at the scaled threshold**
    - Check the ghost is the first beam cell at or above the threshold, earlier cells are below it, no ghost when none qualifies, and `solid` matches the comparison
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.7**

  - [x] 8.5 Write property test for fans removing the threat
    - File `tests/sim/property-fan.test.ts`
    - **Property 5: Clearing a cell removes the threat there**
    - After an accepted fan, no ghost cell or solid ghost lies in a fanned cell while the fan is active, whatever the prior density
    - **Validates: Requirements 8.5, 8.8**

  - [x] 8.6 Write property test for candle snuffing
    - File `tests/sim/property-snuff-contact.test.ts`
    - **Property 6: Candles are snuffed only by a nearby solid ghost**
    - A candle that becomes snuffed had a solid ghost within `snuffRadiusBaseM x imageScale` (or a valid external event), and a candle with a solid ghost in range is snuffed at the end of the tick
    - **Validates: Requirements 9.6, 9.7, 9.8, 9.9**

  - [x] 8.7 Write property test for idempotent snuff events
    - File `tests/sim/property-snuff-idempotent.test.ts`
    - **Property 7: Snuff events are idempotent**
    - Applying the same event twice equals applying it once, and `snuffedCount` rises by at most 1
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.5**

  - [x] 8.8 Write unit tests for `step` behaviour
    - Input ordering by player id with same-id order kept, role enforcement, ended-state no-op, RNG state advance rule, round end tick, and `createState` with invalid tuning
    - _Requirements: 1.2, 1.3, 1.4, 1.9, 1.10, 3.6, 11.3_

  - [x] 8.9 Write a source scan test for determinism rules
    - File `tests/sim/source-scan.test.ts`
    - Fail if `src/sim` contains `Math.random`, `Date.now`, `performance.now`, `setTimeout`, `setInterval`, or DOM and Three.js imports
    - Fail on numeric literals other than 0 and 1 outside `tuning.ts`
    - _Requirements: 1.5, 11.4, 12.6_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP, but the 7 property tests (8.1 to 8.7) are what verify the design's correctness properties
- Task 7.2 is not optional because every property test depends on it
- Each task references specific requirements for traceability
- Set `FC_NUM_RUNS=1000` for deeper runs in CI; the default is 100

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4"] },
    { "id": 4, "tasks": ["3.1", "4.1", "4.2", "5.2"] },
    { "id": 5, "tasks": ["3.2", "4.3", "5.1"] },
    { "id": 6, "tasks": ["5.3", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3"] },
    { "id": 8, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8", "8.9"] }
  ]
}
```
