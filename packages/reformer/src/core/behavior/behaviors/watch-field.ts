/**
 * Отслеживание изменений поля
 *
 * @group Behaviors
 * @category Behavior Rules
 * @module behaviors/watchField
 */

import { effect } from '@preact/signals-core';
import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import { runOutsideEffect } from '../../utils/safe-effect';
import type { BehaviorContext, WatchFieldOptions, BehaviorHandlerFn } from '../types';

/**
 * Выполняет callback при изменении поля
 *
 * @group Behaviors
 * @category Behavior Rules
 *
 * @param field - Поле для отслеживания
 * @param callback - Функция обратного вызова
 * @param options - Опции (`debounce`, `immediate`)
 *
 * @example Async loader with try/catch + guard + debounce
 * ```typescript
 * import { watchField, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface AddressForm { region: string; city: string }
 *
 * export const addressBehavior: BehaviorSchemaFn<AddressForm> = (path) => {
 *   watchField(
 *     path.region,
 *     async (region, ctx) => {
 *       if (!region) {
 *         ctx.form.city.updateComponentProps({ options: [] });
 *         return; // guard: пустое значение не триггерит fetch
 *       }
 *       try {
 *         const { data: cities } = await fetchCities(region);
 *         ctx.form.city.updateComponentProps({ options: cities });
 *       } catch (error) {
 *         console.error('[addressBehavior] failed to load cities:', error);
 *         ctx.form.city.updateComponentProps({ options: [] });
 *       }
 *     },
 *     { immediate: false, debounce: 300 }, // обязательные опции для async
 *   );
 * };
 * ```
 *
 * @example Sync handler с консолидацией нескольких зависимостей в один watcher
 * ```typescript
 * import { watchField, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface InsuranceForm {
 *   insuranceType: 'casco' | 'osago' | 'property' | '';
 *   vehicleVin: string;
 *   propertyType: string;
 * }
 *
 * export const insuranceBehavior: BehaviorSchemaFn<InsuranceForm> = (path) => {
 *   // ОДИН watchField на trigger-поле — несколько watcher'ов на одно поле = "Cycle detected"
 *   watchField(
 *     path.insuranceType,
 *     (type, ctx) => {
 *       const isVehicle = type === 'casco' || type === 'osago';
 *       const isProperty = type === 'property';
 *
 *       // Guard — ставим только если состояние реально меняется
 *       if (isVehicle) {
 *         if (ctx.form.vehicleVin.disabled.value) ctx.form.vehicleVin.enable();
 *       } else {
 *         if (!ctx.form.vehicleVin.disabled.value) ctx.form.vehicleVin.disable();
 *         if (ctx.form.vehicleVin.getValue() !== '') ctx.form.vehicleVin.setValue('');
 *       }
 *
 *       if (isProperty) {
 *         if (ctx.form.propertyType.disabled.value) ctx.form.propertyType.enable();
 *       } else {
 *         if (!ctx.form.propertyType.disabled.value) ctx.form.propertyType.disable();
 *         if (ctx.form.propertyType.getValue() !== '') ctx.form.propertyType.setValue('');
 *       }
 *     },
 *     { immediate: false }, // CRITICAL: предотвращает запуск во время инициализации
 *   );
 * };
 * ```
 *
 * @see [docs/llms/22-cycle-detection.md](../../../../docs/llms/22-cycle-detection.md)
 */
export function watchField<TForm, TField>(
  field: FieldPathNode<TForm, TField>,
  callback: (value: TField, ctx: BehaviorContext<TForm>) => void | Promise<void>,
  options?: WatchFieldOptions
): void {
  const { debounce, immediate = false } = options || {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler: BehaviorHandlerFn<any> = (form, context, withDebounce) => {
    const node = form.getFieldByPath(field.__path);
    if (!node) return null;

    // Вызвать сразу если immediate: true
    // runOutsideEffect предотвращает "Cycle detected" - выходит из контекста effect
    if (immediate) {
      runOutsideEffect(() => {
        const value = node.value.value as TField;
        callback(value, context);
      });
    }

    return effect(() => {
      const value = node.value.value as TField;

      withDebounce(() => {
        // runOutsideEffect выходит из контекста effect, предотвращая "Cycle detected"
        // Это позволяет callback-ам модифицировать сигналы (reset, setValue, etc.)
        runOutsideEffect(() => callback(value, context));
      });
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getCurrentBehaviorRegistry().register(handler as any, { debounce });
}
