import { cellCenter } from './grid';
import { LEVEL } from './level';
import { nextRandom } from './rng';
import { dist } from './vec2';
import { TUNING } from './tuning';
import type { Cell } from './grid';
import type { Level } from './level';
import type { Vec2 } from './vec2';

/** 'dormant': nothing here (or the follower is not behind you yet). 'shadow': it follows your route unseen and never attacks. */
export type ThingMode = 'dormant' | 'shadow' | 'wander' | 'stalk' | 'rush' | 'search';

export interface PlayerState {
  pos: Vec2;
  vel: Vec2;
  /** Look direction. Yaw 0 faces -y. Positive yaw turns left. See lens.ts. */
  yawRad: number;
  pitchRad: number;
  crouching: boolean;
  sprinting: boolean;
  /** 0 = lens down, 1 = lens fully up. */
  lensRaise: number;
  /** Set when the battery dies. Cleared once it recharges to the unlock level. */
  lensLocked: boolean;
  /** 0..1 */
  battery: number;
  /** Interact was held last tick. Used for press edges. */
  interactHeld: boolean;
}

export interface ThingState {
  pos: Vec2;
  mode: ThingMode;
  targetCell: Cell | null;
  /** Where a rush is heading: where it last saw you. */
  huntCell: Cell | null;
  /** Ticks idle at a target, remaining in a rush, or remaining in a search. */
  modeTicks: number;
  /** Ticks spent pushing on a closed door. */
  doorTicks: number;
}

/** A clip being recorded: where it began and every input since. */
export interface EchoRecording {
  active: boolean;
  ticks: number;
  start: PlayerState | null;
  log: readonly SimInput[];
}

/** Your tape-self. It replays the clip, then stands where it ended until the chamber changes or you record again. */
export interface Ghost {
  player: PlayerState;
  log: readonly SimInput[];
  /** Next log entry to play. At log.length the ghost is parked. */
  index: number;
}

export interface CatchRecord {
  tick: number;
  playerPos: Vec2;
  thingPos: Vec2;
}

export interface SimState {
  tick: number;
  rng: number;
  /** Index of the furthest chamber reached. Only ever goes up. */
  chamber: number;
  rec: EchoRecording;
  ghost: Ghost | null;
  /** Record was held last tick. Used for press edges. */
  recHeld: boolean;
  /** Restart was held last tick. Used for press edges. */
  restartHeld: boolean;
  /** Times you started a chamber over on purpose. Catches are counted separately. */
  chamberRestarts: number;
  /** One flag per plate: someone is standing on it. */
  plates: boolean[];
  /** One flag per gate: true = open. */
  gates: boolean[];
  /** Ticks each gate stays open after its plates let go. */
  gateHoldTicks: number[];
  player: PlayerState;
  thing: ThingState;
  /** 0..1. At 1 the Thing rushes. */
  notice: number;
  noticeLockTicks: number;
  /** One flag per door: true = open. */
  doors: boolean[];
  /** One flag per tape: true = taken. */
  tapes: boolean[];
  vcrHoldTicks: number;
  exitOpen: boolean;
  won: boolean;
  winTick: number;
  caughtCount: number;
  /** Counts down after a catch so the client can play the rewind. */
  rewindTicksLeft: number;
  /** While above 0 the Thing does not move, hear or notice. Set by a catch. */
  thingGraceTicks: number;
  /** Ticks the Thing has been chewing on your tape-self. At `tapeTearSec` it is gone. */
  tearTicks: number;
  /** While above 0 the Thing keeps out of the entry radius. Set on arrival and on waking. */
  sanctuaryTicks: number;
  /** Your recent route, for the unseen follower. */
  trail: Vec2[];
  lastCatch: CatchRecord | null;
}

export interface SimInput {
  /** Strafe, -1 left to 1 right. */
  moveX: number;
  /** Forward, -1 back to 1 forward. */
  moveZ: number;
  yawRad: number;
  pitchRad: number;
  lensHeld: boolean;
  sprint: boolean;
  crouch: boolean;
  interact: boolean;
  /** Press to start recording a clip, press again to stop and play it back. */
  record: boolean;
  /** Press to start the chamber over: back to its entry, the tape cleared. */
  restart: boolean;
}

export const NEUTRAL_INPUT: SimInput = {
  moveX: 0,
  moveZ: 0,
  yawRad: 0,
  pitchRad: 0,
  lensHeld: false,
  sprint: false,
  crouch: false,
  interact: false,
  record: false,
  restart: false,
};

export function tapesFound(state: Pick<SimState, 'tapes'>): number {
  return state.tapes.filter(Boolean).length;
}

/** Act 1 Closing, 2 Rain, 3 Blackout. Each chamber names its act. */
export function actOf(state: Pick<SimState, 'chamber'>, level: Level = LEVEL): number {
  return level.chambers[state.chamber]?.act ?? 3;
}

/** Lights are out in the VCR room. */
export function isBlackout(state: Pick<SimState, 'chamber'>, level: Level = LEVEL): boolean {
  return state.chamber >= level.chambers.length - 1;
}

export function createPlayer(pos: Vec2): PlayerState {
  return {
    pos: { ...pos },
    vel: { x: 0, y: 0 },
    yawRad: 0,
    pitchRad: 0,
    crouching: false,
    sprinting: false,
    lensRaise: 0,
    lensLocked: false,
    battery: 1,
    interactHeld: false,
  };
}

export function createThing(cell: Cell): ThingState {
  return { pos: cellCenter(cell), mode: 'wander', targetCell: null, huntCell: null, modeTicks: 0, doorTicks: 0 };
}

/** No Thing lives here. Parked far outside the map where nothing can see, hear or catch it. */
export function createDormantThing(): ThingState {
  return { pos: { x: -100, y: -100 }, mode: 'dormant', targetCell: null, huntCell: null, modeTicks: 0, doorTicks: 0 };
}

/** Picks the spawn farthest from `from`, preferring ones at least `thingRespawnMinDistM` away. Uses the rng to break the choice among those. */
export function pickThingSpawn(spawns: readonly Cell[], from: Vec2, rng: number): { cell: Cell; rng: number } {
  const far = spawns.filter((c) => dist(cellCenter(c), from) >= TUNING.thingRespawnMinDistM);
  const pool = far.length > 0 ? far : [...spawns].sort((a, b) => dist(cellCenter(b), from) - dist(cellCenter(a), from)).slice(0, 1);
  const [r, next] = nextRandom(rng);
  const cell = pool[Math.min(pool.length - 1, Math.floor(r * pool.length))];
  if (!cell) throw new Error('chamber has no Thing spawn');
  return { cell, rng: next };
}

/** The Thing that lives in this chamber, or a dormant one when none does. */
export function thingForChamber(level: Level, chamber: number, from: Vec2, rng: number): { thing: ThingState; rng: number } {
  const spawns = level.chambers[chamber]?.thingSpawns ?? [];
  if (spawns.length === 0) return { thing: createDormantThing(), rng };
  const spawn = pickThingSpawn(spawns, from, rng);
  return { thing: createThing(spawn.cell), rng: spawn.rng };
}

export const IDLE_RECORDING: EchoRecording = { active: false, ticks: 0, start: null, log: [] };

export function createState(seed: number, level: Level = LEVEL): SimState {
  const start = level.checkpoints[0];
  if (!start) throw new Error('level has no start');
  const spawned = thingForChamber(level, 0, start, seed | 0);
  return {
    tick: 0,
    rng: spawned.rng,
    chamber: 0,
    rec: IDLE_RECORDING,
    ghost: null,
    recHeld: false,
    restartHeld: false,
    chamberRestarts: 0,
    plates: level.plates.map(() => false),
    gates: level.gates.map(() => false),
    gateHoldTicks: level.gates.map(() => 0),
    player: { ...createPlayer(start), yawRad: level.startYawRad },
    thing: spawned.thing,
    notice: 0,
    noticeLockTicks: 0,
    doors: level.doors.map(() => false),
    tapes: level.tapes.map(() => false),
    vcrHoldTicks: 0,
    exitOpen: false,
    won: false,
    winTick: 0,
    caughtCount: 0,
    rewindTicksLeft: 0,
    thingGraceTicks: 0,
    tearTicks: 0,
    sanctuaryTicks: 0,
    trail: [],
    lastCatch: null,
  };
}
