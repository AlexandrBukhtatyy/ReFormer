import { InputMask, inputMaskBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required, pattern } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant } from '../field-snippet';
import type { ApiControl, ComponentDocConfig } from '../types';

const API_MASK = '+7 (999) 999-99-99';

// У mask в схеме нет значения по умолчанию: без него демо открылось бы пустым полем без подсказки.
function withMaskDefault(c: ApiControl): ApiControl {
  return c.prop === 'mask' && c.kind === 'text' ? { ...c, default: API_MASK } : c;
}

// Пропсы панели API — из props-схемы компонента. label задаётся baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(inputMaskBasePropsSchema), {
  omit: ['label'],
}).map(withMaskDefault);

// Формат телефона, который проверяет правило: ровно как в шаблоне, со скобками и дефисами.
const PHONE_FORMAT = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;

export const inputMaskDocConfig: ComponentDocConfig = {
  name: 'InputMask',
  importFrom: '@reformer/ui-kit',
  description:
    'Поле с шаблоном ввода в подсказке: «9» — цифра, остальные символы — как есть. Ввод не переформатируется; значение — string | null.',
  variants: [
    fieldVariant({
      id: 'phone',
      title: 'Телефон',
      description:
        'mask показывается в пустом поле вместо placeholder. В модель уходит ровно то, что набрал человек.',
      field: 'phone',
      component: InputMask,
      componentName: 'InputMask',
      initial: '',
      props: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
    }),
    fieldVariant({
      id: 'date',
      title: 'Дата со своей подсказкой',
      description: 'Свой placeholder заменяет шаблон в пустом поле.',
      field: 'birthDate',
      component: InputMask,
      componentName: 'InputMask',
      initial: '',
      props: { label: 'Дата рождения', mask: '99.99.9999', placeholder: 'ДД.ММ.ГГГГ' },
    }),
  ],
  examples: [
    fieldVariant({
      id: 'validation',
      title: 'Проверка формата правилом',
      description:
        'Шаблон формат не проверяет — это делает правило pattern в схеме валидации. Поле уже тронуто, поэтому замечание видно сразу.',
      field: 'phone',
      component: InputMask,
      componentName: 'InputMask',
      initial: '8 900 123',
      showInitial: true,
      props: { label: 'Телефон', mask: '+7 (999) 999-99-99', required: true },
      validators: [
        required({ code: 'phone.required' }),
        pattern(PHONE_FORMAT, { code: 'phone.format' }),
      ],
      rules: `required({ code: 'phone.required' }), pattern(/${PHONE_FORMAT.source}/, { code: 'phone.format' })`,
      messages: {
        'phone.required': 'Укажите телефон',
        'phone.format': 'Телефон в формате +7 (999) 999-99-99',
      },
      touched: true,
    }),
  ],
  api: {
    component: InputMask,
    initialValue: '',
    baseComponentProps: { label: 'Телефон' },
    validators: [required({ code: 'field.required' })],
    messages: { 'field.required': 'Обязательно' },
    valuePresets: [
      { label: '+7 (900) 000-00-00', value: '+7 (900) 000-00-00' },
      { label: 'Очистить', value: '' },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'phone',
        component: 'InputMask',
        // mask печатается всегда: его значение по умолчанию задано только для демо.
        props: { label: 'Телефон', mask: v.mask },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};
