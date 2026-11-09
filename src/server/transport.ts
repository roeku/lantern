import type { RoomLog } from './room';

/**
 * Small transport seam. The room logic only sees these interfaces,
 * so the WebSocket library stays swappable.
 */
export interface Connection {
  /** Text frames carry control messages, binary frames carry snapshots. */
  send(data: string | Uint8Array): void;
  close(code: number, reason: string): void;
}

/** Close code for a room code that does not match the code pattern. */
export const CLOSE_BAD_CODE = 4000;

export interface TransportHandlers {
  /** A client connected to room `code`. `token` is set when resuming a seat. Return the handlers for that connection. */
  onConnect(code: string, token: string | null, conn: Connection): ConnectionHandlers | null;
}

export interface ConnectionHandlers {
  onMessage(data: string): void;
  onClose(): void;
}

export interface HttpHandlers {
  /** GET /new -> {"code": "..."} */
  newRoomCode(): string;
  /** GET /log/<CODE> -> JSON, 404 when null */
  roomLog(code: string): RoomLog | null;
}

export interface Transport {
  listen(port: number, handlers: TransportHandlers, http: HttpHandlers): Promise<void>;
  close(): Promise<void>;
}
