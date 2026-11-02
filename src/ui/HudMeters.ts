export type MeterKey = 'sla' | 'ogn' | 'energy';
export type MeterValues = Record<MeterKey, number>;

const NOTES: Record<MeterKey, [string, string]> = {
  sla: ['0% — провал комнаты', 'КРИТИЧЕСКИ · избегай урона'],
  ogn: ['Растёт от пожаров · 100% — провал', 'ОПАСНО · туши очаги'],
  energy: ['E — тушить · кофе +60', 'МАЛО ЭНЕРГИИ · подбери кофе'],
};

export function meterState(key: MeterKey, raw: number) {
  const value = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
  const count = key === 'sla' ? 5 : 4;
  const critical = key === 'ogn' ? value >= 75 : value <= 25;
  const fills = Array.from({ length: count }, (_, index) =>
    Number((Math.max(0, Math.min(1, value * count / 100 - index)) * 100).toFixed(4)));
  return { value, fills, critical, label: `${Math.ceil(value)}%`, note: NOTES[key][critical ? 1 : 0] };
}

const HEART = 'M4 4H12V8H20V4H28V8H32V20H28V24H24V28H20V32H12V28H8V24H4V20H0V8H4Z';
let sequence = 0;

export function hudMetersMarkup(): string {
  const id = ++sequence;
  const hearts = Array.from({ length: 5 }, (_, index) => `<svg class="hud-heart" viewBox="-1 -1 34 34" aria-hidden="true"><defs><clipPath id="hud-heart-${id}-${index}"><path d="${HEART}"/></clipPath></defs><path class="heart-base" d="${HEART}"/><g clip-path="url(#hud-heart-${id}-${index})"><rect class="heart-fill" data-segment-fill x="0" y="0" width="32" height="32"/></g><path class="heart-outline" d="${HEART}"/></svg>`).join('');
  const quarters = (filled: boolean) => Array.from({ length: 4 }, () => `<span class="hud-quarter" aria-hidden="true"><span data-segment-fill style="width:${filled ? 100 : 0}%"></span></span>`).join('');
  const fire = '<svg class="hud-fire-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1C15 5 14 8 17 9L19 5C24 12 23 19 17 22C8 26-1 19 3 11L8 4C7 10 10 11 10 8C11 5 11 3 12 1Z"/><path class="fire-cutout" d="M13 12C15 16 16 18 14 21C10 23 7 19 10 16Z"/></svg>';
  return `<div class="hud-resources">
    <div class="hud-resource sla-metric" data-resource="sla" title="Пять сердец показывают запас прочности SLA. Одно сердце — 20%, а не одно попадание. При нуле комната провалена.">
      <div class="hud-resource-label"><span>SLA · ПРОЧНОСТЬ</span><strong data-value="sla">100%</strong></div>
      <div class="hud-meter hud-hearts" role="meter" aria-label="SLA — запас прочности" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" data-meter="sla">${hearts}</div>
      <span class="hud-note" data-meter-note="sla">${NOTES.sla[0]}</span>
    </div>
    <div class="hud-resource fire-metric" data-resource="ogn" title="Угроза накапливается от активных пожаров. Тушение замедляет или останавливает дальнейший рост, но не снижает накопленное значение. При 100% комната провалена.">
      <div class="hud-resource-label"><span>${fire}УГРОЗА ПОЖАРА</span><strong data-value="ogn">0%</strong></div>
      <div class="hud-meter hud-quarters" role="meter" aria-label="Угроза пожара" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-meter="ogn">${quarters(false)}</div>
      <span class="hud-note" data-meter-note="ogn">${NOTES.ogn[0]}</span>
    </div>
    <div class="hud-resource energy-metric" data-resource="energy" title="Энергия расходуется на тушение при удержании E. Кофе восстанавливает 60 единиц. Движение и ремонт не расходуют энергию.">
      <div class="hud-resource-label"><span>ЭНЕРГИЯ</span><strong data-value="energy">100%</strong></div>
      <div class="hud-meter hud-quarters hud-battery" role="meter" aria-label="Энергия на тушение" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" data-meter="energy">${quarters(true)}</div>
      <span class="hud-note" data-meter-note="energy">${NOTES.energy[0]}</span>
    </div>
  </div>`;
}

export class HudMeters {
  private previous: Partial<MeterValues> = {};
  private readonly meters: Record<MeterKey, {
    card: HTMLElement; meter: HTMLElement; label: HTMLElement; note: HTMLElement;
    fills: (HTMLElement | SVGRectElement)[];
  }>;

  constructor(root: HTMLElement) {
    const element = (selector: string) => root.querySelector<HTMLElement>(selector)!;
    this.meters = Object.fromEntries((['sla', 'ogn', 'energy'] as const).map(key => {
      const meter = element(`[data-meter="${key}"]`);
      const card = element(`[data-resource="${key}"]`);
      card.addEventListener('animationend', () => card.classList.remove('hud-pulse'));
      return [key, { card, meter, label: element(`[data-value="${key}"]`),
        note: element(`[data-meter-note="${key}"]`), fills: Array.from(meter.querySelectorAll<HTMLElement | SVGRectElement>('[data-segment-fill]')) }];
    })) as typeof this.meters;
  }

  reset(): void {
    this.previous = {};
    for (const { card } of Object.values(this.meters)) card.classList.remove('hud-pulse');
    this.update({ sla: 100, ogn: 0, energy: 100 });
  }

  update(values: MeterValues): void {
    for (const key of ['sla', 'ogn', 'energy'] as const) {
      const state = meterState(key, values[key]);
      const view = this.meters[key];
      const before = this.previous[key];
      const enteringCritical = state.critical && !view.card.classList.contains('is-critical');
      view.card.classList.toggle('is-critical', state.critical);
      view.meter.classList.toggle('is-critical', state.critical);
      if (view.label.textContent !== state.label) view.label.textContent = state.label;
      if (view.note.textContent !== state.note) view.note.textContent = state.note;
      if (before !== state.value) {
        view.meter.setAttribute('aria-valuenow', String(state.value));
        view.meter.setAttribute('aria-valuetext', `${state.label}. ${state.note}`);
        state.fills.forEach((fill, index) => {
          const cell = view.fills[index];
          if (cell instanceof SVGElement) cell.setAttribute('width', String(fill * .32));
          else cell.style.width = `${fill}%`;
        });
        if (before !== undefined && (enteringCritical || key === 'sla' && state.value < before || key === 'energy' && state.value > before)) {
          view.card.classList.remove('hud-pulse');
          void view.card.offsetWidth;
          view.card.classList.add('hud-pulse');
        }
      }
      this.previous[key] = state.value;
    }
  }
}
