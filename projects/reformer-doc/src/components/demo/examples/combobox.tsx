import { useState } from 'react';
import { Combobox, ComboboxField, comboboxBasePropsSchema } from '@reformer/ui-kit/combobox';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

const FRAMEWORKS = [
  { value: 'next', label: 'Next.js' },
  { value: 'remix', label: 'Remix' },
  { value: 'astro', label: 'Astro' },
  { value: 'nuxt', label: 'Nuxt.js' },
  { value: 'svelte', label: 'SvelteKit' },
];

const COUNTRIES = [
  { value: 'ru', label: 'Россия' },
  { value: 'by', label: 'Беларусь' },
  { value: 'kz', label: 'Казахстан' },
  { value: 'am', label: 'Армения' },
];

/* ─── Ручная сборка base (управляемый Combobox с локальным состоянием) ─── */

function ControlledComboboxVariant() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <Combobox
        value={value}
        onChange={setValue}
        options={FRAMEWORKS}
        placeholder="Выберите фреймворк"
        searchPlaceholder="Поиск фреймворка..."
        clearable
      />
      <p style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>Выбрано: {value ?? '—'}</p>
    </div>
  );
}

export const comboboxDocConfig: ComponentDocConfig = {
  name: 'Combobox',
  importFrom: '@reformer/ui-kit/combobox',
  description:
    'Автодополнение на композиции Popover + Command + Button: триггер-кнопка с текущим label открывает список опций с поиском. Value-based (value: string | null); для форм — ComboboxField.',
  variants: [
    {
      id: 'single',
      title: 'Одиночный выбор с поиском (options)',
      description:
        'Список inline-опций с поиском по label. Значение — строка (value: string | null).',
      render: makeFieldVariant({
        initial: null,
        component: ComboboxField,
        componentProps: {
          label: 'Фреймворк',
          placeholder: 'Выберите фреймворк',
          searchPlaceholder: 'Поиск...',
          options: FRAMEWORKS,
        },
      }),
      code: `{
  value: model.$.framework,
  component: ComboboxField,
  componentProps: {
    label: 'Фреймворк',
    placeholder: 'Выберите фреймворк',
    searchPlaceholder: 'Поиск...',
    options: [
      { value: 'next', label: 'Next.js' },
      { value: 'remix', label: 'Remix' },
    ],
  },
}`,
    },
    {
      id: 'clearable',
      title: 'С очисткой (clearable)',
      description:
        'clearable=true добавляет крестик; клик по нему (или повторный выбор опции) сбрасывает значение в null через onChange(null).',
      render: makeFieldVariant({
        initial: 'by',
        component: ComboboxField,
        componentProps: {
          label: 'Страна',
          placeholder: 'Выберите страну',
          options: COUNTRIES,
          clearable: true,
        },
      }),
      code: `componentProps: {
  label: 'Страна',
  options: COUNTRIES,
  clearable: true,
}`,
    },
    {
      id: 'controlled-base',
      title: 'Ручная сборка (base, управляемый)',
      description:
        'Форма вне схемы: чистый Combobox варианта base с локальным состоянием (value / onChange). Собран из Popover + Command + Button.',
      render: ControlledComboboxVariant,
      code: `import { Combobox } from '@reformer/ui-kit/combobox';

const [value, setValue] = useState<string | null>(null);

<Combobox
  value={value}
  onChange={setValue}
  options={FRAMEWORKS}
  placeholder="Выберите фреймворк"
  searchPlaceholder="Поиск фреймворка..."
  clearable
/>`,
    },
  ],
  examples: [
    {
      id: 'search-placeholder',
      title: 'Кастомный текст поиска (searchPlaceholder)',
      description:
        'searchPlaceholder задаёт подсказку в поле ввода поиска внутри выпадающего списка.',
      render: makeFieldVariant({
        initial: null,
        component: ComboboxField,
        componentProps: {
          label: 'Фреймворк',
          placeholder: 'Выберите фреймворк',
          searchPlaceholder: 'Начните вводить название...',
          options: FRAMEWORKS,
        },
      }),
      code: `componentProps: {
  label: 'Фреймворк',
  searchPlaceholder: 'Начните вводить название...',
  options: FRAMEWORKS,
}`,
    },
    {
      id: 'empty-state',
      title: 'Пустое состояние (emptyText)',
      description:
        'Когда по запросу ничего не найдено (или список опций пуст) — показывается emptyText.',
      render: makeFieldVariant({
        initial: null,
        component: ComboboxField,
        componentProps: {
          label: 'Фреймворк',
          placeholder: 'Список пуст',
          emptyText: 'Ничего не найдено',
          options: [],
        },
      }),
      code: `componentProps: {
  label: 'Фреймворк',
  emptyText: 'Ничего не найдено',
  options: [],
}`,
    },
    {
      id: 'validation',
      title: 'Обязательный выбор (валидатор)',
      description:
        'validators: [required()] прямо в ноде схемы. touched-поле с пустым значением показывает ошибку.',
      render: makeFieldVariant({
        initial: null,
        component: ComboboxField,
        componentProps: {
          label: 'Фреймворк',
          placeholder: 'Выберите фреймворк',
          options: FRAMEWORKS,
        },
        validators: [required({ message: 'Выберите фреймворк' })],
        touched: true,
      }),
      code: `{
  value: model.$.framework,
  component: ComboboxField,
  componentProps: { label: 'Фреймворк', options: FRAMEWORKS },
  validators: [required({ message: 'Выберите фреймворк' })],
}`,
    },
  ],
  api: {
    component: ComboboxField,
    initialValue: null,
    baseComponentProps: { label: 'Фреймворк', options: FRAMEWORKS },
    validators: [required({ message: 'Выберите фреймворк' })],
    valuePresets: [
      { label: 'Next.js', value: 'next' },
      { label: 'Remix', value: 'remix' },
      { label: 'Очистить (null)', value: null },
    ],
    // Единый источник — props-схема варианта. Ручной controls[] запрещён (§ Props-компаньоны).
    // omit: label/options — задаются baseComponentProps (иначе перетрут initialValues undefined-ами).
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(comboboxBasePropsSchema), {
      omit: ['label', 'options'],
    }),
    code: (v) =>
      `{
  value: model.$.framework,
  component: ComboboxField,
  componentProps: {
    label: 'Фреймворк',
    options: FRAMEWORKS,
    placeholder: '${v.placeholder}',
    searchPlaceholder: '${v.searchPlaceholder}',${v.clearable ? '\n    clearable: true,' : ''}
  },
  validators: [required()],
}`,
  },
};
