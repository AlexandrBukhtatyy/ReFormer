/**
 * Валидация формы регистрации — контракт `@reformer/core/validation`.
 *
 * В JSON-DSL валидаторов нет by design: оператора `$validator(...)` не существует, а `JsonFieldNode`
 * несёт только layout. Правила живут здесь как обычная `ValidationDefinition<Root>` (функция `({ model }) => void`):
 * значения проверяются оператором `validate(sig, [rules])`, async — `validateAsync(sig, [asyncRules])`,
 * cross-field — `cross(sig, fn)` (fn читает снапшот `model.get()`). Внешний раннер `validateModel`
 * разносит ошибки по нодам формы (`getNodeForSignal(sig).setIssues(...)`) и гасит поля, ставшие
 * валидными. Схему можно менять/получать с сервера, не трогая правила, и наоборот
 * (см. `@reformer/renderer-json` docs/llms/06-validation.md).
 *
 * Встроенные фабрики (`required`/`minLength`/…) переиспользуются как есть (value-only). Cross-field —
 * обычные функции `(f: Root) => ValidationIssue | null`. Публичная сигнатура не менялась:
 * `makeRegistrationValidator(model)` → `() => Promise<boolean>`.
 */

import { type FormModel, type ValidationIssue } from '@reformer/core';
import {
  validate,
  validateAsync,
  defineValidation,
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
  return ok ? null : { code: 'weak-password' };
};

const captchaCode: Rule<string> = (value) =>
  value !== 'ABC123' ? { code: 'invalid-captcha' } : null;

const termsAccepted: Rule<boolean> = (value) => (value ? null : { code: 'terms-required' });

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
      : { code: 'username-taken', params: { serverMessage: json.message } };
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
const passwordsMatch = (f: Root): ValidationIssue | null =>
  f.confirmPassword && f.password && f.confirmPassword !== f.password
    ? { code: 'passwords-mismatch' }
    : null;

// ── Схема валидации ──────────────────────────────────────────────────────────

const registrationSchema = defineValidation<Root>(({ model, cross }) => {
  validate(model.$.username, [
    required({ code: 'username.required' }),
    minLength(3, { code: 'username.minLength' }),
    pattern(/^[a-zA-Z0-9_]{3,20}$/, { code: 'username.pattern' }),
  ]);
  validateAsync(model.$.username, [usernameAvailable]);
  validate(model.$.email, [required({ code: 'email.required' }), email({ code: 'email.email' })]);
  validateAsync(model.$.email, [emailAvailable]);
  validate(model.$.password, [
    required({ code: 'password.required' }),
    minLength(8, { code: 'password.minLength' }),
    passwordStrength,
  ]);
  validate(model.$.confirmPassword, [required({ code: 'confirmPassword.required' })]);
  cross(model.$.confirmPassword, passwordsMatch);
  validate(model.$.fullName, [
    required({ code: 'fullName.required' }),
    minLength(2, { code: 'fullName.minLength' }),
  ]);
  validate(model.$.phone, [
    required({ code: 'phone.required' }),
    pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { code: 'phone.pattern' }),
  ]);
  validate(model.$.captcha, [required({ code: 'captcha.required' }), captchaCode]);
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
