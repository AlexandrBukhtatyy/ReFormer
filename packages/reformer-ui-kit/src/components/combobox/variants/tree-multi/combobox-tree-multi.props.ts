import type { PropsSchema } from '@/fields/props-schema';
import {
  TREE_NODE_DOC_TYPE,
  treeNodeSchema,
} from '@/components/tree/variants/base/tree-node-schema';

/**
 * Props-схема ComboboxTreeMulti — единый источник `api.controls[]` (reformer-doc) и
 * DSL-валидации `componentProps` (renderer-json). `additionalProperties: false` ловит опечатки.
 *
 * `x-registryName: 'ComboboxTreeMulti'` — отдельная запись каталога, а не проп `multiple`
 * у `ComboboxTree`: тип значения другой (`string[] | null` против `string | null`), а
 * `x-runtimeProps.value` у записи ровно один. Адаптер вшит в замыкание HOC на этапе вызова
 * `withFormControl` и переключаться на рендере не может.
 */
export const comboboxTreeMultiPropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'ComboboxTreeMulti',
  'x-variantGroup': 'Combobox',
  'x-variant': 'Дерево, несколько',
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
        'Узлы верхнего уровня. Поиск идёт по label; значением поля становятся id выбранных узлов.',
      'x-doc': { group: 'Options', type: TREE_NODE_DOC_TYPE, kind: 'readonly' },
    },
    defaultExpandedIds: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Ветки, раскрытые при открытии списка. Пути до выбранных узлов раскрываются и без него.',
      'x-doc': { group: 'State', type: 'string[]', kind: 'readonly' },
    },
    selectable: {
      type: 'string',
      enum: ['all', 'leaf'],
      default: 'leaf',
      description:
        'Что можно выбрать. leaf — выбор файлов: щелчок по каталогу его раскрывает. all разрешает выбрать и каталог.',
      'x-doc': { group: 'Behavior', type: "'all' | 'leaf'", kind: 'enum' },
    },
    placeholder: {
      type: 'string',
      default: 'Выберите файлы...',
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
      description: 'Показывать крестик сброса всего выбора справа от триггера.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    maxItems: {
      type: 'number',
      minimum: 1,
      description:
        'Потолок числа выбранных: по достижении невыбранные строки гаснут. Подсказка интерфейса, а не правило формы — ограничение задавайте валидатором maxLength(n).',
      'x-doc': { group: 'Behavior', type: 'number', kind: 'number' },
    },
    summaryThreshold: {
      type: 'number',
      minimum: 1,
      default: 3,
      description:
        'Сколько чипов показать в триггере, прежде чем схлопнуть их в сводку «Выбрано: N».',
      'x-doc': { group: 'Behavior', type: 'number', kind: 'number' },
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
      type: 'string[] | null',
      description:
        'Адреса выбранных узлов (node.id). Пустой выбор приходит как null, а не []: массив в начальном значении модели создал бы ArrayNode, и поля не было бы вовсе.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string[] | null) => void',
      description: 'Изменение выбора; снятие последнего значения → null.',
    },
    loadChildren: {
      group: 'Options',
      type: '(node: TreeNode | null) => Promise<readonly TreeNode[]>',
      description:
        'Ленивое чтение уровня при первом раскрытии ветки; null — верхний уровень. В JSON-форме недостижим: требует функцию — передаётся через реестр компонентов.',
    },
  },
} as const satisfies PropsSchema;
