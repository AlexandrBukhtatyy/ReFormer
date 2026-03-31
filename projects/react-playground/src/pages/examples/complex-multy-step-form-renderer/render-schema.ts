/**
 * RenderSchema для формы кредитной заявки
 *
 * Полностью декларативное описание multi-step формы через NavigationRenderNode.
 * Переиспользует типы, валидацию и поведение из complex-multy-step-form.
 */

import type { RenderSchemaFn, RenderNode, FieldPath } from '@reformer/core';
import { Box, Section, FormArray } from '@reformer/core';
import { Step } from '@reformer/ui/form-navigation';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import type { Property } from '../complex-multy-step-form/components/nested-forms/Property/types';
import type { ExistingLoan } from '../complex-multy-step-form/components/nested-forms/ExistingLoan/types';
import type { CoBorrower } from '../complex-multy-step-form/components/nested-forms/CoBorrower/types';
import creditApplicationValidation, {
  STEP_VALIDATIONS,
} from '../complex-multy-step-form/schemas/credit-application-validation';
import { submitCreditApplication } from '../complex-multy-step-form/api';
import { CreditApplicationWizard } from './CreditApplicationWizard';
import { StepIndicator } from '../complex-multy-step-form/components/ui/StepIndicator';
import { NavigationActions } from '../complex-multy-step-form/components/ui/NavigationActions';
import { NavigationProgress } from '../complex-multy-step-form/components/ui/NavigationProgress';
import { ResidenceAddressSection } from '../complex-multy-step-form/components/ui/ResidenceAddressSection';
import { UnemployedWarning } from '../complex-multy-step-form/components/ui/UnemployedWarning';
import {
  PropertyArrayHeader,
  PropertyArrayEmpty,
  PropertyItemHeader,
  ExistingLoanArrayHeader,
  ExistingLoanArrayEmpty,
  ExistingLoanItemHeader,
  CoBorrowerArrayHeader,
  CoBorrowerArrayEmpty,
  CoBorrowerItemHeader,
} from '../complex-multy-step-form/components/ui/FormArrayComponents';
import {
  ConfirmationInfoBlock,
  HighPaymentWarning,
  LoanSummarySection,
  SubmitWarning,
  NextStepsInfo,
  ElectronicSignatureHint,
} from '../complex-multy-step-form/components/ui/ConfirmationComponents';

/**
 * Обработчик отправки формы
 */
async function handleSubmit(values: CreditApplicationForm): Promise<void> {
  const response = await submitCreditApplication(values);
  if (response.status === 200 || response.status === 201) {
    alert(`Заявка успешно отправлена! ID: ${response.data.id}`);
  } else {
    throw new Error('Ошибка отправки заявки');
  }
}

/**
 * RenderSchema для кредитной заявки
 *
 * Структура:
 * - CreditApplicationWizard (корень) - пользовательский wizard-компонент
 *   - indicator: StepIndicator
 *   - step:1-6: содержимое шагов (с title/icon в componentProps)
 *   - actions: NavigationActions
 *   - progress: NavigationProgress
 */
export const creditApplicationRenderSchema: RenderSchemaFn<CreditApplicationForm> = (path) => ({
  component: CreditApplicationWizard,
  componentProps: {
    stepValidations: STEP_VALIDATIONS,
    fullValidation: creditApplicationValidation,
    onSubmit: handleSubmit,
    className: 'bg-white p-8 rounded-lg shadow-md',
    children: [
      // ========================================
      // Индикатор шагов
      // ========================================
      {
        selector: 'indicator',
        component: StepIndicator,
        componentProps: { className: 'mb-8' },
      },

      // ========================================
      // Шаг 1: Основная информация о кредите
      // ========================================
      {
        selector: 'step:1',
        component: Step,
        componentProps: {
          title: 'Кредит',
          icon: '💰',
          children: [
            {
              component: Box,
              componentProps: {
                className: 'space-y-6',
                children: [
                  // Заголовок
                  {
                    component: Section,
                    componentProps: {
                      title: 'Основная информация о кредите',
                      titleAs: 'h2',
                      titleClassName: 'text-xl font-bold',
                      className: 'space-y-6',
                      children: [
                        { component: path.loanType },
                        { component: path.loanAmount },
                        { component: path.loanTerm },
                        { component: path.loanPurpose },
                      ],
                    },
                  },
                  // Секция для ипотеки
                  {
                    component: Section,
                    hidden: (form) => form.loanType.value.value !== 'mortgage',
                    componentProps: {
                      title: 'Информация о недвижимости',
                      titleClassName: 'text-lg font-semibold mt-4',
                      className: 'space-y-4',
                      children: [
                        { component: path.propertyValue },
                        { component: path.initialPayment },
                      ],
                    },
                  },
                  // Секция для автокредита
                  {
                    component: Section,
                    hidden: (form) => form.loanType.value.value !== 'car',
                    componentProps: {
                      title: 'Информация об автомобиле',
                      titleClassName: 'text-lg font-semibold mt-4',
                      className: 'space-y-4',
                      children: [
                        { component: path.carBrand },
                        { component: path.carModel },
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-2 gap-4',
                            children: [{ component: path.carYear }, { component: path.carPrice }],
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ] satisfies RenderNode<CreditApplicationForm>[],
        },
      },

      // ========================================
      // Шаг 2: Персональные данные
      // ========================================
      {
        selector: 'step:2',
        component: Step,
        componentProps: {
          title: 'Данные',
          icon: '👤',
          children: [
            {
              component: Section,
              componentProps: {
                title: 'Персональные данные',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
                children: [
                  // Личные данные
                  {
                    component: Section,
                    componentProps: {
                      title: 'Личные данные',
                      titleClassName: 'text-lg font-semibold',
                      className: 'space-y-4',
                      children: [
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-3 gap-4',
                            children: [
                              { component: path.personalData.lastName },
                              { component: path.personalData.firstName },
                              { component: path.personalData.middleName },
                            ],
                          },
                        },
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-2 gap-4',
                            children: [
                              { component: path.personalData.birthDate },
                              { component: path.personalData.gender },
                            ],
                          },
                        },
                        { component: path.personalData.birthPlace },
                      ],
                    },
                  },
                  // Паспортные данные
                  {
                    component: Section,
                    componentProps: {
                      title: 'Паспортные данные',
                      titleClassName: 'text-lg font-semibold',
                      className: 'space-y-4',
                      children: [
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-2 gap-4',
                            children: [
                              { component: path.passportData.series },
                              { component: path.passportData.number },
                            ],
                          },
                        },
                        { component: path.passportData.issuedBy },
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-2 gap-4',
                            children: [
                              { component: path.passportData.issueDate },
                              { component: path.passportData.departmentCode },
                            ],
                          },
                        },
                      ],
                    },
                  },
                  // ИНН и СНИЛС
                  {
                    component: Section,
                    componentProps: {
                      title: 'Дополнительные документы',
                      titleClassName: 'text-lg font-semibold',
                      className: 'space-y-4',
                      children: [
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-2 gap-4',
                            children: [{ component: path.inn }, { component: path.snils }],
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ] satisfies RenderNode<CreditApplicationForm>[],
        },
      },

      // ========================================
      // Шаг 3: Контактная информация
      // ========================================
      {
        selector: 'step:3',
        component: Step,
        componentProps: {
          title: 'Контакты',
          icon: '📞',
          children: [
            {
              component: Section,
              componentProps: {
                title: 'Контактная информация',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
                children: [
                  // Контакты (телефоны и email в одной секции)
                  {
                    component: Section,
                    componentProps: {
                      title: 'Контакты',
                      titleClassName: 'text-lg font-semibold',
                      className: 'space-y-4',
                      children: [
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-2 gap-4',
                            children: [
                              { component: path.phoneMain },
                              { component: path.phoneAdditional },
                            ],
                          },
                        },
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-2 gap-4',
                            children: [
                              { component: path.email },
                              { component: path.emailAdditional },
                            ],
                          },
                        },
                      ],
                    },
                  },
                  // Адрес регистрации
                  {
                    component: Section,
                    componentProps: {
                      title: 'Адрес регистрации',
                      titleClassName: 'text-lg font-semibold',
                      className: 'space-y-4',
                      children: [
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-2 gap-4',
                            children: [
                              { component: path.registrationAddress.region },
                              { component: path.registrationAddress.city },
                            ],
                          },
                        },
                        { component: path.registrationAddress.street },
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-3 gap-4',
                            children: [
                              { component: path.registrationAddress.house },
                              { component: path.registrationAddress.apartment! },
                              { component: path.registrationAddress.postalCode },
                            ],
                          },
                        },
                      ] satisfies RenderNode<CreditApplicationForm>[],
                    },
                  },
                  // Флаг совпадения адресов
                  { component: path.sameAsRegistration },
                  // Адрес проживания (со специальной стилизацией и кнопками)
                  {
                    component: Box,
                    hidden: (form) => form.sameAsRegistration.value.value === true,
                    componentProps: {
                      children: [
                        {
                          component: ResidenceAddressSection,
                          componentProps: {
                            children: [
                              {
                                component: Box,
                                componentProps: {
                                  className: 'grid grid-cols-2 gap-4',
                                  children: [
                                    { component: path.residenceAddress.region },
                                    { component: path.residenceAddress.city },
                                  ],
                                },
                              },
                              { component: path.residenceAddress.street },
                              {
                                component: Box,
                                componentProps: {
                                  className: 'grid grid-cols-3 gap-4',
                                  children: [
                                    { component: path.residenceAddress.house },
                                    { component: path.residenceAddress.apartment! },
                                    { component: path.residenceAddress.postalCode },
                                  ],
                                },
                              },
                            ] satisfies RenderNode<CreditApplicationForm>[],
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ] satisfies RenderNode<CreditApplicationForm>[],
        },
      },

      // ========================================
      // Шаг 4: Информация о занятости
      // ========================================
      {
        selector: 'step:4',
        component: Step,
        componentProps: {
          title: 'Работа',
          icon: '💼',
          children: [
            {
              component: Section,
              componentProps: {
                title: 'Информация о занятости',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
                children: [
                  // Статус занятости
                  {
                    component: Box,
                    componentProps: {
                      className: 'space-y-4',
                      children: [{ component: path.employmentStatus }],
                    },
                  },
                  // Информация о работодателе (для employed)
                  {
                    component: Section,
                    hidden: (form) => form.employmentStatus.value.value !== 'employed',
                    componentProps: {
                      title: 'Информация о работодателе',
                      titleClassName: 'text-lg font-semibold mt-6',
                      className: 'space-y-4',
                      children: [
                        { component: path.companyName },
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-2 gap-4',
                            children: [
                              { component: path.companyInn },
                              { component: path.companyPhone },
                            ],
                          },
                        },
                        { component: path.companyAddress },
                        // Должность и стаж
                        {
                          component: Section,
                          componentProps: {
                            title: 'Должность и стаж',
                            titleClassName: 'text-lg font-semibold mt-6',
                            className: 'space-y-4',
                            children: [
                              { component: path.position },
                              {
                                component: Box,
                                componentProps: {
                                  className: 'grid grid-cols-2 gap-4',
                                  children: [
                                    { component: path.workExperienceTotal },
                                    { component: path.workExperienceCurrent },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                  // Информация о бизнесе (для selfEmployed)
                  {
                    component: Section,
                    hidden: (form) => form.employmentStatus.value.value !== 'selfEmployed',
                    componentProps: {
                      title: 'Информация о бизнесе',
                      titleClassName: 'text-lg font-semibold mt-6',
                      className: 'space-y-4',
                      children: [
                        { component: path.businessType },
                        { component: path.businessInn },
                        { component: path.businessActivity },
                      ],
                    },
                  },
                  // Доход (показывается когда не unemployed)
                  {
                    component: Section,
                    hidden: (form) => form.employmentStatus.value.value === 'unemployed',
                    componentProps: {
                      title: 'Доход',
                      titleClassName: 'text-lg font-semibold mt-6',
                      className: 'space-y-4',
                      children: [
                        { component: path.monthlyIncome },
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-2 gap-4',
                            children: [
                              { component: path.additionalIncome },
                              { component: path.additionalIncomeSource },
                            ],
                          },
                        },
                      ],
                    },
                  },
                  // Предупреждение для безработных
                  {
                    component: UnemployedWarning,
                    hidden: (form) => form.employmentStatus.value.value !== 'unemployed',
                    componentProps: {
                      className: 'mt-6',
                    },
                  },
                ],
              },
            },
          ] satisfies RenderNode<CreditApplicationForm>[],
        },
      },

      // ========================================
      // Шаг 5: Дополнительная информация
      // ========================================
      {
        selector: 'step:5',
        component: Step,
        componentProps: {
          title: 'Доп. инфо',
          icon: '📋',
          children: [
            {
              component: Section,
              componentProps: {
                title: 'Дополнительная информация',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
                children: [
                  // Общая информация
                  {
                    component: Section,
                    componentProps: {
                      title: 'Общая информация',
                      titleClassName: 'text-lg font-semibold',
                      className: 'space-y-4',
                      children: [
                        { component: path.maritalStatus },
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-2 gap-4',
                            children: [
                              { component: path.dependents },
                              { component: path.education },
                            ],
                          },
                        },
                      ],
                    },
                  },
                  // Имущество
                  {
                    component: Section,
                    componentProps: {
                      className: 'space-y-4',
                      children: [
                        { component: path.hasProperty },
                        {
                          component: FormArray,
                          hidden: (form) => !form.hasProperty.value.value,
                          componentProps: {
                            array: path.properties,
                            className: 'p-4 bg-gray-50 rounded-lg border border-gray-200',
                            children: [
                              {
                                selector: 'header',
                                component: PropertyArrayHeader,
                              },
                              {
                                selector: 'empty',
                                component: PropertyArrayEmpty,
                              },
                              {
                                selector: 'item',
                                component: Box,
                                componentProps: {
                                  className: 'mb-4 p-4 bg-white rounded border',
                                  children: [
                                    {
                                      selector: 'item:header',
                                      component: PropertyItemHeader,
                                    },
                                    {
                                      selector: 'item:content',
                                      render: (itemPath: FieldPath<Property>) => ({
                                        component: Box,
                                        componentProps: {
                                          className: 'space-y-3',
                                          children: [
                                            { component: itemPath.type },
                                            { component: itemPath.description },
                                            { component: itemPath.estimatedValue },
                                            { component: itemPath.hasEncumbrance },
                                          ],
                                        },
                                      }),
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                  // Существующие кредиты
                  {
                    component: Section,
                    componentProps: {
                      className: 'space-y-4',
                      children: [
                        { component: path.hasExistingLoans },
                        {
                          component: FormArray,
                          hidden: (form) => !form.hasExistingLoans.value.value,
                          componentProps: {
                            array: path.existingLoans,
                            className: 'p-4 bg-gray-50 rounded-lg border border-gray-200',
                            children: [
                              {
                                selector: 'header',
                                component: ExistingLoanArrayHeader,
                              },
                              {
                                selector: 'empty',
                                component: ExistingLoanArrayEmpty,
                              },
                              {
                                selector: 'item',
                                component: Box,
                                componentProps: {
                                  className: 'mb-4 p-4 bg-white rounded border',
                                  children: [
                                    {
                                      selector: 'item:header',
                                      component: ExistingLoanItemHeader,
                                    },
                                    {
                                      selector: 'item:content',
                                      render: (itemPath: FieldPath<ExistingLoan>) => ({
                                        component: Box,
                                        componentProps: {
                                          className: 'space-y-3',
                                          children: [
                                            { component: itemPath.bank },
                                            { component: itemPath.type },
                                            {
                                              component: Box,
                                              componentProps: {
                                                className: 'grid grid-cols-2 gap-4',
                                                children: [
                                                  { component: itemPath.amount },
                                                  { component: itemPath.remainingAmount },
                                                ],
                                              },
                                            },
                                            {
                                              component: Box,
                                              componentProps: {
                                                className: 'grid grid-cols-2 gap-4',
                                                children: [
                                                  { component: itemPath.monthlyPayment },
                                                  { component: itemPath.maturityDate },
                                                ],
                                              },
                                            },
                                          ],
                                        },
                                      }),
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                  // Созаёмщики
                  {
                    component: Section,
                    componentProps: {
                      className: 'space-y-4',
                      children: [
                        { component: path.hasCoBorrower },
                        {
                          component: FormArray,
                          hidden: (form) => !form.hasCoBorrower.value.value,
                          componentProps: {
                            array: path.coBorrowers,
                            className: 'p-4 bg-gray-50 rounded-lg border border-gray-200',
                            children: [
                              {
                                selector: 'header',
                                component: CoBorrowerArrayHeader,
                              },
                              {
                                selector: 'empty',
                                component: CoBorrowerArrayEmpty,
                              },
                              {
                                selector: 'item',
                                component: Box,
                                componentProps: {
                                  className: 'mb-4 p-4 bg-white rounded border',
                                  children: [
                                    {
                                      selector: 'item:header',
                                      component: CoBorrowerItemHeader,
                                    },
                                    {
                                      selector: 'item:content',
                                      render: (itemPath: FieldPath<CoBorrower>) => ({
                                        component: Box,
                                        componentProps: {
                                          className: 'space-y-3',
                                          children: [
                                            {
                                              component: Box,
                                              componentProps: {
                                                className: 'grid grid-cols-3 gap-4',
                                                children: [
                                                  { component: itemPath.personalData.lastName },
                                                  { component: itemPath.personalData.firstName },
                                                  { component: itemPath.personalData.middleName },
                                                ],
                                              },
                                            },
                                            { component: itemPath.personalData.birthDate },
                                            {
                                              component: Box,
                                              componentProps: {
                                                className: 'grid grid-cols-2 gap-4',
                                                children: [
                                                  { component: itemPath.phone },
                                                  { component: itemPath.email },
                                                ],
                                              },
                                            },
                                            {
                                              component: Box,
                                              componentProps: {
                                                className: 'grid grid-cols-2 gap-4',
                                                children: [
                                                  { component: itemPath.relationship },
                                                  { component: itemPath.monthlyIncome },
                                                ],
                                              },
                                            },
                                          ],
                                        },
                                      }),
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ] satisfies RenderNode<CreditApplicationForm>[],
        },
      },

      // ========================================
      // Шаг 6: Подтверждение
      // ========================================
      {
        selector: 'step:6',
        component: Step,
        componentProps: {
          title: 'Подтверждение',
          icon: '✓',
          children: [
            {
              component: Section,
              componentProps: {
                title: 'Подтверждение и согласия',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
                children: [
                  // Информационные блоки
                  {
                    component: Box,
                    componentProps: {
                      className: 'space-y-4',
                      children: [
                        { component: ConfirmationInfoBlock },
                        { component: HighPaymentWarning },
                      ],
                    },
                  },
                  // Секция "Итого"
                  { component: LoanSummarySection },
                  // Обязательные согласия
                  {
                    component: Section,
                    componentProps: {
                      title: 'Обязательные согласия',
                      titleClassName: 'text-lg font-semibold',
                      className: 'space-y-3',
                      children: [
                        { component: path.agreePersonalData },
                        { component: path.agreeCreditHistory },
                        { component: path.agreeTerms },
                        { component: path.confirmAccuracy },
                      ],
                    },
                  },
                  // Опциональные согласия
                  {
                    component: Section,
                    componentProps: {
                      title: 'Опциональные согласия',
                      titleClassName: 'text-lg font-semibold mt-6',
                      children: [{ component: path.agreeMarketing }],
                    },
                  },
                  // Электронная подпись
                  {
                    component: Section,
                    componentProps: {
                      title: 'Электронная подпись',
                      titleClassName: 'text-lg font-semibold mt-6',
                      className: 'space-y-4',
                      children: [
                        { component: path.electronicSignature },
                        { component: ElectronicSignatureHint },
                      ],
                    },
                  },
                  // Предупреждение
                  { component: SubmitWarning },
                  // Что будет дальше
                  { component: NextStepsInfo },
                ],
              },
            },
          ] satisfies RenderNode<CreditApplicationForm>[],
        },
      },

      // ========================================
      // Кнопки навигации
      // ========================================
      {
        selector: 'actions',
        component: NavigationActions,
        componentProps: { className: 'mt-8' },
      },

      // ========================================
      // Прогресс
      // ========================================
      {
        selector: 'progress',
        component: NavigationProgress,
        componentProps: { className: 'mt-4 text-center' },
      },
    ] as unknown as RenderNode<CreditApplicationForm>[],
  },
});
