# Structure and naming

## Layout
```
src/sim/      pure deterministic simulation (state, step, TUNING, rng, grid, player, thing, lens, replay recording)
src/client/   Three.js rendering, Web Audio, input, UI. Produces inputs only
  render/     scenes, lens/world passes, VHS post-process
  audio/      synthesised sound palette, buses, mixer
  input/      pointer lock, keyboard, mouse
  ui/         diegetic HUD, title, death and end scenes, TV replay
tests/        property and unit tests, mirroring src/ paths
e2e/          Playwright (dev-only)
docs/         design.md, kiro-evidence.md, playtest-checklist.md
.kiro/        steering, specs, hooks
```

## Dependency direction
- `sim` imports nothing from `client`.
- `client` imports `sim` through `src/sim/index.ts` only.
- `tests` may import either.

## Naming
- Files: kebab-case (`notice-meter.ts`). Tests: `<name>.test.ts`; property tests `<name>.prop.test.ts`.
- Types and classes: PascalCase. Functions and variables: camelCase.
- Constants outside `TUNING`: SCREAMING_SNAKE_CASE.
- Units are suffixed in names: `Sec`, `Ms`, `Mps`, `M`, `Deg`, `PerSec`, `Hz`. Tick counts use `Ticks`.
- One exported concept per file where practical. No default exports.
