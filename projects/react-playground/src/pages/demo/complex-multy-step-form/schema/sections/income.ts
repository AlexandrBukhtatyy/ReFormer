import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, Input, InputNumber, Section } from '@reformer/ui-kit';
import type { CreditApplicationForm } from '../../types/credit-application';

/** Секция дохода. Видимость — `behavior/conditions.ts`. */
export const incomeSection = (model: FormModel<CreditApplicationForm>): FormSchemaNode => ({
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
});
