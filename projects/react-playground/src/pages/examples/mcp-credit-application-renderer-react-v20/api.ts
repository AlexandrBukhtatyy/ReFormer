// api.ts — submit + prefill/load (mock of spec endpoints, 2s delay per spec §API).

import type { FormModel } from '@reformer/core';
import type { CreditApplicationForm } from './types';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type SubmitResult = { success: boolean; id?: string; message: string };

/** POST /api/v1/credit-applications */
export async function submitCreditApplication(
  values: CreditApplicationForm
): Promise<SubmitResult> {
  await delay(2000);

  console.log('[mcp-credit-v20] submit payload:', values);
  return { success: true, id: '123', message: 'Заявка успешно создана' };
}

/** GET /api/v1/credit-applications/{id} — partial prefill for edit/view scenarios. */
export async function loadCreditApplication(
  id: string
): Promise<Partial<CreditApplicationForm> | null> {
  await delay(2000);
  if (id === '1') {
    return {
      loanType: 'mortgage',
      loanAmount: 5000000,
      loanTerm: 240,
      loanPurpose: 'Покупка квартиры в новостройке',
      propertyValue: 7000000,
      personalData: {
        lastName: 'Иванов',
        firstName: 'Иван',
        middleName: 'Иванович',
        birthDate: '1990-05-15',
        gender: 'male',
        birthPlace: 'Москва',
      },
      email: 'ivanov@example.com',
    };
  }
  return null;
}

/** Apply prefill onto the reactive model (used when applicationId is provided). */
export function applyPrefill(
  model: FormModel<CreditApplicationForm>,
  data: Partial<CreditApplicationForm>
): void {
  model.set({ ...model.get(), ...data });
}
