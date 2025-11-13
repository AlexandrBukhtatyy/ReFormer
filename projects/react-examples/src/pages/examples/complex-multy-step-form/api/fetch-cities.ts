/**
 * Загрузка городов для выбранного региона
 */

import type { Option } from '../types/option';

/**
 * Загрузка городов для выбранного региона
 * @param region - код региона
 * @returns Promise с массивом городов
 */
export async function fetchCities(region: string): Promise<Option[]> {
  // Имитация задержки API запроса
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Моковые данные
  const citiesByRegion: Record<string, Option[]> = {
    moscow: [
      { value: 'moscow_center', label: 'Центральный округ' },
      { value: 'moscow_north', label: 'Северный округ' },
      { value: 'moscow_south', label: 'Южный округ' },
    ],
    spb: [
      { value: 'spb_center', label: 'Центральный район' },
      { value: 'spb_nevsky', label: 'Невский район' },
      { value: 'spb_vasilievsky', label: 'Василеостровский район' },
    ],
  };

  return citiesByRegion[region] || [];
}
