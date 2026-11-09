# Requirements Document

## Introduction

This spec covers a playable vertical slice of the game described in `docs/design.md`, so that a group of friends can playtest one full show in a browser. Today only the headless simulation in `src/sim` exists (smoke grid, cart, beam, ghost, candles, step, bots), plus an early room and transport in `src/server` and a snapshot codec in `src/net`. Nothing renders, no input is read, and the sim has no ropes, no spectator movement, no candle light radii, no per-role visibility and no round outcome.

The slice delivers one room with 1 Showman and 3 Spectators, bots in empty Spectator seats, join by link, a Three.js grey-box client driven by keyboard and mouse on a laptop, an authoritative server, a basic HUD, an end screen with a recap and a minimal top-down replay, and a one-command local run. The slice is also the build for Milestone 1 in `docs/design.md`: after three rounds, players can say why they lost and ask to swap roles.

Out of scope for this slice, and tracked as later work: slides (the slice keeps the one placeholder Slide), the three-act structure and act-based smoke unlocks, all sound, art polish and Blender assets, the Showman bot, the snuffed-player cart ping, in-game voice, more rooms, a static-host deploy and server-side hiding of hidden information.

Rule constraints come from `.kiro/steering/sim-rules.md`, `netcode.md`, `structure.md`, `tech.md` and `feel.md`. The sim stays pure and deterministic with every number in `TUNING`. The server is authoritative. The client only reads state and produces inputs. Network decisions come from `spikes/net/REPORT.md`: plain Node with `ws` behind a small transport interface, a snapshot codec in `src/net/`, a fixed-step loop at 20 Hz, room codes in the URL, a seat token with a 10 s reconnect grace, delta-coded smoke cells and a 10 Hz state log.

## Glossary

- **Simulation**: The pure module in `src/sim` that advances game state by one Tick.
- **State**: Plain serializable data held by the Simulation, as defined in the `smoke-and-projection` spec, extended by this spec with Ropes, Spectator positions and the Outcome.
- **Step_Function**: `step(state, inputs)`, which returns the next State without mutating its arguments.
- **TUNING**: The single settings object holding every tuning number.
- **Tick**: One fixed simulation update of `tickS` seconds (20 Hz at the starting value).
- **Showman**: The player who controls the Cart, Beam and Vents.
- **Spectator**: A player who moves through the hall and owns one Candle.
- **Seat**: One of 4 player slots in a Room. Seat index equals player id.
- **Human_Seat**: A Seat held by a connected or grace-period person.
- **Bot_Seat**: A Spectator Seat with no human, played by the Spectator_Bot.
- **Spectator_Bot**: The pure function that produces inputs for a Bot_Seat.
- **Room**: One server-side game instance with 4 Seats, one State and one Room_Code.
- **Room_Code**: A 4-character code of capital letters and digits that names a Room.
- **Join_Link**: A URL of the form `/r/<Room_Code>` that opens the client in that Room.
- **Seat_Token**: A secret string issued to a Human_Seat that lets a dropped client reclaim the Seat.
- **Reconnect_Grace**: The 10 s (200 Ticks) during which a dropped Human_Seat stays reserved.
- **Round**: One show from the first Tick until the Outcome is set.
- **Phase**: The Room state: `lobby`, `playing` or `ended`.
- **Server**: The Node process in `src/server` that owns Rooms and runs the Step_Function at 20 Hz.
- **Transport**: The small interface in `src/server` that hides the WebSocket library.
- **Client**: The browser application in `src/client` that renders State and produces inputs.
- **Snapshot**: A binary frame sent by the Server each Tick that carries State, delta-coded against the last State the receiving Client holds.
- **Snapshot_Codec**: The encode and decode functions for Snapshots in `src/net`.
- **State_Log**: The list of States recorded by the Server every second Tick (10 Hz) during a Round.
- **Rope**: One of 3 fixed objects at positions from TUNING. A Rope is standing or cut.
- **Cut_Progress**: Seconds of uninterrupted cutting held against a Rope, in the range [0, `ropeCutHoldS`].
- **Cut_Input**: A Spectator input naming a Rope, sent each Tick while the Spectator holds the cut control.
- **Cutter**: A Spectator whose Candle is lit, who is within `ropeCutRadiusM` of a Rope, and who sends a Cut_Input for that Rope in the Tick.
- **Candle**: As in the `smoke-and-projection` spec. In this spec the Candle position equals the position of its owning Spectator.
- **Light_Radius**: `litCandleRadiusM` for a lit Candle, `shieldedCandleRadiusM` for a shielded Candle, and 0 for a snuffed Candle.
- **Audience_Side**: The state of a Spectator whose Candle is snuffed. That Spectator keeps moving but cannot light a Candle, cut a Rope or fan.
- **Outcome**: The Round result: `null` while playing, otherwise `showman` or `spectators`, with a reason of `all_candles_snuffed`, `time_up` or `all_ropes_cut`.
- **View**: The subset of State a given player is allowed to see, computed by a pure function of State and player id.
- **Beam_Lit_Cell**: A Smoke_Grid cell that belongs to the Beam cone and lies within `placeholderSlideReachM` of the Cart.
- **HUD**: The heads-up display drawn by the Client over the 3D scene.
- **Recap**: The end-screen summary derived from the State_Log.
- **Replay**: The top-down playback of the State_Log on the end screen.
- **Near_Miss**: A recorded moment where a Solid_Ghost was within `nearMissRadiusM` of a Candle that did not become snuffed.
- **Dev_Command**: The single command that starts the Client dev server and the Server together.
- **Property_Suite**: The fast-check tests for the correctness properties in this spec.

## Requirements

### Requirement 1: Ropes and cutting in the Simulation

**User Story:** As a Spectator, I want to cut ropes by holding my lit candle next to them, so that I have an objective that pulls me out of hiding.

#### Acceptance Criteria

1. THE Simulation SHALL hold exactly `ropeCount` Ropes in State, each with an id, a position from TUNING, a status of standing or cut, and a Cut_Progress, with `ropeCount` equal to 3 at the starting value.
2. WHEN a Cut_Input names a standing Rope and the sender is a Cutter for that Rope, THE Simulation SHALL increase that Rope's Cut_Progress by `tickS` seconds on that Tick.
3. WHEN a Rope's Cut_Progress reaches or exceeds `ropeCutHoldS` seconds (4 s at the starting value), THE Simulation SHALL set the Rope to cut on that Tick and SHALL record the Tick of the cut.
4. WHEN a standing Rope receives no Cut_Input from a Cutter in a Tick, THE Simulation SHALL reset that Rope's Cut_Progress to 0 on that Tick.
5. WHEN two or more Cutters send Cut_Inputs for the same standing Rope in one Tick, THE Simulation SHALL increase the Cut_Progress by `tickS` seconds once, not once per Cutter.
6. IF a Cut_Input comes from the Showman, from a Spectator on the Audience_Side, from a Spectator whose Candle is shielded, or from a Spectator farther than `ropeCutRadiusM` from the named Rope, THEN THE Simulation SHALL ignore the input for Cut_Progress purposes.
7. IF a Cut_Input names a Rope that does not exist or is already cut, THEN THE Simulation SHALL ignore the input and leave State unchanged.
8. THE Simulation SHALL keep every Cut_Progress within [0, `ropeCutHoldS`] after every Tick, and SHALL keep a cut Rope cut for the rest of the Round.
9. THE Simulation SHALL read `ropeCount`, Rope positions, `ropeCutHoldS` and `ropeCutRadiusM` from TUNING.

### Requirement 2: Spectator movement and candle radii

**User Story:** As a Spectator, I want to walk around the dark hall carrying my candle, so that I can reach the ropes and avoid the ghost.

#### Acceptance Criteria

1. THE Simulation SHALL hold an x and y position in metres for each Spectator in State, starting at positions from TUNING.
2. WHEN a move input from a Spectator carries a finite direction vector, THE Simulation SHALL move that Spectator on that Tick by `spectatorSpeedMps` multiplied by `tickS`, in the direction of the vector normalised to length 1.
3. IF a move input carries a zero-length or non-finite vector, THEN THE Simulation SHALL leave that Spectator's position unchanged.
4. WHEN a move would take a Spectator outside the room, THE Simulation SHALL clamp the position to the room boundary.
5. IF a move input comes from the Showman, THEN THE Simulation SHALL ignore the input.
6. WHILE a Spectator is on the Audience_Side, THE Simulation SHALL continue to apply that Spectator's move inputs.
7. THE Simulation SHALL set each Candle position to the position of its owning Spectator at the end of every Tick, so that snuffing by contact uses the current Spectator position.
8. THE Simulation SHALL provide a Light_Radius function of Candle status that returns `litCandleRadiusM` (3 m at the starting value) for lit, `shieldedCandleRadiusM` (1 m at the starting value) for shielded and 0 for snuffed.
9. THE Simulation SHALL read `spectatorSpeedMps`, `litCandleRadiusM`, `shieldedCandleRadiusM` and the Spectator start positions from TUNING.

### Requirement 3: Round outcome and end conditions

**User Story:** As a player, I want the show to end the moment someone wins, so that the result is clear and every client agrees on it.

#### Acceptance Criteria

1. WHEN the last standing Rope is cut, THE Simulation SHALL set the Outcome to `spectators` with reason `all_ropes_cut` and SHALL mark the Round as ended on that Tick.
2. WHEN the last lit or shielded Candle becomes snuffed, THE Simulation SHALL set the Outcome to `showman` with reason `all_candles_snuffed` and SHALL mark the Round as ended on that Tick.
3. WHEN the tick count reaches the show length in Ticks (`showLengthS` divided by `tickS`) and at least one Rope is standing, THE Simulation SHALL set the Outcome to `showman` with reason `time_up` and SHALL mark the Round as ended.
4. IF the last Rope is cut and the last Candle is snuffed on the same Tick, THEN THE Simulation SHALL set the Outcome to `spectators` with reason `all_ropes_cut`.
5. WHILE the Outcome is not `null`, THE Simulation SHALL return a State deep-equal to the input State when the Step_Function is called.
6. THE Simulation SHALL derive the Outcome from State and inputs only, with no wall-clock time, so that every Client and the Server agree on the end Tick.
7. THE Simulation SHALL keep the Outcome `null` until one of criteria 1, 2 or 3 holds.
8. THE Simulation SHALL accept the Showman player id when a State is created, so that a rematch can pass the Showman role to another human, and SHALL default to `showmanIdDefault` when none is given.

### Requirement 4: Per-role visibility

**User Story:** As a player, I want to see only what my role allows, so that the Showman's smoke blocks his own view and a lit candle gives the Spectator away.

#### Acceptance Criteria

1. THE Simulation SHALL provide a pure View function of State and player id that returns the smoke densities, Rope states, Spectator positions, Candle states and Ghost the player may see, and that does not mutate State.
2. WHEN the View is computed for the Showman, THE Simulation SHALL include smoke density only for Beam_Lit_Cells and for cells within the Light_Radius of any lit Candle.
3. WHEN the View is computed for the Showman, THE Simulation SHALL include a Spectator position, Candle and Rope only if that position lies in a Beam_Lit_Cell or within the Light_Radius of a lit Candle, and SHALL include every lit Candle regardless of position.
4. WHEN the View is computed for the Showman, THE Simulation SHALL exclude every shielded and snuffed Candle that does not lie in a Beam_Lit_Cell.
5. WHEN the View is computed for the Showman, THE Simulation SHALL include the Ghost only if its cell is a Beam_Lit_Cell.
6. WHEN the View is computed for a Spectator whose Candle is lit or shielded, THE Simulation SHALL include smoke density, Ropes and other Spectator positions only within that Candle's Light_Radius, SHALL include every Solid_Ghost anywhere in the room, and SHALL include every lit Candle anywhere in the room.
7. WHEN the View is computed for a Spectator on the Audience_Side, THE Simulation SHALL include the full State except the Beam angle.
8. THE Simulation SHALL include in every View the tick count, the Outcome, the number of Ropes cut, the viewer's own Candle status and the viewer's own fan cooldown.
9. FOR ALL States and player ids, every cell, Rope, Spectator and Candle excluded by criteria 2 to 6 SHALL be absent from the View, and every View SHALL be a subset of State.

### Requirement 5: Spectator bots with objectives

**User Story:** As a solo player, I want bots to play the empty Spectator seats well enough to be a real opponent, so that I can playtest as the Showman without friends.

#### Acceptance Criteria

1. THE Spectator_Bot SHALL be a pure function of State, the list of Bot_Seat ids and TUNING, returning a list of inputs, and SHALL NOT read or change the RNG state in State.
2. WHILE a bot's Candle is lit and at least one Rope is standing, THE Spectator_Bot SHALL move that bot toward the nearest standing Rope by straight-line distance, with ties broken by the lower Rope id.
3. WHEN a bot is within `ropeCutRadiusM` of a standing Rope and its Candle is lit, THE Spectator_Bot SHALL send a Cut_Input for that Rope on each Tick.
4. WHEN a Solid_Ghost is within the bot's snuff reach plus `botWarnMarginM`, THE Spectator_Bot SHALL fan or shield as in the `smoke-and-projection` spec and SHALL NOT send a Cut_Input or move on that Tick.
5. WHEN the threat is gone and the bot's Candle is shielded, THE Spectator_Bot SHALL unshield the Candle.
6. WHEN a bot's Candle is snuffed, THE Spectator_Bot SHALL send no inputs.
7. THE Spectator_Bot SHALL read every bot number from TUNING.
8. FOR ALL seeds, a Round with 3 Bot_Seats and no Showman input SHALL end with the Outcome `spectators` in the sim test harness before `showLengthS` elapses.

### Requirement 6: Server rooms, seats and join by link

**User Story:** As a player, I want to open a link and land in my friend's room, so that we can start playing without accounts.

#### Acceptance Criteria

1. WHEN a browser requests the site root, THE Server SHALL create a new Room with a unique Room_Code and THE Client SHALL navigate to the Join_Link for that Room_Code.
2. WHEN a Client opens a WebSocket for a Join_Link whose Room_Code matches the pattern of 4 capital letters or digits and names a Room, THE Server SHALL seat the Client in the lowest free Seat and send a hello message carrying the player id, role, Room_Code and Seat_Token.
3. THE Server SHALL give the Showman role to the first human to join a Room and the Spectator role to every later human.
4. IF a Join_Link names a Room_Code that matches the pattern but names no Room, THEN THE Server SHALL create a Room with that Room_Code.
5. IF a Join_Link has a Room_Code that does not match the pattern, THEN THE Server SHALL reject the connection with a close code and reason and THE Client SHALL show the player an error screen with a control to create a new Room.
6. IF all 4 Seats are held by humans, THEN THE Server SHALL close the new connection with the room-full close code and THE Client SHALL show a room-full screen.
7. WHEN a Human_Seat connection closes, THE Server SHALL keep the Seat reserved for Reconnect_Grace Ticks.
8. WHEN a Client reconnects with a valid Seat_Token within Reconnect_Grace, THE Server SHALL return the Client to the same Seat and send a full Snapshot, and THE Client SHALL store the Seat_Token in browser session storage and reconnect automatically after an unexpected close.
9. WHEN Reconnect_Grace elapses for a Spectator Seat, THE Server SHALL release the Seat to the Spectator_Bot.
10. IF the Reconnect_Grace elapses for the Showman Seat during a Round, THEN THE Server SHALL end the Round without an Outcome, set the Phase to `lobby` and release the Seat.
11. WHEN a Room has had no human for 60 s, THE Server SHALL delete the Room.
12. THE Server SHALL stamp each input with the player id of the Seat it arrived on and SHALL drop inputs of kinds that clients may not send.
13. THE Server SHALL accept at most `MAX_INPUTS_PER_SEAT_PER_TICK` inputs per Seat per Tick and SHALL drop the rest.
14. THE Server SHALL reach the Room only through the Transport interface, so that the WebSocket library is swappable.

### Requirement 7: Lobby, round start and rematch

**User Story:** As the host, I want a lobby where friends gather before the show starts, so that nobody misses the opening.

#### Acceptance Criteria

1. WHILE a Room is in the `lobby` Phase, THE Client SHALL show the Join_Link with a styled copy control, the 4 Seats marked human, bot or open, and each player's role.
2. WHILE a Room is in the `lobby` Phase, THE Server SHALL step no Simulation and SHALL send the lobby roster to every Client whenever it changes.
3. WHEN the Showman presses the start control in the `lobby` Phase, THE Server SHALL create a State from a seed drawn on the Server, set the Phase to `playing`, and fill every open Spectator Seat with the Spectator_Bot.
4. IF a start request comes from a Seat other than the Showman, THEN THE Server SHALL ignore the request.
5. WHILE the Phase is `playing`, THE Server SHALL step the Simulation at 20 Hz using a fixed-step loop that catches up missed Ticks, so that the long-run Tick rate stays at `1 / tickS` Ticks per second.
6. WHEN the Simulation sets an Outcome, THE Server SHALL set the Phase to `ended`, send a final Snapshot to every Client and send the State_Log.
7. WHEN any human presses the play-again control in the `ended` Phase and the Showman agrees or the Showman Seat is empty, THE Server SHALL return the Room to `lobby`, keep every human in the same Seat and pass the Showman role to the next human Seat in ascending Seat order, wrapping from the last to the first.
8. IF the Room holds exactly one human, THEN THE Server SHALL keep that human as the Showman on rematch.
9. THE Server SHALL include the Phase in every hello message and every lobby roster so that a reconnecting Client lands on the correct screen.

### Requirement 8: Authoritative server loop and Snapshots

**User Story:** As a player, I want every client to see the same show, so that the game is fair and the replay is trustworthy.

#### Acceptance Criteria

1. THE Server SHALL be the only place where the Simulation advances for a networked Room, and THE Client SHALL send inputs only and SHALL never send State.
2. WHEN a Tick is stepped, THE Server SHALL send one Snapshot per connected Human_Seat.
3. THE Snapshot_Codec SHALL encode the smoke grid as the changed cells against the baseline State the receiving Client holds, and SHALL send a full frame when the Client has no baseline.
4. THE Snapshot_Codec SHALL encode Ropes, Spectator positions, Candle states, the Outcome and the fan cooldowns, in addition to the fields it encodes today.
5. FOR ALL valid States and baselines, decoding an encoded Snapshot against the same baseline SHALL produce a State deep-equal to the encoded State (round-trip property).
6. IF the Client receives a Snapshot it cannot decode, THEN THE Client SHALL discard the frame, request a full Snapshot and keep rendering the last good State.
7. THE Server SHALL NOT accept a `snuff` input from any Client, so that only the Simulation decides snuffs and a replayed message cannot change the Outcome.
8. WHEN a Client measures its snapshot arrival, THE Client SHALL average at least 19 Snapshots per second over 60 s on localhost, matching the bar set in `spikes/net/NETWORK_SPIKE.md`.
9. THE Server SHALL record the State every second Tick into the State_Log, including the first State and the final State.
10. THE Server SHALL expose the State_Log of a Room as an HTTP GET route at `/log/<Room_Code>` after the Round ends.

### Requirement 9: Showman controls

**User Story:** As the Showman, I want to aim the beam, roll the cart and puff smoke from three vents with keyboard and mouse, so that I can hunt the candles.

#### Acceptance Criteria

1. WHILE the Phase is `playing` and the player is the Showman, THE Client SHALL send an `aim` input each Tick with the angle from the Cart position to the mouse position projected onto the floor plane.
2. WHILE the Showman holds the roll-forward control, THE Client SHALL send a `roll` input with direction 1 each Tick, and WHILE the Showman holds the roll-back control, THE Client SHALL send a `roll` input with direction -1.
3. WHILE the Showman holds the rush modifier together with a roll control, THE Client SHALL send a `rush` input in place of the `roll` input for that direction.
4. WHEN the Showman presses the control for Vent 1, 2 or 3, THE Client SHALL send one `puff` input naming that Vent, and WHILE the control stays held THE Client SHALL NOT repeat the `puff` input.
5. THE Client SHALL bind roll forward and back to W and S, rush to Shift, and the three Vents to the keys 1, 2 and 3, and SHALL show these bindings on the HUD of the Showman.
6. THE Client SHALL send Showman inputs only when the local player holds the Showman role.
7. THE Client SHALL send no input while the Phase is not `playing`.

### Requirement 10: Spectator controls

**User Story:** As a Spectator, I want to move, light or shield my candle, fan and cut ropes with keyboard and mouse, so that I can fight the Showman.

#### Acceptance Criteria

1. WHILE the player is a Spectator and holds movement controls, THE Client SHALL send a `move` input each Tick whose vector is the sum of the held direction controls.
2. WHEN a Spectator presses the shield control and the Candle is lit, THE Client SHALL send a `shield` input for that Spectator's Candle, and WHEN the Candle is shielded THE Client SHALL send an `unshield` input.
3. WHEN a Spectator presses the fan control, THE Client SHALL send one `fan` input centred on the mouse position projected onto the floor plane, limited to within `fanReachM` metres of the Spectator.
4. WHILE a Spectator holds the cut control and the Spectator stands within `ropeCutRadiusM` of a standing Rope, THE Client SHALL send a Cut_Input naming the nearest such Rope each Tick.
5. THE Client SHALL bind movement to W, A, S and D, shield and unshield to Space, fan to the left mouse button and cut to E, and SHALL show these bindings on the HUD of the Spectator.
6. WHILE the fan cooldown is running, THE Client SHALL NOT send `fan` inputs.
7. WHILE a Spectator is on the Audience_Side, THE Client SHALL send only `move` inputs.
8. THE Client SHALL read `fanReachM` from TUNING.

### Requirement 11: Grey-box rendering

**User Story:** As a player, I want to see the hall, smoke, beam, cart, ghost, candles and ropes in a simple 3D view, so that I understand what is happening.

#### Acceptance Criteria

1. THE Client SHALL render the room as a 16 by 12 m floor with walls in Three.js from a raised top-down perspective camera, using the palette in `.kiro/steering/feel.md` and no colours outside it.
2. THE Client SHALL render the smoke grid by drawing one visible quad or texel per cell with opacity proportional to the cell Density in the player's View, reading Density only from the View.
3. THE Client SHALL render the Beam as a cone from the Cart position along the Beam angle with the half-angle `beamHalfAngleRad`, when the View includes the Beam.
4. THE Client SHALL render the Cart at its position along the cart track, and SHALL render the Ghost in the Ghost's cell with a solid appearance when the Ghost is solid and a faint appearance when it is not.
5. THE Client SHALL render each Candle from the View as a point of light with radius equal to its Light_Radius, using different appearances for lit, shielded and snuffed.
6. THE Client SHALL render each Rope from the View as standing, as showing a Cut_Progress bar while Cut_Progress is greater than 0, or as cut.
7. THE Client SHALL render every Spectator from the View as a simple marker and SHALL mark the local player's own Spectator.
8. WHILE the Showman's View excludes a cell, THE Client SHALL draw that cell as black, and WHILE a Spectator's View excludes a cell THE Client SHALL draw that cell as black, so that the dark hall matches the rules.
9. THE Client SHALL interpolate rendered positions of the Cart and Spectators between the two most recent Snapshots, so that motion is smooth at a display rate above 20 Hz.
10. THE Client SHALL draw smoke particles only as decoration, and SHALL NOT read any particle back into State or into input.
11. THE Client SHALL import the Simulation only through its public entry point and SHALL NOT import from `src/server`.
12. THE Client SHALL render at a frame rate of at least 30 frames per second on a laptop with integrated graphics with one Room of 4 players.

### Requirement 12: HUD and in-game UI

**User Story:** As a player, I want a clear heads-up display, so that I can tell the time, the ropes, the candles and my cooldowns at a glance.

#### Acceptance Criteria

1. WHILE the Phase is `playing`, THE HUD SHALL show the remaining show time in minutes and seconds, computed from the tick count and `showLengthS`.
2. WHILE the Phase is `playing`, THE HUD SHALL show the number of Ropes cut out of `ropeCount`.
3. WHILE the Phase is `playing`, THE HUD SHALL show the number of Candles not snuffed out of the number of Spectators.
4. WHILE the player is a Spectator not on the Audience_Side, THE HUD SHALL show the fan state as ready or as seconds remaining until ready.
5. WHILE the player is the Showman, THE HUD SHALL show the Cart travel and the Image_Scale.
6. THE HUD SHALL show the player's role and the Room_Code.
7. THE Client SHALL build every control, menu, button and cursor in the game palette and SHALL NOT use browser-default controls, dialogs or cursors, and keyboard focus SHALL stay visible and operable on every styled control.
8. WHEN a Candle is snuffed or a Rope is cut, THE HUD SHALL show a text notice for 3 s naming the event.
9. WHILE the connection to the Server is lost, THE HUD SHALL show a reconnecting notice with the seconds remaining in Reconnect_Grace.

### Requirement 13: End screen, recap and replay

**User Story:** As a player, I want to see why I won or lost and watch the show again, so that we can argue about what happened and ask to swap roles.

#### Acceptance Criteria

1. WHEN the Phase becomes `ended`, THE Client SHALL show the Outcome as text naming the winning side and the reason, including the time elapsed and the number of Ropes cut and Candles snuffed.
2. WHEN the Client receives the State_Log, THE Client SHALL build the Recap with the time of each snuff, the time of each Rope cut, the number of Near_Misses and the time of the last Rope cut when any Rope was cut.
3. THE Simulation SHALL provide a pure function of a State_Log that returns the Recap data, so that the Recap is testable without the Client.
4. THE Client SHALL play the Replay as a top-down view of the room that shows, for each recorded State, the Cart position, the Beam direction, the Ghost, every Spectator and every Rope, at the 10 Hz rate of the State_Log.
5. THE Replay SHALL mark each snuff and each Rope cut at its recorded position when playback reaches its time.
6. THE Replay SHALL show all information regardless of role.
7. THE Client SHALL provide styled controls to restart the Replay, pause and resume it, and play it at 1 or 2 times speed.
8. THE Client SHALL provide a styled play-again control that sends the rematch request defined in Requirement 7.
9. FOR ALL recorded Rounds, the last State in the State_Log SHALL equal the final State of the Round, and re-running the Step_Function from the first State and the recorded input list SHALL produce a final State deep-equal to the last State in the State_Log (replay reproduces the final state).
10. THE Server SHALL record the input list for each Tick together with the State_Log so that the replay property in criterion 9 is testable.
11. WHILE the Phase is `ended`, THE Client SHALL keep the Replay and Recap available until the Room returns to `lobby`.

### Requirement 14: Solo play without the server

**User Story:** As a solo player, I want to play the Showman against bots without a running game server, so that I can try the game immediately.

#### Acceptance Criteria

1. WHERE the player picks solo play on the start screen, THE Client SHALL run the Simulation and the Spectator_Bot for 3 Bot_Seats in the browser and SHALL open no WebSocket.
2. WHERE solo play is running, THE Client SHALL use the same input mapping, View function, rendering, HUD, end screen, Recap and Replay as networked play.
3. WHERE solo play is running, THE Client SHALL advance the Simulation with a fixed-step accumulator at `tickS` per step, independent of the display frame rate.
4. WHERE solo play is running, THE Client SHALL draw the seed from a source outside the Simulation, so that the Simulation itself stays free of unseeded random calls.
5. THE `src/sim` module SHALL import nothing from `src/client`, `src/net` or `src/server`.

### Requirement 15: One-command local run

**User Story:** As a developer, I want one command that starts everything, so that I can playtest with friends within a minute.

#### Acceptance Criteria

1. WHEN a developer runs the Dev_Command from the repository root after installing dependencies with pnpm, THE Dev_Command SHALL start the Vite dev server for the Client and the Server and print the local URL of the Client.
2. WHILE the Dev_Command is running, THE Vite dev server SHALL proxy WebSocket requests for `/r/<Room_Code>` and HTTP requests for `/log/<Room_Code>` to the Server, so that one tunnelled port serves both.
3. WHEN a Client connects through a page served over HTTPS, THE Client SHALL use a `wss://` WebSocket URL on the same origin as the page, and WHEN served over HTTP it SHALL use `ws://`.
4. WHERE the environment variable `PORT` is set, THE Server SHALL listen on that port, and otherwise THE Server SHALL listen on a documented default port.
5. THE repository SHALL document in `README.md` the Dev_Command, the single extra command that exposes the Vite port through a Cloudflare quick tunnel, and the steps to share the Join_Link.
6. IF the Server port is already in use, THEN THE Dev_Command SHALL exit with a message naming the port.
7. THE repository SHALL add no paid service, plan or API, and SHALL add only dependencies that the `tech.md` rules permit (Vite and Three.js for the Client).

### Requirement 16: Tuning additions

**User Story:** As a designer, I want every new number in TUNING, so that playtests can tune the slice without touching rule code.

#### Acceptance Criteria

1. THE TUNING object SHALL define these new fields as named numeric or position fields with these starting values: `ropeCount` 3, `ropeCutHoldS` 4, `ropeCutRadiusM` 1, `litCandleRadiusM` 3, `shieldedCandleRadiusM` 1, `spectatorSpeedMps` 3, `fanReachM` 4, `nearMissRadiusM` 1, plus Rope positions and Spectator start positions inside the room.
2. IF a new TUNING duration, radius, speed or length field is missing, non-numeric, NaN or not positive, or a Rope or Spectator start position lies outside the room, THEN THE Simulation SHALL refuse to start and SHALL report an error naming the invalid field.
3. THE `TUNING.candlePositions` field SHALL be superseded by the Spectator start positions, and THE Simulation SHALL create each Candle at the start position of its owning Spectator.
4. THE Simulation SHALL read every new rule constant from TUNING and SHALL contain no numeric rule constants outside TUNING, apart from the literals 0 and 1.
5. THE Client and Server SHALL keep non-rule constants (such as camera height and reconnect timings) outside TUNING as named constants in SCREAMING_SNAKE_CASE.

### Requirement 17: Property-based and integration tests

**User Story:** As a developer, I want the new rules covered by property tests and a multi-client check, so that regressions show up before a playtest.

#### Acceptance Criteria

1. THE Property_Suite SHALL implement each correctness property named in Requirements 1, 3, 4, 8 and 13 as exactly one fast-check test per property, tagged with the property number, using the `FC_NUM_RUNS` configuration from the `smoke-and-projection` spec.
2. THE Property_Suite SHALL cover at least these properties: Cut_Progress stays within bounds and resets without a Cutter, a cut Rope stays cut, one Cutter and several Cutters advance Cut_Progress equally, the Outcome precedence rule, the View hides every excluded item, Snapshot round-trip including Ropes and Spectator positions, and the replay reproduces the final state.
3. THE Property_Suite SHALL preserve the determinism property of the `smoke-and-projection` spec on the extended State and input set: the same seed and input sequence produce a deep-equal State at every Tick.
4. THE Property_Suite SHALL import only modules under `src/sim`, `src/net`, `vitest` and `fast-check`, with no DOM or Three.js imports.
5. THE test suite SHALL include a Server integration test that connects 4 simulated clients to one Room through the Transport, plays a short Round and checks the roster, the Snapshot rate, a reconnect with a Seat_Token and the final State_Log.
6. THE test suite SHALL include a Playwright test that opens 2 browser pages on one Join_Link, starts a Round and checks that the Showman and the Spectator each see their own HUD.
7. THE test suite SHALL show a failing fast-check property's seed and shrunk counterexample in the vitest output.

### Requirement 18: Milestone 1 playtest acceptance

**User Story:** As the author, I want the slice to pass the Milestone 1 test from the design document, so that I know the rules are fun before I add art.

#### Acceptance Criteria

1. WHEN two humans play three consecutive Rounds in one Room with the rematch role swap, THE Client SHALL let both players read the Outcome reason for every Round on the end screen.
2. THE slice SHALL let a Showman project a Ghost, let a Spectator evade it, let a Spectator fan smoke away and let the Showman snuff a Candle, each in a networked Room of 2 humans and 2 Bot_Seats.
3. THE slice SHALL let one solo human play a full Round as the Showman against 3 Bot_Seats without a running game server.
4. THE slice SHALL let 4 humans in 4 browser tabs play a full Round, either all rope cuts or time up, through the Dev_Command and one tunnel.
5. THE repository SHALL contain `docs/playtest-checklist.md` listing the Milestone 1 pass test (after three Rounds, both players can say why they lost and ask to swap roles) and a table where playtesters record Round length, Outcome reason and the questions "why did you lose?" and "do you want to swap roles?" for each Round.
6. WHEN the pass test fails, THE checklist SHALL direct the author to fix the rules in TUNING or the specs before any art work.

## Open Questions for Review

These are assumptions I made while writing. Please confirm or change them.

1. **Solo play (Requirement 14):** `tech.md` says solo play runs the sim in the browser with no server. I kept that as a small requirement. If you would rather have solo play go through the Server for the slice, drop Requirement 14 and keep the bots server-side only.
2. **Snuffed Spectators (Requirement 4.7):** the design says snuffed players "stay on the audience side" but not what they see. I gave them the full-room view as a spectator camera. Alternatives: only solid ghosts and lit candles.
3. **Hidden information (Requirement 4 and Introduction):** the View is a pure function that the Client applies. The Server still sends full State, so a modified client can cheat. That is fine for friend playtests. Server-side filtering is listed as later work.
4. **Outcome tie (Requirement 3.4):** if the last Rope and the last Candle fall on the same Tick, Spectators win. The Cutter's Candle has to be lit to cut, so this is rare.
5. **Showman disconnect (Requirement 6.10):** there is no Showman bot, so a Showman who drops past the grace ends the Round with no Outcome and returns the Room to the lobby.
6. **Rematch (Requirement 7.7):** the Showman role rotates through human Seats. With one human, that human stays Showman.
7. **Client prediction (Requirement 11.9):** I only require interpolation. Through a tunnel RTT is about 120 ms, so Spectator movement may feel late. Local prediction can be added after the first playtest.
8. **Fan reach (Requirement 10.3):** the existing sim accepts any fan position in the room. I added a client-side `fanReachM` limit as a TUNING number, but the sim does not enforce it. Say if you want the sim to enforce it.
9. **Hosting (Requirement 15):** the slice serves the Client from Vite behind one tunnel. The static-host deploy that `tech.md` describes is later work.
