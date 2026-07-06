import { useState } from 'react';
import { useFormControlValue } from '@reformer/core';
import { required, minLength, maxLength } from '@reformer/core/validators';
import { Textarea, FormField } from '@reformer/ui-kit';
import { useDemoField } from '../harness';
import { makeFieldVariant } from '../field-demo';
import type { ComponentDocConfig } from '../types';

/* ─── Examples (контекстные приёмы) ────────────────────────────────────── */

const COUNTER_MAX = 280;

/** onChange + нативный maxLength: живой счётчик оставшихся символов. */
function CharCounterExample() {
  const { control } = useDemoField({
    initial: '',
    component: Textarea,
    componentProps: { label: 'Пост', placeholder: 'Что нового?', maxLength: COUNTER_MAX },
  });
  const value = useFormControlValue(control);
  const used = value ? String(value).length : 0;
  const left = COUNTER_MAX - used;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 380 }}>
      <FormField control={control} />
      <span
        style={{
          alignSelf: 'flex-end',
          fontSize: '0.85rem',
          color: left < 20 ? 'var(--ifm-color-danger)' : 'var(--ifm-color-emphasis-700)',
        }}
      >
        Осталось {left} из {COUNTER_MAX}
      </span>
    </div>
  );
}

/** onBlur: нормализация значения (trim + схлопывание пробелов) при уходе из поля. */
function NormalizeOnBlurExample() {
  const [value, setValue] = useState<string | null>('   Много    лишних   пробелов   ');
  return (
    <div style={{ maxWidth: 380 }}>
      <Textarea
        value={value}
        placeholder="Текст нормализуется при потере фокуса"
        onChange={setValue}
        onBlur={() => setValue((prev) => (prev ? prev.trim().replace(/\s+/g, ' ') : prev))}
      />
    </div>
  );
}

export const textareaDocConfig: ComponentDocConfig = {
  name: 'Textarea',
  importFrom: '@reformer/ui-kit',
  description: 'Многострочное текстовое поле. Вертикальный resize.',
  variants: [
    {
      id: 'basic',
      title: 'Базовое',
      description: 'Подпись и подсказка, поле пустое.',
      render: makeFieldVariant({
        initial: '',
        component: Textarea,
        componentProps: { label: 'Комментарий', placeholder: 'Опишите проблему' },
      }),
      code: `{
  value: model.$.comment,
  component: Textarea,
  componentProps: { label: 'Комментарий', placeholder: 'Опишите проблему' },
}`,
    },
    {
      id: 'filled',
      title: 'Заполнено',
      description: 'Поле с введённым значением.',
      render: makeFieldVariant({
        initial: 'Кнопка отправки не реагирует на клик в Safari.',
        component: Textarea,
        componentProps: { label: 'Комментарий' },
      }),
      code: `{
  value: model.$.comment, // 'Кнопка отправки не реагирует…'
  component: Textarea,
  componentProps: { label: 'Комментарий' },
}`,
    },
    {
      id: 'placeholder-only',
      title: 'Только placeholder',
      description: 'Без подписи — только подсказка внутри поля.',
      render: makeFieldVariant({
        initial: '',
        component: Textarea,
        componentProps: { placeholder: 'Опишите проблему…' },
      }),
      code: `{
  value: model.$.comment,
  component: Textarea,
  componentProps: { placeholder: 'Опишите проблему…' },
}`,
    },
    {
      id: 'required',
      title: 'Обязательное',
      description: 'required-маркер (*) у подписи.',
      render: makeFieldVariant({
        initial: '',
        component: Textarea,
        componentProps: { label: 'Комментарий', required: true },
      }),
      code: `{
  value: model.$.comment,
  component: Textarea,
  componentProps: { label: 'Комментарий', required: true },
}`,
    },
    {
      id: 'invalid',
      title: 'Ошибка',
      description: 'Деструктивная рамка/ring и текст ошибки под полем.',
      render: makeFieldVariant({
        initial: 'Мало',
        component: Textarea,
        componentProps: { label: 'Комментарий' },
        validators: [minLength(10, { message: 'Не менее 10 символов' })],
        touched: true,
      }),
      code: `{
  value: model.$.comment, // 'Мало'
  component: Textarea,
  componentProps: { label: 'Комментарий' },
  validators: [minLength(10, { message: 'Не менее 10 символов' })],
}`,
    },
    {
      id: 'disabled',
      title: 'Заблокировано',
      description: 'Отключённое пустое поле (opacity, cursor-not-allowed).',
      render: makeFieldVariant({
        initial: '',
        component: Textarea,
        componentProps: { label: 'Комментарий' },
        disabled: true,
      }),
      code: `const form = createForm({ model, schema });
form.comment.disable(); // opacity-50, cursor-not-allowed`,
    },
    {
      id: 'disabled-filled',
      title: 'Заблокировано с текстом',
      description: 'Отключённое поле с содержимым — read-only-подобная витрина.',
      render: makeFieldVariant({
        initial: 'Значение только для чтения.',
        component: Textarea,
        componentProps: { label: 'Комментарий' },
        disabled: true,
      }),
      code: `const form = createForm({ model, schema });
form.comment.disable(); // содержимое остаётся видимым`,
    },
    {
      id: 'maxlength',
      title: 'С нативным лимитом',
      description: 'maxLength — нативный soft-лимит длины (обрезает ввод).',
      render: makeFieldVariant({
        initial: '',
        component: Textarea,
        componentProps: { label: 'Отзыв (до 200 символов)', maxLength: 200 },
      }),
      code: `{
  value: model.$.review,
  component: Textarea,
  componentProps: { label: 'Отзыв', maxLength: 200 },
}`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Обязательное поле с бизнес-лимитом длины',
      description:
        'Валидаторы @reformer/core: required() и maxLength(500) как бизнес-правило (в отличие от нативного props maxLength).',
      render: makeFieldVariant({
        initial: '',
        component: Textarea,
        componentProps: { label: 'Комментарий', placeholder: 'Не менее пары слов' },
        validators: [required({ message: 'Заполните комментарий' }), maxLength(500)],
      }),
      code: `import { required, maxLength } from '@reformer/core/validators';

{
  value: model.$.comment,
  component: Textarea,
  componentProps: { label: 'Комментарий' },
  validators: [required(), maxLength(500)],
}`,
    },
    {
      id: 'char-counter',
      title: 'Счётчик оставшихся символов',
      description:
        'useFormControlValue реактивно читает значение; нативный maxLength даёт hard-cap ввода.',
      render: CharCounterExample,
      code: `import { useFormControlValue } from '@reformer/core';

function CharCounter({ control, max }) {
  const value = useFormControlValue(control); // string | null
  const left = max - (value?.length ?? 0);
  return <span>Осталось {left} из {max}</span>;
}

// componentProps: { label: 'Пост', maxLength: 280 }`,
    },
    {
      id: 'normalize-blur',
      title: 'Нормализация текста на потере фокуса',
      description:
        'Приём: onBlur тримит значение и схлопывает лишние пробелы/переводы строк при уходе из поля.',
      render: NormalizeOnBlurExample,
      code: `import { useState } from 'react';
import { Textarea } from '@reformer/ui-kit';

function NoteField() {
  const [value, setValue] = useState<string | null>('');
  return (
    <Textarea
      value={value}
      onChange={setValue}
      onBlur={() => setValue((v) => (v ? v.trim().replace(/\\s+/g, ' ') : v))}
    />
  );
}`,
    },
  ],
  api: {
    component: Textarea,
    initialValue: '',
    baseComponentProps: { label: 'Комментарий' },
    valuePresets: [
      { label: 'Текст', value: 'Пример комментария' },
      { label: 'Очистить', value: '' },
    ],
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
        prop: 'maxLength',
        type: 'number',
        group: 'Control',
        kind: 'readonly',
        description: 'Нативный hard-лимит длины (soft-protection UI).',
      },
      {
        prop: 'placeholder',
        type: 'string',
        group: 'Textfield',
        kind: 'text',
        default: 'Введите текст',
        description: 'Подсказка внутри поля.',
      },
      {
        prop: 'rows',
        type: 'number',
        group: 'Appearance',
        kind: 'number',
        default: 3,
        min: 2,
        max: 12,
        description: 'Видимая высота в строках.',
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
  value: model.$.comment,
  component: Textarea,
  componentProps: { label: 'Комментарий', placeholder: '${v.placeholder}', rows: ${v.rows} },
}${v.disabled ? '\n// form.comment.disable()' : ''}`,
  },
};
