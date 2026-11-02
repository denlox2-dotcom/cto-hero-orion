/** Staff enters the number printed on the issued paper passport. */
export class PassportNumber {
  private readonly input: HTMLInputElement;
  private readonly button: HTMLButtonElement;
  private readonly status: HTMLElement;
  private runSaved = false;
  private busy = false;
  private savedNumber = '';

  constructor(private readonly form: HTMLFormElement, private readonly runId: string, private readonly token: string, private readonly hasPlayer: boolean, private readonly onSaved: (value: string) => void = () => {}) {
    this.input = form.querySelector('input')!;
    this.button = form.querySelector('button')!;
    this.status = form.querySelector('.passport-number-status')!;
    this.button.disabled = true;
    this.status.textContent = hasPlayer ? 'Номер можно сохранить после записи результата.' : 'Для привязки паспорта нужна регистрация перед игрой.';
    form.addEventListener('submit', event => { event.preventDefault(); void this.save(); });
    this.input.addEventListener('input', () => {
      this.input.removeAttribute('aria-invalid');
      this.status.dataset.state = '';
      this.status.textContent = this.savedNumber
        ? `Сохранён паспорт № ${this.savedNumber}. Чтобы исправить номер, сохраните изменения.`
        : '';
    });
  }

  public get editing(): boolean { return this.busy || document.activeElement === this.input || this.input.value.trim() !== this.savedNumber; }

  public canLeave(): boolean {
    if (this.busy) {
      this.status.textContent = 'Дождитесь подтверждения сохранения номера.';
      return false;
    }
    if (this.input.value.trim() && this.input.value.trim() !== this.savedNumber) {
      this.status.dataset.state = 'error';
      this.status.textContent = this.savedNumber
        ? `Сначала сохраните новый номер или верните ${this.savedNumber}. Очистка поля оставит прежний паспорт.`
        : 'Сначала сохраните введённый номер или очистите поле, чтобы продолжить без паспорта.';
      this.input.focus();
      return false;
    }
    return true;
  }

  public setRunSaved(saved: boolean): void {
    if (this.runSaved || !saved || !this.hasPlayer) return;
    this.runSaved = true;
    this.button.disabled = this.busy;
    this.status.textContent = '';
  }

  private async save(): Promise<void> {
    if (this.busy || !this.runSaved) return;
    const value = this.input.value.trim();
    if (!/^\d{1,20}$/.test(value)) {
      this.input.setAttribute('aria-invalid', 'true');
      this.status.dataset.state = 'error';
      this.status.textContent = 'Введите только цифры: от 1 до 20. Нули в начале сохранятся.';
      this.input.focus();
      return;
    }
    this.busy = true;
    this.input.disabled = true;
    this.button.disabled = true;
    this.form.setAttribute('aria-busy', 'true');
    this.status.dataset.state = '';
    this.status.textContent = 'Сохраняем номер паспорта…';
    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(this.runId)}/passport`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passportToken: this.token, passportNumber: value }), signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json();
      if (!response.ok) {
        this.status.dataset.state = 'error';
        this.status.textContent = response.status === 409 ? 'Этот номер паспорта уже привязан к другой попытке. Проверьте бумажный паспорт.'
          : response.status === 400 ? 'Введите только цифры: от 1 до 20.'
          : response.status === 403 ? 'Не удалось подтвердить попытку. Обратитесь к сотруднику стенда.'
          : 'Не удалось подтвердить сохранение. Проверьте связь и повторите отправку.';
        return;
      }
      if (data.passportNumber !== value) throw new Error('Unexpected passport response');
      this.savedNumber = value;
      this.input.value = value;
      this.onSaved(value);
      this.status.dataset.state = 'saved';
      this.status.textContent = `Паспорт № ${value} привязан к вашему результату и контакту. Можно участвовать в розыгрыше.`;
    } catch {
      this.status.dataset.state = 'error';
      this.status.textContent = 'Не удалось подтвердить сохранение. Проверьте связь и повторите отправку.';
    } finally {
      this.busy = false;
      this.input.disabled = false;
      this.button.disabled = false;
      this.form.removeAttribute('aria-busy');
    }
  }
}
