/**
 * Conditional field reset behavior
 */

import { effect } from '@preact/signals-core';
import type { FieldPathNode, FormFields, FormValue } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { BehaviorHandlerFn } from '../types';

/**
 * Опции для resetWhen
 */
export interface ResetWhenOptions {
  /** Значение для сброса (по умолчанию null) */
  resetValue?: FormValue;
  /** Сбросить только если поле dirty */
  onlyIfDirty?: boolean;
}

/**
 * Условный сброс поля при выполнении условия
 *
 * @param field - Поле для сброса
 * @param condition - Функция условия (true = reset)
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Сбросить поле при изменении типа кредита
 *   resetWhen(path.propertyValue, (form) => form.loanType !== 'mortgage');
 *
 *   // Сбросить с кастомным значением
 *   resetWhen(path.initialPayment, (form) => !form.propertyValue, {
 *     resetValue: 0
 *   });
 *
 *   // Сбросить только если поле было изменено пользователем
 *   resetWhen(path.carPrice, (form) => form.loanType !== 'car', {
 *     onlyIfDirty: true
 *   });
 * };
 * ```
 */
export function resetWhen<TForm extends FormFields>(
  field: FieldPathNode<TForm, FormValue>,
  condition: (form: TForm) => boolean,
  options?: ResetWhenOptions & { debounce?: number }
): void {
  const { debounce, resetValue = null, onlyIfDirty = false } = options || {};

  const handler: BehaviorHandlerFn<TForm> = (form, _context, withDebounce) => {
    const targetNode = form.getFieldByPath(field.__path);
    if (!targetNode) return null;

    return effect(() => {
      const formValue = form.value.value;

      withDebounce(() => {
        const shouldReset = condition(formValue);

        if (shouldReset) {
          // Проверяем onlyIfDirty опцию
          if (onlyIfDirty && !targetNode.dirty.value) {
            return;
          }

          // Сбрасываем значение
          targetNode.setValue(resetValue);

          // Сбрасываем флаги dirty и touched
          targetNode.markAsPristine();
          targetNode.markAsUntouched();
        }
      });
    });
  };

  getCurrentBehaviorRegistry().register(handler, { debounce });
}
