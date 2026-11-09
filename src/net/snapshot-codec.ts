/**
 * Binary delta snapshot codec.
 *
 * Each frame is encoded against a baseline: the State the receiver already holds.
 * WebSockets are ordered and reliable, so the server tracks one baseline per
 * connection and needs no acks. A frame with no usable baseline is a "full" frame.
 *
 * Lossless: every field except the grid (ropes and spectator coordinates are f64). Grid densities are quantised to uint16
 * (steps of 1/65535) because the grid is [0, 1] smoke density used for rendering.
 * The sender may keep the raw state it sent as the next baseline: cells are compared
 * after quantising, so it agrees with the receiver's decoded state.
 *
 * Layout (little endian):
 *   u8  flags: bit0 full, bit1 ended, bit2 ghost present, bit3 ghost solid, bit4 outcome present
 *   u32 tick, u32 rng, u8 showmanId, u16 snuffedCount
 *   f64 cart.travel, f64 cart.speedMps, f64 beam.angle
 *   u8  fanCount, per fan: f64 cx, f64 cy, u16 ticksLeft
 *   u8  readyCount, per entry: u8 player, u32 tick
 *   u8  candleCount, per candle: u8 status [, full only: u8 id]
 *       (candle x, y are not sent: they are copied from the owning Spectator on decode)
 *   u8  spectatorCount [, full only: per spectator u8 player, u8 candleId]
 *       u8 changedMask (bit i = spectator i moved since the baseline; all set on full frames)
 *       per set bit: f64 x, f64 y
 *   u8  ropeCount, per rope: u8 status, u16 cutProgressTicks, u32 cutTick (0xffffffff = null)
 *       [, full only: u8 id, f64 x, f64 y]
 *   ghost present: u16 col, u16 row, f64 density
 *   outcome present: u8 winner, u8 reason, u32 tick
 *   u16 newSnuffIdCount, per id: u8 byteLength, utf8 bytes   (ids after the baseline's)
 *   full only: u16 gridLength
 *   u8  gridMode: 0 sparse = u16 n, n x (u16 index, u16 value); 1 dense = gridLength x u16
 * Imports sim types only.
 */

import type {
  Candle,
  CandleStatus,
  Fan,
  Ghost,
  Outcome,
  OutcomeReason,
  Rope,
  RopeStatus,
  Spectator,
  State,
} from '../sim';

export class SnapshotCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotCodecError';
  }
}

const FLAG_FULL = 1;
const FLAG_ENDED = 2;
const FLAG_GHOST = 4;
const FLAG_GHOST_SOLID = 8;
const FLAG_OUTCOME = 16;

/** Wire value for a null rope cutTick. */
const CUT_TICK_NULL = 0xffffffff;
/** The spectator changed-mask is one byte. */
const MAX_SPECTATORS = 8;

const U8_MAX = 0xff;
const U16_MAX = 0xffff;
const U32_MAX = 0xffffffff;
const GRID_QUANT_MAX = U16_MAX;
const GRID_MODE_SPARSE = 0;
const GRID_MODE_DENSE = 1;
/** Bytes per sparse grid entry (u16 index + u16 value) and per dense cell (u16). */
const SPARSE_ENTRY_BYTES = 4;
const DENSE_CELL_BYTES = 2;
const SPARSE_HEADER_BYTES = 2;

const CANDLE_STATUSES: readonly CandleStatus[] = ['lit', 'shielded', 'snuffed'];
const ROPE_STATUSES: readonly RopeStatus[] = ['standing', 'cut'];
const OUTCOME_WINNERS: readonly Outcome['winner'][] = ['showman', 'spectators'];
const OUTCOME_REASONS: readonly OutcomeReason[] = ['all_candles_snuffed', 'time_up', 'all_ropes_cut'];

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function quantise(v: number): number {
  if (!Number.isFinite(v) || v < 0 || v > 1) throw new SnapshotCodecError(`grid density out of range: ${v}`);
  return Math.round(v * GRID_QUANT_MAX);
}

function dequantise(q: number): number {
  return q / GRID_QUANT_MAX;
}

class Writer {
  private buf = new Uint8Array(256);
  private view = new DataView(this.buf.buffer);
  private len = 0;

  private ensure(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    const next = new Uint8Array(Math.max(this.buf.length * 2, this.len + extra));
    next.set(this.buf);
    this.buf = next;
    this.view = new DataView(next.buffer);
  }

  private check(name: string, v: number, max: number): void {
    if (!Number.isInteger(v) || v < 0 || v > max) throw new SnapshotCodecError(`${name} out of range: ${v}`);
  }

  u8(name: string, v: number): void {
    this.check(name, v, U8_MAX);
    this.ensure(1);
    this.view.setUint8(this.len++, v);
  }

  u16(name: string, v: number): void {
    this.check(name, v, U16_MAX);
    this.ensure(2);
    this.view.setUint16(this.len, v, true);
    this.len += 2;
  }

  u32(name: string, v: number): void {
    this.check(name, v, U32_MAX);
    this.ensure(4);
    this.view.setUint32(this.len, v, true);
    this.len += 4;
  }

  f64(name: string, v: number): void {
    if (!Number.isFinite(v)) throw new SnapshotCodecError(`${name} is not finite: ${v}`);
    this.ensure(8);
    this.view.setFloat64(this.len, v, true);
    this.len += 8;
  }

  bytes(b: Uint8Array): void {
    this.ensure(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }

  finish(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

class Reader {
  private view: DataView;
  private pos = 0;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get remaining(): number {
    return this.bytes.length - this.pos;
  }

  private need(n: number): void {
    if (this.remaining < n) throw new SnapshotCodecError('frame truncated');
  }

  u8(): number {
    this.need(1);
    return this.view.getUint8(this.pos++);
  }

  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }

  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }

  f64(): number {
    this.need(8);
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }

  take(n: number): Uint8Array {
    this.need(n);
    const out = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
}

/** True if `baseline` can be used for a delta frame of `state`. */
function isUsableBaseline(state: State, baseline: State | null): baseline is State {
  if (baseline === null) return false;
  if (baseline.grid.length !== state.grid.length) return false;
  if (baseline.candles.length !== state.candles.length) return false;
  if (baseline.ropes.length !== state.ropes.length) return false;
  for (let i = 0; i < state.ropes.length; i++) {
    const a = state.ropes[i] as Rope;
    const b = baseline.ropes[i] as Rope;
    if (a.id !== b.id || a.x !== b.x || a.y !== b.y) return false;
  }
  for (let i = 0; i < state.candles.length; i++) {
    if ((state.candles[i] as Candle).id !== (baseline.candles[i] as Candle).id) return false;
  }
  if (baseline.spectators.length !== state.spectators.length) return false;
  for (let i = 0; i < state.spectators.length; i++) {
    const a = state.spectators[i] as Spectator;
    const b = baseline.spectators[i] as Spectator;
    if (a.player !== b.player || a.candleId !== b.candleId) return false;
  }
  if (baseline.appliedSnuffIds.length > state.appliedSnuffIds.length) return false;
  return baseline.appliedSnuffIds.every((id, i) => id === state.appliedSnuffIds[i]);
}

/**
 * Encode `state` against `baseline` (what the receiver holds, or null for a full frame).
 * Falls back to a full frame by itself if the baseline does not fit.
 */
export function encodeSnapshot(state: State, baseline: State | null): Uint8Array {
  const usable = isUsableBaseline(state, baseline) ? baseline : null;
  const full = usable === null;
  const w = new Writer();

  let flags = 0;
  if (full) flags |= FLAG_FULL;
  if (state.ended) flags |= FLAG_ENDED;
  if (state.ghost !== null) flags |= FLAG_GHOST;
  if (state.ghost?.solid === true) flags |= FLAG_GHOST_SOLID;
  if (state.outcome !== null) flags |= FLAG_OUTCOME;
  w.u8('flags', flags);

  w.u32('tick', state.tick);
  w.u32('rng', state.rng);
  w.u8('showmanId', state.showmanId);
  w.u16('snuffedCount', state.snuffedCount);
  w.f64('cart.travel', state.cart.travel);
  w.f64('cart.speedMps', state.cart.speedMps);
  w.f64('beam.angle', state.beam.angle);

  w.u8('fans.length', state.fans.length);
  for (const f of state.fans) {
    w.f64('fan.cx', f.cx);
    w.f64('fan.cy', f.cy);
    w.u16('fan.ticksLeft', f.ticksLeft);
  }

  // Cooldowns are carried for seated Spectators only; the sim may hold entries for
  // ids it was fed that have no seat (hostile input), which have no meaning on the wire.
  const seated = new Set(state.spectators.map((sp) => sp.player));
  const ready = Object.entries(state.fanReadyTick)
    .map(([k, v]) => [Number(k), v] as const)
    .filter(([player]) => seated.has(player))
    .sort((a, b) => a[0] - b[0]);
  w.u8('fanReadyTick.length', ready.length);
  for (const [player, tick] of ready) {
    w.u8('fanReadyTick.player', player);
    w.u32('fanReadyTick.tick', tick);
  }

  w.u8('candles.length', state.candles.length);
  for (const c of state.candles) {
    const status = CANDLE_STATUSES.indexOf(c.status);
    if (status < 0) throw new SnapshotCodecError(`unknown candle status: ${String(c.status)}`);
    const owner = state.spectators.find((s) => s.candleId === c.id);
    if (owner === undefined) throw new SnapshotCodecError(`candle ${c.id} has no owning spectator`);
    if (owner.x !== c.x || owner.y !== c.y) throw new SnapshotCodecError(`candle ${c.id} is not at its spectator`);
    w.u8('candle.status', status);
    if (full) w.u8('candle.id', c.id);
  }

  if (state.spectators.length > MAX_SPECTATORS) throw new SnapshotCodecError('too many spectators');
  w.u8('spectators.length', state.spectators.length);
  if (full) {
    for (const sp of state.spectators) {
      w.u8('spectator.player', sp.player);
      w.u8('spectator.candleId', sp.candleId);
    }
  }
  let mask = 0;
  state.spectators.forEach((sp, i) => {
    const b = usable?.spectators[i];
    if (b === undefined || b.x !== sp.x || b.y !== sp.y) mask |= 1 << i;
  });
  w.u8('spectators.mask', mask);
  state.spectators.forEach((sp, i) => {
    if ((mask & (1 << i)) === 0) return;
    w.f64('spectator.x', sp.x);
    w.f64('spectator.y', sp.y);
  });

  w.u8('ropes.length', state.ropes.length);
  for (const r of state.ropes) {
    const status = ROPE_STATUSES.indexOf(r.status);
    if (status < 0) throw new SnapshotCodecError(`unknown rope status: ${String(r.status)}`);
    if (r.cutTick === CUT_TICK_NULL) throw new SnapshotCodecError('rope.cutTick is reserved');
    w.u8('rope.status', status);
    w.u16('rope.cutProgressTicks', r.cutProgressTicks);
    w.u32('rope.cutTick', r.cutTick ?? CUT_TICK_NULL);
    if (full) {
      w.u8('rope.id', r.id);
      w.f64('rope.x', r.x);
      w.f64('rope.y', r.y);
    }
  }

  if (state.ghost !== null) {
    w.u16('ghost.col', state.ghost.col);
    w.u16('ghost.row', state.ghost.row);
    w.f64('ghost.density', state.ghost.density);
  }

  if (state.outcome !== null) {
    const winner = OUTCOME_WINNERS.indexOf(state.outcome.winner);
    const reason = OUTCOME_REASONS.indexOf(state.outcome.reason);
    if (winner < 0) throw new SnapshotCodecError(`unknown outcome winner: ${String(state.outcome.winner)}`);
    if (reason < 0) throw new SnapshotCodecError(`unknown outcome reason: ${String(state.outcome.reason)}`);
    w.u8('outcome.winner', winner);
    w.u8('outcome.reason', reason);
    w.u32('outcome.tick', state.outcome.tick);
  }

  const known = usable?.appliedSnuffIds.length ?? 0;
  const fresh = state.appliedSnuffIds.slice(known);
  w.u16('snuffIds.length', fresh.length);
  for (const id of fresh) {
    const b = utf8Encoder.encode(id);
    w.u8('snuffId.byteLength', b.length);
    w.bytes(b);
  }

  const cells = state.grid.length;
  if (full) w.u16('grid.length', cells);
  const changed: [number, number][] = [];
  for (let i = 0; i < cells; i++) {
    const q = quantise(state.grid[i] as number);
    const before = usable === null ? 0 : quantise(usable.grid[i] as number);
    if (q !== before) changed.push([i, q]);
  }
  const sparseBytes = SPARSE_HEADER_BYTES + changed.length * SPARSE_ENTRY_BYTES;
  if (sparseBytes <= cells * DENSE_CELL_BYTES) {
    w.u8('grid.mode', GRID_MODE_SPARSE);
    w.u16('grid.changed', changed.length);
    for (const [i, q] of changed) {
      w.u16('grid.index', i);
      w.u16('grid.value', q);
    }
  } else {
    w.u8('grid.mode', GRID_MODE_DENSE);
    for (let i = 0; i < cells; i++) w.u16('grid.value', quantise(state.grid[i] as number));
  }
  return w.finish();
}

/**
 * Decode a frame. `baseline` must be the state this function last returned on
 * this connection (null before the first frame). Throws SnapshotCodecError on any bad input.
 */
export function decodeSnapshot(bytes: Uint8Array, baseline: State | null): State {
  try {
    return decodeUnsafe(bytes, baseline);
  } catch (e) {
    if (e instanceof SnapshotCodecError) throw e;
    throw new SnapshotCodecError(e instanceof Error ? e.message : 'bad frame');
  }
}

function decodeUnsafe(bytes: Uint8Array, baseline: State | null): State {
  const r = new Reader(bytes);
  const flags = r.u8();
  const full = (flags & FLAG_FULL) !== 0;
  if (!full && baseline === null) throw new SnapshotCodecError('delta frame without a baseline');
  const base = full ? null : baseline;

  const tick = r.u32();
  const rng = r.u32();
  const showmanId = r.u8();
  const snuffedCount = r.u16();
  const cart = { travel: r.f64(), speedMps: r.f64() };
  const beam = { angle: r.f64() };

  const fans: Fan[] = [];
  for (let n = r.u8(); n > 0; n--) fans.push({ cx: r.f64(), cy: r.f64(), ticksLeft: r.u16() });

  const fanReadyTick: Record<string, number> = {};
  for (let n = r.u8(); n > 0; n--) {
    const player = r.u8();
    fanReadyTick[String(player)] = r.u32();
  }

  const candleCount = r.u8();
  if (base !== null && candleCount !== base.candles.length) throw new SnapshotCodecError('candle count mismatch');
  const candleParts: { id: number; status: CandleStatus }[] = [];
  for (let i = 0; i < candleCount; i++) {
    const status = CANDLE_STATUSES[r.u8()];
    if (status === undefined) throw new SnapshotCodecError('unknown candle status');
    const id = full ? r.u8() : ((base as State).candles[i] as Candle).id;
    candleParts.push({ id, status });
  }

  const spectatorCount = r.u8();
  if (spectatorCount > MAX_SPECTATORS) throw new SnapshotCodecError('spectator count out of range');
  if (base !== null && spectatorCount !== base.spectators.length) throw new SnapshotCodecError('spectator count mismatch');
  const spectatorIds: { player: number; candleId: number }[] = [];
  for (let i = 0; i < spectatorCount; i++) {
    if (full) spectatorIds.push({ player: r.u8(), candleId: r.u8() });
    else {
      const b = (base as State).spectators[i] as Spectator;
      spectatorIds.push({ player: b.player, candleId: b.candleId });
    }
  }
  const mask = r.u8();
  if (mask >> spectatorCount !== 0) throw new SnapshotCodecError('spectator mask out of range');
  if (full && mask !== (1 << spectatorCount) - 1) throw new SnapshotCodecError('full frame must carry all spectators');
  const spectators: Spectator[] = spectatorIds.map((ids, i) => {
    if ((mask & (1 << i)) !== 0) return { ...ids, x: r.f64(), y: r.f64() };
    const b = (base as State).spectators[i] as Spectator;
    return { ...ids, x: b.x, y: b.y };
  });

  const candles: Candle[] = candleParts.map((c) => {
    const owner = spectators.find((s) => s.candleId === c.id);
    if (owner === undefined) throw new SnapshotCodecError('candle without owning spectator');
    return { id: c.id, x: owner.x, y: owner.y, status: c.status };
  });

  const ropeCount = r.u8();
  if (base !== null && ropeCount !== base.ropes.length) throw new SnapshotCodecError('rope count mismatch');
  const ropes: Rope[] = [];
  for (let i = 0; i < ropeCount; i++) {
    const status = ROPE_STATUSES[r.u8()];
    if (status === undefined) throw new SnapshotCodecError('unknown rope status');
    const cutProgressTicks = r.u16();
    const rawCutTick = r.u32();
    const cutTick = rawCutTick === CUT_TICK_NULL ? null : rawCutTick;
    if (full) {
      ropes.push({ id: r.u8(), x: r.f64(), y: r.f64(), status, cutProgressTicks, cutTick });
    } else {
      const b = (base as State).ropes[i] as Rope;
      ropes.push({ id: b.id, x: b.x, y: b.y, status, cutProgressTicks, cutTick });
    }
  }

  let ghost: Ghost | null = null;
  if ((flags & FLAG_GHOST) !== 0) {
    ghost = { col: r.u16(), row: r.u16(), density: r.f64(), solid: (flags & FLAG_GHOST_SOLID) !== 0 };
  }

  let outcome: Outcome | null = null;
  if ((flags & FLAG_OUTCOME) !== 0) {
    const winner = OUTCOME_WINNERS[r.u8()];
    const reason = OUTCOME_REASONS[r.u8()];
    const outcomeTick = r.u32();
    if (winner === undefined || reason === undefined) throw new SnapshotCodecError('unknown outcome enum');
    outcome = { winner, reason, tick: outcomeTick };
  }

  const appliedSnuffIds = base === null ? [] : [...base.appliedSnuffIds];
  for (let n = r.u16(); n > 0; n--) appliedSnuffIds.push(utf8Decoder.decode(r.take(r.u8())));

  const cells = full ? r.u16() : (base as State).grid.length;
  const grid: number[] = base === null ? new Array<number>(cells).fill(0) : [...base.grid];
  const mode = r.u8();
  if (mode === GRID_MODE_SPARSE) {
    for (let n = r.u16(); n > 0; n--) {
      const index = r.u16();
      const q = r.u16();
      if (index >= cells) throw new SnapshotCodecError('grid index out of range');
      grid[index] = dequantise(q);
    }
  } else if (mode === GRID_MODE_DENSE) {
    if (r.remaining < cells * DENSE_CELL_BYTES) throw new SnapshotCodecError('frame truncated');
    for (let i = 0; i < cells; i++) grid[i] = dequantise(r.u16());
  } else {
    throw new SnapshotCodecError('unknown grid mode');
  }
  if (r.remaining !== 0) throw new SnapshotCodecError('trailing bytes');

  return {
    tick,
    ended: (flags & FLAG_ENDED) !== 0,
    rng,
    showmanId,
    grid,
    cart,
    beam,
    fans,
    fanReadyTick,
    candles,
    ropes,
    spectators,
    outcome,
    appliedSnuffIds,
    snuffedCount,
    ghost,
  };
}

/** The state a receiver will hold after decoding `state` (grid quantised). */
export function quantizeState(state: State): State {
  return decodeSnapshot(encodeSnapshot(state, null), null);
}
