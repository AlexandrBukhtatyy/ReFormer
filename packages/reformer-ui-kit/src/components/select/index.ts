// base — чистый shadcn compound (ручная сборка кастомного дропдауна).
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './variants/base/select-base';

// async — высокоуровневый вариант (options/resource/clearable) + типы источника.
export { SelectAsync } from './variants/async/select-async';
export type { SelectAsyncProps, SelectAsyncHandle } from './variants/async/select-async';
export type {
  ResourceConfig,
  ResourceLoadParams,
  ResourceItem,
  ResourceResult,
  ResourceStrategy,
  NormalizedOption,
} from './variants/async/select-async';

// field-версия async + алиас SelectField (дефолтный для форм).
export { SelectAsyncField } from './variants/async/select-async.field';
export { SelectAsyncField as SelectField } from './variants/async/select-async.field';

// multi — множественный выбор (value: string[] | null). Отдельная запись каталога: другой тип
// значения. Строится на Popover со своим listbox: Radix Select мультивыбора не поддерживает,
// а cmdk (как у ComboboxMulti) сюда тащить нельзя — каталог select лёгкий и едет в главный barrel.
export { SelectMulti } from './variants/multi/select-multi';
export { SelectMultiField } from './variants/multi/select-multi.field';
export type {
  SelectMultiProps,
  SelectMultiHandle,
  SelectMultiOption,
} from './variants/multi/select-multi';
export type { SelectMultiFieldProps } from './variants/multi/select-multi.field';

// props-схемы вариантов.
export { selectAsyncPropsSchema } from './variants/async/select-async.props';
export { selectMultiPropsSchema } from './variants/multi/select-multi.props';
