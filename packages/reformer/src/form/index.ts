/**
 * Модуль `form` — доменный слой формы поверх state-субстрата (`model`).
 *
 * Ноды (value/touched/dirty/status/errors/componentProps), сборка формы из модели по идентичности
 * сигнала (`createForm`), state-операции над нодами (`enableWhen`/`disableWhen`), submit/статус,
 * React-хуки. Schema-валидация — внешний контракт `@reformer/core/validation` (`validateModel`),
 * роутит ошибки в ноды через реестр сигнал→нода. Зависит от `model` (form→state разрешено);
 * обратной зависимости нет.
 *
 * @group Form
 * @module form
 */

// Ноды формы.
export { FormNode } from './nodes/form-node';
export type { SetValueOptions } from './nodes/form-node';
export { FieldNode } from './nodes/field-node';
export { GroupNode } from './nodes/group-node';
export { ArrayNode } from './nodes/array-node';
export { ModelArrayNode } from './nodes/model-array-node';
export type { ModelArrayControl } from './nodes/model-array-node';

// Сборка формы из модели + единой схемы.
export { createForm, createFormFromModel } from './create-form';
export type { CreateFormFromModelArgs } from './create-form';

// Сборка формы ОДНИМ вызовом (модель + форма + валидация) — общий конфиг с `createReactForm`
// (@reformer/renderer-react) и `createJsonForm` (@reformer/renderer-json).
export { createCoreForm } from './create-core-form';
export type { CoreForm, CreateCoreFormConfig, CreateFormConfigBase } from './create-core-form';
export { buildValidation } from './validation-config';
export type { FormValidation, FormValidationBundle } from './validation-config';
export { useFormBundle } from './hooks/use-form-bundle';
export type { FormBundleLike } from './hooks/use-form-bundle';

// Валидация: контракт `@reformer/core/validation` (validateModel + операторы) — отдельный сабпат,
// в root не реэкспортируется. Старый дерево-движок (`validateFormModel`/`validateModel`(tree)) удалён.
// State-операции над нодами.
export { enableWhen, disableWhen } from './behaviors-node';

// Обработчик ошибок валидации (конвертация throw → ValidationError, dev-лог).
export { FormErrorHandler, ErrorStrategy } from './error-handler';

// Шов сигнал→нода.
export { registerSignalNode, getNodeForSignal } from './signal-node-registry';

// Submit / статус / предикаты нод / id.
export { FormSubmitter } from './form-submitter';
export type { SubmittableForm, SubmitOptions, SubmitResult } from './form-submitter';
// FormStatusMachine и StatusEvent убраны из публичной поверхности в 7.0: машина — внутренняя
// деталь FieldNode, снаружи её никто не конструировал. Класс живёт в './status-machine'.
export { isFormNode, isFieldNode, isGroupNode, isArrayNode, getNodeType } from './type-guards';
// uniqueId убран из публичной поверхности в 7.0: его параметр типизирован `SubscriptionKeyType`,
// который барель не отдаёт, — типобезопасно вызвать функцию извне пакета было невозможно.

// React-хуки.
export { useFormControl } from './hooks/useFormControl';
export { useFormControlValue } from './hooks/useFormControlValue';
export { useArrayLength } from './hooks/useArrayLength';
export { useFormValidation } from './hooks/use-form-validation';
export type { UseFormValidationArgs, UseFormValidationResult } from './hooks/use-form-validation';
export type { FieldControlState, ArrayControlState } from './hooks/types';
