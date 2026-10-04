/**
 * Шаг «Кредит» кредитной заявки. `selector` шага — ключ его правил в `form.validation.ts`.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import {
  Box,
  Input,
  InputMask,
  InputNumber,
  Section,
  SelectAsync,
  Textarea,
} from '@reformer/ui-kit';
import { LOAN_TYPES } from '../../constants/credit-application';
import type { CreditApplicationForm } from '../../types/credit-application';

const CURRENT_YEAR = new Date().getFullYear();

export const loanStep = (model: FormModel<CreditApplicationForm>): FormSchemaNode => ({
  selector: 'loan',
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
            {
              model: model.$.loanType,
              component: SelectAsync,
              componentProps: {
                label: 'Тип кредита',
                placeholder: 'Выберите тип кредита',
                options: LOAN_TYPES,
              },
            },
            {
              model: model.$.loanAmount,
              component: InputNumber,
              componentProps: {
                label: 'Сумма кредита (₽)',
                placeholder: 'Введите сумму',
                min: 50000,
                max: 10000000,
                step: 10000,
              },
            },
            {
              model: model.$.loanTerm,
              component: InputNumber,
              componentProps: {
                label: 'Срок кредита (месяцев)',
                placeholder: 'Введите срок',
                min: 6,
                max: 240,
              },
            },
            {
              model: model.$.loanPurpose,
              component: Textarea,
              componentProps: {
                label: 'Цель кредита',
                placeholder: 'Опишите, на что планируете потратить средства',
                rows: 4,
                maxLength: 500,
              },
            },
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
            {
              model: model.$.propertyValue,
              component: InputNumber,
              componentProps: {
                label: 'Стоимость недвижимости (₽)',
                placeholder: 'Введите стоимость',
                min: 1000000,
                step: 100000,
              },
            },
            {
              model: model.$.initialPayment,
              component: InputNumber,
              componentProps: {
                label: 'Первоначальный взнос (₽)',
                placeholder: 'Введите сумму',
                min: 0,
                step: 10000,
              },
            },
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
            {
              model: model.$.carBrand,
              component: Input,
              componentProps: {
                label: 'Марка автомобиля',
                placeholder: 'Например: Toyota',
              },
            },
            {
              model: model.$.carModel,
              component: SelectAsync,
              componentProps: {
                label: 'Модель автомобиля',
                placeholder: 'Например: Camry',
              },
            },
            {
              component: Box,
              componentProps: { className: 'grid grid-cols-2 gap-4' },
              children: [
                {
                  model: model.$.carYear,
                  component: InputNumber,
                  componentProps: {
                    label: 'Год выпуска',
                    placeholder: '2020',
                    min: 2000,
                    max: CURRENT_YEAR + 1,
                  },
                },
                {
                  model: model.$.carPrice,
                  component: InputNumber,
                  componentProps: {
                    label: 'Стоимость автомобиля (₽)',
                    placeholder: 'Введите стоимость',
                    min: 300000,
                    step: 10000,
                  },
                },
              ],
            },
          ],
        },
        {
          selector: 'loan-business-section',
          component: Section,
          componentProps: {
            title: 'Информация о бизнесе',
            titleClassName: 'text-lg font-semibold mt-4',
            className: 'space-y-4',
          },
          children: [
            {
              model: model.$.businessType,
              component: Input,
              componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
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
      ],
    },
  ],
});
