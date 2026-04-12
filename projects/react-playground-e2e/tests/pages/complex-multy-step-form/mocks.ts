/**
 * API Mocks for Credit Application Form E2E tests
 * Combined from dictionaries, credit-application, and api mocks
 */

import { type Page, type Route } from '@playwright/test';

// ============================================================================
// Types - Dictionaries
// ============================================================================

export interface Option {
  value: string;
  label: string;
}

export interface DictionariesResponse {
  banks: Option[];
  cities: Option[];
  propertyTypes: Option[];
}

// ============================================================================
// Types - Credit Application
// ============================================================================

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';

export interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: 'male' | 'female';
  birthPlace: string;
}

export interface PassportData {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
}

export interface Address {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
}

export interface Property {
  type: string;
  value: number;
  description: string;
}

export interface ExistingLoan {
  bank: string;
  amount: number;
  monthlyPayment: number;
  remainingTerm: number;
}

export interface CoBorrower {
  personalData: PersonalData;
  monthlyIncome: number;
  relationship: string;
}

export interface CreditApplicationMock {
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;
  propertyValue?: number;
  initialPayment?: number;
  carBrand?: string;
  carModel?: string;
  carYear?: number;
  carPrice?: number;
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;
  phoneMain: string;
  phoneAdditional?: string;
  email: string;
  emailAdditional?: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress?: Address;
  employmentStatus: EmploymentStatus;
  companyName?: string;
  companyInn?: string;
  companyPhone?: string;
  companyAddress?: string;
  position?: string;
  workExperienceTotal: number;
  workExperienceCurrent: number;
  monthlyIncome: number;
  additionalIncome?: number;
  additionalIncomeSource?: string;
  businessType?: string;
  businessInn?: string;
  businessActivity?: string;
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;
  hasProperty: boolean;
  properties?: Property[];
  hasExistingLoans: boolean;
  existingLoans?: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers?: CoBorrower[];
  agreePersonalData?: boolean;
  agreeCreditHistory?: boolean;
  agreeMarketing?: boolean;
  agreeTerms?: boolean;
  confirmAccuracy?: boolean;
  electronicSignature?: string;
}

// ============================================================================
// Mock Options
// ============================================================================

export interface MockApiOptions {
  delay?: number;
  simulateError?: boolean;
  errorStatus?: number;
  applicationId?: string;
}

// ============================================================================
// Dictionaries Mock Data
// ============================================================================

export const MOCK_BANKS: Option[] = [
  { value: 'sberbank', label: 'Сбербанк' },
  { value: 'vtb', label: 'ВТБ' },
  { value: 'alfabank', label: 'Альфа-Банк' },
  { value: 'tinkoff', label: 'Тинькофф' },
  { value: 'gazprombank', label: 'Газпромбанк' },
];

export const MOCK_PROPERTY_TYPES: Option[] = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'car', label: 'Автомобиль' },
  { value: 'land', label: 'Земельный участок' },
];

export const MOCK_REGIONS: Option[] = [
  { value: 'moscow_region', label: 'Московская область' },
  { value: 'leningrad_region', label: 'Ленинградская область' },
  { value: 'sverdlovsk_region', label: 'Свердловская область' },
];

export const MOCK_CITIES: Record<string, Option[]> = {
  moscow_region: [
    { value: 'moscow', label: 'Москва' },
    { value: 'podolsk', label: 'Подольск' },
    { value: 'balashikha', label: 'Балашиха' },
  ],
  leningrad_region: [
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'gatchina', label: 'Гатчина' },
  ],
  sverdlovsk_region: [
    { value: 'ekaterinburg', label: 'Екатеринбург' },
    { value: 'nizhny_tagil', label: 'Нижний Тагил' },
  ],
};

export const MOCK_CAR_MODELS: Record<string, Option[]> = {
  toyota: [
    { value: 'camry', label: 'Camry' },
    { value: 'corolla', label: 'Corolla' },
    { value: 'rav4', label: 'RAV4' },
  ],
  bmw: [
    { value: '3_series', label: '3 Series' },
    { value: '5_series', label: '5 Series' },
    { value: 'x5', label: 'X5' },
  ],
};

export const MOCK_DICTIONARIES: DictionariesResponse = {
  banks: MOCK_BANKS,
  cities: MOCK_CITIES['moscow_region'],
  propertyTypes: MOCK_PROPERTY_TYPES,
};

// ============================================================================
// Credit Application Mock Data
// ============================================================================

export const MOCK_CREDIT_APPLICATION_1: Partial<CreditApplicationMock> = {
  loanType: 'consumer',
  loanAmount: 500000,
  loanTerm: 24,
  loanPurpose: 'Ремонт квартиры',
  personalData: {
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: 'Иванович',
    birthDate: '1990-05-15',
    gender: 'male',
    birthPlace: 'г. Москва',
  },
  passportData: {
    series: '45 06',
    number: '123456',
    issueDate: '2010-06-20',
    issuedBy: 'ОВД Центрального района г. Москвы',
    departmentCode: '770-001',
  },
  inn: '123456789012',
  snils: '123-456-789 01',
  phoneMain: '+7 (999) 123-45-67',
  email: 'ivanov@example.com',
  registrationAddress: {
    region: 'Московская область',
    city: 'Москва',
    street: 'Тверская',
    house: '1',
    apartment: '10',
    postalCode: '123456',
  },
  sameAsRegistration: true,
  employmentStatus: 'employed',
  companyName: 'ООО Рога и Копыта',
  companyInn: '7707083893',
  position: 'Менеджер',
  workExperienceTotal: 60,
  workExperienceCurrent: 24,
  monthlyIncome: 100000,
  maritalStatus: 'married',
  dependents: 2,
  education: 'higher',
  hasProperty: false,
  hasExistingLoans: false,
  hasCoBorrower: false,
};

export const MOCK_CREDIT_APPLICATION_2: Partial<CreditApplicationMock> = {
  loanType: 'mortgage',
  loanAmount: 4000000,
  loanTerm: 240,
  loanPurpose: 'Покупка квартиры',
  propertyValue: 5000000,
  initialPayment: 1000000,
  personalData: {
    lastName: 'Петрова',
    firstName: 'Анна',
    middleName: 'Сергеевна',
    birthDate: '1985-03-20',
    gender: 'female',
    birthPlace: 'г. Санкт-Петербург',
  },
  passportData: {
    series: '40 15',
    number: '654321',
    issueDate: '2015-04-10',
    issuedBy: 'УФМС России по г. Санкт-Петербургу',
    departmentCode: '780-002',
  },
  inn: '782512345678',
  snils: '987-654-321 00',
  phoneMain: '+7 (911) 987-65-43',
  email: 'petrova@example.com',
  registrationAddress: {
    region: 'Ленинградская область',
    city: 'Санкт-Петербург',
    street: 'Невский проспект',
    house: '100',
    apartment: '25',
    postalCode: '190000',
  },
  sameAsRegistration: false,
  employmentStatus: 'selfEmployed',
  workExperienceTotal: 120,
  workExperienceCurrent: 60,
  monthlyIncome: 200000,
  maritalStatus: 'married',
  dependents: 1,
  education: 'postgraduate',
  hasProperty: true,
  hasExistingLoans: true,
  hasCoBorrower: true,
};

export const MOCK_EMPTY_APPLICATION: Partial<CreditApplicationMock> = {
  loanType: 'consumer',
  loanAmount: 0,
  loanTerm: 0,
  loanPurpose: '',
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    gender: 'male',
    birthPlace: '',
  },
  passportData: {
    series: '',
    number: '',
    issueDate: '',
    issuedBy: '',
    departmentCode: '',
  },
  inn: '',
  snils: '',
  phoneMain: '',
  email: '',
  registrationAddress: {
    region: '',
    city: '',
    street: '',
    house: '',
    apartment: '',
    postalCode: '',
  },
  sameAsRegistration: true,
  employmentStatus: 'employed',
  workExperienceTotal: 0,
  workExperienceCurrent: 0,
  monthlyIncome: 0,
  maritalStatus: 'single',
  dependents: 0,
  education: 'secondary',
  hasProperty: false,
  hasExistingLoans: false,
  hasCoBorrower: false,
};

// ============================================================================
// API Mock Functions
// ============================================================================

export async function mockCreditApplicationApi(page: Page, options?: MockApiOptions) {
  const { delay = 100, simulateError = false, errorStatus = 500 } = options ?? {};

  await page.route('**/api/v1/credit-applications/**', async (route: Route) => {
    const url = route.request().url();
    const idMatch = url.match(/credit-applications\/(\d+)/);
    const applicationId = idMatch?.[1] ?? '1';

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (simulateError) {
      return route.fulfill({
        status: errorStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    }

    let mockData;
    switch (applicationId) {
      case '1':
        mockData = MOCK_CREDIT_APPLICATION_1;
        break;
      case '2':
        mockData = MOCK_CREDIT_APPLICATION_2;
        break;
      default:
        mockData = MOCK_EMPTY_APPLICATION;
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockData),
    });
  });
}

export async function mockDictionariesApi(page: Page, options?: MockApiOptions) {
  const { delay = 100, simulateError = false, errorStatus = 500 } = options ?? {};

  await page.route('**/api/v1/dictionaries', async (route: Route) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (simulateError) {
      return route.fulfill({
        status: errorStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load dictionaries' }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_DICTIONARIES),
    });
  });
}

export async function mockRegionsApi(page: Page, options?: MockApiOptions) {
  const { delay = 50, simulateError = false, errorStatus = 500 } = options ?? {};

  await page.route('**/api/v1/regions', async (route: Route) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (simulateError) {
      return route.fulfill({
        status: errorStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load regions' }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REGIONS),
    });
  });
}

export async function mockCitiesApi(page: Page, options?: MockApiOptions) {
  const { delay = 50, simulateError = false, errorStatus = 500 } = options ?? {};

  await page.route('**/api/v1/cities**', async (route: Route) => {
    const url = new URL(route.request().url());
    const region = url.searchParams.get('region') ?? '';

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (simulateError) {
      return route.fulfill({
        status: errorStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load cities' }),
      });
    }

    const cities = MOCK_CITIES[region] ?? MOCK_CITIES['moscow_region'];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cities),
    });
  });
}

export async function mockCarModelsApi(page: Page, options?: MockApiOptions) {
  const { delay = 50, simulateError = false, errorStatus = 500 } = options ?? {};

  await page.route('**/api/v1/car-models**', async (route: Route) => {
    const url = new URL(route.request().url());
    const brand = url.searchParams.get('brand')?.toLowerCase() ?? '';

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (simulateError) {
      return route.fulfill({
        status: errorStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load car models' }),
      });
    }

    const models = MOCK_CAR_MODELS[brand] ?? [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(models),
    });
  });
}

export async function mockSubmitApplicationApi(page: Page, options?: MockApiOptions) {
  const { delay = 200, simulateError = false, errorStatus = 500 } = options ?? {};

  await page.route('**/api/v1/credit-applications', async (route: Route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (simulateError) {
      return route.fulfill({
        status: errorStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to submit application' }),
      });
    }

    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'APP-' + Date.now(),
        status: 'submitted',
        message: 'Application submitted successfully',
      }),
    });
  });
}

// ============================================================================
// Combined Mock Functions
// ============================================================================

export async function mockAllApis(page: Page, options?: MockApiOptions) {
  await Promise.all([
    mockCreditApplicationApi(page, options),
    mockDictionariesApi(page, options),
    mockRegionsApi(page, options),
    mockCitiesApi(page, options),
    mockCarModelsApi(page, options),
    mockSubmitApplicationApi(page, options),
  ]);
}

export async function mockAllApisForHappyPath(page: Page) {
  await mockAllApis(page, { delay: 50 });
}

export async function mockAllApisWithErrors(page: Page, options?: { errorStatus?: number }) {
  await mockAllApis(page, {
    delay: 50,
    simulateError: true,
    errorStatus: options?.errorStatus ?? 500,
  });
}

export async function mockAllApisWithDelay(page: Page, delayMs: number = 2000) {
  await mockAllApis(page, { delay: delayMs });
}
