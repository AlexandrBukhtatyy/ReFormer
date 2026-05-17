/**
 * ReFormer — схема валидации одной формы регистрации.
 * Демонстрирует все механизмы: built-in композицию, кастомные валидаторы,
 * async + debounce, cross-field, applyWhen, переиспользуемые под-схемы и validateItems.
 */
import type { AsyncValidator, FieldPath, Validator, ValidationSchemaFn } from '@reformer/core';
import {
  apply,
  applyWhen,
  email,
  minLength,
  notEmpty,
  pattern,
  required,
  validate,
  validateAsync,
  validateItems,
} from '@reformer/core/validators';

interface RegistrationData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: 'personal' | 'business';
  business: { companyName: string; taxId: string };
  phones: { number: string }[];
}

// (0) Переиспользуемая под-схема для примитивного поля:
//     внутри `path` — сам узел поля, валидаторы вешаются прямо на него
const userNameValidation: ValidationSchemaFn<string> = (path) => {
  validate(path, required());
  validate(path, minLength(3));
  validate(path, pattern(/^[a-zA-Z0-9_]+$/, { message: 'Только латиница, цифры и _' }));
};

// (1) Кастомный async-валидатор: возвращает { code, message } | null
const checkUsernameAvailable: AsyncValidator<RegistrationData, string> = async (value) => {
  if (!value || value.length < 3) return null;
  const res = await fetch(`/api/check-username?u=${encodeURIComponent(value)}`);
  const { available, message } = await res.json();
  return available ? null : { code: 'username-taken', message };
};

// (2) Кастомный sync-валидатор
const validatePasswordStrength: Validator<RegistrationData, string> = (value) => {
  if (!value) return null;
  const strong = /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
  return strong ? null : { code: 'weak-password', message: 'Нужны заглавные, строчные и цифры' };
};

// (3) Cross-field: третий аргумент — root, даёт доступ к другим полям
const validatePasswordsMatch: Validator<RegistrationData, string> = (value, _ctrl, root) => {
  const password = root.password.value.value;
  if (value && password && value !== password) {
    return { code: 'passwords-mismatch', message: 'Пароли не совпадают' };
  }
  return null;
};

// (4) Переиспользуемая под-схема для вложенного объекта
const businessProfileValidation: ValidationSchemaFn<RegistrationData['business']> = (path) => {
  validate(path.companyName, required({ message: 'Укажите название компании' }));
  validate(path.companyName, minLength(2));
  validate(path.taxId, required({ message: 'Укажите ИНН' }));
  validate(
    path.taxId,
    pattern(/^\d{10}$|^\d{12}$/, { message: 'ИНН должен содержать 10 или 12 цифр' })
  );
};

// (5) Под-схема для элемента массива
const phoneItemValidation: ValidationSchemaFn<{ number: string }> = (path) => {
  validate(path.number, required({ message: 'Введите номер' }));
  validate(path.number, pattern(/^\+\d{10,15}$/, { message: 'Формат: +79991234567' }));
};

// (6) Главная схема — собирает всё вместе
export const registrationValidation: ValidationSchemaFn<RegistrationData> = (
  path: FieldPath<RegistrationData>
) => {
  // Переиспользование набора правил для конкретного поля
  apply(path.username, userNameValidation);

  // async + debounce: один сетевой запрос на 500 мс простоя ввода
  validateAsync(path.username, checkUsernameAvailable, { debounce: 500 });

  validate(path.email, required());
  validate(path.email, email({ message: 'Некорректный email' }));

  // Кастомный sync-валидатор + штатный минимум
  validate(path.password, required());
  validate(path.password, validatePasswordStrength);

  // Cross-field: третий аргумент валидатора — root, даёт доступ к остальным полям
  validate(path.confirmPassword, required());
  validate(path.confirmPassword, validatePasswordsMatch);

  // Условная валидация: бизнес-блок проверяется только для accountType === 'business'
  applyWhen(
    path.accountType,
    (type) => type === 'business',
    (p) => {
      apply(p.business, businessProfileValidation);
    }
  );

  // Валидация массива: schema применяется к каждому элементу автоматически
  validate(path.phones, notEmpty({ message: 'Добавьте хотя бы один телефон' }));
  validateItems(path.phones, phoneItemValidation);
};
