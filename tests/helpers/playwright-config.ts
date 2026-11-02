import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

// Set PLAYWRIGHT_CHROMIUM_CHANNEL=chromium to use Playwright's bundled browser.
// Leaving the channel unset for that value also works on machines without Chrome.
export const chromiumChannel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL === 'chromium'
  ? undefined
  : process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || 'chrome';

export { testResultsPath } from './test-paths';

// Keep each server isolated from earlier runs without deleting a database in use.
export const isolatedDatabasePath = (artifacts: string): string =>
  join(artifacts, 'db', `leaderboard-${randomUUID()}.sqlite`);
