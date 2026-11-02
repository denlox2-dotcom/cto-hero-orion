import { DIFFICULTIES } from '../core/difficulty';
import type { Difficulty } from '../core/types';
import { CONTACT_INPUT_ERROR, PHONE_INPUT_ERROR, isContactInputAllowed, validateRegistration, type ContactField, type PlayerFields, type RegisteredPlayer, type RegistrationField } from '../core/registration';

const CONSENT_VERSION = 'draft-game-registration-2026-10-04';
const emptyFields = (): PlayerFields => ({ lastName: '', firstName: '', company: '', phone: '', telegram: '', email: '' });
const contactFields: ContactField[] = ['phone', 'telegram'];

export class PlayerEntry {
  private host!: HTMLElement;
  private panel!: HTMLElement;
  private step: 'contacts' | 'difficulty' = 'contacts';
  private fields = emptyFields();
  private player: RegisteredPlayer | null = null;
  private difficulty: Difficulty = 'easy';
  private contactDraft: Record<ContactField, { value: string; start: number; end: number }> = {
    phone: { value: '', start: 0, end: 0 }, telegram: { value: '', start: 0, end: 0 },
  };
  private contactComposing = new Set<ContactField>();

  constructor(private readonly handlers: {
    start: (difficulty: Difficulty) => void;
    difficulty: (difficulty: Difficulty) => void;
  }) {}

  public get hasPlayer(): boolean { return this.player !== null; }
  public get registeredPlayer(): RegisteredPlayer | null { return this.player ? { ...this.player } : null; }

  public mount(host: HTMLElement, panel: HTMLElement): void {
    this.host = host;
    this.panel = panel;
    this.fields = emptyFields();
    this.player = null;
    this.difficulty = 'easy';
    this.handlers.difficulty(this.difficulty);
    host.addEventListener('click', event => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!target) return;
      const difficulty = target.dataset.difficulty as Difficulty | undefined;
      if (difficulty && difficulty in DIFFICULTIES) { this.selectDifficulty(difficulty); return; }
      switch (target.dataset.entryAction) {
        case 'continue': this.advance(); break;
        case 'edit': this.showContacts(); break;
      }
    });
    host.addEventListener('submit', event => {
      event.preventDefault();
      if (this.step === 'contacts') this.register();
    });
    host.addEventListener('beforeinput', event => {
      const input = this.contactTarget(event);
      if (!input || !(event instanceof InputEvent) || event.isComposing || this.contactComposing.has(input.name as ContactField)) return;
      this.rememberContact(input);
      if (event.data !== null && !isContactInputAllowed(event.data, input.name as ContactField)) {
        event.preventDefault();
        this.showContactInputError(input.name as ContactField);
      }
    });
    host.addEventListener('paste', event => {
      const input = this.contactTarget(event);
      if (!input) return;
      this.rememberContact(input);
      if (event.clipboardData && !isContactInputAllowed(event.clipboardData.getData('text/plain'), input.name as ContactField)) {
        event.preventDefault();
        this.showContactInputError(input.name as ContactField);
      }
    });
    host.addEventListener('compositionstart', event => {
      const input = this.contactTarget(event);
      if (!input) return;
      this.rememberContact(input);
      this.contactComposing.add(input.name as ContactField);
    });
    host.addEventListener('compositionend', event => {
      const input = this.contactTarget(event);
      if (!input) return;
      this.contactComposing.delete(input.name as ContactField);
      this.acceptContactInput(input);
    });
    host.addEventListener('input', event => {
      const input = event.target;
      if (input instanceof HTMLInputElement) {
        if (contactFields.includes(input.name as ContactField)) {
          if (this.contactComposing.has(input.name as ContactField) || (event instanceof InputEvent && event.isComposing)) return;
          if (!this.acceptContactInput(input)) return;
        }
        input.removeAttribute('aria-invalid');
        input.setCustomValidity('');
      }
    });
    this.showContacts();
  }

  private contactTarget(event: Event): HTMLInputElement | null {
    return this.step === 'contacts' && event.target instanceof HTMLInputElement && contactFields.includes(event.target.name as ContactField) ? event.target : null;
  }

  private rememberContact(input: HTMLInputElement): void {
    const field = input.name as ContactField;
    if (isContactInputAllowed(input.value, field)) {
      this.contactDraft[field] = { value: input.value, start: input.selectionStart ?? input.value.length, end: input.selectionEnd ?? input.value.length };
    }
  }

  private acceptContactInput(input: HTMLInputElement): boolean {
    const field = input.name as ContactField;
    if (!isContactInputAllowed(input.value, field)) {
      const previous = this.contactDraft[field];
      input.value = previous.value;
      input.setSelectionRange(previous.start, previous.end);
      this.showContactInputError(field);
      return false;
    }
    this.rememberContact(input);
    input.removeAttribute('aria-invalid');
    input.setCustomValidity('');
    const error = this.host.querySelector<HTMLElement>('.entry-error')!;
    if (error.dataset.contactInput === field) {
      error.hidden = true;
      error.textContent = '';
      delete error.dataset.contactInput;
    }
    return true;
  }

  private showContactInputError(field: ContactField): void {
    const error = this.host.querySelector<HTMLElement>('.entry-error')!;
    error.textContent = field === 'phone' ? PHONE_INPUT_ERROR : CONTACT_INPUT_ERROR;
    error.dataset.contactInput = field;
    error.hidden = false;
  }

  public advance(): void {
    if (this.step === 'contacts') this.host.querySelector<HTMLFormElement>('form')?.requestSubmit();
    else if (this.player) this.handlers.start(this.difficulty);
  }

  private showContacts(): void {
    this.step = 'contacts';
    this.panel.dataset.entryStep = this.step;
    this.host.innerHTML = `
      <div class="entry-step-label">01 / КОНТАКТЫ <span>02 / СЛОЖНОСТЬ</span></div>
      <form class="player-form" novalidate autocomplete="off" aria-label="Контакты игрока">
        ${([
          ['lastName', 'Фамилия', 'Ваша фамилия'], ['firstName', 'Имя', 'Ваше имя'],
          ['company', 'Компания', 'Название компании'], ['phone', 'Телефон', '+7 900 000-00-00'], ['telegram', 'Телеграм', '@username или t.me/username'], ['email', 'Почта', 'name@example.com'],
        ] as const).map(([name, label, placeholder]) => `<label class="player-field"><span>${label}${name === 'email' ? '<small id="entry-email-hint">необязательно</small>' : ''}</span><input name="${name}" aria-label="${label}" placeholder="${placeholder}" maxlength="${name === 'email' ? 254 : 100}" spellcheck="false" ${name === 'email' ? 'type="email" inputmode="email" autocapitalize="none" aria-describedby="entry-email-hint"' : contactFields.includes(name as ContactField) ? `aria-describedby="entry-contact-hint" autocapitalize="none" ${name === 'phone' ? 'type="tel" inputmode="tel"' : ''}` : 'required'}></label>`).join('')}
        <p class="entry-contact-hint" id="entry-contact-hint">Укажите телефон или Telegram — достаточно одного контакта.</p>
        <p class="entry-purpose"><span class="entry-test-notice">Тестовая версия: используйте только вымышленные данные.</span> Заполните форму, чтобы ваш результат попал в таблицу лидеров. Контакт нужен для связи по вопросам призов. <strong>ТОП-5 получат ценные призы.</strong></p>
        <div class="entry-consent"><label><input type="checkbox" name="consent" required><span>Ознакомлен(а) с <a class="consent-link" href="https://k2.tech/personal-data-processing-policy/" target="_blank" rel="noopener noreferrer">Политикой обработки персональных данных</a> и даю <a class="consent-link" href="https://k2.tech/consent-to-personal-data-processing/" target="_blank" rel="noopener noreferrer">согласие на обработку моих персональных данных</a> для регистрации в игре «CTO на страже инфраструктуры», учёта результатов и связи по вопросам призов.</span></label></div>
        <p class="entry-error" role="alert" hidden></p>
        <div class="entry-actions"><button type="submit" class="primary-button start-button">Продолжить <span aria-hidden="true">→</span></button></div>
      </form>`;
    for (const name of Object.keys(this.fields) as (keyof PlayerFields)[]) {
      this.host.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value = this.fields[name];
    }
    this.contactComposing.clear();
    for (const field of contactFields) this.rememberContact(this.host.querySelector<HTMLInputElement>(`[name="${field}"]`)!);
    this.player = null;
    this.host.querySelector<HTMLInputElement>('[name="lastName"]')!.focus({ preventScroll: true });
  }

  private saveDraft(): void {
    const form = this.host.querySelector<HTMLFormElement>('form');
    if (!form) return;
    const data = new FormData(form);
    for (const name of Object.keys(this.fields) as (keyof PlayerFields)[]) this.fields[name] = String(data.get(name) ?? '');
  }

  private register(): void {
    this.saveDraft();
    const consent = this.host.querySelector<HTMLInputElement>('[name="consent"]')!.checked;
    const { fields, errors } = validateRegistration(this.fields, consent);
    let firstInvalid: HTMLInputElement | undefined;
    for (const name of [...Object.keys(fields), 'consent'] as RegistrationField[]) {
      const input = this.host.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
      input.setCustomValidity(errors[name] ?? '');
      if (errors[name]) { input.setAttribute('aria-invalid', 'true'); firstInvalid ??= input; }
      else input.removeAttribute('aria-invalid');
    }
    const error = this.host.querySelector<HTMLElement>('.entry-error')!;
    delete error.dataset.contactInput;
    if (firstInvalid) {
      error.hidden = false;
      error.textContent = firstInvalid.validationMessage;
      firstInvalid.focus({ preventScroll: true });
      return;
    }
    this.fields = fields;
    this.player = { ...fields, contact: fields.phone || fields.telegram, consentVersion: CONSENT_VERSION, consentAcceptedAt: new Date().toISOString() };
    this.showDifficulty();
  }

  private showDifficulty(): void {
    this.step = 'difficulty';
    this.panel.dataset.entryStep = this.step;
    this.host.innerHTML = `
      <div class="entry-step-label"><span>01 / КОНТАКТЫ ✓</span> 02 / СЛОЖНОСТЬ</div>
      <h2 class="entry-heading">Выберите сложность</h2>
      <p class="entry-player"></p>
      <div class="difficulty-select">
        <span class="difficulty-label" id="difficulty-heading">СЛОЖНОСТЬ</span>
        <div class="difficulty-switch" role="radiogroup" aria-labelledby="difficulty-heading" aria-describedby="difficulty-description">
          ${(Object.keys(DIFFICULTIES) as Difficulty[]).map(d => `<button type="button" role="radio" data-difficulty="${d}" aria-checked="${d === this.difficulty}" tabindex="${d === this.difficulty ? 0 : -1}">${DIFFICULTIES[d].label}</button>`).join('')}
        </div>
        <p class="difficulty-description" id="difficulty-description" aria-live="polite">${DIFFICULTIES[this.difficulty].description}</p>
      </div>
      <button type="button" class="primary-button start-button" data-entry-action="continue" aria-label="Начать смену">Начать смену <span class="button-shortcut" aria-hidden="true">Enter →</span></button>
      <button type="button" class="text-button entry-edit" data-entry-action="edit">Изменить контакты</button>`;
    this.host.querySelector<HTMLElement>('.entry-player')!.textContent = `${this.fields.firstName}, всё готово к старту.`;
    this.host.querySelector<HTMLButtonElement>('[data-entry-action="continue"]')!.focus({ preventScroll: true });
  }

  private selectDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty;
    this.handlers.difficulty(difficulty);
    for (const button of this.host.querySelectorAll<HTMLButtonElement>('[data-difficulty]')) {
      const selected = button.dataset.difficulty === difficulty;
      button.setAttribute('aria-checked', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    this.host.querySelector<HTMLElement>('#difficulty-description')!.textContent = DIFFICULTIES[difficulty].description;
  }
}
