# Lantern

A 1 vs. 3 browser game. One Showman projects ghosts through smoke from a cart. Three Spectators carry candles through a dark hall and try to cut three ropes. This repo holds the playable vertical slice. The design lives in `docs/design.md`.

## Requirements

- Node.js and pnpm
- `cloudflared` (only to play with friends over the internet)

```
pnpm install
```

## Run locally

```
pnpm dev
```

This starts the game server and the Vite dev server together and prints the local client URL.

| Part | Default port | Notes |
|---|---|---|
| Client (Vite) | 5173 | Open `http://localhost:5173` |
| Server | 2568 | Set `PORT` to change it, for example `PORT=3000 pnpm dev` |

Vite proxies `/r/<CODE>` (WebSocket) and `/log/<CODE>` (HTTP) to the server, so one port serves the page and the game. If the server port is already in use, `pnpm dev` exits and names the port.

## Play solo

Open the client and press **Play solo**. You play the Showman against three bots. The sim runs in the browser and opens no WebSocket, so the server is not needed.

## Play with friends (Join_Link)

1. Run `pnpm dev` in one terminal.
2. In a second terminal run the one tunnel command: `pnpm tunnel`. It runs `cloudflared tunnel --url http://localhost:5173` and prints a `https://<name>.trycloudflare.com` address.
3. Open that address in your browser and create a room. You land on `/r/<CODE>` and become the Showman.
4. In the lobby, press the copy control to copy the Join_Link (`https://<name>.trycloudflare.com/r/<CODE>`) and send it to your friends.
5. Each friend opens the link and takes the next free seat as a Spectator. Open seats are filled by bots.
6. The Showman presses start. After the show, press play again to rematch. The Showman role rotates to the next human.

Quick tunnels get a new address each time. If the page is blocked with an unknown host error, add the tunnel host to `server.allowedHosts` in `vite.config.ts`.

## Controls

- Showman: W/S roll the cart, Shift rush, 1/2/3 puff vents, mouse aims the beam.
- Spectator: W/A/S/D move, Space shield or unshield, left mouse fan, E cut a rope.

## Tests

```
pnpm test        # vitest, unit and property tests (runs once)
pnpm typecheck   # tsc --noEmit
pnpm e2e         # Playwright, two browser pages on one Join_Link
```

`pnpm e2e` needs browsers installed once: `pnpm exec playwright install chromium`. A failing property test prints its seed and shrunk counterexample.

## Playtesting

Use `docs/playtest-checklist.md` to run and record the Milestone 1 test.
