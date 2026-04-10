/**
 * RenderSchema для формы кредитной заявки
 *
 * Фабрика: принимает форму и возвращает RenderSchemaProxy с применённым поведением.
 * Переиспользует типы, валидацию и поведение из complex-multy-step-form.
 */

import type { FieldPath, FormProxy } from '@reformer/core';
import { createRenderSchema } from '@reformer/renderer-react';
import type { RenderNode } from '@reformer/renderer-react';
import { createCreditApplicationRenderBehavior } from './render-behavior';
import { Step } from '@reformer/cdk/form-wizard';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import type { Property } from '../complex-multy-step-form/components/nested-forms/Property/types';
import type { ExistingLoan } from '../complex-multy-step-form/components/nested-forms/ExistingLoan/types';
import type { CoBorrower } from '../complex-multy-step-form/components/nested-forms/CoBorrower/types';
import creditApplicationValidation, {
  STEP_VALIDATIONS,
} from '../complex-multy-step-form/schemas/credit-application-validation';
import { RendererFormWizard } from '../complex-multy-step-form/components/ui/FormWizzard/RendererFormWizard';
import { ResidenceAddressSection } from '../complex-multy-step-form/components/ui/ResidenceAddressSection';
import { UnemployedWarning } from '../complex-multy-step-form/components/ui/UnemployedWarning';
import {
  ConfirmationInfoBlock,
  HighPaymentWarning,
  LoanSummarySection,
  SubmitWarning,
  NextStepsInfo,
  ElectronicSignatureHint,
} from '../complex-multy-step-form/components/ui/ConfirmationComponents';
import { Section } from '@/components/ui/section';
import { Box } from '@/components/ui/box';
import { RendererFormArraySection } from '../complex-multy-step-form/components/ui/FormArray/RendererFormArraySection';

/**
 * RenderSchema для кредитной заявки
 *
 * Структура:
 * - RendererFormWizard (корень) - пользовательский wizard-компонент
 *   - indicator: StepIndicator
 *   - step:1-6: содержимое шагов (с title/icon в componentProps)
 *   - actions: FormWizardActions
 *   - progress: FormWizardProgress
 */
export function createCreditApplicationRenderSchema(form: FormProxy<CreditApplicationForm>) {
  const schema = createRenderSchema<CreditApplicationForm>((path) => ({
    selector: 'wizard',
    component: RendererFormWizard,
    componentProps: {
      form,
      stepValidations: STEP_VALIDATIONS,
      fullValidation: creditApplicationValidation,
      className: 'bg-white p-8 rounded-lg shadow-md',
      steps: [
        // ========================================
        // Шаг 1: Основная информация о кредите
        // ========================================
        {
          component: Step,
          componentProps: {
            title: 'Кредит',
            icon: '💰',
          },
          children: [
            {
              component: Box,
              componentProps: {
                className: 'space-y-6',
              },
              children: [
                // Заголовок
                {
                  component: Section,
                  componentProps: {
                    title: 'Основная информация о кредите',
                    titleAs: 'h2',
                    titleClassName: 'text-xl font-bold',
                    className: 'space-y-6',
                  },
                  children: [
                    { component: path.loanType },
                    { component: path.loanAmount },
                    { component: path.loanTerm },
                    { component: path.loanPurpose },
                  ],
                },
                // Секция для ипотеки
                {
                  selector: 'mortgage-section',
                  component: Section,
                  componentProps: {
                    title: 'Информация о недвижимости',
                    titleClassName: 'text-lg font-semibold mt-4',
                    className: 'space-y-4',
                  },
                  children: [{ component: path.propertyValue }, { component: path.initialPayment }],
                },
                // Секция для автокредита
                {
                  selector: 'car-section',
                  component: Section,
                  componentProps: {
                    title: 'Информация об автомобиле',
                    titleClassName: 'text-lg font-semibold mt-4',
                    className: 'space-y-4',
                  },
                  children: [
                    { component: path.carBrand },
                    { component: path.carModel },
                    {
                      component: Box,
                      componentProps: {
                        className: 'grid grid-cols-2 gap-4',
                      },
                      children: [{ component: path.carYear }, { component: path.carPrice }],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // ========================================
        // Шаг 2: Персональные данные
        // ========================================
        {
          component: Step,
          componentProps: {
            title: 'Данные',
            icon: '👤',
          },
          children: [
            {
              component: Section,
              componentProps: {
                title: 'Персональные данные',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
              },
              children: [
                // Личные данные
                {
                  component: Section,
                  componentProps: {
                    title: 'Личные данные',
                    titleClassName: 'text-lg font-semibold',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      component: Box,
                      componentProps: {
                        className: 'grid grid-cols-3 gap-4',
                      },
                      children: [
                        { component: path.personalData.lastName },
                        { component: path.personalData.firstName },
                        { component: path.personalData.middleName },
                      ],
                    },
                    {
                      component: Box,
                      componentProps: {
                        className: 'grid grid-cols-2 gap-4',
                      },
                      children: [
                        { component: path.personalData.birthDate },
                        { component: path.personalData.gender },
                      ],
                    },
                    { component: path.personalData.birthPlace },
                  ],
                },
                // Паспортные данные
                {
                  component: Section,
                  componentProps: {
                    title: 'Паспортные данные',
                    titleClassName: 'text-lg font-semibold',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      component: Box,
                      componentProps: {
                        className: 'grid grid-cols-2 gap-4',
                      },
                      children: [
                        { component: path.passportData.series },
                        { component: path.passportData.number },
                      ],
                    },
                    { component: path.passportData.issuedBy },
                    {
                      component: Box,
                      componentProps: {
                        className: 'grid grid-cols-2 gap-4',
                      },
                      children: [
                        { component: path.passportData.issueDate },
                        { component: path.passportData.departmentCode },
                      ],
                    },
                  ],
                },
                // ИНН и СНИЛС
                {
                  component: Section,
                  componentProps: {
                    title: 'Дополнительные документы',
                    titleClassName: 'text-lg font-semibold',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      component: Box,
                      componentProps: {
                        className: 'grid grid-cols-2 gap-4',
                      },
                      children: [{ component: path.inn }, { component: path.snils }],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // ========================================
        // Шаг 3: Контактная информация
        // ========================================
        {
          component: Step,
          componentProps: {
            title: 'Контакты',
            icon: '📞',
          },
          children: [
            {
              component: Section,
              componentProps: {
                title: 'Контактная информация',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
              },
              children: [
                // Контакты (телефоны и email в одной секции)
                {
                  component: Section,
                  componentProps: {
                    title: 'Контакты',
                    titleClassName: 'text-lg font-semibold',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      component: Box,
                      componentProps: {
                        className: 'grid grid-cols-2 gap-4',
                      },
                      children: [
                        { component: path.phoneMain },
                        { component: path.phoneAdditional },
                      ],
                    },
                    {
                      component: Box,
                      componentProps: {
                        className: 'grid grid-cols-2 gap-4',
                      },
                      children: [{ component: path.email }, { component: path.emailAdditional }],
                    },
                  ],
                },
                // Адрес регистрации
                {
                  component: Section,
                  componentProps: {
                    title: 'Адрес регистрации',
                    titleClassName: 'text-lg font-semibold',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      component: Box,
                      componentProps: {
                        className: 'grid grid-cols-2 gap-4',
                      },
                      children: [
                        { component: path.registrationAddress.region },
                        { component: path.registrationAddress.city },
                      ],
                    },
                    { component: path.registrationAddress.street },
                    {
                      component: Box,
                      componentProps: {
                        className: 'grid grid-cols-3 gap-4',
                      },
                      children: [
                        { component: path.registrationAddress.house },
                        { component: path.registrationAddress.apartment! },
                        { component: path.registrationAddress.postalCode },
                      ],
                    },
                  ],
                },
                // Флаг совпадения адресов
                { component: path.sameAsRegistration },
                // Адрес проживания (со специальной стилизацией и кнопками)
                {
                  selector: 'residence-address-section',
                  component: Box,
                  children: [
                    {
                      component: ResidenceAddressSection,
                      children: [
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-2 gap-4',
                          },
                          children: [
                            { component: path.residenceAddress.region },
                            { component: path.residenceAddress.city },
                          ],
                        },
                        { component: path.residenceAddress.street },
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-3 gap-4',
                          },
                          children: [
                            { component: path.residenceAddress.house },
                            { component: path.residenceAddress.apartment! },
                            { component: path.residenceAddress.postalCode },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // ========================================
        // Шаг 4: Информация о занятости
        // ========================================
        {
          component: Step,
          componentProps: {
            title: 'Работа',
            icon: '💼',
          },
          children: [
            {
              component: Section,
              componentProps: {
                title: 'Информация о занятости',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
              },
              children: [
                // Статус занятости
                {
                  component: Box,
                  componentProps: {
                    className: 'space-y-4',
                  },
                  children: [{ component: path.employmentStatus }],
                },
                // Информация о работодателе (для employed)
                {
                  selector: 'employer-section',
                  component: Section,
                  componentProps: {
                    title: 'Информация о работодателе',
                    titleClassName: 'text-lg font-semibold mt-6',
                    className: 'space-y-4',
                  },
                  children: [
                    { component: path.companyName },
                    {
                      component: Box,
                      componentProps: {
                        className: 'grid grid-cols-2 gap-4',
                      },
                      children: [{ component: path.companyInn }, { component: path.companyPhone }],
                    },
                    { component: path.companyAddress },
                    // Должность и стаж
                    {
                      component: Section,
                      componentProps: {
                        title: 'Должность и стаж',
                        titleClassName: 'text-lg font-semibold mt-6',
                        className: 'space-y-4',
                      },
                      children: [
                        { component: path.position },
                        {
                          component: Box,
                          componentProps: {
                            className: 'grid grid-cols-2 gap-4',
                          },
                          children: [
                            { component: path.workExperienceTotal },
                            { component: path.workExperienceCurrent },
                          ],
                        },
                      ],
                    },
                  ],
                },
                // Информация о бизнесе (для selfEmployed)
                {
                  selector: 'business-section',
                  component: Section,
                  componentProps: {
                    title: 'Информация о бизнесе',
                    titleClassName: 'text-lg font-semibold mt-6',
                    className: 'space-y-4',
                  },
                  children: [
                    { component: path.businessType },
                    { component: path.businessInn },
                    { component: path.businessActivity },
                  ],
                },
                // Доход (показывается когда не unemployed)
                {
                  selector: 'income-section',
                  component: Section,
                  componentProps: {
                    title: 'Доход',
                    titleClassName: 'text-lg font-semibold mt-6',
                    className: 'space-y-4',
                  },
                  children: [
                    { component: path.monthlyIncome },
                    {
                      component: Box,
                      componentProps: {
                        className: 'grid grid-cols-2 gap-4',
                      },
                      children: [
                        { component: path.additionalIncome },
                        { component: path.additionalIncomeSource },
                      ],
                    },
                  ],
                },
                // Предупреждение для безработных
                {
                  selector: 'unemployed-warning',
                  component: UnemployedWarning,
                  componentProps: {
                    className: 'mt-6',
                  },
                },
              ],
            },
          ],
        },

        // ========================================
        // Шаг 5: Дополнительная информация
        // ========================================
        {
          component: Step,
          componentProps: {
            title: 'Доп. инфо',
            icon: '📋',
          },
          children: [
            {
              component: Section,
              componentProps: {
                title: 'Дополнительная информация',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
              },
              children: [
                // Общая информация
                {
                  component: Section,
                  componentProps: {
                    title: 'Общая информация',
                    titleClassName: 'text-lg font-semibold',
                    className: 'space-y-4',
                  },
                  children: [
                    { component: path.maritalStatus },
                    {
                      component: Box,
                      componentProps: {
                        className: 'grid grid-cols-2 gap-4',
                      },
                      children: [{ component: path.dependents }, { component: path.education }],
                    },
                  ],
                },
                // Имущество
                {
                  component: Section,
                  componentProps: {
                    className: 'space-y-4',
                  },
                  children: [
                    { component: path.hasProperty },
                    {
                      selector: 'properties-array',
                      component: RendererFormArraySection,
                      componentProps: {
                        title: 'Имущество',
                        array: path.properties,
                        itemLabel: (
                          _: FormProxy<CreditApplicationForm['properties'][0]>,
                          index: number
                        ) => `Имущество #${index + 1}`,
                        addButtonLabel: '+ Добавить имущество',
                        emptyMessage: 'Нажмите "Добавить имущество" для добавления информации',
                        itemComponent: (itemPath: FieldPath<Property>) => ({
                          component: Box,
                          componentProps: {
                            className: 'space-y-3',
                          },
                          children: [
                            { component: itemPath.type },
                            { component: itemPath.description },
                            { component: itemPath.estimatedValue },
                            { component: itemPath.hasEncumbrance },
                          ],
                        }),
                      },
                    },
                  ],
                },
                // Существующие кредиты
                {
                  component: Section,
                  componentProps: {
                    className: 'space-y-4',
                  },
                  children: [
                    { component: path.hasExistingLoans },
                    {
                      selector: 'existing-loans-array',
                      component: RendererFormArraySection,
                      componentProps: {
                        title: 'Существующие кредиты',
                        array: path.existingLoans,
                        itemLabel: (
                          _: FormProxy<CreditApplicationForm['existingLoans'][0]>,
                          index: number
                        ) => `Кредит #${index + 1}`,
                        addButtonLabel: '+ Добавить кредит',
                        emptyMessage: 'Нажмите "Добавить кредит" для добавления информации',
                        itemComponent: (itemPath: FieldPath<ExistingLoan>) => ({
                          component: Box,
                          componentProps: {
                            className: 'space-y-3',
                          },
                          children: [
                            { component: itemPath.bank },
                            { component: itemPath.type },
                            {
                              component: Box,
                              componentProps: {
                                className: 'grid grid-cols-2 gap-4',
                              },
                              children: [
                                { component: itemPath.amount },
                                { component: itemPath.remainingAmount },
                              ],
                            },
                            {
                              component: Box,
                              componentProps: {
                                className: 'grid grid-cols-2 gap-4',
                              },
                              children: [
                                { component: itemPath.monthlyPayment },
                                { component: itemPath.maturityDate },
                              ],
                            },
                          ],
                        }),
                      },
                    },
                  ],
                },
                // Созаёмщики
                {
                  component: Section,
                  componentProps: {
                    className: 'space-y-4',
                  },
                  children: [
                    { component: path.hasCoBorrower },
                    {
                      selector: 'co-borrowers-array',
                      component: RendererFormArraySection,
                      componentProps: {
                        title: 'Созаемщики',
                        array: path.coBorrowers,
                        itemLabel: (
                          _: FormProxy<CreditApplicationForm['coBorrowers'][0]>,
                          index: number
                        ) => `Созаемщик #${index + 1}`,
                        addButtonLabel: '+ Добавить созаемщика',
                        emptyMessage: 'Нажмите "Добавить созаемщика" для добавления информации',
                        emptyMessageHint:
                          'CoBorrowerForm поддерживает вложенную группу personalData',
                        itemComponent: (itemPath: FieldPath<CoBorrower>) => ({
                          component: Box,
                          componentProps: {
                            className: 'space-y-3',
                          },
                          children: [
                            {
                              component: Box,
                              componentProps: {
                                className: 'grid grid-cols-3 gap-4',
                              },
                              children: [
                                { component: itemPath.personalData.lastName },
                                { component: itemPath.personalData.firstName },
                                { component: itemPath.personalData.middleName },
                              ],
                            },
                            { component: itemPath.personalData.birthDate },
                            {
                              component: Box,
                              componentProps: {
                                className: 'grid grid-cols-2 gap-4',
                              },
                              children: [
                                { component: itemPath.phone },
                                { component: itemPath.email },
                              ],
                            },
                            {
                              component: Box,
                              componentProps: {
                                className: 'grid grid-cols-2 gap-4',
                              },
                              children: [
                                { component: itemPath.relationship },
                                { component: itemPath.monthlyIncome },
                              ],
                            },
                          ],
                        }),
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },

        // ========================================
        // Шаг 6: Подтверждение
        // ========================================
        {
          component: Step,
          componentProps: {
            title: 'Подтверждение',
            icon: '✓',
          },
          children: [
            {
              component: Section,
              componentProps: {
                title: 'Подтверждение и согласия',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
              },
              children: [
                // Информационные блоки
                {
                  component: Box,
                  componentProps: {
                    className: 'space-y-4',
                  },
                  children: [
                    { component: ConfirmationInfoBlock },
                    { component: HighPaymentWarning },
                  ],
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
                  },
                  children: [
                    { component: path.agreePersonalData },
                    { component: path.agreeCreditHistory },
                    { component: path.agreeTerms },
                    { component: path.confirmAccuracy },
                  ],
                },
                // Опциональные согласия
                {
                  component: Section,
                  componentProps: {
                    title: 'Опциональные согласия',
                    titleClassName: 'text-lg font-semibold mt-6',
                  },
                  children: [{ component: path.agreeMarketing }],
                },
                // Электронная подпись
                {
                  component: Section,
                  componentProps: {
                    title: 'Электронная подпись',
                    titleClassName: 'text-lg font-semibold mt-6',
                    className: 'space-y-4',
                  },
                  children: [
                    { component: path.electronicSignature },
                    { component: ElectronicSignatureHint },
                  ],
                },
                // Предупреждение
                { component: SubmitWarning },
                // Что будет дальше
                { component: NextStepsInfo },
              ],
            },
          ],
        },
      ] as unknown as RenderNode<CreditApplicationForm>[],
    },
  }));

  // TODO: Не очень нравится контракт
  createCreditApplicationRenderBehavior(form)(schema);

  return schema;
}
