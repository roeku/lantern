import { describe, expect, it } from 'vitest';
import { TUNING, createState, viewFor } from '../../src/sim';
import { mapInputs, type MapContext } from '../../src/client/input/input-mapper';
import type { ControlState } from '../../src/client/input/controls';

const ctrl = (
  held: string[],
  pressed: string[] = [],
  mouseFloor: { x: number; y: number } | null = { x: 8, y: 6 },
): ControlState => ({ held: new Set(held), pressed, mouseFloor });

const state = createState(1);
const self = state.spectators[0]!;
const specView = viewFor(state, self.player);
const showman: MapContext = {
  role: 'showman', phase: 'playing', view: viewFor(state, 0), self: null, cartOrigin: { x: 8, y: 2 },
};
const spec: MapContext = { role: 'spectator', phase: 'playing', view: specView, self, cartOrigin: { x: 8, y: 2 } };

describe('mapInputs: Showman bindings (Req 9)', () => {
  it('W rolls forward, S rolls back', () => {
    expect(mapInputs(ctrl(['KeyW'], [], null), showman)).toEqual([{ kind: 'roll', dir: 1 }]);
    expect(mapInputs(ctrl(['KeyS'], [], null), showman)).toEqual([{ kind: 'roll', dir: -1 }]);
  });
  it('W and S together cancel', () => {
    expect(mapInputs(ctrl(['KeyW', 'KeyS'], [], null), showman)).toEqual([]);
  });
  it('Shift with W or S rushes; Shift alone does nothing', () => {
    expect(mapInputs(ctrl(['KeyS', 'Shift'], [], null), showman)).toEqual([{ kind: 'rush', dir: -1 }]);
    expect(mapInputs(ctrl(['Shift'], [], null), showman)).toEqual([]);
  });
  it('mouse aims from the cart origin', () => {
    const out = mapInputs(ctrl([], [], { x: 8, y: 7 }), showman);
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe('aim');
    expect((out[0] as { angle: number }).angle).toBeCloseTo(Math.PI / 2);
  });
  it('keys 1, 2, 3 puff vents 0, 1, 2 on press only', () => {
    for (const [i, code] of ['Digit1', 'Digit2', 'Digit3'].entries()) {
      expect(mapInputs(ctrl([code], [code], null), showman)).toEqual([{ kind: 'puff', vent: i }]);
      expect(mapInputs(ctrl([code], [], null), showman)).toEqual([]);
    }
  });
  it('Spectator keys do nothing for the Showman', () => {
    expect(mapInputs(ctrl(['KeyA', 'KeyD', 'Space', 'KeyE'], ['Space', 'Mouse0'], null), showman)).toEqual([]);
  });
  it('sends nothing in any non-playing phase', () => {
    for (const phase of ['lobby', 'ended'] as const) {
      const c = ctrl(['KeyW'], ['Digit1']);
      expect(mapInputs(c, { ...showman, phase })).toEqual([]);
      expect(mapInputs(c, { ...spec, phase })).toEqual([]);
    }
  });
});

describe('mapInputs: Spectator bindings (Req 10)', () => {
  it('WASD maps to move axes, opposing keys cancel, no keys sends nothing', () => {
    expect(mapInputs(ctrl(['KeyW'], [], null), spec)).toEqual([{ kind: 'move', dx: 0, dy: 1 }]);
    expect(mapInputs(ctrl(['KeyS'], [], null), spec)).toEqual([{ kind: 'move', dx: 0, dy: -1 }]);
    expect(mapInputs(ctrl(['KeyA'], [], null), spec)).toEqual([{ kind: 'move', dx: -1, dy: 0 }]);
    expect(mapInputs(ctrl(['KeyD'], [], null), spec)).toEqual([{ kind: 'move', dx: 1, dy: 0 }]);
    expect(mapInputs(ctrl(['KeyA', 'KeyD'], [], null), spec)).toEqual([]);
  });
  it('Space press shields a lit candle, unshields a shielded one, ignores hold', () => {
    const pressed = ctrl(['Space'], ['Space'], null);
    expect(mapInputs(pressed, spec)).toEqual([{ kind: 'shield', candle: self.candleId }]);
    const shielded = { ...spec, view: { ...specView, ownCandle: 'shielded' as const } };
    expect(mapInputs(pressed, shielded)).toEqual([{ kind: 'unshield', candle: self.candleId }]);
    expect(mapInputs(ctrl(['Space'], [], null), spec)).toEqual([]);
  });
  it('left click fans toward the mouse inside reach, on press only', () => {
    const target = { x: self.x + TUNING.fanReachM / 2, y: self.y };
    const out = mapInputs(ctrl(['Mouse0'], ['Mouse0'], target), spec);
    expect(out).toEqual([{ kind: 'fan', x: target.x, y: target.y }]);
    expect(mapInputs(ctrl(['Mouse0'], [], target), spec)).toEqual([]);
  });
  it('fan target clamps to fanReachM along the aim direction', () => {
    const out = mapInputs(ctrl([], ['Mouse0'], { x: self.x, y: self.y - 50 }), spec);
    const fan = out[0] as { x: number; y: number };
    expect(fan.x).toBeCloseTo(self.x);
    expect(fan.y).toBeCloseTo(self.y - TUNING.fanReachM);
  });
  it('fan is not sent while on cooldown, and is sent again at 0', () => {
    const c = ctrl([], ['Mouse0']);
    const cooling = { ...spec, view: { ...specView, ownFanReadyInTicks: 3 } };
    expect(mapInputs(c, cooling)).toEqual([]);
    const ready = { ...spec, view: { ...specView, ownFanReadyInTicks: 0 } };
    expect(mapInputs(c, ready).map((i) => i.kind)).toEqual(['fan']);
  });
  it('E held cuts every tick; nothing is sent with no rope in range', () => {
    const rope = state.ropes[0]!;
    const near = { ...spec, self: { ...self, x: rope.x, y: rope.y }, view: { ...specView, ropes: state.ropes } };
    expect(mapInputs(ctrl(['KeyE'], [], null), near)).toEqual([{ kind: 'cut', rope: rope.id }]);
    const far = { ...near, self: { ...self, x: rope.x + 100, y: rope.y } };
    expect(mapInputs(ctrl(['KeyE'], [], null), far)).toEqual([]);
  });
  it('Showman keys do nothing for a Spectator', () => {
    expect(mapInputs(ctrl(['Shift', 'Digit1'], ['Digit1'], null), spec)).toEqual([]);
  });
  it('snuffed Spectator still moves but cannot shield, fan or cut', () => {
    const snuffed = { ...spec, view: { ...specView, ownCandle: 'snuffed' as const } };
    const out = mapInputs(ctrl(['KeyD', 'KeyE'], ['Space', 'Mouse0']), snuffed);
    expect(out).toEqual([{ kind: 'move', dx: 1, dy: 0 }]);
  });
});
