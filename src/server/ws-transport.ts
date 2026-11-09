/**
 * Transport backed by the `ws` package.
 * Join by link maps to the upgrade path /r/ABCD (optional ?token=... to resume a seat).
 * The same HTTP server answers GET /new and GET /log/<CODE>; anything else is 404.
 */
import { createServer, type Server, type ServerResponse } from 'node:http';
import { WebSocketServer, type RawData } from 'ws';
import { ROOM_CODE_PATTERN } from '../net/protocol';
import {
  CLOSE_BAD_CODE,
  type Connection,
  type HttpHandlers,
  type Transport,
  type TransportHandlers,
} from './transport';

/** Largest frame accepted from a client, in bytes. */
const MAX_PAYLOAD_BYTES = 1024;
const WS_PATH_PATTERN = /^\/r\/([^/]*)$/;
const LOG_PATH_PATTERN = /^\/log\/([^/]*)$/;
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_METHOD_NOT_ALLOWED = 405;

function rawToString(data: RawData): string {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data as ArrayBuffer).toString('utf8');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export class WsTransport implements Transport {
  private http: Server | null = null;
  private wss: WebSocketServer | null = null;

  listen(port: number, handlers: TransportHandlers, httpHandlers: HttpHandlers): Promise<void> {
    const http = createServer((req, res) => {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      if (req.method !== 'GET') {
        sendJson(res, HTTP_METHOD_NOT_ALLOWED, { error: 'method not allowed' });
        return;
      }
      if (path === '/new') {
        sendJson(res, HTTP_OK, { code: httpHandlers.newRoomCode() });
        return;
      }
      const logMatch = LOG_PATH_PATTERN.exec(path);
      if (logMatch !== null) {
        const code = safeDecode(logMatch[1] ?? '');
        const log = ROOM_CODE_PATTERN.test(code) ? httpHandlers.roomLog(code) : null;
        if (log === null) sendJson(res, HTTP_NOT_FOUND, { error: 'no log' });
        else sendJson(res, HTTP_OK, log);
        return;
      }
      sendJson(res, HTTP_NOT_FOUND, { error: 'not found' });
    });
    const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });
    this.http = http;
    this.wss = wss;

    http.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const match = WS_PATH_PATTERN.exec(url.pathname);
      if (match === null) {
        socket.destroy();
        return;
      }
      const code = safeDecode(match[1] ?? '');
      const token = url.searchParams.get('token');
      wss.handleUpgrade(req, socket, head, (ws) => {
        if (!ROOM_CODE_PATTERN.test(code)) {
          ws.close(CLOSE_BAD_CODE, 'bad room code');
          return;
        }
        const conn: Connection = {
          send: (data) => {
            if (ws.readyState === ws.OPEN) ws.send(data);
          },
          close: (closeCode, reason) => ws.close(closeCode, reason),
        };
        const h = handlers.onConnect(code, token, conn);
        if (h === null) return;
        ws.on('message', (data) => h.onMessage(rawToString(data)));
        ws.on('close', () => h.onClose());
        ws.on('error', () => ws.terminate());
      });
    });

    return new Promise((resolve, reject) => {
      http.once('error', reject);
      http.listen(port, () => resolve());
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss?.clients.forEach((c) => c.terminate());
      this.wss?.close();
      if (this.http === null) resolve();
      else this.http.close(() => resolve());
    });
  }
}
