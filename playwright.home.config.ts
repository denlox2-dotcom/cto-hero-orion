import { defineConfig } from '@playwright/test';
import { chromiumChannel, isolatedDatabasePath, testResultsPath } from './tests/helpers/playwright-config';

const production = process.env.HOME_TEST_MODE === 'production';
const artifacts = testResultsPath('home', production ? 'production' : 'development');
const port = production ? 4192 : 4191;

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'home.spec.ts',
  timeout: 35000,
  expect: { timeout: 4500 },
  workers: 1,
  outputDir: `${artifacts}/artifacts`,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: chromiumChannel, viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: {
    env: { PORT: String(port), LEADERBOARD_DB_PATH: isolatedDatabasePath(artifacts) },
    command: production ? 'npm start' : `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`, reuseExistingServer: false,
  },
});
