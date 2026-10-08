import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, Input, InputNumber, SelectAsync } from '@reformer/ui-kit';
import { EXISTING_LOAN_TYPES } from '../../constants/credit-application';
import type { ExistingLoan } from '../../components/nested-forms/ExistingLoan/types';

/** Строка массива кредитов: пути — от строки. Шаблон новой строки объявлен в модели. */
export const existingLoanRow = (model: FormModel<ExistingLoan>): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'space-y-3' },
  children: [
    {
      model: model.$.bank,
      component: Input,
      componentProps: {
        label: 'Банк',
        placeholder: 'Название банка',
        testId: 'existingLoan-bank',
      },
    },
    {
      model: model.$.type,
      component: SelectAsync,
      componentProps: {
        label: 'Тип кредита',
        placeholder: 'Выберите тип',
        options: EXISTING_LOAN_TYPES,
        testId: 'existingLoan-type',
      },
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.amount,
          component: InputNumber,
          componentProps: {
            label: 'Сумма кредита (₽)',
            placeholder: '0',
            min: 0,
            step: 1000,
            testId: 'existingLoan-amount',
          },
        },
        {
          model: model.$.remainingAmount,
          component: InputNumber,
          componentProps: {
            label: 'Остаток долга (₽)',
            placeholder: '0',
            min: 0,
            step: 1000,
            testId: 'existingLoan-remainingAmount',
          },
        },
      ],
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.monthlyPayment,
          component: InputNumber,
          componentProps: {
            label: 'Ежемесячный платеж (₽)',
            placeholder: '0',
            min: 0,
            step: 100,
            testId: 'existingLoan-monthlyPayment',
          },
        },
        {
          model: model.$.maturityDate,
          component: Input,
          componentProps: {
            label: 'Дата погашения',
            type: 'date',
            testId: 'existingLoan-maturityDate',
          },
        },
      ],
    },
  ],
});
