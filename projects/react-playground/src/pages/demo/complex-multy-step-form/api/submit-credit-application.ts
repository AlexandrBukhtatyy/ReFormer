/**
 * Отправка кредитной заявки
 * POST /api/v1/credit-applications
 */

import axios, { type AxiosResponse } from 'axios';
import type { CreditApplicationForm } from '../types/credit-application';

export interface SubmitResponse {
  success: boolean;
  id: string;
  message: string;
}

/**
 * Отправка кредитной заявки
 * @param data - данные заявки
 * @returns Promise с результатом отправки
 */
export async function submitCreditApplication(
  data: Partial<CreditApplicationForm>
): Promise<AxiosResponse<SubmitResponse>> {
  return axios.post('/api/v1/credit-applications', data);
}
