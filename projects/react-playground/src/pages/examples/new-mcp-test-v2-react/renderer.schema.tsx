/**
 * Render-схема формы «Заявка на кредит» (renderer-react).
 *
 * Дерево несёт ТОЛЬКО разметку и привязку листьев к сигналам модели — никаких `validators`.
 * Конфиг валидации вкладывается инлайн в `componentProps` wizard-узла.
 *
 * Билдер вызывается фабрикой ДВАЖДЫ: без `form` (по этому дереву собираются ноды) и с `form`
 * (это дерево рендерится, из него wizard берёт форму). Поэтому `form` подмешивается условно.
 *
 * Файл — `.tsx`, потому что `renderStepBody` возвращает JSX.
 */

import type { FormModel, FormProxy } from '@reformer/core';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import {
  Box,
  Checkbox,
  Input,
  InputMask,
  RadioGroup,
  Section,
  Select,
  Textarea,
} from '@reformer/ui-kit';
import { FormArray } from '@reformer/ui-kit/form-array';
import { FormWizard } from '@reformer/ui-kit/form-wizard';

import {
  EDUCATION_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  GENDER_OPTIONS,
  LOAN_TYPE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from './data-sources';
import { createBlankCoBorrower, createBlankExistingLoan, createBlankProperty } from './model';
import { CAR_YEAR_MAX, CAR_YEAR_MIN, type CreditApplicationForm } from './types';
import { makeCreditValidationConfig } from './validation';

const PHONE_MASK = '+7 (999) 999-99-99';
const SECTION_PROPS = {
  titleAs: 'h3' as const,
  titleClassName: 'text-lg font-semibold',
  className: 'space-y-4',
};
const GRID_2 = 'grid grid-cols-1 md:grid-cols-2 gap-4';
const GRID_3 = 'grid grid-cols-1 md:grid-cols-3 gap-4';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Node = any;
type ItemModel = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Построить дерево разметки формы. */
export function buildCreditApplicationSchema(
  model: FormModel<CreditApplicationForm>,
  form?: FormProxy<CreditApplicationForm>
): RenderNode<CreditApplicationForm> {
  // ------------------------------------------------------------------------------------------
  // Шаг 1 — основная информация о кредите
  // ------------------------------------------------------------------------------------------
  const step1: Node = {
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: 'h2',
        componentProps: { className: 'text-xl font-bold' },
        children: ['Параметры кредита'],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Основное' },
        children: [
          {
            component: Box,
            componentProps: { className: GRID_3 },
            children: [
              {
                selector: 'loanType',
                value: model.$.loanType,
                component: Select,
                componentProps: {
                  label: 'Тип кредита',
                  placeholder: 'Выберите тип кредита',
                  options: LOAN_TYPE_OPTIONS,
                  testId: 'loanType',
                },
              },
              {
                selector: 'loanAmount',
                value: model.$.loanAmount,
                component: Input,
                componentProps: {
                  label: 'Сумма кредита (₽)',
                  type: 'number',
                  min: 50000,
                  max: 10000000,
                  step: 10000,
                  placeholder: 'Введите сумму',
                  testId: 'loanAmount',
                },
              },
              {
                selector: 'loanTerm',
                value: model.$.loanTerm,
                component: Input,
                componentProps: {
                  label: 'Срок кредита (месяцев)',
                  type: 'number',
                  min: 6,
                  max: 240,
                  placeholder: 'Введите срок',
                  testId: 'loanTerm',
                },
              },
            ],
          },
          {
            selector: 'loanPurpose',
            value: model.$.loanPurpose,
            component: Textarea,
            componentProps: {
              label: 'Цель кредита',
              rows: 4,
              maxLength: 500,
              placeholder: 'Опишите, на что планируете потратить средства',
              testId: 'loanPurpose',
            },
          },
        ],
      },
      {
        selector: 'mortgage-section',
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Ипотека' },
        children: [
          {
            component: Box,
            componentProps: { className: GRID_2 },
            children: [
              {
                selector: 'propertyValue',
                value: model.$.propertyValue,
                component: Input,
                componentProps: {
                  label: 'Стоимость недвижимости (₽)',
                  type: 'number',
                  min: 1000000,
                  step: 10000,
                  placeholder: 'Введите стоимость',
                  testId: 'propertyValue',
                },
              },
              {
                selector: 'initialPayment',
                value: model.$.initialPayment,
                component: Input,
                componentProps: {
                  label: 'Первоначальный взнос (₽) — 20 % от стоимости',
                  type: 'number',
                  testId: 'initialPayment',
                },
              },
            ],
          },
          {
            component: 'p',
            componentProps: { className: 'text-sm' },
            children: [
              'Для ипотеки потребуются документы на недвижимость: выписка из ЕГРН, отчёт об оценке и договор купли-продажи.',
            ],
          },
        ],
      },
      {
        selector: 'car-section',
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Автокредит' },
        children: [
          {
            component: Box,
            componentProps: { className: GRID_2 },
            children: [
              {
                selector: 'carBrand',
                value: model.$.carBrand,
                component: Input,
                componentProps: {
                  label: 'Марка автомобиля',
                  placeholder: 'Например: Toyota',
                  testId: 'carBrand',
                },
              },
              {
                selector: 'carModel',
                value: model.$.carModel,
                component: Select,
                componentProps: {
                  label: 'Модель автомобиля',
                  placeholder: 'Например: Camry',
                  options: [],
                  testId: 'carModel',
                },
              },
              {
                selector: 'carYear',
                value: model.$.carYear,
                component: Input,
                componentProps: {
                  label: 'Год выпуска',
                  type: 'number',
                  min: CAR_YEAR_MIN,
                  max: CAR_YEAR_MAX,
                  placeholder: '2020',
                  testId: 'carYear',
                },
              },
              {
                selector: 'carPrice',
                value: model.$.carPrice,
                component: Input,
                componentProps: {
                  label: 'Стоимость автомобиля (₽)',
                  type: 'number',
                  min: 300000,
                  max: 10000000,
                  step: 10000,
                  placeholder: 'Введите стоимость',
                  testId: 'carPrice',
                },
              },
            ],
          },
        ],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Предварительный расчёт' },
        children: [
          {
            component: Box,
            componentProps: { className: GRID_2 },
            children: [
              {
                selector: 'interestRate',
                value: model.$.interestRate,
                component: Input,
                componentProps: {
                  label: 'Процентная ставка (%)',
                  type: 'number',
                  testId: 'interestRate',
                },
              },
              {
                selector: 'monthlyPayment',
                value: model.$.monthlyPayment,
                component: Input,
                componentProps: {
                  label: 'Ежемесячный платёж (₽)',
                  type: 'number',
                  testId: 'monthlyPayment',
                },
              },
            ],
          },
          {
            component: 'p',
            componentProps: { className: 'text-sm' },
            children: [
              'При ставке ',
              model.$.interestRate,
              ' % платёж составит ',
              model.$.monthlyPayment,
              ' ₽ в месяц.',
            ],
          },
        ],
      },
    ],
  };

  // ------------------------------------------------------------------------------------------
  // Шаг 2 — персональные данные
  // ------------------------------------------------------------------------------------------
  const step2: Node = {
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: 'h2',
        componentProps: { className: 'text-xl font-bold' },
        children: ['Персональные данные'],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Личные данные' },
        children: [
          {
            component: Box,
            componentProps: { className: GRID_3 },
            children: [
              {
                selector: 'personalData-lastName',
                value: model.$.personalData.lastName,
                component: Input,
                componentProps: {
                  label: 'Фамилия',
                  placeholder: 'Введите фамилию',
                  testId: 'personalData-lastName',
                },
              },
              {
                selector: 'personalData-firstName',
                value: model.$.personalData.firstName,
                component: Input,
                componentProps: {
                  label: 'Имя',
                  placeholder: 'Введите имя',
                  testId: 'personalData-firstName',
                },
              },
              {
                selector: 'personalData-middleName',
                value: model.$.personalData.middleName,
                component: Input,
                componentProps: {
                  label: 'Отчество',
                  placeholder: 'Введите отчество',
                  testId: 'personalData-middleName',
                },
              },
            ],
          },
          {
            component: Box,
            componentProps: { className: GRID_3 },
            children: [
              {
                selector: 'personalData-birthDate',
                value: model.$.personalData.birthDate,
                component: Input,
                componentProps: {
                  label: 'Дата рождения',
                  type: 'date',
                  testId: 'personalData-birthDate',
                },
              },
              {
                selector: 'personalData-gender',
                value: model.$.personalData.gender,
                component: RadioGroup,
                componentProps: {
                  label: 'Пол',
                  options: GENDER_OPTIONS,
                  className: '!flex-row gap-6',
                  testId: 'personalData-gender',
                },
              },
              {
                selector: 'age',
                value: model.$.age,
                component: Input,
                componentProps: { label: 'Возраст (лет)', type: 'number', testId: 'age' },
              },
            ],
          },
          {
            selector: 'personalData-birthPlace',
            value: model.$.personalData.birthPlace,
            component: Input,
            componentProps: {
              label: 'Место рождения',
              placeholder: 'Введите место рождения',
              testId: 'personalData-birthPlace',
            },
          },
          {
            selector: 'fullName',
            value: model.$.fullName,
            component: Input,
            componentProps: { label: 'Полное имя', testId: 'fullName' },
          },
        ],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Паспортные данные' },
        children: [
          {
            component: Box,
            componentProps: { className: GRID_3 },
            children: [
              {
                selector: 'passportData-series',
                value: model.$.passportData.series,
                component: InputMask,
                componentProps: {
                  label: 'Серия паспорта',
                  mask: '99 99',
                  placeholder: '12 34',
                  testId: 'passportData-series',
                },
              },
              {
                selector: 'passportData-number',
                value: model.$.passportData.number,
                component: InputMask,
                componentProps: {
                  label: 'Номер паспорта',
                  mask: '999999',
                  placeholder: '123456',
                  testId: 'passportData-number',
                },
              },
              {
                selector: 'passportData-issueDate',
                value: model.$.passportData.issueDate,
                component: Input,
                componentProps: {
                  label: 'Дата выдачи',
                  type: 'date',
                  testId: 'passportData-issueDate',
                },
              },
            ],
          },
          {
            selector: 'passportData-issuedBy',
            value: model.$.passportData.issuedBy,
            component: Input,
            componentProps: {
              label: 'Кем выдан',
              placeholder: 'Введите название органа',
              testId: 'passportData-issuedBy',
            },
          },
          {
            selector: 'passportData-departmentCode',
            value: model.$.passportData.departmentCode,
            component: InputMask,
            componentProps: {
              label: 'Код подразделения',
              mask: '999-999',
              placeholder: '123-456',
              testId: 'passportData-departmentCode',
            },
          },
        ],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Документы' },
        children: [
          {
            component: Box,
            componentProps: { className: GRID_2 },
            children: [
              {
                selector: 'inn',
                value: model.$.inn,
                component: InputMask,
                componentProps: {
                  label: 'ИНН',
                  mask: '999999999999',
                  placeholder: '123456789012',
                  testId: 'inn',
                },
              },
              {
                selector: 'snils',
                value: model.$.snils,
                component: InputMask,
                componentProps: {
                  label: 'СНИЛС',
                  mask: '999-999-999 99',
                  placeholder: '123-456-789 00',
                  testId: 'snils',
                },
              },
            ],
          },
        ],
      },
    ],
  };

  // ------------------------------------------------------------------------------------------
  // Шаг 3 — контактная информация
  // ------------------------------------------------------------------------------------------
  const addressFields = (
    prefix: 'registrationAddress' | 'residenceAddress',
    signals: FormModel<CreditApplicationForm>['$']['registrationAddress']
  ): Node[] => [
    {
      component: Box,
      componentProps: { className: GRID_2 },
      children: [
        {
          selector: `${prefix}-region`,
          value: signals.region,
          component: Select,
          componentProps: {
            label: 'Регион',
            placeholder: 'Выберите регион',
            options: [],
            testId: `${prefix}-region`,
          },
        },
        {
          selector: `${prefix}-city`,
          value: signals.city,
          component: Select,
          componentProps: {
            label: 'Город',
            placeholder: 'Выберите город',
            options: [],
            testId: `${prefix}-city`,
          },
        },
      ],
    },
    {
      component: Box,
      componentProps: { className: GRID_3 },
      children: [
        {
          selector: `${prefix}-street`,
          value: signals.street,
          component: Input,
          componentProps: {
            label: 'Улица',
            placeholder: 'Введите улицу',
            testId: `${prefix}-street`,
          },
        },
        {
          selector: `${prefix}-house`,
          value: signals.house,
          component: Input,
          componentProps: { label: 'Дом', placeholder: '№', testId: `${prefix}-house` },
        },
        {
          selector: `${prefix}-apartment`,
          value: signals.apartment,
          component: Input,
          componentProps: { label: 'Квартира', placeholder: '№', testId: `${prefix}-apartment` },
        },
      ],
    },
    {
      selector: `${prefix}-postalCode`,
      value: signals.postalCode,
      component: InputMask,
      componentProps: {
        label: 'Индекс',
        mask: '999999',
        placeholder: '000000',
        testId: `${prefix}-postalCode`,
      },
    },
  ];

  const step3: Node = {
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: 'h2',
        componentProps: { className: 'text-xl font-bold' },
        children: ['Контактная информация'],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Телефоны' },
        children: [
          {
            component: Box,
            componentProps: { className: GRID_2 },
            children: [
              {
                selector: 'phoneMain',
                value: model.$.phoneMain,
                component: InputMask,
                componentProps: {
                  label: 'Основной телефон',
                  mask: PHONE_MASK,
                  testId: 'phoneMain',
                },
              },
              {
                selector: 'phoneAdditional',
                value: model.$.phoneAdditional,
                component: InputMask,
                componentProps: {
                  label: 'Дополнительный телефон',
                  mask: PHONE_MASK,
                  testId: 'phoneAdditional',
                },
              },
            ],
          },
        ],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Email' },
        children: [
          {
            component: Box,
            componentProps: { className: GRID_2 },
            children: [
              {
                selector: 'email',
                value: model.$.email,
                component: Input,
                componentProps: {
                  label: 'Email',
                  type: 'email',
                  placeholder: 'example@mail.com',
                  testId: 'email',
                },
              },
              {
                selector: 'emailAdditional',
                value: model.$.emailAdditional,
                component: Input,
                componentProps: {
                  label: 'Дополнительный email',
                  type: 'email',
                  placeholder: 'example@mail.com',
                  testId: 'emailAdditional',
                },
              },
            ],
          },
          {
            selector: 'sameEmail',
            value: model.$.sameEmail,
            component: Checkbox,
            componentProps: {
              label: 'Дополнительный email совпадает с основным',
              testId: 'sameEmail',
            },
          },
        ],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Адрес регистрации' },
        children: addressFields('registrationAddress', model.$.registrationAddress),
      },
      {
        selector: 'sameAsRegistration',
        value: model.$.sameAsRegistration,
        component: Checkbox,
        componentProps: {
          label: 'Адрес проживания совпадает с адресом регистрации',
          testId: 'sameAsRegistration',
        },
      },
      {
        selector: 'residence-section',
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Адрес проживания' },
        children: addressFields('residenceAddress', model.$.residenceAddress),
      },
    ],
  };

  // ------------------------------------------------------------------------------------------
  // Шаг 4 — занятость и доход
  // ------------------------------------------------------------------------------------------
  const step4: Node = {
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: 'h2',
        componentProps: { className: 'text-xl font-bold' },
        children: ['Занятость и доход'],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Статус занятости' },
        children: [
          {
            selector: 'employmentStatus',
            value: model.$.employmentStatus,
            component: RadioGroup,
            componentProps: {
              label: 'Статус занятости',
              options: EMPLOYMENT_STATUS_OPTIONS,
              testId: 'employmentStatus',
            },
          },
        ],
      },
      {
        selector: 'employed-section',
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Работа по найму' },
        children: [
          {
            component: Box,
            componentProps: { className: GRID_2 },
            children: [
              {
                selector: 'companyName',
                value: model.$.companyName,
                component: Input,
                componentProps: {
                  label: 'Название компании',
                  placeholder: 'Введите название',
                  testId: 'companyName',
                },
              },
              {
                selector: 'companyInn',
                value: model.$.companyInn,
                component: InputMask,
                componentProps: {
                  label: 'ИНН компании',
                  mask: '9999999999',
                  placeholder: '1234567890',
                  testId: 'companyInn',
                },
              },
              {
                selector: 'companyPhone',
                value: model.$.companyPhone,
                component: InputMask,
                componentProps: {
                  label: 'Телефон компании',
                  mask: PHONE_MASK,
                  testId: 'companyPhone',
                },
              },
              {
                selector: 'position',
                value: model.$.position,
                component: Input,
                componentProps: {
                  label: 'Должность',
                  placeholder: 'Ваша должность',
                  testId: 'position',
                },
              },
            ],
          },
          {
            selector: 'companyAddress',
            value: model.$.companyAddress,
            component: Input,
            componentProps: {
              label: 'Адрес компании',
              placeholder: 'Полный адрес',
              testId: 'companyAddress',
            },
          },
        ],
      },
      {
        selector: 'self-employed-section',
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'ИП / самозанятость' },
        children: [
          {
            component: Box,
            componentProps: { className: GRID_2 },
            children: [
              {
                selector: 'businessType',
                value: model.$.businessType,
                component: Input,
                componentProps: {
                  label: 'Тип бизнеса',
                  placeholder: 'ИП, ООО и т.д.',
                  testId: 'businessType',
                },
              },
              {
                selector: 'businessInn',
                value: model.$.businessInn,
                component: InputMask,
                componentProps: {
                  label: 'ИНН ИП',
                  mask: '999999999999',
                  placeholder: '123456789012',
                  testId: 'businessInn',
                },
              },
            ],
          },
          {
            selector: 'businessActivity',
            value: model.$.businessActivity,
            component: Textarea,
            componentProps: {
              label: 'Вид деятельности',
              rows: 3,
              placeholder: 'Опишите вид деятельности',
              testId: 'businessActivity',
            },
          },
          {
            component: 'p',
            componentProps: { className: 'text-sm' },
            children: [
              'Для ИП доход подтверждается декларацией 3-НДФЛ за последний период и выпиской по расчётному счёту.',
            ],
          },
        ],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Стаж' },
        children: [
          {
            component: Box,
            componentProps: { className: GRID_2 },
            children: [
              {
                selector: 'workExperienceTotal',
                value: model.$.workExperienceTotal,
                component: Input,
                componentProps: {
                  label: 'Общий стаж работы (месяцев)',
                  type: 'number',
                  min: 0,
                  placeholder: '0',
                  testId: 'workExperienceTotal',
                },
              },
              {
                selector: 'workExperienceCurrent',
                value: model.$.workExperienceCurrent,
                component: Input,
                componentProps: {
                  label: 'Стаж на текущем месте (месяцев)',
                  type: 'number',
                  min: 0,
                  placeholder: '0',
                  testId: 'workExperienceCurrent',
                },
              },
            ],
          },
        ],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Доход' },
        children: [
          {
            component: Box,
            componentProps: { className: GRID_3 },
            children: [
              {
                selector: 'monthlyIncome',
                value: model.$.monthlyIncome,
                component: Input,
                componentProps: {
                  label: 'Ежемесячный доход (₽)',
                  type: 'number',
                  min: 10000,
                  placeholder: '0',
                  testId: 'monthlyIncome',
                },
              },
              {
                selector: 'additionalIncome',
                value: model.$.additionalIncome,
                component: Input,
                componentProps: {
                  label: 'Дополнительный доход (₽)',
                  type: 'number',
                  min: 0,
                  placeholder: '0',
                  testId: 'additionalIncome',
                },
              },
              {
                selector: 'totalIncome',
                value: model.$.totalIncome,
                component: Input,
                componentProps: { label: 'Общий доход (₽)', type: 'number', testId: 'totalIncome' },
              },
            ],
          },
          {
            selector: 'additionalIncomeSource',
            value: model.$.additionalIncomeSource,
            component: Input,
            componentProps: {
              label: 'Источник дополнительного дохода',
              placeholder: 'Опишите источник',
              testId: 'additionalIncomeSource',
            },
          },
          {
            selector: 'paymentToIncomeRatio',
            value: model.$.paymentToIncomeRatio,
            component: Input,
            componentProps: {
              label: 'Процент платежа от дохода (%)',
              type: 'number',
              testId: 'paymentToIncomeRatio',
            },
          },
        ],
      },
    ],
  };

  // ------------------------------------------------------------------------------------------
  // Шаг 5 — дополнительная информация (массивы)
  // ------------------------------------------------------------------------------------------
  const step5: Node = {
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: 'h2',
        componentProps: { className: 'text-xl font-bold' },
        children: ['Дополнительная информация'],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Личное' },
        children: [
          {
            selector: 'maritalStatus',
            value: model.$.maritalStatus,
            component: RadioGroup,
            componentProps: {
              label: 'Семейное положение',
              options: MARITAL_STATUS_OPTIONS,
              testId: 'maritalStatus',
            },
          },
          {
            component: Box,
            componentProps: { className: GRID_2 },
            children: [
              {
                selector: 'dependents',
                value: model.$.dependents,
                component: Input,
                componentProps: {
                  label: 'Количество иждивенцев',
                  type: 'number',
                  min: 0,
                  max: 10,
                  placeholder: '0',
                  testId: 'dependents',
                },
              },
              {
                selector: 'education',
                value: model.$.education,
                component: Select,
                componentProps: {
                  label: 'Образование',
                  placeholder: 'Выберите уровень образования',
                  options: EDUCATION_OPTIONS,
                  testId: 'education',
                },
              },
            ],
          },
        ],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Имущество' },
        children: [
          {
            selector: 'hasProperty',
            value: model.$.hasProperty,
            component: Checkbox,
            componentProps: { label: 'У меня есть имущество', testId: 'hasProperty' },
          },
          {
            selector: 'properties-array',
            array: model.properties,
            component: FormArray,
            initialValue: createBlankProperty,
            componentProps: {
              title: 'Имущество',
              itemLabel: 'Объект',
              addButtonLabel: '+ Добавить имущество',
              removeButtonLabel: 'Удалить',
              emptyMessage: 'Нажмите «Добавить имущество»',
              reorderable: true,
            },
            item: (im: ItemModel) => ({
              component: Box,
              componentProps: { className: 'space-y-3' },
              children: [
                {
                  value: im.$.type,
                  component: Select,
                  componentProps: {
                    label: 'Тип имущества',
                    placeholder: 'Выберите тип',
                    options: PROPERTY_TYPE_OPTIONS,
                    testId: 'type',
                  },
                },
                {
                  value: im.$.description,
                  component: Textarea,
                  componentProps: {
                    label: 'Описание',
                    rows: 2,
                    placeholder: 'Опишите имущество',
                    testId: 'description',
                  },
                },
                {
                  value: im.$.estimatedValue,
                  component: Input,
                  componentProps: {
                    label: 'Оценочная стоимость (₽)',
                    type: 'number',
                    min: 0,
                    testId: 'estimatedValue',
                  },
                },
                {
                  value: im.$.hasEncumbrance,
                  component: Checkbox,
                  componentProps: {
                    label: 'Имеется обременение (залог)',
                    testId: 'hasEncumbrance',
                  },
                },
              ],
            }),
          },
        ],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Существующие кредиты' },
        children: [
          {
            selector: 'hasExistingLoans',
            value: model.$.hasExistingLoans,
            component: Checkbox,
            componentProps: { label: 'У меня есть другие кредиты', testId: 'hasExistingLoans' },
          },
          {
            selector: 'loans-hint',
            component: 'p',
            componentProps: { className: 'text-sm' },
            children: [
              'Действующие кредиты учитываются при расчёте долговой нагрузки и могут повлиять на решение банка.',
            ],
          },
          {
            selector: 'loans-array',
            array: model.existingLoans,
            component: FormArray,
            initialValue: createBlankExistingLoan,
            componentProps: {
              title: 'Кредиты',
              itemLabel: 'Кредит',
              addButtonLabel: '+ Добавить кредит',
              removeButtonLabel: 'Удалить',
              emptyMessage: 'Нажмите «Добавить кредит»',
            },
            item: (im: ItemModel) => ({
              component: Box,
              componentProps: { className: 'space-y-3' },
              children: [
                {
                  component: Box,
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      value: im.$.bank,
                      component: Input,
                      componentProps: {
                        label: 'Банк',
                        placeholder: 'Название банка',
                        testId: 'bank',
                      },
                    },
                    {
                      value: im.$.type,
                      component: Input,
                      componentProps: {
                        label: 'Тип кредита',
                        placeholder: 'Тип кредита',
                        testId: 'type',
                      },
                    },
                  ],
                },
                {
                  component: Box,
                  componentProps: { className: GRID_3 },
                  children: [
                    {
                      value: im.$.amount,
                      component: Input,
                      componentProps: {
                        label: 'Сумма кредита (₽)',
                        type: 'number',
                        min: 0,
                        testId: 'amount',
                      },
                    },
                    {
                      value: im.$.remainingAmount,
                      component: Input,
                      componentProps: {
                        label: 'Остаток задолженности (₽)',
                        type: 'number',
                        min: 0,
                        testId: 'remainingAmount',
                      },
                    },
                    {
                      value: im.$.monthlyPayment,
                      component: Input,
                      componentProps: {
                        label: 'Ежемесячный платёж (₽)',
                        type: 'number',
                        min: 0,
                        testId: 'monthlyPayment',
                      },
                    },
                  ],
                },
                {
                  value: im.$.maturityDate,
                  component: Input,
                  componentProps: {
                    label: 'Дата погашения',
                    type: 'date',
                    testId: 'maturityDate',
                  },
                },
              ],
            }),
          },
        ],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Созаёмщики' },
        children: [
          {
            selector: 'hasCoBorrower',
            value: model.$.hasCoBorrower,
            component: Checkbox,
            componentProps: { label: 'Добавить созаёмщика', testId: 'hasCoBorrower' },
          },
          {
            selector: 'coborrowers-array',
            array: model.coBorrowers,
            component: FormArray,
            initialValue: createBlankCoBorrower,
            componentProps: {
              title: 'Созаёмщики',
              itemLabel: 'Созаёмщик',
              addButtonLabel: '+ Добавить созаёмщика',
              removeButtonLabel: 'Удалить',
              emptyMessage: 'Нажмите «Добавить созаёмщика»',
              reorderable: true,
            },
            item: (im: ItemModel) => ({
              component: Box,
              componentProps: { className: 'space-y-3' },
              children: [
                {
                  component: Box,
                  componentProps: { className: GRID_3 },
                  children: [
                    {
                      value: im.$.personalData.lastName,
                      component: Input,
                      componentProps: {
                        label: 'Фамилия',
                        placeholder: 'Введите фамилию',
                        testId: 'personalData-lastName',
                      },
                    },
                    {
                      value: im.$.personalData.firstName,
                      component: Input,
                      componentProps: {
                        label: 'Имя',
                        placeholder: 'Введите имя',
                        testId: 'personalData-firstName',
                      },
                    },
                    {
                      value: im.$.personalData.middleName,
                      component: Input,
                      componentProps: {
                        label: 'Отчество',
                        placeholder: 'Введите отчество',
                        testId: 'personalData-middleName',
                      },
                    },
                  ],
                },
                {
                  component: Box,
                  componentProps: { className: GRID_3 },
                  children: [
                    {
                      value: im.$.personalData.birthDate,
                      component: Input,
                      componentProps: {
                        label: 'Дата рождения',
                        type: 'date',
                        testId: 'personalData-birthDate',
                      },
                    },
                    {
                      value: im.$.personalData.gender,
                      component: RadioGroup,
                      componentProps: {
                        label: 'Пол',
                        options: GENDER_OPTIONS,
                        className: '!flex-row gap-6',
                        testId: 'personalData-gender',
                      },
                    },
                    {
                      value: im.$.personalData.birthPlace,
                      component: Input,
                      componentProps: {
                        label: 'Место рождения',
                        placeholder: 'Введите место рождения',
                        testId: 'personalData-birthPlace',
                      },
                    },
                  ],
                },
                {
                  component: Box,
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      value: im.$.phone,
                      component: InputMask,
                      componentProps: { label: 'Телефон', mask: PHONE_MASK, testId: 'phone' },
                    },
                    {
                      value: im.$.email,
                      component: Input,
                      componentProps: {
                        label: 'Email',
                        type: 'email',
                        placeholder: 'example@mail.com',
                        testId: 'email',
                      },
                    },
                  ],
                },
                {
                  component: Box,
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      value: im.$.relationship,
                      component: Input,
                      componentProps: {
                        label: 'Родство',
                        placeholder: 'Укажите родство',
                        testId: 'relationship',
                      },
                    },
                    {
                      value: im.$.monthlyIncome,
                      component: Input,
                      componentProps: {
                        label: 'Ежемесячный доход (₽)',
                        type: 'number',
                        min: 0,
                        testId: 'monthlyIncome',
                      },
                    },
                  ],
                },
              ],
            }),
          },
          {
            selector: 'coBorrowersIncome',
            value: model.$.coBorrowersIncome,
            component: Input,
            componentProps: {
              label: 'Доход созаёмщиков (₽)',
              type: 'number',
              testId: 'coBorrowersIncome',
            },
          },
        ],
      },
    ],
  };

  // ------------------------------------------------------------------------------------------
  // Шаг 6 — согласия и подтверждение
  // ------------------------------------------------------------------------------------------
  const step6: Node = {
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: 'h2',
        componentProps: { className: 'text-xl font-bold' },
        children: ['Подтверждение и согласия'],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Проверьте данные' },
        children: [
          {
            component: 'dl',
            componentProps: { className: 'grid grid-cols-2 gap-2 text-sm' },
            children: [
              { component: 'dt', children: ['Заявитель'] },
              { component: 'dd', children: [model.$.fullName] },
              { component: 'dt', children: ['Сумма кредита'] },
              { component: 'dd', children: [model.$.loanAmount, ' ₽'] },
              { component: 'dt', children: ['Срок'] },
              { component: 'dd', children: [model.$.loanTerm, ' мес.'] },
              { component: 'dt', children: ['Ставка'] },
              { component: 'dd', children: [model.$.interestRate, ' %'] },
              { component: 'dt', children: ['Ежемесячный платёж'] },
              { component: 'dd', children: [model.$.monthlyPayment, ' ₽'] },
              { component: 'dt', children: ['Долговая нагрузка'] },
              { component: 'dd', children: [model.$.paymentToIncomeRatio, ' %'] },
            ],
          },
        ],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Согласия' },
        children: [
          {
            selector: 'agreePersonalData',
            value: model.$.agreePersonalData,
            component: Checkbox,
            componentProps: {
              label: 'Согласие на обработку персональных данных',
              testId: 'agreePersonalData',
            },
          },
          {
            selector: 'agreeCreditHistory',
            value: model.$.agreeCreditHistory,
            component: Checkbox,
            componentProps: {
              label: 'Согласие на проверку кредитной истории',
              testId: 'agreeCreditHistory',
            },
          },
          {
            selector: 'agreeMarketing',
            value: model.$.agreeMarketing,
            component: Checkbox,
            componentProps: {
              label: 'Согласие на получение маркетинговых материалов',
              testId: 'agreeMarketing',
            },
          },
          {
            selector: 'agreeTerms',
            value: model.$.agreeTerms,
            component: Checkbox,
            componentProps: {
              label: 'Согласие с условиями кредитования',
              testId: 'agreeTerms',
            },
          },
        ],
      },
      {
        component: Section,
        componentProps: { ...SECTION_PROPS, title: 'Подтверждение' },
        children: [
          {
            selector: 'confirmAccuracy',
            value: model.$.confirmAccuracy,
            component: Checkbox,
            componentProps: {
              label: 'Подтверждаю точность введённых данных',
              testId: 'confirmAccuracy',
            },
          },
          {
            selector: 'electronicSignature',
            value: model.$.electronicSignature,
            component: InputMask,
            componentProps: {
              label: 'Код подтверждения из СМС',
              mask: '999999',
              placeholder: '123456',
              testId: 'electronicSignature',
            },
          },
        ],
      },
    ],
  };

  const wizard: Node = {
    selector: 'wizard',
    component: FormWizard,
    componentProps: {
      // `form` нужен только рендеру: при первом (harvest) вызове билдера его нет.
      ...(form ? { form } : {}),
      config: makeCreditValidationConfig(model),
      // ui-kit не зависит от рендерера, поэтому стратегию отрисовки RenderNode-тела
      // шага приложение подаёт само.
      renderStepBody: (
        body: RenderNode<CreditApplicationForm>,
        wizardForm: FormProxy<CreditApplicationForm>
      ) => <RenderNodeComponent node={body} form={wizardForm} />,
      steps: [
        { number: 1, title: 'Кредит', icon: '💰', body: step1 },
        { number: 2, title: 'Личные данные', icon: '👤', body: step2 },
        { number: 3, title: 'Контакты', icon: '📞', body: step3 },
        { number: 4, title: 'Работа', icon: '💼', body: step4 },
        { number: 5, title: 'Дополнительно', icon: '📋', body: step5 },
        { number: 6, title: 'Подтверждение', icon: '✓', body: step6 },
      ],
    },
  };

  // Каст в конце билдера — канон для схем с array-узлами: `ModelArray<U>` рантайм-совместим
  // с `RenderModelArrayControl`, но не объявляет `__path` в публичном типе.
  return wizard as unknown as RenderNode<CreditApplicationForm>;
}
