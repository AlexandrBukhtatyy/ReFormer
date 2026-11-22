/**
 * Мера поверхности инструментов: сколько символов уходит в КАЖДЫЙ шаг хода.
 *
 * Функция вынесена из теста храповика потому, что у неё появился второй читатель: с проекцией
 * команд в инструменты поверхность перестала быть известной на сборке. Набор встроенных инструментов статичен и меряется тестом; набор
 * команд с блоком `agent` зависит от того, какие плагины включены, и известен только в
 * рантайме — значит, мерить его надо там же, где он собирается.
 *
 * Считается ровно то, что провайдер кладёт в определение инструмента: `name`, `description`,
 * `inputSchema`. Сериализация — `JSON.stringify` всего набора: она включает разделители и
 * кавычки, то есть считает то же, что реально уходит по проводу, а не сумму «чистых» строк.
 *
 * @module @reformer/builder-toolkit/assistant/tool-surface
 */

/** Бюджет имени инструмента (символы). Проверяется тестом, а не в рантайме. */
export const TOOL_NAME_BUDGET = 30;

/** Бюджет описания инструмента (символы). Проверяется тестом, а не в рантайме. */
export const TOOL_DESCRIPTION_BUDGET = 500;

/** То, что провайдер отдаёт модели про один инструмент. Лишние поля инструмента не считаются. */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: object;
}

/**
 * Размер поверхности набора в символах.
 *
 * @param tools - Инструменты, которые уйдут модели в этом ходе.
 */
export function measureToolSurface(tools: readonly ToolDefinition[]): number {
  const definitions: ToolDefinition[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
  return JSON.stringify(definitions).length;
}
