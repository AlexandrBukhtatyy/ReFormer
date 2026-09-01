/**
 * Публичная поверхность плагина шаблонов: то, что берёт композиция, и ничего больше.
 *
 * ## Что нужно от композиции
 *
 * ```ts
 * createTemplatesPlugin({
 *   host: templatesHost,                    // порт платформы, см. ниже
 *   i18n: i18n.forPlugin('templates'),      // пока в PluginContext нет своего i18n
 *   print: async (schema, formName) => {    // переходник к кодогену: он печатает встроенные
 *     const kit = kits.descriptor();        // шаблоны, а плагины друг друга не импортируют
 *     if (kit === null) return [];
 *     const module = await generateModule(BUILTIN_TARGETS, {
 *       schema, formName, kit: { kit, catalog: kits.catalog() },
 *     });
 *     return module.files.map(({ path, content }) => ({ path, content }));
 *   },
 * });
 * ```
 *
 * Порт (`app/templates-host.ts`) обязан дать:
 *
 * - **корень проекта и адреса** — `projectRoot`, `parentOf`, `resolve`: каталог шаблонов
 *   отсчитывается от корня, а форма создаётся рядом с открытым файлом;
 * - **чтение и запись через рабочую область** — `list`, `exists`, `readText`, `writeText`;
 *   своего доступа к диску у плагина нет вовсе (в v1 `io/template-repo` принимал
 *   `FileSystemDirectoryHandle` и ходил на диск сам);
 * - **возможности источника** — `sourceOf(id).write`: по нему решается, создавать ли форму;
 * - **кит** — `catalog()`, `kit()`, `onDidChangeKit`: встроенные шаблоны печатаются ПОД КИТ,
 *   и после переключения кита список обязан перечитаться;
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
 * нет ни в `@/sdk`, ни в портах. Поэтому здесь операция берёт КАТАЛОГ
 * ({@link createTemplateFromDirectory}) — каталог формы ровно то, из чего шаблон и делают,
 * но потеря названа, а не спрятана.
 *
 * **Предпросмотра шаблона временной вкладкой.** В v1 схема шаблона открывалась вкладкой
 * `kind: 'template'` — вкладкой без ресурса. В v2 вкладка это документ рабочей области,
 * а документ — ресурс; открыть «документ ниоткуда» нечем. Нужен либо ресурс в памяти,
 * либо канал предпросмотра — и то и другое правка контракта, а не плагина.
 *
 * @module plugins/templates
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
export type { ModulePrinter } from './stores/builtin';
export { createProjectStore, TEMPLATES_DIR } from './stores/project';
export { createLocalStore } from './stores/local';

export {
  createTemplateFromDirectory,
  generateFormFromTemplate,
  listTemplates,
  removeTemplate,
  renameTemplate,
  storeOf,
  SOURCE_ORDER,
  type CreateTemplateOptions,
  type GenerateFormResult,
  type OperationResult,
} from './operations';

export {
  buildTemplateFiles,
  commonDirPrefix,
  formSchemaFileOf,
  isTextFile,
  materializeFiles,
  resolvePicked,
  suggestBaseName,
  templateSlug,
  type MaterializeOptions,
  type SourceFile,
} from './files';

export {
  hasTokens,
  materialize,
  nameVariants,
  splitWords,
  toCase,
  tokenize,
  TOKENS,
} from './placeholders';
export type { NameCase } from './placeholders';

export { TEMPLATES_MESSAGES } from './messages';

export { buildTemplateView, renderTemplateFile } from './render';
export type { FormTemplateView, TemplateViewOptions } from './render';

export { createTemplatesRefresh } from './refresh';
export type { TemplatesRefresh } from './refresh';

export type {
  MessageSink,
  TemplateKeyValue,
  TemplatesHost,
  TemplatesSourceCapabilities,
  Translate,
} from './host';
