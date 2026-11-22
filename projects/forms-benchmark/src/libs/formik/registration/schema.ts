/**
 * Yup schema of the registration form (spec «Поля формы» + «Сообщения об ошибках»). Within a field
 * the rules are declared in the spec's order: Formik keeps the first Yup error per path, and an empty
 * string reaches Yup as `undefined`, so `required` fails alone before the length/format rules run.
 */
import * as Yup from 'yup';
import { api } from '../../../shared/api/client';
import {
  CAPTCHA_LENGTH,
  FULL_NAME_MIN,
  PASSWORD_MIN,
  PHONE_PATTERN,
  USERNAME_MIN,
  USERNAME_PATTERN,
  isStrongPassword,
} from '../../../shared/domain/registration';
import { msg } from '../../../shared/messages/registration';
import { withServerCheck } from '../kit/serverCheck';

const username = Yup.string()
  .required(msg('username.required'))
  .min(USERNAME_MIN, msg('username.minLength'))
  .matches(USERNAME_PATTERN, msg('username.pattern'));

const email = Yup.string().required(msg('email.required')).email(msg('email.email'));

const captcha = Yup.string()
  .required(msg('captcha.required'))
  .length(CAPTCHA_LENGTH, msg('captcha.length'));

export const registrationSchema = Yup.object({
  username: withServerCheck(username, 'taken', msg('username.taken'), api.checkUsername),
  email: withServerCheck(email, 'taken', msg('email.taken'), api.checkEmail),
  password: Yup.string()
    .required(msg('password.required'))
    .min(PASSWORD_MIN, msg('password.minLength'))
    .test('strength', msg('password.strength'), isStrongPassword),
  // Whole-form validation on every change: editing `password` re-checks the ref here as well.
  confirmPassword: Yup.string()
    .required(msg('confirmPassword.required'))
    .oneOf([Yup.ref('password')], msg('confirmPassword.match')),
  fullName: Yup.string()
    .required(msg('fullName.required'))
    .min(FULL_NAME_MIN, msg('fullName.minLength')),
  phone: Yup.string().required(msg('phone.required')).matches(PHONE_PATTERN, msg('phone.pattern')),
  captcha: withServerCheck(captcha, 'captcha', msg('captcha.invalid'), api.verifyCaptcha),
  acceptTerms: Yup.boolean().oneOf([true], msg('acceptTerms.required')),
});
