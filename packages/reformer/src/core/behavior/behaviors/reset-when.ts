/**
 * Условный сброс полей
 *
 * @group Behaviors
 * @category Behavior Rules
 * @module behaviors/resetWhen
 */

import { effect } from '@preact/signals-core';
import type { FieldPathNode, FormFields, FormValue } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import { runOutsideEffect } from '../../utils/safe-effect';
import type { BehaviorHandlerFn } from '../types';

/**
 * Опции для resetWhen
 *
 * @group Behaviors
 * @category Behavior Types
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
 * @group Behaviors
 * @category Behavior Rules
 *
 * @param field - Поле для сброса
 * @param condition - Функция условия (true = reset)
 * @param options - Опции (`resetValue`, `onlyIfDirty`, `debounce`)
 *
 * @example Сброс зависимого поля при смене типа платежа
 * ```typescript
 * import { resetWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface CheckoutForm {
 *   paymentType: 'card' | 'cash';
 *   cardNumber: string;
 * }
 *
 * export const checkoutBehavior: BehaviorSchemaFn<CheckoutForm> = (path) => {
 *   // Когда выбрано НЕ card — обнуляем номер карты в пустую строку
 *   resetWhen(path.cardNumber, (form) => form.paymentType !== 'card', {
 *     resetValue: '',
 *   });
 * };
 * ```
 *
 * @example `onlyIfDirty` — не трогаем нетронутые initial значения
 * ```typescript
 * import { resetWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface CarForm {
 *   loanType: 'mortgage' | 'car' | 'consumer';
 *   carPrice: number;
 * }
 *
 * export const carBehavior: BehaviorSchemaFn<CarForm> = (path) => {
 *   // Если пользователь не вводил carPrice — оставляем default из схемы.
 *   // Сбрасываем только если поле dirty (была пользовательская правка).
 *   resetWhen(path.carPrice, (form) => form.loanType !== 'car', {
 *     resetValue: 0,
 *     onlyIfDirty: true,
 *   });
 * };
 * ```
 *
 * @see [docs/llms/25-reset-when.md](../../../../docs/llms/25-reset-when.md)
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

          // runOutsideEffect выходит из контекста effect, предотвращая "Cycle detected"
          runOutsideEffect(() => {
            // Сбрасываем значение
            targetNode.setValue(resetValue);

            // Сбрасываем флаги dirty и touched
            targetNode.markAsPristine();
            targetNode.markAsUntouched();
          });
        }
      });
    });
  };

  getCurrentBehaviorRegistry().register(handler, { debounce });
}
