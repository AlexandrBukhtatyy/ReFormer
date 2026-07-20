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

// props-схема варианта.
export { selectAsyncPropsSchema } from './variants/async/select-async.props';
