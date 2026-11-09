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

// Готовые значения `pattern` (источники регулярных выражений) — из самой библиотеки input-otp.
export { REGEXP_ONLY_DIGITS, REGEXP_ONLY_CHARS, REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp';

// props-схема.
export { inputOtpBasePropsSchema } from './variants/base/input-otp-base.props';
