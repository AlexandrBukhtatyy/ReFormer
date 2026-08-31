/**
 * Загрузка списка регионов
 * GET /api/v1/regions
 */

import axios, { type AxiosResponse } from 'axios';
import type { Option } from '../types/option';

/**
 * Загрузка списка регионов
 * @returns Promise с массивом регионов
 */
export async function fetchRegions(): Promise<AxiosResponse<Option[]>> {
  return axios.get('/api/v1/regions');
}
