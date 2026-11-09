---
inclusion: fileMatch
fileMatchPattern: ["src/server/**", "src/net/**"]
---

# Netcode rules (stub)

## Model
- The server is authoritative and runs the same sim as the client.
- The server sends snapshots at 20 Hz (one per sim tick).
- Snapshots include the smoke grid, because the grid is the network sync truth. Never sync smoke particles.
- Clients send inputs only. They never send state.
- The server records a State_Log at 10 Hz plus an input log for the replay. The replay must reproduce the final state.

## Hosting
- Node server self-hosted on the M1 Mac, behind a free tunnel (Cloudflare Tunnel or Tailscale Funnel).
- WebSockets only. In the slice, Vite serves the client behind the same tunnel; the static-host deploy is later work.
- No paid services.

## Decisions
- Library: `ws` on plain Node. Protocol code stays behind the small `Transport` interface.
- Snapshot format: binary delta, with a full Snapshot on join, reconnect and `resync`.
- Reconnect: a Seat_Token returns the same seat within a 10 s grace.
- Routes: `/new` creates a room code, `GET /log/<CODE>` returns the State_Log and input log.

## Rules that hold regardless
- Solo play never touches this code path.
- Duplicate or replayed messages must not change outcomes (a snuff counts once).
- All clients agree on round end from tick count, not wall-clock time.
