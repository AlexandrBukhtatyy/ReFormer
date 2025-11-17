/**
 * Загрузка городов для выбранного региона
 */

import axios, { type AxiosResponse } from 'axios';
import type { Option } from '../types/option';

/**
 * Загрузка городов для выбранного региона
 * @param region - код региона
 * @returns Promise с массивом городов
 */
export async function fetchCities(region: string): Promise<AxiosResponse<Option[]> | void> {
  return axios
    .get(`/cities?region=${region}`)
    .then(function (response) {
      // обработка успешного запроса
      console.log(response);
      return response;
    })
    .catch(function (error) {
      // обработка ошибки
      console.log(error);
    })
    .finally(function () {
      // выполняется всегда
    });
}
