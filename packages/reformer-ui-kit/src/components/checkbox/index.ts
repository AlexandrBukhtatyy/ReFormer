// base — pure shadcn Radix Checkbox (button role=checkbox + CheckIcon indicator).
export { Checkbox } from './variants/base/checkbox-base';

// field-версия (checkbox + подпись справа, inline-label) + алиас CheckboxField (дефолтный для форм).
export { CheckboxBaseField, CheckboxWithLabel } from './variants/base/checkbox-base.field';
export { CheckboxBaseField as CheckboxField } from './variants/base/checkbox-base.field';
export type { CheckboxWithLabelProps } from './variants/base/checkbox-base.field';

// props-схема.
export { checkboxBasePropsSchema } from './variants/base/checkbox-base.props';
