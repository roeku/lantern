/**
 * Pure mapping from ControlState to the inputs one Tick sends.
 * Imports sim through its entry point and the ClientInput type from the net protocol.
 */

import { TUNING, type Spectator, type Tuning, type View } from '../../sim';
import type { ClientInput } from '../../net/protocol';
import { VENT_ACTIONS, codeFor } from './bindings';
import type { ControlPhase, ControlRole, ControlState } from './controls';

export interface MapContext {
  role: ControlRole;
  phase: ControlPhase;
  view: View;
  /** The local Spectator from the View, or null for the Showman. */
  self: Spectator | null;
  /** Beam origin on the floor (cart position). */
  cartOrigin: { x: number; y: number };
}

function showmanInputs(c: ControlState, ctx: MapContext): ClientInput[] {
  const out: ClientInput[] = [];

  if (c.mouseFloor !== null) {
    out.push({
      kind: 'aim',
      angle: Math.atan2(c.mouseFloor.y - ctx.cartOrigin.y, c.mouseFloor.x - ctx.cartOrigin.x),
    });
  }

  const forward = c.held.has(codeFor('showman', 'rollForward'));
  const back = c.held.has(codeFor('showman', 'rollBack'));
  if (forward !== back) {
    const dir = forward ? 1 : -1;
    const rush = c.held.has(codeFor('showman', 'rush'));
    out.push({ kind: rush ? 'rush' : 'roll', dir });
  }

  VENT_ACTIONS.forEach((action, vent) => {
    if (c.pressed.includes(codeFor('showman', action))) out.push({ kind: 'puff', vent });
  });

  return out;
}

function moveInput(c: ControlState): ClientInput | null {
  const axis = (positive: string, negative: string): number =>
    Number(c.held.has(positive)) - Number(c.held.has(negative));
  const dx = axis(codeFor('spectator', 'moveRight'), codeFor('spectator', 'moveLeft'));
  const dy = axis(codeFor('spectator', 'moveUp'), codeFor('spectator', 'moveDown'));
  return dx === 0 && dy === 0 ? null : { kind: 'move', dx, dy };
}

function spectatorInputs(c: ControlState, ctx: MapContext, tuning: Tuning): ClientInput[] {
  const out: ClientInput[] = [];
  const move = moveInput(c);
  if (move !== null) out.push(move);

  const { self, view } = ctx;
  // Audience_Side: a snuffed Spectator may only move.
  if (self === null || view.ownCandle === null || view.ownCandle === 'snuffed') return out;

  if (c.pressed.includes(codeFor('spectator', 'shield'))) {
    out.push({ kind: view.ownCandle === 'lit' ? 'shield' : 'unshield', candle: self.candleId });
  }

  const fanReady = view.ownFanReadyInTicks === 0;
  if (fanReady && c.mouseFloor !== null && c.pressed.includes(codeFor('spectator', 'fan'))) {
    const dx = c.mouseFloor.x - self.x;
    const dy = c.mouseFloor.y - self.y;
    const dist = Math.hypot(dx, dy);
    const k = dist > tuning.fanReachM ? tuning.fanReachM / dist : 1;
    out.push({ kind: 'fan', x: self.x + dx * k, y: self.y + dy * k });
  }

  if (c.held.has(codeFor('spectator', 'cut'))) {
    let nearest: { id: number; d: number } | null = null;
    for (const rope of view.ropes) {
      if (rope.status !== 'standing') continue;
      const d = Math.hypot(rope.x - self.x, rope.y - self.y);
      if (d > tuning.ropeCutRadiusM) continue;
      if (nearest === null || d < nearest.d || (d === nearest.d && rope.id < nearest.id)) {
        nearest = { id: rope.id, d };
      }
    }
    if (nearest !== null) out.push({ kind: 'cut', rope: nearest.id });
  }

  return out;
}

/** Inputs to send this Tick. Empty unless the Phase is `playing`. */
export function mapInputs(c: ControlState, ctx: MapContext, tuning: Tuning = TUNING): ClientInput[] {
  if (ctx.phase !== 'playing') return [];
  return ctx.role === 'showman' ? showmanInputs(c, ctx) : spectatorInputs(c, ctx, tuning);
}
