import { useMemo, useState } from 'react';
import {
  createModel,
  createForm,
  validateFormModel,
  useFormControl,
  useFormControlValue,
  type FieldControlState,
} from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { Input, FormField, Button } from '@reformer/ui-kit';
import { makeFieldVariant } from '../field-demo';
import { useDemoField } from '../harness';
import type { ComponentDocConfig } from '../types';

/* ─── Variants (формы компонента) ──────────────────────────────────────────
 * Вариант = режим ввода поля (устройство компонента), задаётся `type`.
 * Дефолт — строковый text; остальные — почтовая/телефонная/URL-раскладка,
 * числовой парсинг, нативная маскировка пароля. Состояния (пусто/заполнено/
 * disabled/invalid) и валидаторы живут в табах API и Examples, не здесь.
 * ────────────────────────────────────────────────────────────────────────── */

const TextVariant = makeFieldVariant({
  initial: '',
  component: Input,
  componentProps: { label: 'Имя', placeholder: 'Иван Иванов' },
});

const EmailVariant = makeFieldVariant({
  initial: '',
  component: Input,
  componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
});

const TelVariant = makeFieldVariant({
  initial: '',
  component: Input,
  componentProps: { label: 'Телефон', type: 'tel', placeholder: '+7 900 000-00-00' },
});

const UrlVariant = makeFieldVariant({
  initial: '',
  component: Input,
  componentProps: { label: 'Сайт', type: 'url', placeholder: 'https://example.com' },
});

const NumberVariant = makeFieldVariant({
  initial: null,
  component: Input,
  componentProps: { label: 'Возраст', type: 'number', min: 0 },
});

const PasswordVariant = makeFieldVariant({
  initial: '',
  component: Input,
  componentProps: { label: 'Пароль', type: 'password' },
});

/* ─── Examples (возможности / приёмы) ──────────────────────────────────────── */

function FormBindingExample() {
  const [status, setStatus] = useState<string | null>(null);
  const { model, form, schema } = useMemo(() => {
    const model = createModel<{ email: string }>({ email: '' });
    const schema = {
      email: {
        value: model.$.email,
        component: Input,
        componentProps: {
          label: 'Email',
          type: 'email',
          placeholder: 'you@example.com',
          testId: 'email',
        },
        validators: [
          required({ message: 'Email обязателен' }),
          email({ message: 'Неверный email' }),
        ],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const form = createForm<{ email: string }>({ model, schema });
    return { model, form, schema };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Помечаем поле touched, чтобы ошибки стали видимы (shouldShowError = touched && invalid).
    form.email.markAsTouched();
    const result = await validateFormModel(model, schema);
    setStatus(result.valid ? '✅ Форма валидна' : '❌ Исправьте ошибки в форме');
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 360 }}
    >
      <FormField control={form.email} testId="email" />
      <div>
        <Button type="submit">Проверить</Button>
      </div>
      {status && <span style={{ fontSize: '0.9rem' }}>{status}</span>}
    </form>
  );
}

function NullNormalizationExample() {
  const { control } = useDemoField({
    initial: 'привет',
    component: Input,
    componentProps: { label: 'Ник', placeholder: 'Сотрите текст' },
  });
  const value = useFormControlValue(control);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 360 }}>
      <FormField control={control} />
      <span style={{ fontSize: '0.9rem', color: 'var(--ifm-color-emphasis-700)' }}>
        Очистите поле — пустая строка нормализуется в <code>null</code>, а не в{' '}
        <code>&quot;&quot;</code>. Сейчас: <code>{JSON.stringify(value)}</code> (
        <code>string | null</code>).
      </span>
    </div>
  );
}

function NumberValueExample() {
  const { control } = useDemoField({
    initial: null,
    component: Input,
    componentProps: { label: 'Сумма, ₽', type: 'number', min: 0 },
  });
  const value = useFormControlValue(control);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 360 }}>
      <FormField control={control} />
      <span style={{ fontSize: '0.9rem', color: 'var(--ifm-color-emphasis-700)' }}>
        Текущее значение: <code>{JSON.stringify(value)}</code> (<code>number | null</code>)
      </span>
    </div>
  );
}

function NumberBufferExample() {
  const { control } = useDemoField({
    initial: 1.5,
    component: Input,
    componentProps: { label: 'Цена, ₽', type: 'number' },
  });
  const value = useFormControlValue(control);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 360 }}>
      <FormField control={control} />
      <span style={{ fontSize: '0.9rem', color: 'var(--ifm-color-emphasis-700)' }}>
        Наберите «1.50», «1.» или «0.05» — поле удержит промежуточный ввод, а в onChange уйдёт{' '}
        <code>{JSON.stringify(value)}</code>.
      </span>
    </div>
  );
}

function NumberClampExample() {
  const { control } = useDemoField({
    initial: 0,
    component: Input,
    componentProps: { label: 'Количество', type: 'number', min: 0 },
  });
  const value = useFormControlValue(control);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 360 }}>
      <FormField control={control} />
      <span style={{ fontSize: '0.9rem', color: 'var(--ifm-color-emphasis-700)' }}>
        Попробуйте ввести отрицательное число — при{' '}
        <code>
          min={'{'}0{'}'}
        </code>{' '}
        оно зажмётся к 0. Сейчас: <code>{JSON.stringify(value)}</code>.
      </span>
    </div>
  );
}

function HeadlessExample() {
  const { control } = useDemoField({
    initial: '',
    component: Input,
    componentProps: { label: 'Email' },
    validators: [required({ message: 'Email обязателен' }), email({ message: 'Неверный email' })],
  });
  // control из harness типизирован как any; берём точное состояние поля.
  const { value, disabled, errors, shouldShowError } = useFormControl(
    control
  ) as unknown as FieldControlState<string | null>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxWidth: 360 }}>
      <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Email</label>
      <Input
        type="email"
        value={value}
        disabled={disabled}
        onChange={(v) => control.setValue(v ?? '')}
        onBlur={() => control.markAsTouched()}
        aria-invalid={shouldShowError}
        placeholder={shouldShowError ? errors[0]?.message : 'you@example.com'}
      />
      {shouldShowError && errors[0] && (
        <span style={{ fontSize: '0.85rem', color: 'var(--ifm-color-danger)' }} role="alert">
          {errors[0].message}
        </span>
      )}
    </div>
  );
}

/* ─── Config ───────────────────────────────────────────────────────────── */

export const inputDocConfig: ComponentDocConfig = {
  name: 'Input',
  importFrom: '@reformer/ui-kit',
  description:
    'Текстовое/числовое поле ввода. Дискриминируется по type: number даёт number | null, остальные типы — string | null.',
  variants: [
    {
      id: 'text',
      title: 'Текст',
      description: 'Базовая строковая форма (type по умолчанию — text). value: string | null.',
      render: TextVariant,
      code: `{
  value: model.$.name,
  component: Input,
  componentProps: { label: 'Имя', placeholder: 'Иван Иванов' },
}`,
    },
    {
      id: 'email',
      title: 'Email',
      description: 'type="email" — почтовая раскладка на мобильных, семантика поля почты.',
      render: EmailVariant,
      code: `{
  value: model.$.email,
  component: Input,
  componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
}`,
    },
    {
      id: 'tel',
      title: 'Телефон',
      description: 'type="tel" — цифровая клавиатура на мобильных.',
      render: TelVariant,
      code: `{
  value: model.$.phone,
  component: Input,
  componentProps: { label: 'Телефон', type: 'tel', placeholder: '+7 900 000-00-00' },
}`,
    },
    {
      id: 'url',
      title: 'URL',
      description: 'type="url" — форма для ссылки, URL-раскладка.',
      render: UrlVariant,
      code: `{
  value: model.$.site,
  component: Input,
  componentProps: { label: 'Сайт', type: 'url', placeholder: 'https://example.com' },
}`,
    },
    {
      id: 'number',
      title: 'Число',
      description:
        'type="number" — числовой режим ввода: value приходит как number | null, буфер держит промежуточный ввод.',
      render: NumberVariant,
      code: `{
  value: model.$.age,
  component: Input,
  componentProps: { label: 'Возраст', type: 'number', min: 0 },
}`,
    },
    {
      id: 'password',
      title: 'Пароль',
      description: 'type="password" — значение маскируется нативно (без встроенного toggle).',
      render: PasswordVariant,
      code: `{
  value: model.$.password,
  component: Input,
  componentProps: { label: 'Пароль', type: 'password' },
}`,
    },
  ],
  examples: [
    {
      id: 'form-binding',
      title: 'Привязка к форме с валидацией',
      description:
        'Полный M1-поток: createModel → schema → createForm → FormField. Ошибки показываются под полем после markAsTouched.',
      render: FormBindingExample,
      code: `import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { FormField, Input, Button } from '@reformer/ui-kit';

const model = createModel<{ email: string }>({ email: '' });
const schema = {
  email: {
    value: model.$.email,
    component: Input,
    componentProps: { label: 'Email', type: 'email' },
    validators: [required(), email()],
  },
};
const form = createForm({ model, schema });

function ContactForm() {
  const onSubmit = async (e) => {
    e.preventDefault();
    form.email.markAsTouched();
    const result = await validateFormModel(model, schema);
    if (result.valid) console.log(model.get());
  };
  return (
    <form onSubmit={onSubmit}>
      <FormField control={form.email} />
      <Button type="submit">Проверить</Button>
    </form>
  );
}`,
    },
    {
      id: 'null-normalization',
      title: 'Нормализация пустого значения в null',
      description:
        'Строковый Input эмитит null для пустой строки (value || null) — модель хранит null, а не "". Удобно для «необязательное поле = отсутствие значения».',
      render: NullNormalizationExample,
      code: `import { useFormControlValue } from '@reformer/core';

// В onChange Input отдаёт newValue || null:
//   ''      → null
//   'привет' → 'привет'
const value = useFormControlValue(form.nick); // string | null
// <FormField control={form.nick} />`,
    },
    {
      id: 'number-value',
      title: 'Числовое поле и реактивное чтение значения',
      description: 'useFormControlValue реактивно отдаёт текущее значение поля как number | null.',
      render: NumberValueExample,
      code: `import { useFormControlValue } from '@reformer/core';

const value = useFormControlValue(form.amount); // number | null
// <FormField control={form.amount} /> — type: 'number' в схеме`,
    },
    {
      id: 'number-buffer',
      title: 'Промежуточный / неканонический числовой ввод',
      description:
        'Input держит «1.50», «1.», ведущие нули и частичный «-»/«.», а в onChange эмитит только валидное число — поле не «прыгает» при наборе.',
      render: NumberBufferExample,
      code: `{
  value: model.$.price,
  component: Input,
  componentProps: { label: 'Цена, ₽', type: 'number' },
}
// Ввод '1.50' удерживается буфером, onChange получает 1.5.`,
    },
    {
      id: 'number-clamp',
      title: 'Зажим отрицательных к нулю',
      description:
        'При min >= 0 отрицательный ввод автоматически превращается в 0 (resolveEmittedNumber).',
      render: NumberClampExample,
      code: `{
  value: model.$.qty,
  component: Input,
  componentProps: { label: 'Количество', type: 'number', min: 0 },
}
// Ввод '-5' эмитит 0.`,
    },
    {
      id: 'headless',
      title: 'Ручная headless-привязка через useFormControl',
      description:
        'Без FormField: сами читаем value/disabled/errors/shouldShowError, onBlur → markAsTouched, aria-invalid и placeholder=текст ошибки.',
      render: HeadlessExample,
      code: `import { useFormControl, type FieldNode } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

function EmailField({ control }: { control: FieldNode<string> }) {
  const { value, disabled, errors, shouldShowError } = useFormControl(control);
  return (
    <Input
      type="email"
      value={value}
      disabled={disabled}
      onChange={(v) => control.setValue(v ?? '')}
      onBlur={() => control.markAsTouched()}
      aria-invalid={shouldShowError}
      placeholder={shouldShowError ? errors[0]?.message : 'you@example.com'}
    />
  );
}`,
    },
  ],
  api: {
    component: Input,
    initialValue: '',
    baseComponentProps: { label: 'Email' },
    validators: [required(), email()],
    valuePresets: [
      { label: 'Заполнить', value: 'user@example.com' },
      { label: 'Очистить', value: '' },
    ],
    controls: [
      {
        prop: 'value',
        type: 'string | number | null',
        group: 'Control',
        kind: 'readonly',
        description: 'Текущее значение. null/undefined рендерится как пустое поле.',
      },
      {
        prop: 'onChange',
        type: '(value) => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Получает строку (или number для type="number"), либо null для пустой строки.',
      },
      {
        prop: 'onBlur',
        type: '() => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Срабатывает при потере фокуса (используется FormField для touched).',
      },
      {
        prop: 'className',
        type: 'string',
        group: 'Control',
        kind: 'readonly',
        description: 'Доп. класс, мерджится с дефолтными Tailwind-классами через tailwind-merge.',
      },
      {
        prop: 'type',
        type: `'text' | 'email' | 'tel' | 'url' | 'password'`,
        group: 'Textfield',
        kind: 'enum',
        options: ['text', 'email', 'tel', 'url', 'password'],
        default: 'email',
        description: 'HTML-тип поля. number включает числовой парсинг (value: number | null).',
      },
      {
        prop: 'placeholder',
        type: 'string',
        group: 'Textfield',
        kind: 'text',
        default: 'you@example.com',
        description: 'Подсказка внутри поля.',
      },
      {
        prop: 'disabled',
        type: 'boolean',
        group: 'State',
        kind: 'boolean',
        default: false,
        description: 'Блокирует ввод и редактирование.',
      },
    ],
    code: (v) => `{
  value: model.$.email,
  component: Input,
  componentProps: { label: 'Email', type: '${v.type}', placeholder: '${v.placeholder}' },
  validators: [required(), email()],
}${v.disabled ? '\n// form.email.disable()' : ''}`,
  },
};
