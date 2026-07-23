import { TextareaField, textareaBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

export const textareaDocConfig: ComponentDocConfig = {
  name: 'Textarea',
  importFrom: '@reformer/ui-kit',
  description:
    'Многострочное текстовое поле на pure shadcn Textarea. Значение — string | null (пустой ввод → null). TextareaField биндится к M1-полю через nativeInputAdapter.',
  variants: [
    {
      id: 'base',
      title: 'Базовое поле',
      description: 'Многострочный ввод. Значение — string | null (пустой ввод → null).',
      render: makeFieldVariant({
        initial: '',
        component: TextareaField,
        componentProps: { label: 'Комментарий', placeholder: 'Введите комментарий', rows: 4 },
      }),
      code: `{
  value: model.$.comment,
  component: TextareaField,
  componentProps: { label: 'Комментарий', placeholder: 'Введите комментарий', rows: 4 },
}`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Валидатор required',
      description:
        'правило required в validation-схеме (validate из @reformer/core/validation); touched-поле с пустым значением показывает ошибку.',
      render: makeFieldVariant({
        initial: '',
        component: TextareaField,
        componentProps: { label: 'Комментарий', placeholder: 'Обязательное поле', rows: 4 },
        validators: [required({ message: 'Укажите комментарий' })],
        touched: true,
      }),
      code: `{
  value: model.$.comment,
  component: TextareaField,
  componentProps: { label: 'Комментарий', rows: 4 },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.comment, [required()]);`,
    },
  ],
  api: {
    component: TextareaField,
    initialValue: '',
    baseComponentProps: { label: 'Комментарий' },
    validators: [required({ message: 'Обязательно' })],
    valuePresets: [
      { label: 'Пример текста', value: 'Пример комментария' },
      { label: 'Очистить', value: '' },
    ],
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(textareaBasePropsSchema), {
      omit: ['label'],
    }),
    code: (v) =>
      `{
  value: model.$.value,
  component: TextareaField,
  componentProps: {
    label: 'Комментарий',
    placeholder: '${v.placeholder}',${v.rows ? `\n    rows: ${v.rows},` : ''}${v.required ? '\n    required: true,' : ''}
  },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.value, [required()]);`,
  },
};
