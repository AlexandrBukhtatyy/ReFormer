// base — pure shadcn Radix RadioGroup (Root role=radiogroup) + RadioGroupItem (button role=radio).
export { RadioGroup, RadioGroupItem } from './variants/base/radio-group-base';

// field-версия (рендерит options, per-option data-testid) + алиас RadioGroupField (дефолтный для форм).
export { RadioGroupBaseField, RadioGroupOptions } from './variants/base/radio-group-base.field';
export { RadioGroupBaseField as RadioGroupField } from './variants/base/radio-group-base.field';
export type { RadioOption, RadioGroupOptionsProps } from './variants/base/radio-group-base.field';

// props-схема.
export { radioGroupBasePropsSchema } from './variants/base/radio-group-base.props';
