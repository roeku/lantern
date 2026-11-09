/**
 * Server entry. Run with: pnpm server   (PORT=2568 by default)
 * Put a free tunnel in front: cloudflared tunnel --url http://localhost:2568
 */
import { RoomManager } from './room-manager';
import { WsTransport } from './ws-transport';

export const DEFAULT_PORT = 2568;
const port = Number(process.env.PORT ?? DEFAULT_PORT);

const rooms = new RoomManager();
const transport = new WsTransport();

try {
  await transport.listen(port, rooms, rooms);
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    console.error(`lantern server: port ${port} is already in use`);
  } else {
    console.error(`lantern server failed to start on port ${port}:`, err);
  }
  process.exit(1);
}
rooms.start();
console.log(`lantern server listening on ws://localhost:${port}/r/<CODE>`);

function shutdown(): void {
  rooms.stop();
  void transport.close().then(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
