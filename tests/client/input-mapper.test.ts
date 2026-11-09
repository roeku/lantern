import { describe, expect, it } from 'vitest';
import { TUNING, createState, viewFor } from '../../src/sim';
import { mapInputs } from '../../src/client/input/input-mapper';
import type { ControlState } from '../../src/client/input/controls';

const ctrl = (held: string[], pressed: string[] = [], mouseFloor = { x: 8, y: 6 }): ControlState => ({
  held: new Set(held), pressed, mouseFloor,
});
const state = createState(1);
const showmanCtx = { role: 'showman' as const, phase: 'playing' as const, view: viewFor(state, 0), self: null, cartOrigin: { x: 8, y: 2 } };
const specPlayer = state.spectators[0]!.player;
const specView = viewFor(state, specPlayer);
const specCtx = { role: 'spectator' as const, phase: 'playing' as const, view: specView, self: state.spectators[0]!, cartOrigin: { x: 8, y: 2 } };

describe('mapInputs', () => {
  it('sends nothing outside playing', () => {
    expect(mapInputs(ctrl(['KeyW']), { ...showmanCtx, phase: 'lobby' })).toEqual([]);
  });
  it('showman aims, rushes and puffs once per press', () => {
    const out = mapInputs(ctrl(['KeyW', 'Shift', 'Digit2'], ['Digit2']), showmanCtx);
    expect(out.map((i) => i.kind)).toEqual(['aim', 'rush', 'puff']);
    expect(mapInputs(ctrl(['Digit2']), showmanCtx).some((i) => i.kind === 'puff')).toBe(false);
  });
  it('spectator move sums, fan clamps to reach', () => {
    const far = { x: specCtx.self.x + 100, y: specCtx.self.y };
    const out = mapInputs(ctrl(['KeyW', 'KeyD'], ['Mouse0'], far), specCtx);
    expect(out[0]).toEqual({ kind: 'move', dx: 1, dy: 1 });
    const fan = out.find((i) => i.kind === 'fan') as { x: number; y: number };
    expect(fan.x - specCtx.self.x).toBeCloseTo(TUNING.fanReachM);
  });
  it('cut names the nearest standing rope in range', () => {
    const rope = state.ropes[0]!;
    const self = { ...specCtx.self, x: rope.x, y: rope.y };
    const out = mapInputs(ctrl(['KeyE']), { ...specCtx, self, view: { ...specView, ropes: state.ropes } });
    expect(out).toEqual([{ kind: 'cut', rope: rope.id }]);
  });
  it('snuffed spectator sends only move', () => {
    const view = { ...specView, ownCandle: 'snuffed' as const };
    const out = mapInputs(ctrl(['KeyW', 'KeyE'], ['Space', 'Mouse0']), { ...specCtx, view });
    expect(out.map((i) => i.kind)).toEqual(['move']);
  });
});
