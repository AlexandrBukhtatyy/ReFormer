/**
 * Нейтральные кирпичи для стеков ReFormer Builder: то, что нужно ЛЮБОМУ стеку, какой бы
 * формат схемы и какой бы способ отрисовки он ни приносил.
 *
 * Критерий попадания сюда — не «код не знает про ReFormer», а «код нужен двум стекам» — или
 * общему плагину и вкладу стека в него: они живут в разных доменах, и делить код им, кроме
 * контракта, больше негде. Нейтральный, но нужный одному плагину модуль остаётся в нём: вынести
 * его «на будущее» значит завести контракт, которым никто не пользуется, и платить за его
 * совместимость при каждой правке.
 *
 * - **печать** — настроенный Eta для печати КОДА (без экранирования, с буквальными пробелами);
 * - **маркер происхождения** — `// @reformer-generated <hash>`: по нему доставка решает,
 *   можно ли перезаписать файл, не потеряв правку человека;
 * - **имена** — транслитерация и kebab: имена файлов и селекторов из подписей;
 * - **ассистент** — реестр инструментов модели и текст для неё: страницы файла со строками,
 *   ответ по целым строкам в бюджете, похожие имена для подсказки, мера поверхности
 *   инструментов. Нужны и ассистенту, и инструментам стека в нём.
 *
 * @module @reformer/builder-toolkit
 */

export { registerPartial, renderTemplate } from './render';
export {
  acceptsMarker,
  isGenerated,
  MARKER_PREFIX,
  originOf,
  withMarker,
  type FileOrigin,
} from './marker';
export { kebab, translit } from './naming';
export {
  changedLines,
  LINE_LIMIT,
  linesOf,
  pageOf,
  snippetOf,
  type ChangedLines,
  type Page,
} from './assistant/page';
export { joinWithinBudget } from './assistant/budget';
export { similarNames } from './assistant/suggest';
export {
  measureToolSurface,
  TOOL_DESCRIPTION_BUDGET,
  TOOL_NAME_BUDGET,
  type ToolDefinition,
} from './assistant/tool-surface';
export { pathWithin } from './assistant/paths';
export {
  createToolRegistry,
  TOOL_TEXT_BUDGET,
  type RegistryOutcome,
  type RegistryTool,
  type ToolRegistry,
  type ToolRegistryOptions,
} from './assistant/registry';
