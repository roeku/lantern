# Network spike report: Colyseus vs plain `ws`

Machine: Apple M1, Node 22.23, pnpm 12.18 (via corepack). Everything below is free. Throwaway code, plain `.mjs`, only under `spikes/net/`.

## How to run

```
# Prototype A: Colyseus (port 2567)
cd spikes/net/colyseus && corepack pnpm install && corepack pnpm start
# Prototype B: ws (port 2568)
cd spikes/net/ws && corepack pnpm install && corepack pnpm start
# Load test: 4 clients, 60 s, with a mid-run drop and reconnect of client 0
cd spikes/net && node load-test.mjs --proto ws --url ws://localhost:2568 --secs 60 --drop
cd spikes/net && node load-test.mjs --proto colyseus --url ws://localhost:2567 --secs 60 --drop
# Tunnel (no account): ./bin/cloudflared tunnel --url http://localhost:<port>, then use the wss:// URL
```

`cloudflared` was downloaded from the official GitHub release into `spikes/net/bin/` (git-ignored). `brew install` failed inside this sandbox.
Raw outputs: `spikes/net/results/`.

## Shared pieces (same in both)

`shared/sim.mjs`: 20 Hz deterministic room, one dot per seat, seeded bots. `shared/state-log.mjs`: 10 Hz log, `GET /log/ABCD`, JSONL file on room end. `GET /stats` returns process CPU and RSS. First human to join gets seat 0 (Showman). Empty seats are bots. A human who leaves frees the seat for a bot.

## Results (4 clients, 1 room, 60 s)

| | ws | Colyseus |
|---|---|---|
| Snapshots/s per client, localhost | 19.5 to 19.7 | 19.5 to 19.7 |
| Snapshots/s per client, tunnel | 19.5 to 19.75 | 19.35 to 19.75 |
| Download per client | 1.43 KB/s (JSON) | 0.55 KB/s (binary schema patches) |
| Upload per room (4 clients) | about 5.8 KB/s (46 kbit/s) | about 2.2 KB/s (18 kbit/s) |
| RTT localhost p50 / p95 | 0.3 / 1.0 ms | 0.3 / 1.1 ms |
| RTT tunnel p50 / p95 | 116 to 130 / 181 to 200 ms | 118 to 125 / 183 to 191 ms |
| All sockets open 60 s (local and tunnel) | yes | yes |
| Reconnect gap, local / tunnel | 0.53 s / 1.0 s | 0.51 s / 1.25 s |
| Server CPU, 1 room | 0.8% of a core | 1.0% |
| Server RSS, 1 room | 62 MB | 62 to 66 MB |
| 20 rooms (80 clients) CPU / RSS | 4.0% / 60 MB | 5.2% / 72 to 77 MB |
| Dependencies installed | 1 package, 208 KB | 61 packages, 22 MB |
| Server lines (own code) | 93 | 82 |

Notes:
- Both pass the bar of at least 19 snapshots/s for 60 s, local and through the tunnel. The server loop uses `setInterval`, which drifts to about 19.65 Hz. Fixed-step catch-up is needed in the real server.
- The ws payload is JSON, so its bandwidth is not a fair floor. A binary or delta encoding in `src/net/` would close the gap. The real payload will include the 16 x 12 smoke grid (192 cells), so delta encoding matters either way.
- Tunnel RTT is mostly the path to the Cloudflare edge and back. It is the same for both. Expect it to vary with the player's location.
- CPU and RSS are the server process only. The load clients ran on the same machine, which adds load, so real headroom is a little better.
- Capacity: about 0.2 to 0.26% of one core per room, so CPU is not the limit (hundreds of rooms). Upload is: 100 rooms of ws JSON would be about 4.6 Mbit/s, Colyseus about 1.8 Mbit/s. Home upload and tunnel limits will bind first. Real sim and replay recording will add CPU. This test only measured the toy sim.
- Only one tunnel session per server was tested. Quick tunnels have no uptime promise and no stable URL. Use a named tunnel (free, needs a Cloudflare account) or Tailscale Funnel for a stable join link.

## Qualitative comparison

| Topic | ws | Colyseus |
|---|---|---|
| Setup | `pnpm add ws`. Nothing else. | Needed `@colyseus/core` + `ws-transport` + `schema` + `colyseus.js`. The `colyseus` meta package was blocked by pnpm 12 (`blockExoticSubdeps`: a git-hosted uWebSockets.js subdependency). `msgpackr-extract` build script is ignored (optional). |
| Room by code in URL | Native: `/r/ABCD` upgrade path | No path routing. Matchmaking HTTP call with `filterBy(["code"])`. Join by link still works (the page reads the code and calls `joinOrCreate`). |
| Bots | Shared sim, seat flag | Same |
| State log | Shared module, HTTP route | Same, plus the HTTP server needs hand-wiring next to the matchmaker |
| Reconnect | Hand-written: seat token + 10 s grace (about 15 lines) | Built in: `allowReconnection(client, 10)` and `client.reconnect(token)` |
| Snapshots | Hand-written (full snapshot each tick) | Built-in schema diffing at `patchRate` 50 ms |
| Gotchas hit | None | Early `send` before the client registers a handler is dropped. Default `maxPayload` 4 KB. Browser-style close codes in the Node client. |
| Fit with project rules | Sim stays pure and owns its snapshot format in `src/net/`. Transport can sit behind a small interface. | State must be mirrored into Schema classes. That is a second source of truth next to the smoke grid. |

## Keeping it running (not executed here, written from standard behaviour)

launchd (no extra install; restarts after a crash and after login or reboot). Save as `~/Library/LaunchAgents/com.lantern.server.plist`:

```
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.lantern.server</string>
  <key>ProgramArguments</key><array><string>/path/to/node</string><string>/path/to/server.mjs</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/lantern.log</string>
  <key>StandardErrorPath</key><string>/tmp/lantern.err</string>
</dict></plist>
```

Load it with `launchctl load ~/Library/LaunchAgents/com.lantern.server.plist`. Run `cloudflared` the same way as a second agent. A LaunchAgent starts at user login, not at boot. For a boot start without login, use a LaunchDaemon, or enable auto-login on the M1. pm2 works too (`pm2 start`, `pm2 save`, `pm2 startup`) but adds a dependency. launchd needs none, so prefer it.

## Recommendation

Use plain Node with `ws`, behind a small transport interface, and write the snapshot codec in `src/net/`.

Reasons:
1. Both stacks hit 19.5+ snapshots/s for 60 s on localhost and through the tunnel, with no dropped sockets. Neither is slower in any way that matters at 4 players.
2. The project's rules make the sim and the smoke grid the single source of truth. Colyseus would add a second state tree (Schema) that must be kept in sync with it. `ws` has no such pull.
3. Room codes in the URL, bots, the state log and reconnect cost about 15 extra lines on `ws`. That is small and fully understood.
4. One dependency, 208 KB, against 61 packages and a pnpm 12 install problem. Fewer things to break on a self-hosted Mac.
5. The one real Colyseus win is bandwidth (about 2.6x less here). A binary snapshot with delta-coded smoke cells gets the same result in `src/net/` and is testable with the project's property tests.

Revisit Colyseus only if you later want built-in matchmaking across many rooms.
