/**
 * Smoke grid rules: puff, decay, spread and fans.
 * Pure functions. Arguments are never mutated; new arrays and objects are returned.
 * Grid layout is row-major: index = row * roomWidthM + col.
 */

import type { Fan, PlayerId } from './state';
import type { Tuning } from './tuning';

/** Offset from a cell corner to its centre, derived from 1 (no other literals). */
const HALF = 1 / (1 + 1);

/** Clamp to [0, 1]; non-finite values become 0. */
function clampDensity(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** Indexed read that treats a missing entry as 0 (needed under noUncheckedIndexedAccess). */
function at(values: readonly number[], i: number): number {
  return values[i] ?? 0;
}

/** True when the cell centre is within `radius` (inclusive) of (px, py). */
function centreWithin(col: number, row: number, px: number, py: number, radius: number): boolean {
  const dx = col + HALF - px;
  const dy = row + HALF - py;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Add puffDensity to every cell whose centre is within puffRadiusM of the vent.
 * An unknown vent index returns an unchanged copy. Cells outside the grid are never touched.
 */
export function puff(grid: readonly number[], vent: number, tuning: Tuning): number[] {
  const out = grid.map(clampDensity);
  const pos = Number.isInteger(vent) ? tuning.ventPositions[vent] : undefined;
  if (pos === undefined) return out;

  const [vx, vy] = pos;
  const w = tuning.roomWidthM;
  const d = tuning.roomDepthM;
  for (let row = 0; row < d; row++) {
    for (let col = 0; col < w; col++) {
      if (centreWithin(col, row, vx, vy, tuning.puffRadiusM)) {
        const i = row * w + col;
        out[i] = clampDensity(at(out, i) + tuning.puffDensity);
      }
    }
  }
  return out;
}

/** Subtract smokeDecayPerS x tickS from every cell, clamped at 0. */
export function decay(grid: readonly number[], tuning: Tuning): number[] {
  const amount = tuning.smokeDecayPerS * tuning.tickS;
  return grid.map((v) => clampDensity(v - amount));
}

/**
 * Jacobi-style diffusion from a snapshot of the grid, visiting cells in row-major order.
 * new[c] = old[c] + k x sum(old[n] - old[c]) over existing orthogonal neighbours,
 * with k = smokeSpreadPerS x tickS. Missing neighbours (walls) contribute nothing.
 */
export function spread(grid: readonly number[], tuning: Tuning): number[] {
  const snapshot = grid.map(clampDensity);
  const out = snapshot.slice();
  const k = tuning.smokeSpreadPerS * tuning.tickS;
  const w = tuning.roomWidthM;
  const d = tuning.roomDepthM;

  for (let row = 0; row < d; row++) {
    for (let col = 0; col < w; col++) {
      const i = row * w + col;
      const here = at(snapshot, i);
      let flow = 0;
      if (col > 0) flow += at(snapshot, i - 1) - here;
      if (col < w - 1) flow += at(snapshot, i + 1) - here;
      if (row > 0) flow += at(snapshot, i - w) - here;
      if (row < d - 1) flow += at(snapshot, i + w) - here;
      out[i] = clampDensity(here + k * flow);
    }
  }
  return out;
}

/** True when the cell centre lies within fanRadiusM (inclusive) of any active fan. */
export function isFanned(col: number, row: number, fans: readonly Fan[], tuning: Tuning): boolean {
  return fans.some(
    (f) => f.ticksLeft > 0 && centreWithin(col, row, f.cx, f.cy, tuning.fanRadiusM),
  );
}

/** Set every fanned cell to 0. */
export function zeroFanned(grid: readonly number[], fans: readonly Fan[], tuning: Tuning): number[] {
  const w = tuning.roomWidthM;
  return grid.map((v, i) => {
    const col = i % w;
    const row = (i - col) / w;
    return isFanned(col, row, fans, tuning) ? 0 : clampDensity(v);
  });
}

/** Count every fan down by one tick and drop the ones that have expired. */
export function tickFans(fans: readonly Fan[]): Fan[] {
  return fans.map((f) => ({ ...f, ticksLeft: f.ticksLeft - 1 })).filter((f) => f.ticksLeft > 0);
}

export interface FanResult {
  accepted: boolean;
  grid: number[];
  fans: Fan[];
  fanReadyTick: Record<string, number>;
}

/**
 * Try to accept a fan input from `player` at `tick`.
 * Rejected (everything returned unchanged, no cooldown started) when the position is
 * non-finite or outside the room, or when the player's cooldown is still running.
 * On acceptance: records a fan with ticksLeft = round(fanDurationS / tickS), sets
 * fanReadyTick = tick + round(fanCooldownS / tickS), and clears the fanned cells to 0.
 */
export function acceptFan(
  grid: readonly number[],
  fans: readonly Fan[],
  fanReadyTick: Readonly<Record<string, number>>,
  player: PlayerId,
  x: number,
  y: number,
  tick: number,
  tuning: Tuning,
): FanResult {
  const unchanged: FanResult = {
    accepted: false,
    grid: grid.slice(),
    fans: fans.map((f) => ({ ...f })),
    fanReadyTick: { ...fanReadyTick },
  };

  const inside =
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 0 &&
    y >= 0 &&
    x <= tuning.roomWidthM &&
    y <= tuning.roomDepthM;
  if (!inside) return unchanged;

  const key = String(player);
  const ready = fanReadyTick[key] ?? 0;
  if (tick < ready) return unchanged;

  const nextFans = [
    ...fans.map((f) => ({ ...f })),
    { cx: x, cy: y, ticksLeft: Math.round(tuning.fanDurationS / tuning.tickS) },
  ];
  return {
    accepted: true,
    grid: zeroFanned(grid, nextFans, tuning),
    fans: nextFans,
    fanReadyTick: {
      ...fanReadyTick,
      [key]: tick + Math.round(tuning.fanCooldownS / tuning.tickS),
    },
  };
}
