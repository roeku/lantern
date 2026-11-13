# ⟨Rewind Night⟩: design v4

*Kiroween 2026 · Resurrection (dead tech: VHS) with a Costume Contest angle · 11 November 2026.*
*Placeholders are marked ⟨…⟩ and are the author's to replace: title, setting, names, any text. The v1 design (top-down, 1 vs 3) and its code were removed on 11 Nov; a backup tarball lives outside the repo.*

*v4 (11 Nov, night): the author asked for a much bigger game; see "v4: the campaign" first. v3 below is now the first two tapes.*

*v3 (11 Nov, evening): the open shop with three tapes felt like a demo. The night is now a run of test chambers built on one tool, record and echo. The section "v3: the tape" below is the current design; where it disagrees with the older sections, v3 wins.*

## v4: the campaign (current plan, 11 Nov evening)

*The author asked for a much bigger game: "the near equivalent of a triple-A game", all remaining Kiro credits on this one project. Everything below the placeholders marked ⟨…⟩ is the assistant's proposal. v3 (the five chambers) becomes the first two tapes of the campaign.*

### What "bigger" means here
More rooms with the same idea would only be longer. The game gets bigger by **changing what the tool can do** (Portal's lesson), **changing the world around it** (each tape is a different film), and **adding a reason to come back** (ranks, a ghost of your best run, a director's cut). A triple-A budget is not reachable in three weeks with no paid assets. The target is a game that feels authored and cohesive at the level of the best indie and jam entries, with the first 15 minutes (what judges actually play) held to the highest standard.

### Feel Brief, v4 (game-feel Step 0)
1. **Verbs:** record, rewind, and now the whole VCR: pause, fast-forward, reverse, a second deck, dubbing over a playing tape. Look through the lens. Hide. Lure.
2. **Feeling:** ⟨"I outsmarted the thing that hunts me using only my own past."⟩ Unchanged, and the campaign deepens it: first you use your past self, then you *direct* it.
3. **Essence:** you can only be in one place, but you can be several times. Every level is a question about when to send which version of yourself where, under the eye of something that hears everything and can only be seen through the lens.
4. **The specific thing:** the monster exists only on the lens, your tape-selves exist only off it, and the VCR's own buttons are the puzzle tools. Reverse play ("walk out of the gate you walked in through") is the one nobody else has.
5. **References, for principles:** Portal (one tool, new gadgets, every room a question, a voice that teaches); Superhot (time as the mechanic, and the replay as the reward); Inscryption (the game lives inside a frame object: here, the rental shelf).
6. **Tone and material:** dry wit over quiet dread. Plastic, magnetic tape, CRT glass, lino, rain. Each film adds its own material (suburban carpet, brushed steel, wood panelling).
7. **Look:** the VHS palette stays the spine (near-black, fluorescent green-white, REC red, tape-blue). Each film gets one extra accent and its own lighting rig, grain and tint.
8. **Session shape:** a campaign of eight tapes, about 40 minutes the first time, 4 to 7 minutes per tape. Escalates on tool count, Thing types and set pieces. Aftermath per tape: the dailies, a TV replay of your run with the Thing visible.
9. **Closing test:** ⟨"I trapped it behind a door using my own past self as bait."⟩

### The frame ⟨placeholder, the author's to replace⟩
You are the night clerk of a video shop. The tapes on the shelf are cursed rentals; the VCR at the counter takes you into each film. The shelf is the level select (diegetic, with your medals on the boxes). The Thing is the tape-eater: it lives between the frames and can only be seen on tape. The tape's deadpan narrator (the training video in tape 1, then whatever is left of it) is the Portal-style voice that teaches.

### The VCR buttons (the tools, one new one every tape or two)
| Button | Key | What your tape-self does | First taught in |
|---|---|---|---|
| REC / PLAY | F | Records a clip, rewinds you, plays it back | Tape 1 |
| PAUSE | G | Freezes your tape-self where it is, holding a plate mid-pose; press again to let it carry on | Tape 2 |
| FF | hold T | Plays your clip at double speed: the timing lever | Tape 3 |
| REW | hold Y | Plays your clip backwards. Record walking *through* a gate, play it reverse and you walk back out | Tape 4 |
| DECK 2 | tab | A second tape-self at once | Tape 5 |
| DUB | with F while a tape-self plays | Record a new clip *alongside* a playing one, so you can layer yourself | Tape 6 |

To make pause, fast-forward and reverse work, tape-selves are replayed from recorded **states** (position, facing, posture per tick) instead of re-running inputs. Collision and gates still apply to what they can touch. This is a sim rewrite and the first milestone.

### The campaign ⟨all film names and settings are placeholders⟩
| # | Tape | Look | New tool or rule | The set piece |
|---|---|---|---|---|
| 1 | Staff Orientation | corporate training video: bright, cheerful, wrong | REC | The narrator explains the tape. Gate, two plates (the current rooms 1 and 2, kept). |
| 2 | Home Movies | family camcorder: warm carpet, a birthday that will not end | PAUSE | The Thing's first appearance, seen only on the lens at the party. |
| 3 | Late Show | black-and-white horror: one tall window, fog | FF, the Blind Listener (hears only) | A long corridor chase where fast-forwarding your tape-self buys you the seconds. |
| 4 | Starship | brushed steel, red alert, airlocks | REW | Airlocks that only open if you walk out of them backwards in time. |
| 5 | Heist | security cameras, laser grids visible *only on the lens* | DECK 2, lens-only hazards | A vault with two tape-selves and a patrol you can only see through the camcorder. |
| 6 | Infomercial | saturated, loud, too happy | DUB, the Static (drawn to a raised lens) | A room where the lens is a liability and the plates are on the other side of it. |
| 7 | The Basement Tape | nobody rents this one; raw concrete, one bulb | all tools, two Things | Cage the Thing: lure it with a sprinting tape-self and close a gate on it. |
| 8 | Closing Time | the real shop, after all | everything | The reveal. Play your whole night back on the TV and watch where it stood. |

Cut order if time runs short: 6, then 3, then 2 (tape numbers are merged, not dropped, so the tools still arrive in order). Tapes 1, 4, 5, 7, 8 are the spine.

### Things that make it feel like a game of this size
- **Hub:** the shop counter and shelf. Walk to it, pick a tape from the shelf, see your medals. Return between tapes. The old exit door is the end of the campaign.
- **Mastery signals:** per tape a par for clips, time and catches, a medal for each, a ONE TAKE seal, and a **ghost of your best run** playing beside you in a re-run (the echo mechanic reused as a mastery tool).
- **The dailies:** after each tape, a short TV replay of your run with the Thing visible, timecoded. Tape 8's version is the full reveal and the share frame.
- **Director's cut:** after the campaign each tape gets one modifier (no lens battery, double Thing, a shorter tape) and a new par.
- **Thing variety:** the Stalker (today), the Blind Listener (ignores the lens, hears footsteps, sprinting is fatal), the Static (drawn to the REC light, harmless if the lens stays down).
- **Set pieces:** an authored moment per tape (the party, the airlock, the vault, the cage), scripted with the same sim rules, no cutscene engine.
- **Camera and lens:** handheld sway, focus breathing, a bump on every rewind, FOV kicks, the lens dirtying as the battery dies.
- **Light:** a lighting rig per film, fake volumetric light cards, dust in the beams, bloom, a colour grade per tape. Lights stay under the budget (constant count) so the shader never recompiles.
- **Audio:** an adaptive score built from the B1 mains hum in layers (drone, pulse, arpeggio, noise) driven by tension, notice and rush; a bed per film; walls muffle sound (a raycast low-pass); the narrator speaks in synthesised blips; the mix ducks around events.
- **Accessibility and comfort:** subtitles for key sounds, reduce flicker, hold-or-toggle for every input, shapes as well as colours for plates, a settings screen, gamepad support.
- **Performance:** quality presets and dynamic resolution; the target is 60 fps on an M1 Air with the fans quiet. Already done: 1x render ratio, 2x MSAA, lights only near you.

### How we keep it shippable
Four milestones. Each ends with a build that could be submitted. If time or credits run out, the last finished milestone is the game.
| Dates | Milestone | Ends with |
|---|---|---|
| 11 to 15 Nov | **M1 Engine:** data-driven levels, state-based tape-selves (pause, fast-forward, reverse), two decks, a campaign save, the hub, a static deploy | Tapes 1 and 2 playable from the hub, deployed |
| 16 to 21 Nov | **M2 Spine:** tapes 3 to 5, the Blind Listener, lens-only hazards, the adaptive score v1, the lighting rig per film | Five tapes, about 20 minutes, the best 15 minutes of the game |
| 22 to 27 Nov | **M3 Finish:** tapes 6 to 8, the Static, the cage set piece, the dailies replay and the tape 8 reveal, ranks, ghost of your best run | The whole campaign |
| 28 Nov to 1 Dec | **M4 Polish:** accessibility, gamepad, performance, balance from playtests, director's cut | A release candidate |
| 1 to 3 Dec | Video (under 3 min), write-up, public repo with `.kiro/`, submit | Submitted by 3 Dec |

### How credits are spent
Large, well-tested slices, not long loops. Solvability is proved by tests that play scripted solutions (not by video bots, which are slow and expensive), and the one bot recording is saved for the submission video. Each milestone starts from a Kiro spec and ends with property tests. No credit goes to anything a free asset or a procedural trick can do.

### Risks
- **Art workload with no assets.** Mitigation: a small prop kit built from primitives, a strong VHS filter that makes simple shapes look intentional, and one accent colour per film.
- **Reverse playback and layered tape-selves are hard to keep fair.** Mitigation: states instead of inputs, property tests (reverse of reverse is forward, fast-forward reaches the same end state, two tape-selves never share a slot), and a solution script per level that must pass in CI.
- **A longer game hides the bad parts of the opening.** Mitigation: a new-player playtest after M1 and M2, before anything is added.

## Pitch
First person, solo, about 6 minutes. You are alone in a video rental shop after closing, holding a camcorder. Something is in the shop with you, and **it only exists on tape**. With the lens down you see an empty, dim shop and hear something wrong. With the lens up you see it, but your view narrows, the battery drains, and a glowing REC light tells it exactly where you are.

When the night ends, the camcorder plays your own footage back on a TV. In the frames you filmed, you can see where it was all along.

## The rule that makes it new
**You can only see the monster through the one thing that makes you visible to it.** The viewfinder is your sight, your clue reader and your danger, all at once. This is the whole tension. Everything else supports it.

## The loop (every 5 to 10 seconds the player chooses)
1. **Look** (raise the camcorder): you see the Thing and read REC-only writing on shelves that points to the next tape. The Thing's notice meter fills while it is inside your lens cone.
2. **Look away** (lower it): you are safe from the notice meter, blind, and the battery recharges slowly.
3. **Move**: walking is quiet, sprinting is loud and drags the Thing toward the noise.
4. **Hide**: crouch into a shelf gap or behind the counter with the lens down. REC light on means it finds you.
5. **Rush**: if the meter fills, it rushes. You sprint to a hiding spot or a door you can shut. It is fast, loud, and the scariest sound in the game.

## Show shape (one night, three acts, ~6 min)
| Act | Thing | You | Beat |
|---|---|---|---|
| 1. Closing | Slow, far away, no rush | Find tape 1 | Safe look, reward, first glimpse |
| 2. Rain | Stalks sound, can rush | Find tape 2 | Hide, lure, first chase |
| 3. Blackout | Rushes twice as often, lights fail | Play the last tape in the VCR (hold 20 s at the counter) | The long hold |

**Death** is a tape rewind: the screen scrubs back to the last tape you found in under 0.5 s, on the same key. Tapes you have found stay found.

**Aftermath:** the lights come up, the music stops, the rain stops. You walk to the TV and the camcorder footage plays with the Thing always visible, with a timecode. You watch the 40 seconds it stood behind you. A still frame is the share card.

## Feel Brief (game-feel Step 0)
1. **Verbs:** raise or lower the lens, move, sprint, crouch, hide, interact (take a tape, play a tape), shut a door.
2. **Feeling:** ⟨"I have to look, and looking is what gets me caught."⟩ Small and true: the dread of needing information you know will cost you.
3. **Essence:** information against safety. See it (and be seen) or stay blind (and be surprised).
4. **The specific thing:** the monster is visible only through the lens, and the replay shows what you never saw. No other game has that exact reveal, and it could not move to another game without changing it.
5. **References (principles, not skins):**
   - Alien: Isolation: the information tool is itself the risk.
   - Hotline Miami: instant restart is part of the loop, and silence after noise.
   - Not like: Outlast or FNAF. We are not a night-vision jump-scare corridor. The Thing never exists in the world, only on tape, and the replay is the payoff.
6. **Tone and material:** quiet dread with a dry wit. Plastic, magnetic tape, lino, rain, fluorescent tube, CRT glass.
7. **Look:** palette of near-black, fluorescent green-white, REC red (the accent), tape-blue. Lit 3D in Three.js with a VHS post-process (grain, tracking bands, chroma bleed) on the lens view only. The world with the lens down is clean and dim, so the contrast sells which one is "the tape".
8. **Input:** keyboard and mouse, pointer lock, at a desk with headphones. Headphones are part of the design.
9. **Weighted events:**
   - Thing notices you (the biggest tell)
   - rush
   - caught and rewind
   - tape found
   - blackout
   - the replay reveal
10. **Sounds (one key: the 60 Hz mains hum, ~B1):**
    - fluorescent buzz
    - rain on glass
    - tape hiss, louder as the Thing nears
    - camcorder servo whirr and REC beep
    - lino footsteps
    - VCR rewind chirp
    - Thing: a quiet tracking-wobble idle, the rush screech
    - tape-stop pitch drop on death
    - the TV's static
11. **Session shape:** one night of ~6 minutes. Escalates in three acts on Thing speed, rush frequency and light. The aftermath is a silent walk and a replay.
12. **Closing test:** ⟨"It was standing behind me the whole time, and the tape proved it."⟩

## Architecture
- Deterministic sim: pure, seeded, no DOM, no `Math.random`, no `Date.now`, tuning in one `TUNING` object with unit-suffixed names.
- 60 Hz fixed tick (decided). With no server, 20 Hz would make first-person movement feel laggy. Camera yaw and pitch are applied at render rate; the sim reads them per tick.
- No server. Solo, static build. This also removes the "judges need other players" risk.
- The replay is **recorded inputs + seed**, re-rendered by the same sim with the Thing forced visible. Determinism is what makes the reveal possible.
- Everything is rebuilt from scratch. No v1 code, specs or steering remain in the repo.

## Starting tuning (all unit-suffixed in `TUNING`, all to be tuned in playtests)
| Setting | Start | Setting | Start |
|---|---|---|---|
| `tickHz` | 60 | `walkSpeedMps` | 1.8 |
| `sprintSpeedMps` | 4.2 | `crouchSpeedMps` | 0.9 |
| `normalFovDeg` | 78 | `lensFovDeg` | 42 |
| `lensRaiseTimeSec` | 0.18 | `batteryLifeSec` | 90 |
| `batteryRechargePerSec` | 0.4 of drain rate | `lensConeHalfAngleDeg` | 18 (notice cone) |
| `noticeFillPerSec` | 0.4 in cone, ×2 if REC light seen in dark | `noticeDecayPerSec` | 0.25 |
| `stalkSpeedMps` | 1.2 | `rushSpeedMps` | 5.0 |
| `rushDurationSec` | 6 | `noiseSprintRadiusM` | 8 |
| `noiseWalkRadiusM` | 2.5 | `hideSafeDistM` | 1.2 |
| `holdVcrSec` | 20 | `rewindRestartSec` | 0.4 |
| `showLengthSec` | 360 | `catchRadiusM` | 0.8 |

Rush speed is above sprint speed on purpose, so running in a straight line never works. Hiding spots and doors are the only answers.

## MVP scope
**In:**
- one shop, one Thing, three tapes, three acts
- the lens view and the world view
- hiding, doors, noise
- rewind-restart
- the replay reveal and a share frame
- full sound
- a static deploy

**Out:** multiplayer, more levels, voice, a Steam build, any paid service.
**Stretch:** a second Thing behaviour in act 3, accessibility options (reduced grain, subtitles for key sounds).

## Milestone 1 (Nov 11 to 13): pass/fail
A grey-box aisle where one person can raise the lens, see the Thing, and get noticed.
- **Pass:** a stranger lowers the lens on their own when the Thing is in view, and later says they did not want to look.
- **Fail:** fix the loop (cone size, meter speed, battery) before any art.

## Plan (deadline Dec 4, 2:00 PM PT; aim to submit Dec 3)
| Dates | Work |
|---|---|
| Nov 11 to 13 | Pivot steering and specs. First-person move, lens view, notice meter, grey-box aisle, hiss and servo sounds. Milestone 1. |
| Nov 14 to 20 | Thing AI (stalk, notice, rush), hiding, doors, tapes, rewind-restart, three acts. |
| Nov 21 to 27 | Replay reveal, shop art, VHS shader, full sound, HUD (timecode, battery, REC). |
| Nov 28 to Dec 1 | Playtests with footage, tuning, static deploy, itch.io page. |
| Dec 1 to 3 | Video (under 3 min), Kiro write-up, license, public repo with `.kiro/`. Submit. |

## Kiro plan
- **Specs:** `the-tape` (this file's tasks), then lens and notice rules, Thing AI, replay.
- **Steering:** `product.md`, `tech.md`, `structure.md` (always on), `sim.md` (when editing `src/sim/**`), `feel.md` (when editing `src/client/**`).
- **Property-based tests:**
  - same seed and inputs always give the same state
  - the Thing is lens-visible exactly when the lens is up, it is in the cone, line of sight is clear and the battery is above 0
  - the notice meter stays in [0, 1]
  - the Thing never crosses a wall
  - a checkpoint respawn is never within `hideSafeDistM` + 5 m of a rush
  - the replay reproduces the final state
  - rewind-restart keeps all tapes found
- **Hooks:** run property tests when `src/sim/**` changes; check `TUNING` names carry units.
- **MCP:** Playwright to drive a full night headless and capture the replay frame.
- **Evidence log** in `docs/kiro-evidence.md`, with at least one real bug a property caught.

## Open questions (the author decides)
- **Title:** ⟨Rewind Night⟩ is a placeholder. Search before committing.
- **Setting:** a video rental shop is my placeholder. A hotel desk, a school AV room or a night-shift security booth all work with the same rules.
- **Closing line and feeling:** confirm or replace.
- **Originality angle:** camcorder horror exists. Our difference is "only on tape" plus the replay reveal. Confirm that is the pitch.


## v3: the tape (current design)

### Why
After the second playtest the author said it still felt boring and incomplete, and asked for something like Portal. Portal's lesson is one tool that changes how you read every room, and each room asks one new question about it. The camcorder already records; v3 lets you record yourself.

### The tool: record and echo
- **F** starts a clip. **F** again (or the tape running out at `recordMaxSec`, 15 s) stops it.
- Stopping rewinds you to where the clip began. Your tape-self, the echo, replays the clip's inputs from there, then stands where it ended in its last posture.
- The echo is solid to plates, collides like you, and makes the same noise you made, so the Thing hears a sprinting echo.
- A clip that ends with E held at the VCR keeps holding it. The echo can play the tape for you.
- One echo at a time. A Thing that reaches a (non-rushing) echo tears it: the echo is gone and the Thing wanders off.
- It is the same `stepPlayer` on a recorded input log, so it stays deterministic and is property-tested to replay the path exactly.

### Plates and gates
A plate is held while you or the echo stand on it. A gate is open while all plates of its letter are held, plus its own close delay (0.4 s for the first gate, 2 s for the rest), and never closes on a body. Single-plate gates are farther from their plate than a sprint covers in that delay plus 0.8 s, so no gate can be beaten alone (a level test checks this).

### The night: five chambers
| # | Name ⟨placeholder⟩ | Thing | Question | Solution |
|---|---|---|---|---|
| 1 | The gate is shut | none | What does the tape do? | Record a walk to the plate, rewind, walk to the gate while your echo holds it. |
| 2 | Two plates | none | Can I be in two places? | Echo on one plate, you on the other. |
| 3 | It can hear you | patrols | Can I plan around it? | Record the long walk to the far plate; the echo parks there while you cross the short way, watching the lens. |
| 4 | Two gates | none | Do I need the echo for each step? | The echo holds the far plate, which opens the inner gate. You go in and stand on the plate in there, which opens the way out. One job each. |
| 5 | The counter | hunts noise | Who plays the tape? | Record yourself walking to the VCR and holding E. Hide. The echo plays the tape, the Thing goes for the noise and tears it; record another. Progress carries over. |

Tapes 1 to 3 wait at the entries of chambers 2, 3 and 5. Acts come from the chamber: chambers 1 and 2 are Closing, 3 and 4 Rain, the counter Blackout. Each chamber has its own Thing or none; walking into the next chamber cuts the tape and moves the checkpoint.

### Fairness
- A catch wakes you at your chamber's entry, keeps the tapes and the VCR progress, clears the echo.
- After a catch the Thing stands still, deaf and blind, for `wakeGraceSec` (3 s). Added because waking up next to it and dying again made rewinds feel useless.

### The tape's voice
A deadpan caption voice, one line per chamber, on the first recording, on a catch, and when the Thing tears your tape. All lines are ⟨placeholders⟩ for the author.

### Feel Brief changes
- **Verbs:** add record and rewind.
- **Feeling:** ⟨"I outsmarted the thing that hunts me using only my own past."⟩ The old line, "I have to look, and looking is what gets me caught", still holds in chambers 3 and 5.
- **The specific thing:** the monster is only on the lens; your echo is only off it (a blue striped figure in the world). Two kinds of tape, seen two ways.
- **Weighted events, added:** record start (REC beep, red frame), rewind into an echo (tape-stop, scrub, flash, servo), plate (positional click), gate (a rising or falling fifth in the key and a bolt), the Thing tearing your tape (tape-stop, flash, caption).
- **Closing test:** ⟨"I sent my past self to hold the tape so I could get out."⟩

### Onboarding (after the third playtest, 11 Nov)
A first-time player skipped the title text, did not understand recording, could not see which plate opened which gate (the first gate was out of sight), and thought the second chamber needed precise timing. The author had to explain. Changes:
- **Title** says only the name, CLICK TO START and HEADPHONES ON. Settings and the controls list moved to the pause screen.
- **Chamber 1 is Portal's first test:** you start facing down one aisle with the plate and the gate in plain view. Walking forward steps on the plate, the gate opens, and it snaps shut 0.4 s after you step off, before you can reach it. The lesson is seen, not read.
- **Wires:** a dotted line on the floor runs from every plate to its gate, red when up, lit when held.
- **Gate lamps:** one lamp per plate over every gate, so a gate that needs two plates shows two lamps.
- **Footprints:** red as you record, then blue, dimming as your tape-self walks them. You see the route before it is walked.
- **Tape-self bar:** a play head and seconds (`TAPE-SELF 1.4/2.6`) so timing is visible, and `TAPE-SELF WAITING` once it parks.
- **The guide:** one objective line top left and one prompt at the bottom, chosen from the state, with keys drawn as key caps. Prompts wait for the action. They also explain the common mistakes: a clip that ends off the plate, a tape-self that is still on its way, arriving too late in the chain.
- **One voice at a time:** the caption voice is silent in chambers 1 and 2 while the guide teaches.
- The tape-self fades when the camera is inside it, so the rewind is not a screen of blue.

### Performance (same playtest: smooth but heavy on the device)
No leak found. Over a minute of play the JS heap stayed at 18 MB, GPU geometries settled at 96 and shader programs at 16. The cost was resolution and lighting: the 3D view rendered at the Retina 2x ratio with 4x MSAA under 14 point lights, at the display's refresh rate, even behind the title screen. It now renders at 1x with 2x MSAA, lights only your chamber and the next one (8 lights, a constant count so shaders never recompile), and redraws behind the title or pause screen 4 times a second. The HUD keeps the full ratio for sharp text. Not measured on real GPU hardware: headless Chromium renders in software.

### Feel audit (11 Nov, after onboarding): 12 / 18
Essence 2, input 2, feedback 2, camera and audio 2, teaching and failure 2, HUD 2. From code and headless screenshots; audio not auditioned, no real GPU. Fixes applied:
1. **Start the room over: R in play.** A clip could shut you in the chain's inner room with nobody coming, and the only way out was restarting the whole night. Now one press wakes you at the room's entry. A test reproduces the soft-lock and the escape. The guide says `[R] START THE ROOM OVER` when you are shut in.
2. **The night map** on the win card: your route, every tape-self, then the Thing's path in red, "IT WAS HERE THE WHOLE TIME". A still version of the replay reveal, built from positions sampled 4 times a second.
3. **Mastery shown:** clips and catches per room, ONE TAKE for a room done in one clip without a catch, totals that count up.
4. **Clearing a room climbs the scale:** the chime plays on every room cleared, tape or not, one pentatonic step higher each time.
5. **The win card is a scene:** silence, then the map draws, the rows tick in, the numbers count.

### Not built yet
- The replay reveal on the TV (task 5). It now has more to show: the Thing and every echo you recorded.
- Chambers I pitched and did not build: lens and echo together, hide and swap.
- **Difficulty (author, after playing):** chamber 4 started as a chain where one clip had to hold the far plate, wait, then walk to a second plate outside the exit gate: three pads and three jobs. Too much, in the room meant as a breather. Cut to two pads, one job each. The mechanic is now taught in four steps (do it, double it, plan around danger, repeat it with a twist) and the hard thinking is left to the counter.
- Written clues, music, a second Thing behaviour.

## Build status (11 Nov, after the first playtest; superseded by v3)
Built and playable end to end: shop layout with 3 tapes, 2 doors, 10 hiding alcoves, a counter with VCR and TV, an exit; three acts driven by tapes found; blackout as red emergency lighting; hiding and the Thing's search; unlimited rewinds with a caught counter; the win card. Settings for sensitivity, lens toggle, reduced effects, FPS counter.

Changes from the plan above:
- Tape locations are lens-only beacons, not written clues. The beacon is blue ("tape-blue") and shows only with the lens up, so finding tapes means looking.
- Two finales are playable and selectable on the title screen. **Hold:** hold E at the VCR for 20 s while your noise draws the Thing; progress drains at half speed when you let go. **Run:** the tape plays in 2 s, the lights die, the Thing hunts without stopping, run for the door.
- The Thing searches before giving up on a hidden player. Hide well (crouched, lens down, still) and it leaves. Lens up or moving while it searches gets you caught.
- Doors slow the Thing by 2 s instead of stopping it.

Not built yet: the TV replay reveal, the written clues, a second Thing behaviour, music.
