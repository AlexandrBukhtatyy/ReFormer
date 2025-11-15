/**
 * Computed fields
 */

import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { ComputeFromOptions } from '../types';
import { createComputeBehavior } from '../behavior-factories';

/**
 * Автоматически вычисляет значение поля на основе других полей
 *
 * @param target - Поле для записи результата
 * @param sources - Массив полей-зависимостей
 * @param computeFn - Функция вычисления (принимает параметры напрямую)
 * @param options - Опции
 *
 * ✅ ОБНОВЛЕНО: computeFn теперь принимает параметры напрямую (type-safe)
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Автоматический расчет минимального взноса
 *   computeFrom(
 *     path.initialPayment,
 *     [path.propertyValue],
 *     (propertyValue) => propertyValue ? propertyValue * 0.2 : null, // ← Параметр напрямую
 *     { debounce: 300 }
 *   );
 *
 *   // Общая стоимость = цена * количество
 *   computeFrom(
 *     path.total,
 *     [path.price, path.quantity],
 *     (price, quantity) => price * quantity // ← Параметры напрямую
 *   );
 * };
 * ```
 */
export function computeFrom<TForm extends Record<string, any>, TTarget>(
  target: FieldPathNode<TForm, TTarget>,
  sources: FieldPathNode<TForm, any>[],
  computeFn: (...values: any[]) => TTarget,
  options?: ComputeFromOptions<TForm>
): void {
  const { debounce } = options || {};

  // ✅ Передаем computeFn напрямую без обертки
  const handler = createComputeBehavior(target, sources, computeFn, options);
  getCurrentBehaviorRegistry().register(handler, { debounce });
}
