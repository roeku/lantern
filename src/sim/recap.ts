/**
 * Round recap built from a recorded sequence of frames. Pure: no I/O, no mutation of inputs.
 */

import type { Candle, Ghost, Outcome, Rope, Spectator, State } from './state';
import { TUNING, type Tuning } from './tuning';

export interface ReplayFrame {
  tick: number;
  cart: { travel: number };
  beam: { angle: number };
  ghost: Ghost | null;
  ropes: Rope[];
  spectators: Spectator[];
  candles: Candle[];
  outcome: Outcome | null;
}

export interface Recap {
  snuffs: { tick: number; candleId: number; x: number; y: number }[];
  ropeCuts: { tick: number; ropeId: number; x: number; y: number }[];
  nearMisses: number;
  lastRopeCutTick: number | null;
}

/** Copy the replay-relevant parts of a State (no grid, no rng). */
export function toReplayFrame(state: State): ReplayFrame {
  return {
    tick: state.tick,
    cart: { travel: state.cart.travel },
    beam: { angle: state.beam.angle },
    ghost: state.ghost ? { ...state.ghost } : null,
    ropes: state.ropes.map((r) => ({ ...r })),
    spectators: state.spectators.map((s) => ({ ...s })),
    candles: state.candles.map((c) => ({ ...c })),
    outcome: state.outcome ? { ...state.outcome } : null,
  };
}

/** Offset from a cell corner to its centre, derived from 1 (no other literals). */
const HALF = 1 / (1 + 1);

export function buildRecap(frames: readonly ReplayFrame[], tuning: Tuning = TUNING): Recap {
  const snuffs: Recap['snuffs'] = [];
  const ropeCuts: Recap['ropeCuts'] = [];
  const snuffedSeen = new Set<number>();
  const cutSeen = new Set<number>();
  const inRun = new Set<number>();
  let nearMisses = 0;
  let lastRopeCutTick: number | null = null;
  const radiusSq = tuning.nearMissRadiusM * tuning.nearMissRadiusM;

  for (const frame of frames) {
    for (const candle of frame.candles) {
      const snuffedNow = candle.status === 'snuffed';
      const newSnuff = snuffedNow && !snuffedSeen.has(candle.id);
      if (newSnuff) {
        snuffedSeen.add(candle.id);
        snuffs.push({ tick: frame.tick, candleId: candle.id, x: candle.x, y: candle.y });
      }

      let near = false;
      if (!snuffedNow && frame.ghost !== null && frame.ghost.solid) {
        const dx = frame.ghost.col + HALF - candle.x;
        const dy = frame.ghost.row + HALF - candle.y;
        near = dx * dx + dy * dy <= radiusSq;
      }
      if (near) {
        inRun.add(candle.id);
      } else if (inRun.has(candle.id)) {
        inRun.delete(candle.id);
        // A run that ends in a snuff is not a Near_Miss.
        if (!snuffedNow) nearMisses += 1;
      }
    }

    for (const rope of frame.ropes) {
      if (rope.status === 'cut' && !cutSeen.has(rope.id)) {
        cutSeen.add(rope.id);
        ropeCuts.push({ tick: frame.tick, ropeId: rope.id, x: rope.x, y: rope.y });
        const t = rope.cutTick ?? frame.tick;
        if (lastRopeCutTick === null || t > lastRopeCutTick) lastRopeCutTick = t;
      }
    }
  }

  // Runs still open at the end of the log (ghost still near a living candle) are not counted.
  return { snuffs, ropeCuts, nearMisses, lastRopeCutTick };
}
