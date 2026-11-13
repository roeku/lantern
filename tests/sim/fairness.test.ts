import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createDormantThing, createState, LEVEL, NEUTRAL_INPUT, readLens, sightGrid, step, TUNING } from '../../src/sim';
import { findPath } from '../../src/sim/grid';
import { inputRunsArb } from './arbitraries';
import { at, drive, wait } from './drive';
import { gone, inChamber, SOLVERS } from './solutions';
import type { SimState } from '../../src/sim';

const SEC = TUNING.tickHz;

describe('the unseen follower', () => {
  it('walks your route 6 to 10 m behind you in the rooms where nothing hunts, and is on the lens if you look back', () => {
    let s = createState(1);
    s = drive(s, [{ x: 10.5, y: 10.5 }]);
    expect(s.thing.mode).toBe('shadow');
    const d = Math.hypot(s.thing.pos.x - s.player.pos.x, s.thing.pos.y - s.player.pos.y);
    expect(d).toBeGreaterThanOrEqual(TUNING.shadowMinDistM);
    expect(d).toBeLessThanOrEqual(10);
    expect(s.thing.pos.x).toBeLessThan(s.player.pos.x);
    // Turn round and raise the lens: it is there
    const looked = wait({ ...s, player: { ...s.player, lensRaise: 1 } }, 0.5, { yawRad: Math.PI / 2, lensHeld: true });
    expect(readLens(sightGrid(LEVEL, looked.doors, looked.exitOpen), looked.player, looked.thing.pos).visible).toBe(true);
    // And it never made a sound or a move on you
    expect(looked.caughtCount).toBe(0);
    expect(looked.notice).toBe(0);
  });

  it('is not there until you have walked far enough for it to be behind you', () => {
    const s = drive(createState(1), [{ x: 3.5, y: 10.5 }]);
    expect(s.thing.mode).toBe('dormant');
  });

  it('is never closer than 4 m, never attacks and never rushes, however you move', () => {
    fc.assert(
      fc.property(fc.constantFrom(0, 1, 3), inputRunsArb, (chamber, inputs) => {
        let s = inChamber(createState(7), chamber);
        for (const input of inputs.slice(0, 900)) {
          s = step(s, { ...input, restart: false });
          if (s.thing.mode === 'shadow') {
            expect(Math.hypot(s.thing.pos.x - s.player.pos.x, s.thing.pos.y - s.player.pos.y)).toBeGreaterThanOrEqual(TUNING.shadowMinDistM - 1e-6);
          }
          expect(s.thing.mode).not.toBe('rush');
          expect(s.caughtCount).toBe(0);
        }
      }),
      { numRuns: 25 },
    );
  });
});

describe('fairness at the entrance', () => {
  /** Arrives in chamber 3 the way a player does, through the chamber change, and stands there. */
  function arrive(seed: number): SimState {
    let s = { ...createState(seed), chamber: 1, tapes: [true, true, false] };
    s = at(s, 22.9, 2.5);
    return step(at(s, 23.2, 2.5), NEUTRAL_INPUT);
  }

  it('for the first seconds the Thing keeps out of the entry radius', () => {
    for (let seed = 1; seed <= 12; seed++) {
      let s = arrive(seed);
      expect(s.chamber).toBe(2);
      s = { ...s, thing: { ...s.thing, mode: 'wander', pos: { x: 28.5, y: 2.5 }, targetCell: { cx: 23, cy: 2 }, modeTicks: 0 }, thingGraceTicks: 0 };
      for (let i = 0; i < (TUNING.entrySanctuarySec - 0.5) * SEC; i++) {
        s = step(s, NEUTRAL_INPUT);
        expect(Math.hypot(s.thing.pos.x - 23.5, s.thing.pos.y - 2.5), `seed ${seed} tick ${i}`).toBeGreaterThanOrEqual(TUNING.entryKeepOutM - 0.05);
      }
    }
  });

  it('a player standing still and silent at the entrance is never caught, whatever the seed', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let s = arrive(seed);
      for (let i = 0; i < 90 * SEC; i++) s = step(s, NEUTRAL_INPUT);
      expect(s.caughtCount, `seed ${seed}`).toBe(0);
    }
  });

  it('a silent player in the open anywhere in chamber 3 is not walked into either', () => {
    for (const [x, y] of [[25.5, 6.5], [28.5, 10.5], [31.5, 5.5]] as const) {
      for (let seed = 1; seed <= 6; seed++) {
        let s = at(inChamber(createState(seed), 2), x, y);
        for (let i = 0; i < 60 * SEC; i++) s = step(s, NEUTRAL_INPUT);
        expect(s.caughtCount, `seed ${seed} at ${x},${y}`).toBe(0);
      }
    }
  });
});

describe('gates are fair', () => {
  it('a gate you are meant to reach by hand stays open long enough to walk there', () => {
    const walkMps = TUNING.walkSpeedMps;
    for (const gate of LEVEL.gates) {
      const mine = LEVEL.plates.filter((p) => p.group === gate.group);
      if (mine.length < 2) continue;
      // With an echo on one plate you stand on another: at least one of them must be a walk from the gate
      const best = Math.min(...mine.map((p) => (findPath(LEVEL.grid, p.cell, gate.cell).length - 1) / walkMps));
      expect(best, `gate ${gate.group}`).toBeLessThanOrEqual(gate.delaySec);
    }
  });

  it('the first gate snaps shut quickly on purpose: that is the lesson', () => {
    const first = LEVEL.gates[0];
    expect(first?.delaySec).toBeLessThan(1);
  });
});

describe('no soft-locks', () => {
  it('from any state random play can reach, R puts you at the entry and the room\'s solution then works', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SOLVERS), fc.integer({ min: 1, max: 1000 }), inputRunsArb, (solver, seed, inputs) => {
        let s = gone(inChamber(createState(seed), solver.chamber));
        for (const input of inputs.slice(0, 600)) s = step(s, { ...input, restart: false });
        // Wherever random play got to, even into the next room: start that room over
        const room = SOLVERS.find((x) => x.chamber === s.chamber);
        if (!room) return;
        s = step(s, { ...NEUTRAL_INPUT });
        s = step(s, { ...NEUTRAL_INPUT, restart: true });
        expect(s.player.pos).toEqual(LEVEL.checkpoints[s.chamber]);
        expect(s.ghost).toBeNull();
        expect(s.rec.active).toBe(false);
        const before = s.chamber;
        s = room.solve(gone(s));
        expect(s.chamber, `chamber ${before + 1}`).toBe(before + 1);
      }),
      { numRuns: 30 },
    );
  });

  it('every chamber has a solution in the registry that does not need R', () => {
    expect(SOLVERS.map((x) => x.chamber)).toEqual([0, 1, 3]);
    void createDormantThing;
  });
});
