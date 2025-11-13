/**
 * Загрузка регионов для выбранной страны
 */

import type { Option } from '../types/option';

/**
 * Загрузка регионов для выбранной страны
 * @param country - код страны
 * @returns Promise с массивом регионов
 */
export async function fetchRegions(country: string): Promise<Option[]> {
  // Имитация задержки API запроса
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Моковые данные
  const regionsByCountry: Record<string, Option[]> = {
    RU: [
      { value: 'moscow', label: 'Москва' },
      { value: 'spb', label: 'Санкт-Петербург' },
      { value: 'ekaterinburg', label: 'Екатеринбург' },
      { value: 'kazan', label: 'Казань' },
      { value: 'novosibirsk', label: 'Новосибирск' },
    ],
    KZ: [
      { value: 'almaty', label: 'Алматы' },
      { value: 'astana', label: 'Нур-Султан' },
      { value: 'shymkent', label: 'Шымкент' },
    ],
  };

  return regionsByCountry[country] || [];
}
