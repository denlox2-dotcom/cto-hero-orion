import { defineConfig } from '@playwright/test';
import { chromiumChannel, isolatedDatabasePath, testResultsPath } from './tests/helpers/playwright-config';

const artifacts = testResultsPath('room-regression');
export default defineConfig({
  testDir: './tests/browser', timeout: 240000, workers: 1, outputDir: `${artifacts}/artifacts`,
  use: { baseURL: 'http://127.0.0.1:4200', channel: chromiumChannel, actionTimeout: 5000, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { env: { LEADERBOARD_DB_PATH: isolatedDatabasePath(artifacts) }, command: 'npm run dev -- --port 4200 --strictPort', url: 'http://127.0.0.1:4200', reuseExistingServer: false },
});
