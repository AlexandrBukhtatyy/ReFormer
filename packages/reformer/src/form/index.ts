/**
 * Модуль `form` — доменный слой формы поверх реактивной модели (`model`).
 *
 * Ноды (value/touched/dirty/disabled/issues/componentProps) — контракты FormNode, FormControl,
 * FormGroup, FormArray; сборка формы из модели по идентичности сигнала (`createForm`), уровень формы
 * (проверка, отправка, поток шагов). Классы нод — внутренние.
 * React-биндинги вынесены в `platforms/react` — этот слой от React не зависит.
 * Schema-валидация — внешний контракт `@reformer/core/validation` (`validateModel`),
 * роутит ошибки в ноды через реестр сигнал→нода. Зависит от `model` (form→model разрешено);
 * обратной зависимости нет.
 *
 * @group Form
 * @module form
 */

// Сборка одним вызовом: модель, форма, валидация и дерево для рендера.
export { createForm } from './form-bundle';
export type {
  CreateFormConfig,
  FormBundle,
  FormRender,
  ResolvedSchema,
  SchemaResolver,
} from './form-bundle';

// Низкоуровневая фабрика: из модели и готового дерева.
export { createFormFromModel, disposeForm } from './create-form';
export type { CreateFormFromModelArgs } from './create-form';
// Поддерево строки массива или подформы — одно на пару «билдер + под-модель».
export { schemaSubtree } from './schema-subtree';

// Компилятор схемы: вид узла, привязки и идентификаторы — один разбор для сборки и рендереров.
export { compileSchema, isCompiledNode } from './schema/compile';
export type { CompileSchemaOptions } from './schema/compile';
export type {
  CompiledSchema,
  CompiledNode,
  CompiledChild,
  CompiledFieldNode,
  CompiledArrayNode,
  CompiledPartNode,
  CompiledContainerNode,
  CompiledTextNode,
  SchemaNodeId,
  SchemaScopeId,
  SchemaTextPart,
} from './schema/compiled';

// Схема-контроллер: правила узлов схемы по областям (корень, строка массива, подформа).
export {
  createSchemaController,
  createSchemaScope,
  unknownSchemaSelectors,
} from './schema-controller';
export type {
  SchemaController,
  SchemaScope,
  SchemaNodeControl,
  SchemaOverrideMaps,
  NodeLifecycleHooks,
} from './schema-controller';

// Уровень формы: проверка, поток шагов и отправка с результатом-объектом.
export { createFormLevel } from './form-level';
export type {
  FormLevel,
  FormValidation,
  FormValidationState,
  FormFlowConfig,
  FlowStep,
} from './form-level';
// Отправка — отдельный объект: `bundle.submission`; без сборки — `createSubmission`.
export { createSubmission } from './submission';
export type {
  ActionCheck,
  FormSubmission,
  SubmissionDependencies,
  SubmitResult,
} from './submission';
export { createFormFlow } from './flow/flow';
export type { FormFlow, FormFlowOptions, FlowTransition, FlowStayReason } from './flow/flow';

// Валидация: контракт `@reformer/core/validation` (validateModel + операторы) — отдельный сабпат,
// в root не реэкспортируется.
// Шов сигнал→нода.
export { registerSignalNode, getNodeForSignal } from './signal-node-registry';

// Предикаты нод: различают ноды по метке вида.
export { isFormNode, isFormControl, isFormGroup, isFormArray } from './type-guards';
