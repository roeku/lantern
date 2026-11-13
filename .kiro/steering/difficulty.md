---
inclusion: always
---

# Difficulty rules

Set by the author after the chamber 4 playtest: one clip doing three jobs was already too much. These apply to every room, in every tape, and to anything written that adds or changes a room.

## Rules
- A clip has **at most 2 jobs** until the final tape. A job is one thing the tape-self must do (hold a plate, be the bait, get somewhere first).
- **Each room adds one new idea.** If a room needs two, split it.
- **Breather rooms are breathers**: no hard puzzle, and the Thing is absent or only follows unseen.
- Develop an idea in the order: introduce it in safety, develop it, twist it with the Thing, combine it with what came before.
- A stranger must be able to **read the solution from the room**: the plate, the wire and the gate in view, the cause shown when you fail.
- **After 2 catches in a room**, the guide offers a hint. **After 3 restarts**, the narrator offers the instruction tape (a ghost of the solution).
- Never catch a player who is standing still and silent at an entrance. The Thing keeps its distance from the entry for the first seconds, and does not walk into a silent, motionless player.
- Fairness warnings must not depend on sound or on the lens: the nearest tube stutters when the Thing is near.
- A gate must stay open long enough to walk through it from the plate that opens it, without sprinting.

## Checks
- Every room has a solution script in `tests/sim/` that passes, and a check that it fails without the tool it teaches.
- Every room is **walked** before it counts as done, and the report says who walked it.
- No soft-locks: from any reachable state either the exit can be reached or R recovers.
