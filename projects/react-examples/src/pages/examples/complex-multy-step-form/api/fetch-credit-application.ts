/**
 * Загрузка кредитной заявки по ID
 */
/**
 * Загрузка регионов для выбранной страны
 */

import axios, { type AxiosResponse } from 'axios';

/**
 * Загрузка регионов для выбранной страны
 * @param country - код страны
 * @returns Promise с массивом регионов
 */
export async function fetchCreditApplication(id: string): Promise<AxiosResponse<any>> {
  return axios.get(`/credit-applications?id=${id}`).then(function (response) {
    return response;
  });
}
