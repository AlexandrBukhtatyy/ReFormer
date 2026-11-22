import { useState } from 'react';
// Тяжёлый компонент (cmdk) — только из своего подпути, не из главного входа кита.
import {
  Combobox,
  ComboboxMulti,
  ComboboxTree,
  ComboboxTreeMulti,
  comboboxBasePropsSchema,
} from '@reformer/ui-kit/combobox';
import type { TreeNode } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required, maxLength } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant, raw } from '../field-snippet';
import type { ComponentDocConfig, VariantDef } from '../types';

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
 * Дерево файлов для вариантов ComboboxTree. Значением поля становится id узла — для файла это
 * полный путь, поэтому он же служит адресом узла в дереве.
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

/** Как выглядит FILES в коде примера: в сниппете узла поля дерево подставлено именем константы. */
const FILES_CODE = `const FILES: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    kind: 'branch',
    children: [
      { id: 'src/index.ts', label: 'index.ts' },
      { id: 'src/theme.css', label: 'theme.css' },
      // …
    ],
  },
  { id: 'package.json', label: 'package.json' },
];`;

/** Сниппет варианта с объявлением дерева над узлом поля. */
function withFiles(variant: VariantDef): VariantDef {
  return { ...variant, code: `${FILES_CODE}\n\n${variant.code}` };
}

// Пропсы панели API — из props-схемы варианта. label и options задаются baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(comboboxBasePropsSchema), {
  omit: ['label', 'options'],
});

/* ─── Combobox вне формы: свой стейт ─── */

function StandaloneCombobox() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <div className="w-full max-w-sm">
      <Combobox
        value={value}
        onChange={setValue}
        options={FRAMEWORKS}
        placeholder="Выберите фреймворк"
        clearable
      />
      <p className="mt-2 text-sm text-muted-foreground">Выбрано: {value ?? '—'}</p>
    </div>
  );
}

export const comboboxDocConfig: ComponentDocConfig = {
  name: 'Combobox',
  importFrom: '@reformer/ui-kit/combobox',
  description:
    'Выбор из списка с поиском: кнопка открывает всплывающий список, над которым поле поиска. Есть варианты для нескольких значений и для выбора из дерева.',
  variants: [
    fieldVariant({
      id: 'single',
      title: 'Одно значение',
      description: 'Поиск по подписи опции. Значение поля — value выбранной опции: string | null.',
      field: 'framework',
      component: Combobox,
      componentName: 'Combobox',
      initial: null,
      props: { label: 'Фреймворк', placeholder: 'Выберите фреймворк', options: FRAMEWORKS },
    }),
    fieldVariant({
      id: 'clearable',
      title: 'С очисткой',
      description:
        'clearable добавляет крестик. Он и повторный выбор той же опции сбрасывают значение в null.',
      field: 'country',
      component: Combobox,
      componentName: 'Combobox',
      initial: 'by',
      showInitial: true,
      props: { label: 'Страна', options: COUNTRIES, clearable: true },
    }),
    fieldVariant({
      id: 'creatable',
      title: 'Своё значение',
      description:
        'creatable: если введённого текста нет среди опций, в списке появляется пункт создания, и значением поля становится сам текст.',
      field: 'city',
      component: Combobox,
      componentName: 'Combobox',
      initial: null,
      props: {
        label: 'Город',
        options: [
          { value: 'Москва', label: 'Москва' },
          { value: 'Казань', label: 'Казань' },
        ],
        creatable: true,
      },
    }),
    fieldVariant({
      id: 'multi',
      title: 'Несколько значений',
      description:
        'ComboboxMulti: значение — string[] | null, выбранное — чипами в кнопке. Список после выбора не закрывается и поиск не сбрасывает.',
      field: 'frameworks',
      component: ComboboxMulti,
      componentName: 'ComboboxMulti',
      initial: null,
      props: {
        label: 'Фреймворки',
        placeholder: 'Выберите фреймворки',
        options: FRAMEWORKS,
        clearable: true,
      },
    }),
    withFiles(
      fieldVariant({
        id: 'tree',
        title: 'Узел дерева',
        description:
          'ComboboxTree: вместо options — дерево nodes, значение поля — id выбранного узла. Щелчок по каталогу раскрывает его, а не выбирает (selectable="leaf").',
        field: 'file',
        component: ComboboxTree,
        componentName: 'ComboboxTree',
        initial: null,
        props: { label: 'Файл', placeholder: 'Выберите файл', nodes: FILES, clearable: true },
        codeProps: { nodes: raw('FILES') },
      })
    ),
    withFiles(
      fieldVariant({
        id: 'tree-multi',
        title: 'Несколько узлов дерева',
        description:
          'ComboboxTreeMulti: значение — массив id узлов, пустой выбор приходит как null. Обязательность — правило required(), а не minLength(1).',
        field: 'files',
        component: ComboboxTreeMulti,
        componentName: 'ComboboxTreeMulti',
        initial: null,
        props: { label: 'Файлы', placeholder: 'Выберите файлы', nodes: FILES, clearable: true },
        codeProps: { nodes: raw('FILES') },
        validators: [required()],
        rules: 'required()',
      })
    ),
    {
      id: 'standalone',
      title: 'Вне формы',
      description:
        'Combobox уже говорит на языке формы (value и onChange со значением), поэтому вне формы подключается так же.',
      render: StandaloneCombobox,
      code: `import { useState } from 'react';
import { Combobox } from '@reformer/ui-kit/combobox';

const FRAMEWORKS = [
  { value: 'next', label: 'Next.js' },
  { value: 'remix', label: 'Remix' },
  // …
];

function StandaloneCombobox() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <div className="w-full max-w-sm">
      <Combobox
        value={value}
        onChange={setValue}
        options={FRAMEWORKS}
        placeholder="Выберите фреймворк"
        clearable
      />
      <p className="mt-2 text-sm text-muted-foreground">Выбрано: {value ?? '—'}</p>
    </div>
  );
}`,
    },
  ],
  examples: [
    fieldVariant({
      id: 'texts',
      title: 'Свои тексты',
      description:
        'placeholder, searchPlaceholder и emptyText заменяют строки из словаря кита для одного поля. Наберите в поиске что-нибудь несуществующее.',
      field: 'framework',
      component: Combobox,
      componentName: 'Combobox',
      initial: null,
      props: {
        label: 'Фреймворк',
        placeholder: 'Не выбран',
        searchPlaceholder: 'Начните вводить название…',
        emptyText: 'Такого фреймворка нет',
        options: FRAMEWORKS,
      },
    }),
    fieldVariant({
      id: 'max-items',
      title: 'Не больше двух',
      description:
        'maxItems выключает невыбранные опции, когда выбрано два. Это подсказка интерфейса; правило формы — maxLength(2) в схеме валидации.',
      field: 'frameworks',
      component: ComboboxMulti,
      componentName: 'ComboboxMulti',
      initial: null,
      props: { label: 'Два фреймворка', options: FRAMEWORKS, maxItems: 2 },
      validators: [maxLength(2)],
      rules: 'maxLength(2)',
    }),
    fieldVariant({
      id: 'validation',
      title: 'Обязательный выбор',
      description:
        'Правило required — в схеме валидации. Поле уже тронуто, поэтому замечание видно сразу.',
      field: 'framework',
      component: Combobox,
      componentName: 'Combobox',
      initial: null,
      props: { label: 'Фреймворк', options: FRAMEWORKS, required: true },
      validators: [required({ code: 'framework.required' })],
      rules: "required({ code: 'framework.required' })",
      messages: { 'framework.required': 'Выберите фреймворк' },
      touched: true,
    }),
  ],
  api: {
    component: Combobox,
    initialValue: null,
    baseComponentProps: { label: 'Фреймворк', options: FRAMEWORKS },
    validators: [required({ code: 'field.required' })],
    messages: { 'field.required': 'Выберите фреймворк' },
    valuePresets: [
      { label: 'Next.js', value: 'next' },
      { label: 'Remix', value: 'remix' },
      { label: 'Очистить (null)', value: null },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'framework',
        component: 'Combobox',
        props: { label: 'Фреймворк', options: raw('FRAMEWORKS') },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};
