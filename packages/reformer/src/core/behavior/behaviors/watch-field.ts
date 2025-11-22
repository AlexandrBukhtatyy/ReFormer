/**
 * Watch field changes
 */

import { effect } from '@preact/signals-core';
import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { BehaviorContext, WatchFieldOptions, BehaviorHandlerFn } from '../types';

/**
 * Выполняет callback при изменении поля
 *
 * @param field - Поле для отслеживания
 * @param callback - Функция обратного вызова
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Динамическая загрузка городов при изменении страны
 *   watchField(path.registrationAddress.country, async (country, ctx) => {
 *     if (country) {
 *       const cities = await fetchCities(country);
 *       ctx.updateComponentProps(path.registrationAddress.city, {
 *         options: cities
 *       });
 *     }
 *   });
 * };
 * ```
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
    if (immediate) {
      const value = node.value.value as TField;
      callback(value, context);
    }

    return effect(() => {
      const value = node.value.value as TField;

      withDebounce(() => {
        callback(value, context);
      });
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getCurrentBehaviorRegistry().register(handler as any, { debounce });
}
