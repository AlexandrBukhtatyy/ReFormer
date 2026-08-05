/**
 * Слой индикатора дропа поверх runtime-превью (`pointer-events: none`): рамка зоны `into`, линия
 * вставки `before`/`after` и чип «ряд»/«столбец» для обёрточных зон. Позиции задаёт
 * {@link paintDrop} — императивно, без ре-рендера.
 *
 * Оверлей выбран вместо `::after` на самой цели: псевдоэлементу нужен `position: relative` на
 * элементах формы, а это сделало бы их containing block для абсолютно позиционированных потомков
 * (иконки полей, поповеры).
 *
 * @module reformer-builder/canvas/PreviewOverlay
 */

import type { RefObject } from 'react';

export function PreviewOverlay({ overlayRef }: { overlayRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-20 hidden">
      <div data-part="box" className="absolute rounded-[3px]" style={{ display: 'none' }} />
      <div
        data-part="chip"
        className="absolute rounded-full bg-[var(--rb-select)] px-1.5 py-px text-[9px] font-semibold whitespace-nowrap text-[var(--rb-select-fg)] shadow-sm"
        style={{ display: 'none' }}
      />
    </div>
  );
}
