import { AMULET_PRODUCTS, amuletDataUrl } from '../assets/pakArt';
import passportReference from '../assets/ai-maturity-passport.png';
import { DIFFICULTIES } from '../core/difficulty';
import type { RegisteredPlayer } from '../core/registration';
import type { RoomId, RunState } from '../core/types';

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const number = (value: number) => Math.max(0, Math.floor(value)).toLocaleString('ru-RU');
// The supplied paper layout orders its symbols differently from the room journey.
const PAPER_MODULES: RoomId[] = ['production', 'perimeter', 'office', 'server'];

/** Paper artwork with actual run progress; the printed sample number is never assigned to a player. */
export function renderPassport(run: RunState, player: RegisteredPlayer | null | undefined, runId: string, _hero: string): string {
  const completed = AMULET_PRODUCTS.filter(product => run.results.some(result => result.id === product.id && result.reason === 'success'));
  const released = completed.length === 4;
  const modules = AMULET_PRODUCTS.filter(product => run.amulets.includes(product.id));
  const fullPak = modules.length === 4;
  const savedProd = completed.some(product => product.id === 'production');
  const detail = released ? 'Все комнаты пройдены. ПАК-AI собран, прод спасён.'
    : fullPak ? 'ПАК собран. Следующая цель — спасти прод.' : 'Продолжите собирать модули в следующей смене.';
  return `<section class="passport ${released ? 'is-release' : 'is-partial'}" aria-labelledby="passport-heading" data-completed="${completed.length}">
    <header class="passport-header">
      <div><span class="passport-eyebrow">CTO НА СТРАЖЕ ИНФРАСТРУКТУРЫ</span><h2 id="passport-heading">Итоги смены</h2></div>
      <div class="passport-serial"><span>${escape(DIFFICULTIES[run.difficulty].label)}</span><small>RUN ${escape(runId.slice(0, 8).toUpperCase())}</small></div>
    </header>
    <div class="passport-summary">
      <div class="passport-paper" aria-label="Ваш паспорт ИИ-зрелости">
        <img class="passport-paper-art" src="${passportReference}" alt="Макет бумажного паспорта ИИ-зрелости К2 НейроТех" width="1482" height="870">
        <output class="passport-paper-number" data-paper-passport-display aria-label="Сохранённый номер паспорта">№ —</output>
        ${released ? '' : '<span class="passport-paper-level">Смена завершена</span>'}
        ${PAPER_MODULES.map((id, index) => {
          const earned = run.amulets.includes(id);
          const closed = completed.some(room => room.id === id);
          return `${earned ? '' : `<i class="passport-paper-slot is-missing" data-paper-module="${id}" style="left:${37.2 + index * 15}%" aria-hidden="true"></i>`}
            ${closed ? '' : `<i class="passport-paper-star" data-paper-room="${id}" style="left:${41.85 + index * 15}%" aria-hidden="true"></i>`}`;
        }).join('')}
      </div>
      <div class="passport-identity">
        <span class="passport-eyebrow">ВАШ РЕЗУЛЬТАТ</span>
        <strong class="passport-name" title="${escape(player?.firstName || 'Участник')}">${escape(player?.firstName || 'Участник')}</strong>
        <span class="passport-company" title="${escape(player?.company || '')}">${escape(player?.company || '')}</span>
        <div class="passport-level"><strong>${released ? 'CTO-легенда!' : 'Смена завершена'}</strong><span>${completed.length}/4</span></div>
        <div class="passport-progress" role="img" aria-label="Пройдено ${completed.length} из 4 комнат">${AMULET_PRODUCTS.map(product => `<i class="${completed.some(p => p.id === product.id) ? 'is-complete' : ''}"></i>`).join('')}</div>
        <span class="passport-stamp">${released ? 'RELEASE!' : `${completed.length} из 4 комнат пройдено`}</span>
        <p class="passport-description">${detail}</p>
        <div class="passport-metrics">
          <div class="passport-budget"><span>БЮДЖЕТ</span><strong data-passport-budget>${number(run.budget)} <small>₽</small></strong></div>
          <div><span>ПОЖАРОВ ПОТУШЕНО</span><strong data-passport-fires>${number(run.firesExtinguished).padStart(2, '0')}</strong></div>
          <div><span>ПРОД СПАСЁН</span><strong data-passport-prod>${savedProd ? '01' : '00'}</strong></div>
          <div><span>МОДУЛИ ПАК-AI</span><strong>${modules.length}<small> / 4</small></strong></div>
        </div>
      </div>
    </div>
    <section class="passport-achievements" aria-label="Достижения">
      <div class="passport-badges">${AMULET_PRODUCTS.map(product => {
        const earned = run.amulets.includes(product.id);
        const closed = completed.some(room => room.id === product.id);
        return `<article class="passport-badge ${earned ? 'is-earned' : 'is-missing'}" data-badge="${product.id}" data-earned="${earned}" data-closed="${closed}" style="--badge-color:${product.color}">
          <img src="${amuletDataUrl(product.id, earned)}" alt="" width="40" height="40"><h4>${product.name}</h4>
          <small><span class="passport-module-status">${earned ? '✓ МОДУЛЬ ПОЛУЧЕН' : 'МОДУЛЬ НЕ ПОЛУЧЕН'}</span><span class="passport-room-status">${closed ? '✓ КОМНАТА ЗАКРЫТА' : 'КОМНАТА НЕ ЗАКРЫТА'}</span></small>
        </article>`;
      }).join('')}</div>
    </section>
    <footer class="passport-footer">
      <form class="passport-number-form" novalidate aria-label="Привязка бумажного паспорта">
        <div class="passport-number-copy"><label for="paper-passport-number">Введите номер вашего паспорта ИИ-зрелости</label></div>
        <input id="paper-passport-number" name="passportNumber" type="text" inputmode="numeric" maxlength="20" autocomplete="off" spellcheck="false" placeholder="Например, 0017" aria-describedby="paper-passport-status">
        <button type="submit" class="passport-number-save" disabled>Сохранить номер</button>
        <p id="paper-passport-status" class="passport-number-status" role="status" aria-live="polite">Номер можно сохранить после записи результата.</p>
      </form>
      <div class="passport-actions"><button type="button" class="primary-button" data-action="leaderboard">Перейти к лидерборду <span aria-hidden="true">↗</span></button><button type="button" class="passport-restart" data-action="restart">Ещё одна смена</button><button type="button" class="text-button" data-action="menu">В меню</button></div>
      <p class="passport-save-status" role="status" aria-live="polite">Итоги этой смены</p>
    </footer>
  </section>`;
}
