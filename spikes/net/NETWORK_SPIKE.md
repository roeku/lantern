# Network spike: pick the multiplayer stack for a self-hosted M1 server

## Goal
Choose how to run a server-authoritative room for 1 Showman + 3 Spectators, self-hosted on an
Apple M1 Mac and reached from the internet through a free tunnel, joined by link, with bots
in empty seats. Build two throwaway prototypes on this machine and compare them.
Everything must run for free.

## Requirements
- Work only inside spikes/net/. Don't touch src/, .kiro/ or root package files.
- Prototype A: Colyseus on Node. Prototype B: plain Node with the `ws` package and a hand-written room loop.
- WebSockets only, no WebRTC, so both work through a tunnel.
- Use only free software and free tiers. Flag anything that would cost money.
- Each prototype has:
  - a room addressed by a code in the URL (/r/ABCD) with up to 4 seats; the first player to join is the Showman
  - a 20 Hz server tick that moves one dot per seat from arrow-key input and sends a snapshot to every client
  - a server-side bot that takes any empty seat and wanders
  - a 10 Hz state log per room that can be fetched after the round
  - a script that starts the server, connects 4 simulated clients for 60 s, and prints
    the snapshots per second and bytes per second each client receives
- Run the load test on localhost, then through a Cloudflare quick tunnel
  (`cloudflared tunnel --url http://localhost:<port>`, no account needed). Record the round-trip
  time and whether every WebSocket connection stays open for the full 60 s.
- Write spikes/net/REPORT.md comparing: setup steps, lines of code, snapshot rate and bandwidth
  (on localhost and through the tunnel), round-trip time through the tunnel, CPU and memory per room
  on this machine and how many rooms it could hold, upload bandwidth per room, reconnecting after a
  dropped connection, how bots, joining by link and the state log work, and how to keep the server
  running (launchd or pm2, restarting after a crash and after a reboot).
  End with one recommendation and the reasons for it.

## Acceptance criteria
- Each prototype starts with one documented command.
- The load script shows at least 19 snapshots/s per client for 60 s on both, on localhost and
  through the tunnel, or the report explains why not.
- REPORT.md ends with a single recommendation.