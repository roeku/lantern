import { expect, test } from '@playwright/test';

// Headless Chromium will not grant pointer lock, so the test fakes the lock state the game listens to.
// The game exposes itself as window.__game in dev builds only; the test reaches private fields on purpose.
/* eslint-disable @typescript-eslint/no-explicit-any -- test reaches into dev-only private state */

test('title, lens down, lens up on the Thing, rush; no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/01-title.png' });

  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true });
    document.dispatchEvent(new Event('pointerlockchange'));
    const g = (window as any).__game;
    g.input.yawRad = -Math.PI / 2; // face +x down the top corridor of chamber 3
    g.curr = { ...g.curr, chamber: 2, player: { ...g.curr.player, pos: { x: 24.5, y: 2.5 } } };
    g.curr = { ...g.curr, thing: { ...g.curr.thing, pos: { x: 30.5, y: 2.5 }, mode: 'wander', targetCell: { cx: 30, cy: 2 } } };
    g.prev = g.curr;
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/02-play-lens-down.png' });

  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(450);
  await page.screenshot({ path: 'test-results/03-lens-up.png' });

  // Keep looking, pinning the Thing in the aisle until the meter fills and it rushes
  let mode = 'wander';
  for (let i = 0; i < 100 && mode !== 'rush'; i++) {
    mode = await page.evaluate(() => {
      const g = (window as any).__game;
      if (g.curr.thing.mode !== 'rush') g.curr = { ...g.curr, thing: { ...g.curr.thing, pos: { x: 29.2, y: 2.5 } } };
      return g.curr.thing.mode as string;
    });
    await page.waitForTimeout(100);
  }
  await page.screenshot({ path: 'test-results/04-rush.png' });
  await page.mouse.up({ button: 'right' });

  expect(mode).toBe('rush');
  expect(errors).toEqual([]);
});
