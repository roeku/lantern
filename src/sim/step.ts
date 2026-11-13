import { ghostInteracting, stepEcho, stepGhost } from './echo';
import { cellCenter, cellOf } from './grid';
import { platesDown, stepGates } from './gates';
import { findInteraction } from './interact';
import { LEVEL } from './level';
import { readLens } from './lens';
import { stepNotice } from './notice';
import { noiseRadiusM, stepPlayer } from './player';
import { shadowPos, pushTrail } from './shadow';
import { actOf, createDormantThing, createPlayer, IDLE_RECORDING, thingForChamber } from './state';
import { perAct, secToTicks, TUNING } from './tuning';
import { retreat, startRush, stepThing } from './thing';
import { dist } from './vec2';
import { chamberAt, doorCenter, guardCells, isHidden, playerGrid, sightGrid, thingGrid } from './world';
import type { Level } from './level';
import type { SimInput, SimState } from './state';
import type { NoiseSource } from './thing';

export function vcrHoldNeedTicks(): number {
  return secToTicks(TUNING.vcrHoldSec);
}

/** 0..1 progress of the tape playing. */
export function vcrProgress(state: Pick<SimState, 'vcrHoldTicks' | 'exitOpen'>): number {
  return state.exitOpen ? 1 : Math.min(1, state.vcrHoldTicks / vcrHoldNeedTicks());
}

/**
 * One 60 Hz tick. Pure: never mutates its arguments.
 * Order: player and tape-self move, chamber change, record, interaction, plates and gates,
 * lens reading, notice, Thing, catch, win.
 */
function cellCenterOf(p: { x: number; y: number } | undefined): { x: number; y: number } | null {
  return p ?? null;
}

/**
 * Wakes you at the entry of your chamber: the tape, plates and gates cleared, a fresh Thing that stands still for the
 * grace period. Tapes, doors and VCR progress are kept. Shared by a catch and by starting the chamber over.
 */
function wakeAtEntry(state: SimState, level: Level, input: SimInput, battery: number): SimState {
  const wake = level.checkpoints[state.chamber];
  if (!wake) throw new Error('missing checkpoint');
  const fresh = thingForChamber(level, state.chamber, wake, state.rng);
  return {
    ...state,
    rng: fresh.rng,
    rec: IDLE_RECORDING,
    ghost: null,
    recHeld: input.record,
    restartHeld: input.restart,
    plates: level.plates.map(() => false),
    gates: level.gates.map(() => false),
    gateHoldTicks: level.gates.map(() => 0),
    player: { ...createPlayer(wake), battery },
    thing: fresh.thing,
    notice: 0,
    noticeLockTicks: 0,
    rewindTicksLeft: secToTicks(TUNING.rewindRestartSec),
    thingGraceTicks: secToTicks(TUNING.wakeGraceSec),
    sanctuaryTicks: secToTicks(TUNING.entrySanctuarySec),
    tearTicks: 0,
    trail: [],
  };
}

export function step(state: SimState, input: SimInput, level: Level = LEVEL): SimState {
  if (state.won) return state;

  // Start the chamber over: one press, back to its entry. Never a reload, never the whole night.
  if (input.restart && !state.restartHeld) {
    const woken = wakeAtEntry(state, level, input, state.player.battery);
    return { ...woken, tick: state.tick + 1, chamberRestarts: state.chamberRestarts + 1 };
  }

  const walls = playerGrid(level, state.doors, state.exitOpen, state.gates);
  const sight = sightGrid(level, state.doors, state.exitOpen);
  let player = stepPlayer(walls, state.player, input);
  let ghost = state.ghost ? stepGhost(walls, state.ghost) : null;
  let rec = state.rec;
  let rng = state.rng;
  let thing = state.thing;
  let notice = state.notice;
  let noticeLockTicks = state.noticeLockTicks;
  let sanctuaryTicks = Math.max(0, state.sanctuaryTicks - 1);
  let trail = state.trail;

  // Walking into a new chamber cuts the tape: the old echo goes, a new Thing (or none) takes the floor
  const chamber = Math.max(state.chamber, chamberAt(level, player.pos));
  if (chamber !== state.chamber) {
    const fresh = thingForChamber(level, chamber, player.pos, rng);
    thing = fresh.thing;
    rng = fresh.rng;
    notice = 0;
    noticeLockTicks = 0;
    ghost = null;
    rec = IDLE_RECORDING;
    sanctuaryTicks = secToTicks(TUNING.entrySanctuarySec);
    trail = [];
  } else {
    const recPressed = input.record && !state.recHeld;
    const echo = stepEcho(rec, ghost, player, input, recPressed);
    rec = echo.rec;
    ghost = echo.ghost;
    player = echo.player;
  }

  const act = actOf({ chamber }, level);
  const hidden = isHidden(level, player);

  // In the chambers where nothing hunts you it still follows your route, unseen and never attacking
  if (level.chambers[chamber]?.shadow) {
    trail = pushTrail(trail, player.pos);
    const behind = shadowPos(trail, player.pos);
    thing = behind ? { ...createDormantThing(), pos: behind, mode: 'shadow' } : createDormantThing();
  } else {
    trail = [];
  }
  const thingActive = thing.mode !== 'dormant' && thing.mode !== 'shadow';

  // Tapes are taken by walking over them
  let tapes = state.tapes;
  level.tapes.forEach((t, i) => {
    if (tapes[i] !== true && dist(player.pos, cellCenter(t)) <= TUNING.tapePickupRadiusM) {
      tapes = tapes.map((taken, k) => taken || k === i);
      player = { ...player, battery: Math.min(1, player.battery + TUNING.tapeBatteryBonus) };
    }
  });

  // Doors on the press, the VCR while held
  const target = findInteraction(level, state.doors, tapes, player);
  const pressed = input.interact && !state.player.interactHeld;
  let doors = state.doors;
  let exitOpen = state.exitOpen;
  let vcrHoldTicks = state.vcrHoldTicks;

  if (pressed && target?.kind === 'door') {
    const i = target.index;
    const open = doors[i] !== true;
    const c = doorCenter(level, i);
    const clear = dist(player.pos, c) >= TUNING.doorClearM && dist(thing.pos, c) >= TUNING.doorClearM;
    if (open || clear) doors = doors.map((d, k) => (k === i ? open : d));
  }

  // You or your tape-self can play the tape. Either way, it is loud.
  const holdingVcr = input.interact && target?.kind === 'vcr' && !exitOpen;
  // Your tape-self plays the tape if it holds E there, or simply by being parked at the VCR when its clip ends
  const ghostHoldingVcr =
    ghost !== null &&
    !exitOpen &&
    (ghostInteracting(ghost) || ghost.index >= ghost.log.length) &&
    findInteraction(level, doors, tapes, ghost.player)?.kind === 'vcr';
  // Your tape-self plays it at double speed on its own; you and it together, three times as fast
  if (holdingVcr || ghostHoldingVcr) vcrHoldTicks += (holdingVcr ? 1 : 0) + (ghostHoldingVcr ? TUNING.echoVcrHoldRate : 0);
  else vcrHoldTicks = Math.max(0, vcrHoldTicks - TUNING.vcrDecayFactor);

  if (!exitOpen && vcrHoldTicks >= vcrHoldNeedTicks()) exitOpen = true;

  // Plates and gates: you and your tape-self can both hold a plate
  const bodies = [player.pos, ...(ghost ? [ghost.player.pos] : [])];
  const plates = platesDown(level, bodies);
  const gateUpdate = stepGates(level, plates, state.gateHoldTicks, [
    { pos: player.pos, radiusM: TUNING.playerRadiusM },
    ...(ghost ? [{ pos: ghost.player.pos, radiusM: TUNING.playerRadiusM }] : []),
    ...(thingActive ? [{ pos: thing.pos, radiusM: TUNING.thingRadiusM }] : []),
  ]);
  const gates = gateUpdate.gates;

  // Lens, notice, rush. A dormant Thing is not in this chamber at all.
  let openedDoor: number | null = null;
  const thingGraceTicks = Math.max(0, state.thingGraceTicks - 1);
  if (thingActive && state.thingGraceTicks > 0) {
    // Just woke up: it stands where it is, deaf and blind, and nothing fills
    notice = 0;
  } else if (thingActive) {
    const lens = readLens(sight, player, thing.pos);
    if (thing.mode === 'rush' || thing.mode === 'search') {
      notice = 1;
    } else {
      const n = stepNotice(notice, noticeLockTicks, lens, perAct(TUNING.actNoticeFillScale, act));
      notice = n.notice;
      noticeLockTicks = n.noticeLockTicks;
      if (notice >= 1) thing = startRush(thing, act, cellOf(player.pos));
    }

    // The Thing hears you and your tape-self. Holding the VCR is loud.
    const baseNoise = noiseRadiusM(player);
    const noise: NoiseSource[] = [
      { pos: player.pos, radiusM: holdingVcr ? Math.max(baseNoise, TUNING.vcrNoiseRadiusM) : baseNoise },
    ];
    if (ghost) {
      const steps = noiseRadiusM(ghost.player);
      noise.push({ pos: ghost.player.pos, radiusM: ghostHoldingVcr ? Math.max(steps, TUNING.vcrNoiseRadiusM) : steps });
    }
    // It never walks into a silent, motionless player: it keeps a cell clear around you until you make a sound
    const silent = baseNoise === 0 && !holdingVcr && thing.mode !== 'rush' && thing.mode !== 'search';
    const base = thingGrid(level, gates);
    const moved = stepThing(
      {
        level,
        pathGrid: silent ? guardCells(base, cellOf(player.pos), TUNING.silentGuardCells) : base,
        patrolCells: level.chambers[chamber]?.patrolCells ?? [],
        doors,
        player,
        hidden,
        noise,
        act,
        sanctuaryEntry: sanctuaryTicks > 0 ? cellCenterOf(level.checkpoints[chamber]) : null,
      },
      thing,
      rng,
    );
    thing = moved.thing;
    rng = moved.rng;
    openedDoor = moved.openedDoor;
    if (moved.rushEnded) {
      notice = 0;
      noticeLockTicks = secToTicks(perAct(TUNING.actRushCooldownSec, act));
    }
  }
  // It gets to your tape-self first: it chews the tape for a moment (which keeps playing), then it is gone and the
  // Thing slinks off to the far side of the room
  let tearTicks = 0;
  if (ghost && thingActive && thing.mode !== 'rush' && dist(ghost.player.pos, thing.pos) <= TUNING.catchRadiusM) {
    tearTicks = state.tearTicks + 1;
    if (tearTicks >= secToTicks(TUNING.tapeTearSec)) {
      thing = retreat(thing, level.chambers[chamber]?.patrolCells ?? [], ghost.player.pos);
      ghost = null;
      tearTicks = 0;
    }
  }
  if (openedDoor !== null) {
    const i = openedDoor;
    doors = doors.map((d, k) => (k === i ? true : d));
  }

  const tick = state.tick + 1;
  const rewindTicksLeft = Math.max(0, state.rewindTicksLeft - 1);

  // Caught. A hidden player is only caught by a Thing that is hunting them: it searches first, and breaking cover turns the search into a rush.
  const safeInCover = hidden && thing.mode !== 'rush';
  if (thingActive && dist(player.pos, thing.pos) <= TUNING.catchRadiusM && !safeInCover) {
    const woken = wakeAtEntry({ ...state, rng, chamber, doors, tapes, vcrHoldTicks, exitOpen }, level, input, player.battery);
    return {
      ...woken,
      tick,
      caughtCount: state.caughtCount + 1,
      lastCatch: { tick, playerPos: { ...player.pos }, thingPos: { ...thing.pos } },
    };
  }

  const won = exitOpen && dist(player.pos, cellCenter(level.exit)) <= TUNING.winRadiusM;

  return {
    ...state,
    tick,
    rng,
    chamber,
    rec,
    ghost,
    recHeld: input.record,
    restartHeld: input.restart,
    plates,
    gates,
    gateHoldTicks: gateUpdate.holdTicks,
    player,
    thing,
    notice,
    noticeLockTicks,
    doors,
    tapes,
    vcrHoldTicks,
    exitOpen,
    won,
    winTick: won ? tick : state.winTick,
    rewindTicksLeft,
    thingGraceTicks,
    sanctuaryTicks,
    tearTicks,
    trail,
  };
}
