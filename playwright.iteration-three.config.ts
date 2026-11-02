import { defineConfig } from '@playwright/test';
import { chromiumChannel, isolatedDatabasePath, testResultsPath } from './tests/helpers/playwright-config';

const artifacts = testResultsPath('iteration-three');
export default defineConfig({
  testDir: './tests/browser', testMatch: ['room-retry.spec.ts', 'passport.spec.ts', 'central-boss.spec.ts'],
  timeout: 240000, workers: 1, reporter: [['list'], ['json', { outputFile: `${artifacts}/browser-results.json` }]],
  outputDir: `${artifacts}/artifacts`,
  use: { baseURL: 'http://127.0.0.1:4314', channel: chromiumChannel, actionTimeout: 5000,
    viewport: { width: 1280, height: 720 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 4314 --strictPort', url: 'http://127.0.0.1:4314', reuseExistingServer: false,
    env: { LEADERBOARD_DB_PATH: isolatedDatabasePath(artifacts) },
  },
});
