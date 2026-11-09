---
inclusion: always
---

# Structure and naming

## Layout
```
src/sim/      pure deterministic simulation (state, step, TUNING, rng, smoke grid, slides)
src/client/   Three.js rendering, audio, input, UI. Produces inputs only
src/net/      shared wire protocol: message types, snapshot encode/decode
src/server/   Node WebSocket server running the sim
src/bots/     bot input generators (Spectator bots), shared by client and server
tests/        property and unit tests, mirroring src/ paths
docs/         design.md, kiro-evidence.md
.kiro/        steering, specs, hooks
```

## Dependency direction
- `sim` imports nothing from `client`, `net`, `server` or `bots`.
- `net` may import sim types only.
- `bots` may import `sim` only.
- `client` and `server` may import `sim`, `net` and `bots`. They never import each other.

## Naming
- Files: kebab-case (`smoke-grid.ts`). Tests: `<name>.test.ts`; property tests `<name>.prop.test.ts`.
- Types and classes: PascalCase. Functions and variables: camelCase.
- Constants outside `TUNING`: SCREAMING_SNAKE_CASE.
- Units are suffixed in names: `Sec`, `Ms`, `Mps`, `M`, `PerSec`. Tick counts use `Ticks`.
- Slides live one per file in `src/sim/slides/` and are registered in a single registry.
- One exported concept per file where practical. No default exports.
