# Tasks: campaign (v5)

Source of truth: `docs/design.md`, "v5". Rules: `.kiro/steering/difficulty.md`, `tone.md`, `feel.md`, `sim.md`. Every tuning number goes in `TUNING` with a unit suffix. The sim stays pure and seeded. Each phase ends with a build that could be submitted. A task is done only when it is **walked** (by whom is written next to it) and its weighted events have layers.

- [ ] L. Lockdown (Fri 13 to Sun 15 Nov)
  - [x] L.1 Commit everything on a branch (`lockdown`)
  - [ ] L.2 Public repo: license, About section, `.kiro/` at the root and not ignored
  - [ ] L.3 Static deploy to a URL; the pointer-lock iframe note in the README
  - [ ] L.4 CI: typecheck, tests, build; solution scripts for all five chambers including the finale, each failing without its tool
  - [ ] L.5 Fix: the reveal is hollow. In chambers without a Thing, it follows unseen (6 to 10 m behind, never closer than 4 m, never attacking), visible only on the lens
  - [ ] L.6 Fix: the finale has one readable solution (start recording from an alcove, walk to the VCR, rewind, your tape-self plays the tape as bait). Hold only, 10 s, the tape-self counts double. Hint after 2 catches. Remove the finale toggle
  - [ ] L.7 Fix: chamber 3 fairness (sanctuary at the entry, never walks into a silent still player, the nearest tube stutters when it is within 5 m)
  - [ ] L.8 Fix: chamber 2 (gate hold 3.5 s, the open gate looks open)
  - [ ] L.9 Fix: HUD (objective hidden while the lens is up, guide below the viewfinder, STBY, no "WORKING TITLE", VHS tape spines, a pointer-lock failure message)
  - [ ] L.10 Quality: a low preset, pixel ratio cap 1.5
  - [ ] L.11 Steering: tone, difficulty (done), feel
  - [ ] L.12 Hooks: level save runs its solution script; task completion appends to the evidence log; commit blocked on stray placeholders
  - [ ] L.13 `docs/kiro-evidence.md` started with dates; `docs/placeholders.md`; `docs/video-shot-list.md`
  - [ ] L.14 Gate: the author plays it from the URL; a stranger finishes it without help

- [ ] M1. Spine (Mon 16 to Fri 20 Nov)
  - [ ] M1.1 Tape-selves replay from recorded states; tracking error when blocked
  - [ ] M1.2 PAUSE and REVERSE; property tests: reverse of reverse is forward, replay is deterministic, pause is idempotent
  - [ ] M1.3 No-soft-lock property: from any reachable state the exit can be reached or R recovers
  - [ ] M1.4 Data-driven levels: one file per tape, a registry, a solution script each
  - [ ] M1.5 A minimal hub in the store
  - [ ] M1.6 The reveal ending: the Thing's full path replayed on the TV, visible, timecoded; the share frame
  - [ ] M1.7 Tape 1 recut from today's chambers (training video)
  - [ ] M1.8 Gate: the author plays tape 1 to the reveal on the URL; report credits

- [ ] M2. Dread (Sat 21 to Thu 26 Nov)
  - [ ] M2.1 Tape 2, home movie (PAUSE)
  - [ ] M2.2 Tape 3, security tape (REVERSE, scouting)
  - [ ] M2.3 Second deck
  - [ ] M2.4 Thing behaviour v2 (one Thing, escalating)
  - [ ] M2.5 Sound and adaptive music v1; a look per tape
  - [ ] M2.6 The instruction tape
  - [ ] M2.7 The aftermath: the store changes after each tape
  - [ ] M2.8 Gate: two people who have never seen the game reach the reveal without help; note where each got stuck

- [ ] M3. Finish (Fri 27 Nov to Tue 1 Dec)
  - [ ] M3.1 Tape 4, late-night broadcast (second deck, it learns your tapes); tape 5 only if gate 2 was clean
  - [ ] M3.2 Ranks, ONE TAKE, ghost of your best run
  - [ ] M3.3 Accessibility: reduce flicker, subtitles for key sounds
  - [ ] M3.4 Measure on an M1 Air and a Windows laptop with integrated graphics; Chrome, Firefox, Safari, inside an iframe
  - [ ] M3.5 Feel audit, fix its top 5
  - [ ] M3.6 Content freeze at noon on Tue 1 Dec

- [ ] S. Ship (Tue 1 to Thu 3 Dec)
  - [ ] S.1 Video under 3 minutes, public on YouTube
  - [ ] S.2 Kiro write-up
  - [ ] S.3 README, license in About, public repo with `.kiro/`
  - [ ] S.4 Submit on 3 Dec
