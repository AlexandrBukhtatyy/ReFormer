import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, Input, InputMask } from '@reformer/ui-kit';
import type { Address } from '../../components/nested-forms/Address/types';

/** Подформа адреса: объявлена один раз, стоит в схеме дважды — регистрация и проживание. */
export const addressPart = (model: FormModel<Address>): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'space-y-4' },
  children: [
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.region,
          component: Input,
          componentProps: {
            label: 'Регион',
            placeholder: 'Введите регион',
          },
        },
        {
          model: model.$.city,
          component: Input,
          componentProps: {
            label: 'Город',
            placeholder: 'Введите город',
          },
        },
      ],
    },
    {
      model: model.$.street,
      component: Input,
      componentProps: {
        label: 'Улица',
        placeholder: 'Введите улицу',
      },
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-3 gap-4' },
      children: [
        {
          model: model.$.house,
          component: Input,
          componentProps: {
            label: 'Дом',
            placeholder: '№',
          },
        },
        {
          model: model.$.apartment,
          component: Input,
          componentProps: {
            label: 'Квартира',
            placeholder: '№',
          },
        },
        {
          model: model.$.postalCode,
          component: InputMask,
          componentProps: {
            label: 'Индекс',
            placeholder: '000000',
            mask: '999999',
          },
        },
      ],
    },
  ],
});
