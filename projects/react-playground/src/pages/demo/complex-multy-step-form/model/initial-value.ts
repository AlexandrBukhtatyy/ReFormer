/**
 * Начальные значения заявки: определяют форму данных и initial-снимок модели.
 *
 * Пустое числовое поле — `null`. Массив объявляется через `arrayOf(blank)`: пустой список и шаблон
 * элемента для кнопки «Добавить».
 */

import { arrayOf } from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import { blankAddress } from './factories/address';
import { blankProperty } from './factories/property';
import { blankExistingLoan } from './factories/existing-loan';
import { blankCoBorrower } from './factories/co-borrower';

export const createInitialCreditApplication = (): CreditApplicationForm => ({
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

  // Шаг 5: Дополнительная информация
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
});
