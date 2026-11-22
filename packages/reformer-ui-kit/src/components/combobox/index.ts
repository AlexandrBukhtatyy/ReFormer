// base — рецепт: композиция Popover + Command + Button (управляемый value/onChange, options проп).
export { Combobox } from './variants/base/combobox-base';
export type { ComboboxProps, ComboboxOption, ComboboxHandle } from './variants/base/combobox-base';

// multi — множественный выбор (value: string[] | null). Отдельная запись каталога: другой тип значения.
export { ComboboxMulti } from './variants/multi/combobox-multi';
export type {
  ComboboxMultiProps,
  ComboboxMultiHandle,
  ComboboxMultiFormProps,
} from './variants/multi/combobox-multi';

// tree — выбор узла иерархии (как правило файла). Список в поповере — Tree кита, а не Command:
// cmdk при поиске размонтирует несовпавшие строки вместе с их детьми и переставляет узлы мимо
// React, чего иерархия не переживает (подробнее — в шапке combobox-tree.tsx).
export { ComboboxTree } from './variants/tree/combobox-tree';
export type {
  ComboboxTreeProps,
  ComboboxTreeHandle,
  ComboboxTreeFormProps,
} from './variants/tree/combobox-tree';

// tree-multi — набор узлов иерархии (value: string[] | null). Отдельная запись каталога.
export { ComboboxTreeMulti } from './variants/tree-multi/combobox-tree-multi';
export type {
  ComboboxTreeMultiProps,
  ComboboxTreeMultiHandle,
  ComboboxTreeMultiFormProps,
} from './variants/tree-multi/combobox-tree-multi';

// props-схемы вариантов.
export { comboboxBasePropsSchema } from './variants/base/combobox-base.props';
export { comboboxMultiPropsSchema } from './variants/multi/combobox-multi.props';
export { comboboxTreePropsSchema } from './variants/tree/combobox-tree.props';
export { comboboxTreeMultiPropsSchema } from './variants/tree-multi/combobox-tree-multi.props';
