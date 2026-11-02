import { defineConfig } from '@playwright/test';
import { chromiumChannel, isolatedDatabasePath, testResultsPath } from './tests/helpers/playwright-config';
const production = process.env.RETRY_TEST_MODE === 'production';
const artifacts = testResultsPath('room-retry', production ? 'production' : 'development');
const port = production ? 4199 : 4198;
export default defineConfig({
  testDir: production ? './tests/production' : './tests/browser', testMatch: 'room-retry.spec.ts',
  timeout: 280000, workers: 1,
  outputDir: `${artifacts}/artifacts`,
  use: { baseURL: `http://127.0.0.1:${port}`, channel: chromiumChannel, actionTimeout: 5000,
    viewport: { width: 1280, height: 720 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { env: { PORT: String(port), LEADERBOARD_DB_PATH: isolatedDatabasePath(artifacts) },
    command: production ? 'npm start' : `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`, reuseExistingServer: false },
});
