/**
 * NetSession: GameSession over a WebSocket to the authoritative server.
 * All environment access (WebSocket, storage, timers, location, clock) is injected for tests.
 * Navigation stays with the app; `fetchNewRoomCode` only asks the server for a code.
 */

import { ROOM_CODE_PATTERN, type ClientInput, type ClientMessage, type ServerMessage } from '../../net/protocol';
import { SnapshotCodecError, decodeSnapshot } from '../../net/snapshot-codec';
import type { State } from '../../sim';
import type { GameSession, SessionEvent } from './session';
import { wsUrl, type LocationLike } from './ws-url';

export const RECONNECT_RETRY_MS = 500;
export const RECONNECT_GRACE_S = 10;
export const CLOSE_BAD_CODE = 4000;
export const CLOSE_ROOM_FULL = 4001;
export const TOKEN_KEY_PREFIX = 'lantern.seat.';

const WS_OPEN = 1;

export interface SocketLike {
  binaryType: string;
  readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  send(data: string): void;
  close(code?: number): void;
}
export type SocketCtor = new (url: string) => SocketLike;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface NetSessionDeps {
  WebSocketCtor: SocketCtor;
  storage: StorageLike;
  location: LocationLike;
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export function defaultNetDeps(): NetSessionDeps {
  return {
    WebSocketCtor: WebSocket as unknown as SocketCtor,
    storage: sessionStorage,
    location,
    now: () => performance.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
}

export class NetSession implements GameSession {
  private readonly listeners = new Set<(e: SessionEvent) => void>();
  private socket: SocketLike | null = null;
  private lastGood: State | null = null;
  private everOpened = false;
  private disposed = false;
  private finished = false;
  private reconnectStartMs: number | null = null;
  private retryTimer: unknown = null;

  constructor(
    private readonly code: string,
    private readonly deps: NetSessionDeps = defaultNetDeps(),
  ) {
    this.connect();
  }

  subscribe(listener: (e: SessionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  sendInput(input: ClientInput): void {
    this.send({ t: 'in', input });
  }

  start(): void {
    this.send({ t: 'start' });
  }

  rematch(): void {
    this.send({ t: 'rematch' });
  }

  dispose(): void {
    this.disposed = true;
    this.cancelRetry();
    const s = this.socket;
    this.socket = null;
    if (s !== null) {
      s.onopen = s.onmessage = s.onclose = s.onerror = null;
      s.close();
    }
    this.listeners.clear();
  }

  private emit(e: SessionEvent): void {
    for (const l of [...this.listeners]) l(e);
  }

  private tokenKey(): string {
    return TOKEN_KEY_PREFIX + this.code;
  }

  private send(msg: ClientMessage): void {
    const s = this.socket;
    if (s !== null && s.readyState === WS_OPEN) s.send(JSON.stringify(msg));
  }

  private connect(): void {
    if (this.disposed || this.finished) return;
    const token = this.deps.storage.getItem(this.tokenKey());
    const socket = new this.deps.WebSocketCtor(wsUrl(this.deps.location, this.code, token));
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    let opened = false;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      opened = true;
      this.everOpened = true;
      this.reconnectStartMs = null;
      // The server answers a (re)join with a full Snapshot, so drop the old baseline.
      this.lastGood = null;
      this.emit({ kind: 'connection', status: 'connected', graceSecondsLeft: RECONNECT_GRACE_S });
    };
    socket.onmessage = (ev) => {
      if (this.socket !== socket) return;
      this.onMessage(ev.data);
    };
    socket.onclose = (ev) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.onClose(ev.code, opened);
    };
    socket.onerror = () => {
      // A close event always follows; handling happens there.
    };
  }

  private onMessage(data: unknown): void {
    if (typeof data === 'string') {
      this.onText(data);
      return;
    }
    let bytes: Uint8Array | null = null;
    if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else if (ArrayBuffer.isView(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (bytes === null) return;
    try {
      const state = decodeSnapshot(bytes, this.lastGood);
      this.lastGood = state;
      this.emit({ kind: 'state', state, receivedAtMs: this.deps.now() });
    } catch (err) {
      if (err instanceof SnapshotCodecError) {
        // Keep the last good State and ask for a full frame.
        this.send({ t: 'resync' });
        return;
      }
      throw err;
    }
  }

  private onText(raw: string): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    if (typeof msg !== 'object' || msg === null) return;
    switch (msg.t) {
      case 'hello':
        if (typeof msg.token === 'string') this.deps.storage.setItem(this.tokenKey(), msg.token);
        this.emit({ kind: 'hello', player: msg.player, role: msg.role, code: msg.code, phase: msg.phase });
        break;
      case 'roster': {
        const { t: _t, ...roster } = msg;
        this.emit({ kind: 'roster', roster });
        break;
      }
      case 'log':
        this.emit({ kind: 'log', frames: msg.frames, recap: msg.recap });
        break;
      case 'pong':
        break;
    }
  }

  private onClose(code: number, opened: boolean): void {
    if (this.disposed || this.finished) return;
    if (code === CLOSE_BAD_CODE) {
      this.finish({ kind: 'error', error: 'bad_code' });
      return;
    }
    if (code === CLOSE_ROOM_FULL) {
      this.finish({ kind: 'error', error: 'room_full' });
      return;
    }
    if (!this.everOpened) {
      this.finish({ kind: 'error', error: 'unreachable' });
      return;
    }
    if (this.reconnectStartMs === null) {
      this.reconnectStartMs = this.deps.now();
      this.emit({ kind: 'connection', status: 'reconnecting', graceSecondsLeft: RECONNECT_GRACE_S });
    }
    void opened;
    this.scheduleRetry();
  }

  private finish(e: SessionEvent): void {
    this.finished = true;
    this.cancelRetry();
    this.emit(e);
  }

  private scheduleRetry(): void {
    this.cancelRetry();
    this.retryTimer = this.deps.setTimeout(() => {
      this.retryTimer = null;
      this.retry();
    }, RECONNECT_RETRY_MS);
  }

  private cancelRetry(): void {
    if (this.retryTimer !== null) {
      this.deps.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private retry(): void {
    if (this.disposed || this.finished) return;
    const elapsedS = (this.deps.now() - (this.reconnectStartMs ?? this.deps.now())) / 1000;
    if (elapsedS >= RECONNECT_GRACE_S) {
      this.finished = true;
      this.emit({ kind: 'connection', status: 'closed', graceSecondsLeft: 0 });
      return;
    }
    this.emit({
      kind: 'connection',
      status: 'reconnecting',
      graceSecondsLeft: Math.max(0, Math.ceil(RECONNECT_GRACE_S - elapsedS)),
    });
    this.connect();
  }
}

/** GET /new on the page origin. Resolves to a valid Room_Code or rejects. The app navigates. */
export async function fetchNewRoomCode(
  fetchFn: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }> = (u) => fetch(u),
  url = '/new',
): Promise<string> {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error('could not create a room');
  const body = (await res.json()) as { code?: unknown };
  if (typeof body.code !== 'string' || !ROOM_CODE_PATTERN.test(body.code)) {
    throw new Error('server returned a bad room code');
  }
  return body.code;
}
