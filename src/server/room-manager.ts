/**
 * Owns all rooms and the fixed-rate loop. A Room is created on the first join of
 * any valid code and removed once Room.expired is true (empty for its TTL).
 * Wall-clock time only paces ticks; round end is decided by tick count in the sim.
 */
import { randomInt } from 'node:crypto';
import { createFixedStepClock, MAX_CATCH_UP_TICKS, type FixedStepClock } from '../net/fixed-step';
import { generateRoomCode, isValidRoomCode } from '../net/room-code';
import { TUNING } from '../sim';
import { Room, type RoomLog } from './room';
import type { Connection, ConnectionHandlers, HttpHandlers, TransportHandlers } from './transport';

const SEED_RANGE = 0x100000000;
const MAX_CODE_ATTEMPTS = 1000;

export interface RoomManagerDeps {
  nowMs: () => number;
  setTimer: (fn: () => void, delayMs: number) => unknown;
  clearTimer: (handle: unknown) => void;
  randomCode: () => string;
  randomSeed: () => number;
}

const defaultDeps: RoomManagerDeps = {
  nowMs: () => performance.now(),
  setTimer: (fn, delayMs) => setTimeout(fn, delayMs),
  clearTimer: (handle) => clearTimeout(handle as NodeJS.Timeout),
  randomCode: () => generateRoomCode(),
  randomSeed: () => randomInt(SEED_RANGE),
};

export class RoomManager implements TransportHandlers, HttpHandlers {
  private rooms = new Map<string, Room>();
  private timer: unknown = null;
  private running = false;
  private clock: FixedStepClock | null = null;
  private readonly deps: RoomManagerDeps;
  private readonly tickMs = TUNING.tickS * 1000;

  constructor(deps: Partial<RoomManagerDeps> = {}) {
    this.deps = { ...defaultDeps, ...deps };
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  hasRoom(code: string): boolean {
    return this.rooms.has(code);
  }

  /** Allocate an unused code and reserve it by creating its (empty) Room. */
  newRoomCode(): string {
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
      const code = this.deps.randomCode();
      if (!this.rooms.has(code)) {
        this.createRoom(code);
        return code;
      }
    }
    throw new Error('no free room code');
  }

  roomLog(code: string): RoomLog | null {
    return this.rooms.get(code)?.log ?? null;
  }

  onConnect(code: string, token: string | null, conn: Connection): ConnectionHandlers | null {
    if (!isValidRoomCode(code)) return null;
    const room = this.rooms.get(code) ?? this.createRoom(code);
    return room.join(conn, token);
  }

  private createRoom(code: string): Room {
    const room = new Room(code, this.deps.randomSeed());
    this.rooms.set(code, room);
    return room;
  }

  /** Run all rooms once, then drop expired ones. Exposed for tests. */
  tickAll(): void {
    for (const [code, room] of this.rooms) {
      room.tick();
      if (room.expired) this.rooms.delete(code);
    }
  }

  /** Run the clock at `nowMs`: tick all rooms once per due step. Returns the step count. */
  pump(nowMs: number): number {
    if (this.clock === null) return 0;
    const due = this.clock.advance(nowMs);
    for (let i = 0; i < due; i++) this.tickAll();
    return due;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const startMs = this.deps.nowMs();
    this.clock = createFixedStepClock(startMs, this.tickMs, MAX_CATCH_UP_TICKS);
    const loop = (): void => {
      if (!this.running) return;
      const now = this.deps.nowMs();
      this.pump(now);
      // Sleep until the next step boundary on the start-anchored grid.
      const nextBoundary = startMs + this.tickMs * (Math.floor((now - startMs) / this.tickMs) + 1);
      this.timer = this.deps.setTimer(loop, Math.max(1, nextBoundary - now));
    };
    this.timer = this.deps.setTimer(loop, this.tickMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = null;
    this.clock = null;
  }
}
