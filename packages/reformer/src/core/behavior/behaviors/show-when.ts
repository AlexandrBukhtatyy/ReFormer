/**
 * Conditional show/hide fields
 */

import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import { createShowBehavior } from '../behavior-factories';

/**
 * Условное отображение поля (устанавливает hidden флаг)
 *
 * @param field - Поле для отображения/скрытия
 * @param condition - Функция условия (true = show, false = hide)
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   showWhen(path.propertyValue, (form) => form.loanType === 'mortgage');
 * };
 *
 * // В JSX
 * {!form.propertyValue.componentProps.value.hidden && (
 *   <FormField control={form.propertyValue} />
 * )}
 * ```
 */
export function showWhen<TForm extends Record<string, any>>(
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean
): void {
  const handler = createShowBehavior(field, condition);
  getCurrentBehaviorRegistry().register(handler);
}

/**
 * Условное скрытие поля (инверсия showWhen)
 *
 * @param field - Поле для скрытия
 * @param condition - Функция условия (true = hide, false = show)
 */
export function hideWhen<TForm extends Record<string, any>>(
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean
): void {
  // Инвертируем условие
  showWhen(field, (form) => !condition(form));
}
