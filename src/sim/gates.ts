import { cellCenter } from './grid';
import { secToTicks, TUNING } from './tuning';
import { dist } from './vec2';
import type { Cell } from './grid';
import type { Level } from './level';
import type { Vec2 } from './vec2';

export interface Body {
  pos: Vec2;
  radiusM: number;
}

/** Distance from a point to the nearest edge of a cell. 0 inside it. */
function distToCell(p: Vec2, c: Cell): number {
  const dx = Math.max(c.cx - p.x, 0, p.x - (c.cx + 1));
  const dy = Math.max(c.cy - p.y, 0, p.y - (c.cy + 1));
  return Math.hypot(dx, dy);
}

/** One flag per plate: some body stands on it. */
export function platesDown(level: Level, bodies: readonly Vec2[]): boolean[] {
  return level.plates.map((pl) => bodies.some((b) => dist(b, cellCenter(pl.cell)) <= TUNING.plateRadiusM));
}

export interface GateUpdate {
  gates: boolean[];
  holdTicks: number[];
}

/**
 * A gate is open while every plate of its letter is held, for its own delaySec after that,
 * and for as long as anything is standing in it, so it never closes on a body.
 */
export function stepGates(
  level: Level,
  plates: readonly boolean[],
  holdTicks: readonly number[],
  bodies: readonly Body[],
): GateUpdate {
  const holds: number[] = [];
  const open = level.gates.map((g, i) => {
    const delay = secToTicks(g.delaySec);
    const mine = level.plates.map((p, k) => ({ p, down: plates[k] === true })).filter((x) => x.p.group === g.group);
    const satisfied = mine.length > 0 && mine.every((x) => x.down);
    const hold = satisfied ? delay : Math.max(0, (holdTicks[i] ?? 0) - 1);
    holds.push(hold);
    // Same test the walls use, so a body pressed against a closed gate never opens it, and a gate never closes on one inside it.
    const occupied = bodies.some((b) => distToCell(b.pos, g.cell) < b.radiusM);
    return satisfied || hold > 0 || occupied;
  });
  return { gates: open, holdTicks: holds };
}
