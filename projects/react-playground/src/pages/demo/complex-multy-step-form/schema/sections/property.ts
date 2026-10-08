import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, CheckboxWithLabel, InputNumber, SelectAsync, Textarea } from '@reformer/ui-kit';
import type { Property } from '../../components/nested-forms/Property/types';

/** Строка массива имущества: пути — от строки. Шаблон новой строки объявлен в модели. */
export const propertyRow = (model: FormModel<Property>): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'space-y-3' },
  children: [
    {
      model: model.$.type,
      component: SelectAsync,
      componentProps: {
        label: 'Тип имущества',
        placeholder: 'Выберите тип',
        testId: 'property-type',
        options: [
          { value: 'apartment', label: 'Квартира' },
          { value: 'house', label: 'Дом' },
          { value: 'land', label: 'Земельный участок' },
          { value: 'commercial', label: 'Коммерческая недвижимость' },
          { value: 'car', label: 'Автомобиль' },
          { value: 'other', label: 'Другое' },
        ],
      },
    },
    {
      model: model.$.description,
      component: Textarea,
      componentProps: {
        label: 'Описание',
        placeholder: 'Опишите имущество',
        rows: 2,
        testId: 'property-description',
      },
    },
    {
      model: model.$.estimatedValue,
      component: InputNumber,
      componentProps: {
        label: 'Оценочная стоимость',
        placeholder: '0',
        min: 0,
        step: 1000,
        testId: 'property-estimatedValue',
      },
    },
    {
      model: model.$.hasEncumbrance,
      component: CheckboxWithLabel,
      componentProps: {
        label: 'Имеется обременение (залог)',
        testId: 'property-hasEncumbrance',
      },
    },
  ],
});
