import type { JsonFormSchema } from '@reformer/renderer-json';

/**
 * Мини-схема для юнитов: RendererFormWizard с двумя шагами (шаги — его `children`),
 * во втором шаге — array-узел с `item.$template`. Каждый вызов возвращает СВЕЖУЮ глубокую копию,
 * чтобы тесты не делили изменяемое состояние.
 */
export function sampleSchema(): JsonFormSchema {
  return structuredClone({
    format: 2,
    version: '1.0',
    root: {
      component: '$component(RendererFormWizard)',
      componentProps: { className: 'bg-white' },
      children: [
        {
          component: '$component(Step)',
          componentProps: { title: 'Кредит' },
          children: [
            {
              model: '$model(loanType)',
              component: '$component(Select)',
              componentProps: { label: 'Тип кредита', options: '$dataSource(LOAN_TYPES)' },
            },
            {
              model: '$model(loanAmount)',
              component: '$component(InputNumber)',
              componentProps: { label: 'Сумма', step: 1000 },
            },
          ],
        },
        {
          component: '$component(Step)',
          componentProps: { title: 'Имущество' },
          children: [
            {
              selector: 'properties-array',
              model: '$model(properties)',
              initialValue: { type: 'apartment' },
              componentProps: { title: 'Имущество', itemLabel: '$dataSource(PROP_LABEL)' },
              item: {
                $template: {
                  component: '$component(Box)',
                  children: [
                    {
                      model: '$model(type)',
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
  }) as JsonFormSchema;
}

/** Частые пути в {@link sampleSchema}. */
export const P = {
  root: ['root'] as const,
  steps: ['root', 'children'] as const,
  step0: ['root', 'children', 0] as const,
  step0children: ['root', 'children', 0, 'children'] as const,
  step0field0: ['root', 'children', 0, 'children', 0] as const,
  step0field1: ['root', 'children', 0, 'children', 1] as const,
  step1: ['root', 'children', 1] as const,
  step1children: ['root', 'children', 1, 'children'] as const,
  array: ['root', 'children', 1, 'children', 0] as const,
  arrayTemplate: ['root', 'children', 1, 'children', 0, 'item', '$template'] as const,
};
