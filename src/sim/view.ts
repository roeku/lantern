/**
 * Per-role View of a State. Pure: copies data, never returns references into
 * the State and never mutates it.
 */

import { beamCells, type Cell } from './beam';
import { lightRadiusM } from './spectators';
import type { Candle, CandleStatus, Ghost, Outcome, PlayerId, Rope, Spectator, State } from './state';
import { TUNING, type Tuning } from './tuning';

export interface ViewCell {
  index: number;
  density: number;
}

export interface View {
  tick: number;
  outcome: Outcome | null;
  ropesCut: number;
  /** Null for the Showman. */
  ownCandle: CandleStatus | null;
  /** 0 when ready; 0 for the Showman. */
  ownFanReadyInTicks: number;
  cart: { travel: number };
  /** Null on the Audience_Side. */
  beam: { angle: number } | null;
  cells: ViewCell[];
  ropes: Rope[];
  spectators: Spectator[];
  candles: Candle[];
  ghost: Ghost | null;
}

/** Beam cone cells whose centres are within placeholderSlideReachM of the beam origin. */
export function beamLitCells(state: State, tuning: Tuning = TUNING): Cell[] {
  // beamCells already limits cells to placeholderSlideReachM; the filter keeps the rule explicit.
  return beamCells(state, tuning).filter((c) => c.distance <= tuning.placeholderSlideReachM);
}

const HALF = 1 / (1 + 1);

function cellIndexAt(x: number, y: number, tuning: Tuning): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const col = Math.min(tuning.roomWidthM - 1, Math.floor(x));
  const row = Math.min(tuning.roomDepthM - 1, Math.floor(y));
  if (col < 0 || row < 0) return null;
  return row * tuning.roomWidthM + col;
}

function within(ax: number, ay: number, bx: number, by: number, radius: number): boolean {
  return Math.hypot(ax - bx, ay - by) <= radius;
}

const copyRope = (r: Rope): Rope => ({ ...r });
const copySpectator = (s: Spectator): Spectator => ({ ...s });
const copyCandle = (c: Candle): Candle => ({ ...c });
const copyGhost = (g: Ghost): Ghost => ({ ...g });

export function viewFor(state: State, player: PlayerId, tuning: Tuning = TUNING): View {
  const width = tuning.roomWidthM;
  const depth = tuning.roomDepthM;
  const isShowman = player === state.showmanId;
  const ownSpectator = isShowman ? undefined : state.spectators.find((s) => s.player === player);
  const ownCandleObj = ownSpectator
    ? state.candles.find((c) => c.id === ownSpectator.candleId)
    : undefined;
  const ownStatus: CandleStatus | null = isShowman ? null : (ownCandleObj?.status ?? null);

  const ownFanReadyInTicks = isShowman
    ? 0
    : Math.max(0, (state.fanReadyTick[String(player)] ?? 0) - state.tick);

  const base = {
    tick: state.tick,
    outcome: state.outcome ? { ...state.outcome } : null,
    ropesCut: state.ropes.filter((r) => r.status === 'cut').length,
    ownCandle: ownStatus,
    ownFanReadyInTicks,
    cart: { travel: state.cart.travel },
  };

  const cellAt = (index: number): ViewCell => ({ index, density: state.grid[index] ?? 0 });

  if (isShowman) {
    const litCells = beamLitCells(state, tuning);
    const litIdx = new Set(litCells.map((c) => c.row * width + c.col));
    const lit = state.candles.filter((c) => c.status === 'lit');
    const inLight = (x: number, y: number): boolean =>
      lit.some((c) => within(x, y, c.x, c.y, lightRadiusM('lit', tuning)));
    const inBeam = (x: number, y: number): boolean => {
      const i = cellIndexAt(x, y, tuning);
      return i !== null && litIdx.has(i);
    };
    const visible = (x: number, y: number): boolean => inBeam(x, y) || inLight(x, y);

    const cells: ViewCell[] = [];
    for (let row = 0; row < depth; row++) {
      for (let col = 0; col < width; col++) {
        const index = row * width + col;
        if (litIdx.has(index) || inLight(col + HALF, row + HALF)) cells.push(cellAt(index));
      }
    }

    return {
      ...base,
      beam: { angle: state.beam.angle },
      cells,
      ropes: state.ropes.filter((r) => visible(r.x, r.y)).map(copyRope),
      spectators: state.spectators.filter((s) => visible(s.x, s.y)).map(copySpectator),
      candles: state.candles
        .filter((c) => c.status === 'lit' || inBeam(c.x, c.y))
        .map(copyCandle),
      ghost: state.ghost && litIdx.has(state.ghost.row * width + state.ghost.col)
        ? copyGhost(state.ghost)
        : null,
    };
  }

  // Audience_Side
  if (ownStatus === 'snuffed' || ownStatus === null) {
    // A snuffed viewer sees everything. A viewer with no seat sees nothing but the shared fields.
    if (ownStatus === 'snuffed') {
      const cells: ViewCell[] = [];
      for (let i = 0; i < width * depth; i++) cells.push(cellAt(i));
      return {
        ...base,
        beam: null,
        cells,
        ropes: state.ropes.map(copyRope),
        spectators: state.spectators.map(copySpectator),
        candles: state.candles.map(copyCandle),
        ghost: state.ghost ? copyGhost(state.ghost) : null,
      };
    }
    return {
      ...base,
      beam: null,
      cells: [],
      ropes: [],
      spectators: [],
      candles: state.candles.filter((c) => c.status === 'lit').map(copyCandle),
      ghost: state.ghost?.solid ? copyGhost(state.ghost) : null,
    };
  }

  const ox = ownSpectator?.x ?? 0;
  const oy = ownSpectator?.y ?? 0;
  const radius = lightRadiusM(ownStatus, tuning);
  const seen = (x: number, y: number): boolean => within(x, y, ox, oy, radius);

  const cells: ViewCell[] = [];
  for (let row = 0; row < depth; row++) {
    for (let col = 0; col < width; col++) {
      if (seen(col + HALF, row + HALF)) cells.push(cellAt(row * width + col));
    }
  }

  const ghost = state.ghost;
  const ghostVisible =
    ghost !== null &&
    (ghost.solid || seen(ghost.col + HALF, ghost.row + HALF));

  return {
    ...base,
    beam: null,
    cells,
    ropes: state.ropes.filter((r) => seen(r.x, r.y)).map(copyRope),
    spectators: state.spectators
      .filter((s) => s.player === player || seen(s.x, s.y))
      .map(copySpectator),
    candles: state.candles
      .filter((c) => c.id === ownCandleObj?.id || c.status === 'lit' || seen(c.x, c.y))
      .map(copyCandle),
    ghost: ghostVisible && ghost ? copyGhost(ghost) : null,
  };
}
