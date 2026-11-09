// Tiny deterministic room sim shared by both prototypes: one dot per seat.
import {
  BOT_SPEED_CMPS, BOT_TURN_MAX_TICKS, BOT_TURN_MIN_TICKS, PLAYER_SPEED_CMPS,
  ROOM_H_CM, ROOM_W_CM, SEAT_COUNT, TICK_HZ,
} from "./config.mjs";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCode(code) {
  let h = 2166136261;
  for (const ch of code) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function createSim(code) {
  const rng = mulberry32(hashCode(code));
  const seats = [];
  for (let i = 0; i < SEAT_COUNT; i++) {
    seats.push({
      x: Math.round(rng() * ROOM_W_CM), y: Math.round(rng() * ROOM_H_CM),
      ix: 0, iy: 0, human: false, botTurnTicks: 0,
    });
  }
  return { code, tick: 0, rng, seats };
}

/** Seat a new human gets: lowest non-human, so the first joiner is the Showman (seat 0). */
export function freeSeat(sim) {
  return sim.seats.findIndex((s) => !s.human);
}

export function setInput(sim, seat, ix, iy) {
  const s = sim.seats[seat];
  s.ix = Math.max(-1, Math.min(1, Math.sign(ix) || 0));
  s.iy = Math.max(-1, Math.min(1, Math.sign(iy) || 0));
}

export function stepSim(sim) {
  for (const s of sim.seats) {
    let speed = PLAYER_SPEED_CMPS;
    if (!s.human) {
      speed = BOT_SPEED_CMPS;
      if (s.botTurnTicks-- <= 0) {
        s.ix = Math.round(sim.rng() * 2) - 1;
        s.iy = Math.round(sim.rng() * 2) - 1;
        s.botTurnTicks = BOT_TURN_MIN_TICKS + Math.floor(sim.rng() * (BOT_TURN_MAX_TICKS - BOT_TURN_MIN_TICKS));
      }
    }
    const d = speed / TICK_HZ;
    s.x = Math.max(0, Math.min(ROOM_W_CM, Math.round(s.x + s.ix * d)));
    s.y = Math.max(0, Math.min(ROOM_H_CM, Math.round(s.y + s.iy * d)));
    if (!s.human) {
      if (s.x <= 0 || s.x >= ROOM_W_CM) s.ix = -s.ix;
      if (s.y <= 0 || s.y >= ROOM_H_CM) s.iy = -s.iy;
    }
  }
  sim.tick++;
}

/** Plain-data snapshot: [x, y, human] per seat. */
export function snapshotOf(sim) {
  return { k: sim.tick, p: sim.seats.map((s) => [s.x, s.y, s.human ? 1 : 0]) };
}
