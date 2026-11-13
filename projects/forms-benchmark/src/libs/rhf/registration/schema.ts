/**
 * Validation of the registration form (docs/specs/registration-form.md, «Поля формы»): one zod
 * schema, each field's rules in the spec's order (RHF shows the first issue per field), messages
 * from the shared catalogue.
 */
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../../../shared/api/client';
import {
  CAPTCHA_LENGTH,
  FULL_NAME_MIN,
  PASSWORD_MIN,
  PHONE_PATTERN,
  USERNAME_MIN,
  USERNAME_PATTERN,
  isStrongPassword,
  type RegistrationValues,
} from '../../../shared/domain/registration';
import { msg } from '../../../shared/messages/registration';
import { afterSyncRules, serverCheck } from '../kit/zod';

const registrationSchema = z
  .object({
    username: z
      .string()
      .min(1, msg('username.required'))
      .min(USERNAME_MIN, msg('username.minLength'))
      .regex(USERNAME_PATTERN, msg('username.pattern'))
      .refine(serverCheck(api.checkUsername), {
        error: msg('username.taken'),
        when: afterSyncRules,
      }),
    email: z
      .string()
      .min(1, msg('email.required'))
      // A failed `min` stops the pipe, so an empty value reports "required", not the format.
      .pipe(z.email(msg('email.email')))
      .refine(serverCheck(api.checkEmail), { error: msg('email.taken'), when: afterSyncRules }),
    password: z
      .string()
      .min(1, msg('password.required'))
      .min(PASSWORD_MIN, msg('password.minLength'))
      .refine(isStrongPassword, msg('password.strength')),
    confirmPassword: z.string().min(1, msg('confirmPassword.required')),
    fullName: z
      .string()
      .min(1, msg('fullName.required'))
      .min(FULL_NAME_MIN, msg('fullName.minLength')),
    phone: z.string().min(1, msg('phone.required')).regex(PHONE_PATTERN, msg('phone.pattern')),
    captcha: z
      .string()
      .min(1, msg('captcha.required'))
      .length(CAPTCHA_LENGTH, msg('captcha.length'))
      .refine(serverCheck(api.verifyCaptcha), {
        error: msg('captcha.invalid'),
        when: afterSyncRules,
      }),
    acceptTerms: z.boolean().refine((accepted) => accepted, msg('acceptTerms.required')),
  })
  // Cross-field rule (zod docs, refine `path`). All field issues above are continuable, so zod
  // runs it even while other fields are invalid; for an empty confirmation "required" comes first.
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    error: msg('confirmPassword.match'),
  }) satisfies z.ZodType<RegistrationValues, RegistrationValues>;

export const registrationResolver = zodResolver(registrationSchema);
