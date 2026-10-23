/**
 * Публичная поверхность плагина шаблонов: то, что берёт композиция, и ничего больше.
 *
 * ## Что нужно от композиции
 *
 * Ничего, кроме контекста активации: рабочую область плагин собирает сам из служб
 * (`templatesWorkspace`), стеки и хранилища берёт вкладами (`TemplateStackPoint`,
 * `TemplateStorePoint`). Параметры `createTemplatesPlugin` — для тестов: порт целиком и слот
 * панели.
 *
 * Порт обязан дать:
 *
 * - **корень проекта и адреса** — `projectRoot`, `parentOf`, `resolve`: каталог шаблонов
 *   отсчитывается от корня, а форма создаётся рядом с открытым файлом;
 * - **чтение и запись через рабочую область** — `list`, `exists`, `readText`, `writeText`;
 *   своего доступа к диску у плагина нет вовсе (в v1 `io/template-repo` принимал
 *   `FileSystemDirectoryHandle` и ходил на диск сам);
 * - **возможности источника** — `sourceOf(id).write`: по нему решается, создавать ли форму;
 * - **стеки** — `stacks()`: всё, что зависит от формата формы (документ, вид, токены модуля,
 *   пустая форма, место модуля и фикстуры), и `onDidChangeKit` — встроенные шаблоны стек печатает
 *   ПОД КИТ, и после переключения кита список обязан перечитаться;
 * - **локальное хранилище** — `local`: любая реализация «ключ-значение», переживающая
 *   перезагрузку. Без неё локальных шаблонов просто нет.
 *
 * Необязательное и цена каждого: `remove` (без него проектный и локальный шаблон не удаляются
 * из панели), `save` (созданное остаётся рабочей копией), `openResource` (после генерации
 * ничего не открывается).
 *
 * ## Стеки
 *
 * Знание формата формы — у стеков (`TemplateStack` SDK); у ReFormer это плагин
 * `reformer.templates-schema` (`plugins/reformer/templates`): документ формы, вид генерации для
 * шаблона на движке, токены имён модуля, пустая форма, место модуля и фикстуры, встроенные шаблоны.
 * Шаблон, который печатается (встроенный), хозяин под имя формы печатает заново
 * ({@link applyTemplate}): раскладка строк модуля зависит от имён, и подстановкой токенов её не
 * перенести.
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
 * @module plugins/forms/templates/index
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
  FormTemplate,
  RemovingStore,
  SavingStore,
  TemplateEngine,
  TemplateFile,
  TemplateFileScope,
  TemplateManifest,
  TemplatePrint,
  TemplateSource,
  TemplateStore,
  UpdatingStore,
} from './contract';

// Рабочая область шаблонов собирается из возможностей ЕЮ САМОЙ; композиции остаётся
// названная дыра — см. шапку `./workspace`.
export { templatesWorkspace } from './workspace';
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
  isTextFile,
  materializeFiles,
  resolvePicked,
  suggestBaseName,
  templateSlug,
  type MaterializeOptions,
  type SourceFile,
} from './content/files';

export {
  emptyTemplateOf,
  moduleDepthOf,
  moduleTokenNames,
  moduleTokensOf,
  templateStackOf,
} from './content/stacks';

export {
  hasTokens,
  materialize,
  nameVariants,
  splitWords,
  toCase,
  tokenize,
  TOKENS,
} from './render/placeholders';
export type { NameCase } from './render/placeholders';

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
