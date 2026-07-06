import { InputMask, FormField } from '@reformer/ui-kit';
import { useFormControlValue } from '@reformer/core';
import { required, pattern } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { useDemoField } from '../harness';
import type { ComponentDocConfig } from '../types';

/* ─── Examples (композитные демо) ──────────────────────────────────────── */

const PhoneMaskField = makeFieldVariant({
  initial: '',
  component: InputMask,
  componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
});

const DateMaskField = makeFieldVariant({
  initial: '',
  component: InputMask,
  componentProps: { label: 'Дата', mask: '99.99.9999', placeholder: 'ДД.ММ.ГГГГ' },
});

const CardMaskField = makeFieldVariant({
  initial: '',
  component: InputMask,
  componentProps: { label: 'Номер карты', mask: '9999 9999 9999 9999' },
});

/** Галерея готовых mask-паттернов в одном месте. */
function MasksExample() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 380 }}>
      <PhoneMaskField />
      <DateMaskField />
      <CardMaskField />
    </div>
  );
}

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
      id: 'default',
      title: 'По умолчанию',
      description: 'Пустое поле; placeholder по умолчанию показывает формат маски.',
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
      id: 'filled',
      title: 'Заполнено',
      description: 'Поле с введённым значением.',
      render: makeFieldVariant({
        initial: '+7 (912) 345-67-89',
        component: InputMask,
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
      }),
      code: `{
  value: model.$.phone, // '+7 (912) 345-67-89'
  component: InputMask,
  componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
}`,
    },
    {
      id: 'custom-placeholder',
      title: 'Свой placeholder',
      description: 'placeholder переопределяет подсказку-маску собственным текстом.',
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
      id: 'disabled',
      title: 'Заблокировано',
      description: 'disabled: ввод заблокирован, значение приглушено.',
      render: makeFieldVariant({
        initial: '+7 (912) 345-67-89',
        component: InputMask,
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
        disabled: true,
      }),
      code: `const form = createForm({ model, schema });
form.phone.disable(); // ввод заблокирован`,
    },
    {
      id: 'invalid',
      title: 'Ошибка',
      description:
        'Состояние ошибки: destructive-рамка и текст под полем (touched + проваленный валидатор).',
      render: makeFieldVariant({
        initial: '+7 (912) 3',
        component: InputMask,
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
        validators: [pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Неверный формат' })],
        touched: true,
      }),
      code: `{
  value: model.$.phone,
  component: InputMask,
  componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
  validators: [pattern(/^\\+7 \\(\\d{3}\\) \\d{3}-\\d{2}-\\d{2}$/)],
}`,
    },
  ],
  examples: [
    {
      id: 'masks',
      title: 'Готовые маски',
      description:
        'Разные шаблоны: телефон, дата, номер карты. «9» — цифра, остальные символы — литералы placeholder.',
      render: MasksExample,
      code: `// Телефон
componentProps: { mask: '+7 (999) 999-99-99' }
// Дата
componentProps: { mask: '99.99.9999', placeholder: 'ДД.ММ.ГГГГ' }
// Номер карты
componentProps: { mask: '9999 9999 9999 9999' }`,
    },
    {
      id: 'validation',
      title: 'Проверка формата валидатором',
      description:
        'Маска — только подсказка UI и НЕ форсирует ввод; реальный формат проверяет валидатор pattern.',
      render: makeFieldVariant({
        initial: '',
        component: InputMask,
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
        validators: [
          required({ message: 'Введите телефон' }),
          pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Неверный формат' }),
        ],
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
