# Tasks: campaign (v4)

Source of truth: `docs/design.md`, "v4: the campaign". Every tuning number goes in `TUNING` with a unit suffix. The sim stays pure and seeded. Each milestone ends with a build that could be submitted; if time runs short the last finished milestone is the game. Solvability is proved by scripted solutions in tests, not by video bots.

- [ ] M1. Engine (11 to 15 Nov)
  - [ ] M1.1 Tape-selves replay from recorded states (position, facing, posture per tick), not inputs
  - [ ] M1.2 PAUSE, fast-forward and reverse on a tape-self; property tests: reverse of reverse is forward, fast-forward reaches the same end state, pause is idempotent
  - [ ] M1.3 Two decks: a list of tape-selves with slots; property test: two tape-selves never share a slot
  - [ ] M1.4 Data-driven levels: one file per tape (layout, chambers, plates, gates, Things, a solution script); a registry; the shop's current rooms become tapes 1 and 2
  - [ ] M1.5 A solution script per level that must pass in CI and that fails when the tool is removed
  - [ ] M1.6 Campaign save in localStorage: tapes cleared, medals, settings
  - [ ] M1.7 Hub: the counter and shelf as the level select, medals on the boxes, return between tapes
  - [ ] M1.8 Static deploy on a free host; the build runs from a URL
  - [ ] M1.9 New-player playtest of tapes 1 and 2 from the hub, no help

- [ ] M2. Spine (16 to 21 Nov)
  - [ ] M2.1 Tape 3 Late Show: FF tool, the Blind Listener
  - [ ] M2.2 Tape 4 Starship: REW tool, airlock set piece
  - [ ] M2.3 Tape 5 Heist: Deck 2, lens-only hazards (lasers)
  - [ ] M2.4 Lighting rig per film, fake volumetrics, dust, bloom, colour grade per tape
  - [ ] M2.5 Adaptive score v1: layered stems driven by tension, notice and rush
  - [ ] M2.6 Occlusion: walls muffle sound
  - [ ] M2.7 Tape 2 Home Movies: the Thing's first appearance
  - [ ] M2.8 New-player playtest of tapes 1 to 5

- [ ] M3. Finish (22 to 27 Nov)
  - [ ] M3.1 Tape 6 Infomercial: DUB tool, the Static
  - [ ] M3.2 Tape 7 The Basement Tape: all tools, two Things, the cage set piece
  - [ ] M3.3 Tape 8 Closing Time: everything, then the reveal
  - [ ] M3.4 The dailies: a TV replay of each run with the Thing visible; the tape 8 version is the full reveal and the share frame
  - [ ] M3.5 Ranks per tape (par clips, time, catches), ONE TAKE seal, ghost of your best run
  - [ ] M3.6 The narrator: the training video voice, its lines per tape, synthesised blips

- [ ] M4. Polish (28 Nov to 1 Dec)
  - [ ] M4.1 Accessibility: subtitles for key sounds, reduce flicker, hold or toggle for every input, shapes as well as colours
  - [ ] M4.2 Gamepad
  - [ ] M4.3 Performance: quality presets, dynamic resolution, a 60 fps target on an M1 Air
  - [ ] M4.4 Balance from playtests; pars from real runs
  - [ ] M4.5 Director's cut: one modifier per tape
  - [ ] M4.6 Feel audit again; fix the top five

- [ ] Ship (1 to 3 Dec)
  - [ ] S.1 Video under 3 minutes
  - [ ] S.2 Kiro write-up and `docs/kiro-evidence.md`
  - [ ] S.3 License, README, public repo with `.kiro/`
  - [ ] S.4 Submit by 3 Dec
