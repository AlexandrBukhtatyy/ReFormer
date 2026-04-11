/**
 * Data Builder для формы заявки на кредит
 * Паттерн Builder для создания тестовых данных с поддержкой модификаторов
 */

import type {
  PersonalData,
  PassportData,
  AddressData,
  EmploymentData,
} from '../test-data';

// ============================================================================
// Типы для Builder
// ============================================================================

export interface LoanBaseData {
  loanType: 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
  loanAmount: number;
  loanTerm: number;
}

export interface ConsumerLoanBuilderData extends LoanBaseData {
  loanType: 'consumer';
  loanPurpose: string;
}

export interface MortgageLoanBuilderData extends LoanBaseData {
  loanType: 'mortgage';
  propertyValue: number;
  initialPayment: number;
}

export interface CarLoanBuilderData extends LoanBaseData {
  loanType: 'car';
  carBrand: string;
  carModel: string;
  carYear: number;
  carPrice: number;
}

export interface BusinessLoanBuilderData extends LoanBaseData {
  loanType: 'business';
  businessType: string;
  businessInn: string;
  businessActivity: string;
}

export interface RefinancingLoanBuilderData extends LoanBaseData {
  loanType: 'refinancing';
  existingLoanBank: string;
  existingLoanAmount: number;
  existingLoanRate: number;
}

export interface ContactData {
  phoneMain: string;
  phoneAdditional?: string;
  email: string;
  emailAdditional?: string;
}

export interface AdditionalInfo {
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  dependents: number;
  education: 'secondary' | 'specialized' | 'higher' | 'postgraduate';
}

export interface PropertyData {
  type: 'apartment' | 'house' | 'car' | 'land' | 'none';
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
}

export interface ExistingLoanData {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
}

export interface CoBorrowerData {
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
}

export interface ConsentsData {
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;
}

// ============================================================================
// Credit Form Builder
// ============================================================================

export const creditFormBuilder = {
  // ==========================================================================
  // Базовые сценарии кредитов
  // ==========================================================================

  /**
   * Потребительский кредит - базовый сценарий
   */
  consumerLoan: (): ConsumerLoanBuilderData => ({
    loanType: 'consumer',
    loanAmount: 500000,
    loanTerm: 24,
    loanPurpose: 'Ремонт квартиры',
  }),

  /**
   * Ипотечный кредит
   */
  mortgage: (): MortgageLoanBuilderData => ({
    loanType: 'mortgage',
    loanAmount: 4000000,
    loanTerm: 240,
    propertyValue: 5000000,
    initialPayment: 1000000,
  }),

  /**
   * Автокредит
   */
  carLoan: (): CarLoanBuilderData => ({
    loanType: 'car',
    loanAmount: 2500000,
    loanTerm: 60,
    carBrand: 'Toyota',
    carModel: 'Camry',
    carYear: 2024,
    carPrice: 3000000,
  }),

  /**
   * Бизнес-кредит
   */
  businessLoan: (): BusinessLoanBuilderData => ({
    loanType: 'business',
    loanAmount: 3000000,
    loanTerm: 36,
    businessType: 'ООО',
    businessInn: '7707083893',
    businessActivity: 'Розничная торговля',
  }),

  /**
   * Рефинансирование
   */
  refinancing: (): RefinancingLoanBuilderData => ({
    loanType: 'refinancing',
    loanAmount: 1000000,
    loanTerm: 48,
    existingLoanBank: 'Сбербанк',
    existingLoanAmount: 1200000,
    existingLoanRate: 15.5,
  }),

  // ==========================================================================
  // Персональные данные
  // ==========================================================================

  /**
   * Валидные персональные данные (мужчина)
   */
  personalData: (): PersonalData => ({
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: 'Иванович',
    birthDate: '1990-05-15',
    birthPlace: 'г. Москва',
    gender: 'male',
  }),

  /**
   * Персональные данные (женщина)
   */
  personalDataFemale: (): PersonalData => ({
    lastName: 'Иванова',
    firstName: 'Мария',
    middleName: 'Петровна',
    birthDate: '1988-03-22',
    birthPlace: 'г. Санкт-Петербург',
    gender: 'female',
  }),

  /**
   * Паспортные данные
   */
  passportData: (): PassportData => ({
    series: '45 06',
    number: '123456',
    issuedBy: 'ОВД Центрального района г. Москвы',
    issuedDate: '2010-06-20',
    code: '770-001',
  }),

  /**
   * ИНН и СНИЛС
   */
  identificationData: () => ({
    inn: '123456789012',
    snils: '123-456-789 01',
  }),

  // ==========================================================================
  // Контактные данные
  // ==========================================================================

  /**
   * Контактные данные
   */
  contactData: (): ContactData => ({
    phoneMain: '+7 (999) 123-45-67',
    phoneAdditional: '+7 (999) 765-43-21',
    email: 'ivanov@example.com',
    emailAdditional: 'ivanov.work@example.com',
  }),

  /**
   * Минимальные контактные данные
   */
  contactDataMinimal: (): ContactData => ({
    phoneMain: '+7 (999) 123-45-67',
    email: 'ivanov@example.com',
  }),

  /**
   * Адрес регистрации
   */
  registrationAddress: (): AddressData => ({
    region: 'Московская область',
    city: 'Москва',
    street: 'Тверская',
    house: '1',
    apartment: '10',
    postalCode: '123456',
  }),

  /**
   * Адрес проживания (отличается от регистрации)
   */
  residenceAddress: (): AddressData => ({
    region: 'Московская область',
    city: 'Москва',
    street: 'Арбат',
    house: '25',
    apartment: '5',
    postalCode: '123457',
  }),

  // ==========================================================================
  // Данные о занятости
  // ==========================================================================

  /**
   * Наемный работник
   */
  employedData: (): EmploymentData => ({
    status: 'employed',
    companyName: 'ООО Рога и Копыта',
    companyInn: '7707083893',
    position: 'Менеджер',
    monthlyIncome: 100000,
    additionalIncome: 20000,
    workExperience: 60,
    currentJobExperience: 24,
  }),

  /**
   * Самозанятый
   */
  selfEmployedData: (): EmploymentData => ({
    status: 'selfEmployed',
    monthlyIncome: 150000,
    additionalIncome: 30000,
    workExperience: 48,
    currentJobExperience: 48,
  }),

  /**
   * Безработный
   */
  unemployedData: (): EmploymentData => ({
    status: 'unemployed',
    monthlyIncome: 30000,
    workExperience: 36,
    currentJobExperience: 0,
  }),

  /**
   * Пенсионер
   */
  retiredData: (): EmploymentData => ({
    status: 'retired',
    monthlyIncome: 25000,
    workExperience: 240,
    currentJobExperience: 0,
  }),

  /**
   * Студент
   */
  studentData: (): EmploymentData => ({
    status: 'student',
    monthlyIncome: 15000,
    workExperience: 0,
    currentJobExperience: 0,
  }),

  // ==========================================================================
  // Дополнительная информация
  // ==========================================================================

  /**
   * Дополнительная информация
   */
  additionalInfo: (): AdditionalInfo => ({
    maritalStatus: 'married',
    dependents: 2,
    education: 'higher',
  }),

  /**
   * Имущество
   */
  property: (): PropertyData => ({
    type: 'apartment',
    description: 'Квартира 3-комнатная',
    estimatedValue: 8000000,
    hasEncumbrance: false,
  }),

  /**
   * Существующий кредит
   */
  existingLoan: (): ExistingLoanData => ({
    bank: 'Сбербанк',
    type: 'Потребительский',
    amount: 500000,
    remainingAmount: 300000,
    monthlyPayment: 15000,
    maturityDate: '2025-12-01',
  }),

  /**
   * Созаемщик
   */
  coBorrower: (): CoBorrowerData => ({
    personalData: {
      lastName: 'Иванова',
      firstName: 'Мария',
      middleName: 'Петровна',
      birthDate: '1992-08-10',
    },
    phone: '+7 (999) 111-22-33',
    email: 'maria@example.com',
    relationship: 'Супруга',
    monthlyIncome: 80000,
  }),

  // ==========================================================================
  // Согласия
  // ==========================================================================

  /**
   * Все согласия приняты
   */
  consents: (): ConsentsData => ({
    agreePersonalData: true,
    agreeCreditHistory: true,
    agreeMarketing: true,
    agreeTerms: true,
    confirmAccuracy: true,
    electronicSignature: 'Иванов Иван Иванович',
  }),

  /**
   * Минимальные обязательные согласия
   */
  consentsMinimal: (): ConsentsData => ({
    agreePersonalData: true,
    agreeCreditHistory: true,
    agreeMarketing: false,
    agreeTerms: true,
    confirmAccuracy: true,
    electronicSignature: 'Иванов Иван Иванович',
  }),

  // ==========================================================================
  // Модификаторы для негативных сценариев
  // ==========================================================================

  /**
   * Невалидный телефон
   */
  withInvalidPhone: <T extends { phoneMain?: string }>(base: T): T => ({
    ...base,
    phoneMain: 'invalid-phone',
  }),

  /**
   * Неполный телефон
   */
  withIncompletePhone: <T extends { phoneMain?: string }>(base: T): T => ({
    ...base,
    phoneMain: '123',
  }),

  /**
   * Невалидный email
   */
  withInvalidEmail: <T extends { email?: string }>(base: T): T => ({
    ...base,
    email: 'not-an-email',
  }),

  /**
   * Отсутствует обязательное поле lastName
   */
  withMissingLastName: <T extends { lastName?: string }>(base: T): T => ({
    ...base,
    lastName: '',
  }),

  /**
   * Отсутствует обязательное поле firstName
   */
  withMissingFirstName: <T extends { firstName?: string }>(base: T): T => ({
    ...base,
    firstName: '',
  }),

  /**
   * Возраст меньше 18 лет
   */
  withAgeUnder18: <T extends { birthDate?: string }>(base: T): T => ({
    ...base,
    birthDate: '2010-01-01',
  }),

  /**
   * Возраст больше 70 лет
   */
  withAgeOver70: <T extends { birthDate?: string }>(base: T): T => ({
    ...base,
    birthDate: '1950-01-01',
  }),

  /**
   * Дата рождения в будущем
   */
  withFutureBirthDate: <T extends { birthDate?: string }>(base: T): T => ({
    ...base,
    birthDate: '2030-01-01',
  }),

  /**
   * Слишком маленькая сумма кредита
   */
  withLoanAmountTooLow: <T extends { loanAmount?: number }>(base: T): T => ({
    ...base,
    loanAmount: 10000,
  }),

  /**
   * Слишком большая сумма кредита
   */
  withLoanAmountTooHigh: <T extends { loanAmount?: number }>(base: T): T => ({
    ...base,
    loanAmount: 15000000,
  }),

  /**
   * Слишком короткий срок кредита
   */
  withLoanTermTooShort: <T extends { loanTerm?: number }>(base: T): T => ({
    ...base,
    loanTerm: 3,
  }),

  /**
   * Слишком длинный срок кредита
   */
  withLoanTermTooLong: <T extends { loanTerm?: number }>(base: T): T => ({
    ...base,
    loanTerm: 300,
  }),

  /**
   * Невалидный ИНН
   */
  withInvalidInn: <T extends { inn?: string }>(base: T): T => ({
    ...base,
    inn: '12345',
  }),

  /**
   * Невалидный СНИЛС
   */
  withInvalidSnils: <T extends { snils?: string }>(base: T): T => ({
    ...base,
    snils: '123-456',
  }),

  /**
   * Слишком низкий доход
   */
  withLowIncome: <T extends { monthlyIncome?: number }>(base: T): T => ({
    ...base,
    monthlyIncome: 5000,
  }),

  /**
   * Высокая долговая нагрузка
   */
  withHighDebtBurden: <T extends LoanBaseData>(base: T): T => ({
    ...base,
    loanAmount: 2000000,
    loanTerm: 24,
  }),

  /**
   * Стаж на текущем месте больше общего стажа
   */
  withInvalidWorkExperience: <T extends EmploymentData>(base: T): T => ({
    ...base,
    workExperience: 24,
    currentJobExperience: 36,
  }),

  /**
   * Отсутствуют обязательные согласия
   */
  withMissingConsents: <T extends Partial<ConsentsData>>(base: T): T => ({
    ...base,
    agreePersonalData: false,
    agreeCreditHistory: false,
  }),

  /**
   * Пустая подпись
   */
  withEmptySignature: <T extends { electronicSignature?: string }>(
    base: T
  ): T => ({
    ...base,
    electronicSignature: '',
  }),

  // ==========================================================================
  // Комбинированные данные
  // ==========================================================================

  /**
   * Полная форма для потребительского кредита
   */
  completeConsumerLoan: () => ({
    ...creditFormBuilder.consumerLoan(),
    personalData: creditFormBuilder.personalData(),
    passportData: creditFormBuilder.passportData(),
    ...creditFormBuilder.identificationData(),
    ...creditFormBuilder.contactData(),
    registrationAddress: creditFormBuilder.registrationAddress(),
    sameAsRegistration: true,
    residenceAddress: creditFormBuilder.registrationAddress(),
    employment: creditFormBuilder.employedData(),
    additional: creditFormBuilder.additionalInfo(),
    hasProperty: false,
    properties: [] as PropertyData[],
    hasExistingLoans: false,
    existingLoans: [] as ExistingLoanData[],
    hasCoBorrower: false,
    coBorrowers: [] as CoBorrowerData[],
    ...creditFormBuilder.consents(),
  }),

  /**
   * Полная форма для ипотеки
   */
  completeMortgage: () => ({
    ...creditFormBuilder.mortgage(),
    personalData: creditFormBuilder.personalData(),
    passportData: creditFormBuilder.passportData(),
    ...creditFormBuilder.identificationData(),
    ...creditFormBuilder.contactData(),
    registrationAddress: creditFormBuilder.registrationAddress(),
    sameAsRegistration: false,
    residenceAddress: creditFormBuilder.residenceAddress(),
    employment: creditFormBuilder.employedData(),
    additional: creditFormBuilder.additionalInfo(),
    hasProperty: true,
    properties: [creditFormBuilder.property()],
    hasExistingLoans: false,
    existingLoans: [] as ExistingLoanData[],
    hasCoBorrower: true,
    coBorrowers: [creditFormBuilder.coBorrower()],
    ...creditFormBuilder.consents(),
  }),

  /**
   * Полная форма для автокредита
   */
  completeCarLoan: () => ({
    ...creditFormBuilder.carLoan(),
    personalData: creditFormBuilder.personalData(),
    passportData: creditFormBuilder.passportData(),
    ...creditFormBuilder.identificationData(),
    ...creditFormBuilder.contactData(),
    registrationAddress: creditFormBuilder.registrationAddress(),
    sameAsRegistration: true,
    residenceAddress: creditFormBuilder.registrationAddress(),
    employment: creditFormBuilder.employedData(),
    additional: creditFormBuilder.additionalInfo(),
    hasProperty: false,
    properties: [] as PropertyData[],
    hasExistingLoans: false,
    existingLoans: [] as ExistingLoanData[],
    hasCoBorrower: false,
    coBorrowers: [] as CoBorrowerData[],
    ...creditFormBuilder.consents(),
  }),

  /**
   * Минимально заполненная форма (только обязательные поля)
   */
  minimal: () => ({
    ...creditFormBuilder.consumerLoan(),
    personalData: creditFormBuilder.personalData(),
    passportData: creditFormBuilder.passportData(),
    ...creditFormBuilder.identificationData(),
    ...creditFormBuilder.contactDataMinimal(),
    registrationAddress: creditFormBuilder.registrationAddress(),
    sameAsRegistration: true,
    residenceAddress: creditFormBuilder.registrationAddress(),
    employment: creditFormBuilder.employedData(),
    additional: creditFormBuilder.additionalInfo(),
    hasProperty: false,
    properties: [] as PropertyData[],
    hasExistingLoans: false,
    existingLoans: [] as ExistingLoanData[],
    hasCoBorrower: false,
    coBorrowers: [] as CoBorrowerData[],
    ...creditFormBuilder.consentsMinimal(),
  }),
};

export type CreditFormBuilder = typeof creditFormBuilder;
