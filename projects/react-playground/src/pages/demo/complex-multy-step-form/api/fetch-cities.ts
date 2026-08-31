/**
 * Загрузка городов для выбранного региона
 * GET /api/v1/cities?region={region}
 */

import axios, { type AxiosResponse } from 'axios';
import type { Option } from '../types/option';

/**
 * Загрузка городов для выбранного региона
 * @param region - код региона
 * @returns Promise с массивом городов
 */
export async function fetchCities(region: string): Promise<AxiosResponse<Option[]>> {
  return axios.get(`/api/v1/cities?region=${region}`);
}
