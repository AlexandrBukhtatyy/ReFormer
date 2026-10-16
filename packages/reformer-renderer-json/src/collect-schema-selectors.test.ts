import { describe, it, expect } from 'vitest';
import { collectSchemaSelectors } from './collect-schema-selectors';
import type { JsonFormSchema } from './types/json-schema';

const schema = {
  format: 2,
  version: '1.0',
  root: {
    selector: 'root',
    component: '$component(Box)',
    children: [
      { selector: 'email', model: '$model(email)', component: '$component(Input)' },
      // Вложенные ноды в componentProps — не в node.children.
      {
        selector: 'card',
        component: '$component(Card)',
        componentProps: {
          className: 'x',
          sections: [
            {
              component: '$component(Step)',
              children: [
                { selector: 'mortgage-section', component: '$component(Section)', children: [] },
              ],
            },
          ],
        },
      },
      // Массив: селектор на узле + селектор внутри item.$template.
      {
        selector: 'items-array',
        model: '$model(items)',
        initialValue: { name: '' },
        item: {
          $template: {
            selector: 'item-name',
            model: '$model(name)',
            component: '$component(Input)',
          },
        },
      },
    ],
  },
} as unknown as JsonFormSchema;

describe('collectSchemaSelectors', () => {
  it('собирает селекторы из children, вложенных в componentProps нод, массива и item.$template', () => {
    const found = [...collectSchemaSelectors(schema)].sort();
    expect(found).toEqual([
      'card',
      'email',
      'item-name',
      'items-array',
      'mortgage-section', // из card.componentProps.sections → step.children → section
      'root',
    ]);
  });
});
