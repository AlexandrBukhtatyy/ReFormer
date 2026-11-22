import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, Input, InputMask, InputNumber, Section } from '@reformer/ui-kit';
import type { CreditApplicationForm } from '../../types/credit-application';

/** Секция работодателя с должностью и стажем. Видимость — `behavior/conditions.ts`. */
export const employerSection = (model: FormModel<CreditApplicationForm>): FormSchemaNode => ({
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
});
