/**
 * Conditional enable/disable fields
 */

import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { EnableWhenOptions } from '../types';
import { createEnableBehavior } from '../behavior-factories';

/**
 * Условное включение поля на основе значений других полей
 *
 * @param field - Поле для включения/выключения
 * @param condition - Функция условия (true = enable, false = disable)
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Включить поле только для ипотеки
 *   enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
 *     resetOnDisable: true
 *   });
 * };
 * ```
 */
export function enableWhen<TForm extends Record<string, any>>(
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean,
  options?: EnableWhenOptions
): void {
  const { debounce } = options || {};

  const handler = createEnableBehavior(field, condition, options);
  getCurrentBehaviorRegistry().register(handler, { debounce });
}

/**
 * Условное выключение поля (инверсия enableWhen)
 *
 * @param field - Поле для выключения
 * @param condition - Функция условия (true = disable, false = enable)
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Выключить поле для потребительского кредита
 *   disableWhen(path.propertyValue, (form) => form.loanType === 'consumer');
 * };
 * ```
 */
export function disableWhen<TForm extends Record<string, any>>(
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean,
  options?: EnableWhenOptions
): void {
  // Инвертируем условие
  enableWhen(field, (form) => !condition(form), options);
}
