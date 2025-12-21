/**
 * Cross-field валидация
 *
 * @group Validation
 * @category Core Functions
 */

import { TreeValidatorFn, ValidateTreeOptions } from '../../types';
import { getCurrentValidationRegistry } from '../../utils/registry-helpers';

/**
 * Зарегистрировать cross-field валидатор
 *
 * Используется для валидации, которая зависит от нескольких полей
 *
 * @group Validation
 * @category Core Functions
 *
 * @remarks
 * Параметр `ctx` в callback требует явной типизации для корректного вывода типов:
 * ```typescript
 * validateTree((ctx: { form: MyFormType }) => { ... });
 * ```
 *
 * @example
 * ```typescript
 * // Явная типизация ctx для избежания implicit any
 * validateTree(
 *   (ctx: { form: MyForm }) => {
 *     if (ctx.form.initialPayment && ctx.form.propertyValue) {
 *       if (ctx.form.initialPayment > ctx.form.propertyValue) {
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
