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

// props-схемы вариантов.
export { comboboxBasePropsSchema } from './variants/base/combobox-base.props';
export { comboboxMultiPropsSchema } from './variants/multi/combobox-multi.props';
