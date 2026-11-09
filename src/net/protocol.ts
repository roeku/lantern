/**
 * Wire protocol shared by client and server. Types plus a JSON codec.
 * Control messages are JSON text frames. Snapshots are binary frames, see snapshot-codec.ts.
 * Imports sim types only.
 */

import type { Input, PlayerId, Recap, ReplayFrame } from '../sim';

/** Distributive Omit so each Input variant keeps its own fields. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** What a client may send. The server stamps the player id from the seat. */
export type ClientInput = DistributiveOmit<Exclude<Input, { kind: 'snuff' }>, 'player'>;

export type Phase = 'lobby' | 'playing' | 'ended';
export type Role = 'showman' | 'spectator';
export type SeatKind = 'human' | 'bot' | 'open';

export interface SeatInfo {
  seat: number;
  kind: SeatKind;
  role: Role;
  connected: boolean;
}

export interface Roster {
  phase: Phase;
  showman: number;
  seats: SeatInfo[];
  rematchPending: boolean;
  graceTicksLeft: (number | null)[];
}

export type ClientMessage =
  | { t: 'in'; input: ClientInput }
  | { t: 'start' }
  | { t: 'rematch' }
  | { t: 'resync' }
  | { t: 'ping'; ts: number };

export type ServerMessage =
  | { t: 'hello'; player: PlayerId; role: Role; token: string; code: string; phase: Phase }
  | ({ t: 'roster' } & Roster)
  | { t: 'log'; frames: ReplayFrame[]; recap: Recap }
  | { t: 'pong'; ts: number };

/** Input kinds a client may send. `snuff` is decided by the sim, never by a client. */
export const CLIENT_INPUT_KINDS: readonly string[] = [
  'puff', 'roll', 'rush', 'aim', 'fan', 'shield', 'unshield', 'light', 'move', 'cut',
];

export const ROOM_CODE_PATTERN = /^[A-Z0-9]{4}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Parse and shape-check one client frame. Returns null for anything malformed. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  if (value.t === 'ping' && typeof value.ts === 'number' && Number.isFinite(value.ts)) {
    return { t: 'ping', ts: value.ts };
  }
  if (value.t === 'start' || value.t === 'rematch' || value.t === 'resync') return { t: value.t };
  if (value.t === 'in' && isRecord(value.input)) {
    const kind = value.input.kind;
    if (typeof kind !== 'string' || !CLIENT_INPUT_KINDS.includes(kind)) return null;
    if (kind === 'move' && !(isFiniteNumber(value.input.dx) && isFiniteNumber(value.input.dy))) return null;
    if (kind === 'cut' && !Number.isInteger(value.input.rope)) return null;
    // Other kinds: the sim ignores unusable values. Cast: kind is whitelisted above.
    return { t: 'in', input: value.input as unknown as ClientInput };
  }
  return null;
}

export function encodeServerMessage(msg: ServerMessage): string {
  return JSON.stringify(msg);
}
