# Implementation Plan: Vertical Slice

## Overview

Extend the existing TypeScript code in `src/sim`, `src/net` and `src/server`, and add `src/bots` and `src/client`, following `design.md`. The order puts a playable local solo build first: sim extensions (ropes, movement, outcome), the `View` and `Recap` functions, bots, then the Three.js client driven by a `SoloSession` that needs no server. Networking comes after the first checkpoint: protocol, codec, rooms and seats, transport routes, then the client net session, lobby and error screens. The plan ends with dev tooling, docs, the steering file updates and a final checkpoint. Each of the 14 correctness properties is one fast-check test. Rule code reads every number from `TUNING` and imports no DOM or Three.js modules.

## Tasks

- [x] 1. Set up the client toolchain
  - [x] 1.1 Add Vite, Three.js and Playwright and the client build files
    - Run `pnpm add three` and `pnpm add -D vite @types/three @playwright/test` at exact pinned versions (no `^` or `~`); `package-lock.json` is stale, use only `pnpm-lock.yaml`
    - Add scripts `client` (`vite`) and `e2e` (`playwright test`) to `package.json`
    - Add `index.html` with a root element and a module script for `src/client/main.ts`, plus a minimal `src/client/main.ts` that logs nothing and exports nothing
    - Add a basic `vite.config.ts` (port 5173, `strictPort`) and extend `tsconfig.json` to include `src/client`, `src/bots`, `e2e` and the DOM lib
    - Keep the Vitest include glob on `tests/**/*.test.ts` so `e2e/` is not collected
    - _Requirements: 15.7, 17.4_

- [x] 2. Extend the simulation with ropes, movement and outcome
  - [x] 2.1 Add the new tuning fields and validation in `src/sim/tuning.ts`
    - Add `ropeCount`, `ropePositions`, `ropeCutHoldS`, `ropeCutRadiusM`, `litCandleRadiusM`, `shieldedCandleRadiusM`, `spectatorSpeedMps`, `spectatorStartPositions`, `fanReachM`, `nearMissRadiusM` with the starting values from the design table
    - Remove `candlePositions`; update `tests/sim/tuning-state.test.ts` and any other test that read it
    - Extend `validateTuning` to reject missing, non-numeric, NaN or non-positive new numeric fields, `ropePositions.length !== ropeCount`, `spectatorStartPositions.length !== 3`, and any rope or start position outside the room; each error names the field
    - _Requirements: 1.9, 2.9, 16.1, 16.2, 16.3, 16.4_
  - [x] 2.2 Extend state types, `createState` and the RNG helper
    - In `src/sim/state.ts` add `Rope`, `Spectator`, `Outcome`, `OutcomeReason`, the `move` and `cut` inputs, and the `ropes`, `spectators` and `outcome` fields on `State`
    - Change `createState(seed, tuning?, opts?: { showmanId?: PlayerId })`; spectators are the other three seat ids in ascending order, candle N is owned by Spectator N, candle positions come from `spectatorStartPositions`
    - Add `deterministicRoll(state, player)` to `src/sim/rng.ts`, moved from the private `roll` in `src/sim/bots.ts`, with identical output
    - Keep the state plain serializable data
    - _Requirements: 1.1, 2.1, 3.8, 16.3_
  - [x] 2.3 Implement `src/sim/spectators.ts`
    - `lightRadiusM(status, tuning)`, `applyMoves(state, moves, tuning)` (normalise, `spectatorSpeedMps x tickS`, clamp to the room, ignore zero or non-finite vectors and Showman senders), `syncCandlePositions(state)`, and `ownsCandle(state, player, candleId)`
    - Audience_Side Spectators keep moving
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_
  - [x] 2.4 Implement `src/sim/ropes.ts`
    - `ropeCutHoldTicks(tuning)` as `max(1, round(ropeCutHoldS / tickS))`, `cutProgressS(rope, tuning)`, `isCutter(...)` and `applyRopePhase(state, cutInputs, tuning)`
    - A Rope with at least one Cutter gains exactly 1 tick; other standing Ropes reset to 0; reaching the hold sets `status = 'cut'` and `cutTick`; cut Ropes never change; inputs naming missing or cut Ropes are ignored
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_
  - [x] 2.5 Implement `src/sim/outcome.ts`
    - `decideOutcome(state, tuning)` checks ropes first, then candles, then time, and returns `{ winner, reason, tick }` with `tick = state.tick + 1`, or `null`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7_
  - [x] 2.6 Wire the new phases into `step` and tighten input rules
    - In `src/sim/step.ts` collect `move` and `cut` inputs, run the move phase, candle sync, rope phase, then the existing phases, snuff by contact, the outcome phase and the tick advance; set `ended` when `outcome !== null`
    - Make `shield`, `unshield` and `light` apply only to the sender's own candle, and ignore `fan` from a Spectator whose candle is snuffed
    - Export the new types and functions from `src/sim/index.ts`
    - Update `tests/sim/*.test.ts` and `tests/server/room.test.ts` for the new `createState` shape and the ownership rule
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.2, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [x] 2.7 Add shared test helpers in `tests/sim/arbitraries-slice.ts`
    - Arbitraries for rope states, valid and hostile Spectator inputs (`move`, `cut`, `fan`, `shield`), states near an outcome edge, and a `playRound(seed, showmanId, inputsPerTick)` helper that returns the states and the input list
    - Do not edit `tests/sim/arbitraries.ts`
    - _Requirements: 17.1, 17.4_
  - [x] 2.8 Write property test for rope progress
    - File `tests/sim/property-ropes.test.ts`
    - **Property 1: Rope progress evolves by the Cutter rule**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.6, 1.7, 1.8**
  - [x] 2.9 Write property test for several Cutters
    - File `tests/sim/property-cutters.test.ts`
    - **Property 2: Several Cutters advance a Rope like one Cutter**
    - **Validates: Requirements 1.5**
  - [x] 2.10 Write property test for Spectator movement
    - File `tests/sim/property-movement.test.ts`
    - **Property 3: Spectators move at fixed speed inside the room and carry their candle**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.7**
  - [x] 2.11 Write property test for the outcome rule
    - File `tests/sim/property-outcome.test.ts`
    - **Property 4: Outcome follows the precedence rule**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.7**
  - [x] 2.12 Write property test for determinism and freeze
    - File `tests/sim/property-determinism-slice.test.ts`; keep the existing determinism test and extend the input set
    - **Property 5: Determinism and freeze on the extended State**
    - **Validates: Requirements 3.5, 3.6**
  - [x] 2.13 Write unit tests for the sim additions
    - Starting tuning values, each validation error naming its field, `createState` with `showmanId`, `lightRadiusM`, audience movement, ownership checks, `fan` from a snuffed Spectator, the same-Tick rope-and-snuff tie, and a JSON round trip of the new State
    - _Requirements: 1.1, 2.1, 2.6, 2.8, 3.4, 3.8, 16.1, 16.2, 16.3_

- [x] 3. Implement the View and the Recap
  - [x] 3.1 Implement `src/sim/view.ts`
    - `beamLitCells(state, tuning)` and `viewFor(state, player, tuning)` with the visibility table from the design; copy data, never mutate State, always include tick, outcome, ropes cut, own candle status and own fan cooldown
    - Export from `src/sim/index.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_
  - [x] 3.2 Write property test for the View
    - File `tests/sim/property-view.test.ts`
    - **Property 6: A View contains only what the role may see**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9**
  - [x] 3.3 Implement `src/sim/recap.ts`
    - `ReplayFrame`, `toReplayFrame(state)` and `buildRecap(frames, tuning)` with snuff times, rope cut times, Near_Miss runs and `lastRopeCutTick`
    - Export from `src/sim/index.ts`
    - _Requirements: 13.2, 13.3_
  - [x] 3.4 Write property test for replay reproducing the final state
    - File `tests/sim/property-replay.test.ts`, using `playRound`
    - **Property 13: Replaying the input log reproduces the final state**
    - **Validates: Requirements 13.9, 13.10**
  - [x] 3.5 Write property test for the Recap
    - File `tests/sim/property-recap.test.ts`
    - **Property 14: The Recap agrees with the final state**
    - **Validates: Requirements 13.2, 13.3**
  - [x] 3.6 Write unit tests for View and Recap
    - Hand-built examples per role from Requirement 4, Near_Miss run counting, a run that ends in a snuff, and a Round with no rope cut
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 13.2_

- [x] 4. Move and extend the Spectator_Bot
  - [x] 4.1 Create `src/bots/spectator-bot.ts` and remove `src/sim/bots.ts`
    - Move the existing defence logic, use `deterministicRoll`, add the rope objective (nearest standing rope, ties to the lower id, `cut` within `ropeCutRadiusM`, otherwise `move`), suppress `move` and `cut` when threatened, send nothing when snuffed
    - Remove the `spectatorBotInputs` export from `src/sim/index.ts`; update `src/server/room.ts` and `tests/sim/bots.test.ts` (move it to `tests/bots/`) to import from `src/bots`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.5_
  - [x] 4.2 Write property test for bot purity and objective
    - File `tests/bots/property-bot.test.ts`
    - **Property 7: Bots are pure and walk to the nearest rope**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
  - [x] 4.3 Write property test for three bots winning
    - File `tests/bots/property-bots-win.test.ts`
    - **Property 8: Three bots without a Showman win**
    - **Validates: Requirements 5.8**
  - [x] 4.4 Write unit tests and extend the source scan
    - Threatened bot sends no `move` or `cut`, unshield when the threat is gone, snuffed bot is silent
    - Extend `tests/sim/source-scan.test.ts` to `src/bots` (no clocks, `Math.random` or literals other than 0 and 1), assert `src/sim` imports nothing from `client`, `net`, `server` or `bots`, and assert `src/client` does not import `src/server`
    - _Requirements: 5.4, 5.5, 5.6, 5.7, 11.11, 14.5, 16.4_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Build the playable solo client
  - [x] 6.1 Implement the fixed-step clock in `src/net/fixed-step.ts`
    - `createFixedStepClock(startMs, stepMs, maxCatchUp)` returning `advance(nowMs)`; drop surplus beyond `maxCatchUp` and resume pacing
    - Export `MAX_CATCH_UP_TICKS = 40` from the server side where it is used
    - _Requirements: 7.5, 14.3_
  - [x] 6.2 Write property test for the fixed-step clock
    - File `tests/net/property-fixed-step.test.ts`
    - **Property 10: The fixed-step clock keeps the long-run rate**
    - **Validates: Requirements 7.5, 14.3**
  - [x] 6.3 Implement client input in `src/client/input/`
    - `bindings.ts` (the table from the design, also read by the HUD), `controls.ts` (`ControlState`), pure `input-mapper.ts` (`mapInputs`), and `keyboard-mouse.ts` that fills `ControlState` from DOM events and tracks edge presses
    - Showman: aim every Tick, W and S roll, Shift turns roll into rush, keys 1 to 3 puff once per press; Spectator: WASD sum, Space shield or unshield, left mouse fan clamped to `fanReachM` and suppressed on cooldown, E cut naming the nearest standing rope in range, snuffed Spectators send only `move`; no input outside `playing`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_
  - [x] 6.4 Write unit tests for `mapInputs`
    - One example per binding, held versus edge presses, fan reach clamp, fan cooldown, role filtering, snuffed Spectator, and `phase !== 'playing'`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 9.7, 10.1, 10.2, 10.3, 10.4, 10.6, 10.7_
  - [x] 6.5 Implement the session interface and `SoloSession`
    - `src/client/session/session.ts` with `GameSession` and `SessionEvent`; `solo-session.ts` runs `step` with `spectatorBotInputs` for players 1 to 3, a `FixedStepClock` driven by `requestAnimationFrame`, the seed from `crypto.getRandomValues`, and emits `hello`, `roster`, `state` and `log` events including the `ReplayFrame` list and `Recap` at the end
    - The session opens no WebSocket
    - _Requirements: 14.1, 14.2, 14.3, 14.4_
  - [x] 6.6 Write a test for `SoloSession`
    - Use a stub clock and a global `WebSocket` that throws if constructed; play a Round to an Outcome and check the `log` event
    - _Requirements: 14.1, 14.3, 14.4_
  - [x] 6.7 Implement the Three.js scene in `src/client/render/`
    - `palette.ts` (only place with colours), `floor-projection.ts` (`simToWorld`, `screenToFloor`), `camera.ts` (`CAMERA_HEIGHT_M`, `CAMERA_TILT_M`), `interpolation.ts` (`lerpPositions`), `smoke-texture.ts` (16 by 12 nearest-filtered `DataTexture`, black for cells outside the View), `beam.ts`, `actors.ts` (cart, ghost solid or faint, candles with radius, ropes with progress bar, spectator markers with a local-player ring), `particles.ts` (decoration only), and `scene.ts` that renders a `View`
    - Import `sim` only through its entry point and never import `src/server`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11_
  - [x] 6.8 Write unit tests for pure render helpers
    - `simToWorld` and `screenToFloor` round trip on examples, `lerpPositions` at alpha 0, 0.5 and 1, and a check that `palette.ts` is the only client file containing colour literals
    - _Requirements: 11.1, 11.9_
  - [x] 6.9 Implement the HUD in `src/client/ui/`
    - `hud-model.ts` (time `m:ss`, ropes, candles, fan state, role, Room_Code, cart travel and Image_Scale), `notices.ts` (`diffEvents`, 3 s `NOTICE_MS`), `hud.ts` (DOM overlay, shows the bindings for the role, reconnecting notice slot), and `styles.css` with the palette, visible `:focus-visible` rings and a CSS palette cursor
    - No browser-default controls, dialogs or cursors
    - _Requirements: 9.5, 10.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_
  - [x] 6.10 Write unit tests for HUD helpers
    - `hud-model` strings for several ticks, fan ready and cooling, Showman versus Spectator content, `diffEvents` for snuff and cut, and notice expiry after 3 s
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.8_
  - [x] 6.11 Implement the start, end and replay screens
    - `start-screen.ts` (create room, join with code, play solo), `end-screen.ts` (winning side, reason, elapsed time, ropes cut, candles snuffed, recap list, play-again control), `replay-controller.ts` (pure state: restart, pause, resume, 1x and 2x at the 10 Hz log rate), `replay-canvas.ts` (2D top-down draw of cart, beam, ghost, spectators and ropes with snuff and cut marks), and `error-screens.ts` (bad code, room full, unreachable)
    - All controls are palette-styled and keyboard operable
    - _Requirements: 12.7, 13.1, 13.2, 13.4, 13.5, 13.6, 13.7, 13.8, 13.11_
  - [x] 6.12 Write unit tests for the replay controller
    - Rate at 1x and 2x, pause and resume, restart, clamp at the last frame, and mark timing from a `Recap`
    - _Requirements: 13.4, 13.5, 13.7_
  - [x] 6.13 Wire the client together in `src/client/app.ts` and `main.ts`
    - Screen state machine start, playing, ended; build the `View` with `viewFor` from the session State; run the render loop, `mapInputs` at the Tick rate and the HUD; the solo path starts from the start screen and reaches the end screen with recap and replay
    - Measure and keep the render loop free of per-frame allocations that grow with Round length
    - _Requirements: 11.12, 14.1, 14.2, 18.3_

- [x] 7. Checkpoint - Playable solo build
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Build the networked server
  - [x] 8.1 Extend the protocol and add `src/net/room-code.ts`
    - Add `move` and `cut` to `ClientInput` and `CLIENT_INPUT_KINDS` with shape validation; add the `start`, `rematch` and `resync` client messages and the `roster` and `log` server messages; add `phase` to `hello`; add `Phase`, `SeatInfo` and `Roster` types
    - Add `room-code.ts` (pattern, a generator taking a random source) and a pure `acceptClientInput(raw, player, countSoFar)` that parses, whitelists, stamps the player id and enforces `MAX_INPUTS_PER_SEAT_PER_TICK`
    - _Requirements: 6.12, 6.13, 7.9, 8.1, 8.7_
  - [x] 8.2 Write property test for input filtering
    - File `tests/net/property-input-filter.test.ts`
    - **Property 9: The server only forwards allowed, stamped inputs**
    - **Validates: Requirements 6.12, 6.13, 8.7**
  - [x] 8.3 Extend `src/net/snapshot-codec.ts`
    - Add the Spectator section (changed-bit mask, `f64` positions), Rope section, Outcome flag bit and fields; send only candle status per frame and rebuild candle positions from Spectators on decode; keep the sparse or dense grid delta
    - `decodeSnapshot` throws `SnapshotCodecError` on short buffers, bad enums and out-of-range counts; update `quantizeState`
    - _Requirements: 8.3, 8.4, 8.5, 8.6_
  - [x] 8.4 Write property test for the snapshot round trip
    - File `tests/net/snapshot-codec.prop.test.ts`; update or replace the existing round-trip test for the extended State
    - **Property 12: Snapshot round trip against any baseline**
    - **Validates: Requirements 8.3, 8.4, 8.5**
  - [x] 8.5 Refactor `src/server/room.ts` into the Phase machine
    - Phases `lobby`, `playing`, `ended`; `clockTicks` for grace and the empty-room timer; Showman seat tracking and `nextShowmanSeat(heldSeats, current)`; `start` (Showman only, server seed, `createState` with `showmanId`); bot seats computed per Tick; an input list per Tick and a state log every `RECORD_EVERY_TICKS` plus the first and final states; end of Round sends the final Snapshot, roster and `log`; Showman grace expiry during `playing` returns to `lobby` with no Outcome; `rematch` with the pending rule and role rotation; late joiner takes the lowest free seat; `resync` clears the baseline; roster and phase in `hello`
    - Reach connections only through the `Connection` interface
    - _Requirements: 6.2, 6.3, 6.7, 6.8, 6.9, 6.10, 6.11, 6.14, 7.2, 7.3, 7.4, 7.6, 7.7, 7.8, 7.9, 8.1, 8.2, 8.9, 13.10_
  - [x] 8.6 Write property test for rematch rotation
    - File `tests/server/property-rotation.test.ts`
    - **Property 11: Rematch rotation picks the next held seat**
    - **Validates: Requirements 7.7, 7.8**
  - [x] 8.7 Write unit tests for `Room`
    - Join and hello, Showman first, room full, grace and release to bot, Showman grace ends the Round, empty-room deletion after 1200 clock ticks, `lobby` does not step, non-Showman `start` ignored, rematch pending then confirmed, log recorded at every second Tick including first and final
    - Update `tests/server/room.test.ts` accordingly
    - _Requirements: 6.2, 6.3, 6.6, 6.7, 6.9, 6.10, 6.11, 7.2, 7.4, 7.7, 8.9_
  - [x] 8.8 Extend the transport, manager and entry point
    - Add `HttpHandlers` and the `http` argument to `Transport.listen`; in `ws-transport.ts` serve `GET /new` and `GET /log/<CODE>` on the same HTTP server and close bad codes with `CLOSE_BAD_CODE`
    - `RoomManager` allocates unique codes, creates a Room on first join of any valid code, uses `createFixedStepClock` with `MAX_CATCH_UP_TICKS` for the loop, and deletes empty rooms
    - `index.ts` reads `PORT`, defaults to 2568 and on `EADDRINUSE` prints the port number and exits with code 1
    - _Requirements: 6.1, 6.4, 6.5, 6.11, 6.14, 7.5, 8.10, 15.4, 15.6_
  - [x] 8.9 Write the server integration test
    - File `tests/server/integration.test.ts`: four simulated clients through the real `ws` transport on an ephemeral port play a short Round; check the roster, the snapshot rate (at least 19 per second over a short window), a reconnect with a Seat_Token that returns the same seat and a full Snapshot, and the final `GET /log/<CODE>` payload
    - _Requirements: 8.2, 8.8, 8.10, 17.5_

- [x] 9. Connect the client to the server
  - [x] 9.1 Implement `src/client/session/net-session.ts` and `ws-url.ts`
    - `ws-url.ts` picks `wss://` for HTTPS pages and `ws://` for HTTP on the page origin; `NetSession` stores the Seat_Token in `sessionStorage`, decodes Snapshots against the last good State, sends `resync` on `SnapshotCodecError`, reconnects every `RECONNECT_RETRY_MS` with a `RECONNECT_GRACE_S` countdown, and maps close codes to `bad_code` and `room_full` errors
    - Fetch `GET /new` for the create-room path and navigate to `/r/<code>`
    - _Requirements: 6.1, 6.5, 6.6, 6.8, 8.1, 8.6, 15.3_
  - [x] 9.2 Add the lobby, error handling and reconnect overlay to the client
    - `lobby.ts` with the Join_Link and a styled copy control, seat list (human, bot, open), roles, a start control for the Showman only; wire `NetSession` into `app.ts`; show the room-full, bad-code and unreachable screens; show the reconnecting notice with the grace countdown; connect the end screen play-again control to `rematch`; land on the screen that matches the Phase from `hello`
    - _Requirements: 6.5, 6.6, 7.1, 7.9, 12.9, 13.8, 13.11_
  - [x] 9.3 Write unit tests for the net session
    - Use a fake WebSocket: `ws-url` for both schemes, token storage and reuse, `resync` after a corrupt frame with the last good State kept, reconnect countdown, and close-code mapping
    - _Requirements: 6.8, 8.6, 15.3_

- [x] 10. Dev tooling, docs and steering
  - [x] 10.1 Add the dev command and the Vite proxy
    - `vite.config.ts`: proxies for `/r`, `/log` and `/new` to `http://localhost:${PORT ?? 2568}` with `ws: true`; `bypass` for `/r` returns `/index.html` unless `req.headers.upgrade === 'websocket'`; `allowedHosts: ['.trycloudflare.com']`
    - `scripts/dev.mjs`: check the server port first and exit 1 naming it if in use, spawn the server and Vite, print the local URL, kill both children on exit
    - Add scripts `dev` and `tunnel` (`cloudflared tunnel --url http://localhost:5173`) to `package.json`
    - _Requirements: 15.1, 15.2, 15.4, 15.6, 15.7_
  - [x] 10.2 Write `README.md` and `docs/playtest-checklist.md`
    - README: the Dev_Command, the one tunnel command, the steps to share the Join_Link, and the default port
    - Checklist: the Milestone 1 pass test (after three Rounds both players can say why they lost and ask to swap roles), a per-Round table (length, Outcome reason, "why did you lose?", "do you want to swap roles?"), and the instruction to fix rules in TUNING or the specs before any art work when the test fails
    - _Requirements: 15.5, 18.5, 18.6_
  - [x] 10.3 Add the Playwright test
    - `playwright.config.ts` with a `webServer` running `pnpm dev`; `e2e/two-pages.spec.ts` opens two pages on one Join_Link, starts a Round from the Showman page, and asserts each page shows its own role bindings on the HUD
    - _Requirements: 17.6, 18.2, 18.4_
  - [x] 10.4 Update the steering files
    - `.kiro/steering/tech.md`: replace "The WebSocket library is not chosen yet: do not add one" with `ws` chosen (plain Node, behind the Transport interface), note that Vite and Three.js are the client dependencies and Playwright is a dev-only test tool, and note that the slice serves the client from Vite behind one tunnel with the static-host deploy as later work
    - `.kiro/steering/netcode.md`: remove the open "WebSocket library: TBD" item; record `ws`, the binary delta Snapshot format, the 10 s Seat_Token reconnect grace, the 10 Hz State_Log plus input log, and the `/new` and `/log/<CODE>` routes; keep the rules that hold regardless
    - `.kiro/steering/structure.md`: add `src/bots/` to the layout and the dependency direction, and remove the "(added later)" note on `src/server`
    - _Requirements: 6.14, 15.7_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP, but the 14 property tests (2.8 to 2.12, 3.2, 3.4, 3.5, 4.2, 4.3, 6.2, 8.2, 8.4, 8.6) are what verify the design's correctness properties
- Task 2.7 is not optional because the property tests share its helpers
- Each task references specific requirements for traceability
- Checkpoint 7 is the first playable build: a solo Showman against 3 bots, with no server running
- Set `FC_NUM_RUNS=1000` for deeper runs in CI; the default is 100
- The manual bars (60 s snapshot rate, 30 fps on integrated graphics, the Milestone 1 playtest) stay in `docs/playtest-checklist.md` and are not coding tasks

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5"] },
    { "id": 4, "tasks": ["2.6"] },
    { "id": 5, "tasks": ["2.7", "3.1"] },
    { "id": 6, "tasks": ["2.8", "2.9", "2.10", "2.11", "2.12", "2.13", "3.2", "3.3"] },
    { "id": 7, "tasks": ["3.4", "3.5", "3.6", "4.1"] },
    { "id": 8, "tasks": ["4.2", "4.3", "4.4", "6.1", "6.3"] },
    { "id": 9, "tasks": ["6.2", "6.4", "6.5", "6.7", "6.9"] },
    { "id": 10, "tasks": ["6.6", "6.8", "6.10", "6.11"] },
    { "id": 11, "tasks": ["6.12", "6.13"] },
    { "id": 12, "tasks": ["8.1", "8.3"] },
    { "id": 13, "tasks": ["8.2", "8.4", "8.5"] },
    { "id": 14, "tasks": ["8.6", "8.7", "8.8"] },
    { "id": 15, "tasks": ["8.9", "9.1", "10.1"] },
    { "id": 16, "tasks": ["9.2", "9.3", "10.2"] },
    { "id": 17, "tasks": ["10.3", "10.4"] }
  ]
}
```
