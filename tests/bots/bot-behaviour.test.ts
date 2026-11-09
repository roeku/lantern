// Validates: Requirements 5.4, 5.5, 5.6, 5.7
import { describe, expect, it } from 'vitest';
import { spectatorBotInputs } from '../../src/bots/spectator-bot';
import { createState, TUNING, type Ghost, type State, type Tuning } from '../../src/sim';

const ALWAYS: Tuning = { ...TUNING, botReactChancePerTick: 1 };
const NEAR_CANDLE_0: Ghost = { col: 2, row: 0, density: 1, solid: true };
const FAR: Ghost = { col: 15, row: 2, density: 1, solid: true };

function setCandle0(state: State, status: 'lit' | 'shielded' | 'snuffed'): State {
  return { ...state, candles: state.candles.map((c) => (c.id === 0 ? { ...c, status } : c)) };
}

describe('bot threat handling with ropes standing', () => {
  it('a threatened bot never sends move or cut, whatever its reaction', () => {
    const base = { ...createState(1), ghost: NEAR_CANDLE_0 };
    expect(base.ropes.some((r) => r.status === 'standing')).toBe(true);
    for (const t of [ALWAYS, { ...TUNING, botReactChancePerTick: Number.MIN_VALUE }]) {
      const kinds = spectatorBotInputs(base, [1], t).map((i) => i.kind);
      expect(kinds).not.toContain('move');
      expect(kinds).not.toContain('cut');
    }
  });

  it('unshields only (no move or cut) once the ghost is far away', () => {
    const s = setCandle0({ ...createState(1), ghost: FAR }, 'shielded');
    expect(spectatorBotInputs(s, [1], ALWAYS)).toEqual([{ player: 1, kind: 'unshield', candle: 0 }]);
  });

  it('a snuffed bot is silent with ropes standing, with or without a ghost', () => {
    for (const ghost of [null, NEAR_CANDLE_0, FAR]) {
      const s = setCandle0({ ...createState(1), ghost }, 'snuffed');
      expect(spectatorBotInputs(s, [1], ALWAYS)).toEqual([]);
    }
  });
});
