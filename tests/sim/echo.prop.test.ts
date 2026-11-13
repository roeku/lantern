import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createState, LEVEL, NEUTRAL_INPUT, step, TUNING } from '../../src/sim';
import { at, drive, tapRecord, wait } from './drive';
import type { SimInput, SimState } from '../../src/sim';

const SEC = TUNING.tickHz;

/** Random moves in chamber 1's room, starting away from the plate and the gate. */
const moveArb: fc.Arbitrary<SimInput> = fc.record({
  moveX: fc.double({ min: -1, max: 1, noNaN: true }),
  moveZ: fc.double({ min: -1, max: 1, noNaN: true }),
  yawRad: fc.double({ min: -3, max: 3, noNaN: true }),
  pitchRad: fc.double({ min: -1, max: 1, noNaN: true }),
  lensHeld: fc.boolean(),
  sprint: fc.boolean(),
  crouch: fc.boolean(),
  interact: fc.constant(false),
  record: fc.constant(false),
  restart: fc.constant(false),
});

describe('echo', () => {
  it('replays your clip exactly: the tape-self walks the path you walked', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(moveArb, fc.integer({ min: 1, max: 20 })), { minLength: 1, maxLength: 6 }), (runs) => {
        const inputs = runs.flatMap(([input, n]) => Array.from({ length: n }, () => input));
        let s = at(createState(1), 2.5, 8.5);
        s = step(s, { ...NEUTRAL_INPUT, record: true });
        expect(s.rec.active).toBe(true);
        const path: Array<{ x: number; y: number }> = [];
        for (const input of inputs) {
          s = step(s, input);
          path.push({ ...s.player.pos });
        }
        s = step(s, { ...NEUTRAL_INPUT, record: true });
        if (inputs.length < TUNING.recordMinSec * SEC) {
          expect(s.ghost).toBeNull();
          return;
        }
        expect(s.ghost).not.toBeNull();
        for (const expected of path) {
          s = step(s, NEUTRAL_INPUT);
          expect(s.ghost?.player.pos.x).toBeCloseTo(expected.x, 9);
          expect(s.ghost?.player.pos.y).toBeCloseTo(expected.y, 9);
        }
      }),
      { numRuns: 40 },
    );
  });

  it('stopping rewinds you to where the clip began', () => {
    let s = at(createState(1), 2.5, 8.5);
    s = tapRecord(s);
    const began = { ...s.player.pos };
    s = drive(s, [{ x: 6.5, y: 8.5 }]);
    expect(Math.hypot(s.player.pos.x - began.x, s.player.pos.y - began.y)).toBeGreaterThan(2);
    s = tapRecord(s);
    expect(s.player.pos.x).toBeCloseTo(began.x, 6);
    expect(s.player.pos.y).toBeCloseTo(began.y, 6);
    expect(s.ghost?.index).toBeLessThanOrEqual(1);
  });

  it('a clip shorter than the minimum is thrown away and you stay put', () => {
    let s = tapRecord(at(createState(1), 2.5, 8.5));
    s = drive(s, [{ x: 3.0, y: 8.5 }]);
    const where = { ...s.player.pos };
    s = step(s, { ...NEUTRAL_INPUT, record: true });
    expect(s.ghost).toBeNull();
    expect(s.rec.active).toBe(false);
    // Not rewound: it only coasted the one tick of its own momentum
    expect(Math.hypot(s.player.pos.x - where.x, s.player.pos.y - where.y)).toBeLessThan(0.1);
  });

  it('the tape stops itself when it runs out', () => {
    let s = tapRecord(at(createState(1), 2.5, 8.5));
    s = wait(s, TUNING.recordMaxSec + 0.5);
    expect(s.rec.active).toBe(false);
    expect(s.ghost).not.toBeNull();
  });

  it('the tape-self stands where the clip ended, and stays there', () => {
    let s = tapRecord(at(createState(1), 2.5, 8.5));
    s = drive(s, [{ x: 4.5, y: 10.5 }]);
    s = tapRecord(wait(s, 0.3));
    s = wait(s, 8);
    const parked = { ...s.ghost?.player.pos };
    s = wait(s, 5);
    expect(s.ghost?.player.pos.x).toBeCloseTo(parked.x ?? NaN, 6);
    expect(s.plates[0]).toBe(true);
  });

  it('a new clip replaces the old echo', () => {
    let s = tapRecord(at(createState(1), 2.5, 8.5));
    s = tapRecord(wait(drive(s, [{ x: 4.5, y: 10.5 }]), 0.3));
    const first = s.ghost;
    s = tapRecord(s);
    s = tapRecord(wait(drive(s, [{ x: 7.5, y: 8.5 }]), 0.3));
    expect(s.ghost).not.toBe(first);
    expect(s.ghost?.log.length).not.toBe(first?.log.length);
  });

  it('leaving the chamber cuts the tape: the echo goes and the gate shuts behind you', () => {
    let s = tapRecord(createState(1));
    s = tapRecord(wait(drive(s, [{ x: 4.5, y: 10.5 }]), 0.4));
    s = drive(s, [{ x: 3.5, y: 9.5 }, { x: 6.5, y: 9.5 }, { x: 10.5, y: 10.5 }, { x: 12.5, y: 10.5 }]);
    expect(s.chamber).toBe(1);
    expect(s.ghost).toBeNull();
    s = wait(s, 4);
    const gate = LEVEL.gates[0];
    expect(gate).toBeDefined();
    expect(s.gates[0]).toBe(false);
  });

  it('a gate never closes on a body standing in it', () => {
    const gate = LEVEL.gates[0];
    if (!gate) throw new Error('gate');
    let s = createState(1);
    s = at(s, gate.cell.cx + 0.5, gate.cell.cy + 0.5);
    s = wait(s, 5);
    expect(s.gates[0]).toBe(true);
  });

  describe('the Thing hunts your echo', () => {
    /** Chamber 3 with the Thing on the south corridor and your echo running east along it. */
    function withEcho(sprint: boolean, crouch: boolean): SimState {
      let s = { ...createState(4), chamber: 2 };
      s = at(s, 23.5, 2.5);
      s = { ...s, thing: { ...s.thing, mode: 'wander', pos: { x: 31.5, y: 10.5 }, targetCell: { cx: 31, cy: 10 } } };
      const log: SimInput[] = Array.from({ length: 240 }, () => ({
        ...NEUTRAL_INPUT,
        yawRad: -Math.PI / 2,
        moveZ: 1,
        sprint,
        crouch,
      }));
      return {
        ...s,
        ghost: { player: { ...s.player, pos: { x: 25.5, y: 10.5 } }, log, index: 0 },
      };
    }

    it('a sprinting echo draws it: it stalks toward the echo, not toward you', () => {
      let s = withEcho(true, false);
      s = wait(s, 0.5);
      expect(s.thing.mode).toBe('stalk');
      expect(s.thing.targetCell?.cy).toBe(10);
    });

    it('a crouching echo is silent: the Thing ignores it', () => {
      let s = withEcho(false, true);
      s = wait(s, 0.5);
      expect(s.thing.mode).toBe('wander');
    });
  });
});
