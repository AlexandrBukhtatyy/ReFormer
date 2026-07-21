/**
 * Валидация формы регистрации — TS-схема над МОДЕЛЬЮ.
 *
 * В JSON-DSL валидаторов нет by design: оператора `$validator(...)` не существует, а
 * `JsonFieldNode` несёт только layout. Правила живут здесь и исполняются `validateFormModel`,
 * который сам роутит ошибки в ноды формы — UI подсветит проблемные поля.
 *
 * Практический вывод: JSON-схему можно менять/получать с сервера, не трогая правила валидации,
 * и наоборот. См. `@reformer/renderer-json` docs/llms/06-validation.md.
 */

import type { FormModel, ModelValidator } from '@reformer/core';
import { required, email, minLength, pattern } from '@reformer/core/validators';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';

type M = FormModel<RegistrationFormData>;

// ── Правила уровня данных: контракт (value, model) ──────────────────────────

export const passwordStrength: ModelValidator<string> = (value) => {
  if (!value) return null;
  const ok = /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
  return ok ? null : { code: 'weak-password', message: 'Нужны заглавные, строчные буквы и цифры' };
};

/** Cross-field правило: второй аргумент — снимок модели, поэтому виден соседний `password`. */
export const passwordsMatch: ModelValidator<string, RegistrationFormData> = (value, model) =>
  value && model.password && value !== model.password
    ? { code: 'passwords-mismatch', message: 'Пароли не совпадают' }
    : null;

export const captchaCode: ModelValidator<string> = (value) =>
  value !== 'ABC123'
    ? { code: 'invalid-captcha', message: 'Неверная captcha. Попробуйте ABC123' }
    : null;

export const termsAccepted: ModelValidator<boolean> = (value) =>
  value ? null : { code: 'terms-required', message: 'Необходимо принять условия' };

/** Async-правило: сетевой сбой НЕ блокирует отправку — возвращаем null, а не ошибку. */
export const usernameAvailable: ModelValidator<string> = async (value) => {
  if (!value || value.length < 3) return null;
  try {
    const res = await fetch(`/api/v1/auth/check-username?username=${encodeURIComponent(value)}`);
    const json = await res.json();
    return json.available
      ? null
      : { code: 'username-taken', message: json.message || 'Имя занято' };
  } catch {
    return null;
  }
};

export const emailAvailable: ModelValidator<string> = async (value) => {
  if (!value || !value.includes('@')) return null;
  try {
    const res = await fetch(`/api/v1/auth/check-email?email=${encodeURIComponent(value)}`);
    const json = await res.json();
    return json.available ? null : { code: 'email-taken', message: json.message || 'Email занят' };
  } catch {
    return null;
  }
};

/**
 * Схема валидации: дерево узлов `{ value: signal, validators }` — без `component`/`componentProps`.
 * Layout сюда не попадает, он целиком в json-schema.json.
 */
export function buildValidationSchema(model: M) {
  return {
    children: [
      {
        value: model.$.username,
        validators: [
          required({ message: 'Имя пользователя обязательно' }),
          minLength(3, { message: 'Минимум 3 символа' }),
          pattern(/^[a-zA-Z0-9_]{3,20}$/, { message: 'Латиница, цифры, _ (3-20)' }),
          usernameAvailable,
        ],
      },
      {
        value: model.$.email,
        validators: [
          required({ message: 'Email обязателен' }),
          email({ message: 'Некорректный email' }),
          emailAvailable,
        ],
      },
      {
        value: model.$.password,
        validators: [
          required({ message: 'Пароль обязателен' }),
          minLength(8, { message: 'Минимум 8 символов' }),
          passwordStrength,
        ],
      },
      {
        value: model.$.confirmPassword,
        validators: [required({ message: 'Подтвердите пароль' }), passwordsMatch],
      },
      {
        value: model.$.fullName,
        validators: [
          required({ message: 'Полное имя обязательно' }),
          minLength(2, { message: 'Минимум 2 символа' }),
        ],
      },
      {
        value: model.$.phone,
        validators: [
          required({ message: 'Телефон обязателен' }),
          pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Формат +7 (999) 123-45-67' }),
        ],
      },
      {
        value: model.$.captcha,
        validators: [required({ message: 'Введите captcha' }), captchaCode],
      },
      {
        value: model.$.acceptTerms,
        validators: [termsAccepted],
      },
    ],
  };
}
