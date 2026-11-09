import net from 'node:net';
import { spawn } from 'node:child_process';

const port = Number(process.env.PORT ?? 2568);

const probe = net.createServer();
probe.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`port ${port} is already in use`);
  } else {
    console.error(err.message);
  }
  process.exit(1);
});
probe.listen(port, () => probe.close(start));

function start() {
  const env = { ...process.env, PORT: String(port) };
  const children = [
    spawn('npx', ['tsx', 'src/server/index.ts'], { env, stdio: 'inherit' }),
    spawn('npx', ['vite'], { env, stdio: 'inherit' }),
  ];
  let stopping = false;
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    for (const c of children) if (c.exitCode === null) c.kill('SIGTERM');
    setTimeout(() => process.exit(code), 300).unref();
  };
  for (const c of children) {
    c.on('exit', (code) => stop(code ?? 0));
  }
  process.on('SIGINT', () => stop(0));
  process.on('SIGTERM', () => stop(0));
  process.on('exit', () => {
    for (const c of children) if (c.exitCode === null) c.kill('SIGTERM');
  });
  console.log('Lantern dev: http://localhost:5173');
}
