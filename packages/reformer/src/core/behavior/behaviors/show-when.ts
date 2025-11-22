/**
 * Условное отображение/скрытие полей
 * @module behaviors/showWhen
 */

import type { FieldPathNode, FormFields, FormValue } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { BehaviorHandlerFn } from '../types';

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
export function showWhen<TForm extends FormFields>(
  _field: FieldPathNode<TForm, FormValue>,
  _condition: (form: TForm) => boolean
): void {
  const handler: BehaviorHandlerFn<TForm> = (_form, _context, _withDebounce) => {
    if (import.meta.env.DEV) {
      console.warn(
        'BehaviorRegistry: "show" behavior is not implemented yet. Use "enable" instead.'
      );
    }
    return null;
  };

  getCurrentBehaviorRegistry().register(handler);
}

/**
 * Условное скрытие поля (инверсия showWhen)
 *
 * @param field - Поле для скрытия
 * @param condition - Функция условия (true = hide, false = show)
 */
export function hideWhen<TForm extends FormFields>(
  field: FieldPathNode<TForm, FormValue>,
  condition: (form: TForm) => boolean
): void {
  // Инвертируем условие
  showWhen(field, (form) => !condition(form));
}
