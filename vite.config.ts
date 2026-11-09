import { defineConfig } from 'vite';

const target = `http://localhost:${process.env.PORT ?? 2568}`;

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      // /r/<code> is both the WebSocket endpoint and the page route.
      '/r': {
        target,
        ws: true,
        bypass(req) {
          if (req.headers.upgrade === 'websocket') return undefined;
          return '/index.html';
        },
      },
      '/log': { target, ws: true },
      '/new': { target, ws: true },
    },
  },
});
