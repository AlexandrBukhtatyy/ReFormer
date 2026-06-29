/**
 * Единая схема кредитной заявки (M1) для renderer-варианта.
 *
 * Одна схема — и форма, и рендер: лист несёт `value` (СИГНАЛ модели) + `component` + `componentProps`
 * (как в схеме формы), массив — узел `{ array: model.<path>, item }`. По этому дереву:
 *  - `createForm({ model, schema })` строит форму (harvest листьев по сигналу + материализация массивов);
 *  - `FormRenderer` рендерит то же дерево (лист резолвит ноду по сигналу через реестр).
 * Отдельная схема формы (m1/schema.ts) для renderer НЕ нужна — конфиг полей вшит сюда.
 *
 * Layout (Wizard/Step/Section/Box), селекторы (hideWhen/createRenderSchema) и render-поведение —
 * без изменений относительно legacy-варианта.
 */

import type { FormProxy, FormModel } from '@reformer/core';
import { createRenderSchema } from '@reformer/renderer-react';
import type { RenderNode } from '@reformer/renderer-react';
import { createCreditApplicationRenderBehavior } from './render-behavior';
import { Step } from '@reformer/cdk/form-wizard';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import { makeCreditValidationConfig } from '../complex-multy-step-form/schemas/m1/validation';
import {
  createBlankProperty,
  createBlankExistingLoan,
  createBlankCoBorrower,
} from '../complex-multy-step-form/schemas/m1/model';
import {
  LOAN_TYPES,
  EMPLOYMENT_STATUSES,
  MARITAL_STATUSES,
  EDUCATIONS,
  GENDERS,
  RELATIONSHIPS,
  EXISTING_LOAN_TYPES,
} from '../complex-multy-step-form/constants/credit-application';
import { RendererFormWizard } from '../../../components/RendererFormWizard';
import { ResidenceAddressSection } from '../complex-multy-step-form/components/ui/ResidenceAddressSection';
import { UnemployedWarning } from '../complex-multy-step-form/components/ui/UnemployedWarning';
import {
  ConfirmationInfoBlock,
  HighPaymentWarning,
  LoanSummarySection,
  ApplicantSummarySection,
  SubmitWarning,
  NextStepsInfo,
  ElectronicSignatureHint,
} from '../complex-multy-step-form/components/ui/ConfirmationComponents';
import {
  AsyncBoundary,
  Section,
  Box,
  ErrorState,
  LoadingState,
  Select,
  Checkbox,
  Input,
  InputMask,
  RadioGroup,
  Textarea,
} from '@reformer/ui-kit';
import { createElement } from 'react';

const ErrorStateDefault = () => createElement(ErrorState, { error: 'Не удалось загрузить заявку' });

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Лист единой схемы: значение из сигнала модели + UI-компонент + props. */
const f = (value: unknown, component: unknown, componentProps?: Record<string, unknown>) => ({
  value,
  component,
  ...(componentProps ? { componentProps } : {}),
});
const num = (props: Record<string, unknown>) => ({ type: 'number', ...props });

/**
 * Построить дерево единой схемы. `form` нужен только wizard-узлу (рендер); при сборке формы
 * (`createForm`) передаём дерево БЕЗ form, чтобы harvest не обходил FormProxy.
 */
export function buildCreditApplicationSchema(
  model: FormModel<CreditApplicationForm>,
  form?: FormProxy<CreditApplicationForm>
): RenderNode<CreditApplicationForm> {
  const m = model.$;
  return {
    selector: 'data-boundary',
    component: AsyncBoundary,
    componentProps: {
      status: 'loading', // render-behavior подставит loading | error | ready
      LoadingComponent: LoadingState,
      ErrorComponent: ErrorStateDefault,
    },
    children: [
      {
        selector: 'wizard',
        component: RendererFormWizard,
        componentProps: {
          ...(form ? { form } : {}),
          ...makeCreditValidationConfig(model),
          className: 'bg-white p-8 rounded-lg shadow-md',
          steps: [
            // ── Шаг 1: Основная информация ──────────────────────────────
            {
              component: Step,
              componentProps: { title: 'Кредит', icon: '💰' },
              children: [
                {
                  component: Box,
                  componentProps: { className: 'space-y-6' },
                  children: [
                    {
                      component: Section,
                      componentProps: {
                        title: 'Основная информация о кредите',
                        titleAs: 'h2',
                        titleClassName: 'text-xl font-bold',
                        className: 'space-y-6',
                      },
                      children: [
                        f(m.loanType, Select, {
                          label: 'Тип кредита',
                          placeholder: 'Выберите тип кредита',
                          options: LOAN_TYPES,
                        }),
                        f(
                          m.loanAmount,
                          Input,
                          num({
                            label: 'Сумма кредита (₽)',
                            placeholder: 'Введите сумму',
                            min: 50000,
                            max: 10000000,
                            step: 10000,
                          })
                        ),
                        f(
                          m.loanTerm,
                          Input,
                          num({
                            label: 'Срок кредита (месяцев)',
                            placeholder: 'Введите срок',
                            min: 6,
                            max: 240,
                          })
                        ),
                        f(m.loanPurpose, Textarea, {
                          label: 'Цель кредита',
                          placeholder: 'Опишите, на что планируете потратить средства',
                          rows: 4,
                          maxLength: 500,
                        }),
                      ],
                    },
                    {
                      selector: 'mortgage-section',
                      component: Section,
                      componentProps: {
                        title: 'Информация о недвижимости',
                        titleClassName: 'text-lg font-semibold mt-4',
                        className: 'space-y-4',
                      },
                      children: [
                        f(
                          m.propertyValue,
                          Input,
                          num({
                            label: 'Стоимость недвижимости (₽)',
                            placeholder: 'Введите стоимость',
                            min: 1000000,
                            step: 100000,
                          })
                        ),
                        f(
                          m.initialPayment,
                          Input,
                          num({
                            label: 'Первоначальный взнос (₽)',
                            placeholder: 'Введите сумму',
                            min: 0,
                            step: 10000,
                          })
                        ),
                      ],
                    },
                    {
                      selector: 'car-section',
                      component: Section,
                      componentProps: {
                        title: 'Информация об автомобиле',
                        titleClassName: 'text-lg font-semibold mt-4',
                        className: 'space-y-4',
                      },
                      children: [
                        f(m.carBrand, Input, {
                          label: 'Марка автомобиля',
                          placeholder: 'Например: Toyota',
                        }),
                        f(m.carModel, Select, {
                          label: 'Модель автомобиля',
                          placeholder: 'Например: Camry',
                        }),
                        {
                          component: Box,
                          componentProps: { className: 'grid grid-cols-2 gap-4' },
                          children: [
                            f(m.carYear, Input, num({ label: 'Год выпуска', placeholder: '2020' })),
                            f(
                              m.carPrice,
                              Input,
                              num({
                                label: 'Стоимость автомобиля (₽)',
                                placeholder: 'Введите стоимость',
                                min: 300000,
                                step: 10000,
                              })
                            ),
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },

            // ── Шаг 2: Персональные данные ──────────────────────────────
            {
              component: Step,
              componentProps: { title: 'Данные', icon: '👤' },
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
                          componentProps: { className: 'grid grid-cols-3 gap-4' },
                          children: [
                            f(m.personalData.lastName, Input, {
                              label: 'Фамилия',
                              placeholder: 'Введите фамилию',
                            }),
                            f(m.personalData.firstName, Input, {
                              label: 'Имя',
                              placeholder: 'Введите имя',
                            }),
                            f(m.personalData.middleName, Input, {
                              label: 'Отчество',
                              placeholder: 'Введите отчество',
                            }),
                          ],
                        },
                        {
                          component: Box,
                          componentProps: { className: 'grid grid-cols-2 gap-4' },
                          children: [
                            f(m.personalData.birthDate, Input, {
                              label: 'Дата рождения',
                              type: 'date',
                            }),
                            f(m.personalData.gender, RadioGroup, {
                              label: 'Пол',
                              options: GENDERS,
                            }),
                          ],
                        },
                        f(m.personalData.birthPlace, Input, {
                          label: 'Место рождения',
                          placeholder: 'Введите место рождения',
                        }),
                      ],
                    },
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
                          componentProps: { className: 'grid grid-cols-2 gap-4' },
                          children: [
                            f(m.passportData.series, InputMask, {
                              label: 'Серия паспорта',
                              placeholder: '00 00',
                              mask: '99 99',
                            }),
                            f(m.passportData.number, InputMask, {
                              label: 'Номер паспорта',
                              placeholder: '000000',
                              mask: '999999',
                            }),
                          ],
                        },
                        f(m.passportData.issuedBy, Textarea, {
                          label: 'Кем выдан',
                          placeholder: 'Введите наименование органа',
                          rows: 3,
                        }),
                        {
                          component: Box,
                          componentProps: { className: 'grid grid-cols-2 gap-4' },
                          children: [
                            f(m.passportData.issueDate, Input, {
                              label: 'Дата выдачи',
                              type: 'date',
                            }),
                            f(m.passportData.departmentCode, InputMask, {
                              label: 'Код подразделения',
                              placeholder: '000-000',
                              mask: '999-999',
                            }),
                          ],
                        },
                      ],
                    },
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
                          componentProps: { className: 'grid grid-cols-2 gap-4' },
                          children: [
                            f(m.inn, InputMask, {
                              label: 'ИНН',
                              placeholder: '123456789012',
                              mask: '999999999999',
                            }),
                            f(m.snils, InputMask, {
                              label: 'СНИЛС',
                              placeholder: '123-456-789 00',
                              mask: '999-999-999 99',
                            }),
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },

            // ── Шаг 3: Контактная информация ────────────────────────────
            {
              component: Step,
              componentProps: { title: 'Контакты', icon: '📞' },
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
                          componentProps: { className: 'grid grid-cols-2 gap-4' },
                          children: [
                            f(m.phoneMain, InputMask, {
                              label: 'Основной телефон',
                              placeholder: '+7 (___) ___-__-__',
                              mask: '+7 (999) 999-99-99',
                            }),
                            f(m.phoneAdditional, InputMask, {
                              label: 'Дополнительный телефон',
                              placeholder: '+7 (___) ___-__-__',
                              mask: '+7 (999) 999-99-99',
                            }),
                          ],
                        },
                        {
                          component: Box,
                          componentProps: { className: 'grid grid-cols-2 gap-4' },
                          children: [
                            f(m.email, Input, {
                              label: 'Email',
                              placeholder: 'example@mail.com',
                              type: 'email',
                            }),
                            f(m.emailAdditional, Input, {
                              label: 'Дополнительный email',
                              placeholder: 'example@mail.com',
                              type: 'email',
                            }),
                          ],
                        },
                      ],
                    },
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
                          componentProps: { className: 'grid grid-cols-2 gap-4' },
                          children: [
                            f(m.registrationAddress.region, Input, {
                              label: 'Регион',
                              placeholder: 'Введите регион',
                            }),
                            f(m.registrationAddress.city, Input, {
                              label: 'Город',
                              placeholder: 'Введите город',
                            }),
                          ],
                        },
                        f(m.registrationAddress.street, Input, {
                          label: 'Улица',
                          placeholder: 'Введите улицу',
                        }),
                        {
                          component: Box,
                          componentProps: { className: 'grid grid-cols-3 gap-4' },
                          children: [
                            f(m.registrationAddress.house, Input, {
                              label: 'Дом',
                              placeholder: '№',
                            }),
                            f(m.registrationAddress.apartment, Input, {
                              label: 'Квартира',
                              placeholder: '№',
                            }),
                            f(m.registrationAddress.postalCode, InputMask, {
                              label: 'Индекс',
                              placeholder: '000000',
                              mask: '999999',
                            }),
                          ],
                        },
                      ],
                    },
                    f(m.sameAsRegistration, Checkbox, {
                      label: 'Адрес проживания совпадает с адресом регистрации',
                    }),
                    {
                      selector: 'residence-address-section',
                      component: Box,
                      children: [
                        {
                          component: ResidenceAddressSection,
                          children: [
                            {
                              component: Box,
                              componentProps: { className: 'grid grid-cols-2 gap-4' },
                              children: [
                                f(m.residenceAddress.region, Input, {
                                  label: 'Регион',
                                  placeholder: 'Введите регион',
                                }),
                                f(m.residenceAddress.city, Input, {
                                  label: 'Город',
                                  placeholder: 'Введите город',
                                }),
                              ],
                            },
                            f(m.residenceAddress.street, Input, {
                              label: 'Улица',
                              placeholder: 'Введите улицу',
                            }),
                            {
                              component: Box,
                              componentProps: { className: 'grid grid-cols-3 gap-4' },
                              children: [
                                f(m.residenceAddress.house, Input, {
                                  label: 'Дом',
                                  placeholder: '№',
                                }),
                                f(m.residenceAddress.apartment, Input, {
                                  label: 'Квартира',
                                  placeholder: '№',
                                }),
                                f(m.residenceAddress.postalCode, InputMask, {
                                  label: 'Индекс',
                                  placeholder: '000000',
                                  mask: '999999',
                                }),
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

            // ── Шаг 4: Занятость ────────────────────────────────────────
            {
              component: Step,
              componentProps: { title: 'Работа', icon: '💼' },
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
                    {
                      component: Box,
                      componentProps: { className: 'space-y-4' },
                      children: [
                        f(m.employmentStatus, RadioGroup, {
                          label: 'Статус занятости',
                          options: EMPLOYMENT_STATUSES,
                        }),
                      ],
                    },
                    {
                      selector: 'employer-section',
                      component: Section,
                      componentProps: {
                        title: 'Информация о работодателе',
                        titleClassName: 'text-lg font-semibold mt-6',
                        className: 'space-y-4',
                      },
                      children: [
                        f(m.companyName, Input, {
                          label: 'Название компании',
                          placeholder: 'Введите название',
                        }),
                        {
                          component: Box,
                          componentProps: { className: 'grid grid-cols-2 gap-4' },
                          children: [
                            f(m.companyInn, InputMask, {
                              label: 'ИНН компании',
                              placeholder: '1234567890',
                              mask: '9999999999',
                            }),
                            f(m.companyPhone, InputMask, {
                              label: 'Телефон компании',
                              placeholder: '+7 (___) ___-__-__',
                              mask: '+7 (999) 999-99-99',
                            }),
                          ],
                        },
                        f(m.companyAddress, Input, {
                          label: 'Адрес компании',
                          placeholder: 'Полный адрес',
                        }),
                        {
                          component: Section,
                          componentProps: {
                            title: 'Должность и стаж',
                            titleClassName: 'text-lg font-semibold mt-6',
                            className: 'space-y-4',
                          },
                          children: [
                            f(m.position, Input, {
                              label: 'Должность',
                              placeholder: 'Ваша должность',
                            }),
                            {
                              component: Box,
                              componentProps: { className: 'grid grid-cols-2 gap-4' },
                              children: [
                                f(
                                  m.workExperienceTotal,
                                  Input,
                                  num({
                                    label: 'Общий стаж работы (месяцев)',
                                    placeholder: '0',
                                    min: 0,
                                  })
                                ),
                                f(
                                  m.workExperienceCurrent,
                                  Input,
                                  num({
                                    label: 'Стаж на текущем месте (месяцев)',
                                    placeholder: '0',
                                    min: 0,
                                  })
                                ),
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    {
                      selector: 'business-section',
                      component: Section,
                      componentProps: {
                        title: 'Информация о бизнесе',
                        titleClassName: 'text-lg font-semibold mt-6',
                        className: 'space-y-4',
                      },
                      children: [
                        f(m.businessType, Input, {
                          label: 'Тип бизнеса',
                          placeholder: 'ИП, ООО и т.д.',
                        }),
                        f(m.businessInn, InputMask, {
                          label: 'ИНН ИП',
                          placeholder: '123456789012',
                          mask: '999999999999',
                        }),
                        f(m.businessActivity, Textarea, {
                          label: 'Вид деятельности',
                          placeholder: 'Опишите вид деятельности',
                          rows: 3,
                        }),
                      ],
                    },
                    {
                      selector: 'income-section',
                      component: Section,
                      componentProps: {
                        title: 'Доход',
                        titleClassName: 'text-lg font-semibold mt-6',
                        className: 'space-y-4',
                      },
                      children: [
                        f(
                          m.monthlyIncome,
                          Input,
                          num({
                            label: 'Ежемесячный доход (₽)',
                            placeholder: '0',
                            min: 10000,
                            step: 1000,
                          })
                        ),
                        {
                          component: Box,
                          componentProps: { className: 'grid grid-cols-2 gap-4' },
                          children: [
                            f(
                              m.additionalIncome,
                              Input,
                              num({
                                label: 'Дополнительный доход (₽)',
                                placeholder: '0',
                                min: 0,
                                step: 1000,
                              })
                            ),
                            f(m.additionalIncomeSource, Input, {
                              label: 'Источник дополнительного дохода',
                              placeholder: 'Опишите источник',
                            }),
                          ],
                        },
                      ],
                    },
                    {
                      selector: 'unemployed-warning',
                      component: UnemployedWarning,
                      componentProps: { className: 'mt-6' },
                    },
                  ],
                },
              ],
            },

            // ── Шаг 5: Дополнительная информация ────────────────────────
            {
              component: Step,
              componentProps: { title: 'Доп. инфо', icon: '📋' },
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
                    {
                      component: Section,
                      componentProps: {
                        title: 'Общая информация',
                        titleClassName: 'text-lg font-semibold',
                        className: 'space-y-4',
                      },
                      children: [
                        f(m.maritalStatus, RadioGroup, {
                          label: 'Семейное положение',
                          options: MARITAL_STATUSES,
                        }),
                        {
                          component: Box,
                          componentProps: { className: 'grid grid-cols-2 gap-4' },
                          children: [
                            f(
                              m.dependents,
                              Input,
                              num({
                                label: 'Количество иждивенцев',
                                placeholder: '0',
                                min: 0,
                                max: 10,
                              })
                            ),
                            f(m.education, Select, {
                              label: 'Образование',
                              placeholder: 'Выберите уровень образования',
                              options: EDUCATIONS,
                            }),
                          ],
                        },
                      ],
                    },
                    // Имущество
                    {
                      component: Section,
                      componentProps: { className: 'space-y-4' },
                      children: [
                        f(m.hasProperty, Checkbox, { label: 'У меня есть имущество' }),
                        {
                          selector: 'properties-array',
                          array: model.properties,
                          initialValue: createBlankProperty,
                          componentProps: {
                            title: 'Имущество',
                            itemLabel: 'Имущество',
                            addButtonLabel: '+ Добавить имущество',
                            emptyMessage: 'Нажмите "Добавить имущество" для добавления информации',
                          },
                          item: (im: any) => ({
                            component: Box,
                            componentProps: { className: 'space-y-3' },
                            children: [
                              f(im.$.type, Select, {
                                label: 'Тип имущества',
                                placeholder: 'Выберите тип',
                                testId: 'property-type',
                                options: [
                                  { value: 'apartment', label: 'Квартира' },
                                  { value: 'house', label: 'Дом' },
                                  { value: 'land', label: 'Земельный участок' },
                                  { value: 'commercial', label: 'Коммерческая недвижимость' },
                                  { value: 'car', label: 'Автомобиль' },
                                  { value: 'other', label: 'Другое' },
                                ],
                              }),
                              f(im.$.description, Textarea, {
                                label: 'Описание',
                                placeholder: 'Опишите имущество',
                                rows: 2,
                                testId: 'property-description',
                              }),
                              f(
                                im.$.estimatedValue,
                                Input,
                                num({
                                  label: 'Оценочная стоимость',
                                  placeholder: '0',
                                  min: 0,
                                  step: 1000,
                                  testId: 'property-estimatedValue',
                                })
                              ),
                              f(im.$.hasEncumbrance, Checkbox, {
                                label: 'Имеется обременение (залог)',
                                testId: 'property-hasEncumbrance',
                              }),
                            ],
                          }),
                        },
                      ],
                    },
                    // Существующие кредиты
                    {
                      component: Section,
                      componentProps: { className: 'space-y-4' },
                      children: [
                        f(m.hasExistingLoans, Checkbox, { label: 'У меня есть другие кредиты' }),
                        {
                          selector: 'existing-loans-array',
                          array: model.existingLoans,
                          initialValue: createBlankExistingLoan,
                          componentProps: {
                            title: 'Существующие кредиты',
                            itemLabel: 'Кредит',
                            addButtonLabel: '+ Добавить кредит',
                            emptyMessage: 'Нажмите "Добавить кредит" для добавления информации',
                          },
                          item: (im: any) => ({
                            component: Box,
                            componentProps: { className: 'space-y-3' },
                            children: [
                              f(im.$.bank, Input, {
                                label: 'Банк',
                                placeholder: 'Название банка',
                                testId: 'existingLoan-bank',
                              }),
                              f(im.$.type, Select, {
                                label: 'Тип кредита',
                                placeholder: 'Выберите тип',
                                options: EXISTING_LOAN_TYPES,
                                testId: 'existingLoan-type',
                              }),
                              {
                                component: Box,
                                componentProps: { className: 'grid grid-cols-2 gap-4' },
                                children: [
                                  f(
                                    im.$.amount,
                                    Input,
                                    num({
                                      label: 'Сумма кредита (₽)',
                                      placeholder: '0',
                                      min: 0,
                                      step: 1000,
                                      testId: 'existingLoan-amount',
                                    })
                                  ),
                                  f(
                                    im.$.remainingAmount,
                                    Input,
                                    num({
                                      label: 'Остаток долга (₽)',
                                      placeholder: '0',
                                      min: 0,
                                      step: 1000,
                                      testId: 'existingLoan-remainingAmount',
                                    })
                                  ),
                                ],
                              },
                              {
                                component: Box,
                                componentProps: { className: 'grid grid-cols-2 gap-4' },
                                children: [
                                  f(
                                    im.$.monthlyPayment,
                                    Input,
                                    num({
                                      label: 'Ежемесячный платеж (₽)',
                                      placeholder: '0',
                                      min: 0,
                                      step: 100,
                                      testId: 'existingLoan-monthlyPayment',
                                    })
                                  ),
                                  f(im.$.maturityDate, Input, {
                                    label: 'Дата погашения',
                                    type: 'date',
                                    testId: 'existingLoan-maturityDate',
                                  }),
                                ],
                              },
                            ],
                          }),
                        },
                      ],
                    },
                    // Созаёмщики
                    {
                      component: Section,
                      componentProps: { className: 'space-y-4' },
                      children: [
                        f(m.hasCoBorrower, Checkbox, { label: 'Добавить созаемщика' }),
                        {
                          selector: 'co-borrowers-array',
                          array: model.coBorrowers,
                          initialValue: createBlankCoBorrower,
                          componentProps: {
                            title: 'Созаемщики',
                            itemLabel: 'Созаемщик',
                            addButtonLabel: '+ Добавить созаемщика',
                            emptyMessage: 'Нажмите "Добавить созаемщика" для добавления информации',
                          },
                          item: (im: any) => ({
                            component: Box,
                            componentProps: { className: 'space-y-3' },
                            children: [
                              {
                                component: Box,
                                componentProps: { className: 'grid grid-cols-3 gap-4' },
                                children: [
                                  f(im.$.personalData.lastName, Input, {
                                    label: 'Фамилия',
                                    placeholder: 'Введите фамилию',
                                    testId: 'coBorrower-lastName',
                                  }),
                                  f(im.$.personalData.firstName, Input, {
                                    label: 'Имя',
                                    placeholder: 'Введите имя',
                                    testId: 'coBorrower-firstName',
                                  }),
                                  f(im.$.personalData.middleName, Input, {
                                    label: 'Отчество',
                                    placeholder: 'Введите отчество',
                                    testId: 'coBorrower-middleName',
                                  }),
                                ],
                              },
                              f(im.$.personalData.birthDate, Input, {
                                label: 'Дата рождения',
                                type: 'date',
                                testId: 'coBorrower-birthDate',
                              }),
                              {
                                component: Box,
                                componentProps: { className: 'grid grid-cols-2 gap-4' },
                                children: [
                                  f(im.$.phone, InputMask, {
                                    label: 'Телефон',
                                    placeholder: '+7 (___) ___-__-__',
                                    mask: '+7 (999) 999-99-99',
                                    testId: 'coBorrower-phone',
                                  }),
                                  f(im.$.email, Input, {
                                    label: 'Email',
                                    placeholder: 'example@mail.com',
                                    type: 'email',
                                    testId: 'coBorrower-email',
                                  }),
                                ],
                              },
                              {
                                component: Box,
                                componentProps: { className: 'grid grid-cols-2 gap-4' },
                                children: [
                                  f(im.$.relationship, Select, {
                                    label: 'Отношение к заемщику',
                                    placeholder: 'Выберите отношение',
                                    options: RELATIONSHIPS,
                                    testId: 'coBorrower-relationship',
                                  }),
                                  f(
                                    im.$.monthlyIncome,
                                    Input,
                                    num({
                                      label: 'Ежемесячный доход (₽)',
                                      placeholder: '0',
                                      min: 0,
                                      step: 1000,
                                      testId: 'coBorrower-monthlyIncome',
                                    })
                                  ),
                                ],
                              },
                            ],
                          }),
                        },
                      ],
                    },
                  ],
                },
              ],
            },

            // ── Шаг 6: Подтверждение ────────────────────────────────────
            {
              component: Step,
              componentProps: { title: 'Подтверждение', icon: '✓' },
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
                    {
                      component: Box,
                      componentProps: { className: 'space-y-4' },
                      children: [
                        { component: ConfirmationInfoBlock },
                        { component: HighPaymentWarning },
                      ],
                    },
                    { component: LoanSummarySection },
                    { component: ApplicantSummarySection },
                    {
                      component: Section,
                      componentProps: {
                        title: 'Обязательные согласия',
                        titleClassName: 'text-lg font-semibold',
                        className: 'space-y-3',
                      },
                      children: [
                        f(m.agreePersonalData, Checkbox, {
                          label: 'Согласие на обработку персональных данных',
                        }),
                        f(m.agreeCreditHistory, Checkbox, {
                          label: 'Согласие на проверку кредитной истории',
                        }),
                        f(m.agreeTerms, Checkbox, { label: 'Согласие с условиями кредитования' }),
                        f(m.confirmAccuracy, Checkbox, {
                          label: 'Подтверждаю точность введенных данных',
                        }),
                      ],
                    },
                    {
                      component: Section,
                      componentProps: {
                        title: 'Опциональные согласия',
                        titleClassName: 'text-lg font-semibold mt-6',
                      },
                      children: [
                        f(m.agreeMarketing, Checkbox, {
                          label: 'Согласие на получение маркетинговых материалов',
                        }),
                      ],
                    },
                    {
                      component: Section,
                      componentProps: {
                        title: 'Электронная подпись',
                        titleClassName: 'text-lg font-semibold mt-6',
                        className: 'space-y-4',
                      },
                      children: [
                        f(m.electronicSignature, InputMask, {
                          label: 'Код подтверждения из СМС',
                          placeholder: '123456',
                          mask: '999999',
                        }),
                        { component: ElectronicSignatureHint },
                      ],
                    },
                    { component: SubmitWarning },
                    { component: NextStepsInfo },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
  } as unknown as RenderNode<CreditApplicationForm>;
}

/**
 * RenderSchemaProxy для FormRenderer + применённое render-поведение.
 * Форма (для wizard-узла) уже создана из этой же схемы — см. компонент-страницу.
 */
export function createCreditApplicationRenderSchema(
  model: FormModel<CreditApplicationForm>,
  form: FormProxy<CreditApplicationForm>
) {
  const schema = createRenderSchema<CreditApplicationForm>(() =>
    buildCreditApplicationSchema(model, form)
  );
  createCreditApplicationRenderBehavior(form)(schema);
  return schema;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
