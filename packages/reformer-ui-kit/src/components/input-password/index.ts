// base — value-based поле пароля с тумблером видимости (ReFormer-custom, не shadcn).
export { InputPassword } from './variants/base/input-password-base';
export type { InputPasswordProps, InputPasswordHandle } from './variants/base/input-password-base';

// field-версия + алиас InputPasswordField (дефолтный для форм).
export { InputPasswordBaseField } from './variants/base/input-password-base.field';
export { InputPasswordBaseField as InputPasswordField } from './variants/base/input-password-base.field';

// props-схема.
export { inputPasswordBasePropsSchema } from './variants/base/input-password-base.props';
