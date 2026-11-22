/**
 * Порт для отчётов `report_issue` — единственного места, где сервер что-то ЗАПИСЫВАЕТ.
 *
 * Носитель принципиально разный: в CLI это файл в каталоге проекта, в браузере писать
 * некуда — там либо хранилище вкладки, либо ничего. Поэтому порт говорит не «путь», а
 * «место» строкой: она попадает в ответ инструмента как есть и должна читаться человеком.
 *
 * @module @reformer/mcp/contract/issues
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
