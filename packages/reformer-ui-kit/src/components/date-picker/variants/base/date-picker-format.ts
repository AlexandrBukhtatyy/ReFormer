import { format, isSameDay, type Locale } from 'date-fns';
import type { useI18n } from '@reformer/core/react';

type I18n = ReturnType<typeof useI18n>;

/** Стиль `Intl` для даты без явного формата: `long` — «16 октября 2026 г.», `medium` — «16 окт. 2026 г.». */
export type DateTextStyle = 'long' | 'medium';

/**
 * Подпись даты: формат `date-fns` (с объектом локали `dateLocale`, если он есть) либо, без
 * формата, — по правилам языка локали через `Intl`.
 *
 * @param value - Дата.
 * @param pattern - Токены `date-fns` (`dd.MM.yyyy`); `undefined` — подпись по правилам языка.
 * @param i18n - Ручка локали из `useI18n()`.
 * @param style - Стиль `Intl` для подписи без формата.
 */
export function formatDate(
  value: Date,
  pattern: string | undefined,
  i18n: I18n,
  style: DateTextStyle = 'long'
): string {
  if (pattern === undefined) return i18n.date(value, { dateStyle: style });
  const locale = i18n.locale.dateLocale as Locale | undefined;
  return format(value, pattern, locale ? { locale } : undefined);
}

/**
 * Подпись периода: «начало – конец», однодневный период — одной датой.
 *
 * @param from - Начало периода.
 * @param to - Конец периода.
 * @param pattern - Токены `date-fns`; `undefined` — подпись по правилам языка.
 * @param i18n - Ручка локали из `useI18n()`.
 */
export function formatDateRange(
  from: Date,
  to: Date,
  pattern: string | undefined,
  i18n: I18n
): string {
  const start = formatDate(from, pattern, i18n);
  return isSameDay(from, to) ? start : `${start} – ${formatDate(to, pattern, i18n)}`;
}
