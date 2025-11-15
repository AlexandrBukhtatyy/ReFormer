/**
 * Revalidate fields on changes
 */

import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { RevalidateWhenOptions } from '../types';
import { createRevalidateBehavior } from '../behavior-factories';

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

  const handler = createRevalidateBehavior(target, triggers, options);
  getCurrentBehaviorRegistry().register(handler, { debounce });
}
