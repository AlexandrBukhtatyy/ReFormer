/**
 * Behavior Schema API - Декларативное описание реактивного поведения форм
 *
 * @group Behaviors
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
export * from './behaviors';

// Композиция behavior схем (аналог toFieldPath из validation API)
export { apply, applyWhen, toBehaviorFieldPath } from './compose-behavior';

// Вспомогательные классы и функции
// Примечание: BehaviorRegistry (глобальный singleton) был удален в пользу
// локальных экземпляров BehaviorRegistry в каждом GroupNode
export { BehaviorRegistry } from './behavior-registry';
export { BehaviorContextImpl } from './behavior-context';
export { createFieldPath } from './create-field-path';
