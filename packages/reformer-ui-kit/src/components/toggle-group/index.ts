// base — pure shadcn Radix ToggleGroup (Root) + ToggleGroupItem (button role=radio в single-режиме).
// (toggleVariants живёт в компоненте `toggle`; toggle-group его импортирует, как upstream — не реэкспортит.)
export { ToggleGroup, ToggleGroupItem } from './variants/base/toggle-group-base';

// field-версия (рендерит options, per-option data-testid) + алиас ToggleGroupField (дефолтный для форм).
export { ToggleGroupBaseField, ToggleGroupOptions } from './variants/base/toggle-group-base.field';
export { ToggleGroupBaseField as ToggleGroupField } from './variants/base/toggle-group-base.field';
export type {
  ToggleGroupOption,
  ToggleGroupOptionsProps,
  ToggleGroupFieldProps,
} from './variants/base/toggle-group-base.field';

// multi — множественный выбор (value: string[] | null). Отдельная запись каталога: другой тип значения.
export { ToggleGroupMulti } from './variants/multi/toggle-group-multi';
export { ToggleGroupMultiField } from './variants/multi/toggle-group-multi.field';
export type { ToggleGroupMultiProps } from './variants/multi/toggle-group-multi';
export type { ToggleGroupMultiFieldProps } from './variants/multi/toggle-group-multi.field';

// props-схемы.
export { toggleGroupBasePropsSchema } from './variants/base/toggle-group-base.props';
export { toggleGroupMultiPropsSchema } from './variants/multi/toggle-group-multi.props';
