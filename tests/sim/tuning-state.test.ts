import { describe, expect, it } from 'vitest';
import { createState } from '../../src/sim/state';
import { TUNING, validateTuning, type Tuning } from '../../src/sim/tuning';

const POSITIVE_FIELDS = [
  'tickS', 'showLengthS', 'roomWidthM', 'roomDepthM', 'puffDensity', 'puffRadiusM',
  'smokeDecayPerS', 'smokeSpreadPerS', 'solidityThresholdBase', 'cartTravelMaxM',
  'cartRollSpeedMps', 'cartRushSpeedMps', 'imageScaleMin', 'imageScaleMax',
  'beamHalfAngleRad', 'placeholderSlideReachM', 'fanRadiusM', 'fanDurationS',
  'fanCooldownS', 'snuffRadiusBaseM', 'ropeCount', 'ropeCutHoldS', 'ropeCutRadiusM',
  'litCandleRadiusM', 'shieldedCandleRadiusM', 'spectatorSpeedMps', 'fanReachM', 'nearMissRadiusM',
] as const;

function withField(name: string, value: unknown): Tuning {
  return { ...TUNING, [name]: value } as unknown as Tuning;
}

describe('TUNING starting values', () => {
  it('matches the design starting values', () => {
    expect(TUNING).toMatchObject({
      showLengthS: 300,
      roomWidthM: 16,
      roomDepthM: 12,
      puffDensity: 0.6,
      puffRadiusM: 2,
      smokeDecayPerS: 0.05,
      smokeSpreadPerS: 0.2,
      solidityThresholdBase: 0.5,
      cartTravelMaxM: 8,
      cartRollSpeedMps: 1,
      cartRushSpeedMps: 4,
      fanRadiusM: 2,
      fanDurationS: 3,
      fanCooldownS: 8,
      snuffRadiusBaseM: 0.6,
    });
  });

  it('defines tick length, beam half-angle, image scale mapping and slide reach', () => {
    for (const k of ['tickS', 'beamHalfAngleRad', 'imageScaleMin', 'imageScaleMax', 'placeholderSlideReachM'] as const) {
      expect(typeof TUNING[k]).toBe('number');
    }
  });

  it('is valid', () => {
    expect(() => validateTuning(TUNING)).not.toThrow();
  });
});

describe('validateTuning', () => {
  for (const name of POSITIVE_FIELDS) {
    describe(name, () => {
      const bad: [string, unknown][] = [
        ['missing', undefined],
        ['NaN', Number.NaN],
        ['non-numeric', '5'],
        ['zero', 0],
        ['negative', -1],
      ];
      for (const [label, value] of bad) {
        it(`rejects ${label}, naming the field`, () => {
          const t = { ...TUNING } as unknown as Record<string, unknown>;
          if (label === 'missing') delete t[name];
          else t[name] = value;
          expect(() => validateTuning(t as unknown as Tuning)).toThrow(`"${name}"`);
        });
      }
    });
  }

  it('rejects non-integer room sizes naming the field', () => {
    expect(() => validateTuning(withField('roomWidthM', 16.5))).toThrow('"roomWidthM"');
    expect(() => validateTuning(withField('roomDepthM', 11.5))).toThrow('"roomDepthM"');
  });

  it('rejects non-finite values in zero-allowed fields', () => {
    expect(() => validateTuning(withField('cartOriginXM', Number.NaN))).toThrow('"cartOriginXM"');
    expect(() => validateTuning(withField('beamAngleDefaultRad', undefined))).toThrow('"beamAngleDefaultRad"');
  });

  it('rejects malformed position lists naming the field', () => {
    expect(() => validateTuning(withField('ventPositions', [[1]]))).toThrow('"ventPositions"');
    expect(() => validateTuning(withField('spectatorStartPositions', 'x'))).toThrow(
      '"spectatorStartPositions"',
    );
  });

  it('has the new starting values and no candlePositions', () => {
    expect(TUNING).toMatchObject({
      ropeCount: 3,
      ropeCutHoldS: 4,
      ropeCutRadiusM: 1,
      litCandleRadiusM: 3,
      shieldedCandleRadiusM: 1,
      spectatorSpeedMps: 3,
      fanReachM: 4,
      nearMissRadiusM: 1,
      ropePositions: [[2.5, 9.5], [13.5, 9.5], [8.5, 6.5]],
      spectatorStartPositions: [[2.5, 1.5], [13.5, 1.5], [8.5, 4.5]],
    });
    expect('candlePositions' in TUNING).toBe(false);
  });

  it('rejects bad rope and spectator position lists naming the field', () => {
    expect(() => validateTuning({ ...TUNING, ropeCount: 2 })).toThrow('"ropePositions"');
    expect(() =>
      validateTuning({ ...TUNING, spectatorStartPositions: [[1, 1], [2, 2]] }),
    ).toThrow('"spectatorStartPositions"');
    expect(() =>
      validateTuning({ ...TUNING, ropePositions: [[1, 1], [2, 2], [99, 2]] }),
    ).toThrow('"ropePositions"');
    expect(() =>
      validateTuning({ ...TUNING, spectatorStartPositions: [[1, 1], [2, 2], [3, -1]] }),
    ).toThrow('"spectatorStartPositions"');
  });

  it('rejects imageScaleMax below imageScaleMin', () => {
    expect(() => validateTuning({ ...TUNING, imageScaleMin: 1, imageScaleMax: 0.9 })).toThrow('"imageScaleMax"');
  });

  it('rejects a threshold that exceeds 1 at maximum scale', () => {
    expect(() => validateTuning({ ...TUNING, solidityThresholdBase: 0.9 })).toThrow('"solidityThresholdBase"');
  });

  it('rejects unstable spread', () => {
    expect(() => validateTuning({ ...TUNING, smokeSpreadPerS: 6 })).toThrow('"smokeSpreadPerS"');
  });
});

describe('createState', () => {
  it('builds a 192-cell grid of zeros', () => {
    const s = createState(1);
    expect(s.grid).toHaveLength(192);
    expect(s.grid.every((d) => d === 0)).toBe(true);
  });

  it('sizes the grid from tuning', () => {
    const s = createState(1, {
      ...TUNING,
      roomWidthM: 4,
      roomDepthM: 3,
      spectatorStartPositions: [[1, 1], [2, 1], [3, 1]],
      ropePositions: [[1, 2], [2, 2], [3, 2]],
    });
    expect(s.grid).toHaveLength(12);
  });

  it('starts with lit candles at the tuned positions', () => {
    const s = createState(1);
    expect(s.candles.map((c) => [c.x, c.y])).toEqual(TUNING.spectatorStartPositions);
    expect(s.candles.every((c, i) => c.id === i && c.status === 'lit')).toBe(true);
  });

  it('throws naming the field for invalid tuning', () => {
    expect(() => createState(1, withField('puffRadiusM', 0))).toThrow('"puffRadiusM"');
  });

  it('survives a JSON round trip', () => {
    const s = createState(42);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
