/**
 * List — chrome-less display-список для renderer-json (`$component(List)`).
 *
 * Чистая презентация: элементы приходят **уже отрендеренными** в пропе `items`, List лишь
 * оборачивает их в контейнер со списочным оформлением — без add/remove/карточек. Итерацию,
 * подписку на модель и кэш поддеревьев делает вызывающая сторона (рендерер), поэтому компонент
 * не зависит ни от какого рендерера и тестируется на фейковых `items` вообще без формы.
 * Дисплей vs редактирование = выбор компонента (ср. {@link FormArray}).
 */
import { Fragment, type ElementType } from 'react';
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
  return (
    <As role="list" data-slot="list" data-testid={testId} className={cn('space-y-2', className)}>
      {items.map((it) => (
        <Fragment key={it.key}>{it.children}</Fragment>
      ))}
    </As>
  );
}
