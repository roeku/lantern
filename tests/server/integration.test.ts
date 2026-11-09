/**
 * Server integration: four simulated clients over the real `ws` transport on an ephemeral port.
 * Covers roster, snapshot rate, token reconnect, bad-code close, GET /new and GET /log/<CODE>.
 * Real time paces the first part; the rest of the Round is driven by tickAll() so it ends quickly.
 */
import { createServer } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { ROOM_CODE_PATTERN, type ServerMessage } from '../../src/net/protocol';
import { decodeSnapshot } from '../../src/net/snapshot-codec';
import { RoomManager } from '../../src/server/room-manager';
import { CLOSE_BAD_CODE } from '../../src/server/transport';
import { WsTransport } from '../../src/server/ws-transport';
import type { State } from '../../src/sim';

const CODE = 'ABCD';
const RATE_WINDOW_MS = 3000;
const MIN_SNAPSHOTS_PER_S = 19;
const WAIT_MS = 5000;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const yieldLoop = () => new Promise<void>((r) => setImmediate(r));

async function waitFor(cond: () => boolean, what: string, ms = WAIT_MS): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(5);
  }
}

class Client {
  ws: WebSocket;
  messages: ServerMessage[] = [];
  state: State | null = null;
  frames = 0;
  firstFrameFull: boolean | null = null;
  closeCode: number | null = null;
  decodeError: unknown = null;
  opened: Promise<void>;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'nodebuffer';
    this.opened = new Promise((resolve) => {
      this.ws.once('open', () => resolve());
      this.ws.once('close', () => resolve());
    });
    this.ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const bytes = new Uint8Array(data as Buffer);
        try {
          // Throws if the frame is a delta and we hold no baseline: proves a resumed seat gets a full frame.
          this.state = decodeSnapshot(bytes, this.state);
          if (this.firstFrameFull === null) this.firstFrameFull = true;
        } catch (err) {
          this.decodeError = err;
          if (this.firstFrameFull === null) this.firstFrameFull = false;
        }
        this.frames++;
      } else {
        this.messages.push(JSON.parse(String(data)) as ServerMessage);
      }
    });
    this.ws.on('close', (code) => {
      this.closeCode = code;
    });
    this.ws.on('error', () => undefined);
  }

  hello() {
    const m = this.messages.find((x) => x.t === 'hello');
    if (m?.t !== 'hello') throw new Error('no hello');
    return m;
  }

  lastRoster() {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const m = this.messages[i]!;
      if (m.t === 'roster') return m;
    }
    return null;
  }

  send(obj: unknown): void {
    this.ws.send(JSON.stringify(obj));
  }
}

describe('server integration (real ws transport)', () => {
  let port = 0;
  let rooms: RoomManager;
  let transport: WsTransport;
  const clients: Client[] = [];

  const wsUrl = (code: string, token?: string) =>
    `ws://127.0.0.1:${port}/r/${code}${token ? `?token=${token}` : ''}`;
  const httpUrl = (path: string) => `http://127.0.0.1:${port}${path}`;

  async function connect(code: string, token?: string): Promise<Client> {
    const c = new Client(wsUrl(code, token));
    clients.push(c);
    await c.opened;
    return c;
  }

  beforeAll(async () => {
    port = await freePort();
    rooms = new RoomManager();
    transport = new WsTransport();
    await transport.listen(port, rooms, rooms);
    rooms.start();
  });

  afterAll(async () => {
    rooms.stop();
    clients.forEach((c) => c.ws.terminate());
    await transport.close();
  });

  it('plays a short Round end to end', async () => {
    // GET /new returns a valid, unused code.
    const created = await (await fetch(httpUrl('/new'))).json() as { code: string };
    expect(ROOM_CODE_PATTERN.test(created.code)).toBe(true);

    // Bad room code: server closes with 4000.
    const bad = await connect('abc');
    await waitFor(() => bad.closeCode !== null, 'bad-code close');
    expect(bad.closeCode).toBe(CLOSE_BAD_CODE);

    // Unknown paths and unknown logs are 404.
    expect((await fetch(httpUrl('/nope'))).status).toBe(404);
    expect((await fetch(httpUrl('/log/ZZZZ'))).status).toBe(404);

    // Four clients join: roster shows four humans, seat 0 is the Showman.
    const four: Client[] = [];
    for (let i = 0; i < 4; i++) four.push(await connect(CODE));
    await waitFor(
      () => four.every((c) => c.lastRoster()?.seats.filter((s) => s.kind === 'human').length === 4),
      'full roster',
    );
    const roles = four.map((c) => c.hello().role);
    expect(roles).toEqual(['showman', 'spectator', 'spectator', 'spectator']);
    expect(four.map((c) => c.hello().player)).toEqual([0, 1, 2, 3]);
    const roster = four[0]!.lastRoster()!;
    expect(roster.phase).toBe('lobby');
    expect(roster.showman).toBe(0);
    expect(roster.seats.every((s) => s.connected)).toBe(true);

    // Showman starts the Round; everyone receives a full first snapshot.
    four[0]!.send({ t: 'start' });
    await waitFor(() => four.every((c) => c.state !== null), 'first snapshots');
    expect(four.every((c) => c.firstFrameFull === true)).toBe(true);
    expect(four[1]!.lastRoster()?.phase).toBe('playing');

    // Snapshot rate over a real-time window.
    const before = four[1]!.frames;
    await sleep(RATE_WINDOW_MS);
    const perSecond = (four[1]!.frames - before) / (RATE_WINDOW_MS / 1000);
    expect(perSecond).toBeGreaterThanOrEqual(MIN_SNAPSHOTS_PER_S);
    expect(four.every((c) => c.decodeError === null)).toBe(true);

    // Reconnect Spectator seat 2 with its Seat_Token: same seat, full Snapshot.
    const token = four[2]!.hello().token;
    four[2]!.ws.close();
    await waitFor(() => four[2]!.closeCode !== null, 'client close');
    await waitFor(() => four[0]!.lastRoster()?.seats[2]?.connected === false, 'seat marked disconnected');
    const back = await connect(CODE, token);
    await waitFor(() => back.state !== null, 'resumed snapshot');
    expect(back.hello().player).toBe(2);
    expect(back.hello().token).toBe(token);
    expect(back.hello().phase).toBe('playing');
    expect(back.firstFrameFull).toBe(true);
    expect(back.decodeError).toBeNull();
    four[2] = back;

    // Drive the rest of the Round without waiting 5 minutes of wall time.
    rooms.stop();
    const ended = () => four[0]!.lastRoster()?.phase === 'ended';
    for (let i = 0; i < 7000 && !ended(); i++) {
      rooms.tickAll();
      if (i % 100 === 0) await yieldLoop();
      if (i % 500 === 0) await sleep(1);
    }
    await waitFor(ended, 'round end', 10000);
    await waitFor(() => four.every((c) => c.messages.some((m) => m.t === 'log')), 'log message');

    // GET /log/<CODE> returns the whole Round.
    const res = await fetch(httpUrl(`/log/${CODE}`));
    expect(res.status).toBe(200);
    const log = (await res.json()) as { states: State[]; inputs: unknown[][] };
    expect(log.states.length).toBeGreaterThan(2);
    expect(log.inputs.length).toBeGreaterThan(0);
    const last = log.states[log.states.length - 1]!;
    expect(last.ended || last.outcome !== null).toBe(true);

    const pushed = four[0]!.messages.find((m) => m.t === 'log');
    expect(pushed?.t === 'log' && pushed.frames.length).toBe(log.states.length);
  }, 30000);
});
