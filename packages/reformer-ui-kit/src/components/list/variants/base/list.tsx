/**
 * List — стилизованная обёртка display-списка для renderer-json (`$component(List)`).
 *
 * Итерацию массива и рендер элементов делает сам рендерер (renderer-react `ModelArrayComponentRenderer`
 * по узлу `{ array, item, component: '$component(List)' }`), а List лишь оборачивает готовые `children`
 * в контейнер со списочным оформлением — без add/remove/карточек. Так дисплей-список отличается от
 * редактируемого массива только выбором компонента.
 *
 * Пропсы, инъектируемые рендерером (`array`/`item`/`initialValue`/`fieldWrapper`), List не использует
 * (он рендерит уже готовые элементы) и НЕ прокидывает в DOM. Явно поддерживает `className`/`testId`/`as`.
 */
import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ListProps {
  /** Готовые элементы, отрисованные рендерером массива. */
  children?: ReactNode;
  /** CSS-класс контейнера (мержится поверх дефолтного `space-y-2`). */
  className?: string;
  /** `data-testid` контейнера. */
  testId?: string;
  /** Тег/компонент обёртки. По умолчанию `'div'`. */
  as?: ElementType;
  /** Инъекция рендерера (не используется List). */
  array?: unknown;
  /** Инъекция рендерера (не используется List). */
  item?: unknown;
  /** Инъекция рендерера (не используется List). */
  initialValue?: unknown;
  /** Инъекция рендерера (не используется List). */
  fieldWrapper?: unknown;
}

export function List({ children, className, testId, as: As = 'div' }: ListProps) {
  return (
    <As role="list" data-slot="list" data-testid={testId} className={cn('space-y-2', className)}>
      {children}
    </As>
  );
}
