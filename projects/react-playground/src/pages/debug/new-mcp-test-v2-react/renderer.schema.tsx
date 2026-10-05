/**
 * Схема формы «Заявка на кредит» (renderer-react) — одно дерево узлов.
 *
 * Дерево несёт ТОЛЬКО разметку и привязку узлов к модели (`model: model.$.x`) — никаких
 * `validators`: правила живут в `validation.ts`.
 *
 * Корень — библиотечный `FormWizard`, шаги — его дети (`Step`). `selector` шага — ключ его правил
 * в `creditApplicationValidation.steps`. Форму и валидацию визард берёт из сборки `createForm` сам.
 * Билдер вызывается сборкой один раз; условные секции несут `selector` — их прячет поведение.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import {
  Box,
  Checkbox,
  Input,
  InputMask,
  RadioGroup,
  Section,
  Select,
  Textarea,
  FormWizard,
  FormArray,
} from '@reformer/ui-kit';

import {
  EDUCATION_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  GENDER_OPTIONS,
  LOAN_TYPE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from './data-sources';
import { CAR_YEAR_MAX, CAR_YEAR_MIN, type CreditApplicationForm } from './types';

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

/** Построить дерево схемы формы. */
export function buildCreditApplicationSchema(
  model: FormModel<CreditApplicationForm>
): FormSchemaNode {
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
                model: model.$.loanType,
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
                model: model.$.loanAmount,
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
                model: model.$.loanTerm,
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
            model: model.$.loanPurpose,
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
                model: model.$.propertyValue,
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
                model: model.$.initialPayment,
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
                model: model.$.carBrand,
                component: Input,
                componentProps: {
                  label: 'Марка автомобиля',
                  placeholder: 'Например: Toyota',
                  testId: 'carBrand',
                },
              },
              {
                selector: 'carModel',
                model: model.$.carModel,
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
                model: model.$.carYear,
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
                model: model.$.carPrice,
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
                model: model.$.interestRate,
                component: Input,
                componentProps: {
                  label: 'Процентная ставка (%)',
                  type: 'number',
                  testId: 'interestRate',
                },
              },
              {
                selector: 'monthlyPayment',
                model: model.$.monthlyPayment,
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
                model: model.$.personalData.lastName,
                component: Input,
                componentProps: {
                  label: 'Фамилия',
                  placeholder: 'Введите фамилию',
                  testId: 'personalData-lastName',
                },
              },
              {
                selector: 'personalData-firstName',
                model: model.$.personalData.firstName,
                component: Input,
                componentProps: {
                  label: 'Имя',
                  placeholder: 'Введите имя',
                  testId: 'personalData-firstName',
                },
              },
              {
                selector: 'personalData-middleName',
                model: model.$.personalData.middleName,
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
                model: model.$.personalData.birthDate,
                component: Input,
                componentProps: {
                  label: 'Дата рождения',
                  type: 'date',
                  testId: 'personalData-birthDate',
                },
              },
              {
                selector: 'personalData-gender',
                model: model.$.personalData.gender,
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
                model: model.$.age,
                component: Input,
                componentProps: { label: 'Возраст (лет)', type: 'number', testId: 'age' },
              },
            ],
          },
          {
            selector: 'personalData-birthPlace',
            model: model.$.personalData.birthPlace,
            component: Input,
            componentProps: {
              label: 'Место рождения',
              placeholder: 'Введите место рождения',
              testId: 'personalData-birthPlace',
            },
          },
          {
            selector: 'fullName',
            model: model.$.fullName,
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
                model: model.$.passportData.series,
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
                model: model.$.passportData.number,
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
                model: model.$.passportData.issueDate,
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
            model: model.$.passportData.issuedBy,
            component: Input,
            componentProps: {
              label: 'Кем выдан',
              placeholder: 'Введите название органа',
              testId: 'passportData-issuedBy',
            },
          },
          {
            selector: 'passportData-departmentCode',
            model: model.$.passportData.departmentCode,
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
                model: model.$.inn,
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
                model: model.$.snils,
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
                model: model.$.phoneMain,
                component: InputMask,
                componentProps: {
                  label: 'Основной телефон',
                  mask: PHONE_MASK,
                  testId: 'phoneMain',
                },
              },
              {
                selector: 'phoneAdditional',
                model: model.$.phoneAdditional,
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
                model: model.$.email,
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
                model: model.$.emailAdditional,
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
            model: model.$.sameEmail,
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
        model: model.$.sameAsRegistration,
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
            model: model.$.employmentStatus,
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
                model: model.$.companyName,
                component: Input,
                componentProps: {
                  label: 'Название компании',
                  placeholder: 'Введите название',
                  testId: 'companyName',
                },
              },
              {
                selector: 'companyInn',
                model: model.$.companyInn,
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
                model: model.$.companyPhone,
                component: InputMask,
                componentProps: {
                  label: 'Телефон компании',
                  mask: PHONE_MASK,
                  testId: 'companyPhone',
                },
              },
              {
                selector: 'position',
                model: model.$.position,
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
            model: model.$.companyAddress,
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
                model: model.$.businessType,
                component: Input,
                componentProps: {
                  label: 'Тип бизнеса',
                  placeholder: 'ИП, ООО и т.д.',
                  testId: 'businessType',
                },
              },
              {
                selector: 'businessInn',
                model: model.$.businessInn,
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
            model: model.$.businessActivity,
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
                model: model.$.workExperienceTotal,
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
                model: model.$.workExperienceCurrent,
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
                model: model.$.monthlyIncome,
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
                model: model.$.additionalIncome,
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
                model: model.$.totalIncome,
                component: Input,
                componentProps: { label: 'Общий доход (₽)', type: 'number', testId: 'totalIncome' },
              },
            ],
          },
          {
            selector: 'additionalIncomeSource',
            model: model.$.additionalIncomeSource,
            component: Input,
            componentProps: {
              label: 'Источник дополнительного дохода',
              placeholder: 'Опишите источник',
              testId: 'additionalIncomeSource',
            },
          },
          {
            selector: 'paymentToIncomeRatio',
            model: model.$.paymentToIncomeRatio,
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
            model: model.$.maritalStatus,
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
                model: model.$.dependents,
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
                model: model.$.education,
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
            model: model.$.hasProperty,
            component: Checkbox,
            componentProps: { label: 'У меня есть имущество', testId: 'hasProperty' },
          },
          {
            selector: 'properties-array',
            model: model.$.properties,
            component: FormArray,
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
                  model: im.$.type,
                  component: Select,
                  componentProps: {
                    label: 'Тип имущества',
                    placeholder: 'Выберите тип',
                    options: PROPERTY_TYPE_OPTIONS,
                    testId: 'type',
                  },
                },
                {
                  model: im.$.description,
                  component: Textarea,
                  componentProps: {
                    label: 'Описание',
                    rows: 2,
                    placeholder: 'Опишите имущество',
                    testId: 'description',
                  },
                },
                {
                  model: im.$.estimatedValue,
                  component: Input,
                  componentProps: {
                    label: 'Оценочная стоимость (₽)',
                    type: 'number',
                    min: 0,
                    testId: 'estimatedValue',
                  },
                },
                {
                  model: im.$.hasEncumbrance,
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
            model: model.$.hasExistingLoans,
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
            model: model.$.existingLoans,
            component: FormArray,
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
                      model: im.$.bank,
                      component: Input,
                      componentProps: {
                        label: 'Банк',
                        placeholder: 'Название банка',
                        testId: 'bank',
                      },
                    },
                    {
                      model: im.$.type,
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
                      model: im.$.amount,
                      component: Input,
                      componentProps: {
                        label: 'Сумма кредита (₽)',
                        type: 'number',
                        min: 0,
                        testId: 'amount',
                      },
                    },
                    {
                      model: im.$.remainingAmount,
                      component: Input,
                      componentProps: {
                        label: 'Остаток задолженности (₽)',
                        type: 'number',
                        min: 0,
                        testId: 'remainingAmount',
                      },
                    },
                    {
                      model: im.$.monthlyPayment,
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
                  model: im.$.maturityDate,
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
            model: model.$.hasCoBorrower,
            component: Checkbox,
            componentProps: { label: 'Добавить созаёмщика', testId: 'hasCoBorrower' },
          },
          {
            selector: 'coborrowers-array',
            model: model.$.coBorrowers,
            component: FormArray,
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
                      model: im.$.personalData.lastName,
                      component: Input,
                      componentProps: {
                        label: 'Фамилия',
                        placeholder: 'Введите фамилию',
                        testId: 'personalData-lastName',
                      },
                    },
                    {
                      model: im.$.personalData.firstName,
                      component: Input,
                      componentProps: {
                        label: 'Имя',
                        placeholder: 'Введите имя',
                        testId: 'personalData-firstName',
                      },
                    },
                    {
                      model: im.$.personalData.middleName,
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
                      model: im.$.personalData.birthDate,
                      component: Input,
                      componentProps: {
                        label: 'Дата рождения',
                        type: 'date',
                        testId: 'personalData-birthDate',
                      },
                    },
                    {
                      model: im.$.personalData.gender,
                      component: RadioGroup,
                      componentProps: {
                        label: 'Пол',
                        options: GENDER_OPTIONS,
                        className: '!flex-row gap-6',
                        testId: 'personalData-gender',
                      },
                    },
                    {
                      model: im.$.personalData.birthPlace,
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
                      model: im.$.phone,
                      component: InputMask,
                      componentProps: { label: 'Телефон', mask: PHONE_MASK, testId: 'phone' },
                    },
                    {
                      model: im.$.email,
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
                      model: im.$.relationship,
                      component: Input,
                      componentProps: {
                        label: 'Родство',
                        placeholder: 'Укажите родство',
                        testId: 'relationship',
                      },
                    },
                    {
                      model: im.$.monthlyIncome,
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
            model: model.$.coBorrowersIncome,
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
            model: model.$.agreePersonalData,
            component: Checkbox,
            componentProps: {
              label: 'Согласие на обработку персональных данных',
              testId: 'agreePersonalData',
            },
          },
          {
            selector: 'agreeCreditHistory',
            model: model.$.agreeCreditHistory,
            component: Checkbox,
            componentProps: {
              label: 'Согласие на проверку кредитной истории',
              testId: 'agreeCreditHistory',
            },
          },
          {
            selector: 'agreeMarketing',
            model: model.$.agreeMarketing,
            component: Checkbox,
            componentProps: {
              label: 'Согласие на получение маркетинговых материалов',
              testId: 'agreeMarketing',
            },
          },
          {
            selector: 'agreeTerms',
            model: model.$.agreeTerms,
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
            model: model.$.confirmAccuracy,
            component: Checkbox,
            componentProps: {
              label: 'Подтверждаю точность введённых данных',
              testId: 'confirmAccuracy',
            },
          },
          {
            selector: 'electronicSignature',
            model: model.$.electronicSignature,
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

  /** Узел шага: `selector` — ключ правил шага, `title` и `icon` читает индикатор визарда. */
  const step = (selector: string, title: string, icon: string, body: Node): Node => ({
    selector,
    component: Step,
    componentProps: { title, icon },
    children: [body],
  });

  const wizard: Node = {
    selector: 'wizard',
    component: FormWizard,
    children: [
      step('step1', 'Кредит', '💰', step1),
      step('step2', 'Личные данные', '👤', step2),
      step('step3', 'Контакты', '📞', step3),
      step('step4', 'Работа', '💼', step4),
      step('step5', 'Дополнительно', '📋', step5),
      step('step6', 'Подтверждение', '✓', step6),
    ],
  };

  return wizard;
}
