import { defineConfig, devices } from '@playwright/test';

// Records a bot playing a whole night. Headed by default so it uses the real GPU; PLAYTEST_HEADLESS=1 for CI-like runs.
const headless = process.env.PLAYTEST_HEADLESS === '1';

export default defineConfig({
  testDir: 'e2e',
  testMatch: 'playtest.spec.ts',
  outputDir: 'playtests/raw',
  timeout: 15 * 60 * 1000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    headless,
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    launchOptions: {
      args: headless ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } }],
  webServer: { command: 'pnpm dev', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
});
