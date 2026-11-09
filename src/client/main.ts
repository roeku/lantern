import './ui/styles.css';
import { App, type SessionTarget } from './app';

const ROOM_PATH = /^\/r\/([^/]+)\/?$/;

function initialTarget(): SessionTarget | null {
  const m = ROOM_PATH.exec(location.pathname);
  return m ? { kind: 'join', code: m[1]!.toUpperCase() } : null;
}

const root = document.getElementById('root');
if (root === null) throw new Error('missing #root element');
new App(root).run(initialTarget());
