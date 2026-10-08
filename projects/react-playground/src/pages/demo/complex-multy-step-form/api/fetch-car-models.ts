/**
 * Загрузка моделей автомобилей для выбранной марки
 * GET /api/v1/car-models?brand={brand}
 */

import type { Option } from '../types/option';
import axios, { type AxiosResponse } from 'axios';

/**
 * Загрузка моделей автомобилей для выбранной марки
 * @param brand - марка автомобиля
 * @param signal - AbortSignal: при смене марки запрос отменяется, и ответ на прежнюю марку не
 *   перетирает список свежей
 * @returns Promise с массивом моделей
 */
export async function fetchCarModels(
  brand: string,
  signal?: AbortSignal
): Promise<AxiosResponse<Option[]>> {
  return axios.get(`/api/v1/car-models?brand=${brand}`, { signal });
}
