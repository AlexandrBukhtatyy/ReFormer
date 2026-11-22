/**
 * Содержимое шага «Кредит». Заголовок, значок и `selector` шага — в потоке заявки.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, InputNumber, Section, SelectAsync, Textarea } from '@reformer/ui-kit';
import { LOAN_TYPES } from '../../constants/credit-application';
import type { CreditApplicationForm } from '../../types/credit-application';
import { mortgageSection } from '../sections/mortgage';
import { carSection } from '../sections/car';
import { businessSection } from '../sections/business';

export const loanStep = (model: FormModel<CreditApplicationForm>): FormSchemaNode[] => [
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
      mortgageSection(model),
      carSection(model),
      businessSection(model, {
        selector: 'loan-business-section',
        titleClassName: 'text-lg font-semibold mt-4',
      }),
    ],
  },
];
