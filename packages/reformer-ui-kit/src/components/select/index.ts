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

// async — высокоуровневый вариант (options/resource/clearable) + типы источника. Компонент для
// формы (registry Select).
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

// multi — множественный выбор (value: string[] | null). Отдельная запись каталога: другой тип
// значения. Строится на Popover со своим listbox: Radix Select мультивыбора не поддерживает,
// а cmdk (как у ComboboxMulti) сюда тащить нельзя — каталог select лёгкий и едет в главный barrel.
export { SelectMulti } from './variants/multi/select-multi';
export type {
  SelectMultiProps,
  SelectMultiHandle,
  SelectMultiOption,
} from './variants/multi/select-multi';
export type { SelectMultiFormProps } from './variants/multi/select-multi';

// props-схемы вариантов.
export { selectAsyncPropsSchema } from './variants/async/select-async.props';
export { selectMultiPropsSchema } from './variants/multi/select-multi.props';
