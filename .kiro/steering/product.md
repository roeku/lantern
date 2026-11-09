---
inclusion: always
---

# Product rules

## Roles (MVP: 1 Showman vs 3 Spectators; bots fill empty seats)
- Showman verbs: aim beam, roll cart (grow/shrink ghost), puff smoke from one of 3 vents, swap slides.
- Showman sees only what the beam lights, plus any lit candle.
- Spectator verbs: move, light/shield candle, fan (clear smoke briefly), cut rope (needs lit candle).
- Spectators see their own candle radius, solid ghosts and smoke.
- Snuffed Spectators stay on the audience side. They may ping the cart position once per pingCooldownSec.

## Win conditions
- Showman wins: every candle snuffed, OR the show ends with any rope still standing.
- Spectators win: all 3 ropes cut before the show ends.
- The show ends when the screen falls (last rope cut) or the convent bell tolls (time up).
- A duplicate snuff event counts once.

## Slides (MVP: exactly 2, clearly different uses)
- Wraith: large, slow, lingering. Blocks an area. Drifts toward the nearest lit candle inside the beam.
- Skull: small, fast. Lunges along the beam when the cart rushes.
- Slide 2 unlocks in act 2. New slides must be added through the slide registry.

## Show shape
- One show = three acts. Each act unlocks more smoke.
- After the show: house lights up, then a top-down match replay.
- Replay shows cart route, beam sweeps, each snuff, near misses (ghost within 1 m that did not snuff), last rope.
- A still frame of the replay is the share card.

## MVP scope
In:
- One room, 1 Showman vs 3 Spectators, 2 slides, 3 ropes.
- Spectator bots so a solo player can be the Showman.
- Join by link.
- The replay.

Stretch: Showman bot (so a solo player can be a Spectator).

Out (do not build):
- In-game voice.
- More players, rooms or slides.
- Steam build.
- Switching snuffed players to the Showman side (later playtest experiment).
- Any paid service, plan or API.
