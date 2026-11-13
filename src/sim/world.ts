import { cellCenter, cellOf } from './grid';
import type { Cell, Grid } from './grid';
import type { Level } from './level';
import type { PlayerState } from './state';
import type { Vec2 } from './vec2';

function idx(grid: Grid, c: Cell): number {
  return c.cy * grid.width + c.cx;
}

/** Cells that block sight: closed doors, the exit until the tape has played. Gates are bars: you see through them. */
export function sightGrid(level: Level, doors: readonly boolean[], exitOpen: boolean): Grid {
  const walls = level.grid.walls.slice();
  level.doors.forEach((d, i) => {
    if (doors[i] !== true) walls[idx(level.grid, d)] = true;
  });
  if (exitOpen) walls[idx(level.grid, level.exit)] = false;
  return { ...level.grid, walls };
}

/** What the player and the echo collide with: everything that blocks sight, plus closed gates. */
export function playerGrid(level: Level, doors: readonly boolean[], exitOpen: boolean, gates: readonly boolean[]): Grid {
  const walls = sightGrid(level, doors, exitOpen).walls.slice();
  level.gates.forEach((g, i) => {
    if (gates[i] !== true) walls[idx(level.grid, g.cell)] = true;
  });
  return { ...level.grid, walls };
}

/** What the Thing paths over: doors are floor (it breaks them down), closed gates are walls. */
export function thingGrid(level: Level, gates: readonly boolean[]): Grid {
  const walls = level.grid.walls.slice();
  level.gates.forEach((g, i) => {
    if (gates[i] !== true) walls[idx(level.grid, g.cell)] = true;
  });
  return { ...level.grid, walls };
}

/** The grid with a square of cells around `center` made solid, `radius` cells out. For keeping the Thing off a silent player. */
export function guardCells(grid: Grid, center: Cell, radius: number): Grid {
  const walls = grid.walls.slice();
  for (let cy = center.cy - radius; cy <= center.cy + radius; cy++) {
    for (let cx = center.cx - radius; cx <= center.cx + radius; cx++) {
      if (cx >= 0 && cy >= 0 && cx < grid.width && cy < grid.height) walls[cy * grid.width + cx] = true;
    }
  }
  return { ...grid, walls };
}

/** The chamber a position is in. Positions outside every span count as the last chamber. */
export function chamberAt(level: Level, pos: Vec2): number {
  const cx = Math.floor(pos.x);
  const i = level.chambers.findIndex((c) => cx >= c.xMin && cx <= c.xMax);
  return i >= 0 ? i : level.chambers.length - 1;
}

/** Index of the door in this cell, or -1. */
export function doorIndexAt(level: Level, c: Cell): number {
  return level.doors.findIndex((d) => d.cx === c.cx && d.cy === c.cy);
}

export function doorCenter(level: Level, i: number): Vec2 {
  const d = level.doors[i];
  if (!d) throw new Error(`no door ${i}`);
  return cellCenter(d);
}

/** Crouched in an alcove. */
export function isHidden(level: Level, player: PlayerState): boolean {
  if (!player.crouching) return false;
  const c = cellOf(player.pos);
  return level.hides.some((h) => h.cx === c.cx && h.cy === c.cy);
}
