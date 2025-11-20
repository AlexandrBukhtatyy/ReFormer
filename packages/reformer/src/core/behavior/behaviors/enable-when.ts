/**
 * Conditional enable/disable fields
 */

import { effect } from '@preact/signals-core';
import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { EnableWhenOptions, BehaviorHandlerFn } from '../types';

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
export function enableWhen<TForm>(
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean,
  options?: EnableWhenOptions
): void {
  const { debounce, resetOnDisable = false } = options || {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler: BehaviorHandlerFn<any> = (form, _context, withDebounce) => {
    const targetNode = form.getFieldByPath(field.__path);
    if (!targetNode) return null;

    return effect(() => {
      const formValue = form.value.value;

      withDebounce(() => {
        const shouldEnable = condition(formValue);

        if (shouldEnable) {
          targetNode.enable();
        } else {
          targetNode.disable();
          if (resetOnDisable) {
            targetNode.reset();
          }
        }
      });
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getCurrentBehaviorRegistry().register(handler as any, { debounce });
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
export function disableWhen<TForm>(
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean,
  options?: EnableWhenOptions
): void {
  // Инвертируем условие
  enableWhen(field, (form) => !condition(form), options);
}
