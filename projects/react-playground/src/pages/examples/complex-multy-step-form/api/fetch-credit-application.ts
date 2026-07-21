/**
 * Загрузка кредитной заявки по ID
 * GET /api/v1/credit-applications/{id}
 */

import axios, { type AxiosResponse } from 'axios';
import type { CreditApplicationForm } from '../types/credit-application';

/**
 * Загрузка кредитной заявки по ID
 * @param id - идентификатор заявки
 * @param signal - AbortSignal: при смене id или уходе со страницы запрос отменяется,
 *   и ответ на устаревший id не перетирает свежие данные
 * @returns Promise с данными заявки
 */
export async function fetchCreditApplication(
  id: string,
  signal?: AbortSignal
): Promise<AxiosResponse<Partial<CreditApplicationForm>>> {
  return axios.get(`/api/v1/credit-applications/${id}`, { signal });
}
