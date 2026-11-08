import { Textarea, textareaBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required, maxLength } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant } from '../field-snippet';
import type { ApiControl, ComponentDocConfig } from '../types';

// У rows и maxLength нет значения по умолчанию, а числовой контрол начинает с 0 и сразу кладёт
// его в пропсы: maxLength={0} запретил бы ввод. Поэтому они только описаны, без переключателя.
const DESCRIBED_ONLY = new Set(['rows', 'maxLength']);

function describeOnly(c: ApiControl): ApiControl {
  if (!DESCRIBED_ONLY.has(c.prop)) return c;
  return {
    prop: c.prop,
    type: c.type,
    description: c.description,
    group: c.group,
    kind: 'readonly',
  };
}

// Пропсы панели API — из props-схемы компонента. label задаётся baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(textareaBasePropsSchema), {
  omit: ['label'],
}).map(describeOnly);

export const textareaDocConfig: ComponentDocConfig = {
  name: 'Textarea',
  importFrom: '@reformer/ui-kit',
  description:
    'Многострочное поле ввода текста. Значение — string | null: пустой ввод даёт null. Высота растёт вместе с текстом.',
  variants: [
    fieldVariant({
      id: 'base',
      title: 'Комментарий',
      description: 'Значение — string | null. Высота растёт вместе с текстом.',
      field: 'comment',
      component: Textarea,
      componentName: 'Textarea',
      initial: '',
      props: { label: 'Комментарий', placeholder: 'Опишите проблему' },
    }),
    fieldVariant({
      id: 'max-length',
      title: 'Ограничение длины',
      description:
        'maxLength — HTML-атрибут: лишний символ не вводится. Замечание он не показывает — для этого нужно правило maxLength.',
      field: 'about',
      component: Textarea,
      componentName: 'Textarea',
      initial: '',
      props: {
        label: 'О себе',
        maxLength: 200,
        description: 'Не больше 200 символов',
      },
    }),
    fieldVariant({
      id: 'read-only',
      title: 'Только чтение',
      description:
        'readOnly: текст виден, выделяется и уходит с формой, но не редактируется. Поле не блокируется.',
      field: 'terms',
      component: Textarea,
      componentName: 'Textarea',
      initial: 'Условия договора приняты 12.10.2026.',
      showInitial: true,
      props: { label: 'Условия', readOnly: true },
    }),
  ],
  examples: [
    fieldVariant({
      id: 'validation',
      title: 'Правила required и maxLength',
      description:
        'Правила живут в схеме валидации, а не в узле поля. Поле уже тронуто, поэтому замечание видно сразу.',
      field: 'comment',
      component: Textarea,
      componentName: 'Textarea',
      initial: '',
      props: { label: 'Комментарий', required: true },
      validators: [
        required({ code: 'comment.required' }),
        maxLength(500, { code: 'comment.maxLength' }),
      ],
      rules:
        "required({ code: 'comment.required' }), maxLength(500, { code: 'comment.maxLength' })",
      messages: {
        'comment.required': 'Опишите проблему',
        'comment.maxLength': 'Не больше 500 символов',
      },
      touched: true,
    }),
  ],
  api: {
    component: Textarea,
    initialValue: '',
    baseComponentProps: { label: 'Комментарий' },
    validators: [required({ code: 'field.required' })],
    messages: { 'field.required': 'Обязательно' },
    valuePresets: [
      { label: 'Пример текста', value: 'Пример комментария' },
      { label: 'Очистить', value: '' },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'comment',
        component: 'Textarea',
        props: { label: 'Комментарий' },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};
