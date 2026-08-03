/**
 * List — chrome-less display-список для renderer-json (`$component(List)`).
 *
 * Итерацию массива модели даёт хук `useModelArrayItems` из `@reformer/renderer-react` (подписка на
 * структуру + кэш + рендер поддеревьев). List лишь оборачивает готовые элементы в контейнер со
 * списочным оформлением — без add/remove/карточек. Дисплей vs редактирование = выбор компонента
 * (ср. {@link FormArray}). `initialValue` не используется (добавлять нечего).
 */
import type { ComponentType, ElementType } from 'react';
import {
  useModelArrayItems,
  type RenderModelArrayControl,
  type RenderNode,
  type FieldWrapperProps,
} from '@reformer/renderer-react';
import { cn } from '@/lib/utils';

export interface ListProps {
  /** Контрол массива модели (инъектится рендерером). */
  array: RenderModelArrayControl;
  /** Фабрика поддерева элемента (инъектится рендерером). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: (itemModel: any) => RenderNode<unknown>;
  /** Обёртка полей (инъектится рендерером). */
  fieldWrapper?: ComponentType<FieldWrapperProps>;
  /** CSS-класс контейнера (мержится поверх дефолтного `space-y-2`). */
  className?: string;
  /** `data-testid` контейнера. */
  testId?: string;
  /** Тег/компонент обёртки. По умолчанию `'div'`. */
  as?: ElementType;
}

export function List({ array, item, fieldWrapper, className, testId, as: As = 'div' }: ListProps) {
  const items = useModelArrayItems(array, item, fieldWrapper);
  return (
    <As role="list" data-slot="list" data-testid={testId} className={cn('space-y-2', className)}>
      {items.map((it) => it.element)}
    </As>
  );
}
