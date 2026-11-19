/**
 * Цвет участника — CSS-переменная `--bench-lib-<id>` из bench.module.css (светлая и тёмная тема).
 * Компоненты ставят её элементу как `--c` (`libStyle`), а стили берут `var(--c)`: так цвет задаётся
 * в одном месте, рендерится на сервере и переключается вместе с темой без JS.
 */
import type { CSSProperties } from 'react';

/** Порядок участников во всех графиках и легендах — как в таблицах отчёта. */
export const LIB_ORDER = [
  'reformer-core',
  'reformer-json',
  'formik',
  'rhf',
  'rjsf',
  'baseline',
] as const;

export const libVar = (lib: string): string => `var(--bench-lib-${lib}, var(--bench-rival))`;

/** `style` элемента участника: `--c` — его цвет. */
export const libStyle = (lib: string): CSSProperties => ({ '--c': libVar(lib) }) as CSSProperties;

/** baseline рисуется контуром (полосы) и пунктиром (линии) — не только цветом. */
export const isDashed = (lib: string): boolean => lib === 'baseline';
