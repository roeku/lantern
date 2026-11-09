import { expect, test } from '@playwright/test';

// Requirements 17.6, 18.2, 18.4: two pages on one Join_Link each see their own role bindings.
test('Showman and Spectator pages show their own bindings on the HUD', async ({ browser }) => {
  const context = await browser.newContext();
  const showmanPage = await context.newPage();
  const spectatorPage = await context.newPage();

  await showmanPage.goto('/');
  await showmanPage.getByTestId('start-create').click();
  await showmanPage.waitForURL(/\/r\/[A-Z2-9]{4}$/);
  const joinLink = showmanPage.url();

  await spectatorPage.goto(joinLink);
  await expect(spectatorPage.getByText('Waiting for the Showman to start.')).toBeVisible();

  const start = showmanPage.getByTestId('lobby-start');
  await expect(start).toBeVisible();
  await start.click();

  const showmanKeys = showmanPage.getByTestId('hud-keys');
  await expect(showmanKeys).toContainText('Roll cart forward');
  await expect(showmanKeys).toContainText('Puff Vent 1');
  await expect(showmanKeys).not.toContainText('Move up');
  await expect(showmanKeys).not.toContainText('Cut rope');

  const spectatorKeys = spectatorPage.getByTestId('hud-keys');
  await expect(spectatorKeys).toContainText('Move up');
  await expect(spectatorKeys).toContainText('Cut rope');
  await expect(spectatorKeys).not.toContainText('Roll cart forward');
  await expect(spectatorKeys).not.toContainText('Puff Vent 1');

  await context.close();
});
