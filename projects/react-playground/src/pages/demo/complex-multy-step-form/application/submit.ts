/**
 * Отправка кредитной заявки и сообщение о результате — одни на все способы реализации.
 */

import { submitCreditApplication } from '../api';
import type { CreditApplicationForm } from '../types/credit-application';

export type SubmitOutcome =
  | { status: 'sent'; applicationId: string }
  | { status: 'rejected' }
  | { status: 'unreachable' };

/** Отправить заявку. Не бросает: сбой сети и неожиданный ответ — варианты результата. */
export async function sendCreditApplication(values: CreditApplicationForm): Promise<SubmitOutcome> {
  try {
    const response = await submitCreditApplication(values);
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
