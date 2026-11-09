# Playtest checklist: Milestone 1

## Pass test

After three Rounds, both players can say why they lost and ask to swap roles.

Setup: two humans in one Room (two bots fill the other seats), three Rounds in a row using play again so the Showman role swaps each time. Both players must be able to read the Outcome reason on the end screen after every Round.

## Round log

Fill one row per Round. Ask each question out loud and write the answer.

| Round | Length (m:ss) | Outcome reason | "Why did you lose?" | "Do you want to swap roles?" |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

Outcome reason is one of: `all_ropes_cut`, `all_candles_snuffed`, `time_up`.

## Result

- [ ] After Round 3, both players gave a clear reason for losing.
- [ ] Both players asked to swap roles (or said why not).
- [ ] Pass / Fail:

## Manual bars

- [ ] Snapshot rate: over 60 s on localhost the client averages at least 19 snapshots per second (bar from `spikes/net/NETWORK_SPIKE.md`). Measured: ______ /s
- [ ] Frame rate: at least 30 fps on a laptop with integrated graphics, one Room of 4 players. Measured: ______ fps on ______

## Slice checks

- [ ] Showman projects a Ghost, a Spectator evades it, a Spectator fans smoke away, the Showman snuffs a Candle (2 humans, 2 bots).
- [ ] Solo: one human plays a full Round as Showman against 3 bots with no server running.
- [ ] 4 humans in 4 tabs play a full Round through `pnpm dev` and one `pnpm tunnel`.

## If the test fails

Fix the rules before any art work. Change the numbers in `TUNING` (`src/sim/tuning.ts`) or change the specs, then replay the test. Do not start art, sound or Blender assets until the pass test passes.
