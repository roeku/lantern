import { describe, expect, it } from 'vitest';
import { isValidCodeShape, normaliseCode } from '../../src/client/ui/start-screen';
import { generateRoomCode } from '../../src/net/room-code';

describe('start screen code checks', () => {
  it('accepts codes with digits, as the server generates them', () => {
    expect(isValidCodeShape('AB2C')).toBe(true);
    expect(isValidCodeShape(normaliseCode(' ul9q '))).toBe(true);
  });

  it('accepts every code the server generator can produce', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(isValidCodeShape(generateRoomCode(() => r))).toBe(true);
    }
  });

  it('rejects wrong lengths and symbols', () => {
    expect(isValidCodeShape('ABC')).toBe(false);
    expect(isValidCodeShape('ABCDE')).toBe(false);
    expect(isValidCodeShape('AB-C')).toBe(false);
  });
});
