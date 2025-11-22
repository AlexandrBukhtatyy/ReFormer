/**
 * Computed fields
 */

import { effect } from '@preact/signals-core';
import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { ComputeFromOptions, BehaviorHandlerFn } from '../types';

/**
 * Автоматически вычисляет значение поля на основе других полей
 *
 * @param sources - Массив полей-зависимостей
 * @param target - Поле для записи результата
 * @param computeFn - Функция вычисления (принимает объект с именами полей)
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Автоматический расчет минимального взноса
 *   computeFrom(
 *     [path.propertyValue],
 *     path.initialPayment,
 *     (values) => values.propertyValue ? values.propertyValue * 0.2 : null,
 *     { debounce: 300 }
 *   );
 *
 *   // Общая стоимость = цена * количество
 *   computeFrom(
 *     [path.price, path.quantity],
 *     path.total,
 *     (values) => values.price * values.quantity
 *   );
 * };
 * ```
 */
export function computeFrom<TForm, TTarget>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sources: FieldPathNode<TForm, any>[],
  target: FieldPathNode<TForm, TTarget>,
  computeFn: (values: TForm) => TTarget,
  options?: ComputeFromOptions<TForm>
): void {
  const { debounce, condition } = options || {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler: BehaviorHandlerFn<any> = (form, _context, withDebounce) => {
    const targetNode = form.getFieldByPath(target.__path);
    if (!targetNode) return null;

    // Разрешаем source узлы
    const sourceNodes = sources
      .map((field) => form.getFieldByPath(field.__path))
      .filter((node) => node !== undefined);

    if (sourceNodes.length === 0) return null;

    return effect(() => {
      // Читаем значения всех source полей
      const sourceValues = sourceNodes.map((node) => node.value.value);

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
        const computedValue = computeFn(sourceValuesObject as TForm);

        // Устанавливаем значение без триггера событий
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        targetNode.setValue(computedValue as any, { emitEvent: false });
      });
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getCurrentBehaviorRegistry().register(handler as any, { debounce });
}
