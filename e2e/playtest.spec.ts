import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { botMain } from './bot';
import type { BotEvent } from './bot';

/* eslint-disable @typescript-eslint/no-explicit-any -- reads dev-only globals */

// pnpm playtest                 records a whole night with a bot
// SEED=7 pnpm playtest          the same with a fixed seed
const finale = 'night';
const seed = Number(process.env.SEED ?? 1234);

test(`a bot plays a whole night (seed ${seed})`, async ({ page }, testInfo) => {
  test.setTimeout(15 * 60 * 1000);
  await page.addInitScript((f) => {
    localStorage.setItem('rewind-night-settings', JSON.stringify({ sensitivity: 1, lensToggle: false, reducedEffects: false, showFps: true, quality: f }));
  }, 'medium');
  await page.goto(`/?seed=${seed}`);
  await page.waitForTimeout(1500); // a second on the title

  // Fake the pointer lock the game listens to, then let the bot take over
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  await page.evaluate(botMain);

  const t0 = Date.now();
  let status = 'timeout';
  // The headed browser has closed itself twice after about 4.5 minutes of recording, so a run stops at 4.
  const limitMs = 4 * 60 * 1000;
  while (Date.now() - t0 < limitMs) {
    await page.waitForTimeout(1000);
    const s = await page.evaluate(() => {
      const g = (window as any).__game;
      const mem = (performance as any).memory?.usedJSHeapSize ?? 0;
      return {
        won: g.curr.won as boolean,
        tick: g.curr.tick as number,
        caught: g.curr.caughtCount as number,
        chamber: g.curr.chamber as number,
        heapMb: Math.round(mem / 1e6),
        log: ((window as any).__botLog as BotEvent[]).slice(-3),
      };
    });
    // Live progress, so a stuck or crashing run still says where it was
    mkdirSync('playtests', { recursive: true });
    writeFileSync(`playtests/${finale}-seed${seed}.progress.json`, JSON.stringify(s, null, 2));
    if (s.won) {
      status = 'won';
      break;
    }
  }
  await page.waitForTimeout(6000); // let the end card show

  const log = (await page.evaluate(() => (window as any).__botLog)) as BotEvent[];
  const end = await page.evaluate(() => {
    const g = (window as any).__game;
    return { tick: g.curr.tick as number, caught: g.curr.caughtCount as number, tapes: g.curr.tapes as boolean[], won: g.curr.won as boolean };
  });
  mkdirSync('playtests', { recursive: true });
  writeFileSync(`playtests/${finale}-seed${seed}.log.json`, JSON.stringify({ status, realSec: (Date.now() - t0) / 1000, end, log }, null, 2));
  await page.screenshot({ path: `playtests/${finale}-seed${seed}-end.png` });
  console.log(`status=${status} gameSec=${(end.tick / 60).toFixed(0)} caught=${end.caught} tapes=${end.tapes.filter(Boolean).length}`);
  for (const e of log) console.log(`${String(e.t).padStart(6)}s  ${e.msg}`);

  // Playwright writes the video on close; point at it afterwards
  await page.close();
  const video = page.video();
  if (video) copyFileSync(await video.path(), `playtests/${finale}-seed${seed}.webm`);
  void testInfo;
});
