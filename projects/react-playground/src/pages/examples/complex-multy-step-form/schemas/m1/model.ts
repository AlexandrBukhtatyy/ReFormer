/**
 * M1: модель данных кредитной заявки (источник истины значений).
 *
 * `createCreditApplicationModel()` строит реактивную {@link FormModel} из начальных значений.
 * Значения принадлежат модели; форма/ноды ссылаются на её сигналы (см. schema.ts / create-form.ts).
 *
 * Здесь же — фабрики «пустых» элементов массивов: при добавлении нового элемента в модель нужно
 * передать ПОЛНЫЙ объект (все поля), иначе под-модель элемента не получит сигналов для полей схемы.
 */

import { createModel, type FormModel } from '@reformer/core';
import type { CreditApplicationForm } from '../../types/credit-application';
import type { Property } from '../../components/nested-forms/Property/types';
import type { ExistingLoan } from '../../components/nested-forms/ExistingLoan/types';
import type { CoBorrower } from '../../components/nested-forms/CoBorrower/types';

/**
 * Начальные значения формы (определяют форму данных и initial-снимок модели).
 * Числовые «пустые» поля держим как `null` (как в исходной схеме) — required-валидаторы их отсекут.
 */
export const createInitialCreditApplication = (): CreditApplicationForm =>
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
    registrationAddress: {
      region: '',
      city: '',
      street: '',
      house: '',
      apartment: '',
      postalCode: '',
    },
    sameAsRegistration: true,
    residenceAddress: {
      region: '',
      city: '',
      street: '',
      house: '',
      apartment: '',
      postalCode: '',
    },

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

    // Шаг 5: Дополнительная информация
    maritalStatus: 'single',
    dependents: 0,
    education: 'higher',
    hasProperty: false,
    properties: [],
    hasExistingLoans: false,
    existingLoans: [],
    hasCoBorrower: false,
    coBorrowers: [],

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
    sameEmail: false,
  }) as unknown as CreditApplicationForm;

/** Создать реактивную модель кредитной заявки. */
export const createCreditApplicationModel = (): FormModel<CreditApplicationForm> =>
  createModel<CreditApplicationForm>(createInitialCreditApplication());

// ============================================================================
// Фабрики «пустых» элементов массивов (полный объект — все поля обязательны)
// ============================================================================

export const createBlankProperty = (): Property => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

export const createBlankExistingLoan = (): ExistingLoan => ({
  bank: '',
  type: 'consumer',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

export const createBlankCoBorrower = (): CoBorrower => ({
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
