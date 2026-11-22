// base — pure shadcn NativeSelect (стилизованный native <select> + option/optgroup).
export {
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
} from './variants/base/native-select-base';

// with-options — select из декларативных options + проп tooltip. Компонент для формы (registry NativeSelect).
export { NativeSelectWithOptions } from './variants/base/native-select-with-options';
export type {
  NativeSelectWithOptionsProps,
  NativeSelectOptionItem,
} from './variants/base/native-select-with-options';

// multi — нативный <select multiple> (value: string[] | null). Отдельная запись каталога.
export { NativeSelectMulti } from './variants/multi/native-select-multi';
export type {
  NativeSelectMultiProps,
  NativeSelectMultiFormProps,
} from './variants/multi/native-select-multi';

// props-схемы.
export { nativeSelectBasePropsSchema } from './variants/base/native-select-base.props';
export { nativeSelectMultiPropsSchema } from './variants/multi/native-select-multi.props';
