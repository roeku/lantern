import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CLIENT_INPUT_KINDS } from '../../src/net/protocol';
import { acceptClientInput, MAX_INPUTS_PER_SEAT_PER_TICK } from '../../src/net/room-code';
import type { PlayerId } from '../../src/sim';

const KINDS = [...CLIENT_INPUT_KINDS, 'snuff', 'teleport', '', 'PUFF', '__proto__'];

const seatArb = fc.constantFrom(0, 1, 2, 3) as unknown as fc.Arbitrary<PlayerId>;
const countArb = fc.integer({ min: 0, max: MAX_INPUTS_PER_SEAT_PER_TICK - 1 });

const frameArb = fc.record({
  kind: fc.constantFrom(...KINDS),
  player: fc.oneof(fc.integer({ min: -2, max: 9 }), fc.string(), fc.constant(null)),
  rope: fc.oneof(fc.integer({ min: 0, max: 5 }), fc.string(), fc.constant(undefined)),
  x: fc.double({ noNaN: true }),
  z: fc.double({ noNaN: true }),
  extra: fc.string(),
});

const toFrame = (f: { kind: string; player: unknown; rope: unknown; x: number; z: number; extra: string }) =>
  JSON.stringify({ t: 'in', input: { kind: f.kind, player: f.player, rope: f.rope, x: f.x, z: f.z, extra: f.extra } });

// Feature: vertical-slice, Property 9: The server only forwards allowed, stamped inputs
// **Validates: Requirements 6.12, 6.13, 8.7**
describe('Property 9: The server only forwards allowed, stamped inputs', () => {
  it('arbitrary raw strings yield null or a whitelisted, stamped input', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.json()), seatArb, countArb, (raw, seat, count) => {
        const out = acceptClientInput(raw, seat, count);
        if (out !== null) {
          expect(CLIENT_INPUT_KINDS).toContain(out.kind);
          expect(out.kind).not.toBe('snuff');
          expect(out.player).toBe(seat);
        }
      }),
    );
  });

  it('well-formed frames: allowed kinds are stamped with the seat, others are never forwarded', () => {
    fc.assert(
      fc.property(frameArb, seatArb, countArb, (f, seat, count) => {
        const out = acceptClientInput(toFrame(f), seat, count);
        if (out !== null) {
          expect(CLIENT_INPUT_KINDS).toContain(out.kind);
          expect(out.kind).not.toBe('snuff');
          expect(out.player).toBe(seat);
        }
        if (!CLIENT_INPUT_KINDS.includes(f.kind)) expect(out).toBeNull();
      }),
    );
  });

  it('non-cut allowed kinds are always forwarded with the seat stamped over a spoofed player', () => {
    fc.assert(
      fc.property(
        frameArb.filter((f) => CLIENT_INPUT_KINDS.includes(f.kind) && f.kind !== 'cut' && f.kind !== 'move'),
        seatArb,
        countArb,
        (f, seat, count) => {
          const out = acceptClientInput(toFrame(f), seat, count);
          expect(out).not.toBeNull();
          expect(out!.player).toBe(seat);
        },
      ),
    );
  });

  it('is null once countSoFar reaches the per-tick cap, even for a valid frame', () => {
    fc.assert(
      fc.property(
        frameArb,
        seatArb,
        fc.integer({ min: MAX_INPUTS_PER_SEAT_PER_TICK, max: 1000 }),
        (f, seat, count) => {
          expect(acceptClientInput(toFrame(f), seat, count)).toBeNull();
        },
      ),
    );
  });

  it('snuff frames are dropped', () => {
    const raw = JSON.stringify({ t: 'in', input: { kind: 'snuff', player: 1 } });
    expect(acceptClientInput(raw, 0 as PlayerId, 0)).toBeNull();
  });
});
