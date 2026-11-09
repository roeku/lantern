/**
 * Offline session. Player 0 is the human Showman, players 1 to 3 are Spectator_Bots.
 * Runs the sim in the browser on a fixed-step clock driven by requestAnimationFrame.
 * Opens no WebSocket. A new subscriber is caught up with the latest hello, roster and state.
 */

import { spectatorBotInputs } from '../../bots';
import { MAX_CATCH_UP_TICKS, createFixedStepClock, type FixedStepClock } from '../../net/fixed-step';
import type { ClientInput } from '../../net/protocol';
import { TUNING, buildRecap, createState, step, toReplayFrame } from '../../sim';
import type { Input, ReplayFrame, State, Tuning } from '../../sim';
import type { GameSession, Phase, Roster, SessionEvent } from './session';

export const SOLO_CODE = 'SOLO';
const HUMAN = 0;
const BOTS: readonly number[] = [1, 2, 3];

export interface SoloSessionDeps {
  raf: (cb: (nowMs: number) => void) => number;
  caf: (handle: number) => void;
  now: () => number;
  /** Returns a uint32 seed. */
  seed: () => number;
  tuning: Tuning;
}

export function cryptoSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]!;
}

function defaultDeps(): SoloSessionDeps {
  return {
    raf: (cb) => requestAnimationFrame(cb),
    caf: (h) => cancelAnimationFrame(h),
    now: () => performance.now(),
    seed: cryptoSeed,
    tuning: TUNING,
  };
}

export class SoloSession implements GameSession {
  private readonly deps: SoloSessionDeps;
  private readonly listeners = new Set<(e: SessionEvent) => void>();
  private state: State;
  private clock: FixedStepClock;
  private frames: ReplayFrame[] = [];
  private pending: Input[] = [];
  private phase: Phase = 'playing';
  private lastLog: SessionEvent | null = null;
  private handle: number | null = null;
  private disposed = false;

  constructor(deps: Partial<SoloSessionDeps> = {}) {
    this.deps = { ...defaultDeps(), ...deps };
    this.state = this.newState();
    this.clock = this.newClock();
    this.frames = [toReplayFrame(this.state)];
    this.schedule();
  }

  subscribe(listener: (e: SessionEvent) => void): () => void {
    this.listeners.add(listener);
    listener(this.helloEvent());
    listener(this.rosterEvent());
    listener({ kind: 'state', state: this.state, receivedAtMs: this.deps.now() });
    if (this.lastLog !== null) listener(this.lastLog);
    return () => {
      this.listeners.delete(listener);
    };
  }

  sendInput(input: ClientInput): void {
    if (this.phase !== 'playing') return;
    this.pending.push({ ...input, player: HUMAN } as Input);
  }

  /** The Round starts on construction, so this does nothing. */
  start(): void {}

  rematch(): void {
    if (this.disposed || this.phase !== 'ended') return;
    this.state = this.newState();
    this.clock = this.newClock();
    this.frames = [toReplayFrame(this.state)];
    this.pending = [];
    this.lastLog = null;
    this.phase = 'playing';
    this.emit(this.rosterEvent());
    this.emit({ kind: 'state', state: this.state, receivedAtMs: this.deps.now() });
    this.schedule();
  }

  dispose(): void {
    this.disposed = true;
    this.cancel();
    this.listeners.clear();
  }

  private newState(): State {
    return createState(this.deps.seed(), this.deps.tuning, { showmanId: HUMAN });
  }

  private newClock(): FixedStepClock {
    return createFixedStepClock(this.deps.now(), this.deps.tuning.tickS * 1000, MAX_CATCH_UP_TICKS);
  }

  private schedule(): void {
    if (this.disposed || this.handle !== null) return;
    this.handle = this.deps.raf((nowMs) => {
      this.handle = null;
      this.frame(nowMs);
    });
  }

  private cancel(): void {
    if (this.handle !== null) this.deps.caf(this.handle);
    this.handle = null;
  }

  private frame(nowMs: number): void {
    if (this.disposed || this.phase !== 'playing') return;
    const due = this.clock.advance(nowMs);
    let stepped = false;
    for (let i = 0; i < due && !this.state.ended; i++) {
      const inputs = [...this.pending, ...spectatorBotInputs(this.state, BOTS, this.deps.tuning)];
      this.pending = [];
      this.state = step(this.state, inputs, this.deps.tuning);
      stepped = true;
      if (this.state.ended || this.state.tick % 2 === 0) this.frames.push(toReplayFrame(this.state));
    }
    if (stepped) this.emit({ kind: 'state', state: this.state, receivedAtMs: nowMs });
    if (this.state.ended) {
      this.finish();
      return;
    }
    this.schedule();
  }

  private finish(): void {
    this.phase = 'ended';
    const frames = this.frames;
    this.lastLog = { kind: 'log', frames, recap: buildRecap(frames, this.deps.tuning) };
    this.emit(this.rosterEvent());
    this.emit(this.lastLog);
  }

  private helloEvent(): SessionEvent {
    return { kind: 'hello', player: HUMAN, role: 'showman', code: SOLO_CODE, phase: this.phase };
  }

  private rosterEvent(): SessionEvent {
    const roster: Roster = {
      phase: this.phase,
      showman: HUMAN,
      seats: [
        { seat: 0, kind: 'human', role: 'showman', connected: true },
        ...BOTS.map((seat) => ({ seat, kind: 'bot' as const, role: 'spectator' as const, connected: true })),
      ],
      rematchPending: false,
      graceTicksLeft: [null, null, null, null],
    };
    return { kind: 'roster', roster };
  }

  private emit(e: SessionEvent): void {
    for (const l of [...this.listeners]) l(e);
  }
}
