/**
 * Загрузка моделей автомобилей для выбранной марки
 */

import type { Option } from '../types/option';
import axios, { type AxiosResponse } from 'axios';

/**
 * Загрузка моделей автомобилей для выбранной марки
 * @param brand - марка автомобиля
 * @returns Promise с массивом моделей
 */
export async function fetchCarModels(brand: string): Promise<AxiosResponse<Option[]> | void> {
  return axios
    .get(`/cars?brand=${brand}`)
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
