/**
 * Загрузка справочников
 * GET /api/v1/dictionaries
 */

import axios, { type AxiosResponse } from 'axios';

export interface DictionariesResponse {
  banks: Array<{ value: string; label: string }>;
  cities: Array<{ value: string; label: string }>;
  propertyTypes: Array<{ value: string; label: string }>;
}

/**
 * Загрузка справочников (банки, города, типы имущества)
 * @param signal - AbortSignal для отмены запроса вместе с остальной загрузкой экрана
 * @returns Promise со справочниками
 */
export async function fetchDictionaries(
  signal?: AbortSignal
): Promise<AxiosResponse<DictionariesResponse>> {
  return axios.get('/api/v1/dictionaries', { signal });
}
