import { Input, inputBasePropsSchema, InputNumber, InputSuggest } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required, min } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant } from '../field-snippet';
import type { ComponentDocConfig } from '../types';

// Пропсы панели API — из props-схемы варианта. label задаётся baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(inputBasePropsSchema), {
  omit: ['label'],
});

export const inputDocConfig: ComponentDocConfig = {
  name: 'Input',
  importFrom: '@reformer/ui-kit',
  description:
    'Однострочное поле ввода. Input — строка, InputNumber — число, InputSuggest — строка с подсказками.',
  variants: [
    fieldVariant({
      id: 'text',
      title: 'Строка',
      description: 'Input с type="email". Значение — string | null: пустой ввод даёт null.',
      field: 'email',
      component: Input,
      componentName: 'Input',
      initial: '',
      props: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
    }),
    fieldVariant({
      id: 'number',
      title: 'Число',
      description:
        'Отдельный компонент InputNumber. Значение — number | null. Незаконченный ввод («1.», «-») поле держит, но в модель не пишет.',
      field: 'age',
      component: InputNumber,
      componentName: 'InputNumber',
      initial: null,
      props: { label: 'Возраст', min: 0, placeholder: 'Введите возраст' },
    }),
    fieldVariant({
      id: 'suggest',
      title: 'Подсказки при вводе',
      description:
        'Отдельный компонент InputSuggest. Значение — введённый текст; подсказка только подставляет свой value.',
      field: 'city',
      component: InputSuggest,
      componentName: 'InputSuggest',
      initial: null,
      props: { label: 'Город', suggestions: ['Москва', 'Казань', 'Новосибирск'] },
    }),
    fieldVariant({
      id: 'read-only',
      title: 'Только чтение',
      description:
        'readOnly: значение видно, фокусируется и уходит с формой, но не редактируется. Не путать с блокировкой поля.',
      field: 'contractNumber',
      component: Input,
      componentName: 'Input',
      initial: 'Д-2026/0412',
      showInitial: true,
      props: { label: 'Номер договора', readOnly: true },
    }),
  ],
  examples: [
    fieldVariant({
      id: 'validation',
      title: 'Правила required и min',
      description:
        'Правила живут в схеме валидации, а не в узле поля. Поле уже тронуто, поэтому замечание видно сразу.',
      field: 'age',
      component: InputNumber,
      componentName: 'InputNumber',
      initial: null,
      props: { label: 'Возраст', min: 18, required: true },
      validators: [required({ code: 'age.required' }), min(18, { code: 'age.min' })],
      rules: "required({ code: 'age.required' }), min(18, { code: 'age.min' })",
      messages: { 'age.required': 'Укажите возраст', 'age.min': 'Минимум 18' },
      touched: true,
    }),
    fieldVariant({
      id: 'hints',
      title: 'Пояснение и подсказки',
      description:
        'description — текст под полем, labelTooltip — иконка у подписи, tooltip — иконка внутри поля. Все три общие для полей кита.',
      field: 'inn',
      component: Input,
      componentName: 'Input',
      initial: '',
      props: {
        label: 'ИНН',
        description: 'Для юрлица — 10 цифр, для ИП — 12',
        labelTooltip: 'Есть в выписке из ЕГРЮЛ',
        tooltip: 'Только цифры, без пробелов',
      },
    }),
  ],
  api: {
    component: Input,
    initialValue: '',
    baseComponentProps: { label: 'Email' },
    validators: [required({ code: 'field.required' })],
    messages: { 'field.required': 'Обязательно' },
    valuePresets: [
      { label: 'you@example.com', value: 'you@example.com' },
      { label: 'Очистить', value: '' },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'email',
        component: 'Input',
        props: { label: 'Email' },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};
