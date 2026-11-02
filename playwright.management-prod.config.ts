import { defineConfig } from '@playwright/test';
import { chromiumChannel, isolatedDatabasePath, testResultsPath } from './tests/helpers/playwright-config';

const artifacts = testResultsPath('management-prod');
export default defineConfig({
  outputDir: `${artifacts}/artifacts`,
  testDir: './tests/browser', testMatch: 'leaderboard-management.spec.ts', timeout: 30000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4308', channel: chromiumChannel, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node server/start.mjs', url: 'http://127.0.0.1:4308', reuseExistingServer: false,
    env: { PORT: '4308', HOST: '127.0.0.1', LEADERBOARD_DB_PATH: isolatedDatabasePath(artifacts), LEADERBOARD_ADMIN_TOKEN: 'synthetic-browser-admin-key-1234567890' } },
});
