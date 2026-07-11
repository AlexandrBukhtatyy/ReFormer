/**
 * Модуль `form` — доменный слой формы поверх state-субстрата (`model`).
 *
 * Ноды (value/touched/dirty/status/errors/componentProps), сборка формы из модели по идентичности
 * сигнала (`createForm`), state-операции над нодами (`enableWhen`/`disableWhen`), in-form роутинг
 * валидации (`validateFormModel`), submit/статус, React-хуки. Зависит от `model` (form→state
 * разрешено); обратной зависимости нет.
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

// Валидация данных: headless-движок (walk по схеме) + in-form роутинг ошибок в ноды.
export { validateModel, validateModelSync } from './validate-model-core';
export type { ModelValidator, ModelValidationResult } from './validate-model-core';
export { validateFormModel } from './validate-model';
// State-операции над нодами.
export { enableWhen, disableWhen } from './behaviors-node';

// Обработчик ошибок валидации (конвертация throw → ValidationError, dev-лог).
export { FormErrorHandler, ErrorStrategy } from './error-handler';

// Шов сигнал→нода.
export { registerSignalNode, getNodeForSignal } from './signal-node-registry';

// Submit / статус / предикаты нод / id.
export { FormSubmitter } from './form-submitter';
export type { SubmittableForm, SubmitOptions, SubmitResult } from './form-submitter';
export { FormStatusMachine } from './status-machine';
export type { StatusEvent } from './status-machine';
export { isFormNode, isFieldNode, isGroupNode, isArrayNode, getNodeType } from './type-guards';
export { uniqueId } from './unique-id';

// React-хуки.
export { useFormControl } from './hooks/useFormControl';
export { useFormControlValue } from './hooks/useFormControlValue';
export { useArrayLength } from './hooks/useArrayLength';
export type { FieldControlState, ArrayControlState } from './hooks/types';
