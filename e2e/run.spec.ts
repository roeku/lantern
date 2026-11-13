import { expect, test } from '@playwright/test';
import { botMain } from './bot';

// Headless Chromium will not grant pointer lock, so the test fakes the lock state the game listens to.
// A bot plays the whole night through real key events: all five chambers, the finale, the end card.
/* eslint-disable @typescript-eslint/no-explicit-any -- test reaches into dev-only state */

test('the whole night: five chambers, the tape-self at the VCR, the door, the end card', async ({ page }) => {
  test.setTimeout(8 * 60 * 1000);
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

  const state = () =>
    page.evaluate(() => {
      const g = (window as any).__game;
      const c = g.curr;
      return { chamber: c.chamber as number, caught: c.caughtCount as number, won: c.won as boolean, tapes: c.tapes as boolean[], sec: Math.round(c.tick / 60) };
    });

  // Recording shows on the HUD, then each gate in turn
  await expect.poll(() => page.evaluate(() => (window as any).__game.curr.rec.active as boolean), { timeout: 30_000 }).toBe(true);
  await page.screenshot({ path: 'test-results/20-recording.png' });
  for (const chamber of [1, 2, 3, 4]) {
    await expect.poll(async () => (await state()).chamber, { timeout: 150_000, message: `reaching chamber ${chamber + 1}` }).toBeGreaterThanOrEqual(chamber);
    await page.screenshot({ path: `test-results/2${chamber}-chamber-${chamber + 1}.png` });
  }
  try {
    await expect.poll(async () => (await state()).won, { timeout: 150_000, message: 'winning' }).toBe(true);
  } catch (e) {
    // Say where the bot got to, so a failure is a diagnosis and not a shrug
    const log = (await page.evaluate(() => (window as any).__botLog)) as Array<{ t: number; msg: string }>;
    const g = await page.evaluate(() => {
      const c = (window as any).__game.curr;
      return { chamber: c.chamber, pos: c.player.pos, thing: c.thing.mode, ghost: !!c.ghost, rec: c.rec.active, vcr: Math.round(c.vcrHoldTicks / 60), exitOpen: c.exitOpen, caught: c.caughtCount };
    });
    console.log('STUCK', JSON.stringify(g), JSON.stringify(log.slice(-14)));
    await page.screenshot({ path: 'test-results/99-stuck.png' });
    throw e;
  }
  await page.waitForTimeout(11_000);
  await page.screenshot({ path: 'test-results/30-end-card.png' });
  const end = await state();
  console.log(JSON.stringify({ ...end, log: await page.evaluate(() => ((window as any).__botLog as Array<{ t: number; msg: string }>).filter((e) => /CAUGHT|ate|plays|RUSH|tape played/i.test(e.msg))) }));
  expect(end.tapes).toEqual([true, true, true]);
  expect(errors).toEqual([]);
});
