import { AMULET_PRODUCTS, amuletDataUrl, pakDataUrl } from '../assets/pakArt';
import type { RoomId } from '../core/types';
import type { PakAssist } from '../core/pak';

/** The HUD and scene use the same pixel artwork; only earned modules light up. */
export class PakAssembly {
  private earned: RoomId[] = [];
  private signature = '';
  constructor(private readonly host: HTMLElement) {
    host.innerHTML = `<div class="pak-sockets" role="list" aria-label="Модули ПАК">${AMULET_PRODUCTS.map(product =>
      `<span class="pak-slot" role="listitem" data-amulet-slot="${product.id}" data-earned="false"><img alt="" width="40" height="40"></span>`
    ).join('')}</div><img class="pak-rack" alt="Корпус ПАК-AI" width="96" height="168"><span class="pak-copy"><b data-pak-count>ПАК 0/4</b><small data-pak-state>Сборка</small></span><span class="pak-announcement" role="status" aria-live="polite"></span>`;
    this.update([], 'idle');
  }
  update(amulets: readonly RoomId[], phase: PakAssist['phase']): void {
    const signature = `${amulets.join()}|${phase}`;
    if (signature === this.signature) return;
    this.signature = signature;
    const added = AMULET_PRODUCTS.filter(product => amulets.includes(product.id) && !this.earned.includes(product.id));
    for (const product of AMULET_PRODUCTS) {
      const slot = this.host.querySelector<HTMLElement>(`[data-amulet-slot="${product.id}"]`)!;
      const earned = amulets.includes(product.id);
      slot.dataset.earned = String(earned);
      slot.title = `${product.name} — ${earned ? 'модуль установлен' : 'модуль не получен'}`;
      slot.setAttribute('aria-label', slot.title);
      slot.querySelector('img')!.src = amuletDataUrl(product.id, earned);
      if (added.some(item => item.id === product.id)) {
        slot.classList.remove('is-new');
        void slot.offsetWidth;
        slot.classList.add('is-new');
      } else if (!earned) slot.classList.remove('is-new');
    }
    const count = AMULET_PRODUCTS.filter(product => amulets.includes(product.id)).length;
    const ready = count === 4;
    const rack = this.host.querySelector<HTMLImageElement>('.pak-rack')!;
    rack.src = pakDataUrl(amulets);
    rack.alt = ready ? 'Рабочий ПАК-AI — все модули установлены' : `Корпус ПАК-AI — ${count} из 4 модулей`;
    this.host.dataset.ready = String(ready);
    this.host.dataset.phase = phase;
    this.host.querySelector('[data-pak-count]')!.textContent = `ПАК ${count}/4`;
    this.host.querySelector('[data-pak-state]')!.textContent = phase === 'warning' || phase === 'falling' ? 'На помощь!' : phase === 'impact' ? 'Удар ПАК' : ready ? 'В работе' : 'Сборка';
    if (added.length) this.host.querySelector('.pak-announcement')!.textContent = `${added.map(p => p.name).join(', ')}: модуль установлен.${ready ? ' ПАК собран и готов помочь с боссом.' : ''}`;
    else if (!count) this.host.querySelector('.pak-announcement')!.textContent = '';
    this.earned = [...amulets];
  }
}
