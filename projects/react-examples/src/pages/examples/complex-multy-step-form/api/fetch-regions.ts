/**
 * Загрузка регионов для выбранной страны
 */

import axios, { type AxiosResponse } from 'axios';
import type { Option } from '../types/option';

/**
 * Загрузка регионов для выбранной страны
 * @param country - код страны
 * @returns Promise с массивом регионов
 */
export async function fetchRegions(country: string): Promise<AxiosResponse<Option[]>> {
  return axios.get(`/regions?country=${country}`).then(function (response) {
    return response;
  });
}
