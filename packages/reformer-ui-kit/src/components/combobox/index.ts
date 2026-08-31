// base — рецепт: композиция Popover + Command + Button (управляемый value/onChange, options проп).
export { Combobox } from './variants/base/combobox-base';
export type { ComboboxProps, ComboboxOption, ComboboxHandle } from './variants/base/combobox-base';

// field-версия + алиас ComboboxField (дефолтный для форм).
export { ComboboxBaseField } from './variants/base/combobox-base.field';
export { ComboboxBaseField as ComboboxField } from './variants/base/combobox-base.field';

// multi — множественный выбор (value: string[] | null). Отдельная запись каталога: другой тип значения.
export { ComboboxMulti } from './variants/multi/combobox-multi';
export { ComboboxMultiField } from './variants/multi/combobox-multi.field';
export type { ComboboxMultiProps, ComboboxMultiHandle } from './variants/multi/combobox-multi';
export type { ComboboxMultiFieldProps } from './variants/multi/combobox-multi.field';

// tree — выбор узла иерархии (как правило файла). Список в поповере — Tree кита, а не Command:
// cmdk при поиске размонтирует несовпавшие строки вместе с их детьми и переставляет узлы мимо
// React, чего иерархия не переживает (подробнее — в шапке combobox-tree.tsx).
export { ComboboxTree } from './variants/tree/combobox-tree';
export { ComboboxTreeField } from './variants/tree/combobox-tree.field';
export type { ComboboxTreeProps, ComboboxTreeHandle } from './variants/tree/combobox-tree';
export type { ComboboxTreeFieldProps } from './variants/tree/combobox-tree.field';

// tree-multi — набор узлов иерархии (value: string[] | null). Отдельная запись каталога.
export { ComboboxTreeMulti } from './variants/tree-multi/combobox-tree-multi';
export { ComboboxTreeMultiField } from './variants/tree-multi/combobox-tree-multi.field';
export type {
  ComboboxTreeMultiProps,
  ComboboxTreeMultiHandle,
} from './variants/tree-multi/combobox-tree-multi';
export type { ComboboxTreeMultiFieldProps } from './variants/tree-multi/combobox-tree-multi.field';

// props-схемы вариантов.
export { comboboxBasePropsSchema } from './variants/base/combobox-base.props';
export { comboboxMultiPropsSchema } from './variants/multi/combobox-multi.props';
export { comboboxTreePropsSchema } from './variants/tree/combobox-tree.props';
export { comboboxTreeMultiPropsSchema } from './variants/tree-multi/combobox-tree-multi.props';
