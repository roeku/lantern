# Requirements Document

## Introduction

This spec covers the pure, deterministic simulation in `src/sim` for the smoke and projection rules of the game described in `docs/design.md`. The core rule is that a ghost is a projection: it is solid only where the lantern beam meets enough smoke, and a larger image needs denser smoke. The simulation covers the smoke grid, the cart, the beam, ghost placement and solidity, and candles with snuffing. It excludes rendering, networking, ropes, the second slide, bots and the replay UI. One placeholder slide is included.

Rule constraints come from `.kiro/steering/sim-rules.md`: no wall-clock time or unseeded randomness, no mutation of arguments, plain serializable state, all tuning values from `TUNING`, and per-second rates converted with the tick length.

## Glossary

- **Simulation**: The pure module in `src/sim` that advances game state by one tick.
- **State**: Plain serializable data holding the Smoke_Grid, Cart, Beam, Ghost, Candles, tick count and RNG state.
- **Step_Function**: `step(state, inputs)`, which returns the next State without mutating its arguments.
- **TUNING**: The single settings object holding every tuning number.
- **Tick**: One fixed simulation update. The tick length is defined in TUNING.
- **Smoke_Grid**: The grid of 1 m cells over the 16 x 12 m room, storing one smoke density per cell.
- **Density**: The smoke value of a cell, a number in the range [0, 1].
- **Wall**: The room boundary. Smoke does not cross a Wall.
- **Vent**: One of 3 fixed positions where the Showman puffs smoke.
- **Puff**: An input that adds `puffDensity` to cells within `puffRadiusM` of a Vent.
- **Fan**: A Spectator input that clears cells within `fanRadiusM` of a position for `fanDurationS` seconds, followed by a cooldown of `fanCooldownS` seconds.
- **Fanned_Cell**: A cell inside the radius of a Fan whose duration has not yet elapsed.
- **Cart**: The lantern cart, with travel between 0 and `cartTravelMaxM` metres.
- **Roll**: Cart movement at `cartRollSpeedMps`.
- **Rush**: Cart movement at `cartRushSpeedMps`.
- **Image_Scale**: The ghost size multiplier, derived from Cart travel.
- **Beam**: The lantern ray defined by the Cart position, an aim angle and a cone half-angle from TUNING.
- **Ghost**: The projection placed at the first Smoke_Grid cell along the Beam whose Density is at or above the Scaled_Threshold.
- **Scaled_Threshold**: `solidityThresholdBase x Image_Scale^2`.
- **Solid_Ghost**: A Ghost whose cell Density is at or above the Scaled_Threshold and which is not in a Fanned_Cell.
- **Slide**: The ghost type. This spec has one placeholder Slide.
- **Candle**: A Spectator's light, in state lit, shielded or snuffed.
- **Snuff_Radius**: `snuffRadiusBaseM x Image_Scale`.
- **Snuff_Event**: An event identified by a unique id that snuffs one Candle.
- **Seeded_RNG**: The pseudo-random generator whose state is stored in State.
- **Property_Suite**: The fast-check tests for the correctness properties in this spec.

## Requirements

### Requirement 1: Deterministic step function

**User Story:** As a developer, I want the simulation to be a pure function of state and inputs, so that every client and the replay reach identical results.

#### Acceptance Criteria

1. WHEN the Step_Function is called with a State and a list of inputs, THE Simulation SHALL return a new State object that is not the same reference as the input State, and SHALL leave the input State and every input in the list deep-equal to their values before the call.
2. WHEN the Step_Function is called with a list of inputs, THE Simulation SHALL apply the inputs in ascending numeric order of player id, regardless of the order in which they appear in the list.
3. WHEN the Step_Function is called with two or more inputs that have the same player id, THE Simulation SHALL apply them in their original list order after sorting by player id.
4. WHEN the Simulation needs a random value during a tick, THE Simulation SHALL draw it from the Seeded_RNG and SHALL store the advanced RNG state in the returned State.
5. THE Simulation SHALL NOT call any unseeded random source or any wall-clock time source during a Step_Function call.
6. THE Simulation SHALL represent State as plain serializable data, such that serializing the State to text and parsing it back yields a value deep-equal to the original, and the State contains no functions, class instances, Map, Set, undefined values, NaN or Infinity.
7. THE Simulation SHALL read every tuning number from TUNING.
8. WHEN the Simulation converts a per-second rate to a per-tick amount, THE Simulation SHALL multiply the rate by the tick length in seconds from TUNING.
9. WHEN the tick count in the returned State is greater than or equal to the show length in ticks, calculated from `showLengthS` and the tick length in TUNING, THE Simulation SHALL mark the round as ended in that returned State.
10. WHILE the round is marked as ended, THE Simulation SHALL return a State deep-equal to the input State when the Step_Function is called, without advancing the tick count or the RNG state.
11. FOR ALL seeds and input sequences, running the Simulation twice from the same seed with the same input sequence SHALL produce a deep-equal State at every tick from tick 0 through the end of the round.

### Requirement 2: Smoke grid structure and bounds

**User Story:** As a developer, I want one smoke grid as the only smoke state, so that gameplay, rendering and sync all read the same data.

#### Acceptance Criteria

1. THE Smoke_Grid SHALL contain square cells of 1 m by 1 m covering a room of `roomWidthM` by `roomDepthM` metres, where both are positive integers, giving `roomWidthM` x `roomDepthM` cells (192 cells, 16 columns by 12 rows, at the starting values).
2. THE Smoke_Grid SHALL be the only smoke state in State, and gameplay, rendering and sync SHALL read smoke Density only from the Smoke_Grid.
3. WHEN the Simulation processes a tick, THE Simulation SHALL update Smoke_Grid cells in row-major order, starting at row 0, column 0, across all columns of a row, then the next row.
4. WHEN a tick completes, THE Simulation SHALL leave every Smoke_Grid cell Density within [0, 1] inclusive.
5. WHEN an input is applied, THE Simulation SHALL leave every Smoke_Grid cell Density within [0, 1] inclusive.
6. IF an update would produce a cell Density below 0 or non-finite, THEN THE Simulation SHALL store 0, and IF it would produce a Density above 1, THEN THE Simulation SHALL store 1, and the tick SHALL continue without error.
7. FOR ALL input sequences, every Smoke_Grid cell Density SHALL remain within [0, 1] after each applied input and each tick.

### Requirement 3: Puff from vents

**User Story:** As the Showman, I want to puff smoke from one of 3 vents, so that I can make ghosts solid.

#### Acceptance Criteria

1. WHEN a Puff input from the Showman names one of the 3 existing Vents, THE Simulation SHALL add `puffDensity` to the Density of each Smoke_Grid cell whose centre is within `puffRadiusM` metres (inclusive) of that Vent, during the tick in which the input is processed.
2. WHEN a Puff would raise a cell Density above 1, THE Simulation SHALL set that cell Density to 1.
3. WHEN a Puff reaches beyond the Smoke_Grid boundary, THE Simulation SHALL apply `puffDensity` only to cells inside the Smoke_Grid and SHALL NOT raise an error.
4. WHEN multiple Puff inputs are processed in the same tick, THE Simulation SHALL apply each in input order, with the cap from criterion 2 applied after each Puff.
5. IF a Puff input names a Vent that does not exist, THEN THE Simulation SHALL ignore the input and leave every Smoke_Grid cell Density unchanged.
6. IF a Puff input arrives from a player who is not the Showman, THEN THE Simulation SHALL ignore the input and leave every Smoke_Grid cell Density unchanged.

### Requirement 4: Smoke decay, spread and walls

**User Story:** As a player, I want smoke to thin out and drift, so that the room state changes over time.

#### Acceptance Criteria

1. WHEN a tick runs, THE Simulation SHALL reduce the Density of each cell by `smokeDecayPerS` multiplied by the tick length in seconds, with the result clamped to a minimum of 0.
2. WHEN a tick runs, THE Simulation SHALL apply decay before spread, and SHALL diffuse Density between orthogonally adjacent cells at the rate `smokeSpreadPerS` multiplied by the tick length in seconds.
3. WHEN a tick runs, THE Simulation SHALL process cells in a fixed row-major order, so that identical State and inputs always produce identical Density values.
4. WHEN spread is applied in a tick, THE Simulation SHALL keep the sum of Density over all cells equal to its value before spread, within an absolute tolerance of 1e-9, except for any amount removed by clamping to [0, 1].
5. THE Simulation SHALL transfer zero Density across the room boundary (the Wall) during spread.
6. WHILE no Puff is applied in a tick, THE Simulation SHALL produce a total Density that is less than or equal to the total Density of the previous tick, within an absolute tolerance of 1e-9.
7. FOR ALL States and input sequences containing no Puff, the total Density SHALL never increase from one tick to the next beyond an absolute tolerance of 1e-9.

### Requirement 5: Fan

**User Story:** As a Spectator, I want to fan the smoke away, so that I can make a ghost vanish.

#### Acceptance Criteria

1. WHEN a Spectator issues a Fan input and that Spectator's Fan cooldown has elapsed, THE Simulation SHALL clear every cell whose centre is within `fanRadiusM` of the Fan position to Density 0 on the tick the input is applied.
2. WHILE fewer than `fanDurationS` seconds have elapsed since a Fan was accepted, THE Simulation SHALL hold every cell within `fanRadiusM` of that Fan position at Density 0, so that neither Puff nor spread raises its Density.
3. WHEN `fanDurationS` seconds have elapsed since a Fan was accepted, THE Simulation SHALL release the cells so that Puff and spread apply to them again from the next tick.
4. IF a Fan input arrives while that Spectator's Fan cooldown is running, THEN THE Simulation SHALL ignore the input and leave the Smoke_Grid and the running cooldown unchanged.
5. WHEN a Fan input is accepted, THE Simulation SHALL start a cooldown of `fanCooldownS` seconds for that Spectator, measured from the tick on which the input is accepted.
6. IF a Fan input has a position outside the room, THEN THE Simulation SHALL ignore the input and start no cooldown.

### Requirement 6: Cart and image scale

**User Story:** As the Showman, I want to roll the cart to grow or shrink the ghost, so that I can trade reach against smoke needs.

#### Acceptance Criteria

1. THE Simulation SHALL keep Cart travel within [0, `cartTravelMaxM`] metres after every tick.
2. WHEN a Roll input is applied, THE Simulation SHALL change Cart travel by `cartRollSpeedMps` multiplied by the tick length in seconds, in the requested direction.
3. WHEN a Rush input is applied, THE Simulation SHALL change Cart travel by `cartRushSpeedMps` multiplied by the tick length in seconds, in the requested direction.
4. IF a movement would take Cart travel below 0 or above `cartTravelMaxM`, THEN THE Simulation SHALL set Cart travel to the nearer bound.
5. IF both a Roll input and a Rush input are applied in the same tick, THEN THE Simulation SHALL apply only the Rush input.
6. IF no Roll input and no Rush input is applied in a tick, THEN THE Simulation SHALL leave Cart travel unchanged and report a Cart speed of 0 m/s.
7. THE Simulation SHALL compute Image_Scale from Cart travel using the mapping defined in TUNING, such that Image_Scale is strictly greater at greater Cart travel across [0, `cartTravelMaxM`].
8. WHEN a tick completes, THE Simulation SHALL report the Cart speed as the absolute change in Cart travel during that tick divided by the tick length in seconds, so that later systems can derive sound from it.

### Requirement 7: Beam

**User Story:** As the Showman, I want to aim the beam, so that I can choose where the ghost appears.

#### Acceptance Criteria

1. WHEN an Aim input is applied, THE Simulation SHALL set the Beam angle to the requested angle, normalised to [0, 2π) radians.
2. IF an Aim input carries a non-finite angle, THEN THE Simulation SHALL ignore the input and leave the Beam angle unchanged.
3. THE Simulation SHALL set the Beam origin from the Cart position, so that the origin changes in the same tick as the Cart position.
4. THE Simulation SHALL define the Beam cone by the half-angle `beamHalfAngleRad` from TUNING, so that a cell belongs to the Beam only if the angle between the Beam angle and the direction from the origin to the cell centre is at most `beamHalfAngleRad`.
5. THE Simulation SHALL list the cells along the Beam from the origin outward in ascending distance, with ties broken by ascending row and then ascending column.
6. WHEN listing the cells along the Beam, THE Simulation SHALL exclude any cell outside the room and stop the list at the room boundary.
7. IF the Beam origin lies outside the room, THEN THE Simulation SHALL return an empty list of Beam cells.

### Requirement 8: Ghost placement and solidity

**User Story:** As a player, I want a ghost to be solid only where the beam meets enough smoke, so that the projection rule shapes play.

#### Acceptance Criteria

1. THE Simulation SHALL compute the Scaled_Threshold as `solidityThresholdBase` multiplied by the square of Image_Scale, with no rounding applied before comparison.
2. WHEN the Slide is projected, THE Simulation SHALL place the Ghost at the first cell along the Beam, in order from the origin, whose Density is greater than or equal to the Scaled_Threshold, and SHALL place at most one Ghost per projection.
3. IF no cell along the Beam has Density greater than or equal to the Scaled_Threshold, THEN THE Simulation SHALL report no Ghost and no threat.
4. THE Simulation SHALL report a Ghost as solid exactly when the Density of its cell is greater than or equal to the Scaled_Threshold.
5. WHILE a cell is a Fanned_Cell, THE Simulation SHALL report no Solid_Ghost in that cell, regardless of any Density the cell held before the Fan.
6. WHERE the placeholder Slide is configured, THE Simulation SHALL read all of its placement parameters from TUNING.
7. FOR ALL States, Image_Scale values and Beam directions, a Ghost SHALL be solid if and only if its cell Density is greater than or equal to `solidityThresholdBase` multiplied by Image_Scale squared.
8. FOR ALL States, no Solid_Ghost SHALL exist in a Fanned_Cell.

### Requirement 9: Candles and snuffing

**User Story:** As a Spectator, I want my candle to go out only when a solid ghost actually touches it, so that deaths are fair and readable.

#### Acceptance Criteria

1. THE Simulation SHALL hold each Candle in exactly one state at any tick: lit, shielded or snuffed.
2. WHEN a Spectator issues a shield input for a lit Candle, THE Simulation SHALL change that Candle to shielded on the tick the input is processed.
3. WHEN a Spectator issues a light or unshield input for a shielded Candle, THE Simulation SHALL change that Candle to lit on the tick the input is processed.
4. IF a light or unshield input targets a lit Candle, or a shield input targets a shielded Candle, THEN THE Simulation SHALL leave the Candle state unchanged.
5. IF a light, shield or unshield input targets a snuffed Candle, THEN THE Simulation SHALL leave the Candle snuffed.
6. WHEN a Solid_Ghost is at a Euclidean distance less than or equal to Snuff_Radius from a lit or shielded Candle, THE Simulation SHALL change that Candle to snuffed on that tick, regardless of how many Solid_Ghosts are in range.
7. IF a Ghost is not solid, THEN THE Simulation SHALL leave every Candle unchanged by that Ghost, at any distance.
8. IF a Solid_Ghost is at a distance greater than Snuff_Radius from a Candle, THEN THE Simulation SHALL leave that Candle unchanged by that Ghost.
9. FOR ALL States, a Candle SHALL change to snuffed only when a Solid_Ghost is within `snuffRadiusBaseM` multiplied by Image_Scale of that Candle.

### Requirement 10: Idempotent snuff events

**User Story:** As a developer, I want duplicate snuff events to count once, so that network retries cannot double-count.

#### Acceptance Criteria

1. WHEN a Snuff_Event with an id not previously applied is applied to a Candle that is not snuffed, THE Simulation SHALL set that Candle to snuffed, increase the snuffed count by exactly 1, and record the Snuff_Event id as applied.
2. IF a Snuff_Event is applied to a Candle that is already snuffed, THEN THE Simulation SHALL leave State unchanged.
3. IF a Snuff_Event carries an id that the Simulation has already applied, THEN THE Simulation SHALL leave State unchanged.
4. IF a Snuff_Event references a Candle that does not exist in State, THEN THE Simulation SHALL leave State unchanged.
5. FOR ALL States and Snuff_Events, applying the same Snuff_Event twice in sequence SHALL produce a State equal to the State produced by applying it once.

### Requirement 11: TUNING object

**User Story:** As a designer, I want every number in one settings block, so that playtests can tune the game without touching rule code.

#### Acceptance Criteria

1. THE TUNING object SHALL define each of the following starting values from `docs/design.md` as a named numeric field: `showLengthS` 300, room 16 x 12 m, `puffDensity` 0.6, `puffRadiusM` 2, `smokeDecayPerS` 0.05, `smokeSpreadPerS` 0.2, `solidityThresholdBase` 0.5, `cartTravelMaxM` 8, `cartRollSpeedMps` 1, `cartRushSpeedMps` 4, `fanRadiusM` 2, `fanDurationS` 3, `fanCooldownS` 8, `snuffRadiusBaseM` 0.6.
2. THE TUNING object SHALL define the tick length, `beamHalfAngleRad`, the Image_Scale mapping from Cart travel and the placeholder Slide parameters, each as named numeric fields.
3. IF a TUNING duration, radius, speed or length field is missing, non-numeric, NaN or not positive, THEN THE Simulation SHALL refuse to start and SHALL report an error naming the invalid field.
4. THE Simulation SHALL read every numeric rule constant from TUNING and SHALL contain no numeric rule constants outside TUNING, apart from the literals 0 and 1 used in arithmetic and indexing.
5. WHEN a TUNING field value is changed, THE Simulation SHALL apply the new value without any change to rule code.

### Requirement 12: Property-based test harness

**User Story:** As a developer, I want a configurable fast-check setup, so that I can run quick checks locally and deeper runs in CI.

#### Acceptance Criteria

1. WHEN vitest starts a Property_Suite run, THE setup file SHALL call `fc.configureGlobal` with `numRuns` set to the integer value of the `FC_NUM_RUNS` environment variable.
2. WHERE `FC_NUM_RUNS` is not set or is an empty string, THE setup file SHALL use a `numRuns` of 100.
3. IF `FC_NUM_RUNS` is set to a value that is not a base-10 integer in the range 1 to 1,000,000, THEN THE setup file SHALL use a `numRuns` of 100 and SHALL complete setup without throwing an error.
4. THE Property_Suite SHALL implement each of the 7 correctness properties in Requirements 1, 2, 4, 8, 9 and 10 as exactly one fast-check test per property, generating both seeds and input sequences through fast-check arbitraries.
5. IF a fast-check property test fails, THEN THE Property_Suite SHALL report the failing seed and the shrunk counterexample in the vitest output.
6. THE Property_Suite SHALL import only modules under `src/sim`, `vitest` and `fast-check`, with no DOM or Three.js imports.
