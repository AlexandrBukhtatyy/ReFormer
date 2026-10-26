/**
 * Фикстуры стека для тестов ПОТРЕБИТЕЛЕЙ: плагинов и интеграционных проверок сборки.
 *
 * Отдельный вход, а не часть модулей: фикстура каталога тянет `@reformer/ui-kit/catalog`
 * (864 кБ JSON), и попади она в `./catalog`, любой потребитель платил бы за неё в рантайме.
 * Здесь же платит только тест, который её импортирует.
 *
 * @module plugins/reformer/core/testing
 */

export { sampleSchema, P } from './form-model/__fixtures__/sample-schema';
export {
  BUILTIN_CATALOG,
  builtinCatalog,
  builtinEntries,
} from './catalog/__fixtures__/builtin-catalog';
export {
  builtinKit,
  foreignKit,
  noWizardKit,
  partsRules,
  partsSchema,
  partsWizardSchema,
  plainSchema,
  providerKit,
  richSchema,
  rowRules,
  rowRulesSchema,
  seededRules,
  subpathSchema,
  wizardSchema,
  wizardRulesSchema,
  wizardRules,
  wizardSlugsSchema,
  wizardSplitSource,
} from './codegen/__fixtures__/kit';

/**
 * Текст прежнего файла правил (`form.rules.json`) — таким его писали до правил в коде модуля.
 * Нужен тестам переноса: билдер этот файл больше не пишет, только читает один раз.
 */
export function legacyRulesText(rules: import('./form-model/rules').FormRules): string {
  return `${JSON.stringify({ version: 1, ...rules }, null, 2)}\n`;
}
