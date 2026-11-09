/**
 * One authoritative room: a Phase machine (lobby, playing, ended) over the shared sim.
 * Seat index is the player id. One seat is the Showman's (`showmanSeat`); the rest are Spectators.
 * Empty Spectator seats are played by bots while a Round runs.
 * Timing is driven from outside via tick(), so tests need no clock.
 * `clockTicks` counts every tick() call in every Phase, because `state.tick` freezes
 * in lobby and ended; grace and the empty-room timer use it.
 */

import { randomBytes, randomInt } from 'node:crypto';
import {
  encodeServerMessage,
  parseClientMessage,
  type Phase,
  type Roster,
  type SeatInfo,
  type ServerMessage,
} from '../net/protocol';
import { acceptClientInput, MAX_INPUTS_PER_SEAT_PER_TICK } from '../net/room-code';
import { encodeSnapshot } from '../net/snapshot-codec';
import { spectatorBotInputs } from '../bots';
import { buildRecap, createState, step, toReplayFrame, TUNING, type Input, type State } from '../sim';
import type { Connection, ConnectionHandlers } from './transport';

/** 1 Showman + 3 Spectators. */
export const SEAT_COUNT = 4;
/** Clock ticks a dropped player keeps their seat (10 s at 20 Hz). */
export const RECONNECT_GRACE_TICKS = 200;
/** A room with no held seat for this many clock ticks may be deleted by the manager (60 s). */
export const ROOM_EMPTY_TTL_TICKS = 1200;
/** Record state every N ticks (10 Hz at 20 Hz tick) for the replay. */
export const RECORD_EVERY_TICKS = 2;
export { MAX_INPUTS_PER_SEAT_PER_TICK };
export const CLOSE_ROOM_FULL = 4001;

const SEED_RANGE = 0x100000000;

export type { Phase };

export interface RoomLog {
  /** states[0] is the first state; then every RECORD_EVERY_TICKS, plus the final state. */
  states: State[];
  /** One input list per stepped tick. */
  inputs: Input[][];
}

interface Seat {
  token: string;
  conn: Connection | null;
  /** clockTicks value at which a disconnected seat is released. */
  releaseAtClockTick: number | null;
  inputsThisTick: number;
  /** The state the client holds; the next snapshot is a delta against it. */
  baseline: State | null;
}

/**
 * The next held seat in ascending order after `current`, wrapping.
 * Stays on `current` when no seat is held or only `current` is held.
 */
export function nextShowmanSeat(heldSeats: readonly number[], current: number): number {
  const sorted = [...heldSeats].sort((a, b) => a - b);
  if (sorted.length === 0) return current;
  return sorted.find((s) => s > current) ?? sorted[0]!;
}

export class Room {
  readonly code: string;
  private _phase: Phase = 'lobby';
  private state: State | null = null;
  private seats: (Seat | null)[] = new Array<Seat | null>(SEAT_COUNT).fill(null);
  private showmanSeat = TUNING.showmanIdDefault;
  private pending: Input[] = [];
  private roundLog: RoomLog | null = null;
  private clockTicks = 0;
  private emptyTicks = 0;
  private rematchPending = false;
  private nextSeed: number | null;
  private lastRosterKey = '';

  /** `seed` is used for the first Round only; later Rounds draw a server seed. */
  constructor(code: string, seed?: number) {
    this.code = code;
    this.nextSeed = seed ?? null;
  }

  get phase(): Phase {
    return this._phase;
  }

  get tickCount(): number {
    return this.state?.tick ?? 0;
  }

  get ended(): boolean {
    return this._phase === 'ended';
  }

  /** Seats held by a human, connected or in grace. */
  get humanCount(): number {
    return this.seats.filter((s) => s !== null).length;
  }

  /** True once no seat has been held for ROOM_EMPTY_TTL_TICKS consecutive clock ticks. */
  get expired(): boolean {
    return this.emptyTicks >= ROOM_EMPTY_TTL_TICKS;
  }

  /** The Round's log, available once it ends (and until the next start). Null otherwise. */
  get log(): RoomLog | null {
    return this.state === null ? null : this.roundLog;
  }

  /** Seat a connection (new or resuming by token). Returns handlers, or null if the room is full. */
  join(conn: Connection, token: string | null): ConnectionHandlers | null {
    let player = token === null ? -1 : this.seats.findIndex((s) => s !== null && s.token === token);
    if (player >= 0) {
      const seat = this.seats[player]!;
      seat.conn?.close(1000, 'replaced');
      seat.conn = conn;
      seat.releaseAtClockTick = null;
      seat.baseline = null; // a new connection starts from a full frame
    } else {
      player = this.seats.findIndex((s) => s === null);
      if (player < 0) {
        conn.close(CLOSE_ROOM_FULL, 'room full');
        return null;
      }
      this.seats[player] = {
        token: randomBytes(16).toString('hex'),
        conn,
        releaseAtClockTick: null,
        inputsThisTick: 0,
        baseline: null,
      };
      this.emptyTicks = 0;
    }
    if (this._phase === 'lobby') this.reassignShowman();
    const seat = this.seats[player]!;
    this.send(conn, {
      t: 'hello',
      player,
      role: player === this.showmanSeat ? 'showman' : 'spectator',
      token: seat.token,
      code: this.code,
      phase: this._phase,
    });
    this.broadcastRoster(true);
    this.sendFull(seat);
    if (this._phase === 'ended') this.sendLog(conn);
    return {
      onMessage: (data) => this.onMessage(player, conn, data),
      onClose: () => this.onClose(player, conn),
    };
  }

  /** One wall-clock tick of the room. */
  tick(): void {
    this.clockTicks++;
    this.releaseExpiredSeats();
    this.emptyTicks = this.humanCount === 0 ? this.emptyTicks + 1 : 0;

    if (this._phase === 'lobby') {
      this.reassignShowman();
    } else if (this._phase === 'playing') {
      if (this.seats[this.showmanSeat] === null) this.discardRound();
      else this.stepRound();
    } else if (this.rematchPending && !this.showmanConnected()) {
      this.toLobbyForRematch();
    }
    this.broadcastRoster(false);
  }

  private stepRound(): void {
    const state = this.state!;
    const log = this.roundLog!;
    const botSeats: number[] = [];
    for (let p = 0; p < SEAT_COUNT; p++) {
      if (p !== this.showmanSeat && this.seats[p] === null) botSeats.push(p);
    }
    const inputs: Input[] = [...this.pending, ...spectatorBotInputs(state, botSeats)];
    this.pending = [];
    const next = step(state, inputs);
    this.state = next;
    log.inputs.push(inputs);
    const over = next.ended || next.outcome !== null;
    if (next.tick % RECORD_EVERY_TICKS === 0 || over) log.states.push(next);

    // Seats sharing a baseline share one encoded frame.
    const frames = new Map<State | null, Uint8Array>();
    for (const seat of this.seats) {
      if (seat === null) continue;
      seat.inputsThisTick = 0;
      if (seat.conn === null) continue;
      let frame = frames.get(seat.baseline);
      if (frame === undefined) {
        frame = encodeSnapshot(next, seat.baseline);
        frames.set(seat.baseline, frame);
      }
      seat.conn.send(frame);
      seat.baseline = next;
    }

    if (over) {
      this._phase = 'ended';
      this.rematchPending = false;
      this.broadcastRoster(true);
      for (const seat of this.seats) if (seat?.conn) this.sendLog(seat.conn);
    }
  }

  private discardRound(): void {
    this._phase = 'lobby';
    this.state = null;
    this.roundLog = null;
    this.pending = [];
    this.rematchPending = false;
    for (const seat of this.seats) if (seat) seat.baseline = null;
    this.reassignShowman();
  }

  private toLobbyForRematch(): void {
    this.showmanSeat = nextShowmanSeat(this.heldSeats(), this.showmanSeat);
    this._phase = 'lobby';
    this.rematchPending = false;
    this.state = null;
    for (const seat of this.seats) if (seat) seat.baseline = null;
    this.broadcastRoster(true);
  }

  private startRound(): void {
    const seed = this.nextSeed ?? randomInt(SEED_RANGE);
    this.nextSeed = null;
    const state = createState(seed, TUNING, { showmanId: this.showmanSeat });
    this.state = state;
    this.roundLog = { states: [state], inputs: [] };
    this.pending = [];
    this.rematchPending = false;
    this._phase = 'playing';
    this.broadcastRoster(true);
    for (const seat of this.seats) if (seat) this.sendFull(seat);
  }

  private sendFull(seat: Seat): void {
    seat.baseline = null;
    if (seat.conn === null || this.state === null || this._phase === 'lobby') return;
    seat.conn.send(encodeSnapshot(this.state, null));
    seat.baseline = this.state;
  }

  private sendLog(conn: Connection): void {
    if (this.roundLog === null) return;
    const frames = this.roundLog.states.map(toReplayFrame);
    this.send(conn, { t: 'log', frames, recap: buildRecap(frames) });
  }

  private heldSeats(): number[] {
    const held: number[] = [];
    this.seats.forEach((s, i) => {
      if (s !== null) held.push(i);
    });
    return held;
  }

  private showmanConnected(): boolean {
    return this.seats[this.showmanSeat]?.conn != null;
  }

  /** In lobby the Showman is the held seat of the current Showman, else the lowest held seat. */
  private reassignShowman(): void {
    if (this.seats[this.showmanSeat] !== null) return;
    const held = this.heldSeats();
    this.showmanSeat = held.length > 0 ? held[0]! : TUNING.showmanIdDefault;
  }

  private releaseExpiredSeats(): void {
    this.seats.forEach((seat, player) => {
      if (
        seat !== null &&
        seat.conn === null &&
        seat.releaseAtClockTick !== null &&
        this.clockTicks >= seat.releaseAtClockTick
      ) {
        this.seats[player] = null;
      }
    });
  }

  private buildRoster(): Roster {
    const seats: SeatInfo[] = this.seats.map((seat, i) => ({
      seat: i,
      kind: seat !== null ? 'human' : this._phase === 'playing' && i !== this.showmanSeat ? 'bot' : 'open',
      role: i === this.showmanSeat ? 'showman' : 'spectator',
      connected: seat?.conn != null,
    }));
    return {
      phase: this._phase,
      showman: this.showmanSeat,
      seats,
      rematchPending: this.rematchPending,
      graceTicksLeft: this.seats.map((seat) =>
        seat !== null && seat.conn === null && seat.releaseAtClockTick !== null
          ? Math.max(0, seat.releaseAtClockTick - this.clockTicks)
          : null,
      ),
    };
  }

  /** Send the roster to every connected seat when it changed (or when forced). */
  private broadcastRoster(force: boolean): void {
    const roster = this.buildRoster();
    // The grace countdown changes every tick; only whether a grace is running counts as a change.
    const key = JSON.stringify({ ...roster, graceTicksLeft: roster.graceTicksLeft.map((g) => g !== null) });
    if (!force && key === this.lastRosterKey) return;
    this.lastRosterKey = key;
    const text = encodeServerMessage({ t: 'roster', ...roster });
    for (const seat of this.seats) seat?.conn?.send(text);
  }

  private onMessage(player: number, conn: Connection, data: string): void {
    const seat = this.seats[player];
    if (seat === null || seat === undefined || seat.conn !== conn) return; // stale connection
    const msg = parseClientMessage(data);
    if (msg === null) return;
    switch (msg.t) {
      case 'ping':
        this.send(conn, { t: 'pong', ts: msg.ts });
        return;
      case 'start':
        if (this._phase === 'lobby' && player === this.showmanSeat) this.startRound();
        return;
      case 'rematch':
        if (this._phase !== 'ended') return;
        this.rematchPending = true;
        if (player === this.showmanSeat || !this.showmanConnected()) this.toLobbyForRematch();
        else this.broadcastRoster(false);
        return;
      case 'resync':
        this.sendFull(seat);
        return;
      case 'in': {
        if (this._phase !== 'playing') return;
        // The server stamps the player id; a client cannot act as someone else.
        const input = acceptClientInput(data, player, seat.inputsThisTick);
        if (input === null) return;
        seat.inputsThisTick++;
        this.pending.push(input);
        return;
      }
    }
  }

  private onClose(player: number, conn: Connection): void {
    const seat = this.seats[player];
    if (seat === null || seat === undefined || seat.conn !== conn) return; // already replaced
    seat.conn = null;
    seat.baseline = null;
    seat.releaseAtClockTick = this.clockTicks + RECONNECT_GRACE_TICKS;
    this.broadcastRoster(false);
  }

  private send(conn: Connection, msg: ServerMessage): void {
    conn.send(encodeServerMessage(msg));
  }
}
