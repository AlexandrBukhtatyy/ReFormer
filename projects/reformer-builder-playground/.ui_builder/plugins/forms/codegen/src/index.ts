/**
 * Публичная поверхность плагина генерации — общего для стеков форм: то, что берут композиция,
 * тесты и соседи по монорепозиторию. Оболочка грузит плагин из `./main`.
 *
 * ## Что плагин делает сам
 *
 * Панель «Экспорт формы», запись модуля с маркером происхождения (`./pipeline/deliver`), цели
 * из проекта (`.ui_builder/codegen/*.eta`), выгрузку шаблона, генерацию по заказу ассистента
 * (`reformer.codegen.generator`) и в каталог из дерева. Рабочую область собирает из служб
 * контекста (`./workspace`); композиции остаётся названная дыра — `format`.
 *
 * ## Что приносит стек
 *
 * Что такое форма документа, из каких файлов состоит её модуль и где он лежит — точка
 * `CodegenStackPoint` SDK; файлы модуля — цели `CodegenTargetPoint`. У ReFormer это плагин
 * `reformer.codegen-schema` (`plugins/reformer/codegen`). Без стеков панель не видна, а
 * генерация по заказу отвечает «это не схема формы».
 *
 * ## Чего в плагине нет и почему
 *
 * **Своего выбора каталога.** В v1 доставка звала собственный `showDirectoryPicker()` и писала
 * мимо рабочей копии и мимо источника. Здесь такого канала нет вовсе: запись идёт через рабочую
 * область, а куда именно — решает источник. Это граница прав, а не недоделка.
 *
 * **Форматирования.** `prettier` в зависимостях v2 не объявлен, а брать неявно доступный пакет
 * в этом монорепо — известный способ получить сборку, которая работает только у себя.
 *
 * @module plugins/forms/codegen/index
 */

export {
  createCodegenPlugin,
  codegenCommands,
  codegenDocumentMenuItems,
  codegenPanel,
  userTargetCommands,
  CODEGEN_PANEL_ID,
  CODEGEN_PLUGIN_ID,
  DEFAULT_CODEGEN_SLOT,
  EJECT_TEMPLATE_COMMAND_ID,
  GENERATE_COMMAND_ID,
  REFRESH_TARGETS_COMMAND_ID,
  type CodegenPluginOptions,
} from './plugin';

export {
  codegenContextCommands,
  generateInto,
  generateIntoArgs,
  notifyLayout,
  notifyOutcome,
  GENERATE_INTO_COMMAND_ID,
} from './commands/generate-into';
export type {
  GenerateIntoArgs,
  GenerateIntoDeps,
  GenerateIntoOutcome,
} from './commands/generate-into';
export { ejectTemplate, slugOf, type EjectOutcome } from './commands/eject';

export { CodegenStackPoint, CodegenTargetPoint } from './contract';
export type { CodegenStack, CodegenTarget } from './contract';

export {
  overrideProblems,
  stackById,
  stackDocumentVisible,
  stackFor,
  stackOfKind,
  stackText,
  targetsFor,
  type StackEntry,
  type Stacks,
} from './stacks';

export { deliverInto, DeliveryRefusedError, SourceReadOnlyError } from './pipeline/deliver';
export type { DeliveryOptions, DeliveryResult, LegacyFile, SkipReason } from './pipeline/deliver';

export { runCodegen, stackError, type RunOptions } from './pipeline/run';
export { generateFor } from './pipeline/generate-for';
export type {
  GenerateReport,
  GenerateRequest,
  GenerateSkipReason,
  GenerateWrite,
} from './pipeline/generate-for';
export { createCodegenSessions } from './pipeline/state';
export type {
  CodegenError,
  CodegenSessions,
  CodegenState,
  CodegenStore,
  ReportedFile,
} from './pipeline/state';
export { discoverUserTargets, USER_TARGETS_DIR, type UserTarget } from './pipeline/user-targets';

export { CODEGEN_MESSAGES } from './messages';

export type {
  CodegenDocument,
  CodegenHost,
  CodegenSourceCapabilities,
  MessageSink,
  Translate,
} from './host';

// Рабочая область генерации собирается из возможностей ЕЮ САМОЙ; композиции остаются
// названные дыры (`CodegenGaps`) — см. шапку `./workspace`.
export { asCodegenDocument, codegenWorkspace } from './workspace';
export type { CodegenGaps } from './workspace';
