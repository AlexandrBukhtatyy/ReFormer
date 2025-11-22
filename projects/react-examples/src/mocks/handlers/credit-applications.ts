import { http, HttpResponse } from 'msw';
import type { CreditApplicationForm } from '../../pages/examples/complex-multy-step-form/types/credit-application';

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

export const handlers = [
  // GET /api/v1/credit-applications/{id} - Получение заявки по ID
  http.get('/api/v1/credit-applications/:id', ({ params }) => {
    const { id } = params;
    const foundedCreditApplication = typeof id === 'string' && MOCK_APPLICATIONS[id];

    if (!foundedCreditApplication) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(foundedCreditApplication);
  }),

  // POST /api/v1/credit-applications - Создание/обновление заявки
  http.post('/api/v1/credit-applications', async ({ request }) => {
    const body = (await request.json()) as Partial<CreditApplicationForm>;

    // Симуляция сохранения заявки
    const newId = String(Date.now());
    MOCK_APPLICATIONS[newId] = body;

    return HttpResponse.json(
      {
        success: true,
        id: newId,
        message: 'Заявка успешно сохранена',
      },
      { status: 201 }
    );
  }),
];
