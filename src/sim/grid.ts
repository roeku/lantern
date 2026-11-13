import type { Vec2 } from './vec2';

export interface Cell {
  cx: number;
  cy: number;
}

/** 1 m cells. '#' is a wall, anything else is floor. */
export interface Grid {
  width: number;
  height: number;
  walls: readonly boolean[];
  floorCells: readonly Cell[];
}

export function parseGrid(rows: readonly string[]): Grid {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const walls: boolean[] = [];
  const floorCells: Cell[] = [];
  for (let cy = 0; cy < height; cy++) {
    const row = rows[cy] ?? '';
    for (let cx = 0; cx < width; cx++) {
      const wall = row[cx] === '#';
      walls.push(wall);
      if (!wall) floorCells.push({ cx, cy });
    }
  }
  return { width, height, walls, floorCells };
}

export function isWallCell(grid: Grid, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height) return true;
  return grid.walls[cy * grid.width + cx] === true;
}

export function cellOf(p: Vec2): Cell {
  return { cx: Math.floor(p.x), cy: Math.floor(p.y) };
}

export function cellCenter(c: Cell): Vec2 {
  return { x: c.cx + 0.5, y: c.cy + 0.5 };
}

/** True when a circle at p overlaps any wall cell. */
export function circleHitsWall(grid: Grid, p: Vec2, radiusM: number): boolean {
  const minX = Math.floor(p.x - radiusM);
  const maxX = Math.floor(p.x + radiusM);
  const minY = Math.floor(p.y - radiusM);
  const maxY = Math.floor(p.y + radiusM);
  for (let cy = minY; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) {
      if (!isWallCell(grid, cx, cy)) continue;
      const nx = Math.max(cx, Math.min(p.x, cx + 1));
      const ny = Math.max(cy, Math.min(p.y, cy + 1));
      if ((p.x - nx) ** 2 + (p.y - ny) ** 2 < radiusM * radiusM) return true;
    }
  }
  return false;
}

const LOS_STEP_M = 0.1;

/** Fixed-step ray march. Walls are full height, so 2D is enough. */
export function lineOfSight(grid: Grid, a: Vec2, b: Vec2): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const steps = Math.ceil(len / LOS_STEP_M);
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    if (isWallCell(grid, Math.floor(a.x + dx * t), Math.floor(a.y + dy * t))) return false;
  }
  return true;
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** BFS path between floor cells, inclusive of both ends. Empty when unreachable. Fixed neighbour order. */
export function findPath(grid: Grid, from: Cell, to: Cell): Cell[] {
  if (isWallCell(grid, from.cx, from.cy) || isWallCell(grid, to.cx, to.cy)) return [];
  const w = grid.width;
  const key = (c: Cell) => c.cy * w + c.cx;
  const prev = new Map<number, number>();
  const queue: Cell[] = [from];
  prev.set(key(from), -1);
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (!cur) break;
    if (cur.cx === to.cx && cur.cy === to.cy) {
      const path: Cell[] = [];
      let k = key(cur);
      while (k !== -1) {
        path.push({ cx: k % w, cy: Math.floor(k / w) });
        k = prev.get(k) ?? -1;
      }
      return path.reverse();
    }
    for (const [dx, dy] of NEIGHBOURS) {
      const n: Cell = { cx: cur.cx + dx, cy: cur.cy + dy };
      if (isWallCell(grid, n.cx, n.cy) || prev.has(key(n))) continue;
      prev.set(key(n), key(cur));
      queue.push(n);
    }
  }
  return [];
}
