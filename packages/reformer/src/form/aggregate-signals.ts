/**
 * Утилита для создания агрегированных сигналов контейнерных узлов
 *
 * Устраняет дублирование кода между GroupNode и ArrayNode
 * для computed signals: valid, invalid, pending, touched, dirty, errors, status
 *
 * @module utils/aggregate-signals
 */

import { computed, type ReadonlySignal, type Signal } from '@preact/signals-core';
import type { FieldStatus, ValidationError } from './types/index';
import type { FormNode } from './nodes/form-node';

/**
 * Функция получения дочерних узлов
 * Возвращает массив FormNode для агрегации состояния
 */
type GetChildrenFn<T> = () => FormNode<T>[];

/**
 * Результат создания агрегированных сигналов
 */
export interface AggregateSignals {
  /** Все дочерние узлы валидны и нет собственных ошибок */
  valid: ReadonlySignal<boolean>;
  /** Есть ошибки (инверсия valid) */
  invalid: ReadonlySignal<boolean>;
  /** Хотя бы один дочерний узел в состоянии pending */
  pending: ReadonlySignal<boolean>;
  /** Хотя бы один дочерний узел touched */
  touched: ReadonlySignal<boolean>;
  /** Хотя бы один дочерний узел dirty */
  dirty: ReadonlySignal<boolean>;
  /** Собственные ошибки + ошибки всех дочерних узлов */
  errors: ReadonlySignal<ValidationError[]>;
  /** Статус: disabled > pending > invalid > valid */
  status: ReadonlySignal<FieldStatus>;
}

/**
 * Опции для создания агрегированных сигналов
 */
export interface AggregateSignalsOptions<T> {
  /** Функция получения дочерних узлов */
  getChildren: GetChildrenFn<T>;
  /** Signal с собственными ошибками контейнера (form-level или array-level) */
  ownErrors: Signal<ValidationError[]>;
  /** Опциональный signal disabled состояния (для GroupNode) */
  disabled?: Signal<boolean>;
}

/**
 * Создать агрегированные computed signals для контейнерного узла
 *
 * Используется в GroupNode и ArrayNode для унификации логики
 * вычисления состояния на основе дочерних узлов.
 *
 * @param options - Опции конфигурации
 * @returns Объект с computed signals
 *
 * @example GroupNode
 * ```typescript
 * const signals = createAggregateSignals({
 *   getChildren: () => Array.from(this._fields.values()),
 *   ownErrors: this._formErrors,
 *   disabled: this._disabled,
 * });
 * this.valid = signals.valid;
 * this.invalid = signals.invalid;
 * // ...
 * ```
 *
 * @example ArrayNode
 * ```typescript
 * const signals = createAggregateSignals({
 *   getChildren: () => this.items.value,
 *   ownErrors: this._arrayErrors,
 * });
 * this.valid = signals.valid;
 * // ...
 * ```
 */
export function createAggregateSignals<T>(options: AggregateSignalsOptions<T>): AggregateSignals {
  const { getChildren, ownErrors, disabled } = options;

  // valid: нет собственных ошибок И все активные (не disabled) дочерние валидны
  // disabled поля игнорируются при подсчёте валидности
  const valid = computed(() => {
    if (ownErrors.value.length > 0) return false;
    return getChildren().every((child) => child.disabled.value || child.valid.value);
  });

  // invalid: инверсия valid
  const invalid = computed(() => !valid.value);

  // pending: хотя бы один дочерний в pending
  const pending = computed(() => getChildren().some((child) => child.pending.value));

  // touched: хотя бы один дочерний touched
  const touched = computed(() => getChildren().some((child) => child.touched.value));

  // dirty: хотя бы один дочерний dirty
  const dirty = computed(() => getChildren().some((child) => child.dirty.value));

  // errors: собственные + все дочерние
  const errors = computed(() => {
    const allErrors: ValidationError[] = [...ownErrors.value];
    for (const child of getChildren()) {
      allErrors.push(...child.errors.value);
    }
    return allErrors;
  });

  // status: приоритет disabled > pending > invalid > valid
  const status = computed<FieldStatus>(() => {
    if (disabled?.value) return 'disabled';
    if (pending.value) return 'pending';
    if (invalid.value) return 'invalid';
    return 'valid';
  });

  return {
    valid,
    invalid,
    pending,
    touched,
    dirty,
    errors,
    status,
  };
}
