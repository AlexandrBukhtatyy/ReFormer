/**
 * Публичная поверхность плагина генерации: то, что берёт композиция, и ничего больше.
 *
 * ## Что нужно от композиции
 *
 * ```ts
 * createCodegenPlugin({
 *   host: codegenHost,                    // порт платформы, см. ниже
 *   i18n: i18n.forPlugin('codegen'),      // пока в PluginContext нет своего i18n
 *   // targetPoint: CodegenTargetPoint,   // когда точка появится в @/sdk — подставить её
 *   // slot: 'panel.right',               // раскладка — дело композиции
 * });
 * ```
 *
 * Порт (`app/codegen-host.ts` по образцу `app/preview-host.ts`) обязан дать:
 *
 * - **документ и активную вкладку** — `documentOf`, `useActiveDocument`: рабочей области
 *   в `@/sdk` нет, а без ответа «на что смотрят сейчас» экспортировать нечего;
 * - **кит двумя вещами** — `catalog()` (какие имена бывают) и `kit()` (как их резолвить и откуда
 *   импортировать) плюс `onDidChangeKit`. Обе берутся из `services.get(KitsServiceToken)` ЛЕНИВО,
 *   на каждый вызов. Namespace кита кодогену не нужен: он печатает имена, а не рисует;
 * - **адреса и запись** — `parentOf`, `resolve`, `exists`, `readText`, `writeText` поверх
 *   Workspace. Арифметика путей платформенная (`dirname`/`joinPath` живут в
 *   `host/primitives/resource`), решение «куда класть модуль» — наше;
 * - **возможности источника** — `sourceOf(id)`: по `SourceCapabilities.write` и только по нему
 *   решается, начинать ли доставку.
 *
 * Необязательное, и цена каждого названа в порту: `save` (без него файлы остаются несохранённой
 * рабочей копией), `openResource`, `format` (без него текст уезжает как напечатан) и `rulesOf`.
 *
 * ## Чего в плагине нет и почему
 *
 * **Своего выбора каталога.** В v1 доставка звала собственный `showDirectoryPicker()` и писала
 * мимо рабочей копии и мимо источника. Здесь такого канала нет вовсе: запись идёт через рабочую
 * область, а куда именно — решает источник. Это граница прав, а не недоделка.
 *
 * **Плумбинга правил.** `rulesOf` необязателен, потому что сайдкара правил в v2 пока нет ни
 * у кого (ассистент держит правила в памяти сессии и говорит об этом вслух). Пока его нет,
 * `validation.ts` и `form.behavior.ts` уезжают заготовками.
 *
 * **Форматирования.** `prettier` в зависимостях v2 не объявлен, а брать неявно доступный пакет
 * в этом монорепо — известный способ получить сборку, которая работает только у себя.
 *
 * @module plugins/codegen/index
 */

export {
  createCodegenPlugin,
  codegenCommands,
  codegenDocumentMenuItems,
  codegenPanel,
  panelVisible,
  CODEGEN_PANEL_ID,
  CODEGEN_PLUGIN_ID,
  DEFAULT_CODEGEN_SLOT,
  GENERATE_COMMAND_ID,
  type CodegenPluginOptions,
} from './plugin';

export {
  codegenContextCommands,
  codegenContextMenuItems,
  findSchemaIn,
  generateInto,
  generateIntoArgs,
  notifyOutcome,
  schemaCandidates,
  CODEGEN_CONTEXT_SUBMENU,
  GENERATE_INTO_COMMAND_ID,
} from './context-menu';
export type {
  FoundSchema,
  GenerateIntoArgs,
  GenerateIntoDeps,
  GenerateIntoOutcome,
} from './context-menu';

export { CodegenTargetPoint } from './contract';
export type { CodegenTarget, ExtensionPointRef, TargetCatalog } from './contract';

export { BUILTIN_TARGETS } from './targets';

export { generateModule } from './generate';
export type { CodegenProblem, Formatter, GeneratedModule, ModuleFile } from './generate';

export { deliverInto, deliverModule, SourceReadOnlyError } from './deliver';
export type { DeliveryResult, SkipReason } from './deliver';

export { defaultFormName, runCodegen, schemaOf } from './run';

export { CODEGEN_MESSAGES } from './messages';

export type {
  CodegenDocument,
  CodegenHost,
  CodegenSourceCapabilities,
  MessageSink,
  Translate,
} from './host';
