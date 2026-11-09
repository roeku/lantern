/**
 * Session interface shared by NetSession and SoloSession.
 * Phase, Role, SeatInfo and Roster come from net/protocol.ts and are re-exported here.
 */

import type { Recap, ReplayFrame, State } from '../../sim';
import type { ClientInput, Phase, Role, Roster, SeatInfo, SeatKind } from '../../net/protocol';

export type { Phase, Role, SeatKind, SeatInfo, Roster };

export type SessionEvent =
  | { kind: 'hello'; player: number; role: Role; code: string; phase: Phase }
  | { kind: 'roster'; roster: Roster }
  | { kind: 'state'; state: State; receivedAtMs: number }
  | { kind: 'log'; frames: ReplayFrame[]; recap: Recap }
  | { kind: 'connection'; status: 'connected' | 'reconnecting' | 'closed'; graceSecondsLeft: number }
  | { kind: 'error'; error: 'bad_code' | 'room_full' | 'unreachable' };

export interface GameSession {
  subscribe(listener: (e: SessionEvent) => void): () => void;
  sendInput(input: ClientInput): void;
  start(): void;
  rematch(): void;
  dispose(): void;
}
