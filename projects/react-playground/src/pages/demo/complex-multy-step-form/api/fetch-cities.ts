/**
 * Загрузка городов для выбранного региона
 * GET /api/v1/cities?region={region}
 */

import axios, { type AxiosResponse } from 'axios';
import type { Option } from '../types/option';

/**
 * Загрузка городов для выбранного региона
 * @param region - код региона
 * @param signal - AbortSignal: при смене региона запрос отменяется, и ответ на прежний регион не
 *   перетирает список свежего
 * @returns Promise с массивом городов
 */
export async function fetchCities(
  region: string,
  signal?: AbortSignal
): Promise<AxiosResponse<Option[]>> {
  return axios.get(`/api/v1/cities?region=${region}`, { signal });
}
