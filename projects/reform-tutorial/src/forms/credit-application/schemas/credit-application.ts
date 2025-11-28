import type { FormSchema } from 'reformer';

// Импорт переиспользуемых схем
import { addressSchema } from './address.schema';
import { personalDataSchema } from './personal-data.schema';
import { passportDataSchema } from './passport-data.schema';
import { propertySchema } from './property.schema';
import { existingLoanSchema } from './existing-loan.schema';
import { coBorrowerSchema } from './co-borrower.schema';
import type { CreditApplicationForm } from '../types/credit-application.types';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { RadioGroup } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { InputSearch } from '@/components/ui/input-search';

export const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  // ============================================================================
  // Шаг 1: Основная информация о кредите
  // ============================================================================

  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      options: [
        { value: 'consumer', label: 'Потребительский' },
        { value: 'mortgage', label: 'Ипотека' },
        { value: 'car', label: 'Автокредит' },
        { value: 'business', label: 'Бизнес-кредит' },
        { value: 'refinancing', label: 'Рефинансирование' },
      ],
    },
  },

  loanAmount: {
    value: null,
    component: Input,
    componentProps: { label: 'Сумма кредита', type: 'number', min: 50000, max: 10000000 },
  },

  loanTerm: {
    value: 12,
    component: Input,
    componentProps: { label: 'Срок кредита (месяцев)', type: 'number', min: 6, max: 240 },
  },

  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Цель кредита', rows: 3 },
  },

  // Поля для ипотеки
  propertyValue: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость недвижимости', type: 'number', min: 1000000 },
  },

  initialPayment: {
    value: null,
    component: Input,
    componentProps: { label: 'Первоначальный взнос', type: 'number', min: 0 },
  },

  // Поля для автокредита
  carBrand: { value: '', component: Input, componentProps: { label: 'Марка автомобиля' } },
  carModel: { value: '', component: Select, componentProps: { label: 'Модель автомобиля' } },
  carYear: {
    value: null,
    component: Input,
    componentProps: { label: 'Год выпуска', type: 'number' },
  },
  carPrice: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость', type: 'number' },
  },

  // ============================================================================
  // Шаг 2: Персональные данные — ИСПОЛЬЗУЕМ ПЕРЕИСПОЛЬЗУЕМЫЕ СХЕМЫ
  // ============================================================================

  personalData: personalDataSchema, // ← Переиспользуемая схема
  passportData: passportDataSchema, // ← Переиспользуемая схема

  inn: { value: '', component: Input, componentProps: { label: 'ИНН' } },
  snils: { value: '', component: Input, componentProps: { label: 'СНИЛС' } },

  // ============================================================================
  // Шаг 3: Контактная информация
  // ============================================================================

  phoneMain: { value: '', component: Input, componentProps: { label: 'Основной телефон' } },
  phoneAdditional: {
    value: '',
    component: Input,
    componentProps: { label: 'Дополнительный телефон' },
  },
  email: { value: '', component: Input, componentProps: { label: 'Email', type: 'email' } },
  emailAdditional: {
    value: '',
    component: Input,
    componentProps: { label: 'Дополнительный email', type: 'email' },
  },

  registrationAddress: addressSchema, // ← Переиспользуемая схема
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
  },
  residenceAddress: addressSchema, // ← Та же схема используется повторно!

  // ============================================================================
  // Шаг 4: Информация о занятости
  // ============================================================================

  employmentStatus: {
    value: 'employed',
    component: Select,
    componentProps: {
      label: 'Статус занятости',
      options: [
        { value: 'employed', label: 'Работаю по найму' },
        { value: 'selfEmployed', label: 'Самозанятый/ИП' },
        { value: 'unemployed', label: 'Не работаю' },
        { value: 'retired', label: 'Пенсионер' },
        { value: 'student', label: 'Студент' },
      ],
    },
  },

  companyName: { value: '', component: Input, componentProps: { label: 'Название компании' } },
  companyInn: { value: '', component: Input, componentProps: { label: 'ИНН компании' } },
  companyPhone: { value: '', component: Input, componentProps: { label: 'Телефон компании' } },
  companyAddress: { value: '', component: Input, componentProps: { label: 'Адрес компании' } },
  position: { value: '', component: Input, componentProps: { label: 'Должность' } },
  workExperienceTotal: {
    value: null,
    component: Input,
    componentProps: { label: 'Общий стаж (месяцев)', type: 'number' },
  },
  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: { label: 'На текущем месте (месяцев)', type: 'number' },
  },
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Ежемесячный доход', type: 'number' },
  },
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Дополнительный доход', type: 'number' },
  },
  additionalIncomeSource: {
    value: '',
    component: Input,
    componentProps: { label: 'Источник дополнительного дохода' },
  },
  businessType: { value: '', component: Input, componentProps: { label: 'Тип бизнеса' } },
  businessInn: { value: '', component: Input, componentProps: { label: 'ИНН ИП' } },
  businessActivity: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Вид деятельности', rows: 3 },
  },

  // ============================================================================
  // Шаг 5: Дополнительная информация — МАССИВЫ ИСПОЛЬЗУЮТ ПЕРЕИСПОЛЬЗУЕМЫЕ СХЕМЫ
  // ============================================================================

  maritalStatus: {
    value: 'single',
    component: Select,
    componentProps: {
      label: 'Семейное положение',
      options: [
        { value: 'single', label: 'Не женат / Не замужем' },
        { value: 'married', label: 'Женат / Замужем' },
        { value: 'divorced', label: 'Разведён / Разведена' },
        { value: 'widowed', label: 'Вдовец / Вдова' },
      ],
    },
  },

  dependents: {
    value: 0,
    component: Input,
    componentProps: { label: 'Иждивенцы', type: 'number' },
  },
  education: {
    value: 'higher',
    component: Select,
    componentProps: {
      label: 'Образование',
      options: [
        { value: 'secondary', label: 'Среднее' },
        { value: 'specialized', label: 'Среднее специальное' },
        { value: 'higher', label: 'Высшее' },
        { value: 'postgraduate', label: 'Учёная степень' },
      ],
    },
  },

  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть имущество' },
  },
  properties: [propertySchema], // ← Массив с переиспользуемой схемой

  hasExistingLoans: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть действующие кредиты' },
  },
  existingLoans: [existingLoanSchema], // ← Массив с переиспользуемой схемой

  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Добавить созаёмщика' },
  },
  coBorrowers: [coBorrowerSchema], // ← Массив с переиспользуемой схемой

  // ============================================================================
  // Шаг 6: Согласия
  // ============================================================================

  agreePersonalData: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на обработку персональных данных' },
  },
  agreeCreditHistory: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на проверку кредитной истории' },
  },
  agreeMarketing: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на маркетинговые материалы' },
  },
  agreeTerms: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие с условиями кредитования' },
  },
  confirmAccuracy: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Подтверждаю достоверность данных' },
  },
  electronicSignature: { value: '', component: Input, componentProps: { label: 'Код из СМС' } },

  // ============================================================================
  // Вычисляемые поля
  // ============================================================================

  interestRate: {
    value: 0,
    component: Input,
    componentProps: { label: 'Процентная ставка (%)', disabled: true },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платёж', disabled: true },
  },
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя', disabled: true },
  },
  age: { value: null, component: Input, componentProps: { label: 'Возраст', disabled: true } },
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Общий доход', disabled: true },
  },
  paymentToIncomeRatio: {
    value: 0,
    component: Input,
    componentProps: { label: 'Платёж/Доход (%)', disabled: true },
  },
  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Доход созаёмщиков', disabled: true },
  },
};
