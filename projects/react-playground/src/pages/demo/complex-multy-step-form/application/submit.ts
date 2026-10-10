/**
 * Отправка кредитной заявки и сообщение о результате — одни на все способы реализации.
 */

import { submitCreditApplication } from '../api';
import type { CreditApplication } from '../types/credit-application';
import { toApplicationPayload } from './payload';

export type SubmitOutcome =
  | { status: 'sent'; applicationId: string }
  | { status: 'rejected' }
  | { status: 'unreachable' };

/**
 * Отправить заявку. Не бросает: сбой сети и неожиданный ответ — варианты результата.
 *
 * Принимает ввод заявки; значения формы (`bundle.submit` отдаёт `model.get()`) подходят как есть —
 * вычисляемые поля отрезаются перед запросом.
 */
export async function sendCreditApplication(values: CreditApplication): Promise<SubmitOutcome> {
  try {
    const response = await submitCreditApplication(toApplicationPayload(values));
    return response.status === 200 || response.status === 201
      ? { status: 'sent', applicationId: response.data.id }
      : { status: 'rejected' };
  } catch {
    return { status: 'unreachable' };
  }
}

export function reportSubmitOutcome(outcome: SubmitOutcome): void {
  if (outcome.status === 'sent') {
    alert(`Заявка успешно отправлена! ID: ${outcome.applicationId}`);
  } else if (outcome.status === 'rejected') {
    alert('Ошибка отправки заявки: сервер вернул неожиданный ответ');
  } else {
    alert('Ошибка отправки заявки: сервер недоступен');
  }
}
