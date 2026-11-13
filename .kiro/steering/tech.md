# Tech rules

## Stack
- TypeScript with `strict: true`. No `any` without a comment explaining why.
- Client: Vite and Three.js. pnpm only (never npm or yarn).
- Tests: Vitest + fast-check. Rules are covered by property-based tests.
- Playwright is a dev-only test tool (`e2e/`). It is never a runtime dependency.
- Audio is synthesised with the Web Audio API. No audio files, no audio libraries.

## Cost and hosting
- Everything runs for free. Never add a paid service, plan or API.
- There is no server. The game is a static build (`vite build`) deployed to a free static host. No WebSocket, no backend, no accounts.
- Solo play must work offline once loaded.

## Architecture
- `src/sim/` is a pure, deterministic simulation.
  - No DOM, no Three.js, no Web Audio, no `Math.random`, no `Date.now`, no `performance.now`. Seeded RNG only.
  - Fixed 60 Hz tick (`TUNING.tickHz`). `step(state, input)` returns the next state and never mutates its arguments.
  - Every tuning number lives in one exported `TUNING` object. Names carry the unit: `lensFovDeg`, `batteryLifeSec`, `rushSpeedMps`.
  - State is plain serializable data. No classes with hidden state, no functions, no Map or Set in state.
- `src/client/` renders and plays sound from sim state. It never changes game state. It only produces inputs.
  - Camera yaw and pitch are applied at render rate for feel. The sim receives the yaw and pitch for each tick as part of its input.
  - Render interpolates between the previous and current sim state.
- The replay is recorded seed + per-tick inputs. Re-running the sim must reproduce the final state exactly.
- The client imports the sim through its public entry point (`src/sim/index.ts`) only.
- Client-only presentation numbers (shake, bob, mix levels, ease times) live in one exported `FEEL` object in `src/client/feel.ts`, with unit-suffixed names. The sim never imports it.
