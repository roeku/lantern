# ⟨Rewind Night⟩: design v5

*Kiroween 2026 · Resurrection (dead tech: VHS) with a Costume Contest angle · 11 November 2026.*
*Placeholders are marked ⟨…⟩ and are the author's to replace: title, setting, names, any text. The v1 design (top-down, 1 vs 3) and its code were removed on 11 Nov; a backup tarball lives outside the repo.*

*v5: read "v5: depth, dread and finish" first. It replaces the v4 campaign proposal. v3 below is the raw material for tape 1.*

*v3 (11 Nov, evening): the open shop with three tapes felt like a demo. The night is now a run of test chambers built on one tool, record and echo. The section "v3: the tape" below is the current design; where it disagrees with the older sections, v3 wins.*

## v5: depth, dread and finish (current plan, set by the author)

*The author rejected v4 ("more of everything") after playtesting: one clip doing three jobs was already too much. v5 is bigger in depth, dread and finish, not in counts. A first playthrough of 20 to 25 minutes (about four times today), every minute at a finished standard, with replay value on top. v3's five chambers become the raw material for tape 1.*

### What the build tells us (12 / 18 on the feel audit)
Protect: the Thing that only shows on the lens (raising the viewfinder and finding it already close is the best moment in the game); the tape-self as bait, which the Thing tears instead of you (the best mechanic, so the campaign is built around it, not around buttons); the footprints while recording and playing; "BE KIND. REWIND." and the SIGNAL LOST glitch; the viewfinder as the HUD; the end card that draws your route, your tape-selves and the Thing; instant R restart; the buffered record press; the start click doing nothing else; the TUNING block; the fixed-step sim.

### Order of work: reveal first, video from day one
The reveal ("it was standing behind you the whole time") was deferred three times (task 5, "still missing", then M3.4). It is the one thing a player would tell a friend about and the shot that ends the video. It is built in M1, not M3. The video and the Kiro write-up are 40% of the score and are planned and fed from the first gate, not the last three days.

### How we are judged (official rules)
- Deadline **Fri 4 Dec 2026, 2:00 pm Pacific**, no extensions. Submit on 3 Dec. Content freezes at noon on Tue 1 Dec.
- Five criteria, 20% each: Potential Impact, Technological Implementation (how thoroughly and skillfully we use **Kiro**), Design, Innovation, Presentation (the video, under 3 minutes). Best Demo is a separate bonus.
- "Judges are not required to test the Project": most will see 3 minutes of video and 5 to 10 minutes of play. The first 10 minutes carry the game.
- Judging may use automated AI analysis, so the repo, README and `.kiro/` are read: keep them clean and accurate.
- Required: a public GitHub repo with an open-source license in the About section, `/.kiro` at the root and not gitignored, a working URL, a public YouTube video, the Kiro write-up.
- Category: **Resurrection**, bring dead technology back to life. A VCR is dead tech. The pitch and the video are built around that.

### Feel Brief, v5
1. **Verbs:** record, rewind, hold a plate with your tape-self, look through the lens, hide, lure. Later: pause, reverse, a second deck.
2. **Feeling:** ⟨"I outsmarted the thing that hunts me using only my own past."⟩
3. **Essence:** it hears everything and can only be seen through the lens; you can be in two places if you plan. The decision is when to send your past self, and whether to look.
4. **The specific thing:** the monster is only on the lens, your tape-selves are only off it, and the reveal shows it was there all along. Not unique: record-and-replay puzzles, time reversal (Braid) and camera-rewind horror (TAPE: Unveil the Memories) exist. Ours is the combination, and the reveal.
5. **References, for principles:** Portal (one tool, a voice that teaches, every room a question); Superhot (the replay as the reward); Inscryption (the game lives inside a frame object).
6. **Tone:** dry wit over quiet dread. See `.kiro/steering/tone.md`.
7. **Look:** one art kit. The VHS palette is the spine; each tape gets its own post-processing look.
8. **Session shape:** a hub and four tapes (a fifth only if its gate passes), 20 to 25 minutes. After every tape you walk back into the store, the lights come up, and something in the store has changed. The hub is part of the horror, not a menu.
9. **Closing test:** ⟨"It was standing behind me the whole time, and I sent my past self to hold the tape so I could get out."⟩

### Frame: a VHS formats anthology ⟨names are the author's⟩
Each tape is a different kind of VHS recording, all in or around the same store. One art kit, a different post-processing look per tape. It stays horror, stays VHS, and sells "Resurrection".
| Tape | Recording type | Look | Teaches |
|---|---|---|---|
| 1 | Corporate training video | bright, cheerful, wrong; the narrator | REC and the tape-self (today's chambers 1 to 5, recut) |
| 2 | Home movie | warm, handheld, a party that does not end | PAUSE |
| 3 | Security tape | grey CCTV, a quad split | REVERSE, scouting |
| 4 | Late-night broadcast | static, snow, one tall window | SECOND DECK, and it learns your tapes |
| 5 | (only if gate 2 was clean) | ⟨the author decides⟩ | everything |
Starship and Heist are out. The story, the Thing's nature, the voice lines and the tape names are the author's; I keep proposing options and marking placeholders.

### Tools: keep three, each gets one tape
PAUSE, REVERSE, SECOND DECK, in that order. Each: introduce it in safety, develop it, twist it with the Thing, combine it with what came before. **Cut:** fast-forward (a timing knob, not an idea), dub (overlaps the second deck, hard to read), gamepad, dynamic resolution, the director's cut, tapes 6 to 8, the extra monster types as separate monsters.
Every new tape gets a twist on the Thing and tape-self pair, not just a button. The author picks which: decoy tapes (lure it with a noisy tape-self, then sneak past); scouting (the lens or a playback shows where it was); it learns your tapes (in the last tape it walks your recorded routes). **One Thing that escalates**, with behaviours that change from tape to tape (the Blind Listener and the Static become behaviours of the same Thing).

### Tracking error: what a replayed tape-self does when its path is blocked
Under state replay a tape-self no longer collides. Decision: if its next recorded position is inside a wall or a shut gate, it **freezes and flickers in place** (a tracking error) for as long as it is blocked, then resumes. If the Thing tears it, it is gone as today. This is readable, fair and on theme: a rule players can learn and exploit, not a bug.

### The instruction tape
After 3 restarts in a room the narrator offers the instruction tape: a ghost of the solution plays. It fits the fiction and guarantees judges reach the reveal. The ghost is built from the room's solution script, recorded as inputs, so it is always correct.

### The bar for "done"
Nothing is done until it clears all of these:
1. **Walked.** Someone played the room on the deployed URL, and the report says who: the author, a bot or a script.
2. **Every weighted event has layers**, sound first, pitch varying between repeats: record, play, rewind, plate press, gate open, the Thing noticing you, being caught, tape end, the reveal.
3. **R restarts in under 0.5 s** and shows what caught you.
4. **Teaching by situation.** Guide text is a few words that fade once the player does the thing on purpose. All-caps sentences are a smell.
5. **Every screen looks like a shipped game**: title, hub, pause, caught, tape end, reveal.
6. **No placeholder text in a build the author plays**, unless it is on a list the author has seen (`docs/placeholders.md`).

### Schedule and credit gates
At each gate the author reads the credit balance from Kiro and tells me; I cannot see it. If a phase overspends by more than 25%, we cut a tape, never the polish.
| Phase | Dates | Contents | Gate | Credits |
|---|---|---|---|---|
| Lockdown | Fri 13 to Sun 15 Nov | Commit on a branch; public repo with a license and `.kiro/`; static deploy; solution scripts for all five chambers in CI; the five fixes; a 3-minute shot list; steering docs | The author plays it from the URL and a stranger finishes it without help | 5% |
| M1 Spine | Mon 16 to Fri 20 Nov | State replay with pause and reverse; data-driven levels; a minimal hub; **the reveal ending, built and working**; tape 1 recut | The author plays tape 1 through to the reveal on the URL | 30% |
| M2 Dread | Sat 21 to Thu 26 Nov | Tapes 2 and 3 (adding the second deck); Thing behaviour v2; sound and adaptive music v1; a look per tape; the instruction tape; the aftermath | Two people who have never seen the game reach the reveal without help; note where each got stuck | 30% |
| M3 Finish | Fri 27 Nov to Tue 1 Dec | Tape 4, tape 5 only if gate 2 was clean; ranks, ONE TAKE, the ghost; accessibility (reduce flicker, subtitles for key sounds); a low-quality preset; a feel audit and its top 5 | Content freeze at noon on Tue 1 Dec | 20% |
| Ship | Tue 1 to Thu 3 Dec | Video, write-up, README, submit | Submitted 3 Dec | 5% |
| Reserve | | | | 10% |

### Using Kiro on purpose (Technological Implementation, 20%)
`docs/kiro-evidence.md` is written as we go, with dates and real examples.
- **Specs:** one tape's full path from requirements to design to tasks to code.
- **Steering:** `tone.md`, `difficulty.md`, `feel.md` and the TUNING conventions; note where steering changed the output.
- **Hooks:** saving a level file runs its solution script and the "fails without the tool" check; completing a task appends to the evidence log; a commit is blocked on placeholder text that is not on the list.
- **Property-based tests:** reverse of reverse is forward; replay is deterministic; **no soft-locks**: from any reachable state either the exit can be reached or R recovers (this would have caught the old chamber 4 trap).
- **MCP:** a browser or Playwright MCP to screenshot every tape for the feel audit and to record b-roll for the video.
- **A custom "playtester" agent:** runs the solution scripts, reports par times and jobs per clip.
- **Powers, and IDE versus CLI:** try at least one of each and write down how they compare. The rules ask for experimentation.

### The video, planned now (under 3 minutes, shown working end-to-end)
Footage is collected at every gate. Shot list: `docs/video-shot-list.md`.

### Verification rules (added after the author caught gaps)
- "The tests pass" does not make a room done. A person walks it.
- The e2e bot must cover every chamber, not 2 of 5. Anything I change gets walked or is reported as not walked.
- I describe the levels from the level file, not from memory.

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
