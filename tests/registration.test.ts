import { describe, expect, it } from 'vitest';
import { validateRegistration, type ContactField, type PlayerFields } from '../src/core/registration';

const player = (field: ContactField, value: string): PlayerFields => ({
  lastName: '  Тестовый  ', firstName: 'Участник', company: 'Тестовая   компания', phone: '', telegram: '', email: '', [field]: value,
});

describe('registration validation', () => {
  it.each([
    ['phone', '+7 (900) 000-00-00', '+79000000000'],
    ['telegram', '@Test_Player', '@Test_Player'],
    ['telegram', 'https://t.me/test_player', '@test_player'],
    ['telegram', 't.me/test_player/', '@test_player'],
  ] as const)('normalizes the supported %s contact %s', (field, value, normalized) => {
    const result = validateRegistration(player(field, value), true);
    expect(result.errors).toEqual({});
    expect(result.fields).toEqual({ lastName: 'Тестовый', firstName: 'Участник', company: 'Тестовая компания', phone: '', telegram: '', email: '', [field]: normalized });
  });

  it.each([
    ['telegram', '@test_игрок'], ['telegram', '@test🙂player'], ['phone', '+7\u00a0(900) 000-00-00'],
    ['phone', '\t+79000000000'], ['phone', '+79000000000\n'],
  ] as const)('rejects unsupported characters instead of silently altering %s %s', (field, value) => {
    expect(validateRegistration(player(field, value), true).errors[field]).toBeTruthy();
  });

  it.each([['phone', '123'], ['telegram', '@a'], ['telegram', 'test_player'], ['phone', '+7.900.000.00.00']] as const)('requires a usable %s contact for %s', (field, value) => {
    expect(validateRegistration(player(field, value), true).errors[field]).toBeTruthy();
  });

  it('requires identity fields, at least one contact and explicit consent', () => {
    const result = validateRegistration({ lastName: ' ', firstName: '', company: '', phone: '', telegram: '', email: '' }, false);
    expect(result.errors).toHaveProperty('consent');
    expect(Object.keys(result.errors).sort()).toEqual(['company', 'consent', 'firstName', 'lastName', 'phone', 'telegram']);
  });
});
