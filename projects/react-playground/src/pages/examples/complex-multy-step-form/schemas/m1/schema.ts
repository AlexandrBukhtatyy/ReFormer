/**
 * M1: единая схема кредитной заявки (FormSchema ⊕ RenderSchema).
 *
 * Одна схема-дерево: каждый field-узел несёт `value` (СИГНАЛ модели) + `component` + `componentProps`.
 * Структура зеркалит модель; значения берутся из её сигналов (`model.$.<path>`). Массивы объявляются
 * узлом `{ array: model.<path>, item: (itemModel) => <под-схема элемента> }` — `createForm` материализует
 * их как `ModelArrayNode` (`form.<array>`), совместимый с `FormArraySection`.
 *
 * Layout (Step/Section) остаётся в React-компонентах шагов; схема описывает только привязку полей.
 */

import { Select, Checkbox, Input, InputMask, RadioGroup, Textarea } from '@reformer/ui-kit';
import type { FormModel, ModelSignals } from '@reformer/core';
import {
  LOAN_TYPES,
  EMPLOYMENT_STATUSES,
  MARITAL_STATUSES,
  EDUCATIONS,
  GENDERS,
  RELATIONSHIPS,
  EXISTING_LOAN_TYPES,
} from '../../constants/credit-application';
import type { CreditApplicationForm } from '../../types/credit-application';
import type { PersonalData } from '../../components/nested-forms/PersonalData/types';
import type { PassportData } from '../../components/nested-forms/PassportData/types';
import type { Address } from '../../components/nested-forms/Address/types';
import type { Property } from '../../components/nested-forms/Property/types';
import type { ExistingLoan } from '../../components/nested-forms/ExistingLoan/types';
import type { CoBorrower } from '../../components/nested-forms/CoBorrower/types';

// ============================================================================
// Под-схемы вложенных групп (получают сигналы под-модели через model.$.<group>)
// ============================================================================

const personalDataNodes = (s: ModelSignals<PersonalData>) => ({
  lastName: {
    value: s.lastName,
    component: Input,
    componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
  },
  firstName: {
    value: s.firstName,
    component: Input,
    componentProps: { label: 'Имя', placeholder: 'Введите имя' },
  },
  middleName: {
    value: s.middleName,
    component: Input,
    componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
  },
  birthDate: {
    value: s.birthDate,
    component: Input,
    componentProps: { label: 'Дата рождения', type: 'date' },
  },
  gender: {
    value: s.gender,
    component: RadioGroup,
    componentProps: { label: 'Пол', options: GENDERS },
  },
  birthPlace: {
    value: s.birthPlace,
    component: Input,
    componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
  },
});

const passportDataNodes = (s: ModelSignals<PassportData>) => ({
  series: {
    value: s.series,
    component: InputMask,
    componentProps: { label: 'Серия паспорта', placeholder: '00 00', mask: '99 99' },
  },
  number: {
    value: s.number,
    component: InputMask,
    componentProps: { label: 'Номер паспорта', placeholder: '000000', mask: '999999' },
  },
  issueDate: {
    value: s.issueDate,
    component: Input,
    componentProps: { label: 'Дата выдачи', type: 'date' },
  },
  issuedBy: {
    value: s.issuedBy,
    component: Textarea,
    componentProps: { label: 'Кем выдан', placeholder: 'Введите наименование органа', rows: 3 },
  },
  departmentCode: {
    value: s.departmentCode,
    component: InputMask,
    componentProps: { label: 'Код подразделения', placeholder: '000-000', mask: '999-999' },
  },
});

const addressNodes = (s: ModelSignals<Address>) => ({
  region: {
    value: s.region,
    component: Input,
    componentProps: { label: 'Регион', placeholder: 'Введите регион' },
  },
  city: {
    value: s.city,
    component: Input,
    componentProps: { label: 'Город', placeholder: 'Введите город' },
  },
  street: {
    value: s.street,
    component: Input,
    componentProps: { label: 'Улица', placeholder: 'Введите улицу' },
  },
  house: {
    value: s.house,
    component: Input,
    componentProps: { label: 'Дом', placeholder: '№' },
  },
  apartment: {
    value: s.apartment,
    component: Input,
    componentProps: { label: 'Квартира', placeholder: '№' },
  },
  postalCode: {
    value: s.postalCode,
    component: InputMask,
    componentProps: { label: 'Индекс', placeholder: '000000', mask: '999999' },
  },
});

// ============================================================================
// Под-схемы элементов массивов (получают под-модель элемента)
// ============================================================================

const propertyItem = (item: FormModel<Property>) => ({
  type: {
    value: item.$.type,
    component: Select,
    componentProps: {
      label: 'Тип имущества',
      placeholder: 'Выберите тип',
      options: [
        { value: 'apartment', label: 'Квартира' },
        { value: 'house', label: 'Дом' },
        { value: 'land', label: 'Земельный участок' },
        { value: 'commercial', label: 'Коммерческая недвижимость' },
        { value: 'car', label: 'Автомобиль' },
        { value: 'other', label: 'Другое' },
      ],
    },
  },
  description: {
    value: item.$.description,
    component: Textarea,
    componentProps: { label: 'Описание', placeholder: 'Опишите имущество', rows: 2 },
  },
  estimatedValue: {
    value: item.$.estimatedValue,
    component: Input,
    componentProps: {
      label: 'Оценочная стоимость',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
  hasEncumbrance: {
    value: item.$.hasEncumbrance,
    component: Checkbox,
    componentProps: { label: 'Имеется обременение (залог)' },
  },
});

const existingLoanItem = (item: FormModel<ExistingLoan>) => ({
  bank: {
    value: item.$.bank,
    component: Input,
    componentProps: { label: 'Банк', placeholder: 'Название банка' },
  },
  type: {
    value: item.$.type,
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип',
      options: EXISTING_LOAN_TYPES,
    },
  },
  amount: {
    value: item.$.amount,
    component: Input,
    componentProps: {
      label: 'Сумма кредита (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
  remainingAmount: {
    value: item.$.remainingAmount,
    component: Input,
    componentProps: {
      label: 'Остаток долга (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
  monthlyPayment: {
    value: item.$.monthlyPayment,
    component: Input,
    componentProps: {
      label: 'Ежемесячный платеж (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 100,
    },
  },
  maturityDate: {
    value: item.$.maturityDate,
    component: Input,
    componentProps: { label: 'Дата погашения', type: 'date' },
  },
});

const coBorrowerItem = (item: FormModel<CoBorrower>) => ({
  personalData: {
    lastName: {
      value: item.$.personalData.lastName,
      component: Input,
      componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
    },
    firstName: {
      value: item.$.personalData.firstName,
      component: Input,
      componentProps: { label: 'Имя', placeholder: 'Введите имя' },
    },
    middleName: {
      value: item.$.personalData.middleName,
      component: Input,
      componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
    },
    birthDate: {
      value: item.$.personalData.birthDate,
      component: Input,
      componentProps: { label: 'Дата рождения', type: 'date' },
    },
  },
  phone: {
    value: item.$.phone,
    component: InputMask,
    componentProps: {
      label: 'Телефон',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
    },
  },
  email: {
    value: item.$.email,
    component: Input,
    componentProps: { label: 'Email', placeholder: 'example@mail.com', type: 'email' },
  },
  relationship: {
    value: item.$.relationship,
    component: Select,
    componentProps: {
      label: 'Отношение к заемщику',
      placeholder: 'Выберите отношение',
      options: RELATIONSHIPS,
    },
  },
  monthlyIncome: {
    value: item.$.monthlyIncome,
    component: Input,
    componentProps: {
      label: 'Ежемесячный доход (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
});

// ============================================================================
// Единая схема кредитной заявки
// ============================================================================

const numberProps = (props: Record<string, unknown>) => ({ type: 'number', ...props });

/**
 * Единая M1-схема: привязка полей к сигналам модели + UI-конфиг.
 * Передаётся в `createForm({ model, schema })`.
 */
export const creditApplicationSchema = (model: FormModel<CreditApplicationForm>) => ({
  // ── Шаг 1: Основная информация ──────────────────────────────────────────
  loanType: {
    value: model.$.loanType,
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: LOAN_TYPES,
    },
  },
  loanAmount: {
    value: model.$.loanAmount,
    component: Input,
    componentProps: numberProps({
      label: 'Сумма кредита (₽)',
      placeholder: 'Введите сумму',
      min: 50000,
      max: 10000000,
      step: 10000,
    }),
  },
  loanTerm: {
    value: model.$.loanTerm,
    component: Input,
    componentProps: numberProps({
      label: 'Срок кредита (месяцев)',
      placeholder: 'Введите срок',
      min: 6,
      max: 240,
    }),
  },
  loanPurpose: {
    value: model.$.loanPurpose,
    component: Textarea,
    componentProps: {
      label: 'Цель кредита',
      placeholder: 'Опишите, на что планируете потратить средства',
      rows: 4,
      maxLength: 500,
    },
  },
  propertyValue: {
    value: model.$.propertyValue,
    component: Input,
    componentProps: numberProps({
      label: 'Стоимость недвижимости (₽)',
      placeholder: 'Введите стоимость',
      min: 1000000,
      step: 100000,
    }),
  },
  initialPayment: {
    value: model.$.initialPayment,
    component: Input,
    componentProps: numberProps({
      label: 'Первоначальный взнос (₽)',
      placeholder: 'Введите сумму',
      min: 0,
      step: 10000,
    }),
  },
  carBrand: {
    value: model.$.carBrand,
    component: Input,
    componentProps: { label: 'Марка автомобиля', placeholder: 'Например: Toyota' },
  },
  carModel: {
    value: model.$.carModel,
    component: Select,
    componentProps: { label: 'Модель автомобиля', placeholder: 'Например: Camry' },
  },
  carYear: {
    value: model.$.carYear,
    component: Input,
    componentProps: numberProps({ label: 'Год выпуска', placeholder: '2020' }),
  },
  carPrice: {
    value: model.$.carPrice,
    component: Input,
    componentProps: numberProps({
      label: 'Стоимость автомобиля (₽)',
      placeholder: 'Введите стоимость',
      min: 300000,
      step: 10000,
    }),
  },

  // ── Шаг 2: Персональные данные ──────────────────────────────────────────
  personalData: personalDataNodes(model.$.personalData),
  passportData: passportDataNodes(model.$.passportData),
  inn: {
    value: model.$.inn,
    component: InputMask,
    componentProps: { label: 'ИНН', placeholder: '123456789012', mask: '999999999999' },
  },
  snils: {
    value: model.$.snils,
    component: InputMask,
    componentProps: { label: 'СНИЛС', placeholder: '123-456-789 00', mask: '999-999-999 99' },
  },

  // ── Шаг 3: Контактная информация ────────────────────────────────────────
  phoneMain: {
    value: model.$.phoneMain,
    component: InputMask,
    componentProps: {
      label: 'Основной телефон',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
    },
  },
  phoneAdditional: {
    value: model.$.phoneAdditional,
    component: InputMask,
    componentProps: {
      label: 'Дополнительный телефон',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
    },
  },
  email: {
    value: model.$.email,
    component: Input,
    componentProps: { label: 'Email', placeholder: 'example@mail.com', type: 'email' },
  },
  emailAdditional: {
    value: model.$.emailAdditional,
    component: Input,
    componentProps: {
      label: 'Дополнительный email',
      placeholder: 'example@mail.com',
      type: 'email',
    },
  },
  registrationAddress: addressNodes(model.$.registrationAddress),
  sameAsRegistration: {
    value: model.$.sameAsRegistration,
    component: Checkbox,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
  },
  residenceAddress: addressNodes(model.$.residenceAddress),

  // ── Шаг 4: Информация о занятости ───────────────────────────────────────
  employmentStatus: {
    value: model.$.employmentStatus,
    component: RadioGroup,
    componentProps: { label: 'Статус занятости', options: EMPLOYMENT_STATUSES },
  },
  companyName: {
    value: model.$.companyName,
    component: Input,
    componentProps: { label: 'Название компании', placeholder: 'Введите название' },
  },
  companyInn: {
    value: model.$.companyInn,
    component: InputMask,
    componentProps: { label: 'ИНН компании', placeholder: '1234567890', mask: '9999999999' },
  },
  companyPhone: {
    value: model.$.companyPhone,
    component: InputMask,
    componentProps: {
      label: 'Телефон компании',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
    },
  },
  companyAddress: {
    value: model.$.companyAddress,
    component: Input,
    componentProps: { label: 'Адрес компании', placeholder: 'Полный адрес' },
  },
  position: {
    value: model.$.position,
    component: Input,
    componentProps: { label: 'Должность', placeholder: 'Ваша должность' },
  },
  workExperienceTotal: {
    value: model.$.workExperienceTotal,
    component: Input,
    componentProps: numberProps({ label: 'Общий стаж работы (месяцев)', placeholder: '0', min: 0 }),
  },
  workExperienceCurrent: {
    value: model.$.workExperienceCurrent,
    component: Input,
    componentProps: numberProps({
      label: 'Стаж на текущем месте (месяцев)',
      placeholder: '0',
      min: 0,
    }),
  },
  monthlyIncome: {
    value: model.$.monthlyIncome,
    component: Input,
    componentProps: numberProps({
      label: 'Ежемесячный доход (₽)',
      placeholder: '0',
      min: 10000,
      step: 1000,
    }),
  },
  additionalIncome: {
    value: model.$.additionalIncome,
    component: Input,
    componentProps: numberProps({
      label: 'Дополнительный доход (₽)',
      placeholder: '0',
      min: 0,
      step: 1000,
    }),
  },
  additionalIncomeSource: {
    value: model.$.additionalIncomeSource,
    component: Input,
    componentProps: { label: 'Источник дополнительного дохода', placeholder: 'Опишите источник' },
  },
  businessType: {
    value: model.$.businessType,
    component: Input,
    componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
  },
  businessInn: {
    value: model.$.businessInn,
    component: InputMask,
    componentProps: { label: 'ИНН ИП', placeholder: '123456789012', mask: '999999999999' },
  },
  businessActivity: {
    value: model.$.businessActivity,
    component: Textarea,
    componentProps: { label: 'Вид деятельности', placeholder: 'Опишите вид деятельности', rows: 3 },
  },

  // ── Шаг 5: Дополнительная информация ────────────────────────────────────
  maritalStatus: {
    value: model.$.maritalStatus,
    component: RadioGroup,
    componentProps: { label: 'Семейное положение', options: MARITAL_STATUSES },
  },
  dependents: {
    value: model.$.dependents,
    component: Input,
    componentProps: numberProps({
      label: 'Количество иждивенцев',
      placeholder: '0',
      min: 0,
      max: 10,
    }),
  },
  education: {
    value: model.$.education,
    component: Select,
    componentProps: {
      label: 'Образование',
      placeholder: 'Выберите уровень образования',
      options: EDUCATIONS,
    },
  },
  hasProperty: {
    value: model.$.hasProperty,
    component: Checkbox,
    componentProps: { label: 'У меня есть имущество' },
  },
  properties: { array: model.properties, item: propertyItem },
  hasExistingLoans: {
    value: model.$.hasExistingLoans,
    component: Checkbox,
    componentProps: { label: 'У меня есть другие кредиты' },
  },
  existingLoans: { array: model.existingLoans, item: existingLoanItem },
  hasCoBorrower: {
    value: model.$.hasCoBorrower,
    component: Checkbox,
    componentProps: { label: 'Добавить созаемщика' },
  },
  coBorrowers: { array: model.coBorrowers, item: coBorrowerItem },

  // ── Шаг 6: Согласия ─────────────────────────────────────────────────────
  agreePersonalData: {
    value: model.$.agreePersonalData,
    component: Checkbox,
    componentProps: { label: 'Согласие на обработку персональных данных' },
  },
  agreeCreditHistory: {
    value: model.$.agreeCreditHistory,
    component: Checkbox,
    componentProps: { label: 'Согласие на проверку кредитной истории' },
  },
  agreeMarketing: {
    value: model.$.agreeMarketing,
    component: Checkbox,
    componentProps: { label: 'Согласие на получение маркетинговых материалов' },
  },
  agreeTerms: {
    value: model.$.agreeTerms,
    component: Checkbox,
    componentProps: { label: 'Согласие с условиями кредитования' },
  },
  confirmAccuracy: {
    value: model.$.confirmAccuracy,
    component: Checkbox,
    componentProps: { label: 'Подтверждаю точность введенных данных' },
  },
  electronicSignature: {
    value: model.$.electronicSignature,
    component: InputMask,
    componentProps: { label: 'Код подтверждения из СМС', placeholder: '123456', mask: '999999' },
  },

  // ── Вычисляемые поля (значения пишет behavior через computeFrom) ────────
  interestRate: {
    value: model.$.interestRate,
    component: Input,
    componentProps: numberProps({ label: 'Процентная ставка (%)', readonly: true, disabled: true }),
  },
  monthlyPayment: {
    value: model.$.monthlyPayment,
    component: Input,
    componentProps: numberProps({
      label: 'Ежемесячный платеж (₽)',
      readonly: true,
      disabled: true,
    }),
  },
  fullName: {
    value: model.$.fullName,
    component: Input,
    componentProps: { label: 'Полное имя', readonly: true, disabled: true },
  },
  age: {
    value: model.$.age,
    component: Input,
    componentProps: numberProps({ label: 'Возраст (лет)', readonly: true, disabled: true }),
  },
  totalIncome: {
    value: model.$.totalIncome,
    component: Input,
    componentProps: numberProps({ label: 'Общий доход (₽)', readonly: true, disabled: true }),
  },
  paymentToIncomeRatio: {
    value: model.$.paymentToIncomeRatio,
    component: Input,
    componentProps: numberProps({
      label: 'Процент платежа от дохода (%)',
      readonly: true,
      disabled: true,
    }),
  },
  coBorrowersIncome: {
    value: model.$.coBorrowersIncome,
    component: Input,
    componentProps: numberProps({ label: 'Доход созаемщиков (₽)', readonly: true, disabled: true }),
  },
  sameEmail: {
    value: model.$.sameEmail,
    component: Checkbox,
    componentProps: { label: 'Дублировать email' },
  },
});
