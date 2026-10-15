/**
 * Публичная поверхность плагина шаблонов: то, что берёт композиция, и ничего больше.
 *
 * ## Что нужно от композиции
 *
 * ```ts
 * createTemplatesPlugin({
 *   host: templatesHost,                    // порт платформы, см. ниже
 *   i18n: i18n.forPlugin('templates'),      // пока в PluginContext нет своего i18n
 *   print: async (schema, formName, seed) => { // переходник к кодогену: он печатает встроенные
 *     const kit = kits.descriptor();           // шаблоны, а плагины друг друга не импортируют
 *     if (kit === null) return [];
 *     const module = await generateModule(BUILTIN_TARGETS, {
 *       schema, formName, kit: { kit, catalog: kits.catalog() },
 *       rules: seed?.rules, mock: seed?.mock, splitSteps: seed?.splitSteps,
 *     });
 *     return module.files.map(({ path, content }) => ({ path, content }));
 *   },
 * });
 * ```
 *
 * Печатник отдаёт модуль в раскладке «папки по ролям» — пути от корня модуля формы: страница
 * `<Тип>.tsx`, реэкспорты `index.ts`, документ `schema/form.schema.json`. Каталог созданной формы
 * и есть каталог модуля; фикстура предпросмотра ложится в его корень.
 *
 * Зовётся печатник дважды: под базовое имя — ради списка файлов шаблона — и под имя формы, когда
 * её создают ({@link applyTemplate}): раскладка строк модуля зависит от имён, и подстановкой
 * токенов её не перенести.
 *
 * Порт (`app/templates-host.ts`) обязан дать:
 *
 * - **корень проекта и адреса** — `projectRoot`, `parentOf`, `resolve`: каталог шаблонов
 *   отсчитывается от корня, а форма создаётся рядом с открытым файлом;
 * - **чтение и запись через рабочую область** — `list`, `exists`, `readText`, `writeText`;
 *   своего доступа к диску у плагина нет вовсе (в v1 `io/template-repo` принимал
 *   `FileSystemDirectoryHandle` и ходил на диск сам);
 * - **возможности источника** — `sourceOf(id).write`: по нему решается, создавать ли форму;
 * - **кит** — `catalog()`, `kit()`, `onDidChangeKit`: встроенные шаблоны печатаются ПОД КИТ
 *   (затравка кладёт только те компоненты, что есть в его каталоге), и после переключения кита
 *   список обязан перечитаться;
 * - **локальное хранилище** — `local`: любая реализация «ключ-значение», переживающая
 *   перезагрузку. Без неё локальных шаблонов просто нет.
 *
 * Необязательное и цена каждого: `remove` (без него проектный и локальный шаблон не удаляются
 * из панели), `save` (созданное остаётся рабочей копией), `openResource` (после генерации
 * ничего не открывается).
 *
 * ## Чего в плагине нет и почему
 *
 * **Сборки шаблона из ВЫДЕЛЕНИЯ в дереве.** В v1 шаблон собирался из отмеченных в дереве путей
 * (`createTemplateFrom(paths)`). В v2 дерево принадлежит Host, и канала «что сейчас выделено»
 * нет ни в `@reformer/builder-plugin-api`, ни в портах. Поэтому здесь операция берёт КАТАЛОГ
 * ({@link createTemplateFromDirectory}) — каталог формы ровно то, из чего шаблон и делают,
 * но потеря названа, а не спрятана.
 *
 * **Предпросмотра шаблона временной вкладкой.** В v1 схема шаблона открывалась вкладкой
 * `kind: 'template'` — вкладкой без ресурса. В v2 вкладка это документ рабочей области,
 * а документ — ресурс; открыть «документ ниоткуда» нечем. Нужен либо ресурс в памяти,
 * либо канал предпросмотра — и то и другое правка контракта, а не плагина.
 *
 * Бочка — для тестов и соседей по монорепозиторию. Оболочка грузит плагин из `./main`.
 *
 * @module plugins/reformer/templates/index
 */

export {
  createTemplatesPlugin,
  panelVisible,
  templatesPanel,
  DEFAULT_TEMPLATES_SLOT,
  TEMPLATES_PANEL_ID,
  TEMPLATES_PLUGIN_ID,
  type TemplatesPluginOptions,
} from './plugin';

export {
  canRemove,
  canSave,
  canUpdate,
  TemplateStorePoint,
  TEMPLATE_MANIFEST,
  TEMPLATE_MANIFEST_VERSION,
} from './contract';
export type {
  ExtensionPointRef,
  FormTemplate,
  RemovingStore,
  SavingStore,
  TemplateEngine,
  TemplateFile,
  TemplateManifest,
  TemplatePrint,
  TemplateSource,
  TemplateStore,
  UpdatingStore,
} from './contract';

export {
  createBuiltinStore,
  BUILTIN_BASE_NAME,
  SIMPLE_TEMPLATE_ID,
  WIZARD_TEMPLATE_ID,
} from './stores/builtin';
export type { BuiltinStoreOptions, ModulePrinter, SeedExtras } from './stores/builtin';
export {
  hasWizard,
  seedData,
  seedKitOf,
  simpleRules,
  simpleSeed,
  wizardRules,
  wizardSeed,
} from './stores/seeds';
export type { SeedData, SeedKit } from './stores/seeds';

// Рабочая область шаблонов собирается из возможностей ЕЮ САМОЙ; композиции остаётся
// названная дыра — см. шапку `./workspace`.
export { hasPrinter, templatesPrinter, templatesWorkspace } from './workspace';
export type { TemplatesGaps } from './workspace';
export { createProjectStore, TEMPLATES_DIR } from './stores/project';
export { createLocalStore } from './stores/local';

export {
  createTemplateFromDirectory,
  generateFormFromTemplate,
  listTemplates,
  removeTemplate,
  renameTemplate,
  storeOf,
  suggestedFolderOf,
  SOURCE_ORDER,
  type CreateTemplateOptions,
  type GenerateFormResult,
  type OperationResult,
} from './content/operations';

export {
  applyTemplate,
  buildTemplateFiles,
  commonDirPrefix,
  formSchemaFileOf,
  isTextFile,
  keepOrigin,
  materializeFiles,
  resolvePicked,
  suggestBaseName,
  templateSlug,
  type MaterializeOptions,
  type SourceFile,
} from './content/files';

export {
  hasTokens,
  materialize,
  moduleNames,
  nameVariants,
  splitWords,
  toCase,
  tokenize,
  tokenizeModuleNames,
  MODULE_TOKENS,
  TOKENS,
} from './render/placeholders';
export type { ModuleNameRole, NameCase } from './render/placeholders';

export { TEMPLATES_MESSAGES } from './messages';

export { buildTemplateView, renderTemplateFile } from './render/render';
export type { FormTemplateView, TemplateViewOptions } from './render/render';

export { createTemplatesRefresh } from './content/refresh';
export type { TemplatesRefresh } from './content/refresh';

export type {
  MessageSink,
  TemplateKeyValue,
  TemplatesHost,
  TemplatesSourceCapabilities,
  Translate,
} from './host';
