/**
 * Revalidate fields on changes
 */

import { effect } from '@preact/signals-core';
import type { FormNode } from '../../nodes/form-node';
import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { RevalidateWhenOptions, BehaviorHandlerFn } from '../types';

/**
 * Перевалидирует поле при изменении других полей
 *
 * @param target - Поле для перевалидации
 * @param triggers - Поля-триггеры
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Перевалидировать initialPayment при изменении propertyValue
 *   revalidateWhen(path.initialPayment, [path.propertyValue], {
 *     debounce: 300
 *   });
 * };
 * ```
 */
export function revalidateWhen<TForm extends Record<string, any>>(
  target: FieldPathNode<TForm, any>,
  triggers: FieldPathNode<TForm, any>[],
  options?: RevalidateWhenOptions
): void {
  const { debounce } = options || {};

  const handler: BehaviorHandlerFn<TForm> = (form, _context, withDebounce) => {
    const targetNode = form.getFieldByPath(target.__path);
    if (!targetNode) return null;

    const sourceNodes = triggers
      .map((field) => form.getFieldByPath(field.__path))
      .filter((node): node is FormNode<any> => node !== undefined);

    if (sourceNodes.length === 0) return null;

    return effect(() => {
      // Отслеживаем изменения source полей
      sourceNodes.forEach((node) => node.value.value);

      withDebounce(() => {
        // Перезапускаем валидацию target поля
        targetNode.validate();
      });
    });
  };

  getCurrentBehaviorRegistry().register(handler, { debounce });
}
