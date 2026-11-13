import { cellCenter, findInteraction, LEVEL, TUNING } from '../../sim';
import type { SimState, Vec2 } from '../../sim';

/**
 * What the player should know right now: one objective line (the chamber's goal) and one prompt (the next action).
 * Prompts wait for the action instead of timing out, and change as soon as the state answers them.
 * Words in [brackets] are drawn as key caps. All text is placeholder copy for the author.
 * Client-only: reads sim state, never changes it.
 */
export interface GuideLine {
  objective: string | null;
  prompt: string | null;
}

export interface GuideFrame {
  state: SimState;
  prev: SimState;
  dtSec: number;
  lensUsedSec: number;
  lensToggle: boolean;
}

/** The inner room of the chain chamber, where its exit plate is. */
const CHAIN_INNER = { xMin: 40, xMax: 43, yMin: 7, yMax: 11 };

function onPlate(pos: Vec2, group: string): boolean {
  return LEVEL.plates.some(
    (p) => p.group === group && Math.hypot(pos.x - cellCenter(p.cell).x, pos.y - cellCenter(p.cell).y) <= TUNING.plateRadiusM,
  );
}

/** Index of the plate of this group under pos, or -1. */
function plateIndexAt(pos: Vec2, group: string): number {
  return LEVEL.plates.findIndex(
    (p) => p.group === group && Math.hypot(pos.x - cellCenter(p.cell).x, pos.y - cellCenter(p.cell).y) <= TUNING.plateRadiusM,
  );
}

function gateIndex(group: string): number {
  return LEVEL.gates.findIndex((g) => g.group === group);
}

export class Guide {
  private chamber = -1;
  private chamberSec = 0;
  private movedM = 0;
  private plateSeen = false;
  private gateShutOnYou = false;
  private sprinted = false;
  private hidOnce = false;
  private clipHoldSec = 0;
  private catchBase = 0;
  private lastPos: Vec2 | null = null;

  reset(): void {
    this.lastPos = null;
    this.chamber = -1;
    this.chamberSec = 0;
    this.movedM = 0;
    this.plateSeen = false;
    this.gateShutOnYou = false;
    this.sprinted = false;
    this.hidOnce = false;
    this.clipHoldSec = 0;
    this.catchBase = 0;
  }

  update(f: GuideFrame): GuideLine {
    const c = f.state;
    if (c.chamber !== this.chamber) {
      this.chamber = c.chamber;
      this.chamberSec = 0;
      this.catchBase = c.caughtCount;
    }
    this.chamberSec += f.dtSec;
    // Walking only: a rewind jumps metres in one tick and is not you moving
    const last = this.lastPos ?? c.player.pos;
    const stepM = Math.hypot(c.player.pos.x - last.x, c.player.pos.y - last.y);
    if (stepM < 1) this.movedM += stepM;
    this.lastPos = { ...c.player.pos };
    if (c.player.sprinting) this.sprinted = true;

    switch (c.chamber) {
      case 0:
        return this.chamber1(c, f.prev);
      case 1:
        return this.chamber2(c);
      case 2:
        return this.chamber3(c, f);
      case 3:
        return this.chamber4(c);
      default:
        return this.counter(c, f);
    }
  }

  /** The gate is shut. Teach: the plate opens it, it shuts too fast, record yourself on it, your tape-self holds it. */
  private chamber1(c: SimState, prev: SimState): GuideLine {
    const objective = 'GET THROUGH THE GATE';
    const gi = gateIndex('p');
    if (c.plates[0]) this.plateSeen = true;
    if (prev.gates[gi] && !c.gates[gi] && !c.ghost) this.gateShutOnYou = true;

    if (c.rec.active) {
      if (onPlate(c.player.pos, 'p')) return { objective: 'YOU ARE ON TAPE', prompt: 'NOW [F] TO STOP AND REWIND' };
      return { objective: 'YOU ARE ON TAPE', prompt: 'WALK ONTO THE PLATE, THEN [F]' };
    }
    if (this.movedM < 1.2 && !this.plateSeen && !c.ghost) return { objective, prompt: '[W] [A] [S] [D] MOVE   MOUSE LOOK' };
    const g = c.ghost;
    if (g) {
      const ghostOn = onPlate(g.player.pos, 'p');
      const playing = g.index < g.log.length;
      if (ghostOn && c.gates[gi]) return { objective, prompt: 'GO THROUGH. YOUR TAPE-SELF HOLDS THE PLATE' };
      if (playing) return { objective, prompt: 'REWOUND. THAT IS YOU ON TAPE, DOING WHAT YOU DID' };
      return { objective, prompt: 'YOUR CLIP ENDED OFF THE PLATE. [F] RECORD AGAIN' };
    }
    if (this.gateShutOnYou) return { objective, prompt: 'TOO FAR ALONE. [F] RECORD YOURSELF ON THE PLATE' };
    if (this.plateSeen) {
      if (c.plates[0]) return { objective, prompt: 'THE PLATE OPENS THE GATE. NOW STEP OFF' };
      return { objective, prompt: 'RUN FOR IT. [SHIFT] RUN' };
    }
    return { objective, prompt: 'STEP ON THE RED PLATE' };
  }

  /** Two plates, one gate. Teach: your tape-self waits on its plate forever; take the other one. */
  private chamber2(c: SimState): GuideLine {
    const objective = 'BOTH PLATES AT ONCE';
    const gi = gateIndex('q');
    const g = c.ghost;
    const meOn = plateIndexAt(c.player.pos, 'q');
    if (c.gates[gi] && g) return { objective, prompt: 'GO. IT STAYS OPEN A MOMENT' };
    if (c.rec.active) {
      if (meOn >= 0) return { objective: 'YOU ARE ON TAPE', prompt: 'NOW [F]. IT WILL WAIT ON THIS PLATE' };
      return { objective: 'YOU ARE ON TAPE', prompt: 'END THE CLIP ON ONE PLATE, THEN [F]' };
    }
    if (g) {
      const ghostOn = plateIndexAt(g.player.pos, 'q');
      if (ghostOn >= 0) {
        if (meOn >= 0 && meOn !== ghostOn) return { objective, prompt: 'GO. IT STAYS OPEN A MOMENT' };
        return { objective, prompt: 'IT WAITS THERE FOR YOU. STAND ON THE OTHER PLATE' };
      }
      if (g.index < g.log.length) return { objective, prompt: 'YOUR TAPE-SELF IS ON ITS WAY' };
      return { objective, prompt: 'IT STOPS WHERE YOUR CLIP STOPS. [F] END ON A PLATE' };
    }
    if (meOn >= 0) return { objective, prompt: 'ONE IS NOT ENOUGH. [F] RECORD A WALK TO THE OTHER' };
    return { objective, prompt: this.chamberSec > 4 ? '[F] RECORD A WALK TO ONE PLATE' : null };
  }

  /** Something lives here. Teach: the lens shows it, crouch in an alcove hides you, your tape-self holds the far plate. */
  private chamber3(c: SimState, f: GuideFrame): GuideLine {
    const objective = 'IT HEARS YOU. IT ONLY SHOWS ON THE LENS';
    const hunting = c.thing.mode === 'rush' || c.thing.mode === 'search' || c.thing.mode === 'stalk';
    const hidden = c.player.crouching && LEVEL.hides.some((h) => Math.floor(c.player.pos.x) === h.cx && Math.floor(c.player.pos.y) === h.cy);
    if (hidden) this.hidOnce = true;
    if (c.thing.mode === 'rush' && !hidden) return { objective: 'IT SAW YOU', prompt: 'HIDE. [C] CROUCH IN AN ALCOVE' };
    if (hidden && hunting) return { objective: 'IT IS LOOKING', prompt: 'STAY STILL. LENS DOWN' };
    if (f.lensUsedSec < 0.6) return { objective, prompt: f.lensToggle ? '[RIGHT MOUSE] LENS' : 'HOLD [RIGHT MOUSE] LENS' };
    if (hunting && !this.hidOnce) return { objective, prompt: 'IT HEARD YOU. [C] CROUCH IN A BLUE ALCOVE' };
    const gi = gateIndex('r');
    if (c.rec.active) {
      if (onPlate(c.player.pos, 'r')) return { objective: 'YOU ARE ON TAPE', prompt: 'NOW [F]' };
      return { objective: 'YOU ARE ON TAPE', prompt: 'TO THE FAR PLATE, THEN [F]' };
    }
    if (c.ghost && onPlate(c.ghost.player.pos, 'r')) {
      if (c.gates[gi]) return { objective, prompt: 'THE GATE IS OPEN. QUIETLY NOW' };
      return { objective, prompt: 'IT HOLDS THE PLATE. GO' };
    }
    if (c.ghost && c.ghost.index < c.ghost.log.length) return { objective, prompt: 'YOUR TAPE-SELF IS ON ITS WAY' };
    if (this.sprinted && this.chamberSec > 12) return { objective, prompt: '[SHIFT] RUNNING IS LOUD. IT HEARS YOUR TAPE-SELF TOO' };
    return { objective, prompt: this.chamberSec > 6 ? '[F] SEND YOUR TAPE-SELF TO THE FAR PLATE' : null };
  }

  /** Two gates, one job each. Teach: your tape-self opens the first for you, then the next plate is yours. */
  private chamber4(c: SimState): GuideLine {
    const objective = 'TWO GATES';
    const inner = gateIndex('u');
    const exit = gateIndex('w');
    const p = c.player.pos;
    const inside = p.x >= CHAIN_INNER.xMin && p.x < CHAIN_INNER.xMax + 1 && p.y >= CHAIN_INNER.yMin && p.y < CHAIN_INNER.yMax + 1;
    if (c.gates[exit]) return { objective, prompt: 'GO' };
    if (inside) return { objective, prompt: 'STAND ON THE PLATE IN HERE' };
    if (c.rec.active) {
      if (onPlate(p, 'u')) return { objective: 'YOU ARE ON TAPE', prompt: 'NOW [F]. IT WILL WAIT ON THIS PLATE' };
      return { objective: 'YOU ARE ON TAPE', prompt: 'WALK TO THE FAR PLATE, THEN [F]' };
    }
    const g = c.ghost;
    if (g) {
      if (c.gates[inner]) return { objective, prompt: 'THE INNER GATE IS OPEN. GET IN' };
      if (g.index < g.log.length) return { objective, prompt: 'YOUR TAPE-SELF IS ON ITS WAY. GO TO THE INNER GATE' };
      return { objective, prompt: 'IT STOPPED SHORT. [F] RECORD AGAIN, END ON THE FAR PLATE' };
    }
    if (this.chamberSec < 5) return { objective, prompt: 'FOLLOW THE WIRE. THE FAR PLATE OPENS THE INNER GATE' };
    return { objective, prompt: '[F] SEND YOUR TAPE-SELF TO THE FAR PLATE' };
  }

  /**
   * The counter. One solution a stranger can read: start recording from a blue alcove, walk to the VCR, hold E, stop.
   * Rewound, you are back in the alcove, hidden, while your tape-self plays the tape and the Thing goes for it.
   * After two catches in here the hint spells it out.
   */
  private counter(c: SimState, f: GuideFrame): GuideLine {
    const objective = c.exitOpen ? null : 'PLAY THE TAPE';
    if (c.exitOpen) return { objective: 'GET OUT', prompt: null };
    const p = c.player.pos;
    const atVcr = findInteraction(LEVEL, c.doors, c.tapes, c.player)?.kind === 'vcr';
    const inAlcove = LEVEL.hides.some((h) => Math.floor(p.x) === h.cx && Math.floor(p.y) === h.cy);
    const catches = c.caughtCount - this.catchBase;
    const meHolding = atVcr && c.player.interactHeld;
    if (c.rec.active) this.clipHoldSec += meHolding ? f.dtSec : 0;
    else this.clipHoldSec = 0;

    if (c.rec.active) {
      if (!atVcr) return { objective: 'YOU ARE ON TAPE', prompt: 'WALK TO THE VCR' };
      if (!c.player.interactHeld) return { objective: 'YOU ARE ON TAPE', prompt: 'HOLD [E]' };
      return { objective: 'YOU ARE ON TAPE', prompt: this.clipHoldSec > 1.2 ? 'NOW [F]' : 'HOLD [E]' };
    }
    if (c.ghost) {
      if (c.vcrHoldTicks > f.prev.vcrHoldTicks) return { objective, prompt: 'IT PLAYS THE TAPE. STAY LOW' };
      if (c.ghost.index < c.ghost.log.length) return { objective, prompt: '[C] CROUCH. STAY STILL' };
      return { objective, prompt: 'IT TORE THE TAPE. [F] AGAIN' };
    }
    if (catches >= 2) return { objective, prompt: 'FROM AN ALCOVE: [F], WALK TO THE VCR, HOLD [E], [F]' };
    if (inAlcove) return { objective, prompt: '[F] RECORD' };
    return { objective, prompt: this.chamberSec > 3 ? 'FIND A BLUE ALCOVE' : null };
  }
}
