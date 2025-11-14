/**
 * Mock API для загрузки данных кредитной заявки
 *
 * Имитирует серверные запросы с задержкой 2 секунды
 */

import type { CreditApplicationForm } from '../types/credit-application';

// ============================================================================
// Типы для API
// ============================================================================

export interface DictionariesResponse {
  banks: Array<{ value: string; label: string }>;
  cities: Array<{ value: string; label: string }>;
  propertyTypes: Array<{ value: string; label: string }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Mock данные - справочники
// ============================================================================

const MOCK_DICTIONARIES: DictionariesResponse = {
  banks: [
    { value: 'sberbank', label: 'Сбербанк' },
    { value: 'vtb', label: 'ВТБ' },
    { value: 'alfabank', label: 'Альфа-Банк' },
    { value: 'tinkoff', label: 'Тинькофф' },
    { value: 'gazprombank', label: 'Газпромбанк' },
    { value: 'raiffeisen', label: 'Райффайзенбанк' },
    { value: 'rosbank', label: 'Росбанк' },
    { value: 'sovcombank', label: 'Совкомбанк' },
  ],
  cities: [
    { value: 'moscow', label: 'Москва' },
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'novosibirsk', label: 'Новосибирск' },
    { value: 'ekaterinburg', label: 'Екатеринбург' },
    { value: 'kazan', label: 'Казань' },
    { value: 'nn', label: 'Нижний Новгород' },
    { value: 'chelyabinsk', label: 'Челябинск' },
    { value: 'samara', label: 'Самара' },
    { value: 'omsk', label: 'Омск' },
    { value: 'rostov', label: 'Ростов-на-Дону' },
  ],
  propertyTypes: [
    { value: 'apartment', label: 'Квартира' },
    { value: 'house', label: 'Дом' },
    { value: 'car', label: 'Автомобиль' },
    { value: 'land', label: 'Земельный участок' },
  ],
};

// ============================================================================
// Mock данные - кредитная заявка
// ============================================================================

const MOCK_APPLICATIONS: Record<string, Partial<CreditApplicationForm>> = {
  '1': {
    // Шаг 1: Основная информация
    loanType: 'mortgage',
    loanAmount: 5000000,
    loanTerm: 240,
    loanPurpose: 'Покупка квартиры в новостройке для проживания семьи',
    propertyValue: 7000000,
    initialPayment: 2000000,

    // Шаг 2: Персональные данные
    personalData: {
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Иванович',
      birthDate: '1985-05-15',
      birthPlace: 'г. Москва',
      gender: 'male',
    },
    passportData: {
      series: '45 12',
      number: '123456',
      issueDate: '2005-05-20',
      issuedBy: 'Отделением УФМС России по г. Москве',
      departmentCode: '770-025',
    },
    inn: '771234567890',
    snils: '123-456-789 00',

    // Шаг 3: Контактная информация
    phoneMain: '+7 (999) 123-45-67',
    phoneAdditional: '+7 (495) 987-65-43',
    email: 'ivan.ivanov@example.com',
    emailAdditional: 'i.ivanov@work.com',
    registrationAddress: {
      region: 'Москва',
      city: 'Москва',
      street: 'ул. Ленина',
      house: '10',
      apartment: '25',
      postalCode: '123456',
    },
    sameAsRegistration: false,
    residenceAddress: {
      region: 'Московская область',
      city: 'Химки',
      street: 'ул. Победы',
      house: '5',
      apartment: '12',
      postalCode: '141400',
    },

    // Шаг 4: Информация о занятости
    employmentStatus: 'employed',
    companyName: 'ООО "Ромашка"',
    companyInn: '7712345678',
    companyPhone: '+7 (495) 123-45-67',
    companyAddress: 'г. Москва, ул. Тверская, д. 1',
    position: 'Ведущий специалист',
    workExperienceTotal: 12,
    workExperienceCurrent: 6,
    monthlyIncome: 150000,
    additionalIncome: 30000,
    additionalIncomeSource: 'Сдача недвижимости в аренду',

    // Шаг 5: Дополнительная информация
    maritalStatus: 'married',
    dependents: 2,
    education: 'higher',
    hasProperty: true,
    properties: [
      {
        id: '1',
        type: 'apartment',
        description: 'Квартира в г. Химки, 2-комнатная, 55 кв.м.',
        estimatedValue: 4500000,
        hasEncumbrance: false,
      },
      {
        id: '2',
        type: 'car',
        description: 'Toyota Camry, 2020 года выпуска',
        estimatedValue: 1800000,
        hasEncumbrance: false,
      },
    ],
    hasExistingLoans: true,
    existingLoans: [
      {
        id: '1',
        bank: 'Сбербанк',
        type: 'Потребительский кредит',
        amount: 500000,
        remainingAmount: 200000,
        monthlyPayment: 15000,
        maturityDate: '2026-12-31',
      },
    ],
    hasCoBorrower: true,
    coBorrowers: [
      {
        id: '1',
        personalData: {
          lastName: 'Иванова',
          firstName: 'Мария',
          middleName: 'Петровна',
          birthDate: '1987-08-20',
        },
        phone: '+7 (999) 888-77-66',
        email: 'maria.ivanova@example.com',
        relationship: 'Супруга',
        monthlyIncome: 100000,
      },
    ],

    // Шаг 6: Согласия (по умолчанию false для безопасности)
    agreePersonalData: false,
    agreeCreditHistory: false,
    agreeMarketing: false,
    agreeTerms: false,
    confirmAccuracy: false,
    electronicSignature: '',
  },
  '2': {
    // Простая заявка на потребительский кредит
    loanType: 'consumer',
    loanAmount: 300000,
    loanTerm: 24,
    loanPurpose: 'Ремонт квартиры',

    personalData: {
      lastName: 'Петров',
      firstName: 'Петр',
      middleName: 'Петрович',
      birthDate: '1990-03-10',
      birthPlace: 'г. Санкт-Петербург',
      gender: 'male',
    },
    passportData: {
      series: '4012',
      number: '654321',
      issueDate: '2010-03-15',
      issuedBy: 'УФМС России по Санкт-Петербургу',
      departmentCode: '780-015',
    },
    inn: '781234567890',
    snils: '987-654-321 00',

    phoneMain: '+7 (911) 222-33-44',
    email: 'petr.petrov@example.com',
    registrationAddress: {
      region: 'Санкт-Петербург',
      city: 'Санкт-Петербург',
      street: 'Невский проспект',
      house: '100',
      apartment: '50',
      postalCode: '191025',
    },
    sameAsRegistration: true,

    employmentStatus: 'employed',
    companyName: 'ООО "Василек"',
    companyInn: '7812345678',
    companyPhone: '+7 (812) 123-45-67',
    companyAddress: 'г. Санкт-Петербург, ул. Садовая, д. 20',
    position: 'Менеджер',
    workExperienceTotal: 60,
    workExperienceCurrent: 24,
    monthlyIncome: 80000,

    maritalStatus: 'single',
    dependents: 0,
    education: 'higher',
    hasProperty: false,
    properties: [],
    hasExistingLoans: false,
    existingLoans: [],
    hasCoBorrower: false,
    coBorrowers: [],

    agreePersonalData: false,
    agreeCreditHistory: false,
    agreeMarketing: false,
    agreeTerms: false,
    confirmAccuracy: false,
    electronicSignature: '',
  },
};

// ============================================================================
// Конфигурация имитации ошибок
// ============================================================================

let simulateError = false;

export const setSimulateError = (value: boolean) => {
  simulateError = value;
};

export const getSimulateError = () => simulateError;

// ============================================================================
// API функции
// ============================================================================

/**
 * Имитация задержки сети (2 секунды)
 */
const delay = (ms: number = 2000) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Загрузка справочников
 */
export const fetchDictionaries = async (): Promise<ApiResponse<DictionariesResponse>> => {
  await delay(2000);

  if (simulateError) {
    return {
      success: false,
      error: 'Ошибка загрузки справочников. Попробуйте позже.',
    };
  }

  return {
    success: true,
    data: MOCK_DICTIONARIES,
  };
};

/**
 * Загрузка кредитной заявки по ID
 */
export const fetchCreditApplication = async (
  id: string
): Promise<ApiResponse<Partial<CreditApplicationForm>>> => {
  await delay(2000);

  if (simulateError) {
    return {
      success: false,
      error: 'Ошибка загрузки данных заявки. Проверьте подключение к интернету.',
    };
  }

  const application = MOCK_APPLICATIONS[id];

  if (!application) {
    return {
      success: false,
      error: `Заявка с ID "${id}" не найдена`,
    };
  }

  return {
    success: true,
    data: application,
  };
};

/**
 * Получение списка доступных ID заявок (для отладки)
 */
export const getAvailableApplicationIds = (): string[] => {
  return Object.keys(MOCK_APPLICATIONS);
};
