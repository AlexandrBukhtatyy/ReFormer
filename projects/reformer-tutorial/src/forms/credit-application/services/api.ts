/**
 * Мок-сервис для работы с API заявок на кредит
 *
 * Этот файл демонстрирует типичные операции с API:
 * - Загрузка профиля пользователя
 * - Загрузка существующей заявки
 * - Сохранение заявки
 */

// Задержка для имитации сетевых запросов
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Тип данных API - как данные приходят с сервера
 * Даты представлены в формате ISO string
 */
export interface ApiApplicationData {
  loanType: string;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;
  propertyValue: number;
  initialPayment: number;
  carBrand: string;
  carModel: string;
  carYear: number;
  carPrice: number;
  personalData: {
    lastName: string;
    firstName: string;
    middleName: string;
    birthDate: string; // ISO string от API
    birthPlace: string;
    gender: 'male' | 'female';
  };
  passportData: {
    series: string;
    number: string;
    issueDate: string; // ISO string от API
    issuedBy: string;
    departmentCode: string;
  };
  inn: string;
  snils: string;
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: {
    region: string;
    city: string;
    street: string;
    house: string;
    apartment?: string;
    postalCode: string;
  };
  sameAsRegistration: boolean;
  residenceAddress: {
    region: string;
    city: string;
    street: string;
    house: string;
    apartment?: string;
    postalCode: string;
  };
  employmentStatus: string;
  companyName: string;
  companyInn: string;
  companyPhone: string;
  companyAddress: string;
  position: string;
  workExperienceTotal: number;
  workExperienceCurrent: number;
  monthlyIncome: number;
  additionalIncome: number;
  additionalIncomeSource: string;
  businessType: string;
  businessInn: string;
  businessActivity: string;
  maritalStatus: string;
  dependents: number;
  education: string;
  hasProperty: boolean;
  properties: Array<{
    type: string;
    description: string;
    estimatedValue: number;
    hasEncumbrance: boolean;
  }>;
  hasExistingLoans: boolean;
  existingLoans: Array<{
    bank: string;
    type: string;
    amount: number;
    remainingAmount: number;
    monthlyPayment: number;
    maturityDate: string;
  }>;
  hasCoBorrower: boolean;
  coBorrowers: Array<{
    personalData: {
      lastName: string;
      firstName: string;
      middleName: string;
      birthDate: string;
    };
    phone: string;
    email: string;
    relationship: string;
    monthlyIncome: number;
  }>;
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;
}

/**
 * Профиль пользователя для предзаполнения формы
 */
export interface UserProfile {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  phone: string;
  birthDate: string;
}

/**
 * Получить профиль текущего пользователя
 * Используется для предзаполнения формы новой заявки
 */
export async function fetchUserProfile(): Promise<UserProfile> {
  await delay(500);

  return {
    firstName: 'Иван',
    lastName: 'Иванов',
    middleName: 'Петрович',
    email: 'ivan.ivanov@example.com',
    phone: '+79001234567',
    birthDate: '1990-05-15',
  };
}

/**
 * Получить существующую заявку по ID
 * Используется для редактирования заявки
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchApplication(_id: string): Promise<ApiApplicationData> {
  await delay(800);

  // Мок-данные существующей заявки
  return {
    loanType: 'consumer',
    loanAmount: 500000,
    loanTerm: 24,
    loanPurpose: 'Ремонт квартиры',
    propertyValue: 0,
    initialPayment: 0,
    carBrand: '',
    carModel: '',
    carYear: 0,
    carPrice: 0,
    personalData: {
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Петрович',
      birthDate: '1990-05-15',
      birthPlace: 'г. Москва',
      gender: 'male',
    },
    passportData: {
      series: '4515',
      number: '123456',
      issueDate: '2015-03-20',
      issuedBy: 'ОВД г. Москвы',
      departmentCode: '770-001',
    },
    inn: '123456789012',
    snils: '12345678901',
    phoneMain: '+79001234567',
    phoneAdditional: '',
    email: 'ivan.ivanov@example.com',
    emailAdditional: '',
    registrationAddress: {
      region: 'Москва',
      city: 'Москва',
      street: 'ул. Ленина',
      house: '10',
      apartment: '25',
      postalCode: '123456',
    },
    sameAsRegistration: true,
    residenceAddress: {
      region: 'Москва',
      city: 'Москва',
      street: 'ул. Ленина',
      house: '10',
      apartment: '25',
      postalCode: '123456',
    },
    employmentStatus: 'employed',
    companyName: 'ООО Рога и Копыта',
    companyInn: '1234567890',
    companyPhone: '+74951234567',
    companyAddress: 'г. Москва, ул. Тверская, 1',
    position: 'Менеджер',
    workExperienceTotal: 60,
    workExperienceCurrent: 24,
    monthlyIncome: 100000,
    additionalIncome: 0,
    additionalIncomeSource: '',
    businessType: '',
    businessInn: '',
    businessActivity: '',
    maritalStatus: 'married',
    dependents: 1,
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
  };
}

/**
 * Сохранить заявку на сервер
 */
export async function saveApplication(
  data: ApiApplicationData
): Promise<{ id: string; status: string }> {
  await delay(1000);

  // Имитация отправки на сервер
  console.log('Отправка заявки на сервер:', data);

  // Возвращаем ID созданной заявки
  return {
    id: 'app-' + Date.now(),
    status: 'pending',
  };
}

/**
 * Обновить существующую заявку
 */
export async function updateApplication(
  id: string,
  data: ApiApplicationData
): Promise<{ id: string; status: string }> {
  await delay(1000);

  console.log(`Обновление заявки ${id}:`, data);

  return {
    id,
    status: 'updated',
  };
}
