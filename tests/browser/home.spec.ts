import { test, expect } from '@playwright/test';
import { registerPlayer } from '../helpers/registration';

const syntheticBoard = (difficulty = 'easy', untrustedName = false) => ({
  entries: Array.from({ length: 7 }, (_, i) => ({
    id: `sample-${difficulty}-${i}`, rank: i + 1,
    firstName: i === 0 && untrustedName ? 'Тест <img src=x onerror=alert(1)>' : `Тестовый СТО ${i + 1}`,
    company: 'Тестовая компания', rooms: 4 - Math.floor(i / 3), budget: 7000 - i * 500,
  })), current: null, total: 7,
});

test('welcome shows the new name, slogan, large start and exactly five safely rendered leaders', async ({ page }) => {
  await page.route('**/api/leaderboard?*', route => route.fulfill({ json: syntheticBoard('easy', true) }));
  await page.goto('/');
  await expect(page).toHaveTitle('CTO на страже инфраструктуры');
  await expect(page.getByRole('heading', { name: 'CTO на страже инфраструктуры', exact: true })).toBeVisible();
  await expect(page.getByText('Защити ЦОД и ИИ-инфраструктуру от серии угроз', { exact: true })).toBeVisible();
  const start = page.getByRole('button', { name: 'Начать игру', exact: true });
  await expect(start).toBeVisible();
  expect(await start.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(30);
  await expect(page.getByLabel('Фамилия', { exact: true })).toHaveCount(0);
  const preview = page.locator('.menu-leaderboard');
  await expect(preview.locator('tbody tr')).toHaveCount(5);
  await expect(preview).toContainText(syntheticBoard('easy', true).entries[0].firstName);
  await expect(preview.locator('tbody img')).toHaveCount(0);
  await expect(preview).not.toContainText('Тестовый СТО 6');
  await preview.getByRole('button', { name: 'Сложная', exact: true }).click();
  await expect(preview.getByRole('button', { name: 'Сложная', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await preview.getByRole('button', { name: 'Весь рейтинг', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Таблица лидеров' });
  await expect(dialog.locator('tbody tr')).toHaveCount(7);
  await expect(dialog.getByRole('button', { name: 'Сложная', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(start).toBeVisible();
});

test('welcome starts registration, keeps consent required, and returns from gameplay', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('form', { name: 'Контакты игрока' })).toBeVisible();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByLabel('Фамилия', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'На главный экран', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Начать игру', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Начать игру', exact: true }).click();
  await registerPlayer(page);
  await page.getByRole('button', { name: 'Начать смену', exact: true }).click();
  await expect(page.getByTestId('room-title')).toHaveText('Серверная');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'В меню', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Начать игру', exact: true })).toBeVisible();
  await expect(page.getByLabel('Фамилия', { exact: true })).toHaveCount(0);
});

test('preview reports an empty or unavailable leaderboard and can retry while start stays available', async ({ page }) => {
  let unavailable = false;
  await page.route('**/api/leaderboard?*', route => route.fulfill(unavailable
    ? { status: 503, json: { error: 'Недоступно' } }
    : { json: { entries: [], current: null, total: 0 } }));
  await page.goto('/');
  const preview = page.locator('.menu-leaderboard');
  await expect(preview.locator('.leaderboard-empty')).toContainText('нет результатов');
  unavailable = true;
  await preview.getByRole('button', { name: 'Обновить', exact: true }).click();
  await expect(preview.getByRole('status')).toContainText('Не удалось загрузить');
  await expect(page.getByRole('button', { name: 'Начать игру', exact: true })).toBeEnabled();
  unavailable = false;
  await preview.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(preview.getByRole('status')).toContainText('0');
  await expect(preview.locator('tbody tr')).toHaveCount(0);
});

test('the hero continuously reaches both sides and reverses without changing the run', async ({ page }) => {
  test.skip(process.env.HOME_TEST_MODE === 'production', 'Read-only simulation diagnostics are development-only.');
  await page.goto('/');
  const heights: number[] = [];
  const state = async () => {
    const value = await page.evaluate(() => (window as any).__uptime);
    if (value?.room?.y !== undefined) heights.push(value.room.y);
    return value;
  };
  await expect.poll(async () => (await state())?.room?.x, { timeout: 6000, intervals: [50, 100] }).toBeGreaterThan(875);
  await expect.poll(async () => (await state())?.room?.x, { timeout: 8000, intervals: [50, 100] }).toBeLessThan(120);
  await expect.poll(async () => (await state())?.room?.x, { timeout: 5000, intervals: [50, 100] }).toBeGreaterThan(250);
  const value = await state();
  expect(value.screen).toBe('menu');
  expect(value.run.budget).toBe(0);
  expect(value.run.results).toEqual([]);
  expect(value.room.sla).toBe(100);
  expect(value.room.remaining).toBe(40);
  expect(Math.min(...heights)).toBeGreaterThan(470);
});

for (const theme of ['k2', 'aihub']) {
  test(`${theme} keeps title, start, all five rows and the visible scene inside the screen`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/leaderboard?*', route => route.fulfill({ json: syntheticBoard() }));
    for (const size of [{ width: 960, height: 720 }, { width: 1280, height: 720 }, { width: 1440, height: 1000 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(size);
      await page.goto(`/?theme=${theme}`);
      await expect(page.locator('.menu-leaderboard tbody tr')).toHaveCount(5);
      const layout = await page.locator('.menu-leaderboard .leaderboard-scroll').evaluate(node => ({
        scroll: node.scrollHeight, available: node.clientHeight,
        table: node.querySelector('table')!.getBoundingClientRect().height,
        rows: [...node.querySelectorAll('tbody tr')].map(row => row.getBoundingClientRect().height),
      }));
      expect(layout.scroll <= layout.available + 1, `all five rows must fit without scrolling: ${JSON.stringify(layout)}`).toBe(true);
      const stage = (await page.locator('.game-stage').boundingBox())!;
      for (const selector of ['.game-title', '.game-subtitle', '.welcome-start', '.menu-leaderboard', '.menu-leaderboard tbody tr:last-child']) {
        const box = (await page.locator(selector).boundingBox())!;
        expect(box.x, selector).toBeGreaterThanOrEqual(stage.x);
        expect(box.y, selector).toBeGreaterThanOrEqual(stage.y);
        expect(box.x + box.width, selector).toBeLessThanOrEqual(stage.x + stage.width + 1);
        expect(box.y + box.height, selector).toBeLessThanOrEqual(stage.y + stage.height * 0.85);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath('screenshots', `home-${theme}-${size.width}${process.env.HOME_TEST_MODE === 'production' ? '-production' : ''}.png`), fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}
