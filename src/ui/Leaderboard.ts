import { DIFFICULTIES } from '../core/difficulty';
import type { Difficulty, RunState } from '../core/types';
import type { RegisteredPlayer } from '../core/registration';

interface Row { id: string; rank: number; firstName: string; company: string; rooms: number; budget: number }
interface Board { entries: Row[]; current: Row | null; total: number }
interface BoardOptions { compact?: boolean }
export interface Submission { id: string; player: RegisteredPlayer; difficulty: Difficulty; budget: number; results: { id: string; reason: string }[]; passportToken?: string }

export function runSubmission(id: string, player: RegisteredPlayer, run: RunState): Submission {
  return { id, player: { ...player }, difficulty: run.difficulty, budget: Math.floor(run.budget), results: run.results.map(({ id, reason }) => ({ id, reason })) };
}

export class Leaderboard {
  private difficulty: Difficulty;
  private pending: Submission | undefined;
  private saved = false;
  private busy = false;
  private refreshRequested = false;
  private readonly status: HTMLElement;
  private readonly content: HTMLElement;
  private readonly refresh: HTMLButtonElement;

  constructor(private readonly host: HTMLElement, difficulty: Difficulty, private readonly currentId = '', submission?: Submission, private readonly onStatus?: (message: string, saved: boolean) => void, private readonly options: BoardOptions = {}) {
    this.difficulty = difficulty;
    this.pending = submission;
    host.innerHTML = `
      <div class="leaderboard-heading"><div><span class="panel-eyebrow">${options.compact ? 'ЛИДЕРБОРД' : 'ОБЩИЙ РЕЙТИНГ'}</span><h2>${options.compact ? 'Топ-5 игроков' : 'Таблица лидеров'}</h2></div>${options.compact ? '<button type="button" class="text-button board-full" data-action="leaderboard" aria-label="Весь рейтинг">Весь рейтинг <span aria-hidden="true">↗</span></button>' : '<span class="leaderboard-prize">ТОП-5<br><b>ценные призы</b></span>'}</div>
      <div class="leaderboard-filters" role="group" aria-label="Сложность рейтинга">${(Object.keys(DIFFICULTIES) as Difficulty[]).map(value => `<button type="button" data-board-difficulty="${value}" aria-pressed="${value === difficulty}">${DIFFICULTIES[value].label}</button>`).join('')}</div>
      <p class="leaderboard-rule">${options.compact ? 'Больше комнат → выше бюджет → выше место.' : 'Выше — больше комнат, затем бюджет. При равенстве — более ранний результат.'}</p>
      <div class="leaderboard-data"></div>
      <div class="leaderboard-footer"><p class="leaderboard-status" role="status" aria-live="polite"></p><button type="button" class="text-button" data-board-refresh>Обновить</button>${options.compact ? '' : '<button type="button" class="text-button" data-action="manage-leaderboard">Управление</button>'}</div>`;
    this.status = host.querySelector('.leaderboard-status')!;
    this.content = host.querySelector('.leaderboard-data')!;
    this.refresh = host.querySelector('[data-board-refresh]')!;
    host.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button || this.busy) return;
      if (button.dataset.boardDifficulty) {
        this.difficulty = button.dataset.boardDifficulty as Difficulty;
        for (const tab of host.querySelectorAll<HTMLButtonElement>('[data-board-difficulty]')) tab.setAttribute('aria-pressed', String(tab === button));
        void this.load();
      } else if (button.hasAttribute('data-board-refresh')) void this.load();
    });
    void this.load();
  }

  public get selectedDifficulty(): Difficulty { return this.difficulty; }

  public refreshBoard(): void {
    if (this.busy) this.refreshRequested = true;
    else if (this.host.isConnected) void this.load();
  }

  public setDifficulty(difficulty: Difficulty): void {
    if (this.difficulty === difficulty) return;
    this.difficulty = difficulty;
    for (const tab of this.host.querySelectorAll<HTMLButtonElement>('[data-board-difficulty]')) tab.setAttribute('aria-pressed', String(tab.dataset.boardDifficulty === difficulty));
    // Registration may change difficulty while the previous board is loading.
    if (!this.busy) void this.load();
  }

  private async request(url: string, body?: Submission): Promise<Board> {
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('Leaderboard unavailable');
    return await response.json() as Board;
  }

  private async load(): Promise<void> {
    this.refreshRequested = false;
    const requestedDifficulty = this.difficulty;
    this.busy = true;
    this.host.setAttribute('aria-busy', 'true');
    this.setStatus(this.pending ? 'Сохраняем результат…' : 'Загружаем рейтинг…');
    this.content.replaceChildren();
    this.refresh.disabled = true;
    for (const button of this.host.querySelectorAll<HTMLButtonElement>('[data-board-difficulty]')) button.disabled = true;
    try {
      let board: Board | undefined;
      if (this.pending) {
        const submitted = await this.request('/api/runs', this.pending);
        if (requestedDifficulty === this.pending.difficulty) board = submitted;
        this.pending = undefined;
        this.saved = true;
      }
      board ??= await this.request(`/api/leaderboard?difficulty=${requestedDifficulty}&current=${encodeURIComponent(this.currentId)}`);
      if (!this.host.isConnected) return;
      if (requestedDifficulty !== this.difficulty) return;
      this.render(board);
      this.setStatus(this.options.compact ? `Результатов в рейтинге: ${board.total}.` : `${this.saved ? 'Результат сохранён. ' : ''}${board.current ? `Ваше место: ${board.current.rank}. ` : ''}Ранов в рейтинге: ${board.total}.`);
      this.refresh.textContent = 'Обновить';
    } catch {
      if (!this.host.isConnected) return;
      this.setStatus(this.pending ? 'Результат пока не сохранён. Проверьте связь и повторите отправку.' : 'Не удалось загрузить рейтинг. Попробуйте ещё раз.');
      this.refresh.textContent = 'Повторить';
    } finally {
      this.busy = false;
      this.host.removeAttribute('aria-busy');
      this.refresh.disabled = false;
      for (const button of this.host.querySelectorAll<HTMLButtonElement>('[data-board-difficulty]')) button.disabled = false;
      if (this.host.isConnected && (requestedDifficulty !== this.difficulty || this.refreshRequested)) void this.load();
    }
  }

  private setStatus(message: string): void {
    this.status.textContent = message;
    this.onStatus?.(message, this.saved);
  }

  private render(board: Board): void {
    if (!board.entries.length) {
      const empty = document.createElement('p'); empty.className = 'leaderboard-empty';
      empty.textContent = this.options.compact ? 'Пока нет результатов. Ваша смена может стать первой!' : 'Здесь пока нет результатов. Завершите первую смену!';
      this.content.replaceChildren(empty); return;
    }
    this.content.innerHTML = `<div class="leaderboard-scroll" tabindex="0" aria-label="Результаты ранов"><table aria-label="${this.options.compact ? 'Пять лидеров' : 'Таблица результатов'}"><thead><tr><th scope="col">№</th><th scope="col">${this.options.compact ? 'Игрок / компания' : 'Имя'}</th>${this.options.compact ? '' : '<th scope="col">Компания</th>'}<th scope="col">Комнаты</th><th scope="col">Бюджет</th></tr></thead><tbody></tbody></table></div>`;
    const tbody = this.content.querySelector('tbody')!;
    const rows = this.options.compact ? board.entries.slice(0, 5) : [...board.entries];
    if (!this.options.compact && board.current && !rows.some(row => row.id === board.current!.id)) rows.push(board.current);
    for (const row of rows) {
      const tr = document.createElement('tr');
      tr.className = `leaderboard-row${row.id === this.currentId ? ' is-current' : ''}${row.rank <= 5 ? ' is-top' : ''}`;
      tr.dataset.runId = row.id;
      if (row.id === this.currentId) tr.setAttribute('aria-current', 'true');
      const values = this.options.compact ? [String(row.rank), row.firstName, `${row.rooms}/4`, `${row.budget.toLocaleString('ru-RU')} ₽`] : [String(row.rank), row.firstName, row.company, `${row.rooms}/4`, `${row.budget.toLocaleString('ru-RU')} ₽`];
      for (const [index, value] of values.entries()) {
        const td = document.createElement('td'); td.textContent = value; tr.append(td);
        if (this.options.compact && index === 1) {
          const name = document.createElement('strong'); name.textContent = row.firstName;
          const company = document.createElement('span'); company.textContent = row.company;
          td.replaceChildren(name, company);
        }
      }
      tbody.append(tr);
    }
    if (!this.options.compact && board.current && board.current.rank > 100) {
      const note = document.createElement('p'); note.className = 'leaderboard-rule'; note.textContent = 'Показаны первые 100 ранов и ваш результат.'; this.content.append(note);
    }
  }
}
