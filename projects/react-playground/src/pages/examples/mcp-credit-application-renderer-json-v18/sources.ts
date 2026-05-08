// Option lists + array-item templates (registered in registry as sources).

import type {
  PropertyItem,
  ExistingLoanItem,
  CoBorrowerItem,
} from './types';

export const LOAN_TYPES = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
  { value: 'refinance', label: 'Рефинансирование' },
];

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'employed', label: 'Работающий по найму' },
  { value: 'selfEmployed', label: 'Индивидуальный предприниматель' },
  { value: 'unemployed', label: 'Безработный' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

export const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Холост / не замужем' },
  { value: 'married', label: 'Женат / замужем' },
  { value: 'divorced', label: 'Разведён / разведена' },
  { value: 'widowed', label: 'Вдовец / вдова' },
];

export const EDUCATION_OPTIONS = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Учёная степень' },
];

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'car', label: 'Автомобиль' },
];

// Array item templates — plain leaf values for FormArray.AddButton initialValue.
export const PROPERTY_TEMPLATE = (): PropertyItem => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

export const EXISTING_LOAN_TEMPLATE = (): ExistingLoanItem => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

export const CO_BORROWER_TEMPLATE = (): CoBorrowerItem => ({
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    gender: 'male',
    birthPlace: '',
  },
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});

// Item-label functions for FormArraySection sources.
export const PROPERTY_ITEM_LABEL_FN = (_form: unknown, index: number) => `Имущество #${index + 1}`;
export const EXISTING_LOAN_ITEM_LABEL_FN = (_form: unknown, index: number) =>
  `Кредит #${index + 1}`;
export const CO_BORROWER_ITEM_LABEL_FN = (_form: unknown, index: number) =>
  `Созаёмщик #${index + 1}`;

export const CURRENT_YEAR_PLUS_ONE = new Date().getFullYear() + 1;
