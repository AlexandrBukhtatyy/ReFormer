import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, Input, InputMask, Section, Textarea } from '@reformer/ui-kit';
import type { CreditApplicationForm } from '../../types/credit-application';

/** Секция «Паспортные данные». */
export const passportDataSection = (model: FormModel<CreditApplicationForm>): FormSchemaNode => ({
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
        {
          model: model.$.passportData.series,
          component: InputMask,
          componentProps: {
            label: 'Серия паспорта',
            placeholder: '00 00',
            mask: '99 99',
          },
        },
        {
          model: model.$.passportData.number,
          component: InputMask,
          componentProps: {
            label: 'Номер паспорта',
            placeholder: '000000',
            mask: '999999',
          },
        },
      ],
    },
    {
      model: model.$.passportData.issuedBy,
      component: Textarea,
      componentProps: {
        label: 'Кем выдан',
        placeholder: 'Введите наименование органа',
        rows: 3,
      },
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.passportData.issueDate,
          component: Input,
          componentProps: {
            label: 'Дата выдачи',
            type: 'date',
          },
        },
        {
          model: model.$.passportData.departmentCode,
          component: InputMask,
          componentProps: {
            label: 'Код подразделения',
            placeholder: '000-000',
            mask: '999-999',
          },
        },
      ],
    },
  ],
});
