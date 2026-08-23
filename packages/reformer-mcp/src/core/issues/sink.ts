/**
 * Порт для отчётов `report_issue` — единственного места, где сервер что-то ЗАПИСЫВАЕТ.
 *
 * Носитель принципиально разный: в CLI это файл в каталоге проекта, в браузере писать
 * некуда — там либо хранилище вкладки, либо ничего. Поэтому порт говорит не «путь», а
 * «место» строкой: она попадает в ответ инструмента как есть и должна читаться человеком.
 *
 * Именование файла (штамп времени + короткий слаг) — знание ядра, а не носителя: от него
 * зависит, как отчёты читаются списком, и одинаково полезно в любой среде.
 *
 * @module reformer-mcp/core/issues/sink
 */

export interface IssueSink {
  /**
   * Сохранить отчёт под именем `baseName` (без расширения). Возвращает описание места, куда
   * он лёг. Бросает при неудаче — вызывающий превращает это в дружелюбный текст.
   */
  write(baseName: string, payload: string): string;
  /** Куда пишет — для сообщения, когда запись не удалась. */
  location(): string;
}

/** Сток-заглушка: среда, где сохранять отчёты некуда. */
export const UNAVAILABLE_ISSUE_SINK: IssueSink = {
  write() {
    throw new Error('issue reports are not available in this environment');
  },
  location: () => 'unavailable',
};

/** Filesystem-safe ISO stamp: `2026-08-22T10-14-05-123Z` (no `:` — Windows forbids it). */
export function fileStamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

/** Short kebab tail for the file name, so a directory listing is readable. */
export function slugifyIssue(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return slug || 'issue';
}
