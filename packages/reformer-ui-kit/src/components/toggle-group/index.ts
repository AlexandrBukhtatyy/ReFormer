// base — pure shadcn Radix ToggleGroup (Root) + ToggleGroupItem (button role=radio в single-режиме).
// (toggleVariants живёт в компоненте `toggle`; toggle-group его импортирует, как upstream — не реэкспортит.)
export { ToggleGroup, ToggleGroupItem } from './variants/base/toggle-group-base';

// options — группа из массива options (per-option data-testid) + проп tooltip. Компонент для формы
// (registry ToggleGroup).
export { ToggleGroupOptions } from './variants/base/toggle-group-options';
export type {
  ToggleGroupOption,
  ToggleGroupOptionsProps,
  ToggleGroupFormProps,
} from './variants/base/toggle-group-options';

// multi — множественный выбор (value: string[] | null). Отдельная запись каталога: другой тип значения.
export { ToggleGroupMulti } from './variants/multi/toggle-group-multi';
export type {
  ToggleGroupMultiProps,
  ToggleGroupMultiFormProps,
} from './variants/multi/toggle-group-multi';

// props-схемы.
export { toggleGroupBasePropsSchema } from './variants/base/toggle-group-base.props';
export { toggleGroupMultiPropsSchema } from './variants/multi/toggle-group-multi.props';
