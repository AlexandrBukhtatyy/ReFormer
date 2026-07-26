/**
 * Демо-схема для стартовой вкладки (Mode A) — чтобы оболочка сразу показывала осмысленную форму
 * в схематичном и Runtime-preview. Компактная, но использует Section/Select/Input/Checkbox +
 * `$dataSource` (мокается preview).
 *
 * @module reformer-builder/app/seed-schema
 */

import type { JsonFormSchema } from '@reformer/renderer-json';

export function seedSchema(): JsonFormSchema {
  return {
    $schema: './form-schema.schema.json',
    version: '1.0',
    root: {
      component: '$component(Box)',
      componentProps: { className: 'space-y-6' },
      children: [
        {
          component: '$component(Section)',
          componentProps: {
            title: 'Заявка на кредит',
            titleClassName: 'text-lg font-semibold',
            className: 'space-y-4',
          },
          children: [
            {
              value: '$model(loanType)',
              component: '$component(Select)',
              componentProps: {
                label: 'Тип кредита',
                placeholder: 'Выберите тип',
                options: '$dataSource(LOAN_TYPES)',
              },
            },
            {
              value: '$model(loanAmount)',
              component: '$component(Input)',
              componentProps: { label: 'Сумма кредита, ₽', type: 'number', placeholder: '0' },
            },
            {
              value: '$model(comment)',
              component: '$component(Textarea)',
              componentProps: { label: 'Комментарий', placeholder: 'Необязательно', rows: 3 },
            },
            {
              value: '$model(agree)',
              component: '$component(Checkbox)',
              componentProps: { label: 'Согласие на обработку персональных данных' },
            },
          ],
        },
      ],
    },
  };
}
