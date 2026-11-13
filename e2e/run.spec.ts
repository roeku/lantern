import { expect, test } from '@playwright/test';
import { botMain } from './bot';

// Headless Chromium will not grant pointer lock, so the test fakes the lock state the game listens to.
// The bot plays through the real keyboard path and records, rewinds and waits on its own echo.
/* eslint-disable @typescript-eslint/no-explicit-any -- test reaches into dev-only state */

test('chambers 1 and 2: record, rewind, let the echo hold the plate, walk through the gate', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?seed=1234');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  // The opening view: the plate, its wire and the gate in one look, and the first prompt
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/19-chamber-1-start.png' });
  await page.evaluate(botMain);

  // Chamber 1: while the bot is recording, the HUD must say so
  await expect
    .poll(() => page.evaluate(() => (window as any).__game.curr.rec.active as boolean), { timeout: 20_000 })
    .toBe(true);
  await page.screenshot({ path: 'test-results/20-recording.png' });
  await expect
    .poll(() => page.evaluate(() => (window as any).__game.curr.ghost !== null), { timeout: 30_000 })
    .toBe(true);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/21-echo-playing.png' });

  // Through the first gate, then the second
  await expect
    .poll(() => page.evaluate(() => (window as any).__game.curr.chamber as number), { timeout: 60_000 })
    .toBe(1);
  await expect
    .poll(() => page.evaluate(() => (window as any).__game.curr.chamber as number), { timeout: 90_000 })
    .toBe(2);
  const end = await page.evaluate(() => {
    const c = (window as any).__game.curr;
    return { tapes: c.tapes as boolean[], caught: c.caughtCount as number };
  });
  await page.screenshot({ path: 'test-results/22-chamber-3.png' });
  expect(end.tapes).toEqual([true, true, false]);
  expect(end.caught).toBe(0);
  expect(errors).toEqual([]);
});
