// base — рецепт: композиция Popover + Command + Button (управляемый value/onChange, options проп).
export { Combobox } from './variants/base/combobox-base';
export type { ComboboxProps, ComboboxOption, ComboboxHandle } from './variants/base/combobox-base';

// field-версия + алиас ComboboxField (дефолтный для форм).
export { ComboboxBaseField } from './variants/base/combobox-base.field';
export { ComboboxBaseField as ComboboxField } from './variants/base/combobox-base.field';

// props-схема варианта.
export { comboboxBasePropsSchema } from './variants/base/combobox-base.props';
