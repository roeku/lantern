# Rewind Night (working title)

A first-person horror game for Kiroween 2026. You are alone in a video rental shop after closing with a camcorder. Something is in the shop with you, and it only exists on tape. Looking through the lens is the only way to see it, and it is also what gets you caught.

The design is in `docs/design.md`. Title, setting and text are placeholders.

## Requirements
- Node.js and pnpm

```
pnpm install
```

## Run
```
pnpm dev
```
Open `http://localhost:5173`. Click to lock the pointer. Headphones recommended.

## How to play
Find the 3 tapes, play them at the counter, get out. The Thing only exists on tape, and looking through the lens is what gets you caught.

| Input | Action |
|---|---|
| WASD | Move |
| Shift | Run (not with the lens up) |
| C | Crouch. Crouch in a marked alcove with the lens down to hide |
| Right mouse or Q | Lens (hold, or toggle in settings) |
| E | Take a tape, open or close a door, hold at the counter to play the tapes |
| R | Restart the night (when paused or on the end card) |
| Esc | Pause and open settings |

Settings are on the pause screen: sensitivity, lens hold or toggle, reduced effects, FPS counter and the finale. Two-finger click is right mouse on a trackpad.

## Scripts
| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm build` | Typecheck and static build into `dist/` |
| `pnpm test` | Vitest, including fast-check property tests |
| `pnpm e2e` | Playwright (dev-only) |

## Kiro
Specs, steering and hooks are in `.kiro/`. The evidence log is `docs/kiro-evidence.md`.
