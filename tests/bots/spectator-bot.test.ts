import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { spectatorBotInputs } from '../../src/bots/spectator-bot';
import { createState, step, TUNING, validateTuning, type Ghost, type Input, type State, type Tuning } from '../../src/sim';

const ALWAYS: Tuning = { ...TUNING, botReactChancePerTick: 1 };
/** Solid ghost 1 m from candle 0 at (2.5, 1.5). */
const NEAR_CANDLE_0: Ghost = { col: 2, row: 0, density: 1, solid: true };

function withGhost(ghost: Ghost | null, patch: Partial<State> = {}): State {
  return { ...createState(1), ghost, ...patch };
}

/** Inputs that answer a threat (everything except cutting). */
function reactions(inputs: Input[]): Input[] {
  return inputs.filter((i) => i.kind !== 'cut' && i.kind !== 'move');
}

describe('spectator bots', () => {
  it('move toward the nearest standing rope, and cut once within ropeCutRadiusM', () => {
    const base = createState(1);
    const [x, y] = TUNING.ropePositions[0] as [number, number];
    const at = (px: number, py: number): State => ({
      ...withGhost(null),
      spectators: base.spectators.map((s) => (s.player === 1 ? { ...s, x: px, y: py } : s)),
      candles: base.candles.map((c) => (c.id === 0 ? { ...c, x: px, y: py } : c)),
    });
    expect(spectatorBotInputs(at(x, y - 5), [1], ALWAYS)).toEqual([{ player: 1, kind: 'move', dx: 0, dy: 5 }]);
    expect(spectatorBotInputs(at(x, y - TUNING.ropeCutRadiusM), [1], ALWAYS)).toEqual([
      { player: 1, kind: 'cut', rope: 0 },
    ]);
  });

  it('breaks distance ties to the lower rope id and skips cut ropes', () => {
    const base = createState(1);
    const ropes = base.ropes.map((r, i) => ({ ...r, x: i === 1 || i === 2 ? 10 : 0, y: i === 1 || i === 2 ? 10 : 0 }));
    const s = withGhost(null, { ropes: ropes.map((r) => (r.id === 0 ? { ...r, status: 'cut' as const } : r)) });
    const c = s.candles.find((k) => k.id === 0)!;
    const inputs = spectatorBotInputs(s, [1], ALWAYS);
    expect(inputs).toEqual([{ player: 1, kind: 'move', dx: 10 - c.x, dy: 10 - c.y }]);
  });

  it('send nothing when no rope stands, and suppress move and cut when threatened but unrolled', () => {
    const none = withGhost(null, { ropes: createState(1).ropes.map((r) => ({ ...r, status: 'cut' as const })) });
    expect(spectatorBotInputs(none, [1], ALWAYS)).toEqual([]);
    const missed: Tuning = { ...TUNING, botReactChancePerTick: Number.MIN_VALUE };
    expect(spectatorBotInputs(withGhost(NEAR_CANDLE_0), [1], missed)).toEqual([]);
  });

  it('rejects a negative cut start or stagger', () => {
    expect(() => validateTuning({ ...TUNING, botCutStartS: -1 })).toThrow('botCutStartS');
    expect(() => validateTuning({ ...TUNING, botCutStaggerS: Number.NaN })).toThrow('botCutStaggerS');
  });

  it('fans at a solid ghost near its candle', () => {
    expect(spectatorBotInputs(withGhost(NEAR_CANDLE_0), [1], ALWAYS)).toEqual([
      { player: 1, kind: 'fan', x: 2.5, y: 0.5 },
    ]);
  });

  it('does nothing when there is no ghost, a faint ghost, or the ghost is far away', () => {
    expect(reactions(spectatorBotInputs(withGhost(null), [1, 2, 3], ALWAYS))).toEqual([]);
    expect(reactions(spectatorBotInputs(withGhost({ ...NEAR_CANDLE_0, solid: false }), [1], ALWAYS))).toEqual([]);
    expect(reactions(spectatorBotInputs(withGhost({ col: 15, row: 2, density: 1, solid: true }), [1], ALWAYS))).toEqual([]);
  });

  it('shields when its fan is cooling down, and unshields once the threat is gone', () => {
    const cooling = withGhost(NEAR_CANDLE_0, { fanReadyTick: { '1': 100 } });
    expect(spectatorBotInputs(cooling, [1], ALWAYS)).toEqual([{ player: 1, kind: 'shield', candle: 0 }]);

    const shielded = withGhost(null, {
      candles: createState(1).candles.map((c) => (c.id === 0 ? { ...c, status: 'shielded' as const } : c)),
    });
    expect(spectatorBotInputs(shielded, [1], ALWAYS)).toEqual([{ player: 1, kind: 'unshield', candle: 0 }]);
  });

  it('spends at most one fan per tick across all bots', () => {
    const wide: Tuning = { ...ALWAYS, botWarnMarginM: 100 };
    const inputs = spectatorBotInputs(withGhost(NEAR_CANDLE_0), [3, 1, 2], wide);
    expect(inputs.filter((i) => i.kind === 'fan')).toHaveLength(1);
    expect(inputs.filter((i) => i.kind === 'shield')).toHaveLength(2);
  });

  it('ignores the Showman, snuffed candles and ended rounds', () => {
    expect(spectatorBotInputs(withGhost(NEAR_CANDLE_0), [0], ALWAYS)).toEqual([]);
    const snuffed = withGhost(NEAR_CANDLE_0, {
      candles: createState(1).candles.map((c) => (c.id === 0 ? { ...c, status: 'snuffed' as const } : c)),
    });
    expect(spectatorBotInputs(snuffed, [1], ALWAYS)).toEqual([]);
    expect(spectatorBotInputs(withGhost(NEAR_CANDLE_0, { ended: true }), [1], ALWAYS)).toEqual([]);
  });

  it('reacts on about botReactChancePerTick of ticks', () => {
    const ticks = 2000;
    let reacted = 0;
    for (let tick = 0; tick < ticks; tick++) {
      if (reactions(spectatorBotInputs(withGhost(NEAR_CANDLE_0, { tick }), [1])).length > 0) reacted++;
    }
    expect(reacted / ticks).toBeGreaterThan(TUNING.botReactChancePerTick - 0.05);
    expect(reacted / ticks).toBeLessThan(TUNING.botReactChancePerTick + 0.05);
  });

  it('rejects a reaction chance above 1', () => {
    expect(() => validateTuning({ ...TUNING, botReactChancePerTick: 1.5 })).toThrow('botReactChancePerTick');
  });
});

describe('spectator bots (properties)', () => {
  const stateArb = fc
    .record({
      tick: fc.integer({ min: 0, max: 5000 }),
      rng: fc.integer({ min: 0, max: 0xffffffff }),
      col: fc.integer({ min: 0, max: TUNING.roomWidthM - 1 }),
      row: fc.integer({ min: 0, max: TUNING.roomDepthM - 1 }),
      solid: fc.boolean(),
      noGhost: fc.boolean(),
      travel: fc.double({ min: 0, max: TUNING.cartTravelMaxM, noNaN: true }),
    })
    .map(({ tick, rng, col, row, solid, noGhost, travel }) =>
      withGhost(noGhost ? null : { col, row, density: 1, solid }, { tick, rng, cart: { travel, speedMps: 0 } }),
    );
  const playersArb = fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 6 });

  it('is deterministic, never mutates state, and only emits legal bot inputs', () => {
    fc.assert(
      fc.property(stateArb, playersArb, (state, players) => {
        const before = structuredClone(state);
        const a = spectatorBotInputs(state, players, ALWAYS);
        expect(state).toEqual(before);
        expect(spectatorBotInputs(structuredClone(state), players, ALWAYS)).toEqual(a);
        for (const input of a) {
          expect(players).toContain(input.player);
          expect(input.player).not.toBe(state.showmanId);
          expect(['fan', 'shield', 'unshield', 'cut', 'move']).toContain(input.kind);
          if (input.kind === 'fan') {
            expect(input.x).toBeGreaterThanOrEqual(0);
            expect(input.x).toBeLessThanOrEqual(TUNING.roomWidthM);
            expect(input.y).toBeGreaterThanOrEqual(0);
            expect(input.y).toBeLessThanOrEqual(TUNING.roomDepthM);
          }
        }
      }),
    );
  });

  it('a full show with the Showman puffing and bots playing stays valid and ends on tick count', () => {
    let state = createState(9);
    const total = TUNING.showLengthS / TUNING.tickS;
    for (let i = 0; i < total; i++) {
      const showman = i % 4 === 0 ? [{ player: 0, kind: 'puff' as const, vent: i % 3 }] : [];
      state = step(state, [...showman, ...spectatorBotInputs(state, [1, 2, 3])]);
      expect(state.grid.every((v) => v >= 0 && v <= 1)).toBe(true);
    }
    expect(state.ended).toBe(true);
    expect(state.tick).toBeLessThanOrEqual(total);
  });
});
