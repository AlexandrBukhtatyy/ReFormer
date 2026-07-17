// base — pure shadcn Toggle (Radix, button + aria-pressed).
export { Toggle, toggleVariants } from './variants/base/toggle-base';

// field-версия + алиас ToggleField (дефолтный для форм; НЕ inline-label — подпись сверху от FormField).
export { ToggleBaseField } from './variants/base/toggle-base.field';
export { ToggleBaseField as ToggleField } from './variants/base/toggle-base.field';
export type { ToggleFieldProps } from './variants/base/toggle-base.field';

// props-схема.
export { toggleBasePropsSchema } from './variants/base/toggle-base.props';
