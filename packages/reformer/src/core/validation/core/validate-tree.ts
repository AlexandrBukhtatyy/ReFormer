/**
 * Cross-field валидация
 */

import { TreeValidatorFn, ValidateTreeOptions } from '../../types';
import { getCurrentValidationRegistry } from '../../utils/registry-helpers';

/**
 * Зарегистрировать cross-field валидатор
 *
 * Используется для валидации, которая зависит от нескольких полей
 *
 * @example
 * ```typescript
 * validateTree(
 *   (ctx) => {
 *     const form = ctx.formValue();
 *     if (form.initialPayment && form.propertyValue) {
 *       if (form.initialPayment > form.propertyValue) {
 *         return {
 *           code: 'initialPaymentTooHigh',
 *           message: 'Первоначальный взнос не может превышать стоимость',
 *         };
 *       }
 *     }
 *     return null;
 *   },
 *   { targetField: 'initialPayment' }
 * );
 * ```
 */
export function validateTree<TForm>(
  validatorFn: TreeValidatorFn<TForm>,
  options?: ValidateTreeOptions
): void {
  getCurrentValidationRegistry().registerTree(validatorFn, options);
}
