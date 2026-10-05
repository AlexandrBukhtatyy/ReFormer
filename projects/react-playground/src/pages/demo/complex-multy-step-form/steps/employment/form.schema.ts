/**
 * Шаг «Работа» кредитной заявки. `selector` шага — ключ его правил в `form.validation.ts`.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import {
  Box,
  Input,
  InputMask,
  InputNumber,
  RadioGroupOptions,
  Section,
  Textarea,
} from '@reformer/ui-kit';
import { EMPLOYMENT_STATUSES } from '../../constants/credit-application';
import type { CreditApplicationForm } from '../../types/credit-application';
import { UnemployedWarning } from '../../components/ui/UnemployedWarning';

export const employmentStep = (model: FormModel<CreditApplicationForm>): FormSchemaNode => ({
  selector: 'employment',
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
            {
              model: model.$.employmentStatus,
              component: RadioGroupOptions,
              componentProps: {
                label: 'Статус занятости',
                options: EMPLOYMENT_STATUSES,
              },
            },
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
            {
              model: model.$.companyName,
              component: Input,
              componentProps: {
                label: 'Название компании',
                placeholder: 'Введите название',
              },
            },
            {
              component: Box,
              componentProps: { className: 'grid grid-cols-2 gap-4' },
              children: [
                {
                  model: model.$.companyInn,
                  component: InputMask,
                  componentProps: {
                    label: 'ИНН компании',
                    placeholder: '1234567890',
                    mask: '9999999999',
                  },
                },
                {
                  model: model.$.companyPhone,
                  component: InputMask,
                  componentProps: {
                    label: 'Телефон компании',
                    placeholder: '+7 (___) ___-__-__',
                    mask: '+7 (999) 999-99-99',
                  },
                },
              ],
            },
            {
              model: model.$.companyAddress,
              component: Input,
              componentProps: {
                label: 'Адрес компании',
                placeholder: 'Полный адрес',
              },
            },
            {
              component: Section,
              componentProps: {
                title: 'Должность и стаж',
                titleClassName: 'text-lg font-semibold mt-6',
                className: 'space-y-4',
              },
              children: [
                {
                  model: model.$.position,
                  component: Input,
                  componentProps: {
                    label: 'Должность',
                    placeholder: 'Ваша должность',
                  },
                },
                {
                  component: Box,
                  componentProps: { className: 'grid grid-cols-2 gap-4' },
                  children: [
                    {
                      model: model.$.workExperienceTotal,
                      component: InputNumber,
                      componentProps: {
                        label: 'Общий стаж работы (месяцев)',
                        placeholder: '0',
                        min: 0,
                      },
                    },
                    {
                      model: model.$.workExperienceCurrent,
                      component: InputNumber,
                      componentProps: {
                        label: 'Стаж на текущем месте (месяцев)',
                        placeholder: '0',
                        min: 0,
                      },
                    },
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
            {
              model: model.$.businessType,
              component: Input,
              componentProps: {
                label: 'Тип бизнеса',
                placeholder: 'ИП, ООО и т.д.',
              },
            },
            {
              model: model.$.businessInn,
              component: InputMask,
              componentProps: {
                label: 'ИНН ИП',
                placeholder: '123456789012',
                mask: '999999999999',
              },
            },
            {
              model: model.$.businessActivity,
              component: Textarea,
              componentProps: {
                label: 'Вид деятельности',
                placeholder: 'Опишите вид деятельности',
                rows: 3,
              },
            },
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
            {
              model: model.$.monthlyIncome,
              component: InputNumber,
              componentProps: {
                label: 'Ежемесячный доход (₽)',
                placeholder: '0',
                min: 10000,
                step: 1000,
              },
            },
            {
              component: Box,
              componentProps: { className: 'grid grid-cols-2 gap-4' },
              children: [
                {
                  model: model.$.additionalIncome,
                  component: InputNumber,
                  componentProps: {
                    label: 'Дополнительный доход (₽)',
                    placeholder: '0',
                    min: 0,
                    step: 1000,
                  },
                },
                {
                  model: model.$.additionalIncomeSource,
                  component: Input,
                  componentProps: {
                    label: 'Источник дополнительного дохода',
                    placeholder: 'Опишите источник',
                  },
                },
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
});
