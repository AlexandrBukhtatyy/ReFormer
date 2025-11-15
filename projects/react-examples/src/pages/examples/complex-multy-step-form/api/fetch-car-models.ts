/**
 * Загрузка моделей автомобилей для выбранной марки
 */

import type { Option } from '../types/option';

/**
 * Загрузка моделей автомобилей для выбранной марки
 * @param brand - марка автомобиля
 * @returns Promise с массивом моделей
 */
export async function fetchCarModels(brand: string): Promise<Option[]> {
  // Имитация задержки API запроса
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Моковые данные
  const modelsByBrand: Record<string, Option[]> = {
    Toyota: [
      { value: 'camry', label: 'Camry' },
      { value: 'corolla', label: 'Corolla' },
      { value: 'rav4', label: 'RAV4' },
      { value: 'land_cruiser', label: 'Land Cruiser' },
    ],
    BMW: [
      { value: '3_series', label: '3 Series' },
      { value: '5_series', label: '5 Series' },
      { value: 'x5', label: 'X5' },
    ],
    Mercedes: [
      { value: 'c_class', label: 'C-Class' },
      { value: 'e_class', label: 'E-Class' },
      { value: 'glc', label: 'GLC' },
    ],
  };

  return modelsByBrand[brand] || [];
}
