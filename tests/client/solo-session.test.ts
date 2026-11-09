import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoloSession } from '../../src/client/session/solo-session';
import type { SessionEvent } from '../../src/client/session/session';
import { TUNING } from '../../src/sim';

/** Validates: Requirements 14.1, 14.3, 14.4 */

function makeHarness(seedValues: number[] = [1234, 5678]) {
  let t = 1000;
  let nextHandle = 1;
  let cb: ((n: number) => void) | null = null;
  let seeds = 0;
  const tuning = { ...TUNING, showLengthS: 6 };
  const session = new SoloSession({
    raf: (c) => {
      cb = c;
      return nextHandle++;
    },
    caf: () => {
      cb = null;
    },
    now: () => t,
    seed: () => seedValues[seeds++ % seedValues.length]!,
    tuning,
  });
  /** Advance the stub clock one tick per frame until the Round ends or the budget runs out. */
  const run = (maxFrames = 5000) => {
    for (let i = 0; i < maxFrames && cb !== null; i++) {
      t += tuning.tickS * 1000;
      const c = cb;
      cb = null;
      c(t);
    }
  };
  return { session, run, isIdle: () => cb === null };
}

describe('SoloSession', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor() {
          throw new Error('SoloSession must not open a WebSocket');
        }
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('catches up a new subscriber with hello, roster and state', () => {
    const { session } = makeHarness();
    const events: SessionEvent[] = [];
    session.subscribe((e) => events.push(e));
    expect(events.map((e) => e.kind)).toEqual(['hello', 'roster', 'state']);
    const hello = events[0] as Extract<SessionEvent, { kind: 'hello' }>;
    expect(hello.player).toBe(0);
    expect(hello.role).toBe('showman');
    const roster = (events[1] as Extract<SessionEvent, { kind: 'roster' }>).roster;
    expect(roster.seats).toHaveLength(4);
    expect(roster.seats.filter((s) => s.kind === 'bot')).toHaveLength(3);
    session.dispose();
  });

  it('plays a Round to an Outcome and emits a log with frames and recap', () => {
    const { session, run, isIdle } = makeHarness();
    const events: SessionEvent[] = [];
    session.subscribe((e) => events.push(e));
    run();
    expect(isIdle()).toBe(true);

    const states = events.filter((e) => e.kind === 'state') as Extract<SessionEvent, { kind: 'state' }>[];
    expect(states.length).toBeGreaterThan(1);
    const last = states[states.length - 1]!.state;
    expect(last.ended).toBeTruthy();

    const logs = events.filter((e) => e.kind === 'log') as Extract<SessionEvent, { kind: 'log' }>[];
    expect(logs).toHaveLength(1);
    const log = logs[0]!;
    expect(log.frames[0]!.tick).toBe(0);
    expect(log.frames[log.frames.length - 1]!.tick).toBe(last.tick);
    expect(log.recap).toBeTruthy();

    // A late subscriber is caught up with the log too.
    const late: SessionEvent[] = [];
    session.subscribe((e) => late.push(e));
    expect(late.map((e) => e.kind)).toEqual(['hello', 'roster', 'state', 'log']);
    session.dispose();
  });

  it('rematch starts a fresh Round', () => {
    const { session, run } = makeHarness();
    const events: SessionEvent[] = [];
    session.subscribe((e) => events.push(e));
    run();
    expect(events.some((e) => e.kind === 'log')).toBe(true);

    events.length = 0;
    session.rematch();
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain('roster');
    const fresh = events.find((e) => e.kind === 'state') as Extract<SessionEvent, { kind: 'state' }>;
    expect(fresh.state.tick).toBe(0);
    expect(fresh.state.ended).toBeFalsy();

    run();
    const log = events.find((e) => e.kind === 'log') as Extract<SessionEvent, { kind: 'log' }>;
    expect(log).toBeTruthy();
    expect(log.frames[0]!.tick).toBe(0);
    session.dispose();
  });
});
