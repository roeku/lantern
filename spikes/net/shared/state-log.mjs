// 10 Hz state log per room. In memory, written as JSONL on room end, fetchable over HTTP.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LOG_HZ, TICK_HZ } from "./config.mjs";

const LOG_EVERY_TICKS = TICK_HZ / LOG_HZ;
const logs = new Map(); // code -> snapshots[]
const LOG_DIR = new URL("../logs/", import.meta.url).pathname;

export function logTick(code, snapshot) {
  if (snapshot.k % LOG_EVERY_TICKS !== 0) return;
  let list = logs.get(code);
  if (!list) logs.set(code, (list = []));
  list.push(snapshot);
}

export function getLog(code) {
  return logs.get(code) ?? [];
}

export function flushLog(code, label) {
  const list = logs.get(code);
  if (!list?.length) return;
  mkdirSync(LOG_DIR, { recursive: true });
  writeFileSync(join(LOG_DIR, `${label}-${code}.jsonl`), list.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

/** HTTP handler for GET /log/ABCD. Returns true if handled. */
export function handleLogRequest(req, res) {
  if (req.url === "/stats") { // process CPU and memory, sampled by the load test
    const c = process.cpuUsage();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ cpuUs: c.user + c.system, rssMb: process.memoryUsage().rss / 1048576 }));
    return true;
  }
  const m = /^\/log\/([A-Z0-9]{4})$/.exec(req.url ?? "");
  if (!m) return false;
  res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(getLog(m[1])));
  return true;
}
