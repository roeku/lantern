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
import { gone, inChamber, solveChamber1, solveChamber2, solveChamber3, solveChamber4 } from './solutions';
import type { SimInput, SimState } from '../../src/sim';

const SEC = TUNING.tickHz;

describe('acts follow the chamber', () => {
  it('chambers 1 and 2 are act 1, then rain, then blackout in the VCR room', () => {
    expect([0, 1, 2, 3, 4].map((chamber) => actOf({ chamber }))).toEqual([1, 1, 2, 2, 3]);
    expect([0, 1, 2, 3, 4].map((chamber) => isBlackout({ chamber }))).toEqual([false, false, false, false, true]);
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

  function toVcr(): SimState {
    let s = createState(3);
    s = solveChamber1(s);
    s = solveChamber2(gone(s));
    s = solveChamber3(gone(s));
    s = solveChamber4(gone(s));
    return drive(gone(s), [{ x: 45.5, y: 9.5 }, { x: 49.5, y: 9.5 }]);
  }

  it('the whole way through: four chambers, three tapes, then the VCR', () => {
    const s = toVcr();
    expect(s.chamber).toBe(4);
    expect(s.tapes).toEqual([true, true, true]);
    expect(s.caughtCount).toBe(0);
  });
});

/** Arrives in the VCR room the way a player does (through the chamber change), so its Thing and sanctuary start for real. */
function enterVcrRoom(seed: number): SimState {
  let s = { ...createState(seed), tapes: [true, true, true], chamber: 3 };
  s = at(s, 44.9, 10.5);
  return drive(s, [{ x: 45.5, y: 10.5 }]);
}

/** F while crouched: starts a clip from where you are (the alcove) and keeps you low. */
function recordCrouched(s: SimState, yaw: number): SimState {
  const a = step(s, { ...NEUTRAL_INPUT, yawRad: yaw, crouch: true, record: true });
  return step(a, { ...NEUTRAL_INPUT, yawRad: yaw, crouch: true });
}

describe('the VCR room: one solution a stranger can read', () => {
  /**
   * Start recording from the alcove, walk to the VCR, stop. Rewound, you are back in the alcove, crouched and hidden,
   * while your tape-self walks out, parks at the VCR and plays the tape. The Thing goes for the noise and chews it.
   * If it tears the tape before the tape has played, record again once it has slunk off.
   */
  function solve(seed: number): { state: SimState; clips: number } {
    let s = enterVcrRoom(seed);
    s = drive(s, [{ x: 48.5, y: 8.5 }, { x: 48.5, y: 6.5 }]);
    s = wait(s, 0.3, { crouch: true });
    let clips = 0;
    while (!s.exitOpen && clips < 3 && s.caughtCount === 0) {
      clips += 1;
      s = recordCrouched(s, s.player.yawRad);
      s = drive(s, [{ x: 48.5, y: 8.5 }, { x: 49.5, y: 9.5 }]);
      s = wait(s, 0.4, { yawRad: Math.PI });
      const stop = step(s, { ...NEUTRAL_INPUT, yawRad: Math.PI, record: true });
      s = step(stop, { ...NEUTRAL_INPUT, yawRad: Math.PI, crouch: true });
      for (let i = 0; i < 25 * SEC && !s.exitOpen && s.ghost; i++) s = step(s, { ...NEUTRAL_INPUT, crouch: true });
      if (!s.exitOpen && !s.ghost) s = wait(s, 6, { crouch: true });
    }
    return { state: s, clips };
  }

  it('plays the tape in one or two clips, and never gets you caught, whatever the seed', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { state, clips } = solve(seed);
      expect(state.exitOpen, `seed ${seed}`).toBe(true);
      expect(state.caughtCount, `seed ${seed}`).toBe(0);
      expect(clips, `seed ${seed}`).toBeLessThanOrEqual(2);
    }
  });

  it('fails without the tape-self: holding the tape yourself gets you caught long before it has played', () => {
    for (let seed = 1; seed <= 12; seed++) {
      let s = drive(enterVcrRoom(seed), [{ x: 45.5, y: 9.5 }, { x: 49.5, y: 9.5 }]);
      for (let i = 0; i < 20 * SEC && !s.exitOpen && s.caughtCount === 0; i++) s = step(s, { ...NEUTRAL_INPUT, yawRad: Math.PI, interact: true });
      expect(s.exitOpen, `seed ${seed}`).toBe(false);
      expect(s.caughtCount, `seed ${seed}`).toBe(1);
    }
  });

  it('then you walk out of the door and win', () => {
    let s = solve(5).state;
    expect(s.exitOpen).toBe(true);
    s = drive(s, [{ x: 48.5, y: 8.5 }, { x: 52.5, y: 9.5 }, { x: 53.5, y: 11.0 }, { x: 53.5, y: 12.0 }], true);
    expect(s.won).toBe(true);
  });

  it('your tape-self counts double: it needs half the time you would', () => {
    let s = gone(enterVcrRoom(1));
    const front = { x: LEVEL.vcr.cx + 0.5, y: LEVEL.vcr.cy - 0.5 };
    s = { ...s, ghost: { player: { ...s.player, pos: front, yawRad: Math.PI }, log: [{ ...NEUTRAL_INPUT, yawRad: Math.PI }], index: 1 } };
    s = at(s, 48.5, 6.5);
    s = wait(s, TUNING.vcrHoldSec / TUNING.echoVcrHoldRate + 0.3, { crouch: true });
    expect(s.exitOpen).toBe(true);
  });

  it('the Thing chews the tape for a moment (which keeps playing), then it is gone and the Thing slinks off', () => {
    let s = gone(enterVcrRoom(2));
    const front = { x: LEVEL.vcr.cx + 0.5, y: LEVEL.vcr.cy - 0.5 };
    s = { ...s, ghost: { player: { ...s.player, pos: front, yawRad: Math.PI }, log: [{ ...NEUTRAL_INPUT, yawRad: Math.PI }], index: 1 } };
    s = at(s, 48.5, 6.5);
    s = { ...s, thing: { ...s.thing, mode: 'wander', pos: { x: front.x + 0.3, y: front.y }, targetCell: { cx: 49, cy: 9 } } };
    s = wait(s, TUNING.tapeTearSec / 2, { crouch: true });
    expect(s.ghost).not.toBeNull();
    const mid = s.vcrHoldTicks;
    s = wait(s, TUNING.tapeTearSec, { crouch: true });
    expect(s.ghost).toBeNull();
    expect(s.vcrHoldTicks).toBeGreaterThan(mid);
    // It heads for the far side, not toward the alcove
    const target = s.thing.targetCell;
    expect(target).not.toBeNull();
    expect(Math.hypot((target?.cx ?? 0) - front.x, (target?.cy ?? 0) - front.y)).toBeGreaterThan(5);
    expect(s.caughtCount).toBe(0);
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
