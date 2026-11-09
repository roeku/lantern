import { describe, expect, it } from 'vitest';
import {
  CLOSE_BAD_CODE,
  CLOSE_ROOM_FULL,
  NetSession,
  RECONNECT_GRACE_S,
  RECONNECT_RETRY_MS,
  TOKEN_KEY_PREFIX,
  fetchNewRoomCode,
  type NetSessionDeps,
  type SocketLike,
} from '../../src/client/session/net-session';
import type { SessionEvent } from '../../src/client/session/session';
import { roomCodeFromPath, wsUrl } from '../../src/client/session/ws-url';
import { encodeSnapshot } from '../../src/net/snapshot-codec';
import { createState } from '../../src/sim';

/** Validates: Requirements 6.8, 8.6, 15.3 */

class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  binaryType = 'blob';
  readyState = 0;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  sent: string[] = [];
  closed = false;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  msg(data: unknown): void {
    this.onmessage?.({ data });
  }
  drop(code = 1006): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

function harness(initialStorage: Record<string, string> = {}) {
  FakeSocket.all = [];
  const store = new Map(Object.entries(initialStorage));
  let nowMs = 0;
  let timers: { fn: () => void; at: number; id: number }[] = [];
  let nextId = 1;
  const deps: NetSessionDeps = {
    WebSocketCtor: FakeSocket,
    storage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
    },
    location: { protocol: 'http:', host: 'h:1' },
    now: () => nowMs,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.push({ fn, at: nowMs + ms, id });
      return id;
    },
    clearTimeout: (h) => {
      timers = timers.filter((t) => t.id !== h);
    },
  };
  const advance = (ms: number) => {
    const end = nowMs + ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers = timers.filter((t) => t !== due);
      nowMs = due.at;
      due.fn();
    }
    nowMs = end;
  };
  const session = new NetSession('ABCD', deps);
  const events: SessionEvent[] = [];
  session.subscribe((e) => events.push(e));
  const sock = () => FakeSocket.all[FakeSocket.all.length - 1]!;
  return { session, events, store, sock, advance };
}

describe('ws-url', () => {
  it('uses ws for http and wss for https', () => {
    expect(wsUrl({ protocol: 'http:', host: 'a:1' }, 'ABCD')).toBe('ws://a:1/r/ABCD');
    expect(wsUrl({ protocol: 'https:', host: 'a.b' }, 'ABCD')).toBe('wss://a.b/r/ABCD');
  });
  it('appends an encoded token only when present', () => {
    expect(wsUrl({ protocol: 'http:', host: 'a' }, 'ABCD', 'x y')).toBe('ws://a/r/ABCD?token=x%20y');
    expect(wsUrl({ protocol: 'http:', host: 'a' }, 'ABCD', null)).toBe('ws://a/r/ABCD');
  });
  it('parses room codes from paths', () => {
    expect(roomCodeFromPath('/r/ABCD')).toBe('ABCD');
    expect(roomCodeFromPath('/x/ABCD')).toBeNull();
  });
});

describe('NetSession', () => {
  it('connects with binary arraybuffer and no token on first visit', () => {
    const h = harness();
    expect(h.sock().url).toBe('ws://h:1/r/ABCD');
    expect(h.sock().binaryType).toBe('arraybuffer');
  });

  it('stores the hello token and reuses it on reconnect', () => {
    const h = harness();
    h.sock().open();
    h.sock().msg(JSON.stringify({ t: 'hello', player: 2, role: 'spectator', code: 'ABCD', phase: 'lobby', token: 'tok1' }));
    expect(h.store.get(TOKEN_KEY_PREFIX + 'ABCD')).toBe('tok1');
    expect(h.events.some((e) => e.kind === 'hello')).toBe(true);
    h.sock().drop();
    h.advance(RECONNECT_RETRY_MS);
    expect(FakeSocket.all).toHaveLength(2);
    expect(h.sock().url).toBe('ws://h:1/r/ABCD?token=tok1');
  });

  it('uses a pre-existing stored token on first connect', () => {
    const h = harness({ [TOKEN_KEY_PREFIX + 'ABCD']: 'old' });
    expect(h.sock().url).toContain('token=old');
  });

  it('sends input, start and rematch only while open', () => {
    const h = harness();
    h.session.start();
    expect(h.sock().sent).toEqual([]);
    h.sock().open();
    h.session.sendInput({ kind: 'puff', vent: 1 });
    h.session.start();
    h.session.rematch();
    expect(h.sock().sent.map((s) => JSON.parse(s))).toEqual([
      { t: 'in', input: { kind: 'puff', vent: 1 } },
      { t: 'start' },
      { t: 'rematch' },
    ]);
  });

  it('emits state for a good frame, and on a corrupt frame requests resync and keeps last good', () => {
    const h = harness();
    h.sock().open();
    const state = createState(1);
    const bytes = encodeSnapshot(state, null);
    h.sock().msg(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const states = () => h.events.filter((e) => e.kind === 'state');
    expect(states()).toHaveLength(1);
    h.sock().msg(new Uint8Array([1, 2, 3]).buffer);
    expect(states()).toHaveLength(1);
    expect(h.sock().sent.map((s) => JSON.parse(s))).toEqual([{ t: 'resync' }]);
    // session still alive: a later good frame decodes
    h.sock().msg(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    expect(states()).toHaveLength(2);
  });

  it('counts down the reconnect grace and closes after it expires', () => {
    const h = harness();
    h.sock().open();
    h.sock().drop();
    const conns = () =>
      h.events.filter((e) => e.kind === 'connection') as Extract<SessionEvent, { kind: 'connection' }>[];
    expect(conns().at(-1)).toMatchObject({ status: 'reconnecting', graceSecondsLeft: RECONNECT_GRACE_S });
    h.advance(RECONNECT_RETRY_MS);
    h.sock().drop();
    expect(conns().at(-1)).toMatchObject({ status: 'reconnecting', graceSecondsLeft: RECONNECT_GRACE_S });
    h.advance(RECONNECT_RETRY_MS);
    expect(conns().at(-1)!.graceSecondsLeft).toBeLessThan(RECONNECT_GRACE_S);
    for (let i = 0; i < 40 && conns().at(-1)!.status !== 'closed'; i++) {
      h.sock().drop();
      h.advance(RECONNECT_RETRY_MS);
    }
    expect(conns().at(-1)).toMatchObject({ status: 'closed', graceSecondsLeft: 0 });
    const count = FakeSocket.all.length;
    h.advance(5000);
    expect(FakeSocket.all).toHaveLength(count);
  });

  it('resumes as connected after a successful reconnect', () => {
    const h = harness();
    h.sock().open();
    h.sock().drop();
    h.advance(RECONNECT_RETRY_MS);
    h.sock().open();
    expect(h.events.at(-1)).toMatchObject({ kind: 'connection', status: 'connected' });
  });

  it('maps close codes to errors', () => {
    const bad = harness();
    bad.sock().open();
    bad.sock().drop(CLOSE_BAD_CODE);
    expect(bad.events.at(-1)).toEqual({ kind: 'error', error: 'bad_code' });
    bad.advance(5000);
    expect(FakeSocket.all).toHaveLength(1);

    const full = harness();
    full.sock().drop(CLOSE_ROOM_FULL);
    expect(full.events.at(-1)).toEqual({ kind: 'error', error: 'room_full' });
  });

  it('reports unreachable when closed before ever opening, without retrying', () => {
    const h = harness();
    h.sock().drop(1006);
    expect(h.events.at(-1)).toEqual({ kind: 'error', error: 'unreachable' });
    h.advance(5000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('dispose closes the socket and stops retries', () => {
    const h = harness();
    h.sock().open();
    const s = h.sock();
    h.session.dispose();
    expect(s.closed).toBe(true);
    h.advance(5000);
    expect(FakeSocket.all).toHaveLength(1);
  });
});

describe('fetchNewRoomCode', () => {
  const ok = (body: unknown, good = true) => async () => ({ ok: good, json: async () => body });
  it('resolves a valid code', async () => {
    await expect(fetchNewRoomCode(ok({ code: 'AB12' }))).resolves.toBe('AB12');
  });
  it('rejects on http failure or invalid code', async () => {
    await expect(fetchNewRoomCode(ok({}, false))).rejects.toThrow();
    await expect(fetchNewRoomCode(ok({ code: 'abc' }))).rejects.toThrow();
    await expect(fetchNewRoomCode(ok({ code: 5 }))).rejects.toThrow();
  });
});
