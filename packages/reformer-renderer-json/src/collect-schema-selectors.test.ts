import { describe, it, expect } from 'vitest';
import { collectSchemaSelectors } from './collect-schema-selectors';
import type { JsonFormSchema } from './types/json-schema';

const schema = {
  version: '1.0',
  root: {
    selector: 'root',
    component: '$component(Box)',
    children: [
      { selector: 'email', value: '$model(email)', component: '$component(Input)' },
      // Вложенные ноды в componentProps (как wizard `steps`) — не в node.children.
      {
        selector: 'wizard',
        component: '$component(RendererFormWizard)',
        componentProps: {
          className: 'x',
          steps: [
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
        array: '$model(items)',
        initialValue: { name: '' },
        item: {
          $template: {
            selector: 'item-name',
            value: '$model(name)',
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
      'email',
      'item-name',
      'items-array',
      'mortgage-section', // из wizard.componentProps.steps → step.children → section
      'root',
      'wizard',
    ]);
  });
});
