// Prototype B: plain Node + `ws`, hand-written room loop.
// Run: cd spikes/net/ws && corepack pnpm install && corepack pnpm start   (PORT=2568)
import { randomBytes } from "node:crypto";
import http from "node:http";
import { WebSocketServer } from "ws";
import { RECONNECT_GRACE_MS, ROOM_CODE_RE, TICK_HZ } from "../shared/config.mjs";
import { createSim, freeSeat, setInput, snapshotOf, stepSim } from "../shared/sim.mjs";
import { flushLog, handleLogRequest, logTick } from "../shared/state-log.mjs";

const PORT = Number(process.env.PORT ?? 2568);
const rooms = new Map(); // code -> room

function getRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    room = { sim: createSim(code), conns: new Array(4).fill(null), timer: null };
    room.timer = setInterval(() => tickRoom(room), 1000 / TICK_HZ);
    rooms.set(code, room);
  }
  return room;
}

function tickRoom(room) {
  stepSim(room.sim);
  const snap = snapshotOf(room.sim);
  logTick(room.sim.code, snap);
  const msg = JSON.stringify({ t: "s", ...snap });
  for (const c of room.conns) if (c?.ws && c.ws.readyState === 1) c.ws.send(msg);
}

function releaseSeat(room, seat) {
  room.sim.seats[seat].human = false; // a bot takes over
  room.conns[seat] = null;
  if (room.conns.every((c) => c === null)) {
    clearInterval(room.timer);
    flushLog(room.sim.code, "ws");
    rooms.delete(room.sim.code);
  }
}

function attach(ws, room, seat, conn) {
  conn.ws = ws;
  ws.on("message", (data) => {
    let m;
    try { m = JSON.parse(data.toString()); } catch { return; }
    if (m.t === "in") setInput(room.sim, seat, Number(m.x), Number(m.y));
    else if (m.t === "ping") ws.send(JSON.stringify({ t: "pong", ts: m.ts }));
  });
  ws.on("close", () => {
    if (conn.ws !== ws) return; // already replaced by a reconnect
    conn.ws = null;
    conn.grace = setTimeout(() => releaseSeat(room, seat), RECONNECT_GRACE_MS);
  });
}

const server = http.createServer((req, res) => {
  if (handleLogRequest(req, res)) return;
  if (req.url === "/health") { res.writeHead(200); res.end("ok"); return; }
  if (/^\/r\/[A-Z0-9]{4}$/.test(req.url ?? "")) { // the "join by link" page would be served by the static host
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("Connect a WebSocket to this URL to join the room.\n");
    return;
  }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://x");
  const m = /^\/r\/([A-Z0-9]{4})$/.exec(url.pathname);
  if (!m || !ROOM_CODE_RE.test(m[1])) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const room = getRoom(m[1]);
    const token = url.searchParams.get("token");
    let seat = room.conns.findIndex((c) => c && c.token === token);
    let conn;
    if (token && seat >= 0) { // reconnect into the held seat
      conn = room.conns[seat];
      clearTimeout(conn.grace);
      conn.ws?.terminate();
    } else {
      seat = freeSeat(room.sim);
      if (seat < 0) { ws.close(4001, "room full"); return; }
      conn = { token: randomBytes(8).toString("hex"), ws: null, grace: null };
      room.conns[seat] = conn;
      room.sim.seats[seat].human = true;
    }
    attach(ws, room, seat, conn);
    ws.send(JSON.stringify({ t: "hello", seat, token: conn.token, role: seat === 0 ? "showman" : "spectator" }));
  });
});

server.listen(PORT, () => console.log(`ws prototype listening on :${PORT}`));
