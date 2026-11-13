import { expect } from 'vitest';
import { createDormantThing, LEVEL, NEUTRAL_INPUT, step, TUNING } from '../../src/sim';
import { cellCenter } from '../../src/sim/grid';
import { at, drive, tapRecord, wait } from './drive';
import type { SimState } from '../../src/sim';

/**
 * The intended solution to every room, as a script of the keys a player would press. They are the room's proof of
 * solvability: each must pass, and each has a test that it fails without the tool it teaches.
 * Chambers are numbered from 1 here, as the player sees them.
 */

const SEC = TUNING.tickHz;

/** Puts the run in chamber `n` (0 based) with the player at its entry and a live Thing parked far away in it. */
export function inChamber(state: SimState, n: number): SimState {
  const entry = LEVEL.checkpoints[n];
  const spawn = LEVEL.chambers[n]?.thingSpawns[0];
  if (!entry) throw new Error('entry');
  const thing = spawn ? { ...state.thing, mode: 'wander' as const, pos: cellCenter(spawn), targetCell: spawn } : createDormantThing();
  return { ...at(state, entry.x, entry.y), chamber: n, thing };
}

/** No Thing at all, so a script that does not look or hide is not at the mercy of chance. */
export const gone = (s: SimState): SimState => ({ ...s, thing: createDormantThing() });

/** Chamber 1: record a walk to the plate. Your echo holds it while you walk to the gate. */
export function solveChamber1(from: SimState): SimState {
  let s = tapRecord(from);
  s = drive(s, [{ x: 4.5, y: 10.5 }]);
  s = wait(s, 0.4);
  s = tapRecord(s);
  expect(s.ghost).not.toBeNull();
  return drive(s, [{ x: 3.5, y: 9.5 }, { x: 6.5, y: 9.5 }, { x: 10.5, y: 10.5 }, { x: 12.5, y: 10.5 }]);
}

/** Chamber 2: your echo takes the far plate. You stand on the near one, then go for the gate. */
export function solveChamber2(from: SimState): SimState {
  let s = tapRecord(from);
  s = drive(s, [{ x: 13.5, y: 2.5 }]);
  s = wait(s, 0.4);
  s = tapRecord(s);
  s = drive(s, [{ x: 19.5, y: 9.5 }, { x: 20.5, y: 4.5 }]);
  for (let i = 0; i < 20 * SEC && s.gates[1] !== true; i++) s = step(s, NEUTRAL_INPUT);
  expect(s.gates[1]).toBe(true);
  // At a walk: the gate stays open long enough that nobody has to sprint
  return drive(s, [{ x: 21.5, y: 3.5 }, { x: 21.5, y: 2.5 }, { x: 23.5, y: 2.5 }]);
}

/** Chamber 3: record the long walk to the plate in the far corner. Your echo parks there while you cross the short way. */
export function solveChamber3(from: SimState): SimState {
  let s = tapRecord(from);
  s = drive(s, [{ x: 23.5, y: 9.5 }, { x: 24.5, y: 10.5 }]);
  s = wait(s, 0.4);
  s = tapRecord(s);
  s = drive(s, [{ x: 30.5, y: 2.5 }, { x: 32.5, y: 2.5 }]);
  for (let i = 0; i < 30 * SEC && s.gates[2] !== true; i++) s = step(s, NEUTRAL_INPUT);
  return drive(s, [{ x: 33.5, y: 2.5 }, { x: 34.5, y: 2.5 }]);
}

/** Chamber 4: your echo holds the far plate, which opens the inner gate. You go in and stand on the plate in there. */
export function solveChamber4(from: SimState): SimState {
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

/** The shadowed chambers have a script that needs no Thing handling; the others are covered by their own tests. */
export const SOLVERS: ReadonlyArray<{ chamber: number; solve: (s: SimState) => SimState }> = [
  { chamber: 0, solve: solveChamber1 },
  { chamber: 1, solve: solveChamber2 },
  { chamber: 3, solve: solveChamber4 },
];
