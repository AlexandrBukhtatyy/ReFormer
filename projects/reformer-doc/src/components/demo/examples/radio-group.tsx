import { useEffect, useMemo, useState } from 'react';
import { createModel, createForm, validateFormModel, useFormControlValue } from '@reformer/core';
import { required } from '@reformer/core/validators';
import { RadioGroup, FormField, Checkbox, Button } from '@reformer/ui-kit';
import { makeFieldVariant } from '../field-demo';
import { useDemoField } from '../harness';
import type { ComponentDocConfig } from '../types';

const LOAN = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'auto', label: 'Авто' },
];

const SIZES = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
];

const BINARY = [
  { value: 'yes', label: 'Да' },
  { value: 'no', label: 'Нет' },
];

const CONTACT = [
  { value: 'phone', label: 'Телефон' },
  { value: 'email', label: 'Email' },
];

const DELIVERY = [
  { value: 'pickup', label: 'Самовывоз' },
  { value: 'courier', label: 'Курьер' },
];

const RELATION = [
  { value: 'spouse', label: 'Супруг(а)' },
  { value: 'parent', label: 'Родитель' },
  { value: 'other', label: 'Другое' },
];

/* ─── Examples (контекстные сценарии) ──────────────────────────────────── */

function FormFieldWiringExample() {
  const [status, setStatus] = useState<string | null>(null);
  const { model, form, schema } = useMemo(() => {
    const model = createModel<{ loanType: string | null }>({ loanType: null });
    const schema = {
      loanType: {
        value: model.$.loanType,
        component: RadioGroup,
        componentProps: { label: 'Тип кредита', options: LOAN, testId: 'loanType' },
        validators: [required({ message: 'Выберите тип кредита' })],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = createForm<any>({ model, schema });
    return { model, form, schema };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // markAsTouched делает ошибку видимой (shouldShowError = touched && invalid).
    form.loanType.markAsTouched();
    const result = await validateFormModel(model, schema);
    setStatus(result.valid ? '✅ Форма валидна' : '❌ Выберите вариант');
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 360 }}
    >
      <FormField control={form.loanType} testId="loanType" />
      <div>
        <Button type="submit">Проверить</Button>
      </div>
      {status && <span style={{ fontSize: '0.9rem' }}>{status}</span>}
    </form>
  );
}

function ModelBindingExample() {
  const { control } = useDemoField({
    initial: 'consumer',
    component: RadioGroup,
    componentProps: { label: 'Тип кредита', options: LOAN },
  });
  const value = useFormControlValue(control);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 360 }}>
      <FormField control={control} />
      <span style={{ fontSize: '0.9rem', color: 'var(--ifm-color-emphasis-700)' }}>
        model.$.loanType: <code>{JSON.stringify(value)}</code>
      </span>
    </div>
  );
}

function ExplicitNameExample() {
  const { form } = useMemo(() => {
    const model = createModel<{ contact: string | null; delivery: string | null }>({
      contact: null,
      delivery: null,
    });
    const schema = {
      contact: {
        value: model.$.contact,
        component: RadioGroup,
        componentProps: { label: 'Способ связи', name: 'contact', options: CONTACT },
      },
      delivery: {
        value: model.$.delivery,
        component: RadioGroup,
        componentProps: { label: 'Доставка', name: 'delivery', options: DELIVERY },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = createForm<any>({ model, schema });
    return { form };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 360 }}>
      <FormField control={form.contact} />
      <FormField control={form.delivery} />
    </div>
  );
}

function DependentDisableExample() {
  const { form } = useMemo(() => {
    const model = createModel<{ hasCoBorrower: boolean; relation: string | null }>({
      hasCoBorrower: false,
      relation: null,
    });
    const schema = {
      hasCoBorrower: {
        value: model.$.hasCoBorrower,
        component: Checkbox,
        componentProps: { label: 'Есть созаёмщик' },
      },
      relation: {
        value: model.$.relation,
        component: RadioGroup,
        componentProps: { label: 'Кто созаёмщик', options: RELATION },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = createForm<any>({ model, schema });
    // Стартовое состояние: без созаёмщика группа заблокирована.
    form.relation.disable();
    return { form };
  }, []);

  const hasCoBorrower = useFormControlValue(form.hasCoBorrower);
  useEffect(() => {
    if (hasCoBorrower) form.relation.enable();
    else form.relation.disable();
  }, [hasCoBorrower, form]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 360 }}>
      <FormField control={form.hasCoBorrower} />
      <FormField control={form.relation} />
    </div>
  );
}

/* ─── Config ───────────────────────────────────────────────────────────── */

export const radioGroupDocConfig: ComponentDocConfig = {
  name: 'RadioGroup',
  importFrom: '@reformer/ui-kit',
  description: 'Группа радио-кнопок из массива options. Одиночный выбор, навигация стрелками.',
  variants: [
    {
      id: 'vertical',
      title: 'Вертикальная группа',
      description:
        'Форма по умолчанию: опции столбцом (flex flex-col gap-2). Одиночный выбор, навигация стрелками.',
      render: makeFieldVariant({
        initial: null,
        component: RadioGroup,
        componentProps: { label: 'Тип кредита', options: LOAN },
      }),
      code: `{
  value: model.$.loanType,
  component: RadioGroup,
  componentProps: { label: 'Тип кредита', options: LOAN },
}`,
    },
    {
      id: 'horizontal',
      title: 'Горизонтальная группа',
      description: 'Та же модель, раскладка в ряд — className="!flex-row gap-6".',
      render: makeFieldVariant({
        initial: null,
        component: RadioGroup,
        componentProps: { label: 'Размер', options: SIZES, className: '!flex-row gap-6' },
      }),
      code: `{
  value: model.$.size,
  component: RadioGroup,
  componentProps: { label: 'Размер', options: SIZES, className: '!flex-row gap-6' },
}`,
    },
    {
      id: 'binary',
      title: 'Бинарная группа',
      description:
        'Частный случай модели — ровно две опции (да/нет). Типичный inline-переключатель.',
      render: makeFieldVariant({
        initial: null,
        component: RadioGroup,
        componentProps: { label: 'Страхование', options: BINARY, className: '!flex-row gap-6' },
      }),
      code: `{
  value: model.$.insurance,
  component: RadioGroup,
  componentProps: {
    label: 'Страхование',
    options: [
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
    className: '!flex-row gap-6',
  },
}`,
    },
  ],
  examples: [
    {
      id: 'required',
      title: 'Обязательный выбор',
      description: 'Валидатор required блокирует submit, пока не выбран вариант.',
      render: makeFieldVariant({
        initial: null,
        component: RadioGroup,
        componentProps: { label: 'Тип кредита', options: LOAN },
        validators: [required({ message: 'Выберите тип' })],
      }),
      code: `{
  value: model.$.loanType,
  component: RadioGroup,
  componentProps: { label: 'Тип кредита', options: LOAN },
  validators: [required({ message: 'Выберите тип' })],
}`,
    },
    {
      id: 'form-field',
      title: 'Интеграция с FormField',
      description:
        'FormField оборачивает группу: label через aria-labelledby, required-маркер, вывод ошибки и aria-invalid по submit.',
      render: FormFieldWiringExample,
      code: `import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required } from '@reformer/core/validators';
import { FormField, RadioGroup, Button } from '@reformer/ui-kit';

const model = createModel<{ loanType: string | null }>({ loanType: null });
const schema = {
  loanType: {
    value: model.$.loanType,
    component: RadioGroup,
    componentProps: { label: 'Тип кредита', options: LOAN },
    validators: [required({ message: 'Выберите тип кредита' })],
  },
};
const form = createForm({ model, schema });

function LoanForm() {
  const onSubmit = async (e) => {
    e.preventDefault();
    form.loanType.markAsTouched();
    const result = await validateFormModel(model, schema);
    if (result.valid) console.log(model.get());
  };
  return (
    <form onSubmit={onSubmit}>
      <FormField control={form.loanType} />
      <Button type="submit">Проверить</Button>
    </form>
  );
}`,
    },
    {
      id: 'model-binding',
      title: 'Привязка к модели формы',
      description:
        'value=model.$.field + onChange идут от состояния формы. useFormControlValue реактивно отдаёт текущий выбор.',
      render: ModelBindingExample,
      code: `import { useFormControlValue } from '@reformer/core';

// value/onChange RadioGroup связаны с моделью через FormField:
// <FormField control={form.loanType} />
const value = useFormControlValue(form.loanType); // string | null`,
    },
    {
      id: 'explicit-name',
      title: 'Явный name для нескольких групп',
      description:
        'Разный name у каждой группы — одиночный выбор и навигация стрелками работают внутри группы отдельно.',
      render: ExplicitNameExample,
      code: `const schema = {
  contact: {
    value: model.$.contact,
    component: RadioGroup,
    componentProps: { label: 'Способ связи', name: 'contact', options: CONTACT },
  },
  delivery: {
    value: model.$.delivery,
    component: RadioGroup,
    componentProps: { label: 'Доставка', name: 'delivery', options: DELIVERY },
  },
};`,
    },
    {
      id: 'dependent-disable',
      title: 'Зависимая блокировка',
      description:
        'disabled группы вычисляется от значения другого поля — доступна только при выполнении условия.',
      render: DependentDisableExample,
      code: `const hasCoBorrower = useFormControlValue(form.hasCoBorrower);

useEffect(() => {
  if (hasCoBorrower) form.relation.enable();
  else form.relation.disable();
}, [hasCoBorrower, form]);`,
    },
  ],
  api: {
    component: RadioGroup,
    initialValue: null,
    baseComponentProps: { label: 'Тип кредита', options: LOAN },
    validators: [required({ message: 'Выберите тип' })],
    valuePresets: [
      { label: 'Ипотека', value: 'mortgage' },
      { label: 'Авто', value: 'auto' },
      { label: 'Очистить', value: null },
    ],
    controls: [
      {
        prop: 'value',
        type: 'string | null',
        group: 'Control',
        kind: 'readonly',
        description: 'Текущее значение; совпадает с одним из options[i].value.',
      },
      {
        prop: 'onChange',
        type: '(value: string) => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Получает event.target.value.',
      },
      {
        prop: 'options',
        type: 'RadioOption[]',
        group: 'Options',
        kind: 'readonly',
        description: 'Массив { value: string; label: string }.',
      },
      {
        prop: 'name',
        type: 'string',
        group: 'Options',
        kind: 'readonly',
        description: 'Native-name группы (одиночный выбор + навигация). Иначе выводится из id.',
      },
      {
        prop: 'className',
        type: 'string',
        group: 'Appearance',
        kind: 'readonly',
        description: 'Раскладка контейнера (для горизонтали — !flex-row).',
      },
      {
        prop: 'onBlur',
        type: '() => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Срабатывает при потере фокуса любым radio.',
      },
      {
        prop: 'disabled',
        type: 'boolean',
        group: 'State',
        kind: 'boolean',
        default: false,
        description: 'Блокирует все варианты.',
      },
    ],
    code: (v) =>
      `{
  value: model.$.loanType,
  component: RadioGroup,
  componentProps: { label: 'Тип кредита', options: LOAN },
  validators: [required()],
}${v.disabled ? '\n// form.loanType.disable()' : ''}`,
  },
};
