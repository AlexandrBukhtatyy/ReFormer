// base — чистый shadcn compound (input-otp: OTPInput + группа/слот/сепаратор).
export {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from './variants/base/input-otp-base';

// field-версия + алиас InputOTPField (дефолтный для форм).
export { InputOTPBaseField } from './variants/base/input-otp-base.field';
export { InputOTPBaseField as InputOTPField } from './variants/base/input-otp-base.field';

// props-схема.
export { inputOtpBasePropsSchema } from './variants/base/input-otp-base.props';
