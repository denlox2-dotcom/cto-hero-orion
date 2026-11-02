import { defineConfig } from '@playwright/test';
import { chromiumChannel, isolatedDatabasePath, testResultsPath } from './tests/helpers/playwright-config';

const artifacts = testResultsPath('hud-regression');
export default defineConfig({
  testDir: './tests/browser', testMatch: 'room-retry.spec.ts', timeout: 200000,
  workers: 1, outputDir: `${artifacts}/artifacts`,
  use: { baseURL: 'http://127.0.0.1:4207', channel: chromiumChannel,
    actionTimeout: 5000, viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { env: { LEADERBOARD_DB_PATH: isolatedDatabasePath(artifacts) },
    command: 'npm run dev -- --port 4207 --strictPort', url: 'http://127.0.0.1:4207', reuseExistingServer: false },
});
