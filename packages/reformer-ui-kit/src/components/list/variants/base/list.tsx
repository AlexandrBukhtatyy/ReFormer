/**
 * List — chrome-less display-список для renderer-json (`$component(List)`).
 *
 * Чистая презентация: элементы приходят **уже отрендеренными** в пропе `items`, List лишь
 * оборачивает их в контейнер со списочным оформлением — без add/remove/карточек. Контейнер —
 * `role="list"`, каждый элемент — в обёртке `role="listitem"` (`li` при `as="ul"`/`"ol"`).
 * Итерацию, подписку на модель и кэш поддеревьев делает вызывающая сторона (рендерер), поэтому
 * компонент не зависит ни от какого рендерера и тестируется на фейковых `items` вообще без формы.
 * Дисплей vs редактирование = выбор компонента (ср. {@link FieldArray}).
 */
import type { ElementType } from 'react';
import type { ArrayItemSlot } from '@/lib/array-slot';
import { cn } from '@/lib/utils';

export interface ListProps {
  /** Отрендеренные элементы массива (инъектится рендерером). */
  items?: ArrayItemSlot[];
  /** CSS-класс контейнера (мержится поверх дефолтного `space-y-2`). */
  className?: string;
  /** `data-testid` контейнера. */
  testId?: string;
  /** Тег/компонент обёртки. По умолчанию `'div'`. */
  as?: ElementType;
}

export function List({ items = [], className, testId, as: As = 'div' }: ListProps) {
  // Каждый элемент — в своей обёртке-элементе списка: у `role="list"` без `listitem` скринридер
  // объявлял пустой список. Для `ul`/`ol` обёртка — `li`, иначе — `div` с `role="listitem"`.
  const nativeList = As === 'ul' || As === 'ol';
  return (
    <As role="list" data-slot="list" data-testid={testId} className={cn('space-y-2', className)}>
      {items.map((it) =>
        nativeList ? (
          <li key={it.key} data-slot="list-item">
            {it.children}
          </li>
        ) : (
          <div key={it.key} role="listitem" data-slot="list-item">
            {it.children}
          </div>
        )
      )}
    </As>
  );
}
