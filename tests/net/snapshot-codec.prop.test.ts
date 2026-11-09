import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  decodeSnapshot,
  encodeSnapshot,
  quantizeState,
  SnapshotCodecError,
} from '../../src/net/snapshot-codec';
import { createState, step, TUNING, type Input, type State } from '../../src/sim';

const STEPS = 60;
const SPECTATOR = 1;

const inputArb: fc.Arbitrary<Input> = fc.oneof(
  fc.record({ player: fc.constant(0), kind: fc.constant('puff' as const), vent: fc.integer({ min: 0, max: 2 }) }),
  fc.record({ player: fc.constant(0), kind: fc.constant('aim' as const), angle: fc.double({ min: -3, max: 3, noNaN: true }) }),
  fc.record({ player: fc.constant(0), kind: fc.constant('roll' as const), dir: fc.constantFrom(1 as const, -1 as const) }),
  fc.record({ player: fc.constant(0), kind: fc.constant('rush' as const), dir: fc.constantFrom(1 as const, -1 as const) }),
  fc.record({
    player: fc.integer({ min: 1, max: 3 }),
    kind: fc.constant('fan' as const),
    x: fc.integer({ min: 0, max: TUNING.roomWidthM - 1 }),
    y: fc.integer({ min: 0, max: TUNING.roomDepthM - 1 }),
  }),
  fc.record({
    player: fc.integer({ min: 1, max: 3 }),
    kind: fc.constant('move' as const),
    dx: fc.double({ min: -1, max: 1, noNaN: true }),
    dy: fc.double({ min: -1, max: 1, noNaN: true }),
  }),
  fc.record({
    player: fc.integer({ min: 1, max: 3 }),
    kind: fc.constant('cut' as const),
    rope: fc.integer({ min: 0, max: 2 }),
  }),
  fc.record({
    player: fc.constant(SPECTATOR),
    kind: fc.constant('snuff' as const),
    eventId: fc.string({ minLength: 1, maxLength: 12 }),
    candle: fc.integer({ min: 0, max: TUNING.spectatorStartPositions.length - 1 }),
  }),
  fc.record({
    player: fc.constant(SPECTATOR),
    kind: fc.constantFrom('light' as const, 'shield' as const, 'unshield' as const),
    candle: fc.integer({ min: 0, max: TUNING.spectatorStartPositions.length - 1 }),
  }),
);

const scheduleArb = fc.array(fc.array(inputArb, { maxLength: 3 }), { minLength: STEPS, maxLength: STEPS });

function run(seed: number, schedule: Input[][]): State[] {
  const states = [createState(seed)];
  for (const inputs of schedule) states.push(step(states.at(-1) as State, inputs));
  return states;
}

describe('snapshot codec', () => {
  it('full frame round-trips to the quantised state', () => {
    fc.assert(
      fc.property(fc.integer(), scheduleArb, (seed, schedule) => {
        for (const s of run(seed, schedule)) {
          const decoded = decodeSnapshot(encodeSnapshot(s, null), null);
          expect(decoded).toEqual(quantizeState(s));
          // Everything but the grid is exact; the grid is within half a quantum.
          expect({ ...decoded, grid: [] }).toEqual({ ...s, grid: [] });
          decoded.grid.forEach((v, i) => expect(Math.abs(v - (s.grid[i] as number))).toBeLessThanOrEqual(1 / 65535 / 2 + 1e-12));
        }
      }),
    );
  });

  it('a delta chain gives the same state as full frames, every tick', () => {
    fc.assert(
      fc.property(fc.integer(), scheduleArb, (seed, schedule) => {
        let receiver: State | null = null;
        let sender: State | null = null;
        for (const s of run(seed, schedule)) {
          const frame = encodeSnapshot(s, sender);
          receiver = decodeSnapshot(frame, receiver);
          expect(receiver).toEqual(quantizeState(s));
          sender = receiver;
        }
      }),
    );
  });

  it('carries rope progress and cuts through a delta chain until the screen falls', () => {
    let state = createState(2);
    let receiver: State | null = null;
    let sender: State | null = null;
    let sawProgress = false;
    for (let i = 0; i < 400 && !state.ended; i++) {
      // Every Spectator walks to its rope and holds cut.
      const inputs: Input[] = state.spectators.flatMap((sp, k): Input[] => {
        const rope = state.ropes[k % state.ropes.length]!;
        const dx = rope.x - sp.x;
        const dy = rope.y - sp.y;
        const len = Math.hypot(dx, dy);
        const move: Input[] = len > 0.05 ? [{ player: sp.player, kind: 'move', dx: dx / len, dy: dy / len }] : [];
        return [...move, { player: sp.player, kind: 'cut', rope: rope.id }];
      });
      state = step(state, inputs);
      receiver = decodeSnapshot(encodeSnapshot(state, sender), receiver);
      expect(receiver).toEqual(quantizeState(state));
      if (state.ropes.some((r) => r.cutProgressTicks > 0 || r.status === 'cut')) sawProgress = true;
      sender = receiver;
    }
    expect(sawProgress).toBe(true);
  });

  it('a duplicate snuff id is carried once', () => {
    const s0 = createState(1);
    const snuff: Input = { player: SPECTATOR, kind: 'snuff', eventId: 'dup', candle: 0 };
    const s1 = step(step(s0, [snuff]), [snuff]);
    const decoded = decodeSnapshot(encodeSnapshot(s1, quantizeState(s0)), quantizeState(s0));
    expect(decoded.appliedSnuffIds).toEqual(['dup']);
    expect(decoded.snuffedCount).toBe(1);
  });

  it('idle delta frames are tiny and far smaller than a full frame', () => {
    const s0 = createState(1);
    const s1 = step(s0, []);
    const full = encodeSnapshot(s1, null).length;
    const delta = encodeSnapshot(s1, quantizeState(s0)).length;
    expect(delta).toBeLessThan(full);
    expect(delta).toBeLessThan(100);
  });

  it('delta frames stay below full frames over a puffing show', () => {
    let prev = quantizeState(createState(3));
    let state = createState(3);
    let deltaTotal = 0;
    let fullTotal = 0;
    for (let i = 0; i < 100; i++) {
      state = step(state, i % 5 === 0 ? [{ player: 0, kind: 'puff', vent: i % 3 }] : []);
      deltaTotal += encodeSnapshot(state, prev).length;
      fullTotal += encodeSnapshot(state, null).length;
      prev = quantizeState(state);
    }
    expect(deltaTotal).toBeLessThanOrEqual(fullTotal);
  });

  it('falls back to a full frame when the baseline does not fit', () => {
    const s = step(createState(1), []);
    const odd: State = { ...quantizeState(s), grid: [0, 0, 0] };
    expect(decodeSnapshot(encodeSnapshot(s, odd), null)).toEqual(quantizeState(s));
  });

  it('refuses a delta frame without a baseline', () => {
    const s0 = quantizeState(createState(1));
    const frame = encodeSnapshot(step(createState(1), []), s0);
    expect(() => decodeSnapshot(frame, null)).toThrow(SnapshotCodecError);
  });

  it('never throws anything but SnapshotCodecError on arbitrary bytes', () => {
    const base = quantizeState(createState(1));
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 600 }), fc.boolean(), (bytes, withBase) => {
        try {
          decodeSnapshot(bytes, withBase ? base : null);
        } catch (e) {
          expect(e).toBeInstanceOf(SnapshotCodecError);
        }
      }),
    );
  });

  it('rejects truncated and padded frames', () => {
    const frame = encodeSnapshot(step(createState(1), []), null);
    expect(() => decodeSnapshot(frame.slice(0, frame.length - 1), null)).toThrow(SnapshotCodecError);
    const padded = new Uint8Array(frame.length + 1);
    padded.set(frame);
    expect(() => decodeSnapshot(padded, null)).toThrow(SnapshotCodecError);
  });

  it('carries spectator moves and derives candle positions from spectators', () => {
    const s0 = createState(1);
    const s1 = step(s0, [{ player: 1, kind: 'move', dx: 1, dy: 0 }]);
    const base = quantizeState(s0);
    const frame = encodeSnapshot(s1, base);
    const decoded = decodeSnapshot(frame, base);
    expect(decoded.spectators).toEqual(s1.spectators);
    expect(decoded.candles).toEqual(s1.candles);
    expect(decoded.spectators[0]?.x).not.toBe(base.spectators[0]?.x);
    // Unchanged spectators add no coordinates.
    const idle = encodeSnapshot(step(s0, []), base);
    expect(frame.length - idle.length).toBe(16);
  });

  it('carries the outcome and null cutTick', () => {
    const decoded = quantizeState(createState(1));
    expect(decoded.outcome).toBeNull();
    expect(decoded.ropes.every((r) => r.cutTick === null)).toBe(true);
    const ended: State = { ...createState(1), ended: true, outcome: { winner: 'showman', reason: 'time_up', tick: 7 } };
    expect(quantizeState(ended).outcome).toEqual({ winner: 'showman', reason: 'time_up', tick: 7 });
  });

  it('rejects bad enums and out-of-range counts', () => {
    const frame = encodeSnapshot(createState(1), null);
    for (let i = 0; i < frame.length; i++) {
      const cut = frame.slice(0, i);
      expect(() => decodeSnapshot(cut, null)).toThrow(SnapshotCodecError);
    }
    const bad = new Uint8Array(frame);
    bad[0] = (bad[0] as number) | 16; // outcome flag with no outcome bytes
    expect(() => decodeSnapshot(bad, null)).toThrow(SnapshotCodecError);
  });
});
