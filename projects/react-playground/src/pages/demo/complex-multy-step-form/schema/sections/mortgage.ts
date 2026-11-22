import type { FormModel, FormSchemaNode } from '@reformer/core';
import { InputNumber, Section } from '@reformer/ui-kit';
import type { CreditApplicationForm } from '../../types/credit-application';

/** Секция ипотеки. Видимость — `behavior/conditions.ts`, по `selector`. */
export const mortgageSection = (model: FormModel<CreditApplicationForm>): FormSchemaNode => ({
  selector: 'mortgage-section',
  component: Section,
  componentProps: {
    title: 'Информация о недвижимости',
    titleClassName: 'text-lg font-semibold mt-4',
    className: 'space-y-4',
  },
  children: [
    {
      model: model.$.propertyValue,
      component: InputNumber,
      componentProps: {
        label: 'Стоимость недвижимости (₽)',
        placeholder: 'Введите стоимость',
        min: 1000000,
        step: 100000,
      },
    },
    {
      model: model.$.initialPayment,
      component: InputNumber,
      componentProps: {
        label: 'Первоначальный взнос (₽)',
        placeholder: 'Введите сумму',
        min: 0,
        step: 10000,
      },
    },
  ],
});
