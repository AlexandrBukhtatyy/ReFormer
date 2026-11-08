import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { defineIssueMessages } from '@reformer/core/i18n';
import { email, required } from '@reformer/core/validators';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormField as FieldRoot, useFormField } from '@reformer/cdk/form-field';
import { FormField, InfoHint, Input } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

type EmailForm = { email: string };

/** Узел поля: компонент и его пропсы. `required: true` даёт «*» у подписи и aria-required. */
const emailSchema = (model: FormModel<EmailForm>): FormSchemaNode => ({
  children: [
    {
      model: model.$.email,
      component: Input,
      componentProps: {
        label: 'Email',
        type: 'email',
        placeholder: 'you@example.com',
        required: true,
      },
    },
  ],
});

const emailRules = defineValidation<EmailForm>(({ model }) => {
  validate(model.$.email, [required({ code: 'email.required' }), email()]);
});

/** Тексты замечаний: правило несёт код, строку по коду даёт словарь формы. */
const EMAIL_MESSAGES = defineIssueMessages({
  'email.required': 'Введите email',
  email: 'Неверный формат email',
});

/** Проверка при уходе из поля — ошибка видна после первого blur. */
function useEmailForm() {
  return useFormBundle(() =>
    createForm<EmailForm>({
      initial: { email: '' },
      schema: emailSchema,
      validation: { rules: emailRules, strategy: 'blur' },
    })
  );
}

const ERROR: React.CSSProperties = {
  color: 'var(--ifm-color-danger)',
  fontSize: 13,
  margin: '4px 0 0',
};
const LABEL: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 500 };
const DESCRIPTION: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--ifm-color-emphasis-600)',
  margin: '4px 0 0',
};

function AutoRender() {
  const { form } = useEmailForm();
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <ValidationMessagesProvider messages={EMAIL_MESSAGES}>
        <FieldRoot.Root control={form.email}>
          <FieldRoot.Label style={{ ...LABEL, marginBottom: 4 }} />
          <FieldRoot.Control />
          <FieldRoot.Error style={ERROR} />
        </FieldRoot.Root>
      </ValidationMessagesProvider>
    </div>
  );
}

function CustomLayout() {
  const { form } = useEmailForm();
  return (
    <div style={{ maxWidth: 460, width: '100%' }}>
      <ValidationMessagesProvider messages={EMAIL_MESSAGES}>
        <FieldRoot.Root control={form.email} hasDescription>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr',
              gap: 12,
              alignItems: 'start',
            }}
          >
            <FieldRoot.Label style={{ ...LABEL, paddingTop: 8 }} />
            <div>
              <FieldRoot.Control />
              <FieldRoot.Description style={DESCRIPTION}>
                Мы не передаём email третьим сторонам.
              </FieldRoot.Description>
              <FieldRoot.Error style={ERROR} />
            </div>
          </div>
        </FieldRoot.Root>
      </ValidationMessagesProvider>
    </div>
  );
}

const HINT_TEXT = 'Нужен только для отправки чеков';

/** Подсказка-тултип у подписи: видимый триггер — любой, текст для aria — в FormField.Hint. */
function HintLayout() {
  const { form } = useEmailForm();
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <ValidationMessagesProvider messages={EMAIL_MESSAGES}>
        <FieldRoot.Root control={form.email} hasHint>
          {/* Триггер — РЯДОМ с Label, не внутри: клик внутри <label htmlFor> активировал бы поле. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <FieldRoot.Label style={LABEL} />
            <InfoHint content={HINT_TEXT} aria-label="Подсказка: Email" />
          </div>
          <FieldRoot.Hint hidden>{HINT_TEXT}</FieldRoot.Hint>
          <FieldRoot.Control />
          <FieldRoot.Error style={ERROR} />
        </FieldRoot.Root>
      </ValidationMessagesProvider>
    </div>
  );
}

/** Хук без compound-дерева: наборы пропсов раскладываются на свою разметку. */
function EmailInput() {
  const { form } = useEmailForm();
  const { labelProps, controlProps, errorProps, state } = useFormField(form.email);
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <label {...labelProps} style={{ ...LABEL, marginBottom: 4 }}>
        {state.label}
      </label>
      <input
        {...controlProps}
        type="email"
        value={controlProps.value}
        onChange={(event) => controlProps.onChange(event.target.value)}
        style={{
          width: '100%',
          padding: '6px 10px',
          borderRadius: 6,
          border: '1px solid var(--ifm-color-emphasis-400)',
        }}
      />
      {state.shouldShowIssues && state.error && (
        <p {...errorProps} style={ERROR}>
          {state.error}
        </p>
      )}
    </div>
  );
}

/** Словарь формы ставится выше компонента, который вызывает useFormField. */
function HookField() {
  return (
    <ValidationMessagesProvider messages={EMAIL_MESSAGES}>
      <EmailInput />
    </ValidationMessagesProvider>
  );
}

function UiKitField() {
  const { form } = useEmailForm();
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <ValidationMessagesProvider messages={EMAIL_MESSAGES}>
        <FormField control={form.email} />
      </ValidationMessagesProvider>
    </div>
  );
}

export const cdkFormFieldDocConfig: ComponentDocConfig = {
  name: 'FormField (cdk)',
  importFrom: '@reformer/cdk/form-field',
  description:
    'Headless-анатомия поля: Root, Label, Control, Error, Description и Hint со связанными id и aria-атрибутами. Раскладку пишете вы.',
  variants: [
    {
      id: 'auto',
      title: 'Части по умолчанию',
      description:
        'Label берёт текст из componentProps.label, Control рисует компонент узла схемы, Error появляется после ухода из поля.',
      render: AutoRender,
      code: `import { FormField } from '@reformer/cdk/form-field';

<FormField.Root control={form.email}>
  <FormField.Label />
  <FormField.Control />
  <FormField.Error />
</FormField.Root>`,
    },
    {
      id: 'custom',
      title: 'Своя раскладка и описание',
      description:
        'Подпись слева, описание под полем. hasDescription на Root добавляет id описания в aria-describedby поля.',
      render: CustomLayout,
      code: `<FormField.Root control={form.email} hasDescription>
  <div className="grid grid-cols-[110px_1fr] items-start gap-3">
    <FormField.Label />
    <div>
      <FormField.Control />
      <FormField.Description>Мы не передаём email третьим сторонам.</FormField.Description>
      <FormField.Error />
    </div>
  </div>
</FormField.Root>`,
    },
    {
      id: 'hint',
      title: 'Подсказка-тултип у подписи (FormField.Hint)',
      description:
        'Текст тултипа рендерится в портале только в открытом состоянии — сослаться на него из aria-describedby нельзя. FormField.Hint держит тот же текст в скрытом элементе, а hasHint добавляет его id в aria-describedby: скринридер прочитает подсказку при фокусе на поле.',
      render: HintLayout,
      code: `import { FormField } from '@reformer/cdk/form-field';
import { InfoHint } from '@reformer/ui-kit';

<FormField.Root control={form.email} hasHint>
  {/* триггер — рядом с Label, не внутри <label> */}
  <div className="flex items-center gap-1.5">
    <FormField.Label />
    <InfoHint content="Нужен только для отправки чеков" aria-label="Подсказка: Email" />
  </div>
  <FormField.Hint hidden>Нужен только для отправки чеков</FormField.Hint>
  <FormField.Control />
  <FormField.Error />
</FormField.Root>

// В ui-kit это уже собрано: componentProps.labelTooltip у готового FormField.`,
    },
  ],
  examples: [
    {
      id: 'hook',
      title: 'Хук useFormField',
      description:
        'Те же связки без compound-компонентов: labelProps, controlProps и errorProps раскладываются на вашу разметку. controlProps.onChange принимает значение, а не событие.',
      render: HookField,
      code: `import { useFormField } from '@reformer/cdk/form-field';

const { labelProps, controlProps, errorProps, state } = useFormField(form.email);

<>
  <label {...labelProps}>{state.label}</label>
  <input
    {...controlProps}
    type="email"
    onChange={(event) => controlProps.onChange(event.target.value)}
  />
  {state.shouldShowIssues && state.error && <p {...errorProps}>{state.error}</p>}
</>`,
    },
    {
      id: 'ui-kit',
      title: 'Готовый FormField из ui-kit',
      description:
        'В большинстве форм хватает FormField из ui-kit: он собран на этих частях и раскладывает их сам.',
      render: UiKitField,
      code: `import { FormField } from '@reformer/ui-kit';

<FormField control={form.email} />`,
    },
  ],
  props: [
    {
      name: 'FormField.Root',
      type: 'control: FormControl<T>; id?; hasDescription?; hasHint?',
      description:
        'Провайдер контекста, подписан на ноду поля один раз. id — предсказуемые id частей (control-<id>, label-<id>…); hasDescription и hasHint включают id описания и подсказки в aria-describedby.',
    },
    {
      name: 'FormField.Label',
      type: 'children?; forceRender?; asChild?',
      description:
        '<label htmlFor>. Текст — componentProps.label или children; «*» (aria-hidden) при componentProps.required. Без текста не рендерится, если нет forceRender.',
    },
    {
      name: 'FormField.Control',
      type: 'asChild?; children?',
      description:
        'Рисует компонент узла схемы с value, onChange, onBlur, disabled и aria-*. С asChild или children добавляет связки своему элементу.',
    },
    {
      name: 'FormField.Error',
      type: 'multi?; render?; children?; asChild?',
      description:
        '<p role="alert"> с главным замечанием — первой ошибкой, без ошибок — первым предупреждением. Скрыт, пока поле не тронуто и не изменено.',
    },
    {
      name: 'FormField.Description',
      type: 'children; asChild?',
      description: '<p> со стабильным id для aria-describedby (нужен hasDescription на Root).',
    },
    {
      name: 'FormField.Hint',
      type: 'children; asChild?',
      description:
        '<span> со стабильным id для aria-describedby (нужен hasHint на Root) — описание, которое не видно под полем, обычно текст тултипа. Порядок id: hint → description → error.',
    },
    {
      name: 'useFormFieldContext()',
      type: '→ { control, value, issues, error, pending, shouldShowError, shouldShowIssues, ids, label, required, componentProps, … }',
      description: 'Состояние поля для любых потомков Root.',
    },
    {
      name: 'useFormField(control, id?)',
      type: '→ { labelProps, controlProps, errorProps, descriptionProps, hintProps, state, actions, ids }',
      description: 'Все связки без compound-дерева — для полностью своей разметки.',
    },
  ],
};
