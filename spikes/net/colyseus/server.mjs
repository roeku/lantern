// Prototype A: Colyseus 0.16 on Node. State is a Colyseus Schema, patched at 20 Hz.
// Run: cd spikes/net/colyseus && corepack pnpm install && corepack pnpm start   (PORT=2567)
import http from "node:http";
import { Room, Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ArraySchema, Schema, type } from "@colyseus/schema";
import { RECONNECT_GRACE_MS, SEAT_COUNT, TICK_HZ } from "../shared/config.mjs";
import { createSim, freeSeat, setInput, snapshotOf, stepSim } from "../shared/sim.mjs";
import { flushLog, handleLogRequest, logTick } from "../shared/state-log.mjs";

const PORT = Number(process.env.PORT ?? 2567);

class SeatState extends Schema {}
type("int16")(SeatState.prototype, "x");
type("int16")(SeatState.prototype, "y");
type("boolean")(SeatState.prototype, "human");

class RoomState extends Schema {}
type("uint32")(RoomState.prototype, "tick");
type([SeatState])(RoomState.prototype, "seats");

class LanternRoom extends Room {
  maxClients = SEAT_COUNT;
  patchRate = 1000 / TICK_HZ;

  onCreate(options) {
    this.code = String(options.code);
    this.sim = createSim(this.code);
    this.seatOf = new Map(); // sessionId -> seat
    this.setState(new RoomState());
    this.state.seats = new ArraySchema();
    for (let i = 0; i < SEAT_COUNT; i++) this.state.seats.push(new SeatState());
    this.onMessage("in", (client, m) => {
      const seat = this.seatOf.get(client.sessionId);
      if (seat !== undefined) setInput(this.sim, seat, Number(m.x), Number(m.y));
    });
    this.onMessage("ping", (client, ts) => client.send("pong", ts));
    this.setSimulationInterval(() => this.tickRoom(), 1000 / TICK_HZ);
  }

  tickRoom() {
    stepSim(this.sim);
    const snap = snapshotOf(this.sim);
    logTick(this.code, snap);
    this.state.tick = snap.k;
    snap.p.forEach(([x, y, h], i) => {
      const s = this.state.seats[i];
      s.x = x; s.y = y; s.human = h === 1;
    });
  }

  onJoin(client) {
    const seat = freeSeat(this.sim);
    this.seatOf.set(client.sessionId, seat);
    this.sim.seats[seat].human = true;
    // Delay so the client has registered its onMessage handler (Colyseus drops unhandled early messages).
    this.clock.setTimeout(() => client.send("hello", { seat, role: seat === 0 ? "showman" : "spectator" }), 200);
  }

  async onLeave(client, consented) {
    const seat = this.seatOf.get(client.sessionId);
    try {
      if (consented) throw new Error("left");
      await this.allowReconnection(client, RECONNECT_GRACE_MS / 1000);
    } catch {
      this.sim.seats[seat].human = false; // a bot takes over
      this.seatOf.delete(client.sessionId);
    }
  }

  onDispose() {
    flushLog(this.code, "colyseus");
  }
}

const httpServer = http.createServer((req, res) => {
  if (handleLogRequest(req, res)) return;
  if (req.url === "/health") { res.writeHead(200); res.end("ok"); return; }
});
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define("lantern", LanternRoom).filterBy(["code"]);
gameServer.listen(PORT).then(() => console.log(`colyseus prototype listening on :${PORT}`));
