/**
 * Behavior Schema API - Декларативное описание реактивного поведения форм
 *
 * @module behaviors
 */

// Типы и интерфейсы
export type {
  BehaviorSchemaFn,
  BehaviorContext,
  BehaviorHandlerFn,
  BehaviorOptions,
  CopyFromOptions,
  EnableWhenOptions,
  ComputeFromOptions,
  WatchFieldOptions,
  RevalidateWhenOptions,
  SyncFieldsOptions,
} from './types';

// Функции для декларативного описания поведения
// Behaviors
export { copyFrom } from './behaviors/copy-from';
export { enableWhen, disableWhen } from './behaviors/enable-when';
export { showWhen, hideWhen } from './behaviors/show-when';
export { computeFrom } from './behaviors/compute-from';
export { watchField } from './behaviors/watch-field';
export { revalidateWhen } from './behaviors/revalidate-when';
export { syncFields } from './behaviors/sync-fields';

// Композиция behavior схем (аналог toFieldPath из validation API)
export { apply, applyWhen, toBehaviorFieldPath } from './compose-behavior';

// Вспомогательные классы и функции
// Примечание: BehaviorRegistry (глобальный singleton) был удален в пользу
// локальных экземпляров BehaviorRegistry в каждом GroupNode
export { BehaviorRegistry } from './behavior-registry';
export { BehaviorContextImpl } from './behavior-context';
export { createFieldPath } from './create-field-path';
