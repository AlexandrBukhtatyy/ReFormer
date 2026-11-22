/**
 * Отправка кредитной заявки
 * POST /api/v1/credit-applications
 */

import axios, { type AxiosResponse } from 'axios';
import type { CreditApplication } from '../types/credit-application';

export interface SubmitResponse {
  success: boolean;
  id: string;
  message: string;
}

/**
 * Отправка кредитной заявки
 * @param data - ввод заявки, без вычисляемых полей (их считает сервер)
 * @returns Promise с результатом отправки
 */
export async function submitCreditApplication(
  data: CreditApplication
): Promise<AxiosResponse<SubmitResponse>> {
  return axios.post('/api/v1/credit-applications', data);
}
