import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, Input, InputNumber, Section, SelectAsync } from '@reformer/ui-kit';
import type { CreditApplicationForm } from '../../types/credit-application';

const CURRENT_YEAR = new Date().getFullYear();

/** Секция автокредита. Видимость — `behavior/conditions.ts`, по `selector`. */
export const carSection = (model: FormModel<CreditApplicationForm>): FormSchemaNode => ({
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
});
