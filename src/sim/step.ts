/**
 * The single simulation step. Pure: never mutates `state` or `inputs`.
 * Tick order (see design.md, Extended tick order):
 *   1 ended -> deep copy; 2 apply inputs (move and cut collected); 3 move phase;
 *   4 candle sync; 5 rope phase; 6 decay, spread, fans, cart, ghost;
 *   7 snuff by contact; 8 outcome phase; 9 advance tick, ended = outcome !== null.
 * Rule code uses no numeric literals other than 0 and 1.
 */
import { normaliseAngle } from './beam';
import { applySnuffEvent, lightCandle, shieldCandle, snuffByContact, unshieldCandle } from './candles';
import { imageScale, moveCart, type CartDir } from './cart';
import { placeGhost } from './ghost';
import { decideOutcome } from './outcome';
import { applyRopePhase } from './ropes';
import { acceptFan, decay, puff, spread, tickFans, zeroFanned } from './smoke';
import { applyMoves, ownsCandle, syncCandlePositions } from './spectators';
import type { Input, PlayerId, State } from './state';
import { TUNING, type Tuning } from './tuning';

function isDir(d: unknown): d is CartDir {
  return d === 1 || d === -1;
}

function hasSnuffedCandle(s: State, player: PlayerId): boolean {
  const sp = s.spectators.find((x) => x.player === player);
  const candle = sp === undefined ? undefined : s.candles.find((c) => c.id === sp.candleId);
  return candle !== undefined && candle.status === 'snuffed';
}

export function step(state: State, inputs: readonly Input[], tuning: Tuning = TUNING): State {
  // 1) Ended rounds are frozen.
  if (state.ended || state.outcome !== null) return structuredClone(state);

  let s: State = structuredClone(state);
  let rollDir: CartDir | null = null;
  let rushDir: CartDir | null = null;
  const cutInputs: { player: PlayerId; rope: number }[] = [];
  // Last move per player wins.
  const moveByPlayer = new Map<PlayerId, Input>();

  // 2) Stable-sort by player id (copy first), then apply in order.
  const ordered = inputs.map((i) => structuredClone(i)).sort((a, b) => a.player - b.player);
  for (const input of ordered) {
    const fromShowman = input.player === s.showmanId;
    switch (input.kind) {
      case 'puff':
        if (fromShowman) s = { ...s, grid: puff(s.grid, input.vent, tuning) };
        break;
      case 'roll':
        if (fromShowman && isDir(input.dir)) rollDir = input.dir;
        break;
      case 'rush':
        if (fromShowman && isDir(input.dir)) rushDir = input.dir;
        break;
      case 'aim':
        if (fromShowman && Number.isFinite(input.angle)) {
          s = { ...s, beam: { angle: normaliseAngle(input.angle) } };
        }
        break;
      case 'fan':
        if (!fromShowman && !hasSnuffedCandle(s, input.player)) {
          const r = acceptFan(s.grid, s.fans, s.fanReadyTick, input.player, input.x, input.y, s.tick, tuning);
          s = { ...s, grid: r.grid, fans: r.fans, fanReadyTick: r.fanReadyTick };
        }
        break;
      case 'shield':
        if (ownsCandle(s, input.player, input.candle)) s = shieldCandle(s, input.candle);
        break;
      case 'unshield':
        if (ownsCandle(s, input.player, input.candle)) s = unshieldCandle(s, input.candle);
        break;
      case 'light':
        if (ownsCandle(s, input.player, input.candle)) s = lightCandle(s, input.candle);
        break;
      case 'cut':
        if (!fromShowman) cutInputs.push({ player: input.player, rope: input.rope });
        break;
      case 'move':
        if (!fromShowman) moveByPlayer.set(input.player, input);
        break;
      case 'snuff':
        s = applySnuffEvent(s, input.candle, input.eventId);
        break;
      default:
        break;
    }
  }

  // 3) Move phase, 4) candle sync, 5) rope phase (sees shields applied above).
  s = applyMoves(s, [...moveByPlayer.values()], tuning);
  s = syncCandlePositions(s);
  s = applyRopePhase(s, cutInputs, tuning);

  // Cart moves once per tick, after inputs (rush wins inside moveCart).
  const cart = moveCart(s.cart, rollDir, rushDir, tuning);

  // 3) Decay, 4) spread.
  let grid = spread(decay(s.grid, tuning), tuning);

  // 5) Hold fanned cells at 0, then count fans down.
  grid = zeroFanned(grid, s.fans, tuning);
  const fans = tickFans(s.fans);

  // 6) Ghost from the updated cart, beam, grid and fans.
  s = { ...s, grid, fans, cart };
  s = { ...s, ghost: placeGhost(s, tuning) };

  // 7) Snuff by contact (ghost is already set).
  s = snuffByContact(s, imageScale(cart.travel, tuning), tuning);

  // 8) Outcome phase, 9) advance the tick.
  const outcome = decideOutcome(s, tuning);
  return { ...s, tick: s.tick + 1, outcome, ended: outcome !== null };
}
