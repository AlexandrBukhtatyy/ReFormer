/**
 * Семантическая раскладка → Tailwind-классы.
 *
 * Граница, ради которой модуль существует: модель оперирует смыслом («в строку», «две колонки»,
 * «просторнее»), а конкретные токены знает редактор. Иначе AI-слой оказался бы завязан на текущую
 * UI-реализацию, и смена кита или переход с Tailwind ломали бы промпты и золотые тесты.
 *
 * @module reformer-builder/agent/core/layout
 */

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

/** Токены, которыми владеет раскладка: только они переписываются, остальные классы сохраняются. */
function isLayoutToken(token: string): boolean {
  return (
    token === 'flex' ||
    token === 'flex-col' ||
    token === 'flex-row' ||
    token === 'grid' ||
    /^grid-cols-\d+$/.test(token) ||
    /^gap-\d+$/.test(token) ||
    /^space-[xy]-\d+$/.test(token)
  );
}

/** Токены оси, выведенные из уже стоящих классов (когда ось менять не просили). */
function keepAxis(tokens: readonly string[]): string[] {
  if (tokens.includes('grid')) {
    return ['grid', tokens.find((t) => /^grid-cols-\d+$/.test(t)) ?? 'grid-cols-2'];
  }
  if (tokens.includes('flex') && !tokens.includes('flex-col')) return ['flex'];
  return ['flex', 'flex-col'];
}

/**
 * Собрать `className` контейнера. Не-раскладочные классы исходной строки сохраняются: агент правит
 * раскладку, а не оформление, и не должен затирать то, что пользователь настроил руками.
 *
 * @param params - Семантика раскладки.
 * @param existing - Текущий `className` узла (для правки на месте).
 */
export function layoutClassName(params: LayoutParams, existing = ''): string {
  const tokens = existing.split(/\s+/).filter(Boolean);
  const kept = tokens.filter((t) => !isLayoutToken(t));

  const axis =
    params.columns && params.columns >= 2
      ? ['grid', `grid-cols-${params.columns}`]
      : params.direction === 'row'
        ? ['flex']
        : params.direction === 'column'
          ? ['flex', 'flex-col']
          : keepAxis(tokens);

  const gap = params.gap
    ? GAP_CLASS[params.gap]
    : (tokens.find((t) => /^gap-\d+$/.test(t)) ?? GAP_CLASS.md);

  return [...kept, ...axis, gap].join(' ');
}
