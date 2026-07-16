// base — pure shadcn Switch (Radix, role=switch).
export { Switch } from './variants/base/switch-base';

// field-версия + алиас SwitchField (дефолтный для форм; inline-label).
export { SwitchBaseField } from './variants/base/switch-base.field';
export { SwitchBaseField as SwitchField } from './variants/base/switch-base.field';
export type { SwitchControlProps, SwitchFieldProps } from './variants/base/switch-base.field';

// props-схема.
export { switchBasePropsSchema } from './variants/base/switch-base.props';
