import type { PropsSchema } from '@/fields/props-schema';
import { TREE_NODE_DOC_TYPE, treeNodeSchema } from './tree-node-schema';

/**
 * Props-схема презентационного `Tree` — единый источник `api.controls[]` (reformer-doc) и
 * DSL-валидации `componentProps` (renderer-json). `additionalProperties: false` ловит опечатки.
 *
 * `x-registryName: 'Tree'` — каноническое имя в реестре renderer-json.
 *
 * Дерево — не поле формы: у него нет `value`/`onChange`, и `*Field`-обёртки у него тоже нет.
 * Выбор файла формой делает вариант комбобокса (`ComboboxTree`), который это дерево использует
 * внутри: поле обязано отдавать ОДНО значение, а дерево — навигация, у которой значений
 * столько же, сколько строк.
 *
 * Описание узла — общий фрагмент с вариантами комбобокса, см. `./tree-node-schema`.
 */
export const treeBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Tree',
  properties: {
    className: {
      type: 'string',
      description: 'Доп. CSS-класс контейнера дерева.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    nodes: {
      type: 'array',
      items: treeNodeSchema,
      description:
        'Узлы верхнего уровня. Не задан вместе с loadChildren — верхний уровень дерево прочитает само.',
      'x-doc': { group: 'Options', type: TREE_NODE_DOC_TYPE, kind: 'readonly' },
    },
    defaultExpandedIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'Адреса веток, раскрытых на старте (неуправляемо).',
      'x-doc': { group: 'State', type: 'string[]', kind: 'readonly' },
    },
    expandedIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'Раскрытые ветки (управляемо). Без него дерево держит раскрытие само.',
      'x-doc': { group: 'State', type: 'string[]', kind: 'readonly' },
    },
    selectionMode: {
      type: 'string',
      enum: ['single', 'multiple'],
      default: 'single',
      description: 'Режим выбора: один узел (курсор) или курсор плюс отмеченный набор.',
      'x-doc': { group: 'Behavior', type: "'single' | 'multiple'", kind: 'enum' },
    },
    checkOn: {
      type: 'string',
      enum: ['modifier', 'click'],
      default: 'modifier',
      description:
        'Как строка попадает в набор: modifier — навигатор файлов (щелчок заменяет набор, Ctrl/Shift его строят), click — выбор из списка (щелчок и пробел переключают членство).',
      'x-doc': { group: 'Behavior', type: "'modifier' | 'click'", kind: 'enum' },
    },
    selectable: {
      type: 'string',
      enum: ['all', 'leaf'],
      default: 'all',
      description: 'Что можно выбрать. leaf — режим выбора файла: щелчок по ветке её раскрывает.',
      'x-doc': { group: 'Behavior', type: "'all' | 'leaf'", kind: 'enum' },
    },
    search: {
      type: 'string',
      description:
        'Поисковый запрос по подписи. Путь до совпадения раскрывается на время поиска; фильтр видит только прочитанные уровни.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    emptyText: {
      type: 'string',
      default: 'Пусто',
      description: 'Текст пустого дерева.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    rowHeight: {
      type: 'number',
      minimum: 1,
      default: 24,
      description: 'Высота строки, px. На ней стоит виртуальный скролл.',
      'x-doc': { group: 'Behavior', type: 'number', kind: 'number' },
    },
    maxRows: {
      type: 'number',
      minimum: 1,
      description:
        'Сколько строк показать до появления прокрутки. Задаёт высоту по содержимому; без него высоту задаёт className вызывающего.',
      'x-doc': { group: 'Behavior', type: 'number', kind: 'number' },
    },
    virtualized: {
      type: 'boolean',
      default: true,
      description:
        'Виртуальный скролл. Выключают там, где дерево заведомо короткое, а разметка нужна целиком (серверная отрисовка).',
      'x-doc': { group: 'Behavior', type: 'boolean', kind: 'boolean' },
    },
  },
  'x-runtimeProps': {
    loadChildren: {
      group: 'Control',
      type: '(node: TreeNode | null) => Promise<readonly TreeNode[]>',
      description:
        'Ленивое чтение уровня при первом раскрытии ветки; null — верхний уровень. Прочитанное запоминается.',
    },
    selectedId: {
      group: 'Control',
      type: 'string | null',
      description: 'Выделенный узел (управляемо) — «где я сейчас», одна строка.',
    },
    onSelectedChange: {
      group: 'Control',
      type: '(id: string | null) => void',
      description: 'Смена выделения.',
    },
    checkedIds: {
      group: 'Control',
      type: 'string[]',
      description:
        'Отмеченный набор (управляемо) — «что я выбрал». Отдельно от selectedId: набор и выделение отвечают на разные вопросы.',
    },
    onCheckedChange: {
      group: 'Control',
      type: '(ids: string[]) => void',
      description: 'Смена набора; порядок — порядок строк дерева.',
    },
    onExpandedChange: {
      group: 'Control',
      type: '(ids: string[]) => void',
      description: 'Смена раскрытых веток.',
    },
    onActivate: {
      group: 'Control',
      type: '(node: TreeNode, meta: { preview: boolean }) => void',
      description:
        'Запуск строки. preview=true — одиночный щелчок или пробел, false — двойной щелчок или Enter. Ветку дерево раскрывает само.',
    },
    isNodeDisabled: {
      group: 'Control',
      type: '(node: TreeNode) => boolean',
      description:
        'Запрет выбора поверх node.disabled — для запретов динамических: потолок числа выбранных, права на файл.',
    },
    onRowClick: {
      group: 'Control',
      type: '(node: TreeNode, event: React.MouseEvent) => void',
      description:
        'Щелчок ДО правил выбора дерева. Вызвавший preventDefault() берёт строку себе целиком — так потребитель со своими правилами остаётся хозяином, не отказываясь от отрисовки.',
    },
    onRowDoubleClick: {
      group: 'Control',
      type: '(node: TreeNode, event: React.MouseEvent) => void',
      description: 'Двойной щелчок ДО запуска строки; preventDefault отменяет запуск.',
    },
    onContextMenu: {
      group: 'Control',
      type: '(event: React.MouseEvent) => void',
      description: 'Правый щелчок по дереву целиком; строку потребитель находит по data-tree-id.',
    },
    getRowProps: {
      group: 'Control',
      type: '(node: TreeNode, row: TreeRow) => HTMLAttributes',
      description: 'Доп. атрибуты строки: свои data-*, title, обработчики.',
    },
    renderIcon: {
      group: 'Control',
      type: '(node, state: { branch; expanded; selected; checked }) => ReactNode',
      description: 'Значок строки; возврат null оставляет умолчание (каталог/файл).',
    },
    renderLabel: {
      group: 'Control',
      type: '(node, state) => ReactNode',
      description: 'Подпись строки; возврат null оставляет node.label.',
    },
    renderActions: {
      group: 'Control',
      type: '(node: TreeNode, state) => ReactNode',
      description: 'Содержимое правого края строки: свои метки, кнопки, подсказки.',
    },
    onLoadError: {
      group: 'Control',
      type: '(error: unknown, node: TreeNode | null) => void',
      description: 'Отказ чтения уровня. По умолчанию пишется в консоль.',
    },
  },
} as const satisfies PropsSchema;
