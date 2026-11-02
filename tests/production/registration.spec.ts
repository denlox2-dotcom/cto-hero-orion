import { openRegistration } from '../helpers/registration';
import { test, expect } from '@playwright/test';

for (const theme of ['k2', 'aihub']) {
  for (const [choice, telegram] of [['phone only', ''], ['both contacts', '@test_player']]) {
    test(`built ${theme} starts with ${choice}`, async ({ page }) => {
      await page.goto(`/?theme=${theme}`); await openRegistration(page);
      await page.getByLabel('Фамилия', { exact: true }).fill('Тестовый');
      await page.getByLabel('Имя', { exact: true }).fill('Участник');
      await page.getByLabel('Компания', { exact: true }).fill('Тестовая компания');
      await page.getByLabel('Телефон', { exact: true }).fill('+7 (900) 000-00-00');
      await page.getByLabel('Телеграм', { exact: true }).fill(telegram);
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      await page.getByRole('button', { name: 'Начать смену', exact: true }).click();
      await expect(page.getByTestId('room-title')).toHaveText('Серверная');
    });
  }
  test(`built ${theme} registration validates contacts and consent before gameplay`, async ({ page, baseURL }) => {
    const errors: string[] = [];
    const failures: string[] = [];
    const external: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failures.push(request.url()));
    page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    await page.route('**/*', route => {
      const url = route.request().url();
      if (new URL(url).origin === new URL(baseURL!).origin) return route.continue();
      external.push(url);
      return route.abort();
    });
    await page.goto(`/?theme=${theme}`); await openRegistration(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByText('Тестовая версия: используйте только вымышленные данные.', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Политикой обработки персональных данных', exact: true })).toHaveAttribute('href', 'https://k2.tech/personal-data-processing-policy/');
    await expect(page.getByRole('link', { name: 'согласие на обработку моих персональных данных', exact: true })).toHaveAttribute('href', 'https://k2.tech/consent-to-personal-data-processing/');
    await page.getByLabel('Фамилия', { exact: true }).fill('Тестовый');
    await page.getByLabel('Имя', { exact: true }).fill('Участник');
    await page.getByLabel('Компания', { exact: true }).fill('Тестовая компания');
    const contact = page.getByLabel('Телеграм', { exact: true });
    await contact.fill('@test_player');
    await contact.press('End');
    await contact.pressSequentially('Ж');
    await expect(contact).toHaveValue('@test_player');
    await expect(page.getByRole('checkbox')).not.toBeChecked();
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await expect(page.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('button', { name: 'Начать смену' })).toHaveCount(0);
    await contact.fill('https://t.me/test_player');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.getByRole('button', { name: 'Начать смену' }).click();
    await expect(page.getByTestId('room-title')).toHaveText('Серверная');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Смена на паузе', exact: true })).toBeVisible();
    expect(await page.evaluate(() => '__uptime' in window)).toBe(false);
    expect(external).toEqual([]);
    expect(failures).toEqual([]);
    expect(errors).toEqual([]);
  });
}
