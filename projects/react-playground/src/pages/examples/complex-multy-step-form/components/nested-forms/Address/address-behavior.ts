/**
 * Behavior Schema для Address (адрес)
 *
 * Модульная схема поведения, которая может быть применена
 * к любому полю типа Address через композицию.
 *
 * Содержит:
 * - Динамическую загрузку регионов при изменении страны
 * - Динамическую загрузку городов при изменении региона
 * - Очистку зависимых полей при изменении вышестоящих
 */

import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { Address } from './AddressForm';
import type { FieldPath } from 'reformer';
import { fetchCities } from '../../../api';

/**
 * Behavior схема для Address
 *
 * Применяется к вложенным полям типа Address через композицию:
 * ```typescript
 * apply([path.registrationAddress, path.residenceAddress], addressBehavior);
 * ```
 */
export const addressBehavior: BehaviorSchemaFn<Address> = (path: FieldPath<Address>) => {
  // ===================================================================
  // 1. Динамическая загрузка данных
  // ===================================================================

  // Загрузка регионов при изменении страны (если будет поле country)
  // Пока Address не имеет поля country, но это демонстрирует паттерн
  // watchField(path.country, async (country, ctx) => {
  //   if (country) {
  //     const regions = await fetchRegions(country);
  //     ctx.updateComponentProps(path.region, { options: regions });
  //   }
  // }, { debounce: 300 });

  // Загрузка городов при изменении региона
  watchField(
    path.region,
    async (region, ctx) => {
      if (region) {
        try {
          const { data: cities } = await fetchCities(region);
          ctx.form.city.updateComponentProps({ options: cities });

          if (import.meta.env.DEV) {
            console.log(`[addressBehavior] Loaded ${cities.length} cities for region:`, region);
          }
        } catch (error) {
          console.error('[addressBehavior] Failed to load cities:', error);
          ctx.form.city.updateComponentProps({ options: [] });
        }
      }
    },
    { debounce: 300, immediate: false }
  );

  // ===================================================================
  // 2. Очистка зависимых полей
  // ===================================================================

  // Очистить город при изменении региона
  watchField(
    path.region,
    (_region, ctx) => {
      // Очищаем город только если регион изменился
      ctx.setFieldValue('city', '');

      if (import.meta.env.DEV) {
        console.log('[addressBehavior] Region changed, clearing city');
      }
    },
    { immediate: false }
  );

  // ===================================================================
  // 3. Валидация почтового индекса (опционально)
  // ===================================================================

  // Можно добавить автоформатирование почтового индекса
  watchField(
    path.postalCode,
    (postalCode, ctx) => {
      // Убираем все кроме цифр и ограничиваем длину
      const cleaned = postalCode?.replace(/\D/g, '').slice(0, 6);
      if (cleaned !== postalCode) {
        ctx.setFieldValue('postalCode', cleaned || '');
      }
    },
    { immediate: false }
  );
};
