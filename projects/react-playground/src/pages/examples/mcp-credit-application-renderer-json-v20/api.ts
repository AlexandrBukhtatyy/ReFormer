// api.ts — submit + prefill / load (mock backend, 2s delay per spec §API).
// All endpoints are mocked; real ones live server-side.

import type { CreditApplicationForm, SelectOption } from './types';

const API_DELAY = 2000;

export type ApiResult<T> = { success: true; data: T } | { success: false; error: string };

export type Dictionaries = {
  banks: SelectOption[];
  cities: SelectOption[];
  propertyTypes: SelectOption[];
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Prefill fixtures (GET /api/v1/credit-applications/{id}) -------------

const APPLICATIONS: Record<string, Partial<CreditApplicationForm>> = {
  '1': {
    loanType: 'mortgage',
    loanAmount: 5_000_000,
    loanTerm: 240,
    loanPurpose: 'Покупка квартиры в новостройке',
    propertyValue: 7_000_000,
    personalData: {
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Иванович',
      birthDate: '1990-05-14',
      gender: 'male',
      birthPlace: 'Москва',
    },
    email: 'ivanov@mail.com',
    phoneMain: '+7 (912) 345-67-89',
    employmentStatus: 'employed',
    companyName: 'ООО «Ромашка»',
    monthlyIncome: 180_000,
  },
  '2': {
    loanType: 'car',
    loanAmount: 1_200_000,
    loanTerm: 60,
    loanPurpose: 'Покупка нового автомобиля для семьи',
    carBrand: 'toyota',
    carModel: 'camry',
    carYear: 2022,
    carPrice: 2_500_000,
    personalData: {
      lastName: 'Петрова',
      firstName: 'Мария',
      middleName: 'Сергеевна',
      birthDate: '1988-11-02',
      gender: 'female',
      birthPlace: 'Санкт-Петербург',
    },
    email: 'petrova@mail.com',
    phoneMain: '+7 (921) 111-22-33',
    employmentStatus: 'selfEmployed',
    monthlyIncome: 220_000,
  },
};

/** GET /api/v1/credit-applications/{id} */
export async function loadApplication(
  id: string,
  simulateError = false
): Promise<ApiResult<Partial<CreditApplicationForm>>> {
  await wait(API_DELAY);
  if (simulateError) {
    return { success: false, error: 'Сеть недоступна. Попробуйте снова.' };
  }
  const data = APPLICATIONS[id];
  if (!data) {
    return { success: false, error: `Заявка с ID "${id}" не найдена` };
  }
  return { success: true, data };
}

/** GET /api/v1/dictionaries */
export async function loadDictionaries(): Promise<ApiResult<Dictionaries>> {
  await wait(API_DELAY);
  return {
    success: true,
    data: {
      banks: [
        { value: 'sberbank', label: 'Сбербанк' },
        { value: 'vtb', label: 'ВТБ' },
        { value: 'alfa', label: 'Альфа-Банк' },
      ],
      cities: [{ value: 'moscow', label: 'Москва' }],
      propertyTypes: [
        { value: 'apartment', label: 'Квартира' },
        { value: 'house', label: 'Дом' },
      ],
    },
  };
}

/** POST /api/v1/credit-applications */
export async function submitCreditApplication(
  values: CreditApplicationForm,
  simulateError = false
): Promise<ApiResult<{ id: string; message: string }>> {
  await wait(API_DELAY);
  if (simulateError) {
    return { success: false, error: 'Не удалось отправить заявку. Повторите позже.' };
  }

  console.info('[credit-application] submit payload', values);
  return {
    success: true,
    data: { id: String(Date.now()), message: 'Заявка успешно создана' },
  };
}
