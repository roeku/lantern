// Load test: 4 simulated clients join one room, play for N seconds, print per-client stats.
// Usage: node load-test.mjs --proto ws|colyseus --url ws://localhost:2568 [--secs 60] [--code ABCD] [--drop]
//   --drop  client 0 kills its socket at 1/3 of the run and reconnects; reports the gap.
// Server CPU and RSS come from the server's GET /stats endpoint.
import { createRequire } from "node:module";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? true : all[i + 1]]);
    return acc;
  }, []),
);
const PROTO = args.proto ?? "ws";
const URL_BASE = String(args.url ?? (PROTO === "ws" ? "ws://localhost:2568" : "ws://localhost:2567")).replace(/\/$/, "");
const SECS = Number(args.secs ?? 60);
const CODE = String(args.code ?? "ABCD");
const CLIENTS = 4;

const requireFrom = (dir) => createRequire(new URL(`./${dir}/package.json`, import.meta.url));
const percentile = (xs, p) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] : NaN);

// ---------- adapters: { onSnap(cb), sendInput(x,y), ping(), isOpen(), drop(), reconnect(), close(), role } ----------
async function connectWs(i) {
  const { WebSocket } = requireFrom("ws")("ws");
  const c = { bytes: 0, snaps: 0, rtts: [], token: null, role: null, closed: false, onSnap: () => {} };
  const open = (token) =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(`${URL_BASE}/r/${CODE}${token ? `?token=${token}` : ""}`);
      c.ws = ws;
      ws.on("message", (data) => {
        c.bytes += data.length;
        const m = JSON.parse(data.toString());
        if (m.t === "s") { c.snaps++; c.onSnap(); }
        else if (m.t === "pong") c.rtts.push(performance.now() - m.ts);
        else if (m.t === "hello") { c.token = m.token; c.role = m.role; resolve(); }
      });
      ws.on("close", () => { if (c.ws === ws) c.closed = true; });
      ws.on("error", reject);
    });
  await open(null);
  return {
    c,
    onSnap: (cb) => (c.onSnap = cb),
    sendInput: (x, y) => c.ws.readyState === 1 && c.ws.send(JSON.stringify({ t: "in", x, y })),
    ping: () => c.ws.readyState === 1 && c.ws.send(JSON.stringify({ t: "ping", ts: performance.now() })),
    isOpen: () => c.ws.readyState === 1,
    drop: () => { c.dropped = true; c.ws.terminate(); },
    reconnect: async () => { c.closed = false; await open(c.token); },
    close: () => c.ws.close(),
  };
}

async function connectColyseus(i) {
  const { Client } = requireFrom("colyseus")("colyseus.js");
  const client = new Client(URL_BASE);
  const c = { bytes: 0, snaps: 0, rtts: [], role: null, closed: false, onSnap: () => {} };
  const bind = (room) => {
    c.room = room;
    room.connection.transport.ws.addEventListener("message", (e) => {
      c.bytes += e.data.byteLength ?? e.data.length;
    });
    room.onStateChange(() => { c.snaps++; c.onSnap(); });
    room.onMessage("hello", (m) => (c.role = m.role));
    room.onMessage("pong", (ts) => c.rtts.push(performance.now() - ts));
    room.onLeave(() => { if (c.room === room && !c.dropped) c.closed = true; });
  };
  bind(await client.joinOrCreate("lantern", { code: CODE }));
  return {
    c,
    onSnap: (cb) => (c.onSnap = cb),
    sendInput: (x, y) => c.room.connection.isOpen && c.room.send("in", { x, y }),
    ping: () => c.room.connection.isOpen && c.room.send("ping", performance.now()),
    isOpen: () => c.room.connection.isOpen,
    drop: () => { c.dropped = true; c.room.connection.transport.ws.close(4001); },
    reconnect: async () => { c.closed = false; c.dropped = false; bind(await client.reconnect(c.room.reconnectionToken)); },
    close: () => c.room.leave(),
  };
}

// ---------- run ----------
const connect = PROTO === "ws" ? connectWs : connectColyseus;
const clients = [];
for (let i = 0; i < CLIENTS; i++) clients.push(await connect(i)); // sequential so client 0 is the Showman
await new Promise((r) => setTimeout(r, 400));
console.log(`[${PROTO}] ${CLIENTS} clients joined ${URL_BASE} room ${CODE}; roles: ${clients.map((x) => x.c.role).join(", ")}`);

const dirs = [-1, 0, 1];
const timers = [];
for (const cl of clients) Object.assign(cl.c, { snaps: 0, bytes: 0, rtts: [] }); // measure from the start of the run
const start = performance.now();
let reconnectGapMs = null;
for (const cl of clients) {
  timers.push(setInterval(() => cl.sendInput(dirs[Math.floor(Math.random() * 3)], dirs[Math.floor(Math.random() * 3)]), 200));
  timers.push(setInterval(() => cl.ping(), 1000));
}
const httpBase = URL_BASE.replace(/^ws/, "http");
const getStats = async () => (await fetch(`${httpBase}/stats`)).json();
const statsStart = await getStats();
const rssSamples = [];
timers.push(setInterval(async () => rssSamples.push((await getStats()).rssMb), 2000));
if (args.drop) {
  setTimeout(async () => {
    const cl = clients[0];
    const t0 = performance.now();
    cl.drop();
    await new Promise((r) => setTimeout(r, 500));
    try {
      await cl.reconnect();
      await new Promise((r) => { cl.onSnap(() => { cl.onSnap(() => {}); r(); }); });
      reconnectGapMs = performance.now() - t0;
    } catch (e) { reconnectGapMs = `failed: ${e.message}`; }
  }, (SECS * 1000) / 3);
}

await new Promise((r) => setTimeout(r, SECS * 1000));
const elapsedSec = (performance.now() - start) / 1000;
timers.forEach(clearInterval);
const statsEnd = await getStats();

const rows = clients.map((cl, i) => ({
  client: i,
  snapsPerSec: +(cl.c.snaps / elapsedSec).toFixed(2),
  KBperSec: +(cl.c.bytes / 1024 / elapsedSec).toFixed(2),
  rttMsP50: +percentile(cl.c.rtts, 0.5).toFixed(1),
  rttMsP95: +percentile(cl.c.rtts, 0.95).toFixed(1),
  openFullRun: cl.isOpen() && !cl.c.closed,
}));
console.table(rows);
const mean = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : NaN);
console.log(`[${PROTO}] ${elapsedSec.toFixed(1)}s  mean snaps/s ${mean(rows.map((r) => r.snapsPerSec))}  mean KB/s ${mean(rows.map((r) => r.KBperSec))}  all open: ${rows.every((r) => r.openFullRun)}`);
if (args.drop) console.log(`[${PROTO}] reconnect gap (drop -> first snapshot): ${typeof reconnectGapMs === "number" ? reconnectGapMs.toFixed(0) + " ms" : reconnectGapMs}`);
console.log(`[${PROTO}] server CPU ${(((statsEnd.cpuUs - statsStart.cpuUs) / 1e6 / elapsedSec) * 100).toFixed(1)}% of one core (whole process, 1 room)  RSS MB mean ${mean(rssSamples)} max ${Math.max(...rssSamples).toFixed(1)}`);
clients.forEach((c) => c.close());
setTimeout(() => process.exit(0), 500);
