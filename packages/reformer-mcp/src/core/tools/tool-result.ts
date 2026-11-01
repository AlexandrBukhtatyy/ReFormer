/**
 * Ответ инструмента на неверный вызов.
 *
 * @module reformer-mcp/core/tools/tool-result
 */

/** Ответ инструмента: текст и, у неудачного вызова, `isError`. */
export interface ToolTextResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Неверный вызов: обязательный аргумент не передан или не того вида.
 *
 * `isError: true` — по спецификации MCP (2025-11-25) ошибка проверки входа есть ошибка выполнения
 * инструмента: клиент видит неудачу (Inspector CLI — exit 5, `&&`-цепочка CI останавливается),
 * модель — что вызов надо поправить. Раньше такие ответы приходили успешными, и отличить «нет
 * аргумента» от «вот ответ» можно было только чтением текста (калибровка, smoke S12).
 */
export function invalidCall(message: string): ToolTextResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}
