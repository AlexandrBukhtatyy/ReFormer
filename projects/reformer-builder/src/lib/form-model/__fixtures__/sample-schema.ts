import type { JsonFormSchema } from '@reformer/renderer-json';

/**
 * Мини-схема для юнитов: RendererFormWizard с двумя шагами (children в `componentProps.steps`),
 * во втором шаге — array-узел с `item.$template`. Каждый вызов возвращает СВЕЖУЮ глубокую копию,
 * чтобы тесты не делили изменяемое состояние.
 */
export function sampleSchema(): JsonFormSchema {
  return structuredClone({
    version: '1.0',
    root: {
      component: '$component(RendererFormWizard)',
      componentProps: {
        className: 'bg-white',
        steps: [
          {
            component: '$component(Step)',
            componentProps: { title: 'Кредит' },
            children: [
              {
                value: '$model(loanType)',
                component: '$component(Select)',
                componentProps: { label: 'Тип кредита', options: '$dataSource(LOAN_TYPES)' },
              },
              {
                value: '$model(loanAmount)',
                component: '$component(Input)',
                componentProps: { label: 'Сумма', type: 'number' },
              },
            ],
          },
          {
            component: '$component(Step)',
            componentProps: { title: 'Имущество' },
            children: [
              {
                selector: 'properties-array',
                array: '$model(properties)',
                initialValue: { type: 'apartment' },
                componentProps: { title: 'Имущество', itemLabel: '$dataSource(PROP_LABEL)' },
                item: {
                  $template: {
                    component: '$component(Box)',
                    children: [
                      {
                        value: '$model(type)',
                        component: '$component(Select)',
                        componentProps: { label: 'Тип имущества' },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    },
  }) as JsonFormSchema;
}

/** Частые пути в {@link sampleSchema}. */
export const P = {
  root: ['root'] as const,
  steps: ['root', 'componentProps', 'steps'] as const,
  step0: ['root', 'componentProps', 'steps', 0] as const,
  step0children: ['root', 'componentProps', 'steps', 0, 'children'] as const,
  step0field0: ['root', 'componentProps', 'steps', 0, 'children', 0] as const,
  step0field1: ['root', 'componentProps', 'steps', 0, 'children', 1] as const,
  step1: ['root', 'componentProps', 'steps', 1] as const,
  step1children: ['root', 'componentProps', 'steps', 1, 'children'] as const,
  array: ['root', 'componentProps', 'steps', 1, 'children', 0] as const,
  arrayTemplate: [
    'root',
    'componentProps',
    'steps',
    1,
    'children',
    0,
    'item',
    '$template',
  ] as const,
};
