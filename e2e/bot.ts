/* eslint-disable @typescript-eslint/no-explicit-any -- the bot reaches into dev-only globals (__game, __sim) exposed by the dev build */

export interface BotEvent {
  t: number;
  msg: string;
}

/**
 * Runs inside the page. Plays a night through the real input path: it dispatches key events and turns the camera
 * the way a mouse would. It knows each chamber's solution (record a walk to the plate, rewind, let the echo hold it),
 * reads the sim to path-find and to decide when to hide, so it is a player with a map in its head, perfect hearing
 * for the screech, and no sight of the Thing except through its own lens peeks.
 */
export function botMain(): void {
  const w = window as any;
  const g = w.__game;
  const sim = w.__sim;
  const LEVEL = sim.LEVEL;
  const W: number = LEVEL.grid.width;
  const H: number = LEVEL.grid.height;
  const log: BotEvent[] = (w.__botLog = []);
  const say = (msg: string) => log.push({ t: Math.round((g.curr.tick / 60) * 10) / 10, msg });

  type Cell = { cx: number; cy: number };
  type P = { x: number; y: number };
  const held = new Set<string>();
  const key = (code: string, on: boolean) => {
    if (on === held.has(code)) return;
    if (on) held.add(code);
    else held.delete(code);
    document.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code, bubbles: true }));
  };
  const cellOf = (p: P): Cell => ({ cx: Math.floor(p.x), cy: Math.floor(p.y) });
  const center = (c: Cell): P => ({ x: c.cx + 0.5, y: c.cy + 0.5 });
  const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

  const passable = (cx: number, cy: number, exitOpen: boolean) => {
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return false;
    if (cx === LEVEL.exit.cx && cy === LEVEL.exit.cy) return exitOpen;
    const gi = LEVEL.gates.findIndex((gt: { cell: Cell }) => gt.cell.cx === cx && gt.cell.cy === cy);
    if (gi >= 0 && g.curr.gates[gi] !== true) return false;
    return !LEVEL.grid.walls[cy * W + cx];
  };

  /** Distance map from a cell over floor, doors counted as floor. -1 where unreachable. */
  const distMap = (from: Cell, exitOpen: boolean): number[] => {
    const d = new Array<number>(W * H).fill(-1);
    const q: Cell[] = [from];
    d[from.cy * W + from.cx] = 0;
    for (let h = 0; h < q.length; h++) {
      const c = q[h] as Cell;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = c.cx + dx;
        const ny = c.cy + dy;
        if (!passable(nx, ny, exitOpen) || d[ny * W + nx] !== -1) continue;
        d[ny * W + nx] = (d[c.cy * W + c.cx] as number) + 1;
        q.push({ cx: nx, cy: ny });
      }
    }
    return d;
  };

  /** Next cell along the shortest path from `from` to `to`. */
  const nextCell = (from: Cell, to: Cell, exitOpen: boolean): Cell | null => {
    if (from.cx === to.cx && from.cy === to.cy) return null;
    const d = distMap(to, exitOpen);
    let best: Cell | null = null;
    let bestD = d[from.cy * W + from.cx] as number;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = from.cx + dx;
      const ny = from.cy + dy;
      const v = d[ny * W + nx];
      if (passable(nx, ny, exitOpen) && v !== undefined && v >= 0 && v < bestD) {
        best = { cx: nx, cy: ny };
        bestD = v;
      }
    }
    return best;
  };

  const doorIndex = (c: Cell) => LEVEL.doors.findIndex((d: Cell) => d.cx === c.cx && d.cy === c.cy);

  let last = performance.now();
  let nextPeek = last + 2500;
  let peekUntil = 0;
  let hideUntil = 0;
  let hideCell: Cell | null = null;
  let lastCaught = 0;
  let lastTapes = 0;
  let lastRush = false;
  let lastE = 0;
  let wasExit = false;
  let hidSince = 0;
  let sawThing = false;
  let planChamber = -1;
  let planCaught = 0;
  let stepIdx = 0;
  let stepSince = 0;

  type Step =
    | { t: 'go'; to: P; sprint?: boolean }
    | { t: 'record'; pressed?: boolean }
    | { t: 'wait'; sec: number }
    | { t: 'until'; label: string; cond: (c: any) => boolean }
    | { t: 'vcr' }
    /** Turn to face a point. */
    | { t: 'face'; to: P }
    /** Stand at the VCR holding E for this long. */
    | { t: 'holdVcr'; sec: number }
    /** Crouch where you are until cond. If abort turns true first, start the chamber's plan again. */
    | { t: 'crouchUntil'; label: string; cond: (c: any) => boolean; abort: (c: any) => boolean };
  const go = (x: number, y: number, sprint = false): Step => ({ t: 'go', to: { x, y }, sprint });
  const record = (): Step => ({ t: 'record' });
  const wait = (sec: number): Step => ({ t: 'wait', sec });
  const until = (label: string, cond: (c: any) => boolean): Step => ({ t: 'until', label, cond });

  /** Each chamber's solution: what a player who has worked it out would do. Rebuilt fresh on every attempt. */
  const plans: Array<() => Step[]> = [
    () => [
      record(),
      go(4.5, 10.5),
      wait(0.4),
      record(),
      go(10.5, 10.5),
      until('echo holds the plate, gate open', (c) => c.gates[0] === true),
      go(12.5, 10.5, true),
    ],
    () => [
      record(),
      go(13.5, 2.5),
      wait(0.4),
      record(),
      go(20.5, 4.5),
      until('both plates held, gate open', (c) => c.gates[1] === true),
      go(23.5, 2.5, true),
    ],
    () => [
      record(),
      go(24.5, 10.5),
      wait(0.4),
      record(),
      go(32.5, 2.5),
      until('echo holds the far plate, gate open', (c) => c.gates[2] === true),
      go(34.5, 2.5, true),
    ],
    // Two gates, one job each: the echo holds the far plate, you take the one inside
    () => [
      record(),
      go(34.5, 11.5),
      wait(0.4),
      record(),
      go(41.5, 5.5),
      until('echo holds the inner gate', (c) => c.gates[3] === true),
      go(41.5, 7.5),
      go(42.5, 10.5),
      until('the way out is open', (c) => c.gates[4] === true),
      go(45.5, 10.5),
    ],
    // The counter: record from an alcove, walk to the VCR, stop. Rewound, crouch in the alcove while the tape-self plays it
    () => [
      go(48.5, 7.5),
      go(48.5, 6.5),
      wait(2),
      record(),
      go(48.5, 8.5),
      go(49.5, 9.5),
      { t: 'face', to: { x: 49.5, y: 10.5 } },
      wait(0.4),
      record(),
      {
        t: 'crouchUntil',
        label: 'the tape played',
        cond: (c) => c.exitOpen,
        abort: (c) => c.ghost === null && !c.exitOpen,
      },
      go(48.5, 8.5),
      go(52.5, 9.5, true),
      go(53.5, 11.0, true),
      go(53.5, 12.0, true),
    ],
  ];
  let planCache: Step[] = [];
  let planCacheKey = '';
  let planGen = 0;
  const plan = (chamber: number): Step[] => {
    const key2 = `${chamber}:${planCaught}:${planGen}`;
    if (key2 !== planCacheKey) {
      planCacheKey = key2;
      planCache = (plans[chamber] ?? (() => []))();
    }
    return planCache;
  };

  const tapF = () => {
    key('KeyF', true);
    setTimeout(() => key('KeyF', false), 110);
  };

  const tapE = (now: number) => {
    if (now - lastE < 700) return;
    lastE = now;
    key('KeyE', true);
    setTimeout(() => key('KeyE', false), 130);
  };

  const steer = (target: P, dtSec: number, sprint: boolean, stop = false) => {
    const me: P = g.curr.player.pos;
    const desired = Math.atan2(-(target.x - me.x), -(target.y - me.y));
    const yaw: number = g.input.yawRad;
    let diff = ((((desired - yaw + Math.PI * 3) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    const rate = 7 * dtSec;
    diff = Math.max(-rate, Math.min(rate, diff));
    g.input.yawRad = yaw + diff;
    const remaining = Math.abs(((((desired - g.input.yawRad + Math.PI * 3) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI);
    key('KeyW', !stop && remaining < 0.7);
    key('ShiftLeft', sprint && !stop && remaining < 0.4);
  };

  const pickHide = (c: any): Cell | null => {
    const me = cellOf(c.player.pos);
    const dMe = distMap(me, c.exitOpen);
    const dTh = distMap(cellOf(c.thing.pos), c.exitOpen);
    let best: Cell | null = null;
    let bestScore = Infinity;
    for (const h of LEVEL.hides as Cell[]) {
      const a = dMe[h.cy * W + h.cx] as number;
      const b = dTh[h.cy * W + h.cx] as number;
      if (a < 0) continue;
      // How much sooner I get there than it does, with its higher speed counted in
      const margin = b / 5 - a / 4.2;
      const score = a + (margin < 0.8 ? 40 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = h;
      }
    }
    return best;
  };

  function frame(now: number): void {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const c = g.curr;
    if (c.won) {
      for (const k of [...held]) key(k, false);
      if (!wasExit) say('WON');
      wasExit = true;
      return;
    }
    if (g.freezeSec > 0) return;
    const p = c.player;
    const th = c.thing;
    const me: P = p.pos;
    const grid = sim.sightGrid(LEVEL, c.doors, c.exitOpen);

    if (c.caughtCount !== lastCaught) {
      lastCaught = c.caughtCount;
      hideCell = null;
      hideUntil = 0;
      say(`CAUGHT (${c.caughtCount}) with ${sim.tapesFound(c)} tapes`);
    }
    const found = sim.tapesFound(c);
    if (found !== lastTapes) {
      lastTapes = found;
      say(`took tape ${found}`);
    }
    const rushing = th.mode === 'rush';
    if (rushing !== lastRush) {
      lastRush = rushing;
      say(rushing ? `RUSH from ${dist(me, th.pos).toFixed(1)} m` : 'rush over');
    }
    if (c.exitOpen && !wasExit) {
      say('exit open');
      wasExit = true;
    }

    // Lens peek: look, and react to what the tape shows
    // Once the door is open a player just goes: no more looking, and the Thing only matters if it rushes
    if (now >= nextPeek && peekUntil === 0 && !rushing && th.mode !== 'dormant' && !c.exitOpen) {
      peekUntil = now + 800;
      nextPeek = now + 3500 + (c.tick % 7) * 300;
      key('KeyQ', true);
    }
    if (peekUntil > 0) {
      const reading = sim.readLens(grid, p, th.pos);
      if (reading.visible && !sawThing) {
        sawThing = true;
        say(`saw it on the lens at ${reading.distM.toFixed(1)} m (notice ${c.notice.toFixed(2)})`);
        if (reading.distM < 11) hideUntil = now + 5000;
        peekUntil = now; // lower immediately
      }
      if (now >= peekUntil) {
        key('KeyQ', false);
        peekUntil = 0;
        sawThing = false;
      }
    }

    const danger = rushing || th.mode === 'search';
    if (danger) hideUntil = Math.max(hideUntil, now + 3000);

    // Hiding
    if (now < hideUntil) {
      key('KeyQ', false);
      key('KeyE', false);
      peekUntil = 0;
      if (!hideCell) {
        hideCell = pickHide(c);
        say(hideCell ? `going to hide at ${hideCell.cx},${hideCell.cy}` : 'nowhere to hide');
      }
      if (hideCell) {
        const hc = center(hideCell);
        if (dist(me, hc) < 0.22) {
          key('KeyW', false);
          key('ShiftLeft', false);
          key('KeyC', true);
          if (hidSince === 0) {
            hidSince = now;
            say('hidden');
          }
          // Stay until it is no longer hunting and is not close
          if (!danger && dist(me, th.pos) < 6) hideUntil = Math.max(hideUntil, now + 1500);
        } else {
          key('KeyC', false);
          steer(nextCell(cellOf(me), hideCell, c.exitOpen) ? center(nextCell(cellOf(me), hideCell, c.exitOpen) as Cell) : hc, dt, true);
        }
        return;
      }
    } else if (hideCell) {
      say(`left cover after ${((now - hidSince) / 1000).toFixed(1)} s`);
      hideCell = null;
      hidSince = 0;
      key('KeyC', false);
    }

    // The plan for this chamber
    if (c.chamber !== planChamber || c.caughtCount !== planCaught) {
      planChamber = c.chamber;
      planCaught = c.caughtCount;
      stepIdx = 0;
      stepSince = now;
      key('KeyE', false);
      say(`chamber ${c.chamber + 1} plan from the top`);
    }
    const steps = plan(c.chamber);
    const st = steps[stepIdx];
    if (!st) {
      key('KeyW', false);
      key('ShiftLeft', false);
      return;
    }
    const advance = (why: string) => {
      say(why);
      stepIdx += 1;
      stepSince = now;
    };

    if (st.t === 'record') {
      key('KeyW', false);
      key('ShiftLeft', false);
      if (!st.pressed) {
        st.pressed = true;
        tapF();
        say(c.rec.active ? 'stop recording: rewind' : 'start recording');
      } else if (now - stepSince > 450) advance('...');
      return;
    }
    if (st.t === 'wait') {
      key('KeyW', false);
      key('ShiftLeft', false);
      if (now - stepSince > st.sec * 1000) {
        stepIdx += 1;
        stepSince = now;
      }
      return;
    }
    if (st.t === 'until') {
      // Wait for the echo to do its job. Keep still, and keep ready to hide.
      key('KeyW', false);
      key('ShiftLeft', false);
      if (st.cond(c)) advance(st.label);
      return;
    }
    if (st.t === 'face') {
      key('KeyW', false);
      key('ShiftLeft', false);
      g.input.yawRad = Math.atan2(-(st.to.x - me.x), -(st.to.y - me.y));
      advance('facing the VCR');
      return;
    }
    if (st.t === 'holdVcr') {
      key('KeyW', false);
      key('ShiftLeft', false);
      const v = center(LEVEL.vcr);
      g.input.yawRad = Math.atan2(-(v.x - me.x), -(v.y - me.y));
      key('KeyE', true);
      if (now - stepSince > st.sec * 1000 || c.exitOpen) {
        key('KeyE', false);
        advance('held the VCR');
      }
      return;
    }
    if (st.t === 'crouchUntil') {
      key('KeyW', false);
      key('ShiftLeft', false);
      key('KeyE', false);
      key('KeyC', true);
      if (st.cond(c)) {
        key('KeyC', false);
        advance(st.label);
      } else if (st.abort(c)) {
        key('KeyC', false);
        say('it ate the tape; record another');
        planGen += 1;
        stepIdx = 0;
        stepSince = now;
      }
      return;
    }
    if (st.t === 'vcr') {
      const front = { cx: LEVEL.vcr.cx, cy: LEVEL.vcr.cy - 1 };
      if (c.exitOpen) {
        key('KeyE', false);
        advance('tape played');
        return;
      }
      if (dist(me, center(front)) >= 0.3) {
        key('KeyE', false);
        const nx = nextCell(cellOf(me), front, c.exitOpen);
        steer(nx ? center(nx) : center(front), dt, peekUntil === 0);
        return;
      }
      key('KeyW', false);
      key('ShiftLeft', false);
      const v = center(LEVEL.vcr);
      g.input.yawRad = Math.atan2(-(v.x - me.x), -(v.y - me.y));
      key('KeyE', true);
      return;
    }
    // go
    const goal: Cell = cellOf(st.to);
    const arrived = dist(me, st.to) < 0.3;
    if (arrived) {
      advance(`arrived ${goal.cx},${goal.cy}`);
      return;
    }
    const here = cellOf(me);
    const nxt = nextCell(here, goal, c.exitOpen);
    const wp = nxt ? center(nxt) : st.to;
    const doorIdx = nxt ? doorIndex(nxt) : -1;
    if (nxt && doorIdx >= 0 && !c.doors[doorIdx] && dist(me, center(nxt)) < 1.5) {
      steer(center(nxt), dt, false, true);
      tapE(now);
      return;
    }
    steer(wp, dt, !!st.sprint && peekUntil === 0);
  }

  say('bot started');
  requestAnimationFrame(frame);
}
