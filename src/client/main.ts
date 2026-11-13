import * as sim from '../sim';
import { Game } from './game';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
const game = new Game(root);

// Dev only: lets the Playwright check drive and read the game. Stripped from production builds.
if (import.meta.env.DEV) {
  (window as unknown as { __game?: Game; __sim?: typeof sim }).__game = game;
  (window as unknown as { __sim?: typeof sim }).__sim = sim;
}
