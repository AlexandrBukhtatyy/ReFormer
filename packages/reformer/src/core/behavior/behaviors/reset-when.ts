/**
 * Conditional field reset behavior
 */

import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import { createResetBehavior, type ResetWhenOptions } from '../behavior-factories';

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
export function resetWhen<TForm extends Record<string, any>>(
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean,
  options?: ResetWhenOptions & { debounce?: number }
): void {
  const { debounce } = options || {};

  const handler = createResetBehavior(field, condition, options);
  getCurrentBehaviorRegistry().register(handler, { debounce });
}

export type { ResetWhenOptions };
