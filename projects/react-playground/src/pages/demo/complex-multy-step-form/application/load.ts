/**
 * Загрузка кредитной заявки и справочников — только сеть.
 */

import { fetchCreditApplication, fetchDictionaries, type DictionariesResponse } from '../api';
import type { CreditApplicationForm } from '../types/credit-application';

/** Всё, что нужно экрану заявки: сама заявка и справочники. */
export interface CreditApplicationData {
  application: Partial<CreditApplicationForm>;
  dictionaries: DictionariesResponse;
}

/**
 * Загрузить заявку и справочники как одну единицу: падение любого запроса одинаково фатально.
 *
 * @param applicationId - идентификатор заявки
 * @param signal - сигнал отмены устаревшего запроса
 */
export async function loadCreditApplication(
  applicationId: string,
  signal?: AbortSignal
): Promise<CreditApplicationData> {
  const [applicationResponse, dictionariesResponse] = await Promise.all([
    fetchCreditApplication(applicationId, signal),
    fetchDictionaries(signal),
  ]);

  // Разные сообщения: пользователь должен понимать, что именно не загрузилось.
  if (applicationResponse?.status !== 200) throw new Error('Ошибка загрузки заявки');
  if (dictionariesResponse?.status !== 200) throw new Error('Ошибка загрузки справочников');

  return {
    application: applicationResponse.data,
    dictionaries: dictionariesResponse.data,
  };
}
