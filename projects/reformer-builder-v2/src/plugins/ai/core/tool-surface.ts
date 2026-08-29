/**
 * Мера поверхности инструментов: сколько символов уходит в КАЖДЫЙ шаг хода.
 *
 * Функция вынесена из теста (`./tool-surface.test.ts`) потому, что у неё появился второй
 * читатель: с проекцией команд в инструменты (`./command-tools`) поверхность перестала быть
 * известной на сборке. Набор встроенных инструментов статичен и меряется тестом; набор
 * команд с блоком `agent` зависит от того, какие плагины включены, и известен только в
 * рантайме — значит, мерить его надо там же, где он собирается.
 *
 * Считается ровно то, что провайдер кладёт в определение инструмента: `name`, `description`,
 * `inputSchema`. Сериализация — `JSON.stringify` всего набора: она включает разделители и
 * кавычки, то есть считает то же, что реально уходит по проводу, а не сумму «чистых» строк.
 *
 * @module plugins/ai/core/tool-surface
 */

import type { AgentTool } from './types';

/** То, что провайдер отдаёт модели про один инструмент. */
interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: object;
}

/**
 * Размер поверхности набора в символах.
 *
 * @param tools - Инструменты, которые уйдут модели в этом ходе.
 */
export function measureToolSurface(tools: readonly AgentTool[]): number {
  const definitions: ToolDefinition[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
  return JSON.stringify(definitions).length;
}
