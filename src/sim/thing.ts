import { cellCenter, cellOf, findPath } from './grid';
import { nextRandom } from './rng';
import { DT_SEC, perAct, secToTicks, TUNING } from './tuning';
import { dist } from './vec2';
import { doorIndexAt } from './world';
import type { Cell, Grid } from './grid';
import type { Level } from './level';
import type { PlayerState, ThingState } from './state';
import type { Vec2 } from './vec2';

/** Something the Thing can hear: you, or your tape-self. */
export interface NoiseSource {
  pos: Vec2;
  radiusM: number;
}

export interface ThingContext {
  level: Level;
  /** Paths for the Thing: doors are floor (a closed door costs it time), closed gates are walls. */
  pathGrid: Grid;
  /** Cells it may patrol to: its chamber, minus hiding spots. */
  patrolCells: readonly Cell[];
  doors: readonly boolean[];
  player: PlayerState;
  hidden: boolean;
  noise: readonly NoiseSource[];
  act: number;
  rage: boolean;
}

export interface ThingUpdate {
  thing: ThingState;
  rng: number;
  /** The rush or search ran out this tick. */
  rushEnded: boolean;
  openedDoor: number | null;
}

export function startRush(thing: ThingState, act: number, huntCell: Cell): ThingState {
  return {
    ...thing,
    mode: 'rush',
    targetCell: null,
    huntCell,
    modeTicks: secToTicks(perAct(TUNING.actRushDurationSec, act)),
    doorTicks: 0,
  };
}

function moveToward(from: Vec2, to: Vec2, speedMps: number): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  const step = speedMps * DT_SEC;
  if (d <= step || d === 0) return { x: to.x, y: to.y };
  return { x: from.x + (dx / d) * step, y: from.y + (dy / d) * step };
}

/** Picks a patrol cell. From act 2 it draws three and takes the one nearest the player, so patrols drift toward you. */
function pickCell(ctx: ThingContext, rngIn: number): { cell: Cell; rng: number } {
  const cells = ctx.patrolCells;
  const tries = ctx.act === 1 ? 1 : 3;
  let rng = rngIn;
  let best: Cell | null = null;
  for (let i = 0; i < tries; i++) {
    const [r, next] = nextRandom(rng);
    rng = next;
    const c = cells[Math.min(cells.length - 1, Math.floor(r * cells.length))];
    if (!c) continue;
    if (!best || dist(cellCenter(c), ctx.player.pos) < dist(cellCenter(best), ctx.player.pos)) best = c;
  }
  if (!best) throw new Error('grid has no floor');
  return { cell: best, rng };
}

interface Walk {
  pos: Vec2;
  arrived: boolean;
  blockedDoor: number;
}

/** One tick along a BFS path. A closed door in the way stops it. */
function walkTo(ctx: ThingContext, pos: Vec2, target: Cell, speedMps: number, finalPoint?: Vec2): Walk {
  const path = findPath(ctx.pathGrid, cellOf(pos), target);
  // Behind a closed gate: nothing to walk along, so it waits.
  if (path.length === 0) return { pos, arrived: false, blockedDoor: -1 };
  const next = path[1];
  if (next) {
    const di = doorIndexAt(ctx.level, next);
    if (di >= 0 && ctx.doors[di] !== true) return { pos, arrived: false, blockedDoor: di };
    return { pos: moveToward(pos, cellCenter(next), speedMps), arrived: false, blockedDoor: -1 };
  }
  const point = finalPoint ?? cellCenter(target);
  const moved = moveToward(pos, point, speedMps);
  return { pos: moved, arrived: moved.x === point.x && moved.y === point.y, blockedDoor: -1 };
}

function pushDoor(thing: ThingState, blockedDoor: number): { doorTicks: number; opened: number | null } {
  if (blockedDoor < 0) return { doorTicks: 0, opened: null };
  const doorTicks = thing.doorTicks + 1;
  if (doorTicks >= secToTicks(TUNING.doorBreakSec)) return { doorTicks: 0, opened: blockedDoor };
  return { doorTicks, opened: null };
}

/** Hidden well: in cover, lens down, not moving. Anything else gives you away. */
function wellHidden(ctx: ThingContext): boolean {
  const { player } = ctx;
  return (
    ctx.hidden &&
    player.lensRaise < TUNING.lensVisibleRaise &&
    Math.hypot(player.vel.x, player.vel.y) <= TUNING.movingSpeedMps
  );
}

export function stepThing(ctx: ThingContext, thing: ThingState, rngIn: number): ThingUpdate {
  let rng = rngIn;
  const { player, act } = ctx;
  const playerCell = cellOf(player.pos);
  const covered = wellHidden(ctx);

  if (thing.mode === 'rush') {
    const huntCell = covered && !ctx.rage ? (thing.huntCell ?? playerCell) : playerCell;
    if (covered && !ctx.rage && dist(thing.pos, player.pos) <= TUNING.searchRadiusM) {
      return {
        thing: { ...thing, mode: 'search', huntCell, modeTicks: secToTicks(TUNING.searchSec), doorTicks: 0 },
        rng,
        rushEnded: false,
        openedDoor: null,
      };
    }
    const speed = ctx.rage ? TUNING.rageSpeedMps : perAct(TUNING.actRushSpeedMps, act);
    const walked = walkTo(ctx, thing.pos, huntCell, speed, player.pos);
    const door = pushDoor(thing, walked.blockedDoor);
    const modeTicks = ctx.rage ? thing.modeTicks : thing.modeTicks - 1;
    if (modeTicks <= 0) {
      return {
        thing: { pos: walked.pos, mode: 'wander', targetCell: null, huntCell: null, modeTicks: 0, doorTicks: 0 },
        rng,
        rushEnded: true,
        openedDoor: door.opened,
      };
    }
    return {
      thing: { ...thing, pos: walked.pos, huntCell, modeTicks, doorTicks: door.doorTicks },
      rng,
      rushEnded: false,
      openedDoor: door.opened,
    };
  }

  if (thing.mode === 'search') {
    if (!covered) {
      // Found you. The rush restarts from the full duration, from right beside you.
      return {
        thing: startRush(thing, act, playerCell),
        rng,
        rushEnded: false,
        openedDoor: null,
      };
    }
    const modeTicks = thing.modeTicks - 1;
    if (modeTicks <= 0) {
      return {
        thing: { ...thing, mode: 'wander', targetCell: null, huntCell: null, modeTicks: 0 },
        rng,
        rushEnded: true,
        openedDoor: null,
      };
    }
    return { thing: { ...thing, modeTicks }, rng, rushEnded: false, openedDoor: null };
  }

  // The nearest thing it can hear: you or your tape-self
  let heard: NoiseSource | null = null;
  for (const n of ctx.noise) {
    if (n.radiusM <= 0 || dist(thing.pos, n.pos) > n.radiusM) continue;
    if (!heard || dist(thing.pos, n.pos) < dist(thing.pos, heard.pos)) heard = n;
  }
  let mode = thing.mode;
  let targetCell = thing.targetCell;
  let modeTicks = thing.modeTicks;

  if (heard) {
    mode = 'stalk';
    targetCell = cellOf(heard.pos);
    modeTicks = 0;
  }
  if (!targetCell) {
    const picked = pickCell(ctx, rng);
    rng = picked.rng;
    targetCell = picked.cell;
    modeTicks = 0;
  }

  const speed = mode === 'stalk' ? perAct(TUNING.actStalkSpeedMps, act) : perAct(TUNING.actWanderSpeedMps, act);
  const walked = walkTo(ctx, thing.pos, targetCell, speed);
  const door = pushDoor(thing, walked.blockedDoor);

  if (walked.arrived) {
    modeTicks += 1;
    const limit = mode === 'stalk' ? secToTicks(TUNING.stalkGiveUpSec) : secToTicks(TUNING.wanderPauseSec);
    if (modeTicks >= limit) {
      mode = 'wander';
      const picked = pickCell(ctx, rng);
      rng = picked.rng;
      targetCell = picked.cell;
      modeTicks = 0;
    }
  } else {
    modeTicks = 0;
  }

  return {
    thing: { pos: walked.pos, mode, targetCell, huntCell: null, modeTicks, doorTicks: door.doorTicks },
    rng,
    rushEnded: false,
    openedDoor: door.opened,
  };
}
