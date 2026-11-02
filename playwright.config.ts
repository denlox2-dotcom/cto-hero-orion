import { defineConfig } from '@playwright/test';
import { chromiumChannel, isolatedDatabasePath, testResultsPath } from './tests/helpers/playwright-config';

const artifacts = testResultsPath('browser');
export default defineConfig({
  outputDir: `${artifacts}/artifacts`,
  testDir:'./tests/browser', timeout:240000, workers:1,
  use:{ baseURL:'http://127.0.0.1:4175', channel: chromiumChannel, actionTimeout:5000, viewport:{width:1440,height:1000},
    screenshot:'only-on-failure', trace:'retain-on-failure' },
  webServer:{env:{LEADERBOARD_DB_PATH: isolatedDatabasePath(artifacts)},command:'npm run dev -- --port 4175 --strictPort',url:'http://127.0.0.1:4175',reuseExistingServer:false},
});
