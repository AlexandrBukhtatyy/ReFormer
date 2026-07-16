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

import {
  SelectField,
  CheckboxField,
  InputField,
  InputMaskField,
  RadioGroupField,
  TextareaField,
} from '@reformer/ui-kit';
import type { FormModel } from '@reformer/core';
import {
  LOAN_TYPES,
  EMPLOYMENT_STATUSES,
  MARITAL_STATUSES,
  EDUCATIONS,
  GENDERS,
  RELATIONSHIPS,
  EXISTING_LOAN_TYPES,
} from '../constants/credit-application';
import type { CreditApplicationForm } from '../types/credit-application';
import type { PersonalData } from '../components/nested-forms/PersonalData/types';
import type { PassportData } from '../components/nested-forms/PassportData/types';
import type { Address } from '../components/nested-forms/Address/types';
import type { Property } from '../components/nested-forms/Property/types';
import type { ExistingLoan } from '../components/nested-forms/ExistingLoan/types';
import type { CoBorrower } from '../components/nested-forms/CoBorrower/types';

// ============================================================================
// Под-схемы вложенных групп (получают сигналы под-модели через model.$.<group>)
// ============================================================================

const personalDataNodes = (m: FormModel<PersonalData>) => ({
  lastName: {
    value: m.$.lastName,
    component: InputField,
    componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
  },
  firstName: {
    value: m.$.firstName,
    component: InputField,
    componentProps: { label: 'Имя', placeholder: 'Введите имя' },
  },
  middleName: {
    value: m.$.middleName,
    component: InputField,
    componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
  },
  birthDate: {
    value: m.$.birthDate,
    component: InputField,
    componentProps: { label: 'Дата рождения', type: 'date' },
  },
  gender: {
    value: m.$.gender,
    component: RadioGroupField,
    componentProps: { label: 'Пол', options: GENDERS },
  },
  birthPlace: {
    value: m.$.birthPlace,
    component: InputField,
    componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
  },
});

const passportDataNodes = (m: FormModel<PassportData>) => ({
  series: {
    value: m.$.series,
    component: InputMaskField,
    componentProps: { label: 'Серия паспорта', placeholder: '00 00', mask: '99 99' },
  },
  number: {
    value: m.$.number,
    component: InputMaskField,
    componentProps: { label: 'Номер паспорта', placeholder: '000000', mask: '999999' },
  },
  issueDate: {
    value: m.$.issueDate,
    component: InputField,
    componentProps: { label: 'Дата выдачи', type: 'date' },
  },
  issuedBy: {
    value: m.$.issuedBy,
    component: TextareaField,
    componentProps: { label: 'Кем выдан', placeholder: 'Введите наименование органа', rows: 3 },
  },
  departmentCode: {
    value: m.$.departmentCode,
    component: InputMaskField,
    componentProps: { label: 'Код подразделения', placeholder: '000-000', mask: '999-999' },
  },
});

const addressNodes = (m: FormModel<Address>) => ({
  region: {
    value: m.$.region,
    component: InputField,
    componentProps: { label: 'Регион', placeholder: 'Введите регион' },
  },
  city: {
    value: m.$.city,
    component: InputField,
    componentProps: { label: 'Город', placeholder: 'Введите город' },
  },
  street: {
    value: m.$.street,
    component: InputField,
    componentProps: { label: 'Улица', placeholder: 'Введите улицу' },
  },
  house: {
    value: m.$.house,
    component: InputField,
    componentProps: { label: 'Дом', placeholder: '№' },
  },
  apartment: {
    value: m.$.apartment,
    component: InputField,
    componentProps: { label: 'Квартира', placeholder: '№' },
  },
  postalCode: {
    value: m.$.postalCode,
    component: InputMaskField,
    componentProps: { label: 'Индекс', placeholder: '000000', mask: '999999' },
  },
});

// ============================================================================
// Под-схемы элементов массивов (получают под-модель элемента)
// ============================================================================

const propertyItem = (item: FormModel<Property>) => ({
  type: {
    value: item.$.type,
    component: SelectField,
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
    component: TextareaField,
    componentProps: { label: 'Описание', placeholder: 'Опишите имущество', rows: 2 },
  },
  estimatedValue: {
    value: item.$.estimatedValue,
    component: InputField,
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
    component: CheckboxField,
    componentProps: { label: 'Имеется обременение (залог)' },
  },
});

const existingLoanItem = (item: FormModel<ExistingLoan>) => ({
  bank: {
    value: item.$.bank,
    component: InputField,
    componentProps: { label: 'Банк', placeholder: 'Название банка' },
  },
  type: {
    value: item.$.type,
    component: SelectField,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип',
      options: EXISTING_LOAN_TYPES,
    },
  },
  amount: {
    value: item.$.amount,
    component: InputField,
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
    component: InputField,
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
    component: InputField,
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
    component: InputField,
    componentProps: { label: 'Дата погашения', type: 'date' },
  },
});

const coBorrowerItem = (item: FormModel<CoBorrower>) => ({
  personalData: {
    lastName: {
      value: item.$.personalData.lastName,
      component: InputField,
      componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
    },
    firstName: {
      value: item.$.personalData.firstName,
      component: InputField,
      componentProps: { label: 'Имя', placeholder: 'Введите имя' },
    },
    middleName: {
      value: item.$.personalData.middleName,
      component: InputField,
      componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
    },
    birthDate: {
      value: item.$.personalData.birthDate,
      component: InputField,
      componentProps: { label: 'Дата рождения', type: 'date' },
    },
  },
  phone: {
    value: item.$.phone,
    component: InputMaskField,
    componentProps: {
      label: 'Телефон',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
    },
  },
  email: {
    value: item.$.email,
    component: InputField,
    componentProps: { label: 'Email', placeholder: 'example@mail.com', type: 'email' },
  },
  relationship: {
    value: item.$.relationship,
    component: SelectField,
    componentProps: {
      label: 'Отношение к заемщику',
      placeholder: 'Выберите отношение',
      options: RELATIONSHIPS,
    },
  },
  monthlyIncome: {
    value: item.$.monthlyIncome,
    component: InputField,
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
    component: SelectField,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: LOAN_TYPES,
    },
  },
  loanAmount: {
    value: model.$.loanAmount,
    component: InputField,
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
    component: InputField,
    componentProps: numberProps({
      label: 'Срок кредита (месяцев)',
      placeholder: 'Введите срок',
      min: 6,
      max: 240,
    }),
  },
  loanPurpose: {
    value: model.$.loanPurpose,
    component: TextareaField,
    componentProps: {
      label: 'Цель кредита',
      placeholder: 'Опишите, на что планируете потратить средства',
      rows: 4,
      maxLength: 500,
    },
  },
  propertyValue: {
    value: model.$.propertyValue,
    component: InputField,
    componentProps: numberProps({
      label: 'Стоимость недвижимости (₽)',
      placeholder: 'Введите стоимость',
      min: 1000000,
      step: 100000,
    }),
  },
  initialPayment: {
    value: model.$.initialPayment,
    component: InputField,
    componentProps: numberProps({
      label: 'Первоначальный взнос (₽)',
      placeholder: 'Введите сумму',
      min: 0,
      step: 10000,
    }),
  },
  carBrand: {
    value: model.$.carBrand,
    component: InputField,
    componentProps: { label: 'Марка автомобиля', placeholder: 'Например: Toyota' },
  },
  carModel: {
    value: model.$.carModel,
    component: SelectField,
    componentProps: { label: 'Модель автомобиля', placeholder: 'Например: Camry' },
  },
  carYear: {
    value: model.$.carYear,
    component: InputField,
    componentProps: numberProps({ label: 'Год выпуска', placeholder: '2020' }),
  },
  carPrice: {
    value: model.$.carPrice,
    component: InputField,
    componentProps: numberProps({
      label: 'Стоимость автомобиля (₽)',
      placeholder: 'Введите стоимость',
      min: 300000,
      step: 10000,
    }),
  },

  // ── Шаг 2: Персональные данные ──────────────────────────────────────────
  personalData: personalDataNodes(model.personalData),
  passportData: passportDataNodes(model.passportData),
  inn: {
    value: model.$.inn,
    component: InputMaskField,
    componentProps: { label: 'ИНН', placeholder: '123456789012', mask: '999999999999' },
  },
  snils: {
    value: model.$.snils,
    component: InputMaskField,
    componentProps: { label: 'СНИЛС', placeholder: '123-456-789 00', mask: '999-999-999 99' },
  },

  // ── Шаг 3: Контактная информация ────────────────────────────────────────
  phoneMain: {
    value: model.$.phoneMain,
    component: InputMaskField,
    componentProps: {
      label: 'Основной телефон',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
    },
  },
  phoneAdditional: {
    value: model.$.phoneAdditional,
    component: InputMaskField,
    componentProps: {
      label: 'Дополнительный телефон',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
    },
  },
  email: {
    value: model.$.email,
    component: InputField,
    componentProps: { label: 'Email', placeholder: 'example@mail.com', type: 'email' },
  },
  emailAdditional: {
    value: model.$.emailAdditional,
    component: InputField,
    componentProps: {
      label: 'Дополнительный email',
      placeholder: 'example@mail.com',
      type: 'email',
    },
  },
  registrationAddress: addressNodes(model.registrationAddress),
  sameAsRegistration: {
    value: model.$.sameAsRegistration,
    component: CheckboxField,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
  },
  residenceAddress: addressNodes(model.residenceAddress),

  // ── Шаг 4: Информация о занятости ───────────────────────────────────────
  employmentStatus: {
    value: model.$.employmentStatus,
    component: RadioGroupField,
    componentProps: { label: 'Статус занятости', options: EMPLOYMENT_STATUSES },
  },
  companyName: {
    value: model.$.companyName,
    component: InputField,
    componentProps: { label: 'Название компании', placeholder: 'Введите название' },
  },
  companyInn: {
    value: model.$.companyInn,
    component: InputMaskField,
    componentProps: { label: 'ИНН компании', placeholder: '1234567890', mask: '9999999999' },
  },
  companyPhone: {
    value: model.$.companyPhone,
    component: InputMaskField,
    componentProps: {
      label: 'Телефон компании',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
    },
  },
  companyAddress: {
    value: model.$.companyAddress,
    component: InputField,
    componentProps: { label: 'Адрес компании', placeholder: 'Полный адрес' },
  },
  position: {
    value: model.$.position,
    component: InputField,
    componentProps: { label: 'Должность', placeholder: 'Ваша должность' },
  },
  workExperienceTotal: {
    value: model.$.workExperienceTotal,
    component: InputField,
    componentProps: numberProps({ label: 'Общий стаж работы (месяцев)', placeholder: '0', min: 0 }),
  },
  workExperienceCurrent: {
    value: model.$.workExperienceCurrent,
    component: InputField,
    componentProps: numberProps({
      label: 'Стаж на текущем месте (месяцев)',
      placeholder: '0',
      min: 0,
    }),
  },
  monthlyIncome: {
    value: model.$.monthlyIncome,
    component: InputField,
    componentProps: numberProps({
      label: 'Ежемесячный доход (₽)',
      placeholder: '0',
      min: 10000,
      step: 1000,
    }),
  },
  additionalIncome: {
    value: model.$.additionalIncome,
    component: InputField,
    componentProps: numberProps({
      label: 'Дополнительный доход (₽)',
      placeholder: '0',
      min: 0,
      step: 1000,
    }),
  },
  additionalIncomeSource: {
    value: model.$.additionalIncomeSource,
    component: InputField,
    componentProps: { label: 'Источник дополнительного дохода', placeholder: 'Опишите источник' },
  },
  businessType: {
    value: model.$.businessType,
    component: InputField,
    componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
  },
  businessInn: {
    value: model.$.businessInn,
    component: InputMaskField,
    componentProps: { label: 'ИНН ИП', placeholder: '123456789012', mask: '999999999999' },
  },
  businessActivity: {
    value: model.$.businessActivity,
    component: TextareaField,
    componentProps: { label: 'Вид деятельности', placeholder: 'Опишите вид деятельности', rows: 3 },
  },

  // ── Шаг 5: Дополнительная информация ────────────────────────────────────
  maritalStatus: {
    value: model.$.maritalStatus,
    component: RadioGroupField,
    componentProps: { label: 'Семейное положение', options: MARITAL_STATUSES },
  },
  dependents: {
    value: model.$.dependents,
    component: InputField,
    componentProps: numberProps({
      label: 'Количество иждивенцев',
      placeholder: '0',
      min: 0,
      max: 10,
    }),
  },
  education: {
    value: model.$.education,
    component: SelectField,
    componentProps: {
      label: 'Образование',
      placeholder: 'Выберите уровень образования',
      options: EDUCATIONS,
    },
  },
  hasProperty: {
    value: model.$.hasProperty,
    component: CheckboxField,
    componentProps: { label: 'У меня есть имущество' },
  },
  properties: { array: model.properties, item: propertyItem },
  hasExistingLoans: {
    value: model.$.hasExistingLoans,
    component: CheckboxField,
    componentProps: { label: 'У меня есть другие кредиты' },
  },
  existingLoans: { array: model.existingLoans, item: existingLoanItem },
  hasCoBorrower: {
    value: model.$.hasCoBorrower,
    component: CheckboxField,
    componentProps: { label: 'Добавить созаемщика' },
  },
  coBorrowers: { array: model.coBorrowers, item: coBorrowerItem },

  // ── Шаг 6: Согласия ─────────────────────────────────────────────────────
  agreePersonalData: {
    value: model.$.agreePersonalData,
    component: CheckboxField,
    componentProps: { label: 'Согласие на обработку персональных данных' },
  },
  agreeCreditHistory: {
    value: model.$.agreeCreditHistory,
    component: CheckboxField,
    componentProps: { label: 'Согласие на проверку кредитной истории' },
  },
  agreeMarketing: {
    value: model.$.agreeMarketing,
    component: CheckboxField,
    componentProps: { label: 'Согласие на получение маркетинговых материалов' },
  },
  agreeTerms: {
    value: model.$.agreeTerms,
    component: CheckboxField,
    componentProps: { label: 'Согласие с условиями кредитования' },
  },
  confirmAccuracy: {
    value: model.$.confirmAccuracy,
    component: CheckboxField,
    componentProps: { label: 'Подтверждаю точность введенных данных' },
  },
  electronicSignature: {
    value: model.$.electronicSignature,
    component: InputMaskField,
    componentProps: { label: 'Код подтверждения из СМС', placeholder: '123456', mask: '999999' },
  },

  // ── Вычисляемые поля (значения пишет behavior через computeFrom) ────────
  interestRate: {
    value: model.$.interestRate,
    component: InputField,
    componentProps: numberProps({ label: 'Процентная ставка (%)', readonly: true, disabled: true }),
  },
  monthlyPayment: {
    value: model.$.monthlyPayment,
    component: InputField,
    componentProps: numberProps({
      label: 'Ежемесячный платеж (₽)',
      readonly: true,
      disabled: true,
    }),
  },
  fullName: {
    value: model.$.fullName,
    component: InputField,
    componentProps: { label: 'Полное имя', readonly: true, disabled: true },
  },
  age: {
    value: model.$.age,
    component: InputField,
    componentProps: numberProps({ label: 'Возраст (лет)', readonly: true, disabled: true }),
  },
  totalIncome: {
    value: model.$.totalIncome,
    component: InputField,
    componentProps: numberProps({ label: 'Общий доход (₽)', readonly: true, disabled: true }),
  },
  paymentToIncomeRatio: {
    value: model.$.paymentToIncomeRatio,
    component: InputField,
    componentProps: numberProps({
      label: 'Процент платежа от дохода (%)',
      readonly: true,
      disabled: true,
    }),
  },
  coBorrowersIncome: {
    value: model.$.coBorrowersIncome,
    component: InputField,
    componentProps: numberProps({ label: 'Доход созаемщиков (₽)', readonly: true, disabled: true }),
  },
  sameEmail: {
    value: model.$.sameEmail,
    component: CheckboxField,
    componentProps: { label: 'Дублировать email' },
  },
});
