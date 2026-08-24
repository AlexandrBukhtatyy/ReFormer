/**
 * Форма-визард для тестов кодогена: `Wizard` с двумя шагами `Step`, поля разложены по шагам.
 *
 * Отдельная фикстура рядом с {@link exampleSchema} нужна потому, что визард — единственная форма,
 * у которой набор файлов отличается (появляется шим `renderer.wizard.tsx`), submit висит на другом
 * событии (`onSubmit` визарда вместо `onClick` кнопки), а поля лежат не в `children`, а в
 * `componentProps.steps[]` — то есть проверяются ветки, которых плоская форма не задевает.
 *
 * @module reformer-builder/codegen/__fixtures__/wizard-schema
 */

import type { JsonFormSchema } from '@reformer/renderer-json';

export const wizardSchema = {
  version: '1.0',
  root: {
    selector: 'wizard',
    component: '$component(Wizard)',
    componentProps: {
      className: 'rounded-lg bg-white p-6 shadow-sm',
      steps: [
        {
          component: '$component(Step)',
          componentProps: { title: 'Контакты', icon: '👤', className: 'space-y-4' },
          children: [
            {
              value: '$model(fullName)',
              component: '$component(Input)',
              componentProps: { label: 'ФИО', required: true },
            },
            {
              value: '$model(email)',
              component: '$component(Input)',
              componentProps: { label: 'Email', type: 'email', required: true },
            },
          ],
        },
        {
          component: '$component(Step)',
          componentProps: { title: 'Адрес', icon: '🏠', className: 'space-y-4' },
          children: [
            {
              component: '$component(Section)',
              componentProps: { title: 'Место проживания' },
              children: [
                {
                  value: '$model(city)',
                  component: '$component(Select)',
                  componentProps: { label: 'Город', options: '$dataSource(CITIES)' },
                },
                {
                  value: '$model(address)',
                  component: '$component(Input)',
                  componentProps: { label: 'Улица, дом, квартира' },
                },
              ],
            },
            {
              value: '$model(agree)',
              component: '$component(Checkbox)',
              componentProps: { label: 'Данные указаны верно', required: true },
            },
          ],
        },
      ],
    },
  },
} as unknown as JsonFormSchema;
