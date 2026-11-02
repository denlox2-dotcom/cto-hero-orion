import { describe, expect, it } from 'vitest';
import { validateRegistration, type PlayerFields } from '../src/core/registration';

const fields = (phone = '', telegram = '') => ({
  lastName: ' Тестовый ', firstName: 'Участник', company: 'Тестовая компания',
  phone, telegram, email: '',
}) as PlayerFields;

describe('separate phone and Telegram registration', () => {
  it.each([
    ['+7 (900) 000-00-00', '', '+79000000000', ''],
    ['', '@Test_Player', '', '@Test_Player'],
    ['', 'https://t.me/test_player', '', '@test_player'],
    ['+7 (900) 000-00-00', 't.me/test_player/', '+79000000000', '@test_player'],
  ])('allows phone %s and Telegram %s independently and preserves both', (phone, telegram, normalizedPhone, normalizedTelegram) => {
    const result = validateRegistration(fields(phone, telegram), true);
    expect(result.errors).toEqual({});
    expect(result.fields).toEqual({ lastName: 'Тестовый', firstName: 'Участник', company: 'Тестовая компания', phone: normalizedPhone, telegram: normalizedTelegram, email: '' });
  });

  it('blocks two empty contacts and explains that one is sufficient', () => {
    const result = validateRegistration(fields(' ', ' '), true);
    expect(result.errors).toEqual({ phone: expect.stringMatching(/телефон.*Telegram/i), telegram: expect.stringMatching(/телефон.*Telegram/i) });
  });

  it.each([
    ['123', '@test_player', 'phone'],
    ['+7.900.000.00.00', '@test_player', 'phone'],
    ['@test_player', '', 'phone'],
    ['+79000000000', '@a', 'telegram'],
    ['+79000000000', 'test_player', 'telegram'],
    ['', '+79000000000', 'telegram'],
    ['+79000000000', '@test_игрок', 'telegram'],
  ])('checks the format of every provided contact (%s, %s)', (phone, telegram, invalid) => {
    const result = validateRegistration(fields(phone, telegram), true);
    expect(result.errors).toHaveProperty(invalid);
    expect(Object.keys(result.errors)).toEqual([invalid]);
  });

  it('still requires consent when a phone alone is valid', () => {
    expect(validateRegistration(fields('+79000000000'), false).errors).toEqual({ consent: expect.any(String) });
  });
});
