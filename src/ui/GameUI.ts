import type { Difficulty, ObjectiveKind, RoomConfig, RoomId, RoomResult, RunState } from '../core/types';
import { DIFFICULTIES } from '../core/difficulty';
import { ROOM_RESULT_SECONDS } from '../core/presentation';
import { ROOMS } from '../core/rooms';
import k2Logo from '../assets/k2-neurotech-logo.svg';
import { PlayerEntry } from './PlayerEntry';
import { Leaderboard, runSubmission } from './Leaderboard';
import { PakAssembly } from './PakAssembly';
import { AMULET_PRODUCTS, amuletDataUrl } from '../assets/pakArt';
import type { PakAssist } from '../core/pak';
import { renderPassport } from './Passport';
import { HudMeters, hudMetersMarkup } from './HudMeters';
import { PassportNumber } from './PassportNumber';
import { LeaderboardManager } from './LeaderboardManager';

type Theme = 'aihub' | 'k2';

function themeFromUrl(): Theme {
  return new URLSearchParams(window.location.search).get('theme') === 'aihub' ? 'aihub' : 'k2';
}

export interface HudSnapshot {
  remaining: number;
  sla: number;
  energy: number;
  ogn: number;
  budget: number;
  tokens: RoomId[];
  amulets: RoomId[];
  pakPhase: PakAssist['phase'];
  objectives: { kind: ObjectiveKind; done: number; total: number }[];
  gpu: number;
  pro: number;
  wrench: boolean;
  combo: number;
  comboRemaining: number;
  entering: boolean;
}

export interface UIHandlers {
  start: (difficulty: Difficulty) => void;
  resume: () => void;
  restart: () => void;
  retryRoom: () => void;
  menu: () => void;
  leaderboard: () => void;
  sound: () => void;
  fullscreen: () => void;
}

const OBJECTIVE_NAMES: Record<ObjectiveKind, string> = {
  incident: 'Инциденты', debt: 'Техдолг', backlog: 'Бэклог',
  leak: 'Утечки', fire: 'Пожары', boss: 'Босс',
};

const REASONS: Record<RoomResult['reason'], string> = {
  success: 'Все обязательные задачи закрыты.',
  timeout: 'Время вышло.',
  sla: 'SLA упал до нуля.',
  fire: 'Угроза пожара достигла 100%.',
};

const paths = {
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14"/>',
  muted: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="m17 9 5 6m0-6-5 6"/>',
  fullscreen: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  token: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M9 8h6v8H9z"/>',
} as const;

function icon(name: keyof typeof paths, className = ''): string {
  return `<svg class="ui-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${paths[name]}</svg>`;
}

function integer(value: number): number {
  return Math.max(0, Math.ceil(Number.isFinite(value) ? value : 0));
}

function time(value: number): string {
  const seconds = integer(value);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function number(value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString('ru-RU');
}

const HERO = `<svg class="certificate-hero" viewBox="0 0 96 112" role="img" aria-label="Пиксельный CTO в каске с огнетушителем" shape-rendering="crispEdges">
  <path fill="#364351" d="M8 102h80v4H8z"/>
  <path fill="#17232e" d="M32 78h12v24H24v-8h8zm16 0h12v16h8v8H48z"/>
  <path fill="#697785" d="M32 78h12v8H32zm16 0h12v8H48z"/>
  <path fill="#c8ef7d" d="M28 44h32v36H28zM20 48h8v24h-8zm40 0h8v16h-8z"/>
  <path fill="#8aaa50" d="M28 68h32v12H28zM32 44h8v24h-8zm20 0h8v24h-8z"/>
  <path fill="#edc6a1" d="M32 24h28v20H32zM24 24h8v12h-8zm28 16h8v8h-8zM20 68h8v8h-8zm44-8h8v8h-8z"/>
  <path fill="#e9eef3" stroke="#a9b8c6" stroke-width="2" d="M36 4h20v8h8v12h8v8H20v-8h8V12h8z"/>
  <path fill="#c7d1db" d="M20 28h52v4H20z"/>
  <path fill="#ffffff" d="M40 8h8v16h-8zM28 16h8v8h-8z"/>
  <path fill="#203142" d="M44 32h8v8h-8zm12 0h4v8h-4z"/>
  <path fill="#ff937b" d="M68 64h16v32H64V68h4z"/>
  <path fill="#c8524d" d="M76 64h8v32h-8z"/>
  <path fill="#d8ddd5" d="M68 56h12v8H68zM64 76h16v8H64z"/>
  <path fill="#7e8d98" d="M60 56h12v4H60zM60 56v16h4V56z"/>
  <path fill="#c8ef7d" d="M8 16h4v4H8zM80 12h4v4h-4zM84 40h4v4h-4zM12 44h4v4h-4z"/>
</svg>`;

export class GameUI {
  public difficulty: Difficulty = 'easy';
  public theme: Theme = themeFromUrl();
  private readonly mount: HTMLElement;
  private readonly hud: HTMLElement;
  private readonly hudMeters: HudMeters;
  private readonly screen: HTMLElement;
  private readonly pause: HTMLElement;
  private readonly journey: HTMLElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly roomTitle: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly objectives: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly effects: HTMLElement;
  private readonly entry: PlayerEntry;
  private readonly assembly: PakAssembly;
  private amulets: RoomId[] = [];
  private roomIndex = -1;
  private tokens: RoomId[] = [];
  private results: RoomResult[] = [];
  private objectiveSignature = '';
  private journeySignature = '';
  private focusBeforePause: HTMLElement | null = null;
  private finalBoardId: string | null = null;
  private entryStarted = false;
  private menuBoard: Leaderboard | null = null;
  private dialogBoard: Leaderboard | null = null;
  private readonly leaderboardManager: LeaderboardManager;
  private passportNumber: PassportNumber | null = null;

  public get editingPassportNumber(): boolean { return this.passportNumber?.editing ?? false; }
  public canLeaveFinal(): boolean { return this.passportNumber?.canLeave() ?? true; }

  constructor(private readonly root: HTMLElement, private readonly handlers: UIHandlers) {
    this.root.classList.add('game-app');
    this.root.dataset.screen = 'menu';
    this.applyTheme(this.theme);
    this.root.innerHTML = `
      <div class="game-shell">
        <header class="app-header">
          <div class="brand"><span class="brand-aihub-lockup"><span class="brand-kagecore">KageCore</span><span class="brand-aihub">AI Hub</span></span><img class="brand-k2-logo" src="${k2Logo}" alt="К2 НейроТех"></div>
          <span class="edition">CTO НА СТРАЖЕ ИНФРАСТРУКТУРЫ</span>
          <nav class="header-actions" aria-label="Настройки игры">
            <button type="button" class="utility-button" data-action="leaderboard">Таблица лидеров</button>
            <button type="button" class="utility-button pause-control" data-action="pause" aria-label="Пауза" hidden>${icon('pause')}<span>Пауза</span><kbd>Esc</kbd></button>
            <button type="button" class="utility-button" data-action="sound" aria-label="Выключить звук" aria-pressed="true">${icon('sound')}<span>Звук вкл</span></button>
            <button type="button" class="utility-button icon-button" data-action="fullscreen" aria-label="Полный экран" title="Полный экран">${icon('fullscreen')}</button>
          </nav>
        </header>
        <main class="game-stage" aria-label="CTO на страже инфраструктуры — игровое поле">
          <div id="game-canvas" tabindex="0" role="application" aria-label="Игровое поле. A и D — движение, пробел — прыжок, удерживать E — тушить и чинить утечки ключом. Бэклог — ударом головы снизу. Кофе, GPU, PRO, монеты и ящик с ключом — касанием. Escape — пауза."></div>
          <section class="game-hud" aria-label="Состояние смены" hidden>
            <div class="hud-main">
              <div class="hud-meta">
                <div class="hud-context"><span data-room-index>01 / 04</span><h1 data-testid="room-title">Серверная</h1><span class="room-status" data-room-status>В РАБОТЕ</span></div>
                <div class="hud-time"><span class="hud-meta-label">ВРЕМЯ</span><strong data-testid="timer">00:40</strong></div>
                <div class="hud-budget"><span class="hud-meta-label">БЮДЖЕТ</span><strong><span data-value="budget">0</span><span class="currency"> ₽</span></strong></div>
              </div>
              ${hudMetersMarkup()}
            </div>
            <div class="mission-row"><div class="objectives" aria-label="Задачи комнаты"></div><div class="pak-assembly" aria-label="Сборка ПАК-AI"></div><div class="mission-status"><span class="difficulty-badge" data-playing-difficulty></span><div class="active-effects" aria-label="Инструмент и усиления"></div></div></div>
          </section>
          <div class="screen-layer"></div>
          <div class="pause-layer" hidden>
            <section class="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-heading">
              <h2 id="pause-heading">Смена на паузе</h2>
              <button type="button" class="primary-button" data-action="resume">Продолжить ${icon('arrow')}</button>
              <div class="pause-secondary"><button type="button" class="text-button" data-action="restart">Начать заново</button><button type="button" class="text-button" data-action="menu">В меню</button></div>
              <span class="pause-shortcut"><kbd>Esc</kbd> вернуться в игру</span>
            </section>
          </div>
        </main>
        <div class="room-journey" role="list" aria-label="Прохождение комнат"></div>
        <footer class="controls-strip" aria-label="Управление">
          <span class="controls-label">УПРАВЛЕНИЕ</span>
          <span class="control-group"><span class="key-pair"><kbd>A</kbd><kbd>D</kbd><span class="key-or">/</span><kbd>←</kbd><kbd>→</kbd></span><span>движение</span></span>
          <span class="control-group"><kbd>Space</kbd><span>прыжок</span></span>
          <span class="control-group"><kbd>E</kbd><span>тушить / чинить<span class="control-detail"> · удерживать</span></span></span>
          <span class="control-group loot-control">Лут — касанием</span>
          <span class="control-group escape-control"><kbd>Esc</kbd><span>пауза</span></span>
          <span class="build-mark">BUILD 01</span>
          <p class="room-hint"></p>
        </footer>
        <dialog class="leaderboard-dialog" aria-label="Таблица лидеров"><button type="button" class="text-button leaderboard-close" data-action="close-leaderboard">Закрыть ×</button><div class="leaderboard-dialog-content"></div></dialog>
      </div>`;

    this.mount = this.element('#game-canvas');
    this.hud = this.element('.game-hud');
    this.hudMeters = new HudMeters(this.hud);
    this.screen = this.element('.screen-layer');
    this.pause = this.element('.pause-layer');
    this.journey = this.element('.room-journey');
    this.soundButton = this.element('[data-action="sound"]') as HTMLButtonElement;
    this.pauseButton = this.element('.pause-control') as HTMLButtonElement;
    this.roomTitle = this.element('[data-testid="room-title"]');
    this.timer = this.element('[data-testid="timer"]');
    this.objectives = this.element('.objectives');
    this.hint = this.element('.room-hint');
    this.effects = this.element('.active-effects');
    this.assembly = new PakAssembly(this.element('.pak-assembly'));
    this.entry = new PlayerEntry({ start: handlers.start, difficulty: value => { this.difficulty = value; this.menuBoard?.setDifficulty(value); } });
    this.leaderboardManager = new LeaderboardManager(this.element('.game-shell'), () => {
      this.menuBoard?.refreshBoard(); this.dialogBoard?.refreshBoard();
    });

    this.root.addEventListener('click', event => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!target) return;
      if (['menu', 'restart'].includes(target.dataset.action || '') && !this.canLeaveFinal()) return;
      switch (target.dataset.action) {
        case 'enter-game': this.beginEntry(); break;
        case 'back-to-home': this.handlers.menu(); this.element('.welcome-start').focus({ preventScroll: true }); break;
        case 'resume': this.handlers.resume(); break;
        case 'restart': this.handlers.restart(); break;
        case 'retry-room': this.handlers.retryRoom(); break;
        case 'menu': this.handlers.menu(); break;
        case 'leaderboard': this.handlers.leaderboard(); break;
        case 'manage-leaderboard': this.leaderboardManager.open(); break;
        case 'close-leaderboard': (this.element('.leaderboard-dialog') as HTMLDialogElement).close(); break;
        case 'sound': this.handlers.sound(); break;
        case 'fullscreen': this.handlers.fullscreen(); break;
        // Root owns Escape and gameplay pause state, so the button uses that same path.
        case 'pause': window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true })); break;
      }
    });
    this.root.addEventListener('keydown', event => {
      const target = event.target as HTMLElement;
      const radio = target.closest<HTMLButtonElement>('button[role="radio"]');
      const group = radio?.closest<HTMLElement>('[role="radiogroup"]');
      if (radio && group && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const radios = [...group.querySelectorAll<HTMLButtonElement>('button[role="radio"]')];
        const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? radios.length - 1 : (radios.indexOf(radio) + direction + radios.length) % radios.length;
        radios[index].click();
        radios[index].focus({ preventScroll: true });
      }
      if (!this.pause.hidden && event.key === 'Tab') {
        const buttons = [...this.pause.querySelectorAll<HTMLButtonElement>('button')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener('popstate', () => this.applyTheme(themeFromUrl()));
    this.showMenu();
  }

  public showMenu(): void {
    this.passportNumber = null;
    this.finalBoardId = null;
    this.entryStarted = false;
    this.difficulty = 'easy';
    this.root.dataset.screen = 'menu';
    this.root.dataset.paused = 'false';
    this.pause.hidden = true;
    this.pauseButton.hidden = true;
    this.hud.hidden = true;
    this.hint.textContent = '';
    this.roomIndex = -1;
    this.tokens = [];
    this.amulets = [];
    this.assembly.update([], 'idle');
    this.results = [];
    this.screen.hidden = false;
    this.screen.className = 'screen-layer menu-layer';
    this.screen.innerHTML = `
      <section class="menu-panel" data-entry-step="welcome" aria-labelledby="game-title">
        <h1 id="game-title" class="game-title" aria-label="CTO на страже инфраструктуры"><span class="game-title-cto">CTO</span><span class="game-title-rest"><span>на страже</span><span>инфраструктуры</span></span></h1>
        <p class="game-subtitle">Защити ЦОД и ИИ-инфраструктуру от серии угроз</p>
        <p class="menu-description" hidden>Четыре комнаты. Соберите ПАК-AI — он поможет с боссом.</p>
        <div class="welcome-actions">
          <button type="button" class="welcome-start" data-action="enter-game" aria-label="Начать игру"><span class="welcome-start-copy">Начать <span>игру</span></span><span class="welcome-start-arrow" aria-hidden="true">↗</span><span class="welcome-start-key" aria-hidden="true">ENTER / СТАРТ</span></button>
          <p class="welcome-note">Четыре комнаты. Один СТО. Прод ждёт.</p>
        </div>
        <div class="player-entry" hidden></div>
        <button type="button" class="text-button entry-home" data-action="back-to-home" aria-label="На главный экран" hidden>← На главный экран</button>
      </section>
      <aside class="menu-leaderboard" aria-label="Топ-5 таблицы лидеров"></aside>
      <div class="demo-label"><span class="status-dot"></span> СТО НА ПОСТУ <span>01 / СЕРВЕРНАЯ</span></div>`;
    this.updateJourney();
    this.menuBoard = new Leaderboard(this.element('.menu-leaderboard'), this.difficulty, '', undefined, undefined, { compact: true });
    this.applyTheme(this.theme);
  }

  private beginEntry(): void {
    if (this.entryStarted || this.root.dataset.screen !== 'menu') return;
    this.entryStarted = true;
    this.element('.welcome-actions').hidden = true;
    this.element('.player-entry').hidden = false;
    this.element('.menu-description').hidden = false;
    this.element('.entry-home').hidden = false;
    this.entry.mount(this.element('.player-entry'), this.element('.menu-panel'));
  }

  public get canStartRun(): boolean { return this.entryStarted && this.entry.hasPlayer; }

  public advanceMenu(): void { if (this.entryStarted) this.entry.advance(); else this.beginEntry(); }

  public showPlaying(room: RoomConfig, index: number, difficulty: Difficulty): void {
    this.passportNumber = null;
    this.finalBoardId = null;
    this.menuBoard = null;
    this.difficulty = difficulty;
    this.roomIndex = index;
    if (index === 0) { this.tokens = []; this.amulets = []; this.results = []; this.assembly.update([], 'idle'); }
    this.results = this.results.filter(result => result.id !== room.id);
    this.root.dataset.screen = 'playing';
    this.root.dataset.paused = 'false';
    this.screen.hidden = true;
    this.screen.innerHTML = '';
    this.pause.hidden = true;
    this.pauseButton.hidden = false;
    this.hud.hidden = false;
    this.roomTitle.textContent = room.title;
    this.element('[data-room-index]').textContent = `Комната ${String(index + 1).padStart(2, '0')} / 04`;
    const difficultyBadge = this.element('[data-playing-difficulty]');
    difficultyBadge.textContent = DIFFICULTIES[difficulty].label;
    difficultyBadge.setAttribute('aria-label', `Сложность: ${DIFFICULTIES[difficulty].label}`);
    this.hint.textContent = room.hint;
    this.hudMeters.reset();
    this.objectiveSignature = '';
    const groups = new Map<ObjectiveKind, number>();
    for (const entity of room.entities) {
      if (entity.required !== false && entity.kind in OBJECTIVE_NAMES) {
        const kind = entity.kind as ObjectiveKind;
        groups.set(kind, (groups.get(kind) ?? 0) + 1);
      }
    }
    this.updateObjectives([...groups].map(([kind, total]) => ({ kind, total, done: 0 })));
    this.timer.textContent = time(room.time);
    this.timer.classList.remove('is-urgent');
    this.effects.innerHTML = '';
    this.updateJourney();
    this.mount.focus({ preventScroll: true });
  }

  public update(data: HudSnapshot): void {
    this.amulets = [...data.amulets];
    this.assembly.update(data.amulets, data.pakPhase);
    this.setText(this.timer, time(data.remaining));
    this.timer.classList.toggle('is-urgent', data.remaining <= 10);
    this.setText(this.element('[data-room-status]'), data.entering ? 'НА СТАРТ' : 'В РАБОТЕ');
    this.hudMeters.update(data);
    this.setText(this.element('[data-value="budget"]'), number(data.budget));
    this.updateObjectives(data.objectives);
    const effects = [
      data.wrench ? '<span class="effect-tag wrench-effect" title="Ключ остаётся до конца комнаты. Удерживайте E рядом с утечкой."><b>КЛЮЧ</b> · E ремонт</span>' : '',
      data.gpu > 0 ? `<span class="effect-tag gpu-effect">GPU <b>${integer(data.gpu)}с</b></span>` : '',
      data.pro > 0 ? `<span class="effect-tag pro-effect">PRO <b>${integer(data.pro)}с</b></span>` : '',
      data.combo > 1 && data.comboRemaining > 0 ? `<span class="effect-tag combo-effect">КОМБО <b>×${integer(data.combo)}</b></span>` : '',
    ].join('');
    if (this.effects.innerHTML !== effects) this.effects.innerHTML = effects;
    if (this.tokens.join() !== data.tokens.join()) {
      this.tokens = [...data.tokens];
    }
    this.updateJourney();
  }

  public showRoomResult(result: RoomResult, room: RoomConfig, tokens: RoomId[]): void {
    this.root.dataset.screen = 'result';
    this.root.dataset.paused = 'false';
    this.pause.hidden = true;
    this.pauseButton.hidden = true;
    this.hud.hidden = false;
    this.tokens = [...tokens];
    this.results = [...this.results.filter(previous => previous.id !== result.id), result];
    this.screen.hidden = false;
    this.screen.className = 'screen-layer result-layer';
    const success = result.reason === 'success';
    this.screen.innerHTML = `
      <section class="result-panel ${success ? 'result-success' : 'result-failure'}" aria-labelledby="result-heading" role="status">
        ${success ? `<span class="panel-eyebrow">${room.title.toUpperCase()} / ЗАКРЫТО</span>
        <div class="result-symbol"><img class="result-amulet" src="${amuletDataUrl(room.id, true)}" alt="Модуль ${AMULET_PRODUCTS.find(p => p.id === room.id)!.name}"></div>
        <h2 id="result-heading">${room.id === 'production' ? 'Прод спасён!' : 'Модуль получен'}</h2>
        <p class="result-description">${AMULET_PRODUCTS.find(p => p.id === room.id)!.name} — в вашей сборке ПАК.</p>
        <div class="result-progress"><span>ЗАДАЧИ</span><strong>${result.completed}<i> / ${result.total}</i></strong><span class="result-track" style="--progress:${result.total ? result.completed / result.total * 100 : 0}%"><span></span></span></div>
        <div class="result-next"><span class="status-dot"></span> ${room.id === 'production' ? 'Итоги смены' : 'Следующая комната'} через <strong data-countdown>${ROOM_RESULT_SECONDS}</strong> с</div>` : `
        <h2 id="result-heading">${REASONS[result.reason]}<br><span>${this.amulets.includes(room.id) ? 'Модуль сохранён. Босс не побеждён.' : 'Модуль комнаты не получен'}</span></h2>
        <button type="button" class="primary-button result-retry" data-action="retry-room">Повторить ${icon('arrow')}</button>`}
      </section>`;
    this.updateJourney();
    if (!success) this.element('[data-action="retry-room"]').focus({ preventScroll: true });
  }

  public openLeaderboard(): void {
    const dialog = this.element('.leaderboard-dialog') as HTMLDialogElement;
    if (this.root.dataset.screen !== 'final' || this.finalBoardId === null) {
      const difficulty = this.root.dataset.screen === 'menu' ? this.menuBoard?.selectedDifficulty ?? this.difficulty : this.difficulty;
      this.dialogBoard = new Leaderboard(this.replaceLeaderboardContent(), difficulty);
    }
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('[data-action="close-leaderboard"]')!.focus();
  }

  private replaceLeaderboardContent(): HTMLElement {
    const oldContent = this.element('.leaderboard-dialog-content');
    const content = oldContent.cloneNode(false) as HTMLElement;
    oldContent.replaceWith(content);
    return content;
  }

  public showFinal(run: RunState, runId: string): void {
    this.difficulty = run.difficulty;
    this.tokens = [...run.tokens];
    this.results = [...run.results];
    this.roomIndex = -1;
    this.root.dataset.screen = 'final';
    this.root.dataset.paused = 'false';
    this.pause.hidden = true;
    this.pauseButton.hidden = true;
    this.hud.hidden = true;
    this.hint.textContent = '';
    this.screen.hidden = false;
    this.screen.className = 'screen-layer final-layer';
    this.amulets = [...run.amulets];
    const player = this.entry.registeredPlayer;
    this.screen.innerHTML = renderPassport(run, player, runId, HERO);
    const passportToken = crypto.randomUUID();
    const numberEntry = new PassportNumber(this.screen.querySelector<HTMLFormElement>('.passport-number-form')!, runId, passportToken, !!player, value => {
      const display = this.screen.querySelector<HTMLOutputElement>('[data-paper-passport-display]');
      if (display) {
        display.textContent = `№ ${value}`;
        display.style.setProperty('--number-size', `${Math.min(5, 35 / (value.length + 2))}cqw`);
      }
    });
    this.passportNumber = numberEntry;
    this.finalBoardId = runId;
    const status = this.element('.passport-save-status');
    this.dialogBoard = new Leaderboard(this.replaceLeaderboardContent(), run.difficulty, runId,
      player ? { ...runSubmission(runId, player, run), passportToken } : undefined,
      (message, saved) => { status.textContent = message; numberEntry.setRunSaved(saved); });
    this.updateJourney();
    this.screen.querySelector<HTMLButtonElement>('[data-action="restart"]')?.focus({ preventScroll: true });
  }

  public setPaused(paused: boolean): void {
    if (paused && this.root.dataset.screen !== 'playing' && this.root.dataset.screen !== 'result') return;
    this.root.dataset.paused = String(paused);
    this.pause.hidden = !paused;
    this.pauseButton.setAttribute('aria-expanded', String(paused));
    if (paused) {
      this.focusBeforePause = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.pause.querySelector<HTMLButtonElement>('[data-action="resume"]')?.focus({ preventScroll: true });
    } else {
      const previous = this.focusBeforePause;
      (previous?.isConnected && !this.pause.contains(previous) ? previous : this.mount).focus({ preventScroll: true });
      this.focusBeforePause = null;
    }
  }

  public setSound(enabled: boolean): void {
    this.soundButton.setAttribute('aria-pressed', String(enabled));
    this.soundButton.setAttribute('aria-label', enabled ? 'Выключить звук' : 'Включить звук');
    this.soundButton.innerHTML = `${icon(enabled ? 'sound' : 'muted')}<span>Звук ${enabled ? 'вкл' : 'выкл'}</span>`;
  }

  public setCountdown(seconds: number): void {
    const countdown = this.screen.querySelector<HTMLElement>('[data-countdown]');
    if (countdown) this.setText(countdown, String(integer(seconds)));
  }

  private applyTheme(theme: Theme): void {
    this.theme = theme;
    document.documentElement.dataset.theme = theme;
    this.root.dataset.theme = theme;
  }

  private updateObjectives(objectives: HudSnapshot['objectives']): void {
    const signature = objectives.map(objective => `${objective.kind}:${objective.done}:${objective.total}`).join('|');
    if (signature === this.objectiveSignature) return;
    this.objectiveSignature = signature;
    this.objectives.innerHTML = objectives.map(objective => `<span class="objective ${objective.done >= objective.total ? 'is-complete' : ''}" data-objective="${objective.kind}"><span class="objective-dot"></span>${OBJECTIVE_NAMES[objective.kind]} <strong>${integer(objective.done)}<span>/${integer(objective.total)}</span></strong></span>`).join('');
  }

  private updateJourney(): void {
    this.journey.hidden = this.root.dataset.screen === 'final';
    const signature = `${this.roomIndex}|${this.tokens.join()}|${this.amulets.join()}|${this.results.map(result => `${result.id}:${result.reason}`).join()}|${this.root.dataset.screen}`;
    if (signature === this.journeySignature) return;
    this.journeySignature = signature;
    this.journey.innerHTML = ROOMS.map((room, index) => {
      const earned = this.tokens.includes(room.id);
      const current = index === this.roomIndex;
      const failed = this.results.some(result => result.id === room.id && result.reason !== 'success');
      const product = AMULET_PRODUCTS.find(p => p.id === room.id)!;
      const status = earned ? `${product.name} · закрыто` : failed ? 'Комната не закрыта' : this.amulets.includes(room.id) ? 'Модуль получен · босс активен' : product.name;
      return `<div class="journey-step ${earned ? 'is-earned' : ''} ${current ? 'is-current' : ''} ${failed ? 'is-failed' : ''}" role="listitem" data-testid="token-${room.id}" data-token-slot="${room.id}" data-earned="${earned}"><span class="journey-index">0${index + 1}</span><span class="journey-copy"><strong>${room.title}</strong><small>${status}</small></span><span class="journey-token" aria-label="${earned ? 'Комната пройдена' : 'Комната не пройдена'}">${icon(earned ? 'check' : 'token')}</span></div>`;
    }).join('');
  }

  private element(selector: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`GameUI element missing: ${selector}`);
    return element;
  }

  private setText(element: HTMLElement, value: string): void {
    if (element.textContent !== value) element.textContent = value;
  }
}
