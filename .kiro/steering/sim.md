---
inclusion: fileMatch
fileMatchPattern: "src/sim/**"
---

# Sim rules

## Lens-visible rule
The Thing is lens-visible if and only if all of these hold on the same tick (`readLens` in `src/sim/lens.ts`):
- the lens is up (`lensRaise` >= `lensVisibleRaise`),
- the battery is above 0,
- the Thing is within `lensRangeM`,
- the Thing is inside `lensVisibleHalfAngleDeg` of the look direction (3D, eye height to `thingCenterHeightM`),
- the line of sight is not blocked by a wall or a closed door.

Otherwise it is not visible. Render, audio and the notice meter all read this one function. Nothing else decides visibility, except the replay, which forces it on.

The focus box is narrower: `inFocusBox` is visible AND within `lensNoticeHalfAngleDeg`. Only the focus box fills the notice meter.

## Notice meter
- Range [0, 1], always.
- Fill per second = (`noticeFillPerSec` if the Thing is in the focus box, times `recLightFillMultiplier` if the Thing also sees the REC light) + (`recLightFillPerSec` if it sees the REC light at all). The REC light is seen when the lens is raised, there is line of sight and the Thing is within `recLightRangeM`.
- With no fill the meter decays at `noticeDecayPerSec`.
- Reaching 1 starts a rush. A rush lasts `rushDurationSec`, then the Thing gives up, the meter resets to 0 and cannot fill for `rushCooldownSec`.
- Meter and rush timers are tick counts converted from seconds with `tickHz`. Never use frame time.

## Chambers and acts
The shop is four chambers in a row (`level.chambers`). Walking into the next one moves the checkpoint to its entry, cuts the tape (the echo goes) and swaps in that chamber's Thing, or none: chambers 1 and 2 have no Thing, so the tape is learned in safety.
Act = chamber index, clamped to 1..3: chambers 1 and 2 are act 1 (Closing), chamber 3 act 2 (Rain), the VCR room act 3 (Blackout). Per-act arrays in `TUNING` (`act*`) set the Thing's speeds, rush length, cooldown and notice fill. Act 1's rush is slower than a sprint on purpose, so the first chase teaches that running works. From act 2 on, rush speed beats sprint speed, so running straight never wins and cover does.
Blackout: in the hold finale for the whole VCR room, in the run finale from the moment the tape plays.

## Movement and the Thing
- The player and the Thing move on the shop grid and never cross a wall or a closed door.
- Noise has a radius per movement mode (`noiseWalkRadiusM`, `noiseSprintRadiusM`, crouch is silent). The Thing stalks the nearest noise it hears, yours or your tape-self's. Holding the VCR is loud (`vcrNoiseRadiusM`), whoever holds it.
- Caught means the Thing is within `catchRadiusM` of the player, unless the player is hidden and the Thing is not rushing.
- Patrols draw three cells from act 2 and take the one nearest the player. Patrol cells never include hiding spots.

## Doors
- Doors start closed. A closed door is a wall for the player and for sight. The Thing paths through doors but a closed door costs it `doorBreakSec`, then it opens.
- Closing a door is refused if the player or the Thing is within `doorClearM` of it. Opening is always allowed.

## Hiding and searching
- Hidden = crouching in a hiding spot cell.
- Well hidden = hidden, lens down, not moving.
- A rushing Thing that gets within `searchRadiusM` of a well-hidden player stops and searches for `searchSec`, then gives up. If the player stops being well hidden during the search (lens up, moving, or leaving cover) the search becomes a rush from beside them.
- A rushing Thing follows the last place it saw you. A well-hidden player is not seen.

## Tapes, VCR and the exit
- Tapes sit at each chamber's entry and are taken by walking within `tapePickupRadiusM`. Taking one tops the battery up.
- The VCR works only with all three tapes. Holding interact fills it, and a tape-self whose clip ended holding interact at the VCR keeps holding it; letting go drains it at `vcrDecayFactor` of the fill rate. Hold finale: `vcrHoldSecHold`. Run finale: `vcrHoldSecRun`, then the Thing hunts without giving up (`rageSpeedMps`, below sprint speed).
- When the tape has played the exit opens. Reaching it within `winRadiusM` wins. A catch wakes you at the checkpoint, keeps the tapes and the exit state, and ends the rage.

## The tape (record and echo)
- A record press starts a clip; the next press, or `recordMaxSec`, stops it. Stopping rewinds you to where the clip began, and your tape-self (the echo) replays the clip's inputs from there through the same `stepPlayer`, then stands where it ended in its last posture. A clip under `recordMinSec` is thrown away.
- One echo at a time. A new clip replaces it. A catch or a chamber change removes it.
- The echo collides like you, holds plates like you, and makes noise like you. It never opens doors.
- A Thing that is not rushing and gets within `catchRadiusM` of the echo tears it: the echo is gone and the Thing goes back to wandering. A rushing Thing ignores it and comes for you.

## Plates and gates
- A plate is held while any body (you or the echo) is within `plateRadiusM` of its centre.
- A gate is open while every plate of its letter is held, then for its own `delaySec` after (set per letter in `level.ts`: the first gate snaps shut in 0.4 s, the rest wait 2 s), and for as long as a body overlaps its cell. It never closes on anyone.
- Closed gates are walls for you, the echo and the Thing, but not for sight.
- A single-plate gate must be farther from its plate than a sprint covers in its `delaySec` plus 0.8 s, so it cannot be beaten alone.

## Checkpoints and fairness
- Death wakes you at the entry of your chamber and keeps all tapes found.
- A restart press (`input.restart`, edge only) does the same on purpose: back to the chamber entry, tape, plates and gates cleared, the grace started, tapes, doors and VCR progress kept. It counts in `chamberRestarts`, not `caughtCount`. It exists so no clip can soft-lock you (the chain's inner room).
- The Thing respawns at one of its chamber's spawns, at least `thingRespawnMinDistM` away when the chamber allows, then stands still, deaf and blind, for `wakeGraceSec`.

## Determinism
- No `Math.random`, `Date.now`, `performance.now`, timers, or DOM/Three.js/Web Audio imports.
- All randomness comes from a seeded RNG stored in state.
- `step(state, input)` does not mutate its arguments. Same state and input give the same output.
- State is plain serializable data.
- Every tuning number comes from `TUNING`. No magic numbers in rule code.
- Round end is decided by tick count only.

## Properties to keep tested (fast-check)
- Same seed and inputs always give the same state; `step` never mutates its arguments.
- The Thing is lens-visible exactly under the rule above.
- The notice meter, battery and lens raise stay in [0, 1].
- Nobody crosses a wall or a closed door.
- A well-hidden player is never caught by a rush; raising the lens during a search gets you caught.
- A catch keeps the tapes, wakes you at the chamber entry, and the Thing does not move during the grace.
- A restart press gets you out of a soft-lock, and holding it does not repeat.
- The echo replays the recorded path exactly.
- Each chamber can be solved with the echo and cannot be solved alone.
- The VCR can be played by the echo, and the Thing tears a loud echo without catching a hidden player.
- The run finale can be won by a straight sprint to the door.
- The level is rectangular, every hiding spot opens onto an aisle, and every plate, hide and gate is reachable from its chamber entry.
