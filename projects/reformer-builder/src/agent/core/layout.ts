/**
 * Семантическая раскладка → Tailwind-классы.
 *
 * Граница, ради которой модуль существует: модель оперирует смыслом («в строку», «две колонки»,
 * «просторнее»), а конкретные токены знает редактор. Иначе AI-слой оказался бы завязан на текущую
 * UI-реализацию, и смена кита или переход с Tailwind ломали бы промпты и золотые тесты.
 *
 * @module reformer-builder/agent/core/layout
 */

import { hasVariant, isAxisToken, isGapToken } from '../../lib/tw-tokens';

/** Семантические параметры раскладки контейнера. */
export interface LayoutParams {
  /** Ось: в строку или в столбец. */
  direction?: 'row' | 'column';
  /** Сетка в N колонок; имеет приоритет над `direction`. */
  columns?: number;
  /** Расстояние между детьми. */
  gap?: 'none' | 'sm' | 'md' | 'lg';
}

const GAP_CLASS: Record<NonNullable<LayoutParams['gap']>, string> = {
  none: 'gap-0',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
};

/**
 * Собрать `className` контейнера. Не-раскладочные классы исходной строки сохраняются: агент правит
 * раскладку, а не оформление, и не должен затирать то, что пользователь настроил руками.
 *
 * Брейкпоинт-варианты (`md:grid-cols-2`, `md:flex-row`) — тоже раскладка, а не оформление:
 * - ось НЕ просили менять → адаптив сохраняется как есть; раньше ось пересобиралась из голых
 *   токенов, и правка одной лишь плотности молча роняла `md:grid-cols-2`;
 * - ось просили сменить → адаптив снимается вместе с остальными оси-токенами. Иначе на широком
 *   экране продолжал бы действовать старый вариант, и команда выглядела бы как не сработавшая.
 *
 * @param params - Семантика раскладки.
 * @param existing - Текущий `className` узла (для правки на месте).
 */
export function layoutClassName(params: LayoutParams, existing = ''): string {
  const tokens = existing.split(/\s+/).filter(Boolean);

  const explicitAxis =
    params.columns && params.columns >= 2
      ? ['grid', `grid-cols-${params.columns}`]
      : params.direction === 'row'
        ? ['flex']
        : params.direction === 'column'
          ? ['flex', 'flex-col']
          : undefined;

  // Плотность живёт одним безвариантным `gap-*`; адаптивные `md:gap-*` — оформление и остаются,
  // пока плотность не меняют явно.
  const gap = params.gap
    ? GAP_CLASS[params.gap]
    : (tokens.find((t) => /^gap-\d+$/.test(t)) ?? GAP_CLASS.md);
  const dropGap = (t: string) => isGapToken(t) && (hasVariant(t) ? Boolean(params.gap) : true);

  const kept = tokens.filter((t) => !isAxisToken(t) && !dropGap(t));
  const axis = explicitAxis ?? keepAxis(tokens);

  return [...kept, ...axis, gap].join(' ');
}

/**
 * Оси-токены, которые уже стоят на узле (когда ось менять не просили) — в порядке записи, вместе
 * с брейкпоинт-вариантами. Пусто — узел без раскладки: даём вертикальный flex, как раньше.
 */
function keepAxis(tokens: readonly string[]): string[] {
  const axis = tokens.filter(isAxisToken);
  return axis.length ? axis : ['flex', 'flex-col'];
}
