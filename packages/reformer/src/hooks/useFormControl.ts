import { useSyncExternalStore, useCallback, useRef } from 'react';
import { effect } from '@preact/signals-core';
import type { FieldNode } from '../core/nodes/field-node';
import type { ArrayNode } from '../core/nodes/array-node';
import type { FormValue, ValidationError, FormFields } from '../core/types';

// ============================================================================
// Утилиты для сравнения
// ============================================================================

/**
 * Shallow сравнение массивов по содержимому
 * Возвращает true если массивы равны (одинаковые элементы в том же порядке)
 * @internal
 */
function shallowArrayEqual<T>(a: T[], b: T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ============================================================================
// Типы возвращаемых значений
// ============================================================================

/**
 * @internal
 */
interface FieldControlState<T> {
  value: T;
  pending: boolean;
  disabled: boolean;
  errors: ValidationError[];
  valid: boolean;
  invalid: boolean;
  touched: boolean;
  shouldShowError: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentProps: Record<string, any>;
}

/**
 * @internal
 */
interface ArrayControlState<T> {
  value: T[];
  length: number;
  pending: boolean;
  errors: ValidationError[];
  valid: boolean;
  invalid: boolean;
  touched: boolean;
  dirty: boolean;
}

// ============================================================================
// Внутренние хуки для каждого типа контрола
// ============================================================================

/**
 * Внутренний хук для FieldNode с использованием useSyncExternalStore
 * @internal
 */
function useFieldControl<T extends FormValue>(
  control: FieldNode<T>
): FieldControlState<T> {
  // Кеш для предотвращения лишних ре-рендеров
  const cacheRef = useRef<{
    snapshot: FieldControlState<T> | null;
    // Кешируем ссылки на объекты для сравнения
    value: T;
    errors: ValidationError[];
    componentProps: Record<string, unknown>;
    disabled: boolean;
    pending: boolean;
    valid: boolean;
    invalid: boolean;
    touched: boolean;
    shouldShowError: boolean;
  }>({
    snapshot: null,
    value: control.value.value,
    errors: control.errors.value,
    componentProps: control.componentProps.value,
    disabled: control.disabled.value,
    pending: control.pending.value,
    valid: control.valid.value,
    invalid: control.invalid.value,
    touched: control.touched.value,
    shouldShowError: control.shouldShowError.value,
  });

  // Функция подписки - использует effect для отслеживания всех сигналов
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // Используем effect который автоматически отслеживает все читаемые сигналы
      // effect НЕ вызывает callback сразу, только при изменениях
      let isFirstRun = true;

      const dispose = effect(() => {
        // Читаем все сигналы чтобы effect их отслеживал
        control.value.value;
        control.disabled.value;
        control.errors.value;
        control.pending.value;
        control.valid.value;
        control.invalid.value;
        control.touched.value;
        control.shouldShowError.value;
        control.componentProps.value;

        // Пропускаем первый вызов (при создании effect)
        if (isFirstRun) {
          isFirstRun = false;
          return;
        }

        // Уведомляем React об изменении
        onStoreChange();
      });

      return dispose;
    },
    [control]
  );

  // Функция получения текущего состояния
  const getSnapshot = useCallback((): FieldControlState<T> => {
    const cache = cacheRef.current;

    // Получаем текущие значения из сигналов
    const currentValue = control.value.value;
    const currentErrors = control.errors.value;
    const currentComponentProps = control.componentProps.value;
    const currentDisabled = control.disabled.value;
    const currentPending = control.pending.value;
    const currentValid = control.valid.value;
    const currentInvalid = control.invalid.value;
    const currentTouched = control.touched.value;
    const currentShouldShowError = control.shouldShowError.value;

    // Проверяем, изменилось ли что-то
    // Используем shallowArrayEqual для errors т.к. валидация может создавать новые массивы
    const hasChanged =
      cache.value !== currentValue ||
      !shallowArrayEqual(cache.errors, currentErrors) ||
      cache.componentProps !== currentComponentProps ||
      cache.disabled !== currentDisabled ||
      cache.pending !== currentPending ||
      cache.valid !== currentValid ||
      cache.invalid !== currentInvalid ||
      cache.touched !== currentTouched ||
      cache.shouldShowError !== currentShouldShowError;

    // Если ничего не изменилось, возвращаем кешированный snapshot
    if (!hasChanged && cache.snapshot) {
      return cache.snapshot;
    }

    // Обновляем кеш
    cache.value = currentValue;
    cache.errors = currentErrors;
    cache.componentProps = currentComponentProps;
    cache.disabled = currentDisabled;
    cache.pending = currentPending;
    cache.valid = currentValid;
    cache.invalid = currentInvalid;
    cache.touched = currentTouched;
    cache.shouldShowError = currentShouldShowError;

    // Создаём новый snapshot
    cache.snapshot = {
      value: currentValue,
      pending: currentPending,
      disabled: currentDisabled,
      errors: currentErrors,
      valid: currentValid,
      invalid: currentInvalid,
      touched: currentTouched,
      shouldShowError: currentShouldShowError,
      componentProps: currentComponentProps,
    };

    return cache.snapshot;
  }, [control]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Внутренний хук для ArrayNode с использованием useSyncExternalStore
 * @internal
 */
function useArrayControl<T extends FormFields>(
  control: ArrayNode<T>
): ArrayControlState<T> {
  // Кеш для предотвращения лишних ре-рендеров
  const cacheRef = useRef<{
    snapshot: ArrayControlState<T> | null;
    value: T[];
    length: number;
    errors: ValidationError[];
    pending: boolean;
    valid: boolean;
    invalid: boolean;
    touched: boolean;
    dirty: boolean;
  }>({
    snapshot: null,
    value: control.value.value,
    length: control.length.value,
    errors: control.errors.value,
    pending: control.pending.value,
    valid: control.valid.value,
    invalid: control.invalid.value,
    touched: control.touched.value,
    dirty: control.dirty.value,
  });

  // Функция подписки
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let isFirstRun = true;

      const dispose = effect(() => {
        // Читаем все сигналы
        control.value.value;
        control.length.value;
        control.errors.value;
        control.pending.value;
        control.valid.value;
        control.invalid.value;
        control.touched.value;
        control.dirty.value;

        if (isFirstRun) {
          isFirstRun = false;
          return;
        }

        onStoreChange();
      });

      return dispose;
    },
    [control]
  );

  // Функция получения текущего состояния
  const getSnapshot = useCallback((): ArrayControlState<T> => {
    const cache = cacheRef.current;

    const currentValue = control.value.value;
    const currentLength = control.length.value;
    const currentErrors = control.errors.value;
    const currentPending = control.pending.value;
    const currentValid = control.valid.value;
    const currentInvalid = control.invalid.value;
    const currentTouched = control.touched.value;
    const currentDirty = control.dirty.value;

    const hasChanged =
      cache.value !== currentValue ||
      cache.length !== currentLength ||
      !shallowArrayEqual(cache.errors, currentErrors) ||
      cache.pending !== currentPending ||
      cache.valid !== currentValid ||
      cache.invalid !== currentInvalid ||
      cache.touched !== currentTouched ||
      cache.dirty !== currentDirty;

    if (!hasChanged && cache.snapshot) {
      return cache.snapshot;
    }

    cache.value = currentValue;
    cache.length = currentLength;
    cache.errors = currentErrors;
    cache.pending = currentPending;
    cache.valid = currentValid;
    cache.invalid = currentInvalid;
    cache.touched = currentTouched;
    cache.dirty = currentDirty;

    cache.snapshot = {
      value: currentValue,
      length: currentLength,
      pending: currentPending,
      errors: currentErrors,
      valid: currentValid,
      invalid: currentInvalid,
      touched: currentTouched,
      dirty: currentDirty,
    };

    return cache.snapshot;
  }, [control]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ============================================================================
// Хук для получения только значения (без подписки на другие сигналы)
// ============================================================================

/**
 * Хук для получения только значения поля без подписки на errors, valid и т.д.
 * Используйте когда нужно только значение для условного рендеринга.
 *
 * @group React Hooks
 */
export function useFormControlValue<T extends FormValue>(control: FieldNode<T>): T {
  const cacheRef = useRef<{ value: T; snapshot: T }>({
    value: control.value.value,
    snapshot: control.value.value,
  });

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let isFirstRun = true;

      const dispose = effect(() => {
        control.value.value; // Подписываемся ТОЛЬКО на value

        if (isFirstRun) {
          isFirstRun = false;
          return;
        }

        onStoreChange();
      });

      return dispose;
    },
    [control]
  );

  const getSnapshot = useCallback((): T => {
    const currentValue = control.value.value;

    if (cacheRef.current.value === currentValue) {
      return cacheRef.current.snapshot;
    }

    cacheRef.current.value = currentValue;
    cacheRef.current.snapshot = currentValue;
    return currentValue;
  }, [control]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ============================================================================
// Перегрузки функции
// ============================================================================

/**
 * Хук для работы с ArrayNode - возвращает состояние массива с подписками на сигналы
 * @group React Hooks
 */
export function useFormControl<T extends FormFields>(
  control: ArrayNode<T> | undefined
): ArrayControlState<T>;

/**
 * Хук для работы с FieldNode - возвращает состояние поля с подписками на сигналы
 * @group React Hooks
 */
export function useFormControl<T extends FormValue>(control: FieldNode<T>): FieldControlState<T>;

/**
 * Хук для работы с FieldNode или ArrayNode - возвращает состояние с подписками на сигналы
 *
 * Использует useSyncExternalStore для оптимальной интеграции с React 18+.
 * Компонент ре-рендерится только когда реально изменились данные контрола.
 *
 * @group React Hooks
 *
 * @example FieldNode
 * ```tsx
 * const { value, errors, componentProps } = useFormControl(control);
 *
 * return (
 *   <div>
 *     <input value={value} onChange={e => control.setValue(e.target.value)} />
 *     {errors.length > 0 && <span>{errors[0].message}</span>}
 *   </div>
 * );
 * ```
 *
 * @example ArrayNode
 * ```tsx
 * const { length } = useFormControl(arrayControl);
 *
 * return (
 *   <div>
 *     {arrayControl.map((item, index) => (
 *       <ItemComponent key={item.id || index} control={item} />
 *     ))}
 *     {length === 0 && <span>Список пуст</span>}
 *   </div>
 * );
 * ```
 */
export function useFormControl(
  control: FieldNode<FormValue> | ArrayNode<FormFields> | undefined
): FieldControlState<FormValue> | ArrayControlState<FormFields> {
  // Определяем тип контрола по наличию специфичных свойств
  const isArrayNode = control && 'length' in control && 'map' in control;

  // Для undefined контрола возвращаем дефолтное состояние
  if (!control) {
    return {
      value: [],
      length: 0,
      pending: false,
      errors: [],
      valid: true,
      invalid: false,
      touched: false,
      dirty: false,
    } as ArrayControlState<FormFields>;
  }

  if (isArrayNode) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useArrayControl(control as ArrayNode<FormFields>);
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useFieldControl(control as FieldNode<FormValue>);
}
