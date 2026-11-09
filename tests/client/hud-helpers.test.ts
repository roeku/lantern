import { describe, expect, it } from 'vitest';
import { TUNING, createState, viewFor, type View } from '../../src/sim';
import { formatRemaining, hudModel } from '../../src/client/ui/hud-model';
import {
  NOTICE_MS,
  activeNotices,
  addNotices,
  diffEvents,
  type EventSource,
} from '../../src/client/ui/notices';

const state = createState(1);
const showmanView = viewFor(state, 0);
const specView = viewFor(state, state.spectators[0]!.player);
const showmanRoster = { role: 'showman' as const, roomCode: 'ABCD', playerId: 0 };
const specRoster = { role: 'spectator' as const, roomCode: 'ABCD', playerId: 1 };
const withView = (v: View, patch: Partial<View>): View => ({ ...v, ...patch });

describe('formatRemaining', () => {
  it('formats several ticks as m:ss, rounding up and clamping at 0:00', () => {
    const perSecond = Math.round(1 / TUNING.tickS);
    const total = TUNING.showLengthS;
    const m = Math.floor(total / 60);
    const s = total % 60;
    expect(formatRemaining(0)).toBe(`${m}:${s < 10 ? '0' : ''}${s}`);
    expect(formatRemaining(perSecond * (total - 61))).toBe('1:01');
    expect(formatRemaining(perSecond * (total - 60))).toBe('1:00');
    expect(formatRemaining(perSecond * (total - 5) + 1)).toBe('0:05');
    expect(formatRemaining(perSecond * total)).toBe('0:00');
    expect(formatRemaining(perSecond * total + 100)).toBe('0:00');
  });
});

describe('hudModel', () => {
  it('shows time, ropes and candles', () => {
    const hud = hudModel(withView(specView, { ropesCut: 1 }), specRoster);
    const n = TUNING.spectatorStartPositions.length;
    expect(hud.ropes).toBe(`1/${TUNING.ropeCount}`);
    expect(hud.candles).toBe(`${n}/${n}`);
    expect(hud.roomCode).toBe('ABCD');
  });

  it('counts snuffed candles, including the accumulated count', () => {
    const n = TUNING.spectatorStartPositions.length;
    const candles = specView.candles.map((c, i) => (i === 0 ? { ...c, status: 'snuffed' as const } : c));
    expect(hudModel(withView(specView, { candles }), specRoster).candles).toBe(`${n - 1}/${n}`);
    expect(hudModel(specView, specRoster, TUNING, { snuffedCount: 2 }).candles).toBe(`${n - 2}/${n}`);
  });

  it('shows the fan as Ready or a cooldown in seconds', () => {
    expect(hudModel(withView(specView, { ownFanReadyInTicks: 0 }), specRoster).fan).toBe('Ready');
    const ticks = Math.round(4 / TUNING.tickS);
    expect(hudModel(withView(specView, { ownFanReadyInTicks: ticks }), specRoster).fan).toBe('4.0s');
  });

  it('hides the fan for a snuffed Spectator', () => {
    expect(hudModel(withView(specView, { ownCandle: 'snuffed' }), specRoster).fan).toBeNull();
  });

  it('shows cart travel and image scale for the Showman only', () => {
    const show = hudModel(withView(showmanView, { cart: { travel: 3 } }), showmanRoster);
    expect(show.role).toBe('Showman');
    expect(show.fan).toBeNull();
    expect(show.cartTravel).toBe(`3.0 / ${TUNING.cartTravelMaxM} m`);
    expect(show.imageScale).toMatch(/^x\d+\.\d{2}$/);
    const spec = hudModel(specView, specRoster);
    expect(spec.role).toBe('Spectator');
    expect(spec.cartTravel).toBeNull();
    expect(spec.imageScale).toBeNull();
  });
});

describe('diffEvents', () => {
  const src = (candle: 'lit' | 'snuffed', rope: 'intact' | 'cut'): EventSource => ({
    candles: [{ id: 0, status: candle as never }],
    ropes: [{ id: 1, status: rope as never }],
  });

  it('reports a snuff', () => {
    expect(diffEvents(src('lit', 'intact'), src('snuffed', 'intact'))).toEqual([
      { kind: 'snuff', id: 0, text: 'Candle 1 snuffed' },
    ]);
  });

  it('reports a cut', () => {
    expect(diffEvents(src('lit', 'intact'), src('lit', 'cut'))).toEqual([
      { kind: 'cut', id: 1, text: 'Rope 2 cut' },
    ]);
  });

  it('reports nothing when unchanged or already happened', () => {
    expect(diffEvents(src('lit', 'intact'), src('lit', 'intact'))).toEqual([]);
    expect(diffEvents(src('snuffed', 'cut'), src('snuffed', 'cut'))).toEqual([]);
  });
});

describe('notices', () => {
  it('expire 3 s after being added', () => {
    expect(NOTICE_MS).toBe(3000);
    const events = diffEvents(
      { candles: [{ id: 0, status: 'lit' as never }], ropes: [] },
      { candles: [{ id: 0, status: 'snuffed' as never }], ropes: [] },
    );
    const list = addNotices([], events, 1000);
    expect(activeNotices(list, 1000)).toHaveLength(1);
    expect(activeNotices(list, 3999)).toHaveLength(1);
    expect(activeNotices(list, 4000)).toHaveLength(0);
  });
});
