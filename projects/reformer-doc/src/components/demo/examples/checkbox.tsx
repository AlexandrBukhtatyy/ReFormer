import { useEffect, useMemo } from 'react';
import { createModel, createForm, useFormControlValue } from '@reformer/core';
import { required } from '@reformer/core/validators';
import { Checkbox, Input, FormField } from '@reformer/ui-kit';
import { useDemoField } from '../harness';
import { makeFieldVariant } from '../field-demo';
import type { ComponentDocConfig } from '../types';

/* ─── Examples (кастомные сценарии) ────────────────────────────────────── */

function ExternalLabelExample() {
  const { control } = useDemoField({
    initial: false,
    component: Checkbox,
    componentProps: {},
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: 380 }}>
      <FormField control={control} />
      <span style={{ fontSize: '0.9rem' }}>
        Принимаю{' '}
        <a href="#terms" onClick={(e) => e.preventDefault()}>
          условия использования
        </a>{' '}
        и политику конфиденциальности
      </span>
    </div>
  );
}

function DependentFieldExample() {
  const { form } = useMemo(() => {
    const model = createModel<{ sameEmail: boolean; billingEmail: string }>({
      sameEmail: true,
      billingEmail: '',
    });
    const schema = {
      sameEmail: {
        value: model.$.sameEmail,
        component: Checkbox,
        componentProps: { label: 'Присылать счета на тот же email' },
      },
      billingEmail: {
        value: model.$.billingEmail,
        component: Input,
        componentProps: { label: 'Email для счетов', type: 'email' },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const form = createForm<{ sameEmail: boolean; billingEmail: string }>({ model, schema });
    return { model, form };
  }, []);

  const sameEmail = useFormControlValue(form.sameEmail);
  useEffect(() => {
    if (sameEmail) form.billingEmail.disable();
    else form.billingEmail.enable();
  }, [sameEmail, form]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 360 }}>
      <FormField control={form.sameEmail} />
      <FormField control={form.billingEmail} />
    </div>
  );
}

/* ─── Config ───────────────────────────────────────────────────────────── */

export const checkboxDocConfig: ComponentDocConfig = {
  name: 'Checkbox',
  importFrom: '@reformer/ui-kit',
  description: 'Булев чекбокс с подписью справа. Контракт value/onChange — boolean.',
  variants: [
    {
      id: 'with-label',
      title: 'С подписью',
      description:
        'Дефолтная форма: контрол + подпись справа (prop label). FormField не дублирует верхний Label для чекбокса.',
      render: makeFieldVariant({
        initial: false,
        component: Checkbox,
        componentProps: { label: 'Согласен с условиями обработки данных' },
      }),
      code: `{
  value: model.$.agree,
  component: Checkbox,
  componentProps: { label: 'Согласен с условиями обработки данных' },
}`,
    },
    {
      id: 'no-label',
      title: 'Только контрол (без подписи)',
      description:
        'Форма без prop label — рендерится один квадрат-контрол, подпись/разметку потребитель собирает снаружи сам.',
      render: makeFieldVariant({
        initial: false,
        component: Checkbox,
        componentProps: {},
      }),
      code: `{
  value: model.$.agree,
  component: Checkbox,
  componentProps: {}, // label опущен — только контрол
}`,
    },
  ],
  examples: [
    {
      id: 'required',
      title: 'Обязательное согласие',
      description:
        'required не пропустит форму, пока чекбокс не отмечен; ошибка показана с touched (submit/blur).',
      render: makeFieldVariant({
        initial: false,
        component: Checkbox,
        componentProps: { label: 'Принимаю условия' },
        validators: [required({ message: 'Необходимо согласие' })],
        touched: true,
      }),
      code: `{
  value: model.$.accept,
  component: Checkbox,
  componentProps: { label: 'Принимаю условия' },
  validators: [required({ message: 'Необходимо согласие' })],
}`,
    },
    {
      id: 'external-label',
      title: 'Внешняя подпись',
      description:
        'Контрол без prop label, обёрнутый вместе с произвольной разметкой (ссылка), когда подпись нужно собрать снаружи.',
      render: ExternalLabelExample,
      code: `// Checkbox без label — подпись собираем в разметке рядом
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
  <FormField control={form.agree} />
  <span>
    Принимаю <a href="/terms">условия использования</a>
  </span>
</div>`,
    },
    {
      id: 'dependent-field',
      title: 'Переключение зависимого поля',
      description:
        'boolean-значение чекбокса реактивно управляет другим полем формы — включает или отключает его.',
      render: DependentFieldExample,
      code: `import { useFormControlValue } from '@reformer/core';

const sameEmail = useFormControlValue(form.sameEmail); // boolean
useEffect(() => {
  if (sameEmail) form.billingEmail.disable();
  else form.billingEmail.enable();
}, [sameEmail, form]);`,
    },
  ],
  api: {
    component: Checkbox,
    initialValue: false,
    baseComponentProps: { label: 'Согласен с условиями' },
    validators: [required({ message: 'Необходимо согласие' })],
    valuePresets: [
      { label: 'Отметить', value: true },
      { label: 'Снять', value: false },
    ],
    controls: [
      {
        prop: 'value',
        type: 'boolean',
        group: 'Control',
        kind: 'readonly',
        description: 'Состояние чекбокса. undefined рендерится как false.',
      },
      {
        prop: 'onChange',
        type: '(value: boolean) => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Получает event.target.checked.',
      },
      {
        prop: 'onBlur',
        type: '() => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Срабатывает при потере фокуса.',
      },
      {
        prop: 'label',
        type: 'string',
        group: 'Textfield',
        kind: 'text',
        default: 'Согласен с условиями',
        description: 'Подпись справа. Без неё рендерится только контрол.',
      },
      {
        prop: 'disabled',
        type: 'boolean',
        group: 'State',
        kind: 'boolean',
        default: false,
        description: 'Блокирует переключение.',
      },
    ],
    code: (v) => `{
  value: model.$.accept,
  component: Checkbox,
  componentProps: { label: '${v.label}' },
  validators: [required()],
}${v.disabled ? '\n// form.accept.disable()' : ''}`,
  },
};
