/**
 * Представительная форма билдера для тестов кодогена: Div → Section (поля) + FormArray.
 *
 * Вынесена из `codegen.test.ts`, потому что её просит и `example-compiles.test.ts`: две копии
 * одной формы разошлись бы на первой же правке, и тест, который «всё ещё зелёный», проверял бы
 * уже не то, что проверяет соседний.
 *
 * @module reformer-builder/codegen/__fixtures__/example-schema
 */

import type { JsonFormSchema } from '@reformer/renderer-json';

export const exampleSchema = {
  version: '1.0',
  root: {
    component: '$html(div)',
    componentProps: { className: 'space-y-4' },
    children: [
      {
        component: '$component(Section)',
        componentProps: { title: 'Заявка' },
        children: [
          {
            value: '$model(loanType)',
            component: '$component(Select)',
            componentProps: { label: 'Тип', options: '$dataSource(LOAN_TYPES)', required: true },
          },
          {
            value: '$model(amount)',
            component: '$component(Input)',
            componentProps: { label: 'Сумма', type: 'number' },
          },
          {
            value: '$model(agree)',
            component: '$component(Checkbox)',
            componentProps: { label: 'Согласен', required: true },
          },
        ],
      },
      {
        array: '$model(items)',
        initialValue: { name: '' },
        componentProps: { title: 'Позиции', itemLabel: '$dataSource(ITEM_LABEL)' },
        item: {
          $template: {
            component: '$html(div)',
            children: [
              {
                value: '$model(name)',
                component: '$component(Input)',
                componentProps: { label: 'Название' },
              },
            ],
          },
        },
      },
    ],
  },
} as unknown as JsonFormSchema;
