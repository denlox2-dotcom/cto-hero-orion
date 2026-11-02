export interface PlayerFields {
  lastName: string;
  firstName: string;
  company: string;
  phone: string;
  telegram: string;
  email: string;
}

export interface RegisteredPlayer extends PlayerFields {
  contact: string;
  consentVersion: string;
  consentAcceptedAt: string;
}

export type RegistrationField = keyof PlayerFields | 'consent';
export type ContactField = 'phone' | 'telegram';
export type RegistrationErrors = Partial<Record<RegistrationField, string>>;

const clean = (value: string) => value.trim().replace(/\s+/g, ' ');
export const CONTACT_INPUT_ERROR = 'Для Telegram используйте латиницу, цифры, пробел и знаки @ . _ : / -.';
export const PHONE_INPUT_ERROR = 'Для телефона используйте цифры, пробел и знаки + ( ) -.';
export const CONTACT_REQUIRED_ERROR = 'Укажите телефон или Telegram — достаточно одного контакта.';

export function isContactInputAllowed(value: string, field: ContactField = 'telegram'): boolean {
  return field === 'phone' ? /^[\d +()\-]*$/.test(value) : /^[a-z\d @._:\/-]*$/i.test(value);
}

export function validateRegistration(fields: PlayerFields, consent: boolean): {
  fields: PlayerFields;
  errors: RegistrationErrors;
} {
  const normalized: PlayerFields = {
    lastName: clean(fields.lastName), firstName: clean(fields.firstName),
    company: clean(fields.company), phone: fields.phone.trim(), telegram: fields.telegram.trim(), email: (fields.email ?? '').trim(),
  };
  const errors: RegistrationErrors = {};
  for (const [field, message] of [
    ['lastName', 'Укажите фамилию.'], ['firstName', 'Укажите имя.'], ['company', 'Укажите компанию.'],
  ] as const) {
    if (!normalized[field]) errors[field] = message;
    else if (normalized[field].length > 100) errors[field] = 'Используйте не больше 100 символов.';
  }
  if (normalized.phone) {
    const phone = normalized.phone.replace(/[ ()\-]/g, '');
    if (!isContactInputAllowed(fields.phone, 'phone')) errors.phone = PHONE_INPUT_ERROR;
    else if (/^\+?\d{7,15}$/.test(phone)) normalized.phone = phone;
    else errors.phone = 'Укажите телефон с кодом страны, например +7 900 000-00-00.';
  }
  if (normalized.telegram) {
    const telegram = normalized.telegram.match(/^(?:@|(?:https?:\/\/)?t\.me\/)([a-z\d_]{3,32})\/?$/i);
    if (!isContactInputAllowed(fields.telegram, 'telegram')) errors.telegram = CONTACT_INPUT_ERROR;
    else if (telegram) normalized.telegram = `@${telegram[1]}`;
    else errors.telegram = 'Укажите Telegram в формате @username или ссылки t.me/username.';
  }
  if (!normalized.phone && !normalized.telegram) {
    errors.phone = CONTACT_REQUIRED_ERROR;
    errors.telegram = CONTACT_REQUIRED_ERROR;
  }
  if (normalized.email.length > 254) errors.email = 'Используйте не больше 254 символов.';
  else if (normalized.email && !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(normalized.email)) {
    errors.email = 'Укажите почту в формате name@example.com.';
  }
  if (!consent) errors.consent = 'Для продолжения нужно согласие на обработку персональных данных.';
  return { fields: normalized, errors };
}
