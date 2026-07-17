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

// props-схема.
export { nativeSelectBasePropsSchema } from './variants/base/native-select-base.props';
