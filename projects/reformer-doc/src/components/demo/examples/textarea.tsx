import { Textarea } from '@reformer/ui-kit';
import { required, maxLength } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import type { ComponentDocConfig } from '../types';

export const textareaDocConfig: ComponentDocConfig = {
  name: 'Textarea',
  importFrom: '@reformer/ui-kit',
  description: 'Многострочное текстовое поле. Вертикальный resize.',
  variants: [
    {
      id: 'basic',
      title: 'Базовое',
      description: 'rows по умолчанию 3.',
      render: makeFieldVariant({
        initial: '',
        component: Textarea,
        componentProps: { label: 'Комментарий', placeholder: 'Опишите проблему' },
      }),
      code: `{
  value: model.$.comment,
  component: Textarea,
  componentProps: { label: 'Комментарий', placeholder: 'Опишите проблему' },
}`,
    },
    {
      id: 'rows',
      title: 'Крупное',
      description: 'rows задаёт видимую высоту.',
      render: makeFieldVariant({
        initial: '',
        component: Textarea,
        componentProps: { label: 'Адрес доставки', rows: 5, placeholder: 'Город, улица, дом' },
      }),
      code: `componentProps: { label: 'Адрес доставки', rows: 5 }`,
    },
    {
      id: 'maxlength',
      title: 'С лимитом',
      description: 'maxLength — нативный soft-лимит длины.',
      render: makeFieldVariant({
        initial: '',
        component: Textarea,
        componentProps: { label: 'Отзыв (до 200 символов)', rows: 4, maxLength: 200 },
      }),
      code: `componentProps: { label: 'Отзыв', rows: 4, maxLength: 200 }`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Обязательное поле с ограничением длины',
      description:
        'Бизнес-лимит — через валидатор maxLength (в отличие от нативного maxLength-props).',
      render: makeFieldVariant({
        initial: '',
        component: Textarea,
        componentProps: { label: 'Комментарий', rows: 4, placeholder: 'Не менее пары слов' },
        validators: [required({ message: 'Заполните комментарий' }), maxLength(500)],
      }),
      code: `{
  value: model.$.comment,
  component: Textarea,
  componentProps: { label: 'Комментарий', rows: 4 },
  validators: [required(), maxLength(500)],
}`,
    },
  ],
  api: {
    component: Textarea,
    initialValue: '',
    baseComponentProps: { label: 'Комментарий' },
    valuePresets: [
      { label: 'Текст', value: 'Пример комментария' },
      { label: 'Очистить', value: '' },
    ],
    controls: [
      {
        prop: 'value',
        type: 'string | null',
        group: 'Control',
        kind: 'readonly',
        description: 'Значение. null/undefined — пустое поле.',
      },
      {
        prop: 'onChange',
        type: '(value: string | null) => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Пустая строка приводится к null.',
      },
      {
        prop: 'onBlur',
        type: '() => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Срабатывает при потере фокуса.',
      },
      {
        prop: 'maxLength',
        type: 'number',
        group: 'Control',
        kind: 'readonly',
        description: 'Нативный hard-лимит длины (soft-protection UI).',
      },
      {
        prop: 'placeholder',
        type: 'string',
        group: 'Textfield',
        kind: 'text',
        default: 'Введите текст',
        description: 'Подсказка внутри поля.',
      },
      {
        prop: 'rows',
        type: 'number',
        group: 'Appearance',
        kind: 'number',
        default: 3,
        min: 2,
        max: 12,
        description: 'Видимая высота в строках.',
      },
      {
        prop: 'disabled',
        type: 'boolean',
        group: 'State',
        kind: 'boolean',
        default: false,
        description: 'Блокирует ввод.',
      },
    ],
    code: (v) => `{
  value: model.$.comment,
  component: Textarea,
  componentProps: { label: 'Комментарий', placeholder: '${v.placeholder}', rows: ${v.rows} },
}${v.disabled ? '\n// form.comment.disable()' : ''}`,
  },
};
