/**
 * Spectator bots. A bot is a pure function of (state, bot ids, tuning), so a solo match
 * and the server run the same bots. Callers append these inputs to the human
 * inputs before calling step(). Bots never read or change state.rng: their
 * reaction roll is derived from (state.rng, tick, player), so it is deterministic.
 *
 * Ownership: spectators are the players that are not the Showman, in id order.
 * The Nth spectator owns the candle whose id is N.
 */

import {
  deterministicRoll,
  imageScale,
  ownedCandle,
  TUNING,
  type Input,
  type PlayerId,
  type Rope,
  type State,
  type Tuning,
} from '../sim';

/** Offset from a cell corner to its centre, derived from 1 (no other literals). */
const HALF = 1 / (1 + 1);

/** Nearest standing rope by straight-line distance; ties go to the lower id. */
function nearestStandingRope(state: State, x: number, y: number): Rope | undefined {
  let best: Rope | undefined;
  let bestDist = Infinity;
  for (const rope of state.ropes) {
    if (rope.status !== 'standing') continue;
    const d = Math.hypot(rope.x - x, rope.y - y);
    if (d < bestDist || (d === bestDist && best !== undefined && rope.id < best.id)) {
      best = rope;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Inputs for the given bot players this tick. The Showman id is ignored.
 * Per bot:
 *   - snuffed candle: nothing;
 *   - solid ghost within snuff reach plus botWarnMarginM: when the reaction roll passes,
 *     fan if ready (one fan per tick across bots) else shield a lit candle. No move or cut;
 *   - not threatened and shielded: unshield, nothing else;
 *   - not threatened and lit: cut the nearest standing rope when within ropeCutRadiusM,
 *     otherwise move toward it.
 */
export function spectatorBotInputs(
  state: State,
  botPlayers: readonly PlayerId[],
  tuning: Tuning = TUNING,
): Input[] {
  if (state.ended) return [];

  const ghost = state.ghost;
  const reach = tuning.snuffRadiusBaseM * imageScale(state.cart.travel, tuning) + tuning.botWarnMarginM;
  const ids = [...new Set(botPlayers)].sort((a, b) => a - b);
  const inputs: Input[] = [];
  let fanSpent = false;

  for (const player of ids) {
    if (player === state.showmanId) continue;
    const candle = ownedCandle(state, player);
    if (candle === undefined || candle.status === 'snuffed') continue;

    const gx = ghost === null ? 0 : ghost.col + HALF;
    const gy = ghost === null ? 0 : ghost.row + HALF;
    const threatened = ghost !== null && ghost.solid && Math.hypot(candle.x - gx, candle.y - gy) <= reach;

    if (threatened) {
      if (deterministicRoll(state, player) < tuning.botReactChancePerTick) {
        const fanReady = state.tick >= (state.fanReadyTick[String(player)] ?? 0);
        if (fanReady && !fanSpent) {
          inputs.push({ player, kind: 'fan', x: gx, y: gy });
          fanSpent = true;
        } else if (candle.status === 'lit') {
          inputs.push({ player, kind: 'shield', candle: candle.id });
        }
      }
      continue;
    }
    if (candle.status === 'shielded') {
      if (deterministicRoll(state, player) < tuning.botReactChancePerTick) {
        inputs.push({ player, kind: 'unshield', candle: candle.id });
      }
      continue;
    }
    const rope = nearestStandingRope(state, candle.x, candle.y);
    if (rope === undefined) continue;
    if (Math.hypot(rope.x - candle.x, rope.y - candle.y) <= tuning.ropeCutRadiusM) {
      inputs.push({ player, kind: 'cut', rope: rope.id });
    } else {
      inputs.push({ player, kind: 'move', dx: rope.x - candle.x, dy: rope.y - candle.y });
    }
  }
  return inputs;
}
