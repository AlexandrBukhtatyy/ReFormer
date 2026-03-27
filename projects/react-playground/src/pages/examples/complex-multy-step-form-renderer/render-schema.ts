/**
 * RenderSchema для формы кредитной заявки
 *
 * Полностью декларативное описание multi-step формы через NavigationRenderNode.
 * Переиспользует типы, валидацию и поведение из complex-multy-step-form.
 */

import type { RenderSchemaFn, RenderNode, FieldPath } from '@reformer/core';
import { Box, Section, FormArray } from '@reformer/core';
import { FormNavigation } from '@reformer/ui/form-navigation';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import type { Property } from '../complex-multy-step-form/components/nested-forms/Property/types';
import type { ExistingLoan } from '../complex-multy-step-form/components/nested-forms/ExistingLoan/types';
import type { CoBorrower } from '../complex-multy-step-form/components/nested-forms/CoBorrower/types';
import { STEPS } from '../complex-multy-step-form/constants/credit-application';
import creditApplicationValidation, {
  STEP_VALIDATIONS,
} from '../complex-multy-step-form/schemas/credit-application-validation';
import { submitCreditApplication } from '../complex-multy-step-form/api';
import { StepIndicator } from './components/StepIndicator';
import { NavigationActions } from './components/NavigationActions';
import { NavigationProgress } from './components/NavigationProgress';

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
 * - NavigationRenderNode (корень)
 *   - indicator: StepIndicator
 *   - step:1-6: содержимое шагов
 *   - actions: NavigationActions
 *   - progress: NavigationProgress
 */
export const creditApplicationRenderSchema: RenderSchemaFn<CreditApplicationForm> = (path) => ({
  component: FormNavigation,
  componentProps: {
    steps: STEPS,
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
                    titleClassName: 'text-xl font-bold mb-4',
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
                  componentProps: {
                    title: 'Информация о недвижимости',
                    titleClassName: 'text-lg font-semibold mb-3',
                    hidden: (form) => form.loanType.value.value !== 'mortgage',
                    children: [
                      { component: path.propertyValue },
                      { component: path.initialPayment },
                    ],
                  },
                },
                // Секция для автокредита
                {
                  component: Section,
                  componentProps: {
                    title: 'Информация об автомобиле',
                    titleClassName: 'text-lg font-semibold mb-3',
                    hidden: (form) => form.loanType.value.value !== 'car',
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
        ] as RenderNode<CreditApplicationForm>[],
      },

      // ========================================
      // Шаг 2: Персональные данные
      // ========================================
      {
        selector: 'step:2',
        children: [
          {
            component: Box,
            componentProps: {
              className: 'space-y-6',
              children: [
                // Личные данные
                {
                  component: Section,
                  componentProps: {
                    title: 'Личные данные',
                    titleClassName: 'text-lg font-semibold mb-3',
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
                    titleClassName: 'text-lg font-semibold mb-3',
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
                    titleClassName: 'text-lg font-semibold mb-3',
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
        ] as RenderNode<CreditApplicationForm>[],
      },

      // ========================================
      // Шаг 3: Контактная информация
      // ========================================
      {
        selector: 'step:3',
        children: [
          {
            component: Box,
            componentProps: {
              className: 'space-y-6',
              children: [
                // Телефоны
                {
                  component: Section,
                  componentProps: {
                    title: 'Контактные телефоны',
                    titleClassName: 'text-lg font-semibold mb-3',
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
                    ],
                  },
                },
                // Email
                {
                  component: Section,
                  componentProps: {
                    title: 'Электронная почта',
                    titleClassName: 'text-lg font-semibold mb-3',
                    children: [
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
                    titleClassName: 'text-lg font-semibold mb-3',
                    children: [
                      { component: path.registrationAddress.region },
                      { component: path.registrationAddress.city },
                      { component: path.registrationAddress.street },
                      {
                        component: Box,
                        componentProps: {
                          className: 'grid grid-cols-3 gap-4',
                          children: [
                            { component: path.registrationAddress.house },
                            { component: path.registrationAddress.apartment },
                          ],
                        },
                      },
                      { component: path.registrationAddress.postalCode },
                    ],
                  },
                },
                // Флаг совпадения адресов
                { component: path.sameAsRegistration },
                // Адрес проживания
                {
                  component: Section,
                  componentProps: {
                    title: 'Адрес проживания',
                    titleClassName: 'text-lg font-semibold mb-3',
                    hidden: (form) => form.sameAsRegistration.value.value === true,
                    children: [
                      { component: path.residenceAddress.region },
                      { component: path.residenceAddress.city },
                      { component: path.residenceAddress.street },
                      {
                        component: Box,
                        componentProps: {
                          className: 'grid grid-cols-3 gap-4',
                          children: [
                            { component: path.residenceAddress.house },
                            { component: path.residenceAddress.apartment },
                          ],
                        },
                      },
                      { component: path.residenceAddress.postalCode },
                    ],
                  },
                },
              ],
            },
          },
        ] as RenderNode<CreditApplicationForm>[],
      },

      // ========================================
      // Шаг 4: Информация о занятости
      // ========================================
      {
        selector: 'step:4',
        children: [
          {
            component: Box,
            componentProps: {
              className: 'space-y-6',
              children: [
                // Статус занятости
                { component: path.employmentStatus },
                // Информация о работодателе (для employed)
                {
                  component: Section,
                  componentProps: {
                    title: 'Информация о работодателе',
                    titleClassName: 'text-lg font-semibold mb-3',
                    hidden: (form) => form.employmentStatus.value.value !== 'employed',
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
                // Информация о бизнесе (для selfEmployed)
                {
                  component: Section,
                  componentProps: {
                    title: 'Информация о бизнесе',
                    titleClassName: 'text-lg font-semibold mb-3',
                    hidden: (form) => form.employmentStatus.value.value !== 'selfEmployed',
                    children: [
                      { component: path.businessType },
                      { component: path.businessInn },
                      { component: path.businessActivity },
                    ],
                  },
                },
                // Доход
                {
                  component: Section,
                  componentProps: {
                    title: 'Информация о доходах',
                    titleClassName: 'text-lg font-semibold mb-3',
                    children: [
                      {
                        component: Box,
                        componentProps: {
                          className: 'grid grid-cols-2 gap-4',
                          children: [
                            { component: path.monthlyIncome },
                            { component: path.additionalIncome },
                          ],
                        },
                      },
                      { component: path.additionalIncomeSource },
                    ],
                  },
                },
              ],
            },
          },
        ] as RenderNode<CreditApplicationForm>[],
      },

      // ========================================
      // Шаг 5: Дополнительная информация
      // ========================================
      {
        selector: 'step:5',
        children: [
          {
            component: Box,
            componentProps: {
              className: 'space-y-6',
              children: [
                // Семейное положение
                {
                  component: Section,
                  componentProps: {
                    title: 'Семейное положение',
                    titleClassName: 'text-lg font-semibold mb-3',
                    children: [
                      {
                        component: Box,
                        componentProps: {
                          className: 'grid grid-cols-3 gap-4',
                          children: [
                            { component: path.maritalStatus },
                            { component: path.dependents },
                            { component: path.education },
                          ],
                        },
                      },
                    ],
                  },
                },
                // Имущество
                { component: path.hasProperty },
                {
                  component: Box,
                  componentProps: {
                    hidden: (form) => !form.hasProperty.value.value,
                    children: [
                      {
                        component: FormArray,
                        componentProps: {
                          array: path.properties,
                          className: 'space-y-4',
                          children: [
                            {
                              selector: 'empty',
                              component: Box,
                              componentProps: {
                                className: 'text-gray-500 text-center py-4',
                              },
                            },
                            {
                              selector: 'item',
                              component: Box,
                              componentProps: {
                                className: 'p-4 border rounded-lg bg-gray-50',
                                children: [
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
                { component: path.hasExistingLoans },
                {
                  component: Box,
                  componentProps: {
                    hidden: (form) => !form.hasExistingLoans.value.value,
                    children: [
                      {
                        component: FormArray,
                        componentProps: {
                          array: path.existingLoans,
                          className: 'space-y-4',
                          children: [
                            {
                              selector: 'empty',
                              component: Box,
                              componentProps: {
                                className: 'text-gray-500 text-center py-4',
                              },
                            },
                            {
                              selector: 'item',
                              component: Box,
                              componentProps: {
                                className: 'p-4 border rounded-lg bg-gray-50',
                                children: [
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
                                          { component: itemPath.monthlyPayment },
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
                { component: path.hasCoBorrower },
                {
                  component: Box,
                  componentProps: {
                    hidden: (form) => !form.hasCoBorrower.value.value,
                    children: [
                      {
                        component: FormArray,
                        componentProps: {
                          array: path.coBorrowers,
                          className: 'space-y-4',
                          children: [
                            {
                              selector: 'empty',
                              component: Box,
                              componentProps: {
                                className: 'text-gray-500 text-center py-4',
                              },
                            },
                            {
                              selector: 'item',
                              component: Box,
                              componentProps: {
                                className: 'p-4 border rounded-lg bg-gray-50',
                                children: [
                                  {
                                    selector: 'item:content',
                                    render: (itemPath: FieldPath<CoBorrower>) => ({
                                      component: Box,
                                      componentProps: {
                                        className: 'space-y-3',
                                        children: [
                                          { component: itemPath.relationship },
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
                                          {
                                            component: Box,
                                            componentProps: {
                                              className: 'grid grid-cols-2 gap-4',
                                              children: [
                                                { component: itemPath.personalData.birthDate },
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
        ] as RenderNode<CreditApplicationForm>[],
      },

      // ========================================
      // Шаг 6: Подтверждение
      // ========================================
      {
        selector: 'step:6',
        children: [
          {
            component: Box,
            componentProps: {
              className: 'space-y-6',
              children: [
                // Расчёты
                {
                  component: Section,
                  componentProps: {
                    title: 'Расчёт кредита',
                    titleClassName: 'text-lg font-semibold mb-3',
                    className: 'bg-blue-50 p-4 rounded-lg',
                    children: [
                      {
                        component: Box,
                        componentProps: {
                          className: 'grid grid-cols-2 gap-4',
                          children: [
                            { component: path.interestRate },
                            { component: path.monthlyPayment },
                          ],
                        },
                      },
                      {
                        component: Box,
                        componentProps: {
                          className: 'grid grid-cols-2 gap-4',
                          children: [
                            { component: path.totalIncome },
                            { component: path.paymentToIncomeRatio },
                          ],
                        },
                      },
                    ],
                  },
                },
                // Согласия
                {
                  component: Section,
                  componentProps: {
                    title: 'Согласия',
                    titleClassName: 'text-lg font-semibold mb-3',
                    children: [
                      { component: path.agreePersonalData },
                      { component: path.agreeCreditHistory },
                      { component: path.agreeMarketing },
                      { component: path.agreeTerms },
                    ],
                  },
                },
                // Подтверждение
                {
                  component: Section,
                  componentProps: {
                    title: 'Подтверждение',
                    titleClassName: 'text-lg font-semibold mb-3',
                    children: [
                      { component: path.confirmAccuracy },
                      { component: path.electronicSignature },
                    ],
                  },
                },
              ],
            },
          },
        ] as RenderNode<CreditApplicationForm>[],
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
    ],
  },
});
