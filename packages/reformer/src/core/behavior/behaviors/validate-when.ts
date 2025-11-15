/**
 * Conditional field validation behavior
 */

import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import { createValidateBehavior, type ValidateWhenOptions } from '../behavior-factories';

/**
 * Условная валидация поля
 * Валидация выполняется только когда условие истинно
 *
 * @param field - Поле для валидации
 * @param condition - Функция условия (true = validate, false = skip)
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Валидировать propertyValue только для ипотеки
 *   validateWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
 *     clearErrorsWhenInactive: true
 *   });
 *
 *   // Валидировать carModel только если выбран автокредит
 *   validateWhen(path.carModel, (form) => form.loanType === 'car');
 * };
 * ```
 */
export function validateWhen<TForm extends Record<string, any>>(
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean,
  options?: ValidateWhenOptions & { debounce?: number }
): void {
  const { debounce } = options || {};

  const handler = createValidateBehavior(field, condition, options);
  getCurrentBehaviorRegistry().register(handler, { debounce });
}

/**
 * Инвертированная версия validateWhen
 * Пропускает валидацию когда условие истинно
 *
 * @param field - Поле для валидации
 * @param condition - Функция условия (true = skip validation, false = validate)
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Пропустить валидацию propertyValue если НЕ ипотека
 *   skipValidationWhen(path.propertyValue, (form) => form.loanType !== 'mortgage');
 * };
 * ```
 */
export function skipValidationWhen<TForm extends Record<string, any>>(
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean,
  options?: ValidateWhenOptions & { debounce?: number }
): void {
  // Инвертируем условие
  validateWhen(field, (form) => !condition(form), options);
}

export type { ValidateWhenOptions };
