/**
 * Шаг «Данные» кредитной заявки. `selector` шага — ключ его правил в `form.validation.ts`.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import { Box, Input, InputMask, RadioGroupOptions, Section, Textarea } from '@reformer/ui-kit';
import { GENDERS } from '../../constants/credit-application';
import type { CreditApplicationForm } from '../../types/credit-application';

export const applicantStep = (model: FormModel<CreditApplicationForm>): FormSchemaNode => ({
  selector: 'applicant',
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
                {
                  model: model.$.inn,
                  component: InputMask,
                  componentProps: {
                    label: 'ИНН',
                    placeholder: '123456789012',
                    mask: '999999999999',
                  },
                },
                {
                  model: model.$.snils,
                  component: InputMask,
                  componentProps: {
                    label: 'СНИЛС',
                    placeholder: '123-456-789 00',
                    mask: '999-999-999 99',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});
