# [Working title TBD]: design v1

*Kiroween 2026 · Resurrection category · 8 November 2026.*
*Placeholders are marked ⟨…⟩ and are the author's to replace.*

## Pitch
One friend runs an 18th-century ghost show of the kind Robertson made famous in Paris in 1798. The other players sit in a locked, pitch-dark hall with one candle each. To win, they must cut the ropes holding up the projection screen before the show ends. When the last rope goes, the screen falls and the trick is exposed.

**History vs. invention:** phantasmagoria shows projected ghosts onto smoke and screens. Robertson used a lantern on wheels so the images could grow and shrink. A projection that can snuff your candle is this game's invention.

## The rule that makes it new
**The monster is a projection.** A ghost is solid only where the lantern's beam meets enough smoke. Clear the smoke and the ghost disappears. A larger projection is dimmer, so it needs denser smoke to become solid. Bigger means more reach but more smoke, which follows how real projected light behaves.

## Roles (MVP: 1 Showman vs. 3 Spectators; bots fill empty seats)
| | Showman | Spectators |
|---|---|---|
| Sees | Only what the beam lights, plus any lit candle | Their own candle radius, solid ghosts and smoke |
| Verbs | Aim the beam · roll the cart (grow or shrink the ghost) · puff smoke from one of 3 vents · swap slides | Move · light or shield the candle · **fan** (clear smoke briefly) · cut a rope (needs a lit candle) |
| Wins | Snuffs every candle, or the show ends with any rope still standing | All 3 ropes cut before the show ends |
| Tension | More smoke gives stronger ghosts but blocks the Showman's view | A lit candle lets you find knots but shows you to the Showman |

**Snuffed players stay on the audience side.** They can ping the cart's position once every ⟨15⟩ s. Switching snuffed players to the Showman's side is a later playtest experiment.

**Slides (MVP: 2, each with a clearly different use):**
- ⟨The Wraith⟩: large, slow and lingering. It blocks off an area, and it drifts toward the nearest lit candle inside the beam.
- ⟨The Skull⟩: small and fast. It lunges along the beam when the cart rushes.

**The cart's sound:** the rumble grows louder with cart speed. A rush is the most frightening move, but everyone hears it coming.

## One source of truth
- **Smoke:** a 1 m floor grid stores smoke density per cell. Gameplay, rendering and network sync all read from this grid. The smoke particles players see are only decoration.
- **Ghost position:** the ghost appears at the first grid cell along the beam where density is at or above the solidity threshold.
- **Server:** the server is authoritative and sends snapshots at 20 Hz. It records state at 10 Hz for the replay.

## Round shape and aftermath
A show lasts ⟨5⟩ minutes in three acts. Each act unlocks more smoke, and act 2 unlocks the second slide. The show ends when the screen falls or the convent bell tolls.

Then the house lights come up and a **match replay** plays from above. It shows:
- the cart's route and the beam's sweeps
- each snuff
- near misses: a ghost within 1 m that didn't snuff
- the last rope

A still image of the replay is the share card.

## Feel Brief (game-feel Step 0)
1. **Verbs:** aim, roll, puff / creep, shield, fan, cut.
2. **Feeling:** ⟨the giddy panic of hiding in the dark with friends while one of them hunts you with light⟩.
3. **Tension:** the Spectators' light against their safety, and the Showman's smoke against their own sight.
4. **The one detail no other game has:** a ghost made only of light meeting smoke.
5. **References:**
   - Borrow Dead by Daylight's principle that objectives force survivors out of hiding.
   - Borrow Meccha Chameleon's reveal moment.
   - It should *not* feel like a jump-scare corridor.
6. **Tone and materials:** theatrical dread with comedy. Wax, smoke, painted glass, brass and stone.
7. **Look:**
   - Palette: near-black, candle amber, cold blue-white beam, an oxblood accent.
   - Lit 3D scenes, modelled in Blender and rendered in Three.js.
8. **Input:** keyboard and mouse on a laptop, with friends already on a voice call.
9. **Events that need the most weight:**
   - candle snuffed (six or more feedback layers)
   - ghost rush
   - rope cut
   - screen falls
   - house lights up
10. **Sounds:**
    - glass armonica, in one key
    - cart rumble
    - wick hiss
    - coat swish
    - rope creak and snap
    - thunder sheet
    - bellows
    - convent bell
    - the screen's crash
11. **Shape of a show:** three acts building tension, then the lights come up on an ordinary room. Players watch the replay together and argue about what happened.
12. **What a player should tell a friend afterwards:** ⟨"I cut the last rope with two seconds left and the screen came down on him."⟩

## Starting tuning values (all in one settings block, all to be tuned in playtests)
| Setting | Start | Setting | Start |
|---|---|---|---|
| Show length | 300 s | Room size | 16 × 12 m |
| Puff | +0.6 density in a 2 m radius | Smoke decay | 0.05 per s |
| Smoke spread | 0.2 per s | Solidity threshold at base size | 0.5 (scales with image size squared) |
| Cart travel | 0–8 m | Cart speed: roll / rush | 1 / 4 m/s |
| Fan | clears a 2 m radius for 3 s | Fan cooldown | 8 s |
| Rope cut | hold 4 s, within 1 m, candle lit | Shielded candle vision | 1 m radius |
| Lit candle radius | 3 m | Snuff touch radius | 0.6 m × image scale |

## Scope
**In for the hackathon:**
- one room
- 1 Showman vs. 3 Spectators
- 2 slides
- 3 ropes
- Spectator bots, so a solo judge can play the Showman
- join by link
- the replay

**Stretch:** a Showman bot, so a solo judge can also play a Spectator.

**Out for now:**
- in-game voice
- more players
- more rooms or slides
- a Steam build, which comes in December for Next Fest; registration closes January 10, 2027

## Milestone 1 (by about 14 Nov): pass/fail test
A grey-box room where two people can project, evade, fan smoke and snuff a candle.
- **Pass:** after three rounds, both players can say *why* they lost and ask to swap roles.
- **Fail:** fix the rules before doing any art.

## Plan
| Week | Dates | Work |
|---|---|---|
| 1 | Nov 8–14 | Smoke grid, beam and solidity, cart, fan, candle; network test with two clients; Milestone 1 |
| 2 | Nov 15–21 | Ropes, 1 vs. 3, Spectator bots, rooms joined by link, three-act structure |
| 3 | Nov 22–28 | Replay, chapel art, sound and feel pass; real group playtests that produce footage and player counts |
| 4 | Nov 29 – Dec 4 | Feature freeze, video, Kiro write-up, deploy, **submit by Dec 3** |

## Kiro plan (aim for real evidence, not counts)
- **Specs:** smoke and projection rules · round and network state · bots and replay.
- **Steering:** product scope · feel rules (from this brief) · netcode rules.
- **Hooks:** adding a slide spec wires it into the registry, tests and docs. Any change to the rules files runs the property-based tests.
- **Property-based tests:**
  - Clearing a cell removes the threat there.
  - A ghost is solid exactly when its beam cell's density is at or above the scaled threshold.
  - A duplicate snuff event counts once.
  - Every client agrees on when the round ends.
  - The replay reproduces the final state.
- **MCP:** Blender MCP for the chapel. Playwright for tests with several clients.
- **Evidence log** in `docs/kiro-evidence.md`, written as you go. It should include at least one real bug a property caught.

## Money (after the build is proven)
1. **Free browser version, join by link:** the hackathon URL and the thing people share.
2. **itch.io:** from launch.
3. **Steam page:** up by late November to collect wishlists.
4. **Desktop demo for Next Fest:** Feb 22 – Mar 1, 2027.
5. **Paid launch at about $5.99:** spring or summer 2027. The paid version adds rooms and slides; the free version keeps one room and one show.
6. **Discord Activity:** only if you're eligible, because payouts are limited to US, UK and EU teams.

## Open questions (the author decides)
- **Title:** *Fantasmagorie* and *Phantasmagoria* are both taken. Placeholders: ⟨The Lanternist⟩, ⟨Smoke & Glass⟩, ⟨Capucines⟩. Search Steam before committing.
- **Feeling:** confirm the feeling and closing line, or replace them with your own.
- **Art direction:** how historical versus how stylised?
- **Networking:** Cloudflare Durable Objects / PartyKit or Colyseus? Decide on day 2, after the network test.
