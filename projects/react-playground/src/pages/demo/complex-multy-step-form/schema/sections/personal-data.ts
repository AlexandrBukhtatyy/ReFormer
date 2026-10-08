import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, Input, RadioGroupOptions, Section } from '@reformer/ui-kit';
import { GENDERS } from '../../constants/credit-application';
import type { CreditApplicationForm } from '../../types/credit-application';

/** Секция «Личные данные». */
export const personalDataSection = (model: FormModel<CreditApplicationForm>): FormSchemaNode => ({
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
        {
          model: model.$.personalData.lastName,
          component: Input,
          componentProps: {
            label: 'Фамилия',
            placeholder: 'Введите фамилию',
          },
        },
        {
          model: model.$.personalData.firstName,
          component: Input,
          componentProps: {
            label: 'Имя',
            placeholder: 'Введите имя',
          },
        },
        {
          model: model.$.personalData.middleName,
          component: Input,
          componentProps: {
            label: 'Отчество',
            placeholder: 'Введите отчество',
          },
        },
      ],
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.personalData.birthDate,
          component: Input,
          componentProps: {
            label: 'Дата рождения',
            type: 'date',
          },
        },
        {
          model: model.$.personalData.gender,
          component: RadioGroupOptions,
          componentProps: {
            label: 'Пол',
            options: GENDERS,
          },
        },
      ],
    },
    {
      model: model.$.personalData.birthPlace,
      component: Input,
      componentProps: {
        label: 'Место рождения',
        placeholder: 'Введите место рождения',
      },
    },
  ],
});
