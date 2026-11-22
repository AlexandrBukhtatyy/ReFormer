/**
 * Правила формы регистрации для обеих ReFormer-реализаций (core и renderer-json): валидация в
 * ReFormer — отдельный слой над моделью (`defineValidation`), одинаковый для JSX и JSON-формы.
 *
 * Документация: packages/reformer/docs/llms/33-validation-strategy.md,
 * packages/reformer-renderer-json/docs/llms/06-validation.md.
 */
import type { ValidationIssue } from '@reformer/core';
import { defineIssueMessages } from '@reformer/core/i18n';
import {
  defineValidation,
  validate,
  validateAsync,
  type AsyncRule,
  type Rule,
} from '@reformer/core/validation';
import { email, minLength, pattern, required } from '@reformer/core/validators';
import { api } from '../../shared/api/client';
import {
  CAPTCHA_LENGTH,
  FULL_NAME_MIN,
  PASSWORD_MIN,
  PHONE_PATTERN,
  USERNAME_MIN,
  USERNAME_PATTERN,
  isStrongPassword,
  type RegistrationValues,
} from '../../shared/domain/registration';
import { REGISTRATION_MESSAGES } from '../../shared/messages/registration';

export const registrationMessages = defineIssueMessages(REGISTRATION_MESSAGES);

const strongPassword: Rule<string> = (v) =>
  v && !isStrongPassword(v) ? { code: 'password.strength' } : null;

const captchaLength: Rule<string> = (v) =>
  v && v.length !== CAPTCHA_LENGTH ? { code: 'captcha.length' } : null;

const termsAccepted: Rule<boolean> = (v) => (v ? null : { code: 'acceptTerms.required' });

const passwordsMatch = (f: RegistrationValues): ValidationIssue | null =>
  f.confirmPassword && f.password !== f.confirmPassword ? { code: 'confirmPassword.match' } : null;

// Async-проверка — только для значения, прошедшего синхронные правила поля (BENCH-CONTRACT §3).
const usernameAvailable: AsyncRule<string> = async (v) =>
  USERNAME_PATTERN.test(v) && (await api.checkUsername(v)) === false
    ? { code: 'username.taken' }
    : null;

const emailAvailable: AsyncRule<string> = async (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && (await api.checkEmail(v)) === false
    ? { code: 'email.taken' }
    : null;

const captchaValid: AsyncRule<string> = async (v) =>
  v.length === CAPTCHA_LENGTH && (await api.verifyCaptcha(v)) === false
    ? { code: 'captcha.invalid' }
    : null;

export const registrationRules = defineValidation<RegistrationValues>(({ model, cross }) => {
  validate(model.$.username, [
    required({ code: 'username.required' }),
    minLength(USERNAME_MIN, { code: 'username.minLength' }),
    pattern(USERNAME_PATTERN, { code: 'username.pattern' }),
  ]);
  validateAsync(model.$.username, [usernameAvailable]);

  validate(model.$.email, [required({ code: 'email.required' }), email({ code: 'email.email' })]);
  validateAsync(model.$.email, [emailAvailable]);

  validate(model.$.password, [
    required({ code: 'password.required' }),
    minLength(PASSWORD_MIN, { code: 'password.minLength' }),
    strongPassword,
  ]);

  validate(model.$.confirmPassword, [required({ code: 'confirmPassword.required' })]);
  cross(model.$.confirmPassword, passwordsMatch);

  validate(model.$.fullName, [
    required({ code: 'fullName.required' }),
    minLength(FULL_NAME_MIN, { code: 'fullName.minLength' }),
  ]);

  validate(model.$.phone, [
    required({ code: 'phone.required' }),
    pattern(PHONE_PATTERN, { code: 'phone.pattern' }),
  ]);

  validate(model.$.captcha, [required({ code: 'captcha.required' }), captchaLength]);
  validateAsync(model.$.captcha, [captchaValid]);

  validate(model.$.acceptTerms, [termsAccepted]);
});
