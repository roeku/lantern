/** Maximum steps returned by one `advance` call: two seconds at 20 Hz. */
export const MAX_CATCH_UP_TICKS = 40;

export interface FixedStepClock {
  /** Returns how many steps are due at `nowMs`, and advances the internal due time. */
  advance(nowMs: number): number;
}

/**
 * Pure fixed-step clock. The first step is due at `startMs + stepMs`.
 * If more than `maxCatchUp` steps are due, the surplus is dropped and pacing
 * resumes from `nowMs + stepMs`.
 */
export function createFixedStepClock(
  startMs: number,
  stepMs: number,
  maxCatchUp: number,
): FixedStepClock {
  let nextDueMs = startMs + stepMs;
  return {
    advance(nowMs: number): number {
      if (nowMs < nextDueMs) return 0;
      const due = Math.floor((nowMs - nextDueMs) / stepMs) + 1;
      if (due > maxCatchUp) {
        nextDueMs = nowMs + stepMs;
        return maxCatchUp;
      }
      nextDueMs += due * stepMs;
      return due;
    },
  };
}
