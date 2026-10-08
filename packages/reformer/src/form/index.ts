/**
 * Модуль `form` — доменный слой формы поверх реактивной модели (`model`).
 *
 * Ноды (value/touched/dirty/status/errors/componentProps), сборка формы из модели по идентичности
 * сигнала (`createForm`), submit/статус.
 * React-биндинги вынесены в `platforms/react` — этот слой от React не зависит.
 * Schema-валидация — внешний контракт `@reformer/core/validation` (`validateModel`),
 * роутит ошибки в ноды через реестр сигнал→нода. Зависит от `model` (form→model разрешено);
 * обратной зависимости нет.
 *
 * @group Form
 * @module form
 */

// Ноды формы.
export { FormNode } from './nodes/form-node';
export { FieldNode } from './nodes/field-node';
export { GroupNode } from './nodes/group-node';
export { ModelArrayNode } from './nodes/model-array-node';

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
export { createFormFromModel } from './create-form';
export type { CreateFormFromModelArgs } from './create-form';
// Поддерево строки массива или подформы — одно на пару «билдер + под-модель».
export { schemaSubtree } from './schema-subtree';

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

// Общий конфиг родственных фабрик — `createReactForm` (@reformer/renderer-react) и
// `createJsonForm` (@reformer/renderer-json).
export type { CoreForm, CreateFormConfigBase } from './form-config-base';
export { buildValidation } from './validation/config';
export type { FormValidation, FormValidationBundle } from './validation/config';

// Валидация: контракт `@reformer/core/validation` (validateModel + операторы) — отдельный сабпат,
// в root не реэкспортируется.
// Шов сигнал→нода.
export { registerSignalNode, getNodeForSignal } from './signal-node-registry';

// Опции отправки формы и предикаты нод. FormSubmitter и машина статуса — внутренние детали нод.
export type { SubmitOptions } from './form-submitter';
export { isFormNode, isFieldNode, isGroupNode, isArrayNode } from './type-guards';
