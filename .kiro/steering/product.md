# Product rules

Source of truth: `docs/design.md`. If this file and the design disagree, fix the one that is wrong and say so.

## What the game is
First-person, solo, a campaign of 20 to 25 minutes (see Scope). The player is alone in a video rental shop after closing, holding a camcorder. A Thing is in the shop and it exists only on tape. The viewfinder is the player's sight, clue reader and danger all at once.

## Core rule
- Lens down: the player sees a dim, empty shop and hears the Thing. The Thing is not visible.
- Lens up: the Thing is visible (if in the cone, in line of sight, battery above 0). The view narrows, the battery drains, the REC light shows the player's position to the Thing.
- The Thing's notice meter fills while the player's lens cone is on it. When it fills, the Thing rushes.
- Nothing else in the game may let the player see the Thing without the lens, except the end replay.

## Roles and verbs
Player verbs: raise or lower the lens, move, sprint (loud), crouch, hide, interact (take a tape, play a tape), shut a door.
The Thing: wander, stalk noise, notice, rush, give up. It never cheats vision: it notices through the same cone, line-of-sight and noise rules the player can learn.

## Show shape (v3: the first two tapes; v4 grows this into the campaign)
- One night, three acts, about 6 minutes. Act 1 Closing (slow Thing, find tape 1). Act 2 Rain (stalks sound, first chase, tape 2). Act 3 Blackout (rushes more, lights fail, hold at the VCR to play the last tape).
- Death is a rewind: back to the last checkpoint in under 0.5 s on the same key. Found tapes stay found.
- Aftermath: lights up, silence, then the camcorder footage plays back on a TV with the Thing always visible. A still frame is the share card.

## Fairness
- The player can always learn why they were caught: the rewind shows the cause.
- A checkpoint respawn is never within reach of a rush.
- Running in a straight line never beats a rush. Hiding spots and doors do.

## Scope (v5, set by the author)
In: a hub and four tapes, each a different kind of VHS recording in or around the same store, for a first playthrough of 20 to 25 minutes; a fifth tape only if its gate passes. Tools: record, then pause, reverse and a second deck, one tape each. One Thing whose behaviour escalates from tape to tape. The reveal ending (the Thing was there all along) and the dailies replay. Ranks, ONE TAKE and a ghost of your best run. Accessibility (reduce flicker, subtitles for key sounds), a low-quality preset, an adaptive score, a campaign save in localStorage, a static deploy.
The plan, gates and cut list live in `docs/design.md` ("v5"). If this file and the design disagree, fix the one that is wrong and say so.
Out (do not build): tapes 6 to 8, fast-forward, dub, gamepad, dynamic resolution, a director's cut, separate monster types, multiplayer, servers, accounts, in-game voice acting, a Steam build, any paid service, plan or API.

## Placeholders
The title, setting, feeling line and closing line in the design are placeholders owned by the author. Do not invent new story, names or lore. Ask or mark a placeholder.
