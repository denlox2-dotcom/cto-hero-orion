import { test, expect } from '@playwright/test';
import { completeKeyboardRoute, snapshot } from './keyboard-route';

const shots = () => test.info().outputPath('screenshots');

for (const difficulty of ['standard', 'hardcore'] as const) {
  test(`${difficulty} central final boss is reachable through all four rooms with normal keyboard input`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const theme = difficulty === 'hardcore' ? 'aihub' : 'k2';
    await page.goto(`/?theme=${theme}`);
    await completeKeyboardRoute(page, difficulty, `${shots()}/route-${difficulty}`);
    const state = await snapshot(page);
    expect(state.room.actors.find((actor: any) => actor.kind === 'boss').x).toBe(480);
    expect(state.room.pak).toMatchObject({ x: 480, y: 508, phase: 'impact' });
    expect(state.run.results.map((result: any) => result.reason)).toEqual(Array(4).fill('success'));
    await expect(page.locator('.passport-badge[data-earned="true"][data-closed="true"]')).toHaveCount(4);
    await expect(page.locator('.room-journey')).not.toBeVisible();
    await page.screenshot({ path: `${shots()}/${difficulty}-real-passport.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
