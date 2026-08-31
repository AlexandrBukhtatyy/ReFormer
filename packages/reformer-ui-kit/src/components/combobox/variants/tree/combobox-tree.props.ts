import type { PropsSchema } from '@/fields/props-schema';
import {
  TREE_NODE_DOC_TYPE,
  treeNodeSchema,
} from '@/components/tree/variants/base/tree-node-schema';

/**
 * Props-схема ComboboxTree — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). `additionalProperties: false` ловит опечатки.
 *
 * `x-registryName: 'ComboboxTree'` — отдельная запись каталога, а не проп `tree` у `Combobox`:
 * список опций и дерево — разные структуры данных (`options` против `nodes`), а `x-runtimeProps`
 * записи описывают ровно один контракт значения. Прецедент — `ComboboxMulti` и `FileUploadAvatar`.
 */
export const comboboxTreePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'ComboboxTree',
  'x-variantGroup': 'Combobox',
  'x-variant': 'Дерево',
  properties: {
    className: {
      type: 'string',
      description: 'Доп. CSS-класс триггера.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    nodes: {
      type: 'array',
      items: treeNodeSchema,
      description:
        'Узлы верхнего уровня. Поиск идёт по label; значением поля становится id выбранного узла.',
      'x-doc': { group: 'Options', type: TREE_NODE_DOC_TYPE, kind: 'readonly' },
    },
    defaultExpandedIds: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Ветки, раскрытые при открытии списка. Путь до выбранного узла раскрывается и без него.',
      'x-doc': { group: 'State', type: 'string[]', kind: 'readonly' },
    },
    selectable: {
      type: 'string',
      enum: ['all', 'leaf'],
      default: 'leaf',
      description:
        'Что можно выбрать. leaf — выбор файла: щелчок по каталогу его раскрывает. all разрешает выбрать и каталог.',
      'x-doc': { group: 'Behavior', type: "'all' | 'leaf'", kind: 'enum' },
    },
    placeholder: {
      type: 'string',
      default: 'Выберите файл...',
      description: 'Подсказка в триггере, пока ничего не выбрано.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    searchPlaceholder: {
      type: 'string',
      default: 'Поиск...',
      description: 'Подсказка в поле поиска над деревом.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    emptyText: {
      type: 'string',
      default: 'Ничего не найдено',
      description: 'Текст пустого состояния (по запросу ничего не совпало).',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    clearable: {
      type: 'boolean',
      default: false,
      description:
        'Показывать крестик очистки (сброс в null); повторный выбор той же строки тоже сбрасывает.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    maxRows: {
      type: 'number',
      minimum: 1,
      default: 12,
      description: 'Сколько строк дерева показать в поповере до появления прокрутки.',
      'x-doc': { group: 'Behavior', type: 'number', kind: 'number' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'string | null',
      description: 'Адрес выбранного узла (node.id). null — ничего не выбрано.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string | null) => void',
      description: 'Выбор; при очистке приходит null.',
    },
    loadChildren: {
      group: 'Options',
      type: '(node: TreeNode | null) => Promise<readonly TreeNode[]>',
      description:
        'Ленивое чтение уровня при первом раскрытии ветки; null — верхний уровень. В JSON-форме недостижим: требует функцию — передаётся через реестр компонентов.',
    },
  },
} as const satisfies PropsSchema;
