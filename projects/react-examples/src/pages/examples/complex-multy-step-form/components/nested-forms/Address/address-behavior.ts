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

import { watchField, type BehaviorSchemaFn } from '@/lib/forms/core/behaviors';
import type { Address } from './AddressForm';
import type { FieldPath } from '@/lib/forms/core/types';

// API функции (заглушки, т.к. в примере они импортируются из domain API)
// В реальном приложении эти функции будут в domains/credit-applications/api
const fetchCities = async (region: string): Promise<string[]> => {
  console.log('Fetching cities for region:', region);
  return ['Москва', 'Одинцово', 'Химки'];
};

/**
 * Behavior схема для Address
 *
 * Применяется к вложенным полям типа Address через композицию:
 * ```typescript
 * apply([path.registrationAddress, path.residenceAddress], addressBehavior);
 * ```
 */
export const addressBehavior: BehaviorSchemaFn<Address> = (
  path: FieldPath<Address>
) => {
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
        const cities = await fetchCities(region);
        ctx.updateComponentProps(path.city, { options: cities });

        if (import.meta.env.DEV) {
          console.log(`[addressBehavior] Loaded ${cities.length} cities for region:`, region);
        }
      }
    },
    { debounce: 300, immediate: false }
  );

  // ===================================================================
  // 2. Очистка зависимых полей
  // ===================================================================

  // Очистить город при изменении региона
  watchField(path.region, (_region, ctx) => {
    // Очищаем город только если регион изменился
    ctx.setField('city', '');

    if (import.meta.env.DEV) {
      console.log('[addressBehavior] Region changed, clearing city');
    }
  });

  // ===================================================================
  // 3. Валидация почтового индекса (опционально)
  // ===================================================================

  // Можно добавить автоформатирование почтового индекса
  watchField(path.postalCode, (postalCode, ctx) => {
    // Убираем все кроме цифр и ограничиваем длину
    const cleaned = postalCode?.replace(/\D/g, '').slice(0, 6);
    if (cleaned !== postalCode) {
      ctx.setField('postalCode', cleaned || '');
    }
  });
};
