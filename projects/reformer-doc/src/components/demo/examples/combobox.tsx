import { useState } from 'react';
import {
  Combobox,
  ComboboxField,
  ComboboxMultiField,
  ComboboxTreeField,
  ComboboxTreeMultiField,
  comboboxBasePropsSchema,
} from '@reformer/ui-kit/combobox';
import type { TreeNode } from '@reformer/ui-kit';
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

/**
 * Дерево файлов для вариантов ComboboxTree. Плоского `options` тут не хватает: у выбора есть
 * иерархия, а значением поля становится `id` узла — для файла это полный путь, поэтому он же
 * годится и адресом узла в дереве.
 */
const FILES: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    kind: 'branch',
    children: [
      {
        id: 'src/components',
        label: 'components',
        kind: 'branch',
        children: [
          { id: 'src/components/combobox.tsx', label: 'combobox.tsx' },
          { id: 'src/components/tree.tsx', label: 'tree.tsx' },
        ],
      },
      { id: 'src/index.ts', label: 'index.ts' },
      { id: 'src/theme.css', label: 'theme.css' },
    ],
  },
  { id: 'package.json', label: 'package.json' },
  { id: 'README.md', label: 'README.md' },
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
    {
      id: 'multi',
      title: 'Множественный выбор (ComboboxMulti)',
      description:
        'Тот же рецепт Popover + Command, но со списком-чекбоксами и чипами в триггере. Список НЕ закрывается после выбора и не сбрасывает поиск — иначе отметить несколько подряд было бы нельзя.',
      render: makeFieldVariant({
        initial: null,
        component: ComboboxMultiField,
        componentProps: {
          label: 'Фреймворки',
          options: FRAMEWORKS,
          placeholder: 'Выберите фреймворки',
          clearable: true,
        },
      }),
      code: `{
  value: model.signalAt('frameworks')!,
  component: ComboboxMultiField,
  componentProps: { options: FRAMEWORKS, clearable: true },
}`,
    },
    {
      id: 'tree',
      title: 'Выбор узла иерархии (ComboboxTree)',
      description:
        'Вместо плоского options — дерево (nodes); значение поля это id выбранного узла, для файла — его полный путь. По умолчанию selectable="leaf": щелчок по каталогу раскрывает его, а не выбирает. Список в поповере — Tree кита, а не Command: cmdk при поиске размонтирует несовпавшие строки вместе с детьми, чего иерархия не переживает.',
      render: makeFieldVariant({
        initial: null,
        component: ComboboxTreeField,
        componentProps: {
          label: 'Файл',
          nodes: FILES,
          placeholder: 'Выберите файл',
          clearable: true,
        },
      }),
      code: `{
  value: model.$.file,
  component: ComboboxTreeField,
  componentProps: {
    label: 'Файл',
    nodes: FILES,
    placeholder: 'Выберите файл',
    clearable: true,
  },
}`,
    },
    {
      id: 'tree-multi',
      title: 'Несколько узлов иерархии (ComboboxTreeMulti)',
      description:
        'Тот же список-дерево, но с чипами в триггере и набором адресов в значении (string[] | null; пустой выбор эмитится как null, никогда не []). Поповер после выбора не закрывается и поиск не сбрасывает — иначе отметить несколько файлов подряд было бы нельзя.',
      render: makeFieldVariant({
        initial: null,
        component: ComboboxTreeMultiField,
        componentProps: {
          label: 'Файлы',
          nodes: FILES,
          placeholder: 'Выберите файлы',
          clearable: true,
        },
      }),
      code: `{
  value: model.signalAt('files')!,
  component: ComboboxTreeMultiField,
  componentProps: {
    label: 'Файлы',
    nodes: FILES,
    placeholder: 'Выберите файлы',
    clearable: true,
  },
}

// обязательность — только required(): пустой выбор приходит как null, не как [].
validate(model.signalAt('files')!, [required()]);`,
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
        'правило required в validation-схеме (validate из @reformer/core/validation). touched-поле с пустым значением показывает ошибку.',
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
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.framework, [required({ message: 'Выберите фреймворк' })]);`,
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
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.value, [required()]);`,
  },
};
