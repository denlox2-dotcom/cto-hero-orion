import { test, expect, type Page } from '@playwright/test';
import { registerPlayer } from '../helpers/registration';
import { activeResultMilliseconds, observeResult } from '../helpers/presentation';
import { completeBoothRoute, completeKeyboardRoute, moveTo, snapshot, spray, stomp } from './keyboard-route';

const shots = () => test.info().outputPath('screenshots');
const phase = (page: Page, value: string) => page.waitForFunction(value => (window as any).__uptime?.room.pak.phase === value, value, { timeout: 7000 });
const battleState = (state: any) => ({
  x: state.room.x, y: state.room.y, remaining: state.room.remaining, energy: state.room.energy,
  sla: state.room.sla, ogn: state.room.ogn, pro: state.room.pro, gpu: state.room.gpu,
  actors: state.room.actors, budget: state.run.budget,
});
async function fixture(page: Page, difficulty = 'easy', fullPack = true) {
  await page.goto('/tests/browser/presentation.html');
  await page.waitForFunction(() => typeof (window as any).startPresentationCase === 'function');
  await page.evaluate(options => (window as any).startPresentationCase(options), { difficulty, fullPack });
  await page.waitForFunction(() => (window as any).__uptime?.room.status === 'playing');
  await page.keyboard.down('KeyE');
}

for (const difficulty of ['easy', 'standard', 'hardcore']) {
  test(`${difficulty} PAK calls, emerges from a cloud and holds one victory without spending battle resources`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await fixture(page, difficulty); await phase(page, 'warning');
    const warning = await snapshot(page);
    expect(warning.visuals['pak-call']).toMatchObject({ visible: true, text: 'ПАК-AI, НА ПОМОЩЬ!' });
    expect(warning.physicsPaused).toBe(true);
    await page.screenshot({ path: `${shots()}/${difficulty}-pak-call.png` });
    await phase(page, 'falling');
    const falling = await snapshot(page);
    expect(falling.visuals['pak-cloud']).toMatchObject({ visible: true });
    expect(falling.visuals['pak-assist']).toMatchObject({ visible: true });
    expect(battleState(falling)).toEqual(battleState(warning));
    await page.screenshot({ path: `${shots()}/${difficulty}-pak-cloud.png` });
    await page.waitForTimeout(450);
    const inFlight = await snapshot(page);
    expect(inFlight.room.pak.phase).toBe('falling');
    expect(inFlight.room.pak.y).toBeGreaterThan(falling.room.pak.y);
    expect(battleState(inFlight)).toEqual(battleState(warning));
    await page.screenshot({ path: `${shots()}/${difficulty}-pak-fall.png` });
    await phase(page, 'impact'); await page.keyboard.up('KeyE');
    const impact = await snapshot(page);
    expect(impact.screen).toBe('playing');
    expect(impact.room.status).toBe('ended');
    expect(impact.run).toMatchObject({ budget: 100, pakAssistUsed: true, tokens: ['server', 'office', 'perimeter', 'production'] });
    expect(impact.run.results).toHaveLength(1);
    expect(impact.visuals['pak-assist']).toMatchObject({ visible: true, alpha: 1 });
    await page.screenshot({ path: `${shots()}/${difficulty}-pak-victory.png` });
    await page.waitForTimeout(1400);
    expect((await snapshot(page)).endCount).toBe(0);
    await page.waitForFunction(() => (window as any).__uptime.endCount === 1);
    const ended = await snapshot(page);
    const at = (name: string) => ended.transitions.find((step: any) => step.phase === name).at;
    expect(at('falling') - at('warning')).toBeGreaterThanOrEqual(750);
    expect(at('impact') - at('falling')).toBeGreaterThanOrEqual(1150);
    expect(at('delivered') - at('impact')).toBeGreaterThanOrEqual(1900);
    await test.info().attach('pak-timing', { body: JSON.stringify(ended.transitions, null, 2), contentType: 'application/json' });
    await page.waitForTimeout(250);
    expect((await snapshot(page)).run).toEqual(ended.run);
    expect((await snapshot(page)).endCount).toBe(1);
    expect(errors).toEqual([]);
  });
}

test('pause freezes the call, fall and victory; resume keeps their physics frozen', async ({ page }) => {
  await fixture(page); await phase(page, 'warning');
  for (const value of ['warning', 'falling', 'impact']) {
    await phase(page, value); await page.getByRole('button', { name: 'Пауза', exact: true }).click();
    const frozen = await snapshot(page);
    await page.waitForTimeout(650);
    expect(await snapshot(page)).toEqual(frozen);
    await page.getByRole('button', { name: 'Пауза', exact: true }).click();
    expect((await snapshot(page)).physicsPaused).toBe(true);
  }
  await page.waitForFunction(() => (window as any).__uptime.endCount === 1);
  expect((await snapshot(page)).run.results).toHaveLength(1);
});

for (const difficulty of ['easy', 'standard', 'hardcore']) {
  test(`${difficulty} victory without a complete PAK also holds for two seconds`, async ({ page }) => {
    await fixture(page, difficulty, false);
    await page.waitForFunction(() => (window as any).__uptime?.room.status === 'ended');
    await page.keyboard.up('KeyE');
    const won = await snapshot(page), seen = Date.now();
    expect(won.room.pak.phase).toBe('idle');
    expect(won.visuals['pak-assist']).toMatchObject({ visible: false });
    expect(won.run).toMatchObject({ pakAssistUsed: false, budget: 100, tokens: ['production'] });
    expect(won.endCount).toBe(0);
    await page.waitForTimeout(1300); expect((await snapshot(page)).endCount).toBe(0);
    await page.waitForFunction(() => (window as any).__uptime.endCount === 1);
    expect(Date.now() - seen).toBeGreaterThanOrEqual(1850);
    expect((await snapshot(page)).run).toEqual(won.run);
  });
}

for (const value of ['warning', 'falling', 'impact']) {
  test(`new attempt during ${value} clears the old PAK sequence`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await fixture(page); await phase(page, value); await page.keyboard.up('KeyE');
    await page.getByRole('button', { name: 'Новая попытка' }).click();
    await page.waitForFunction(() => (window as any).__uptime?.starts === 2 && (window as any).__uptime.room.status === 'playing');
    const fresh = await snapshot(page);
    expect(fresh.room.pak.phase).toBe('idle');
    expect(fresh.visuals['pak-assist']).toMatchObject({ visible: false });
    expect(fresh.visuals['pak-call']).toMatchObject({ visible: false });
    expect(fresh.visuals['pak-cloud']).toMatchObject({ visible: false });
    expect(fresh.run).toMatchObject({ pakAssistUsed: false, budget: 0, results: [] });
    expect(fresh.physicsPaused).toBe(false);
    await page.waitForTimeout(2300);
    expect((await snapshot(page)).endCount).toBe(0);
    await page.keyboard.down('KeyE'); await phase(page, 'impact'); await page.keyboard.up('KeyE');
    await page.waitForFunction(() => (window as any).__uptime.endCount === 1);
    expect((await snapshot(page)).run.results).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}

for (const theme of ['k2', 'aihub']) {
  test(`${theme} room reward stays readable for five active seconds and its reveal pauses`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/?theme=${theme}`); await registerPlayer(page);
    await observeResult(page);
    await page.getByRole('button', { name: 'Начать смену' }).click();
    await page.waitForFunction(() => (window as any).__uptime?.room.status === 'playing');
    await moveTo(page, 122); await spray(page); await stomp(page, 's-i1');
    await expect(page.locator('[data-countdown]')).toHaveText('5');
    const reward = await snapshot(page);
    await expect(page.getByRole('heading', { name: 'Модуль получен', exact: true })).toBeVisible();
    await expect(page.locator('.result-description')).toHaveText('KageCore — в вашей сборке ПАК.');
    await expect(page.locator('.result-amulet')).toHaveCSS('animation-duration', '1.2s');
    await page.keyboard.press('Escape');
    await expect(page.locator('.result-amulet')).toHaveCSS('animation-play-state', 'paused');
    const frozen = await snapshot(page), timer = await page.locator('[data-countdown]').textContent();
    await page.waitForTimeout(650);
    expect(await snapshot(page)).toEqual(frozen);
    expect(await page.locator('[data-countdown]').textContent()).toBe(timer);
    await page.keyboard.press('Escape');
    await expect(page.locator('.result-amulet')).toHaveCSS('animation-play-state', 'running');
    await page.waitForTimeout(950);
    await page.screenshot({ path: `${shots()}/${theme}-room-reward.png`, fullPage: true });
    if (theme === 'aihub') {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(page.locator('.result-amulet')).toHaveCSS('animation-name', 'none');
    }
    await page.waitForTimeout(2000);
    expect((await snapshot(page)).screen).toBe('result');
    expect((await snapshot(page)).room.remaining).toBe(reward.room.remaining);
    expect((await snapshot(page)).run).toEqual(reward.run);
    await expect(page.getByTestId('room-title')).toHaveText('Опенспейс', { timeout: 3000 });
    const duration = await activeResultMilliseconds(page);
    expect(duration).toBeGreaterThanOrEqual(4950);
    expect(duration).toBeLessThan(5300);
    await test.info().attach('result-timing', { body: JSON.stringify({ durationMs: duration, expectedSeconds: 5 }), contentType: 'application/json' });
    expect((await snapshot(page)).run.results).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}

for (const difficulty of ['easy', 'standard', 'hardcore'] as const) {
  test(`${difficulty} real keyboard route completes all four rooms after presentation changes`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(difficulty === 'hardcore' ? '/?theme=aihub' : '/');
    const directory = `${shots()}/route-${difficulty}`;
    if (difficulty === 'easy') await completeBoothRoute(page, directory);
    else await completeKeyboardRoute(page, difficulty, directory);
    const final = await snapshot(page);
    expect(final.run.tokens).toHaveLength(4);
    expect(final.run.results).toHaveLength(4);
    expect(final.run.pakAssistUsed).toBe(true);
    await page.screenshot({ path: `${directory}/victory.png` });
    expect(errors).toEqual([]);
  });
}
