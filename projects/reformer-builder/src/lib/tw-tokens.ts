/**
 * Разбор Tailwind-токенов в `className`: отделить ВАРИАНТЫ (`md:`, `hover:`, `dark:`) от самой
 * утилиты.
 *
 * Зачем отдельный модуль: раскладку узла билдер читает из `className` в трёх местах — ось
 * контейнера для drag-раскладки (`model/node-kind`), нормализация к flex (`model/mutate`) и
 * семантическая раскладка агента (`agent/core/layout`). Все три раньше сравнивали токен целиком,
 * поэтому адаптивный `md:grid-cols-2` был для них «оформлением»: узел считался вертикальным, а при
 * переключении оси префиксованный грид-класс оставался мусором поверх flex.
 *
 * Модуль — ЛИСТ графа зависимостей (ничего не импортирует из `model`/`catalog`).
 *
 * @module reformer-builder/lib/tw-tokens
 */

/**
 * Утилита без вариантов: `md:grid-cols-2` → `grid-cols-2`, `flex` → `flex`.
 *
 * Двоеточия ВНУТРИ произвольных значений разделителями не считаются, иначе
 * `md:[grid-template-columns:1fr_2fr]` распалось бы по двоеточию в CSS-свойстве, а `[&:hover]:flex`
 * — по псевдоклассу в селекторе. Поэтому режем только на верхнем уровне, вне `[]` и `()`.
 */
export function baseUtility(token: string): string {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ':' && depth === 0) start = i + 1;
  }
  return token.slice(start);
}

/**
 * Варианты токена в порядке записи: `dark:md:flex` → `['dark', 'md']`. Пусто — утилита без
 * префиксов. Режется по тем же правилам, что {@link baseUtility}.
 */
export function variantsOf(token: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ':' && depth === 0) {
      out.push(token.slice(start, i));
      start = i + 1;
    }
  }
  return out;
}

/** Есть ли у токена вариант-префикс (`md:`, `hover:`, `dark:md:`). */
export function hasVariant(token: string): boolean {
  return baseUtility(token) !== token;
}

/**
 * Число колонок у токена `grid-cols-N` (с вариантами или без); `undefined` — токен не про колонки.
 * Произвольные значения (`grid-cols-[1fr_2fr]`) числом не выражаются — тоже `undefined`.
 */
export function gridColumnsOf(token: string): number | undefined {
  const m = /^grid-cols-(\d+)$/.exec(baseUtility(token));
  return m ? Number(m[1]) : undefined;
}

/**
 * Токены, задающие ОСЬ раскладки: `flex`/`grid`, направление flex и грид-колонки — в любом
 * варианте (`md:flex-row` тоже ось). Именно их переписывает явная смена раскладки; всё остальное
 * (`gap-*`, цвета, рамки) — оформление и сохраняется.
 */
export function isAxisToken(token: string): boolean {
  const base = baseUtility(token);
  return (
    base === 'flex' ||
    base === 'grid' ||
    base === 'inline-flex' ||
    base === 'inline-grid' ||
    base === 'flex-row' ||
    base === 'flex-row-reverse' ||
    base === 'flex-col' ||
    base === 'flex-col-reverse' ||
    /^grid-(cols|rows)-/.test(base)
  );
}

/** Токены плотности: `gap-*` и `space-[xy]-*` в любом варианте. */
export function isGapToken(token: string): boolean {
  const base = baseUtility(token);
  return /^gap(-[xy])?-/.test(base) || /^space-[xy]-/.test(base);
}
