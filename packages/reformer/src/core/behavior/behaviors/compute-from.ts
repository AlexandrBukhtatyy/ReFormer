/**
 * Computed fields
 */

import { effect } from '@preact/signals-core';
import type { FormNode } from '../../nodes/form-node';
import type { FieldPathNode, FormValue } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { ComputeFromOptions, BehaviorHandlerFn } from '../types';

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
export function computeFrom<TForm extends Record<string, FormValue>, TTarget extends FormValue>(
  target: FieldPathNode<TForm, TTarget>,
  sources: FieldPathNode<TForm, FormValue>[],
  computeFn: (values: Record<string, unknown>) => TTarget,
  options?: ComputeFromOptions<TForm>
): void {
  const { debounce, condition } = options || {};

  const handler: BehaviorHandlerFn<TForm> = (form, _context, withDebounce) => {
    const targetNode = form.getFieldByPath(target.__path);
    if (!targetNode) return null;

    // Разрешаем source узлы
    const sourceNodes = sources
      .map((field) => form.getFieldByPath(field.__path))
      .filter((node): node is FormNode<FormValue> => node !== undefined);

    if (sourceNodes.length === 0) return null;

    return effect(() => {
      // Читаем значения всех source полей
      const sourceValues = sourceNodes.map((node) => node!.value.value);

      withDebounce(() => {
        // Проверка условия
        if (condition) {
          const formValue = form.getValue();
          if (!condition(formValue)) return;
        }

        // Создаем объект с именами полей для computeFn
        // computeFn ожидает объект вида { fieldName: value, ... }
        const sourceValuesObject: Record<string, unknown> = {};
        sources.forEach((source, index) => {
          // Извлекаем имя поля из пути (последний сегмент)
          const fieldName = source.__path.split('.').pop() || source.__path;
          sourceValuesObject[fieldName] = sourceValues[index];
        });

        // Вычисляем новое значение
        const computedValue = computeFn(sourceValuesObject);

        // Устанавливаем значение без триггера событий
        targetNode.setValue(computedValue, { emitEvent: false });
      });
    });
  };

  getCurrentBehaviorRegistry().register(handler, { debounce });
}
