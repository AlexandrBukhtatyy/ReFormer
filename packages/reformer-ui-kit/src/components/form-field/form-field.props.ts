import type { PropsSchema } from '../../fields/props-schema';

/**
 * Контракт враппера `FormField`: props, которые вынимает CDK-обёртка (не примитив).
 * Подмешивается в каждую field-схему через `mergeFieldPropsSchema`.
 *
 * `label`/`required` — живые (рисуются `FormField.Label`: `FormFieldRoot.tsx:80` → `FormFieldLabel.tsx:51`).
 * `testId` — meta-проп: уходит в `data-testid`, в примитив/DOM как проп не течёт.
 * `description` — под shadcn `Field` (`FieldDescription`); FormField перестроен на нём в волне 0.
 */
export const fieldWrapperPropsSchema: PropsSchema = {
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Подпись поля (рендерит FormField.Label).',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    required: {
      type: 'boolean',
      default: false,
      description: 'Маркер «*» у метки + aria-required.',
      'x-doc': { group: 'State', type: 'boolean' },
    },
    description: {
      type: 'string',
      description: 'Пояснение под полем (shadcn FieldDescription).',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    testId: {
      type: 'string',
      description: 'data-testid для e2e (meta-проп; в DOM примитива не течёт).',
      'x-doc': { group: 'Behavior', type: 'string', kind: 'readonly' },
    },
  },
};
