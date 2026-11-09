import { describe, expect, it } from 'vitest';
import { parseNumRuns } from './setup';

describe('parseNumRuns', () => {
  it('returns 100 when unset', () => {
    expect(parseNumRuns(undefined)).toBe(100);
  });

  it('returns 100 for an empty string', () => {
    expect(parseNumRuns('')).toBe(100);
  });

  it('parses a valid integer', () => {
    expect(parseNumRuns('250')).toBe(250);
  });

  it('returns 100 for 0 (below range)', () => {
    expect(parseNumRuns('0')).toBe(100);
  });

  it('returns 100 for 1000001 (above range)', () => {
    expect(parseNumRuns('1000001')).toBe(100);
  });

  it('returns 100 for trailing garbage', () => {
    expect(parseNumRuns('12abc')).toBe(100);
  });

  it('returns 100 for exponent notation', () => {
    expect(parseNumRuns('1e3')).toBe(100);
  });

  it('returns 100 for leading whitespace', () => {
    expect(parseNumRuns(' 5')).toBe(100);
  });

  it('returns 100 for a negative number', () => {
    expect(parseNumRuns('-3')).toBe(100);
  });
});
