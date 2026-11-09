import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseClientMessage, type ServerMessage } from '../../src/net/protocol';
import { decodeSnapshot } from '../../src/net/snapshot-codec';
import {
  CLOSE_ROOM_FULL,
  nextShowmanSeat,
  RECONNECT_GRACE_TICKS,
  ROOM_EMPTY_TTL_TICKS,
  Room,
  SEAT_COUNT,
} from '../../src/server/room';
import type { Connection, ConnectionHandlers } from '../../src/server/transport';
import { TUNING, type State } from '../../src/sim';

class FakeConn implements Connection {
  sent: ServerMessage[] = [];
  closed: number | null = null;
  /** Latest state, rebuilt from binary frames exactly as a client would. */
  state: State | null = null;
  frames = 0;
  send(data: string | Uint8Array): void {
    if (typeof data === 'string') {
      this.sent.push(JSON.parse(data) as ServerMessage);
    } else {
      this.state = decodeSnapshot(data, this.state);
      this.frames++;
    }
  }
  close(code: number): void {
    this.closed = code;
  }
  hello() {
    return this.sent.find((m) => m.t === 'hello');
  }
}

const START = JSON.stringify({ t: 'start' });
const REMATCH = JSON.stringify({ t: 'rematch' });

/** Join a Showman and start the Round. */
function startedRoom(seed = 1): { room: Room; showman: FakeConn; handlers: ConnectionHandlers } {
  const room = new Room('ABCD', seed);
  const showman = new FakeConn();
  const handlers = room.join(showman, null)!;
  handlers.onMessage(START);
  return { room, showman, handlers };
}

describe('room seats', () => {
  it('first joiner is the Showman, the next three are Spectators, the fifth is refused', () => {
    const room = new Room('ABCD', 1);
    const conns = Array.from({ length: SEAT_COUNT + 1 }, () => new FakeConn());
    conns.forEach((c) => room.join(c, null));
    const roles = conns.slice(0, SEAT_COUNT).map((c) => {
      const h = c.hello();
      return h?.t === 'hello' ? h.role : null;
    });
    expect(roles).toEqual(['showman', 'spectator', 'spectator', 'spectator']);
    expect(conns[SEAT_COUNT]?.closed).toBe(CLOSE_ROOM_FULL);
  });

  it('a dropped player resumes the same seat with the token, and loses it after the grace', () => {
    const room = new Room('ABCD', 1);
    const a = new FakeConn();
    const h = room.join(a, null)!;
    const hello = a.hello();
    if (hello?.t !== 'hello') throw new Error('no hello');
    h.onClose();
    const b = new FakeConn();
    room.join(b, hello.token);
    const hello2 = b.hello();
    expect(hello2?.t === 'hello' && hello2.player).toBe(hello.player);

    b.sent = [];
    const handlers = room.join(new FakeConn(), null)!;
    handlers.onClose();
    for (let i = 0; i <= RECONNECT_GRACE_TICKS; i++) room.tick();
    expect(room.humanCount).toBe(1);
  });
});

describe('room inputs', () => {
  it('stamps the seat as the player and ignores snuff from clients', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'in', input: { kind: 'snuff', eventId: 'x', candle: 0 } }))).toBeNull();
    const room = new Room('ABCD', 1);
    const showman = new FakeConn();
    const spectator = new FakeConn();
    room.join(showman, null)!.onMessage(START);
    const hs = room.join(spectator, null)!;
    // A spectator claims to be the Showman: the aim must not apply.
    hs.onMessage(JSON.stringify({ t: 'in', input: { kind: 'aim', angle: 1, player: 0 } }));
    room.tick();
    expect(spectator.state?.tick).toBe(1);
    expect(spectator.state?.beam.angle).toBe(TUNING.beamAngleDefaultRad);
  });

  it('answers pings', () => {
    const room = new Room('ABCD', 1);
    const c = new FakeConn();
    room.join(c, null)!.onMessage(JSON.stringify({ t: 'ping', ts: 42 }));
    expect(c.sent.at(-1)).toEqual({ t: 'pong', ts: 42 });
  });

  it('never throws on arbitrary client text', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const room = new Room('ABCD', 1);
        const h = room.join(new FakeConn(), null)!;
        h.onMessage(START);
        h.onMessage(text);
        room.tick();
      }),
    );
  });
});

describe('snapshots', () => {
  it('a client that decodes deltas tracks the server state, including after a reconnect', () => {
    const room = new Room('ABCD', 5);
    const a = new FakeConn();
    const handlers = room.join(a, null)!;
    handlers.onMessage(START);
    for (let i = 0; i < 10; i++) {
      handlers.onMessage(JSON.stringify({ t: 'in', input: { kind: 'puff', vent: 0 } }));
      room.tick();
    }
    expect(a.frames).toBe(11);
    expect(a.state?.tick).toBe(10);
    expect(Math.max(...(a.state?.grid ?? [0]))).toBeGreaterThan(0);

    handlers.onClose();
    room.tick();
    const hello = a.hello();
    if (hello?.t !== 'hello') throw new Error('no hello');
    const b = new FakeConn();
    room.join(b, hello.token);
    room.tick();
    expect(b.state?.tick).toBe(12);
    expect(Math.max(...(b.state?.grid ?? [0]))).toBeGreaterThan(0);
  });
});

describe('round end and replay', () => {
  it('bots cut the ropes while the Showman idles: the screen falls and the replay ends on that tick', () => {
    const { room } = startedRoom(7);
    const total = TUNING.showLengthS / TUNING.tickS;
    for (let i = 0; i < total + 5; i++) room.tick();
    expect(room.ended).toBe(true);
    expect(room.tickCount).toBeLessThan(total);
    expect(room.log?.states.at(-1)?.tick).toBe(room.tickCount);
    expect((room.log?.states.at(-1) as State).outcome?.winner).toBe('spectators');
  });

  it('ends at the tick count when no one cuts', () => {
    const room = new Room('ABCD', 7);
    // Fill every seat with a human so no bots play; humans send nothing.
    const hs = Array.from({ length: SEAT_COUNT }, () => room.join(new FakeConn(), null)!);
    hs[0]!.onMessage(START);
    const total = TUNING.showLengthS / TUNING.tickS;
    for (let i = 0; i < total + 5; i++) room.tick();
    expect(room.tickCount).toBe(total);
    expect((room.log?.states.at(-1) as State).outcome?.winner).toBe('showman');
  });
});

describe('phase machine', () => {
  it('nextShowmanSeat takes the next held seat, wraps, and stays when alone', () => {
    expect(nextShowmanSeat([0, 1, 3], 1)).toBe(3);
    expect(nextShowmanSeat([0, 1, 3], 3)).toBe(0);
    expect(nextShowmanSeat([2], 2)).toBe(2);
  });

  it('only the Showman starts, and the lobby does not step', () => {
    const room = new Room('ABCD', 1);
    room.join(new FakeConn(), null);
    const hs = room.join(new FakeConn(), null)!;
    hs.onMessage(START);
    expect(room.phase).toBe('lobby');
    for (let i = 0; i < 5; i++) room.tick();
    expect(room.tickCount).toBe(0);
  });

  it('the Showman grace expiring during playing returns to the lobby without an outcome', () => {
    const { room, handlers } = startedRoom();
    const other = new FakeConn();
    room.join(other, null);
    handlers.onClose();
    for (let i = 0; i <= RECONNECT_GRACE_TICKS; i++) room.tick();
    expect(room.phase).toBe('lobby');
    expect(room.log).toBeNull();
    const roster = other.sent.filter((m) => m.t === 'roster').at(-1);
    expect(roster?.t === 'roster' && roster.showman).toBe(1);
  });

  it('rematch waits for the Showman, then rotates the role', () => {
    const { room, handlers } = startedRoom(7);
    const other = new FakeConn();
    const ho = room.join(other, null)!;
    for (let i = 0; i < 400 && room.phase === 'playing'; i++) room.tick();
    expect(room.phase).toBe('ended');
    expect(other.sent.some((m) => m.t === 'log')).toBe(true);
    ho.onMessage(REMATCH);
    expect(room.phase).toBe('ended');
    handlers.onMessage(REMATCH);
    expect(room.phase).toBe('lobby');
    const hello = other.hello();
    if (hello?.t !== 'hello') throw new Error('no hello');
    const roster = other.sent.filter((m) => m.t === 'roster').at(-1);
    expect(roster?.t === 'roster' && roster.showman).toBe(hello.player);
  });

  it('a released Spectator seat shows as human in grace, then as a bot', () => {
    const { room } = startedRoom();
    const watcher = new FakeConn();
    room.join(new FakeConn(), null)!.onClose();
    room.join(watcher, null);
    const kind = (seat: number) => {
      const r = watcher.sent.filter((m) => m.t === 'roster').at(-1);
      return r?.t === 'roster' ? r.seats[seat]?.kind : undefined;
    };
    // The dropped player holds seat 1 during grace.
    room.tick();
    expect(kind(1)).toBe('human');
    for (let i = 0; i < RECONNECT_GRACE_TICKS; i++) room.tick();
    expect(kind(1)).toBe('bot');
    expect(room.phase).toBe('playing');
  });

  it('an empty room expires exactly at the TTL', () => {
    const room = new Room('ABCD', 1);
    for (let i = 0; i < ROOM_EMPTY_TTL_TICKS - 1; i++) room.tick();
    expect(room.expired).toBe(false);
    room.tick();
    expect(room.expired).toBe(true);
  });

  it('a join resets the empty timer', () => {
    const room = new Room('ABCD', 1);
    for (let i = 0; i < ROOM_EMPTY_TTL_TICKS - 1; i++) room.tick();
    room.join(new FakeConn(), null);
    room.tick();
    expect(room.expired).toBe(false);
  });

  it('records the state at tick 0, every second tick and the final tick, with one input list per step', () => {
    const { room } = startedRoom(7);
    for (let i = 0; i < 5; i++) room.tick();
    expect(room.log?.states.map((s) => s.tick)).toEqual([0, 2, 4]);
    expect(room.log?.inputs.length).toBe(5);

    for (let i = 0; i < 400 && room.phase === 'playing'; i++) room.tick();
    const log = room.log!;
    expect(room.phase).toBe('ended');
    expect(log.inputs.length).toBe(room.tickCount);
    expect(log.states.at(-1)?.tick).toBe(room.tickCount);
    const ticks = log.states.map((s) => s.tick);
    expect(ticks.slice(0, -1).every((t) => t % 2 === 0)).toBe(true);
    expect(ticks.slice(0, -1)).toEqual(ticks.slice(0, -1).map((_, i) => i * 2));
  });

  it('resync sends one full frame', () => {
    class RawConn extends FakeConn {
      raw: Uint8Array[] = [];
      override send(data: string | Uint8Array): void {
        if (typeof data !== 'string') this.raw.push(data);
        super.send(data);
      }
    }
    const room = new Room('ABCD', 3);
    const c = new RawConn();
    const h = room.join(c, null)!;
    h.onMessage(START);
    for (let i = 0; i < 5; i++) room.tick();
    const before = c.raw.length;
    h.onMessage(JSON.stringify({ t: 'resync' }));
    expect(c.raw.length).toBe(before + 1);
    const full = decodeSnapshot(c.raw.at(-1)!, null);
    expect(full.tick).toBe(5);
    expect(full.tick).toBe(c.state?.tick);
  });

  it('a late joiner takes the lowest free seat and its bot stops', () => {
    const { room } = startedRoom(7);
    for (let i = 0; i < 5; i++) room.tick();
    const late = new FakeConn();
    room.join(late, null);
    const hello = late.hello();
    expect(hello?.t === 'hello' && hello.player).toBe(1);
    expect(hello?.t === 'hello' && hello.role).toBe('spectator');
    const from = room.log!.inputs.length;
    for (let i = 0; i < 100 && room.phase === 'playing'; i++) room.tick();
    const later = room.log!.inputs.slice(from).flat();
    expect(later.some((inp) => (inp as { player?: number }).player === 1)).toBe(false);
    const roster = late.sent.filter((m) => m.t === 'roster').at(-1);
    expect(roster?.t === 'roster' && roster.seats[1]?.kind).toBe('human');
  });

  it('an empty room expires after the TTL', () => {
    const room = new Room('ABCD', 1);
    for (let i = 0; i < ROOM_EMPTY_TTL_TICKS; i++) room.tick();
    expect(room.expired).toBe(true);
  });
});
