import { defineConfig } from '@playwright/test';
import { chromiumChannel, isolatedDatabasePath, testResultsPath } from './tests/helpers/playwright-config';

const artifacts = testResultsPath('boss');


export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['central-boss.spec.ts', 'pak.spec.ts', 'presentation.spec.ts'],
  grep: /keyboard run assembles PAK|victory without a complete PAK|central final boss is reachable/,
  timeout: 180000, workers: 1,
  outputDir: `${artifacts}/artifacts`,
  use: {
    baseURL: 'http://127.0.0.1:4197', channel: chromiumChannel, actionTimeout: 5000,
    viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: {
    env: { PORT: '4197', LEADERBOARD_DB_PATH: isolatedDatabasePath(artifacts) },
    command: 'npm run dev -- --port 4197 --strictPort',
    url: 'http://127.0.0.1:4197', reuseExistingServer: false,
  },
});
