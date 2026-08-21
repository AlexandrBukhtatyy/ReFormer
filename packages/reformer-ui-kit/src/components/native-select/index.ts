// base — pure shadcn NativeSelect (стилизованный native <select> + option/optgroup).
export {
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
} from './variants/base/native-select-base';

// field-версия (options → <option>, nativeInputAdapter) + wrapper.
export {
  NativeSelectBaseField,
  NativeSelectWithOptions,
} from './variants/base/native-select-base.field';
export type {
  NativeSelectWithOptionsProps,
  NativeSelectOptionItem,
} from './variants/base/native-select-base.field';

// алиас NativeSelectField (дефолтный для форм).
export { NativeSelectBaseField as NativeSelectField } from './variants/base/native-select-base.field';

// multi — нативный <select multiple> (value: string[] | null). Отдельная запись каталога.
export { NativeSelectMulti } from './variants/multi/native-select-multi';
export { NativeSelectMultiField } from './variants/multi/native-select-multi.field';
export type { NativeSelectMultiProps } from './variants/multi/native-select-multi';
export type { NativeSelectMultiFieldProps } from './variants/multi/native-select-multi.field';

// props-схемы.
export { nativeSelectBasePropsSchema } from './variants/base/native-select-base.props';
export { nativeSelectMultiPropsSchema } from './variants/multi/native-select-multi.props';
