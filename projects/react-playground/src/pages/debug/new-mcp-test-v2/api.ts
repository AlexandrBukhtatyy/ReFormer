/**
 * Mock-API заявки (эндпоинты из спеки заменены на функции с задержкой).
 *
 * GET  /api/v1/credit-applications/{id}
 * GET  /api/v1/dictionaries
 * POST /api/v1/credit-applications
 */
import type { CreditApplicationForm, Option } from './types';

export interface Dictionaries {
  banks: Option[];
  propertyTypes: Option[];
  loanKinds: Option[];
}

export interface ApplicationBundle {
  application: Partial<CreditApplicationForm> | null;
  dictionaries: Dictionaries;
}

const LOAD_DELAY = 700;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

const DICTIONARIES: Dictionaries = {
  banks: [
    { value: 'sberbank', label: 'Сбербанк' },
    { value: 'vtb', label: 'ВТБ' },
    { value: 'alfa', label: 'Альфа-Банк' },
    { value: 'tinkoff', label: 'Т-Банк' },
  ],
  propertyTypes: [
    { value: 'apartment', label: 'Квартира' },
    { value: 'house', label: 'Дом' },
    { value: 'land', label: 'Земельный участок' },
    { value: 'car', label: 'Автомобиль' },
    { value: 'other', label: 'Иное' },
  ],
  loanKinds: [
    { value: 'consumer', label: 'Потребительский' },
    { value: 'mortgage', label: 'Ипотека' },
    { value: 'card', label: 'Кредитная карта' },
  ],
};

const SAVED_APPLICATIONS: Record<string, Partial<CreditApplicationForm>> = {
  '1': {
    loanType: 'mortgage',
    loanAmount: 5_000_000,
    loanTerm: 240,
    loanPurpose: 'Покупка двухкомнатной квартиры в новостройке для проживания семьи',
    propertyValue: 7_000_000,
    personalData: {
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Иванович',
      birthDate: '1990-05-14',
      gender: 'male',
      birthPlace: 'г. Москва',
    },
    passportData: {
      series: '45 10',
      number: '123456',
      issueDate: '2015-06-01',
      issuedBy: 'ОУФМС России по г. Москве',
      departmentCode: '770-001',
    },
    inn: '770123456789',
    snils: '123-456-789 00',
    phoneMain: '+7 (916) 111-22-33',
    email: 'ivanov@example.com',
    registrationAddress: {
      region: 'moscow',
      city: 'moscow',
      street: 'Тверская',
      house: '10',
      apartment: '25',
      postalCode: '125009',
    },
    sameAsRegistration: true,
    employmentStatus: 'employed',
    companyName: 'ООО «Ромашка»',
    companyInn: '7701234567',
    companyPhone: '+7 (495) 123-45-67',
    companyAddress: 'г. Москва, ул. Ленина, 1',
    position: 'Ведущий инженер',
    workExperienceTotal: 120,
    workExperienceCurrent: 48,
    monthlyIncome: 250_000,
    additionalIncome: 30_000,
    additionalIncomeSource: 'Аренда квартиры',
    maritalStatus: 'married',
    dependents: 2,
    education: 'higher',
  },
  '2': {
    loanType: 'car',
    loanAmount: 1_200_000,
    loanTerm: 60,
    loanPurpose: 'Приобретение автомобиля для поездок на работу и за город',
    carBrand: 'toyota',
    carModel: 'camry',
    carYear: 2022,
    carPrice: 2_600_000,
    personalData: {
      lastName: 'Петрова',
      firstName: 'Анна',
      middleName: 'Сергеевна',
      birthDate: '1985-11-02',
      gender: 'female',
      birthPlace: 'г. Казань',
    },
    passportData: {
      series: '92 07',
      number: '654321',
      issueDate: '2010-12-20',
      issuedBy: 'ОВД Вахитовского района г. Казани',
      departmentCode: '160-004',
    },
    inn: '160123456789',
    snils: '987-654-321 00',
    phoneMain: '+7 (917) 555-44-33',
    email: 'petrova@example.com',
    registrationAddress: {
      region: 'tatarstan',
      city: 'kazan',
      street: 'Баумана',
      house: '5',
      apartment: '11',
      postalCode: '420111',
    },
    sameAsRegistration: false,
    residenceAddress: {
      region: 'moscow',
      city: 'moscow',
      street: 'Арбат',
      house: '3',
      apartment: '7',
      postalCode: '119002',
    },
    employmentStatus: 'selfEmployed',
    businessType: 'ИП',
    businessInn: '160987654321',
    businessActivity: 'Розничная торговля непродовольственными товарами',
    workExperienceTotal: 96,
    workExperienceCurrent: 36,
    monthlyIncome: 180_000,
    maritalStatus: 'single',
    dependents: 0,
    education: 'specialized',
    hasProperty: true,
    properties: [
      {
        type: 'apartment',
        description: 'Квартира 54 м² в Казани',
        estimatedValue: 6_500_000,
        hasEncumbrance: false,
      },
    ],
    hasExistingLoans: true,
    existingLoans: [
      {
        bank: 'sberbank',
        type: 'consumer',
        amount: 400_000,
        remainingAmount: 150_000,
        monthlyPayment: 12_000,
        maturityDate: '2027-03-01',
      },
    ],
  },
};

/** GET /api/v1/credit-applications/{id} + GET /api/v1/dictionaries (параллельно). */
export async function loadApplicationBundle(
  applicationId: string | null,
  signal?: AbortSignal,
  simulateError = false
): Promise<ApplicationBundle> {
  await sleep(simulateError ? 2000 : LOAD_DELAY, signal);
  if (simulateError) {
    throw new Error('Сервис заявок недоступен. Повторите попытку позже.');
  }
  if (applicationId !== null && !SAVED_APPLICATIONS[applicationId]) {
    throw new Error(`Заявка с ID "${applicationId}" не найдена`);
  }
  return {
    application: applicationId === null ? null : SAVED_APPLICATIONS[applicationId],
    dictionaries: DICTIONARIES,
  };
}

export interface SubmitResult {
  id: string;
  message: string;
}

/** POST /api/v1/credit-applications */
export async function submitCreditApplication(
  values: CreditApplicationForm
): Promise<SubmitResult> {
  await sleep(600);
  console.info('[new-mcp-test-v2] submit', values);
  return { id: String(Math.floor(Math.random() * 900) + 100), message: 'Заявка успешно создана' };
}
