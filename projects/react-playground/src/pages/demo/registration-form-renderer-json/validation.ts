/**
 * Валидация формы регистрации — контракт `@reformer/core/validation`.
 *
 * В JSON-DSL валидаторов нет by design: оператора `$validator(...)` не существует, а `JsonFieldNode`
 * несёт только layout. Правила живут здесь как обычная `ValidationSchema<Root>` (функция `({ model }) => void`):
 * значения проверяются оператором `validate(sig, [rules])`, async — `validateAsync(sig, [asyncRules])`,
 * cross-field — `cross(sig, fn)` (fn читает снапшот `model.get()`). Внешний раннер `validateModel`
 * разносит ошибки по нодам формы (`getNodeForSignal(sig).setErrors(...)`) и гасит поля, ставшие
 * валидными. Схему можно менять/получать с сервера, не трогая правила, и наоборот
 * (см. `@reformer/renderer-json` docs/llms/06-validation.md).
 *
 * Встроенные фабрики (`required`/`minLength`/…) переиспользуются как есть (value-only). Cross-field —
 * обычные функции `(f: Root) => ValidationError | null`. Публичная сигнатура не менялась:
 * `makeRegistrationValidator(model)` → `() => Promise<boolean>`.
 */

import { type FormModel, type ValidationError } from '@reformer/core';
import {
  validate,
  validateAsync,
  cross,
  defineValidationSchema,
  validateModel,
  type Rule,
  type AsyncRule,
} from '@reformer/core/validation';
import { required, email, minLength, pattern } from '@reformer/core/validators';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';

type Root = RegistrationFormData;
type M = FormModel<RegistrationFormData>;

// ── Кастомные правила уровня значения ───────────────────────────────────────

const passwordStrength: Rule<string> = (value) => {
  if (!value) return null;
  const ok = /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
  return ok ? null : { code: 'weak-password', message: 'Нужны заглавные, строчные буквы и цифры' };
};

const captchaCode: Rule<string> = (value) =>
  value !== 'ABC123'
    ? { code: 'invalid-captcha', message: 'Неверная captcha. Попробуйте ABC123' }
    : null;

const termsAccepted: Rule<boolean> = (value) =>
  value ? null : { code: 'terms-required', message: 'Необходимо принять условия' };

/** Async-правило: сетевой сбой НЕ блокирует отправку — возвращаем null, а не ошибку. */
const usernameAvailable: AsyncRule<string> = async (value, { signal }) => {
  if (!value || value.length < 3) return null;
  try {
    const res = await fetch(`/api/v1/auth/check-username?username=${encodeURIComponent(value)}`, {
      signal,
    });
    const json = await res.json();
    return json.available
      ? null
      : { code: 'username-taken', message: json.message || 'Имя занято' };
  } catch {
    return null;
  }
};

const emailAvailable: AsyncRule<string> = async (value, { signal }) => {
  if (!value || !value.includes('@')) return null;
  try {
    const res = await fetch(`/api/v1/auth/check-email?email=${encodeURIComponent(value)}`, {
      signal,
    });
    const json = await res.json();
    return json.available ? null : { code: 'email-taken', message: json.message || 'Email занят' };
  } catch {
    return null;
  }
};

// ── Cross-field правило ──────────────────────────────────────────────────────

/** Подтверждение пароля читает снапшот формы — сравнивает с `password` без каста. */
const passwordsMatch = (f: Root): ValidationError | null =>
  f.confirmPassword && f.password && f.confirmPassword !== f.password
    ? { code: 'passwords-mismatch', message: 'Пароли не совпадают' }
    : null;

// ── Схема валидации ──────────────────────────────────────────────────────────

const registrationSchema = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.username, [
    required({ message: 'Имя пользователя обязательно' }),
    minLength(3, { message: 'Минимум 3 символа' }),
    pattern(/^[a-zA-Z0-9_]{3,20}$/, { message: 'Латиница, цифры, _ (3-20)' }),
  ]);
  validateAsync(model.$.username, [usernameAvailable]);
  validate(model.$.email, [
    required({ message: 'Email обязателен' }),
    email({ message: 'Некорректный email' }),
  ]);
  validateAsync(model.$.email, [emailAvailable]);
  validate(model.$.password, [
    required({ message: 'Пароль обязателен' }),
    minLength(8, { message: 'Минимум 8 символов' }),
    passwordStrength,
  ]);
  validate(model.$.confirmPassword, [required({ message: 'Подтвердите пароль' })]);
  cross(model.$.confirmPassword, passwordsMatch);
  validate(model.$.fullName, [
    required({ message: 'Полное имя обязательно' }),
    minLength(2, { message: 'Минимум 2 символа' }),
  ]);
  validate(model.$.phone, [
    required({ message: 'Телефон обязателен' }),
    pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Формат +7 (999) 123-45-67' }),
  ]);
  validate(model.$.captcha, [required({ message: 'Введите captcha' }), captchaCode]);
  validate(model.$.acceptTerms, [termsAccepted]);
});

/**
 * Валидатор формы регистрации: `() => Promise<boolean>` (true, если нет блокирующих ошибок).
 * Прогон идёт через внешний раннер `validateModel(model, registrationSchema)` — ошибки сами
 * доезжают до нод формы (UI подсветит поля), устаревшие прогоны отменяются. Схема — стабильный
 * module-level `const` (важно для отмены устаревших прогонов в `validateModel`).
 */
export function makeRegistrationValidator(model: M): () => Promise<boolean> {
  return () => validateModel(model, registrationSchema);
}
