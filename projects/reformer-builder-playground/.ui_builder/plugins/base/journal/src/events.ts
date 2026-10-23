/**
 * Вид «События» журнала — чистая часть: порядок строк, время, счёт по уровням.
 *
 * ## Новые — сверху
 *
 * Служба отдаёт записи в порядке поступления, а лента показывает их в обратном. Нижний док
 * низкий, и свежая запись, появившаяся под краем, была бы не видна без прокрутки — а ради неё
 * журнал и открывают. Прокручивать к низу при каждой записи значило бы отнимать у человека
 * то место, которое он читает.
 *
 * @module plugins/base/journal/events
 */

import type { LogEntry, LogLevel } from '@reformer/builder-plugin-api';

/** Записи для показа: от новой к старой. Исходный снимок службы не трогается. */
export function newestFirst(entries: readonly LogEntry[]): readonly LogEntry[] {
  return [...entries].reverse();
}

/** Сколько записей каждого уровня. */
export type LevelCounts = Readonly<Record<LogLevel, number>>;

/** Счёт по уровням — для числа и тона на переключателе вида. */
export function countLevels(entries: readonly LogEntry[]): LevelCounts {
  let error = 0;
  let warning = 0;
  let info = 0;
  for (const entry of entries) {
    if (entry.level === 'error') error += 1;
    else if (entry.level === 'warning') warning += 1;
    else info += 1;
  }
  return { error, warning, info };
}

/**
 * Время записи в локали интерфейса: часы, минуты, секунды.
 *
 * Без даты: журнал — память сессии, и день у всех записей один. Секунды нужны — события
 * одной минуты различают именно по ним. Локаль, которую среда не знает, — не повод падать:
 * берётся локаль среды.
 */
export function timeFormatter(locale: string): (time: number) => string {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat(locale === '' ? undefined : locale, { timeStyle: 'medium' });
  } catch {
    format = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });
  }
  return (time) => format.format(time);
}
