/**
 * Watch field changes
 */

import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { BehaviorContext, WatchFieldOptions } from '../types';
import { createWatchBehavior } from '../behavior-factories';

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
export function watchField<TForm extends Record<string, any>, TField>(
  field: FieldPathNode<TForm, TField>,
  callback: (value: TField, ctx: BehaviorContext<TForm>) => void | Promise<void>,
  options?: WatchFieldOptions
): void {
  const { debounce } = options || {};

  const handler = createWatchBehavior(field, callback, options);
  getCurrentBehaviorRegistry().register(handler, { debounce });
}
