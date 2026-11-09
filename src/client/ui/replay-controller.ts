/**
 * Pure replay playback state. No DOM, no clocks: the caller passes elapsed milliseconds.
 * Frames arrive at the log rate (LOG_RATE_HZ), which is every LOG_TICKS_PER_FRAME sim Ticks.
 */
import { TUNING, type Tuning } from '../../sim';

/** State_Log rate in frames per second (matches the server's record cadence). */
export const LOG_RATE_HZ = 10;
const MS_PER_S = 1000;

/** Sim ticks between two logged frames, derived from tuning. */
export function logTicksPerFrame(tuning: Tuning = TUNING): number {
  return Math.max(1, Math.round(1 / (tuning.tickS * LOG_RATE_HZ)));
}

/** Wall milliseconds one frame lasts at 1x. */
export function frameDurationMs(tuning: Tuning = TUNING): number {
  return logTicksPerFrame(tuning) * tuning.tickS * MS_PER_S;
}

export type ReplaySpeed = 1 | 2;

export interface ReplayController {
  readonly frameIndex: number;
  readonly paused: boolean;
  readonly speed: ReplaySpeed;
  readonly frameCount: number;
  /** True once playback sits on the last frame. */
  readonly finished: boolean;
  advance(dtMs: number): void;
  restart(): void;
  toggle(): void;
  setSpeed(speed: ReplaySpeed): void;
}

export function createReplayController(frameCount: number, tuning: Tuning = TUNING): ReplayController {
  const last = Math.max(0, frameCount - 1);
  const perFrameMs = frameDurationMs(tuning);
  let frameIndex = 0;
  let paused = false;
  let speed: ReplaySpeed = 1;
  let carryMs = 0;

  return {
    get frameIndex() {
      return frameIndex;
    },
    get paused() {
      return paused;
    },
    get speed() {
      return speed;
    },
    get frameCount() {
      return frameCount;
    },
    get finished() {
      return frameIndex >= last;
    },
    advance(dtMs: number): void {
      if (paused || !(dtMs > 0) || frameIndex >= last) return;
      carryMs += dtMs * speed;
      const steps = Math.floor(carryMs / perFrameMs);
      if (steps > 0) {
        carryMs -= steps * perFrameMs;
        frameIndex = Math.min(last, frameIndex + steps);
      }
      if (frameIndex >= last) carryMs = 0;
    },
    restart(): void {
      frameIndex = 0;
      carryMs = 0;
      paused = false;
    },
    toggle(): void {
      paused = !paused;
    },
    setSpeed(next: ReplaySpeed): void {
      speed = next;
    },
  };
}
