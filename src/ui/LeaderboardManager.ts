import { DIFFICULTIES } from '../core/difficulty';
import type { Difficulty } from '../core/types';
import './leaderboard-manager.css';

interface StaffRow { id: string; firstName: string; lastName: string; company: string; rooms: number; budget: number; receivedAt: string; rank: number | null; hidden: boolean }
interface StaffBoard { entries: StaffRow[]; total: number; page: number; hasMore: boolean }

/** A staff session lasts only while this dialog is open. The key never enters browser storage. */
export class LeaderboardManager {
  private readonly dialog: HTMLDialogElement;
  private readonly login: HTMLFormElement;
  private readonly keyInput: HTMLInputElement;
  private readonly panel: HTMLElement;
  private readonly status: HTMLElement;
  private readonly content: HTMLElement;
  private readonly showHidden: HTMLInputElement;
  private readonly previous: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private key = '';
  private difficulty: Difficulty = 'easy';
  private page = 0;
  private hasMore = false;
  private busy = false;
  private revision = 0;

  constructor(root: HTMLElement, private readonly onChange: () => void) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'leaderboard-dialog leaderboard-manager';
    this.dialog.setAttribute('aria-label', 'Управление лидербордом');
    this.dialog.innerHTML = `
      <button type="button" class="text-button leaderboard-close" data-staff-close>Закрыть</button>
      <div class="staff-heading"><span class="panel-eyebrow">ДЛЯ СОТРУДНИКОВ СТЕНДА</span><h2>Управление лидербордом</h2></div>
      <p class="staff-explanation">Скрытие убирает результат из рейтинга. Запись, контакты и номер паспорта остаются в базе и в выгрузке для розыгрыша. Скрытый результат можно вернуть.</p>
      <form class="staff-login">
        <label>Ключ сотрудника<input type="password" name="staff-key" autocomplete="off" spellcheck="false" autocapitalize="off" required></label>
        <button type="submit" class="primary-button">Войти</button>
      </form>
      <section class="staff-panel" hidden>
        <div class="leaderboard-filters" role="group" aria-label="Сложность управления">${(Object.keys(DIFFICULTIES) as Difficulty[]).map(value => `<button type="button" data-staff-difficulty="${value}" aria-pressed="${value === this.difficulty}">${DIFFICULTIES[value].label}</button>`).join('')}</div>
        <div class="staff-tools"><label><input type="checkbox" data-staff-hidden>Показать скрытые</label><button type="button" class="text-button" data-staff-refresh>Обновить</button><button type="button" class="text-button" data-staff-logout>Выйти</button></div>
        <div class="staff-data"></div>
        <nav class="staff-pagination" aria-label="Страницы результатов"><button type="button" class="text-button" data-staff-previous>Назад</button><span data-staff-page></span><button type="button" class="text-button" data-staff-next>Далее</button></nav>
      </section>
      <p class="staff-status" role="status" aria-live="polite"></p>`;
    root.append(this.dialog);
    this.login = this.dialog.querySelector('.staff-login')!;
    this.keyInput = this.login.querySelector('input')!;
    this.panel = this.dialog.querySelector('.staff-panel')!;
    this.status = this.dialog.querySelector('.staff-status')!;
    this.content = this.dialog.querySelector('.staff-data')!;
    this.showHidden = this.dialog.querySelector('[data-staff-hidden]')!;
    this.previous = this.dialog.querySelector('[data-staff-previous]')!;
    this.next = this.dialog.querySelector('[data-staff-next]')!;
    this.login.addEventListener('submit', event => {
      event.preventDefault(); if (this.busy) return;
      this.key = this.keyInput.value.trim(); void this.load();
    });
    this.showHidden.addEventListener('change', () => { this.page = 0; void this.load(); });
    this.dialog.addEventListener('close', () => this.reset());
    this.dialog.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button) return;
      if (button.hasAttribute('data-staff-close')) { this.reset(); this.dialog.close(); return; }
      if (button.hasAttribute('data-staff-logout')) { this.reset(); this.keyInput.focus(); return; }
      if (this.busy) return;
      if (button.dataset.staffDifficulty) {
        this.difficulty = button.dataset.staffDifficulty as Difficulty; this.page = 0;
        for (const tab of this.dialog.querySelectorAll('[data-staff-difficulty]')) tab.setAttribute('aria-pressed', String(tab === button));
        void this.load();
      } else if (button.hasAttribute('data-staff-refresh')) void this.load();
      else if (button.hasAttribute('data-staff-previous') && this.page > 0) { this.page--; void this.load(); }
      else if (button.hasAttribute('data-staff-next') && this.hasMore) { this.page++; void this.load(); }
      else if (button.dataset.staffRun) void this.setVisibility(button.dataset.staffRun, button.dataset.staffHidden === 'true');
    });
  }

  public open(): void {
    if (this.dialog.open) return;
    this.reset(); this.dialog.showModal(); this.keyInput.focus();
  }

  private reset(): void {
    this.revision++; this.key = ''; this.keyInput.value = ''; this.page = 0; this.hasMore = false;
    this.showHidden.checked = false; this.content.replaceChildren(); this.panel.hidden = true; this.login.hidden = false;
    this.status.textContent = ''; this.status.dataset.state = ''; this.setBusy(false);
  }

  private setBusy(busy: boolean): void {
    this.busy = busy; this.dialog.setAttribute('aria-busy', String(busy));
    for (const control of this.dialog.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button')) {
      if (!control.hasAttribute('data-staff-close') && !control.hasAttribute('data-staff-logout')) control.disabled = busy;
    }
    this.previous.disabled = busy || this.page === 0; this.next.disabled = busy || !this.hasMore;
  }

  private async request<T>(url: string, body?: { hidden: boolean }): Promise<T> {
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${this.key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие. Повторите попытку.');
    return data as T;
  }

  private async readBoard(): Promise<StaffBoard> {
    return this.request(`/api/admin/leaderboard?difficulty=${this.difficulty}&showHidden=${this.showHidden.checked}&page=${this.page}`);
  }

  private async load(): Promise<void> {
    if (this.busy || !this.key) return;
    const revision = this.revision; this.setBusy(true); this.setStatus('Загружаем результаты…');
    try {
      const board = await this.readBoard();
      if (revision !== this.revision || !this.dialog.open) return;
      this.keyInput.value = ''; this.login.hidden = true; this.panel.hidden = false; this.render(board);
      this.setStatus(`Результатов: ${board.total}. ${this.showHidden.checked ? 'Показаны и скрытые результаты.' : 'Показаны результаты в рейтинге.'}`);
    } catch (error) {
      if (revision !== this.revision) return;
      if (!this.login.hidden) this.key = '';
      this.setStatus(error instanceof Error ? error.message : 'Не удалось загрузить результаты. Повторите попытку.', true);
    } finally { if (revision === this.revision) this.setBusy(false); }
  }

  private async setVisibility(id: string, hidden: boolean): Promise<void> {
    const revision = this.revision; this.setBusy(true); this.setStatus(hidden ? 'Скрываем результат…' : 'Возвращаем результат…');
    let saved = false;
    try {
      await this.request(`/api/admin/runs/${encodeURIComponent(id)}/visibility`, { hidden });
      // Even if the staff window was closed mid-request, refresh the public board.
      saved = true; this.onChange();
      if (revision !== this.revision || !this.dialog.open) return;
      // Do not leave an empty last page after hiding its final row.
      let board = await this.readBoard();
      if (revision !== this.revision || !this.dialog.open) return;
      if (!board.entries.length && this.page > 0) {
        this.page = Math.max(0, Math.ceil(board.total / 100) - 1); board = await this.readBoard();
      }
      if (revision !== this.revision || !this.dialog.open) return;
      this.render(board); this.setStatus(hidden ? 'Результат скрыт. Данные сохранены в базе.' : 'Результат возвращён в лидерборд.');
    } catch (error) {
      if (revision !== this.revision) return;
      this.setStatus(saved ? 'Изменение сохранено. Не удалось обновить список — нажмите «Обновить».' : error instanceof Error ? error.message : 'Не удалось подтвердить изменение. Обновите список и повторите действие.', true);
    } finally { if (revision === this.revision) this.setBusy(false); }
  }

  private setStatus(message: string, error = false): void {
    this.status.textContent = message; this.status.dataset.state = error ? 'error' : '';
  }

  private render(board: StaffBoard): void {
    this.page = board.page; this.hasMore = board.hasMore;
    this.dialog.querySelector('[data-staff-page]')!.textContent = board.total ? `Страница ${board.page + 1} из ${Math.ceil(board.total / 100)}` : 'Нет результатов';
    if (!board.entries.length) {
      const empty = document.createElement('p'); empty.className = 'leaderboard-empty';
      empty.textContent = this.showHidden.checked ? 'На этой сложности пока нет результатов.' : 'В рейтинге нет результатов. Включите «Показать скрытые», чтобы проверить скрытые записи.';
      this.content.replaceChildren(empty); return;
    }
    this.content.innerHTML = `<div class="staff-scroll" tabindex="0" aria-label="Результаты для управления"><table><thead><tr><th scope="col">Место</th><th scope="col">Игрок / компания</th><th scope="col">Результат</th><th scope="col">Видимость</th><th scope="col">Действие</th></tr></thead><tbody></tbody></table></div>`;
    const tbody = this.content.querySelector('tbody')!;
    for (const row of board.entries) {
      const tr = document.createElement('tr'); tr.dataset.runId = row.id; tr.className = row.hidden ? 'staff-row is-hidden' : 'staff-row';
      const values = [row.rank === null ? '—' : String(row.rank), `${row.firstName} ${row.lastName}`, `${row.rooms}/4 · ${row.budget.toLocaleString('ru-RU')} ₽`, row.hidden ? 'Скрыт' : 'В рейтинге'];
      for (const [index, value] of values.entries()) {
        const td = document.createElement('td'); td.textContent = value; tr.append(td);
        if (index === 1) {
          const company = document.createElement('span'); company.textContent = row.company;
          const date = document.createElement('small'); date.textContent = new Date(row.receivedAt).toLocaleString('ru-RU');
          td.append(company, date);
        }
      }
      const action = document.createElement('td'), button = document.createElement('button');
      button.type = 'button'; button.className = 'staff-visibility-button'; button.dataset.staffRun = row.id;
      button.dataset.staffHidden = String(!row.hidden); button.textContent = row.hidden ? 'Вернуть в лидерборд' : 'Скрыть';
      button.setAttribute('aria-label', button.textContent); action.append(button); tr.append(action); tbody.append(tr);
    }
  }
}
