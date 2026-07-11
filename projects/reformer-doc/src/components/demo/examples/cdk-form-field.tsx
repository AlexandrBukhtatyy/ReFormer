/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import { createModel, createForm } from '@reformer/core';
import {
  FormField as FieldRoot,
  useFormField,
  useFormFieldContext,
} from '@reformer/cdk/form-field';
import { Input, InputMask, Box, FormField as UiFormField } from '@reformer/ui-kit';
import { FormRenderer, type RenderSchemaFn } from '@reformer/renderer-react';
import { required, email, minLength, pattern } from '@reformer/core/validators';
import { useDemoField } from '../harness';
import type { ComponentDocConfig } from '../types';

// ─── Общий cdk-скелет для витрины форм (Variants) ───────────────────────────
// Один headless-скелет Root/Label/Control/(Description)/Error. Разные ФОРМЫ
// анатомии отличаются составом частей и раскладкой — это и есть варианты.
function Field({
  control,
  description,
  multiError = false,
}: {
  control: any;
  description?: string;
  multiError?: boolean;
}) {
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <FieldRoot.Root control={control} hasDescription={Boolean(description)}>
        <FieldRoot.Label className="block mb-1 text-sm font-medium" />
        <FieldRoot.Control />
        {description ? (
          <FieldRoot.Description
            style={{ fontSize: 12, color: 'var(--ifm-color-emphasis-600)', marginTop: 4 }}
          >
            {description}
          </FieldRoot.Description>
        ) : null}
        <FieldRoot.Error multi={multiError} className="text-destructive text-sm mt-1 block" />
      </FieldRoot.Root>
    </div>
  );
}

// ─── Variants: формы сборки анатомии ────────────────────────────────────────

// Форма 1 — вертикальная анатомия по умолчанию: Label над Control, Error снизу.
function VerticalAnatomy() {
  const { control } = useDemoField({
    initial: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
    validators: [required({ message: 'Введите email' }), email()],
  });
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <FieldRoot.Root control={control as any}>
        <FieldRoot.Label className="block mb-1 text-sm font-medium" />
        <FieldRoot.Control />
        <FieldRoot.Error className="text-destructive text-sm mt-1 block" />
      </FieldRoot.Root>
    </div>
  );
}

// Форма 2 — четыре части: добавлен Description-блок (helper-текст под контролом).
function WithDescription() {
  const { control } = useDemoField({
    initial: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
  });
  return <Field control={control} description="Мы не передаём email третьим сторонам." />;
}

// Форма 3 — горизонтальная раскладка: Label слева, Control+Error справа (grid).
function HorizontalLayout() {
  const { control } = useDemoField({
    initial: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
    validators: [required({ message: 'Введите email' }), email()],
  });
  return (
    <div style={{ maxWidth: 460, width: '100%' }}>
      <FieldRoot.Root control={control as any}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '110px 1fr',
            gap: 12,
            alignItems: 'start',
          }}
        >
          <FieldRoot.Label className="text-sm font-medium" style={{ paddingTop: 8 }} />
          <div>
            <FieldRoot.Control />
            <FieldRoot.Error className="text-destructive text-sm mt-1 block" />
          </div>
        </div>
      </FieldRoot.Root>
    </div>
  );
}

// ─── Examples: рецепты возможностей анатомии ────────────────────────────────

// (1) Кастомный контрол через Control asChild — сторонний контрол (маска),
// value/onChange/onBlur/disabled/aria авто-вяжутся через Slot.
function CustomControl() {
  const { control } = useDemoField({
    initial: '',
    component: Input, // не используется: asChild подменяет контрол
    componentProps: { label: 'Телефон' },
  });
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <FieldRoot.Root control={control as any}>
        <FieldRoot.Label className="block mb-1 text-sm font-medium" />
        <FieldRoot.Control asChild>
          <InputMask mask="+7 (999) 999-99-99" placeholder="+7 (___) ___-__-__" />
        </FieldRoot.Control>
        <FieldRoot.Error className="text-destructive text-sm mt-1 block" />
      </FieldRoot.Root>
    </div>
  );
}

// (2) Свой элемент лейбла с сохранением htmlFor/id. Берём ids/label из контекста
// Root и рендерим собственный <label> — a11y-связь с Control остаётся корректной.
function CustomLabelInner() {
  const { ids, label, required } = useFormFieldContext<string>();
  return (
    <label
      htmlFor={ids.controlId}
      id={ids.labelId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
        fontWeight: 600,
        fontSize: 14,
      }}
    >
      <span aria-hidden>✉️</span> {label}
      {required ? ' *' : ''}
    </label>
  );
}

function CustomLabel() {
  const { control } = useDemoField({
    initial: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
    validators: [required({ message: 'Введите email' }), email()],
  });
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <FieldRoot.Root control={control as any}>
        <CustomLabelInner />
        <FieldRoot.Control />
        <FieldRoot.Error className="text-destructive text-sm mt-1 block" />
      </FieldRoot.Root>
    </div>
  );
}

// (3) Обогащённый текст лейбла + forceRender: доп. контент в лейбле и рендер
// обёртки даже без label-текста из ноды.
function EnrichedLabel() {
  const { control } = useDemoField({
    initial: '',
    component: Input,
    componentProps: { placeholder: 'https://example.com' },
  });
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <FieldRoot.Root control={control as any}>
        <FieldRoot.Label forceRender className="block mb-1 text-sm font-medium">
          Сайт{' '}
          <span style={{ color: 'var(--ifm-color-emphasis-600)', fontWeight: 400 }}>
            (необязательно)
          </span>
        </FieldRoot.Label>
        <FieldRoot.Control />
        <FieldRoot.Error className="text-destructive text-sm mt-1 block" />
      </FieldRoot.Root>
    </div>
  );
}

// (4) Кастомный рендер ошибок: своя разметка на каждую ошибку, цвет по severity.
const lowercaseHint = (value: string) =>
  value && !/[A-ZА-Я]/.test(value)
    ? {
        code: 'no-uppercase',
        message: 'Совет: добавьте заглавную букву',
        severity: 'warning' as const,
      }
    : null;

function ErrorRenderField() {
  const { control } = useDemoField({
    initial: 'pass',
    component: Input,
    componentProps: { label: 'Пароль', type: 'password' },
    validators: [minLength(8, { message: 'Минимум 8 символов' }), lowercaseHint],
    touched: true,
  });
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <FieldRoot.Root control={control as any}>
        <FieldRoot.Label className="block mb-1 text-sm font-medium" />
        <FieldRoot.Control />
        <FieldRoot.Error
          render={(err) => (
            <span
              style={{
                display: 'block',
                fontSize: 13,
                marginTop: 4,
                color:
                  err.severity === 'warning'
                    ? 'var(--ifm-color-warning-dark, #b45309)'
                    : 'var(--ifm-color-danger, #dc2626)',
              }}
            >
              {err.message}
            </span>
          )}
        />
      </FieldRoot.Root>
    </div>
  );
}

// (5) Все ошибки списком: Error multi перечисляет все проваленные валидаторы.
function MultipleErrors() {
  const { control } = useDemoField({
    initial: 'ab',
    component: Input,
    componentProps: { label: 'Пароль', type: 'password' },
    validators: [
      minLength(8, { message: 'Минимум 8 символов' }),
      pattern(/[0-9]/, { message: 'Добавьте хотя бы одну цифру' }),
    ],
    touched: true,
  });
  return <Field control={control} multiError />;
}

// (6) Хук useFormField: собственный DOM без compound-компонентов из prop-getters.
function HookField() {
  const { control } = useDemoField({
    initial: '',
    component: Input,
    componentProps: { label: 'Никнейм', required: true },
    validators: [
      required({ message: 'Укажите никнейм' }),
      minLength(3, { message: 'Минимум 3 символа' }),
    ],
    touched: true,
  });
  const { labelProps, controlProps, errorProps, descriptionProps, state, ids } = useFormField(
    control as any
  );
  const describedBy =
    [ids.descriptionId, state.shouldShowError ? ids.errorId : null].filter(Boolean).join(' ') ||
    undefined;
  // Нативный <input> не принимает value: FormValue (в union есть boolean) — исключаем
  // value из spread и задаём строкой явно.
  const { value: fieldValue, ...restControlProps } = controlProps;
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <label
        {...labelProps}
        style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}
      >
        {state.label}
        {state.required ? ' *' : ''}
      </label>
      <input
        {...restControlProps}
        value={typeof fieldValue === 'string' ? fieldValue : ''}
        aria-describedby={describedBy}
        onChange={(e) => controlProps.onChange(e.target.value)}
        placeholder="ivan_2024"
        style={{
          width: '100%',
          padding: '8px 10px',
          border: '1px solid var(--ifm-color-emphasis-300)',
          borderRadius: 6,
        }}
      />
      <p
        {...descriptionProps}
        style={{ fontSize: 12, color: 'var(--ifm-color-emphasis-600)', marginTop: 4 }}
      >
        Публичное имя, 3–20 символов.
      </p>
      {state.shouldShowError ? (
        <p
          {...errorProps}
          style={{ color: 'var(--ifm-color-danger, #dc2626)', fontSize: 13, marginTop: 4 }}
        >
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

// (7) useFormFieldContext: чтение состояния из произвольного ребёнка (счётчик символов).
function CharCount() {
  const { value } = useFormFieldContext<string>();
  return (
    <small style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ifm-color-emphasis-600)' }}>
      {(value ?? '').length}/20
    </small>
  );
}

function ContextField() {
  const { control } = useDemoField({
    initial: 'Иван',
    component: Input,
    componentProps: { label: 'Имя' },
  });
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <FieldRoot.Root control={control as any}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FieldRoot.Label className="block mb-1 text-sm font-medium" />
          <CharCount />
        </div>
        <FieldRoot.Control />
        <FieldRoot.Error className="text-destructive text-sm mt-1 block" />
      </FieldRoot.Root>
    </div>
  );
}

// (8) Индикатор async-валидации: читаем pending из контекста и рисуем «Проверка…».
const checkUnique = async (value: string) => {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return value.trim().toLowerCase() === 'taken@example.com'
    ? { code: 'taken', message: 'Этот email уже занят' }
    : null;
};

function PendingBadge() {
  const { pending } = useFormFieldContext();
  if (!pending) return null;
  return (
    <span
      role="status"
      aria-live="polite"
      style={{ fontSize: 12, color: 'var(--ifm-color-emphasis-600)' }}
    >
      Проверка…
    </span>
  );
}

function AsyncPending() {
  const { form } = useMemo(() => {
    const model = createModel<{ email: string }>({ email: '' });
    const schema = {
      email: {
        value: model.$.email,
        component: Input,
        componentProps: { label: 'Email', type: 'email', placeholder: 'taken@example.com' },
        validators: [required(), email()],
        asyncValidators: [checkUnique],
      },
    } as any;
    const form = createForm<{ email: string }>({ model, schema });
    return { form: form as any };
  }, []);
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <FieldRoot.Root control={form.email}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FieldRoot.Label className="block mb-1 text-sm font-medium" />
          <PendingBadge />
        </div>
        <FieldRoot.Control />
        <FieldRoot.Error className="text-destructive text-sm mt-1 block" />
      </FieldRoot.Root>
    </div>
  );
}

// (9) Готовый FormField из ui-kit — Label→Control→Error одной строкой поверх cdk.
function UiKitField() {
  const { control } = useDemoField({
    initial: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
    validators: [required({ message: 'Введите email' }), email()],
  });
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <UiFormField control={control} />
    </div>
  );
}

// (10) FormField как fieldWrapper для FormRenderer — единый рендер всех полей схемы.
type WrapperShape = { email: string; phone: string };

function FieldWrapperDemo() {
  const { renderSchema } = useMemo(() => {
    const model = createModel<WrapperShape>({ email: '', phone: '' });
    const schema = {
      email: {
        value: model.$.email,
        component: Input,
        componentProps: { label: 'Email', type: 'email' },
        validators: [required(), email()],
      },
      phone: {
        value: model.$.phone,
        component: InputMask,
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
      },
    } as any;
    createForm<WrapperShape>({ model, schema });
    const renderSchema: RenderSchemaFn<WrapperShape> = () =>
      ({
        component: Box,
        children: [
          {
            value: model.$.email,
            component: Input,
            componentProps: { label: 'Email', type: 'email' },
          },
          {
            value: model.$.phone,
            component: InputMask,
            componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
          },
        ],
      }) as any;
    return { renderSchema };
  }, []);
  return (
    <div style={{ maxWidth: 380, width: '100%', display: 'grid', gap: 12 }}>
      <FormRenderer render={renderSchema} settings={{ fieldWrapper: UiFormField }} />
    </div>
  );
}

export const cdkFormFieldDocConfig: ComponentDocConfig = {
  name: 'FormField (cdk)',
  importFrom: '@reformer/cdk/form-field',
  description:
    'Headless-анатомия поля: Root/Label/Control/Error/Description с автопровязкой id и aria. ' +
    'Variants — формы сборки анатомии (вертикальная / с описанием / горизонтальная раскладка), ' +
    'Examples — рецепты возможностей (asChild, render-props, хуки, async, ui-kit-обёртка). ' +
    'Состояния (пусто / заполнено / disabled / invalid) смотрите в табе API. UI вы строите сами.',
  variants: [
    {
      id: 'vertical',
      title: 'Вертикальная анатомия (baseline)',
      description:
        'Форма по умолчанию: Label над Control, Error снизу. Label и Control берут текст/компонент из ноды схемы, Error скрыт до touch.',
      render: VerticalAnatomy,
      code: `import { FormField } from '@reformer/cdk/form-field';

<FormField.Root control={form.email}>
  <FormField.Label />
  <FormField.Control />
  <FormField.Error />
</FormField.Root>`,
    },
    {
      id: 'with-description',
      title: 'С описанием (Description-part)',
      description:
        'Форма из четырёх частей: добавлен FormField.Description — helper-текст под контролом. hasDescription на Root авто-вяжет aria-describedby.',
      render: WithDescription,
      code: `<FormField.Root control={form.email} hasDescription>
  <FormField.Label />
  <FormField.Control />
  <FormField.Description>Мы не передаём email третьим сторонам.</FormField.Description>
  <FormField.Error />
</FormField.Root>`,
    },
    {
      id: 'horizontal',
      title: 'Горизонтальная раскладка',
      description:
        'Label слева, Control и Error справа (grid-обёртка вокруг частей). Headless не навязывает DOM — раскладку задаёте вы, id/aria провязываются в любом порядке.',
      render: HorizontalLayout,
      code: `<FormField.Root control={form.email}>
  <div className="grid grid-cols-[110px_1fr] gap-3 items-start">
    <FormField.Label className="pt-2 text-sm font-medium" />
    <div>
      <FormField.Control />
      <FormField.Error />
    </div>
  </div>
</FormField.Root>`,
    },
  ],
  examples: [
    {
      id: 'as-child-control',
      title: 'Кастомный контрол через asChild',
      description:
        'Control asChild подключает сторонний/незарегистрированный контрол (маска и т.п.): value/onChange/onBlur/disabled/aria авто-вяжутся через Slot.',
      render: CustomControl,
      code: `<FormField.Root control={form.phone}>
  <FormField.Label />
  <FormField.Control asChild>
    <InputMask mask="+7 (999) 999-99-99" />
  </FormField.Control>
  <FormField.Error />
</FormField.Root>`,
    },
    {
      id: 'custom-label',
      title: 'Свой элемент лейбла',
      description:
        'ids/label/required из useFormFieldContext позволяют собрать собственный <label> (иконка, Typography и т.п.), сохранив htmlFor/id-связь с контролом.',
      render: CustomLabel,
      code: `function CustomLabel() {
  const { ids, label, required } = useFormFieldContext<string>();
  return (
    <label htmlFor={ids.controlId} id={ids.labelId}>
      <MailIcon /> {label}{required && ' *'}
    </label>
  );
}

<FormField.Root control={form.email}>
  <CustomLabel />
  <FormField.Control />
</FormField.Root>`,
    },
    {
      id: 'enriched-label',
      title: 'Обогащённый лейбл + forceRender',
      description:
        'FormField.Label children добавляет доп. контент («(необязательно)», иконку); forceRender рендерит обёртку даже без label-текста из ноды.',
      render: EnrichedLabel,
      code: `<FormField.Label forceRender>
  Сайт <span className="text-muted">(необязательно)</span>
</FormField.Label>`,
    },
    {
      id: 'error-render',
      title: 'Кастомный рендер ошибок',
      description:
        'FormField.Error render — своя разметка на каждую ошибку, напр. разный цвет по err.severity (warning / error).',
      render: ErrorRenderField,
      code: `<FormField.Error
  render={(err) => (
    <span className={err.severity === 'warning' ? 'text-amber-600' : 'text-red-600'}>
      {err.message}
    </span>
  )}
/>`,
    },
    {
      id: 'multi-error',
      title: 'Все ошибки списком (Error multi)',
      description:
        'FormField.Error multi — перечисляет все проваленные валидаторы поля; id/aria-errormessage остаются на первой ошибке. Здесь touched-демо, чтобы ошибки показались сразу.',
      render: MultipleErrors,
      code: `password: {
  value: model.$.password,
  component: Input,
  componentProps: { label: 'Пароль', type: 'password' },
  validators: [
    minLength(8, { message: 'Минимум 8 символов' }),
    pattern(/[0-9]/, { message: 'Добавьте хотя бы одну цифру' }),
  ],
}

<FormField.Error multi />`,
    },
    {
      id: 'use-form-field',
      title: 'Хук useFormField',
      description:
        'Собственный DOM без compound-компонентов: labelProps/controlProps/errorProps/descriptionProps + state + actions спредятся на свои элементы.',
      render: HookField,
      code: `import { useFormField } from '@reformer/cdk/form-field';

const { labelProps, controlProps, errorProps, state, ids } = useFormField(form.username);

<label {...labelProps}>{state.label}{state.required && ' *'}</label>
<input {...controlProps} onChange={(e) => controlProps.onChange(e.target.value)} />
{state.shouldShowError && <p {...errorProps}>{state.error}</p>}`,
    },
    {
      id: 'use-context',
      title: 'Состояние через useFormFieldContext',
      description:
        'Читать value/required/error/pending из произвольного ребёнка — счётчик символов, бейдж состояния рядом с лейблом.',
      render: ContextField,
      code: `import { useFormFieldContext } from '@reformer/cdk/form-field';

function CharCount() {
  const { value } = useFormFieldContext<string>();
  return <small>{value.length}/20</small>;
}

<FormField.Root control={form.name}>
  <div className="flex items-center gap-2">
    <FormField.Label />
    <CharCount />
  </div>
  <FormField.Control />
</FormField.Root>`,
    },
    {
      id: 'async-pending',
      title: 'Индикатор async-валидации',
      description:
        'Читаем pending из контекста и рисуем «Проверка…» пока идёт асинхронная валидация. Введите taken@example.com — покажется ошибка занятости.',
      render: AsyncPending,
      code: `function PendingBadge() {
  const { pending } = useFormFieldContext();
  return pending ? <Spinner aria-label="Проверяем…" /> : null;
}

email: {
  value: model.$.email,
  component: Input,
  validators: [required(), email()],
  asyncValidators: [checkEmailUnique],
}`,
    },
    {
      id: 'ui-kit',
      title: 'Готовый FormField из ui-kit',
      description:
        'В большинстве форм достаточно ui-kit FormField, собранного на этих блоках — Label→Control→Error за вас, без спуска на уровень cdk.',
      render: UiKitField,
      code: `import { FormField } from '@reformer/ui-kit';

// Один универсальный компонент вместо ручной анатомии:
<FormField control={form.email} />`,
    },
    {
      id: 'field-wrapper',
      title: 'FormField как fieldWrapper',
      description:
        'Передать ui-kit FormField в FormRenderer как обёртку всех полей схемы — единый рендер поля для декларативной формы.',
      render: FieldWrapperDemo,
      code: `import { FormRenderer, Box } from '@reformer/renderer-react';
import { FormField, Input } from '@reformer/ui-kit';

const renderSchema = () => ({
  component: Box,
  children: [
    { value: model.$.email, component: Input },
    { value: model.$.phone, component: InputMask },
  ],
});

<FormRenderer render={renderSchema} settings={{ fieldWrapper: FormField }} />`,
    },
  ],
  props: [
    {
      name: 'FormField.Root',
      type: 'control: FieldNode<T>, hasDescription?',
      description:
        'Провайдер контекста; подписывается на useFormControl один раз. hasDescription авто-вяжет aria-describedby.',
    },
    {
      name: 'FormField.Label',
      type: 'asChild?, children?, forceRender?',
      description: '<label> с htmlFor; текст из componentProps.label, «*» при required.',
    },
    {
      name: 'FormField.Control',
      type: 'asChild?',
      description:
        'Auto-рендер control.component (value/onChange/onBlur/disabled/aria-*) или Slot в свой элемент.',
    },
    {
      name: 'FormField.Error',
      type: 'multi?, render?',
      description: '<p role="alert"> с ошибкой; скрыт, пока shouldShowError=false.',
    },
    {
      name: 'FormField.Description',
      type: 'asChild?',
      description: '<p> с id для aria-describedby (нужен hasDescription на Root).',
    },
    {
      name: 'useFormField(control)',
      type: '→ { labelProps, controlProps, errorProps, descriptionProps, state, actions, ids }',
      description: 'Prop-getters для собственного DOM без compound-компонентов.',
    },
    {
      name: 'useFormFieldContext()',
      type: '→ { control, value, errors, ids, componentProps, pending, required }',
      description: 'Доступ к состоянию из произвольных детей.',
    },
  ],
};
