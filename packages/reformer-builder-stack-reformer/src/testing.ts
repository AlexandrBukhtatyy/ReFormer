/**
 * Фикстуры стека для тестов ПОТРЕБИТЕЛЕЙ: плагинов и интеграционных проверок сборки.
 *
 * Отдельный вход, а не часть модулей: фикстура каталога тянет `@reformer/ui-kit/catalog`
 * (864 кБ JSON), и попади она в `./catalog`, любой потребитель платил бы за неё в рантайме.
 * Здесь же платит только тест, который её импортирует.
 *
 * @module @reformer/builder-stack-reformer/testing
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
  plainSchema,
  richSchema,
  seededRules,
  wizardSchema,
  wizardRulesSchema,
  wizardRules,
  wizardSlugsSchema,
} from './codegen/__fixtures__/kit';
