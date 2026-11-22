/**
 * Стек форм ReFormer в ассистенте — точка входа.
 *
 * Бочка — для тестов и соседей по домену. Оболочка грузит плагин из `./main`.
 *
 * @module plugins/reformer/ai/index
 */

export {
  AI_SCHEMA_PLUGIN_ID,
  createSchemaStackPlugin,
  createValidateFormLoader,
  type SchemaStackPluginOptions,
} from './plugin';

// Стек: вклад в точку стеков ассистента и рабочая область, из которой он собран.
export { createSchemaFormStack, SCHEMA_FORM_STACK_ID, type SchemaFormStackOptions } from './stack';
export { schemaStackWorkspace, type SchemaStackWorkspace } from './stack/workspace';
export { applyChangeSet, type ApplyDeps, type ApplyOptions, type ApplyOutcome } from './stack/land';

// Черновик хода и инструменты стека — для тестов и замеров, которые зовут их без ассистента.
export { createChangeSet, describeChangeSet, hasChanges, type ChangeSet } from './model/changeset';
export { structuredSlots } from './tools';
export {
  createEditorToolRegistry,
  createFileToolRegistry,
  createReadOnlyToolRegistry,
} from './tools/registry';
export { fileModeSlots } from './tools/files';
export type { ToolRegistry } from './tools/registry';
export type { ChangeOp, ChangeOpKind, ToolError, ToolErrorCode } from './model/types';
// Проверка по мета-схеме: грузится по требованию, приходит параметром — см. `core/validate`.
export type { LoadValidateForm, ValidateFormSchema } from './model/validate';

// Справка по библиотеке: контракт, которым её заменяет плагин-поставщик, и справка сервиса.
export {
  LibraryReferenceCapability,
  type CodeFinding,
  type LibraryReferenceService,
  type ReferenceRequest,
  type ResolveLibraryReference,
} from './reference';
export { chooseReference, createServiceReference } from './service/reference';

// Сервис ReFormer: сервер в подключениях MCP ассистента, компилятор intent `build_form`.
export {
  createServiceCall,
  DEFAULT_SERVICE_URL,
  isServiceReady,
  linkService,
  SERVICE_KEY_VARIABLE,
  SERVICE_SERVER,
  serviceDeclaration,
  type ServiceCall,
  type ServiceLink,
  type ServiceOutcome,
} from './service/link';
export {
  createFormCompiler,
  type FormCompiler,
  type IntentGrammar,
  type IntentVerdict,
  type JudgeFinding,
} from './service/compiler';
