---
inclusion: always
---

# Tech rules

## Stack
- TypeScript with `strict: true`. No `any` without a comment explaining why.
- Client dependencies: Vite and Three.js. pnpm (never npm or yarn).
- Tests: Vitest + fast-check. Rules are covered by property-based tests.
- Playwright is a dev-only test tool (`e2e/`). It is never a runtime dependency.

## Cost
- Everything runs for free. Never add a paid service, plan or API.

## Multiplayer server
- Node, self-hosted on the author's M1 Mac, reached through a free tunnel (Cloudflare Tunnel or Tailscale Funnel).
- WebSockets only, using `ws` on plain Node, behind the `Transport` interface. Add no other WebSocket library.
- The slice serves the client from Vite behind one tunnel. The static-host deploy (static build, M1 serves only the WebSocket server) is later work.

## Architecture
- `src/sim/` is a pure, deterministic simulation.
  - No DOM, no Three.js, no `Math.random`, no `Date.now`. Seeded RNG only.
  - Fixed 20 Hz tick. `step(state, inputs)` returns the next state.
  - Every tuning number lives in one exported `TUNING` object. Names carry the unit:
    `puffDensity`, `smokeDecayPerSec`, `cartRushSpeedMps`.
- `src/client/` renders and plays sound from sim state.
  - It never changes game state. It only produces inputs.
- `src/server/` runs the same sim.
- Solo matches against bots run the same sim in the browser, with no server.
  Solo play must never depend on the multiplayer server being up.
- The 1 m smoke grid is the single source of truth for gameplay, rendering and network sync.
  Smoke particles are decoration only and never feed back into state.
- Sim, client and server import the sim through its public entry point only.
