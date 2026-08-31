/**
 * API-слой формы: загрузка существующей заявки и отправка новой.
 * Оба эндпоинта в примере — mock-функции с задержкой (спека, раздел «API интеграция»).
 */

import { INITIAL_CREDIT_APPLICATION } from './model';
import type { CreditApplicationForm } from './types';

const REQUEST_DELAY_MS = 800;

/** Режим отладки: искусственная задержка 2 с и ошибка (спека, «Имитация ошибки (debug)»). */
export const DEBUG_FLAGS = { simulateError: false };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Заранее заготовленные заявки для сценария «Загрузка с данными» (applicationId = '1' | '2'). */
const SAVED_APPLICATIONS: Record<string, Partial<CreditApplicationForm>> = {
  '1': {
    loanType: 'mortgage',
    loanAmount: 5_000_000,
    loanTerm: 240,
    loanPurpose: 'Покупка двухкомнатной квартиры в новостройке для проживания семьи.',
    propertyValue: 7_000_000,
    personalData: {
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Иванович',
      birthDate: '1988-04-12',
      gender: 'male',
      birthPlace: 'г. Москва',
    },
    passportData: {
      series: '45 08',
      number: '123456',
      issueDate: '2010-05-20',
      issuedBy: 'ОВД района Северный г. Москвы',
      departmentCode: '770-052',
    },
    inn: '771234567890',
    snils: '123-456-789 00',
    phoneMain: '+7 (916) 123-45-67',
    email: 'ivanov@example.com',
    registrationAddress: {
      region: 'moscow',
      city: 'moscow',
      street: 'Ленинский проспект',
      house: '12',
      apartment: '45',
      postalCode: '119991',
    },
    sameAsRegistration: true,
    employmentStatus: 'employed',
    companyName: 'ООО «Ромашка»',
    companyInn: '7712345678',
    companyPhone: '+7 (495) 111-22-33',
    companyAddress: 'г. Москва, ул. Тверская, 1',
    position: 'Ведущий инженер',
    workExperienceTotal: 168,
    workExperienceCurrent: 60,
    monthlyIncome: 250_000,
    additionalIncome: 0,
    maritalStatus: 'married',
    dependents: 2,
    education: 'higher',
  },
  '2': {
    loanType: 'car',
    loanAmount: 1_200_000,
    loanTerm: 60,
    loanPurpose: 'Покупка автомобиля для поездок на работу и загород.',
    carBrand: 'Toyota',
    carModel: 'camry',
    carYear: 2021,
    carPrice: 2_400_000,
    personalData: {
      lastName: 'Петрова',
      firstName: 'Мария',
      middleName: 'Сергеевна',
      birthDate: '1995-09-30',
      gender: 'female',
      birthPlace: 'г. Казань',
    },
    phoneMain: '+7 (917) 765-43-21',
    email: 'petrova@example.com',
    registrationAddress: {
      region: 'tatarstan',
      city: 'kazan',
      street: 'ул. Баумана',
      house: '7',
      apartment: '',
      postalCode: '420111',
    },
    sameAsRegistration: false,
    employmentStatus: 'selfEmployed',
    businessType: 'ИП',
    businessInn: '166012345678',
    businessActivity: 'Розничная торговля товарами для дома.',
    workExperienceTotal: 72,
    workExperienceCurrent: 36,
    monthlyIncome: 180_000,
    additionalIncome: 20_000,
    additionalIncomeSource: 'Сдача квартиры в аренду',
    maritalStatus: 'single',
    dependents: 0,
    education: 'specialized',
  },
};

export type LoadApplicationResult = {
  success: boolean;
  data?: CreditApplicationForm;
  error?: string;
};

/** GET /api/v1/credit-applications/{id} */
export async function fetchCreditApplication(id: string): Promise<LoadApplicationResult> {
  await sleep(DEBUG_FLAGS.simulateError ? 2000 : REQUEST_DELAY_MS);

  if (DEBUG_FLAGS.simulateError) {
    return { success: false, error: 'Сервер временно недоступен. Попробуйте позже.' };
  }

  const saved = SAVED_APPLICATIONS[id];
  if (!saved) {
    return { success: false, error: `Заявка с ID "${id}" не найдена` };
  }

  return {
    success: true,
    data: { ...structuredClone(INITIAL_CREDIT_APPLICATION), ...structuredClone(saved) },
  };
}

export type SubmitApplicationResult = {
  id: string;
  message: string;
};

/** POST /api/v1/credit-applications */
export async function submitCreditApplication(
  values: CreditApplicationForm
): Promise<SubmitApplicationResult> {
  await sleep(DEBUG_FLAGS.simulateError ? 2000 : REQUEST_DELAY_MS);

  if (DEBUG_FLAGS.simulateError) {
    throw new Error('Не удалось отправить заявку: сервер недоступен.');
  }

  console.info('[credit-application] submit payload', values);
  return { id: String(Date.now()), message: 'Заявка успешно создана' };
}
