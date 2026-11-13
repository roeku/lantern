# Kiro evidence log

| Date | Kiro feature | What I asked | What it did | What I changed and why | Proof |
|---|---|---|---|---|---|
| 2026-11-11 | game-feel skill (audit) | Audit the v1 game, which felt abysmal, and rethink the concept for Kiroween. | Scored v1 at 4/18 from code alone (no audio, no feedback layers, top-down view). Proposed three first-person concepts. | Chose the camcorder concept ("it only exists on tape"). | `docs/design.md` |
| 2026-11-11 | Steering | Rewrite all steering for the new design and remove v1. | Replaced product, tech, structure steering and added `sim.md` and `feel.md` (file-match). | Decided on a 60 Hz tick and a static, server-free build. | `.kiro/steering/` |
| 2026-11-11 | Spec | Re-scope the task list. | Wrote `the-tape` tasks with a pass/fail Milestone 1. | | `.kiro/specs/the-tape/tasks.md` |
| 2026-11-11 | Playwright | Drive the game headless and screenshot title, lens down, lens up, rush. | Wrote `e2e/smoke.spec.ts`; screenshots confirmed the Thing is absent with the lens down and present, tearing, with it up. | Test pins the wandering Thing in the aisle, because it walked out of frame and made the first run flaky. | `e2e/smoke.spec.ts` |

## Property bugs caught
- **Level row one cell short** (level test `has rectangular rows`): a back-room row was 31 wide, which shifted a door. Caught the first time the test ran.
- **Wander into the alcove** (property `a still, crouched, lens-down player in an alcove is never caught by a rush`): shrunk counterexample `[seed 53266126, hide (27,12), act 2]`. After a search ended, the Thing picked the hiding cell itself as a patrol target and walked into the player. Fix: patrol cells exclude hiding spots, and a hidden player is only catchable by a rushing Thing.
- **Rush and search loop** (test `raising the lens while the Thing searches gets you caught`): a Thing that found you flipped straight back into searching and never closed in. Fix: only start a search when the player is well hidden, and end it the moment they are not.

## v1 history (before the pivot, kept for the write-up)
- Agent hook on save ran sim tests for `src/sim/`.
- Property test for snuff contact fixed without weakening its coverage asserts.
- Steering corrected for hosting (Cloudflare tunnel wording).
