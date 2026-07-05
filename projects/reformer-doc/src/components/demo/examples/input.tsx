import { useMemo, useState } from 'react';
import { createModel, createForm, validateFormModel, useFormControlValue } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { Input, FormField, Button } from '@reformer/ui-kit';
import { useDemoField } from '../harness';
import type { ComponentDocConfig } from '../types';

/* ─── Variants (schema-driven пресеты) ─────────────────────────────────── */

function TextVariant() {
  const { control } = useDemoField({
    initial: '',
    component: Input,
    componentProps: { label: 'Имя', placeholder: 'Иван Иванов' },
  });
  return <FormField control={control} />;
}

function EmailVariant() {
  const { control } = useDemoField({
    initial: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
    validators: [required({ message: 'Email обязателен' }), email({ message: 'Неверный email' })],
  });
  return <FormField control={control} />;
}

function NumberVariant() {
  const { control } = useDemoField({
    initial: null,
    component: Input,
    componentProps: { label: 'Возраст', type: 'number', min: 0 },
  });
  return <FormField control={control} />;
}

function PlaceholderVariant() {
  const { control } = useDemoField({
    initial: '',
    component: Input,
    componentProps: { label: 'Город', placeholder: 'Начните вводить…' },
  });
  return <FormField control={control} />;
}

function DisabledVariant() {
  const { control } = useDemoField({
    initial: 'usr_10428',
    component: Input,
    componentProps: { label: 'ID (только чтение)' },
    disabled: true,
  });
  return <FormField control={control} />;
}

/* ─── Examples (контекстные сценарии) ──────────────────────────────────── */

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
        Текущее значение: <code>{JSON.stringify(value)}</code>
      </span>
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
      description: 'Базовое строковое поле.',
      render: TextVariant,
      code: `{
  value: model.$.name,
  component: Input,
  componentProps: { label: 'Имя', placeholder: 'Иван Иванов' },
}`,
    },
    {
      id: 'email',
      title: 'Email + валидация',
      description: 'type="email" и валидаторы прямо в ноде схемы.',
      render: EmailVariant,
      code: `{
  value: model.$.email,
  component: Input,
  componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
  validators: [required(), email()],
}`,
    },
    {
      id: 'number',
      title: 'Число',
      description: 'type="number" — value приходит как number | null.',
      render: NumberVariant,
      code: `{
  value: model.$.age,
  component: Input,
  componentProps: { label: 'Возраст', type: 'number', min: 0 },
}`,
    },
    {
      id: 'placeholder',
      title: 'С подсказкой',
      description: 'placeholder внутри поля.',
      render: PlaceholderVariant,
      code: `{
  value: model.$.city,
  component: Input,
  componentProps: { label: 'Город', placeholder: 'Начните вводить…' },
}`,
    },
    {
      id: 'disabled',
      title: 'Только чтение',
      description: 'Отключённое поле — через control.disable().',
      render: DisabledVariant,
      code: `const form = createForm({ model, schema });
form.id.disable(); // поле только для чтения`,
    },
  ],
  examples: [
    {
      id: 'form-binding',
      title: 'Привязка к форме с валидацией',
      description:
        'Полный M1-поток: createModel → schema → createForm → FormField. Ошибки показываются под полем.',
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
      id: 'number-value',
      title: 'Числовое поле и чтение значения',
      description: 'useFormControlValue реактивно отдаёт текущее значение поля.',
      render: NumberValueExample,
      code: `import { useFormControlValue } from '@reformer/core';

const value = useFormControlValue(form.amount); // number | null
// <FormField control={form.amount} /> — type: 'number' в схеме`,
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
