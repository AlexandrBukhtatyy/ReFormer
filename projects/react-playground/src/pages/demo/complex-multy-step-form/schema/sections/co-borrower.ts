import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, Input, InputMask, InputNumber, SelectAsync } from '@reformer/ui-kit';
import { RELATIONSHIPS } from '../../constants/credit-application';
import type { CoBorrower } from '../../components/nested-forms/CoBorrower/types';

/** Строка массива созаёмщиков: пути — от строки. Шаблон новой строки объявлен в модели. */
export const coBorrowerRow = (model: FormModel<CoBorrower>): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'space-y-3' },
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
            testId: 'coBorrower-lastName',
          },
        },
        {
          model: model.$.personalData.firstName,
          component: Input,
          componentProps: {
            label: 'Имя',
            placeholder: 'Введите имя',
            testId: 'coBorrower-firstName',
          },
        },
        {
          model: model.$.personalData.middleName,
          component: Input,
          componentProps: {
            label: 'Отчество',
            placeholder: 'Введите отчество',
            testId: 'coBorrower-middleName',
          },
        },
      ],
    },
    {
      model: model.$.personalData.birthDate,
      component: Input,
      componentProps: {
        label: 'Дата рождения',
        type: 'date',
        testId: 'coBorrower-birthDate',
      },
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.phone,
          component: InputMask,
          componentProps: {
            label: 'Телефон',
            placeholder: '+7 (___) ___-__-__',
            mask: '+7 (999) 999-99-99',
            testId: 'coBorrower-phone',
          },
        },
        {
          model: model.$.email,
          component: Input,
          componentProps: {
            label: 'Email',
            placeholder: 'example@mail.com',
            type: 'email',
            testId: 'coBorrower-email',
          },
        },
      ],
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.relationship,
          component: SelectAsync,
          componentProps: {
            label: 'Отношение к заемщику',
            placeholder: 'Выберите отношение',
            options: RELATIONSHIPS,
            testId: 'coBorrower-relationship',
          },
        },
        {
          model: model.$.monthlyIncome,
          component: InputNumber,
          componentProps: {
            label: 'Ежемесячный доход (₽)',
            placeholder: '0',
            min: 0,
            step: 1000,
            testId: 'coBorrower-monthlyIncome',
          },
        },
      ],
    },
  ],
});
