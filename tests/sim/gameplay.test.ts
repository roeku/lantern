import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  actOf,
  chamberAt,
  createDormantThing,
  createState,
  isBlackout,
  LEVEL,
  NEUTRAL_INPUT,
  step,
  TUNING,
} from '../../src/sim';
import { cellCenter } from '../../src/sim/grid';
import { at, drive, run, tapRecord, wait } from './drive';
import type { Finale, SimInput, SimState } from '../../src/sim';

const SEC = TUNING.tickHz;

/** Puts the run in chamber `n` with the player at its entry and a live Thing parked far away in it. */
function inChamber(state: SimState, n: number): SimState {
  const entry = LEVEL.checkpoints[n];
  const spawn = LEVEL.chambers[n]?.thingSpawns[0];
  if (!entry) throw new Error('entry');
  const thing = spawn ? { ...state.thing, mode: 'wander' as const, pos: cellCenter(spawn), targetCell: spawn } : createDormantThing();
  return { ...at(state, entry.x, entry.y), chamber: n, thing };
}

const gone = (s: SimState): SimState => ({ ...s, thing: createDormantThing() });

describe('acts follow the chamber', () => {
  it('chambers 1 and 2 are act 1, then rain, then blackout in the VCR room', () => {
    expect([0, 1, 2, 3, 4].map((chamber) => actOf({ chamber }))).toEqual([1, 1, 2, 2, 3]);
    expect(isBlackout({ chamber: 3, finale: 'hold', exitOpen: false })).toBe(false);
    expect(isBlackout({ chamber: 4, finale: 'hold', exitOpen: false })).toBe(true);
    expect(isBlackout({ chamber: 4, finale: 'run', exitOpen: false })).toBe(false);
    expect(isBlackout({ chamber: 4, finale: 'run', exitOpen: true })).toBe(true);
  });
});

describe('hiding', () => {
  const huntable = LEVEL.hides.filter((h) => (LEVEL.chambers[chamberAt(LEVEL, cellCenter(h))]?.thingSpawns.length ?? 0) > 0);

  it('a still, crouched, lens-down player in an alcove is never caught by a rush', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...huntable), (seed, hide) => {
        const chamber = chamberAt(LEVEL, cellCenter(hide));
        let s = inChamber(createState(seed), chamber);
        s = at(s, hide.cx + 0.5, hide.cy + 0.5);
        const spawn = LEVEL.chambers[chamber]?.thingSpawns[0];
        if (!spawn) throw new Error('spawn');
        s = { ...s, notice: 1, thing: { ...s.thing, pos: cellCenter(spawn), mode: 'rush', huntCell: hide, modeTicks: 20 * SEC } };
        const hidden: SimInput = { ...NEUTRAL_INPUT, crouch: true };
        for (let i = 0; i < 40 * SEC; i++) {
          s = step(s, hidden);
          expect(s.caughtCount).toBe(0);
        }
      }),
      { numRuns: 30 },
    );
  });

  it('raising the lens while the Thing searches gets you caught', () => {
    const hide = huntable[0];
    if (!hide) throw new Error('no hide');
    let s = inChamber(createState(5), chamberAt(LEVEL, cellCenter(hide)));
    s = at(s, hide.cx + 0.5, hide.cy + 0.5);
    s = { ...s, notice: 1, thing: { ...s.thing, pos: { x: hide.cx + 0.5, y: hide.cy - 0.5 }, mode: 'search', modeTicks: 3 * SEC } };
    s = run(s, { ...NEUTRAL_INPUT, crouch: true, lensHeld: true }, 2 * SEC);
    expect(s.caughtCount).toBe(1);
  });
});

describe('fairness', () => {
  it('a catch wakes you at the entry of your chamber, keeps the tapes, and clears the echo', () => {
    let s = inChamber(createState(9), 2);
    s = { ...s, tapes: [true, true, false] };
    s = tapRecord(at(s, 27.5, 2.5));
    expect(s.rec.active).toBe(true);
    s = { ...s, thing: { ...s.thing, pos: { x: s.player.pos.x + 0.2, y: s.player.pos.y } } };
    s = step(s, NEUTRAL_INPUT);
    expect(s.caughtCount).toBe(1);
    expect(s.tapes).toEqual([true, true, false]);
    expect(s.player.pos).toEqual(LEVEL.checkpoints[2]);
    expect(s.rec.active).toBe(false);
    expect(s.ghost).toBeNull();
    expect(s.chamber).toBe(2);
  });

  it('the Thing wakes far from the entry when the chamber allows it', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...LEVEL.chambers.flatMap((c, i) => (c.thingSpawns.length > 0 ? [i] : []))), (seed, chamber) => {
        let s = inChamber(createState(seed), chamber);
        s = { ...s, thing: { ...s.thing, pos: { x: s.player.pos.x + 0.2, y: s.player.pos.y } } };
        s = step(s, NEUTRAL_INPUT);
        expect(s.caughtCount).toBe(1);
        const entry = LEVEL.checkpoints[chamber];
        if (!entry) throw new Error('entry');
        expect(Math.hypot(s.thing.pos.x - entry.x, s.thing.pos.y - entry.y)).toBeGreaterThan(TUNING.catchRadiusM * 4);
      }),
    );
  });
});

describe('the night can be solved', () => {
  /** Chamber 1: record a walk to the plate. Your echo holds it while you walk to the gate. */
  function solveChamber1(from: SimState): SimState {
    let s = tapRecord(from);
    s = drive(s, [{ x: 4.5, y: 10.5 }]);
    s = wait(s, 0.4);
    s = tapRecord(s);
    expect(s.ghost).not.toBeNull();
    return drive(s, [{ x: 3.5, y: 9.5 }, { x: 6.5, y: 9.5 }, { x: 10.5, y: 10.5 }, { x: 12.5, y: 10.5 }]);
  }

  /** Chamber 2: your echo takes the far plate. You stand on the near one, then run for the gate. */
  function solveChamber2(from: SimState): SimState {
    let s = tapRecord(from);
    s = drive(s, [{ x: 13.5, y: 2.5 }]);
    s = wait(s, 0.4);
    s = tapRecord(s);
    s = drive(s, [{ x: 19.5, y: 9.5 }, { x: 20.5, y: 4.5 }]);
    for (let i = 0; i < 20 * SEC && s.gates[1] !== true; i++) s = step(s, NEUTRAL_INPUT);
    expect(s.gates[1]).toBe(true);
    return drive(s, [{ x: 21.5, y: 3.5 }, { x: 21.5, y: 2.5 }, { x: 23.5, y: 2.5 }], true);
  }

  /** Chamber 3: record the long walk to the plate in the far corner. Your echo parks there while you cross the short way. */
  function solveChamber3(from: SimState): SimState {
    let s = tapRecord(from);
    s = drive(s, [{ x: 23.5, y: 9.5 }, { x: 24.5, y: 10.5 }]);
    s = wait(s, 0.4);
    s = tapRecord(s);
    s = drive(s, [{ x: 30.5, y: 2.5 }, { x: 32.5, y: 2.5 }]);
    for (let i = 0; i < 30 * SEC && s.gates[2] !== true; i++) s = step(s, NEUTRAL_INPUT);
    return drive(s, [{ x: 33.5, y: 2.5 }, { x: 34.5, y: 2.5 }]);
  }

  it('chamber 1 opens only with your echo on the plate', () => {
    const start = createState(1);
    const s = solveChamber1(start);
    expect(s.chamber).toBe(1);
    expect(s.tapes).toEqual([true, false, false]);
  });

  it('chamber 1 cannot be beaten alone, even at a sprint', () => {
    let s = drive(createState(1), [{ x: 4.5, y: 10.5 }]);
    s = drive(s, [{ x: 10.5, y: 10.5 }, { x: 12.5, y: 10.5 }], true);
    s = wait(s, 5);
    expect(s.chamber).toBe(0);
  });

  it('chamber 2 opens with you on one plate and your echo on the other, and not with either alone', () => {
    const entry = (): SimState => ({ ...inChamber(createState(2), 1), tapes: [true, false, false] });
    const s = solveChamber2(entry());
    expect(s.chamber).toBe(2);
    expect(s.tapes).toEqual([true, true, false]);

    let alone = drive(entry(), [{ x: 19.5, y: 9.5 }, { x: 20.5, y: 4.5 }]);
    alone = wait(alone, 5);
    expect(alone.gates[1]).toBe(false);
    let onlyEcho = tapRecord(entry());
    onlyEcho = drive(onlyEcho, [{ x: 13.5, y: 2.5 }]);
    onlyEcho = tapRecord(wait(onlyEcho, 0.4));
    onlyEcho = wait(onlyEcho, 10);
    expect(onlyEcho.gates[1]).toBe(false);
  });

  it('chamber 3 opens when your echo parks on the far plate, and closes behind you', () => {
    const entry = (): SimState => gone({ ...inChamber(createState(3), 2), tapes: [true, true, false] });
    const s = solveChamber3(entry());
    expect(s.chamber).toBe(3);
    expect(s.tapes).toEqual([true, true, false]);
    expect(s.ghost).toBeNull();
    const later = wait(s, 4, { yawRad: -Math.PI / 2 });
    expect(later.gates[2]).toBe(false);
  });

  it('chamber 3 cannot be beaten alone', () => {
    let s = gone({ ...inChamber(createState(3), 2), tapes: [true, true, false] });
    s = drive(s, [{ x: 23.5, y: 9.5 }, { x: 24.5, y: 10.5 }]);
    s = drive(s, [{ x: 30.5, y: 2.5 }, { x: 32.5, y: 2.5 }, { x: 34.5, y: 2.5 }], true);
    expect(s.chamber).toBe(2);
  });

  /** Chamber 4: your echo holds the far plate, which opens the inner gate. You go in and stand on the plate in there. */
  function solveChamber4(from: SimState): SimState {
    let s = tapRecord(from);
    s = drive(s, [{ x: 34.5, y: 11.5 }]);
    s = tapRecord(wait(s, 0.4));
    expect(s.ghost).not.toBeNull();
    s = drive(s, [{ x: 41.5, y: 5.5 }]);
    for (let i = 0; i < 15 * SEC && s.gates[3] !== true; i++) s = step(s, NEUTRAL_INPUT);
    expect(s.gates[3]).toBe(true);
    s = drive(s, [{ x: 41.5, y: 7.5 }, { x: 42.5, y: 10.5 }]);
    for (let i = 0; i < 5 * SEC && s.gates[4] !== true; i++) s = step(s, NEUTRAL_INPUT);
    expect(s.gates[4]).toBe(true);
    return drive(s, [{ x: 43.5, y: 10.5 }, { x: 45.5, y: 10.5 }]);
  }

  const chainEntry = (): SimState => ({ ...inChamber(createState(4), 3), tapes: [true, true, false] });

  it('chamber 4: your echo holds the far plate, you take the one inside and walk out', () => {
    const s = solveChamber4(chainEntry());
    expect(s.chamber).toBe(4);
    expect(s.tapes).toEqual([true, true, true]);
  });

  it('chamber 4 cannot be beaten alone: the inner gate stays shut and the plate behind it is out of reach', () => {
    let s = drive(chainEntry(), [{ x: 34.5, y: 11.5 }]);
    s = drive(s, [{ x: 41.5, y: 5.5 }, { x: 41.5, y: 7.5 }], true, 6);
    expect(s.player.pos.y).toBeLessThan(6.5);
    expect(s.plates[4]).toBe(false);
  });

  function toVcr(finale: Finale): SimState {
    let s = createState(3, finale);
    s = solveChamber1(s);
    s = solveChamber2(gone(s));
    s = solveChamber3(gone(s));
    s = solveChamber4(gone(s));
    return drive(gone(s), [{ x: 45.5, y: 9.5 }, { x: 49.5, y: 9.5 }]);
  }

  it('the whole way through: four chambers, three tapes, then the VCR', () => {
    const s = toVcr('hold');
    expect(s.chamber).toBe(4);
    expect(s.tapes).toEqual([true, true, true]);
    expect(s.caughtCount).toBe(0);
  });

  it('hold finale: the exit opens once the tape has played, and stays shut before', () => {
    let s = toVcr('hold');
    s = run(gone(s), { ...NEUTRAL_INPUT, yawRad: Math.PI, interact: true }, 5 * SEC);
    expect(s.exitOpen).toBe(false);
    expect(s.vcrHoldTicks).toBeGreaterThan(0);
    s = run(gone(s), { ...NEUTRAL_INPUT, yawRad: Math.PI, interact: true }, 20 * SEC);
    expect(s.exitOpen).toBe(true);
  });

  it('run finale: play the tape, then reach the exit before the Thing', () => {
    let s = toVcr('run');
    s = run(gone(s), { ...NEUTRAL_INPUT, yawRad: Math.PI, interact: true }, 3 * SEC);
    expect(s.exitOpen).toBe(true);
    expect(s.rage).toBe(true);
    s = drive(s, [{ x: 52.5, y: 9.5 }, { x: 53.5, y: 10.5 }, { x: 53.5, y: 12.0 }], true);
    expect(s.caughtCount).toBe(0);
    expect(s.won).toBe(true);
  });
});

describe('the VCR room is solved with your tape-self', () => {
  /** The VCR room with all three tapes, and your tape-self parked at the VCR holding E. */
  function echoAtVcr(seed: number): SimState {
    let s = inChamber({ ...createState(seed, 'hold'), tapes: [true, true, true] }, 4);
    const front = { x: LEVEL.vcr.cx + 0.5, y: LEVEL.vcr.cy - 0.5 };
    const hold: SimInput = { ...NEUTRAL_INPUT, yawRad: Math.PI, interact: true };
    s = { ...s, ghost: { player: { ...s.player, pos: front, yawRad: Math.PI }, log: [hold], index: 1 } };
    const hide = LEVEL.hides.find((h) => h.cx === 48);
    if (!hide) throw new Error('hide');
    return at(s, hide.cx + 0.5, hide.cy + 0.5);
  }

  it('your tape-self holding the VCR plays the tape while you are somewhere else', () => {
    let s = gone(echoAtVcr(1));
    s = wait(s, TUNING.vcrHoldSecHold + 0.5, { crouch: true });
    expect(s.exitOpen).toBe(true);
  });

  it('the Thing goes for the loud tape-self and tears it, and you, hidden, are not caught', () => {
    let s = echoAtVcr(2);
    s = { ...s, thing: { ...s.thing, mode: 'wander', pos: { x: 53.5, y: 9.5 }, targetCell: { cx: 53, cy: 9 } } };
    for (let i = 0; i < 15 * SEC && s.ghost; i++) s = step(s, { ...NEUTRAL_INPUT, crouch: true });
    expect(s.ghost).toBeNull();
    expect(s.caughtCount).toBe(0);
    expect(s.vcrHoldTicks).toBeGreaterThan(0);
  });
});

describe('waking up', () => {
  it('after a catch the Thing stands still for the grace period, then moves again', () => {
    let s = inChamber(createState(9), 2);
    s = { ...s, thing: { ...s.thing, pos: { x: s.player.pos.x + 0.2, y: s.player.pos.y } } };
    s = step(s, NEUTRAL_INPUT);
    expect(s.caughtCount).toBe(1);
    const woke = { ...s.thing.pos };
    s = wait(s, TUNING.wakeGraceSec - 0.1);
    expect(s.thing.pos).toEqual(woke);
    expect(s.notice).toBe(0);
    s = wait(s, 2);
    expect(s.thing.pos).not.toEqual(woke);
  });
});

describe('starting a chamber over', () => {
  it('one press puts you back at the entry with the tape, plates and gates cleared and the tapes kept', () => {
    let s = { ...inChamber(createState(6), 1), tapes: [true, false, false] };
    s = tapRecord(s);
    s = drive(s, [{ x: 13.5, y: 2.5 }]);
    s = tapRecord(wait(s, 0.4));
    s = drive(s, [{ x: 19.5, y: 9.5 }, { x: 20.5, y: 4.5 }]);
    s = wait(s, 8);
    expect(s.gates[1]).toBe(true);
    s = step(s, { ...NEUTRAL_INPUT, restart: true });
    expect(s.player.pos).toEqual(LEVEL.checkpoints[1]);
    expect(s.ghost).toBeNull();
    expect(s.rec.active).toBe(false);
    expect(s.plates.every((p) => !p)).toBe(true);
    s = wait(s, 3);
    expect(s.gates[1]).toBe(false);
    expect(s.chamber).toBe(1);
    expect(s.tapes).toEqual([true, false, false]);
    expect(s.chamberRestarts).toBe(1);
    expect(s.caughtCount).toBe(0);
  });

  it('holding the key does not repeat: one restart per press', () => {
    let s = at(createState(1), 6.5, 9.5);
    for (let i = 0; i < 30; i++) s = step(s, { ...NEUTRAL_INPUT, restart: true });
    expect(s.chamberRestarts).toBe(1);
  });
});
