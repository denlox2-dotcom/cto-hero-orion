import { defineConfig } from '@playwright/test';
import { chromiumChannel, isolatedDatabasePath, testResultsPath } from './tests/helpers/playwright-config';

const artifacts = testResultsPath('production');
export default defineConfig({
  outputDir: `${artifacts}/artifacts`,
  testDir:'./tests/production',timeout:30000,workers:1,
  use:{baseURL:'http://127.0.0.1:4174',channel: chromiumChannel,viewport:{width:1280,height:720},
    screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:{env:{PORT:'4174',LEADERBOARD_DB_PATH: isolatedDatabasePath(artifacts)},command:'npm start',url:'http://127.0.0.1:4174',reuseExistingServer:false},
});
