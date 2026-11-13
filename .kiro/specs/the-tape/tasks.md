# Tasks: the-tape (first-person tape horror)

Source of truth: `docs/design.md` (v2). Every tuning number goes in `TUNING` with a unit suffix. Sim stays pure and seeded.

- [x] 1. Pivot the project
  - [x] 1.1 Remove v1 code, specs, spikes and steering; write v2 steering
  - [x] 1.2 Scaffold Vite + Three.js + Vitest + fast-check + tsconfig, hooks, README, evidence log

- [ ] 2. Core interaction on an empty grey-box aisle (Milestone 1)
  - [x] 2.1 Sim: player state, walk, sprint, crouch, wall collision on a grid, `tickHz` 60
  - [x] 2.2 Client: pointer lock, mouse look at render rate, WASD, same-frame response
  - [x] 2.3 Lens: raise and lower with RMB, FOV change, battery drain and recharge
  - [x] 2.4 Lens view vs world view render passes (Thing visible only in lens)
  - [x] 2.5 Thing placeholder with the notice meter (cone, line of sight, fill and decay)
  - [x] 2.6 Sound v0: fluorescent hum, tape hiss rising with distance, servo whirr, REC beep, footsteps with pitch variation
  - [x] 2.7 Property tests: determinism, lens-visible iff rule, notice meter in [0, 1]
  - [ ] 2.8 Playtest with a stranger: pass only if they lower the lens unprompted

- [x] 3. The Thing
  - [x] 3.1 Stalk toward noise, wander otherwise, nav grid so it never crosses walls
  - [x] 3.2 Notice to rush, rush duration and give-up
  - [x] 3.3 Hiding spots and doors; REC light betrays a hidden player
  - [x] 3.4 Catch and rewind-restart under 0.5 s on the same key
  - [x] 3.5 Property tests: no wall crossing, no spawn-kill after checkpoint

- [x] 4. The night
  - [x] 4.1 Three tapes found by lens-only beacons (written clues on shelves are a later polish pass)
  - [x] 4.2 Three acts: tuning ramps per act, blackout in act 3
  - [x] 4.3 VCR hold finale
  - [x] 4.4 Checkpoints that keep found tapes
  - [x] 4.5 Teaching: first ten seconds with at most a few words that fade after the action

- [ ] 5. The replay reveal
  - [ ] 5.1 Record seed and per-tick inputs
  - [ ] 5.2 Re-run the sim with the Thing forced visible, from the player's camera path
  - [ ] 5.3 TV scene, timecode, scrub; share frame export
  - [ ] 5.4 Property test: replay reproduces the final state

- [ ] 6. Look, sound, UI
  - [ ] 6.1 Shop art: instanced shelves, counter, TV, neon; palette from design
  - [ ] 6.2 VHS post-process on the lens view only
  - [ ] 6.3 Full sound palette on buses with limiter, one shared reverb, mains-hum key
  - [ ] 6.4 Diegetic HUD: viewfinder timecode, battery, REC; no web panels; embedded font
  - [ ] 6.5 Title, death and end as scenes with sound

- [ ] 7. Ship
  - [ ] 7.1 Static build and free deploy (no server)
  - [ ] 7.2 Playtests with footage; tune the top three knobs
  - [ ] 7.3 Video under 3 min, Kiro write-up, license, public repo with `.kiro/`

- [ ] 8. Added after the first playtest (11 Nov)
  - [x] 8.1 Settings: sensitivity, lens hold or toggle, reduced effects, FPS counter, finale choice (saved in localStorage)
  - [x] 8.2 Two finales, chosen on the title screen: hold the VCR while it comes, or play it and run for the door
  - [ ] 8.3 Playtest both finales; pick one or tune both
  - [ ] 8.4 Tune the three acts (Thing speeds, rush length, cooldowns) from a full night

- [ ] 9. Record and echo chambers (v3, after the second playtest; see `docs/design.md`, "v3: the tape")
  - [x] 9.1 Sim: record a clip, rewind to its start, echo replays it through `stepPlayer`, parks in its last posture
  - [x] 9.2 Sim: plates and gates (held by you or the echo, a close delay per gate, never close on a body)
  - [x] 9.3 Sim: chambers with their own Thing or none, checkpoint at each entry, the tape cut on entry
  - [x] 9.4 Sim: the Thing hears the echo, tears a non-rushing echo it reaches; the echo can hold the VCR
  - [x] 9.5 Sim: `wakeGraceSec` after a catch
  - [x] 9.6 Level: five chambers (gate, two plates, the Thing, two gates, the counter). The chain was cut from three pads to two after the author found it too hard
  - [x] 9.7 Property and unit tests: exact replay, each chamber solvable with the echo and not alone, the echo plays the tape, grace
  - [x] 9.8 Client: echo figure, plates, gates, REC frame and clip timer, the tape's voice, positional echo footsteps, plate and gate sounds
  - [x] 9.9 Bot plans for every chamber, playtest capped at 4 min
  - [ ] 9.10 Author playthrough of all five chambers; tune clip length, gate delay, the counter's noise
  - [ ] 9.11 Stretch chambers: lens and echo, hide and swap

- [ ] 10. Onboarding and performance (after the third playtest; see `docs/design.md`, "Onboarding" and "Performance")
  - [x] 10.1 Title: name and CLICK TO START only; settings and controls on the pause screen
  - [x] 10.2 Chamber 1 rebuilt: start, plate and gate in one aisle, in view; the first gate snaps shut in 0.4 s (close delay per gate)
  - [x] 10.3 Floor wires from plates to gates, one lamp per plate over each gate
  - [x] 10.4 Clip footprints and the tape-self play bar
  - [x] 10.5 Guide: objective and prompt from the state, key caps, prompts that wait for the action
  - [x] 10.6 Render at 1x with 2x MSAA, light only the near chambers, rest the GPU behind the title and pause screens
  - [ ] 10.7 Playtest with a new player, without explaining anything; note where they stop

- [ ] 11. Feel audit fixes (12 / 18; see `docs/design.md`, "Feel audit")
  - [x] 11.1 Sim: restart the chamber on one press (`input.restart`), tested against the chain soft-lock
  - [x] 11.2 Night map on the win card: you, your tape-selves, the Thing in red
  - [x] 11.3 Clips and catches per chamber, ONE TAKE, counting totals
  - [x] 11.4 Rising chime per chamber cleared
  - [ ] 11.5 Audition every sound on headphones; check the win card ticks are not too busy

