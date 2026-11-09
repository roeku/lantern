---
inclusion: fileMatch
fileMatchPattern: "src/sim/**"
---

# Sim rules

## Projection rule
- A ghost is solid only where the beam meets enough smoke.
- The ghost appears at the first grid cell along the beam where density >= scaled solidity threshold.
- Scaled threshold = `solidityThresholdBase * imageScale^2`. Bigger image means dimmer, so it needs denser smoke.
- If no cell along the beam reaches the threshold, there is no ghost and no threat.
- Clearing a cell removes the threat there.
- Snuff touch radius = `snuffRadiusBaseM * imageScale`, applied only to a solid ghost.

## Smoke grid
- 1 m cells over the 16 x 12 m room. Density per cell, clamped to a valid range.
- The grid is the only smoke state. Gameplay, rendering and sync all read it.
- Puff adds density in a radius from one of 3 vents. Spread diffuses between neighbours. Decay is per second.
- Fan clears a radius for a duration, then goes on cooldown.
- Update the grid in a fixed cell order so results do not depend on iteration quirks.
- Convert per-second rates to per-tick using the tick length. Never use frame time.

## Determinism
- No `Math.random`, `Date.now`, `performance.now`, timers or DOM/Three.js imports.
- All randomness comes from a seeded RNG stored in the state.
- `step(state, inputs)` does not mutate its arguments. Same state and inputs give the same output.
- Inputs are applied in a stable order (by player id).
- State is plain serializable data: no classes with hidden state, no functions, no Map/Set in snapshots.
- Every tuning number comes from `TUNING`. No magic numbers in rule code.
- Round end is decided by tick count only, so every client agrees.

## Properties to keep tested (fast-check)
- Clearing a cell removes the threat there.
- Ghost is solid exactly when its beam cell density >= scaled threshold.
- A duplicate snuff event counts once.
- Every client agrees on when the round ends.
- The replay reproduces the final state.
