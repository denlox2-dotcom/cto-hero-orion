import { test, expect } from '@playwright/test';
import { openRegistration } from '../helpers/registration';

for (const theme of ['k2', 'aihub']) {
  for (const [choice, phone, telegram] of [
    ['phone only', '+7 (900) 000-00-00', ''],
    ['Telegram only', '', 'https://t.me/test_player'],
    ['both contacts', '+7 (900) 000-00-00', '@test_player'],
  ]) {
    test(`${theme} starts with ${choice} and preserves the contacts when edited`, async ({ page }) => {
      await page.goto(`/?theme=${theme}`); await openRegistration(page);
      await page.getByLabel('Фамилия', { exact: true }).fill('Тестовый');
      await page.getByLabel('Имя', { exact: true }).fill('Участник');
      await page.getByLabel('Компания', { exact: true }).fill('Тестовая компания');
      const phoneInput = page.getByLabel('Телефон', { exact: true });
      const telegramInput = page.getByLabel('Телеграм', { exact: true });
      await expect(phoneInput).toHaveAttribute('type', 'tel');
      await expect(phoneInput).not.toHaveAttribute('required');
      await expect(telegramInput).not.toHaveAttribute('required');
      await phoneInput.fill(phone); await telegramInput.fill(telegram);
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Начать смену', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Изменить контакты', exact: true }).click();
      await expect(phoneInput).toHaveValue(phone ? '+79000000000' : '');
      await expect(telegramInput).toHaveValue(telegram ? '@test_player' : '');
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      await page.getByRole('button', { name: 'Начать смену', exact: true }).click();
      await expect(page.getByTestId('room-title')).toHaveText('Серверная');
    });
  }
}

test('empty contacts block Enter, and an invalid filled optional field is explained', async ({ page }) => {
  await page.goto('/'); await openRegistration(page);
  await page.getByLabel('Фамилия', { exact: true }).fill('Тестовый');
  await page.getByLabel('Имя', { exact: true }).fill('Участник');
  await page.getByLabel('Компания', { exact: true }).fill('Тестовая компания');
  await page.getByRole('checkbox').check();
  await page.getByLabel('Телеграм', { exact: true }).press('Enter');
  await expect(page.getByRole('alert')).toContainText('достаточно одного контакта');
  await expect(page.getByRole('button', { name: 'Начать смену', exact: true })).toHaveCount(0);
  await page.getByLabel('Телеграм', { exact: true }).fill('@test_player');
  await page.getByLabel('Телефон', { exact: true }).fill('123');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByLabel('Телефон', { exact: true })).toBeFocused();
  await expect(page.getByRole('alert')).toContainText('телефон с кодом страны');
  await page.getByLabel('Телефон', { exact: true }).fill('');
  await page.getByLabel('Телеграм', { exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Начать смену', exact: true })).toBeVisible();
});

test('phone and Telegram reject unsupported input without mixing their drafts', async ({ page }) => {
  await page.goto('/'); await openRegistration(page);
  const phone = page.getByLabel('Телефон', { exact: true });
  const telegram = page.getByLabel('Телеграм', { exact: true });
  await phone.fill('+79000000000'); await telegram.fill('@test_player');
  await phone.fill('@invalid_phone');
  await expect(phone).toHaveValue('+79000000000');
  await expect(telegram).toHaveValue('@test_player');
  await expect(page.getByRole('alert')).toContainText('Для телефона');
  await telegram.fill('@test_игрок');
  await expect(telegram).toHaveValue('@test_player');
  await expect(phone).toHaveValue('+79000000000');
  await expect(page.getByRole('alert')).toContainText('Для Telegram');
});

test('the final screen submits both normalized contacts to the real API and keeps them private', async ({ page, request }) => {
  await page.goto('/');
  // Public GameUI component with synthetic run results, exercising real serialization and server save.
  await page.evaluate(async () => {
    const { GameUI } = await import('/src/ui/GameUI.ts');
    const { createRun } = await import('/src/core/rules.ts');
    const root = document.createElement('div'); root.id = 'contact-fixture';
    document.body.replaceChildren(root);
    const noop = () => {};
    const ui = new GameUI(root, { start: noop, resume: noop, retryRoom: noop, restart: noop, menu: () => ui.showMenu(), leaderboard: () => ui.openLeaderboard(), sound: noop, fullscreen: noop });
    (window as any).__finishContactFixture = () => {
      const run = createRun('easy');
      run.results = ['server', 'office', 'perimeter', 'production'].map(id => ({ id, reason: 'timeout', completed: 0, total: 1, remaining: 0, budget: 0 }));
      ui.showFinal(run, crypto.randomUUID());
    };
  });
  await openRegistration(page);
  await page.getByLabel('Фамилия', { exact: true }).fill('Тестовый');
  await page.getByLabel('Имя', { exact: true }).fill('Участник');
  await page.getByLabel('Компания', { exact: true }).fill('Тестовая компания');
  await page.getByLabel('Телефон', { exact: true }).fill('+7 (900) 000-00-00');
  await page.getByLabel('Телеграм', { exact: true }).fill('https://t.me/test_contact_pair');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  const submission = page.waitForRequest(request => request.url().endsWith('/api/runs') && request.method() === 'POST');
  await page.evaluate(() => (window as any).__finishContactFixture());
  const payload = (await submission).postDataJSON();
  expect(payload.player).toMatchObject({ phone: '+79000000000', telegram: '@test_contact_pair' });
  await expect(page.locator('.passport-save-status')).toContainText('Результат сохранён');
  await expect(page.locator('.passport')).not.toContainText('79000000000');
  await expect(page.locator('.passport')).not.toContainText('test_contact_pair');
  const board = await (await request.get(`/api/leaderboard?difficulty=easy&current=${payload.id}`)).json();
  expect(board.current).toMatchObject({ id: payload.id, firstName: 'Участник' });
  expect(JSON.stringify(board)).not.toMatch(/phone|telegram|contact|79000000000|test_contact_pair/);
  await page.getByRole('button', { name: 'В меню', exact: true }).click();
  await openRegistration(page);
  await expect(page.getByLabel('Телефон', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Телеграм', { exact: true })).toHaveValue('');
});
