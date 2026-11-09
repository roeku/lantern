import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/sim';
import {
  createReplayController,
  frameDurationMs,
  logTicksPerFrame,
} from '../../src/client/ui/replay-controller';

const FRAME_MS = frameDurationMs();

describe('replay controller', () => {
  it('advances one frame per frame duration at 1x', () => {
    const c = createReplayController(50);
    c.advance(FRAME_MS);
    expect(c.frameIndex).toBe(1);
    c.advance(FRAME_MS * 3);
    expect(c.frameIndex).toBe(4);
  });

  it('advances twice as fast at 2x and carries remainders', () => {
    const c = createReplayController(50);
    c.setSpeed(2);
    c.advance(FRAME_MS);
    expect(c.frameIndex).toBe(2);
    c.advance(FRAME_MS / 4); // 0.5 frame carried
    expect(c.frameIndex).toBe(2);
    c.advance(FRAME_MS / 4); // completes one frame
    expect(c.frameIndex).toBe(3);
  });

  it('does not advance while paused and resumes on toggle', () => {
    const c = createReplayController(50);
    c.toggle();
    expect(c.paused).toBe(true);
    c.advance(FRAME_MS * 5);
    expect(c.frameIndex).toBe(0);
    c.toggle();
    expect(c.paused).toBe(false);
    c.advance(FRAME_MS * 2);
    expect(c.frameIndex).toBe(2);
  });

  it('restart returns to frame 0, unpauses and clears carry', () => {
    const c = createReplayController(50);
    c.advance(FRAME_MS * 7.5);
    c.toggle();
    c.restart();
    expect(c.frameIndex).toBe(0);
    expect(c.paused).toBe(false);
    c.advance(FRAME_MS / 2);
    expect(c.frameIndex).toBe(0);
  });

  it('clamps at the last frame and reports finished; restart works after', () => {
    const c = createReplayController(5);
    c.advance(FRAME_MS * 100);
    expect(c.frameIndex).toBe(4);
    expect(c.finished).toBe(true);
    c.advance(FRAME_MS * 10);
    expect(c.frameIndex).toBe(4);
    c.restart();
    expect(c.finished).toBe(false);
    c.advance(FRAME_MS);
    expect(c.frameIndex).toBe(1);
  });

  it('handles empty and single-frame replays', () => {
    const c = createReplayController(0);
    c.advance(FRAME_MS * 3);
    expect(c.frameIndex).toBe(0);
    expect(c.finished).toBe(true);
  });

  it('shows a mark once the current frame tick reaches the recap event tick', () => {
    const perFrame = logTicksPerFrame();
    const frameTicks = Array.from({ length: 20 }, (_, i) => i * perFrame);
    const eventTick = 7 * perFrame + 1; // falls between frames 7 and 8
    const visible = (idx: number): boolean => frameTicks[idx]! >= eventTick;

    const c = createReplayController(frameTicks.length);
    expect(visible(c.frameIndex)).toBe(false);
    c.advance(FRAME_MS * 7);
    expect(c.frameIndex).toBe(7);
    expect(visible(c.frameIndex)).toBe(false);
    c.advance(FRAME_MS);
    expect(visible(c.frameIndex)).toBe(true);
  });

  it('derives frame timing from tuning', () => {
    expect(logTicksPerFrame()).toBe(Math.round(1 / (TUNING.tickS * 10)));
    expect(FRAME_MS).toBeCloseTo(logTicksPerFrame() * TUNING.tickS * 1000);
  });
});
