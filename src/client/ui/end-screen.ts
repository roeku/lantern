/**
 * End screen: outcome, stats, recap list, top-down replay and a play-again control.
 */
import { TUNING, type Outcome, type Recap, type ReplayFrame, type Tuning } from '../../sim';
import { createReplayCanvas } from './replay-canvas';
import { createReplayController } from './replay-controller';

export interface EndScreenOptions {
  outcome: Outcome;
  frames: readonly ReplayFrame[];
  recap: Recap;
  onPlayAgain: () => void;
  /** Label for the play-again control, e.g. when a rematch is pending. */
  playAgainLabel?: string;
  tuning?: Tuning;
}

export interface EndScreen {
  /** Change the play-again label and disabled state (e.g. "Waiting for the others"). */
  setPlayAgain(label: string, disabled: boolean): void;
  destroy(): void;
}

const REASON_TEXT: Record<Outcome['reason'], string> = {
  all_candles_snuffed: 'Every candle was snuffed.',
  time_up: 'The show ran its full length.',
  all_ropes_cut: 'Every rope was cut and the screen fell.',
};

const MS_PER_S = 1000;
const S_PER_MIN = 60;

export function formatElapsed(tick: number, tuning: Tuning = TUNING): string {
  const total = Math.floor(tick * tuning.tickS);
  const m = Math.floor(total / S_PER_MIN);
  const s = total % S_PER_MIN;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  parent?.appendChild(node);
  return node;
}

function button(parent: HTMLElement, label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', 'ui-button', parent, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export function createEndScreen(parent: HTMLElement, opts: EndScreenOptions): EndScreen {
  const tuning = opts.tuning ?? TUNING;
  const { outcome, recap, frames } = opts;
  const root = el('section', 'screen end-screen', parent);
  root.setAttribute('aria-labelledby', 'end-title');

  const winner = outcome.winner === 'showman' ? 'The Showman wins' : 'The Audience wins';
  const title = el('h1', 'screen-title', root, winner);
  title.id = 'end-title';
  el('p', 'screen-sub', root, REASON_TEXT[outcome.reason]);

  const stats = el('dl', 'end-stats', root);
  const addStat = (label: string, value: string): void => {
    const box = el('div', 'end-stat', stats);
    el('dt', 'hud-label', box, label);
    el('dd', 'hud-value', box, value);
  };
  addStat('Time', formatElapsed(outcome.tick, tuning));
  addStat('Ropes cut', `${recap.ropeCuts.length}/${tuning.ropeCount}`);
  addStat('Candles snuffed', `${recap.snuffs.length}`);
  addStat('Near misses', `${recap.nearMisses}`);

  const events = [
    ...recap.snuffs.map((e) => ({ tick: e.tick, text: `Candle ${e.candleId + 1} snuffed` })),
    ...recap.ropeCuts.map((e) => ({ tick: e.tick, text: `Rope ${e.ropeId + 1} cut` })),
  ].sort((a, b) => a.tick - b.tick);
  const list = el('ul', 'end-recap', root);
  list.setAttribute('aria-label', 'Recap');
  if (events.length === 0) el('li', 'end-recap-item', list, 'Nothing fell and nothing went dark.');
  for (const e of events) {
    const li = el('li', 'end-recap-item', list);
    el('span', 'hud-kbd', li, formatElapsed(e.tick, tuning));
    el('span', 'hud-desc', li, e.text);
  }

  // Replay
  const replayBox = el('div', 'end-replay', root);
  const canvas = createReplayCanvas(replayBox, tuning);
  const controller = createReplayController(frames.length, tuning);
  const controls = el('div', 'end-replay-controls', replayBox);
  const pauseBtn = button(controls, 'Pause', () => {
    controller.toggle();
    sync();
  });
  button(controls, 'Restart', () => {
    controller.restart();
    sync();
  });
  const speedBtn = button(controls, '1x', () => {
    controller.setSpeed(controller.speed === 1 ? 2 : 1);
    sync();
  });
  speedBtn.setAttribute('aria-label', 'Replay speed');
  const sync = (): void => {
    pauseBtn.textContent = controller.paused ? 'Resume' : 'Pause';
    speedBtn.textContent = `${controller.speed}x`;
  };

  const again = button(root, opts.playAgainLabel ?? 'Play again', opts.onPlayAgain);
  again.classList.add('end-again');

  let raf = 0;
  let lastMs: number | null = null;
  const loop = (now: number): void => {
    const dt = lastMs === null ? 0 : Math.min(now - lastMs, MS_PER_S);
    lastMs = now;
    controller.advance(dt);
    const frame = frames[controller.frameIndex];
    if (frame) canvas.draw(frame, recap);
    raf = requestAnimationFrame(loop);
  };
  if (frames.length > 0) raf = requestAnimationFrame(loop);
  sync();
  again.focus();

  return {
    setPlayAgain(label, disabled) {
      again.textContent = label;
      again.disabled = disabled;
    },
    destroy() {
      cancelAnimationFrame(raf);
      canvas.destroy();
      root.remove();
    },
  };
}
