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

// props-схема.
export { toggleGroupBasePropsSchema } from './variants/base/toggle-group-base.props';
