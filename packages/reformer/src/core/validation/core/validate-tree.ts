/**
 * Cross-field валидация
 */

import { getCurrentValidationRegistry } from '../../utils/registry-helpers';
import type {
  TreeValidatorFn,
  ValidateTreeOptions,
} from '../../types/validation-schema';

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
export function validateTree<TForm = any>(
  validatorFn: TreeValidatorFn<TForm>,
  options?: ValidateTreeOptions
): void {
  getCurrentValidationRegistry().registerTree(validatorFn, options);
}
