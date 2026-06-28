/**
 * Утилиты для работы с формами
 *
 * Централизованные вспомогательные классы и функции.
 */

export { FieldPathNavigator, type PathSegment } from './field-path-navigator';
export { createFieldPath, extractPath, extractKey, toFieldPath } from './field-path';
export { SubscriptionManager } from './subscription-manager';
export { getCurrentValidationRegistry, getCurrentBehaviorRegistry } from './registry-helpers';
export { RegistryStack } from './registry-stack';
export { isFormNode, isFieldNode, isGroupNode, isArrayNode, getNodeType } from './type-guards';
export { FormErrorHandler, ErrorStrategy } from './error-handler';
export { createForm, createFormFromModel } from './create-form';
export type { CreateFormFromModelArgs } from './create-form';
export { registerSignalNode, getNodeForSignal } from './signal-node-registry';
export { uniqueId } from './unique-id';
export { safeCallback, runOutsideEffect, safeDebouncedCallback } from './safe-effect';
export { AbstractRegistry } from './abstract-registry';
export { FormSubmitter } from './form-submitter';
export type { SubmittableForm, SubmitOptions, SubmitResult } from './form-submitter';
export { FormStatusMachine } from './status-machine';
export type { StatusEvent } from './status-machine';
export { FormObserver } from './form-observer';
export type {
  FormChangeType,
  FormChangeEvent,
  FormChangeCallback,
  FormObserverOptions,
  ObservableForm,
  ObservableFormNode,
} from './form-observer';
