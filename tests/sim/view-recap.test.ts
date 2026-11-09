import { describe, expect, it } from 'vitest';
import { buildRecap, toReplayFrame, type ReplayFrame } from '../../src/sim/recap';
import { createState, type CandleStatus, type Ghost, type State } from '../../src/sim/state';
import { TUNING } from '../../src/sim/tuning';
import { beamLitCells, viewFor } from '../../src/sim/view';

// Hand-built layout (Showman = player 0, Spectators = players 1..3 owning candles 0..2):
//   beam origin (8, 2), angle pi/2, so the beam runs straight up +y through column 7 and 8.
//   candle 0 (2.5, 1.5), candle 1 (13.5, 1.5), candle 2 (8.5, 4.5) is outside the beam cone.
//   rope 2 (8.5, 6.5) is inside the beam; ropes 0 and 1 are far from the beam.
const W = TUNING.roomWidthM;
const idx = (col: number, row: number): number => row * W + col;

function world(statuses: CandleStatus[] = ['lit', 'lit', 'lit'], ghost: Ghost | null = null): State {
  const s = createState(1);
  s.candles.forEach((c, i) => {
    c.status = statuses[i] as CandleStatus;
  });
  s.ghost = ghost;
  return s;
}

describe('beamLitCells', () => {
  it('contains cells straight up the beam and not cells beside the candle', () => {
    const cells = beamLitCells(world()).map((c) => idx(c.col, c.row));
    expect(cells).toContain(idx(8, 8));
    expect(cells).not.toContain(idx(8, 4));
    expect(cells).not.toContain(idx(0, 0));
  });
});

describe('viewFor: Showman (Req 4.2 to 4.5)', () => {
  it('sees beam cells and cells near lit candles only', () => {
    const v = viewFor(world(), 0);
    const seen = new Set(v.cells.map((c) => c.index));
    expect(seen.has(idx(8, 8))).toBe(true); // beam
    expect(seen.has(idx(0, 0))).toBe(true); // within 3 m of lit candle 0
    expect(seen.has(idx(15, 11))).toBe(false);
    expect(v.beam).toEqual({ angle: TUNING.beamAngleDefaultRad });
    expect(v.ownCandle).toBeNull();
  });

  it('carries smoke density for visible cells', () => {
    const s = world();
    s.grid[idx(8, 8)] = 0.7;
    const v = viewFor(s, 0);
    expect(v.cells.find((c) => c.index === idx(8, 8))?.density).toBe(0.7);
  });

  it('includes ropes and spectators only in the beam or near a lit candle', () => {
    const v = viewFor(world(), 0);
    expect(v.ropes.map((r) => r.id)).toEqual([2]);
    // Every spectator stands on its own lit candle, so all are in light.
    expect(v.spectators).toHaveLength(3);
  });

  it('hides a spectator whose candle is not lit and who is outside the beam', () => {
    const v = viewFor(world(['lit', 'snuffed', 'shielded']), 0);
    expect(v.spectators.map((s) => s.player)).toEqual([1]);
    expect(v.candles.map((c) => c.id)).toEqual([0]);
  });

  it('shows shielded and snuffed candles inside the beam, and always shows lit candles', () => {
    const s = world(['lit', 'snuffed', 'shielded']);
    s.candles[1]!.x = 8.5;
    s.candles[1]!.y = 8.5;
    s.spectators[1]!.x = 8.5;
    s.spectators[1]!.y = 8.5;
    const v = viewFor(s, 0);
    expect(v.candles.map((c) => c.id)).toEqual([0, 1]);
    expect(v.spectators.map((p) => p.player)).toEqual([1, 2]);
    // Lit candle far from everything is still included.
    expect(viewFor(world(), 0).candles.map((c) => c.id)).toEqual([0, 1, 2]);
  });

  it('shows the ghost only when its cell is a Beam_Lit_Cell', () => {
    expect(viewFor(world(undefined, { col: 8, row: 8, density: 0.9, solid: true }), 0).ghost).not.toBeNull();
    expect(viewFor(world(undefined, { col: 0, row: 0, density: 0.9, solid: true }), 0).ghost).toBeNull();
    expect(viewFor(world(undefined, { col: 12, row: 9, density: 0.9, solid: true }), 0).ghost).toBeNull();
  });
});

describe('viewFor: Spectator with a lit or shielded candle (Req 4.6)', () => {
  it('sees only cells, ropes and others within the lit radius', () => {
    const v = viewFor(world(), 3); // candle 2 at (8.5, 4.5)
    const seen = new Set(v.cells.map((c) => c.index));
    expect(seen.has(idx(8, 4))).toBe(true);
    expect(seen.has(idx(0, 0))).toBe(false);
    expect(v.ropes.map((r) => r.id)).toEqual([2]); // 2 m away
    expect(v.spectators.map((p) => p.player)).toEqual([3]); // only self
    expect(v.beam).toBeNull();
    expect(v.ownCandle).toBe('lit');
  });

  it('sees every lit candle anywhere and every solid ghost anywhere', () => {
    const v = viewFor(world(undefined, { col: 0, row: 11, density: 1, solid: true }), 3);
    expect(v.candles.map((c) => c.id)).toEqual([0, 1, 2]);
    expect(v.ghost).not.toBeNull();
  });

  it('sees a non-solid ghost only within its radius', () => {
    expect(viewFor(world(undefined, { col: 8, row: 5, density: 0.3, solid: false }), 3).ghost).not.toBeNull();
    expect(viewFor(world(undefined, { col: 0, row: 11, density: 0.3, solid: false }), 3).ghost).toBeNull();
  });

  it('shrinks to the shielded radius and hides non-lit candles of others', () => {
    const v = viewFor(world(['lit', 'snuffed', 'shielded']), 3);
    expect(v.ownCandle).toBe('shielded');
    expect(v.ropes).toEqual([]); // rope 2 is 2 m away, shielded radius is 1 m
    const seen = new Set(v.cells.map((c) => c.index));
    expect(seen.has(idx(8, 4))).toBe(true);
    expect(seen.has(idx(8, 6))).toBe(false);
    // own candle and the lit candle 0; snuffed candle 1 is far away
    expect(v.candles.map((c) => c.id)).toEqual([0, 2]);
  });
});

describe('viewFor: Audience_Side (Req 4.7)', () => {
  it('sees the full state except the beam angle', () => {
    const g: Ghost = { col: 0, row: 11, density: 0.3, solid: false };
    const s = world(['lit', 'lit', 'snuffed'], g);
    const v = viewFor(s, 3);
    expect(v.beam).toBeNull();
    expect(v.cells).toHaveLength(TUNING.roomWidthM * TUNING.roomDepthM);
    expect(v.ropes).toHaveLength(3);
    expect(v.spectators).toHaveLength(3);
    expect(v.candles).toHaveLength(3);
    expect(v.ghost).toEqual(g);
    expect(v.ownCandle).toBe('snuffed');
  });
});

describe('viewFor: shared fields (Req 4.8) and purity (Req 4.1)', () => {
  it('reports tick, outcome, ropes cut, own candle and own fan cooldown', () => {
    const s = world(['lit', 'shielded', 'lit']);
    s.tick = 20;
    s.fanReadyTick['2'] = 50;
    s.ropes[0]!.status = 'cut';
    s.ropes[1]!.status = 'cut';
    s.outcome = { winner: 'showman', reason: 'time_up', tick: 20 };
    const v = viewFor(s, 2);
    expect(v.tick).toBe(20);
    expect(v.outcome).toEqual(s.outcome);
    expect(v.ropesCut).toBe(2);
    expect(v.ownCandle).toBe('shielded');
    expect(v.ownFanReadyInTicks).toBe(30);
    expect(viewFor(s, 0).ownFanReadyInTicks).toBe(0);
  });

  it('does not mutate state or alias it', () => {
    const s = world(undefined, { col: 8, row: 8, density: 1, solid: true });
    const before = structuredClone(s);
    for (const p of [0, 1, 2, 3]) {
      const v = viewFor(s, p);
      v.ropes.forEach((r) => (r.x = -1));
      v.candles.forEach((c) => (c.x = -1));
      if (v.ghost) v.ghost.col = -1;
    }
    expect(s).toEqual(before);
  });
});

// ---- Recap -------------------------------------------------------------------------------

function frame(
  tick: number,
  opts: { ghost?: Ghost | null; snuffed?: number[]; cut?: number[] } = {},
): ReplayFrame {
  const s = createState(1);
  s.tick = tick;
  s.ghost = opts.ghost ?? null;
  for (const id of opts.snuffed ?? []) s.candles[id]!.status = 'snuffed';
  for (const id of opts.cut ?? []) {
    s.ropes[id]!.status = 'cut';
    s.ropes[id]!.cutTick = tick;
  }
  return toReplayFrame(s);
}

// Ghost cell centred on candle 0 at (2.5, 1.5).
const ON_CANDLE: Ghost = { col: 2, row: 1, density: 1, solid: true };
const AWAY: Ghost = { col: 12, row: 10, density: 1, solid: true };

describe('buildRecap (Req 13.2)', () => {
  it('returns an empty recap for no frames', () => {
    expect(buildRecap([])).toEqual({ snuffs: [], ropeCuts: [], nearMisses: 0, lastRopeCutTick: null });
  });

  it('records the first tick and position of each snuff', () => {
    const r = buildRecap([
      frame(0),
      frame(2, { snuffed: [1] }),
      frame(4, { snuffed: [1] }),
      frame(6, { snuffed: [0, 1] }),
    ]);
    expect(r.snuffs).toEqual([
      { tick: 2, candleId: 1, x: 13.5, y: 1.5 },
      { tick: 6, candleId: 0, x: 2.5, y: 1.5 },
    ]);
  });

  it('records each rope cut once and the last cut tick', () => {
    const r = buildRecap([frame(0), frame(2, { cut: [2] }), frame(4, { cut: [2] }), frame(6, { cut: [2, 0] })]);
    expect(r.ropeCuts.map((c) => [c.tick, c.ropeId])).toEqual([
      [2, 2],
      [6, 0],
    ]);
    expect(r.ropeCuts[0]).toMatchObject({ x: 8.5, y: 6.5 });
    expect(r.lastRopeCutTick).toBe(6);
  });

  it('a Round with no rope cut has no cuts and a null last cut tick', () => {
    const r = buildRecap([frame(0), frame(2), frame(4, { snuffed: [0] })]);
    expect(r.ropeCuts).toEqual([]);
    expect(r.lastRopeCutTick).toBeNull();
    expect(r.snuffs).toHaveLength(1);
  });

  it('counts one contiguous near run as one Near_Miss', () => {
    const r = buildRecap([
      frame(0),
      frame(2, { ghost: ON_CANDLE }),
      frame(4, { ghost: ON_CANDLE }),
      frame(6, { ghost: ON_CANDLE }),
      frame(8, { ghost: AWAY }),
    ]);
    expect(r.nearMisses).toBe(1);
  });

  it('counts two separate runs as two Near_Misses', () => {
    const r = buildRecap([
      frame(0, { ghost: ON_CANDLE }),
      frame(2, { ghost: AWAY }),
      frame(4, { ghost: ON_CANDLE }),
      frame(6, { ghost: null }),
    ]);
    expect(r.nearMisses).toBe(2);
  });

  it('counts runs per candle', () => {
    // Ghost sits between candle 0 and nothing else; a second candle run needs its own position.
    const onCandle1: Ghost = { col: 13, row: 1, density: 1, solid: true };
    const r = buildRecap([
      frame(0, { ghost: ON_CANDLE }),
      frame(2, { ghost: onCandle1 }),
      frame(4, { ghost: AWAY }),
    ]);
    expect(r.nearMisses).toBe(2);
  });

  it('does not count a run that ends in a snuff', () => {
    const r = buildRecap([
      frame(0),
      frame(2, { ghost: ON_CANDLE }),
      frame(4, { ghost: ON_CANDLE }),
      frame(6, { ghost: ON_CANDLE, snuffed: [0] }),
      frame(8, { ghost: AWAY, snuffed: [0] }),
    ]);
    expect(r.nearMisses).toBe(0);
    expect(r.snuffs).toEqual([{ tick: 6, candleId: 0, x: 2.5, y: 1.5 }]);
  });

  it('ignores a non-solid ghost near a candle', () => {
    const faint: Ghost = { ...ON_CANDLE, solid: false };
    const r = buildRecap([frame(0, { ghost: faint }), frame(2, { ghost: faint }), frame(4)]);
    expect(r.nearMisses).toBe(0);
  });

  it('does not mutate its input frames', () => {
    const frames = [frame(0, { ghost: ON_CANDLE }), frame(2, { cut: [1], snuffed: [0] })];
    const before = structuredClone(frames);
    buildRecap(frames);
    expect(frames).toEqual(before);
  });
});
