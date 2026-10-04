/**
 * Модель данных кредитной заявки — источник истины значений.
 *
 * `createCreditApplicationModel()` строит реактивную {@link FormModel} из начальных значений.
 * Значения принадлежат модели; узлы схемы, правила и поведение привязываются к её сигналам
 * (`model.$.…`).
 *
 * Здесь же — шаблоны новых элементов массивов: `arrayOf(blank)` объявляет пустой массив и то, чем
 * его пополняет кнопка «Добавить». Шаблон несёт ВСЕ поля элемента — иначе под-модель строки не
 * получит сигналов для полей схемы.
 */

import { arrayOf, createModel, type FormModel } from '@reformer/core';
import type { CreditApplicationForm } from './types/credit-application';
import type { Address } from './components/nested-forms/Address/types';
import type { Property } from './components/nested-forms/Property/types';
import type { ExistingLoan } from './components/nested-forms/ExistingLoan/types';
import type { CoBorrower } from './components/nested-forms/CoBorrower/types';

const blankAddress = (): Address => ({
  region: '',
  city: '',
  street: '',
  house: '',
  apartment: '',
  postalCode: '',
});

const blankProperty = (): Property => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

const blankExistingLoan = (): ExistingLoan => ({
  bank: '',
  type: 'consumer',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

const blankCoBorrower = (): CoBorrower => ({
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
  },
  phone: '',
  email: '',
  relationship: 'spouse',
  monthlyIncome: 0,
});

/**
 * Начальные значения формы (определяют форму данных и initial-снимок модели).
 * Числовые «пустые» поля держим как `null` — required-валидаторы их отсекут.
 */
const createInitialCreditApplication = (): CreditApplicationForm =>
  ({
    // Шаг 1: Основная информация
    loanType: 'consumer',
    loanAmount: null,
    loanTerm: 12,
    loanPurpose: '',
    propertyValue: null,
    initialPayment: null,
    carBrand: '',
    carModel: '',
    carYear: null,
    carPrice: null,

    // Шаг 2: Персональные данные
    personalData: {
      lastName: '',
      firstName: '',
      middleName: '',
      birthDate: '',
      birthPlace: '',
      gender: 'male',
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

    // Шаг 3: Контактная информация
    phoneMain: '',
    phoneAdditional: '',
    email: '',
    emailAdditional: '',
    sameEmail: false,
    registrationAddress: blankAddress(),
    sameAsRegistration: true,
    residenceAddress: blankAddress(),

    // Шаг 4: Информация о занятости
    employmentStatus: 'employed',
    companyName: '',
    companyInn: '',
    companyPhone: '',
    companyAddress: '',
    position: '',
    workExperienceTotal: null,
    workExperienceCurrent: null,
    monthlyIncome: null,
    additionalIncome: null,
    additionalIncomeSource: '',
    businessType: '',
    businessInn: '',
    businessActivity: '',

    // Шаг 5: Дополнительная информация. Массивы: пустой список + шаблон для кнопки «Добавить».
    maritalStatus: 'single',
    dependents: 0,
    education: 'higher',
    documents: null,
    hasProperty: false,
    properties: arrayOf(blankProperty),
    hasExistingLoans: false,
    existingLoans: arrayOf(blankExistingLoan),
    hasCoBorrower: false,
    coBorrowers: arrayOf(blankCoBorrower),

    // Шаг 6: Согласия
    agreePersonalData: false,
    agreeCreditHistory: false,
    agreeMarketing: false,
    agreeTerms: false,
    confirmAccuracy: false,
    electronicSignature: '',

    // Вычисляемые поля
    interestRate: 0,
    monthlyPayment: 0,
    fullName: '',
    age: null,
    totalIncome: 0,
    paymentToIncomeRatio: 0,
    coBorrowersIncome: 0,
  }) as unknown as CreditApplicationForm;

/** Создать реактивную модель кредитной заявки. */
export const createCreditApplicationModel = (): FormModel<CreditApplicationForm> =>
  createModel<CreditApplicationForm>(createInitialCreditApplication());
