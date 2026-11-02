import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve from this file so a checkout can live in any directory.
const resultsRoot = fileURLToPath(new URL('../../test-results/', import.meta.url));

export const testResultsPath = (...parts: string[]) => join(resultsRoot, ...parts);

export function makeTestDirectory(suite: string, prefix: string): string {
  const directory = testResultsPath(suite);
  mkdirSync(directory, { recursive: true });
  return mkdtempSync(join(directory, prefix));
}
