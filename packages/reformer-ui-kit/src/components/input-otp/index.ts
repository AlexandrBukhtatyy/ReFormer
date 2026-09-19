// base — чистый shadcn compound (input-otp: OTPInput + группа/слот/сепаратор).
export {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from './variants/base/input-otp-base';

// default — дефолтная раскладка слотов + проп tooltip. Компонент для формы (registry InputOTP).
export {
  InputOTPDefault,
  otpAdapter,
  type InputOTPDefaultProps,
} from './variants/base/input-otp-default';

// props-схема.
export { inputOtpBasePropsSchema } from './variants/base/input-otp-base.props';
