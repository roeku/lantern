import { NEUTRAL_INPUT, step } from '../../src/sim';
import type { SimInput, SimState, Vec2 } from '../../src/sim';

export const TICKS_PER_SEC = 60;

export function at(state: SimState, x: number, y: number, yaw = 0): SimState {
  return { ...state, player: { ...state.player, pos: { x, y }, vel: { x: 0, y: 0 }, yawRad: yaw } };
}

export function run(state: SimState, input: SimInput, ticks: number): SimState {
  let s = state;
  for (let i = 0; i < ticks && !s.won; i++) s = step(s, input);
  return s;
}

export function wait(state: SimState, sec: number, input: Partial<SimInput> = {}): SimState {
  return run(state, { ...NEUTRAL_INPUT, ...input }, Math.round(sec * TICKS_PER_SEC));
}

/** Walks (or sprints) through each waypoint in turn. Stops a leg early when it gets there. */
export function drive(state: SimState, waypoints: readonly Vec2[], sprint = false, legSec = 12): SimState {
  let s = state;
  for (const w of waypoints) {
    for (let i = 0; i < legSec * TICKS_PER_SEC && !s.won; i++) {
      const dx = w.x - s.player.pos.x;
      const dy = w.y - s.player.pos.y;
      if (Math.hypot(dx, dy) < 0.3) break;
      s = step(s, { ...NEUTRAL_INPUT, yawRad: Math.atan2(-dx, -dy), moveZ: 1, sprint });
    }
  }
  return s;
}

/** One tick with record pressed, then one with it released, so the next press is a new edge. */
export function tapRecord(state: SimState): SimState {
  const pressed = step(state, { ...NEUTRAL_INPUT, yawRad: state.player.yawRad, record: true });
  return step(pressed, { ...NEUTRAL_INPUT, yawRad: state.player.yawRad });
}
