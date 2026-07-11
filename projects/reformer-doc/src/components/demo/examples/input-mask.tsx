import { InputMask, FormField } from '@reformer/ui-kit';
import { useFormControlValue } from '@reformer/core';
import { required, pattern } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { useDemoField } from '../harness';
import type { ComponentDocConfig } from '../types';

/* ─── Examples (композитные демо) ──────────────────────────────────────── */

/** onChange приводит пустую строку к null — видно при реактивном чтении. */
function NullableExample() {
  const { control } = useDemoField({
    initial: '',
    component: InputMask,
    componentProps: { label: 'Телефон (необязательно)', mask: '+7 (999) 999-99-99' },
  });
  const value = useFormControlValue(control);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 380 }}>
      <FormField control={control} />
      <span style={{ fontSize: '0.9rem', color: 'var(--ifm-color-emphasis-700)' }}>
        Текущее значение: <code>{JSON.stringify(value)}</code>
      </span>
    </div>
  );
}

/* ─── Config ───────────────────────────────────────────────────────────── */

export const inputMaskDocConfig: ComponentDocConfig = {
  name: 'InputMask',
  importFrom: '@reformer/ui-kit',
  description: 'Текстовое поле с маской-подсказкой. Символ «9» — цифра, остальное — литералы.',
  variants: [
    {
      id: 'phone',
      title: 'Телефон',
      description:
        'Форма по умолчанию: маска телефона. «9» — цифра, символы +, (, ), -, пробел — литералы placeholder.',
      render: makeFieldVariant({
        initial: '',
        component: InputMask,
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
      }),
      code: `{
  value: model.$.phone,
  component: InputMask,
  componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
}`,
    },
    {
      id: 'date',
      title: 'Дата',
      description:
        'Маска даты. placeholder переопределяет подсказку-маску собственным текстом формата.',
      render: makeFieldVariant({
        initial: '',
        component: InputMask,
        componentProps: { label: 'Дата рождения', mask: '99.99.9999', placeholder: 'ДД.ММ.ГГГГ' },
      }),
      code: `{
  value: model.$.birthDate,
  component: InputMask,
  componentProps: { label: 'Дата рождения', mask: '99.99.9999', placeholder: 'ДД.ММ.ГГГГ' },
}`,
    },
    {
      id: 'card',
      title: 'Номер карты',
      description: 'Маска банковской карты: четыре группы по четыре цифры.',
      render: makeFieldVariant({
        initial: '',
        component: InputMask,
        componentProps: { label: 'Номер карты', mask: '9999 9999 9999 9999' },
      }),
      code: `{
  value: model.$.cardNumber,
  component: InputMask,
  componentProps: { label: 'Номер карты', mask: '9999 9999 9999 9999' },
}`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Проверка формата валидатором',
      description:
        'Маска — только подсказка UI и НЕ форсирует ввод; реальный формат проверяет валидатор pattern (показан в состоянии touched).',
      render: makeFieldVariant({
        initial: '+7 (912) 3',
        component: InputMask,
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
        validators: [
          required({ message: 'Введите телефон' }),
          pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Неверный формат' }),
        ],
        touched: true,
      }),
      code: `{
  value: model.$.phone,
  component: InputMask,
  componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
  validators: [required(), pattern(/^\\+7 \\(\\d{3}\\) \\d{3}-\\d{2}-\\d{2}$/)],
}`,
    },
    {
      id: 'nullable',
      title: 'Пустое поле → null',
      description:
        'onChange приводит пустую строку к null — удобно для необязательных полей и условной валидации.',
      render: NullableExample,
      code: `import { useFormControlValue } from '@reformer/core';

const value = useFormControlValue(form.phone); // string | null
// пустая строка приходит как null`,
    },
  ],
  api: {
    component: InputMask,
    initialValue: '',
    baseComponentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
    validators: [required({ message: 'Введите телефон' })],
    valuePresets: [{ label: 'Очистить', value: '' }],
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
        prop: 'mask',
        type: 'string',
        group: 'Textfield',
        kind: 'text',
        default: '+7 (999) 999-99-99',
        description: 'Шаблон: «9» — цифра, остальные символы — литералы placeholder.',
      },
      {
        prop: 'placeholder',
        type: 'string',
        group: 'Textfield',
        kind: 'text',
        default: '',
        description: 'Подсказка внутри поля. По умолчанию равна mask.',
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
  value: model.$.phone,
  component: InputMask,
  componentProps: { label: 'Телефон', mask: '${v.mask}'${v.placeholder ? `, placeholder: '${v.placeholder}'` : ''} },
  validators: [required()],
}${v.disabled ? '\n// form.phone.disable()' : ''}`,
  },
};
