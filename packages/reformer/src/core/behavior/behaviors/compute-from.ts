/**
 * Вычисляемые поля
 *
 * @group Behaviors
 * @category Behavior Rules
 * @module behaviors/computeFrom
 */

import { effect } from '@preact/signals-core';
import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import { runOutsideEffect } from '../../utils/safe-effect';
import type { ComputeFromOptions, BehaviorHandlerFn } from '../types';

/**
 * Автоматически вычисляет значение поля на основе других полей
 *
 * @group Behaviors
 * @category Behavior Rules
 *
 * @param sources - Массив полей-зависимостей
 * @param target - Поле для записи результата
 * @param computeFn - Функция вычисления (принимает объект с именами полей)
 * @param options - Опции (`debounce`, `condition`, `trigger`)
 *
 * @example Многополевой расчёт — total = price × quantity
 * ```typescript
 * import { computeFrom, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface OrderForm {
 *   price: number;
 *   quantity: number;
 *   total: number;
 * }
 *
 * export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
 *   computeFrom(
 *     [path.price, path.quantity],
 *     path.total,
 *     (values) =>
 *       (typeof values.price === 'number' ? values.price : 0) *
 *       (typeof values.quantity === 'number' ? values.quantity : 0),
 *   );
 * };
 * ```
 *
 * @example Edge case — async-like дорогие вычисления с `debounce` и условием
 * ```typescript
 * import { computeFrom, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface MortgageForm {
 *   loanType: 'mortgage' | 'consumer';
 *   loanAmount: number;
 *   loanTerm: number;
 *   interestRate: number;
 *   monthlyPayment: number;
 * }
 *
 * function annuity(values: MortgageForm): number {
 *   const { loanAmount, loanTerm, interestRate } = values;
 *   if (!loanAmount || !loanTerm || !interestRate) return 0;
 *   const r = interestRate / 100 / 12;
 *   const n = loanTerm;
 *   return Math.round((loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
 * }
 *
 * export const mortgageBehavior: BehaviorSchemaFn<MortgageForm> = (path) => {
 *   computeFrom(
 *     [path.loanAmount, path.loanTerm, path.interestRate],
 *     path.monthlyPayment,
 *     annuity,
 *     {
 *       debounce: 300,                                  // не пересчитываем на каждый keystroke
 *       condition: (form) => form.loanType === 'mortgage', // считаем только для ипотеки
 *     },
 *   );
 * };
 * ```
 *
 * @see [docs/llms/20-compute-vs-watch.md](../../../../docs/llms/20-compute-vs-watch.md)
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
      // Читаем значения всех source полей для создания зависимости
      // (effect будет перезапускаться при изменении любого из них)
      sourceNodes.forEach((node) => node.value.value);

      withDebounce(() => {
        // Проверка условия
        if (condition) {
          const formValue = form.getValue();
          if (!condition(formValue)) return;
        }

        // Читаем СВЕЖИЕ значения внутри debounce callback
        // Это решает race condition: если источники изменились за время debounce,
        // мы используем актуальные значения, а не устаревшие
        const freshSourceValues = sourceNodes.map((node) => node.value.value);

        // Создаем объект с именами полей для computeFn
        // computeFn ожидает объект вида { fieldName: value, ... }
        const sourceValuesObject: Record<string, unknown> = {};
        sources.forEach((source, index) => {
          // Извлекаем имя поля из пути (последний сегмент)
          const fieldName = source.__path.split('.').pop() || source.__path;
          sourceValuesObject[fieldName] = freshSourceValues[index];
        });

        // Вычисляем новое значение
        const computedValue = computeFn(sourceValuesObject as TForm);

        // Читаем текущее значение target БЕЗ создания зависимости через peek()
        // Это предотвращает бесконечный цикл: effect зависит только от sources
        const currentTargetValue = targetNode.value.peek();

        // Устанавливаем значение только если оно отличается от текущего
        if (currentTargetValue !== computedValue) {
          // runOutsideEffect выходит из контекста effect, предотвращая "Cycle detected"
          runOutsideEffect(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            targetNode.setValue(computedValue as any, { emitEvent: false });
          });
        }
      });
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getCurrentBehaviorRegistry().register(handler as any, { debounce });
}
